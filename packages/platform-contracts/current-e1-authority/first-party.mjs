import {createHash,createPrivateKey,createPublicKey,sign,verify,randomUUID,randomBytes} from 'node:crypto'
import {OperationDenied,createOperationExecutor} from '@profitia/platform-contracts/operation-context'
import {createAccessStore} from '@profitia/platform-contracts/access-store'
import {createClerkIdentityAuthenticator} from '@profitia/platform-contracts/identity-provider'

export const FIRST_PARTY_SOURCE_CONTRACT=Object.freeze({id:'profitia.first-party-source-access',version:'1.0.0'})
export const FIRST_PARTY_SOURCE_HEADER='x-profitia-source-consumer'
const tag=FIRST_PARTY_SOURCE_CONTRACT.id+'/'+FIRST_PARTY_SOURCE_CONTRACT.version
const keys=['contract','environment','componentId','consumerApplicationId','receiverApplicationId','sourceOrigin','targetOrigin','keyId','requestId','issuedAt','expiresAt','method','path','bodyDigest','credentialDigest','idempotencyDigest']
const id=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const hash=/^[a-f0-9]{64}$/
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const deny=()=>{throw new OperationDenied('UNVERIFIED_IDENTITY')}
export const sourceAccessDigest=value=>createHash('sha256').update(value).digest('hex')
function plain(v,allowed){return v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).sort().join(',')===[...allowed].sort().join(',')}
function origin(v){try{const u=new URL(v);return u.origin===v&&u.protocol==='https:'&&!u.username&&!u.password&&!u.hostname.includes('*')}catch{return false}}
function sourceRef(v){return typeof v==='string'&&v.length<=256&&(origin(v)||/^urn:profitia:service:[a-zA-Z0-9:._-]+$/.test(v))}
function decode(value){
 if(typeof value!=='string'||value.length>8192||!value.includes('.'))deny()
 const parts=value.split('.');if(parts.length!==2)deny()
 const raw=Buffer.from(parts[0],'base64url'),signature=Buffer.from(parts[1],'base64url')
 if(raw.toString('base64url')!==parts[0]||signature.toString('base64url')!==parts[1]||signature.length!==64)deny()
 let payload;try{payload=JSON.parse(raw.toString('utf8'))}catch{deny()}
 if(!plain(payload,keys))deny()
 return {payload,raw:raw.toString('utf8'),signature:parts[1]}
}
/** A component's own asymmetric credential authenticates transport only.
 * No organisation, user, grant or provider permission follows from a key. */
export function createFirstPartySourceSigner(c,{now=Date.now,newRequestId=randomUUID}={}){
 if(c?.environment!=='development'||!id.test(c.componentId??'')||!id.test(c.consumerApplicationId??'')||!id.test(c.receiverApplicationId??'')
 ||!id.test(c.keyId??'')||!sourceRef(c.sourceOrigin)||!origin(c.targetOrigin))throw TypeError('Explicit Development first-party component binding required')
 const key=c.privateKey?.type==='private'?c.privateKey:createPrivateKey(c.privateKey);if(key.asymmetricKeyType!=='ed25519')throw TypeError('Per-component Ed25519 key required')
 return async request=>{
  if(!(request instanceof Request))deny()
  const u=new URL(request.url),idem=request.headers.get('idempotency-key'),credential=request.headers.get('authorization')??''
  if(u.origin!==c.targetOrigin||u.pathname!=='/v1/acquire'||u.search||u.hash||request.method!=='POST'||request.headers.has('cookie')||request.headers.has('origin')
   ||request.headers.get('content-type')!=='application/json'||request.headers.has(FIRST_PARTY_SOURCE_HEADER)||!idem||!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(idem)
   ||credential&&!/^Bearer [\x21-\x7e]{1,16384}$/.test(credential))deny()
  const body=Buffer.from(await request.clone().arrayBuffer());if(body.length>16384)deny()
  const issuedAt=now(),requestId=newRequestId();if(!Number.isSafeInteger(issuedAt)||!uuid.test(requestId))deny()
  const payload={contract:tag,environment:c.environment,componentId:c.componentId,consumerApplicationId:c.consumerApplicationId,receiverApplicationId:c.receiverApplicationId,
   sourceOrigin:c.sourceOrigin,targetOrigin:c.targetOrigin,keyId:c.keyId,requestId,issuedAt,expiresAt:issuedAt+60000,method:'POST',path:'/v1/acquire',
   bodyDigest:sourceAccessDigest(body),credentialDigest:sourceAccessDigest(credential),idempotencyDigest:sourceAccessDigest(idem)}
  const raw=Buffer.from(JSON.stringify(payload)),header=raw.toString('base64url')+'.'+sign(null,raw,key).toString('base64url')
  const headers=new Headers(request.headers);headers.set(FIRST_PARTY_SOURCE_HEADER,header)
  return new Request(request,{headers})
 }
}
/** Syntax/freshness and HTTP binding only. The Identity registry must verify
 * the signature and current grants before this untrusted claim is consumed. */
