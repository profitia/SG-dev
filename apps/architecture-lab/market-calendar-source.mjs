// Exact source adoption only. Never imported by an application runtime; cannot
// grant access, install the prepared owner packet or authorize a deployment.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
export const MARKET_CALENDAR_PRODUCER_RECORD='apps/economic-calendar-runtime/market-calendar-preferences-integration.json'
export const MARKET_CALENDAR_PRODUCER_BASE='38a9fe371e7993b47e2358d297647086ea999428'
export const MARKET_CALENDAR_PRODUCER_RECORD_SHA='4fb8f320a63844bccd7ddccc9cf8fed3e22ac12d6b0f8306fa41274009d7a0af'
export const MARKET_CALENDAR_PRODUCER_PATHS=Object.freeze([
 'Canon/evidence/2026-11-11-procurement-insights-market-calendar-owner-approval.md',
 'Canon/registries/governance-manifest-v2.json',
 'Canon/v1.3-procurement-insights-market-calendar-amendment.md',
 'apps/architecture-lab/private-recurring-source.mjs',
 'apps/architecture-lab/test/market-calendar-source.test.mjs',
 'apps/economic-calendar-runtime/operations/market-calendar-owner-plan.json',
 'apps/economic-calendar-runtime/operations/market-calendar-private-access.sql',
 'apps/economic-calendar-runtime/package-lock.json',
 'apps/economic-calendar-runtime/package.json',
 'apps/economic-calendar-runtime/src/server.mjs',
 'apps/economic-calendar-runtime/test/api.test.mjs',
 'apps/economic-calendar-runtime/test/market-calendar-preferences.test.mjs',
 'packages/economic-calendar-contracts/index.d.mts',
 'packages/economic-calendar-contracts/index.mjs',
 'packages/economic-calendar-contracts/package.json'
])
export const MARKET_CALENDAR_CONSUMER_RECORD='apps/sg-runtime/market-calendar-integration.json'
export const MARKET_CALENDAR_CONSUMER_PATHS=Object.freeze([
 'apps/sg-runtime/app/api/v1/market-calendar/[[...path]]/route.ts',
 'apps/sg-runtime/components/procurement-insights/calendar-detail.tsx',
 'apps/sg-runtime/components/procurement-insights/calendar-dialogs.tsx',
 'apps/sg-runtime/components/procurement-insights/market-calendar.css',
 'apps/sg-runtime/components/procurement-insights/market-calendar.tsx',
 'apps/sg-runtime/components/procurement-insights/workspace.css',
 'apps/sg-runtime/components/procurement-insights/workspace.tsx',
 'apps/sg-runtime/lib/market-calendar/client.ts',
 'apps/sg-runtime/lib/market-calendar/model.ts',
 'apps/sg-runtime/lib/market-calendar/runtime.ts',
 'apps/sg-runtime/middleware.ts',
 'apps/sg-runtime/package.json',
 'apps/sg-runtime/tests/market-calendar-integrity.mjs',
 'apps/sg-runtime/tests/market-calendar-integrity.test.mjs',
 'apps/sg-runtime/tests/market-calendar-model.test.ts',
 'apps/sg-runtime/tests/market-calendar-proxy.test.ts',
 'apps/sg-runtime/tests/market-calendar.test.tsx'
])
const hash=b=>createHash('sha256').update(b).digest('hex')
function readOptional(current,file){try{return current(file)}catch(e){if(e?.code==='ENOENT'||e?.status===128&&["' does not exist in ","' exists on disk, but not in "].some(s=>String(e.stderr??e.message??'').includes("'"+file+s)))return null;throw e}}
function verifyPaths(current,digests,expected){assert.deepEqual(Object.keys(digests).sort(),[...expected].sort());for(const p of expected){assert.match(digests[p],/^[a-f0-9]{64}$/);assert.equal(hash(current(p)),digests[p],'exact calendar source '+p)}}
function project(current,historical,base,paths,record){const mapped=new Set(paths),cache=new Map();return p=>{
 if(p===record)throw Object.assign(Error('Calendar adoption absent from predecessor'),{code:'ENOENT'})
 if(!mapped.has(p))return current(p)
 if(!cache.has(p))cache.set(p,Buffer.from(historical(base,p)))
 return Buffer.from(cache.get(p))
}}
function verifyProducer(current,historical,bytes){
 assert.equal(hash(bytes),MARKET_CALENDAR_PRODUCER_RECORD_SHA,'immutable calendar producer source record')
 const a=JSON.parse(bytes);assert.equal(a.previousSourceSha,MARKET_CALENDAR_PRODUCER_BASE);assert.equal(a.taskId,'ARCHITECTURE-ECR-MARKET-CALENDAR-CONSUMER-20261111');assert.equal(a.targetEnvironment,'development')
 verifyPaths(current,a.sourceDigests,MARKET_CALENDAR_PRODUCER_PATHS)
 for(const[p,digest]of Object.entries(a.preservedReceipts)){assert.equal(hash(current(p)),digest,'immutable predecessor '+p);assert.equal(hash(historical(a.previousSourceSha,p)),digest)}
 return a
}
export function marketCalendarSourcePredecessor(current,historical){
 const consumer=readOptional(current,MARKET_CALENDAR_CONSUMER_RECORD)
 if(consumer){
  const a=JSON.parse(consumer)
  assert.deepEqual(Object.keys(a).sort(),['schemaVersion','taskId','targetEnvironment','scope','previousSourceSha','producerRecordSha256','sourceDigests','preservedReceipts','noProviderAcquisition','noIndependentStore','noNotificationDelivery','activationIsSeparate'].sort())
  assert.equal(a.schemaVersion,'1.0.0');assert.equal(a.taskId,'SG2-PROCUREMENT-MARKET-CALENDAR-20261111');assert.equal(a.targetEnvironment,'development');assert.equal(a.scope,'MARKET_CALENDAR_CONSUMER_SOURCE')
  assert.match(a.previousSourceSha,/^[a-f0-9]{40}$/);assert.equal(a.producerRecordSha256,MARKET_CALENDAR_PRODUCER_RECORD_SHA)
  assert.equal(hash(current(MARKET_CALENDAR_PRODUCER_RECORD)),MARKET_CALENDAR_PRODUCER_RECORD_SHA)
  assert.equal(hash(historical(a.previousSourceSha,MARKET_CALENDAR_PRODUCER_RECORD)),MARKET_CALENDAR_PRODUCER_RECORD_SHA,'producer was present in actual consumer predecessor')
  verifyProducer(current,historical,current(MARKET_CALENDAR_PRODUCER_RECORD))
  verifyPaths(current,a.sourceDigests,MARKET_CALENDAR_CONSUMER_PATHS)
  for(const k of ['noProviderAcquisition','noIndependentStore','noNotificationDelivery','activationIsSeparate'])assert.equal(a[k],true,k)
  const receipts=Object.keys(a.preservedReceipts);assert(receipts.length>=10);assert(receipts.includes('apps/sg-runtime/operation-integration.json'));assert(receipts.includes('apps/sg-runtime/procurement-insights-integration.json'));assert(receipts.includes('apps/sg-runtime/private-recurring-source-adoption.json'))
  for(const p of receipts){assert.match(p,/^apps\/sg-runtime\/(?:[a-z0-9-]+(?:integration|adoption)\.json)$/);assert.equal(hash(current(p)),a.preservedReceipts[p]);assert.equal(hash(historical(a.previousSourceSha,p)),a.preservedReceipts[p])}
  const before=JSON.parse(historical(a.previousSourceSha,'apps/sg-runtime/package.json')),after=JSON.parse(current('apps/sg-runtime/package.json'))
  assert.deepEqual({...after,scripts:before.scripts},before,'existing packages and product metadata remain unchanged')
  assert.deepEqual(Buffer.from(current('apps/sg-runtime/package-lock.json')),Buffer.from(historical(a.previousSourceSha,'apps/sg-runtime/package-lock.json')),'no new dependency or lock mutation')
  return{manifest:a,previousBytes:project(current,historical,a.previousSourceSha,MARKET_CALENDAR_CONSUMER_PATHS,MARKET_CALENDAR_CONSUMER_RECORD)}
 }
 const producer=readOptional(current,MARKET_CALENDAR_PRODUCER_RECORD);if(!producer)return null
 const a=verifyProducer(current,historical,producer)
 const projection=[...MARKET_CALENDAR_PRODUCER_PATHS,'apps/architecture-lab/market-calendar-source.mjs']
 return{manifest:a,previousBytes:project(current,historical,a.previousSourceSha,projection,MARKET_CALENDAR_PRODUCER_RECORD)}
}
