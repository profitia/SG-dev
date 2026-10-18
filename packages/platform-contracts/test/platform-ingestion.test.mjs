import test from 'node:test'
import assert from 'node:assert/strict'
import {createOperationExecutor,OPERATION_CONTRACT,isOperationDenied} from '../src/operation-context.mjs'
import {platformReceiptEvidence} from '../src/platform-ingestion.mjs'
const time=Date.parse('2026-10-18T11:00:00Z'),expiry=new Date(time+25000).toISOString()
const ID='11111111-1111-4111-8111-111111111111',E='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
function fixture(){
  const f={time,actions:0,admissions:0,commits:[],events:[],replay:false,failOutcome:false}
  f.application={appId:'stored-source',profileId:'PLATFORM_INTERNAL',deploymentId:'synthetic-source',configurationVersion:'v1',environment:'development',
    identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,features:['knowledge_ingestion'],operations:['knowledge.ingest']}
  f.actor={kind:'SERVICE',actorId:ID,serviceId:ID,proofRef:'database-service:'+ID+':1',issuer:f.application.identityIssuer,
    audience:'stored-source',environment:'development',expiresAt:expiry}
  f.input={contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'knowledge.ingest',organisationId:null,
    resourceId:'synthetic-series',payload:{sourceId:'stored.forecast',content:{seriesId:'synthetic-series'}},idempotencyKey:'synthetic_ingestion_key_000001',request:null}
  f.state={applicationId:'stored-source',environment:'development',policyVersion:'source-v1:9',usagePolicy:'PLATFORM_BUDGET',products:[],
    access:{type:'SERVICE_GRANT',actorId:ID,organisationId:null,status:'ACTIVE',version:'1:9',sourceRef:'SYNTHETIC_ONLY',expiresAt:expiry,
      permissions:[{operation:'knowledge.ingest',feature:'knowledge_ingestion',resourceId:null}],denies:[]},
    resource:{id:'synthetic-series',type:'shared_knowledge',environment:'development',dataClass:'SHARED_KNOWLEDGE',ownerOrganisationId:null,
      ownerUserId:null,approvedSharedProjection:true,version:'1',projectionVersion:'source-receipt-v1'},
    ingestion:{sourceId:'stored.forecast',effectKind:'STORED_SQL_TRANSACTION',sourceVersion:'1',sourceRef:'SYNTHETIC_ONLY',payloadSchema:'stored-v1',
      qualityVersion:'quality-v1',classificationVersion:'shared-v1',expiresAt:expiry,policyId:ID,policyVersion:'1',unit:'SOURCE_TRANSACTION',capacity:1,used:0,
      windowStart:new Date(time-1000).toISOString(),windowEnd:expiry,policySourceRef:'SYNTHETIC_ONLY'}}
  f.options={application:f.application,now:()=>f.time,authenticate:async()=>f.actor,recordAudit:async event=>f.events.push(event),
    withTransaction:async(_binding,run)=>{const pending=[]
      const result=await run({state:f.state,transaction:pending,transactionalEffects:true,outputBoundaryVersion:'source-receipt-v1',projectOutput:v=>v,
        recordOutcome:async event=>{if(f.failOutcome)throw Error('synthetic audit outage');pending.push(event)},
        reserveIngestion:async()=>{f.admissions++;return{status:f.replay?'REPLAY':'NEW',effectId:E,policyId:ID,policyVersion:'1',...(f.replay?{receipt:{effectId:E,status:'COMMITTED'}}:{})}},
        completeIngestion:async()=>pending.push('COMMITTED_SOURCE_RECEIPT')})
      f.commits.push(...pending);return result}}
  f.execute=()=>createOperationExecutor(f.options).execute(f.input,async(context,tx)=>{f.actions++;tx.push('NATIVE_STORED_WRITE');return{effectId:context.platformReservation.effectId,status:'COMMITTED'}})
  return f
}
test('platform source uses SERVICE and null organisation with explicit provenance and finite source units',async()=>{
  const f=fixture(),r=await f.execute();assert.equal(r.value.status,'COMMITTED');assert.equal(f.actions,1)
  assert.equal(f.events[0].mode,'PLATFORM');assert.equal(f.events[0].organisationId,null);assert.equal(f.events[0].subjectUserId,null)
  assert.equal(f.events[0].sourceId,'stored.forecast');assert.equal(f.events[0].budgetUnit,'SOURCE_TRANSACTION')
  assert.equal(platformReceiptEvidence(r.value),null,'A bare executor result is not proof that a native source driver committed')
})
test('funded source replay skips the business effect even at finite capacity',async()=>{
  const f=fixture();f.replay=true;f.state.ingestion.used=1;await f.execute();assert.equal(f.actions,0);assert.equal(f.admissions,1)
  assert.equal(f.commits.includes('COMMITTED_SOURCE_RECEIPT'),false)
})
for(const[label,change]of[
  ['human identity',f=>{f.actor.kind='HUMAN';f.actor.userId=ID;delete f.actor.serviceId}],
  ['organisation alias',f=>f.input.organisationId=ID],['customer product policy',f=>f.state.usagePolicy='PRODUCT_POLICY'],
  ['missing budget',f=>delete f.state.ingestion],['unbounded capacity',f=>f.state.ingestion.capacity=Infinity],
  ['negative usage',f=>f.state.ingestion.used=-1],['overspent usage',f=>f.state.ingestion.used=2],
  ['pretended CPU budget',f=>f.state.ingestion.unit='CPU_SECONDS'],['unapproved external effect',f=>f.state.ingestion.effectKind='PAID_VENDOR_FETCH'],
  ['missing quality approval',f=>f.state.ingestion.qualityVersion=''],['missing classification approval',f=>f.state.ingestion.classificationVersion=''],
  ['unknown payload schema',f=>f.state.ingestion.payloadSchema=''],['foreign source',f=>f.state.ingestion.sourceId='foreign-source'],
  ['private input envelope',f=>f.input.payload.organisationId=ID],['expired budget',f=>f.state.ingestion.expiresAt=new Date(time).toISOString()],
  ['future budget window',f=>f.state.ingestion.windowStart=new Date(time+1).toISOString()],
  ['private resource owner',f=>f.state.resource.ownerOrganisationId=ID],['private resource user',f=>f.state.resource.ownerUserId=ID],
  ['unapproved shared projection',f=>f.state.resource.approvedSharedProjection=false],['wrong resource environment',f=>f.state.resource.environment='staging'],
  ['missing technical permission',f=>f.state.access.permissions=[]],['explicit technical deny',f=>f.state.access.denies=[...f.state.access.permissions]],
  ['missing idempotency key',f=>delete f.input.idempotencyKey],
])test('source authority refuses '+label+' before admission and effect',async()=>{
  const f=fixture();change(f);await assert.rejects(f.execute(),isOperationDenied);assert.equal(f.admissions,0);assert.equal(f.actions,0);assert.deepEqual(f.commits,[])
})
test('source OUTCOME failure withholds receipt and rolls back the one source transaction',async()=>{
  const f=fixture();f.failOutcome=true;await assert.rejects(f.execute(),e=>e.reasonCode==='AUDIT_UNAVAILABLE')
  assert.deepEqual(f.commits,[]);assert.deepEqual(f.events.map(e=>e.phase),['INTENT','FAILURE'])
})
