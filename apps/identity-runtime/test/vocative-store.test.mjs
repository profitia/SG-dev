import {installVocativeDictionary} from '../../../packages/platform-contracts/src/vocative-dictionary.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {randomBytes,randomUUID} from 'node:crypto'
import {postgresFixture,clerkFixture} from '../../../packages/platform-contracts/test/fixtures/identity-profile-postgres.mjs'
import {createIdentityProvisioner} from '../../../packages/platform-contracts/src/identity-provisioning.mjs'
import {createEmailStore,emailSchemaDigest} from '../dist/src/email-store.js'
import {languageSchemaDigest} from '../dist/src/communication-language.js'
import {createRegistrationStore,registrationSchemaDigest} from '../dist/src/registration-store.js'
import {createHmac} from 'node:crypto'
import {renderMailgunResolved} from '../email-templates/render.mjs'

test('vocative SQL: trusted names, first mail, completion, language switch and immutable delivery', {timeout:60000},async t=>{
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
   await f.admin.query(fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/profile/006-vocative.sql',import.meta.url),'utf8'))
  await installVocativeDictionary(f.admin.query.bind(f.admin))
  await f.admin.query('UPDATE profitia_profile.email_policies SET allow_salutation_projection=true')
  await f.admin.query('GRANT EXECUTE ON FUNCTION profitia_profile.vocative_descriptor(),profitia_profile.registration_command(text,bigint,text),profitia_profile.email_command(text,bigint,text) TO identity_b1_runtime')
 await f.admin.query('COMMIT')
 const cfg={binding:f.binding,issuer,instanceId,serviceId:'identity-email-test',schemaDigest:emailSchemaDigest(),proofKey:proof,encryptionKey:key,keyId:'test-key'}
 const store=createRegistrationStore(cfg,f.transact),mail=createEmailStore(cfg,f.transact),draft={email:'synthetic@example.test',firstName:'Ada',lastName:'Testowa',avatar:'female',language:'en'}
 const receipt=a=>({attemptId:a.attemptId,token:a.token})
 const start=d=>store.start({...draft,...d})
 const ready=async(a,subject='user_pending1234')=>{await store.command('bind',receipt(a),{subject,emailAddressId:'idn_pending1234'});await store.command('ready',receipt(a),{verificationId:'ver_test1234'})}
 const age=async()=>f.admin.query("UPDATE profitia_profile.registrations SET updated_at=now()-interval '31 seconds',lease_until=NULL")
 await store.ready()
 await t.test('disabled salutation grant and dictionary drift fail closed before a new registration or delivery',async()=>{
  await f.admin.query('UPDATE profitia_profile.email_policies SET allow_salutation_projection=false')
  await assert.rejects(store.ready(),/VOCATIVE_UNAVAILABLE/);await assert.rejects(mail.ready(),/VOCATIVE_UNAVAILABLE/)
  await f.admin.query('UPDATE profitia_profile.email_policies SET allow_salutation_projection=true')
  const original=(await f.admin.query('SELECT review_digest FROM profitia_profile.vocative_installation')).rows[0].review_digest
  await f.admin.query('UPDATE profitia_profile.vocative_installation SET review_digest=$1',['0'.repeat(64)])
  await assert.rejects(store.ready(),/VOCATIVE_UNAVAILABLE/)
  await f.admin.query('UPDATE profitia_profile.vocative_installation SET review_digest=$1',[original]);await store.ready()
 })
 await t.test('only approved exact Polish names resolve; no country, suffix or avatar inference',async()=>{
  for(const[name,language,vocative,gender]of [['Marek','pl','Marku','Male'],['Marek','en',null,'Unknown'],['Anna','pl','Anno','Female'],['Łukasz','pl','Łukaszu','Male'],['MAREK','pl','MARKU','Male'],['marek','pl','marku','Male'],['JÓZEF','pl','JÓZEFIE','Male'],['John','pl',null,'Unknown'],['Anna Maria','pl',null,'Unknown'],['Unknown','pl',null,'Unknown']]){
   const r=(await f.admin.query('SELECT profitia_profile.resolve_vocative($1,$2) AS r',[name,language])).rows[0].r
   assert.equal(r.vocative,vocative,name);assert.equal(r.gender,gender,name)
  }
  for(const object of ['vocative_source','vocative_dictionary','registration_attempts'])await assert.rejects(f.pool.query('SELECT * FROM profitia_profile.'+object),e=>e.code==='42501')
  for(const fn of ['registration_command_v5','email_command_v5'])await assert.rejects(f.pool.query('SELECT profitia_profile.'+fn+'($1,$2,$3)',['{}',Date.now()+4000,'0'.repeat(64)]),e=>e.code==='42501')
 })
 const subject='user_pending1234';let receiptA,uid
 const e=(a,id)=>({emailId:'ema_'+id,eventId:'msg_'+id,instanceId,createdAt:Date.now(),expiresAt:Date.now()+240000,recipient:draft.email,providerUserId:subject,emailAddressId:'idn_pending1234',kind:'verification-code',otpCode:'654321',registrationAttemptId:a.attemptId})
 await t.test('first OTP uses Marek/Marku with independently chosen female assistant before account creation',async()=>{
  receiptA=await start({firstName:'Marek',avatar:'female',language:'pl'});await ready(receiptA)
  await mail.enqueue(e(receiptA,'vocativefirst'))
  const row=(await f.admin.query('SELECT first_name,name_vocative,name_gender,avatar,language FROM profitia_profile.registration_attempts WHERE id=$1',[receiptA.attemptId])).rows[0]
  assert.deepEqual(row,{first_name:'Marek',name_vocative:'Marku',name_gender:'Male',avatar:'female',language:'pl'})
  assert.equal((await f.admin.query('SELECT count(*) FROM profitia_access.accounts')).rows[0].count,'0')
  const c=await mail.claim(),p=await mail.begin(c);assert.deepEqual(p,{avatar:'female',language:'pl',firstName:'Marek',vocative:'Marku'})
  const content=renderMailgunResolved({kind:'verification-code',...p,data:{...p,appName:'SpendGuru',currentYear:2026,otpCode:c.instruction.otpCode,requestedFrom:'SpendGuru',requestedAt:'2026-10-24'}})
  assert(content.html.includes('Cześć, Marku!'));assert(content.html.includes('cid:assistant-female.png'))
  await mail.settle(c,'accepted','<synthetic@example.test>')
  assert.equal((await f.admin.query('SELECT salutation_first_name FROM profitia_profile.email_outbox WHERE email_id=$1',[c.emailId])).rows[0].salutation_first_name,null)
 })
 await t.test('completion persists names, restart retains them, and language changes cannot produce Hello Marku',async()=>{
  await store.command('verify',receipt(receiptA));await store.command('verified',receipt(receiptA),{verified:true});await store.command('ticket',receipt(receiptA))
  const clerk=clerkFixture(subject),finalTransact=(run,limits)=>f.transact(async tx=>{const r=await run(tx);await store.finish(tx.query,r.userId,null);return r},limits)
  uid=(await createIdentityProvisioner({...f.options(clerk),transact:finalTransact}).ensureAccount(clerk.request('POST'))).userId
  const profile=(await f.admin.query('SELECT * FROM profitia_profile.user_profiles WHERE user_id=$1',[uid])).rows[0]
  assert.equal(profile.first_name,'Marek');assert.equal(profile.name_vocative,'Marku');assert.equal(profile.name_gender,'Male');assert.equal(profile.avatar_sex,'female');assert.equal(profile.registration_status,'Finished');assert.equal(profile.organisation_status,'Unassigned')
  const later=e(receiptA,'vocativelater');delete later.registrationAttemptId
  await mail.enqueue(later)
  await f.admin.query("UPDATE profitia_profile.user_profiles SET communication_language='en',language_source='user',avatar_sex='male' WHERE user_id=$1",[uid])
  const p=(await f.admin.query('SELECT * FROM profitia_profile.user_profiles WHERE user_id=$1',[uid])).rows[0];assert.equal(p.name_vocative,null);assert.equal(p.name_gender,'Unknown')
  const restarted=createEmailStore(cfg,f.transact),old=await restarted.claim();assert.deepEqual(await restarted.begin(old),{avatar:'female',language:'pl',firstName:'Marek',vocative:'Marku'});await restarted.settle(old,'accepted','<snapshot@example.test>')
  await restarted.enqueue({...later,emailId:'ema_vocativeenglish',eventId:'msg_vocativeenglish'});const next=await restarted.claim();assert.deepEqual(await restarted.begin(next),{avatar:'male',language:'en',firstName:'Marek',vocative:null});await restarted.settle(next,'accepted','<english@example.test>')
  await createIdentityProvisioner({...f.options(clerk),transact:finalTransact}).ensureAccount(clerk.request('POST'))
  assert.equal((await f.admin.query('SELECT communication_language FROM profitia_profile.user_profiles WHERE user_id=$1',[uid])).rows[0].communication_language,'en')
  await f.admin.query("UPDATE profitia_profile.user_profiles SET communication_language='pl' WHERE user_id=$1",[uid]);assert.equal((await f.admin.query('SELECT name_vocative FROM profitia_profile.user_profiles WHERE user_id=$1',[uid])).rows[0].name_vocative,'Marku')
 })
 await t.test('revoked account cannot reveal name from queued snapshot',async()=>{
  const ev=e(receiptA,'vocativerevoked');delete ev.registrationAttemptId;await mail.enqueue(ev)
  await f.admin.query("UPDATE profitia_access.accounts SET status='DISABLED' WHERE user_id=$1",[uid])
  const c=await mail.claim();assert.deepEqual(await mail.begin(c),{avatar:'neutral',language:'en',firstName:null,vocative:null});await mail.settle(c,'rejected')
 })
 await t.test('extra unsigned name, unknown fields and cross-transaction proofs fail; legacy start remains rollback compatible',async()=>{
  const call=async(query,body,change)=>{const tx=(await query('SELECT txid_current()::text AS tx')).rows[0].tx,until=Date.now()+4500,text=JSON.stringify(body),signature=createHmac('sha256',proof).update(['registration-v1',cfg.binding.environment,cfg.binding.applicationId,cfg.binding.role,cfg.serviceId,cfg.instanceId,tx,until,text].join('\x1f')).digest('hex');return query('SELECT profitia_profile.registration_command($1,$2,$3) AS r',[change?JSON.stringify(change):text,until,signature])}
  const old={op:'start',emailKey:'9'.repeat(64),attemptId:randomUUID(),tokenHash:'8'.repeat(64),ciphertext:'x'.repeat(100),avatar:'female',language:'en'}
  await assert.rejects(f.transact(({query})=>call(query,old,{...old,firstName:'Marek'})))
  await assert.rejects(f.transact(({query})=>call(query,{...old,firstName:'Marek',organisationId:randomUUID()})))
  assert.equal((await f.transact(({query})=>call(query,old))).rows[0].r.status,'preparing')
  await f.admin.query("UPDATE profitia_profile.registration_attempts SET created_at=now()-interval '31 days' WHERE id=$1",[receiptA.attemptId])
  await start({email:'retention@example.test',firstName:'Anna',language:'pl'})
  assert.equal((await f.admin.query('SELECT first_name FROM profitia_profile.registration_attempts WHERE id=$1',[receiptA.attemptId])).rows[0].first_name,null)
 })
})
