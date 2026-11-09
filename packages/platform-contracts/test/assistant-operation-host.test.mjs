import test from 'node:test'
import assert from 'node:assert/strict'
import {createOperationExecutor,OPERATION_CONTRACT} from '../src/operation-context.mjs'
import {createAssistantUsageStore,takeAssistantAdmission} from '../src/assistant-usage.mjs'
const id=n=>`${n.repeat(8)}-${n.repeat(4)}-4${n.repeat(3)}-8${n.repeat(3)}-${n.repeat(12)}`
const now=Date.parse('2026-11-09T12:00:00Z'),expiresAt=new Date(now+60000).toISOString(),schemaDigest='a'.repeat(64)
function fixture(operation='assistant.converse'){
 const actor={kind:'HUMAN',actorId:id('1'),userId:id('1'),proofRef:'SYNTHETIC_UNIT_ONLY',issuer:'https://identity.test',audience:'spendguru',environment:'development',expiresAt}
 const account=operation!=='assistant.converse',organisationId=account?null:id('2'),events=[]
 const application={appId:'spendguru',profileId:'SPENDGURU_SAAS',environment:'development',identityIssuer:actor.issuer,configurationVersion:'synthetic-assistant',deploymentId:'synthetic-no-runtime',organisationId:null,features:['assistant'],operations:[operation]}
 const state={applicationId:'spendguru',environment:'development',policyVersion:'synthetic-1',usagePolicy:account?'NOT_APPLICABLE':'PRODUCT_POLICY',
  access:{type:account?'ACCOUNT_SELF':'MEMBERSHIP',actorId:actor.actorId,organisationId,status:'ACTIVE',version:'1',sourceRef:'synthetic',expiresAt,
   permissions:[{operation,feature:'assistant',resourceId:null}],denies:[]},
  resource:{id:'assistant:'+id('3'),type:account?'assistant_history':'assistant_turn',dataClass:account?'ACCOUNT_PRIVATE':'OPERATION_AUDIT',
   environment:'development',ownerOrganisationId:organisationId,ownerUserId:actor.actorId,version:'1',projectionVersion:'assistant-v1'},
  products:account?[]:[{product:'SPENDGURU',features:['assistant'],organisationId,environment:'development',applicationId:'spendguru',status:'ACTIVE',version:'1',sourceRef:'synthetic-explicit-offer',source:'EXPLICIT_OFFER',expiresAt}]}
 const input={contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation,organisationId,resourceId:state.resource.id,payload:account?{}:{kind:'AUTHORIZE'},request:new Request('https://sg2.test/api/assistant')}
 const session={state,transaction:{},transactionalEffects:true,outputBoundaryVersion:'assistant-v1',recordOutcome:async e=>events.push(e),projectOutput:async v=>v,
  reserveAssistantUsage:async()=>{throw Error('AUTHORIZE must not reserve')}}
 const options={application,assistantSchemaDigest:schemaDigest,now:()=>now,authenticate:async()=>actor,recordAudit:async e=>events.push(e),withTransaction:async(_,run)=>run(session)}
 let invoked=0
 return{actor,state,input,options,session,events,get invoked(){return invoked},execute:()=>createOperationExecutor(options).execute(input,async c=>{invoked++;return c.assistantReservation??'authorised'})}
}
test('all three Assistant operations require explicit adoption and are unavailable in other apps/environments',async()=>{
 for(const operation of ['assistant.converse','assistant.history.read','assistant.history.write']){
  const f=fixture(operation);delete f.options.assistantSchemaDigest
  await assert.rejects(f.execute,e=>e.reasonCode==='APPLICATION_FEATURE_UNAVAILABLE');assert.equal(f.invoked,0)
  const g=fixture(operation);g.options.application.environment='staging'
  await assert.rejects(g.execute,e=>e.reasonCode==='APPLICATION_FEATURE_UNAVAILABLE');assert.equal(g.invoked,0)
 }
})
test('account history is user-private and permission remains independent of authentication',async()=>{
 for(const operation of ['assistant.history.read','assistant.history.write']){
  const good=fixture(operation);assert.equal((await good.execute()).decision,'ALLOW')
  const foreign=fixture(operation);foreign.state.resource.ownerUserId=id('9');await assert.rejects(foreign.execute,e=>e.reasonCode==='RESOURCE_SCOPE_MISMATCH')
  const denied=fixture(operation);denied.state.access.permissions=[];await assert.rejects(denied.execute,e=>e.reasonCode==='PERMISSION_DENIED')
 }
})
test('current AUTHORIZE does no paid admission while refusing another organisation, user or absent product',async()=>{
 const good=fixture();assert.equal((await good.execute()).value,'authorised');assert.equal(good.invoked,1)
 for(const edit of [f=>f.input.organisationId=id('9'),f=>f.state.resource.ownerUserId=id('9'),f=>f.state.products=[],f=>f.state.access.denies=[{operation:'assistant.converse',feature:'assistant',resourceId:null}]]){
  const f=fixture();edit(f);await assert.rejects(f.execute);assert.equal(f.invoked,0)
 }
})
test('the existing fixed-organisation SG2 host preserves its profile and cannot borrow another organisation',async()=>{
 const f=fixture();f.options.application.profileId='PORR_SUITE';f.options.application.organisationId=id('2')
 assert.equal((await f.execute()).decision,'ALLOW')
 const g=fixture();g.options.application.profileId='PORR_SUITE';g.options.application.organisationId=id('9')
 await assert.rejects(g.execute,e=>e.reasonCode==='CONTEXT_INVALID');assert.equal(g.invoked,0)
})
test('GENERATE requires a real bound reservation; JSON/cross-actor receipts and missing metering deny before action',async()=>{
 const f=fixture();f.input.payload={kind:'GENERATE',commandId:id('3'),input:[{role:'user',content:'question'}]}
 f.session.reserveAssistantUsage=async()=>({status:'RESERVED',executionId:id('5')})
 await assert.rejects(f.execute,e=>e.reasonCode==='LIMIT_POLICY_UNAVAILABLE');assert.equal(f.invoked,0)
 const g=fixture();g.input.payload=structuredClone(f.input.payload);g.state.usagePolicy='NOT_APPLICABLE'
 await assert.rejects(g.execute,e=>e.reasonCode==='LIMIT_POLICY_UNAVAILABLE');assert.equal(g.invoked,0)
})
test('one successful Limits reservation is carried by E1 but cannot itself dispatch before the durable dispatch record',async()=>{
 const f=fixture(),calls=[];f.input.payload={kind:'GENERATE',commandId:id('3'),input:[{role:'user',content:'question'}]}
 const usage=createAssistantUsageStore({schemaDigest,commandKey:'b'.repeat(64),now:()=>now,query:async(_,args)=>{
  const d=JSON.parse(args[0]);calls.push(d.action);return{rows:[{result:{...d,environment:'development',applicationId:'spendguru',projectId:'lingering-thunder-05075810',branchId:'br-green-hall-b9s837k0',databaseName:'neondb',runtimeRole:'profitia_limits_assistant_runtime',status:'RESERVED',executionId:id('5'),expiresAt:new Date(now+20000).toISOString()}}]}
 }})
 f.session.reserveAssistantUsage=c=>usage.reserve({actorId:c.actorId,organisationId:c.organisationId,commandId:c.payload.commandId,decisionId:c.decisionId,input:c.payload.input,
  expectedPolicy:{id:id('6'),assignmentId:id('7'),assignmentRevision:1}})
 const result=await f.execute();assert.equal(result.value.status,'RESERVED');assert.deepEqual(calls,['RESERVE'])
 assert.throws(()=>takeAssistantAdmission(result.value,{inputDigest:result.value.inputDigest,now}))
})
test('unknown fields and budget errors cannot turn an authorisation check into an unmetered model call',async()=>{
 const f=fixture();f.input.payload={kind:'AUTHORIZE',input:[{role:'user',content:'hidden'}]};await assert.rejects(f.execute,e=>e.reasonCode==='CONTEXT_INVALID')
 const g=fixture();g.input.payload={kind:'GENERATE',commandId:id('3'),input:[{role:'user',content:'question'}]}
 g.session.reserveAssistantUsage=async()=>{const e=Error('unavailable');e.code='LIMIT_EXCEEDED';throw e}
 await assert.rejects(g.execute,e=>e.reasonCode==='LIMIT_EXCEEDED');assert.equal(g.invoked,0)
})
