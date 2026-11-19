import {createHash} from 'node:crypto'
import {assertWorkflowIdentity,readPatchBody} from './provenance.mjs'
import {documentDigest,assertVerifiedRepairManifest,verifyDocument,SOURCE_PATHS} from './manifest.mjs'
import {qualityRecoveryJobInputs} from './recovery.mjs'
import {encodeQualityJobState,retainQualityJobReference} from './job-state.mjs'

const repository='profitia/SG-dev'
const nativeControllerArtifacts=new WeakMap()
const nativeControllerInvocations=new WeakMap()
const controllerArtifactProfiles=Object.freeze({
 result:Object.freeze({prefix:'aqc-result-',filename:'result.json',archiveBytes:65536,contentBytes:16384}),
 patch:Object.freeze({prefix:'aqc-patch-',filename:'patch.json',archiveBytes:131072,contentBytes:65536}),
 verification:Object.freeze({prefix:'aqc-verification-',filename:'verification.json',archiveBytes:65536,contentBytes:16384}),
})
const fail=code=>{throw Object.assign(Error('Quality GitHub operation unavailable'),{code})}
const require=(v,c='GITHUB_INPUT_INVALID')=>{if(!v)fail(c)}
const sha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v)
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v)
const number=v=>Number.isSafeInteger(v)&&v>0
const hash=v=>createHash('sha256').update(v).digest('hex')

/** Credentials stay in the trusted controller/publisher. No arbitrary URL,
 * command, repository, workflow, branch or agent-provided credential is accepted.
 * Mutations are one-shot; an uncertain delivery is reconciled by the outbox. */
