import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {randomUUID,randomBytes} from 'node:crypto'
import {createPeerOperationSigner,createPeerOperationVerifier} from '../src/peer-operation.mjs'
import {postgresFixture,clerkFixture} from './fixtures/identity-profile-postgres.mjs'
import {createIdentityProvisioner} from '../src/identity-provisioning.mjs'
import {createOrganisationLifecycleBackend,organisationLifecycleSchemaDigest} from '../src/organisation-lifecycle.mjs'
import {ORGANISATION_LIFECYCLE_OPERATIONS} from '../src/operation-context.mjs'
import {organisationOnboardingSchemaDigest} from '../src/organisation-profile.mjs'
import {organisationBootstrapSchemaDigest} from '../src/organisation-bootstrap.mjs'
test('real PostgreSQL lifecycle requires installed policy, actual Root intent and own verified account',{timeout:60000},async t=>{
 const db=await postgresFixture();t.after(()=>db.close())
 for(const file of ['007-organisation-onboarding.sql','008-organisation-create.sql','009-organisation-lifecycle.sql'])await db.admin.query(fs.readFileSync(new URL('../migrations/profile/'+file,import.meta.url),'utf8'))
 await db.admin.query("INSERT INTO profitia_profile.organisation_onboarding_installation VALUES(true,'1.0.0',$1)",[organisationOnboardingSchemaDigest()])
 await db.admin.query("INSERT INTO profitia_profile.organisation_bootstrap_installation VALUES(true,'1.0.0',$1)",[organisationBootstrapSchemaDigest()])
 await db.admin.query("INSERT INTO profitia_profile.organisation_lifecycle_installation VALUES(true,'1.0.0',$1)",[organisationLifecycleSchemaDigest()])
 await db.admin.query("INSERT INTO profitia_profile.organisation_lifecycle_policies(login_role,policy_id,source_ref,expires_at,membership_expires_at,operations) VALUES('identity_b1_runtime',$1,'test-lifecycle-policy',clock_timestamp()+interval '1 hour',clock_timestamp()+interval '1 day',$2::jsonb)",[randomUUID(),JSON.stringify(ORGANISATION_LIFECYCLE_OPERATIONS)])
 await db.admin.query('GRANT EXECUTE ON FUNCTION profitia_profile.organisation_lifecycle_descriptor(),profitia_profile.organisation_lifecycle_lock(),profitia_profile.organisation_lifecycle_context(bigint,text),profitia_profile.organisation_lifecycle_admit(text,text,text,uuid,bigint,text),profitia_profile.organisation_lifecycle_require(text,uuid),profitia_profile.organisation_lifecycle_slug(text,uuid),profitia_profile.organisation_lifecycle_company(text,uuid),profitia_profile.organisation_lifecycle_categories(bigint,jsonb,uuid) TO identity_b1_runtime')
 const actor=clerkFixture('user_lifecycle_current'),options=db.options(actor)
 await createIdentityProvisioner(options).ensureAccount(actor.request('POST'))
 const backend=createOrganisationLifecycleBackend({...options,application:{...options.application,profileId:'SPENDGURU_SAAS',organisationId:null,features:['organisation_admin'],operations:[...ORGANISATION_LIFECYCLE_OPERATIONS]}})
 await assert.rejects(backend.ready());await db.admin.query('UPDATE profitia_profile.organisation_lifecycle_policies SET enabled=true');await backend.ready()
 let effectCalls=0
 const value=await backend.execute(actor.request('GET'),'organisation.onboarding.read',{},async({context,query,profile})=>{
  effectCalls++;assert.equal(context.implementationVersion,'1.0.0-candidate.23');assert.equal(context.organisationId,null);assert.equal(profile.userId,context.actorId)
  const result=await query('SELECT profitia_profile.organisation_lifecycle_require($1,$2::uuid) AS user_id',[context.operation,context.decisionId]);assert.equal(result.rows[0].user_id,context.actorId)
  return {userId:profile.userId,organisation:profile.organisation}
 })
 assert.equal(effectCalls,1);assert.equal(value.organisation,null)
 for(const slug of ['test-company','other-company']){
  const available=await backend.execute(actor.request('POST'),'organisation.slug.check',{slug},async({context,query})=>{
   assert.equal(context.mode,'BOOTSTRAP');assert.equal(context.organisationId,null)
   return(await query('SELECT profitia_profile.organisation_lifecycle_slug($1,$2::uuid) AS available',[slug,context.decisionId])).rows[0].available
  });assert.equal(available,true)
 }
 for(const sql of ['SELECT * FROM profitia_profile.organisation_profiles','SELECT * FROM profitia_profile.organisation_invitations',"SELECT profitia_profile.organisation_lifecycle_context(1,'forged')","SELECT profitia_profile.organisation_lifecycle_slug('test-company',gen_random_uuid())"])await assert.rejects(db.pool.query(sql))
 // A receiver may enrol a smaller explicit purpose; it cannot inherit the other lifecycle operations.
 const narrow=createOrganisationLifecycleBackend({...options,application:{...options.application,profileId:'SPENDGURU_SAAS',organisationId:null,features:['organisation_admin'],operations:['organisation.onboarding.read']}})
 await db.admin.query('UPDATE profitia_profile.organisation_lifecycle_policies SET operations=$1::jsonb',[JSON.stringify(['organisation.onboarding.read'])])
 await narrow.ready();await assert.rejects(backend.ready())
 assert.equal((await narrow.execute(actor.request('GET'),'organisation.onboarding.read',{},async({profile})=>({userId:profile.userId}))).userId,value.userId)
 let extra=false
 await assert.rejects(narrow.execute(actor.request('POST'),'organisation.slug.check',{slug:'unused-purpose'},async()=>{extra=true}),e=>e.reasonCode==='PERMISSION_DENIED');assert.equal(extra,false)
 // Reuse the existing signed peer only for official identity input; Root still receives the real target Request.
 const peer={environment:'development',callerApplicationId:'identity-runtime-development',receiverApplicationId:options.application.appId,
  sourceOrigin:'https://identity.example.test',targetOrigin:'https://registry.example.test',keyId:'registration-peer-v1',key:randomBytes(32),
  routes:[{method:'GET',path:'/v1/organisation-access',maximumRequestBytes:0,requireIdempotencyKey:false}],internalOrigins:[]}
 if(peer.receiverApplicationId===peer.callerApplicationId)peer.callerApplicationId='registration-client'
 actor.origin=peer.sourceOrigin
 const peerBackend=createOrganisationLifecycleBackend({...options,identityApplication:{...options.identityApplication,authorizedParties:[peer.sourceOrigin]},
  application:{...options.application,profileId:'SPENDGURU_SAAS',organisationId:null,features:['organisation_admin'],operations:['organisation.onboarding.read']}})
 const incoming=new Request(peer.targetOrigin+'/v1/organisation-access',{headers:{authorization:'Bearer synthetic-peer-bearer'}})
 let peerEffect=false
 await assert.rejects(peerBackend.execute(incoming,'organisation.onboarding.read',{},async()=>{peerEffect=true}));assert.equal(peerEffect,false)
 const signed=await createPeerOperationSigner(peer)(incoming);assert.equal(await createPeerOperationVerifier(peer)(signed),true)
 assert.equal((await peerBackend.execute(signed,'organisation.onboarding.read',{},async({profile})=>({userId:profile.userId}))).userId,value.userId)
 const copied=new Request(signed);await assert.rejects(peerBackend.execute(copied,'organisation.onboarding.read',{},async()=>{peerEffect=true}));assert.equal(peerEffect,false)
 actor.origin='http://localhost:3600'
 for(const operations of [[],['organisation.onboarding.read','organisation.onboarding.read'],['organisation.create']]){
  await db.admin.query('UPDATE profitia_profile.organisation_lifecycle_policies SET operations=$1::jsonb',[JSON.stringify(operations)])
  await assert.rejects(narrow.ready())
 }
 await db.admin.query('UPDATE profitia_profile.organisation_lifecycle_policies SET enabled=false')
 await assert.rejects(backend.execute(actor.request('GET'),'organisation.onboarding.read',{},async()=>{effectCalls++;return {}}));assert.equal(effectCalls,1)
})
