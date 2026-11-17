-- Optional Development projection; installs no commercial offer, mapping or grants.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
  AND(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole))
  OR to_regclass('profitia_profile.organisation_lifecycle_installation') IS NULL
 THEN RAISE EXCEPTION 'CONTROLLED_LIFECYCLE_OWNER_REQUIRED';END IF;
END $guard$;
CREATE TABLE profitia_profile.organisation_access_installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'));
CREATE TABLE profitia_profile.organisation_access_policies(
 login_role name PRIMARY KEY REFERENCES profitia_profile.runtime_policies(login_role),enabled boolean NOT NULL DEFAULT false,
 policy_id uuid NOT NULL UNIQUE,version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 150),expires_at timestamptz NOT NULL CHECK(isfinite(expires_at)),
 mappings jsonb NOT NULL CHECK(jsonb_typeof(mappings)='array' AND jsonb_array_length(mappings) BETWEEN 1 AND 64));
CREATE TABLE profitia_profile.organisation_access_managed_grants(
 application_id text NOT NULL,organisation_id uuid NOT NULL,product text NOT NULL,
 source_ref text NOT NULL,grant_version bigint NOT NULL CHECK(grant_version>0),
 PRIMARY KEY(application_id,organisation_id,product),
 FOREIGN KEY(application_id,organisation_id,product) REFERENCES profitia_access.product_grants(application_id,organisation_id,product));
DO $tables$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['organisation_access_installation','organisation_access_policies','organisation_access_managed_grants'] LOOP
  EXECUTE format('ALTER TABLE profitia_profile.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE profitia_profile.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY controlled_owner ON profitia_profile.%I TO profitia_access_owner USING(true) WITH CHECK(true)',t);
  EXECUTE format('REVOKE ALL ON profitia_profile.%I FROM PUBLIC',t);
 END LOOP;
END $tables$;
CREATE TRIGGER organisation_access_policy_fence BEFORE INSERT OR UPDATE OR DELETE ON profitia_profile.organisation_access_policies
 FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision();
CREATE TRIGGER organisation_access_policy_truncate_fence BEFORE TRUNCATE ON profitia_profile.organisation_access_policies
 FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision();
