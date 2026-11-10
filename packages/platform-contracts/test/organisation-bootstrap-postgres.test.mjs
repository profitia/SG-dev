import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {randomUUID} from 'node:crypto'
import {postgresFixture,clerkFixture} from './fixtures/identity-profile-postgres.mjs'
import {createIdentityProvisioner} from '../src/identity-provisioning.mjs'
import {createOrganisationOnboardingDraftBackend,organisationOnboardingSchemaDigest} from '../src/organisation-profile.mjs'
import {createOrganisationBootstrapBackend,organisationBootstrapSchemaDigest} from '../src/organisation-bootstrap.mjs'
const company=nip=>({entityType:'COMPANY',country:'PL',nip,krs:'0000123456',regon:'123456789',legalName:'Isolated fixture company S.A.',address:'ul. Przykładowa 1, Warszawa',postalCode:'00-001'})
test('organisation bootstrap: real PostgreSQL atomic creation, duplicate arbitration, replay, isolation and rollback',{timeout:60000},async t=>{
 const f=await postgresFixture();t.after(()=>f.close())
 for(const name of ['007-organisation-onboarding.sql','008-organisation-create.sql'])await f.admin.query(fs.readFileSync(new URL('../migrations/profile/'+name,import.meta.url),'utf8'))
 await f.admin.query("INSERT INTO profitia_profile.organisation_onboarding_installation VALUES(true,'1.0.0',$1)",[organisationOnboardingSchemaDigest()])
 await f.admin.query("INSERT INTO profitia_profile.organisation_onboarding_policies VALUES('identity_b1_runtime',true)")
 await f.admin.query("INSERT INTO profitia_profile.organisation_bootstrap_installation VALUES(true,'1.0.0',$1)",[organisationBootstrapSchemaDigest()])
 await f.admin.query("INSERT INTO profitia_profile.organisation_bootstrap_policies(login_role,policy_id,source_ref,expires_at,membership_expires_at,initial_permissions) VALUES('identity_b1_runtime',gen_random_uuid(),'synthetic-explicit-onboarding-policy',clock_timestamp()+interval '1 hour',clock_timestamp()+interval '1 day',$1::jsonb)",[JSON.stringify([{operation:'category.read',feature:'category'},{operation:'category.write',feature:'category'}])])
 await f.admin.query('GRANT EXECUTE ON FUNCTION profitia_profile.organisation_onboarding_descriptor(),profitia_profile.organisation_onboarding_read(),profitia_profile.organisation_onboarding_save(bigint,jsonb),profitia_profile.organisation_bootstrap_descriptor(),profitia_profile.organisation_bootstrap_lock(),profitia_profile.organisation_bootstrap_state(uuid,bigint,bigint,text),profitia_profile.organisation_bootstrap_create(text,bigint,text,uuid) TO identity_b1_runtime')
 const actors=['user_bootstrap_a','user_bootstrap_b','user_bootstrap_c','user_bootstrap_d'].map(s=>clerkFixture(s))
 const ids=[]
 for(const actor of actors)ids.push((await createIdentityProvisioner(f.options(actor)).ensureAccount(actor.request('POST'))).userId)
 const nips=['1234563218','1234563218','5261040828','5261040828'],slugs=['alpha-firma','second-firma','alpha-firma','fourth-firma']
 for(const[i,actor]of actors.entries())await createOrganisationOnboardingDraftBackend(f.options(actor)).saveCurrentDraft(actor.request('POST'),{expectedVersion:'0',patch:{nip:nips[i],slug:slugs[i],companySelection:{sourceRef:'synthetic-stored-registry',version:'synthetic-snapshot-1'},industry:{id:'construction'},categories:[{catalogueId:'construction.asphalt'},{customName:'Energia odnawialna'}],teamRange:'6-10'}})
 let registryReads=0
 const api=actors.map(actor=>createOrganisationBootstrapBackend({...f.options(actor),application:{...f.options(actor).application,features:['organisation_admin'],operations:['organisation.create']},
  readVerifiedCompany:async({nip,context})=>{registryReads++;assert.equal(context.mode,'BOOTSTRAP');assert.equal(context.organisationId,null);return{company:company(nip),sourceRef:'synthetic-stored-registry',version:'synthetic-snapshot-1'}}}))
 await t.test('activation is explicit and SQL credentials/forged context do not create a tenant',async()=>{
  await assert.rejects(api[0].ready())
  await assert.rejects(api[0].completeCurrentOrganisation(actors[0].request('POST'),{commandId:randomUUID(),draftVersion:'1'}))
  assert.equal((await f.admin.query('SELECT count(*) FROM profitia_access.organisations')).rows[0].count,'0')
  await assert.rejects(f.pool.query("SELECT * FROM profitia_profile.organisation_profiles"))
  await assert.rejects(f.pool.query("SELECT profitia_profile.organisation_bootstrap_create('{}',1,$1,gen_random_uuid())",['0'.repeat(64)]))
  await f.admin.query('UPDATE profitia_profile.organisation_bootstrap_policies SET enabled=true')
  await api[0].ready()
 })
 await t.test('changed registry data requires fresh confirmation and creates no organisation',async()=>{
  const changed=createOrganisationBootstrapBackend({...f.options(actors[0]),application:{...f.options(actors[0]).application,features:['organisation_admin'],operations:['organisation.create']},readVerifiedCompany:async({nip})=>({company:company(nip),sourceRef:'synthetic-stored-registry',version:'synthetic-snapshot-2'})})
  assert.deepEqual(await changed.completeCurrentOrganisation(actors[0].request('POST'),{commandId:randomUUID(),draftVersion:'1'}),{status:'COMPANY_CHANGED'})
  assert.equal((await f.admin.query('SELECT count(*) FROM profitia_access.organisations')).rows[0].count,'0')
 })
 const commands=actors.map(()=>({commandId:randomUUID(),draftVersion:'1'}))
 let created,winner
 await t.test('two users creating one NIP produce one organisation and no automatic membership for the other',async()=>{
  const r=await Promise.all([api[0].completeCurrentOrganisation(actors[0].request('POST'),commands[0]),api[1].completeCurrentOrganisation(actors[1].request('POST'),commands[1])])
  assert.deepEqual(r.map(x=>x.status).sort(),['CREATED','ORGANISATION_ALREADY_EXISTS'])
  winner=r.findIndex(x=>x.status==='CREATED');created=r[winner]
  assert.equal(created.activation,'PENDING_PACKAGE')
  assert.equal((await f.admin.query('SELECT count(*) FROM profitia_access.organisations')).rows[0].count,'1')
  const members=(await f.admin.query('SELECT user_id FROM profitia_access.memberships')).rows
  assert.deepEqual(members.map(m=>m.user_id),[ids[winner]])
  assert.equal((await f.admin.query('SELECT count(*) FROM profitia_profile.organisation_categories')).rows[0].count,'2')
  assert.equal((await f.admin.query('SELECT count(*) FROM profitia_profile.user_procurement_categories')).rows[0].count,'2')
  assert.equal((await f.admin.query("SELECT count(*) FROM profitia_profile.organisation_member_profiles WHERE role_label='OWNER'")).rows[0].count,'1')
  assert.equal((await f.admin.query('SELECT count(*) FROM profitia_access.permission_grants')).rows[0].count,'2')
  assert.equal((await f.admin.query('SELECT count(*) FROM profitia_access.product_grants')).rows[0].count,'0')
  for(const row of(await f.admin.query('SELECT organisation_id,user_id FROM profitia_access.permission_grants')).rows){assert.equal(row.organisation_id,created.organisationId);assert.equal(row.user_id,ids[winner])}
 })
 await t.test('committed retry returns its original receipt without re-reading sources or duplicating rows',async()=>{
  const before=registryReads
  const resumed=await createOrganisationBootstrapBackend({...f.options(actors[winner]),application:{...f.options(actors[winner]).application,features:['organisation_admin'],operations:['organisation.create']},readVerifiedCompany:async()=>{throw Error('Replay must not acquire a source')}})
   .completeCurrentOrganisation(actors[winner].request('POST'),commands[winner])
  assert.deepEqual(resumed,created);assert.equal(registryReads,before)
  await assert.rejects(api[winner].completeCurrentOrganisation(actors[winner].request('POST'),{...commands[winner],draftVersion:'2'}),e=>e.code==='PROFILE_VERSION_CONFLICT')
  assert.equal((await f.admin.query('SELECT count(*) FROM profitia_profile.organisation_bootstrap_commands')).rows[0].count,'1')
 })
 await t.test('occupied slug stays unavailable without leaking the tenant or creating partial rows',async()=>{
  const actualSlug=created.slug
  await createOrganisationOnboardingDraftBackend(f.options(actors[2])).saveCurrentDraft(actors[2].request('POST'),{expectedVersion:'1',patch:{slug:actualSlug}})
  const r=await api[2].completeCurrentOrganisation(actors[2].request('POST'),{...commands[2],draftVersion:'2'})
  assert.deepEqual(r,{status:'SLUG_UNAVAILABLE'})
  assert.equal((await f.admin.query('SELECT count(*) FROM profitia_access.organisations')).rows[0].count,'1')
 })
 await t.test('an OUTCOME outage rolls back organisation, profile, categories, membership, grants and completion receipt',async()=>{
  await f.admin.query("CREATE FUNCTION profitia_profile.bootstrap_test_outage() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.phase='OUTCOME' AND NEW.event->>'operation'='organisation.create' THEN RAISE EXCEPTION 'synthetic audit outage';END IF;RETURN NEW;END $$")
  await f.admin.query('CREATE TRIGGER bootstrap_test_outage BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION profitia_profile.bootstrap_test_outage()')
  await assert.rejects(api[3].completeCurrentOrganisation(actors[3].request('POST'),commands[3]),e=>e.reasonCode==='AUDIT_UNAVAILABLE')
  await f.admin.query('DROP TRIGGER bootstrap_test_outage ON profitia_access.security_events;DROP FUNCTION profitia_profile.bootstrap_test_outage()')
  assert.equal((await f.admin.query('SELECT count(*) FROM profitia_access.organisations')).rows[0].count,'1')
  assert.equal((await f.admin.query('SELECT count(*) FROM profitia_access.memberships')).rows[0].count,'1')
  assert.equal((await f.admin.query('SELECT count(*) FROM profitia_profile.organisation_bootstrap_commands')).rows[0].count,'1')
  const retry=await api[3].completeCurrentOrganisation(actors[3].request('POST'),commands[3]);assert.equal(retry.status,'CREATED')
 })
 await t.test('revocation/disabled policy withholds even a previous completion; audit omits private onboarding fields',async()=>{
  actors[winner].active=false;await assert.rejects(api[winner].completeCurrentOrganisation(actors[winner].request('POST'),commands[winner]));actors[winner].active=true
  await f.admin.query('UPDATE profitia_profile.organisation_bootstrap_policies SET enabled=false')
  await assert.rejects(api[winner].completeCurrentOrganisation(actors[winner].request('POST'),commands[winner]))
  const audit=JSON.stringify((await f.admin.query("SELECT event FROM profitia_access.security_events WHERE event->>'operation'='organisation.create'")).rows)
  assert(!audit.includes('1234563218'));assert(!audit.includes('Energia odnawialna'));assert(!audit.includes('Przykładowa'));assert(!audit.includes('@'))
 })
})
