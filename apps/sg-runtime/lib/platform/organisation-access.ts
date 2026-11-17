import {createPublicIdentityRequestBoundary} from '@profitia/platform-contracts/public-request'
import {createPeerOperationSigner,type PeerOperationConfiguration} from '@profitia/platform-contracts/peer-operation'
import {organisationContextConfiguration} from './organisation-context'
import {readSelfServiceAccountConfiguration} from './account-session'
type Environment=Readonly<Record<string,string|undefined>>
const headers={'content-type':'application/json','cache-control':'private, no-store',vary:'Authorization, Origin','x-content-type-options':'nosniff'}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const snapshotPath='/v1/account/organisation-onboarding/snapshot',accessPath='/v1/account/organisation-onboarding/access'
export function readOrganisationAccessConfiguration(env:Environment=process.env){
 const flag=env.PROFITIA_ORGANISATION_ACCESS_ENABLED
 if(flag===undefined||flag==='false')return null
 const account=readSelfServiceAccountConfiguration(env)
 if(flag!=='true'||!account||!/^[a-f0-9]{64}$/.test(env.PROFITIA_ORGANISATION_ACCESS_PEER_KEY??'')||!/^[-a-z0-9]{2,64}$/.test(env.PROFITIA_ORGANISATION_ACCESS_KEY_ID??''))throw Error('ORGANISATION_ACCESS_CONFIGURATION_REQUIRED')
 if(!organisationContextConfiguration(env))throw Error('ORGANISATION_CONTEXT_CONFIGURATION_REQUIRED')
 const legacyOrganisationId=env.PROFITIA_ORGANISATION_CONTEXT_LEGACY_ORGANISATION_ID
 if(legacyOrganisationId!==undefined&&!uuid.test(legacyOrganisationId))throw Error('EXACT_LEGACY_ORGANISATION_REQUIRED')
 const peer:PeerOperationConfiguration={environment:'development',callerApplicationId:'spendguru',receiverApplicationId:'identity-runtime-development',
  sourceOrigin:account.publicOrigin,targetOrigin:account.runtimeOrigin,key:Buffer.from(env.PROFITIA_ORGANISATION_ACCESS_PEER_KEY!,'hex'),keyId:env.PROFITIA_ORGANISATION_ACCESS_KEY_ID!,internalOrigins:[],
  routes:[{method:'GET',path:snapshotPath,maximumRequestBytes:0,requireIdempotencyKey:false},{method:'POST',path:accessPath,maximumRequestBytes:2,requireIdempotencyKey:false}]}
 createPeerOperationSigner(peer)
 return Object.freeze({...account,peer,...(legacyOrganisationId?{legacyOrganisationId}:{})})
}
async function json(response:Response){
 const reader=response.body?.getReader();if(!reader)throw Error('RESPONSE_REQUIRED')
 const chunks:Uint8Array[]=[];let size=0
 try{for(;;){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>24576){await reader.cancel();throw Error('RESPONSE_TOO_LARGE')}chunks.push(r.value)}}finally{reader.releaseLock()}
 return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
async function emptyCommand(request:Request){
 const reader=request.body?.getReader();if(!reader)return false
 const chunks:Uint8Array[]=[];let bytes=0
 try{for(;;){const item=await reader.read();if(item.done)break;bytes+=item.value.byteLength;if(bytes>2||request.signal.aborted)return false;chunks.push(item.value)}return Buffer.concat(chunks).toString('utf8')==='{}'}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
}
/** Empty same-origin command. Only the original verified bearer and two exact
 * signed routes cross the service boundary; no caller tenant or authority. */
