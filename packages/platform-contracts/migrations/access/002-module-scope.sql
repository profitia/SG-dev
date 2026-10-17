-- Optional extension of access-store 1.0.0, not a replacement of migration 001.
-- Run once as its controlled NOLOGIN owner, then initialize the extension digest.
-- This creates no application, membership, module binding or product grant.
DO $guard$ BEGIN
  IF current_user <> 'profitia_access_owner' OR NOT EXISTS (
    SELECT 1 FROM profitia_access.installation WHERE singleton AND database_name=current_database()
      AND schema_version='1.0.0'
      AND schema_digest='356463492c3304ca11fa533f6e99f1d41628a3ab830488142c6030fb9a920ff2'
  ) THEN RAISE EXCEPTION 'Accepted access store and explicit owner required'; END IF;
END $guard$;

CREATE SCHEMA profitia_modules AUTHORIZATION profitia_access_owner;
REVOKE ALL ON SCHEMA profitia_modules FROM PUBLIC;
CREATE TABLE profitia_modules.installation (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  schema_version text NOT NULL CHECK(schema_version='1.0.0'),
  schema_digest text NOT NULL CHECK(schema_digest ~ '^[a-f0-9]{64}$')
);
CREATE TABLE profitia_modules.application_bindings (
  application_id text NOT NULL REFERENCES profitia_access.applications(application_id),
  module_id text NOT NULL CHECK(module_id IN ('benchmark','category','supplier_report')),
  binding_id uuid NOT NULL UNIQUE,
  status text NOT NULL CHECK(status IN ('ACTIVE','REVOKED')),
  version bigint NOT NULL DEFAULT 1 CHECK(version>0),
  source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256),
  expires_at timestamptz NOT NULL CHECK(isfinite(expires_at)),
  PRIMARY KEY(application_id,module_id)
);
DO $policies$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['installation','application_bindings'] LOOP
    EXECUTE format('ALTER TABLE profitia_modules.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE profitia_modules.%I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY controlled_owner ON profitia_modules.%I TO profitia_access_owner USING(true) WITH CHECK(true)',t);
  END LOOP;
END $policies$;
CREATE TRIGGER module_authority_fence BEFORE INSERT OR UPDATE OR DELETE ON profitia_modules.application_bindings
  FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision();
CREATE TRIGGER module_truncate_fence BEFORE TRUNCATE ON profitia_modules.application_bindings
  FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision();
CREATE TRIGGER module_version BEFORE UPDATE ON profitia_modules.application_bindings
  FOR EACH ROW EXECUTE FUNCTION profitia_access.advance_version();

CREATE FUNCTION profitia_modules.runtime_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_modules,profitia_access,pg_temp AS $fn$
DECLARE d jsonb; extension profitia_modules.installation%ROWTYPE;
BEGIN
  d:=profitia_access.runtime_descriptor();
  SELECT * INTO extension FROM profitia_modules.installation WHERE singleton;
  IF NOT FOUND THEN RAISE EXCEPTION 'Module extension unavailable' USING ERRCODE='42501'; END IF;
  RETURN d || jsonb_build_object('moduleContractId','profitia.module-scope',
    'moduleContractVersion',extension.schema_version,'moduleSchemaDigest',extension.schema_digest);
END $fn$;

