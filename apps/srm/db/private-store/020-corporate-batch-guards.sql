-- Explicit, reversible SRM adoption under the existing access owner. No grant,
-- role, tenant, Source policy, receipt schema or financial-calculator bypass.
-- Untrusted transaction-local NIP is only a selector. The existing current
-- Source scope authenticates it afresh for each SQL statement (an InitPlan).
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
  AND NOT(rolcanlogin OR rolsuper OR rolbypassrls OR rolinherit OR rolcreatedb OR rolcreaterole OR rolreplication))
  OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='srm.guard_corporate_source()'::regprocedure
   AND proowner='profitia_access_owner'::regrole AND prosecdef
   AND md5(pg_get_functiondef(oid))='f24912e2995036bc47c5465ec3fbf887')
  OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='srm.corporate_publication_complete(text,uuid)'::regprocedure
   AND proowner='profitia_access_owner'::regrole AND prosecdef
   AND md5(pg_get_functiondef(oid)) IN('64a144eb23c6cc760be321a3e046eed1','70b1f79fb38fea71ead21d661befe81a')) THEN
  RAISE EXCEPTION 'Exact existing SRM corporate guard and controlled owner required';END IF;
END $guard$;
CREATE OR REPLACE FUNCTION srm.corporate_statement_subject(p_write boolean DEFAULT false) RETURNS text LANGUAGE plpgsql
SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE subject text;BEGIN
 subject:=nullif(current_setting('profitia.srm.catalog.nip',true),'');
 IF subject IS NULL OR subject!~'^[0-9]{10}$' OR profitia_srm_catalog.scope_allows(subject,p_write) IS NOT TRUE THEN RETURN NULL;END IF;
 RETURN subject;
END $fn$;
REVOKE ALL ON FUNCTION srm.corporate_statement_subject(boolean) FROM PUBLIC;
-- Exactly the pre-existing scope function's callers, not a new business grant.
DO $acl$ DECLARE a record;BEGIN
 FOR a IN SELECT x.grantee FROM pg_proc p,LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x
  WHERE p.oid='srm.corporate_catalog_scope(text,boolean)'::regprocedure AND x.privilege_type='EXECUTE' AND x.grantee<>p.proowner LOOP
  EXECUTE format('GRANT EXECUTE ON FUNCTION srm.corporate_statement_subject(boolean) TO %s',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END);
 END LOOP;
END $acl$;
DO $policies$ DECLARE p record;q text;c text;BEGIN
 FOR p IN SELECT * FROM pg_policies WHERE schemaname='srm' AND tablename IN('catalog_companies','catalog_financial_facts','catalog_financial_indicators') LOOP
  q:=p.qual;c:=p.with_check;
  IF position('corporate_statement_subject' in coalesce(q,''))=0 THEN
   q:=replace(replace(replace(q,'srm.corporate_catalog_scope(nip, true)','(CASE WHEN nip=(SELECT srm.corporate_statement_subject(true)) THEN true ELSE srm.corporate_catalog_scope(nip,true) END)'),
    'srm.corporate_catalog_scope(nip, false)','(CASE WHEN nip=(SELECT srm.corporate_statement_subject(false)) THEN true ELSE srm.corporate_catalog_scope(nip,false) END)'),
    'srm.corporate_catalog_scope(nip)','(CASE WHEN nip=(SELECT srm.corporate_statement_subject(false)) THEN true ELSE srm.corporate_catalog_scope(nip) END)');
  END IF;
  IF position('corporate_statement_subject' in coalesce(c,''))=0 THEN
   c:=replace(replace(replace(c,'srm.corporate_catalog_scope(nip, true)','(CASE WHEN nip=(SELECT srm.corporate_statement_subject(true)) THEN true ELSE srm.corporate_catalog_scope(nip,true) END)'),
    'srm.corporate_catalog_scope(nip, false)','(CASE WHEN nip=(SELECT srm.corporate_statement_subject(false)) THEN true ELSE srm.corporate_catalog_scope(nip,false) END)'),
    'srm.corporate_catalog_scope(nip)','(CASE WHEN nip=(SELECT srm.corporate_statement_subject(false)) THEN true ELSE srm.corporate_catalog_scope(nip) END)');
  END IF;
  IF q IS DISTINCT FROM p.qual OR c IS DISTINCT FROM p.with_check THEN
   EXECUTE format('ALTER POLICY %I ON srm.%I %s %s',p.policyname,p.tablename,CASE WHEN q IS NULL THEN '' ELSE 'USING('||q||')' END,CASE WHEN c IS NULL THEN '' ELSE 'WITH CHECK('||c||')' END);
  END IF;
 END LOOP;
