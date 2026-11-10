-- Bounded M1 adapter, installed transactionally by the controlled migrator.
-- Source placeholders are replaced from the exact source digest, never a key.
DO $guard$ BEGIN
 IF current_user<>'profitia_limits_owner' OR current_database()<>'neondb'
 OR NOT EXISTS(SELECT 1 FROM profitia_limits.installation WHERE singleton AND environment='development'
  AND project_id='lingering-thunder-05075810' AND branch_id='br-green-hall-b9s837k0')
 THEN RAISE EXCEPTION 'LIMITS_DEVELOPMENT_OWNER_REQUIRED';END IF;
END $guard$;

CREATE TABLE profitia_limits.assistant_installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 schema_digest text NOT NULL CHECK(schema_digest ~ '^[a-f0-9]{64}$'),
 command_key bytea NOT NULL CHECK(octet_length(command_key)=32),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL CHECK(expires_at<=created_at+interval '7 days' AND expires_at>created_at),
 maximum_nano_usd bigint NOT NULL CHECK(maximum_nano_usd BETWEEN 1 AND 5000000000),
 maximum_tokens bigint NOT NULL CHECK(maximum_tokens BETWEEN 1 AND 200000),
 source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 1024)
);
CREATE TABLE profitia_limits.assistant_policy(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 policy_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 actor_id uuid NOT NULL,organisation_id uuid NOT NULL,
 assignment_id uuid NOT NULL REFERENCES profitia_limits.assignments,
 assignment_revision integer NOT NULL CHECK(assignment_revision>0),enabled boolean NOT NULL DEFAULT false,
 source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 1024)
);
CREATE TABLE profitia_limits.assistant_executions(
 execution_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid NOT NULL,organisation_id uuid NOT NULL,
 command_id uuid NOT NULL,decision_id uuid NOT NULL,policy_id uuid NOT NULL,policy_version bigint NOT NULL,
 assignment_id uuid NOT NULL,assignment_revision integer NOT NULL,
 model text NOT NULL CHECK(model='gpt-5.6-luna'),pricing_version text NOT NULL CHECK(pricing_version='openai-gpt-5.6-luna-standard-20261109'),
 input_digest text NOT NULL CHECK(input_digest ~ '^[a-f0-9]{64}$'),
 input_bound integer NOT NULL CHECK(input_bound BETWEEN 1 AND 100000),
 output_bound integer NOT NULL CHECK(output_bound=2048),
 reserved_nano_usd bigint NOT NULL CHECK(reserved_nano_usd BETWEEN 1 AND 500000000),
 status text NOT NULL CHECK(status IN('RESERVED','DISPATCHED','SETTLED','PENDING_RECONCILIATION','RELEASED')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),dispatch_before timestamptz NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),response_id text UNIQUE,
 usage jsonb,settlement_digest text,reason text,
 UNIQUE(actor_id,organisation_id,command_id),
 CHECK((status='SETTLED')=(usage IS NOT NULL)),
 CHECK(response_id IS NULL OR response_id ~ '^resp_[a-zA-Z0-9_-]{1,160}$')
);
CREATE TABLE profitia_limits.assistant_usage_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,execution_id uuid NOT NULL REFERENCES profitia_limits.assistant_executions,
 event text NOT NULL,metadata jsonb NOT NULL,recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TRIGGER assistant_usage_events_immutable BEFORE UPDATE OR DELETE ON profitia_limits.assistant_usage_events
 FOR EACH ROW EXECUTE FUNCTION profitia_limits.immutable_history();
CREATE TRIGGER assistant_usage_events_no_truncate BEFORE TRUNCATE ON profitia_limits.assistant_usage_events
 FOR EACH STATEMENT EXECUTE FUNCTION profitia_limits.immutable_history();

DO $rls$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['assistant_installation','assistant_policy','assistant_executions','assistant_usage_events'] LOOP
  EXECUTE format('ALTER TABLE profitia_limits.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE profitia_limits.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY controlled_owner ON profitia_limits.%I TO profitia_limits_owner USING(true) WITH CHECK(true)',t);
 END LOOP;
END $rls$;

