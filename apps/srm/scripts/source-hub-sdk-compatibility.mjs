import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {posix} from 'node:path'
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
// Test-only additive compatibility; never imported by a product runtime.
export function assertSourceHubApiPathCompatibility(receipt,current,historical){
 const a=receipt.sourceHubApiPathCompatibility,file='apps/srm/operation-integration.json'
 assert.equal(a.taskId,'SRM-SOURCE-HUB-API-PATH-COMPATIBILITY-20261103')
 assert.equal(a.platformVersion,'1.33.0');assert.equal(a.apiPathContractVersion,'1.0.0')
 assert.equal(a.previousReceiptSourceSha,'36b07672f572ff7c1c81117e3f3b01fa93ec1e65')
 assert.equal(a.producer.projectKey,'ARCHITECTURE');assert.equal(a.producer.pullRequest,885)
 const bytes=historical(a.previousReceiptSourceSha,file),prior=JSON.parse(bytes)
 assert.equal(hash(bytes),a.previousReceiptSha256)
 const {sourceHubApiPathCompatibility,...preserved}=receipt
 assert.deepEqual(preserved,prior,'every accepted product, analytics and historical receipt is immutable')
 assert.deepEqual(Object.keys(a.consumerSourceDigests).sort(),["apps/maps-runtime/platform-integration.json", "apps/maps-runtime/test/embed.test.mjs", "apps/srm/deployment/root-atomic-claim-targets.json", "apps/srm/package-lock.json", "apps/srm/scripts/diagnostic-telemetry-adoption.test.mjs", "apps/srm/scripts/native-execution-adoption.test.mjs", "apps/srm/scripts/operation-context.test.mjs", "apps/srm/scripts/request-quota-adoption.test.mjs", "apps/srm/scripts/source-hub-sdk-compatibility.mjs", "apps/srm/scripts/xray-performance-adoption.test.mjs", "apps/srm/src/server/full-ui-parity-adoption.test.ts", "apps/srm/src/server/root-atomic-claim-adoption.test.ts", "packages/maps-embed/package.json"])
 for(const [p,h]of Object.entries(a.consumerSourceDigests))assert.equal(hash(current(p)),h,'current consumer compatibility '+p)
 for(const [p,h]of Object.entries(a.sourceDigests))assert.equal(hash(current('packages/platform-contracts/'+p)),h,'current SDK '+p)
 for(const [p,h]of Object.entries(a.producerMetadataDigests))assert.equal(hash(current(p)),h,'current optional peer metadata '+p)
 assert.deepEqual(a.applicationSourceDigests,Object.fromEntries(Object.entries(a.consumerSourceDigests).map(([p,h])=>[posix.relative('apps/srm',p),h])))
 for(const flag of ['apiPathOptedIn','sql028Installed','businessLogicChanged','uiChanged','authorizationChanged','sourceBindingsChanged','providerCallsPerformed','deploymentPerformed'])assert.equal(a[flag],false,flag)
 const mapped=new Set([...Object.keys(a.consumerSourceDigests),...Object.keys(a.sourceDigests).map(p=>'packages/platform-contracts/'+p),...Object.keys(a.producerMetadataDigests)])
 return {prior,previousBytes:p=>p===file||mapped.has(p)?historical(a.previousReceiptSourceSha,p):current(p)}
}
