-- Optional main Development receiver. Google positions remain in the existing
-- supplier_locations row. These two tables hold installation/audit metadata only.
-- No activation, login creation, password, scheduler, or paid call occurs here.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
  AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication))
  OR NOT EXISTS(SELECT 1 FROM srm.supplier_location_installation WHERE singleton
   AND schema_digest='b3f05a4c56f32bd32c0c59dcc8b60c486d4d4813823665301ce08318f793704b')
  OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='srm.supplier_locations'::regclass
   AND relowner='profitia_access_owner'::regrole AND relrowsecurity AND relforcerowsecurity) THEN
  RAISE EXCEPTION 'Controlled owner and exact existing location boundary required' USING ERRCODE='42501';END IF;
END $guard$;

CREATE TABLE srm.location_cache_installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),source_ref text NOT NULL CHECK(source_ref~'^[a-f0-9]{40}$')
);
CREATE TABLE srm.location_cache_maintenance_runs(
 run_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 completed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 actor_role text NOT NULL CHECK(actor_role='srm_location_cache_development_maintenance'),
 expired_coordinates integer NOT NULL CHECK(expired_coordinates>=0),locations jsonb NOT NULL CHECK(jsonb_typeof(locations)='array'),
 CHECK(jsonb_array_length(locations)=expired_coordinates)
);
DO $tables$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['location_cache_installation','location_cache_maintenance_runs'] LOOP
  EXECUTE format('ALTER TABLE srm.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE srm.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY controlled_owner ON srm.%I TO profitia_access_owner USING(true) WITH CHECK(true)',t);
  EXECUTE format('CREATE POLICY owner_fence ON srm.%I AS RESTRICTIVE TO PUBLIC USING(current_user=''profitia_access_owner'') WITH CHECK(current_user=''profitia_access_owner'')',t);
  EXECUTE format('REVOKE ALL ON TABLE srm.%I FROM PUBLIC',t);
  EXECUTE format('CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON srm.%I FOR EACH ROW EXECUTE FUNCTION profitia_supplier_jobs.immutable()',t);
  EXECUTE format('CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON srm.%I FOR EACH STATEMENT EXECUTE FUNCTION profitia_supplier_jobs.immutable()',t);
 END LOOP;
END $tables$;

-- A dedicated ordinary operator can only remove expired Google fields. It has
-- no table access, owner membership, caller timestamps, address or Google key.
-- The audit contains identifiers and our expiry metadata, never Google lat/lng.
CREATE FUNCTION srm.location_cache_maintain() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE touched jsonb;n integer;BEGIN
 IF session_user<>'srm_location_cache_development_maintenance'
  OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=session_user
   AND rolcanlogin AND NOT(rolsuper OR rolbypassrls OR rolinherit OR rolcreatedb OR rolcreaterole OR rolreplication))
  OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=session_user::regrole)
  OR has_table_privilege(session_user,'srm.supplier_locations','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  OR has_any_column_privilege(session_user,'srm.supplier_locations','SELECT,INSERT,UPDATE,REFERENCES')
  OR has_schema_privilege(session_user,'srm','CREATE')
  OR NOT EXISTS(SELECT 1 FROM srm.location_cache_installation WHERE singleton AND schema_version='1.0.0') THEN
  RAISE EXCEPTION 'Exact limited cache retention operator required' USING ERRCODE='42501';END IF;
 IF NOT pg_try_advisory_xact_lock(20261031,3301) THEN
  RAISE EXCEPTION 'Cache maintenance already running' USING ERRCODE='55P03';END IF;
 WITH expired AS (
  UPDATE srm.supplier_locations
   SET body=jsonb_set(jsonb_set(body,'{coordinates}','null'::jsonb),'{geocodingStatus}','"EXPIRED"'::jsonb)
   WHERE body->'coordinates'->>'origin'='GOOGLE_GEOCODING'
    AND(body->'coordinates'->>'expiresAt' IS NULL OR body->'coordinates'->>'fetchedAt' IS NULL
     OR(body->'coordinates'->>'expiresAt')::timestamptz<=clock_timestamp()
     OR(body->'coordinates'->>'fetchedAt')::timestamptz<=clock_timestamp()-interval '29 days')
   RETURNING organization_id,supplier_id,location_id,address_version
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object('organisationId',organization_id,'supplierId',supplier_id,
  'locationId',location_id,'addressVersion',address_version)),'[]'::jsonb),count(*)::integer INTO touched,n FROM expired;
 INSERT INTO srm.location_cache_maintenance_runs(actor_role,expired_coordinates,locations) VALUES(session_user,n,touched);
 RETURN jsonb_build_object('expiredCoordinates',n,'completed',true);
END $fn$;

-- Licence/maintenance state is data, never an ALLOW observation. The normal
-- current HUMAN and Service Work checks still admit every read and store.
CREATE FUNCTION srm.location_cache_descriptor() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT jsonb_build_object('schemaVersion',i.schema_version,'schemaDigest',i.schema_digest,
  'lastMaintenanceAt',m.completed_at,'maintenanceCurrent',m.completed_at>clock_timestamp()-interval '24 hours',
  'maximumCacheDays',29)
 FROM srm.location_cache_installation i
 LEFT JOIN LATERAL(SELECT completed_at FROM srm.location_cache_maintenance_runs ORDER BY run_id DESC LIMIT 1)m ON true
 WHERE i.singleton
$fn$;

