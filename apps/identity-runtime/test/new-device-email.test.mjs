import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {renderResolved,renderMailgunResolved,mailgunTemplate,catalog,inlineAssetsForAvatar} from '../email-templates/render.mjs';
import {createClerkEmailVerifier} from '../dist/src/email-webhook.js';
import {createEmailRecipientVerifier} from '../dist/src/email-correlation.js';
import {createEmailRuntime} from '../dist/src/email-runtime.js';
import fs from 'node:fs';
import {randomBytes} from 'node:crypto';
import {postgresFixture} from '../../../packages/platform-contracts/test/fixtures/identity-profile-postgres.mjs';
import {installVocativeDictionary} from '../../../packages/platform-contracts/src/vocative-dictionary.mjs';
import {createEmailStore,emailSchemaDigest} from '../dist/src/email-store.js';
import {languageSchemaDigest} from '../dist/src/communication-language.js';
import {registrationSchemaDigest} from '../dist/src/registration-store.js';
import {createMailgunTransactionalSender} from '../dist/src/mailgun-delivery.js';

const origin='https://example.clerk.accounts.dev',url=origin+'/v1/client/sessions/sess_synthetic/revoke?token=synthetic%2Bticket&return_url=account';
const data={appName:'SpendGuru PORR',currentYear:2026,firstName:'Anna',signInMethod:'Email code',browserName:'Chrome',operatingSystem:'macOS',location:'Example location',ipAddress:'192.0.2.10',sessionCreatedAt:'2026-10-25T16:51:00Z',revokeSessionUrl:url};
const options={kind:'new-device-sign-in',avatar:'female',language:'pl',data,allowedRevocationOrigins:[origin]};
for(const language of ['pl','en'])for(const avatar of ['male','female','neutral'])test(`security mail ${language}/${avatar} uses canonical assets, real text, details and unchanged provider action`,()=>{
  const r=renderResolved({...options,language,avatar});assert.match(r.html,new RegExp(`<html lang="${language}">`));
  assert.match(r.html,/Chrome · macOS/);assert.match(r.html,/192\.0\.2\.10/);assert.match(r.html,/2026-10-25T16:51:00Z/);
  assert.equal((r.html.match(/href=/g)||[]).length,2);assert.ok(r.html.includes(url.replaceAll('&','&amp;')));assert.ok(r.text.includes(url));
  assert.equal(r.subject,'New device signed in to your SpendGuru PORR account');assert.doesNotMatch(r.html,/otp_code|\{\{|<script|onerror=/);
  for(const key of ['logo','partner',...(avatar==='neutral'?[]:[avatar])])assert.ok(r.html.includes(catalog.assets[key]));
  assert.match(r.html,language==='pl'?/nie musisz nic robić/:/no action is needed/);
  const m=renderMailgunResolved({...options,language,avatar});assert.equal(m.template.name,`identity-new-device-sign-in-${language}-${avatar}`);
  assert.equal(m.template.variables.revoke_session_url,url);assert.equal(m.template.variables.greeting,language==='pl'?'Cześć, Anna!':'Hello, Anna!');assert.ok(!m.html.includes('https://storage.googleapis.com'));assert.match(m.html,/cid:spendguru-logo\.png/);
  const spec=mailgunTemplate(options.kind,avatar,language);assert.equal(m.template.version,spec.version);assert.match(spec.html,/\{\{#if revoke_session_url\}\}/);
});

test('missing provider revoke URL removes CTA/fallback, retains warning and does not invent an action',()=>{
  const r=renderResolved({...options,data:{...data,revokeSessionUrl:null,signInMethod:null}});
  assert.doesNotMatch(r.html,/href=|\{\{|Wyloguj to urządzenie/);assert.match(r.text,/Skontaktuj się z administratorem/);assert.match(r.html,/Nie podano/);
});
test('security details are escaped once, never interpreted as HTML or template code',()=>{
  const r=renderResolved({...options,data:{...data,firstName:'<b>Anna</b>',browserName:'<script>alert(1)</script>',location:'A & B'}});
  assert.match(r.html,/&lt;script&gt;/);assert.match(r.html,/A &amp; B/);assert.doesNotMatch(r.html,/<script>|<b>Anna/);
  for(const patch of [{browserName:'{{app_name}}'},{location:'x\r\nBcc: other@example.test'},{ipAddress:'invalid'},{sessionCreatedAt:''},{currentYear:20260}])assert.throws(()=>renderResolved({...options,data:{...data,...patch}}));
});
test('foreign, insecure, credentialed, ambiguous and fragment-bearing action URLs fail closed',()=>{
  for(const revokeSessionUrl of ['https://evil.example/revoke','http://example.clerk.accounts.dev/revoke','javascript:alert(1)','https://u:p@example.clerk.accounts.dev/revoke',origin+'/revoke#fragment',origin+':444/revoke',origin+'/revoke\n',origin+'\\@evil.example/revoke'])assert.throws(()=>renderResolved({...options,data:{...data,revokeSessionUrl}}));
  assert.throws(()=>renderResolved({...options,allowedRevocationOrigins:[]}));
});

const key=Buffer.alloc(32,7),clock=Date.now(),seconds=String(Math.floor(clock/1000));
const config={environment:'development',instanceId:'ins_test1234',signingSecret:'whsec_'+key.toString('base64')};
const variables={sign_in_method:'Email code',browser_name:'Chrome',operating_system:'macOS',location:'Example location',ip_address:'192.0.2.10',session_created_at:'2026-10-25T16:51:00Z',revoke_session_url:url};
const event={type:'email.created',object:'event',instance_id:config.instanceId,timestamp:clock,data:{object:'email',id:'ema_security1234',slug:'new_device_sign_in',delivered_by_clerk:false,to_email_address:'synthetic@example.test',email_address_id:'idn_security1234',user_id:'user_security1234',data:variables}};
function signed(payload=event,signKey=key){const body=JSON.stringify(payload),id='msg_security1234';return new Request('https://identity.example/v1/webhooks/clerk-email',{method:'POST',headers:{'content-type':'application/json','svix-id':id,'svix-timestamp':seconds,'svix-signature':'v1,'+createHmac('sha256',signKey).update(`${id}.${seconds}.${body}`).digest('base64')},body});}
const verify=createClerkEmailVerifier({...config,allowedRevocationOrigins:[origin]},()=>clock);
test('new device intake is explicit opt-in, default/native Clerk delivery stays unchanged',async()=>{
  assert.deepEqual(await createClerkEmailVerifier(config,()=>clock)(signed()),{status:'ignored',reason:'unsupported-template'});
  assert.deepEqual(await verify(signed({...event,data:{...event.data,delivered_by_clerk:true}})),{status:'ignored',reason:'clerk-delivery'});
  const r=await verify(signed());assert.equal(r.status,'ready');assert.equal(r.instruction.kind,'new-device-sign-in');assert.equal(r.instruction.revokeSessionUrl,url);assert.equal(r.instruction.providerUserId,event.data.user_id);assert.equal(r.instruction.expiresAt,clock+300000);
});
test('new device intake retains SDK signature, instance, subject/address pair and original action restrictions',async()=>{
  await assert.rejects(()=>verify(signed(event,Buffer.alloc(32,8))));await assert.rejects(()=>verify(signed({...event,instance_id:'ins_foreign1234'})));
  for(const patch of [{user_id:null},{email_address_id:null},{user_id:'malformed'},{to_email_address:'one@example.test,two@example.test'},...[
    {revoke_session_url:'https://evil.example/revoke'},{revoke_session_url:origin+'/r#fragment'},{revoke_session_url:'http://example.clerk.accounts.dev/r'},
    {revoke_session_url:'https://u:p@example.clerk.accounts.dev/r'},{revoke_session_url:origin+'/r\n'},{revoke_session_url:origin+'\\@evil.example/r'},
    {ip_address:'not-ip'},{browser_name:'{{secret}}'},{operating_system:42},{location:'x'.repeat(201)},{session_created_at:''},
  ].map(v=>({data:{...variables,...v}}))])await assert.rejects(()=>verify(signed({...event,data:{...event.data,...patch}})),{message:'EMAIL_EVENT_REJECTED'});
  assert.deepEqual(await verify(signed({...event,timestamp:clock-300000})),{status:'ignored',reason:'expired'});
  const absent=await verify(signed({...event,data:{...event.data,data:{...variables,revoke_session_url:null,sign_in_method:null}}}));assert.equal(absent.instruction.revokeSessionUrl,null);
});
test('provider recipient verification rejects another address before sending a security notification',async()=>{
  const instruction=(await verify(signed())).instruction;
  const recipient=createEmailRecipientVerifier({users:{getUser:async()=>({id:instruction.providerUserId,emailAddresses:[{id:instruction.emailAddressId,emailAddress:'other@example.test'}]})}});
  assert.equal(await recipient(instruction),'rejected');
});
test('existing durable worker chooses persisted language/avatar and never executes the revocation URL',async()=>{
  const instruction=(await verify(signed())).instruction;let claim={instruction,emailId:instruction.emailId,token:'lease'},sent=[],settled=[];
  const runtime=createEmailRuntime({autoStart:false,now:()=>clock,verify,recipient:async()=> 'bound',
    store:{ready:async()=>{},enqueue:async()=> 'queued',claim:async()=>{const c=claim;claim=null;return c},begin:async()=>({avatar:'female',language:'en',firstName:'Anna'}),release:async()=>{},settle:async(c,s)=>settled.push(s)},
    render:async(i,avatar,language,salutation)=>renderMailgunResolved({kind:i.kind,avatar,language,data:{...data,...i,...salutation},allowedRevocationOrigins:[origin]}),send:async m=>{sent.push(m);return{status:'accepted',providerId:'mailgun-synthetic'}}});
  await runtime.tick();await runtime.tick();await runtime.stop();assert.equal(sent.length,1);assert.equal(sent[0].recipient,instruction.recipient);assert.match(sent[0].html,/New sign-in/);assert.equal(sent[0].template.name,'identity-new-device-sign-in-en-female');assert.equal(sent[0].template.variables.revoke_session_url,url);assert.deepEqual(settled,['accepted']);
});

test('ordinary PostgreSQL queue encrypts real notification fields, uses persisted PL/EN, deduplicates and clears sensitive payload', {timeout:60000},async t=>{
  const f=await postgresFixture();t.after(()=>f.close());const proof=randomBytes(32),encryption=randomBytes(32);
  await f.admin.query('BEGIN');
  const install=async migration=>f.admin.query(fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/profile/'+migration+'.sql',import.meta.url),'utf8'));
  await install('003-email-delivery');
  await f.admin.query('INSERT INTO profitia_profile.email_installation VALUES(true,$1)',[emailSchemaDigest()]);
  await install('004-communication-language');
  await f.admin.query('INSERT INTO profitia_profile.language_installation VALUES(true,$1)',[languageSchemaDigest()]);
  await install('005-registration');
  await f.admin.query('INSERT INTO profitia_profile.registration_installation VALUES(true,$1)',[registrationSchemaDigest()]);
  await install('006-vocative');
  await installVocativeDictionary(f.admin.query.bind(f.admin));
  await f.admin.query(`INSERT INTO profitia_profile.email_policies(login_role,issuer,instance_id,service_id,enabled,allow_avatar_projection,allow_language_projection,allow_salutation_projection,proof_key) VALUES('identity_b1_runtime','https://synthetic.clerk.accounts.dev','ins_test1234','identity-email-test',true,true,true,true,$1)`,[proof]);
  await f.admin.query('GRANT EXECUTE ON FUNCTION profitia_profile.email_descriptor(),profitia_profile.email_command(text,bigint,text),profitia_profile.language_descriptor(),profitia_profile.vocative_descriptor() TO identity_b1_runtime');
  const uid='33333333-3333-4333-8333-333333333333';await f.admin.query("INSERT INTO profitia_access.accounts(user_id,status) VALUES($1,'ACTIVE')",[uid]);
  await f.admin.query("INSERT INTO profitia_access.external_identities VALUES(gen_random_uuid(),'https://synthetic.clerk.accounts.dev','user_security1234',$1,'ACTIVE',1,'synthetic',now()+interval '1 hour')",[uid]);
  await f.admin.query("INSERT INTO profitia_profile.user_profiles(user_id,avatar_sex,communication_language) VALUES($1,'female','pl')",[uid]);await f.admin.query('COMMIT');
  const cfg={binding:f.binding,issuer:'https://synthetic.clerk.accounts.dev',instanceId:'ins_test1234',serviceId:'identity-email-test',schemaDigest:emailSchemaDigest(),proofKey:proof,encryptionKey:encryption,keyId:'test-key-1'};
  const store=createEmailStore(cfg,f.transact);await store.ready();await assert.rejects(()=>f.pool.query('SELECT * FROM profitia_profile.email_outbox'),e=>e.code==='42501');
  let sends=0;for(const language of ['pl','en']){
    await f.admin.query('UPDATE profitia_profile.user_profiles SET communication_language=$1 WHERE user_id=$2',[language,uid]);
    const i={...(await verify(signed())).instruction,emailId:'ema_notification'+language,eventId:'msg_notification'+language,createdAt:Date.now(),expiresAt:Date.now()+240000};
    assert.equal(await store.enqueue(i),'queued');assert.equal(await store.enqueue({...i,eventId:'msg_duplicate'+language}),'duplicate');
    const raw=(await f.admin.query('SELECT ciphertext FROM profitia_profile.email_outbox WHERE email_id=$1',[i.emailId])).rows[0].ciphertext;
    for(const secret of [i.recipient,i.ipAddress,i.location,i.revokeSessionUrl])assert.ok(!raw.includes(secret));
    const restarted=createEmailStore(cfg,f.transact);
    const send=createMailgunTransactionalSender({environment:'development',region:'eu',domain:'mail.example.test',from:'notifications@mail.example.test',senderName:'SpendGuru',recipientPolicy:'signed-clerk',authorizedRecipients:[],apiKey:'synthetic-transport-key-000000000000'},async(endpoint,init)=>{
      sends++;assert.equal(endpoint,'https://api.eu.mailgun.net/v3/mail.example.test/messages');
      assert.equal(init.body.get('template'),`identity-new-device-sign-in-${language}-female`);
      assert.equal(init.body.get('t:version'),mailgunTemplate(options.kind,'female',language).version);
      assert.equal(JSON.parse(init.body.get('t:variables')).revoke_session_url,url);
      assert.equal(init.body.has('html'),false);assert.equal(init.body.getAll('inline').length,3);
      return Response.json({id:'<synthetic@mailgun.test>'});
    });
    const worker=createEmailRuntime({autoStart:false,verify,store:{...restarted,claim:async()=>{const claim=await restarted.claim();if(claim)assert.deepEqual(claim.instruction,i);return claim}},recipient:createEmailRecipientVerifier({users:{getUser:async()=>({id:i.providerUserId,emailAddresses:[{id:i.emailAddressId,emailAddress:i.recipient}]})}}),
      render:async(instruction,avatar,locale)=>{assert.equal(locale,language);assert.equal(avatar,'female');return {...renderMailgunResolved({...options,language:locale,avatar,data:{...data,...instruction}}),inline:inlineAssetsForAvatar(avatar).map(a=>({filename:a.filename,bytes:new Uint8Array([137,80,78,71,13,10,26,10])}))}},send});
    await worker.tick();await worker.tick();await worker.stop();assert.equal(await restarted.claim(),null);
    assert.deepEqual((await f.admin.query('SELECT status,ciphertext FROM profitia_profile.email_outbox WHERE email_id=$1',[i.emailId])).rows[0],{status:'accepted',ciphertext:null});
  }assert.equal(sends,2);
});
