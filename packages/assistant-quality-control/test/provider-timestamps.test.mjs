import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash,randomUUID,generateKeyPairSync} from 'node:crypto'
import {createQualityGitHub,assertQualityControllerJobInvocation,readQualityGitHubCreatedAt} from '../src/github.mjs'
import {EXECUTOR_TOOL,verifyLinuxQualification} from '../src/executor.mjs'
import {signDocument,publicKeyId} from '../src/manifest.mjs'

test('GitHub UTC-second metadata normalizes to the same instant without relaxing signed timestamps',()=>{
 assert.equal(readQualityGitHubCreatedAt('2026-11-19T09:31:47Z'),'2026-11-19T09:31:47.000Z')
 assert.equal(readQualityGitHubCreatedAt('2026-11-19T09:31:47.123Z'),'2026-11-19T09:31:47.123Z')
 for(const v of ['2026-02-30T09:31:47Z','2026-11-19T25:31:47Z','2026-11-19T09:31:60Z',
  '2026-11-19T09:31:47+00:00','2026-11-19T09:31:47.1Z','2026-11-19T09:31:47.0000Z','2026-11-19',0,null,{}])
  assert.throws(()=>readQualityGitHubCreatedAt(v),{code:'GITHUB_PROVIDER_TIMESTAMP_INVALID'})
})
function fixture(createdAt){
 const source='a'.repeat(40),nonce=randomUUID(),runId='1001',workflow=Buffer.from('name: inert timestamp transport fixture')
 const workflowSha256=createHash('sha256').update(workflow).digest('hex')
 const blob=createHash('sha1').update('blob '+workflow.length+'\0').update(workflow).digest('hex')
 const f={at:Date.parse('2026-11-19T09:31:48.000Z'),run:{id:1001,workflow_id:123,head_sha:source,head_branch:'main',
  path:'.github/workflows/assistant-quality-repair.yml',event:'workflow_dispatch',run_attempt:1,repository:{full_name:'profitia/SG-dev'},
  actor:{login:'profitia'},triggering_actor:{login:'profitia'},display_title:'AQC JOB QUALIFY '+nonce,
  status:'in_progress',conclusion:null,created_at:createdAt},externalId:'aqc-job:'+source+':'+nonce+':QUALIFY',runId}
 const fetchImpl=async url=>{
  let v
  if(url.endsWith('/actions/workflows/assistant-quality-repair.yml'))v={id:123,path:'.github/workflows/assistant-quality-repair.yml',state:'active'}
  else if(url.includes('/contents/'))v={type:'file',path:'.github/workflows/assistant-quality-repair.yml',
   encoding:'base64',sha:blob,size:workflow.length,content:workflow.toString('base64')}
  else if(url.endsWith('/actions/runs/'+runId))v=f.run
  else throw Error('Unexpected fixed timestamp fixture request')
  return new Response(JSON.stringify(v),{status:200})
 }
 f.github=createQualityGitHub({token:'inert-fixture-reader',fetchImpl,controllerWorkflowSha256:workflowSha256,now:()=>f.at})
 return f
}
test('actual seconds-shaped GitHub native invocation mints only the original canonical metadata capability',async()=>{
 for(const createdAt of ['2026-11-19T09:31:47Z','2026-11-19T09:31:47.000Z']){
  const f=fixture(createdAt),cap=await f.github.controllerJobInvocation({externalId:f.externalId,runId:f.runId})
  const value=assertQualityControllerJobInvocation(cap,{externalId:f.externalId,runId:f.runId})
  assert.equal(value.createdAt,'2026-11-19T09:31:47.000Z')
  assert.equal(value.controlSourceSha,'a'.repeat(40))
 }
})
test('provider normalization cannot revive a future, expired, completed or foreign native invocation',async()=>{
 for(const change of [
  f=>f.at=Date.parse(f.run.created_at)-1,f=>f.at=Date.parse(f.run.created_at)+1800001,
  f=>f.run.status='completed',f=>f.run.conclusion='success',
 ]){
  const f=fixture('2026-11-19T09:31:47Z');change(f)
  await assert.rejects(f.github.controllerJobInvocation({externalId:f.externalId,runId:f.runId}),{code:'CONTROLLER_JOB_INVOCATION_REQUIRED'})
 }
 const f=fixture('2026-11-19T09:31:47Z');f.run.actor.login='other'
 await assert.rejects(f.github.controllerJobInvocation({externalId:f.externalId,runId:f.runId}),{code:'CONTROLLER_JOB_PROVENANCE_MISMATCH'})
 const invalid=fixture('2026-02-30T09:31:47Z')
 await assert.rejects(invalid.github.controllerJobInvocation({externalId:invalid.externalId,runId:invalid.runId}),{code:'GITHUB_PROVIDER_TIMESTAMP_INVALID'})
})
test('signed Linux qualification still refuses noncanonical timestamps after provider-only normalization',()=>{
 const signer=generateKeyPairSync('ed25519'),keys=new Map([[publicKeyId(signer.publicKey),signer.publicKey]])
 const body={gateSetSha256:'a'.repeat(64),codexVersion:EXECUTOR_TOOL.version,codexArchiveSha256:EXECUTOR_TOOL.archiveSha256,
  codexBinarySha256:'b'.repeat(64),codeModeHostArchiveSha256:EXECUTOR_TOOL.codeModeHostArchiveSha256,
  codeModeHostBinarySha256:EXECUTOR_TOOL.codeModeHostBinarySha256,bwrapArchiveSha256:EXECUTOR_TOOL.bwrapArchiveSha256,
  bwrapBinarySha256:EXECUTOR_TOOL.bwrapBinarySha256,isolationHelperCommit:EXECUTOR_TOOL.isolationHelperCommit,
  fileIsolation:'PASS',networkIsolation:'PASS',privilegeIsolation:'PASS',toolLoop:'PASS',cancellation:'PASS',
  noProviderRequests:true,runId:'1001',sourceSha:'a'.repeat(40),verifiedAt:'2026-11-19T09:31:47.000Z',expiresAt:'2026-11-19T09:32:47.000Z'}
 const options={keys,gateSetSha256:body.gateSetSha256,now:Date.parse('2026-11-19T09:31:48.000Z')}
 verifyLinuxQualification(signDocument('AQC_LINUX_QUALIFICATION_V1',body,signer.privateKey),options)
 for(const field of ['verifiedAt','expiresAt']){
  const changed={...body,[field]:body[field].replace('.000Z','Z')}
  assert.throws(()=>verifyLinuxQualification(signDocument('AQC_LINUX_QUALIFICATION_V1',changed,signer.privateKey),options),{code:'LINUX_QUALIFICATION_REQUIRED'})
 }
})
