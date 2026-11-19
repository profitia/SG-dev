import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID,generateKeyPairSync} from 'node:crypto'
import {documentDigest,signDocument,publicKeyId,assertVerifiedRepairManifest} from '../src/manifest.mjs'
import {prepareQualityControllerJobContext,readQualityControllerJobContext} from '../src/cli.mjs'
import {qualityOperationalRecoveryBody,admitQualityOperationalRecovery,assertQualityOperationalRecovery,qualityRecoveryJobInputs,
 readQualityRecoveryJobContext,readQualityRecoveryPhaseResult} from '../src/recovery.mjs'
import {createQualityController,qualityJobBinding} from '../src/controller.mjs'
const clone=v=>structuredClone(v),stamp=n=>new Date(n).toISOString()
const keyMap=k=>new Map([[publicKeyId(k.publicKey),k.publicKey]])
async function fixture(){
 const f=await fixtureRegistry(),originalAt=f.options.now,now=originalAt+2*3600000
 const record={id:f.options.incidentId,baseSha:f.options.baseSha,repairClass:'C1',status:'RELEASED',pending:null,
  attemptsUsed:1,rollbacksUsed:0,rollbackRequired:false,wakeAt:originalAt,revision:1,causeFingerprint:'c'.repeat(64),
  release:{sourceSha:'d'.repeat(40),lastKnownGoodSha:f.options.baseSha,artifactSha256:'e'.repeat(64),
   configurationSha256:'f'.repeat(64),deployId:'dep-aaaaaaaaaaaaaaaaaaaa',lastKnownGoodDeployId:'dep-bbbbbbbbbbbbbbbbbbbb',releasedAt:originalAt+1000}}
 const body=qualityOperationalRecoveryBody({id:randomUUID(),issuedAt:stamp(now-1000),expiresAt:stamp(now+3600000),
  targetServiceId:f.options.expectedServiceId,mandateSha256:documentDigest(f.registry.mandate.body),gateSetSha256:f.options.expectedGateSetSha256})
 const signed=body=>signDocument('AQC_OPERATIONAL_RECOVERY_V1',body,f.owner.privateKey)
 const publisher=generateKeyPairSync('ed25519'),original=await prepareQualityControllerJobContext(f.options)
 record.patch={artifactSha256:record.release.artifactSha256,treeSha256:'1'.repeat(64)}
 const publicationBody={schemaVersion:'AQC_CONTROLLER_JOB_RESULT_V1',repository:'profitia/SG-dev',environment:'development',
  role:'INDEPENDENT_PUBLISHER',action:'PROMOTE',incidentId:record.id,baseSha:record.baseSha,manifestSha256:documentDigest(original.manifest),
  gateSetSha256:original.manifest.gateSetSha256,controlSourceSha:'a'.repeat(40),nonce:randomUUID(),runId:'1233',runAttempt:1,
  workflowId:'416905856',rawQaPayloadIncluded:false,issuedAt:stamp(originalAt+500),expiresAt:stamp(originalAt+300500),
  result:{result:'RELEASED',sourceSha:record.release.sourceSha,deployId:record.release.deployId,
   lastKnownGoodSha:record.release.lastKnownGoodSha,lastKnownGoodDeployId:record.release.lastKnownGoodDeployId,artifactSha256:record.release.artifactSha256,
   configurationSha256:record.release.configurationSha256,exactRuntimeVerified:true}}
 const releaseReceipt=signDocument('AQC_CONTROLLER_JOB_RESULT_V1',publicationBody,publisher.privateKey)
 const options={...f.options,record,now,document:signed(body),publisherKeys:keyMap(publisher),releaseReceipt}
 return {...f,originalAt,now,body,signed,record,options,publisher,publicationBody,releaseReceipt,authority:await admitQualityOperationalRecovery(options)}
}
test('fresh separately signed recovery reconstructs expired immutable facts but exposes no executable manifest',async()=>{
 const f=await fixture()
 await assert.rejects(prepareQualityControllerJobContext({...f.options}),{code:'MANDATE_EXPIRED'})
 assert.equal(f.authority.kind,'AQC_OPERATIONAL_RECOVERY_V1');assert(Object.isFrozen(f.authority))
 assert.equal(f.authority.manifest.incidentId,f.record.id)
 assert.throws(()=>assertVerifiedRepairManifest(f.authority.manifest),{code:'VERIFIED_MANIFEST_REQUIRED'})
 for(const action of ['VERIFY_RUNTIME','OBSERVE'])assert.equal(assertQualityOperationalRecovery(f.authority,{record:f.record,action,now:f.now}),f.authority)
 for(const action of ['QUALIFY','REPRODUCE','EXECUTE','VERIFY','PROPOSE','CHECKS','PROMOTE'])
  assert.throws(()=>assertQualityOperationalRecovery(f.authority,{record:f.record,action,now:f.now}),{code:'RECOVERY_ACTION_REJECTED'})
 assert.throws(()=>assertQualityOperationalRecovery(f.authority,{record:f.record,action:'ROLLBACK',now:f.now}),{code:'RECOVERY_CAUSE_REQUIRED'})
 assertQualityOperationalRecovery(f.authority,{record:{...f.record,rollbackRequired:true},action:'ROLLBACK',now:f.now})
})
test('a signature from another role, another document kind or a copied admitted object cannot grant recovery',async()=>{
 const f=await fixture(),outsider=generateKeyPairSync('ed25519')
 for(const document of [signDocument('AQC_OPERATIONAL_RECOVERY_V1',f.body,outsider.privateKey),
  signDocument('AQC_EXECUTION_MANDATE_V1',f.body,f.owner.privateKey)])
  await assert.rejects(admitQualityOperationalRecovery({...f.options,document}))
 for(const authority of [clone(f.authority),Object.freeze({...f.authority}),{...f.authority,manifest:f.authority.manifest}])
  assert.throws(()=>assertQualityOperationalRecovery(authority,{record:f.record,now:f.now}),{code:'VERIFIED_RECOVERY_AUTHORITY_REQUIRED'})
})
test('even an owner signature cannot widen recovery to promotion, data access, another target or more rollback attempts',async()=>{
 const f=await fixture()
 for(const change of [
  b=>b.actions.push('PROMOTE'),b=>b.actions.reverse(),b=>b.paidRequestsAllowed=true,b=>b.qaReadAllowed=true,
  b=>b.promotionAllowed=true,b=>b.rightsRenewalAllowed=true,b=>b.maxRollbacksPerRelease=2,
  b=>b.targetServiceId='srv-other',b=>b.environment='production',b=>b.mandateSha256='0'.repeat(64),
  b=>b.gateSetSha256='0'.repeat(64),b=>b.extra='unexpected',
 ]){
  const b=clone(f.body);change(b)
  await assert.rejects(admitQualityOperationalRecovery({...f.options,document:f.signed(b)}))
 }
})
test('expired, future-dated and unbounded recovery authority fails independently of the original paid mandate',async()=>{
 const f=await fixture()
 for(const change of [b=>b.expiresAt=stamp(f.now),b=>b.issuedAt=stamp(f.now+1),
  b=>b.expiresAt='2026-11-28T00:00:00.000Z']){
  const b=clone(f.body);change(b);await assert.rejects(admitQualityOperationalRecovery({...f.options,document:f.signed(b)}))
 }
 assert.throws(()=>assertQualityOperationalRecovery(f.authority,{record:f.record,now:Date.parse(f.body.expiresAt)}),{code:'RECOVERY_AUTHORITY_EXPIRED'})
})
test('only an already recorded own release can be monitored; pending promotion is never adopted through containment',async()=>{
 const f=await fixture()
 for(const change of [r=>r.release=null,r=>r.status='VERIFIED',r=>r.pending={action:'PROMOTE'},
  r=>r.release.releasedAt=Date.parse(f.registry.mandate.body.expiresAt),r=>r.release.releasedAt=f.originalAt-2000]){
  const record=clone(f.record);change(record);await assert.rejects(admitQualityOperationalRecovery({...f.options,record}))
 }
})
test('recovery remains tied to the exact incident, source, deployment, LKG and immutable release proofs',async()=>{
 const f=await fixture()
 for(const change of [r=>r.id=randomUUID(),r=>r.baseSha='1'.repeat(40),r=>r.release.sourceSha='1'.repeat(40),
  r=>r.release.lastKnownGoodSha='1'.repeat(40),r=>r.release.deployId='dep-bbbbbbbbbbbbbbbbbbbb',
  r=>r.release.lastKnownGoodDeployId='dep-cccccccccccccccccccc',r=>r.release.artifactSha256='1'.repeat(64),r=>r.release.configurationSha256='1'.repeat(64)]){
  const record=clone(f.record);change(record)
  assert.throws(()=>assertQualityOperationalRecovery(f.authority,{record,now:f.now}))
 }
})
test('changed original mandate, synthetic export, class or raw-QA claim never becomes a recovery context',async()=>{
 const f=await fixture()
 for(const change of [v=>v.mandate.body.maxAttempts=3,v=>v.fixtures[0].regression.expected={status:'FORGED'},
  v=>v.fixtures[0].fixtureExport.body.rawQaPayloadIncluded=true,v=>v.fixtures.pop()]){
  const registry=clone(f.registry);change(registry)
  await assert.rejects(admitQualityOperationalRecovery({...f.options,registry}))
 }
})
test('native recovery inputs carry only eight identifiers and digests, never a permit, case or private payload',async()=>{
 const f=await fixture(),externalId=qualityJobBinding({controlSourceSha:'a'.repeat(40),nonce:randomUUID(),action:'VERIFY_RUNTIME'})
 const inputs=qualityRecoveryJobInputs({authority:f.authority,record:f.record,action:'VERIFY_RUNTIME',externalId,now:f.now})
 assert.equal(Object.keys(inputs).length,8);assert.equal(inputs.recovery_sha256,f.authority.recoverySha256)
 assert(!JSON.stringify(inputs).includes('regression'));assert(!JSON.stringify(inputs).includes('permit'))
 const context=await readQualityRecoveryJobContext({...f.options,inputs})
 assert.equal(context.externalId,externalId);assert.equal(context.authority.recoverySha256,f.authority.recoverySha256)
 await assert.rejects(readQualityControllerJobContext({...f.options,inputs}),{code:'JOB_CONTEXT_INPUT_INVALID'})
 for(const change of [{action:'PROMOTE'},{action:'EXECUTE'},{recovery_sha256:'0'.repeat(64)},{manifest_sha256:'0'.repeat(64)},
  {base_sha:'0'.repeat(40)},{incident_id:randomUUID()},{nonce:'invalid'},{transcript:'PRIVATE_CANARY'}])
  await assert.rejects(readQualityRecoveryJobContext({...f.options,inputs:{...inputs,...change}}))
})
test('the real durable controller performs free runtime monitoring without touching the disabled paid ledger',async()=>{
 const f=await fixture(),calls=[],token=randomUUID();let current=f.record
 const store={
  async claim(){return {record:current,leaseToken:token}},
  async prepare(v){calls.push('prepare');current={...current,revision:current.revision+1,pending:{action:v.action,nonce:v.nonce,externalId:v.externalId}};return {record:current}},
  async recordExternal(){assert.fail('binding is committed with PREPARE')},
  async complete(){assert.fail('no semantic result yet')},async stop(){assert.fail('no stop expected')},
  async contain(){assert.fail('valid signed recovery must not be downgraded to unknown containment')},async release(){calls.push('release')}
 }
 const actions={async bind(action,{nonce,record,authority}){assertQualityOperationalRecovery(authority,{record,action,now:f.now});return qualityJobBinding({controlSourceSha:'a'.repeat(40),nonce,action})},
  async dispatch(action,{record,authority}){assertQualityOperationalRecovery(authority,{record,action,now:f.now});calls.push(action);return {externalId:record.pending.externalId}},
  async reconcile(){assert.fail('no pending before PREPARE')},async verify(){assert.fail('no result yet')},async cancel(){assert.fail('not cancelling')}
 }
 const budget={async ensureIncident(){assert.fail('operational recovery cannot reserve paid budget')},async closeIncident(){assert.fail('not terminal')}}
 const controller=createQualityController({store,actions,budget,authorize:async()=>f.authority,now:()=>f.now,workerId:'controlled-recovery-fixture'})
 const result=await controller.tick(f.record.id)
 assert.equal(result.waitingFor,'RUNNING');assert.deepEqual(calls,['prepare','VERIFY_RUNTIME','release'])
})
test('an independent fresh signed phase can prove a recovered runtime after original expiry without granting mutable promotion',async()=>{
 const f=await fixture(),verifier=generateKeyPairSync('ed25519'),nonce=randomUUID(),controlSourceSha='a'.repeat(40)
 const externalId=qualityJobBinding({controlSourceSha,nonce,action:'VERIFY_RUNTIME'})
 const record={...f.record,pending:{action:'VERIFY_RUNTIME',nonce,externalId}}
 const body={schemaVersion:'AQC_CONTROLLER_JOB_RESULT_V1',repository:'profitia/SG-dev',environment:'development',role:'INDEPENDENT_VERIFIER',
  action:'VERIFY_RUNTIME',incidentId:record.id,baseSha:record.baseSha,manifestSha256:documentDigest(f.authority.manifest),
  gateSetSha256:f.authority.manifest.gateSetSha256,controlSourceSha,nonce,runId:'1234',runAttempt:1,workflowId:'416905856',rawQaPayloadIncluded:false,
  issuedAt:stamp(f.now),expiresAt:stamp(f.now+300000),result:{result:'PASS',sourceSha:record.release.sourceSha,answerVerified:true,proofSha256:'0'.repeat(64)}}
 const options={authority:f.authority,record,externalId,runId:'1234',workflowId:'416905856',keysByRole:new Map([['INDEPENDENT_VERIFIER',keyMap(verifier)]]),
  notBefore:f.now-2000,now:f.now}
 const document=signDocument('AQC_CONTROLLER_JOB_RESULT_V1',body,verifier.privateKey)
 const result=await readQualityRecoveryPhaseResult(document,options);assert.equal(result.result,'PASS')
 await assert.rejects(readQualityRecoveryPhaseResult(document,{...options,externalId:qualityJobBinding({controlSourceSha,nonce,action:'PROMOTE'})}),{code:'RECOVERY_ACTION_REJECTED'})
 const old=signDocument('AQC_CONTROLLER_JOB_RESULT_V1',{...body,issuedAt:stamp(f.now-2000)},verifier.privateKey)
 await assert.rejects(readQualityRecoveryPhaseResult(old,options),{code:'CONTROLLER_JOB_RESULT_STALE'})
 const forged=signDocument('AQC_CONTROLLER_JOB_RESULT_V1',{...body,result:{...body.result,sourceSha:'1'.repeat(40)}},verifier.privateKey)
 await assert.rejects(readQualityRecoveryPhaseResult(forged,options))
})

