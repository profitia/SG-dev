import {documentDigest,verifyDocument} from './manifest.mjs'
import {prepareQualityControllerJobContext} from './job-context.mjs'
const fail=code=>{throw Object.assign(Error('Quality operational recovery unavailable'),{code})}
const require=(v,c='RECOVERY_AUTHORITY_INVALID')=>{if(!v)fail(c)}
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v)
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
const sha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v)
const stamp=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v
const plain=v=>v!==null&&Object.getPrototypeOf(v)===Object.prototype
const exact=(v,keys)=>plain(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k))
 &&Reflect.ownKeys(v).every(k=>typeof k==='string'&&'value'in Object.getOwnPropertyDescriptor(v,k))
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v}
const actions=Object.freeze(['VERIFY_RUNTIME','OBSERVE','ROLLBACK'])
const hardExpiry=Date.parse('2026-11-27T23:59:59.000Z')
const admitted=new WeakMap()
const fields=['schemaVersion','id','applicationId','environment','repository','targetServiceId','issuedAt','expiresAt',
 'mandateSha256','gateSetSha256','actions','maxRollbacksPerRelease','paidRequestsAllowed','qaReadAllowed','promotionAllowed','rightsRenewalAllowed']
/** Unsigned, reviewable owner decision only. No signature or runtime grant. */
export function qualityOperationalRecoveryBody({id,issuedAt,expiresAt,targetServiceId,mandateSha256,gateSetSha256}){
 return {schemaVersion:'AQC_OPERATIONAL_RECOVERY_V1',id,applicationId:'spendguru',environment:'development',repository:'profitia/SG-dev',
  targetServiceId,issuedAt,expiresAt,mandateSha256,gateSetSha256,actions:[...actions],maxRollbacksPerRelease:1,
  paidRequestsAllowed:false,qaReadAllowed:false,promotionAllowed:false,rightsRenewalAllowed:false}
}
function releaseBinding(record){
 require(plain(record)&&uuid(record.id)&&sha(record.baseSha)&&['C1','C2','C3'].includes(record.repairClass)
  &&['RELEASED','OBSERVING'].includes(record.status)&&plain(record.release),'RECOVERY_OWN_RELEASE_REQUIRED')
 const r=record.release
 require(sha(r.sourceSha)&&sha(r.lastKnownGoodSha)&&r.sourceSha!==r.lastKnownGoodSha&&hash(r.artifactSha256)
  &&hash(r.configurationSha256)&&typeof r.deployId==='string'&&/^dep-[a-z0-9]{10,40}$/.test(r.deployId)
  &&typeof r.lastKnownGoodDeployId==='string'&&/^dep-[a-z0-9]{10,40}$/.test(r.lastKnownGoodDeployId)&&r.lastKnownGoodDeployId!==r.deployId
  &&Number.isSafeInteger(r.releasedAt)&&r.releasedAt>0,'RECOVERY_OWN_RELEASE_REQUIRED')
 if(record.pending)require(actions.includes(record.pending.action),'RECOVERY_ACTION_REJECTED')
 return documentDigest({incidentId:record.id,baseSha:record.baseSha,repairClass:record.repairClass,
  sourceSha:r.sourceSha,lastKnownGoodSha:r.lastKnownGoodSha,artifactSha256:r.artifactSha256,configurationSha256:r.configurationSha256,
  deployId:r.deployId,lastKnownGoodDeployId:r.lastKnownGoodDeployId,releasedAt:r.releasedAt})
}
function bodyScope(b,{expectedServiceId,expectedGateSetSha256,now}){
 require(exact(b,fields)&&b.schemaVersion==='AQC_OPERATIONAL_RECOVERY_V1'&&uuid(b.id)
  &&b.applicationId==='spendguru'&&b.environment==='development'&&b.repository==='profitia/SG-dev'
  &&b.targetServiceId===expectedServiceId&&typeof b.targetServiceId==='string'&&/^srv-[a-z0-9-]+$/.test(b.targetServiceId)
  &&hash(b.mandateSha256)&&b.gateSetSha256===expectedGateSetSha256&&hash(b.gateSetSha256)
  &&documentDigest(b.actions)===documentDigest(actions)&&b.maxRollbacksPerRelease===1
  &&b.paidRequestsAllowed===false&&b.qaReadAllowed===false&&b.promotionAllowed===false&&b.rightsRenewalAllowed===false)
 require(Number.isFinite(now)&&stamp(b.issuedAt)&&stamp(b.expiresAt)&&Date.parse(b.issuedAt)<=now
  &&Date.parse(b.expiresAt)>now&&Date.parse(b.expiresAt)<=hardExpiry,'RECOVERY_AUTHORITY_EXPIRED')
}
/** Reconstruct old immutable facts only after a separate fresh owner signature.
 * The historical admitted manifest stays private in this closure. The returned
 * manifest is an unbranded metadata clone: executor/publisher admission rejects
 * it, even if a caller attempts to reuse operational authority for a repair.
 */
