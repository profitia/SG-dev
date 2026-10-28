import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import pg from 'pg'
import http from 'node:http'
import {createSrmCompanyClassifier} from '../src/server/company-classification.ts'
import {srmProviderSourcePolicy} from '../src/server/provider-source-transport.ts'
import {randomUUID} from 'node:crypto'
import {supplierBusinessFixture} from './supplier-delegated-business.integration.test.mjs'
import {withSupplierTelemetry} from '../src/server/supplier-telemetry.ts'
import {createSrmNativeCompanyLookup} from '../src/server/supplier-native-company.ts'
import {createSrmCorporateSourceStore,CORPORATE_PUBLICATION_VERSION} from '../src/server/corporate-source-store.ts'
import {createSrmReadyCompanyRead} from '../src/server/ready-report-read.ts'
import {PREPARED_REPORT_RULES,PREPARED_REPORT_VERSION} from '../src/server/ready-report.ts'
import {mapMgbiGeneralRecords} from '../src/server/mgbi-general.ts'
import {mapMgbiFinancialRecords} from '../src/server/mgbi-financial.ts'
import {createSrmSupplierNativeWork} from '../src/server/supplier-request-work.ts'
import {createSrmSupplierNativeWorkStore} from '../src/server/supplier-native-work-store.ts'
import {isOperationDenied} from '@profitia/platform-contracts/operation-context'

