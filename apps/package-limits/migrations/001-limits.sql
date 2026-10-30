-- Executed transactionally as the distinct controlled migrator, SET ROLE profitia_limits_owner.
DO $guard$ BEGIN
 IF current_user<>'profitia_limits_owner' OR current_database()<>'neondb' THEN RAISE EXCEPTION 'INSTALLATION_BINDING_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='profitia_limits') THEN RAISE EXCEPTION 'EXISTING_SCHEMA_REQUIRES_EXACT_RECEIPT'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pgcrypto' AND n.nspname='public') THEN RAISE EXCEPTION 'CRYPTO_INSTALLATION_REQUIRED'; END IF;
END $guard$;
CREATE SCHEMA profitia_limits AUTHORIZATION profitia_limits_owner;
SET LOCAL search_path=profitia_limits,pg_catalog;
CREATE TABLE installation(singleton boolean PRIMARY KEY CHECK(singleton),schema_digest text NOT NULL,environment text NOT NULL CHECK(environment='development'),project_id text NOT NULL,branch_id text NOT NULL,database_name name NOT NULL,command_key bytea NOT NULL,installed_at timestamptz NOT NULL DEFAULT clock_timestamp());
INSERT INTO installation VALUES(true,'__LIMITS_SCHEMA_DIGEST__','development','lingering-thunder-05075810','br-green-hall-b9s837k0',current_database(),public.gen_random_bytes(32),clock_timestamp());
CREATE TABLE operator_grants(user_id uuid PRIMARY KEY,enabled boolean NOT NULL,version bigint NOT NULL DEFAULT 1,source_ref text NOT NULL,recorded_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE operator_grant_events(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,user_id uuid NOT NULL,version bigint NOT NULL,enabled boolean NOT NULL,source_ref text NOT NULL,actor_login name NOT NULL DEFAULT session_user,recorded_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE products(id text PRIMARY KEY,name text NOT NULL);
INSERT INTO products VALUES('SPENDGURU','SpendGuru'),('SRM_STANDALONE','SRM Standalone');
CREATE TABLE capabilities(id text PRIMARY KEY,name text NOT NULL,description text NOT NULL,products text[] NOT NULL CHECK(cardinality(products) BETWEEN 1 AND 2));
CREATE TABLE metrics(id text PRIMARY KEY,name text NOT NULL,unit text NOT NULL,description text NOT NULL,source text NOT NULL,capability_id text NOT NULL REFERENCES capabilities);
CREATE TABLE packages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),product_id text NOT NULL REFERENCES products,name text NOT NULL CHECK(length(name) BETWEEN 1 AND 256),archived boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE package_versions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),package_id uuid NOT NULL REFERENCES packages,number integer NOT NULL CHECK(number>0),revision integer NOT NULL DEFAULT 1,state text NOT NULL CHECK(state IN('DRAFT','PUBLISHED')),snapshot jsonb NOT NULL,published_at timestamptz,UNIQUE(package_id,number),CHECK((state='PUBLISHED')=(published_at IS NOT NULL)));
CREATE UNIQUE INDEX one_draft ON package_versions(package_id) WHERE state='DRAFT';
CREATE TABLE assignments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organisation_id uuid NOT NULL,product_id text NOT NULL REFERENCES products,revision integer NOT NULL,active_from timestamptz NOT NULL,active_until timestamptz NOT NULL CHECK(active_until>=active_from),payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE INDEX assignment_scope ON assignments(organisation_id,product_id,active_from,active_until);
CREATE TABLE assignment_revisions(assignment_id uuid NOT NULL REFERENCES assignments,revision integer NOT NULL,effective_from date NOT NULL,effective_at timestamptz NOT NULL,actor_id uuid NOT NULL,payload jsonb NOT NULL,recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(assignment_id,revision));
CREATE TABLE audit(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,actor_id uuid NOT NULL,operation text NOT NULL,entity_id text NOT NULL,before_state jsonb,after_state jsonb,reason text,recorded_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE receipts(actor_id uuid NOT NULL,request_id uuid NOT NULL,request_hash bytea NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(actor_id,request_id));
DO $policies$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['installation','operator_grants','operator_grant_events','products','capabilities','metrics','packages','package_versions','assignments','assignment_revisions','audit','receipts'] LOOP
 EXECUTE format('ALTER TABLE profitia_limits.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE profitia_limits.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY controlled_owner ON profitia_limits.%I TO profitia_limits_owner USING(true) WITH CHECK(true)',t);
 END LOOP;
END $policies$;
CREATE FUNCTION immutable_history() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $fn$
BEGIN RAISE EXCEPTION 'IMMUTABLE_HISTORY' USING ERRCODE='42501'; END $fn$;
CREATE FUNCTION audit_operator_grant() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,profitia_limits AS $fn$
BEGIN IF TG_OP='UPDATE' AND (NEW.user_id<>OLD.user_id OR NEW.version<>OLD.version+1) THEN RAISE EXCEPTION 'VERSIONED_OPERATOR_CHANGE_REQUIRED' USING ERRCODE='23514';END IF;
 INSERT INTO operator_grant_events(user_id,version,enabled,source_ref)VALUES(NEW.user_id,NEW.version,NEW.enabled,NEW.source_ref);RETURN NEW;END $fn$;
CREATE TRIGGER operator_grant_audit AFTER INSERT OR UPDATE ON operator_grants FOR EACH ROW EXECUTE FUNCTION audit_operator_grant();
CREATE TRIGGER immutable_operator_events BEFORE UPDATE OR DELETE OR TRUNCATE ON operator_grant_events FOR EACH STATEMENT EXECUTE FUNCTION immutable_history();
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE OR TRUNCATE ON audit FOR EACH STATEMENT EXECUTE FUNCTION immutable_history();
CREATE TRIGGER immutable_revisions BEFORE UPDATE OR DELETE OR TRUNCATE ON assignment_revisions FOR EACH STATEMENT EXECUTE FUNCTION immutable_history();
CREATE TRIGGER immutable_receipts BEFORE UPDATE OR DELETE OR TRUNCATE ON receipts FOR EACH STATEMENT EXECUTE FUNCTION immutable_history();
CREATE FUNCTION protect_version() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $fn$
BEGIN IF TG_OP='DELETE' OR OLD.state='PUBLISHED' THEN RAISE EXCEPTION 'PUBLISHED_VERSION_IMMUTABLE' USING ERRCODE='42501'; END IF;RETURN NEW;END $fn$;
CREATE TRIGGER immutable_published BEFORE UPDATE OR DELETE ON package_versions FOR EACH ROW EXECUTE FUNCTION protect_version();
CREATE TRIGGER no_version_truncate BEFORE TRUNCATE ON package_versions FOR EACH STATEMENT EXECUTE FUNCTION immutable_history();
CREATE FUNCTION ordinary_runtime() RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,profitia_limits AS $fn$
BEGIN
 IF session_user<>'profitia_limits_runtime' OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=session_user AND (NOT rolcanlogin OR rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolinherit))
 OR pg_has_role(session_user,'profitia_limits_owner','MEMBER')
 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='neon_superuser' AND pg_has_role(session_user,oid,'MEMBER')) THEN RAISE EXCEPTION 'ORDINARY_RUNTIME_REQUIRED' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM installation WHERE singleton AND database_name=current_database() AND environment='development' AND branch_id='br-green-hall-b9s837k0' AND project_id='lingering-thunder-05075810' AND schema_digest='__LIMITS_SCHEMA_DIGEST__') THEN RAISE EXCEPTION 'INSTALLATION_UNAVAILABLE'; END IF;