async function fixtureRegistry(){
 const {generateKeyPairSync}=await import('node:crypto')
 const {signDocument,publicKeyId,documentDigest}=await import('../src/manifest.mjs')
 const {ownerMandateBody}=await import('../src/cli.mjs')
 const owner=generateKeyPairSync('ed25519'),exporter=generateKeyPairSync('ed25519')
 const now=Date.parse('2026-11-18T12:00:00.000Z'),baseSha='b'.repeat(40),gate='c'.repeat(64),service='srv-fixture'
 const body=ownerMandateBody({id:randomUUID(),issuedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+3600000).toISOString(),
  targetServiceId:service,gateSetSha256:gate})
 const mandate=signDocument('AQC_EXECUTION_MANDATE_V1',body,owner.privateKey)
 const fixtures=['C1','C2','C3'].map((repairClass,i)=>{
  const regression={schemaVersion:'AQC_REGRESSION_V1',repairClass,caseFamily:'controlled_'+repairClass,locale:i===1?'en':'pl',
   args:[{synthetic:true,caseNumber:i}],expected:{status:'VALID'},expectedAnswer:true,refusal:{pointer:'/status',values:['REFUSED']}}
  const sha256=documentDigest(regression)
  const fixtureExport=signDocument('AQC_SYNTHETIC_EXPORT_V1',{id:randomUUID(),fixtureId:'qa_synthetic_'+sha256,sha256,
   scope:'CONTROLLED_ACCEPTANCE',incidentId:randomUUID(),repairClass,issuedAt:body.issuedAt,expiresAt:body.expiresAt,rawQaPayloadIncluded:false},exporter.privateKey)
  return {fixtureExport,regression}
 })
 const registry={schemaVersion:'AQC_CONTROLLED_JOB_CONTEXTS_V1',repository:'profitia/SG-dev',environment:'development',mandate,fixtures}
 const options={registry,incidentId:fixtures[0].fixtureExport.body.incidentId,baseSha,ownerKeys:new Map([[publicKeyId(owner.publicKey),owner.publicKey]]),
  verifierKeys:new Map([[publicKeyId(exporter.publicKey),exporter.publicKey]]),expectedServiceId:service,expectedGateSetSha256:gate,now}
 return {registry,options,owner,exporter,signDocument,documentDigest}
}

