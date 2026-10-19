-- Optional catalog bridge installed by the existing access owner. HUMAN module
-- reads are preserved; HUMAN writes, deletes and raw/private SOURCE access stay
-- closed. This file grants no runtime ACL and changes no installed application.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
   AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
   AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid))
   OR to_regclass('profitia_srm_catalog.installation') IS NULL THEN
  RAISE EXCEPTION 'Controlled catalog bridge owners required' USING ERRCODE='42501';END IF;
END $guard$;
CREATE FUNCTION srm.corporate_catalog_scope(p_nip text,p_write boolean DEFAULT false) RETURNS boolean LANGUAGE plpgsql
SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$ BEGIN
 IF profitia_srm_catalog.scope_allows(p_nip,p_write) THEN RETURN true;END IF;
 IF p_write OR NOT EXISTS(SELECT 1 FROM profitia_access.runtime_bindings
   WHERE login_role=session_user AND application_id='srm' AND status='ACTIVE') THEN RETURN false;END IF;
 -- The exact original HUMAN predicate executes under its existing owner. A
 -- SOURCE role receives no ACL on account, membership or module control data.
 RETURN coalesce(profitia_modules.scope_allows('supplier_report',nullif(current_setting('profitia.organisation_id',true),'')::uuid),false);
EXCEPTION WHEN invalid_text_representation THEN RETURN false;END $fn$;
DO $policies$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['catalog_companies','catalog_financial_facts','catalog_financial_indicators'] LOOP
  -- Preserve the original HUMAN admission and delete ceiling. The source arm
  -- is a current reserved publication, never a GUC or role name by itself.
  EXECUTE format('ALTER POLICY private_shared_admission ON srm.%I USING(srm.corporate_catalog_scope(nip))',t);
  EXECUTE format('ALTER POLICY private_shared_fence ON srm.%I USING(srm.corporate_catalog_scope(nip)) WITH CHECK(srm.corporate_catalog_scope(nip,true))',t);
  EXECUTE format('ALTER POLICY private_shared_no_insert ON srm.%I WITH CHECK(srm.corporate_catalog_scope(nip,true))',t);
  EXECUTE format('ALTER POLICY private_shared_no_update ON srm.%I USING(srm.corporate_catalog_scope(nip,true)) WITH CHECK(srm.corporate_catalog_scope(nip,true))',t);
  EXECUTE format('CREATE POLICY source_admission ON srm.%I FOR ALL TO PUBLIC USING(srm.corporate_catalog_scope(nip)) WITH CHECK(srm.corporate_catalog_scope(nip,true))',t);
 END LOOP;
