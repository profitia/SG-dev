// Exact source adoption only. Never imported by an application runtime; cannot
// grant access, install the prepared owner packet or authorize a deployment.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
export const MARKET_CALENDAR_PRODUCER_RECORD='apps/economic-calendar-runtime/market-calendar-preferences-integration.json'
export const MARKET_CALENDAR_PRODUCER_BASE='bfc4a228d9f3d583c37c5fd984c7e4da602bf75d'
export const MARKET_CALENDAR_PRODUCER_RECORD_SHA='e3bc27ddf22b9165555c05f938a3c5d8f9f4f09334fcb7c55e760da44e9a59b6'
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
 'apps/sg-runtime/tests/assistant-ecr-week-integrity.test.mjs',
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
 'apps/sg-runtime/tests/market-calendar.test.tsx',
 'apps/sg-runtime/tests/adp-appshell-consumer.test.tsx',
 'apps/sg-runtime/tests/appshell-product-boundary.test.ts',
 'apps/sg-runtime/tests/pci-smart-integrity.test.mjs'
])
export const MARKET_CALENDAR_TEST_COMPATIBILITY_RECORD='apps/architecture-lab/market-calendar-test-compatibility.json'
const TEST_COMPATIBILITY_SHA='52e859d4a99bc4c8e4d986f38afea2d58e9c1fe1ee1e0eb62cc2672dbdb60078'
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
/** Authenticate only the separately accepted test correction, then expose the
 * immutable producer graph. Runtime, contracts, SQL and old receipts are exact. */
export function calendarTestCompatibilityCurrent(current,historical){
 const bytes=readOptional(current,MARKET_CALENDAR_TEST_COMPATIBILITY_RECORD);if(!bytes)return current
 assert.equal(hash(bytes),TEST_COMPATIBILITY_SHA,'immutable test-only compatibility receipt')
 const a=JSON.parse(bytes),test='apps/architecture-lab/test/market-calendar-source.test.mjs'
 assert.equal(a.previousSourceSha,'877c55c6ef7879c088255284dd852d5cab6d5f44')
 assert.equal(hash(current(MARKET_CALENDAR_PRODUCER_RECORD)),a.producerRecordSha256)
 verifyPaths(current,a.sourceDigests,[test])
 assert.equal(hash(historical(a.previousSourceSha,MARKET_CALENDAR_PRODUCER_RECORD)),MARKET_CALENDAR_PRODUCER_RECORD_SHA)
 return project(current,historical,a.previousSourceSha,[test,'apps/architecture-lab/market-calendar-source.mjs'],MARKET_CALENDAR_TEST_COMPATIBILITY_RECORD)
}

// One owner-approved BSDC documentation successor. Authenticate its exact
// evidence and document bytes before exposing the unchanged Calendar history.
export const BSDC_MANIFEST_CONTINUITY=Object.freeze({"recordPath":"Canon/evidence/2026-11-12-bsdc-v11-manifest-continuity.json","recordSha256":"92fe69f99bbda13a9971d841cc391207d9e7944ccc516a68d9cc48b7a9151160","baseSha":"df2214265e577ef653c35fa18a38c717ffe8905e","manifestPath":"Canon/registries/governance-manifest-v2.json","previousManifestSha256":"953aa8ff82c12fca85d22d04de865e1969a5e4548465766b259db0bd3ce56587","manifestSha256":"7f5498afa10f3edaf0b364ca7bf4576de5dc8100e61bc4fc2773c845b771e2a4","previousHelperSha256":"034abe33e17cd8a6247a43f14a62eba3437831bb1f0d59d851e5efc45a7abb86","helperPath":"apps/architecture-lab/market-calendar-source.mjs","sourcePaths":["AGENTS.md","Canon/registries/governance-manifest-v2.json","Canon/v1.1-business-solution-design-and-canonization-canon.md","docs/agent-instructions/bsdc-launcher-v1.1.md"],"testPath":"scripts/governance/platform-source-hub-foundation.test.mjs","testSha256":"dadd4f9fcc5be03afee02ae51038efa48b07b3f9b2b62e9476a7b288c1d42d77","previousTestSha256":"189e3ee14a2e9c3fe52d53fd3404e8fca1e1ca82f120ab6ac24909b9cef09acb"})

