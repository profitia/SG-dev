-- Optional, disabled-by-default admission for ONE public company report.
-- Existing callers retain current human authorization. No role or grant is seeded.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
  AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication))
  OR to_regprocedure('profitia_request_work.scope_allows(uuid,text,uuid,uuid,text)') IS NULL
  OR NOT EXISTS(SELECT 1 FROM profitia_access.installation WHERE singleton AND environment='development')
  OR NOT EXISTS(SELECT 1 FROM profitia_request_work.installation WHERE singleton AND schema_version='1.0.0'
   AND schema_digest='19fb1d9045bccdb3299317b4c5b7df41e361e971c83ab683a55b56d6fbc8e5fe') THEN
  RAISE EXCEPTION 'Controlled owner and accepted native Work required' USING ERRCODE='42501'; END IF;
END $guard$;
CREATE SCHEMA profitia_report_admission AUTHORIZATION profitia_access_owner;
CREATE TABLE profitia_report_admission.installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),source_ref text NOT NULL
);
CREATE TABLE profitia_report_admission.receivers(
 foreground_role name NOT NULL REFERENCES profitia_access.runtime_bindings(login_role),
 executor_role name NOT NULL REFERENCES profitia_services.runtime_bindings(login_role),
 enabled boolean NOT NULL DEFAULT false,PRIMARY KEY(foreground_role,executor_role)
);
CREATE TABLE profitia_report_admission.admissions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_id uuid NOT NULL UNIQUE REFERENCES profitia_jobs.dispatches(job_id),
 secret_hash text NOT NULL CHECK(secret_hash~'^[a-f0-9]{64}$'),nip text NOT NULL CHECK(nip~'^[0-9]{10}$'),
 foreground_role name NOT NULL,executor_role name NOT NULL,job_state jsonb NOT NULL,
 identity_binding jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 ready_until timestamptz NOT NULL,expires_at timestamptz NOT NULL,started_at timestamptz,
 CHECK(expires_at>ready_until AND expires_at<=created_at+interval '3 minutes'),
 FOREIGN KEY(foreground_role,executor_role) REFERENCES profitia_report_admission.receivers
);
DO $rls$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['installation','receivers','admissions'] LOOP
  EXECUTE format('ALTER TABLE profitia_report_admission.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE profitia_report_admission.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY controlled_owner ON profitia_report_admission.%I TO profitia_access_owner USING(true) WITH CHECK(true)',t);
 END LOOP;
END $rls$;
CREATE TRIGGER receiver_revision BEFORE INSERT OR UPDATE OR DELETE ON profitia_report_admission.receivers
 FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision();
CREATE TRIGGER immutable_installation BEFORE UPDATE OR DELETE ON profitia_report_admission.installation
 FOR EACH ROW EXECUTE FUNCTION profitia_supplier_jobs.immutable();
CREATE TRIGGER immutable_installation_truncate BEFORE TRUNCATE ON profitia_report_admission.installation
 FOR EACH STATEMENT EXECUTE FUNCTION profitia_supplier_jobs.immutable();
CREATE FUNCTION profitia_report_admission.runtime_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;i profitia_report_admission.installation%ROWTYPE;BEGIN
 d:=profitia_access.runtime_descriptor();SELECT * INTO i FROM profitia_report_admission.installation WHERE singleton;
 IF d IS NULL OR NOT FOUND OR NOT EXISTS(SELECT 1 FROM profitia_report_admission.receivers
  WHERE enabled AND session_user IN(foreground_role,executor_role)) THEN RETURN NULL;END IF;
 RETURN d||jsonb_build_object('schemaVersion',i.schema_version,'schemaDigest',i.schema_digest);
