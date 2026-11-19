import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import {createHash,createPublicKey,createPrivateKey} from 'node:crypto'
import {publicKeyId} from './manifest.mjs'
import {normalizeQualityControllerJobInputs} from './job-context.mjs'
import {createQualityGitHub,createQualityNativeLinuxQualificationAttestor} from './github.mjs'
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
  holdout={pack:json(process.env.AQC_VERIFIER_PACK_JSON,1048576),
   packAttestation:json(process.env.AQC_VERIFIER_PACK_ATTESTATION_JSON,32768),
   reviewerKeys:keys(json(process.env.AQC_REVIEWER_PUBLIC_KEYS_JSON,8192))}
 }else require(!process.env.AQC_VERIFIER_PACK_JSON&&!process.env.AQC_VERIFIER_PACK_ATTESTATION_JSON,'NATIVE_JOB_SECRET_SCOPE_REJECTED')
 return withNativeStop(signal=>runQualityNativeVerifierJob({...common,signal,...(cicArchive===undefined?{}:{cicArchive}),...holdout}))
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  require(process.argv.length===3,'NATIVE_JOB_MODE_REQUIRED')
  if(process.argv[2]==='qualify-linux'){
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
