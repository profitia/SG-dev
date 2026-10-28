-- Bounded local selection metadata under the current HUMAN read. No refresh
-- quota or private financial snapshot is created. Same-transaction OUTCOME is
-- mandatory, including when Clerk access disappears before disclosure.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR to_regclass('srm.ready_company_reports') IS NULL THEN
  RAISE EXCEPTION 'Controlled prepared report owner required' USING ERRCODE='42501';END IF;
END $guard$;
CREATE TABLE srm.ready_report_reads(
 decision_id uuid PRIMARY KEY,organisation_id uuid NOT NULL,user_id uuid NOT NULL,
 nip text NOT NULL,body_digest text NOT NULL,lookup_id uuid NOT NULL UNIQUE,
 transaction_id bigint NOT NULL DEFAULT txid_current(),selected_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(nip,body_digest) REFERENCES srm.ready_company_reports(nip,body_digest)
);
CREATE TABLE srm.ready_report_read_outcomes(
 decision_id uuid PRIMARY KEY REFERENCES srm.ready_report_reads(decision_id),
 event_id bigint NOT NULL UNIQUE REFERENCES profitia_access.security_events(event_id),
 transaction_id bigint NOT NULL DEFAULT txid_current()
);
DO $tables$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['ready_report_reads','ready_report_read_outcomes'] LOOP
  EXECUTE format('ALTER TABLE srm.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE srm.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY controlled_owner ON srm.%I TO profitia_access_owner USING(true) WITH CHECK(true)',t);
  EXECUTE format('CREATE POLICY runtime_fence ON srm.%I AS RESTRICTIVE TO PUBLIC USING(current_user=''profitia_access_owner'') WITH CHECK(current_user=''profitia_access_owner'')',t);
  EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON srm.%I FOR EACH ROW EXECUTE FUNCTION profitia_srm_catalog.immutable()',t);
  EXECUTE format('CREATE TRIGGER no_truncate BEFORE TRUNCATE ON srm.%I FOR EACH STATEMENT EXECUTE FUNCTION profitia_srm_catalog.immutable()',t);
 END LOOP;