test('the actual CLI entrypoint starts through its dependency graph and sanitises a controlled connection refusal',async()=>{
 const {spawnSync}=await import('node:child_process'),{fileURLToPath}=await import('node:url')
 const preload="import net from 'node:net';net.Socket.prototype.connect=function(){queueMicrotask(()=>this.emit('error',Object.assign(Error('CONTROLLED_NETWORK_REFUSAL'),{code:'ECONNREFUSED'})));return this}"
 const env={PATH:process.env.PATH,HOME:process.env.HOME,LANG:'C.UTF-8',TARGET_ENVIRONMENT:'development',AQC_MODE:'TECHNICAL_READINESS',
  AQC_PAID_REPAIRS_ENABLED:'false',AQC_PROMOTION_ENABLED:'false',RENDER_SERVICE_ID:'srv-aaaaaaaaaaaaaaaaaaaa',RENDER_GIT_COMMIT:'a'.repeat(40),
  AQC_SERVICE_UUID:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',AQC_CONTROL_COMMAND_KEY:'b'.repeat(64),AQC_LIMITS_COMMAND_KEY:'c'.repeat(64),
  AQC_CONTROL_DATABASE_URL:'postgresql://sg2_assistant_quality_controller:synthetic@ep-muddy-pine-b22pdyqd.c-6.eu-central-1.aws.neon.tech/neondb?sslmode=require',
  AQC_LIMITS_DATABASE_URL:'postgresql://profitia_limits_quality_controller:synthetic@ep-muddy-surf-b9vpyy2d.c-7.eu-central-1.aws.neon.tech/neondb?sslmode=require'}
 const child=spawnSync(process.execPath,['--import','data:text/javascript,'+encodeURIComponent(preload),
  fileURLToPath(new URL('../src/cli.mjs',import.meta.url)),'readiness'],{env,encoding:'utf8',timeout:8000,maxBuffer:32768})
 assert.equal(child.error,undefined);assert.equal(child.signal,null);assert.equal(child.status,1)
 const output=child.stdout+child.stderr
 assert.match(output,/"event":"aqc.technical.failure"/);assert(!output.includes('synthetic'));assert(!output.includes('ep-muddy'))
 assert(!output.includes('CONTROLLED_NETWORK_REFUSAL'))
})
test('the fixed native GitHub recovery transport is independently default-OFF and dispatches only an admitted free action once',async()=>{
 const f=await fixture(),{createHash}=await import('node:crypto'),{createQualityGitHub}=await import('../src/github.mjs')
 const source='a'.repeat(40),nonce=randomUUID(),externalId=qualityJobBinding({controlSourceSha:source,nonce,action:'VERIFY_RUNTIME'})
 const bytes=Buffer.from('name: controlled recovery fixture\n'),blob=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex')
 const digest=createHash('sha256').update(bytes).digest('hex'),calls=[];let lost=false,at=f.now
 const fetchImpl=async(url,options)=>{
  calls.push({url,options})
  if(options.method==='POST'){if(lost)throw Error('lost response');return new Response(null,{status:204})}
  if(url.endsWith('/git/ref/heads/main'))return Response.json({object:{sha:source}})
  if(url.endsWith('/actions/workflows/assistant-quality-repair.yml'))return Response.json({id:416905856,path:'.github/workflows/assistant-quality-repair.yml',state:'active'})
  if(url.includes('/contents/.github/workflows/assistant-quality-repair.yml?ref='+source))
   return Response.json({type:'file',path:'.github/workflows/assistant-quality-repair.yml',encoding:'base64',sha:blob,size:bytes.length,content:bytes.toString('base64')})
  assert.fail('Unexpected provider route')
 }
 const settings={token:'synthetic',fetchImpl,controllerWorkflowSha256:digest,now:()=>at}
 const request={authority:f.authority,record:f.record,action:'VERIFY_RUNTIME',externalId}
 await assert.rejects(createQualityGitHub(settings).dispatchRecoveryJob(request),{code:'RECOVERY_JOBS_DISABLED'});assert.equal(calls.length,0)
 const client=createQualityGitHub({...settings,recoveryJobsEnabled:true})
 for(const change of [{authority:clone(f.authority)},{action:'PROMOTE'},{action:'EXECUTE'},{record:{...f.record,release:null}}])
  await assert.rejects(client.dispatchRecoveryJob({...request,...change}))
 assert.equal(calls.length,0)
 const result=await client.dispatchRecoveryJob(request)
 assert.equal(result.state,'UNKNOWN');assert.equal(result.resultVerified,false)
 let posts=calls.filter(c=>c.options.method==='POST');assert.equal(posts.length,1)
 const sent=JSON.parse(posts[0].options.body);assert.equal(sent.ref,'main');assert.equal(Object.keys(sent.inputs).length,8)
 assert.equal(sent.inputs.recovery_sha256,f.authority.recoverySha256);assert.equal(sent.inputs.action,'VERIFY_RUNTIME')
 const before=calls.length;at=Date.parse(f.body.expiresAt)
 await assert.rejects(client.dispatchRecoveryJob(request),{code:'RECOVERY_AUTHORITY_EXPIRED'});assert.equal(calls.length,before)
 at=f.now;lost=true
 await assert.rejects(client.dispatchRecoveryJob(request),{code:'DELIVERY_UNCERTAIN'})
 posts=calls.filter(c=>c.options.method==='POST');assert.equal(posts.length,2,'the explicit second attempt is never internally retried')
})
test('recovery action ports retain native envelopes and distinct phase keys before the durable state can advance',async()=>{
 const f=await fixture(),{createQualityOperationalRecoveryActions,composeQualityControllerActionPorts}=await import('../src/recovery.mjs')
 const phase=Object.fromEntries(['EXECUTOR_SUPERVISOR','INDEPENDENT_VERIFIER','INDEPENDENT_PUBLISHER'].map(r=>[r,generateKeyPairSync('ed25519')]))
 const keysByRole=new Map(Object.entries(phase).map(([r,k])=>[r,keyMap(k)])),nonce=randomUUID(),source='a'.repeat(40),calls=[]
 const externalId=qualityJobBinding({controlSourceSha:source,nonce,action:'VERIFY_RUNTIME'})
 const record={...f.record,pending:{action:'VERIFY_RUNTIME',nonce,externalId}},input={record,authority:f.authority}
 const body={schemaVersion:'AQC_CONTROLLER_JOB_RESULT_V1',repository:'profitia/SG-dev',environment:'development',role:'INDEPENDENT_VERIFIER',
  action:'VERIFY_RUNTIME',incidentId:record.id,baseSha:record.baseSha,manifestSha256:documentDigest(f.authority.manifest),
  gateSetSha256:f.authority.manifest.gateSetSha256,controlSourceSha:source,nonce,runId:'1234',runAttempt:1,workflowId:'416905856',rawQaPayloadIncluded:false,
  issuedAt:stamp(f.now),expiresAt:stamp(f.now+300000),result:{result:'PASS',sourceSha:record.release.sourceSha,answerVerified:true,proofSha256:'0'.repeat(64)}}
 const document=signDocument('AQC_CONTROLLER_JOB_RESULT_V1',body,phase.INDEPENDENT_VERIFIER.privateKey)
 const github={
  async descriptor(){return {headSha:source}},async recoveryJobDescriptor(){return {sourceSha:source,dispatchEnabled:true}},
  async dispatchRecoveryJob(v){assert.equal(v.authority,f.authority);calls.push('dispatch');return {state:'UNKNOWN',externalId,resultVerified:false}},
  async findControllerJob(){return {state:'COMPLETE',externalId,resultVerified:false,runId:'1234',conclusion:'success'}},
  async controllerJobResult(){return {state:'COMPLETE',externalId,resultVerified:false,runId:'1234',workflowId:'416905856',createdAt:stamp(f.now),document}},
  async cancelControllerJob(){assert.fail('completed job')}
 }
 const recovery=createQualityOperationalRecoveryActions({github,keysByRole,now:()=>f.now})
 const ordinary=Object.fromEntries(['bind','dispatch','reconcile','verify','cancel'].map(name=>[name,()=>assert.fail('ordinary repair port cannot receive operational recovery')]))
 const port=composeQualityControllerActionPorts({ordinary,recovery})
 assert.equal(await port.bind('VERIFY_RUNTIME',{record:f.record,authority:f.authority,nonce}),externalId)
 await port.dispatch('VERIFY_RUNTIME',{...input,intent:record.pending});assert.deepEqual(calls,['dispatch'])
 const received=await port.reconcile(record.pending,input);assert.equal(received.state,'COMPLETE')
 for(const forged of [{},clone(received.result),document])await assert.rejects(port.verify('VERIFY_RUNTIME',forged,input),{code:'RECOVERY_NATIVE_RESULT_REQUIRED'})
 assert.equal((await port.verify('VERIFY_RUNTIME',received.result,input)).result,'PASS')
 await assert.rejects(port.bind('PROMOTE',{...input,nonce}),{code:'RECOVERY_ACTION_REJECTED'})
 const copiedKeys=new Map(keysByRole);copiedKeys.set('INDEPENDENT_PUBLISHER',copiedKeys.get('INDEPENDENT_VERIFIER'))
 assert.throws(()=>createQualityOperationalRecoveryActions({github,keysByRole:copiedKeys}),{code:'RECOVERY_ROLE_TRUST_REQUIRED'})
})

