import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {requestOperationPolicy,REQUEST_OPERATIONS,additionalRequestSchemaDigest,requestOperationsSourceDigest} from '../src/request-operations.mjs'
import {createOperationExecutor,OPERATION_CONTRACT,OperationDenied} from '../src/operation-context.mjs'
import {createRequestLedger} from '../src/request-ledger.mjs'
import {createDelegatedJobStore} from '../src/delegated-job.mjs'
import {createDelegatedNativeWorkHost} from '../src/private-operation-host.mjs'
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222'
const U='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',V='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const P='cccccccc-cccc-4ccc-8ccc-cccccccccccc',R='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const time=Date.parse('2030-01-01T00:00:00.000Z'),expiry=new Date(time+3600000).toISOString()
function fixture(operation){
 const target=requestOperationPolicy(operation),supplier=operation==='supplier.private.refresh'
 let now=time,actions=0,reserves=0,completes=0,committed=0
 const writes=[],events=[],controls={}
 const application={appId:'spendguru',profileId:'SPENDGURU_SAAS',deploymentId:'fixture',configurationVersion:'1',environment:'development',identityIssuer:'https://identity.fixture.test',organisationId:null,operations:[operation],features:supplier?['supplier_report']:['benchmark']}
 const actor={kind:'HUMAN',actorId:U,userId:U,proofRef:'VERIFIED_SYNTHETIC_ONLY',issuer:application.identityIssuer,audience:application.appId,environment:'development',expiresAt:expiry}
 const module={moduleId:target.module,moduleBindingId:A,version:'1',sourceRef:'SYNTHETIC_BINDING',expiresAt:expiry,transactionId:'123',moduleSchemaDigest:'a'.repeat(64),auditSchemaDigest:'b'.repeat(64)}
 const policy={status:'AVAILABLE',policyId:P,version:'1',sourceRef:'EXPLICIT_SYNTHETIC_REQUEST_COUNT_POLICY',expiresAt:expiry,windowStart:new Date(time-1000).toISOString(),windowEnd:expiry,capacity:2,used:0,applicationId:application.appId,environment:'development',organisationId:A,operation,transactionId:'123'}
 const state={policyVersion:'1',applicationId:application.appId,environment:'development',access:{type:'MEMBERSHIP',actorId:U,organisationId:A,status:'ACTIVE',version:'1',sourceRef:'SYNTHETIC_CURRENT_AUTHORITY',expiresAt:expiry,permissions:[{operation,feature:target.feature,resourceId:null}],denies:[]},resource:{id:'forecast-request:'+R,type:target.resourceType,dataClass:'OPERATION_AUDIT',environment:'development',ownerOrganisationId:A,ownerUserId:U,version:'creation-intent-1',projectionVersion:'request-accepted-v1'},products:[{product:target.product,features:[target.feature],organisationId:A,environment:'development',applicationId:application.appId,status:'ACTIVE',version:'1',sourceRef:'EXPLICIT_SYNTHETIC_OFFER',source:'EXPLICIT_OFFER',expiresAt:expiry}],usagePolicy:'PRODUCT_POLICY',requestPolicy:policy}
 const input={contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation,organisationId:A,resourceId:state.resource.id,idempotencyKey:'opaque_client_request_key_00001',payload:{kind:'BENCHMARK_DISCOVERY',mode:'AI',commandDigest:'f'.repeat(64)},request:{}}
 const reservation=()=>({status:controls.replay?'REPLAY':'NEW',requestId:R,policyId:P,policyVersion:'1',transactionId:'123',...(controls.replay?{value:{requestId:R,status:'ACCEPTED'}}:{}),...controls.reservation})
 const options={application,now:()=>now,authenticate:async()=>actor,recordAudit:async e=>{if(controls.failIntent&&e.phase==='INTENT')throw Error('Synthetic audit outage');events.push(e)},withTransaction:async(_binding,run)=>{
  const staged=[]
  const session={state,moduleEvidence:module,transaction:staged,transactionalEffects:true,outputBoundaryVersion:state.resource.projectionVersion,
   projectOutput:async value=>{if(controls.expirePolicyDuringProjection)now+=101;return value},recordOutcome:async e=>{if(controls.failOutcome)throw Error('Synthetic outcome outage');events.push(e)},
   reserveUsage:async()=>{reserves++;if(controls.reserveReason)throw new OperationDenied(controls.reserveReason);return reservation()},
   completeRequest:async()=>{completes++;if(controls.completeReason)throw new OperationDenied(controls.completeReason)}}
  if(controls.noReserve)delete session.reserveUsage
  if(controls.noComplete)delete session.completeRequest
  const value=await run(session);writes.push(...staged);if(!controls.replay)committed++;return value
 }}
 const action=async(context,tx)=>{actions++;assert.equal(context.actorKind,'HUMAN');assert.equal(context.requestReservation.requestId,R);tx.push('private SQL request intent');if(controls.actionThrows)throw Error('Synthetic action outage');return{requestId:R,status:'ACCEPTED',...controls.receipt}}
 return{application,actor,module,state,policy,input,controls,events,writes,options,action,execute:()=>createOperationExecutor(options).execute(input,action),get actions(){return actions},get reserves(){return reserves},get completes(){return completes},get committed(){return committed}}
}
const denied=code=>error=>error instanceof OperationDenied&&error.reasonCode===code
for(const operation of ['supplier.private.refresh','benchmark.discovery.request']){
 test(operation+': explicit current authority admits one private request and audits no private input',async()=>{
  const f=fixture(operation),r=await f.execute();assert.equal(r.value.requestId,R);assert.equal(f.committed,1);assert.equal(f.actions,1)
  assert.deepEqual(f.events.map(e=>e.phase),['INTENT','OUTCOME']);assert(f.events.every(e=>e.operation===operation&&e.effect==='REQUEST_EXTERNAL'))
  assert(!JSON.stringify(f.events).includes('commandDigest'));assert(!JSON.stringify(f.events).includes(f.input.idempotencyKey))
 })
 for(const [label,mutate,reason]of[
  ['no new permission',f=>{f.state.access.permissions=[{operation:'supplier.report.refresh',feature:'supplier_report',resourceId:null},{operation:'knowledge.read',feature:'market',resourceId:null}]},'PERMISSION_DENIED'],
  ['explicit denial',f=>{f.state.access.denies=[...f.state.access.permissions]},'PERMISSION_DENIED'],
  ['other owner',f=>{f.state.resource.ownerUserId=V},'RESOURCE_SCOPE_MISMATCH'],
  ['other organization',f=>{f.state.resource.ownerOrganisationId=B},'RESOURCE_SCOPE_MISMATCH'],
  ['revoked membership',f=>{f.state.access.status='REVOKED'},'ACCESS_BASIS_INVALID'],
  ['revoked product',f=>{f.state.products[0].status='REVOKED'},'PRODUCT_UNAVAILABLE'],
  ['wrong module',f=>{f.module.moduleId='category'},'APPLICATION_FEATURE_UNAVAILABLE'],
  ['no policy',f=>{delete f.state.requestPolicy},'LIMIT_POLICY_UNAVAILABLE'],
  ['audit unavailable',f=>{f.controls.failIntent=true},'AUDIT_UNAVAILABLE'],
 ])test(operation+': '+label+' refuses before action',async()=>{const f=fixture(operation);mutate(f);await assert.rejects(f.execute(),denied(reason));assert.equal(f.actions,0);assert.equal(f.committed,0)})
 test(operation+': SERVICE cannot borrow human admission',async()=>{const f=fixture(operation);f.actor.kind='SERVICE';f.actor.serviceId=U;delete f.actor.userId;await assert.rejects(f.execute(),denied('DELEGATION_INVALID'));assert.equal(f.actions,0)})
 test(operation+': current replay never repeats the request action',async()=>{const f=fixture(operation);f.controls.replay=true;await f.execute();assert.equal(f.actions,0);assert.equal(f.completes,0);f.state.access.status='REVOKED';await assert.rejects(f.execute(),denied('ACCESS_BASIS_INVALID'))})
}
test('closed immutable request metadata adds no wildcard, inherited permission or forecast work',async()=>{
 assert.deepEqual(REQUEST_OPERATIONS,['forecast.request','supplier.report.refresh','supplier.private.refresh','benchmark.discovery.request','supplier.location.write','supplier.location.sync','supplier.location.geocode'])
 for(const op of REQUEST_OPERATIONS){const p=requestOperationPolicy(op);assert(Object.isFrozen(p));assert(Object.isFrozen(p.profiles))}
 for(const op of['toString','__proto__','supplier.private.read','knowledge.read',null,{}])assert.equal(requestOperationPolicy(op),null)
 assert.equal(requestOperationPolicy('forecast.request').nativeWork,false)
 assert.match(await additionalRequestSchemaDigest(),/^[a-f0-9]{64}$/);assert.match(await requestOperationsSourceDigest(),/^[a-f0-9]{64}$/)
})
test('additional targets need exact explicit extension opt-in in both admission and delegation',()=>{
 const binding={applicationId:'srm',environment:'development',projectId:'fixture',branchId:'fixture',databaseName:'fixture_db',role:'fixture_runtime'}
 for(const operation of ['supplier.private.refresh','benchmark.discovery.request']){
  for(const d of[undefined,null,'bad']){
   assert.throws(()=>createRequestLedger({binding,schemaDigest:'a'.repeat(64),operation,externalSchemaDigest:'b'.repeat(64),operationSchemaDigest:d}),TypeError)
   assert.throws(()=>createDelegatedJobStore({binding,schemaDigest:'a'.repeat(64),targetOperation:operation,supplierSchemaDigest:'b'.repeat(64),operationSchemaDigest:d}),TypeError)
  }
  assert.doesNotThrow(()=>createRequestLedger({binding,schemaDigest:'a'.repeat(64),operation,externalSchemaDigest:'b'.repeat(64),operationSchemaDigest:'c'.repeat(64)}))
  assert.doesNotThrow(()=>createDelegatedJobStore({binding,schemaDigest:'a'.repeat(64),targetOperation:operation,supplierSchemaDigest:'b'.repeat(64),operationSchemaDigest:'c'.repeat(64)}))
 }
 for(const operation of['forecast.request','supplier.report.refresh'])assert.throws(()=>createRequestLedger({binding,schemaDigest:'a'.repeat(64),operation,operationSchemaDigest:'c'.repeat(64),...(operation==='supplier.report.refresh'?{externalSchemaDigest:'b'.repeat(64)}:{})}),TypeError)
})

