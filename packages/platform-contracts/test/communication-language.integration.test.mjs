import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash,createHmac,randomBytes} from 'node:crypto'
import {postgresFixture,clerkFixture} from './fixtures/identity-profile-postgres.mjs'
import {createIdentityProvisioner} from '../src/identity-provisioning.mjs'
import {createUserProfileBackend} from '../src/user-profile.mjs'
import {createPrivateOperationHost} from '../src/private-operation-host.mjs'
import {createClerkIdentityAuthenticator} from '../src/identity-provider.mjs'
import {createProfileSql} from '../src/identity-profile-sql.mjs'
import {OPERATION_CONTRACT} from '../src/operation-context.mjs'

test('communication language: additive PL migration, account-self ownership, first-browser write and bounded email snapshot',{timeout:60000},async t=>{
 const f=await postgresFixture();t.after(()=>f.close())
 const old=clerkFixture('user_oldlanguage'),newUser=clerkFixture('user_newlanguage'),other=clerkFixture('user_otherlanguage')
 const provision=x=>createIdentityProvisioner(f.options(x)).ensureAccount(x.request('POST'))
 const api=x=>createUserProfileBackend(f.options(x))
 const oldAccount=await provision(old),oldProfile=await api(old).getCurrentUserProfile(old.request('GET'))
 await api(old).updateCurrentUserProfile(old.request('PATCH'),{expectedVersion:oldProfile.version,patch:{avatar_sex:'female',job:'Synthetic role'}})
 const legacy='99999999-9999-4999-8999-999999999999'
 await f.admin.query("INSERT INTO profitia_access.accounts(user_id,status) VALUES($1,'ACTIVE')",[legacy])
 const load=n=>fs.readFileSync(new URL('../migrations/profile/'+n,import.meta.url),'utf8'),digest=s=>createHash('sha256').update(s).digest('hex')
 const email=load('003-email-delivery.sql'),language=load('004-communication-language.sql'),key=randomBytes(32)
 await f.admin.query('BEGIN');await f.admin.query(email)
 await f.admin.query('INSERT INTO profitia_profile.email_installation VALUES(true,$1)',[digest(email)])
 await f.admin.query(language)
 await f.admin.query('INSERT INTO profitia_profile.language_installation VALUES(true,$1)',[digest(language)])
 await f.admin.query("INSERT INTO profitia_profile.email_policies(login_role,issuer,instance_id,service_id,enabled,proof_key) VALUES('identity_b1_runtime','https://synthetic.clerk.accounts.dev','ins_language123','identity-language-test',true,$1)",[key])
 await f.admin.query('GRANT EXECUTE ON FUNCTION profitia_profile.email_descriptor(),profitia_profile.email_command(text,bigint,text),profitia_profile.language_descriptor() TO identity_b1_runtime')
 await f.admin.query('COMMIT')
 const patch=async(x,profile,lang,source='browser')=>{
  const o=f.options(x),sql=createProfileSql({...o,issuer:x.issuer}),queries=new WeakMap();let conflict=false
  const host=createPrivateOperationHost({...o,createAuthenticator:({resolveBinding})=>createClerkIdentityAuthenticator({client:x.client,application:o.identityApplication,resolveBinding}),
   transact:(run,limits)=>f.transact(async session=>{queries.set(session.transaction,session.query);try{return await run(session)}finally{queries.delete(session.transaction)}},limits),
   readResources:async({actor,request,query})=>{const proof=await sql.attest(query,{operation:request.operation,principal:actor.userId,expiresAt:Date.parse(actor.expiresAt)});await query("SELECT set_config('profitia.profile.operation',$1,true),set_config('profitia.profile.expires_ms',$2,true),set_config('profitia.profile.signature',$3,true)",[request.operation,String(proof.until),proof.signature]);return{resource:{id:'current-user-profile',type:'account_settings',dataClass:'ACCOUNT_PRIVATE',ownerOrganisationId:null,ownerUserId:actor.userId,environment:'development',version:'profile-v1',projectionVersion:'profile-v1'}}},projectOutput:v=>v})
  try{return(await host.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'account.settings.write',resourceId:'current-user-profile',organisationId:null,request:x.request('PATCH'),payload:{fields:['communication_language','language_source'],expectedVersion:profile.version}},async(_c,tx)=>{try{return(await sql.queryOne(queries.get(tx),'SELECT profitia_profile.update_current($1::bigint,$2::jsonb) AS profile',[profile.version,JSON.stringify({communication_language:lang,language_source:source})])).profile}catch(e){conflict=e.code==='PROFILE_VERSION_CONFLICT';throw e}})).value}catch(e){if(conflict)throw Object.assign(Error('Conflict'),{code:'PROFILE_VERSION_CONFLICT'});throw e}
 }
 await t.test('all pre-cutover accounts receive PL without changing other data or memberships',async()=>{
  const rows=(await f.admin.query('SELECT user_id,avatar_sex,job,communication_language,language_source FROM profitia_profile.user_profiles ORDER BY user_id')).rows
  assert.equal(rows.length,2);assert.ok(rows.every(x=>x.communication_language==='pl'&&x.language_source==='migration'))
  const p=rows.find(x=>x.user_id===oldAccount.userId);assert.equal(p.avatar_sex,'female');assert.equal(p.job,'Synthetic role')
  assert.equal((await f.admin.query('SELECT count(*) FROM profitia_access.memberships')).rows[0].count,'0')
  assert.equal((await f.pool.query('SELECT profitia_profile.language_descriptor() AS d')).rows[0].d.languageSchemaDigest,digest(language))
  await assert.rejects(()=>f.pool.query('SELECT * FROM profitia_profile.language_installation'),e=>e.code==='42501')
  assert.equal((await f.pool.query('SELECT count(*) FROM profitia_profile.user_profiles')).rows[0].count,'0')
 })
 await t.test('new profile initializes once; repeated browser/device changes preserve stored value',async()=>{
  await provision(newUser);let p=await api(newUser).getCurrentUserProfile(newUser.request('GET'))
  assert.equal(p.communication_language,'en');assert.equal(p.language_source,'default')
  p=await patch(newUser,p,'pl');assert.equal(p.communication_language,'pl');assert.equal(p.language_source,'browser')
  const again=await patch(newUser,p,'en');assert.equal(again.communication_language,'pl');assert.equal(again.version,p.version)
  const previous=await api(old).getCurrentUserProfile(old.request('GET'));assert.equal((await patch(old,previous,'en')).communication_language,'pl')
 })
 await t.test('future explicit preference overrides browser with optimistic concurrency; other users remain isolated',async()=>{
  let p=await api(newUser).getCurrentUserProfile(newUser.request('GET'));const version=p.version
  p=await patch(newUser,p,'en','user');assert.equal(p.language_source,'user')
  await assert.rejects(()=>patch(newUser,{version},'pl','user'),e=>e.code==='PROFILE_VERSION_CONFLICT')
  assert.equal((await patch(newUser,p,'pl')).communication_language,'en')
  await provision(other);const q=await api(other).getCurrentUserProfile(other.request('GET'))
  assert.notEqual(p.user_id,q.user_id);assert.equal(q.language_source,'default')
  assert.throws(()=>api(other).updateCurrentUserProfile(other.request('PATCH'),{expectedVersion:q.version,patch:{user_id:p.user_id,communication_language:'pl',language_source:'user'}}))
  other.active=false;await assert.rejects(()=>api(other).getCurrentUserProfile(other.request('GET')));other.active=true
  for(const bad of [{communication_language:'en',language_source:null},{communication_language:null,language_source:'user'},{communication_language:'de',language_source:'browser'},{communication_language:'pl',language_source:'migration'}])await assert.rejects(()=>patch(newUser,p,bad.communication_language,bad.language_source))
 })
 const command=body=>f.transact(async({query})=>{
  const tx=(await query('SELECT txid_current()::text AS tx')).rows[0].tx,until=Date.now()+4500,text=JSON.stringify(body)
  const sig=createHmac('sha256',key).update(['development',f.binding.applicationId,f.binding.role,'identity-language-test','ins_language123',tx,until,text].join('\x1f')).digest('hex')
  return (await query('SELECT profitia_profile.email_command($1,$2,$3) AS r',[text,until,sig])).rows[0].r
 })
 const enqueue=(id,subject)=>command({op:'enqueue',emailId:'ema_'+id,eventId:'msg_'+id,fingerprint:'b'.repeat(64),providerSubject:subject,ciphertext:'synthetic-encrypted-'.repeat(5),expiresAt:Date.now()+240000})
 const send=async()=>{const c=await command({op:'claim'});const p=await command({op:'begin',emailId:c.emailId,token:c.token});await command({op:'settle',emailId:c.emailId,token:c.token,status:'rejected',providerId:null});return p}
 await t.test('email language needs its own grant; immutable queue snapshot survives preference change and duplicate intake',async()=>{
  await enqueue('nogrant123',old.subject);assert.equal((await send()).language,'en')
  await f.admin.query('UPDATE profitia_profile.email_policies SET allow_language_projection=true')
  await enqueue('snapshot123',newUser.subject)
  let p=await api(newUser).getCurrentUserProfile(newUser.request('GET'));await patch(newUser,p,'pl','user')
  assert.equal((await enqueue('snapshot123',newUser.subject)).status,'duplicate')
  assert.equal((await send()).language,'en')
  await enqueue('later1234',newUser.subject);assert.equal((await send()).language,'pl')
  await enqueue('missing123',null);assert.deepEqual(await send(),{status:'sending',avatar:'neutral',language:'en'})
 })
 await t.test('revocation and projection kill switch prevent release of a private language snapshot',async()=>{
  await enqueue('revoked123',old.subject)
  await f.admin.query("UPDATE profitia_access.external_identities SET status='REVOKED' WHERE user_id=$1",[oldAccount.userId]);assert.equal((await send()).language,'en')
  await enqueue('kill12345',newUser.subject)
  await f.admin.query('UPDATE profitia_profile.email_policies SET allow_language_projection=false');assert.equal((await send()).language,'en')
  await assert.rejects(()=>f.pool.query('UPDATE profitia_profile.user_profiles SET communication_language=\'pl\''),e=>e.code==='42501')
  const audit=JSON.stringify((await f.admin.query('SELECT * FROM profitia_profile.email_audit')).rows);assert.ok(!audit.includes('synthetic-encrypted'))
 })
 await t.test('old avatar/profile operations remain usable after additive migration and rollback of language runtime',async()=>{
  const p=await api(newUser).getCurrentUserProfile(newUser.request('GET'))
  const changed=await api(newUser).updateCurrentUserProfile(newUser.request('PATCH'),{expectedVersion:p.version,patch:{avatar_sex:'male'}})
  assert.equal(changed.avatar_sex,'male');assert.equal(changed.communication_language,p.communication_language)
 })
})
