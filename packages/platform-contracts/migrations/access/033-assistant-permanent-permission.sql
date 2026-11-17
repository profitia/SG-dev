-- Candidate Development policy extension. Installation does not enrol a user,
-- renew a pilot, change a grant, history deadline or Package & Limits assignment.
-- Keep SQL030 immutable. Owner activates one existing row with a version fence.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR current_database()<>'platform_private'
 OR NOT EXISTS(SELECT 1 FROM profitia_access.installation WHERE singleton AND environment='development'
  AND project_id='spring-bread-28217539' AND branch_id='br-sparkling-term-b99l107x')
 OR NOT EXISTS(SELECT 1 FROM profitia_assistant_access.installation WHERE singleton
  AND schema_digest='__ASSISTANT_ACCESS_SCHEMA_DIGEST__')
 THEN RAISE EXCEPTION 'ASSISTANT_PERMANENT_DEVELOPMENT_OWNER_REQUIRED';END IF;
END $guard$;
ALTER TABLE profitia_assistant_access.pilot
 ADD COLUMN converse_access_mode text NOT NULL DEFAULT 'PILOT' CHECK(converse_access_mode IN('PILOT','PERMANENT')),
 ADD COLUMN converse_decision_ref text CHECK(length(converse_decision_ref) BETWEEN 1 AND 1024),
 ADD CONSTRAINT permanent_converse_decision_required CHECK(converse_access_mode='PILOT' OR converse_decision_ref IS NOT NULL);
CREATE TABLE profitia_assistant_access.converse_policy_installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 schema_digest text NOT NULL CHECK(schema_digest ~ '^[a-f0-9]{64}$'),
 source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 1024)
);
CREATE TABLE profitia_assistant_access.converse_policy_events(
 event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 user_id uuid NOT NULL,organisation_id uuid NOT NULL,
 previous_mode text NOT NULL,new_mode text NOT NULL,
 previous_version bigint NOT NULL,new_version bigint NOT NULL,
 decision_ref text NOT NULL,
 database_actor text NOT NULL,transaction_id bigint NOT NULL
);
ALTER TABLE profitia_assistant_access.converse_policy_installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_assistant_access.converse_policy_installation FORCE ROW LEVEL SECURITY;
ALTER TABLE profitia_assistant_access.converse_policy_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_assistant_access.converse_policy_events FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON profitia_assistant_access.converse_policy_installation TO profitia_access_owner USING(true) WITH CHECK(true);
CREATE POLICY controlled_owner ON profitia_assistant_access.converse_policy_events TO profitia_access_owner USING(true) WITH CHECK(true);
CREATE FUNCTION profitia_assistant_access.audit_converse_policy() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_assistant_access,pg_temp AS $fn$
BEGIN
 IF NEW.converse_access_mode IS DISTINCT FROM OLD.converse_access_mode
 OR NEW.converse_decision_ref IS DISTINCT FROM OLD.converse_decision_ref THEN
  IF NEW.version<=OLD.version OR NEW.converse_decision_ref IS NULL
  OR NEW.user_id<>OLD.user_id OR NEW.organisation_id<>OLD.organisation_id
  THEN RAISE EXCEPTION 'ASSISTANT_CONVERSE_DECISION_VERSION_REQUIRED';END IF;
  INSERT INTO converse_policy_events(user_id,organisation_id,previous_mode,new_mode,previous_version,new_version,decision_ref,database_actor,transaction_id)
  VALUES(NEW.user_id,NEW.organisation_id,OLD.converse_access_mode,NEW.converse_access_mode,OLD.version,NEW.version,
   NEW.converse_decision_ref,session_user,txid_current());
 END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER assistant_converse_policy_audit BEFORE UPDATE ON profitia_assistant_access.pilot
 FOR EACH ROW EXECUTE FUNCTION profitia_assistant_access.audit_converse_policy();
CREATE FUNCTION profitia_assistant_access.reject_policy_event_mutation() RETURNS trigger
 LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN RAISE EXCEPTION 'ASSISTANT_CONVERSE_AUDIT_APPEND_ONLY';END $fn$;
CREATE TRIGGER assistant_converse_policy_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON profitia_assistant_access.converse_policy_events
 FOR EACH STATEMENT EXECUTE FUNCTION profitia_assistant_access.reject_policy_event_mutation();

