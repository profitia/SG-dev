-- Optional SQL035. Owner-enrolled, revocable technical leases only.
-- No policy activation, provider rights, credentials or quantitative pool is added.
DO $guard$ BEGIN
 IF current_user<>'profitia_ingestion_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication) AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid))
 OR NOT EXISTS(SELECT 1 FROM profitia_ingestion.installation WHERE singleton AND unmetered_schema_digest='9fe56c54c22fe54aa4869966cf00e7347e8c0d040b1d3d8110fc7952a78d5e13')
 OR coalesce(current_setting('profitia.install.source_continuity_digest',true),'') !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Controlled Source owner and accepted SQL024/035 required' USING ERRCODE='42501'; END IF;
END $guard$;
CREATE SCHEMA profitia_source_continuity AUTHORIZATION profitia_ingestion_owner;
REVOKE ALL ON SCHEMA profitia_source_continuity FROM PUBLIC;
CREATE TABLE profitia_source_continuity.installation(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'));
CREATE TABLE profitia_source_continuity.policies(login_role name PRIMARY KEY REFERENCES profitia_ingestion.runtime_bindings(login_role),application_id text NOT NULL,source_ids text[] NOT NULL CHECK(cardinality(source_ids) BETWEEN 1 AND 32),status text NOT NULL CHECK(status IN('ACTIVE','REVOKED')),owner_basis text NOT NULL CHECK(owner_basis~'^owner-decision:sha256:[a-f0-9]{64}$'),expected_fingerprints jsonb NOT NULL CHECK(jsonb_typeof(expected_fingerprints)='object'),lease_until timestamptz NOT NULL CHECK(isfinite(lease_until)));
CREATE TABLE profitia_source_continuity.events(event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),login_role name NOT NULL,owner_basis text NOT NULL,previous_lease_until timestamptz NOT NULL,lease_until timestamptz NOT NULL,controls jsonb NOT NULL);
DO $rls$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['installation','policies','events'] LOOP
 EXECUTE format('ALTER TABLE profitia_source_continuity.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE profitia_source_continuity.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY controlled_owner ON profitia_source_continuity.%I TO profitia_ingestion_owner USING(true) WITH CHECK(true)',t);
 EXECUTE format('CREATE POLICY controlled_fence ON profitia_source_continuity.%I AS RESTRICTIVE TO PUBLIC USING(current_user=''profitia_ingestion_owner'') WITH CHECK(current_user=''profitia_ingestion_owner'')',t);
 END LOOP;END $rls$;
INSERT INTO profitia_source_continuity.installation VALUES(true,current_setting('profitia.install.source_continuity_digest'));
CREATE FUNCTION profitia_ingestion.continuity_fingerprint(v jsonb) RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT encode(sha256(convert_to((v-ARRAY['expires_at','version','consumed_count','admitted_count','proof_key'])::text,'UTF8')),'hex')
$fn$;
CREATE FUNCTION profitia_ingestion.continuity_controls(p_role name,p_app text,p_sources text[]) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
 WITH records(id,status,expires_at,v) AS(
 SELECT 'source:'||s.id,b.status,b.expires_at,to_jsonb(b) FROM unnest(p_sources)s(id) LEFT JOIN profitia_ingestion.sources b ON b.source_id=s.id
 UNION ALL SELECT 'grant:'||s.id,b.status,b.expires_at,to_jsonb(b) FROM unnest(p_sources)s(id) LEFT JOIN profitia_ingestion.grants b ON b.source_id=s.id AND b.login_role=p_role AND b.effect='ALLOW'
 UNION ALL SELECT 'budget:'||s.id,b.status,b.expires_at,to_jsonb(b) FROM unnest(p_sources)s(id) LEFT JOIN profitia_ingestion.budgets b ON b.source_id=s.id AND b.application_id=p_app AND b.status='ACTIVE'
 UNION ALL SELECT 'external:'||s.id,b.status,b.expires_at,to_jsonb(b) FROM unnest(p_sources)s(id) LEFT JOIN profitia_external_call.policies b ON b.source_id=s.id AND b.login_role=p_role AND b.status='ACTIVE'
 UNION ALL SELECT 'native:'||s.id,b.status,b.expires_at,to_jsonb(b) FROM unnest(p_sources)s(id) LEFT JOIN profitia_external_call.policies e ON e.source_id=s.id AND e.login_role=p_role AND e.status='ACTIVE' LEFT JOIN profitia_external_native.policies b USING(policy_id)
 ) SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'status',coalesce(status,'MISSING'),'expiresAt',expires_at,'fingerprint',profitia_ingestion.continuity_fingerprint(v)) ORDER BY id),'[]'::jsonb) FROM records
