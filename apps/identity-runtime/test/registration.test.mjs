import test from 'node:test'
import assert from 'node:assert/strict'
import {registrationLanguage,registrationDraft,createRegistrationSurface} from '../dist/src/registration.js'
import {createHttpHandler} from '../dist/src/http-handler.js'
import {fixture} from './fixtures.mjs'
const input={email:' SYNTHETIC@example.test ',firstName:'Ada',lastName:'Testowa',avatar:'female',browserLanguage:'en-GB'}
test('communication language uses the primary browser locale, never nationality or requested permissions',()=>{
 for(const x of ['pl','PL-pl','pl-PL'])assert.equal(registrationLanguage(x),'pl')
 for(const x of ['de-DE','en-GB','uk','',undefined])assert.equal(registrationLanguage(x),'en')
 assert.deepEqual(registrationDraft(input),{email:'synthetic@example.test',firstName:'Ada',lastName:'Testowa',avatar:'female',language:'en'})
 for(const patch of [{userId:'forged'},{organisationId:'forged'},{registration_status:'Finished'},{avatar:'other'},{browserLanguage:4},{firstName:'\0Bad'}])assert.throws(()=>registrationDraft({...input,...patch}))
})
test('public registration uses same-origin JSON POST and bounded body; it never accepts bearer identity as a draft',async()=>{
 const f=fixture(),calls=[],surface={ready:async()=>{},start:async v=>{calls.push(v);return {status:'code'}},verify:async v=>{calls.push(v);return {status:'verified'}}}
 const h=createHttpHandler(f.boundary,null,null,null,null,surface)
 assert.equal((await h(f.request('/v1/registration/start','POST',input))).status,200)
 const count=calls.length
 for(const [i,headers] of [{origin:'https://foreign.test','content-type':'application/json'},{origin:f.config.origin,'content-type':'text/plain'},{origin:f.config.origin,'content-type':'application/json','sec-fetch-site':'cross-site'}].entries())assert.equal((await h(new Request(f.config.origin+'/v1/registration/start',{method:'POST',headers,body:JSON.stringify(input)}))).status,[403,400,403][i])
 assert.equal((await h(f.request('/v1/registration/start'))).status,405)
 assert.equal((await h(f.request('/v1/registration/start?x=1','POST',input))).status,404)
 assert.equal(calls.length,count)
})
test('verification commits attempt counter before contacting provider and never issues ticket for a wrong code',async()=>{
 const calls=[],receipt={attemptId:'11111111-1111-4111-8111-111111111111',token:'a'.repeat(43)}
 const store={ready:async()=>{},command:async(op,p,extra)=>{calls.push([op,extra]);return {subject:'user_fixture',emailAddressId:'idn_fixture',verificationId:'ver_fixture',ciphertext:'encrypted'}},decrypt:()=>{throw Error('wrong code must not decrypt')}}
 const provider={guard:async()=>{},verify:async()=>{calls.push(['provider']);return false},ticket:async()=>{throw Error('must not ticket')}}
 const surface=createRegistrationSurface(store,provider);await assert.rejects(surface.verify({...receipt,code:'000000'}),e=>e.code==='INVALID_CODE')
 assert.deepEqual(calls.map(c=>c[0]),['verify','provider','verified']);assert.deepEqual(calls.at(-1)[1],{verified:false})
})