END $policies$;

-- Transition tables describe the actual rows written by this statement. They
-- cannot be supplied or replaced by an application GUC. Each statement still
-- checks current Source authority; there is no permission cache or TTL.
CREATE OR REPLACE FUNCTION srm.guard_corporate_batch() RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE subject text;p jsonb;proof uuid;BEGIN
 IF NOT EXISTS(SELECT 1 FROM corporate_written) THEN RETURN NULL;END IF;
 SELECT nip INTO subject FROM corporate_written LIMIT 1;
 IF EXISTS(SELECT 1 FROM corporate_written WHERE nip IS DISTINCT FROM subject) THEN RAISE EXCEPTION 'One bound corporate subject required' USING ERRCODE='42501';END IF;
 p:=profitia_srm_catalog.current_packet(subject,true);
 IF p IS NULL THEN RAISE EXCEPTION 'Current bound corporate SOURCE publication required' USING ERRCODE='42501';END IF;
 proof:=(p->>'effectId')::uuid;
 IF TG_OP='UPDATE' THEN
  IF EXISTS(SELECT 1 FROM corporate_previous WHERE nip IS DISTINCT FROM subject) THEN
   RAISE EXCEPTION 'Corporate subject is immutable' USING ERRCODE='42501';END IF;
 END IF;
 IF TG_TABLE_NAME='catalog_financial_facts' THEN
  IF EXISTS(WITH accepted AS MATERIALIZED(SELECT * FROM jsonb_to_recordset(p->'facts') AS f(
   "metricCode" text,"periodStart" date,"periodEnd" date,"statementScope" text,"periodType" text,amount numeric,
   "sourceAmount" numeric,"normalizationRule" text,"currencyCode" text,"unitCode" text,"sourcePath" text,"validationStatus" text))
   SELECT 1 FROM corporate_written w LEFT JOIN accepted f ON f."metricCode"=w.metric_code AND f."periodStart"=w.period_start
    AND f."periodEnd"=w.period_end AND f."statementScope"=w.statement_scope AND f."periodType"=w.period_type
    AND f.amount=w.amount AND f."sourceAmount"=w.source_amount AND f."normalizationRule"=w.normalization_rule
    AND f."currencyCode"=w.currency_code AND f."unitCode"=w.unit_code AND f."sourcePath"=w.source_path AND f."validationStatus"=w.validation_status
   WHERE f."metricCode" IS NULL OR w.source_organization_id IS NOT NULL OR w.source_snapshot_id IS DISTINCT FROM proof
    OR w.retrieved_at IS DISTINCT FROM (p->'financial'->>'retrievedAt')::timestamptz) THEN
   RAISE EXCEPTION 'Facts must match the exact bound classified packet and global proof' USING ERRCODE='42501';END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM corporate_written w WHERE cardinality(w.source_snapshot_ids)>16384 OR cardinality(w.source_document_ids)>16384 OR jsonb_array_length(w.input_facts)>16384)
   OR EXISTS(SELECT 1 FROM(SELECT DISTINCT unnest(source_snapshot_ids) id FROM corporate_written) ids WHERE profitia_srm_catalog.known_proof(subject,id) IS NOT TRUE)
   OR EXISTS(SELECT 1 FROM(SELECT DISTINCT unnest(source_document_ids) id FROM corporate_written) ids WHERE NOT EXISTS(
    SELECT 1 FROM jsonb_array_elements(p->'financial'->'data'->'periods') period WHERE period->>'documentId'=id)) THEN
   RAISE EXCEPTION 'Indicator global lineage required' USING ERRCODE='42501';END IF;
  IF EXISTS(WITH inputs AS MATERIALIZED(SELECT w.statement_scope,w.source_snapshot_ids,w.source_document_ids,f.value AS f
    FROM corporate_written w CROSS JOIN LATERAL jsonb_array_elements(w.input_facts) f)
   SELECT 1 FROM inputs WHERE jsonb_typeof(f)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(f))<>7
    OR NOT(f ?& ARRAY['metricCode','periodStart','periodEnd','amount','sourcePath','sourceSnapshotId','documentId'])) THEN
   RAISE EXCEPTION 'Closed indicator evidence required' USING ERRCODE='42501';END IF;
  IF EXISTS(WITH inputs AS MATERIALIZED(SELECT w.statement_scope,w.source_snapshot_ids,w.source_document_ids,f.value AS f
    FROM corporate_written w CROSS JOIN LATERAL jsonb_array_elements(w.input_facts) f)
   SELECT 1 FROM inputs i LEFT JOIN srm.catalog_financial_facts s ON s.nip=subject AND s.metric_code=i.f->>'metricCode'
    AND s.period_start=(i.f->>'periodStart')::date AND s.period_end=(i.f->>'periodEnd')::date AND s.statement_scope=i.statement_scope
    AND s.amount=(i.f->>'amount')::numeric AND s.source_path=i.f->>'sourcePath' AND s.source_snapshot_id=(i.f->>'sourceSnapshotId')::uuid
   WHERE s.metric_code IS NULL OR NOT((i.f->>'sourceSnapshotId')::uuid=ANY(i.source_snapshot_ids)) OR NOT(i.f->>'documentId'=ANY(i.source_document_ids)))
   OR EXISTS(SELECT 1 FROM(SELECT DISTINCT (f.value->>'sourceSnapshotId')::uuid id FROM corporate_written w CROSS JOIN LATERAL jsonb_array_elements(w.input_facts) f) ids
    WHERE profitia_srm_catalog.known_proof(subject,id) IS NOT TRUE) THEN
   RAISE EXCEPTION 'Indicator inputs not in classified catalog facts' USING ERRCODE='42501';END IF;
 END IF;
 RETURN NULL;
