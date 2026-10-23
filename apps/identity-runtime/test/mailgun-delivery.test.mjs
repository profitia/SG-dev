import test from 'node:test';
import assert from 'node:assert/strict';
import {createMailgunSandboxSender, mailbox} from '../dist/src/mailgun-delivery.js';

const domain='sandbox'+'a'.repeat(32)+'.mailgun.org';
const key='test-key-with-at-least-twenty-chars';
const config={environment:'development',region:'us',domain,apiKey:key,authorizedRecipients:['one@example.com']};
const message={recipient:'one@example.com',subject:'[TEST SANDBOX] male',html:'<p>WIADOMOŚĆ TESTOWA</p>',text:'WIADOMOŚĆ TESTOWA'};

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
