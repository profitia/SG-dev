import test from 'node:test'
import assert from 'node:assert/strict'
import {createQualityRelease} from '../src/release.mjs'
import {createQualityGitHub} from '../src/github.mjs'
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
