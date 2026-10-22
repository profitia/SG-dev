import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash,randomUUID} from 'node:crypto'
import test from 'node:test'
import pg from 'pg'
import http from 'node:http'
import {createSrmNativeCompanyLookup} from '../src/server/supplier-native-company.ts'
import {srmProviderSourcePolicy,SRM_MSR_STORAGE_ORIGIN} from '../src/server/provider-source-transport.ts'
import {CORPORATE_SOURCE,CORPORATE_PUBLICATION_VERSION} from '../src/server/corporate-source-store.ts'
import {assertIsolatedTestConnection} from '../../architecture-lab/src/operation-postgres-fixture.mjs'
import {OPERATION_CONTRACT,operationPayloadDigest,isOperationDenied} from '@profitia/platform-contracts/operation-context'
import {createDelegatedJobStore} from '@profitia/platform-contracts/delegated-job'
import {privateBusinessPlan} from '../db/private-store/initialize.mjs'
import {createSrmSupplierRequestOperationHost} from '../src/server/private-runtime.ts'
import {createSrmSupplierRequestContinuation} from '../src/server/supplier-request-continuation.ts'
import {createSrmSupplierPrivateStore} from '../src/server/supplier-private-store.ts'
import {createSrmSupplierRequestInspection} from '../src/server/supplier-request-inspection.ts'
import {createSrmSupplierPrivateReader} from '../src/server/supplier-private-reader.ts'
import {createSrmSupplierNativeWork,SUPPLIER_NATIVE_WORK_UNITS} from '../src/server/supplier-request-work.ts'
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
const FOREGROUND='srm_service_business_human',EXECUTOR='srm_service_business_executor'
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',U='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ISSUER='https://identity.fixture.test',ORIGIN='http://localhost:3400',NIP='8650004194',OTHER_NIP='5272443955'
const SOURCE='srm_supplier_source_runtime'
const hash=v=>createHash('sha256').update(v).digest('hex'),future=()=>new Date(Date.now()+3600000).toISOString()
const core=name=>fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/access/'+name,import.meta.url),'utf8')
const own=name=>fs.readFileSync(new URL('../db/private-store/'+name,import.meta.url),'utf8')

