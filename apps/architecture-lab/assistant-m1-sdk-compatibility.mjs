import {assertOilReportSourceCompatibility} from '../srm/scripts/source-hub-sdk-compatibility.mjs'
// Source acceptance only. Product runtimes never import this helper.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {posix} from 'node:path'
export const ASSISTANT_SDK_PREDECESSOR='b39fcc6f99ce6e06184080e5eaf5e6e4c7e120b5'
export const ASSISTANT_SDK_PRODUCER='6a7863459977f5651bf30100935118e1613021fd'
const recordPath='apps/architecture-lab/assistant-m1-sdk-compatibility.json'
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const receiptPath=project=>'apps/'+(project==='SG2'?'sg-runtime':'srm')+'/operation-integration.json'
const additions=['migrations/access/030-assistant-operations.sql','src/assistant-operation-host.d.mts','src/assistant-operation-host.mjs','src/assistant-usage.d.mts','src/assistant-usage.mjs']
export function assistantSdkPredecessor(current,historical){
 const consumer=JSON.parse(current(receiptPath('SG2')))
 if(consumer.oilAutonomousReportCompatibility){const n=assertOilReportSourceCompatibility(consumer,current,historical,{projectKey:'SG2'});return assistantSdkPredecessor(n.previousBytes,historical)}
 const recordBytes=current(recordPath)
 assert.equal(hash(recordBytes),'f9bd750bd7c4af2b1123a41396cfeacac90bb1744f9abdd5331c76260872b70c','exact reviewed assistant SDK source record')
 const a=JSON.parse(recordBytes)
 assert.equal(a.schemaVersion,'1.0');assert.equal(a.taskId,'ARCH-ACG-M1-EXECUTION-20261109')
 assert.equal(a.scope,'OPTIONAL_ASSISTANT_ROOT_20_SOURCE_COMPATIBILITY');assert.equal(a.platformVersion,'1.34.0')
 assert.equal(a.previousSourceSha,ASSISTANT_SDK_PREDECESSOR);assert.equal(a.producerSourceSha,ASSISTANT_SDK_PRODUCER)
 const prior=JSON.parse(historical(ASSISTANT_SDK_PREDECESSOR,receiptPath('SG2'))).sourceHubMarketSymbolCompatibility
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),[...Object.keys(prior.sourceDigests),...additions].sort(),'closed complete SDK source inventory')
 for(const [p,h]of Object.entries(a.sourceDigests)){
  const file='packages/platform-contracts/'+p
  assert.equal(hash(current(file)),h,'current admitted assistant SDK '+file)
 }
 assert.equal(a.compatibilitySourceSha,'fc81d289670930e5048626956146eaa02351567a')
 assert.deepEqual(Object.keys(a.compatibilityTestSourceDigests).sort(),['current-fresh-report/test/current-fresh-report.test.mjs','readonly-miss-report/test/readonly-miss-report.test.mjs','test/private-operation-host.test.mjs'])
 for(const [p,h]of Object.entries(a.compatibilityTestSourceDigests))assert.equal(hash(current('packages/platform-contracts/'+p)),h,'current compatibility test '+p)
 for(const flag of ['defaultAssistantEnabled','schemaInstalled','grantsChanged','providerCallsPerformed','deploymentPerformed'])assert.equal(a[flag],false,flag)
 return {record:a,previousBytes:p=>p.startsWith('packages/platform-contracts/')&&Object.hasOwn(prior.sourceDigests,p.slice('packages/platform-contracts/'.length))?Buffer.from(historical(ASSISTANT_SDK_PREDECESSOR,p)):current(p)}
}
export function assertAssistantConsumerCompatibility(receipt,current,historical,{projectKey,validatePeer=true}){
 if(receipt.oilAutonomousReportCompatibility){const n=assertOilReportSourceCompatibility(receipt,current,historical,{projectKey,validatePeer});return assertAssistantConsumerCompatibility(n.prior,n.previousBytes,historical,{projectKey,validatePeer})}
 assert(['SG2','SRM'].includes(projectKey));const file=receiptPath(projectKey),peer=projectKey==='SG2'?'SRM':'SG2'
 const a=receipt.assistantM1SourceCompatibility;assert(a,'explicit assistant SDK source receipt required')
 assert.equal(a.schemaVersion,'1.0');assert.equal(a.targetEnvironment,'development')
 assert.equal(a.taskId,projectKey==='SG2'?'SG2-ACG-M1-20261109':'SRM-ACG-M1-SDK-COMPATIBILITY-20261110')
 assert.equal(a.scope,'OPTIONAL_ASSISTANT_SOURCE_NO_RUNTIME_ACTIVATION');assert.equal(a.previousReceiptSourceSha,ASSISTANT_SDK_PREDECESSOR)
 const bytes=Buffer.from(historical(ASSISTANT_SDK_PREDECESSOR,file)),prior=JSON.parse(bytes)
 assert.equal(hash(bytes),a.previousReceiptSha256)
 const {assistantM1SourceCompatibility,...preserved}=receipt
 assert.deepEqual(preserved,prior,'every pre-M1 receipt and fingerprint is immutable')
 const sdk=assistantSdkPredecessor(current,historical).record
 assert.deepEqual(a.sourceDigests,{...sdk.sourceDigests,...sdk.compatibilityTestSourceDigests});assert.deepEqual(a.sdkDigests,sdk.sdkDigests);assert.deepEqual(a.optionalPackageDigests,sdk.optionalPackageDigests)
 assert.deepEqual(a.rootContract,{...prior.contract,sourceDigest:sdk.sdkDigests.operationSourceDigest})
 assert.deepEqual(a.rootProducer,{projectKey:'ARCHITECTURE',taskId:'ARCH-ACG-M1-EXECUTION-20261109',pullRequest:937,sourceSha:ASSISTANT_SDK_PRODUCER})
 assert.deepEqual(a.applicationSourceDigests,Object.fromEntries(Object.entries({...a.consumerSourceDigests,...a.peerSourceDigests}).map(([p,h])=>[posix.relative(posix.dirname(file),p),h])))
 for(const [p,h]of Object.entries({...a.consumerSourceDigests,...a.peerSourceDigests})){
  assert(/^apps\/(sg-runtime\/tests|srm\/scripts)\/[a-z0-9.-]+\.(mjs|ts|tsx)$/.test(p)||['apps/srm/deployment/root-atomic-claim-targets.json','apps/srm/src/server/root-atomic-claim-adoption.test.ts'].includes(p),'source-only consumer compatibility path')
  assert.equal(hash(current(p)),h,'current assistant consumer closure '+p)
 }
 for(const flag of ['assistantOptedIn','sql030Installed','historyInstalled','grantsChanged','providerCallsPerformed','deploymentPerformed'])assert.equal(a[flag],false,flag)
 if(validatePeer){const other=JSON.parse(current(receiptPath(peer)));assertAssistantConsumerCompatibility(other,current,historical,{projectKey:peer,validatePeer:false});assert.deepEqual(a.peerSourceDigests,other.assistantM1SourceCompatibility.consumerSourceDigests)}
 const mapped=new Set([...Object.keys(a.consumerSourceDigests),...Object.keys(a.peerSourceDigests),...Object.keys(a.sourceDigests).map(p=>'packages/platform-contracts/'+p),file,receiptPath(peer)])
 return {prior,previousBytes:p=>mapped.has(p)?Buffer.from(historical(ASSISTANT_SDK_PREDECESSOR,p)):current(p)}
}
