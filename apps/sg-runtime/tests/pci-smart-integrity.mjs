/** Additive continuation: exact current bytes AND immutable prior evidence, never digest replacement. */
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
export function assertPciSmartIntegrity(receipt,current,historical){
 if(Object.hasOwn(receipt,'pciSmartResultingMainScopeCompatibility')){
  const a=receipt.pciSmartResultingMainScopeCompatibility
  assert.equal(a.taskId,'SG2-PCI-SMART-PREPARATION-DEVELOPMENT-RELEASE-20261031')
  assert.equal(a.scope,'EXACT_SOURCE_COVERAGE_ON_CANDIDATE_AND_RESULTING_MAIN')
  assert.equal(a.previousReceiptSourceSha,'10efd606f78cb08ae4fccde84b8c2e958bb54d9d')
  const bytes=historical(a.previousReceiptSourceSha,'apps/sg-runtime/operation-integration.json'),prior=JSON.parse(bytes)
  assert.equal(digest(bytes),a.previousReceiptSha256)
  const {pciSmartResultingMainScopeCompatibility,...preserved}=receipt
  assert.deepEqual(preserved,prior,'all accepted receipts and historical digests stay immutable')
  assert.deepEqual(Object.keys(a.sourceDigests).sort(),["apps/sg-runtime/tests/adp-appshell-consumer.test.tsx","apps/sg-runtime/tests/category-operation.test.ts","apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs","apps/sg-runtime/tests/identity-runtime.test.ts","apps/sg-runtime/tests/integrated-buyer-journey-package.test.mjs","apps/sg-runtime/tests/native-sql-roundtrips.test.mjs","apps/sg-runtime/tests/operation-context.test.mjs","apps/sg-runtime/tests/pci-smart-integrity.mjs","apps/sg-runtime/tests/pci-smart-integrity.test.mjs","apps/sg-runtime/tests/porr-demo-middleware.test.ts","apps/sg-runtime/tests/self-service-account.test.ts","apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs","apps/sg-runtime/tests/xray-gateway.test.ts"])
  assert.deepEqual(a.applicationSourceDigests,Object.fromEntries(Object.entries(a.sourceDigests).map(([f,d])=>[f.slice(16),d])))
  for(const[file,hash]of Object.entries(a.sourceDigests))assert.equal(digest(current(file)),hash,'exact resulting-main integrity source '+file)
  for(const flag of ['productChanged','cciCoreChanged','indexedPriceChanged','authorizationChanged','srmRuntimeChanged','sqlChanged','deploymentPerformed'])assert.equal(a[flag],false,flag)
  return assertPciSmartIntegrity(prior,file=>Object.hasOwn(a.sourceDigests,file)?historical(a.previousReceiptSourceSha,file):current(file),historical)
 }
 const a=receipt.pciSmartPreparationCompatibility
 assert(a,'smart source receipt required')
 assert.equal(a.taskId,'SG2-PCI-SMART-PREPARATION-FULL-IMPLEMENTATION-20261030')
 assert.equal(a.requestVersion,'sg2.price-change-index.smart/1.0.0');assert.equal(a.preparationVersion,'PCI_SMART_PREPARATION_V1')
 assert.equal(a.proxyOutput,'MARKET_INDEX_ONLY_NO_PURCHASE_PRICE_PROJECTION')
 const bytes=historical(a.previousReceiptSourceSha,'apps/sg-runtime/operation-integration.json'),prior=JSON.parse(bytes)
 assert.equal(digest(bytes),a.previousReceiptSha256)
 const {pciSmartPreparationCompatibility,...preserved}=receipt
 assert.deepEqual(preserved,prior,'all original entries and digests remain immutable')
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),a.changedSourcePaths)
 assert.deepEqual(a.applicationSourceDigests,Object.fromEntries(Object.entries(a.sourceDigests).filter(([f])=>f.startsWith('apps/sg-runtime/')).map(([f,d])=>[f.slice(16),d])))
 for(const[file,hash]of Object.entries(a.sourceDigests)){
  assert(!file.startsWith('/')&&!file.split('/').includes('..')&&(file.startsWith('apps/sg-runtime/')||file.startsWith('packages/sg2-price-change-index-ui/')||file.startsWith('apps/sg2-price-change-index-demo/test/')||file==='.github/workflows/sg2-price-change-index-ci.yml'))
  assert.match(hash,/^[a-f0-9]{64}$/);assert.equal(digest(current(file)),hash,'exact smart source '+file)
 }
 assert.deepEqual(a.preservedEnginePaths,prior.bqlPciFirstSourceCompatibility.preservedEnginePaths.filter(file=>file!=='apps/sg-runtime/lib/cost-analysis/price-change-index-operation.ts'))
 for(const file of a.preservedEnginePaths)assert.equal(digest(current(file)),digest(historical(a.previousReceiptSourceSha,file)),'unchanged engine '+file)
 for(const flag of ['cciCoreChanged','indexedPriceChanged','sourceHistoryChanged','authorizationContractChanged','schemaChanged','newPaidProviderCalls','srmRuntimeChanged','productDeploymentPerformed'])assert.equal(a[flag],false,flag)
 return{prior,previousBytes:file=>Object.hasOwn(a.sourceDigests,file)?historical(a.previousReceiptSourceSha,file):current(file)}
}
