import {languageSchemaDigest} from '../dist/src/communication-language.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {randomBytes, createHmac} from 'node:crypto'
import {postgresFixture,clerkFixture} from '../../../packages/platform-contracts/test/fixtures/identity-profile-postgres.mjs'
import {createIdentityProvisioner} from '../../../packages/platform-contracts/src/identity-provisioning.mjs'
import {createUserProfileBackend} from '../../../packages/platform-contracts/src/user-profile.mjs'
import {createEmailStore,emailSchemaDigest} from '../dist/src/email-store.js'
import {createClerkEmailVerifier} from '../dist/src/email-webhook.js'
import {createEmailRuntime} from '../dist/src/email-runtime.js'
import {createEmailRecipientVerifier} from '../dist/src/email-correlation.js'
import {createMailgunTransactionalSender} from '../dist/src/mailgun-delivery.js'
import {renderResolved,inlineAssetsForAvatar} from '../email-templates/render.mjs'

test('ordinary PostgreSQL role: encrypted durable queue, service scope, avatar projection and crash recovery', {timeout:60000}, async t => {
  const f=await postgresFixture(); t.after(()=>f.close())
  const proof=randomBytes(32), encryption=randomBytes(32)
  await f.admin.query('BEGIN')
  await f.admin.query(fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/profile/003-email-delivery.sql',import.meta.url),'utf8'))
  await f.admin.query('INSERT INTO profitia_profile.email_installation VALUES(true,$1)',[emailSchemaDigest()])
  await f.admin.query(`INSERT INTO profitia_profile.email_policies(login_role,issuer,instance_id,service_id,enabled,allow_avatar_projection,proof_key)
    VALUES('identity_b1_runtime','https://synthetic.clerk.accounts.dev','ins_test1234','identity-email-test',true,true,$1)`,[proof])
  await f.admin.query('GRANT EXECUTE ON FUNCTION profitia_profile.email_descriptor(),profitia_profile.email_command(text,bigint,text) TO identity_b1_runtime')
  await f.admin.query(fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/profile/004-communication-language.sql',import.meta.url),'utf8'))
  await f.admin.query('INSERT INTO profitia_profile.language_installation VALUES(true,$1)',[languageSchemaDigest()])
  await f.admin.query('GRANT EXECUTE ON FUNCTION profitia_profile.language_descriptor() TO identity_b1_runtime')
  await f.admin.query('UPDATE profitia_profile.email_policies SET allow_language_projection=true')
  await f.admin.query('COMMIT')
  const cfg={binding:f.binding,issuer:'https://synthetic.clerk.accounts.dev',instanceId:'ins_test1234',serviceId:'identity-email-test',schemaDigest:emailSchemaDigest(),proofKey:proof,encryptionKey:encryption,keyId:'test-key-1'}
  const store=createEmailStore(cfg,f.transact), event=(id='test0001',subject=null)=>({emailId:'ema_'+id,eventId:'msg_'+id,instanceId:cfg.instanceId,
    createdAt:Date.now(),expiresAt:Date.now()+240000,recipient:'synthetic@example.test',providerUserId:subject,emailAddressId:'idn_test1234',kind:'verification-code',otpCode:'654321'})
  await store.ready()
  await t.test('no raw table access, no unsigned commands, no forged GUC scope, exact binding required',async()=>{
    await assert.rejects(()=>f.pool.query('SELECT * FROM profitia_profile.email_outbox'),e=>e.code==='42501')
    await assert.rejects(()=>f.pool.query("SELECT profitia_profile.email_command($1,$2,$3)",['{"op":"claim"}',Date.now()+4000,'0'.repeat(64)]))
    await f.transact(async({query})=>{await query("SELECT set_config('profitia.actor_kind','SERVICE',true)");assert.equal((await query('SELECT count(*) FROM profitia_profile.user_profiles')).rows[0].count,'0')})
    for(const override of [{instanceId:'ins_other123'},{serviceId:'foreign-service'},{binding:{...f.binding,branchId:'foreign'}}])
      await assert.rejects(()=>createEmailStore({...cfg,...override},f.transact).ready())
    assert.throws(()=>createEmailStore({...cfg,encryptionKey:proof},f.transact))
  })
  await t.test('HMAC cannot be replayed in another transaction or changed command',async()=>{
    const body='{"op":"claim"}',until=Date.now()+4500
    const tx=(await f.pool.query('SELECT txid_current()::text AS tx')).rows[0].tx
    const sig=createHmac('sha256',proof).update(['development',f.binding.applicationId,f.binding.role,cfg.serviceId,cfg.instanceId,tx,until,body].join('\x1f')).digest('hex')
    await assert.rejects(()=>f.pool.query('SELECT profitia_profile.email_command($1,$2,$3)',[body,until,sig]))
  })
  await t.test('concurrent retries deduplicate; ID collision rejected; ciphertext contains no recipient or OTP',async()=>{
    const e=event(), results=await Promise.all(Array.from({length:8},()=>store.enqueue(e)))
    assert.equal(results.filter(x=>x==='queued').length,1)
    assert.equal(await store.enqueue({...e,eventId:'msg_second123'}),'duplicate')
    await assert.rejects(()=>store.enqueue({...e,otpCode:'000000'}))
    const row=(await f.admin.query('SELECT * FROM profitia_profile.email_outbox')).rows[0]
    assert.ok(!JSON.stringify(row).includes(e.otpCode));assert.ok(!JSON.stringify(row).includes(e.recipient))
    // New store instance represents process restart; no in-memory dedupe.
    const restarted=createEmailStore(cfg,f.transact), claims=await Promise.all([restarted.claim(),store.claim()])
    assert.equal(claims.filter(Boolean).length,1)
    const claim=claims.find(Boolean);assert.equal(claim.instruction.otpCode,e.otpCode)
    assert.equal((await restarted.begin(claim)).avatar,'neutral')
    await restarted.settle(claim,'accepted','<synthetic@mailgun.test>')
    await assert.rejects(()=>store.begin(claim))
    assert.equal((await f.admin.query('SELECT ciphertext FROM profitia_profile.email_outbox')).rows[0].ciphertext,null)
  })
  await t.test('male/female are exact current subject projections, not human sessions or email matches',async()=>{
    const male='11111111-1111-4111-8111-111111111111',female='22222222-2222-4222-8222-222222222222'
    for(const [uid,sex] of [[male,'male'],[female,'female']]){
      await f.admin.query("INSERT INTO profitia_access.accounts(user_id,status) VALUES($1,'ACTIVE')",[uid])
      await f.admin.query("INSERT INTO profitia_access.external_identities VALUES(gen_random_uuid(),$1,$2,$3,'ACTIVE',1,'synthetic',now()-interval '1 minute')",[cfg.issuer,'user_'+sex+'1234',uid])
      await f.admin.query('INSERT INTO profitia_profile.user_profiles(user_id,avatar_sex) VALUES($1,$2)',[uid,sex])
      const e=event(sex+'0001','user_'+sex+'1234');await store.enqueue(e);const c=await store.claim()
      assert.equal((await store.begin(c)).avatar,sex);await store.settle(c,'accepted','<test@mailgun.test>')
      // The service projection never renews the expired human binding.
      assert.equal((await f.admin.query('SELECT expires_at<now() AS expired FROM profitia_access.external_identities WHERE user_id=$1',[uid])).rows[0].expired,true)
    }
    for(const [id,sql] of [['disabled',"UPDATE profitia_access.accounts SET status='DISABLED' WHERE user_id=$1"],['revoked',"UPDATE profitia_access.external_identities SET status='REVOKED' WHERE user_id=$1"]]){
      await f.admin.query(sql,[male]);await store.enqueue(event(id+'1234','user_male1234'));const c=await store.claim()
      assert.equal((await store.begin(c)).avatar,'neutral');await store.settle(c,'rejected')
    }
    await f.admin.query('UPDATE profitia_profile.email_policies SET allow_avatar_projection=false')
    await store.enqueue(event('nogrant1','user_female1234'));const c=await store.claim()
    assert.equal((await store.begin(c)).avatar,'neutral');await store.settle(c,'rejected')
  })
  await t.test('lease recovery before sending is safe; crash after begin is unknown and never retried',async()=>{
    await store.enqueue(event('crash001'));const original=await store.claim()
    await f.admin.query("UPDATE profitia_profile.email_outbox SET lease_until=now()-interval '1 second' WHERE email_id=$1",[original.emailId])
    const recovered=await store.claim();assert.notEqual(original.token,recovered.token)
    await assert.rejects(()=>store.begin(original));await store.begin(recovered)
    await f.admin.query("UPDATE profitia_profile.email_outbox SET lease_until=now()-interval '1 second' WHERE email_id=$1",[original.emailId])
    assert.equal(await store.claim(),null)
    const r=(await f.admin.query('SELECT status,ciphertext FROM profitia_profile.email_outbox WHERE email_id=$1',[original.emailId])).rows[0]
    assert.deepEqual(r,{status:'unknown',ciphertext:null})
  })
  await t.test('expiry removes secrets; tampered ciphertext never reaches sender',async()=>{
    await store.enqueue(event('expired1'))
    await f.admin.query("UPDATE profitia_profile.email_outbox SET expires_at=now()-interval '1 second' WHERE email_id='ema_expired1'")
    assert.equal(await store.claim(),null)
    await store.enqueue(event('tampered'))
    await f.admin.query("UPDATE profitia_profile.email_outbox SET ciphertext=regexp_replace(ciphertext,'[A-Za-z0-9_-]$','!') WHERE email_id='ema_tampered'")
    await assert.rejects(()=>store.claim())
    const rows=(await f.admin.query("SELECT status,ciphertext FROM profitia_profile.email_outbox WHERE email_id IN ('ema_expired1','ema_tampered') ORDER BY email_id")).rows
    assert.deepEqual(rows,[{status:'expired',ciphertext:null},{status:'rejected',ciphertext:null}])
  })
  await t.test('signed intake to real SQL to rendered CID MIME, both avatars and neutral; no external mail',async()=>{
    await f.admin.query('UPDATE profitia_profile.email_policies SET allow_avatar_projection=true')
    await f.admin.query("UPDATE profitia_access.accounts SET status='ACTIVE'")
    await f.admin.query("UPDATE profitia_access.external_identities SET status='ACTIVE'")
    const webhookKey=randomBytes(32),sent=[]
    const runtime=createEmailRuntime({autoStart:false,store,
      verify:createClerkEmailVerifier({environment:'development',instanceId:cfg.instanceId,signingSecret:'whsec_'+webhookKey.toString('base64')}),
      recipient:createEmailRecipientVerifier({users:{getUser:async id=>({id,emailAddresses:[{id:'idn_test1234',emailAddress:'synthetic@example.test'}]})}}),
      render:async(i,avatar)=>{
        const content=renderResolved({kind:i.kind,avatar,data:{appName:'Synthetic App',otpCode:i.otpCode,currentYear:2026,requestedFrom:'Synthetic',requestedAt:'2026-10-24'}})
        const inline=inlineAssetsForAvatar(avatar).map(a=>{content.html=content.html.replaceAll(a.url,'cid:'+a.filename);return {filename:a.filename,bytes:Buffer.from([137,80,78,71,13,10,26,10])}})
        return {...content,inline}
      },
      send:createMailgunTransactionalSender({environment:'development',region:'eu',domain:'example.test',apiKey:'synthetic-key-long-enough',from:'notification@example.test',senderName:'Synthetic App',authorizedRecipients:['synthetic@example.test']},async(url,init)=>{
        assert.equal(url,'https://api.eu.mailgun.net/v3/example.test/messages')
        assert.match(init.body.get('text'),/135790/);sent.push(init.body.getAll('inline').map(x=>x.name))
        return Response.json({id:'<synthetic@example.test>'})
      })})
    for(const avatar of ['male','female','neutral']){
      const now=Date.now(),id='msg_pipeline'+avatar,ts=String(Math.floor(now/1000))
      const body=JSON.stringify({object:'event',type:'email.created',instance_id:cfg.instanceId,timestamp:now,data:{object:'email',id:'ema_pipeline'+avatar,slug:'verification_code',delivered_by_clerk:false,to_email_address:'synthetic@example.test',email_address_id:'idn_test1234',user_id:avatar==='neutral'?null:'user_'+avatar+'1234',data:{otp_code:'135790',user:{public_metadata:{avatar:'untrusted'}}}}})
      const headers={'content-type':'application/json','svix-id':id,'svix-timestamp':ts,'svix-signature':'v1,'+createHmac('sha256',webhookKey).update(`${id}.${ts}.${body}`).digest('base64')}
      const responses=await Promise.all(Array.from({length:4},()=>runtime.handle(new Request('https://identity.test/v1/webhooks/clerk-email',{method:'POST',headers,body}))))
      assert.ok(responses.every(r=>r.status===204));await runtime.tick()
    }
    assert.deepEqual(sent,[['spendguru-logo.png','porr-logo.png','assistant-male.png'],['spendguru-logo.png','porr-logo.png','assistant-female.png'],['spendguru-logo.png','porr-logo.png']])
    await runtime.stop()
  })
  await t.test('queue capacity and hourly budget are enforced before external side effect',async()=>{
    await f.admin.query('UPDATE profitia_profile.email_policies SET max_pending=1,max_per_hour=1')
    await store.enqueue(event('capacity1'));await assert.rejects(()=>store.enqueue(event('capacity2')))
    const c=await store.claim();await assert.rejects(()=>store.begin(c));await store.settle(c,'rejected')
    await f.admin.query('UPDATE profitia_profile.email_policies SET max_pending=1000,max_per_hour=60')
  })
  await t.test('required audit failure rolls back enqueue instead of losing an unrecorded message',async()=>{
    await f.admin.query("CREATE FUNCTION profitia_profile.email_test_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit unavailable'; END $$")
    await f.admin.query('CREATE TRIGGER synthetic_audit_failure BEFORE INSERT ON profitia_profile.email_audit FOR EACH ROW EXECUTE FUNCTION profitia_profile.email_test_audit_failure()')
    await assert.rejects(()=>store.enqueue(event('auditfail')))
    assert.equal((await f.admin.query("SELECT count(*) FROM profitia_profile.email_outbox WHERE email_id='ema_auditfail'")).rows[0].count,'0')
    await f.admin.query('DROP TRIGGER synthetic_audit_failure ON profitia_profile.email_audit; DROP FUNCTION profitia_profile.email_test_audit_failure()')
  })
  await t.test('disable policy stops all queue access; logs contain neither secrets nor recipient',async()=>{
    await f.admin.query('UPDATE profitia_profile.email_policies SET enabled=false')
    await assert.rejects(()=>store.ready());await assert.rejects(()=>store.enqueue(event('disabled2')));await assert.rejects(()=>store.claim())
    const audit=JSON.stringify((await f.admin.query('SELECT * FROM profitia_profile.email_audit')).rows)
    assert.ok(!audit.includes('654321'));assert.ok(!audit.includes('synthetic@example.test'));assert.ok(audit.includes('SERVICE'))
  })
  await t.test('rollback rehearsal: disabled email extension leaves prior provisioning and profile API usable',async()=>{
    const legacy=clerkFixture('user_legacy1234'),options=f.options(legacy)
    const account=await createIdentityProvisioner(options).ensureAccount(legacy.request('POST'))
    const backend=createUserProfileBackend(options),profile=await backend.getCurrentUserProfile(legacy.request('GET'))
    assert.equal(profile.user_id,account.userId)
    const updated=await backend.updateCurrentUserProfile(legacy.request('PATCH'),{expectedVersion:profile.version,patch:{avatar_sex:'female'}})
    assert.equal(updated.avatar_sex,'female')
    assert.equal((await f.admin.query('SELECT count(*) FROM profitia_access.memberships')).rows[0].count,'0')
  })
})
