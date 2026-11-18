-- Owner-reviewed preparation only; not installed or activated by source import.
-- Execute inside the fresh atomic owner envelope. The new ordinary role is
-- created NOLOGIN before SET ROLE. No password or external connection is here.
REVOKE ALL ON SCHEMA profitia_quality_release FROM PUBLIC;
CREATE TABLE profitia_quality_release.quality_deployment_cas_policy(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 enabled boolean NOT NULL DEFAULT false,recovery_enabled boolean NOT NULL DEFAULT true,
 authorised_until timestamptz NOT NULL CHECK(authorised_until<='2026-11-27T23:59:59Z'::timestamptz));
INSERT INTO profitia_quality_release.quality_deployment_cas_policy VALUES(true,false,true,'2026-11-27T23:59:59Z');
CREATE TABLE profitia_quality_release.quality_deployment_cas_operations(
 operation_id uuid PRIMARY KEY,from_sha text NOT NULL,to_sha text NOT NULL,
 restore_of uuid REFERENCES profitia_quality_release.quality_deployment_cas_operations(operation_id),
 metadata jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
REVOKE ALL ON profitia_quality_release.quality_deployment_cas_policy,profitia_quality_release.quality_deployment_cas_operations FROM PUBLIC;
CREATE FUNCTION profitia_quality_release.quality_deployment_cas(p_operation uuid,p_from_sha text,p_to_sha text,p_restore_of uuid,p_valid_until timestamptz)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $aqc_cas$
DECLARE policy record;prior record;original record;before_rows jsonb;after_rows jsonb;affected integer;runtime record;
BEGIN
 IF session_user<>'aqc_development_product_publisher' OR current_user<>'profitia_ingestion_owner' OR current_database()<>'neondb'
  OR clock_timestamp()>='2026-11-27T23:59:59Z'::timestamptz
  OR NOT EXISTS(SELECT 1 FROM profitia_ingestion.installation WHERE singleton AND environment='development'
   AND project_id='autumn-waterfall-65938876' AND branch_id='br-dry-hall-b294222f')
 THEN RAISE EXCEPTION 'AQC_CAS_BINDING_REJECTED';END IF;
 SELECT * INTO runtime FROM pg_catalog.pg_roles WHERE rolname=session_user;
 IF NOT runtime.rolcanlogin OR runtime.rolsuper OR runtime.rolinherit OR runtime.rolcreaterole OR runtime.rolcreatedb
  OR runtime.rolbypassrls OR runtime.rolreplication OR runtime.rolconnlimit<>2
  OR runtime.rolvaliduntil IS NULL OR runtime.rolvaliduntil>'2026-11-27T23:59:59Z'::timestamptz
  OR runtime.rolvaliduntil<=clock_timestamp() OR EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=runtime.oid)
 THEN RAISE EXCEPTION 'AQC_CAS_ROLE_REJECTED';END IF;
 IF p_operation IS NULL OR coalesce(p_from_sha,'')!~'^[a-f0-9]{40}$' OR coalesce(p_to_sha,'')!~'^[a-f0-9]{40}$'
  OR p_from_sha=p_to_sha OR p_valid_until IS NULL OR p_valid_until<=clock_timestamp()
  OR p_valid_until>clock_timestamp()+interval '15 minutes'
 THEN RAISE EXCEPTION 'AQC_CAS_REQUEST_REJECTED';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('aqc-development-publisher-product',0));
 SELECT * INTO policy FROM profitia_quality_release.quality_deployment_cas_policy WHERE singleton FOR UPDATE;
 IF NOT FOUND OR policy.authorised_until<=clock_timestamp() OR p_valid_until>policy.authorised_until
  OR (p_restore_of IS NULL AND NOT policy.enabled) OR (p_restore_of IS NOT NULL AND NOT policy.recovery_enabled)
 THEN RAISE EXCEPTION 'AQC_CAS_DISABLED';END IF;
 PERFORM 1 FROM profitia_ingestion.runtime_bindings WHERE login_role IN('sg2_benchmark_source_development_runtime','sg2_insights_report_development_composer','sg2_insights_report_development_counter') ORDER BY login_role FOR UPDATE;
 SELECT (SELECT jsonb_agg(to_jsonb(t)-'deployment_id'-'version' ORDER BY login_role) FROM profitia_ingestion.runtime_bindings t WHERE login_role IN('sg2_benchmark_source_development_runtime','sg2_insights_report_development_composer','sg2_insights_report_development_counter')) INTO before_rows;
 SELECT * INTO prior FROM profitia_quality_release.quality_deployment_cas_operations WHERE operation_id=p_operation;
 IF FOUND THEN
  IF prior.from_sha IS DISTINCT FROM p_from_sha OR prior.to_sha IS DISTINCT FROM p_to_sha
   OR prior.restore_of IS DISTINCT FROM p_restore_of OR prior.metadata IS DISTINCT FROM before_rows
   OR NOT ((SELECT count(*) FROM profitia_ingestion.runtime_bindings WHERE login_role IN('sg2_benchmark_source_development_runtime','sg2_insights_report_development_composer','sg2_insights_report_development_counter') AND deployment_id=CASE WHEN login_role='sg2_benchmark_source_development_runtime' THEN 'srv-dapa3tid0e5s73f8bc5g:'||p_to_sha ELSE p_to_sha END)=3)
  THEN RAISE EXCEPTION 'AQC_CAS_IDEMPOTENCY_CONFLICT';END IF;
  RETURN jsonb_build_object('applicationId','spendguru','environment','development','profile','product',
   'operationId',p_operation,'status','REPLAY','fromSourceSha',p_from_sha,'toSourceSha',p_to_sha,'updatedBindings',3,
   'rawQaReadPerformed',false,'permissionMutationPerformed',false);
 END IF;
 IF (SELECT count(*) FROM profitia_quality_release.quality_deployment_cas_operations)>=256 THEN RAISE EXCEPTION 'AQC_CAS_OPERATION_LIMIT';END IF;
 IF p_restore_of IS NOT NULL THEN
  SELECT * INTO original FROM profitia_quality_release.quality_deployment_cas_operations WHERE operation_id=p_restore_of;
  IF NOT FOUND OR original.restore_of IS NOT NULL OR original.from_sha IS DISTINCT FROM p_to_sha OR original.to_sha IS DISTINCT FROM p_from_sha
   OR NOT ((SELECT count(*) FROM profitia_ingestion.runtime_bindings WHERE login_role IN('sg2_benchmark_source_development_runtime','sg2_insights_report_development_composer','sg2_insights_report_development_counter') AND deployment_id=CASE WHEN login_role='sg2_benchmark_source_development_runtime' THEN 'srv-dapa3tid0e5s73f8bc5g:'||p_from_sha ELSE p_from_sha END)=3)
  THEN RAISE EXCEPTION 'AQC_CAS_RECOVERY_REJECTED';END IF;
 ELSIF NOT ((SELECT count(*) FROM profitia_ingestion.runtime_bindings WHERE login_role IN('sg2_benchmark_source_development_runtime','sg2_insights_report_development_composer','sg2_insights_report_development_counter') AND deployment_id=CASE WHEN login_role='sg2_benchmark_source_development_runtime' THEN 'srv-dapa3tid0e5s73f8bc5g:'||p_from_sha ELSE p_from_sha END AND status='ACTIVE' AND expires_at>clock_timestamp())=3) THEN RAISE EXCEPTION 'AQC_CAS_BASE_CHANGED';END IF;
 UPDATE profitia_ingestion.runtime_bindings SET deployment_id=CASE WHEN login_role='sg2_benchmark_source_development_runtime' THEN 'srv-dapa3tid0e5s73f8bc5g:'||p_to_sha ELSE p_to_sha END WHERE login_role IN('sg2_benchmark_source_development_runtime','sg2_insights_report_development_composer','sg2_insights_report_development_counter');
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>3 THEN RAISE EXCEPTION 'AQC_CAS_ROW_COUNT';END IF;
 SELECT (SELECT jsonb_agg(to_jsonb(t)-'deployment_id'-'version' ORDER BY login_role) FROM profitia_ingestion.runtime_bindings t WHERE login_role IN('sg2_benchmark_source_development_runtime','sg2_insights_report_development_composer','sg2_insights_report_development_counter')) INTO after_rows;
 IF before_rows IS DISTINCT FROM after_rows THEN RAISE EXCEPTION 'AQC_CAS_METADATA_CHANGED';END IF;
 INSERT INTO profitia_quality_release.quality_deployment_cas_operations VALUES(p_operation,p_from_sha,p_to_sha,p_restore_of,before_rows,clock_timestamp());
 RETURN jsonb_build_object('applicationId','spendguru','environment','development','profile','product',
  'operationId',p_operation,'status',CASE WHEN p_restore_of IS NULL THEN 'APPLIED' ELSE 'RESTORED' END,
  'fromSourceSha',p_from_sha,'toSourceSha',p_to_sha,'updatedBindings',3,'rawQaReadPerformed',false,'permissionMutationPerformed',false);
