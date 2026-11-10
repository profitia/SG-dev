-- Explicit owner activation only. Administrative metadata; no ECR schema,
-- provider scope, payload, quota, counter, key, retention or E1 grant changes.
SET LOCAL ROLE source_hub_development_owner;
CREATE TABLE source_hub.ecr_source_continuity_policy(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 status text NOT NULL CHECK(status IN('ACTIVE','REVOKED')),
 owner_basis text NOT NULL CHECK(owner_basis~'^owner-decision:sha256:[a-f0-9]{64}$'),
 rights_mode text NOT NULL CHECK(rights_mode IN('NO_FIXED_EXPIRY_OWNER_ATTESTED','FINITE_PROVIDER_RIGHTS')),
 rights_valid_until timestamptz CHECK(isfinite(rights_valid_until)),
 expected_fingerprints jsonb NOT NULL CHECK(jsonb_typeof(expected_fingerprints)='object'),
 lease_until timestamptz NOT NULL CHECK(isfinite(lease_until)),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK((rights_mode='FINITE_PROVIDER_RIGHTS')=(rights_valid_until IS NOT NULL)),
 CHECK(rights_valid_until IS NULL OR rights_valid_until>=lease_until)
);
CREATE TABLE source_hub.ecr_source_continuity_history(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 operator_role name NOT NULL,owner_basis text NOT NULL,previous_lease_until timestamptz NOT NULL,lease_until timestamptz NOT NULL
);
ALTER TABLE source_hub.ecr_source_continuity_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_hub.ecr_source_continuity_policy FORCE ROW LEVEL SECURITY;
ALTER TABLE source_hub.ecr_source_continuity_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_hub.ecr_source_continuity_history FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON source_hub.ecr_source_continuity_policy TO source_hub_development_owner USING(true) WITH CHECK(true);
CREATE POLICY controlled_owner ON source_hub.ecr_source_continuity_history TO source_hub_development_owner USING(true) WITH CHECK(true);
CREATE FUNCTION source_hub.ecr_monitor_session() RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT session_user='economic_calendar_development_source_monitor'
 AND EXISTS(SELECT 1 FROM pg_roles WHERE rolname=session_user AND rolcanlogin AND NOT(rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication))
 AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=session_user))
$fn$;
CREATE FUNCTION source_hub.ecr_control_fingerprint(v jsonb) RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT encode(public.digest(convert_to((v-ARRAY['expires_at','version','consumed_count','admitted_count','proof_key'])::text,'UTF8'),'sha256'),'hex')
$fn$;
CREATE FUNCTION source_hub.ecr_source_policy() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF NOT source_hub.ecr_monitor_session() THEN RAISE EXCEPTION 'Own ordinary ECR monitor required' USING ERRCODE='42501'; END IF;
 RETURN(SELECT to_jsonb(p) FROM source_hub.ecr_source_continuity_policy p WHERE singleton);
END $fn$;
REVOKE ALL ON FUNCTION source_hub.ecr_monitor_session(),source_hub.ecr_control_fingerprint(jsonb),source_hub.ecr_source_policy() FROM PUBLIC;
GRANT USAGE ON SCHEMA source_hub TO profitia_ingestion_owner,profitia_access_owner,economic_calendar_development_source_monitor;
GRANT EXECUTE ON FUNCTION source_hub.ecr_monitor_session(),source_hub.ecr_control_fingerprint(jsonb),source_hub.ecr_source_policy() TO profitia_ingestion_owner,profitia_access_owner;

SET LOCAL ROLE profitia_ingestion_owner;
CREATE FUNCTION profitia_ingestion.ecr_source_status() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
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
 UNION ALL SELECT 'external:'||s.source_id,'TRANSPORT_ADMISSION',s.source_id,b.status,b.expires_at,to_jsonb(b),CASE WHEN b.quota_mode='UNMETERED' THEN 'NO_FIXED_EXPIRY' ELSE 'FINITE' END FROM scope s LEFT JOIN profitia_external_call.policies b ON b.source_id=s.source_id AND b.resource_id=s.resource_id AND b.login_role='source_hub_development_source_runtime'
 UNION ALL SELECT 'native:'||s.source_id,'NATIVE_TRANSPORT',s.source_id,b.status,b.expires_at,to_jsonb(b),'FINITE' FROM scope s LEFT JOIN profitia_external_call.policies e ON e.source_id=s.source_id AND e.resource_id=s.resource_id AND e.login_role='source_hub_development_source_runtime' LEFT JOIN profitia_external_native.policies b USING(policy_id)
 ) SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'source',source,'status',coalesce(status,'MISSING'),'expiresAt',expires,'expiryMode',mode,'fingerprint',source_hub.ecr_control_fingerprint(row_data)) ORDER BY id),'[]'::jsonb) INTO answer FROM records;
 RETURN answer;
