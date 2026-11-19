import {assertVerifiedRepairManifest,documentDigest} from './manifest.mjs'
import {readQualityJobBinding,TERMINAL_STATES} from './controller.mjs'

const fail=()=>{throw Object.assign(Error('Quality job state unavailable'),{code:'JOB_STATE_METADATA_INVALID'})}
const require=value=>{if(!value)fail()}
const plain=value=>value&&Object.getPrototypeOf(value)===Object.prototype
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
const sha=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value)
const integer=value=>Number.isSafeInteger(value)&&value>=0
const positive=value=>integer(value)&&value>0
const deployment=value=>typeof value==='string'&&/^dep-[a-z0-9]{10,40}$/.test(value)
const code=value=>typeof value==='string'&&/^[A-Z][A-Z0-9_]{0,79}$/.test(value)
const exact=(value,fields)=>plain(value)&&Object.keys(value).sort().join(',')===[...fields].sort().join(',')
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value}
const optional={
 lastResult:code,reason:code,observingUntil:integer,rollbackRequired:v=>typeof v==='boolean',
 classSuspended:v=>typeof v==='boolean',runtimeProof:hash,rollbackProof:hash,
 patch:v=>exact(v,['artifactSha256','treeSha256'])&&hash(v.artifactSha256)&&hash(v.treeSha256),
 verification:v=>exact(v,['artifactSha256','proofSha256'])&&hash(v.artifactSha256)&&hash(v.proofSha256),
 pr:v=>exact(v,['number','headSha'])&&positive(v.number)&&sha(v.headSha),
 checks:v=>exact(v,['headSha','proofSha256'])&&sha(v.headSha)&&hash(v.proofSha256),
 reproduction:validReproduction,
 release:v=>exact(v,['sourceSha','artifactSha256','configurationSha256','deployId','lastKnownGoodSha','releasedAt',
  ...(Object.hasOwn(v??{},'lastKnownGoodDeployId')?['lastKnownGoodDeployId']:[])])
  &&sha(v.sourceSha)&&hash(v.artifactSha256)&&hash(v.configurationSha256)&&deployment(v.deployId)
  &&sha(v.lastKnownGoodSha)&&integer(v.releasedAt)
  &&(!Object.hasOwn(v,'lastKnownGoodDeployId')||deployment(v.lastKnownGoodDeployId)&&v.lastKnownGoodDeployId!==v.deployId),
}

const referenceKeys=Object.freeze({QUALIFY:'qualify',REPRODUCE:'reproduce',EXECUTE:'execute',VERIFY:'verify',
 PROPOSE:'propose',CHECKS:'checks',PROMOTE:'promote',VERIFY_RUNTIME:'verifyRuntime',OBSERVE:'observe',ROLLBACK:'rollback'})
const referenceActions=Object.freeze(Object.keys(referenceKeys))
const stamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value
function validReference(reference,action){
 if(!exact(reference,['externalId','runId','workflowId','artifactSha256','documentSha256','createdAt']))return false
 if(typeof reference.runId!=='string'||typeof reference.workflowId!=='string'||!/^[1-9][0-9]{0,19}$/.test(reference.runId)||!/^[1-9][0-9]{0,19}$/.test(reference.workflowId)
  ||!hash(reference.artifactSha256)||!hash(reference.documentSha256)||!stamp(reference.createdAt))return false
 try{
  const parts=reference.externalId.split(':')
  return readQualityJobBinding(reference.externalId,{nonce:parts[2],action}).action===action
 }catch{return false}
}
function validReferences(references){
 return plain(references)&&Object.keys(references).length<=10&&Object.keys(references).every(key=>{
  const action=referenceActions.find(action=>referenceKeys[action]===key)
  return action!==undefined&&validReference(references[key],action)
 })
}
function validReproduction(value){
 if(!plain(value))return false
 const keys=Object.keys(value).sort().join(',')
 if(!['baseSha,proofSha256','baseSha,nativeJobs,proofSha256','nativeJobs'].includes(keys))return false
 if(Object.hasOwn(value,'baseSha')&&(!sha(value.baseSha)||!hash(value.proofSha256)))return false
 return !Object.hasOwn(value,'nativeJobs')||validReferences(value.nativeJobs)
}
/** Finite provenance indexes only. This pure function never authenticates a
 * receipt; the trusted action port must supply its privately verified reference.
 * New upstream work discards stale downstream indexes. Base changes discard all. */