END $fn$;
CREATE FUNCTION profitia_report_admission.issue(p_request uuid,p_nip text,p_secret text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE s jsonb;g profitia_jobs.delegations%ROWTYPE;b profitia_jobs.operation_bindings%ROWTYPE;
 a profitia_report_admission.admissions%ROWTYPE;e jsonb;deadline timestamptz;required text;BEGIN
 IF profitia_report_admission.runtime_descriptor() IS NULL OR p_secret!~'^[a-f0-9]{64}$' OR p_nip!~'^[0-9]{10}$'
  OR nullif(current_setting('profitia.native_work.scope',true),'')::jsonb->>1 IS DISTINCT FROM 'FORM_REPORT_ADMISSION' THEN RETURN NULL;END IF;
 s:=profitia_jobs.current_job(p_request);
 SELECT * INTO g FROM profitia_jobs.delegations WHERE request_id=p_request;
 SELECT * INTO b FROM profitia_jobs.operation_bindings WHERE binding_id=g.binding_id;
 IF s IS NULL OR profitia_request_work.scope_allows(p_request,'FORM_REPORT_ADMISSION',g.organisation_id,g.user_id,'WRITE') IS NOT TRUE
  OR g.operation<>'supplier.report.refresh' OR g.payload_digest IS DISTINCT FROM
  encode(sha256(convert_to('{"kind":"SUPPLIER_REPORT","nip":"'||p_nip||'"}','UTF8')),'hex')
  OR NOT EXISTS(SELECT 1 FROM profitia_report_admission.receivers WHERE enabled AND foreground_role=b.foreground_role AND executor_role=session_user)
  THEN RETURN NULL;END IF;
 FOREACH required IN ARRAY ARRAY['supplier.report.read','supplier.report.project'] LOOP
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s->'delegation'->'target'->'access'->'permissions') p
    WHERE p->>'operation'=required AND p->>'feature'='supplier_report'
      AND(p->>'resourceId' IS NULL OR required='supplier.report.project' AND p->>'resourceId'='supplier-report:COMPANY:'||p_nip))
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(s->'delegation'->'target'->'access'->'denies') p
    WHERE p->>'operation'=required AND p->>'feature'='supplier_report'
      AND(p->>'resourceId' IS NULL OR p->>'resourceId' IN('supplier-report:KRS:catalog','supplier-report:COMPANY:'||p_nip))) THEN RETURN NULL;END IF;
 END LOOP;
 SELECT jsonb_build_object('environment',g.environment,'issuer',x.issuer,'subject',x.subject,'userId',g.user_id,
  'status','ACTIVE','version',x.binding_id::text||':'||x.version::text||':'||u.version::text,'sourceRef',x.source_ref,'expiresAt',x.expires_at)
  INTO e FROM profitia_access.external_identities x JOIN profitia_access.accounts u USING(user_id)
  WHERE x.binding_id=g.identity_binding_id AND x.version=g.identity_binding_version AND x.status='ACTIVE' AND u.status='ACTIVE';
 IF e IS NULL THEN RETURN NULL;END IF;
 SELECT least(clock_timestamp()+interval '3 minutes',g.expires_at,(e->>'expiresAt')::timestamptz,
  m.expires_at,x.expires_at,p.expires_at) INTO deadline FROM profitia_access.memberships m,
  profitia_modules.application_bindings x,profitia_access.product_grants p
  WHERE m.organisation_id=g.organisation_id AND m.user_id=g.user_id AND m.status='ACTIVE'
   AND x.application_id=g.application_id AND x.module_id='supplier_report' AND x.status='ACTIVE'
   AND p.application_id=g.application_id AND p.organisation_id=g.organisation_id
   AND p.product='SUPPLIER_INTELLIGENCE' AND p.status='ACTIVE';
 IF deadline IS NULL OR deadline<=clock_timestamp()+interval '10 seconds' THEN RETURN NULL;END IF;
 INSERT INTO profitia_report_admission.admissions(request_id,secret_hash,nip,foreground_role,executor_role,job_state,identity_binding,ready_until,expires_at)
 VALUES(p_request,p_secret,p_nip,b.foreground_role,session_user,s,e,least(clock_timestamp()+interval '2 minutes',deadline-interval '5 seconds'),deadline) RETURNING * INTO a;
 RETURN jsonb_build_object('id',a.id,'requestId',a.request_id,'nip',a.nip,'readyUntil',a.ready_until,'expiresAt',a.expires_at);
