import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {sdkContinuationPredecessor,acceptedSdkSource} from './organisation-sdk-compatibility.mjs'
const root=new URL('../../../',import.meta.url)
const current=path=>fs.readFileSync(new URL(path,root))
const historical=(sha,path)=>execFileSync('git',['show',sha+':'+path],{cwd:root,stdio:['ignore','pipe','ignore']})
const pathFor=project=>'apps/'+(project==='SG2'?'sg-runtime':'srm')+'/operation-integration.json'
const receipt=project=>JSON.parse(current(pathFor(project)))
const sourcePath='packages/platform-contracts/test/organisation-sdk-compatibility.json'

test('current organisation SDK requires both actual receivers before exposing immutable predecessor bytes',()=>{
 for(const projectKey of ['SG2','SRM']){
  const value=sdkContinuationPredecessor(receipt(projectKey),current,historical,{projectKey})
  assert(value,'combined producer and both receiver source frames required')
  assert.equal(value.record.optionalRootImplementation,'1.0.0-candidate.21')
  assert.equal(value.record.defaultRootImplementation,'1.0.0-candidate.16')
  assert.equal(value.record.runtimeOptedIn,false);assert.equal(value.record.sqlInstalled,false)
  assert.deepEqual(value.prior,JSON.parse(historical(value.record.previousSourceSha,pathFor(projectKey))))
  const core='packages/platform-contracts/src/operation-context.mjs'
  assert.deepEqual(value.previousBytes(core),historical(value.record.previousSourceSha,core))
  const route='apps/platform-source-hub/scripts/ci-routing.mjs'
  assert.deepEqual(value.previousBytes('apps/srm/../platform-source-hub/scripts/ci-routing.mjs'),historical(value.record.previousSourceSha,route))
  assert.throws(()=>value.previousBytes('../outside-the-repository'))
  assert.equal(value.prior.sdkSourceContinuations,undefined)
 }
 assert.equal(acceptedSdkSource().acceptanceId,'organisation-bootstrap-v1')
})
test('altered current SDK, receiver source, source record or preserved guard cannot acquire a historical source view',()=>{
 const targets=[sourcePath,'apps/srm/app/login/porr-account.tsx','apps/srm/scripts/porr-account-ui.test.mjs','packages/platform-contracts/src/operation-context.mjs','packages/platform-contracts/src/operation-context.d.mts',
  'packages/platform-contracts/src/organisation-bootstrap.mjs','packages/platform-contracts/migrations/profile/008-organisation-create.sql',
  'packages/platform-contracts/package.json','apps/architecture-lab/sdk-1.34-compatibility.json',
  'apps/sg-runtime/tests/operation-context.test.mjs','apps/srm/scripts/source-hub-sdk-compatibility.mjs',
  'apps/sg-runtime/tests/assistant-m2-integrity.mjs','apps/newsfeed-runtime/test/runtime.test.mjs',
  'apps/sg-runtime/registration-stage-i-integration.json']
 for(const target of targets){
  const changed=path=>path===target?Buffer.concat([current(path),Buffer.from('\nUNREVIEWED')]):current(path)
  assert.throws(()=>sdkContinuationPredecessor(receipt('SG2'),changed,historical,{projectKey:'SG2'}),target)
 }
})
test('source frame cannot appoint another owner, opt into runtime or rewrite an earlier receipt',()=>{
 const base=receipt('SG2')
 assert(Array.isArray(base.sdkSourceContinuations),'actual combined receiver frame required')
 for(const mutate of [r=>r.sdkSourceContinuations[0].taskId='SRM-REGISTRATION-BOOTSTRAP-SDK-ADOPTION-20261111',
  r=>r.sdkSourceContinuations[0].runtimeOptedIn=true,r=>r.sdkSourceContinuations[0].acceptanceId='unreviewed',
  r=>r.sdkSourceContinuations[0].previousReceiptSha256='0'.repeat(64),r=>r.sdkSourceContinuations.push({...r.sdkSourceContinuations[0]}),
  r=>r.contract.sourceDigest='0'.repeat(64)]){
  const bad=structuredClone(base);mutate(bad)
  const changed=path=>path===pathFor('SG2')?Buffer.from(JSON.stringify(bad)):current(path)
  assert.throws(()=>sdkContinuationPredecessor(bad,changed,historical,{projectKey:'SG2'}))
 }
})
test('an absent peer frame or forged predecessor remains closed without a permission, product or installation side effect',()=>{
 const peer=receipt('SRM');delete peer.sdkSourceContinuations
 assert.throws(()=>sdkContinuationPredecessor(receipt('SG2'),path=>path===pathFor('SRM')?Buffer.from(JSON.stringify(peer)):current(path),historical,{projectKey:'SG2'}))
 const alteredHistory=(sha,path)=>path===pathFor('SG2')?Buffer.concat([historical(sha,path),Buffer.from('modified')]):historical(sha,path)
 assert.throws(()=>sdkContinuationPredecessor(receipt('SG2'),current,alteredHistory,{projectKey:'SG2'}))
 const a=JSON.parse(current(sourcePath))
 for(const flag of ['runtimeOptedIn','sqlInstalled','permissionsChanged','providerCallsPerformed','deploymentPerformed'])assert.equal(a[flag],false)
})
