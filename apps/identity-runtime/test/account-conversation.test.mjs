import test from 'node:test'
import assert from 'node:assert/strict'
import { createClerkConversation, conversationClientScript } from '../dist/src/account-conversation.js'
import { conversationMarkup } from '../dist/src/account-visuals.js'
function fixture(registration=true, overrides={}, ticket=null) {
 const calls=[], factors=[{strategy:'email_code',emailAddressId:'email_fixture'},{strategy:'password'}]
 const wrap=(name,result)=>async input=>{calls.push([name,input]); if (overrides[name]) return overrides[name](input); return result}
 const complete={status:'complete',createdSessionId:'sess_fixture'}
 const signup={create:wrap('createUp',{status:'missing_requirements',missingFields:[]}),prepareEmailAddressVerification:wrap('prepareUp',{}),attemptEmailAddressVerification:wrap('verifyUp',complete)}
 const signin={supportedFirstFactors:factors,create:wrap('createIn',{status:'needs_first_factor',supportedFirstFactors:factors}),prepareFirstFactor:wrap('prepareIn',{}),attemptFirstFactor:wrap('verifyIn',complete)}
 const sdk={client:{signUp:signup,signIn:signin},setActive:wrap('activate',{})}
 return {model:createClerkConversation(sdk,registration,ticket),calls,sdk}
}
async function registrationToCode(f) { for(const x of ['male','Adam','Testowy','synthetic@example.test']) await f.model.submit(x) }
test('short registration uses official create, email prepare, actual verification and setActive in order',async()=>{
 const f=fixture();await registrationToCode(f);assert.equal(f.model.state.step,'code');assert.equal(f.model.state.complete,false)
 assert.deepEqual(f.calls,[['createUp',{firstName:'Adam',lastName:'Testowy',emailAddress:'synthetic@example.test',unsafeMetadata:{assistantAvatar:'male'}}],['prepareUp',{strategy:'email_code'}]])
 await f.model.submit('123456');assert.equal(f.model.state.complete,true);assert.deepEqual(f.calls.at(-2),['verifyUp',{code:'123456'}]);assert.deepEqual(f.calls.at(-1),['activate',{session:'sess_fixture'}])
})
test('wrong or expired provider code never activates and permits retry',async()=>{
 const f=fixture(true,{verifyUp:()=>{throw Error('provider rejected')}});await registrationToCode(f);await assert.rejects(f.model.submit('123456'));assert.equal(f.model.state.step,'code');assert.equal(f.model.state.complete,false);assert(!f.calls.some(x=>x[0]==='activate'));assert.equal(f.model.state.busy,false)
})
test('missing required provider fields and legal acceptance go to the official challenge',async()=>{
 const f=fixture(true,{createUp:()=>({status:'missing_requirements',missingFields:['legal_accepted']})});await registrationToCode(f);assert.equal(f.model.state.step,'challenge');assert.deepEqual(f.calls.map(x=>x[0]),['createUp']);assert.equal(f.model.state.complete,false)
})
test('email sign-in selects provider-issued email factor and waits for verified session',async()=>{
 const f=fixture(false);for(const x of ['female','email_code','synthetic@example.test'])await f.model.submit(x);assert.equal(f.model.state.step,'code');assert.deepEqual(f.calls.at(-1),['prepareIn',{strategy:'email_code',emailAddressId:'email_fixture'}]);await f.model.submit('654321');assert.deepEqual(f.calls.at(-2),['verifyIn',{strategy:'email_code',code:'654321'}]);assert.equal(f.model.state.complete,true)
})
test('password sign-in keeps password out of conversation state and delegates device/MFA challenge',async()=>{
 const f=fixture(false,{verifyIn:()=>({status:'needs_second_factor'})});for(const x of ['male','password','synthetic@example.test','sensitive fixture only'])await f.model.submit(x);assert.equal(f.model.state.step,'challenge');assert.equal(f.model.state.complete,false);assert(!JSON.stringify(f.model.state).includes('sensitive'));assert(!f.calls.some(x=>x[0]==='activate'));assert.deepEqual(f.calls.at(-1),['verifyIn',{strategy:'password',password:'sensitive fixture only'}])
})
test('unsupported sign-in strategies cannot be locally treated as authenticated',async()=>{
 const f=fixture(false);f.sdk.client.signIn.supportedFirstFactors=[];for(const x of ['male','email_code','synthetic@example.test'])await f.model.submit(x);assert.equal(f.model.state.step,'challenge');assert(!f.calls.some(x=>x[0]==='activate'))
})
test('incomplete provider result with session id and complete result without id cannot activate',async()=>{
 for(const result of [{status:'needs_second_factor',createdSessionId:'sess_incomplete'},{status:'complete',createdSessionId:null}]){const f=fixture(true,{verifyUp:()=>result});await registrationToCode(f);await f.model.submit('123456');assert.equal(f.model.state.complete,false);assert(!f.calls.some(x=>x[0]==='activate'))}
})
test('parallel submission is fenced and code format is checked before the SDK',async()=>{
 let release;const f=fixture(true,{verifyUp:()=>new Promise(r=>{release=r})});await registrationToCode(f);await assert.rejects(f.model.submit('12x'));assert.equal(f.calls.length,2);const first=f.model.submit('123456');await f.model.submit('654321');assert.equal(f.calls.filter(x=>x[0]==='verifyUp').length,1);release({status:'complete',createdSessionId:'sess_fixture'});await first;assert.equal(f.model.state.complete,true)
})
test('provider activation failure never reports account ready',async()=>{
 const f=fixture(true,{activate:()=>{throw Error('activation failed')}});await registrationToCode(f);await assert.rejects(f.model.submit('123456'));assert.equal(f.model.state.complete,false)
})
test('resend remains provider-owned and contains no user supplied verification authority',async()=>{
 const f=fixture();await registrationToCode(f);await f.model.resend();assert.deepEqual(f.calls.at(-1),['prepareUp',{strategy:'email_code'}]);assert.equal(f.model.state.complete,false)
})
test('V2 keeps six secure code inputs, submit/Enter semantics, accessible send and avatar controls',()=>{
 const html=conversationMarkup(false,true,'https://identity.example/login','https://identity.example/registration');assert.equal((html.match(/class="sg-v2-code-input"/g)||[]).length,6);assert(html.includes('type="submit"'));assert(html.includes('aria-label="Wyślij"'));assert(html.includes('id="clerk-captcha"'));assert(html.includes('Zmień awatara'));assert(!/firma|branża|Organisation ID|Symulacja|dowolny kod/.test(html));assert(!/innerHTML|insertAdjacentHTML|localStorage|sessionStorage|console\./.test(conversationClientScript));assert(conversationClientScript.includes('row.animate'));assert(conversationClientScript.includes('prefers-reduced-motion'))
})

