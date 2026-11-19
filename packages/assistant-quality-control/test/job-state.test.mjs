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

function reference(action,nonce=randomUUID()){
 const externalId='aqc-job:'+control+':'+nonce+':'+action
 return {externalId,runId:'701',workflowId:'991',artifactSha256:digest,documentSha256:digest,createdAt:stamp(now-500)}
}
test('native reference indexes preserve verified ancestors and discard stale downstream phase indexes',async()=>{
 const {retainQualityJobReference}=await import('../src/job-state.mjs'),{advanceIncident}=await import('../src/controller.mjs')
 const f=fixture('EXECUTE')
 f.record.reproduction.nativeJobs={qualify:reference('QUALIFY'),reproduce:reference('REPRODUCE'),execute:reference('EXECUTE'),
  verify:reference('VERIFY'),propose:reference('PROPOSE'),checks:reference('CHECKS'),promote:reference('PROMOTE')}
 const verified={result:'PATCH',baseSha:sha,patch:{artifactSha256:digest,treeSha256:digest}},after=advanceIncident(f.record,'EXECUTE',verified,now)
 const current=reference('EXECUTE',f.record.pending.nonce)
 const retained=retainQualityJobReference({before:f.record,after,action:'EXECUTE',reference:current})
 assert.deepEqual(Object.keys(retained.reproduction.nativeJobs).sort(),['execute','qualify','reproduce'])
 assert.deepEqual(retained.reproduction.nativeJobs.execute,current)
 const nonce=randomUUID(),next={...retained,revision:retained.revision+1,pending:{action:'VERIFY',nonce,externalId:'aqc-job:'+control+':'+nonce+':VERIFY'}}
 const encoded=encodeQualityJobState({manifest:f.manifest,record:next,externalId:next.pending.externalId})
 assert.deepEqual(readQualityJobState({encoded,manifest:f.manifest,externalId:next.pending.externalId}).record.reproduction.nativeJobs,
  retained.reproduction.nativeJobs)
 const {assertControlRecord}=await import('../src/store.mjs')
 assert.deepEqual(assertControlRecord(retained),retained)
})
test('BASE_CHANGED discards all old reference indexes until the fresh base is admitted',async()=>{
 const {retainQualityJobReference}=await import('../src/job-state.mjs'),{advanceIncident}=await import('../src/controller.mjs')
 const f=fixture('PROMOTE');f.record.reproduction.nativeJobs={verify:reference('VERIFY')}
 const after=advanceIncident(f.record,'PROMOTE',{result:'BASE_CHANGED',actualBaseSha:control},now)
 const observed=retainQualityJobReference({before:f.record,after,action:'PROMOTE',reference:reference('PROMOTE',f.record.pending.nonce)})
 assert.equal(observed,after);assert.equal(observed.reproduction,null)
 assert.throws(()=>encodeQualityJobState({manifest:f.manifest,record:{...observed,pending:f.record.pending},externalId:f.externalId}))
})
test('long observation retains one bounded latest reference instead of growing an execution history',async()=>{
 const {retainQualityJobReference}=await import('../src/job-state.mjs'),{advanceIncident}=await import('../src/controller.mjs')
 const f=fixture('OBSERVE');let record=f.record
 record.reproduction.nativeJobs={promote:reference('PROMOTE'),verifyRuntime:reference('VERIFY_RUNTIME')}
 for(let i=0;i<1000;i++){
  const nonce=randomUUID();record={...record,pending:{action:'OBSERVE',nonce,externalId:'aqc-job:'+control+':'+nonce+':OBSERVE'}}
  const after=advanceIncident(record,'OBSERVE',{result:'STABLE',sourceSha:control},now+i)
  record=retainQualityJobReference({before:record,after,action:'OBSERVE',reference:reference('OBSERVE',nonce)})
 }
 assert.equal(Object.keys(record.reproduction.nativeJobs).length,3)
 assert(Buffer.byteLength(JSON.stringify(record))<16384)
})
test('reference metadata rejects unknown actions rebound pending identity and executable getters',async()=>{
 const {retainQualityJobReference}=await import('../src/job-state.mjs'),f=fixture('EXECUTE')
 for(const changed of [{...reference('EXECUTE'),runId:'not-an-id'},{...reference('EXECUTE'),runId:701},{...reference('EXECUTE'),workflowId:991},{...reference('EXECUTE'),token:'synthetic'},
  reference('VERIFY'),reference('EXECUTE')]){
  assert.throws(()=>retainQualityJobReference({before:f.record,after:{...f.record,pending:null},action:'EXECUTE',reference:changed}))
 }
 let calls=0;const ref=reference('EXECUTE',f.record.pending.nonce)
 Object.defineProperty(ref,'documentSha256',{enumerable:true,get(){calls++;throw Error('must not execute')}})
 assert.throws(()=>retainQualityJobReference({before:f.record,after:{...f.record,pending:null},action:'EXECUTE',reference:ref}))
 assert.equal(calls,0)
})

