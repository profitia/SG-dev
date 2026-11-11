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
  assert.equal(hash(value.previousBytes('apps/architecture-lab/private-recurring-source.json')),'75877d5750e07d1c8172be0af76bc5933f2eeefc22cc39747a2621b9cab24619')
  assert.throws(()=>value.previousBytes('../outside'))
 }
 assert.deepEqual(acceptedSdkSource(),record)
})
test('every physical SDK, recurring guard, receiver and compatibility file remains authenticated',()=>{
 const record=JSON.parse(current(sourcePath))
 const targets=[...Object.keys(record.sourceDigests),...Object.keys(record.compatibilityTestSourceDigests),...Object.keys(record.preservedSourceDigests),...Object.values(record.consumerSourceDigests).flatMap(Object.keys)]
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