export async function readFirstPartySourceClaim(request,{receiverApplicationId,targetOrigin,now=Date.now}){
 if(!(request instanceof Request)||request.headers.has('cookie')||request.headers.has('origin')||request.headers.has('x-profitia-peer-operation')
  ||request.headers.get('content-type')!=='application/json')deny()
 const claim=decode(request.headers.get(FIRST_PARTY_SOURCE_HEADER)),p=claim.payload,u=new URL(request.url)
 assertFirstPartySourceClaim(claim,{receiverApplicationId,targetOrigin,now})
 const body=Buffer.from(await request.clone().arrayBuffer())
 if(body.length>16384||u.origin!==targetOrigin||u.pathname!==p.path||u.search||u.hash||request.method!==p.method
  ||sourceAccessDigest(body)!==p.bodyDigest||sourceAccessDigest(request.headers.get('authorization')??'')!==p.credentialDigest
  ||sourceAccessDigest(request.headers.get('idempotency-key')??'')!==p.idempotencyDigest)deny()
 return Object.freeze({payload:Object.freeze({...p}),raw:claim.raw,signature:claim.signature})
}
export function assertFirstPartySourceClaim(claim,{receiverApplicationId,targetOrigin,now=Date.now}){
 const p=claim?.payload
 if(!plain(p,keys)||p.contract!==tag||p.environment!=='development'||p.receiverApplicationId!==receiverApplicationId||p.targetOrigin!==targetOrigin
  ||!origin(targetOrigin)||!sourceRef(p.sourceOrigin)||!id.test(p.componentId??'')||!id.test(p.consumerApplicationId??'')||!id.test(p.keyId??'')||!uuid.test(p.requestId??'')
  ||p.method!=='POST'||p.path!=='/v1/acquire'
  ||!Number.isSafeInteger(p.issuedAt)||!Number.isSafeInteger(p.expiresAt)||p.issuedAt>now()+3000||p.expiresAt<=now()||p.expiresAt-p.issuedAt!==60000
  ||!['bodyDigest','credentialDigest','idempotencyDigest'].every(k=>hash.test(p[k]??''))||JSON.stringify(p)!==claim.raw)deny()
 return p
}
/** Called only after reading the current key from the canonical E1 registry.
 * A revoked/rotated key is never accepted from a process-local trust cache. */
export function verifyFirstPartySourceClaim(claim,registered,options){
 try{
  const p=assertFirstPartySourceClaim(claim,options)
  const instant=(options.now??Date.now)()
  if(!registered||registered.status!=='ACTIVE'||registered.componentId!==p.componentId||registered.consumerApplicationId!==p.consumerApplicationId||registered.keyId!==p.keyId
   ||registered.sourceOrigin!==p.sourceOrigin||registered.receiverApplicationId!==p.receiverApplicationId||registered.targetOrigin!==p.targetOrigin
   ||!Number.isFinite(Date.parse(registered.expiresAt))||Date.parse(registered.expiresAt)<=instant)return false
  const key=createPublicKey(registered.publicKey);return key.asymmetricKeyType==='ed25519'&&verify(null,Buffer.from(claim.raw),key,Buffer.from(claim.signature,'base64url'))
 }catch{return false}
}

const unavailable=()=>{throw new OperationDenied('POLICY_UNAVAILABLE')}
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value}
async function one(query,sql,values=[]){try{const r=await query(sql,values);if(r?.rows?.length!==1)unavailable();return r.rows[0]}catch{unavailable()}}
async function responseJson(response){
 const reader=response.body?.getReader();if(!reader)unavailable();const chunks=[];let size=0
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>32768)unavailable();chunks.push(value)}}finally{void reader.cancel().catch(()=>{});reader.releaseLock()}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{unavailable()}
}
function inputClaim(value){
 if(!plain(value,['payload','signature'])||typeof value.payload!=='string'||value.payload.length>4096||typeof value.signature!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(value.signature)||Buffer.from(value.signature,'base64url').toString('base64url')!==value.signature)deny()
 let payload;try{payload=JSON.parse(value.payload)}catch{deny()}
 return {payload,raw:value.payload,signature:value.signature}
}
/** Current Identity/E1 facts, plus per-component signature verification. This
 * is not a directory replica or a second business permission engine. */
