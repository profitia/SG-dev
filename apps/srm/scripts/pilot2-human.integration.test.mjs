import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {randomUUID} from 'node:crypto'
import {supplierBusinessFixture} from './supplier-delegated-business.integration.test.mjs'
import {reportAdmissionSchemaUrl} from '@profitia/platform-contracts/report-admission'
import {isOperationDenied} from '@profitia/platform-contracts/operation-context'
import {createPilot2HumanRuntime} from '../src/server/pilot2-human-runtime.ts'
import {PILOT2_PUBLIC_CARD_SQL} from '../src/server/pilot2-public-catalog.ts'
import {mapMgbiFinancialRecords} from '../src/server/mgbi-financial.ts'
import {FINANCIAL_MAPPING_VERSION} from '../src/server/shared-catalog.ts'
import pg from 'pg'
import {pilot2HumanInstallationPlan} from './pilot2-human-installation.mjs'

test('PILOT2 reuses actual Root and form Work: no Clerk or provider after click; company and organisation substitutions deny',t=>supplierBusinessFixture(t,true,async f=>{
 const sql=fs.readFileSync(new URL(reportAdmissionSchemaUrl),'utf8'),schemaDigest=f.hash(sql)
 await f.owner.query(`GRANT CREATE ON DATABASE ${f.baseBinding.databaseName} TO profitia_access_owner`)
 await f.controlled(async()=>{
  await f.owner.query(sql)
  await f.owner.query("INSERT INTO profitia_report_admission.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",[schemaDigest])
  await f.owner.query('INSERT INTO profitia_report_admission.receivers VALUES($1,$2,true)',[f.FOREGROUND,f.EXECUTOR])
  await f.owner.query("INSERT INTO profitia_request_work.policies(application_id,unit_id,access_mode,status,source_ref,expires_at) VALUES('srm','FORM_REPORT_ADMISSION','WRITE','ACTIVE','SYNTHETIC_ONLY',clock_timestamp()+interval '1 hour')")
  for(const role of[f.FOREGROUND,f.EXECUTOR])await f.owner.query(`GRANT USAGE ON SCHEMA profitia_report_admission TO ${role};GRANT EXECUTE ON FUNCTION profitia_report_admission.runtime_descriptor(),profitia_report_admission.read(uuid,text),profitia_report_admission.start(uuid,text) TO ${role}`)
  await f.owner.query(`GRANT EXECUTE ON FUNCTION profitia_report_admission.issue(uuid,text,text),profitia_report_admission.bind_job(uuid,text,uuid),profitia_report_admission.append_job_intent(uuid,text,jsonb) TO ${f.EXECUTOR};GRANT EXECUTE ON FUNCTION profitia_report_admission.bind_human(uuid,text,text,text,text) TO ${f.FOREGROUND}`)
  for(const operation of['supplier.report.read','supplier.report.project'])await f.owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'srm',$2,$3,'ALLOW',$4,'supplier_report')",[randomUUID(),f.A,f.U,operation])
  await f.owner.query("UPDATE profitia_jobs.operation_bindings SET profile_id='PORR_SUITE' WHERE foreground_role=$1 AND operation='supplier.report.refresh'",[f.FOREGROUND])
  await f.owner.query("UPDATE profitia_access.applications SET fixed_organisation_id=$1 WHERE application_id='srm'",[f.A])
 })
 await f.owner.query(`REVOKE CREATE ON DATABASE ${f.baseBinding.databaseName} FROM profitia_access_owner`)
 const at=new Date().toISOString(),krs='0000000001',reference='KRS:'+krs+':'+'a'.repeat(64)
 const history={version:'KRS_CONTINUITY_V1',currentKrs:krs,members:[{krs,legalName:'SYNTHETIC_PUBLIC_COMPANY',legalForm:'SA',registeredAt:null,deregisteredAt:null,status:'ACTIVE'}],links:[],unlinkedKrs:[]}
 const financial=mapMgbiFinancialRecords([{id:'b'.repeat(24),identifiers:{pl_nip:f.NIP,pl_krs:krs},
  document:{type:'financial_statement',period_from_date:'2025-01-01',period_to_date:'2025-12-31'},
  content:{schema:{name:'JednostkaInnaWZlotych'},standardized_fields:{bs:{a_ca_cfy:'300',lae_lapfl_stl_cfy:'200'}}}}],
  {type:'NIP',value:f.NIP},at,1,history).section
 const row={general_checked_at:at,financial_checked_at:at,general_json:{status:'SUCCESS',source:{provider:'KRS',model:'OdpisAktualny',recordId:reference},
  retrievedAt:at,effectiveAt:null,warnings:[],data:{nip:f.NIP,krs,legalName:'SYNTHETIC_PUBLIC_COMPANY',legalForm:'SA',regon:null,
   registeredAddress:null,registeredAt:null,mainPkd:null,registrationStatus:'ACTIVE',registryHistory:history,
   registrySource:{provider:'KRS',evidenceRef:reference,retrievedAt:at,coverage:'PROGRESSIVE'}}},
  financial_json:{...financial,catalogMappingVersion:FINANCIAL_MAPPING_VERSION}}
 let reads=0
 const catalog={connect:async()=>({release(){},async query(sql,args){
  reads++;assert.equal(args[0],f.NIP)
  assert(!/srm\.(users|lookup_requests|source_snapshots|financial_source_documents|mgbi_source_archives)/.test(sql),'No private cloned table')
  if(sql===PILOT2_PUBLIC_CARD_SQL)return {rows:[structuredClone(row)]}
  if(sql==='SELECT financial_sha256 FROM srm.catalog_companies WHERE nip=$1')return {rows:[{financial_sha256:'c'.repeat(64)}]}
  assert(sql.startsWith('SELECT requested.nip,'),'Only the existing shared financial projector')
  return {rows:[{nip:f.NIP,financial_json:row.financial_json,financial_sha256:'c'.repeat(64),financial_checked_at:at,facts:[],indicators:[],kys:null}]}
 }})}
 const human={...f.humanOptions,application:{...f.humanOptions.application,profileId:'PORR_SUITE',organisationId:f.A}}
 const {executionMode,...base}=f.workOptions
 const work={...base,workSchemaDigest:f.hash(f.core('016-delegated-native-work.sql')),workBusinessBoundaryDigest:f.hash(f.own('008-supplier-native-work.sql')),reportAdmission:{schemaDigest}}
 const runtime=createPilot2HumanRuntime({config:{...human,provider:'clerk',databaseUrl:'synthetic-not-used'},human,work,catalog})
 const sourceBefore=await f.sourceCounts(),businessBefore=await f.counts()
 const prepared=await runtime.prepare(new Request('http://localhost:3400/api/xray/admission',{method:'POST',headers:{origin:'http://localhost:3400','content-type':'application/json','idempotency-key':randomUUID()},body:JSON.stringify({nip:f.NIP})}))
 assert.equal(prepared.status,200);const grant=await prepared.json();assert.match(grant.token,/^fr1\./)
 assert.equal(reads,0,'Form admission must not fetch public/provider/company data')
 assert.equal((await f.counts()).lookups,businessBefore.lookups)
 assert.equal((await f.counts()).snapshots,businessBefore.snapshots)
 assert.deepEqual(await f.sourceCounts(),sourceBefore)
 let clerk=0
 f.clerk.authenticateRequest=async()=>{clerk++;throw Error('No Clerk authenticate after admission')}
 f.clerk.users.getUser=async()=>{clerk++;throw Error('No Clerk user read after admission')}
 f.clerk.sessions.getSession=async()=>{clerk++;throw Error('No Clerk session read after admission')}
 const request=(path,token=grant.token)=>new Request('http://localhost:3400/api/xray/'+path,{method:'POST',headers:{origin:'http://localhost:3400','X-SRM-Report-Admission':token}})
 const response=await runtime.search(request('search'),f.NIP)
 const body=await response.json();assert.equal(body.entityType,'COMPANY');assert.equal(body.card.financial.status,'SUCCESS')
 assert.equal(body.card.general.data.registrySource.evidenceRef,reference)
 assert.equal(JSON.stringify(body).includes('SYNTHETIC_PRIVATE_ONLY'),false)
 const report=await runtime.report(request('report-data'),{nip:f.NIP,entityType:'COMPANY'})
 assert.equal(report.status,200);assert.equal((await report.json()).financial.scanner,undefined)
 assert.equal(clerk,0)
 await assert.rejects(runtime.search(request('search'),f.OTHER_NIP),isOperationDenied)
 await assert.rejects(runtime.search(request('search','fr1.'+randomUUID()+'.'+'0'.repeat(64)),f.NIP),isOperationDenied)
 await assert.rejects(runtime.search(new Request('http://localhost:3400/api/xray/search',{method:'POST',headers:{origin:'http://localhost:3400'}}),f.NIP),isOperationDenied)
 await assert.rejects(runtime.search(request('search?organisationId='+f.B),f.NIP),isOperationDenied)
 const beforeDisable=reads
 await f.controlled(()=>f.owner.query('UPDATE profitia_report_admission.receivers SET enabled=false WHERE foreground_role=$1',[f.FOREGROUND]))
 await assert.rejects(runtime.search(request('search'),f.NIP),isOperationDenied)
 assert.equal(reads,beforeDisable,'Disabled technical receiver cannot read the public cache')
 assert.equal(clerk,0);assert.deepEqual(await f.sourceCounts(),sourceBefore)
}))

