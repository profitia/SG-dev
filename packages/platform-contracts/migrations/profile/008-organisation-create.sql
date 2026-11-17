-- Stage I candidate. Controlled owner installation only; no runtime, policy,
-- grants, product entitlements, source calls or activation are created here.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
  AND(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole))
  OR to_regclass('profitia_profile.organisation_onboarding_drafts') IS NULL
 THEN RAISE EXCEPTION 'Accepted draft installation and controlled owner required';END IF;
END $guard$;
CREATE TABLE profitia_profile.organisation_bootstrap_installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'));
CREATE TABLE profitia_profile.organisation_bootstrap_policies(
 login_role name PRIMARY KEY REFERENCES profitia_profile.runtime_policies(login_role),
 enabled boolean NOT NULL DEFAULT false,policy_id uuid NOT NULL UNIQUE,version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256 AND source_ref!~'[[:cntrl:]]'),
 expires_at timestamptz NOT NULL CHECK(isfinite(expires_at)),
 membership_expires_at timestamptz NOT NULL CHECK(isfinite(membership_expires_at)),
 initial_permissions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(initial_permissions)='array' AND jsonb_array_length(initial_permissions)<=64));
CREATE TRIGGER organisation_bootstrap_policy_fence BEFORE INSERT OR UPDATE OR DELETE ON profitia_profile.organisation_bootstrap_policies
 FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision();
CREATE TRIGGER organisation_bootstrap_policy_truncate_fence BEFORE TRUNCATE ON profitia_profile.organisation_bootstrap_policies
 FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision();
CREATE TABLE profitia_profile.organisation_profiles(
 organisation_id uuid PRIMARY KEY REFERENCES profitia_access.organisations(organisation_id),
 country text NOT NULL CHECK(country='PL'),nip text NOT NULL CHECK(nip~'^[0-9]{10}$'),
 slug text NOT NULL CHECK(length(slug) BETWEEN 3 AND 48 AND slug~'^[a-z0-9][a-z0-9-]+[a-z0-9]$' AND slug!~'--'),
 company jsonb NOT NULL CHECK(jsonb_typeof(company)='object'),
 registry_ref text NOT NULL CHECK(length(registry_ref) BETWEEN 1 AND 256),
 registry_version text NOT NULL CHECK(length(registry_version) BETWEEN 1 AND 256),
 industry jsonb NOT NULL CHECK(jsonb_typeof(industry)='object'),
 team_range jsonb NOT NULL CHECK(jsonb_typeof(team_range)='object'),
 created_by uuid NOT NULL REFERENCES profitia_access.accounts(user_id),
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CONSTRAINT organisation_profiles_country_nip_key UNIQUE(country,nip),
 CONSTRAINT organisation_profiles_slug_key UNIQUE(slug));
CREATE TABLE profitia_profile.organisation_categories(
 category_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organisation_id uuid NOT NULL REFERENCES profitia_profile.organisation_profiles(organisation_id),
 category_key text NOT NULL CHECK(length(category_key) BETWEEN 1 AND 100),label text NOT NULL CHECK(length(label) BETWEEN 1 AND 100),
 catalogue_id text,created_by uuid NOT NULL REFERENCES profitia_access.accounts(user_id),source text NOT NULL CHECK(source='USER'),
 UNIQUE(organisation_id,category_key),UNIQUE(organisation_id,category_id));
CREATE TABLE profitia_profile.user_procurement_categories(
 organisation_id uuid NOT NULL,user_id uuid NOT NULL,category_id uuid NOT NULL,
 PRIMARY KEY(organisation_id,user_id,category_id),
 FOREIGN KEY(organisation_id,user_id) REFERENCES profitia_access.memberships(organisation_id,user_id),
 FOREIGN KEY(organisation_id,category_id) REFERENCES profitia_profile.organisation_categories(organisation_id,category_id));