export function createFirstPartySourceAuthority({query,client,binding,now=Date.now}){
 if(binding?.applicationId!=='identity-runtime-development'||binding.environment!=='development')throw TypeError('Existing Development Identity owner required')
 const store=createAccessStore({binding,now})
 return Object.freeze({
  async ready(){try{return (await one(query,'SELECT profitia_e1_authority.source_ready() AS ready')).ready===true}catch{return false}},
  async authorize(request,input){
   if(!(request instanceof Request)||request.headers.has('cookie')||request.headers.has('origin')||!plain(input,['consumerProof','challenge','previous']))deny()
   const captured=freeze(structuredClone(input)),claim=inputClaim(captured.consumerProof),p=claim.payload,challenge=captured.challenge
   const registered=(await one(query,'SELECT profitia_e1_authority.source_consumer($1,$2) AS consumer',[p?.componentId,p?.keyId])).consumer
   if(!registered||!verifyFirstPartySourceClaim(claim,registered,{receiverApplicationId:registered.receiverApplicationId,targetOrigin:registered.targetOrigin,now})
    ||challenge?.consumerProofDigest!==sourceAccessDigest(claim.raw+'.'+claim.signature)||challenge?.componentId!==p.componentId||challenge?.keyId!==p.keyId
    ||challenge?.consumerRequestId!==p.requestId||challenge?.requestDigest!==p.bodyDigest
    ||sourceAccessDigest(request.headers.get('authorization')??'')!==p.credentialDigest)deny()
   let identity=null,actor=null
   if(challenge.kind==='HUMAN'){
    if(!/^Bearer [\x21-\x7e]{1,16384}$/.test(request.headers.get('authorization')??''))deny()
    const receiver=(await one(query,'SELECT profitia_e1_authority.receiver($1) AS receiver',[registered.receiverApplicationId])).receiver
    if(!receiver)deny()
    const parties=[...new Set([...receiver.authorizedParties,registered.targetOrigin])]
    const authenticate=createClerkIdentityAuthenticator({client,application:{appId:registered.receiverApplicationId,environment:'development',issuer:receiver.issuer,authorizedParties:parties,
     bearerPeerReads:parties.filter(o=>o!==registered.targetOrigin).map(sourceOrigin=>({sourceOrigin,targetOrigin:registered.targetOrigin,path:'/'}))},now,
     resolveBinding:async key=>{identity=freeze(structuredClone(key));return store.resolveBinding(query,key)}})
    actor=await authenticate(new Request(registered.targetOrigin+'/',{headers:{authorization:request.headers.get('authorization')}}))
    if(!identity||!actor)deny()
   }else if(challenge.kind!=='SERVICE'||request.headers.has('authorization'))deny()
   const proof=(await one(query,'SELECT profitia_e1_authority.issue_source($1::jsonb,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6::jsonb) AS proof',
    [JSON.stringify(p),registered.keyDigest,identity===null?null:JSON.stringify(identity),actor===null?null:JSON.stringify(actor),JSON.stringify(challenge),captured.previous===null?null:JSON.stringify(captured.previous)])).proof
   if(!proof)throw new OperationDenied('ACCESS_BASIS_INVALID')
   return freeze(structuredClone(proof))
  }
 })
}

/** Consumer knowledge.read grants data entitlement. Actual upstream effects
 * remain the separate Source-owned knowledge.ingest admission/receipt path.
 * Current facts are observed at admission AND before the local commit. */
