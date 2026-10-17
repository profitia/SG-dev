-- Candidate for a NEW store with accepted profitia_access and all 18 SRM
-- migrations. Never auto-apply to the existing demo or an unverified URL.
-- No provisioning, customer-data migration, role grants or activation.
DO $guard$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM profitia_access.installation WHERE singleton
    AND database_name=current_database() AND schema_version='1.0.0'
    AND schema_digest='356463492c3304ca11fa533f6e99f1d41628a3ab830488142c6030fb9a920ff2') THEN
    RAISE EXCEPTION 'Verified private access schema required';
  END IF;
END $guard$;

-- Existing permissive policies can otherwise admit the old srm.organization_id
-- alone. The restrictive fence is ANDed with every permissive admission policy.
-- TO PUBLIC grants no table ACL; descriptor/scope also bind the actual login.
DO $private$ DECLARE table_name text; predicate text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['organizations','suppliers','lookup_requests',
    'provider_attempts','source_snapshots','section_projections','financial_facts',
    'mgbi_source_archives','financial_source_documents','financial_scanner_frames',
    'msr_sources','msr_projections'] LOOP
    EXECUTE format('ALTER TABLE srm.%I ENABLE ROW LEVEL SECURITY',table_name);
    EXECUTE format('ALTER TABLE srm.%I FORCE ROW LEVEL SECURITY',table_name);
    predicate := format('profitia_access.scope_allows(''srm'',%I)',
      CASE WHEN table_name='organizations' THEN 'id' ELSE 'organization_id' END);
    EXECUTE format('CREATE POLICY private_operation_admission ON srm.%I AS PERMISSIVE FOR ALL TO PUBLIC USING (%s) WITH CHECK (%s)',table_name,predicate,predicate);
    EXECUTE format('CREATE POLICY private_operation_fence ON srm.%I AS RESTRICTIVE FOR ALL TO PUBLIC USING (%s) WITH CHECK (%s)',table_name,predicate,predicate);
  END LOOP;
END $private$;

-- This candidate is a reader of approved corporate financial knowledge. It does
-- not turn a human report projection into a global catalogue writer. Ingestion,
-- source classification and its separate service grants require their own unit.
DO $shared$ DECLARE table_name text; predicate text :=
  'profitia_access.scope_allows(''srm'',nullif(current_setting(''profitia.organisation_id'',true),'''')::uuid)';
BEGIN
  FOREACH table_name IN ARRAY ARRAY['catalog_companies','catalog_financial_facts','catalog_financial_indicators'] LOOP
    EXECUTE format('ALTER TABLE srm.%I ENABLE ROW LEVEL SECURITY',table_name);
    EXECUTE format('ALTER TABLE srm.%I FORCE ROW LEVEL SECURITY',table_name);
    EXECUTE format('CREATE POLICY private_shared_admission ON srm.%I AS PERMISSIVE FOR SELECT TO PUBLIC USING (%s)',table_name,predicate);
    EXECUTE format('CREATE POLICY private_shared_fence ON srm.%I AS RESTRICTIVE FOR ALL TO PUBLIC USING (%s) WITH CHECK (%s)',table_name,predicate,predicate);
    EXECUTE format('CREATE POLICY private_shared_no_insert ON srm.%I AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK (false)',table_name);
    EXECUTE format('CREATE POLICY private_shared_no_update ON srm.%I AS RESTRICTIVE FOR UPDATE TO PUBLIC USING (false) WITH CHECK (false)',table_name);
    EXECUTE format('CREATE POLICY private_shared_no_delete ON srm.%I AS RESTRICTIVE FOR DELETE TO PUBLIC USING (false)',table_name);
  END LOOP;
END $shared$;