async function supplierBusinessFixture(t,full=false){
 const DATABASE='srm_service_business_'+randomUUID().replaceAll('-','')
 const rootUrl=assertIsolatedTestConnection(process.env.SRM_OPERATION_TEST_OWNER_URL,'srm_app','architecture_test_owner')
 const root=new pg.Client({connectionString:rootUrl});await root.connect();let owner,pool,auditPool,servicePool,serviceAudit,rawService,sourcePool,sourceAudit,rawSource,corporatePool,corporateAudit,server
 const CORPORATE='srm_company_publication_runtime';let networkHits=0;const networkObservations=[]
 let syntheticOrigin
 let fileMode=false,failFile=false,fileHits=0,limitsHits=0
 const licensedXml='<html xmlns="http://www.w3.org/1999/xhtml" xmlns:ix="http://www.xbrl.org/2013/inlineXBRL" xmlns:x="http://www.xbrl.org/2003/instance" xmlns:f="https://xbrl.ifrs.org/taxonomy/2022-03-24/ifrs-full" xmlns:iso="http://www.xbrl.org/2003/iso4217"><body><ix:resources><x:context id="c"><x:entity><x:identifier scheme="lei">ISSUER</x:identifier></x:entity><x:period><x:startDate>2025-01-01</x:startDate><x:endDate>2025-12-31</x:endDate></x:period></x:context><x:unit id="u"><x:measure>iso:PLN</x:measure></x:unit></ix:resources><ix:nonFraction name="f:Revenue" contextRef="c" unitRef="u">123</ix:nonFraction></body></html>'
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
    await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'srm',$2,$3,'ALLOW','supplier.report.refresh','supplier_report')",[randomUUID(),org,U])
    await owner.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES('srm',$1,'SUPPLIER_INTELLIGENCE',ARRAY['supplier_report'],'ACTIVE','CONTRACT','SYNTHETIC_ONLY',$2)",[org,future()])
    await owner.query("INSERT INTO profitia_requests.policies(policy_id,application_id,organisation_id,operation,status,source_ref,window_start,window_end,expires_at,capacity) VALUES($1,'srm',$2,'supplier.report.refresh','ACTIVE','SYNTHETIC_ONLY',now()-interval '1 hour',now()+interval '2 hours',$3,50)",[randomUUID(),org,future()])
   }
   await owner.query("INSERT INTO profitia_services.runtime_bindings(login_role,binding_id,service_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,'PLATFORM_INTERNAL','synthetic-srm-jobs','jobs-v1','ACTIVE','SYNTHETIC_ONLY',$4)",[EXECUTOR,randomUUID(),serviceId,future()])
   await owner.query("INSERT INTO profitia_jobs.operation_bindings(binding_id,application_id,operation,foreground_role,profile_id,configuration_version,executor_application_id,source_id,source_project_id,source_branch_id,source_database_name,source_application_id,source_schema_digest,source_payload_schema,source_quality_version,source_classification_version,delegation_ttl_seconds,max_attempts,status,source_ref,expires_at) VALUES($1,'srm','supplier.report.refresh',$2,'SUPPLIER_INTELLIGENCE_STANDALONE','request-v1','srm-jobs','srm.supplier.source-request','isolated-source-project','isolated-source-branch',$5,'srm-provider-source',$3,'supplier-command-v1','srm-supplier-source-request-v1','srm-supplier-source-request-control-v1',3600,3,'ACTIVE','SYNTHETIC_ONLY',$4)",[bindingId,FOREGROUND,hash(core('008-platform-ingestion.sql')),future(),DATABASE])
   for(const org of[A,B])await owner.query("INSERT INTO profitia_jobs.execution_grants(grant_id,login_role,binding_id,organisation_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'ALLOW','ACTIVE','SYNTHETIC_ONLY',$5)",[randomUUID(),EXECUTOR,bindingId,org,future()])
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
    const installed=new Set()
    for(const provider of['MGBI','MGBI_MSR_API','MGBI_MSR_STORAGE']){
     const policy=srmProviderSourcePolicy(provider)
     if(!installed.has(policy.source.id)){
      await owner.query("INSERT INTO profitia_ingestion.sources(source_id,effect_kind,data_class,payload_schema,quality_version,classification_version,projection_version,status,source_ref,expires_at) VALUES($1,'STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE',$2,$3,$4,'source-receipt-v1','ACTIVE','SYNTHETIC_ONLY',$5)",[...Object.values(policy.source),future()])
      await owner.query("INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,'ALLOW','ACTIVE','SYNTHETIC_ONLY',$4)",[randomUUID(),SOURCE,policy.source.id,future()])
      await owner.query("INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,'srm-provider-source',$2,'SOURCE_TRANSACTION',1000,now()-interval '1 hour',now()+interval '2 hours',$3,'ACTIVE','SYNTHETIC_ONLY')",[randomUUID(),policy.source.id,future()]);installed.add(policy.source.id)
     }
     const id=randomUUID(),msr=provider!=='MGBI'
     await owner.query("INSERT INTO profitia_external_call.policies(policy_id,login_role,source_id,resource_id,configuration_version,origin,transport,path_rules,maximum_request_bytes,maximum_response_bytes,timeout_ms,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,$2,$3,$4,'company-provider-v1',$5,'LOCAL_SYNTHETIC_HTTP',$6::jsonb,8192,1048576,20000,'UPSTREAM_ATTEMPT_ADMISSION',200,now()-interval '1 hour',now()+interval '2 hours',$7,'ACTIVE','SYNTHETIC_ONLY')",[id,SOURCE,policy.source.id,policy.resourceId,syntheticOrigin,JSON.stringify(policy.basePathRules),future()])
     await owner.query("INSERT INTO profitia_external_native.policies(policy_id,base_policy_version,path_rules,redirect_origins,maximum_response_bytes,credential_mode,completion_mode,status,expires_at,source_ref) VALUES($1,1,$2::jsonb,$3::jsonb,$4,$5,'ADMITTED_ATTEMPT_CURRENT_SETTLEMENT','ACTIVE',now()+interval '30 minutes','SYNTHETIC_ONLY')",[id,JSON.stringify(policy.pathRules),JSON.stringify(msr?[SRM_MSR_STORAGE_ORIGIN]:[]),msr?20*1024*1024:1024*1024,provider==='MGBI_MSR_STORAGE'?'NONE':'SERVER_HEADERS'])
    }
    await owner.query(`GRANT USAGE ON SCHEMA profitia_external_call,profitia_external_native TO ${SOURCE};GRANT EXECUTE ON FUNCTION profitia_ingestion.receipt(text,text,text,text),profitia_external_call.descriptor(text,text),profitia_external_call.apply_control(uuid,uuid,text),profitia_external_call.read_status(uuid,text,text),profitia_external_native.descriptor(text,text) TO ${SOURCE}`)
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
   server=http.createServer(async(req,res)=>{
    try{
     networkHits++
     const open=(await owner.query("SELECT usename FROM pg_stat_activity WHERE datname=$1 AND usename=ANY($2::text[]) AND state IN('idle in transaction','idle in transaction (aborted)')",[DATABASE,[EXECUTOR,SOURCE,CORPORATE]])).rows
     assert.deepEqual(open,[],'No private or Source SQL transaction may stay open during actual network I/O')
     const url=new URL(req.url,'http://127.0.0.1'),nip=url.searchParams.get('identifiers.pl_nip')
     networkObservations.push({path:req.url,authorization:req.headers.authorization,openTransactions:open.length})
     assert.equal(req.headers.authorization,'synthetic-native-company-key')
     if(url.pathname.endsWith('/limits')){limitsHits++;res.setHeader('content-type','application/json');res.end(JSON.stringify({max:{files:10},used:{files:0}}));return}
     if(url.pathname.endsWith('/files/main_document_uri')){fileHits++;if(failFile){res.destroy();return}res.setHeader('content-type','application/xhtml+xml');res.end(licensedXml);return}

     const wp={id:'a'.repeat(24),identifiers:{pl_nip:nip,pl_krs:'0000217580'},content:{current_excerpt:{naglowekA:{},dane:{dzial1:{danePodmiotu:{nazwa:'Synthetic Native Company',formaPrawna:'SA'}}}}}}
     const rdf={id:'b'.repeat(24),identifiers:{pl_nip:nip,pl_krs:'0000217580'},document:{type:'financial_statement',period_from_date:'2025-01-01',period_to_date:'2025-12-31'},files:[],content:{schema:{name:'JednostkaInnaWZlotych'},standardized_fields:{bs:{a_ca_cfy:'300',lae_lapfl_stl_cfy:'200'}}}}
     if(fileMode){rdf.id='c'.repeat(24);rdf.document.is_ias_compliant=true;rdf.content={};rdf.files={main_document:{original:{content_type:'application/xhtml+xml'}}}}
     res.setHeader('content-type','application/json');res.end(JSON.stringify({count:1,results:[url.pathname.includes('wp-record')?wp:rdf]}))
    }catch(error){res.statusCode=500;res.end('{}');console.error('SYNTHETIC_COMPANY_HTTP_FAILURE',error.message)}
   })
   await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)})
   syntheticOrigin='http://127.0.0.1:'+server.address().port
   await installSource()
  }

  await owner.query('BEGIN')
  try{
   const plan=privateBusinessPlan({binding:{environment:'development',projectId:'isolated-srm-service-project',branchId:'isolated-srm-service-branch',databaseName:DATABASE,role:FOREGROUND},sourceSha:'a'.repeat(40)})
   for(const sql of plan.sql)await owner.query(sql)
   // Synthetic pre-existing KYS data is installed before optional write guards,
   // not through a bypass of the read policy being tested.
   await owner.query('INSERT INTO srm.organizations(id,slug) VALUES($1,$2)',[A,'synthetic-service-org-0'])
   const legacySupplier=randomUUID(),legacyLookup=randomUUID(),legacyAttempt=randomUUID(),legacySnapshot=randomUUID()
   await owner.query('INSERT INTO srm.suppliers(organization_id,id,nip) VALUES($1,$2,$3)',[A,legacySupplier,NIP])
   await owner.query("INSERT INTO srm.lookup_requests(organization_id,id,supplier_id,identifier_type,identifier) VALUES($1,$2,$3,'NIP',$4)",[A,legacyLookup,legacySupplier,NIP])
   await owner.query("INSERT INTO srm.provider_attempts(organization_id,id,request_id,section,provider,attempt_no,status,completed_at) VALUES($1,$2,$3,'kys','VERCLY',1,'SUCCESS',now())",[A,legacyAttempt,legacyLookup])
   await owner.query("INSERT INTO srm.source_snapshots(organization_id,id,attempt_id,supplier_id,section,payload_json,payload_sha256,data_class,retrieved_at) VALUES($1,$2,$3,$4,'kys','{}',$5,'KYS_REDACTED',now())",[A,legacySnapshot,legacyAttempt,legacySupplier,'d'.repeat(64)])
   await owner.query("INSERT INTO srm.section_projections(organization_id,supplier_id,snapshot_id,section,projection_version,data_json) VALUES($1,$2,$3,'kys',1,'{}')",[A,legacySupplier,legacySnapshot])
   await owner.query("INSERT INTO srm.catalog_kys_reports(nip,entity_type,report_json,report_sha256,retrieved_at,retention_until) VALUES($1,'COMPANY','{}',$2,now(),now()+interval '1 day')",[NIP,'e'.repeat(64)])
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
   for(const[unit,mode]of Object.entries(SUPPLIER_NATIVE_WORK_UNITS))await owner.query("INSERT INTO profitia_request_work.policies(application_id,unit_id,access_mode,status,source_ref,expires_at) VALUES('srm',$1,$2,'ACTIVE','SYNTHETIC_NATIVE_UNIT',$3)",[unit,mode,future()])
   await owner.query(`GRANT USAGE ON SCHEMA profitia_request_work TO ${EXECUTOR};GRANT EXECUTE ON FUNCTION profitia_request_work.descriptor(uuid,text),profitia_request_work.bind_scope(uuid,text,text,uuid,uuid),profitia_request_work.scope_allows(uuid,text,uuid,uuid,text),srm.current_supplier_work(uuid,uuid,text),srm.native_supplier_row(text,uuid,uuid,uuid,uuid,text,text,text) TO ${EXECUTOR};GRANT SELECT,INSERT,UPDATE ON srm.msr_sources,srm.msr_projections TO ${EXECUTOR};GRANT SELECT ON srm.catalog_companies,srm.catalog_financial_facts,srm.catalog_financial_indicators TO ${EXECUTOR}`)
   for(const role of[FOREGROUND,EXECUTOR,...(full?[CORPORATE]:[])])await owner.query(`GRANT EXECUTE ON FUNCTION srm.current_supplier_work(uuid,uuid,text),srm.native_supplier_row(text,uuid,uuid,uuid,uuid,text,text,text) TO ${role}`)
   for(const role of[FOREGROUND,EXECUTOR])await owner.query(`GRANT EXECUTE ON FUNCTION srm.current_supplier_inspection(uuid,uuid,text),srm.inspected_supplier_row(text,uuid,uuid,uuid,uuid,text,text) TO ${role}`)
   await owner.query(`GRANT USAGE ON SCHEMA profitia_request_inspection TO ${EXECUTOR};GRANT EXECUTE ON FUNCTION profitia_request_inspection.descriptor(uuid,text),profitia_request_inspection.bind_scope(uuid,text,text,uuid,uuid),profitia_request_inspection.scope_allows(uuid,text,uuid,uuid) TO ${EXECUTOR};GRANT SELECT ON srm.catalog_kys_reports TO ${EXECUTOR}`)
   await owner.query(`GRANT USAGE ON SCHEMA profitia_access,profitia_modules,profitia_requests,profitia_supplier_requests,profitia_jobs,profitia_request_phases TO ${FOREGROUND};GRANT EXECUTE ON FUNCTION profitia_access.runtime_descriptor(),profitia_access.identity_binding(text,text),profitia_access.lock_access(uuid,uuid,text,text,text),profitia_access.scope_allows(text,uuid,uuid),profitia_access.append_audit(jsonb),profitia_modules.runtime_descriptor(),profitia_modules.bind_scope(text),profitia_modules.scope_allows(text,uuid,uuid),profitia_modules.audit_descriptor(),profitia_requests.runtime_descriptor(),profitia_requests.external_runtime_descriptor(),profitia_requests.scope_allows(text,uuid,uuid,text),profitia_requests.policy(text,uuid,uuid,text),profitia_requests.reserve(text,uuid,uuid,text,text,text,text,uuid,uuid,bigint),profitia_requests.accept(text,uuid,uuid) TO ${FOREGROUND};GRANT EXECUTE ON FUNCTION profitia_jobs.runtime_descriptor(),profitia_jobs.supplier_runtime_descriptor(),profitia_jobs.create_dispatch(uuid,uuid,text),profitia_request_phases.descriptor(text),profitia_request_phases.parent_available(uuid,uuid,uuid,text,text),profitia_request_phases.reserve(uuid,text,text,uuid,bigint),profitia_request_phases.accept(uuid,text,text,uuid,bigint) TO ${FOREGROUND};GRANT SELECT ON profitia_supplier_requests.installation,profitia_requests.intents TO ${FOREGROUND};GRANT SELECT,INSERT ON profitia_supplier_requests.commands TO ${FOREGROUND};GRANT INSERT,UPDATE ON srm.lookup_requests,srm.provider_attempts,srm.source_snapshots,srm.section_projections,srm.financial_facts,srm.mgbi_source_archives TO ${FOREGROUND}`)
   for(const role of[FOREGROUND,EXECUTOR])await owner.query(`GRANT EXECUTE ON FUNCTION srm.supplier_business_descriptor(),srm.named_interest_descriptor(),srm.named_interest_actor(uuid),srm.named_interest_phase(uuid,text),srm.supplier_business_phase(uuid,text,uuid,text[]),srm.delegated_supplier_descriptor(uuid,text),srm.current_delegated_supplier(uuid,uuid,text,text[]),srm.delegated_supplier_row(text,uuid,uuid,uuid,uuid,text,text) TO ${role};GRANT SELECT,INSERT,UPDATE ON srm.users,srm.organization_supplier_interest,srm.user_supplier_interest TO ${role}`)
   await owner.query(`GRANT USAGE ON SCHEMA srm,profitia_access,profitia_services,profitia_jobs,profitia_request_phases,profitia_supplier_requests,profitia_modules,profitia_requests TO ${EXECUTOR};GRANT EXECUTE ON FUNCTION profitia_modules.scope_allows(text,uuid,uuid),profitia_requests.scope_allows(text,uuid,uuid,text) TO ${EXECUTOR};GRANT EXECUTE ON FUNCTION profitia_access.runtime_descriptor(),profitia_services.runtime_descriptor(),profitia_jobs.runtime_descriptor(),profitia_jobs.supplier_runtime_descriptor(),profitia_jobs.current_job(uuid),profitia_jobs.lock_job(uuid,text),profitia_jobs.scope_allows(uuid),profitia_jobs.append_audit(jsonb),profitia_request_phases.delegated_descriptor(uuid,text),profitia_request_phases.delegated_scope_allows(uuid,text,text,uuid,uuid),profitia_request_phases.reserve(uuid,text,text,uuid,bigint),profitia_request_phases.accept(uuid,text,text,uuid,bigint) TO ${EXECUTOR};GRANT SELECT ON profitia_supplier_requests.commands TO ${EXECUTOR};GRANT SELECT,INSERT,UPDATE ON srm.organizations,srm.suppliers,srm.lookup_requests,srm.provider_attempts,srm.source_snapshots,srm.section_projections,srm.financial_facts,srm.mgbi_source_archives,srm.financial_source_documents TO ${EXECUTOR}`)
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
  pool.on('connect',client=>{const original=client.query.bind(client);client.query=(sql,args,...rest)=>original(sql,args,...rest).catch(error=>traceFailure(error,sql))})
  servicePool.on('connect',client=>{const original=client.query.bind(client);client.query=(sql,args,...rest)=>{
   if(omitIntent&&typeof sql==='string'&&sql.includes('profitia_jobs.append_audit')&&JSON.parse(args[0]).phase==='INTENT'&&(JSON.parse(args[0]).requestInspection||JSON.parse(args[0]).requestWork))return Promise.resolve({rows:[{recorded:true}]})
   if(failInspectionCommit&&sql==='COMMIT')throw Error('Synthetic actual inspection commit refusal')
   if(failDeliveryCommit&&sourceCommitted&&sql==='COMMIT')throw Error('Synthetic private COMMIT refusal after independent Source commit')
   if(typeof sql==='string'&&sql.includes('profitia_jobs.append_audit')&&JSON.parse(args[0]).phase==='OUTCOME'){
    if(failOutcome)throw Error('Synthetic actual business audit failure')
    if(omitOutcome)return Promise.resolve({rows:[{recorded:true}]})
   }return original(sql,args,...rest).catch(error=>traceFailure(error,sql))
  }})
  const clerk={authenticateRequest:async()=>({status:'signed-in',isAuthenticated:true,toAuth:()=>({isAuthenticated:true,tokenType:'session_token',userId:'external-'+U,sessionId:'session-'+U,actor:null,sessionClaims:{iss:ISSUER,sub:'external-'+U,sid:'session-'+U,azp:ORIGIN,exp:Math.floor(Date.now()/1000)+3600}})}),sessions:{getSession:async id=>({id,userId:'external-'+U,status:'active',actor:null,expireAt:Date.now()+3600000,abandonAt:Date.now()+3600000})},users:{getUser:async id=>({id,banned:!accountActive,locked:false,deprovisioned:false})}}
  const baseBinding={applicationId:'srm',environment:'development',projectId:'isolated-srm-service-project',branchId:'isolated-srm-service-branch',databaseName:DATABASE,role:FOREGROUND,schemaDigest:hash(core('001-internal-access.sql'))}
  const humanOptions={pool,auditPool,clerk,binding:baseBinding,module:{id:'supplier_report',schemaDigest:hash(core('002-module-scope.sql')),auditSchemaDigest:hash(core('003-module-audit.sql'))},identity:{appId:'srm',environment:'development',issuer:ISSUER,authorizedParties:[ORIGIN]},application:{appId:'srm',profileId:'SUPPLIER_INTELLIGENCE_STANDALONE',environment:'development',deploymentId:'synthetic-srm-request',configurationVersion:'request-v1',identityIssuer:ISSUER,organisationId:null,features:['supplier_report'],operations:['supplier.report.refresh']},requestLedger:{schemaDigest:hash(core('006-request-reservation.sql')),externalSchemaDigest:hash(core('010-external-request-admission.sql'))},commandBoundaryDigest:hash(own('001-supplier-requests.sql'))}
  const job={schemaDigest:hash(core('007-delegated-jobs.sql')),targetOperation:'supplier.report.refresh',supplierSchemaDigest:hash(core('013-supplier-delegation.sql'))}
  const foreground=createSrmSupplierRequestOperationHost(humanOptions),jobs=createDelegatedJobStore({binding:baseBinding,...job})
  const parent=async(org=A,nip=NIP)=>{const command={kind:'SUPPLIER_REPORT',nip},key='synthetic-supplier-'+randomUUID()
   const result=await foreground.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'supplier.report.refresh',organisationId:org,resourceId:supplierRequestResourceId(command),payload:command,idempotencyKey:key,request:new Request(ORIGIN+'/api/xray/requests',{method:'POST',headers:{origin:ORIGIN}})},async(context,c)=>{const receipt=await persistSupplierRequest(context,c);const dispatch=await jobs.createDispatch(c.query.bind(c),context);assert.equal(dispatch.requestId,receipt.requestId);return receipt})
   assert.equal(result.value.status,202);const receipt=await result.value.json();return{requestId:receipt.requestId,organisationId:org,command,key}
  }
  const serviceOptions={executionMode:'DELEGATED_SERVICE',pool:servicePool,auditPool:serviceAudit,clerk,application:{appId:'srm-jobs',environment:'development',profileId:'PLATFORM_INTERNAL',deploymentId:'synthetic-srm-jobs',configurationVersion:'jobs-v1',identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,features:['job_execution'],operations:['job.execute']},binding:{...baseBinding,applicationId:'srm-jobs',role:EXECUTOR,service:{schemaDigest:hash(core('005-service-read.sql')),profileId:'PLATFORM_INTERNAL',deploymentId:'synthetic-srm-jobs',configurationVersion:'jobs-v1'}},job,continuationSchemaDigest:hash(core('011-request-continuation.sql')),delegatedSchemaDigest:hash(core('014-delegated-private-phases.sql')),commandBoundaryDigest:hash(own('001-supplier-requests.sql')),delegatedBusinessBoundaryDigest:hash(own('006-delegated-supplier-business.sql')),accountIdentity:{environment:'development',issuer:ISSUER}}
  const continuation=createSrmSupplierRequestContinuation(serviceOptions),store=createSrmSupplierPrivateStore({executionMode:'DELEGATED_SERVICE',continuation,boundaryDigest:hash(own('002-supplier-business-phases.sql')),namedInterestBoundaryDigest:hash(own('003-named-supplier-interest.sql')),delegatedBoundaryDigest:hash(own('006-delegated-supplier-business.sql'))})
  const {executionMode:_unused,...inspectionOptions}=serviceOptions
  const inspection=createSrmSupplierRequestInspection({...inspectionOptions,inspectionSchemaDigest:hash(core('015-delegated-private-inspection.sql')),inspectionBusinessBoundaryDigest:hash(own('007-supplier-private-inspection.sql'))}),reader=createSrmSupplierPrivateReader({inspection})
  const {continuationSchemaDigest:_continuation,delegatedSchemaDigest:_delegated,delegatedBusinessBoundaryDigest:_business,...workOptions}=inspectionOptions
  const nativeWork=createSrmSupplierNativeWork({...workOptions,workSchemaDigest:hash(core('016-delegated-native-work.sql')),workBusinessBoundaryDigest:hash(own('008-supplier-native-work.sql'))})
  const nativeStore=createSrmSupplierNativeWorkStore({work:nativeWork,namedInterestBoundaryDigest:hash(own('003-named-supplier-interest.sql'))})
  const sourceOptions={pool:sourcePool,auditPool:sourceAudit,
   application:{appId:'srm-provider-source',environment:'development',profileId:'PLATFORM_INTERNAL',deploymentId:'synthetic-supplier-source',configurationVersion:'source-v1',identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,features:['knowledge_ingestion'],operations:['knowledge.ingest']},
   binding:{applicationId:'srm-provider-source',environment:'development',projectId:'isolated-source-project',branchId:'isolated-source-branch',databaseName:DATABASE,role:SOURCE,deploymentId:'synthetic-supplier-source',configurationVersion:'source-v1',schemaDigest:hash(core('008-platform-ingestion.sql'))},requestSchemaDigest:hash(own('009-supplier-source-request.sql'))}
  const sourceStore=createSrmSupplierSourceRequest(sourceOptions)
  const sourceLink=createSrmSupplierSourceLink({work:{...workOptions,workSchemaDigest:hash(core('016-delegated-native-work.sql')),workBusinessBoundaryDigest:hash(own('008-supplier-native-work.sql'))},namedInterestBoundaryDigest:hash(own('003-named-supplier-interest.sql')),source:sourceStore})
  const selection=p=>({requestId:p.requestId,organisationId:p.organisationId,command:p.command})
  const general=(nip=NIP)=>{const section=structuredClone(emptyCard.general);section.status='SUCCESS';section.source={provider:'MGBI',model:'pl-krs-wp-record',recordId:'synthetic-general-'+nip};section.retrievedAt=new Date().toISOString();section.data={...section.data,nip,legalName:'SYNTHETIC_SERVICE_COMPANY'};return{section,errorCode:null,rawResponse:{pages:[{results:[{id:'synthetic-general-'+nip,privateMarker:'SYNTHETIC_PRIVATE_ONLY'}]}],recordCount:1}}}
  const financial=(nip=NIP)=>{const record={id:'synthetic-financial-'+nip,identifiers:{pl_nip:nip,pl_krs:'0000000001'},document:{type:'financial_statement',period_from_date:'2025-01-01',period_to_date:'2025-12-31',filing_date:'2026-01-15',is_ias_compliant:false},content:{schema:{name:'JednostkaInnaWZlotych',version:'1-3'},extracted_fields:{'Naglowek.OkresOd':'2025-01-01','Naglowek.OkresDo':'2025-12-31','Bilans.Aktywa.KwotaA':'100','RZiS.RZiSKalk.A.KwotaA':'200'},standardized_fields:{bs:{a_ta_cfy:100},pala:{nrfs_cfy:200}}}};return{...mapMgbiFinancialRecords([record],{type:'NIP',value:nip},new Date().toISOString()),rawResponse:{pages:[{results:[record]}],recordCount:1}}}
  const counts=async()=>(await owner.query('SELECT (SELECT count(*)::int FROM srm.lookup_requests)lookups,(SELECT count(*)::int FROM profitia_request_phases.effects)phases,(SELECT count(*)::int FROM srm.source_snapshots)snapshots,(SELECT coalesce(sum(accepted_count),0)::int FROM profitia_requests.policies)quota')).rows[0]
  const sourceCounts=async()=>(await owner.query(`SELECT (SELECT count(*)::int FROM profitia_ingestion.effects)e,(SELECT coalesce(sum(consumed_count),0)::int FROM profitia_ingestion.budgets)b,(SELECT count(*)::int FROM profitia_srm_acquisition.outcome_witnesses)w`)).rows[0]
  if(!full){
  let accepted,acceptedB,acceptedGeneral,acceptedFinancial
  await t.test('real foreground parent and four actual Service domain phases commit one private report and named interest',async()=>{
   accepted=await parent();const s=selection(accepted);acceptedGeneral=general();acceptedFinancial=financial()
   for(const result of[await store.register(s),await store.general(s,acceptedGeneral),await store.financial(s,acceptedFinancial),await store.interest(s)])assert.equal(result.status,'COMMITTED')
   assert.deepEqual(await counts(),{lookups:2,phases:4,snapshots:3,quota:1})
   for(const table of['provider_attempts','section_projections','financial_facts','mgbi_source_archives','financial_source_documents','organization_supplier_interest','user_supplier_interest'])assert((await owner.query(`SELECT count(*)::int n FROM srm.${table}`)).rows[0].n>0,table)
   const user=(await owner.query('SELECT * FROM srm.users')).rows[0];assert.equal(user.identity_kind,'AUTHENTICATED');assert.equal(user.subject_key,'profitia-account:'+U)
   const events=(await owner.query("SELECT event FROM profitia_access.security_events WHERE event->>'operation'='job.execute' AND phase='OUTCOME'")).rows.map(x=>x.event);assert.equal(events.length,4);assert(events.every(x=>x.actorKind==='SERVICE'&&x.actorId===serviceId&&x.subjectUserId===U))
  })
  await t.test('replay skips all four actual domain writers and another body conflicts without quota or history changes',async()=>{
   const before=await counts(),s=selection(accepted)
   assert.equal((await store.register(s)).status,'REPLAY');assert.equal((await store.general(s,acceptedGeneral)).status,'REPLAY');assert.equal((await store.financial(s,acceptedFinancial)).status,'REPLAY');assert.equal((await store.interest(s)).status,'REPLAY')
   await assert.rejects(store.general(s,{...general(),errorCode:'CHANGED_CONTENT'}),e=>e.reasonCode==='IDEMPOTENCY_CONFLICT');assert.deepEqual(await counts(),before)
  })
  await t.test('current named subject is organization-specific and another organization has separate report and list records',async()=>{
   const p=await parent(B);acceptedB=p;const s=selection(p);await store.register(s);await store.general(s,general());await store.financial(s,financial());await store.interest(s)
   const rows=(await owner.query('SELECT organization_id,id,subject_key FROM srm.users ORDER BY organization_id')).rows;assert.equal(rows.length,2);assert.notEqual(rows[0].id,rows[1].id);assert(rows.every(x=>x.subject_key==='profitia-account:'+U))
  })
  await t.test('native prepared reads use actual inspection transactions without new effects, quota or provider calls',async()=>{
   const before=await counts(),s=selection(accepted)
   const lookup=await reader.lookup(s);assert.equal(lookup.requestId,accepted.requestId)
   assert.equal((await reader.snapshot(s,'general')).section,'general');assert.equal((await reader.snapshot(s,'financial')).section,'financial')
   assert((await reader.preparedDocuments(s)).length>0);assert.equal((await reader.financialArchive(s)).organization_id,A)
   assert(Object.isFrozen(lookup));assert.deepEqual(await counts(),before)
   const events=(await owner.query("SELECT event FROM profitia_access.security_events WHERE phase='OUTCOME' AND event ? 'requestInspection'")).rows.map(x=>x.event)
   assert.equal(events.length,5);assert(events.every(x=>x.actorKind==='SERVICE'&&x.actorId===serviceId&&x.subjectUserId===U&&x.requestInspection.transactionId!==x.requestInspection.acceptedTransactionId))
  })
  await t.test('read binding uses the current actual native transaction and survives concurrent organization reads',async()=>{
   const both=await Promise.all([reader.lookup(selection(accepted)),reader.lookup(selection(acceptedB))]);assert.notEqual(both[0].supplierId,both[1].supplierId)
   const proof=await inspection.read({...selection(accepted),phaseId:'REGISTER_LOOKUP'},async(context,client)=>{
    return withOrganization(A,async bound=>{
     assert.equal(bound,client);assert.equal(context.requestContinuation,undefined)
     assert.equal((await bound.query('SELECT txid_current()::text tx')).rows[0].tx,context.requestInspection.transactionId)
     const lookups=(await bound.query('SELECT id,organization_id FROM srm.lookup_requests')).rows
     assert.deepEqual(lookups,[{id:accepted.requestId,organization_id:A}])
     const commands=(await bound.query('SELECT request_id FROM profitia_supplier_requests.commands')).rows;assert.deepEqual(commands,[{request_id:accepted.requestId}])
     const rows=(await bound.query('SELECT organization_id,nip FROM srm.suppliers')).rows;assert.deepEqual(rows,[{organization_id:A,nip:NIP}])
     assert.equal((await bound.query("SELECT * FROM srm.source_snapshots WHERE section='kys'")).rowCount,0)
     assert.equal((await bound.query('SELECT * FROM srm.catalog_kys_reports')).rowCount,0)
     assert.equal((await bound.query('SELECT * FROM srm.user_supplier_interest')).rowCount,0)
     await bound.query("SELECT set_config('srm.organization_id',$1,true)",[B]);assert.equal((await bound.query('SELECT * FROM srm.suppliers WHERE organization_id=$1',[B])).rowCount,0)
     await bound.query("SELECT set_config('srm.organization_id',$1,true)",[A])
     assert((await owner.query("SELECT * FROM srm.source_snapshots WHERE section='kys'")).rowCount>0)
     assert((await owner.query('SELECT * FROM srm.catalog_kys_reports')).rowCount>0)
     assert((await owner.query('SELECT * FROM srm.user_supplier_interest')).rowCount>0)
     return {requestId:accepted.requestId}
    },bindOrganizationTransaction(A,client,context))
   });assert.equal(proof.requestId,accepted.requestId)
  })
  await t.test('wrong organization, unknown parent, changed command and unaccepted phase are refused before a result escapes',async()=>{
   const pending=await parent(),before=await counts()
   for(const s of[{...selection(accepted),organisationId:B},{...selection(accepted),requestId:randomUUID()},{...selection(accepted),command:{kind:'SUPPLIER_REPORT',nip:OTHER_NIP}},selection(pending)])await assert.rejects(reader.lookup(s),isOperationDenied)
   await assert.rejects(inspection.read({...selection(pending),phaseId:'STORE_GENERAL'},()=>({escaped:true})),isOperationDenied);assert.deepEqual(await counts(),before)
  })
  await t.test('read inspection cannot update, delete or insert even with explicit DML ACLs',async()=>{
   await owner.query(`GRANT DELETE ON srm.suppliers TO ${EXECUTOR}`)
   const before=await counts()
   try{
    const result=await inspection.read({...selection(accepted),phaseId:'REGISTER_LOOKUP'},async(_context,client)=>{
     assert.equal((await client.query('SELECT * FROM srm.suppliers')).rowCount,1)
     assert.equal((await client.query("UPDATE srm.suppliers SET display_name='FORBIDDEN' RETURNING id")).rowCount,0)
     assert.equal((await client.query('DELETE FROM srm.suppliers RETURNING id')).rowCount,0)
     return {writeRows:0}
    });assert.equal(result.writeRows,0)
    let rlsRefused=false
    await assert.rejects(inspection.read({...selection(accepted),phaseId:'REGISTER_LOOKUP'},async(_context,client)=>{
     try{await client.query('INSERT INTO srm.suppliers(organization_id,nip) VALUES($1,$2)',[A,OTHER_NIP])}catch(e){rlsRefused=e.code==='42501';throw e}
     return {escaped:true}
    }),isOperationDenied);assert.equal(rlsRefused,true);assert.deepEqual(await counts(),before)
   }finally{await owner.query(`REVOKE DELETE ON srm.suppliers FROM ${EXECUTOR}`)}
  })
  await t.test('a SELECT-only inspection is still denied INSERT by actual RLS before any domain trigger',async()=>{
   let message=''
   await assert.rejects(inspection.read({...selection(accepted),phaseId:'REGISTER_LOOKUP'},async(_context,client)=>{
    try{await client.query('INSERT INTO srm.organizations(id,slug) VALUES($1,$2)',[randomUUID(),'synthetic-forbidden-org'])}catch(e){message=e.message;throw e}
    return {escaped:true}
   }),isOperationDenied);assert.match(message,/row-level security/)
  })
  await t.test('captured input is immutable and bounded JSON excludes transaction objects and oversized results',async()=>{
   const mutable=structuredClone(selection(accepted)),pending=reader.lookup(mutable);mutable.organisationId=B;mutable.command.nip=OTHER_NIP
   assert.equal((await pending).requestId,accepted.requestId)
   for(const action of[()=>({value:undefined}),()=>({value:BigInt(1)}),()=>({value:'x'.repeat(8*1024*1024+1)}),(_context,client)=>({client})])await assert.rejects(inspection.read({...selection(accepted),phaseId:'REGISTER_LOOKUP'},action),isOperationDenied)
   let invoked=false;const accessor={...selection(accepted),phaseId:'REGISTER_LOOKUP'};Object.defineProperty(accessor,'requestId',{get(){invoked=true;return accepted.requestId},enumerable:true})
   await assert.rejects(inspection.read(accessor,()=>({escaped:true})),isOperationDenied);assert.equal(invoked,false)
  })
  await t.test('current installation and actual database binding cannot be replaced by runtime metadata access',async()=>{
   await owner.query(`GRANT SELECT(boundary_digest) ON srm.supplier_inspection_installation TO ${EXECUTOR}`)
   try{await assert.rejects(reader.lookup(selection(accepted)),isOperationDenied)}finally{await owner.query(`REVOKE SELECT(boundary_digest) ON srm.supplier_inspection_installation FROM ${EXECUTOR}`)}
   assert.equal((await reader.lookup(selection(accepted))).requestId,accepted.requestId)
   await inspection.read({...selection(accepted),phaseId:'REGISTER_LOOKUP'},async(context,client)=>{
    assert.throws(()=>bindOrganizationTransaction(A,client,{...context,requestInspection:{...context.requestInspection,acceptedTransactionId:context.requestInspection.transactionId}}))
    await assert.rejects(withOrganization(A,async()=>({escaped:true}),bindOrganizationTransaction(A,client,{...context,requestInspection:{...context.requestInspection,transactionId:'999999999999'}})))
    return {refused:true}
   })
  })
  await t.test('missing physical INTENT, OUTCOME and failed COMMIT never return captured private data',async()=>{
   const before=await counts()
   for(const mode of['INTENT','OUTCOME','COMMIT']){
    omitIntent=mode==='INTENT';omitOutcome=mode==='OUTCOME';failInspectionCommit=mode==='COMMIT'
    try{await assert.rejects(reader.lookup(selection(accepted)),isOperationDenied)}finally{omitIntent=false;omitOutcome=false;failInspectionCommit=false}
   }assert.deepEqual(await counts(),before)
  })
  await t.test('historical accepted phase does not renew current permission, account or membership',async()=>{
   const grant=randomUUID(),s=selection(accepted)
   await controlled(()=>owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'srm',$2,$3,'DENY','supplier.report.refresh','supplier_report')",[grant,A,U]))
   try{await assert.rejects(reader.lookup(s),isOperationDenied)}finally{await controlled(()=>owner.query('DELETE FROM profitia_access.permission_grants WHERE grant_id=$1',[grant]))}
   accountActive=false;try{await assert.rejects(reader.lookup(s),isOperationDenied)}finally{accountActive=true}
   await controlled(()=>owner.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2",[A,U]))
   try{await assert.rejects(reader.lookup(s),isOperationDenied)}finally{await controlled(()=>owner.query("UPDATE profitia_access.memberships SET status='ACTIVE' WHERE organisation_id=$1 AND user_id=$2",[A,U]))}
   assert.equal((await reader.lookup(s)).requestId,accepted.requestId)
  })
  await t.test('a Service has no direct history access outside a current phase and cannot assume the owner role',async()=>{
   assert.equal((await rawService.query('SELECT * FROM srm.lookup_requests')).rowCount,0)
   await assert.rejects(rawService.query('SELECT * FROM srm.delegated_supplier_installation'),e=>e.code==='42501')
   await assert.rejects(rawService.query('SET ROLE profitia_access_owner'),e=>e.code==='42501')
   const before=await counts();await assert.rejects(store.register({...selection(accepted),organisationId:B}),isOperationDenied);assert.deepEqual(await counts(),before)
  })
  await t.test('a current Service phase cannot read another organization, another request or another supplier',async()=>{
   const p=await parent(),before=await counts()
   await assert.rejects(continuation.run({...selection(p),phaseId:'REGISTER_LOOKUP',data:{probe:'bounded-read'}},async(context,client)=>{
    assert.equal(context.actorKind,'SERVICE');assert.equal(context.subjectUserId,U);assert.notEqual(context.actorId,U)
    assert.deepEqual((await client.query('SELECT id FROM srm.organizations')).rows,[{id:A}])
    const suppliers=(await client.query('SELECT organization_id,nip FROM srm.suppliers')).rows
    assert(suppliers.every(row=>row.organization_id===A&&row.nip===NIP));assert.equal(suppliers.length,1)
    assert.equal((await client.query('SELECT * FROM srm.lookup_requests')).rowCount,0)
    for(const table of['provider_attempts','source_snapshots','financial_facts','mgbi_source_archives','financial_source_documents'])assert.equal((await client.query(`SELECT * FROM srm.${table}`)).rowCount,0,table)
    assert.equal((await client.query("SELECT has_table_privilege(current_user,'srm.catalog_companies','INSERT,UPDATE,DELETE') allowed")).rows[0].allowed,false)
    await client.query("SELECT set_config('srm.organization_id',$1,true)",[B])
    assert.equal((await client.query('SELECT * FROM srm.suppliers WHERE organization_id=$1',[B])).rowCount,0)
    const marker=(await client.query("SELECT current_setting('profitia.job.scope') marker")).rows[0].marker
    const forged=JSON.parse(marker);forged[0]=accepted.requestId
    await client.query("SELECT set_config('profitia.job.scope',$1,true)",[JSON.stringify(forged)])
    assert.equal((await client.query('SELECT * FROM srm.suppliers')).rowCount,0,'Caller marker cannot authorize an old committed request')
    await client.query("SELECT set_config('profitia.job.scope',$1,true)",[marker])
    throw Error('Synthetic rollback after actual bounded SQL reads')
   }),isOperationDenied)
   assert.deepEqual(await counts(),before)
  })
  await t.test('actual row fences refuse cross-organization and different-supplier writes inside an otherwise valid phase',async()=>{
   for(const[org,nip]of[[B,NIP],[A,OTHER_NIP]]){
    const p=await parent(),before=await counts();let refusedByRowFence=false
    await assert.rejects(continuation.run({...selection(p),phaseId:'REGISTER_LOOKUP',data:{probe:'forbidden-write'}},async(_context,client)=>{
     try{await client.query('INSERT INTO srm.suppliers(organization_id,nip) VALUES($1,$2)',[org,nip])}
     catch(error){refusedByRowFence=error.code==='42501';throw error}
    }),isOperationDenied)
    assert.equal(refusedByRowFence,true);assert.deepEqual(await counts(),before)
   }
  })
  await t.test('a changed command cannot borrow an accepted parent to refresh another NIP',async()=>{
   const p=await parent(),before=await counts()
   await assert.rejects(store.register({...selection(p),command:{kind:'SUPPLIER_REPORT',nip:OTHER_NIP}}),isOperationDenied)
   assert.deepEqual(await counts(),before)
  })
  await t.test('actual audit failure and omitted OUTCOME roll back domain writes and phase effects together',async()=>{
   for(const omitted of[false,true]){const p=await parent(A,OTHER_NIP),before=await counts();failOutcome=!omitted;omitOutcome=omitted
    try{await assert.rejects(store.register(selection(p)),isOperationDenied)}finally{failOutcome=false;omitOutcome=false}
    assert.deepEqual(await counts(),before)
   }
  })
  await t.test('current user denial and external account revocation stop real business writes',async()=>{
   const p=await parent(A,OTHER_NIP),before=await counts(),grant=randomUUID()
   await controlled(()=>owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'srm',$2,$3,'DENY','supplier.report.refresh','supplier_report')",[grant,A,U]))
   try{await assert.rejects(store.register(selection(p)),isOperationDenied)}finally{await controlled(()=>owner.query('DELETE FROM profitia_access.permission_grants WHERE grant_id=$1',[grant]))}
   accountActive=false;try{await assert.rejects(store.register(selection(p)),isOperationDenied)}finally{accountActive=true}
   assert.deepEqual(await counts(),before)
  })
  await t.test('the existing HUMAN continuation and same domain writer still operate after optional SQL006',async()=>{
   const p=await parent(A,OTHER_NIP),humanContinuation=createSrmSupplierRequestContinuation({...humanOptions,continuationSchemaDigest:hash(core('011-request-continuation.sql'))}),humanStore=createSrmSupplierPrivateStore({continuation:humanContinuation,boundaryDigest:hash(own('002-supplier-business-phases.sql')),namedInterestBoundaryDigest:hash(own('003-named-supplier-interest.sql'))})
   const s={...selection(p),idempotencyKey:p.key,request:new Request(ORIGIN+'/api/xray/requests',{method:'POST',headers:{origin:ORIGIN}})}
   assert.equal((await humanStore.register(s)).status,'COMMITTED');assert.equal((await humanStore.general(s,general(OTHER_NIP))).status,'COMMITTED')
   assert.equal((await humanStore.financial(s,financial(OTHER_NIP))).status,'COMMITTED');assert.equal((await humanStore.interest(s)).status,'COMMITTED')
  })
  await t.test('private interest cannot silently create shared catalogue knowledge when its Source prerequisite is absent',async()=>{
   const nip='1234563218',p=await parent(A,nip),s=selection(p)
   await store.register(s);await store.general(s,general(nip));await store.financial(s,financial(nip));const before=await counts()
   await assert.rejects(store.interest(s),isOperationDenied);assert.deepEqual(await counts(),before)
   assert.equal((await owner.query('SELECT * FROM srm.catalog_companies WHERE nip=$1',[nip])).rowCount,0)
   assert.equal((await owner.query('SELECT * FROM srm.organization_supplier_interest WHERE nip=$1',[nip])).rowCount,0)
   assert.equal((await owner.query("SELECT * FROM profitia_request_phases.effects WHERE request_id=$1 AND phase_id='RECORD_INTEREST'",[p.requestId])).rowCount,0)
  })
  let nativeA,nativeB
  await t.test('native purposes execute original business writers for two organizations without a second phase ledger',async()=>{
   const phases=(await counts()).phases
   for(const org of[A,B]){
    const p=await parent(org),s=selection(p),g=general(),f=financial()
    g.rawResponse.pages[0].results[0].identifiers={pl_nip:NIP,pl_krs:'0000000001'}
    const lookup=await nativeStore.register(s);assert.equal(lookup.requestId,p.requestId)
    await nativeStore.archive(s,'pl-krs-wp-record',g.rawResponse.pages,g.rawResponse.recordCount,g.section.retrievedAt)
    await nativeStore.archive(s,'pl-krs-rdf-record',f.rawResponse.pages,f.rawResponse.recordCount,f.section.retrievedAt)
    assert((await nativeStore.prepareDocuments(s,f.rawResponse.pages)).documents>0)
    assert(await nativeStore.section(s,'general',g.section,g.errorCode))
    assert(await nativeStore.section(s,'financial',f.section,f.errorCode,f.facts,undefined,f.sourceData))
    assert((await nativeStore.preparedDocuments(s)).length>0)
    await nativeStore.interest(s)
    if(org===A)nativeA=p;else nativeB=p
   }
   const both=await Promise.all([nativeStore.preparedDocuments(selection(nativeA)),nativeStore.preparedDocuments(selection(nativeB))])
   assert(both.every(rows=>rows.length>0));assert.equal((await counts()).phases,phases)
   const users=(await owner.query('SELECT organization_id,id,subject_key FROM srm.users ORDER BY organization_id')).rows
   assert.equal(users.length,2);assert.notEqual(users[0].id,users[1].id);assert(users.every(row=>row.subject_key==='profitia-account:'+U))
   const events=(await owner.query("SELECT event FROM profitia_access.security_events WHERE phase='OUTCOME' AND event ? 'requestWork'")).rows.map(row=>row.event)
   assert(events.length>=16);assert(events.every(event=>event.actorKind==='SERVICE'&&event.actorId===serviceId&&event.subjectUserId===U&&Object.keys(event.requestWork).length===9))
  })
  await t.test('KRS registration creates or reads the supplier without admitting an unrelated UPDATE policy',async()=>{
   const s=selection(await parent(A,'5213390341'))
   await controlled(async()=>{
    await owner.query("CREATE FUNCTION srm.fixture_ungranted_update() RETURNS boolean LANGUAGE sql AS 'SELECT true'")
    await owner.query('REVOKE ALL ON FUNCTION srm.fixture_ungranted_update() FROM PUBLIC')
    await owner.query("CREATE POLICY fixture_ungranted_update ON srm.suppliers FOR UPDATE TO PUBLIC USING(current_user='profitia_access_owner' AND srm.fixture_ungranted_update()) WITH CHECK(false)")
   })
   try{
    assert.equal((await rawService.query("SELECT has_function_privilege(current_user,'srm.fixture_ungranted_update()','EXECUTE') allowed")).rows[0].allowed,false)
    const before=await counts()
    // Existing NIP behavior still requests an UPDATE; the injected policy
    // reproduces PostgreSQL's permission check without granting that function.
    await assert.rejects(nativeStore.register(s),isOperationDenied)
    assert.deepEqual(await counts(),before)
    const created=await nativeStore.register(s,'KEEP')
    assert.equal(created.requestId,s.requestId)
    const at=(await controlled(()=>owner.query('SELECT updated_at::text FROM srm.suppliers WHERE organization_id=$1 AND id=$2',[A,created.supplierId]))).rows[0].updated_at
    assert.deepEqual(await nativeStore.register(s,'KEEP'),created)
    assert.equal((await controlled(()=>owner.query('SELECT updated_at::text FROM srm.suppliers WHERE organization_id=$1 AND id=$2',[A,created.supplierId]))).rows[0].updated_at,at)
    await assert.rejects(nativeStore.register({...s,organisationId:B},'KEEP'),isOperationDenied)
    assert.equal((await rawService.query("SELECT has_function_privilege(current_user,'srm.fixture_ungranted_update()','EXECUTE') allowed")).rows[0].allowed,false)
   }finally{await controlled(async()=>{
    await owner.query('DROP POLICY fixture_ungranted_update ON srm.suppliers')
    await owner.query('DROP FUNCTION srm.fixture_ungranted_update()')
   })}
  })
  await t.test('native READ sees its real current row and cannot update, delete or insert domain rows',async()=>{
   const s=selection(nativeA),before=await counts()
   await owner.query(`GRANT DELETE ON srm.lookup_requests TO ${EXECUTOR}`)
   await nativeWork.run(s,'SRM_READ_DOCUMENTS',null,async(context,client)=>{
    const bound=bindOrganizationTransaction(A,client,context)
    await withOrganization(A,async c=>{
     assert.equal((await c.query('SELECT * FROM srm.lookup_requests WHERE id=$1',[s.requestId])).rowCount,1)
     assert.equal((await c.query('SELECT * FROM srm.lookup_requests WHERE organization_id=$1',[B])).rowCount,0)
     assert.equal((await c.query('SELECT * FROM srm.lookup_requests WHERE identifier=$1',[OTHER_NIP])).rowCount,0)
     assert.equal((await c.query('UPDATE srm.lookup_requests SET identifier=identifier WHERE id=$1',[s.requestId])).rowCount,0)
     assert.equal((await c.query('DELETE FROM srm.lookup_requests WHERE id=$1',[s.requestId])).rowCount,0)
    },bound)
   })
   let realRowFence=false
   await assert.rejects(nativeWork.run(s,'SRM_READ_DOCUMENTS',null,async(_context,client)=>{
    try{await client.query('INSERT INTO srm.organizations(id,slug) VALUES($1,$2)',[randomUUID(),'synthetic-native-forbidden'])}
    catch(error){realRowFence=error.code==='42501';throw error}
   }),isOperationDenied)
   assert.equal(realRowFence,true);assert.deepEqual(await counts(),before)
  })
  await t.test('native work rejects foreign org and command, changed physical scope and unreviewed purposes',async()=>{
   const s=selection(nativeA),before=await counts()
   await assert.rejects(nativeStore.preparedDocuments({...s,organisationId:B}),isOperationDenied)
   await assert.rejects(nativeStore.preparedDocuments({...s,command:{kind:'SUPPLIER_REPORT',nip:OTHER_NIP}}),isOperationDenied)
   await assert.rejects(nativeWork.run(s,'UNREVIEWED_WRITE',null,async()=>{}),isOperationDenied)
   await assert.rejects(nativeWork.run(s,'SRM_READ_DOCUMENTS',null,async(context,client)=>{
    const forged={...context,requestWork:{...context.requestWork,inputDigest:'f'.repeat(64)}}
    const bound=bindOrganizationTransaction(A,client,forged)
    await withOrganization(A,async()=>{},bound)
   }),isOperationDenied)
   assert.deepEqual(await counts(),before)
  })
  await t.test('native domain changes roll back when actual canonical audit is failed or omitted',async()=>{
   for(const mode of['fail','omit','intent']){
    const p=await parent(A,OTHER_NIP),before=await counts();failOutcome=mode==='fail';omitOutcome=mode==='omit';omitIntent=mode==='intent'
    try{await assert.rejects(nativeStore.register(selection(p)),isOperationDenied)}finally{failOutcome=false;omitOutcome=false;omitIntent=false}
    assert.deepEqual(await counts(),before)
   }
  })
  await t.test('native current denial, account revocation and metadata privilege drift refuse before domain mutation',async()=>{
   const p=await parent(A,OTHER_NIP),before=await counts(),grant=randomUUID()
   await controlled(()=>owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'srm',$2,$3,'DENY','supplier.report.refresh','supplier_report')",[grant,A,U]))
   try{await assert.rejects(nativeStore.register(selection(p)),isOperationDenied)}finally{await controlled(()=>owner.query('DELETE FROM profitia_access.permission_grants WHERE grant_id=$1',[grant]))}
   accountActive=false;try{await assert.rejects(nativeStore.register(selection(p)),isOperationDenied)}finally{accountActive=true}
   await owner.query(`GRANT SELECT ON srm.supplier_work_installation TO ${EXECUTOR}`)
   try{await assert.rejects(nativeStore.register(selection(p)),isOperationDenied)}finally{await owner.query(`REVOKE SELECT ON srm.supplier_work_installation FROM ${EXECUTOR}`)}
   assert.deepEqual(await counts(),before)
  })
  const msrXml=licensedXml
  let msrSelection,msrNative
  const prepareMsr=async(recordId)=>{
   const record=financial(OTHER_NIP).rawResponse.pages[0].results[0]
   record.id=recordId;record.document.is_ias_compliant=true;record.content={}
   record.files={main_document:{original:{content_type:'application/xhtml+xml'}}}
   const pages=[{results:[record]}],at=new Date().toISOString()
   await nativeStore.archive(msrSelection,'pl-krs-rdf-record',pages,1,at)
   await nativeStore.prepareDocuments(msrSelection,pages)
   return mapMgbiFinancialRecords([record],{type:'NIP',value:OTHER_NIP},at)
  }
  await t.test('native MSR uses original committed lifecycle and parser, then reuses READY without another acquisition',async()=>{
   msrSelection=selection(await parent(A,OTHER_NIP));await nativeStore.register(msrSelection)
   msrNative=nativeStore.msr(msrSelection,['0000000001'])
   const base=await prepareMsr('a'.repeat(24)),before=await counts();let acquisitions=0
   const download=async recordId=>{
    acquisitions++
    assert.equal((await owner.query('SELECT state FROM srm.msr_sources WHERE organization_id=$1 AND nip=$2 AND record_id=$3',[A,OTHER_NIP,recordId])).rows[0].state,'REQUESTED')
    assert.equal((await owner.query("SELECT count(*)::int n FROM pg_stat_activity WHERE datname=$1 AND usename=$2 AND state='idle in transaction'",[DATABASE,EXECUTOR])).rows[0].n,0)
    return decodeMsrOriginal(recordId,Buffer.from(msrXml),'application/xhtml+xml',new Date().toISOString())
   }
   const first=await enrichMsrFinancial(A,OTHER_NIP,base,{store:msrNative,download})
   assert.equal(acquisitions,1);assert.equal(first.section.status,'SUCCESS');assert.equal(first.facts.find(f=>f.amount==='123')?.amount,'123')
   const c=(await msrNative.candidates()).candidates[0],stored=await msrNative.read(c)
   assert.equal(stored.state,'READY');assert.equal(verifyMsrReceipt(c,stored).parsed.facts[0].amount,'123')
   const originalRows=(await owner.query('SELECT count(*)::int n FROM srm.msr_sources WHERE organization_id=$1 AND nip=$2',[A,OTHER_NIP])).rows[0].n
   await enrichMsrFinancial(A,OTHER_NIP,first,{store:msrNative,download})
   assert.equal(acquisitions,1);assert.equal((await counts()).phases,before.phases)
   assert.equal((await owner.query('SELECT count(*)::int n FROM srm.msr_sources WHERE organization_id=$1 AND nip=$2',[A,OTHER_NIP])).rows[0].n,originalRows)
  })
  await t.test('native ambiguous MSR acquisition stays BLOCKED and the original engine never retries it',async()=>{
   const base=await prepareMsr('b'.repeat(24));let acquisitions=0
   const download=async()=>{acquisitions++;throw new MsrSourceError('MSR_FILE_TIMEOUT','file_download')}
   const first=await enrichMsrFinancial(A,OTHER_NIP,base,{store:msrNative,download})
   const c=(await msrNative.candidates()).candidates[0],row=await msrNative.read(c)
   assert.equal(row.state,'BLOCKED');assert.equal(row.error_code,'MSR_FILE_TIMEOUT');assert(first.section.warnings.includes('MSR_FILE_TIMEOUT'))
   await enrichMsrFinancial(A,OTHER_NIP,base,{store:msrNative,download});assert.equal(acquisitions,1)
  })
  await t.test('native MSR deferral keeps the original claim and later makes one authorized synthetic acquisition',async()=>{
   const base=await prepareMsr('c'.repeat(24)),c=(await msrNative.candidates()).candidates[0]
   await enrichMsrFinancial(A,OTHER_NIP,base,{store:msrNative,download:async()=>{throw new MsrSourceError('MSR_FILE_BUDGET_EXHAUSTED','file_budget')}})
   const deferred=await msrNative.read(c);assert.equal(deferred.state,'DEFERRED');let acquisitions=0
   const result=await enrichMsrFinancial(A,OTHER_NIP,base,{store:msrNative,download:async recordId=>{acquisitions++;return decodeMsrOriginal(recordId,Buffer.from(msrXml),'application/xhtml+xml',new Date().toISOString())}})
   assert.equal(acquisitions,1);assert.equal(result.section.status,'SUCCESS');assert.equal((await msrNative.read(c)).claim_id,deferred.claim_id)
  })
  await t.test('native interrupted REQUESTED requires reconciliation and RECEIVED recovers without acquisition',async()=>{
   const base=await prepareMsr('d'.repeat(24)),c=(await msrNative.candidates()).candidates[0],claim=randomUUID()
   assert.equal(await msrNative.claim(c,claim),true);assert.equal(await msrNative.claim(c,claim),false)
   let acquisitions=0;const download=async()=>{acquisitions++;throw Error('Synthetic acquisition must not run')}
   const waiting=await enrichMsrFinancial(A,OTHER_NIP,base,{store:msrNative,download})
   assert(waiting.section.warnings.includes('MSR_DOWNLOAD_RECONCILIATION_REQUIRED'));assert.equal(acquisitions,0)
   await msrNative.receive(c,claim,decodeMsrOriginal(c.recordId,Buffer.from(msrXml),'application/xhtml+xml',new Date().toISOString()))
   const recovered=await enrichMsrFinancial(A,OTHER_NIP,base,{store:msrNative,download})
   assert.equal(recovered.section.status,'SUCCESS');assert.equal(acquisitions,0);assert.equal((await msrNative.read(c)).state,'READY')
  })
  await t.test('native binary receipt preserves supported20MiB originals and isolates copies and another organization',async()=>{
   await prepareMsr('e'.repeat(24));const c=(await msrNative.candidates()).candidates[0],claim=randomUUID()
   const head='<html xmlns="http://www.w3.org/1999/xhtml"><body><!--',tail='--></body></html>'
   const bytes=Buffer.from(head+' '.repeat(20*1024*1024-Buffer.byteLength(head+tail))+tail)
   const source=decodeMsrOriginal(c.recordId,bytes,'application/xhtml+xml',new Date().toISOString()),expected=source.checksum
   assert.equal(source.bytes.length,20*1024*1024);assert.equal(await msrNative.claim(c,claim),true)
   const save=msrNative.receive(c,claim,source);source.bytes.fill(0);await save
   const observed=await msrNative.read(c);assert.equal(observed.state,'RECEIVED');assert.equal(observed.original_bytes.length,20*1024*1024);assert.equal(hash(observed.original_bytes),expected)
   observed.original_bytes.fill(0);assert.equal(hash((await msrNative.read(c)).original_bytes),expected)
   const foreign=selection(await parent(B,OTHER_NIP));await nativeStore.register(foreign)
   assert.equal(await nativeStore.msr(foreign).read(c),null)
   assert((await owner.query('SELECT octet_length(original_bytes)::int n FROM srm.msr_sources WHERE organization_id=$1 AND nip=$2 AND record_id=$3',[A,OTHER_NIP,c.recordId])).rows[0].n>8*1024*1024)
  })
  await t.test('native cache, registration, PKD and financial reproject use real stored sources and all reviewed READ purposes',async()=>{
   const s=selection(nativeA),record={id:'native-wp',identifiers:{pl_nip:NIP,pl_krs:'0000000001'},content:{current_excerpt:{dane:{dzial1:{danePodmiotu:{nazwa:'SYNTHETIC_CACHED_COMPANY'}},dzial3:{przedmiotDzialalnosci:{przedmiotPrzewazajacejDzialalnosci:[{kodDzial:'46',kodKlasa:'38',kodPodklasa:'Z',opis:'SYNTHETIC_ACTIVITY'}]}}}}}}
   const at=new Date().toISOString(),g=mapMgbiGeneralRecords([record],{type:'NIP',value:NIP},at),f=financial()
   await nativeStore.archive(s,'pl-krs-wp-record',[{results:[record]}],1,at)
   await writeSharedCompany(owner,null,NIP,{general:g.section,financial:f.section,generalSnapshotId:null,financialSnapshotId:null,facts:[]})
   const cached=await nativeStore.cache(s);assert.equal(cached.general.data.legalName,'SYNTHETIC_CACHED_COMPANY')
   assert.equal((await nativeStore.registration(s)).status,'ACTIVE')
   const partial=structuredClone(g.section);delete partial.data.mainPkdDescription
   assert.equal((await nativeStore.pkd(s,partial)).mainPkdDescription,'SYNTHETIC_ACTIVITY')
   const projected=await nativeStore.reproject(s);assert(projected,'Existing current archive must be visible to pure reprojection');assert(projected.section.data.periods.length>0)
   const units=(await owner.query("SELECT DISTINCT event->'requestWork'->>'unitId' unit FROM profitia_access.security_events WHERE phase='OUTCOME' AND event ? 'requestWork'")).rows.map(row=>row.unit)
   assert.deepEqual(units.sort(),Object.keys(SUPPLIER_NATIVE_WORK_UNITS).sort())
  })
  await t.test('native restoration is an explicit WRITE and retains original licensed bytes',async()=>{
   const record=financial(OTHER_NIP).rawResponse.pages[0].results[0]
   record.id='e'.repeat(24);record.document.is_ias_compliant=true;record.document.filing_date='2026-02-01';record.content={};record.files={main_document:{original:{content_type:'application/xhtml+xml'}}}
   const c=(await msrNative.candidates()).candidates[0]
   const before=(await owner.query('SELECT state,original_sha256 FROM srm.msr_sources WHERE organization_id=$1 AND nip=$2 AND record_id=$3',[A,OTHER_NIP,c.recordId])).rows[0]
   await nativeStore.archive(msrSelection,'pl-krs-rdf-record',[{results:[record]}],1,new Date().toISOString())
   await nativeWork.run(msrSelection,'SRM_READ_DOCUMENTS',null,async(_context,client)=>{
    const plain=await client.query("SELECT payload_jsonb_sha256 FROM srm.mgbi_source_archives WHERE organization_id=$1 AND nip=$2 AND model='pl-krs-rdf-record'",[A,OTHER_NIP])
    const locking=await client.query("SELECT payload_jsonb_sha256 FROM srm.mgbi_source_archives WHERE organization_id=$1 AND nip=$2 AND model='pl-krs-rdf-record' FOR SHARE",[A,OTHER_NIP])
    const stored=await client.query('SELECT archive_jsonb_sha256 FROM srm.financial_source_documents WHERE organization_id=$1 AND nip=$2 AND record_id=$3',[A,OTHER_NIP,record.id])
    assert.equal(plain.rowCount,1);assert.equal(locking.rowCount,0)
    assert.notEqual(stored.rows[0].archive_jsonb_sha256,plain.rows[0].payload_jsonb_sha256)
    console.error('ISOLATED_READ_LOCK_PROVENANCE_PROBE',JSON.stringify({visibleArchiveRows:plain.rowCount,rowLockRows:locking.rowCount,staleDocumentChecksum:true}))
   })
   await assert.rejects(nativeStore.preparedDocuments(msrSelection),isOperationDenied)
   await nativeWork.run(msrSelection,'SRM_PREPARE_DOCUMENTS',null,async(_context,client)=>{
    assert.equal((await client.query("SELECT payload_jsonb_sha256 FROM srm.mgbi_source_archives WHERE organization_id=$1 AND nip=$2 AND model='pl-krs-rdf-record' FOR SHARE",[A,OTHER_NIP])).rowCount,1)
    await client.query('SAVEPOINT archive_write_refusal')
    try {
     await assert.rejects(client.query("UPDATE srm.mgbi_source_archives SET record_count=record_count WHERE organization_id=$1 AND nip=$2 AND model='pl-krs-rdf-record'",[A,OTHER_NIP]),error=>error.code==='42501')
    } finally {
     await client.query('ROLLBACK TO SAVEPOINT archive_write_refusal');await client.query('RELEASE SAVEPOINT archive_write_refusal')
    }
   })
   const restored=await nativeStore.restoreDocuments(msrSelection);assert(restored.length>0)
   assert((await nativeStore.preparedDocuments(msrSelection)).length>0)
   const after=(await owner.query('SELECT state,original_sha256 FROM srm.msr_sources WHERE organization_id=$1 AND nip=$2 AND record_id=$3',[A,OTHER_NIP,c.recordId])).rows[0]
   assert.equal(after.original_sha256,before.original_sha256);assert.equal(after.state,'RECEIVED')
  })
  await t.test('native archive refuses foreign supplier inventory or false record counts before durable writes',async()=>{
   const s=selection(nativeA),before=await counts()
   for(const model of['pl-krs-wp-record','pl-krs-rdf-record']){
    await assert.rejects(async()=>nativeStore.archive(s,model,[{results:[{identifiers:{pl_nip:OTHER_NIP}}]}],1,new Date().toISOString()),isOperationDenied)
    await assert.rejects(async()=>nativeStore.archive(s,model,[{results:[]}],1,new Date().toISOString()),isOperationDenied)
   }
   assert.deepEqual(await counts(),before)
  })
  let linked,linkedResult
  await t.test('real register and independently committed Source admission retain the original human and organisation',async()=>{
   linked=selection(await parent());const before=await sourceCounts()
   linkedResult=await sourceLink.registerAndAdmit(linked)
   assert.equal(linkedResult.lookup.requestId,linked.requestId)
   assert.equal(linkedResult.sourceStatus,'CONFIRMED');assert.equal(linkedResult.sourceRequest.status,'COMMITTED')
   assert.deepEqual(await sourceCounts(),{e:before.e+1,b:before.b+1,w:before.w+1})
   const row=(await owner.query('SELECT g.user_id,g.organisation_id,j.status,o.source_effect_id FROM profitia_jobs.delegations g JOIN profitia_jobs.dispatches j USING(delegation_id) JOIN profitia_jobs.delivery_observations o USING(job_id) WHERE j.request_id=$1',[linked.requestId])).rows[0]
   assert.equal(row.user_id,U);assert.equal(row.organisation_id,A);assert.equal(row.status,'CONFIRMED');assert.equal(row.source_effect_id,linkedResult.sourceRequest.effectId)
   assert.equal((await owner.query('SELECT 1 FROM srm.lookup_requests WHERE organization_id=$1 AND id=$2 AND identifier=$3',[A,linked.requestId,NIP])).rowCount,1)
  })
  await t.test('confirmed dispatch replay rechecks current authority and reuses the same Source effect without another charge',async()=>{
   const before=await sourceCounts(),result=await sourceLink.registerAndAdmit(linked)
   assert.deepEqual(result,linkedResult);assert.deepEqual(await sourceCounts(),before)
   const second=selection(await parent(B)),other=await sourceLink.registerAndAdmit(second)
   assert.equal(other.sourceStatus,'CONFIRMED');assert.notEqual(other.sourceRequest.effectId,result.sourceRequest.effectId)
   await assert.rejects(sourceLink.registerAndAdmit({...linked,organisationId:B}),isOperationDenied)
   const events=(await owner.query('SELECT event FROM profitia_ingestion.security_events')).rows
   const encoded=JSON.stringify(events)
   for(const privateValue of[A,B,U,linked.requestId])assert(!encoded.includes(privateValue))
   assert(!encoded.includes('deliveryKey'));assert(!encoded.includes('SHARED_DEMO'))
  })
  await t.test('Source read observes an existing exact command and key and never creates a request',async()=>{
   const key=(await owner.query('SELECT delivery_key FROM profitia_jobs.dispatches WHERE request_id=$1',[linked.requestId])).rows[0].delivery_key
   const before=await sourceCounts()
   assert.deepEqual(await sourceStore.read(linked.command,key),linkedResult.sourceRequest)
   for(const command of[{kind:'SUPPLIER_REPORT',nip:OTHER_NIP},{...linked.command,organisationId:A},{...linked.command,userId:U}])await assert.rejects(sourceStore.read(command,key))
   await assert.rejects(sourceStore.read(linked.command,'a'.repeat(64)),isOperationDenied)
   assert.deepEqual(await sourceCounts(),before)
   const encoded=JSON.stringify((await owner.query('SELECT to_jsonb(e) e FROM profitia_ingestion.effects e')).rows)
   assert(!encoded.includes(key));for(const v of[A,B,U,linked.requestId])assert(!encoded.includes(v))
  })
  await t.test('ordinary Source and customer/executor roles cannot borrow one another data authority',async()=>{
   assert.deepEqual((await rawSource.query('SELECT current_user::text role,session_user::text login')).rows[0],{role:SOURCE,login:SOURCE})
   for(const table of['srm.lookup_requests','srm.source_snapshots','profitia_supplier_requests.commands','profitia_srm_acquisition.outcome_witnesses'])await assert.rejects(rawSource.query('SELECT * FROM '+table),e=>e.code==='42501')
   const human=await pool.connect()
   try{for(const client of[human,rawService])await assert.rejects(client.query('SELECT profitia_srm_acquisition.receipt($1,$2)',[NIP,'a'.repeat(64)]),e=>e.code==='42501')}finally{human.release()}
   await assert.rejects(rawSource.query(own('009-supplier-source-request.sql')),e=>e.code==='42501')
   await assert.rejects(owner.query(own('009-supplier-source-request.sql')),e=>e.code==='42501')
  })
  await t.test('current account and original membership revocation prevent any further Source admission including replay',async()=>{
   const before=await sourceCounts();accountActive=false
   try{await assert.rejects(sourceLink.registerAndAdmit(linked),isOperationDenied)}finally{accountActive=true}
   await owner.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2",[A,U])
   try{await assert.rejects(sourceLink.registerAndAdmit(linked),isOperationDenied)}finally{await owner.query("UPDATE profitia_access.memberships SET status='ACTIVE' WHERE organisation_id=$1 AND user_id=$2",[A,U])}
   assert.deepEqual(await sourceCounts(),before)
  })
  await t.test('current Source revocation also refuses an already confirmed Source record',async()=>{
   const key=(await owner.query('SELECT delivery_key FROM profitia_jobs.dispatches WHERE request_id=$1',[linked.requestId])).rows[0].delivery_key,before=await sourceCounts()
   await owner.query("UPDATE profitia_ingestion.grants SET status='REVOKED' WHERE login_role=$1",[SOURCE])
   try{await assert.rejects(sourceStore.read(linked.command,key),isOperationDenied)}finally{await owner.query("UPDATE profitia_ingestion.grants SET status='ACTIVE' WHERE login_role=$1",[SOURCE])}
   assert.deepEqual(await sourceCounts(),before)
  })
  await t.test('Source schema CREATE or table ACL drift refuses existing record observation',async()=>{
   const key=(await owner.query('SELECT delivery_key FROM profitia_jobs.dispatches WHERE request_id=$1',[linked.requestId])).rows[0].delivery_key
   for(const[grant,revoke]of[[`GRANT CREATE ON SCHEMA profitia_srm_acquisition TO ${SOURCE}`,`REVOKE CREATE ON SCHEMA profitia_srm_acquisition FROM ${SOURCE}`],[`GRANT SELECT ON profitia_srm_acquisition.installation TO ${SOURCE}`,`REVOKE SELECT ON profitia_srm_acquisition.installation FROM ${SOURCE}`]]){
    await owner.query(grant);try{await assert.rejects(sourceStore.read(linked.command,key),isOperationDenied)}finally{await owner.query(revoke)}
   }
  })
  await t.test('current Source classification and exact installation digest are checked for existing records',async()=>{
   const key=(await owner.query('SELECT delivery_key FROM profitia_jobs.dispatches WHERE request_id=$1',[linked.requestId])).rows[0].delivery_key,before=await sourceCounts()
   await owner.query("UPDATE profitia_ingestion.sources SET quality_version='unaccepted-version' WHERE source_id=$1",[SUPPLIER_SOURCE_REQUEST.id])
   try{await assert.rejects(sourceStore.read(linked.command,key),isOperationDenied)}finally{await owner.query("UPDATE profitia_ingestion.sources SET quality_version=$2 WHERE source_id=$1",[SUPPLIER_SOURCE_REQUEST.id,SUPPLIER_SOURCE_REQUEST.qualityVersion])}
   await assert.rejects(createSrmSupplierSourceRequest({...sourceOptions,requestSchemaDigest:'0'.repeat(64)}).read(linked.command,key),isOperationDenied)
   assert.deepEqual(await sourceCounts(),before)
  })
  await t.test('real database guard rejects private fields or a mismatched supplier even if a Source callback incorrectly accepts them',async()=>{
   const incorrectHost=createPlatformIngestionHost({application:sourceOptions.application,binding:sourceOptions.binding,
    source:SUPPLIER_SOURCE_REQUEST,...createSrmNativePgDriver(sourcePool,sourceAudit),validateSharedPayload:()=>true})
   const before=await sourceCounts()
   for(const payload of[{...linked.command,organisationId:A},{...linked.command,userId:U},{...linked.command,nip:OTHER_NIP},{kind:'SUPPLIER_REPORT',nip:'0000000000'}])
    await assert.rejects(incorrectHost.ingest({resourceId:NIP,payload,idempotencyKey:randomUUID()},async()=>{}),isOperationDenied)
   assert.deepEqual(await sourceCounts(),before)
  })
  await t.test('real private register COMMIT refusal releases neither lookup metadata nor Source request',async()=>{
   const s=selection(await parent()),before=await sourceCounts();failInspectionCommit=true
   try{await assert.rejects(sourceLink.registerAndAdmit(s),isOperationDenied)}finally{failInspectionCommit=false}
   assert.deepEqual(await sourceCounts(),before);assert.equal((await owner.query('SELECT 1 FROM srm.lookup_requests WHERE id=$1',[s.requestId])).rowCount,0)
  })
  await t.test('omitting canonical Source OUTCOME rejects actual COMMIT and rolls back Source effect and budget',async()=>{
   const s=selection(await parent()),before=await sourceCounts();omitSourceOutcome=true
   try{await assert.rejects(sourceLink.registerAndAdmit(s),isOperationDenied)}finally{omitSourceOutcome=false}
   assert.deepEqual(await sourceCounts(),before)
   assert.equal((await owner.query('SELECT 1 FROM srm.lookup_requests WHERE id=$1',[s.requestId])).rowCount,1,'Independent valid private registration remains')
  })
  await t.test('Source commit survives failed private observation; original funded retry observes it without a second Source charge',async()=>{
   const s=selection(await parent()),before=await sourceCounts();sourceCommitted=false;failDeliveryCommit=true
   try{await assert.rejects(sourceLink.registerAndAdmit(s),isOperationDenied)}finally{failDeliveryCommit=false}
   assert.deepEqual(await sourceCounts(),{e:before.e+1,b:before.b+1,w:before.w+1})
   assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_jobs.delivery_observations o JOIN profitia_jobs.dispatches j USING(job_id) WHERE j.request_id=$1',[s.requestId])).rows[0].n,0)
   await owner.query("UPDATE profitia_jobs.dispatches SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE request_id=$1",[s.requestId])
   const result=await sourceLink.registerAndAdmit(s);assert.equal(result.sourceStatus,'CONFIRMED')
   assert.deepEqual(await sourceCounts(),{e:before.e+1,b:before.b+1,w:before.w+1})
  })

  }else{
   const cpUrl=new URL(db);cpUrl.username=CORPORATE;cpUrl.password='isolated_ci_only'
   corporatePool=new pg.Pool({connectionString:cpUrl.toString(),max:2});corporateAudit=new pg.Pool({connectionString:cpUrl.toString(),max:1})
   const application={...sourceOptions.application,appId:'srm-corporate-source',deploymentId:'synthetic-company-publication',configurationVersion:'corporate-v1'}
   const shapeText=fs.readFileSync(new URL('../src/server/corporate-source-shape.json',import.meta.url),'utf8')
   const external={configurationVersion:'company-provider-v1',schemaDigest:hash(core('009-external-call-admission.sql')),nativeSchemaDigest:hash(core('012-native-external-transport.sql')),maximumResponseBytes:1024*1024}
   const fullOptions={work:{...workOptions,workSchemaDigest:hash(core('016-delegated-native-work.sql')),workBusinessBoundaryDigest:hash(own('008-supplier-native-work.sql'))},namedInterestBoundaryDigest:hash(own('003-named-supplier-interest.sql')),source:sourceStore,
    corporate:{application,binding:{...sourceOptions.binding,applicationId:application.appId,role:CORPORATE,deploymentId:application.deploymentId,configurationVersion:application.configurationVersion},pool:corporatePool,auditPool:corporateAudit,publicationSchemaDigest:hash(own('004-corporate-source.sql')+own('005-corporate-source-access.sql')+shapeText)},
    mgbi:{apiKey:'synthetic-native-company-key',authScheme:'raw',source:{application:sourceOptions.application,binding:sourceOptions.binding,pool:sourcePool,auditPool:sourceAudit,external,syntheticOrigin},msrExternal:{...external,maximumResponseBytes:20*1024*1024}}}
   const company=createSrmNativeCompanyLookup(fullOptions),FULL_NIP='5260250274'
   const history=async s=>(await owner.query("SELECT snapshot.section,count(*)::int n FROM srm.source_snapshots snapshot JOIN srm.provider_attempts a ON a.organization_id=snapshot.organization_id AND a.id=snapshot.attempt_id WHERE snapshot.organization_id=$1 AND a.request_id=$2 GROUP BY snapshot.section ORDER BY snapshot.section",[s.organisationId,s.requestId])).rows
   let cold,msrSelected
   await t.test('complete original company engine really acquires, privately stores, publishes and calculates under ordinary native roles',async()=>{
    cold=selection(await parent(A,FULL_NIP));const before=networkHits,report=await company.run(cold)
    assert.equal(report.identity.nip,FULL_NIP);assert.equal(report.general.data.legalName,'Synthetic Native Company')
    assert.equal(report.financial.data.indicators.find(i=>i.code==='CURRENT_RATIO').value,'1.500000')
    assert.equal(networkHits,before+2);assert.deepEqual(await history(cold),[{section:'financial',n:1},{section:'general',n:1}])
    assert((await owner.query('SELECT * FROM profitia_srm_catalog.publications WHERE nip=$1',[FULL_NIP])).rowCount>0)
    assert.equal((await owner.query('SELECT count(*)::int n FROM srm.catalog_financial_facts WHERE nip=$1 AND source_organization_id IS NOT NULL',[FULL_NIP])).rows[0].n,0)
    assert(networkObservations.every(x=>x.openTransactions===0))
   })
   await t.test('constructor refuses a provider source different from its genuine admitted Source before any operation',async()=>{
    const before=await counts(),effects=await sourceCounts(),hits=networkHits
    for(const field of['applicationId','environment','projectId','branchId','databaseName','schemaDigest']){
     const value=field==='environment'?'staging':field==='schemaDigest'?'0'.repeat(64):'foreign-binding'
     assert.throws(()=>createSrmNativeCompanyLookup({...fullOptions,mgbi:{...fullOptions.mgbi,source:{...fullOptions.mgbi.source,binding:{...fullOptions.mgbi.source.binding,[field]:value}}}}),isOperationDenied)
    }
    let forgedCalled=false
    assert.throws(()=>createSrmNativeCompanyLookup({...fullOptions,source:{...sourceStore,port:{deliver:async()=>{forgedCalled=true}}}}),isOperationDenied)
    assert.equal(forgedCalled,false);assert.deepEqual(await counts(),before);assert.deepEqual(await sourceCounts(),effects);assert.equal(networkHits,hits)
   })
   await t.test('a new parent in the same organisation has private history without another provider admission or publication',async()=>{
    const fresh=selection(await parent(A,FULL_NIP)),hits=networkHits
    const before=(await owner.query('SELECT (SELECT count(*)::int FROM profitia_external_call.calls)calls,(SELECT count(*)::int FROM profitia_srm_catalog.publications)publications')).rows[0]
    assert.equal((await company.run(fresh)).identity.nip,FULL_NIP)
    assert.notEqual(fresh.requestId,cold.requestId);assert.deepEqual(await history(fresh),[{section:'financial',n:1},{section:'general',n:1}])
    assert.equal(networkHits,hits);assert.deepEqual((await owner.query('SELECT (SELECT count(*)::int FROM profitia_external_call.calls)calls,(SELECT count(*)::int FROM profitia_srm_catalog.publications)publications')).rows[0],before)
   })
   await t.test('foreign organisation or command and a revoked original account cannot reuse the accepted parent',async()=>{
    const denied=error=>isOperationDenied(error)||isOperationDenied(error.cause)
    const before=await counts(),effects=await sourceCounts(),hits=networkHits
    for(const invalid of[{...cold,organisationId:B},{...cold,command:{kind:'SUPPLIER_REPORT',nip:OTHER_NIP}},{...cold,requestId:randomUUID()}])await assert.rejects(company.run(invalid),denied)
    accountActive=false;try{await assert.rejects(company.run(cold),denied)}finally{accountActive=true}
    assert.deepEqual(await counts(),before);assert.deepEqual(await sourceCounts(),effects);assert.equal(networkHits,hits)
   })
   await t.test('RLS predicate execution gives no direct catalogue access or private authority outside the actual current native operation',async()=>{
    assert.equal((await rawService.query('SELECT * FROM srm.catalog_companies')).rowCount,0)
    assert.equal((await rawService.query('SELECT srm.corporate_catalog_scope($1,true) allowed',[FULL_NIP])).rows[0].allowed,false)
    assert.equal((await corporatePool.query('SELECT * FROM srm.catalog_companies')).rowCount,0)
    assert.equal((await corporatePool.query('SELECT srm.current_supplier_work() descriptor')).rows[0].descriptor,null)
    for(const table of['srm.lookup_requests','srm.source_snapshots','profitia_supplier_requests.commands'])await assert.rejects(corporatePool.query('SELECT * FROM '+table),e=>e.code==='42501')
   })
   await t.test('warm universal cache creates real private history for a new parent in another organisation without another provider acquisition',async()=>{
    const warm=selection(await parent(B,FULL_NIP)),before=networkHits,report=await company.run(warm)
    assert.equal(report.identity.nip,FULL_NIP);assert.equal(networkHits,before)
    assert.equal(report.financial.data.indicators.find(i=>i.code==='CURRENT_RATIO').value,'1.500000')
    assert.deepEqual(await history(warm),[{section:'financial',n:1},{section:'general',n:1}])
    const lists=(await owner.query('SELECT organization_id FROM srm.organization_supplier_interest WHERE nip=$1 ORDER BY organization_id',[FULL_NIP])).rows
    assert.deepEqual(lists,[{organization_id:A},{organization_id:B}])
   })
   await t.test('retrying the same completed parent preserves its private history and never purchases the provider twice',async()=>{
    const before=await counts(),effects=await sourceCounts(),hits=networkHits,previous=await history(cold)
    const report=await company.run(cold)
    assert.equal(report.identity.nip,FULL_NIP)
    assert.equal(report.financial.data.indicators.find(i=>i.code==='CURRENT_RATIO').value,'1.500000')
    assert.deepEqual(await history(cold),previous);assert.deepEqual(await sourceCounts(),effects);assert.equal(networkHits,hits)
    const after=await counts();assert.equal(after.lookups,before.lookups)
   })
   await t.test('completed private sections refuse conflicting data, source identity, date and replacement financial facts',async()=>{
    const before=await counts(),hits=networkHits
    const record=(await owner.query("SELECT s.payload_json,s.source_record_id,s.retrieved_at,s.effective_at,p.data_json FROM srm.provider_attempts a JOIN srm.source_snapshots s ON s.organization_id=a.organization_id AND s.attempt_id=a.id JOIN srm.section_projections p ON p.organization_id=s.organization_id AND p.snapshot_id=s.id WHERE a.organization_id=$1 AND a.request_id=$2 AND a.section='financial'",[A,cold.requestId])).rows[0]
    const envelope={status:'SUCCESS',source:{provider:'MGBI',model:'pl-krs-rdf-record',recordId:record.source_record_id},data:record.data_json,retrievedAt:record.retrieved_at.toISOString(),effectiveAt:record.effective_at.toISOString(),warnings:[]}
    const denied=error=>isOperationDenied(error)||isOperationDenied(error.cause)
    for(const change of[e=>{e.data.periods[0].facts[0].amount='999'},e=>{e.source.recordId='d'.repeat(24)},e=>{e.effectiveAt='2025-12-30'}]){
     const changed=structuredClone(envelope);change(changed)
     await assert.rejects(nativeStore.section(cold,'financial',changed,null,[],undefined,record.payload_json,'CACHE'),denied)
    }
    await assert.rejects(nativeStore.section(cold,'financial',envelope,null,[{sourcePath:'content.fake'}],undefined,record.payload_json,'CACHE'),denied)
    assert.deepEqual(await counts(),before);assert.equal(networkHits,hits)
   })
   await t.test('complete original MSR path downloads one actual original and preserves its parsed receipt and projection',async()=>{
    fileMode=true
    try{
     const selected=selection(await parent(A,'1234567802')),before=fileHits,limits=limitsHits
     msrSelected=selected
     let report
     try{report=await company.run(selected)}catch(error){
      const receipts=(await owner.query('SELECT state,original_format,error_code FROM srm.msr_sources WHERE organization_id=$1 AND nip=$2',[A,selected.command.nip])).rows
      console.error('ISOLATED_MSR_COMPOSITION_DIAGNOSTIC',JSON.stringify({name:error.name,message:error.message,cause:error.cause?.message,receipts}));throw error
     }
     assert.equal(fileHits,before+1);assert.equal(limitsHits,limits+1)
     const receipt=(await owner.query('SELECT state,original_format,encode(sha256(original_bytes),\'hex\')=original_sha256 integrity FROM srm.msr_sources WHERE organization_id=$1 AND nip=$2',[A,selected.command.nip])).rows
     assert.deepEqual(receipt,[{state:'READY',original_format:'XHTML',integrity:true}])
     assert(report.financial.data.periods.some(p=>p.facts.some(f=>f.metricCode==='MSR_REVENUE'&&f.amount==='123')))
     assert.deepEqual(await history(selected),[{section:'financial',n:1},{section:'general',n:1}])
    }finally{fileMode=false}
   })
   await t.test('the same completed MSR parent reuses its identical original financial provenance without another acquisition',async()=>{
    const files=fileHits,limits=limitsHits,hits=networkHits,before=await history(msrSelected),effects=await sourceCounts(),privateState=await counts()
    const external=(await owner.query('SELECT count(*)::int n FROM profitia_external_call.calls')).rows[0].n
    const report=await company.run(msrSelected)
    assert(report.financial.data.periods.some(p=>p.facts.some(f=>f.metricCode==='MSR_REVENUE'&&f.amount==='123')))
    assert.equal(fileHits,files);assert.equal(limitsHits,limits);assert.equal(networkHits,hits)
    assert.deepEqual(await history(msrSelected),before)
    const publications=(await owner.query('SELECT packet,body_digest FROM profitia_srm_catalog.publications WHERE nip=$1 ORDER BY recorded_at',[msrSelected.command.nip])).rows
    assert.equal(publications.length,2);assert.equal(publications[0].packet.preserveGeneral,false);assert.equal(publications[1].packet.preserveGeneral,true)
    assert.deepEqual({...publications[1].packet,preserveGeneral:false},publications[0].packet)
    // The original cache engine submits a distinct financial-only Source
    // projection. Its one SQL admission is not another provider purchase or
    // customer quota charge; replaying that exact packet is idempotent.
    const projected={e:effects.e+1,b:effects.b+1,w:effects.w}
    assert.deepEqual(await sourceCounts(),projected)
    await company.run(msrSelected)
    assert.deepEqual(await sourceCounts(),projected);assert.deepEqual(await counts(),privateState)
    assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_external_call.calls')).rows[0].n,external)
    assert.equal(fileHits,files);assert.equal(limitsHits,limits);assert.equal(networkHits,hits);assert.deepEqual(await history(msrSelected),before)
   })
   await t.test('identical typed MSR facts replay but altered provenance, unknown fields and duplicates do not',async()=>{
    const record=(await owner.query("SELECT s.id,s.payload_json,s.source_record_id,s.retrieved_at,s.effective_at,p.data_json FROM srm.provider_attempts a JOIN srm.source_snapshots s ON s.organization_id=a.organization_id AND s.attempt_id=a.id JOIN srm.section_projections p ON p.organization_id=s.organization_id AND p.snapshot_id=s.id WHERE a.organization_id=$1 AND a.request_id=$2 AND a.section='financial'",[A,msrSelected.requestId])).rows[0]
    const facts=(await owner.query(`SELECT metric_code "metricCode",period_start::text "periodStart",period_end::text "periodEnd",period_type "periodType",statement_scope "statementScope",amount::text amount,source_amount::text "sourceAmount",normalization_rule "normalizationRule",currency_code "currencyCode",unit_code "unitCode",source_path "sourcePath",validation_status "validationStatus" FROM srm.financial_facts WHERE organization_id=$1 AND snapshot_id=$2`,[A,record.id])).rows
    assert.equal(facts.length,1);assert.equal(facts[0].amount,'123.0000')
    const envelope={status:'SUCCESS',source:{provider:'MGBI',model:'pl-krs-rdf-record',recordId:record.source_record_id},data:record.data_json,retrievedAt:record.retrieved_at.toISOString(),effectiveAt:record.effective_at?.toISOString()??null,warnings:[]}
    const before=await counts(),hits=networkHits
    assert.equal(await nativeStore.section(msrSelected,'financial',envelope,null,facts,undefined,record.payload_json,'CACHE'),record.id)
    const denied=error=>isOperationDenied(error)||isOperationDenied(error.cause)
    for(const change of[f=>{f[0].sourcePath='c'.repeat(24)+'.iXBRL.foreign-fact'},f=>{f[0].sourceAmount='124'},f=>{f.push(structuredClone(f[0]))},f=>{f[0].ownerOrganisationId=A}]){
     const altered=structuredClone(facts);change(altered)
     await assert.rejects(nativeStore.section(msrSelected,'financial',envelope,null,altered,undefined,record.payload_json,'CACHE'),denied)
    }
    assert.deepEqual(await counts(),before);assert.equal(networkHits,hits)
   })
   await t.test('an actually interrupted MSR HTTP acquisition stays BLOCKED and a fresh parent never purchases it again',async()=>{
    fileMode=true;failFile=true
    try{
     const selected=selection(await parent(A,NIP)),before=fileHits
     const report=await company.run(selected)
     assert.equal(fileHits,before+1);assert.equal(report.identity.nip,NIP)
     let receipt=(await owner.query('SELECT state,error_code,original_bytes IS NULL no_original FROM srm.msr_sources WHERE organization_id=$1 AND nip=$2',[A,NIP])).rows
     assert.deepEqual(receipt,[{state:'BLOCKED',error_code:'MSR_DOWNLOAD_RECONCILIATION_REQUIRED',no_original:true}])
     failFile=false
     await company.run(selection(await parent(A,NIP)))
     assert.equal(fileHits,before+1)
     receipt=(await owner.query('SELECT state,error_code FROM srm.msr_sources WHERE organization_id=$1 AND nip=$2',[A,NIP])).rows
     assert.deepEqual(receipt,[{state:'BLOCKED',error_code:'MSR_DOWNLOAD_RECONCILIATION_REQUIRED'}])
     assert(networkObservations.every(x=>x.openTransactions===0))
    }finally{fileMode=false;failFile=false}
   })
  }
 }finally{if(server)await new Promise(resolve=>server.close(resolve));await corporatePool?.end();await corporateAudit?.end();await pool?.end();await auditPool?.end();await servicePool?.end();await serviceAudit?.end();await rawService?.end();await sourcePool?.end();await sourceAudit?.end();await rawSource?.end();await owner?.end();await root.end()}
}

test('actual SRM business writers use current ordinary Service phases without changing the human owner or business engine',t=>supplierBusinessFixture(t))
test('complete original native company composition uses real private and independent provider/corporate Source boundaries',t=>supplierBusinessFixture(t,true))
