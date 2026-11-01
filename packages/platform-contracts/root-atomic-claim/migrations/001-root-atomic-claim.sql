-- Optional Root control effect only. No role, receiver, grant or runtime is
-- seeded. The accepted SDK, request/Jobs functions and Source remain unchanged.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(
  SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname=current_user
   AND NOT(r.rolcanlogin OR r.rolinherit OR r.rolsuper OR r.rolbypassrls OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication)
   AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.member=r.oid))
  OR to_regprocedure('profitia_jobs.supplier_runtime_descriptor()') IS NULL
  OR to_regprocedure('profitia_requests.scope_allows(text,uuid,uuid,text)') IS NULL
  OR NOT EXISTS(SELECT 1 FROM profitia_access.installation WHERE singleton AND environment='development') THEN
  RAISE EXCEPTION 'Controlled owner and accepted Supplier authority required' USING ERRCODE='42501';
 END IF;
END $guard$;
CREATE SCHEMA profitia_root_claim AUTHORIZATION profitia_access_owner;
REVOKE ALL ON SCHEMA profitia_root_claim FROM PUBLIC;
CREATE TABLE profitia_root_claim.installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),
 source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256)
);
CREATE TABLE profitia_root_claim.receivers(
 foreground_role name PRIMARY KEY REFERENCES profitia_access.runtime_bindings(login_role),
 executor_role name NOT NULL REFERENCES profitia_services.runtime_bindings(login_role),
 enabled boolean NOT NULL DEFAULT false,
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 expires_at timestamptz NOT NULL CHECK(isfinite(expires_at)),
 source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256)
);
-- Private, append-only control provenance. Root stays HUMAN; no fictitious
-- service audit is minted. Its real INTENT/OUTCOME encloses this atomic effect.
CREATE TABLE profitia_root_claim.claim_log(
 request_id uuid PRIMARY KEY REFERENCES profitia_requests.intents(request_id),
 root_decision_id uuid NOT NULL,
 root_transaction_id text NOT NULL CHECK(root_transaction_id~'^[1-9][0-9]*$'),
 application_id text NOT NULL,
 environment text NOT NULL CHECK(environment='development'),
 organisation_id uuid NOT NULL,
 user_id uuid NOT NULL,
 payload_digest text NOT NULL CHECK(payload_digest~'^[a-f0-9]{64}$'),
 resource_id text NOT NULL,
 configuration_version text NOT NULL,
 foreground_role name NOT NULL REFERENCES profitia_access.runtime_bindings(login_role),
 executor_role name NOT NULL REFERENCES profitia_services.runtime_bindings(login_role),
 receiver_version bigint NOT NULL CHECK(receiver_version>0),
 binding_id uuid NOT NULL REFERENCES profitia_jobs.operation_bindings(binding_id),
 binding_version bigint NOT NULL CHECK(binding_version>0),
 lease_id uuid NOT NULL UNIQUE,
 lease_expires_at timestamptz NOT NULL CHECK(isfinite(lease_expires_at)),
 source_id text NOT NULL,
 attempt integer NOT NULL CHECK(attempt=1),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(organisation_id,user_id) REFERENCES profitia_access.memberships(organisation_id,user_id)
);
DO $rls$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['installation','receivers','claim_log'] LOOP
  EXECUTE format('ALTER TABLE profitia_root_claim.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE profitia_root_claim.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY controlled_owner ON profitia_root_claim.%I TO profitia_access_owner USING(true) WITH CHECK(true)',t);
 END LOOP;
END $rls$;
CREATE FUNCTION profitia_root_claim.immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN RAISE EXCEPTION 'Immutable Root claim provenance' USING ERRCODE='42501';END $fn$;
DO $immutable$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['installation','claim_log'] LOOP
  EXECUTE format('CREATE TRIGGER immutable_row BEFORE UPDATE OR DELETE ON profitia_root_claim.%I FOR EACH ROW EXECUTE FUNCTION profitia_root_claim.immutable()',t);
  EXECUTE format('CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON profitia_root_claim.%I FOR EACH STATEMENT EXECUTE FUNCTION profitia_root_claim.immutable()',t);
 END LOOP;
END $immutable$;
CREATE TRIGGER receiver_revision BEFORE INSERT OR UPDATE OR DELETE ON profitia_root_claim.receivers
 FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision();
CREATE TRIGGER receiver_truncate_revision BEFORE TRUNCATE ON profitia_root_claim.receivers
 FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision();
CREATE TRIGGER receiver_version BEFORE UPDATE ON profitia_root_claim.receivers
 FOR EACH ROW EXECUTE FUNCTION profitia_access.advance_version();

