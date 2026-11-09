DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR to_regprocedure('profitia_services.runtime_descriptor()') IS NULL THEN RAISE EXCEPTION 'Accepted service owner required'; END IF;
END $guard$;
ALTER TABLE profitia_services.read_grants DROP CONSTRAINT read_grants_operation_check;
ALTER TABLE profitia_services.read_grants ADD CONSTRAINT read_grants_operation_check CHECK(operation IN ('knowledge.read','forecast.read','supplier.report.read','insights.report.start','insights.report.status','insights.report.list','insights.report.download'));
ALTER TABLE profitia_services.read_grants DROP CONSTRAINT read_grants_check;
ALTER TABLE profitia_services.read_grants ADD CONSTRAINT read_grants_check CHECK(feature=CASE operation WHEN 'knowledge.read' THEN 'market' WHEN 'forecast.read' THEN 'forecast' WHEN 'supplier.report.read' THEN 'supplier_report' ELSE 'market' END);
CREATE TABLE profitia_services.report_profiles (
 login_role name NOT NULL REFERENCES profitia_services.runtime_bindings(login_role),
 organisation_id uuid NOT NULL REFERENCES profitia_access.organisations(organisation_id),
 profile_id text NOT NULL, budget_micro_usd bigint NOT NULL CHECK(budget_micro_usd BETWEEN 1 AND 5000000),
 total_budget_micro_usd bigint NOT NULL CHECK(total_budget_micro_usd>=budget_micro_usd), maximum_editions integer NOT NULL CHECK(maximum_editions BETWEEN 1 AND 1000), status text NOT NULL CHECK(status IN('ACTIVE','REVOKED')),
 source_ref text NOT NULL, expires_at timestamptz NOT NULL CHECK(isfinite(expires_at)),
 PRIMARY KEY(login_role,organisation_id,profile_id)
);
ALTER TABLE profitia_services.report_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_services.report_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON profitia_services.report_profiles TO profitia_access_owner USING(true) WITH CHECK(true);
CREATE TRIGGER authority_fence BEFORE INSERT OR UPDATE OR DELETE ON profitia_services.report_profiles FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision();
CREATE FUNCTION profitia_services.report_state(p_org uuid,p_operation text,p_resource text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_services,profitia_access AS $fn$
DECLARE d jsonb;s jsonb;expiry timestamptz;products jsonb;permissions jsonb;denies jsonb;
BEGIN
 PERFORM 1 FROM profitia_access.installation WHERE singleton FOR SHARE;
 d:=profitia_access.runtime_descriptor();s:=profitia_services.runtime_descriptor();
 IF s IS NULL OR d->>'environment'<>'development' OR p_operation NOT IN('insights.report.start','insights.report.status','insights.report.list','insights.report.download')
 OR p_org IS NULL OR p_resource IS NULL
 OR NOT (p_operation IN('insights.report.start','insights.report.list') AND p_resource='oil-asphalt' OR p_operation IN('insights.report.status','insights.report.download') AND p_resource~*'^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$')
 OR (d->>'fixedOrganisationId' IS NOT NULL AND d->>'fixedOrganisationId'<>p_org::text)
 OR NOT EXISTS(SELECT 1 FROM profitia_access.organisations WHERE organisation_id=p_org AND status='ACTIVE')
 OR NOT EXISTS(SELECT 1 FROM profitia_access.product_grants WHERE application_id=d->>'applicationId' AND organisation_id=p_org AND product='SPENDGURU' AND 'market'=ANY(features) AND status='ACTIVE' AND expires_at>clock_timestamp())
 OR NOT EXISTS(SELECT 1 FROM profitia_access.product_grants WHERE application_id='spendguru' AND organisation_id=p_org AND product='SPENDGURU' AND 'market'=ANY(features) AND status='ACTIVE' AND expires_at>clock_timestamp()) THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM profitia_services.read_grants WHERE login_role=session_user AND organisation_id=p_org AND operation=p_operation AND feature='market' AND effect='ALLOW' AND status='ACTIVE' AND expires_at>clock_timestamp() AND(resource_id IS NULL OR resource_id=p_resource))
 OR EXISTS(SELECT 1 FROM profitia_services.read_grants WHERE login_role=session_user AND organisation_id=p_org AND operation=p_operation AND effect='DENY' AND status='ACTIVE' AND expires_at>clock_timestamp() AND(resource_id IS NULL OR resource_id=p_resource)) THEN RETURN NULL; END IF;
 SELECT least((s->>'expiresAt')::timestamptz,min(expires_at),clock_timestamp()+interval '15 seconds') INTO expiry FROM profitia_services.read_grants WHERE login_role=session_user AND organisation_id=p_org AND status='ACTIVE' AND expires_at>clock_timestamp() AND operation=p_operation;
 SELECT jsonb_agg(jsonb_build_object('product',product,'features',features,'organisationId',organisation_id,'environment','development','applicationId',application_id,'status',status,'version',version::text,'sourceRef',source_ref,'source',source,'expiresAt',expires_at)) INTO products FROM profitia_access.product_grants WHERE application_id=d->>'applicationId' AND organisation_id=p_org;
 SELECT coalesce(jsonb_agg(jsonb_build_object('operation',operation,'feature',feature,'resourceId',resource_id)) FILTER(WHERE effect='ALLOW'),'[]'),coalesce(jsonb_agg(jsonb_build_object('operation',operation,'feature',feature,'resourceId',resource_id)) FILTER(WHERE effect='DENY'),'[]') INTO permissions,denies FROM profitia_services.read_grants WHERE login_role=session_user AND organisation_id=p_org AND status='ACTIVE' AND expires_at>clock_timestamp();
 RETURN jsonb_build_object('applicationId',d->>'applicationId','environment','development','policyVersion','report-e1-v1:'||(d->>'revision'),'transactionId',txid_current()::text,'products',products,'usagePolicy','NOT_APPLICABLE',
 'actor',jsonb_build_object('kind','SERVICE','actorId',s->>'serviceId','serviceId',s->>'serviceId','proofRef',s->>'proofRef','issuer','urn:profitia:database-service-runtime:v1','audience',d->>'applicationId','environment','development','expiresAt',expiry),
 'access',jsonb_build_object('type','SERVICE_GRANT','actorId',s->>'serviceId','organisationId',p_org,'status','ACTIVE','version',(s->>'proofRef')||':'||(d->>'revision'),'sourceRef',s->>'sourceRef','expiresAt',expiry,'permissions',permissions,'denies',denies));
