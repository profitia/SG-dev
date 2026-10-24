import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {configuration} from './fixtures.mjs'
import {createCommunicationLanguageSurface,browserCommunicationLanguage,languageSchemaDigest} from '../dist/src/communication-language.js'
import {accountTransactions} from '../dist/src/account-provisioning.js'
import {createHttpHandler} from '../dist/src/http-handler.js'
import {createIdentityProvisioner} from '../../../packages/platform-contracts/src/identity-provisioning.mjs'
import {postgresFixture,clerkFixture} from '../../../packages/platform-contracts/test/fixtures/identity-profile-postgres.mjs'

test('browser primary preference maps to communication language, never country',()=>{
 for(const v of ['pl','pl-PL','PL','pl-Latn-PL'])assert.equal(browserCommunicationLanguage(v),'pl')
 for(const v of ['en','en-PL','de','uk-UA','plx','pl_PL','fr',null,undefined,{},['pl'],''])assert.equal(browserCommunicationLanguage(v),'en')
})
test('language HTTP: verified self, first initialization, explicit versioning and revoked access',{timeout:60000},async t=>{
 const db=await postgresFixture();t.after(()=>db.close())
 for(const file of ['003-email-delivery.sql','004-communication-language.sql']){
  const sql=fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/profile/'+file,import.meta.url),'utf8')
  await db.admin.query('BEGIN');await db.admin.query(sql)
  await db.admin.query('INSERT INTO profitia_profile.'+(file.startsWith('003')?'email':'language')+'_installation VALUES(true,$1)',[createHash('sha256').update(sql).digest('hex')]);await db.admin.query('COMMIT')
 }
 await db.admin.query('GRANT EXECUTE ON FUNCTION profitia_profile.language_descriptor() TO identity_b1_runtime')
 const a=clerkFixture('user_languagetest'),b=clerkFixture('user_otherlanguagetest'),cfg=configuration({applicationId:db.binding.applicationId})
 const raw=a.client.users.getUser;a.client.users.getUser=async id=>({...await raw(id),primaryEmailAddressId:'p',emailAddresses:[{id:'p',verification:{status:a.unverified?'unverified':'verified'}}]})
 await createIdentityProvisioner(db.options(a)).ensureAccount(a.request('POST'));await createIdentityProvisioner(db.options(b)).ensureAccount(b.request('POST'))
 const surface=createCommunicationLanguageSurface({...db.options(a),transact:accountTransactions(db.pool),configuration:cfg,deploymentId:'fixture',configurationVersion:'fixture'})
 const handler=createHttpHandler({configuration:cfg},{},null,null,surface)
 const request=(method='GET',body,origin=cfg.origin)=>new Request(cfg.origin+'/v1/account/communication-language',{method,headers:{authorization:'Bearer synthetic',origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})})
 let response=await handler(request());assert.equal(response.status,200);let p=await response.json();assert.equal(p.language,'en');assert.equal(p.source,'default')
 assert.deepEqual(Object.keys(p).sort(),['language','source','userId','version'])
 response=await handler(request('POST',{expectedVersion:p.version,language:'pl',source:'browser'}));assert.equal(response.status,200);p=await response.json();assert.equal(p.language,'pl');assert.equal(p.source,'browser')
 let again=await(await handler(request('POST',{expectedVersion:p.version,language:'en',source:'browser'}))).json();assert.deepEqual(again,p)
 response=await handler(request('POST',{expectedVersion:p.version,language:'en',source:'user'}));assert.equal(response.status,200);again=await response.json();assert.equal(again.language,'en');assert.equal(again.source,'user')
 assert.equal((await handler(request('POST',{expectedVersion:p.version,language:'pl',source:'user'}))).status,409)
 assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('access-control-allow-origin'),null)
 for(const bad of [{language:'de',source:'user',expectedVersion:again.version},{language:'pl',source:'migration',expectedVersion:again.version},{language:'pl',source:'user',expectedVersion:'0'},{language:'pl',source:'user',expectedVersion:again.version,userId:'other'}])assert.equal((await handler(request('POST',bad))).status,400)
 assert.equal((await handler(request('POST',{expectedVersion:again.version,language:'pl',source:'user'},cfg.targets.sg2.origin))).status,403)
 a.origin=cfg.targets.sg2.origin;assert.notEqual((await handler(request())).status,200);a.origin=cfg.origin
 a.active=false;assert.notEqual((await handler(request())).status,200);a.active=true
 a.unverified=true;assert.notEqual((await handler(request())).status,200);a.unverified=false
 await db.admin.query("UPDATE profitia_profile.language_installation SET schema_digest=$1",['a'.repeat(64)])
 await assert.rejects(()=>surface.ready());assert.equal((await handler(request())).status,503)
 assert.match(languageSchemaDigest(),/^[a-f0-9]{64}$/)
})