export function createQualityGitHub({token,fetchImpl=fetch,publisherEnabled=false,promotionEnabled=false,controllerJobsEnabled=false,recoveryJobsEnabled=false,paidRepairsEnabled=false,controllerWorkflowSha256=null,now=Date.now}){
 require(typeof token==='string'&&token.length>0&&typeof fetchImpl==='function'
  &&typeof publisherEnabled==='boolean'&&typeof promotionEnabled==='boolean'&&typeof controllerJobsEnabled==='boolean'
  &&typeof paidRepairsEnabled==='boolean'&&typeof recoveryJobsEnabled==='boolean'&&typeof now==='function'&&(controllerWorkflowSha256===null||/^[a-f0-9]{64}$/.test(controllerWorkflowSha256)),'GITHUB_CONFIGURATION_REQUIRED')
 async function request(path,{method='GET',body}={}){
  require((path==='/repos/'+repository||path.startsWith('/repos/'+repository+'/'))&&!path.includes('..')&&!path.includes('#'))
  let response
  try{response=await fetchImpl('https://api.github.com'+path,{method,redirect:'error',signal:AbortSignal.timeout(15000),
   headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28',
    ...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})})}
  catch{fail(method==='GET'?'PROVIDER_UNAVAILABLE':'DELIVERY_UNCERTAIN')}
  if(response.status===401)fail('AUTHENTICATION_REJECTED')
  if(response.status===403)fail('PERMISSION_REJECTED')
  if(response.status===404)fail('RESOURCE_OR_ACCESS_UNVERIFIED')
  if(!response.ok)fail(method==='GET'?'PROVIDER_UNAVAILABLE':response.status>=500?'DELIVERY_UNCERTAIN':'PROVIDER_REJECTED')
  if(response.status===204||response.status===202&&method==='POST'&&/^\/repos\/profitia\/SG-dev\/actions\/runs\/[1-9][0-9]{0,19}\/cancel$/.test(path))return null
  const text=await response.text();require(Buffer.byteLength(text)<=2097152,'GITHUB_RESPONSE_TOO_LARGE')
  try{return JSON.parse(text)}catch{fail('GITHUB_RESPONSE_INVALID')}
 }
 const get=path=>request('/repos/'+repository+path)
 const write=(path,body,method='POST')=>request('/repos/'+repository+path,{method,body})
 async function main(){
  const v=await get('/git/ref/heads/main');require(sha(v?.object?.sha),'GITHUB_SOURCE_INVALID');return v.object.sha
 }
 async function pull(prNumber,{headSha,baseSha}={}){
  require(number(prNumber));const p=await get('/pulls/'+prNumber)
  // The approved job-scoped GITHUB_TOKEN creates PRs as GitHub Actions,
  // never as the human owner. This permits only the real native bot and the
  // fixed incident branch; it grants no publishing or promotion capability.
  const nativePublisher=p?.user?.login==='github-actions[bot]'&&p.user.id===41898282&&p.user.type==='Bot'
   &&typeof p.head?.ref==='string'&&p.head.ref.startsWith('sg2/quality-control-')&&uuid(p.head.ref.slice('sg2/quality-control-'.length))
  require(p?.number===prNumber&&p.state==='open'&&p.head?.repo?.full_name===repository&&p.base?.repo?.full_name===repository
   &&p.base.ref==='main'&&(p.user?.login==='profitia'||nativePublisher)&&sha(p.head.sha)&&sha(p.base.sha),'GITHUB_PR_IDENTITY_INVALID')
  require(headSha===undefined||p.head.sha===headSha,'PR_HEAD_CHANGED')
  require(baseSha===undefined||p.base.sha===baseSha,'PR_BASE_CHANGED')
  return p
 }
 async function checks(headSha,requiredNames){
  require(sha(headSha)&&Array.isArray(requiredNames)&&requiredNames.length>0&&requiredNames.length<=32
   &&new Set(requiredNames).size===requiredNames.length&&requiredNames.every(n=>typeof n==='string'&&n.length>0&&n.length<=128))
  const latest=new Map()
  for(let page=1;page<=10;page++){
   const v=await get('/commits/'+headSha+'/check-runs?per_page=100&page='+page)
   require(Array.isArray(v?.check_runs)&&v.check_runs.length<=100&&Number.isSafeInteger(v.total_count),'GITHUB_CHECKS_INVALID')
   for(const c of v.check_runs){
    require(c.head_sha===headSha&&number(c.id)&&typeof c.name==='string','GITHUB_CHECKS_INVALID')
    if(c.app?.slug==='github-actions'&&(!latest.has(c.name)||latest.get(c.name).id<c.id))latest.set(c.name,c)
   }
   if(page*100>=v.total_count){
    const selected=requiredNames.map(n=>latest.get(n))
    if(selected.some(c=>!c||c.status!=='completed'))return {result:'WAIT',headSha}
    if(selected.some(c=>c.conclusion!=='success'))return {result:'FAIL',headSha}
    const receipt={headSha,checks:selected.map(c=>({id:c.id,name:c.name,conclusion:c.conclusion}))}
    return Object.freeze({result:'PASS',headSha,requiredChecksComplete:true,proofSha256:documentDigest(receipt)})
   }
  }
  fail('GITHUB_CHECKS_INCOMPLETE')
 }
 async function strictProtection(requiredNames){
  require(Array.isArray(requiredNames)&&requiredNames.length>0&&requiredNames.length<=32
   &&new Set(requiredNames).size===requiredNames.length
   &&requiredNames.every(n=>typeof n==='string'&&n.length>0&&n.length<=128),'GITHUB_REQUIRED_CHECKS_INVALID')
  const rules=[]
  for(let page=1;page<=5;page++){
   const current=await get('/rules/branches/main?per_page=100&page='+page)
   require(Array.isArray(current)&&current.length<=100&&current.every(r=>r&&typeof r==='object'&&typeof r.type==='string'),'GITHUB_RULES_INVALID')
   rules.push(...current)
   if(current.length<100)break
   require(page<5,'GITHUB_RULES_INCOMPLETE')
  }
  const modern=rules.filter(r=>r.type==='required_status_checks')
  if(modern.length){
   for(const rule of modern)require(rule.parameters&&typeof rule.parameters.strict_required_status_checks_policy==='boolean'
    &&Array.isArray(rule.parameters.required_status_checks)&&rule.parameters.required_status_checks.length<=100
    &&rule.parameters.required_status_checks.every(c=>typeof c?.context==='string'&&c.context.length>0&&c.context.length<=128
     &&(c.integration_id===null||number(c.integration_id))),'GITHUB_RULES_INVALID')
   const strict=modern.filter(r=>r.parameters.strict_required_status_checks_policy)
   require(strict.length>0,'STRICT_BASE_PROTECTION_REQUIRED')
   // Metadata-readable active rules are sufficient; the publisher does not
   // need an administration credential. Its required contexts must be bound
   // to the real GitHub Actions app, not an arbitrary status producer.
   require(requiredNames.every(name=>strict.some(r=>r.parameters.required_status_checks
    .some(c=>c.context===name&&c.integration_id===15368))),'STRICT_REQUIRED_CI_PROTECTION_REQUIRED')
   return Object.freeze({source:'ACTIVE_RULESETS',strict:true})
  }
  // Existing classic protection remains supported. An unreadable or malformed
  // active rules response never falls back to a less restrictive interpretation.
  const protection=await get('/branches/main/protection')
  require(protection?.required_status_checks?.strict===true,'STRICT_BASE_PROTECTION_REQUIRED')
  const policy=protection.required_status_checks,serverNames=new Set([...(Array.isArray(policy.contexts)?policy.contexts:[]),
   ...(Array.isArray(policy.checks)?policy.checks.map(c=>c?.context):[])])
  require(requiredNames.every(n=>serverNames.has(n)),'STRICT_REQUIRED_CI_PROTECTION_REQUIRED')
  return Object.freeze({source:'CLASSIC_PROTECTION',strict:true})
 }
 async function controllerJobDescriptor({sourceSha},recovery=false){
   require(sha(sourceSha),'CONTROLLER_JOB_BINDING_INVALID')
   require(/^[a-f0-9]{64}$/.test(controllerWorkflowSha256??''),'CONTROLLER_WORKFLOW_NOT_INSTALLED')
   const workflow=await get('/actions/workflows/assistant-quality-repair.yml')
   require(number(workflow?.id)&&workflow.path==='.github/workflows/assistant-quality-repair.yml'&&(recovery?['active','disabled_manually','disabled_inactivity'].includes(workflow.state):workflow.state==='active'),'GITHUB_WORKFLOW_BINDING_INVALID')
   const file=await get('/contents/.github/workflows/assistant-quality-repair.yml?ref='+sourceSha)
   require(file?.type==='file'&&file.path===workflow.path&&file.encoding==='base64'&&sha(file.sha)
    &&Number.isSafeInteger(file.size)&&file.size>0&&file.size<=32768
    &&typeof file.content==='string'&&file.content.length<=65536
    &&!Object.hasOwn(file,'target')&&!Object.hasOwn(file,'submodule_git_url'),'CONTROLLER_WORKFLOW_SOURCE_INVALID')
   const bytes=Buffer.from(file.content,'base64')
   require(bytes.length===file.size&&bytes.toString('base64')===file.content.replace(/\s/g,'')
    &&createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex')===file.sha
    &&hash(bytes)===controllerWorkflowSha256,'CONTROLLER_WORKFLOW_SOURCE_INVALID')
   return Object.freeze({workflowId:String(workflow.id),path:workflow.path,sourceSha,
    sourceSha256:controllerWorkflowSha256,workflowState:workflow.state,dispatchEnabled:controllerJobsEnabled&&workflow.state==='active'})
 }

 const artifactTransport=Object.freeze({})
 async function controllerJobArtifact({externalId,runId},kind){
   require(/^[1-9][0-9]{0,19}$/.test(runId),'CONTROLLER_JOB_BINDING_INVALID')
   const binding=controllerJobBinding(externalId),descriptor=await controllerJobDescriptor({sourceSha:binding.controlSourceSha},true)
   const run=assertQualityControllerJobIdentity(await get('/actions/runs/'+runId),{externalId,workflowId:descriptor.workflowId,runId})
   require(run.status==='completed'&&run.conclusion==='success','CONTROLLER_JOB_NOT_SUCCESSFUL')
   const profile=controllerArtifactProfiles[kind],matching=new Map(),name=profile.prefix+binding.nonce
   for(let page=1;page<=10;page++){
    const list=await get('/actions/runs/'+runId+'/artifacts?per_page=100&page='+page)
    require(Array.isArray(list?.artifacts)&&list.artifacts.length<=100&&Number.isSafeInteger(list.total_count)&&list.total_count>=0,'CONTROLLER_JOB_RESULT_ARTIFACT_INVALID')
    for(const artifact of list.artifacts){
     if(artifact.name!==name)continue
     require(number(artifact.id)&&artifact.expired===false&&Number.isSafeInteger(artifact.size_in_bytes)&&artifact.size_in_bytes>0&&artifact.size_in_bytes<=profile.archiveBytes
      &&String(artifact.workflow_run?.id)===runId&&artifact.workflow_run?.head_sha===binding.controlSourceSha
      &&/^sha256:[a-f0-9]{64}$/.test(artifact.digest??''),'CONTROLLER_JOB_RESULT_ARTIFACT_INVALID')
     matching.set(String(artifact.id),artifact);require(matching.size<=1,'CONTROLLER_JOB_RESULT_ARTIFACT_AMBIGUOUS')
    }
    if(page*100>=list.total_count){
     if(!matching.size)return Object.freeze({state:'UNKNOWN',externalId,runId,resultVerified:false})
     const artifact=matching.values().next().value,document=await controllerResultDownload(String(artifact.id),artifact.digest,artifact.size_in_bytes,profile)
     const observed=Object.freeze({state:'COMPLETE',externalId,runId,workflowId:descriptor.workflowId,
      createdAt:run.created_at,artifactSha256:artifact.digest.slice(7),document,resultVerified:false})
     nativeControllerArtifacts.set(observed,Object.freeze({transport:artifactTransport,kind,externalId,runId,
      workflowId:descriptor.workflowId,documentSha256:documentDigest(document)}))
     return observed
    }
   }
   fail('GITHUB_RUNS_INCOMPLETE')

 }
 async function controllerResultDownload(artifactId,expectedDigest,expectedSize,profile){
  require(/^[1-9][0-9]{0,19}$/.test(artifactId)&&/^sha256:[a-f0-9]{64}$/.test(expectedDigest),'CONTROLLER_JOB_RESULT_ARTIFACT_INVALID')
  let response
  try{
   response=await fetchImpl('https://api.github.com/repos/'+repository+'/actions/artifacts/'+artifactId+'/zip',{
    method:'GET',redirect:'manual',signal:AbortSignal.timeout(15000),
    headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28'}})
   if(response.status===401)fail('AUTHENTICATION_REJECTED')
   if(response.status===403)fail('PERMISSION_REJECTED')
   if(response.status===302){
    const location=response.headers.get('location');require(typeof location==='string'&&location.length<=8192,'CONTROLLER_JOB_RESULT_DOWNLOAD_INVALID')
    const url=new URL(location)
    require(url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&!url.hash
     &&['.blob.core.windows.net','.actions.githubusercontent.com','.githubusercontent.com'].some(s=>url.hostname.endsWith(s)),
     'CONTROLLER_JOB_RESULT_DOWNLOAD_INVALID')
    // Never forward the repository credential to the provider's signed URL.
    response=await fetchImpl(url.href,{method:'GET',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Accept:'application/zip'}})
   }
   require(response.status===200&&response.body&&typeof response.body.getReader==='function','CONTROLLER_JOB_RESULT_DOWNLOAD_INVALID')
   const declared=response.headers.get('content-length')
   require(declared===null||/^[0-9]+$/.test(declared)&&Number(declared)<=profile.archiveBytes,'CONTROLLER_JOB_RESULT_DOWNLOAD_INVALID')
   const reader=response.body.getReader(),chunks=[];let size=0
   try{
    for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength
     if(size>profile.archiveBytes){await reader.cancel();fail('CONTROLLER_JOB_RESULT_DOWNLOAD_INVALID')}
     chunks.push(Buffer.from(value))
    }
   }finally{reader.releaseLock()}
   const bytes=Buffer.concat(chunks,size)
   require(bytes.length===expectedSize&&'sha256:'+hash(bytes)===expectedDigest,'CONTROLLER_JOB_RESULT_ARTIFACT_INVALID')
   return controllerResultArchive(bytes,profile)
  }catch(error){if(error?.message==='Quality GitHub operation unavailable'&&typeof error.code==='string')throw error;fail('PROVIDER_UNAVAILABLE')}
 }
 return Object.freeze({
  /** A qualified workflow digest is installed separately; existing source and
   * keyless qualification jobs cannot silently become operational dispatch. */
  controllerJobDescriptor,
  async recoveryJobDescriptor({sourceSha}){
   const value=await controllerJobDescriptor({sourceSha},true)
   return Object.freeze({...value,dispatchEnabled:recoveryJobsEnabled&&value.workflowState==='active'})
  },
  async dispatchRecoveryJob({authority,record,action,externalId,jobStateEnabled=false}){
   if(!recoveryJobsEnabled)fail('RECOVERY_JOBS_DISABLED')
   const inputs=qualityRecoveryJobInputs({authority,record,action,externalId,jobStateEnabled,now:now()})
   const sourceSha=inputs.control_source_sha
   require(await main()===sourceSha,'BASE_CHANGED')
   const workflow=await controllerJobDescriptor({sourceSha},true)
   require(workflow.workflowState==='active','GITHUB_WORKFLOW_BINDING_INVALID')
   require(await main()===sourceSha,'BASE_CHANGED')
   qualityRecoveryJobInputs({authority,record,action,externalId,jobStateEnabled,now:now()})
   await write('/actions/workflows/assistant-quality-repair.yml/dispatches',{ref:'main',inputs})
   return Object.freeze({state:'UNKNOWN',externalId,resultVerified:false})
  },
  async dispatchControllerJob({manifest,externalId,permit,record}){
   if(!controllerJobsEnabled)fail('CONTROLLER_JOBS_DISABLED')
   const binding=controllerJobBinding(externalId)
   const m=assertVerifiedRepairManifest(manifest),at=now()
   require(Number.isFinite(at),'CONTROLLER_JOB_CLOCK_INVALID')
   if(!['ROLLBACK','VERIFY_RUNTIME','OBSERVE'].includes(binding.action))require(Date.parse(m.mandate.issuedAt)<=at&&Date.parse(m.mandate.expiresAt)>at,'CONTROLLER_JOB_AUTHORITY_EXPIRED')
   if(binding.action==='EXECUTE'&&!paidRepairsEnabled)fail('PAID_REPAIRS_DISABLED')
   if(binding.action==='PROPOSE'&&!publisherEnabled)fail('PUBLISHER_DISABLED')
   if(binding.action==='PROMOTE'&&!promotionEnabled)fail('PROMOTION_DISABLED')
   const inputs=qualityControllerJobInputs({manifest,externalId,permit,record})
   if(binding.action==='EXECUTE')require(Date.parse(permit.expiresAt)>at&&Date.parse(permit.expiresAt)<=at+1800000,'CONTROLLER_JOB_PERMIT_INVALID')
   require(await main()===binding.controlSourceSha,'BASE_CHANGED')
   await controllerJobDescriptor({sourceSha:binding.controlSourceSha})
   require(await main()===binding.controlSourceSha,'BASE_CHANGED')
   await write('/actions/workflows/assistant-quality-repair.yml/dispatches',{ref:'main',inputs})
   // Never retry this POST. Only the committed nonce/source/action identifies
   // its provider run; neither an acknowledgement nor a run is a signed result.
   return Object.freeze({state:'UNKNOWN',externalId,resultVerified:false})
  },
  async findControllerJob({externalId}){
   const binding=controllerJobBinding(externalId),descriptor=await controllerJobDescriptor({sourceSha:binding.controlSourceSha},true)
   const matching=new Map()
   for(let page=1;page<=10;page++){
    const list=await get('/actions/workflows/assistant-quality-repair.yml/runs?event=workflow_dispatch&branch=main&per_page=100&page='+page)
    require(Array.isArray(list?.workflow_runs)&&list.workflow_runs.length<=100&&Number.isSafeInteger(list.total_count)&&list.total_count>=0,'GITHUB_RUNS_INVALID')
    for(const run of list.workflow_runs){
     if(run.display_title!=='AQC JOB '+binding.action+' '+binding.nonce)continue
     assertQualityControllerJobIdentity(run,{externalId,workflowId:descriptor.workflowId,runId:String(run.id)})
     matching.set(String(run.id),run)
     require(matching.size<=1,'WORKFLOW_IDENTITY_AMBIGUOUS')
    }
    if(page*100>=list.total_count){
     if(!matching.size)return Object.freeze({state:'UNKNOWN',externalId,resultVerified:false})
     const run=matching.values().next().value
     return Object.freeze({state:run.status==='completed'?'COMPLETE':'RUNNING',externalId,runId:String(run.id),
      conclusion:run.conclusion??null,resultVerified:false})
    }
   }
   fail('GITHUB_RUNS_INCOMPLETE')
  },

  /** Native metadata is reconciled before the signed result is even decoded.
   * The returned payload is deliberately unverified until its separate role
   * signature and the complete existing state contract are checked. */
  async controllerJobInvocation({externalId,runId}){
   require(/^[1-9][0-9]{0,19}$/.test(runId),'CONTROLLER_JOB_BINDING_INVALID')
   const binding=controllerJobBinding(externalId),descriptor=await controllerJobDescriptor({sourceSha:binding.controlSourceSha},true)
   const run=assertQualityControllerJobIdentity(await get('/actions/runs/'+runId),{externalId,workflowId:descriptor.workflowId,runId})
   const at=now(),created=Date.parse(run.created_at)
   require(run.status==='in_progress'&&run.conclusion===null&&controllerStamp(run.created_at)
    &&Number.isFinite(at)&&created<=at&&at-created<=1800000,'CONTROLLER_JOB_INVOCATION_REQUIRED')
   const capability=Object.freeze({kind:'AQC_NATIVE_JOB_INVOCATION_V1'})
   nativeControllerInvocations.set(capability,Object.freeze({externalId,runId,workflowId:descriptor.workflowId,
    controlSourceSha:binding.controlSourceSha,createdAt:run.created_at}))
   return capability
  },
  controllerJobResult:input=>controllerJobArtifact(input,'result'),

  /** Prior phase indexes are only locators. Every use downloads the real
   * successful native artifact again and checks its separate role signature.
   * This reads immutable engineering facts only; publication/recovery use
   * their fresh dedicated authorities and this never grants effects. */
  async controllerJobHistory({manifest,jobState,externalId,action,keysByRole}){
   const {assertQualityNativeJobState}=await import('./job-state.mjs')
   const state=assertQualityNativeJobState(jobState,{manifest,externalId})
   const m=assertVerifiedRepairManifest(manifest),current=controllerJobBinding(externalId)
   const order=['QUALIFY','REPRODUCE','EXECUTE','VERIFY','PROPOSE','CHECKS','PROMOTE','VERIFY_RUNTIME','OBSERVE','ROLLBACK']
   const names={QUALIFY:'qualify',REPRODUCE:'reproduce',EXECUTE:'execute',VERIFY:'verify'}
   require(typeof action==='string'&&Object.hasOwn(names,action)&&order.indexOf(action)<order.indexOf(current.action),
    'CONTROLLER_HISTORY_PHASE_INVALID')
   const at=now(),started=Date.parse(state.createdAt)
   require(Number.isFinite(at)&&controllerStamp(state.createdAt)&&started<=at&&at-started<=1800000,
    'CONTROLLER_HISTORY_STALE')
   const reference=state.record.reproduction?.nativeJobs?.[names[action]]
   require(controllerPlain(reference)&&reference.externalId!==externalId&&reference.runId!==state.runId,
    'CONTROLLER_HISTORY_REFERENCE_REQUIRED')
   const binding=controllerJobBinding(reference.externalId)
   require(binding.action===action&&Date.parse(reference.createdAt)<=started,'CONTROLLER_HISTORY_REFERENCE_INVALID')
   const observed=await controllerJobArtifact({externalId:reference.externalId,runId:reference.runId},'result')
   require(observed.state==='COMPLETE'&&observed.workflowId===reference.workflowId
    &&observed.artifactSha256===reference.artifactSha256&&documentDigest(observed.document)===reference.documentSha256
    &&observed.createdAt===reference.createdAt,'CONTROLLER_HISTORY_REFERENCE_MISMATCH')
   const record={...state.record,status:{QUALIFY:'OBSERVED',REPRODUCE:'TRIAGED',EXECUTE:'REPRODUCED',VERIFY:'PATCH_READY'}[action],
    pending:{action,nonce:binding.nonce,externalId:reference.externalId}}
   const finished=now()
   require(Number.isFinite(finished)&&finished>=started&&finished-started<=1800000,'CONTROLLER_HISTORY_STALE')
   const result=readQualityControllerJobResult(observed.document,{manifest:m,record,externalId:reference.externalId,
    runId:reference.runId,workflowId:reference.workflowId,keysByRole,
    notBefore:Math.max(Date.parse(reference.createdAt),Date.parse(m.mandate.issuedAt)),now:finished})
   require(Date.parse(observed.document.body.issuedAt)<=started,'CONTROLLER_HISTORY_REFERENCE_INVALID')
   const matches=action==='QUALIFY'?result.result==='DETERMINISTIC_FAILURE':
    action==='REPRODUCE'?result.result==='RED'&&result.proofSha256===state.record.reproduction?.proofSha256:
    action==='EXECUTE'?result.result==='PATCH'&&result.patch?.artifactSha256===state.record.patch?.artifactSha256
     &&result.patch?.treeSha256===state.record.patch?.treeSha256:
    result.result==='PASS'&&result.artifactSha256===state.record.verification?.artifactSha256
     &&result.proofSha256===state.record.verification?.proofSha256
   require(matches,'CONTROLLER_HISTORY_STATE_MISMATCH')
   return Object.freeze({action,result,observation:observed,phaseReceiptVerified:true,
    independentBundleVerified:false,authorityIncluded:false})
  },
  async controllerJobVerification(input){
   require(controllerJobBinding(input?.externalId).action==='VERIFY','CONTROLLER_VERIFICATION_PHASE_REQUIRED')
   return controllerJobArtifact(input,'verification')
  },
  async controllerJobPatch(input){
   require(controllerJobBinding(input?.externalId).action==='EXECUTE','CONTROLLER_PATCH_EXECUTOR_REQUIRED')
   return controllerJobArtifact(input,'patch')
  },
  async cancelControllerJob({externalId,runId}){
   require(/^[1-9][0-9]{0,19}$/.test(runId),'CONTROLLER_JOB_BINDING_INVALID')
   const binding=controllerJobBinding(externalId),descriptor=await controllerJobDescriptor({sourceSha:binding.controlSourceSha},true)
   const run=assertQualityControllerJobIdentity(await get('/actions/runs/'+runId),{externalId,workflowId:descriptor.workflowId,runId})
   if(run.status==='completed')return Object.freeze({state:'PROVIDER_COMPLETE',externalId,runId,
    conclusion:run.conclusion,isolationTerminationVerified:false,sideEffectsVerified:false})
   await write('/actions/runs/'+runId+'/cancel',undefined)
   return Object.freeze({state:'CANCEL_REQUESTED',externalId,runId,isolationTerminationVerified:false,sideEffectsVerified:false})
  },

  async descriptor(){
   const v=await request('/repos/'+repository);require(v.full_name===repository&&v.permissions?.pull===true,'GITHUB_REPOSITORY_UNVERIFIED')
   return {repository,headSha:await main(),publisherEnabled,promotionEnabled}
  },
  main,pull,checks,protection:strictProtection,
  async qualificationDescriptor(){
   const workflow=await get('/actions/workflows/assistant-quality-repair.yml')
   require(number(workflow?.id)&&workflow.path==='.github/workflows/assistant-quality-repair.yml'
    &&workflow.state==='active','GITHUB_WORKFLOW_BINDING_INVALID')
   return Object.freeze({workflowId:String(workflow.id),path:workflow.path,state:'active'})
  },
  async dispatchQualification({sourceSha,nonce}){
   require(sha(sourceSha)&&uuid(nonce));
   require(await main()===sourceSha,'BASE_CHANGED');
   await write('/actions/workflows/assistant-quality-repair.yml/dispatches',{ref:'main',inputs:{mode:'keyless-qualify',nonce}});
   // GitHub returns no run ID for a dispatch. The durable caller must reconcile
   // this exact nonce/source; a lost response never permits a second POST.
   return {state:'UNKNOWN',sourceSha,nonce};
  },
  async cancelQualification({runId,sourceSha,nonce}){
   require(/^[1-9][0-9]{0,19}$/.test(runId)&&sha(sourceSha)&&uuid(nonce));
   const run=assertWorkflowIdentity(await get('/actions/runs/'+runId),{runId,sourceSha,nonce});
   if(run.status==='completed')return {state:'COMPLETE',runId,conclusion:run.conclusion};
   await write('/actions/runs/'+runId+'/cancel',undefined);
   // Provider cancellation is not a cgroup-empty/cleanup receipt and does not
   // close a native budget attempt or declare an executor stopped.
   return {state:'CANCEL_REQUESTED',runId};
  },

  async qualification({runId,sourceSha,nonce}){
   require(/^[1-9][0-9]{0,19}$/.test(runId))
   return assertWorkflowIdentity(await get('/actions/runs/'+runId),{runId,sourceSha,nonce,completed:true})
  },
  async findQualification({sourceSha,nonce}){
   require(sha(sourceSha)&&uuid(nonce))
   const v=await get('/actions/workflows/assistant-quality-repair.yml/runs?event=workflow_dispatch&branch=main&per_page=100')
   require(Array.isArray(v?.workflow_runs)&&v.workflow_runs.length<=100,'GITHUB_RUNS_INVALID')
   const matching=v.workflow_runs.filter(r=>r.display_title==='AQC '+nonce&&r.head_sha===sourceSha)
   require(matching.length<=1,'WORKFLOW_IDENTITY_AMBIGUOUS')
   if(!matching.length)return {state:'UNKNOWN'}
   const r=assertWorkflowIdentity(matching[0],{runId:String(matching[0].id),sourceSha,nonce})
   return {state:r.status==='completed'?'COMPLETE':'RUNNING',runId:String(r.id),conclusion:r.conclusion}
  },
  async inspectPatchBinding({manifest,patch,verification,prNumber,headSha}){
   const m=assertVerifiedRepairManifest(manifest),patchJson=JSON.stringify(patch)
   require(typeof patchJson==='string'&&Buffer.byteLength(patchJson)<=65536,'PATCH_BINDING_MISMATCH')
   const artifactSha256=documentDigest(JSON.parse(patchJson))
   require(sha(headSha)&&headSha!==m.baseSha&&verification?.result==='PASS'
    &&verification.artifactSha256===artifactSha256&&/^[a-f0-9]{64}$/.test(verification.proofSha256??''),'PATCH_BINDING_MISMATCH')
   const p=await pull(prNumber,{headSha,baseSha:m.baseSha})
   require(p.head.ref==='sg2/quality-control-'+m.incidentId,'PUBLISHER_FOREIGN_BRANCH_REJECTED')
   require(p.changed_files===2,'PUBLISHER_PATCH_FILES_INVALID')
   const files=await get('/pulls/'+prNumber+'/files?per_page=100&page=1')
   const validFiles=list=>Array.isArray(list)&&list.length===2&&new Set(list.map(f=>f?.filename)).size===2
    &&list.every(f=>m.allowedPaths.includes(f?.filename)&&sha(f.sha)&&!Object.hasOwn(f,'previous_filename')
     &&f.status===(f.filename===SOURCE_PATHS[m.repairClass]?'modified':'added'))
   require(validFiles(files),'PUBLISHER_PATCH_FILES_INVALID')
   // Unlike the mutable pull-files endpoint, this commit ID is immutable.
   // Its only parent is the admitted base and its complete diff has two files.
   const comparison=await get('/commits/'+headSha+'?per_page=100&page=1')
   require(comparison?.sha===headSha&&Array.isArray(comparison.parents)&&comparison.parents.length===1
    &&comparison.parents[0]?.sha===m.baseSha&&sha(comparison.commit?.tree?.sha)
    &&validFiles(comparison.files)&&comparison.files.every(f=>files.some(p=>p.filename===f.filename&&p.sha===f.sha&&p.status===f.status)),
    'PUBLISHER_PATCH_COMPARISON_INVALID')
   const base=await get('/git/commits/'+m.baseSha),head=await get('/git/commits/'+headSha)
   require(base?.sha===m.baseSha&&head?.sha===headSha&&sha(base.tree?.sha)&&sha(head.tree?.sha)
    &&Array.isArray(head.parents)&&head.parents.length===1&&head.parents[0]?.sha===m.baseSha
    &&comparison.commit.tree.sha===head.tree.sha,'PUBLISHER_PATCH_ANCESTRY_INVALID')
   const cache=new Map()
   async function entry(root,path){
    const parts=path.split('/');let tree=root
    for(let i=0;i<parts.length;i++){
     let value=cache.get(tree)
     if(!value){
      value=await get('/git/trees/'+tree)
      require(value?.sha===tree&&value.truncated===false&&Array.isArray(value.tree)&&value.tree.length<=10000
       &&new Set(value.tree.map(x=>x?.path)).size===value.tree.length
       &&value.tree.every(x=>typeof x?.path==='string'&&x.path.length>0&&!x.path.includes('/')
        &&x.path!=='.'&&x.path!=='..'&&sha(x.sha)),'PUBLISHER_GIT_TREE_INVALID')
      cache.set(tree,value)
     }
     const found=value.tree.find(x=>x.path===parts[i]);if(!found)return null
     if(i===parts.length-1){
      require(found.mode==='100644'&&found.type==='blob','PUBLISHER_PATCH_MODE_INVALID')
      return found
     }
     require(found.mode==='040000'&&found.type==='tree','PUBLISHER_PATCH_MODE_INVALID');tree=found.sha
    }
   }
   async function blob(id){
    const v=await get('/git/blobs/'+id)
    require(v?.sha===id&&v.encoding==='base64'&&Number.isSafeInteger(v.size)&&v.size>=0&&v.size<=32768
     &&typeof v.content==='string'&&v.content.length<=45000
     &&/^[A-Za-z0-9+/=\r\n]*$/.test(v.content),'PUBLISHER_GIT_BLOB_INVALID')
    const bytes=Buffer.from(v.content,'base64'),content=bytes.toString('utf8')
    require(bytes.length===v.size&&v.content.replace(/[\r\n]/g,'')===bytes.toString('base64')&&Buffer.from(content,'utf8').equals(bytes)
     &&createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex')===id,'PUBLISHER_GIT_BLOB_INVALID')
    return content
   }
   const source=await entry(base.tree.sha,SOURCE_PATHS[m.repairClass])
   require(source,'PATCH_BASE_MISMATCH')
   const beforeSource=await blob(source.sha),checked=readPatchBody(patchJson,{manifest:m,beforeSource})
   const observed=[]
   for(const file of checked.files){
    const previous=await entry(base.tree.sha,file.path),current=await entry(head.tree.sha,file.path)
    require(file.path===SOURCE_PATHS[m.repairClass]?previous?.sha===source.sha:previous===null,'PATCH_BASE_MISMATCH')
    require(current&&current.sha===files.find(f=>f.filename===file.path)?.sha,'PUBLISHER_PATCH_BLOB_MISMATCH')
    const content=await blob(current.sha)
    require(content===file.content&&hash(content)===file.afterSha256,'PUBLISHER_PATCH_BLOB_MISMATCH')
    observed.push({path:file.path,blobSha:current.sha,mode:current.mode,sha256:hash(content)})
   }
   // Recheck the PR after all provider reads. Its immutable head and base
   // must still name exactly the inspected objects.
   const currentPull=await pull(prNumber,{headSha,baseSha:m.baseSha})
   require(currentPull.head.ref===p.head.ref&&currentPull.changed_files===2,'PUBLISHER_PATCH_FILES_INVALID')
   const proof={repository,incidentId:m.incidentId,baseSha:m.baseSha,headSha,prNumber,artifactSha256,files:observed}
   return Object.freeze({result:'PASS',sourceBound:true,headSha,artifactSha256,
    patchBindingSha256:documentDigest(proof)})
  },
  async propose({manifest,patch,verification,verifyIndependent}){
   if(!publisherEnabled)fail('PUBLISHER_DISABLED')
   const m=assertVerifiedRepairManifest(manifest)
   require(typeof verifyIndependent==='function'&&typeof patch==='object'&&patch?.incidentId===m.incidentId
    &&patch.baseSha===m.baseSha&&patch.manifestSha256===documentDigest(m)&&patch.gateSetSha256===m.gateSetSha256
    &&Array.isArray(patch.files)&&patch.files.length===2&&Buffer.byteLength(JSON.stringify(patch.files))<=32768
    &&new Set(patch.files.map(f=>f?.path)).size===2
    &&patch.files.every(f=>m.allowedPaths.includes(f?.path)&&typeof f.content==='string'&&hash(f.content)===f.afterSha256)
    &&verification?.result==='PASS'&&verification.artifactSha256===documentDigest(patch)
    &&/^[a-f0-9]{64}$/.test(verification.proofSha256??''),'PATCH_BINDING_MISMATCH')
   const independent=await verifyIndependent({manifest:m,patch,verification})
   require(independent?.verified===true&&independent.proofSha256===verification.proofSha256
    &&independent.artifactSha256===verification.artifactSha256,'INDEPENDENT_PATCH_PROOF_REQUIRED')
   require(await main()===m.baseSha,'BASE_CHANGED')
   const branch='sg2/quality-control-'+m.incidentId
   const commit=await get('/git/commits/'+m.baseSha);require(sha(commit?.tree?.sha),'GITHUB_SOURCE_INVALID')
   const tree=[]
   for(const f of patch.files){
    require(m.allowedPaths.includes(f.path)&&typeof f.content==='string'&&hash(f.content)===f.afterSha256,'PATCH_FILE_MISMATCH')
    const blob=await write('/git/blobs',{content:f.content,encoding:'utf-8'});require(sha(blob?.sha),'GITHUB_BLOB_INVALID')
    tree.push({path:f.path,mode:'100644',type:'blob',sha:blob.sha})
   }
   require(new Set(tree.map(x=>x.path)).size===2,'PATCH_FILE_MISMATCH')
   const t=await write('/git/trees',{base_tree:commit.tree.sha,tree});require(sha(t?.sha),'GITHUB_TREE_INVALID')
   const c=await write('/git/commits',{message:'[skip render] Controlled CIC repair '+m.incidentId,tree:t.sha,parents:[m.baseSha]})
   require(sha(c?.sha)&&c.tree?.sha===t.sha,'GITHUB_COMMIT_INVALID')
   require(await main()===m.baseSha,'BASE_CHANGED')
   await verifyIndependent({manifest:m,patch,verification})
   await write('/git/refs',{ref:'refs/heads/'+branch,sha:c.sha})
   await verifyIndependent({manifest:m,patch,verification})
   const p=await write('/pulls',{title:'Controlled CIC '+m.repairClass+' repair',head:branch,base:'main',draft:false,
    body:'Synthetic controlled Stage 1 repair. Independent verification '+verification.proofSha256+'. No private QA payload is included. Required exact-source CI and release gates remain mandatory.'})
   require(number(p?.number)&&p.head?.sha===c.sha,'GITHUB_PR_IDENTITY_INVALID')
   return {result:'PR_READY',prNumber:p.number,headSha:c.sha,artifactSha256:verification.artifactSha256}
  },
  async merge({prNumber,headSha,baseSha,requiredNames,verifyIndependent}){
   if(!promotionEnabled)fail('PROMOTION_DISABLED')
   require(sha(headSha)&&sha(baseSha)&&typeof verifyIndependent==='function')
   await verifyIndependent({prNumber,headSha,baseSha})
   await pull(prNumber,{headSha,baseSha})
   require(await main()===baseSha,'BASE_CHANGED')
   // The server must enforce the base race too. A pre-merge GET alone cannot
   // prevent another owner's main update between this read and the merge.
   await strictProtection(requiredNames)
   const result=await checks(headSha,requiredNames);require(result.result==='PASS','REQUIRED_CI_INCOMPLETE')
   await verifyIndependent({prNumber,headSha,baseSha})
   const merged=await write('/pulls/'+prNumber+'/merge',{sha:headSha,merge_method:'merge'},'PUT')
   require(merged?.merged===true&&sha(merged.sha),'MERGE_RESULT_UNVERIFIED')
   return {sourceSha:merged.sha}
  },
 })
}

