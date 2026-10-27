-- SRM Development only. Exact compare-and-swap of technical deployment bindings.
-- Authority: SRM-DEVELOPMENT-RECOVERY-CONTINUATION-20261027; accepted live Render
-- deploy dep-dbg4h7t9fdbs73cokv4g. No grants, quotas, counters or business rows change.
-- Rollback uses the same guarded procedure with the three resulting versions and
-- the previous deployment/source_ref; binding versions must continue increasing.
DO $recovery$
DECLARE
 before_jobs jsonb; before_sources jsonb; after_jobs jsonb; after_sources jsonb;
 memberships jsonb; protected text; changed integer;
 old_sha constant text := 'fc1e8916f5f7b18a35e96e83165c7b65805a0553';
 new_sha constant text := 'ce4f293ec0f83bf3b4af1174f43c54eda6860738';
 service constant text := 'srv-db1vu6gm7kps73d0e3r0';
 ref constant text := 'SRM-DEVELOPMENT-RECOVERY-CONTINUATION-20261027:ce4f293ec0f83bf3b4af1174f43c54eda6860738';
BEGIN
 PERFORM set_config('statement_timeout','15s',true);
 PERFORM set_config('lock_timeout','3s',true);
 PERFORM pg_advisory_xact_lock(hashtext('srm-development-runtime-binding-recovery'));
 IF current_user <> session_user OR current_user <> 'neondb_owner'
  OR current_database() <> 'platform_private'
  OR NOT EXISTS(SELECT 1 FROM profitia_access.installation WHERE singleton
    AND environment='development' AND project_id='spring-bread-28217539'
    AND branch_id='br-sparkling-term-b99l107x' AND database_name=current_database())
  OR NOT EXISTS(SELECT 1 FROM profitia_ingestion.installation WHERE singleton
    AND environment='development' AND project_id='spring-bread-28217539'
    AND branch_id='br-sparkling-term-b99l107x' AND database_name=current_database())
  OR NOT pg_has_role(session_user,'profitia_access_owner','SET')
  OR pg_has_role(session_user,'profitia_ingestion_owner','SET')
  OR NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid='profitia_ingestion_owner'::regrole
    AND member=session_user::regrole AND grantor='cloud_admin'::regrole AND admin_option
    AND NOT inherit_option AND NOT set_option)
  OR EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid='profitia_ingestion_owner'::regrole
    AND member=session_user::regrole AND grantor=session_user::regrole)
 THEN RAISE EXCEPTION 'Exact Development operator and existing owner membership required'; END IF;
 SELECT jsonb_agg(to_jsonb(m) ORDER BY roleid,member,grantor) INTO memberships
  FROM pg_auth_members m WHERE roleid IN('profitia_access_owner'::regrole,'profitia_ingestion_owner'::regrole)
   AND member=session_user::regrole;
 SELECT to_jsonb(b) INTO before_jobs FROM profitia_services.runtime_bindings b
  WHERE login_role='srm_private_development_jobs' FOR UPDATE;
 SELECT jsonb_agg(to_jsonb(b) ORDER BY login_role) INTO before_sources
  FROM (SELECT * FROM profitia_ingestion.runtime_bindings WHERE login_role IN
   ('srm_provider_development_source','srm_corporate_development_source') ORDER BY login_role FOR UPDATE)b;
 IF before_jobs IS NULL OR before_sources IS NULL OR before_jobs->>'binding_id' <> 'a8ce358b-6bdf-4087-956e-e6bbbfbde7f0'
  OR before_jobs->>'version' <> '14' OR before_jobs->>'status' <> 'ACTIVE'
  OR before_jobs->>'deployment_id' <> service||':'||old_sha||':srm-jobs'
  OR before_jobs->>'source_ref' <> old_sha OR jsonb_array_length(before_sources) <> 2
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(before_sources)b WHERE b->>'version'<>'16'
    OR b->>'status'<>'ACTIVE' OR b->>'source_ref'<>old_sha
    OR b->>'configuration_version'<>'srm-native-supplier-e1-v1'
    OR b->>'deployment_id'<>service||':'||old_sha||':'||(b->>'application_id')
    OR (b->>'expires_at')::timestamptz<=clock_timestamp())
 THEN RAISE EXCEPTION 'Binding changed since verified snapshot'; END IF;
 SELECT md5(jsonb_build_object(
  'requestPolicies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY policy_id) FROM profitia_requests.policies p WHERE application_id='srm'),
  'sourceBudgets',(SELECT jsonb_agg(to_jsonb(b) ORDER BY policy_id) FROM profitia_ingestion.budgets b WHERE login_role IN('srm_provider_development_source','srm_corporate_development_source')),
  'sourceGrants',(SELECT jsonb_agg(to_jsonb(g) ORDER BY grant_id) FROM profitia_ingestion.grants g WHERE login_role IN('srm_provider_development_source','srm_corporate_development_source'))
 )::text) INTO protected;
 SET LOCAL ROLE profitia_access_owner;
 UPDATE profitia_services.runtime_bindings SET deployment_id=service||':'||new_sha||':srm-jobs',source_ref=ref
  WHERE login_role='srm_private_development_jobs' AND version=14;
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>1 THEN RAISE EXCEPTION 'One executor binding required'; END IF;
 RESET ROLE;
 -- Temporary owner SET authority follows the existing SRM installation pattern.
 -- Remove only this transaction's self-grant; preserve the cloud_admin grant.
 GRANT profitia_ingestion_owner TO neondb_owner WITH INHERIT FALSE, SET TRUE;
 SET LOCAL ROLE profitia_ingestion_owner;
 UPDATE profitia_ingestion.runtime_bindings SET
  deployment_id=service||':'||new_sha||':'||application_id,source_ref=ref
  WHERE login_role IN('srm_provider_development_source','srm_corporate_development_source') AND version=16;
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>2 THEN RAISE EXCEPTION 'Two Source bindings required'; END IF;
 RESET ROLE;
 REVOKE profitia_ingestion_owner FROM neondb_owner GRANTED BY neondb_owner;
 SELECT to_jsonb(b) INTO after_jobs FROM profitia_services.runtime_bindings b WHERE login_role='srm_private_development_jobs';
 SELECT jsonb_agg(to_jsonb(b) ORDER BY login_role) INTO after_sources FROM profitia_ingestion.runtime_bindings b
  WHERE login_role IN('srm_provider_development_source','srm_corporate_development_source');
 IF (after_jobs-ARRAY['deployment_id','source_ref','version']) IS DISTINCT FROM (before_jobs-ARRAY['deployment_id','source_ref','version'])
  OR after_jobs->>'version'<>'15'
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(after_sources)a JOIN jsonb_array_elements(before_sources)b
    ON a->>'login_role'=b->>'login_role'
    WHERE (a-ARRAY['deployment_id','source_ref','version']) IS DISTINCT FROM (b-ARRAY['deployment_id','source_ref','version'])
     OR a->>'version'<>'17')
  OR memberships IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(m) ORDER BY roleid,member,grantor) FROM pg_auth_members m
    WHERE roleid IN('profitia_access_owner'::regrole,'profitia_ingestion_owner'::regrole) AND member=session_user::regrole)
  OR protected IS DISTINCT FROM (SELECT md5(jsonb_build_object(
   'requestPolicies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY policy_id) FROM profitia_requests.policies p WHERE application_id='srm'),
   'sourceBudgets',(SELECT jsonb_agg(to_jsonb(b) ORDER BY policy_id) FROM profitia_ingestion.budgets b WHERE login_role IN('srm_provider_development_source','srm_corporate_development_source')),
   'sourceGrants',(SELECT jsonb_agg(to_jsonb(g) ORDER BY grant_id) FROM profitia_ingestion.grants g WHERE login_role IN('srm_provider_development_source','srm_corporate_development_source'))
  )::text))
 THEN RAISE EXCEPTION 'Protected authority, history or membership changed'; END IF;
END $recovery$;
