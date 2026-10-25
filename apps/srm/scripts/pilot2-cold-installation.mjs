import fs from 'node:fs'
import {createHash} from 'node:crypto'
const target=JSON.parse(fs.readFileSync(new URL('../deployment/pilot2-human-targets.json',import.meta.url)))
const migration=fs.readFileSync(new URL('../db/private-store/022-pilot2-registry-envelope.sql',import.meta.url),'utf8')
const hash=s=>createHash('sha256').update(s).digest('hex')
const literal=s=>"'"+String(s).replaceAll("'","''")+"'"
const roles=['srm_pilot2_source','srm_pilot2_corporate']
const tuples="('srm_krs_pilot_source','srm_pilot2_source'),('srm_krs_pilot_corporate','srm_pilot2_corporate')"
const cloneAcl=`DO $acl$ DECLARE template text;receiver text;r record;BEGIN
 FOR template,receiver IN SELECT * FROM(VALUES ${tuples})pairs LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=template AND rolcanlogin AND NOT(rolsuper OR rolbypassrls OR rolinherit OR rolcreatedb OR rolcreaterole)) THEN RAISE EXCEPTION 'Ordinary accepted template required';END IF;
  FOR r IN SELECT n.nspname FROM pg_namespace n CROSS JOIN LATERAL aclexplode(n.nspacl) a WHERE a.grantee=template::regrole AND a.privilege_type='USAGE' AND n.nspowner=current_user::regrole LOOP EXECUTE format('GRANT USAGE ON SCHEMA %I TO %I',r.nspname,receiver);END LOOP;
  FOR r IN SELECT p.oid::regprocedure signature FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE a.grantee=template::regrole AND a.privilege_type='EXECUTE' AND p.proowner=current_user::regrole LOOP EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %I',r.signature,receiver);END LOOP;
  FOR r IN SELECT n.nspname,c.relname,a.privilege_type FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(c.relacl) a WHERE a.grantee=template::regrole AND c.relowner=current_user::regrole AND n.nspname='srm' AND a.privilege_type IN('SELECT','INSERT','UPDATE','DELETE') LOOP EXECUTE format('GRANT %s ON TABLE %I.%I TO %I',r.privilege_type,r.nspname,r.relname,receiver);END LOOP;
 END LOOP;
END $acl$`

/** Atomic, optional technical adoption only. New source-role ledgers record
 * their own use; the existing rows/counters, licenses and human grants retain
 * every value. UNMETERED reuses the owner's permanent query-quota decision.
 * CEIDG keeps its existing metered policy and shared Source funding. */
