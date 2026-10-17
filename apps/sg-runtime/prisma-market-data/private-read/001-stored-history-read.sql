-- Additive source boundary. Execute atomically as the controlled NOLOGIN owner
-- after granting that owner only the source columns named by these views.
-- No login, runtime grant, receipt, activation or business data is created here.
SET LOCAL search_path=pg_catalog,pg_temp;
DO $$ BEGIN
  IF current_user <> 'profitia_market_read_owner' OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=current_user AND
      (rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb)
  ) THEN RAISE EXCEPTION 'Controlled market projection owner required'; END IF;
END $$;

CREATE SCHEMA profitia_market_read AUTHORIZATION profitia_market_read_owner;
REVOKE ALL ON SCHEMA profitia_market_read FROM PUBLIC;

CREATE TABLE profitia_market_read.installation (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  schema_version text NOT NULL CHECK(schema_version='1.0.0'),
  schema_digest text NOT NULL CHECK(schema_digest ~ '^[a-f0-9]{64}$'),
  project_id text NOT NULL CHECK(length(project_id) BETWEEN 1 AND 128),
  branch_id text NOT NULL CHECK(length(branch_id) BETWEEN 1 AND 128),
  database_name text NOT NULL CHECK(length(database_name) BETWEEN 1 AND 128),
  runtime_role name NOT NULL,
  source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256),
  expires_at timestamptz NOT NULL
);
ALTER TABLE profitia_market_read.installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_market_read.installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON profitia_market_read.installation
  TO profitia_market_read_owner USING(true) WITH CHECK(true);
CREATE POLICY own_runtime_receipt ON profitia_market_read.installation FOR SELECT
  USING(runtime_role::text=session_user AND database_name=current_database());

CREATE VIEW profitia_market_read.series WITH(security_barrier=true) AS
SELECT "id", "providerCode", "providerSeriesId", "providerSeriesKey", "displayName",
  "frequency", "currency", "unit", "sourceLabel"
FROM public.market_series WHERE "providerCode"='MACROBOND';

CREATE VIEW profitia_market_read.observations WITH(security_barrier=true) AS
SELECT s."providerSeriesId", o."observedAt", o."value"
FROM public.market_observations o JOIN public.market_series s ON s."id"=o."seriesId"
WHERE s."providerCode"='MACROBOND';

REVOKE ALL ON ALL TABLES IN SCHEMA profitia_market_read FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_market_read FROM PUBLIC;