test('new request, job and native-work types keep exact extension opt-in and private output restrictions',async()=>{
 const {fileURLToPath}=await import('node:url'),{default:ts}=await import('../../../apps/architecture-lab/node_modules/typescript/lib/typescript.js')
 const base=JSON.parse(fs.readFileSync(new URL('./types/tsconfig.json',import.meta.url))),directory=fileURLToPath(new URL('./types/',import.meta.url))
 const configuration=ts.parseJsonConfigFileContent({...base,files:[...base.files,'request-work.mts','request-operations.mts']},ts.sys,directory)
 const program=ts.createProgram(configuration.fileNames,configuration.options),diagnostics=[...configuration.errors,...ts.getPreEmitDiagnostics(program)]
 assert.equal(diagnostics.length,0,ts.formatDiagnostics(diagnostics,{getCurrentDirectory:()=>directory,getCanonicalFileName:f=>f,getNewLine:()=>"\n"}))
})

test('Finder result requires current own user and organization and explicit read, separately from request',async()=>{
 const f=fixture('benchmark.discovery.request')
 f.application.operations=['benchmark.discovery.read'];f.input.operation='benchmark.discovery.read';delete f.input.idempotencyKey
 f.state.resource.type='benchmark_discovery_result';f.state.resource.dataClass='USER_IN_ORGANISATION_PRIVATE'
 f.state.resource.contentRequirements=[{product:'SPENDGURU',feature:'benchmark'}]
 f.state.usagePolicy='NOT_APPLICABLE';delete f.state.requestPolicy
 const permission={operation:'benchmark.discovery.read',feature:'benchmark',resourceId:null}
 f.state.access.permissions=[permission]
 const run=()=>createOperationExecutor(f.options).execute(f.input,async()=>({private:'intent-result'}))
 assert.deepEqual((await run()).value,{private:'intent-result'})
 f.state.resource.ownerUserId=V;await assert.rejects(run(),denied('RESOURCE_SCOPE_MISMATCH'));f.state.resource.ownerUserId=U
 f.state.access.permissions=[{operation:'knowledge.read',feature:'market',resourceId:null}];await assert.rejects(run(),denied('PERMISSION_DENIED'))
 f.state.access.permissions=[permission];f.state.resource.ownerOrganisationId=B;await assert.rejects(run(),denied('RESOURCE_SCOPE_MISMATCH'))
})


test('immutable schema digests remain hashes of the exact historical SQL, independently of added source dependencies',async()=>{
 const {createHash}=await import('node:crypto'),ledger=await import('../src/request-ledger.mjs'),jobs=await import('../src/delegated-job.mjs'),work=await import('../src/request-work.mjs')
 for(const[method,url]of[[ledger.requestReservationSchemaDigest,ledger.requestReservationSchemaUrl],[ledger.externalRequestSchemaDigest,ledger.externalRequestSchemaUrl],[jobs.delegatedJobSchemaDigest,jobs.delegatedJobSchemaUrl],[jobs.supplierDelegationSchemaDigest,jobs.supplierDelegationSchemaUrl],[work.requestWorkSchemaDigest,work.requestWorkSchemaUrl]]){
  const expected=createHash('sha256').update(fs.readFileSync(new URL(url))).digest('hex');assert.equal(await method(),expected,url)
 }
})
