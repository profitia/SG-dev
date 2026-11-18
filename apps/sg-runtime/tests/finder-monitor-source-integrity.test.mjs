import './monitor-benchmark-finder.test.mjs'
import {completeFunctionalPredecessor} from '../../architecture-lab/ecr-complete-functional-source.mjs'
import {procurementInsightsEditorialPackagePredecessor} from './procurement-insights-editorial-package-integrity.mjs'
// Source validation only. Real Render execution and Sentry delivery are separate acceptance.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {finderMonitorPredecessor,FINDER_MONITOR_RECEIPT,FINDER_MONITOR_BASE,FINDER_MONITOR_PATHS,FINDER_MONITOR_PINS} from './finder-monitor-source-integrity.mjs'
import {assistantNotificationsPredecessor} from './assistant-notifications-integrity.mjs'
import {procurementInsightsLiveAcceptancePredecessor} from './procurement-insights-live-acceptance-source.mjs'
import {assertPciSmartIntegrity} from './pci-smart-integrity.mjs'
const root=new URL('../../../',import.meta.url),physicalCurrent=p=>readFileSync(new URL(p,root)),cache=new Map()
const historical=(sha,p)=>{const key=sha+':'+p;if(!cache.has(key))cache.set(key,execFileSync('git',['show',key],{cwd:root,stdio:['ignore','pipe','pipe'],maxBuffer:32*1024*1024}));return Buffer.from(cache.get(key))}
const calendar=completeFunctionalPredecessor(physicalCurrent,historical),packaged=calendar?null:procurementInsightsEditorialPackagePredecessor(physicalCurrent,historical),current=calendar?.previousBytes??packaged?.previousBytes??physicalCurrent
const hash=b=>createHash('sha256').update(b).digest('hex')
const receipt=()=>JSON.parse(current(FINDER_MONITOR_RECEIPT))
const alteredReader=(p,bytes,a)=>f=>f===FINDER_MONITOR_RECEIPT?Buffer.from(JSON.stringify(a)):f===p?bytes:current(f)

test('exact monitor closure reaches the unchanged PCI verifier and actual source coverage aggregate',()=>{
 const view=finderMonitorPredecessor(current,historical);assert(view)
 const notifications=assistantNotificationsPredecessor(current,historical);assert(notifications)
 const live=procurementInsightsLiveAcceptancePredecessor(current,historical);assert(live)
 for(const p of [...FINDER_MONITOR_PATHS,FINDER_MONITOR_RECEIPT])assert.equal(live.manifest.sourceDigests[p],hash(current(p)),p)
 assertPciSmartIntegrity(JSON.parse(current('apps/sg-runtime/operation-integration.json')),current,historical)
 assert.throws(()=>assistantNotificationsPredecessor(p=>{if(p===FINDER_MONITOR_RECEIPT)throw Object.assign(Error('Missing'),{code:'ENOENT'});return current(p)},historical),'the complete source graph cannot omit its monitor binding')
 const entry=String(current('apps/sg-runtime/tests/assistant-notifications-integrity.test.mjs'))
 assert(entry.startsWith("import './finder-monitor-source-integrity.test.mjs'\n"))
 assert(String(current('apps/sg-runtime/tests/finder-monitor-source-integrity.test.mjs')).startsWith("import './monitor-benchmark-finder.test.mjs'\n"),'all fifteen approved monitor tests run through the unchanged normal CI command')
})

test('every altered or missing current source and earlier receipt is rejected before history is exposed',()=>{
 const a=receipt()
 for(const p of [...FINDER_MONITOR_PATHS,...Object.keys(a.preservedReceipts)]){
  assert.throws(()=>finderMonitorPredecessor(f=>f===p?Buffer.concat([current(f),Buffer.from('UNACCEPTED')]):current(f),historical),p)
  assert.throws(()=>finderMonitorPredecessor(f=>{if(f===p)throw Object.assign(Error('Missing'),{code:'ENOENT'});return current(f)},historical),p)
 }
})