CREATE FUNCTION profitia_profile.organisation_access_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile,profitia_access AS $fn$
DECLARE d jsonb;p organisation_access_policies%ROWTYPE;m jsonb;op text;dg text;
BEGIN
 d:=profitia_profile.runtime_descriptor();PERFORM profitia_profile.organisation_lifecycle_descriptor();
 SELECT * INTO p FROM organisation_access_policies WHERE login_role=session_user AND enabled AND expires_at>clock_timestamp() FOR SHARE;
 SELECT schema_digest INTO dg FROM organisation_access_installation WHERE singleton;
 IF NOT FOUND OR p.policy_id IS NULL OR dg IS NULL OR d->>'environment'<>'development' OR d->>'fixedOrganisationId' IS NOT NULL
 THEN RAISE EXCEPTION 'ACCESS_PROJECTION_POLICY_UNAVAILABLE' USING ERRCODE='PT403';END IF;
 FOR m IN SELECT value FROM jsonb_array_elements(p.mappings) LOOP
  IF jsonb_typeof(m)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(m))<>5
   OR NOT(m?'capabilityId' AND m?'applicationId' AND m?'product' AND m?'feature' AND m?'operations')
   OR EXISTS(SELECT 1 FROM jsonb_each(m) e WHERE e.key<>'operations' AND jsonb_typeof(e.value)<>'string')
   OR m->>'capabilityId' NOT IN('SEATS','BENCHMARK','FORECAST','REPORTS','OPENAI_ASSISTANCE','SUPPLIER_INTELLIGENCE','EXPORTS')
   OR m->>'product' NOT IN('SPENDGURU','SUPPLIER_INTELLIGENCE')
   OR jsonb_typeof(m->'operations') IS DISTINCT FROM 'array' OR jsonb_array_length(m->'operations') NOT BETWEEN 1 AND 32
   OR NOT EXISTS(SELECT 1 FROM profitia_access.applications WHERE application_id=m->>'applicationId')
   OR (m->>'product'='SUPPLIER_INTELLIGENCE' AND m->>'feature' NOT IN('supplier_workspace','supplier_report'))
  THEN RAISE EXCEPTION 'EXPLICIT_MEMBER_MAPPING_REQUIRED' USING ERRCODE='PT403';END IF;
  FOR op IN SELECT jsonb_array_elements_text(m->'operations') LOOP
   IF NOT((m->>'feature'='market' AND op IN('knowledge.read','insights.report.start','insights.report.status','insights.report.list','insights.report.download'))
    OR(m->>'feature'='benchmark' AND op IN('benchmark.selection.read','benchmark.selection.write','benchmark.discovery.read','benchmark.discovery.request'))
    OR(m->>'feature'='forecast' AND op IN('forecast.read','forecast.request'))
    OR(m->>'feature'='category' AND op IN('category.read','category.write'))
    OR(m->>'feature'='personal_workspace' AND op IN('personal.list.read','personal.list.write'))
    OR(m->>'feature'='assistant' AND op='assistant.converse')
    OR(m->>'feature'='supplier_workspace' AND op IN('supplier.assignment.read','supplier.assignment.write'))
    OR(m->>'feature'='supplier_report' AND op IN('supplier.report.read','supplier.report.project','supplier.report.refresh',
     'supplier.private.read','supplier.private.reveal','supplier.private.refresh','supplier.location.read','supplier.location.write',
     'supplier.location.sync','supplier.location.geocode','supplier.report.export','supplier.private.export')))
   THEN RAISE EXCEPTION 'STANDARD_MEMBER_PERMISSION_CEILING_REQUIRED' USING ERRCODE='PT403';END IF;
  END LOOP;
 END LOOP;
 RETURN jsonb_build_object('schemaDigest',dg,'policyId',p.policy_id,'policyVersion',p.version::text,'sourceRef',p.source_ref,
  'expiresAt',least(p.expires_at,clock_timestamp()+interval '30 seconds'));
