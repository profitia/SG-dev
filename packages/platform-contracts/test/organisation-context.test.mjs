import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {randomUUID} from 'node:crypto'
import {postgresFixture,clerkFixture} from './fixtures/identity-profile-postgres.mjs'
import {createIdentityProvisioner} from '../src/identity-provisioning.mjs'
import {createClerkIdentityAuthenticator} from '../src/identity-provider.mjs'
import {createOrganisationContextReader,organisationContextSchemaDigest} from '../src/organisation-context.mjs'
import {OPERATION_CONTRACT} from '../src/operation-context.mjs'

test('current organisation reader uses genuine own-account Root and never deployment tenant authority',{timeout:60000},async t=>{
 const db=await postgresFixture();t.after(()=>db.close())
 for(const name of ['007-organisation-onboarding.sql','008-organisation-create.sql','009-organisation-lifecycle.sql','011-application-organisation-context.sql'])
  await db.admin.query(fs.readFileSync(new URL('../migrations/profile/'+name,import.meta.url),'utf8'))
 await db.admin.query('INSERT INTO profitia_profile.organisation_context_installation VALUES(true,$1)',[organisationContextSchemaDigest()])
 const actor=clerkFixture('user_current_org'),foreign=clerkFixture('user_foreign_org')
 const options=db.options(actor),{userId}=await createIdentityProvisioner(options).ensureAccount(actor.request('POST'))
 const other=await createIdentityProvisioner(db.options(foreign)).ensureAccount(foreign.request('POST'))
 const [a,b,c,legacy]=[randomUUID(),randomUUID(),randomUUID(),randomUUID()]
 for(const id of [a,b,c,legacy])await db.admin.query("INSERT INTO profitia_access.organisations VALUES($1,'ACTIVE')",[id])
 for(const [id,uid]of [[a,userId],[b,userId],[c,other.userId],[legacy,userId]])
  await db.admin.query("INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at) VALUES($1,$2,'ACTIVE','synthetic-context',clock_timestamp()+interval '1 hour')",[id,uid])
 for(const [id,nip,uid]of [[a,'1234563218',userId],[b,'5260250274',userId],[c,'5252248481',other.userId]])
  await db.admin.query("INSERT INTO profitia_profile.organisation_profiles(organisation_id,country,nip,slug,company,registry_ref,registry_version,industry,team_range,created_by) VALUES($1,'PL',$2,$3,'{}','synthetic','v1','{}','{}',$4)",[id,nip,'synthetic-'+id,uid])
 await db.admin.query("INSERT INTO profitia_profile.organisation_context_policies(login_role,application_id,enabled,policy_id,source_ref,expires_at,legacy_default_organisation_id) VALUES('identity_b1_runtime',$1,false,$2,'synthetic-context-policy',clock_timestamp()+interval '1 hour',$3)",[db.binding.applicationId,randomUUID(),legacy])
 await db.admin.query('GRANT EXECUTE ON FUNCTION profitia_profile.organisation_context_descriptor(),profitia_profile.read_current_organisation_context(uuid) TO identity_b1_runtime')
 const config={...options,schemaDigest:organisationContextSchemaDigest(),application:{...options.application,operations:['account.settings.read']},
  createAuthenticator:({resolveBinding})=>createClerkIdentityAuthenticator({client:actor.client,application:options.identityApplication,resolveBinding})}
 const reader=createOrganisationContextReader(config)
 await t.test('requires explicit installed enabled role policy and unchanged account Root16',async()=>{
  assert.equal(OPERATION_CONTRACT.implementation,'1.0.0-candidate.16')
  await assert.rejects(reader.ready());await assert.rejects(reader.read(actor.request('GET')))
  for(const change of [{schemaDigest:'0'.repeat(64)},{application:{...config.application,organisationId:a}},{application:{...config.application,operations:['benchmark.selection.read']}}])
   assert.throws(()=>createOrganisationContextReader({...config,...change}))
 })
 await db.admin.query('UPDATE profitia_profile.organisation_context_policies SET enabled=true')
 await t.test('current own preference wins; only three bounded output fields and no business writes',async()=>{
  await db.admin.query('INSERT INTO profitia_profile.organisation_user_context VALUES($1,$2)',[userId,a])
  const before=(await db.admin.query('SELECT count(*)::int AS n FROM profitia_access.product_grants')).rows[0].n
  await reader.ready();const r=await reader.read(actor.request('POST'))
  assert.deepEqual(Object.keys(r).sort(),['expiresAt','organisationId','userId']);assert.equal(r.userId,userId);assert.equal(r.organisationId,a)
  assert(Date.parse(r.expiresAt)>Date.now());assert(Date.parse(r.expiresAt)<=Date.now()+30000)
  assert.equal((await db.admin.query('SELECT count(*)::int AS n FROM profitia_access.product_grants')).rows[0].n,before)
 })
 await t.test('expired membership and foreign preference cannot select stale or another user organisation',async()=>{
  await db.admin.query("UPDATE profitia_access.memberships SET expires_at=clock_timestamp()-interval '1 second' WHERE organisation_id=$1",[a])
  assert.equal((await reader.read(actor.request('GET'))).organisationId,b)
  await db.admin.query('UPDATE profitia_profile.organisation_user_context SET organisation_id=$1 WHERE user_id=$2',[c,userId])
  assert.equal((await reader.read(actor.request('GET'))).organisationId,b)
 })
 await t.test('explicit legacy fallback requires own active membership and never defaults to foreign tenant',async()=>{
  await db.admin.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE user_id=$1 AND organisation_id IN($2,$3)",[userId,a,b])
  assert.equal((await reader.read(actor.request('GET'))).organisationId,legacy)
  await db.admin.query('UPDATE profitia_profile.organisation_context_policies SET legacy_default_organisation_id=$1',[c])
  assert.equal((await reader.read(actor.request('GET'))).organisationId,null)
  await db.admin.query('UPDATE profitia_profile.organisation_context_policies SET legacy_default_organisation_id=NULL')
  assert.equal((await reader.read(actor.request('GET'))).organisationId,null)
 })
 await t.test('ordinary raw, forged scope and revoked official account fail closed',async()=>{
  for(const q of ['SELECT * FROM profitia_profile.organisation_context_policies','SELECT profitia_profile.read_current_organisation_context(gen_random_uuid())'])
   await assert.rejects(db.pool.query(q))
  actor.active=false;await assert.rejects(reader.read(actor.request('GET')));actor.active=true
  await db.admin.query('UPDATE profitia_profile.organisation_context_policies SET enabled=false')
  await assert.rejects(reader.read(actor.request('GET')))
 })
})
