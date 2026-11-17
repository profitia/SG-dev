// Test/build-only exact SG2 presentation continuation. No runtime or access authority.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
export const NOTIFICATIONS_RECEIPT="apps/sg-runtime/assistant-notifications-integration.json"
export const NOTIFICATIONS_BASE="b6adfbc6b46c13ffe48de37872fdd530f400a615"
export const NOTIFICATIONS_PATHS=Object.freeze([
 "apps/sg-runtime/components/procurement-insights/notifications.tsx",
 "apps/sg-runtime/tests/assistant-widget.test.tsx",
 "apps/sg-runtime/tests/assistant-notifications-integrity.mjs",
 "apps/sg-runtime/tests/assistant-notifications-integrity.test.mjs",
 "apps/sg-runtime/tests/procurement-insights-live-acceptance-source.mjs",
 "apps/sg-runtime/tests/procurement-insights.test.tsx"
])
export const NOTIFICATIONS_PRESERVED=Object.freeze([
 "apps/architecture-lab/private-recurring-source-adoption.json",
 "apps/architecture-lab/private-recurring-source.json",
 "apps/sg-runtime/adp-integration.json",
 "apps/sg-runtime/assistant-context-integration.json",
 "apps/sg-runtime/assistant-ecr-integration.json",
 "apps/sg-runtime/assistant-ecr-precision-integration.json",
 "apps/sg-runtime/assistant-ecr-week-integration.json",
 "apps/sg-runtime/assistant-markdown-integration.json",
 "apps/sg-runtime/assistant-send-arrow-integration.json",
 "apps/sg-runtime/development-integration.json",
 "apps/sg-runtime/market-calendar-integration.json",
 "apps/sg-runtime/oil-renderer-integration.json",
 "apps/sg-runtime/operation-integration.json",
 "apps/sg-runtime/private-recurring-source-adoption.json",
 "apps/sg-runtime/procurement-insights-completion-integration.json",
 "apps/sg-runtime/procurement-insights-integration.json",
 "apps/sg-runtime/procurement-insights-live-acceptance.json",
 "apps/sg-runtime/procurement-insights-shell-integration.json",
 "apps/sg-runtime/registration-stage-i-integration.json",
 "apps/sg-runtime/xray-appshell-integration.json",
 "apps/srm/assistant-context-integration.json",
 "apps/srm/development-integration.json",
 "apps/srm/operation-integration.json",
 "apps/srm/private-recurring-source-adoption.json",
 "apps/srm/xray-appshell-integration.json",
 "packages/platform-contracts/test/recurring-consent-transport-source.json"
])
const RUNTIME_PINS=Object.freeze({
 "apps/sg-runtime/components/procurement-insights/notifications.tsx": "12b18e4ae27955b1f2f1f66f0377b36327f75c1247b26e80b64a5e8dbc144629",
 "apps/sg-runtime/tests/assistant-widget.test.tsx": "2842d923544add9fd8e0b650f51cb38915bc0a3eca739e96d323ba4ef338512d"
})
const HOOK="apps/sg-runtime/tests/procurement-insights-live-acceptance-source.mjs",ENTRY="apps/sg-runtime/tests/procurement-insights.test.tsx"
const IMPORT="import {assistantNotificationsPredecessor,NOTIFICATIONS_RECEIPT} from './assistant-notifications-integrity.mjs';\n",HEAD="export function procurementInsightsLiveAcceptancePredecessor(current,historical){\n",PREFIX=" const notifications=assistantNotificationsPredecessor(current,historical);\n if(notifications){\n  const accepted=procurementInsightsLiveAcceptancePredecessor(notifications.previousBytes,historical);assert(accepted,'accepted PI live source retained');\n  return {...accepted,notifications,manifest:{...accepted.manifest,sourceDigests:{...accepted.manifest.sourceDigests,...notifications.manifest.sourceDigests,[NOTIFICATIONS_RECEIPT]:hash(current(NOTIFICATIONS_RECEIPT))}}};\n }\n",TEST_IMPORT="import './assistant-notifications-integrity.test.mjs'\n"
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const missing=p=>Object.assign(Error('Notification continuation absent from predecessor: '+p),{code:'ENOENT'})
export function notificationCompletionSource(before){
 assert.equal(before.split(HEAD).length,2,'one existing completion entry point')
 return IMPORT+before.replace(HEAD,HEAD+PREFIX)
}
export function assistantNotificationsPredecessor(current,historical){
 let bytes
 try{bytes=current(NOTIFICATIONS_RECEIPT)}catch(error){
  const text=String(error?.stderr??error?.message??'')
  if(error?.code==='ENOENT'||error?.status===128&&["' does not exist in ","' exists on disk, but not in "].some(s=>text.includes("'"+NOTIFICATIONS_RECEIPT+s)))return null
  throw error
 }
 const a=JSON.parse(bytes)
 assert.deepEqual(Object.keys(a).sort(),['schemaVersion','taskId','targetEnvironment','scope','previousSourceSha','sourceDigests','preservedReceipts','authorisationChanged','schemaChanged','modelChanged','policiesChanged','providerCallsPerformed','deploymentPerformed'].sort())
 assert.equal(a.schemaVersion,'1.0.0');assert.equal(a.taskId,'SG2-CLOUD-APPSHELL-NOTIFICATIONS-20261113');assert.equal(a.targetEnvironment,'development')
 assert.equal(a.scope,'APPSHELL_NOTIFICATION_ICON');assert.equal(a.previousSourceSha,NOTIFICATIONS_BASE)
 for(const flag of ['authorisationChanged','schemaChanged','modelChanged','policiesChanged','providerCallsPerformed','deploymentPerformed'])assert.equal(a[flag],false,flag)
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),[...NOTIFICATIONS_PATHS].sort(),'closed notification source inventory')
 for(const p of NOTIFICATIONS_PATHS){assert.match(a.sourceDigests[p],/^[a-f0-9]{64}$/);assert.equal(hash(current(p)),a.sourceDigests[p],'exact notification source '+p)}
 for(const [p,pin]of Object.entries(RUNTIME_PINS))assert.equal(a.sourceDigests[p],pin,'only the reviewed presentation and regression bytes '+p)
 assert.deepEqual(Object.keys(a.preservedReceipts).sort(),[...NOTIFICATIONS_PRESERVED].sort())
 for(const p of NOTIFICATIONS_PRESERVED){assert.equal(hash(current(p)),a.preservedReceipts[p],'immutable prior receipt '+p);assert.equal(hash(historical(NOTIFICATIONS_BASE,p)),a.preservedReceipts[p],'original prior receipt '+p)}
 assert.equal(String(current(HOOK)),notificationCompletionSource(String(historical(NOTIFICATIONS_BASE,HOOK))),'only additive completion dispatch; original assertions unchanged')
 assert.equal(String(current(ENTRY)),TEST_IMPORT+String(historical(NOTIFICATIONS_BASE,ENTRY)),'existing suite plus real continuation regressions')
 const added=new Set(NOTIFICATIONS_PATHS.filter(p=>p.endsWith('/assistant-notifications-integrity.mjs')||p.endsWith('/assistant-notifications-integrity.test.mjs'))),mapped=new Set(NOTIFICATIONS_PATHS),cache=new Map()
 return {manifest:a,previousBytes:p=>{
  if(p===NOTIFICATIONS_RECEIPT||added.has(p))throw missing(p)
  if(!mapped.has(p))return current(p)
  if(!cache.has(p))cache.set(p,Buffer.from(historical(NOTIFICATIONS_BASE,p)))
  return Buffer.from(cache.get(p))
 }}
}