const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8')
test('ready report native Source and current HUMAN read preserve complete financial output, tenant history and rollback',t=>supplierBusinessFixture(t,true,async f=>{
 const {owner,controlled,humanOptions,sourceOptions,baseBinding,A,B,U,NIP,FOREGROUND,own,hash}=f
 const sourceRole='srm_company_publication_runtime',shape=read('../src/server/ready-report-shape.json')
 const digest=hash(own('024-ready-report-history.sql')+own('025-ready-report-history.sql')+shape+JSON.stringify(PREPARED_REPORT_RULES))
 await owner.query('BEGIN;SET LOCAL ROLE profitia_ingestion_owner')
 try{await owner.query('GRANT EXECUTE ON FUNCTION profitia_srm_catalog.valid_shape(jsonb,jsonb,jsonb,integer),profitia_srm_catalog.unique_keys(json,integer),profitia_srm_catalog.immutable() TO profitia_access_owner');await owner.query('COMMIT')}catch(e){await owner.query('ROLLBACK');throw e}
 await controlled(async()=>{
  console.info('READY_PREDECESSORS',JSON.stringify((await owner.query("SELECT proname,md5(prosrc) digest FROM pg_proc WHERE oid IN('srm.current_supplier_work(uuid,uuid,text)'::regprocedure,'srm.native_supplier_row(text,uuid,uuid,uuid,uuid,text,text,text)'::regprocedure,'srm.supplier_business_phase(uuid,text,uuid,text[])'::regprocedure) ORDER BY proname")).rows))
  await owner.query(own('024-ready-report-history.sql'));await owner.query(own('025-ready-report-history.sql'));await owner.query(own('026-ready-company-work.sql'))
  await owner.query("INSERT INTO srm.ready_company_work_installation SELECT true,$1,$2,$3,service_id FROM profitia_services.runtime_bindings WHERE login_role=$3",[hash(own('026-ready-company-work.sql')),'a'.repeat(40),f.EXECUTOR])
  await owner.query('INSERT INTO srm.ready_report_installation(version,schema_digest,field_schema,rules,source_ref) VALUES($1,$2,$3,$4,$5)',[PREPARED_REPORT_VERSION,digest,shape,JSON.stringify(PREPARED_REPORT_RULES),'a'.repeat(40)])
  await owner.query(`GRANT SELECT,INSERT ON srm.ready_company_reports TO ${sourceRole};GRANT SELECT ON srm.ready_company_reports TO ${FOREGROUND};
   GRANT EXECUTE ON FUNCTION srm.ready_report_descriptor(),srm.publish_ready_report(text,uuid,text,text,text) TO ${sourceRole};
   GRANT EXECUTE ON FUNCTION srm.register_ready_report_read(uuid,uuid,text,text,uuid,jsonb) TO ${FOREGROUND}`)
  await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'srm',$2,$3,'ALLOW','supplier.report.read','supplier_report')",[randomUUID(),A,U])
 })
 const url=new URL(process.env.SRM_OPERATION_TEST_OWNER_URL);url.pathname='/'+baseBinding.databaseName;url.username=sourceRole;url.password='isolated_ci_only'
 const pool=new pg.Pool({connectionString:url.toString(),max:2}),auditPool=new pg.Pool({connectionString:url.toString(),max:1})
 try{
  const application={...sourceOptions.application,appId:'srm-corporate-source',deploymentId:'synthetic-company-publication',configurationVersion:'corporate-v1'}
  const source=createSrmCorporateSourceStore({application,binding:{...sourceOptions.binding,applicationId:application.appId,role:sourceRole,deploymentId:application.deploymentId,configurationVersion:application.configurationVersion},pool,auditPool,
   publicationSchemaDigest:hash(own('004-corporate-source.sql')+own('005-corporate-source-access.sql')+read('../src/server/corporate-source-shape.json')),readyReportSchemaDigest:digest})
  const at=new Date().toISOString(),KRS='0000000001'
  const general=mapMgbiGeneralRecords([{id:'a'.repeat(24),identifiers:{pl_nip:NIP,pl_krs:KRS},content:{current_excerpt:{
   naglowekA:{numerKRS:KRS,dataRejestracjiWKRS:'2001-01-01'},dane:{dzial1:{danePodmiotu:{nazwa:'Synthetic READY company',formaPrawna:'SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ'}}}}}}],{type:'NIP',value:NIP},at).section
  const financial=mapMgbiFinancialRecords([{id:'b'.repeat(24),identifiers:{pl_nip:NIP,pl_krs:KRS},document:{type:'financial_statement',period_from_date:'2025-01-01',period_to_date:'2025-12-31',is_ias_compliant:false},
   content:{schema:{name:'JednostkaInnaWZlotych'},standardized_fields:{bs:{a_ta_cfy:'100',a_ca_cfy:'60',lae_lapfl_stl_cfy:'20',lae_lapfl_cfy:'40'},pala:{nrfs_cfy:'200',npl_cfy:'10',plfoa_cfy:'15'}}}}],{type:'NIP',value:NIP},at,1,general.data.registryHistory)
  const packet={version:CORPORATE_PUBLICATION_VERSION,nip:NIP,general,financial:financial.section,facts:financial.facts,preserveGeneral:false}
  await t.test('FRESH writes both original private sections in one Work with current authorization and provenance',async()=>{
   const accepted=await f.parent(A,NIP),selection={requestId:accepted.requestId,organisationId:A,command:accepted.command}
   const work=createSrmSupplierNativeWork({...f.workOptions,workSchemaDigest:hash(f.core('016-delegated-native-work.sql')),workBusinessBoundaryDigest:hash(own('008-supplier-native-work.sql'))})
   const store=createSrmSupplierNativeWorkStore({work,namedInterestBoundaryDigest:hash(own('003-named-supplier-interest.sql')),readyCompanyWorkBoundaryDigest:hash(own('026-ready-company-work.sql'))})
   await store.register(selection)
   const before=(await owner.query("SELECT count(*)::int n FROM profitia_access.security_events WHERE event->>'requestWork' IS NOT NULL")).rows[0].n
   const stored=await store.companySections(selection,{envelope:general,errorCode:null},{envelope:financial.section,errorCode:financial.errorCode,facts:financial.facts})
   assert(stored.generalSnapshotId);assert(stored.financialSnapshotId)
   const events=(await owner.query("SELECT phase,event FROM profitia_access.security_events WHERE event->'requestWork'->>'unitId'='SRM_STORE_COMPANY' ORDER BY event_id")).rows
   assert.deepEqual(events.map(e=>e.phase),['INTENT','OUTCOME']);assert(events.every(e=>e.event.decision==='ALLOW'))
   assert.equal((await owner.query("SELECT count(*)::int n FROM srm.source_snapshots WHERE organization_id=$1 AND id=ANY($2::uuid[])",[A,[stored.generalSnapshotId,stored.financialSnapshotId]])).rows[0].n,2)
  })
  await t.test('revocation inside the consolidated FRESH Work rolls back both sections together',async()=>{
   const accepted=await f.parent(A,NIP),selection={requestId:accepted.requestId,organisationId:A,command:accepted.command}
   const config={...f.workOptions,workSchemaDigest:hash(f.core('016-delegated-native-work.sql')),workBusinessBoundaryDigest:hash(own('008-supplier-native-work.sql'))}
   const ordinary=createSrmSupplierNativeWorkStore({work:createSrmSupplierNativeWork(config),namedInterestBoundaryDigest:hash(own('003-named-supplier-interest.sql'))})
   await ordinary.register(selection)
   let checks=0
   const revoked={...config.clerk,users:{getUser:async(...args)=>({...await config.clerk.users.getUser(...args),banned:++checks===2})}}
   const store=createSrmSupplierNativeWorkStore({work:createSrmSupplierNativeWork({...config,clerk:revoked}),namedInterestBoundaryDigest:hash(own('003-named-supplier-interest.sql')),readyCompanyWorkBoundaryDigest:hash(own('026-ready-company-work.sql'))})
   const before=await f.counts()
   await assert.rejects(store.companySections(selection,{envelope:general,errorCode:null},{envelope:financial.section,errorCode:financial.errorCode,facts:financial.facts}),isOperationDenied)
   assert.equal(checks,2);assert.deepEqual(await f.counts(),before)
  })
  await t.test('CEIDG classification uses the report command and native Source without private JDG or company snapshot writes',async()=>{
   let hits=0,mode='EMPTY'
   const server=http.createServer((request,response)=>{
    hits++;assert.equal(new URL(request.url,'http://local').searchParams.get('nip'),NIP)
    response.statusCode=mode==='EMPTY'?204:mode==='OUTAGE'?503:200
    response.setHeader('content-type','application/json');response.end(mode==='JDG'?JSON.stringify({firma:[{id:'synthetic',nazwa:'PRIVATE BUSINESS',wlasciciel:{nip:NIP,imie:'PRIVATE PERSON'}}]}):undefined)
   })
   await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port
   const policy=srmProviderSourcePolicy('CEIDG'),id=randomUUID(),role=sourceOptions.binding.role
   await owner.query('BEGIN;SET LOCAL ROLE profitia_ingestion_owner')
   try{
    await owner.query("INSERT INTO profitia_ingestion.sources(source_id,effect_kind,data_class,payload_schema,quality_version,classification_version,projection_version,status,source_ref,expires_at) VALUES($1,'STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE',$2,$3,$4,'source-receipt-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",Object.values(policy.source))
    await owner.query("INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,'ALLOW','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[randomUUID(),role,policy.source.id])
    await owner.query("INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,'srm-provider-source',$2,'SOURCE_TRANSACTION',100,now()-interval '1 hour',now()+interval '1 hour',now()+interval '1 hour','ACTIVE','SYNTHETIC_ONLY')",[randomUUID(),policy.source.id])
    await owner.query("INSERT INTO profitia_external_call.policies(policy_id,login_role,source_id,resource_id,configuration_version,origin,transport,path_rules,maximum_request_bytes,maximum_response_bytes,timeout_ms,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,$2,$3,$4,'classification-provider-v1',$5,'LOCAL_SYNTHETIC_HTTP',$6::jsonb,8192,1048576,20000,'UPSTREAM_ATTEMPT_ADMISSION',30,now()-interval '1 hour',now()+interval '1 hour',now()+interval '1 hour','ACTIVE','SYNTHETIC_ONLY')",[id,role,policy.source.id,policy.resourceId,origin,JSON.stringify(policy.basePathRules)])
    await owner.query("INSERT INTO profitia_external_native.policies(policy_id,base_policy_version,path_rules,redirect_origins,maximum_response_bytes,credential_mode,completion_mode,status,expires_at,source_ref) VALUES($1,1,$2::jsonb,'[]'::jsonb,1048576,'SERVER_HEADERS','ADMITTED_ATTEMPT_CURRENT_SETTLEMENT','ACTIVE',now()+interval '1 hour','SYNTHETIC_ONLY')",[id,JSON.stringify(policy.pathRules)])
    await owner.query('COMMIT')
   }catch(e){await owner.query('ROLLBACK');server.close();throw e}
   const classifier=createSrmCompanyClassifier({work:{...f.workOptions,workSchemaDigest:hash(f.core('016-delegated-native-work.sql')),workBusinessBoundaryDigest:hash(own('008-supplier-native-work.sql'))},source:f.source,
    apiKey:'synthetic-ceidg-token',provider:{...sourceOptions,syntheticOrigin:origin,external:{configurationVersion:'classification-provider-v1',schemaDigest:hash(f.core('009-external-call-admission.sql')),nativeSchemaDigest:hash(f.core('012-native-external-transport.sql')),maximumResponseBytes:1048576}}})
   try{
    for(const [selected,expected]of [['EMPTY','NOT_JDG'],['JDG','JDG'],['OUTAGE','UNAVAILABLE']]){
     mode=selected;const accepted=await f.parent(A,NIP),selection={requestId:accepted.requestId,organisationId:A,command:accepted.command},before=await f.counts(),calls=hits
     assert.equal(await classifier.classify(selection,new AbortController().signal),expected);assert.equal(hits,calls+1)
     assert.deepEqual(await f.counts(),before)
    }
   }finally{await new Promise(resolve=>server.close(resolve))}
  })
  let prepared
  await t.test('the original corporate publication atomically prepares one public report without private document storage',async()=>{
   await source.publish(packet,hash('ready-source:'+randomUUID()),{documents:[],onPrepared:value=>{prepared=value}})
   assert(prepared);assert.equal(prepared.nip,NIP)
   const rows=(await owner.query('SELECT * FROM srm.ready_company_reports WHERE nip=$1',[NIP])).rows
   assert.equal(rows.length,1);assert.equal(rows[0].body_json.report.kys.reportAvailable,false)
   assert(!rows[0].body_text.includes('scanner_documents'))
   assert((await owner.query("SELECT count(*)::int n FROM profitia_ingestion.security_events WHERE decision_id=(SELECT decision_id FROM profitia_srm_catalog.publications WHERE effect_id=$1) AND phase='OUTCOME' AND event->>'decision'='ALLOW'",[rows[0].publication_effect])).rows[0].n===1)
  })
  let sdk=0,sessions=0,accounts=0,banAtOutcome=false
  const original=humanOptions.clerk
  const clerk={authenticateRequest:async(...args)=>{sdk++;return original.authenticateRequest(...args)},sessions:{getSession:async(...args)=>{sessions++;return original.sessions.getSession(...args)}},users:{getUser:async(...args)=>{accounts++;const user=await original.users.getUser(...args);return {...user,banned:banAtOutcome&&accounts%2===0}}}}
  const {requestLedger,commandBoundaryDigest,...base}=humanOptions
  const ready=createSrmReadyCompanyRead({...base,clerk,application:{...base.application,operations:['supplier.report.read']}},digest,'s'.repeat(40))
  const request=()=>new Request('http://localhost:3400/api/xray/search',{method:'POST',headers:{origin:'http://localhost:3400'}})
  const counts=async()=>(await owner.query('SELECT (SELECT count(*)::int FROM srm.ready_report_reads) reads,(SELECT count(*)::int FROM srm.lookup_requests) lookups,(SELECT count(*)::int FROM srm.source_snapshots) snapshots,(SELECT coalesce(sum(accepted_count),0)::int FROM profitia_requests.policies) quota')).rows[0]
  let first
  await t.test('READY uses one SDK authentication, two fresh session/account checks, one Root and no Work or refresh charge',async()=>{
   const before=await counts(),work=(await owner.query("SELECT count(*)::int n FROM profitia_access.security_events WHERE event->>'operation'='job.execute'")).rows[0].n
   let telemetry
   const logger=console.info
   console.info=value=>{try{const parsed=JSON.parse(value);if(parsed.event==='srm_supplier_timing')telemetry=parsed}catch{}}
   try{await withSupplierTelemetry('search',async()=>{first=await ready.read(request(),A,NIP);return first.response})}finally{console.info=logger}
   console.info('READY_LOCAL_E1_COUNTS',JSON.stringify({sql:telemetry?.stages?.E1_SQL?.count,work:telemetry?.work?.length,accounts,sessions,sdk}))
   assert.equal(first.known,true);assert(first.response)
   const body=await first.response.json();assert.equal(body.identity.nip,NIP);assert.equal(body.metadata.nip,NIP)
   assert(body.metadata.financial.scanner);assert(body.metadata.locationSubject.supplierId);assert.match(body.metadata.preferenceScope,/^[a-f0-9]{64}$/)
   assert.deepEqual(body.metadata.financial.periods,prepared.report.financial.periods)
   assert.deepEqual([sdk,sessions,accounts],[1,2,2])
   const after=await counts();assert.equal(after.reads,before.reads+1);assert.equal(after.lookups,before.lookups+1);assert.equal(after.snapshots,before.snapshots);assert.equal(after.quota,before.quota)
   assert.equal((await owner.query("SELECT count(*)::int n FROM profitia_access.security_events WHERE event->>'operation'='job.execute'")).rows[0].n,work)
   assert.equal((await owner.query('SELECT count(*)::int n FROM srm.ready_report_read_outcomes')).rows[0].n,1)
  })
  await t.test('complete native FRESH pipeline prepares the report once and the next READY opening performs no Work',async()=>{
   const selectedNip='5260250274',accepted=await f.parent(A,selectedNip)
   const syntheticOrigin=(await owner.query("SELECT origin FROM profitia_external_call.policies WHERE resource_id='srm-provider:mgbi' LIMIT 1")).rows[0].origin
   const external={configurationVersion:'company-provider-v1',schemaDigest:hash(f.core('009-external-call-admission.sql')),nativeSchemaDigest:hash(f.core('012-native-external-transport.sql')),maximumResponseBytes:1048576}
   const native=createSrmNativeCompanyLookup({companySourcePolicy:'MGBI_ONLY',work:{...f.workOptions,workSchemaDigest:hash(f.core('016-delegated-native-work.sql')),workBusinessBoundaryDigest:hash(own('008-supplier-native-work.sql'))},
    namedInterestBoundaryDigest:hash(own('003-named-supplier-interest.sql')),financialInventoryBoundaryDigest:hash(own('023-financial-inventory-work.sql')),readyCompanyWorkBoundaryDigest:hash(own('026-ready-company-work.sql')),source:f.source,
    corporate:{application,binding:{...sourceOptions.binding,applicationId:application.appId,role:sourceRole,deploymentId:application.deploymentId,configurationVersion:application.configurationVersion},pool,auditPool,
      publicationSchemaDigest:hash(own('004-corporate-source.sql')+own('005-corporate-source-access.sql')+read('../src/server/corporate-source-shape.json')),readyReportSchemaDigest:digest},
    mgbi:{apiKey:'synthetic-native-company-key',authScheme:'raw',source:{...sourceOptions,external,syntheticOrigin},msrExternal:{...external,maximumResponseBytes:20*1024*1024}}})
   const card=await native.run({requestId:accepted.requestId,organisationId:A,command:accepted.command})
   assert.equal(card.identity.nip,selectedNip);assert(card.financial.data)
   const units=(await owner.query("SELECT event->'requestWork'->>'unitId' unit FROM profitia_access.security_events WHERE event->'requestWork'->>'requestId'=$1 AND phase='OUTCOME' ORDER BY event_id",[accepted.requestId])).rows.map(r=>r.unit)
   assert(units.includes('SRM_STORE_COMPANY'));assert(!units.includes('SRM_STORE_GENERAL'));assert(!units.includes('SRM_STORE_FINANCIAL'));assert(!units.includes('SRM_RECORD_INTEREST'))
   assert.equal(units.filter(unit=>unit==='SRM_CACHE_READ').length,1,'no indicator reconstruction Work')
   const before=(await owner.query("SELECT count(*)::int n FROM profitia_access.security_events WHERE event->>'operation'='job.execute'")).rows[0].n
   const result=await ready.read(request(),A,selectedNip);assert(result.response)
   const output=await result.response.json();assert(output.metadata.financial.scanner);assert(output.metadata.financial.history.length)
   assert.equal((await owner.query("SELECT count(*)::int n FROM profitia_access.security_events WHERE event->>'operation'='job.execute'")).rows[0].n,before)
   console.info('READY_FRESH_LOCAL_UNITS',JSON.stringify(units))
  })
  await t.test('account revocation before disclosure rolls back local selection history and withholds every report field',async()=>{
   const before=await counts();banAtOutcome=true
   await assert.rejects(ready.read(request(),A,NIP),isOperationDenied)
   assert.deepEqual(await counts(),before);banAtOutcome=false
  })
  await t.test('a Source revision between entry and disclosure cannot release a mixed prepared report',async()=>{
   let checks=0
   const changed=structuredClone(packet);changed.general.data.registeredAddress='Synthetic changed registered address'
   const racing={...base,clerk:{...original,users:{getUser:async(...args)=>{
     if(++checks===2)await source.publish(changed,hash('ready-racing-source:'+randomUUID()),{documents:[]})
     return original.users.getUser(...args)
    }}},application:{...base.application,operations:['supplier.report.read']}}
   const reader=createSrmReadyCompanyRead(racing,digest,'s'.repeat(40)),before=await counts()
   await assert.rejects(reader.read(request(),A,NIP),error=>isOperationDenied(error)&&error.reasonCode==='RESOURCE_VERSION_CONFLICT')
   assert.deepEqual(await counts(),before);assert.equal(checks,2)
   assert((await owner.query('SELECT count(*)::int n FROM srm.ready_company_reports WHERE nip=$1',[NIP])).rows[0].n>=2)
  })
  await t.test('module membership without the standard report read grant cannot read another organization',async()=>{
   const before=await counts();await assert.rejects(ready.read(request(),B,NIP),isOperationDenied);assert.deepEqual(await counts(),before)
  })
  await t.test('an explicit supplier DENY still overrides standard shared module read access',async()=>{
   const id=randomUUID();await controlled(()=>owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,resource_id,feature) VALUES($1,'srm',$2,$3,'DENY','supplier.report.read',$4,'supplier_report')",[id,A,U,'supplier-report:COMPANY:'+NIP]))
   const before=await counts();await assert.rejects(ready.read(request(),A,NIP),isOperationDenied);assert.deepEqual(await counts(),before)
   await controlled(()=>owner.query('DELETE FROM profitia_access.permission_grants WHERE grant_id=$1',[id]))
  })
  await t.test('unadmitted SQL cannot fabricate metadata history or a current read from GUCs alone',async()=>{
   const client=await f.pool.connect()
   try{await assert.rejects(client.query('SELECT srm.register_ready_report_read($1,$2,$3,$4,$5,$6)',[A,U,NIP,'a'.repeat(64),randomUUID(),'null']))}finally{client.release()}
  })
 }finally{await pool.end();await auditPool.end()}
},{companySourcePolicy:'MGBI_ONLY',privateAcquisition:true}))
