-- Additive current E1 row boundary; no data rewrite, directory or Source grants.
-- Install only after SQL030 and the exact receiver runtime enrollment.
DO $policies$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['observations','monitor_runs','publications','observation_publications','notification_outbox'] LOOP
  EXECUTE format('CREATE POLICY current_e1_scope ON newsfeed.%I AS RESTRICTIVE TO __RUNTIME_ROLE__ USING (profitia_e1_receiver.scope_allows(application_id,organisation_id,owner_user_id)) WITH CHECK (profitia_e1_receiver.scope_allows(application_id,organisation_id,owner_user_id))',t);
 END LOOP;
END $policies$;
