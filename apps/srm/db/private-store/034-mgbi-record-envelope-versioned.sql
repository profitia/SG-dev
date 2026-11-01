-- Operator-only candidate. Apply only after separate owner approval and exact CI.
-- One controlled transaction; temporary administration must be removed before COMMIT.
-- Accepted producer policy_change triggers stay installed and unchanged.
-- Append immutable versions with only remaining allowance; retain every counter/call.
DO $envelope$
DECLARE b profitia_external_call.policies%ROWTYPE;n profitia_external_native.policies%ROWTYPE;
 old_base jsonb;old_native jsonb;new_base jsonb;new_native jsonb;expected_base jsonb;expected_native jsonb;
 selected_mode text;chosen_ref text;previous_id uuid;next_id uuid;next_version integer;next_maximum integer;
 remaining integer;used_before bigint;used_after bigint;calls_before text;calls_after text;expected_ids uuid[];actual_ids uuid[];
BEGIN
 selected_mode:=current_setting('profitia.srm.response_bound_mode',true);
 chosen_ref:=current_setting('profitia.srm.response_bound_source_ref',true);
 IF current_user<>'profitia_ingestion_owner' OR current_database()<>'platform_private'
  OR chosen_ref IS NULL OR chosen_ref!~'^[a-f0-9]{40}$'
  OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication))
  OR NOT EXISTS(SELECT 1 FROM profitia_external_call.installation WHERE singleton AND environment='development'
   AND project_id='spring-bread-28217539' AND branch_id='br-sparkling-term-b99l107x' AND database_name='platform_private') THEN
  RAISE EXCEPTION 'Exact controlled main SRM Development receiver required' USING ERRCODE='42501';END IF;
 IF selected_mode='activate' THEN
  previous_id:='36883038-34b4-4929-9417-4ab66b54730a';next_id:='83b5b805-386c-479d-8c14-3b9580e0d78d';next_version:=3;next_maximum:=4194304;
  expected_base:='{"unit":"UPSTREAM_ATTEMPT_ADMISSION","origin":"https://api.mgbi.pl","status":"ACTIVE","version":2,"capacity":930,"policy_id":"36883038-34b4-4929-9417-4ab66b54730a","source_id":"srm.provider.mgbi","transport":"HTTPS","expires_at":"2026-11-19T00:00:00+00:00","login_role":"srm_provider_development_source","path_rules":[{"path":"/v1/models/pl-krs-wp-record/records","method":"GET"},{"path":"/v1/models/pl-krs-rdf-record/records","method":"GET"}],"quota_mode":"METERED","source_ref":"fbb78c9560d84031239780ee52bf47df4b923394","timeout_ms":20000,"window_end":"2026-11-19T00:00:00+00:00","resource_id":"srm-provider:mgbi","window_start":"2026-10-20T00:00:00+00:00","admitted_count":42,"configuration_version":"srm-native-supplier-e1-v1","maximum_request_bytes":8192,"maximum_response_bytes":2097152}'::jsonb;expected_native:='{"status":"ACTIVE","version":2,"policy_id":"36883038-34b4-4929-9417-4ab66b54730a","expires_at":"2026-11-19T00:00:00+00:00","path_rules":[{"path":"/v1/models/pl-krs-wp-record/records","method":"GET","requestFormat":"NONE"},{"path":"/v1/models/pl-krs-rdf-record/records","method":"GET","requestFormat":"NONE"}],"source_ref":"fbb78c9560d84031239780ee52bf47df4b923394","completion_mode":"ADMITTED_ATTEMPT_CURRENT_SETTLEMENT","credential_mode":"SERVER_HEADERS","redirect_origins":[],"base_policy_version":2,"maximum_response_bytes":2097152}'::jsonb;
  expected_ids:=ARRAY['36883038-34b4-4929-9417-4ab66b54730a','3892aef8-2616-42f6-9b43-50e3e4d7dbef']::uuid[];
 ELSIF selected_mode='rollback' THEN
  previous_id:='83b5b805-386c-479d-8c14-3b9580e0d78d';next_id:='b92b56bc-08be-4245-8576-bb587b72e0df';next_version:=4;next_maximum:=2097152;
  expected_base:='{"unit":"UPSTREAM_ATTEMPT_ADMISSION","origin":"https://api.mgbi.pl","status":"ACTIVE","version":3,"capacity":930,"policy_id":"83b5b805-386c-479d-8c14-3b9580e0d78d","source_id":"srm.provider.mgbi","transport":"HTTPS","expires_at":"2026-11-19T00:00:00+00:00","login_role":"srm_provider_development_source","path_rules":[{"path":"/v1/models/pl-krs-wp-record/records","method":"GET"},{"path":"/v1/models/pl-krs-rdf-record/records","method":"GET"}],"quota_mode":"METERED","source_ref":"fbb78c9560d84031239780ee52bf47df4b923394","timeout_ms":20000,"window_end":"2026-11-19T00:00:00+00:00","resource_id":"srm-provider:mgbi","window_start":"2026-10-20T00:00:00+00:00","admitted_count":42,"configuration_version":"srm-native-supplier-e1-v1","maximum_request_bytes":8192,"maximum_response_bytes":4194304}'::jsonb;expected_native:='{"status":"ACTIVE","version":3,"policy_id":"83b5b805-386c-479d-8c14-3b9580e0d78d","expires_at":"2026-11-19T00:00:00+00:00","path_rules":[{"path":"/v1/models/pl-krs-wp-record/records","method":"GET","requestFormat":"NONE"},{"path":"/v1/models/pl-krs-rdf-record/records","method":"GET","requestFormat":"NONE"}],"source_ref":"fbb78c9560d84031239780ee52bf47df4b923394","completion_mode":"ADMITTED_ATTEMPT_CURRENT_SETTLEMENT","credential_mode":"SERVER_HEADERS","redirect_origins":[],"base_policy_version":3,"maximum_response_bytes":4194304}'::jsonb;
  expected_ids:=ARRAY['36883038-34b4-4929-9417-4ab66b54730a','3892aef8-2616-42f6-9b43-50e3e4d7dbef','83b5b805-386c-479d-8c14-3b9580e0d78d']::uuid[];
 ELSE RAISE EXCEPTION 'Exact reviewed Source activation mode required' USING ERRCODE='42501';END IF;
 SELECT * INTO b FROM profitia_external_call.policies WHERE policy_id=previous_id FOR UPDATE;
 SELECT * INTO n FROM profitia_external_native.policies WHERE policy_id=previous_id FOR UPDATE;
 old_base:=to_jsonb(b);old_native:=to_jsonb(n);
 IF selected_mode='activate' THEN
  IF old_base-'admitted_count' IS DISTINCT FROM expected_base-'admitted_count' OR old_native IS DISTINCT FROM expected_native THEN
   RAISE EXCEPTION 'Exact reviewed predecessor required' USING ERRCODE='42501';END IF;
 ELSE
  IF old_base-ARRAY['admitted_count','capacity','source_ref'] IS DISTINCT FROM expected_base-ARRAY['admitted_count','capacity','source_ref']
   OR old_native-'source_ref' IS DISTINCT FROM expected_native-'source_ref' OR b.source_ref!~'^[a-f0-9]{40}$' THEN
   RAISE EXCEPTION 'Exact active successor required for recovery' USING ERRCODE='42501';END IF;
 END IF;
 SELECT array_agg(policy_id ORDER BY policy_id),sum(admitted_count) INTO actual_ids,used_before
  FROM profitia_external_call.policies WHERE login_role=b.login_role AND source_id=b.source_id AND resource_id=b.resource_id;
 IF actual_ids IS DISTINCT FROM expected_ids OR EXISTS(SELECT 1 FROM profitia_external_call.policies WHERE policy_id=next_id)
  OR EXISTS(SELECT 1 FROM profitia_external_native.policies WHERE policy_id=next_id)
  OR EXISTS(SELECT 1 FROM profitia_external_call.calls WHERE policy_id=previous_id AND status IN('PLANNED','ATTEMPT_RESERVED')) THEN
  RAISE EXCEPTION 'Exact policy family, fresh successor and settled predecessor required' USING ERRCODE='55000';END IF;
 remaining:=b.capacity-b.admitted_count;
 IF remaining<=0 OR used_before+remaining<>1000 THEN
  RAISE EXCEPTION 'Original cumulative allowance must remain exactly 1000' USING ERRCODE='42501';END IF;
 SELECT md5(string_agg(to_jsonb(c)::text,',' ORDER BY call_id)) INTO calls_before FROM profitia_external_call.calls c WHERE policy_id=ANY(actual_ids);
 UPDATE profitia_external_native.policies SET status='REVOKED' WHERE policy_id=previous_id;
 UPDATE profitia_external_call.policies SET status='REVOKED' WHERE policy_id=previous_id;
 new_base:=old_base||jsonb_build_object('policy_id',next_id,'version',next_version,'maximum_response_bytes',next_maximum,'source_ref',chosen_ref,'admitted_count',0,'capacity',remaining);
 new_native:=old_native||jsonb_build_object('policy_id',next_id,'version',next_version,'base_policy_version',next_version,'maximum_response_bytes',next_maximum,'source_ref',chosen_ref);
 INSERT INTO profitia_external_call.policies SELECT (jsonb_populate_record(NULL::profitia_external_call.policies,new_base)).*;
 INSERT INTO profitia_external_native.policies SELECT (jsonb_populate_record(NULL::profitia_external_native.policies,new_native)).*;
 SELECT sum(admitted_count) INTO used_after FROM profitia_external_call.policies WHERE login_role=b.login_role AND source_id=b.source_id AND resource_id=b.resource_id;
 SELECT md5(string_agg(to_jsonb(c)::text,',' ORDER BY call_id)) INTO calls_after FROM profitia_external_call.calls c WHERE policy_id=ANY(actual_ids);
 IF used_after IS DISTINCT FROM used_before OR used_after+remaining<>1000 OR calls_after IS DISTINCT FROM calls_before
  OR (SELECT to_jsonb(p)-ARRAY['status','version'] FROM profitia_external_call.policies p WHERE policy_id=previous_id) IS DISTINCT FROM (old_base-ARRAY['status','version'])
  OR (SELECT to_jsonb(p)-ARRAY['status','version'] FROM profitia_external_native.policies p WHERE policy_id=previous_id) IS DISTINCT FROM (old_native-ARRAY['status','version'])
  OR (SELECT count(*) FROM profitia_external_call.policies WHERE login_role=b.login_role AND source_id=b.source_id AND resource_id=b.resource_id AND status='ACTIVE')<>1 THEN
  RAISE EXCEPTION 'Historical counters/calls and one-active-policy invariant required';END IF;
END $envelope$;