CREATE FUNCTION profitia_modules.bind_scope(p_module text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_modules,profitia_access,pg_temp AS $fn$
DECLARE d jsonb; uid uuid; org uuid; module_grant profitia_modules.application_bindings%ROWTYPE;
  required_product text; product_expiry timestamptz; deadline timestamptz; transaction_id text; marker text; previous_marker text;
BEGIN
  d:=profitia_modules.runtime_descriptor();
  uid:=nullif(current_setting('profitia.user_id',true),'')::uuid;
  org:=nullif(current_setting('profitia.organisation_id',true),'')::uuid;
  IF org IS NULL OR profitia_access.scope_allows(d->>'applicationId',org,uid) IS NOT TRUE THEN RETURN NULL; END IF;
  required_product:=CASE p_module WHEN 'benchmark' THEN 'SPENDGURU' WHEN 'category' THEN 'SPENDGURU'
    WHEN 'supplier_report' THEN 'SUPPLIER_INTELLIGENCE' ELSE NULL END;
  IF required_product IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO module_grant FROM profitia_modules.application_bindings
    WHERE application_id=d->>'applicationId' AND module_id=p_module AND status='ACTIVE' AND expires_at>clock_timestamp();
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT expires_at INTO product_expiry FROM profitia_access.product_grants
    WHERE application_id=d->>'applicationId' AND organisation_id=org AND product=required_product
      AND status='ACTIVE' AND expires_at>clock_timestamp() AND p_module=ANY(features);
  IF NOT FOUND THEN RETURN NULL; END IF;
  deadline:=least(current_setting('profitia.scope_expires_at')::timestamptz,module_grant.expires_at,product_expiry);
  IF deadline<=clock_timestamp() THEN RETURN NULL; END IF;
  transaction_id:=txid_current()::text;
  marker:=jsonb_build_array(d->>'applicationId',uid,org,module_grant.binding_id,module_grant.version,
    transaction_id,current_setting('profitia.identity_binding_version'),current_setting('profitia.policy_version'))::text;
  previous_marker:=nullif(current_setting('profitia.module.'||p_module,true),'');
  IF previous_marker IS NOT NULL AND previous_marker IS DISTINCT FROM marker THEN RETURN NULL; END IF;
  -- Narrow the existing lease. Its unchanged verifyScope will reject expiry
  -- before OUTCOME/commit, even after the business callback performed a write.
  PERFORM set_config('profitia.scope_expires_at',deadline::text,true);
  PERFORM set_config('profitia.module.'||p_module,marker,true);
  RETURN d || jsonb_build_object('moduleId',p_module,'organisationId',org,'userId',uid,
    'moduleBindingId',module_grant.binding_id,'moduleBindingVersion',module_grant.version::text,
    'moduleSourceRef',module_grant.source_ref,'expiresAt',deadline,'transactionId',transaction_id);
EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN RETURN NULL;
END $fn$;

CREATE FUNCTION profitia_modules.scope_allows(p_module text,p_org uuid,p_user uuid DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_modules,profitia_access,pg_temp AS $fn$
DECLARE d jsonb; b profitia_modules.application_bindings%ROWTYPE; required_product text;
BEGIN
  d:=profitia_modules.runtime_descriptor();
  IF p_org IS NULL OR profitia_access.scope_allows(d->>'applicationId',p_org,p_user) IS NOT TRUE THEN RETURN false; END IF;
  required_product:=CASE p_module WHEN 'benchmark' THEN 'SPENDGURU' WHEN 'category' THEN 'SPENDGURU'
    WHEN 'supplier_report' THEN 'SUPPLIER_INTELLIGENCE' ELSE NULL END;
  IF required_product IS NULL THEN RETURN false; END IF;
  SELECT * INTO b FROM profitia_modules.application_bindings WHERE application_id=d->>'applicationId'
    AND module_id=p_module AND status='ACTIVE' AND expires_at>clock_timestamp();
  IF NOT FOUND OR current_setting('profitia.module.'||p_module,true) IS DISTINCT FROM
    jsonb_build_array(d->>'applicationId',nullif(current_setting('profitia.user_id',true),'')::uuid,p_org,
      b.binding_id,b.version,txid_current()::text,current_setting('profitia.identity_binding_version'),
      current_setting('profitia.policy_version'))::text THEN RETURN false; END IF;
  RETURN EXISTS(SELECT 1 FROM profitia_access.product_grants WHERE application_id=d->>'applicationId'
    AND organisation_id=p_org AND product=required_product AND status='ACTIVE'
    AND expires_at>clock_timestamp() AND p_module=ANY(features));
EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN RETURN false;
END $fn$;

REVOKE ALL ON ALL TABLES IN SCHEMA profitia_modules FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_modules FROM PUBLIC;
