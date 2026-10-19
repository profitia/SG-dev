import test from 'node:test'
import assert from 'node:assert/strict'
import {createOperationExecutor,OPERATION_CONTRACT,operationPayloadDigest,isOperationDenied} from '../src/operation-context.mjs'
import {createDelegatedJobStore} from '../src/delegated-job.mjs'
const time=Date.parse('2026-10-18T11:00:00Z'),expiry=new Date(time+25000).toISOString()
const A='11111111-1111-4111-8111-111111111111',U='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const S='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',J='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const D='dddddddd-dddd-4ddd-8ddd-dddddddddddd',B='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
function fixture(){
  const f={now:time,calls:[],events:[],committed:[],failIntent:false,failOutcome:false}
  f.application={appId:'supplier-worker',profileId:'PLATFORM_INTERNAL',deploymentId:'synthetic-worker',configurationVersion:'worker-v1',
    environment:'development',identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,operations:['job.execute'],features:['job_execution']}
  f.actor={kind:'SERVICE',actorId:S,serviceId:S,proofRef:'database-service:'+B+':1',issuer:f.application.identityIssuer,
    audience:f.application.appId,environment:'development',expiresAt:expiry}
  f.input={contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'job.execute',organisationId:A,
    resourceId:J,payload:{kind:'SUPPLIER_REPORT',nip:'5272443955'},request:null}
  const access={type:'DELEGATED_USER',actorId:S,organisationId:A,status:'ACTIVE',version:'1:99',sourceRef:'SYNTHETIC_ONLY',expiresAt:expiry,
    permissions:[{operation:'job.execute',feature:'job_execution',resourceId:J}],denies:[]}
  const resource={id:J,type:'job',environment:'development',dataClass:'ORGANISATION_PRIVATE',ownerOrganisationId:A,ownerUserId:null,version:'1',projectionVersion:'private-dispatch-v1'}
  const key={environment:'development',issuer:'https://synthetic.clerk.accounts.dev',subject:'user_synthetic'}
  const targetAccess={...structuredClone(access),type:'MEMBERSHIP',actorId:U,permissions:[{operation:'supplier.report.refresh',feature:'supplier_report',resourceId:null}]}
  const product={product:'SUPPLIER_INTELLIGENCE',features:['supplier_report'],organisationId:A,environment:'development',applicationId:'srm',
    status:'ACTIVE',version:'1',sourceRef:'SYNTHETIC_ONLY',source:'CONTRACT',expiresAt:expiry}
  f.state={applicationId:'supplier-worker',environment:'development',policyVersion:'access-v1:99',usagePolicy:'NOT_APPLICABLE',access,resource,products:[],
    delegation:{delegationId:D,jobId:J,requestId:J,sourceId:'stored.supplier-command',deliveryKey:'a'.repeat(64),status:'PENDING',payloadDigest:operationPayloadDigest(f.input.payload),
      subjectUserId:U,organisationId:A,executorApplicationId:'supplier-worker',bindingId:B,bindingVersion:'1',expiresAt:expiry,identityKey:key,
      sourceBinding:{projectId:'synthetic-source-project',branchId:'synthetic-source-branch',databaseName:'synthetic_source',applicationId:'synthetic-source',schemaDigest:'f'.repeat(64),payloadSchema:'stored-v1',qualityVersion:'quality-v1',classificationVersion:'shared-v1'},
      externalAccountObservation:{...key,status:'ACTIVE',observedAt:new Date(time).toISOString(),expiresAt:new Date(time+5000).toISOString()},
      target:{application:{appId:'srm',environment:'development',profileId:'SUPPLIER_INTELLIGENCE_STANDALONE',configurationVersion:'supplier-request-v1',organisationId:null,
        features:['supplier_report'],operations:['supplier.report.refresh']},operation:'supplier.report.refresh',resourceId:'request:synthetic',policyVersion:'access-v1:99',access:targetAccess,products:[product],
        resource:{...resource,id:'request:synthetic',type:'supplier_report_request',dataClass:'OPERATION_AUDIT',ownerUserId:U,projectionVersion:'request-v1'},
        module:{id:'supplier_report',bindingId:B,version:'1',sourceRef:'SYNTHETIC_ONLY',expiresAt:expiry}}}}
  f.options={application:f.application,now:()=>f.now,authenticate:async()=>f.actor,
    recordAudit:async e=>{if(f.failIntent&&e.phase==='INTENT')throw Error('synthetic audit failure');f.events.push(e)},
    withTransaction:async(_binding,run)=>{
      const pending=[]
      const result=await run({state:f.state,transaction:pending,transactionalEffects:true,outputBoundaryVersion:resource.projectionVersion,
        projectOutput:v=>v,recordOutcome:async e=>{if(f.failOutcome)throw Error('synthetic outcome failure');pending.push(e)},
        admitDispatch:async()=>{f.calls.push('admit');pending.push('PRIVATE_ADMISSION');return{jobId:J,status:'READY',requestId:J,sourceId:'stored.supplier-command',deliveryKey:'a'.repeat(64),leaseId:D,expiresAt:expiry,attempt:1}}})
      f.committed.push(...pending);return result
    }}
  f.execute=(action=context=>{f.calls.push('action');assert.equal(context.actor.kind,'SERVICE');assert.equal(context.actor.userId,undefined)
    assert.equal(context.subjectUserId,U);assert(Object.isFrozen(context.delegation));return context.dispatchAdmission})=>createOperationExecutor(f.options).execute(f.input,action)
  return f
}

