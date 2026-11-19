import test from 'node:test'
import assert from 'node:assert/strict'
import {generateKeyPairSync} from 'node:crypto'
import {runQualityNativeVerifierJob} from '../src/verifier-job.mjs'
import {publicKeyId} from '../src/manifest.mjs'

function input(action='QUALIFY'){
 const key=generateKeyPairSync('ed25519'),id=publicKeyId(key.publicKey),other=generateKeyPairSync('ed25519'),publisher=generateKeyPairSync('ed25519')
 const otherKeys=new Map([[publicKeyId(other.publicKey),other.publicKey]])
 return {inputs:{mode:'controller-job',action,nonce:'56bf1afa-8215-4cee-ae89-c0dedc7962aa',
  control_source_sha:'a'.repeat(40),incident_id:'37b9fea1-881a-45e2-ab91-5705cbe1de59',
  manifest_sha256:'b'.repeat(64),base_sha:'c'.repeat(40),state:'{}',
  ...(action==='EXECUTE'?{permit_id:'d9d5e04e-2029-42c7-b0e9-a598fe6e9c1c',permit_expires_at:'2026-11-19T04:00:00.000Z'}:{})},
  token:'inert-test-value',controllerWorkflowSha256:'b'.repeat(64),registry:{},ownerKeys:new Map(),
  verifierKeys:new Map([[id,key.publicKey]]),keysByRole:new Map([['INDEPENDENT_VERIFIER',new Map([[id,key.publicKey]])],
   ['EXECUTOR_SUPERVISOR',otherKeys],['INDEPENDENT_PUBLISHER',new Map([[publicKeyId(publisher.publicKey),publisher.publicKey]])]]),
  expectedServiceId:'srv-fixture',expectedGateSetSha256:'b'.repeat(64),repositoryRoot:'/nonexistent-test-source',
  qualification:{},qualificationKeys:new Map(),privateKey:key.privateKey}
}
test('native verifier has no dispatch spend publish recovery or caller-result entrypoint',async()=>{
 for(const action of ['EXECUTE','PROPOSE','CHECKS','PROMOTE','VERIFY_RUNTIME','OBSERVE','ROLLBACK'])
  await assert.rejects(runQualityNativeVerifierJob(input(action)),{code:'NATIVE_VERIFIER_ACTION_FORBIDDEN'})
 for(const extra of [{fetchImpl:()=>{throw Error('never run')}},{runCase:()=>{}},{result:{result:'PASS'}},
  {environment:{GITHUB_RUN_ID:'1'}},{now:()=>0},{url:'https://example.invalid'},{publisherEnabled:true}])
  await assert.rejects(runQualityNativeVerifierJob({...input(),...extra}),{code:'NATIVE_VERIFIER_INPUT_INVALID'})
})
test('native verifier refuses accessors missing state reference leakage and shared signing identity before provider access',async()=>{
 let calls=0
 const o=input();Object.defineProperty(o,'token',{enumerable:true,get(){calls++;throw Error('never run')}})
 await assert.rejects(runQualityNativeVerifierJob(o),{code:'NATIVE_VERIFIER_INPUT_INVALID'});assert.equal(calls,0)
 const missing=input();delete missing.inputs.state
 await assert.rejects(runQualityNativeVerifierJob(missing),{code:'NATIVE_VERIFIER_STATE_REQUIRED'})
 for(const action of ['QUALIFY','REPRODUCE'])
  await assert.rejects(runQualityNativeVerifierJob({...input(action),pack:[]}),{code:'NATIVE_VERIFIER_REFERENCE_SCOPE_INVALID'})
 await assert.rejects(runQualityNativeVerifierJob(input('VERIFY')),{code:'NATIVE_VERIFIER_REFERENCE_SCOPE_INVALID'})
 const shared=input();shared.keysByRole.set('EXECUTOR_SUPERVISOR',shared.keysByRole.get('INDEPENDENT_VERIFIER'))
 await assert.rejects(runQualityNativeVerifierJob(shared),{code:'NATIVE_VERIFIER_SEPARATE_TRUST_REQUIRED'})
 const sharedOthers=input();sharedOthers.keysByRole.set('INDEPENDENT_PUBLISHER',sharedOthers.keysByRole.get('EXECUTOR_SUPERVISOR'))
 await assert.rejects(runQualityNativeVerifierJob(sharedOthers),{code:'NATIVE_VERIFIER_SEPARATE_TRUST_REQUIRED'})
 const untrusted=input();untrusted.keysByRole.set('INDEPENDENT_VERIFIER',new Map())
 await assert.rejects(runQualityNativeVerifierJob(untrusted),{code:'NATIVE_VERIFIER_TRUST_REQUIRED'})
})

test('closed verifier refuses a non-native host or synthetic source before any provider evidence or candidate execution',async()=>{
 const value=input()
 await assert.rejects(runQualityNativeVerifierJob(value),error=>
  ['LINUX_ROOT_REQUIRED','TRUSTED_EPHEMERAL_WORKFLOW_REQUIRED','NATIVE_VERIFIER_SOURCE_MISMATCH'].includes(error?.code))
})
