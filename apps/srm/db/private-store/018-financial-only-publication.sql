-- Optional additive Financial-only port. Historical SQL004/005, the installed
-- field schema, their digest, existing functions/ACLs and old packets remain
-- unchanged. Install only as the existing controlled Source owner. No grant,
-- provider request, tenant/user admission or automatic migration is included.
DO $guard$ BEGIN
 IF current_user<>'profitia_ingestion_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
   AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
   AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid))
   OR to_regprocedure('profitia_srm_catalog.open_publication(uuid,uuid,text)') IS NULL THEN
  RAISE EXCEPTION 'Existing controlled corporate Source owner required' USING ERRCODE='42501';END IF;
END $guard$;
CREATE FUNCTION profitia_srm_catalog.open_financial_publication(p_effect uuid,p_decision uuid,p_body text) RETURNS boolean LANGUAGE plpgsql
SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;e profitia_ingestion.effects%ROWTYPE;i profitia_srm_catalog.installation%ROWTYPE;
 p jsonb;body_hash text;manifest text;expected_general jsonb;financial_shape jsonb;BEGIN
 d:=profitia_srm_catalog.runtime_descriptor();
 IF d IS NULL OR p_body IS NULL OR octet_length(p_body)>33554432 OR NOT profitia_srm_catalog.unique_keys(p_body::json) THEN RETURN false;END IF;
 p:=p_body::jsonb;SELECT * INTO STRICT i FROM profitia_srm_catalog.installation WHERE singleton;
 expected_general:=jsonb_build_object('status','NOT_REQUESTED','source',jsonb_build_object('provider','MGBI',
  'model','pl-krs-wp-record','recordId',NULL),'data',NULL,'retrievedAt',NULL,'effectiveAt',NULL,'warnings','[]'::jsonb);
 -- Explicit absence is narrower than the existing General projection. No
 -- supplied General data, record ID, timestamp or provenance can cross here.
 IF p->'preserveGeneral' IS DISTINCT FROM 'true'::jsonb OR p->'general' IS DISTINCT FROM expected_general THEN RETURN false;END IF;
 financial_shape:=jsonb_set(i.field_schema->'packet','{general,data}','{"$nullable":"@general"}'::jsonb,false);
 IF profitia_srm_catalog.valid_shape(p,financial_shape,i.field_schema) IS NOT TRUE THEN RETURN false;END IF;
 body_hash:=encode(sha256(convert_to(p_body,'UTF8')),'hex');
 manifest:='{"content":{"bodyDigest":'||to_json(body_hash)::text||',"nip":'||to_json(p->>'nip')::text
   ||',"version":"srm-corporate-publication-v1"},"sourceId":"srm.catalog.corporate"}';
 SELECT * INTO e FROM profitia_ingestion.effects WHERE effect_id=p_effect;
 IF NOT FOUND OR e.status<>'RESERVED' OR e.decision_id IS DISTINCT FROM p_decision
   OR e.application_id<>'srm-corporate-source' OR e.source_id<>'srm.catalog.corporate'
   OR e.resource_id IS DISTINCT FROM 'srm-corporate:'||(p->>'nip')
   OR e.payload_digest IS DISTINCT FROM encode(sha256(convert_to(manifest,'UTF8')),'hex')
   OR profitia_ingestion.scope_allows(e.source_id,e.resource_id) IS NOT TRUE
   OR e.service_id::text IS DISTINCT FROM profitia_ingestion.runtime_descriptor()->>'serviceId'
   OR EXISTS(SELECT 1 FROM profitia_srm_catalog.publications WHERE transaction_id=txid_current()) THEN RETURN false;END IF;
 -- Reuse the original immutable publication and same-transaction OUTCOME
 -- witness. Existing catalog guards prohibit changing General in this mode.
 INSERT INTO profitia_srm_catalog.publications(effect_id,decision_id,nip,body_digest,packet,general_sha256,financial_sha256)
  VALUES(p_effect,p_decision,p->>'nip',body_hash,p,profitia_srm_catalog.section_hash(p_body::json,'general'),profitia_srm_catalog.section_hash(p_body::json,'financial'));
 PERFORM set_config('profitia.srm.catalog.effect',p_effect::text,true);RETURN true;
EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN RETURN false;END $fn$;
REVOKE ALL ON FUNCTION profitia_srm_catalog.open_financial_publication(uuid,uuid,text) FROM PUBLIC;
