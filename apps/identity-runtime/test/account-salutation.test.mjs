import test from 'node:test'
import assert from 'node:assert/strict'
import {configuration} from './fixtures.mjs'
import {createAccountSalutationSurface,projectAccountSalutation} from '../dist/src/account-salutation.js'
import {accountTransactions} from '../dist/src/account-provisioning.js'
import {createHttpHandler} from '../dist/src/http-handler.js'
import {createIdentityProvisioner} from '../../../packages/platform-contracts/src/identity-provisioning.mjs'
import {postgresFixture,clerkFixture} from '../../../packages/platform-contracts/test/fixtures/identity-profile-postgres.mjs'

test('salutation projection uses persisted fields and exposes no unrelated profile data',()=>{
 const p={user_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',version:'2',first_name:'Agnieszka',name_vocative:'Agnieszko',name_dictionary_version:'dictionary-v1',phone:'+48000000000',job:'Private',name_gender:'Female',avatar_sex:'male'}
 assert.deepEqual(projectAccountSalutation(p),{userId:p.user_id,firstName:'Agnieszka',vocative:'Agnieszko',dictionaryVersion:'dictionary-v1',version:'2'})
 assert.equal(projectAccountSalutation(null),null)
 assert.equal(projectAccountSalutation({...p,first_name:null,name_vocative:null,name_dictionary_version:null}).vocative,null)
 for(const patch of [{name_vocative:undefined},{name_vocative:'Wrong\nname'},{name_vocative:'A'.repeat(161)},{name_dictionary_version:null},{user_id:'provider_user'},{version:'0'}])assert.throws(()=>projectAccountSalutation({...p,...patch}))
})

test('HTTP salutation reads account-self through actual E1/RLS and remains GET-only for SG2 peers',async t=>{
 const db=await postgresFixture();t.after(()=>db.close())
 const a=clerkFixture(),b=clerkFixture('user_synthetic_b')
 const raw=a.client.users.getUser
 a.client.users.getUser=async id=>({...await raw(id),primaryEmailAddressId:'primary',emailAddresses:[{id:'primary',verification:{status:a.unverified?'unverified':'verified'}}]})
 const uidA=(await createIdentityProvisioner(db.options(a)).ensureAccount(a.request('POST'))).userId
 const uidB=(await createIdentityProvisioner(db.options(b)).ensureAccount(b.request('POST'))).userId
 // Synthetic fixture extends the existing row shape; production needs no DDL.
 await db.admin.query('ALTER TABLE profitia_profile.user_profiles ADD COLUMN first_name text,ADD COLUMN name_vocative text,ADD COLUMN name_dictionary_version text')
 await db.admin.query("UPDATE profitia_profile.user_profiles SET first_name='Agnieszka',name_vocative='Agnieszko',name_dictionary_version='dictionary-v1',avatar_sex='male' WHERE user_id=$1",[uidA])
 await db.admin.query("UPDATE profitia_profile.user_profiles SET first_name='Marek',name_vocative='Marku',name_dictionary_version='dictionary-v1',avatar_sex='female' WHERE user_id=$1",[uidB])
 const storedVersion=String((await db.admin.query('SELECT version FROM profitia_profile.user_profiles WHERE user_id=$1',[uidA])).rows[0].version)
 const cfg=configuration({applicationId:db.binding.applicationId})
 const surface=createAccountSalutationSurface({...db.options(a),transact:accountTransactions(db.pool),configuration:cfg,deploymentId:'fixture',configurationVersion:'fixture'})
 const handler=createHttpHandler({configuration:cfg},{},null,null,null,null,null,surface)
 const request=(method='GET',suffix='',headers={})=>new Request(cfg.origin+'/v1/account/salutation'+suffix,{method,headers:{authorization:'Bearer synthetic-fixture',...headers}})
 let r=await handler(request());assert.equal(r.status,200)
 assert.deepEqual(await r.json(),{userId:uidA,firstName:'Agnieszka',vocative:'Agnieszko',dictionaryVersion:'dictionary-v1',version:storedVersion})
 assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('access-control-allow-origin'),null)
 a.origin=cfg.targets.sg2.origin;r=await handler(request());assert.equal(r.status,200);assert.equal((await r.json()).vocative,'Agnieszko')
 a.origin=cfg.targets.srm.origin;assert.notEqual((await handler(request())).status,200)
 a.origin=cfg.targets.sg2.origin;a.subject=b.subject;r=await handler(request());assert.equal(r.status,200);assert.equal((await r.json()).vocative,'Marku')
 a.subject='user_synthetic_a';a.active=false;assert.notEqual((await handler(request())).status,200);a.active=true
 a.unverified=true;assert.notEqual((await handler(request())).status,200);a.unverified=false
 for(const method of ['POST','PUT','PATCH','DELETE','OPTIONS'])assert.equal((await handler(request(method))).status,405)
 assert.equal((await handler(request('GET','?userId='+uidB))).status,404)
 assert.equal((await handler(request('GET','',{origin:cfg.targets.sg2.origin}))).status,403)
 const profile=(await db.admin.query('SELECT first_name,name_vocative,avatar_sex,version FROM profitia_profile.user_profiles WHERE user_id=$1',[uidA])).rows[0]
 assert.equal(profile.first_name,'Agnieszka');assert.equal(profile.name_vocative,'Agnieszko');assert.equal(profile.avatar_sex,'male');assert.equal(String(profile.version),storedVersion)
 const counts=await db.admin.query('SELECT (SELECT count(*) FROM profitia_access.memberships) AS memberships,(SELECT count(*) FROM profitia_access.product_grants) AS entitlements')
 assert.equal(counts.rows[0].memberships,'0');assert.equal(counts.rows[0].entitlements,'0')
})