export async function renewOrganisationAccess(request:Request,{env=process.env,transport=fetch,now=Date.now,resolveCurrentOrganisation}:{env?:Environment;transport?:typeof fetch;now?:()=>number;resolveCurrentOrganisation?:(request:Request)=>Promise<{organisationId:string|null;expiresAt:string}>}={}):Promise<Response>{
 const respond=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers})
 try{
  if(request.method!=='POST')return respond(405,{status:'UNAVAILABLE'})
  const config=readOrganisationAccessConfiguration(env);if(!config)return respond(503,{status:'UNAVAILABLE'})
  const normalize=createPublicIdentityRequestBoundary({publicOrigins:[config.publicOrigin],internalOrigins:['http://0.0.0.0:10000','https://0.0.0.0:10000','http://localhost:10000','https://localhost:10000']})
  const current=normalize(request);if(!current)return respond(403,{status:'UNAVAILABLE'})
  const u=new URL(current.url)
  if(u.pathname!=='/api/account/organisation-access'||u.search||u.hash||current.headers.get('origin')!==config.publicOrigin||['cross-site','same-site'].includes(current.headers.get('sec-fetch-site')??''))return respond(403,{status:'UNAVAILABLE'})
  if(current.headers.get('content-type')?.split(';')[0]?.trim()!=='application/json'||!await emptyCommand(request))return respond(400,{status:'INVALID_INPUT'})
  const credential=current.headers.get('authorization')
  if(!/^Bearer [\x21-\x7e]{1,16384}$/i.test(credential??''))return respond(401,{status:'UNAVAILABLE'})
  const sign=createPeerOperationSigner(config.peer),signal=AbortSignal.any([request.signal,AbortSignal.timeout(10000)])
  const call=async(method:'GET'|'POST',path:string)=>{
   const signed=await sign(new Request(config.runtimeOrigin+path,{method,headers:{authorization:credential!,...(method==='POST'?{'content-type':'application/json'}:{})},...(method==='POST'?{body:'{}'}:{}),signal}))
   const result=await transport(signed,{credentials:'omit',cache:'no-store',redirect:'error',signal})
   if(!result.ok){await result.body?.cancel();return {error:result.status===401?401:result.status===403?403:result.status===409?409:503} as const}
   return {value:await json(result)} as const
  }
  const initial=await call('GET',snapshotPath);if(typeof initial.error==='number')return respond(initial.error,{status:'UNAVAILABLE'})
  const snapshot=initial.value
  if(!snapshot||typeof snapshot!=='object'||!('organisation'in snapshot)||snapshot.categoriesRequired!==undefined&&typeof snapshot.categoriesRequired!=='boolean')return respond(503,{status:'UNAVAILABLE'})
  if(snapshot.organisation===null&&config.legacyOrganisationId){
   // Preserve the previous ACCOUNT_SELF shell for explicitly enrolled legacy
   // members. This read creates no package or business authority; each module
   // still checks its current products/permissions in the unchanged Root.
   const resolve=resolveCurrentOrganisation??(async(current:Request)=>{const {getSg2SelectionRuntime}=await import('./private-runtime');const runtime=getSg2SelectionRuntime(env);if(runtime.provider!=='clerk'||!runtime.currentOrganisation)throw Error('CURRENT_CONTEXT_REQUIRED');return runtime.currentOrganisation(current)})
   const own=await resolve(current)
   if(own.organisationId===config.legacyOrganisationId&&Date.parse(own.expiresAt)>now()&&Date.parse(own.expiresAt)<=now()+30000&&!request.signal.aborted)return respond(200,{status:'READY',organisationId:own.organisationId,expiresAt:own.expiresAt})
  }
  if(snapshot.organisation===null||snapshot.categoriesRequired===true)return respond(200,{status:'ONBOARDING_REQUIRED'})
  const organisationId=snapshot.organisation?.organisationId
  if(!uuid.test(organisationId??'')||snapshot.accessProjectionRequired!==true)return respond(503,{status:'UNAVAILABLE'})
  const projected=await call('POST',accessPath);if(typeof projected.error==='number')return respond(projected.error,{status:'UNAVAILABLE'})
  const value=projected.value
  if(!value||value.organisationId!==organisationId)return respond(409,{status:'UNAVAILABLE'})
  if(['PENDING_PACKAGE','RECONCILIATION_REQUIRED'].includes(value.status))return respond(200,{status:value.status})
  if(value.status!=='SYNCHRONISED'||!Number.isFinite(Date.parse(value.expiresAt))||Date.parse(value.expiresAt)<=now()||Date.parse(value.expiresAt)>now()+30000||signal.aborted)return respond(503,{status:'UNAVAILABLE'})
  return respond(200,{status:'READY',organisationId,expiresAt:value.expiresAt})
 }catch{return respond(503,{status:'UNAVAILABLE'})}
}