test('PILOT2 actual receiver SQL creates working ordinary logins, preserves existing authority and leaves no new owner membership',t=>supplierBusinessFixture(t,true,async f=>{
 // This fixture is strictly a disposable loopback database. These identifiers
 // model the guarded installation receipt; no cloud connection is made.
 const oldOperator=(await f.owner.query("SELECT rolbypassrls FROM pg_roles WHERE rolname='neondb_owner'")).rows[0]
 if(!oldOperator)await f.owner.query("CREATE ROLE neondb_owner LOGIN NOINHERIT CREATEDB CREATEROLE NOSUPERUSER BYPASSRLS PASSWORD 'isolated_pilot2_operator_only'")
 else await f.owner.query("ALTER ROLE neondb_owner LOGIN BYPASSRLS PASSWORD 'isolated_pilot2_operator_only'")
 const operatorUrl=new URL(process.env.SRM_OPERATION_TEST_OWNER_URL);operatorUrl.pathname='/platform_private';operatorUrl.username='neondb_owner';operatorUrl.password='isolated_pilot2_operator_only'
 await f.owner.query('GRANT profitia_access_owner TO neondb_owner WITH INHERIT FALSE,SET TRUE')
 await f.owner.query('GRANT CONNECT ON DATABASE platform_private TO neondb_owner WITH GRANT OPTION')
 await f.owner.query("CREATE ROLE srm_private_development_runtime LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS CONNECTION LIMIT 4")
 await f.controlled(async()=>{
  await f.owner.query("UPDATE profitia_access.installation SET project_id='spring-bread-28217539',branch_id='br-sparkling-term-b99l107x' WHERE singleton")
  await f.owner.query("INSERT INTO profitia_access.runtime_bindings VALUES('srm_private_development_runtime','srm','ACTIVE')")
  await f.owner.query(`DO $acl$ DECLARE r record;BEGIN
   FOR r IN SELECT n.nspname FROM pg_namespace n CROSS JOIN LATERAL aclexplode(n.nspacl)a WHERE a.grantee='${f.FOREGROUND}'::regrole AND a.privilege_type='USAGE' AND n.nspowner=current_user::regrole LOOP EXECUTE format('GRANT USAGE ON SCHEMA %I TO srm_private_development_runtime',r.nspname);END LOOP;
   FOR r IN SELECT p.oid::regprocedure signature FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl)a WHERE a.grantee='${f.FOREGROUND}'::regrole AND a.privilege_type='EXECUTE' AND p.proowner=current_user::regrole LOOP EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO srm_private_development_runtime',r.signature);END LOOP;
   END $acl$`)
  await f.owner.query("UPDATE profitia_jobs.operation_bindings SET foreground_role='srm_private_development_runtime',profile_id='PORR_SUITE',configuration_version='srm-native-supplier-e1-v1' WHERE foreground_role=$1 AND operation='supplier.report.refresh'",[f.FOREGROUND])
  await f.owner.query("UPDATE profitia_services.runtime_bindings SET configuration_version='srm-native-supplier-e1-v1' WHERE login_role=$1",[f.EXECUTOR])
 })
 const sql=fs.readFileSync(new URL(reportAdmissionSchemaUrl),'utf8')
 await f.owner.query('GRANT CREATE ON DATABASE platform_private TO profitia_access_owner')
 await f.controlled(async()=>{
  await f.owner.query(sql)
  await f.owner.query("INSERT INTO profitia_report_admission.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",[f.hash(sql)])
 })
 await f.owner.query('REVOKE CREATE ON DATABASE platform_private FROM profitia_access_owner')
 const unchanged=async()=>f.hash(JSON.stringify((await f.owner.query(`SELECT
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM profitia_access.accounts t) accounts,
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM profitia_access.permission_grants t) permissions,
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM profitia_access.product_grants t) products,
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM profitia_access.memberships t) memberships,
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM profitia_ingestion.budgets t) source_budgets,
  (SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) FROM profitia_external_call.policies t) external_policies`)).rows[0]))
 const before=await unchanged(),plan=pilot2HumanInstallationPlan('a'.repeat(40),{operatorMembership:'EXISTING'})
 const operator=new pg.Client({connectionString:operatorUrl.toString()});await operator.connect()
 const logins=[]
 try{
  // Execute the exact guarded SQL in the isolated database. The live apply
  // wrapper's separate physical-host rejection is covered by its unit test.
  await operator.query('BEGIN')
  try{
   for(const sql of plan.beforeCredentials)await operator.query(sql)
   for(const role of plan.roles)await operator.query(`ALTER ROLE ${role} PASSWORD 'isolated_ci_only'`)
   for(const sql of plan.afterCredentials)await operator.query(sql)
   await operator.query('COMMIT')
  }catch(error){await operator.query('ROLLBACK');throw error}
  for(const role of plan.roles){
   const url=new URL(operatorUrl);url.username=role;url.password='isolated_ci_only'
   const client=new pg.Client({connectionString:url.toString()});await client.connect();logins.push(client)
   const flags=(await client.query('SELECT current_user role,r.rolsuper,r.rolbypassrls,r.rolinherit,r.rolcreatedb,r.rolcreaterole FROM pg_roles r WHERE r.rolname=current_user')).rows[0]
   assert.deepEqual(flags,{role,rolsuper:false,rolbypassrls:false,rolinherit:false,rolcreatedb:false,rolcreaterole:false})
   const descriptor=(await client.query('SELECT profitia_access.runtime_descriptor() d')).rows[0].d
   assert.equal(descriptor.projectId,'spring-bread-28217539');assert.equal(descriptor.branchId,'br-sparkling-term-b99l107x')
   assert.equal(descriptor.role,role)
   await assert.rejects(client.query('SET ROLE profitia_access_owner'),e=>e.code==='42501')
   await assert.rejects(client.query('SELECT * FROM profitia_access.accounts'),e=>e.code==='42501')
  }
  assert.equal(await unchanged(),before,'No account, entitlement, membership, quota or existing external policy changed')
  assert.equal((await operator.query("SELECT pg_has_role(current_user,'profitia_access_owner','MEMBER') m,pg_has_role(current_user,'profitia_access_owner','SET') s")).rows[0].m,true)
  assert.equal((await f.owner.query("SELECT count(*)::int n FROM pg_auth_members WHERE member='srm_pilot2_jobs'::regrole")).rows[0].n,0)
  assert.equal((await f.owner.query("SELECT count(*)::int n FROM profitia_jobs.execution_grants WHERE login_role='srm_pilot2_jobs' AND effect='ALLOW'")).rows[0].n>0,true)
 }finally{
  for(const client of logins)await client.end()
  await operator.end()
  if(oldOperator&&!oldOperator.rolbypassrls)await f.owner.query('ALTER ROLE neondb_owner NOBYPASSRLS')
 }
},{databaseName:'platform_private'}))