-- A role label is descriptive. Only explicit access.permission_grants authorise.
CREATE TABLE profitia_profile.organisation_member_profiles(
 organisation_id uuid NOT NULL,user_id uuid NOT NULL,role_label text NOT NULL CHECK(role_label IN('OWNER','MEMBER')),
 PRIMARY KEY(organisation_id,user_id),FOREIGN KEY(organisation_id,user_id) REFERENCES profitia_access.memberships(organisation_id,user_id));
CREATE TABLE profitia_profile.organisation_bootstrap_commands(
 user_id uuid NOT NULL REFERENCES profitia_access.accounts(user_id),command_id uuid NOT NULL,draft_version bigint NOT NULL CHECK(draft_version>0),
 payload_digest text NOT NULL CHECK(payload_digest~'^[a-f0-9]{64}$'),
 receipt jsonb NOT NULL CHECK(jsonb_typeof(receipt)='object'),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(user_id,command_id));
DO $policies$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['organisation_bootstrap_installation','organisation_bootstrap_policies','organisation_profiles','organisation_categories','user_procurement_categories','organisation_member_profiles','organisation_bootstrap_commands'] LOOP
  EXECUTE format('ALTER TABLE profitia_profile.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE profitia_profile.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY controlled_owner ON profitia_profile.%I TO profitia_access_owner USING(true) WITH CHECK(true)',t);
 END LOOP;
END $policies$;
CREATE FUNCTION profitia_profile.organisation_bootstrap_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile,profitia_access AS $fn$
DECLARE d jsonb;p profitia_profile.organisation_bootstrap_policies%ROWTYPE;dg text;e jsonb;
BEGIN
 d:=profitia_profile.runtime_descriptor();
 SELECT * INTO p FROM profitia_profile.organisation_bootstrap_policies WHERE login_role=session_user AND enabled
  AND expires_at>clock_timestamp() AND membership_expires_at>clock_timestamp();
 IF NOT FOUND OR d->>'environment'<>'development' OR d->>'fixedOrganisationId' IS NOT NULL
 THEN RAISE EXCEPTION 'Bootstrap policy unavailable' USING ERRCODE='PT403';END IF;
 SELECT schema_digest INTO dg FROM profitia_profile.organisation_bootstrap_installation WHERE singleton AND schema_version='1.0.0';
 IF dg IS NULL THEN RAISE EXCEPTION 'Bootstrap installation unavailable' USING ERRCODE='PT403';END IF;
 FOR e IN SELECT value FROM jsonb_array_elements(p.initial_permissions) LOOP
  IF jsonb_typeof(e)<>'object' OR(SELECT count(*) FROM jsonb_object_keys(e))<>2 OR NOT(e?'operation' AND e?'feature')
   OR jsonb_typeof(e->'operation') IS DISTINCT FROM 'string' OR e->>'operation'!~'^[a-z][a-z0-9_.]{1,127}$'
   OR jsonb_typeof(e->'feature') IS DISTINCT FROM 'string' OR e->>'feature'!~'^[a-z][a-z0-9_]{1,127}$'
   OR e->>'operation' IN('identity.provision','organisation.create','invitation.accept','job.execute','knowledge.ingest')
  THEN RAISE EXCEPTION 'Explicit initial permissions required' USING ERRCODE='PT403';END IF;
 END LOOP;
 RETURN jsonb_build_object('schemaDigest',dg,'policyId',p.policy_id,'policyVersion',p.version::text,'sourceRef',p.source_ref,
  'expiresAt',least(p.expires_at,clock_timestamp()+interval '30 seconds'));
END $fn$;
-- Take the authority fence EXCLUSIVELY before lock_access's shared fence.
-- This avoids lock upgrades/deadlocks when the same transaction creates rights.
CREATE FUNCTION profitia_profile.organisation_bootstrap_lock() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile,profitia_access AS $fn$
BEGIN
 PERFORM profitia_profile.organisation_bootstrap_descriptor();
 PERFORM revision FROM profitia_access.installation WHERE singleton FOR UPDATE;
