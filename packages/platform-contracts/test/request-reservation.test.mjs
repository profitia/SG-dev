import assert from 'node:assert/strict'
import test from 'node:test'
import {createOperationExecutor,OPERATION_CONTRACT,OperationDenied,operationPayloadDigest} from '../src/operation-context.mjs'
import {createRequestLedger,validRequestIdempotencyKey,requestLedgerSourceDigest} from '../src/request-ledger.mjs'
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

test('AM20 requires fresh authority, explicit finite policy, durable audit and same-transaction request acceptance',async()=>{
 const f=fixture(),result=await f.execute();assert.equal(result.decision,'ALLOW');assert.deepEqual(result.value,{requestId:R,status:'ACCEPTED'})
 assert.equal(f.actions,1);assert.equal(f.reserves,1);assert.equal(f.completes,1);assert.equal(f.committed,1)
 assert.deepEqual(f.events.map(e=>e.phase),['INTENT','OUTCOME']);assert(f.events.every(e=>e.effect==='REQUEST_COMPUTE'&&e.usagePolicy==='PRODUCT_POLICY'))
 assert(!JSON.stringify(f.events).includes(f.input.idempotencyKey));assert(!JSON.stringify(f.events).includes('requestReservation'))
})
for(const [name,mutate,reason]of[
 ['absent key',f=>delete f.input.idempotencyKey,'CONTEXT_INVALID'],
 ['malformed key',f=>f.input.idempotencyKey='short','CONTEXT_INVALID'],
 ['absent usage policy',f=>f.state.usagePolicy='NOT_APPLICABLE','LIMIT_POLICY_UNAVAILABLE'],
 ['absent explicit policy',f=>delete f.state.requestPolicy,'LIMIT_POLICY_UNAVAILABLE'],
 ['null capacity',f=>f.policy.capacity=null,'LIMIT_POLICY_UNAVAILABLE'],
 ['infinite capacity',f=>f.policy.capacity=Infinity,'LIMIT_POLICY_UNAVAILABLE'],
 ['expired policy',f=>f.policy.expiresAt=new Date(time).toISOString(),'LIMIT_POLICY_UNAVAILABLE'],
 ['foreign policy organisation',f=>f.policy.organisationId=B,'LIMIT_POLICY_UNAVAILABLE'],
 ['foreign policy application',f=>f.policy.applicationId='foreign','LIMIT_POLICY_UNAVAILABLE'],
 ['foreign policy transaction',f=>f.policy.transactionId='124','LIMIT_POLICY_UNAVAILABLE'],
 ['absent reservation port',f=>f.controls.noReserve=true,'LIMIT_POLICY_UNAVAILABLE'],
 ['absent completion port',f=>f.controls.noComplete=true,'LIMIT_POLICY_UNAVAILABLE'],
 ['unbound module',f=>f.module.moduleId='category','APPLICATION_FEATURE_UNAVAILABLE'],
 ['foreign private request owner',f=>f.state.resource.ownerUserId=V,'RESOURCE_SCOPE_MISMATCH'],
 ['revoked membership',f=>f.state.access.status='REVOKED','ACCESS_BASIS_INVALID'],
 ['missing operation permission',f=>f.state.access.permissions=[],'PERMISSION_DENIED'],
 ['explicit operation DENY',f=>f.state.access.denies=[{operation:'forecast.request',feature:'forecast',resourceId:null}],'PERMISSION_DENIED'],
 ['revoked product',f=>f.state.products[0].status='REVOKED','PRODUCT_UNAVAILABLE'],
])test(`request refusal before reservation/action: ${name}`,async()=>{const f=fixture();mutate(f);await assert.rejects(f.execute(),rejected(reason));assert.equal(f.reserves,0);assert.equal(f.actions,0);assert.equal(f.committed,0)})