const publicationFields=Object.freeze(['schemaVersion','applicationId','environment','repository','action','incidentId','repairClass','baseSha',
 'manifestSha256','gateSetSha256','artifactSha256','verificationProofSha256','prNumber','headSha','requiredChecksSha256','nonce','observedAt','expiresAt','rawQaPayloadIncluded','result'])
const publicationStamp=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v
const publicationHash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
function publicationNames(names){
 require(Array.isArray(names)&&names.length>0&&names.length<=32&&new Set(names).size===names.length
  &&names.every(n=>typeof n==='string'&&n.length>0&&n.length<=128),'PUBLISHER_REQUIRED_CHECKS_INVALID')
 return Object.freeze([...names])
}

/** Only the independent verifier's installed public keys can admit a proposal
 * or merge. This carries metadata, never labels, QA input, output or a key.
 * The durable action nonce and freshness prevent reusing a proposal receipt
 * for merge, another incident, source, patch or list of required checks. */
export function createQualityPublishProofVerifier({keys,readReceipt,nonce,notBefore,now=Date.now}){
 require(keys instanceof Map&&keys.size>0&&keys.size<=4&&typeof readReceipt==='function'&&uuid(nonce)
  &&publicationStamp(notBefore)&&typeof now==='function','PUBLISHER_VERIFIER_CONFIGURATION_REQUIRED')
 const trustedKeys=new Map(keys)
 return async function verifyIndependent({action,manifest,patch,verification,requiredNames,prNumber=null,headSha=null}){
  const m=assertVerifiedRepairManifest(manifest),names=publicationNames(requiredNames);let observed=now()
  require(['PROPOSE','MERGE'].includes(action)&&Number.isFinite(observed)&&Date.parse(m.mandate.expiresAt)>observed,'PUBLISHER_AUTHORITY_EXPIRED')
  require(patch?.incidentId===m.incidentId&&patch.baseSha===m.baseSha&&patch.manifestSha256===documentDigest(m)
   &&patch.gateSetSha256===m.gateSetSha256&&Buffer.byteLength(JSON.stringify(patch))<=65536
   &&verification?.result==='PASS'&&verification.artifactSha256===documentDigest(patch)&&publicationHash(verification.proofSha256),'PUBLISHER_VERIFICATION_BINDING_INVALID')
  require(action==='PROPOSE'?prNumber===null&&headSha===null:number(prNumber)&&sha(headSha),'PUBLISHER_PR_BINDING_INVALID')
  const expected=Object.freeze({schemaVersion:'AQC_PUBLISH_PROOF_V1',applicationId:'spendguru',environment:'development',repository,action,
   incidentId:m.incidentId,repairClass:m.repairClass,baseSha:m.baseSha,manifestSha256:documentDigest(m),gateSetSha256:m.gateSetSha256,
   artifactSha256:verification.artifactSha256,verificationProofSha256:verification.proofSha256,prNumber,headSha,
   requiredChecksSha256:documentDigest(names),nonce,rawQaPayloadIncluded:false,result:'PASS'})
  const document=await readReceipt(expected)
  require(document&&Object.getPrototypeOf(document)===Object.prototype&&Buffer.byteLength(JSON.stringify(document))<=8192,'INDEPENDENT_PUBLISH_PROOF_REQUIRED')
  const body=verifyDocument(document,{kind:'AQC_PUBLISH_PROOF_V1',trustedKeys})
  observed=now();require(Number.isFinite(observed)&&Date.parse(m.mandate.expiresAt)>observed,'PUBLISHER_AUTHORITY_EXPIRED')
  require(body&&Object.getPrototypeOf(body)===Object.prototype&&Object.keys(body).sort().join(',')===[...publicationFields].sort().join(','),'PUBLISHER_PROOF_FIELDS_INVALID')
  for(const[k,v]of Object.entries(expected))require(body[k]===v,'PUBLISHER_PROOF_BINDING_INVALID')
  require(publicationStamp(body.observedAt)&&publicationStamp(body.expiresAt)&&Date.parse(body.observedAt)>=Date.parse(notBefore)
   &&Date.parse(body.observedAt)<=observed&&Date.parse(body.expiresAt)>observed&&Date.parse(body.expiresAt)<=Date.parse(body.observedAt)+30000,'PUBLISHER_PROOF_STALE')
  return Object.freeze({verified:true,proofSha256:verification.proofSha256,artifactSha256:verification.artifactSha256})
 }
}

