import {assistantQualityPredecessor,QUALITY_RECEIPT} from './assistant-quality-integrity.mjs'
// Test/build-only binding of the two owner-approved monitor sources. No runtime grant.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'

export const FINDER_MONITOR_RECEIPT='apps/sg-runtime/finder-monitor-source-integration.json'
export const FINDER_MONITOR_BASE='6642755628be60dc0547d81f2b46f71c3a6855ee'
export const FINDER_MONITOR_APPROVED='f20431f0d43f8d34f3021aa4fe6ceea560837fdc'
export const FINDER_MONITOR_APPROVAL='owner-decision:01a19782-bad9-7c42-be7e-fd05f4a06292:FINDER-MONITOR-PCI-BINDING-20261117'
export const FINDER_MONITOR_PINS=Object.freeze({
 'apps/sg-runtime/scripts/monitor-benchmark-finder.mjs':'ad6cf703bd3e142ca185f5e2b1fa26e1b6665c4f7d6be707b1b37b054ee55f62',
 'apps/sg-runtime/tests/monitor-benchmark-finder.test.mjs':'8f54c9aba542d60d2cef41ec3dc546fee43ed4e656083b9b7e5b837b4f0ef47b'
})
const HOOK='apps/sg-runtime/tests/assistant-notifications-integrity.mjs'
const ENTRY='apps/sg-runtime/tests/assistant-notifications-integrity.test.mjs'
const HELPER='apps/sg-runtime/tests/finder-monitor-source-integrity.mjs'
const TEST='apps/sg-runtime/tests/finder-monitor-source-integrity.test.mjs'
const EDITORIAL_HOOK='apps/sg-runtime/tests/procurement-insights-editorial-integrity.mjs'
const PRIOR_GRAPH='apps/sg-runtime/procurement-insights-editorial-integration.json'
export const FINDER_MONITOR_PATHS=Object.freeze([...Object.keys(FINDER_MONITOR_PINS),HOOK,ENTRY,EDITORIAL_HOOK,HELPER,TEST])
const IMPORT="import {finderMonitorPredecessor,FINDER_MONITOR_RECEIPT} from './finder-monitor-source-integrity.mjs'\n"
const HEAD='export function assistantNotificationsPredecessor(current,historical){\n'
const PREFIX=" const finderMonitor=finderMonitorPredecessor(current,historical)\n if(finderMonitor){\n  const accepted=assistantNotificationsPredecessor(finderMonitor.previousBytes,historical);assert(accepted,'accepted notification source retained')\n  return {...accepted,finderMonitor,manifest:{...accepted.manifest,sourceDigests:{...accepted.manifest.sourceDigests,...finderMonitor.manifest.sourceDigests,[FINDER_MONITOR_RECEIPT]:hash(current(FINDER_MONITOR_RECEIPT))}}}\n }\n"
const TEST_IMPORT="import './finder-monitor-source-integrity.test.mjs'\n"
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')

export function finderMonitorContinuationSource(before){
 assert.equal(before.split(HEAD).length,2,'one existing source continuation entry')
 return IMPORT+before.replace(HEAD,HEAD+PREFIX)
}

export function finderMonitorEditorialSource(before){
 const target=' const a=JSON.parse(bytes)\n'
 assert.equal(before.split(target).length,2,'one existing editorial parse boundary')
 // Keep the existing narrow optional-absence and read-error handling before dispatch.
 const dispatch=" const finderMonitor=finderMonitorPredecessor(current,historical)\n if(finderMonitor)return procurementInsightsEditorialPredecessor(finderMonitor.previousBytes,historical)\n"
 return "import {finderMonitorPredecessor} from './finder-monitor-source-integrity.mjs'\n"+before.replace(target,dispatch+target)
}

