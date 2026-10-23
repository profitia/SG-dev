import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { randomBytes } from 'node:crypto'
import { createIdentityProvisioner } from '../src/identity-provisioning.mjs'
import { createUserProfileBackend, createAssistantAvatarBackend, ProfileConflict, profileSchemaDigest } from '../src/user-profile.mjs'
import { createAccessStore } from '../src/access-store.mjs'
import { createClerkIdentityAuthenticator } from '../src/identity-provider.mjs'
import { clerkFixture, postgresFixture } from './fixtures/identity-profile-postgres.mjs'

test('real ordinary PostgreSQL identity/profile acceptance',async t=>{
  const db=await postgresFixture();t.after(()=>db.close())
  const a=clerkFixture(),b=clerkFixture('user_synthetic_b')
  const provision=f=>createIdentityProvisioner(db.options(f)).ensureAccount(f.request('POST'))
  const backend=f=>createUserProfileBackend(db.options(f))
  let userA,userB,changed
  const counts=async()=> (await db.admin.query(`SELECT (SELECT count(*)::int FROM profitia_access.accounts) AS accounts,
    (SELECT count(*)::int FROM profitia_access.external_identities) AS bindings,(SELECT count(*)::int FROM profitia_profile.user_profiles) AS profiles,
    (SELECT count(*)::int FROM profitia_access.organisations) AS organisations,(SELECT count(*)::int FROM profitia_access.memberships) AS memberships,
    (SELECT count(*)::int FROM profitia_access.product_grants) AS grants`)).rows[0]

  await t.test('concurrent verified retry yields one UUID/binding/profile with no membership or grants',async()=>{
    const result=await Promise.all(Array.from({length:8},()=>provision(a)))
    userA=result[0].userId;assert.match(userA,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    assert.equal(new Set(result.map(x=>x.userId)).size,1)
    assert.deepEqual(await counts(),{accounts:1,bindings:1,profiles:1,organisations:0,memberships:0,grants:0})
    const row=(await db.admin.query('SELECT expires_at FROM profitia_access.external_identities WHERE user_id=$1',[userA])).rows[0]
    assert(Date.parse(row.expires_at)>Date.now());assert(Date.parse(row.expires_at)<=Date.now()+60000)
  })
  await t.test('same synthetic email across distinct provider subjects does not merge accounts',async()=>{
    userB=(await provision(b)).userId;assert.notEqual(userA,userB)
    assert.equal((await counts()).accounts,2)
  })
  await t.test('own ACCOUNT_SELF read, editable preferences, timestamps and concurrency',async()=>{
    const api=backend(a), initial=await api.getCurrentUserProfile(a.request('GET'))
    assert.equal(initial.user_id,userA);assert.equal(initial.version,'1');assert.equal(initial.avatar_sex,null);assert.equal(initial.phone,null)
    changed=await api.updateCurrentUserProfile(a.request('PATCH'),{expectedVersion:'1',patch:{avatar_sex:'female',job:' Engineer ',phone:'+1 (202) 555-0123'}})
    assert.equal(changed.version,'2');assert.equal(changed.phone,'+12025550123');assert.equal(changed.job,'Engineer')
    assert.equal(changed.created_at,initial.created_at);assert(Date.parse(changed.updated_at)>=Date.parse(initial.updated_at))
    await provision(a)
    assert.deepEqual(await api.ensureInitialUserProfile(a.request('POST')),changed)
    await assert.rejects(api.updateCurrentUserProfile(a.request('PATCH'),{expectedVersion:'1',patch:{job:'stale'}}),e=>e instanceof ProfileConflict)
    const concurrent=await Promise.allSettled(['A','B'].map(job=>api.updateCurrentUserProfile(a.request('PATCH'),{expectedVersion:'2',patch:{job}})))
    assert.equal(concurrent.filter(x=>x.status==='fulfilled').length,1)
    assert.equal(concurrent.filter(x=>x.status==='rejected'&&x.reason instanceof ProfileConflict).length,1)
    const latest=await api.getCurrentUserProfile(a.request('GET'))
    const cleared=await api.updateCurrentUserProfile(a.request('PATCH'),{expectedVersion:latest.version,patch:{job:null,phone:null,avatar_sex:null}})
    assert.equal(cleared.job,null);assert.equal(cleared.phone,null);assert.equal(cleared.avatar_sex,null)
  })
  await t.test('profile backend rejects caller-selected owners and system-field writes',async()=>{
    const api=backend(a)
    assert.throws(()=>api.updateCurrentUserProfile(a.request('PATCH'),{expectedVersion:'4',user_id:userB,patch:{job:'x'}}))
    assert.throws(()=>api.updateCurrentUserProfile(a.request('PATCH'),{expectedVersion:'4',patch:{user_id:userB}}))
    assert.equal((await backend(b).getCurrentUserProfile(b.request('GET'))).user_id,userB)
    assert.equal((await backend(b).getCurrentUserProfile(b.request('GET'))).job,null)
  })
  await t.test('avatar peer projection preserves E1, excludes other profile fields and cannot write',async()=>{
    const central=a.origin,peer='https://satellite.example.test',endpoint=central+'/v1/account/assistant-avatar'
    const options=db.options(a);options.identityApplication.authorizedParties.push(peer)
    options.identityApplication.bearerPeerReads=[{sourceOrigin:peer,targetOrigin:central,path:'/v1/account/assistant-avatar'}]
    assert.throws(()=>createUserProfileBackend(options))
    assert.throws(()=>createAssistantAvatarBackend({...options,identityApplication:{...options.identityApplication,bearerPeerReads:[{sourceOrigin:peer,targetOrigin:central,path:'/v1/account'}]}}))
    const api=createAssistantAvatarBackend(options),own=method=>new Request(endpoint,{method,headers:{origin:central}})
    const initial=await api.getAssistantAvatar(own('GET'))
    const saved=await api.updateAssistantAvatar(own('PATCH'),{expectedVersion:initial.version,avatarSex:'male'})
    assert.deepEqual(Object.keys(saved).sort(),['avatarSex','userId','version']);assert.equal(saved.avatarSex,'male')
    assert.equal((await backend(b).getCurrentUserProfile(b.request('GET'))).avatar_sex,null)
    a.origin=peer
    const request=new Request(endpoint,{headers:{authorization:'Bearer synthetic-fixture'}})
    assert.deepEqual(await api.getAssistantAvatar(request),saved)
    for(const method of ['PATCH','POST']) await assert.rejects(api.updateAssistantAvatar(new Request(endpoint,{method,headers:{origin:central,authorization:'Bearer synthetic-fixture'}}),{expectedVersion:saved.version,avatarSex:'female'}))
    for(const headers of [{authorization:'Bearer synthetic-fixture',origin:peer},{authorization:'Bearer synthetic-fixture',cookie:'untrusted=1'},{}])await assert.rejects(api.getAssistantAvatar(new Request(endpoint,{headers})))
    await assert.rejects(api.getAssistantAvatar(new Request(endpoint+'?userId='+userB,{headers:{authorization:'Bearer synthetic-fixture'}})))
    a.active=false;await assert.rejects(api.getAssistantAvatar(request));a.active=true;a.origin=central
    assert.equal((await api.getAssistantAvatar(own('GET'))).avatarSex,'male')
    await assert.rejects(api.updateAssistantAvatar(own('PATCH'),{expectedVersion:saved.version,avatarSex:'female',userId:userB}))
    await assert.rejects(api.updateAssistantAvatar(own('PATCH'),{expectedVersion:saved.version,avatarSex:'female',phone:'+12025550123'}))
  })
  await t.test('same organisation does not confer profile visibility',async()=>{
    const org='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    await db.admin.query("INSERT INTO profitia_access.organisations VALUES($1,'ACTIVE',1)",[org])
    await db.admin.query("INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at) VALUES($1,$2,'ACTIVE','synthetic-only',clock_timestamp()+interval '1 minute'),($1,$3,'ACTIVE','synthetic-only',clock_timestamp()+interval '1 minute')",[org,userA,userB])
    assert.equal((await backend(a).getCurrentUserProfile(a.request('GET'))).user_id,userA)
    assert.equal((await backend(b).getCurrentUserProfile(b.request('GET'))).user_id,userB)
  })
  await t.test('ordinary SQL cannot forge all GUCs, cross-user access, or replay a prior transaction scope',async()=>{
    const client=await db.pool.connect();let saved
    try {
      await client.query('BEGIN')
      const store=createAccessStore({binding:db.binding})
      let binding
      const auth=createClerkIdentityAuthenticator({client:a.client,application:db.options(a).identityApplication,resolveBinding:async key=>binding=await store.resolveBinding((s,v)=>client.query(s,v),key)})
      const actor=await auth(a.request('GET'))
      await store.lockAccess((s,v)=>client.query(s,v),{actor,identityBinding:binding,organisationId:null})
      const {createProfileSql}=await import('../src/identity-profile-sql.mjs')
      const sql=createProfileSql({binding:db.binding,issuer:a.issuer,schemaDigest:profileSchemaDigest(),proofKey:db.proofKey})
      const proof=await sql.attest((s,v)=>client.query(s,v),{operation:'account.settings.read',principal:userA,expiresAt:Date.parse(actor.expiresAt)})
      await client.query("SELECT set_config('profitia.profile.operation','account.settings.read',true),set_config('profitia.profile.expires_ms',$1,true),set_config('profitia.profile.signature',$2,true)",[String(proof.until),proof.signature])
      const visible=await client.query('SELECT user_id FROM profitia_profile.user_profiles');assert.deepEqual(visible.rows,[{user_id:userA}])
      const settings=await client.query("SELECT name,current_setting(name,true) AS value FROM unnest(ARRAY['profitia.user_id','profitia.organisation_id','profitia.application_id','profitia.environment','profitia.policy_version','profitia.transaction_id','profitia.scope_expires_at','profitia.identity_binding_version','profitia.profile.operation','profitia.profile.expires_ms','profitia.profile.signature']) AS name")
      saved=settings.rows
      // Even a freshly resolved FOREIGN binding plus fully forged legacy GUCs
      // cannot alter the signed profile principal.
      const foreign=await store.resolveBinding((s,v)=>client.query(s,v),{environment:'development',issuer:b.issuer,subject:b.subject})
      await client.query("SELECT set_config('profitia.user_id',$1,true),set_config('profitia.identity_binding_version',$2,true)",[userB,foreign.version])
      assert.equal((await client.query('SELECT user_id FROM profitia_profile.user_profiles')).rowCount,0)
      await client.query('ROLLBACK');await client.query('BEGIN')
      for(const s of saved)await client.query('SELECT set_config($1,$2,true)',[s.name,s.value])
      await client.query("SELECT set_config('profitia.transaction_id',txid_current()::text,true)")
      assert.equal((await client.query('SELECT user_id FROM profitia_profile.user_profiles')).rowCount,0)
      await client.query('ROLLBACK')
      assert.equal((await client.query('SELECT user_id FROM profitia_profile.user_profiles')).rowCount,0)
    } finally {await client.query('ROLLBACK');client.release()}
  })
  await t.test('missing/signed-out/revoked/foreign provider identity and database policy all deny',async()=>{
    const initial=await counts()
    for(const mutate of [f=>f.active=false,f=>f.banned=true,f=>f.issuer='https://foreign.example.test']){
      const f=clerkFixture('user_untrusted');mutate(f);await assert.rejects(provision(f))
    }
    await db.admin.query('UPDATE profitia_profile.runtime_policies SET allow_registration=false')
    await assert.rejects(provision(clerkFixture('user_registration_denied')))
    await db.admin.query('UPDATE profitia_profile.runtime_policies SET allow_registration=true,enabled=false')
    await assert.rejects(provision(a))
    await db.admin.query('UPDATE profitia_profile.runtime_policies SET enabled=true')
    assert.deepEqual(await counts(),initial)
  })
  await t.test('ordinary runtime has no admin/table writes or readable attestation policy/key',async()=>{
    const flags=(await db.independentQuery('SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolinherit FROM pg_roles WHERE rolname=current_user')).rows[0]
    assert(Object.values(flags).every(x=>x===false))
    for(const statement of ['SELECT * FROM profitia_profile.runtime_policies','SELECT * FROM profitia_access.accounts','SET ROLE profitia_access_owner',"UPDATE profitia_profile.user_profiles SET job='forged'",'ALTER TABLE profitia_profile.user_profiles DISABLE ROW LEVEL SECURITY'])await assert.rejects(db.independentQuery(statement))
    const r=await db.admin.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_profile' AND c.relkind='r'")
    assert(r.rows.every(x=>x.relrowsecurity&&x.relforcerowsecurity))
  })
  await t.test('wrong key, schema, environment and role binding fail closed',async()=>{
    for(const patch of [{proofKey:randomBytes(32)},{schemaDigest:'f'.repeat(64)},{binding:{...db.binding,environment:'staging'}},{binding:{...db.binding,role:'identity_b1_foreign'}}]){
      await assert.rejects(async()=>createIdentityProvisioner({...db.options(a),...patch}).ensureAccount(a.request('POST')))
    }
  })
  await t.test('rollback after profile insertion or audit failure leaves no orphan account/binding/profile',async()=>{
    const initial=await counts()
    await db.admin.query("CREATE FUNCTION profitia_profile.synthetic_fail() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'synthetic failure'; END$$; CREATE TRIGGER synthetic_failure BEFORE INSERT ON profitia_profile.user_profiles FOR EACH ROW EXECUTE FUNCTION profitia_profile.synthetic_fail()")
    await assert.rejects(provision(clerkFixture('user_failed_profile')))
    await db.admin.query('DROP TRIGGER synthetic_failure ON profitia_profile.user_profiles')
    assert.deepEqual(await counts(),initial)
    await db.admin.query('CREATE TRIGGER synthetic_failure BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION profitia_profile.synthetic_fail()')
    await assert.rejects(provision(clerkFixture('user_failed_audit')))
    await db.admin.query('DROP TRIGGER synthetic_failure ON profitia_access.security_events')
    assert.deepEqual(await counts(),initial)
  })
  await t.test('existing account with missing profile is idempotently initialized',async()=>{
    await db.admin.query('DELETE FROM profitia_profile.user_profiles WHERE user_id=$1',[userB])
    assert.equal(await backend(b).getCurrentUserProfile(b.request('GET')),null)
    const result=await backend(b).ensureInitialUserProfile(b.request('POST'));assert.equal(result.user_id,userB);assert.equal(result.version,'1')
  })
  await t.test('profile PII and low-entropy phone digests never enter canonical audit',async()=>{
    const {createHash}=await import('node:crypto')
    const text=JSON.stringify((await db.admin.query('SELECT event FROM profitia_access.security_events')).rows)
    assert(!text.includes('+12025550123'));assert(!text.includes('Engineer'))
    assert(!text.includes(createHash('sha256').update('+12025550123').digest('hex')))
  })
  await t.test('audit OUTCOME failure rolls profile update back in the real transaction',async()=>{
    const api=backend(a),before=await api.getCurrentUserProfile(a.request('GET'))
    await db.admin.query("CREATE FUNCTION profitia_profile.synthetic_outcome_fail() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.phase='OUTCOME' THEN RAISE EXCEPTION 'synthetic outcome failure'; END IF; RETURN NEW; END$$; CREATE TRIGGER synthetic_outcome_failure BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION profitia_profile.synthetic_outcome_fail()")
    try {await assert.rejects(api.updateCurrentUserProfile(a.request('PATCH'),{expectedVersion:before.version,patch:{job:'must roll back'}}))}
    finally {await db.admin.query('DROP TRIGGER synthetic_outcome_failure ON profitia_access.security_events')}
    assert.deepEqual(await api.getCurrentUserProfile(a.request('GET')),before)
  })
  await t.test('profile input is snapshotted before any provider/SQL await',async()=>{
    const api=backend(a),before=await api.getCurrentUserProfile(a.request('GET'))
    const input={expectedVersion:before.version,patch:{job:'captured'}}
    const result=api.updateCurrentUserProfile(a.request('PATCH'),input)
    input.patch.job='mutated';input.expectedVersion='999'
    assert.equal((await result).job,'captured')
  })
  await t.test('disabled, revoked, expired and conflicting bindings are not repaired',async()=>{
    for(const [subject,change]of [['user_disabled',"UPDATE profitia_access.accounts SET status='DISABLED' WHERE user_id=$1"],['user_revoked',"UPDATE profitia_access.external_identities SET status='REVOKED' WHERE user_id=$1"],['user_expired',"UPDATE profitia_access.external_identities SET expires_at=clock_timestamp()-interval '1 second' WHERE user_id=$1"]]){
      const f=clerkFixture(subject),user=(await provision(f)).userId;await db.admin.query(change,[user]);const initial=await counts();await assert.rejects(provision(f));assert.deepEqual(await counts(),initial)
    }
    await assert.rejects(db.admin.query('UPDATE profitia_access.external_identities SET subject=$1 WHERE user_id=$2',[a.subject,userB]),e=>e.code==='23505')
  })
  await t.test('migration rerun fails closed and leaves the original installation unchanged',async()=>{
    await db.admin.query('BEGIN')
    try {await assert.rejects(db.admin.query(fs.readFileSync(new URL('../migrations/profile/001-user-profile.sql',import.meta.url),'utf8')))}finally{await db.admin.query('ROLLBACK')}
    assert.equal((await db.admin.query('SELECT schema_digest FROM profitia_profile.installation')).rows[0].schema_digest,profileSchemaDigest())
  })
  await t.test('timed-out transaction cannot issue a late query after the connection returns to the pool',async()=>{
    let captured
    await assert.rejects(db.transact(async session=>{captured=session.query;await new Promise(resolve=>setTimeout(resolve,40));await session.query('SELECT 1')},{timeoutMs:5}))
    await assert.rejects(captured('SELECT 1'))
    assert.equal((await db.independentQuery('SELECT 1 AS ready')).rows[0].ready,1)
    await new Promise(resolve=>setTimeout(resolve,60))
  })
})
