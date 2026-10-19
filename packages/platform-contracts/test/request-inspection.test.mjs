import assert from 'node:assert/strict'
import test from 'node:test'
import {randomUUID} from 'node:crypto'
import {createRequestInspection,REQUEST_INSPECTION_CONTRACT,requestInspectionSchemaDigest} from '../src/request-inspection.mjs'
import {createDelegatedPrivateInspectionHost,createDelegatedJobHost} from '../src/private-operation-host.mjs'
import {isOperationDenied} from '../src/operation-context.mjs'

const R=randomUUID(),A=randomUUID(),U=randomUUID(),S=randomUUID(),D=randomUUID()
const binding={applicationId:'worker',environment:'development',projectId:'fixture-project',branchId:'fixture-branch',databaseName:'fixture_db',role:'fixture_runtime',schemaDigest:'a'.repeat(64),service:{schemaDigest:'b'.repeat(64),profileId:'PLATFORM_INTERNAL',deploymentId:'fixture',configurationVersion:'v1'}}
const inspection={requestId:R,phaseId:'REGISTER_LOOKUP',schemaDigest:'c'.repeat(64),continuationSchemaDigest:'d'.repeat(64),delegatedSchemaDigest:'e'.repeat(64)}
function fixture(){
 let current={applicationId:'worker',environment:'development',projectId:'fixture-project',branchId:'fixture-branch',databaseName:'fixture_db',role:'fixture_runtime',owner:'profitia_access_owner',
  schemaVersion:'1.0.0',schemaDigest:inspection.continuationSchemaDigest,delegatedSchemaVersion:'1.0.0',delegatedSchemaDigest:inspection.delegatedSchemaDigest,
  inspectionSchemaVersion:'1.0.0',inspectionSchemaDigest:inspection.schemaDigest,effect:'PRIVATE_SQL_READ',operation:'supplier.report.refresh',requestId:R,phaseId:'REGISTER_LOOKUP',
  inputDigest:'f'.repeat(64),payloadDigest:'1'.repeat(64),policyVersion:'1',transactionId:'20',acceptedTransactionId:'10',executorServiceId:S,subjectUserId:U,organisationId:A,delegationId:D,
  parentApplicationId:'srm',resourceId:'supplier-request:fixture',expiresAt:new Date(Date.now()+3600000).toISOString()}
 const calls=[],store=createRequestInspection({binding,inspection})
 const query=async(sql,args)=>{calls.push({sql,args});return{rows:sql.includes('.descriptor(')?[{descriptor:structuredClone(current)}]:[{allowed:true}]}}
 const load=()=>store.load(query,{request:{operation:'job.execute',resourceId:R},lease:{state:{delegation:{target:{operation:'supplier.report.refresh'}}}}})
 const context=handle=>({actorKind:'SERVICE',actorId:S,applicationId:'worker',environment:'development',subjectUserId:U,organisationId:A,operation:'job.execute',resourceId:R,payloadDigest:'1'.repeat(64),decisionId:randomUUID(),correlationId:randomUUID(),
  delegation:{requestId:R,delegationId:D,target:{application:{appId:'srm'},operation:'supplier.report.refresh',resourceId:'supplier-request:fixture'}},requestInspection:store.evidence(handle)})
 return{store,query,load,context,calls,change:p=>{current={...current,...p}}}
}
test('inspection contract is read-only and its schema has an exact fingerprint',async()=>{
 assert.deepEqual(REQUEST_INSPECTION_CONTRACT,{id:'profitia.request-inspection',version:'1.0.0',effect:'PRIVATE_SQL_READ',anchor:'ACCEPTED_PRIVATE_PHASE'})
 assert.match(await requestInspectionSchemaDigest(),/^[a-f0-9]{64}$/)
})
test('one loaded handle binds actual INTENT and rechecks the same current query; no reservation is called',async()=>{
 const f=fixture(),h=await f.load(),context=f.context(h);await f.store.bind(f.query,h,context)
 f.change({expiresAt:new Date(Date.now()+7200000).toISOString()});await f.store.verify(f.query,h,context)
 assert(Object.isFrozen(h));assert(Object.isFrozen(context.requestInspection))
 assert(f.calls.some(c=>c.sql.includes('.bind_scope(')));assert(f.calls.some(c=>c.sql.includes('.scope_allows(')))
 assert(!f.calls.some(c=>/reserve|claim_dispatch|complete|INSERT|UPDATE/.test(c.sql)))
})
for(const patch of [{role:'owner'},{applicationId:'another-app'},{environment:'staging'},{databaseName:'other_db'},
 {subjectUserId:'untrusted'},{inspectionSchemaDigest:'0'.repeat(64)},{transactionId:'10'},
 {expiresAt:new Date(0).toISOString()},{effect:'PRIVATE_SQL_PHASE'}])test('inspection rejects mismatched descriptor '+JSON.stringify(patch),async()=>{
 const f=fixture();f.change(patch);await assert.rejects(f.load(),isOperationDenied)
})
test('a handle cannot be copied, attached to another query, or rebound to another account/organization',async()=>{
 const f=fixture(),h=await f.load(),context=f.context(h)
 await assert.rejects(f.store.bind(f.query,structuredClone(h),context),isOperationDenied)
 await assert.rejects(f.store.bind(async(...args)=>f.query(...args),h,context),isOperationDenied)
 for(const patch of [{subjectUserId:randomUUID()},{organisationId:randomUUID()},{actorKind:'HUMAN'},
  {requestContinuation:{}},{requestInspection:{...context.requestInspection,transactionId:'21'}}])await assert.rejects(f.store.bind(f.query,h,{...context,...patch}),isOperationDenied)
})
test('a changed accepted input or policy cannot reuse a previously loaded handle',async()=>{
 for(const patch of [{inputDigest:'2'.repeat(64)},{policyVersion:'2'},{acceptedTransactionId:'11'}]){
  const f=fixture(),h=await f.load();f.change(patch);await assert.rejects(f.store.bind(f.query,h,f.context(h)),isOperationDenied)
 }
})
const options=()=>({application:{appId:'worker',profileId:'PLATFORM_INTERNAL',environment:'development',deploymentId:'fixture',configurationVersion:'v1',identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,features:['job_execution'],operations:['job.execute']},binding,
 job:{schemaDigest:'1'.repeat(64),targetOperation:'supplier.report.refresh',supplierSchemaDigest:'2'.repeat(64)},privateInspection:{schemaDigest:'3'.repeat(64),continuationSchemaDigest:'4'.repeat(64),delegatedSchemaDigest:'5'.repeat(64)},
 independentQuery:async()=>assert.fail('Constructor must not query'),transact:async()=>assert.fail('Constructor must not transact'),readExternalAccount:async()=>assert.fail('Constructor must not read account')})
test('explicit inspector exposes no dispatch, delivery or private writer and cannot be selected by the default host',()=>{
 const host=createDelegatedPrivateInspectionHost(options());assert.deepEqual(Object.keys(host).sort(),['contract','hostContract','inspectPrivatePhase'])
 assert(Object.isFrozen(host));assert.throws(()=>createDelegatedJobHost(options()),TypeError)
})
for(const patch of [{privateInspection:null},{privateInspection:{}},{privateInspection:{schemaDigest:'a'.repeat(64)}},
 {privateContinuation:{}},{sourceDelivery:{deliver:async()=>{}}},{createAuthenticator:()=>{}},
 {job:{schemaDigest:'1'.repeat(64),targetOperation:'forecast.request'}}])test('inspection cannot borrow another execution authority '+Object.keys(patch),()=>{
 assert.throws(()=>createDelegatedPrivateInspectionHost({...options(),...patch}),TypeError)
})