test('registration choice remains presentation-only until provider completion for the same subject',async()=>{
 const f=fixture(true,{verifyUp:()=>({status:'complete',createdSessionId:'sess_fixture',createdUserId:'user_registered'})})
 await registrationToCode(f);assert.equal(f.model.registrationAvatar('user_registered'),null)
 f.model.state.avatarSex='female';await f.model.submit('123456')
 assert.equal(f.model.registrationAvatar('user_registered'),'female');assert.equal(f.model.registrationAvatar('user_other'),null)
 const login=fixture(false);login.model.state.avatarSex='male';login.sdk.client.signUp={status:'complete',createdUserId:'user_registered'}
 assert.equal(login.model.registrationAvatar('user_registered'),null)
})

test('invitation delegates opaque ticket to Clerk, keeps avatar and does not send another code',async()=>{
 const ticket='synthetic_invitation_fixture_12345'
 const f=fixture(true,{createUp:()=>({status:'complete',createdSessionId:'sess_invited',createdUserId:'user_invited'})},ticket)
 for(const value of ['female','Ada','Testowa'])await f.model.submit(value)
 assert.equal(f.model.state.complete,true)
 assert.deepEqual(f.calls,[['createUp',{strategy:'ticket',ticket,firstName:'Ada',lastName:'Testowa',unsafeMetadata:{assistantAvatar:'female'}}],['activate',{session:'sess_invited'}]])
 assert.equal(f.model.registrationAvatar('user_invited'),'female');assert(!JSON.stringify(f.model.state).includes(ticket))
})
test('invalid, revoked or incomplete invitations cannot create a local session',async()=>{
 assert.throws(()=>fixture(true,{},'bad ticket'));assert.throws(()=>fixture(false,{},'synthetic_invitation_fixture_12345'))
 for(const result of ['reject',{status:'missing_requirements',missingFields:['legal_accepted']}]){
  const f=fixture(true,{createUp:()=>{if(result==='reject')throw Error('revoked');return result}},'synthetic_invitation_fixture_12345')
  await f.model.submit('male');await f.model.submit('Adam')
  if(result==='reject')await assert.rejects(f.model.submit('Testowy'));else{await f.model.submit('Testowy');assert.equal(f.model.state.step,'challenge')}
  assert.equal(f.model.state.complete,false);assert(!f.calls.some(c=>c[0]==='activate'||c[0]==='prepareUp'))
 }
})

test('backend registration collects preference before OTP, preserves receipt privately, and consumes only official ticket/session',async()=>{
 const f=fixture(false,{createIn:()=>({status:'complete',createdSessionId:'sess_reserved'})}),calls=[]
 const backend={start:async d=>{calls.push(['start',d]);return {status:'code'}},verify:async code=>{calls.push(['verify',code]);return {status:'verified',ticket:'private-ticket',subject:'user_reserved'}}}
 const model=createClerkConversation(f.sdk,true,null,backend)
 for(const v of ['female','Ada','Testowa','synthetic@example.test'])await model.submit(v)
 assert.equal(model.state.step,'code');assert.equal(f.calls.length,0);assert.equal(calls[0][1].avatar,'female')
 await model.submit('123456');assert.equal(model.state.complete,true);assert.deepEqual(f.calls,[['createIn',{strategy:'ticket',ticket:'private-ticket'}],['activate',{session:'sess_reserved'}]])
 assert.equal(model.registrationAvatar('user_reserved'),'female');assert(!JSON.stringify(model.state).includes('private-ticket'))
})
test('existing account is directed to login; backend failure cannot fall back to an unpersonalised signup',async()=>{
 const f=fixture();const model=createClerkConversation(f.sdk,true,null,{start:async()=>({status:'login'}),verify:async()=>{throw Error()}})
 for(const v of ['male','Adam','Testowy','synthetic@example.test'])await model.submit(v)
 assert.equal(model.state.step,'existing');assert.equal(model.state.complete,false);assert.equal(f.calls.length,0)
})