$fn$;
-- Keep historical UNKNOWN attempts and their charges. Only a still-reachable
-- plan or an attempt within the transport's bounded lifetime prevents renewal.
-- Five minutes exceeds the existing maximum 120s native timeout plus settlement.
CREATE FUNCTION profitia_ingestion.active_external_calls() RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT EXISTS(SELECT 1 FROM profitia_external_call.calls c JOIN profitia_external_call.policies e USING(policy_id) JOIN profitia_ingestion.runtime_bindings b ON b.login_role=c.login_role CROSS JOIN profitia_ingestion.installation i WHERE i.singleton AND c.status IN('PLANNED','ATTEMPT_RESERVED') AND(
  c.status='ATTEMPT_RESERVED' AND c.attempt_reserved_at>clock_timestamp()-interval '5 minutes'
  OR b.status='ACTIVE' AND e.status='ACTIVE' AND b.expires_at>clock_timestamp() AND c.policy_version=e.version AND c.service_binding_version='database-service:'||b.binding_id::text||':'||b.version::text AND c.source_policy_version='source-v1:'||i.revision::text))
$fn$;
CREATE FUNCTION profitia_ingestion.maintain_source_technical_access(p_digest text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE p profitia_source_continuity.policies%ROWTYPE;b profitia_ingestion.runtime_bindings%ROWTYPE;controls jsonb;item jsonb;deadline timestamptz;sid text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM profitia_source_continuity.installation WHERE singleton AND schema_digest=p_digest)
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=session_user AND rolcanlogin AND NOT(rolsuper OR rolinherit OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication) AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid)) THEN RAISE EXCEPTION 'Own ordinary Source role and exact SQL035 required' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('source-continuity:'||session_user,0));
 SELECT * INTO p FROM profitia_source_continuity.policies WHERE login_role=session_user FOR UPDATE;
 SELECT * INTO b FROM profitia_ingestion.runtime_bindings WHERE login_role=session_user FOR SHARE;
 IF p.status IS DISTINCT FROM 'ACTIVE' OR b.status IS DISTINCT FROM 'ACTIVE' OR b.application_id IS DISTINCT FROM p.application_id OR b.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Source continuity revoked or expired' USING ERRCODE='42501';END IF;
 controls:=profitia_ingestion.continuity_controls(p.login_role,p.application_id,p.source_ids);
 IF jsonb_array_length(controls)<>5*cardinality(p.source_ids) THEN RAISE EXCEPTION 'Ambiguous Source continuity scope' USING ERRCODE='42501';END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(controls) LOOP
  IF item->>'status'<>'ACTIVE' OR item->>'fingerprint' IS DISTINCT FROM p.expected_fingerprints->>(item->>'id') OR(item->>'expiresAt' IS NOT NULL AND (item->>'expiresAt')::timestamptz<=clock_timestamp()) THEN RAISE EXCEPTION 'Source continuity revoked, expired or drifted' USING ERRCODE='42501';END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM profitia_ingestion.grants WHERE login_role=session_user AND source_id=ANY(p.source_ids) AND effect='DENY' AND status='ACTIVE' AND expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'Explicit Source DENY' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM profitia_ingestion.budgets WHERE application_id=p.application_id AND source_id=ANY(p.source_ids) AND status='ACTIVE' AND quota_mode<>'UNMETERED') OR EXISTS(SELECT 1 FROM profitia_external_call.policies WHERE login_role=session_user AND source_id=ANY(p.source_ids) AND status='ACTIVE' AND quota_mode<>'UNMETERED') THEN RAISE EXCEPTION 'Explicit UNMETERED controls required' USING ERRCODE='42501';END IF;
 IF p.lease_until>clock_timestamp()+interval '29 days' THEN RETURN jsonb_build_object('status','CURRENT','leaseUntil',p.lease_until);END IF;
 BEGIN LOCK TABLE profitia_external_call.calls IN SHARE ROW EXCLUSIVE MODE NOWAIT;EXCEPTION WHEN lock_not_available THEN RETURN jsonb_build_object('status','DEFERRED_ACTIVE_SOURCE_CALL');END;
 IF profitia_ingestion.active_external_calls() THEN RETURN jsonb_build_object('status','DEFERRED_ACTIVE_SOURCE_CALL');END IF;
 -- Row locks and a fresh snapshot prevent renewal racing revocation/definition edits.
 PERFORM 1 FROM profitia_ingestion.sources WHERE source_id=ANY(p.source_ids) ORDER BY source_id FOR UPDATE;
 PERFORM 1 FROM profitia_ingestion.grants WHERE login_role=session_user AND source_id=ANY(p.source_ids) ORDER BY grant_id FOR UPDATE;
 PERFORM 1 FROM profitia_external_call.policies WHERE login_role=session_user AND source_id=ANY(p.source_ids) ORDER BY policy_id FOR UPDATE;
 PERFORM 1 FROM profitia_external_native.policies WHERE policy_id IN(SELECT policy_id FROM profitia_external_call.policies WHERE login_role=session_user AND source_id=ANY(p.source_ids)) ORDER BY policy_id FOR UPDATE;
 IF controls IS DISTINCT FROM profitia_ingestion.continuity_controls(p.login_role,p.application_id,p.source_ids) THEN RAISE EXCEPTION 'Source continuity changed while locking' USING ERRCODE='40001';END IF;
 deadline:=clock_timestamp()+interval '30 days';
 UPDATE profitia_ingestion.runtime_bindings SET expires_at=greatest(expires_at,deadline) WHERE login_role=session_user AND expires_at<deadline;
 UPDATE profitia_ingestion.sources SET expires_at=deadline WHERE source_id=ANY(p.source_ids) AND expires_at<deadline;
 UPDATE profitia_ingestion.grants SET expires_at=deadline WHERE login_role=session_user AND source_id=ANY(p.source_ids) AND effect='ALLOW' AND status='ACTIVE' AND expires_at<deadline;
 UPDATE profitia_external_native.policies SET expires_at=deadline WHERE policy_id IN(SELECT policy_id FROM profitia_external_call.policies WHERE login_role=session_user AND source_id=ANY(p.source_ids) AND status='ACTIVE') AND status='ACTIVE' AND expires_at<deadline;
 UPDATE profitia_source_continuity.policies SET lease_until=deadline WHERE login_role=session_user;
 INSERT INTO profitia_source_continuity.events(login_role,owner_basis,previous_lease_until,lease_until,controls) VALUES(session_user,p.owner_basis,p.lease_until,deadline,controls);
 RETURN jsonb_build_object('status','RENEWED','leaseUntil',deadline);
