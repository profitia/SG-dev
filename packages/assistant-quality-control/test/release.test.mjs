import test from 'node:test'
import assert from 'node:assert/strict'
import {createQualityRelease,createQualityRuntimeProbeVerifier,createQualityAttestedRelease} from '../src/release.mjs'
import {generateKeyPairSync,randomUUID} from 'node:crypto'
import {signDocument,publicKeyId} from '../src/manifest.mjs'
import {createQualityGitHub,createQualityAttestedPublisher} from '../src/github.mjs'
const sha='a'.repeat(40),old='b'.repeat(40),digest='c'.repeat(64)
const oldId='dep-aaaaaaaaaaaaaaaaaaaa',newId='dep-bbbbbbbbbbbbbbbbbbbb',foreignId='dep-cccccccccccccccccccc'
const live=(id=oldId,source=old,status='live')=>({id,status,commit:{id:source}})
const service={id:'srv-dapa3tid0e5s73f8bc5g',ownerId:'tea-d7lps8rbc2fs73cn80dg',type:'web_service',branch:'main',
 repo:'https://github.com/profitia/SG-dev',autoDeploy:'no',environmentId:'evm-dap98hm0tbcc738rro10',serviceDetails:{url:'https://sg2-development-runtime.onrender.com'}}
const proof=async({sourceSha})=>({verified:true,sourceSha,proofSha256:digest,configurationSha256:digest})
function fixture({enabled=true,runtime=proof}={}){
 const calls=[];let current=live(),behavior=null
 const fetchImpl=async(url,options)=>{
  calls.push({url,options})
  if(behavior)return behavior(url,options)
  const suffix=url.split('srv-dapa3tid0e5s73f8bc5g')[1]
  const body=suffix===''?service:suffix==='/deploys?limit=20'?[{deploy:current}]:
   suffix==='/deploys/'+oldId?live(oldId,old,'deactivated'):
   suffix==='/deploys/'+newId?live(newId,sha):
   options.method==='POST'&&suffix==='/deploys'?live(newId,sha,'created'):
   options.method==='POST'&&suffix==='/rollback'?live(foreignId,old,'created'):null
  return new Response(JSON.stringify(body),{status:200})
 }
 const client=createQualityRelease({token:'synthetic',fetchImpl,promotionEnabled:enabled,verifyRuntime:runtime})
 return {client,calls,setCurrent:v=>{current=v},setBehavior:v=>{behavior=v}}
}
const deployOptions=()=>({sourceSha:sha,expectedDeployId:oldId,lkg:{deployId:oldId,sourceSha:old},verifyIndependent:proof})
test('all public mutations refuse before HTTP under the default disabled controls',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;throw Error('must not request')}
 const g=createQualityGitHub({token:'synthetic',fetchImpl})
 const r=createQualityRelease({token:'synthetic',fetchImpl,verifyRuntime:proof})
 for(const operation of [()=>g.propose({}),()=>g.merge({}),()=>r.deploy({}),()=>r.rollback({})])
  await assert.rejects(operation,{code:/^(PUBLISHER_DISABLED|PROMOTION_DISABLED)$/})
 assert.equal(calls,0)
})
test('release requires independent exact-source proof before reading providers',async()=>{
 const f=fixture();await assert.rejects(()=>f.client.deploy({...deployOptions(),verifyIndependent:async()=>({verified:true,sourceSha:old})}),{code:'INDEPENDENT_RELEASE_PROOF_REQUIRED'})
 assert.equal(f.calls.length,0)
})
test('one admitted exact-SHA deploy preserves LKG and awaits runtime verification',async()=>{
 const f=fixture(),r=await f.client.deploy(deployOptions())
 assert.equal(r.state,'RUNNING');assert.equal(r.lastKnownGoodSha,old)
 const posts=f.calls.filter(c=>c.options.method==='POST');assert.equal(posts.length,1)
 assert.deepEqual(JSON.parse(posts[0].options.body),{commitId:sha,clearCache:'do_not_clear'})
 assert.equal(posts[0].options.redirect,'error')
})
test('foreign live or in-progress deployment stops a release before mutation',async()=>{
 for(const current of [live(foreignId,'d'.repeat(40)),live(foreignId,sha,'build_in_progress')]){
  const f=fixture();f.setCurrent(current)
  await assert.rejects(()=>f.client.deploy(deployOptions()),{code:'FOREIGN_DEPLOYMENT'})
  assert.equal(f.calls.some(c=>c.options.method==='POST'),false)
 }
})
test('failed LKG runtime identity cannot be relabelled as safe',async()=>{
 const f=fixture({runtime:async()=>({verified:true,sourceSha:sha})})
 await assert.rejects(()=>f.client.deploy(deployOptions()),{code:'LAST_KNOWN_GOOD_UNVERIFIED'})
 assert.equal(f.calls.some(c=>c.options.method==='POST'),false)
})
test('wrong target, workspace or automatic deploy gate blocks before POST',async()=>{
 for(const mutate of [s=>{s.ownerId='foreign'},s=>{s.autoDeploy='yes'},s=>{s.serviceDetails.url='https://other.test'}]){
  const f=fixture();f.setBehavior(async()=>{const s=structuredClone(service);mutate(s);return Response.json(s)})
  await assert.rejects(()=>f.client.deploy(deployOptions()))
  assert.equal(f.calls.some(c=>c.options.method==='POST'),false)
 }
})
test('uncertain deploy delivery is never automatically repeated',async()=>{
 const f=fixture(),original=f.client
 let posts=0
 // Reuse the real descriptor/GET fixture, fail only the single mutation.
 const fetchImpl=async(url,o)=>{
  if(o.method==='POST'){posts++;throw Error('connection lost after send')}
  return Response.json(url.endsWith('/deploys?limit=20')?[{deploy:live()}]:service)
 }
 const c=createQualityRelease({token:'synthetic',promotionEnabled:true,fetchImpl,verifyRuntime:proof})
 await assert.rejects(()=>c.deploy(deployOptions()),{code:'DELIVERY_UNCERTAIN'})
 assert.equal(posts,1)
})
test('provider live status alone does not prove an exact running application',async()=>{
 const f=fixture({runtime:async()=>({verified:false})});f.setCurrent(live(newId,sha))
 const r=await f.client.reconcile({deployId:newId,sourceSha:sha,lastKnownGoodSha:old,artifactSha256:digest,configurationSha256:digest})
 assert.equal(r.state,'UNKNOWN')
})
test('exact runtime proof closes technical release while preserving independent hashes',async()=>{
 const f=fixture();f.setCurrent(live(newId,sha))
 const r=await f.client.reconcile({deployId:newId,sourceSha:sha,lastKnownGoodSha:old,artifactSha256:digest,configurationSha256:digest})
 assert.equal(r.result.result,'RELEASED');assert.equal(r.result.exactRuntimeVerified,true)
 assert.equal(r.result.artifactSha256,digest)
})
test('rollback refuses a newer foreign live deployment and never mutates databases',async()=>{
 const f=fixture();f.setCurrent(live(foreignId,'d'.repeat(40)))
 const r=await f.client.rollback({release:{deployId:newId,sourceSha:sha,lastKnownGoodDeployId:oldId,lastKnownGoodSha:old},verifyIndependent:proof})
 assert.equal(r.result,'FOREIGN_DEPLOYMENT');assert.equal(f.calls.some(c=>c.options.method==='POST'),false)
 assert(f.calls.every(c=>c.url.startsWith('https://api.render.com/v1/services/'+service.id)))
})
test('own rollback selects only the retained LKG provider deployment',async()=>{
 const f=fixture();f.setCurrent(live(newId,sha))
 const r=await f.client.rollback({release:{deployId:newId,sourceSha:sha,lastKnownGoodDeployId:oldId,lastKnownGoodSha:old},verifyIndependent:proof})
 assert.equal(r.state,'RUNNING');assert.equal(r.sourceSha,old)
 assert.deepEqual(JSON.parse(f.calls.at(-1).options.body),{deployId:oldId})
})
test('GitHub checks require exact SHA, GitHub Actions and every required successful name',async()=>{
 for(const variant of ['success','missing','foreign','failure','pending']){
  const c={id:1,name:'required',head_sha:sha,status:'completed',conclusion:'success',app:{slug:'github-actions'}}
  if(variant==='foreign')c.app.slug='foreign';if(variant==='failure')c.conclusion='failure';if(variant==='pending')c.status='in_progress'
  const g=createQualityGitHub({token:'synthetic',fetchImpl:async()=>Response.json({check_runs:variant==='missing'?[]:[c],total_count:variant==='missing'?0:1})})
  const r=await g.checks(sha,['required'])
  assert.equal(r.result,variant==='success'?'PASS':variant==='failure'?'FAIL':'WAIT')
 }
})
test('GitHub does not silently reuse historical authentication failure or follow credential redirects',async()=>{
 let options
 const g=createQualityGitHub({token:'synthetic',fetchImpl:async(_url,o)=>{options=o;return new Response('{}',{status:401})}})
 await assert.rejects(()=>g.main(),{code:'AUTHENTICATION_REJECTED'});assert.equal(options.redirect,'error')
})
test('GitHub publisher verifies internal owner, repository, base and head',async()=>{
 const p={number:3,state:'open',head:{repo:{full_name:'foreign/repo'},sha},base:{repo:{full_name:'profitia/SG-dev'},ref:'main',sha:old},user:{login:'profitia'}}
 const g=createQualityGitHub({token:'synthetic',fetchImpl:async()=>Response.json(p)})
 await assert.rejects(()=>g.pull(3,{headSha:sha,baseSha:old}),{code:'GITHUB_PR_IDENTITY_INVALID'})
})

