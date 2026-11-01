/** Test-only additive acceptance. Original receipts and runtime bytes stay immutable. */
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const FILES=["scripts/native-execution-adoption.test.mjs","scripts/rural-location-release.test.mjs","scripts/xray-performance-adoption.test.mjs","scripts/xray-style-acceptance.mjs","scripts/xray-workflow-contract.test.ts","src/server/full-ui-parity-adoption.test.ts","src/server/peer-read-boundary.test.ts","src/server/supplier-location-geocoding-runtime.test.ts"]
const SENTRY_HOST_FILES=["scripts/native-execution-adoption.test.mjs","scripts/rural-location-release.test.mjs","scripts/xray-performance-adoption.test.mjs","scripts/xray-style-acceptance.mjs","scripts/xray-workflow-contract.test.ts","src/server/full-ui-parity-adoption.test.ts","src/server/peer-read-boundary.test.ts","src/server/supplier-location-geocoding-runtime.test.ts"]
export function assertSentryHostContinuation(receipt,current,historical){
 const a=receipt.sentryHostIntegrityContinuation
 assert.equal(a.taskId,'SRM-SENTRY-HOST-INTEGRITY-R2-20261101')
 assert.equal(a.scope,'TEST_ONLY_SG2_HOST_SOURCE_ACCEPTANCE')
 assert.equal(a.previousReceiptSourceSha,'019ee20c039fb92b13857e27d2866f7daf13abc3')
 const bytes=historical(a.previousReceiptSourceSha,'apps/srm/operation-integration.json'),prior=JSON.parse(bytes)
 assert.equal(hash(bytes),a.previousReceiptSha256)
 const {sentryHostIntegrityContinuation,...preserved}=receipt
 assert.deepEqual(preserved,prior,'every earlier SRM receipt and hash remains immutable')
 assert.deepEqual(Object.keys(a.applicationSourceDigests).sort(),SENTRY_HOST_FILES)
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(current('apps/srm/'+file)),digest,'exact SRM test-only Sentry continuation '+file)
 assert.equal(a.consumerSourceSha,'a1503404d7723696706d7b8a176fb2a5d4cafaa7')
 assert.equal(a.priorCandidateSourceSha,'405d0e0dbb72106349cd5597571c56e95f803296')
 assert.equal(hash(historical(a.priorCandidateSourceSha,'apps/srm/operation-integration.json')),a.priorCandidateReceiptSha256)
 const hostBytes=historical(a.consumerSourceSha,'apps/sg-runtime/operation-integration.json'),host=JSON.parse(hostBytes)
 const expected={'../sg-runtime/operation-integration.json':hash(hostBytes),...Object.fromEntries(Object.entries(host.sentryObservabilityCompatibility.sourceDigests).map(([file,digest])=>['../sg-runtime/'+file.slice(16),digest]))}
 assert.deepEqual(a.consumerSourceDigests,expected,'exact immutable SG2 Sentry host closure')
 for(const[file,digest]of Object.entries(a.consumerSourceDigests))assert.equal(hash(current('apps/'+file.slice(3))),digest,'exact SG2 Sentry host '+file)
 for(const flag of ['runtimeChanged','monitoringAddedToSrm','authorizationChanged','financialEngineChanged','schemaChanged','sharedContractsChanged','privatePinsChanged','ciPolicyChanged','runtimeDeploymentPerformed','paidAcquisitionsPerformed'])assert.equal(a[flag],false,flag)
 return {prior,previousBytes:file=>Object.hasOwn(a.applicationSourceDigests,file.replace(/^apps\/srm\//,''))||Object.hasOwn(a.consumerSourceDigests,'../'+file.slice(5))?historical(a.previousReceiptSourceSha,file):current(file)}
}
export function assertStyleConsumerAcceptance(receipt,current,historical){
 const a=receipt.xrayStyleIsolationConsumerAcceptance
 assert.equal(a.taskId,'SRM-XRAY-STYLE-CONSUMER-ACCEPTANCE-B-20261101-R17')
 assert.equal(a.previousReceiptSourceSha,'b965924a63fafb1a24b84ceb389dfd5e78648f57')
 const bytes=historical(a.previousReceiptSourceSha,'apps/srm/operation-integration.json'),prior=JSON.parse(bytes)
 assert.equal(hash(bytes),a.previousReceiptSha256)
 const {xrayStyleIsolationConsumerAcceptance,...preserved}=receipt
 assert.deepEqual(preserved,prior,'all earlier SRM receipts and original hashes stay immutable')
 assert.deepEqual(Object.keys(a.applicationSourceDigests).sort(),FILES)
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(current('apps/srm/'+file)),digest,'exact style acceptance test '+file)
 assert.equal(a.consumerSourceSha,'7b8fd2f030b4966d47535f7ef523df697c790147')
 const hostBytes=historical(a.consumerSourceSha,'apps/sg-runtime/operation-integration.json'),host=JSON.parse(hostBytes)
 const expected={'../sg-runtime/operation-integration.json':hash(hostBytes),...Object.fromEntries(Object.entries(host.xrayStyleIsolationContinuation.sourceDigests).map(([file,digest])=>['../sg-runtime/'+file.slice(16),digest]))}
 assert.deepEqual(a.consumerSourceDigests,expected,'closed exact consumer set from the immutable accepted checkpoint')
 for(const[file,digest]of Object.entries(a.consumerSourceDigests))assert.equal(hash(current('apps/'+file.slice(3))),digest,'exact SG2 style consumer '+file)
 for(const flag of ['runtimeChanged','freshOrReadyChanged','authorizationChanged','publicUiChanged','sqlChanged','contractsChanged','privatePinsChanged','ciPolicyChanged','runtimeDeploymentPerformed','paidAcquisitionsPerformed'])assert.equal(a[flag],false,flag)
 return {prior,previousBytes:file=>Object.hasOwn(a.applicationSourceDigests,file.replace(/^apps\/srm\//,''))||Object.hasOwn(a.consumerSourceDigests,'../'+file.slice(5))?historical(a.previousReceiptSourceSha,file):current(file)}
}