/** Fixed independent publisher composition. Callers cannot substitute a
 * self-grade callback or shorten the installed CI list. Credentials stay
 * outside the executor; this factory creates no key, grant or activation. */
export function createQualityAttestedPublisher(options){
 require(options&&typeof options==='object'&&!Object.hasOwn(options,'verifyIndependent')
  &&!Object.hasOwn(options,'verifyProof')&&options.proofEvidence,'PUBLISHER_VERIFIER_CONFIGURATION_REQUIRED')
 const {proofEvidence,requiredNames,...transport}=options
 const names=publicationNames(requiredNames),verifyIndependent=createQualityPublishProofVerifier(proofEvidence)
 const github=createQualityGitHub(transport)
 const caller=value=>require(value&&typeof value==='object'&&!Object.hasOwn(value,'verifyIndependent')
  &&!Object.hasOwn(value,'requiredNames')&&!Object.hasOwn(value,'verifyProof'),'PUBLISHER_CALLER_OVERRIDE_REJECTED')
 return Object.freeze({
  descriptor:github.descriptor,
  checks:headSha=>github.checks(headSha,names),
  async propose(input){
   caller(input)
   return github.propose({...input,verifyIndependent:claim=>verifyIndependent({...claim,action:'PROPOSE',requiredNames:names})})
  },
  async merge(input){
   caller(input)
   if(transport.promotionEnabled!==true)fail('PROMOTION_DISABLED')
   const m=assertVerifiedRepairManifest(input.manifest)
   return github.merge({prNumber:input.prNumber,headSha:input.headSha,baseSha:m.baseSha,requiredNames:names,
    verifyIndependent:async()=>{
     await verifyIndependent({...input,action:'MERGE',requiredNames:names})
     await github.inspectPatchBinding(input)
    }})
  },
 })
}