END $aqc_cas$;
REVOKE ALL ON FUNCTION profitia_quality_release.quality_deployment_cas(uuid,text,text,uuid,timestamptz) FROM PUBLIC;
GRANT USAGE ON SCHEMA profitia_quality_release TO aqc_development_product_publisher;
GRANT EXECUTE ON FUNCTION profitia_quality_release.quality_deployment_cas(uuid,text,text,uuid,timestamptz) TO aqc_development_product_publisher;

-- Metadata-only readiness/reconciliation. No transcript, principal, grant,
-- private row or before/after row metadata is returned or directly granted.
CREATE FUNCTION profitia_quality_release.quality_deployment_cas_status(p_operation uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $aqc_status$
DECLARE policy record;runtime record;source_sha text;fresh boolean;operation jsonb;
BEGIN
 IF session_user<>'aqc_development_product_publisher' OR current_user<>'profitia_ingestion_owner' OR current_database()<>'neondb'
  OR clock_timestamp()>='2026-11-27T23:59:59Z'::timestamptz
  OR NOT EXISTS(SELECT 1 FROM profitia_ingestion.installation WHERE singleton AND environment='development'
   AND project_id='autumn-waterfall-65938876' AND branch_id='br-dry-hall-b294222f')
 THEN RAISE EXCEPTION 'AQC_CAS_BINDING_REJECTED';END IF;
 SELECT * INTO runtime FROM pg_catalog.pg_roles WHERE rolname=session_user;
 IF NOT runtime.rolcanlogin OR runtime.rolsuper OR runtime.rolinherit OR runtime.rolcreaterole OR runtime.rolcreatedb
  OR runtime.rolbypassrls OR runtime.rolreplication OR runtime.rolconnlimit<>2
  OR runtime.rolvaliduntil IS NULL OR runtime.rolvaliduntil>'2026-11-27T23:59:59Z'::timestamptz
  OR runtime.rolvaliduntil<=clock_timestamp() OR EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=runtime.oid)
 THEN RAISE EXCEPTION 'AQC_CAS_ROLE_REJECTED';END IF;
 SELECT * INTO policy FROM profitia_quality_release.quality_deployment_cas_policy WHERE singleton;
 IF NOT FOUND THEN RAISE EXCEPTION 'AQC_CAS_POLICY_UNAVAILABLE';END IF;
 SELECT CASE WHEN count(*)=3 AND count(DISTINCT source)=1 AND bool_and(source~'^[a-f0-9]{40}$') THEN min(source) ELSE NULL END,
  coalesce(count(*)=3 AND bool_and(status='ACTIVE' AND expires_at>clock_timestamp()),false)
 INTO source_sha,fresh FROM (SELECT deployment_id AS source,status,expires_at FROM profitia_ingestion.runtime_bindings WHERE login_role IN('sg2_insights_report_development_composer','sg2_insights_report_development_counter')
 UNION ALL SELECT substring(deployment_id FROM 26) AS source,status,expires_at FROM profitia_ingestion.runtime_bindings WHERE login_role='sg2_benchmark_source_development_runtime' AND deployment_id~'^srv-dapa3tid0e5s73f8bc5g:[a-f0-9]{40}$') AS refs;
 SELECT jsonb_build_object('operationId',operation_id,'fromSourceSha',from_sha,'toSourceSha',to_sha,'restoreOf',restore_of)
 INTO operation FROM profitia_quality_release.quality_deployment_cas_operations WHERE operation_id=p_operation;
 RETURN jsonb_build_object('schemaVersion','AQC_PUBLISHER_CAS_STATUS_V1','applicationId','spendguru',
  'environment','development','profile','product','currentSourceSha',source_sha,'bindingsFresh',fresh,
  'publishingEnabled',policy.enabled,'recoveryEnabled',policy.recovery_enabled,
  'authorisedUntil',to_char(policy.authorised_until AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'operation',operation,'rawQaReadPerformed',false,'permissionMutationPerformed',false);
END $aqc_status$;
REVOKE ALL ON FUNCTION profitia_quality_release.quality_deployment_cas_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION profitia_quality_release.quality_deployment_cas_status(uuid) TO aqc_development_product_publisher;