END $fn$;
REVOKE ALL ON FUNCTION srm.guard_corporate_batch() FROM PUBLIC;
DO $triggers$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['catalog_financial_facts','catalog_financial_indicators'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS corporate_source_write ON srm.%I',t);
  EXECUTE format('CREATE TRIGGER corporate_source_write BEFORE DELETE ON srm.%I FOR EACH ROW EXECUTE FUNCTION srm.guard_corporate_source()',t);
  EXECUTE format('DROP TRIGGER IF EXISTS corporate_batch_insert ON srm.%I',t);
  EXECUTE format('CREATE TRIGGER corporate_batch_insert AFTER INSERT ON srm.%I REFERENCING NEW TABLE AS corporate_written FOR EACH STATEMENT EXECUTE FUNCTION srm.guard_corporate_batch()',t);
  EXECUTE format('DROP TRIGGER IF EXISTS corporate_batch_update ON srm.%I',t);
  EXECUTE format('CREATE TRIGGER corporate_batch_update AFTER UPDATE ON srm.%I REFERENCING OLD TABLE AS corporate_previous NEW TABLE AS corporate_written FOR EACH STATEMENT EXECUTE FUNCTION srm.guard_corporate_batch()',t);
 END LOOP;
END $triggers$;
CREATE OR REPLACE FUNCTION srm.corporate_publication_complete(p_nip text,p_effect uuid) RETURNS boolean LANGUAGE plpgsql
SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE p jsonb;BEGIN
 p:=profitia_srm_catalog.current_packet(p_nip);
 IF p IS NULL OR p->>'effectId' IS DISTINCT FROM p_effect::text
  OR NOT EXISTS(SELECT 1 FROM srm.catalog_companies WHERE nip=p_nip)
  OR NOT((p->>'preserveGeneral')::boolean) AND p->'general'->>'status' IN('SUCCESS','PARTIAL','EMPTY') AND NOT EXISTS(SELECT 1 FROM srm.catalog_companies WHERE nip=p_nip AND general_json IS NOT NULL)
  OR p->'financial'->>'status' IN('SUCCESS','PARTIAL','EMPTY') AND NOT EXISTS(SELECT 1 FROM srm.catalog_companies WHERE nip=p_nip AND financial_json IS NOT NULL) THEN RETURN false;END IF;
 RETURN NOT EXISTS(WITH expected AS MATERIALIZED(SELECT * FROM jsonb_to_recordset(p->'facts') AS f("metricCode" text,"periodStart" date,"periodEnd" date,"statementScope" text))
  SELECT 1 FROM expected f LEFT JOIN srm.catalog_financial_facts s ON s.nip=p_nip AND s.metric_code=f."metricCode"
   AND s.period_start=f."periodStart" AND s.period_end=f."periodEnd" AND s.statement_scope=f."statementScope" AND s.source_snapshot_id=p_effect
  WHERE s.metric_code IS NULL);
END $fn$;