import {readQualityJobBinding,advanceIncident} from './controller.mjs'
const controllerJobBinding=value=>{
 require(typeof value==='string'&&value.length<=160,'CONTROLLER_JOB_BINDING_INVALID')
 const parts=value.split(':')
 require(parts.length===4,'CONTROLLER_JOB_BINDING_INVALID')
 return readQualityJobBinding(value,{nonce:parts[2],action:parts[3]})
}
/** Metadata only. The signed manifest remains outside workflow input and the
 * executor must separately claim its native permit before any paid request. */
export function qualityControllerJobInputs({manifest,externalId,permit,record}){
 const m=assertVerifiedRepairManifest(manifest),binding=controllerJobBinding(externalId)
 const input={mode:'controller-job',action:binding.action,nonce:binding.nonce,
  control_source_sha:binding.controlSourceSha,incident_id:m.incidentId,
  manifest_sha256:documentDigest(m),base_sha:m.baseSha}
 if(binding.action==='EXECUTE'){
  const id=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v)
  require(controllerPlain(permit)&&Object.keys(permit).sort().join(',')===['incidentId','attemptId','permitId','ordinal','expiresAt'].sort().join(',')
   &&permit.incidentId===m.incidentId&&permit.attemptId===binding.nonce&&id(permit.permitId)&&[1,2].includes(permit.ordinal)
   &&typeof permit.expiresAt==='string'&&Number.isFinite(Date.parse(permit.expiresAt))
   &&Date.parse(permit.expiresAt)>Date.parse(m.mandate.issuedAt)&&Date.parse(permit.expiresAt)<=Date.parse(m.mandate.expiresAt),'CONTROLLER_JOB_PERMIT_INVALID')
  input.permit_id=permit.permitId;input.permit_expires_at=new Date(permit.expiresAt).toISOString()
 }else require(permit===undefined,'CONTROLLER_JOB_PERMIT_INVALID')
 if(record!==undefined)input.state=encodeQualityJobState({manifest:m,record,externalId})
 return Object.freeze(input)
}
export function assertQualityControllerJobIdentity(run,{externalId,workflowId,runId}){
 const b=controllerJobBinding(externalId)
 require(/^[1-9][0-9]{0,19}$/.test(String(workflowId))&&/^[1-9][0-9]{0,19}$/.test(runId),'CONTROLLER_JOB_BINDING_INVALID')
 require(number(run?.id)&&String(run.id)===runId&&String(run.workflow_id)===String(workflowId)
  &&run.head_sha===b.controlSourceSha&&run.head_branch==='main'
  &&run.path==='.github/workflows/assistant-quality-repair.yml'&&run.event==='workflow_dispatch'&&run.run_attempt===1
  &&run.repository?.full_name===repository&&run.actor?.login==='profitia'&&run.triggering_actor?.login==='profitia'
  &&run.display_title==='AQC JOB '+b.action+' '+b.nonce
  &&['requested','queued','pending','waiting','in_progress','completed'].includes(run.status),'CONTROLLER_JOB_PROVENANCE_MISMATCH')
 return run
}

