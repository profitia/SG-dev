-- Private AM23 command boundary only. No role grant, activation, provider I/O
-- or global catalogue write. Apply only after accepted SQL006 and SQL010.
DO $guard$ BEGIN
  IF current_user <> 'profitia_access_owner' OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=current_user
      AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
      AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=oid)
  ) OR NOT EXISTS(SELECT 1 FROM profitia_requests.installation WHERE singleton
    AND schema_digest='0af5eed241ad1db08bfed89c95c47ef21a7dbeed0ee54bcccce52164ddcc4127')
    OR NOT EXISTS(SELECT 1 FROM profitia_requests.external_installation WHERE singleton
    AND schema_digest='8244a3a02d4ef5821822a6684023148c41bc9caac355c9f1200215e1a339df79')
  THEN RAISE EXCEPTION 'Controlled supplier request owner and accepted ledger required' USING ERRCODE='42501'; END IF;
END $guard$;
CREATE SCHEMA profitia_supplier_requests AUTHORIZATION profitia_access_owner;
REVOKE ALL ON SCHEMA profitia_supplier_requests FROM PUBLIC;
CREATE TABLE profitia_supplier_requests.installation (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  schema_version text NOT NULL CHECK(schema_version='1.0.0'),
  boundary_digest text NOT NULL CHECK(boundary_digest ~ '^[a-f0-9]{64}$'),
  source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256)
);
CREATE TABLE profitia_supplier_requests.commands (
  request_id uuid PRIMARY KEY,
  application_id text NOT NULL CHECK(application_id='srm'),
  environment text NOT NULL CHECK(environment IN ('development','staging','production')),
  organisation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  resource_id text NOT NULL,
  payload_digest text NOT NULL CHECK(payload_digest ~ '^[a-f0-9]{64}$'),
  decision_id uuid NOT NULL,
  command_text text NOT NULL CHECK(octet_length(command_text)<=1024),
  command_json jsonb GENERATED ALWAYS AS (command_text::jsonb) STORED,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(request_id,application_id,environment,organisation_id,user_id,payload_digest)
    REFERENCES profitia_requests.intents(request_id,application_id,environment,organisation_id,user_id,payload_digest),
  CHECK(payload_digest=encode(sha256(convert_to(command_text,'UTF8')),'hex')),
  CHECK(resource_id='supplier-request:'||payload_digest),
  CHECK(jsonb_typeof(command_json)='object' AND command_json->>'kind'='SUPPLIER_REPORT'
    AND jsonb_typeof(command_json->'nip')='string' AND command_json->>'nip' ~ '^[0-9]{10}$'
    AND command_json->>'nip'<>'0000000000'
    AND command_json=jsonb_build_object('kind','SUPPLIER_REPORT','nip',command_json->>'nip')),
  CHECK((substr(command_json->>'nip',1,1)::int*6+substr(command_json->>'nip',2,1)::int*5
    +substr(command_json->>'nip',3,1)::int*7+substr(command_json->>'nip',4,1)::int*2
    +substr(command_json->>'nip',5,1)::int*3+substr(command_json->>'nip',6,1)::int*4
    +substr(command_json->>'nip',7,1)::int*5+substr(command_json->>'nip',8,1)::int*6
    +substr(command_json->>'nip',9,1)::int*7)%11=substr(command_json->>'nip',10,1)::int)
);
ALTER TABLE profitia_supplier_requests.installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_supplier_requests.installation FORCE ROW LEVEL SECURITY;
ALTER TABLE profitia_supplier_requests.commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_supplier_requests.commands FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_installation ON profitia_supplier_requests.installation TO profitia_access_owner USING(true) WITH CHECK(true);
CREATE POLICY installation_read ON profitia_supplier_requests.installation FOR SELECT TO PUBLIC
  USING((profitia_access.runtime_descriptor()->>'applicationId')='srm');
CREATE POLICY installation_read_fence ON profitia_supplier_requests.installation AS RESTRICTIVE FOR SELECT TO PUBLIC
  USING(current_user='profitia_access_owner' OR (profitia_access.runtime_descriptor()->>'applicationId')='srm');
CREATE POLICY installation_insert_fence ON profitia_supplier_requests.installation AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK(current_user='profitia_access_owner');
CREATE POLICY installation_update_fence ON profitia_supplier_requests.installation AS RESTRICTIVE FOR UPDATE TO PUBLIC
  USING(current_user='profitia_access_owner') WITH CHECK(current_user='profitia_access_owner');
CREATE POLICY installation_delete_fence ON profitia_supplier_requests.installation AS RESTRICTIVE FOR DELETE TO PUBLIC USING(current_user='profitia_access_owner');
CREATE POLICY controlled_command ON profitia_supplier_requests.commands TO profitia_access_owner USING(true) WITH CHECK(true);
CREATE POLICY command_read ON profitia_supplier_requests.commands FOR SELECT TO PUBLIC
  USING(application_id='srm' AND application_id=(profitia_access.runtime_descriptor()->>'applicationId')
    AND environment=(profitia_access.runtime_descriptor()->>'environment')
    AND profitia_requests.scope_allows('supplier.report.refresh',organisation_id,user_id,resource_id));
CREATE POLICY command_read_fence ON profitia_supplier_requests.commands AS RESTRICTIVE FOR SELECT TO PUBLIC
  USING(current_user='profitia_access_owner' OR (application_id='srm'
    AND application_id=(profitia_access.runtime_descriptor()->>'applicationId')
    AND environment=(profitia_access.runtime_descriptor()->>'environment')
    AND profitia_requests.scope_allows('supplier.report.refresh',organisation_id,user_id,resource_id)));
CREATE POLICY command_insert ON profitia_supplier_requests.commands FOR INSERT TO PUBLIC
  WITH CHECK(application_id='srm' AND application_id=(profitia_access.runtime_descriptor()->>'applicationId')
    AND environment=(profitia_access.runtime_descriptor()->>'environment')
    AND profitia_requests.scope_allows('supplier.report.refresh',organisation_id,user_id,resource_id));
CREATE POLICY command_insert_fence ON profitia_supplier_requests.commands AS RESTRICTIVE FOR INSERT TO PUBLIC
  WITH CHECK(application_id='srm' AND application_id=(profitia_access.runtime_descriptor()->>'applicationId')
    AND environment=(profitia_access.runtime_descriptor()->>'environment')
    AND profitia_requests.scope_allows('supplier.report.refresh',organisation_id,user_id,resource_id)
    AND EXISTS(SELECT 1 FROM profitia_requests.intents AS intent WHERE intent.request_id=commands.request_id
      AND intent.application_id=commands.application_id AND intent.operation='supplier.report.refresh'
      AND intent.environment=commands.environment AND intent.organisation_id=commands.organisation_id
      AND intent.user_id=commands.user_id AND intent.payload_digest=commands.payload_digest
      AND intent.decision_id=commands.decision_id AND intent.resource_id=commands.resource_id AND intent.status='RESERVED'));
CREATE POLICY command_update_fence ON profitia_supplier_requests.commands AS RESTRICTIVE FOR UPDATE TO PUBLIC USING(false) WITH CHECK(false);
CREATE POLICY command_delete_fence ON profitia_supplier_requests.commands AS RESTRICTIVE FOR DELETE TO PUBLIC USING(false);
REVOKE ALL ON ALL TABLES IN SCHEMA profitia_supplier_requests FROM PUBLIC;
