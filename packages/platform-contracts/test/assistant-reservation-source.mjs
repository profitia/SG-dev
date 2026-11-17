// Test/build-only closed source continuation. Never imported by a runtime.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
export const RESERVATION_RECORD="apps/architecture-lab/assistant-reservation-source.json"
export const RESERVATION_BASE="80875d8f0e9451cd9afd34e8baf2a8f6059bc064"
export const RESERVATION_PATHS=Object.freeze([
 "apps/architecture-lab/test/market-calendar-source.test.mjs",
 "apps/architecture-lab/test/sdk-compatibility.test.mjs",
 "apps/package-limits/migrations/006-assistant-reservation-diagnostics.sql",
 "apps/package-limits/test/database.test.mjs",
 "apps/sg-runtime/lib/assistant/conversation.ts",
 "apps/sg-runtime/lib/assistant/model.ts",
 "apps/sg-runtime/lib/assistant/runtime.ts",
 "apps/sg-runtime/tests/assistant-conversation-handler.test.ts",
 "apps/sg-runtime/tests/assistant-ecr-week-integrity.test.mjs",
 "apps/sg-runtime/tests/assistant-model.test.ts",
 "apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs",
 "apps/sg-runtime/tests/market-calendar-integrity.test.mjs",
 "apps/sg-runtime/tests/operation-context.test.mjs",
 "apps/sg-runtime/tests/pci-smart-integrity.test.mjs",
 "apps/sg-runtime/tests/porr-demo-middleware.test.ts",
 "apps/sg-runtime/tests/private-host.integration.test.mjs",
 "apps/sg-runtime/tests/procurement-insights-completion.test.mjs",
 "apps/sg-runtime/tests/procurement-insights-live-acceptance-source.test.mjs",
 "apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs",
 "apps/srm/scripts/xray-performance-adoption.test.mjs",
 "apps/srm/src/server/root-atomic-claim-adoption.test.ts",
 "apps/srm/scripts/diagnostic-telemetry-adoption.test.mjs",
 "apps/srm/scripts/native-execution-adoption.test.mjs",
 "apps/srm/scripts/operation-context.test.mjs",
 "apps/srm/scripts/private-host.integration.test.mjs",
 "apps/srm/scripts/request-quota-adoption.test.mjs",
 "apps/srm/scripts/supplier-location-admission.integration.test.mjs",
 "packages/platform-contracts/current-fresh-report/test/current-fresh-report.test.mjs",
 "packages/platform-contracts/readonly-miss-report/test/readonly-miss-report.test.mjs",
 "packages/platform-contracts/src/assistant-usage.d.mts",
 "packages/platform-contracts/src/assistant-usage.mjs",
 "packages/platform-contracts/test/assistant-reservation-source.mjs",
 "packages/platform-contracts/test/assistant-reservation-source.test.mjs",
 "packages/platform-contracts/test/assistant-usage.test.mjs",
 "packages/platform-contracts/test/private-operation-host.test.mjs",
 "packages/platform-contracts/test/recurring-consent-transport.test.mjs"
])
export const RESERVATION_SG2_PATHS=Object.freeze([
 "apps/sg-runtime/lib/assistant/conversation.ts",
 "apps/sg-runtime/lib/assistant/model.ts",
 "apps/sg-runtime/lib/assistant/runtime.ts",
 "apps/sg-runtime/tests/assistant-conversation-handler.test.ts",
 "apps/sg-runtime/tests/assistant-ecr-week-integrity.test.mjs",
 "apps/sg-runtime/tests/assistant-model.test.ts",
 "apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs",
 "apps/sg-runtime/tests/market-calendar-integrity.test.mjs",
 "apps/sg-runtime/tests/operation-context.test.mjs",
 "apps/sg-runtime/tests/pci-smart-integrity.test.mjs",
 "apps/sg-runtime/tests/porr-demo-middleware.test.ts",
 "apps/sg-runtime/tests/private-host.integration.test.mjs",
 "apps/sg-runtime/tests/procurement-insights-completion.test.mjs",
 "apps/sg-runtime/tests/procurement-insights-live-acceptance-source.test.mjs",
 "apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs"
])
export const RESERVATION_RECEIPTS=Object.freeze([
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
export const RESERVATION_DERIVED="apps/architecture-lab/private-recurring-source.mjs"
const additions=new Set([RESERVATION_RECORD,"packages/platform-contracts/test/assistant-reservation-source.mjs","packages/platform-contracts/test/assistant-reservation-source.test.mjs","apps/package-limits/migrations/006-assistant-reservation-diagnostics.sql"])
const hash=b=>createHash('sha256').update(b).digest('hex')
const absent=e=>e?.code==='ENOENT'||e?.status===128&&["' does not exist in ","' exists on disk, but not in "].some(s=>String(e?.stderr??e?.message??'').includes("'"+RESERVATION_RECORD+s))
export function reservationArchitectureSource(before,pin){
 const marker="import assert from 'node:assert/strict'",entry='export function recurringSourcePredecessor(current,historical){'
 assert.match(pin,/^[a-f0-9]{64}$/);assert.equal(before.split(marker).length,2);assert.equal(before.split(entry).length,2)
 return before.replace(marker,"import {assistantReservationPredecessor} from '../../packages/platform-contracts/test/assistant-reservation-source.mjs'\nexport const ASSISTANT_RESERVATION_SOURCE_SHA='"+pin+"'\n"+marker)
  .replace(entry,entry+"\n const reservation=assistantReservationPredecessor(current,historical,ASSISTANT_RESERVATION_SOURCE_SHA)\n if(reservation){const accepted=recurringSourcePredecessor(reservation.previousBytes,historical);assert(accepted,'all accepted predecessors retained');return {...accepted,reservation}}")
}
export function assistantReservationPredecessor(current,historical,expectedDigest){
 let bytes;try{bytes=current(RESERVATION_RECORD)}catch(e){if(absent(e))return null;throw e}
 assert.match(expectedDigest??'',/^[a-f0-9]{64}$/);assert.equal(hash(bytes),expectedDigest,'exact reviewed reservation source record')
 const a=JSON.parse(bytes)
 assert.deepEqual(Object.keys(a).sort(),['schemaVersion','scope','taskIds','targetEnvironment','previousSourceSha','sourceDigests','preservedReceipts','model','outputTokens','reservationNanoUsd','authorisationChanged','sql006Installed','pilotChanged','unknownReleased','providerAcquisitionAdded','deploymentPerformed','sdkDigests','optionalPackageDigests'].sort())
 assert.equal(a.schemaVersion,'1.0.0');assert.equal(a.scope,'EXACT_ASSISTANT_TOKEN_RESERVATION_SOURCE');assert.equal(a.previousSourceSha,RESERVATION_BASE)
 assert.deepEqual(a.taskIds,{ARCHITECTURE:'ARCH-ACG-EXACT-TOKEN-RESERVATION-CHATGPT-CONT-20261113',SG2:'SG2-ACG-EXACT-TOKEN-RESERVATION-CHATGPT-CONT-20261113',SRM:'SRM-ACG-M1M2-COMPLETION-20261117'})
 assert.equal(a.targetEnvironment,'development');assert.equal(a.model,'gpt-5.6-luna');assert.equal(a.outputTokens,2048)
 assert.deepEqual(a.reservationNanoUsd,{input:500,output:1200})
 for(const flag of ['authorisationChanged','sql006Installed','pilotChanged','unknownReleased','providerAcquisitionAdded','deploymentPerformed'])assert.equal(a[flag],false,flag)
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),[...RESERVATION_PATHS].sort(),'closed reservation source inventory')
 for(const p of RESERVATION_PATHS){assert.match(a.sourceDigests[p],/^[a-f0-9]{64}$/);assert.equal(hash(current(p)),a.sourceDigests[p],'exact current reservation source '+p)}
 assert.deepEqual(Object.keys(a.preservedReceipts).sort(),[...RESERVATION_RECEIPTS].sort())
 for(const p of RESERVATION_RECEIPTS){assert.equal(hash(current(p)),a.preservedReceipts[p],'immutable receipt '+p);assert.equal(hash(historical(RESERVATION_BASE,p)),a.preservedReceipts[p],'accepted receipt '+p)}
 assert.equal(String(current(RESERVATION_DERIVED)),reservationArchitectureSource(String(historical(RESERVATION_BASE,RESERVATION_DERIVED)),expectedDigest),'only the closed reservation source continuation may extend the guard')
 assert.deepEqual(Object.keys(a.sdkDigests).sort(),["accessSchemaDigest", "accessStoreSourceDigest", "additionalRequestSchemaDigest", "apiPathTransportSchemaDigest", "clerkConfigurationSourceDigest", "currentHumanReadSourceDigest", "delegatedJobSchemaDigest", "delegatedJobSourceDigest", "delegatedPrivatePhasesSchemaDigest", "diagnosticPhaseSourceDigest", "externalCallSchemaDigest", "externalCallSourceDigest", "externalRequestSchemaDigest", "identitySourceDigest", "marketSymbolTransportSchemaDigest", "modelExecutionSchemaDigest", "moduleAuditSchemaDigest", "moduleSchemaDigest", "moduleScopeSourceDigest", "nativeExternalTransportSchemaDigest", "operationSourceDigest", "peerOperationSourceDigest", "platformIngestionSchemaDigest", "platformIngestionSourceDigest", "privateOperationHostSourceDigest", "profileSchemaDigest", "publicIdentityRequestSourceDigest", "publicWebTransportSchemaDigest", "renewalSchemaDigest", "reportAdmissionSchemaDigest", "reportAdmissionSourceDigest", "requestContinuationSchemaDigest", "requestContinuationSourceDigest", "requestInspectionSchemaDigest", "requestInspectionSourceDigest", "requestLedgerSourceDigest", "requestOperationsSourceDigest", "requestQuotaSchemaDigest", "requestReservationSchemaDigest", "requestWorkSchemaDigest", "requestWorkSourceDigest", "serviceReadSchemaDigest", "supplierDelegationSchemaDigest", "supplierLocationAdmissionSchemaDigest", "supplierLocationSchemaDigest", "unmeteredSourceSchemaDigest"])
 assert.deepEqual(Object.keys(a.optionalPackageDigests).sort(),["currentFreshReportSourceDigest", "readonlyMissReportSourceDigest", "rootAtomicClaimSourceDigest"])
 for(const value of [...Object.values(a.sdkDigests),...Object.values(a.optionalPackageDigests)])assert.match(value,/^[a-f0-9]{64}$/)
 const mapped=new Set([...RESERVATION_PATHS,RESERVATION_DERIVED]),cache=new Map()
 return {manifest:a,previousBytes:p=>{
  if(additions.has(p))throw Object.assign(Error('Reservation source absent from predecessor'),{code:'ENOENT'})
  if(!mapped.has(p))return current(p)
  if(!cache.has(p))cache.set(p,Buffer.from(historical(RESERVATION_BASE,p)))
  return Buffer.from(cache.get(p))
 }}
}