CREATE FUNCTION profitia_root_claim.runtime_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;i profitia_root_claim.installation%ROWTYPE;r profitia_root_claim.receivers%ROWTYPE;executor_app text;t text;
BEGIN
 d:=profitia_jobs.supplier_runtime_descriptor();
 FOREACH t IN ARRAY ARRAY['installation','receivers','claim_log'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE oid=('profitia_root_claim.'||t)::regclass
    AND relowner='profitia_access_owner'::regrole AND relrowsecurity AND relforcerowsecurity)
   OR has_table_privilege(session_user,'profitia_root_claim.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
   OR has_any_column_privilege(session_user,'profitia_root_claim.'||t,'SELECT,INSERT,UPDATE,REFERENCES') THEN RETURN NULL;END IF;
 END LOOP;
 SELECT * INTO i FROM profitia_root_claim.installation WHERE singleton;
 IF d IS NULL OR NOT FOUND OR d->>'environment'<>'development' THEN RETURN NULL;END IF;
 SELECT * INTO r FROM profitia_root_claim.receivers WHERE foreground_role=session_user AND enabled AND expires_at>clock_timestamp();
 IF NOT FOUND OR EXISTS(SELECT 1 FROM profitia_services.runtime_bindings WHERE login_role=session_user) THEN RETURN NULL;END IF;
 SELECT rb.application_id INTO executor_app FROM profitia_services.runtime_bindings s
  JOIN profitia_access.runtime_bindings rb USING(login_role)
  JOIN profitia_access.applications app ON app.application_id=rb.application_id
  JOIN pg_catalog.pg_roles pr ON pr.rolname=s.login_role
  WHERE s.login_role=r.executor_role AND s.profile_id='PLATFORM_INTERNAL' AND s.status='ACTIVE'
   AND s.expires_at>clock_timestamp() AND rb.status='ACTIVE' AND app.status='ACTIVE'
   AND pr.rolcanlogin AND NOT(pr.rolinherit OR pr.rolsuper OR pr.rolbypassrls OR pr.rolcreatedb OR pr.rolcreaterole OR pr.rolreplication)
   AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.member=pr.oid);
 IF NOT FOUND THEN RETURN NULL;END IF;
 RETURN d||jsonb_build_object('rootClaimSchemaVersion',i.schema_version,'rootClaimSchemaDigest',i.schema_digest,
  'executorRole',r.executor_role,'executorApplicationId',executor_app,'receiverVersion',r.version::text);
END $fn$;

CREATE FUNCTION profitia_root_claim.require_root_outcome() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM profitia_access.security_events e
  WHERE e.application_id=NEW.application_id AND e.environment=NEW.environment
   AND e.decision_id=NEW.root_decision_id AND e.phase='OUTCOME'
   AND e.event->>'decision'='ALLOW' AND e.event->>'reasonCode'='SUCCEEDED'
   AND e.event->>'actorKind'='HUMAN' AND e.event->>'actorId'=NEW.user_id::text
   AND e.event->>'organisationId'=NEW.organisation_id::text
   AND e.event->>'operation'='supplier.report.refresh' AND e.event->>'resourceId'=NEW.resource_id
   AND e.event->>'payloadDigest'=NEW.payload_digest
   AND e.event->'moduleEvidence'->>'transactionId'=NEW.root_transaction_id) THEN
  RAISE EXCEPTION 'Root claim requires its actual successful Root OUTCOME' USING ERRCODE='PT403';
 END IF;
 RETURN NULL;
END $fn$;
CREATE CONSTRAINT TRIGGER root_outcome_at_commit AFTER INSERT ON profitia_root_claim.claim_log
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION profitia_root_claim.require_root_outcome();

