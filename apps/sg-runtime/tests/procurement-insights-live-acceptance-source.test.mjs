import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {procurementInsightsLiveAcceptancePredecessor,PI_LIVE_ACCEPTANCE_RECORD,PI_LIVE_ACCEPTANCE_PATHS,PI_LIVE_ACCEPTANCE_BASE} from './procurement-insights-live-acceptance-source.mjs';
const root=new URL('../../../',import.meta.url),current=p=>readFileSync(new URL(p,root)),cache=new Map();
const historical=(sha,p)=>{const key=sha+':'+p;if(!cache.has(key))cache.set(key,execFileSync('git',['show',key],{cwd:root,stdio:['ignore','pipe','pipe']}));return cache.get(key)};
test('all current correction bytes precede exact immutable PI, Oil, Calendar and SDK history',()=>{
 const view=procurementInsightsLiveAcceptancePredecessor(current,historical);assert(view);
 for(const p of [...PI_LIVE_ACCEPTANCE_PATHS,...Object.keys(view.manifest.preservedReceipts)])assert.throws(()=>procurementInsightsLiveAcceptancePredecessor(f=>f===p?Buffer.concat([current(f),Buffer.from('UNACCEPTED')]):current(f),historical),p);
 for(const p of ['apps/insights-runtime/src/host.mjs','apps/sg-runtime/components/procurement-insights/workspace.tsx'])assert.deepEqual(view.previousBytes(p),historical(PI_LIVE_ACCEPTANCE_BASE,p));
 assert.equal(procurementInsightsLiveAcceptancePredecessor(view.previousBytes,historical),null);
});
test('receipt refuses widened authority, unknown metadata, source omissions and unreadable data',()=>{
 for(const mutate of [a=>a.authorisationChanged=true,a=>a.schemaChanged=true,a=>a.deploymentPerformed=true,a=>a.extra=true,a=>a.baseCandidateSha='0'.repeat(40),a=>delete a.sourceDigests[PI_LIVE_ACCEPTANCE_PATHS[0]],a=>delete a.preservedReceipts[Object.keys(a.preservedReceipts)[0]]]){
  const a=JSON.parse(current(PI_LIVE_ACCEPTANCE_RECORD));mutate(a);assert.throws(()=>procurementInsightsLiveAcceptancePredecessor(p=>p===PI_LIVE_ACCEPTANCE_RECORD?Buffer.from(JSON.stringify(a)):current(p),historical));
 }
 assert.equal(procurementInsightsLiveAcceptancePredecessor(()=>{throw Object.assign(Error('ABSENT'),{code:'ENOENT'})},historical),null);
 assert.throws(()=>procurementInsightsLiveAcceptancePredecessor(()=>{throw Object.assign(Error('UNREADABLE'),{code:'EACCES'})},historical),{code:'EACCES'});
});