-- The existing initiating HUMAN host supplies its current collection INTENT.
-- Source visibility, exact address/version and expiry are checked again here.
CREATE FUNCTION srm.location_cache_read(p_org uuid,p_supplier uuid,p_location uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE l srm.supplier_locations%ROWTYPE;b jsonb;BEGIN
 IF srm.location_authority(p_org,p_supplier,'supplier.location.read','supplier-locations:'||p_supplier::text,true) IS NOT TRUE THEN
  RAISE EXCEPTION 'Current location read required' USING ERRCODE='42501';END IF;
 SELECT * INTO l FROM srm.supplier_locations WHERE organization_id=p_org AND supplier_id=p_supplier AND location_id=p_location FOR SHARE;
 IF NOT FOUND OR l.lifecycle<>'ACTIVE' OR l.retention_until<=clock_timestamp() THEN RETURN NULL;END IF;
 b:=srm.location_visible_body(p_org,l.location_group,l.body);
 IF b IS NULL OR b->>'geocodingStatus' IS DISTINCT FROM 'RESOLVED'
  OR b->'coordinates'->>'origin' IS DISTINCT FROM 'GOOGLE_GEOCODING'
  OR b->'coordinates'->>'expiresAt' IS NULL OR b->'coordinates'->>'fetchedAt' IS NULL
  OR(b->'coordinates'->>'expiresAt')::timestamptz<=clock_timestamp()
  OR(b->'coordinates'->>'fetchedAt')::timestamptz>clock_timestamp()
  OR(b->'coordinates'->>'expiresAt')::timestamptz>(b->'coordinates'->>'fetchedAt')::timestamptz+interval '29 days'
  OR jsonb_typeof(b->'coordinates'->'position'->'lat') IS DISTINCT FROM 'number'
  OR jsonb_typeof(b->'coordinates'->'position'->'lng') IS DISTINCT FROM 'number'
  OR abs((b->'coordinates'->'position'->>'lat')::numeric)>90
  OR abs((b->'coordinates'->'position'->>'lng')::numeric)>180 THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('locationId',l.location_id,'addressVersion',l.address_version,'version',l.version::text,'coordinates',b->'coordinates');
END $fn$;

-- Read the actual rows rather than retaining a user/session-specific sync flag.
-- Equality excludes Google cache fields; refreshing an unchanged accepted
-- address cannot discard a valid marker or manufacture another write cycle.
CREATE FUNCTION srm.location_sync_matches(p_org uuid,p_supplier uuid,p_rows jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE r jsonb;l srm.supplier_locations%ROWTYPE;BEGIN
 IF srm.location_authority(p_org,p_supplier,'supplier.location.read','supplier-locations:'||p_supplier::text,true) IS NOT TRUE
  OR jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows)>2000 OR octet_length(p_rows::text)>8388608 THEN RETURN false;END IF;
 FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
  IF srm.location_sources_current(p_org,r->'sources') IS NOT TRUE THEN RETURN false;END IF;
  SELECT * INTO l FROM srm.supplier_locations WHERE organization_id=p_org AND supplier_id=p_supplier
   AND origin='SOURCE' AND location_id=(r->>'id')::uuid;
  IF NOT FOUND OR(l.location_group,l.kind,l.entity_key,l.address_version,l.lifecycle)
   IS DISTINCT FROM(r->>'group',r->>'kind',r->>'entityKey',r->>'addressVersion',r->>'lifecycle')
   OR(l.body-ARRAY['coordinates','geocodingStatus']) IS DISTINCT FROM(r-ARRAY['id','group','kind','entityKey','lifecycle','addressVersion']) THEN RETURN false;END IF;
 END LOOP;
 RETURN true;
END $fn$;

-- Preserve the accepted manual writer, its original verified Creator, CAS,
-- request digest, organisation ownership and all of its current E1 checks.
DO $manual$ DECLARE definition text;anchor text;replacement text;BEGIN
 SELECT pg_get_functiondef('srm.location_manual_write(uuid,uuid,uuid,text,bigint,uuid,text,text,text)'::regprocedure) INTO definition;
 IF md5(definition)<>'23051710593dd17c1379daa09c1b53e5' THEN
  RAISE EXCEPTION 'Exact current manual writer required' USING ERRCODE='42501';END IF;
 anchor:='  b:=jsonb_build_object(''label'',c->''label''';
 replacement:=$body$  -- A copied Google position is not a new USER_INPUT assertion.
  IF p_action='UPDATE' AND existing.body->'coordinates'->>'origin'='GOOGLE_GEOCODING'
   AND c->'position'=existing.body->'coordinates'->'position' THEN c:=jsonb_set(c,'{position}','null'::jsonb);END IF;
  b:=jsonb_build_object('label',c->'label'$body$;
 IF position(anchor IN definition)=0 THEN RAISE EXCEPTION 'Exact manual body anchor required';END IF;
 definition:=replace(definition,anchor,replacement);
 anchor:='  IF p_action=''CREATE'' THEN INSERT INTO srm.supplier_locations';
 replacement:=$body$  IF p_action='UPDATE' AND existing.address_version=p_address_version AND c->'position'='null'::jsonb
   AND existing.body->'coordinates'->>'origin'='GOOGLE_GEOCODING'
   AND(existing.body->'coordinates'->>'expiresAt')::timestamptz>clock_timestamp() THEN
   b:=b||jsonb_build_object('coordinates',existing.body->'coordinates','geocodingStatus','RESOLVED');END IF;
  IF p_action='CREATE' THEN INSERT INTO srm.supplier_locations$body$;
 IF position(anchor IN definition)=0 THEN RAISE EXCEPTION 'Exact manual insert anchor required';END IF;
 EXECUTE replace(definition,anchor,replacement);
END $manual$;
REVOKE ALL ON FUNCTION srm.location_cache_maintain(),srm.location_cache_descriptor(),
 srm.location_cache_read(uuid,uuid,uuid),srm.location_sync_matches(uuid,uuid,jsonb) FROM PUBLIC;
-- Exact role grants are a separately approved release action, not this migration.

