import test from 'node:test'
import assert from 'node:assert/strict'
import {performance} from 'node:perf_hooks'
import {reusePciTokenVerification,withinPciIdentityScope,withPciTokenReuse} from '../lib/platform/pci-identity-scope'
import {createClerkIdentityAuthenticator} from '@profitia/platform-contracts/identity-provider'
const origin='https://dev-sg2.spendguru.app',bearer='Bearer synthetic.payload.signature'
const req=(path='/api/benchmark/selection',extra:HeadersInit={})=>new Request(origin+path,{headers:{authorization:bearer,origin,...extra}})
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms))
test('only token verification is shared within one incoming request; parallel calls deduplicate',async()=>{
 let count=0;const verify=async()=>{count++;await delay(4);return{signed:true}}
 await withinPciIdentityScope(req('/api/cost-analysis/price-change-index'),async()=>{
  const result=await Promise.all(Array.from({length:12},(_,i)=>reusePciTokenVerification(req('/api/benchmark/history/'+i),{acceptsToken:'session_token'},verify)))
  assert.equal(count,1);assert(result.every(x=>x===result[0]))
 })
 await reusePciTokenVerification(req(),{},verify);await reusePciTokenVerification(req(),{},verify);assert.equal(count,3)
 await withinPciIdentityScope(req(),()=>reusePciTokenVerification(req(),{acceptsToken:'session_token'},verify));assert.equal(count,4)
})
test('scope cannot share authority across token, origin, cookies, options, requests or abort; failures evict',async()=>{
 let count=0;const verify=async()=>++count
 await withinPciIdentityScope(req(),async()=>{
  await reusePciTokenVerification(req(),{},verify)
  await reusePciTokenVerification(req(),{other:true},verify)
  await reusePciTokenVerification(req('/',{authorization:'Bearer another.token.signature'}),{},verify)
  await reusePciTokenVerification(new Request('https://foreign.example/',{headers:{authorization:bearer}}),{},verify)
  await reusePciTokenVerification(req('/',{cookie:'context=other'}),{},verify)
  const c=new AbortController();c.abort();await reusePciTokenVerification(new Request(origin,{headers:{authorization:bearer},signal:c.signal}),{},verify)
 });assert.equal(count,6)
 await Promise.all([withinPciIdentityScope(req(),()=>reusePciTokenVerification(req(),{},verify)),withinPciIdentityScope(req(),()=>reusePciTokenVerification(req(),{},verify))]);assert.equal(count,8)
 await withinPciIdentityScope(req(),async()=>{await assert.rejects(reusePciTokenVerification(req(),{},async()=>{throw Error('transient')}));await reusePciTokenVerification(req(),{},verify)});assert.equal(count,9)
})
function fixture(wrapped:boolean){
 const counts={token:0,session:0,user:0,binding:0};let revoked=false
 const client={authenticateRequest:async()=>{counts.token++;await delay(12);return{status:'signed-in',isAuthenticated:true,toAuth:()=>({isAuthenticated:true,tokenType:'session_token',userId:'user_test',sessionId:'sess_test',sessionClaims:{iss:'https://synthetic.accounts.dev',azp:origin,sub:'user_test',sid:'sess_test',exp:Math.floor(Date.now()/1000)+60}})}},
  sessions:{getSession:async()=>{counts.session++;return{id:'sess_test',userId:'user_test',status:revoked?'revoked':'active',expireAt:Date.now()+60000,abandonAt:Date.now()+60000}}},
  users:{getUser:async()=>{counts.user++;return{id:'user_test',banned:false,locked:false,deprovisioned:false}}}}
 const auth=createClerkIdentityAuthenticator({client:wrapped?withPciTokenReuse(client):client,application:{appId:'spendguru',environment:'development',issuer:'https://synthetic.accounts.dev',authorizedParties:[origin]},resolveBinding:async()=>{counts.binding++;return{environment:'development',issuer:'https://synthetic.accounts.dev',subject:'user_test',status:'ACTIVE',userId:'11111111-1111-4111-8111-111111111111',version:'1',sourceRef:'synthetic',expiresAt:new Date(Date.now()+60000).toISOString()}}})
 return{counts,auth,revoke:()=>{revoked=true}}
}
test('accepted authenticator still freshly checks session/user/binding at EVERY boundary and refuses revocation',async()=>{
 const f=fixture(true)
 await withinPciIdentityScope(req(),async()=>{
  assert(await f.auth(req()));assert(await f.auth(req('/api/history/a')));f.revoke();assert.equal(await f.auth(req('/api/history/b')),null)
 });assert.deepEqual(f.counts,{token:1,session:3,user:3,binding:2})
 assert.equal(await f.auth(new Request('https://foreign.example/',{headers:{authorization:bearer}})),null)
})
test('focused synthetic latency/count comparison for 2 and 5 components: no added authority loop',async t=>{
 for(const components of [2,5]){
  const before=fixture(false),after=fixture(true),start=performance.now()
  for(let i=0;i<=components;i++)assert(await before.auth(req('/api/read/'+i)))
  const beforeMs=performance.now()-start,begin=performance.now()
  await withinPciIdentityScope(req(),async()=>{for(let i=0;i<=components;i++)assert(await after.auth(req('/api/read/'+i)))})
  const afterMs=performance.now()-begin
  assert.equal(before.counts.token,components+1);assert.equal(after.counts.token,1)
  for(const key of ['session','user','binding'] as const)assert.equal(after.counts[key],before.counts[key])
  t.diagnostic(JSON.stringify({externalAuthority:'SYNTHETIC_ONLY',components,before:before.counts,after:after.counts,beforeMs,afterMs}))
 }
})