export function pilot2ColdInstallationPlan(sourceSha,{ingestionMembership}={}){
 if(!/^[a-f0-9]{40}$/.test(sourceSha??'')||!['EXISTING','TEMPORARY'].includes(ingestionMembership)
  ||hash(migration)!==target.coldAcquisition.registryEnvelopeBoundaryDigest)throw Error('Exact accepted source and optional migration required')
 const existing=ingestionMembership==='EXISTING',ref=target.taskId+':'+sourceSha
 const before=["SET LOCAL statement_timeout='15s'","SET LOCAL lock_timeout='3s'","SET LOCAL idle_in_transaction_session_timeout='15s'",
  "SELECT pg_advisory_xact_lock(hashtext('srm-pilot2-cold-onboarding'))",
  `DO $guard$ BEGIN
   IF current_user<>session_user OR current_user<>'neondb_owner' OR current_database()<>'platform_private'
    OR NOT pg_has_role(session_user,'profitia_access_owner','MEMBER') OR NOT pg_has_role(session_user,'profitia_access_owner','SET')
    OR pg_has_role(session_user,'profitia_ingestion_owner','MEMBER') IS DISTINCT FROM ${existing}
    OR pg_has_role(session_user,'profitia_ingestion_owner','SET') IS DISTINCT FROM ${existing}
    OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN('srm_pilot2_source','srm_pilot2_corporate'))
    OR to_regprocedure('srm.pilot2_registry_envelope_descriptor()') IS NOT NULL THEN RAISE EXCEPTION 'Exact uninstalled PILOT2 adoption required';END IF;
   END $guard$`,
  ...roles.map(r=>`CREATE ROLE ${r} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION CONNECTION LIMIT 4`),
  `GRANT CONNECT ON DATABASE platform_private TO ${roles.join(',')}`,
  'SET LOCAL ROLE profitia_access_owner',
  `DO $binding$ BEGIN
   IF NOT EXISTS(SELECT 1 FROM profitia_access.installation WHERE singleton AND environment='development'
    AND project_id='spring-bread-28217539' AND branch_id='br-sparkling-term-b99l107x' AND database_name=current_database())
    OR NOT EXISTS(SELECT 1 FROM profitia_report_admission.receivers WHERE foreground_role='srm_private_development_runtime' AND executor_role='srm_pilot2_jobs' AND enabled)
    OR NOT EXISTS(SELECT 1 FROM profitia_services.runtime_bindings WHERE login_role='srm_pilot2_jobs' AND status='ACTIVE' AND deployment_id ~ '^srv-dbeh6srrjlhs73fmikrg:[a-f0-9]{40}:srm-jobs$') THEN RAISE EXCEPTION 'Existing authoritative PILOT2 form required';END IF;
   END $binding$`,migration,
  `INSERT INTO srm.pilot2_registry_envelope_installation VALUES(true,'1.0.0',${literal(hash(migration))},${literal(ref)})`,
  'GRANT EXECUTE ON FUNCTION srm.pilot2_registry_envelope_descriptor() TO srm_pilot2_jobs',
  'GRANT SELECT ON profitia_supplier_requests.commands TO srm_pilot2_jobs',cloneAcl,
  `INSERT INTO profitia_jobs.execution_grants(grant_id,login_role,binding_id,organisation_id,resource_id,effect,status,version,source_ref,expires_at)
   SELECT gen_random_uuid(),'srm_pilot2_jobs',g.binding_id,g.organisation_id,g.resource_id,g.effect,g.status,1,${literal(ref)},g.expires_at
   FROM profitia_jobs.execution_grants g JOIN profitia_jobs.operation_bindings b USING(binding_id)
   WHERE g.login_role='srm_krs_pilot_jobs' AND g.status='ACTIVE' AND g.expires_at>clock_timestamp()
    AND b.foreground_role='srm_private_development_runtime' AND b.operation='supplier.private.refresh'
    AND b.configuration_version='srm-native-supplier-e1-v1' AND b.status='ACTIVE' AND b.expires_at>clock_timestamp()
    AND NOT EXISTS(SELECT 1 FROM profitia_jobs.execution_grants own WHERE own.login_role='srm_pilot2_jobs'
     AND own.binding_id=g.binding_id AND own.organisation_id=g.organisation_id AND own.resource_id IS NOT DISTINCT FROM g.resource_id)`,
  'RESET ROLE',
  ...(!existing?['GRANT profitia_ingestion_owner TO neondb_owner WITH INHERIT FALSE, SET TRUE']:[]),
  'SET LOCAL ROLE profitia_ingestion_owner',cloneAcl,
  `DO $source$ DECLARE template text;receiver text;v jsonb;row record;id uuid;BEGIN
   IF NOT EXISTS(SELECT 1 FROM profitia_ingestion.installation WHERE singleton AND environment='development'
    AND project_id='spring-bread-28217539' AND branch_id='br-sparkling-term-b99l107x' AND database_name=current_database()) THEN RAISE EXCEPTION 'Exact Source installation required';END IF;
   FOR template,receiver IN SELECT * FROM(VALUES ${tuples})pairs LOOP
    SELECT to_jsonb(b) INTO v FROM profitia_ingestion.runtime_bindings b WHERE login_role=template AND status='ACTIVE' AND expires_at>clock_timestamp();
    IF v IS NULL THEN RAISE EXCEPTION 'Active accepted Source template required';END IF;
    v:=v||jsonb_build_object('login_role',receiver,'binding_id',gen_random_uuid(),'service_id',gen_random_uuid(),'version',1,
     'deployment_id',${literal(target.renderServiceId+':'+sourceSha+':')}||CASE receiver WHEN 'srm_pilot2_source' THEN 'srm-provider-source' ELSE 'srm-corporate-source' END,'source_ref',${literal(ref)});
    INSERT INTO profitia_ingestion.runtime_bindings SELECT(jsonb_populate_record(NULL::profitia_ingestion.runtime_bindings,v)).*;
    FOR row IN SELECT to_jsonb(g) value FROM profitia_ingestion.grants g WHERE login_role=template AND status='ACTIVE' AND(expires_at IS NULL OR expires_at>clock_timestamp()) LOOP
     v:=row.value||jsonb_build_object('grant_id',gen_random_uuid(),'login_role',receiver,'version',1,'source_ref',${literal(ref)});
     INSERT INTO profitia_ingestion.grants SELECT(jsonb_populate_record(NULL::profitia_ingestion.grants,v)).*;
    END LOOP;
    FOR row IN SELECT to_jsonb(b) value FROM profitia_ingestion.budgets b WHERE login_role=template AND status='ACTIVE' AND quota_mode='UNMETERED' LOOP
     v:=row.value||jsonb_build_object('policy_id',gen_random_uuid(),'login_role',receiver,'version',1,'consumed_count',0,'source_ref',${literal(ref)});
     INSERT INTO profitia_ingestion.budgets SELECT(jsonb_populate_record(NULL::profitia_ingestion.budgets,v)).*;
    END LOOP;
   END LOOP;
   FOR row IN SELECT p.policy_id,to_jsonb(p) value FROM profitia_external_call.policies p
    WHERE login_role='srm_krs_pilot_source' AND status='ACTIVE' AND(expires_at IS NULL OR expires_at>clock_timestamp())
     AND resource_id IN('srm-provider:mgbi','srm-provider:mgbi-files-api','srm-provider:mgbi-files-storage','srm-provider:ceidg') LOOP
    id:=gen_random_uuid();v:=row.value||jsonb_build_object('policy_id',id,'login_role','srm_pilot2_source','version',1,'admitted_count',0,'source_ref',${literal(ref)});
    INSERT INTO profitia_external_call.policies SELECT(jsonb_populate_record(NULL::profitia_external_call.policies,v)).*;
    SELECT to_jsonb(n) INTO v FROM profitia_external_native.policies n WHERE policy_id=row.policy_id AND status='ACTIVE';
    IF v IS NULL THEN RAISE EXCEPTION 'Active exact native transport required';END IF;
    v:=v||jsonb_build_object('policy_id',id,'base_policy_version',1,'source_ref',${literal(ref)});
    INSERT INTO profitia_external_native.policies SELECT(jsonb_populate_record(NULL::profitia_external_native.policies,v)).*;
   END LOOP;
   IF(SELECT count(*) FROM profitia_external_call.policies WHERE login_role='srm_pilot2_source' AND status='ACTIVE')<>4
    OR(SELECT count(*) FROM profitia_ingestion.runtime_bindings WHERE login_role IN('srm_pilot2_source','srm_pilot2_corporate') AND status='ACTIVE')<>2 THEN RAISE EXCEPTION 'Complete bounded Source adoption required';END IF;
  END $source$`,'RESET ROLE',...(!existing?['REVOKE profitia_ingestion_owner FROM neondb_owner']:[])]
 const after=[`DO $verify$ BEGIN
   IF current_user<>session_user OR current_user<>'neondb_owner'
    OR pg_has_role(session_user,'profitia_ingestion_owner','MEMBER') IS DISTINCT FROM ${existing}
    OR pg_has_role(session_user,'profitia_ingestion_owner','SET') IS DISTINCT FROM ${existing}
    OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN('srm_pilot2_source','srm_pilot2_corporate') AND(rolsuper OR rolbypassrls OR rolinherit OR rolcreatedb OR rolcreaterole OR rolreplication OR NOT rolcanlogin OR rolconnlimit<>4))
    OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member IN('srm_pilot2_source'::regrole,'srm_pilot2_corporate'::regrole)) THEN RAISE EXCEPTION 'Ordinary credentials and no retained owner membership required';END IF;
   END $verify$`]
 return Object.freeze({version:'pilot2-cold-technical-adoption-v1',host:'ep-late-heart-b9mxo8oi.c-7.eu-central-1.aws.neon.tech',databaseName:'platform_private',roles:[...roles],sourceSha,
  beforeCredentials:before,afterCredentials:after,digest:hash(JSON.stringify([before,after]))})
}