CREATE OR REPLACE FUNCTION profitia_assistant_access.current_pilot(p_user uuid,p_org uuid,p_digest text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_assistant_access,profitia_access,pg_temp AS $fn$
DECLARE p pilot%ROWTYPE;until_at timestamptz;decision_ref text;
BEGIN
 IF session_user<>'sg2_private_development_runtime' OR current_database()<>'platform_private'
 OR current_setting('profitia.application_id',true) IS DISTINCT FROM 'spendguru'
 OR current_setting('profitia.environment',true) IS DISTINCT FROM 'development'
 OR current_setting('profitia.user_id',true) IS DISTINCT FROM p_user::text
 OR NOT profitia_access.scope_allows('spendguru',p_org,p_user)
 OR NOT EXISTS(SELECT 1 FROM profitia_assistant_access.installation WHERE singleton AND schema_digest=p_digest AND schema_digest='__ASSISTANT_ACCESS_SCHEMA_DIGEST__')
 THEN RAISE EXCEPTION 'ASSISTANT_SCOPE_UNAVAILABLE' USING ERRCODE='42501';END IF;
 SELECT * INTO p FROM pilot WHERE singleton AND enabled AND user_id=p_user FOR SHARE;
 IF NOT FOUND THEN RETURN NULL;END IF;
 until_at:=CASE WHEN p_org IS NULL THEN p.history_until ELSE p.converse_until END;
 decision_ref:=p.source_ref;
 IF p_org IS NOT NULL AND p.converse_access_mode='PERMANENT' THEN
  IF NOT EXISTS(SELECT 1 FROM converse_policy_installation WHERE singleton AND schema_digest='__ASSISTANT_PERMANENT_SCHEMA_DIGEST__')
  OR p.converse_decision_ref IS NULL
  OR NOT EXISTS(SELECT 1 FROM profitia_access.permission_grants g WHERE g.application_id='spendguru'
   AND g.organisation_id=p_org AND g.user_id=p_user AND g.effect='ALLOW'
   AND g.operation='assistant.converse' AND g.feature='assistant' AND g.resource_id IS NULL)
  OR EXISTS(SELECT 1 FROM profitia_access.permission_grants g WHERE g.application_id='spendguru'
   AND g.organisation_id=p_org AND g.user_id=p_user AND g.effect='DENY'
   AND g.operation='assistant.converse' AND g.feature='assistant')
  THEN RETURN NULL;END IF;
  -- Permanent entitlement is re-authorised in each real E1 transaction.
  -- The returned proof is still finite; no infinite timestamp or cached ALLOW.
  until_at:=clock_timestamp()+interval '30 seconds';
  decision_ref:=p.converse_decision_ref;
 END IF;
 IF until_at<=clock_timestamp() OR p_org IS NOT NULL AND p_org<>p.organisation_id THEN RETURN NULL;END IF;
 IF p_org IS NOT NULL AND NOT EXISTS(SELECT 1 FROM profitia_access.product_grants g WHERE g.application_id='spendguru'
  AND g.organisation_id=p_org AND g.product='SPENDGURU' AND g.status='ACTIVE' AND g.expires_at>clock_timestamp()
  AND g.source IN('CONTRACT','VERIFIED_BILLING','EXPLICIT_OFFER')) THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('schemaDigest',p_digest,'userId',p_user,'organisationId',p_org,'pilotOrganisationId',p.organisation_id,
  'version',p.version::text,'sourceRef',decision_ref,'expiresAt',until_at,
  'limitsPolicyId',p.limits_policy_id,'limitsAssignmentId',p.limits_assignment_id,'limitsAssignmentRevision',p.limits_assignment_revision,
  'transactionId',txid_current()::text);
END $fn$;
REVOKE ALL ON TABLE profitia_assistant_access.converse_policy_installation,profitia_assistant_access.converse_policy_events FROM PUBLIC,sg2_private_development_runtime;
REVOKE ALL ON FUNCTION profitia_assistant_access.audit_converse_policy(),profitia_assistant_access.reject_policy_event_mutation() FROM PUBLIC,sg2_private_development_runtime;
-- Existing current_pilot EXECUTE grant is preserved. The separately reviewed
-- installer records the exact SQL033 digest before any PERMANENT activation.
