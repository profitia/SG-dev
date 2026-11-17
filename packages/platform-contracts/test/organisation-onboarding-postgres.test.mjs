import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {randomUUID} from 'node:crypto'
import {postgresFixture,clerkFixture} from './fixtures/identity-profile-postgres.mjs'
import {createIdentityProvisioner} from '../src/identity-provisioning.mjs'
import {createOrganisationOnboardingDraftBackend,organisationOnboardingSchemaDigest} from '../src/organisation-profile.mjs'
test('onboarding draft: real PostgreSQL self-scope, optimistic concurrency, durability and audit rollback',{timeout:60000},async t=>{
 const f=await postgresFixture();t.after(()=>f.close())
 await f.admin.query(fs.readFileSync(new URL('../migrations/profile/007-organisation-onboarding.sql',import.meta.url),'utf8'))
 await f.admin.query("INSERT INTO profitia_profile.organisation_onboarding_installation VALUES(true,'1.0.0',$1)",[organisationOnboardingSchemaDigest()])
 await f.admin.query("INSERT INTO profitia_profile.organisation_onboarding_policies VALUES('identity_b1_runtime',false)")
 await f.admin.query('GRANT EXECUTE ON FUNCTION profitia_profile.organisation_onboarding_descriptor(),profitia_profile.organisation_onboarding_read(),profitia_profile.organisation_onboarding_save(bigint,jsonb) TO identity_b1_runtime')
 const a=clerkFixture('user_onboarding_a'),b=clerkFixture('user_onboarding_b')
 const apiA=createOrganisationOnboardingDraftBackend(f.options(a)),apiB=createOrganisationOnboardingDraftBackend(f.options(b))
 await assert.rejects(apiA.ready())
 await f.admin.query('UPDATE profitia_profile.organisation_onboarding_policies SET enabled=true')
 await apiA.ready()
 const alice=await createIdentityProvisioner(f.options(a)).ensureAccount(a.request('POST'))
 const bob=await createIdentityProvisioner(f.options(b)).ensureAccount(b.request('POST'))
 assert.notEqual(alice.userId,bob.userId)
 await t.test('empty read is account-owned, read-only and never creates a tenant',async()=>{
  assert.deepEqual(await apiA.readCurrentDraft(a.request('GET')),{userId:alice.userId,version:'0',answers:{}})
  assert.equal((await f.admin.query('SELECT count(*) FROM profitia_profile.organisation_onboarding_drafts')).rows[0].count,'0')
  assert.equal((await f.admin.query('SELECT count(*) FROM profitia_access.organisations')).rows[0].count,'0')
 })
 await t.test('two first writes cannot overwrite one another; abandoned save can be reconciled by read',async()=>{
  const input={expectedVersion:'0',patch:{nip:'PL123-456-32-18'}}
  const attempts=await Promise.allSettled([apiA.saveCurrentDraft(a.request('POST'),input),apiA.saveCurrentDraft(a.request('POST'),input)])
  assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1)
  assert.equal(attempts.filter(r=>r.status==='rejected'&&r.reason.code==='PROFILE_VERSION_CONFLICT').length,1)
  assert.deepEqual((await apiA.readCurrentDraft(a.request('GET'))).answers,{nip:'1234563218',companySelection:null})
  assert.equal((await apiB.readCurrentDraft(b.request('GET'))).version,'0')
 })
 await t.test('each accepted answer resumes with its version; server-derived fields and ownership cannot be injected',async()=>{
  const saved=await apiA.saveCurrentDraft(a.request('POST'),{expectedVersion:'1',patch:{slug:'porr',industry:{id:'construction'},categories:[{catalogueId:'construction.asphalt'},{customName:'Odnawialna energia'}],teamRange:'6-10'}})
  assert.equal(saved.version,'2');assert.equal(saved.answers.industry.label,'Budownictwo');assert.equal(saved.answers.categories.length,2);assert.equal(saved.answers.teamRange.minimum,6)
  const resumed=await createOrganisationOnboardingDraftBackend(f.options(a)).readCurrentDraft(a.request('GET'));assert.deepEqual(resumed,saved)
  await assert.rejects(apiA.saveCurrentDraft(a.request('POST'),{expectedVersion:'1',patch:{slug:'stale-change'}}),{code:'PROFILE_VERSION_CONFLICT'})
  for(const key of ['organisationId','userId','memberRole','productGrant','company','legalName'])
   await assert.rejects(apiA.saveCurrentDraft(a.request('POST'),{expectedVersion:'2',patch:{[key]:key==='userId'?bob.userId:'attacker'}}),{code:'INVALID_ONBOARDING_DRAFT'})
  assert.equal((await f.admin.query('SELECT count(*) FROM profitia_access.memberships')).rows[0].count,'0')
  assert.equal((await f.admin.query('SELECT count(*) FROM profitia_access.permission_grants')).rows[0].count,'0')
  assert.equal((await f.admin.query('SELECT count(*) FROM profitia_access.product_grants')).rows[0].count,'0')
 })
 await t.test('ordinary SQL credentials and invented context cannot read/modify a draft without the verified backend attestation',async()=>{
  await assert.rejects(f.pool.query("SELECT * FROM profitia_profile.organisation_onboarding_drafts"))
  await assert.rejects(f.pool.query('SELECT profitia_profile.organisation_onboarding_read()'))
  const c=await f.pool.connect()
  try{await c.query('BEGIN');await c.query("SELECT set_config('profitia.user_id',$1,true),set_config('profitia.profile.operation','account.settings.write',true),set_config('profitia.profile.signature',$2,true)",[bob.userId,'0'.repeat(64)]);await assert.rejects(c.query("SELECT profitia_profile.organisation_onboarding_save(0,'{\"slug\":\"victim\"}')"));await c.query('ROLLBACK')}finally{c.release()}
  assert.equal((await apiB.readCurrentDraft(b.request('GET'))).version,'0')
 })
 await t.test('an audit failure rolls back the saved answer and version',async()=>{
  await f.admin.query("CREATE FUNCTION profitia_profile.onboarding_test_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.phase='OUTCOME' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$")
  await f.admin.query('CREATE TRIGGER onboarding_test_audit_failure BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION profitia_profile.onboarding_test_audit_failure()')
  await assert.rejects(apiA.saveCurrentDraft(a.request('POST'),{expectedVersion:'2',patch:{slug:'rollback-check'}}))
  await f.admin.query('DROP TRIGGER onboarding_test_audit_failure ON profitia_access.security_events;DROP FUNCTION profitia_profile.onboarding_test_audit_failure()')
  const actual=await apiA.readCurrentDraft(a.request('GET'));assert.equal(actual.version,'2');assert.equal(actual.answers.slug,'porr')
  const audit=(await f.admin.query("SELECT event FROM profitia_access.security_events WHERE event->>'resourceId'='current-organisation-onboarding'")).rows
  assert(audit.length>0);assert(!JSON.stringify(audit).includes('1234563218'));assert(!JSON.stringify(audit).includes('Odnawialna energia'))
 })
 await t.test('changing the company identity clears dependent answers; re-entering the same NIP preserves preferences',async()=>{
  const before=await apiA.readCurrentDraft(a.request('GET'))
  const selected=await apiA.saveCurrentDraft(a.request('POST'),{expectedVersion:before.version,patch:{companySelection:{sourceRef:'synthetic-registry',version:'snapshot-1'}}})
  const same=await apiA.saveCurrentDraft(a.request('POST'),{expectedVersion:selected.version,patch:{nip:'PL123 456 32 18'}})
  assert.equal(same.answers.slug,'porr');assert.equal(same.answers.industry.id,'construction')
  assert.equal(same.answers.categories.length,2);assert.equal(same.answers.teamRange.id,'6-10')
  const changed=await apiA.saveCurrentDraft(a.request('POST'),{expectedVersion:same.version,patch:{nip:'5261040828'}})
  assert.deepEqual(changed.answers,{nip:'5261040828',companySelection:null})
  assert.deepEqual((await apiA.readCurrentDraft(a.request('GET'))).answers,changed.answers)
  assert.equal((await f.admin.query('SELECT count(*) FROM profitia_access.organisations')).rows[0].count,'0')
 })
 await t.test('revoked identity and disabled runtime policy both fail closed',async()=>{
  a.active=false;await assert.rejects(apiA.readCurrentDraft(a.request('GET')));a.active=true
  await f.admin.query('UPDATE profitia_profile.organisation_onboarding_policies SET enabled=false')
  await assert.rejects(apiA.readCurrentDraft(a.request('GET')))
 })
})
