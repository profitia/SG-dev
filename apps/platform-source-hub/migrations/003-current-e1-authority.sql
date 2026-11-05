-- Additive current E1 row boundary; no data rewrite, directory or Source grants.
-- Install only after SQL030 and the exact receiver runtime enrollment.
DO $policies$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['acquisitions','source_records','provider_usage'] LOOP
  EXECUTE format('CREATE POLICY current_e1_scope ON source_hub.%I AS RESTRICTIVE TO __RUNTIME_ROLE__ USING (profitia_e1_receiver.scope_allows(application_id,organisation_id,owner_user_id)) WITH CHECK (profitia_e1_receiver.scope_allows(application_id,organisation_id,owner_user_id))',t);
 END LOOP;
END $policies$;
