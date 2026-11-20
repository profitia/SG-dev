-- Additive EIA-calendar-only transport succession. Original010 and all
-- historical policies/calls/counters remain unchanged. Source grants/budgets,
-- ordinary monitor checks, finite expiry, revocation and other source joins stay.
-- This migration admits no policy and activates no retention or transport.
DO $guard$ BEGIN
 IF current_user<>'source_hub_development_owner' OR session_user<>'source_hub_development_migrator'
 OR NOT EXISTS(SELECT 1 FROM source_hub.migrations WHERE version='010-ecr-source-continuity' AND digest='fa2a62451e890a1f239dfc67278f7ad943a4c3e172e4de53397cfe58e71e91a0')
 THEN RAISE EXCEPTION 'EXACT_CONTINUITY_PREDECESSOR_AND_MIGRATOR_REQUIRED';END IF;
END $guard$;
SET LOCAL ROLE profitia_ingestion_owner;
DO $guard$ DECLARE p pg_proc%ROWTYPE; BEGIN
 SELECT * INTO STRICT p FROM pg_proc WHERE oid='profitia_ingestion.ecr_source_status()'::regprocedure;
 IF p.proowner<>'profitia_ingestion_owner'::regrole OR NOT p.prosecdef OR p.provolatile<>'v'
 OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']
 OR encode(public.digest(convert_to(p.prosrc,'UTF8'),'sha256'),'hex')<>'21dac332a66dd148ea67e1ce32e87cff091984a3314132aa1ce3faab77f37b0a'
 THEN RAISE EXCEPTION 'EXACT_UNCHANGED_CONTINUITY_FUNCTION_REQUIRED';END IF;
END $guard$;
DO $guard$ DECLARE p pg_proc%ROWTYPE; BEGIN
 SELECT * INTO STRICT p FROM pg_proc WHERE oid='profitia_ingestion.extend_ecr_sources(timestamptz)'::regprocedure;
 IF p.proowner<>'profitia_ingestion_owner'::regrole OR NOT p.prosecdef OR p.provolatile<>'v'
 OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, pg_temp']
 OR encode(public.digest(convert_to(p.prosrc,'UTF8'),'sha256'),'hex')<>'9abc8c2c3ebd83a68e9220b5acbed45b62aaf37f906d9080cde6eefd3db59ce1'
 THEN RAISE EXCEPTION 'EXACT_UNCHANGED_CONTINUITY_FUNCTION_REQUIRED';END IF;
END $guard$;
CREATE OR REPLACE FUNCTION profitia_ingestion.ecr_source_status() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE answer jsonb;
BEGIN
 IF NOT source_hub.ecr_monitor_session() THEN RAISE EXCEPTION 'Own ordinary ECR monitor required' USING ERRCODE='42501'; END IF;
 WITH scope(source_id,resource_id) AS(VALUES
 ('source-hub.eia.publication-calendar','api.eia.publication-calendar'),
 ('source-hub.eia.series-observations','api.eia.series-observations'),
 ('source-hub.commodities-sh.publication-calendar','api.commodities-sh.publication-calendar')),
 records(id,kind,source,status,expires,row_data,mode) AS(
 SELECT 'source-runtime','SERVICE_BINDING','SourceHub',b.status,b.expires_at,to_jsonb(b),'FINITE' FROM(VALUES(1))v(x)
 LEFT JOIN profitia_ingestion.runtime_bindings b ON b.login_role='source_hub_development_source_runtime'
 UNION ALL SELECT 'source:'||s.source_id,'SOURCE_ADMISSION',s.source_id,b.status,b.expires_at,to_jsonb(b),'FINITE' FROM scope s LEFT JOIN profitia_ingestion.sources b USING(source_id)
 UNION ALL SELECT 'grant:'||s.source_id,'SOURCE_GRANT',s.source_id,CASE WHEN EXISTS(SELECT 1 FROM profitia_ingestion.grants d WHERE d.login_role='source_hub_development_source_runtime' AND d.source_id=s.source_id AND d.effect='DENY' AND d.status='ACTIVE' AND d.expires_at>clock_timestamp() AND(d.resource_id IS NULL OR d.resource_id=s.resource_id)) THEN 'DENIED' ELSE b.status END,b.expires_at,to_jsonb(b),'FINITE'
 FROM scope s LEFT JOIN profitia_ingestion.grants b ON b.source_id=s.source_id AND b.resource_id=s.resource_id AND b.login_role='source_hub_development_source_runtime' AND b.effect='ALLOW'
 UNION ALL SELECT 'budget:'||s.source_id,'SOURCE_BUDGET',s.source_id,b.status,b.expires_at,to_jsonb(b),CASE WHEN b.quota_mode='UNMETERED' THEN 'NO_FIXED_EXPIRY' ELSE 'FINITE' END FROM scope s LEFT JOIN profitia_ingestion.budgets b ON b.source_id=s.source_id AND b.application_id='profitia-source-hub-development'
 UNION ALL SELECT 'external:'||s.source_id,'TRANSPORT_ADMISSION',s.source_id,b.status,b.expires_at,to_jsonb(b),CASE WHEN b.quota_mode='UNMETERED' THEN 'NO_FIXED_EXPIRY' ELSE 'FINITE' END FROM scope s LEFT JOIN profitia_external_call.policies b ON b.source_id=s.source_id AND b.resource_id=s.resource_id AND b.login_role='source_hub_development_source_runtime' AND(s.source_id<>'source-hub.eia.publication-calendar' OR b.policy_id=(SELECT chosen.policy_id FROM profitia_external_call.policies chosen WHERE chosen.login_role='source_hub_development_source_runtime' AND chosen.source_id=s.source_id AND chosen.resource_id=s.resource_id ORDER BY (chosen.status='ACTIVE') DESC,chosen.version DESC,chosen.policy_id LIMIT 1))
 UNION ALL SELECT 'native:'||s.source_id,'NATIVE_TRANSPORT',s.source_id,b.status,b.expires_at,to_jsonb(b),'FINITE' FROM scope s LEFT JOIN profitia_external_call.policies e ON e.source_id=s.source_id AND e.resource_id=s.resource_id AND e.login_role='source_hub_development_source_runtime' AND(s.source_id<>'source-hub.eia.publication-calendar' OR e.policy_id=(SELECT chosen.policy_id FROM profitia_external_call.policies chosen WHERE chosen.login_role='source_hub_development_source_runtime' AND chosen.source_id=s.source_id AND chosen.resource_id=s.resource_id ORDER BY (chosen.status='ACTIVE') DESC,chosen.version DESC,chosen.policy_id LIMIT 1)) LEFT JOIN profitia_external_native.policies b USING(policy_id)
 ) SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'source',source,'status',coalesce(status,'MISSING'),'expiresAt',expires,'expiryMode',mode,'fingerprint',source_hub.ecr_control_fingerprint(row_data)) ORDER BY id),'[]'::jsonb) INTO answer FROM records;
 RETURN answer;
