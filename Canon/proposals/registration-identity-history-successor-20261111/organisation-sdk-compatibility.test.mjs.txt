import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {sdkContinuationPredecessor,acceptedSdkSource} from './organisation-sdk-compatibility.mjs'
const root=new URL('../../../',import.meta.url)
const current=p=>fs.readFileSync(new URL(p,root))
const historical=(sha,p)=>execFileSync('git',['show',sha+':'+p],{cwd:root,stdio:['ignore','pipe','ignore']})
const hash=b=>createHash('sha256').update(b).digest('hex')
const sourcePath='packages/platform-contracts/test/organisation-sdk-compatibility.json'
const receiptPath=p=>'apps/'+(p==='SG2'?'sg-runtime':'srm')+'/operation-integration.json'
const receipt=(p,read=current)=>JSON.parse(read(receiptPath(p)))
const identitySources={
  "apps/identity-runtime/src/organisation-onboarding.ts": {
    "sha256": "2bd52ce90cbb522cf465298228524ba7f51e87646e3dcbcbbd8ae49a2203ad53",
    "producerSha": "5a963f313317d57e1946e1d7aabd28192db9c7bd"
  },
  "apps/identity-runtime/test/organisation-onboarding.test.mjs": {
    "sha256": "8e63ae4b5b21724f13fa29659f546424804bf63e2ea0568a238a26f365506e8b",
    "producerSha": "5a963f313317d57e1946e1d7aabd28192db9c7bd"
  },
  "apps/identity-runtime/src/organisation-draft.ts": {
    "sha256": "bba7165ae3bbd799778312722725e888b7a33347918f393618c67ca4026b3a4f",
    "producerSha": "6dd651bee360d80a644f7526cf1397f60a0db461"
  },
  "apps/identity-runtime/src/main.ts": {
    "sha256": "5396d018303d3356c73523ee4edfc06ab8725d29c42125c7c8e60087e4345fd4",
    "producerSha": "6dd651bee360d80a644f7526cf1397f60a0db461"
  },
  "apps/identity-runtime/src/http-handler.ts": {
    "sha256": "362687ff03605bc908443992844f887aba69d7e263383f2f38893bbb2fca3ca0",
    "producerSha": "6dd651bee360d80a644f7526cf1397f60a0db461"
  },
  "apps/identity-runtime/test/organisation-draft.test.mjs": {
    "sha256": "128683cefed1ba9ee0dadf271a66320678a2d5babbb4f69c794e8b643a1c0328",
    "producerSha": "6dd651bee360d80a644f7526cf1397f60a0db461"
  },
  "apps/identity-runtime/README.md": {
    "sha256": "f5b66a9294e6c74d2973911779e1ac9b7a3bd898ccd330581885e05e081aa30b",
    "producerSha": "6dd651bee360d80a644f7526cf1397f60a0db461"
  },
  "Canon/evidence/2026-11-11-registration-native-draft-http.md": {
    "sha256": "9baa883a9af8beb2e658a351ce022c57fa8c869f126e35e0da95b4400c626c7a",
    "producerSha": "6dd651bee360d80a644f7526cf1397f60a0db461"
  }
}
test('current165-file producer and both receivers precede accepted recurring main',()=>{
 const record=JSON.parse(current(sourcePath))
 assert.equal(record.platformVersion,'1.36.0');assert.equal(Object.keys(record.sourceDigests).length,165)
 assert.equal(record.previousSourceSha,'0775f8a18d2fbeca462bb0a9d654914b15c53dad')
 assert.equal(record.defaultRootImplementation,'1.0.0-candidate.16')
 assert.equal(record.optionalRootImplementation,'1.0.0-candidate.21')
 for(const projectKey of ['SG2','SRM']){
  const value=sdkContinuationPredecessor(receipt(projectKey),current,historical,{projectKey})
  assert.deepEqual(value.record,record)
  assert.deepEqual(value.prior,JSON.parse(historical(record.previousSourceSha,receiptPath(projectKey))))
  for(const p of ['packages/platform-contracts/src/operation-context.mjs','packages/platform-contracts/package.json','apps/sg-runtime/tests/operation-context.test.mjs','apps/srm/scripts/operation-context.test.mjs'])
   assert.deepEqual(value.previousBytes(p),historical(record.previousSourceSha,p))
  for(const p of Object.keys(identitySources)){
   let prior;try{prior=historical(record.previousSourceSha,p)}catch{
    assert.throws(()=>value.previousBytes(p),'new source absent from actual predecessor: '+p);continue
   }
   assert.deepEqual(value.previousBytes(p),prior,'actual Identity predecessor: '+p)
  }
  assert.equal(hash(value.previousBytes('apps/architecture-lab/private-recurring-source.json')),'75877d5750e07d1c8172be0af76bc5933f2eeefc22cc39747a2621b9cab24619')
  assert.throws(()=>value.previousBytes('../outside'))
 }
 assert.deepEqual(acceptedSdkSource(),record)
})
test('every physical SDK, recurring guard, receiver and compatibility file remains authenticated',()=>{
 const record=JSON.parse(current(sourcePath))
 const targets=[...Object.keys(record.sourceDigests),...Object.keys(record.compatibilityTestSourceDigests),...Object.keys(record.preservedSourceDigests),...Object.values(record.consumerSourceDigests).flatMap(Object.keys),...Object.keys(identitySources)]
 for(const target of targets){
  const changed=p=>p===target?Buffer.concat([current(p),Buffer.from('\nUNREVIEWED')]):current(p)
  assert.throws(()=>sdkContinuationPredecessor(receipt('SG2'),changed,historical),target)
 }
})
test('forged records, receipts, peer frames and history cannot open the predecessor',()=>{
 for(const mutate of [r=>r.sqlInstalled=true,r=>r.runtimeOptedIn=true,r=>r.previousSourceSha='0'.repeat(40),r=>r.producer.sourceSha='0'.repeat(40),r=>r.sourceDigests['packages/platform-contracts/src/operation-context.mjs']='0'.repeat(64)]){
  const r=JSON.parse(current(sourcePath));mutate(r)
  assert.throws(()=>sdkContinuationPredecessor(receipt('SG2'),p=>p===sourcePath?Buffer.from(JSON.stringify(r)+'\n'):current(p),historical))
 }
 for(const projectKey of ['SG2','SRM'])for(const mutate of [r=>r.sdkSourceContinuations[0].taskId='foreign',r=>r.sdkSourceContinuations[0].previousReceiptSha256='0'.repeat(64),r=>r.sdkSourceContinuations.push({...r.sdkSourceContinuations[0]}),r=>r.contract.sourceDigest='0'.repeat(64)]){
  const bad=receipt(projectKey);mutate(bad)
  assert.throws(()=>sdkContinuationPredecessor(bad,p=>p===receiptPath(projectKey)?Buffer.from(JSON.stringify(bad)):current(p),historical,{projectKey}))
 }
 const other=receipt('SRM');delete other.sdkSourceContinuations
 assert.throws(()=>sdkContinuationPredecessor(receipt('SG2'),p=>p===receiptPath('SRM')?Buffer.from(JSON.stringify(other)):current(p),historical))
 const changedHistory=(sha,p)=>p===receiptPath('SG2')?Buffer.concat([historical(sha,p),Buffer.from('forged')]):historical(sha,p)
 assert.throws(()=>sdkContinuationPredecessor(receipt('SG2'),current,changedHistory))
})
test('original020 and approved25fea retain their actual immutable full source graph',()=>{
 const sha='b4ca8b7072bd105e1ac3f3ead85a1104bf7f04c4',old=p=>historical(sha,p)
 assert.equal(hash(old(sourcePath)),'25fea141baf42c154f64a256d40808d548562c010e3f2fd3143657f24b15295c')
 for(const projectKey of ['SG2','SRM'])assert.equal(sdkContinuationPredecessor(receipt(projectKey,old),old,historical,{projectKey}).record.platformVersion,'1.34.0')
 const doc=old('Canon/evidence/2026-11-11-registration-sdk-ci-complete-review.md').toString(),marker=doc.indexOf('<!-- registration-sdk-fixture -->'),match=/\x60\x60\x60json\n([\s\S]*?)\x60\x60\x60/.exec(doc.slice(marker))
 assert(marker>=0&&match);const bytes=Buffer.from(match[1]),original=JSON.parse(bytes)
 assert.equal(hash(bytes),'020b9db676804688ce1758865084d2af02c42af169ede00c265432422e4d993e')
 const name='apps/sg-runtime/tests/private-host.integration.test.mjs',next="currentSdkRecord.sourceDigests?.['packages/platform-contracts/'+file]??currentSdkRecord.compatibilityTestSourceDigests?.['packages/platform-contracts/'+file]??digest",before="currentSdkRecord.sourceDigests?.['packages/platform-contracts/'+file]??digest",source=old(name).toString()
 assert.equal(source.split(next).length,2)
 const restored=Buffer.from(source.replace(next,before));assert.equal(hash(restored),original.consumerSourceDigests.SG2[name])
 const view=p=>p===sourcePath?bytes:p===name?restored:old(p)
 for(const projectKey of ['SG2','SRM'])assert.deepEqual(sdkContinuationPredecessor(receipt(projectKey,view),view,historical,{projectKey}).record,original)
})

test('every immutable Identity producer is authenticated before exposing historical sources',()=>{
 for(const [target,pin]of Object.entries(identitySources)){
  const forged=(sha,p)=>sha===pin.producerSha&&p===target?Buffer.concat([historical(sha,p),Buffer.from('\nFORGED')]):historical(sha,p)
  assert.throws(()=>sdkContinuationPredecessor(receipt('SG2'),current,forged),/actual immutable Identity producer/,'immutable Identity source '+target)
 }
})
