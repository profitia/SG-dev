import test from 'node:test'
import assert from 'node:assert/strict'
import {generateKeyPairSync,createHash,randomUUID,randomBytes} from 'node:crypto'
import {readFileSync,mkdtempSync,cpSync,copyFileSync,appendFileSync,rmSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {gzipSync} from 'node:zlib'
import {spawnSync,execFileSync} from 'node:child_process'
import {readRegression} from '../src/verify.mjs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {readQualityNativeJobTrust,readQualityNativeJobEnvironment,runQualityNativeJobQualification,runQualityNativeRoleJob,encodeQualityNativeHoldoutPack,readQualityNativeHoldoutPack} from '../src/job-runtime.mjs'
import {publicKeyId,documentDigest} from '../src/manifest.mjs'
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

test('200 strictly shaped reference records fit the same encrypted secret without altering original bytes or semantic digest',()=>{
 // Storage fixture only: labels and execution are neither reviewed nor signed.
 const pack=Array.from({length:240},(_,i)=>({id:documentDigest(i),critical:i<72,fixture:{
  schemaVersion:'AQC_REGRESSION_V1',repairClass:['C1','C2','C3'][i%3],caseFamily:'holdout_family_'+i,
  locale:i%2?'pl':'en',args:[i],expected:i*2,expectedAnswer:true,refusal:{pointer:'',values:[null]}}}))
 for(const value of pack)readRegression(value.fixture)
 const original=JSON.stringify(pack);assert(Buffer.byteLength(original)>49152)
 const encoded=encodeQualityNativeHoldoutPack(original);assert(Buffer.byteLength(encoded)<=49152)
 const restored=readQualityNativeHoldoutPack(encoded)
 assert.deepEqual(restored,pack);assert.equal(documentDigest(restored),documentDigest(pack))
 const envelope=JSON.parse(encoded)
 assert.equal(envelope.uncompressedBytes,Buffer.byteLength(original))
 assert.equal(envelope.uncompressedSha256,createHash('sha256').update(original).digest('hex'))
})
test('holdout storage rejects corruption, changed size/hash, unknown fields, plaintext and decompression beyond its bound',()=>{
 const original=Array.from({length:200},(_,i)=>({inert:i}))
 const encoded=encodeQualityNativeHoldoutPack(JSON.stringify(original))
 for(const change of [v=>v.data+=' ',v=>v.encoding='plain',v=>v.uncompressedSha256='f'.repeat(64),
  v=>v.uncompressedBytes--,v=>v.uncompressedBytes=1048577,v=>v.extra='unexpected',v=>v.data='AA==']){
  const value=JSON.parse(encoded);change(value)
  assert.throws(()=>readQualityNativeHoldoutPack(JSON.stringify(value)),{code:'NATIVE_JOB_HOLDOUT_INVALID'})
 }
 assert.throws(()=>readQualityNativeHoldoutPack(JSON.stringify(original)),{code:'NATIVE_JOB_HOLDOUT_INVALID'})
 assert.throws(()=>readQualityNativeHoldoutPack('x'.repeat(49153)),{code:'NATIVE_JOB_HOLDOUT_INVALID'})
 const bomb={schemaVersion:'AQC_HOLDOUT_STORAGE_V1',encoding:'gzip+base64',uncompressedBytes:1048576,
  uncompressedSha256:'a'.repeat(64),data:gzipSync(Buffer.alloc(1048577,65)).toString('base64')}
 assert.throws(()=>readQualityNativeHoldoutPack(JSON.stringify(bomb)),{code:'NATIVE_JOB_HOLDOUT_INVALID'})
 assert.throws(()=>encodeQualityNativeHoldoutPack(JSON.stringify(Array.from({length:200},()=>({inert:randomBytes(600).toString('hex')})))),{code:'NATIVE_JOB_HOLDOUT_SECRET_TOO_LARGE'})
})
test('trusted root verifier can read the admitted checkout and its historical base without weakening Git ownership checks',()=>{
 const workflow=readFileSync(new URL('../../../.github/workflows/assistant-quality-repair.yml',import.meta.url),'utf8')
 const verifier=workflow.slice(workflow.indexOf('  native_verifier:'),workflow.indexOf('  native_executor:'))
 assert.match(verifier,/persist-credentials: false\n          fetch-depth: 0/)
 const command='sudo chown -R root:root "$GITHUB_WORKSPACE"'
 assert(verifier.includes('run: '+command))
 assert(verifier.indexOf('run: '+command)<verifier.indexOf('Run free baseline phase'))
 assert(!verifier.includes('safe.directory'))
 if(process.platform!=='linux')return
 const root=mkdtempSync(path.join(tmpdir(),'aqc-native-root-checkout-')),uid=process.getuid(),gid=process.getgid()
 const clean={PATH:'/usr/bin:/bin',LANG:'C.UTF-8',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'}
 const git=args=>execFileSync('/usr/bin/git',['-C',root,...args],{encoding:'utf8',env:clean,stdio:['ignore','pipe','pipe']}).trim()
 const asRoot=args=>spawnSync('/usr/bin/sudo',['-n','/usr/bin/env','-i',...Object.entries(clean).map(([k,v])=>k+'='+v),
  '/usr/bin/git','-C',root,...args],{encoding:'utf8',timeout:15000})
 try{
  git(['init','--quiet']);writeFileSync(path.join(root,'source'),'base\n');git(['add','.'])
  git(['-c','user.name=AQC fixture','-c','user.email=aqc@example.invalid','commit','--quiet','-m','Owned synthetic base'])
  const base=git(['rev-parse','HEAD'])
  writeFileSync(path.join(root,'source'),'control\n');git(['add','.'])
  git(['-c','user.name=AQC fixture','-c','user.email=aqc@example.invalid','commit','--quiet','-m','Owned synthetic control'])
  if(uid===0)execFileSync('/usr/bin/chown',['-R','1001:1001',root])
  const denied=asRoot(['show',base+':source'])
  assert.notEqual(denied.status,0);assert.match(denied.stderr,/dubious ownership/)
  execFileSync('/bin/bash',['-e','-c',command],{env:{PATH:'/usr/bin:/bin',GITHUB_WORKSPACE:root},stdio:'pipe'})
  const accepted=asRoot(['show',base+':source'])
  assert.equal(accepted.status,0,accepted.stderr);assert.equal(accepted.stdout,'base\n')
 }finally{
  if(uid!==0)execFileSync('/usr/bin/sudo',['-n','/usr/bin/chown','-R',uid+':'+gid,root])
  rmSync(root,{recursive:true,force:true})
 }
})


import {runQualityNativeJobContextPreflight} from '../src/job-runtime.mjs'
test('early context entry refuses caller environment trust clock result and network ports before I/O',async()=>{
 for(const option of [{},{fetch:()=>{}},{environment:env()},{now:()=>0},
  {privateKey:generateKeyPairSync('ed25519').privateKey},{result:'NATIVE_CONTEXT_VERIFIED'}])
  await assert.rejects(runQualityNativeJobContextPreflight(option),{code:'NATIVE_JOB_INPUTS_FORBIDDEN'})
})
test('native signed-context admission precedes the unchanged private CIC fetch and retains every earlier workflow job',()=>{
 const file='.github/workflows/assistant-quality-repair.yml',root=fileURLToPath(new URL('../../../',import.meta.url))
 const previousWorkflowSha256='6621c7ea1ae47dc787b92eaa97e64d75fa525a5290525deb8c3b3ecfe67ddce8'
 const rawCurrent=readFileSync(path.join(root,file),'utf8')
 const exportStart=rawCurrent.indexOf('\n  native_context_export:\n')
 assert(exportStart>0)
 assert.equal(createHash('sha256').update(rawCurrent.slice(exportStart)).digest('hex'),'672940976972ca6bef00093fbd53bec8c1336fc6d8a0fe90128cc8cf0b361877','exact bounded additive export job')
 const current=rawCurrent.slice(0,exportStart).replace('options: [source-check, keyless-qualify, publisher-preflight, controller-job, context-export]','options: [source-check, keyless-qualify, publisher-preflight, controller-job]')
 const step='      - name: Verify signed context before private package access\n'
  +'        env:\n'
  +'          GITHUB_TOKEN: ${{ github.token }}\n'
  +'        run: node packages/assistant-quality-control/src/job-runtime.mjs validate-context\n'
 assert.equal(current.split(step).length,2,'one exact public context preflight')
 assert.equal(createHash('sha256').update(current.replace(step,'')).digest('hex'),previousWorkflowSha256,'all original jobs, private credential scopes, fetch pins and phase rechecks retained byte-for-byte')
 assert(current.indexOf(step)<current.indexOf('      - name: Fetch only the exact admitted CIC archive without lifecycle'))
 const preflight=current.slice(current.indexOf(step),current.indexOf('      - name: Verify and install the exact public CLI and isolation helper',current.indexOf(step)))
 assert(!preflight.includes('secrets.')&&!preflight.includes('NPM_TOKEN'),'preflight receives no package credential')
})
