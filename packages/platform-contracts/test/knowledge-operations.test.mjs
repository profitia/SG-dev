import test from 'node:test';import assert from 'node:assert/strict';
import {createOperationExecutor,OPERATION_CONTRACT,operationPayloadDigest} from '../src/operation-context.mjs';
import {KNOWLEDGE_OPERATION_RULES,knowledgeOperationPolicy} from '../src/knowledge-operations.mjs';
const now=Date.parse('2026-11-11T12:00:00Z'),expiresAt=new Date(now+10000).toISOString();
function fixture(op='knowledge.private.document.query'){
 const rule=knowledgeOperationPolicy(op),job=rule.mode==='KNOWLEDGE_SERVICE',actorId=job?'worker':'user-a',appId='platform-knowledge-development-'+(job?'worker':'api');
 const actor={kind:job?'SERVICE':'HUMAN',actorId,...(job?{serviceId:actorId}:{userId:actorId}),proofRef:'native-current-e1',issuer:'current-e1',audience:appId,environment:'development',expiresAt};
 const payload={phase:'ADMIT'},resource={id:'library',type:rule.resourceType,dataClass:rule.dataClass,environment:'development',ownerOrganisationId:null,
  ownerUserId:rule.scope==='private'?'user-a':null,version:'1',projectionVersion:'knowledge-v1',approvedSharedProjection:true};
 const state={applicationId:appId,environment:'development',transactionId:'42',policyVersion:'native-1',resource,products:[],usagePolicy:rule.boundedExecution?'PLATFORM_BUDGET':'NOT_APPLICABLE',
  access:{type:job?'SERVICE_GRANT':'ACCOUNT_SELF',actorId,organisationId:null,status:'ACTIVE',version:'1',sourceRef:'native-e1',expiresAt,permissions:[{operation:op,feature:'platform_knowledge',resourceId:'library'}],denies:[]},
  knowledge:{contract:'profitia.knowledge-operations/1.0.0',schemaDigest:'a'.repeat(64),applicationId:appId,environment:'development',resourceId:'library',
   payloadDigest:operationPayloadDigest(payload),scope:rule.scope==='private'?'ACCOUNT_PRIVATE':'PROFITIA_SHARED',transactionId:'42',ownerUserId:resource.ownerUserId,
   administrationAllowed:rule.scope==='shared',revocationVersion:'native-1',expiresAt,
   executionPolicy:{provider:'openai',models:['gpt-6-luna','text-embedding-3-small'],store:false,maximumPaidAttempts:1,maximumInputTokens:16384,maximumOutputTokens:4096,
    maximumJobMinutes:30,maximumDocumentMicrousd:1000000,globalBudgetCeilingMicrousd:10000000,atomicPerBatch:true,uncertainRetainsReservation:true},
   ...(job?{delegation:{id:'bounded-job',resourceId:'library',status:'ACTIVE',expiresAt,revocationVersion:'native-1'}}:{})}};
 const events=[],session={state,transaction:{},transactionalEffects:true,outputBoundaryVersion:'knowledge-v1',assertKnowledgeBudget:async()=>{},recordOutcome:async e=>events.push(e),projectOutput:v=>v};
 const options={application:{appId,profileId:job?'PLATFORM_INTERNAL':'SPENDGURU_SAAS',environment:'development',deploymentId:'synthetic',configurationVersion:'knowledge-v1',identityIssuer:'current-e1',organisationId:null,operations:[op],features:['platform_knowledge']},
  knowledgeSchemaDigest:'a'.repeat(64),now:()=>now,authenticate:async()=>actor,recordAudit:async e=>events.push(e),withTransaction:async(_b,run)=>run(session)};
 return{options,session,state,actor,events,input:{contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:op,organisationId:null,resourceId:'library',payload,request:null}};
}
for(const op of Object.keys(KNOWLEDGE_OPERATION_RULES))test('canonical Root executes exact '+op,async()=>{
 const f=fixture(op),executor=createOperationExecutor(f.options);assert.equal(executor.contract.implementation,'1.0.0-candidate.23');
 assert.equal((await executor.execute(f.input,async()=>({ok:true}))).value.ok,true);assert.deepEqual(f.events.map(e=>e.phase),['INTENT','OUTCOME']);
});
for(const [label,mutate] of [
 ['foreign private owner',f=>f.state.resource.ownerUserId='user-b'],['organisation owner',f=>f.state.resource.ownerOrganisationId='org-a'],
 ['revoked grant',f=>f.state.access.status='REVOKED'],['explicit deny',f=>f.state.access.denies=[...f.state.access.permissions]],
 ['forged transaction',f=>f.state.knowledge.transactionId='99'],['payload substitution',f=>f.input.payload={phase:'OTHER'}],
 ['wrong schema',f=>f.state.knowledge.schemaDigest='b'.repeat(64)],['expired proof',f=>f.state.knowledge.expiresAt=new Date(now-1).toISOString()],
 ['missing budget port',f=>delete f.session.assertKnowledgeBudget],['unbounded provider',f=>f.state.knowledge.executionPolicy.maximumPaidAttempts=3],
 ['missing native proof',f=>delete f.state.knowledge],['unadopted namespace',f=>delete f.options.knowledgeSchemaDigest]
])test('knowledge boundary denies '+label,async()=>{const f=fixture();mutate(f);let effects=0;
 await assert.rejects(async()=>createOperationExecutor(f.options).execute(f.input,async()=>{effects++;return{};}));assert.equal(effects,0);
});
test('unpublished shared source requires explicit administration authority',async()=>{
 const f=fixture('knowledge.shared.document.read');f.state.resource.approvedSharedProjection=false;f.state.knowledge.administrationAllowed=false;
 await assert.rejects(createOperationExecutor(f.options).execute(f.input,async()=>({})));f.state.knowledge.administrationAllowed=true;
 assert.equal((await createOperationExecutor(f.options).execute(f.input,async()=>true)).value,true);
});
