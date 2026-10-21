-- Candidate only. Run ONCE inside a controlled transaction, after SQL001.
-- No roles, bindings, policies, accounts, grants, extensions or activation here.
DO $guard$ BEGIN
  IF current_user <> 'profitia_access_owner' OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
    AND (rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole))
    OR NOT EXISTS(SELECT 1 FROM profitia_access.installation WHERE singleton AND database_name=current_database()
      AND schema_version='1.0.0' AND schema_digest='356463492c3304ca11fa533f6e99f1d41628a3ab830488142c6030fb9a920ff2')
    OR to_regprocedure('public.hmac(bytea,bytea,text)') IS NULL
  THEN RAISE EXCEPTION 'Accepted access installation, controlled owner and pgcrypto prerequisite required'; END IF;
END $guard$;
CREATE SCHEMA profitia_profile AUTHORIZATION profitia_access_owner;
REVOKE ALL ON SCHEMA profitia_profile FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA profitia_profile REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

CREATE TABLE profitia_profile.installation (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  schema_version text NOT NULL CHECK(schema_version='1.0.0'),
  schema_digest text NOT NULL CHECK(schema_digest ~ '^[a-f0-9]{64}$')
);
-- Owner configures one exact application/runtime, initially DISABLED and deny
-- registration. Key is separate from SQL credentials and never readable by runtime.
CREATE TABLE profitia_profile.runtime_policies (
  login_role name PRIMARY KEY REFERENCES profitia_access.runtime_bindings(login_role),
  issuer text NOT NULL CHECK(issuer ~ '^https://[^/?#[:space:]]+$'),
  enabled boolean NOT NULL DEFAULT false,
  allow_registration boolean NOT NULL DEFAULT false,
  max_binding_lifetime_ms integer NOT NULL CHECK(max_binding_lifetime_ms BETWEEN 1000 AND 300000),
  proof_key bytea NOT NULL CHECK(octet_length(proof_key)=32)
);
CREATE TRIGGER policy_authority_fence BEFORE INSERT OR UPDATE OR DELETE ON profitia_profile.runtime_policies
  FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision();
CREATE TRIGGER policy_truncate_fence BEFORE TRUNCATE ON profitia_profile.runtime_policies
  FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision();
