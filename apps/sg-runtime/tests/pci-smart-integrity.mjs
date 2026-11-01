/** Additive continuation: exact current bytes AND immutable prior evidence, never digest replacement. */
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
const PCI_INPUT_CORRECTIVE_FILES=["apps/sg-runtime/components/price-change-index/price-change-index-controller.ts","apps/sg-runtime/components/price-change-index/price-change-index-layer.tsx","apps/sg-runtime/components/price-change-index/price-change-index-request.ts","apps/sg-runtime/docs/pci-smart-preparation.md","apps/sg-runtime/lib/cost-analysis/pci-smart-preparation-contracts.ts","apps/sg-runtime/lib/cost-analysis/price-change-index-operation.ts","apps/sg-runtime/tests/adp-appshell-consumer.test.tsx","apps/sg-runtime/tests/category-operation.test.ts","apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs","apps/sg-runtime/tests/identity-runtime.test.ts","apps/sg-runtime/tests/integrated-buyer-journey-package.test.mjs","apps/sg-runtime/tests/native-sql-roundtrips.test.mjs","apps/sg-runtime/tests/operation-context.test.mjs","apps/sg-runtime/tests/pci-smart-browser.mjs","apps/sg-runtime/tests/pci-smart-integrity.mjs","apps/sg-runtime/tests/pci-smart-integrity.test.mjs","apps/sg-runtime/tests/pci-smart-operation.test.ts","apps/sg-runtime/tests/pci-smart-preview.mjs","apps/sg-runtime/tests/pci-smart-ui.test.tsx","apps/sg-runtime/tests/porr-demo-middleware.test.ts","apps/sg-runtime/tests/self-service-account.test.ts","apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs","apps/sg-runtime/tests/xray-full-ui-adoption.test.ts","apps/sg-runtime/tests/xray-gateway.test.ts"]
const XRAY_STYLE_FILES=["apps/sg-runtime/components/benchmark-finder/visual/magicpath/benchmark-finder.css","apps/sg-runtime/components/benchmark-finder/visual/magicpath/canon-dropdown.css","apps/sg-runtime/components/benchmark-finder/visual/magicpath/canon-shared.css","apps/sg-runtime/components/benchmark-finder/visual/magicpath/canon-theme.css","apps/sg-runtime/components/benchmark-finder/visual/magicpath/spacing-bindings.css","apps/sg-runtime/components/benchmark-finder/visual/magicpath/srm-interaction-motion.css","apps/sg-runtime/tests/adp-appshell-consumer.test.tsx","apps/sg-runtime/tests/category-operation.test.ts","apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs","apps/sg-runtime/tests/identity-runtime.test.ts","apps/sg-runtime/tests/integrated-buyer-journey-package.test.mjs","apps/sg-runtime/tests/native-sql-roundtrips.test.mjs","apps/sg-runtime/tests/operation-context.test.mjs","apps/sg-runtime/tests/pci-smart-integrity.mjs","apps/sg-runtime/tests/pci-smart-integrity.test.mjs","apps/sg-runtime/tests/porr-demo-middleware.test.ts","apps/sg-runtime/tests/self-service-account.test.ts","apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs","apps/sg-runtime/tests/xray-gateway.test.ts","apps/sg-runtime/tests/xray-style-isolation.test.ts"]

