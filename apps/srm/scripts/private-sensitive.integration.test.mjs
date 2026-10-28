import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash,randomUUID} from 'node:crypto'
import test from 'node:test'
import pg from 'pg'
import {assertIsolatedTestConnection} from '../../architecture-lab/src/operation-postgres-fixture.mjs'
import {privateBusinessPlan} from '../db/private-store/initialize.mjs'
const HUMAN='srm_sensitive_human',EXECUTOR='srm_sensitive_executor'
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',U='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ISSUER='https://identity.fixture.test',NIP='8650004194'
const hash=v=>createHash('sha256').update(v).digest('hex'),future=()=>new Date(Date.now()+3600000).toISOString()
const core=n=>fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/access/'+n,import.meta.url),'utf8')
const own=n=>fs.readFileSync(new URL('../db/private-store/'+n,import.meta.url),'utf8')

test('native sensitive installation preserves the legacy source and admits only an empty disabled private store',async t=>{
 const database='srm_sensitive_'+randomUUID().replaceAll('-','')
 const url=assertIsolatedTestConnection(process.env.SRM_OPERATION_TEST_OWNER_URL,'srm_app','architecture_test_owner')
 const root=new pg.Client({connectionString:url});await root.connect();let owner
 try{
  assert.equal((await root.query('SELECT 1 FROM pg_database WHERE datname=$1',[database])).rowCount,0)
  await root.query(`CREATE DATABASE ${database}`)
  await root.query('BEGIN;SELECT pg_advisory_xact_lock(170001,20261017)')
  for(const[role,login]of[['profitia_access_owner',false],['srm_app_runtime',true],['neon_superuser',false],[HUMAN,true],[EXECUTOR,true]]){
   if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)
    await root.query(`CREATE ROLE ${role} ${login?"LOGIN PASSWORD 'isolated_ci_only'":'NOLOGIN'} NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`)
   const actual=(await root.query('SELECT rolcanlogin,rolsuper,rolbypassrls,rolinherit FROM pg_roles WHERE rolname=$1',[role])).rows[0]
   assert.equal(actual.rolcanlogin,login);assert.equal(actual.rolsuper,false);assert.equal(actual.rolbypassrls,false)
   if(role!=='neon_superuser')assert.equal(actual.rolinherit,false)
  }
  await root.query(`ALTER ROLE ${HUMAN} CONNECTION LIMIT 4;ALTER ROLE ${EXECUTOR} CONNECTION LIMIT 4;COMMIT`)
  const selected=new URL(url);selected.pathname='/'+database;owner=new pg.Client({connectionString:selected.toString()});await owner.connect()
  await owner.query(`REVOKE ALL ON DATABASE ${database} FROM PUBLIC;GRANT CONNECT ON DATABASE ${database} TO ${HUMAN},${EXECUTOR};GRANT CREATE ON DATABASE ${database} TO profitia_access_owner`)
  const controlled=async action=>{await owner.query('BEGIN;SET LOCAL ROLE profitia_access_owner');try{const v=await action();await owner.query('COMMIT');return v}catch(e){await owner.query('ROLLBACK');throw e}}
  const sources=[['001-internal-access.sql','profitia_access.installation'],['002-module-scope.sql','profitia_modules.installation'],['003-module-audit.sql','profitia_modules.audit_installation'],['005-service-read.sql','profitia_services.installation'],['006-request-reservation.sql','profitia_requests.installation'],['007-delegated-jobs.sql','profitia_jobs.installation'],['010-external-request-admission.sql','profitia_requests.external_installation'],['011-request-continuation.sql','profitia_request_phases.installation'],['013-supplier-delegation.sql','profitia_supplier_jobs.installation'],['014-delegated-private-phases.sql','profitia_delegated_phases.installation'],['015-delegated-private-inspection.sql','profitia_request_inspection.installation'],['016-delegated-native-work.sql','profitia_request_work.installation']]
  await controlled(async()=>{
   for(const[name,table]of sources){await owner.query(core(name))
    if(name.startsWith('001'))await owner.query(`INSERT INTO ${table}(schema_version,schema_digest,environment,project_id,branch_id,database_name)VALUES('1.0.0',$1,'development','sensitive-project','sensitive-branch',$2)`,[hash(core(name)),database])
    else if(name.startsWith('002'))await owner.query(`INSERT INTO ${table} VALUES(true,'1.0.0',$1)`,[hash(core(name))])
    else await owner.query(`INSERT INTO ${table} VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')`,[hash(core(name))])
   }
   await owner.query("INSERT INTO profitia_access.applications(application_id,status)VALUES('srm','DISABLED'),('srm-jobs','DISABLED')")
   await owner.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status)VALUES($1,'srm','ACTIVE'),($2,'srm-jobs','ACTIVE')",[HUMAN,EXECUTOR])
   await owner.query("INSERT INTO profitia_access.accounts(user_id,status)VALUES($1,'ACTIVE')",[U])
   await owner.query("INSERT INTO profitia_access.external_identities(binding_id,issuer,subject,user_id,status,source_ref,expires_at)VALUES($1,$2,$3,$4,'ACTIVE','SYNTHETIC_ONLY',$5)",[randomUUID(),ISSUER,'external-'+U,U,future()])
   await owner.query("INSERT INTO profitia_modules.application_bindings(application_id,module_id,binding_id,status,source_ref,expires_at)VALUES('srm','supplier_report',$1,'ACTIVE','SYNTHETIC_ONLY',$2)",[randomUUID(),future()])
   for(const org of[A,B]){
    await owner.query("INSERT INTO profitia_access.organisations(organisation_id,status)VALUES($1,'ACTIVE')",[org])
    await owner.query("INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at)VALUES($1,$2,'ACTIVE','SYNTHETIC_ONLY',$3)",[org,U,future()])
    await owner.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at)VALUES('srm',$1,'SUPPLIER_INTELLIGENCE',ARRAY['supplier_report'],'ACTIVE','CONTRACT','SYNTHETIC_ONLY',$2)",[org,future()])
    for(const operation of['supplier.report.refresh','supplier.private.read','supplier.private.reveal','supplier.private.export'])await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature)VALUES($1,'srm',$2,$3,'ALLOW',$4,'supplier_report')",[randomUUID(),org,U,operation])
   }
   await owner.query(own('001-supplier-requests.sql'));await owner.query("INSERT INTO profitia_supplier_requests.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",[hash(own('001-supplier-requests.sql'))])
  })
  await owner.query(`REVOKE CREATE ON DATABASE ${database} FROM profitia_access_owner`)
  await owner.query('BEGIN')
  try{
   for(const statement of privateBusinessPlan({binding:{environment:'development',projectId:'sensitive-project',branchId:'sensitive-branch',databaseName:database,role:HUMAN},sourceSha:'a'.repeat(40)}).sql)await owner.query(statement)
   await owner.query('SET LOCAL ROLE profitia_access_owner')
   for(const[name,table]of[['002-supplier-business-phases.sql','srm.supplier_business_installation'],['003-named-supplier-interest.sql','srm.named_interest_installation'],['006-delegated-supplier-business.sql','srm.delegated_supplier_installation'],['007-supplier-private-inspection.sql','srm.supplier_inspection_installation'],['008-supplier-native-work.sql','srm.supplier_work_installation']]){
    await owner.query(own(name));await owner.query(`INSERT INTO ${table} VALUES(true,'1.0.0',$1,$2)`,[hash(own(name)),'b'.repeat(40)])
   }
   await owner.query('COMMIT')
  }catch(e){await owner.query('ROLLBACK');throw e}
  const extension=own('010-supplier-sensitive-work.sql')
  await t.test('operator login cannot install and no partial table survives',async()=>{
   await owner.query('BEGIN');try{await assert.rejects(owner.query(extension),e=>e.code==='42501')}finally{await owner.query('ROLLBACK')}
   assert.equal((await owner.query("SELECT to_regclass('srm.supplier_sensitive_installation')v")).rows[0].v,null)
  })
  await t.test('a populated global cache is preserved and refuses ownership conversion',async()=>{
   await owner.query("INSERT INTO srm.catalog_kys_reports(nip,entity_type)VALUES($1,'COMPANY')",[NIP])
   try{await assert.rejects(controlled(()=>owner.query(extension)),e=>e.code==='42501'&&/populated/.test(e.message))
    assert.equal((await owner.query('SELECT count(*)::int n FROM srm.catalog_kys_reports')).rows[0].n,1)
    assert.equal((await owner.query("SELECT to_regclass('srm.supplier_sensitive_installation')v")).rows[0].v,null)
   }finally{await owner.query('DELETE FROM srm.catalog_kys_reports WHERE nip=$1',[NIP])}
  })
  await t.test('active applications refuse installation without changing the old function',async()=>{
   const before=(await owner.query("SELECT pg_get_functiondef('srm.current_supplier_work(uuid,uuid,text)'::regprocedure) v")).rows[0].v
   await controlled(()=>owner.query("UPDATE profitia_access.applications SET status='ACTIVE'WHERE application_id='srm'"))
   try{await assert.rejects(controlled(()=>owner.query(extension)),e=>e.code==='42501')}
   finally{await controlled(()=>owner.query("UPDATE profitia_access.applications SET status='DISABLED'WHERE application_id='srm'"))}
   assert.equal((await owner.query("SELECT pg_get_functiondef('srm.current_supplier_work(uuid,uuid,text)'::regprocedure)v")).rows[0].v,before)
  })
  await t.test('valid atomic installation retains FORCE RLS and the original ledger',async()=>{
   await controlled(async()=>{await owner.query(extension);await owner.query("INSERT INTO srm.supplier_sensitive_installation VALUES(true,'1.0.0',$1,$2)",[hash(extension),'c'.repeat(40)])})
   const rows=(await owner.query("SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,r.rolname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner WHERE n.nspname='srm'AND c.relname=ANY($1::text[])ORDER BY c.relname",[['catalog_kys_reports','section_projections','source_snapshots','supplier_sensitive_installation']])).rows
   assert.equal(rows.length,4);for(const row of rows){assert.equal(row.relrowsecurity,true);assert.equal(row.relforcerowsecurity,true);assert.equal(row.rolname,'profitia_access_owner')}
   assert.equal((await owner.query('SELECT count(*)::int n FROM srm.schema_migrations')).rows[0].n,18)
   const pk=(await owner.query("SELECT pg_get_constraintdef(oid)v FROM pg_constraint WHERE conrelid='srm.catalog_kys_reports'::regclass AND contype='p'")).rows[0].v
   assert.equal(pk,'PRIMARY KEY (organization_id, nip, entity_type)')
  })
 }finally{
  await owner?.end();await root.query(`DROP DATABASE IF EXISTS ${database} WITH(FORCE)`);await root.end()
 }
})

import http from 'node:http'
import {createSrmSupplierApi} from '../src/server/supplier-api-composition.ts'
import {createPilot2PrivateRoutes} from '../src/server/pilot2-private-runtime.ts'
import {createSrmSupplierOperationHandler} from '../src/server/supplier-acquisition-http.ts'
import {createSrmNativeCompanyLookup} from '../src/server/supplier-native-company.ts'
import {srmProviderSourcePolicy,SRM_MSR_STORAGE_ORIGIN,SRM_PUBLIC_WEB_SOURCE,createSrmPublicWebSourceTransport} from '../src/server/provider-source-transport.ts'
import {CORPORATE_SOURCE,CORPORATE_PUBLICATION_VERSION} from '../src/server/corporate-source-store.ts'
import {OPERATION_CONTRACT,operationPayloadDigest,isOperationDenied} from '@profitia/platform-contracts/operation-context'
import {createDelegatedJobStore} from '@profitia/platform-contracts/delegated-job'
import {createSrmSupplierRequestOperationHost} from '../src/server/private-runtime.ts'
import {createSrmSupplierRequestContinuation} from '../src/server/supplier-request-continuation.ts'
import {createSrmSupplierPrivateStore} from '../src/server/supplier-private-store.ts'
import {createSrmSupplierRequestInspection} from '../src/server/supplier-request-inspection.ts'
import {createSrmSupplierPrivateReader} from '../src/server/supplier-private-reader.ts'
import {createSrmSupplierNativeWork,SUPPLIER_NATIVE_WORK_UNITS,SUPPLIER_SENSITIVE_WORK_UNITS,SUPPLIER_WEB_WORK_UNITS} from '../src/server/supplier-request-work.ts'
import {createSrmSupplierNativeWorkStore} from '../src/server/supplier-native-work-store.ts'
import {bindOrganizationTransaction,withOrganization} from '../src/server/db.ts'
import {persistSupplierRequest,supplierRequestResourceId} from '../src/server/supplier-request-operation.ts'
import {emptyCard} from '../src/demo/fixture.ts'
import {mapMgbiFinancialRecords} from '../src/server/mgbi-financial.ts'
import {mapMgbiGeneralRecords} from '../src/server/mgbi-general.ts'
import {writeSharedCompany} from '../src/server/shared-catalog.ts'
import {enrichMsrFinancial,verifyMsrReceipt} from '../src/server/msr-repository.ts'
import {decodeMsrOriginal,MsrSourceError} from '../src/server/msr-source.ts'
import {createSrmSupplierSourceRequest,SUPPLIER_SOURCE_REQUEST} from '../src/server/supplier-source-request.ts'
import {createSrmSupplierSourceLink} from '../src/server/supplier-source-link.ts'
import {createPlatformIngestionHost} from '@profitia/platform-contracts/platform-ingestion'
import {createSrmNativePgDriver} from '../src/server/native-pg-driver.ts'
import {createSrmNativeSensitiveLookup} from '../src/server/supplier-native-sensitive.ts'
import {privateSupplierRequestResourceId} from '../src/server/supplier-request-operation.ts'
import {createSrmSensitiveNativeStore} from '../src/server/supplier-native-sensitive-store.ts'
import {createSrmSensitiveOperationHost,privateSupplierReportId,privateSupplierExportId,readPrivateSupplier,revealPrivateSupplier,exportPrivateKys} from '../src/server/supplier-sensitive-operation.ts'
import {renderKysPdf} from '../src/server/kys-pdf.ts'
const FOREGROUND=HUMAN,SOURCE='srm_supplier_source_runtime',ORIGIN='http://localhost:3400',OTHER_NIP='5272443955'