END $policies$;
CREATE FUNCTION srm.guard_corporate_source() RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE p jsonb;section jsonb;previous jsonb;rowdata jsonb;prefix text;f jsonb;proof uuid;found_fact boolean;BEGIN
 IF TG_OP IN('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'Corporate source history cannot be erased' USING ERRCODE='42501';END IF;
 p:=profitia_srm_catalog.current_packet(NEW.nip,true);
 IF p IS NULL OR TG_OP='UPDATE' AND NEW.nip IS DISTINCT FROM OLD.nip THEN
  RAISE EXCEPTION 'Current bound corporate SOURCE publication required' USING ERRCODE='42501';END IF;
 proof:=(p->>'effectId')::uuid;rowdata:=to_jsonb(NEW);
 IF TG_TABLE_NAME='catalog_companies' THEN
  FOREACH prefix IN ARRAY ARRAY['general','financial'] LOOP
   section:=rowdata->(prefix||'_json');previous:=CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD)->(prefix||'_json') ELSE 'null'::jsonb END;
   IF TG_OP='UPDATE' AND jsonb_build_array(rowdata->(prefix||'_json'),rowdata->(prefix||'_sha256'),rowdata->(prefix||'_checked_at'),rowdata->(prefix||'_source_organization_id'),rowdata->(prefix||'_source_snapshot_id'))
     IS NOT DISTINCT FROM jsonb_build_array(to_jsonb(OLD)->(prefix||'_json'),to_jsonb(OLD)->(prefix||'_sha256'),to_jsonb(OLD)->(prefix||'_checked_at'),to_jsonb(OLD)->(prefix||'_source_organization_id'),to_jsonb(OLD)->(prefix||'_source_snapshot_id')) THEN CONTINUE;END IF;
   IF section='null'::jsonb THEN
    IF rowdata->>(prefix||'_sha256') IS NOT NULL OR rowdata->>(prefix||'_checked_at') IS NOT NULL
      OR rowdata->>(prefix||'_source_organization_id') IS NOT NULL OR rowdata->>(prefix||'_source_snapshot_id') IS NOT NULL THEN
     RAISE EXCEPTION 'Empty catalog section has no fabricated provenance' USING ERRCODE='42501';END IF;
    CONTINUE;
   END IF;
   IF profitia_srm_catalog.valid_stored_section(NEW.nip,prefix,section) IS NOT TRUE THEN
    RAISE EXCEPTION 'Retained section must match the classified content, independent of a claimed hash' USING ERRCODE='42501';END IF;
   IF section<>'null'::jsonb AND (rowdata->>(prefix||'_sha256') IS DISTINCT FROM p->'expectedHashes'->>prefix
      OR (rowdata->>(prefix||'_checked_at'))::timestamptz IS DISTINCT FROM (p->prefix->>'retrievedAt')::timestamptz)
      AND (prefix<>'general' OR NOT((p->>'preserveGeneral')::boolean)) AND p->prefix->>'status' IN('SUCCESS','PARTIAL','EMPTY') THEN
    RAISE EXCEPTION 'Original content hash and actual check time required' USING ERRCODE='42501';END IF;
   IF section IS DISTINCT FROM previous THEN
    IF prefix='general' AND (p->>'preserveGeneral')::boolean OR p->prefix->>'status' NOT IN('SUCCESS','PARTIAL','EMPTY')
      OR section IS DISTINCT FROM (p->prefix||CASE WHEN prefix='financial' THEN jsonb_build_object('catalogMappingVersion','2026-10-07-ccc-v2') ELSE '{}'::jsonb END)
      OR rowdata->>(prefix||'_source_organization_id') IS NOT NULL
      OR rowdata->>(prefix||'_source_snapshot_id') IS DISTINCT FROM proof::text THEN
     RAISE EXCEPTION 'Classified catalog projection and real global proof required' USING ERRCODE='42501';END IF;
   ELSIF TG_OP='UPDATE' AND (rowdata->(prefix||'_source_organization_id') IS DISTINCT FROM to_jsonb(OLD)->(prefix||'_source_organization_id')
     OR rowdata->(prefix||'_source_snapshot_id') IS DISTINCT FROM to_jsonb(OLD)->(prefix||'_source_snapshot_id')) THEN
    RAISE EXCEPTION 'Unchanged projection retains original provenance' USING ERRCODE='42501';END IF;
  END LOOP;
 ELSIF TG_TABLE_NAME='catalog_financial_facts' THEN
  IF NEW.source_organization_id IS NOT NULL OR NEW.source_snapshot_id IS DISTINCT FROM proof
    OR NEW.retrieved_at IS DISTINCT FROM (p->'financial'->>'retrievedAt')::timestamptz THEN
   RAISE EXCEPTION 'Global fact proof required' USING ERRCODE='42501';END IF;
  SELECT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'facts') sf WHERE
    sf->>'metricCode'=NEW.metric_code AND (sf->>'periodStart')::date=NEW.period_start AND (sf->>'periodEnd')::date=NEW.period_end
    AND sf->>'statementScope'=NEW.statement_scope AND sf->>'periodType'=NEW.period_type
    AND (sf->>'amount')::numeric=NEW.amount AND (sf->>'sourceAmount')::numeric=NEW.source_amount
    AND sf->>'normalizationRule'=NEW.normalization_rule AND sf->>'currencyCode'=NEW.currency_code
    AND sf->>'unitCode'=NEW.unit_code AND sf->>'sourcePath'=NEW.source_path AND sf->>'validationStatus'=NEW.validation_status) INTO found_fact;
  IF found_fact IS NOT TRUE THEN RAISE EXCEPTION 'Fact not in bound classified packet' USING ERRCODE='42501';END IF;
 ELSE
  IF cardinality(NEW.source_snapshot_ids)>16384 OR cardinality(NEW.source_document_ids)>16384 OR jsonb_array_length(NEW.input_facts)>16384
    OR EXISTS(SELECT 1 FROM unnest(NEW.source_snapshot_ids) id WHERE profitia_srm_catalog.known_proof(NEW.nip,id) IS NOT TRUE)
    OR EXISTS(SELECT 1 FROM unnest(NEW.source_document_ids) id WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'financial'->'data'->'periods') period WHERE period->>'documentId'=id)) THEN
   RAISE EXCEPTION 'Indicator global lineage required' USING ERRCODE='42501';END IF;
  FOR f IN SELECT value FROM jsonb_array_elements(NEW.input_facts) LOOP
   IF jsonb_typeof(f)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(f))<>7
     OR NOT(f ?& ARRAY['metricCode','periodStart','periodEnd','amount','sourcePath','sourceSnapshotId','documentId']) THEN
    RAISE EXCEPTION 'Closed indicator evidence required' USING ERRCODE='42501';END IF;
   IF NOT EXISTS(SELECT 1 FROM srm.catalog_financial_facts stored WHERE stored.nip=NEW.nip
      AND stored.metric_code=f->>'metricCode' AND stored.period_start=(f->>'periodStart')::date AND stored.period_end=(f->>'periodEnd')::date
      AND stored.statement_scope=NEW.statement_scope AND stored.amount=(f->>'amount')::numeric
      AND stored.source_path=f->>'sourcePath' AND stored.source_snapshot_id=(f->>'sourceSnapshotId')::uuid)
      OR profitia_srm_catalog.known_proof(NEW.nip,(f->>'sourceSnapshotId')::uuid) IS NOT TRUE
      OR NOT((f->>'sourceSnapshotId')::uuid=ANY(NEW.source_snapshot_ids))
      OR NOT(f->>'documentId'=ANY(NEW.source_document_ids)) THEN
    RAISE EXCEPTION 'Indicator inputs not in classified catalog facts' USING ERRCODE='42501';END IF;
  END LOOP;
 END IF;
 RETURN NEW;END $fn$;