const SENTRY_OBSERVABILITY_FILES=["apps/sg-runtime/app/global-error.tsx","apps/sg-runtime/instrumentation.ts","apps/sg-runtime/lib/observability/config.ts","apps/sg-runtime/lib/observability/sanitize.ts","apps/sg-runtime/lib/observability/server.ts","apps/sg-runtime/next.config.mjs","apps/sg-runtime/package-lock.json","apps/sg-runtime/package.json","apps/sg-runtime/sentry.client.config.ts","apps/sg-runtime/sentry.edge.config.ts","apps/sg-runtime/sentry.server.config.ts","apps/sg-runtime/tests/adp-appshell-consumer.test.tsx","apps/sg-runtime/tests/category-operation.test.ts","apps/sg-runtime/tests/diagnostic-telemetry-adoption.test.mjs","apps/sg-runtime/tests/identity-runtime.test.ts","apps/sg-runtime/tests/integrated-buyer-journey-package.test.mjs","apps/sg-runtime/tests/native-sql-roundtrips.test.mjs","apps/sg-runtime/tests/operation-context.test.mjs","apps/sg-runtime/tests/pci-smart-integrity.mjs","apps/sg-runtime/tests/pci-smart-integrity.test.mjs","apps/sg-runtime/tests/porr-demo-middleware.test.ts","apps/sg-runtime/tests/self-service-account.test.ts","apps/sg-runtime/tests/sentry-observability.test.ts","apps/sg-runtime/tests/xray-fresh-performance-adoption.test.mjs","apps/sg-runtime/tests/xray-gateway.test.ts"]
export function assertSentryObservabilityContinuation(receipt,current,historical){
 const a=receipt.sentryObservabilityCompatibility
 assert.equal(a.taskId,'SG2-SENTRY-INTEGRITY-20261101')
 assert.equal(a.scope,'SCOPED_TECHNICAL_OBSERVABILITY_ONLY')
 assert.equal(a.previousReceiptSourceSha,'7b0ec69b9c5bbc504483c734b09b4f8f242dea8f')
 const bytes=historical(a.previousReceiptSourceSha,'apps/sg-runtime/operation-integration.json'),prior=JSON.parse(bytes)
 assert.equal(digest(bytes),a.previousReceiptSha256)
 const {sentryObservabilityCompatibility,...preserved}=receipt
 assert.deepEqual(preserved,prior,'all earlier accepted receipts and hashes remain immutable')
 assert.deepEqual(a.changedSourcePaths,SENTRY_OBSERVABILITY_FILES)
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),SENTRY_OBSERVABILITY_FILES)
 assert.deepEqual(a.applicationSourceDigests,Object.fromEntries(Object.entries(a.sourceDigests).map(([file,hash])=>[file.slice(16),hash])))
 for(const[file,hash]of Object.entries(a.sourceDigests)){
  assert.match(hash,/^[a-f0-9]{64}$/)
  assert.equal(digest(current(file)),hash,'exact Sentry receiving source '+file)
 }
 for(const flag of ['authorizationChanged','financialEngineChanged','schemaChanged','existingTelemetryChanged','srmRuntimeChanged','privatePinsChanged','ciPolicyChanged','newBusinessProviderCalls','deploymentPerformed'])assert.equal(a[flag],false,flag)
 const script=JSON.parse(current('apps/sg-runtime/package.json')).scripts['test:operation-context']
 assert.match(script,/&& npm run test:observability$/)
 return {prior,previousBytes:file=>Object.hasOwn(a.sourceDigests,file)?historical(a.previousReceiptSourceSha,file):current(file)}
}
export function assertXrayStyleIsolationContinuation(receipt,current,historical){
 const a=receipt.xrayStyleIsolationContinuation
 assert.equal(a.taskId,'SG2-XRAY-STYLE-ACCEPTANCE-CLOSURE-B-20261101-R16')
 assert.equal(a.previousReceiptSourceSha,'b965924a63fafb1a24b84ceb389dfd5e78648f57')
 const bytes=historical(a.previousReceiptSourceSha,'apps/sg-runtime/operation-integration.json'),prior=JSON.parse(bytes)
 assert.equal(digest(bytes),a.previousReceiptSha256)
 const {xrayStyleIsolationContinuation,...preserved}=receipt
 assert.deepEqual(preserved,prior,'every accepted receipt and original digest stays immutable')
 assert.deepEqual(a.changedSourcePaths,XRAY_STYLE_FILES)
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),XRAY_STYLE_FILES)
 assert.deepEqual(a.applicationSourceDigests,Object.fromEntries(Object.entries(a.sourceDigests).map(([file,hash])=>[file.slice(16),hash])))
 for(const[file,hash]of Object.entries(a.sourceDigests)){
  assert.match(hash,/^[a-f0-9]{64}$/)
  assert.equal(digest(current(file)),hash,'exact X-Ray style continuation '+file)
 }
 const script=JSON.parse(current('apps/sg-runtime/package.json')).scripts['test:operation-context']
 assert.match(script,/(?:^|\s)tests\/pci-smart-integrity\.test\.mjs(?:\s|$)/)
 assert.match(current('apps/sg-runtime/tests/pci-smart-integrity.test.mjs').toString(),/^import ['"]\.\/xray-style-isolation\.test\.ts['"]\s*;?$/m,'normal CI must directly run the CSS regression')
 for(const flag of ['publicPackageChanged','srmRuntimeChanged','freshOrReadyChanged','authorizationChanged','financialEngineChanged','schemaChanged','privatePinsChanged','ciPolicyChanged','deploymentPerformed'])assert.equal(a[flag],false,flag)
 return {prior,previousBytes:file=>Object.hasOwn(a.sourceDigests,file)?historical(a.previousReceiptSourceSha,file):current(file)}
}
export function assertPciInputCorrective(receipt,current,historical){
 if(receipt.sentryObservabilityCompatibility){const n=assertSentryObservabilityContinuation(receipt,current,historical);return assertPciInputCorrective(n.prior,n.previousBytes,historical)}
 if(receipt.xrayStyleIsolationContinuation){const n=assertXrayStyleIsolationContinuation(receipt,current,historical);return assertPciInputCorrective(n.prior,n.previousBytes,historical)}
 const a=receipt.pciSmartInputCorrective
 assert.equal(a.taskId,'SG2-PCI-SMART-LIVE-400-CORRECTIVE-20261101')
 assert.equal(a.previousReceiptSourceSha,'4040eaf576c6934ede4f9040e52c5c3f9e8bd9fa')
 assert.equal(a.rootCause,'EMPTY_OPTIONAL_PERIOD_BASIS_SENTINEL')
 const bytes=historical(a.previousReceiptSourceSha,'apps/sg-runtime/operation-integration.json'),prior=JSON.parse(bytes)
 assert.equal(digest(bytes),a.previousReceiptSha256)
 const {pciSmartInputCorrective,...preserved}=receipt
 assert.deepEqual(preserved,prior,'every earlier receipt and original digest stays immutable')
 assert.deepEqual(a.changedSourcePaths,PCI_INPUT_CORRECTIVE_FILES)
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),PCI_INPUT_CORRECTIVE_FILES)
 assert.deepEqual(a.applicationSourceDigests,Object.fromEntries(Object.entries(a.sourceDigests).map(([file,hash])=>[file.slice(16),hash])))
 for(const[file,hash]of Object.entries(a.sourceDigests)){
  assert.match(hash,/^[a-f0-9]{64}$/)
  assert.equal(digest(current(file)),hash,'exact PCI input corrective '+file)
 }
 for(const flag of ['methodologyChanged','cciCoreChanged','indexedPriceChanged','authorizationChanged','srmRuntimeChanged','schemaChanged'])assert.equal(a[flag],false,flag)
 return {prior,previousBytes:file=>Object.hasOwn(a.sourceDigests,file)?historical(a.previousReceiptSourceSha,file):current(file)}
}
export function assertPciSmartIntegrity(receipt,current,historical){
 if(receipt.pciSmartInputCorrective){const n=assertPciInputCorrective(receipt,current,historical);return assertPciSmartIntegrity(n.prior,n.previousBytes,historical)}
 // The later UI candidate binds every changed current host byte, then exposes
 // the exact accepted PCI predecessor to the unchanged PCI integrity checks.
 if(receipt.fullUiParityAdoption){
  const ui=receipt.fullUiParityAdoption,bytes=historical(ui.previousReceiptSourceSha,'apps/sg-runtime/operation-integration.json'),prior=JSON.parse(bytes)
  assert.equal(ui.projectKey,'SG2');assert.equal(ui.taskId,'SG2-XRAY-FULL-UI-PARITY-B-20261031')
  assert.equal(digest(bytes),ui.previousReceiptDigest)
  const {fullUiParityAdoption,...preserved}=receipt
  assert.deepEqual(preserved,prior,'UI preserves the complete accepted PCI receipt')
  for(const[file,hash]of Object.entries(ui.applicationSourceDigests))assert.equal(digest(current('apps/sg-runtime/'+file)),hash,'current UI continuation '+file)
  const previous=file=>Object.hasOwn(ui.applicationSourceDigests,file.replace(/^apps\/sg-runtime\//,''))?historical(ui.previousReceiptSourceSha,file):current(file)
  return assertPciSmartIntegrity(prior,previous,historical)
 }
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