END $fn$;
-- Rebind a native policy to an owner-updated UNMETERED parent without losing
-- its identity, endpoint constraints, credential rules or historical calls.
CREATE OR REPLACE FUNCTION profitia_external_native.policy_change() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE p profitia_external_call.policies%ROWTYPE;rebasing boolean:=false;BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Native policy history is immutable' USING ERRCODE='42501';END IF;
 SELECT * INTO p FROM profitia_external_call.policies WHERE policy_id=NEW.policy_id FOR SHARE;
 IF NOT FOUND OR p.version<>NEW.base_policy_version OR(p.quota_mode<>'UNMETERED' AND NEW.expires_at>p.expires_at) THEN RAISE EXCEPTION 'Exact current parent policy required' USING ERRCODE='42501';END IF;
 IF TG_OP='UPDATE' THEN
  rebasing:=current_user='profitia_ingestion_owner' AND OLD.status='ACTIVE' AND NEW.status='ACTIVE' AND p.status='ACTIVE' AND p.quota_mode='UNMETERED' AND NEW.base_policy_version=OLD.base_policy_version+1;
  IF (to_jsonb(NEW)-ARRAY['status','version','expires_at']-CASE WHEN rebasing THEN 'base_policy_version' ELSE '__no_field__' END) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','version','expires_at']-CASE WHEN rebasing THEN 'base_policy_version' ELSE '__no_field__' END) THEN RAISE EXCEPTION 'Native policy definition is immutable' USING ERRCODE='42501';END IF;
  IF rebasing AND profitia_ingestion.active_external_calls() THEN RAISE EXCEPTION 'Native parent rebase requires settled calls' USING ERRCODE='42501';END IF;
  NEW.version:=OLD.version+1;
 END IF;RETURN NEW;
END $fn$;
CREATE FUNCTION profitia_ingestion.continuity_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$ BEGIN RAISE EXCEPTION 'Source continuity history is immutable' USING ERRCODE='42501';END $fn$;
DO $immutable$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['installation','events'] LOOP
 EXECUTE format('CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON profitia_source_continuity.%I FOR EACH ROW EXECUTE FUNCTION profitia_ingestion.continuity_immutable()',t);
 EXECUTE format('CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON profitia_source_continuity.%I FOR EACH STATEMENT EXECUTE FUNCTION profitia_ingestion.continuity_immutable()',t);
END LOOP;END $immutable$;
REVOKE ALL ON profitia_source_continuity.installation,profitia_source_continuity.policies,profitia_source_continuity.events FROM PUBLIC;
REVOKE ALL ON FUNCTION profitia_ingestion.continuity_fingerprint(jsonb),profitia_ingestion.continuity_controls(name,text,text[]),profitia_ingestion.maintain_source_technical_access(text),profitia_ingestion.continuity_immutable() FROM PUBLIC;

REVOKE ALL ON FUNCTION profitia_ingestion.active_external_calls() FROM PUBLIC;
