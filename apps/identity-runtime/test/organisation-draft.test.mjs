import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { request as send } from 'node:http'
import { configuration } from './fixtures.mjs'
import { createOrganisationDraftSurface, readOrganisationDraftOptIn } from '../dist/src/organisation-draft.js'
import { accountTransactions } from '../dist/src/account-provisioning.js'
import { createHttpHandler } from '../dist/src/http-handler.js'
import { createNodeServer } from '../dist/src/node-server.js'
import { createIdentityProvisioner } from '../../../packages/platform-contracts/src/identity-provisioning.mjs'
import { organisationOnboardingSchemaDigest } from '../../../packages/platform-contracts/src/organisation-profile.mjs'
import { postgresFixture, clerkFixture } from '../../../packages/platform-contracts/test/fixtures/identity-profile-postgres.mjs'

test('organisation draft opt-in requires existing Identity, self-service and exact schema', () => {
  const enabled = { IDENTITY_ORGANISATION_DRAFT_ENABLED:'true', IDENTITY_RUNTIME_ENABLED:'true', IDENTITY_SELF_SERVICE_ENABLED:'true', IDENTITY_ORGANISATION_DRAFT_SCHEMA_DIGEST:organisationOnboardingSchemaDigest() }
  assert.equal(readOrganisationDraftOptIn({}),null)
  assert.equal(readOrganisationDraftOptIn({IDENTITY_ORGANISATION_DRAFT_ENABLED:'false'}),null)
  assert.equal(readOrganisationDraftOptIn(enabled),organisationOnboardingSchemaDigest())
  for (const patch of [{IDENTITY_ORGANISATION_DRAFT_ENABLED:'yes'},{IDENTITY_RUNTIME_ENABLED:'false'},{IDENTITY_SELF_SERVICE_ENABLED:undefined},{IDENTITY_ORGANISATION_DRAFT_SCHEMA_DIGEST:'0'.repeat(64)}]) assert.throws(()=>readOrganisationDraftOptIn({...enabled,...patch}))
})