/** An opaque read of the real, currently running fixed workflow. This alone
 * confers no paid, verification, publication or release authority. */
export function assertQualityControllerJobInvocation(value,{externalId,runId}){
 const native=nativeControllerInvocations.get(value)
 require(native&&native.externalId===externalId&&native.runId===runId,'CONTROLLER_JOB_INVOCATION_REQUIRED')
 return native
}

const controllerResultRoles=Object.freeze({
 QUALIFY:'INDEPENDENT_VERIFIER',REPRODUCE:'INDEPENDENT_VERIFIER',EXECUTE:'EXECUTOR_SUPERVISOR',
 VERIFY:'INDEPENDENT_VERIFIER',PROPOSE:'INDEPENDENT_PUBLISHER',CHECKS:'INDEPENDENT_VERIFIER',
 PROMOTE:'INDEPENDENT_PUBLISHER',VERIFY_RUNTIME:'INDEPENDENT_VERIFIER',OBSERVE:'INDEPENDENT_VERIFIER',ROLLBACK:'INDEPENDENT_PUBLISHER'
})
const controllerResultFields=Object.freeze({
 QUALIFY:['result','method','causeFingerprint','repairClass'],REPRODUCE:['result','baseSha','proofSha256'],
 EXECUTE:['result','baseSha','patch'],
 VERIFY:['result','baseSha','artifactSha256','baseTest','candidateTest','holdoutCases','criticalRegressions','accessViolations','unverifiableCases',
  'criticalCasesPass','criticalRepeats','stable','correctnessDeltaPp','unjustifiedRefusalDeltaPp','scopeBeforeDefects','scopeAfterDefects','classCounts','proofSha256'],
 PROPOSE:['result','prNumber','headSha','artifactSha256'],CHECKS:['result','headSha','requiredChecksComplete','proofSha256'],
 PROMOTE:['result','actualBaseSha','sourceSha','artifactSha256','configurationSha256','deployId','lastKnownGoodSha','lastKnownGoodDeployId','exactRuntimeVerified'],
 VERIFY_RUNTIME:['result','sourceSha','answerVerified','proofSha256'],OBSERVE:['result','sourceSha'],
 ROLLBACK:['result','sourceSha','exactRuntimeVerified','proofSha256']
})
const controllerHash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
const controllerStamp=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v
const controllerPlain=v=>v&&Object.getPrototypeOf(v)===Object.prototype
function controllerTypedResult(action,result){
 require(controllerPlain(result)&&typeof result.result==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(result.result),'CONTROLLER_JOB_RESULT_INVALID')
 const fields=controllerResultFields[action]
 require(fields&&Object.keys(result).every(k=>fields.includes(k)),'CONTROLLER_JOB_RESULT_INVALID')
 for(const [key,value]of Object.entries(result)){
  if(key==='result')continue
  if(['baseSha','headSha','sourceSha','actualBaseSha','lastKnownGoodSha'].includes(key))require(sha(value),'CONTROLLER_JOB_RESULT_INVALID')
  else if(['artifactSha256','configurationSha256','proofSha256','causeFingerprint'].includes(key))require(controllerHash(value),'CONTROLLER_JOB_RESULT_INVALID')
  else if(['criticalCasesPass','stable','requiredChecksComplete','answerVerified','exactRuntimeVerified'].includes(key))require(typeof value==='boolean','CONTROLLER_JOB_RESULT_INVALID')
  else if(['correctnessDeltaPp','unjustifiedRefusalDeltaPp'].includes(key))require(typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=100,'CONTROLLER_JOB_RESULT_INVALID')
  else if(key==='patch')require(controllerPlain(value)&&Object.keys(value).sort().join(',')==='artifactSha256,treeSha256'
   &&controllerHash(value.artifactSha256)&&controllerHash(value.treeSha256),'CONTROLLER_JOB_RESULT_INVALID')
  else if(key==='classCounts')require(controllerPlain(value)&&Object.keys(value).sort().join(',')==='C1,C2,C3'
   &&Object.values(value).every(n=>Number.isSafeInteger(n)&&n>=0&&n<=10000000),'CONTROLLER_JOB_RESULT_INVALID')
  else if(key==='repairClass')require(['C1','C2','C3'].includes(value),'CONTROLLER_JOB_RESULT_INVALID')
  else if(key==='method')require(value==='DETERMINISTIC','CONTROLLER_JOB_RESULT_INVALID')
  else if(key==='baseTest'||key==='candidateTest')require(['PASS','FAIL'].includes(value),'CONTROLLER_JOB_RESULT_INVALID')
  else if(['deployId','lastKnownGoodDeployId'].includes(key))require(typeof value==='string'&&/^dep-[a-z0-9]{10,40}$/.test(value),'CONTROLLER_JOB_RESULT_INVALID')
  else require(Number.isSafeInteger(value)&&value>=0&&value<=10000000&&(key!=='prNumber'||value>0),'CONTROLLER_JOB_RESULT_INVALID')
 }
 return result
}
/** A provider run status or an executor report cannot become a controller
 * transition. Each phase requires the separately installed supervisor/verifier/
 * publisher public key and a signed metadata-only result for its exact intent.
 * This orchestration receipt does not replace the stricter independent
 * verification, publication or runtime proof inside the trusted phase. */
export function readQualityControllerJobResult(document,{manifest,record,externalId,runId,workflowId,keysByRole,notBefore,now=Date.now()}){
 const m=assertVerifiedRepairManifest(manifest),binding=controllerJobBinding(externalId),role=controllerResultRoles[binding.action]
 require(controllerPlain(record)&&record.id===m.incidentId&&record.baseSha===m.baseSha&&record.repairClass===m.repairClass
  &&record.pending?.externalId===externalId&&record.pending.action===binding.action&&record.pending.nonce===binding.nonce
  &&/^[1-9][0-9]{0,19}$/.test(runId)&&/^[1-9][0-9]{0,19}$/.test(workflowId),'CONTROLLER_JOB_RESULT_BINDING_INVALID')
 require(keysByRole instanceof Map&&keysByRole.get(role) instanceof Map&&keysByRole.get(role).size>0&&keysByRole.get(role).size<=4,
  'CONTROLLER_JOB_RESULT_TRUST_REQUIRED')
 require(Number.isFinite(now)&&Number.isFinite(notBefore)&&notBefore<=now,'CONTROLLER_JOB_RESULT_STALE')
 let encoded;try{encoded=JSON.stringify(document)}catch{fail('CONTROLLER_JOB_RESULT_INVALID')}
 require(controllerPlain(document)&&typeof encoded==='string'&&Buffer.byteLength(encoded)<=16384,'CONTROLLER_JOB_RESULT_INVALID')
 const body=verifyDocument(document,{kind:'AQC_CONTROLLER_JOB_RESULT_V1',trustedKeys:new Map(keysByRole.get(role))})
 const expected={schemaVersion:'AQC_CONTROLLER_JOB_RESULT_V1',repository,environment:'development',role,action:binding.action,
  incidentId:m.incidentId,baseSha:m.baseSha,manifestSha256:documentDigest(m),gateSetSha256:m.gateSetSha256,
  controlSourceSha:binding.controlSourceSha,nonce:binding.nonce,runId,runAttempt:1,workflowId,rawQaPayloadIncluded:false}
 require(controllerPlain(body)&&Object.keys(body).sort().join(',')===[...Object.keys(expected),'issuedAt','expiresAt','result'].sort().join(','),
  'CONTROLLER_JOB_RESULT_BINDING_INVALID')
 for(const [key,value]of Object.entries(expected))require(body[key]===value,'CONTROLLER_JOB_RESULT_BINDING_INVALID')
 const immutableFact=['QUALIFY','REPRODUCE','EXECUTE','VERIFY'].includes(binding.action)
 require(controllerStamp(body.issuedAt)&&controllerStamp(body.expiresAt)&&Date.parse(body.issuedAt)>=notBefore
  &&Date.parse(body.issuedAt)<=now&&Date.parse(body.expiresAt)>now&&Date.parse(body.expiresAt)<=Date.parse(body.issuedAt)+(immutableFact?86400000:300000),
  'CONTROLLER_JOB_RESULT_STALE')
 if(!['ROLLBACK','VERIFY_RUNTIME','OBSERVE'].includes(binding.action))require(Date.parse(m.mandate.expiresAt)>now,'CONTROLLER_JOB_AUTHORITY_EXPIRED')
 if(immutableFact)require(Date.parse(body.expiresAt)<=Date.parse(m.mandate.expiresAt),'CONTROLLER_JOB_RESULT_STALE')
 const result=controllerTypedResult(binding.action,body.result)
 if(['VERIFY','PROPOSE','PROMOTE'].includes(binding.action)&&result.artifactSha256!==undefined)
  require(result.artifactSha256===record.patch?.artifactSha256,'CONTROLLER_JOB_RESULT_BINDING_INVALID')
 // The existing pure state machine remains the final semantic contract:
 // its 200-case holdout, thresholds, source and recovery checks are preserved.
 advanceIncident(record,binding.action,result,now)
 const verified=structuredClone(result)
 for(const value of Object.values(verified))if(value&&typeof value==='object')Object.freeze(value)
 return Object.freeze(verified)
}


/** Native patch transport and a supervisor signature establish provenance only.
 * The caller supplies source bytes from its trusted public base projection.
 * Independent execution, holdout, source policy and publication remain required.
 * Unbranded/cloned observations, another client/run and modified documents fail. */
