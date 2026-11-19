import test from 'node:test'
import assert from 'node:assert/strict'
import {generateKeyPairSync,createHash,randomUUID} from 'node:crypto'
import {readFileSync,mkdtempSync,cpSync,copyFileSync,appendFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {readQualityNativeJobTrust,readQualityNativeJobEnvironment,runQualityNativeJobQualification,runQualityNativeRoleJob} from '../src/job-runtime.mjs'
import {publicKeyId} from '../src/manifest.mjs'
import {createQualityGitHub} from '../src/github.mjs'
import {qualificationPolicyDigest} from '../src/acceptance.mjs'
const sha='a'.repeat(40),nonce=randomUUID()
const inputs=()=>({mode:'controller-job',action:'QUALIFY',nonce,control_source_sha:sha,incident_id:randomUUID(),
 manifest_sha256:'b'.repeat(64),base_sha:'c'.repeat(40),state:'{}'})
const env=()=>({GITHUB_ACTIONS:'true',RUNNER_ENVIRONMENT:'github-hosted',RUNNER_OS:'Linux',GITHUB_EVENT_NAME:'workflow_dispatch',
 GITHUB_REPOSITORY:'profitia/SG-dev',GITHUB_REF:'refs/heads/main',GITHUB_ACTOR:'profitia',GITHUB_TRIGGERING_ACTOR:'profitia',
 GITHUB_RUN_ATTEMPT:'1',GITHUB_RUN_ID:'12345',GITHUB_SHA:sha,
 GITHUB_WORKFLOW_REF:'profitia/SG-dev/.github/workflows/assistant-quality-repair.yml@refs/heads/main',
 TARGET_ENVIRONMENT:'development',AQC_PAID_REPAIRS_ENABLED:'false',AQC_PROMOTION_ENABLED:'false',
 GITHUB_TOKEN:'inert-test-reader',AQC_CONTROLLER_WORKFLOW_SHA256:'b'.repeat(64)})
function trustFixture(){
 const publicMap=()=>{const p=generateKeyPairSync('ed25519');return {[publicKeyId(p.publicKey)]:p.publicKey.export({format:'pem',type:'spki'})}}
 return {owner:publicMap(),phase:Object.fromEntries(['EXECUTOR_SUPERVISOR','INDEPENDENT_VERIFIER','INDEPENDENT_PUBLISHER'].map(r=>[r,publicMap()]))}
}
test('native runtime binds only actual fixed main workflow metadata, declared fields and disabled promotion',()=>{
 assert.equal(readQualityNativeJobEnvironment(env(),inputs()).role,'INDEPENDENT_VERIFIER')
 for(const [key,value]of Object.entries({GITHUB_REF:'refs/pull/1/merge',GITHUB_ACTOR:'other',GITHUB_TRIGGERING_ACTOR:'other',
  RUNNER_ENVIRONMENT:'self-hosted',GITHUB_RUN_ATTEMPT:'2',GITHUB_SHA:'c'.repeat(40),GITHUB_EVENT_NAME:'pull_request',
  GITHUB_WORKFLOW_REF:'other',GITHUB_REPOSITORY:'other/repo',TARGET_ENVIRONMENT:'production'}))
  assert.throws(()=>readQualityNativeJobEnvironment({...env(),[key]:value},inputs()),{code:'NATIVE_JOB_NATIVE_INVOCATION_REQUIRED'})
 for(const [key,value]of Object.entries({AQC_PROMOTION_ENABLED:'true',AQC_PAID_REPAIRS_ENABLED:'yes'}))
  assert.throws(()=>readQualityNativeJobEnvironment({...env(),[key]:value},inputs()),{code:'NATIVE_JOB_FLAGS_INVALID'})
 assert.throws(()=>readQualityNativeJobEnvironment(env(),{...inputs(),state:'',unexpected:'yes'}))
 for(const action of ['PROPOSE','CHECKS','PROMOTE','VERIFY_RUNTIME','OBSERVE','ROLLBACK'])
  assert.throws(()=>readQualityNativeJobEnvironment(env(),{...inputs(),action}),{code:'NATIVE_JOB_ACTION_NOT_WIRED'})
})
test('native runtime rejects private QA, owner, publisher credentials and accessors before reading values',()=>{
 for(const key of ['AQC_QA_STORAGE_KEY','AQC_HOLDOUT_PACK_JSON','AQC_RENDER_PUBLISHER_API_KEY',
  'AQC_OWNER_PRIVATE_KEY','AQC_INDEPENDENT_PUBLISHER_PRIVATE_KEY','DATABASE_URL','RENDER_API_KEY'])
  assert.throws(()=>readQualityNativeJobEnvironment({...env(),[key]:'INERT_PRIVATE_SENTINEL'},inputs()),{code:'NATIVE_JOB_SECRET_SCOPE_REJECTED'})
 let calls=0;const value=env();Object.defineProperty(value,'GITHUB_TOKEN',{enumerable:true,get(){calls++;throw Error('never')}})
 assert.throws(()=>readQualityNativeJobEnvironment(value,inputs()),{code:'NATIVE_JOB_ACCESSORS_FORBIDDEN'});assert.equal(calls,0)
})
test('installed native trust rejects role overlap, altered PEM, private keys and extra roles',()=>{
 const f=trustFixture(),read=()=>readQualityNativeJobTrust({ownerJson:JSON.stringify(f.owner),phaseJson:JSON.stringify(f.phase)})
 assert.equal(read().keysByRole.size,3)
 const duplicate=structuredClone(f);duplicate.phase.INDEPENDENT_PUBLISHER=duplicate.phase.INDEPENDENT_VERIFIER
 assert.throws(()=>readQualityNativeJobTrust({ownerJson:JSON.stringify(duplicate.owner),phaseJson:JSON.stringify(duplicate.phase)}),{code:'NATIVE_JOB_SEPARATE_TRUST_REQUIRED'})
 assert.throws(()=>readQualityNativeJobTrust({ownerJson:JSON.stringify(f.phase.INDEPENDENT_VERIFIER),phaseJson:JSON.stringify(f.phase)}),{code:'NATIVE_JOB_SEPARATE_TRUST_REQUIRED'})
 const bad=structuredClone(f);bad.phase.EXTRA={}
 assert.throws(()=>readQualityNativeJobTrust({ownerJson:JSON.stringify(bad.owner),phaseJson:JSON.stringify(bad.phase)}))
 const id=Object.keys(f.owner)[0];f.owner[id]=generateKeyPairSync('ed25519').privateKey.export({format:'pem',type:'pkcs8'})
 assert.throws(read)
})
test('native entrypoints refuse caller result network environment clock or key ports before I/O',async()=>{
 for(const run of [runQualityNativeJobQualification,runQualityNativeRoleJob])
  for(const option of [{},{fetch:()=>{}},{environment:env()},{now:()=>0},{privateKey:generateKeyPairSync('ed25519').privateKey},{result:'PASS'}])
   await assert.rejects(run(option),{code:'NATIVE_JOB_INPUTS_FORBIDDEN'})
})
function selectorFixture(){
 const workflow=Buffer.from('name: inert pinned workflow'),workflowHash=createHash('sha256').update(workflow).digest('hex')
 const blob=createHash('sha1').update('blob '+workflow.length+'\0').update(workflow).digest('hex')
 const run={id:91,workflow_id:123,head_sha:sha,head_branch:'main',path:'.github/workflows/assistant-quality-repair.yml',
  event:'workflow_dispatch',run_attempt:1,repository:{full_name:'profitia/SG-dev'},actor:{login:'profitia'},
  triggering_actor:{login:'profitia'},display_title:'AQC '+nonce,status:'completed',conclusion:'success'}
 const fixture={run,runs:[run],artifacts:[{id:10,name:'aqc-qualification-'+nonce,expired:false}],reads:[]}
 const fetchImpl=async url=>{
  fixture.reads.push(url);let value
  if(url.endsWith('/actions/workflows/assistant-quality-repair.yml'))value={id:123,path:'.github/workflows/assistant-quality-repair.yml',state:'active'}
  else if(url.includes('/contents/'))value={type:'file',path:'.github/workflows/assistant-quality-repair.yml',encoding:'base64',sha:blob,size:workflow.length,content:workflow.toString('base64')}
  else if(url.includes('/runs?'))value={workflow_runs:fixture.runs}
  else if(url.endsWith('/actions/runs/91/artifacts?per_page=100&page=1'))value={total_count:fixture.artifacts.length,artifacts:fixture.artifacts}
  else throw Error('Unexpected request')
  return new Response(JSON.stringify(value),{status:200})
 }
 fixture.client=createQualityGitHub({token:'inert-test-reader',fetchImpl,controllerWorkflowSha256:workflowHash})
 return fixture
}
test('latest Linux selection returns only a reference for an original successful qualification artifact',async()=>{
 const f=selectorFixture()
 assert.deepEqual(await f.client.latestLinuxQualificationReference({sourceSha:sha}),{runId:'91',sourceSha:sha,nonce})
 assert(!f.reads.some(x=>x.endsWith('/zip')),'selection is not artifact verification or signing')
 f.artifacts=[]
 await assert.rejects(f.client.latestLinuxQualificationReference({sourceSha:sha}),{code:'LINUX_NATIVE_ARTIFACT_REQUIRED'})
})
test('Linux reference selection refuses foreign actors, duplicate artifacts and expired or failed runs',async()=>{
 for(const change of [
  f=>f.run.actor.login='other',f=>f.run.triggering_actor.login='other',f=>f.run.head_branch='other',
  f=>f.run.path='other',f=>f.run.run_attempt=2,
 ]){
  const f=selectorFixture();change(f);await assert.rejects(f.client.latestLinuxQualificationReference({sourceSha:sha}),{code:'WORKFLOW_PROVENANCE_MISMATCH'})
 }
 const duplicate=selectorFixture();duplicate.artifacts.push({...duplicate.artifacts[0],id:11})
 await assert.rejects(duplicate.client.latestLinuxQualificationReference({sourceSha:sha}),{code:'LINUX_NATIVE_ARTIFACT_AMBIGUOUS'})
 for(const change of [f=>f.artifacts[0].expired=true,f=>f.run.status='in_progress',f=>f.run.conclusion='failure']){
  const f=selectorFixture();change(f);await assert.rejects(f.client.latestLinuxQualificationReference({sourceSha:sha}),{code:'LINUX_NATIVE_ARTIFACT_REQUIRED'})
 }
})
test('Linux policy digest authenticates the complete new native runtime module',()=>{
 const root=fileURLToPath(new URL('../',import.meta.url)),temporary=mkdtempSync(path.join(tmpdir(),'aqc-native-runtime-policy-'))
 try{
  cpSync(path.join(root,'src'),path.join(temporary,'src'),{recursive:true})
  for(const file of ['package.json','package-lock.json'])copyFileSync(path.join(root,file),path.join(temporary,file))
  assert.equal(qualificationPolicyDigest(temporary),qualificationPolicyDigest(root))
  const before=qualificationPolicyDigest(temporary);appendFileSync(path.join(temporary,'src/job-runtime.mjs'),'\nUNREVIEWED_NATIVE_RUNTIME_CHANGE')
  assert.notEqual(qualificationPolicyDigest(temporary),before)
 }finally{rmSync(temporary,{recursive:true,force:true})}
})
