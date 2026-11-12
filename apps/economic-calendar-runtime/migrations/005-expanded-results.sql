-- Additive publication/reference rule; existing observations and links stay intact.
DO $guard$ BEGIN
 IF current_user<>'economic_calendar_development_owner' OR NOT EXISTS(SELECT 1 FROM economic_calendar.installation WHERE singleton AND notification_schema_digest IS NOT NULL)
 THEN RAISE EXCEPTION 'ECR owner and notification predecessor required';END IF;
END $guard$;
ALTER TABLE economic_calendar.installation ADD COLUMN expanded_results_schema_digest text CHECK(expanded_results_schema_digest~'^[a-f0-9]{64}$');
ALTER TABLE economic_calendar.result_links DROP CONSTRAINT result_links_method_check;
ALTER TABLE economic_calendar.result_links ADD CONSTRAINT result_links_method_check CHECK(method IN('EXACT_EIA_WPSR_REFERENCE_PERIOD/1','EXACT_EIA_PUBLICATION_REFERENCE_PERIOD/2'));
