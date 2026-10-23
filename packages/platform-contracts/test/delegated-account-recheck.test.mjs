import test from 'node:test'
import assert from 'node:assert/strict'
import {createOperationExecutor,OPERATION_CONTRACT,operationPayloadDigest} from '../src/operation-context.mjs'
import {createDelegatedNativeWorkHost,createDelegatedJobHost,createDelegatedPrivateInspectionHost,createPrivateOperationHost,createServiceReadHost} from '../src/private-operation-host.mjs'

// Synthetic independent authority fixture, matching the existing delegated
// acceptance scenarios; no provider or product identity is used.
const time=Date.parse('2026-10-18T11:00:00Z'),expiry=new Date(time+25000).toISOString()
const A='11111111-1111-4111-8111-111111111111',U='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const S='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',J='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const D='dddddddd-dddd-4ddd-8ddd-dddddddddddd',B='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
function fixture(){
  const f={now:time,calls:[],events:[],committed:[],failIntent:false,failOutcome:false}
  f.application={appId:'forecast-worker',profileId:'PLATFORM_INTERNAL',deploymentId:'synthetic-worker',configurationVersion:'worker-v1',
    environment:'development',identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,operations:['job.execute'],features:['job_execution']}
  f.actor={kind:'SERVICE',actorId:S,serviceId:S,proofRef:'database-service:'+B+':1',issuer:f.application.identityIssuer,
    audience:f.application.appId,environment:'development',expiresAt:expiry}
  f.input={contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'job.execute',organisationId:A,
    resourceId:J,payload:{seriesId:'synthetic-series',modelId:'stored',targetSemantics:'CURRENT',kind:'CURRENT'},request:null}
  const access={type:'DELEGATED_USER',actorId:S,organisationId:A,status:'ACTIVE',version:'1:99',sourceRef:'SYNTHETIC_ONLY',expiresAt:expiry,
    permissions:[{operation:'job.execute',feature:'job_execution',resourceId:J}],denies:[]}
  const resource={id:J,type:'job',environment:'development',dataClass:'ORGANISATION_PRIVATE',ownerOrganisationId:A,ownerUserId:null,version:'1',projectionVersion:'private-dispatch-v1'}
  const key={environment:'development',issuer:'https://synthetic.clerk.accounts.dev',subject:'user_synthetic'}
  const targetAccess={...structuredClone(access),type:'MEMBERSHIP',actorId:U,permissions:[{operation:'forecast.request',feature:'forecast',resourceId:null}]}
  const product={product:'SPENDGURU',features:['forecast','benchmark'],organisationId:A,environment:'development',applicationId:'spendguru',
    status:'ACTIVE',version:'1',sourceRef:'SYNTHETIC_ONLY',source:'CONTRACT',expiresAt:expiry}
  f.state={applicationId:'forecast-worker',environment:'development',policyVersion:'access-v1:99',usagePolicy:'NOT_APPLICABLE',access,resource,products:[],
    delegation:{delegationId:D,jobId:J,requestId:J,sourceId:'stored.forecast',deliveryKey:'a'.repeat(64),status:'PENDING',payloadDigest:operationPayloadDigest(f.input.payload),
      subjectUserId:U,organisationId:A,executorApplicationId:'forecast-worker',bindingId:B,bindingVersion:'1',expiresAt:expiry,identityKey:key,
      sourceBinding:{projectId:'synthetic-source-project',branchId:'synthetic-source-branch',databaseName:'synthetic_source',applicationId:'synthetic-source',schemaDigest:'f'.repeat(64),payloadSchema:'stored-v1',qualityVersion:'quality-v1',classificationVersion:'shared-v1'},
      externalAccountObservation:{...key,status:'ACTIVE',observedAt:new Date(time).toISOString(),expiresAt:new Date(time+5000).toISOString()},
      target:{application:{appId:'spendguru',environment:'development',profileId:'SPENDGURU_SAAS',configurationVersion:'forecast-request-v1',organisationId:null,
        features:['forecast'],operations:['forecast.request']},operation:'forecast.request',resourceId:'request:synthetic',policyVersion:'access-v1:99',access:targetAccess,products:[product],
        resource:{...resource,id:'request:synthetic',type:'forecast_request',dataClass:'OPERATION_AUDIT',ownerUserId:U,projectionVersion:'request-v1'},
        module:{id:'benchmark',bindingId:B,version:'1',sourceRef:'SYNTHETIC_ONLY',expiresAt:expiry}}}}
  f.options={application:f.application,now:()=>f.now,authenticate:async()=>f.actor,
    recordAudit:async e=>{if(f.failIntent&&e.phase==='INTENT')throw Error('synthetic audit failure');f.events.push(e)},
    withTransaction:async(_binding,run)=>{
      const pending=[]
      const result=await run({...(f.revalidate ? {revalidateExternalAccount:f.revalidate}:{}),state:f.state,transaction:pending,transactionalEffects:true,outputBoundaryVersion:resource.projectionVersion,
        projectOutput:v=>v,recordOutcome:async e=>{if(f.failOutcome)throw Error('synthetic outcome failure');pending.push(e)},
        admitDispatch:async()=>{f.calls.push('admit');pending.push('PRIVATE_ADMISSION');return{jobId:J,status:'READY',requestId:J,sourceId:'stored.forecast',deliveryKey:'a'.repeat(64),leaseId:D,expiresAt:expiry,attempt:1}}})
      f.committed.push(...pending);return result
    }}
  f.execute=(action=context=>{f.calls.push('action');assert.equal(context.actor.kind,'SERVICE');assert.equal(context.actor.userId,undefined)
    assert.equal(context.subjectUserId,U);assert(Object.isFrozen(context.delegation));return context.dispatchAdmission})=>createOperationExecutor(f.options).execute(f.input,action)
  return f
}

