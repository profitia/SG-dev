import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash,randomBytes} from 'node:crypto'
import {createIdentityProvisioner} from '../src/identity-provisioning.mjs'
import {createIdentityRenewalSql,renewalSchemaDigest,renewalSchemaUrl} from '../src/identity-renewal.mjs'
import {profileSchemaDigest} from '../src/user-profile.mjs'
import {clerkFixture,postgresFixture} from './fixtures/identity-profile-postgres.mjs'

test('additive renewal preserves the accepted immutable B1 migration and defaults off',()=>{
  assert.equal(profileSchemaDigest(),'a43e146cee1ad5e5b95751781f691695b66e061b8eb0764220ebf25c44f52af3')
  assert.equal(renewalSchemaDigest(),createHash('sha256').update(fs.readFileSync(new URL(renewalSchemaUrl))).digest('hex'))
  for(const value of [undefined,null,'','latest','f'.repeat(63)])assert.throws(()=>createIdentityRenewalSql({renewalSchemaDigest:value}))
})

test('real isolated ordinary-role B1 renewal and returning-user acceptance',async t=>{
  const db=await postgresFixture();t.after(()=>db.close())
  await db.admin.query('BEGIN')
  await db.admin.query(fs.readFileSync(new URL(renewalSchemaUrl),'utf8'))
  await db.admin.query("INSERT INTO profitia_profile.binding_renewal_installation VALUES(true,'1.0.0',$1)",[renewalSchemaDigest()])
  await db.admin.query(`GRANT EXECUTE ON FUNCTION profitia_profile.binding_renewal_descriptor(),
    profitia_profile.binding_renewal_metadata(text,text,bigint,bigint,text),
    profitia_profile.renew_binding(text,text,text,text,bigint,bigint,bigint,text) TO identity_b1_runtime`)
  await db.admin.query('COMMIT')
  const legacy=f=>createIdentityProvisioner(db.options(f)).ensureAccount(f.request('POST'))
  const provision=(f,patch={})=>createIdentityProvisioner({...db.options(f),renewalSchemaDigest:renewalSchemaDigest(),...patch}).ensureAccount(f.request('POST'))
  const snapshot=async f=>(await db.admin.query(`SELECT e.user_id,e.expires_at,e.version,a.version AS account_version,
    (SELECT count(*)::int FROM profitia_access.security_events) AS audit_count
    FROM profitia_access.external_identities e JOIN profitia_access.accounts a USING(user_id) WHERE e.subject=$1`,[f.subject])).rows[0]
  const setExpiry=(f,seconds)=>db.admin.query("UPDATE profitia_access.external_identities SET expires_at=clock_timestamp()+$2*interval '1 second' WHERE subject=$1",[f.subject,seconds])
  const policy=(renew=true,recover=true,age=604800000)=>db.admin.query('UPDATE profitia_profile.runtime_policies SET allow_binding_renewal=$1,allow_expired_binding_recovery=$2,expired_recovery_max_age_ms=$3',[renew,recover,age])
  const seed=async suffix=>{const f=clerkFixture('user_renewal_'+suffix);f.userId=(await legacy(f)).userId;return f}
  await t.test('new policy defaults are disabled, while first registration stays idempotent',async()=>{
    const p=(await db.admin.query('SELECT allow_binding_renewal,allow_expired_binding_recovery,expired_recovery_max_age_ms FROM profitia_profile.runtime_policies')).rows[0]
    assert.deepEqual(p,{allow_binding_renewal:false,allow_expired_binding_recovery:false,expired_recovery_max_age_ms:0})
    const f=clerkFixture('user_renewal_first'),results=await Promise.all(Array.from({length:4},()=>provision(f)))
    assert.equal(new Set(results.map(v=>v.userId)).size,1)
    const r=(await db.admin.query('SELECT count(*)::int n FROM profitia_access.external_identities WHERE subject=$1',[f.subject])).rows[0]
    assert.equal(r.n,1)
  })
  await t.test('far-from-expiry ACTIVE lookup creates no profile or audit and changes no binding',async()=>{
    const f=await seed('far');await setExpiry(f,120)
    await db.admin.query('DELETE FROM profitia_profile.user_profiles WHERE user_id=$1',[f.userId])
    const before=await snapshot(f);assert.equal((await provision(f)).userId,f.userId);assert.deepEqual(await snapshot(f),before)
    assert.equal((await db.admin.query('SELECT count(*)::int n FROM profitia_profile.user_profiles WHERE user_id=$1',[f.userId])).rows[0].n,0)
  })
  await t.test('on-demand near-expiry renewal keeps stable identity and caps expiry by fresh provider proof',async()=>{
    await policy();const f=await seed('near');await setExpiry(f,5);const before=await snapshot(f)
    assert.equal((await provision(f)).userId,f.userId);const after=await snapshot(f)
    assert(after.expires_at>before.expires_at);assert(after.expires_at.getTime()<=Date.now()+60000)
    assert(BigInt(after.version)>BigInt(before.version));assert.equal(after.account_version,before.account_version)
    assert.equal(after.audit_count,before.audit_count+1)
  })
  await t.test('expired ACTIVE recovery is explicit and does not create another account or profile',async()=>{
    const f=await seed('return');await setExpiry(f,-3600);const before=await snapshot(f)
    const result=await Promise.all(Array.from({length:5},()=>provision(f)));assert(result.every(v=>v.userId===f.userId))
    const after=await snapshot(f);assert(after.expires_at.getTime()>Date.now());assert.equal(after.audit_count,before.audit_count+1)
    const counts=(await db.admin.query(`SELECT (SELECT count(*)::int FROM profitia_access.organisations) organisations,
      (SELECT count(*)::int FROM profitia_access.memberships) memberships,(SELECT count(*)::int FROM profitia_access.product_grants) grants`)).rows[0]
    assert.deepEqual(counts,{organisations:0,memberships:0,grants:0})
  })
  await t.test('disabled renewal, disabled recovery and old expired mappings deny without repair',async()=>{
    const f=await seed('policy');await setExpiry(f,-1)
    for(const settings of [[false,false,0],[true,false,0],[true,true,1000]]){
      await policy(...settings);await setExpiry(f,-3);const before=await snapshot(f)
      await assert.rejects(provision(f));assert.deepEqual(await snapshot(f),before)
    }
    await policy()
  })
  await t.test('legacy API still denies expired bindings even when the new policy is enabled',async()=>{
    const f=await seed('legacy');await setExpiry(f,-1);const before=await snapshot(f)
    await assert.rejects(legacy(f));assert.deepEqual(await snapshot(f),before)
  })
  await t.test('revoked binding and disabled account are never restored',async()=>{
    for(const change of ['binding','account']){
      const f=await seed(change);await setExpiry(f,-1)
      await db.admin.query(change==='binding'?"UPDATE profitia_access.external_identities SET status='REVOKED' WHERE user_id=$1":"UPDATE profitia_access.accounts SET status='DISABLED' WHERE user_id=$1",[f.userId])
      const before=await snapshot(f);await assert.rejects(provision(f));assert.deepEqual(await snapshot(f),before)
    }
  })
  await t.test('revoked provider session, blocked provider user and foreign issuer deny',async()=>{
    for(const mutate of [f=>f.active=false,f=>f.banned=true,f=>f.issuer='https://foreign.example.test']){
      const f=await seed('provider_'+Math.random().toString(16).slice(2));await setExpiry(f,-1);const before=await snapshot(f)
      mutate(f);await assert.rejects(provision(f));assert.deepEqual(await snapshot(f),before)
    }
  })
  await t.test('provider revocation between mutation and COMMIT rolls back the full renewal',async()=>{
    const f=await seed('midflight');await setExpiry(f,-1);const before=await snapshot(f),get=f.client.sessions.getSession;let calls=0
    f.client.sessions.getSession=async id=>{const s=await get(id);return ++calls===2?{...s,status:'revoked'}:s}
    await assert.rejects(provision(f));assert.deepEqual(await snapshot(f),before)
  })
  await t.test('account switch between mutation and COMMIT cannot confirm the old identity',async()=>{
    const f=await seed('switch');await setExpiry(f,-1);const before=await snapshot(f),get=f.client.users.getUser;let calls=0
    f.client.users.getUser=async id=>{const u=await get(id);return ++calls===2?{...u,id:'user_switched'}:u}
    await assert.rejects(provision(f));assert.deepEqual(await snapshot(f),before)
  })
  await t.test('bad key, base digest, renewal digest and login binding cannot mutate expiry',async()=>{
    const f=await seed('configuration');await setExpiry(f,-1);const before=await snapshot(f)
    for(const patch of [{proofKey:randomBytes(32)},{schemaDigest:'e'.repeat(64)},{renewalSchemaDigest:'f'.repeat(64)},
      {binding:{...db.binding,role:'identity_b1_foreign'}}]){await assert.rejects(provision(f,patch));assert.deepEqual(await snapshot(f),before)}
  })
  await t.test('audit insertion failure atomically restores binding version, deadline and audit',async()=>{
    const f=await seed('audit');await setExpiry(f,-1);const before=await snapshot(f)
    await db.admin.query("CREATE FUNCTION profitia_profile.renewal_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'synthetic failure'; END$$; CREATE TRIGGER renewal_test_failure BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION profitia_profile.renewal_test_fail()")
    try{await assert.rejects(provision(f))}finally{await db.admin.query('DROP TRIGGER renewal_test_failure ON profitia_access.security_events')}
    assert.deepEqual(await snapshot(f),before)
  })
  await t.test('ordinary SQL cannot read policy/key/installation, change data, assume owner or disable RLS',async()=>{
    for(const sql of ['SELECT * FROM profitia_profile.runtime_policies','SELECT * FROM profitia_profile.binding_renewal_installation',
      "UPDATE profitia_access.external_identities SET status='ACTIVE'",'SET ROLE profitia_access_owner',
      'ALTER TABLE profitia_profile.binding_renewal_installation DISABLE ROW LEVEL SECURITY'])await assert.rejects(db.independentQuery(sql))
    assert.equal((await db.admin.query("SELECT relrowsecurity AND relforcerowsecurity ok FROM pg_class WHERE oid='profitia_profile.binding_renewal_installation'::regclass")).rows[0].ok,true)
  })
  await t.test('unsigned direct calls and replayed transaction signatures cannot recover a binding',async()=>{
    const f=await seed('replay');await setExpiry(f,-1);const before=await snapshot(f);let saved
    const observed={...db.options(f),renewalSchemaDigest:renewalSchemaDigest(),transact:async work=>db.transact(async s=>{
      await work({...s,query:async(sql,values)=>{if(sql.includes('profitia_profile.renew_binding('))saved=values;return s.query(sql,values)}})
      throw Error('intentional rollback')
    })}
    await assert.rejects(createIdentityProvisioner(observed).ensureAccount(f.request('POST')));assert(saved)
    await assert.rejects(db.independentQuery('SELECT profitia_profile.renew_binding($1,$2,$3,$4,$5::bigint,$6::bigint,$7::bigint,$8)',saved),e=>e.code==='PT403')
    assert.deepEqual(await snapshot(f),before)
    await assert.rejects(db.independentQuery('SELECT profitia_profile.binding_renewal_metadata($1,$2,$3::bigint,$4::bigint,$5)',[f.issuer,f.subject,Date.now()+60000,Date.now()+3000,'0'.repeat(64)]),e=>e.code==='PT403')
  })
  await t.test('renewal migration rerun fails closed, retaining the original B1 installation',async()=>{
    await db.admin.query('BEGIN')
    try{await assert.rejects(db.admin.query(fs.readFileSync(new URL(renewalSchemaUrl),'utf8')))}finally{await db.admin.query('ROLLBACK')}
    assert.equal((await db.admin.query('SELECT schema_digest FROM profitia_profile.installation')).rows[0].schema_digest,profileSchemaDigest())
    assert.equal((await db.admin.query('SELECT schema_digest FROM profitia_profile.binding_renewal_installation')).rows[0].schema_digest,renewalSchemaDigest())
  })
  await t.test('stale authority revision or binding version refuses CAS before any mutation',async()=>{
    const f=await seed('cas');await setExpiry(f,-1);const before=await snapshot(f)
    for(const field of [2,4]){
      let denied=false
      const options={...db.options(f),renewalSchemaDigest:renewalSchemaDigest(),transact:work=>db.transact(s=>work({...s,query:async(sql,values)=>{
        if(sql.includes('profitia_profile.renew_binding(')){
          values=[...values];values[field]=field===2?values[field]+':stale':Number(values[field])+1
          try{return await s.query(sql,values)}catch(error){denied=error.code==='PT409';throw error}
        }
        return s.query(sql,values)
      }}))}
      await assert.rejects(createIdentityProvisioner(options).ensureAccount(f.request('POST')));assert(denied)
      assert.deepEqual(await snapshot(f),before)
    }
  })
  await t.test('a proof that cannot extend the current binding does not shorten it or create audit',async()=>{
    const f=await seed('short_proof');await setExpiry(f,10);const before=await snapshot(f),authenticate=f.client.authenticateRequest
    f.client.authenticateRequest=async(...args)=>{const state=await authenticate(...args),auth=state.toAuth();return {...state,toAuth:()=>({...auth,sessionClaims:{...auth.sessionClaims,exp:Math.floor(Date.now()/1000)+2}})}}
    await assert.rejects(provision(f));assert.deepEqual(await snapshot(f),before)
  })
})
