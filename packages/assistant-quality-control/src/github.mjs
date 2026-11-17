import {createHash} from 'node:crypto'
import {assertWorkflowIdentity} from './provenance.mjs'
import {documentDigest,assertVerifiedRepairManifest,verifyDocument} from './manifest.mjs'

const repository='profitia/SG-dev'
const fail=code=>{throw Object.assign(Error('Quality GitHub operation unavailable'),{code})}
const require=(v,c='GITHUB_INPUT_INVALID')=>{if(!v)fail(c)}
const sha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v)
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v)
const number=v=>Number.isSafeInteger(v)&&v>0
const hash=v=>createHash('sha256').update(v).digest('hex')

/** Credentials stay in the trusted controller/publisher. No arbitrary URL,
 * command, repository, workflow, branch or agent-provided credential is accepted.
 * Mutations are one-shot; an uncertain delivery is reconciled by the outbox. */
export function createQualityGitHub({token,fetchImpl=fetch,publisherEnabled=false,promotionEnabled=false}){
 require(typeof token==='string'&&token.length>0&&typeof fetchImpl==='function'
  &&typeof publisherEnabled==='boolean'&&typeof promotionEnabled==='boolean','GITHUB_CONFIGURATION_REQUIRED')
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
  require(p?.number===prNumber&&p.state==='open'&&p.head?.repo?.full_name===repository&&p.base?.repo?.full_name===repository
   &&p.base.ref==='main'&&p.user?.login==='profitia'&&sha(p.head.sha)&&sha(p.base.sha),'GITHUB_PR_IDENTITY_INVALID')
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
 return Object.freeze({
  async descriptor(){
   const v=await request('/repos/'+repository);require(v.full_name===repository&&v.permissions?.pull===true,'GITHUB_REPOSITORY_UNVERIFIED')
   return {repository,headSha:await main(),publisherEnabled,promotionEnabled}
  },
  main,pull,checks,
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
   const protection=await get('/branches/main/protection')
   require(protection?.required_status_checks?.strict===true,'STRICT_BASE_PROTECTION_REQUIRED')
   const policy=protection.required_status_checks,serverNames=new Set([...(Array.isArray(policy.contexts)?policy.contexts:[]),...(Array.isArray(policy.checks)?policy.checks.map(c=>c?.context):[])])
   require(Array.isArray(requiredNames)&&requiredNames.length>0&&requiredNames.every(n=>serverNames.has(n)),'STRICT_REQUIRED_CI_PROTECTION_REQUIRED')
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
     const pr=await github.pull(input.prNumber,{headSha:input.headSha,baseSha:m.baseSha})
     require(pr.head.ref==='sg2/quality-control-'+m.incidentId,'PUBLISHER_FOREIGN_BRANCH_REJECTED')
    }})
  },
 })
}
