// SYNTHETIC ONLY: isolated loopback PostgreSQL16. No Neon URL, customer data,
// provider access, product installation or actual Clerk session is used.
// The existing 18-migration master and canonical Root/Access SQL are replayed.
// Ready-report metadata support is loaded as exact source excerpts; this fixture
// does not claim a positive end-to-end X-Ray/report acceptance.
import fs from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import pg from '../../../../apps/architecture-lab/node_modules/pg/lib/index.js';
import {postgresFixture,clerkFixture} from './identity-profile-postgres.mjs';
import {privateBusinessPlan} from '../../../../apps/srm/db/private-store/initialize.mjs';
import {createSupplierWorkspaceHost} from '../../src/supplier-workspace-host.mjs';
import {SUPPLIER_WORKSPACE_OPERATIONS} from '../../src/supplier-workspace-access.mjs';
import {OPERATION_CONTRACT} from '../../src/operation-context.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const common=n=>fs.readFileSync(new URL('../../migrations/access/'+n,import.meta.url),'utf8');
const own=n=>fs.readFileSync(new URL('../../../../apps/srm/db/private-store/'+n,import.meta.url),'utf8');
const future=()=>new Date(Date.now()+3600000).toISOString();
const ROLE='srm_private_development_runtime',SOURCE='a'.repeat(40);
const pairs=[
 ['002-module-scope.sql','profitia_modules.installation'],
 ['003-module-audit.sql','profitia_modules.audit_installation'],
 ['005-service-read.sql','profitia_services.installation'],
 ['006-request-reservation.sql','profitia_requests.installation'],
 ['007-delegated-jobs.sql','profitia_jobs.installation'],
 ['010-external-request-admission.sql','profitia_requests.external_installation'],
 ['011-request-continuation.sql','profitia_request_phases.installation'],
 ['013-supplier-delegation.sql','profitia_supplier_jobs.installation'],
 ['014-delegated-private-phases.sql','profitia_delegated_phases.installation'],
 ['015-delegated-private-inspection.sql','profitia_request_inspection.installation'],
 ['016-delegated-native-work.sql','profitia_request_work.installation'],
 ['017-additional-request-operations.sql','profitia_requests.operation_installation'],
 ['019-supplier-location-operations.sql','profitia_requests.location_installation'],
 ['020-supplier-location-admission.sql','profitia_requests.location_admission_installation'],
 ['022-organisation-location-grants.sql','profitia_access.organisation_location_installation'],
];
const exact=(text,pattern,label)=>{const m=text.match(pattern);if(!m)throw Error('Canonical fixture excerpt missing: '+label);return m[0]};
export async function supplierWorkspaceFixture(){
 const base=await postgresFixture();let admin,pool,auditPool;
 const A=randomUUID(),B=randomUUID(),U=randomUUID(),V=randomUUID(),W=randomUUID(),S=randomUUID(),SB=randomUUID();
 const clerk=clerkFixture(),config={...base.config,database:'platform_private'};
 const binding={applicationId:'srm',environment:'development',projectId:'spring-bread-28217539',
  branchId:'br-sparkling-term-b99l107x',databaseName:'platform_private',role:ROLE,schemaDigest:hash(common('001-internal-access.sql'))};
 const controlled=async run=>{await admin.query('BEGIN;SET LOCAL ROLE profitia_access_owner');try{const v=await run(admin);await admin.query('COMMIT');return v}catch(e){await admin.query('ROLLBACK');throw e}};
 const policySnapshot=()=>admin.query("SELECT polname,polcmd,polpermissive,pg_get_expr(polqual,polrelid) AS using,pg_get_expr(polwithcheck,polrelid) AS check FROM pg_policy WHERE polrelid='srm.suppliers'::regclass ORDER BY polname");
 try{
  await base.admin.query('RESET ROLE;CREATE DATABASE platform_private');
  admin=new pg.Client(config);await admin.connect();
  await admin.query("CREATE EXTENSION pgcrypto;CREATE ROLE srm_app_runtime LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;CREATE ROLE neon_superuser NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE");
  await admin.query("CREATE ROLE "+ROLE+" LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE CONNECTION LIMIT 4");
  await admin.query("REVOKE ALL ON DATABASE platform_private FROM PUBLIC;GRANT CONNECT ON DATABASE platform_private TO "+ROLE+";GRANT CREATE ON DATABASE platform_private TO profitia_access_owner");
  await controlled(async c=>{
   await c.query(common('001-internal-access.sql'));
   await c.query("INSERT INTO profitia_access.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development',$2,$3,'platform_private')",[binding.schemaDigest,binding.projectId,binding.branchId]);
   for(const[file,table]of pairs){
    await c.query(common(file));
    if(file.startsWith('002'))await c.query("INSERT INTO "+table+" VALUES(true,'1.0.0',$1)",[hash(common(file))]);
    else if(file.startsWith('022'))await c.query("INSERT INTO "+table+" VALUES(true,'1.0.0',$1,$2)",[hash(common(file)),SOURCE]);
    else await c.query("INSERT INTO "+table+" VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY_NOT_RELEASE')",[hash(common(file))]);
   }
   await c.query("INSERT INTO profitia_access.applications VALUES('srm','DISABLED',NULL)");
   await c.query("INSERT INTO profitia_access.runtime_bindings VALUES($1,'srm','ACTIVE')",[ROLE]);
   await c.query(own('001-supplier-requests.sql'));
   await c.query("INSERT INTO profitia_supplier_requests.installation VALUES(true,'1.0.0',$1,$2)",[hash(own('001-supplier-requests.sql')),SOURCE]);
  });
  await admin.query('REVOKE CREATE ON DATABASE platform_private FROM profitia_access_owner;BEGIN');
  try{for(const sql of privateBusinessPlan({binding,sourceSha:SOURCE}).sql)await admin.query(sql);await admin.query('COMMIT')}catch(e){await admin.query('ROLLBACK');throw e}
  await controlled(async c=>{
   for(const[file,table]of [
    ['002-supplier-business-phases.sql','srm.supplier_business_installation'],
    ['003-named-supplier-interest.sql','srm.named_interest_installation'],
    ['006-delegated-supplier-business.sql','srm.delegated_supplier_installation'],
    ['007-supplier-private-inspection.sql','srm.supplier_inspection_installation'],
    ['008-supplier-native-work.sql','srm.supplier_work_installation'],
    ['010-supplier-sensitive-work.sql','srm.supplier_sensitive_installation'],
    ['013-supplier-locations.sql','srm.supplier_location_installation'],
    ['014-supplier-location-admission-parent.sql','srm.supplier_location_admission_installation']]){
     await c.query(own(file));
     await c.query("INSERT INTO "+table+"(singleton,schema_version,"+(file.startsWith('013')||file.startsWith('014')?'schema_digest':'boundary_digest')+",source_ref) VALUES(true,'1.0.0',$1,$2)",[hash(own(file)),SOURCE]);
   }
   // Exact canonical table/function/policy excerpts required by the current master.
   // No replacement ALLOW function or permissive test RLS policy is introduced.
   const r24=own('024-ready-report-history.sql'),r25=own('025-ready-report-history.sql');
   await c.query(exact(r24,/CREATE TABLE srm\.ready_company_reports\([\s\S]*?\n\);/,'ready company table'));
   await c.query(exact(r25,/CREATE TABLE srm\.ready_report_reads\([\s\S]*?\n\);/,'ready read table'));
   await c.query(exact(r25,/CREATE FUNCTION srm\.ready_report_metadata_scope\([\s\S]*?END \$fn\$;/,'ready metadata function'));
   await c.query(exact(r25,/DO \$metadata_policies\$[\s\S]*?END \$metadata_policies\$;/,'ready master policies'));
   await c.query("ALTER TABLE srm.ready_company_reports ENABLE ROW LEVEL SECURITY;ALTER TABLE srm.ready_company_reports FORCE ROW LEVEL SECURITY;ALTER TABLE srm.ready_report_reads ENABLE ROW LEVEL SECURITY;ALTER TABLE srm.ready_report_reads FORCE ROW LEVEL SECURITY");
   for(const t of ['ready_company_reports','ready_report_reads'])await c.query("CREATE POLICY controlled_owner ON srm."+t+" TO profitia_access_owner USING(true) WITH CHECK(true)");
  });
  const before=(await policySnapshot()).rows;
  const migration=common('supplier-workspace-v1.sql'),schemaDigest=hash(migration);
  const install=async c=>{
   await c.query("SELECT set_config('profitia.install.supplier_workspace_digest',$1,true),set_config('profitia.install.supplier_workspace_source',$2,true)",[schemaDigest,SOURCE]);
   await c.query(migration);
  };
  await controlled(async c=>{await c.query('SAVEPOINT installation_interruption');await install(c);await c.query('ROLLBACK TO SAVEPOINT installation_interruption')});
  if((await admin.query("SELECT to_regnamespace('profitia_supplier_workspace') AS n")).rows[0].n!==null)throw Error('Partial workspace installation survived rollback');
  if(JSON.stringify((await policySnapshot()).rows)!==JSON.stringify(before))throw Error('Master policies survived rolled-back installation');
  await controlled(install);
  // Installation alone enrolls no organization and grants no runtime EXECUTE.
  const noImplicitGrant=(await admin.query("SELECT has_function_privilege($1,'profitia_supplier_workspace.bind_operation(uuid,text)','EXECUTE') AS granted,(SELECT count(*)::int FROM profitia_supplier_workspace.organisation_policies) AS policies",[ROLE])).rows[0];
  await controlled(async c=>{
   for(const org of[A,B])await c.query("INSERT INTO profitia_access.organisations VALUES($1,'ACTIVE',1)",[org]);
   for(const user of[U,V,W]){
    await c.query("INSERT INTO profitia_access.accounts VALUES($1,'ACTIVE',1)",[user]);
    await c.query("INSERT INTO profitia_access.external_identities VALUES($1,$2,$3,$4,'ACTIVE',1,'SYNTHETIC_ONLY',$5)",[randomUUID(),clerk.issuer,'subject-'+user,user,future()]);
   }
   for(const[user,org]of[[U,A],[V,A],[W,B]])await c.query("INSERT INTO profitia_access.memberships VALUES($1,$2,'ACTIVE',1,'SYNTHETIC_ONLY',$3)",[org,user,future()]);
   for(const org of[A,B])await c.query("INSERT INTO profitia_access.product_grants VALUES('srm',$1,'SPENDGURU',ARRAY['supplier_workspace'],'ACTIVE',1,'EXPLICIT_OFFER','SYNTHETIC_ONLY',$2)",[org,future()]);
   await c.query("INSERT INTO profitia_modules.application_bindings(application_id,module_id,binding_id,status,source_ref,expires_at) VALUES('srm','supplier_workspace',$1,'ACTIVE','SYNTHETIC_ONLY',$2)",[randomUUID(),future()]);
   await c.query("UPDATE profitia_access.applications SET status='ACTIVE' WHERE application_id='srm'");
   await c.query("GRANT USAGE ON SCHEMA profitia_access,profitia_modules,profitia_supplier_workspace,srm TO "+ROLE);
   await c.query("GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA profitia_access,profitia_modules TO "+ROLE);
   await c.query("GRANT EXECUTE ON FUNCTION profitia_supplier_workspace.bind_operation(uuid,text),profitia_supplier_workspace.descriptor() TO "+ROLE);
   // Authority boundary probe ONLY. The full SRM command/query implementation
   // belongs to the receiving SRM source task and is not simulated as complete.
   await c.query("CREATE FUNCTION srm.supplier_pipelines_execute(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$ DECLARE d jsonb;r jsonb;org uuid;BEGIN d:=profitia_supplier_workspace.assert_payload(p);org:=(d->>'organisationId')::uuid;IF p->>'command'='SUPPLIER_CREATE' THEN IF profitia_supplier_workspace.scope_allows(org,'supplier.catalog.write',NULL) IS NOT TRUE THEN RAISE EXCEPTION 'Write denied' USING ERRCODE='42501';END IF;PERFORM profitia_supplier_workspace.ensure_organisation();INSERT INTO srm.suppliers(id,organization_id,nip,display_name) VALUES((p->'data'->>'supplierId')::uuid,org,p->'data'->>'nip',p->'data'->>'name');END IF;SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'organisationId',organization_id,'name',display_name)),'[]'::jsonb) INTO r FROM srm.suppliers WHERE organization_id=org;RETURN jsonb_build_object('ok',true,'rows',r,'descriptor',d);END $fn$;REVOKE ALL ON FUNCTION srm.supplier_pipelines_execute(jsonb) FROM PUBLIC;GRANT EXECUTE ON FUNCTION srm.supplier_pipelines_execute(jsonb) TO "+ROLE);
  });
  pool=new pg.Pool({...config,user:ROLE,max:3});auditPool=new pg.Pool({...config,user:ROLE,max:1});
  const enrol=(org=A)=>controlled(c=>c.query("INSERT INTO profitia_supplier_workspace.organisation_policies VALUES('srm',$1,$2,'ACTIVE',1,'SYNTHETIC_ONLY',$3)",[org,randomUUID(),future()]));
  const deny=(operation,{user=U,org=A,resource=null}={})=>controlled(c=>c.query("INSERT INTO profitia_access.permission_grants VALUES($1,'srm',$2,$3,'DENY',$4,'supplier_workspace',$5)",[randomUUID(),org,user,operation,resource]));
  const execute=async({user=U,org=A,operation='supplier.catalog.read',payload={kind:'SUPPLIERS'},afterDomain,failOutcome=false,forgePayload,wrongSchema=false,wrongSource=false}={})=>{
   const f=clerkFixture('subject-'+user),domainSeen=[];
   const transact=async(run,limits)=>{
    const c=await pool.connect();let closed=false,timer;
    try{await c.query('BEGIN');const query=async(sql,args)=>{
     if(closed)throw Error('Transaction closed');
     if(failOutcome&&sql.includes('append_audit')&&JSON.parse(args?.[0]??'{}').phase==='OUTCOME')throw Error('SYNTHETIC_OUTCOME_FAILURE');
     const r=await c.query(sql,forgePayload&&sql.includes('supplier_pipelines_execute')?[JSON.stringify(forgePayload)]:args);
     if(sql.includes('supplier_pipelines_execute')){domainSeen.push(true);if(afterDomain)await afterDomain({client:c,clerk:f})}
     return r;
    };const value=await Promise.race([run({query,transaction:c}),new Promise((_,reject)=>{timer=setTimeout(()=>{closed=true;reject(Error('Fixture transaction timeout'))},limits.timeoutMs)})]);await c.query('COMMIT');return value}
    catch(e){closed=true;await c.query('ROLLBACK');throw e}finally{closed=true;clearTimeout(timer);c.release()}
   };
   const host=createSupplierWorkspaceHost({
    application:{appId:'srm',profileId:'SPENDGURU_SAAS',environment:'development',deploymentId:'SYNTHETIC_ONLY',configurationVersion:'workspace-v1',identityIssuer:f.issuer,organisationId:null,features:['supplier_workspace'],operations:[...SUPPLIER_WORKSPACE_OPERATIONS]},
    binding,module:{id:'supplier_workspace',schemaDigest:hash(common('002-module-scope.sql')),auditSchemaDigest:hash(common('003-module-audit.sql'))},
    supplierWorkspace:{schemaDigest:wrongSchema?'f'.repeat(64):schemaDigest,sourceRef:wrongSource?'f'.repeat(40):SOURCE},
    identity:{appId:'srm',environment:'development',issuer:f.issuer,authorizedParties:[f.origin]},clerk:f.client,
    independentQuery:auditPool.query.bind(auditPool),transact,
   });
   const input={contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,organisationId:org,operation,
    resourceId:'supplier-workspace:'+org,payload,request:f.request(operation.endsWith('.write')?'POST':'GET')};
   const result=await host.execute(input);return{result,clerk:f,domainSeen};
  };
  return{A,B,U,V,W,S,SB,binding,admin,pool,auditPool,controlled,enrol,deny,execute,before,noImplicitGrant,schemaDigest,
   count:async()=>(await admin.query('SELECT count(*)::int AS n FROM srm.suppliers')).rows[0].n,
   snapshot:policySnapshot,
   async close(){await pool.end();await auditPool.end();await admin.end();await base.close()},
  };
 }catch(e){await pool?.end();await auditPool?.end();await admin?.end();await base.close();throw e}
}