END $fn$;
CREATE TABLE profitia_services.report_reservations (
 login_role name NOT NULL,organisation_id uuid NOT NULL,profile_id text NOT NULL,
 edition_key text NOT NULL CHECK(edition_key~'^[a-f0-9]{64}$'),reserved_micro_usd bigint NOT NULL,
 PRIMARY KEY(login_role,organisation_id,profile_id,edition_key),
 FOREIGN KEY(login_role,organisation_id,profile_id) REFERENCES profitia_services.report_profiles(login_role,organisation_id,profile_id)
);
ALTER TABLE profitia_services.report_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_services.report_reservations FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON profitia_services.report_reservations TO profitia_access_owner USING(true) WITH CHECK(true);
CREATE FUNCTION profitia_services.claim_report_profile(p_org uuid,p_profile text,p_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_services AS $fn$
DECLARE s jsonb;p profitia_services.report_profiles%ROWTYPE;used bigint;n integer;
BEGIN
 s:=profitia_services.report_state(p_org,'insights.report.start','oil-asphalt');
 IF s IS NULL OR p_key!~'^[a-f0-9]{64}$' THEN RETURN NULL; END IF;
 SELECT * INTO p FROM profitia_services.report_profiles WHERE login_role=session_user AND organisation_id=p_org AND profile_id=p_profile AND status='ACTIVE' AND expires_at>clock_timestamp() FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM profitia_services.report_reservations WHERE login_role=session_user AND organisation_id=p_org AND profile_id=p_profile AND edition_key=p_key) THEN
  SELECT count(*),coalesce(sum(reserved_micro_usd),0) INTO n,used FROM profitia_services.report_reservations WHERE login_role=session_user AND organisation_id=p_org AND profile_id=p_profile;
  IF n>=p.maximum_editions OR used+p.budget_micro_usd>p.total_budget_micro_usd THEN RETURN NULL; END IF;
  INSERT INTO profitia_services.report_reservations VALUES(session_user,p_org,p_profile,p_key,p.budget_micro_usd);
 END IF;
 RETURN jsonb_build_object('profileId',p.profile_id,'budgetMicroUsd',p.budget_micro_usd,'expiresAt',p.expires_at,'receiptRef',p.source_ref);
END $fn$;
CREATE FUNCTION profitia_services.report_organisations() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_services AS $fn$
BEGIN
 IF profitia_services.runtime_descriptor() IS NULL THEN RETURN '[]'::jsonb; END IF;
 -- Scan current own report scope even when its financial profile expired, so
 -- existing jobs can truthfully reach WAITING_AUTHORIZATION without any I/O.
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('organisationId',organisation_id)),'[]') FROM
  (SELECT DISTINCT organisation_id FROM profitia_services.read_grants WHERE login_role=session_user
   AND operation='insights.report.start' AND status='ACTIVE' AND effect='ALLOW' AND expires_at>clock_timestamp()) g
  WHERE profitia_services.report_state(organisation_id,'insights.report.start','oil-asphalt') IS NOT NULL);
END $fn$;
REVOKE ALL ON profitia_services.report_profiles FROM PUBLIC;
REVOKE ALL ON FUNCTION profitia_services.report_state(uuid,text,text),profitia_services.claim_report_profile(uuid,text,text),profitia_services.report_organisations() FROM PUBLIC;

