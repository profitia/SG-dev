import test from 'node:test';
import assert from 'node:assert/strict';
import {greetingFor,renderMailgunResolved} from '../email-templates/render.mjs';
for(const language of ['pl','en'])for(const avatar of ['male','female','neutral'])for(const kind of ['verification-code','invitation'])
 test(`persisted salutation ${language}/${avatar}/${kind}, independent from avatar`,()=>{
  const result=renderMailgunResolved({kind,avatar,language,allowedActionOrigins:['https://identity.test'],data:{firstName:'Marek',vocative:'Marku',appName:'SpendGuru',currentYear:2026,otpCode:'123456',requestedFrom:'SpendGuru',requestedAt:'2026-10-24',actionUrl:'https://identity.test/invite',expiresInDays:7}});
  const greeting=language==='pl'?'Cześć, Marku!':'Hello, Marek!';
  assert(result.html.includes(greeting));assert(result.text.includes(greeting));assert.equal(result.template.variables.greeting,greeting);
  assert.equal(result.html.includes('Hello, Marku'),false);assert.equal(result.html.includes('Cześć, Marek'),false);
  if(avatar!=='neutral')assert(result.html.includes(`cid:assistant-${avatar}.png`));
 });
test('unknown names, missing values and untrusted characters are safe in both MIME alternatives',()=>{
 assert.equal(greetingFor('pl',{firstName:'Unlisted'}),'Cześć, Unlisted!');
 assert.equal(greetingFor('en',{firstName:'Marek',vocative:'Marku'}),'Hello, Marek!');
 assert.equal(greetingFor('pl',{}),'Cześć!');assert.equal(greetingFor('pl',{firstName:'{{otp_code}}'}),'Cześć!');
 const r=renderMailgunResolved({kind:'verification-code',avatar:'female',language:'pl',data:{firstName:'<img src=x>',appName:'SpendGuru',currentYear:2026,otpCode:'123456',requestedFrom:'SpendGuru',requestedAt:'2026-10-24'}});
 assert(r.html.includes('Cześć, &lt;img src=x&gt;!'));assert(!r.html.includes('<img src=x>'));assert(r.text.includes('Cześć, <img src=x>!'));
});