// A manifest successor is admitted only by an exact record already present in
// authority main. PR-local edits to the record cannot authorize themselves.
// The historical BSDC source and Calendar receipts remain immutable.
const MANIFEST_SUCCESSOR_LEDGER='Canon/registries/governance-manifest-successors-v1.json'
const TRUSTED_MANIFEST_AUTHORITY='refs/remotes/origin/main'
function approvedManifestSuccessor(current,historical,cfg,receipt,actual){
 const authorityBytes=Buffer.from(historical(TRUSTED_MANIFEST_AUTHORITY,MANIFEST_SUCCESSOR_LEDGER))
 const trustedMainManifest=Buffer.from(historical(TRUSTED_MANIFEST_AUTHORITY,cfg.manifestPath))
 const ledger=JSON.parse(authorityBytes.toString('utf8'))
 assert.deepEqual(Object.keys(ledger).sort(),['schemaVersion','repository','manifestPath','successors'].sort())
 assert.equal(ledger.schemaVersion,'1.0')
 assert.equal(ledger.repository,'profitia/SG-dev')
 assert.equal(ledger.manifestPath,cfg.manifestPath)
 assert(Array.isArray(ledger.successors) && ledger.successors.length>0 && ledger.successors.length<=100)
 const unique=new Set(ledger.successors.map(x=>x.manifestSha256))
 assert.equal(unique.size,ledger.successors.length,'duplicate manifest successor grant')
 const selected=ledger.successors.filter(x=>x.manifestSha256===actual)
 assert.equal(selected.length,1,'unapproved governance manifest successor')
 const grant=selected[0]
 assert.deepEqual(Object.keys(grant).sort(),[
  'id','status','scope','approvalRef','sourceSha','previousSourceSha',
  'previousManifestSha256','manifestSha256','manifestVersion',
  'appendedDocuments','documentDigests'
 ].sort())
 assert.match(grant.id,/^[A-Z][A-Z0-9-]{4,100}$/)
 assert.equal(grant.status,'ACTIVE')
 assert.equal(grant.scope,'APPEND_ONLY_CANON_DOCUMENTATION')
 assert.match(grant.approvalRef,/^https:\/\/github\.com\/profitia\/SG-dev\/pull\/[0-9]+$/)
 for(const sha of [grant.sourceSha,grant.previousSourceSha])assert.match(sha,/^[a-f0-9]{40}$/)
 for(const sha of [grant.manifestSha256,grant.previousManifestSha256])assert.match(sha,/^[a-f0-9]{64}$/)
 assert(grant.previousManifestSha256===hash(trustedMainManifest) ||
  grant.manifestSha256===hash(trustedMainManifest),
 'manifest successor is not based on current authority main')
 const previous=Buffer.from(historical(grant.previousSourceSha,cfg.manifestPath))
 const successor=Buffer.from(historical(grant.sourceSha,cfg.manifestPath))
 assert.equal(hash(previous),grant.previousManifestSha256,'immutable predecessor manifest')
 assert.equal(hash(successor),grant.manifestSha256,'immutable reviewed successor manifest')
 const before=JSON.parse(previous.toString('utf8')),after=JSON.parse(successor.toString('utf8'))
 const {manifestVersion:oldVersion,documents:oldDocs,...oldMeta}=before
 const {manifestVersion:newVersion,documents:newDocs,...newMeta}=after
 assert.deepEqual(newMeta,oldMeta,'manifest successor cannot alter governance metadata')
 assert.equal(newVersion,grant.manifestVersion)
 assert.notEqual(newVersion,oldVersion,'manifest successor must advance version')
 assert(Array.isArray(oldDocs) && Array.isArray(newDocs) && Array.isArray(grant.appendedDocuments))
 assert(grant.appendedDocuments.length>=1 && grant.appendedDocuments.length<=20)
 assert.deepEqual(newDocs.slice(0,oldDocs.length),oldDocs,'existing manifest entries are immutable')
 assert.deepEqual(newDocs.slice(oldDocs.length),grant.appendedDocuments,'only owner-admitted documents may append')
 const paths=grant.appendedDocuments.map(d=>d.path)
 assert.equal(new Set(paths).size,paths.length,'duplicate successor document path')
 assert.deepEqual(Object.keys(grant.documentDigests).sort(),[...paths].sort())
 for(const p of paths){
  assert.match(p,/^(?:Canon|docs\/agent-instructions)\/[A-Za-z0-9._/-]+$/)
  assert(!p.includes('..') && !p.includes('//'),'unsafe document path')
  const expected=grant.documentDigests[p]
  assert.match(expected,/^[a-f0-9]{64}$/)
  assert.equal(hash(historical(grant.sourceSha,p)),expected,'immutable approved document '+p)
  assert.equal(hash(current(p)),expected,'current approved document '+p)
 }
 // Confirm original BSDC acceptance against its immutable reviewed source,
 // not a mutable current manifest. Then use the same unmodified history graph.
 const bsdcManifest=Buffer.from(historical(receipt.approvedDocumentationSourceSha,cfg.manifestPath))
 assert.equal(hash(bsdcManifest),cfg.manifestSha256,'immutable BSDC successor')
 verifyPaths(p=>p===cfg.manifestPath?bsdcManifest:current(p),receipt.sourceDigests,cfg.sourcePaths)
}