END $fn$;
CREATE FUNCTION health() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_limits AS $fn$
BEGIN PERFORM ordinary_runtime();RETURN jsonb_build_object('environment','development','database',current_database(),'role',session_user,'schemaDigest','__LIMITS_SCHEMA_DIGEST__','commandKeyFingerprint',(SELECT encode(public.digest(command_key,'sha256'),'hex') FROM installation WHERE singleton),'branchId','br-green-hall-b9s837k0');END $fn$;
CREATE FUNCTION validate_snapshot(s jsonb,product text) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,profitia_limits AS $fn$
DECLARE l jsonb;cap text;
BEGIN
 IF jsonb_typeof(s)<>'object' OR length(btrim(s->>'name')) NOT BETWEEN 1 AND 256 OR jsonb_typeof(s->'capabilities')<>'array' OR jsonb_typeof(s->'limits')<>'array' OR jsonb_array_length(s->'limits')>64 THEN RAISE EXCEPTION 'INVALID_SNAPSHOT' USING ERRCODE='23514'; END IF;
 FOR cap IN SELECT jsonb_array_elements_text(s->'capabilities') LOOP
 IF NOT EXISTS(SELECT 1 FROM capabilities WHERE id=cap AND product=ANY(products)) THEN RAISE EXCEPTION 'CAPABILITY_PRODUCT_MISMATCH' USING ERRCODE='23514';END IF; END LOOP;
 IF (SELECT count(*) FROM jsonb_array_elements_text(s->'capabilities'))<>(SELECT count(DISTINCT value) FROM jsonb_array_elements_text(s->'capabilities')) OR
 (SELECT count(*) FROM jsonb_array_elements(s->'limits'))<>(SELECT count(DISTINCT value->>'metricId') FROM jsonb_array_elements(s->'limits')) THEN RAISE EXCEPTION 'DUPLICATE_LIMIT' USING ERRCODE='23514'; END IF;
 FOR l IN SELECT jsonb_array_elements(s->'limits') LOOP
 IF NOT EXISTS(SELECT 1 FROM metrics m WHERE m.id=l->>'metricId' AND s->'capabilities' ? m.capability_id) OR l->>'mode' NOT IN('LIMITED','UNMETERED','DISABLED') OR l->>'period' NOT IN('DAY','WEEK','MONTH','YEAR','CONTRACT') OR l->>'anchor' NOT IN('CALENDAR','ASSIGNMENT') OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=l->>'timezone') THEN RAISE EXCEPTION 'INVALID_LIMIT' USING ERRCODE='23514';END IF;
 IF l->>'mode'='LIMITED' AND (coalesce(l->>'value','')!~'^(0|[1-9][0-9]{0,14})(\.[0-9]{1,6})?$') OR l->>'mode'<>'LIMITED' AND l->>'value' IS NOT NULL THEN RAISE EXCEPTION 'INVALID_LIMIT_VALUE' USING ERRCODE='23514';END IF;
 END LOOP;
