import test from 'node:test';
import assert from 'node:assert/strict';
import {createMailgunSandboxSender, createMailgunTransactionalSender, mailbox} from '../dist/src/mailgun-delivery.js';

const domain='sandbox'+'a'.repeat(32)+'.mailgun.org';
const key='test-key-with-at-least-twenty-chars';
const config={environment:'development',region:'us',domain,apiKey:key,authorizedRecipients:['one@example.com']};
const message={recipient:'one@example.com',subject:'[TEST SANDBOX] male',html:'<p>WIADOMOŚĆ TESTOWA</p>',text:'WIADOMOŚĆ TESTOWA'};

test('explicit signed-Clerk mode covers new recipients on own domain without weakening sandbox guards',async()=>{
  const cfg={...config,domain:'mail.example.test',region:'eu',from:'notifications@mail.example.test',senderName:'SpendGuru',recipientPolicy:'signed-clerk',authorizedRecipients:[]}
  let calls=0
  const send=createMailgunTransactionalSender(cfg,async(_url,init)=>{
    calls++; assert.equal(init.body.getAll('to').length,1)
    assert.equal(init.body.has('cc'),false); assert.equal(init.body.has('bcc'),false)
    return Response.json({id:'<test@mail.example.test>'})
  })
  for(const recipient of ['new@example.test','Another@EXAMPLE.TEST']) assert.equal((await send({...message,recipient})).status,'accepted')
  for(const recipient of ['a@example.test,b@example.test','Name <a@example.test>','a@example.test\r\nBcc:x']) await assert.rejects(()=>send({...message,recipient}))
  assert.equal(calls,2)
  assert.throws(()=>createMailgunTransactionalSender({...cfg,authorizedRecipients:['one@example.test']}))
  assert.throws(()=>createMailgunTransactionalSender({...cfg,recipientPolicy:'all'}))
  assert.throws(()=>createMailgunSandboxSender({...config,authorizedRecipients:[],recipientPolicy:'signed-clerk'}))
})

test('transactional Development sender uses own domain, exact From and allowlist without sandbox sample code',async()=>{
  const cfg={...config,domain:'mail.example.test',region:'eu',from:'notifications@mail.example.test',senderName:'SpendGuru'}
  let calls=0
  const send=createMailgunTransactionalSender(cfg,async(url,init)=>{
    calls++;assert.equal(url,'https://api.eu.mailgun.net/v3/mail.example.test/messages')
    assert.equal(init.body.get('from'),'SpendGuru <notifications@mail.example.test>')
    assert.equal(init.body.get('text'),'Kod 123456');assert.equal(init.body.get('o:tag'),'identity-transactional-development')
    return Response.json({id:'<test@mail.example.test>'})
  })
  const real={recipient:'one@example.com',subject:'Kod weryfikacyjny',text:'Kod 123456',html:'<p>Kod 123456</p>'}
  assert.equal((await send(real)).status,'accepted')
  await assert.rejects(()=>send({...real,recipient:'foreign@example.test'}));assert.equal(calls,1)
  for(const override of [{domain},{from:'evil@foreign.test'},{senderName:'bad\r\nBcc:x'},{environment:'production'}]) assert.throws(()=>createMailgunTransactionalSender({...cfg,...override}))
})

test('one recipient, exact regional endpoint, tracking off, verified TLS and no API redirects', async()=>{
  for(const region of ['us','eu']) {
    const send=createMailgunSandboxSender({...config,region},async(url,init)=>{
      assert.equal(url,`https://${region==='us'?'api':'api.eu'}.mailgun.net/v3/${domain}/messages`);
      assert.equal(init.redirect,'error'); assert.equal(init.method,'POST'); assert.ok(init.signal);
      assert.equal(init.headers.Authorization,'Basic '+Buffer.from('api:'+key).toString('base64'));
      assert.equal(init.body.get('to'),message.recipient);assert.equal(init.body.get('html'),message.html);
      for(const name of ['o:tracking','o:tracking-clicks','o:tracking-opens','o:skip-verification']) assert.equal(init.body.get(name),'no');
      assert.equal(init.body.get('o:require-tls'),'yes');
      for(const name of ['cc','bcc','o:archive-to','o:testmode']) assert.equal(init.body.has(name),false);
      return Response.json({id:'<sample@'+domain+'>',message:'Queued. Thank you.'});
    });
    assert.equal((await send(message)).status,'accepted');
  }
});

