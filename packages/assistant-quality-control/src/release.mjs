import {documentDigest} from './manifest.mjs'

const SERVICE='srv-dapa3tid0e5s73f8bc5g',WORKSPACE='tea-d7lps8rbc2fs73cn80dg'
const fail=code=>{throw Object.assign(Error('Quality release unavailable'),{code})}
const require=(v,c='RELEASE_INPUT_INVALID')=>{if(!v)fail(c)}
const sha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v)
const id=v=>typeof v==='string'&&/^dep-[a-z0-9]{10,40}$/.test(v)
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
const safeStates=['created','build_in_progress','update_in_progress','pre_deploy_in_progress','live','build_failed','update_failed','pre_deploy_failed','canceled','deactivated']

/** One fixed Development target. The agent receives neither this credential nor
 * this client. Delivery uncertainty is reconciled by durable provider ID/nonce;
 * this adapter never automatically repeats a deploy or rollback POST. */
export function createQualityRelease({token,fetchImpl=fetch,promotionEnabled=false,verifyRuntime}){
 require(typeof token==='string'&&token.length>0&&typeof fetchImpl==='function'
  &&typeof promotionEnabled==='boolean'&&typeof verifyRuntime==='function','RELEASE_CONFIGURATION_REQUIRED')
 async function request(path,body){
  let response
  try{response=await fetchImpl('https://api.render.com/v1/services/'+SERVICE+path,{
   method:body===undefined?'GET':'POST',redirect:'error',signal:AbortSignal.timeout(15000),
   headers:{Authorization:'Bearer '+token,Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json'})},
   ...(body===undefined?{}:{body:JSON.stringify(body)})})}
  catch{fail(body===undefined?'PROVIDER_UNAVAILABLE':'DELIVERY_UNCERTAIN')}
  if(response.status===401)fail('AUTHENTICATION_REJECTED')
  if(response.status===403)fail('PERMISSION_REJECTED')
  if(!response.ok)fail(body!==undefined&&response.status>=500?'DELIVERY_UNCERTAIN':'PROVIDER_UNAVAILABLE')
  const text=await response.text();require(Buffer.byteLength(text)<=1048576,'RELEASE_RESPONSE_TOO_LARGE')
  try{return JSON.parse(text)}catch{fail('RELEASE_RESPONSE_INVALID')}
 }
 function deployment(v){
  require(v&&id(v.id)&&sha(v.commit?.id)&&safeStates.includes(v.status),'DEPLOYMENT_IDENTITY_INVALID')
  return v
 }
 async function descriptor(){
  const s=await request('')
  require(s?.id===SERVICE&&s.ownerId===WORKSPACE&&s.type==='web_service'&&s.branch==='main'
   &&s.repo==='https://github.com/profitia/SG-dev'&&s.serviceDetails?.url==='https://dev-sg2.spendguru.app','RELEASE_TARGET_MISMATCH')
  require(s.autoDeploy==='no','AUTOMATIC_DEPLOYMENT_NOT_DISABLED')
  return {serviceId:SERVICE,workspaceId:WORKSPACE,promotionEnabled}
 }
 async function current(){
  const list=await request('/deploys?limit=20')
  require(Array.isArray(list)&&list.length<=20,'DEPLOYMENT_LIST_INVALID')
  const deployments=list.map(v=>deployment(v.deploy))
  if(deployments.some(d=>['created','build_in_progress','update_in_progress','pre_deploy_in_progress'].includes(d.status)))fail('FOREIGN_DEPLOYMENT')
  const live=deployments.filter(d=>d.status==='live')
  require(live.length===1,'LIVE_DEPLOYMENT_UNVERIFIED')
  return live[0]
 }
 async function independent(verify,claim){
  require(typeof verify==='function','INDEPENDENT_RELEASE_PROOF_REQUIRED')
  const proof=await verify(claim)
  require(proof?.verified===true&&proof.sourceSha===claim.sourceSha&&digest(proof.proofSha256)
   &&digest(proof.configurationSha256),'INDEPENDENT_RELEASE_PROOF_REQUIRED')
  return proof
 }
 return Object.freeze({
  descriptor,current,
  async deploy({sourceSha,expectedDeployId,lkg,verifyIndependent}){
   if(!promotionEnabled)fail('PROMOTION_DISABLED')
   require(sha(sourceSha)&&id(expectedDeployId)&&id(lkg?.deployId)&&sha(lkg?.sourceSha))
   const proof=await independent(verifyIndependent,{sourceSha,expectedDeployId,lkg})
   await descriptor()
   const live=await current()
   require(live.id===expectedDeployId&&live.id===lkg.deployId&&live.commit.id===lkg.sourceSha,'FOREIGN_DEPLOYMENT')
   // Ensure the retained LKG is actually responding before changing the target.
   const before=await verifyRuntime({serviceId:SERVICE,sourceSha:lkg.sourceSha,deployId:lkg.deployId})
   require(before?.sourceSha===lkg.sourceSha&&before.verified===true,'LAST_KNOWN_GOOD_UNVERIFIED')
   const d=deployment(await request('/deploys',{commitId:sourceSha,clearCache:'do_not_clear'}))
   require(d.commit.id===sourceSha,'DEPLOYMENT_SOURCE_MISMATCH')
   return {state:'RUNNING',deployId:d.id,sourceSha,lastKnownGoodSha:lkg.sourceSha,lastKnownGoodDeployId:lkg.deployId,
    configurationSha256:proof.configurationSha256,artifactSha256:proof.proofSha256}
  },
  async reconcile(release){
   require(id(release?.deployId)&&sha(release.sourceSha)&&sha(release.lastKnownGoodSha)
    &&digest(release.artifactSha256)&&digest(release.configurationSha256))
   await descriptor()
   const d=deployment(await request('/deploys/'+release.deployId))
   require(d.commit.id===release.sourceSha,'DEPLOYMENT_SOURCE_MISMATCH')
   if(d.status!=='live')return {state:['build_failed','update_failed','pre_deploy_failed','canceled'].includes(d.status)?'FAILED':'RUNNING'}
   let live
   try{live=await current()}catch(e){if(e.code==='FOREIGN_DEPLOYMENT')return {state:'COMPLETE',result:{result:'FOREIGN_DEPLOYMENT'}};throw e}
   if(live.id!==d.id)return {state:'COMPLETE',result:{result:'FOREIGN_DEPLOYMENT'}}
   const actual=await verifyRuntime({serviceId:SERVICE,deployId:d.id,sourceSha:release.sourceSha})
   if(actual?.verified!==true||actual.sourceSha!==release.sourceSha)return {state:'UNKNOWN'}
   return {state:'COMPLETE',result:{result:'RELEASED',sourceSha:release.sourceSha,deployId:d.id,lastKnownGoodSha:release.lastKnownGoodSha,
    artifactSha256:release.artifactSha256,configurationSha256:release.configurationSha256,exactRuntimeVerified:true}}
  },
  async rollback({release,verifyIndependent}){
   if(!promotionEnabled)fail('PROMOTION_DISABLED')
   require(id(release?.deployId)&&sha(release.sourceSha)&&id(release.lastKnownGoodDeployId)&&sha(release.lastKnownGoodSha))
   await independent(verifyIndependent,{sourceSha:release.lastKnownGoodSha,release})
   await descriptor()
   const live=await current()
   if(live.id!==release.deployId||live.commit.id!==release.sourceSha)return {result:'FOREIGN_DEPLOYMENT'}
   const lkg=deployment(await request('/deploys/'+release.lastKnownGoodDeployId))
   require(lkg.commit.id===release.lastKnownGoodSha&&['live','deactivated'].includes(lkg.status),'LAST_KNOWN_GOOD_UNVERIFIED')
   const d=deployment(await request('/rollback',{deployId:lkg.id}))
   require(d.commit.id===lkg.commit.id,'ROLLBACK_SOURCE_MISMATCH')
   return {state:'RUNNING',deployId:d.id,sourceSha:lkg.commit.id}
  },
  async verifyRestored({deployId,sourceSha}){
   require(id(deployId)&&sha(sourceSha));await descriptor()
   const live=await current()
   if(live.id!==deployId||live.commit.id!==sourceSha)return {result:'FOREIGN_DEPLOYMENT'}
   const actual=await verifyRuntime({serviceId:SERVICE,deployId,sourceSha})
   if(actual?.verified!==true||actual.sourceSha!==sourceSha)return {result:'UNKNOWN'}
   require(digest(actual.proofSha256),'RUNTIME_PROOF_REQUIRED')
   return {result:'RESTORED',sourceSha,exactRuntimeVerified:true,proofSha256:documentDigest({deployId,sourceSha,proof:actual.proofSha256})}
  },
 })
}