const qualificationNonce='12345678-1234-4234-8234-123456789abc'
const qualificationRun=(extra={})=>({id:42,head_sha:sha,head_branch:'main',path:'.github/workflows/assistant-quality-repair.yml',event:'workflow_dispatch',run_attempt:1,
 repository:{full_name:'profitia/SG-dev'},actor:{login:'profitia'},triggering_actor:{login:'profitia'},display_title:'AQC '+qualificationNonce,status:'in_progress',conclusion:null,...extra})
test('qualification dispatch selects only exact current main and posts once without inventing a run ID',async()=>{
 const calls=[];const g=createQualityGitHub({token:'synthetic',fetchImpl:async(url,o)=>{
  calls.push({url,o});return o.method==='POST'?new Response(null,{status:204}):Response.json({object:{sha}})
 }})
 assert.deepEqual(await g.dispatchQualification({sourceSha:sha,nonce:qualificationNonce}),{state:'UNKNOWN',sourceSha:sha,nonce:qualificationNonce})
 const p=calls.filter(x=>x.o.method==='POST');assert.equal(p.length,1);assert(p[0].url.endsWith('/actions/workflows/assistant-quality-repair.yml/dispatches'))
 assert.deepEqual(JSON.parse(p[0].o.body),{ref:'main',inputs:{mode:'keyless-qualify',nonce:qualificationNonce}})
})
test('qualification stale base and malformed nonce never dispatch; uncertain POST is not retried',async()=>{
 let posts=0
 const fetchImpl=async(_url,o)=>{if(o.method==='POST'){posts++;throw Error('lost response')}return Response.json({object:{sha}})}
 const g=createQualityGitHub({token:'synthetic',fetchImpl})
 await assert.rejects(g.dispatchQualification({sourceSha:old,nonce:qualificationNonce}),{code:'BASE_CHANGED'})
 await assert.rejects(g.dispatchQualification({sourceSha:sha,nonce:'invalid'}),{code:'GITHUB_INPUT_INVALID'});assert.equal(posts,0)
 await assert.rejects(g.dispatchQualification({sourceSha:sha,nonce:qualificationNonce}),{code:'DELIVERY_UNCERTAIN'});assert.equal(posts,1)
})
test('cancellation checks the real run identity and distinguishes accepted cancellation from stopped executor',async()=>{
 for(const status of ['in_progress','completed']){
  let posts=0;const g=createQualityGitHub({token:'synthetic',fetchImpl:async(url,o)=>{
   if(o.method==='POST'){posts++;assert(url.endsWith('/actions/runs/42/cancel'));return new Response(null,{status:202})}
   return Response.json(qualificationRun({status,conclusion:status==='completed'?'cancelled':null}))
  }})
  const r=await g.cancelQualification({runId:'42',sourceSha:sha,nonce:qualificationNonce})
  assert.equal(r.state,status==='completed'?'COMPLETE':'CANCEL_REQUESTED');assert.equal(posts,status==='completed'?0:1)
  assert.notEqual(r.state,'CONFIRMED_STOPPED');assert.equal(r.effects,undefined)
 }
 for(const drift of [{head_sha:old},{run_attempt:2},{actor:{login:'other'}},{head_branch:'foreign'},{display_title:'AQC different'}]){
  let posts=0;const g=createQualityGitHub({token:'synthetic',fetchImpl:async(_url,o)=>{if(o.method==='POST')posts++;return Response.json(qualificationRun(drift))}})
  await assert.rejects(g.cancelQualification({runId:'42',sourceSha:sha,nonce:qualificationNonce}),{code:'WORKFLOW_PROVENANCE_MISMATCH'});assert.equal(posts,0)
 }
})
test('lost dispatch response is reconciled by immutable source and nonce without another POST',async()=>{
 let posts=0,found=false;const g=createQualityGitHub({token:'synthetic',fetchImpl:async(url,o)=>{
  if(o.method==='POST'){posts++;found=true;throw Error('response lost')}
  if(url.includes('/git/ref/'))return Response.json({object:{sha}})
  return Response.json({workflow_runs:found?[qualificationRun()]:[]})
 }})
 await assert.rejects(g.dispatchQualification({sourceSha:sha,nonce:qualificationNonce}),{code:'DELIVERY_UNCERTAIN'})
 assert.deepEqual(await g.findQualification({sourceSha:sha,nonce:qualificationNonce}),{state:'RUNNING',runId:'42',conclusion:null});assert.equal(posts,1)
})

