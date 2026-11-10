-- Source candidate only. No pilot, permission, product or account is granted by
-- this migration. Exact owner-controlled enrolment follows installation gates.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR current_database()<>'platform_private'
 OR NOT EXISTS(SELECT 1 FROM profitia_access.installation WHERE singleton AND environment='development'
  AND project_id='spring-bread-28217539' AND branch_id='br-sparkling-term-b99l107x')
 THEN RAISE EXCEPTION 'ASSISTANT_DEVELOPMENT_ACCESS_OWNER_REQUIRED';END IF;
END $guard$;
CREATE SCHEMA profitia_assistant_access AUTHORIZATION profitia_access_owner;
REVOKE ALL ON SCHEMA profitia_assistant_access FROM PUBLIC;
CREATE TABLE profitia_assistant_access.installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 schema_digest text NOT NULL CHECK(schema_digest ~ '^[a-f0-9]{64}$'),
 source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 1024)
);
CREATE TABLE profitia_assistant_access.pilot(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 user_id uuid NOT NULL REFERENCES profitia_access.accounts,
 organisation_id uuid NOT NULL REFERENCES profitia_access.organisations,
 limits_policy_id uuid NOT NULL,limits_assignment_id uuid NOT NULL,limits_assignment_revision integer NOT NULL CHECK(limits_assignment_revision>0),
 enabled boolean NOT NULL DEFAULT false,version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 converse_until timestamptz NOT NULL CHECK(converse_until>created_at AND converse_until<=created_at+interval '7 days'),
 history_until timestamptz NOT NULL CHECK(history_until>=converse_until AND history_until<=converse_until+interval '30 days'),
 source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 1024)
);
ALTER TABLE profitia_assistant_access.installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_assistant_access.installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON profitia_assistant_access.installation TO profitia_access_owner USING(true) WITH CHECK(true);
ALTER TABLE profitia_assistant_access.pilot ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_assistant_access.pilot FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON profitia_assistant_access.pilot TO profitia_access_owner USING(true) WITH CHECK(true);
CREATE FUNCTION profitia_assistant_access.revise() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
 SET search_path=pg_catalog,profitia_access,pg_temp AS $fn$
BEGIN UPDATE profitia_access.installation SET revision=revision+1 WHERE singleton;RETURN coalesce(NEW,OLD);END $fn$;
CREATE TRIGGER assistant_pilot_revision AFTER INSERT OR UPDATE OR DELETE ON profitia_assistant_access.pilot
 FOR EACH ROW EXECUTE FUNCTION profitia_assistant_access.revise();

CREATE FUNCTION profitia_assistant_access.current_pilot(p_user uuid,p_org uuid,p_digest text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_assistant_access,profitia_access,pg_temp AS $fn$
DECLARE p pilot%ROWTYPE;until_at timestamptz;d jsonb;
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
 IF until_at<=clock_timestamp() OR p_org IS NOT NULL AND p_org<>p.organisation_id THEN RETURN NULL;END IF;
 IF p_org IS NOT NULL AND NOT EXISTS(SELECT 1 FROM profitia_access.product_grants g WHERE g.application_id='spendguru'
  AND g.organisation_id=p_org AND g.product='SPENDGURU' AND g.status='ACTIVE' AND g.expires_at>clock_timestamp()
  AND g.source IN('CONTRACT','VERIFIED_BILLING','EXPLICIT_OFFER')) THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('schemaDigest',p_digest,'userId',p_user,'organisationId',p_org,'pilotOrganisationId',p.organisation_id,
  'version',p.version::text,'sourceRef',p.source_ref,'expiresAt',until_at,
  'limitsPolicyId',p.limits_policy_id,'limitsAssignmentId',p.limits_assignment_id,'limitsAssignmentRevision',p.limits_assignment_revision,
  'transactionId',txid_current()::text);
END $fn$;
REVOKE ALL ON ALL TABLES IN SCHEMA profitia_assistant_access FROM PUBLIC,sg2_private_development_runtime;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_assistant_access FROM PUBLIC,sg2_private_development_runtime;
GRANT USAGE ON SCHEMA profitia_assistant_access TO sg2_private_development_runtime;
GRANT EXECUTE ON FUNCTION profitia_assistant_access.current_pilot(uuid,uuid,text) TO sg2_private_development_runtime;
