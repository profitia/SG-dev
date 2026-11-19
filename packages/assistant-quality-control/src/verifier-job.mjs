import {createPublicKey} from 'node:crypto'
import {documentDigest,publicKeyId,SOURCE_PATHS} from './manifest.mjs'
import {normalizeQualityControllerJobInputs} from './job-context.mjs'
import {readQualityControllerJobContext} from './cli.mjs'
import {createQualityGitHub,readQualityControllerPatch} from './github.mjs'
import {assertQualityNativeJobState} from './job-state.mjs'
import {createPublicProjection} from './provenance.mjs'
import {reproduceQualityBaselineInIsolation,verifyQualityCandidateInIsolation,createQualityControllerVerificationAttestor} from './verify.mjs'

const fail=code=>{throw Object.assign(Error('Native quality verifier unavailable'),{code})}
const require=(v,code='NATIVE_VERIFIER_INPUT_INVALID')=>{if(!v)fail(code)}
function fields(value,required,optional=[]){
 require(value&&Object.getPrototypeOf(value)===Object.prototype&&Object.getOwnPropertySymbols(value).length===0)
 const descriptors=Object.getOwnPropertyDescriptors(value)
 require(required.every(k=>Object.hasOwn(descriptors,k))
  &&Object.keys(descriptors).every(k=>[...required,...optional].includes(k))
  &&Object.values(descriptors).every(d=>d.enumerable&&Object.hasOwn(d,'value')))
}

/** Closed trusted verifier composition. All provider reads use the fixed real
 * GitHub client; no caller callback, URL, result, transcript or execution port
 * can replace them. The native platform event and original signed contexts are
 * admitted before a prior receipt or candidate is read. This function is not
 * called by readiness/standby and does not dispatch, spend, merge or deploy. */
