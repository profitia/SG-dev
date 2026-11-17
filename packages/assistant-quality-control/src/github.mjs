import {createHash} from 'node:crypto'
import {assertWorkflowIdentity} from './provenance.mjs'
import {documentDigest,assertVerifiedRepairManifest} from './manifest.mjs'

const repository='profitia/SG-dev'
const fail=code=>{throw Object.assign(Error('Quality GitHub operation unavailable'),{code})}
const require=(v,c='GITHUB_INPUT_INVALID')=>{if(!v)fail(c)}
const sha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v)
const uuid=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v)
const number=v=>Number.isSafeInteger(v)&&v>0
const hash=v=>createHash('sha256').update(v).digest('hex')

/** Credentials stay in the trusted controller/publisher. No arbitrary URL,
 * command, repository, workflow, branch or agent-provided credential is accepted.
 * Mutations are one-shot; an uncertain delivery is reconciled by the outbox. */
export function createQualityGitHub({token,fetchImpl=fetch,publisherEnabled=false,promotionEnabled=false}){
 require(typeof token==='string'&&token.length>0&&typeof fetchImpl==='function'
  &&typeof publisherEnabled==='boolean'&&typeof promotionEnabled==='boolean','GITHUB_CONFIGURATION_REQUIRED')
 async function request(path,{method='GET',body}={}){
  require(path.startsWith('/repos/'+repository+'/')&&!path.includes('..')&&!path.includes('#'))
  let response
  try{response=await fetchImpl('https://api.github.com'+path,{method,redirect:'error',signal:AbortSignal.timeout(15000),
   headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28',
    ...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})})}
  catch{fail(method==='GET'?'PROVIDER_UNAVAILABLE':'DELIVERY_UNCERTAIN')}
  if(response.status===401)fail('AUTHENTICATION_REJECTED')
  if(response.status===403)fail('PERMISSION_REJECTED')
  if(response.status===404)fail('RESOURCE_OR_ACCESS_UNVERIFIED')
  if(!response.ok)fail(method==='GET'?'PROVIDER_UNAVAILABLE':response.status>=500?'DELIVERY_UNCERTAIN':'PROVIDER_REJECTED')
  if(response.status===204)return null
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
   const v=await request('/repos/'+repository+'/');require(v.full_name===repository&&v.permissions?.pull===true,'GITHUB_REPOSITORY_UNVERIFIED')
   return {repository,headSha:await main(),publisherEnabled,promotionEnabled}
  },
  main,pull,checks,
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
   await write('/git/refs',{ref:'refs/heads/'+branch,sha:c.sha})
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
   const result=await checks(headSha,requiredNames);require(result.result==='PASS','REQUIRED_CI_INCOMPLETE')
   const merged=await write('/pulls/'+prNumber+'/merge',{sha:headSha,merge_method:'merge'},'PUT')
   require(merged?.merged===true&&sha(merged.sha),'MERGE_RESULT_UNVERIFIED')
   return {sourceSha:merged.sha}
  },
 })
}
