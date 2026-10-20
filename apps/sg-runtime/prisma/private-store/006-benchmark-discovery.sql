-- Optional application persistence for existing AM35/AM36 and NativeWork.
-- No role, ACL, policy, budget, source effect writer or activation is seeded.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
  AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
  AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid))
  OR NOT EXISTS(SELECT 1 FROM profitia_access.applications WHERE application_id='spendguru' AND status='DISABLED')
  OR EXISTS(SELECT 1 FROM profitia_access.applications WHERE application_id='spendguru-benchmark-dispatch' AND status<>'DISABLED')
  OR NOT EXISTS(SELECT 1 FROM profitia_requests.operation_installation WHERE singleton AND schema_version='1.0.0'
   AND schema_digest='a0bd21a268e41f8a41befad777f7717fb3014fb851ff42cdb290004f93a98f94')
  OR NOT EXISTS(SELECT 1 FROM profitia_request_work.installation WHERE singleton AND schema_version='1.0.0'
   AND schema_digest='19fb1d9045bccdb3299317b4c5b7df41e361e971c83ab683a55b56d6fbc8e5fe') THEN
  RAISE EXCEPTION 'Controlled disabled SpendGuru and accepted native request installations required' USING ERRCODE='42501';END IF;
END $guard$;
CREATE SCHEMA profitia_benchmark_discovery AUTHORIZATION profitia_access_owner;
REVOKE ALL ON SCHEMA profitia_benchmark_discovery FROM PUBLIC;
CREATE TABLE profitia_benchmark_discovery.installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 boundary_digest text NOT NULL CHECK(boundary_digest~'^[a-f0-9]{64}$'),source_ref text NOT NULL CHECK(source_ref~'^[a-f0-9]{40}$'),
 retention_seconds integer NOT NULL CHECK(retention_seconds BETWEEN 60 AND 604800),
 expires_at timestamptz NOT NULL CHECK(isfinite(expires_at))
);
CREATE TABLE profitia_benchmark_discovery.commands(
 request_id uuid PRIMARY KEY,application_id text NOT NULL CHECK(application_id='spendguru'),
 environment text NOT NULL CHECK(environment IN('development','staging','production')),organisation_id uuid NOT NULL,user_id uuid NOT NULL,
 resource_id text NOT NULL,payload_digest text NOT NULL CHECK(payload_digest~'^[a-f0-9]{64}$'),decision_id uuid NOT NULL,
 command_text text NOT NULL CHECK(octet_length(command_text)<=16384),command_json jsonb GENERATED ALWAYS AS(command_text::jsonb) STORED,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(request_id,application_id,environment,organisation_id,user_id,payload_digest)
  REFERENCES profitia_requests.intents(request_id,application_id,environment,organisation_id,user_id,payload_digest),
 UNIQUE(request_id,application_id,environment,organisation_id,user_id),
 CHECK(payload_digest=encode(sha256(convert_to(command_text,'UTF8')),'hex')),
 CHECK(resource_id='benchmark-discovery-request:'||payload_digest),
 CHECK(jsonb_typeof(command_json)='object' AND command_json->>'kind' IN('SEARCH','METADATA','METADATA_VALUES','CONTEXT','AI_SEARCH'))
);
CREATE TABLE profitia_benchmark_discovery.results(
 request_id uuid PRIMARY KEY,application_id text NOT NULL CHECK(application_id='spendguru'),environment text NOT NULL,
 organisation_id uuid NOT NULL,user_id uuid NOT NULL,result_version uuid NOT NULL DEFAULT gen_random_uuid(),
 result_json jsonb NOT NULL CHECK(jsonb_typeof(result_json)='object' AND octet_length(result_json::text)<=4000000),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),retention_until timestamptz NOT NULL CHECK(isfinite(retention_until)),
 FOREIGN KEY(request_id,application_id,environment,organisation_id,user_id)
  REFERENCES profitia_benchmark_discovery.commands(request_id,application_id,environment,organisation_id,user_id)
);
DO $metadata$ DECLARE n text;BEGIN
 FOREACH n IN ARRAY ARRAY['installation','commands','results'] LOOP
  EXECUTE format('ALTER TABLE profitia_benchmark_discovery.%I ENABLE ROW LEVEL SECURITY',n);
  EXECUTE format('ALTER TABLE profitia_benchmark_discovery.%I FORCE ROW LEVEL SECURITY',n);
  EXECUTE format('CREATE POLICY controlled_owner ON profitia_benchmark_discovery.%I TO profitia_access_owner USING(true) WITH CHECK(true)',n);
 END LOOP;
END $metadata$;
CREATE POLICY installation_fence ON profitia_benchmark_discovery.installation AS RESTRICTIVE TO PUBLIC
 USING(current_user='profitia_access_owner') WITH CHECK(current_user='profitia_access_owner');
CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON profitia_benchmark_discovery.installation
 FOR EACH ROW EXECUTE FUNCTION profitia_supplier_jobs.immutable();
CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON profitia_benchmark_discovery.installation
 FOR EACH STATEMENT EXECUTE FUNCTION profitia_supplier_jobs.immutable();

CREATE FUNCTION profitia_benchmark_discovery.runtime_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE a jsonb;i profitia_benchmark_discovery.installation%ROWTYPE;BEGIN
 a:=profitia_access.runtime_descriptor();
 IF a IS NULL OR a->>'applicationId' NOT IN('spendguru','spendguru-benchmark-dispatch')
  OR a->>'revision' IS NULL OR has_schema_privilege(session_user,'profitia_benchmark_discovery','CREATE')
  OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_benchmark_discovery'
   AND c.relkind='r' AND c.relowner='profitia_access_owner'::regrole AND c.relrowsecurity AND c.relforcerowsecurity)<>3
  OR has_table_privilege(session_user,'profitia_benchmark_discovery.installation','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  OR has_any_column_privilege(session_user,'profitia_benchmark_discovery.installation','SELECT,INSERT,UPDATE,REFERENCES')
  OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_benchmark_discovery'
   AND c.relname IN('commands','results') AND(has_table_privilege(session_user,c.oid,'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR has_any_column_privilege(session_user,c.oid,'UPDATE,REFERENCES')))
  OR a->>'applicationId'='spendguru' AND(has_table_privilege(session_user,'profitia_benchmark_discovery.results','INSERT')
    OR has_any_column_privilege(session_user,'profitia_benchmark_discovery.results','INSERT'))
  OR a->>'applicationId'='spendguru-benchmark-dispatch' AND(has_table_privilege(session_user,'profitia_benchmark_discovery.commands','INSERT')
    OR has_any_column_privilege(session_user,'profitia_benchmark_discovery.commands','INSERT')) THEN RETURN NULL;END IF;
 SELECT * INTO i FROM profitia_benchmark_discovery.installation WHERE singleton AND expires_at>clock_timestamp();IF NOT FOUND THEN RETURN NULL;END IF;
 RETURN a||jsonb_build_object('discoverySchemaVersion',i.schema_version,'discoveryBoundaryDigest',i.boundary_digest,
  'discoverySourceRef',i.source_ref,'retentionSeconds',i.retention_seconds,'retentionPolicyExpiresAt',i.expires_at);
END $fn$;
CREATE FUNCTION profitia_benchmark_discovery.current_work(p_request uuid,p_unit text,p_org uuid DEFAULT NULL,p_user uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;a jsonb;c profitia_benchmark_discovery.commands%ROWTYPE;BEGIN
 a:=profitia_benchmark_discovery.runtime_descriptor();d:=profitia_request_work.descriptor(p_request,p_unit);
 IF a IS NULL OR d IS NULL OR a->>'applicationId' IS DISTINCT FROM 'spendguru-benchmark-dispatch'
  OR d->>'applicationId' IS DISTINCT FROM a->>'applicationId' OR d->>'environment' IS DISTINCT FROM a->>'environment'
  OR d->>'parentApplicationId' IS DISTINCT FROM 'spendguru' OR d->>'operation' IS DISTINCT FROM 'benchmark.discovery.request'
  OR d->>'operationSchemaDigest' IS DISTINCT FROM 'a0bd21a268e41f8a41befad777f7717fb3014fb851ff42cdb290004f93a98f94'
  OR (p_org IS NOT NULL AND d->>'organisationId' IS DISTINCT FROM p_org::text)
  OR (p_user IS NOT NULL AND d->>'subjectUserId' IS DISTINCT FROM p_user::text)
  OR NOT EXISTS(SELECT 1 FROM(VALUES('SG2_DISCOVERY_READ','READ'),('SG2_DISCOVERY_SAVE','WRITE'))v(unit,mode)
   WHERE v.unit=p_unit AND v.mode=d->>'accessMode')
  OR profitia_request_work.scope_allows(p_request,p_unit,(d->>'organisationId')::uuid,(d->>'subjectUserId')::uuid,d->>'accessMode') IS NOT TRUE THEN RETURN NULL;END IF;
 SELECT * INTO c FROM profitia_benchmark_discovery.commands WHERE request_id=p_request;
 IF NOT FOUND OR c.application_id IS DISTINCT FROM 'spendguru' OR c.environment IS DISTINCT FROM d->>'environment'
  OR c.organisation_id::text IS DISTINCT FROM d->>'organisationId' OR c.user_id::text IS DISTINCT FROM d->>'subjectUserId'
  OR c.resource_id IS DISTINCT FROM d->>'resourceId' OR c.payload_digest IS DISTINCT FROM d->>'payloadDigest' THEN RETURN NULL;END IF;
 RETURN d||jsonb_build_object('discoverySchemaVersion',a->>'discoverySchemaVersion','discoveryBoundaryDigest',a->>'discoveryBoundaryDigest',
  'retentionSeconds',a->'retentionSeconds','retentionPolicyExpiresAt',a->>'retentionPolicyExpiresAt');
EXCEPTION WHEN invalid_text_representation THEN RETURN NULL;END $fn$;

CREATE FUNCTION profitia_benchmark_discovery.command_insert_allowed(p_request uuid,p_app text,p_env text,p_org uuid,p_user uuid,p_resource text,p_payload text,p_decision uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;BEGIN
 d:=profitia_benchmark_discovery.runtime_descriptor();
 IF d IS NULL OR d->>'applicationId' IS DISTINCT FROM 'spendguru' OR p_app IS DISTINCT FROM 'spendguru'
  OR d->>'environment' IS DISTINCT FROM p_env OR profitia_requests.scope_allows('benchmark.discovery.request',p_org,p_user,p_resource) IS NOT TRUE THEN RETURN false;END IF;
 RETURN EXISTS(SELECT 1 FROM profitia_requests.intents i WHERE i.request_id=p_request AND i.application_id=p_app
  AND i.operation='benchmark.discovery.request' AND i.environment=p_env AND i.organisation_id=p_org AND i.user_id=p_user
  AND i.resource_id=p_resource AND i.payload_digest=p_payload AND i.decision_id=p_decision AND i.status='RESERVED');
END $fn$;
CREATE FUNCTION profitia_benchmark_discovery.human_row(p_request uuid,p_org uuid,p_user uuid,p_version uuid,p_until timestamptz) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;uid uuid;BEGIN
 d:=profitia_benchmark_discovery.runtime_descriptor();uid:=nullif(current_setting('profitia.user_id',true),'')::uuid;
 IF d IS NULL OR d->>'applicationId' IS DISTINCT FROM 'spendguru' OR uid IS NULL OR uid IS DISTINCT FROM p_user
  OR p_until<=clock_timestamp() OR profitia_modules.scope_allows('benchmark',p_org,p_user) IS NOT TRUE THEN RETURN false;END IF;
 RETURN EXISTS(SELECT 1 FROM profitia_access.security_events e WHERE e.application_id='spendguru' AND e.environment=d->>'environment' AND e.phase='INTENT'
  AND e.event->>'decision'='ALLOW' AND e.event->>'actorKind'='HUMAN' AND e.event->>'actorId'=p_user::text AND e.event->>'subjectUserId'=p_user::text
  AND e.event->>'organisationId'=p_org::text AND e.event->>'ownerOrganisationId'=p_org::text AND e.event->>'ownerUserId'=p_user::text
  AND e.event->>'dataClass'='USER_IN_ORGANISATION_PRIVATE' AND e.event->>'resourceVersion'=p_version::text
  AND e.event->>'resourceId'='benchmark-discovery:'||p_request::text AND e.event->>'policyVersion'='access-v1:'||(d->>'revision')
  AND e.event->'moduleEvidence'->>'moduleId'='benchmark' AND e.event->'moduleEvidence'->>'transactionId'=txid_current()::text
  AND(e.event->'moduleEvidence'->>'expiresAt')::timestamptz>clock_timestamp()
  AND e.event->>'operation'='benchmark.discovery.read' AND e.event->>'resourceType'='benchmark_discovery_result' AND e.event->>'effect'='READ');
EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow THEN RETURN false;END $fn$;
CREATE FUNCTION profitia_benchmark_discovery.result_metadata(p_request uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;org uuid;uid uuid;r profitia_benchmark_discovery.results%ROWTYPE;BEGIN
 d:=profitia_benchmark_discovery.runtime_descriptor();uid:=nullif(current_setting('profitia.user_id',true),'')::uuid;
 org:=nullif(current_setting('profitia.organisation_id',true),'')::uuid;
 IF d IS NULL OR d->>'applicationId' IS DISTINCT FROM 'spendguru' OR uid IS NULL OR org IS NULL
  OR profitia_modules.scope_allows('benchmark',org,uid) IS NOT TRUE THEN RETURN NULL;END IF;
 SELECT * INTO r FROM profitia_benchmark_discovery.results WHERE request_id=p_request AND application_id='spendguru'
  AND environment=d->>'environment' AND organisation_id=org AND user_id=uid AND retention_until>clock_timestamp();IF NOT FOUND THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('requestId',r.request_id,'ownerOrganisationId',r.organisation_id,'ownerUserId',r.user_id,
  'resultVersion',r.result_version,'retentionUntil',r.retention_until);
EXCEPTION WHEN invalid_text_representation THEN RETURN NULL;END $fn$;

CREATE POLICY command_read ON profitia_benchmark_discovery.commands FOR SELECT TO PUBLIC USING(
 profitia_requests.scope_allows('benchmark.discovery.request',organisation_id,user_id,resource_id)
 OR profitia_benchmark_discovery.current_work(request_id,'SG2_DISCOVERY_READ',organisation_id,user_id) IS NOT NULL
 OR profitia_benchmark_discovery.current_work(request_id,'SG2_DISCOVERY_SAVE',organisation_id,user_id) IS NOT NULL
 OR EXISTS(SELECT 1 FROM profitia_benchmark_discovery.results r WHERE r.request_id=commands.request_id
  AND profitia_benchmark_discovery.human_row(r.request_id,r.organisation_id,r.user_id,r.result_version,r.retention_until)));
-- Owner-only SECURITY DEFINER functions can inspect their own metadata. All
-- runtime SELECTs still pass one of the exact predicates above.
CREATE POLICY command_read_fence ON profitia_benchmark_discovery.commands AS RESTRICTIVE FOR SELECT TO PUBLIC USING(current_user='profitia_access_owner'
 OR profitia_requests.scope_allows('benchmark.discovery.request',organisation_id,user_id,resource_id)
 OR profitia_benchmark_discovery.current_work(request_id,'SG2_DISCOVERY_READ',organisation_id,user_id) IS NOT NULL
 OR profitia_benchmark_discovery.current_work(request_id,'SG2_DISCOVERY_SAVE',organisation_id,user_id) IS NOT NULL
 OR EXISTS(SELECT 1 FROM profitia_benchmark_discovery.results r WHERE r.request_id=commands.request_id
  AND profitia_benchmark_discovery.human_row(r.request_id,r.organisation_id,r.user_id,r.result_version,r.retention_until)));
CREATE POLICY command_insert ON profitia_benchmark_discovery.commands FOR INSERT TO PUBLIC WITH CHECK(
 profitia_requests.scope_allows('benchmark.discovery.request',organisation_id,user_id,resource_id));
CREATE POLICY command_insert_fence ON profitia_benchmark_discovery.commands AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK(
 profitia_benchmark_discovery.command_insert_allowed(request_id,application_id,environment,organisation_id,user_id,resource_id,payload_digest,decision_id));
CREATE POLICY result_read ON profitia_benchmark_discovery.results FOR SELECT TO PUBLIC USING(
 profitia_benchmark_discovery.human_row(request_id,organisation_id,user_id,result_version,retention_until)
 OR profitia_benchmark_discovery.current_work(request_id,'SG2_DISCOVERY_READ',organisation_id,user_id) IS NOT NULL);
CREATE POLICY result_read_fence ON profitia_benchmark_discovery.results AS RESTRICTIVE FOR SELECT TO PUBLIC USING(current_user='profitia_access_owner'
 OR profitia_benchmark_discovery.human_row(request_id,organisation_id,user_id,result_version,retention_until)
 OR profitia_benchmark_discovery.current_work(request_id,'SG2_DISCOVERY_READ',organisation_id,user_id) IS NOT NULL);
CREATE POLICY result_insert ON profitia_benchmark_discovery.results FOR INSERT TO PUBLIC WITH CHECK(
 profitia_benchmark_discovery.current_work(request_id,'SG2_DISCOVERY_SAVE',organisation_id,user_id) IS NOT NULL);
CREATE POLICY result_insert_fence ON profitia_benchmark_discovery.results AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK(
 profitia_benchmark_discovery.current_work(request_id,'SG2_DISCOVERY_SAVE',organisation_id,user_id) IS NOT NULL
 AND retention_until>clock_timestamp() AND retention_until<=clock_timestamp()+make_interval(secs=>
  (profitia_benchmark_discovery.current_work(request_id,'SG2_DISCOVERY_SAVE',organisation_id,user_id)->>'retentionSeconds')::integer));
DO $write_fences$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['commands','results'] LOOP
  EXECUTE format('CREATE POLICY update_fence ON profitia_benchmark_discovery.%I AS RESTRICTIVE FOR UPDATE TO PUBLIC USING(false) WITH CHECK(false)',t);
  EXECUTE format('CREATE POLICY delete_fence ON profitia_benchmark_discovery.%I AS RESTRICTIVE FOR DELETE TO PUBLIC USING(false)',t);
  EXECUTE format('CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON profitia_benchmark_discovery.%I FOR EACH ROW EXECUTE FUNCTION profitia_supplier_jobs.immutable()',t);
  EXECUTE format('CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON profitia_benchmark_discovery.%I FOR EACH STATEMENT EXECUTE FUNCTION profitia_supplier_jobs.immutable()',t);
 END LOOP;
END $write_fences$;
REVOKE ALL ON ALL TABLES IN SCHEMA profitia_benchmark_discovery FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_benchmark_discovery FROM PUBLIC;
