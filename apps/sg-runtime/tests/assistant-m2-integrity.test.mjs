import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {assistantM2Predecessor,oilReportTransportPredecessor,ASSISTANT_M2_PATHS,ASSISTANT_M2_PRODUCER_PATHS} from './assistant-m2-integrity.mjs'
const root=new URL('../../../',import.meta.url),current=p=>readFileSync(new URL(p,root))
const historical=(sha,p)=>execFileSync('git',['show',sha+':'+p],{cwd:root})
test('M2 adopts exact current consumer/producer source without rewriting historical acceptance',()=>{
 const view=assistantM2Predecessor(current,historical);assert(view)
 assert.deepEqual(view.previousBytes('apps/sg-runtime/package.json'),historical(view.manifest.previousSourceSha,'apps/sg-runtime/package.json'))
 for(const path of [...ASSISTANT_M2_PATHS,...ASSISTANT_M2_PRODUCER_PATHS])assert.throws(()=>assistantM2Predecessor(
  p=>p===path?Buffer.concat([current(p),Buffer.from('UNACCEPTED')]):current(p),historical),path)
 for(const mutate of [a=>a.acquisitionAllowed=true,a=>a.newGrant=true,a=>a.configuration.enabledByDefault=true,a=>a.producers.cic.version='99.0.0',a=>a.unreviewedScope=true]){
  const value=structuredClone(view.manifest);mutate(value)
  assert.throws(()=>assistantM2Predecessor(p=>p==='apps/sg-runtime/assistant-context-integration.json'?Buffer.from(JSON.stringify(value)):current(p),historical))
 }
})

test('current Oil transport correction is fully verified before preserving M2 and historical source',()=>{
 const repair=oilReportTransportPredecessor(current,historical);assert(repair);
 for(const p of repair.manifest.changedSourcePaths)assert.throws(()=>oilReportTransportPredecessor(f=>f===p?Buffer.concat([current(f),Buffer.from('UNACCEPTED')]):current(f),historical),p);
 const file='apps/sg-runtime/assistant-context-integration.json';
 for(const mutate of [r=>r.oilRuntimeTransportRepair.noAutomaticRetry=false,r=>r.oilRuntimeTransportRepair.noGrantChange=false,r=>r.projectKey='UNACCEPTED']){
  const receipt=JSON.parse(current(file));mutate(receipt);assert.throws(()=>oilReportTransportPredecessor(p=>p===file?Buffer.from(JSON.stringify(receipt)):current(p),historical));
 }
 assert.deepEqual(repair.previousBytes(file),historical(repair.manifest.previousSourceSha,file));
})
test('Oil continuation is absent in a pre-M2 view, while unrelated read errors remain fatal',()=>{
 assert.equal(oilReportTransportPredecessor(()=>{throw Object.assign(Error('M2 adoption absent from predecessor'),{code:'ENOENT'})},historical),null)
 assert.throws(()=>oilReportTransportPredecessor(()=>{throw Object.assign(Error('UNREADABLE_CURRENT_SOURCE'),{code:'EACCES'})},historical),{code:'EACCES'})
})