test('cannot use production, custom endpoint/domain, malformed config or empty allowlist',()=>{
  for(const override of [{environment:'production'},{environment:'staging'},{region:'https://evil.example'},{domain:'example.com'},{domain:domain+'/../evil'}, {apiKey:key+'\n'}, {authorizedRecipients:[]},{timeoutMs:0}]) {
    assert.throws(()=>createMailgunSandboxSender({...config,...override}));
  }
});

test('recipient/header injection, multiple recipients and unlabelled messages fail before network',async()=>{
  let calls=0;const send=createMailgunSandboxSender(config,async()=>{calls++;throw Error('should not send');});
  for(const override of [
    {recipient:'two@example.com'},{recipient:'one@example.com,two@example.com'}, {recipient:'Name <one@example.com>'},
    {recipient:'one@example.com\r\nBcc:two@example.com'},{recipient:'one@example.com\n'},
    {subject:'Real OTP'}, {subject:'[TEST SANDBOX] x\r\nBcc: x'}, {html:'real code'}, {text:''},
    {html:'WIADOMOŚĆ TESTOWA'+'a'.repeat(100000)},
  ]) await assert.rejects(()=>send({...message,...override}));
  assert.equal(calls,0);
  assert.equal(mailbox('One@EXAMPLE.COM'),'One@example.com');
});

test('network errors, timeouts, redirects and ambiguous responses are not automatically retried',async()=>{
  const responses=[()=>{throw Error('secret '+key);},()=>new Response('',{status:302}),()=>new Response('',{status:429}),()=>new Response('',{status:500}),()=>new Response('not JSON'),()=>Response.json({id:'\r\nsecret'})];
  for(const make of responses) {
    let calls=0;const send=createMailgunSandboxSender(config,async()=>{calls++;return make();});
    assert.deepEqual(await send(message),{status:'unknown',code:'submission_unconfirmed'});assert.equal(calls,1);
  }
});

test('definite rejection returns only a sanitized status, not provider body',async()=>{
  const send=createMailgunSandboxSender(config,async()=>new Response('sensitive recipient and '+key,{status:401}));
  assert.deepEqual(await send(message),{status:'rejected',code:'provider_rejected'});
});

test('inline PNGs travel inside multipart with exact CID filenames and bytes',async()=>{
  const bytes=new Uint8Array([137,80,78,71,13,10,26,10,1,2,3]);
  const send=createMailgunSandboxSender(config,async(url,init)=>{
    const files=init.body.getAll('inline');assert.equal(files.length,1);
    assert.equal(files[0].name,'assistant-male.png');assert.equal(files[0].type,'image/png');
    assert.deepEqual(new Uint8Array(await files[0].arrayBuffer()),bytes);
    assert.match(init.body.get('html'),/src="cid:assistant-male.png"/);
    return Response.json({id:'<inline@domain.example>'});
  });
  assert.equal((await send({...message,html:message.html+'<img src="cid:assistant-male.png" alt="Awatar" />',inline:[{filename:'assistant-male.png',bytes}]})).status,'accepted');
});