test('native organisation draft HTTP persists real own-account SQL and preserves access controls', {timeout:60000}, async t => {
  const db=await postgresFixture();t.after(()=>db.close())
  const a=clerkFixture('user_native_onboarding_a'), b=clerkFixture('user_native_onboarding_b')
  const cfg=configuration({applicationId:db.binding.applicationId})
  const raw=a.client.users.getUser
  a.client.users.getUser=async id=>({...await raw(id),primaryEmailAddressId:'primary',emailAddresses:[{id:'primary',verification:{status:a.unverified?'unverified':'verified'}}]})
  await createIdentityProvisioner(db.options(a)).ensureAccount(a.request('POST'))
  await createIdentityProvisioner(db.options(b)).ensureAccount(b.request('POST'))
  await db.admin.query(fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/profile/007-organisation-onboarding.sql',import.meta.url),'utf8'))
  await db.admin.query("INSERT INTO profitia_profile.organisation_onboarding_installation VALUES(true,'1.0.0',$1)",[organisationOnboardingSchemaDigest()])
  await db.admin.query("INSERT INTO profitia_profile.organisation_onboarding_policies VALUES('identity_b1_runtime',false)")
  await db.admin.query('GRANT EXECUTE ON FUNCTION profitia_profile.organisation_onboarding_descriptor(),profitia_profile.organisation_onboarding_read(),profitia_profile.organisation_onboarding_save(bigint,jsonb) TO identity_b1_runtime')
  const options={...db.options(a),configuration:cfg,onboardingSchemaDigest:organisationOnboardingSchemaDigest(),transact:accountTransactions(db.pool),deploymentId:'fixture',configurationVersion:'fixture'}
  const surface=createOrganisationDraftSurface(options)
  const handler=createHttpHandler({configuration:cfg},{},null,null,null,null,null,null,null,surface)
  const path='/v1/account/organisation-onboarding'
  const req=(method='GET',body,headers={},suffix='')=>new Request(cfg.origin+path+suffix,{method,headers:{authorization:'Bearer synthetic-fixture',...(method==='POST'?{origin:cfg.origin,'content-type':'application/json'}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})})
  await t.test('disabled SQL policy fails closed; disabled host does not expose a draft',async()=>{
    await assert.rejects(surface.ready())
    assert.equal((await handler(req())).status,403)
    assert.equal((await createHttpHandler({configuration:cfg},{})(req())).status,503)
    assert.throws(()=>createOrganisationDraftSurface({...options,onboardingSchemaDigest:'0'.repeat(64)}))
    await db.admin.query('UPDATE profitia_profile.organisation_onboarding_policies SET enabled=true')
    await surface.ready()
  })
  await t.test('versioned response survives a new adapter and does not create organisation or grants',async()=>{
    const initial=await handler(req());assert.equal(initial.status,200)
    const value=await initial.json();assert.equal(value.version,'0');assert.deepEqual(value.answers,{})
    const saved=await handler(req('POST',{expectedVersion:'0',patch:{nip:'PL123-456-32-18'}}))
    assert.equal(saved.status,200);const result=await saved.json()
    assert.equal(result.version,'1');assert.deepEqual(result.answers,{nip:'1234563218',companySelection:null})
    const resumed=await createOrganisationDraftSurface(options).read(req());assert.deepEqual(resumed,result)
    assert.equal(saved.headers.get('cache-control'),'private, no-store')
    assert.equal(saved.headers.get('referrer-policy'),'no-referrer')
    assert.equal(saved.headers.get('access-control-allow-origin'),null)
    for(const table of ['organisations','memberships','permission_grants','product_grants']) assert.equal((await db.admin.query('SELECT count(*) FROM profitia_access.'+table)).rows[0].count,'0')
  })
  await t.test('stale writes conflict and concurrent answers cannot silently overwrite',async()=>{
    assert.equal((await handler(req('POST',{expectedVersion:'0',patch:{slug:'stale'}}))).status,409)
    const results=await Promise.all(['company-one','company-two'].map(slug=>handler(req('POST',{expectedVersion:'1',patch:{slug}}))))
    assert.deepEqual(results.map(r=>r.status).sort(),[200,409])
    assert.equal((await (await handler(req())).json()).version,'2')
  })
  await t.test('server-owned identity, company data and malformed answers cannot be injected',async()=>{
    for(const input of [{expectedVersion:'2',patch:{userId:'foreign'}},{expectedVersion:'2',patch:{organisationId:'foreign'}},{expectedVersion:'2',patch:{company:{legalName:'invented'}}},{expectedVersion:'2',patch:{memberRole:'OWNER'}},{expectedVersion:'2',patch:{nip:'12345678'}},{expectedVersion:'2',patch:{industry:{id:'invented'}}},{expectedVersion:'2',patch:{categories:[]}},{expectedVersion:'2',patch:{slug:'admin'}},{expectedVersion:'9223372036854775807',patch:{slug:'valid'}},{expectedVersion:2,patch:{slug:'valid'}},{expectedVersion:'2',patch:{slug:'valid'},userId:'foreign'},{}]) assert.equal((await handler(req('POST',input))).status,400)
    assert.equal((await (await handler(req())).json()).version,'2')
  })
  await t.test('receiver, CSRF, methods and query limits are enforced before persistence',async()=>{
    for(const method of ['PUT','PATCH','DELETE']) assert.equal((await handler(req(method))).status,405)
    assert.equal((await handler(req('GET',undefined,{},'?userId=foreign'))).status,404)
    assert.equal((await handler(req('POST',{expectedVersion:'2',patch:{slug:'valid'}},{origin:cfg.targets.sg2.origin}))).status,403)
    assert.equal((await handler(req('POST',{expectedVersion:'2',patch:{slug:'valid'}},{'content-type':'text/plain'}))).status,400)
    const huge=new Request(cfg.origin+path,{method:'POST',headers:{origin:cfg.origin,'content-type':'application/json'},body:JSON.stringify({expectedVersion:'2',patch:{slug:'x'.repeat(5000)}})})
    assert.equal((await handler(huge)).status,400)
  })
  await t.test('another account sees its own empty draft; revoked or unverified identity cannot read',async()=>{
    const other=createOrganisationDraftSurface({...options,client:b.client})
    const otherRaw=b.client.users.getUser
    b.client.users.getUser=async id=>({...await otherRaw(id),primaryEmailAddressId:'primary',emailAddresses:[{id:'primary',verification:{status:'verified'}}]})
    assert.equal((await other.read(req())).version,'0')
    a.active=false;assert.notEqual((await handler(req())).status,200);a.active=true
    a.unverified=true;assert.notEqual((await handler(req())).status,200);a.unverified=false
    a.origin=cfg.targets.sg2.origin;assert.notEqual((await handler(req())).status,200);a.origin=cfg.origin
  })
  await t.test('ordinary SQL login cannot bypass backend attestation',async()=>{
    await assert.rejects(db.pool.query('SELECT profitia_profile.organisation_onboarding_read()'))
    await assert.rejects(db.pool.query("SELECT profitia_profile.organisation_onboarding_save(2,'{}')"))
  })
  await t.test('native Node receiver serves the same real persisted draft',async()=>{
    const server=createNodeServer(cfg.origin,handler)
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
    try {
      const response=await new Promise((resolve,reject)=>{const request=send({host:'127.0.0.1',port:server.address().port,path,headers:{host:new URL(cfg.origin).host,authorization:'Bearer synthetic-fixture'}},res=>{let body='';res.setEncoding('utf8');res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,value:JSON.parse(body)}))});request.on('error',reject);request.end()})
      assert.equal(response.status,200);assert.equal(response.value.version,'2')
    } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
  })
  const events=(await db.admin.query("SELECT event FROM profitia_access.security_events WHERE event->>'resourceId'='current-organisation-onboarding'")).rows
  assert(events.length>0);assert(!JSON.stringify(events).includes('1234563218'))
})
