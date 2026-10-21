-- SRM-owned business persistence. Install once in the verified private receiver,
-- after exact SQL019, as the controlled NOLOGIN owner with applications disabled.
-- No runtime grants, operation grants, policies, provider calls or activation.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
  AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
  AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid))
  OR EXISTS(SELECT 1 FROM profitia_access.applications WHERE status<>'DISABLED')
  OR NOT EXISTS(SELECT 1 FROM profitia_requests.location_installation WHERE singleton AND schema_version='1.0.0'
   AND schema_digest='34ec633dbf38dfffd6b3954ae79b0ef6f771d75ad8f0443882be71ca78b084e5')
  OR NOT EXISTS(SELECT 1 FROM srm.private_installation WHERE singleton AND schema_version='1.0.0'
   AND boundary_digest='19220c7bb31365ed058bc55a99bca2aa4a9f38b7f8ca2a2ddde52ec71ed16ed4') THEN
  RAISE EXCEPTION 'Controlled disabled exact private SRM and SQL019 installation required' USING ERRCODE='42501';
 END IF;
END $guard$;

CREATE TABLE srm.supplier_location_installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),source_ref text NOT NULL CHECK(source_ref~'^[a-f0-9]{40}$'),
 installed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON srm.supplier_location_installation FOR EACH ROW EXECUTE FUNCTION profitia_supplier_jobs.immutable();
CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON srm.supplier_location_installation FOR EACH STATEMENT EXECUTE FUNCTION profitia_supplier_jobs.immutable();
CREATE TABLE srm.supplier_location_collections(
 organization_id uuid NOT NULL REFERENCES profitia_access.organisations(organisation_id),supplier_id uuid NOT NULL,
 version bigint NOT NULL DEFAULT 0 CHECK(version>=0),source_state jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(source_state)='object' AND octet_length(source_state::text)<=16384),
 PRIMARY KEY(organization_id,supplier_id),FOREIGN KEY(organization_id,supplier_id) REFERENCES srm.suppliers(organization_id,id)
);
CREATE TABLE srm.supplier_locations(
 organization_id uuid NOT NULL REFERENCES profitia_access.organisations(organisation_id),supplier_id uuid NOT NULL,location_id uuid NOT NULL,
 location_group text NOT NULL CHECK(location_group IN('SUPPLIER_LOCATIONS','RELATED_ENTITIES','USER_LOCATIONS')),
 kind text NOT NULL CHECK(kind IN('HEADQUARTERS','BRANCH','RELATED_ENTITY_HEADQUARTERS','USER_DEFINED')),
 origin text NOT NULL CHECK(origin IN('SOURCE','MANUAL')),entity_key text NOT NULL CHECK(length(entity_key) BETWEEN 1 AND 512),
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),address_version text NOT NULL CHECK(address_version~'^[a-f0-9]{64}$'),
 body jsonb NOT NULL CHECK(jsonb_typeof(body)='object' AND octet_length(body::text)<=16384),
 source_version text,source_retrieved_at timestamptz,retention_until timestamptz,
 lifecycle text NOT NULL CHECK(lifecycle IN('ACTIVE','INACTIVE')),
 created_by_user_id uuid NOT NULL REFERENCES profitia_access.accounts(user_id),updated_by_user_id uuid NOT NULL REFERENCES profitia_access.accounts(user_id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 audit_request_id uuid NOT NULL REFERENCES profitia_requests.intents(request_id),
 PRIMARY KEY(organization_id,supplier_id,location_id),UNIQUE(organization_id,supplier_id,origin,entity_key),
 FOREIGN KEY(organization_id,supplier_id) REFERENCES srm.suppliers(organization_id,id),
 CHECK(origin='MANUAL' AND location_group='USER_LOCATIONS' AND kind='USER_DEFINED' AND source_version IS NULL AND retention_until IS NULL
  OR origin='SOURCE' AND source_version IS NOT NULL AND source_retrieved_at IS NOT NULL AND
   (location_group='SUPPLIER_LOCATIONS' AND kind IN('HEADQUARTERS','BRANCH') OR location_group='RELATED_ENTITIES' AND kind='RELATED_ENTITY_HEADQUARTERS' AND retention_until IS NOT NULL)),
 CHECK(body ?& ARRAY['label','description','address','originalAddress','sources','relationship','verification','geocodingStatus','coordinates']),
 CHECK(jsonb_typeof(body->'label')='string' AND jsonb_typeof(body->'description')='string' AND jsonb_typeof(body->'sources')='array'),
 CHECK(length(body->>'label') BETWEEN 1 AND 160 AND length(body->>'description')<=1024),
 CHECK(body->'address'='null'::jsonb OR jsonb_typeof(body->'address')='object'),
 CHECK(body->'coordinates'='null'::jsonb OR jsonb_typeof(body->'coordinates')='object'),
 CHECK(body->'coordinates'='null'::jsonb OR body->'coordinates'->>'origin'<>'GOOGLE_GEOCODING' OR
  ((body->'coordinates'->>'expiresAt')::timestamptz>(body->'coordinates'->>'fetchedAt')::timestamptz
   AND (body->'coordinates'->>'expiresAt')::timestamptz<=(body->'coordinates'->>'fetchedAt')::timestamptz+interval '30 days'))
);
CREATE INDEX supplier_locations_page ON srm.supplier_locations(organization_id,supplier_id,location_group,created_at,location_id);
CREATE INDEX supplier_locations_expiry ON srm.supplier_locations(retention_until) WHERE retention_until IS NOT NULL;

DO $rls$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['supplier_location_installation','supplier_location_collections','supplier_locations'] LOOP
  EXECUTE format('ALTER TABLE srm.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE srm.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY controlled_owner ON srm.%I TO profitia_access_owner USING(true) WITH CHECK(true)',t);
  EXECUTE format('CREATE POLICY no_direct_write ON srm.%I AS RESTRICTIVE FOR ALL TO PUBLIC USING(current_user=''profitia_access_owner'') WITH CHECK(current_user=''profitia_access_owner'')',t);
  EXECUTE format('REVOKE ALL ON TABLE srm.%I FROM PUBLIC',t);
 END LOOP;
END $rls$;

