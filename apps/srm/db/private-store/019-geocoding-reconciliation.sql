-- Owner-only history for an explicitly proved NOT_SENT technical correction.
-- No runtime reconciliation port, data grant, provider call or counter reset.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(
  SELECT 1 FROM profitia_access.installation WHERE singleton AND environment='development')
  OR NOT EXISTS(SELECT 1 FROM srm.transient_location_geocoding_installation WHERE singleton) THEN
  RAISE EXCEPTION 'Controlled Development geocoding owner required' USING ERRCODE='42501';END IF;
END $guard$;
CREATE TABLE srm.location_geocoding_reconciliations(
 reconciliation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 organisation_id uuid NOT NULL,supplier_id uuid NOT NULL,location_id uuid NOT NULL,
 previous_version bigint NOT NULL CHECK(previous_version>0),new_version bigint NOT NULL CHECK(new_version=previous_version+1),
 address_version text NOT NULL CHECK(address_version~'^[a-f0-9]{64}$'),
 previous_request_id uuid NOT NULL REFERENCES profitia_requests.intents(request_id),
 previous_status text NOT NULL CHECK(previous_status='DELIVERY_UNCERTAIN'),new_status text NOT NULL CHECK(new_status='UNREQUESTED'),
 observed_source_calls integer NOT NULL CHECK(observed_source_calls=0),
 operator_login name NOT NULL,reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 512),
 source_ref text NOT NULL CHECK(source_ref~'^[a-f0-9]{40}$')
);
ALTER TABLE srm.location_geocoding_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm.location_geocoding_reconciliations FORCE ROW LEVEL SECURITY;
CREATE POLICY owner ON srm.location_geocoding_reconciliations TO profitia_access_owner USING(true) WITH CHECK(true);
CREATE POLICY owner_fence ON srm.location_geocoding_reconciliations AS RESTRICTIVE TO PUBLIC USING(current_user='profitia_access_owner') WITH CHECK(current_user='profitia_access_owner');
REVOKE ALL ON srm.location_geocoding_reconciliations FROM PUBLIC;
CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON srm.location_geocoding_reconciliations FOR EACH ROW EXECUTE FUNCTION profitia_supplier_jobs.immutable();
CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON srm.location_geocoding_reconciliations FOR EACH STATEMENT EXECUTE FUNCTION profitia_supplier_jobs.immutable();