export function createFirstPartySourceHost({application,binding,independentQuery,transact,fetch:send=globalThis.fetch,now=Date.now}){
 application=freeze(structuredClone(application));binding=freeze(structuredClone(binding))
 if(application?.environment!=='development'||binding?.environment!=='development'||binding.applicationId!==application.appId||application.profileId!=='SPENDGURU_SAAS'
  ||[independentQuery,transact,send,now].some(f=>typeof f!=='function'))throw TypeError('Explicit current E1 source receiver required')
 const audit=createAccessStore({binding,now})
 const descriptor=async query=>{
  const d=(await one(query,'SELECT profitia_e1_receiver.source_descriptor() AS descriptor')).descriptor
  if(d?.contract!==tag||!d.binding||JSON.stringify(Object.entries(d.binding).sort())!==JSON.stringify(Object.entries(binding).sort())||!origin(d.authorityOrigin))unavailable()
  return freeze(structuredClone(d))
 }
 async function remote(d,request,claim,challenge,previous=null){
  let response;try{response=await send(d.authorityOrigin+'/v1/e1/source/authorize',{method:'POST',redirect:'error',signal:AbortSignal.any([request.signal,AbortSignal.timeout(3000)]),
   headers:{'content-type':'application/json',...(request.headers.has('authorization')?{authorization:request.headers.get('authorization')}:{})},
   body:JSON.stringify({consumerProof:{payload:claim.raw,signature:claim.signature},challenge,previous})})}catch{unavailable()}
  if(response.status===401||response.status===403)throw new OperationDenied('ACCESS_BASIS_INVALID')
  if(response.status!==200)unavailable();return responseJson(response)
 }
 return Object.freeze({contract:FIRST_PARTY_SOURCE_CONTRACT,
  async ready(){try{const d=await descriptor(independentQuery),r=await send(d.authorityOrigin+'/v1/e1/source/ready',{redirect:'error',signal:AbortSignal.timeout(3000)});return r.status===200&&(await responseJson(r)).ready===true}catch{return false}},
  async execute({request,execution,resourceId},action){
   if(!(request instanceof Request)||typeof action!=='function'||!/^api\.[a-z-]+\.[a-z-]+$/.test(resourceId??''))deny()
   const claim=await readFirstPartySourceClaim(request,{receiverApplicationId:application.appId,targetOrigin:application.publicOrigin,now}),captured=freeze(structuredClone(execution))
   const body=await request.clone().json().catch(deny)
   if(!body?.context||JSON.stringify(Object.entries(body.context).sort())!==JSON.stringify(Object.entries(captured??{}).sort())
    ||resourceId!=='api.'+body.request?.provider+'.'+body.request?.family)deny()
   const d=await descriptor(independentQuery);let outcome=null,completed=false
   try{return await transact(async({query,transaction})=>{
    if(query===independentQuery||typeof query!=='function'||!transaction)unavailable()
    if(JSON.stringify(await descriptor(query))!==JSON.stringify(d))unavailable()
    const challenge=(await one(query,'SELECT profitia_e1_receiver.source_challenge($1,$2::jsonb,$3::jsonb,$4,$5) AS challenge',
     [randomBytes(32).toString('hex'),JSON.stringify(claim.payload),JSON.stringify(captured),resourceId,sourceAccessDigest(claim.raw+'.'+claim.signature)])).challenge
    let proof=await remote(d,request,claim,challenge),accepted=(await one(query,'SELECT profitia_e1_receiver.source_accept($1::jsonb) AS proof',[JSON.stringify(proof)])).proof
    if(!accepted?.actor||!accepted.state||!accepted.consumer)unavailable()
    const actor=freeze(structuredClone(accepted.actor)),consumer=freeze(structuredClone(accepted.consumer))
    const app={...application,identityIssuer:actor.kind==='HUMAN'?application.identityIssuer:'urn:profitia:database-service-runtime:v1',features:['market'],operations:['knowledge.read']}
    const projectionVersion='first-party-source-v1'
    const executor=createOperationExecutor({application:app,now,authenticate:async()=>actor,recordAudit:event=>audit.appendAudit(independentQuery,event),
     withTransaction:async({request:bound},run)=>run({state:{...structuredClone(accepted.state),resource:{id:resourceId,type:'market_knowledge',dataClass:'SHARED_KNOWLEDGE',environment:binding.environment,
      ownerOrganisationId:null,ownerUserId:null,approvedSharedProjection:true,version:'1',projectionVersion}},transaction,transactionalEffects:true,outputBoundaryVersion:projectionVersion,
      projectOutput:value=>structuredClone(value),recordOutcome:async event=>{await one(query,'SELECT profitia_e1_receiver.source_append_audit($1::jsonb) AS audit',[JSON.stringify(event)]);outcome=structuredClone(event)}})})
    const answer=await executor.execute({contractId:executor.contract.id,contractVersion:executor.contract.version,operation:'knowledge.read',organisationId:captured.organisationId,resourceId,payload:null,request},
     (context,tx)=>action(context,tx,consumer))
    completed=true;proof=await remote(d,request,claim,challenge,proof)
    const final=(await one(query,'SELECT profitia_e1_receiver.source_accept($1::jsonb) AS proof',[JSON.stringify(proof)])).proof
    if(request.signal.aborted||final?.fingerprint!==accepted.fingerprint||final?.actor?.proofRef!==actor.proofRef)throw new OperationDenied('ACCESS_BASIS_INVALID')
    return answer.value
   },{timeoutMs:15000,maxWaitMs:3000})}catch(error){
    if(completed&&outcome)await audit.appendAudit(independentQuery,{...outcome,occurredAt:new Date(now()).toISOString(),phase:'FAILURE',decision:'DENY',reasonCode:error?.reasonCode==='ACCESS_BASIS_INVALID'?'ACCESS_BASIS_INVALID':'POLICY_UNAVAILABLE'})
    throw error
   }
  }
 })
}
