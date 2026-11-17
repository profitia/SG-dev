import {createPublicIdentityRequestBoundary} from '@profitia/platform-contracts/public-request'
import {createPeerOperationSigner,type PeerOperationConfiguration} from '@profitia/platform-contracts/peer-operation'
import type {OwnOrganisationChoices,OwnOrganisationContext} from '@profitia/platform-contracts/organisation-context'
import {organisationContextConfiguration} from './organisation-context'
import {readSelfServiceAccountConfiguration} from './account-session'
type Environment=Readonly<Record<string,string|undefined>>
type OrganisationEntry=Readonly<{choices(request:Request):Promise<OwnOrganisationChoices>;select(request:Request,organisationId:string):Promise<OwnOrganisationContext>}>
const headers={'content-type':'application/json','cache-control':'private, no-store',vary:'Authorization, Origin','x-content-type-options':'nosniff'}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const slug=/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/
const snapshotPath='/v1/account/organisation-onboarding/snapshot',accessPath='/v1/account/organisation-onboarding/access'
export function readOrganisationAccessConfiguration(env:Environment=process.env){
 const flag=env.PROFITIA_ORGANISATION_ACCESS_ENABLED
 if(flag===undefined||flag==='false')return null
 const account=readSelfServiceAccountConfiguration(env)
 if(flag!=='true'||!account||!/^[a-f0-9]{64}$/.test(env.PROFITIA_ORGANISATION_ACCESS_PEER_KEY??'')||!/^[-a-z0-9]{2,64}$/.test(env.PROFITIA_ORGANISATION_ACCESS_KEY_ID??''))throw Error('ORGANISATION_ACCESS_CONFIGURATION_REQUIRED')
 const context=organisationContextConfiguration(env)
 if(!context)throw Error('ORGANISATION_CONTEXT_CONFIGURATION_REQUIRED')
 const legacyOrganisationId=env.PROFITIA_ORGANISATION_CONTEXT_LEGACY_ORGANISATION_ID
 if(legacyOrganisationId!==undefined&&!uuid.test(legacyOrganisationId))throw Error('EXACT_LEGACY_ORGANISATION_REQUIRED')
 const peer:PeerOperationConfiguration={environment:'development',callerApplicationId:'spendguru',receiverApplicationId:'identity-runtime-development',
  sourceOrigin:account.publicOrigin,targetOrigin:account.runtimeOrigin,key:Buffer.from(env.PROFITIA_ORGANISATION_ACCESS_PEER_KEY!,'hex'),keyId:env.PROFITIA_ORGANISATION_ACCESS_KEY_ID!,internalOrigins:[],
  routes:[{method:'GET',path:snapshotPath,maximumRequestBytes:0,requireIdempotencyKey:false},{method:'POST',path:accessPath,maximumRequestBytes:2,requireIdempotencyKey:false}]}
 createPeerOperationSigner(peer)
 return Object.freeze({...account,peer,selectionEnabled:!!context.selectionSchemaDigest,...(legacyOrganisationId?{legacyOrganisationId}:{})})
}
async function json(response:Response){
 const reader=response.body?.getReader();if(!reader)throw Error('RESPONSE_REQUIRED')
 const chunks:Uint8Array[]=[];let size=0
 try{for(;;){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>24576){await reader.cancel();throw Error('RESPONSE_TOO_LARGE')}chunks.push(r.value)}}finally{reader.releaseLock()}
 return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
async function command(request:Request,selection:boolean):Promise<{slug?:string}|null>{
 const reader=request.body?.getReader();if(!reader)return null
 const chunks:Uint8Array[]=[];let bytes=0
 try{
  for(;;){const item=await reader.read();if(item.done)break;bytes+=item.value.byteLength;if(bytes>(selection?160:2)||request.signal.aborted)return null;chunks.push(item.value)}
  const text=Buffer.concat(chunks).toString('utf8')
  if(text==='{}')return {}
  if(!selection)return null
  const value=JSON.parse(text)
  if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).join(',')!=='slug'||typeof value.slug!=='string'
   ||value.slug!=='_legacy'&&!slug.test(value.slug))return null
  return {slug:value.slug}
 }catch{return null}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
}
/** Same-origin own-account choice. The browser supplies a selector, never a
 * tenant grant. Current membership is verified by the native Root/SQL before
 * saving the user's own context. Identity still verifies both signed operations
 * independently; caller org IDs and cookies never cross that service boundary. */
