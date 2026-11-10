import test from 'node:test'
import assert from 'node:assert/strict'
import {createOperationExecutor,OPERATION_CONTRACT,ORGANISATION_BOOTSTRAP_ROOT_CONTRACT} from '../src/operation-context.mjs'
import {createTestIdentityIssuer} from '../../../apps/architecture-lab/src/operation-test-authority.mjs'
const time=Date.parse('2026-11-11T00:00:00Z'),expiry=new Date(time+20000).toISOString(),schema='a'.repeat(64)
function fixture(){
 const issuer=createTestIdentityIssuer({applicationId:'bootstrap-synthetic',now:()=>time})
 const commandId='11111111-1111-4111-8111-111111111111',userId='22222222-2222-4222-8222-222222222222',resourceId='current-organisation-onboarding'
 const application={appId:'bootstrap-synthetic',profileId:'SPENDGURU_SAAS',environment:'development',deploymentId:'isolated',configurationVersion:'v1',identityIssuer:issuer.issuer,organisationId:null,features:['organisation_admin'],operations:['organisation.create']}
 const policy={actorId:userId,applicationId:application.appId,commandId,environment:'development',expiresAt:expiry,operation:'organisation.create',policyId:'33333333-3333-4333-8333-333333333333',policyVersion:'1',resourceId,schemaDigest:schema,sourceRef:'synthetic-onboarding-policy',transactionId:'123'}
 const state={applicationId:application.appId,environment:'development',policyVersion:'access-v1:1',transactionId:'123',products:[],usagePolicy:'ONBOARDING_POLICY',bootstrapPolicy:policy,
  access:{type:'BOOTSTRAP',actorId:userId,organisationId:null,status:'ACTIVE',version:'1',sourceRef:policy.sourceRef,expiresAt:expiry,permissions:[{operation:'organisation.create',feature:'organisation_admin',resourceId}],denies:[]},
  resource:{id:resourceId,type:'organisation',dataClass:'ORGANISATION_PRIVATE',environment:'development',ownerOrganisationId:null,ownerUserId:null,version:'1',projectionVersion:'bootstrap-v1'}}
 const input={contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'organisation.create',resourceId,organisationId:null,idempotencyKey:commandId,payload:{commandId,draftVersion:'1'},request:new Request('https://isolated.test',{headers:{authorization:'Bearer '+issuer.issue(userId)}})}
 const events=[],effects=[];let called=0,failOutcome=false
 const options={application,organisationBootstrapSchemaDigest:schema,now:()=>time,authenticate:issuer.authenticate,recordAudit:async e=>events.push(e),
  withTransaction:async(_binding,run)=>{const pending=[];const value=await run({state,transaction:pending,transactionalEffects:true,outputBoundaryVersion:'bootstrap-v1',projectOutput:v=>v,recordOutcome:async e=>{if(failOutcome)throw Error('synthetic audit outage');events.push(e)}});effects.push(...pending);return value}}
 return {application,options,input,state,events,effects,policy,get called(){return called},set failOutcome(v){failOutcome=v},
  execute:()=>createOperationExecutor(options).execute(input,async(context,tx)=>{called++;assert.equal(context.organisationId,null);assert.equal(context.mode,'BOOTSTRAP');tx.push('one scoped creation');return {status:'CREATED'}})}
}
test('optional Root21 uses an explicit bootstrap policy without a borrowed tenant or product grant',async()=>{
 const f=fixture();const executor=createOperationExecutor(f.options);assert.deepEqual(executor.contract,ORGANISATION_BOOTSTRAP_ROOT_CONTRACT)
 assert.equal((await f.execute()).value.status,'CREATED');assert.deepEqual(f.effects,['one scoped creation']);assert.deepEqual(f.events.map(e=>e.phase),['INTENT','OUTCOME'])
 assert.equal(f.events[0].implementationVersion,'1.0.0-candidate.21');assert.equal(f.events[0].organisationId,null)
})
test('default Root and other optional hosts do not acquire organisation creation',()=>{
 const f=fixture();delete f.options.organisationBootstrapSchemaDigest
 assert.throws(()=>createOperationExecutor(f.options),TypeError)
 for(const option of ['assistantSchemaDigest','requestQuotaSchemaDigest','locationAdmissionSchemaDigest','reportAdmissionSchemaDigest']){const g=fixture();g.options[option]='b'.repeat(64);assert.throws(()=>createOperationExecutor(g.options),TypeError)}
})
test('bootstrap deployment is a closed Development SaaS application, not mixed private/product work',()=>{
 for(const patch of [{environment:'production'},{environment:'staging'},{profileId:'PORR_SUITE',organisationId:'borrowed'},{profileId:'PLATFORM_INTERNAL'},{organisationId:'borrowed'},{operations:['organisation.create','account.settings.write']},{features:['organisation_admin','account']}]){const f=fixture();Object.assign(f.application,patch);assert.throws(()=>createOperationExecutor(f.options),TypeError)}
})
const cases=[
 ['account permission is not organisation authority',f=>{f.state.access.type='ACCOUNT_SELF'},'CONTEXT_INVALID'],
 ['existing membership is not bootstrap authority',f=>{f.state.access.type='MEMBERSHIP'},'CONTEXT_INVALID'],
 ['client tenant is rejected',f=>{f.input.organisationId='borrowed'},'CONTEXT_INVALID'],
 ['wrong actor policy',f=>{f.policy.actorId='foreign'},'ACCESS_BASIS_INVALID'],
 ['wrong application policy',f=>{f.policy.applicationId='foreign'},'ACCESS_BASIS_INVALID'],
 ['wrong environment policy',f=>{f.policy.environment='production'},'ACCESS_BASIS_INVALID'],
 ['wrong schema',f=>{f.policy.schemaDigest='b'.repeat(64)},'ACCESS_BASIS_INVALID'],
 ['replayed transaction evidence',f=>{f.policy.transactionId='124'},'ACCESS_BASIS_INVALID'],
 ['expired policy',f=>{f.policy.expiresAt=new Date(time).toISOString()},'ACCESS_BASIS_INVALID'],
 ['unbounded policy',f=>{f.policy.expiresAt=new Date(time+60000).toISOString()},'ACCESS_BASIS_INVALID'],
 ['foreign operation policy',f=>{f.policy.operation='account.settings.write'},'ACCESS_BASIS_INVALID'],
 ['foreign resource',f=>{f.policy.resourceId='foreign'},'ACCESS_BASIS_INVALID'],
 ['different command',f=>{f.policy.commandId='44444444-4444-4444-8444-444444444444'},'ACCESS_BASIS_INVALID'],
 ['missing permission',f=>{f.state.access.permissions=[]},'ACCESS_BASIS_INVALID'],
 ['explicit deny',f=>{f.state.access.denies=[...f.state.access.permissions]},'PERMISSION_DENIED'],
 ['borrowed product grant',f=>{f.state.products=[{product:'SPENDGURU'}]},'ACCESS_BASIS_INVALID'],
 ['existing tenant resource',f=>{f.state.resource.ownerOrganisationId='borrowed'},'RESOURCE_SCOPE_MISMATCH'],
 ['existing personal resource',f=>{f.state.resource.ownerUserId='foreign'},'RESOURCE_SCOPE_MISMATCH'],
 ['unknown policy use',f=>{f.state.usagePolicy='NOT_APPLICABLE'},'LIMIT_POLICY_UNAVAILABLE'],
 ['HTTP supplied authority fields',f=>{f.input.payload.organisationId='borrowed'},'CONTEXT_INVALID'],
 ['different retry key',f=>{f.input.idempotencyKey='different-key-444444444444'},'ACCESS_BASIS_INVALID'],
]
for(const[name,mutate,code]of cases)test(name,async()=>{const f=fixture();mutate(f);await assert.rejects(f.execute(),e=>e.reasonCode===code);assert.equal(f.called,0);assert.deepEqual(f.effects,[])})
test('bootstrap output is withheld and the effect rolled back if its required audit fails',async()=>{const f=fixture();f.failOutcome=true;await assert.rejects(f.execute(),e=>e.reasonCode==='AUDIT_UNAVAILABLE');assert.equal(f.called,1);assert.deepEqual(f.effects,[]);assert.deepEqual(f.events.map(e=>e.phase),['INTENT','FAILURE'])})