END $fn$;
CREATE FUNCTION profitia_report_admission.read(p_id uuid,p_secret text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE a profitia_report_admission.admissions%ROWTYPE;d jsonb;s jsonb;BEGIN
 d:=profitia_report_admission.runtime_descriptor();
 SELECT * INTO a FROM profitia_report_admission.admissions WHERE id=p_id AND secret_hash=p_secret
  AND expires_at>clock_timestamp() AND(started_at IS NOT NULL OR ready_until>clock_timestamp())
  AND session_user IN(foreground_role,executor_role);
 IF d IS NULL OR NOT FOUND OR NOT EXISTS(SELECT 1 FROM profitia_report_admission.receivers
  WHERE enabled AND foreground_role=a.foreground_role AND executor_role=a.executor_role) THEN RETURN NULL;END IF;
 IF NOT EXISTS(SELECT 1 FROM profitia_jobs.dispatches j JOIN profitia_jobs.delegations g USING(delegation_id)
   WHERE j.job_id=a.request_id AND j.status NOT IN('EXPIRED','CANCELLED') AND g.status='ACTIVE' AND g.expires_at>clock_timestamp())
  OR NOT EXISTS(SELECT 1 FROM profitia_services.runtime_bindings b JOIN pg_roles r ON r.rolname=b.login_role
   WHERE b.login_role=a.executor_role AND b.status='ACTIVE' AND b.expires_at>clock_timestamp()
    AND NOT(r.rolsuper OR r.rolbypassrls OR r.rolinherit OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication)
    AND 'database-service:'||b.binding_id::text||':'||b.version::text=a.job_state->>'serviceBindingVersion') THEN RETURN NULL;END IF;
 s:=a.job_state->'delegation';
 RETURN jsonb_build_object('id',a.id,'requestId',a.request_id,'nip',a.nip,'schemaDigest',d->>'schemaDigest',
  'applicationId',s->'target'->'application'->>'appId','environment',d->>'environment',
  'organisationId',s->>'organisationId','userId',s->>'subjectUserId','payloadDigest',s->>'payloadDigest',
  'identity',jsonb_build_object('issuer',a.identity_binding->>'issuer','subject',a.identity_binding->>'subject','version',a.identity_binding->>'version'),
  'readyUntil',a.ready_until,'expiresAt',a.expires_at,'status',CASE WHEN a.started_at IS NULL THEN 'PREPARED' ELSE 'RUNNING' END);
END $fn$;
CREATE FUNCTION profitia_report_admission.start(p_id uuid,p_secret text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF profitia_report_admission.read(p_id,p_secret) IS NULL THEN RETURN false;END IF;
 UPDATE profitia_report_admission.admissions SET started_at=clock_timestamp() WHERE id=p_id AND started_at IS NULL;
 RETURN true;
END $fn$;
CREATE FUNCTION profitia_report_admission.bind_job(p_id uuid,p_secret text,p_job uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE r jsonb;BEGIN
 r:=profitia_report_admission.read(p_id,p_secret);
 IF r IS NULL OR r->>'requestId' IS DISTINCT FROM p_job::text OR NOT EXISTS(SELECT 1 FROM profitia_report_admission.admissions
  WHERE id=p_id AND executor_role=session_user AND started_at IS NOT NULL) THEN RETURN false;END IF;
 PERFORM set_config('profitia.report.admission',jsonb_build_array(p_id,p_secret,txid_current()::text)::text,true);
 RETURN true;
END $fn$;
-- The unexported marker is checked against the stored hash, ordinary role and
-- physical transaction every time. A caller-created GUC conveys no authority.
CREATE FUNCTION profitia_report_admission.current() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE m jsonb;BEGIN
 m:=nullif(current_setting('profitia.report.admission',true),'')::jsonb;
 IF m->>2 IS DISTINCT FROM txid_current()::text THEN RETURN NULL;END IF;
 RETURN profitia_report_admission.read((m->>0)::uuid,m->>1);
EXCEPTION WHEN invalid_text_representation THEN RETURN NULL;END $fn$;
CREATE FUNCTION profitia_report_admission.append_job_intent(p_id uuid,p_secret text,p_event jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF p_event->>'phase' IS DISTINCT FROM 'INTENT' OR p_event->>'decision' IS DISTINCT FROM 'ALLOW'
  OR p_event ? 'requestWork' OR p_event ? 'requestInspection'
  OR profitia_report_admission.bind_job(p_id,p_secret,(p_event->>'resourceId')::uuid) IS NOT TRUE THEN
  RAISE EXCEPTION 'Admitted dispatch intent unavailable' USING ERRCODE='42501';END IF;
 -- Existing canonical writer, same ordinary executor and same actual SQL
 -- transaction. This independent INTENT remains durable before Source delivery.
 PERFORM profitia_jobs.append_audit(p_event);
END $fn$;
DO $copy$ BEGIN EXECUTE replace(pg_get_functiondef('profitia_jobs.current_job(uuid)'::regprocedure),'FUNCTION profitia_jobs.current_job(','FUNCTION profitia_jobs.current_job_before_report_admission(');END $copy$;
CREATE OR REPLACE FUNCTION profitia_jobs.current_job(p_job uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE r jsonb;s jsonb;d jsonb;v jsonb;t jsonb;a profitia_report_admission.admissions%ROWTYPE;
 b profitia_jobs.operation_bindings%ROWTYPE;j profitia_jobs.dispatches%ROWTYPE;deadline timestamptz;BEGIN
 r:=profitia_report_admission.current();
 IF r IS NULL THEN
  IF nullif(current_setting('profitia.report.admission',true),'') IS NOT NULL THEN RETURN NULL;END IF;
  RETURN profitia_jobs.current_job_before_report_admission(p_job);END IF;
 SELECT * INTO a FROM profitia_report_admission.admissions WHERE id=(r->>'id')::uuid AND executor_role=session_user AND request_id=p_job;
 IF NOT FOUND THEN RETURN NULL;END IF;
 d:=profitia_jobs.runtime_descriptor();v:=profitia_services.runtime_descriptor();s:=a.job_state;t:=s->'delegation'->'target';
 SELECT * INTO j FROM profitia_jobs.dispatches WHERE job_id=p_job AND status NOT IN('EXPIRED','CANCELLED');
 IF NOT FOUND OR d IS NULL OR v IS NULL OR d->>'applicationId' IS DISTINCT FROM s->>'applicationId'
  OR v->>'proofRef' IS DISTINCT FROM s->>'serviceBindingVersion' THEN RETURN NULL;END IF;
 SELECT * INTO b FROM profitia_jobs.operation_bindings WHERE binding_id=(s->'delegation'->>'bindingId')::uuid
  AND version=(s->'delegation'->>'bindingVersion')::bigint AND status='ACTIVE' AND expires_at>clock_timestamp()
  AND foreground_role=a.foreground_role AND executor_application_id=d->>'applicationId';
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM profitia_access.runtime_bindings rb JOIN profitia_access.applications app USING(application_id)
   WHERE rb.login_role=a.foreground_role AND rb.status='ACTIVE' AND app.status='ACTIVE'
    AND app.fixed_organisation_id::text IS NOT DISTINCT FROM t->'application'->>'organisationId')
  OR NOT EXISTS(SELECT 1 FROM profitia_access.organisations WHERE organisation_id=(r->>'organisationId')::uuid AND status='ACTIVE')
  OR NOT EXISTS(SELECT 1 FROM profitia_modules.application_bindings WHERE application_id=b.application_id AND module_id='supplier_report'
   AND binding_id=(t->'module'->>'bindingId')::uuid AND version=(t->'module'->>'version')::bigint AND status='ACTIVE' AND expires_at>clock_timestamp())
  OR NOT EXISTS(SELECT 1 FROM profitia_jobs.delegations WHERE request_id=p_job AND status='ACTIVE' AND expires_at>clock_timestamp())
  OR NOT EXISTS(SELECT 1 FROM profitia_jobs.execution_grants WHERE login_role=session_user AND binding_id=b.binding_id
   AND organisation_id=(r->>'organisationId')::uuid AND effect='ALLOW' AND status='ACTIVE' AND expires_at>clock_timestamp()
   AND(resource_id IS NULL OR resource_id=t->>'resourceId'))
  OR EXISTS(SELECT 1 FROM profitia_jobs.execution_grants WHERE login_role=session_user AND binding_id=b.binding_id
   AND organisation_id=(r->>'organisationId')::uuid AND effect='DENY' AND status='ACTIVE' AND expires_at>clock_timestamp()
   AND(resource_id IS NULL OR resource_id=t->>'resourceId')) THEN RETURN NULL;END IF;
 deadline:=least(a.expires_at,(v->>'expiresAt')::timestamptz,b.expires_at,clock_timestamp()+interval '30 seconds');
 s:=jsonb_set(s,'{transactionId}',to_jsonb(txid_current()::text));s:=jsonb_set(s,'{policyVersion}',to_jsonb('access-v1:'||(d->>'revision')));
 s:=jsonb_set(s,'{access,expiresAt}',to_jsonb(deadline));s:=jsonb_set(s,'{delegation,expiresAt}',to_jsonb(deadline));
 s:=jsonb_set(s,'{delegation,status}',to_jsonb(j.status));
 s:=jsonb_set(s,'{delegation,target,policyVersion}',s->'policyVersion');
 s:=jsonb_set(s,'{delegation,target,access,expiresAt}',to_jsonb(deadline));
 s:=jsonb_set(s,'{delegation,target,module,expiresAt}',to_jsonb(deadline));
 RETURN jsonb_set(s,'{delegation,reportAdmission}',r);
END $fn$;
CREATE FUNCTION profitia_report_admission.bind_human(p_id uuid,p_secret text,p_operation text,p_resource text,p_payload text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE r jsonb;a profitia_report_admission.admissions%ROWTYPE;d jsonb;s jsonb;deadline timestamptz;BEGIN
 PERFORM 1 FROM profitia_access.installation WHERE singleton FOR SHARE;
 r:=profitia_report_admission.read(p_id,p_secret);
 SELECT * INTO a FROM profitia_report_admission.admissions WHERE id=p_id AND foreground_role=session_user AND started_at IS NOT NULL;
 IF NOT FOUND OR r IS NULL OR p_operation NOT IN('supplier.report.read','supplier.report.project')
  OR p_payload!~'^[a-f0-9]{64}$' OR NOT(p_resource='supplier-report:COMPANY:'||a.nip OR p_resource LIKE 'supplier-report:KRS:%') THEN RETURN NULL;END IF;
 d:=profitia_access.runtime_descriptor();s:=a.job_state->'delegation'->'target';
 deadline:=least(a.expires_at,clock_timestamp()+interval '30 seconds');
 s:=jsonb_build_object('applicationId',r->>'applicationId','environment',r->>'environment',
  'policyVersion','access-v1:'||(d->>'revision'),'transactionId',txid_current()::text,
  'identityBindingVersion',a.identity_binding->>'version','usagePolicy','NOT_APPLICABLE','products',s->'products',
  'access',jsonb_set(s->'access','{expiresAt}',to_jsonb(deadline)));
 PERFORM set_config('profitia.report.admission',jsonb_build_array(p_id,p_secret,txid_current()::text)::text,true);
 PERFORM set_config('profitia.user_id',r->>'userId',true);PERFORM set_config('profitia.organisation_id',r->>'organisationId',true);
 PERFORM set_config('profitia.application_id',r->>'applicationId',true);PERFORM set_config('profitia.environment',r->>'environment',true);
 PERFORM set_config('profitia.policy_version',s->>'policyVersion',true);PERFORM set_config('profitia.transaction_id',txid_current()::text,true);
 PERFORM set_config('profitia.identity_binding_version',a.identity_binding->>'version',true);
 PERFORM set_config('profitia.scope_expires_at',deadline::text,true);
 RETURN jsonb_build_object('admissionId',a.id,'state',s,'identityBinding',a.identity_binding);
END $fn$;
DO $copy$ BEGIN EXECUTE replace(pg_get_functiondef('profitia_access.scope_allows(text,uuid,uuid)'::regprocedure),'FUNCTION profitia_access.scope_allows(','FUNCTION profitia_access.scope_allows_before_report_admission(');END $copy$;
CREATE OR REPLACE FUNCTION profitia_access.scope_allows(p_application text,p_org uuid,p_user uuid DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE r jsonb;d jsonb;BEGIN
 r:=profitia_report_admission.current();
 IF r IS NULL THEN
  IF nullif(current_setting('profitia.report.admission',true),'') IS NOT NULL THEN RETURN false;END IF;
  RETURN profitia_access.scope_allows_before_report_admission(p_application,p_org,p_user);END IF;
 d:=profitia_access.runtime_descriptor();
 RETURN p_application=r->>'applicationId' AND p_application=d->>'applicationId'
  AND p_org=(r->>'organisationId')::uuid AND(p_user IS NULL OR p_user=(r->>'userId')::uuid)
  AND current_setting('profitia.user_id',true)=r->>'userId' AND current_setting('profitia.organisation_id',true)=r->>'organisationId'
  AND current_setting('profitia.application_id',true)=p_application AND current_setting('profitia.environment',true)=d->>'environment'
  AND current_setting('profitia.policy_version',true)='access-v1:'||(d->>'revision')
  AND current_setting('profitia.transaction_id',true)=txid_current()::text
  AND nullif(current_setting('profitia.scope_expires_at',true),'')::timestamptz>clock_timestamp()
  AND nullif(current_setting('profitia.scope_expires_at',true),'')::timestamptz<=least((r->>'expiresAt')::timestamptz,clock_timestamp()+interval '30 seconds');
EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN RETURN false;END $fn$;
REVOKE ALL ON ALL TABLES IN SCHEMA profitia_report_admission FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_report_admission FROM PUBLIC;
REVOKE ALL ON FUNCTION profitia_jobs.current_job(uuid),profitia_access.scope_allows(text,uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION profitia_jobs.current_job_before_report_admission(uuid),profitia_access.scope_allows_before_report_admission(text,uuid,uuid) FROM PUBLIC;
-- CREATE OR REPLACE retains the existing function OIDs and exact runtime ACLs;
-- RLS policies and cached statements keep their canonical entry point.

-- The controlled installer grants only the existing foreground/executor roles
-- the replacement public entry points; prior implementations keep their ACLs.
