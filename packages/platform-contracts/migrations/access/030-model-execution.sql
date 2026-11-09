-- CANDIDATE ONLY. No installation, policy, grant, model call or activation.
-- Optional extension of the existing Source transaction and native HTTP host.
-- Holds are independent USD accounting, not SOURCE_TRANSACTION quotas.
DO $owner$ BEGIN
 IF current_user<>'profitia_ingestion_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
   AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication))
   OR to_regprocedure('profitia_external_native.descriptor(text,text)') IS NULL
   OR to_regprocedure('profitia_external_call.check_control(uuid,uuid,text)') IS NULL THEN
  RAISE EXCEPTION 'Accepted restricted Source installation required' USING ERRCODE='42501';END IF;
END $owner$;
CREATE SCHEMA profitia_model_execution AUTHORIZATION profitia_ingestion_owner;
REVOKE ALL ON SCHEMA profitia_model_execution FROM PUBLIC;
CREATE TABLE profitia_model_execution.installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),
 source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256)
);
CREATE TABLE profitia_model_execution.policies(
 policy_id uuid PRIMARY KEY REFERENCES profitia_external_call.policies(policy_id),
 profile_id text NOT NULL CHECK(profile_id~'^[A-Za-z0-9._:-]{1,128}$'),
 model text NOT NULL CHECK(model='gpt-6.1-sol'),
 maximum_input_tokens integer NOT NULL CHECK(maximum_input_tokens BETWEEN 1 AND 15000),
 maximum_output_tokens integer NOT NULL CHECK(maximum_output_tokens BETWEEN 1 AND 32000),
 maximum_body_bytes integer NOT NULL CHECK(maximum_body_bytes BETWEEN 1 AND 65536),
 reservation_micro_usd bigint NOT NULL CHECK(reservation_micro_usd BETWEEN 1 AND 5000000),
 maximum_attempts integer NOT NULL CHECK(maximum_attempts=1),
 -- These are public approval references, not client booleans or credentials.
 verified_key_project_ref text NOT NULL CHECK(length(verified_key_project_ref) BETWEEN 1 AND 256),
 previous_liability_reconciliation_ref text NOT NULL CHECK(length(previous_liability_reconciliation_ref) BETWEEN 1 AND 256),
 accepted_candidate_ref text NOT NULL CHECK(length(accepted_candidate_ref) BETWEEN 1 AND 256),
 controlled_release_ref text NOT NULL CHECK(length(controlled_release_ref) BETWEEN 1 AND 256),
 final_owner_go_ref text NOT NULL UNIQUE CHECK(length(final_owner_go_ref) BETWEEN 1 AND 256),
 expires_at timestamptz NOT NULL CHECK(isfinite(expires_at)),
 status text NOT NULL CHECK(status IN('ACTIVE','REVOKED')),version bigint NOT NULL CHECK(version>0)
);
CREATE TABLE profitia_model_execution.holds(
 call_id uuid PRIMARY KEY REFERENCES profitia_external_call.calls(call_id),
 policy_id uuid NOT NULL UNIQUE REFERENCES profitia_model_execution.policies(policy_id),
 policy_version bigint NOT NULL,
 reserved_micro_usd bigint NOT NULL CHECK(reserved_micro_usd BETWEEN 1 AND 5000000),
 status text NOT NULL CHECK(status IN('HELD','ATTEMPTED','UNVERIFIED','RESPONSE_USAGE_PENDING','RESPONSE_USAGE_RECORDED','NOT_SENT')),
 usage jsonb,estimated_cost_micro_usd bigint CHECK(estimated_cost_micro_usd>=0),
 request_id text CHECK(length(request_id) BETWEEN 1 AND 512 AND request_id~'^[A-Za-z0-9._:-]+$'),response_id text CHECK(length(response_id) BETWEEN 1 AND 512 AND response_id~'^[A-Za-z0-9._:-]+$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- One policy -> one immutable intention. NOT_SENT never permits a new attempt.
-- Provider usage is separate from actual invoiced cost and from customer fees.
-- A usage estimate never releases an UNKNOWN hold or allows another attempt.
DO $rls$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['installation','policies','holds'] LOOP
  EXECUTE format('ALTER TABLE profitia_model_execution.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE profitia_model_execution.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY controlled_owner ON profitia_model_execution.%I TO profitia_ingestion_owner USING(true) WITH CHECK(true)',t);
  EXECUTE format('CREATE POLICY runtime_fence ON profitia_model_execution.%I AS RESTRICTIVE TO PUBLIC USING(current_user=''profitia_ingestion_owner'') WITH CHECK(current_user=''profitia_ingestion_owner'')',t);
 END LOOP;
END $rls$;
CREATE FUNCTION profitia_model_execution.descriptor(p_source text,p_resource text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;p profitia_model_execution.policies%ROWTYPE;i profitia_model_execution.installation%ROWTYPE;BEGIN
 d:=profitia_external_native.descriptor(p_source,p_resource);
 IF d IS NULL OR d->>'origin' IS DISTINCT FROM 'https://api.openai.com' OR d->>'transport' IS DISTINCT FROM 'HTTPS'
  OR d->'pathRules' IS DISTINCT FROM '[{"method":"POST","path":"/v1/responses"}]'::jsonb
  OR (d->>'timeoutMs')::integer NOT IN(120000,600000) THEN RETURN NULL;END IF;
 SELECT * INTO i FROM profitia_model_execution.installation WHERE singleton;
 IF NOT FOUND OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='profitia_model_execution' AND c.relkind='r' AND c.relowner='profitia_ingestion_owner'::regrole AND c.relrowsecurity AND c.relforcerowsecurity)<>3 THEN RETURN NULL;END IF;
 SELECT * INTO p FROM profitia_model_execution.policies WHERE policy_id=(d->>'policyId')::uuid AND status='ACTIVE' AND expires_at>clock_timestamp();
 IF NOT FOUND OR has_schema_privilege(session_user,'profitia_model_execution','CREATE')
  OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_model_execution'
   AND c.relkind='r' AND (has_table_privilege(session_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR has_any_column_privilege(session_user,c.oid,'INSERT,UPDATE,REFERENCES')))
  OR has_function_privilege(session_user,'profitia_external_call.apply_control(uuid,uuid,text)','EXECUTE')
  OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='profitia_external_call.calls'::regclass AND tgname='model_call_cost_coupling'
   AND tgenabled='O' AND tgdeferrable AND tginitdeferred AND tgfoid='profitia_model_execution.enforce_cost_hold()'::regprocedure) THEN RETURN NULL;END IF;
 RETURN d||jsonb_build_object('modelSchemaVersion',i.schema_version,'modelSchemaDigest',i.schema_digest,
  'modelPolicyVersion',p.version::text,'modelProfileId',p.profile_id,'model',p.model,
  'modelMaximumInputTokens',p.maximum_input_tokens,'modelMaximumOutputTokens',p.maximum_output_tokens,
  'modelMaximumBodyBytes',p.maximum_body_bytes,'modelReservationMicroUsd',p.reservation_micro_usd,
  'modelMaximumAttempts',p.maximum_attempts,'modelExpiresAt',p.expires_at,'modelRequestIdHeader','x-request-id','modelClientRequestIdHeader','x-client-request-id');
END $fn$;
CREATE FUNCTION profitia_model_execution.apply_control(p_effect uuid,p_decision uuid,p_envelope text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE v jsonb;d jsonb;c jsonb;p profitia_model_execution.policies%ROWTYPE;r jsonb;h profitia_model_execution.holds%ROWTYPE;BEGIN
 -- Reuse actual Source effect/decision/digest and current scope checks. This is
 -- not HUMAN E1; the consumer must separately admit its human/private operation.
 v:=profitia_external_call.check_control(p_effect,p_decision,p_envelope);c:=v->'content';
 d:=profitia_model_execution.descriptor(v->'descriptor'->>'sourceId',v->'descriptor'->>'resourceId');
 IF d IS NULL THEN RAISE EXCEPTION 'Current model policy required' USING ERRCODE='42501';END IF;
 SELECT * INTO p FROM profitia_model_execution.policies WHERE policy_id=(d->>'policyId')::uuid FOR UPDATE;
 IF NOT FOUND OR p.status<>'ACTIVE' OR p.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Current model policy required' USING ERRCODE='42501';END IF;
 IF c->>'action'='PLAN' THEN
  IF EXISTS(SELECT 1 FROM profitia_model_execution.holds WHERE policy_id=p.policy_id) THEN
   RAISE EXCEPTION 'Single intention already reserved; no retry' USING ERRCODE='42501';END IF;
  r:=profitia_external_call.apply_control(p_effect,p_decision,p_envelope);
  INSERT INTO profitia_model_execution.holds(call_id,policy_id,policy_version,reserved_micro_usd,status)
   VALUES((r->>'callId')::uuid,p.policy_id,p.version,p.reservation_micro_usd,'HELD');
  RETURN r;
 END IF;
 SELECT * INTO h FROM profitia_model_execution.holds WHERE call_id=(c->>'callId')::uuid AND policy_id=p.policy_id AND policy_version=p.version FOR UPDATE;
 IF NOT FOUND OR c->>'action'='ATTEMPT' AND h.status<>'HELD' OR c->>'action'='SETTLE' AND h.status<>'ATTEMPTED' THEN
  RAISE EXCEPTION 'Current model hold required' USING ERRCODE='42501';END IF;
 r:=profitia_external_call.apply_control(p_effect,p_decision,p_envelope);
 UPDATE profitia_model_execution.holds SET status=CASE WHEN c->>'action'='ATTEMPT' THEN 'ATTEMPTED'
  WHEN c->>'status'='RESPONSE' THEN 'RESPONSE_USAGE_PENDING' WHEN c->>'status'='NOT_SENT' THEN 'NOT_SENT' ELSE 'UNVERIFIED' END,
  updated_at=clock_timestamp() WHERE call_id=h.call_id;
 RETURN r;
END $fn$;
-- Enforce cost coupling even if a runtime later receives a legacy base-control
-- EXECUTE grant. The deferred check runs before the Source transaction commits;
-- an old SDK cannot commit PLAN/ATTEMPT and then send without the matching hold.
-- Existing non-model policies retain their original controls and counters.
CREATE FUNCTION profitia_model_execution.enforce_cost_hold() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE c profitia_external_call.calls%ROWTYPE;h profitia_model_execution.holds%ROWTYPE;BEGIN
 IF NOT EXISTS(SELECT 1 FROM profitia_model_execution.policies WHERE policy_id=NEW.policy_id) THEN RETURN NEW;END IF;
 SELECT * INTO STRICT c FROM profitia_external_call.calls WHERE call_id=NEW.call_id;
 SELECT * INTO h FROM profitia_model_execution.holds WHERE call_id=c.call_id AND policy_id=c.policy_id;
 IF NOT FOUND OR (c.status='PLANNED' AND h.status<>'HELD') OR (c.status='ATTEMPT_RESERVED' AND h.status<>'ATTEMPTED')
  OR (c.status='UNVERIFIED' AND h.status<>'UNVERIFIED') OR (c.status='NOT_SENT' AND h.status<>'NOT_SENT')
  OR (c.status='RESPONSE' AND h.status NOT IN('RESPONSE_USAGE_PENDING','RESPONSE_USAGE_RECORDED')) THEN
  RAISE EXCEPTION 'Model call requires its atomic cost hold' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $fn$;
CREATE CONSTRAINT TRIGGER model_call_cost_coupling AFTER INSERT OR UPDATE ON profitia_external_call.calls
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION profitia_model_execution.enforce_cost_hold();
CREATE FUNCTION profitia_model_execution.record_usage(p_call uuid,p_usage jsonb,p_request text,p_response text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE r profitia_external_call.calls%ROWTYPE;h profitia_model_execution.holds%ROWTYPE;d jsonb;i bigint;o bigint;c bigint;cost bigint;BEGIN
 SELECT * INTO r FROM profitia_external_call.calls WHERE call_id=p_call AND login_role=session_user AND status='RESPONSE';
 IF NOT FOUND THEN RAISE EXCEPTION 'Settled provider response required' USING ERRCODE='42501';END IF;
 d:=profitia_model_execution.descriptor(r.source_id,r.resource_id);
 IF d IS NULL OR d->>'policyId' IS DISTINCT FROM r.policy_id::text THEN RAISE EXCEPTION 'Current model authority required' USING ERRCODE='42501';END IF;
 SELECT * INTO h FROM profitia_model_execution.holds WHERE call_id=p_call FOR UPDATE;
 IF NOT FOUND OR h.policy_version::text IS DISTINCT FROM d->>'modelPolicyVersion' OR h.policy_id IS DISTINCT FROM r.policy_id
  OR h.status NOT IN('RESPONSE_USAGE_PENDING','RESPONSE_USAGE_RECORDED') OR jsonb_typeof(p_usage) IS DISTINCT FROM 'object'
  OR (SELECT count(*) FROM jsonb_object_keys(p_usage))<>3 OR NOT(p_usage ?& ARRAY['inputTokens','outputTokens','cachedInputTokens'])
  OR jsonb_typeof(p_usage->'inputTokens') IS DISTINCT FROM 'number' OR jsonb_typeof(p_usage->'outputTokens') IS DISTINCT FROM 'number'
  OR jsonb_typeof(p_usage->'cachedInputTokens') IS DISTINCT FROM 'number'
  OR (p_usage->>'inputTokens') !~ '^[0-9]{1,8}$' OR (p_usage->>'outputTokens') !~ '^[0-9]{1,8}$'
  OR (p_usage->>'cachedInputTokens') !~ '^[0-9]{1,8}$' OR p_request IS NULL OR p_response IS NULL
  OR length(p_request) NOT BETWEEN 1 AND 512 OR length(p_response) NOT BETWEEN 1 AND 512
  OR p_request !~ '^[A-Za-z0-9._:-]+$' OR p_response !~ '^[A-Za-z0-9._:-]+$' THEN
  RAISE EXCEPTION 'Bounded provider usage required' USING ERRCODE='42501';END IF;
 i:=(p_usage->>'inputTokens')::bigint;o:=(p_usage->>'outputTokens')::bigint;c:=(p_usage->>'cachedInputTokens')::bigint;
 IF i>(d->>'modelMaximumInputTokens')::bigint OR o>(d->>'modelMaximumOutputTokens')::bigint OR c>i THEN
  RAISE EXCEPTION 'Usage exceeds accepted execution; retain hold for reconciliation' USING ERRCODE='42501';END IF;
 cost:=ceil(((i-c)*25+c+o*100)::numeric/10)::bigint;
 IF h.status='RESPONSE_USAGE_RECORDED' THEN
  IF h.usage IS DISTINCT FROM p_usage OR h.request_id IS DISTINCT FROM p_request OR h.response_id IS DISTINCT FROM p_response THEN
   RAISE EXCEPTION 'Immutable usage conflict' USING ERRCODE='42501';END IF;
 ELSE
  UPDATE profitia_model_execution.holds SET status='RESPONSE_USAGE_RECORDED',usage=p_usage,estimated_cost_micro_usd=cost,
   request_id=p_request,response_id=p_response,updated_at=clock_timestamp() WHERE call_id=p_call;
 END IF;
 RETURN jsonb_build_object('callId',p_call,'currency','USD','estimatedCostMicroUsd',cost,'billingCost','UNKNOWN','holdRetained',true,'retryAllowed',false);
END $fn$;
REVOKE ALL ON ALL TABLES IN SCHEMA profitia_model_execution FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_model_execution FROM PUBLIC;
-- No role creation/GRANT, installation INSERT, policy INSERT or activation here.
