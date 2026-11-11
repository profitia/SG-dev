// SYNTHETIC_ONLY. This checks source provenance, never runtime authority.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {recurringSourcePredecessor,RECURRING_SOURCE_RECORD,RECURRING_SOURCE_BASE} from '../private-recurring-source.mjs';
const root=new URL('../../../',import.meta.url),current=p=>readFileSync(new URL(p,root));
const cache=new Map(),history=(sha,p)=>{const key=sha+':'+p;if(!cache.has(key))cache.set(key,execFileSync('git',['show',key],{cwd:root,stdio:['ignore','pipe','pipe']}));return cache.get(key)};
test('current recurring source is closed before the complete immutable predecessor can be used',()=>{
 const view=recurringSourcePredecessor(current,history);assert(view);
 for(const p of Object.keys(view.manifest.preservedReceipts))assert.deepEqual(current(p),history(RECURRING_SOURCE_BASE,p));
 for(const p of view.manifest.changedPaths.filter(p=>!view.manifest.addedPaths.includes(p)))assert.deepEqual(view.previousBytes(p),history(RECURRING_SOURCE_BASE,p),p);
 for(const p of [...view.manifest.addedPaths,RECURRING_SOURCE_RECORD])assert.throws(()=>view.previousBytes(p),{code:'ENOENT'});
 assert.equal(recurringSourcePredecessor(view.previousBytes,history),null);
});
test('changed private runtime, SDK, consumer, receipt or candidate record is refused before a historical projection',()=>{
 const view=recurringSourcePredecessor(current,history);
 for(const p of [...view.manifest.changedPaths,...Object.keys(view.manifest.preservedReceipts)])assert.throws(()=>recurringSourcePredecessor(f=>f===p?Buffer.concat([current(f),Buffer.from('UNACCEPTED')]):current(f),history),p);
 for(const mutate of [a=>a.runtimeActivated=true,a=>a.platformVersion='1.34.0',a=>a.previousSourceSha='0'.repeat(40),a=>a.sourceDigests['unadmitted.mjs']='a'.repeat(64),a=>a.newGrantsInstalled=true,a=>delete a.sourceDigests[a.changedPaths[0]]]){
  const a=JSON.parse(current(RECURRING_SOURCE_RECORD));mutate(a);assert.throws(()=>recurringSourcePredecessor(p=>p===RECURRING_SOURCE_RECORD?Buffer.from(JSON.stringify(a)):current(p),history));
 }
});
test('a genuinely absent successor is optional; unreadable source and unrelated Git failures remain fatal',()=>{
 assert.equal(recurringSourcePredecessor(()=>{throw Object.assign(Error('Absent'),{code:'ENOENT'})},history),null);
 const denied=Object.assign(Error('Denied'),{code:'EACCES'});assert.throws(()=>recurringSourcePredecessor(()=>{throw denied},history),e=>e===denied);
 const wrong=Object.assign(Error('Other Git error'),{status:128,stderr:"fatal: path 'another-file' does not exist in 'main'"});assert.throws(()=>recurringSourcePredecessor(()=>{throw wrong},history),e=>e===wrong);
});

test('parallel accepted ECR precision stays current and separately reviewable in the authority projection',()=>{
 const view=recurringSourcePredecessor(current,history);
 const receipt='apps/sg-runtime/assistant-ecr-precision-integration.json',helper='apps/sg-runtime/tests/assistant-ecr-precision-integrity.mjs';
 assert.deepEqual(view.authorityBytes(receipt),current(receipt));
 assert.deepEqual(view.authorityBytes(helper),history(view.manifest.authorityMainSha,helper));
 assert.throws(()=>view.previousBytes(receipt),{code:'ENOENT'});
 assert.equal(recurringSourcePredecessor(view.authorityBytes,history),null);
 for(const p of view.manifest.predecessorProjectionPaths){
  assert(Object.hasOwn(view.manifest.sourceDigests,p),'parallel current source is explicitly bound');
  assert.throws(()=>recurringSourcePredecessor(f=>f===p?Buffer.concat([current(f),Buffer.from('UNACCEPTED')]):current(f),history),p);
 }
});
