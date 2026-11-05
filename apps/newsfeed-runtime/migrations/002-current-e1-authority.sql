-- Additive signed current-E1 row boundary; no data, identity or Source rewrite.
-- Install after SQL030 and exact receiver enrollment. Read proofs cannot write.
DO $policies$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['observations','monitor_runs','publications','observation_publications','notification_outbox'] LOOP
  EXECUTE format('CREATE POLICY current_e1_select ON newsfeed.%I AS RESTRICTIVE FOR SELECT TO __RUNTIME_ROLE__ USING (profitia_e1_receiver.scope_allows(application_id,organisation_id,owner_user_id,false))',t);
  EXECUTE format('CREATE POLICY current_e1_insert ON newsfeed.%I AS RESTRICTIVE FOR INSERT TO __RUNTIME_ROLE__ WITH CHECK (profitia_e1_receiver.scope_allows(application_id,organisation_id,owner_user_id,true))',t);
  EXECUTE format('CREATE POLICY current_e1_update ON newsfeed.%I AS RESTRICTIVE FOR UPDATE TO __RUNTIME_ROLE__ USING (profitia_e1_receiver.scope_allows(application_id,organisation_id,owner_user_id,true)) WITH CHECK (profitia_e1_receiver.scope_allows(application_id,organisation_id,owner_user_id,true))',t);
  EXECUTE format('CREATE POLICY current_e1_delete ON newsfeed.%I AS RESTRICTIVE FOR DELETE TO __RUNTIME_ROLE__ USING (profitia_e1_receiver.scope_allows(application_id,organisation_id,owner_user_id,true))',t);
 END LOOP;
END $policies$;
