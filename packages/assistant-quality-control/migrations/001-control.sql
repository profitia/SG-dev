-- Metadata-only extension of the existing SG2 private product store. It grants
-- no history/QA read, purpose, source or E1 right. No installation is seeded.
DO $guard$ BEGIN
 IF current_user<>'sg2_assistant_history_owner' OR current_database()<>'neondb'
 OR NOT EXISTS(SELECT 1 FROM sg2_assistant_history.installation WHERE singleton AND application_id='spendguru' AND environment='development'
  AND project_id='autumn-waterfall-65938876' AND branch_id='br-dry-hall-b294222f')
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='sg2_assistant_quality_controller' AND rolcanlogin AND NOT(rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolinherit))
 OR EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname='sg2_assistant_quality_controller')
 THEN RAISE EXCEPTION 'SG2_QUALITY_STORE_OWNER_REQUIRED';END IF;
END $guard$;
CREATE SCHEMA sg2_assistant_quality_control AUTHORIZATION sg2_assistant_history_owner;
REVOKE ALL ON SCHEMA sg2_assistant_quality_control FROM PUBLIC;
CREATE TABLE sg2_assistant_quality_control.installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 schema_digest text NOT NULL CHECK(schema_digest='__QUALITY_CONTROL_SCHEMA_DIGEST__'),
 service_id uuid NOT NULL,command_key bytea NOT NULL CHECK(octet_length(command_key)=32),
 enabled boolean NOT NULL DEFAULT false,source_ref text NOT NULL
);
CREATE TABLE sg2_assistant_quality_control.incidents(
 id uuid PRIMARY KEY,revision bigint NOT NULL DEFAULT 1,record jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '2160 hours'
);
CREATE UNIQUE INDEX quality_incident_cause ON sg2_assistant_quality_control.incidents((record->>'repairClass'),(record->>'causeFingerprint'));
CREATE TABLE sg2_assistant_quality_control.class_suspensions(
 repair_class text PRIMARY KEY CHECK(repair_class IN('C1','C2','C3')),suspended_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE sg2_assistant_quality_control.repository_lock(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),incident_id uuid REFERENCES sg2_assistant_quality_control.incidents,
 lease_token uuid,worker_id text,lease_until timestamptz,last_release_at timestamptz
);
INSERT INTO sg2_assistant_quality_control.repository_lock(singleton)VALUES(true);
CREATE TABLE sg2_assistant_quality_control.events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,incident_id uuid NOT NULL,revision bigint NOT NULL,
 action text NOT NULL,nonce uuid,status text NOT NULL,recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- The operational store has a 90-day bound. Purge removes event rows only
-- together with the completed incident; no transcript or source data is stored.
DO $rls$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['installation','incidents','repository_lock','events','class_suspensions'] LOOP
  EXECUTE format('ALTER TABLE sg2_assistant_quality_control.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE sg2_assistant_quality_control.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY controlled_owner ON sg2_assistant_quality_control.%I TO sg2_assistant_history_owner USING(true) WITH CHECK(true)',t);
  EXECUTE format('REVOKE ALL ON sg2_assistant_quality_control.%I FROM PUBLIC,sg2_assistant_quality_controller',t);
 END LOOP;
END $rls$;

