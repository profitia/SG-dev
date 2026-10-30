import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {posix} from 'node:path'
import {currentHumanReadSourceDigest,CURRENT_HUMAN_READ_CONTRACT} from '@profitia/platform-contracts/current-human-read'
import {PREPARED_REPORT_RULES} from '../src/server/ready-report.ts'
import './fresh-report-release.test.mjs'
const hash=value=>createHash('sha256').update(value).digest('hex')
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url))
const assertCurrentConsumerSource=(file,digest)=>{
 const current=read(file)
 if(file!=='../sg-runtime/operation-integration.json')return assert.equal(hash(current),digest,file)
 const {pciLiveAcceptanceStabilization:pci,...preserved}=JSON.parse(current)
 // Admit only the approved additive PCI record; retain the SRM historical hash.
 assert(pci,'approved additive SG2 PCI receipt is required')
 assert.equal(hash(JSON.stringify(pci)),'bdb51cd9af2ebb03d508e2610d0a57d9aa28a070487ae5772d1cca03c2d233fb','approved SG2 PCI record')
 const previous=execFileSync('git',['show',pci.previousReceiptSourceSha+':apps/sg-runtime/operation-integration.json'])
 assert.equal(hash(previous),digest,'historical '+file)
 assert.equal(pci.previousReceiptSha256,digest,'SG2 previous receipt binding')
 assert.deepEqual(preserved,JSON.parse(previous),'all historical SG2 entries remain unchanged')
 for(const[source,expected]of Object.entries(pci.applicationSourceDigests))assert.equal(hash(read('../sg-runtime/'+source)),expected,'current SG2 '+source)
 for(const[source,expected]of Object.entries(pci.publicUiSourceDigests))assert.equal(hash(fs.readFileSync(new URL('../../../'+source,import.meta.url))),expected,'current PCI '+source)
}
const refinement=JSON.parse(read('operation-integration.json')).freshRuntimeRefinement
const settled=JSON.parse(read('operation-integration.json')).settledExternalFailureRecovery
const clock=JSON.parse(read('operation-integration.json')).sourceLeaseClockRecovery
const beforeClock=file=>clock?.applicationSourceDigests[file]?execFileSync('git',['show',clock.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+file)]):read(file)
const beforeSettled=file=>settled?.applicationSourceDigests[file]?execFileSync('git',['show',settled.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+file)]):beforeClock(file)
const beforeRefinement=file=>refinement?.applicationSourceDigests[file]?execFileSync('git',['show',refinement.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+file)]):beforeSettled(file)
test('complete X-Ray architecture adopts the exact producer and consumer closure without rewriting history or claiming deployment',async()=>{
 const receipt=JSON.parse(read('operation-integration.json')),a=receipt.xrayPerformanceRecoveryV2,xray=receipt.appshellXraySourceCompatibility,rural=receipt.ruralLocationAddressRecovery,peer=receipt.appshellReadyPeerRecovery,fresh=receipt.freshPerformanceRecovery
 const before=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(before),a.previousReceiptDigest)
 for(const[key,value]of Object.entries(JSON.parse(before)))assert.deepEqual(receipt[key],value,key)
 assert.equal(a.taskId,'SRM-XRAY-PERFORMANCE-RECOVERY-V2-IMPLEMENT-20261028');assert.equal(a.platformVersion,'1.30.0')
 assert.equal(a.producer.projectKey,'ARCHITECTURE');assert.equal(a.producer.pullRequest,772)
 assert.deepEqual(a.currentHumanReadContract,{id:CURRENT_HUMAN_READ_CONTRACT.id,version:'1.0.0'});assert.deepEqual(fresh.currentHumanReadContract,CURRENT_HUMAN_READ_CONTRACT)
 assert.equal(await currentHumanReadSourceDigest(),(clock?.sdkDigests.currentHumanReadSourceDigest??fresh.sdkDigests.currentHumanReadSourceDigest))
 const root=new URL('../',import.meta.resolve('@profitia/platform-contracts/current-human-read'))
 for(const[file,digest]of Object.entries(a.sourceDigests)){
  assert.equal(hash(execFileSync('git',['show',a.producer.sourceSha+':packages/platform-contracts/'+file])),digest,'producer '+file)
  if(file!=='package-lock.json')assert.equal(hash(fs.readFileSync(new URL(file,root))),receipt.sourceLeaseClockRecovery?.sourceDigests[file]??receipt.settledExternalFailureRecovery?.sourceDigests[file]??fresh.sourceDigests[file]??xray.sourceDigests[file]??digest,'installed '+file)
 }
 assert(Object.keys(a.applicationSourceDigests).length>=30)
 for(const[file,digest]of Object.entries(a.consumerSourceDigests))assert.equal(hash(execFileSync('git',['show',xray.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+file)])),digest,'historical consumer '+file)
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(Object.hasOwn(xray.applicationSourceDigests,file)?execFileSync('git',['show',xray.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+file)]):rural?.applicationSourceDigests[file]?execFileSync('git',['show',rural.authorityBaseSha+':'+posix.normalize('apps/srm/'+file)]):peer?.applicationSourceDigests[file]?execFileSync('git',['show',peer.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+file)]):fresh.applicationSourceDigests[file]?execFileSync('git',['show',fresh.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+file)]):beforeRefinement(file)),digest,'historical '+file)
 for(const[file,digest]of Object.entries({...xray.applicationSourceDigests,...rural?.applicationSourceDigests,...peer?.applicationSourceDigests,...fresh.applicationSourceDigests,...refinement?.applicationSourceDigests,...settled?.applicationSourceDigests,...clock?.applicationSourceDigests}))assertCurrentConsumerSource(file,digest)
 const config=JSON.parse(read('deployment/ready-report-targets.json'))
 assert.equal(config.schemaDigest,hash(Buffer.concat([read('db/private-store/024-ready-report-history.sql'),read('db/private-store/025-ready-report-history.sql'),
  read('src/server/ready-report-shape.json'),Buffer.from(JSON.stringify(PREPARED_REPORT_RULES))])))
 assert.equal(config.workSchemaDigest,hash(read('db/private-store/026-ready-company-work.sql')))
 assert.equal(a.companyWorkSchemaDigest,config.workSchemaDigest);assert.equal(a.preparedSchemaDigest,config.schemaDigest)
 assert.equal(config.serviceId,'srv-db1vu6gm7kps73d0e3r0');assert.equal(config.enabledByDefault,false)
 assert.equal(a.standardSharedReadRequiresCurrentModule,true);assert.equal(a.readyRetainsQualifiedRadar,true)
 assert.equal(a.noPrivateDocumentsInSharedProjection,true);assert.equal(a.noPositiveAuthorizationCache,true)
 assert.equal(a.freshUsesOriginalFinancialCalculatorOnce,true);assert.equal(a.historyUsesImmutableSourceReferences,true)
 for(const flag of ['runtimeDeploymentPerformed','livePerformanceThresholdsAchieved','stagingOrProductionChanged','paidAcquisitionsPerformed'])assert.equal(a[flag],false,flag)
 const scripts=JSON.parse(read('package.json')).scripts['test:operation-context']
 assert(scripts.includes('xray-performance-adoption.test.mjs'));assert(scripts.includes('ready-report.integration.test.mjs'))
})