END $fn$;
CREATE FUNCTION profitia_profile.organisation_lifecycle_access_project(p_json text,p_until bigint,p_signature text,p_decision uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile,profitia_access AS $fn$
DECLARE uid uuid;oid uuid;p jsonb;s jsonb;m jsonb;target record;g profitia_access.product_grants%ROWTYPE;
 managed organisation_access_managed_grants%ROWTYPE;features_now text[];v_grant_version bigint;deadline timestamptz;
 assignment_until timestamptz;observed_until timestamptz;op text;dg text;needs_reconciliation boolean:=false;active boolean;
BEGIN
 uid:=profitia_profile.organisation_lifecycle_require('organisation.access.synchronise',p_decision);
 oid:=nullif(current_setting('profitia.lifecycle.organisation',true),'')::uuid;
 p:=profitia_profile.organisation_access_descriptor();
 IF oid IS NULL OR p_json IS NULL OR octet_length(p_json)>16384 OR profitia_profile.valid_attestation(
  'organisation.access.synchronise.commit',uid::text,encode(public.digest(p_json,'sha256'),'hex'),p_until,0,p_signature) IS NOT TRUE
 THEN RAISE EXCEPTION 'VERIFIED_CURRENT_ACCESS_SNAPSHOT_REQUIRED' USING ERRCODE='PT403';END IF;
 s:=p_json::jsonb;
 IF jsonb_typeof(s)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(s))<>8
  OR NOT(s?'userId' AND s?'organisationId' AND s?'applicationId' AND s?'status' AND s?'assignmentRef' AND s?'capabilities' AND s?'expiresAt' AND s?'assignmentUntil')
  OR EXISTS(SELECT 1 FROM jsonb_each(s) e WHERE e.key IN('userId','organisationId','applicationId','status','expiresAt') AND jsonb_typeof(e.value)<>'string')
  OR s->>'userId' IS DISTINCT FROM uid::text OR s->>'organisationId' IS DISTINCT FROM oid::text OR s->>'applicationId'<>'spendguru'
  OR s->>'status' NOT IN('ACTIVE','INACTIVE') OR jsonb_typeof(s->'capabilities') IS DISTINCT FROM 'array'
  OR jsonb_array_length(s->'capabilities')>32 OR EXISTS(SELECT 1 FROM jsonb_array_elements(s->'capabilities') c
   WHERE jsonb_typeof(c)<>'string' OR c#>>'{}' NOT IN('SEATS','BENCHMARK','FORECAST','REPORTS','OPENAI_ASSISTANCE','SUPPLIER_INTELLIGENCE','EXPORTS'))
 THEN RAISE EXCEPTION 'EXACT_CURRENT_ACCESS_SNAPSHOT_REQUIRED' USING ERRCODE='PT403';END IF;
 observed_until:=(s->>'expiresAt')::timestamptz;
 IF NOT isfinite(observed_until) OR observed_until<=clock_timestamp() OR observed_until>clock_timestamp()+interval '6 seconds'
 THEN RAISE EXCEPTION 'FRESH_ACCESS_SNAPSHOT_REQUIRED' USING ERRCODE='PT403';END IF;
 active:=s->>'status'='ACTIVE';
 IF active THEN
  assignment_until:=(s->>'assignmentUntil')::timestamptz;
  IF s->>'assignmentRef'!~'^package-assignment:[a-f0-9-]{36}:[1-9][0-9]*$' OR assignment_until IS NULL
   OR NOT isfinite(assignment_until) OR assignment_until<=clock_timestamp() OR jsonb_array_length(s->'capabilities')=0
  THEN RAISE EXCEPTION 'CURRENT_ASSIGNMENT_REQUIRED' USING ERRCODE='PT403';END IF;
 ELSE
  IF s->'assignmentRef'<>'null'::jsonb OR s->'assignmentUntil'<>'null'::jsonb OR s->'capabilities'<>'[]'::jsonb
  THEN RAISE EXCEPTION 'EXACT_INACTIVE_SNAPSHOT_REQUIRED' USING ERRCODE='PT403';END IF;
 END IF;
 deadline:=least(clock_timestamp()+interval '28 seconds',(p->>'expiresAt')::timestamptz,
  nullif(current_setting('profitia.scope_expires_at',true),'')::timestamptz,
  CASE WHEN active THEN assignment_until ELSE clock_timestamp() END);
 -- The exclusive lifecycle fence was acquired BEFORE Root lock_access. Detect
 -- independent/changed grants before any writes; never overwrite another basis.
 FOR target IN SELECT DISTINCT e->>'applicationId' AS app,e->>'product' AS product
  FROM organisation_access_policies pol CROSS JOIN LATERAL jsonb_array_elements(pol.mappings) e
  WHERE pol.login_role=session_user LOOP
  SELECT * INTO g FROM profitia_access.product_grants WHERE application_id=target.app AND organisation_id=oid AND product=target.product FOR UPDATE;
  IF FOUND AND NOT EXISTS(SELECT 1 FROM organisation_access_managed_grants x WHERE x.application_id=g.application_id
   AND x.organisation_id=g.organisation_id AND x.product=g.product AND x.source_ref=g.source_ref AND x.grant_version=g.version)
  THEN needs_reconciliation:=true;END IF;
 END LOOP;
 IF needs_reconciliation THEN RETURN jsonb_build_object('status','RECONCILIATION_REQUIRED');END IF;
 FOR target IN SELECT DISTINCT e->>'applicationId' AS app,e->>'product' AS product
  FROM organisation_access_policies pol CROSS JOIN LATERAL jsonb_array_elements(pol.mappings) e
  WHERE pol.login_role=session_user LOOP
  SELECT coalesce(array_agg(DISTINCT e->>'feature'),'{}'::text[]) INTO features_now
   FROM organisation_access_policies pol CROSS JOIN LATERAL jsonb_array_elements(pol.mappings) e
   WHERE pol.login_role=session_user AND e->>'applicationId'=target.app AND e->>'product'=target.product AND active
    AND s->'capabilities'?(e->>'capabilityId');
  IF cardinality(features_now)>0 THEN
   SELECT * INTO g FROM profitia_access.product_grants WHERE application_id=target.app AND organisation_id=oid AND product=target.product;
   IF FOUND AND g.status='ACTIVE' AND g.source_ref=s->>'assignmentRef' AND g.features @> features_now AND features_now @> g.features
    AND g.expires_at>clock_timestamp()+interval '12 seconds' AND g.expires_at<=deadline THEN
    deadline:=least(deadline,g.expires_at);
   ELSE
   INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at)
    VALUES(target.app,oid,target.product,features_now,'ACTIVE','EXPLICIT_OFFER',s->>'assignmentRef',deadline)
    ON CONFLICT(application_id,organisation_id,product) DO UPDATE SET features=EXCLUDED.features,status='ACTIVE',
     source='EXPLICIT_OFFER',source_ref=EXCLUDED.source_ref,expires_at=EXCLUDED.expires_at RETURNING version INTO v_grant_version;
   INSERT INTO organisation_access_managed_grants VALUES(target.app,oid,target.product,s->>'assignmentRef',v_grant_version)
    ON CONFLICT(application_id,organisation_id,product) DO UPDATE SET source_ref=EXCLUDED.source_ref,grant_version=EXCLUDED.grant_version;
   END IF;
   FOR m IN SELECT e FROM organisation_access_policies pol CROSS JOIN LATERAL jsonb_array_elements(pol.mappings) e
    WHERE pol.login_role=session_user AND e->>'applicationId'=target.app AND e->>'product'=target.product AND s->'capabilities'?(e->>'capabilityId') LOOP
    FOR op IN SELECT jsonb_array_elements_text(m->'operations') LOOP
     IF NOT EXISTS(SELECT 1 FROM profitia_access.permission_grants WHERE application_id=target.app AND organisation_id=oid AND user_id=uid
      AND effect='ALLOW' AND operation=op AND feature=m->>'feature' AND resource_id IS NULL) THEN
      INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature,resource_id)
       VALUES(gen_random_uuid(),target.app,oid,uid,'ALLOW',op,m->>'feature',NULL);
     END IF;
    END LOOP;
   END LOOP;
  ELSE
   UPDATE profitia_access.product_grants SET status='REVOKED',expires_at=clock_timestamp()
    WHERE application_id=target.app AND organisation_id=oid AND product=target.product AND(status<>'REVOKED' OR expires_at>clock_timestamp()) RETURNING version INTO v_grant_version;
   IF FOUND THEN UPDATE organisation_access_managed_grants SET grant_version=v_grant_version
    WHERE application_id=target.app AND organisation_id=oid AND product=target.product;END IF;
  END IF;
 END LOOP;
 -- Only this bounded deterministic authority mutation advanced the counter;
 -- identity, membership, deny rows, policy and lease expiries are unchanged.
 PERFORM set_config('profitia.policy_version','access-v1:'||(SELECT revision::text FROM profitia_access.installation WHERE singleton),true);
 RETURN jsonb_build_object('status',CASE WHEN active THEN 'SYNCHRONISED' ELSE 'PENDING_PACKAGE' END,'expiresAt',deadline);
END $fn$;
REVOKE ALL ON FUNCTION profitia_profile.organisation_access_descriptor(),
 profitia_profile.organisation_lifecycle_access_project(text,bigint,text,uuid) FROM PUBLIC;