test('same AM27 interpreter accepts the current closed Supplier target without HUMAN impersonation',async()=>{
 const f=fixture(),r=await f.execute();assert.equal(r.value.status,'READY');assert.deepEqual(f.calls,['admit','action'])
 const event=f.committed.find(v=>v.phase==='OUTCOME');assert.equal(event.actorKind,'SERVICE');assert.equal(event.actorId,S)
 assert.equal(event.subjectUserId,U);assert.equal(event.productEvidence[0].product,'SUPPLIER_INTELLIGENCE');assert.equal(event.productEvidence[0].feature,'supplier_report')
})
for(const profile of ['PORR_SUITE','SPENDGURU_SAAS','SUPPLIER_INTELLIGENCE_STANDALONE'])test('closed Supplier target supports '+profile+' and its actual organization rule',async()=>{
 const f=fixture();f.state.delegation.target.application.profileId=profile
 f.state.delegation.target.application.organisationId=profile==='PORR_SUITE'?A:null
 assert.equal((await f.execute()).value.status,'READY')
})
for(const[label,change]of[
 ['Forecast permission on Supplier',f=>f.state.delegation.target.access.permissions=[{operation:'forecast.request',feature:'forecast',resourceId:null}]],
 ['Forecast product on Supplier',f=>f.state.delegation.target.products[0].product='SPENDGURU'],
 ['Forecast module on Supplier',f=>f.state.delegation.target.module.id='benchmark'],
 ['unknown target operation',f=>f.state.delegation.target.operation='supplier.report.project'],
 ['technical initiating profile',f=>f.state.delegation.target.application.profileId='PLATFORM_INTERNAL'],
 ['foreign target organization',f=>f.state.delegation.target.access.organisationId=S],
 ['foreign subject',f=>f.state.delegation.subjectUserId=S],
 ['foreign payload',f=>f.input.payload.nip='5260250274'],
 ['disabled current membership',f=>f.state.delegation.target.access.status='SUSPENDED'],
 ['explicit deny',f=>f.state.delegation.target.access.denies=[...f.state.delegation.target.access.permissions]],
 ['expired delegation',f=>f.state.delegation.expiresAt=new Date(time).toISOString()],
 ['expired current product',f=>f.state.delegation.target.products[0].expiresAt=new Date(time).toISOString()],
 ['wrong source binding',f=>f.state.delegation.sourceBinding.schemaDigest='wrong'],
 ['missing fresh account observation',f=>delete f.state.delegation.externalAccountObservation],
 ['caller user claim on service',f=>f.actor.userId=U],
 ['caller on-behalf claim',f=>f.actor.onBehalfOf=U],
 ['HUMAN impersonation',f=>{f.actor.kind='HUMAN';f.actor.actorId=U;f.actor.userId=U;delete f.actor.serviceId}],
])test('closed Supplier delegation refuses '+label+' before effects',async()=>{
 const f=fixture();change(f);await assert.rejects(f.execute(),isOperationDenied);assert.deepEqual(f.calls,[]);assert.deepEqual(f.committed,[])
})
test('explicit optional store configuration never widens a default Forecast store',()=>{
 const binding={applicationId:'srm',environment:'development',projectId:'synthetic-project',branchId:'synthetic-branch',databaseName:'synthetic_db',role:'ordinary_role',schemaDigest:'a'.repeat(64)}
 assert.doesNotThrow(()=>createDelegatedJobStore({binding,schemaDigest:'b'.repeat(64)}))
 assert.doesNotThrow(()=>createDelegatedJobStore({binding,schemaDigest:'b'.repeat(64),targetOperation:'supplier.report.refresh',supplierSchemaDigest:'c'.repeat(64)}))
 for(const extra of [{targetOperation:'supplier.report.refresh'},{targetOperation:'category.write',supplierSchemaDigest:'c'.repeat(64)},{supplierSchemaDigest:'c'.repeat(64)},{targetOperation:'forecast.request',supplierSchemaDigest:'c'.repeat(64)}])assert.throws(()=>createDelegatedJobStore({binding,schemaDigest:'b'.repeat(64),...extra}),TypeError)
})