async function historicalZip(document){
 const {deflateRawSync}=await import('node:zlib')
 const bytes=Buffer.from(JSON.stringify(document)),compressed=deflateRawSync(bytes),name=Buffer.from('result.json')
 let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=crc&1?0xedb88320^(crc>>>1):crc>>>1}crc=(crc^0xffffffff)>>>0
 const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(8,8)
 local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(bytes.length,22);local.writeUInt16LE(name.length,26)
 const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6)
 central.writeUInt16LE(8,10);central.writeUInt32LE(crc,16);central.writeUInt32LE(compressed.length,20)
 central.writeUInt32LE(bytes.length,24);central.writeUInt16LE(name.length,28)
 const offset=local.length+name.length+compressed.length,end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50)
 end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(central.length+name.length,12);end.writeUInt32LE(offset,16)
 return Buffer.concat([local,name,compressed,central,name,end])
}
async function historicalFixture(action='QUALIFY',options={}){
 const {createHash}=await import('node:crypto')
 const {createQualityGitHub}=await import('../src/github.mjs')
 const {admitQualityNativeJobState}=await import('../src/job-state.mjs')
 const base=fixture('PROPOSE');base.record.attemptsUsed=1
 const nonce=randomUUID(),priorExternalId='aqc-job:'+control+':'+nonce+':'+action
 const keys=new Map(),pairs=new Map()
 for(const role of ['EXECUTOR_SUPERVISOR','INDEPENDENT_VERIFIER','INDEPENDENT_PUBLISHER']){
  const pair=generateKeyPairSync('ed25519');pairs.set(role,pair);keys.set(role,new Map([[publicKeyId(pair.publicKey),pair.publicKey]]))
 }
 const results={
  QUALIFY:{result:'DETERMINISTIC_FAILURE',method:'DETERMINISTIC',causeFingerprint:digest,repairClass:'C1'},
  REPRODUCE:{result:'RED',baseSha:sha,proofSha256:digest},
  EXECUTE:{result:'PATCH',baseSha:sha,patch:{artifactSha256:digest,treeSha256:digest}},
  VERIFY:{result:'PASS',baseSha:sha,artifactSha256:digest,baseTest:'FAIL',candidateTest:'PASS',holdoutCases:240,
   criticalRegressions:0,accessViolations:0,unverifiableCases:0,criticalCasesPass:true,criticalRepeats:3,stable:true,
   correctnessDeltaPp:0,unjustifiedRefusalDeltaPp:0,scopeBeforeDefects:10,scopeAfterDefects:0,
   classCounts:{C1:80,C2:80,C3:80},proofSha256:digest}
 }
 const role=action==='EXECUTE'?'EXECUTOR_SUPERVISOR':'INDEPENDENT_VERIFIER'
 const body={schemaVersion:'AQC_CONTROLLER_JOB_RESULT_V1',repository:'profitia/SG-dev',environment:'development',role,action,
  incidentId:base.manifest.incidentId,baseSha:sha,manifestSha256:documentDigest(base.manifest),gateSetSha256:digest,
  controlSourceSha:control,nonce,runId:'700',runAttempt:1,workflowId:'991',rawQaPayloadIncluded:false,
  issuedAt:stamp(now-600),expiresAt:stamp(now+60000),result:results[action]}
 options.bodyChange?.(body)
 const document=signDocument('AQC_CONTROLLER_JOB_RESULT_V1',body,pairs.get(options.signer??role).privateKey)
 const archive=await historicalZip(document),hash=v=>createHash('sha256').update(v).digest('hex')
 const reference={externalId:priorExternalId,runId:'700',workflowId:'991',artifactSha256:hash(archive),
  documentSha256:documentDigest(document),createdAt:stamp(now-750)}
 options.referenceChange?.(reference)
 base.record.reproduction.nativeJobs={[{QUALIFY:'qualify',REPRODUCE:'reproduce',EXECUTE:'execute',VERIFY:'verify'}[action]]:reference}
 options.recordChange?.(base.record)
 const f=await nativeFixture({display_title:'AQC JOB PROPOSE '+base.record.pending.nonce},base)
 const invocation=await f.client.controllerJobInvocation({externalId:f.externalId,runId:'701'})
 const jobState=await admitQualityNativeJobState({...f,invocation,now})
 const state={clock:now,missing:false,run:{id:700,workflow_id:991,head_sha:control,head_branch:'main',
  path:'.github/workflows/assistant-quality-repair.yml',event:'workflow_dispatch',run_attempt:1,
  repository:{full_name:'profitia/SG-dev'},actor:{login:'profitia'},triggering_actor:{login:'profitia'},
  display_title:'AQC JOB '+action+' '+nonce,status:'completed',conclusion:'success',created_at:stamp(now-750)}}
 const calls=[],workflow=Buffer.from('synthetic fixed workflow source\n')
 const client=createQualityGitHub({token:'synthetic-history-reader',now:()=>state.clock,
  controllerWorkflowSha256:hash(workflow),fetchImpl:async(url,input)=>{
   calls.push({url,method:input.method})
   if(url.endsWith('/actions/workflows/assistant-quality-repair.yml'))return Response.json({id:991,path:state.run.path,state:'active'})
   if(url.includes('/contents/'))return Response.json({type:'file',path:state.run.path,encoding:'base64',size:workflow.length,
    sha:createHash('sha1').update('blob '+workflow.length+'\0').update(workflow).digest('hex'),content:workflow.toString('base64')})
   if(url.endsWith('/actions/runs/700'))return Response.json(state.run)
   if(url.includes('/actions/runs/700/artifacts?'))return Response.json({total_count:state.missing?0:1,artifacts:state.missing?[]:[
    {id:800,name:'aqc-result-'+nonce,expired:false,size_in_bytes:archive.length,digest:'sha256:'+hash(archive),
     workflow_run:{id:700,head_sha:control}}]})
   if(url.endsWith('/actions/artifacts/800/zip'))return new Response(archive,{headers:{'content-length':String(archive.length)}})
   throw Error('unexpected history endpoint')
  }})
 return {...f,client,jobState,keys,state,calls,body,reference,result:results[action],
  input:{manifest:f.manifest,jobState,externalId:f.externalId,action,keysByRole:keys}}
}
test('historical phases re-read actual native archives and separate signatures instead of trusting stored indexes',async()=>{
 for(const action of ['QUALIFY','REPRODUCE','EXECUTE','VERIFY']){
  const f=await historicalFixture(action)
  try{
   const a=await f.client.controllerJobHistory(f.input),b=await f.client.controllerJobHistory(f.input)
   assert.deepEqual(a.result,f.result);assert.deepEqual(b.result,f.result)
   assert.equal(a.phaseReceiptVerified,true);assert.equal(a.independentBundleVerified,false);assert.equal(a.authorityIncluded,false)
   assert.equal(f.calls.filter(c=>c.url.endsWith('/actions/artifacts/800/zip')).length,2)
   assert(f.calls.every(c=>c.method==='GET'));assert.equal(Object.isFrozen(a.result),true)
  }finally{f.cleanup()}
 }
})
test('historical reader rejects forged native state unsupported publication phases and a rebound current job before GET',async()=>{
 const f=await historicalFixture()
 try{
  for(const input of [{...f.input,jobState:structuredClone(f.jobState)},{...f.input,jobState:{}},
   {...f.input,externalId:f.externalId.replace(f.record.pending.nonce,randomUUID())},{...f.input,action:'PROMOTE'},
   {...f.input,action:'PROPOSE'},{...f.input,action:'ROLLBACK'}]){
   await assert.rejects(f.client.controllerJobHistory(input))
  }
  assert.equal(f.calls.length,0)
 }finally{f.cleanup()}
})
test('stored archive document workflow run and creation pointers must all match real native provenance',async()=>{
 for(const change of [r=>r.artifactSha256='f'.repeat(64),r=>r.documentSha256='f'.repeat(64),
  r=>r.workflowId='992',r=>r.runId='701',r=>r.createdAt=stamp(now-749)]){
  const f=await historicalFixture('QUALIFY',{referenceChange:change})
  try{await assert.rejects(f.client.controllerJobHistory(f.input))}
  finally{f.cleanup()}
 }
 for(const change of [{actor:{login:'foreign'}},{run_attempt:2},{conclusion:'failure'},{status:'in_progress',conclusion:null},
  {head_sha:sha},{workflow_id:992},{display_title:'AQC JOB QUALIFY '+randomUUID()}]){
  const f=await historicalFixture()
  try{Object.assign(f.state.run,change);await assert.rejects(f.client.controllerJobHistory(f.input))}
  finally{f.cleanup()}
 }
})
test('valid native transport cannot replace the correct separate signature or incident manifest and original time bounds',async()=>{
 for(const options of [{signer:'EXECUTOR_SUPERVISOR'},{bodyChange:b=>b.incidentId=randomUUID()},
  {bodyChange:b=>b.manifestSha256='f'.repeat(64)},{bodyChange:b=>b.baseSha=control},
  {bodyChange:b=>b.controlSourceSha=sha},{bodyChange:b=>b.nonce=randomUUID()},
  {bodyChange:b=>b.issuedAt=stamp(now-499)}]){
  const f=await historicalFixture('QUALIFY',options)
  try{await assert.rejects(f.client.controllerJobHistory(f.input))}
  finally{f.cleanup()}
 }
 const f=await historicalFixture()
 try{
  f.state.clock=now+60000;await assert.rejects(f.client.controllerJobHistory(f.input),{code:'CONTROLLER_JOB_RESULT_STALE'})
  f.state.clock=now+1800001;await assert.rejects(f.client.controllerJobHistory(f.input),{code:'CONTROLLER_HISTORY_STALE'})
 }finally{f.cleanup()}
})
test('signed facts must match the latest persisted reproduction patch and verification instead of an older successful attempt',async()=>{
 for(const [action,recordChange] of [
  ['REPRODUCE',r=>r.reproduction.proofSha256='f'.repeat(64)],
  ['EXECUTE',r=>r.patch.treeSha256='f'.repeat(64)],
  ['EXECUTE',r=>{r.patch.artifactSha256='f'.repeat(64);r.verification.artifactSha256='f'.repeat(64)}],
  ['VERIFY',r=>r.verification.proofSha256='f'.repeat(64)]]){
  const f=await historicalFixture(action,{recordChange})
  try{await assert.rejects(f.client.controllerJobHistory(f.input),{code:'CONTROLLER_HISTORY_STATE_MISMATCH'})}
  finally{f.cleanup()}
 }
})
test('missing historical native artifact never becomes a verified fact or an extra dispatch',async()=>{
 const f=await historicalFixture()
 try{f.state.missing=true;await assert.rejects(f.client.controllerJobHistory(f.input),{code:'CONTROLLER_HISTORY_REFERENCE_MISMATCH'})
  assert(f.calls.every(c=>c.method==='GET'))
 }finally{f.cleanup()}
})

