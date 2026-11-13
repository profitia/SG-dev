-- Optional, controlled owner installation. No table INSERT is granted to a runtime.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
  AND(rolcanlogin OR rolsuper OR rolinherit OR rolbypassrls OR rolcreatedb OR rolcreaterole))
  OR to_regclass('srm.organizations') IS NULL OR to_regclass('profitia_profile.organisation_profiles') IS NULL
  OR to_regclass('profitia_modules.audit_installation') IS NULL
 THEN RAISE EXCEPTION 'CONTROLLED_REGISTERED_SRM_OWNER_REQUIRED';END IF;
END $guard$;
CREATE TABLE srm.organisation_registration_installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'));
ALTER TABLE srm.organisation_registration_installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm.organisation_registration_installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON srm.organisation_registration_installation TO profitia_access_owner USING(true) WITH CHECK(true);
REVOKE ALL ON TABLE srm.organisation_registration_installation FROM PUBLIC;
CREATE FUNCTION srm.ensure_registered_organisation(p_org uuid,p_digest text,p_decision uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $fn$
DECLARE d jsonb;uid uuid;
BEGIN
 d:=profitia_access.runtime_descriptor();
 uid:=nullif(current_setting('profitia.user_id',true),'')::uuid;
 IF p_org IS NULL OR p_decision IS NULL OR d->>'applicationId'<>'srm' OR d->>'environment'<>'development'
  OR p_org IS DISTINCT FROM nullif(current_setting('profitia.organisation_id',true),'')::uuid
  OR profitia_modules.scope_allows('supplier_report',p_org,uid) IS NOT TRUE
  OR NOT EXISTS(SELECT 1 FROM srm.organisation_registration_installation WHERE singleton AND schema_digest=p_digest)
  OR NOT EXISTS(SELECT 1 FROM profitia_access.security_events WHERE application_id='srm' AND decision_id=p_decision
   AND phase='INTENT' AND event->>'organisationId'=p_org::text AND event->>'actorId'=uid::text
   AND event->>'decision'='ALLOW' AND event->>'implementationVersion'='1.0.0-candidate.16')
 THEN RAISE EXCEPTION 'CURRENT_SRM_ROOT_INTENT_REQUIRED' USING ERRCODE='PT403';END IF;
 IF EXISTS(SELECT 1 FROM srm.organizations WHERE id=p_org) THEN RETURN true;END IF;
 IF NOT EXISTS(SELECT 1 FROM profitia_access.organisations o JOIN profitia_profile.organisation_profiles p USING(organisation_id)
  WHERE o.organisation_id=p_org AND o.status='ACTIVE')
 THEN RAISE EXCEPTION 'CANONICAL_REGISTERED_ORGANISATION_REQUIRED' USING ERRCODE='PT403';END IF;
 -- Internal domain key is independent of the public organisation address.
 -- A retry never renames/reassigns a legacy row or copies another tenant's data.
 INSERT INTO srm.organizations(id,slug) VALUES(p_org,'org-'||p_org::text) ON CONFLICT(id) DO NOTHING;
 RETURN EXISTS(SELECT 1 FROM srm.organizations WHERE id=p_org);
END $fn$;
REVOKE ALL ON FUNCTION srm.ensure_registered_organisation(uuid,text,uuid) FROM PUBLIC;
