-- Optional first-report extension; leaves ordinary Source timeouts unchanged.
-- Install after 028 using the restricted Source installation owner.
DO $owner$ BEGIN
 IF current_user<>'profitia_ingestion_owner'
  OR to_regnamespace('profitia_model_execution') IS NULL THEN
  RAISE EXCEPTION 'Restricted model installation required' USING ERRCODE='42501';
 END IF;
END $owner$;
ALTER TABLE profitia_external_call.policies DROP CONSTRAINT policies_timeout_ms_check;
ALTER TABLE profitia_external_call.policies ADD CONSTRAINT policies_timeout_ms_check CHECK (
 timeout_ms BETWEEN 100 AND 120000 OR (
  timeout_ms=600000 AND source_id='sg2.oil-report.openai'
  AND resource_id='sg2-oil-report:compose'
  AND login_role='sg2_oil_composer_development_source_runtime'
  AND origin='https://api.openai.com' AND transport='HTTPS'
  AND path_rules='[{"method":"POST","path":"/v1/responses"}]'::jsonb
  AND capacity=1
 )
);