test('Independent publisher runtime adapter binds actual service/SHA/deployment, durable nonce and fresh signed E1/answer metadata',async()=>{
 const key=generateKeyPairSync('ed25519'),keys=new Map([[publicKeyId(key.publicKey),key.publicKey]]),nonce=randomUUID()
 const now=Date.parse('2026-11-17T18:00:00.000Z'),stamp=n=>new Date(n).toISOString(),requested={serviceId:service.id,sourceSha:sha,deployId:newId}
 const body={schemaVersion:'AQC_RUNTIME_PROBE_V1',applicationId:'spendguru',environment:'development',...requested,nonce,
  observedAt:stamp(now-1000),expiresAt:stamp(now+10000),canonicalE1Verified:true,answerVerified:true,sourceBindingVerified:true,
  rawQaPayloadIncluded:false,proofInputsSha256:digest}
 const sign=b=>signDocument('AQC_RUNTIME_PROBE_V1',b,key.privateKey)
 let reads=0
 const make=document=>createQualityRuntimeProbeVerifier({keys,nonce,notBefore:stamp(now-5000),now:()=>now,readReceipt:async expected=>{
  reads++;assert.deepEqual(expected,{...requested,nonce});return document
 }})
 const valid=await make(sign(body))(requested);assert.equal(valid.verified,true);assert.equal(valid.sourceSha,sha);assert.match(valid.proofSha256,/^[a-f0-9]{64}$/);assert.equal(reads,1)
 for(const change of [{serviceId:'srv-foreign'},{sourceSha:old},{deployId:oldId},{nonce:randomUUID()},{environment:'production'},
  {applicationId:'foreign'},{observedAt:stamp(now+1)},{observedAt:stamp(now-6000)},{expiresAt:stamp(now)},{expiresAt:stamp(now+60000)},
  {canonicalE1Verified:false},{answerVerified:false},{sourceBindingVerified:false},{rawQaPayloadIncluded:true},
  {proofInputsSha256:'invalid'},{rawConversation:'synthetic forbidden extra field'}])
  await assert.rejects(make(sign({...body,...change}))(requested))
 const forged=structuredClone(sign(body));forged.body.sourceSha=old;await assert.rejects(make(forged)(requested))
 await assert.rejects(make({verified:true,...requested})(requested))
 assert.deepEqual(await make(null)(requested),{verified:false,sourceSha:sha,deployId:newId})
 const before=reads;await assert.rejects(make(sign(body))({...requested,serviceId:'srv-foreign'}),{code:'RUNTIME_PROBE_TARGET_INVALID'});assert.equal(reads,before)
 const other=generateKeyPairSync('ed25519'),later=make(signDocument('AQC_RUNTIME_PROBE_V1',body,other.privateKey))
 keys.set(publicKeyId(other.publicKey),other.publicKey)
 await assert.rejects(later(requested));keys.delete(publicKeyId(other.publicKey))
 assert.throws(()=>createQualityRuntimeProbeVerifier({keys:new Map(),nonce,notBefore:stamp(now-5000),readReceipt:async()=>sign(body)}),{code:'RUNTIME_VERIFIER_CONFIGURATION_REQUIRED'})
})
test('Independent publisher composition refuses a substituted self-grade and stays mutation-disabled before provider access',async()=>{
 const key=generateKeyPairSync('ed25519'),keys=new Map([[publicKeyId(key.publicKey),key.publicKey]]);let calls=0,reads=0
 const runtimeEvidence={keys,nonce:randomUUID(),notBefore:'2026-11-17T00:00:00.000Z',readReceipt:async()=>{reads++;return null}}
 const options={token:'synthetic',fetchImpl:async()=>{calls++;throw Error('forbidden')},runtimeEvidence}
 assert.throws(()=>createQualityAttestedRelease({...options,verifyRuntime:async()=>({verified:true})}),{code:'RUNTIME_VERIFIER_CONFIGURATION_REQUIRED'})
 const client=createQualityAttestedRelease(options)
 await assert.rejects(client.deploy({}),{code:'PROMOTION_DISABLED'});await assert.rejects(client.rollback({}),{code:'PROMOTION_DISABLED'})
 assert.equal(calls,0);assert.equal(reads,0)
})


