import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperationExecutor,IMPLEMENTED_OPERATIONS,OPERATION_CONTRACT,operationPayloadDigest,isOperationDenied} from '../src/operation-context.mjs';
import {RECURRING_JOB_CONTRACT,RECURRING_JOB_OPERATIONS,recurringOperationPolicy,validateRecurringDelegation} from '../src/recurring-job.mjs';

// Deliberately synthetic, offline authorities. No hosted account or API call.
const t=Date.parse('2026-11-11T06:00:00Z'),iso=ms=>new Date(ms).toISOString();
const ids=Array.from({length:7},(_,n)=>String(n+1).repeat(8)+'-'+String(n+1).repeat(4)+'-4'+String(n+1).repeat(3)+'-8'+String(n+1).repeat(3)+'-'+String(n+1).repeat(12));
const [org,owner,service,job,resource,lease,delegation]=ids,schema='f'.repeat(64);
function fixture(operation='newsfeed.monitor.execute'){
 const policy=recurringOperationPolicy(operation),f={time:t,events:[],committed:[]};
 const appId='synthetic-'+(operation.startsWith('newsfeed')?'newsfeed':'insights');
 f.application={appId,profileId:'SPENDGURU_SAAS',deploymentId:'SYNTHETIC_ONLY',configurationVersion:'synthetic-v1',environment:'development',identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,operations:[operation],features:[policy.ownerFeature]};
 f.input={contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation,organisationId:org,resourceId:job,payload:{resourceId:resource,version:'1',slot:'2026-11-11T06:00:00Z'},request:null};
 f.actor={kind:'SERVICE',actorId:service,serviceId:service,proofRef:'synthetic-bound-service:1',issuer:f.application.identityIssuer,audience:appId,environment:'development',expiresAt:iso(t+25000)};
 const access={type:'MEMBERSHIP',actorId:owner,organisationId:org,status:'ACTIVE',version:'1',sourceRef:'SYNTHETIC_ONLY',expiresAt:iso(t+25000),permissions:[{operation:policy.ownerOperation,feature:policy.ownerFeature,resourceId:null}],denies:[]};
 const product={product:'SPENDGURU',features:[policy.ownerFeature],organisationId:org,environment:'development',applicationId:appId,status:'ACTIVE',version:'1',sourceRef:'SYNTHETIC_ONLY',source:'CONTRACT',expiresAt:iso(t+25000)};
 f.delegation={contract:RECURRING_JOB_CONTRACT.id+'/'+RECURRING_JOB_CONTRACT.version,schemaDigest:schema,delegationId:delegation,delegationVersion:'1',jobId:job,leaseId:lease,executorApplicationId:appId,serviceActorId:service,organisationId:org,ownerUserId:owner,resourceType:policy.resourceType,resourceId:resource,resourceVersion:'1',scheduleSlot:'2026-11-11T06:00:00Z',payloadDigest:operationPayloadDigest(f.input.payload),policyResourceId:operation.startsWith('newsfeed')?'newsfeed-observations':'oil-asphalt',claimedAt:iso(t),expiresAt:iso(t+25000),ownerApplication:{...f.application,operations:[policy.ownerOperation]},ownerAccess:access,ownerProducts:[product],identityObservation:{status:'ACTIVE',issuer:'https://synthetic.clerk.accounts.dev',subject:'user_synthetic',observedAt:iso(t),expiresAt:iso(t+5000)},policyVersion:'synthetic-policy:1'};
 f.state={applicationId:appId,environment:'development',policyVersion:'synthetic-policy:1',usagePolicy:'NOT_APPLICABLE',products:[],access:{...access,type:'DELEGATED_USER',actorId:service,permissions:[{operation,feature:policy.ownerFeature,resourceId:job}]},resource:{id:job,type:'private_recurring_job',dataClass:'USER_IN_ORGANISATION_PRIVATE',environment:'development',ownerOrganisationId:org,ownerUserId:owner,version:'1',projectionVersion:'synthetic-recurring-v1'},recurringDelegation:f.delegation};
 f.options={application:f.application,recurringSchemaDigest:schema,now:()=>f.time,authenticate:async()=>f.actor,recordAudit:async e=>{f.events.push(e)},withTransaction:async(_,run)=>{const pending=[];const answer=await run({state:f.state,transaction:pending,transactionalEffects:true,outputBoundaryVersion:'synthetic-recurring-v1',projectOutput:v=>v,revalidateExternalAccount:async()=>structuredClone(f.delegation.identityObservation),recordOutcome:async e=>{if(f.failOutcome)throw Error('SYNTHETIC_ONLY');pending.push(e)}});f.committed.push(...pending);return answer;}};
 f.run=(action=(ctx,tx)=>{tx.push('effect');assert.equal(ctx.actorKind,'SERVICE');assert.equal(ctx.actorId,service);assert.equal(ctx.subjectUserId,owner);assert(Object.isFrozen(ctx.recurringDelegation));return{status:'RECORDED'}})=>createOperationExecutor(f.options).execute(f.input,action);
 return f;
}
const denied=e=>isOperationDenied(e);
for(const op of RECURRING_JOB_OPERATIONS){
 test(op+': SERVICE keeps its identity and exact private owner',async()=>{const f=fixture(op);await f.run();assert(f.committed.includes('effect'));assert.equal(f.events[0].subjectUserId,owner);assert(!JSON.stringify(f.events).includes('user_synthetic'));});
 for(const [label,change] of Object.entries({
  human:f=>{f.actor={...f.actor,kind:'HUMAN',userId:service};delete f.actor.serviceId},
  ownerIsService:f=>f.delegation.ownerUserId=service,
  foreignOrganisation:f=>f.delegation.organisationId=owner,
  foreignApplication:f=>f.delegation.executorApplicationId='foreign',
  mismatchedPayload:f=>f.input.payload.version='2',
  changedResource:f=>f.state.resource.version='2',
  changedOwner:f=>f.state.resource.ownerUserId=service,
  expiredLease:f=>f.time=t+25000,
  oversizedLease:f=>f.delegation.expiresAt=iso(t+30001),
  staleIdentity:f=>f.time=t+5001,
  revokedAccount:f=>f.delegation.identityObservation.status='DISABLED',
  revokedMember:f=>f.delegation.ownerAccess.status='REVOKED',
  deniedOwner:f=>f.delegation.ownerAccess.denies=[...f.delegation.ownerAccess.permissions],
  revokedProduct:f=>f.delegation.ownerProducts[0].status='REVOKED',
  foreignProduct:f=>f.delegation.ownerProducts[0].organisationId=owner,
  foreignEnvironment:f=>f.delegation.ownerApplication.environment='production',
  missingSchema:f=>delete f.options.recurringSchemaDigest,
  unknownField:f=>f.delegation.allow=true,
  legacyContinuation:f=>f.state.requestContinuation={},
  legacyInspection:f=>f.state.requestInspection={},
  legacyWork:f=>f.state.requestWork={},
 })){
  test(op+': refuses '+label+' before any effect',async()=>{const f=fixture(op);change(f);await assert.rejects(async()=>f.run(),label==='missingSchema'?TypeError:denied);assert.equal(f.committed.length,0)});
 }
 for(const [label,change] of Object.entries({membership:f=>f.delegation.ownerAccess.status='REVOKED',product:f=>f.delegation.ownerProducts[0].status='REVOKED',version:f=>f.delegation.resourceVersion='2',identity:f=>f.time=t+5001})){
  test(op+': rolls back when '+label+' changes before commit',async()=>{const f=fixture(op);await assert.rejects(f.run((_,tx)=>{tx.push('effect');change(f);return{status:'RECORDED'}}),denied);assert.equal(f.committed.length,0)});
 }
 test(op+': outcome audit failure rolls back',async()=>{const f=fixture(op);f.failOutcome=true;await assert.rejects(f.run(),denied);assert.equal(f.committed.length,0)});
}
test('legacy public operation catalogue is unchanged; recurring requires explicit adoption',()=>{assert.equal(IMPLEMENTED_OPERATIONS.length,36);for(const op of RECURRING_JOB_OPERATIONS)assert(!IMPLEMENTED_OPERATIONS.includes(op));const f=fixture();assert.throws(()=>createOperationExecutor({...f.options,assistantSchemaDigest:schema}),TypeError)});
test('returned delegation is a detached frozen snapshot',()=>{const f=fixture();const d=validateRecurringDelegation(f.delegation,{operation:f.input.operation,jobId:job,applicationId:f.application.appId,organisationId:org,actorId:service,payloadDigest:operationPayloadDigest(f.input.payload),schemaDigest:schema,now:t});f.delegation.ownerAccess.status='REVOKED';assert.equal(d.ownerAccess.status,'ACTIVE');assert(Object.isFrozen(d.ownerAccess))});