END $fn$;
CREATE FUNCTION profitia_profile.organisation_bootstrap_state(p_command uuid,p_version bigint,p_until bigint,p_signature text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile,profitia_access AS $fn$
DECLARE d jsonb;b jsonb;uid uuid;draft jsonb;actual bigint;r profitia_profile.organisation_bootstrap_commands%ROWTYPE;
BEGIN
 d:=profitia_profile.runtime_descriptor();b:=profitia_profile.organisation_bootstrap_descriptor();
 uid:=nullif(current_setting('profitia.user_id',true),'')::uuid;
 IF uid IS NULL OR p_command IS NULL OR p_version IS NULL OR p_version<=0
  OR profitia_access.scope_allows(d->>'applicationId',NULL,uid) IS NOT TRUE
  OR profitia_profile.valid_attestation('organisation.create.admit',uid::text,p_command::text||':'||p_version::text,p_until,0,p_signature) IS NOT TRUE
 THEN RAISE EXCEPTION 'Verified bootstrap self required' USING ERRCODE='PT403';END IF;
 SELECT * INTO r FROM profitia_profile.organisation_bootstrap_commands WHERE user_id=uid AND command_id=p_command;
 IF FOUND THEN
  IF r.draft_version<>p_version THEN RAISE EXCEPTION 'Command version conflict' USING ERRCODE='PT409';END IF;
 ELSE
  SELECT answers,version INTO draft,actual FROM profitia_profile.organisation_onboarding_drafts WHERE user_id=uid;
  IF actual IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'Draft version conflict' USING ERRCODE='PT409';END IF;
 END IF;
 PERFORM set_config('profitia.bootstrap.command_id',p_command::text,true),set_config('profitia.bootstrap.draft_version',p_version::text,true),
  set_config('profitia.bootstrap.expires_ms',p_until::text,true),set_config('profitia.bootstrap.signature',p_signature,true);
 RETURN jsonb_build_object('policy',b||jsonb_build_object('actorId',uid,'applicationId',d->>'applicationId','environment',d->>'environment',
  'operation','organisation.create','resourceId','current-organisation-onboarding','commandId',p_command,'transactionId',txid_current()::text),
  'draft',draft,'receipt',r.receipt);
END $fn$;
CREATE FUNCTION profitia_profile.organisation_bootstrap_create(p_payload text,p_until bigint,p_signature text,p_decision uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile,profitia_access AS $fn$
DECLARE d jsonb;b jsonb;uid uuid;cmd uuid;v bigint;a jsonb;co jsonb;q jsonb;c jsonb;e jsonb;cid uuid;oid uuid;receipt jsonb;dg text;cn text;
 p profitia_profile.organisation_bootstrap_policies%ROWTYPE;existing profitia_profile.organisation_bootstrap_commands%ROWTYPE;
BEGIN
 d:=profitia_profile.runtime_descriptor();b:=profitia_profile.organisation_bootstrap_descriptor();
 uid:=nullif(current_setting('profitia.user_id',true),'')::uuid;
 cmd:=nullif(current_setting('profitia.bootstrap.command_id',true),'')::uuid;
 v:=nullif(current_setting('profitia.bootstrap.draft_version',true),'')::bigint;
 IF uid IS NULL OR cmd IS NULL OR v IS NULL OR profitia_access.scope_allows(d->>'applicationId',NULL,uid) IS NOT TRUE
  OR profitia_profile.valid_attestation('organisation.create.admit',uid::text,cmd::text||':'||v::text,
    nullif(current_setting('profitia.bootstrap.expires_ms',true),'')::bigint,0,current_setting('profitia.bootstrap.signature',true)) IS NOT TRUE
  OR p_payload IS NULL OR octet_length(p_payload)>32768
 THEN RAISE EXCEPTION 'Verified creation scope required' USING ERRCODE='PT403';END IF;
 dg:=encode(public.digest(convert_to(p_payload,'UTF8'),'sha256'),'hex');
 IF profitia_profile.valid_attestation('organisation.create.commit',uid::text,cmd::text||':'||dg,p_until,0,p_signature) IS NOT TRUE
  OR NOT EXISTS(SELECT 1 FROM profitia_access.security_events WHERE application_id=d->>'applicationId' AND decision_id=p_decision AND phase='INTENT'
    AND event->>'operation'='organisation.create' AND event->>'actorId'=uid::text AND event->>'decision'='ALLOW'
    AND event->>'mode'='BOOTSTRAP' AND event->>'implementationVersion'='1.0.0-candidate.21')
 THEN RAISE EXCEPTION 'Authorised Root intent required' USING ERRCODE='PT403';END IF;
 q:=p_payload::jsonb;
 IF jsonb_typeof(q)<>'object' OR(SELECT count(*) FROM jsonb_object_keys(q))<>6
  OR NOT(q?'commandId' AND q?'draftVersion' AND q?'answers' AND q?'company' AND q?'registryRef' AND q?'registryVersion')
  OR q->>'commandId' IS DISTINCT FROM cmd::text OR q->>'draftVersion' IS DISTINCT FROM v::text
  OR jsonb_typeof(q->'registryRef') IS DISTINCT FROM 'string' OR length(q->>'registryRef') NOT BETWEEN 1 AND 256 OR q->>'registryRef'~'[[:cntrl:]]'
  OR jsonb_typeof(q->'registryVersion') IS DISTINCT FROM 'string' OR length(q->>'registryVersion') NOT BETWEEN 1 AND 256 OR q->>'registryVersion'~'[[:cntrl:]]'
 THEN RAISE EXCEPTION 'Invalid creation payload' USING ERRCODE='PT403';END IF;
 SELECT * INTO existing FROM profitia_profile.organisation_bootstrap_commands WHERE user_id=uid AND command_id=cmd;
 IF FOUND THEN
  IF existing.payload_digest<>dg THEN RAISE EXCEPTION 'Command payload conflict' USING ERRCODE='PT409';END IF;
  RETURN existing.receipt;
 END IF;
 SELECT answers INTO a FROM profitia_profile.organisation_onboarding_drafts WHERE user_id=uid AND version=v FOR UPDATE;
 IF NOT FOUND OR a IS DISTINCT FROM q->'answers' THEN RAISE EXCEPTION 'Draft version conflict' USING ERRCODE='PT409';END IF;
 IF(SELECT count(*) FROM jsonb_object_keys(a))<>6 OR NOT(a?'nip' AND a?'slug' AND a?'industry' AND a?'categories' AND a?'teamRange' AND a?'companySelection')
  OR jsonb_typeof(a->'companySelection') IS DISTINCT FROM 'object'
  OR a->>'slug' IN('www','app','api','admin','auth','login','register','account','dashboard','x-ray','support','help','billing','static','assets','cdn','mail','status','development','staging','production','dev','test','localhost','spendguru','profitia')
 THEN RAISE EXCEPTION 'Complete onboarding required' USING ERRCODE='PT403';END IF;
 co:=q->'company';
 IF jsonb_typeof(co) IS DISTINCT FROM 'object' OR(SELECT count(*) FROM jsonb_object_keys(co))<>8
  OR NOT(co?'entityType' AND co?'country' AND co?'nip' AND co?'krs' AND co?'regon' AND co?'legalName' AND co?'address' AND co?'postalCode')
  OR a->'companySelection'->>'sourceRef' IS DISTINCT FROM q->>'registryRef' OR a->'companySelection'->>'version' IS DISTINCT FROM q->>'registryVersion'
  OR co->>'entityType' IS DISTINCT FROM 'COMPANY' OR co->>'country' IS DISTINCT FROM 'PL' OR co->>'nip' IS DISTINCT FROM a->>'nip'
  OR co->>'krs'!~'^[0-9]{10}$' OR co->>'krs'='0000000000' OR co->>'regon'!~'^([0-9]{9}|[0-9]{14})$'
  OR jsonb_typeof(co->'legalName') IS DISTINCT FROM 'string' OR length(co->>'legalName') NOT BETWEEN 1 AND 300 OR co->>'legalName'~'[[:cntrl:]]'
  OR jsonb_typeof(co->'address') IS DISTINCT FROM 'string' OR length(co->>'address') NOT BETWEEN 1 AND 500 OR co->>'address'~'[[:cntrl:]]'
  OR co->>'postalCode'!~'^[0-9]{2}-[0-9]{3}$'
 THEN RAISE EXCEPTION 'Verified company required' USING ERRCODE='PT403';END IF;
 IF EXISTS(SELECT 1 FROM profitia_profile.organisation_profiles WHERE country='PL' AND nip=a->>'nip')
 THEN RETURN jsonb_build_object('status','ORGANISATION_ALREADY_EXISTS');END IF;
 IF EXISTS(SELECT 1 FROM profitia_profile.organisation_profiles WHERE slug=a->>'slug')
 THEN RETURN jsonb_build_object('status','SLUG_UNAVAILABLE');END IF;
 SELECT * INTO p FROM profitia_profile.organisation_bootstrap_policies WHERE login_role=session_user;
 oid:=gen_random_uuid();
 BEGIN
  INSERT INTO profitia_access.organisations VALUES(oid,'ACTIVE',1);
  INSERT INTO profitia_profile.organisation_profiles(organisation_id,country,nip,slug,company,registry_ref,registry_version,industry,team_range,created_by)
   VALUES(oid,'PL',a->>'nip',a->>'slug',co,q->>'registryRef',q->>'registryVersion',a->'industry',a->'teamRange',uid);
  INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at)
   VALUES(oid,uid,'ACTIVE',p.source_ref,p.membership_expires_at);
  INSERT INTO profitia_profile.organisation_member_profiles VALUES(oid,uid,'OWNER');
  FOR e IN SELECT value FROM jsonb_array_elements(p.initial_permissions) LOOP
   INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature,resource_id)
    VALUES(gen_random_uuid(),d->>'applicationId',oid,uid,'ALLOW',e->>'operation',e->>'feature',NULL) ON CONFLICT DO NOTHING;
  END LOOP;
  FOR c IN SELECT value FROM jsonb_array_elements(a->'categories') LOOP
   INSERT INTO profitia_profile.organisation_categories(organisation_id,category_key,label,catalogue_id,created_by,source)
    VALUES(oid,c->>'key',c->>'label',c->>'catalogueId',uid,'USER') RETURNING category_id INTO cid;
   INSERT INTO profitia_profile.user_procurement_categories VALUES(oid,uid,cid);
  END LOOP;
  receipt:=jsonb_build_object('status','CREATED','organisationId',oid,'slug',a->>'slug','activation','PENDING_PACKAGE','commandId',cmd);
  INSERT INTO profitia_profile.organisation_bootstrap_commands VALUES(uid,cmd,v,dg,receipt,clock_timestamp());
 EXCEPTION WHEN unique_violation THEN
  GET STACKED DIAGNOSTICS cn=CONSTRAINT_NAME;
  IF cn='organisation_profiles_country_nip_key' THEN RETURN jsonb_build_object('status','ORGANISATION_ALREADY_EXISTS');
  ELSIF cn='organisation_profiles_slug_key' THEN RETURN jsonb_build_object('status','SLUG_UNAVAILABLE');
  ELSE RAISE;END IF;
 END;
 -- Only the rights created by this fenced transaction advanced the revision.
 -- Rebind that counter without extending identity, lease, policy or scope.
 PERFORM set_config('profitia.policy_version','access-v1:'||(SELECT revision::text FROM profitia_access.installation WHERE singleton),true);
 RETURN receipt;
END $fn$;
REVOKE ALL ON TABLE profitia_profile.organisation_bootstrap_installation,profitia_profile.organisation_bootstrap_policies,
 profitia_profile.organisation_profiles,profitia_profile.organisation_categories,profitia_profile.user_procurement_categories,
 profitia_profile.organisation_member_profiles,profitia_profile.organisation_bootstrap_commands FROM PUBLIC;
REVOKE ALL ON FUNCTION profitia_profile.organisation_bootstrap_descriptor(),profitia_profile.organisation_bootstrap_lock(),
 profitia_profile.organisation_bootstrap_state(uuid,bigint,bigint,text),profitia_profile.organisation_bootstrap_create(text,bigint,text,uuid) FROM PUBLIC;
