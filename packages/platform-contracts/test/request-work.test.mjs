import assert from 'node:assert/strict'
import test from 'node:test'
import {randomUUID} from 'node:crypto'
import {createRequestWorkScope,REQUEST_WORK_CONTRACT,requestWorkSchemaDigest} from '../src/request-work.mjs'
import {createDelegatedNativeWorkHost,createDelegatedJobHost,createDelegatedPrivateInspectionHost} from '../src/private-operation-host.mjs'
import {isOperationDenied} from '../src/operation-context.mjs'
const R=randomUUID(),A=randomUUID(),U=randomUUID(),S=randomUUID(),D=randomUUID()
const binding={applicationId:'worker',environment:'development',projectId:'fixture-project',branchId:'fixture-branch',databaseName:'fixture_db',role:'fixture_runtime',schemaDigest:'a'.repeat(64),service:{schemaDigest:'b'.repeat(64),profileId:'PLATFORM_INTERNAL',deploymentId:'fixture',configurationVersion:'v1'}}
const work={requestId:R,unitId:'PREPARE_DOCUMENTS',accessMode:'WRITE',inputDigest:'c'.repeat(64),schemaDigest:'d'.repeat(64)}
function fixture(){
 let current={...binding,owner:'profitia_access_owner',schemaVersion:'1.0.0',schemaDigest:work.schemaDigest,
  effect:'PRIVATE_SQL_WORK',operation:'supplier.report.refresh',requestId:R,unitId:work.unitId,accessMode:'WRITE',payloadDigest:'1'.repeat(64),policyVersion:'1',transactionId:'20',executorServiceId:S,subjectUserId:U,organisationId:A,delegationId:D,parentApplicationId:'srm',resourceId:'supplier-request:fixture',sourceRef:'SYNTHETIC_UNIT_POLICY',policyExpiresAt:new Date(Date.now()+3600000).toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()}
 const calls=[],store=createRequestWorkScope({binding,work})
 let allowed=true
 const query=async(sql,args)=>{calls.push({sql,args});return{rows:[{...(sql.includes('.descriptor(')?{descriptor:structuredClone(current)}:{}),...(sql.includes('scope_allows(')||sql.includes('bind_scope(')?{allowed}:{})}]}}
 const load=()=>store.load(query,{request:{operation:'job.execute',resourceId:R},lease:{state:{delegation:{target:{operation:'supplier.report.refresh'}}}}})
 const context=h=>({actorKind:'SERVICE',actorId:S,applicationId:'worker',environment:'development',subjectUserId:U,organisationId:A,operation:'job.execute',resourceId:R,payloadDigest:'1'.repeat(64),decisionId:randomUUID(),correlationId:randomUUID(),delegation:{requestId:R,delegationId:D,target:{application:{appId:'srm'},operation:'supplier.report.refresh',resourceId:'supplier-request:fixture'}},requestWork:store.evidence(h)})
 return{store,query,load,context,calls,change:p=>{current={...current,...p}},refuse:()=>{allowed=false}}
}
test('native SQL work explicitly leaves durable replay to the existing domain state',async()=>{
 assert.deepEqual(REQUEST_WORK_CONTRACT,{id:'profitia.request-work',version:'1.0.0',effect:'PRIVATE_SQL_WORK',replayOwner:'EXISTING_DOMAIN_STATE'})
 assert.match(await requestWorkSchemaDigest(),/^[a-f0-9]{64}$/)
 const f=fixture(),h=await f.load(),c=f.context(h);await f.store.bind(f.query,h,c);await f.store.verify(f.query,h,c)
 assert(Object.isFrozen(h));assert(Object.isFrozen(c.requestWork));assert.equal(c.requestWork.accessMode,'WRITE')
 assert(!f.calls.some(x=>/reserve|claim_dispatch|INSERT|UPDATE|complete/.test(x.sql)))
 const last=f.calls.at(-1);assert(last.sql.includes('.descriptor(')&&last.sql.includes('.scope_allows('))
 assert.equal(f.calls.length,4,'load, bind recheck, bind effect, and one fresh verification')
})
test('a combined observation still rejects revoked scope and a changed current descriptor',async()=>{
 const f=fixture(),h=await f.load(),c=f.context(h);await f.store.bind(f.query,h,c)
 f.refuse();await assert.rejects(f.store.verify(f.query,h,c),e=>e.reasonCode==='ACCESS_BASIS_INVALID')
 const g=fixture(),next=await g.load(),other=g.context(next);await g.store.bind(g.query,next,other)
 g.change({policyVersion:'2'});await assert.rejects(g.store.verify(g.query,next,other),e=>e.reasonCode==='ACCESS_BASIS_INVALID')
})
test('opaque work handles cannot move across transactions, actors, units or access modes',async()=>{
 const f=fixture(),h=await f.load(),c=f.context(h)
 await assert.rejects(f.store.bind(f.query,structuredClone(h),c),isOperationDenied)
 await assert.rejects(f.store.bind(async(...v)=>f.query(...v),h,c),isOperationDenied)
 for(const patch of[{actorKind:'HUMAN'},{actorId:U},{subjectUserId:randomUUID()},{organisationId:randomUUID()},
  {requestContinuation:{}},{requestInspection:{}},{requestWork:{...c.requestWork,accessMode:'READ'}},{requestWork:{...c.requestWork,inputDigest:'f'.repeat(64)}}])await assert.rejects(f.store.bind(f.query,h,{...c,...patch}),isOperationDenied)
})
for(const patch of[{role:'owner'},{applicationId:'another-app'},{environment:'staging'},{databaseName:'another_db'},
 {owner:'another_owner'},{schemaDigest:'0'.repeat(64)},{unitId:'OTHER_PURPOSE'},{accessMode:'READ'},{effect:'PRIVATE_SQL_PHASE'},
 {policyVersion:'0'},{transactionId:'0'},{subjectUserId:'untrusted'},{expiresAt:new Date(0).toISOString()}])test('current work descriptor refuses '+JSON.stringify(patch),async()=>{
 const f=fixture();f.change(patch);await assert.rejects(f.load(),isOperationDenied)
})
test('changed current policy and a physically refused bind do not authorize the callback',async()=>{
 const f=fixture(),h=await f.load(),c=f.context(h);f.change({policyVersion:'2'});await assert.rejects(f.store.bind(f.query,h,c),isOperationDenied)
 const other=fixture(),next=await other.load();other.refuse();await assert.rejects(other.store.bind(other.query,next,other.context(next)),isOperationDenied)
})
const options=()=>({application:{appId:'worker',profileId:'PLATFORM_INTERNAL',environment:'development',deploymentId:'fixture',configurationVersion:'v1',identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,features:['job_execution'],operations:['job.execute']},binding,
 job:{schemaDigest:'1'.repeat(64),targetOperation:'supplier.report.refresh',supplierSchemaDigest:'2'.repeat(64)},privateWork:{schemaDigest:'3'.repeat(64)},independentQuery:async()=>assert.fail('No constructor query'),transact:async()=>assert.fail('No constructor transaction'),readExternalAccount:async()=>assert.fail('No constructor account read')})