test('missing CID files, remote images, unreferenced files, SVG and duplicate names fail before send',async()=>{
  let calls=0;const send=createMailgunSandboxSender(config,async()=>{calls++;return Response.json({id:'<bad@domain.example>'});});
  const bytes=new Uint8Array([137,80,78,71,13,10,26,10]);const file={filename:'assistant-male.png',bytes};
  const html=message.html+'<img src="cid:assistant-male.png" />';
  for(const override of [{html},{html:message.html+'<img src="https://example.com/logo.png" />'},
    {html:message.html+"<IMG SRC='https://example.com/logo.png' />"}, {html:message.html+'<img src=https://example.com/logo.png>'},
    {inline:[file]},{html,inline:[file,file]},{html,inline:[{...file,bytes:new TextEncoder().encode('<svg/>')}]},
    {html,inline:[{...file,filename:'../assistant-male.png'}]},
  ]) await assert.rejects(()=>send({...message,...override}));
  assert.equal(calls,0);
});

test('stored template pins exact language/avatar version; codes are template-only variables',async()=>{
 const {renderMailgunResolved,inlineAssetsForAvatar}=await import('../email-templates/render.mjs')
 const out=renderMailgunResolved({kind:'verification-code',avatar:'female',language:'en',inlineImages:true,data:{appName:'SpendGuru PORR',currentYear:2026,otpCode:'012345',requestedFrom:'Chrome',requestedAt:'2026-10-24'}})
 const cfg={...config,domain:'mail.example.test',region:'eu',from:'notifications@mail.example.test',senderName:'SpendGuru'}
 let calls=0;const send=createMailgunTransactionalSender(cfg,async(_url,init)=>{calls++;assert.equal(init.body.get('template'),'identity-verification-code-en-female');assert.equal(init.body.get('t:version'),out.template.version);assert.equal(JSON.parse(init.body.get('t:variables')).otp_code,'012345');assert.equal(JSON.parse(init.body.get('t:variables')).greeting,'Hello!');assert.equal(init.body.has('html'),false);assert.ok([...init.body.keys()].every(k=>!k.startsWith('v:')));assert.equal(init.body.getAll('inline').length,3);return Response.json({id:'<stored@mail.example.test>'})})
 const msg={...out,recipient:'one@example.com',inline:inlineAssetsForAvatar('female').map(a=>({...a,bytes:new Uint8Array([137,80,78,71,13,10,26,10])}))};assert.equal((await send(msg)).status,'accepted')
 for(const template of [{...out.template,name:'foreign'},{...out.template,version:'latest'},{...out.template,variables:{...out.template.variables,secret:'x'}}])await assert.rejects(()=>send({...msg,template}))
 assert.equal(calls,1)
})

