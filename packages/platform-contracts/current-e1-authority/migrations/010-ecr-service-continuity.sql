-- Optional, owner-activated ECR continuity. Existing finite leases and all
-- non-ECR consumers keep their contracts and revocation rules unchanged.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR to_regprocedure('profitia_e1_authority.source_consumer(text,text)') IS NULL
 THEN RAISE EXCEPTION 'Current Identity owner and first-party authority required'; END IF;
END $guard$;
CREATE TABLE profitia_e1_authority.ecr_continuity_policy(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 application_id text NOT NULL CHECK(application_id='profitia-economic-calendar-runtime-development'),
 component_id text NOT NULL CHECK(component_id='economic-calendar-runtime-development'),
 login_role name NOT NULL CHECK(login_role='economic_calendar_development_ingest'),
 organisation_id uuid NOT NULL CHECK(organisation_id='225e465b-8b89-467d-92d1-7fef61b555fe'),
 grant_ids uuid[] NOT NULL CHECK(cardinality(grant_ids)=3),
 resources text[] NOT NULL CHECK(resources=ARRAY['api.eia.publication-calendar','api.commodities-sh.publication-calendar','api.eia.series-observations']),
 status text NOT NULL CHECK(status IN('ACTIVE','REVOKED')),version bigint NOT NULL CHECK(version>0),
 owner_basis text NOT NULL CHECK(length(owner_basis) BETWEEN 1 AND 256),
 lease_until timestamptz NOT NULL CHECK(isfinite(lease_until)),updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE profitia_e1_authority.ecr_continuity_history(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 operator_role name NOT NULL,policy_version bigint NOT NULL,owner_basis text NOT NULL,lease_until timestamptz NOT NULL,grant_ids uuid[] NOT NULL
);
DO $policies$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['ecr_continuity_policy','ecr_continuity_history'] LOOP
 EXECUTE format('ALTER TABLE profitia_e1_authority.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE profitia_e1_authority.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY controlled_owner ON profitia_e1_authority.%I TO profitia_access_owner USING(true) WITH CHECK(true)',t);
 EXECUTE format('CREATE TRIGGER authority_fence BEFORE INSERT OR UPDATE OR DELETE ON profitia_e1_authority.%I FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision()',t);
 END LOOP;
END $policies$;
CREATE FUNCTION profitia_e1_authority.renew_ecr_service_access() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE p profitia_e1_authority.ecr_continuity_policy%ROWTYPE; deadline timestamptz; parent_expiry timestamptz;
BEGIN
 IF session_user<>'economic_calendar_development_ingest' THEN RAISE EXCEPTION 'Own enrolled ECR SERVICE login required' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM profitia_e1_authority.ecr_continuity_policy WHERE singleton AND status='ACTIVE' FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT min(expires_at) INTO parent_expiry FROM profitia_access.product_grants WHERE application_id='spendguru' AND organisation_id=p.organisation_id
 AND product='SPENDGURU' AND 'market'=ANY(features) AND status='ACTIVE' AND expires_at>clock_timestamp();
 IF parent_expiry IS NULL OR NOT EXISTS(SELECT 1 FROM profitia_access.organisations WHERE organisation_id=p.organisation_id AND status='ACTIVE')
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=session_user AND rolcanlogin AND NOT(rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolinherit OR rolreplication))
 OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=session_user))
 OR NOT EXISTS(SELECT 1 FROM profitia_access.applications WHERE application_id=p.application_id AND status='ACTIVE')
 OR NOT EXISTS(SELECT 1 FROM profitia_access.runtime_bindings WHERE login_role=session_user AND application_id=p.application_id AND status='ACTIVE')
 OR NOT EXISTS(SELECT 1 FROM profitia_services.runtime_bindings WHERE login_role=session_user AND status='ACTIVE' AND expires_at>clock_timestamp())
 OR NOT EXISTS(SELECT 1 FROM profitia_e1_authority.source_components WHERE component_id=p.component_id AND login_role=session_user AND application_id=p.application_id
  AND receiver_application_id='profitia-source-hub-development' AND status='ACTIVE' AND expires_at>clock_timestamp())
 OR (SELECT count(*) FROM profitia_services.read_grants WHERE grant_id=ANY(p.grant_ids) AND login_role=session_user AND organisation_id=p.organisation_id
  AND operation='knowledge.read' AND feature='market' AND effect='ALLOW' AND status='ACTIVE' AND resource_id=ANY(p.resources) AND expires_at>clock_timestamp())<>3
 OR EXISTS(SELECT 1 FROM profitia_services.read_grants WHERE login_role=session_user AND organisation_id=p.organisation_id AND status='ACTIVE'
  AND effect='DENY' AND operation='knowledge.read' AND expires_at>clock_timestamp() AND (resource_id IS NULL OR resource_id=ANY(p.resources)))
 THEN RETURN NULL; END IF;
 deadline:=least(clock_timestamp()+interval '30 days',parent_expiry);
 IF p.lease_until>=deadline-interval '1 day' THEN RETURN jsonb_build_object('status','CURRENT','leaseUntil',p.lease_until,'licenceRenewed',false); END IF;
 -- No expired/revoked row is revived. The owner may revoke the policy, key,
 -- component, binding, organisation, parent product or any individual grant.
 UPDATE profitia_services.runtime_bindings SET expires_at=greatest(expires_at,deadline) WHERE login_role=session_user;
 UPDATE profitia_e1_authority.source_components SET expires_at=greatest(expires_at,deadline) WHERE component_id=p.component_id AND login_role=session_user;
 UPDATE profitia_services.read_grants SET expires_at=greatest(expires_at,deadline) WHERE grant_id=ANY(p.grant_ids);
 UPDATE profitia_e1_authority.ecr_continuity_policy SET lease_until=deadline,updated_at=clock_timestamp() WHERE singleton;
 INSERT INTO profitia_e1_authority.ecr_continuity_history(operator_role,policy_version,owner_basis,lease_until,grant_ids) VALUES(session_user,p.version,p.owner_basis,deadline,p.grant_ids);
 RETURN jsonb_build_object('status','RENEWED','leaseUntil',deadline,'licenceRenewed',false);