DO $triggers$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['catalog_companies','catalog_financial_facts','catalog_financial_indicators'] LOOP
  EXECUTE format('CREATE TRIGGER corporate_source_write BEFORE INSERT OR UPDATE OR DELETE ON srm.%I FOR EACH ROW EXECUTE FUNCTION srm.guard_corporate_source()',t);
  EXECUTE format('CREATE TRIGGER corporate_source_truncate BEFORE TRUNCATE ON srm.%I FOR EACH STATEMENT EXECUTE FUNCTION srm.guard_corporate_source()',t);
 END LOOP;
END $triggers$;
CREATE FUNCTION srm.corporate_publication_complete(p_nip text,p_effect uuid) RETURNS boolean LANGUAGE plpgsql
SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE p jsonb;f jsonb;BEGIN
 p:=profitia_srm_catalog.current_packet(p_nip);
 IF p IS NULL OR p->>'effectId' IS DISTINCT FROM p_effect::text
   OR NOT EXISTS(SELECT 1 FROM srm.catalog_companies WHERE nip=p_nip)
   OR NOT((p->>'preserveGeneral')::boolean) AND p->'general'->>'status' IN('SUCCESS','PARTIAL','EMPTY')
      AND NOT EXISTS(SELECT 1 FROM srm.catalog_companies WHERE nip=p_nip AND general_json IS NOT NULL)
   OR p->'financial'->>'status' IN('SUCCESS','PARTIAL','EMPTY')
      AND NOT EXISTS(SELECT 1 FROM srm.catalog_companies WHERE nip=p_nip AND financial_json IS NOT NULL) THEN RETURN false;END IF;
 FOR f IN SELECT value FROM jsonb_array_elements(p->'facts') LOOP
  IF NOT EXISTS(SELECT 1 FROM srm.catalog_financial_facts WHERE nip=p_nip AND metric_code=f->>'metricCode'
    AND period_start=(f->>'periodStart')::date AND period_end=(f->>'periodEnd')::date
    AND statement_scope=f->>'statementScope' AND source_snapshot_id=p_effect) THEN RETURN false;END IF;
 END LOOP;RETURN true;END $fn$;
REVOKE ALL ON FUNCTION srm.corporate_catalog_scope(text,boolean),srm.guard_corporate_source(),srm.corporate_publication_complete(text,uuid) FROM PUBLIC;
