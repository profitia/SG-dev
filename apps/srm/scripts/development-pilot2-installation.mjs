import {randomUUID,createHash} from 'node:crypto'
import fs from 'node:fs'
const target=JSON.parse(fs.readFileSync(new URL('../deployment/development-pilot2-targets.json',import.meta.url)))
const registry=JSON.parse(fs.readFileSync(new URL('../deployment/pilot2-registry-targets.json',import.meta.url)))
const q=value=>"'"+String(value).replaceAll("'","''")+"'"

/** Reviewable plan only. A new ordinary Source login reuses the existing public
 * catalogue and shared GUS scheduler/funding. No existing policy/count changes.
 * Owner access must be approved separately; this module makes no connection. */
export function developmentPilot2RegistryPlan(sourceSha){
 if(!/^[a-f0-9]{40}$/.test(sourceSha??''))throw Error('Exact accepted main source required')
 const role=target.registrySourceRole,ref=target.taskId+':'+sourceSha
 const before=["SET LOCAL statement_timeout='15s'","SET LOCAL lock_timeout='3s'",
  "SELECT pg_advisory_xact_lock(hashtext('srm-main-development-krs-receiver'))",
  `DO $guard$ BEGIN IF current_user<>session_user OR current_user<>'neondb_owner'
   OR current_database()<>'krs_registry_pilot'
   OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=${q(role)})
   OR pg_has_role(session_user,'profitia_ingestion_owner','MEMBER')
   OR pg_has_role(session_user,'krs_catalog_owner','MEMBER') THEN RAISE EXCEPTION 'Exact uninstalled receiver and operator required';END IF;END $guard$`,
  `CREATE ROLE ${role} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 4`,
  `GRANT CONNECT ON DATABASE krs_registry_pilot TO ${role}`,
  'GRANT profitia_ingestion_owner,krs_catalog_owner TO neondb_owner WITH INHERIT FALSE,SET TRUE',
  'SET LOCAL ROLE profitia_ingestion_owner',
  `DO $source$ DECLARE b jsonb;r record;v jsonb;new_policy uuid;BEGIN
   IF NOT EXISTS(SELECT 1 FROM profitia_ingestion.installation WHERE singleton AND environment='development'
    AND project_id='snowy-breeze-40315151' AND branch_id='br-summer-rain-b1nwbcbr' AND database_name=current_database())
    OR NOT EXISTS(SELECT 1 FROM profitia_ingestion.runtime_bindings WHERE login_role='krs_ingest' AND status='ACTIVE'
     AND deployment_id ~ '^srv-dbeh6srrjlhs73fmikrg:[a-f0-9]{40}:krs-registry-source$' AND expires_at>clock_timestamp())
    OR(SELECT count(*) FROM profitia_external_call.policies WHERE login_role='krs_ingest' AND status='ACTIVE'
     AND source_id IN('krs.registry.gus','krs.registry.official') AND quota_mode='UNMETERED')<>2 THEN
    RAISE EXCEPTION 'Accepted existing GUS/KRS Source required';END IF;
   SELECT to_jsonb(x) INTO b FROM profitia_ingestion.runtime_bindings x WHERE login_role='krs_ingest';
   b:=b||jsonb_build_object('login_role',${q(role)},'binding_id',${q(randomUUID())}::uuid,'service_id',${q(randomUUID())}::uuid,
    'version',1,'deployment_id',${q(target.serviceId+':'+sourceSha+':krs-registry-source')},'source_ref',${q(ref)});
   INSERT INTO profitia_ingestion.runtime_bindings SELECT(jsonb_populate_record(NULL::profitia_ingestion.runtime_bindings,b)).*;
   FOR r IN SELECT to_jsonb(g) value FROM profitia_ingestion.grants g WHERE login_role='krs_ingest'
    AND status='ACTIVE' AND source_id IN('krs.registry.gus','krs.registry.official','krs.registry.catalog') LOOP
    v:=r.value||jsonb_build_object('grant_id',gen_random_uuid(),'login_role',${q(role)},'version',1,'source_ref',${q(ref)});
    INSERT INTO profitia_ingestion.grants SELECT(jsonb_populate_record(NULL::profitia_ingestion.grants,v)).*;
   END LOOP;
   FOR r IN SELECT p.policy_id,to_jsonb(p) value FROM profitia_external_call.policies p
    WHERE login_role='krs_ingest' AND status='ACTIVE' AND source_id IN('krs.registry.gus','krs.registry.official') LOOP
    new_policy:=gen_random_uuid();v:=r.value||jsonb_build_object('policy_id',new_policy,'login_role',${q(role)},'version',1,'admitted_count',0,'source_ref',${q(ref)});
    INSERT INTO profitia_external_call.policies SELECT(jsonb_populate_record(NULL::profitia_external_call.policies,v)).*;
    SELECT to_jsonb(n) INTO v FROM profitia_external_native.policies n WHERE policy_id=r.policy_id AND status='ACTIVE';
    IF v IS NULL THEN RAISE EXCEPTION 'Current native Source transport required';END IF;
    v:=v||jsonb_build_object('policy_id',new_policy,'base_policy_version',1,'source_ref',${q(ref)});
    INSERT INTO profitia_external_native.policies SELECT(jsonb_populate_record(NULL::profitia_external_native.policies,v)).*;
   END LOOP;
  END $source$`,'RESET ROLE']
 const clone=`DO $acl$ DECLARE r record;BEGIN
  FOR r IN SELECT format('GRANT USAGE ON SCHEMA %I TO %I',n.nspname,${q(role)}) command
   FROM pg_namespace n CROSS JOIN LATERAL aclexplode(n.nspacl) a WHERE a.grantee='krs_ingest'::regrole
    AND n.nspowner=current_user::regrole AND a.privilege_type='USAGE'
   UNION ALL SELECT format('GRANT EXECUTE ON FUNCTION %s TO %I',p.oid::regprocedure,${q(role)}) FROM pg_proc p
    CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE a.grantee='krs_ingest'::regrole AND p.proowner=current_user::regrole AND a.privilege_type='EXECUTE'
   UNION ALL SELECT format('GRANT %s ON TABLE %s TO %I',a.privilege_type,c.oid::regclass,${q(role)}) FROM pg_class c
    CROSS JOIN LATERAL aclexplode(c.relacl) a WHERE a.grantee='krs_ingest'::regrole AND c.relowner=current_user::regrole
     AND a.privilege_type IN('SELECT','INSERT','UPDATE') LOOP EXECUTE r.command;END LOOP;
 END $acl$`
 for(const owner of ['profitia_ingestion_owner','krs_catalog_owner'])before.push('SET LOCAL ROLE '+owner,clone,'RESET ROLE')
 const after=[
  'REVOKE profitia_ingestion_owner,krs_catalog_owner FROM neondb_owner GRANTED BY neondb_owner',
  `DO $closed$ BEGIN IF current_user<>session_user
   OR pg_has_role(session_user,'profitia_ingestion_owner','MEMBER') OR pg_has_role(session_user,'krs_catalog_owner','MEMBER')
   OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=${q(role)}::regrole)
   OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=${q(role)} AND rolcanlogin AND rolconnlimit=4
    AND NOT(rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)) THEN
   RAISE EXCEPTION 'Ordinary receiver and complete owner-access cleanup required';END IF;END $closed$`]
 return {sourceSha,projectId:registry.catalog.projectId,branchId:registry.catalog.branchId,databaseName:registry.catalog.databaseName,
  role,requiresOneTransaction:true,requiresExplicitOwnerAccessApproval:true,remoteExecutionApproved:false,
  existingBindingsChanged:false,existingBudgetsChanged:false,paidProviderAllowanceAdded:false,
  beforeCredentials:before,afterCredentials:after,digest:createHash('sha256').update(JSON.stringify([before,after])).digest('hex')}
}