test('a SERVICE cannot turn this HUMAN-only request into delegated or global execution',async()=>{
 const f=fixture();Object.assign(f.actor,{kind:'SERVICE',serviceId:U});delete f.actor.userId
 await assert.rejects(f.execute(),rejected('DELEGATION_INVALID'));assert.equal(f.actions,0);assert.equal(f.reserves,0)
})
test('current replay reprojects/audits but never repeats private effects or consumes a second request',async()=>{
 const f=fixture();f.controls.replay=true;f.policy.used=f.policy.capacity
 const result=await f.execute();assert.deepEqual(result.value,{requestId:R,status:'ACCEPTED'});assert.equal(f.actions,0);assert.equal(f.completes,0);assert.equal(f.committed,0)
 f.state.access.status='REVOKED';await assert.rejects(f.execute(),rejected('ACCESS_BASIS_INVALID'));assert.equal(f.reserves,1)
})
for(const reason of['LIMIT_EXCEEDED','IDEMPOTENCY_CONFLICT','LIMIT_POLICY_UNAVAILABLE'])test(`reservation refusal cannot execute or charge: ${reason}`,async()=>{
 const f=fixture();f.controls.reserveReason=reason;await assert.rejects(f.execute(),rejected(reason));assert.equal(f.actions,0);assert.equal(f.committed,0);assert.deepEqual(f.events.map(e=>e.phase),['INTENT','FAILURE'])
})
for(const [name,change]of[['policy',{policyId:A}],['transaction',{transactionId:'124'}],['unknown field',{actorId:V}],['bad replay',{status:'REPLAY',value:{requestId:R,status:'ACCEPTED',diagnostic:'PRIVATE_MARKER'}}]])test(`invalid reservation cannot grant effects: ${name}`,async()=>{
 const f=fixture();f.controls.reservation=change;await assert.rejects(f.execute(),rejected('LIMIT_POLICY_UNAVAILABLE'));assert.equal(f.actions,0);assert.equal(f.committed,0)
})
for(const [name,change,reason]of[['intent audit',{failIntent:true},'AUDIT_UNAVAILABLE'],['action',{actionThrows:true},'POLICY_UNAVAILABLE'],['completion',{completeReason:'LIMIT_POLICY_UNAVAILABLE'},'LIMIT_POLICY_UNAVAILABLE'],['outcome audit',{failOutcome:true},'AUDIT_UNAVAILABLE'],['private output',{receipt:{privateField:'PRIVATE_MARKER'}},'POLICY_UNAVAILABLE']])test(`private effect and quota rollback on ${name}`,async()=>{
 const f=fixture();Object.assign(f.controls,change);await assert.rejects(f.execute(),rejected(reason));assert.equal(f.committed,0);assert.deepEqual(f.writes,[])
})
test('policy expiry during projection rolls back the request before OUTCOME',async()=>{
 const f=fixture();f.policy.expiresAt=new Date(time+100).toISOString();f.controls.expirePolicyDuringProjection=true
 await assert.rejects(f.execute(),rejected('LIMIT_POLICY_UNAVAILABLE'));assert.equal(f.committed,0);assert.deepEqual(f.writes,[])
})
test('an HTTP idempotency string is bounded data and never a grant',async()=>{
 assert(validRequestIdempotencyKey('opaque_client_request_key_00001'));for(const value of[null,{},'', 'a'.repeat(129),'invalid value with whitespace'])assert.equal(validRequestIdempotencyKey(value),false)
 assert.match(await requestLedgerSourceDigest(),/^[a-f0-9]{64}$/)
 assert.throws(()=>createRequestLedger({binding:{},schemaDigest:'a'.repeat(64)}))
})

