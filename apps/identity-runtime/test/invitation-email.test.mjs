import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {prepareOrganisationInvitationEmail,attachOrganisationInvitationAssets} from '../dist/src/invitation-email.js'
const created=Date.parse('2026-11-12T12:00:00Z'),now=()=>created+1000
const input={token:'sgi1_'+'A'.repeat(43),createdAt:new Date(created).toISOString(),expiresAt:new Date(created+7*86400000).toISOString(),
inviterName:'Anna',inviterEmail:'anna@example.test',organisationName:'Przykładowa spółka',avatar:'male',language:'pl',
recipientProfile:{firstName:'Marek',vocative:'Marku',dictionaryVersion:'pl-v1'}}
const options={identityOrigin:'https://identity.example.test',allowedIdentityOrigins:['https://identity.example.test'],now}
for(const avatar of ['male','female'])test('reuses approved '+avatar+' organisation template and persisted vocative, independently of recipient name',async()=>{
 const plan=await prepareOrganisationInvitationEmail({...input,avatar},options)
 assert.match(plan.content.text,/Cześć, Marku!/);assert.match(plan.content.text,/anna@example.test/);assert.match(plan.content.text,/Przykładowa spółka/)
 assert.match(plan.content.text,/https:\/\/identity.example.test\/invite\?proof=sgi1_/)
 assert.ok(plan.content.template.name.includes(avatar));assert.ok(plan.assets.length>0)
 assert.ok(!plan.assets.some(x=>/porr|partner/i.test(x.filename)))
 assert.ok(!plan.content.html.includes('{{'));assert.ok(plan.content.html.includes('cid:'))
})
test('unknown recipient and missing Polish dictionary match use neutral greeting; English uses persisted original name',async()=>{
 for(const recipientProfile of [null,{firstName:'Marek',vocative:null,dictionaryVersion:null}]){
  const {content}=await prepareOrganisationInvitationEmail({...input,recipientProfile},options)
  assert.match(content.text,/Cześć!/);assert.ok(!content.text.includes('Marek'))
 }
 const {content}=await prepareOrganisationInvitationEmail({...input,language:'en'},options)
 assert.match(content.text,/Hello, Marek!/);assert.ok(!content.text.includes('Hello, Marku'))
})
test('rejects missing dictionary provenance, expired proof, altered lifetime and foreign action origin',async()=>{
 for(const patch of [{recipientProfile:{firstName:'Marek',vocative:'Marku',dictionaryVersion:null}},{expiresAt:new Date(created+60000).toISOString()},
 {createdAt:new Date(created+2000).toISOString()},{avatar:'woman'},{token:'sgi1_invalid'},{inviterEmail:'anna@example.test\r\nBcc: victim@example.test'}])
  await assert.rejects(()=>prepareOrganisationInvitationEmail({...input,...patch},options))
 await assert.rejects(()=>prepareOrganisationInvitationEmail(input,{...options,now:()=>created+8*86400000}))
 await assert.rejects(()=>prepareOrganisationInvitationEmail(input,{...options,identityOrigin:'https://foreign.example.test'}))
})
test('escapes organisation and inviter text without interpreting template code',async()=>{
 const {content}=await prepareOrganisationInvitationEmail({...input,organisationName:'Firma <script>alert(1)</script>',inviterName:'A & B'},options)
 assert.ok(!content.html.includes('<script>'));assert.match(content.html,/&lt;script&gt;/);assert.match(content.html,/A &amp; B/)
 await assert.rejects(()=>prepareOrganisationInvitationEmail({...input,organisationName:'{{action_url}}'},options))
})
test('asset attachment rejects foreign source before fetching and authenticates canonical bytes',async()=>{
 let calls=0
 await assert.rejects(()=>attachOrganisationInvitationAssets({content:{subject:'test',html:'cid:avatar.png',text:'test'},assets:[{url:'https://evil.test/a.png',filename:'avatar.png',sha256:'a'.repeat(64)}]},async()=>{calls++;return new Response()}))
 assert.equal(calls,0)
 const bytes=Buffer.from([137,80,78,71,13,10,26,10]),asset={url:'https://storage.googleapis.com/storage.magicpath.ai/component-assets/fixture.png',filename:'avatar.png',sha256:createHash('sha256').update(bytes).digest('hex')}
 const content=await attachOrganisationInvitationAssets({content:{subject:'test',html:'cid:avatar.png',text:'test'},assets:[asset]},async(url,init)=>{
  assert.equal(init.redirect,'error');return new Response(bytes)
 })
 assert.equal(content.inline.length,1);assert.deepEqual(content.inline[0].bytes,bytes)
 await assert.rejects(()=>attachOrganisationInvitationAssets({content,assets:[asset]},async()=>new Response('invalid png')))
})