export function readQualityControllerPatch({resultObservation,patchObservation,beforeSource,...context}){
 const resultNative=nativeControllerArtifacts.get(resultObservation),patchNative=nativeControllerArtifacts.get(patchObservation)
 require(resultNative?.kind==='result'&&patchNative?.kind==='patch'&&resultNative.transport===patchNative.transport,
  'CONTROLLER_PATCH_NATIVE_ARTIFACT_REQUIRED')
 const binding=controllerJobBinding(context.externalId)
 require(binding.action==='EXECUTE','CONTROLLER_PATCH_EXECUTOR_REQUIRED')
 for(const [observed,native]of [[resultObservation,resultNative],[patchObservation,patchNative]]){
  require(observed.state==='COMPLETE'&&native.externalId===context.externalId&&native.runId===context.runId
   &&native.workflowId===context.workflowId&&native.documentSha256===documentDigest(observed.document),
   'CONTROLLER_PATCH_NATIVE_BINDING_INVALID')
 }
 const result=readQualityControllerJobResult(resultObservation.document,context)
 require(result.result==='PATCH'&&typeof beforeSource==='string'&&Buffer.byteLength(beforeSource)<=131072,
  'CONTROLLER_PATCH_EXECUTOR_REQUIRED')
 const patch=readPatchBody(JSON.stringify(patchObservation.document),{manifest:context.manifest,beforeSource})
 const treeSha256=documentDigest(patch.files.map(({path,beforeSha256,afterSha256})=>({path,beforeSha256,afterSha256})))
 require(documentDigest(patch)===result.patch.artifactSha256&&treeSha256===result.patch.treeSha256,
  'CONTROLLER_PATCH_DIGEST_MISMATCH')
 for(const file of patch.files)Object.freeze(file)
 Object.freeze(patch.files)
 return Object.freeze({body:patch,artifactSha256:result.patch.artifactSha256,treeSha256,
  independentVerified:false})
}

