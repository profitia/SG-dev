import fs from 'node:fs'
import path from 'node:path'
import {gzipSync,gunzipSync} from 'node:zlib'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import {createHash,createPublicKey,createPrivateKey} from 'node:crypto'
import {publicKeyId,documentDigest,signDocument,verifyExecutionMandate} from './manifest.mjs'
import {normalizeQualityControllerJobInputs} from './job-context.mjs'
import {createQualityGitHub,createQualityNativeLinuxQualificationAttestor,readQualityGitHubCreatedAt} from './github.mjs'
import {qualificationPolicyDigest} from './acceptance.mjs'
import {assertExecutorHost,verifyLinuxQualification} from './executor.mjs'

const fail=code=>{throw Object.assign(Error('Native quality job unavailable'),{code})}
const require=(value,code='NATIVE_JOB_CONFIGURATION_INVALID')=>{if(!value)fail(code)}
const sourceSha=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value)
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
const roles=['EXECUTOR_SUPERVISOR','INDEPENDENT_VERIFIER','INDEPENDENT_PUBLISHER']
const ownFields={EXECUTOR_SUPERVISOR:'AQC_EXECUTOR_SUPERVISOR_PRIVATE_KEY',INDEPENDENT_VERIFIER:'AQC_INDEPENDENT_VERIFIER_PRIVATE_KEY'}
const plain=value=>value&&Object.getPrototypeOf(value)===Object.prototype
function json(value,maximum){
 require(typeof value==='string'&&Buffer.byteLength(value)>0&&Buffer.byteLength(value)<=maximum)
 try{return JSON.parse(value)}catch{fail('NATIVE_JOB_CONFIGURATION_INVALID')}
}
function keys(value){
 require(plain(value)&&Object.getOwnPropertySymbols(value).length===0&&Object.keys(value).length>0&&Object.keys(value).length<=4)
 const result=new Map()
 for(const [id,pem]of Object.entries(value)){
  require(hash(id)&&typeof pem==='string'&&Buffer.byteLength(pem)<=1024&&pem.startsWith('-----BEGIN PUBLIC KEY-----'))
  let key
  try{key=createPublicKey(pem)}catch{fail('NATIVE_JOB_CONFIGURATION_INVALID')}
  require(key.type==='public'&&key.asymmetricKeyType==='ed25519'&&publicKeyId(key)===id)
  result.set(id,key)
 }
 return result
}

/** Encoding only, without label review, attestation or authority. The same
 * encrypted GitHub secret stores this bounded JSON envelope. Original pack
 * bytes and its independent semantic digest survive compression unchanged. */
export function encodeQualityNativeHoldoutPack(packJson){
 require(typeof packJson==='string'&&Buffer.byteLength(packJson)<=1048576,'NATIVE_JOB_HOLDOUT_INVALID')
 const pack=json(packJson,1048576)
 require(Array.isArray(pack)&&pack.length>=200&&pack.length<=512,'NATIVE_JOB_HOLDOUT_INVALID')
 const bytes=Buffer.from(packJson),compressed=gzipSync(bytes,{level:9})
 const envelope=JSON.stringify({schemaVersion:'AQC_HOLDOUT_STORAGE_V1',encoding:'gzip+base64',
  uncompressedBytes:bytes.length,uncompressedSha256:createHash('sha256').update(bytes).digest('hex'),data:compressed.toString('base64')})
 require(Buffer.byteLength(envelope)<=49152,'NATIVE_JOB_HOLDOUT_SECRET_TOO_LARGE')
 return envelope
}
export function readQualityNativeHoldoutPack(envelopeJson){
 const invalid=()=>fail('NATIVE_JOB_HOLDOUT_INVALID')
 let value,compressed,bytes
 try{
  value=json(envelopeJson,49152)
  if(!plain(value)||Object.keys(value).sort().join(',')!=='data,encoding,schemaVersion,uncompressedBytes,uncompressedSha256'
   ||value.schemaVersion!=='AQC_HOLDOUT_STORAGE_V1'||value.encoding!=='gzip+base64'
   ||!Number.isSafeInteger(value.uncompressedBytes)||value.uncompressedBytes<1||value.uncompressedBytes>1048576
   ||!hash(value.uncompressedSha256)||typeof value.data!=='string'||value.data.length>49152
   ||!/^[A-Za-z0-9+/]+={0,2}$/.test(value.data))invalid()
  compressed=Buffer.from(value.data,'base64')
  if(compressed.toString('base64')!==value.data)invalid()
  bytes=gunzipSync(compressed,{maxOutputLength:value.uncompressedBytes})
  if(bytes.length!==value.uncompressedBytes||createHash('sha256').update(bytes).digest('hex')!==value.uncompressedSha256)invalid()
  const text=bytes.toString('utf8')
  if(!Buffer.from(text).equals(bytes))invalid()
  const pack=JSON.parse(text)
  if(!Array.isArray(pack)||pack.length<200||pack.length>512)invalid()
  return pack
 }catch{invalid()}
}

