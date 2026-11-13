-- Own-account context gateway; no business entitlement or domain data is written.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
  AND(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole))
  OR to_regclass('profitia_profile.organisation_profiles') IS NULL OR to_regclass('profitia_profile.organisation_user_context') IS NULL
 THEN RAISE EXCEPTION 'CONTROLLED_ORGANISATION_OWNER_REQUIRED';END IF;
END $guard$;
CREATE TABLE profitia_profile.organisation_context_installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'));
CREATE TABLE profitia_profile.organisation_context_policies(
 login_role name PRIMARY KEY REFERENCES profitia_access.runtime_bindings(login_role),application_id text NOT NULL REFERENCES profitia_access.applications(application_id),
 enabled boolean NOT NULL DEFAULT false,policy_id uuid NOT NULL UNIQUE,version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 150 AND source_ref!~'[[:cntrl:]]'),
 expires_at timestamptz NOT NULL CHECK(isfinite(expires_at)),
 legacy_default_organisation_id uuid REFERENCES profitia_access.organisations(organisation_id));
DO $tables$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['organisation_context_installation','organisation_context_policies'] LOOP
  EXECUTE format('ALTER TABLE profitia_profile.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE profitia_profile.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY controlled_owner ON profitia_profile.%I TO profitia_access_owner USING(true) WITH CHECK(true)',t);
  EXECUTE format('REVOKE ALL ON profitia_profile.%I FROM PUBLIC',t);
 END LOOP;
END $tables$;
CREATE TRIGGER organisation_context_policy_fence BEFORE INSERT OR UPDATE OR DELETE ON profitia_profile.organisation_context_policies
 FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision();
CREATE TRIGGER organisation_context_policy_truncate_fence BEFORE TRUNCATE ON profitia_profile.organisation_context_policies
 FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision();
CREATE FUNCTION profitia_profile.organisation_context_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile,profitia_access AS $fn$
DECLARE d jsonb;p organisation_context_policies%ROWTYPE;dg text;
BEGIN
 d:=profitia_access.runtime_descriptor();
 SELECT * INTO p FROM organisation_context_policies WHERE login_role=session_user AND enabled AND expires_at>clock_timestamp() FOR SHARE;
 SELECT schema_digest INTO dg FROM organisation_context_installation WHERE singleton;
 IF p.policy_id IS NULL OR dg IS NULL OR d->>'environment'<>'development' OR d->>'fixedOrganisationId' IS NOT NULL
  OR p.application_id IS DISTINCT FROM d->>'applicationId'
 THEN RAISE EXCEPTION 'OWN_ORGANISATION_CONTEXT_POLICY_REQUIRED' USING ERRCODE='PT403';END IF;
 RETURN jsonb_build_object('schemaDigest',dg,'applicationId',p.application_id,'environment','development','policyId',p.policy_id,
  'policyVersion',p.version::text,'sourceRef',p.source_ref,'expiresAt',least(p.expires_at,clock_timestamp()+interval '30 seconds'));
END $fn$;
CREATE FUNCTION profitia_profile.read_current_organisation_context(p_decision uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_profile,profitia_access AS $fn$
DECLARE d jsonb;p organisation_context_policies%ROWTYPE;uid uuid;oid uuid;membership_until timestamptz;deadline timestamptz;
BEGIN
 d:=profitia_profile.organisation_context_descriptor();uid:=nullif(current_setting('profitia.user_id',true),'')::uuid;
 IF uid IS NULL OR profitia_access.scope_allows(d->>'applicationId',NULL,uid) IS NOT TRUE
  OR NOT EXISTS(SELECT 1 FROM profitia_access.security_events WHERE application_id=d->>'applicationId' AND decision_id=p_decision
   AND phase='INTENT' AND event->>'contractId'='profitia.operation-context' AND event->>'contractVersion'='1.0.0'
   AND event->>'implementationVersion'='1.0.0-candidate.16' AND event->>'operation'='account.settings.read'
   AND event->>'resourceId'='current-organisation-context' AND event->>'actorId'=uid::text
   AND event->>'actorKind'='HUMAN' AND event->>'organisationId' IS NULL AND event->>'decision'='ALLOW'
   AND event->>'payloadDigest'='44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a')
 THEN RAISE EXCEPTION 'CURRENT_ACCOUNT_ROOT_INTENT_REQUIRED' USING ERRCODE='PT403';END IF;
 SELECT * INTO p FROM organisation_context_policies WHERE login_role=session_user FOR SHARE;
 -- Same preference ordering as the Identity lifecycle and Limits reader.
 SELECT pr.organisation_id,m.expires_at INTO oid,membership_until
  FROM organisation_profiles pr JOIN profitia_access.memberships m USING(organisation_id)
  JOIN profitia_access.organisations o USING(organisation_id)
  LEFT JOIN organisation_user_context c ON c.user_id=m.user_id
  WHERE m.user_id=uid AND m.status='ACTIVE' AND m.expires_at>clock_timestamp() AND o.status='ACTIVE'
  ORDER BY(pr.organisation_id=c.organisation_id) DESC NULLS LAST,pr.created_at DESC,pr.organisation_id LIMIT 1 FOR SHARE OF pr,m,o;
 IF NOT FOUND AND p.legacy_default_organisation_id IS NOT NULL THEN
  SELECT m.organisation_id,m.expires_at INTO oid,membership_until FROM profitia_access.memberships m
   JOIN profitia_access.organisations o USING(organisation_id)
   WHERE m.user_id=uid AND m.organisation_id=p.legacy_default_organisation_id AND m.status='ACTIVE'
    AND m.expires_at>clock_timestamp() AND o.status='ACTIVE' FOR SHARE OF m,o;
 END IF;
 deadline:=least((d->>'expiresAt')::timestamptz,nullif(current_setting('profitia.scope_expires_at',true),'')::timestamptz,
  coalesce(membership_until,'infinity'::timestamptz));
 RETURN jsonb_build_object('userId',uid,'organisationId',oid,'expiresAt',deadline);
END $fn$;
REVOKE ALL ON FUNCTION profitia_profile.organisation_context_descriptor(),profitia_profile.read_current_organisation_context(uuid) FROM PUBLIC;
