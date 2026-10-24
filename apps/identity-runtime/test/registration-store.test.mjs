import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {randomBytes,randomUUID} from 'node:crypto'
import {postgresFixture,clerkFixture} from '../../../packages/platform-contracts/test/fixtures/identity-profile-postgres.mjs'
import {createIdentityProvisioner} from '../../../packages/platform-contracts/src/identity-provisioning.mjs'
import {createEmailStore,emailSchemaDigest} from '../dist/src/email-store.js'
import {languageSchemaDigest} from '../dist/src/communication-language.js'
import {createRegistrationStore,registrationSchemaDigest} from '../dist/src/registration-store.js'
import {createRegistrationSurface} from '../dist/src/registration.js'

test('registration SQL: reserved identity, personalisation snapshot, resumable proof and atomic completion', {timeout:60000},async t=>{
 const f=await postgresFixture();t.after(()=>f.close())
 const proof=randomBytes(32),key=randomBytes(32),issuer='https://synthetic.clerk.accounts.dev',instanceId='ins_test1234'
 await f.admin.query('BEGIN')
 for(const[n,digest]of [['003-email-delivery',emailSchemaDigest()],['004-communication-language',languageSchemaDigest()]]){
  await f.admin.query(fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/profile/'+n+'.sql',import.meta.url),'utf8'))
  await f.admin.query('INSERT INTO profitia_profile.'+(n.startsWith('003')?'email':'language')+'_installation VALUES(true,$1)',[digest])
 }
 await f.admin.query(`INSERT INTO profitia_profile.email_policies(login_role,issuer,instance_id,service_id,enabled,allow_avatar_projection,allow_language_projection,proof_key)
 VALUES('identity_b1_runtime',$1,$2,'identity-email-test',true,true,true,$3)`,[issuer,instanceId,proof])
 await f.admin.query(fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/profile/005-registration.sql',import.meta.url),'utf8'))
 await f.admin.query('INSERT INTO profitia_profile.registration_installation VALUES(true,$1)',[registrationSchemaDigest()])
 await f.admin.query("INSERT INTO profitia_profile.registration_policies(login_role,enabled) VALUES('identity_b1_runtime',true)")
 await f.admin.query('GRANT EXECUTE ON FUNCTION profitia_profile.email_descriptor(),profitia_profile.email_command(text,bigint,text),profitia_profile.language_descriptor(),profitia_profile.registration_descriptor(),profitia_profile.registration_command(text,bigint,text) TO identity_b1_runtime')
 await f.admin.query('COMMIT')
 const cfg={binding:f.binding,issuer,instanceId,serviceId:'identity-email-test',schemaDigest:emailSchemaDigest(),proofKey:proof,encryptionKey:key,keyId:'test-key'}
 const store=createRegistrationStore(cfg,f.transact),mail=createEmailStore(cfg,f.transact),draft={email:'synthetic@example.test',firstName:'Ada',lastName:'Testowa',avatar:'female',language:'en'}
 const receipt=a=>({attemptId:a.attemptId,token:a.token})
 const start=d=>store.start({...draft,...d})
 const ready=async(a,subject='user_pending1234')=>{await store.command('bind',receipt(a),{subject,emailAddressId:'idn_pending1234'});await store.command('ready',receipt(a),{verificationId:'ver_test1234'})}
 const age=async()=>f.admin.query("UPDATE profitia_profile.registrations SET updated_at=now()-interval '31 seconds',lease_until=NULL")
 await store.ready()
 await t.test('forced RLS and HMAC deny raw/forged access; exact descriptor and policy required',async()=>{
  for(const table of ['registrations','registration_attempts','registration_policies'])await assert.rejects(f.pool.query('SELECT * FROM profitia_profile.'+table),e=>e.code==='42501')
  await assert.rejects(f.pool.query('SELECT profitia_profile.registration_command($1,$2,$3)',['{"op":"start"}',Date.now()+4000,'0'.repeat(64)]))
  await assert.rejects(createRegistrationStore({...cfg,binding:{...cfg.binding,branchId:'foreign'}},f.transact).ready())
  await f.admin.query('UPDATE profitia_profile.registration_policies SET enabled=false');await assert.rejects(store.ready());await f.admin.query('UPDATE profitia_profile.registration_policies SET enabled=true')
 })
 let first
 await t.test('concurrent starts reserve one record; no internal account, membership or plaintext draft',async()=>{
  const all=await Promise.all(Array.from({length:6},()=>start()));assert.equal(all.filter(a=>a.status==='preparing').length,1);first=all.find(a=>a.status==='preparing')
  const reg=(await f.admin.query('SELECT * FROM profitia_profile.registrations')).rows;assert.equal(reg.length,1);assert.equal(reg[0].registration_status,'Unfinished');assert.equal(reg[0].organisation_status,'Unassigned')
  for(const table of ['accounts','external_identities','memberships'])assert.equal((await f.admin.query('SELECT count(*) FROM profitia_access.'+table)).rows[0].count,'0')
  const attempts=(await f.admin.query('SELECT * FROM profitia_profile.registration_attempts')).rows;assert(!JSON.stringify(attempts).includes(draft.email));assert(!JSON.stringify(attempts).includes(first.token))
  assert.deepEqual(store.decrypt(first.attemptId,attempts[0].ciphertext),draft);await ready(first)
 })
 await t.test('wrong proof never authenticates; parallel verification and cross-attempt token fenced',async()=>{
  await assert.rejects(store.command('verify',{...receipt(first),token:randomBytes(32).toString('base64url')}))
  const verifies=await Promise.allSettled([store.command('verify',receipt(first)),store.command('verify',receipt(first))]);assert.equal(verifies.filter(x=>x.status==='fulfilled').length,1)
  await f.admin.query("UPDATE profitia_profile.registrations SET updated_at=now()-interval '31 seconds'")
  assert.equal((await start()).status,'retry')
  await store.command('verified',receipt(first),{verified:false});await assert.rejects(store.command('ticket',receipt(first)))
 })
 let latest
 await t.test('resume uses same record and subject; each email freezes its own avatar/language, including delayed events',async()=>{
  const variants=[['male','pl'],['male','en'],['female','pl'],['female','en']]
  for(const [i,[avatar,language]]of variants.entries()){
   await age();const a=await start({avatar,language});assert.equal(a.registrationId,first.registrationId);assert.equal(a.subject,'user_pending1234');await ready(a);latest=a
   const e={emailId:'ema_snapshot'+i,eventId:'msg_snapshot'+i,instanceId,createdAt:Date.now(),expiresAt:Date.now()+240000,recipient:draft.email,providerUserId:'user_pending1234',emailAddressId:'idn_pending1234',kind:'verification-code',otpCode:'654321',registrationAttemptId:a.attemptId}
   await mail.enqueue(e)
  }
  // A later selection must not change any already enqueued snapshot.
  await assert.rejects(store.command('verify',receipt(first)))
  for(const [avatar,language]of variants){const c=await mail.claim();assert.deepEqual(await mail.begin(c),{avatar,language});await mail.settle(c,'accepted','<synthetic@example.test>')}
  const delayed={emailId:'ema_delayed1234',eventId:'msg_delayed1234',instanceId,createdAt:Date.now(),expiresAt:Date.now()+240000,recipient:draft.email,providerUserId:'user_pending1234',emailAddressId:'idn_pending1234',kind:'verification-code',otpCode:'654321',registrationAttemptId:first.attemptId}
  await mail.enqueue(delayed);const c=await mail.claim();assert.deepEqual(await mail.begin(c),{avatar:'female',language:'en'});await mail.settle(c,'accepted','<delayed@example.test>')
  await assert.rejects(mail.enqueue({...delayed,emailId:'ema_wrong1234',eventId:'msg_wrong1234',providerUserId:'user_foreign1234'}))
  await assert.rejects(mail.enqueue({...delayed,emailId:'ema_wrong5678',eventId:'msg_wrong5678',emailAddressId:'idn_foreign1234'}))
 })
 let uid
 await t.test('verified Clerk session AND attempt proof finalise profile in the provisioning transaction; no organisation grant',async()=>{
  const clerk=clerkFixture('user_pending1234'),options=f.options(clerk)
  const finalTransact=(run,limits)=>f.transact(async tx=>{const r=await run(tx);await store.finish(tx.query,r.userId,null);return r},limits)
  await assert.rejects(createIdentityProvisioner({...options,transact:finalTransact}).ensureAccount(clerk.request('POST')))
  assert.equal((await f.admin.query('SELECT count(*) FROM profitia_access.accounts')).rows[0].count,'0')
  await store.command('verify',receipt(latest));await store.command('verified',receipt(latest),{verified:true});await store.command('ticket',receipt(latest))
  await assert.rejects(store.command('ticket',receipt(latest)))
  await f.admin.query("CREATE FUNCTION profitia_profile.registration_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.operation='finish' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$")
  await f.admin.query('CREATE TRIGGER registration_test_failure BEFORE INSERT ON profitia_profile.registration_audit FOR EACH ROW EXECUTE FUNCTION profitia_profile.registration_test_failure()')
  await assert.rejects(createIdentityProvisioner({...options,transact:finalTransact}).ensureAccount(clerk.request('POST')))
  assert.equal((await f.admin.query('SELECT count(*) FROM profitia_access.accounts')).rows[0].count,'0')
  assert.equal((await f.admin.query('SELECT registration_status FROM profitia_profile.registrations WHERE id=$1',[first.registrationId])).rows[0].registration_status,'Unfinished')
  await f.admin.query('DROP TRIGGER registration_test_failure ON profitia_profile.registration_audit; DROP FUNCTION profitia_profile.registration_test_failure()')
  const result=await createIdentityProvisioner({...options,transact:finalTransact}).ensureAccount(clerk.request('POST'));uid=result.userId
  const profile=(await f.admin.query('SELECT * FROM profitia_profile.user_profiles WHERE user_id=$1',[uid])).rows[0]
  assert.equal(profile.registration_status,'Finished');assert.equal(profile.organisation_status,'Unassigned');assert.equal(profile.avatar_sex,'female');assert.equal(profile.communication_language,'en');assert.equal(profile.language_source,'browser')
  assert.equal((await f.admin.query('SELECT count(*) FROM profitia_access.memberships')).rows[0].count,'0')
  assert.equal((await start()).status,'login')
  await f.admin.query("UPDATE profitia_profile.user_profiles SET avatar_sex='male',communication_language='pl',language_source='user' WHERE user_id=$1",[uid])
  await createIdentityProvisioner({...options,transact:finalTransact}).ensureAccount(clerk.request('POST'))
  assert.equal((await f.admin.query('SELECT avatar_sex FROM profitia_profile.user_profiles WHERE user_id=$1',[uid])).rows[0].avatar_sex,'male')
 })
 await t.test('organisation status follows actual affiliation and cannot be set through profile patch',async()=>{
  assert.ok(uid);const org=randomUUID();await f.admin.query("INSERT INTO profitia_access.organisations(organisation_id,status) VALUES($1,'ACTIVE')",[org])
  await f.admin.query("INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at) VALUES($1,$2,'ACTIVE','synthetic',now()+interval '1 hour')",[org,uid])
  assert.equal((await f.admin.query('SELECT organisation_status FROM profitia_profile.user_profiles WHERE user_id=$1',[uid])).rows[0].organisation_status,'Assigned')
  await f.admin.query('DELETE FROM profitia_access.memberships WHERE user_id=$1',[uid])
  assert.equal((await f.admin.query('SELECT organisation_status FROM profitia_profile.user_profiles WHERE user_id=$1',[uid])).rows[0].organisation_status,'Unassigned')
 })
 await t.test('expired attempts remain resumable; disabling extension preserves existing profile and account protocols',async()=>{
  const a=await start({email:'other@example.test'});await ready(a,'user_other1234');await f.admin.query("UPDATE profitia_profile.registration_attempts SET expires_at=now()-interval '1 second' WHERE id=$1",[a.attemptId]);await assert.rejects(store.command('verify',receipt(a)))
  await age();const resumed=await start({email:'other@example.test'});assert.equal(resumed.registrationId,a.registrationId);assert.equal(resumed.subject,'user_other1234')
  await f.admin.query('UPDATE profitia_profile.registration_policies SET enabled=false');await assert.rejects(store.ready())
  const legacy=clerkFixture('user_legacy1234');await createIdentityProvisioner(f.options(legacy)).ensureAccount(legacy.request('POST'))
  assert.equal((await f.admin.query('SELECT count(*) FROM profitia_access.memberships')).rows[0].count,'0')
 })
})
