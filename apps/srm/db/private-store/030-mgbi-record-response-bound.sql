-- REVIEW CANDIDATE: apply only after separate owner approval, in one controlled transaction.
-- Two existing main Development policy rows; no DDL, role/ACL changes, counters,
-- call history, file entitlements, provider capacity or other source is changed.
SET LOCAL TimeZone='UTC';
DO $bound$
DECLARE b profitia_external_call.policies%ROWTYPE;n profitia_external_native.policies%ROWTYPE;
 old_base jsonb;old_native jsonb;new_base jsonb;new_native jsonb;chosen_ref text;
BEGIN
 chosen_ref:=current_setting('profitia.srm.response_bound_source_ref',true);
 IF current_user<>'profitia_ingestion_owner' OR current_database()<>'platform_private'
  OR chosen_ref IS NULL OR chosen_ref!~'^[a-f0-9]{40}$'
  OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication))
  OR NOT EXISTS(SELECT 1 FROM profitia_external_call.installation WHERE singleton AND environment='development'
   AND project_id='spring-bread-28217539' AND branch_id='br-sparkling-term-b99l107x' AND database_name='platform_private') THEN
  RAISE EXCEPTION 'Exact controlled main SRM Development receiver required' USING ERRCODE='42501';
 END IF;
 SELECT * INTO b FROM profitia_external_call.policies WHERE policy_id='3892aef8-2616-42f6-9b43-50e3e4d7dbef'::uuid FOR UPDATE;
 SELECT * INTO n FROM profitia_external_native.policies WHERE policy_id=b.policy_id FOR UPDATE;
 old_base:=to_jsonb(b);old_native:=to_jsonb(n);
 IF (old_base-'admitted_count') IS DISTINCT FROM '{"unit":"UPSTREAM_ATTEMPT_ADMISSION","origin":"https://api.mgbi.pl","status":"ACTIVE","version":1,"capacity":1000,"policy_id":"3892aef8-2616-42f6-9b43-50e3e4d7dbef","source_id":"srm.provider.mgbi","transport":"HTTPS","expires_at":"2026-11-19T00:00:00+00:00","login_role":"srm_provider_development_source","path_rules":[{"path":"/v1/models/pl-krs-wp-record/records","method":"GET"},{"path":"/v1/models/pl-krs-rdf-record/records","method":"GET"}],"quota_mode":"METERED","source_ref":"SRM-E1-CONTROLLED-DEVELOPMENT-RELEASE-20261020","timeout_ms":20000,"window_end":"2026-11-19T00:00:00+00:00","resource_id":"srm-provider:mgbi","window_start":"2026-10-20T00:00:00+00:00","configuration_version":"srm-native-supplier-e1-v1","maximum_request_bytes":8192,"maximum_response_bytes":1048576}'::jsonb
  OR old_native IS DISTINCT FROM '{"status":"ACTIVE","version":1,"policy_id":"3892aef8-2616-42f6-9b43-50e3e4d7dbef","expires_at":"2026-11-19T00:00:00+00:00","path_rules":[{"path":"/v1/models/pl-krs-wp-record/records","method":"GET","requestFormat":"NONE"},{"path":"/v1/models/pl-krs-rdf-record/records","method":"GET","requestFormat":"NONE"}],"source_ref":"SRM-E1-CONTROLLED-DEVELOPMENT-RELEASE-20261020","completion_mode":"ADMITTED_ATTEMPT_CURRENT_SETTLEMENT","credential_mode":"SERVER_HEADERS","redirect_origins":[],"base_policy_version":1,"maximum_response_bytes":1048576}'::jsonb THEN
  RAISE EXCEPTION 'Exact reviewed MGBI byte policies required' USING ERRCODE='42501';
 END IF;
 IF EXISTS(SELECT 1 FROM profitia_external_call.calls WHERE policy_id=b.policy_id AND status IN('PLANNED','ATTEMPT_RESERVED')) THEN
  RAISE EXCEPTION 'MGBI calls must finish before byte-policy activation' USING ERRCODE='55000';
 END IF;
 UPDATE profitia_external_call.policies SET maximum_response_bytes=2097152,version=version+1,source_ref=chosen_ref
  WHERE policy_id=b.policy_id;
 UPDATE profitia_external_native.policies SET maximum_response_bytes=2097152,base_policy_version=b.version+1,version=version+1,source_ref=chosen_ref
  WHERE policy_id=b.policy_id;
 SELECT to_jsonb(p) INTO new_base FROM profitia_external_call.policies p WHERE p.policy_id=b.policy_id;
 SELECT to_jsonb(p) INTO new_native FROM profitia_external_native.policies p WHERE p.policy_id=b.policy_id;
 IF (old_base-ARRAY['maximum_response_bytes','version','source_ref']) IS DISTINCT FROM (new_base-ARRAY['maximum_response_bytes','version','source_ref'])
  OR (old_native-ARRAY['maximum_response_bytes','base_policy_version','version','source_ref']) IS DISTINCT FROM (new_native-ARRAY['maximum_response_bytes','base_policy_version','version','source_ref']) THEN
  RAISE EXCEPTION 'MGBI cost, scope and history controls must remain unchanged';
 END IF;
END $bound$;
