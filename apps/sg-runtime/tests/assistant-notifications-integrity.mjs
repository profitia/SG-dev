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
// Current UI bytes are verified before unchanged historical acceptance checks.
// This extends the existing metadata-driven source reader; it grants no runtime rights.
const UI_SUCCESSOR={
  "receipt": "apps/sg-runtime/procurement-insights-e2e-continuation.json",
  "base": "df57c042e2fbd60fc14ea7f883f245ea6be8e2ee",
  "taskId": "SG2-PI-E2E-COMPLETION-20261117",
  "scope": "PI_PUBLICATION_NAVIGATION_AND_LOCALE",
  "paths": [
    "apps/sg-runtime/components/procurement-insights/workspace.tsx",
    "apps/sg-runtime/components/procurement-insights/reports.tsx",
    "apps/sg-runtime/components/procurement-insights/observation-form.tsx",
    "apps/sg-runtime/components/procurement-insights/statistics.tsx",
    "apps/sg-runtime/components/procurement-insights/localization.ts",
    "apps/sg-runtime/tests/procurement-insights-notification-navigation.test.tsx",
    "apps/sg-runtime/tests/procurement-insights-e2e-continuation.test.tsx",
    "apps/sg-runtime/tests/procurement-insights-completion.test.mjs",
    "apps/sg-runtime/tests/assistant-notifications-integrity.mjs"
  ],
  "pins": {
    "apps/sg-runtime/components/procurement-insights/workspace.tsx": "961e48f55a8ac92fc0fce9e33bdaced6bb590767cc2fae0341b28f61deaa121f",
    "apps/sg-runtime/components/procurement-insights/reports.tsx": "13d42a6e000e59647b12d4c7fa4877a203979385ecb8e124d92a79ea3f2d747e",
    "apps/sg-runtime/components/procurement-insights/observation-form.tsx": "0fc252d57e25502c2440939a5bb2ae5a7065130feb714b872f0ff4ff8c2445c5",
    "apps/sg-runtime/components/procurement-insights/statistics.tsx": "3b822985e383f357c057763dcbbc05c89756302ae68ac3b47cc9df5829093248",
    "apps/sg-runtime/components/procurement-insights/localization.ts": "34a9c1d254475ef98a68cf9c4b3793ab6ad2e304c4c13df659ed61584ed6619e",
    "apps/sg-runtime/tests/procurement-insights-notification-navigation.test.tsx": "cb266554ad865ba13a7b044ec4990b89959cf6d6143efc6253fb35916318f3a1",
    "apps/sg-runtime/tests/procurement-insights-e2e-continuation.test.tsx": "e07bd91e982c47c7dd1db5a01dfbe3c71c93781f60ed0566e899ae1494ec70d6",
    "apps/sg-runtime/tests/procurement-insights-completion.test.mjs": "9329b585b56e098f574d54a1821025b7118fc811b2c1cc9a5993e6f4dee1f760"
  },
  "preserved": [
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
    "packages/platform-contracts/test/recurring-consent-transport-source.json",
    "apps/sg-runtime/assistant-notifications-integration.json"
  ]
}
function optionalReceipt(current,name){
 try{return current(name)}catch(e){
  const text=String(e?.stderr??e?.message??'');
  if(e?.code==='ENOENT'||e?.status===128&&["' does not exist in ","' exists on disk, but not in "].some(s=>text.includes("'"+name+s)))return null;
  throw e;
 }
}
function sourceSuccessor(current,historical,config){
 const bytes=optionalReceipt(current,config.receipt);if(bytes===null)return null;
 const a=JSON.parse(bytes);
 assert.deepEqual(Object.keys(a).sort(),['schemaVersion','taskId','targetEnvironment','scope','previousSourceSha','sourceDigests','preservedReceipts','authorisationChanged','schemaChanged','modelChanged','policiesChanged','providerCallsPerformed','deploymentPerformed'].sort());
 assert.equal(a.schemaVersion,'1.0.0');assert.equal(a.taskId,config.taskId);assert.equal(a.targetEnvironment,'development');assert.equal(a.scope,config.scope);assert.equal(a.previousSourceSha,config.base);
 for(const flag of ['authorisationChanged','schemaChanged','modelChanged','policiesChanged','providerCallsPerformed','deploymentPerformed'])assert.equal(a[flag],false,flag);
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),[...config.paths].sort());
 for(const p of config.paths){assert.match(a.sourceDigests[p],/^[a-f0-9]{64}$/);assert.equal(hash(current(p)),a.sourceDigests[p],'current successor bytes '+p)}
 for(const [p,pin]of Object.entries(config.pins))assert.equal(a.sourceDigests[p],pin,'fixed reviewed consumer bytes '+p);
 assert.deepEqual(Object.keys(a.preservedReceipts).sort(),[...config.preserved].sort());
 for(const p of config.preserved){assert.equal(hash(current(p)),a.preservedReceipts[p]);assert.equal(hash(historical(config.base,p)),a.preservedReceipts[p],'unchanged predecessor receipt '+p)}
 const mapped=new Set(config.paths),cache=new Map();
 return {manifest:a,previousBytes:p=>{
  if(p===config.receipt)throw missing(p);if(!mapped.has(p))return current(p);
  if(!cache.has(p)){try{cache.set(p,Buffer.from(historical(config.base,p)))}catch(e){const text=String(e?.stderr??e?.message??'');if(e?.code==='ENOENT'||e?.status===128&&["' does not exist in ","' exists on disk, but not in "].some(s=>text.includes("'"+p+s)))throw missing(p);throw e}}
  return Buffer.from(cache.get(p));
 }};
}
export function assistantNotificationsPredecessor(current,historical){
 const successor=sourceSuccessor(current,historical,UI_SUCCESSOR);
 if(successor){
  const accepted=assistantNotificationsPredecessor(successor.previousBytes,historical);assert(accepted,'unchanged accepted notification predecessor');
  return {...accepted,successor,manifest:{...accepted.manifest,sourceDigests:{...accepted.manifest.sourceDigests,...successor.manifest.sourceDigests,[UI_SUCCESSOR.receipt]:hash(current(UI_SUCCESSOR.receipt))}}};
 }
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