export async function renewOrganisationAccess(request:Request,{env=process.env,transport=fetch,now=Date.now,resolveCurrentOrganisation,organisationEntry}:{env?:Environment;transport?:typeof fetch;now?:()=>number;resolveCurrentOrganisation?:(request:Request)=>Promise<{organisationId:string|null;expiresAt:string}>;organisationEntry?:OrganisationEntry}={}):Promise<Response>{
 const respond=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers})
 const live=(value:string)=>Number.isFinite(Date.parse(value))&&Date.parse(value)>now()&&Date.parse(value)<=now()+30000
 try{
  if(request.method!=='POST')return respond(405,{status:'UNAVAILABLE'})
  const config=readOrganisationAccessConfiguration(env);if(!config)return respond(503,{status:'UNAVAILABLE'})
  const normalize=createPublicIdentityRequestBoundary({publicOrigins:[config.publicOrigin],internalOrigins:['http://0.0.0.0:10000','https://0.0.0.0:10000','http://localhost:10000','https://localhost:10000']})
  const current=normalize(request);if(!current)return respond(403,{status:'UNAVAILABLE'})
  const u=new URL(current.url)
  if(u.pathname!=='/api/account/organisation-access'||u.search||u.hash||current.headers.get('origin')!==config.publicOrigin||['cross-site','same-site'].includes(current.headers.get('sec-fetch-site')??''))return respond(403,{status:'UNAVAILABLE'})
  if(current.headers.get('content-type')?.split(';')[0]?.trim()!=='application/json')return respond(400,{status:'INVALID_INPUT'})
  const input=await command(request,config.selectionEnabled);if(!input)return respond(400,{status:'INVALID_INPUT'})
  const credential=current.headers.get('authorization')
  if(!/^Bearer [\x21-\x7e]{1,16384}$/i.test(credential??''))return respond(401,{status:'UNAVAILABLE'})
  let selected:{organisationId:string;slug:string;expiresAt:string}|undefined
  if(config.selectionEnabled){
   const entry=organisationEntry??await(async()=>{const {getSg2SelectionRuntime}=await import('./private-runtime');const runtime=getSg2SelectionRuntime(env);if(runtime.provider!=='clerk'||!runtime.organisationEntry)throw Error('ORGANISATION_ENTRY_REQUIRED');return runtime.organisationEntry})()
   const own=await entry.choices(current)
   if(!own||!Array.isArray(own.choices)||own.choices.length>50||!live(own.expiresAt)||request.signal.aborted)throw Error('CURRENT_CHOICES_REQUIRED')
   const choices=own.choices.map(c=>{
    if(!uuid.test(c.organisationId)||c.slug!==null&&!slug.test(c.slug)||c.name!==null&&(typeof c.name!=='string'||c.name.length>320))throw Error('CURRENT_CHOICES_REQUIRED')
    if(c.slug===null&&c.organisationId!==config.legacyOrganisationId)throw Error('EXPLICIT_LEGACY_REQUIRED')
    return {...c,slug:c.slug??'_legacy'}
   })
   if(input.slug===undefined&&choices.length>1)return respond(200,{status:'SELECTION_REQUIRED',choices:choices.map(({slug,name})=>({slug,name})),expiresAt:own.expiresAt})
   const choice=input.slug===undefined?choices[0]:choices.find(c=>c.slug===input.slug)
   if(input.slug!==undefined&&!choice)return respond(403,{status:'UNAVAILABLE'})
   if(choice){
    const proof=await entry.select(current,choice.organisationId)
    if(proof.userId!==own.userId||proof.organisationId!==choice.organisationId||!live(proof.expiresAt)||request.signal.aborted)throw Error('CURRENT_SELECTION_REQUIRED')
    selected={organisationId:choice.organisationId,slug:choice.slug,expiresAt:new Date(Math.min(Date.parse(own.expiresAt),Date.parse(proof.expiresAt))).toISOString()}
    if(choice.slug==='_legacy')return respond(200,{status:'READY',...selected})
   }
  }
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
  // Re-check that Identity observed the same explicit selection. A concurrent
  // preference change may fail this request; it must not unlock another scope.
  if(config.selectionEnabled&&!selected&&snapshot.organisation!==null)return respond(409,{status:'UNAVAILABLE'})
  if(selected&&snapshot.organisation?.organisationId!==selected.organisationId)return respond(409,{status:'UNAVAILABLE'})
  if(!config.selectionEnabled&&snapshot.organisation===null&&config.legacyOrganisationId){
   const resolve=resolveCurrentOrganisation??(async(current:Request)=>{const {getSg2SelectionRuntime}=await import('./private-runtime');const runtime=getSg2SelectionRuntime(env);if(runtime.provider!=='clerk'||!runtime.currentOrganisation)throw Error('CURRENT_CONTEXT_REQUIRED');return runtime.currentOrganisation(current)})
   const own=await resolve(current)
   if(own.organisationId===config.legacyOrganisationId&&live(own.expiresAt)&&!request.signal.aborted)return respond(200,{status:'READY',organisationId:own.organisationId,expiresAt:own.expiresAt})
  }
  if(snapshot.organisation===null||snapshot.categoriesRequired===true)return respond(200,{status:'ONBOARDING_REQUIRED'})
  const organisationId=snapshot.organisation?.organisationId
  if(!uuid.test(organisationId??'')||snapshot.accessProjectionRequired!==true)return respond(503,{status:'UNAVAILABLE'})
  const projected=await call('POST',accessPath);if(typeof projected.error==='number')return respond(projected.error,{status:'UNAVAILABLE'})
  const value=projected.value
  if(!value||value.organisationId!==organisationId)return respond(409,{status:'UNAVAILABLE'})
  if(['PENDING_PACKAGE','RECONCILIATION_REQUIRED'].includes(value.status))return respond(200,{status:value.status})
  if(value.status!=='SYNCHRONISED'||!live(value.expiresAt)||signal.aborted)return respond(503,{status:'UNAVAILABLE'})
  const expiresAt=selected?new Date(Math.min(Date.parse(value.expiresAt),Date.parse(selected.expiresAt))).toISOString():value.expiresAt
  if(!live(expiresAt))return respond(503,{status:'UNAVAILABLE'})
  return respond(200,{status:'READY',organisationId,expiresAt,...(selected?{slug:selected.slug}:{})})
 }catch{return respond(503,{status:'UNAVAILABLE'})}
}