CREATE TABLE profitia_profile.user_profiles (
  user_id uuid PRIMARY KEY REFERENCES profitia_access.accounts(user_id),
  avatar_sex text CHECK(avatar_sex IN ('male','female')),
  job text CHECK(job IS NULL OR (job=btrim(job) AND char_length(job) BETWEEN 1 AND 160 AND job !~ '[[:cntrl:]]')),
  phone text CHECK(phone IS NULL OR phone ~ '^\+[1-9][0-9]{1,14}$'),
  version bigint NOT NULL DEFAULT 1 CHECK(version>0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE FUNCTION profitia_profile.server_fields() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,profitia_profile AS $fn$
BEGIN
  IF TG_OP='INSERT' THEN NEW.version:=1; NEW.created_at:=clock_timestamp(); NEW.updated_at:=NEW.created_at;
  ELSE
    IF NEW.user_id<>OLD.user_id THEN RAISE EXCEPTION 'Immutable profile owner' USING ERRCODE='42501'; END IF;
    NEW.version:=OLD.version+1; NEW.created_at:=OLD.created_at;
    NEW.updated_at:=greatest(clock_timestamp(),OLD.updated_at+interval '1 microsecond');
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER server_fields BEFORE INSERT OR UPDATE ON profitia_profile.user_profiles
  FOR EACH ROW EXECUTE FUNCTION profitia_profile.server_fields();
DO $policies$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['installation','runtime_policies','user_profiles'] LOOP
    EXECUTE format('ALTER TABLE profitia_profile.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE profitia_profile.%I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY controlled_owner ON profitia_profile.%I TO profitia_access_owner USING(true) WITH CHECK(true)',t);
  END LOOP;
END $policies$;

CREATE FUNCTION profitia_profile.runtime_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile,profitia_access AS $fn$
DECLARE d jsonb; p profitia_profile.runtime_policies%ROWTYPE; digest text;
BEGIN
  d:=profitia_access.runtime_descriptor();
  SELECT * INTO p FROM profitia_profile.runtime_policies WHERE login_role=session_user AND enabled;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile policy unavailable' USING ERRCODE='PT403'; END IF;
  SELECT schema_digest INTO digest FROM profitia_profile.installation WHERE singleton AND schema_version='1.0.0';
  IF digest IS NULL THEN RAISE EXCEPTION 'Profile installation unavailable' USING ERRCODE='PT403'; END IF;
  RETURN d||jsonb_build_object('profileSchemaDigest',digest,'enabled',true,'issuer',p.issuer);
END $fn$;

-- No signing oracle is exposed: signature validation alone cannot produce one.
-- Transaction ID, exact role/app/environment, principal, purpose and expiries
-- prevent pooled-session replay and self-asserted client/SQL context.
CREATE FUNCTION profitia_profile.valid_attestation(p_operation text,p_principal text,p_issuer text,
  p_until bigint,p_identity_until bigint,p_signature text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile,profitia_access AS $fn$
DECLARE d jsonb; k bytea; expected text; now_ms bigint;
BEGIN
  d:=profitia_profile.runtime_descriptor(); now_ms:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
  IF p_signature IS NULL OR p_signature !~ '^[a-f0-9]{64}$' OR p_until IS NULL OR p_until<=now_ms OR p_until>now_ms+5000
    OR p_principal IS NULL OR p_principal='' OR p_principal ~ '[[:cntrl:]]' OR p_issuer IS NULL OR p_issuer ~ '[[:cntrl:]]'
    OR p_identity_until IS NULL THEN RETURN false; END IF;
  SELECT proof_key INTO k FROM profitia_profile.runtime_policies WHERE login_role=session_user AND enabled;
  expected:=encode(public.hmac(convert_to(concat_ws(chr(31),d->>'environment',d->>'applicationId',session_user::text,
    p_operation,txid_current()::text,p_principal,p_issuer,p_until::text,p_identity_until::text),'UTF8'),k,'sha256'),'hex');
  RETURN expected=p_signature;
END $fn$;

CREATE FUNCTION profitia_profile.scope_allows(p_user uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile,profitia_access AS $fn$
DECLARE d jsonb; op text; until_ms bigint;
BEGIN
  d:=profitia_profile.runtime_descriptor(); op:=current_setting('profitia.profile.operation',true);
  until_ms:=nullif(current_setting('profitia.profile.expires_ms',true),'')::bigint;
  RETURN coalesce(op IN ('account.settings.read','account.settings.write')
    AND p_user=nullif(current_setting('profitia.user_id',true),'')::uuid
    AND profitia_access.scope_allows(d->>'applicationId',NULL,p_user)
    AND profitia_profile.valid_attestation(op,p_user::text,'',until_ms,0,current_setting('profitia.profile.signature',true)),false);
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END $fn$;
CREATE POLICY account_self ON profitia_profile.user_profiles FOR SELECT
  USING(profitia_profile.scope_allows(user_id));

CREATE FUNCTION profitia_profile.current_user_id(p_write boolean DEFAULT false) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile AS $fn$
DECLARE uid uuid;
BEGIN
  uid:=nullif(current_setting('profitia.user_id',true),'')::uuid;
  IF uid IS NULL OR NOT profitia_profile.scope_allows(uid)
    OR p_write AND current_setting('profitia.profile.operation',true) IS DISTINCT FROM 'account.settings.write'
  THEN RAISE EXCEPTION 'Account self required' USING ERRCODE='PT403'; END IF;
  RETURN uid;
END $fn$;
CREATE FUNCTION profitia_profile.read_current() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile AS $fn$
DECLARE uid uuid; result jsonb;
BEGIN
  uid:=profitia_profile.current_user_id();
  SELECT to_jsonb(p)||jsonb_build_object('version',p.version::text) INTO result FROM profitia_profile.user_profiles p WHERE p.user_id=uid;
  RETURN result;
END $fn$;
CREATE FUNCTION profitia_profile.ensure_current() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile AS $fn$
DECLARE uid uuid;
BEGIN
  uid:=profitia_profile.current_user_id(true);
  INSERT INTO profitia_profile.user_profiles(user_id) VALUES(uid) ON CONFLICT DO NOTHING;
  RETURN profitia_profile.read_current();
END $fn$;
CREATE FUNCTION profitia_profile.update_current(p_expected_version bigint,p_patch jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile AS $fn$
DECLARE uid uuid; n integer;
BEGIN
  uid:=profitia_profile.current_user_id(true);
  IF p_expected_version IS NULL OR p_expected_version<=0 OR jsonb_typeof(p_patch) IS DISTINCT FROM 'object'
    OR p_patch='{}'::jsonb OR EXISTS(SELECT 1 FROM jsonb_each(p_patch) e WHERE e.key NOT IN ('avatar_sex','job','phone')
      OR jsonb_typeof(e.value) NOT IN ('string','null'))
  THEN RAISE EXCEPTION 'Invalid profile patch' USING ERRCODE='PT403'; END IF;
  UPDATE profitia_profile.user_profiles SET
    avatar_sex=CASE WHEN p_patch ? 'avatar_sex' THEN p_patch->>'avatar_sex' ELSE avatar_sex END,
    job=CASE WHEN p_patch ? 'job' THEN nullif(normalize(btrim(p_patch->>'job'),NFC),'') ELSE job END,
    phone=CASE WHEN p_patch ? 'phone' THEN nullif(p_patch->>'phone','') ELSE phone END
    WHERE user_id=uid AND version=p_expected_version;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 THEN RAISE EXCEPTION 'Profile version conflict' USING ERRCODE='PT409'; END IF;
  RETURN profitia_profile.read_current();
END $fn$;

CREATE FUNCTION profitia_profile.provision_account(p_issuer text,p_subject text,p_identity_until bigint,p_until bigint,p_signature text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile,profitia_access AS $fn$
DECLARE d jsonb; p profitia_profile.runtime_policies%ROWTYPE; e profitia_access.external_identities%ROWTYPE;
  uid uuid; until_at timestamptz; now_ms bigint;
BEGIN
  -- Same access-authority fence as the existing store; serializes admission and
  -- concurrent creation and conflicts with revocation/policy changes until COMMIT.
  PERFORM revision FROM profitia_access.installation WHERE singleton FOR UPDATE;
  d:=profitia_profile.runtime_descriptor();
  SELECT * INTO p FROM profitia_profile.runtime_policies WHERE login_role=session_user AND enabled;
  now_ms:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
  IF p_issuer IS DISTINCT FROM p.issuer OR p_subject IS NULL OR length(p_subject) NOT BETWEEN 1 AND 256
    OR p_identity_until IS NULL OR p_identity_until<=now_ms OR p_until>p_identity_until
    OR profitia_profile.valid_attestation('identity.provision',p_subject,p_issuer,p_until,p_identity_until,p_signature) IS NOT TRUE
  THEN RAISE EXCEPTION 'Verified identity and policy required' USING ERRCODE='PT403'; END IF;
  SELECT * INTO e FROM profitia_access.external_identities WHERE issuer=p_issuer AND subject=p_subject;
  IF FOUND THEN
    IF e.status<>'ACTIVE' OR e.expires_at<=clock_timestamp()
      OR NOT EXISTS(SELECT 1 FROM profitia_access.accounts WHERE user_id=e.user_id AND status='ACTIVE')
    THEN RAISE EXCEPTION 'Binding unavailable; renewal is not automatic' USING ERRCODE='PT403'; END IF;
    uid:=e.user_id;
  ELSE
    IF NOT p.allow_registration THEN RAISE EXCEPTION 'Registration denied' USING ERRCODE='PT403'; END IF;
    uid:=gen_random_uuid(); until_at:=to_timestamp(least(p_identity_until,now_ms+p.max_binding_lifetime_ms)/1000.0);
    INSERT INTO profitia_access.accounts(user_id,status) VALUES(uid,'ACTIVE');
    INSERT INTO profitia_access.external_identities(binding_id,issuer,subject,user_id,status,source_ref,expires_at)
      VALUES(gen_random_uuid(),p_issuer,p_subject,uid,'ACTIVE','identity-provisioning:v1',until_at);
  END IF;
  INSERT INTO profitia_profile.user_profiles(user_id) VALUES(uid) ON CONFLICT DO NOTHING;
  PERFORM profitia_access.append_audit(jsonb_build_object('applicationId',d->>'applicationId','environment',d->>'environment',
    'decisionId',gen_random_uuid()::text,'phase','DECISION','decision','ALLOW','reasonCode','SUCCEEDED',
    'operation','identity.provision','actorId',uid::text,'actorKind','HUMAN','organisationId',NULL));
  RETURN uid;
END $fn$;

REVOKE ALL ON ALL TABLES IN SCHEMA profitia_profile FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA profitia_profile FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_profile FROM PUBLIC;
-- Owner later records the exact migration digest, configures disabled policy,
-- provisions the separate ordinary runtime and grants only the documented API.
