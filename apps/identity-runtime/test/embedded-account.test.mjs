import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, configuration, ids, origin } from './fixtures.mjs'
import { BoundaryError } from '../dist/src/contracts.js'
import { createEmbeddedAccountHandler, embeddedTargets } from '../dist/src/embedded-account.js'
const consumer='https://srm.example.test', token='synthetic_fixture_only'
function setup(patch={}) {
 const f=fixture({configPatch:{origin:consumer},...patch}), cfg=configuration(), calls=[]
 const surface={registration:{start:async x=>{calls.push(x);return {status:'code',attemptId:'attempt',token:'opaque'}},verify:async x=>{calls.push(x);return {status:'verified',ticket:'opaque-ticket',subject:'provider_a'}}},
 account:{ensure:async req=>{calls.push(req);const s=await f.boundary.session(req);if(s.status!=='authenticated')throw new BoundaryError(401,'SESSION_REQUIRED');return {authenticated:true,userId:s.actor.userId,expiresAt:s.actor.expiresAt}}},
 avatar:{read:async()=>({userId:ids.a,avatarSex:'female'})},language:{read:async()=>({userId:ids.a,language:'pl'})}}
 const handler=createEmbeddedAccountHandler(cfg,new Map([['srm',surface]]))
 const request=(operation='account',opts={})=>new Request(origin+'/v1/embedded/srm/'+operation,{method:'POST',headers:{origin:consumer,'content-type':'application/json',...(operation==='account'?{authorization:'Bearer '+token}:{}),...opts.headers},body:opts.body??'{}'})
 return {...f,cfg,surface,handler,request,embeddedCalls:calls}
}
test('navigation targets do not implicitly enable embedded writes',async()=>{
 const f=setup();assert.deepEqual(embeddedTargets(f.cfg,[]),[]);assert.deepEqual(embeddedTargets(f.cfg,['srm']),['srm'])
 for(const invalid of [null,{},['missing'],['srm','srm'],[{},'srm']])assert.throws(()=>embeddedTargets(f.cfg,invalid))
 assert.equal((await createEmbeddedAccountHandler(f.cfg,new Map())(f.request())).status,404)
})
test('exact origin CORS preflight excludes credentials',async()=>{
 const f=setup(), r=await f.handler(new Request(origin+'/v1/embedded/srm/account',{method:'OPTIONS',headers:{origin:consumer,'access-control-request-method':'POST','access-control-request-headers':'content-type,authorization,x-registration-receipt'}}))
 assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),consumer);assert.equal(r.headers.get('access-control-allow-credentials'),null);assert.equal(f.embeddedCalls.length,0)
 for(const headers of [{origin:'https://srm.example.test.evil.test'},{origin:'null'},{cookie:'session=anything'},{origin:''}])assert.equal((await f.handler(f.request('account',{headers}))).status,403)
})
test('receiver verifies SDK session and uses server-derived consumer origin',async()=>{
 const f=setup(),r=await f.handler(f.request());assert.equal(r.status,200)
 assert.deepEqual(Object.keys(await r.json()).sort(),['assistantAvatar','authenticated','communicationLanguage','expiresAt','userId'])
 assert.equal(f.embeddedCalls[0].url,consumer+'/v1/account');assert.equal(f.embeddedCalls[0].headers.get('cookie'),null)
 assert(f.calls.includes('sdk'));assert(f.calls.includes('binding'));assert(f.calls.includes('session'))
})
for(const patch of [{party:origin},{party:'https://sg2.example.test'},{tokenIssuer:'https://evil.test'},{tokenExpiry:1},{sessionStatus:'revoked'},{banned:true},{bindingStatus:'REVOKED'},{bindingMissing:true},{sdkError:true}])test('rejects '+JSON.stringify(patch),async()=>{
 const f=setup(patch);assert.notEqual((await f.handler(f.request())).status,200)
})
test('attempt protocol passes to canonical registration without credentials',async()=>{
 const f=setup(),draft={email:'fixture@example.test',avatar:'female',browserLanguage:'en-GB'}
 assert.equal((await f.handler(f.request('registration/start',{body:JSON.stringify(draft)}))).status,200);assert.deepEqual(f.embeddedCalls,[draft])
 assert.equal((await f.handler(f.request('registration/verify',{body:'{"code":"123456"}'}))).status,200)
 assert.equal((await f.handler(f.request('registration/start',{headers:{authorization:'Bearer '+token}}))).status,400)
})
test('rejects identity/tenant selectors and general proxy requests',async()=>{
 const f=setup();for(const body of ['{"userId":"x"}','{"organisationId":"x"}','[]','null','broken'])assert.equal((await f.handler(f.request('account',{body}))).status,400)
 for(const path of ['/v1/embedded/srm/admin','/v1/embedded/srm/account?target=sg2','/v1/embedded/missing/account'])assert.equal((await f.handler(new Request(origin+path))).status,404)
 assert.equal((await f.handler(f.request('account',{headers:{authorization:''}}))).status,401)
 assert.equal((await f.handler(f.request('account',{body:JSON.stringify({x:'x'.repeat(20000)})}))).status,413);assert.equal(f.embeddedCalls.length,0)
})
test('profile switch, missing preference or outage cannot confirm a mixed account',async()=>{
 const f=setup();f.surface.language.read=async()=>null;assert.equal((await f.handler(f.request())).status,409)
 f.surface.language.read=async()=>({userId:ids.b,language:'en'});assert.equal((await f.handler(f.request())).status,409)
 f.surface.language.read=async()=>{throw Error('outage')};assert.equal((await f.handler(f.request())).status,503)
})