test('the explicit unit host exposes no provider, dispatch, inspection or once-only phase API',()=>{
 const host=createDelegatedNativeWorkHost(options());assert.deepEqual(Object.keys(host).sort(),['contract','hostContract','runSqlWork']);assert(Object.isFrozen(host))
 assert.throws(()=>createDelegatedJobHost(options()),TypeError)
 const o=options();assert.throws(()=>createDelegatedPrivateInspectionHost({...o,privateInspection:{schemaDigest:'a'.repeat(64),continuationSchemaDigest:'b'.repeat(64),delegatedSchemaDigest:'c'.repeat(64)}}),TypeError)
})
for(const patch of[{privateWork:null},{privateWork:{}},{privateContinuation:{}},{privateInspection:{}},{sourceDelivery:{deliver:async()=>{}}},{createAuthenticator:()=>{}},{job:{schemaDigest:'1'.repeat(64),targetOperation:'forecast.request'}}])test('unit work cannot borrow another authority '+Object.keys(patch),()=>{
 assert.throws(()=>createDelegatedNativeWorkHost({...options(),...patch}),TypeError)
})

test('native work export types preserve closed modes, immutable evidence and void callbacks under the canonical compiler settings',async()=>{
 const {readFileSync}=await import('node:fs'),{fileURLToPath}=await import('node:url')
 const {default:ts}=await import('../../../apps/architecture-lab/node_modules/typescript/lib/typescript.js')
 const base=JSON.parse(readFileSync(new URL('./types/tsconfig.json',import.meta.url)))
 const directory=fileURLToPath(new URL('./types/',import.meta.url))
 const configuration=ts.parseJsonConfigFileContent({...base,files:[...base.files,'request-work.mts']},ts.sys,directory)
 const program=ts.createProgram(configuration.fileNames,configuration.options)
 const diagnostics=[...configuration.errors,...ts.getPreEmitDiagnostics(program)]
 assert.equal(diagnostics.length,0,ts.formatDiagnostics(diagnostics,{getCurrentDirectory:()=>directory,getCanonicalFileName:f=>f,getNewLine:()=>"\n"}))
})