const fresh = f => ({...f.state.delegation.identityKey,status:'ACTIVE',observedAt:new Date(f.now).toISOString(),expiresAt:new Date(f.now+5000).toISOString()})
const longWork = f => context => {f.now+=13000;return context.dispatchAdmission}
test('opted-in outcome uses a fresh proof without extending or mutating admission evidence',async()=>{
 const f=fixture(),before=structuredClone(f.state.delegation);let calls=0
 f.revalidate=async()=>{calls++;return fresh(f)}
 const result=await f.execute(longWork(f));assert.equal(result.decision,'ALLOW');assert.equal(calls,1)
 assert.deepEqual(f.state.delegation,before);assert.equal(f.committed.filter(v=>v.phase==='OUTCOME').length,1)
})
test('an unadopted receiver still refuses an expired admission observation',async()=>{
 const f=fixture();await assert.rejects(f.execute(longWork(f)),e=>e.reasonCode==='DELEGATION_INVALID');assert.deepEqual(f.committed,[])
})
for(const [label,change] of [
 ['missing proof',()=>null],['revoked account',(_f,p)=>({...p,status:'REVOKED'})],
 ['another subject',(_f,p)=>({...p,subject:'user_other'})],['another issuer',(_f,p)=>({...p,issuer:'https://foreign.invalid'})],
 ['another environment',(_f,p)=>({...p,environment:'production'})],
 ['expired proof',(f,p)=>({...p,expiresAt:new Date(f.now).toISOString()})],
 ['future proof',(f,p)=>({...p,observedAt:new Date(f.now+1).toISOString()})],
 ['extended proof',(f,p)=>({...p,expiresAt:new Date(f.now+5001).toISOString()})],
 ['provider unavailable',()=>{throw Error('SYNTHETIC_PROVIDER_UNAVAILABLE')}],
 ['provider latency expires proof',(f,p)=>{f.now+=5000;return p}],
 ['original delegation expires',(f,p)=>{f.state.delegation.expiresAt=new Date(f.now).toISOString();return p}],
 ['original membership revoked',(f,p)=>{f.state.delegation.target.access.status='SUSPENDED';return p}],
 ['original permission revoked',(f,p)=>{f.state.delegation.target.access.permissions=[];return p}],
 ['original product revoked',(f,p)=>{f.state.delegation.target.products=[];return p}]
])test('fresh account check cannot bypass '+label,async()=>{
 const f=fixture();f.revalidate=async()=>change(f,fresh(f));await assert.rejects(f.execute(longWork(f)))
 assert.deepEqual(f.committed,[]);assert.equal(f.events.at(-1).phase,'FAILURE');assert.equal(f.events.at(-1).decision,'DENY')
})
test('a failed initial authority check never calls the final provider reader',async()=>{
 const f=fixture();f.state.delegation.externalAccountObservation=null;f.revalidate=async()=>assert.fail('No initial authority')
 await assert.rejects(f.execute());assert.deepEqual(f.calls,[]);assert.deepEqual(f.committed,[])
})
test('the service identity is checked again after time spent reading the provider',async()=>{
 const f=fixture();f.actor.expiresAt=new Date(time+13500).toISOString()
 f.revalidate=async()=>{f.now+=500;return fresh(f)}
 await assert.rejects(f.execute(longWork(f)),e=>e.reasonCode==='ACCESS_BASIS_INVALID')
 assert.deepEqual(f.committed,[])
})
const options=()=>({application:{appId:'worker',profileId:'PLATFORM_INTERNAL',environment:'development',deploymentId:'fixture',configurationVersion:'v1',identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,features:['job_execution'],operations:['job.execute']},binding:{applicationId:'worker',environment:'development',projectId:'fixture',branchId:'fixture',databaseName:'fixture',role:'fixture_runtime',schemaDigest:'a'.repeat(64),service:{schemaDigest:'b'.repeat(64),profileId:'PLATFORM_INTERNAL',deploymentId:'fixture',configurationVersion:'v1'}},job:{schemaDigest:'1'.repeat(64),targetOperation:'supplier.report.refresh',supplierSchemaDigest:'2'.repeat(64)},privateWork:{schemaDigest:'3'.repeat(64)},independentQuery:async()=>assert.fail('No constructor query'),transact:async()=>assert.fail('No constructor transaction'),readExternalAccount:async()=>assert.fail('No constructor account read')})
test('the versioned opt-in is explicit, native-only and makes no constructor provider call',()=>{
 assert.equal(createDelegatedNativeWorkHost(options()).hostContract.version,'1.11.0')
 assert.equal(createDelegatedNativeWorkHost({...options(),revalidateExternalAccountBeforeOutcome:true}).hostContract.version,'1.13.0')
 for(const value of [false,null,'true',()=>true])assert.throws(()=>createDelegatedNativeWorkHost({...options(),revalidateExternalAccountBeforeOutcome:value}),TypeError)
 for(const factory of [createDelegatedJobHost,createDelegatedPrivateInspectionHost,createPrivateOperationHost,createServiceReadHost])assert.throws(()=>factory({...options(),revalidateExternalAccountBeforeOutcome:true}),TypeError)
})