export function retainQualityJobReference({before,after,action,reference}){
 inspectDescriptors(before);inspectDescriptors(after);inspectDescriptors(reference)
 require(plain(before)&&plain(after)&&before.id===after.id&&referenceActions.includes(action)
  &&validReference(reference,action)&&before.pending?.action===action
  &&before.pending.externalId===reference.externalId)
 if(before.baseSha!==after.baseSha){
  require(action==='PROMOTE'&&after.reason==='BASE_CHANGED'&&after.reproduction===null)
  return after
 }
 const old=before.reproduction?.nativeJobs??{};require(validReferences(old))
 const references=structuredClone(old),index=referenceActions.indexOf(action)
 for(const later of referenceActions.slice(index+1))delete references[referenceKeys[later]]
 references[referenceKeys[action]]=structuredClone(reference)
 const reproduction={...(after.reproduction??{}),nativeJobs:references}
 require(validReproduction(reproduction))
 return {...after,reproduction}
}

const required=['id','revision','status','repairClass','causeFingerprint','baseSha','attemptsUsed','rollbacksUsed','pending','wakeAt']
const nullable=new Set(['checks','reproduction','patch','verification','pr'])
function inspectDescriptors(value,depth=0){
 if(value===null||['string','number','boolean'].includes(typeof value))return
 require(depth<=5&&plain(value)&&Object.getOwnPropertySymbols(value).length===0)
 const descriptors=Object.getOwnPropertyDescriptors(value);require(Object.keys(descriptors).length<=32)
 for(const descriptor of Object.values(descriptors)){
  require(descriptor.enumerable&&Object.hasOwn(descriptor,'value'))
  inspectDescriptors(descriptor.value,depth+1)
 }
}
function snapshotRecord(value){
 inspectDescriptors(value)
 // Inspect descriptors before reading properties: inputs cannot execute getters.
 require(plain(value))
 for(const [key,descriptor]of Object.entries(Object.getOwnPropertyDescriptors(value))){
  require(descriptor.enumerable&&Object.hasOwn(descriptor,'value')&&[...required,...Object.keys(optional)].includes(key))
 }
 require(typeof value.id==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value.id)
  &&positive(value.revision)&&['OBSERVED','TRIAGED','REPRODUCED','PATCH_READY','VERIFIED','RELEASED','OBSERVING',...TERMINAL_STATES].includes(value.status)
  &&['C1','C2','C3'].includes(value.repairClass)&&hash(value.causeFingerprint)&&sha(value.baseSha)
  &&[0,1,2].includes(value.attemptsUsed)&&[0,1].includes(value.rollbacksUsed)&&integer(value.wakeAt))
 const metadata=structuredClone(value)
 require(required.every(key=>Object.hasOwn(metadata,key)))
 require(exact(metadata.pending,['action','nonce','externalId']))
 for(const [key,check]of Object.entries(optional)){
  if(!Object.hasOwn(metadata,key))continue
  require(nullable.has(key)&&metadata[key]===null||check(metadata[key]))
 }
 return metadata
}
function bindingContext(manifest,externalId,record){
 const m=assertVerifiedRepairManifest(manifest)
 require(typeof externalId==='string')
 const parts=externalId.split(':');require(parts.length===4)
 const b=readQualityJobBinding(externalId,{nonce:parts[2],action:parts[3]})
 require(record.id===m.incidentId&&record.baseSha===m.baseSha&&record.repairClass===m.repairClass
  &&record.pending.externalId===externalId&&record.pending.action===b.action&&record.pending.nonce===b.nonce)
 const expected={QUALIFY:'OBSERVED',REPRODUCE:'TRIAGED',EXECUTE:'REPRODUCED',VERIFY:'PATCH_READY',
  PROPOSE:'VERIFIED',CHECKS:'VERIFIED',PROMOTE:'VERIFIED',VERIFY_RUNTIME:'RELEASED',OBSERVE:'OBSERVING'}
 if(b.action==='ROLLBACK')require(['RELEASED','OBSERVING'].includes(record.status)&&record.rollbackRequired===true&&record.rollbacksUsed===1)
 else require(record.status===expected[b.action])
 if(b.action==='EXECUTE')require([1,2].includes(record.attemptsUsed)&&record.reproduction?.baseSha===m.baseSha)
 if(['VERIFY','PROPOSE','CHECKS','PROMOTE'].includes(b.action))require(record.patch!==null&&optional.patch(record.patch))
 if(['PROPOSE','CHECKS','PROMOTE'].includes(b.action))require(record.verification?.artifactSha256===record.patch.artifactSha256)
 if(['CHECKS','PROMOTE'].includes(b.action))require(optional.pr(record.pr))
 if(b.action==='PROMOTE')require(record.checks?.headSha===record.pr.headSha)
 if(['VERIFY_RUNTIME','OBSERVE','ROLLBACK'].includes(b.action))require(optional.release(record.release))
 return {manifest:m,binding:b}
}