test('a controller row or owner-only assertion cannot replace the independent historical publication receipt',async()=>{
 const f=await fixture()
 for(const change of [{releaseReceipt:null},{publisherKeys:new Map()},{publisherKeys:f.options.ownerKeys},
  {publisherKeys:f.options.verifierKeys},{releaseReceipt:signDocument('AQC_CONTROLLER_JOB_RESULT_V1',f.publicationBody,f.owner.privateKey)}])
  await assert.rejects(admitQualityOperationalRecovery({...f.options,...change}))
 const record=clone(f.record);record.release.lastKnownGoodSha='9'.repeat(40)
 await assert.rejects(admitQualityOperationalRecovery({...f.options,record}),{code:'RECOVERY_PUBLISHED_RELEASE_REQUIRED'})
})
test('fresh recovery cannot authorise a backfilled, mismatched or late PROMOTE fact',async()=>{
 const f=await fixture()
 for(const change of [b=>b.issuedAt=stamp(f.now),b=>b.action='ROLLBACK',
  b=>b.result.sourceSha='1'.repeat(40),b=>b.result.deployId='dep-bbbbbbbbbbbbbbbbbbbb',
  b=>b.result.lastKnownGoodSha='1'.repeat(40),b=>b.manifestSha256='1'.repeat(64),
  b=>b.runAttempt=2,b=>b.workflowId='999',b=>b.rawQaPayloadIncluded=true]){
  const body=clone(f.publicationBody);change(body)
  const releaseReceipt=signDocument('AQC_CONTROLLER_JOB_RESULT_V1',body,f.publisher.privateKey)
  await assert.rejects(admitQualityOperationalRecovery({...f.options,releaseReceipt}))
 }
})

