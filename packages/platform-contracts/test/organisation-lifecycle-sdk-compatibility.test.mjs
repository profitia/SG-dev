import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {organisationLifecycleSdkPredecessor} from './organisation-lifecycle-sdk-compatibility.mjs'
const root=new URL('../../../',import.meta.url)
const recordPath='packages/platform-contracts/test/organisation-lifecycle-sdk-compatibility.json'
const current=p=>fs.readFileSync(new URL(p,root))
const cache=new Map()
const historical=(sha,p)=>{
 const key=sha+':'+p
 if(!cache.has(key)){try{cache.set(key,{bytes:execFileSync('git',['show',key],{cwd:root,stdio:['ignore','pipe','pipe']})})}catch(error){cache.set(key,{error})}}
 const result=cache.get(key);if(result.error)throw result.error;return Buffer.from(result.bytes)
}
const missing=()=>{throw Object.assign(Error('synthetic missing source'),{code:'ENOENT'})}
test('optional guard remains absent for an actual immutable predecessor',()=>{
 assert.equal(organisationLifecycleSdkPredecessor(p=>p===recordPath?missing():current(p),historical),null)
})
test('current lifecycle source validates every owner and exposes exact immutable predecessor bytes',()=>{
 const a=JSON.parse(current(recordPath))
 for(const projectKey of ['ARCHITECTURE','SG2','SRM']){
  const v=organisationLifecycleSdkPredecessor(current,historical,{projectKey})
  assert.equal(v.currentRecord.platformVersion,'1.37.0')
  assert.equal(v.currentRecord.previousSourceSha,a.previousSourceSha)
  for(const p of Object.keys(a.previousSourceDigests))assert.deepEqual(v.previousBytes(p),historical(a.previousSourceSha,p))
  for(const p of a.previousAbsentPaths)assert.throws(()=>v.previousBytes(p),{code:'ENOENT'})
 }
})
test('unaccepted raw record changes or an unknown consumer are rejected',()=>{
 assert.throws(()=>organisationLifecycleSdkPredecessor(p=>p===recordPath?Buffer.concat([current(p),Buffer.from(' ')]):current(p),historical))
 assert.throws(()=>organisationLifecycleSdkPredecessor(current,historical,{projectKey:'FOREIGN'}))
})
test('changed executable, schema, test, consumer and preserved bytes are refused before any historical view',()=>{
 const a=JSON.parse(current(recordPath))
 for(const files of [a.sourceDigests,a.compatibilityTestSourceDigests,...Object.values(a.consumerSourceDigests),a.preservedSourceDigests]){
  const p=Object.keys(files)[0];assert(p)
  assert.throws(()=>organisationLifecycleSdkPredecessor(x=>x===p?Buffer.concat([current(x),Buffer.from('changed')]):current(x),historical),p)
  assert.throws(()=>organisationLifecycleSdkPredecessor(x=>x===p?missing():current(x),historical),p+' missing')
 }
})
test('all three actual owner adoption receipts are required and no runtime authority flag is accepted',()=>{
 for(const p of ['apps/architecture-lab/organisation-lifecycle-sdk-source-adoption.json','apps/sg-runtime/organisation-lifecycle-sdk-source-adoption.json','apps/srm/organisation-lifecycle-sdk-source-adoption.json']){
  assert.throws(()=>organisationLifecycleSdkPredecessor(x=>x===p?missing():current(x),historical),p)
  for(const field of ['runtimeOptedIn','platformVersion','sourceRecordSha256','projectKey','taskId']){
   const a=JSON.parse(current(p));a[field]=field==='runtimeOptedIn'?true:'foreign'
   assert.throws(()=>organisationLifecycleSdkPredecessor(x=>x===p?Buffer.from(JSON.stringify(a)):current(x),historical),p+' '+field)
  }
 }
})
test('historical source substitution and false absence cannot supply a trusted predecessor',()=>{
 const a=JSON.parse(current(recordPath)),p=Object.keys(a.previousSourceDigests)[0]
 assert.throws(()=>organisationLifecycleSdkPredecessor(current,(sha,x)=>sha===a.previousSourceSha&&x===p?Buffer.from('substituted'):historical(sha,x)))
 const absent=a.previousAbsentPaths[0];assert(absent)
 assert.throws(()=>organisationLifecycleSdkPredecessor(current,(sha,x)=>sha===a.previousSourceSha&&x===absent?Buffer.from('not absent'):historical(sha,x)))
})
test('published owner source substitution is rejected independently of current bytes',()=>{
 const a=JSON.parse(current(recordPath)),owner=a.ownerInputs.find(i=>Object.keys(i.sourceDigests).length),p=Object.keys(owner.sourceDigests)[0]
 assert.throws(()=>organisationLifecycleSdkPredecessor(current,(sha,x)=>sha===owner.sourceSha&&x===p?Buffer.from('foreign owner source'):historical(sha,x)))
})
