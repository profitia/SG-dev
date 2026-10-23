-- Optional operator adoption only, in one controlled Development transaction.
-- Same current publication, transaction, reserved effect, binding and Source
-- predicates on every invocation. No authority cache, grant, policy, data,
-- schema digest, provider, deadline, field classification or calculator change.
-- Boolean row policies need only a small effect projection, not the full
-- Financial packet. Original packet/section/fact/lineage guards remain intact.
DO $scope_projection$
DECLARE packet_acl aclitem[];scope_acl aclitem[];
BEGIN
 IF current_user<>'profitia_ingestion_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
  AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
  AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid)) THEN
  RAISE EXCEPTION 'Existing controlled corporate Source owner required' USING ERRCODE='42501';END IF;
 IF NOT(NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('profitia_srm_catalog.current_packet(text,boolean)') AND md5(pg_get_functiondef(oid))='d05253f58e5925b8132d7b9df890c0b3' AND proowner='profitia_ingestion_owner'::regrole AND prosecdef AND proconfig=ARRAY['search_path=pg_catalog, pg_temp']) OR
  NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('profitia_srm_catalog.scope_allows(text,boolean)') AND md5(pg_get_functiondef(oid))='eb8502e90864587e958438d0fe54effb' AND proowner='profitia_ingestion_owner'::regrole AND prosecdef AND proconfig=ARRAY['search_path=pg_catalog, pg_temp']) OR
  NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('profitia_srm_catalog.current_publication_effect(text,boolean)') AND md5(pg_get_functiondef(oid))='ed06b8681976743acf768e89c60fe379' AND proowner='profitia_ingestion_owner'::regrole AND prosecdef AND proconfig=ARRAY['search_path=pg_catalog, pg_temp'])) THEN
  IF EXISTS(SELECT 1 FROM pg_proc p,LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
   WHERE p.oid='profitia_srm_catalog.current_publication_effect(text,boolean)'::regprocedure AND a.grantee<>p.proowner) THEN
   RAISE EXCEPTION 'Private effect projection ACL drift';END IF;
  RETURN;
 END IF;
 IF to_regprocedure('profitia_srm_catalog.current_publication_effect(text,boolean)') IS NOT NULL OR
  NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('profitia_srm_catalog.current_packet(text,boolean)') AND md5(pg_get_functiondef(oid))='a326ad94296d6943a62ac0cdc5e67791' AND proowner='profitia_ingestion_owner'::regrole AND prosecdef AND proconfig=ARRAY['search_path=pg_catalog, pg_temp']) OR
  NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('profitia_srm_catalog.scope_allows(text,boolean)') AND md5(pg_get_functiondef(oid))='bb881be6eb13f4c31a9c5635a82f99db' AND proowner='profitia_ingestion_owner'::regrole AND prosecdef AND proconfig=ARRAY['search_path=pg_catalog, pg_temp']) THEN
  RAISE EXCEPTION 'Corporate Source predicate drift; reconciliation required';END IF;
 SELECT proacl INTO packet_acl FROM pg_proc WHERE oid='profitia_srm_catalog.current_packet(text,boolean)'::regprocedure;
 SELECT proacl INTO scope_acl FROM pg_proc WHERE oid='profitia_srm_catalog.scope_allows(text,boolean)'::regprocedure;
 EXECUTE $install_0$CREATE FUNCTION profitia_srm_catalog.current_publication_effect(p_nip text,p_write boolean DEFAULT false) RETURNS uuid LANGUAGE plpgsql
SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE p record;e profitia_ingestion.effects%ROWTYPE;d jsonb;BEGIN
 IF profitia_srm_catalog.runtime_descriptor() IS NULL THEN RETURN NULL;END IF;
 SELECT effect_id,decision_id INTO p FROM profitia_srm_catalog.publications
  WHERE effect_id=nullif(current_setting('profitia.srm.catalog.effect',true),'')::uuid
   AND transaction_id=txid_current() AND nip=p_nip;
 IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT * INTO e FROM profitia_ingestion.effects WHERE effect_id=p.effect_id;
 d:=profitia_ingestion.runtime_descriptor();
 IF e.status NOT IN('RESERVED','COMMITTED') OR p_write AND e.status<>'RESERVED'
   OR e.decision_id IS DISTINCT FROM p.decision_id OR e.application_id IS DISTINCT FROM d->>'applicationId'
   OR e.service_id::text IS DISTINCT FROM d->>'serviceId'
   OR profitia_ingestion.scope_allows(e.source_id,e.resource_id) IS NOT TRUE THEN RETURN NULL;END IF;
 RETURN p.effect_id;
EXCEPTION WHEN invalid_text_representation THEN RETURN NULL;END $fn$;$install_0$;
 EXECUTE $install_1$CREATE OR REPLACE FUNCTION profitia_srm_catalog.current_packet(p_nip text,p_write boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql
SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE p profitia_srm_catalog.publications%ROWTYPE;effect uuid;BEGIN
 effect:=profitia_srm_catalog.current_publication_effect(p_nip,p_write);
 IF effect IS NULL THEN RETURN NULL;END IF;
 SELECT * INTO p FROM profitia_srm_catalog.publications WHERE effect_id=effect;
 IF NOT FOUND THEN RETURN NULL;END IF;
 RETURN p.packet||jsonb_build_object('effectId',p.effect_id::text,'expectedHashes',jsonb_build_object('general',p.general_sha256,'financial',p.financial_sha256));
END $fn$;$install_1$;
 EXECUTE $install_2$CREATE OR REPLACE FUNCTION profitia_srm_catalog.scope_allows(p_nip text,p_write boolean DEFAULT false) RETURNS boolean LANGUAGE sql
SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT profitia_srm_catalog.current_publication_effect(p_nip,p_write) IS NOT NULL
$fn$;$install_2$;
 REVOKE ALL ON FUNCTION profitia_srm_catalog.current_publication_effect(text,boolean) FROM PUBLIC;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('profitia_srm_catalog.current_packet(text,boolean)') AND md5(pg_get_functiondef(oid))='d05253f58e5925b8132d7b9df890c0b3' AND proowner='profitia_ingestion_owner'::regrole AND prosecdef AND proconfig=ARRAY['search_path=pg_catalog, pg_temp']) OR
  NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('profitia_srm_catalog.scope_allows(text,boolean)') AND md5(pg_get_functiondef(oid))='eb8502e90864587e958438d0fe54effb' AND proowner='profitia_ingestion_owner'::regrole AND prosecdef AND proconfig=ARRAY['search_path=pg_catalog, pg_temp']) OR
  NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('profitia_srm_catalog.current_publication_effect(text,boolean)') AND md5(pg_get_functiondef(oid))='ed06b8681976743acf768e89c60fe379' AND proowner='profitia_ingestion_owner'::regrole AND prosecdef AND proconfig=ARRAY['search_path=pg_catalog, pg_temp']) OR
  (SELECT proacl FROM pg_proc WHERE oid='profitia_srm_catalog.current_packet(text,boolean)'::regprocedure) IS DISTINCT FROM packet_acl OR
  (SELECT proacl FROM pg_proc WHERE oid='profitia_srm_catalog.scope_allows(text,boolean)'::regprocedure) IS DISTINCT FROM scope_acl OR
  EXISTS(SELECT 1 FROM pg_proc p,LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
   WHERE p.oid='profitia_srm_catalog.current_publication_effect(text,boolean)'::regprocedure AND a.grantee<>p.proowner) THEN
  RAISE EXCEPTION 'Corporate Source projection identity or ACL changed';END IF;
END $scope_projection$;