async function publicationFixture({enabled=true,promote=true}={}){
 const {documentDigest,verifyBoundManifest}=await import('../src/manifest.mjs')
 const {ownerMandateBody,repairManifestBody}=await import('../src/cli.mjs')
 const {serializeRegression}=await import('../src/verify.mjs')
 const {createHash}=await import('node:crypto')
 const owner=generateKeyPairSync('ed25519'),verifier=generateKeyPairSync('ed25519'),keyMap=new Map([[publicKeyId(verifier.publicKey),verifier.publicKey]])
 const origin=Date.parse('2026-11-17T18:00:00.000Z'),stamp=v=>new Date(v).toISOString(),state={clock:origin,reads:0,document:null,drift:null,protection:{required_status_checks:{strict:true,contexts:['required','independent']}}}
 const nonce=randomUUID(),names=['required','independent'],installed=[...names],gate='d'.repeat(64),incidentId=randomUUID()
 const mandate=signDocument('AQC_EXECUTION_MANDATE_V1',ownerMandateBody({id:randomUUID(),issuedAt:stamp(origin-1000),expiresAt:stamp(origin+300000),targetServiceId:service.id,gateSetSha256:gate}),owner.privateKey)
 const regression={schemaVersion:'AQC_REGRESSION_V1',repairClass:'C1',caseFamily:'publisher_unit_fixture',locale:'en',args:[1],expected:2,expectedAnswer:true,refusal:{pointer:'',values:[null]}}
 const body=repairManifestBody({mandate,incidentId,correlationId:randomUUID(),baseSha:old,repairClass:'C1',exportReceiptId:randomUUID(),fixtureSha256:documentDigest(regression)})
 const exported=signDocument('AQC_SYNTHETIC_EXPORT_V1',{id:body.synthetic.exportReceiptId,fixtureId:body.synthetic.fixtureId,sha256:body.synthetic.sha256,scope:'CONTROLLED_ACCEPTANCE',incidentId,repairClass:'C1',issuedAt:stamp(origin-1000),expiresAt:stamp(origin+300000),rawQaPayloadIncluded:false},verifier.privateKey)
 const manifest=verifyBoundManifest(body,{mandate,fixtureExport:exported,ownerKeys:new Map([[publicKeyId(owner.publicKey),owner.publicKey]]),verifierKeys:keyMap,now:origin,expectedBaseSha:old,expectedServiceId:service.id,expectedGateSetSha256:gate})
 const content='export function controlledFixture(v:number){return v+1}\n',regressionSource=serializeRegression(regression),hash=v=>createHash('sha256').update(v).digest('hex')
 const patch={schemaVersion:'AQC_PATCH_V1',incidentId,baseSha:old,gateSetSha256:gate,manifestSha256:documentDigest(manifest),files:[
  {path:manifest.allowedPaths[0],beforeSha256:'e'.repeat(64),afterSha256:hash(content),content},
  {path:manifest.allowedPaths[1],beforeSha256:null,afterSha256:hash(regressionSource),content:regressionSource}]}
 const verification={result:'PASS',artifactSha256:documentDigest(patch),proofSha256:'f'.repeat(64)},calls=[],requests=[]
 const pr=()=>({number:43,state:'open',head:{repo:{full_name:'profitia/SG-dev'},ref:'sg2/quality-control-'+incidentId,sha},base:{repo:{full_name:'profitia/SG-dev'},ref:'main',sha:old},user:{login:'profitia'}})
 const fetchImpl=async(url,options)=>{
  calls.push({url,options});if(state.drift)await state.drift(url,options)
  const suffix=url.slice('https://api.github.com/repos/profitia/SG-dev'.length)
  if(suffix==='/git/ref/heads/main')return Response.json({object:{sha:old}})
  if(suffix==='/git/commits/'+old)return Response.json({tree:{sha:'d'.repeat(40)}})
  if(suffix==='/git/blobs')return Response.json({sha:'e'.repeat(40)})
  if(suffix==='/git/trees')return Response.json({sha:'f'.repeat(40)})
  if(suffix==='/git/commits')return Response.json({sha,tree:{sha:'f'.repeat(40)}})
  if(suffix==='/git/refs')return Response.json({})
  if(suffix==='/pulls')return Response.json({number:43,head:{sha}})
  if(suffix==='/pulls/43')return Response.json(state.pr??pr())
  if(suffix==='/branches/main/protection')return Response.json(state.protection)
  if(suffix.startsWith('/commits/'+sha+'/check-runs?'))return Response.json({check_runs:installed.map((name,i)=>({id:i+1,name,head_sha:sha,status:'completed',conclusion:'success',app:{slug:'github-actions'}})),total_count:installed.length})
  if(suffix==='/pulls/43/merge')return Response.json({merged:true,sha:'f'.repeat(40)})
  throw Error('Unexpected synthetic provider request')
 }
 const document=(expected,change={},key=verifier.privateKey)=>signDocument('AQC_PUBLISH_PROOF_V1',{...expected,observedAt:stamp(origin-1000),expiresAt:stamp(origin+10000),...change},key)
 const evidence={keys:keyMap,nonce,notBefore:stamp(origin-5000),now:()=>state.clock,readReceipt:async expected=>{
  state.reads++;requests.push(expected);return typeof state.document==='function'?state.document(expected):state.document??document(expected)
 }}
 const client=createQualityAttestedPublisher({token:'synthetic',publisherEnabled:enabled,promotionEnabled:promote,fetchImpl,proofEvidence:evidence,requiredNames:names})
 return {client,state,calls,requests,manifest,patch,verification,names,installed,keyMap,document,evidence,origin,stamp,pr,verifier,documentDigest,
  proposal:()=>({manifest,patch,verification}),merge:()=>({manifest,patch,verification,prNumber:43,headSha:sha})}
}