test('FRESH recovery explicitly accepts the peer reader and preserves all prior receipts',async()=>{
 const receipt=JSON.parse(read('operation-integration.json')),a=receipt.freshPerformanceRecovery
 const before=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(before),a.previousReceiptDigest)
 for(const[k,v]of Object.entries(JSON.parse(before)))assert.deepEqual(receipt[k],v,k)
 assert.equal(a.producer.projectKey,'ARCHITECTURE');assert.equal(a.producer.pullRequest,784)
 assert.equal(a.platformVersion,'1.32.0');assert.deepEqual(a.currentHumanReadContract,CURRENT_HUMAN_READ_CONTRACT)
 assert.equal(await currentHumanReadSourceDigest(),(clock?.sdkDigests.currentHumanReadSourceDigest??a.sdkDigests.currentHumanReadSourceDigest))
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(beforeRefinement(file)),digest,file)
 assert.equal(a.reusesAuthorizationDecisions,false);assert.equal(a.stagingOrProductionChanged,false)
 assert.equal(a.paidAcquisitionsPerformed,false);assert.equal(a.performanceThresholdsAchieved,false)
})


test('runtime refinement preserves accepted architecture, current security gates and every prior receipt',()=>{
 assert(refinement)
 const previous=execFileSync('git',['show',refinement.previousReceiptSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(previous),refinement.previousReceiptDigest)
 const receipt=JSON.parse(read('operation-integration.json'))
 for(const[k,v]of Object.entries(JSON.parse(previous)))assert.deepEqual(receipt[k],v,k)
 for(const[file,digest]of Object.entries(refinement.applicationSourceDigests))assert.equal(hash(beforeSettled(file)),digest,file)
 assert.equal(refinement.searchRefreshHeadroomMs,20000);assert.equal(refinement.metadataRefreshHeadroomMs,30000)
 for(const key of ['serverAuthorityChecksChanged','sharedContractChanged','providerPolicyChanged','providerRetriesAdded','credentialsPersisted','runtimeDeploymentClaimed','performanceThresholdsClaimed'])assert.equal(refinement[key],false,key)
})

test('settled provider failure adoption pins its producer and never treats Source control failure as identity',async()=>{
 assert(settled)
 const receipt=JSON.parse(read('operation-integration.json'))
 const previous=execFileSync('git',['show',settled.previousReceiptSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(previous),settled.previousReceiptDigest)
 for(const[k,v]of Object.entries(JSON.parse(previous)))assert.deepEqual(receipt[k],v,k)
 assert.equal(settled.producer.projectKey,'ARCHITECTURE');assert.equal(settled.producer.pullRequest,790)
 const sdk=await import('@profitia/platform-contracts/external-call')
 assert.deepEqual(settled.contract,sdk.EXTERNAL_CALL_FAILURE_OBSERVATION)
 assert.equal(await sdk.externalCallSourceDigest(),(clock?.sdkDigests.externalCallSourceDigest??settled.sdkDigests.externalCallSourceDigest))
 const root=new URL('../',import.meta.resolve('@profitia/platform-contracts/external-call'))
 assert.equal(JSON.parse(fs.readFileSync(new URL('package.json',root))).version,(clock??settled).platformVersion)
 for(const[file,digest]of Object.entries(settled.sourceDigests)){
  assert.equal(hash(execFileSync('git',['show',settled.producer.sourceSha+':packages/platform-contracts/'+file])),digest,'producer '+file)
  if(!file.startsWith('test/')&&file!=='package-lock.json')assert.equal(hash(fs.readFileSync(new URL(file,root))),clock?.sourceDigests[file]??digest,'installed '+file)
 }
 for(const[file,digest]of Object.entries(settled.applicationSourceDigests))assert.equal(hash(beforeClock(file)),digest,file)
 for(const flag of ['redirectPolicyChanged','providerRetryAdded','sourceFailureBypassed','humanAuthorityChanged','sqlSchemaChanged','runtimeDeploymentClaimed','performanceThresholdsClaimed'])assert.equal(settled[flag],false,flag)
})

test('Source clock adoption preserves complete history and exact producer while retaining 30s bounds',async()=>{
 const receipt=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url))),a=receipt.sourceLeaseClockRecovery
 const previous=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(previous),a.previousReceiptDigest)
 for(const[k,v]of Object.entries(JSON.parse(previous)))assert.deepEqual(receipt[k],v,k)
 assert.equal(a.producer.pullRequest,793);assert.equal(a.maximumLeaseMs,30000);assert.equal(a.maximumClockDivergenceMs,1000)
 assert.equal(a.subtractsEntireQueryRoundTrip,true);assert.equal(a.currentSourceChecksPreserved,true)
 assert.equal(a.schemaOrPolicyChanges,false);assert.equal(a.peerWireContractChanged,false)
 const sdk=await import('@profitia/platform-contracts/external-call'),root=new URL('../',import.meta.resolve('@profitia/platform-contracts/external-call'))
 assert.equal(await sdk.externalCallSourceDigest(),a.sdkDigests.externalCallSourceDigest)
 for(const[file,digest]of Object.entries(a.sourceDigests)){
  assert.equal(hash(execFileSync('git',['show',a.producer.sourceSha+':packages/platform-contracts/'+file])),digest,'producer '+file)
  if(file!=='package-lock.json')assert.equal(hash(fs.readFileSync(new URL(file,root))),digest,'installed '+file)
 }
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assertCurrentConsumerSource(file,digest)
})
