import fs from 'node:fs'
import {createHash} from 'node:crypto'
const target=JSON.parse(fs.readFileSync(new URL('../deployment/pilot2-human-targets.json',import.meta.url)))
const literal=s=>"'"+String(s).replaceAll("'","''")+"'"
const hash=s=>createHash('sha256').update(s).digest('hex')
const roles=['srm_pilot2_jobs']
const newRole=r=>`CREATE ROLE ${r} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION CONNECTION LIMIT 4`
const limits=["SET LOCAL statement_timeout='15s'","SET LOCAL lock_timeout='3s'","SET LOCAL idle_in_transaction_session_timeout='15s'"]

/** Only new technical receivers are registered. No account, membership,
 * permission/product grant, existing binding, policy, quota or counter changes.
 * The operator provides initial passwords inside the SAME outer transaction,
 * after RESET ROLE and before cleanup/COMMIT, never through a saved plan. */
export function pilot2HumanInstallationPlan(sourceSha,{operatorMembership}={}){
 if(!/^[a-f0-9]{40}$/.test(sourceSha??''))throw Error('Accepted exact main SHA required')
 if(!['EXISTING','TEMPORARY'].includes(operatorMembership))throw Error('Live verified operator membership state required')
 const existing=operatorMembership==='EXISTING'
 const sourceRef=target.taskId+':'+sourceSha
 const before=[...limits,
  `SELECT pg_advisory_xact_lock(hashtext('srm-pilot2-human-onboarding'))`,
  `DO $guard$ BEGIN
   IF current_user<>session_user OR current_user<>'neondb_owner' OR current_database()<>'platform_private'
    OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='srm_pilot2_jobs')
    OR pg_has_role(session_user,'profitia_access_owner','MEMBER') IS DISTINCT FROM ${existing}
    OR pg_has_role(session_user,'profitia_access_owner','SET') IS DISTINCT FROM ${existing} THEN
    RAISE EXCEPTION 'Exact uninstalled PILOT2 technical receivers and authoritative existing E1 required';END IF;
   END $guard$`,...roles.map(newRole),
  `GRANT CONNECT ON DATABASE platform_private TO ${roles.join(',')}`,
  ...(!existing?[`GRANT profitia_access_owner TO neondb_owner WITH INHERIT FALSE, SET TRUE`]:[]),
  'SET LOCAL ROLE profitia_access_owner',
  `DO $binding$ BEGIN
   IF current_user<>'profitia_access_owner'
    OR NOT EXISTS(SELECT 1 FROM profitia_access.installation WHERE singleton AND environment='development'
     AND project_id='spring-bread-28217539' AND branch_id='br-sparkling-term-b99l107x' AND database_name=current_database())
    OR NOT EXISTS(SELECT 1 FROM profitia_report_admission.installation WHERE singleton AND schema_version='1.0.0')
    OR NOT EXISTS(SELECT 1 FROM profitia_access.runtime_bindings WHERE login_role='srm_private_development_runtime' AND application_id='srm' AND status='ACTIVE')
    OR (SELECT count(*) FROM profitia_jobs.operation_bindings WHERE foreground_role='srm_private_development_runtime'
     AND operation='supplier.report.refresh' AND configuration_version='srm-native-supplier-e1-v1' AND profile_id='PORR_SUITE'
     AND status='ACTIVE' AND expires_at>clock_timestamp())<>1 THEN
    RAISE EXCEPTION 'Existing authoritative SRM entry and exact private installation required';END IF;
   END $binding$`,
  `DO $acl$ DECLARE source_role text;receiver text;r record;BEGIN
   FOR source_role,receiver IN SELECT * FROM(VALUES('srm_krs_pilot_jobs','srm_pilot2_jobs'))pairs LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=source_role AND rolcanlogin AND NOT(rolsuper OR rolbypassrls OR rolinherit OR rolcreatedb OR rolcreaterole)) THEN RAISE EXCEPTION 'Ordinary accepted template required';END IF;
    FOR r IN SELECT n.nspname FROM pg_namespace n CROSS JOIN LATERAL aclexplode(n.nspacl) acl
     WHERE acl.grantee=source_role::regrole AND acl.privilege_type='USAGE' AND n.nspowner=current_user::regrole LOOP
     EXECUTE format('GRANT USAGE ON SCHEMA %I TO %I',r.nspname,receiver);END LOOP;
    FOR r IN SELECT p.oid::regprocedure AS signature FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) acl
     WHERE acl.grantee=source_role::regrole AND acl.privilege_type='EXECUTE' AND p.proowner=current_user::regrole LOOP
     EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %I',r.signature,receiver);END LOOP;
    FOR r IN SELECT n.nspname,c.relname,acl.privilege_type FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     CROSS JOIN LATERAL aclexplode(c.relacl) acl WHERE acl.grantee=source_role::regrole AND c.relowner=current_user::regrole
      AND n.nspname='srm' AND acl.privilege_type IN('SELECT','INSERT','UPDATE','DELETE') LOOP
     EXECUTE format('GRANT %s ON TABLE %I.%I TO %I',r.privilege_type,r.nspname,r.relname,receiver);END LOOP;
   END LOOP;
   END $acl$`,
  `INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES('srm_pilot2_jobs','srm-jobs','ACTIVE')`,
  `INSERT INTO profitia_services.runtime_bindings(login_role,binding_id,service_id,profile_id,deployment_id,configuration_version,status,version,source_ref,expires_at)
   SELECT 'srm_pilot2_jobs',gen_random_uuid(),gen_random_uuid(),profile_id,${literal(target.renderServiceId+':'+sourceSha+':srm-jobs')},configuration_version,'ACTIVE',1,${literal(sourceRef)},expires_at
   FROM profitia_services.runtime_bindings WHERE login_role='srm_krs_pilot_jobs' AND status='ACTIVE' AND expires_at>clock_timestamp()`,
  `INSERT INTO profitia_services.read_grants(grant_id,login_role,organisation_id,operation,feature,resource_id,effect,status,version,source_ref,expires_at)
   SELECT gen_random_uuid(),'srm_pilot2_jobs',organisation_id,operation,feature,resource_id,effect,status,1,${literal(sourceRef)},expires_at
   FROM profitia_services.read_grants WHERE login_role='srm_krs_pilot_jobs' AND status='ACTIVE' AND expires_at>clock_timestamp()`,
  `INSERT INTO profitia_jobs.execution_grants(grant_id,login_role,binding_id,organisation_id,resource_id,effect,status,version,source_ref,expires_at)
   SELECT gen_random_uuid(),'srm_pilot2_jobs',original.binding_id,g.organisation_id,g.resource_id,g.effect,g.status,1,${literal(sourceRef)},g.expires_at
   FROM profitia_jobs.execution_grants g JOIN profitia_jobs.operation_bindings original USING(binding_id)
   WHERE g.login_role='srm_krs_pilot_jobs' AND original.foreground_role='srm_private_development_runtime'
    AND original.operation='supplier.report.refresh' AND g.status='ACTIVE' AND g.expires_at>clock_timestamp()`,
  `INSERT INTO profitia_report_admission.receivers(foreground_role,executor_role,enabled) VALUES('srm_private_development_runtime','srm_pilot2_jobs',true)`,
  'RESET ROLE',
 ]
 const after=[...(!existing?[`REVOKE profitia_access_owner FROM neondb_owner`]:[]),
  `DO $verify$ BEGIN
   IF current_user<>session_user OR pg_has_role(session_user,'profitia_access_owner','MEMBER') IS DISTINCT FROM ${existing}
    OR pg_has_role(session_user,'profitia_access_owner','SET') IS DISTINCT FROM ${existing}
    OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='srm_pilot2_jobs' AND(rolsuper OR rolbypassrls OR rolinherit OR rolcreatedb OR rolcreaterole OR NOT rolcanlogin OR rolconnlimit<>4))
    OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member='srm_pilot2_jobs'::regrole) THEN
    RAISE EXCEPTION 'PILOT2 technical role cleanup failed';END IF;
   END $verify$`]
 return Object.freeze({version:'pilot2-human-receivers-v1',operatorMembership,host:'ep-late-heart-b9mxo8oi.c-7.eu-central-1.aws.neon.tech',databaseName:'platform_private',roles:[...roles],sourceSha,beforeCredentials:before,afterCredentials:after,
  digest:hash(JSON.stringify({before,after})),humanEntitlementsChanged:false,existingRowsUpdated:false})
}