test('attested GitHub publisher requires a fresh signed independent proof and rechecks it before visible publication',async()=>{
 const f=await publicationFixture(),result=await f.client.propose(f.proposal())
 assert.equal(result.result,'PR_READY');assert.equal(result.prNumber,43);assert.equal(result.headSha,sha)
 assert.equal(result.artifactSha256,f.verification.artifactSha256);assert.equal(f.state.reads,3)
 for(const request of f.requests){
  assert.equal(request.action,'PROPOSE');assert.equal(request.prNumber,null);assert.equal(request.headSha,null)
  assert.equal(request.rawQaPayloadIncluded,false);assert.equal(request.requiredChecksSha256,f.documentDigest(f.installed))
  assert.equal(request.manifestSha256,f.documentDigest(f.manifest));assert.equal(Object.hasOwn(request,'patch'),false)
 }
 assert.equal(f.calls.filter(c=>c.url.endsWith('/git/refs')).length,1)
 assert.equal(f.calls.filter(c=>c.url.endsWith('/pulls')).length,1)
})
test('attested publisher refuses every wrong signed source, action, nonce, scope, verdict or undeclared private field before HTTP',async()=>{
 const changes=[
  {action:'MERGE'},{incidentId:randomUUID()},{repairClass:'C2'},{baseSha:sha},{manifestSha256:'0'.repeat(64)},
  {gateSetSha256:'0'.repeat(64)},{artifactSha256:'0'.repeat(64)},{verificationProofSha256:'0'.repeat(64)},
  {nonce:randomUUID()},{requiredChecksSha256:'0'.repeat(64)},{repository:'profitia/foreign'},{environment:'production'},
  {applicationId:'foreign'},{result:'FAIL'},{rawQaPayloadIncluded:true},{prNumber:43},{headSha:sha},{rawConversation:'forbidden synthetic extra'}]
 for(const change of changes){
  const f=await publicationFixture();f.state.document=expected=>f.document(expected,change)
  await assert.rejects(f.client.propose(f.proposal()));assert.equal(f.calls.length,0,JSON.stringify(change))
 }
})
test('attested publisher cannot trust unsigned self-grades, caller overrides or a key added after installation',async()=>{
 const f=await publicationFixture()
 for(const input of [{...f.proposal(),verifyIndependent:async()=>({verified:true})},{...f.proposal(),requiredNames:['weaker']},{...f.proposal(),verifyProof:()=>true}])
  await assert.rejects(f.client.propose(input),{code:'PUBLISHER_CALLER_OVERRIDE_REJECTED'})
 f.state.document={verified:true,result:'PASS'};await assert.rejects(f.client.propose(f.proposal()))
 const attacker=generateKeyPairSync('ed25519');f.keyMap.set(publicKeyId(attacker.publicKey),attacker.publicKey)
 f.state.document=expected=>f.document(expected,{},attacker.privateKey)
 await assert.rejects(f.client.propose(f.proposal()),{code:'SIGNER_UNKNOWN'})
 assert.equal(f.calls.length,0)
})
test('publisher proof expiry and unverified cloned manifests fail before provider access',async()=>{
 for(const change of [{observedAt:'2026-11-17T18:00:00.001Z'},{observedAt:'2026-11-17T17:59:54.000Z'},{expiresAt:'2026-11-17T18:00:00.000Z'},{expiresAt:'2026-11-17T18:01:00.000Z'}]){
  const f=await publicationFixture();f.state.document=expected=>f.document(expected,change)
  await assert.rejects(f.client.propose(f.proposal()),{code:'PUBLISHER_PROOF_STALE'});assert.equal(f.calls.length,0)
 }
 const f=await publicationFixture()
 await assert.rejects(f.client.propose({...f.proposal(),manifest:structuredClone(f.manifest)}),{code:'VERIFIED_MANIFEST_REQUIRED'})
 assert.equal(f.calls.length,0)
})
test('publisher rereads the clock after independent receipt transport and rejects authority expiry during it',async()=>{
 const f=await publicationFixture()
 f.state.document=expected=>{f.state.clock+=5;return f.document(expected,{observedAt:f.stamp(f.state.clock-1),expiresAt:f.stamp(f.state.clock+10000)})}
 assert.equal((await f.client.propose(f.proposal())).result,'PR_READY')
 const expired=await publicationFixture()
 expired.state.document=expected=>{expired.state.clock+=300001;return expired.document(expected)}
 await assert.rejects(expired.client.propose(expired.proposal()),{code:'PUBLISHER_AUTHORITY_EXPIRED'})
 assert.equal(expired.calls.length,0)
})
test('publication stops before branch creation if its independent proof expires during Git object preparation',async()=>{
 const f=await publicationFixture()
 f.state.drift=async url=>{if(url.endsWith('/git/commits'))f.state.clock+=11000}
 await assert.rejects(f.client.propose(f.proposal()),{code:'PUBLISHER_PROOF_STALE'})
 assert.equal(f.calls.some(c=>c.url.endsWith('/git/refs')||c.url.endsWith('/pulls')),false)
})
test('attested merge binds the owned incident branch and every installed CI check at the server',async()=>{
 const f=await publicationFixture();f.names.splice(0,f.names.length,'weaker')
 const result=await f.client.merge(f.merge());assert.equal(result.sourceSha,'f'.repeat(40));assert.equal(f.state.reads,2)
 assert.equal(f.calls.filter(c=>c.options.method==='PUT').length,1)
 for(const request of f.requests){assert.equal(request.action,'MERGE');assert.equal(request.headSha,sha);assert.equal(request.prNumber,43);assert.equal(request.requiredChecksSha256,f.documentDigest(f.installed))}
 for(const policy of [{strict:false,contexts:f.installed},{strict:true,contexts:['required']},{strict:true,contexts:[]} ]){
  const denied=await publicationFixture();denied.state.protection={required_status_checks:policy}
  await assert.rejects(denied.client.merge(denied.merge()));assert.equal(denied.calls.some(c=>c.options.method==='PUT'),false)
 }
 const throughChecks=await publicationFixture();throughChecks.state.protection={required_status_checks:{strict:true,checks:throughChecks.installed.map(context=>({context,app_id:15368}))}}
 assert((await throughChecks.client.merge(throughChecks.merge())).sourceSha)
})
test('attested merge cannot reuse proposal proof or promote a foreign branch and rechecks proof after CI reads',async()=>{
 for(const drift of ['proposal','foreign','expiry']){
  const f=await publicationFixture()
  if(drift==='proposal')f.state.document=expected=>f.document(expected,{action:'PROPOSE',prNumber:null,headSha:null})
  if(drift==='foreign')f.state.pr={...f.pr(),head:{...f.pr().head,ref:'sg2/another-owner'}}
  if(drift==='expiry')f.state.drift=async url=>{if(url.includes('/check-runs?'))f.state.clock+=11000}
  await assert.rejects(f.client.merge(f.merge()));assert.equal(f.calls.some(c=>c.options.method==='PUT'),false)
 }
})
test('independent publisher defaults remain disabled before receipt reads or HTTP',async()=>{
 const f=await publicationFixture({enabled:false,promote:false})
 await assert.rejects(f.client.propose({}),{code:'PUBLISHER_DISABLED'})
 await assert.rejects(f.client.merge({}),{code:'PROMOTION_DISABLED'})
 assert.equal(f.state.reads,0);assert.equal(f.calls.length,0)
 assert.throws(()=>createQualityAttestedPublisher({token:'synthetic',proofEvidence:f.evidence,requiredNames:[],verifyIndependent:()=>true}),{code:'PUBLISHER_VERIFIER_CONFIGURATION_REQUIRED'})
})