/** Pure finite metadata codec, not an authorization or provider attestation.
 * The trusted job must independently verify its real native workflow/run,
 * original signed mandate, budget, role-specific receipts and fresh effects.
 * No lease token, command, QA, fixture, secret, connection or callback is encoded. */
export function encodeQualityJobState({manifest,record,externalId}){
 const value=snapshotRecord(record),{manifest:m,binding}=bindingContext(manifest,externalId,value)
 const encoded=JSON.stringify({schemaVersion:'AQC_CONTROLLER_STATE_V1',manifestSha256:documentDigest(m),
  controlSourceSha:binding.controlSourceSha,record:value})
 require(Buffer.byteLength(encoded)<=16384)
 return encoded
}
export function readQualityJobState({encoded,manifest,externalId}){
 require(typeof encoded==='string'&&Buffer.byteLength(encoded)<=16384)
 let body;try{body=JSON.parse(encoded)}catch{fail()}
 require(exact(body,['schemaVersion','manifestSha256','controlSourceSha','record'])
  &&body.schemaVersion==='AQC_CONTROLLER_STATE_V1'&&JSON.stringify(body)===encoded)
 const record=snapshotRecord(body.record),{manifest:m,binding}=bindingContext(manifest,externalId,record)
 require(body.manifestSha256===documentDigest(m)&&body.controlSourceSha===binding.controlSourceSha)
 return freeze({record,metadataSha256:documentDigest(body),authorityIncluded:false,providerIdentityVerified:false})
}

const nativeStates=new WeakSet()
const nativeFail=()=>{throw Object.assign(Error('Quality native job state unavailable'),{code:'JOB_STATE_NATIVE_INVOCATION_REQUIRED'})}
/** Only a current provider-pinned main job may consume its platform event state.
 * The event input is compared with the actual immutable dispatch inputs before
 * this capability is minted. It still does not replace original authority,
 * independent phase evidence, a native budget permit or fresh release gates. */

/** Provider identity/event proof only. This helper grants no original mandate,
 * paid permit, release authority, QA access or durable-store ownership. */
