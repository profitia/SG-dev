import {createHash} from 'node:crypto'
import {createClerkIdentityAuthenticator,identitySourceDigest} from './identity-provider.mjs'
import {createPublicIdentityRequestBoundary,publicIdentityRequestSourceDigest} from './public-request.mjs'
import {createPrivateOperationHost,privateOperationHostSourceDigest} from './private-operation-host.mjs'
import {createAccessStore,accessStoreSourceDigest} from './access-store.mjs'
import {OperationDenied,operationPayloadDigest,operationSourceDigest} from './operation-context.mjs'
import {diagnosticAsync} from './diagnostic-phase.mjs'
import {hasVerifiedPeerOperation,peerOperationIdentityRequest,peerOperationSourceDigest} from './peer-operation.mjs'

export const CURRENT_HUMAN_READ_CONTRACT=Object.freeze({id:'profitia.current-human-read',version:'1.1.0'})
const denied=()=>{throw new OperationDenied('UNVERIFIED_IDENTITY')}
const unavailable=()=>{throw new OperationDenied('POLICY_UNAVAILABLE')}
const fingerprint=request=>createHash('sha256').update(JSON.stringify([
 request.url,request.method,[...request.headers].sort((a,b)=>a[0].localeCompare(b[0])),
])).digest('hex')
const freeze=value=>{
 if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}
 return value
}

/** One exact server execution, not a session or positive-authorization cache.
 * Both observations use the unchanged official identity adapter. Only the
 * SDK-verified immutable credential facts are reused; session, account and
 * internal binding are fetched again. No JWT is parsed or verified here. */
export function createCurrentHumanReadIdentity({client,application,resolveBinding,now=Date.now}){
 if(typeof client?.authenticateRequest!=='function'||typeof client.sessions?.getSession!=='function'
  ||typeof client.users?.getUser!=='function'||typeof resolveBinding!=='function'||typeof now!=='function')throw TypeError('Official Clerk client and current binding reader required')
 const identity=freeze(structuredClone(application))
 const normalize=identity.requestBoundary?createPublicIdentityRequestBoundary(identity.requestBoundary):request=>request
 let original=null,transport=null,normalizedTransport=null,sdkState=null,actor=null,phase=0,sdkCalls=0,closed=false,peer=false
 const eligible=request=>!closed&&request===original&&!request.signal.aborted&&fingerprint(request)===transport
  &&(!peer||hasVerifiedPeerOperation(request))
 const adapterClient={
  authenticateRequest:async(request,options)=>{
   if(!eligible(original)||!(request instanceof Request)||fingerprint(request)!==normalizedTransport)return null
   if(phase===1&&sdkCalls===0){
    sdkCalls++
    const state=await client.authenticateRequest(request,options)
    if(!eligible(original))return null
    if(state?.status!=='signed-in'||state.isAuthenticated!==true||typeof state.toAuth!=='function')return state
    const auth=state.toAuth()
    // Snapshot exactly the SDK facts consumed by the existing adapter. Never
    // retain a token, getToken function, account result or access decision.
    const facts=freeze(structuredClone({isAuthenticated:auth?.isAuthenticated,tokenType:auth?.tokenType,
     userId:auth?.userId,sessionId:auth?.sessionId,sessionClaims:auth?.sessionClaims,actor:auth?.actor??null}))
    sdkState=Object.freeze({status:state.status,isAuthenticated:state.isAuthenticated,toAuth:()=>facts})
    return sdkState
   }
   if(phase===2&&sdkCalls===1&&sdkState)return sdkState
   return denied()
  },
  sessions:{getSession:id=>client.sessions.getSession(id)},
  users:{getUser:id=>client.users.getUser(id)},
 }
 const authenticate=createClerkIdentityAuthenticator({client:adapterClient,application:identity,resolveBinding,now})
 const read=async request=>{
  // Only the shared verifier can establish this request-object capability.
  // Preserve the actual receiver request for execution and final eligibility;
  // the official SDK alone sees its authenticated caller-origin identity input.
  const peerRequest=peerOperationIdentityRequest(request)
  if(peer&&!peerRequest)return null
  const normalized=normalize(peerRequest??request)
  if(!(normalized instanceof Request)||!eligible(request))return null
  const key=fingerprint(normalized)
  if(normalizedTransport!==null&&normalizedTransport!==key)return null
  normalizedTransport=key
  const result=await authenticate(normalized)
  return eligible(request)?result:null
 }
 return Object.freeze({
  async authenticate(request){
   if(closed||phase!==0||!(request instanceof Request)||request.signal.aborted)return null
   original=request;transport=fingerprint(request);peer=hasVerifiedPeerOperation(request);phase=1
   actor=await read(request)
   return actor
  },
  async revalidate(request,expected){
   if(!actor||expected!==actor||phase!==1||!eligible(request))return null
   phase=2
   const fresh=await read(request)
   if(!fresh||operationPayloadDigest(fresh)!==operationPayloadDigest(actor))return null
   return fresh
  },
  close(){closed=true;original=null;transport=null;normalizedTransport=null;sdkState=null;actor=null},
 })
}

