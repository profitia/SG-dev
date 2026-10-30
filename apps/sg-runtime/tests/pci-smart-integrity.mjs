/** Additive continuation: exact current bytes AND immutable prior evidence, never digest replacement. */
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
export function assertPciSmartIntegrity(receipt,current,historical){
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
  assert(!file.startsWith('/')&&!file.split('/').includes('..')&&(file.startsWith('apps/sg-runtime/')||file.startsWith('packages/sg2-price-change-index-ui/')||file==='.github/workflows/sg2-price-change-index-ci.yml'))
  assert.match(hash,/^[a-f0-9]{64}$/);assert.equal(digest(current(file)),hash,'exact smart source '+file)
 }
 for(const file of a.preservedEnginePaths)assert.equal(digest(current(file)),digest(historical(a.previousReceiptSourceSha,file)),'unchanged engine '+file)
 for(const flag of ['cciCoreChanged','indexedPriceChanged','sourceHistoryChanged','authorizationContractChanged','schemaChanged','newPaidProviderCalls','srmRuntimeChanged','productDeploymentPerformed'])assert.equal(a[flag],false,flag)
 return{prior,previousBytes:file=>Object.hasOwn(a.sourceDigests,file)?historical(a.previousReceiptSourceSha,file):current(file)}
}