async function renderRecoveryFixture(){
 const f=await fixture(),{createQualityAttestedOperationalRecoveryRelease}=await import('../src/release.mjs')
 const verifier=generateKeyPairSync('ed25519'),nonce=randomUUID(),calls=[]
 const record={...f.record,status:'OBSERVING',rollbackRequired:true,rollbacksUsed:1,
  pending:{action:'ROLLBACK',nonce,externalId:qualityJobBinding({controlSourceSha:'a'.repeat(40),nonce,action:'ROLLBACK'})}}
 const serviceId='srv-dapa3tid0e5s73f8bc5g',restoredId='dep-cccccccccccccccccccc'
 const deployment=(id,sha,status='live')=>({id,status,commit:{id:sha}})
 let live=deployment(record.release.deployId,record.release.sourceSha),at=f.now,expireDuringRead=false,replyLost=false
 const service={id:serviceId,ownerId:'tea-d7lps8rbc2fs73cn80dg',type:'web_service',branch:'main',repo:'https://github.com/profitia/SG-dev',
  autoDeploy:'no',environmentId:'evm-dap98hm0tbcc738rro10',serviceDetails:{url:'https://sg2-development-runtime.onrender.com'}}
 const fetchImpl=async(url,options)=>{
  calls.push({url,options});assert(url.startsWith('https://api.render.com/v1/services/'+serviceId))
  const suffix=url.slice(('https://api.render.com/v1/services/'+serviceId).length)
  if(options.method==='POST'){
   assert.equal(suffix,'/rollback');assert.deepEqual(JSON.parse(options.body),{deployId:record.release.lastKnownGoodDeployId})
   if(replyLost)throw Error('lost reply')
   return Response.json(deployment(restoredId,record.release.lastKnownGoodSha,'created'))
  }
  if(suffix==='')return Response.json(service)
  if(suffix==='/deploys?limit=20')return Response.json([{deploy:live}])
  if(suffix==='/deploys/'+record.release.lastKnownGoodDeployId){
   if(expireDuringRead)at=Date.parse(f.body.expiresAt)
   return Response.json(deployment(record.release.lastKnownGoodDeployId,record.release.lastKnownGoodSha,'deactivated'))
  }
  assert.fail('Unexpected Render route')
 }
 const runtimeEvidence={keys:keyMap(verifier),nonce,notBefore:stamp(f.now-1000),readReceipt:async expected=>
  signDocument('AQC_RUNTIME_PROBE_V1',{schemaVersion:'AQC_RUNTIME_PROBE_V1',applicationId:'spendguru',environment:'development',serviceId,
   sourceSha:expected.sourceSha,deployId:expected.deployId,nonce,observedAt:stamp(at),expiresAt:stamp(at+30000),
   canonicalE1Verified:true,answerVerified:true,sourceBindingVerified:true,rawQaPayloadIncluded:false,proofInputsSha256:'2'.repeat(64)},verifier.privateKey)}
 const client=createQualityAttestedOperationalRecoveryRelease({token:'synthetic',fetchImpl,runtimeEvidence,now:()=>at})
 return {...f,record,calls,client,restoredId,serviceId,setLive:v=>{live=v},expire:()=>{expireDuringRead=true},lose:()=>{replyLost=true},runtimeEvidence}
}
test('independent Render recovery restores the exact retained deployment with promotion disabled and proves actual runtime separately',async()=>{
 const f=await renderRecoveryFixture(),result=await f.client.rollback({authority:f.authority,record:f.record})
 assert.equal(result.state,'RUNNING');assert.equal(result.sourceSha,f.record.release.lastKnownGoodSha);assert.equal(result.deployId,f.restoredId)
 assert.equal(f.calls.filter(c=>c.options.method==='POST').length,1);assert.equal(typeof f.client.deploy,'undefined')
 f.setLive({id:f.restoredId,status:'live',commit:{id:f.record.release.lastKnownGoodSha}})
 const proof=await f.client.verifyRestored({authority:f.authority,record:f.record,deployId:f.restoredId})
 assert.equal(proof.result,'RESTORED');assert.equal(proof.exactRuntimeVerified,true)
})
test('Render recovery rejects copied authority, an uncommitted rollback and another LKG before touching the provider',async()=>{
 const f=await renderRecoveryFixture()
 for(const input of [
  {authority:clone(f.authority),record:f.record},{authority:f.authority,record:{...f.record,rollbacksUsed:0}},
  {authority:f.authority,record:{...f.record,pending:null}},{authority:f.authority,record:{...f.record,rollbackRequired:false}},
  {authority:f.authority,record:{...f.record,release:{...f.record.release,lastKnownGoodDeployId:'dep-dddddddddddddddddddd'}}},
  {authority:f.authority,record:f.record,verifyIndependent:()=>true},
 ])await assert.rejects(f.client.rollback(input))
 assert.equal(f.calls.length,0)
 const {createQualityRelease}=await import('../src/release.mjs')
 assert.throws(()=>createQualityRelease({token:'synthetic',fetchImpl:()=>assert.fail('no request'),verifyRuntime:async()=>true,recoveryCapability:{}}),
  {code:'RELEASE_CONFIGURATION_REQUIRED'})
})
test('Render recovery preserves a foreign deployment and rechecks owner expiry immediately before its single POST',async()=>{
 const f=await renderRecoveryFixture()
 f.setLive({id:'dep-dddddddddddddddddddd',status:'live',commit:{id:'9'.repeat(40)}})
 assert.equal((await f.client.rollback({authority:f.authority,record:f.record})).result,'FOREIGN_DEPLOYMENT')
 assert.equal(f.calls.filter(c=>c.options.method==='POST').length,0)
 const expired=await renderRecoveryFixture();expired.expire()
 await assert.rejects(expired.client.rollback({authority:expired.authority,record:expired.record}),{code:'RECOVERY_AUTHORITY_EXPIRED'})
 assert.equal(expired.calls.filter(c=>c.options.method==='POST').length,0)
 const lost=await renderRecoveryFixture();lost.lose()
 await assert.rejects(lost.client.rollback({authority:lost.authority,record:lost.record}),{code:'DELIVERY_UNCERTAIN'})
 assert.equal(lost.calls.filter(c=>c.options.method==='POST').length,1)
})