CREATE FUNCTION sg2_assistant_quality_control.valid_metadata(v jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $fn$
DECLARE item jsonb;k text;
BEGIN
 CASE jsonb_typeof(v)
 WHEN 'null' THEN RETURN true;
 WHEN 'boolean' THEN RETURN true;
 WHEN 'number' THEN RETURN v::text ~ '^(0|[1-9][0-9]{0,14})$';
 WHEN 'string' THEN RETURN length(v#>>'{}') BETWEEN 1 AND 256 AND v#>>'{}' ~ '^[a-zA-Z0-9_:.-]+$';
 WHEN 'object' THEN
  IF (SELECT count(*) FROM jsonb_object_keys(v))>32 THEN RETURN false;END IF;
  FOR k,item IN SELECT * FROM jsonb_each(v) LOOP
   IF k !~ '^[a-zA-Z][a-zA-Z0-9]{0,39}$' OR NOT sg2_assistant_quality_control.valid_metadata(item) THEN RETURN false;END IF;
  END LOOP;RETURN true;
 ELSE RETURN false;
 END CASE;
END $fn$;
REVOKE ALL ON FUNCTION sg2_assistant_quality_control.valid_metadata(jsonb) FROM PUBLIC;

CREATE FUNCTION sg2_assistant_quality_control.apply(p_json text,p_proof text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,sg2_assistant_quality_control,pg_temp AS $fn$
DECLARE i installation%ROWTYPE;l repository_lock%ROWTYPE;n incidents%ROWTYPE;
 d jsonb;v jsonb;action text;expected text[];receipt jsonb;token uuid;next_revision bigint;
 ms bigint:=floor(extract(epoch FROM clock_timestamp())*1000);due jsonb;v_action text;expected_action text;
 terminal text[]:=ARRAY['CLOSED','INSUFFICIENT_EVIDENCE','OUT_OF_SCOPE','BUDGET_STOP','ROLLED_BACK','NEEDS_TECHNICAL_REVIEW'];
BEGIN
 IF session_user<>'sg2_assistant_quality_controller' OR current_database()<>'neondb'
 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=session_user AND (NOT rolcanlogin OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolinherit))
 OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=session_user))
 OR p_json IS NULL OR octet_length(p_json)>32768 THEN RAISE EXCEPTION 'CONTROL_STORE_UNAVAILABLE';END IF;
 SELECT * INTO i FROM installation WHERE singleton FOR SHARE;
 IF i.schema_digest IS DISTINCT FROM '__QUALITY_CONTROL_SCHEMA_DIGEST__'
 OR p_proof IS DISTINCT FROM encode(public.hmac(convert_to(p_json,'UTF8'),i.command_key,'sha256'),'hex')
 THEN RAISE EXCEPTION 'CONTROL_STORE_UNAVAILABLE';END IF;
 d:=p_json::jsonb;action:=d->>'action';
 IF jsonb_typeof(d) IS DISTINCT FROM 'object' OR d->>'contract' IS DISTINCT FROM 'QualityControlStore/1.0.0'
 OR (d->>'serviceId')::uuid IS DISTINCT FROM i.service_id OR d->>'schemaDigest' IS DISTINCT FROM i.schema_digest
 OR coalesce((d->>'until')::bigint,0)<=ms OR (d->>'until')::bigint>ms+10000
 OR coalesce(action,'') NOT IN('DESCRIPTOR','CREATE','LIST_DUE','CLAIM','PREPARE','RECORD_EXTERNAL','COMPLETE','STOP','CONTAIN','RELEASE','PURGE')
 THEN RAISE EXCEPTION 'CONTROL_STORE_UNAVAILABLE';END IF;
 expected:=ARRAY['contract','serviceId','schemaDigest','until','action']||CASE action
  WHEN 'CREATE' THEN ARRAY['record'] WHEN 'CLAIM' THEN ARRAY['id','workerId','leaseMs']
  WHEN 'PREPARE' THEN ARRAY['id','leaseToken','revision','actionName','nonce']
  WHEN 'RECORD_EXTERNAL' THEN ARRAY['id','leaseToken','revision','nonce','externalId']
  WHEN 'COMPLETE' THEN ARRAY['id','leaseToken','revision','nonce','record']
  WHEN 'STOP' THEN ARRAY['id','leaseToken','revision','status','reason']
  WHEN 'CONTAIN' THEN ARRAY['id','leaseToken','revision','reason']
  WHEN 'RELEASE' THEN ARRAY['id','leaseToken'] ELSE ARRAY[]::text[] END;
 IF ARRAY(SELECT jsonb_object_keys(d) ORDER BY 1)<>ARRAY(SELECT unnest(expected) ORDER BY 1) THEN RAISE EXCEPTION 'CONTROL_STORE_UNAVAILABLE';END IF;
 receipt:=jsonb_build_object('applicationId','spendguru','environment','development','projectId','autumn-waterfall-65938876',
  'branchId','br-dry-hall-b294222f','databaseName',current_database(),'runtimeRole',session_user,'schemaDigest',i.schema_digest,'serviceId',i.service_id);
 IF action='DESCRIPTOR' THEN RETURN receipt||jsonb_build_object('enabled',i.enabled);END IF;
 -- Every writer and claimant takes the same lock first, avoiding deadlocks and
 -- preventing another incident from replacing an unreconciled external action.
 SELECT * INTO l FROM repository_lock WHERE singleton FOR UPDATE;
 IF action='PURGE' THEN
  DELETE FROM events e USING incidents q WHERE e.incident_id=q.id AND q.expires_at<=clock_timestamp()
   AND q.record->>'status'=ANY(terminal) AND q.record->'pending'='null'::jsonb AND q.id IS DISTINCT FROM l.incident_id;
  DELETE FROM incidents q WHERE q.expires_at<=clock_timestamp() AND q.record->>'status'=ANY(terminal)
   AND q.record->'pending'='null'::jsonb AND q.id IS DISTINCT FROM l.incident_id;
  RETURN receipt||jsonb_build_object('status','PURGED');
 END IF;
 IF action='LIST_DUE' THEN
  IF l.incident_id IS NOT NULL THEN
   due:=jsonb_build_array(l.incident_id);
  ELSE
   SELECT coalesce(jsonb_agg(q.id ORDER BY q.created_at),'[]'::jsonb) INTO due FROM
    (SELECT id,created_at FROM incidents WHERE NOT(record->>'status'=ANY(terminal)) AND (record->>'wakeAt')::bigint<=ms ORDER BY created_at LIMIT 20)q;
  END IF;
  RETURN receipt||jsonb_build_object('ids',due);
 END IF;
 IF action='CREATE' THEN
  v:=d->'record';
  IF NOT i.enabled OR NOT valid_metadata(v) OR octet_length(v::text)>16384
   OR ARRAY(SELECT jsonb_object_keys(v) ORDER BY 1)<>ARRAY(SELECT unnest(ARRAY['id','revision','status','repairClass','causeFingerprint','baseSha','attemptsUsed','rollbacksUsed','pending','wakeAt']) ORDER BY 1)
   OR v->>'revision' IS DISTINCT FROM '1' OR v->>'status' IS DISTINCT FROM 'OBSERVED'
   OR coalesce(v->>'repairClass','') NOT IN('C1','C2','C3') OR coalesce(v->>'causeFingerprint','')!~'^[a-f0-9]{64}$'
   OR coalesce(v->>'baseSha','')!~'^[a-f0-9]{40}$' OR v->>'attemptsUsed' IS DISTINCT FROM '0' OR v->>'rollbacksUsed' IS DISTINCT FROM '0'
   OR v->'pending' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'CONTROL_RECORD_INVALID';END IF;
  SELECT * INTO n FROM incidents WHERE id=(v->>'id')::uuid;
  IF NOT FOUND THEN
   SELECT * INTO n FROM incidents WHERE record->>'repairClass'=v->>'repairClass' AND record->>'causeFingerprint'=v->>'causeFingerprint';
  END IF;
  IF FOUND THEN
   IF n.record->>'repairClass' IS DISTINCT FROM v->>'repairClass' OR n.record->>'causeFingerprint' IS DISTINCT FROM v->>'causeFingerprint'
    THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;
  ELSE
   IF EXISTS(SELECT 1 FROM class_suspensions WHERE repair_class=v->>'repairClass') THEN RAISE EXCEPTION 'CLASS_SUSPENDED';END IF;
   INSERT INTO incidents(id,record)VALUES((v->>'id')::uuid,v)RETURNING * INTO n;
   INSERT INTO events(incident_id,revision,action,status)VALUES(n.id,n.revision,'CREATE','OBSERVED');
  END IF;
  RETURN receipt||jsonb_build_object('record',n.record);
 END IF;
 SELECT * INTO n FROM incidents WHERE id=(d->>'id')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CONTROL_RECORD_MISSING';END IF;
 IF action='RELEASE' THEN
  IF l.incident_id=n.id AND l.lease_token=(d->>'leaseToken')::uuid THEN
   UPDATE repository_lock SET lease_until=clock_timestamp(),lease_token=NULL,worker_id=NULL,
    incident_id=CASE WHEN n.record->'pending'='null'::jsonb THEN NULL ELSE n.id END WHERE singleton;
  END IF;RETURN receipt||jsonb_build_object('status','RELEASED');
 END IF;
 IF action='CLAIM' THEN
  IF coalesce((d->>'leaseMs')::integer,0)<>30000 OR coalesce(d->>'workerId','')!~'^[a-zA-Z0-9_.:-]{1,128}$' THEN RAISE EXCEPTION 'CONTROL_RECORD_INVALID';END IF;
  IF l.lease_token IS NOT NULL AND l.lease_until>clock_timestamp() OR l.incident_id IS NOT NULL AND l.incident_id<>n.id
  THEN RETURN receipt||jsonb_build_object('status','BUSY');END IF;
  token:=gen_random_uuid();
  UPDATE repository_lock SET incident_id=n.id,lease_token=token,worker_id=d->>'workerId',lease_until=clock_timestamp()+interval '30 seconds' WHERE singleton;
  RETURN receipt||jsonb_build_object('record',n.record,'leaseToken',token);
 END IF;
 IF l.incident_id IS DISTINCT FROM n.id OR l.lease_token IS DISTINCT FROM (d->>'leaseToken')::uuid OR l.lease_until<=clock_timestamp()
 THEN RAISE EXCEPTION 'LEASE_LOST';END IF;
 IF n.revision IS DISTINCT FROM (d->>'revision')::bigint THEN RAISE EXCEPTION 'LEASE_LOST';END IF;
 v:=n.record;next_revision:=n.revision+1;
 IF action='PREPARE' THEN
  v_action:=d->>'actionName';
  IF v->'pending' IS DISTINCT FROM 'null'::jsonb OR (NOT i.enabled OR n.expires_at<=clock_timestamp()
   OR EXISTS(SELECT 1 FROM class_suspensions WHERE repair_class=v->>'repairClass')) AND v_action NOT IN('ROLLBACK','OBSERVE')
   THEN RAISE EXCEPTION 'CONTROL_RECORD_INVALID';END IF;
  expected_action:=CASE
   WHEN (v->>'rollbackRequired')::boolean THEN 'ROLLBACK'
   WHEN v->>'status'='OBSERVED' THEN 'QUALIFY' WHEN v->>'status'='TRIAGED' THEN 'REPRODUCE'
   WHEN v->>'status'='REPRODUCED' THEN 'EXECUTE' WHEN v->>'status'='PATCH_READY' THEN 'VERIFY'
   WHEN v->>'status'='VERIFIED' THEN CASE WHEN v->'pr' IS NULL OR v->'pr'='null'::jsonb THEN 'PROPOSE'
    WHEN v->'checks' IS NULL OR v->'checks'='null'::jsonb THEN 'CHECKS' ELSE 'PROMOTE' END
   WHEN v->>'status'='RELEASED' THEN 'VERIFY_RUNTIME' WHEN v->>'status'='OBSERVING' THEN 'OBSERVE' ELSE 'NONE' END;
  IF coalesce(v_action,'') IS DISTINCT FROM expected_action THEN RAISE EXCEPTION 'CONTROL_RECORD_INVALID';END IF;
  IF v_action='PROMOTE' AND l.last_release_at>clock_timestamp()-interval '24 hours' THEN
   RETURN receipt||jsonb_build_object('waitUntil',floor(extract(epoch FROM l.last_release_at+interval '24 hours')*1000));
  END IF;
  IF v_action='EXECUTE' THEN
   IF (v->>'attemptsUsed')::integer>=2 THEN RAISE EXCEPTION 'ATTEMPTS_EXHAUSTED';END IF;
   v:=v||jsonb_build_object('attemptsUsed',(v->>'attemptsUsed')::integer+1);
  END IF;
  IF v_action='ROLLBACK' THEN
   IF (v->>'rollbacksUsed')::integer<>0 THEN RAISE EXCEPTION 'ROLLBACK_ALREADY_ATTEMPTED';END IF;
   v:=v||jsonb_build_object('rollbacksUsed',1);
  END IF;
  v:=v||jsonb_build_object('pending',jsonb_build_object('action',v_action,'nonce',(d->>'nonce')::uuid));
 ELSIF action='RECORD_EXTERNAL' THEN
  IF v->'pending'->>'nonce' IS DISTINCT FROM d->>'nonce' OR length(coalesce(d->>'externalId','')) NOT BETWEEN 1 AND 256 OR coalesce(d->>'externalId','')!~'^[a-zA-Z0-9_.:-]+$'
   OR v->'pending' ? 'externalId' AND v->'pending'->>'externalId' IS DISTINCT FROM d->>'externalId' THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;
  v:=jsonb_set(v,'{pending,externalId}',d->'externalId');
 ELSIF action='STOP' THEN
  IF coalesce(d->>'status','') NOT IN('OUT_OF_SCOPE','BUDGET_STOP','NEEDS_TECHNICAL_REVIEW') OR coalesce(d->>'reason','')!~'^[A-Z][A-Z0-9_]{0,79}$' THEN RAISE EXCEPTION 'CONTROL_RECORD_INVALID';END IF;
  v:=v||jsonb_build_object('status',d->>'status','reason',d->>'reason');
 ELSIF action='CONTAIN' THEN
  IF v->'release' IS NULL OR v->'release'='null'::jsonb OR v->'pending' IS DISTINCT FROM 'null'::jsonb
   OR coalesce(d->>'reason','') NOT IN('LIMIT_EXCEEDED','AUTHORITY_REVOKED','MANDATE_EXPIRED','CONTROL_FAILURE') THEN RAISE EXCEPTION 'CONTROL_RECORD_INVALID';END IF;
  v:=v||jsonb_build_object('status','OBSERVING','classSuspended',true,'reason',d->>'reason','wakeAt',ms+60000);
 ELSE
  IF v->'pending'->>'nonce' IS DISTINCT FROM d->>'nonce' OR v->'pending' IS NULL OR v->'pending'='null'::jsonb THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;
  v:=d->'record';
  IF NOT valid_metadata(v) OR octet_length(v::text)>16384 OR v->'pending' IS DISTINCT FROM 'null'::jsonb
   OR (v-'baseSha'-'revision'-'status'-'pending'-'wakeAt'-'lastResult'-'reason'-'checks'-'reproduction'-'patch'-'verification'-'pr'-'release'-'observingUntil'-'rollbackRequired'-'runtimeProof'-'rollbackProof'-'classSuspended')
    IS DISTINCT FROM (n.record-'baseSha'-'revision'-'status'-'pending'-'wakeAt'-'lastResult'-'reason'-'checks'-'reproduction'-'patch'-'verification'-'pr'-'release'-'observingUntil'-'rollbackRequired'-'runtimeProof'-'rollbackProof'-'classSuspended')
   OR coalesce(v->>'baseSha','')!~'^[a-f0-9]{40}$' OR v->>'baseSha' IS DISTINCT FROM n.record->>'baseSha' AND n.record->'pending'->>'action'<>'PROMOTE'
   OR coalesce(v->>'status','') NOT IN('OBSERVED','TRIAGED','REPRODUCED','PATCH_READY','VERIFIED','RELEASED','OBSERVING','CLOSED','INSUFFICIENT_EVIDENCE','OUT_OF_SCOPE','BUDGET_STOP','ROLLED_BACK','NEEDS_TECHNICAL_REVIEW')
   THEN RAISE EXCEPTION 'CONTROL_RECORD_INVALID';END IF;
  IF n.record->'pending'->>'action'='PROMOTE' AND v->>'status'='RELEASED' THEN
   UPDATE repository_lock SET last_release_at=clock_timestamp() WHERE singleton;
  END IF;
 END IF;
 v:=v||jsonb_build_object('revision',next_revision);
 IF (v->>'classSuspended')::boolean THEN
  INSERT INTO class_suspensions(repair_class)VALUES(v->>'repairClass')ON CONFLICT DO NOTHING;
 END IF;
 UPDATE incidents SET record=v,revision=next_revision WHERE id=n.id;
 INSERT INTO events(incident_id,revision,action,nonce,status)VALUES(n.id,next_revision,action,(d->>'nonce')::uuid,v->>'status');
 RETURN receipt||jsonb_build_object('record',v);
END $fn$;
REVOKE ALL ON FUNCTION sg2_assistant_quality_control.apply(text,text) FROM PUBLIC;
GRANT USAGE ON SCHEMA sg2_assistant_quality_control TO sg2_assistant_quality_controller;
GRANT EXECUTE ON FUNCTION sg2_assistant_quality_control.apply(text,text) TO sg2_assistant_quality_controller;
