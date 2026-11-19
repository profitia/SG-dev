import test from 'node:test'
import assert from 'node:assert/strict'
import {generateKeyPairSync} from 'node:crypto'
import {mkdtempSync,cpSync,copyFileSync,appendFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {publicKeyId} from '../src/manifest.mjs'
import {qualificationPolicyDigest} from '../src/acceptance.mjs'
import {runQualityNativeExecutorJob,readQualityExecutorLimitsConfiguration,readQualityExecutorPilotWindow} from '../src/executor-job.mjs'

const serviceId='b40f45e8-4df0-4377-b80e-2afce4ea3941'
const databaseUrl='postgresql://profitia_limits_quality_broker:test-password@ep-muddy-surf-b9vpyy2d.c-7.eu-central-1.aws.neon.tech/neondb?sslmode=require'
const configuration=()=>({databaseUrl,commandKey:'a'.repeat(64),serviceId})
function input(action='EXECUTE'){
 const supervisor=generateKeyPairSync('ed25519'),verifier=generateKeyPairSync('ed25519'),publisher=generateKeyPairSync('ed25519')
 const keys=pair=>new Map([[publicKeyId(pair.publicKey),pair.publicKey]])
 return {inputs:{mode:'controller-job',action,nonce:'56bf1afa-8215-4cee-ae89-c0dedc7962aa',
  control_source_sha:'a'.repeat(40),incident_id:'37b9fea1-881a-45e2-ab91-5705cbe1de59',
  manifest_sha256:'b'.repeat(64),base_sha:'c'.repeat(40),state:'{}',
  ...(action==='EXECUTE'?{permit_id:'d9d5e04e-2029-42c7-b0e9-a598fe6e9c1c',permit_expires_at:new Date(Date.now()+60000).toISOString()}: {})},
  token:'inert-unit-reader',controllerWorkflowSha256:'b'.repeat(64),registry:{},ownerKeys:new Map(),
  verifierKeys:keys(verifier),keysByRole:new Map([['INDEPENDENT_VERIFIER',keys(verifier)],
   ['EXECUTOR_SUPERVISOR',keys(supervisor)],['INDEPENDENT_PUBLISHER',keys(publisher)]]),
  expectedServiceId:'srv-fixture',expectedGateSetSha256:'b'.repeat(64),repositoryRoot:'/nonexistent-unit-source',
  qualification:{},qualificationKeys:new Map(),privateKey:supervisor.privateKey,
  limitsDatabaseUrl:databaseUrl,limitsCommandKey:'d'.repeat(64),limitsServiceId:serviceId,openaiKey:'inert-unit-value'}
}
test('native executor admits only the fixed ordinary Limits broker connection with strict TLS',()=>{
 const c=readQualityExecutorLimitsConfiguration(configuration())
 assert.equal(c.connection.user,'profitia_limits_quality_broker');assert.equal(c.connection.database,'neondb')
 assert.equal(c.connection.ssl.rejectUnauthorized,true);assert.equal(Object.isFrozen(c.connection.ssl),true)
 const pooled=readQualityExecutorLimitsConfiguration({...configuration(),databaseUrl:databaseUrl.replace('.c-7.','-pooler.c-7.')+'&channel_binding=require'})
 assert.equal(pooled.connection.enableChannelBinding,true);assert.equal(pooled.connection.ssl.rejectUnauthorized,true)
})
test('executor Limits binding refuses foreign role database endpoint TLS override query and credential getters',()=>{
 for(const value of [databaseUrl.replace('quality_broker','quality_controller'),databaseUrl.replace('/neondb?','/platform_private?'),
  databaseUrl.replace('ep-muddy-surf-b9vpyy2d','ep-foreign'),databaseUrl.replace('sslmode=require','sslmode=disable'),
  databaseUrl+'&sslmode=require',databaseUrl+'&options=-csearch_path=public',databaseUrl+'&ssl=false',
  databaseUrl+'#fragment',databaseUrl.replace('test-password','%FF')])
  assert.throws(()=>readQualityExecutorLimitsConfiguration({...configuration(),databaseUrl:value}),{code:'NATIVE_EXECUTOR_LIMITS_BINDING_INVALID'})
 for(const extra of [{query:()=>{}},{ssl:{rejectUnauthorized:false}},{now:()=>0}])
  assert.throws(()=>readQualityExecutorLimitsConfiguration({...configuration(),...extra}),{code:'NATIVE_EXECUTOR_INPUT_INVALID'})
 let called=0;const c=configuration();Object.defineProperty(c,'databaseUrl',{enumerable:true,get(){called++;throw Error('never read')}})
 assert.throws(()=>readQualityExecutorLimitsConfiguration(c),{code:'NATIVE_EXECUTOR_INPUT_INVALID'});assert.equal(called,0)
})
test('enabled native Limits may remain unstarted until its original first DISPATCH clock rule',()=>{
 const value={status:'ENABLED',maximumNanoUsd:'50000000000',pilotStartedAt:null,pilotExpiresAt:null}
 const result=readQualityExecutorPilotWindow(value);assert.equal(result.started,false);assert.equal(Object.isFrozen(result),true)
 assert.deepEqual(value,{status:'ENABLED',maximumNanoUsd:'50000000000',pilotStartedAt:null,pilotExpiresAt:null})
 const started={...value,pilotStartedAt:new Date(Date.now()-60000).toISOString(),pilotExpiresAt:new Date(Date.now()+60000).toISOString()}
 assert.equal(readQualityExecutorPilotWindow(started).started,true)
})
test('disabled partial future expired overlong or increased native pilot status never permits execution',()=>{
 const base={status:'ENABLED',maximumNanoUsd:'50000000000',pilotStartedAt:null,pilotExpiresAt:null}
 for(const change of [{status:'DISABLED'},{maximumNanoUsd:'50000000001'},{pilotExpiresAt:new Date(Date.now()+60000).toISOString()},
  {pilotStartedAt:new Date(Date.now()+60000).toISOString(),pilotExpiresAt:new Date(Date.now()+120000).toISOString()},
  {pilotStartedAt:new Date(Date.now()-120000).toISOString(),pilotExpiresAt:new Date(Date.now()-60000).toISOString()},
  {pilotStartedAt:new Date(Date.now()-60000).toISOString(),pilotExpiresAt:new Date(Date.now()+15*86400000).toISOString()}])
  assert.throws(()=>readQualityExecutorPilotWindow({...base,...change}),{code:'NATIVE_EXECUTOR_PILOT_UNAVAILABLE'})
})
test('executor cannot accept caller network SQL tool result clock environment or holdout ports',async()=>{
 for(const action of ['QUALIFY','REPRODUCE','VERIFY','PROPOSE','CHECKS','PROMOTE','VERIFY_RUNTIME','OBSERVE','ROLLBACK'])
  await assert.rejects(runQualityNativeExecutorJob(input(action)),{code:'NATIVE_EXECUTOR_ACTION_FORBIDDEN'})
 for(const extra of [{fetchImpl:()=>{}},{query:()=>{}},{budget:{}},{runCase:()=>{}},{toolPath:'/tmp/untrusted'},
  {result:{result:'PATCH'}},{environment:{AQC_PAID_REPAIRS_ENABLED:'true'}},{now:()=>0},{pack:[]},{publisherEnabled:true}])
  await assert.rejects(runQualityNativeExecutorJob({...input(),...extra}),{code:'NATIVE_EXECUTOR_INPUT_INVALID'})
})
test('executor rejects missing native state accessors or shared role signing keys before provider work',async()=>{
 let called=0;const o=input();Object.defineProperty(o,'token',{enumerable:true,get(){called++;throw Error('never read')}})
 await assert.rejects(runQualityNativeExecutorJob(o),{code:'NATIVE_EXECUTOR_INPUT_INVALID'});assert.equal(called,0)
 const missing=input();delete missing.inputs.state
 await assert.rejects(runQualityNativeExecutorJob(missing),{code:'NATIVE_EXECUTOR_STATE_REQUIRED'})
 const shared=input();shared.keysByRole.set('INDEPENDENT_PUBLISHER',shared.keysByRole.get('INDEPENDENT_VERIFIER'))
 await assert.rejects(runQualityNativeExecutorJob(shared),{code:'NATIVE_EXECUTOR_SEPARATE_TRUST_REQUIRED'})
 const owner=input();const own=owner.keysByRole.get('EXECUTOR_SUPERVISOR');owner.ownerKeys=new Map(own)
 await assert.rejects(runQualityNativeExecutorJob(owner),{code:'NATIVE_EXECUTOR_TRUST_REQUIRED'})
 const wrong=input();wrong.privateKey=generateKeyPairSync('ed25519').privateKey
 await assert.rejects(runQualityNativeExecutorJob(wrong),{code:'NATIVE_EXECUTOR_TRUST_REQUIRED'})
})
test('standby paid-off boundary refuses EXECUTE before any database model or native provider read',async()=>{
 const before=[process.env.AQC_PAID_REPAIRS_ENABLED,process.env.AQC_PROMOTION_ENABLED]
 try{
  process.env.AQC_PAID_REPAIRS_ENABLED='false';process.env.AQC_PROMOTION_ENABLED='false'
  await assert.rejects(runQualityNativeExecutorJob(input()),{code:'NATIVE_EXECUTOR_NOT_ACTIVATED'})
  process.env.AQC_PAID_REPAIRS_ENABLED='true';process.env.AQC_PROMOTION_ENABLED='true'
  await assert.rejects(runQualityNativeExecutorJob(input()),{code:'NATIVE_EXECUTOR_NOT_ACTIVATED'})
  process.env.AQC_PROMOTION_ENABLED='false'
  await assert.rejects(runQualityNativeExecutorJob(input()),error=>
   ['LINUX_ROOT_REQUIRED','TRUSTED_EPHEMERAL_WORKFLOW_REQUIRED','NATIVE_EXECUTOR_SOURCE_MISMATCH'].includes(error?.code))
 }finally{
  for(const [i,key]of ['AQC_PAID_REPAIRS_ENABLED','AQC_PROMOTION_ENABLED'].entries())
   if(before[i]===undefined)delete process.env[key];else process.env[key]=before[i]
 }
})
test('Linux qualification digest also authenticates the complete native executor job source',()=>{
 const root=fileURLToPath(new URL('../',import.meta.url)),temporary=mkdtempSync(path.join(tmpdir(),'aqc-native-executor-policy-'))
 try{
  cpSync(path.join(root,'src'),path.join(temporary,'src'),{recursive:true})
  for(const file of ['package.json','package-lock.json'])copyFileSync(path.join(root,file),path.join(temporary,file))
  const before=qualificationPolicyDigest(temporary)
  assert.equal(before,qualificationPolicyDigest(root))
  appendFileSync(path.join(temporary,'src/executor-job.mjs'),'\nUNREVIEWED_NATIVE_EXECUTOR_CHANGE')
  assert.notEqual(qualificationPolicyDigest(temporary),before)
 }finally{rmSync(temporary,{recursive:true,force:true})}
})
