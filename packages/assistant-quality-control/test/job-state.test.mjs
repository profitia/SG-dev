import test from 'node:test'
import assert from 'node:assert/strict'
import {generateKeyPairSync,randomUUID} from 'node:crypto'
import {documentDigest,publicKeyId,signDocument,verifyBoundManifest} from '../src/manifest.mjs'
import {ownerMandateBody} from '../src/cli.mjs'
import {repairManifestBody} from '../src/job-context.mjs'
import {encodeQualityJobState,readQualityJobState} from '../src/job-state.mjs'

const sha='a'.repeat(40),control='b'.repeat(40),digest='c'.repeat(64)
const now=Date.parse('2026-11-18T12:00:00Z'),stamp=v=>new Date(v).toISOString()
function fixture(action='QUALIFY'){
 const owner=generateKeyPairSync('ed25519'),exporter=generateKeyPairSync('ed25519')
 const mandate=signDocument('AQC_EXECUTION_MANDATE_V1',ownerMandateBody({id:randomUUID(),issuedAt:stamp(now-1000),
  expiresAt:stamp(now+3600000),targetServiceId:'srv-fixture',gateSetSha256:digest}),owner.privateKey)
 const body=repairManifestBody({mandate,incidentId:randomUUID(),correlationId:randomUUID(),baseSha:sha,
  repairClass:'C1',exportReceiptId:randomUUID(),fixtureSha256:digest})
 const fixtureExport=signDocument('AQC_SYNTHETIC_EXPORT_V1',{id:body.synthetic.exportReceiptId,fixtureId:body.synthetic.fixtureId,
  sha256:digest,scope:'CONTROLLED_ACCEPTANCE',incidentId:body.incidentId,repairClass:'C1',
  issuedAt:stamp(now-1000),expiresAt:stamp(now+3600000),rawQaPayloadIncluded:false},exporter.privateKey)
 const manifest=verifyBoundManifest(body,{mandate,fixtureExport,ownerKeys:new Map([[publicKeyId(owner.publicKey),owner.publicKey]]),
  verifierKeys:new Map([[publicKeyId(exporter.publicKey),exporter.publicKey]]),now,expectedBaseSha:sha,
  expectedServiceId:'srv-fixture',expectedGateSetSha256:digest})
 const nonce=randomUUID(),externalId='aqc-job:'+control+':'+nonce+':'+action
 const states={QUALIFY:'OBSERVED',REPRODUCE:'TRIAGED',EXECUTE:'REPRODUCED',VERIFY:'PATCH_READY',PROPOSE:'VERIFIED',
  CHECKS:'VERIFIED',PROMOTE:'VERIFIED',VERIFY_RUNTIME:'RELEASED',OBSERVE:'OBSERVING',ROLLBACK:'OBSERVING'}
 const record={id:manifest.incidentId,revision:3,status:states[action],repairClass:'C1',causeFingerprint:digest,baseSha:sha,
  attemptsUsed:action==='EXECUTE'?1:0,rollbacksUsed:action==='ROLLBACK'?1:0,pending:{action,nonce,externalId},wakeAt:now,
  reproduction:{baseSha:sha,proofSha256:digest},patch:{artifactSha256:digest,treeSha256:digest},
  verification:{artifactSha256:digest,proofSha256:digest},pr:{number:7,headSha:control},
  checks:{headSha:control,proofSha256:digest},release:{sourceSha:control,artifactSha256:digest,configurationSha256:digest,
   deployId:'dep-bbbbbbbbbbbbbbbbbbbb',lastKnownGoodSha:sha,lastKnownGoodDeployId:'dep-aaaaaaaaaaaaaaaaaaaa',releasedAt:now},
  rollbackRequired:action==='ROLLBACK'}
 return {manifest,record,externalId}
}
test('all ten finite job phases round-trip typed metadata without claiming provider identity or authority',()=>{
 for(const action of ['QUALIFY','REPRODUCE','EXECUTE','VERIFY','PROPOSE','CHECKS','PROMOTE','VERIFY_RUNTIME','OBSERVE','ROLLBACK']){
  const f=fixture(action),encoded=encodeQualityJobState(f),observed=readQualityJobState({encoded,manifest:f.manifest,externalId:f.externalId})
  assert.deepEqual(observed.record,f.record);assert.equal(observed.authorityIncluded,false);assert.equal(observed.providerIdentityVerified,false)
  assert.equal(Object.isFrozen(observed.record.release),true);assert.equal(observed.metadataSha256,documentDigest(JSON.parse(encoded)))
 }
})
test('state never accepts a lease, command, connection, QA field, fixture or callback',()=>{
 for(const [key,value]of [['leaseToken',randomUUID()],['command','execute'],['databaseUrl','postgres://synthetic.invalid'],
  ['rawQa','synthetic'],['regression',{}],['callback',()=>{}]]){
  const f=fixture();f.record[key]=value
  assert.throws(()=>encodeQualityJobState(f),{code:'JOB_STATE_METADATA_INVALID'})
 }
 for(const change of [r=>r.patch.content='synthetic',r=>r.reproduction.transcript='synthetic',
  r=>r.release.qaEvidenceId=randomUUID(),r=>r.checks.token='synthetic']){
  const f=fixture();change(f.record)
  assert.throws(()=>encodeQualityJobState(f),{code:'JOB_STATE_METADATA_INVALID'})
 }
})
test('getters in root or nested metadata are refused without running them',()=>{
 for(const nested of [false,true]){
  const f=fixture();let calls=0
  Object.defineProperty(nested?f.record.release:f.record,'secret',{enumerable:true,get(){calls++;throw Error('secret')}})
  assert.throws(()=>encodeQualityJobState(f),{code:'JOB_STATE_METADATA_INVALID'});assert.equal(calls,0)
 }
 const f=fixture();f.record.patch=Object.create({artifactSha256:digest});f.record.patch.treeSha256=digest
 assert.throws(()=>encodeQualityJobState(f),{code:'JOB_STATE_METADATA_INVALID'})
})
test('state binds the branded manifest, incident, base, class and exact committed job nonce',()=>{
 const f=fixture(),encoded=encodeQualityJobState(f)
 for(const change of [
  r=>r.id=randomUUID(),r=>r.baseSha=control,r=>r.repairClass='C2',r=>r.pending.nonce=randomUUID(),
  r=>r.pending.externalId=r.pending.externalId.replace(control,sha),r=>r.pending.action='EXECUTE',r=>r.pending=null]){
  const g=fixture();change(g.record);assert.throws(()=>encodeQualityJobState(g))
 }
 assert.throws(()=>readQualityJobState({encoded,manifest:structuredClone(f.manifest),externalId:f.externalId}))
 const other=fixture()
 assert.throws(()=>readQualityJobState({encoded,manifest:other.manifest,externalId:f.externalId}))
})
test('all current action lifecycle prerequisites are required instead of trusting a valid-looking state label',()=>{
 for(const [action,change]of [
  ['EXECUTE',r=>r.attemptsUsed=0],['EXECUTE',r=>r.reproduction=null],
  ['VERIFY',r=>r.patch=null],['PROPOSE',r=>r.verification=null],['CHECKS',r=>r.pr=null],
  ['PROMOTE',r=>r.checks=null],['PROMOTE',r=>r.checks.headSha=sha],
  ['VERIFY_RUNTIME',r=>r.release=null],['OBSERVE',r=>r.release=null],
  ['ROLLBACK',r=>r.rollbackRequired=false],['ROLLBACK',r=>r.rollbacksUsed=0]]){
  const f=fixture(action);change(f.record);assert.throws(()=>encodeQualityJobState(f))
 }
 const f=fixture();f.record.status='VERIFIED';assert.throws(()=>encodeQualityJobState(f))
})
test('two-attempt one-rollback bounds and strict typed proof fields remain unchanged',()=>{
 for(const change of [
  r=>r.attemptsUsed=3,r=>r.rollbacksUsed=2,r=>r.revision=0,r=>r.wakeAt=-1,r=>r.pr.number=0,
  r=>r.release.releasedAt='today',r=>r.checks.proofSha256='not-a-hash',r=>r.runtimeProof='not-a-hash',
  r=>r.classSuspended='true',r=>r.release.lastKnownGoodDeployId=r.release.deployId]){
  const f=fixture();change(f.record);assert.throws(()=>encodeQualityJobState(f))
 }
})
test('encoded state is bounded canonical JSON and refuses duplicate keys extra wrapper fields or changed digests',()=>{
 const f=fixture(),encoded=encodeQualityJobState(f),body=JSON.parse(encoded)
 for(const value of [' '+encoded,encoded+' ',encoded.replace('"schemaVersion":','"schemaVersion":"forged","schemaVersion":'),
  JSON.stringify({...body,secret:'synthetic'}),JSON.stringify({...body,manifestSha256:'f'.repeat(64)}),
  JSON.stringify({...body,controlSourceSha:sha}),'"'+'x'.repeat(16385)+'"','not JSON']){
  assert.throws(()=>readQualityJobState({encoded:value,manifest:f.manifest,externalId:f.externalId}),{code:'JOB_STATE_METADATA_INVALID'})
 }
})
test('null cleared metadata can be represented but never substitutes a required phase proof',()=>{
 const f=fixture();for(const key of ['checks','reproduction','patch','verification','pr'])f.record[key]=null
 const observed=readQualityJobState({encoded:encodeQualityJobState(f),manifest:f.manifest,externalId:f.externalId})
 assert.equal(observed.record.reproduction,null);assert.equal(observed.authorityIncluded,false)
})

