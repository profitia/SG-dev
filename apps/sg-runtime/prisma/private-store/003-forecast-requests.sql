-- Additive private delivery intent only. No original queue/schema mutation,
-- provider call, dispatcher, role provisioning or application activation.
DO $guard$ BEGIN
  IF current_user <> 'profitia_access_owner' THEN RAISE EXCEPTION 'Controlled private owner required' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM profitia_requests.installation WHERE singleton AND schema_version='1.0.0'
      AND schema_digest='0af5eed241ad1db08bfed89c95c47ef21a7dbeed0ee54bcccce52164ddcc4127') THEN
    RAISE EXCEPTION 'Accepted request reservation installation required' USING ERRCODE='42501';
  END IF;
END $guard$;
CREATE SCHEMA profitia_forecast_requests AUTHORIZATION profitia_access_owner;
REVOKE ALL ON SCHEMA profitia_forecast_requests FROM PUBLIC;
CREATE TABLE profitia_forecast_requests.installation (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  schema_version text NOT NULL CHECK(schema_version='1.0.0'),
  boundary_digest text NOT NULL CHECK(boundary_digest ~ '^[a-f0-9]{64}$'),
  source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256)
);
CREATE TABLE profitia_forecast_requests.commands (
  request_id uuid PRIMARY KEY,
  application_id text NOT NULL CHECK(application_id='spendguru'),
  environment text NOT NULL CHECK(environment IN ('development','staging','production')),
  organisation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  resource_id text NOT NULL,
  payload_digest text NOT NULL CHECK(payload_digest ~ '^[a-f0-9]{64}$'),
  decision_id uuid NOT NULL,
  command_text text NOT NULL CHECK(octet_length(command_text)<=16384),
  command_json jsonb GENERATED ALWAYS AS (command_text::jsonb) STORED,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(request_id,application_id,environment,organisation_id,user_id,payload_digest)
    REFERENCES profitia_requests.intents(request_id,application_id,environment,organisation_id,user_id,payload_digest),
  CHECK(payload_digest=encode(sha256(convert_to(command_text,'UTF8')),'hex')),
  CHECK(resource_id='forecast-request:'||payload_digest),
  CHECK(jsonb_typeof(command_json)='object' AND jsonb_typeof(command_json->'kind')='string'
    AND jsonb_typeof(command_json->'modelId')='string' AND jsonb_typeof(command_json->'seriesId')='string'
    AND jsonb_typeof(command_json->'targetSemantics')='string' AND command_json=jsonb_build_object('kind',command_json->>'kind',
    'modelId',command_json->>'modelId','seriesId',command_json->>'seriesId','targetSemantics',command_json->>'targetSemantics')),
  CHECK(command_json->>'kind' IN ('CURRENT','VERIFICATION') AND length(command_json->>'modelId')>0
    AND length(command_json->>'targetSemantics')>0 AND length(command_json->>'seriesId')>0 AND command_json->>'seriesId'<>'*')
);
ALTER TABLE profitia_forecast_requests.installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_forecast_requests.installation FORCE ROW LEVEL SECURITY;
ALTER TABLE profitia_forecast_requests.commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_forecast_requests.commands FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_installation ON profitia_forecast_requests.installation
  USING(current_user='profitia_access_owner' OR (profitia_access.runtime_descriptor()->>'applicationId')='spendguru')
  WITH CHECK(current_user='profitia_access_owner');
CREATE POLICY installation_read_fence ON profitia_forecast_requests.installation AS RESTRICTIVE FOR SELECT TO PUBLIC
  USING(current_user='profitia_access_owner' OR (profitia_access.runtime_descriptor()->>'applicationId')='spendguru');
CREATE POLICY installation_insert_fence ON profitia_forecast_requests.installation AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK(current_user='profitia_access_owner');
CREATE POLICY installation_update_fence ON profitia_forecast_requests.installation AS RESTRICTIVE FOR UPDATE TO PUBLIC
  USING(current_user='profitia_access_owner') WITH CHECK(current_user='profitia_access_owner');
CREATE POLICY installation_delete_fence ON profitia_forecast_requests.installation AS RESTRICTIVE FOR DELETE TO PUBLIC USING(current_user='profitia_access_owner');
CREATE POLICY controlled_command ON profitia_forecast_requests.commands TO profitia_access_owner USING(true) WITH CHECK(true);
CREATE POLICY command_read ON profitia_forecast_requests.commands FOR SELECT TO PUBLIC
  USING(profitia_requests.scope_allows(organisation_id,user_id,resource_id));
CREATE POLICY command_read_fence ON profitia_forecast_requests.commands AS RESTRICTIVE FOR SELECT TO PUBLIC
  USING(current_user='profitia_access_owner' OR profitia_requests.scope_allows(organisation_id,user_id,resource_id));
CREATE POLICY command_insert ON profitia_forecast_requests.commands FOR INSERT TO PUBLIC
  WITH CHECK(profitia_requests.scope_allows(organisation_id,user_id,resource_id));
CREATE POLICY command_insert_fence ON profitia_forecast_requests.commands AS RESTRICTIVE FOR INSERT TO PUBLIC
  WITH CHECK(profitia_requests.scope_allows(organisation_id,user_id,resource_id)
    AND EXISTS(SELECT 1 FROM profitia_requests.intents AS intent WHERE intent.request_id=commands.request_id
      AND intent.decision_id=commands.decision_id AND intent.resource_id=commands.resource_id AND intent.status='RESERVED'));
CREATE POLICY command_update_fence ON profitia_forecast_requests.commands AS RESTRICTIVE FOR UPDATE TO PUBLIC USING(false) WITH CHECK(false);
CREATE POLICY command_delete_fence ON profitia_forecast_requests.commands AS RESTRICTIVE FOR DELETE TO PUBLIC USING(false);
REVOKE ALL ON ALL TABLES IN SCHEMA profitia_forecast_requests FROM PUBLIC;