END $fn$;
CREATE FUNCTION cycle_window(anchor_date date,unit text,calendar_anchor boolean,tz text,at_time timestamptz) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog AS $fn$
DECLARE d date;start_local timestamp;end_local timestamp;n integer;step interval;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=tz) OR unit NOT IN('DAY','WEEK','MONTH','YEAR') OR anchor_date IS NULL OR at_time IS NULL THEN RAISE EXCEPTION 'INVALID_PERIOD' USING ERRCODE='23514';END IF;
 d:=(at_time AT TIME ZONE tz)::date;
 IF d<anchor_date THEN RAISE EXCEPTION 'BEFORE_USAGE_START' USING ERRCODE='23514';END IF;
 IF calendar_anchor THEN start_local:=date_trunc(lower(unit),at_time AT TIME ZONE tz);step:=CASE unit WHEN 'DAY' THEN interval '1day' WHEN 'WEEK' THEN interval '1week' WHEN 'MONTH' THEN interval '1month' ELSE interval '1year' END;end_local:=start_local+step;
 ELSE
 step:=CASE unit WHEN 'DAY' THEN interval '1day' WHEN 'WEEK' THEN interval '1week' WHEN 'MONTH' THEN interval '1month' ELSE interval '1year' END;
 n:=CASE unit WHEN 'DAY' THEN d-anchor_date WHEN 'WEEK' THEN (d-anchor_date)/7 WHEN 'MONTH' THEN (extract(year FROM d)-extract(year FROM anchor_date))::integer*12+(extract(month FROM d)-extract(month FROM anchor_date))::integer ELSE (extract(year FROM d)-extract(year FROM anchor_date))::integer END;
 start_local:=anchor_date+n*step;IF start_local::date>d THEN n:=n-1;start_local:=anchor_date+n*step;END IF;end_local:=anchor_date+(n+1)*step;
 END IF;
 RETURN jsonb_build_object('start',greatest(start_local,anchor_date::timestamp) AT TIME ZONE tz,'end',end_local AT TIME ZONE tz,'timezone',tz,'bounds','[start,end)');