export function bsdcManifestContinuityCurrent(current,historical){
 const cfg=BSDC_MANIFEST_CONTINUITY,bytes=readOptional(current,cfg.recordPath)
 if(bytes===null)return current
 assert.equal(hash(bytes),cfg.recordSha256,'immutable BSDC manifest continuity evidence')
 const a=JSON.parse(bytes)
 assert.equal(a.scope,'BSDC_V11_DOCUMENTATION_MANIFEST_CONTINUITY')
 assert.equal(a.previousSourceSha,cfg.baseSha)
 assert.equal(a.priorReceiptsChanged,false)
 assert.equal(a.productRuntimeChanged,false)
 assert.equal(a.accessOrDeploymentAuthorized,false)
 const previous=Buffer.from(historical(cfg.baseSha,cfg.manifestPath))
 const previousHelper=Buffer.from(historical(cfg.baseSha,cfg.helperPath))
 const previousTest=Buffer.from(historical(cfg.baseSha,cfg.testPath))
 assert.equal(hash(current(cfg.testPath)),cfg.testSha256,'exact BSDC continuity regression')
 assert.equal(hash(previousTest),cfg.previousTestSha256,'immutable pre-BSDC regression')
 assert.equal(hash(previous),cfg.previousManifestSha256,'immutable pre-BSDC manifest')
 assert.equal(hash(previousHelper),cfg.previousHelperSha256,'immutable pre-BSDC Calendar helper')
 const actual=hash(current(cfg.manifestPath))
 if(actual===cfg.manifestSha256)verifyPaths(current,a.sourceDigests,cfg.sourcePaths)
 else if(actual!==cfg.previousManifestSha256)approvedManifestSuccessor(current,historical,cfg,a,actual)
 return p=>{
  if(p===cfg.recordPath)throw Object.assign(Error('BSDC successor absent from predecessor'),{code:'ENOENT'})
  if(p===cfg.manifestPath)return Buffer.from(previous)
  if(p===cfg.helperPath)return Buffer.from(previousHelper)
  if(p===cfg.testPath)return Buffer.from(previousTest)
  return current(p)
 }
}

export function marketCalendarSourcePredecessor(current,historical){
 current=bsdcManifestContinuityCurrent(current,historical)
 current=calendarTestCompatibilityCurrent(current,historical)
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
