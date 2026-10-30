-- Supersedes the rejected, unactivated in-place SQL030 candidate.
-- Operator-only: use inside the reviewed release transaction, under the temporary
-- controlled owner, restoring ALL original memberships before COMMIT.
-- Set profitia.srm.response_bound_mode to activate or rollback and set the exact
-- reviewed response_bound_source_ref. Never apply this with an application role.
-- Immutable policy versions retain predecessor counters/calls. Only the remaining
-- allowance enters the next version; total historical use + remaining stays1000.
DO $selection$
BEGIN
 IF current_setting('profitia.srm.response_bound_mode',true)='activate' THEN
DECLARE b profitia_external_call.policies%ROWTYPE;n profitia_external_native.policies%ROWTYPE;
 old_base jsonb;old_native jsonb;new_base jsonb;new_native jsonb;chosen_ref text;remaining integer;used_before bigint;used_after bigint;
BEGIN
 chosen_ref:=current_setting('profitia.srm.response_bound_source_ref',true);
 IF current_user<>'profitia_ingestion_owner' OR current_database()<>'platform_private'
  OR chosen_ref IS NULL OR chosen_ref!~'^[a-f0-9]{40}$'
  OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication))
  OR NOT EXISTS(SELECT 1 FROM profitia_external_call.installation WHERE singleton AND environment='development'
   AND project_id='spring-bread-28217539' AND branch_id='br-sparkling-term-b99l107x' AND database_name='platform_private') THEN
  RAISE EXCEPTION 'Exact controlled main SRM Development receiver required' USING ERRCODE='42501';END IF;
 SELECT * INTO b FROM profitia_external_call.policies WHERE policy_id='3892aef8-2616-42f6-9b43-50e3e4d7dbef'::uuid FOR UPDATE;
 SELECT * INTO n FROM profitia_external_native.policies WHERE policy_id=b.policy_id FOR UPDATE;
 old_base:=to_jsonb(b);old_native:=to_jsonb(n);
 IF (old_base-ARRAY['admitted_count']) IS DISTINCT FROM ('{"unit":"UPSTREAM_ATTEMPT_ADMISSION","origin":"https://api.mgbi.pl","status":"ACTIVE","version":1,"capacity":1000,"policy_id":"3892aef8-2616-42f6-9b43-50e3e4d7dbef","source_id":"srm.provider.mgbi","transport":"HTTPS","expires_at":"2026-11-19T00:00:00+00:00","login_role":"srm_provider_development_source","path_rules":[{"path":"/v1/models/pl-krs-wp-record/records","method":"GET"},{"path":"/v1/models/pl-krs-rdf-record/records","method":"GET"}],"quota_mode":"METERED","source_ref":"SRM-E1-CONTROLLED-DEVELOPMENT-RELEASE-20261020","timeout_ms":20000,"window_end":"2026-11-19T00:00:00+00:00","resource_id":"srm-provider:mgbi","window_start":"2026-10-20T00:00:00+00:00","admitted_count":68,"configuration_version":"srm-native-supplier-e1-v1","maximum_request_bytes":8192,"maximum_response_bytes":1048576}'::jsonb-ARRAY['admitted_count'])
  OR (old_native-ARRAY[]::text[]) IS DISTINCT FROM ('{"status":"ACTIVE","version":1,"policy_id":"3892aef8-2616-42f6-9b43-50e3e4d7dbef","expires_at":"2026-11-19T00:00:00+00:00","path_rules":[{"path":"/v1/models/pl-krs-wp-record/records","method":"GET","requestFormat":"NONE"},{"path":"/v1/models/pl-krs-rdf-record/records","method":"GET","requestFormat":"NONE"}],"source_ref":"SRM-E1-CONTROLLED-DEVELOPMENT-RELEASE-20261020","completion_mode":"ADMITTED_ATTEMPT_CURRENT_SETTLEMENT","credential_mode":"SERVER_HEADERS","redirect_origins":[],"base_policy_version":1,"maximum_response_bytes":1048576}'::jsonb-ARRAY[]::text[]) THEN
  RAISE EXCEPTION 'Exact reviewed MGBI predecessor required' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM profitia_external_call.policies WHERE policy_id='36883038-34b4-4929-9417-4ab66b54730a'::uuid)
  OR EXISTS(SELECT 1 FROM profitia_external_call.calls WHERE policy_id=b.policy_id AND status IN('PLANNED','ATTEMPT_RESERVED')) THEN
  RAISE EXCEPTION 'Fresh successor and settled predecessor calls required' USING ERRCODE='55000';END IF;
 SELECT sum(admitted_count) INTO used_before FROM profitia_external_call.policies WHERE policy_id=ANY(ARRAY['3892aef8-2616-42f6-9b43-50e3e4d7dbef']::uuid[]);
 remaining:=b.capacity-b.admitted_count;
 IF remaining<=0 OR used_before+remaining<>1000 THEN
  RAISE EXCEPTION 'Original cumulative allowance must remain exactly 1000' USING ERRCODE='42501';END IF;
 -- Revoke in native-before-base order, preserving immutable definitions and all calls.
 UPDATE profitia_external_native.policies SET status='REVOKED' WHERE policy_id=b.policy_id;
 UPDATE profitia_external_call.policies SET status='REVOKED' WHERE policy_id=b.policy_id;
 new_base:=old_base||jsonb_build_object('policy_id','36883038-34b4-4929-9417-4ab66b54730a','version',2,'maximum_response_bytes',2097152,'source_ref',chosen_ref,'admitted_count',0,'capacity',remaining);
 new_native:=old_native||jsonb_build_object('policy_id','36883038-34b4-4929-9417-4ab66b54730a','version',2,'base_policy_version',2,'maximum_response_bytes',2097152,'source_ref',chosen_ref);
 INSERT INTO profitia_external_call.policies SELECT (jsonb_populate_record(NULL::profitia_external_call.policies,new_base)).*;
 INSERT INTO profitia_external_native.policies SELECT (jsonb_populate_record(NULL::profitia_external_native.policies,new_native)).*;
 IF (SELECT to_jsonb(p)-ARRAY['status','version'] FROM profitia_external_call.policies p WHERE policy_id=b.policy_id)
      IS DISTINCT FROM (old_base-ARRAY['status','version'])
  OR (SELECT to_jsonb(p)-ARRAY['status','version'] FROM profitia_external_native.policies p WHERE policy_id=b.policy_id)
      IS DISTINCT FROM (old_native-ARRAY['status','version'])
  OR (SELECT count(*) FROM profitia_external_call.policies p WHERE p.login_role=b.login_role AND p.source_id=b.source_id AND p.resource_id=b.resource_id AND p.status='ACTIVE')<>1 THEN
  RAISE EXCEPTION 'Historical definition/counters and one-active-policy invariant required';END IF;