END $fn$;
CREATE FUNCTION validate_terms(t jsonb) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $fn$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=t->>'timezone') OR t->>'basis' NOT IN('MANUAL_CONTRACT','DEVELOPMENT_TEST') OR length(btrim(t->>'reference')) NOT BETWEEN 1 AND 256 OR t->>'purchaseType' NOT IN('ONE_OFF','MANUAL_SUBSCRIPTION') OR t->>'usageCycle' NOT IN('MONTH','YEAR') OR t->>'usageAnchor' NOT IN('CALENDAR','ASSIGNMENT') THEN RAISE EXCEPTION 'INVALID_TERMS' USING ERRCODE='23514';END IF;
 IF (t->>'contractStart')::date>=(t->>'contractEnd')::date OR (t->>'assignmentStart')::date>=(t->>'assignmentEnd')::date OR (t->>'billingStart')::date>=(t->>'billingEnd')::date OR (t->>'assignmentStart')::date<(t->>'contractStart')::date OR (t->>'assignmentEnd')::date>(t->>'contractEnd')::date OR (t->>'usageStart')::date<(t->>'assignmentStart')::date OR (t->>'usageStart')::date>=(t->>'assignmentEnd')::date OR (t->>'dueDate')::date<(t->>'invoiceDate')::date THEN RAISE EXCEPTION 'INVALID_INTERVAL' USING ERRCODE='23514';END IF;
