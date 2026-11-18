// Test/build source continuation only. Never grants runtime or deployment authority.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
export const BENCHMARK_BASE="53691e907e4cc9b7fbf683c91bbebf41299e9ccc"
export const BENCHMARK_RECORD="apps/architecture-lab/benchmark-unmetered-source.json"
export const BENCHMARK_DERIVED="packages/platform-contracts/test/assistant-reservation-source.mjs"
export const BENCHMARK_PATHS=Object.freeze([
 "packages/platform-contracts/README.md",
 "packages/platform-contracts/migrations/access/034-unmetered-benchmark-requests.sql",
 "packages/platform-contracts/migrations/access/035-source-technical-continuity.sql",
 "packages/platform-contracts/src/external-call.mjs",
 "packages/platform-contracts/src/operation-context.d.mts",
 "packages/platform-contracts/src/operation-context.mjs",
 "packages/platform-contracts/src/platform-ingestion.d.mts",
 "packages/platform-contracts/src/platform-ingestion.mjs",
 "packages/platform-contracts/src/private-operation-host.d.mts",
 "packages/platform-contracts/src/private-operation-host.mjs",
 "packages/platform-contracts/src/request-ledger.d.mts",
 "packages/platform-contracts/src/request-ledger.mjs",
 "packages/platform-contracts/test/source-technical-continuity.integration.test.mjs",
 "packages/platform-contracts/test/unmetered-benchmark-requests.integration.test.mjs",
 "packages/platform-contracts/test/benchmark-unmetered-source.mjs",
 "packages/platform-contracts/test/benchmark-unmetered-source.test.mjs",
 "packages/platform-contracts/test/assistant-reservation-source.test.mjs",
 "apps/architecture-lab/test/sdk-compatibility.test.mjs",
 "packages/platform-contracts/current-fresh-report/test/current-fresh-report.test.mjs",
 "packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs",
 "packages/platform-contracts/test/private-operation-host.test.mjs"
])
export const BENCHMARK_RECEIPTS=Object.freeze([
 "apps/architecture-lab/assistant-m1-sdk-compatibility.json",
 "apps/architecture-lab/insights-report-source-compatibility.json",
 "apps/architecture-lab/market-calendar-test-compatibility.json",
 "apps/architecture-lab/private-recurring-source-adoption.json",
 "apps/architecture-lab/private-recurring-source.json",
 "apps/architecture-lab/sdk-1.33-compatibility.json",
 "apps/architecture-lab/sdk-1.34-compatibility.json",
 "apps/sg-runtime/adp-integration.json",
 "apps/sg-runtime/assistant-context-integration.json",
 "apps/sg-runtime/assistant-ecr-integration.json",
 "apps/sg-runtime/assistant-ecr-precision-integration.json",
 "apps/sg-runtime/assistant-ecr-week-integration.json",
 "apps/sg-runtime/assistant-markdown-integration.json",
 "apps/sg-runtime/assistant-notifications-integration.json",
 "apps/sg-runtime/assistant-send-arrow-integration.json",
 "apps/sg-runtime/development-integration.json",
 "apps/sg-runtime/market-calendar-integration.json",
 "apps/sg-runtime/oil-renderer-integration.json",
 "apps/sg-runtime/operation-integration.json",
 "apps/sg-runtime/private-recurring-source-adoption.json",
 "apps/sg-runtime/procurement-insights-completion-integration.json",
 "apps/sg-runtime/procurement-insights-integration.json",
 "apps/sg-runtime/procurement-insights-shell-integration.json",
 "apps/sg-runtime/registration-stage-i-integration.json",
 "apps/sg-runtime/scripts/denial-audit/adoption.json",
 "apps/sg-runtime/xray-appshell-integration.json",
 "apps/srm/private-recurring-source-adoption.json"
])
const hash=b=>createHash('sha256').update(b).digest('hex')
const absent=e=>e?.code==='ENOENT'||e?.status===128&&["' does not exist in ","' exists on disk, but not in "].some(s=>String(e?.stderr??e?.message??'').includes("'"+BENCHMARK_RECORD+s))
export function benchmarkAssistantSource(before,pin){
 assert.match(pin,/^[a-f0-9]{64}$/)
 const entry='export function assistantReservationPredecessor(current,historical,expectedDigest){'
 assert.equal(before.split(entry).length,2)
 return "import {benchmarkUnmeteredPredecessor} from './benchmark-unmetered-source.mjs'\nexport const BENCHMARK_UNMETERED_SOURCE_SHA='"+pin+"'\n"+before.replace(entry,entry+"\n const benchmark=benchmarkUnmeteredPredecessor(current,historical,BENCHMARK_UNMETERED_SOURCE_SHA)\n if(benchmark){const accepted=assistantReservationPredecessor(benchmark.previousBytes,historical,expectedDigest);return accepted?{...accepted,benchmark,acceptedManifest:accepted.manifest,manifest:{...accepted.manifest,...benchmark.manifest,sourceDigests:{...accepted.manifest.sourceDigests,...benchmark.manifest.sourceDigests,['packages/platform-contracts/test/assistant-reservation-source.mjs']:hash(current('packages/platform-contracts/test/assistant-reservation-source.mjs'))}}}:null}")
}
export function benchmarkUnmeteredPredecessor(current,historical,pin){
 let bytes;try{bytes=current(BENCHMARK_RECORD)}catch(e){if(absent(e))return null;throw e}
 assert.match(pin??'',/^[a-f0-9]{64}$/);assert.equal(hash(bytes),pin,'exact reviewed benchmark contract source')
 const a=JSON.parse(bytes)
 assert.deepEqual(Object.keys(a).sort(),['schemaVersion','scope','taskId','targetEnvironment','previousSourceSha','sourceDigests','predecessorDigests','preservedReceipts','sdkDigests','optionalPackageDigests'].sort())
 assert.equal(a.schemaVersion,'1.0.0');assert.equal(a.scope,'EXACT_BENCHMARK_UNMETERED_PRODUCER_SOURCE');assert.equal(a.taskId,'ARCH-FINDER-UNMETERED-CONTRACT-20261118');assert.equal(a.targetEnvironment,'development');assert.equal(a.previousSourceSha,BENCHMARK_BASE)
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),[...BENCHMARK_PATHS].sort())
 for(const p of BENCHMARK_PATHS){assert.match(a.sourceDigests[p],/^[a-f0-9]{64}$/);assert.equal(hash(current(p)),a.sourceDigests[p],'exact current benchmark source '+p)}
 assert.equal(String(current(BENCHMARK_DERIVED)),benchmarkAssistantSource(String(historical(BENCHMARK_BASE,BENCHMARK_DERIVED)),pin),'only the exact closed continuation may extend the accepted guard')
 const oldPaths=BENCHMARK_PATHS.filter(p=>p in a.predecessorDigests)
 assert.deepEqual(Object.keys(a.predecessorDigests).sort(),["apps/architecture-lab/test/sdk-compatibility.test.mjs","packages/platform-contracts/README.md","packages/platform-contracts/current-fresh-report/test/current-fresh-report.test.mjs","packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs","packages/platform-contracts/src/external-call.mjs","packages/platform-contracts/src/operation-context.d.mts","packages/platform-contracts/src/operation-context.mjs","packages/platform-contracts/src/platform-ingestion.d.mts","packages/platform-contracts/src/platform-ingestion.mjs","packages/platform-contracts/src/private-operation-host.d.mts","packages/platform-contracts/src/private-operation-host.mjs","packages/platform-contracts/src/request-ledger.d.mts","packages/platform-contracts/src/request-ledger.mjs","packages/platform-contracts/test/assistant-reservation-source.test.mjs","packages/platform-contracts/test/private-operation-host.test.mjs"])
 for(const p of oldPaths){assert.match(a.predecessorDigests[p],/^[a-f0-9]{64}$/);assert.equal(hash(historical(BENCHMARK_BASE,p)),a.predecessorDigests[p],'exact benchmark predecessor '+p)}
 assert.deepEqual(Object.keys(a.preservedReceipts).sort(),[...BENCHMARK_RECEIPTS].sort())
 for(const p of BENCHMARK_RECEIPTS){assert.equal(hash(current(p)),a.preservedReceipts[p],'immutable receipt '+p);assert.equal(hash(historical(BENCHMARK_BASE,p)),a.preservedReceipts[p],'accepted receipt '+p)}
 assert.deepEqual(Object.keys(a.sdkDigests).sort(),["accessSchemaDigest","accessStoreSourceDigest","additionalRequestSchemaDigest","apiPathTransportSchemaDigest","clerkConfigurationSourceDigest","currentHumanReadSourceDigest","delegatedJobSchemaDigest","delegatedJobSourceDigest","delegatedPrivatePhasesSchemaDigest","diagnosticPhaseSourceDigest","externalCallSchemaDigest","externalCallSourceDigest","externalRequestSchemaDigest","identitySourceDigest","marketSymbolTransportSchemaDigest","modelExecutionSchemaDigest","moduleAuditSchemaDigest","moduleSchemaDigest","moduleScopeSourceDigest","nativeExternalTransportSchemaDigest","operationSourceDigest","peerOperationSourceDigest","platformIngestionSchemaDigest","platformIngestionSourceDigest","privateOperationHostSourceDigest","profileSchemaDigest","publicIdentityRequestSourceDigest","publicWebTransportSchemaDigest","renewalSchemaDigest","reportAdmissionSchemaDigest","reportAdmissionSourceDigest","requestContinuationSchemaDigest","requestContinuationSourceDigest","requestInspectionSchemaDigest","requestInspectionSourceDigest","requestLedgerSourceDigest","requestOperationsSourceDigest","requestQuotaSchemaDigest","requestReservationSchemaDigest","requestWorkSchemaDigest","requestWorkSourceDigest","serviceReadSchemaDigest","supplierDelegationSchemaDigest","supplierLocationAdmissionSchemaDigest","supplierLocationSchemaDigest","unmeteredSourceSchemaDigest"])
 assert.deepEqual(Object.keys(a.optionalPackageDigests).sort(),["currentFreshReportSourceDigest","readonlyMissReportSourceDigest","rootAtomicClaimSourceDigest"])
 for(const value of [...Object.values(a.sdkDigests),...Object.values(a.optionalPackageDigests)])assert.match(value,/^[a-f0-9]{64}$/)
 const mapped=new Set(BENCHMARK_PATHS)
 return {manifest:a,previousBytes:p=>{
  if(p===BENCHMARK_RECORD||mapped.has(p)&&!(p in a.predecessorDigests))throw Object.assign(Error('Benchmark source absent from predecessor'),{code:'ENOENT'})
  if(p===BENCHMARK_DERIVED||mapped.has(p))return Buffer.from(historical(BENCHMARK_BASE,p))
  return current(p)
 }}
}