export function finderMonitorPredecessor(current,historical){
 let bytes
 try{bytes=current(FINDER_MONITOR_RECEIPT)}catch(error){
  const text=String(error?.stderr??error?.message??'')
  const missingGit=error?.status===128&&["' does not exist in ","' exists on disk, but not in "].some(s=>text.includes("'"+FINDER_MONITOR_RECEIPT+s))
  if(error?.code==='ENOENT'||missingGit)return null
  throw error
 }
 const quality=assistantQualityPredecessor(current,historical)
 if(quality){
  const accepted=finderMonitorPredecessor(quality.previousBytes,historical);assert(accepted,'accepted Finder monitor source retained')
  return {...accepted,quality,manifest:{...accepted.manifest,sourceDigests:{...accepted.manifest.sourceDigests,...quality.manifest.sourceDigests,[QUALITY_RECEIPT]:hash(current(QUALITY_RECEIPT))}}}
 }
 const a=JSON.parse(bytes)
 assert.deepEqual(Object.keys(a).sort(),['schemaVersion','taskId','targetEnvironment','scope','previousSourceSha','approvedMonitorSourceSha','approvalRef','sourceDigests','preservedReceipts','authorisationChanged','schemaChanged','engineChanged','ciChecksWeakened','otherEnvironmentsChanged','runtimeActivationPerformed'].sort())
 assert.equal(a.schemaVersion,'1.0')
 assert.equal(a.taskId,'SG2-FINDER-MONITOR-PCI-BINDING-20261117')
 assert.equal(a.targetEnvironment,'development')
 assert.equal(a.scope,'FINDER_MONITOR_SOURCE_BINDING_ONLY')
 assert.equal(a.previousSourceSha,FINDER_MONITOR_BASE)
 assert.equal(a.approvedMonitorSourceSha,FINDER_MONITOR_APPROVED)
 assert.equal(a.approvalRef,FINDER_MONITOR_APPROVAL)
 for(const flag of ['authorisationChanged','schemaChanged','engineChanged','ciChecksWeakened','otherEnvironmentsChanged','runtimeActivationPerformed'])assert.equal(a[flag],false,flag)
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),[...FINDER_MONITOR_PATHS].sort(),'closed monitor source inventory')
 for(const p of FINDER_MONITOR_PATHS){
  assert.match(a.sourceDigests[p],/^[a-f0-9]{64}$/)
  assert.equal(hash(current(p)),a.sourceDigests[p],'exact Finder monitor source '+p)
 }
 for(const[p,pin]of Object.entries(FINDER_MONITOR_PINS))assert.equal(a.sourceDigests[p],pin,'only the already approved monitor bytes '+p)
 assert.equal(String(current(HOOK)),finderMonitorContinuationSource(String(historical(FINDER_MONITOR_BASE,HOOK))),'only additive dispatch; every historical assertion retained')
 assert.equal(String(current(ENTRY)),TEST_IMPORT+String(historical(FINDER_MONITOR_BASE,ENTRY)),'existing regressions plus real monitor and continuation tests')
 assert.equal(String(current(EDITORIAL_HOOK)),finderMonitorEditorialSource(String(historical(FINDER_MONITOR_BASE,EDITORIAL_HOOK))),'only validated predecessor dispatch; editorial assertions and read errors retained')
 const prior=JSON.parse(historical(FINDER_MONITOR_BASE,PRIOR_GRAPH))
 const preserved=[PRIOR_GRAPH,...Object.keys(prior.preservedReceipts)].sort()
 assert.deepEqual(Object.keys(a.preservedReceipts).sort(),preserved,'complete accepted receipt graph retained')
 for(const p of preserved){
  assert.equal(hash(historical(FINDER_MONITOR_BASE,p)),a.preservedReceipts[p],'original receipt '+p)
  assert.equal(hash(current(p)),a.preservedReceipts[p],'immutable earlier receipt '+p)
 }
 const mapped=new Set(FINDER_MONITOR_PATHS),added=new Set([FINDER_MONITOR_RECEIPT,...Object.keys(FINDER_MONITOR_PINS),HELPER,TEST]),cache=new Map()
 return{manifest:a,previousBytes:p=>{
  if(added.has(p))throw Object.assign(Error('Finder monitor addition absent from predecessor: '+p),{code:'ENOENT'})
  if(!mapped.has(p))return current(p)
  if(!cache.has(p))cache.set(p,Buffer.from(historical(FINDER_MONITOR_BASE,p)))
  return Buffer.from(cache.get(p))
 }}
}