test('ten declared native fields normalize only unused empty defaults while EXECUTE keeps both permit fields',async()=>{
 const {normalizeQualityControllerJobInputs}=await import('../src/job-context.mjs')
 const {qualityControllerJobInputs}=await import('../src/github.mjs'),f=fixture()
 const global={...qualityControllerJobInputs(f),permit_id:'',permit_expires_at:''}
 assert.equal(Object.keys(global).length,10)
 const canonical=normalizeQualityControllerJobInputs(global)
 assert.deepEqual(canonical,qualityControllerJobInputs(f));assert.equal(Object.isFrozen(canonical),true)
 const legacy=qualityControllerJobInputs({manifest:f.manifest,externalId:f.externalId})
 assert.deepEqual(normalizeQualityControllerJobInputs({...legacy,state:'',permit_id:'',permit_expires_at:''}),legacy)
 const e=fixture('EXECUTE'),permit={incidentId:e.manifest.incidentId,attemptId:e.record.pending.nonce,
  permitId:randomUUID(),ordinal:1,expiresAt:stamp(now+60000)},execute=qualityControllerJobInputs({...e,permit})
 assert.equal(Object.keys(normalizeQualityControllerJobInputs(execute)).length,10)
 assert.equal(normalizeQualityControllerJobInputs(execute).permit_id,permit.permitId)
})
test('native default normalization never ignores an unknown field nonempty unused permit getter or oversized state',async()=>{
 const {normalizeQualityControllerJobInputs}=await import('../src/job-context.mjs'),f=fixture()
 const {qualityControllerJobInputs}=await import('../src/github.mjs'),input=qualityControllerJobInputs(f)
 for(const changed of [{...input,permit_id:'foreign'},{...input,permit_expires_at:stamp(now+1)},
  {...input,recovery_sha256:''},{...input,rawQa:''},{...input,state:'x'.repeat(16385)},
  {...input,nonce:1},{...input,action:'UNDECLARED'},{...input,mode:'keyless-qualify'}]){
  assert.throws(()=>normalizeQualityControllerJobInputs(changed),{code:'JOB_CONTEXT_INPUT_INVALID'})
 }
 let calls=0;const getter={...input}
 Object.defineProperty(getter,'permit_id',{enumerable:true,get(){calls++;throw Error('must not execute')}})
 assert.throws(()=>normalizeQualityControllerJobInputs(getter),{code:'JOB_CONTEXT_INPUT_INVALID'});assert.equal(calls,0)
 const inherited=Object.create(input)
 assert.throws(()=>normalizeQualityControllerJobInputs(inherited),{code:'JOB_CONTEXT_INPUT_INVALID'})
 const hidden={...input};Object.defineProperty(hidden,'permit_id',{value:'',enumerable:false})
 assert.throws(()=>normalizeQualityControllerJobInputs(hidden),{code:'JOB_CONTEXT_INPUT_INVALID'})
})
test('the actual native event may carry declared empty defaults but extra or nonempty fields still cannot mint state',async()=>{
 const {admitQualityNativeJobState}=await import('../src/job-state.mjs')
 const f=await nativeFixture()
 try{
  const invocation=await f.client.controllerJobInvocation({externalId:f.externalId,runId:'701'})
  const inputs={...f.inputs,permit_id:'',permit_expires_at:''}
  f.fs.writeFileSync(f.file,JSON.stringify({inputs}))
  const admitted=await admitQualityNativeJobState({...f,inputs,invocation,now})
  assert.equal(admitted.providerIdentityVerified,true)
  for(const changed of [{...inputs,permit_id:'foreign'},{...inputs,recovery_sha256:''},{...inputs,rawQa:''}]){
   f.fs.writeFileSync(f.file,JSON.stringify({inputs:changed}))
   await assert.rejects(admitQualityNativeJobState({...f,inputs,invocation,now}),{code:'JOB_STATE_NATIVE_INVOCATION_REQUIRED'})
  }
 }finally{f.cleanup()}
})