CREATE FUNCTION profitia_limits.assistant_usage(p_json text,p_proof text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_limits,pg_temp AS $fn$
DECLARE d jsonb;i assistant_installation%ROWTYPE;p assistant_policy%ROWTYPE;a assignments%ROWTYPE;
 e assistant_executions%ROWTYPE;v_action text;v_input integer;v_output integer;v_cost bigint;
 used_cost numeric;used_tokens numeric;receipt jsonb;u jsonb;metric text;limit_value jsonb;consumed numeric;required numeric;
 cached bigint;written bigint;write30 bigint;write12 bigint;reasoning bigint;uncached bigint;usage_digest text;expected_keys text[];
period_start timestamptz;period_end timestamptz;
BEGIN
 IF session_user<>'profitia_limits_assistant_runtime'
 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=session_user AND (NOT rolcanlogin OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolinherit))
 OR pg_has_role(session_user,'profitia_limits_owner','MEMBER')
 OR NOT EXISTS(SELECT 1 FROM installation WHERE singleton AND environment='development'
  AND project_id='lingering-thunder-05075810' AND branch_id='br-green-hall-b9s837k0' AND database_name=current_database())
 OR octet_length(p_json)>16384 THEN RAISE EXCEPTION 'POLICY_UNAVAILABLE';END IF;
 SELECT * INTO i FROM assistant_installation WHERE singleton FOR UPDATE;
 IF NOT FOUND OR i.schema_digest<>'__ASSISTANT_USAGE_SCHEMA_DIGEST__'
 OR p_proof IS NULL OR p_proof<>encode(public.hmac(convert_to(p_json,'UTF8'),i.command_key,'sha256'),'hex')
 THEN RAISE EXCEPTION 'POLICY_UNAVAILABLE';END IF;
 d:=p_json::jsonb;v_action:=d->>'action';
 IF jsonb_typeof(d) IS DISTINCT FROM 'object' OR d->>'contract' IS DISTINCT FROM '1.0.0' OR d->>'schemaDigest' IS DISTINCT FROM i.schema_digest
 OR coalesce((d->>'until')::bigint,0)<=floor(extract(epoch FROM clock_timestamp())*1000)
 OR (d->>'until')::bigint>floor(extract(epoch FROM clock_timestamp())*1000)+10000
 OR v_action NOT IN('RESERVE','DISPATCH','SETTLE','PENDING','RELEASE')
 THEN RAISE EXCEPTION 'POLICY_UNAVAILABLE';END IF;
 expected_keys:=ARRAY['action','contract','schemaDigest','until']||CASE v_action
  WHEN 'RESERVE' THEN ARRAY['actorId','organisationId','commandId','decisionId','model','pricingVersion','inputDigest','inputTokens','outputTokens','nanoUsd','policyId','assignmentId','assignmentRevision']
  WHEN 'SETTLE' THEN ARRAY['executionId','commandId','responseId','usage']
  WHEN 'PENDING' THEN ARRAY['executionId','commandId','reason'] ELSE ARRAY['executionId','commandId'] END;
 IF ARRAY(SELECT jsonb_object_keys(d) ORDER BY 1)<>ARRAY(SELECT unnest(expected_keys) ORDER BY 1)
 THEN RAISE EXCEPTION 'POLICY_UNAVAILABLE';END IF;
 receipt:=jsonb_build_object('environment','development','applicationId','spendguru',
  'projectId','lingering-thunder-05075810','branchId','br-green-hall-b9s837k0','databaseName',current_database(),
  'runtimeRole',session_user,'schemaDigest',i.schema_digest);

 IF v_action='RESERVE' THEN
  SELECT * INTO p FROM assistant_policy WHERE singleton FOR SHARE;
  IF NOT FOUND OR NOT p.enabled OR p.actor_id IS DISTINCT FROM (d->>'actorId')::uuid OR p.organisation_id IS DISTINCT FROM (d->>'organisationId')::uuid
  OR p.policy_id IS DISTINCT FROM (d->>'policyId')::uuid OR p.assignment_id IS DISTINCT FROM (d->>'assignmentId')::uuid OR p.assignment_revision IS DISTINCT FROM (d->>'assignmentRevision')::integer
  OR i.expires_at<=clock_timestamp() OR d->>'model' IS DISTINCT FROM 'gpt-5.6-luna'
  OR d->>'pricingVersion' IS DISTINCT FROM 'openai-gpt-5.6-luna-standard-20261109'
  OR coalesce(d->>'inputDigest','')!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'POLICY_UNAVAILABLE';END IF;
  SELECT * INTO a FROM assignments WHERE id=p.assignment_id FOR SHARE;
  IF NOT FOUND OR a.organisation_id<>p.organisation_id OR a.product_id<>'SPENDGURU' OR a.revision<>p.assignment_revision
  OR a.active_from>clock_timestamp() OR a.active_until<=clock_timestamp() OR status_of(a.payload)<>'ACTIVE'
  OR a.payload->>'status' IS DISTINCT FROM 'ENABLED' OR a.payload->>'commercialState' IS DISTINCT FROM 'OPERATOR_CONFIRMED'
  OR NOT coalesce(a.payload->'packageSnapshot'->'capabilities' ? 'OPENAI_ASSISTANCE',false)
  THEN RAISE EXCEPTION 'POLICY_UNAVAILABLE';END IF;
  v_input:=(d->>'inputTokens')::integer;v_output:=(d->>'outputTokens')::integer;v_cost:=(d->>'nanoUsd')::bigint;
  IF coalesce(v_input,0) NOT BETWEEN 1 AND 100000 OR v_output IS DISTINCT FROM 2048 OR v_cost IS DISTINCT FROM v_input::bigint*500+v_output::bigint*1200
  OR v_cost>500000000 OR (d->>'commandId')::uuid IS NULL OR (d->>'decisionId')::uuid IS NULL THEN RAISE EXCEPTION 'POLICY_UNAVAILABLE';END IF;
  SELECT * INTO e FROM assistant_executions WHERE actor_id=p.actor_id AND organisation_id=p.organisation_id AND command_id=(d->>'commandId')::uuid FOR UPDATE;
  IF FOUND THEN
   IF e.input_digest<>d->>'inputDigest' OR e.model<>d->>'model' OR e.input_bound<>v_input OR e.output_bound<>v_output
   THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;
   RETURN receipt||jsonb_build_object('status','REPLAY','executionId',e.execution_id,'commandId',e.command_id,
    'actorId',e.actor_id,'organisationId',e.organisation_id,'inputDigest',e.input_digest);
  END IF;
  -- Only RESERVE creates new spend. Incomplete/disconnected executions retain
  -- the entire upper bound, including beyond the request/lease deadline.
  SELECT coalesce(sum(CASE WHEN status='SETTLED' THEN (usage->>'nanoUsd')::numeric ELSE reserved_nano_usd END),0),
   coalesce(sum(CASE WHEN status='SETTLED' THEN (usage->>'totalTokens')::numeric ELSE input_bound+output_bound END),0)
   INTO used_cost,used_tokens FROM assistant_executions WHERE status<>'RELEASED';
  IF used_cost+v_cost>i.maximum_nano_usd OR used_tokens+v_input+v_output>i.maximum_tokens THEN RAISE EXCEPTION 'LIMIT_EXCEEDED';END IF;
  -- Preserve the existing commercial assignment and overrides. Pilot bounds
  -- independently cap every token category and cost, including when the
  -- existing licence specifies only total tokens per Warsaw calendar month.
  FOREACH metric IN ARRAY ARRAY['OPENAI_INPUT_TOKENS','OPENAI_OUTPUT_TOKENS','OPENAI_TOTAL_TOKENS','OPENAI_API_COST_USD','OPENAI_CACHED_TOKENS','OPENAI_REASONING_TOKENS','OPENAI_CACHE_WRITE_TOKENS'] LOOP
   SELECT value INTO limit_value FROM jsonb_array_elements(coalesce(a.payload->'overrides','[]'::jsonb)) WHERE value->>'metricId'=metric;
   IF limit_value IS NULL THEN SELECT value INTO limit_value FROM jsonb_array_elements(a.payload->'packageSnapshot'->'limits') WHERE value->>'metricId'=metric;END IF;
   IF limit_value IS NULL AND metric='OPENAI_TOTAL_TOKENS'
    OR limit_value IS NOT NULL AND (coalesce(limit_value->>'mode','') NOT IN('LIMITED','UNMETERED')
     OR limit_value->>'timezone' IS DISTINCT FROM 'Europe/Warsaw'
     OR NOT(coalesce(limit_value->>'period'='CONTRACT' AND limit_value->>'anchor'='ASSIGNMENT',false)
      OR coalesce(limit_value->>'period'='MONTH' AND limit_value->>'anchor'='CALENDAR',false)))
   THEN RAISE EXCEPTION 'POLICY_UNAVAILABLE';END IF;
   period_start:=CASE WHEN limit_value->>'period'='MONTH'
    THEN date_trunc('month',clock_timestamp() AT TIME ZONE 'Europe/Warsaw') AT TIME ZONE 'Europe/Warsaw' ELSE a.active_from END;
   period_end:=CASE WHEN limit_value->>'period'='MONTH'
    THEN (date_trunc('month',clock_timestamp() AT TIME ZONE 'Europe/Warsaw')+interval '1 month') AT TIME ZONE 'Europe/Warsaw' ELSE a.active_until END;
   IF limit_value->>'mode'='LIMITED' THEN
    required:=CASE metric WHEN 'OPENAI_API_COST_USD' THEN v_cost WHEN 'OPENAI_OUTPUT_TOKENS' THEN v_output
     WHEN 'OPENAI_REASONING_TOKENS' THEN v_output WHEN 'OPENAI_TOTAL_TOKENS' THEN v_input+v_output ELSE v_input END;
    SELECT coalesce(sum(CASE WHEN status='SETTLED' THEN CASE metric
     WHEN 'OPENAI_API_COST_USD' THEN (usage->>'nanoUsd')::numeric WHEN 'OPENAI_INPUT_TOKENS' THEN (usage->>'inputTokens')::numeric
     WHEN 'OPENAI_OUTPUT_TOKENS' THEN (usage->>'outputTokens')::numeric WHEN 'OPENAI_TOTAL_TOKENS' THEN (usage->>'totalTokens')::numeric
     WHEN 'OPENAI_CACHED_TOKENS' THEN (usage->>'cachedTokens')::numeric WHEN 'OPENAI_REASONING_TOKENS' THEN (usage->>'reasoningTokens')::numeric
     ELSE (usage->>'cacheWriteTokens')::numeric END ELSE CASE metric WHEN 'OPENAI_API_COST_USD' THEN reserved_nano_usd
     WHEN 'OPENAI_OUTPUT_TOKENS' THEN output_bound WHEN 'OPENAI_REASONING_TOKENS' THEN output_bound
     WHEN 'OPENAI_TOTAL_TOKENS' THEN input_bound+output_bound ELSE input_bound END END),0)
     INTO consumed FROM assistant_executions WHERE assignment_id=a.id AND status<>'RELEASED'
      AND (status<>'SETTLED' OR created_at>=period_start AND created_at<period_end);
    IF consumed+required>(limit_value->>'value')::numeric*(CASE WHEN metric='OPENAI_API_COST_USD' THEN 1000000000 ELSE 1 END) THEN RAISE EXCEPTION 'LIMIT_EXCEEDED';END IF;
   END IF;
   limit_value:=NULL;
  END LOOP;
  INSERT INTO assistant_executions(actor_id,organisation_id,command_id,decision_id,policy_id,policy_version,assignment_id,assignment_revision,
   model,pricing_version,input_digest,input_bound,output_bound,reserved_nano_usd,status,dispatch_before)
   VALUES(p.actor_id,p.organisation_id,(d->>'commandId')::uuid,(d->>'decisionId')::uuid,p.policy_id,p.version,a.id,a.revision,
    d->>'model',d->>'pricingVersion',d->>'inputDigest',v_input,v_output,v_cost,'RESERVED',least(clock_timestamp()+interval '25 seconds',i.expires_at)) RETURNING * INTO e;
 ELSE
  SELECT * INTO e FROM assistant_executions WHERE execution_id=(d->>'executionId')::uuid AND command_id=(d->>'commandId')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'POLICY_UNAVAILABLE';END IF;
  IF v_action='DISPATCH' THEN
   SELECT * INTO p FROM assistant_policy WHERE singleton FOR SHARE;
   SELECT * INTO a FROM assignments WHERE id=e.assignment_id FOR SHARE;
   IF e.status<>'RESERVED' OR e.dispatch_before<=clock_timestamp() OR NOT p.enabled OR p.policy_id<>e.policy_id OR p.version<>e.policy_version
   OR i.expires_at<=clock_timestamp() OR a.revision<>e.assignment_revision OR status_of(a.payload)<>'ACTIVE'
   THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;
   UPDATE assistant_executions SET status='DISPATCHED',updated_at=clock_timestamp() WHERE execution_id=e.execution_id RETURNING * INTO e;
  ELSIF v_action='RELEASE' THEN
   IF e.status<>'RESERVED' THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;
   UPDATE assistant_executions SET status='RELEASED',updated_at=clock_timestamp() WHERE execution_id=e.execution_id RETURNING * INTO e;
  ELSIF v_action='PENDING' THEN
   IF d->>'reason' NOT IN('CANCELLED','INTERRUPTED','PROVIDER_ERROR','USAGE_UNVERIFIED','AUTH_REVOKED') THEN RAISE EXCEPTION 'POLICY_UNAVAILABLE';END IF;
   IF e.status IN('RESERVED','DISPATCHED','PENDING_RECONCILIATION') THEN
    UPDATE assistant_executions SET status='PENDING_RECONCILIATION',reason=d->>'reason',updated_at=clock_timestamp() WHERE execution_id=e.execution_id RETURNING * INTO e;
   ELSIF e.status<>'SETTLED' THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;
  ELSE
   u:=d->'usage';usage_digest:=encode(public.digest(convert_to(u::text,'UTF8'),'sha256'),'hex');
   IF e.status='SETTLED' THEN
    IF e.response_id<>d->>'responseId' OR e.settlement_digest<>usage_digest THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';END IF;
    RETURN receipt||jsonb_build_object('status','SETTLED','executionId',e.execution_id);
   END IF;
   IF e.status NOT IN('DISPATCHED','PENDING_RECONCILIATION') OR coalesce(d->>'responseId','')!~'^resp_[a-zA-Z0-9_-]{1,160}$'
   OR jsonb_typeof(u) IS DISTINCT FROM 'object' OR u->>'model' IS DISTINCT FROM e.model OR u->>'pricingVersion' IS DISTINCT FROM e.pricing_version
   OR ARRAY(SELECT jsonb_object_keys(u) ORDER BY 1)<>ARRAY(SELECT unnest(ARRAY['model','pricingVersion','inputTokens','outputTokens','totalTokens','cachedTokens','cacheWriteTokens','cacheWrite30mTokens','cacheWrite12hTokens','reasoningTokens','nanoUsd']) ORDER BY 1)
   OR coalesce(u->>'nanoUsd','')!~'^(0|[1-9][0-9]{0,12})$' THEN RAISE EXCEPTION 'POLICY_UNAVAILABLE';END IF;
   FOREACH metric IN ARRAY ARRAY['inputTokens','outputTokens','totalTokens','cachedTokens','cacheWriteTokens','cacheWrite30mTokens','cacheWrite12hTokens','reasoningTokens'] LOOP
    IF jsonb_typeof(u->metric) IS DISTINCT FROM 'number' OR coalesce(u->>metric,'')!~'^(0|[1-9][0-9]{0,6})$'
    THEN RAISE EXCEPTION 'POLICY_UNAVAILABLE';END IF;
   END LOOP;
   v_input:=(u->>'inputTokens')::integer;v_output:=(u->>'outputTokens')::integer;
   cached:=(u->>'cachedTokens')::bigint;written:=(u->>'cacheWriteTokens')::bigint;write30:=(u->>'cacheWrite30mTokens')::bigint;
   write12:=(u->>'cacheWrite12hTokens')::bigint;reasoning:=(u->>'reasoningTokens')::bigint;uncached:=v_input-cached-written;
   IF least(v_input,v_output,cached,written,write30,write12,reasoning,uncached)<0 OR v_input>e.input_bound OR v_output>e.output_bound
   OR reasoning>v_output OR write30+write12<>written OR (u->>'totalTokens')::bigint<>v_input+v_output
   OR (u->>'nanoUsd')::bigint<>uncached*200+cached*20+write30*250+write12*500+v_output::bigint*1200
   OR (u->>'nanoUsd')::bigint>e.reserved_nano_usd THEN RAISE EXCEPTION 'POLICY_UNAVAILABLE';END IF;
   UPDATE assistant_executions SET status='SETTLED',response_id=d->>'responseId',usage=u,settlement_digest=usage_digest,updated_at=clock_timestamp()
    WHERE execution_id=e.execution_id RETURNING * INTO e;
  END IF;
 END IF;
 INSERT INTO assistant_usage_events(execution_id,event,metadata) VALUES(e.execution_id,v_action,
  jsonb_build_object('decisionId',e.decision_id,'assignmentId',e.assignment_id,'assignmentRevision',e.assignment_revision,'status',e.status,
   'reservedNanoUsd',e.reserved_nano_usd,'usage',e.usage,'reason',e.reason));
 RETURN receipt||jsonb_build_object('status',e.status,'executionId',e.execution_id,'commandId',e.command_id,
  'actorId',e.actor_id,'organisationId',e.organisation_id,'inputDigest',e.input_digest,'expiresAt',e.dispatch_before);
END $fn$;
REVOKE ALL ON FUNCTION profitia_limits.assistant_usage(text,text) FROM PUBLIC;
REVOKE ALL ON profitia_limits.assistant_installation,profitia_limits.assistant_policy,profitia_limits.assistant_executions,profitia_limits.assistant_usage_events FROM PUBLIC,profitia_limits_assistant_runtime;
GRANT USAGE ON SCHEMA profitia_limits TO profitia_limits_assistant_runtime;
GRANT EXECUTE ON FUNCTION profitia_limits.assistant_usage(text,text) TO profitia_limits_assistant_runtime;
