-- D1 PREPARATION ONLY. Exact artifact requires separate producer/operator approval.
-- Execute atomically as the existing controlled NOLOGIN owner. No base RLS,
-- audit event, runtime binding, budget or shared revision is changed.
BEGIN;
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles
  WHERE rolname=current_user AND NOT(rolcanlogin OR rolsuper OR rolbypassrls OR rolinherit OR rolcreatedb OR rolcreaterole OR rolreplication))
  OR NOT EXISTS(SELECT 1 FROM profitia_access.installation WHERE singleton AND environment='development' AND project_id='spring-bread-28217539' AND branch_id='br-sparkling-term-b99l107x' AND database_name='platform_private' AND current_database()=database_name) THEN
  RAISE EXCEPTION 'D1_INSTALLATION_DENIED' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname='sg2_d1_private_denial_reader' AND rolcanlogin
  AND NOT(rolsuper OR rolbypassrls OR rolinherit OR rolcreatedb OR rolcreaterole OR rolreplication)
  AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.member=r.oid OR m.roleid=r.oid)) THEN
  RAISE EXCEPTION 'D1_ROLE_DENIED' USING ERRCODE='42501';
 END IF;
END $guard$;
CREATE SCHEMA profitia_sg2_d1_private AUTHORIZATION profitia_access_owner;
REVOKE ALL ON SCHEMA profitia_sg2_d1_private FROM PUBLIC;
CREATE TABLE profitia_sg2_d1_private.authorization(
 singleton boolean PRIMARY KEY CHECK(singleton),
 expires_at timestamptz NOT NULL CHECK(isfinite(expires_at))
);
ALTER TABLE profitia_sg2_d1_private.authorization ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_sg2_d1_private.authorization FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON profitia_sg2_d1_private.authorization TO profitia_access_owner USING(true) WITH CHECK(true);
INSERT INTO profitia_sg2_d1_private.authorization VALUES(true,clock_timestamp()+interval '30 minutes');
CREATE FUNCTION profitia_sg2_d1_private.read_case(p_case text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER VOLATILE PARALLEL UNSAFE
SET search_path=pg_catalog,pg_temp SET row_security=on SET timezone='UTC'
SET statement_timeout='5s' SET lock_timeout='1s' AS $reader$
DECLARE start_at timestamptz;end_at timestamptz;deployment text;result_rows jsonb;invocation uuid:=pg_catalog.gen_random_uuid();
BEGIN
 -- Native LOG survives a caller transaction rollback. Never log input, event or PII.
 RAISE LOG 'SG2_D1_READ invocation=% store=private phase=INTENT',invocation;
 IF session_user<>'sg2_d1_private_denial_reader' OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles r
  WHERE r.rolname=session_user AND rolcanlogin AND NOT(rolsuper OR rolbypassrls OR rolinherit OR rolcreatedb OR rolcreaterole OR rolreplication)
  AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.member=r.oid OR m.roleid=r.oid))
  OR NOT EXISTS(SELECT 1 FROM profitia_access.installation WHERE singleton AND environment='development' AND project_id='spring-bread-28217539' AND branch_id='br-sparkling-term-b99l107x' AND database_name='platform_private' AND current_database()=database_name) OR NOT EXISTS(SELECT 1 FROM profitia_sg2_d1_private.authorization WHERE singleton AND expires_at>clock_timestamp()) THEN
  RAISE EXCEPTION 'D1_READER_DENIED' USING ERRCODE='42501';
 END IF;
 CASE p_case
   WHEN 'H1' THEN start_at:='2026-11-02T16:59:07Z';end_at:='2026-11-02T16:59:19Z';deployment:='srv-dapa3tid0e5s73f8bc5g:35c9284856bb9be5771f6381046ffbffaf39a9f6';
   WHEN 'H2' THEN start_at:='2026-11-02T17:10:02Z';end_at:='2026-11-02T17:10:14Z';deployment:='srv-dapa3tid0e5s73f8bc5g:35c9284856bb9be5771f6381046ffbffaf39a9f6';
   WHEN 'H3' THEN start_at:='2026-11-02T17:10:51Z';end_at:='2026-11-02T17:11:03Z';deployment:='srv-dapa3tid0e5s73f8bc5g:35c9284856bb9be5771f6381046ffbffaf39a9f6';
   WHEN 'H4' THEN start_at:='2026-11-02T17:13:46Z';end_at:='2026-11-02T17:13:58Z';deployment:='srv-dapa3tid0e5s73f8bc5g:35c9284856bb9be5771f6381046ffbffaf39a9f6';
   WHEN 'C1' THEN start_at:='2026-11-03T04:22:44Z';end_at:='2026-11-03T04:22:56Z';deployment:='srv-dapa3tid0e5s73f8bc5g:b4023cb02e10fc7045f8b2bc173224ae3da3cb5a';
   ELSE RAISE EXCEPTION 'D1_CASE_DENIED' USING ERRCODE='42501';
 END CASE;
 SELECT coalesce(jsonb_agg(r ORDER BY r->>'recorded_at',r->>'application_id',r->>'operation',r->>'phase'),'[]'::jsonb) INTO result_rows FROM(
  SELECT jsonb_build_object('caseId',p_case,'store','private',
   'recorded_at',to_char(e.recorded_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
   'application_id',e.application_id,'deploymentId',deployment,'operation',e.event->>'operation',
   'phase',e.phase,'decision','DENY','reasonCode',CASE WHEN e.event->>'reasonCode' IN('UNSUPPORTED_CONTRACT','UNVERIFIED_IDENTITY','CONTEXT_INVALID','ENVIRONMENT_MISMATCH','APPLICATION_FEATURE_UNAVAILABLE','ACCESS_BASIS_INVALID','PERMISSION_DENIED','PRODUCT_UNAVAILABLE','RESOURCE_SCOPE_MISMATCH','DATA_CLASSIFICATION_UNKNOWN','DELEGATION_INVALID','DELIVERY_UNCERTAIN','RESOURCE_VERSION_CONFLICT','LIMIT_POLICY_UNAVAILABLE','LIMIT_EXCEEDED','IDEMPOTENCY_CONFLICT','AUDIT_UNAVAILABLE','POLICY_UNAVAILABLE','EXPLICIT_DENY') THEN e.event->>'reasonCode' ELSE NULL END,
   'event_count',1,'firstCheckpoint','NOT_RECORDED','correlationEvidence','WINDOW_ONLY') AS r
  FROM profitia_access.security_events e WHERE e.environment='development' AND e.event->>'environment'='development'
   AND e.event->>'applicationId'=e.application_id AND e.event->>'deploymentId'=deployment
   AND e.recorded_at>=start_at AND e.recorded_at<end_at AND e.phase IN('DECISION','FAILURE')
   AND e.event->>'decision'='DENY' AND ((e.application_id='spendguru' AND e.event->>'operation' IN('benchmark.discovery.request','benchmark.discovery.read')) OR (e.application_id='spendguru-benchmark-dispatch' AND e.event->>'operation'='job.execute'))
  ORDER BY e.recorded_at,e.event_id LIMIT 101
 ) bounded;
 IF jsonb_array_length(result_rows)>100 THEN RAISE EXCEPTION 'D1_OVERFLOW' USING ERRCODE='54000';END IF;
 RAISE LOG 'SG2_D1_READ invocation=% store=private phase=OUTCOME case=% rows=%',invocation,p_case,jsonb_array_length(result_rows);
 RETURN jsonb_build_object('caseId',p_case,'store','private','rows',result_rows,'invocationRef',invocation::text);
EXCEPTION WHEN OTHERS THEN
 RAISE LOG 'SG2_D1_READ invocation=% store=private phase=REJECTED',invocation;
 RAISE EXCEPTION 'D1_READ_UNAVAILABLE' USING ERRCODE='42501';
END $reader$;
REVOKE ALL ON FUNCTION profitia_sg2_d1_private.read_case(text) FROM PUBLIC;
REVOKE ALL ON TABLE profitia_sg2_d1_private.authorization FROM PUBLIC,sg2_d1_private_denial_reader;
GRANT USAGE ON SCHEMA profitia_sg2_d1_private TO sg2_d1_private_denial_reader;
GRANT EXECUTE ON FUNCTION profitia_sg2_d1_private.read_case(text) TO sg2_d1_private_denial_reader;
COMMIT;