CREATE FUNCTION srm.location_installation_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;i srm.supplier_location_installation%ROWTYPE;t text;BEGIN
 d:=profitia_requests.location_runtime_descriptor();
 IF d IS NULL OR d->>'applicationId'<>'srm' OR has_schema_privilege(session_user,'srm','CREATE') THEN RETURN NULL;END IF;
 FOREACH t IN ARRAY ARRAY['supplier_location_installation','supplier_location_collections','supplier_locations'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='srm' AND c.relname=t
   AND c.relowner='profitia_access_owner'::regrole AND c.relrowsecurity AND c.relforcerowsecurity)
   OR has_table_privilege(session_user,'srm.'||t,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
   OR has_any_column_privilege(session_user,'srm.'||t,'INSERT,UPDATE,REFERENCES') THEN RETURN NULL;END IF;
 END LOOP;
 SELECT * INTO i FROM srm.supplier_location_installation WHERE singleton;IF NOT FOUND THEN RETURN NULL;END IF;
 RETURN d||jsonb_build_object('revision',profitia_access.runtime_descriptor()->'revision','locationBusinessSchemaVersion',i.schema_version,'locationBusinessSchemaDigest',i.schema_digest,'locationBusinessSourceRef',i.source_ref);
END $fn$;

CREATE FUNCTION srm.location_authority(p_org uuid,p_supplier uuid,p_operation text,p_resource text,p_intent boolean DEFAULT false) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;uid uuid;BEGIN
 d:=srm.location_installation_descriptor();uid:=nullif(current_setting('profitia.user_id',true),'')::uuid;
 IF d IS NULL OR uid IS NULL OR p_org IS NULL OR p_supplier IS NULL
  OR profitia_requests.location_access(p_operation,p_org,uid,p_resource) IS NOT TRUE
  OR NOT EXISTS(SELECT 1 FROM srm.suppliers WHERE organization_id=p_org AND id=p_supplier AND nip~'^[0-9]{10}$') THEN RETURN false;END IF;
 IF p_operation='supplier.location.read' AND p_resource<>'supplier-locations:'||p_supplier::text THEN RETURN false;END IF;
 IF p_intent THEN RETURN EXISTS(SELECT 1 FROM profitia_access.security_events e WHERE e.application_id='srm'
  AND e.environment=d->>'environment' AND e.phase='INTENT' AND e.event->>'decision'='ALLOW'
  AND e.event->>'operation'=p_operation AND e.event->>'resourceId'=p_resource AND e.event->>'actorKind'='HUMAN'
  AND e.event->>'actorId'=uid::text AND e.event->>'subjectUserId'=uid::text AND e.event->>'organisationId'=p_org::text
  AND e.event->>'policyVersion'='access-v1:'||(d->>'revision')
  AND e.event->'moduleEvidence'->>'moduleId'='supplier_report' AND e.event->'moduleEvidence'->>'transactionId'=txid_current()::text
  AND(e.event->'moduleEvidence'->>'expiresAt')::timestamptz>clock_timestamp());END IF;
 RETURN true;
EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow THEN RETURN false;
END $fn$;

-- Bounded authoritative metadata for the common host's readResources callback.
CREATE FUNCTION srm.location_metadata(p_org uuid,p_supplier uuid,p_operation text,p_location uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE c srm.supplier_location_collections%ROWTYPE;l srm.supplier_locations%ROWTYPE;r text;BEGIN
 r:=CASE WHEN p_operation='supplier.location.write' THEN p_location::text ELSE 'supplier-locations:'||p_supplier::text END;
 IF srm.location_authority(p_org,p_supplier,p_operation,r,false) IS NOT TRUE THEN RETURN NULL;END IF;
 SELECT * INTO c FROM srm.supplier_location_collections WHERE organization_id=p_org AND supplier_id=p_supplier FOR UPDATE;
 IF p_location IS NOT NULL THEN SELECT * INTO l FROM srm.supplier_locations WHERE organization_id=p_org AND supplier_id=p_supplier AND location_id=p_location FOR UPDATE;END IF;
 RETURN jsonb_build_object('supplierId',p_supplier,'collectionVersion',coalesce(c.version,0)::text,
  'exists',l.location_id IS NOT NULL,'origin',l.origin,'version',l.version::text,'addressVersion',l.address_version);
END $fn$;

CREATE FUNCTION srm.location_request(p_org uuid,p_supplier uuid,p_operation text,p_resource text,p_request uuid,p_digest text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE r profitia_requests.intents%ROWTYPE;uid uuid;BEGIN
 uid:=nullif(current_setting('profitia.user_id',true),'')::uuid;
 IF srm.location_authority(p_org,p_supplier,p_operation,p_resource,true) IS NOT TRUE
  OR profitia_requests.scope_allows(p_operation,p_org,uid,p_resource) IS NOT TRUE THEN RETURN NULL;END IF;
 SELECT * INTO r FROM profitia_requests.intents WHERE request_id=p_request AND application_id='srm' AND organisation_id=p_org
  AND user_id=uid AND operation=p_operation AND resource_id=p_resource AND payload_digest=p_digest AND status='RESERVED';
 IF NOT FOUND THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('userId',uid,'decisionId',r.decision_id,'scope',r.location_scope);
END $fn$;

-- Source rows are withheld when their exact source version, rights or retention cease.
CREATE FUNCTION srm.location_sources_current(p_org uuid,p_sources jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE s jsonb;uid uuid;d jsonb;meta jsonb;v_nip text;BEGIN
 uid:=nullif(current_setting('profitia.user_id',true),'')::uuid;d:=profitia_access.runtime_descriptor();
 IF uid IS NULL OR jsonb_typeof(p_sources)<>'array' OR jsonb_array_length(p_sources)>64 THEN RETURN false;END IF;
 FOR s IN SELECT * FROM jsonb_array_elements(p_sources) LOOP
  IF s->>'kind'='KYS' THEN
   IF s->>'retentionUntil' IS NULL OR(s->>'retentionUntil')::timestamptz<=clock_timestamp() THEN RETURN false;END IF;
   SELECT l.identifier INTO v_nip FROM srm.source_snapshots v JOIN srm.provider_attempts a ON a.organization_id=v.organization_id AND a.id=v.attempt_id
    JOIN srm.lookup_requests l ON l.organization_id=a.organization_id AND l.id=a.request_id WHERE v.organization_id=p_org AND v.id=(s->>'reportId')::uuid AND v.section='kys' AND l.entity_type='COMPANY';
   IF v_nip IS NULL OR profitia_requests.location_permission(d->>'applicationId',p_org,uid,'supplier.private.read','supplier-private-report:kys:COMPANY:'||v_nip) IS NOT TRUE THEN RETURN false;END IF;
   meta:=srm.private_supplier_metadata(p_org,v_nip,'COMPANY','kys');
   IF meta IS NULL OR meta->>'snapshotId' IS DISTINCT FROM s->>'version'
    OR(meta->>'retentionUntil')::timestamptz<(s->>'retentionUntil')::timestamptz THEN RETURN false;END IF;
  ELSIF s->>'kind'='MGBI' THEN
   v_nip:=split_part(s->>'reportId',':',2);
   IF v_nip!~'^[0-9]{10}$' OR profitia_requests.location_permission(d->>'applicationId',p_org,uid,'supplier.report.read','supplier-report:COMPANY:'||v_nip) IS NOT TRUE
    OR NOT EXISTS(SELECT 1 FROM srm.catalog_companies cc WHERE cc.nip=v_nip AND general_sha256=s->>'version') THEN RETURN false;END IF;
  ELSE RETURN false;END IF;
 END LOOP;
 RETURN true;
EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow THEN RETURN false;
END $fn$;

-- Domain-current source check also runs during readResources, so Root REPLAY
-- cannot publish a stale acceptance receipt after the underlying report changed.
CREATE FUNCTION srm.location_sources_admitted(p_org uuid,p_supplier uuid,p_sources jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 RETURN srm.location_authority(p_org,p_supplier,'supplier.location.sync','supplier-locations:'||p_supplier::text,false) IS TRUE
  AND srm.location_sources_current(p_org,p_sources) IS TRUE;
END $fn$;

-- Losing address enrichment rights must not hide a legal relationship whose
-- KYS source is still available. Its address/coordinates are withheld instead.
CREATE FUNCTION srm.location_visible_body(p_org uuid,p_group text,p_body jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE private_sources jsonb;BEGIN
 IF srm.location_sources_current(p_org,p_body->'sources') IS TRUE THEN RETURN p_body;END IF;
 IF p_group<>'RELATED_ENTITIES' THEN RETURN NULL;END IF;
 SELECT jsonb_agg(x) INTO private_sources FROM jsonb_array_elements(p_body->'sources') x WHERE x->>'kind'='KYS';
 IF private_sources IS NULL OR srm.location_sources_current(p_org,private_sources) IS NOT TRUE THEN RETURN NULL;END IF;
 RETURN p_body||jsonb_build_object('address',NULL,'originalAddress',NULL,'coordinates',NULL,'verification','UNRESOLVED','geocodingStatus','UNRESOLVED','sources',private_sources);
END $fn$;

CREATE FUNCTION srm.location_page(p_org uuid,p_supplier uuid,p_group text,p_offset integer,p_limit integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE items jsonb;total bigint;v bigint;has_hq boolean;has_related boolean;has_source boolean;v_nip text;BEGIN
 IF srm.location_authority(p_org,p_supplier,'supplier.location.read','supplier-locations:'||p_supplier::text,true) IS NOT TRUE
  OR p_group NOT IN('ALL','SUPPLIER_LOCATIONS','RELATED_ENTITIES','USER_LOCATIONS') OR p_offset<0 OR p_offset>100000 OR p_limit<1 OR p_limit>100 THEN
  RAISE EXCEPTION 'Location read unavailable' USING ERRCODE='42501';END IF;
 SELECT coalesce(version,0) INTO v FROM srm.supplier_location_collections WHERE organization_id=p_org AND supplier_id=p_supplier;
 SELECT count(*) INTO total FROM srm.supplier_locations l WHERE organization_id=p_org AND supplier_id=p_supplier
  AND(p_group='ALL' OR location_group=p_group) AND(lifecycle='ACTIVE' OR location_group='RELATED_ENTITIES')
  AND(retention_until IS NULL OR retention_until>clock_timestamp()) AND srm.location_visible_body(p_org,location_group,body) IS NOT NULL;
 SELECT coalesce(jsonb_agg(x.row),'[]'::jsonb) INTO items FROM(SELECT
  (l.visible_body-ARRAY['coordinates'])||jsonb_build_object('id',location_id,'supplierId',supplier_id,'group',location_group,'kind',kind,'origin',origin,'entityKey',entity_key,
   'version',version::text,'addressVersion',address_version,'sourceVersion',source_version,'lifecycle',lifecycle,
   'createdAt',created_at,'updatedAt',updated_at,'createdByUserId',created_by_user_id,'updatedByUserId',updated_by_user_id,
   'coordinates',CASE WHEN l.visible_body->'coordinates'<>'null'::jsonb AND(l.visible_body->'coordinates'->>'expiresAt' IS NULL OR(l.visible_body->'coordinates'->>'expiresAt')::timestamptz>clock_timestamp()) THEN l.visible_body->'coordinates' ELSE 'null'::jsonb END) AS row
  FROM (SELECT r.*,srm.location_visible_body(p_org,r.location_group,r.body) AS visible_body FROM srm.supplier_locations r WHERE organization_id=p_org AND supplier_id=p_supplier) l WHERE organization_id=p_org AND supplier_id=p_supplier AND(p_group='ALL' OR location_group=p_group)
   AND(lifecycle='ACTIVE' OR location_group='RELATED_ENTITIES') AND(retention_until IS NULL OR retention_until>clock_timestamp())
   AND l.visible_body IS NOT NULL ORDER BY created_at,location_id OFFSET p_offset LIMIT p_limit)x;
 SELECT coalesce(bool_or(kind='HEADQUARTERS'),false),coalesce(bool_or(location_group='RELATED_ENTITIES'),false),coalesce(bool_or(origin='SOURCE'),false)
  INTO has_hq,has_related,has_source FROM srm.supplier_locations WHERE organization_id=p_org AND supplier_id=p_supplier
   AND(lifecycle='ACTIVE' OR location_group='RELATED_ENTITIES') AND(retention_until IS NULL OR retention_until>clock_timestamp())
   AND srm.location_visible_body(p_org,location_group,body) IS NOT NULL;
 SELECT nip INTO v_nip FROM srm.suppliers WHERE organization_id=p_org AND id=p_supplier;
 RETURN jsonb_build_object('items',items,'total',total,'collectionVersion',coalesce(v,0)::text,'coverage',jsonb_build_object(
  'headquarters',CASE WHEN profitia_requests.location_permission('srm',p_org,nullif(current_setting('profitia.user_id',true),'')::uuid,'supplier.report.read','supplier-report:COMPANY:'||v_nip) IS NOT TRUE THEN 'UNAVAILABLE' WHEN has_hq THEN 'AVAILABLE' ELSE 'MISSING' END,
  'branches','NOT_CONFIRMED','relatedEntities',CASE WHEN has_related THEN 'AVAILABLE' ELSE 'UNAVAILABLE' END,'sync',CASE WHEN has_source THEN 'CURRENT' ELSE 'PENDING' END));
END $fn$;

CREATE FUNCTION srm.location_manual_write(p_org uuid,p_supplier uuid,p_location uuid,p_action text,p_expected bigint,p_request uuid,p_digest text,p_command_text text,p_address_version text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE accepted jsonb;scope jsonb;c jsonb;b jsonb;uid uuid;existing srm.supplier_locations%ROWTYPE;BEGIN
 accepted:=srm.location_request(p_org,p_supplier,'supplier.location.write',p_location::text,p_request,p_digest);
 IF accepted IS NULL THEN RAISE EXCEPTION 'Location write unavailable' USING ERRCODE='42501';END IF;
 scope:=accepted->'scope';uid:=(accepted->>'userId')::uuid;c:=p_command_text::jsonb;
 IF octet_length(p_command_text)>8192 OR encode(sha256(convert_to(p_command_text,'UTF8')),'hex') IS DISTINCT FROM scope->>'commandDigest'
  OR scope->>'supplierId' IS DISTINCT FROM p_supplier::text OR scope->>'locationId' IS DISTINCT FROM p_location::text OR scope->>'origin'<>'MANUAL'
  OR p_action NOT IN('CREATE','UPDATE','DEACTIVATE') OR p_address_version!~'^[a-f0-9]{64}$' THEN
  RAISE EXCEPTION 'Location command mismatch' USING ERRCODE='42501';END IF;
 INSERT INTO srm.supplier_location_collections(organization_id,supplier_id) VALUES(p_org,p_supplier) ON CONFLICT DO NOTHING;
 PERFORM 1 FROM srm.supplier_location_collections WHERE organization_id=p_org AND supplier_id=p_supplier FOR UPDATE;
 SELECT * INTO existing FROM srm.supplier_locations WHERE organization_id=p_org AND supplier_id=p_supplier AND location_id=p_location FOR UPDATE;
 IF p_action='CREATE' AND(existing.location_id IS NOT NULL OR p_expected IS NOT NULL)
  OR p_action<>'CREATE' AND(existing.location_id IS NULL OR existing.origin<>'MANUAL' OR existing.version IS DISTINCT FROM p_expected) THEN
  RAISE EXCEPTION 'Location version conflict' USING ERRCODE='40001';END IF;
 IF p_action='DEACTIVATE' THEN
  IF c<>'null'::jsonb THEN RAISE EXCEPTION 'Closed deactivation required' USING ERRCODE='42501';END IF;
  UPDATE srm.supplier_locations SET lifecycle='INACTIVE',version=version+1,updated_at=clock_timestamp(),updated_by_user_id=uid,audit_request_id=p_request
   WHERE organization_id=p_org AND supplier_id=p_supplier AND location_id=p_location;
 ELSE
  IF profitia_requests.location_shape(c,ARRAY['address','description','label','position']) IS NOT TRUE
   OR profitia_requests.location_shape(c->'address',ARRAY['country','line1','locality','postalCode']) IS NOT TRUE
   OR length(c->>'label') NOT BETWEEN 1 AND 160 OR length(c->>'description')>1024
   OR EXISTS(SELECT 1 FROM jsonb_each_text(c->'address') a WHERE a.value IS NULL OR length(a.value) NOT BETWEEN 1 AND 200)
   OR(c->'position'<>'null'::jsonb AND(profitia_requests.location_shape(c->'position',ARRAY['lat','lng']) IS NOT TRUE
     OR jsonb_typeof(c->'position'->'lat')<>'number' OR jsonb_typeof(c->'position'->'lng')<>'number'
     OR abs((c->'position'->>'lat')::numeric)>90 OR abs((c->'position'->>'lng')::numeric)>180)) THEN
   RAISE EXCEPTION 'Invalid location fields' USING ERRCODE='22023';END IF;
  b:=jsonb_build_object('label',c->'label','description',c->'description','address',c->'address','originalAddress',NULL,'sources','[]'::jsonb,'relationship',NULL,
   'verification','USER_PROVIDED','geocodingStatus',CASE WHEN c->'position'='null'::jsonb THEN 'UNREQUESTED' ELSE 'RESOLVED' END,
   'coordinates',CASE WHEN c->'position'='null'::jsonb THEN 'null'::jsonb ELSE jsonb_build_object('position',c->'position','origin','USER_INPUT','fetchedAt',clock_timestamp(),'expiresAt',NULL) END);
  IF p_action='UPDATE' AND existing.address_version=p_address_version AND c->'position'='null'::jsonb AND existing.body->>'geocodingStatus' IN('DELIVERY_UNCERTAIN','AMBIGUOUS','LOW_PRECISION','QUOTA_EXCEEDED') THEN b:=b||jsonb_build_object('geocodingStatus',existing.body->'geocodingStatus');END IF;
  IF p_action='CREATE' THEN INSERT INTO srm.supplier_locations(organization_id,supplier_id,location_id,location_group,kind,origin,entity_key,address_version,body,lifecycle,created_by_user_id,updated_by_user_id,audit_request_id)
   VALUES(p_org,p_supplier,p_location,'USER_LOCATIONS','USER_DEFINED','MANUAL','MANUAL:'||p_location::text,p_address_version,b,'ACTIVE',uid,uid,p_request);
  ELSE UPDATE srm.supplier_locations SET body=b,address_version=p_address_version,version=version+1,lifecycle='ACTIVE',updated_at=clock_timestamp(),updated_by_user_id=uid,audit_request_id=p_request
   WHERE organization_id=p_org AND supplier_id=p_supplier AND location_id=p_location;END IF;
 END IF;
 UPDATE srm.supplier_location_collections SET version=version+1 WHERE organization_id=p_org AND supplier_id=p_supplier;
END $fn$;

-- Original expected version comes from the ONE accepted Root intent. A retry
-- must not acquire a different payload after another source/manual update.
CREATE FUNCTION srm.location_sync_target(p_org uuid,p_supplier uuid,p_key text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE v text;BEGIN
 IF srm.location_authority(p_org,p_supplier,'supplier.location.read','supplier-locations:'||p_supplier::text,true) IS NOT TRUE
  OR p_key!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Location preparation unavailable' USING ERRCODE='42501';END IF;
 SELECT location_scope->>'targetVersion' INTO v FROM profitia_requests.intents WHERE key_digest=p_key AND application_id='srm'
  AND organisation_id=p_org AND user_id=nullif(current_setting('profitia.user_id',true),'')::uuid
  AND operation='supplier.location.sync' AND resource_id='supplier-locations:'||p_supplier::text
  AND location_scope->>'supplierId'=p_supplier::text;
 IF v IS NOT NULL THEN RETURN v;END IF;
 SELECT version::text INTO v FROM srm.supplier_location_collections WHERE organization_id=p_org AND supplier_id=p_supplier;
 RETURN coalesce(v,'0');
END $fn$;

-- This is a business reconciliation under an already admitted Root request,
-- not a second request ledger, source acquisition or background dispatcher.
CREATE FUNCTION srm.location_sync_write(p_org uuid,p_supplier uuid,p_expected bigint,p_request uuid,p_digest text,p_command_text text,p_rows jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE accepted jsonb;uid uuid;scope jsonb;row jsonb;old srm.supplier_locations%ROWTYPE;v bigint;retention timestamptz;retrieved timestamptz;v_body jsonb;v_source_version text;BEGIN
 accepted:=srm.location_request(p_org,p_supplier,'supplier.location.sync','supplier-locations:'||p_supplier::text,p_request,p_digest);
 IF accepted IS NULL THEN RAISE EXCEPTION 'Location sync unavailable' USING ERRCODE='42501';END IF;
 scope:=accepted->'scope';uid:=(accepted->>'userId')::uuid;
 IF octet_length(p_command_text)>16384 OR encode(sha256(convert_to(p_command_text,'UTF8')),'hex') IS DISTINCT FROM scope->>'commandDigest'
  OR scope->>'supplierId' IS DISTINCT FROM p_supplier::text OR scope->>'origin'<>'COLLECTION'
  OR scope->>'targetVersion' IS DISTINCT FROM p_expected::text OR jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows)>2000
  OR octet_length(p_rows::text)>8388608 THEN RAISE EXCEPTION 'Invalid location reconciliation' USING ERRCODE='42501';END IF;
 INSERT INTO srm.supplier_location_collections(organization_id,supplier_id) VALUES(p_org,p_supplier) ON CONFLICT DO NOTHING;
 SELECT version INTO v FROM srm.supplier_location_collections WHERE organization_id=p_org AND supplier_id=p_supplier FOR UPDATE;
 IF v IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Location collection changed' USING ERRCODE='40001';END IF;
 FOR row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
  IF profitia_requests.location_shape(row,ARRAY['id','group','kind','label','description','address','originalAddress','entityKey','sources','relationship','verification','lifecycle','addressVersion']) IS NOT TRUE
   OR row->>'group' NOT IN('SUPPLIER_LOCATIONS','RELATED_ENTITIES') OR row->>'kind' NOT IN('HEADQUARTERS','BRANCH','RELATED_ENTITY_HEADQUARTERS')
   OR row->>'lifecycle' NOT IN('ACTIVE','INACTIVE') OR row->>'addressVersion'!~'^[a-f0-9]{64}$'
   OR srm.location_sources_current(p_org,row->'sources') IS NOT TRUE OR jsonb_array_length(row->'sources')=0
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(row->'sources') z WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(scope->'sources') e
      WHERE e->>'kind'=z->>'kind' AND e->'resource'->>'version'=z->>'version'
       AND(e->'resource'->>'id'='supplier-report:COMPANY:'||split_part(z->>'reportId',':',2) OR e->'resource'->'privateSupplier'->>'snapshotId'=z->>'reportId')))
   OR row->>'group'='RELATED_ENTITIES' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(row->'sources') z WHERE z->>'kind'='KYS')
   OR row->>'group'='SUPPLIER_LOCATIONS' AND EXISTS(SELECT 1 FROM jsonb_array_elements(row->'sources') z WHERE z->>'kind'<>'MGBI') THEN
   RAISE EXCEPTION 'Source projection mismatch' USING ERRCODE='42501';END IF;
  SELECT min((x->>'retentionUntil')::timestamptz),max((x->>'retrievedAt')::timestamptz)
   INTO retention,retrieved FROM jsonb_array_elements(row->'sources') x;
  v_source_version:=encode(sha256(convert_to((row->'sources')::text,'UTF8')),'hex');
  SELECT * INTO old FROM srm.supplier_locations WHERE organization_id=p_org AND supplier_id=p_supplier AND origin='SOURCE' AND entity_key=row->>'entityKey' FOR UPDATE;
  IF old.location_id IS NOT NULL AND(old.location_id<>(row->>'id')::uuid OR old.source_retrieved_at>retrieved) THEN
   RAISE EXCEPTION 'Stale or contradictory source projection' USING ERRCODE='40001';END IF;
  -- A second member's base relationship sync must not erase enrichment
  -- already accepted for the same immutable KYS version.
  IF old.location_id IS NOT NULL AND row->>'group'='RELATED_ENTITIES'
   AND EXISTS(SELECT 1 FROM jsonb_array_elements(old.body->'sources') x WHERE x->>'kind'='MGBI')
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(row->'sources') x WHERE x->>'kind'='MGBI')
   AND(SELECT x->>'version' FROM jsonb_array_elements(old.body->'sources') x WHERE x->>'kind'='KYS')=
      (SELECT x->>'version' FROM jsonb_array_elements(row->'sources') x WHERE x->>'kind'='KYS') THEN CONTINUE;END IF;
  v_body:=(row-ARRAY['id','group','kind','entityKey','lifecycle','addressVersion'])||jsonb_build_object('geocodingStatus','UNREQUESTED','coordinates',NULL);
  IF old.location_id IS NOT NULL AND old.address_version=row->>'addressVersion' THEN v_body:=v_body||jsonb_build_object('geocodingStatus',old.body->'geocodingStatus');END IF;
  IF old.location_id IS NOT NULL AND old.address_version=row->>'addressVersion' AND old.body->'coordinates'<>'null'::jsonb
   AND(old.body->'coordinates'->>'expiresAt' IS NULL OR(old.body->'coordinates'->>'expiresAt')::timestamptz>clock_timestamp()) THEN
   v_body:=v_body||jsonb_build_object('coordinates',old.body->'coordinates','geocodingStatus',old.body->'geocodingStatus');
   IF retention IS NOT NULL AND(v_body->'coordinates'->>'expiresAt')::timestamptz>retention THEN v_body:=jsonb_set(v_body,'{coordinates,expiresAt}',to_jsonb(retention));END IF;
  END IF;
  IF old.location_id IS NULL THEN
   INSERT INTO srm.supplier_locations(organization_id,supplier_id,location_id,location_group,kind,origin,entity_key,address_version,body,source_version,source_retrieved_at,retention_until,lifecycle,created_by_user_id,updated_by_user_id,audit_request_id)
    VALUES(p_org,p_supplier,(row->>'id')::uuid,row->>'group',row->>'kind','SOURCE',row->>'entityKey',row->>'addressVersion',v_body,v_source_version,retrieved,retention,row->>'lifecycle',uid,uid,p_request);
  ELSIF old.body IS DISTINCT FROM v_body OR old.lifecycle IS DISTINCT FROM row->>'lifecycle' THEN
   UPDATE srm.supplier_locations SET body=v_body,address_version=row->>'addressVersion',version=version+1,source_version=v_source_version,
    source_retrieved_at=retrieved,retention_until=retention,lifecycle=row->>'lifecycle',updated_by_user_id=uid,updated_at=clock_timestamp(),audit_request_id=p_request
    WHERE organization_id=p_org AND supplier_id=p_supplier AND location_id=old.location_id;
  END IF;
 END LOOP;
 UPDATE srm.supplier_location_collections SET version=version+1 WHERE organization_id=p_org AND supplier_id=p_supplier;
END $fn$;

-- Physical expiry, bounded to the admitted collection. Never remove manual
-- addresses or change retention because a single reading user lost a grant.
CREATE FUNCTION srm.location_expire(p_org uuid,p_supplier uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF srm.location_authority(p_org,p_supplier,'supplier.location.read','supplier-locations:'||p_supplier::text,true) IS NOT TRUE THEN
  RAISE EXCEPTION 'Location retention unavailable' USING ERRCODE='42501';END IF;
 UPDATE srm.supplier_locations SET body=jsonb_set(jsonb_set(body,'{coordinates}','null'::jsonb),'{geocodingStatus}','"EXPIRED"'::jsonb)
  WHERE organization_id=p_org AND supplier_id=p_supplier AND body->'coordinates'<>'null'::jsonb
   AND body->'coordinates'->>'expiresAt' IS NOT NULL AND(body->'coordinates'->>'expiresAt')::timestamptz<=clock_timestamp();
 DELETE FROM srm.supplier_locations WHERE organization_id=p_org AND supplier_id=p_supplier AND origin='SOURCE' AND retention_until<=clock_timestamp();
END $fn$;

-- Small current selection for HUMAN request admission, never a caller address.
CREATE FUNCTION srm.location_geocode_metadata(p_org uuid,p_supplier uuid,p_location uuid,p_operation text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE l srm.supplier_locations%ROWTYPE;b jsonb;n text;r text;BEGIN
 IF p_operation NOT IN('supplier.location.read','supplier.location.geocode') THEN RETURN NULL;END IF;
 r:=CASE p_operation WHEN 'supplier.location.read' THEN 'supplier-locations:'||p_supplier::text ELSE 'supplier-location-geocode:'||p_location::text END;
 IF srm.location_authority(p_org,p_supplier,p_operation,r,p_operation='supplier.location.read') IS NOT TRUE THEN RETURN NULL;END IF;
 SELECT * INTO l FROM srm.supplier_locations WHERE organization_id=p_org AND supplier_id=p_supplier AND location_id=p_location FOR UPDATE;
 IF NOT FOUND OR l.lifecycle<>'ACTIVE' OR l.retention_until<=clock_timestamp() OR srm.location_sources_current(p_org,l.body->'sources') IS NOT TRUE THEN RETURN NULL;END IF;
 b:=l.body;
 IF jsonb_typeof(b->'address')<>'object' OR EXISTS(SELECT 1 FROM unnest(ARRAY['line1','postalCode','locality','country']) k WHERE coalesce(b->'address'->>k,'')='') THEN RETURN NULL;END IF;
 SELECT nip INTO n FROM srm.suppliers WHERE organization_id=p_org AND id=p_supplier;
 RETURN jsonb_build_object('organisationId',p_org,'supplierId',p_supplier,'locationId',p_location,'supplierNip',n,'origin',l.origin,'group',l.location_group,
  'address',concat_ws(', ',b->'address'->>'line1',concat_ws(' ',b->'address'->>'postalCode',b->'address'->>'locality'),b->'address'->>'country'),
  'addressVersion',l.address_version,'expectedVersion',l.version::text,'retentionUntil',l.retention_until,'sources',b->'sources',
  'alreadyResolved',b->'coordinates'<>'null'::jsonb AND(b->'coordinates'->>'expiresAt' IS NULL OR(b->'coordinates'->>'expiresAt')::timestamptz>clock_timestamp()),
  'uncertain',b->>'geocodingStatus'='DELIVERY_UNCERTAIN','geocodingStatus',b->>'geocodingStatus');
END $fn$;

-- Canonical SERVICE Work is the only authority. The current original HUMAN
-- account, organisation, source rights and registered executor remain in E1.
CREATE FUNCTION srm.location_work_context(p_request uuid,p_unit text,p_mode text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;BEGIN
 IF(p_unit,p_mode) NOT IN(('MAPS_GEOCODE_READ','READ'),('MAPS_GEOCODE_SAVE','WRITE')) THEN RETURN NULL;END IF;
 d:=profitia_request_work.descriptor(p_request,p_unit);
 IF d IS NULL OR d->>'parentApplicationId'<>'srm' OR d->>'operation'<>'supplier.location.geocode' OR d->>'accessMode'<>p_mode
  OR d->>'locationSchemaDigest'<>'34ec633dbf38dfffd6b3954ae79b0ef6f771d75ad8f0443882be71ca78b084e5'
  OR profitia_request_work.scope_allows(p_request,p_unit,(d->>'organisationId')::uuid,(d->>'subjectUserId')::uuid,p_mode) IS NOT TRUE
  OR NOT EXISTS(SELECT 1 FROM srm.supplier_location_installation WHERE singleton AND schema_version='1.0.0')
  OR has_table_privilege(session_user,'srm.supplier_locations','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  OR has_any_column_privilege(session_user,'srm.supplier_locations','SELECT,INSERT,UPDATE,REFERENCES')
  OR has_schema_privilege(session_user,'srm','CREATE') THEN RETURN NULL;END IF;
 RETURN d;
END $fn$;

-- Source metadata only, for an exact currently delegated geocode target.
CREATE FUNCTION srm.location_work_catalog_row(p_nip text,p_version text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE m jsonb;d jsonb;r jsonb;BEGIN
 m:=nullif(current_setting('profitia.native_work.scope',true),'')::jsonb;
 IF jsonb_typeof(m) IS DISTINCT FROM 'array' THEN RETURN false;END IF;
 IF jsonb_array_length(m)<>6 THEN RETURN false;END IF;
 d:=srm.location_work_context((m->>0)::uuid,m->>1,CASE m->>1 WHEN 'MAPS_GEOCODE_READ' THEN 'READ' WHEN 'MAPS_GEOCODE_SAVE' THEN 'WRITE' ELSE '' END);
 IF d IS NULL THEN RETURN false;END IF;
 SELECT location_scope INTO r FROM profitia_requests.intents WHERE request_id=(m->>0)::uuid AND application_id='srm' AND operation='supplier.location.geocode'
  AND organisation_id=(d->>'organisationId')::uuid AND user_id=(d->>'subjectUserId')::uuid AND status='ACCEPTED';
 RETURN EXISTS(SELECT 1 FROM jsonb_array_elements(r->'sources') x WHERE x->>'kind'='MGBI' AND x->'resource'->>'id'='supplier-report:COMPANY:'||p_nip AND x->'resource'->>'version'=p_version);
EXCEPTION WHEN invalid_text_representation THEN RETURN false;
END $fn$;
CREATE POLICY location_work_metadata ON srm.catalog_companies FOR SELECT TO profitia_access_owner
 USING(srm.location_work_catalog_row(nip,general_sha256));
DO $metadata$ DECLARE previous text;BEGIN
 SELECT qual INTO previous FROM pg_policies WHERE schemaname='srm' AND tablename='catalog_companies' AND policyname='private_shared_fence';
 IF previous IS NULL THEN RAISE EXCEPTION 'Existing corporate fence required' USING ERRCODE='42501';END IF;
 EXECUTE format('ALTER POLICY private_shared_fence ON srm.catalog_companies USING((%s) OR CASE WHEN current_user=''profitia_access_owner'' THEN srm.location_work_catalog_row(nip,general_sha256) ELSE false END)',previous);
END $metadata$;

CREATE FUNCTION srm.location_work_sources_current(p_org uuid,p_sources jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE x jsonb;latest uuid;until timestamptz;BEGIN
 FOR x IN SELECT * FROM jsonb_array_elements(p_sources) LOOP
  IF x->>'kind'='MGBI' THEN
   IF NOT EXISTS(SELECT 1 FROM srm.catalog_companies WHERE nip=split_part(x->>'reportId',':',2) AND general_sha256=x->>'version') THEN RETURN false;END IF;
  ELSIF x->>'kind'='KYS' THEN
   SELECT v.id,v.retention_until INTO latest,until FROM srm.source_snapshots v JOIN srm.provider_attempts a ON a.organization_id=v.organization_id AND a.id=v.attempt_id
    JOIN srm.lookup_requests q ON q.organization_id=a.organization_id AND q.id=a.request_id AND q.supplier_id=v.supplier_id
    JOIN srm.section_projections p ON p.organization_id=v.organization_id AND p.snapshot_id=v.id AND p.private_envelope IS NOT NULL
    WHERE v.organization_id=p_org AND v.section='kys' AND q.entity_type='COMPANY'
     AND v.supplier_id=(SELECT supplier_id FROM srm.source_snapshots WHERE organization_id=p_org AND id=(x->>'reportId')::uuid)
    ORDER BY q.requested_at DESC,a.started_at DESC,p.projection_version DESC LIMIT 1;
   IF latest IS DISTINCT FROM(x->>'version')::uuid OR until<=clock_timestamp() OR until<(x->>'retentionUntil')::timestamptz THEN RETURN false;END IF;
  ELSE RETURN false;END IF;
 END LOOP;
 RETURN true;
END $fn$;

CREATE FUNCTION srm.location_geocode_target(p_request uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;r profitia_requests.intents%ROWTYPE;l srm.supplier_locations%ROWTYPE;address text;command text;BEGIN
 d:=srm.location_work_context(p_request,'MAPS_GEOCODE_READ','READ');IF d IS NULL THEN RETURN NULL;END IF;
 SELECT * INTO r FROM profitia_requests.intents WHERE request_id=p_request AND application_id='srm' AND status='ACCEPTED'
  AND operation='supplier.location.geocode' AND organisation_id=(d->>'organisationId')::uuid AND user_id=(d->>'subjectUserId')::uuid AND payload_digest=d->>'payloadDigest';
 IF NOT FOUND OR r.location_scope->>'executorApplicationId' IS DISTINCT FROM d->>'applicationId' THEN RETURN NULL;END IF;
 SELECT * INTO l FROM srm.supplier_locations WHERE organization_id=r.organisation_id AND supplier_id=(r.location_scope->>'supplierId')::uuid AND location_id=(r.location_scope->>'locationId')::uuid FOR UPDATE;
 IF NOT FOUND OR l.lifecycle<>'ACTIVE' OR l.address_version IS DISTINCT FROM r.location_scope->>'addressVersion'
  OR l.retention_until<=clock_timestamp() OR srm.location_work_sources_current(l.organization_id,l.body->'sources') IS NOT TRUE THEN RETURN NULL;END IF;
 address:=concat_ws(', ',l.body->'address'->>'line1',concat_ws(' ',l.body->'address'->>'postalCode',l.body->'address'->>'locality'),l.body->'address'->>'country');
 command:='{"address":'||to_json(address)::text||',"executorApplicationId":'||to_json(d->>'applicationId')::text||'}';
 IF encode(sha256(convert_to(command,'UTF8')),'hex') IS DISTINCT FROM r.location_scope->>'commandDigest' THEN RETURN NULL;END IF;
 IF l.version::text IS DISTINCT FROM r.location_scope->>'targetVersion' AND NOT(l.body->'coordinates'<>'null'::jsonb
  AND(l.body->'coordinates'->>'expiresAt' IS NULL OR(l.body->'coordinates'->>'expiresAt')::timestamptz>clock_timestamp())) THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('organisationId',l.organization_id,'supplierId',l.supplier_id,'locationId',l.location_id,'address',address,'addressVersion',l.address_version,
  'expectedVersion',l.version::text,'retentionUntil',l.retention_until,'businessSchemaDigest',(SELECT schema_digest FROM srm.supplier_location_installation WHERE singleton),
  'alreadyResolved',l.body->'coordinates'<>'null'::jsonb AND(l.body->'coordinates'->>'expiresAt' IS NULL OR(l.body->'coordinates'->>'expiresAt')::timestamptz>clock_timestamp()),
  'uncertain',l.body->>'geocodingStatus'='DELIVERY_UNCERTAIN','geocodingStatus',l.body->>'geocodingStatus');
END $fn$;

CREATE FUNCTION srm.location_geocode_store(p_request uuid,p_location uuid,p_address text,p_version bigint,p_result jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;r profitia_requests.intents%ROWTYPE;l srm.supplier_locations%ROWTYPE;c jsonb;BEGIN
 d:=srm.location_work_context(p_request,'MAPS_GEOCODE_SAVE','WRITE');
 IF d IS NULL OR profitia_requests.location_shape(p_result,ARRAY['status','coordinates']) IS NOT TRUE
  OR p_result->>'status' NOT IN('RESOLVED','UNRESOLVED','AMBIGUOUS','LOW_PRECISION','QUOTA_EXCEEDED','UNAVAILABLE','DELIVERY_UNCERTAIN') THEN RAISE EXCEPTION 'Geocode result unavailable' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM profitia_requests.intents WHERE request_id=p_request AND application_id='srm' AND status='ACCEPTED'
  AND operation='supplier.location.geocode' AND organisation_id=(d->>'organisationId')::uuid AND user_id=(d->>'subjectUserId')::uuid AND payload_digest=d->>'payloadDigest';
 IF NOT FOUND OR r.location_scope->>'locationId' IS DISTINCT FROM p_location::text OR r.location_scope->>'addressVersion' IS DISTINCT FROM p_address
  OR r.location_scope->>'targetVersion' IS DISTINCT FROM p_version::text THEN RAISE EXCEPTION 'Geocode target changed' USING ERRCODE='40001';END IF;
 SELECT * INTO l FROM srm.supplier_locations WHERE organization_id=r.organisation_id AND supplier_id=(r.location_scope->>'supplierId')::uuid AND location_id=p_location FOR UPDATE;
 IF NOT FOUND OR l.lifecycle<>'ACTIVE' OR l.address_version IS DISTINCT FROM p_address
  OR l.retention_until<=clock_timestamp() OR srm.location_work_sources_current(l.organization_id,l.body->'sources') IS NOT TRUE THEN RAISE EXCEPTION 'Geocode target changed' USING ERRCODE='40001';END IF;
 IF l.version IS DISTINCT FROM p_version THEN
  IF l.body->'coordinates'<>'null'::jsonb AND(l.body->'coordinates'->>'expiresAt' IS NULL OR(l.body->'coordinates'->>'expiresAt')::timestamptz>clock_timestamp()) THEN RETURN;END IF;
  RAISE EXCEPTION 'Geocode target changed' USING ERRCODE='40001';END IF;
 c:=p_result->'coordinates';
 IF p_result->>'status'='RESOLVED' THEN
  IF profitia_requests.location_shape(c,ARRAY['position','origin','fetchedAt','expiresAt']||CASE WHEN c?'placeId' THEN ARRAY['placeId'] ELSE ARRAY[]::text[] END) IS NOT TRUE
   OR profitia_requests.location_shape(c->'position',ARRAY['lat','lng']) IS NOT TRUE OR c='null'::jsonb OR c->>'origin'<>'GOOGLE_GEOCODING' OR jsonb_typeof(c->'position'->'lat')<>'number' OR jsonb_typeof(c->'position'->'lng')<>'number'
   OR abs((c->'position'->>'lat')::numeric)>90 OR abs((c->'position'->>'lng')::numeric)>180
   OR(c->>'fetchedAt')::timestamptz>clock_timestamp() OR(c->>'expiresAt')::timestamptz<=clock_timestamp()
   OR(c->>'expiresAt')::timestamptz>(c->>'fetchedAt')::timestamptz+interval '29 days'
   OR l.retention_until IS NOT NULL AND(c->>'expiresAt')::timestamptz>l.retention_until THEN RAISE EXCEPTION 'Invalid coordinate cache' USING ERRCODE='22023';END IF;
 ELSIF c<>'null'::jsonb THEN RAISE EXCEPTION 'Failed geocode cannot carry coordinates' USING ERRCODE='22023';END IF;
 UPDATE srm.supplier_locations SET body=jsonb_set(jsonb_set(body,'{coordinates}',c),'{geocodingStatus}',p_result->'status'),version=version+1,
  updated_at=clock_timestamp(),updated_by_user_id=r.user_id,audit_request_id=p_request WHERE organization_id=l.organization_id AND supplier_id=l.supplier_id AND location_id=l.location_id;
END $fn$;

-- Operator-only maintenance for an existing approved scheduler/runbook.
-- Runtime logins receive no ACL. Enable shared Google cache only after a
-- verified interval <=24h; 29-day entries then remain within the 30-day cap.
CREATE FUNCTION srm.location_expire_controlled() RETURNS jsonb
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE coordinates_count bigint;source_count bigint;BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls)) THEN
  RAISE EXCEPTION 'Controlled retention operator required' USING ERRCODE='42501';END IF;
 UPDATE srm.supplier_locations SET body=jsonb_set(jsonb_set(body,'{coordinates}','null'::jsonb),'{geocodingStatus}','"EXPIRED"'::jsonb)
  WHERE body->'coordinates'<>'null'::jsonb AND body->'coordinates'->>'expiresAt' IS NOT NULL AND(body->'coordinates'->>'expiresAt')::timestamptz<=clock_timestamp();
 GET DIAGNOSTICS coordinates_count=ROW_COUNT;
 DELETE FROM srm.supplier_locations WHERE origin='SOURCE' AND retention_until<=clock_timestamp();GET DIAGNOSTICS source_count=ROW_COUNT;
 RETURN jsonb_build_object('expiredCoordinates',coordinates_count,'expiredDerivedLocations',source_count);
END $fn$;

REVOKE ALL ON FUNCTION srm.location_installation_descriptor(),srm.location_authority(uuid,uuid,text,text,boolean),srm.location_metadata(uuid,uuid,text,uuid),
 srm.location_request(uuid,uuid,text,text,uuid,text),srm.location_sources_current(uuid,jsonb),srm.location_sources_admitted(uuid,uuid,jsonb),srm.location_visible_body(uuid,text,jsonb),srm.location_page(uuid,uuid,text,integer,integer),
 srm.location_manual_write(uuid,uuid,uuid,text,bigint,uuid,text,text,text),srm.location_sync_target(uuid,uuid,text),
 srm.location_sync_write(uuid,uuid,bigint,uuid,text,text,jsonb),srm.location_expire(uuid,uuid),
 srm.location_geocode_metadata(uuid,uuid,uuid,text),srm.location_work_context(uuid,text,text),srm.location_work_catalog_row(text,text),srm.location_work_sources_current(uuid,jsonb),
 srm.location_geocode_target(uuid),srm.location_geocode_store(uuid,uuid,text,bigint,jsonb),srm.location_expire_controlled() FROM PUBLIC;