CREATE FUNCTION profitia_services.report_source_grant(p_org uuid,p_resource text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_services AS $fn$
DECLARE g profitia_services.read_grants%ROWTYPE;
BEGIN
 IF profitia_services.report_state(p_org,'insights.report.start','oil-asphalt') IS NULL OR p_resource!~'^api[.][a-z-]+[.][a-z-]+$' THEN RETURN NULL; END IF;
 SELECT * INTO g FROM profitia_services.read_grants WHERE login_role=session_user AND organisation_id=p_org AND operation='knowledge.read' AND feature='market' AND resource_id=p_resource AND effect='ALLOW' AND status='ACTIVE' AND expires_at>clock_timestamp();
 IF NOT FOUND OR EXISTS(SELECT 1 FROM profitia_services.read_grants WHERE login_role=session_user AND organisation_id=p_org AND operation='knowledge.read' AND effect='DENY' AND status='ACTIVE' AND expires_at>clock_timestamp() AND(resource_id IS NULL OR resource_id=p_resource)) THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('grantId',g.grant_id,'expiresAt',g.expires_at,'sourceRef',g.source_ref);
END $fn$;
REVOKE ALL ON profitia_services.report_reservations FROM PUBLIC;
REVOKE ALL ON FUNCTION profitia_services.report_source_grant(uuid,text) FROM PUBLIC;

-- Same canonical security event writer, bounded to these report operations.
CREATE FUNCTION profitia_services.report_append_audit(p_event jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;s jsonb;state jsonb;effect text;
BEGIN
 d:=profitia_access.runtime_descriptor();s:=profitia_services.runtime_descriptor();
 IF d IS NULL OR s IS NULL OR jsonb_typeof(p_event) IS DISTINCT FROM 'object'
 OR p_event->>'applicationId' IS DISTINCT FROM d->>'applicationId'
 OR p_event->>'environment' IS DISTINCT FROM 'development'
 OR p_event->>'operation' NOT IN('insights.report.start','insights.report.status','insights.report.list','insights.report.download')
 OR p_event->>'subjectUserId' IS NOT NULL OR p_event?'moduleEvidence'
 OR p_event->>'actorKind' IS DISTINCT FROM 'SERVICE' OR p_event->>'actorId' IS DISTINCT FROM s->>'serviceId'
 OR p_event->>'identityIssuer' IS DISTINCT FROM 'urn:profitia:database-service-runtime:v1'
 OR p_event->>'identityAudience' IS DISTINCT FROM d->>'applicationId'
 THEN RAISE EXCEPTION 'Report SERVICE audit refused' USING ERRCODE='42501'; END IF;
 IF p_event->>'decision'='ALLOW' THEN
  state:=profitia_services.report_state((p_event->>'organisationId')::uuid,p_event->>'operation',p_event->>'resourceId');
  effect:=CASE p_event->>'operation' WHEN 'insights.report.start' THEN 'WRITE' WHEN 'insights.report.download' THEN 'EXPORT' ELSE 'READ' END;
  IF state IS NULL OR p_event->>'phase' NOT IN('INTENT','OUTCOME')
  OR p_event->>'applicationProfile' IS DISTINCT FROM s->>'profileId'
  OR p_event->>'deploymentId' IS DISTINCT FROM s->>'deploymentId'
  OR p_event->>'configurationVersion' IS DISTINCT FROM s->>'configurationVersion'
  OR p_event->>'identityProofRef' IS DISTINCT FROM s->>'proofRef'
  OR p_event->>'mode' IS DISTINCT FROM 'ORGANISATION'
  OR p_event->>'accessBasisType' IS DISTINCT FROM 'SERVICE_GRANT'
  OR p_event->>'accessSourceRef' IS DISTINCT FROM s->>'sourceRef'
  OR p_event->>'policyVersion' IS DISTINCT FROM state->>'policyVersion'
  OR p_event->>'accessVersion' IS DISTINCT FROM state->'access'->>'version'
  OR p_event->>'feature' IS DISTINCT FROM 'market' OR p_event->>'resourceType' IS DISTINCT FROM 'insights_report'
  OR p_event->>'usagePolicy' IS DISTINCT FROM 'NOT_APPLICABLE' OR p_event->>'effect' IS DISTINCT FROM effect
  OR p_event->>'dataClass' IS DISTINCT FROM 'ORGANISATION_PRIVATE'
  OR p_event->>'ownerOrganisationId' IS DISTINCT FROM p_event->>'organisationId' OR p_event->>'ownerUserId' IS NOT NULL
  THEN RAISE EXCEPTION 'Current report audit scope refused' USING ERRCODE='42501'; END IF;
 ELSIF p_event->>'decision' IS DISTINCT FROM 'DENY' OR p_event->>'phase' NOT IN('DECISION','FAILURE') THEN
  RAISE EXCEPTION 'Report audit decision refused' USING ERRCODE='42501';
 END IF;
 PERFORM profitia_access.append_audit(p_event);
END $fn$;
REVOKE ALL ON FUNCTION profitia_services.report_append_audit(jsonb) FROM PUBLIC;