export function pilot2PublicReaderPlan(sourceSha){
 if(!/^[a-f0-9]{40}$/.test(sourceSha??''))throw Error('Accepted exact main SHA required')
 const role='srm_pilot2_catalog_reader'
 const before=[...limits,
  `SELECT pg_advisory_xact_lock(hashtext('srm-pilot2-public-reader'))`,
  `DO $guard$ BEGIN
   IF current_user<>session_user OR current_user<>'neondb_owner' OR current_database()<>'srm_app'
    OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='${role}')
    OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='srm'
      AND c.relname IN('catalog_companies','catalog_financial_facts','catalog_financial_indicators')
      AND c.relrowsecurity AND c.relforcerowsecurity)<>3 THEN RAISE EXCEPTION 'Exact existing isolated public catalog required';END IF;
   END $guard$`,newRole(role),
  // Preserve every old runtime capability for retained-artifact rollback,
  // while the new reader receives neither CREATE nor inherited PUBLIC TEMP.
  'GRANT CONNECT,TEMPORARY ON DATABASE srm_app TO srm_app_runtime',
  'REVOKE CONNECT,TEMPORARY ON DATABASE srm_app FROM PUBLIC',
  `GRANT CONNECT ON DATABASE srm_app TO ${role}`,
  `GRANT USAGE ON SCHEMA srm TO ${role}`,
  `GRANT SELECT(nip,general_json,financial_json,general_sha256,financial_sha256,general_checked_at,financial_checked_at) ON srm.catalog_companies TO ${role}`,
  `GRANT SELECT(nip,metric_code,period_start,period_end,statement_scope,period_type,amount,source_amount,currency_code,unit_code,source_path,validation_status,normalization_rule,source_snapshot_id) ON srm.catalog_financial_facts TO ${role}`,
  `GRANT SELECT(nip,indicator_code,period_start,period_end,statement_scope,formula_version,status,value,unit,importance,reason_code,input_facts,source_snapshot_ids,source_document_ids) ON srm.catalog_financial_indicators TO ${role}`,
  ...target.publicCatalog.tables.map(table=>`CREATE POLICY pilot2_public_reader ON srm.${table} FOR SELECT TO ${role} USING(true)`),
 ]
 const after=[`DO $verify$ BEGIN
  IF has_database_privilege('${role}',current_database(),'CREATE,TEMP')
   OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member='${role}'::regrole)
   OR has_table_privilege('${role}','srm.mgbi_source_archives','SELECT,INSERT,UPDATE,DELETE')
   OR has_table_privilege('${role}','srm.lookup_requests','SELECT,INSERT,UPDATE,DELETE') THEN
   RAISE EXCEPTION 'Public reader is not isolated';END IF;
  END $verify$`]
 return Object.freeze({version:'pilot2-public-reader-v1',host:target.publicCatalog.host,databaseName:target.publicCatalog.databaseName,roles:[role],sourceSha,beforeCredentials:before,afterCredentials:after,
  digest:hash(JSON.stringify({before,after})),privateDataCopied:false,previousRuntimeCapabilitiesPreserved:true})
}

/** No credentials are part of a plan, log or receipt. A failed initializer or
 * cleanup rolls back role creation, ACLs and bindings with the same transaction. */
export async function applyPilot2TechnicalPlan(client,plan,initializeCredentials){
 if(typeof initializeCredentials!=='function'||!plan?.beforeCredentials?.length||!plan?.afterCredentials?.length)throw Error('Explicit credential initialization inside the installation transaction required')
 if(client.connectionParameters?.host!==plan.host||client.connectionParameters?.database!==plan.databaseName
  ||client.connectionParameters?.user!=='neondb_owner')throw Error('Exact owner-approved Development endpoint and checked operator required')
 await client.query('BEGIN')
 try{
  for(const sql of plan.beforeCredentials)await client.query(sql)
  if(await initializeCredentials(client,Object.freeze([...plan.roles]))!==true)throw Error('Initial credentials were not established')
  for(const sql of plan.afterCredentials)await client.query(sql)
  await client.query('COMMIT')
 }catch(error){await client.query('ROLLBACK');throw error}
 return {version:plan.version,sourceSha:plan.sourceSha,planDigest:plan.digest,roles:plan.roles,committed:true,credentialsPrinted:false}
}
