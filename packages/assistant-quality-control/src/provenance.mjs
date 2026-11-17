import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {assertVerifiedRepairManifest,SOURCE_PATHS,documentDigest} from './manifest.mjs'

const fail=code=>{throw Object.assign(Error('Quality source provenance refused'),{code})}
const require=(v,c='SOURCE_PROVENANCE_INVALID')=>{if(!v)fail(c)}
const hash=s=>createHash('sha256').update(s).digest('hex')
const sha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v)
const admittedProjections=new WeakSet()
export const PUBLIC_CONTEXT_PATHS=Object.freeze([
 'AGENTS.md','docs/agent-instructions/business-outcome-engineering-v1.1.md','docs/agent-instructions/full-autopilot-v2.md',
 'docs/agent-instructions/profitia-universal-project-execution-v1.2.md','Canon/v3.0-profitia-agent-execution-canon.md','Canon/adapters/sg2-project-adapter-v1.md',
 'packages/assistant-context-contracts/package.json','packages/assistant-context-contracts/src/index.mjs','packages/assistant-context-contracts/src/index.d.mts',
 'apps/sg-runtime/lib/assistant/calendar-period.ts','apps/sg-runtime/lib/assistant/quality-response.ts',
])
export function assertPublicProjection(p,manifest){
 require(admittedProjections.has(p)&&p.baseSha===manifest.baseSha&&p.manifestSha256===documentDigest(manifest),'VERIFIED_PUBLIC_PROJECTION_REQUIRED');return p.files
}
/** Reads only the public SG-dev commit, not a working tree, conversation,
 * installed package, .env, cache or reviewer pack. A projection cannot be
 * supplied by a workflow input or replaced with arbitrary same-named text. */
export function createPublicProjection({repositoryRoot,manifest}){
 const m=assertVerifiedRepairManifest(manifest);require(typeof repositoryRoot==='string'&&repositoryRoot.startsWith('/'))
 const git=args=>execFileSync('/usr/bin/git',['-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null','-C',repositoryRoot,...args],
  {encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:15000,maxBuffer:4194304,env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8'}})
 require(['https://github.com/profitia/SG-dev','https://github.com/profitia/SG-dev.git'].includes(git(['config','--get','remote.origin.url']).trim()),'PUBLIC_REPOSITORY_REQUIRED')
 require(git(['rev-parse',m.baseSha+'^{commit}']).trim()===m.baseSha,'SOURCE_BASE_MISSING')
 const files={};let bytes=0
 for(const p of PUBLIC_CONTEXT_PATHS){
  const entry=git(['ls-tree','-z',m.baseSha,'--',p]);if(entry==='')continue
  require(new RegExp('^100644 blob [a-f0-9]{40}\\t'+p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\x00$').test(entry),'PUBLIC_FILE_MODE_REJECTED')
  const content=git(['show',m.baseSha+':'+p]);bytes+=Buffer.byteLength(content)
  require(Buffer.byteLength(content)<=131072&&bytes<=4194304,'PUBLIC_PROJECTION_SIZE_EXCEEDED');files[p]=content
 }
 require(typeof files[SOURCE_PATHS[m.repairClass]]==='string','SOURCE_TARGET_MISSING')
 const p=Object.freeze({baseSha:m.baseSha,manifestSha256:documentDigest(m),files:Object.freeze(files),sha256:documentDigest(files)})
 admittedProjections.add(p);return p
}

/** metadata must come from the fixed authenticated GitHub transport. Exact run,
 * source, workflow, actor, attempt and nonce are all compared before an artifact
 * can be used. A similarly named file in another run is not evidence. */
export function assertWorkflowIdentity(run,{runId,sourceSha,nonce,completed=false}){
 require(sha(sourceSha)&&typeof runId==='string'&&/^[1-9][0-9]{0,19}$/.test(runId)&&/^[a-f0-9-]{36}$/.test(nonce))
 require(String(run.id)===runId&&run.head_sha===sourceSha&&run.head_branch==='main'&&run.path==='.github/workflows/assistant-quality-repair.yml'
  &&run.event==='workflow_dispatch'&&run.run_attempt===1&&run.repository?.full_name==='profitia/SG-dev'&&run.actor?.login==='profitia'
  &&run.triggering_actor?.login==='profitia'&&run.display_title==='AQC '+nonce,'WORKFLOW_PROVENANCE_MISMATCH')
 if(completed)require(run.status==='completed'&&run.conclusion==='success','WORKFLOW_NOT_SUCCESSFUL')
 return run
}
export function assertArtifactIdentity(artifact,{runId,sourceSha,name,digest}){
 require(sha(sourceSha)&&typeof name==='string'&&/^aqc-(?:patch|proof|release|qualification)-[a-f0-9-]{36}$/.test(name)
  &&typeof digest==='string'&&/^sha256:[a-f0-9]{64}$/.test(digest))
 require(artifact.name===name&&artifact.expired===false&&artifact.digest===digest&&artifact.size_in_bytes>0&&artifact.size_in_bytes<=1048576
  &&String(artifact.workflow_run?.id)===runId&&artifact.workflow_run?.head_sha===sourceSha,'ARTIFACT_PROVENANCE_MISMATCH')
 return artifact
}
export function readPatchBody(json,{manifest,beforeSource}){
 const m=assertVerifiedRepairManifest(manifest)
 require(typeof json==='string'&&Buffer.byteLength(json)<=65536)
 const b=JSON.parse(json);documentDigest(b)
 require(Object.keys(b).sort().join(',')===['schemaVersion','incidentId','baseSha','gateSetSha256','manifestSha256','files'].sort().join(',')
  &&b.schemaVersion==='AQC_PATCH_V1'&&b.incidentId===m.incidentId&&b.baseSha===m.baseSha&&b.gateSetSha256===m.gateSetSha256
  &&b.manifestSha256===documentDigest(m)&&Array.isArray(b.files)&&b.files.length===2,'PATCH_BINDING_MISMATCH')
 const paths=new Set()
 for(const f of b.files){
  require(Object.keys(f).sort().join(',')===['path','beforeSha256','afterSha256','content'].sort().join(',')&&m.allowedPaths.includes(f.path)&&!paths.has(f.path)
   &&typeof f.content==='string'&&Buffer.byteLength(f.content)<=32768&&hash(f.content)===f.afterSha256,'PATCH_FILE_MISMATCH');paths.add(f.path)
  require(f.path===SOURCE_PATHS[m.repairClass]?f.beforeSha256===hash(beforeSource):f.beforeSha256===null,'PATCH_BASE_MISMATCH')
 }
 require(Buffer.byteLength(JSON.stringify(b.files))<=32768,'PATCH_SIZE_LIMIT');return Object.freeze(b)
}
