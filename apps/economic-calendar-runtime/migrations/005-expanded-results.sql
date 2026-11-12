-- Additive publication/reference rule; existing observations and links stay intact.
DO $guard$ BEGIN
 IF current_user<>'economic_calendar_development_owner' OR NOT EXISTS(SELECT 1 FROM economic_calendar.installation WHERE singleton AND notification_schema_digest IS NOT NULL)
 THEN RAISE EXCEPTION 'ECR owner and notification predecessor required';END IF;
END $guard$;
ALTER TABLE economic_calendar.installation ADD COLUMN expanded_results_schema_digest text CHECK(expanded_results_schema_digest~'^[a-f0-9]{64}$');
ALTER TABLE economic_calendar.result_links DROP CONSTRAINT result_links_method_check;
ALTER TABLE economic_calendar.result_links ADD CONSTRAINT result_links_method_check CHECK(method IN('EXACT_EIA_WPSR_REFERENCE_PERIOD/1','EXACT_EIA_PUBLICATION_REFERENCE_PERIOD/2'));

-- Retained facts keep the owner basis recorded when acquired. A later basis
-- must not hide those facts or rewrite provenance. Historical admission alone
-- never re-enables a revoked licence or a series excluded by the current scope.
-- Keep the existing EXECUTE ACL and expose no history-table privileges.
CREATE OR REPLACE FUNCTION economic_calendar.result_allowed(provider text,dataset text,series text,licence text,basis text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT EXISTS(
  SELECT 1 FROM economic_calendar.result_storage_policies p
  WHERE p.provider_id=provider AND p.dataset_id=dataset AND p.status='ACTIVE'
   AND series=ANY(p.series_ids) AND p.licence_ref=licence
   AND(p.basis_ref=basis OR EXISTS(
    SELECT 1 FROM(
     SELECT h.status,h.series_ids,h.licence_ref
     FROM economic_calendar.result_storage_policy_history h
     WHERE h.provider_id=p.provider_id AND h.family=p.family AND h.dataset_id=p.dataset_id
      AND h.basis_ref=basis AND h.version<=p.version
     ORDER BY h.version DESC LIMIT 1
    ) h WHERE h.status='ACTIVE' AND series=ANY(h.series_ids) AND h.licence_ref=licence)))
$fn$;

-- Historical READ authority is not permission for a new write under an old
-- owner decision. Retain the original strict current-basis INSERT/UPDATE fence.
ALTER POLICY result_ingester ON economic_calendar.result_observations WITH CHECK(
 EXISTS(SELECT 1 FROM economic_calendar.result_storage_policies p
  WHERE p.provider_id=result_observations.provider_id AND p.dataset_id=result_observations.dataset_id
   AND p.status='ACTIVE' AND result_observations.series_id=ANY(p.series_ids)
   AND p.licence_ref=result_observations.licence_ref AND p.basis_ref=result_observations.basis_ref));
