import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {randomUUID} from 'node:crypto'
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
 await db.admin.query('UPDATE profitia_profile.organisation_lifecycle_policies SET enabled=false')
 await assert.rejects(backend.execute(actor.request('GET'),'organisation.onboarding.read',{},async()=>{effectCalls++;return {}}));assert.equal(effectCalls,1)
})