/** Public trust only. A supplied document can never install its own signer.
 * Each role and the offline owner must have a disjoint installed key map. */
export function readQualityNativeJobTrust({ownerJson,phaseJson}){
 const ownerKeys=keys(json(ownerJson,8192)),phases=json(phaseJson,24576)
 require(plain(phases)&&Object.keys(phases).sort().join(',')===[...roles].sort().join(','))
 const keysByRole=new Map(),used=new Set(ownerKeys.keys())
 for(const role of roles){
  const map=keys(phases[role])
  for(const id of map.keys()){require(!used.has(id),'NATIVE_JOB_SEPARATE_TRUST_REQUIRED');used.add(id)}
  keysByRole.set(role,map)
 }
 return {ownerKeys,keysByRole,verifierKeys:keysByRole.get('INDEPENDENT_VERIFIER')}
}
/** Pure admission of fixed native metadata. This is not a run attestation:
 * the real GitHub invocation and signed contexts are checked again by the
 * closed phase adapter. No callback, clock, URL or result port is accepted. */
export function readQualityNativeJobEnvironment(env,rawInputs){
 require(env&&typeof env==='object')
 const descriptors=Object.getOwnPropertyDescriptors(env)
 require(Object.values(descriptors).every(d=>Object.hasOwn(d,'value')),'NATIVE_JOB_ACCESSORS_FORBIDDEN')
 const inputs=normalizeQualityControllerJobInputs(rawInputs)
 require(env.GITHUB_ACTIONS==='true'&&env.RUNNER_ENVIRONMENT==='github-hosted'&&env.RUNNER_OS==='Linux'
  &&env.GITHUB_EVENT_NAME==='workflow_dispatch'&&env.GITHUB_REPOSITORY==='profitia/SG-dev'
  &&env.GITHUB_REF==='refs/heads/main'&&env.GITHUB_ACTOR==='profitia'&&env.GITHUB_TRIGGERING_ACTOR==='profitia'
  &&env.GITHUB_RUN_ATTEMPT==='1'&&/^[1-9][0-9]{0,19}$/.test(env.GITHUB_RUN_ID??'')
  &&env.GITHUB_WORKFLOW_REF==='profitia/SG-dev/.github/workflows/assistant-quality-repair.yml@refs/heads/main'
  &&sourceSha(env.GITHUB_SHA)&&env.GITHUB_SHA===inputs.control_source_sha
  &&env.TARGET_ENVIRONMENT==='development','NATIVE_JOB_NATIVE_INVOCATION_REQUIRED')
 require(['QUALIFY','REPRODUCE','VERIFY','EXECUTE'].includes(inputs.action),'NATIVE_JOB_ACTION_NOT_WIRED')
 require(Object.hasOwn(inputs,'state'),'NATIVE_JOB_STATE_REQUIRED')
 require(['false','true'].includes(env.AQC_PAID_REPAIRS_ENABLED)&&env.AQC_PROMOTION_ENABLED==='false','NATIVE_JOB_FLAGS_INVALID')
 for(const name of Object.keys(env)){
  if((/^(AQC_(QA_|HOLDOUT_|RENDER_|OWNER_PRIVATE|INDEPENDENT_PUBLISHER_PRIVATE)|DATABASE_URL$|RENDER_API_KEY$)/.test(name))
   &&env[name])fail('NATIVE_JOB_SECRET_SCOPE_REJECTED')
 }
 require(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>0
  &&hash(env.AQC_CONTROLLER_WORKFLOW_SHA256),'NATIVE_JOB_CONFIGURATION_INVALID')
 return Object.freeze({inputs,sourceSha:env.GITHUB_SHA,role:inputs.action==='EXECUTE'?'EXECUTOR_SUPERVISOR':'INDEPENDENT_VERIFIER',
  controllerWorkflowSha256:env.AQC_CONTROLLER_WORKFLOW_SHA256})
}
function native(){
 const inputFile=process.env.GITHUB_EVENT_PATH
 require(typeof inputFile==='string'&&path.isAbsolute(inputFile),'NATIVE_JOB_EVENT_REQUIRED')
 let event
 try{
  const info=fs.lstatSync(inputFile);require(info.isFile()&&!info.isSymbolicLink()&&info.size<=131072,'NATIVE_JOB_EVENT_REQUIRED')
  event=json(fs.readFileSync(inputFile,'utf8'),131072)
 }catch{fail('NATIVE_JOB_EVENT_REQUIRED')}
 const config=readQualityNativeJobEnvironment(process.env,event.inputs)
 return nativeCheckout(config)
}
function nativeCheckout(config){
 const root=fs.realpathSync(fileURLToPath(new URL('../../../',import.meta.url)))
 const git=args=>execFileSync('/usr/bin/git',['-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null','-C',root,...args],
  {encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:15000,maxBuffer:65536,
   env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'}}).trim()
 require(fs.realpathSync(process.env.GITHUB_WORKSPACE??'')===root&&git(['rev-parse','HEAD'])===config.sourceSha
  &&git(['status','--porcelain','--untracked-files=no'])===''
  &&['https://github.com/profitia/SG-dev','https://github.com/profitia/SG-dev.git'].includes(git(['config','--get','remote.origin.url'])),
  'NATIVE_JOB_CHECKOUT_INVALID')
 const workflow=fs.readFileSync(path.join(root,'.github/workflows/assistant-quality-repair.yml'))
 require(createHash('sha256').update(workflow).digest('hex')===config.controllerWorkflowSha256,'NATIVE_JOB_WORKFLOW_INVALID')
 const gateSetSha256=qualificationPolicyDigest(fileURLToPath(new URL('../',import.meta.url)))
 return {config,root,gateSetSha256}
}
function trustedPrivateKey(role,trust){
 const name=ownFields[role];require(name,'NATIVE_JOB_SIGNER_REQUIRED')
 for(const [other,field]of Object.entries(ownFields))if(other!==role&&process.env[field])fail('NATIVE_JOB_SECRET_SCOPE_REJECTED')
 let key
 try{
  const pem=process.env[name];require(typeof pem==='string'&&Buffer.byteLength(pem)<=2048,'NATIVE_JOB_SIGNER_REQUIRED')
  key=createPrivateKey(pem)
 }catch{fail('NATIVE_JOB_SIGNER_REQUIRED')}
 require(key.type==='private'&&key.asymmetricKeyType==='ed25519'
  &&trust.keysByRole.get(role).has(publicKeyId(createPublicKey(key))),'NATIVE_JOB_SIGNER_REQUIRED')
 return key
}
async function withNativeStop(run){
 const stop=new AbortController(),abort=()=>stop.abort()
 process.once('SIGTERM',abort);process.once('SIGINT',abort)
 try{return await run(stop.signal)}finally{process.removeListener('SIGTERM',abort);process.removeListener('SIGINT',abort)}
}
const installedTrust=()=>readQualityNativeJobTrust({
 ownerJson:process.env.AQC_OWNER_PUBLIC_KEYS_JSON,phaseJson:process.env.AQC_PHASE_PUBLIC_KEYS_JSON})
/** Early read-only admission before any private package credential is made
 * available. It repeats the original full context/state validation; its public
 * metadata result is never reused as authority by the actual phase. */
export async function runQualityNativeJobContextPreflight(...args){
 require(args.length===0,'NATIVE_JOB_INPUTS_FORBIDDEN')
 const {config,gateSetSha256}=native(),trust=installedTrust()
 require(config.role==='INDEPENDENT_VERIFIER','NATIVE_JOB_CONTEXT_PHASE_REQUIRED')
 for(const name of ['OPENAI_API_KEY','NPM_TOKEN','AQC_EXECUTOR_SUPERVISOR_PRIVATE_KEY',
  'AQC_INDEPENDENT_VERIFIER_PRIVATE_KEY','AQC_INDEPENDENT_PUBLISHER_PRIVATE_KEY',
  'AQC_LIMITS_BROKER_DATABASE_URL','AQC_LIMITS_BROKER_COMMAND_KEY',
  'AQC_VERIFIER_PACK_JSON','AQC_VERIFIER_PACK_ATTESTATION_JSON'])
  require(!process.env[name],'NATIVE_JOB_SECRET_SCOPE_REJECTED')
 const qualified=verifyLinuxQualification(json(process.env.AQC_LINUX_QUALIFICATION_JSON,16384),
  {keys:trust.verifierKeys,gateSetSha256})
 require(qualified.sourceSha===config.sourceSha,'NATIVE_JOB_QUALIFICATION_SOURCE_MISMATCH')
 const github=createQualityGitHub({token:process.env.GITHUB_TOKEN,controllerWorkflowSha256:config.controllerWorkflowSha256})
 const nativeInvocation=await github.controllerJobInvocation({
  externalId:'aqc-job:'+config.sourceSha+':'+config.inputs.nonce+':'+config.inputs.action,runId:process.env.GITHUB_RUN_ID})
 const {readQualityControllerJobContext}=await import('./cli.mjs')
 const context=await readQualityControllerJobContext({inputs:config.inputs,nativeInvocation,
  registry:process.env.AQC_REPAIR_CONTEXTS_JSON,ownerKeys:trust.ownerKeys,verifierKeys:trust.verifierKeys,
  expectedServiceId:'srv-dapa3tid0e5s73f8bc5g',expectedGateSetSha256:gateSetSha256})
 return Object.freeze({schemaVersion:'AQC_NATIVE_CONTEXT_PREFLIGHT_V1',status:'NATIVE_CONTEXT_VERIFIED',
  sourceSha:config.sourceSha,manifestSha256:config.inputs.manifest_sha256,
  gateSetSha256,expiresAt:context.manifest.mandate.expiresAt,rawQaPayloadIncluded:false})
}
/** Separate verifier job: attests only a real, already completed native Linux
 * run and original hashed artifact. No caller-provided observation is admitted.
 * Returned qualification expires at the original horizon, never signing time. */
export async function runQualityNativeJobQualification(...args){
 require(args.length===0,'NATIVE_JOB_INPUTS_FORBIDDEN')
 const {config,gateSetSha256}=native(),trust=installedTrust()
 const privateKey=trustedPrivateKey('INDEPENDENT_VERIFIER',trust)
 for(const name of ['OPENAI_API_KEY','AQC_LIMITS_BROKER_DATABASE_URL','AQC_LIMITS_BROKER_COMMAND_KEY','NPM_TOKEN','AQC_VERIFIER_PACK_JSON','AQC_VERIFIER_PACK_ATTESTATION_JSON'])
  require(!process.env[name],'NATIVE_JOB_SECRET_SCOPE_REJECTED')
 const github=createQualityGitHub({token:process.env.GITHUB_TOKEN,controllerWorkflowSha256:config.controllerWorkflowSha256})
 await github.controllerJobInvocation({externalId:'aqc-job:'+config.sourceSha+':'+config.inputs.nonce+':'+config.inputs.action,runId:process.env.GITHUB_RUN_ID})
 const reference=await github.latestLinuxQualificationReference({sourceSha:config.sourceSha})
 const observation=await github.linuxQualificationObservations(reference)
 return createQualityNativeLinuxQualificationAttestor({privateKey}).attest({observation,gateSetSha256})
}
/** Closed role job. All environment/event, checkout, workflow, qualification
 * and signing bindings precede native provider work; phase adapters retain
 * their own real invocation, historical receipts and isolation checks. */
export async function runQualityNativeRoleJob(...args){
 require(args.length===0,'NATIVE_JOB_INPUTS_FORBIDDEN')
 const {config,root,gateSetSha256}=native()
 if(config.inputs.action==='EXECUTE'&&process.env.AQC_PAID_REPAIRS_ENABLED!=='true')fail('NATIVE_EXECUTOR_NOT_ACTIVATED')
 const trust=installedTrust(),privateKey=trustedPrivateKey(config.role,trust)
 const qualification=json(process.env.AQC_LINUX_QUALIFICATION_JSON,16384)
 const qualified=verifyLinuxQualification(qualification,{keys:trust.verifierKeys,gateSetSha256})
 require(qualified.sourceSha===config.sourceSha,'NATIVE_JOB_QUALIFICATION_SOURCE_MISMATCH')
 assertExecutorHost()
 const common={inputs:config.inputs,token:process.env.GITHUB_TOKEN,controllerWorkflowSha256:config.controllerWorkflowSha256,
  registry:process.env.AQC_REPAIR_CONTEXTS_JSON,...trust,expectedServiceId:'srv-dapa3tid0e5s73f8bc5g',
  expectedGateSetSha256:gateSetSha256,repositoryRoot:root,qualification,qualificationKeys:trust.verifierKeys,privateKey}
 if(config.inputs.action==='EXECUTE'){
  const {runQualityNativeExecutorJob}=await import('./executor-job.mjs')
  return withNativeStop(signal=>runQualityNativeExecutorJob({...common,signal,limitsDatabaseUrl:process.env.AQC_LIMITS_BROKER_DATABASE_URL,
   limitsCommandKey:process.env.AQC_LIMITS_BROKER_COMMAND_KEY,limitsServiceId:process.env.AQC_LIMITS_SERVICE_ID,
   openaiKey:process.env.OPENAI_API_KEY??''}))
 }
 require(!process.env.OPENAI_API_KEY&&!process.env.AQC_LIMITS_BROKER_DATABASE_URL
  &&!process.env.AQC_LIMITS_BROKER_COMMAND_KEY&&!process.env.NPM_TOKEN,'NATIVE_JOB_SECRET_SCOPE_REJECTED')
 const {runQualityNativeVerifierJob}=await import('./verifier-job.mjs')
 const archivePath='/tmp/aqc-cic-core-1.8.0.tgz'
 let cicArchive
 if(fs.existsSync(archivePath)){
  const info=fs.lstatSync(archivePath)
  require(info.isFile()&&!info.isSymbolicLink()&&info.uid===0&&!(info.mode&0o022)&&info.size<=2097152,'NATIVE_JOB_CIC_ARCHIVE_INVALID')
  cicArchive=fs.readFileSync(archivePath)
  require(createHash('sha512').update(cicArchive).digest('base64')==='tuun88+cfOHFeCafBw1a8gnExgeDyWBgY7Zd9OPkKk2/Eef0YBP49vzDcXKVpFoCNJGh/CYbeR9B+M2ZXctNsg==','NATIVE_JOB_CIC_ARCHIVE_INVALID')
 }
 // VERIFY's private holdout is loaded only by its separate trusted verifier
 // step after independent review. Other actions admit neither pack nor labels.
 let holdout={}
 if(config.inputs.action==='VERIFY'){
  holdout={pack:readQualityNativeHoldoutPack(process.env.AQC_VERIFIER_PACK_JSON),
   packAttestation:json(process.env.AQC_VERIFIER_PACK_ATTESTATION_JSON,32768),
   reviewerKeys:keys(json(process.env.AQC_REVIEWER_PUBLIC_KEYS_JSON,8192))}
 }else require(!process.env.AQC_VERIFIER_PACK_JSON&&!process.env.AQC_VERIFIER_PACK_ATTESTATION_JSON,'NATIVE_JOB_SECRET_SCOPE_REJECTED')
 return withNativeStop(signal=>runQualityNativeVerifierJob({...common,signal,...(cicArchive===undefined?{}:{cicArchive}),...holdout}))
}

// Public technical smoke cases, never a private holdout or reference verdict.
// The signer can export only these three fixed cases; workflow inputs cannot
// contain a prompt, source payload, expected output or replacement fixture.
const freezeTechnical=value=>{
 if(value&&typeof value==='object'){Object.values(value).forEach(freezeTechnical);Object.freeze(value)}
 return value
}
export const QUALITY_TECHNICAL_SYNTHETIC_CASES=freezeTechnical([
 {schemaVersion:'AQC_REGRESSION_V1',repairClass:'C1',caseFamily:'technical_calendar_next_week_warsaw',locale:'pl',
  args:[{message:'Jakie publikacje beda w przyszlym tygodniu?',reference:null},null,Date.parse('2026-11-11T12:00:00.000Z'),'Europe/Warsaw'],
  expected:{version:'2.1.0',source:'ECONOMIC_CALENDAR',targetType:null,targetId:null,
   from:'2026-11-15T23:00:00.000Z',to:'2026-11-22T22:59:59.999Z',asKnownAt:null,after:null},
  expectedAnswer:true,refusal:{pointer:'',values:[null]}},
 {schemaVersion:'AQC_REGRESSION_V1',repairClass:'C2',caseFamily:'technical_source_zero_is_a_fact',locale:'en',
  args:[{facts:[{id:'fact_controlled_zero',source:'CONTROLLED_REFERENCE',path:'source.originalValue',value:'0'}],
   period:null,locale:'en',limitation:null,clarify:false,omitted:false}],
  expected:'- CONTROLLED\\_REFERENCE / source.originalValue: 0',expectedAnswer:true,refusal:{pointer:'',values:['']}},
 {schemaVersion:'AQC_REGRESSION_V1',repairClass:'C3',caseFamily:'technical_access_denied_no_generation',locale:'pl',
  args:[{requiresContext:true,contextStatuses:['DENIED'],intent:'CLEAR',draftState:'NOT_GENERATED',
   verifiedFactsAvailable:false,limitationAcknowledged:false,storedContextRetryAvailable:false,storedContextRetryAttempts:0}],
  expected:{contractVersion:'1.0.0',action:'EXPLAIN_LIMITATION',reason:'ACCESS_DENIED',publishGeneratedDraft:false,
   verifiedFactsOnly:false,requireLimitation:true,questionLimit:0},
  expectedAnswer:false,refusal:{pointer:'/action',values:['EXPLAIN_LIMITATION','CLARIFY']}},
])
function technicalExportRequest(request,{ownerKeys,gateSetSha256,now}){
 const value=json(request,32768)
 documentDigest(value)
 require(plain(value)&&Object.keys(value).sort().join(',')==='environment,fixtures,mandate,repository,schemaVersion'
  &&value.schemaVersion==='AQC_CONTROLLED_JOB_CONTEXTS_V1'&&value.repository==='profitia/SG-dev'
  &&value.environment==='development'&&Array.isArray(value.fixtures)&&value.fixtures.length===0,
  'NATIVE_EXPORT_REQUEST_INVALID')
 const mandate=verifyExecutionMandate(value.mandate,{ownerKeys,now,
  expectedServiceId:'srv-dapa3tid0e5s73f8bc5g',expectedGateSetSha256:gateSetSha256})
 require(Date.parse(mandate.expiresAt)-Date.parse(mandate.issuedAt)<=3600000
  &&Date.parse(mandate.expiresAt)<=Date.parse('2026-11-27T23:59:59.000Z'),'NATIVE_EXPORT_MANDATE_HORIZON_INVALID')
 return value
}
/** Pure role attestor with a fixed public three-case payload. No caller can
 * provide labels, a fixture, signer trust or an execution callback via a job.
 * Native entry below supplies installed disjoint trust only after real Linux
 * qualification. This grants no incident, paid, publication or QA authority. */
export function createQualityTechnicalContextExports(options){
 require(plain(options)&&Object.getOwnPropertySymbols(options).length===0,'NATIVE_EXPORT_CONFIGURATION_INVALID')
 const fields=Object.getOwnPropertyDescriptors(options),names=['request','ownerKeys','verifierKeys','privateKey','gateSetSha256','now']
 require(Object.keys(fields).sort().join(',')===names.sort().join(',')
  &&Object.values(fields).every(d=>d.enumerable&&Object.hasOwn(d,'value')),'NATIVE_EXPORT_CONFIGURATION_INVALID')
 const {request,ownerKeys,verifierKeys,privateKey,gateSetSha256,now}=options
 require(Number.isSafeInteger(now)&&now>=0&&hash(gateSetSha256),'NATIVE_EXPORT_CONFIGURATION_INVALID')
 require(ownerKeys instanceof Map&&verifierKeys instanceof Map&&ownerKeys.size>0&&ownerKeys.size<=4
  &&verifierKeys.size>0&&verifierKeys.size<=4,'NATIVE_EXPORT_TRUST_REQUIRED')
 for(const map of [ownerKeys,verifierKeys])for(const [id,key]of map)
  require(key?.type==='public'&&key.asymmetricKeyType==='ed25519'&&publicKeyId(key)===id,'NATIVE_EXPORT_TRUST_REQUIRED')
 require([...ownerKeys.keys()].every(id=>!verifierKeys.has(id)),'NATIVE_EXPORT_SEPARATE_TRUST_REQUIRED')
 require(privateKey?.type==='private'&&privateKey.asymmetricKeyType==='ed25519'
  &&verifierKeys.has(publicKeyId(createPublicKey(privateKey))),'NATIVE_EXPORT_SIGNER_REQUIRED')
 const value=technicalExportRequest(request,{ownerKeys:new Map(ownerKeys),gateSetSha256,now})
 const mandateSha256=documentDigest(value.mandate.body)
 const engineeringId=(kind,repairClass)=>{
  const h=createHash('sha256').update('AQC-technical-export/1/'+mandateSha256+'/'+kind+'/'+repairClass).digest('hex')
  return h.slice(0,8)+'-'+h.slice(8,12)+'-5'+h.slice(13,16)+'-8'+h.slice(17,20)+'-'+h.slice(20,32)
 }
 const exports=QUALITY_TECHNICAL_SYNTHETIC_CASES.map(regression=>{
  const sha256=documentDigest(regression)
  return signDocument('AQC_SYNTHETIC_EXPORT_V1',{
   id:engineeringId('receipt',regression.repairClass),fixtureId:'qa_synthetic_'+sha256,sha256,
   scope:'CONTROLLED_ACCEPTANCE',incidentId:engineeringId('incident',regression.repairClass),
   repairClass:regression.repairClass,issuedAt:new Date(now).toISOString(),
   expiresAt:value.mandate.body.expiresAt,rawQaPayloadIncluded:false},privateKey)
 })
 return freezeTechnical({schemaVersion:'AQC_TECHNICAL_SYNTHETIC_EXPORTS_V1',
  repository:'profitia/SG-dev',environment:'development',mandateSha256,gateSetSha256,exports})
}
export function readQualityNativeContextExportEnvironment(env,inputs){
 require(env&&typeof env==='object'&&plain(inputs),'NATIVE_EXPORT_ENVIRONMENT_INVALID')
 const descriptors=Object.getOwnPropertyDescriptors(env),inputFields=Object.getOwnPropertyDescriptors(inputs)
 require(Object.values(descriptors).every(d=>Object.hasOwn(d,'value'))
  &&Object.getOwnPropertySymbols(inputs).length===0
  &&Object.values(inputFields).every(d=>d.enumerable&&Object.hasOwn(d,'value')),'NATIVE_JOB_ACCESSORS_FORBIDDEN')
 const allowed=['mode','nonce','control_source_sha','base_sha','action','incident_id','manifest_sha256','state','permit_id','permit_expires_at']
 require(Object.keys(inputFields).every(k=>allowed.includes(k)&&typeof inputs[k]==='string'&&inputs[k].length<=256)
  &&inputs.mode==='context-export'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(inputs.nonce??'')
  &&sourceSha(inputs.control_source_sha)
  &&Object.entries(inputs).every(([k,v])=>['mode','nonce','control_source_sha'].includes(k)||v===''),
  'NATIVE_EXPORT_INPUTS_INVALID')
 require(env.GITHUB_ACTIONS==='true'&&env.RUNNER_ENVIRONMENT==='github-hosted'&&env.RUNNER_OS==='Linux'
  &&env.GITHUB_EVENT_NAME==='workflow_dispatch'&&env.GITHUB_REPOSITORY==='profitia/SG-dev'
  &&env.GITHUB_REF==='refs/heads/main'&&env.GITHUB_ACTOR==='profitia'&&env.GITHUB_TRIGGERING_ACTOR==='profitia'
  &&env.GITHUB_RUN_ATTEMPT==='1'&&/^[1-9][0-9]{0,19}$/.test(env.GITHUB_RUN_ID??'')
  &&env.GITHUB_WORKFLOW_REF==='profitia/SG-dev/.github/workflows/assistant-quality-repair.yml@refs/heads/main'
  &&env.GITHUB_SHA===inputs.control_source_sha,'NATIVE_JOB_NATIVE_INVOCATION_REQUIRED')
 require(env.TARGET_ENVIRONMENT==='development'&&env.AQC_PAID_REPAIRS_ENABLED==='false'
  &&env.AQC_PROMOTION_ENABLED==='false','NATIVE_JOB_FLAGS_INVALID')
 for(const name of ['OPENAI_API_KEY','NPM_TOKEN','DATABASE_URL','RENDER_API_KEY',
  'AQC_EXECUTOR_SUPERVISOR_PRIVATE_KEY','AQC_INDEPENDENT_PUBLISHER_PRIVATE_KEY','AQC_OWNER_PRIVATE_KEY',
  'AQC_RUNTIME_OBSERVER_PRIVATE_KEY','AQC_LIMITS_BROKER_DATABASE_URL','AQC_LIMITS_BROKER_COMMAND_KEY',
  'AQC_VERIFIER_PACK_JSON','AQC_VERIFIER_PACK_ATTESTATION_JSON','AQC_HOLDOUT_PACK_JSON','AQC_HOLDOUT_ATTESTATION_JSON'])
  require(!env[name],'NATIVE_JOB_SECRET_SCOPE_REJECTED')
 for(const name of Object.keys(env))if(/^AQC_(?:QA_|RENDER_)/.test(name))
  require(!env[name],'NATIVE_JOB_SECRET_SCOPE_REJECTED')
 require(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>0
  &&hash(env.AQC_CONTROLLER_WORKFLOW_SHA256),'NATIVE_JOB_CONFIGURATION_INVALID')
 return Object.freeze({inputs:Object.freeze({mode:inputs.mode,nonce:inputs.nonce,control_source_sha:inputs.control_source_sha}),
  sourceSha:inputs.control_source_sha,role:'INDEPENDENT_VERIFIER',controllerWorkflowSha256:env.AQC_CONTROLLER_WORKFLOW_SHA256})
}
/** No caller-provided environment, result, clock, network or signing port. */
export async function runQualityNativeContextExport(...args){
 require(args.length===0,'NATIVE_JOB_INPUTS_FORBIDDEN')
 const inputFile=process.env.GITHUB_EVENT_PATH
 require(typeof inputFile==='string'&&path.isAbsolute(inputFile),'NATIVE_JOB_EVENT_REQUIRED')
 const info=fs.lstatSync(inputFile)
 require(info.isFile()&&!info.isSymbolicLink()&&info.size<=131072,'NATIVE_JOB_EVENT_REQUIRED')
 const event=json(fs.readFileSync(inputFile,'utf8'),131072)
 const config=readQualityNativeContextExportEnvironment(process.env,event.inputs)
 const {gateSetSha256}=nativeCheckout(config),trust=installedTrust()
 technicalExportRequest(process.env.AQC_REPAIR_CONTEXTS_JSON,{ownerKeys:trust.ownerKeys,gateSetSha256,now:Date.now()})
 const privateKey=trustedPrivateKey('INDEPENDENT_VERIFIER',trust)
 const github=createQualityGitHub({token:process.env.GITHUB_TOKEN,controllerWorkflowSha256:config.controllerWorkflowSha256})
 const descriptor=await github.qualificationDescriptor()
 const run=await github.qualification({runId:process.env.GITHUB_RUN_ID,sourceSha:config.sourceSha,nonce:config.inputs.nonce})
 const created=Date.parse(readQualityGitHubCreatedAt(run.created_at)),observed=Date.now()
 require(String(run.workflow_id)===descriptor.workflowId&&run.status==='in_progress'&&run.conclusion===null
  &&created<=observed&&observed-created<=1800000,'NATIVE_JOB_NATIVE_INVOCATION_REQUIRED')
 const reference=await github.latestLinuxQualificationReference({sourceSha:config.sourceSha})
 const observation=await github.linuxQualificationObservations(reference)
 const qualification=await createQualityNativeLinuxQualificationAttestor({privateKey}).attest({observation,gateSetSha256})
 const qualified=verifyLinuxQualification(qualification,{keys:trust.verifierKeys,gateSetSha256})
 require(qualified.sourceSha===config.sourceSha,'NATIVE_JOB_QUALIFICATION_SOURCE_MISMATCH')
 const bundle=createQualityTechnicalContextExports({request:process.env.AQC_REPAIR_CONTEXTS_JSON,
  ownerKeys:trust.ownerKeys,verifierKeys:trust.verifierKeys,privateKey,gateSetSha256,now:Date.now()})
 return freezeTechnical({...bundle,sourceSha:config.sourceSha,runId:process.env.GITHUB_RUN_ID,
  nonce:config.inputs.nonce,controllerWorkflowSha256:config.controllerWorkflowSha256,
  qualificationSha256:documentDigest(qualification),rawQaPayloadIncluded:false})
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  require(process.argv.length===3,'NATIVE_JOB_MODE_REQUIRED')
  if(process.argv[2]==='context-export'){
   const document=await runQualityNativeContextExport()
   fs.writeFileSync('/tmp/aqc-synthetic-exports.json',JSON.stringify(document),{flag:'wx',mode:0o600})
   console.log(JSON.stringify({status:'THREE_TECHNICAL_SYNTHETIC_EXPORTS',sourceSha:document.sourceSha,
    exportCount:document.exports.length,paidRepairsEnabled:false,promotionEnabled:false}))
  }else if(process.argv[2]==='validate-context'){
   console.log(JSON.stringify(await runQualityNativeJobContextPreflight()))
  }else if(process.argv[2]==='qualify-linux'){
   const document=await runQualityNativeJobQualification()
   require(typeof process.env.GITHUB_OUTPUT==='string','NATIVE_JOB_OUTPUT_REQUIRED')
   fs.appendFileSync(process.env.GITHUB_OUTPUT,'qualification='+JSON.stringify(document)+'\n')
   console.log(JSON.stringify({status:'NATIVE_LINUX_ATTESTED',sourceSha:document.body.sourceSha,runId:document.body.runId,
    gateSetSha256:document.body.gateSetSha256,expiresAt:document.body.expiresAt}))
  }else if(process.argv[2]==='phase'){
   const value=await runQualityNativeRoleJob()
   require(value.phaseReceipt&&value.rawQaPayloadIncluded===false,'NATIVE_JOB_RESULT_REQUIRED')
   fs.writeFileSync('/tmp/result.json',JSON.stringify(value.phaseReceipt),{flag:'wx',mode:0o600})
   if(value.verificationReceipt)fs.writeFileSync('/tmp/verification.json',JSON.stringify(value.verificationReceipt),{flag:'wx',mode:0o600})
   if(value.patchDocument)fs.writeFileSync('/tmp/patch.json',JSON.stringify(value.patchDocument),{flag:'wx',mode:0o600})
   console.log(JSON.stringify({status:'NATIVE_PHASE_COMPLETE',action:value.action,sourceSha:process.env.GITHUB_SHA}))
  }else fail('NATIVE_JOB_MODE_REQUIRED')
 }catch(error){
  console.error(JSON.stringify({event:'aqc.native_job.failure',code:/^[A-Z][A-Z0-9_]{1,79}$/.test(error?.code??'')?error.code:'NATIVE_JOB_UNAVAILABLE'}))
  process.exitCode=1
 }
}