for (const language of ['pl','en']) for (const avatar of ['male','female','neutral']) test(`new-device stored template reaches multipart transport once: ${language}/${avatar}`,async()=>{
  const {renderMailgunResolved,inlineAssetsForAvatar}=await import('../email-templates/render.mjs');
  const origin='https://synthetic.clerk.accounts.dev',action=origin+'/revoke?token=synthetic%2Bticket&next=account';
  const out=renderMailgunResolved({kind:'new-device-sign-in',avatar,language,allowedRevocationOrigins:[origin],data:{appName:'SpendGuru',currentYear:2026,signInMethod:'Email code',browserName:'Chrome',operatingSystem:'Synthetic OS',location:'Synthetic',ipAddress:'192.0.2.10',sessionCreatedAt:'2026-10-25T19:00:00Z',revokeSessionUrl:action}});
  const cfg={...config,domain:'mail.example.test',region:'eu',from:'notifications@mail.example.test',senderName:'SpendGuru',recipientPolicy:'signed-clerk',authorizedRecipients:[]};
  let calls=0;const send=createMailgunTransactionalSender(cfg,async(endpoint,init)=>{
    calls++;assert.equal(endpoint,'https://api.eu.mailgun.net/v3/mail.example.test/messages');assert.equal(init.redirect,'error');
    assert.equal(init.body.get('template'),`identity-new-device-sign-in-${language}-${avatar}`);assert.equal(init.body.get('t:version'),out.template.version);
    assert.equal(init.body.get('to'),'synthetic@example.test');assert.equal(init.body.has('html'),false);
    assert.equal(JSON.parse(init.body.get('t:variables')).revoke_session_url,action);
    assert.equal(init.body.getAll('inline').length,avatar==='neutral'?2:3);
    for(const name of ['o:tracking','o:tracking-clicks','o:tracking-opens','o:skip-verification'])assert.equal(init.body.get(name),'no');
    assert.equal(init.body.get('o:require-tls'),'yes');assert.ok([...init.body.keys()].every(k=>!k.startsWith('v:')&&!['cc','bcc'].includes(k)));
    return Response.json({id:'<new-device@mail.example.test>'});
  });
  const msg={...out,recipient:'synthetic@example.test',inline:inlineAssetsForAvatar(avatar).map(a=>({filename:a.filename,bytes:new Uint8Array([137,80,78,71,13,10,26,10])}))};
  assert.equal((await send(msg)).status,'accepted');assert.equal(calls,1);
  const missing={...out.template.variables};delete missing.ip_address;
  for(const template of [
    {...out.template,name:'identity-new-device-sign-in-fr-neutral'}, {...out.template,version:'latest'},
    {...out.template,variables:missing}, {...out.template,variables:{...out.template.variables,otp_code:'012345'}},
    {...out.template,name:'identity-verification-code-en-neutral'},
    {...out.template,variables:{...out.template.variables,location:'{{secret}}'}},
    {...out.template,variables:{...out.template.variables,revoke_session_url:action+'\r\nBcc:other@example.test'}},
    {...out.template,variables:{...out.template.variables,revoke_session_url:'x'.repeat(4097)}},
    {...out.template,variables:{...out.template.variables,device:'x'.repeat(2001)}},
  ])await assert.rejects(()=>send({...msg,template}),{message:'Invalid stored template'});
  assert.equal(calls,1);
});

test('new-device transport accepts no action and a bounded long opaque URL without expanding other template limits',async()=>{
  const cfg={...config,domain:'mail.example.test',region:'eu',from:'notifications@mail.example.test',senderName:'SpendGuru',recipientPolicy:'signed-clerk',authorizedRecipients:[]};let calls=0;
  const send=createMailgunTransactionalSender(cfg,async(_endpoint,init)=>{calls++;const vars=JSON.parse(init.body.get('t:variables'));assert.ok(vars.revoke_session_url.length===0||vars.revoke_session_url.length===4096);return Response.json({id:'<bounded@mail.example.test>'})});
  const variables={app_name:'SpendGuru',current_year:'2026',device:'Chrome',greeting:'Hello!',ip_address:'192.0.2.10',location:'Synthetic',revoke_session_url:'',session_created_at:'2026-10-25',sign_in_method:'Email code'};
  const msg={recipient:'synthetic@example.test',subject:'Synthetic preview',html:'<p>Synthetic</p>',text:'Synthetic',template:{name:'identity-new-device-sign-in-en-neutral',version:'v-'+'a'.repeat(24),variables}};
  assert.equal((await send(msg)).status,'accepted');
  const prefix='https://synthetic.clerk.accounts.dev/revoke?token=';assert.equal((await send({...msg,template:{...msg.template,variables:{...variables,revoke_session_url:prefix+'a'.repeat(4096-prefix.length)}}})).status,'accepted');
  for(const template of [
    {name:'identity-verification-code-en-neutral',version:msg.template.version,variables:{app_name:'SpendGuru',current_year:'2026',greeting:'Hello!',otp_code:'012345',requested_at:'2026-10-25',requested_from:'x'.repeat(2001)}},
    {name:'identity-invitation-en-neutral',version:msg.template.version,variables:{app_name:'SpendGuru',current_year:'2026',greeting:'Hello!',expires_in_days:'1',action_url:'https://example.test/'+'x'.repeat(2001)}},
  ])await assert.rejects(()=>send({...msg,template}),{message:'Invalid stored template'});
  assert.equal(calls,2);
});
