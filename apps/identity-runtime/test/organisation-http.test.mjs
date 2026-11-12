import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { request as send } from 'node:http'
import { configuration } from './fixtures.mjs'
import { createOrganisationHttpSurface, readOrganisationBootstrapOptIn } from '../dist/src/organisation-http.js'
import { accountTransactions } from '../dist/src/account-provisioning.js'
import { createHttpHandler } from '../dist/src/http-handler.js'
import { createNodeServer } from '../dist/src/node-server.js'
import { createIdentityProvisioner } from '../../../packages/platform-contracts/src/identity-provisioning.mjs'
import { createOrganisationOnboardingDraftBackend, organisationOnboardingSchemaDigest } from '../../../packages/platform-contracts/src/organisation-profile.mjs'
import { organisationBootstrapSchemaDigest } from '../../../packages/platform-contracts/src/organisation-bootstrap.mjs'
import { postgresFixture, clerkFixture } from '../../../packages/platform-contracts/test/fixtures/identity-profile-postgres.mjs'

test('native bootstrap opt-in requires both exact schemas and existing Identity dependencies', () => {
  const enabled = { IDENTITY_ORGANISATION_BOOTSTRAP_ENABLED:'true', IDENTITY_RUNTIME_ENABLED:'true', IDENTITY_SELF_SERVICE_ENABLED:'true',
    IDENTITY_ORGANISATION_DRAFT_ENABLED:'true', IDENTITY_ORGANISATION_DRAFT_SCHEMA_DIGEST:organisationOnboardingSchemaDigest(),
    IDENTITY_ORGANISATION_BOOTSTRAP_SCHEMA_DIGEST:organisationBootstrapSchemaDigest() }
  assert.equal(readOrganisationBootstrapOptIn({}), null)
  assert.equal(readOrganisationBootstrapOptIn({IDENTITY_ORGANISATION_BOOTSTRAP_ENABLED:'false'}), null)
  assert.equal(readOrganisationBootstrapOptIn(enabled), organisationBootstrapSchemaDigest())
  for (const patch of [{IDENTITY_ORGANISATION_BOOTSTRAP_ENABLED:'yes'}, {IDENTITY_RUNTIME_ENABLED:'false'},
    {IDENTITY_SELF_SERVICE_ENABLED:undefined}, {IDENTITY_ORGANISATION_DRAFT_ENABLED:'false'},
    {IDENTITY_ORGANISATION_DRAFT_SCHEMA_DIGEST:'0'.repeat(64)}, {IDENTITY_ORGANISATION_BOOTSTRAP_SCHEMA_DIGEST:'0'.repeat(64)}])
    assert.throws(() => readOrganisationBootstrapOptIn({...enabled,...patch}))
})

