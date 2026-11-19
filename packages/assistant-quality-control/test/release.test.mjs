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


async function publicationFixture({enabled=true,promote=true,validityMs=300000}={}){
 const {documentDigest,verifyBoundManifest}=await import('../src/manifest.mjs')
 const {ownerMandateBody,repairManifestBody}=await import('../src/cli.mjs')
 const {serializeRegression}=await import('../src/verify.mjs')
 const {createHash}=await import('node:crypto')
 const owner=generateKeyPairSync('ed25519'),verifier=generateKeyPairSync('ed25519'),keyMap=new Map([[publicKeyId(verifier.publicKey),verifier.publicKey]])
 const origin=Date.parse('2026-11-17T18:00:00.000Z'),stamp=v=>new Date(v).toISOString(),state={clock:origin,reads:0,document:null,drift:null,protection:{required_status_checks:{strict:true,contexts:['required','independent']}}}
 const nonce=randomUUID(),names=['required','independent'],installed=[...names],gate='d'.repeat(64),incidentId=randomUUID()
 const mandate=signDocument('AQC_EXECUTION_MANDATE_V1',ownerMandateBody({id:randomUUID(),issuedAt:stamp(origin-1000),expiresAt:stamp(origin+validityMs),targetServiceId:service.id,gateSetSha256:gate}),owner.privateKey)
 const regression={schemaVersion:'AQC_REGRESSION_V1',repairClass:'C1',caseFamily:'publisher_unit_fixture',locale:'en',args:[1],expected:2,expectedAnswer:true,refusal:{pointer:'',values:[null]}}
 const body=repairManifestBody({mandate,incidentId,correlationId:randomUUID(),baseSha:old,repairClass:'C1',exportReceiptId:randomUUID(),fixtureSha256:documentDigest(regression)})
 const exported=signDocument('AQC_SYNTHETIC_EXPORT_V1',{id:body.synthetic.exportReceiptId,fixtureId:body.synthetic.fixtureId,sha256:body.synthetic.sha256,scope:'CONTROLLED_ACCEPTANCE',incidentId,repairClass:'C1',issuedAt:stamp(origin-1000),expiresAt:stamp(origin+validityMs),rawQaPayloadIncluded:false},verifier.privateKey)
 const manifest=verifyBoundManifest(body,{mandate,fixtureExport:exported,ownerKeys:new Map([[publicKeyId(owner.publicKey),owner.publicKey]]),verifierKeys:keyMap,now:origin,expectedBaseSha:old,expectedServiceId:service.id,expectedGateSetSha256:gate})
 const beforeSource='export function controlledFixture(v:number){return v}\n',content='export function controlledFixture(v:number){return v+1}\n',regressionSource=serializeRegression(regression),hash=v=>createHash('sha256').update(v).digest('hex')
 const patch={schemaVersion:'AQC_PATCH_V1',incidentId,baseSha:old,gateSetSha256:gate,manifestSha256:documentDigest(manifest),files:[
  {path:manifest.allowedPaths[0],beforeSha256:hash(beforeSource),afterSha256:hash(content),content},
  {path:manifest.allowedPaths[1],beforeSha256:null,afterSha256:hash(regressionSource),content:regressionSource}]}
 const verification={result:'PASS',artifactSha256:documentDigest(patch),proofSha256:'f'.repeat(64)},calls=[],requests=[]
 const gitBlobs=new Map(),gitTrees=new Map()
 const addBlob=content=>{
  const bytes=Buffer.from(content),id=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex')
  gitBlobs.set(id,{sha:id,encoding:'base64',size:bytes.length,content:bytes.toString('base64')});return id
 }
 const buildTree=files=>{
  const root={}
  for(const [path,content]of files){const parts=path.split('/');let node=root
   for(const part of parts.slice(0,-1))node=node[part]??=(Object.create(null))
   node[parts.at(-1)]={content}
  }
  function visit(node){
   const tree=Object.entries(node).map(([path,value])=>Object.hasOwn(value,'content')
    ?{path,mode:'100644',type:'blob',sha:addBlob(value.content)}
    :{path,mode:'040000',type:'tree',sha:visit(value)})
   const id=createHash('sha1').update(JSON.stringify(tree)).digest('hex')
   gitTrees.set(id,{sha:id,truncated:false,tree});return id
  }
  return visit(root)
 }
 state.binding={baseTree:buildTree([[manifest.allowedPaths[0],beforeSource]]),
  headTree:buildTree(patch.files.map(f=>[f.path,f.content])),parents:[{sha:old}],
  files:patch.files.map(f=>({filename:f.path,status:f.path===manifest.allowedPaths[0]?'modified':'added',sha:addBlob(f.content)})),
  blobs:gitBlobs,trees:gitTrees}
 const pr=()=>({number:43,state:'open',changed_files:2,head:{repo:{full_name:'profitia/SG-dev'},ref:'sg2/quality-control-'+incidentId,sha},base:{repo:{full_name:'profitia/SG-dev'},ref:'main',sha:old},user:{login:'profitia'}})
 const fetchImpl=async(url,options)=>{
  calls.push({url,options});if(state.drift)await state.drift(url,options)
  const suffix=url.slice('https://api.github.com/repos/profitia/SG-dev'.length)
  if(suffix==='/git/ref/heads/main')return Response.json({object:{sha:old}})
  if(suffix==='/git/commits/'+old)return Response.json({sha:old,tree:{sha:state.binding.baseTree}})
  if(suffix==='/git/commits/'+sha)return Response.json({sha,tree:{sha:state.binding.headTree},parents:state.binding.parents})
  if(suffix==='/pulls/43/files?per_page=100&page=1')return Response.json(state.binding.files)
  if(suffix==='/commits/'+sha+'?per_page=100&page=1')return Response.json(state.binding.comparison??{
   sha,parents:[{sha:old}],commit:{tree:{sha:state.binding.headTree}},files:state.binding.files})

  if(suffix.startsWith('/git/trees/'))return Response.json(gitTrees.get(suffix.slice('/git/trees/'.length)))
  if(suffix.startsWith('/git/blobs/'))return Response.json(gitBlobs.get(suffix.slice('/git/blobs/'.length)))
  if(suffix==='/git/blobs')return Response.json({sha:'e'.repeat(40)})
  if(suffix==='/git/trees')return Response.json({sha:'f'.repeat(40)})
  if(suffix==='/git/commits')return Response.json({sha,tree:{sha:'f'.repeat(40)}})
  if(suffix==='/git/refs')return Response.json({})
  if(suffix==='/pulls')return Response.json({number:43,head:{sha}})
  if(suffix==='/pulls/43')return Response.json(state.pr??pr())
  if(suffix.startsWith('/rules/branches/main?per_page=100&page=')){
   const page=Number(new URL(url).searchParams.get('page'))
   return Response.json(state.rulePages?state.rulePages[page-1]??[]:state.rules??[])
  }
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
 return {client,inspector:createQualityGitHub({token:'synthetic',fetchImpl}),buildTree,state,calls,requests,manifest,patch,verification,names,installed,keyMap,document,evidence,origin,stamp,pr,verifier,documentDigest,
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


test('independent publisher binds exact PR bytes, ordinary modes and one base parent using read-only provider requests',async()=>{
 const f=await publicationFixture(),proof=await f.inspector.inspectPatchBinding(f.merge())
 assert.equal(proof.result,'PASS');assert.equal(proof.sourceBound,true);assert.equal(proof.headSha,sha)
 assert.equal(proof.artifactSha256,f.verification.artifactSha256);assert.match(proof.patchBindingSha256,/^[a-f0-9]{64}$/)
 assert(f.calls.length>5);assert(f.calls.every(c=>c.options.method==='GET'))
 assert.equal(JSON.stringify(proof).includes('controlledFixture'),false)
})
test('independent publisher rejects extra paths, renames, foreign ancestry and mismatched provider blob identity',async()=>{
 const changes=[
  f=>{f.state.pr={...f.pr(),changed_files:3}},
  f=>{f.state.binding.files.push({...f.state.binding.files[0],filename:'foreign/path.ts'})},
  f=>{f.state.binding.files[0].previous_filename='foreign/path.ts'},
  f=>{f.state.binding.files[0].status='added'},
  f=>{f.state.binding.parents=[{sha:old},{sha:'c'.repeat(40)}]},
  f=>{f.state.binding.parents=[{sha:'c'.repeat(40)}]},
  f=>{f.state.binding.files[0].sha='c'.repeat(40)},
  f=>{f.state.binding.trees.get(f.state.binding.headTree).truncated=true},
  f=>{f.state.binding.baseTree=f.state.binding.headTree},
 ]
 for(const change of changes){
  const f=await publicationFixture();change(f)
  await assert.rejects(f.inspector.inspectPatchBinding(f.merge()))
  assert(f.calls.every(c=>c.options.method==='GET'))
 }
})
test('independent publisher refuses symlinks, executable modes, altered bytes and an existing regression path before promotion',async()=>{
 for(const variant of ['symlink','executable','directory','bytes','preexisting-regression']){
  const f=await publicationFixture(),binding=f.state.binding
  const find=(tree,path)=>{
   const parts=path.split('/');let current=binding.trees.get(tree),found
   for(const part of parts){found=current.tree.find(x=>x.path===part);if(found.type==='tree')current=binding.trees.get(found.sha)}
   return found
  }
  const source=find(binding.headTree,f.manifest.allowedPaths[0])
  if(variant==='symlink')source.mode='120000'
  if(variant==='executable')source.mode='100755'
  if(variant==='directory'){source.mode='040000';source.type='tree'}
  if(variant==='bytes')binding.blobs.get(source.sha).content=Buffer.from('altered bytes').toString('base64')
  if(variant==='preexisting-regression')binding.baseTree=f.buildTree([
   [f.manifest.allowedPaths[0],'export function controlledFixture(v:number){return v}\n'],
   [f.manifest.allowedPaths[1],f.patch.files[1].content]])
  await assert.rejects(f.client.merge(f.merge()))
  assert.equal(f.calls.some(c=>c.options.method==='PUT'),false,variant)
 }
})
test('independent publisher rechecks PR identity after immutable object inspection',async()=>{
 const f=await publicationFixture();let reads=0
 f.state.drift=async url=>{if(url.endsWith('/pulls/43')&&++reads===2)f.state.pr={...f.pr(),head:{...f.pr().head,sha:'c'.repeat(40)}}}
 await assert.rejects(f.inspector.inspectPatchBinding(f.merge()),{code:'PR_HEAD_CHANGED'})
 assert(f.calls.every(c=>c.options.method==='GET'))
})

test('independent publisher snapshots the approved patch before asynchronous provider reads',async()=>{
 const f=await publicationFixture(),artifact=f.verification.artifactSha256;let changed=false
 f.state.drift=async()=>{if(!changed){changed=true;f.patch.files[0].content='changed after inspection started';f.verification.artifactSha256='0'.repeat(64)}}
 const proof=await f.inspector.inspectPatchBinding(f.merge())
 assert.equal(proof.artifactSha256,artifact);assert.equal(proof.sourceBound,true)
 assert(f.calls.every(c=>c.options.method==='GET'))
})

test('independent publisher checks the immutable commit diff rather than trusting mutable PR file counts',async()=>{
 for(const variant of ['extra-file','wrong-blob','wrong-base','extra-commit']){
  const f=await publicationFixture(),comparison={sha,parents:[{sha:old}],commit:{tree:{sha:f.state.binding.headTree}},files:structuredClone(f.state.binding.files)}
  if(variant==='extra-file')comparison.files.push({...comparison.files[0],filename:'unadmitted/path.ts'})
  if(variant==='wrong-blob')comparison.files[0].sha='c'.repeat(40)
  if(variant==='wrong-base')comparison.parents[0].sha='c'.repeat(40)
  if(variant==='extra-commit')comparison.parents.push({sha:'c'.repeat(40)})
  f.state.binding.comparison=comparison
  await assert.rejects(f.inspector.inspectPatchBinding(f.merge()),{code:'PUBLISHER_PATCH_COMPARISON_INVALID'})
  assert(f.calls.every(c=>c.options.method==='GET'))
 }
})


test('publisher observes strict active rulesets using Metadata read without administration or classic-protection access',async()=>{
 const f=await publicationFixture()
 f.state.rules=[{type:'required_status_checks',ruleset_id:23304085,parameters:{
  strict_required_status_checks_policy:true,required_status_checks:f.installed.map(context=>({context,integration_id:15368}))}}]
 f.state.protection={required_status_checks:{strict:false,contexts:[]}}
 const result=await f.client.merge(f.merge());assert.equal(result.sourceSha,'f'.repeat(40))
 assert.equal(f.calls.some(c=>c.url.endsWith('/branches/main/protection')),false)
 assert(f.calls.some(c=>c.url.includes('/rules/branches/main?')))
})
test('publisher refuses nonstrict, incomplete, malformed or foreign-app active checks without falling back to classic protection',async()=>{
 for(const change of ['nonstrict','missing','foreign-app','unscoped-app','malformed']){
  const f=await publicationFixture(),parameters={strict_required_status_checks_policy:true,
   required_status_checks:f.installed.map(context=>({context,integration_id:15368}))}
  if(change==='nonstrict')parameters.strict_required_status_checks_policy=false
  if(change==='missing')parameters.required_status_checks.pop()
  if(change==='foreign-app')parameters.required_status_checks[0].integration_id=12345
  if(change==='unscoped-app')parameters.required_status_checks[0].integration_id=null
  if(change==='malformed')parameters.required_status_checks=null
  f.state.rules=[{type:'required_status_checks',parameters}]
  await assert.rejects(f.client.merge(f.merge()))
  assert.equal(f.calls.some(c=>c.options.method==='PUT'),false,change)
  assert.equal(f.calls.some(c=>c.url.endsWith('/branches/main/protection')),false,change)
 }
})
test('publisher reads every active-rule page and fails closed at its bounded pagination limit',async()=>{
 const f=await publicationFixture(),unrelated=Array.from({length:100},()=>({type:'deletion'}))
 f.state.rulePages=[unrelated,[{type:'required_status_checks',parameters:{strict_required_status_checks_policy:true,
  required_status_checks:f.installed.map(context=>({context,integration_id:15368}))}}]]
 assert.deepEqual(await f.inspector.protection(f.installed),{source:'ACTIVE_RULESETS',strict:true})
 assert.equal(f.calls.filter(c=>c.url.includes('/rules/branches/main?')).length,2)
 const denied=await publicationFixture();denied.state.rulePages=Array.from({length:5},()=>unrelated)
 await assert.rejects(denied.inspector.protection(denied.installed),{code:'GITHUB_RULES_INCOMPLETE'})
 assert.equal(denied.calls.some(c=>c.options.method!=='GET'),false)
})

async function controllerJobFixture({action='QUALIFY',validityMs=300000,...settings}={}){
 const pub=await publicationFixture({validityMs}),{qualityJobBinding}=await import('../src/controller.mjs'),{createHash}=await import('node:crypto')
 const nonce=randomUUID(),externalId=qualityJobBinding({controlSourceSha:sha,nonce,action})
 const body='synthetic separately qualified workflow source\n',bytes=Buffer.from(body)
 const blob=b=>({type:'file',path:'.github/workflows/assistant-quality-repair.yml',encoding:'base64',size:b.length,
  sha:createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex'),content:b.toString('base64')})
 const state={main:sha,runs:[],run:null,throwPost:false,source:blob(bytes),pages:null,workflowState:'active'}
 const calls=[]
 const native=(changes={})=>({id:701,workflow_id:991,head_sha:sha,head_branch:'main',path:'.github/workflows/assistant-quality-repair.yml',
  event:'workflow_dispatch',run_attempt:1,repository:{full_name:'profitia/SG-dev'},actor:{login:'profitia'},triggering_actor:{login:'profitia'},
  display_title:'AQC JOB '+action+' '+nonce,status:'in_progress',conclusion:null,...changes})
 const fetchImpl=async(url,options)=>{
  calls.push({url,method:options.method,body:options.body,headers:options.headers})
  if(options.method==='POST'){
   if(state.throwPost)throw Error('reply lost')
   return new Response(null,{status:url.endsWith('/cancel')?202:204})
  }
  if(url.endsWith('/git/ref/heads/main'))return Response.json({object:{sha:state.main}})
  if(url.endsWith('/actions/workflows/assistant-quality-repair.yml'))return Response.json({id:991,path:'.github/workflows/assistant-quality-repair.yml',state:state.workflowState})
  if(url.includes('/contents/'))return Response.json(state.source)
  if(url.includes('/runs?')){const page=Number(new URL(url).searchParams.get('page'));return Response.json(state.pages?.[page]??{total_count:state.runs.length,workflow_runs:state.runs})}
  if(url.includes('/actions/runs/')&&url.includes('/artifacts?'))return Response.json(state.artifacts??{total_count:0,artifacts:[]})
  if(url.includes('/actions/artifacts/')&&url.endsWith('/zip'))return new Response(null,{status:state.downloadStatus??302,headers:{location:state.downloadLocation??'https://productionresultssa-fixture.blob.core.windows.net/aqc/result.zip?sig=synthetic'}})
  if(url.startsWith('https://productionresultssa-fixture.blob.core.windows.net/'))return new Response(state.downloadBody??state.archive,{status:200,headers:{'content-length':String(state.downloadDeclaredSize??state.archive.length)}})
  if(url.includes('/actions/runs/'))return Response.json(state.run??native())
  throw Error('unexpected fixed endpoint')
 }
 const client=createQualityGitHub({token:'synthetic-controller-only',fetchImpl,controllerJobsEnabled:true,
  controllerWorkflowSha256:createHash('sha256').update(bytes).digest('hex'),now:()=>pub.state.clock,...settings})
 return {client,calls,state,native,externalId,manifest:pub.manifest,clock:pub.state,blob,body}
}
test('controller operational dispatch and uninstalled workflow refuse before any HTTP by default',async()=>{
 let calls=0;const g=createQualityGitHub({token:'synthetic',fetchImpl:async()=>{calls++;throw Error('unexpected')}})
 await assert.rejects(g.dispatchControllerJob({}),{code:'CONTROLLER_JOBS_DISABLED'})
 await assert.rejects(g.controllerJobDescriptor({sourceSha:sha}),{code:'CONTROLLER_WORKFLOW_NOT_INSTALLED'})
 assert.equal(calls,0)
 assert.throws(()=>createQualityGitHub({token:'synthetic',controllerJobsEnabled:'true'}),{code:'GITHUB_CONFIGURATION_REQUIRED'})
})
test('controller job input is finite metadata from a verified manifest and durable source nonce action binding',async()=>{
 const f=await controllerJobFixture(),{qualityControllerJobInputs}=await import('../src/github.mjs')
 const input=qualityControllerJobInputs({manifest:f.manifest,externalId:f.externalId})
 assert.deepEqual(Object.keys(input).sort(),['mode','action','nonce','control_source_sha','incident_id','manifest_sha256','base_sha'].sort())
 assert.equal(input.action,'QUALIFY');assert.equal(input.control_source_sha,sha);assert.equal(input.base_sha,f.manifest.baseSha)
 assert.equal(input.incident_id,f.manifest.incidentId);assert.equal(input.mode,'controller-job')
 assert.equal(JSON.stringify(input).includes('allowedPaths'),false);assert.equal(Object.isFrozen(input),true)
 assert.throws(()=>qualityControllerJobInputs({manifest:structuredClone(f.manifest),externalId:f.externalId}))
 assert.throws(()=>qualityControllerJobInputs({manifest:f.manifest,externalId:f.externalId+':foreign'}))
 assert.equal(f.calls.length,0)
})
test('controller dispatch checks exact qualified workflow and source then issues exactly one metadata-only POST',async()=>{
 const f=await controllerJobFixture(),value=await f.client.dispatchControllerJob({manifest:f.manifest,externalId:f.externalId})
 assert.equal(value.state,'UNKNOWN');assert.equal(value.externalId,f.externalId);assert.equal(value.resultVerified,false)
 const posts=f.calls.filter(c=>c.method==='POST');assert.equal(posts.length,1)
 const payload=JSON.parse(posts[0].body);assert.equal(payload.ref,'main');assert.equal(payload.inputs.incident_id,f.manifest.incidentId)
 assert.equal(f.calls.filter(c=>c.url.endsWith('/git/ref/heads/main')).length,2)
 const bad=await controllerJobFixture();bad.state.source=bad.blob(Buffer.from('changed workflow'))
 await assert.rejects(()=>bad.client.dispatchControllerJob.call({controllerJobDescriptor:async()=>({})},{manifest:bad.manifest,externalId:bad.externalId}),{code:'CONTROLLER_WORKFLOW_SOURCE_INVALID'})
 assert.equal(bad.calls.filter(c=>c.method==='POST').length,0,'caller cannot substitute the source verifier through this')
})
test('uncertain dispatch is reconciled by the original binding without another POST after main advances',async()=>{
 const f=await controllerJobFixture();f.state.throwPost=true
 await assert.rejects(f.client.dispatchControllerJob({manifest:f.manifest,externalId:f.externalId}),{code:'DELIVERY_UNCERTAIN'})
 assert.equal(f.calls.filter(c=>c.method==='POST').length,1)
 assert.equal((await f.client.findControllerJob({externalId:f.externalId})).state,'UNKNOWN')
 f.state.main=old;f.state.runs=[f.native()]
 const found=await f.client.findControllerJob({externalId:f.externalId})
 assert.equal(found.state,'RUNNING');assert.equal(found.runId,'701');assert.equal(found.resultVerified,false)
 assert.equal(f.calls.filter(c=>c.method==='POST').length,1)
 await assert.rejects(f.client.dispatchControllerJob({manifest:f.manifest,externalId:f.externalId}),{code:'BASE_CHANGED'})
 assert.equal(f.calls.filter(c=>c.method==='POST').length,1)
})
test('controller reconciliation rejects ambiguous runs and substituted actor source workflow attempts or phase',async()=>{
 for(const drift of [
  {actor:{login:'foreign'}},{triggering_actor:{login:'foreign'}},{head_sha:old},{head_branch:'foreign'},
  {workflow_id:992},{run_attempt:2},{event:'pull_request'},{repository:{full_name:'profitia/foreign'}},{status:'unknown'}
 ]){
  const f=await controllerJobFixture();f.state.runs=[f.native(drift)]
  await assert.rejects(f.client.findControllerJob({externalId:f.externalId}),{code:'CONTROLLER_JOB_PROVENANCE_MISMATCH'})
  assert.equal(f.calls.filter(c=>c.method==='POST').length,0)
 }
 const f=await controllerJobFixture();f.state.pages={
  1:{total_count:101,workflow_runs:[f.native()]},2:{total_count:101,workflow_runs:[f.native({id:702})]}}
 await assert.rejects(f.client.findControllerJob({externalId:f.externalId}),{code:'WORKFLOW_IDENTITY_AMBIGUOUS'})
 const legacy=await controllerJobFixture();legacy.state.runs=[legacy.native({display_title:'AQC '+legacy.externalId.split(':')[2]})]
 assert.equal((await legacy.client.findControllerJob({externalId:legacy.externalId})).state,'UNKNOWN','keyless qualification cannot masquerade as an operational job')
})
test('expired authority and disabled paid publisher or promotion gates stop before HTTP',async()=>{
 const expired=await controllerJobFixture();expired.clock.clock+=300001
 await assert.rejects(expired.client.dispatchControllerJob({manifest:expired.manifest,externalId:expired.externalId}),{code:'CONTROLLER_JOB_AUTHORITY_EXPIRED'})
 assert.equal(expired.calls.length,0)
 for(const [action,code]of [['EXECUTE','PAID_REPAIRS_DISABLED'],['PROPOSE','PUBLISHER_DISABLED'],['PROMOTE','PROMOTION_DISABLED']]){
  const f=await controllerJobFixture({action})
  await assert.rejects(f.client.dispatchControllerJob({manifest:f.manifest,externalId:f.externalId}),{code})
  assert.equal(f.calls.length,0)
 }
})
test('provider completion and cancellation acknowledgement never attest cleanup results or side effects',async()=>{
 const f=await controllerJobFixture()
 const requested=await f.client.cancelControllerJob({externalId:f.externalId,runId:'701'})
 assert.equal(requested.state,'CANCEL_REQUESTED');assert.equal(requested.isolationTerminationVerified,false);assert.equal(requested.sideEffectsVerified,false)
 assert.equal(f.calls.filter(c=>c.method==='POST').length,1)
 f.state.run=f.native({status:'completed',conclusion:'cancelled'})
 const complete=await f.client.cancelControllerJob({externalId:f.externalId,runId:'701'})
 assert.equal(complete.state,'PROVIDER_COMPLETE');assert.equal(complete.isolationTerminationVerified,false)
 assert.equal(f.calls.filter(c=>c.method==='POST').length,1,'already completed job must not be cancelled again')
 f.state.runs=[f.native({status:'completed',conclusion:'success'})]
 const finished=await f.client.findControllerJob({externalId:f.externalId})
 assert.equal(finished.state,'COMPLETE');assert.equal(finished.resultVerified,false);assert.equal(Object.hasOwn(finished,'result'),false)
})

test('disabling a workflow blocks dispatch while preserving reconciliation and cancellation of its bound run',async()=>{
 const f=await controllerJobFixture();f.state.workflowState='disabled_manually';f.state.runs=[f.native()]
 await assert.rejects(f.client.dispatchControllerJob({manifest:f.manifest,externalId:f.externalId}),{code:'GITHUB_WORKFLOW_BINDING_INVALID'})
 assert.equal(f.calls.filter(c=>c.method==='POST').length,0)
 assert.equal((await f.client.findControllerJob({externalId:f.externalId})).state,'RUNNING')
 assert.equal((await f.client.cancelControllerJob({externalId:f.externalId,runId:'701'})).state,'CANCEL_REQUESTED')
 assert.equal(f.calls.filter(c=>c.method==='POST').length,1)
})

async function signedControllerResultFixture(action='QUALIFY',options={}){
 const f=await controllerJobFixture({...options,action}),{documentDigest}=await import('../src/manifest.mjs')
 const keys=new Map(),privateKeys=new Map()
 for(const role of ['INDEPENDENT_VERIFIER','EXECUTOR_SUPERVISOR','INDEPENDENT_PUBLISHER']){
  const pair=generateKeyPairSync('ed25519');privateKeys.set(role,pair.privateKey);keys.set(role,new Map([[publicKeyId(pair.publicKey),pair.publicKey]]))
 }
 const role=['EXECUTE'].includes(action)?'EXECUTOR_SUPERVISOR':['PROPOSE','PROMOTE','ROLLBACK'].includes(action)?'INDEPENDENT_PUBLISHER':'INDEPENDENT_VERIFIER'
 const binding=f.externalId.split(':'),at=f.clock.clock
 const record={id:f.manifest.incidentId,revision:2,status:'OBSERVED',repairClass:'C1',causeFingerprint:digest,baseSha:old,attemptsUsed:1,
  rollbacksUsed:action==='ROLLBACK'?1:0,wakeAt:0,pending:{externalId:f.externalId,action,nonce:binding[2]},
  patch:{artifactSha256:digest,treeSha256:digest},pr:{number:33,headSha:sha},
  release:{sourceSha:sha,lastKnownGoodSha:old},runtimeProof:digest,observingUntil:at-1}
 const outcomes={
  QUALIFY:{result:'DETERMINISTIC_FAILURE',method:'DETERMINISTIC',causeFingerprint:digest,repairClass:'C1'},
  REPRODUCE:{result:'RED',baseSha:old,proofSha256:digest},
  EXECUTE:{result:'PATCH',baseSha:old,patch:{artifactSha256:digest,treeSha256:digest}},
  VERIFY:{result:'PASS',baseSha:old,artifactSha256:digest,baseTest:'FAIL',candidateTest:'PASS',holdoutCases:200,
   criticalRegressions:0,accessViolations:0,unverifiableCases:0,criticalCasesPass:true,criticalRepeats:3,stable:true,
   correctnessDeltaPp:0,unjustifiedRefusalDeltaPp:0,scopeBeforeDefects:10,scopeAfterDefects:4,
   classCounts:{C1:70,C2:65,C3:65},proofSha256:digest},
  PROPOSE:{result:'PR_READY',prNumber:33,headSha:sha,artifactSha256:digest},
  CHECKS:{result:'PASS',headSha:sha,requiredChecksComplete:true,proofSha256:digest},
  PROMOTE:{result:'RELEASED',sourceSha:sha,artifactSha256:digest,configurationSha256:digest,deployId:newId,lastKnownGoodSha:old,exactRuntimeVerified:true},
  VERIFY_RUNTIME:{result:'PASS',sourceSha:sha,answerVerified:true,proofSha256:digest},
  OBSERVE:{result:'STABLE',sourceSha:sha},
  ROLLBACK:{result:'RESTORED',sourceSha:old,exactRuntimeVerified:true,proofSha256:digest}
 }
 const body={schemaVersion:'AQC_CONTROLLER_JOB_RESULT_V1',repository:'profitia/SG-dev',environment:'development',role,action,
  incidentId:f.manifest.incidentId,baseSha:old,manifestSha256:documentDigest(f.manifest),gateSetSha256:f.manifest.gateSetSha256,
  controlSourceSha:sha,nonce:binding[2],runId:'701',runAttempt:1,workflowId:'991',rawQaPayloadIncluded:false,
  issuedAt:new Date(at).toISOString(),expiresAt:new Date(at+30000).toISOString(),result:outcomes[action]}
 const context={manifest:f.manifest,record,externalId:f.externalId,runId:'701',workflowId:'991',keysByRole:keys,notBefore:at-1000,now:at}
 const sign=(value=body,signer=role)=>signDocument('AQC_CONTROLLER_JOB_RESULT_V1',value,privateKeys.get(signer))
 return {...f,body,context,sign,keys,privateKeys,role}
}
test('each finite controller phase accepts only a signed typed result for its committed native intent',async()=>{
 const {readQualityControllerJobResult}=await import('../src/github.mjs')
 for(const action of ['QUALIFY','REPRODUCE','EXECUTE','VERIFY','PROPOSE','CHECKS','PROMOTE','VERIFY_RUNTIME','OBSERVE','ROLLBACK']){
  const f=await signedControllerResultFixture(action),verified=readQualityControllerJobResult(f.sign(),f.context)
  assert.deepEqual(verified,f.body.result,action);assert.equal(Object.isFrozen(verified),true)
  for(const value of Object.values(verified))if(value&&typeof value==='object')assert.equal(Object.isFrozen(value),true)
  assert.equal(f.calls.length,0)
 }
})
test('executor supervisor cannot impersonate the independent verifier or publisher',async()=>{
 const {readQualityControllerJobResult}=await import('../src/github.mjs')
 for(const action of ['VERIFY','PROPOSE','PROMOTE']){
  const f=await signedControllerResultFixture(action)
  assert.throws(()=>readQualityControllerJobResult(f.sign(f.body,'EXECUTOR_SUPERVISOR'),f.context))
  assert.throws(()=>readQualityControllerJobResult(f.sign(),{...f.context,keysByRole:new Map()}),{code:'CONTROLLER_JOB_RESULT_TRUST_REQUIRED'})
 }
})
test('even a correctly signed result cannot substitute any native source incident phase or mandate field',async()=>{
 const {readQualityControllerJobResult}=await import('../src/github.mjs'),f=await signedControllerResultFixture()
 for(const change of [
  b=>b.repository='profitia/foreign',b=>b.environment='production',b=>b.role='INDEPENDENT_PUBLISHER',
  b=>b.action='EXECUTE',b=>b.incidentId=randomUUID(),b=>b.baseSha=sha,b=>b.manifestSha256='0'.repeat(64),
  b=>b.gateSetSha256='0'.repeat(64),b=>b.controlSourceSha=old,b=>b.nonce=randomUUID(),
  b=>b.runId='702',b=>b.runAttempt=2,b=>b.workflowId='992',b=>b.rawQaPayloadIncluded=true,b=>b.extra='unreviewed'
 ]){
  const body=structuredClone(f.body);change(body)
  assert.throws(()=>readQualityControllerJobResult(f.sign(body),f.context),{code:'CONTROLLER_JOB_RESULT_BINDING_INVALID'})
 }
})
test('stale future overlong and pre-job receipts fail without weakening expired-mandate safety recovery',async()=>{
 const {readQualityControllerJobResult}=await import('../src/github.mjs')
 const f=await signedControllerResultFixture()
 for(const change of [
  b=>b.issuedAt=new Date(f.context.now-2000).toISOString(),
  b=>b.issuedAt=new Date(f.context.now+1).toISOString(),
  b=>b.expiresAt=new Date(f.context.now).toISOString(),
  b=>b.expiresAt=new Date(f.context.now+300001).toISOString()
 ]){
  const body=structuredClone(f.body);change(body)
  assert.throws(()=>readQualityControllerJobResult(f.sign(body),f.context),{code:'CONTROLLER_JOB_RESULT_STALE'})
 }
 const now=f.context.now+300001,body={...f.body,issuedAt:new Date(now).toISOString(),expiresAt:new Date(now+30000).toISOString()}
 assert.throws(()=>readQualityControllerJobResult(f.sign(body),{...f.context,now}),{code:'CONTROLLER_JOB_AUTHORITY_EXPIRED'})
 const safety=await signedControllerResultFixture('ROLLBACK'),safetyBody={...safety.body,issuedAt:new Date(now).toISOString(),expiresAt:new Date(now+30000).toISOString()}
 assert.equal(readQualityControllerJobResult(safety.sign(safetyBody),{...safety.context,now}).result,'RESTORED')
})
test('signed job result metadata refuses raw QA additional patch content and untyped values',async()=>{
 const {readQualityControllerJobResult}=await import('../src/github.mjs')
 for(const [action,change]of [
  ['QUALIFY',b=>b.result.transcript='synthetic forbidden field'],
  ['EXECUTE',b=>b.result.patch.files=['forbidden content']],
  ['VERIFY',b=>b.result.holdoutCases='200'],
  ['VERIFY',b=>b.result.classCounts.rawQa='forbidden'],
  ['PROMOTE',b=>b.result.configurationSha256='not-a-digest']
 ]){
  const f=await signedControllerResultFixture(action),body=structuredClone(f.body);change(body)
  assert.throws(()=>readQualityControllerJobResult(f.sign(body),f.context),{code:'CONTROLLER_JOB_RESULT_INVALID'})
 }
})
test('independently signed verification preserves every existing holdout regression access and scope threshold',async()=>{
 const {readQualityControllerJobResult}=await import('../src/github.mjs'),f=await signedControllerResultFixture('VERIFY')
 for(const change of [
  b=>b.result.holdoutCases=199,b=>b.result.criticalRegressions=1,b=>b.result.accessViolations=1,b=>b.result.unverifiableCases=1,
  b=>b.result.criticalCasesPass=false,b=>b.result.criticalRepeats=2,b=>b.result.stable=false,
  b=>b.result.correctnessDeltaPp=-1.01,b=>b.result.unjustifiedRefusalDeltaPp=2.01,
  b=>b.result.scopeAfterDefects=6,b=>b.result.classCounts.C3=19,b=>b.result.baseTest='PASS',b=>b.result.candidateTest='FAIL'
 ]){
  const body=structuredClone(f.body);change(body)
  assert.throws(()=>readQualityControllerJobResult(f.sign(body),f.context),{code:'RESULT_INVALID'})
 }
 const mismatch=structuredClone(f.body);mismatch.result.artifactSha256='f'.repeat(64)
 assert.throws(()=>readQualityControllerJobResult(f.sign(mismatch),f.context),{code:'CONTROLLER_JOB_RESULT_BINDING_INVALID'})
})
test('a verified job result cannot complete another record, unsigned manifest or uncommitted pending operation',async()=>{
 const {readQualityControllerJobResult}=await import('../src/github.mjs'),f=await signedControllerResultFixture()
 for(const change of [r=>r.id=randomUUID(),r=>r.baseSha=sha,r=>r.repairClass='C2',r=>r.pending.externalId='foreign',r=>r.pending.nonce=randomUUID(),r=>r.pending.action='EXECUTE',r=>r.pending=null]){
  const record=structuredClone(f.context.record);change(record)
  assert.throws(()=>readQualityControllerJobResult(f.sign(),{...f.context,record}),{code:'CONTROLLER_JOB_RESULT_BINDING_INVALID'})
 }
 assert.throws(()=>readQualityControllerJobResult(f.sign(),{...f.context,manifest:structuredClone(f.manifest)}))
})

async function controllerResultZip(payload,{name='result.json',method='deflate',stream=false,second=false,zip64=false,mode=0o100600}={}){
 const {spawnSync}=await import('node:child_process')
 const program="import sys,json,io,zipfile\np=json.loads(sys.stdin.buffer.read())\nclass Sink(io.BytesIO):\n def seek(self,*args):raise io.UnsupportedOperation()\nout=Sink() if p['stream'] else io.BytesIO()\nwith zipfile.ZipFile(out,'w') as z:\n info=zipfile.ZipInfo(p['name'],(2026,11,18,12,0,0));info.compress_type=zipfile.ZIP_STORED if p['method']=='store' else zipfile.ZIP_DEFLATED;info.external_attr=p['mode']<<16\n if p['zip64']:\n  with z.open(info,'w',force_zip64=True) as f:f.write(p['payload'].encode())\n else:z.writestr(info,p['payload'])\n if p['second']:z.writestr('extra.json','{}')\nsys.stdout.buffer.write(out.getvalue())\n"
 const result=spawnSync('python3',['-c',program],{input:JSON.stringify({payload,name,method,stream,second,zip64,mode}),maxBuffer:1048576})
 assert.equal(result.status,0,result.stderr?.toString());return result.stdout
}
async function controllerArtifactFixture(options={}){
 const f=await signedControllerResultFixture(),{createHash}=await import('node:crypto')
 f.state.run=f.native({status:'completed',conclusion:'success',created_at:new Date(f.context.now-1000).toISOString()})
 f.state.archive=await controllerResultZip(options.payload??JSON.stringify(f.sign()),options)
 f.state.artifacts={total_count:1,artifacts:[{id:801,name:'aqc-result-'+f.externalId.split(':')[2],expired:false,
  size_in_bytes:f.state.archive.length,digest:'sha256:'+createHash('sha256').update(f.state.archive).digest('hex'),workflow_run:{id:701,head_sha:sha}}]}
 const refresh=()=>{const a=f.state.artifacts.artifacts[0];a.size_in_bytes=f.state.archive.length;a.digest='sha256:'+createHash('sha256').update(f.state.archive).digest('hex')}
 return {...f,refresh}
}
test('controller result artifact validates native run digest and both ordinary and streamed standard ZIP without forwarding token',async()=>{
 const {readQualityControllerJobResult}=await import('../src/github.mjs')
 for(const options of [{},{stream:true},{method:'store'}]){
  const f=await controllerArtifactFixture(options),observed=await f.client.controllerJobResult({externalId:f.externalId,runId:'701'})
  assert.equal(observed.state,'COMPLETE');assert.equal(observed.resultVerified,false)
  assert.equal(observed.runId,'701');assert.equal(observed.workflowId,'991')
  assert.equal(readQualityControllerJobResult(observed.document,f.context).result,'DETERMINISTIC_FAILURE')
  const api=f.calls.find(c=>c.url.endsWith('/actions/artifacts/801/zip')),storage=f.calls.find(c=>c.url.startsWith('https://productionresultssa-fixture.blob.core.windows.net/'))
  assert(api);assert(storage)
  assert.equal(new Headers(api.headers).get('authorization'),'Bearer synthetic-controller-only')
  assert.equal(new Headers(storage.headers).has('authorization'),false)
 }
})
test('controller result artifact refuses missing ambiguous expired foreign or malformed native artifact identity',async()=>{
 const f=await controllerArtifactFixture();f.state.artifacts={total_count:0,artifacts:[]}
 assert.equal((await f.client.controllerJobResult({externalId:f.externalId,runId:'701'})).state,'UNKNOWN')
 for(const mutate of [
  a=>a.expired=true,a=>a.workflow_run.id=702,a=>a.workflow_run.head_sha=old,a=>a.size_in_bytes=65537,a=>a.digest='foreign',a=>a.id='801'
 ]){
  const g=await controllerArtifactFixture();mutate(g.state.artifacts.artifacts[0])
  await assert.rejects(g.client.controllerJobResult({externalId:g.externalId,runId:'701'}),{code:'CONTROLLER_JOB_RESULT_ARTIFACT_INVALID'})
  assert.equal(g.calls.some(c=>c.url.endsWith('/zip')),false)
 }
 const duplicate=await controllerArtifactFixture();duplicate.state.artifacts.artifacts.push({...duplicate.state.artifacts.artifacts[0],id:802});duplicate.state.artifacts.total_count=2
 await assert.rejects(duplicate.client.controllerJobResult({externalId:duplicate.externalId,runId:'701'}),{code:'CONTROLLER_JOB_RESULT_ARTIFACT_AMBIGUOUS'})
})
test('controller result artifact rejects changed native bytes and contradictory ZIP metadata before use',async()=>{
 const f=await controllerArtifactFixture();f.state.archive=Buffer.from(f.state.archive);f.state.archive[f.state.archive.length-1]^=1
 await assert.rejects(f.client.controllerJobResult({externalId:f.externalId,runId:'701'}),{code:'CONTROLLER_JOB_RESULT_ARTIFACT_INVALID'})
 const crc=await controllerArtifactFixture();crc.state.archive=Buffer.from(crc.state.archive)
 const central=crc.state.archive.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));assert(central>=0)
 crc.state.archive[central+16]^=1;crc.refresh()
 await assert.rejects(crc.client.controllerJobResult({externalId:crc.externalId,runId:'701'}),{code:'CONTROLLER_JOB_RESULT_ARCHIVE_INVALID'})
 const size=await controllerArtifactFixture();size.state.artifacts.artifacts[0].size_in_bytes++
 await assert.rejects(size.client.controllerJobResult({externalId:size.externalId,runId:'701'}),{code:'CONTROLLER_JOB_RESULT_ARTIFACT_INVALID'})
})
test('controller result archive refuses paths symlinks ZIP64 additional files and decompression output beyond the bound',async()=>{
 for(const options of [{name:'../result.json'},{second:true},{zip64:true},{mode:0o120600},{payload:'x'.repeat(20000)}]){
  const f=await controllerArtifactFixture(options)
  await assert.rejects(f.client.controllerJobResult({externalId:f.externalId,runId:'701'}),{code:'CONTROLLER_JOB_RESULT_ARCHIVE_INVALID'})
 }
 const json=await controllerArtifactFixture({payload:'not JSON'})
 await assert.rejects(json.client.controllerJobResult({externalId:json.externalId,runId:'701'}),{code:'CONTROLLER_JOB_RESULT_METADATA_INVALID'})
})
test('controller result download refuses arbitrary redirects huge declared or streamed bodies and actual authentication failure',async()=>{
 const redirect=await controllerArtifactFixture();redirect.state.downloadLocation='https://foreign.invalid/result.zip'
 await assert.rejects(redirect.client.controllerJobResult({externalId:redirect.externalId,runId:'701'}),{code:'CONTROLLER_JOB_RESULT_DOWNLOAD_INVALID'})
 assert.equal(redirect.calls.some(c=>c.url.includes('foreign.invalid')),false)
 for(const changes of [{downloadDeclaredSize:65537},{downloadDeclaredSize:0,downloadBody:Buffer.alloc(65537)}]){
  const f=await controllerArtifactFixture();Object.assign(f.state,changes)
  await assert.rejects(f.client.controllerJobResult({externalId:f.externalId,runId:'701'}),{code:'CONTROLLER_JOB_RESULT_DOWNLOAD_INVALID'})
 }
 const auth=await controllerArtifactFixture();auth.state.downloadStatus=401
 await assert.rejects(auth.client.controllerJobResult({externalId:auth.externalId,runId:'701'}),{code:'AUTHENTICATION_REJECTED'})
})
test('controller result read refuses foreign or unsuccessful native jobs before downloading any artifact',async()=>{
 for(const drift of [{head_sha:old},{run_attempt:2},{actor:{login:'foreign'}},{status:'completed',conclusion:'failure'}]){
  const f=await controllerArtifactFixture();f.state.run={...f.state.run,...drift}
  await assert.rejects(f.client.controllerJobResult({externalId:f.externalId,runId:'701'}))
  assert.equal(f.calls.some(c=>c.url.includes('/artifacts')),false)
 }
})

test('immutable signed job facts survive an hour restart only inside the unchanged original mandate',async()=>{
 const {readQualityControllerJobResult}=await import('../src/github.mjs'),f=await signedControllerResultFixture('QUALIFY',{validityMs:7200000})
 const body={...f.body,expiresAt:new Date(f.context.now+7200000).toISOString()}
 assert.equal(readQualityControllerJobResult(f.sign(body),{...f.context,now:f.context.now+3600000}).result,'DETERMINISTIC_FAILURE')
 const beyond={...body,expiresAt:new Date(f.context.now+7200001).toISOString()}
 assert.throws(()=>readQualityControllerJobResult(f.sign(beyond),f.context),{code:'CONTROLLER_JOB_RESULT_STALE'})
 assert.throws(()=>readQualityControllerJobResult(f.sign(body),{...f.context,now:f.context.now+7200001}),{code:'CONTROLLER_JOB_RESULT_STALE'})
 const promotion=await signedControllerResultFixture('PROMOTE'),now=promotion.context.now+300001
 const fresh={...promotion.body,issuedAt:new Date(now).toISOString(),expiresAt:new Date(now+30000).toISOString()}
 assert.throws(()=>readQualityControllerJobResult(promotion.sign(fresh),{...promotion.context,now}),{code:'CONTROLLER_JOB_AUTHORITY_EXPIRED'})
})

async function controllerActionsFixture(options={}){
 const f=await controllerArtifactFixture(options),{createQualityControllerJobActions}=await import('../src/github.mjs')
 f.state.runs=[f.state.run]
 const github={...f.client,descriptor:async()=>({headSha:sha})}
 const actions=createQualityControllerJobActions({github,keysByRole:f.keys,now:()=>f.clock.clock})
 return {...f,github,actions,record:f.context.record,authority:{manifest:f.manifest}}
}
test('controller actions bind one exact installed workflow and refuse disabled or mismatched authority before dispatch',async()=>{
 const f=await controllerActionsFixture(),nonce=f.record.pending.nonce
 assert.equal(await f.actions.bind('QUALIFY',{record:{...f.record,pending:null},nonce,authority:f.authority}),f.externalId)
 const wrong={...f.record,id:randomUUID()};const count=f.calls.length
 await assert.rejects(f.actions.bind('QUALIFY',{record:wrong,nonce,authority:f.authority}),{code:'CONTROLLER_JOB_RESULT_BINDING_INVALID'})
 assert.equal(f.calls.length,count)
 f.state.workflowState='disabled_manually'
 await assert.rejects(f.actions.bind('QUALIFY',{record:f.record,nonce,authority:f.authority}),{code:'GITHUB_WORKFLOW_BINDING_INVALID'})
 assert.equal(f.calls.some(c=>c.method==='POST'),false)
})
test('native signed artifact flows through controller actions while fabricated cloned or foreign envelopes fail',async()=>{
 const f=await controllerActionsFixture(),context={record:f.record,authority:f.authority}
 const received=await f.actions.reconcile(f.record.pending,context)
 assert.equal(received.state,'COMPLETE')
 assert.equal(Object.hasOwn(received.result,'document'),false)
 assert.deepEqual(await f.actions.verify('QUALIFY',received.result,context),f.body.result)
 for(const value of [{result:'DETERMINISTIC_FAILURE'},structuredClone(received.result)]){
  await assert.rejects(f.actions.verify('QUALIFY',value,context),{code:'CONTROLLER_JOB_NATIVE_RESULT_REQUIRED'})
 }
 const other=await controllerActionsFixture()
 await assert.rejects(other.actions.verify('QUALIFY',received.result,{record:other.record,authority:other.authority}),{code:'CONTROLLER_JOB_NATIVE_RESULT_REQUIRED'})
})
test('controller actions revalidate freshness signatures and exact pending intent after asynchronous artifact read',async()=>{
 for(const kind of ['stale','wrong-key','changed-intent']){
  const f=await controllerActionsFixture(),context={record:f.record,authority:f.authority}
  if(kind==='wrong-key'){
   f.state.archive=await controllerResultZip(JSON.stringify(f.sign(f.body,'EXECUTOR_SUPERVISOR')));f.refresh()
  }
  const result=await f.actions.reconcile(f.record.pending,context)
  if(kind==='stale')f.clock.clock+=30001
  if(kind==='changed-intent')f.record.pending={...f.record.pending,nonce:randomUUID()}
  await assert.rejects(f.actions.verify('QUALIFY',result.result,context))
 }
})
test('completed failed cancelled missing and running native jobs cannot fabricate a controller outcome or cleanup',async()=>{
 for(const status of ['failure','cancelled','missing','running']){
  const f=await controllerActionsFixture(),context={record:f.record,authority:f.authority}
  f.state.runs=status==='missing'?[]:[f.native({status:status==='running'?'in_progress':'completed',conclusion:status==='running'?null:status})]
  if(f.state.runs.length)f.state.run=f.state.runs[0]
  const result=await f.actions.reconcile(f.record.pending,context)
  assert.equal(result.state,status==='running'?'RUNNING':'UNKNOWN')
  assert.equal(Object.hasOwn(result,'result'),false)
  const cancelled=await f.actions.cancel(f.record.pending,{record:f.record})
  assert.deepEqual(cancelled,{state:'UNKNOWN',effects:'UNKNOWN'})
  assert.equal(f.calls.filter(c=>c.method==='POST').length,status==='running'?1:0)
 }
})
test('controller action trust snapshots distinct installed role maps and refuses a shared signer or unsupported role',async()=>{
 const {createQualityControllerJobActions}=await import('../src/github.mjs'),f=await controllerActionsFixture()
 const shared=new Map(f.keys);shared.set('INDEPENDENT_PUBLISHER',f.keys.get('EXECUTOR_SUPERVISOR'))
 assert.throws(()=>createQualityControllerJobActions({github:f.github,keysByRole:shared}),{code:'CONTROLLER_JOB_RESULT_TRUST_REQUIRED'})
 const extra=new Map(f.keys);extra.set('AGENT',new Map())
 assert.throws(()=>createQualityControllerJobActions({github:f.github,keysByRole:extra}),{code:'CONTROLLER_JOB_RESULT_TRUST_REQUIRED'})
 const context={record:f.record,authority:f.authority},result=await f.actions.reconcile(f.record.pending,context)
 for(const keys of f.keys.values())keys.clear();f.keys.clear()
 assert.equal((await f.actions.verify('QUALIFY',result.result,context)).result,'DETERMINISTIC_FAILURE')
})
test('lost dispatch reply survives a controller process restart and completes the committed nonce without a second dispatch',async()=>{
 const f=await controllerActionsFixture(),{createQualityController}=await import('../src/controller.mjs')
 const {createQualityControllerJobActions}=await import('../src/github.mjs')
 let record={id:f.manifest.incidentId,revision:1,status:'OBSERVED',repairClass:'C1',causeFingerprint:digest,
  baseSha:old,attemptsUsed:0,rollbacksUsed:0,wakeAt:0,pending:null}
 let completed=0
 const store={
  claim:async()=>({record:structuredClone(record),leaseToken:'synthetic-lease'}),
  prepare:async o=>{assert.equal(o.revision,record.revision);record={...record,revision:record.revision+1,
   pending:{action:o.action,nonce:o.nonce,externalId:o.externalId}};return {record:structuredClone(record)}},
  recordExternal:async()=>{assert.fail('binding must already be committed')},
  complete:async o=>{assert.equal(o.nonce,record.pending.nonce);record={...o.record,revision:record.revision+1};completed++;return structuredClone(record)},
  stop:async()=>{assert.fail('uncertain dispatch must preserve reconciliation')},release:async()=>{}
 }
 const budget={ensureIncident:async()=>{assert.fail('qualification cannot open paid ledger')},closeIncident:async()=>{}}
 const options={store,budget,authorize:async()=>f.authority,now:()=>f.clock.clock,workerId:'synthetic-controller'}
 f.state.throwPost=true
 const first=await createQualityController({...options,actions:f.actions}).tick(record.id)
 assert.equal(first.waitingFor,'RECONCILIATION');assert(record.pending)
 assert.equal(f.calls.filter(c=>c.method==='POST').length,1)
 const nonce=record.pending.nonce
 f.state.throwPost=false
 f.state.run=f.native({display_title:'AQC JOB QUALIFY '+nonce,status:'completed',conclusion:'success',created_at:new Date(f.clock.clock-1000).toISOString()})
 f.state.runs=[f.state.run]
 const body={...f.body,nonce}
 f.state.archive=await controllerResultZip(JSON.stringify(f.sign(body)))
 f.state.artifacts.artifacts[0].name='aqc-result-'+nonce;f.refresh()
 const restarted=createQualityControllerJobActions({github:f.github,keysByRole:f.keys,now:()=>f.clock.clock})
 const second=await createQualityController({...options,actions:restarted}).tick(record.id)
 assert.equal(second.status,'TRIAGED');assert.equal(record.pending,null);assert.equal(completed,1)
 assert.equal(f.calls.filter(c=>c.method==='POST').length,1)
})

test('EXECUTE carries only a native permit bound to the committed incident and nonce; other phases reject it',async()=>{
 const {qualityControllerJobInputs}=await import('../src/github.mjs'),f=await controllerJobFixture({action:'EXECUTE'})
 const permit={incidentId:f.manifest.incidentId,attemptId:f.externalId.split(':')[2],permitId:randomUUID(),ordinal:1,
  expiresAt:new Date(f.clock.clock+60000).toISOString()}
 const inputs=qualityControllerJobInputs({manifest:f.manifest,externalId:f.externalId,permit})
 assert.equal(Object.keys(inputs).length,9);assert.equal(inputs.permit_id,permit.permitId)
 assert.equal(inputs.permit_expires_at,permit.expiresAt);assert(!JSON.stringify(inputs).includes('regression'))
 for(const change of [p=>p.incidentId=randomUUID(),p=>p.attemptId=randomUUID(),p=>p.permitId='foreign',p=>p.ordinal=3,
  p=>p.expiresAt='invalid',p=>p.expiresAt=f.manifest.mandate.issuedAt,p=>p.expiresAt=new Date(Date.parse(f.manifest.mandate.expiresAt)+1).toISOString(),
  p=>p.command='forbidden']){
  const candidate={...permit};change(candidate)
  assert.throws(()=>qualityControllerJobInputs({manifest:f.manifest,externalId:f.externalId,permit:candidate}),{code:'CONTROLLER_JOB_PERMIT_INVALID'})
 }
 assert.throws(()=>qualityControllerJobInputs({manifest:f.manifest,externalId:f.externalId}),{code:'CONTROLLER_JOB_PERMIT_INVALID'})
 const free=await controllerJobFixture()
 assert.throws(()=>qualityControllerJobInputs({manifest:free.manifest,externalId:free.externalId,permit}),{code:'CONTROLLER_JOB_PERMIT_INVALID'})
 assert.equal(f.calls.length,0)
})
test('enabled EXECUTE dispatch requires a current permit before provider access and posts its exact metadata once',async()=>{
 const f=await controllerJobFixture({action:'EXECUTE',paidRepairsEnabled:true})
 const permit={incidentId:f.manifest.incidentId,attemptId:f.externalId.split(':')[2],permitId:randomUUID(),ordinal:1,
  expiresAt:new Date(f.clock.clock+60000).toISOString()}
 for(const value of [undefined,{...permit,expiresAt:new Date(f.clock.clock-1).toISOString()}]){
  await assert.rejects(f.client.dispatchControllerJob({manifest:f.manifest,externalId:f.externalId,permit:value}),{code:'CONTROLLER_JOB_PERMIT_INVALID'})
 }
 assert.equal(f.calls.length,0)
 await f.client.dispatchControllerJob({manifest:f.manifest,externalId:f.externalId,permit})
 const posts=f.calls.filter(c=>c.method==='POST');assert.equal(posts.length,1)
 const payload=JSON.parse(posts[0].body);assert.equal(payload.inputs.permit_id,permit.permitId);assert.equal(Object.keys(payload.inputs).length,9)
})
test('controller opens the committed EXECUTE ordinal with a fixed reproduction expiry only under its explicit paid gate',async()=>{
 const {createQualityControllerJobActions}=await import('../src/github.mjs')
 const f=await controllerJobFixture({action:'EXECUTE',paidRepairsEnabled:true}),signed=await signedControllerResultFixture()
 const github={...f.client,descriptor:async()=>({headSha:sha})},nonce=f.externalId.split(':')[2],opened=[]
 const record={id:f.manifest.incidentId,baseSha:f.manifest.baseSha,repairClass:f.manifest.repairClass,attemptsUsed:1,wakeAt:f.clock.clock-1000,
  pending:{action:'EXECUTE',nonce,externalId:f.externalId}}
 const authority={manifest:f.manifest},permitId=randomUUID()
 const budget={openAttempt:async(id,value)=>{opened.push({id,...value});return {incidentId:id,...value,permitId}}}
 const disabled=createQualityControllerJobActions({github,keysByRole:signed.keys,budget,now:()=>f.clock.clock})
 await assert.rejects(disabled.bind('EXECUTE',{record,nonce,authority}),{code:'PAID_REPAIRS_DISABLED'})
 await assert.rejects(disabled.dispatch('EXECUTE',{record,intent:record.pending,authority}),{code:'PAID_REPAIRS_DISABLED'})
 assert.equal(opened.length,0);assert.equal(f.calls.length,0)
 const actions=createQualityControllerJobActions({github,keysByRole:signed.keys,budget,paidRepairsEnabled:true,now:()=>f.clock.clock})
 await actions.dispatch('EXECUTE',{record,intent:record.pending,authority})
 assert.equal(opened.length,1);assert.equal(opened[0].attemptId,nonce);assert.equal(opened[0].ordinal,1)
 assert.equal(opened[0].expiresAt,f.manifest.mandate.expiresAt)
 assert.equal(JSON.parse(f.calls.find(c=>c.method==='POST').body).inputs.permit_id,permitId)
 // A new process only reconciles an existing intent; it never opens or dispatches another attempt.
 const restarted=createQualityControllerJobActions({github,keysByRole:signed.keys,budget,paidRepairsEnabled:true,now:()=>f.clock.clock})
 assert.equal((await restarted.reconcile(record.pending,{record,authority})).state,'UNKNOWN')
 assert.equal(opened.length,1);assert.equal(f.calls.filter(c=>c.method==='POST').length,1)
})
test('stale reproduction foreign ordinal or uncertain native permit cannot cause a model or GitHub dispatch',async()=>{
 const {createQualityControllerJobActions}=await import('../src/github.mjs'),signed=await signedControllerResultFixture()
 for(const kind of ['stale','ordinal','foreign-native','lost-native-reply']){
  const f=await controllerJobFixture({action:'EXECUTE',paidRepairsEnabled:true}),nonce=f.externalId.split(':')[2];let calls=0
  const record={id:f.manifest.incidentId,baseSha:f.manifest.baseSha,repairClass:f.manifest.repairClass,attemptsUsed:1,wakeAt:f.clock.clock-1000,
   pending:{action:'EXECUTE',nonce,externalId:f.externalId}}
  if(kind==='stale')record.wakeAt=f.clock.clock-1800001
  if(kind==='ordinal')record.attemptsUsed=3
  const budget={openAttempt:async(id,value)=>{calls++;if(kind==='lost-native-reply')throw Object.assign(Error('native result unknown'),{code:'POLICY_UNAVAILABLE'})
   return {incidentId:kind==='foreign-native'?randomUUID():id,...value,permitId:randomUUID()}}}
  const actions=createQualityControllerJobActions({github:{...f.client,descriptor:async()=>({headSha:sha})},keysByRole:signed.keys,budget,paidRepairsEnabled:true,now:()=>f.clock.clock})
  await assert.rejects(actions.dispatch('EXECUTE',{record,intent:record.pending,authority:{manifest:f.manifest}}))
  assert.equal(f.calls.length,0);assert.equal(calls,['stale','ordinal'].includes(kind)?0:1)
 }
})

async function controllerPatchFixture(options={}){
 const {createHash}=await import('node:crypto'),{documentDigest}=await import('../src/manifest.mjs')
 const f=await signedControllerResultFixture('EXECUTE')
 const beforeSource='export function synthetic(v:number){return v}\n',source='export function synthetic(v:number){return v+1}\n'
 const hash=v=>createHash('sha256').update(v).digest('hex')
 const patch={schemaVersion:'AQC_PATCH_V1',incidentId:f.manifest.incidentId,baseSha:old,
  gateSetSha256:f.manifest.gateSetSha256,manifestSha256:documentDigest(f.manifest),files:[
   {path:f.manifest.allowedPaths[0],beforeSha256:hash(beforeSource),afterSha256:hash(source),content:source},
   {path:f.manifest.allowedPaths[1],beforeSha256:null,afterSha256:hash('synthetic inert regression\n'),content:'synthetic inert regression\n'}]}
 const tree=files=>documentDigest(files.map(({path,beforeSha256,afterSha256})=>({path,beforeSha256,afterSha256})))
 const body={...f.body,result:{result:'PATCH',baseSha:old,patch:{artifactSha256:documentDigest(patch),treeSha256:tree(patch.files)}}}
 if(options.resultChange)options.resultChange(body)
 f.state.run=f.native({status:'completed',conclusion:'success',created_at:new Date(f.context.now-1000).toISOString()})
 const install=async(document,kind,zipOptions={})=>{
  f.state.archive=await controllerResultZip(typeof document==='string'?document:JSON.stringify(document),{name:kind+'.json',...zipOptions})
  f.state.artifacts={total_count:1,artifacts:[{id:801,name:'aqc-'+kind+'-'+f.externalId.split(':')[2],expired:false,
   size_in_bytes:f.state.archive.length,digest:'sha256:'+hash(f.state.archive),workflow_run:{id:701,head_sha:sha}}]}
 }
 await install(f.sign(body,options.signer??'EXECUTOR_SUPERVISOR'),'result')
 const resultObservation=await f.client.controllerJobResult({externalId:f.externalId,runId:'701'})
 if(options.patchChange)options.patchChange(patch)
 await install(options.payload??patch,'patch',options.zip??{})
 let patchObservation
 if(options.readPatch!==false)patchObservation=await f.client.controllerJobPatch({externalId:f.externalId,runId:'701'})
 return {...f,patch,beforeSource,body,resultObservation,patchObservation,install,
  readInput:()=>({resultObservation,patchObservation,beforeSource,...f.context})}
}
test('native executor patch provenance requires both exact artifacts and remains independently unaccepted',async()=>{
 const {readQualityControllerPatch}=await import('../src/github.mjs')
 for(const zip of [{},{stream:true},{method:'store'}]){
  const f=await controllerPatchFixture({zip}),observed=readQualityControllerPatch(f.readInput())
  assert.deepEqual(observed.body,f.patch);assert.equal(observed.independentVerified,false)
  assert.equal(observed.artifactSha256,f.body.result.patch.artifactSha256)
  assert.equal(Object.isFrozen(observed.body.files[0]),true)
  assert.equal(f.calls.some(c=>c.method!=='GET'),false)
  const storage=f.calls.filter(c=>c.url.startsWith('https://productionresultssa-fixture.blob.core.windows.net/'))
  assert.equal(storage.length,2);assert(storage.every(c=>!new Headers(c.headers).has('authorization')))
 }
})
test('patch provenance refuses invented cloned or mixed-client observations and post-download mutation',async()=>{
 const {readQualityControllerPatch}=await import('../src/github.mjs')
 const f=await controllerPatchFixture(),g=await controllerPatchFixture()
 for(const input of [
  {...f.readInput(),resultObservation:structuredClone(f.resultObservation)},
  {...f.readInput(),patchObservation:structuredClone(f.patchObservation)},
  {...f.readInput(),patchObservation:g.patchObservation},
  {...f.readInput(),patchObservation:{state:'COMPLETE',document:f.patch}}]){
  assert.throws(()=>readQualityControllerPatch(input),{code:'CONTROLLER_PATCH_NATIVE_ARTIFACT_REQUIRED'})
 }
 f.patchObservation.document.files[0].content+='changed'
 assert.throws(()=>readQualityControllerPatch(f.readInput()),{code:'CONTROLLER_PATCH_NATIVE_BINDING_INVALID'})
})
test('native patch cannot borrow another run, nonce, incident, workflow or expired supervisor authority',async()=>{
 const {readQualityControllerPatch}=await import('../src/github.mjs')
 const f=await controllerPatchFixture()
 for(const change of [{runId:'702'},{workflowId:'992'},{externalId:f.externalId.replace(f.context.record.pending.nonce,randomUUID())},
  {record:{...f.context.record,id:randomUUID()}},{now:f.context.now+30001}]){
  assert.throws(()=>readQualityControllerPatch({...f.readInput(),...change}))
 }
 const wrongSigner=await controllerPatchFixture({signer:'INDEPENDENT_VERIFIER'})
 assert.throws(()=>readQualityControllerPatch(wrongSigner.readInput()))
})
test('patch and tree digests must both match the separately signed executor result',async()=>{
 const {readQualityControllerPatch}=await import('../src/github.mjs')
 for(const name of ['artifactSha256','treeSha256']){
  const f=await controllerPatchFixture({resultChange:b=>{b.result.patch[name]='f'.repeat(64)}})
  assert.throws(()=>readQualityControllerPatch(f.readInput()),{code:'CONTROLLER_PATCH_DIGEST_MISMATCH'})
 }
 const f=await controllerPatchFixture({patchChange:p=>{p.files[0].content+='changed'}})
 assert.throws(()=>readQualityControllerPatch(f.readInput()),{code:'PATCH_FILE_MISMATCH'})
})
test('native patch retains exact manifest paths, original source hash and two-file byte limits',async()=>{
 const {readQualityControllerPatch}=await import('../src/github.mjs')
 for(const change of [p=>p.files[0].path='unapproved.ts',p=>p.files[1].path=p.files[0].path,
  p=>p.incidentId=randomUUID(),p=>p.files.pop(),p=>p.files[0].beforeSha256='f'.repeat(64)]){
  const f=await controllerPatchFixture({patchChange:change})
  assert.throws(()=>readQualityControllerPatch(f.readInput()))
 }
 const f=await controllerPatchFixture()
 assert.throws(()=>readQualityControllerPatch({...f.readInput(),beforeSource:'foreign source'}),{code:'PATCH_BASE_MISMATCH'})
})
test('patch ZIP refuses archive paths, symlinks, ZIP64, additional entries and decompression bombs',async()=>{
 for(const zip of [{name:'../patch.json'},{name:'result.json'},{mode:0o120600},{zip64:true},{second:true}]){
  const f=await controllerPatchFixture({readPatch:false,zip})
  await assert.rejects(f.client.controllerJobPatch({externalId:f.externalId,runId:'701'}),{code:'CONTROLLER_JOB_RESULT_ARCHIVE_INVALID'})
 }
 const bomb=await controllerPatchFixture({readPatch:false,payload:'x'.repeat(65537)})
 await assert.rejects(bomb.client.controllerJobPatch({externalId:bomb.externalId,runId:'701'}),{code:'CONTROLLER_JOB_RESULT_ARCHIVE_INVALID'})
 const corrupt=await controllerPatchFixture({readPatch:false})
 corrupt.state.archive[40]^=1
 await assert.rejects(corrupt.client.controllerJobPatch({externalId:corrupt.externalId,runId:'701'}),{code:'CONTROLLER_JOB_RESULT_ARTIFACT_INVALID'})
})
test('only native EXECUTE can expose a patch artifact and missing artifact is not a patch',async()=>{
 const {readQualityControllerPatch}=await import('../src/github.mjs'),free=await controllerJobFixture()
 await assert.rejects(free.client.controllerJobPatch({externalId:free.externalId,runId:'701'}),{code:'CONTROLLER_PATCH_EXECUTOR_REQUIRED'})
 assert.equal(free.calls.length,0)
 const f=await controllerPatchFixture({readPatch:false})
 f.state.artifacts={total_count:0,artifacts:[]}
 const missing=await f.client.controllerJobPatch({externalId:f.externalId,runId:'701'})
 assert.equal(missing.state,'UNKNOWN')
 assert.throws(()=>readQualityControllerPatch({...f.readInput(),patchObservation:missing}),{code:'CONTROLLER_PATCH_NATIVE_ARTIFACT_REQUIRED'})
})
test('patch download has its own fixed bound while original result bound is preserved',async()=>{
 for(const changes of [{downloadDeclaredSize:131073},{downloadDeclaredSize:0,downloadBody:Buffer.alloc(131073)}]){
  const f=await controllerPatchFixture({readPatch:false});Object.assign(f.state,changes)
  await assert.rejects(f.client.controllerJobPatch({externalId:f.externalId,runId:'701'}),{code:'CONTROLLER_JOB_RESULT_DOWNLOAD_INVALID'})
 }
 const f=await controllerPatchFixture({readPatch:false})
 f.state.artifacts.artifacts[0].name='aqc-result-'+f.externalId.split(':')[2]
 f.state.archive=await controllerResultZip(JSON.stringify({value:'x'.repeat(17000)}))
 const {createHash}=await import('node:crypto')
 f.state.artifacts.artifacts[0].size_in_bytes=f.state.archive.length
 f.state.artifacts.artifacts[0].digest='sha256:'+createHash('sha256').update(f.state.archive).digest('hex')
 await assert.rejects(f.client.controllerJobResult({externalId:f.externalId,runId:'701'}),{code:'CONTROLLER_JOB_RESULT_ARCHIVE_INVALID'})
})

test('only privately verified native results can attach exact provenance indexes to an unchanged semantic transition',async()=>{
 const {createQualityControllerJobActions}=await import('../src/github.mjs'),{advanceIncident}=await import('../src/controller.mjs')
 const f=await controllerArtifactFixture();f.state.runs=[f.state.run]
 const github={...f.client,descriptor:async()=>({headSha:sha})}
 const actions=createQualityControllerJobActions({github,keysByRole:f.keys,jobStateEnabled:true,now:()=>f.clock.clock})
 const record=f.context.record,authority={manifest:f.manifest},context={record,authority}
 const received=await actions.reconcile(record.pending,context),verified=await actions.verify('QUALIFY',received.result,context)
 const changed=advanceIncident(record,'QUALIFY',verified,f.clock.clock),input={...context,changed,completedAt:f.clock.clock}
 const retained=actions.retain(verified,input),reference=retained.reproduction.nativeJobs.qualify
 assert.equal(reference.externalId,f.externalId);assert.equal(reference.runId,'701');assert.equal(reference.workflowId,'991')
 assert.equal(reference.artifactSha256,f.state.artifacts.artifacts[0].digest.slice(7))
 const {documentDigest}=await import('../src/manifest.mjs')
 assert.equal(reference.documentSha256,documentDigest(f.sign()))
 assert.throws(()=>actions.retain(structuredClone(verified),input),{code:'CONTROLLER_JOB_NATIVE_RESULT_REQUIRED'})
 assert.throws(()=>actions.retain(verified,{...input,changed:{...changed,status:'CLOSED'}}),{code:'CONTROLLER_JOB_RESULT_BINDING_INVALID'})
 assert.throws(()=>actions.retain(verified,{...input,completedAt:f.clock.clock+1}),{code:'CONTROLLER_JOB_RESULT_BINDING_INVALID'})
})
test('native result reference is revalidated for expiry after asynchronous verification',async()=>{
 const {createQualityControllerJobActions}=await import('../src/github.mjs'),{advanceIncident}=await import('../src/controller.mjs')
 const f=await controllerArtifactFixture();f.state.runs=[f.state.run]
 const actions=createQualityControllerJobActions({github:{...f.client,descriptor:async()=>({headSha:sha})},
  keysByRole:f.keys,jobStateEnabled:true,now:()=>f.clock.clock})
 const context={record:f.context.record,authority:{manifest:f.manifest}},received=await actions.reconcile(f.context.record.pending,context)
 const verified=await actions.verify('QUALIFY',received.result,context),changed=advanceIncident(context.record,'QUALIFY',verified,f.clock.clock)
 const completedAt=f.clock.clock;f.clock.clock+=30001
 assert.throws(()=>actions.retain(verified,{...context,changed,completedAt}))
})
test('controller persists exact native result reference and dispatches the next phase after a process restart',async()=>{
 const {createQualityControllerJobActions}=await import('../src/github.mjs'),{createQualityController}=await import('../src/controller.mjs')
 const {assertControlRecord}=await import('../src/store.mjs'),{documentDigest}=await import('../src/manifest.mjs')
 const f=await controllerArtifactFixture();let record={id:f.manifest.incidentId,revision:1,status:'OBSERVED',repairClass:'C1',
  causeFingerprint:digest,baseSha:old,attemptsUsed:0,rollbacksUsed:0,wakeAt:0,pending:null}
 const store={claim:async()=>({record:structuredClone(record),leaseToken:'synthetic-lease'}),
  prepare:async o=>{record={...record,revision:record.revision+1,pending:{action:o.action,nonce:o.nonce,externalId:o.externalId}};return {record:structuredClone(record)}},
  recordExternal:async()=>assert.fail('native intent is already bound'),
  complete:async o=>{assertControlRecord(o.record);record={...o.record,revision:record.revision+1};return structuredClone(record)},
  stop:async()=>assert.fail('verified phases must not stop'),release:async()=>{}}
 const github={...f.client,descriptor:async()=>({headSha:sha})},authority={manifest:f.manifest}
 const actions=()=>createQualityControllerJobActions({github,keysByRole:f.keys,jobStateEnabled:true,now:()=>f.clock.clock})
 const controller=()=>createQualityController({store,actions:actions(),authorize:async()=>authority,
  budget:{ensureIncident:async()=>assert.fail('no cost for qualification or reproduction'),closeIncident:async()=>{}},
  now:()=>f.clock.clock,workerId:'synthetic-state-controller'})
 await controller().tick(record.id)
 const nonce=record.pending.nonce
 f.state.run=f.native({display_title:'AQC JOB QUALIFY '+nonce,status:'completed',conclusion:'success',created_at:new Date(f.clock.clock-1000).toISOString()})
 f.state.runs=[f.state.run];f.state.archive=await controllerResultZip(JSON.stringify(f.sign({...f.body,nonce})))
 f.state.artifacts.artifacts[0].name='aqc-result-'+nonce;f.refresh()
 assert.equal((await controller().tick(record.id)).status,'TRIAGED')
 assert.equal(record.pending,null);assert.equal(record.reproduction.nativeJobs.qualify.externalId,'aqc-job:'+sha+':'+nonce+':QUALIFY')
 const ref=record.reproduction.nativeJobs.qualify
 assert.equal(ref.documentSha256,documentDigest(f.sign({...f.body,nonce})))
 await controller().tick(record.id)
 assert.equal(record.pending.action,'REPRODUCE')
 const posts=f.calls.filter(c=>c.method==='POST');assert.equal(posts.length,2)
 const state=JSON.parse(JSON.parse(posts[1].body).inputs.state)
 assert.deepEqual(state.record.reproduction.nativeJobs.qualify,ref)
})