END $fn$;
CREATE FUNCTION status_of(p jsonb) RETURNS text LANGUAGE plpgsql SET search_path=pg_catalog AS $fn$
DECLARE today date:=(clock_timestamp() AT TIME ZONE (p->'terms'->>'timezone'))::date;
BEGIN IF p->>'status'='CANCELLED' THEN RETURN 'CANCELLED';ELSIF p->>'status'='SUSPENDED' THEN RETURN 'SUSPENDED';ELSIF today<(p->'terms'->>'assignmentStart')::date THEN RETURN 'PLANNED';ELSIF today>=(p->'terms'->>'assignmentEnd')::date THEN RETURN 'ENDED';ELSE RETURN 'ACTIVE';END IF;END $fn$;
CREATE FUNCTION api(p_actor uuid,p_until bigint,p_tx text,p_operation text,p_json text,p_proof text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_limits AS $fn$
DECLARE d jsonb;p jsonb;before jsonb;result jsonb;k bytea;expected text;v_request_id uuid;v_request_hash bytea;r receipts%ROWTYPE;pv package_versions%ROWTYPE;pkg packages%ROWTYPE;a assignments%ROWTYPE;entity text;num integer;offset_n integer;q text;org uuid;product text;effective date;tz text;end_date date;start_date date;start_instant timestamptz;end_instant timestamptz;effective_instant timestamptz;reason text;actor_version bigint;metric_defs jsonb;cap_defs jsonb;
BEGIN
 PERFORM ordinary_runtime();
 IF p_actor IS NULL OR p_tx<>pg_current_xact_id()::text OR p_until<=floor(extract(epoch FROM clock_timestamp())*1000) OR p_until>floor(extract(epoch FROM clock_timestamp())*1000)+10000 OR octet_length(p_json)>65536 OR length(p_operation)>64 THEN RAISE EXCEPTION 'AUTHORITY_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT command_key INTO k FROM installation WHERE singleton;
 expected:=encode(public.hmac(convert_to('limits-v1'||chr(31)||session_user||chr(31)||p_actor||chr(31)||p_until||chr(31)||p_tx||chr(31)||p_operation||chr(31)||p_json,'UTF8'),k,'sha256'),'hex');
 IF p_proof IS NULL OR p_proof<>expected THEN RAISE EXCEPTION 'AUTHORITY_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT version INTO actor_version FROM operator_grants WHERE user_id=p_actor AND enabled FOR SHARE;
 IF actor_version IS NULL THEN RAISE EXCEPTION 'OPERATOR_REQUIRED' USING ERRCODE='42501';END IF;
 d:=p_json::jsonb;
 IF p_operation='authorize' THEN RETURN jsonb_build_object('userId',p_actor,'operatorVersion',actor_version);END IF;
 IF p_operation='assignment.reference' THEN SELECT jsonb_build_object('organisationId',organisation_id) INTO result FROM assignments WHERE id=(d->>'assignmentId')::uuid;IF result IS NULL THEN RAISE EXCEPTION 'ASSIGNMENT_REQUIRED' USING ERRCODE='23514';END IF;RETURN result;END IF;
 IF p_operation='list' THEN
 offset_n:=coalesce((d->>'offset')::integer,0);q:=left(coalesce(d->>'q',''),256);IF offset_n<0 OR offset_n>100000 THEN RAISE EXCEPTION 'INVALID_PAGE';END IF;
 RETURN jsonb_build_object(
 'products',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM products ORDER BY id)x),
 'capabilities',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM capabilities ORDER BY name LIMIT 100)x),
 'metrics',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM metrics ORDER BY name LIMIT 200)x),
 'packages',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT pack_row.*,(SELECT coalesce(jsonb_agg(to_jsonb(v) ORDER BY v.number DESC),'[]') FROM package_versions v WHERE v.package_id=pack_row.id) AS versions FROM packages pack_row WHERE position(lower(q) IN lower(pack_row.name))>0 ORDER BY pack_row.created_at DESC LIMIT 25 OFFSET offset_n)x),
 'assignments',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT ass_row.*,cur.payload AS effective_payload,status_of(cur.payload) AS effective_status,(SELECT jsonb_agg(to_jsonb(v) ORDER BY v.revision DESC) FROM assignment_revisions v WHERE v.assignment_id=ass_row.id) AS history FROM assignments ass_row CROSS JOIN LATERAL (SELECT coalesce((SELECT v.payload FROM assignment_revisions v WHERE v.assignment_id=ass_row.id AND v.effective_at<=clock_timestamp() ORDER BY v.revision DESC LIMIT 1),(SELECT v.payload FROM assignment_revisions v WHERE v.assignment_id=ass_row.id ORDER BY v.revision LIMIT 1)) AS payload OFFSET 0) cur ORDER BY ass_row.created_at DESC LIMIT 25 OFFSET offset_n)x),
 'audit',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM (SELECT * FROM audit ORDER BY id DESC LIMIT 50 OFFSET offset_n)x),
 'offset',offset_n,'pageSize',25,'metering','NOT_CONNECTED','e1Projection','PENDING_NOT_CONNECTED','operator',jsonb_build_object('userId',p_actor,'version',actor_version));
 END IF;
 v_request_id:=(d->>'requestId')::uuid;v_request_hash:=public.digest(convert_to(p_operation||chr(31)||p_json,'UTF8'),'sha256');p:=d->'data';reason:=p->>'reason';
 IF v_request_id IS NULL OR jsonb_typeof(p)<>'object' THEN RAISE EXCEPTION 'INVALID_INPUT';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_actor||':request:'||v_request_id,0));
 SELECT * INTO r FROM receipts WHERE actor_id=p_actor AND receipts.request_id=v_request_id;
 IF FOUND THEN IF r.request_hash<>v_request_hash THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE='23505';END IF;IF r.created_at<clock_timestamp()-interval '24hours' THEN RAISE EXCEPTION 'IDEMPOTENCY_EXPIRED' USING ERRCODE='23514';END IF;RETURN r.result;END IF;
 CASE p_operation
 WHEN 'capability.create' THEN
 IF p->>'id'!~'^[A-Z][A-Z0-9_]{1,63}$' OR jsonb_array_length(p->'products') NOT BETWEEN 1 AND 2 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p->'products') WHERE value NOT IN('SPENDGURU','SRM_STANDALONE')) THEN RAISE EXCEPTION 'INVALID_CAPABILITY' USING ERRCODE='23514';END IF;
 INSERT INTO capabilities VALUES(p->>'id',p->>'name',p->>'description',ARRAY(SELECT jsonb_array_elements_text(p->'products'))) RETURNING to_jsonb(capabilities.*) INTO result;entity:=p->>'id';
 WHEN 'metric.create' THEN
 INSERT INTO metrics VALUES(p->>'id',p->>'name',p->>'unit',p->>'description',p->>'source',p->>'capabilityId') RETURNING to_jsonb(metrics.*) INTO result;entity:=p->>'id';
 WHEN 'package.create' THEN
 INSERT INTO packages(product_id,name) VALUES(p->>'productId',p->>'name') RETURNING * INTO pkg;
 INSERT INTO package_versions(package_id,number,state,snapshot) VALUES(pkg.id,1,'DRAFT',jsonb_build_object('name',pkg.name,'capabilities','[]'::jsonb,'limits','[]'::jsonb,'price',NULL,'currency',NULL)) RETURNING to_jsonb(package_versions.*) INTO result;entity:=pkg.id::text;
 WHEN 'draft.save','version.publish' THEN
 SELECT * INTO pv FROM package_versions WHERE id=(p->>'versionId')::uuid FOR UPDATE;
 IF NOT FOUND OR pv.state<>'DRAFT' OR pv.revision<>(p->>'revision')::integer THEN RAISE EXCEPTION 'STALE_DRAFT' USING ERRCODE='40001';END IF;
 SELECT * INTO pkg FROM packages WHERE id=pv.package_id FOR SHARE;IF pkg.archived THEN RAISE EXCEPTION 'PACKAGE_ARCHIVED' USING ERRCODE='23514';END IF;before:=to_jsonb(pv);entity:=pv.id::text;
 IF p_operation='draft.save' THEN
 PERFORM validate_snapshot(p->'snapshot',pkg.product_id);
 UPDATE package_versions SET snapshot=p->'snapshot',revision=revision+1 WHERE id=pv.id RETURNING to_jsonb(package_versions.*) INTO result;
 ELSE
 PERFORM validate_snapshot(pv.snapshot,pkg.product_id);IF jsonb_array_length(pv.snapshot->'capabilities')=0 THEN RAISE EXCEPTION 'CAPABILITY_REQUIRED' USING ERRCODE='23514';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(m)),'[]') INTO metric_defs FROM metrics m WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(pv.snapshot->'limits') l WHERE l->>'metricId'=m.id);
 SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]') INTO cap_defs FROM capabilities c WHERE pv.snapshot->'capabilities' ? c.id;
 UPDATE package_versions SET state='PUBLISHED',published_at=clock_timestamp(),revision=revision+1,snapshot=snapshot||jsonb_build_object('metricDefinitions',metric_defs,'capabilityDefinitions',cap_defs) WHERE id=pv.id RETURNING to_jsonb(package_versions.*) INTO result;
 END IF;
 IF p_operation='version.publish' THEN UPDATE packages SET name=pv.snapshot->>'name' WHERE id=pkg.id;END IF;
 WHEN 'version.create' THEN
 SELECT * INTO pkg FROM packages WHERE id=(p->>'packageId')::uuid FOR UPDATE;
 SELECT * INTO pv FROM package_versions WHERE id=(p->>'fromVersionId')::uuid AND package_id=pkg.id AND state='PUBLISHED';
 IF pkg.id IS NULL OR pkg.archived OR pv.id IS NULL THEN RAISE EXCEPTION 'PUBLISHED_PACKAGE_REQUIRED' USING ERRCODE='23514';END IF;
 SELECT max(number)+1 INTO num FROM package_versions WHERE package_id=pkg.id;
 INSERT INTO package_versions(package_id,number,state,snapshot) VALUES(pkg.id,num,'DRAFT',pv.snapshot-'metricDefinitions'-'capabilityDefinitions') RETURNING to_jsonb(package_versions.*) INTO result;entity:=pkg.id::text;
 WHEN 'package.archive','package.restore' THEN
 SELECT to_jsonb(x) INTO before FROM packages x WHERE id=(p->>'packageId')::uuid FOR UPDATE;
 UPDATE packages SET archived=(p_operation='package.archive') WHERE id=(p->>'packageId')::uuid RETURNING to_jsonb(packages.*) INTO result;
 IF result IS NULL OR length(coalesce(reason,''))=0 THEN RAISE EXCEPTION 'PACKAGE_AND_REASON_REQUIRED' USING ERRCODE='23514';END IF;entity:=p->>'packageId';
 WHEN 'assignment.create','assignment.change','assignment.status' THEN
 IF p_operation='assignment.create' THEN org:=(p->>'organisationId')::uuid;SELECT v.* INTO pv FROM package_versions v JOIN packages k ON k.id=v.package_id WHERE v.id=(p->>'packageVersionId')::uuid AND v.state='PUBLISHED' AND NOT k.archived;SELECT product_id INTO product FROM packages WHERE id=pv.package_id;
 ELSE SELECT * INTO a FROM assignments WHERE id=(p->>'assignmentId')::uuid;IF a.id IS NULL THEN RAISE EXCEPTION 'ASSIGNMENT_REQUIRED' USING ERRCODE='23514';END IF;org:=a.organisation_id;product:=a.product_id;END IF;
 IF org IS NULL OR product IS NULL THEN RAISE EXCEPTION 'PUBLISHED_PACKAGE_REQUIRED' USING ERRCODE='23514';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(org||':product:'||product,0));
 IF a.id IS NOT NULL THEN
 SELECT * INTO a FROM assignments WHERE id=a.id FOR UPDATE;
 IF a.revision<>(p->>'revision')::integer THEN RAISE EXCEPTION 'STALE_ASSIGNMENT' USING ERRCODE='40001';END IF;before:=a.payload;
 END IF;
 IF p_operation='assignment.status' THEN p:=a.payload||p;ELSE
 SELECT v.* INTO pv FROM package_versions v JOIN packages k ON k.id=v.package_id WHERE v.id=(p->>'packageVersionId')::uuid AND v.state='PUBLISHED' AND k.product_id=product AND NOT k.archived;
 IF pv.id IS NULL OR org<>(p->>'organisationId')::uuid THEN RAISE EXCEPTION 'PRODUCT_OR_ORGANISATION_CHANGE_FORBIDDEN' USING ERRCODE='23514';END IF;
 PERFORM validate_terms(p->'terms');PERFORM validate_snapshot(jsonb_build_object('name',pv.snapshot->>'name','capabilities',pv.snapshot->'capabilities','limits',p->'overrides'),product);
 p:=p||jsonb_build_object('status','ENABLED','commercialState','OPERATOR_CONFIRMED','billingIntegration','NOT_CONNECTED','e1Projection','PENDING_NOT_CONNECTED','packageSnapshot',pv.snapshot,'productId',product,'organisationId',org);
 END IF;
 -- The canonical authority version is server-attested, not client input.
 IF coalesce((p->>'organisationVersion')::bigint,0)<1 THEN RAISE EXCEPTION 'CANONICAL_ORGANISATION_REQUIRED' USING ERRCODE='23514';END IF;
 tz:=p->'terms'->>'timezone';effective:=(p->>'effectiveFrom')::date;
 IF effective<(clock_timestamp() AT TIME ZONE tz)::date OR length(coalesce(reason,''))=0 THEN RAISE EXCEPTION 'CURRENT_EFFECTIVE_DATE_AND_REASON_REQUIRED' USING ERRCODE='23514';END IF;
 IF a.id IS NOT NULL AND ((a.payload->'terms'->>'assignmentEnd')::date<=(clock_timestamp() AT TIME ZONE tz)::date OR (a.payload->'terms'->>'assignmentStart')::date<=(clock_timestamp() AT TIME ZONE tz)::date AND ((a.payload->'terms'->>'assignmentStart') IS DISTINCT FROM (p->'terms'->>'assignmentStart') OR (a.payload->'terms'->>'contractStart') IS DISTINCT FROM (p->'terms'->>'contractStart'))) THEN RAISE EXCEPTION 'HISTORICAL_CONTRACT_IMMUTABLE' USING ERRCODE='23514';END IF;
 start_date:=(p->'terms'->>'assignmentStart')::date;end_date:=(p->'terms'->>'assignmentEnd')::date;
 IF end_date<=effective THEN RAISE EXCEPTION 'EFFECTIVE_DATE_OUTSIDE_ASSIGNMENT' USING ERRCODE='23514';END IF;
 effective_instant:=greatest(effective::timestamp AT TIME ZONE tz,clock_timestamp());start_instant:=start_date::timestamp AT TIME ZONE tz;end_instant:=end_date::timestamp AT TIME ZONE tz;IF p->>'status'='CANCELLED' THEN end_instant:=greatest(start_instant,least(end_instant,effective_instant));END IF;p:=(p-'revision'-'assignmentId')||jsonb_build_object('effectiveAt',effective_instant);
 IF EXISTS(SELECT 1 FROM assignments x WHERE x.organisation_id=org AND x.product_id=product AND (a.id IS NULL OR x.id<>a.id) AND tstzrange(x.active_from,x.active_until,'[)') && tstzrange(start_instant,end_instant,'[)')) THEN RAISE EXCEPTION 'ASSIGNMENT_OVERLAP' USING ERRCODE='23505';END IF;
 IF a.id IS NULL THEN INSERT INTO assignments(organisation_id,product_id,revision,active_from,active_until,payload) VALUES(org,product,1,start_instant,end_instant,p) RETURNING * INTO a;
 ELSE UPDATE assignments SET revision=revision+1,active_from=start_instant,active_until=end_instant,payload=p WHERE id=a.id RETURNING * INTO a;END IF;
 INSERT INTO assignment_revisions VALUES(a.id,a.revision,effective,effective_instant,p_actor,p,clock_timestamp());entity:=a.id::text;result:=to_jsonb(a);
 ELSE RAISE EXCEPTION 'UNKNOWN_OPERATION' USING ERRCODE='42501';
 END CASE;
 INSERT INTO audit(actor_id,operation,entity_id,before_state,after_state,reason) VALUES(p_actor,p_operation,entity,before,result,reason);
 INSERT INTO receipts VALUES(p_actor,v_request_id,v_request_hash,result,clock_timestamp());
 IF p_until<=floor(extract(epoch FROM clock_timestamp())*1000) THEN RAISE EXCEPTION 'AUTHORITY_EXPIRED' USING ERRCODE='42501';END IF;
 RETURN result;
END $fn$;
REVOKE ALL ON ALL TABLES IN SCHEMA profitia_limits FROM PUBLIC,profitia_limits_runtime;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA profitia_limits FROM PUBLIC,profitia_limits_runtime;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_limits FROM PUBLIC,profitia_limits_runtime;
GRANT USAGE ON SCHEMA profitia_limits TO profitia_limits_runtime;
GRANT EXECUTE ON FUNCTION profitia_limits.health(),profitia_limits.api(uuid,bigint,text,text,text,text) TO profitia_limits_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA profitia_limits REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