END $fn$;
CREATE OR REPLACE FUNCTION profitia_ingestion.extend_ecr_sources(deadline timestamptz) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE p jsonb; item jsonb; source_ids text[]:=ARRAY['source-hub.eia.publication-calendar','source-hub.eia.series-observations','source-hub.commodities-sh.publication-calendar'];
BEGIN
 p:=source_hub.ecr_source_policy();
 IF p->>'status' IS DISTINCT FROM 'ACTIVE' OR NOT isfinite(deadline) OR deadline<=clock_timestamp() OR deadline>clock_timestamp()+interval '30 days'
 OR(p->>'rights_valid_until' IS NOT NULL AND deadline>(p->>'rights_valid_until')::timestamptz) THEN RAISE EXCEPTION 'Explicit finite renewal basis required' USING ERRCODE='42501'; END IF;
 -- Prevent a binding/version change while any native call is in flight. No
 -- old counter or uncertain call is reset to manufacture a safe interval.
 BEGIN LOCK TABLE profitia_external_call.calls IN SHARE ROW EXCLUSIVE MODE NOWAIT;
 EXCEPTION WHEN lock_not_available THEN RETURN false; END;
 IF EXISTS(SELECT 1 FROM profitia_external_call.calls WHERE login_role='source_hub_development_source_runtime' AND status IN('PLANNED','ATTEMPT_RESERVED')) THEN RETURN false; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(profitia_ingestion.ecr_source_status()) LOOP
  IF item->>'status'<>'ACTIVE' OR(item->>'expiryMode'='FINITE' AND coalesce((item->>'expiresAt')::timestamptz<=clock_timestamp(),true))
   OR item->>'fingerprint' IS DISTINCT FROM p->'expected_fingerprints'->>(item->>'id') THEN RAISE EXCEPTION 'ECR_SOURCE_CONTROL_REVOKED_EXPIRED_OR_DRIFTED' USING ERRCODE='42501'; END IF;
 END LOOP;
 UPDATE profitia_ingestion.runtime_bindings SET expires_at=greatest(expires_at,deadline) WHERE login_role='source_hub_development_source_runtime' AND expires_at<deadline;
 UPDATE profitia_ingestion.sources SET expires_at=greatest(expires_at,deadline) WHERE source_id=ANY(source_ids) AND expires_at<deadline;
 UPDATE profitia_ingestion.grants SET expires_at=greatest(expires_at,deadline) WHERE login_role='source_hub_development_source_runtime' AND source_id=ANY(source_ids) AND effect='ALLOW' AND resource_id='api.'||substring(source_id FROM 12) AND expires_at<deadline;
 UPDATE profitia_external_native.policies SET expires_at=greatest(expires_at,deadline) WHERE policy_id IN(SELECT policy_id FROM profitia_external_call.policies WHERE login_role='source_hub_development_source_runtime' AND source_id=ANY(source_ids) AND resource_id='api.'||substring(source_id FROM 12) AND(source_id<>'source-hub.eia.publication-calendar' OR status='ACTIVE')) AND expires_at<deadline;
 RETURN true;
END $fn$;
-- CREATE OR REPLACE retains both original EXECUTE ACLs; no new caller/grant.
SET LOCAL ROLE source_hub_development_owner;
