import test from 'node:test'
import assert from 'node:assert/strict'
import {createPeerOperationSigner,createPeerOperationVerifier,hasVerifiedPeerOperation,peerOperationAttribution,peerOperationIdentityRequest,PEER_OPERATION_HEADER} from '../src/peer-operation.mjs'
import {createClerkIdentityAuthenticator} from '../src/identity-provider.mjs'

const source='https://caller.example.test',target='https://receiver.example.test',time=2_000_000_000_000
const identifier='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
function config(change={}) {return {environment:'development',callerApplicationId:'sg2',receiverApplicationId:'srm',sourceOrigin:source,targetOrigin:target,
  keyId:'peer-fixture-v1',key:new Uint8Array(32).fill(91),internalOrigins:['http://0.0.0.0:10000'],
  routes:[{method:'POST',path:'/api/xray/search',maximumRequestBytes:2048,requireIdempotencyKey:true}],...change}}
const request=(change={})=>new Request(target+'/api/xray/search',{method:'POST',headers:{authorization:'Bearer synthetic-only','content-type':'application/json','idempotency-key':identifier},body:'{"identifier":"0000000000"}',...change})
const signer=(change={},deps={})=>createPeerOperationSigner(config(change),{now:()=>time,newRequestId:()=>identifier,...deps})
const verifier=(change={},deps={})=>createPeerOperationVerifier(config(change),{now:()=>time,...deps})