CREATE FUNCTION profitia_root_claim.claim_dispatch(p_request uuid,p_decision uuid,p_configuration text,p_digest text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;r profitia_requests.intents%ROWTYPE;j profitia_jobs.dispatches%ROWTYPE;
 g profitia_jobs.delegations%ROWTYPE;b profitia_jobs.operation_bindings%ROWTYPE;
 receiver profitia_root_claim.receivers%ROWTYPE;s record;grant_expiry timestamptz;deadline timestamptz;
BEGIN
 PERFORM 1 FROM profitia_access.installation WHERE singleton FOR SHARE;
 PERFORM 1 FROM profitia_root_claim.installation WHERE singleton FOR SHARE;
 d:=profitia_root_claim.runtime_descriptor();
 IF d IS NULL OR d->>'rootClaimSchemaDigest' IS DISTINCT FROM p_digest THEN RETURN NULL;END IF;
 SELECT * INTO receiver FROM profitia_root_claim.receivers WHERE foreground_role=session_user
  AND enabled AND expires_at>clock_timestamp() FOR SHARE;
 IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT * INTO r FROM profitia_requests.intents WHERE request_id=p_request FOR UPDATE;
 IF NOT FOUND OR r.status<>'ACCEPTED' OR r.operation<>'supplier.report.refresh' OR r.decision_id IS DISTINCT FROM p_decision
  OR r.application_id IS DISTINCT FROM d->>'applicationId' OR r.environment IS DISTINCT FROM d->>'environment'
  OR profitia_access.scope_allows(r.application_id,r.organisation_id,r.user_id) IS NOT TRUE
  OR profitia_requests.scope_allows(r.operation,r.organisation_id,r.user_id,r.resource_id) IS NOT TRUE THEN RETURN NULL;END IF;
 -- The actual current Root INTENT binds this decision to this physical Root
 -- transaction. An old ACCEPTED request or a replay cannot acquire this port.
 IF NOT EXISTS(SELECT 1 FROM profitia_access.security_events e WHERE e.decision_id=p_decision
  AND e.application_id=r.application_id AND e.environment=r.environment AND e.phase='INTENT'
  AND e.event->>'decision'='ALLOW' AND e.event->>'actorKind'='HUMAN' AND e.event->>'actorId'=r.user_id::text
  AND e.event->>'organisationId'=r.organisation_id::text AND e.event->>'operation'=r.operation
  AND e.event->>'resourceId'=r.resource_id AND e.event->>'payloadDigest'=r.payload_digest
  AND e.event->'moduleEvidence'->>'transactionId'=txid_current()::text) THEN RETURN NULL;END IF;
 SELECT * INTO j FROM profitia_jobs.dispatches WHERE job_id=p_request AND request_id=p_request FOR UPDATE;
 IF NOT FOUND OR j.status<>'PENDING' OR j.attempt_count<>0 OR j.lease_id IS NOT NULL
  OR EXISTS(SELECT 1 FROM profitia_root_claim.claim_log WHERE request_id=p_request)
  OR EXISTS(SELECT 1 FROM profitia_jobs.delivery_observations WHERE job_id=p_request) THEN RETURN NULL;END IF;
 SELECT * INTO g FROM profitia_jobs.delegations WHERE delegation_id=j.delegation_id AND request_id=p_request
  AND status='ACTIVE' AND expires_at>clock_timestamp();
 IF NOT FOUND OR g.application_id<>r.application_id OR g.environment<>r.environment
  OR g.user_id<>r.user_id OR g.organisation_id<>r.organisation_id OR g.operation<>r.operation
  OR g.resource_id<>r.resource_id OR g.payload_digest<>r.payload_digest THEN RETURN NULL;END IF;
 SELECT * INTO b FROM profitia_jobs.operation_bindings WHERE binding_id=g.binding_id AND version=g.binding_version
  AND application_id=r.application_id AND operation=r.operation AND foreground_role=session_user
  AND configuration_version=p_configuration AND executor_application_id=d->>'executorApplicationId'
  AND source_id=j.source_id AND status='ACTIVE' AND expires_at>clock_timestamp() FOR SHARE;
 IF NOT FOUND THEN RETURN NULL;END IF;
 IF NOT EXISTS(SELECT 1 FROM profitia_access.external_identities x JOIN profitia_access.accounts a USING(user_id)
  WHERE x.binding_id=g.identity_binding_id AND x.version=g.identity_binding_version AND x.user_id=r.user_id
   AND x.status='ACTIVE' AND x.expires_at>clock_timestamp() AND a.status='ACTIVE' AND a.version=g.account_version
   AND x.binding_id::text||':'||x.version::text||':'||a.version::text=current_setting('profitia.identity_binding_version',true)) THEN RETURN NULL;END IF;
 SELECT sb.*,rb.application_id AS executor_application_id INTO s FROM profitia_services.runtime_bindings sb
  JOIN profitia_access.runtime_bindings rb USING(login_role)
  JOIN profitia_access.applications app ON app.application_id=rb.application_id
  WHERE sb.login_role=receiver.executor_role AND sb.profile_id='PLATFORM_INTERNAL' AND sb.status='ACTIVE'
   AND sb.expires_at>clock_timestamp() AND rb.status='ACTIVE' AND app.status='ACTIVE'
   AND rb.application_id=b.executor_application_id FOR SHARE OF sb,rb,app;
 IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT min(expires_at) INTO grant_expiry FROM profitia_jobs.execution_grants
  WHERE login_role=receiver.executor_role AND binding_id=b.binding_id AND organisation_id=r.organisation_id
   AND effect='ALLOW' AND status='ACTIVE' AND expires_at>clock_timestamp()
   AND(resource_id IS NULL OR resource_id=r.resource_id);
 IF grant_expiry IS NULL OR EXISTS(SELECT 1 FROM profitia_jobs.execution_grants
  WHERE login_role=receiver.executor_role AND binding_id=b.binding_id AND organisation_id=r.organisation_id
   AND effect='DENY' AND status='ACTIVE' AND expires_at>clock_timestamp()
   AND(resource_id IS NULL OR resource_id=r.resource_id)) THEN RETURN NULL;END IF;
 deadline:=least(clock_timestamp()+interval '30 seconds',g.expires_at,b.expires_at,s.expires_at,
  receiver.expires_at,grant_expiry,nullif(current_setting('profitia.scope_expires_at',true),'')::timestamptz);
 IF deadline IS NULL OR deadline<=clock_timestamp() THEN RETURN NULL;END IF;
 UPDATE profitia_jobs.dispatches SET status='READY',lease_id=gen_random_uuid(),lease_expires_at=deadline,
  attempt_count=attempt_count+1,updated_at=clock_timestamp() WHERE job_id=p_request RETURNING * INTO j;
 INSERT INTO profitia_root_claim.claim_log(request_id,root_decision_id,root_transaction_id,application_id,environment,
  organisation_id,user_id,payload_digest,resource_id,configuration_version,foreground_role,executor_role,receiver_version,
  binding_id,binding_version,lease_id,lease_expires_at,source_id,attempt)
 VALUES(p_request,p_decision,txid_current()::text,r.application_id,r.environment,r.organisation_id,r.user_id,
  r.payload_digest,r.resource_id,p_configuration,session_user,receiver.executor_role,receiver.version,b.binding_id,
  b.version,j.lease_id,deadline,j.source_id,j.attempt_count);
 RETURN jsonb_build_object('status','READY','jobId',j.job_id,'requestId',j.request_id,'sourceId',j.source_id,
  'deliveryKey',j.delivery_key,'leaseId',j.lease_id,'expiresAt',deadline,'attempt',j.attempt_count,
  'rootDecisionId',p_decision,'rootTransactionId',txid_current()::text,'userId',r.user_id,
  'organisationId',r.organisation_id,'payloadDigest',r.payload_digest,'foregroundRole',session_user,
  'executorRole',receiver.executor_role,'executorApplicationId',s.executor_application_id,
  'applicationId',r.application_id,'environment',r.environment);
EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN RETURN NULL;
END $fn$;

-- This is an additional provenance fence, NOT an authorizer or a Source port.
-- The ordinary Jobs host still performs every current account/SQL/audit check.
CREATE FUNCTION profitia_root_claim.bind_delivery(p_request uuid,p_lease uuid,p_decision uuid,p_digest text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE c profitia_root_claim.claim_log%ROWTYPE;r profitia_root_claim.receivers%ROWTYPE;j profitia_jobs.dispatches%ROWTYPE;
BEGIN
 PERFORM 1 FROM profitia_access.installation WHERE singleton FOR SHARE;
 IF NOT EXISTS(SELECT 1 FROM profitia_root_claim.installation WHERE singleton AND schema_digest=p_digest) THEN RETURN false;END IF;
 SELECT * INTO c FROM profitia_root_claim.claim_log WHERE request_id=p_request AND lease_id=p_lease
  AND root_decision_id=p_decision AND executor_role=session_user AND lease_expires_at>clock_timestamp();
 IF NOT FOUND THEN RETURN false;END IF;
 SELECT * INTO r FROM profitia_root_claim.receivers WHERE foreground_role=c.foreground_role
  AND executor_role=session_user AND enabled AND version=c.receiver_version AND expires_at>clock_timestamp() FOR SHARE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM profitia_services.runtime_bindings s
  JOIN profitia_access.runtime_bindings b USING(login_role) WHERE s.login_role=session_user
   AND s.profile_id='PLATFORM_INTERNAL' AND s.status='ACTIVE' AND s.expires_at>clock_timestamp() AND b.status='ACTIVE') THEN RETURN false;END IF;
 IF NOT EXISTS(SELECT 1 FROM profitia_access.security_events e WHERE e.application_id=c.application_id
  AND e.environment=c.environment AND e.decision_id=c.root_decision_id AND e.phase='OUTCOME'
  AND e.event->>'decision'='ALLOW' AND e.event->>'reasonCode'='SUCCEEDED' AND e.event->>'actorKind'='HUMAN'
  AND e.event->>'actorId'=c.user_id::text AND e.event->>'organisationId'=c.organisation_id::text
  AND e.event->>'operation'='supplier.report.refresh' AND e.event->>'resourceId'=c.resource_id
  AND e.event->>'payloadDigest'=c.payload_digest
  AND e.event->'moduleEvidence'->>'transactionId'=c.root_transaction_id) THEN RETURN false;END IF;
 SELECT * INTO j FROM profitia_jobs.dispatches WHERE job_id=p_request AND request_id=p_request;
 RETURN FOUND AND(j.status='CONFIRMED' OR j.status='READY' AND j.lease_id=p_lease AND j.lease_expires_at>clock_timestamp());
END $fn$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_root_claim FROM PUBLIC;