END $fn$;
CREATE FUNCTION profitia_ingestion.extend_ecr_sources(deadline timestamptz) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
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
 UPDATE profitia_external_native.policies SET expires_at=greatest(expires_at,deadline) WHERE policy_id IN(SELECT policy_id FROM profitia_external_call.policies WHERE login_role='source_hub_development_source_runtime' AND source_id=ANY(source_ids) AND resource_id='api.'||substring(source_id FROM 12)) AND expires_at<deadline;
 RETURN true;
END $fn$;
REVOKE ALL ON FUNCTION profitia_ingestion.ecr_source_status(),profitia_ingestion.extend_ecr_sources(timestamptz) FROM PUBLIC;
GRANT USAGE ON SCHEMA profitia_ingestion TO source_hub_development_owner;
GRANT EXECUTE ON FUNCTION profitia_ingestion.ecr_source_status(),profitia_ingestion.extend_ecr_sources(timestamptz) TO source_hub_development_owner;

SET LOCAL ROLE profitia_access_owner;
CREATE FUNCTION profitia_e1_receiver.ecr_receiver_status() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE r profitia_e1_receiver.installation%ROWTYPE;
BEGIN
 IF NOT source_hub.ecr_monitor_session() THEN RAISE EXCEPTION 'Own ordinary ECR monitor required' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM profitia_e1_receiver.installation WHERE singleton AND login_role='source_hub_development_runtime' AND binding->>'applicationId'='profitia-source-hub-development';
 RETURN jsonb_build_object('id','hub-local-receiver','kind','E1_RECEIVER','source','SourceHub','status',coalesce(r.status,'MISSING'),'expiresAt',r.expires_at,'expiryMode','FINITE','fingerprint',source_hub.ecr_control_fingerprint(to_jsonb(r)));