test('the exact signed business request remains readable and has only a separate caller receipt',async()=>{
  const signed=await signer()(request());assert.equal(peerOperationIdentityRequest(signed),null)
  assert(await verifier()(signed));assert.equal(signed.bodyUsed,false)
  assert.deepEqual(peerOperationAttribution(signed),{callerApplicationId:'sg2',receiverApplicationId:'srm',requestId:identifier})
  const identity=peerOperationIdentityRequest(signed)
  assert.equal(identity.url,source+'/api/xray/search');assert.equal(identity.headers.get('authorization'),'Bearer synthetic-only');assert.equal(identity.body,null)
  assert.equal(identity.headers.has(PEER_OPERATION_HEADER),false);assert.equal(identity.headers.has('cookie'),false)
  assert.equal(await signed.text(),'{"identifier":"0000000000"}')
  assert.equal(peerOperationAttribution(signed).actorId,undefined)
})
test('copying signed headers never copies request-object verification authority',async()=>{
  const signed=await signer()(request());assert(await verifier()(signed))
  const copy=signed.clone();assert.equal(hasVerifiedPeerOperation(copy),false);assert.equal(peerOperationIdentityRequest(copy),null)
  assert(await verifier()(copy));assert(hasVerifiedPeerOperation(copy))
})
test('the proxy authority is exact and forwarded headers cannot select the receiver',async()=>{
  const signed=await signer()(request()),headers=new Headers(signed.headers);headers.set('host',new URL(target).host);headers.set('x-forwarded-host','evil.example.test')
  const internal=new Request('http://0.0.0.0:10000/api/xray/search',{method:'POST',headers,body:await signed.text()})
  assert(await verifier()(internal));assert.equal(peerOperationIdentityRequest(internal).url,source+'/api/xray/search')
  assert.equal(peerOperationIdentityRequest(internal).headers.has('x-forwarded-host'),false)
  headers.set('host','evil.example.test')
  assert.equal(await verifier()(new Request('http://0.0.0.0:10000/api/xray/search',{method:'POST',headers,body:'{"identifier":"0000000000"}'})),false)
})
for(const [name,mutate]of [
  ['changed body',async(s,h)=>request({headers:h,body:'{"identifier":"1111111111"}'})],
  ['changed bearer',async(s,h)=>{h.set('authorization','Bearer foreign');return request({headers:h})}],
  ['changed idempotency',async(s,h)=>{h.set('idempotency-key','different-intent');return request({headers:h})}],
  ['unlisted path',async(s,h)=>new Request(target+'/api/xray/kys/pesel',{method:'POST',headers:h,body:'{}'})],
  ['changed method',async(s,h)=>new Request(target+'/api/xray/search',{headers:h})],
  ['tenant query',async(s,h)=>new Request(target+'/api/xray/search?organisationId='+identifier,{method:'POST',headers:h,body:'{"identifier":"0000000000"}'})],
  ['browser Origin',async(s,h)=>{h.set('origin',source);return request({headers:h})}],
  ['cookie',async(s,h)=>{h.set('cookie','session=foreign');return request({headers:h})}],
  ['identity header',async(s,h)=>{h.set('x-user-id',identifier);return request({headers:h})}],
  ['unsigned SRM admission',async(s,h)=>{h.set('x-srm-report-admission','unverified');return request({headers:h})}],
  ['changed receiver',async(s,h)=>new Request('https://foreign.example.test/api/xray/search',{method:'POST',headers:h,body:'{"identifier":"0000000000"}'})],
  ['damaged signature',async(s,h)=>{h.set(PEER_OPERATION_HEADER,h.get(PEER_OPERATION_HEADER).slice(0,-1)+'!');return request({headers:h})}],
  ['missing signature',async(s,h)=>{h.delete(PEER_OPERATION_HEADER);return request({headers:h})}],
])test('peer verifier denies '+name+' before granting a verified transport',async()=>{
  const signed=await signer()(request()),altered=await mutate(signed,new Headers(signed.headers))
  assert.equal(await verifier()(altered),false);assert.equal(peerOperationIdentityRequest(altered),null)
})
test('wrong caller, receiver, key ID and key are denied independently of a syntactically valid user bearer',async()=>{
  for(const change of [{callerApplicationId:'foreign'},{receiverApplicationId:'foreign'},{keyId:'foreign-key'},{key:new Uint8Array(32).fill(92)}]){
    const signed=await signer(change)(request());assert.equal(await verifier()(signed),false)
  }
})
test('expired, future, aborted and changed requests lose authority with no cached fallback',async()=>{
  let now=time
  const signed=await signer()(request());assert(await verifier({}, {now:()=>now})(signed));now+=60000
  assert.equal(hasVerifiedPeerOperation(signed),false);assert.equal(peerOperationIdentityRequest(signed),null);assert.equal(await verifier({}, {now:()=>now})(signed),false)
  const future=await signer({}, {now:()=>time+3000})(request());assert.equal(await verifier()(future),false)
  const controller=new AbortController(),aborted=await signer()(request({signal:controller.signal}));controller.abort();assert.equal(await verifier()(aborted),false)
  const changed=await signer()(request());assert(await verifier()(changed));changed.headers.set('authorization','Bearer changed')
  assert.equal(hasVerifiedPeerOperation(changed),false);assert.equal(peerOperationIdentityRequest(changed),null)
})
test('configuration and payload bounds fail closed without a secret or general proxy fallback',async()=>{
  for(const change of [{environment:'production'},{key:new Uint8Array(31)},{sourceOrigin:source+'/'},{targetOrigin:source},{internalOrigins:['http://10.0.0.1:10000']},
    {routes:[{method:'POST',path:'/api/../admin',maximumRequestBytes:2048,requireIdempotencyKey:true}]}])assert.throws(()=>verifier(change),TypeError)
  await assert.rejects(signer()(request({body:'x'.repeat(2049)})),/Peer request refused/)
  assert.equal(await verifier()(request()),false)
})
function identityFixture(){
  const f={claims:{iss:'https://fixture.clerk.accounts.dev',sub:'subject-fixture',sid:'session-fixture',azp:source,exp:time/1000+60},
    session:{id:'session-fixture',userId:'subject-fixture',status:'active',expireAt:time+600000,abandonAt:time+600000,actor:null},
    user:{id:'subject-fixture',banned:false,locked:false,deprovisioned:false},calls:[]}
  const client={authenticateRequest:async(req)=>{f.calls.push('sdk');assert.equal(new URL(req.url).origin,source);return {status:'signed-in',isAuthenticated:true,toAuth:()=>({isAuthenticated:true,tokenType:'session_token',userId:'subject-fixture',sessionId:'session-fixture',sessionClaims:f.claims})}},
    sessions:{getSession:async()=>{f.calls.push('session');return f.session}},users:{getUser:async()=>{f.calls.push('user');return f.user}}}
  f.authenticate=createClerkIdentityAuthenticator({client,application:{appId:'srm',environment:'development',issuer:f.claims.iss,authorizedParties:[source,target]},now:()=>time,
    resolveBinding:async()=>{f.calls.push('binding');return {environment:'development',issuer:f.claims.iss,subject:f.claims.sub,userId:identifier,status:'ACTIVE',version:'fixture',sourceRef:'fixture',expiresAt:new Date(time+600000).toISOString()}}})
  return f
}
test('a verified caller still needs the ordinary current SDK session/account/binding; actor audience remains SRM',async()=>{
  const signed=await signer()(request());assert(await verifier()(signed));const f=identityFixture()
  const actor=await f.authenticate(peerOperationIdentityRequest(signed));assert.equal(actor.audience,'srm');assert.equal(actor.userId,identifier);assert.deepEqual(f.calls,['sdk','session','user','binding'])
  f.session.status='revoked';assert.equal(await f.authenticate(peerOperationIdentityRequest(signed)),null)
})
for(const [name,change]of [['expired bearer',f=>f.claims.exp=time/1000],['wrong azp',f=>f.claims.azp=target],['banned account',f=>f.user.banned=true],['wrong session user',f=>f.session.userId='foreign']])
  test('valid peer-caller proof cannot override '+name,async()=>{
    const signed=await signer()(request());assert(await verifier()(signed));const f=identityFixture();change(f)
    assert.equal(await f.authenticate(peerOperationIdentityRequest(signed)),null)
  })
