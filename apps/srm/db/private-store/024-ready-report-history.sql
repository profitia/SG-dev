-- Additive derived public projection. Original Source publications, private
-- archives and all historical receipts retain their identities and rules.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
  AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication))
  OR to_regprocedure('profitia_srm_catalog.current_packet(text,boolean)') IS NULL THEN
  RAISE EXCEPTION 'Controlled existing SRM owner and corporate Source required' USING ERRCODE='42501';END IF;
END $guard$;
CREATE TABLE srm.ready_report_installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 version text NOT NULL CHECK(version='srm-prepared-company-report-v1'),
 schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),
 field_schema jsonb NOT NULL CHECK(jsonb_typeof(field_schema)='object'),
 rules jsonb NOT NULL CHECK(jsonb_typeof(rules)='object'),
 source_ref text NOT NULL CHECK(source_ref~'^[a-f0-9]{40}$')
);
CREATE TABLE srm.ready_company_reports(
 nip text NOT NULL CHECK(nip~'^[0-9]{10}$'),
 body_digest text NOT NULL CHECK(body_digest~'^[a-f0-9]{64}$'),
 body_json jsonb NOT NULL, body_text text NOT NULL,
 publication_effect uuid NOT NULL,
 general_sha256 text NOT NULL,financial_sha256 text NOT NULL,
 general_effect uuid NOT NULL,financial_effect uuid NOT NULL,
 schema_digest text NOT NULL,transaction_id bigint NOT NULL DEFAULT txid_current(),
 prepared_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(nip,body_digest)
);
CREATE INDEX ready_company_reports_current ON srm.ready_company_reports(nip,prepared_at DESC);
ALTER TABLE srm.ready_report_installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm.ready_report_installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON srm.ready_report_installation TO profitia_access_owner USING(true) WITH CHECK(true);
CREATE POLICY owner_fence ON srm.ready_report_installation AS RESTRICTIVE TO PUBLIC
 USING(current_user='profitia_access_owner') WITH CHECK(current_user='profitia_access_owner');
ALTER TABLE srm.ready_company_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm.ready_company_reports FORCE ROW LEVEL SECURITY;
CREATE POLICY current_shared_read ON srm.ready_company_reports FOR SELECT TO PUBLIC USING(srm.corporate_catalog_scope(nip));
CREATE POLICY current_source_write ON srm.ready_company_reports FOR INSERT TO PUBLIC WITH CHECK(srm.corporate_catalog_scope(nip,true));
CREATE POLICY no_update ON srm.ready_company_reports AS RESTRICTIVE FOR UPDATE TO PUBLIC USING(false) WITH CHECK(false);
CREATE POLICY no_delete ON srm.ready_company_reports AS RESTRICTIVE FOR DELETE TO PUBLIC USING(false);

CREATE FUNCTION srm.ready_report_descriptor() RETURNS jsonb LANGUAGE plpgsql
 SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE i srm.ready_report_installation%ROWTYPE;BEGIN
 SELECT * INTO i FROM srm.ready_report_installation WHERE singleton;
 IF NOT FOUND THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('version',i.version,'schemaDigest',i.schema_digest,'rules',i.rules);
END $fn$;