export async function admitQualityOperationalRecovery({document,registry,record,ownerKeys,verifierKeys,publisherKeys,releaseReceipt,
 expectedServiceId,expectedGateSetSha256,now=Date.now()}){
 const b=verifyDocument(document,{kind:'AQC_OPERATIONAL_RECOVERY_V1',trustedKeys:ownerKeys})
 bodyScope(b,{expectedServiceId,expectedGateSetSha256,now})
 const releaseSha256=releaseBinding(record)
 let value
 try{
  if(typeof registry==='string'){require(Buffer.byteLength(registry)<=65536);value=JSON.parse(registry)}else value=registry
  documentDigest(value);require(Buffer.byteLength(JSON.stringify(value))<=65536);value=structuredClone(value)
 }catch{fail('RECOVERY_ORIGINAL_CONTEXT_INVALID')}
 require(documentDigest(value.mandate?.body)===b.mandateSha256,'RECOVERY_ORIGINAL_CONTEXT_INVALID')
 const originalAt=Math.max(Date.parse(value.mandate?.body?.issuedAt),
  ...(Array.isArray(value.fixtures)?value.fixtures.map(v=>Date.parse(v?.fixtureExport?.body?.issuedAt)):[]))
 require(Number.isFinite(originalAt)&&originalAt<=now&&Date.parse(b.issuedAt)>=originalAt
  &&record.release.releasedAt>=originalAt&&record.release.releasedAt<Date.parse(value.mandate?.body?.expiresAt),
 'RECOVERY_ORIGINAL_CONTEXT_INVALID')
 const original=await prepareQualityControllerJobContext({registry:value,incidentId:record.id,baseSha:record.baseSha,
  ownerKeys,verifierKeys,expectedServiceId,expectedGateSetSha256,now:originalAt})
 require(original.manifest.repairClass===record.repairClass&&original.manifest.mandate.sha256===b.mandateSha256,
  'RECOVERY_ORIGINAL_CONTEXT_INVALID')
 // The native controller row alone is insufficient for an independent job.
 // Require the separately signed historical publication fact. This is a pure
 // read under fresh recovery authority, never a current PROMOTE transition.
 require(publisherKeys instanceof Map&&publisherKeys.size>0&&publisherKeys.size<=4
  &&[...publisherKeys.keys()].every(id=>hash(id)&&!ownerKeys.has(id)&&!verifierKeys.has(id)),'RECOVERY_PUBLISHER_TRUST_REQUIRED')
 const published=verifyDocument(releaseReceipt,{kind:'AQC_CONTROLLER_JOB_RESULT_V1',trustedKeys:new Map(publisherKeys)})
 require(published.action==='PROMOTE'&&published.role==='INDEPENDENT_PUBLISHER'
  &&stamp(published.issuedAt)&&Date.parse(published.issuedAt)<=record.release.releasedAt
  &&Date.parse(published.issuedAt)>=originalAt&&Date.parse(published.issuedAt)<Date.parse(original.manifest.mandate.expiresAt)
  &&sha(published.controlSourceSha)&&uuid(published.nonce)&&/^[1-9][0-9]{0,19}$/.test(published.runId)
  &&published.workflowId==='416905856','RECOVERY_PUBLISHED_RELEASE_REQUIRED')
 const publicationId='aqc-job:'+published.controlSourceSha+':'+published.nonce+':PROMOTE'
 const publicationRecord={...record,pending:{action:'PROMOTE',nonce:published.nonce,externalId:publicationId}}
 const {readQualityControllerJobResult}=await import('./github.mjs')
 const fact=readQualityControllerJobResult(releaseReceipt,{manifest:original.manifest,record:publicationRecord,
  externalId:publicationId,runId:published.runId,workflowId:published.workflowId,
  keysByRole:new Map([['INDEPENDENT_PUBLISHER',new Map(publisherKeys)]]),notBefore:originalAt,now:Date.parse(published.issuedAt)})
 require(fact.result==='RELEASED'&&fact.sourceSha===record.release.sourceSha&&fact.deployId===record.release.deployId
  &&fact.lastKnownGoodSha===record.release.lastKnownGoodSha&&fact.lastKnownGoodDeployId===record.release.lastKnownGoodDeployId
  &&fact.artifactSha256===record.release.artifactSha256
  &&fact.configurationSha256===record.release.configurationSha256&&fact.exactRuntimeVerified===true,
  'RECOVERY_PUBLISHED_RELEASE_REQUIRED')
 const authority=freeze({kind:'AQC_OPERATIONAL_RECOVERY_V1',manifest:structuredClone(original.manifest),
  recoverySha256:documentDigest(document),expiresAt:b.expiresAt})
 admitted.set(authority,{body:b,releaseSha256,original,expectedServiceId,expectedGateSetSha256})
 assertQualityOperationalRecovery(authority,{record,now})
 return authority
}
export function assertQualityOperationalRecovery(authority,{record,action,now=Date.now()}={}){
 const trusted=admitted.get(authority)
 require(trusted,'VERIFIED_RECOVERY_AUTHORITY_REQUIRED')
 bodyScope(trusted.body,{...trusted,now})
 require(releaseBinding(record)===trusted.releaseSha256,'RECOVERY_RELEASE_CHANGED')
 if(action!==undefined)require(actions.includes(action),'RECOVERY_ACTION_REJECTED')
 if(action==='ROLLBACK')require(record.rollbackRequired===true&&[0,1].includes(record.rollbacksUsed),'RECOVERY_CAUSE_REQUIRED')
 return authority
}
function binding(externalId,action){
 require(typeof externalId==='string'&&actions.includes(action),'RECOVERY_ACTION_REJECTED')
 const p=externalId.split(':')
 require(p.length===4&&p[0]==='aqc-job'&&sha(p[1])&&uuid(p[2])&&p[3]===action,'RECOVERY_JOB_BINDING_INVALID')
 return {controlSourceSha:p[1],nonce:p[2],action}
}
export function qualityRecoveryJobInputs({authority,record,action,externalId,now=Date.now()}){
 assertQualityOperationalRecovery(authority,{record,action,now})
 const b=binding(externalId,action),m=authority.manifest
 return freeze({mode:'controller-job',action,nonce:b.nonce,control_source_sha:b.controlSourceSha,incident_id:m.incidentId,
  manifest_sha256:documentDigest(m),base_sha:m.baseSha,recovery_sha256:authority.recoverySha256})
}
export async function readQualityRecoveryJobContext({inputs,...options}){
 require(exact(inputs,['mode','action','nonce','control_source_sha','incident_id','manifest_sha256','base_sha','recovery_sha256'])
  &&inputs.mode==='controller-job'&&actions.includes(inputs.action)&&hash(inputs.recovery_sha256),'RECOVERY_JOB_INPUT_INVALID')
 const externalId='aqc-job:'+inputs.control_source_sha+':'+inputs.nonce+':'+inputs.action
 binding(externalId,inputs.action)
 const authority=await admitQualityOperationalRecovery(options)
 require(authority.recoverySha256===inputs.recovery_sha256&&authority.manifest.incidentId===inputs.incident_id
  &&authority.manifest.baseSha===inputs.base_sha&&documentDigest(authority.manifest)===inputs.manifest_sha256,'RECOVERY_JOB_INPUT_INVALID')
 assertQualityOperationalRecovery(authority,{record:options.record,action:inputs.action,now:options.now})
 return freeze({authority,externalId})
}
export async function readQualityRecoveryPhaseResult(document,{authority,record,externalId,runId,workflowId,keysByRole,notBefore,now=Date.now()}){
 const action=typeof externalId==='string'?externalId.split(':')[3]:null
 assertQualityOperationalRecovery(authority,{record,action,now});binding(externalId,action)
 const trusted=admitted.get(authority)
 const {readQualityControllerJobResult}=await import('./github.mjs')
 return readQualityControllerJobResult(document,{manifest:trusted.original.manifest,record,externalId,runId,workflowId,keysByRole,
  notBefore:Math.max(notBefore,Date.parse(trusted.body.issuedAt)),now})
}

