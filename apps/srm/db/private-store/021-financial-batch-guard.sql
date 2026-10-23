-- Explicit optional adoption under the existing access owner. Immutable facts
-- remain append-only, tenant scoped and tied to the current exact Native Work.
-- The snapshot GUC is an untrusted selector, never an authentication proof.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
  AND NOT(rolcanlogin OR rolsuper OR rolbypassrls OR rolinherit OR rolcreatedb OR rolcreaterole OR rolreplication))
  OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='srm.guard_supplier_business_write()'::regprocedure
   AND proowner='profitia_access_owner'::regrole AND prosecdef
   AND md5(pg_get_functiondef(oid))='1528f903448f0dac2c0e99565f141157') THEN
  RAISE EXCEPTION 'Exact existing financial guard and controlled owner required';END IF;
END $guard$;
CREATE OR REPLACE FUNCTION srm.financial_statement_target() RETURNS uuid[] LANGUAGE plpgsql
SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE snapshot uuid;d jsonb;target uuid[];BEGIN
 snapshot:=nullif(current_setting('profitia.srm.financial.snapshot',true),'')::uuid;
 IF snapshot IS NULL THEN RETURN NULL;END IF;
 d:=srm.current_supplier_work();
 IF d IS NULL OR d->>'unitId'<>'SRM_STORE_FINANCIAL' OR d->>'accessMode'<>'WRITE' THEN RETURN NULL;END IF;
 SELECT ARRAY[s.organization_id,s.supplier_id,s.id] INTO target FROM srm.source_snapshots s
  JOIN srm.provider_attempts a ON a.organization_id=s.organization_id AND a.id=s.attempt_id AND a.section='financial'
  JOIN srm.lookup_requests l ON l.organization_id=a.organization_id AND l.id=a.request_id AND l.supplier_id=s.supplier_id
  WHERE s.id=snapshot AND s.organization_id=(d->>'organisationId')::uuid AND s.section='financial'
   AND l.id=(d->>'requestId')::uuid AND l.identifier=d->>'nip' AND l.entity_type='COMPANY';
 RETURN target;
EXCEPTION WHEN invalid_text_representation THEN RETURN NULL;END $fn$;
REVOKE ALL ON FUNCTION srm.financial_statement_target() FROM PUBLIC;
DO $acl$ DECLARE a record;BEGIN
 FOR a IN SELECT x.grantee FROM pg_proc p,LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x
  WHERE p.oid='srm.native_supplier_row(text,uuid,uuid,uuid,uuid,text,text,text)'::regprocedure AND x.privilege_type='EXECUTE' AND x.grantee<>p.proowner LOOP
  EXECUTE format('GRANT EXECUTE ON FUNCTION srm.financial_statement_target() TO %s',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END);
 END LOOP;
END $acl$;
DO $policies$ DECLARE p record;BEGIN
 FOR p IN SELECT * FROM pg_policies WHERE schemaname='srm' AND tablename='financial_facts' AND cmd IN('INSERT','ALL')
  AND with_check IS NOT NULL AND policyname<>'tenant_scope' AND position('financial_statement_target' in with_check)=0 LOOP
  EXECUTE format('ALTER POLICY %I ON srm.financial_facts WITH CHECK(CASE WHEN ARRAY[organization_id,supplier_id,snapshot_id]=(SELECT srm.financial_statement_target()) THEN true ELSE (%s) END)',p.policyname,p.with_check);
 END LOOP;
END $policies$;
CREATE OR REPLACE FUNCTION srm.guard_financial_batch() RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE g record;BEGIN
 IF EXISTS(SELECT 1 FROM financial_written w LEFT JOIN srm.source_snapshots s
   ON s.organization_id=w.organization_id AND s.id=w.snapshot_id AND s.supplier_id=w.supplier_id AND s.section='financial'
  LEFT JOIN srm.provider_attempts a ON a.organization_id=s.organization_id AND a.id=s.attempt_id AND a.section='financial'
  LEFT JOIN srm.lookup_requests l ON l.organization_id=a.organization_id AND l.id=a.request_id AND l.supplier_id=w.supplier_id
  WHERE s.id IS NULL OR a.id IS NULL OR l.id IS NULL) THEN
  RAISE EXCEPTION 'Bound corporate financial snapshot required' USING ERRCODE='42501';END IF;
 FOR g IN SELECT DISTINCT w.organization_id,l.id AS request_id,l.identifier AS nip FROM financial_written w
  JOIN srm.source_snapshots s ON s.organization_id=w.organization_id AND s.id=w.snapshot_id AND s.supplier_id=w.supplier_id
  JOIN srm.provider_attempts a ON a.organization_id=s.organization_id AND a.id=s.attempt_id
  JOIN srm.lookup_requests l ON l.organization_id=a.organization_id AND l.id=a.request_id LOOP
  IF srm.supplier_business_phase(g.organization_id,g.nip,g.request_id,ARRAY['STORE_FINANCIAL']) IS NOT TRUE THEN
   RAISE EXCEPTION 'Current private supplier financial phase required' USING ERRCODE='42501';END IF;
 END LOOP;
 RETURN NULL;
END $fn$;
REVOKE ALL ON FUNCTION srm.guard_financial_batch() FROM PUBLIC;
DROP TRIGGER IF EXISTS supplier_business_phase ON srm.financial_facts;
-- Preserve the original prohibition of UPDATE/DELETE, including owner changes.
CREATE TRIGGER supplier_business_phase BEFORE UPDATE OR DELETE ON srm.financial_facts FOR EACH ROW EXECUTE FUNCTION srm.guard_supplier_business_write();
DROP TRIGGER IF EXISTS financial_batch_insert ON srm.financial_facts;
CREATE TRIGGER financial_batch_insert AFTER INSERT ON srm.financial_facts REFERENCING NEW TABLE AS financial_written FOR EACH STATEMENT EXECUTE FUNCTION srm.guard_financial_batch();