async function nativeRecoveryFixture(action='VERIFY_RUNTIME',{recoveryJobsEnabled=false,runChange={}}={}){
 const f=await fixture(),fs=await import('node:fs'),os=await import('node:os'),path=await import('node:path')
 const {createHash}=await import('node:crypto'),{createQualityGitHub}=await import('../src/github.mjs')
 const nonce=randomUUID(),source='a'.repeat(40),externalId=qualityJobBinding({controlSourceSha:source,nonce,action})
 const record={...f.record,status:action==='OBSERVE'?'OBSERVING':'RELEASED',
  ...(action==='ROLLBACK'?{rollbackRequired:true,rollbacksUsed:1}:{}),pending:{action,nonce,externalId}}
 const inputs=qualityRecoveryJobInputs({authority:f.authority,record,action,externalId,jobStateEnabled:true,now:f.now})
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'aqc-native-recovery-state-')),file=path.join(directory,'event.json')
 fs.writeFileSync(file,JSON.stringify({inputs:{...inputs,permit_id:'',permit_expires_at:''}}),{mode:0o600})
 const bytes=Buffer.from('synthetic fixed recovery native source\n'),hash=b=>createHash('sha256').update(b).digest('hex')
 const run={id:721,workflow_id:416905856,head_sha:source,head_branch:'main',path:'.github/workflows/assistant-quality-repair.yml',
  event:'workflow_dispatch',run_attempt:1,repository:{full_name:'profitia/SG-dev'},actor:{login:'profitia'},triggering_actor:{login:'profitia'},
  display_title:'AQC JOB '+action+' '+nonce,status:'in_progress',conclusion:null,created_at:stamp(f.now-500),...runChange}
 const calls=[],client=createQualityGitHub({token:'synthetic-native-recovery',recoveryJobsEnabled,now:()=>f.now,
  controllerWorkflowSha256:hash(bytes),fetchImpl:async(url,options)=>{
   calls.push({url,method:options.method,...(options.body?{body:JSON.parse(options.body)}:{})})
   if(options.method==='POST')return new Response(null,{status:204})
   if(url.endsWith('/git/ref/heads/main'))return Response.json({object:{sha:source}})
   if(url.endsWith('/actions/workflows/assistant-quality-repair.yml'))return Response.json({id:416905856,path:run.path,state:'active'})
   if(url.includes('/contents/'))return Response.json({type:'file',path:run.path,encoding:'base64',size:bytes.length,
    sha:createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),content:bytes.toString('base64')})
   if(url.endsWith('/actions/runs/721'))return Response.json(run)
   assert.fail('Unexpected recovery fixture endpoint')
  }})
 const environment={GITHUB_REPOSITORY:'profitia/SG-dev',GITHUB_REF:'refs/heads/main',GITHUB_SHA:source,GITHUB_RUN_ID:'721',
  GITHUB_RUN_ATTEMPT:'1',GITHUB_WORKFLOW_REF:'profitia/SG-dev/.github/workflows/assistant-quality-repair.yml@refs/heads/main',
  GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_ACTOR:'profitia',GITHUB_TRIGGERING_ACTOR:'profitia',
  RUNNER_ENVIRONMENT:'github-hosted',RUNNER_OS:'Linux',GITHUB_EVENT_PATH:file}
 const load=async(changes={})=>{
  const nativeInvocation=await client.controllerJobInvocation({externalId,runId:'721'})
  return readQualityRecoveryJobContext({...f.options,record,inputs,jobStateEnabled:true,nativeInvocation,nativeEnvironment:environment,...changes})
 }
 return {...f,record,inputs,externalId,action,client,calls,run,environment,fs,file,load,cleanup:()=>fs.rmSync(directory,{recursive:true,force:true})}
}
test('all three free recovery phases carry eight fields or ten declared defaults and admit actual current native event metadata',async()=>{
 const {assertQualityRecoveryNativeState}=await import('../src/recovery.mjs')
 for(const action of ['VERIFY_RUNTIME','OBSERVE','ROLLBACK']){
  const f=await nativeRecoveryFixture(action)
  try{
   assert.equal(Object.keys(f.inputs).length,8);assert.equal(Object.hasOwn(f.inputs,'recovery_sha256'),false)
   assert.equal(Object.keys({...f.inputs,permit_id:'',permit_expires_at:''}).length,10)
   const context=await f.load()
   assert.equal(context.jobState.providerIdentityVerified,true);assert.equal(context.jobState.authorityIncluded,false)
   assert.equal(context.jobState.runId,'721');assert.deepEqual(context.jobState.record,f.record)
   assert.equal(assertQualityRecoveryNativeState(context.jobState,{authority:context.authority,externalId:f.externalId,now:f.now}),context.jobState)
   assert.throws(()=>assertQualityRecoveryNativeState(clone(context.jobState),{authority:context.authority,externalId:f.externalId,now:f.now}),{code:'RECOVERY_NATIVE_STATE_REQUIRED'})
   assert.throws(()=>assertVerifiedRepairManifest(context.authority.manifest),{code:'VERIFIED_MANIFEST_REQUIRED'})
   const original=await prepareQualityControllerJobContext({...f.options,now:f.originalAt})
   const {assertQualityNativeJobState}=await import('../src/job-state.mjs')
   assert.throws(()=>assertQualityNativeJobState(context.jobState,{manifest:original.manifest,externalId:f.externalId}),
    {code:'JOB_STATE_NATIVE_INVOCATION_REQUIRED'})
   assert(f.calls.every(c=>c.method==='GET'))
  }finally{f.cleanup()}
 }
})
test('new recovery transport remains explicit and the old eight-field API and decoder remain unchanged by default',async()=>{
 const f=await nativeRecoveryFixture()
 try{
  const legacy=qualityRecoveryJobInputs({authority:f.authority,record:f.record,action:f.action,externalId:f.externalId,now:f.now})
  assert.equal(Object.keys(legacy).length,8);assert.equal(Object.hasOwn(legacy,'state'),false);assert.equal(legacy.recovery_sha256,f.authority.recoverySha256)
  const old=await readQualityRecoveryJobContext({...f.options,record:f.record,inputs:legacy})
  assert.equal(Object.hasOwn(old,'jobState'),false)
  await assert.rejects(readQualityRecoveryJobContext({...f.options,record:f.record,inputs:f.inputs}),{code:'RECOVERY_JOB_INPUT_INVALID'})
  for(const value of ['true',1,null])
   assert.throws(()=>qualityRecoveryJobInputs({authority:f.authority,record:f.record,action:f.action,externalId:f.externalId,jobStateEnabled:value,now:f.now}),
    {code:'RECOVERY_JOB_INPUT_INVALID'})
 }finally{f.cleanup()}
})
test('recovery wrapper rejects a changed mandate digest release pending intent raw QA or noncanonical state before accepting native identity',async()=>{
 const f=await nativeRecoveryFixture()
 try{
  for(const change of [b=>b.recoverySha256='0'.repeat(64),b=>b.manifestSha256='0'.repeat(64),
   b=>b.controlSourceSha='0'.repeat(40),b=>b.record.release.deployId='dep-cccccccccccccccccccc',
   b=>b.record.pending.nonce=randomUUID(),b=>b.record.pending.action='PROMOTE',b=>b.record.rawQa='FORBIDDEN',
   b=>b.extra='FORBIDDEN']){
   const body=JSON.parse(f.inputs.state);change(body);const inputs={...f.inputs,state:JSON.stringify(body)}
   await assert.rejects(f.load({inputs}))
  }
  await assert.rejects(f.load({inputs:{...f.inputs,state:' '+f.inputs.state}}),{code:'RECOVERY_JOB_INPUT_INVALID'})
  await assert.rejects(f.load({record:{...f.record,revision:f.record.revision+1}}),{code:'RECOVERY_JOB_INPUT_INVALID'})
 }finally{f.cleanup()}
})
test('fresh recovery state cannot borrow a pre-authority native run changed actual event or forged provider capability',async()=>{
 const old=await nativeRecoveryFixture()
 try{old.run.created_at=stamp(old.now-2000);await assert.rejects(old.load(),{code:'JOB_STATE_NATIVE_INVOCATION_REQUIRED'})}finally{old.cleanup()}
 const f=await nativeRecoveryFixture()
 try{
  for(const inputs of [{...f.inputs,permit_id:'forbidden'},{...f.inputs,recovery_sha256:''},
   {...f.inputs,base_sha:'0'.repeat(40)}]){
   f.fs.writeFileSync(f.file,JSON.stringify({inputs}))
   await assert.rejects(f.load(),{code:'JOB_STATE_NATIVE_INVOCATION_REQUIRED'})
  }
  f.fs.writeFileSync(f.file,JSON.stringify({inputs:f.inputs}))
  await assert.rejects(f.load({nativeInvocation:{}}),{code:'CONTROLLER_JOB_INVOCATION_REQUIRED'})
 }finally{f.cleanup()}
})
test('only an already committed one-rollback intent can be encoded and operational authority still expires independently',async()=>{
 const {assertQualityRecoveryNativeState}=await import('../src/recovery.mjs'),f=await nativeRecoveryFixture('ROLLBACK')
 try{
  for(const changed of [{...f.record,rollbacksUsed:0},{...f.record,rollbackRequired:false},{...f.record,pending:null}]){
   assert.throws(()=>qualityRecoveryJobInputs({authority:f.authority,record:changed,action:f.action,externalId:f.externalId,jobStateEnabled:true,now:f.now}))
  }
  const context=await f.load()
  assert.throws(()=>assertQualityRecoveryNativeState(context.jobState,{authority:context.authority,externalId:f.externalId,now:Date.parse(f.body.expiresAt)}),
   {code:'RECOVERY_AUTHORITY_EXPIRED'})
  assert.throws(()=>assertQualityRecoveryNativeState(context.jobState,{authority:context.authority,externalId:f.externalId,now:f.now+1800001}),
   {code:'RECOVERY_NATIVE_STATE_EXPIRED'})
 }finally{f.cleanup()}
})
test('explicit recovery state action port posts one bounded state while default action port retains legacy metadata',async()=>{
 const {createQualityOperationalRecoveryActions}=await import('../src/recovery.mjs')
 for(const enabled of [false,true]){
  const f=await nativeRecoveryFixture('VERIFY_RUNTIME',{recoveryJobsEnabled:true})
  try{
   const supervisor=generateKeyPairSync('ed25519'),keysByRole=new Map([['EXECUTOR_SUPERVISOR',keyMap(supervisor)],
    ['INDEPENDENT_VERIFIER',keyMap(f.exporter)],['INDEPENDENT_PUBLISHER',keyMap(f.publisher)]])
   const actions=createQualityOperationalRecoveryActions({github:f.client,keysByRole,jobStateEnabled:enabled,now:()=>f.now})
   await actions.dispatch(f.action,{record:f.record,intent:f.record.pending,authority:f.authority})
   const posts=f.calls.filter(c=>c.method==='POST');assert.equal(posts.length,1)
   const inputs=posts[0].body.inputs;assert.equal(Object.keys(inputs).length,8)
   assert.equal(Object.hasOwn(inputs,'state'),enabled);assert.equal(Object.hasOwn(inputs,'recovery_sha256'),!enabled)
  }finally{f.cleanup()}
 }
})

test('native recovery without a second record still needs the exact independent historical publication proof',async()=>{
 const f=await nativeRecoveryFixture()
 try{
  const context=await f.load({record:undefined})
  assert.equal(context.jobState.record.release.deployId,f.record.release.deployId)
  const body=JSON.parse(f.inputs.state);body.record.release.deployId='dep-cccccccccccccccccccc'
  const inputs={...f.inputs,state:JSON.stringify(body)}
  await assert.rejects(f.load({inputs,record:body.record}),{code:'RECOVERY_PUBLISHED_RELEASE_REQUIRED'})
  assert(f.calls.every(c=>c.method==='GET'))
 }finally{f.cleanup()}
})