async function nativeFixture(changes={},supplied){
 const fs=await import('node:fs'),os=await import('node:os'),path=await import('node:path'),{createHash}=await import('node:crypto')
 const {createQualityGitHub,qualityControllerJobInputs}=await import('../src/github.mjs')
 const f=supplied??fixture(),directory=fs.mkdtempSync(path.join(os.tmpdir(),'aqc-native-state-'))
 const inputs=qualityControllerJobInputs({...f}),bytes=Buffer.from('synthetic fixed workflow source\n')
 const run={id:701,workflow_id:991,head_sha:control,head_branch:'main',path:'.github/workflows/assistant-quality-repair.yml',
  event:'workflow_dispatch',run_attempt:1,repository:{full_name:'profitia/SG-dev'},actor:{login:'profitia'},triggering_actor:{login:'profitia'},
  display_title:'AQC JOB QUALIFY '+f.record.pending.nonce,status:'in_progress',conclusion:null,created_at:stamp(now-500),...changes}
 const calls=[]
 const client=createQualityGitHub({token:'synthetic-read-only',now:()=>now,
  controllerWorkflowSha256:createHash('sha256').update(bytes).digest('hex'),fetchImpl:async(url,options)=>{
   calls.push({url,method:options.method})
   if(url.endsWith('/actions/workflows/assistant-quality-repair.yml'))return Response.json({id:991,path:run.path,state:'active'})
   if(url.includes('/contents/'))return Response.json({type:'file',path:run.path,encoding:'base64',size:bytes.length,
    sha:createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),content:bytes.toString('base64')})
   if(url.endsWith('/actions/runs/701'))return Response.json(run)
   throw Error('unexpected fixture endpoint')
  }})
 const file=path.join(directory,'event.json');fs.writeFileSync(file,JSON.stringify({inputs}),{mode:0o600})
 const environment={GITHUB_REPOSITORY:'profitia/SG-dev',GITHUB_REF:'refs/heads/main',GITHUB_SHA:control,GITHUB_RUN_ID:'701',
  GITHUB_RUN_ATTEMPT:'1',GITHUB_WORKFLOW_REF:'profitia/SG-dev/.github/workflows/assistant-quality-repair.yml@refs/heads/main',
  GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_ACTOR:'profitia',GITHUB_TRIGGERING_ACTOR:'profitia',
  RUNNER_ENVIRONMENT:'github-hosted',RUNNER_OS:'Linux',GITHUB_EVENT_PATH:file}
 return {...f,inputs,run,calls,client,environment,file,fs,directory,cleanup:()=>fs.rmSync(directory,{recursive:true,force:true})}
}
test('native state requires actual current fixed provider invocation and its exact platform event input',async()=>{
 const {admitQualityNativeJobState,assertQualityNativeJobState}=await import('../src/job-state.mjs')
 const f=await nativeFixture()
 try{
  const invocation=await f.client.controllerJobInvocation({externalId:f.externalId,runId:'701'})
  const admitted=await admitQualityNativeJobState({...f,invocation,now})
  assert.equal(admitted.providerIdentityVerified,true);assert.equal(admitted.authorityIncluded,false)
  assert.equal(admitted.runId,'701');assert.equal(admitted.workflowId,'991')
  assert.equal(assertQualityNativeJobState(admitted,f),admitted)
  assert.throws(()=>assertQualityNativeJobState(structuredClone(admitted),f),{code:'JOB_STATE_NATIVE_INVOCATION_REQUIRED'})
  assert(f.calls.every(x=>x.method==='GET'))
 }finally{f.cleanup()}
})
test('unbranded and cloned provider identities cannot admit arbitrary metadata',async()=>{
 const {admitQualityNativeJobState}=await import('../src/job-state.mjs'),f=await nativeFixture()
 try{
  const invocation=await f.client.controllerJobInvocation({externalId:f.externalId,runId:'701'})
  for(const value of [{kind:'AQC_NATIVE_JOB_INVOCATION_V1'},structuredClone(invocation),null]){
   await assert.rejects(admitQualityNativeJobState({...f,invocation:value,now}),{code:'CONTROLLER_JOB_INVOCATION_REQUIRED'})
  }
 }finally{f.cleanup()}
})
test('native invocation refuses foreign actor source attempt workflow and completed or over-age runs',async()=>{
 for(const change of [{actor:{login:'foreign'}},{triggering_actor:{login:'foreign'}},{head_sha:sha},{run_attempt:2},
  {workflow_id:992},{path:'.github/workflows/other.yml'},{display_title:'AQC synthetic-keyless'},
  {status:'completed',conclusion:'success'},{created_at:stamp(now+1)},{created_at:stamp(now-1800001)}]){
  const f=await nativeFixture(change)
  try{await assert.rejects(f.client.controllerJobInvocation({externalId:f.externalId,runId:'701'}))}
  finally{f.cleanup()}
 }
})
test('native state rejects rebound environment identities and expired original mandate before event admission',async()=>{
 const {admitQualityNativeJobState}=await import('../src/job-state.mjs'),f=await nativeFixture()
 try{
  const invocation=await f.client.controllerJobInvocation({externalId:f.externalId,runId:'701'})
  for(const change of [{GITHUB_SHA:sha},{GITHUB_RUN_ID:'702'},{GITHUB_REF:'refs/pull/1/merge'},{GITHUB_ACTOR:'foreign'},
   {GITHUB_RUN_ATTEMPT:'2'},{RUNNER_ENVIRONMENT:'self-hosted'},{RUNNER_OS:'macOS'}]){
   await assert.rejects(admitQualityNativeJobState({...f,invocation,environment:{...f.environment,...change},now}))
  }
  await assert.rejects(admitQualityNativeJobState({...f,invocation,now:now+1800001}),{code:'JOB_STATE_NATIVE_INVOCATION_REQUIRED'})
  await assert.rejects(admitQualityNativeJobState({...f,invocation,now:now+3600001}),{code:'JOB_STATE_NATIVE_INVOCATION_REQUIRED'})
 }finally{f.cleanup()}
})
test('changed event input, unsafe event files and oversized event data cannot mint native state',async()=>{
 const {admitQualityNativeJobState}=await import('../src/job-state.mjs')
 for(const kind of ['changed','missing','symlink','writable','oversized','malformed']){
  const f=await nativeFixture()
  try{
   const invocation=await f.client.controllerJobInvocation({externalId:f.externalId,runId:'701'})
   if(kind==='changed')f.fs.writeFileSync(f.file,JSON.stringify({inputs:{...f.inputs,nonce:randomUUID()}}))
   if(kind==='missing')f.fs.unlinkSync(f.file)
   if(kind==='symlink'){f.fs.renameSync(f.file,f.file+'.original');f.fs.symlinkSync(f.file+'.original',f.file)}
   if(kind==='writable')f.fs.chmodSync(f.file,0o666)
   if(kind==='oversized')f.fs.writeFileSync(f.file,'x'.repeat(131073))
   if(kind==='malformed')f.fs.writeFileSync(f.file,'not JSON')
   await assert.rejects(admitQualityNativeJobState({...f,invocation,now}),{code:'JOB_STATE_NATIVE_INVOCATION_REQUIRED'})
  }finally{f.cleanup()}
 }
})
test('state consumes one extra fixed dispatch field, keeping EXECUTE within the native ten-input limit',async()=>{
 const {qualityControllerJobInputs}=await import('../src/github.mjs')
 const f=fixture('EXECUTE'),permit={incidentId:f.manifest.incidentId,attemptId:f.record.pending.nonce,
  permitId:randomUUID(),ordinal:1,expiresAt:stamp(now+60000)}
 const plain=qualityControllerJobInputs({manifest:f.manifest,externalId:f.externalId,permit})
 assert.equal(Object.keys(plain).length,9);assert.equal(Object.hasOwn(plain,'state'),false)
 const withState=qualityControllerJobInputs({...f,permit})
 assert.equal(Object.keys(withState).length,10)
 assert.deepEqual(readQualityJobState({encoded:withState.state,manifest:f.manifest,externalId:f.externalId}).record,f.record)
 assert.equal(withState.permit_id,permit.permitId)
})