export async function runQualityNativeVerifierJob(options){
 const common=['inputs','token','controllerWorkflowSha256','registry','ownerKeys','verifierKeys','keysByRole',
  'expectedServiceId','expectedGateSetSha256','repositoryRoot','qualification','qualificationKeys','privateKey']
 fields(options,common,['cicArchive','signal','pack','packAttestation','reviewerKeys'])
 const o=Object.freeze({...options}),inputs=normalizeQualityControllerJobInputs(o.inputs)
 require(['QUALIFY','REPRODUCE','VERIFY'].includes(inputs.action),'NATIVE_VERIFIER_ACTION_FORBIDDEN')
 require(Object.hasOwn(inputs,'state'),'NATIVE_VERIFIER_STATE_REQUIRED')
 const privateFields=['pack','packAttestation','reviewerKeys']
 require(privateFields.every(k=>Object.hasOwn(o,k)===(inputs.action==='VERIFY')),'NATIVE_VERIFIER_REFERENCE_SCOPE_INVALID')
 require(o.signal===undefined||o.signal instanceof AbortSignal)
 require(o.privateKey?.type==='private'&&o.privateKey.asymmetricKeyType==='ed25519','VERIFICATION_SIGNER_REQUIRED')
 require(o.keysByRole instanceof Map&&o.ownerKeys instanceof Map&&o.verifierKeys instanceof Map
  &&o.qualificationKeys instanceof Map,'NATIVE_VERIFIER_TRUST_REQUIRED')
 const phaseKeys=o.keysByRole.get('INDEPENDENT_VERIFIER'),ownId=publicKeyId(createPublicKey(o.privateKey))
 require(phaseKeys instanceof Map&&phaseKeys.has(ownId)&&!o.ownerKeys.has(ownId),'NATIVE_VERIFIER_TRUST_REQUIRED')
 require(o.keysByRole.size===3,'NATIVE_VERIFIER_TRUST_REQUIRED')
 const used=new Set()
 for(const role of ['INDEPENDENT_VERIFIER','EXECUTOR_SUPERVISOR','INDEPENDENT_PUBLISHER']){
  const roleKeys=o.keysByRole.get(role)
  require(roleKeys instanceof Map&&roleKeys.size>0&&roleKeys.size<=4,'NATIVE_VERIFIER_TRUST_REQUIRED')
  for(const [id,key]of roleKeys){
   require(!used.has(id)&&!o.ownerKeys.has(id),'NATIVE_VERIFIER_SEPARATE_TRUST_REQUIRED')
   require(key?.type==='public'&&key.asymmetricKeyType==='ed25519'&&publicKeyId(key)===id,'NATIVE_VERIFIER_TRUST_REQUIRED')
   used.add(id)
  }
 }
 const {assertExecutorHost}=await import('./executor.mjs'),host=assertExecutorHost()
 require(host.executorSourceSha===inputs.control_source_sha,'NATIVE_VERIFIER_SOURCE_MISMATCH')
 const [{fileURLToPath},{realpathSync},{execFileSync},{qualificationPolicyDigest}]=await Promise.all([
  import('node:url'),import('node:fs'),import('node:child_process'),import('./acceptance.mjs')])
 const moduleRoot=realpathSync(fileURLToPath(new URL('../../../',import.meta.url)))
 let actualRoot,head,remote,dirty
 try{
  actualRoot=realpathSync(o.repositoryRoot)
  const git=args=>execFileSync('/usr/bin/git',['-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null','-C',actualRoot,...args],
   {encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:15000,maxBuffer:65536,
    env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'}}).trim()
  head=git(['rev-parse','HEAD']);remote=git(['config','--get','remote.origin.url'])
  dirty=git(['status','--porcelain','--untracked-files=no'])
 }catch{fail('NATIVE_VERIFIER_CHECKOUT_INVALID')}
 require(actualRoot===moduleRoot&&head===host.executorSourceSha&&dirty===''
  &&['https://github.com/profitia/SG-dev','https://github.com/profitia/SG-dev.git'].includes(remote),'NATIVE_VERIFIER_CHECKOUT_INVALID')
 const observedGateSetSha256=qualificationPolicyDigest(fileURLToPath(new URL('../',import.meta.url)))
 require(observedGateSetSha256===o.expectedGateSetSha256,'NATIVE_VERIFIER_POLICY_MISMATCH')
 // Snapshot installed trust and signed context before any provider await.
 const ownerKeys=new Map(o.ownerKeys),verifierKeys=new Map(o.verifierKeys)
 const keysByRole=new Map([...o.keysByRole].map(([role,keys])=>[role,new Map(keys)]))
 documentDigest(o.registry)
 const registry=typeof o.registry==='string'?o.registry:JSON.stringify(o.registry)
 const externalId='aqc-job:'+inputs.control_source_sha+':'+inputs.nonce+':'+inputs.action
 const github=createQualityGitHub({token:o.token,controllerWorkflowSha256:o.controllerWorkflowSha256})
 const nativeInvocation=await github.controllerJobInvocation({externalId,runId:process.env.GITHUB_RUN_ID})
 const context=await readQualityControllerJobContext({inputs,nativeInvocation,registry,
  ownerKeys,verifierKeys,expectedServiceId:o.expectedServiceId,
  expectedGateSetSha256:o.expectedGateSetSha256,now:Date.now()})
 const {manifest,jobState}=context,state=assertQualityNativeJobState(jobState,{manifest,externalId})
 const signer=createQualityControllerVerificationAttestor({privateKey:o.privateKey})
 const history=async action=>github.controllerJobHistory({manifest,jobState,externalId,action,keysByRole})
 if(inputs.action!=='QUALIFY')await history('QUALIFY')
 if(inputs.action!=='VERIFY'){
  const value=await reproduceQualityBaselineInIsolation({manifest,jobState,externalId,repositoryRoot:o.repositoryRoot,
   regression:context.regression,qualification:o.qualification,qualificationKeys:new Map(o.qualificationKeys),
   observedGateSetSha256,...(o.cicArchive===undefined?{}:{cicArchive:o.cicArchive}),
   ...(o.signal===undefined?{}:{signal:o.signal})})
  const phaseReceipt=await signer.attestBaseline({value,manifest,jobState,externalId})
  return Object.freeze({schemaVersion:'AQC_NATIVE_VERIFIER_OUTPUT_V1',action:inputs.action,phaseReceipt,
   baselineEvidence:value,rawQaPayloadIncluded:false})
 }
 await history('REPRODUCE')
 const execution=await history('EXECUTE'),reference=state.record.reproduction.nativeJobs.execute
 const patchObservation=await github.controllerJobPatch({externalId:reference.externalId,runId:reference.runId})
 const projection=createPublicProjection({repositoryRoot:o.repositoryRoot,manifest})
 const priorRecord={...state.record,status:'REPRODUCED',pending:{action:'EXECUTE',
  nonce:reference.externalId.split(':')[2],externalId:reference.externalId}}
 const artifact=readQualityControllerPatch({resultObservation:execution.observation,patchObservation,
  beforeSource:projection.files[SOURCE_PATHS[manifest.repairClass]],manifest,record:priorRecord,
  externalId:reference.externalId,runId:reference.runId,workflowId:reference.workflowId,keysByRole,
  notBefore:Math.max(Date.parse(reference.createdAt),Date.parse(manifest.mandate.issuedAt)),now:Date.now()})
 require(artifact.artifactSha256===state.record.patch.artifactSha256
  &&artifact.treeSha256===state.record.patch.treeSha256,'NATIVE_VERIFIER_PATCH_MISMATCH')
 const value=await verifyQualityCandidateInIsolation({manifest,repositoryRoot:o.repositoryRoot,artifact,cicArchive:o.cicArchive,
  pack:o.pack,packAttestation:o.packAttestation,reviewerKeys:new Map(o.reviewerKeys),qualification:o.qualification,
  qualificationKeys:new Map(o.qualificationKeys),observedGateSetSha256,nonce:inputs.nonce,
  ...(o.signal===undefined?{}:{signal:o.signal})})
 const receipts=await signer.attestVerification({value,manifest,jobState,externalId})
 return Object.freeze({schemaVersion:'AQC_NATIVE_VERIFIER_OUTPUT_V1',action:'VERIFY',...receipts,rawQaPayloadIncluded:false})
}