-- JSON fields are classified twice: the existing typed producer and this
-- independently installed closed SQL shape. Dynamic keys can only identify
-- the prepared annual periods; basis keys are a finite methodology set.
CREATE FUNCTION srm.valid_ready_report(p jsonb) RETURNS boolean LANGUAGE plpgsql
 SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE i srm.ready_report_installation%ROWTYPE;k text;e jsonb;b jsonb;BEGIN
 SELECT * INTO i FROM srm.ready_report_installation WHERE singleton;
 IF NOT FOUND OR p->'rules' IS DISTINCT FROM i.rules
  OR profitia_srm_catalog.valid_shape(p-'scannerEvidence',i.field_schema->'packet',i.field_schema) IS NOT TRUE
  OR p->'report'->>'nip' IS DISTINCT FROM p->>'nip'
  OR p->'report'->'kys'->'reportAvailable'<>'false'::jsonb
  OR p->'report'->'kys'->'lastAttemptStatus'<>'null'::jsonb
  OR p->'report'->'kys'->'lastAttemptAt'<>'null'::jsonb
  OR p->'report'->'kys'->'limitations'<>'["KYS_NOT_REQUESTED"]'::jsonb
  OR jsonb_typeof(p->'scannerEvidence')<>'object' THEN RETURN false;END IF;
 IF (SELECT count(*) FROM jsonb_object_keys(p->'scannerEvidence'))
   IS DISTINCT FROM jsonb_array_length(p->'report'->'financial'->'periods') THEN RETURN false;END IF;
 FOR k,e IN SELECT key,value FROM jsonb_each(p->'scannerEvidence') LOOP
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'report'->'financial'->'periods') x
    WHERE k=(x->>'scope')||':'||(x->>'from')||':'||(x->>'to'))
   OR jsonb_typeof(e)<>'object' OR NOT(e ?& ARRAY['reason','evidenceRef','basis','costs'])
   OR (SELECT count(*) FROM jsonb_object_keys(e))<>4
   OR e->'reason'<>'null'::jsonb AND e->>'reason' NOT IN('SOURCE_DOCUMENT_UNAVAILABLE','NON_ANNUAL_PERIOD','UNVERIFIED_SOURCE','ACCOUNTING_STANDARD_UNCONFIRMED','UNSUPPORTED_SOURCE_BASIS','SOURCE_REVISION_UNRESOLVED','SOURCE_PERIOD_UNCONFIRMED')
   OR e->'evidenceRef'<>'null'::jsonb AND e->>'evidenceRef'!~'^[a-f0-9]{64}$'
   OR e->'costs'<>'null'::jsonb AND e->>'costs'!~'^[0-9]{1,24}([.][0-9]{1,6})?$'
   OR jsonb_typeof(e->'basis')<>'object' THEN RETURN false;END IF;
  FOR b IN SELECT jsonb_build_object('key',key,'value',value) FROM jsonb_each(e->'basis') LOOP
   IF b->>'key' NOT IN('NET_RESULT','REVENUE','OPERATING_MARGIN','OPERATING_COST_RATIO','LIABILITIES_TO_ASSETS','CURRENT_RATIO')
    OR jsonb_typeof(b->'value')<>'string'
    OR b->>'value'!~'^(POLISH_UOR|IAS_IFRS:POSITIONED_XHTML|IAS_IFRS:ESEF/iXBRL):(standalone|consolidated):PLN:[0-9]{2}-[0-9]{2}:[0-9]{2}-[0-9]{2}(:KRS:[0-9]{10})?:[A-Za-z_:]+$' THEN RETURN false;END IF;
  END LOOP;
  IF e->'reason'<>'null'::jsonb AND (e->'basis'<>'{}'::jsonb OR e->'evidenceRef'<>'null'::jsonb OR e->'costs'<>'null'::jsonb) THEN RETURN false;END IF;
 END LOOP;
 RETURN true;
END $fn$;