async function sensitiveNativeFixture(t,full=true,privateMode=false){
 const requestOperation=privateMode?'supplier.private.refresh':'supplier.report.refresh'
 const DATABASE='srm_sensitive_native_'+randomUUID().replaceAll('-','')
 const rootUrl=assertIsolatedTestConnection(process.env.SRM_OPERATION_TEST_OWNER_URL,'srm_app','architecture_test_owner')
 const root=new pg.Client({connectionString:rootUrl});await root.connect();let owner,pool,auditPool,servicePool,serviceAudit,rawService,sourcePool,sourceAudit,rawSource,corporatePool,corporateAudit,server
 const CORPORATE='srm_company_publication_runtime';let networkHits=0;let currentUser=U,failHumanOutcome=false,revokeAfterPost=false,interruptPost=false,emptyCeidg=false,failedCeidg=false,revokeKrsExport=false,revokeWebRead=false;const networkObservations=[]
 let syntheticOrigin
 try{
  assert.equal((await root.query('SELECT 1 FROM pg_database WHERE datname=$1',[DATABASE])).rowCount,0,'Never adopt existing data')
  await root.query(`CREATE DATABASE ${DATABASE}`)
  await root.query("BEGIN;SELECT pg_advisory_xact_lock(170001,20261017)")
  for(const[role,login]of[['profitia_access_owner',false],['profitia_ingestion_owner',false],['srm_app_runtime',true],['neon_superuser',false],[FOREGROUND,true],[EXECUTOR,true],[SOURCE,true],...(full?[[CORPORATE,true]]:[]) ]){
   if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)await root.query(`CREATE ROLE ${role} ${login?"LOGIN PASSWORD 'isolated_ci_only'":'NOLOGIN'} NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`)
   const flags=(await root.query('SELECT rolsuper,rolbypassrls,rolinherit,rolcanlogin FROM pg_roles WHERE rolname=$1',[role])).rows[0]
   // neon_superuser is only the existing provider-name stub used by other
   // isolated suites. No runtime may inherit it; its own INHERIT flag is not
   // a property of this fixture's actual owner or executor.
   if(role==='neon_superuser')assert.deepEqual({super:flags.rolsuper,bypass:flags.rolbypassrls,login:flags.rolcanlogin},{super:false,bypass:false,login:false})
   else assert.deepEqual(flags,{rolsuper:false,rolbypassrls:false,rolinherit:false,rolcanlogin:login})
  }
  await root.query(`ALTER ROLE ${FOREGROUND} CONNECTION LIMIT 4;ALTER ROLE ${EXECUTOR} CONNECTION LIMIT 4`)
  await root.query('COMMIT');const db=new URL(rootUrl);db.pathname='/'+DATABASE;owner=new pg.Client({connectionString:db.toString()});await owner.connect()
  await owner.query(`REVOKE ALL ON DATABASE ${DATABASE} FROM PUBLIC;GRANT CONNECT ON DATABASE ${DATABASE} TO ${FOREGROUND},${EXECUTOR};GRANT CREATE ON DATABASE ${DATABASE} TO profitia_access_owner`)
  const controlled=async work=>{await owner.query('BEGIN;SET LOCAL ROLE profitia_access_owner');try{const v=await work();await owner.query('COMMIT');return v}catch(e){await owner.query('ROLLBACK');throw e}}
  const sources=[['001-internal-access.sql','profitia_access.installation'],['002-module-scope.sql','profitia_modules.installation'],['003-module-audit.sql','profitia_modules.audit_installation'],['005-service-read.sql','profitia_services.installation'],['006-request-reservation.sql','profitia_requests.installation'],['007-delegated-jobs.sql','profitia_jobs.installation'],['010-external-request-admission.sql','profitia_requests.external_installation'],['011-request-continuation.sql','profitia_request_phases.installation'],['013-supplier-delegation.sql','profitia_supplier_jobs.installation'],['014-delegated-private-phases.sql','profitia_delegated_phases.installation'],['015-delegated-private-inspection.sql','profitia_request_inspection.installation'],['016-delegated-native-work.sql','profitia_request_work.installation']]
  if(privateMode)sources.push(['017-additional-request-operations.sql','profitia_requests.operation_installation'])
  const identity=randomUUID(),bindingId=randomUUID(),serviceId=randomUUID()
  await controlled(async()=>{
   for(const[name,table]of sources){const sql=core(name);await owner.query(sql)
    if(name.startsWith('001'))await owner.query(`INSERT INTO ${table}(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','isolated-srm-service-project','isolated-srm-service-branch',$2)`,[hash(sql),DATABASE])
    else if(name.startsWith('002'))await owner.query(`INSERT INTO ${table} VALUES(true,'1.0.0',$1)`,[hash(sql)])
    else await owner.query(`INSERT INTO ${table} VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')`,[hash(sql)])
   }
   await owner.query("INSERT INTO profitia_access.applications(application_id,status) VALUES('srm','DISABLED'),('srm-jobs','DISABLED')")
   await owner.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES($1,'srm','ACTIVE'),($2,'srm-jobs','ACTIVE')",[FOREGROUND,EXECUTOR])
   await owner.query("INSERT INTO profitia_access.accounts(user_id,status) VALUES($1,'ACTIVE')",[U])
   await owner.query("INSERT INTO profitia_access.external_identities(binding_id,issuer,subject,user_id,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'ACTIVE','SYNTHETIC_ONLY',$5)",[identity,ISSUER,'external-'+U,U,future()])
   await owner.query("INSERT INTO profitia_modules.application_bindings(application_id,module_id,binding_id,status,source_ref,expires_at) VALUES('srm','supplier_report',$1,'ACTIVE','SYNTHETIC_ONLY',$2)",[randomUUID(),future()])
   for(const org of[A,B]){
    await owner.query("INSERT INTO profitia_access.organisations(organisation_id,status) VALUES($1,'ACTIVE')",[org])
    await owner.query("INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at) VALUES($1,$2,'ACTIVE','SYNTHETIC_ONLY',$3)",[org,U,future()])
    await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'srm',$2,$3,'ALLOW','supplier.report.refresh','supplier_report')".replaceAll('supplier.report.refresh',requestOperation),[randomUUID(),org,U])
    await owner.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES('srm',$1,'SUPPLIER_INTELLIGENCE',ARRAY['supplier_report'],'ACTIVE','CONTRACT','SYNTHETIC_ONLY',$2)",[org,future()])
    await owner.query("INSERT INTO profitia_requests.policies(policy_id,application_id,organisation_id,operation,status,source_ref,window_start,window_end,expires_at,capacity) VALUES($1,'srm',$2,'supplier.report.refresh','ACTIVE','SYNTHETIC_ONLY',now()-interval '1 hour',now()+interval '2 hours',$3,50)".replaceAll('supplier.report.refresh',requestOperation),[randomUUID(),org,future()])
   }
   await owner.query("INSERT INTO profitia_services.runtime_bindings(login_role,binding_id,service_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,'PLATFORM_INTERNAL','synthetic-srm-jobs','jobs-v1','ACTIVE','SYNTHETIC_ONLY',$4)",[EXECUTOR,randomUUID(),serviceId,future()])
   await owner.query("INSERT INTO profitia_jobs.operation_bindings(binding_id,application_id,operation,foreground_role,profile_id,configuration_version,executor_application_id,source_id,source_project_id,source_branch_id,source_database_name,source_application_id,source_schema_digest,source_payload_schema,source_quality_version,source_classification_version,delegation_ttl_seconds,max_attempts,status,source_ref,expires_at) VALUES($1,'srm','supplier.report.refresh',$2,'SUPPLIER_INTELLIGENCE_STANDALONE','request-v1','srm-jobs','srm.supplier.source-request','isolated-source-project','isolated-source-branch',$5,'srm-provider-source',$3,'supplier-command-v1','srm-supplier-source-request-v1','srm-supplier-source-request-control-v1',3600,3,'ACTIVE','SYNTHETIC_ONLY',$4)".replaceAll('supplier.report.refresh',requestOperation),[bindingId,FOREGROUND,hash(core('008-platform-ingestion.sql')),future(),DATABASE])
   for(const org of[A,B])await owner.query("INSERT INTO profitia_jobs.execution_grants(grant_id,login_role,binding_id,organisation_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'ALLOW','ACTIVE','SYNTHETIC_ONLY',$5)",[randomUUID(),EXECUTOR,bindingId,org,future()])
   if(privateMode){
    for(const[table,key]of[['profitia_access.permission_grants','grant_id'],['profitia_requests.policies','policy_id']])
     await owner.query(`INSERT INTO ${table} SELECT (jsonb_populate_record(NULL::${table},to_jsonb(x)||jsonb_build_object('${key}',gen_random_uuid(),'operation','supplier.report.refresh'))).* FROM ${table} x WHERE application_id='srm' AND operation='supplier.private.refresh'`)
    const publicBinding=randomUUID()
    await owner.query("INSERT INTO profitia_jobs.operation_bindings SELECT (jsonb_populate_record(NULL::profitia_jobs.operation_bindings,to_jsonb(x)||jsonb_build_object('binding_id',$2::text,'operation','supplier.report.refresh'))).* FROM profitia_jobs.operation_bindings x WHERE binding_id=$1::uuid",[bindingId,publicBinding])
    await owner.query("INSERT INTO profitia_jobs.execution_grants SELECT (jsonb_populate_record(NULL::profitia_jobs.execution_grants,to_jsonb(x)||jsonb_build_object('grant_id',gen_random_uuid(),'binding_id',$2::text))).* FROM profitia_jobs.execution_grants x WHERE binding_id=$1::uuid",[bindingId,publicBinding])
   }
   for(const[i,id]of['REGISTER_LOOKUP','STORE_GENERAL','STORE_FINANCIAL','RECORD_INTEREST'].entries())await owner.query("INSERT INTO profitia_request_phases.policies(application_id,phase_id,sequence,predecessor,operation,effect,status,source_ref,expires_at) VALUES('srm',$1,$2,$3,'supplier.report.refresh','PRIVATE_SQL_PHASE','ACTIVE','SYNTHETIC_ONLY',$4)",[id,i+1,['REGISTER_LOOKUP','STORE_GENERAL','STORE_FINANCIAL'][i-1]??null,future()])
   await owner.query(own('001-supplier-requests.sql'));await owner.query("INSERT INTO profitia_supplier_requests.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",[hash(own('001-supplier-requests.sql'))])
  })
  await owner.query(`REVOKE CREATE ON DATABASE ${DATABASE} FROM profitia_access_owner`)
  async function installSource(){
  await owner.query(`GRANT CREATE ON DATABASE ${DATABASE} TO profitia_ingestion_owner;GRANT CONNECT ON DATABASE ${DATABASE} TO ${SOURCE}${full?','+CORPORATE:''}`)
  await owner.query('BEGIN;SET LOCAL ROLE profitia_ingestion_owner')
  try{
   await owner.query(core('008-platform-ingestion.sql'))
   await owner.query("INSERT INTO profitia_ingestion.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','isolated-source-project','isolated-source-branch',$2)",[hash(core('008-platform-ingestion.sql')),DATABASE])
   await owner.query("INSERT INTO profitia_ingestion.runtime_bindings(login_role,binding_id,service_id,application_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,'srm-provider-source','PLATFORM_INTERNAL','synthetic-supplier-source','source-v1','ACTIVE','SYNTHETIC_ONLY',$4)",[SOURCE,randomUUID(),randomUUID(),future()])
   await owner.query("INSERT INTO profitia_ingestion.sources(source_id,effect_kind,data_class,payload_schema,quality_version,classification_version,projection_version,status,source_ref,expires_at) VALUES($1,'STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE',$2,$3,$4,'source-request-v1','ACTIVE','SYNTHETIC_ONLY',$5)",[...Object.values(SUPPLIER_SOURCE_REQUEST),future()])
   await owner.query("INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,'ALLOW','ACTIVE','SYNTHETIC_ONLY',$4)",[randomUUID(),SOURCE,SUPPLIER_SOURCE_REQUEST.id,future()])
   await owner.query("INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,'srm-provider-source',$2,'SOURCE_TRANSACTION',100,now()-interval '1 hour',now()+interval '2 hours',$3,'ACTIVE','SYNTHETIC_ONLY')",[randomUUID(),SUPPLIER_SOURCE_REQUEST.id,future()])
   await owner.query(own('009-supplier-source-request.sql'))
   await owner.query("INSERT INTO profitia_srm_acquisition.installation VALUES(true,'srm-supplier-source-request-v1',$1,$2,$3)",[hash(own('009-supplier-source-request.sql')),hash(core('008-platform-ingestion.sql')),'f'.repeat(40)])
   await owner.query(`GRANT USAGE ON SCHEMA profitia_ingestion,profitia_srm_acquisition TO ${SOURCE};GRANT EXECUTE ON FUNCTION profitia_ingestion.runtime_descriptor(),profitia_ingestion.current_state(text,text),profitia_ingestion.lock_ingestion(text,text,text),profitia_ingestion.scope_allows(text,text),profitia_ingestion.reserve(text,text,text,text,uuid),profitia_ingestion.complete(uuid,uuid),profitia_ingestion.append_audit(jsonb),profitia_srm_acquisition.runtime_descriptor(),profitia_srm_acquisition.admit(text,uuid,uuid),profitia_srm_acquisition.receipt(text,text) TO ${SOURCE}`)

   if(full){
    await owner.query(core('009-external-call-admission.sql'))
    await owner.query("INSERT INTO profitia_external_call.installation VALUES(true,'1.0.0',$1,$2,'development','isolated-source-project','isolated-source-branch',$3)",[hash(core('009-external-call-admission.sql')),hash(core('008-platform-ingestion.sql')),DATABASE])
    await owner.query(core('012-native-external-transport.sql'));await owner.query("INSERT INTO profitia_external_native.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",[hash(core('012-native-external-transport.sql'))])
    if(privateMode){
     await owner.query("UPDATE profitia_ingestion.runtime_bindings SET status='REVOKED'")
     await owner.query(core('018-public-web-transport.sql'))
     await owner.query("INSERT INTO profitia_public_web.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",[hash(core('018-public-web-transport.sql'))])
     await owner.query("UPDATE profitia_ingestion.runtime_bindings SET status='ACTIVE'")
    }
    const installed=new Set()
    for(const provider of['VERCLY','CEIDG','MGBI','VERCLY_KRS']){
     const policy=srmProviderSourcePolicy(provider)
     if(!installed.has(policy.source.id)){
      await owner.query("INSERT INTO profitia_ingestion.sources(source_id,effect_kind,data_class,payload_schema,quality_version,classification_version,projection_version,status,source_ref,expires_at) VALUES($1,'STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE',$2,$3,$4,'source-receipt-v1','ACTIVE','SYNTHETIC_ONLY',$5)",[...Object.values(policy.source),future()])
      await owner.query("INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,'ALLOW','ACTIVE','SYNTHETIC_ONLY',$4)",[randomUUID(),SOURCE,policy.source.id,future()])
      await owner.query("INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,'srm-provider-source',$2,'SOURCE_TRANSACTION',1000,now()-interval '1 hour',now()+interval '2 hours',$3,'ACTIVE','SYNTHETIC_ONLY')",[randomUUID(),policy.source.id,future()]);installed.add(policy.source.id)
     }
     const id=randomUUID(),msr=false
     await owner.query("INSERT INTO profitia_external_call.policies(policy_id,login_role,source_id,resource_id,configuration_version,origin,transport,path_rules,maximum_request_bytes,maximum_response_bytes,timeout_ms,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,$2,$3,$4,'company-provider-v1',$5,'LOCAL_SYNTHETIC_HTTP',$6::jsonb,8192,1048576,20000,'UPSTREAM_ATTEMPT_ADMISSION',200,now()-interval '1 hour',now()+interval '2 hours',$7,'ACTIVE','SYNTHETIC_ONLY')",[id,SOURCE,policy.source.id,policy.resourceId,syntheticOrigin,JSON.stringify(policy.basePathRules),future()])
     await owner.query("INSERT INTO profitia_external_native.policies(policy_id,base_policy_version,path_rules,redirect_origins,maximum_response_bytes,credential_mode,completion_mode,status,expires_at,source_ref) VALUES($1,1,$2::jsonb,$3::jsonb,$4,$5,'ADMITTED_ATTEMPT_CURRENT_SETTLEMENT','ACTIVE',now()+interval '30 minutes','SYNTHETIC_ONLY')",[id,JSON.stringify(policy.pathRules),JSON.stringify(msr?[SRM_MSR_STORAGE_ORIGIN]:[]),provider==='VERCLY_KRS'?24*1024*1024:msr?20*1024*1024:1024*1024,provider==='MGBI_MSR_STORAGE'?'NONE':'SERVER_HEADERS'])
    }
    await owner.query(`GRANT USAGE ON SCHEMA profitia_external_call,profitia_external_native TO ${SOURCE};GRANT EXECUTE ON FUNCTION profitia_ingestion.receipt(text,text,text,text),profitia_external_call.descriptor(text,text),profitia_external_call.apply_control(uuid,uuid,text),profitia_external_call.read_status(uuid,text,text),profitia_external_native.descriptor(text,text) TO ${SOURCE}`)
    if(privateMode){
     const policy=SRM_PUBLIC_WEB_SOURCE,id=randomUUID()
     await owner.query("INSERT INTO profitia_ingestion.sources(source_id,effect_kind,data_class,payload_schema,quality_version,classification_version,projection_version,status,source_ref,expires_at) VALUES($1,'STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE',$2,$3,$4,'source-receipt-v1','ACTIVE','SYNTHETIC_ONLY',$5)",[...Object.values(policy.source),future()])
     await owner.query("INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,'ALLOW','ACTIVE','SYNTHETIC_ONLY',$4)",[randomUUID(),SOURCE,policy.source.id,future()])
     await owner.query("INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,'srm-provider-source',$2,'SOURCE_TRANSACTION',1000,now()-interval '1 hour',now()+interval '2 hours',$3,'ACTIVE','SYNTHETIC_ONLY')",[randomUUID(),policy.source.id,future()])
     await owner.query("INSERT INTO profitia_external_call.policies(policy_id,login_role,source_id,resource_id,configuration_version,origin,transport,path_rules,maximum_request_bytes,maximum_response_bytes,timeout_ms,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,$2,$3,$4,'company-provider-v1',NULL,'PUBLIC_WEB',$5::jsonb,8192,2000000,8000,'UPSTREAM_ATTEMPT_ADMISSION',200,now()-interval '1 hour',now()+interval '2 hours',$6,'ACTIVE','SYNTHETIC_ONLY')",[id,SOURCE,policy.source.id,policy.resourceId,JSON.stringify(policy.basePathRules),future()])
     await owner.query("INSERT INTO profitia_external_native.policies(policy_id,base_policy_version,path_rules,redirect_origins,maximum_response_bytes,credential_mode,completion_mode,status,expires_at,source_ref) VALUES($1,1,$2::jsonb,'[]',2000000,'NONE','ADMITTED_ATTEMPT_CURRENT_SETTLEMENT','ACTIVE',now()+interval '30 minutes','SYNTHETIC_ONLY')",[id,JSON.stringify(policy.pathRules)])
     await owner.query("INSERT INTO profitia_public_web.policies(policy_id,base_policy_version,maximum_redirects,synthetic_origin,status,expires_at,source_ref) VALUES($1,1,4,$2,'ACTIVE',now()+interval '20 minutes','SYNTHETIC_ONLY')",[id,syntheticOrigin])
     await owner.query(`GRANT USAGE ON SCHEMA profitia_public_web TO ${SOURCE};GRANT EXECUTE ON FUNCTION profitia_public_web.descriptor(text,text) TO ${SOURCE}`)
    }

    await owner.query(own('004-corporate-source.sql'))
    const shapeText=fs.readFileSync(new URL('../src/server/corporate-source-shape.json',import.meta.url),'utf8')
    await owner.query("INSERT INTO profitia_ingestion.runtime_bindings(login_role,binding_id,service_id,application_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,'srm-corporate-source','PLATFORM_INTERNAL','synthetic-company-publication','corporate-v1','ACTIVE','SYNTHETIC_ONLY',$4)",[CORPORATE,randomUUID(),randomUUID(),future()])
    await owner.query("INSERT INTO profitia_ingestion.sources(source_id,effect_kind,data_class,payload_schema,quality_version,classification_version,projection_version,status,source_ref,expires_at) VALUES($1,'STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE',$2,$3,$4,'source-receipt-v1','ACTIVE','SYNTHETIC_ONLY',$5)",[...Object.values(CORPORATE_SOURCE),future()])
    await owner.query("INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,'ALLOW','ACTIVE','SYNTHETIC_ONLY',$4)",[randomUUID(),CORPORATE,CORPORATE_SOURCE.id,future()])
    await owner.query("INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,'srm-corporate-source',$2,'SOURCE_TRANSACTION',1000,now()-interval '1 hour',now()+interval '2 hours',$3,'ACTIVE','SYNTHETIC_ONLY')",[randomUUID(),CORPORATE_SOURCE.id,future()])
    await owner.query('INSERT INTO profitia_srm_catalog.installation(version,schema_digest,field_schema,source_ref) VALUES($1,$2,$3::jsonb,$4)',[CORPORATE_PUBLICATION_VERSION,hash(own('004-corporate-source.sql')+own('005-corporate-source-access.sql')+shapeText),shapeText,'a'.repeat(40)])
    await owner.query(`GRANT USAGE ON SCHEMA profitia_ingestion,profitia_srm_catalog TO ${CORPORATE};GRANT USAGE ON SCHEMA profitia_srm_catalog TO profitia_access_owner;GRANT EXECUTE ON FUNCTION profitia_srm_catalog.scope_allows(text,boolean),profitia_srm_catalog.current_packet(text,boolean),profitia_srm_catalog.known_proof(text,uuid),profitia_srm_catalog.valid_stored_section(text,text,jsonb) TO profitia_access_owner;GRANT EXECUTE ON FUNCTION profitia_srm_catalog.runtime_descriptor(),profitia_srm_catalog.open_publication(uuid,uuid,text),profitia_ingestion.runtime_descriptor(),profitia_ingestion.current_state(text,text),profitia_ingestion.lock_ingestion(text,text,text),profitia_ingestion.scope_allows(text,text),profitia_ingestion.reserve(text,text,text,text,uuid),profitia_ingestion.complete(uuid,uuid),profitia_ingestion.append_audit(jsonb) TO ${CORPORATE}`)
   }
   await owner.query('COMMIT')
  }catch(error){await owner.query('ROLLBACK');throw error}
  await owner.query(`REVOKE CREATE ON DATABASE ${DATABASE} FROM profitia_ingestion_owner`)
  }

  if(full){
   let nextReport=0;const reports=new Map()
   server=http.createServer(async(req,res)=>{
    try{
     networkHits++
     const open=(await owner.query("SELECT usename FROM pg_stat_activity WHERE datname=$1 AND usename=ANY($2::text[])AND state IN('idle in transaction','idle in transaction (aborted)')",[DATABASE,[FOREGROUND,EXECUTOR,SOURCE,CORPORATE]])).rows
     assert.deepEqual(open,[],'No private/Source SQL transaction during real HTTP')
     networkObservations.push({path:req.url,authorization:req.headers.authorization,openTransactions:open.length})
     const webUrl=new URL(req.url,'http://127.0.0.1')
     if(privateMode&&webUrl.pathname==='/uncertain-web'){assert.equal(req.headers.authorization,undefined);req.socket.destroy();return}
     if(privateMode&&['/','/website-data'].includes(webUrl.pathname)){
      assert.equal(req.headers.authorization,undefined);assert.equal(req.headers.cookie,undefined)
      if(webUrl.pathname==='/'){res.statusCode=307;res.setHeader('location','/website-data#contact');res.end();return}
      if(revokeWebRead)await controlled(()=>owner.query("UPDATE profitia_access.permission_grants SET effect='DENY'WHERE application_id='srm'AND organisation_id=$1 AND operation='supplier.private.read'",[A]))
      res.setHeader('content-type','text/html');res.end('<html><body>Synthetic Native Company, Synthetic Active JDG. NIP:5260250274; NIP:5272443955; NIP:8650004194</body></html>');return
     }
     assert.equal(req.headers.authorization,'Bearer synthetic-native-sensitive-key');res.setHeader('content-type','application/json')
     const url=new URL(req.url,'http://127.0.0.1')
     if(url.pathname==='/api/ceidg/v3/firma'){if(failedCeidg){res.statusCode=503;res.end('{}');return}if(emptyCeidg){res.end(JSON.stringify({firma:[]}));return}const nip=url.searchParams.get('nip');res.end(JSON.stringify({firma:[{id:'synthetic-jdg-'+nip,nazwa:'SYNTHETIC_JDG',status:'AKTYWNY',wlasciciel:{nip,pesel:'12345678901'},adresDzialalnosci:{miasto:'TEST_CITY'}}]}));return}
     if(url.pathname.startsWith('/v1/models/')){
      const nip=url.searchParams.get('identifiers.pl_nip')
      const wp={id:'a'.repeat(24),identifiers:{pl_nip:nip,pl_krs:'0000217580'},content:{current_excerpt:{naglowekA:{},dane:{dzial1:{danePodmiotu:{nazwa:'Synthetic Native Company',formaPrawna:'SA'}}}}}}
      const rdf={id:'b'.repeat(24),identifiers:{pl_nip:nip,pl_krs:'0000217580'},document:{type:'financial_statement',period_from_date:'2025-01-01',period_to_date:'2025-12-31'},files:[],content:{schema:{name:'JednostkaInnaWZlotych'},standardized_fields:{bs:{a_ca_cfy:'300',lae_lapfl_stl_cfy:'200'}}}}
      res.end(JSON.stringify({count:1,results:[url.pathname.includes('wp-record')?wp:rdf]}));return
     }
     if(url.pathname.startsWith('/api/krs/')){
      if(revokeKrsExport)await controlled(()=>owner.query("UPDATE profitia_access.permission_grants SET effect='DENY'WHERE application_id='srm'AND organisation_id=$1 AND operation='supplier.private.export'",[A]))
      res.setHeader('content-type','application/pdf');res.end('%PDF-1.7\nSYNTHETIC_KRS_ONLY');return
     }
     if(req.method==='POST'){
      if(revokeAfterPost)await controlled(()=>owner.query("UPDATE profitia_access.memberships SET status='SUSPENDED'WHERE organisation_id=$1 AND user_id=$2",[A,U]))
      if(interruptPost){res.destroy();return}
      let body='';for await(const chunk of req)body+=chunk
      const value=JSON.parse(body);assert.equal(value.length,1);assert.equal(value[0].Country,'PL')
      const id='syntheticCorrelation'+(++nextReport);reports.set(id,value[0].Id);res.end(JSON.stringify([id]));return
     }
     const id=url.pathname.split('/').at(-1),nip=reports.get(id);assert(nip)
     res.end(JSON.stringify([{Header:{CorrelationId:id,Id:'synthetic-'+id},Body:{IsComplete:true,Entity:{Name:'SYNTHETIC_SENSITIVE_COMPANY',Ids:[{Type:'VatID',Value:'PL'+nip},{Type:'KRS',Value:'0000217580'},{Type:'Regon',Value:'140566233'}],Beneficiaries:{Count:1,Values:[{FullName:'SYNTHETIC_PERSON',Pesel:'12345678901',Source:'CRBR'}]},PepPositions:{Count:0}}}}]))
    }catch(error){res.statusCode=500;res.end('{}');console.error('SYNTHETIC_SENSITIVE_HTTP_FAILURE',error.message)}
   })
   await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)})
   syntheticOrigin='http://127.0.0.1:'+server.address().port
   await installSource()
  }

  await owner.query('BEGIN')
  try{
   const plan=privateBusinessPlan({binding:{environment:'development',projectId:'isolated-srm-service-project',branchId:'isolated-srm-service-branch',databaseName:DATABASE,role:FOREGROUND},sourceSha:'a'.repeat(40)})
   for(const sql of plan.sql)await owner.query(sql)
   await owner.query('INSERT INTO srm.organizations(id,slug) VALUES($1,$2)',[A,'synthetic-sensitive-org-a'])
   await owner.query('SET LOCAL ROLE profitia_access_owner')
   for(const[name,table]of[['002-supplier-business-phases.sql','srm.supplier_business_installation'],['003-named-supplier-interest.sql','srm.named_interest_installation']]){await owner.query(own(name));await owner.query(`INSERT INTO ${table} VALUES(true,'1.0.0',$1,$2)`,[hash(own(name)),'b'.repeat(40)])}

   if(full){
    await owner.query(own('005-corporate-source-access.sql'))
    await owner.query(`GRANT USAGE ON SCHEMA srm TO ${CORPORATE},profitia_ingestion_owner;GRANT SELECT,INSERT,UPDATE ON srm.catalog_companies,srm.catalog_financial_facts,srm.catalog_financial_indicators TO ${CORPORATE};GRANT EXECUTE ON FUNCTION srm.corporate_catalog_scope(text,boolean) TO ${CORPORATE},${FOREGROUND},${EXECUTOR};GRANT EXECUTE ON FUNCTION srm.corporate_publication_complete(text,uuid) TO profitia_ingestion_owner`)
   }
   await t.test('optional business migration refuses wrong ownership and partial installation rolls back',async()=>{
    await owner.query('SAVEPOINT optional_business')
    try{await owner.query(own('006-delegated-supplier-business.sql'));await owner.query('ROLLBACK TO SAVEPOINT optional_business')}
    finally{await owner.query('RELEASE SAVEPOINT optional_business')}
    assert.equal((await owner.query("SELECT to_regclass('srm.delegated_supplier_installation') x")).rows[0].x,null)
   })
   await owner.query(own('006-delegated-supplier-business.sql'));await owner.query("INSERT INTO srm.delegated_supplier_installation VALUES(true,'1.0.0',$1,$2)",[hash(own('006-delegated-supplier-business.sql')),'c'.repeat(40)])
   await t.test('optional inspection installation is atomic and cannot be run by the operator login',async()=>{
    await owner.query('SAVEPOINT inspection_installation')
    await owner.query(own('007-supplier-private-inspection.sql'));await owner.query('ROLLBACK TO SAVEPOINT inspection_installation');await owner.query('RELEASE SAVEPOINT inspection_installation')
    assert.equal((await owner.query("SELECT to_regclass('srm.supplier_inspection_installation') x")).rows[0].x,null)
   })
   await owner.query(own('007-supplier-private-inspection.sql'));await owner.query("INSERT INTO srm.supplier_inspection_installation VALUES(true,'1.0.0',$1,$2)",[hash(own('007-supplier-private-inspection.sql')),'d'.repeat(40)])
   await t.test('native work migration is atomic and preserves the original named/phase definitions on rollback',async()=>{
    const before=(await owner.query("SELECT pg_get_functiondef('srm.supplier_business_phase(uuid,text,uuid,text[])'::regprocedure) value")).rows[0].value
    await owner.query('SAVEPOINT native_work_installation');await owner.query(own('008-supplier-native-work.sql'))
    await owner.query('ROLLBACK TO SAVEPOINT native_work_installation');await owner.query('RELEASE SAVEPOINT native_work_installation')
    assert.equal((await owner.query("SELECT to_regclass('srm.supplier_work_installation') value")).rows[0].value,null)
    assert.equal((await owner.query("SELECT pg_get_functiondef('srm.supplier_business_phase(uuid,text,uuid,text[])'::regprocedure) value")).rows[0].value,before)
   })
   await owner.query(own('008-supplier-native-work.sql'));await owner.query("INSERT INTO srm.supplier_work_installation VALUES(true,'1.0.0',$1,$2)",[hash(own('008-supplier-native-work.sql')),'e'.repeat(40)])
   await owner.query(own('010-supplier-sensitive-work.sql'));await owner.query("INSERT INTO srm.supplier_sensitive_installation VALUES(true,'1.0.0',$1,$2)",[hash(own('010-supplier-sensitive-work.sql')),'f'.repeat(40)])
   if(privateMode){
    await t.test('private acquisition installation is atomic and rollback preserves the exact original work function and command foreign keys',async()=>{
     const before=(await owner.query("SELECT pg_get_functiondef('srm.current_supplier_work(uuid,uuid,text)'::regprocedure) value")).rows[0].value
     const keys=(await owner.query("SELECT count(*)::int n FROM pg_constraint WHERE conrelid='profitia_supplier_requests.commands'::regclass AND contype='f'")).rows[0].n
     await owner.query('SAVEPOINT private_acquisition')
     await owner.query(own('011-supplier-private-acquisition.sql'))
     await owner.query('ROLLBACK TO SAVEPOINT private_acquisition;RELEASE SAVEPOINT private_acquisition')
     assert.equal((await owner.query("SELECT to_regclass('srm.supplier_private_acquisition_installation') x")).rows[0].x,null)
     assert.equal((await owner.query("SELECT count(*)::int n FROM pg_attribute WHERE attrelid='profitia_supplier_requests.commands'::regclass AND attname='request_operation' AND NOT attisdropped")).rows[0].n,0)
     assert.equal((await owner.query("SELECT pg_get_functiondef('srm.current_supplier_work(uuid,uuid,text)'::regprocedure) value")).rows[0].value,before)
     assert.equal((await owner.query("SELECT count(*)::int n FROM pg_constraint WHERE conrelid='profitia_supplier_requests.commands'::regclass AND contype='f'")).rows[0].n,keys)
    })
    await owner.query(own('011-supplier-private-acquisition.sql'));await owner.query("INSERT INTO srm.supplier_private_acquisition_installation VALUES(true,'1.0.0',$1,$2)",[hash(own('011-supplier-private-acquisition.sql')),'1'.repeat(40)])
    await t.test('website installation rollback restores the current work function and never leaves partial cache metadata',async()=>{
     const before=(await owner.query("SELECT pg_get_functiondef('srm.current_supplier_work(uuid,uuid,text)'::regprocedure) value")).rows[0].value
     await owner.query('SAVEPOINT website_installation');await owner.query(own('012-supplier-web-identity.sql'))
     await owner.query('ROLLBACK TO SAVEPOINT website_installation;RELEASE SAVEPOINT website_installation')
     assert.equal((await owner.query("SELECT to_regclass('srm.supplier_web_installation') x")).rows[0].x,null)
     assert.equal((await owner.query("SELECT pg_get_functiondef('srm.current_supplier_work(uuid,uuid,text)'::regprocedure) value")).rows[0].value,before)
    })
    await owner.query(own('012-supplier-web-identity.sql'));await owner.query("INSERT INTO srm.supplier_web_installation VALUES(true,'1.0.0',$1,$2)",[hash(own('012-supplier-web-identity.sql')),'2'.repeat(40)])
    await t.test('inventory adoption accepts the exact current website-era functions and rolls back every replacement atomically',async()=>{
     const before=(await owner.query("SELECT proname,prosrc FROM pg_proc WHERE oid IN('srm.current_supplier_work(uuid,uuid,text)'::regprocedure,'srm.native_supplier_row(text,uuid,uuid,uuid,uuid,text,text,text)'::regprocedure,'srm.supplier_business_phase(uuid,text,uuid,text[])'::regprocedure) ORDER BY proname")).rows
     await owner.query('SAVEPOINT current_inventory_installation');await owner.query(own('023-financial-inventory-work.sql'))
     await owner.query('ROLLBACK TO SAVEPOINT current_inventory_installation;RELEASE SAVEPOINT current_inventory_installation')
     assert.equal((await owner.query("SELECT to_regclass('srm.financial_inventory_installation') x")).rows[0].x,null)
     assert.deepEqual((await owner.query("SELECT proname,prosrc FROM pg_proc WHERE oid IN('srm.current_supplier_work(uuid,uuid,text)'::regprocedure,'srm.native_supplier_row(text,uuid,uuid,uuid,uuid,text,text,text)'::regprocedure,'srm.supplier_business_phase(uuid,text,uuid,text[])'::regprocedure) ORDER BY proname")).rows,before)
    })
    // No executor is registered for the additive inventory purpose here. The
    // complete existing private/JDG/website regression runs after adoption.
    await owner.query(own('023-financial-inventory-work.sql'))
    for(const role of[FOREGROUND,EXECUTOR])await owner.query(`GRANT EXECUTE ON FUNCTION srm.web_installation_descriptor(),srm.web_subject_row(text,uuid,uuid,uuid,text,text),srm.web_human_row(uuid,text,text,uuid,timestamptz),srm.web_cache_scope(uuid,text,text,text),srm.private_web_metadata(uuid,text,text) TO ${role}`)
    await owner.query(`GRANT SELECT ON srm.supplier_web_identity TO ${FOREGROUND};GRANT SELECT,INSERT,UPDATE ON srm.supplier_web_identity TO ${EXECUTOR}`)
    for(const role of[FOREGROUND,EXECUTOR])await owner.query(`GRANT EXECUTE ON FUNCTION profitia_requests.operation_runtime_descriptor() TO ${role}`)
    await owner.query(`GRANT EXECUTE ON FUNCTION srm.private_acquisition_descriptor() TO ${FOREGROUND}`)
   }
   for(const[unit,mode]of Object.entries({...SUPPLIER_NATIVE_WORK_UNITS,...SUPPLIER_SENSITIVE_WORK_UNITS,...(privateMode?SUPPLIER_WEB_WORK_UNITS:{})}))await owner.query("INSERT INTO profitia_request_work.policies(application_id,unit_id,access_mode,status,source_ref,expires_at) VALUES('srm',$1,$2,'ACTIVE','SYNTHETIC_NATIVE_UNIT',$3)",[unit,mode,future()])
   await owner.query(`GRANT USAGE ON SCHEMA profitia_request_work TO ${EXECUTOR};GRANT EXECUTE ON FUNCTION profitia_request_work.descriptor(uuid,text),profitia_request_work.bind_scope(uuid,text,text,uuid,uuid),profitia_request_work.scope_allows(uuid,text,uuid,uuid,text),srm.current_supplier_work(uuid,uuid,text),srm.native_supplier_row(text,uuid,uuid,uuid,uuid,text,text,text) TO ${EXECUTOR};GRANT SELECT,INSERT,UPDATE ON srm.msr_sources,srm.msr_projections TO ${EXECUTOR};GRANT SELECT ON srm.catalog_companies,srm.catalog_financial_facts,srm.catalog_financial_indicators TO ${EXECUTOR}`)
   for(const role of[FOREGROUND,EXECUTOR,...(full?[CORPORATE]:[])])await owner.query(`GRANT EXECUTE ON FUNCTION srm.current_supplier_work(uuid,uuid,text),srm.native_supplier_row(text,uuid,uuid,uuid,uuid,text,text,text) TO ${role}`)
   for(const role of[FOREGROUND,EXECUTOR])await owner.query(`GRANT EXECUTE ON FUNCTION srm.current_supplier_inspection(uuid,uuid,text),srm.inspected_supplier_row(text,uuid,uuid,uuid,uuid,text,text) TO ${role}`)
   await owner.query(`GRANT USAGE ON SCHEMA profitia_request_inspection TO ${EXECUTOR};GRANT EXECUTE ON FUNCTION profitia_request_inspection.descriptor(uuid,text),profitia_request_inspection.bind_scope(uuid,text,text,uuid,uuid),profitia_request_inspection.scope_allows(uuid,text,uuid,uuid) TO ${EXECUTOR};GRANT SELECT ON srm.catalog_kys_reports TO ${EXECUTOR}`)
   await owner.query(`GRANT USAGE ON SCHEMA profitia_access,profitia_modules,profitia_requests,profitia_supplier_requests,profitia_jobs,profitia_request_phases TO ${FOREGROUND};GRANT EXECUTE ON FUNCTION profitia_access.runtime_descriptor(),profitia_access.identity_binding(text,text),profitia_access.lock_access(uuid,uuid,text,text,text),profitia_access.scope_allows(text,uuid,uuid),profitia_access.append_audit(jsonb),profitia_modules.runtime_descriptor(),profitia_modules.bind_scope(text),profitia_modules.scope_allows(text,uuid,uuid),profitia_modules.audit_descriptor(),profitia_requests.runtime_descriptor(),profitia_requests.external_runtime_descriptor(),profitia_requests.scope_allows(text,uuid,uuid,text),profitia_requests.policy(text,uuid,uuid,text),profitia_requests.reserve(text,uuid,uuid,text,text,text,text,uuid,uuid,bigint),profitia_requests.accept(text,uuid,uuid) TO ${FOREGROUND};GRANT EXECUTE ON FUNCTION profitia_jobs.runtime_descriptor(),profitia_jobs.supplier_runtime_descriptor(),profitia_jobs.create_dispatch(uuid,uuid,text),profitia_request_phases.descriptor(text),profitia_request_phases.parent_available(uuid,uuid,uuid,text,text),profitia_request_phases.reserve(uuid,text,text,uuid,bigint),profitia_request_phases.accept(uuid,text,text,uuid,bigint) TO ${FOREGROUND};GRANT SELECT ON profitia_supplier_requests.installation,profitia_requests.intents TO ${FOREGROUND};GRANT SELECT,INSERT ON profitia_supplier_requests.commands TO ${FOREGROUND};GRANT INSERT,UPDATE ON srm.lookup_requests,srm.provider_attempts,srm.source_snapshots,srm.section_projections,srm.financial_facts,srm.mgbi_source_archives TO ${FOREGROUND}`)
   for(const role of[FOREGROUND,EXECUTOR])await owner.query(`GRANT EXECUTE ON FUNCTION srm.supplier_business_descriptor(),srm.named_interest_descriptor(),srm.named_interest_actor(uuid),srm.named_interest_phase(uuid,text),srm.supplier_business_phase(uuid,text,uuid,text[]),srm.delegated_supplier_descriptor(uuid,text),srm.current_delegated_supplier(uuid,uuid,text,text[]),srm.delegated_supplier_row(text,uuid,uuid,uuid,uuid,text,text) TO ${role};GRANT SELECT,INSERT,UPDATE ON srm.users,srm.organization_supplier_interest,srm.user_supplier_interest TO ${role}`)
   await owner.query(`GRANT USAGE ON SCHEMA srm,profitia_access,profitia_services,profitia_jobs,profitia_request_phases,profitia_supplier_requests,profitia_modules,profitia_requests TO ${EXECUTOR};GRANT EXECUTE ON FUNCTION profitia_modules.scope_allows(text,uuid,uuid),profitia_requests.scope_allows(text,uuid,uuid,text) TO ${EXECUTOR};GRANT EXECUTE ON FUNCTION profitia_access.runtime_descriptor(),profitia_services.runtime_descriptor(),profitia_jobs.runtime_descriptor(),profitia_jobs.supplier_runtime_descriptor(),profitia_jobs.current_job(uuid),profitia_jobs.lock_job(uuid,text),profitia_jobs.scope_allows(uuid),profitia_jobs.append_audit(jsonb),profitia_request_phases.delegated_descriptor(uuid,text),profitia_request_phases.delegated_scope_allows(uuid,text,text,uuid,uuid),profitia_request_phases.reserve(uuid,text,text,uuid,bigint),profitia_request_phases.accept(uuid,text,text,uuid,bigint) TO ${EXECUTOR};GRANT SELECT ON profitia_supplier_requests.commands TO ${EXECUTOR};GRANT SELECT,INSERT,UPDATE ON srm.organizations,srm.suppliers,srm.lookup_requests,srm.provider_attempts,srm.source_snapshots,srm.section_projections,srm.financial_facts,srm.mgbi_source_archives,srm.financial_source_documents TO ${EXECUTOR}`)
   for(const role of[FOREGROUND,EXECUTOR])await owner.query(`GRANT EXECUTE ON FUNCTION srm.sensitive_supplier_row(text,uuid,uuid,uuid,uuid,text,text,text),srm.sensitive_cache_scope(uuid,text,text,timestamptz,timestamptz,text),srm.sensitive_installation_descriptor(),srm.sensitive_human_snapshot(uuid,uuid),srm.private_supplier_metadata(uuid,text,text,text,uuid),srm.private_jdg_activity_metadata(uuid,text) TO ${role}`)
   await owner.query(`GRANT INSERT,UPDATE,SELECT ON srm.catalog_kys_reports TO ${EXECUTOR};GRANT DELETE ON srm.source_snapshots,srm.section_projections TO ${EXECUTOR}`)
   for(const org of[A,B])for(const operation of['supplier.private.read','supplier.private.reveal','supplier.private.export'])await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'srm',$2,$3,'ALLOW',$4,'supplier_report')",[randomUUID(),org,U,operation])
   await owner.query('RESET ROLE;COMMIT')
  }catch(e){await owner.query('ROLLBACK');throw e}
  await assert.rejects(owner.query(own('006-delegated-supplier-business.sql')),e=>e.code==='42501')
  await assert.rejects(owner.query(own('007-supplier-private-inspection.sql')),e=>e.code==='42501')
  await owner.query('INSERT INTO srm.organizations(id,slug) VALUES($1,$2)',[B,'synthetic-service-org-1'])
  await owner.query("UPDATE profitia_access.applications SET status='ACTIVE'")
  if(!full)await installSource()
  await owner.query(`GRANT EXECUTE ON FUNCTION profitia_jobs.claim_dispatch(uuid),profitia_jobs.delivery_state(uuid,uuid),profitia_jobs.observe_delivery(uuid,uuid,text,uuid,text,text) TO ${EXECUTOR}`)
  const sourceUrl=new URL(db);sourceUrl.username=SOURCE;sourceUrl.password='isolated_ci_only'
  sourcePool=new pg.Pool({connectionString:sourceUrl.toString(),max:2});sourceAudit=new pg.Pool({connectionString:sourceUrl.toString(),max:1});rawSource=new pg.Client({connectionString:sourceUrl.toString()});await rawSource.connect()
  // Prepared universal catalogue knowledge, not a HUMAN or private-service publication.
  if(!full)for(const nip of[NIP,OTHER_NIP])await owner.query('INSERT INTO srm.catalog_companies(nip) VALUES($1)',[nip])
  const humanUrl=new URL(db);humanUrl.username=FOREGROUND;humanUrl.password='isolated_ci_only';const serviceUrl=new URL(db);serviceUrl.username=EXECUTOR;serviceUrl.password='isolated_ci_only'
  pool=new pg.Pool({connectionString:humanUrl.toString(),max:2});auditPool=new pg.Pool({connectionString:humanUrl.toString(),max:1});servicePool=new pg.Pool({connectionString:serviceUrl.toString(),max:2});serviceAudit=new pg.Pool({connectionString:serviceUrl.toString(),max:1});rawService=new pg.Client({connectionString:serviceUrl.toString()});await rawService.connect()
  assert.deepEqual((await rawService.query('SELECT current_user::text role,session_user::text login')).rows[0],{role:EXECUTOR,login:EXECUTOR})
  let accountActive=true,failOutcome=false,omitOutcome=false,omitIntent=false,failInspectionCommit=false,omitSourceOutcome=false,sourceCommitted=false,failDeliveryCommit=false
  sourcePool.on('connect',client=>{const original=client.query.bind(client);client.query=async(sql,args,...rest)=>{
   if(omitSourceOutcome&&typeof sql==='string'&&sql.includes('profitia_ingestion.append_audit')&&JSON.parse(args[0]).phase==='OUTCOME')return {rows:[{recorded:true}]}
   const result=await original(sql,args,...rest);if(sql==='COMMIT')sourceCommitted=true;return result
  }})
  const traceFailure=(error,sql)=>{console.error('ISOLATED_SQL_FAILURE',JSON.stringify({code:error.code,message:error.message,query:typeof sql==='string'?sql.slice(0,180):'native-query'}));throw error}
  pool.on('connect',client=>{const original=client.query.bind(client);client.query=(sql,args,...rest)=>{if(failHumanOutcome&&typeof sql==='string'&&sql.includes('profitia_access.append_audit')&&JSON.parse(args[0]).phase==='OUTCOME')throw Error('Synthetic private HUMAN OUTCOME failure');return original(sql,args,...rest).catch(error=>traceFailure(error,sql))}})
  servicePool.on('connect',client=>{const original=client.query.bind(client);client.query=(sql,args,...rest)=>{
   if(omitIntent&&typeof sql==='string'&&sql.includes('profitia_jobs.append_audit')&&JSON.parse(args[0]).phase==='INTENT'&&(JSON.parse(args[0]).requestInspection||JSON.parse(args[0]).requestWork))return Promise.resolve({rows:[{recorded:true}]})
   if(failInspectionCommit&&sql==='COMMIT')throw Error('Synthetic actual inspection commit refusal')
   if(failDeliveryCommit&&sourceCommitted&&sql==='COMMIT')throw Error('Synthetic private COMMIT refusal after independent Source commit')
   if(typeof sql==='string'&&sql.includes('profitia_jobs.append_audit')&&JSON.parse(args[0]).phase==='OUTCOME'){
    if(failOutcome)throw Error('Synthetic actual business audit failure')
    if(omitOutcome)return Promise.resolve({rows:[{recorded:true}]})
   }return original(sql,args,...rest).catch(error=>traceFailure(error,sql))
  }})
  const clerk={authenticateRequest:async()=>({status:'signed-in',isAuthenticated:true,toAuth:()=>({isAuthenticated:true,tokenType:'session_token',userId:'external-'+currentUser,sessionId:'session-'+currentUser,actor:null,sessionClaims:{iss:ISSUER,sub:'external-'+currentUser,sid:'session-'+currentUser,azp:ORIGIN,exp:Math.floor(Date.now()/1000)+3600}})}),sessions:{getSession:async id=>({id,userId:'external-'+currentUser,status:'active',actor:null,expireAt:Date.now()+3600000,abandonAt:Date.now()+3600000})},users:{getUser:async id=>({id,banned:!accountActive,locked:false,deprovisioned:false})}}
  const baseBinding={applicationId:'srm',environment:'development',projectId:'isolated-srm-service-project',branchId:'isolated-srm-service-branch',databaseName:DATABASE,role:FOREGROUND,schemaDigest:hash(core('001-internal-access.sql'))}
  const humanOptions={pool,auditPool,clerk,binding:baseBinding,module:{id:'supplier_report',schemaDigest:hash(core('002-module-scope.sql')),auditSchemaDigest:hash(core('003-module-audit.sql'))},identity:{appId:'srm',environment:'development',issuer:ISSUER,authorizedParties:[ORIGIN]},application:{appId:'srm',profileId:'SUPPLIER_INTELLIGENCE_STANDALONE',environment:'development',deploymentId:'synthetic-srm-request',configurationVersion:'request-v1',identityIssuer:ISSUER,organisationId:null,features:['supplier_report'],operations:[requestOperation]},requestLedger:{...(privateMode?{operationSchemaDigest:hash(core('017-additional-request-operations.sql'))}:{}),schemaDigest:hash(core('006-request-reservation.sql')),externalSchemaDigest:hash(core('010-external-request-admission.sql'))},commandBoundaryDigest:hash(own('001-supplier-requests.sql'))}
  const job={schemaDigest:hash(core('007-delegated-jobs.sql')),targetOperation:requestOperation,...(privateMode?{operationSchemaDigest:hash(core('017-additional-request-operations.sql'))}:{}),supplierSchemaDigest:hash(core('013-supplier-delegation.sql'))}
  const privateTarget=(entityType='COMPANY',section='kys')=>({entityType,section,boundaryDigest:hash(own('011-supplier-private-acquisition.sql')),...(section==='web'?{webBoundaryDigest:hash(own('012-supplier-web-identity.sql'))}:{})})
  const requestHost=(entityType='COMPANY',section='kys')=>createSrmSupplierRequestOperationHost({...humanOptions,...(privateMode?{privateAcquisition:privateTarget(entityType,section)}:{})})
  const foreground=requestHost(),jobs=createDelegatedJobStore({binding:baseBinding,...job})
  const parent=async(org=A,nip=NIP,entityType='COMPANY',section='kys')=>{const command={kind:'SUPPLIER_REPORT',nip},key='synthetic-supplier-'+randomUUID()
   const host=privateMode?requestHost(entityType,section):foreground,resourceId=privateMode?privateSupplierRequestResourceId(command,{entityType,section}):supplierRequestResourceId(command)
   const result=await host.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:requestOperation,organisationId:org,resourceId,payload:command,idempotencyKey:key,request:new Request(ORIGIN+'/api/xray/requests',{method:'POST',headers:{origin:ORIGIN}})},async(context,c)=>{const receipt=await persistSupplierRequest(context,c);const dispatch=await jobs.createDispatch(c.query.bind(c),context);assert.equal(dispatch.requestId,receipt.requestId);return receipt})
   assert.equal(result.value.status,202);const receipt=await result.value.json();return{requestId:receipt.requestId,organisationId:org,command,key}
  }
  const serviceOptions={executionMode:'DELEGATED_SERVICE',pool:servicePool,auditPool:serviceAudit,clerk,application:{appId:'srm-jobs',environment:'development',profileId:'PLATFORM_INTERNAL',deploymentId:'synthetic-srm-jobs',configurationVersion:'jobs-v1',identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,features:['job_execution'],operations:['job.execute']},binding:{...baseBinding,applicationId:'srm-jobs',role:EXECUTOR,service:{schemaDigest:hash(core('005-service-read.sql')),profileId:'PLATFORM_INTERNAL',deploymentId:'synthetic-srm-jobs',configurationVersion:'jobs-v1'}},job,continuationSchemaDigest:hash(core('011-request-continuation.sql')),delegatedSchemaDigest:hash(core('014-delegated-private-phases.sql')),commandBoundaryDigest:hash(own('001-supplier-requests.sql')),delegatedBusinessBoundaryDigest:hash(own('006-delegated-supplier-business.sql')),accountIdentity:{environment:'development',issuer:ISSUER}}
  const {executionMode:_unused,...inspectionOptions}=serviceOptions
  const {continuationSchemaDigest:_continuation,delegatedSchemaDigest:_delegated,delegatedBusinessBoundaryDigest:_business,...workOptions}=inspectionOptions
  const nativeWork=createSrmSupplierNativeWork({...workOptions,...(privateMode?{privateAcquisition:privateTarget()}:{}),workSchemaDigest:hash(core('016-delegated-native-work.sql')),workBusinessBoundaryDigest:hash(own('010-supplier-sensitive-work.sql'))})
  const sourceOptions={pool:sourcePool,auditPool:sourceAudit,
   application:{appId:'srm-provider-source',environment:'development',profileId:'PLATFORM_INTERNAL',deploymentId:'synthetic-supplier-source',configurationVersion:'source-v1',identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,features:['knowledge_ingestion'],operations:['knowledge.ingest']},
   binding:{applicationId:'srm-provider-source',environment:'development',projectId:'isolated-source-project',branchId:'isolated-source-branch',databaseName:DATABASE,role:SOURCE,deploymentId:'synthetic-supplier-source',configurationVersion:'source-v1',schemaDigest:hash(core('008-platform-ingestion.sql'))},requestSchemaDigest:hash(own('009-supplier-source-request.sql'))}
  const sourceStore=createSrmSupplierSourceRequest(sourceOptions)
  const selection=p=>({requestId:p.requestId,organisationId:p.organisationId,command:p.command})
  const privateSecret='synthetic-sensitive-private-secret-at-least-32-characters'
  const {requestLedger:_requestLedger,commandBoundaryDigest:_commandBoundary,...privateHumanOptions}=humanOptions
  const human=createSrmSensitiveOperationHost({...privateHumanOptions,application:{...humanOptions.application,operations:['supplier.private.read','supplier.private.reveal','supplier.private.export']},sensitiveBoundaryDigest:hash(own('010-supplier-sensitive-work.sql')),secret:privateSecret})
  const sourceProvider={...sourceOptions,external:{configurationVersion:'company-provider-v1',schemaDigest:hash(core('009-external-call-admission.sql')),nativeSchemaDigest:hash(core('012-native-external-transport.sql')),maximumResponseBytes:1024*1024},syntheticOrigin}
  const native=(entityType='COMPANY',section='kys')=>createSrmNativeSensitiveLookup({work:{...workOptions,...(privateMode?{privateAcquisition:privateTarget(entityType,section)}:{}),workSchemaDigest:hash(core('016-delegated-native-work.sql')),workBusinessBoundaryDigest:hash(own('010-supplier-sensitive-work.sql'))},namedInterestBoundaryDigest:hash(own('003-named-supplier-interest.sql')),source:sourceStore,entityType,section,provider:{apiKey:'synthetic-native-sensitive-key',origin:section==='jdg'?'https://dane.biznes.gov.pl':'https://vercly.fixture.test',source:sourceProvider}})
  const privateInput=(org=A,nip=NIP,entityType='COMPANY',section='kys')=>({nip,entityType,section})
  async function humanRun(operation,payload,org=A,action){
   const resourceId=operation==='supplier.private.read'?privateSupplierReportId(payload):operation==='supplier.private.reveal'?'supplier-private-identifier':privateSupplierExportId(payload.nip,payload.entityType)
   const result=await human.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation,organisationId:org,resourceId,payload,request:new Request(ORIGIN+'/api/xray/private',{method:'POST',headers:{origin:ORIGIN}})},action??((context,client)=>readPrivateSupplier(context,client,privateSecret)))
   return result.value
  }
  let api
  if(privateMode){
   const cpUrl=new URL(db);cpUrl.username=CORPORATE;cpUrl.password='isolated_ci_only'
   corporatePool=new pg.Pool({connectionString:cpUrl.toString(),max:2});corporateAudit=new pg.Pool({connectionString:cpUrl.toString(),max:1})
   const application={...sourceOptions.application,appId:'srm-corporate-source',deploymentId:'synthetic-company-publication',configurationVersion:'corporate-v1'}
   const shapeText=fs.readFileSync(new URL('../src/server/corporate-source-shape.json',import.meta.url),'utf8')
   const {operationSchemaDigest:_extra,...publicLedger}=humanOptions.requestLedger
   const publicJob={schemaDigest:job.schemaDigest,targetOperation:'supplier.report.refresh',supplierSchemaDigest:job.supplierSchemaDigest}
   const flow=(entityType,section)=>({request:{...humanOptions,privateAcquisition:privateTarget(entityType,section)},lookup:{
    work:{...workOptions,privateAcquisition:privateTarget(entityType,section),workSchemaDigest:hash(core('016-delegated-native-work.sql')),workBusinessBoundaryDigest:hash(own('010-supplier-sensitive-work.sql'))},
    namedInterestBoundaryDigest:hash(own('003-named-supplier-interest.sql')),source:sourceStore,entityType,section,
    provider:{apiKey:'synthetic-native-sensitive-key',origin:section==='jdg'?'https://dane.biznes.gov.pl':'https://vercly.fixture.test',source:sourceProvider}}})
   await controlled(async()=>{for(const org of[A,B])await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature)VALUES($1,'srm',$2,$3,'ALLOW','supplier.report.read','supplier_report')",[randomUUID(),org,U])})
   const webFlow=entityType=>({request:{...humanOptions,privateAcquisition:privateTarget(entityType,'web')},lookup:{entityType,
    work:{...workOptions,privateAcquisition:privateTarget(entityType,'web'),workSchemaDigest:hash(core('016-delegated-native-work.sql')),workBusinessBoundaryDigest:hash(own('012-supplier-web-identity.sql'))},
    source:{application:sourceOptions.application,binding:sourceOptions.binding,pool:sourcePool,auditPool:sourceAudit,syntheticOrigin,
     external:{configurationVersion:'company-provider-v1',schemaDigest:hash(core('009-external-call-admission.sql')),nativeSchemaDigest:hash(core('012-native-external-transport.sql')),publicWebSchemaDigest:hash(core('018-public-web-transport.sql'))}}}})
   api=createSrmSupplierApi({company:{request:{...humanOptions,application:{...humanOptions.application,operations:['supplier.report.refresh']},requestLedger:publicLedger},
    lookup:{work:{...workOptions,job:publicJob,workSchemaDigest:hash(core('016-delegated-native-work.sql')),workBusinessBoundaryDigest:hash(own('008-supplier-native-work.sql'))},
     namedInterestBoundaryDigest:hash(own('003-named-supplier-interest.sql')),source:sourceStore,
     corporate:{application,binding:{...sourceOptions.binding,applicationId:application.appId,role:CORPORATE,deploymentId:application.deploymentId,configurationVersion:application.configurationVersion},pool:corporatePool,auditPool:corporateAudit,publicationSchemaDigest:hash(own('004-corporate-source.sql')+own('005-corporate-source-access.sql')+shapeText)},
     mgbi:{apiKey:'synthetic-native-sensitive-key',authScheme:'bearer',source:sourceProvider,msrExternal:{...sourceProvider.external,maximumResponseBytes:20*1024*1024}}},
    read:{...privateHumanOptions,application:{...humanOptions.application,operations:['supplier.report.read']}}},
    companyKys:flow('COMPANY','kys'),jdgKys:flow('JDG','kys'),jdgRegistry:flow('JDG','jdg'),
    web:{company:webFlow('COMPANY'),jdg:webFlow('JDG'),read:{...privateHumanOptions,application:{...humanOptions.application,operations:['supplier.private.read']},webBoundaryDigest:hash(own('012-supplier-web-identity.sql'))}},
    privateRead:{...privateHumanOptions,application:{...humanOptions.application,operations:['supplier.private.read','supplier.private.reveal','supplier.private.export']},sensitiveBoundaryDigest:hash(own('010-supplier-sensitive-work.sql')),secret:privateSecret},
    krs:{apiKey:'synthetic-native-sensitive-key',source:{...sourceOptions,providerOrigin:'https://vercly.fixture.test',syntheticOrigin,external:{...sourceProvider.external,maximumResponseBytes:24*1024*1024}}}})
  }
  let selectedA,kysA,viewA
  if(privateMode){
   await t.test('public corporate admission cannot authorize private native Work, and the private grant is never inferred',async()=>{
    const {operationSchemaDigest:_optional,...ledger}=humanOptions.requestLedger
    const publicHuman=createSrmSupplierRequestOperationHost({...humanOptions,application:{...humanOptions.application,operations:['supplier.report.refresh']},requestLedger:ledger})
    const publicJob={schemaDigest:job.schemaDigest,targetOperation:'supplier.report.refresh',supplierSchemaDigest:job.supplierSchemaDigest}
    const publicJobs=createDelegatedJobStore({binding:baseBinding,...publicJob}),command={kind:'SUPPLIER_REPORT',nip:NIP}
    const admitted=await publicHuman.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'supplier.report.refresh',organisationId:A,resourceId:supplierRequestResourceId(command),payload:command,idempotencyKey:'synthetic-public-only-'+randomUUID(),request:new Request(ORIGIN+'/api/xray/requests',{method:'POST',headers:{origin:ORIGIN}})},async(context,client)=>{
     const value=await persistSupplierRequest(context,client);await publicJobs.createDispatch(client.query.bind(client),context);return value
    })
    const accepted=await admitted.value.json(),before=networkHits
    const publicNative=createSrmNativeSensitiveLookup({work:{...workOptions,job:publicJob,workSchemaDigest:hash(core('016-delegated-native-work.sql')),workBusinessBoundaryDigest:hash(own('010-supplier-sensitive-work.sql'))},namedInterestBoundaryDigest:hash(own('003-named-supplier-interest.sql')),source:sourceStore,entityType:'COMPANY',section:'kys',provider:{apiKey:'synthetic-native-sensitive-key',origin:'https://vercly.fixture.test',source:sourceProvider}})
    await assert.rejects(publicNative.run({requestId:accepted.requestId,organisationId:A,command}),isOperationDenied)
    await controlled(()=>owner.query("UPDATE profitia_access.permission_grants SET effect='DENY' WHERE application_id='srm' AND organisation_id=$1 AND operation='supplier.private.refresh'",[A]))
    try{await assert.rejects(parent(),e=>isOperationDenied(e)&&e.reasonCode==='PERMISSION_DENIED')}
    finally{await controlled(()=>owner.query("UPDATE profitia_access.permission_grants SET effect='ALLOW' WHERE application_id='srm' AND organisation_id=$1 AND operation='supplier.private.refresh'",[A]))}
    assert.equal(networkHits,before)
   })
   await t.test('a JDG section parent cannot be substituted for a COMPANY or KYS acquisition',async()=>{
    const selected=selection(await parent(A,OTHER_NIP,'JDG','jdg')),before=networkHits
    await assert.rejects(native('COMPANY','kys').run(selected),isOperationDenied)
    await assert.rejects(native('JDG','kys').run(selected),isOperationDenied)
    assert.equal(networkHits,before)
   })
  }
  await t.test('ordinary native KYS executes original POST/poll and commits an organization-owned cache and private snapshot',async()=>{
   selectedA=selection(await parent());const before=networkHits;kysA=await native().run(selectedA)
   assert.equal(kysA.status,'SUCCESS');assert(kysA.snapshotId);assert.equal(networkHits,before+2);assert.equal(kysA.replayed,false)
   assert(!JSON.stringify(kysA).includes('12345678901'))
   const row=(await owner.query('SELECT organization_id,nip,lease_owner,report_json FROM srm.catalog_kys_reports')).rows
   assert.equal(row.length,1);assert.equal(row[0].organization_id,A);assert.equal(row[0].nip,NIP);assert.equal(row[0].lease_owner,null);assert(JSON.stringify(row[0].report_json).includes('12345678901'))
   assert(networkObservations.every(x=>x.openTransactions===0))
  })
  await t.test('current human private read masks PESEL, scopes references and records a canonical exact-snapshot audit',async()=>{
   const response=await humanRun('supplier.private.read',privateInput());assert.equal(response.status,200);viewA=await response.json()
   assert.equal(viewA.privateReport.snapshotId,kysA.snapshotId);assert(!JSON.stringify(viewA).includes('12345678901'))
   assert.equal(viewA.section.data.beneficialOwners[0].pesel,null);assert(viewA.section.data.beneficialOwners[0].peselRevealToken)
   const events=(await owner.query("SELECT event FROM profitia_access.security_events WHERE event->>'operation'='supplier.private.read' AND phase='OUTCOME'")).rows
   assert.equal(events.length,1);assert.equal(events[0].event.actorKind,'HUMAN');assert.equal(events[0].event.actorId,U);assert.equal(events[0].event.resourceVersion,kysA.snapshotId)
  })
  await t.test('same request replays without purchasing and a new parent uses the same organization cache',async()=>{
   const before=networkHits;assert.equal((await native().run(selectedA)).replayed,true);assert.equal(networkHits,before)
   const fresh=selection(await parent());const reused=await native().run(fresh);assert.equal(reused.status,'SUCCESS');assert.equal(networkHits,before)
   assert.notEqual(reused.snapshotId,kysA.snapshotId);assert(reused.snapshotId)
   assert.equal((await owner.query('SELECT count(*)::int n FROM srm.catalog_kys_reports')).rows[0].n,1)
  })
  await t.test('another organization has its own cache and cannot use a foreign request or reveal reference',async()=>{
   const before=networkHits;await assert.rejects(native().run({...selectedA,organisationId:B}),isOperationDenied);assert.equal(networkHits,before)
   await assert.rejects(humanRun('supplier.private.read',privateInput(),B),isOperationDenied)
   const token=viewA.section.data.beneficialOwners[0].peselRevealToken
   await assert.rejects(humanRun('supplier.private.reveal',{token},B,(c,client)=>revealPrivateSupplier(c,client,privateSecret)),isOperationDenied)
   const other=await native().run(selection(await parent(B)));assert.equal(other.status,'SUCCESS');assert.equal(networkHits,before+2);assert.notEqual(other.snapshotId,kysA.snapshotId)
   assert.equal((await owner.query('SELECT count(*)::int n FROM srm.catalog_kys_reports')).rows[0].n,2)
  })
  await t.test('explicit reveal uses current human rights and reads only the referenced private snapshot',async()=>{
   const token=viewA.section.data.beneficialOwners[0].peselRevealToken,response=await humanRun('supplier.private.reveal',{token},A,(c,client)=>revealPrivateSupplier(c,client,privateSecret))
   assert.equal(response.status,200);assert.deepEqual(await response.json(),{pesel:'12345678901'})
   await assert.rejects(humanRun('supplier.private.reveal',{token:token+'x'},A,(c,client)=>revealPrivateSupplier(c,client,privateSecret)),isOperationDenied)
  })
  await t.test('current human KYS PDF uses the exact stored snapshot, original renderer, masked identifiers and no provider call',async()=>{
   const before=networkHits,latest=await (await humanRun('supplier.private.read',privateInput())).json()
   let rendered=false
   const payload={nip:NIP,entityType:'COMPANY',retrievedAt:latest.section.retrievedAt,exportRef:latest.privateReport.exportRef}
   const response=await humanRun('supplier.private.export',payload,A,(c,client)=>exportPrivateKys(c,client,privateSecret,async document=>{
    rendered=true;assert(!JSON.stringify(document).includes('12345678901'));return renderKysPdf(document)
   }))
   assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/pdf');assert.equal(response.headers.get('cache-control'),'private, no-store')
   assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0,5).toString(),'%PDF-');assert(rendered);assert.equal(networkHits,before)
  })
  await t.test('direct SQL with no admitted operation returns no private data or cache to either ordinary role',async()=>{
   for(const raw of[rawService])for(const table of['source_snapshots','section_projections','catalog_kys_reports'])assert.equal((await raw.query('SELECT * FROM srm.'+table)).rowCount,0,table)
   const client=await pool.connect();try{
    await client.query('BEGIN');await client.query("SELECT set_config('srm.organization_id',$1,true),set_config('profitia.organisation_id',$1,true),set_config('profitia.user_id',$2,true)",[A,U])
    for(const table of['source_snapshots','section_projections'])assert.equal((await client.query('SELECT * FROM srm.'+table)).rowCount,0)
   }finally{await client.query('ROLLBACK');client.release()}
  })
  await t.test('account, membership, product, explicit read grant and module revocation each prevent private read',async()=>{
   for(const[sql,undo,args]of[
    ["UPDATE profitia_access.memberships SET status='SUSPENDED'WHERE organisation_id=$1 AND user_id=$2","UPDATE profitia_access.memberships SET status='ACTIVE'WHERE organisation_id=$1 AND user_id=$2",[A,U]],
    ["UPDATE profitia_access.permission_grants SET effect='DENY'WHERE organisation_id=$1 AND user_id=$2 AND operation='supplier.private.read'","UPDATE profitia_access.permission_grants SET effect='ALLOW'WHERE organisation_id=$1 AND user_id=$2 AND operation='supplier.private.read'",[A,U]],
    ["UPDATE profitia_access.product_grants SET status='REVOKED'WHERE organisation_id=$1","UPDATE profitia_access.product_grants SET status='ACTIVE'WHERE organisation_id=$1",[A]],
    ["UPDATE profitia_modules.application_bindings SET status='REVOKED'WHERE application_id='srm'","UPDATE profitia_modules.application_bindings SET status='ACTIVE'WHERE application_id='srm'",[]]
   ]){await controlled(()=>owner.query(sql,args));try{await assert.rejects(humanRun('supplier.private.read',privateInput()),isOperationDenied)}finally{await controlled(()=>owner.query(undo,args))}}
   accountActive=false;try{await assert.rejects(humanRun('supplier.private.read',privateInput()),isOperationDenied)}finally{accountActive=true}
  })
  await t.test('JDG runs the original CEIDG client and native writers, and human output masks identity fields',async()=>{
   const selected=selection(await parent(A,OTHER_NIP,'JDG','jdg')),before=networkHits,result=await native('JDG','jdg').run(selected)
   assert.equal(result.status,'SUCCESS');assert(result.snapshotId);assert.equal(networkHits,before+1)
   const response=await humanRun('supplier.private.read',privateInput(A,OTHER_NIP,'JDG','jdg')),view=await response.json()
   assert.equal(view.privateReport.snapshotId,result.snapshotId);assert(!JSON.stringify(view).includes('12345678901'));assert(JSON.stringify(view).includes('TEST_CITY'))
   assert.equal((await native('JDG','jdg').run(selected)).replayed,true);assert.equal(networkHits,before+1)
  })
  if(privateMode)await t.test('CEIDG registration retains supplier identity without requiring unrelated UPDATE policy privileges',async()=>{
   const work=createSrmSupplierNativeWork({...workOptions,privateAcquisition:privateTarget('JDG','jdg'),workSchemaDigest:hash(core('016-delegated-native-work.sql')),workBusinessBoundaryDigest:hash(own('010-supplier-sensitive-work.sql'))})
   const store=createSrmSensitiveNativeStore({work,entityType:'JDG',section:'jdg'})
   let before
   await controlled(async()=>{
    before=(await owner.query('SELECT id,updated_at FROM srm.suppliers WHERE organization_id=$1 AND nip=$2',[A,OTHER_NIP])).rows[0]
    await owner.query("CREATE FUNCTION srm.registration_update_permission() RETURNS boolean LANGUAGE sql STABLE AS 'SELECT true'; REVOKE ALL ON FUNCTION srm.registration_update_permission() FROM PUBLIC")
    await owner.query(`CREATE POLICY registration_update_permission ON srm.suppliers AS RESTRICTIVE FOR UPDATE TO ${EXECUTOR} USING(srm.registration_update_permission()) WITH CHECK(srm.registration_update_permission())`)
   })
   try{
    assert.equal((await owner.query("SELECT has_function_privilege($1,'srm.registration_update_permission()','EXECUTE') allowed",[EXECUTOR])).rows[0].allowed,false)
    const hits=networkHits
    for(const nip of[OTHER_NIP,'5260250274']){
     const selected=selection(await parent(A,nip,'JDG','jdg')),lookup=await store.register(selected)
     assert.equal(lookup.requestId,selected.requestId)
    }
    await controlled(async()=>{
     const after=(await owner.query('SELECT id,updated_at FROM srm.suppliers WHERE organization_id=$1 AND nip=$2',[A,OTHER_NIP])).rows[0]
     assert.deepEqual(after,before)
    })
    assert.equal(networkHits,hits)
   }finally{await controlled(()=>owner.query('DROP POLICY registration_update_permission ON srm.suppliers; DROP FUNCTION srm.registration_update_permission()'))}
  })
  await t.test('original no-data KYS persistence keeps NO_DATA without creating a false snapshot or export authority',async()=>{
   const selected=selection(await parent(A,'5250009335')),store=createSrmSensitiveNativeStore({work:nativeWork,entityType:'COMPANY',section:'kys'})
   const lookup=await store.register(selected),now=new Date().toISOString()
   const empty={status:'EMPTY',source:{provider:'VERCLY',model:'KYS_NIP',recordId:null},retrievedAt:now,effectiveAt:null,warnings:[],data:null}
   const snapshot=await store.storeKys(selected,lookup,empty,null,null,'PROVIDER');assert.equal(snapshot,null)
   assert.equal((await owner.query('SELECT status FROM srm.provider_attempts WHERE request_id=$1',[selected.requestId])).rows[0].status,'NO_DATA')
   assert.equal((await owner.query('SELECT count(*)::int n FROM srm.source_snapshots s JOIN srm.provider_attempts a ON a.id=s.attempt_id WHERE a.request_id=$1',[selected.requestId])).rows[0].n,0)
   await assert.rejects(humanRun('supplier.private.read',privateInput(A,selected.command.nip)),isOperationDenied)
  })
  if(privateMode){
   const http=(route,body,key='synthetic-real-http-'+randomUUID(),org=A)=>createSrmSupplierOperationHandler(route,api,A)(new Request(ORIGIN+'/api/xray/'+route+'?organisationId='+org,{method:'POST',headers:{origin:ORIGIN,'content-type':'application/json','idempotency-key':key},body:JSON.stringify(body)}))
   await t.test('actual company HTTP releases the original classified corporate DTO after a fresh HUMAN read',async()=>{
    const before=networkHits,response=await http('company',{identifier:'5260250274'});assert.equal(response.status,200)
    const body=await response.json();assert.equal(body.identity.nip,'5260250274');assert.equal(body.general.data.legalName,'Synthetic Native Company')
    assert.equal(body.financial.data.indicators.find(i=>i.code==='CURRENT_RATIO').value,'1.500000')
    assert.equal(body.kys.status,'NOT_REQUESTED');assert.equal(body.kys.data,null);assert.equal(body.general.source,undefined);assert(!JSON.stringify(body).includes('12345678901'))
    assert.equal(networkHits,before+2);assert(networkObservations.every(x=>x.openTransactions===0))
   })
   await t.test('actual search classifies unknown NIP but a verified cached company performs no CEIDG or MGBI HTTP',async()=>{
    const before=networkHits;emptyCeidg=true
    let result
    try{result=await http('search',{identifier:'5210087493'})}finally{emptyCeidg=false}
    assert.equal(result.status,200);assert.equal((await result.json()).entityType,'COMPANY');assert.equal(networkHits,before+3)
    const paths=networkObservations.slice(-3).map(x=>x.path);assert(paths[0].startsWith('/api/ceidg/'));assert(paths[1].includes('wp-record'));assert(paths[2].includes('rdf-record'))
    const freshBefore=networkHits,known=await http('search',{identifier:'5260250274'})
    assert.equal(known.status,200);const body=await known.json();assert.equal(body.entityType,'COMPANY');assert.equal(networkHits,freshBefore)
    assert.equal(body.card.identity.nip,'5260250274');assert.equal(body.card.general.data.legalName,'Synthetic Native Company')
    assert.equal(body.card.financial.data.indicators.find(i=>i.code==='CURRENT_RATIO').value,'1.500000')
   })
   await t.test('cached routing still checks current report access and organization membership before provider I/O',async()=>{
    const hits=networkHits
    await controlled(()=>owner.query("UPDATE profitia_access.permission_grants SET effect='DENY'WHERE application_id='srm'AND organisation_id=$1 AND user_id=$2 AND operation='supplier.report.read'",[A,U]))
    try{assert.equal((await http('search',{identifier:'5260250274'})).status,403)}
    finally{await controlled(()=>owner.query("UPDATE profitia_access.permission_grants SET effect='ALLOW'WHERE application_id='srm'AND organisation_id=$1 AND user_id=$2 AND operation='supplier.report.read'",[A,U]))}
    const otherOrg=randomUUID()
    assert.equal((await http('search',{identifier:'5260250274'},undefined,otherOrg)).status,403)
    assert.equal(networkHits,hits)
   })
   await t.test('actual CEIDG provider unavailability is resolved by exact MGBI company evidence, never by the error itself',async()=>{
    const before=networkHits;failedCeidg=true
    let result
    try{result=await http('search',{identifier:'5250009335'})}finally{failedCeidg=false}
    assert.equal(result.status,200);const body=await result.json()
    assert.equal(body.entityType,'COMPANY');assert.equal(body.card.identity.nip,'5250009335')
    const paths=networkObservations.slice(before).map(x=>x.path)
    assert(paths[0].startsWith('/api/ceidg/'))
    assert.equal(paths.filter(x=>x.includes('wp-record')).length,1)
    assert.equal(paths.filter(x=>x.includes('rdf-record')).length,1)
   })
   await t.test('actual protected KYS HTTP composes current HUMAN admission, native original engine and current masked read, and retries do not purchase',async()=>{
    const key='synthetic-http-repeat-'+randomUUID(),before=networkHits
    const first=await http('company-kys',{identifier:NIP},key);assert.equal(first.status,200);const firstBody=await first.json()
    assert.equal(first.headers.get('cache-control'),'private, no-store');assert(firstBody.privateReport.snapshotId);assert(firstBody.privateReport.exportRef)
    assert(!JSON.stringify(firstBody).includes('12345678901'));assert.equal(firstBody.section.data.company.nip,NIP)
    const second=await http('company-kys',{identifier:NIP},key);assert.equal(second.status,200);const secondBody=await second.json()
    assert.equal(firstBody.privateReport.snapshotId,secondBody.privateReport.snapshotId);assert.equal(networkHits,before)
    const token=firstBody.section.data.beneficialOwners[0].peselRevealToken
    const reveal=await http('reveal',{token});assert.equal(reveal.status,200);assert.equal((await reveal.json()).pesel,'12345678901')
    const pdf=await http('pdf',{nip:NIP,entityType:'COMPANY',retrievedAt:firstBody.section.retrievedAt,exportRef:firstBody.privateReport.exportRef})
    assert.equal(pdf.status,200);assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0,5).toString(),'%PDF-');assert.equal(networkHits,before)
   })
   await t.test('actual KRS HTTP uses the exact current private snapshot, one admitted GET and fresh export checks after download',async()=>{
    const read=await http('company-kys',{identifier:NIP}),view=await read.json(),before=networkHits
    const selected={nip:NIP,entityType:'COMPANY',retrievedAt:view.section.retrievedAt,exportRef:view.privateReport.exportRef}
    const response=await http('krs',selected);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/pdf')
    assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0,5).toString(),'%PDF-');assert.equal(networkHits,before+1)
    assert(networkObservations.at(-1).path.startsWith('/api/krs/syntheticCorrelation'));assert(networkObservations.every(x=>x.openTransactions===0))
    const after=networkHits,foreign=await http('krs',selected,undefined,B);assert.equal(foreign.status,409);assert.equal(networkHits,after)
    assert.equal((await http('krs',{...selected,reference:'foreign-reference'})).status,400);assert.equal(networkHits,after)
   })
   await t.test('export revocation during actual KRS download refuses downloaded bytes instead of publishing or retrying',async()=>{
    const view=await(await http('company-kys',{identifier:NIP})).json(),before=networkHits
    const selected={nip:NIP,entityType:'COMPANY',retrievedAt:view.section.retrievedAt,exportRef:view.privateReport.exportRef}
    revokeKrsExport=true
    try{const result=await http('krs',selected);assert.equal(result.status,403);assert(!JSON.stringify(await result.json()).includes('%PDF'));assert.equal(networkHits,before+1)}
    finally{revokeKrsExport=false;await controlled(()=>owner.query("UPDATE profitia_access.permission_grants SET effect='ALLOW'WHERE application_id='srm'AND organisation_id=$1 AND operation='supplier.private.export'",[A]))}
   })
   await t.test('actual JDG HTTP uses its closed private registry target and masks identifiers',async()=>{
    const response=await http('jdg',{identifier:OTHER_NIP});assert.equal(response.status,200);const body=await response.json()
    assert.equal(body.nip,OTHER_NIP);assert.equal(body.section.status,'SUCCESS');assert(body.privateReport.snapshotId);assert.equal(body.privateReport.exportRef,null)
    assert(!JSON.stringify(body).includes('12345678901'))
   })
   await t.test('actual website HTTP reuses original discovery with per-hop Source admission and private durable organization cache',async()=>{
    const before=networkHits,key='synthetic-web-'+randomUUID(),response=await http('web',{identifier:'5260250274',entityType:'COMPANY'},key)
    assert.equal(response.status,200);const body=await response.json();assert.equal(body.status,'FOUND');assert.equal(body.websiteUrl,'https://synthetic.pl/website-data')
    assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(networkHits,before+2)
    const row=(await owner.query("SELECT organization_id,result_version,result_json FROM srm.supplier_web_identity WHERE organization_id=$1 AND nip=$2 AND entity_type='COMPANY'",[A,'5260250274'])).rows[0]
    assert(row.result_version);assert.deepEqual(row.result_json,body);assert.equal(row.organization_id,A)
    const replay=await http('web',{identifier:'5260250274',entityType:'COMPANY'},key);assert.equal(replay.status,200);assert.deepEqual(await replay.json(),body);assert.equal(networkHits,before+2)
    assert(networkObservations.every(x=>x.openTransactions===0))
    const records=(await owner.query("SELECT to_jsonb(x)::text t FROM profitia_external_call.calls x WHERE source_id='srm.provider.public-web'")).rows
    assert.equal(records.length,2);assert(records.every(x=>!x.t.includes('synthetic.pl')&&!x.t.includes('5260250274')))
   })
   await t.test('website private associations do not cross organizations and a retained JDG remains a separate private target',async()=>{
    const before=networkHits,foreign=await http('web',{identifier:'5260250274',entityType:'COMPANY'},undefined,B)
    assert.equal(foreign.status,404);assert.equal((await foreign.json()).status,'NOT_FOUND');assert.equal(networkHits,before)
    const jdg=await http('web',{identifier:OTHER_NIP,entityType:'JDG'});assert.equal(jdg.status,200);assert.equal((await jdg.json()).status,'FOUND')
    const raw=await rawService.query('SELECT result_json FROM srm.supplier_web_identity');assert.equal(raw.rowCount,0)
    const humanClient=await pool.connect();try{const humanRaw=await humanClient.query('SELECT result_json FROM srm.supplier_web_identity');assert.equal(humanRaw.rowCount,0)}finally{humanClient.release()}
    assert.equal((await http('web',{identifier:NIP,entityType:'JDG',organisationId:B})).status,400)
   })
   await t.test('revocation during website HTTP prevents the completed private association from being released',async()=>{
    const beforeCompany=networkHits,company=await http('company',{identifier:NIP});assert.equal(company.status,200)
    const before=networkHits;assert(before>=beforeCompany)
    revokeWebRead=true
    try{const result=await http('web',{identifier:NIP,entityType:'COMPANY'});assert.equal(result.status,403)
     const body=await result.json();assert.equal(body.websiteUrl,undefined);assert.equal(networkHits,before+2)}
    finally{revokeWebRead=false;await controlled(()=>owner.query("UPDATE profitia_access.permission_grants SET effect='ALLOW'WHERE application_id='srm'AND organisation_id=$1 AND operation='supplier.private.read'",[A]))}
    const replay=await http('web',{identifier:NIP,entityType:'COMPANY'});assert.equal(replay.status,200);assert.equal((await replay.json()).status,'FOUND');assert.equal(networkHits,before+2)
   })
   await t.test('a reconstructed public website transport cannot repeat an uncertain logical upstream attempt',async()=>{
    const operationKey=operationPayloadDigest({version:'srm-private-website-v1',requestId:randomUUID()}),before=networkHits
    const options={application:sourceOptions.application,binding:sourceOptions.binding,pool:sourcePool,auditPool:sourceAudit,syntheticOrigin,operationKey,
     external:{configurationVersion:'company-provider-v1',schemaDigest:hash(core('009-external-call-admission.sql')),nativeSchemaDigest:hash(core('012-native-external-transport.sql')),publicWebSchemaDigest:hash(core('018-public-web-transport.sql'))}}
    const unavailable=error=>error?.name==='ExternalCallUnavailable'&&error.retryAllowed===false
    await assert.rejects(createSrmPublicWebSourceTransport(options).fetcher('https://uncertain.example/uncertain-web'),unavailable)
    assert.equal(networkHits,before+1)
    await assert.rejects(createSrmPublicWebSourceTransport(options).fetcher('https://uncertain.example/uncertain-web'),unavailable)
    assert.equal(networkHits,before+1)
   })
   await t.test('physical website RLS or ordinary-role privilege drift refuses the API, while Source cannot read private cache',async()=>{
    await assert.rejects(rawSource.query('SELECT result_json FROM srm.supplier_web_identity'),error=>error.code==='42501')
    await controlled(()=>owner.query('ALTER TABLE srm.supplier_web_identity NO FORCE ROW LEVEL SECURITY'))
    try{assert.equal((await http('web',{identifier:'5260250274',entityType:'COMPANY'})).status,503)}
    finally{await controlled(()=>owner.query('ALTER TABLE srm.supplier_web_identity FORCE ROW LEVEL SECURITY'))}
    await controlled(()=>owner.query(`GRANT TRUNCATE ON srm.supplier_web_identity TO ${FOREGROUND}`))
    try{assert.equal((await http('web',{identifier:'5260250274',entityType:'COMPANY'})).status,503)}
    finally{await controlled(()=>owner.query(`REVOKE TRUNCATE ON srm.supplier_web_identity FROM ${FOREGROUND}`))}
    assert.equal((await http('web',{identifier:'5260250274',entityType:'COMPANY'})).status,200)
   })
   await t.test('website output requires current HUMAN read and audit after the actual discovery',async()=>{
    const before=networkHits
    await controlled(()=>owner.query("UPDATE profitia_access.permission_grants SET effect='DENY'WHERE application_id='srm'AND organisation_id=$1 AND operation='supplier.private.read'",[A]))
    try{assert.equal((await http('web',{identifier:'5260250274',entityType:'COMPANY'})).status,403);assert.equal(networkHits,before)}
    finally{await controlled(()=>owner.query("UPDATE profitia_access.permission_grants SET effect='ALLOW'WHERE application_id='srm'AND organisation_id=$1 AND operation='supplier.private.read'",[A]))}
    failHumanOutcome=true;try{assert.equal((await http('web',{identifier:'5260250274',entityType:'COMPANY'})).status,503);assert.equal(networkHits,before)}finally{failHumanOutcome=false}
   })
   await t.test('actual HTTP refuses current read, tenant, audit and forged body authority without releasing personal output',async()=>{
    for(const[sql,undo,args]of[
     ["UPDATE profitia_access.permission_grants SET effect='DENY'WHERE application_id='srm'AND organisation_id=$1 AND operation='supplier.private.read'","UPDATE profitia_access.permission_grants SET effect='ALLOW'WHERE application_id='srm'AND organisation_id=$1 AND operation='supplier.private.read'",[A]],
     ["UPDATE profitia_access.memberships SET status='SUSPENDED'WHERE organisation_id=$1 AND user_id=$2","UPDATE profitia_access.memberships SET status='ACTIVE'WHERE organisation_id=$1 AND user_id=$2",[A,U]],
    ]){await controlled(()=>owner.query(sql,args));try{const response=await http('company-kys',{identifier:NIP});assert.equal(response.status,403);assert(!JSON.stringify(await response.json()).includes('12345678901'))}finally{await controlled(()=>owner.query(undo,args))}}
    const before=networkHits
    assert.equal((await http('company-kys',{identifier:NIP,userId:U,organisationId:B})).status,400);assert.equal(networkHits,before)
    failHumanOutcome=true;try{assert.equal((await http('company-kys',{identifier:NIP})).status,503)}finally{failHumanOutcome=false}
   })
  }
  const refused=error=>isOperationDenied(error)||!!error?.cause&&refused(error.cause)
  const refusedOrSource=error=>refused(error)||error?.name==='ExternalCallUnavailable'||!!error?.cause&&refusedOrSource(error.cause)
  const workStore=(entityType='COMPANY',section='kys')=>createSrmSensitiveNativeStore({work:nativeWork,entityType,section})
  await t.test('expired sensitive snapshots cannot be read or revealed and retention cleanup removes only the current organization expired payload',async()=>{
   const selected=selection(await parent(A,'5260250274')),store=createSrmSensitiveNativeStore({work:nativeWork,entityType:'COMPANY',section:'kys'}),lookup=await store.register(selected)
   const old=structuredClone((await owner.query('SELECT report_json FROM srm.catalog_kys_reports WHERE organization_id=$1 AND nip=$2',[A,NIP])).rows[0].report_json)
   old.retrievedAt=new Date(Date.now()-8*24*60*60*1000).toISOString();old.data.company.nip=selected.command.nip
   const snapshot=await store.storeKys(selected,lookup,old,null,null,'PROVIDER');assert(snapshot)
   await assert.rejects(humanRun('supplier.private.read',privateInput(A,selected.command.nip)),isOperationDenied)
   const others=(await owner.query('SELECT count(*)::int n FROM srm.source_snapshots WHERE organization_id=$1',[B])).rows[0].n
   await store.purge(selected)
   assert.equal((await owner.query('SELECT id FROM srm.source_snapshots WHERE id=$1',[snapshot])).rowCount,0)
   assert.equal((await owner.query('SELECT count(*)::int n FROM srm.source_snapshots WHERE organization_id=$1',[B])).rows[0].n,others)
   assert.equal((await humanRun('supplier.private.read',privateInput())).status,200)
  })
  await t.test('same organization colleague can read its report but cannot reuse another internal user reveal or export reference',async()=>{
   const colleague='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
   await controlled(async()=>{
    await owner.query("INSERT INTO profitia_access.accounts(user_id,status)VALUES($1,'ACTIVE')",[colleague])
    await owner.query("INSERT INTO profitia_access.external_identities(binding_id,issuer,subject,user_id,status,source_ref,expires_at)VALUES($1,$2,$3,$4,'ACTIVE','SYNTHETIC_ONLY',$5)",[randomUUID(),ISSUER,'external-'+colleague,colleague,future()])
    await owner.query("INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at)VALUES($1,$2,'ACTIVE','SYNTHETIC_ONLY',$3)",[A,colleague,future()])
    for(const op of['supplier.private.read','supplier.private.reveal','supplier.private.export'])await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature)VALUES($1,'srm',$2,$3,'ALLOW',$4,'supplier_report')",[randomUUID(),A,colleague,op])
   })
   currentUser=colleague
   try{
    const ownView=await(await humanRun('supplier.private.read',privateInput())).json();assert(ownView.privateReport.snapshotId)
    const ownToken=ownView.section.data.beneficialOwners[0].peselRevealToken,otherToken=viewA.section.data.beneficialOwners[0].peselRevealToken
    assert.notEqual(ownToken,otherToken)
    await assert.rejects(humanRun('supplier.private.reveal',{token:otherToken},A,(c,client)=>revealPrivateSupplier(c,client,privateSecret)),isOperationDenied)
    assert.equal((await humanRun('supplier.private.reveal',{token:ownToken},A,(c,client)=>revealPrivateSupplier(c,client,privateSecret))).status,200)
    const foreignRef={nip:NIP,entityType:'COMPANY',retrievedAt:viewA.section.retrievedAt,exportRef:viewA.privateReport.exportRef}
    const refusedExport=await humanRun('supplier.private.export',foreignRef,A,(c,client)=>exportPrivateKys(c,client,privateSecret))
    assert.equal(refusedExport.status,409);assert.equal(refusedExport.headers.get('content-type'),'application/json');assert.deepEqual(Object.keys(await refusedExport.json()),['error'])
    assert((await owner.query("SELECT 1 FROM profitia_access.security_events WHERE event->>'actorId'=$1 AND event->>'operation'='supplier.private.export'AND phase='OUTCOME'AND event->>'reasonCode'='SELECTION_UNAVAILABLE'",[colleague])).rowCount>0)
   }finally{currentUser=U}
  })
  await t.test('private query remains scoped to the admitted snapshot even after local SRM org GUC tampering',async()=>{
   let foreignRows=-1
   await humanRun('supplier.private.read',privateInput(),A,async(c,client)=>{
    await client.query("SELECT set_config('srm.organization_id',$1,true)",[B])
    foreignRows=(await client.query('SELECT id FROM srm.source_snapshots WHERE organization_id=$1',[B])).rowCount
    await client.query("SELECT set_config('srm.organization_id',$1,true)",[A])
    return readPrivateSupplier(c,client,privateSecret)
   })
   assert.equal(foreignRows,0)
  })
  await t.test('missing human OUTCOME never releases a constructed private response and preserves an auditable failure',async()=>{
   failHumanOutcome=true;try{await assert.rejects(humanRun('supplier.private.read',privateInput()),e=>isOperationDenied(e)&&e.reasonCode==='AUDIT_UNAVAILABLE')}finally{failHumanOutcome=false}
   assert.equal((await humanRun('supplier.private.read',privateInput())).status,200)
  })
  await t.test('missing physical Service INTENT/OUTCOME and SQL commit failures roll back domain writes',async()=>{
   const selected=selection(await parent(A,'5260250274'))
   const count=async()=>(await owner.query('SELECT count(*)::int n FROM srm.lookup_requests WHERE id=$1',[selected.requestId])).rows[0].n
   for(const mode of['intent','outcome','commit']){
    omitIntent=mode==='intent';failOutcome=mode==='outcome';failInspectionCommit=mode==='commit'
    try{await assert.rejects(workStore().register(selected),refused);assert.equal(await count(),0)}finally{omitIntent=false;failOutcome=false;failInspectionCommit=false}
   }
   assert.equal((await workStore().register(selected)).requestId,selected.requestId)
  })
  await t.test('a disabled sensitive Work purpose and foreign parent parameters refuse before provider I/O',async()=>{
   const selected=selection(await parent(A,'5260250274')),before=networkHits
   await controlled(()=>owner.query("UPDATE profitia_request_work.policies SET status='DISABLED'WHERE application_id='srm'AND unit_id='SRM_SENSITIVE_REPLAY'"))
   try{await assert.rejects(native().run(selected),refused)}finally{await controlled(()=>owner.query("UPDATE profitia_request_work.policies SET status='ACTIVE'WHERE application_id='srm'AND unit_id='SRM_SENSITIVE_REPLAY'"))}
   for(const value of[{...selected,organisationId:B},{...selected,requestId:randomUUID()},{...selected,command:{kind:'SUPPLIER_REPORT',nip:NIP}}])await assert.rejects(workStore().register(value),refused)
   assert.equal(networkHits,before)
  })
  await t.test('proven NOT_SENT source refusal releases the prepaid fence without issuing any HTTP request',async()=>{
   const selected=selection(await parent(A,'5260250274')),before=networkHits
   await owner.query("UPDATE profitia_ingestion.grants SET status='REVOKED'WHERE source_id='srm.provider.vercly'")
   try{await assert.rejects(native().run(selected),refusedOrSource)}finally{await owner.query("UPDATE profitia_ingestion.grants SET status='ACTIVE'WHERE source_id='srm.provider.vercly'")}
   assert.equal(networkHits,before)
   const row=(await owner.query('SELECT lease_owner FROM srm.catalog_kys_reports WHERE organization_id=$1 AND nip=$2',[A,selected.command.nip])).rows[0]
   assert.equal(row.lease_owner,null)
  })
  await t.test('revocation after possible paid POST leaves the committed indefinite fence and prevents another claim',async()=>{
   const selected=selection(await parent(A,'7972088368')),before=networkHits;revokeAfterPost=true
   try{await assert.rejects(native().run(selected),refusedOrSource)}finally{
    revokeAfterPost=false;await controlled(()=>owner.query("UPDATE profitia_access.memberships SET status='ACTIVE'WHERE organisation_id=$1 AND user_id=$2",[A,U]))
   }
   assert.equal(networkHits,before+2)
   const row=(await owner.query('SELECT lease_owner,lease_until::text FROM srm.catalog_kys_reports WHERE organization_id=$1 AND nip=$2',[A,selected.command.nip])).rows[0]
   assert(row.lease_owner);assert.equal(row.lease_until,'infinity')
   const next=selection(await parent(A,selected.command.nip)),store=workStore();await store.register(next)
   assert.equal(await store.cache(next).store.claim(A,selected.command.nip,'COMPANY',new Date()),null);assert.equal(networkHits,before+2)
  })
  await t.test('an interrupted paid HTTP request also remains fenced without a silent retry or second purchase',async()=>{
   const selected=selection(await parent(B,'5272443955')),before=networkHits;interruptPost=true
   try{await assert.rejects(native().run(selected),refusedOrSource)}finally{interruptPost=false}
   assert.equal(networkHits,before+1)
   const row=(await owner.query('SELECT lease_owner,lease_until::text FROM srm.catalog_kys_reports WHERE organization_id=$1 AND nip=$2',[B,selected.command.nip])).rows[0]
   assert(row.lease_owner);assert.equal(row.lease_until,'infinity')
   const next=selection(await parent(B,selected.command.nip)),store=workStore();await store.register(next)
   assert.equal(await store.cache(next).store.claim(B,selected.command.nip,'COMPANY',new Date()),null);assert.equal(networkHits,before+1)
  })
  if(privateMode)await t.test('PILOT2 private entrance preserves current HUMAN checks, original cached KYS and revocation without provider I/O',async()=>{
   const route=createPilot2PrivateRoutes(api,A,()=>true),before=networkHits;
   const request=(headers={})=>new Request(ORIGIN+'/api/xray/kys',{method:'POST',headers:{origin:ORIGIN,'content-type':'application/json','idempotency-key':randomUUID(),...headers},body:JSON.stringify({identifier:NIP})});
   let reads=0;const original=clerk.users.getUser;clerk.users.getUser=async(...args)=>{reads++;return original(...args)};
   try{
    const response=await route('company-kys',request());assert.equal(response.status,200);assert.equal((await response.json()).section.status,'SUCCESS');assert(reads>0);
    assert.throws(()=>route('company-kys',request({'X-SRM-Report-Admission':'company-only'})));
    accountActive=false;try{assert.equal((await route('company-kys',request())).status,401)}finally{accountActive=true}
    assert.equal(networkHits,before);
   }finally{clerk.users.getUser=original}
  })
 }finally{if(server)await new Promise(resolve=>server.close(resolve));await corporatePool?.end();await corporateAudit?.end();await pool?.end();await auditPool?.end();await servicePool?.end();await serviceAudit?.end();await rawService?.end();await sourcePool?.end();await sourceAudit?.end();await rawSource?.end();await owner?.end();await root.query(`DROP DATABASE IF EXISTS ${DATABASE} WITH(FORCE)`);await root.end()}
}
test('real ordinary-role native KYS/JDG, private human output and refusal across access boundaries',t=>sensitiveNativeFixture(t))

test('explicit private acquisition reuses original ordinary-role KYS JDG and current HUMAN output end to end',t=>sensitiveNativeFixture(t,true,true))