END $fn$;
REVOKE ALL ON FUNCTION profitia_e1_authority.renew_ecr_service_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION profitia_e1_authority.renew_ecr_service_access() TO economic_calendar_development_ingest;

-- The shared receiver also had the diagnostic Dec4 deadline. Its rows are NOT
-- extended for other consumers. Only ECR's current, owner-admitted finite lease
-- can supply a later technical deadline within the SAME first-party E1 path.
CREATE FUNCTION profitia_e1_authority.ecr_receiver_deadline(component text,receiver text,original timestamptz) RETURNS timestamptz
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT CASE WHEN component='economic-calendar-runtime-development' AND receiver='profitia-source-hub-development'
 THEN greatest(original,coalesce((SELECT lease_until FROM profitia_e1_authority.ecr_continuity_policy WHERE singleton AND status='ACTIVE' AND lease_until>clock_timestamp()),original)) ELSE original END
$fn$;
REVOKE ALL ON FUNCTION profitia_e1_authority.ecr_receiver_deadline(text,text,timestamptz) FROM PUBLIC;
DO $patch$ DECLARE body text; old text; replacement text; BEGIN
 -- Fail closed on a different predecessor; every replacement must occur once.
 body:=pg_get_functiondef('profitia_e1_authority.source_consumer(text,text)'::regprocedure);
 old:='old.expires_at>clock_timestamp()';replacement:='profitia_e1_authority.ecr_receiver_deadline(k.component_id,old.application_id,old.expires_at)>clock_timestamp()';
 IF (length(body)-length(replace(body,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'source_consumer receiver predecessor changed'; END IF;body:=replace(body,old,replacement);
 old:='s.expires_at>clock_timestamp()';replacement:='profitia_e1_authority.ecr_receiver_deadline(k.component_id,s.application_id,s.expires_at)>clock_timestamp()';
 IF (length(body)-length(replace(body,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'source_consumer source predecessor changed'; END IF;body:=replace(body,old,replacement);
 old:='least(k.expires_at,r.expires_at)';replacement:='least(k.expires_at,profitia_e1_authority.ecr_receiver_deadline(k.component_id,r.application_id,r.expires_at))';
 IF position(old IN body)=0 THEN RAISE EXCEPTION 'source_consumer output predecessor changed'; END IF;EXECUTE replace(body,old,replacement);
 body:=pg_get_functiondef('profitia_e1_authority.issue_source(jsonb,text,jsonb,jsonb,jsonb,jsonb)'::regprocedure);
 old:='least(k.expires_at,sr.expires_at,r.expires_at,pg.expires_at,';
 replacement:='least(k.expires_at,CASE WHEN kind=''SERVICE'' THEN profitia_e1_authority.ecr_receiver_deadline(k.component_id,sr.application_id,sr.expires_at) ELSE sr.expires_at END,CASE WHEN kind=''SERVICE'' THEN profitia_e1_authority.ecr_receiver_deadline(k.component_id,r.application_id,r.expires_at) ELSE r.expires_at END,pg.expires_at,';
 IF (length(body)-length(replace(body,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'issue_source predecessor changed'; END IF;EXECUTE replace(body,old,replacement);
 body:=pg_get_functiondef('profitia_e1_authority.source_ready()'::regprocedure);
 old:='s.expires_at>clock_timestamp() AND r.status=';
 replacement:='(s.expires_at>clock_timestamp() OR profitia_e1_authority.ecr_receiver_deadline(''economic-calendar-runtime-development'',s.application_id,s.expires_at)>clock_timestamp()) AND r.status=';
 IF (length(body)-length(replace(body,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'source_ready predecessor changed'; END IF;body:=replace(body,old,replacement);
 old:='r.expires_at>clock_timestamp()';replacement:='(r.expires_at>clock_timestamp() OR profitia_e1_authority.ecr_receiver_deadline(''economic-calendar-runtime-development'',r.application_id,r.expires_at)>clock_timestamp())';
 IF (length(body)-length(replace(body,old,'')))/length(old)<>1 THEN RAISE EXCEPTION 'source_ready receiver predecessor changed'; END IF;EXECUTE replace(body,old,replacement);
END $patch$;