END $tables$;
CREATE FUNCTION srm.ready_report_metadata_scope(p_org uuid,p_nip text DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql
 SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE uid uuid;BEGIN
 IF NOT EXISTS(SELECT 1 FROM profitia_access.runtime_bindings WHERE login_role=session_user AND application_id='srm' AND status='ACTIVE') THEN RETURN false;END IF;
 uid:=nullif(current_setting('profitia.user_id',true),'')::uuid;
 RETURN uid IS NOT NULL AND profitia_modules.scope_allows('supplier_report',p_org,uid)
  AND EXISTS(SELECT 1 FROM srm.ready_report_reads r WHERE r.decision_id=nullif(current_setting('profitia.srm.ready_read',true),'')::uuid
   AND r.transaction_id=txid_current() AND r.organisation_id=p_org AND r.user_id=uid AND (p_nip IS NULL OR r.nip=p_nip));
EXCEPTION WHEN invalid_text_representation THEN RETURN false;END $fn$;

ALTER FUNCTION srm.supplier_business_phase(uuid,text,uuid,text[]) RENAME TO supplier_business_phase_before_ready_v1;
CREATE FUNCTION srm.supplier_business_phase(p_org uuid,p_nip text,p_lookup uuid,p_phases text[]) RETURNS boolean LANGUAGE plpgsql
 SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$ BEGIN
 IF p_phases<@ARRAY['REGISTER_LOOKUP','RECORD_INTEREST']::text[] AND cardinality(p_phases)>0
  AND srm.ready_report_metadata_scope(p_org,p_nip) AND (p_lookup IS NULL OR EXISTS(
   SELECT 1 FROM srm.ready_report_reads WHERE decision_id=nullif(current_setting('profitia.srm.ready_read',true),'')::uuid AND lookup_id=p_lookup)) THEN RETURN true;END IF;
 RETURN srm.supplier_business_phase_before_ready_v1(p_org,p_nip,p_lookup,p_phases);
END $fn$;
ALTER FUNCTION srm.named_interest_phase(uuid,text) RENAME TO named_interest_phase_before_ready_v1;
CREATE FUNCTION srm.named_interest_phase(p_org uuid,p_nip text DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql
 SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$ BEGIN
 IF srm.ready_report_metadata_scope(p_org,p_nip) THEN RETURN true;END IF;
 RETURN srm.named_interest_phase_before_ready_v1(p_org,p_nip);
END $fn$;

-- Owner DML remains closed except this exact current metadata receipt. The
-- receipt is written only by the validated HUMAN port above; GUCs alone cannot
-- open any row, and financial/private payload writes retain their old fences.
DO $metadata_policies$ DECLARE item text;predicate text;old_check text;BEGIN
 FOREACH item IN ARRAY ARRAY['suppliers','lookup_requests'] LOOP
  predicate:=format('current_user=''profitia_access_owner'' AND srm.ready_report_metadata_scope(organization_id,%I)',CASE item WHEN 'suppliers' THEN 'nip' ELSE 'identifier' END);
  EXECUTE format('CREATE POLICY ready_metadata_insert ON srm.%I FOR INSERT TO profitia_access_owner WITH CHECK(%s)',item,predicate);
  SELECT with_check INTO STRICT old_check FROM pg_policies WHERE schemaname='srm' AND tablename=item AND policyname='private_operation_fence';
  EXECUTE format('ALTER POLICY private_operation_fence ON srm.%I WITH CHECK((%s) OR (%s))',item,old_check,predicate);
 END LOOP;
END $metadata_policies$;

CREATE FUNCTION srm.capture_ready_report_outcome() RETURNS trigger LANGUAGE plpgsql
 SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$ BEGIN
 IF NEW.application_id='srm' AND NEW.phase='OUTCOME' AND NEW.event->>'decision'='ALLOW' THEN
  INSERT INTO srm.ready_report_read_outcomes(decision_id,event_id)
   SELECT r.decision_id,NEW.event_id FROM srm.ready_report_reads r WHERE r.decision_id=NEW.decision_id
    AND r.transaction_id=txid_current() AND NEW.event->>'operation'='supplier.report.read'
    AND NEW.event->>'resourceVersion'=r.body_digest
    AND NEW.event->>'organisationId'=r.organisation_id::text AND NEW.event->>'actorId'=r.user_id::text
    AND NEW.event->'moduleEvidence'->>'transactionId'=txid_current()::text;
 END IF;RETURN NULL;
END $fn$;
CREATE TRIGGER ready_report_outcome AFTER INSERT ON profitia_access.security_events
 FOR EACH ROW EXECUTE FUNCTION srm.capture_ready_report_outcome();
CREATE FUNCTION srm.require_ready_report_outcome() RETURNS trigger LANGUAGE plpgsql
 SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$ BEGIN
 IF NEW.transaction_id<>txid_current() OR NOT EXISTS(SELECT 1 FROM srm.ready_report_read_outcomes w
   JOIN profitia_access.security_events a ON a.event_id=w.event_id AND a.decision_id=NEW.decision_id
   WHERE w.decision_id=NEW.decision_id AND w.transaction_id=txid_current() AND a.phase='OUTCOME'
    AND a.event->>'decision'='ALLOW' AND a.event->'moduleEvidence'->>'transactionId'=txid_current()::text) THEN
  RAISE EXCEPTION 'Current report-read OUTCOME required' USING ERRCODE='42501';END IF;
 RETURN NULL;
END $fn$;
CREATE CONSTRAINT TRIGGER ready_report_read_outcome AFTER INSERT ON srm.ready_report_reads
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION srm.require_ready_report_outcome();

CREATE FUNCTION srm.register_ready_report_read(p_org uuid,p_user uuid,p_nip text,p_body text,p_decision uuid,p_scanner jsonb) RETURNS jsonb LANGUAGE plpgsql
 SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE supplier uuid;selection uuid:=gen_random_uuid();surrogate uuid;frame jsonb;BEGIN
 IF p_user IS DISTINCT FROM nullif(current_setting('profitia.user_id',true),'')::uuid
  OR profitia_modules.scope_allows('supplier_report',p_org,p_user) IS NOT TRUE
  OR NOT EXISTS(SELECT 1 FROM profitia_access.security_events a WHERE a.application_id='srm' AND a.phase='INTENT'
    AND a.decision_id=p_decision AND a.event->>'decision'='ALLOW' AND a.event->>'operation'='supplier.report.read'
    AND a.event->>'resourceId'='supplier-report:COMPANY:'||p_nip AND a.event->>'resourceVersion'=p_body
    AND a.event->>'organisationId'=p_org::text AND a.event->>'actorId'=p_user::text
    AND a.event->'moduleEvidence'->>'transactionId'=txid_current()::text)
  OR NOT EXISTS(SELECT 1 FROM srm.ready_company_reports r JOIN srm.catalog_companies c ON c.nip=r.nip
    WHERE r.nip=p_nip AND r.body_digest=p_body AND r.general_sha256=c.general_sha256 AND r.financial_sha256=c.financial_sha256
      AND r.general_effect=c.general_source_snapshot_id AND r.financial_effect=c.financial_source_snapshot_id)
  OR octet_length(p_scanner::text)>1048576 THEN RAISE EXCEPTION 'Exact current prepared HUMAN read required' USING ERRCODE='42501';END IF;
 INSERT INTO srm.ready_report_reads(decision_id,organisation_id,user_id,nip,body_digest,lookup_id)
  VALUES(p_decision,p_org,p_user,p_nip,p_body,selection);
 PERFORM set_config('profitia.srm.ready_read',p_decision::text,true);
 INSERT INTO srm.suppliers(organization_id,nip) VALUES(p_org,p_nip) ON CONFLICT(organization_id,nip) WHERE nip IS NOT NULL DO NOTHING;
 SELECT id INTO STRICT supplier FROM srm.suppliers WHERE organization_id=p_org AND nip=p_nip;
 INSERT INTO srm.lookup_requests(organization_id,id,supplier_id,identifier_type,identifier,entity_type) VALUES(p_org,selection,supplier,'NIP',p_nip,'COMPANY');
 INSERT INTO srm.users(organization_id,subject_key,identity_kind) VALUES(p_org,'profitia-account:'||p_user::text,'AUTHENTICATED')
  ON CONFLICT(organization_id,subject_key) DO NOTHING;
 SELECT id INTO STRICT surrogate FROM srm.users WHERE organization_id=p_org AND subject_key='profitia-account:'||p_user::text AND identity_kind='AUTHENTICATED';
 INSERT INTO srm.organization_supplier_interest(organization_id,nip) VALUES(p_org,p_nip)
  ON CONFLICT(organization_id,nip) DO UPDATE SET last_selected_at=clock_timestamp();
 INSERT INTO srm.user_supplier_interest(organization_id,user_id,nip) VALUES(p_org,surrogate,p_nip)
  ON CONFLICT(organization_id,user_id,nip) DO UPDATE SET last_selected_at=clock_timestamp();
 IF p_scanner<>'null'::jsonb THEN
  IF jsonb_typeof(p_scanner)<>'object' OR jsonb_typeof(p_scanner->'referenceFrames')<>'array' OR jsonb_array_length(p_scanner->'referenceFrames')>100 THEN
   RAISE EXCEPTION 'Bounded scanner metadata required' USING ERRCODE='42501';END IF;
  FOR frame IN SELECT value FROM jsonb_array_elements(p_scanner->'referenceFrames') LOOP
   INSERT INTO srm.financial_scanner_frames(organization_id,nip,frame_id,frame_json)
    VALUES(p_org,p_nip,frame->>'id',p_scanner||jsonb_build_object('referenceFrames',jsonb_build_array(frame),
     'periods',(SELECT coalesce(jsonb_agg(p),'[]'::jsonb) FROM jsonb_array_elements(p_scanner->'periods') p WHERE p->>'referenceFrameId'=frame->>'id')))
    ON CONFLICT DO NOTHING;
  END LOOP;
 END IF;
 RETURN jsonb_build_object('supplierId',supplier);
END $fn$;
REVOKE ALL ON srm.ready_report_reads,srm.ready_report_read_outcomes FROM PUBLIC;
REVOKE ALL ON FUNCTION srm.ready_report_metadata_scope(uuid,text),srm.supplier_business_phase(uuid,text,uuid,text[]),srm.named_interest_phase(uuid,text),srm.capture_ready_report_outcome(),srm.require_ready_report_outcome(),srm.register_ready_report_read(uuid,uuid,text,text,uuid,jsonb) FROM PUBLIC;
-- Replacements retain exactly the predecessor's execute recipients.
DO $acl$ DECLARE pair text[];a record;BEGIN
 FOREACH pair SLICE 1 IN ARRAY ARRAY[
  ['srm.supplier_business_phase_before_ready_v1(uuid,text,uuid,text[])','srm.supplier_business_phase(uuid,text,uuid,text[])'],
  ['srm.named_interest_phase_before_ready_v1(uuid,text)','srm.named_interest_phase(uuid,text)']] LOOP
  FOR a IN SELECT x.grantee FROM pg_proc p,LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x
   WHERE p.oid=pair[1]::regprocedure AND x.privilege_type='EXECUTE' AND x.grantee<>p.proowner LOOP
   EXECUTE format('GRANT EXECUTE ON FUNCTION srm.ready_report_metadata_scope(uuid,text) TO %s',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END);
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %s',pair[2],CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END);
  END LOOP;
 END LOOP;
END $acl$;
