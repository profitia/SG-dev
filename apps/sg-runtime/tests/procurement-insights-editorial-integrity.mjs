// Test/build-only continuation for the approved editorial profile. No runtime grant.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
export const EDITORIAL_RECEIPT='apps/sg-runtime/procurement-insights-editorial-integration.json'
export const EDITORIAL_BASE='56dcedb243d5d9568e3bd9cc3e13836f4e8b24bb'
const HOOK='apps/sg-runtime/tests/assistant-notifications-integrity.mjs'
const ENTRY='apps/sg-runtime/tests/assistant-notifications-integrity.test.mjs'
const HELPER='apps/sg-runtime/tests/procurement-insights-editorial-integrity.mjs'
const TEST='apps/sg-runtime/tests/procurement-insights-editorial-integrity.test.mjs'
const COMPOSER='apps/insights-runtime/src/composer.mjs'
const RULES='apps/insights-runtime/src/editorial.mjs'
const SRM_TEST="apps/srm/scripts/xray-performance-adoption.test.mjs"
const SRM_HISTORY_BEFORE="const historicalBlob=spec=>{assert.match(spec,/^[a-f0-9]{40}:.+$/);if(!historicalBlobs.has(spec))historicalBlobs.set(spec,execFileSync('git',['show',spec]));return Buffer.from(historicalBlobs.get(spec))}"
const SRM_HISTORY_AFTER="const historicalBlob=spec=>{\n const authority=spec.match(/^refs\\/remotes\\/origin\\/main:(Canon\\/registries\\/governance-manifest-(?:v2|successors-v1)\\.json)$/)\n if(authority)spec=execFileSync('git',['rev-parse','--verify','refs/remotes/origin/main^{commit}'],{encoding:'utf8'}).trim()+':'+authority[1]\n assert.match(spec,/^[a-f0-9]{40}:.+$/)\n if(!historicalBlobs.has(spec))historicalBlobs.set(spec,execFileSync('git',['show',spec]))\n return Buffer.from(historicalBlobs.get(spec))\n}"
export const EDITORIAL_PATHS=Object.freeze([COMPOSER,RULES,HOOK,ENTRY,HELPER,TEST,SRM_TEST])
const RUNTIME_PINS=Object.freeze({
 [COMPOSER]:'5b1638be94df5a6e5817cb3e0f3d5064b583717f43d3f665db9bfff769df7028',
 [RULES]:'64013d76c4b1ea22fa0d2696bd7521c92013e919fdfc94d57d4a5483cc34fd30',
})
const CANON='Canon/v1.0-procurement-insights-narrative-and-editorial-canon.md'
const CANON_DIGEST='666f04de2b454cb14c55c72c603659607693bb0b2ba8e7cf23f7f6f192fb67c8'
const IMPORT="import {procurementInsightsEditorialPredecessor,EDITORIAL_RECEIPT} from './procurement-insights-editorial-integrity.mjs'\n"
const HEAD='export function assistantNotificationsPredecessor(current,historical){\n'
const PREFIX=" const editorial=procurementInsightsEditorialPredecessor(current,historical)\n if(editorial){\n  const accepted=assistantNotificationsPredecessor(editorial.previousBytes,historical);assert(accepted,'accepted notification source retained')\n  return {...accepted,editorial,manifest:{...accepted.manifest,sourceDigests:{...accepted.manifest.sourceDigests,...editorial.manifest.sourceDigests,[EDITORIAL_RECEIPT]:hash(current(EDITORIAL_RECEIPT))}}}\n }\n"
const TEST_IMPORT="import './procurement-insights-editorial-integrity.test.mjs'\n"
const hash=b=>createHash('sha256').update(b).digest('hex')
export function editorialContinuationSource(before){
 assert.equal(before.split(HEAD).length,2,'one existing source continuation entry')
 return IMPORT+before.replace(HEAD,HEAD+PREFIX)
}
export function procurementInsightsEditorialPredecessor(current,historical){
 let bytes
 try{bytes=current(EDITORIAL_RECEIPT)}catch(error){
  const text=String(error?.stderr??error?.message??'')
  if(error?.code==='ENOENT'||error?.status===128&&["' does not exist in ","' exists on disk, but not in "].some(s=>text.includes("'"+EDITORIAL_RECEIPT+s)))return null
  throw error
 }
 const a=JSON.parse(bytes)
 assert.deepEqual(Object.keys(a).sort(),['schemaVersion','taskId','targetEnvironment','scope','previousSourceSha','canonSha256','sourceDigests','preservedReceipts','authorisationChanged','schemaChanged','modelChanged','providerCallsPerformed','historicalReportsChanged','automaticPublication'].sort())
 assert.equal(a.schemaVersion,'1.0');assert.equal(a.taskId,'SG2-PI-EDITORIAL-CONTINUATION-20261117')
 assert.equal(a.targetEnvironment,'development');assert.equal(a.scope,'PROCUREMENT_INSIGHTS_EDITORIAL_PROFILE_V1');assert.equal(a.previousSourceSha,EDITORIAL_BASE)
 for(const flag of ['authorisationChanged','schemaChanged','modelChanged','providerCallsPerformed','historicalReportsChanged','automaticPublication'])assert.equal(a[flag],false,flag)
 assert.equal(a.canonSha256,CANON_DIGEST);assert.equal(hash(current(CANON)),CANON_DIGEST,'exact owner-approved standalone canon')
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),[...EDITORIAL_PATHS].sort(),'closed editorial source inventory')
 for(const p of EDITORIAL_PATHS){assert.match(a.sourceDigests[p],/^[a-f0-9]{64}$/);assert.equal(hash(current(p)),a.sourceDigests[p],'exact editorial source '+p)}
 for(const[p,pin]of Object.entries(RUNTIME_PINS))assert.equal(a.sourceDigests[p],pin,'only reviewed Composer and canonical instruction '+p)
 const priorHook=String(historical(EDITORIAL_BASE,HOOK))
 assert.equal(String(current(HOOK)),editorialContinuationSource(priorHook),'only additive source dispatch; historical assertions remain intact')
 assert.equal(String(current(ENTRY)),TEST_IMPORT+String(historical(EDITORIAL_BASE,ENTRY)),'existing regressions plus actual editorial continuation tests')
 const priorSrm=String(historical(EDITORIAL_BASE,SRM_TEST))
 assert.equal(priorSrm.split(SRM_HISTORY_BEFORE).length,2,'one original immutable-only cache adapter')
 assert.equal(String(current(SRM_TEST)),priorSrm.replace(SRM_HISTORY_BEFORE,SRM_HISTORY_AFTER),'only two trusted manifest reads resolve to immutable commits before caching')
 // The earlier accepted graph declares its receipts. Preserve all of them and
 // its own acceptance bytes; none is replaced by the new editorial receipt.
 const oldReceipt='apps/sg-runtime/assistant-notifications-integration.json'
 const prior=JSON.parse(historical(EDITORIAL_BASE,oldReceipt))
 const preserved=[oldReceipt,...Object.keys(prior.preservedReceipts)].sort()
 assert.deepEqual(Object.keys(a.preservedReceipts).sort(),preserved)
 for(const p of preserved){
  assert.equal(hash(historical(EDITORIAL_BASE,p)),a.preservedReceipts[p],'original predecessor receipt '+p)
  assert.equal(hash(current(p)),a.preservedReceipts[p],'immutable earlier receipt '+p)
 }
 const added=new Set([EDITORIAL_RECEIPT,RULES,HELPER,TEST]),mapped=new Set(EDITORIAL_PATHS),cache=new Map()
 return{manifest:a,previousBytes:p=>{
  if(added.has(p))throw Object.assign(Error('Editorial addition absent from predecessor: '+p),{code:'ENOENT'})
  if(!mapped.has(p))return current(p)
  if(!cache.has(p))cache.set(p,Buffer.from(historical(EDITORIAL_BASE,p)))
  return Buffer.from(cache.get(p))
 }}
}
