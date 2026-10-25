import assert from 'node:assert/strict'
import test from 'node:test'
import {createOperationExecutor,OPERATION_CONTRACT,OperationDenied,operationPayloadDigest} from '../src/operation-context.mjs'
import {createRequestLedger,validRequestIdempotencyKey,requestLedgerSourceDigest,requestReservationSchemaDigest,externalRequestSchemaDigest} from '../src/request-ledger.mjs'
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222'
const U='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',V='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const P='cccccccc-cccc-4ccc-8ccc-cccccccccccc',R='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const time=Date.parse('2030-01-01T00:00:00.000Z'),expiry=new Date(time+3600000).toISOString()
function fixture(){
 let now=time,actions=0,reserves=0,completes=0,committed=0
 const writes=[],events=[],controls={}
 const application={appId:'spendguru',profileId:'SPENDGURU_SAAS',deploymentId:'fixture',configurationVersion:'1',environment:'development',identityIssuer:'https://identity.fixture.test',organisationId:null,operations:['forecast.request'],features:['forecast','benchmark']}
 const actor={kind:'HUMAN',actorId:U,userId:U,proofRef:'VERIFIED_SYNTHETIC_ONLY',issuer:application.identityIssuer,audience:application.appId,environment:'development',expiresAt:expiry}
 const module={moduleId:'benchmark',moduleBindingId:A,version:'1',sourceRef:'SYNTHETIC_BINDING',expiresAt:expiry,transactionId:'123',moduleSchemaDigest:'a'.repeat(64),auditSchemaDigest:'b'.repeat(64)}
 const policy={status:'AVAILABLE',policyId:P,version:'1',sourceRef:'EXPLICIT_SYNTHETIC_REQUEST_COUNT_POLICY',expiresAt:expiry,windowStart:new Date(time-1000).toISOString(),windowEnd:expiry,capacity:2,used:0,applicationId:application.appId,environment:'development',organisationId:A,operation:'forecast.request',transactionId:'123'}
 const state={policyVersion:'1',applicationId:application.appId,environment:'development',access:{type:'MEMBERSHIP',actorId:U,organisationId:A,status:'ACTIVE',version:'1',sourceRef:'SYNTHETIC_CURRENT_AUTHORITY',expiresAt:expiry,permissions:[{operation:'forecast.request',feature:'forecast',resourceId:null}],denies:[]},resource:{id:'forecast-request:'+R,type:'forecast_request',dataClass:'OPERATION_AUDIT',environment:'development',ownerOrganisationId:A,ownerUserId:U,version:'creation-intent-1',projectionVersion:'request-accepted-v1'},products:[{product:'SPENDGURU',features:['forecast','benchmark'],organisationId:A,environment:'development',applicationId:application.appId,status:'ACTIVE',version:'1',sourceRef:'EXPLICIT_SYNTHETIC_OFFER',source:'EXPLICIT_OFFER',expiresAt:expiry}],usagePolicy:'PRODUCT_POLICY',requestPolicy:policy}
 const input={contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'forecast.request',organisationId:A,resourceId:state.resource.id,idempotencyKey:'opaque_client_request_key_00001',payload:{seriesId:'shared_series',model:'naive'},request:{}}
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
const rejected=(reason)=>e=>e instanceof OperationDenied&&e.reasonCode===reason


const Q='a'.repeat(64)
function unmetered(operation='supplier.report.refresh'){
 const f=fixture();Object.assign(f.application,{appId:'srm',profileId:'SUPPLIER_INTELLIGENCE_STANDALONE',operations:[operation],features:['supplier_report']})
 f.actor.audience='srm';f.module.moduleId='supplier_report';f.state.applicationId='srm'
 f.state.access.permissions=[{operation,feature:'supplier_report',resourceId:null}]
 Object.assign(f.state.products[0],{applicationId:'srm',product:'SUPPLIER_INTELLIGENCE',features:['supplier_report']})
 Object.assign(f.state.resource,{id:'supplier-request:'+R,type:operation==='supplier.report.refresh'?'supplier_report_request':'supplier_private_request'})
 Object.assign(f.policy,{applicationId:'srm',operation,quotaMode:'UNMETERED',quotaSchemaDigest:Q,capacity:null,windowStart:null,windowEnd:null,expiresAt:null,used:1200001})
 Object.assign(f.input,{operation,resourceId:f.state.resource.id});f.options.requestQuotaSchemaDigest=Q
 return f
}
for(const operation of ['supplier.report.refresh','supplier.private.refresh']){
 test(operation+': explicit unmetered mode counts a real accepted/audited request beyond the historical cap',async()=>{
  const f=unmetered(operation);await f.execute();assert.equal(f.actions,1);assert.equal(f.reserves,1);assert.equal(f.completes,1)
  assert.deepEqual(f.events.map(x=>x.phase),['INTENT','OUTCOME']);assert.equal(createOperationExecutor(f.options).contract.implementation,'1.0.0-candidate.19')
 })
 test(operation+': an unmetered replay still skips the action and completion',async()=>{const f=unmetered(operation);f.controls.replay=true;await f.execute();assert.equal(f.actions,0);assert.equal(f.completes,0)})
 for(const[label,change,reason]of[
  ['absent explicit schema opt-in',f=>delete f.options.requestQuotaSchemaDigest,'LIMIT_POLICY_UNAVAILABLE'],
  ['different accepted schema',f=>f.policy.quotaSchemaDigest='b'.repeat(64),'LIMIT_POLICY_UNAVAILABLE'],
  ['fabricated numeric unlimited',f=>f.policy.capacity=1000000,'LIMIT_POLICY_UNAVAILABLE'],
  ['negative accounting',f=>f.policy.used=-1,'LIMIT_POLICY_UNAVAILABLE'],
  ['unknown mode',f=>f.policy.quotaMode='UNLIMITED','LIMIT_POLICY_UNAVAILABLE'],
  ['restored quota window',f=>f.policy.windowEnd=expiry,'LIMIT_POLICY_UNAVAILABLE'],
  ['revoked membership',f=>f.state.access.status='REVOKED','ACCESS_BASIS_INVALID'],
  ['foreign organisation',f=>f.policy.organisationId=B,'LIMIT_POLICY_UNAVAILABLE'],
  ['missing operation permission',f=>f.state.access.permissions=[],'PERMISSION_DENIED'],
  ['revoked product',f=>f.state.products[0].status='REVOKED','PRODUCT_UNAVAILABLE'],
  ['audit outage',f=>f.controls.failIntent=true,'AUDIT_UNAVAILABLE'],
 ])test(operation+': '+label+' fails closed',async()=>{const f=unmetered(operation);change(f);await assert.rejects(f.execute(),rejected(reason));assert.equal(f.actions,0)})
 test(operation+': future fixed package policies retain their capacity',async()=>{const f=unmetered(operation);Object.assign(f.policy,{quotaMode:'FIXED',capacity:1,used:2,expiresAt:expiry,windowStart:new Date(time-1000).toISOString(),windowEnd:expiry});await assert.rejects(f.execute(),rejected('LIMIT_POLICY_UNAVAILABLE'))})
}
test('SQL027 opt-in cannot be borrowed by forecast or discovery',()=>{
 const binding={applicationId:'srm',environment:'development',projectId:'fixture',branchId:'fixture',databaseName:'fixture_db',role:'fixture_runtime'}
 assert.throws(()=>createRequestLedger({binding,schemaDigest:Q,quotaSchemaDigest:Q}),TypeError)
 assert.throws(()=>createRequestLedger({binding,schemaDigest:Q,operation:'benchmark.discovery.request',externalSchemaDigest:Q,operationSchemaDigest:Q,quotaSchemaDigest:Q}),TypeError)
})
