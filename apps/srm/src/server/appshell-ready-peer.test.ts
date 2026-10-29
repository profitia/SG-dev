import test from 'node:test'
import assert from 'node:assert/strict'
import {createClerkIdentityAuthenticator} from '@profitia/platform-contracts/identity-provider'
import {createCurrentHumanReadIdentity} from '@profitia/platform-contracts/current-human-read'
import {createPeerOperationSigner,peerOperationIdentityRequest,type PeerOperationConfiguration} from '@profitia/platform-contracts/peer-operation'
import {OperationDenied} from '@profitia/platform-contracts/operation-context'
import {createSrmSupplierOperationHandler} from './supplier-acquisition-http'
import {withSrmPeerXRay} from './peer-xray'
import type {SrmSupplierApi} from './supplier-api-composition'
import {sampleCard} from '../demo/fixture'

const source='https://dev-sg2.spendguru.app',target='https://srm-development-runtime.onrender.com'
const org='11111111-1111-4111-8111-111111111111',issuer='https://synthetic.accounts.dev'
const secret=Buffer.alloc(32,7),key='synthetic-ready-peer-request-123456'
const peer:PeerOperationConfiguration={environment:'development',callerApplicationId:'spendguru',receiverApplicationId:'srm',sourceOrigin:source,targetOrigin:target,
 keyId:'synthetic-ready-peer',key:new Uint8Array(secret),routes:[{method:'POST',path:'/api/xray/search',maximumRequestBytes:2048,requireIdempotencyKey:true}],internalOrigins:[]}
const environment={TARGET_ENVIRONMENT:'development',PROFITIA_AUTH_PROVIDER:'clerk',RENDER_SERVICE_ID:'srv-db1vu6gm7kps73d0e3r0',
 PROFITIA_XRAY_PEER_VERSION:'1.0.0',PROFITIA_XRAY_PEER_KEY_ID:peer.keyId,PROFITIA_XRAY_PEER_KEY:secret.toString('base64url')}
const card={...sampleCard,identity:{...sampleCard.identity,nip:'8650004194',krs:'0000000001'},
 general:{...sampleCard.general,data:{...sampleCard.general.data!,nip:'8650004194',krs:'0000000001'}},
 kys:{...sampleCard.kys,status:'NOT_REQUESTED' as const,data:null}}

function fixture(azp=source){
 const now=Date.now(),calls:string[]=[],sdkOrigins:string[]=[]
 let banned=false,denied=false,sessions=0,accounts=0
 const facts={isAuthenticated:true,tokenType:'session_token',userId:'synthetic-subject',sessionId:'synthetic-session',
  sessionClaims:{iss:issuer,sub:'synthetic-subject',sid:'synthetic-session',azp,exp:Math.floor(now/1000)+300}}
 const client={authenticateRequest:async(request:Request)=>{sdkOrigins.push(new URL(request.url).origin);return {status:'signed-in',isAuthenticated:true,toAuth:()=>facts}},
  sessions:{getSession:async()=>{sessions++;return {id:facts.sessionId,userId:facts.userId,status:'active',actor:null,expireAt:now+300000,abandonAt:now+300000}}},
  users:{getUser:async()=>{accounts++;return {id:facts.userId,banned,locked:false,deprovisioned:false}}}}
 const application={appId:'srm',environment:'development' as const,issuer,authorizedParties:[source,target],
  requestBoundary:{publicOrigins:[source,target],internalOrigins:['http://0.0.0.0:10000','https://0.0.0.0:10000']}}
 const resolveBinding=async()=>({environment:'development' as const,issuer,subject:facts.userId,status:'ACTIVE' as const,
  userId:'00000000-0000-4000-8000-000000000001',version:'1',sourceRef:'SYNTHETIC_ONLY',expiresAt:new Date(now+300000).toISOString()})
 const ordinary=createClerkIdentityAuthenticator({client,application,resolveBinding})
 const current=async(request:Request)=>{
  const actor=await ordinary(peerOperationIdentityRequest(request)??request)
  if(!actor)throw new OperationDenied('UNVERIFIED_IDENTITY')
  if(denied)throw new OperationDenied('PERMISSION_DENIED')
 }
 const api={
  // Exercise the formally accepted shared identity adapter on both entrances.
  ready:async({request}:{request:Request})=>{
   calls.push('ready')
   const identity=createCurrentHumanReadIdentity({client,application,resolveBinding})
   try{
    const actor=await identity.authenticate(request)
    if(!actor)throw new OperationDenied('UNVERIFIED_IDENTITY')
    if(denied)throw new OperationDenied('PERMISSION_DENIED')
    if(!await identity.revalidate(request,actor))throw new OperationDenied('UNVERIFIED_IDENTITY')
   }
   finally{identity.close()}
   return {known:true,response:Response.json(card)}
  },
  known:async({request}:{request:Request})=>{calls.push('known');await current(request);return true},
  company:async({request}:{request:Request})=>{calls.push('company');await current(request);return Response.json(card)},
  jdg:async()=>{throw Error('A known company must not trigger JDG/provider acquisition')},
 } as unknown as SrmSupplierApi
 const handler=withSrmPeerXRay(createSrmSupplierOperationHandler('search',api,org),environment)
 return {handler,calls,sdkOrigins,setBanned:()=>{banned=true},setDenied:()=>{denied=true},checks:()=>({sessions,accounts})}
}
function request(origin?:string){
 return new Request(target+'/api/xray/search',{method:'POST',headers:{authorization:'Bearer synthetic-session-token','content-type':'application/json','idempotency-key':key,
  ...(origin?{origin}: {})},body:JSON.stringify({identifier:card.identity.nip})})
}
const signed=()=>createPeerOperationSigner(peer)(request())