function externalFixture(){
 const f=fixture()
 Object.assign(f.application,{appId:'srm',profileId:'SUPPLIER_INTELLIGENCE_STANDALONE',operations:['supplier.report.refresh'],features:['supplier_report']})
 f.actor.audience='srm';f.module.moduleId='supplier_report'
 Object.assign(f.policy,{applicationId:'srm',operation:'supplier.report.refresh'})
 f.state.applicationId='srm';f.state.access.permissions=[{operation:'supplier.report.refresh',feature:'supplier_report',resourceId:null}]
 Object.assign(f.state.resource,{id:'supplier-report-request:'+R,type:'supplier_report_request'})
 f.state.products=[{...f.state.products[0],applicationId:'srm',product:'SUPPLIER_INTELLIGENCE',features:['supplier_report']}]
 Object.assign(f.input,{operation:'supplier.report.refresh',resourceId:f.state.resource.id,payload:{nip:'SYNTHETIC_PRIVATE_NIP_MARKER'}})
 return f
}
test('bounded HUMAN AM23 accepts a private intent in standalone Supplier Intelligence without performing provider work',async()=>{
 const f=externalFixture(),r=await f.execute()
 assert.deepEqual(r.value,{requestId:R,status:'ACCEPTED'});assert.equal(f.actions,1);assert.equal(f.committed,1)
 assert(f.events.every(e=>e.effect==='REQUEST_EXTERNAL'&&e.operation==='supplier.report.refresh'&&e.usagePolicy==='PRODUCT_POLICY'))
 assert(!JSON.stringify(f.events).includes('SYNTHETIC_PRIVATE_NIP_MARKER'));assert(!JSON.stringify(f.events).includes(f.input.idempotencyKey))
})
for(const[name,mutate,reason]of[
 ['read grant cannot refresh',f=>f.state.access.permissions=[{operation:'supplier.report.read',feature:'supplier_report',resourceId:null}],'PERMISSION_DENIED'],
 ['forecast module cannot grant supplier request',f=>f.module.moduleId='benchmark','APPLICATION_FEATURE_UNAVAILABLE'],
 ['forecast policy cannot fund refresh',f=>f.policy.operation='forecast.request','LIMIT_POLICY_UNAVAILABLE'],
 ['another organisation',f=>f.input.organisationId=B,'CONTEXT_INVALID'],
 ['another user owns intent',f=>f.state.resource.ownerUserId=V,'RESOURCE_SCOPE_MISMATCH'],
 ['shared source cannot be private request',f=>Object.assign(f.state.resource,{dataClass:'SHARED_KNOWLEDGE',ownerOrganisationId:null,ownerUserId:null,approvedSharedProjection:true}),'RESOURCE_SCOPE_MISMATCH'],
 ['missing product',f=>f.state.products=[],'PRODUCT_UNAVAILABLE'],
 ['revoked membership',f=>f.state.access.status='REVOKED','ACCESS_BASIS_INVALID'],
 ['missing key',f=>delete f.input.idempotencyKey,'CONTEXT_INVALID'],
 ['unlimited request policy',f=>f.policy.capacity=Infinity,'LIMIT_POLICY_UNAVAILABLE'],
 ['unknown policy',f=>delete f.state.requestPolicy,'LIMIT_POLICY_UNAVAILABLE'],
 ['unmetered read policy',f=>f.state.usagePolicy='NOT_APPLICABLE','LIMIT_POLICY_UNAVAILABLE'],
])test('AM23 refusal before private effect: '+name,async()=>{const f=externalFixture();mutate(f);await assert.rejects(f.execute(),rejected(reason));assert.equal(f.actions,0);assert.equal(f.reserves,0);assert.equal(f.committed,0)})
test('AM23 same accepted request replay never runs the action again and current revocation still denies',async()=>{
 const f=externalFixture();f.controls.replay=true;f.policy.used=f.policy.capacity
 assert.deepEqual((await f.execute()).value,{requestId:R,status:'ACCEPTED'});assert.equal(f.actions,0);assert.equal(f.completes,0)
 f.state.access.denies=[...f.state.access.permissions];await assert.rejects(f.execute(),rejected('PERMISSION_DENIED'))
})
for(const[name,change,reason]of[['outcome audit',{failOutcome:true},'AUDIT_UNAVAILABLE'],['private action',{actionThrows:true},'POLICY_UNAVAILABLE'],['report body is not receipt',{receipt:{report:'SYNTHETIC_PRIVATE_FIELD'}},'POLICY_UNAVAILABLE']])test('AM23 atomic private admission rolls back on '+name,async()=>{
 const f=externalFixture();Object.assign(f.controls,change);await assert.rejects(f.execute(),rejected(reason));assert.equal(f.committed,0);assert.deepEqual(f.writes,[])
})
test('AM23 rejects unimplemented SERVICE impersonation and missing accepted SQL extension',async()=>{
 const f=externalFixture();Object.assign(f.actor,{kind:'SERVICE',serviceId:U});delete f.actor.userId
 await assert.rejects(f.execute(),rejected('DELEGATION_INVALID'));assert.equal(f.actions,0)
 assert.throws(()=>createRequestLedger({binding:{},schemaDigest:'a'.repeat(64),operation:'supplier.report.refresh'}),TypeError)
 assert.throws(()=>createRequestLedger({binding:{},schemaDigest:'a'.repeat(64),operation:'unapproved',externalSchemaDigest:'b'.repeat(64)}),TypeError)
})
