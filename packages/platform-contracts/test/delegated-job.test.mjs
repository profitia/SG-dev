import test from 'node:test'
import assert from 'node:assert/strict'
import {createOperationExecutor,OPERATION_CONTRACT,operationPayloadDigest,isOperationDenied} from '../src/operation-context.mjs'
import {createDelegatedJobHost} from '../src/private-operation-host.mjs'

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
      const result=await run({state:f.state,transaction:pending,transactionalEffects:true,outputBoundaryVersion:resource.projectionVersion,
        projectOutput:v=>v,recordOutcome:async e=>{if(f.failOutcome)throw Error('synthetic outcome failure');pending.push(e)},
        admitDispatch:async()=>{f.calls.push('admit');pending.push('PRIVATE_ADMISSION');return{jobId:J,status:'READY',requestId:J,sourceId:'stored.forecast',deliveryKey:'a'.repeat(64),leaseId:D,expiresAt:expiry,attempt:1}}})
      f.committed.push(...pending);return result
    }}
  f.execute=(action=context=>{f.calls.push('action');assert.equal(context.actor.kind,'SERVICE');assert.equal(context.actor.userId,undefined)
    assert.equal(context.subjectUserId,U);assert(Object.isFrozen(context.delegation));return context.dispatchAdmission})=>createOperationExecutor(f.options).execute(f.input,action)
  return f
}
test('delegated dispatch uses the common target permission/product/resource checks without human impersonation',async()=>{
  const f=fixture(),r=await f.execute();assert.equal(r.value.status,'READY');assert.deepEqual(f.calls,['admit','action'])
  assert.deepEqual(f.events.map(e=>[e.phase,e.actorKind,e.actorId,e.subjectUserId]),[['INTENT','SERVICE',S,U]])
  const outcome=f.committed.find(v=>v.phase==='OUTCOME');assert.equal(outcome.subjectUserId,U);assert.equal(outcome.ownerUserId,null)
  assert.equal(outcome.productEvidence[0].product,'SPENDGURU');assert.equal(outcome.productEvidence[0].feature,'forecast')
})
for(const[label,change]of[
  ['human actor',f=>{f.actor={...f.actor,kind:'HUMAN',actorId:U,userId:U};delete f.actor.serviceId}],
  ['service user claim',f=>f.actor.userId=U],['on behalf claim',f=>f.actor.onBehalfOf=U],
  ['wrong payload',f=>f.input.payload.kind='VERIFICATION'],['wrong organisation',f=>f.input.organisationId=D],
  ['wrong job',f=>f.input.resourceId=D],['unbound executor',f=>f.state.delegation.executorApplicationId='foreign-worker'],
  ['expired delegation',f=>f.state.delegation.expiresAt=new Date(time).toISOString()],
  ['unbounded delegation lease',f=>f.state.delegation.expiresAt=new Date(time+30001).toISOString()],
  ['missing external account observation',f=>delete f.state.delegation.externalAccountObservation],
  ['external account observation for another subject',f=>f.state.delegation.externalAccountObservation.subject='user_foreign'],
  ['expired external account observation',f=>f.state.delegation.externalAccountObservation.expiresAt=new Date(time).toISOString()],
  ['future external account observation',f=>f.state.delegation.externalAccountObservation.observedAt=new Date(time+1).toISOString()],
  ['unbounded external account observation',f=>f.state.delegation.externalAccountObservation.expiresAt=new Date(time+5001).toISOString()],
  ['wrong initiating application environment',f=>f.state.delegation.target.application.environment='staging'],
  ['wrong initiating application profile',f=>f.state.delegation.target.application.profileId='PLATFORM_INTERNAL'],
  ['wrong current target operation',f=>f.state.delegation.target.operation='supplier.report.project'],
  ['missing target capability',f=>f.state.delegation.target.access.permissions=[]],
  ['explicit target deny',f=>f.state.delegation.target.access.denies=[...f.state.delegation.target.access.permissions]],
  ['wrong target member',f=>f.state.delegation.target.access.actorId=S],
  ['suspended target member',f=>f.state.delegation.target.access.status='SUSPENDED'],
  ['missing target product',f=>f.state.delegation.target.products=[]],
  ['target product from another app',f=>f.state.delegation.target.products[0].applicationId='foreign'],
  ['expired target module',f=>f.state.delegation.target.module.expiresAt=new Date(time).toISOString()],
  ['wrong target resource owner',f=>f.state.delegation.target.resource.ownerUserId=S],
  ['wrong target resource organisation',f=>f.state.delegation.target.resource.ownerOrganisationId=S],
  ['changed target revision',f=>f.state.delegation.target.policyVersion='access-v1:98'],
  ['service capability absent',f=>f.state.access.permissions=[]],['service explicit deny',f=>f.state.access.denies=[...f.state.access.permissions]],
])test('delegated dispatch refuses '+label+' before admission or action',async()=>{
  const f=fixture();change(f);await assert.rejects(f.execute(),isOperationDenied);assert.deepEqual(f.calls,[]);assert.deepEqual(f.committed,[])
  assert.equal(f.events.at(-1).decision,'DENY')
})
test('independent intent failure prevents private admission; failed outcome rolls back only the private transaction',async()=>{
  const f=fixture();f.failIntent=true;await assert.rejects(f.execute(),e=>e.reasonCode==='AUDIT_UNAVAILABLE');assert.deepEqual(f.calls,[])
  const g=fixture();g.failOutcome=true;await assert.rejects(g.execute(),e=>e.reasonCode==='AUDIT_UNAVAILABLE');assert.deepEqual(g.committed,[])
  assert.deepEqual(g.events.map(e=>e.phase),['INTENT','FAILURE'])
})
test('expired external observation withholds output and rolls back private admission',async()=>{
  const f=fixture();await assert.rejects(f.execute(context=>{f.now+=5000;return context.dispatchAdmission}),e=>e.reasonCode==='DELEGATION_INVALID')
  assert.deepEqual(f.committed,[]);assert.equal(f.events.at(-1).phase,'FAILURE')
})
test('closed private dispatch host rejects caller effect, resource, identity and projection adapters',()=>{
  const f=fixture(),base={application:f.application,binding:{service:{profileId:'PLATFORM_INTERNAL',deploymentId:'synthetic-worker',configurationVersion:'worker-v1'}},
    job:{schemaDigest:'a'.repeat(64)},readExternalAccount:async()=>null}
  for(const field of ['readResources','projectOutput','createAuthenticator','prepareInputs','requestLedger','describeOutcome'])
    assert.throws(()=>createDelegatedJobHost({...base,[field]:async()=>null}),TypeError)
})