test('valid AppShell peer uses the same optimized READY without native company reconstruction',async()=>{
 const f=fixture(),response=await f.handler(await signed())
 assert.equal(response.status,200)
 const body=await response.json();assert.equal(body.contract.version,'1.0.0');assert.equal(body.data.card.identity.nip,card.identity.nip)
 assert.deepEqual(f.calls,['ready']);assert.deepEqual(f.sdkOrigins,[source])
 assert.deepEqual(f.checks(),{sessions:2,accounts:2})
})
test('standalone SRM preserves the optimized READY path and does not start native acquisition',async()=>{
 const f=fixture(target),response=await f.handler(request(target))
 assert.equal(response.status,200);assert.equal((await response.json()).card.identity.nip,card.identity.nip)
 assert.deepEqual(f.calls,['ready']);assert.deepEqual(f.sdkOrigins,[target])
})
test('malformed peer proof and direct cross-origin requests never enter supplier ports',async()=>{
 for(const mode of ['bad-proof','direct-origin']){
  const f=fixture(),input=request(mode==='direct-origin'?source:undefined)
  if(mode==='bad-proof')input.headers.set('x-profitia-peer-operation','invalid')
  assert.equal((await f.handler(input)).status,403);assert.deepEqual(f.calls,[]);assert.deepEqual(f.sdkOrigins,[])
 }
})
test('revoked account and permission denial remain authoritative before company retrieval',async()=>{
 for(const denied of [false,true]){
  const f=fixture();if(denied)f.setDenied();else f.setBanned()
  const response=await f.handler(await signed())
 assert.equal(response.status,denied?403:401);assert.deepEqual(f.calls,['ready'])
  const body=await response.json();assert(!Object.hasOwn(body,'data'))
 }
})
test('expired proof and injected tenant fields are refused without changing the company workflow',async()=>{
 const expired=await createPeerOperationSigner(peer,{now:()=>Date.now()-61000})(request())
 const f=fixture();assert.equal((await f.handler(expired)).status,403);assert.deepEqual(f.calls,[])
 const forged=new Request(target+'/api/xray/search',{method:'POST',headers:{authorization:'Bearer synthetic-session-token','content-type':'application/json','idempotency-key':key},
  body:JSON.stringify({identifier:card.identity.nip,organisationId:org})})
 assert.equal((await f.handler(await createPeerOperationSigner(peer)(forged))).status,400);assert.deepEqual(f.calls,[])
})
