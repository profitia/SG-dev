-- Additive directory metadata and an immutable operator-bootstrap receipt.
-- This migration creates no account, organisation, grant or application binding.
DO $guard$ BEGIN
  IF current_user <> 'profitia_access_owner' OR EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname=current_user AND
      (rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole)
  ) THEN RAISE EXCEPTION 'Explicit controlled owner required' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM profitia_access.installation WHERE singleton
      AND database_name=current_database() AND schema_version='1.0.0'
      AND schema_digest='356463492c3304ca11fa533f6e99f1d41628a3ab830488142c6030fb9a920ff2'
  ) OR NOT EXISTS (
    SELECT 1 FROM profitia_modules.installation WHERE singleton
      AND schema_digest='c4ea1883af310934b1e83dfcf936ba15dfc32a3f4be206c752efe2d69a55b9ed'
  ) OR NOT EXISTS (
    SELECT 1 FROM profitia_modules.audit_installation WHERE singleton
      AND schema_digest='af296074b8b4dab2f952e1d2e0553e17d6567f480152870d151dc36c9302e6ac'
  ) THEN RAISE EXCEPTION 'Accepted private store and explicit controlled owner required'; END IF;
END $guard$;

-- Nullable for compatibility with pre-existing identities; names confer no rights.
ALTER TABLE profitia_access.accounts ADD COLUMN display_name text
  CHECK(display_name IS NULL OR (length(btrim(display_name)) BETWEEN 1 AND 256
    AND display_name=btrim(display_name)));
ALTER TABLE profitia_access.organisations ADD COLUMN display_name text
  CHECK(display_name IS NULL OR (length(btrim(display_name)) BETWEEN 1 AND 256
    AND display_name=btrim(display_name)));

CREATE TABLE profitia_access.directory_installation (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  schema_version text NOT NULL CHECK(schema_version='1.0.0'),
  schema_digest text NOT NULL CHECK(schema_digest ~ '^[a-f0-9]{64}$')
);
CREATE TABLE profitia_access.bootstrap_receipts (
  receipt_id uuid PRIMARY KEY,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  database_session_user name NOT NULL DEFAULT session_user,
  -- Historical references are checked at insertion, not foreign keys that
  -- would prevent future authorised revocation or identity-provider migration.
  organisation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  external_binding_id uuid NOT NULL,
  plan_digest text NOT NULL CHECK(plan_digest ~ '^[a-f0-9]{64}$'),
  source_ref text NOT NULL CHECK(source_ref ~ '^[A-Za-z0-9][A-Za-z0-9:/_.-]{0,255}$'
    AND source_ref !~* '(gh[pousr]_|sk_(live|test)_|postgres(ql)?://)'),
  actor_ref text NOT NULL CHECK(actor_ref ~ '^[A-Za-z0-9][A-Za-z0-9:/_.-]{0,255}$'
    AND actor_ref !~* '(gh[pousr]_|sk_(live|test)_|postgres(ql)?://)')
);
DO $policies$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['directory_installation','bootstrap_receipts'] LOOP
    EXECUTE format('ALTER TABLE profitia_access.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE profitia_access.%I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY controlled_owner ON profitia_access.%I TO profitia_access_owner USING(true) WITH CHECK(true)',t);
    EXECUTE format('REVOKE ALL ON TABLE profitia_access.%I FROM PUBLIC',t);
  END LOOP;
END $policies$;
CREATE FUNCTION profitia_access.protect_bootstrap_receipts() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,profitia_access AS $fn$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NOT EXISTS(SELECT 1 FROM profitia_access.memberships m
      JOIN profitia_access.accounts u USING(user_id)
      JOIN profitia_access.organisations o USING(organisation_id)
      JOIN profitia_access.external_identities e ON e.user_id=u.user_id
      WHERE m.organisation_id=NEW.organisation_id AND m.user_id=NEW.user_id
        AND e.binding_id=NEW.external_binding_id AND e.status='ACTIVE' AND e.expires_at>clock_timestamp()
        AND m.status='ACTIVE' AND m.expires_at>clock_timestamp() AND u.status='ACTIVE' AND o.status='ACTIVE')
    THEN RAISE EXCEPTION 'Current bootstrap references required' USING ERRCODE='23503'; END IF;
    NEW.database_session_user:=session_user;
    NEW.recorded_at:=clock_timestamp();
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Bootstrap receipts are append-only' USING ERRCODE='42501';
END $fn$;
CREATE TRIGGER validate_bootstrap_receipts BEFORE INSERT
  ON profitia_access.bootstrap_receipts FOR EACH ROW
  EXECUTE FUNCTION profitia_access.protect_bootstrap_receipts();
CREATE TRIGGER immutable_bootstrap_receipts BEFORE UPDATE OR DELETE OR TRUNCATE
  ON profitia_access.bootstrap_receipts FOR EACH STATEMENT
  EXECUTE FUNCTION profitia_access.protect_bootstrap_receipts();
REVOKE ALL ON FUNCTION profitia_access.protect_bootstrap_receipts() FROM PUBLIC;