END $fn$;
CREATE FUNCTION profitia_e1_receiver.extend_ecr_receiver(deadline timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE p jsonb; r jsonb;
BEGIN
 p:=source_hub.ecr_source_policy();r:=profitia_e1_receiver.ecr_receiver_status();
 IF p->>'status' IS DISTINCT FROM 'ACTIVE' OR r->>'status'<>'ACTIVE' OR coalesce((r->>'expiresAt')::timestamptz<=clock_timestamp(),true)
 OR r->>'fingerprint' IS DISTINCT FROM p->'expected_fingerprints'->>'hub-local-receiver' OR NOT isfinite(deadline) OR deadline<=clock_timestamp() OR deadline>clock_timestamp()+interval '30 days'
 OR(p->>'rights_valid_until' IS NOT NULL AND deadline>(p->>'rights_valid_until')::timestamptz) THEN RAISE EXCEPTION 'ECR_RECEIVER_RENEWAL_NOT_ADMITTED' USING ERRCODE='42501'; END IF;
 UPDATE profitia_e1_receiver.installation SET expires_at=greatest(expires_at,deadline) WHERE singleton AND expires_at<deadline;
END $fn$;
REVOKE ALL ON FUNCTION profitia_e1_receiver.ecr_receiver_status(),profitia_e1_receiver.extend_ecr_receiver(timestamptz) FROM PUBLIC;
GRANT USAGE ON SCHEMA profitia_e1_receiver TO source_hub_development_owner;
GRANT EXECUTE ON FUNCTION profitia_e1_receiver.ecr_receiver_status(),profitia_e1_receiver.extend_ecr_receiver(timestamptz) TO source_hub_development_owner;

SET LOCAL ROLE source_hub_development_owner;
CREATE FUNCTION source_hub.ecr_source_access_status() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE p jsonb; deps jsonb;
BEGIN
 p:=source_hub.ecr_source_policy();
 SELECT coalesce(jsonb_agg(jsonb_build_object('id','licence:'||s.source_id,'kind','INTERNAL_LICENCE_ADMISSION','source',s.source_id,'status',coalesce(l.status,'MISSING'),'expiresAt',l.expires_at,'expiryMode','FINITE','fingerprint',source_hub.ecr_control_fingerprint(to_jsonb(l))) ORDER BY s.source_id),'[]'::jsonb) INTO deps
 FROM unnest(ARRAY['source-hub.eia.publication-calendar','source-hub.eia.series-observations','source-hub.commodities-sh.publication-calendar'])s(source_id) LEFT JOIN source_hub.provider_licences l USING(source_id);
 deps:=deps||profitia_ingestion.ecr_source_status()||jsonb_build_array(profitia_e1_receiver.ecr_receiver_status(),jsonb_build_object('id','source-continuity-owner-basis','kind','OWNER_RENEWAL_BASIS','source','SourceHub','status',coalesce(p->>'status','MISSING'),'expiresAt',p->>'rights_valid_until','expiryMode',CASE WHEN p->>'rights_mode'='NO_FIXED_EXPIRY_OWNER_ATTESTED' THEN 'NO_FIXED_EXPIRY' ELSE 'FINITE' END));
 RETURN jsonb_build_object('dependencies',deps,'leaseUntil',p->>'lease_until','rightsMode',p->>'rights_mode');
END $fn$;
CREATE FUNCTION source_hub.maintain_ecr_source_access() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE p source_hub.ecr_source_continuity_policy%ROWTYPE; snap jsonb; item jsonb; deadline timestamptz;
BEGIN
 IF NOT source_hub.ecr_monitor_session() THEN RAISE EXCEPTION 'Own ordinary ECR monitor required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('ecr-source-access-continuity',0));
 SELECT * INTO p FROM source_hub.ecr_source_continuity_policy WHERE singleton FOR UPDATE;
 snap:=source_hub.ecr_source_access_status();
 IF p.status IS DISTINCT FROM 'ACTIVE' THEN RETURN snap||jsonb_build_object('status','OWNER_BASIS_INACTIVE'); END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(snap->'dependencies') LOOP
  IF item->>'status'<>'ACTIVE' OR(item->>'expiryMode'='FINITE' AND coalesce((item->>'expiresAt')::timestamptz<=clock_timestamp(),true)) THEN RETURN snap||jsonb_build_object('status','BLOCKED_NO_RIGHT_RESTORED'); END IF;
  IF item->>'kind'<>'OWNER_RENEWAL_BASIS' AND item->>'fingerprint' IS DISTINCT FROM p.expected_fingerprints->>(item->>'id') THEN RAISE EXCEPTION 'ECR_SOURCE_SCOPE_DRIFT' USING ERRCODE='42501'; END IF;
 END LOOP;
 deadline:=least(clock_timestamp()+interval '30 days',coalesce(p.rights_valid_until,'infinity'::timestamptz));
 IF p.lease_until>=deadline-interval '1 day' THEN RETURN snap||jsonb_build_object('status','CURRENT'); END IF;
 PERFORM 1 FROM source_hub.provider_licences WHERE source_id=ANY(ARRAY['source-hub.eia.publication-calendar','source-hub.eia.series-observations','source-hub.commodities-sh.publication-calendar']) ORDER BY source_id FOR UPDATE;
 IF NOT profitia_ingestion.extend_ecr_sources(deadline) THEN RETURN snap||jsonb_build_object('status','DEFERRED_ACTIVE_SOURCE_CALL'); END IF;
 PERFORM profitia_e1_receiver.extend_ecr_receiver(deadline);
 UPDATE source_hub.provider_licences SET expires_at=greatest(expires_at,deadline) WHERE source_id=ANY(ARRAY['source-hub.eia.publication-calendar','source-hub.eia.series-observations','source-hub.commodities-sh.publication-calendar']) AND expires_at<deadline;
 UPDATE source_hub.ecr_source_continuity_policy SET lease_until=deadline,updated_at=clock_timestamp() WHERE singleton;
 INSERT INTO source_hub.ecr_source_continuity_history(operator_role,owner_basis,previous_lease_until,lease_until) VALUES(session_user,p.owner_basis,p.lease_until,deadline);
 RETURN source_hub.ecr_source_access_status()||jsonb_build_object('status','RENEWED');
END $fn$;
REVOKE ALL ON FUNCTION source_hub.ecr_source_access_status(),source_hub.maintain_ecr_source_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION source_hub.ecr_source_access_status(),source_hub.maintain_ecr_source_access() TO economic_calendar_development_source_monitor;
