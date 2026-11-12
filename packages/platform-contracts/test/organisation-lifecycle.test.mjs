import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes,randomUUID} from 'node:crypto'
import {createOperationExecutor,OPERATION_CONTRACT,ORGANISATION_LIFECYCLE_ROOT_CONTRACT,ORGANISATION_LIFECYCLE_OPERATIONS,operationPayloadDigest} from '../src/operation-context.mjs'
import {normalizeOrganisationLifecycleInput,organisationEmailKey,sealOrganisationInvitation,openOrganisationInvitation} from '../src/organisation-lifecycle.mjs'
test('lifecycle23 is explicit; default16 and bootstrap21 gain no operations',()=>{
 assert.equal(OPERATION_CONTRACT.implementation,'1.0.0-candidate.16');assert.equal(ORGANISATION_LIFECYCLE_ROOT_CONTRACT.implementation,'1.0.0-candidate.23')
 const application={appId:'identity',profileId:'SPENDGURU_SAAS',environment:'development',organisationId:null,features:['organisation_admin'],operations:[...ORGANISATION_LIFECYCLE_OPERATIONS],deploymentId:'test',configurationVersion:'test',identityIssuer:'https://test.example'}
 const base={application,authenticate:async()=>null,withTransaction:async()=>{},recordAudit:async()=>{}}
 assert.throws(()=>createOperationExecutor(base));assert.equal(createOperationExecutor({...base,organisationLifecycleSchemaDigest:'a'.repeat(64)}).contract.implementation,'1.0.0-candidate.23')
 for(const change of [{organisationLifecycleSchemaDigest:'bad'},{organisationLifecycleSchemaDigest:'a'.repeat(64),organisationBootstrapSchemaDigest:'b'.repeat(64)},{application:{...application,environment:'production'},organisationLifecycleSchemaDigest:'a'.repeat(64)},{application:{...application,operations:['organisation.create']},organisationLifecycleSchemaDigest:'a'.repeat(64)}])assert.throws(()=>createOperationExecutor({...base,...change}))
})
test('current-account inputs reject client organisation and user IDs, accessors and excessive invitations',()=>{
 for(const operation of ORGANISATION_LIFECYCLE_OPERATIONS)for(const key of ['organisationId','userId','role','products'])assert.throws(()=>normalizeOrganisationLifecycleInput(operation,{[key]:randomUUID()}))
 let invoked=false;assert.throws(()=>normalizeOrganisationLifecycleInput('organisation.slug.check',{get slug(){invoked=true;return 'company'}}));assert.equal(invoked,false)
 assert.deepEqual(normalizeOrganisationLifecycleInput('organisation.company.lookup',{nip:'PL 123-456-32-18',draftVersion:'1'}),{nip:'1234563218',draftVersion:'1'})
 assert.throws(()=>normalizeOrganisationLifecycleInput('organisation.company.lookup',{nip:'12345678',draftVersion:'1'}))
 assert.throws(()=>normalizeOrganisationLifecycleInput('organisation.invitation.create',{commandId:randomUUID(),emails:Array(21).fill('a@example.test')}))
 const commandId=randomUUID();assert.deepEqual(normalizeOrganisationLifecycleInput('organisation.invitation.create',{commandId,emails:['A@Example.test','bad','A@Example.test']}).emails,['a@example.test',null,'a@example.test'])
})
test('invitation encryption binds exact key ID and invitation; no raw email/proof persists',()=>{
 const key=randomBytes(32),keyId='invitation-v1',invitationId=randomUUID(),payload={recipient:'member@example.test',token:'sgi1_'+randomBytes(32).toString('base64url')}
 const envelope=sealOrganisationInvitation(payload,{key,keyId,invitationId}),serialized=JSON.stringify(envelope)
 assert(!serialized.includes(payload.recipient));assert(!serialized.includes(payload.token));assert.deepEqual(openOrganisationInvitation(envelope,{key,keyId,invitationId}),payload)
 for(const change of [{key:randomBytes(32)},{keyId:'another-key'},{invitationId:randomUUID()}])assert.throws(()=>openOrganisationInvitation(envelope,{key,keyId,invitationId,...change}))
 for(const field of ['iv','tag','ciphertext'])assert.throws(()=>openOrganisationInvitation({...envelope,[field]:(envelope[field][0]==='0'?'1':'0')+envelope[field].slice(1)},{key,keyId,invitationId}))
 assert.notDeepEqual(sealOrganisationInvitation(payload,{key,keyId,invitationId}),envelope)
})
test('email index is private, domain separated and stable only under the exact key',()=>{
 const key=randomBytes(32);assert.equal(organisationEmailKey('Member@EXAMPLE.TEST',key),organisationEmailKey('member@example.test',key))
 assert.notEqual(organisationEmailKey('member@example.test',key),organisationEmailKey('member@example.test',randomBytes(32)))
 assert.throws(()=>organisationEmailKey('bad',key));assert.throws(()=>organisationEmailKey('a@example.test',new Uint8Array(31)))
})
test('Root requires lifecycle policy to bind exact actor, tenant, input, resource and transaction',async()=>{
 const now=Date.now(),uid=randomUUID(),policyId=randomUUID(),digest='a'.repeat(64),operation='organisation.onboarding.read',resourceId='current-organisation-onboarding-read'
 const actor={kind:'HUMAN',actorId:uid,userId:uid,proofRef:'verified-test',issuer:'https://test.example',audience:'identity',environment:'development',expiresAt:new Date(now+60000).toISOString()}
 const application={appId:'identity',profileId:'SPENDGURU_SAAS',environment:'development',organisationId:null,features:['organisation_admin'],operations:[operation],deploymentId:'test',configurationVersion:'test',identityIssuer:actor.issuer}
 const policy={actorId:uid,applicationId:'identity',environment:'development',expiresAt:new Date(now+29000).toISOString(),operation,organisationId:null,payloadDigest:operationPayloadDigest({}),policyId,policyVersion:'1',resourceId,schemaDigest:digest,sourceRef:'test-policy',transactionId:'1'}
 const state={applicationId:'identity',environment:'development',policyVersion:'access-v1:1',transactionId:'1',lifecyclePolicy:policy,
  access:{type:'ACCOUNT_SELF',actorId:uid,organisationId:null,status:'ACTIVE',version:'1',sourceRef:'test-policy',expiresAt:policy.expiresAt,permissions:[{operation,feature:'organisation_admin',resourceId}],denies:[]},
  resource:{id:resourceId,type:'organisation_onboarding',dataClass:'ACCOUNT_PRIVATE',environment:'development',ownerOrganisationId:null,ownerUserId:uid,version:'1',projectionVersion:'test'},products:[],usagePolicy:'NOT_APPLICABLE'}
 const run=async change=>{let called=false;const current=structuredClone(state);change?.(current)
  const executor=createOperationExecutor({application,organisationLifecycleSchemaDigest:digest,now:()=>now,authenticate:async()=>actor,recordAudit:async()=>{},
   withTransaction:async(_input,fn)=>fn({state:current,transaction:{},transactionalEffects:true,outputBoundaryVersion:'test',projectOutput:v=>v,recordOutcome:async()=>{}})})
  const promise=executor.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation,resourceId,organisationId:null,payload:{},request:{}},async()=>{called=true;return {ok:true}})
  return {promise,called:()=>called}}
 const valid=await run();assert.deepEqual((await valid.promise).value,{ok:true});assert(valid.called())
 for(const field of ['actorId','organisationId','payloadDigest','resourceId','transactionId','schemaDigest','applicationId','environment','operation','expiresAt']){
  const rejected=await run(s=>{s.lifecyclePolicy[field]=field==='organisationId'?randomUUID():'altered'})
  await assert.rejects(rejected.promise);assert.equal(rejected.called(),false)
 }
 const missing=await run(s=>{delete s.lifecyclePolicy});await assert.rejects(missing.promise);assert.equal(missing.called(),false)
})