/** Additive composition of the canonical operation host, SQL access store and
 * Clerk adapter. Existing hosts and their adoption fingerprints are unchanged.
 * The application supplies its normal protected projection, not another access
 * implementation. Source acquisition and private data are not accepted here. */
export function createCurrentHumanReadHost(options){
 const {clerk,identity,...base}=options
 if(!identity||base.createAuthenticator!==undefined||base.application?.operations?.join(',')!=='supplier.report.read'
  ||base.binding?.service!==undefined||base.requestLedger!==undefined||base.reportAdmission!==undefined
  ||base.prepareInputs!==undefined||identity.appId!==base.application.appId
  ||identity.environment!==base.application.environment||identity.issuer!==base.application.identityIssuer
  ||base.module?.id!=='supplier_report')throw TypeError('Explicit current shared HUMAN supplier read required')
 const fixed=freeze(structuredClone({application:base.application,binding:base.binding,module:base.module,identity}))
 createCurrentHumanReadIdentity({client:clerk,application:fixed.identity,resolveBinding:async()=>null,now:base.now}).close()
 const store=createAccessStore({binding:fixed.binding,now:base.now})
 // Validate all unchanged host configuration before receiving a request.
 const validation=createPrivateOperationHost({...base,...fixed,createAuthenticator:()=>async()=>null})
 return Object.freeze({contract:validation.contract,hostContract:CURRENT_HUMAN_READ_CONTRACT,
  async execute(input,action){
   if(!(input?.request instanceof Request)||typeof action!=='function')return denied()
   const request=input.request
   let identityContext=null,entryActor=null,resourceInput=null,entryResource=null,bindingReads=0
   const host=createPrivateOperationHost({...base,application:fixed.application,binding:fixed.binding,module:fixed.module,
    createAuthenticator:({resolveBinding})=>{
     if(identityContext)return unavailable()
     identityContext=createCurrentHumanReadIdentity({client:clerk,application:fixed.identity,now:base.now,
      resolveBinding:async key=>{
       if(++bindingReads===1)return resolveBinding(key)
       if(bindingReads===2)return store.resolveBinding(base.independentQuery,key)
       return unavailable()
      }})
     return async original=>{entryActor=await identityContext.authenticate(original);return entryActor}
    },
    readResources:async state=>{
     if(resourceInput)return unavailable()
     resourceInput=state
     const resources=await base.readResources(state)
     if(resources?.resource?.dataClass!=='SHARED_KNOWLEDGE'||resources.inputs!==undefined)return unavailable()
     entryResource=operationPayloadDigest(resources)
     return resources
    },
    projectOutput:async(value,context,transaction)=>{
     const output=await base.projectOutput(value,context,transaction)
     request.signal.throwIfAborted()
     const fresh=await diagnosticAsync('E1_CONTEXT',()=>identityContext?.revalidate(request,entryActor))
     if(!fresh)return denied()
     const resources=await base.readResources({...resourceInput,actor:fresh})
     if(resources?.resource?.dataClass!=='SHARED_KNOWLEDGE'||resources.inputs!==undefined
       ||operationPayloadDigest(resources)!==entryResource)throw new OperationDenied('RESOURCE_VERSION_CONFLICT')
     request.signal.throwIfAborted()
     return output
    },
   })
   try{return await host.execute(input,action)}finally{identityContext?.close()}
  },
 })
}

/** Independent additive acceptance; existing consumers do not silently adopt. */
export async function currentHumanReadSourceDigest(){
 const fs=await import('node:fs')
 return createHash('sha256').update(fs.readFileSync(new URL('./current-human-read.mjs',import.meta.url)))
  .update(fs.readFileSync(new URL('./current-human-read.d.mts',import.meta.url)))
  .update(await privateOperationHostSourceDigest()).update(await identitySourceDigest())
  .update(await accessStoreSourceDigest()).update(await operationSourceDigest())
  .update(await publicIdentityRequestSourceDigest()).update(await peerOperationSourceDigest()).digest('hex')
}