import {readQualityVerificationResult} from './verify.mjs'
import {inflateRawSync} from 'node:zlib'
const controllerCrcTable=Uint32Array.from({length:256},(_,n)=>{
 let v=n;for(let i=0;i<8;i++)v=v&1?0xedb88320^(v>>>1):v>>>1;return v>>>0
})
const controllerCrc32=bytes=>{let crc=0xffffffff;for(const b of bytes)crc=controllerCrcTable[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0}
/** Bounded in-memory single-file ZIP; no archive path is ever written or
 * executed. ZIP64, encryption, directories, extra entries and output bombs
 * cannot become a controller result. Native artifact digest is checked first. */
function controllerResultArchive(bytes,profile){
 const invalid=()=>fail('CONTROLLER_JOB_RESULT_ARCHIVE_INVALID')
 if(!Buffer.isBuffer(bytes)||bytes.length<22||bytes.length>profile.archiveBytes)invalid()
 const end=bytes.length-22
 if(bytes.readUInt32LE(end)!==0x06054b50||bytes.readUInt16LE(end+4)!==0||bytes.readUInt16LE(end+6)!==0
  ||bytes.readUInt16LE(end+8)!==1||bytes.readUInt16LE(end+10)!==1||bytes.readUInt16LE(end+20)!==0)invalid()
 const centralSize=bytes.readUInt32LE(end+12),central=bytes.readUInt32LE(end+16)
 if(centralSize<46||central+centralSize!==end||central<30||bytes.readUInt32LE(central)!==0x02014b50)invalid()
 const version=bytes.readUInt16LE(central+6),flags=bytes.readUInt16LE(central+8),method=bytes.readUInt16LE(central+10)
 const crc=bytes.readUInt32LE(central+16),compressed=bytes.readUInt32LE(central+20),size=bytes.readUInt32LE(central+24)
 const nameLength=bytes.readUInt16LE(central+28),extraLength=bytes.readUInt16LE(central+30),commentLength=bytes.readUInt16LE(central+32)
 const mode=bytes.readUInt32LE(central+38)>>>16
 if(version>20||flags&~0x0808||![0,8].includes(method)||!size||size>profile.contentBytes||!compressed||compressed>profile.archiveBytes
  ||46+nameLength+extraLength+commentLength!==centralSize||commentLength||bytes.readUInt16LE(central+34)!==0
  ||bytes.readUInt32LE(central+42)!==0||mode&0o111||!([0,0o100000].includes(mode&0o170000)))invalid()
 if(bytes.subarray(central+46,central+46+nameLength).toString('utf8')!==profile.filename)invalid()
 if(bytes.readUInt32LE(0)!==0x04034b50||bytes.readUInt16LE(4)!==version||bytes.readUInt16LE(6)!==flags||bytes.readUInt16LE(8)!==method)invalid()
 const localNameLength=bytes.readUInt16LE(26),localExtraLength=bytes.readUInt16LE(28),offset=30+localNameLength+localExtraLength
 if(offset>central||offset+compressed>central||localNameLength!==nameLength
  ||!bytes.subarray(30,30+localNameLength).equals(bytes.subarray(central+46,central+46+nameLength)))invalid()
 const extra=(start,length)=>{
  const limit=start+length;if(limit>central&&start<central||limit>bytes.length||length>4096)invalid()
  while(start<limit){if(start+4>limit)invalid();const tag=bytes.readUInt16LE(start),n=bytes.readUInt16LE(start+2);if(tag===1||start+4+n>limit)invalid();start+=4+n}
 }
 extra(30+localNameLength,localExtraLength);extra(central+46+nameLength,extraLength)
 const after=offset+compressed
 if(flags&8){
  if(![0,crc].includes(bytes.readUInt32LE(14))||![0,compressed].includes(bytes.readUInt32LE(18))||![0,size].includes(bytes.readUInt32LE(22)))invalid()
  const remaining=central-after;if(remaining!==12&&remaining!==16)invalid()
  let descriptor=after
  if(remaining===16){if(bytes.readUInt32LE(descriptor)!==0x08074b50)invalid();descriptor+=4}
  if(bytes.readUInt32LE(descriptor)!==crc||bytes.readUInt32LE(descriptor+4)!==compressed||bytes.readUInt32LE(descriptor+8)!==size)invalid()
 }else if(after!==central||bytes.readUInt32LE(14)!==crc||bytes.readUInt32LE(18)!==compressed||bytes.readUInt32LE(22)!==size)invalid()
 let content
 try{content=method===0?bytes.subarray(offset,after):inflateRawSync(bytes.subarray(offset,after),{maxOutputLength:profile.contentBytes})}catch{invalid()}
 if(content.length!==size||controllerCrc32(content)!==crc)invalid()
 const text=content.toString('utf8');if(!Buffer.from(text).equals(content))invalid()
 try{return JSON.parse(text)}catch{fail('CONTROLLER_JOB_RESULT_METADATA_INVALID')}
}

/** Trusted controller composition. Native provider metadata is never treated as
 * a verified phase result; the opaque envelope can only originate from this
 * adapter's artifact read and is revalidated against the current authority.
 * Cancellation deliberately retains the durable intent until independent
 * isolation/effect receipts are installed; an HTTP acknowledgement is no proof. */
export function createQualityControllerJobActions({github,keysByRole,budget=null,paidRepairsEnabled=false,jobStateEnabled=false,now=Date.now}){
 const methods=['descriptor','controllerJobDescriptor','dispatchControllerJob','findControllerJob','controllerJobResult','cancelControllerJob']
 require(methods.every(k=>typeof github?.[k]==='function')&&typeof now==='function'&&typeof paidRepairsEnabled==='boolean'&&typeof jobStateEnabled==='boolean'
  &&(!paidRepairsEnabled||typeof budget?.openAttempt==='function'),'CONTROLLER_ACTIONS_CONFIGURATION_REQUIRED')
 require(keysByRole instanceof Map&&keysByRole.size===3,'CONTROLLER_JOB_RESULT_TRUST_REQUIRED')
 const trusted=new Map(),keyIds=new Set()
 for(const role of ['EXECUTOR_SUPERVISOR','INDEPENDENT_VERIFIER','INDEPENDENT_PUBLISHER']){
  const keys=keysByRole.get(role)
  require(keys instanceof Map&&keys.size>0&&keys.size<=4,'CONTROLLER_JOB_RESULT_TRUST_REQUIRED')
  for(const id of keys.keys()){
   require(controllerHash(id)&&!keyIds.has(id),'CONTROLLER_JOB_RESULT_TRUST_REQUIRED');keyIds.add(id)
  }
  trusted.set(role,new Map(keys))
 }
 const envelopes=new WeakMap(),verifiedReceipts=new WeakMap()
 const authorityFor=(record,authority,action,externalId)=>{
  const manifest=assertVerifiedRepairManifest(authority?.manifest)
  require(controllerPlain(record)&&record.id===manifest.incidentId&&record.baseSha===manifest.baseSha
   &&record.repairClass===manifest.repairClass,'CONTROLLER_JOB_RESULT_BINDING_INVALID')
  if(externalId!==undefined){
   const binding=controllerJobBinding(externalId)
   require(binding.action===action&&record.pending?.externalId===externalId&&record.pending.action===action
    &&record.pending.nonce===binding.nonce,'CONTROLLER_JOB_RESULT_BINDING_INVALID')
  }
  return manifest
 }
 return Object.freeze({
  async bind(action,{record,nonce,authority}){
   authorityFor(record,authority,action)
   if(action==='EXECUTE'&&!paidRepairsEnabled)fail('PAID_REPAIRS_DISABLED')
   const source=await github.descriptor()
   require(sha(source?.headSha),'GITHUB_SOURCE_INVALID')
   const externalId='aqc-job:'+source.headSha+':'+nonce+':'+action
   controllerJobBinding(externalId)
   const workflow=await github.controllerJobDescriptor({sourceSha:source.headSha})
   require(workflow?.dispatchEnabled===true&&workflow.sourceSha===source.headSha,'CONTROLLER_JOBS_DISABLED')
   return externalId
  },
  async dispatch(action,{record,intent,authority}){
   require(intent===record.pending,'CONTROLLER_JOB_RESULT_BINDING_INVALID')
   const manifest=authorityFor(record,authority,action,intent?.externalId)
   let permit
   if(action==='EXECUTE'){
    if(!paidRepairsEnabled)fail('PAID_REPAIRS_DISABLED')
    const at=now(),start=record.wakeAt,expiresAt=Math.min(start+1800000,Date.parse(manifest.mandate.expiresAt))
    require(Number.isFinite(at)&&Number.isSafeInteger(start)&&start>0&&start<=at&&expiresAt>at
     &&Date.parse(manifest.mandate.issuedAt)<=at&&[1,2].includes(record.attemptsUsed),'CONTROLLER_JOB_PERMIT_INVALID')
    // REPRODUCE committed wakeAt before this PREPARE. Reconciliation/restart
    // never extends it or creates a second attempt; only first model dispatch
    // can start the native paid pilot clock.
    permit=await budget.openAttempt(manifest.incidentId,{attemptId:intent.nonce,ordinal:record.attemptsUsed,expiresAt:new Date(expiresAt).toISOString()})
    require(permit?.incidentId===manifest.incidentId&&permit.attemptId===intent.nonce
     &&permit.ordinal===record.attemptsUsed&&Date.parse(permit.expiresAt)===expiresAt,'CONTROLLER_JOB_PERMIT_INVALID')
   }
   const sent=await github.dispatchControllerJob({manifest,externalId:intent.externalId,...(permit===undefined?{}:{permit}),...(jobStateEnabled?{record}:{})})
   require(sent?.externalId===intent.externalId&&sent.state==='UNKNOWN'&&sent.resultVerified===false,'CONTROLLER_JOB_DISPATCH_INVALID')
   return Object.freeze({externalId:intent.externalId})
  },
  async reconcile(intent,{record,authority}){
   require(intent===record.pending,'CONTROLLER_JOB_RESULT_BINDING_INVALID')
   const manifest=authorityFor(record,authority,intent?.action,intent?.externalId)
   const found=await github.findControllerJob({externalId:intent.externalId})
   require(found?.externalId===intent.externalId&&found.resultVerified===false,'CONTROLLER_JOB_PROVENANCE_MISMATCH')
   if(found.state==='UNKNOWN'||found.state==='RUNNING')return Object.freeze({state:found.state})
   require(found.state==='COMPLETE','CONTROLLER_JOB_PROVENANCE_MISMATCH')
   // Failed/cancelled native runs need separately authenticated cleanup, never
   // a fabricated FAILED result that could consume a second paid attempt.
   if(found.conclusion!=='success')return Object.freeze({state:'UNKNOWN'})
   const received=await github.controllerJobResult({externalId:intent.externalId,runId:found.runId})
   require(received?.externalId===intent.externalId&&received.runId===found.runId
    &&received.resultVerified===false,'CONTROLLER_JOB_PROVENANCE_MISMATCH')
   if(received.state==='UNKNOWN')return Object.freeze({state:'UNKNOWN'})
   require(received.state==='COMPLETE'&&typeof received.createdAt==='string'
    &&Number.isFinite(Date.parse(received.createdAt)),'CONTROLLER_JOB_PROVENANCE_MISMATCH')
   const envelope=Object.freeze({kind:'AQC_UNVERIFIED_NATIVE_RESULT_V1'})
   envelopes.set(envelope,{...received,document:structuredClone(received.document),manifestSha256:documentDigest(manifest)})
   return Object.freeze({state:'COMPLETE',result:envelope})
  },
  async verify(action,envelope,{record,authority}){
   const manifest=authorityFor(record,authority,action,record.pending?.externalId),native=envelopes.get(envelope)
   require(native&&native.externalId===record.pending.externalId&&native.manifestSha256===documentDigest(manifest),
    'CONTROLLER_JOB_NATIVE_RESULT_REQUIRED')
   const verified=readQualityControllerJobResult(native.document,{manifest,record,externalId:native.externalId,runId:native.runId,
    workflowId:native.workflowId,keysByRole:trusted,notBefore:Math.max(Date.parse(native.createdAt),Date.parse(manifest.mandate.issuedAt)),now:now()})
   if(jobStateEnabled)verifiedReceipts.set(verified,{native,manifestSha256:documentDigest(manifest)})
   return verified
  },
  ...(jobStateEnabled?{retain(verified,{record,changed,authority,completedAt}){
   const manifest=authorityFor(record,authority,record.pending?.action,record.pending?.externalId),receipt=verifiedReceipts.get(verified)
   require(receipt&&receipt.native.externalId===record.pending.externalId&&receipt.manifestSha256===documentDigest(manifest),
    'CONTROLLER_JOB_NATIVE_RESULT_REQUIRED')
   const native=receipt.native,at=now()
   require(Number.isFinite(completedAt)&&completedAt<=at&&at-completedAt<=10000
    &&documentDigest(advanceIncident(record,record.pending.action,verified,completedAt))===documentDigest(changed),
    'CONTROLLER_JOB_RESULT_BINDING_INVALID')
   const current=readQualityControllerJobResult(native.document,{manifest,record,externalId:native.externalId,runId:native.runId,
    workflowId:native.workflowId,keysByRole:trusted,notBefore:Math.max(Date.parse(native.createdAt),Date.parse(manifest.mandate.issuedAt)),now:at})
   require(documentDigest(current)===documentDigest(verified)&&controllerHash(native.artifactSha256),'CONTROLLER_JOB_RESULT_BINDING_INVALID')
   const reference={externalId:native.externalId,runId:native.runId,workflowId:native.workflowId,
    artifactSha256:native.artifactSha256,documentSha256:documentDigest(native.document),createdAt:native.createdAt}
   return retainQualityJobReference({before:record,after:changed,action:record.pending.action,reference})
  }}:{}),
  async cancel(intent,{record}){
   require(intent===record.pending,'CONTROLLER_JOB_RESULT_BINDING_INVALID')
   const binding=controllerJobBinding(intent?.externalId)
   require(binding.action===intent.action&&binding.nonce===intent.nonce,'CONTROLLER_JOB_RESULT_BINDING_INVALID')
   const found=await github.findControllerJob({externalId:intent.externalId})
   require(found?.externalId===intent.externalId&&found.resultVerified===false,'CONTROLLER_JOB_PROVENANCE_MISMATCH')
   if(found.state==='RUNNING')await github.cancelControllerJob({externalId:intent.externalId,runId:found.runId})
   else require(['UNKNOWN','COMPLETE'].includes(found.state),'CONTROLLER_JOB_PROVENANCE_MISMATCH')
   return Object.freeze({state:'UNKNOWN',effects:'UNKNOWN'})
  }
 })
}

const nativeIndependentVerifications=new WeakMap()
/** Both documents are downloaded from the same successful native VERIFY run.
 * A signed orchestration PASS is never substituted for the separately signed
 * complete verification receipt, its frozen holdout proof and original expiry.
 * This is provenance and test evidence only, with no publishing authority. */
export function readQualityControllerVerification({resultObservation,verificationObservation,...context}){
 const resultNative=nativeControllerArtifacts.get(resultObservation),proofNative=nativeControllerArtifacts.get(verificationObservation)
 require(resultNative?.kind==='result'&&proofNative?.kind==='verification'&&resultNative.transport===proofNative.transport,
  'CONTROLLER_VERIFICATION_NATIVE_ARTIFACT_REQUIRED')
 const binding=controllerJobBinding(context.externalId)
 require(binding.action==='VERIFY','CONTROLLER_VERIFICATION_PHASE_REQUIRED')
 for(const [observed,native]of [[resultObservation,resultNative],[verificationObservation,proofNative]]){
  require(observed.state==='COMPLETE'&&native.externalId===context.externalId&&native.runId===context.runId
   &&native.workflowId===context.workflowId&&native.documentSha256===documentDigest(observed.document),
   'CONTROLLER_VERIFICATION_NATIVE_BINDING_INVALID')
 }
 require(resultObservation.createdAt===verificationObservation.createdAt&&controllerStamp(resultObservation.createdAt)
  &&Number.isFinite(context.notBefore)&&context.notBefore>=Date.parse(resultObservation.createdAt),
  'CONTROLLER_VERIFICATION_NATIVE_BINDING_INVALID')
 const phase=readQualityControllerJobResult(resultObservation.document,context)
 const keys=context.keysByRole?.get('INDEPENDENT_VERIFIER')
 require(keys instanceof Map&&keys.size>0,'CONTROLLER_JOB_RESULT_TRUST_REQUIRED')
 const verification=readQualityVerificationResult(verificationObservation.document,{keys:new Map(keys),manifest:context.manifest,
  nonce:binding.nonce,controlSourceSha:binding.controlSourceSha,runId:context.runId,
  notBefore:new Date(context.notBefore).toISOString(),now:context.now??Date.now()})
 for(const [key,value]of Object.entries(phase)){
  require(Object.hasOwn(verification,key)&&documentDigest(verification[key])===documentDigest(value),
   'CONTROLLER_VERIFICATION_PHASE_MISMATCH')
 }
 const m=assertVerifiedRepairManifest(context.manifest)
 const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v}
 const value=Object.freeze({verification:freeze(structuredClone(verification)),
  verificationReceipt:freeze(structuredClone(verificationObservation.document)),
  artifactSha256:verification.artifactSha256,proofSha256:verification.proofSha256,
  independentBundleVerified:true,authorityIncluded:false,rawQaPayloadIncluded:false})
 nativeIndependentVerifications.set(value,Object.freeze({manifest:m,externalId:context.externalId,runId:context.runId,
  documentSha256:documentDigest(verificationObservation.document),observedAt:Date.parse(verificationObservation.document.body.observedAt),expiresAt:Date.parse(verificationObservation.document.body.expiresAt)}))
 return value
}
export function assertQualityNativeVerification(value,{manifest,externalId,runId,now=Date.now()}){
 const cap=nativeIndependentVerifications.get(value),m=assertVerifiedRepairManifest(manifest)
 require(cap&&cap.manifest===m&&cap.externalId===externalId&&cap.runId===runId
  &&cap.documentSha256===documentDigest(value.verificationReceipt),'CONTROLLER_VERIFICATION_NATIVE_ARTIFACT_REQUIRED')
 require(Number.isFinite(now)&&now>=cap.observedAt&&now<cap.expiresAt&&now<Date.parse(m.mandate.expiresAt),'CONTROLLER_VERIFICATION_STALE')
 return value
}