END;
 ELSIF current_setting('profitia.srm.response_bound_mode',true)='rollback' THEN
DECLARE b profitia_external_call.policies%ROWTYPE;n profitia_external_native.policies%ROWTYPE;
 old_base jsonb;old_native jsonb;new_base jsonb;new_native jsonb;chosen_ref text;remaining integer;used_before bigint;used_after bigint;
BEGIN
 chosen_ref:=current_setting('profitia.srm.response_bound_source_ref',true);
 IF current_user<>'profitia_ingestion_owner' OR current_database()<>'platform_private'
  OR chosen_ref IS NULL OR chosen_ref!~'^[a-f0-9]{40}$'
  OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication))
  OR NOT EXISTS(SELECT 1 FROM profitia_external_call.installation WHERE singleton AND environment='development'
   AND project_id='spring-bread-28217539' AND branch_id='br-sparkling-term-b99l107x' AND database_name='platform_private') THEN
  RAISE EXCEPTION 'Exact controlled main SRM Development receiver required' USING ERRCODE='42501';END IF;
 SELECT * INTO b FROM profitia_external_call.policies WHERE policy_id='36883038-34b4-4929-9417-4ab66b54730a'::uuid FOR UPDATE;
 SELECT * INTO n FROM profitia_external_native.policies WHERE policy_id=b.policy_id FOR UPDATE;
 old_base:=to_jsonb(b);old_native:=to_jsonb(n);
 IF (old_base-ARRAY['admitted_count','capacity','source_ref']) IS DISTINCT FROM ('{"unit":"UPSTREAM_ATTEMPT_ADMISSION","origin":"https://api.mgbi.pl","status":"ACTIVE","version":2,"capacity":1000,"policy_id":"36883038-34b4-4929-9417-4ab66b54730a","source_id":"srm.provider.mgbi","transport":"HTTPS","expires_at":"2026-11-19T00:00:00+00:00","login_role":"srm_provider_development_source","path_rules":[{"path":"/v1/models/pl-krs-wp-record/records","method":"GET"},{"path":"/v1/models/pl-krs-rdf-record/records","method":"GET"}],"quota_mode":"METERED","source_ref":"SRM-E1-CONTROLLED-DEVELOPMENT-RELEASE-20261020","timeout_ms":20000,"window_end":"2026-11-19T00:00:00+00:00","resource_id":"srm-provider:mgbi","window_start":"2026-10-20T00:00:00+00:00","admitted_count":68,"configuration_version":"srm-native-supplier-e1-v1","maximum_request_bytes":8192,"maximum_response_bytes":2097152}'::jsonb-ARRAY['admitted_count','capacity','source_ref'])
  OR (old_native-ARRAY['source_ref']) IS DISTINCT FROM ('{"status":"ACTIVE","version":2,"policy_id":"36883038-34b4-4929-9417-4ab66b54730a","expires_at":"2026-11-19T00:00:00+00:00","path_rules":[{"path":"/v1/models/pl-krs-wp-record/records","method":"GET","requestFormat":"NONE"},{"path":"/v1/models/pl-krs-rdf-record/records","method":"GET","requestFormat":"NONE"}],"source_ref":"SRM-E1-CONTROLLED-DEVELOPMENT-RELEASE-20261020","completion_mode":"ADMITTED_ATTEMPT_CURRENT_SETTLEMENT","credential_mode":"SERVER_HEADERS","redirect_origins":[],"base_policy_version":2,"maximum_response_bytes":2097152}'::jsonb-ARRAY['source_ref']) THEN
  RAISE EXCEPTION 'Exact reviewed MGBI predecessor required' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM profitia_external_call.policies WHERE policy_id='09062e56-639a-40eb-b437-d66d9515ef0f'::uuid)
  OR EXISTS(SELECT 1 FROM profitia_external_call.calls WHERE policy_id=b.policy_id AND status IN('PLANNED','ATTEMPT_RESERVED')) THEN
  RAISE EXCEPTION 'Fresh successor and settled predecessor calls required' USING ERRCODE='55000';END IF;
 SELECT sum(admitted_count) INTO used_before FROM profitia_external_call.policies WHERE policy_id=ANY(ARRAY['3892aef8-2616-42f6-9b43-50e3e4d7dbef','36883038-34b4-4929-9417-4ab66b54730a']::uuid[]);
 remaining:=b.capacity-b.admitted_count;
 IF remaining<=0 OR used_before+remaining<>1000 THEN
  RAISE EXCEPTION 'Original cumulative allowance must remain exactly 1000' USING ERRCODE='42501';END IF;
 -- Revoke in native-before-base order, preserving immutable definitions and all calls.
 UPDATE profitia_external_native.policies SET status='REVOKED' WHERE policy_id=b.policy_id;
 UPDATE profitia_external_call.policies SET status='REVOKED' WHERE policy_id=b.policy_id;
 new_base:=old_base||jsonb_build_object('policy_id','09062e56-639a-40eb-b437-d66d9515ef0f','version',3,'maximum_response_bytes',1048576,'source_ref',chosen_ref,'admitted_count',0,'capacity',remaining);
 new_native:=old_native||jsonb_build_object('policy_id','09062e56-639a-40eb-b437-d66d9515ef0f','version',3,'base_policy_version',3,'maximum_response_bytes',1048576,'source_ref',chosen_ref);
 INSERT INTO profitia_external_call.policies SELECT (jsonb_populate_record(NULL::profitia_external_call.policies,new_base)).*;
 INSERT INTO profitia_external_native.policies SELECT (jsonb_populate_record(NULL::profitia_external_native.policies,new_native)).*;
 IF (SELECT to_jsonb(p)-ARRAY['status','version'] FROM profitia_external_call.policies p WHERE policy_id=b.policy_id)
      IS DISTINCT FROM (old_base-ARRAY['status','version'])
  OR (SELECT to_jsonb(p)-ARRAY['status','version'] FROM profitia_external_native.policies p WHERE policy_id=b.policy_id)
      IS DISTINCT FROM (old_native-ARRAY['status','version'])
  OR (SELECT count(*) FROM profitia_external_call.policies p WHERE p.login_role=b.login_role AND p.source_id=b.source_id AND p.resource_id=b.resource_id AND p.status='ACTIVE')<>1 THEN
  RAISE EXCEPTION 'Historical definition/counters and one-active-policy invariant required';END IF;
END;
 ELSE RAISE EXCEPTION 'Exact reviewed Source activation mode required' USING ERRCODE='42501';
 END IF;
END $selection$;