test('native creation HTTP preserves real atomic SQL, replay, duplicate and identity boundaries', {timeout:60000}, async t => {
  const db=await postgresFixture(); t.after(()=>db.close())
  for (const name of ['007-organisation-onboarding.sql','008-organisation-create.sql'])
    await db.admin.query(fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/profile/'+name,import.meta.url),'utf8'))
  await db.admin.query("INSERT INTO profitia_profile.organisation_onboarding_installation VALUES(true,'1.0.0',$1)",[organisationOnboardingSchemaDigest()])
  await db.admin.query("INSERT INTO profitia_profile.organisation_onboarding_policies VALUES('identity_b1_runtime',true)")
  await db.admin.query("INSERT INTO profitia_profile.organisation_bootstrap_installation VALUES(true,'1.0.0',$1)",[organisationBootstrapSchemaDigest()])
  await db.admin.query("INSERT INTO profitia_profile.organisation_bootstrap_policies(login_role,policy_id,source_ref,expires_at,membership_expires_at,initial_permissions) VALUES('identity_b1_runtime',gen_random_uuid(),'synthetic-native-bootstrap',clock_timestamp()+interval '1 hour',clock_timestamp()+interval '1 day',$1::jsonb)",
    [JSON.stringify([{operation:'category.read',feature:'category'},{operation:'category.write',feature:'category'}])])
  await db.admin.query('GRANT EXECUTE ON FUNCTION profitia_profile.organisation_onboarding_descriptor(),profitia_profile.organisation_onboarding_read(),profitia_profile.organisation_onboarding_save(bigint,jsonb),profitia_profile.organisation_bootstrap_descriptor(),profitia_profile.organisation_bootstrap_lock(),profitia_profile.organisation_bootstrap_state(uuid,bigint,bigint,text),profitia_profile.organisation_bootstrap_create(text,bigint,text,uuid) TO identity_b1_runtime')
  const actors=['user_native_create_a','user_native_create_b'].map(id=>clerkFixture(id))
  for (const actor of actors) {
    const raw=actor.client.users.getUser
    actor.client.users.getUser=async id=>({...await raw(id),primaryEmailAddressId:'primary',emailAddresses:[{id:'primary',emailAddress:id+'@example.test',verification:{status:actor.unverified?'unverified':'verified'}}]})
    await createIdentityProvisioner(db.options(actor)).ensureAccount(actor.request('POST'))
    await createOrganisationOnboardingDraftBackend(db.options(actor)).saveCurrentDraft(actor.request('POST'),{expectedVersion:'0',patch:{
      nip:'1234563218',slug:actor===actors[0]?'native-first':'native-second',companySelection:{sourceRef:'synthetic-stored-registry',version:'snapshot-1'},
      industry:{id:'construction'},categories:[{catalogueId:'construction.asphalt'}],teamRange:'1-5'}})
  }
  const cfg=configuration({applicationId:db.binding.applicationId})
  let sourceReads=0, snapshotVersion='snapshot-1'
  const make=actor=>createOrganisationHttpSurface({...db.options(actor),configuration:cfg,bootstrapSchemaDigest:organisationBootstrapSchemaDigest(),
    transact:accountTransactions(db.pool),deploymentId:'synthetic-native',configurationVersion:'synthetic-native-v1',
    readVerifiedCompany:async ({nip,context})=>{
      sourceReads++; assert.equal(context.mode,'BOOTSTRAP'); assert.equal(context.organisationId,null)
      return {sourceRef:'synthetic-stored-registry',version:snapshotVersion,company:{entityType:'COMPANY',country:'PL',nip,krs:'0000123456',regon:'123456789',
        legalName:'Synthetic native company S.A.',address:'ul. Przykładowa 1, Warszawa',postalCode:'00-001'}}
    }})
  const surface=make(actors[0]), path='/v1/account/organisation-onboarding/complete'
  const handler=createHttpHandler({configuration:cfg},{},null,null,null,null,null,null,null,null,surface)
  const request=(input,method='POST',headers={},suffix='')=>new Request(cfg.origin+path+suffix,{method,headers:{
    ...(method==='POST'?{origin:cfg.origin,'content-type':'application/json'}:{}),...headers},...(input===undefined?{}:{body:JSON.stringify(input)})})
  const command={commandId:randomUUID(),draftVersion:'1'}
  await t.test('missing native surface and disabled SQL policy cannot create an organisation',async()=>{
    assert.equal((await createHttpHandler({configuration:cfg},{})(request(command))).status,503)
    await assert.rejects(surface.ready())
    assert.notEqual((await handler(request(command))).status,200)
    assert.equal((await db.admin.query('SELECT count(*) FROM profitia_access.organisations')).rows[0].count,'0')
    await db.admin.query('UPDATE profitia_profile.organisation_bootstrap_policies SET enabled=true')
    await surface.ready()
  })
  await t.test('strict command, receiver and CSRF validation precede source reads and writes',async()=>{
    const before=sourceReads
    for(const value of [{...command,userId:'foreign'},{...command,organisationId:randomUUID()},{...command,company:{legalName:'forged'}},
      {...command,commandId:'invalid'},{...command,draftVersion:1},{...command,draftVersion:'01'},{...command,draftVersion:'9223372036854775807'},{}])
      assert.equal((await handler(request(value))).status,400)
    let invoked=false
    await assert.rejects(surface.complete(request(),{get commandId(){invoked=true;return randomUUID()},draftVersion:'1'}),e=>e.status===400)
    assert.equal(invoked,false)
    for(const method of ['GET','PUT','PATCH','DELETE'])assert.equal((await handler(request(undefined,method))).status,405)
    assert.equal((await handler(request(command,'POST',{},'?organisationId=foreign'))).status,404)
    assert.equal((await handler(request(command,'POST',{origin:cfg.targets.sg2.origin}))).status,403)
    assert.equal((await handler(request(command,'POST',{'content-type':'text/plain'}))).status,400)
    assert.equal(sourceReads,before)
  })
  await t.test('changed server snapshot requires reconfirmation before organisation creation',async()=>{
    snapshotVersion='snapshot-2'
    assert.deepEqual(await (await handler(request(command))).json(),{status:'COMPANY_CHANGED'})
    assert.equal((await db.admin.query('SELECT count(*) FROM profitia_access.organisations')).rows[0].count,'0')
    snapshotVersion='snapshot-1'
  })
  let created
  await t.test('native completion commits one organisation and owner with pending package',async()=>{
    const response=await handler(request(command));assert.equal(response.status,200);created=await response.json()
    assert.equal(created.status,'CREATED');assert.equal(created.slug,'native-first');assert.equal(created.activation,'PENDING_PACKAGE')
    assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('referrer-policy'),'no-referrer')
    assert.equal(response.headers.get('access-control-allow-origin'),null)
    for(const table of ['organisations','memberships'])assert.equal((await db.admin.query('SELECT count(*) FROM profitia_access.'+table)).rows[0].count,'1')
    assert.equal((await db.admin.query('SELECT count(*) FROM profitia_access.product_grants')).rows[0].count,'0')
    assert.equal((await db.admin.query('SELECT count(*) FROM profitia_profile.organisation_categories')).rows[0].count,'1')
    assert.equal((await db.admin.query('SELECT count(*) FROM profitia_profile.user_procurement_categories')).rows[0].count,'1')
  })
  await t.test('fresh adapter replay returns committed receipt without another source read',async()=>{
    const before=sourceReads
    const replay=createHttpHandler({configuration:cfg},{},null,null,null,null,null,null,null,null,make(actors[0]))
    assert.deepEqual(await (await replay(request(command))).json(),created);assert.equal(sourceReads,before)
    assert.equal((await replay(request({...command,draftVersion:'2'}))).status,409)
    const duplicate=createHttpHandler({configuration:cfg},{},null,null,null,null,null,null,null,null,make(actors[1]))
    assert.deepEqual(await (await duplicate(request({commandId:randomUUID(),draftVersion:'1'}))).json(),{status:'ORGANISATION_ALREADY_EXISTS'})
    assert.equal((await db.admin.query('SELECT count(*) FROM profitia_access.memberships')).rows[0].count,'1')
  })
  await t.test('unverified and revoked account cannot replay an existing creation',async()=>{
    actors[0].unverified=true;assert.notEqual((await handler(request(command))).status,200);actors[0].unverified=false
    actors[0].active=false;assert.notEqual((await handler(request(command))).status,200);actors[0].active=true
  })
  await t.test('ordinary login cannot forge SQL creation or read private organisation rows',async()=>{
    await assert.rejects(db.pool.query('SELECT * FROM profitia_profile.organisation_profiles'))
    await assert.rejects(db.pool.query("SELECT profitia_profile.organisation_bootstrap_create('{}',1,$1,gen_random_uuid())",['0'.repeat(64)]))
  })
  await t.test('native Node receiver returns the same persisted receipt after a retry',async()=>{
    const server=createNodeServer(cfg.origin,handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
    try {
      const value=await new Promise((resolve,reject)=>{const req=send({host:'127.0.0.1',port:server.address().port,path,method:'POST',
        headers:{host:new URL(cfg.origin).host,origin:cfg.origin,'content-type':'application/json'}},res=>{let body='';res.setEncoding('utf8');res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(body)}))});req.on('error',reject);req.end(JSON.stringify(command))})
      assert.equal(value.status,200);assert.deepEqual(value.body,created)
    }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
  })
})