export async function verifyQualityNativeDispatchInputs({inputs,externalId,invocation,environment=process.env,notBefore,expiresAt,now=Date.now()}){
 inspectDescriptors(inputs)
 const {normalizeQualityControllerJobInputs}=await import('./job-context.mjs')
 try{inputs=normalizeQualityControllerJobInputs(inputs)}catch{nativeFail()}
 const {assertQualityControllerJobInvocation}=await import('./github.mjs')
 const native=assertQualityControllerJobInvocation(invocation,{externalId,runId:environment.GITHUB_RUN_ID})
 const b=externalId.split(':')
 const valid=inputs.mode==='controller-job'&&inputs.action===b[3]&&inputs.nonce===b[2]&&inputs.control_source_sha===b[1]
  &&environment.GITHUB_REPOSITORY==='profitia/SG-dev'&&environment.GITHUB_REF==='refs/heads/main'
  &&environment.GITHUB_SHA===native.controlSourceSha&&environment.GITHUB_RUN_ATTEMPT==='1'
  &&environment.GITHUB_WORKFLOW_REF==='profitia/SG-dev/.github/workflows/assistant-quality-repair.yml@refs/heads/main'
  &&environment.GITHUB_EVENT_NAME==='workflow_dispatch'&&environment.GITHUB_ACTOR==='profitia'&&environment.GITHUB_TRIGGERING_ACTOR==='profitia'
  &&environment.RUNNER_ENVIRONMENT==='github-hosted'&&environment.RUNNER_OS==='Linux'
  &&Number.isFinite(now)&&Number.isFinite(notBefore)&&Number.isFinite(expiresAt)
  &&notBefore<=Date.parse(native.createdAt)&&Date.parse(native.createdAt)<=now
  &&now-Date.parse(native.createdAt)<=1800000&&expiresAt>now
 if(!valid)nativeFail()
 const fs=await import('node:fs'),path=await import('node:path')
 try{
  const file=environment.GITHUB_EVENT_PATH
  if(typeof file!=='string'||!path.isAbsolute(file)||file.length>1024)nativeFail()
  const stat=fs.lstatSync(file)
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<=0||stat.size>131072||(stat.mode&0o022)!==0
   ||![0,1001,process.getuid?.()].includes(stat.uid))nativeFail()
  const event=JSON.parse(fs.readFileSync(file,'utf8'))
  if(!plain(event)||!plain(event.inputs)||documentDigest(normalizeQualityControllerJobInputs(event.inputs))!==documentDigest(inputs))nativeFail()
 }catch{nativeFail()}
 return freeze({inputs,native})
}
/** A finite metadata parser only. It cannot mint a manifest or native/provider
 * capability and contains no lease, command, QA, fixture or connection. */
export function readQualityControlRecordMetadata(value){return freeze(snapshotRecord(value))}

export async function admitQualityNativeJobState({inputs,manifest,externalId,invocation,environment=process.env,now=Date.now()}){
 const m=assertVerifiedRepairManifest(manifest)
 const checked=await verifyQualityNativeDispatchInputs({inputs,externalId,invocation,environment,
  notBefore:Date.parse(m.mandate.issuedAt),expiresAt:Date.parse(m.mandate.expiresAt),now})
 inputs=checked.inputs;const native=checked.native,b=externalId.split(':')
 const names=['mode','action','nonce','control_source_sha','incident_id','manifest_sha256','base_sha','state',
  ...(b[3]==='EXECUTE'?['permit_id','permit_expires_at']:[])]
 if(!exact(inputs,names)||inputs.incident_id!==m.incidentId||inputs.base_sha!==m.baseSha
  ||inputs.manifest_sha256!==documentDigest(m))nativeFail()
 const decoded=readQualityJobState({encoded:inputs.state,manifest:m,externalId})
 const admitted=freeze({kind:'AQC_NATIVE_JOB_STATE_V1',record:decoded.record,metadataSha256:decoded.metadataSha256,
  externalId,runId:native.runId,workflowId:native.workflowId,createdAt:native.createdAt,controlSourceSha:native.controlSourceSha,
  manifestSha256:documentDigest(m),providerIdentityVerified:true,authorityIncluded:false})
 nativeStates.add(admitted)
 return admitted
}
export function assertQualityNativeJobState(value,{manifest,externalId}){
 const m=assertVerifiedRepairManifest(manifest)
 if(!nativeStates.has(value)||value.externalId!==externalId||value.manifestSha256!==documentDigest(m))nativeFail()
 return value
}