async function verificationZip(document){
 const {deflateRawSync}=await import('node:zlib'),bytes=Buffer.from(JSON.stringify(document)),compressed=deflateRawSync(bytes),name=Buffer.from('verification.json')
 let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=crc&1?0xedb88320^(crc>>>1):crc>>>1}crc=(crc^0xffffffff)>>>0
 const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(8,8)
 local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(bytes.length,22);local.writeUInt16LE(name.length,26)
 const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6)
 central.writeUInt16LE(8,10);central.writeUInt32LE(crc,16);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(bytes.length,24);central.writeUInt16LE(name.length,28)
 const offset=30+name.length+compressed.length,end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10)
 end.writeUInt32LE(46+name.length,12);end.writeUInt32LE(offset,16)
 return Buffer.concat([local,name,compressed,central,name,end])
}
async function verificationTransportFixture(mode='valid'){
 const {createHash}=await import('node:crypto'),{createQualityGitHub}=await import('../src/github.mjs')
 const {admitQualityNativeJobState}=await import('../src/job-state.mjs')
 const base=fixture('PROPOSE'),nonce=randomUUID(),externalId='aqc-job:'+control+':'+nonce+':VERIFY'
 base.record.attemptsUsed=1
 // Synthetic signed documents exercise transport/binding only. No real
 // independent execution, reviewed holdout or publishing authority is claimed.
 const verification={result:'PASS',baseSha:sha,artifactSha256:digest,baseTest:'FAIL',candidateTest:'PASS',holdoutCases:240,
  classCounts:{C1:80,C2:80,C3:80},criticalRegressions:0,accessViolations:0,unverifiableCases:0,criticalCasesPass:true,
  criticalRepeats:3,stable:true,correctnessDeltaPp:0,unjustifiedRefusalDeltaPp:0,holdoutSha256:digest,rubricVersion:'synthetic-reference-v1',
  scopeBeforeDefects:10,scopeAfterDefects:0,beforeSourceSha256:digest,afterSourceSha256:'e'.repeat(64),
  regressionSha256:digest,observationsSha256:digest}
 verification.proofSha256=documentDigest(verification)
 base.record.verification.proofSha256=verification.proofSha256
 const pairs=new Map(),keys=new Map()
 for(const role of ['EXECUTOR_SUPERVISOR','INDEPENDENT_VERIFIER','INDEPENDENT_PUBLISHER']){
  const pair=generateKeyPairSync('ed25519');pairs.set(role,pair);keys.set(role,new Map([[publicKeyId(pair.publicKey),pair.publicKey]]))
 }
 const fullBody={schemaVersion:'AQC_VERIFICATION_RESULT_V1',applicationId:'spendguru',environment:'development',repository:'profitia/SG-dev',
  incidentId:base.manifest.incidentId,repairClass:'C1',baseSha:sha,manifestSha256:documentDigest(base.manifest),gateSetSha256:digest,
  artifactSha256:digest,verification,nonce,controlSourceSha:control,runId:'700',runAttempt:1,observedAt:stamp(now-600),
  expiresAt:stamp(now+(mode==='expired'?0:60000)),rawQaPayloadIncluded:false}
 if(mode==='foreignIncident')fullBody.incidentId=randomUUID()
 const proof=signDocument('AQC_VERIFICATION_RESULT_V1',fullBody,pairs.get(mode==='wrongSigner'?'EXECUTOR_SUPERVISOR':'INDEPENDENT_VERIFIER').privateKey)
 const included=['result','baseSha','artifactSha256','baseTest','candidateTest','holdoutCases','criticalRegressions','accessViolations',
  'unverifiableCases','criticalCasesPass','criticalRepeats','stable','correctnessDeltaPp','unjustifiedRefusalDeltaPp',
  'scopeBeforeDefects','scopeAfterDefects','classCounts','proofSha256']
 const phaseResult=Object.fromEntries(included.map(k=>[k,verification[k]]))
 if(mode==='phaseMismatch')phaseResult.correctnessDeltaPp=-0.5
 const phase=signDocument('AQC_CONTROLLER_JOB_RESULT_V1',{schemaVersion:'AQC_CONTROLLER_JOB_RESULT_V1',repository:'profitia/SG-dev',
  environment:'development',role:'INDEPENDENT_VERIFIER',action:'VERIFY',incidentId:base.manifest.incidentId,baseSha:sha,
  manifestSha256:documentDigest(base.manifest),gateSetSha256:digest,controlSourceSha:control,nonce,runId:'700',runAttempt:1,
  workflowId:'991',rawQaPayloadIncluded:false,issuedAt:stamp(now-600),expiresAt:stamp(now+60000),result:phaseResult},
  pairs.get('INDEPENDENT_VERIFIER').privateKey)
 const phaseZip=await historicalZip(phase),proofZip=await verificationZip(proof),hash=v=>createHash('sha256').update(v).digest('hex')
 const reference={externalId,runId:'700',workflowId:'991',artifactSha256:hash(phaseZip),documentSha256:documentDigest(phase),createdAt:stamp(now-750)}
 base.record.reproduction.nativeJobs={verify:reference}
 const f=await nativeFixture({display_title:'AQC JOB PROPOSE '+base.record.pending.nonce},base)
 const invocation=await f.client.controllerJobInvocation({externalId:f.externalId,runId:'701'})
 const jobState=await admitQualityNativeJobState({...f,invocation,now})
 const workflow=Buffer.from('synthetic fixed workflow source\n'),calls=[]
 const run={id:700,workflow_id:991,head_sha:control,head_branch:'main',path:'.github/workflows/assistant-quality-repair.yml',
  event:'workflow_dispatch',run_attempt:1,repository:{full_name:'profitia/SG-dev'},actor:{login:'profitia'},triggering_actor:{login:'profitia'},
  display_title:'AQC JOB VERIFY '+nonce,status:'completed',conclusion:'success',created_at:stamp(now-750)}
 const client=createQualityGitHub({token:'synthetic-proof-reader',now:()=>now,controllerWorkflowSha256:hash(workflow),fetchImpl:async(url,input)=>{
  calls.push({url,method:input.method})
  if(url.endsWith('/actions/workflows/assistant-quality-repair.yml'))return Response.json({id:991,path:run.path,state:'active'})
  if(url.includes('/contents/'))return Response.json({type:'file',path:run.path,encoding:'base64',size:workflow.length,
   sha:createHash('sha1').update('blob '+workflow.length+'\0').update(workflow).digest('hex'),content:workflow.toString('base64')})
  if(url.endsWith('/actions/runs/700'))return Response.json(run)
  if(url.includes('/actions/runs/700/artifacts?'))return Response.json({total_count:2,artifacts:[
   {id:800,name:'aqc-result-'+nonce,expired:false,size_in_bytes:phaseZip.length,digest:'sha256:'+hash(phaseZip),workflow_run:{id:700,head_sha:control}},
   {id:801,name:'aqc-verification-'+nonce,expired:false,size_in_bytes:proofZip.length,digest:'sha256:'+hash(proofZip),workflow_run:{id:700,head_sha:control}}]})
  if(url.endsWith('/actions/artifacts/800/zip'))return new Response(phaseZip,{headers:{'content-length':String(phaseZip.length)}})
  if(url.endsWith('/actions/artifacts/801/zip'))return new Response(proofZip,{headers:{'content-length':String(proofZip.length)}})
  throw Error('unexpected independent proof endpoint')
 }})
 const history=await client.controllerJobHistory({manifest:f.manifest,jobState,externalId:f.externalId,action:'VERIFY',keysByRole:keys})
 const proofObservation=await client.controllerJobVerification({externalId,runId:'700'})
 const record={...f.record,status:'PATCH_READY',pending:{action:'VERIFY',nonce,externalId}}
 return {...f,client,jobState,keys,calls,externalId,history,proofObservation,verification,
  proofInput:{resultObservation:history.observation,verificationObservation:proofObservation,manifest:f.manifest,record,
   externalId,runId:'700',workflowId:'991',keysByRole:keys,notBefore:now-750,now}}
}
test('native verification reads both successful same-run artifacts and preserves the independent full proof without publishing authority',async()=>{
 const {readQualityControllerVerification,assertQualityNativeVerification}=await import('../src/github.mjs'),f=await verificationTransportFixture()
 try{
  const value=readQualityControllerVerification(f.proofInput)
  assert.deepEqual(value.verification,f.verification);assert.equal(value.independentBundleVerified,true);assert.equal(value.authorityIncluded,false)
  assert.equal(assertQualityNativeVerification(value,{manifest:f.manifest,externalId:f.externalId,runId:'700',now}),value)
  assert.throws(()=>assertQualityNativeVerification(structuredClone(value),{manifest:f.manifest,externalId:f.externalId,runId:'700',now}),
   {code:'CONTROLLER_VERIFICATION_NATIVE_ARTIFACT_REQUIRED'})
  assert(f.calls.every(c=>c.method==='GET'));assert(Object.isFrozen(value.verification)&&Object.isFrozen(value.verificationReceipt.body))
 }finally{f.cleanup()}
})
test('native verification rejects a wrong independent signer stale full proof substituted incident and phase-only PASS',async()=>{
 const {readQualityControllerVerification}=await import('../src/github.mjs')
 for(const mode of ['wrongSigner','expired','foreignIncident','phaseMismatch']){
  const f=await verificationTransportFixture(mode)
  try{assert.throws(()=>readQualityControllerVerification(f.proofInput),mode)}
  finally{f.cleanup()}
 }
 const f=await verificationTransportFixture()
 try{
  for(const change of [{verificationObservation:structuredClone(f.proofObservation)},
   {resultObservation:structuredClone(f.history.observation)},{externalId:f.externalId.replace(':VERIFY',':EXECUTE')},{runId:'701'}])
   assert.throws(()=>readQualityControllerVerification({...f.proofInput,...change}))
  await assert.rejects(f.client.controllerJobVerification({externalId:f.externalId.replace(':VERIFY',':PROPOSE'),runId:'700'}),
   {code:'CONTROLLER_VERIFICATION_PHASE_REQUIRED'})
 }finally{f.cleanup()}
})
