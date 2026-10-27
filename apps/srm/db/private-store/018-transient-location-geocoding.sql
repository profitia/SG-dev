-- Additive Development receiver: Google results stay in the active view only.
-- No Google coordinates, place ID, response or formatted address are persisted.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
  AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication))
  OR NOT EXISTS(SELECT 1 FROM srm.supplier_location_installation WHERE singleton AND schema_version='1.0.0'
   AND schema_digest='b3f05a4c56f32bd32c0c59dcc8b60c486d4d4813823665301ce08318f793704b') THEN
  RAISE EXCEPTION 'Controlled owner and exact location installation required' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM profitia_access.installation WHERE singleton FOR UPDATE;
END $guard$;

CREATE TABLE srm.transient_location_geocoding_installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),source_ref text NOT NULL CHECK(source_ref~'^[a-f0-9]{40}$')
);
ALTER TABLE srm.transient_location_geocoding_installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm.transient_location_geocoding_installation FORCE ROW LEVEL SECURITY;
CREATE POLICY owner ON srm.transient_location_geocoding_installation TO profitia_access_owner USING(true) WITH CHECK(true);
CREATE POLICY owner_fence ON srm.transient_location_geocoding_installation AS RESTRICTIVE TO PUBLIC USING(current_user='profitia_access_owner') WITH CHECK(current_user='profitia_access_owner');
REVOKE ALL ON srm.transient_location_geocoding_installation FROM PUBLIC;
CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON srm.transient_location_geocoding_installation FOR EACH ROW EXECUTE FUNCTION profitia_supplier_jobs.immutable();
CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON srm.transient_location_geocoding_installation FOR EACH STATEMENT EXECUTE FUNCTION profitia_supplier_jobs.immutable();

CREATE FUNCTION srm.location_geocode_transient_complete(p_request uuid,p_location uuid,p_address text,p_version bigint,p_schema text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;r profitia_requests.intents%ROWTYPE;l srm.supplier_locations%ROWTYPE;BEGIN
 d:=srm.location_work_context(p_request,'MAPS_GEOCODE_SAVE','WRITE');
 IF d IS NULL OR NOT EXISTS(SELECT 1 FROM srm.transient_location_geocoding_installation
  WHERE singleton AND schema_version='1.0.0' AND schema_digest=p_schema) THEN
  RAISE EXCEPTION 'Transient geocode receiver unavailable' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM profitia_requests.intents WHERE request_id=p_request AND application_id='srm' AND status='ACCEPTED'
  AND operation='supplier.location.geocode' AND organisation_id=(d->>'organisationId')::uuid
  AND user_id=(d->>'subjectUserId')::uuid AND payload_digest=d->>'payloadDigest';
 IF NOT FOUND OR r.location_scope->>'locationId' IS DISTINCT FROM p_location::text
  OR r.location_scope->>'addressVersion' IS DISTINCT FROM p_address OR r.location_scope->>'targetVersion' IS DISTINCT FROM p_version::text THEN
  RAISE EXCEPTION 'Geocode target changed' USING ERRCODE='40001';END IF;
 SELECT * INTO l FROM srm.supplier_locations WHERE organization_id=r.organisation_id
  AND supplier_id=(r.location_scope->>'supplierId')::uuid AND location_id=p_location FOR UPDATE;
 IF NOT FOUND OR l.lifecycle<>'ACTIVE' OR l.address_version IS DISTINCT FROM p_address OR l.version IS DISTINCT FROM p_version
  OR l.body->'coordinates' IS DISTINCT FROM 'null'::jsonb OR l.retention_until<=clock_timestamp()
  OR srm.location_work_sources_current(l.organization_id,l.body->'sources') IS NOT TRUE THEN
  RAISE EXCEPTION 'Geocode target changed' USING ERRCODE='40001';END IF;
 -- Advancing the CAS version ends this exact admitted command. A later view
 -- can request its own result without replaying a settled provider attempt.
 UPDATE srm.supplier_locations SET version=version+1,updated_at=clock_timestamp(),
  updated_by_user_id=r.user_id,audit_request_id=p_request
 WHERE organization_id=l.organization_id AND supplier_id=l.supplier_id AND location_id=l.location_id;
 RETURN (l.version+1)::text;
END $fn$;
REVOKE ALL ON FUNCTION srm.location_geocode_transient_complete(uuid,uuid,text,bigint,text) FROM PUBLIC;
