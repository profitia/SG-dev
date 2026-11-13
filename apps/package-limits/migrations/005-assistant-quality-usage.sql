-- Source plan only. Install transactionally as the existing Limits owner after
-- exact-source review. No enabling row, credential, grant or pilot is seeded.
DO $guard$ BEGIN
 IF current_user<>'profitia_limits_owner' OR current_database()<>'neondb'
 OR NOT EXISTS(SELECT 1 FROM profitia_limits.installation WHERE singleton AND environment='development'
  AND project_id='lingering-thunder-05075810' AND branch_id='br-green-hall-b9s837k0' AND database_name=current_database())
 OR to_regclass('profitia_limits.assistant_executions') IS NULL
 THEN RAISE EXCEPTION 'LIMITS_DEVELOPMENT_OWNER_REQUIRED';END IF;
 IF (SELECT count(*) FROM pg_roles WHERE rolname IN('profitia_limits_quality_controller','profitia_limits_quality_broker','profitia_limits_quality_capture')
  AND rolcanlogin AND NOT(rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolinherit))<>3
 OR EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member
  WHERE r.rolname IN('profitia_limits_quality_controller','profitia_limits_quality_broker','profitia_limits_quality_capture'))
 THEN RAISE EXCEPTION 'ORDINARY_QUALITY_ROLES_REQUIRED';END IF;
END $guard$;

CREATE TABLE profitia_limits.quality_installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 schema_digest text NOT NULL CHECK(schema_digest='__QUALITY_USAGE_SCHEMA_DIGEST__'),
 service_id uuid NOT NULL,enabled boolean NOT NULL DEFAULT false,
 gate_set_sha256 text NOT NULL CHECK(gate_set_sha256 ~ '^[a-f0-9]{64}$'),
 authorised_until timestamptz NOT NULL,
 pilot_started_at timestamptz,pilot_expires_at timestamptz,
 test_account_id uuid NOT NULL,test_organisation_id uuid NOT NULL,
 source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 1024),
 CHECK((pilot_started_at IS NULL)=(pilot_expires_at IS NULL)),
 CHECK(pilot_expires_at=pilot_started_at+interval '336 hours')
);
CREATE TABLE profitia_limits.quality_credentials(
 role_name name PRIMARY KEY CHECK(role_name IN('profitia_limits_quality_controller','profitia_limits_quality_broker','profitia_limits_quality_capture')),
 service_id uuid NOT NULL,command_key bytea NOT NULL CHECK(octet_length(command_key)=32)
);
CREATE TABLE profitia_limits.quality_incidents(
 incident_id uuid PRIMARY KEY,repair_class text NOT NULL CHECK(repair_class IN('C1','C2','C3')),
 cause_fingerprint text NOT NULL CHECK(cause_fingerprint ~ '^[a-f0-9]{64}$'),
 maximum_nano_usd bigint NOT NULL DEFAULT 5000000000 CHECK(maximum_nano_usd=5000000000),
 acceptance_nano_usd bigint NOT NULL DEFAULT 1000000000 CHECK(acceptance_nano_usd=1000000000),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),closed_at timestamptz,
 UNIQUE(repair_class,cause_fingerprint)
);
CREATE TABLE profitia_limits.quality_attempts(
 attempt_id uuid PRIMARY KEY,incident_id uuid NOT NULL REFERENCES profitia_limits.quality_incidents,
 permit_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),ordinal integer NOT NULL CHECK(ordinal IN(1,2)),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),expires_at timestamptz NOT NULL,
 stopped_at timestamptz,
 executor_run_id text,executor_run_attempt integer,executor_nonce uuid,executor_source_sha text,
 UNIQUE(incident_id,ordinal),CHECK(expires_at>created_at AND expires_at<=created_at+interval '30 minutes')
);
-- Expiry alone never proves that an executor stopped. The controller closes it
-- only after independently confirmed termination, including on cancellation.
CREATE UNIQUE INDEX quality_single_executor ON profitia_limits.quality_attempts((true)) WHERE stopped_at IS NULL;
CREATE TABLE profitia_limits.quality_requests(
 request_id uuid PRIMARY KEY,incident_id uuid NOT NULL REFERENCES profitia_limits.quality_incidents,
 attempt_id uuid REFERENCES profitia_limits.quality_attempts,
 assistant_execution_id uuid UNIQUE REFERENCES profitia_limits.assistant_executions,
 input_digest text NOT NULL CHECK(input_digest ~ '^[a-f0-9]{64}$'),
 input_bound integer NOT NULL CHECK(input_bound BETWEEN 1 AND 200000),
 output_bound integer NOT NULL CHECK(output_bound BETWEEN 1 AND 8192),
 maximum_nano_usd bigint NOT NULL CHECK(maximum_nano_usd BETWEEN 1 AND 5000000000),
 status text NOT NULL CHECK(status IN('RESERVED','DISPATCHED','SETTLED','PENDING_RECONCILIATION','RELEASED')),
 usage jsonb,settlement_digest text,reason text,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK((attempt_id IS NULL)<>(assistant_execution_id IS NULL)),
 CHECK((status='SETTLED')=(usage IS NOT NULL)),UNIQUE(attempt_id,input_digest)
);
CREATE TABLE profitia_limits.quality_usage_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,action text NOT NULL,incident_id uuid,attempt_id uuid,request_id uuid,
 status text NOT NULL,recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TRIGGER quality_usage_events_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON profitia_limits.quality_usage_events
 FOR EACH STATEMENT EXECUTE FUNCTION profitia_limits.immutable_history();

