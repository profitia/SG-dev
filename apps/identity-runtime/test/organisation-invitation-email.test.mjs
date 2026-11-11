import test from 'node:test'
import assert from 'node:assert/strict'
import {renderResolved,renderMailgunResolved,mailgunTemplate,inlineAssetsForAvatar,catalog} from '../email-templates/render.mjs'
const proof='sgi1_'+Buffer.alloc(32,8).toString('base64url')
const base={kind:'organisation-invitation',avatar:'female',language:'pl',allowedActionOrigins:['https://identity.example.test'],
 data:{appName:'SpendGuru',currentYear:2026,firstName:'Marek',vocative:'Marku',inviterName:'Ada Kowalska',inviterEmail:'ada@example.test',
 organisationName:'Przykładowa spółka S.A.',actionUrl:'https://identity.example.test/invite?proof='+proof,expiresInDays:7}}
for(const avatar of ['female','male','neutral'])for(const language of ['pl','en'])test('organisation invitation reuses approved layout and persisted salutation: '+language+'/'+avatar,()=>{
 const value=renderMailgunResolved({...base,avatar,language})
 assert.match(value.html,/table role="presentation"/)
 for(const part of ['Ada Kowalska','ada@example.test','Przykładowa spółka S.A.']){assert(value.html.includes(part));assert(value.text.includes(part))}
 assert(value.html.includes(language==='pl'?'Cześć, Marku!':'Hello, Marek!'))
 assert(value.text.includes(language==='pl'?'kategorie zakupowe':'procurement categories'))
 assert(value.text.includes(base.data.actionUrl));assert.match(value.template.name,/^identity-organisation-invitation-/)
 assert.equal(value.template.variables.inviter_name,base.data.inviterName)
 assert.equal(value.template.variables.inviter_email,base.data.inviterEmail)
 assert.equal(value.template.variables.organisation_name,base.data.organisationName)
 assert.equal(value.template.variables.action_url,base.data.actionUrl)
 assert.equal(value.template.variables.expires_in_days,'7');assert(!('otp_code'in value.template.variables))
 assert.doesNotMatch(value.html+value.text,/PORR|porr-logo|otp_code|\{\{/)
 const assets=inlineAssetsForAvatar(avatar,'organisation-invitation')
 assert(!assets.some(a=>a.filename==='porr-logo.png'))
 assert.deepEqual([...value.html.matchAll(/<img\b[^>]*src="([^"]+)"/g)].map(m=>m[1]).sort(),assets.map(a=>'cid:'+a.filename).sort())
 assert.equal(value.html.includes('cid:assistant-female.png'),avatar==='female')
 assert.equal(value.html.includes('cid:assistant-male.png'),avatar==='male')
})
test('unknown recipient stays neutral with no name derived from email; inviter name can fall back to user',()=>{
 const value=renderMailgunResolved({...base,avatar:'neutral',data:{...base.data,firstName:null,vocative:null,inviterName:null}})
 assert.match(value.html,/Cześć!/);assert.doesNotMatch(value.html,/Marku|Marek|assistant-female|assistant-male/)
 assert.match(value.text,/użytkownik \(ada@example.test\)/)
 assert.equal(value.template.variables.inviter_name,'użytkownik')
})
test('organisation and inviter data are escaped once, never interpreted as template or markup',()=>{
 const data={...base.data,organisationName:'A&B <test>',inviterName:'Ada <b>Kowalska</b>'}
 const value=renderResolved({...base,data})
 assert.match(value.html,/A&amp;B &lt;test&gt;/);assert.doesNotMatch(value.html,/<b>Kowalska<\/b>/)
 assert(value.text.includes(data.organisationName));assert(value.text.includes(data.inviterName))
 for(const patch of [{organisationName:'{{otp_code}}'},{inviterEmail:'ada@example.test\r\nBcc:other@example.test'},{inviterName:'name\nheader'},
 {organisationName:''},{inviterEmail:'invalid'},{appName:'SpendGuru PORR'},{expiresInDays:8}]){
  assert.throws(()=>renderMailgunResolved({...base,data:{...base.data,...patch}}))
 }
})
test('native link is an invitation proof for the configured Identity receiver, never a login ticket or redirect',()=>{
 for(const actionUrl of ['https://evil.example/invite?proof='+proof,'http://identity.example.test/invite?proof='+proof,
 'https://identity.example.test/invite?__clerk_ticket=anything','https://identity.example.test/account?proof='+proof,
 base.data.actionUrl+'&next=https://evil.example',base.data.actionUrl+'&proof='+proof,base.data.actionUrl+'#fragment',
 'https://identity.example.test/invite?proof=short','https://a:b@identity.example.test/invite?proof='+proof]){
  assert.throws(()=>renderResolved({...base,data:{...base.data,actionUrl}}))
 }
 assert.throws(()=>renderResolved({...base,allowedActionOrigins:[]}))
})
test('Mailgun template identity changes with native purpose while legacy Clerk invitation remains separate',()=>{
 const own=mailgunTemplate('organisation-invitation','male','pl'),legacy=mailgunTemplate('invitation','male','pl')
 assert.notEqual(own.name,legacy.name);assert.notEqual(own.version,legacy.version)
 assert.match(own.html,/\{\{inviter_name\}\}/);assert.match(own.html,/\{\{inviter_email\}\}/);assert.match(own.html,/\{\{organisation_name\}\}/)
 assert.doesNotMatch(legacy.html,/inviter_name|organisation_name/)
 assert(!Object.hasOwn(catalog.messages,'organisation-invitation'),'native mail is never exported as a Clerk template')
})