/** Fixed operational transport. It has no budget port and cannot dispatch
 * QUALIFY/EXECUTE/PROPOSE/PROMOTE. Every result still originates from an exact
 * native artifact and the separately installed verifier/publisher signature. */
export function createQualityOperationalRecoveryActions({github,keysByRole,now=Date.now}={}){
 const methods=['descriptor','recoveryJobDescriptor','dispatchRecoveryJob','findControllerJob','controllerJobResult','cancelControllerJob']
 require(methods.every(k=>typeof github?.[k]==='function')&&typeof now==='function','RECOVERY_ACTIONS_CONFIGURATION_REQUIRED')
 require(keysByRole instanceof Map&&keysByRole.size===3,'RECOVERY_ROLE_TRUST_REQUIRED')
 const trusted=new Map(),ids=new Set()
 for(const role of ['EXECUTOR_SUPERVISOR','INDEPENDENT_VERIFIER','INDEPENDENT_PUBLISHER']){
  const keys=keysByRole.get(role)
  require(keys instanceof Map&&keys.size>0&&keys.size<=4,'RECOVERY_ROLE_TRUST_REQUIRED')
  for(const id of keys.keys()){require(hash(id)&&!ids.has(id),'RECOVERY_ROLE_TRUST_REQUIRED');ids.add(id)}
  trusted.set(role,new Map(keys))
 }
 const envelopes=new WeakMap()
 const admittedFor=(action,input,externalId)=>{
  assertQualityOperationalRecovery(input?.authority,{record:input?.record,action,now:now()})
  if(externalId!==undefined){
   const b=binding(externalId,action),pending=input.record.pending
   require(pending?.externalId===externalId&&pending.nonce===b.nonce&&pending.action===action,'RECOVERY_JOB_BINDING_INVALID')
  }
  return input.authority
 }
 return Object.freeze({
  async bind(action,input){
   admittedFor(action,input)
   const source=await github.descriptor();require(sha(source?.headSha),'RECOVERY_JOB_BINDING_INVALID')
   const externalId='aqc-job:'+source.headSha+':'+input.nonce+':'+action;binding(externalId,action)
   const descriptor=await github.recoveryJobDescriptor({sourceSha:source.headSha})
   require(descriptor?.dispatchEnabled===true&&descriptor.sourceSha===source.headSha,'RECOVERY_JOBS_DISABLED')
   admittedFor(action,input);return externalId
  },
  async dispatch(action,input){
   require(input.intent===input.record.pending,'RECOVERY_JOB_BINDING_INVALID')
   const authority=admittedFor(action,input,input.intent.externalId)
   const result=await github.dispatchRecoveryJob({authority,record:input.record,action,externalId:input.intent.externalId})
   require(result?.state==='UNKNOWN'&&result.externalId===input.intent.externalId&&result.resultVerified===false,'RECOVERY_DISPATCH_INVALID')
   return Object.freeze({externalId:input.intent.externalId})
  },
  async reconcile(intent,input){
   require(intent===input.record.pending,'RECOVERY_JOB_BINDING_INVALID')
   admittedFor(intent.action,input,intent.externalId)
   const found=await github.findControllerJob({externalId:intent.externalId})
   require(found?.externalId===intent.externalId&&found.resultVerified===false,'RECOVERY_NATIVE_RESULT_REQUIRED')
   if(['UNKNOWN','RUNNING'].includes(found.state))return Object.freeze({state:found.state})
   require(found.state==='COMPLETE','RECOVERY_NATIVE_RESULT_REQUIRED')
   if(found.conclusion!=='success')return Object.freeze({state:'UNKNOWN'})
   const received=await github.controllerJobResult({externalId:intent.externalId,runId:found.runId})
   if(received?.state==='UNKNOWN')return Object.freeze({state:'UNKNOWN'})
   require(received?.state==='COMPLETE'&&received.externalId===intent.externalId&&received.runId===found.runId
    &&received.resultVerified===false&&stamp(received.createdAt),'RECOVERY_NATIVE_RESULT_REQUIRED')
   const envelope=Object.freeze({kind:'AQC_UNVERIFIED_RECOVERY_NATIVE_RESULT_V1'})
   envelopes.set(envelope,{...received,document:structuredClone(received.document),recoverySha256:input.authority.recoverySha256})
   return Object.freeze({state:'COMPLETE',result:envelope})
  },
  async verify(action,envelope,input){
   admittedFor(action,input,input.record.pending?.externalId)
   const native=envelopes.get(envelope)
   require(native&&native.externalId===input.record.pending.externalId&&native.recoverySha256===input.authority.recoverySha256,'RECOVERY_NATIVE_RESULT_REQUIRED')
   return readQualityRecoveryPhaseResult(native.document,{authority:input.authority,record:input.record,externalId:native.externalId,
    runId:native.runId,workflowId:native.workflowId,keysByRole:trusted,notBefore:Date.parse(native.createdAt),now:now()})
  },
  async cancel(intent,{record}){
   require(intent===record.pending,'RECOVERY_JOB_BINDING_INVALID');binding(intent.externalId,intent.action)
   const found=await github.findControllerJob({externalId:intent.externalId})
   require(found?.externalId===intent.externalId&&found.resultVerified===false,'RECOVERY_NATIVE_RESULT_REQUIRED')
   if(found.state==='RUNNING')await github.cancelControllerJob({externalId:intent.externalId,runId:found.runId})
   else require(['UNKNOWN','COMPLETE'].includes(found.state),'RECOVERY_NATIVE_RESULT_REQUIRED')
   return Object.freeze({state:'UNKNOWN',effects:'UNKNOWN'})
  },
 })
}
/** Both ports retain their own independent admission. A label or copied object
 * cannot move an ordinary repair into the operational recovery port. */
export function composeQualityControllerActionPorts({ordinary,recovery}={}){
 for(const port of [ordinary,recovery])require(['bind','dispatch','reconcile','verify','cancel'].every(k=>typeof port?.[k]==='function'),
  'RECOVERY_ACTIONS_CONFIGURATION_REQUIRED')
 const select=input=>input?.authority?.kind==='AQC_OPERATIONAL_RECOVERY_V1'?recovery:ordinary
 return Object.freeze({
  bind:(action,input)=>select(input).bind(action,input),
  dispatch:(action,input)=>select(input).dispatch(action,input),
  reconcile:(intent,input)=>select(input).reconcile(intent,input),
  verify:(action,envelope,input)=>select(input).verify(action,envelope,input),
  cancel:(intent,input)=>ordinary.cancel(intent,input),
 })
}
