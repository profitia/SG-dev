import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash, createHmac, randomBytes} from 'node:crypto'
import {postgresFixture, clerkFixture} from './fixtures/identity-profile-postgres.mjs'
import {createIdentityProvisioner} from '../src/identity-provisioning.mjs'
import {createUserProfileBackend} from '../src/user-profile.mjs'

test('email SQL producer: default denial, bounded service commands and reversible adoption', {timeout:60000}, async t => {
  const f=await postgresFixture(); t.after(()=>f.close())
  const sql=fs.readFileSync(new URL('../migrations/profile/003-email-delivery.sql',import.meta.url),'utf8')
  const key=randomBytes(32), instance='ins_producer1234', service='identity-email-producer-test'
  await f.admin.query('BEGIN'); await f.admin.query(sql)
  await f.admin.query('INSERT INTO profitia_profile.email_installation VALUES(true,$1)',[createHash('sha256').update(sql).digest('hex')])
  await f.admin.query(`INSERT INTO profitia_profile.email_policies(login_role,issuer,instance_id,service_id,proof_key)
    VALUES($1,'https://synthetic.clerk.accounts.dev',$2,$3,$4)`,[f.binding.role,instance,service,key])
  await f.admin.query('COMMIT')
  const command=body=>f.transact(async({query})=>{
    const tx=(await query('SELECT txid_current()::text AS tx')).rows[0].tx, until=Date.now()+4500, text=JSON.stringify(body)
    const signature=createHmac('sha256',key).update(['development',f.binding.applicationId,f.binding.role,service,instance,tx,until,text].join('\x1f')).digest('hex')
    return (await query('SELECT profitia_profile.email_command($1,$2,$3) AS result',[text,until,signature])).rows[0].result
  })
  const enqueue=(id,subject=null)=>command({op:'enqueue',emailId:'ema_'+id,eventId:'msg_'+id,fingerprint:'a'.repeat(64),providerSubject:subject,ciphertext:'synthetic-encrypted-payload-'.repeat(4),expiresAt:Date.now()+240000})
  await t.test('migration grants no runtime access and enabling requires an explicit policy',async()=>{
    await assert.rejects(()=>command({op:'claim'}),e=>e.code==='42501')
    await f.admin.query('GRANT EXECUTE ON FUNCTION profitia_profile.email_descriptor(),profitia_profile.email_command(text,bigint,text) TO identity_b1_runtime')
    await assert.rejects(()=>command({op:'claim'}),e=>e.code==='PT403')
    assert.equal((await f.pool.query('SELECT profitia_profile.email_descriptor() AS d')).rows[0].d,null)
    await f.admin.query('UPDATE profitia_profile.email_policies SET enabled=true')
    await assert.rejects(()=>f.pool.query('SELECT * FROM profitia_profile.email_outbox'),e=>e.code==='42501')
    await assert.rejects(()=>f.pool.query('SELECT profitia_profile.email_command($1,$2,$3)',['{"op":"claim"}',Date.now()+4000,'0'.repeat(64)]),e=>e.code==='PT403')
    await assert.rejects(()=>command({op:'claim',userId:'forged'}),e=>e.code==='PT403')
  })
  await t.test('concurrent intake deduplicates and unknown sends are never automatically repeated',async()=>{
    const results=await Promise.all(Array.from({length:5},()=>enqueue('duplicate123')))
    assert.equal(results.filter(r=>r.status==='queued').length,1)
    const claim=await command({op:'claim'}); assert.equal(claim.status,'leased')
    assert.deepEqual(await command({op:'begin',emailId:claim.emailId,token:claim.token}),{status:'sending',avatar:'neutral'})
    await f.admin.query("UPDATE profitia_profile.email_outbox SET lease_until=now()-interval '1 second'")
    assert.deepEqual(await command({op:'claim'}),{status:'empty'})
    assert.deepEqual((await f.admin.query('SELECT status,ciphertext FROM profitia_profile.email_outbox')).rows,[{status:'unknown',ciphertext:null}])
    assert.equal((await enqueue('duplicate123')).status,'duplicate')
  })
  await t.test('projection is exact, separately granted and does not renew human authority',async()=>{
    for (const [id,sex] of [['11111111-1111-4111-8111-111111111111','male'],['22222222-2222-4222-8222-222222222222','female']]) {
      await f.admin.query("INSERT INTO profitia_access.accounts(user_id,status) VALUES($1,'ACTIVE')",[id])
      await f.admin.query("INSERT INTO profitia_access.external_identities VALUES(gen_random_uuid(),'https://synthetic.clerk.accounts.dev',$1,$2,'ACTIVE',1,'synthetic',now()-interval '1 minute')",['user_'+sex+'1234',id])
      await f.admin.query('INSERT INTO profitia_profile.user_profiles(user_id,avatar_sex) VALUES($1,$2)',[id,sex])
      await f.admin.query('UPDATE profitia_profile.email_policies SET allow_avatar_projection=true')
      await enqueue(sex+'1234','user_'+sex+'1234'); const c=await command({op:'claim'})
      assert.equal((await command({op:'begin',emailId:c.emailId,token:c.token})).avatar,sex)
      await command({op:'settle',emailId:c.emailId,token:c.token,status:'accepted',providerId:'<synthetic@example.test>'})
      assert.equal((await f.admin.query('SELECT expires_at<now() AS expired FROM profitia_access.external_identities WHERE user_id=$1',[id])).rows[0].expired,true)
    }
    await f.admin.query("UPDATE profitia_access.accounts SET status='DISABLED'")
    await enqueue('disabled123','user_male1234'); const c=await command({op:'claim'})
    assert.equal((await command({op:'begin',emailId:c.emailId,token:c.token})).avatar,'neutral')
    await command({op:'settle',emailId:c.emailId,token:c.token,status:'rejected',providerId:null})
  })
  await t.test('kill switch and additive rollback preserve existing registration and profile operations',async()=>{
    await f.admin.query('UPDATE profitia_profile.email_policies SET enabled=false')
    await assert.rejects(()=>command({op:'claim'}),e=>e.code==='PT403')
    const fixture=clerkFixture('user_legacyproducer123'), options=f.options(fixture)
    const account=await createIdentityProvisioner(options).ensureAccount(fixture.request('POST'))
    const backend=createUserProfileBackend(options), profile=await backend.getCurrentUserProfile(fixture.request('GET'))
    assert.equal(profile.user_id,account.userId)
    assert.equal((await backend.updateCurrentUserProfile(fixture.request('PATCH'),{expectedVersion:profile.version,patch:{avatar_sex:'female'}})).avatar_sex,'female')
    assert.equal((await f.admin.query('SELECT count(*) FROM profitia_access.memberships')).rows[0].count,'0')
    const audit=JSON.stringify((await f.admin.query('SELECT * FROM profitia_profile.email_audit')).rows)
    assert.ok(!audit.includes('synthetic-encrypted-payload')); assert.ok(audit.includes('SERVICE'))
  })
})