DO $rls$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['quality_installation','quality_credentials','quality_incidents','quality_attempts','quality_requests','quality_usage_events'] LOOP
  EXECUTE format('ALTER TABLE profitia_limits.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE profitia_limits.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY controlled_owner ON profitia_limits.%I TO profitia_limits_owner USING(true) WITH CHECK(true)',t);
  EXECUTE format('REVOKE ALL ON profitia_limits.%I FROM PUBLIC,profitia_limits_quality_controller,profitia_limits_quality_broker,profitia_limits_quality_capture',t);
 END LOOP;
END $rls$;

CREATE FUNCTION profitia_limits.quality_usage(p_json text,p_proof text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_limits,pg_temp AS $fn$
DECLARE d jsonb;i quality_installation%ROWTYPE;k quality_credentials%ROWTYPE;
 n quality_incidents%ROWTYPE;a quality_attempts%ROWTYPE;r quality_requests%ROWTYPE;
 e assistant_executions%ROWTYPE;p assistant_policy%ROWTYPE;
 action text;expected text[];receipt jsonb;status text;spending boolean;
 committed numeric;used numeric;v_input bigint;v_output bigint;v_cost bigint;
 u jsonb;metric text;cached bigint;w30 bigint;w12 bigint;reasoning bigint;actual bigint;udigest text;
BEGIN
 IF session_user NOT IN('profitia_limits_quality_controller','profitia_limits_quality_broker','profitia_limits_quality_capture')
 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=session_user AND (NOT rolcanlogin OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolinherit))
 OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=session_user))
 OR NOT EXISTS(SELECT 1 FROM installation WHERE singleton AND environment='development' AND database_name=current_database()
  AND project_id='lingering-thunder-05075810' AND branch_id='br-green-hall-b9s837k0')
 OR p_json IS NULL OR octet_length(p_json)>16384 THEN RAISE EXCEPTION 'POLICY_UNAVAILABLE';END IF;
 -- This one row serialises all roles, holds and settlements across processes.
 SELECT * INTO i FROM quality_installation WHERE singleton FOR UPDATE;
 SELECT * INTO k FROM quality_credentials WHERE role_name=session_user;
 IF i.schema_digest IS DISTINCT FROM '__QUALITY_USAGE_SCHEMA_DIGEST__' OR k.service_id IS DISTINCT FROM i.service_id
 OR k.command_key IS NULL OR p_proof IS DISTINCT FROM encode(public.hmac(convert_to(p_json,'UTF8'),k.command_key,'sha256'),'hex')
 THEN RAISE EXCEPTION 'POLICY_UNAVAILABLE';END IF;
 d:=p_json::jsonb;action:=d->>'action';
 IF jsonb_typeof(d) IS DISTINCT FROM 'object' OR d->>'contract' IS DISTINCT FROM 'QualityUsage/1.0.0'
 OR d->>'schemaDigest' IS DISTINCT FROM i.schema_digest OR (d->>'serviceId')::uuid IS DISTINCT FROM i.service_id
 OR coalesce((d->>'until')::bigint,0)<=floor(extract(epoch FROM clock_timestamp())*1000)
 OR (d->>'until')::bigint>floor(extract(epoch FROM clock_timestamp())*1000)+10000
 THEN RAISE EXCEPTION 'POLICY_UNAVAILABLE';END IF;
 IF session_user='profitia_limits_quality_controller' AND action NOT IN('STATUS','HOLD_INCIDENT','OPEN_ATTEMPT','CLOSE_ATTEMPT','CLOSE_INCIDENT')
 OR session_user='profitia_limits_quality_broker' AND action NOT IN('CLAIM_EXECUTOR','CHECK_PERMIT','RESERVE_REQUEST','DISPATCH_REQUEST','SETTLE_REQUEST','UNKNOWN_REQUEST','RELEASE_REQUEST')
 OR session_user='profitia_limits_quality_capture' AND action NOT IN('RESERVE_ASSISTANT','RECONCILE_ASSISTANT')
 OR action IS NULL THEN RAISE EXCEPTION 'POLICY_UNAVAILABLE';END IF;
 expected:=ARRAY['contract','action','serviceId','schemaDigest','until']||CASE action
  WHEN 'STATUS' THEN ARRAY[]::text[]
  WHEN 'HOLD_INCIDENT' THEN ARRAY['incidentId','repairClass','causeFingerprint','maximumNanoUsd','acceptanceNanoUsd']
  WHEN 'OPEN_ATTEMPT' THEN ARRAY['incidentId','attemptId','ordinal','expiresAt']
  WHEN 'CLOSE_ATTEMPT' THEN ARRAY['incidentId','attemptId','stoppedProofSha256']
  WHEN 'CLOSE_INCIDENT' THEN ARRAY['incidentId']
  WHEN 'CHECK_PERMIT' THEN ARRAY['permitId']
  WHEN 'CLAIM_EXECUTOR' THEN ARRAY['permitId','runId','runAttempt','executorSourceSha','gateSetSha256','nonce']
  WHEN 'RESERVE_REQUEST' THEN ARRAY['permitId','requestId','inputDigest','model','pricingVersion','inputTokens','outputTokens','maximumNanoUsd']
  WHEN 'DISPATCH_REQUEST' THEN ARRAY['requestId','inputDigest']
  WHEN 'SETTLE_REQUEST' THEN ARRAY['requestId','usage']
  WHEN 'UNKNOWN_REQUEST' THEN ARRAY['requestId','reason']
  WHEN 'RELEASE_REQUEST' THEN ARRAY['requestId']
  ELSE ARRAY['incidentId','executionId'] END;
 IF ARRAY(SELECT jsonb_object_keys(d) ORDER BY 1)<>ARRAY(SELECT unnest(expected) ORDER BY 1) THEN RAISE EXCEPTION 'POLICY_UNAVAILABLE';END IF;
 receipt:=jsonb_build_object('applicationId','spendguru','environment','development','projectId','lingering-thunder-05075810',
  'branchId','br-green-hall-b9s837k0','databaseName',current_database(),'runtimeRole',session_user,'schemaDigest',i.schema_digest,'serviceId',i.service_id);
 spending:=action IN('HOLD_INCIDENT','OPEN_ATTEMPT','CLAIM_EXECUTOR','CHECK_PERMIT','RESERVE_REQUEST','DISPATCH_REQUEST','RESERVE_ASSISTANT');
 IF spending AND (NOT i.enabled OR i.authorised_until<=clock_timestamp() OR i.pilot_expires_at<=clock_timestamp())
 THEN RAISE EXCEPTION 'LIMIT_EXCEEDED';END IF;

 IF action='STATUS' THEN
  SELECT coalesce(sum(CASE WHEN q.closed_at IS NULL THEN q.maximum_nano_usd ELSE
   coalesce((SELECT sum(CASE WHEN z.status='SETTLED' THEN (z.usage->>'nanoUsd')::bigint ELSE z.maximum_nano_usd END)
    FROM quality_requests z WHERE z.incident_id=q.incident_id AND z.status<>'RELEASED'),0) END),0) INTO committed FROM quality_incidents q;
  RETURN receipt||jsonb_build_object('status',CASE WHEN i.enabled THEN 'ENABLED' ELSE 'DISABLED' END,
   'committedNanoUsd',committed::text,'maximumNanoUsd','50000000000','pilotStartedAt',i.pilot_started_at,'pilotExpiresAt',i.pilot_expires_at);
 END IF;

 IF action='HOLD_INCIDENT' THEN
  IF d->>'repairClass' NOT IN('C1','C2','C3') OR coalesce(d->>'causeFingerprint','')!~'^[a-f0-9]{64}$'
  OR d->>'maximumNanoUsd' IS DISTINCT FROM '5000000000' OR d->>'acceptanceNanoUsd' IS DISTINCT FROM '1000000000'
  THEN RAISE EXCEPTION 'POLICY_UNAVAILABLE';END IF;
  SELECT * INTO n FROM quality_incidents WHERE incident_id=(d->>'incidentId')::uuid;
  IF FOUND THEN
   IF n.repair_class<>d->>'repairClass' OR n.cause_fingerprint<>d->>'causeFingerprint' OR n.closed_at IS NOT NULL THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;
   status:='REPLAY';
  ELSE
   IF EXISTS(SELECT 1 FROM quality_incidents WHERE repair_class=d->>'repairClass' AND cause_fingerprint=d->>'causeFingerprint') THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;
   SELECT coalesce(sum(CASE WHEN q.closed_at IS NULL THEN q.maximum_nano_usd ELSE
    coalesce((SELECT sum(CASE WHEN z.status='SETTLED' THEN (z.usage->>'nanoUsd')::bigint ELSE z.maximum_nano_usd END)
     FROM quality_requests z WHERE z.incident_id=q.incident_id AND z.status<>'RELEASED'),0) END),0) INTO committed FROM quality_incidents q;
   IF committed+5000000000>50000000000 THEN RAISE EXCEPTION 'LIMIT_EXCEEDED';END IF;
   INSERT INTO quality_incidents(incident_id,repair_class,cause_fingerprint)VALUES((d->>'incidentId')::uuid,d->>'repairClass',d->>'causeFingerprint') RETURNING * INTO n;
   status:='HELD';
  END IF;
  receipt:=receipt||jsonb_build_object('maximumNanoUsd',n.maximum_nano_usd::text,'acceptanceNanoUsd',n.acceptance_nano_usd::text);
 ELSIF action IN('OPEN_ATTEMPT','CLOSE_ATTEMPT','CLOSE_INCIDENT','RESERVE_ASSISTANT','RECONCILE_ASSISTANT') THEN
  SELECT * INTO n FROM quality_incidents WHERE incident_id=(d->>'incidentId')::uuid;
  IF NOT FOUND OR spending AND n.closed_at IS NOT NULL THEN RAISE EXCEPTION 'POLICY_UNAVAILABLE';END IF;
  IF action='OPEN_ATTEMPT' THEN
   SELECT * INTO a FROM quality_attempts WHERE attempt_id=(d->>'attemptId')::uuid;
   IF FOUND THEN
    IF a.incident_id<>n.incident_id OR a.ordinal<>(d->>'ordinal')::integer OR a.expires_at<>(d->>'expiresAt')::timestamptz OR a.stopped_at IS NOT NULL THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;
   ELSE
    IF coalesce((d->>'ordinal')::integer,0)<>1+(SELECT count(*) FROM quality_attempts WHERE incident_id=n.incident_id)
    OR (d->>'ordinal')::integer NOT IN(1,2) THEN RAISE EXCEPTION 'ATTEMPTS_EXHAUSTED';END IF;
    IF EXISTS(SELECT 1 FROM quality_attempts WHERE stopped_at IS NULL) THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;
    IF (d->>'expiresAt')::timestamptz>least(clock_timestamp()+interval '30 minutes',i.authorised_until,coalesce(i.pilot_expires_at,'infinity'::timestamptz))
    OR (d->>'expiresAt')::timestamptz<=clock_timestamp() THEN RAISE EXCEPTION 'POLICY_UNAVAILABLE';END IF;
    INSERT INTO quality_attempts(attempt_id,incident_id,ordinal,expires_at)VALUES((d->>'attemptId')::uuid,n.incident_id,(d->>'ordinal')::integer,(d->>'expiresAt')::timestamptz)RETURNING * INTO a;
   END IF;
   status:='ACTIVE';receipt:=receipt||jsonb_build_object('permitId',a.permit_id,'ordinal',a.ordinal,'expiresAt',a.expires_at);
  ELSIF action='CLOSE_ATTEMPT' THEN
   IF coalesce(d->>'stoppedProofSha256','')!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'POLICY_UNAVAILABLE';END IF;
   UPDATE quality_attempts SET stopped_at=coalesce(stopped_at,clock_timestamp()) WHERE attempt_id=(d->>'attemptId')::uuid AND incident_id=n.incident_id RETURNING * INTO a;
   IF NOT FOUND THEN RAISE EXCEPTION 'POLICY_UNAVAILABLE';END IF;status:='STOPPED';
  ELSIF action='CLOSE_INCIDENT' THEN
   IF EXISTS(SELECT 1 FROM quality_attempts WHERE incident_id=n.incident_id AND stopped_at IS NULL)
    OR EXISTS(SELECT 1 FROM quality_requests q WHERE q.incident_id=n.incident_id AND q.status='RESERVED') THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;
   UPDATE quality_incidents SET closed_at=coalesce(closed_at,clock_timestamp()) WHERE incident_id=n.incident_id;status:='CLOSED';
  ELSE
   SELECT * INTO e FROM assistant_executions WHERE execution_id=(d->>'executionId')::uuid FOR SHARE;
   SELECT * INTO p FROM assistant_policy WHERE singleton FOR SHARE;
   IF e.execution_id IS NULL OR e.actor_id IS DISTINCT FROM i.test_account_id OR e.organisation_id IS DISTINCT FROM i.test_organisation_id
    OR p.actor_id IS DISTINCT FROM i.test_account_id OR p.organisation_id IS DISTINCT FROM i.test_organisation_id
    OR p.policy_id IS DISTINCT FROM e.policy_id OR p.version IS DISTINCT FROM e.policy_version
    OR p.assignment_id IS DISTINCT FROM e.assignment_id OR p.assignment_revision IS DISTINCT FROM e.assignment_revision
    OR NOT p.enabled THEN RAISE EXCEPTION 'POLICY_UNAVAILABLE';END IF;
   SELECT * INTO r FROM quality_requests WHERE assistant_execution_id=e.execution_id;
   IF action='RESERVE_ASSISTANT' THEN
    IF FOUND THEN
     IF r.incident_id<>n.incident_id THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;status:='REPLAY';
    ELSE
     IF e.status<>'RESERVED' OR e.dispatch_before<=clock_timestamp() OR e.reserved_nano_usd>500000000 THEN RAISE EXCEPTION 'POLICY_UNAVAILABLE';END IF;
     SELECT coalesce(sum(CASE WHEN q.status='SETTLED' THEN (q.usage->>'nanoUsd')::bigint ELSE q.maximum_nano_usd END),0) INTO used
      FROM quality_requests q WHERE q.incident_id=n.incident_id AND q.assistant_execution_id IS NOT NULL AND q.status<>'RELEASED';
     IF used+e.reserved_nano_usd>n.acceptance_nano_usd THEN RAISE EXCEPTION 'LIMIT_EXCEEDED';END IF;
     -- Reserve before the existing product DISPATCH, without replacing its
     -- actor, entitlement, product limit or original usage receipt.
     INSERT INTO quality_requests(request_id,incident_id,assistant_execution_id,input_digest,input_bound,output_bound,maximum_nano_usd,status)
      VALUES(e.execution_id,n.incident_id,e.execution_id,e.input_digest,e.input_bound,e.output_bound,e.reserved_nano_usd,'DISPATCHED') RETURNING * INTO r;
     status:='DISPATCHED';
    END IF;
    IF i.pilot_started_at IS NULL THEN
     UPDATE quality_installation SET pilot_started_at=statement_timestamp(),pilot_expires_at=statement_timestamp()+interval '336 hours' WHERE singleton;
    END IF;
   ELSE
    IF r.request_id IS NULL OR r.incident_id<>n.incident_id THEN RAISE EXCEPTION 'POLICY_UNAVAILABLE';END IF;
    IF e.status='SETTLED' AND (e.usage->>'nanoUsd')::bigint BETWEEN 0 AND r.maximum_nano_usd THEN
     UPDATE quality_requests SET status='SETTLED',usage=jsonb_build_object('nanoUsd',e.usage->>'nanoUsd'),updated_at=clock_timestamp() WHERE request_id=r.request_id RETURNING * INTO r;
    ELSIF e.status='RELEASED' THEN
     UPDATE quality_requests SET status='RELEASED',updated_at=clock_timestamp() WHERE request_id=r.request_id RETURNING * INTO r;
    ELSE
     IF r.status NOT IN('SETTLED','RELEASED') THEN
      UPDATE quality_requests SET status='PENDING_RECONCILIATION',updated_at=clock_timestamp() WHERE request_id=r.request_id RETURNING * INTO r;
     END IF;
    END IF;status:=r.status;
   END IF;
   receipt:=receipt||jsonb_build_object('executionId',e.execution_id);
  END IF;
 ELSE
  IF action IN('CLAIM_EXECUTOR','CHECK_PERMIT','RESERVE_REQUEST') THEN
   SELECT * INTO a FROM quality_attempts WHERE permit_id=(d->>'permitId')::uuid;
  ELSE
   SELECT * INTO r FROM quality_requests WHERE request_id=(d->>'requestId')::uuid AND attempt_id IS NOT NULL;
   SELECT * INTO a FROM quality_attempts WHERE attempt_id=r.attempt_id;
  END IF;
  SELECT * INTO n FROM quality_incidents WHERE incident_id=a.incident_id;
  IF a.attempt_id IS NULL OR n.incident_id IS NULL THEN RAISE EXCEPTION 'POLICY_UNAVAILABLE';END IF;
  IF spending AND (n.closed_at IS NOT NULL OR a.stopped_at IS NOT NULL OR a.expires_at<=clock_timestamp()) THEN RAISE EXCEPTION 'POLICY_UNAVAILABLE';END IF;
  IF action='CLAIM_EXECUTOR' THEN
   IF a.executor_run_id IS NOT NULL THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;
   IF coalesce(d->>'runId','')!~'^[1-9][0-9]{0,19}$' OR (d->>'runAttempt')::integer IS DISTINCT FROM 1
    OR coalesce(d->>'executorSourceSha','')!~'^[a-f0-9]{40}$' OR d->>'gateSetSha256' IS DISTINCT FROM i.gate_set_sha256
    OR (d->>'nonce')::uuid IS NULL THEN RAISE EXCEPTION 'POLICY_UNAVAILABLE';END IF;
   UPDATE quality_attempts SET executor_run_id=d->>'runId',executor_run_attempt=1,executor_nonce=(d->>'nonce')::uuid,executor_source_sha=d->>'executorSourceSha' WHERE attempt_id=a.attempt_id;
   RETURN receipt||jsonb_build_object('status','CLAIMED','permitId',a.permit_id,'incidentId',n.incident_id,'attemptId',a.attempt_id,'runId',d->>'runId');
  END IF;
  IF a.executor_run_id IS NULL THEN RAISE EXCEPTION 'POLICY_UNAVAILABLE';END IF;
  IF action='CHECK_PERMIT' THEN
   RETURN receipt||jsonb_build_object('status','ACTIVE','incidentId',n.incident_id,'attemptId',a.attempt_id,'permitId',a.permit_id,'expiresAt',a.expires_at);
  ELSIF action='RESERVE_REQUEST' THEN
   v_input:=(d->>'inputTokens')::bigint;v_output:=(d->>'outputTokens')::bigint;v_cost:=v_input*5000+v_output*10000;
   IF d->>'model' IS DISTINCT FROM 'gpt-6.1-sol' OR d->>'pricingVersion' IS DISTINCT FROM 'openai-gpt-6.1-sol-standard-20261112'
    OR v_input NOT BETWEEN 1 AND 200000 OR v_output NOT BETWEEN 1 AND 8192 OR (d->>'maximumNanoUsd')::bigint IS DISTINCT FROM v_cost
    OR coalesce(d->>'inputDigest','')!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'POLICY_UNAVAILABLE';END IF;
   SELECT * INTO r FROM quality_requests WHERE request_id=(d->>'requestId')::uuid;
   IF FOUND THEN
    IF r.attempt_id IS DISTINCT FROM a.attempt_id OR r.input_digest<>d->>'inputDigest' OR r.input_bound<>v_input OR r.output_bound<>v_output
     THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;status:='REPLAY';
   ELSE
    IF EXISTS(SELECT 1 FROM quality_requests WHERE attempt_id=a.attempt_id AND input_digest=d->>'inputDigest') THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;
    IF (SELECT count(*) FROM quality_requests WHERE attempt_id=a.attempt_id)>=64 THEN RAISE EXCEPTION 'LIMIT_EXCEEDED';END IF;
    SELECT coalesce(sum(CASE WHEN q.status='SETTLED' THEN (q.usage->>'nanoUsd')::bigint ELSE q.maximum_nano_usd END),0) INTO used
     FROM quality_requests q WHERE q.incident_id=n.incident_id AND q.attempt_id IS NOT NULL AND q.status<>'RELEASED';
    IF used+v_cost>n.maximum_nano_usd-n.acceptance_nano_usd THEN RAISE EXCEPTION 'LIMIT_EXCEEDED';END IF;
    INSERT INTO quality_requests(request_id,incident_id,attempt_id,input_digest,input_bound,output_bound,maximum_nano_usd,status)
     VALUES((d->>'requestId')::uuid,n.incident_id,a.attempt_id,d->>'inputDigest',v_input,v_output,v_cost,'RESERVED') RETURNING * INTO r;status:='RESERVED';
   END IF;
  ELSIF action='DISPATCH_REQUEST' THEN
   IF r.status<>'RESERVED' OR r.input_digest IS DISTINCT FROM d->>'inputDigest' THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;
   UPDATE quality_requests SET status='DISPATCHED',updated_at=clock_timestamp() WHERE request_id=r.request_id RETURNING * INTO r;status:=r.status;
   IF i.pilot_started_at IS NULL THEN
    UPDATE quality_installation SET pilot_started_at=statement_timestamp(),pilot_expires_at=statement_timestamp()+interval '336 hours' WHERE singleton;
   END IF;
  ELSIF action='RELEASE_REQUEST' THEN
   IF r.status<>'RESERVED' THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;
   UPDATE quality_requests SET status='RELEASED',updated_at=clock_timestamp() WHERE request_id=r.request_id RETURNING * INTO r;status:=r.status;
  ELSIF action='UNKNOWN_REQUEST' THEN
   IF d->>'reason' NOT IN('PROVIDER_ERROR','STREAM_INCOMPLETE','CANCELLED','USAGE_UNVERIFIED') OR r.status NOT IN('DISPATCHED','PENDING_RECONCILIATION') THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;
   UPDATE quality_requests SET status='PENDING_RECONCILIATION',reason=d->>'reason',updated_at=clock_timestamp() WHERE request_id=r.request_id RETURNING * INTO r;status:=r.status;
  ELSE
   u:=d->'usage';udigest:=encode(public.digest(convert_to(u::text,'UTF8'),'sha256'),'hex');
   IF r.status='SETTLED' THEN
    IF r.settlement_digest IS DISTINCT FROM udigest THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;
    RETURN receipt||jsonb_build_object('status','SETTLED','requestId',r.request_id);
   END IF;
   IF r.status NOT IN('DISPATCHED','PENDING_RECONCILIATION') OR jsonb_typeof(u) IS DISTINCT FROM 'object'
    OR u->>'model' IS DISTINCT FROM 'gpt-6.1-sol' OR u->>'pricingVersion' IS DISTINCT FROM 'openai-gpt-6.1-sol-standard-20261112'
    OR ARRAY(SELECT jsonb_object_keys(u) ORDER BY 1)<>ARRAY(SELECT unnest(ARRAY['model','pricingVersion','inputTokens','outputTokens','totalTokens','cachedTokens','write30mTokens','write12hTokens','reasoningTokens','nanoUsd']) ORDER BY 1)
    OR coalesce(u->>'nanoUsd','')!~'^(0|[1-9][0-9]{0,12})$' THEN RAISE EXCEPTION 'POLICY_UNAVAILABLE';END IF;
   FOREACH metric IN ARRAY ARRAY['inputTokens','outputTokens','totalTokens','cachedTokens','write30mTokens','write12hTokens','reasoningTokens'] LOOP
    IF jsonb_typeof(u->metric) IS DISTINCT FROM 'number' OR coalesce(u->>metric,'')!~'^(0|[1-9][0-9]{0,6})$' THEN RAISE EXCEPTION 'POLICY_UNAVAILABLE';END IF;
   END LOOP;
   v_input:=(u->>'inputTokens')::bigint;v_output:=(u->>'outputTokens')::bigint;cached:=(u->>'cachedTokens')::bigint;
   w30:=(u->>'write30mTokens')::bigint;w12:=(u->>'write12hTokens')::bigint;reasoning:=(u->>'reasoningTokens')::bigint;
   actual:=(v_input-cached-w30-w12)*2000+cached*100+w30*2500+w12*5000+v_output*10000;
   IF v_input>r.input_bound OR v_output>r.output_bound OR cached+w30+w12>v_input OR reasoning>v_output
    OR (u->>'totalTokens')::bigint<>v_input+v_output OR (u->>'nanoUsd')::bigint<>actual OR actual>r.maximum_nano_usd THEN RAISE EXCEPTION 'POLICY_UNAVAILABLE';END IF;
   UPDATE quality_requests SET status='SETTLED',usage=u,settlement_digest=udigest,updated_at=clock_timestamp() WHERE request_id=r.request_id RETURNING * INTO r;status:=r.status;
  END IF;
 END IF;
 INSERT INTO quality_usage_events(action,incident_id,attempt_id,request_id,status)VALUES(action,n.incident_id,a.attempt_id,r.request_id,status);
 RETURN receipt||jsonb_strip_nulls(jsonb_build_object('status',status,'incidentId',n.incident_id,'attemptId',a.attempt_id,'requestId',r.request_id,
  'inputDigest',r.input_digest,'maximumNanoUsd',r.maximum_nano_usd::text));
END $fn$;
REVOKE ALL ON FUNCTION profitia_limits.quality_usage(text,text) FROM PUBLIC;
GRANT USAGE ON SCHEMA profitia_limits TO profitia_limits_quality_controller,profitia_limits_quality_broker,profitia_limits_quality_capture;
GRANT EXECUTE ON FUNCTION profitia_limits.quality_usage(text,text) TO profitia_limits_quality_controller,profitia_limits_quality_broker,profitia_limits_quality_capture;