test('signed three-case registry and actual native event compose through the real CLI context loader',async()=>{
 const {prepareQualityControllerJobContext}=await import('../src/job-context.mjs')
 const {readQualityControllerJobContext}=await import('../src/cli.mjs')
 const owner=generateKeyPairSync('ed25519'),exporter=generateKeyPairSync('ed25519')
 const mandate=signDocument('AQC_EXECUTION_MANDATE_V1',ownerMandateBody({id:randomUUID(),issuedAt:stamp(now-1000),
  expiresAt:stamp(now+3600000),targetServiceId:'srv-fixture',gateSetSha256:digest}),owner.privateKey)
 const fixtures=['C1','C2','C3'].map((repairClass,i)=>{
  const regression={schemaVersion:'AQC_REGRESSION_V1',repairClass,caseFamily:'native_context_unit_fixture',
   locale:i===1?'pl':'en',args:[1],expected:2,expectedAnswer:true,refusal:{pointer:'',values:[null]}}
  const fixtureSha256=documentDigest(regression),incidentId=randomUUID(),exportId=randomUUID()
  const fixtureExport=signDocument('AQC_SYNTHETIC_EXPORT_V1',{id:exportId,fixtureId:'qa_synthetic_'+fixtureSha256,sha256:fixtureSha256,
   scope:'CONTROLLED_ACCEPTANCE',incidentId,repairClass,issuedAt:stamp(now-1000),expiresAt:stamp(now+3600000),rawQaPayloadIncluded:false},exporter.privateKey)
  return {fixtureExport,regression}
 })
 const registry={schemaVersion:'AQC_CONTROLLED_JOB_CONTEXTS_V1',repository:'profitia/SG-dev',environment:'development',mandate,fixtures}
 const options={registry,ownerKeys:new Map([[publicKeyId(owner.publicKey),owner.publicKey]]),
  verifierKeys:new Map([[publicKeyId(exporter.publicKey),exporter.publicKey]]),now,expectedServiceId:'srv-fixture',expectedGateSetSha256:digest}
 const incidentId=fixtures[0].fixtureExport.body.incidentId
 const prepared=await prepareQualityControllerJobContext({...options,incidentId,baseSha:sha}),base=fixture()
 base.manifest=prepared.manifest;base.record.id=incidentId
 const f=await nativeFixture({},base)
 try{
  const invocation=await f.client.controllerJobInvocation({externalId:f.externalId,runId:'701'})
  const loaded=await readQualityControllerJobContext({inputs:f.inputs,...options,nativeInvocation:invocation,nativeEnvironment:f.environment})
  assert.equal(loaded.manifest.incidentId,incidentId);assert.equal(loaded.jobState.record.id,incidentId)
  assert.equal(loaded.jobState.providerIdentityVerified,true);assert.equal(loaded.jobState.authorityIncluded,false)
  assert.equal(loaded.regression.repairClass,'C1')
  await assert.rejects(readQualityControllerJobContext({inputs:f.inputs,...options,nativeEnvironment:f.environment}),
   {code:'CONTROLLER_JOB_INVOCATION_REQUIRED'})
 }finally{f.cleanup()}
})
test('native state dispatch is explicit and disabled by default in the trusted action composition',async()=>{
 const {createQualityControllerJobActions,qualityControllerJobInputs}=await import('../src/github.mjs')
 const f=fixture(),keys=new Map()
 for(const role of ['EXECUTOR_SUPERVISOR','INDEPENDENT_VERIFIER','INDEPENDENT_PUBLISHER']){
  const pair=generateKeyPairSync('ed25519');keys.set(role,new Map([[publicKeyId(pair.publicKey),pair.publicKey]]))
 }
 for(const enabled of [undefined,false,true]){
  const sent=[]
  const github={descriptor:async()=>({headSha:control}),controllerJobDescriptor:async()=>({sourceSha:control,dispatchEnabled:true}),
   dispatchControllerJob:async input=>{sent.push(qualityControllerJobInputs(input));return {state:'UNKNOWN',externalId:f.externalId,resultVerified:false}},
   findControllerJob:async()=>{},controllerJobResult:async()=>{},cancelControllerJob:async()=>{}}
  const actions=createQualityControllerJobActions({github,keysByRole:keys,...(enabled===undefined?{}:{jobStateEnabled:enabled}),now:()=>now})
  await actions.dispatch('QUALIFY',{record:f.record,intent:f.record.pending,authority:{manifest:f.manifest}})
  assert.equal(sent.length,1);assert.equal(Object.hasOwn(sent[0],'state'),enabled===true)
  if(enabled)assert.equal(Object.keys(sent[0]).length,8)
 }
})