CREATE FUNCTION srm.guard_ready_report() RETURNS trigger LANGUAGE plpgsql
 SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE p jsonb;c srm.catalog_companies%ROWTYPE;i srm.ready_report_installation%ROWTYPE;BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Prepared report history is immutable' USING ERRCODE='42501';END IF;
 p:=profitia_srm_catalog.current_packet(NEW.nip,true);
 SELECT * INTO i FROM srm.ready_report_installation WHERE singleton;
 SELECT * INTO c FROM srm.catalog_companies WHERE nip=NEW.nip;
 IF p IS NULL OR NEW.publication_effect::text IS DISTINCT FROM p->>'effectId'
  OR NEW.transaction_id<>txid_current() OR NEW.schema_digest IS DISTINCT FROM i.schema_digest
  OR NEW.body_json IS DISTINCT FROM NEW.body_text::jsonb
  OR NOT profitia_srm_catalog.unique_keys(NEW.body_text::json)
  OR NEW.body_digest<>encode(sha256(convert_to(NEW.body_text,'UTF8')),'hex')
  OR srm.valid_ready_report(NEW.body_json) IS NOT TRUE
  OR NEW.body_json->>'nip' IS DISTINCT FROM NEW.nip
  OR NEW.body_json->'general' IS DISTINCT FROM c.general_json
  OR NEW.body_json->'financial' IS DISTINCT FROM c.financial_json-'catalogMappingVersion'
  OR NEW.general_sha256 IS DISTINCT FROM c.general_sha256 OR NEW.financial_sha256 IS DISTINCT FROM c.financial_sha256
  OR NEW.general_effect IS DISTINCT FROM c.general_source_snapshot_id OR NEW.financial_effect IS DISTINCT FROM c.financial_source_snapshot_id
  OR NEW.body_json->'sources' IS DISTINCT FROM jsonb_build_object('generalHash',c.general_sha256,'financialHash',c.financial_sha256,'generalEffectId',c.general_source_snapshot_id,'financialEffectId',c.financial_source_snapshot_id)
  OR profitia_srm_catalog.known_proof(NEW.nip,NEW.general_effect) IS NOT TRUE
  OR profitia_srm_catalog.known_proof(NEW.nip,NEW.financial_effect) IS NOT TRUE THEN
  RAISE EXCEPTION 'Exact prepared corporate Source projection required' USING ERRCODE='42501';END IF;
 NEW.prepared_at:=clock_timestamp();RETURN NEW;
END $fn$;
CREATE TRIGGER ready_source_guard BEFORE INSERT OR UPDATE OR DELETE ON srm.ready_company_reports
 FOR EACH ROW EXECUTE FUNCTION srm.guard_ready_report();
CREATE TRIGGER ready_no_truncate BEFORE TRUNCATE ON srm.ready_company_reports
 FOR EACH STATEMENT EXECUTE FUNCTION profitia_srm_catalog.immutable();
CREATE TRIGGER ready_installation_immutable BEFORE UPDATE OR DELETE ON srm.ready_report_installation
 FOR EACH ROW EXECUTE FUNCTION profitia_srm_catalog.immutable();
CREATE TRIGGER ready_installation_no_truncate BEFORE TRUNCATE ON srm.ready_report_installation
 FOR EACH STATEMENT EXECUTE FUNCTION profitia_srm_catalog.immutable();

CREATE FUNCTION srm.publish_ready_report(p_nip text,p_effect uuid,p_body text,p_schema text,p_version text) RETURNS boolean LANGUAGE plpgsql
 SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE p jsonb;BEGIN
 IF octet_length(p_body)>33554432 OR p_version<>'srm-prepared-company-report-v1'
  OR srm.ready_report_descriptor()->>'schemaDigest' IS DISTINCT FROM p_schema THEN RETURN false;END IF;
 p:=p_body::jsonb;
 INSERT INTO srm.ready_company_reports(nip,body_digest,body_json,body_text,publication_effect,
  general_sha256,financial_sha256,general_effect,financial_effect,schema_digest)
 VALUES(p_nip,encode(sha256(convert_to(p_body,'UTF8')),'hex'),p,p_body,p_effect,
  p->'sources'->>'generalHash',p->'sources'->>'financialHash',
  (p->'sources'->>'generalEffectId')::uuid,(p->'sources'->>'financialEffectId')::uuid,p_schema)
 ON CONFLICT(nip,body_digest) DO NOTHING;
 RETURN true;
END $fn$;
REVOKE ALL ON srm.ready_report_installation,srm.ready_company_reports FROM PUBLIC;
REVOKE ALL ON FUNCTION srm.ready_report_descriptor(),srm.valid_ready_report(jsonb),srm.guard_ready_report(),srm.publish_ready_report(text,uuid,text,text,text) FROM PUBLIC;
