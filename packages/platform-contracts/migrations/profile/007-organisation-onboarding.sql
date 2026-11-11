-- Stage I candidate: own-account organisation-onboarding draft.
-- No live activation, runtime grant, organisation/member creation or package.
-- Install transactionally as the accepted NOLOGIN access owner after profile001.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
   AND(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole))
   OR to_regprocedure('profitia_profile.current_user_id(boolean)') IS NULL
 THEN RAISE EXCEPTION 'Accepted profile schema and controlled owner required'; END IF;
END $guard$;

CREATE TABLE profitia_profile.organisation_onboarding_installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$')
);
CREATE TABLE profitia_profile.organisation_onboarding_policies(
 login_role name PRIMARY KEY REFERENCES profitia_profile.runtime_policies(login_role),
 enabled boolean NOT NULL DEFAULT false
);
CREATE TRIGGER organisation_onboarding_policy_fence BEFORE INSERT OR UPDATE OR DELETE ON profitia_profile.organisation_onboarding_policies
 FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision();
CREATE TRIGGER organisation_onboarding_policy_truncate_fence BEFORE TRUNCATE ON profitia_profile.organisation_onboarding_policies
 FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision();
CREATE TABLE profitia_profile.organisation_onboarding_drafts(
 user_id uuid PRIMARY KEY REFERENCES profitia_profile.user_profiles(user_id),
 answers jsonb NOT NULL CHECK(jsonb_typeof(answers)='object' AND octet_length(answers::text)<=16384),
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TRIGGER server_fields BEFORE INSERT OR UPDATE ON profitia_profile.organisation_onboarding_drafts
 FOR EACH ROW EXECUTE FUNCTION profitia_profile.server_fields();
DO $policies$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['organisation_onboarding_installation','organisation_onboarding_policies','organisation_onboarding_drafts'] LOOP
  EXECUTE format('ALTER TABLE profitia_profile.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE profitia_profile.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY controlled_owner ON profitia_profile.%I TO profitia_access_owner USING(true) WITH CHECK(true)',t);
 END LOOP;
END $policies$;

CREATE FUNCTION profitia_profile.organisation_onboarding_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile AS $fn$
DECLARE d text;
BEGIN
 PERFORM profitia_profile.runtime_descriptor();
 IF NOT EXISTS(SELECT 1 FROM profitia_profile.organisation_onboarding_policies WHERE login_role=session_user AND enabled)
 THEN RAISE EXCEPTION 'Onboarding unavailable' USING ERRCODE='PT403'; END IF;
 SELECT schema_digest INTO d FROM profitia_profile.organisation_onboarding_installation WHERE singleton AND schema_version='1.0.0';
 IF d IS NULL THEN RAISE EXCEPTION 'Onboarding installation unavailable' USING ERRCODE='PT403'; END IF;
 RETURN jsonb_build_object('schemaDigest',d,'enabled',true);
END $fn$;
CREATE FUNCTION profitia_profile.organisation_onboarding_current_user(p_write boolean DEFAULT false) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile AS $fn$
BEGIN
 PERFORM profitia_profile.organisation_onboarding_descriptor();
 RETURN profitia_profile.current_user_id(p_write);
END $fn$;
CREATE FUNCTION profitia_profile.organisation_onboarding_read() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile AS $fn$
DECLARE uid uuid;result jsonb;
BEGIN
 uid:=profitia_profile.organisation_onboarding_current_user();
 SELECT jsonb_build_object('userId',user_id,'version',version::text,'answers',answers) INTO result
  FROM profitia_profile.organisation_onboarding_drafts WHERE user_id=uid;
 RETURN coalesce(result,jsonb_build_object('userId',uid,'version','0','answers','{}'::jsonb));
END $fn$;
CREATE FUNCTION profitia_profile.organisation_onboarding_save(p_expected bigint,p_patch jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile AS $fn$
DECLARE uid uuid;old_version bigint;e record;c jsonb;n integer;
BEGIN
 uid:=profitia_profile.organisation_onboarding_current_user(true);
 IF p_expected IS NULL OR p_expected<0 OR p_expected>=9223372036854775807
  OR jsonb_typeof(p_patch) IS DISTINCT FROM 'object' OR p_patch='{}'::jsonb OR octet_length(p_patch::text)>16384
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN('nip','slug','industry','categories','teamRange','companySelection'))
 THEN RAISE EXCEPTION 'Invalid onboarding draft' USING ERRCODE='PT403'; END IF;
 FOR e IN SELECT key,value FROM jsonb_each(p_patch) LOOP
  IF e.key='companySelection' AND e.value<>'null'::jsonb AND(jsonb_typeof(e.value) IS DISTINCT FROM 'object'
    OR(SELECT count(*) FROM jsonb_object_keys(e.value))<>2 OR NOT(e.value?'sourceRef' AND e.value?'version')
    OR jsonb_typeof(e.value->'sourceRef') IS DISTINCT FROM 'string' OR length(e.value->>'sourceRef') NOT BETWEEN 1 AND 256 OR e.value->>'sourceRef'~'[[:cntrl:]]'
    OR jsonb_typeof(e.value->'version') IS DISTINCT FROM 'string' OR length(e.value->>'version') NOT BETWEEN 1 AND 256 OR e.value->>'version'~'[[:cntrl:]]')
   OR e.key='nip' AND(jsonb_typeof(e.value)<>'string' OR e.value#>>'{}' !~ '^[0-9]{10}$')
   OR e.key='slug' AND(jsonb_typeof(e.value)<>'string' OR length(e.value#>>'{}') NOT BETWEEN 3 AND 48 OR e.value#>>'{}' !~ '^[a-z0-9][a-z0-9-]+[a-z0-9]$')
   OR e.key='industry' AND(jsonb_typeof(e.value)<>'object' OR (e.value->>'id') IS NULL OR (e.value->>'id') NOT IN('construction','manufacturing','food','other')
     OR e.value->>'source' IS DISTINCT FROM 'USER' OR jsonb_typeof(e.value->'label') IS DISTINCT FROM 'string'
     OR length(e.value->>'label') NOT BETWEEN 1 AND 100 OR e.value->>'label' ~ '[[:cntrl:]]'
     OR(SELECT count(*) FROM jsonb_object_keys(e.value))<>3)
   OR e.key='teamRange' AND(jsonb_typeof(e.value)<>'object' OR (e.value->>'id') IS NULL OR (e.value->>'id') NOT IN('1-5','6-10','11+')
     OR e.value->'includesRespondent' IS DISTINCT FROM 'true'::jsonb OR e.value->>'source' IS DISTINCT FROM 'USER')
  THEN RAISE EXCEPTION 'Invalid onboarding draft field' USING ERRCODE='PT403'; END IF;
  IF e.key='categories' THEN
   IF jsonb_typeof(e.value)<>'array' OR jsonb_array_length(e.value) NOT BETWEEN 1 AND 20
   THEN RAISE EXCEPTION 'Invalid categories' USING ERRCODE='PT403'; END IF;
   FOR c IN SELECT value FROM jsonb_array_elements(e.value) LOOP
    IF jsonb_typeof(c)<>'object' OR(SELECT count(*) FROM jsonb_object_keys(c))<>4
      OR NOT(c?'catalogueId' AND c?'label' AND c?'key' AND c?'source')
      OR jsonb_typeof(c->'catalogueId') NOT IN('string','null')
      OR jsonb_typeof(c->'label') IS DISTINCT FROM 'string' OR length(c->>'label') NOT BETWEEN 1 AND 100
      OR c->>'label' ~ '[[:cntrl:]]' OR jsonb_typeof(c->'key') IS DISTINCT FROM 'string'
      OR length(c->>'key') NOT BETWEEN 1 AND 100 OR c->>'source' IS DISTINCT FROM 'USER'
    THEN RAISE EXCEPTION 'Invalid category' USING ERRCODE='PT403'; END IF;
   END LOOP;
  END IF;
 END LOOP;
 IF p_patch?'nip' AND NOT p_patch?'companySelection' THEN p_patch:=p_patch||'{"companySelection":null}'::jsonb; END IF;
 SELECT version INTO old_version FROM profitia_profile.organisation_onboarding_drafts WHERE user_id=uid FOR UPDATE;
 IF NOT FOUND THEN
  IF p_expected<>0 THEN RAISE EXCEPTION 'Draft version conflict' USING ERRCODE='PT409'; END IF;
  -- A missing row cannot be locked by SELECT FOR UPDATE. The unique insert
  -- arbitrates concurrent first saves; report the same CAS conflict as updates.
  INSERT INTO profitia_profile.organisation_onboarding_drafts(user_id,answers) VALUES(uid,p_patch) ON CONFLICT(user_id) DO NOTHING;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 THEN RAISE EXCEPTION 'Draft version conflict' USING ERRCODE='PT409'; END IF;
 ELSE
  IF old_version<>p_expected THEN RAISE EXCEPTION 'Draft version conflict' USING ERRCODE='PT409'; END IF;
  UPDATE profitia_profile.organisation_onboarding_drafts SET answers=
   (CASE WHEN p_patch?'nip' AND answers->>'nip' IS DISTINCT FROM p_patch->>'nip'
     THEN answers-ARRAY['companySelection','slug','industry','categories','teamRange'] ELSE answers END)||p_patch
   WHERE user_id=uid AND version=p_expected;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 THEN RAISE EXCEPTION 'Draft version conflict' USING ERRCODE='PT409'; END IF;
 END IF;
 RETURN profitia_profile.organisation_onboarding_read();
END $fn$;
REVOKE ALL ON TABLE profitia_profile.organisation_onboarding_installation,profitia_profile.organisation_onboarding_policies,profitia_profile.organisation_onboarding_drafts FROM PUBLIC;
REVOKE ALL ON FUNCTION profitia_profile.organisation_onboarding_descriptor(),profitia_profile.organisation_onboarding_current_user(boolean),profitia_profile.organisation_onboarding_read(),profitia_profile.organisation_onboarding_save(bigint,jsonb) FROM PUBLIC;
-- Owner must record the exact migration digest, enable only the intended runtime
-- and grant only descriptor/read/save after approval and real database tests.
