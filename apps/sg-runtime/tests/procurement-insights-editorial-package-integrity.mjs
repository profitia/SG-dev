import {knowledgeSourcePredecessor} from '../../architecture-lab/knowledge-source.mjs'
import {calendarCurrentMainPredecessor} from '../../architecture-lab/calendar-current-main-source.mjs'
// Test/build-only package identity continuation; no runtime authority or code changes.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
export const EDITORIAL_PACKAGE_RECEIPT='apps/sg-runtime/procurement-insights-editorial-package-integration.json'
export const EDITORIAL_PACKAGE_BASE='1888f0f707ab382e8886f31bedb5983e1f5a1026'
const META=['apps/insights-runtime/package.json','apps/insights-runtime/package-lock.json','apps/sg-runtime/package-lock.json']
const HOOK='apps/sg-runtime/tests/assistant-notifications-integrity.mjs'
const ENTRY='apps/sg-runtime/tests/assistant-notifications-integrity.test.mjs'
const HELPER='apps/sg-runtime/tests/procurement-insights-editorial-package-integrity.mjs'
const TEST='apps/sg-runtime/tests/procurement-insights-editorial-package-integrity.test.mjs'
const LEGACY_TEST='apps/sg-runtime/tests/procurement-insights-editorial-integrity.test.mjs'
const FINDER_TEST='apps/sg-runtime/tests/finder-monitor-source-integrity.test.mjs'
const FINDER_RECEIPT='apps/sg-runtime/finder-monitor-source-integration.json'
export const EDITORIAL_PACKAGE_PATHS=Object.freeze([...META,HOOK,ENTRY,HELPER,TEST,LEGACY_TEST,FINDER_TEST])
const hash=b=>createHash('sha256').update(b).digest('hex')
const HEAD='export function assistantNotificationsPredecessor(current,historical){\n'
const IMPORT="import {procurementInsightsEditorialPackagePredecessor,EDITORIAL_PACKAGE_RECEIPT} from './procurement-insights-editorial-package-integrity.mjs'\n"
const PREFIX=" const packaged=procurementInsightsEditorialPackagePredecessor(current,historical)\n if(packaged){\n  const accepted=assistantNotificationsPredecessor(packaged.previousBytes,historical);assert(accepted,'accepted editorial source retained')\n  return {...accepted,editorialPackage:packaged,manifest:{...accepted.manifest,sourceDigests:{...accepted.manifest.sourceDigests,...packaged.manifest.sourceDigests,[EDITORIAL_PACKAGE_RECEIPT]:hash(current(EDITORIAL_PACKAGE_RECEIPT))}}}\n }\n"
export function editorialPackageContinuationSource(before){
 assert.equal(before.split(HEAD).length,2,'one existing source entry')
 return IMPORT+before.replace(HEAD,HEAD+PREFIX)
}
export function editorialPackageHistoricalTestSource(before){
 const read="const root=new URL('../../../',import.meta.url),current=p=>fs.readFileSync(new URL(p,root))"
 const ending="return blobs.get(key)}\n"
 assert.equal(before.split(read).length,2);assert.equal(before.split(ending).length,2)
 return "import {procurementInsightsEditorialPackagePredecessor} from './procurement-insights-editorial-package-integrity.mjs'\n"+before.replace(read,read.replace('current=','physicalCurrent=')).replace(ending,ending+"const current=procurementInsightsEditorialPackagePredecessor(physicalCurrent,historical)?.previousBytes??physicalCurrent\n")
}
export function editorialPackageFinderHistoricalTestSource(before){
 const first="import './monitor-benchmark-finder.test.mjs'\n"
 const read="const root=new URL('../../../',import.meta.url),current=p=>readFileSync(new URL(p,root)),cache=new Map()"
 const ending="return Buffer.from(cache.get(key))}\n"
 assert.equal(before.split(first).length,2);assert.equal(before.split(read).length,2);assert.equal(before.split(ending).length,2)
 return before.replace(first,first+"import {procurementInsightsEditorialPackagePredecessor} from './procurement-insights-editorial-package-integrity.mjs'\n").replace(read,read.replace('current=','physicalCurrent=')).replace(ending,ending+"const current=procurementInsightsEditorialPackagePredecessor(physicalCurrent,historical)?.previousBytes??physicalCurrent\n")
}
function versionOnly(current,historical,p){
 const before=JSON.parse(historical(EDITORIAL_PACKAGE_BASE,p)),after=JSON.parse(current(p))
 const expected=structuredClone(before)
 if(p===META[0]){assert.equal(before.version,'1.2.0');expected.version='1.2.1'}
 else if(p===META[1]){assert.equal(before.version,'1.2.0');assert.equal(before.packages[''].version,'1.2.0');expected.version='1.2.1';expected.packages[''].version='1.2.1'}
 else {assert.equal(before.packages['node_modules/@profitia/insights-runtime'].version,'1.2.0');expected.packages['node_modules/@profitia/insights-runtime'].version='1.2.1'}
 assert.deepEqual(after,expected,'only editorial local package version, no dependency or runtime change: '+p)
}
export function procurementInsightsEditorialPackagePredecessor(current,historical){
 const composed=calendarCurrentMainPredecessor(current,historical)
 if(composed){const source=knowledgeSourcePredecessor(composed.acceptedMainBytes,historical)?.previousBytes??composed.acceptedMainBytes;const accepted=procurementInsightsEditorialPackagePredecessor(source,historical);assert(accepted,'complete accepted editorial predecessor required');return {...accepted,currentMainComposition:composed.manifest}}
 let bytes
 try{bytes=current(EDITORIAL_PACKAGE_RECEIPT)}catch(e){
  const text=String(e?.stderr??e?.message??'')
  if(e?.code==='ENOENT'||e?.status===128&&["' does not exist in ","' exists on disk, but not in "].some(s=>text.includes("'"+EDITORIAL_PACKAGE_RECEIPT+s)))return null
  throw e
 }
 const a=JSON.parse(bytes)
 assert.deepEqual(Object.keys(a).sort(),['schemaVersion','taskId','targetEnvironment','scope','previousSourceSha','packageVersionBefore','packageVersionAfter','sourceDigests','preservedReceipts','authorisationChanged','schemaChanged','runtimeCodeChanged','dependenciesChanged','modelChanged','providerCallsPerformed','historicalReportsChanged','automaticPublication'].sort())
 assert.equal(a.schemaVersion,'1.0');assert.equal(a.taskId,'SG2-PI-EDITORIAL-PACKAGE-CACHE-20261117')
 assert.equal(a.targetEnvironment,'development');assert.equal(a.scope,'EDITORIAL_LOCAL_PACKAGE_VERSION_ONLY')
 assert.equal(a.previousSourceSha,EDITORIAL_PACKAGE_BASE);assert.equal(a.packageVersionBefore,'1.2.0');assert.equal(a.packageVersionAfter,'1.2.1')
 for(const flag of ['authorisationChanged','schemaChanged','runtimeCodeChanged','dependenciesChanged','modelChanged','providerCallsPerformed','historicalReportsChanged','automaticPublication'])assert.equal(a[flag],false,flag)
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),[...EDITORIAL_PACKAGE_PATHS].sort())
 for(const p of EDITORIAL_PACKAGE_PATHS){assert.match(a.sourceDigests[p],/^[a-f0-9]{64}$/);assert.equal(hash(current(p)),a.sourceDigests[p],'exact package continuation '+p)}
 for(const p of META)versionOnly(current,historical,p)
 assert.equal(String(current(HOOK)),editorialPackageContinuationSource(String(historical(EDITORIAL_PACKAGE_BASE,HOOK))),'only additive package dispatch')
 assert.equal(String(current(ENTRY)),"import './procurement-insights-editorial-package-integrity.test.mjs'\n"+String(historical(EDITORIAL_PACKAGE_BASE,ENTRY)),'retain every prior test')
 assert.equal(String(current(LEGACY_TEST)),editorialPackageHistoricalTestSource(String(historical(EDITORIAL_PACKAGE_BASE,LEGACY_TEST))),'only authenticated predecessor fixture; all editorial assertions retained')
 assert.equal(String(current(FINDER_TEST)),editorialPackageFinderHistoricalTestSource(String(historical(EDITORIAL_PACKAGE_BASE,FINDER_TEST))),'all approved Finder assertions retained on authenticated predecessor')
 const priorReceipt='apps/sg-runtime/procurement-insights-editorial-integration.json'
 const prior=JSON.parse(historical(EDITORIAL_PACKAGE_BASE,priorReceipt))
 const preserved=[priorReceipt,...Object.keys(prior.preservedReceipts),FINDER_RECEIPT].sort()
 assert.deepEqual(Object.keys(a.preservedReceipts).sort(),preserved,'preserve all29 earlier receipts')
 for(const p of preserved){assert.equal(hash(current(p)),a.preservedReceipts[p]);assert.equal(hash(historical(EDITORIAL_PACKAGE_BASE,p)),a.preservedReceipts[p])}
 const mapped=new Set(EDITORIAL_PACKAGE_PATHS),added=new Set([EDITORIAL_PACKAGE_RECEIPT,HELPER,TEST]),cache=new Map()
 return{manifest:a,previousBytes:p=>{
  if(added.has(p))throw Object.assign(Error('Package addition absent from predecessor: '+p),{code:'ENOENT'})
  if(!mapped.has(p))return current(p)
  if(!cache.has(p))cache.set(p,Buffer.from(historical(EDITORIAL_PACKAGE_BASE,p)))
  return Buffer.from(cache.get(p))
 }}
}