test('matching replacement digests cannot rebind approved monitor code or amend historical assertions',()=>{
 const hooks=['apps/sg-runtime/tests/assistant-notifications-integrity.mjs','apps/sg-runtime/tests/assistant-notifications-integrity.test.mjs','apps/sg-runtime/tests/procurement-insights-editorial-integrity.mjs']
 for(const p of [...Object.keys(FINDER_MONITOR_PINS),...hooks]){
  const bytes=Buffer.concat([current(p),Buffer.from('REBOUND')]),a=receipt();a.sourceDigests[p]=hash(bytes)
  assert.throws(()=>finderMonitorPredecessor(alteredReader(p,bytes,a),historical),p)
 }
})

test('unknown fields, scope widening, foreign environments and weakened-control claims are rejected',()=>{
 for(const mutate of [
  a=>a.schemaVersion='2.0',a=>a.taskId='another-task',a=>a.targetEnvironment='production',
  a=>a.scope='generic-admission',a=>a.previousSourceSha='0'.repeat(40),a=>a.approvedMonitorSourceSha='0'.repeat(40),
  a=>a.approvalRef='inferred',a=>a.unreviewed=true,a=>a.sourceDigests['apps/srm/unapproved.ts']='0'.repeat(64),
  a=>delete a.sourceDigests[FINDER_MONITOR_PATHS[0]],a=>a.preservedReceipts={},
  ...['authorisationChanged','schemaChanged','engineChanged','ciChecksWeakened','otherEnvironmentsChanged','runtimeActivationPerformed'].map(k=>a=>a[k]=true)
 ]){
  const a=receipt();mutate(a)
  assert.throws(()=>finderMonitorPredecessor(p=>p===FINDER_MONITOR_RECEIPT?Buffer.from(JSON.stringify(a)):current(p),historical))
 }
})

test('earlier receipt bytes and their historical hashes cannot be rewritten together',()=>{
 for(const p of Object.keys(receipt().preservedReceipts)){
  const bytes=Buffer.concat([current(p),Buffer.from('REWRITTEN')]),a=receipt();a.preservedReceipts[p]=hash(bytes)
  assert.throws(()=>finderMonitorPredecessor(alteredReader(p,bytes,a),historical),p)
 }
 assert.throws(()=>finderMonitorPredecessor(current,(sha,p)=>Buffer.concat([historical(sha,p),Buffer.from('FALSE_HISTORY')])))
})

test('optional absence is limited to the exact absent receipt; malformed and unreadable sources remain fatal',()=>{
 assert.equal(finderMonitorPredecessor(()=>{throw Object.assign(Error('Missing'),{code:'ENOENT'})},historical),null)
 assert.equal(finderMonitorPredecessor(()=>{throw Object.assign(Error('Git'),{status:128,stderr:"fatal: path '"+FINDER_MONITOR_RECEIPT+"' does not exist in 'history'"})},historical),null)
 for(const error of [Object.assign(Error('Denied'),{code:'EACCES'}),Object.assign(Error('Git'),{status:128,stderr:"fatal: path 'other.json' does not exist in 'history'"})])assert.throws(()=>finderMonitorPredecessor(()=>{throw error},historical),e=>e===error)
 assert.throws(()=>finderMonitorPredecessor(p=>p===FINDER_MONITOR_RECEIPT?Buffer.from('{'):current(p),historical))
 assert.throws(()=>finderMonitorPredecessor(current,()=>{throw Error('History unavailable')}))
})

test('validated predecessors are immutable copies and new sources cannot appear in earlier history',()=>{
 const view=finderMonitorPredecessor(current,historical),p='apps/sg-runtime/tests/assistant-notifications-integrity.mjs'
 const first=view.previousBytes(p);first[0]^=1
 assert.deepEqual(view.previousBytes(p),historical(FINDER_MONITOR_BASE,p))
 for(const added of [FINDER_MONITOR_RECEIPT,...Object.keys(FINDER_MONITOR_PINS),'apps/sg-runtime/tests/finder-monitor-source-integrity.mjs','apps/sg-runtime/tests/finder-monitor-source-integrity.test.mjs'])assert.throws(()=>view.previousBytes(added),{code:'ENOENT'})
 for(const p of Object.keys(view.manifest.preservedReceipts))assert.deepEqual(view.previousBytes(p),current(p),p)
})
