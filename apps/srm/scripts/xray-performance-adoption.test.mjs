import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {posix} from 'node:path'
import {currentHumanReadSourceDigest,CURRENT_HUMAN_READ_CONTRACT} from '@profitia/platform-contracts/current-human-read'
import {currentFreshReportSourceDigest,CURRENT_FRESH_REPORT_CONTRACT} from '@profitia/platform-current-fresh-report'
import {PREPARED_REPORT_RULES} from '../src/server/ready-report.ts'
import './fresh-report-release.test.mjs'
import './fresh-postfetch-release.test.mjs'
const hash=value=>createHash('sha256').update(value).digest('hex')
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url))
const refinement=JSON.parse(read('operation-integration.json')).freshRuntimeRefinement
const settled=JSON.parse(read('operation-integration.json')).settledExternalFailureRecovery
const clock=JSON.parse(read('operation-integration.json')).sourceLeaseClockRecovery
const postfetch=JSON.parse(read('operation-integration.json')).freshPostfetchRecovery
const preparedEvidence=JSON.parse(read('operation-integration.json')).freshPreparedEvidenceRecovery
const msrEligibility=JSON.parse(read('operation-integration.json')).freshMsrEligibilityRecovery
const projectionCpu=JSON.parse(read('operation-integration.json')).freshProjectionCpuRecovery
const persisted=JSON.parse(read('operation-integration.json')).freshPersistedResultRecovery
const pciCurrent=JSON.parse(read('operation-integration.json')).pciCurrentIntegrationCompatibility
const pciOriginal=JSON.parse(read('operation-integration.json')).pciReceiptIntegrityCompatibility
const documentReuse=JSON.parse(read('operation-integration.json')).freshDocumentWriteReuseRecovery
const recordBound=JSON.parse(read('operation-integration.json')).mgbiRecordResponseBoundRecovery
const liveBql=JSON.parse(read('operation-integration.json')).bqlLiveAcceptanceIntegrityContinuation
const dataCopy=JSON.parse(read('operation-integration.json')).freshDataCopyRecovery
const documentPolicy=JSON.parse(read('operation-integration.json')).freshDocumentPolicyRecovery
const locationCache=JSON.parse(read('operation-integration.json')).supplierLocationCacheAdoption
const beforeLocationCache=file=>locationCache?.applicationSourceDigests[file]?execFileSync('git',['show',locationCache.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+file)]):beforeFullUi(file)
const inventoryReuse=JSON.parse(read('operation-integration.json')).freshInventoryReuseRecovery
const fullUi=JSON.parse(read('operation-integration.json')).fullUiParityAdoption
const beforeFullUi=file=>fullUi?.applicationSourceDigests[file]?execFileSync('git',['show',fullUi.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+file)]):hostUiDigests[file]?execFileSync('git',['show',hostReceipt.fullUiParityAdoption.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+file)]):acceptedReceiverBytes(file)
const hostReceipt=JSON.parse(read('../sg-runtime/operation-integration.json'))
const hostUiDigests=Object.fromEntries(Object.entries(hostReceipt.fullUiParityAdoption?.applicationSourceDigests??{}).map(([file,digest])=>[posix.relative('apps/srm',posix.normalize('apps/sg-runtime/'+file)),digest]))
const acceptedReceiverBytes=file=>{if(file==='../sg-runtime/operation-integration.json'&&hostReceipt.fullUiParityAdoption){const a=hostReceipt.fullUiParityAdoption,bytes=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/sg-runtime/operation-integration.json']);assert.equal(hash(bytes),a.previousReceiptDigest);const {fullUiParityAdoption,...preserved}=hostReceipt;assert.deepEqual(preserved,JSON.parse(bytes));return bytes}return read(file)}
const beforeInventoryReuse=file=>inventoryReuse?.applicationSourceDigests[file]?execFileSync('git',['show',inventoryReuse.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+file)]):beforeLocationCache(file)
const payloadCapture=JSON.parse(read('operation-integration.json')).freshPayloadCaptureAdoption
const beforePayloadCapture=file=>payloadCapture?.applicationSourceDigests[file]?execFileSync('git',['show',payloadCapture.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+file)]):beforeInventoryReuse(file)
const beforeDocumentPolicy=file=>documentPolicy?.applicationSourceDigests[file]?execFileSync('git',['show',documentPolicy.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+file)]):beforePayloadCapture(file)
const beforeDataCopy=file=>dataCopy?.applicationSourceDigests[file]?execFileSync('git',['show',dataCopy.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+file)]):beforeDocumentPolicy(file)
const freshBoundary=JSON.parse(read('operation-integration.json')).freshCurrentBoundaryAdoption
const beforeFreshBoundary=file=>freshBoundary?.applicationSourceDigests[file]?execFileSync('git',['show',freshBoundary.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+file)]):beforeDataCopy(file)
const beforeLiveBql=file=>liveBql?.applicationSourceDigests[file]||liveBql?.consumerSourceDigests[file]?execFileSync('git',['show',liveBql.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+file)]):beforeFreshBoundary(file)
const resultCapture=JSON.parse(read('operation-integration.json')).freshResultCaptureRecovery
const beforeResultCapture=file=>resultCapture?.applicationSourceDigests[file]?execFileSync('git',['show',resultCapture.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+file)]):beforeLiveBql(file)
const bql=JSON.parse(read('operation-integration.json')).bqlPciIntegrityContinuation
const beforeBql=file=>bql?.applicationSourceDigests[file]||bql?.consumerSourceDigests[file]?execFileSync('git',['show',bql.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+file)]):beforeResultCapture(file)
const beforeRecordBound=file=>recordBound?.applicationSourceDigests[file]?execFileSync('git',['show',recordBound.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+file)]):beforeBql(file)
const beforeDocumentReuse=file=>documentReuse?.applicationSourceDigests[file]?execFileSync('git',['show',documentReuse.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+file)]):beforeRecordBound(file)
const beforeCurrentPci=file=>pciCurrent?.applicationSourceDigests[file]||pciOriginal?.consumerSourceDigests[file]?execFileSync('git',['show',pciCurrent.mainSourceSha+':'+posix.normalize('apps/srm/'+file)]):beforeDocumentReuse(file)
const beforePersisted=file=>persisted?.applicationSourceDigests[file]?execFileSync('git',['show',persisted.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+file)]):beforeCurrentPci(file)
const beforeProjectionCpu=file=>projectionCpu?.applicationSourceDigests[file]?execFileSync('git',['show',projectionCpu.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+file)]):beforePersisted(file)
const beforeMsrEligibility=file=>msrEligibility?.applicationSourceDigests[file]?execFileSync('git',['show',msrEligibility.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+file)]):beforeProjectionCpu(file)
const beforePreparedEvidence=file=>preparedEvidence?.applicationSourceDigests[file]?execFileSync('git',['show',preparedEvidence.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+file)]):beforeMsrEligibility(file)
const beforePostfetch=file=>postfetch?.applicationSourceDigests[file]?execFileSync('git',['show',postfetch.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+file)]):beforePreparedEvidence(file)
const beforeClock=file=>clock?.applicationSourceDigests[file]?execFileSync('git',['show',clock.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+file)]):beforePostfetch(file)
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
 assert.equal(await currentHumanReadSourceDigest(),(postfetch?.sdkDigests.currentHumanReadSourceDigest??clock?.sdkDigests.currentHumanReadSourceDigest??fresh.sdkDigests.currentHumanReadSourceDigest))
 const root=new URL('../',import.meta.resolve('@profitia/platform-contracts/current-human-read'))
 for(const[file,digest]of Object.entries(a.sourceDigests)){
  assert.equal(hash(execFileSync('git',['show',a.producer.sourceSha+':packages/platform-contracts/'+file])),digest,'producer '+file)
  if(file!=='package-lock.json')assert.equal(hash(fs.readFileSync(new URL(file,root))),receipt.freshPostfetchRecovery?.sourceDigests[file]??receipt.freshPostfetchRecovery?.sourceDigests[file]??receipt.sourceLeaseClockRecovery?.sourceDigests[file]??receipt.settledExternalFailureRecovery?.sourceDigests[file]??fresh.sourceDigests[file]??xray.sourceDigests[file]??digest,'installed '+file)
 }
 assert(Object.keys(a.applicationSourceDigests).length>=30)
 for(const[file,digest]of Object.entries(a.consumerSourceDigests))assert.equal(hash(execFileSync('git',['show',xray.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+file)])),digest,'historical consumer '+file)
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(Object.hasOwn(xray.applicationSourceDigests,file)?execFileSync('git',['show',xray.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+file)]):rural?.applicationSourceDigests[file]?execFileSync('git',['show',rural.authorityBaseSha+':'+posix.normalize('apps/srm/'+file)]):peer?.applicationSourceDigests[file]?execFileSync('git',['show',peer.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+file)]):fresh.applicationSourceDigests[file]?execFileSync('git',['show',fresh.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+file)]):beforeRefinement(file)),digest,'historical '+file)
 for(const[file,digest]of Object.entries({...xray.applicationSourceDigests,...rural?.applicationSourceDigests,...peer?.applicationSourceDigests,...fresh.applicationSourceDigests,...refinement?.applicationSourceDigests,...settled?.applicationSourceDigests,...clock?.applicationSourceDigests,...postfetch?.applicationSourceDigests,...preparedEvidence?.applicationSourceDigests,...msrEligibility?.applicationSourceDigests,...projectionCpu?.applicationSourceDigests,...persisted?.applicationSourceDigests,...pciOriginal?.consumerSourceDigests,...pciCurrent?.applicationSourceDigests,...documentReuse?.applicationSourceDigests,...recordBound?.applicationSourceDigests,...bql?.applicationSourceDigests,...bql?.consumerSourceDigests,...resultCapture?.applicationSourceDigests,...liveBql?.applicationSourceDigests,...liveBql?.consumerSourceDigests,...freshBoundary?.applicationSourceDigests,...dataCopy?.applicationSourceDigests,...documentPolicy?.applicationSourceDigests,...payloadCapture?.applicationSourceDigests,...inventoryReuse?.applicationSourceDigests,...locationCache?.applicationSourceDigests,...fullUi?.applicationSourceDigests,...hostUiDigests}))assert.equal(hash(acceptedReceiverBytes(file)),digest,file)
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
 assert.equal(await currentHumanReadSourceDigest(),(postfetch?.sdkDigests.currentHumanReadSourceDigest??clock?.sdkDigests.currentHumanReadSourceDigest??a.sdkDigests.currentHumanReadSourceDigest))
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
 assert.equal(await sdk.externalCallSourceDigest(),(postfetch?.sdkDigests.externalCallSourceDigest??clock?.sdkDigests.externalCallSourceDigest??settled.sdkDigests.externalCallSourceDigest))
 const root=new URL('../',import.meta.resolve('@profitia/platform-contracts/external-call'))
 assert.equal(JSON.parse(fs.readFileSync(new URL('package.json',root))).version,(postfetch??clock??settled).platformVersion)
 for(const[file,digest]of Object.entries(settled.sourceDigests)){
  assert.equal(hash(execFileSync('git',['show',settled.producer.sourceSha+':packages/platform-contracts/'+file])),digest,'producer '+file)
  if(!file.startsWith('test/')&&file!=='package-lock.json')assert.equal(hash(fs.readFileSync(new URL(file,root))),postfetch?.sourceDigests[file]??clock?.sourceDigests[file]??digest,'installed '+file)
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
 assert.equal(await sdk.externalCallSourceDigest(),postfetch?.sdkDigests.externalCallSourceDigest??a.sdkDigests.externalCallSourceDigest)
 for(const[file,digest]of Object.entries(a.sourceDigests)){
  assert.equal(hash(execFileSync('git',['show',a.producer.sourceSha+':packages/platform-contracts/'+file])),digest,'producer '+file)
  if(file!=='package-lock.json')assert.equal(hash(fs.readFileSync(new URL(file,root))),postfetch?.sourceDigests[file]??digest,'installed '+file)
 }
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(beforePostfetch(file)),digest,file)
})

test('FRESH postfetch adoption preserves exact history, producer and current security boundaries',async()=>{
 const receipt=JSON.parse(read('operation-integration.json')),a=receipt.freshPostfetchRecovery
 const previous=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(previous),a.previousReceiptDigest)
 for(const[k,v]of Object.entries(JSON.parse(previous)))assert.deepEqual(receipt[k],v,k)
 assert.equal(a.producer.projectKey,'ARCHITECTURE');assert.equal(a.producer.pullRequest,797);assert.equal(a.platformVersion,'1.32.3')
 assert.equal(a.currentIdentityReadsParallel,true);assert.equal(a.durableAuthorizationCache,false);assert.equal(a.sourceCurrentChecksPreserved,true)
 for(const flag of ['peerWireContractChanged','runtimeDeploymentClaimed','performanceThresholdsClaimed','uiOrRoutingChanged'])assert.equal(a[flag],false,flag)
 const sdk=await import('@profitia/platform-contracts/identity-provider'),root=new URL('../',import.meta.resolve('@profitia/platform-contracts/identity-provider'))
 assert.equal(await sdk.identitySourceDigest(),a.sdkDigests.identitySourceDigest)
 assert.equal(await currentHumanReadSourceDigest(),a.sdkDigests.currentHumanReadSourceDigest)
 for(const[file,digest]of Object.entries(a.sourceDigests)){
  assert.equal(hash(execFileSync('git',['show',a.producer.sourceSha+':packages/platform-contracts/'+file])),digest,'producer '+file)
  if(file!=='package-lock.json')assert.equal(hash(fs.readFileSync(new URL(file,root))),digest,'installed '+file)
 }
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(beforePreparedEvidence(file)),digest,file)
})

test('prepared evidence recovery preserves prior acceptance, current SDK authority and protected source provenance',()=>{
 const receipt=JSON.parse(read('operation-integration.json')),a=receipt.freshPreparedEvidenceRecovery;
 const previous=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json']);
 assert.equal(hash(previous),a.previousReceiptDigest);
 for(const[k,v]of Object.entries(JSON.parse(previous)))assert.deepEqual(receipt[k],v,k);
 assert.equal(a.platformVersion,'1.32.3');assert.equal(a.sourceArchiveLockPreserved,true);
 for(const flag of['serverAuthorityChecksChanged','sourcePoliciesChanged','paidRetriesAdded','uiOrRoutingChanged','runtimeDeploymentClaimed','performanceThresholdsClaimed'])assert.equal(a[flag],false,flag);
 assert(Object.keys(a.applicationSourceDigests).length>=9);
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(beforeMsrEligibility(file)),digest,file);
});


test('MSR eligibility recovery preserves every accepted receipt and uses the original current-filing selection',()=>{
 const receipt=JSON.parse(read('operation-integration.json')),a=receipt.freshMsrEligibilityRecovery;
 const previous=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json']);
 assert.equal(hash(previous),a.previousReceiptDigest);
 for(const[k,v]of Object.entries(JSON.parse(previous)))assert.deepEqual(receipt[k],v,k);
 assert.equal(a.platformVersion,'1.32.3');
 for(const flag of['sourceArchiveLockPreserved','originalMsrSelectorReused','currentMsrPathPreserved','historicalAndNonFinancialIasRetained'])assert.equal(a[flag],true,flag);
 for(const flag of['serverAuthorityChecksChanged','sourcePoliciesChanged','paidRetriesAdded','uiOrRoutingChanged','runtimeDeploymentClaimed','performanceThresholdsClaimed'])assert.equal(a[flag],false,flag);
 assert(Object.keys(a.applicationSourceDigests).length>=8);
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(beforeProjectionCpu(file)),digest,file);
});


test('financial CPU recovery preserves accepted history, projection version and all authority boundaries',()=>{
 const receipt=JSON.parse(read('operation-integration.json')),a=receipt.freshProjectionCpuRecovery;
 const previous=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json']);
 assert.equal(hash(previous),a.previousReceiptDigest);
 for(const[k,v]of Object.entries(JSON.parse(previous)))assert.deepEqual(receipt[k],v,k);
 assert.equal(a.platformVersion,'1.32.3');
 assert.equal(a.documentMappingVersionChanged,false);assert.equal(a.invocationOnlyFamilyPreparation,true);
 for(const flag of['serverAuthorityChecksChanged','sourcePoliciesChanged','paidRetriesAdded','uiOrRoutingChanged','runtimeDeploymentClaimed','performanceThresholdsClaimed'])assert.equal(a[flag],false,flag);
 assert(Object.keys(a.applicationSourceDigests).length>=10);
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(beforePersisted(file)),digest,file);
});


test('persisted Source result reuse preserves all prior receipts and current security boundaries',()=>{
 const receipt=JSON.parse(read('operation-integration.json')),a=receipt.freshPersistedResultRecovery;
 const previous=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json']);
 assert.equal(hash(previous),a.previousReceiptDigest);
 for(const[k,v]of Object.entries(JSON.parse(previous)))assert.deepEqual(receipt[k],v,k);
 assert.equal(a.platformVersion,'1.32.3');
 for(const flag of ['onlyAtomicInsertMayReuse','actualReturningRows','existingHistoryReadPreserved','sourceCommitAndReceiptPreserved','peerBoundaryTiming'])assert.equal(a[flag],true,flag);
 for(const flag of ['serverAuthorityChecksChanged','sourcePoliciesChanged','paidRetriesAdded','uiOrRoutingChanged','runtimeDeploymentClaimed','performanceThresholdsClaimed'])assert.equal(a[flag],false,flag);
 assert(Object.keys(a.applicationSourceDigests).length>=10);
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(beforeCurrentPci(file)),digest,file);
});

test('document writer reuse preserves accepted history, current authority and provider boundaries',()=>{
 const receipt=JSON.parse(read('operation-integration.json')),a=receipt.freshDocumentWriteReuseRecovery;
 const previous=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json']);assert.equal(hash(previous),a.previousReceiptDigest);
 for(const[k,v]of Object.entries(JSON.parse(previous)))assert.deepEqual(receipt[k],v,k);
 assert.equal(a.platformVersion,'1.32.3');
 for(const flag of ['onceOnlyArchiveRowCapture','actualDocumentRowsReused','betterProjectionFallbackPreserved','boundedProviderResponseObservation'])assert.equal(a[flag],true,flag);
 for(const flag of ['serverAuthorityChecksChanged','sourcePoliciesChanged','paidRetriesAdded','uiOrRoutingChanged','runtimeDeploymentClaimed','performanceThresholdsClaimed'])assert.equal(a[flag],false,flag);
 assert(Object.keys(a.applicationSourceDigests).length>=12);
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(beforeRecordBound(file)),digest,file);
});

// Previous acceptances remain frozen and independently executable.
export function assertPciReceiptIntegrity(receipt, readCurrent, readHistorical) {
 const c=receipt.pciMain801IntegrityCompatibility,a=receipt.pciReceiptIntegrityCompatibility
 assert.equal(c.taskId,'SRM-PCI798-RECEIPT-INTEGRITY-20261030')
 assert.equal(c.scope,'ADDITIVE_TEST_SOURCE_CONTINUITY_ONLY')
 assert.equal(c.targetEnvironment,'development')
 assert.equal(c.previousReceiptSourceSha,'00452a23d42fc3f97e36dd3685913f99d9361222')
 assert.equal(c.previousPciSourceSha,'cb798b405465ae43c09291f94d894f986eaeddfc')
 const main=readHistorical(c.previousReceiptSourceSha,'apps/srm/operation-integration.json')
 const pci=readHistorical(c.previousPciSourceSha,'apps/srm/operation-integration.json')
 assert.equal(hash(main),c.previousReceiptSha256)
 assert.equal(hash(pci),c.previousPciReceiptSha256)
 assert.deepEqual(a,JSON.parse(pci).pciReceiptIntegrityCompatibility,'original approved SRM continuation is immutable')
 const {pciMain801IntegrityCompatibility:continuation,pciReceiptIntegrityCompatibility:original,...preserved}=receipt
 assert.deepEqual(preserved,JSON.parse(main),'all accepted main801/main803 receipts remain unchanged')
 assert.equal(a.previousReceiptSourceSha,'5c87c18192b405c907ca5575adc40a4cbb63d074')
 const older=readHistorical(a.previousReceiptSourceSha,'apps/srm/operation-integration.json')
 assert.equal(hash(older),a.previousReceiptSha256)
 const {pciReceiptIntegrityCompatibility:oldContinuation,...oldPreserved}=JSON.parse(pci)
 assert.deepEqual(oldPreserved,JSON.parse(older),'the previous PCI acceptance did not rewrite history')
 assert.deepEqual(Object.keys(c.applicationSourceDigests).sort(),[
  'scripts/native-execution-adoption.test.mjs','scripts/rural-location-release.test.mjs','scripts/xray-performance-adoption.test.mjs',
  'scripts/xray-workflow-contract.test.ts','src/server/peer-read-boundary.test.ts','src/server/supplier-location-geocoding-runtime.test.ts'
 ])
 for(const record of [a,c])for(const flag of ['runtimeChanged','authorizationChanged','sqlChanged','contractsChanged','businessDataChanged','runtimeDeploymentPerformed','paidAcquisitionsPerformed'])assert.equal(record[flag],false,flag)
 for(const[file,digest]of Object.entries(a.applicationSourceDigests)){
  const bytes=c.applicationSourceDigests[file]?readHistorical(c.previousPciSourceSha,'apps/srm/'+file):readCurrent('apps/srm/'+file)
  assert.equal(hash(bytes),digest,'original PCI SRM '+file)
 }
 for(const[file,digest]of Object.entries(c.applicationSourceDigests))assert.equal(hash(readCurrent('apps/srm/'+file)),digest,'current SRM '+file)
 const consumerBytes=readCurrent('apps/sg-runtime/operation-integration.json')
 assert.equal(hash(consumerBytes),a.currentSg2ReceiptSha256)
 const consumer=JSON.parse(consumerBytes)
 assert.equal(hash(JSON.stringify(consumer.pciLiveAcceptanceStabilization)),'bdb51cd9af2ebb03d508e2610d0a57d9aa28a070487ae5772d1cca03c2d233fb')
 const {pciMain800IntegrityCompatibility:sgContinuation,pciLiveAcceptanceStabilization:originalPci,...preservedConsumer}=consumer
 assert.deepEqual(preservedConsumer,JSON.parse(readHistorical(a.previousReceiptSourceSha,'apps/sg-runtime/operation-integration.json')))
 const expected={ '../sg-runtime/operation-integration.json':a.currentSg2ReceiptSha256 }
 for(const[file,digest]of Object.entries({...originalPci.applicationSourceDigests,...sgContinuation.applicationSourceDigests}))expected['../sg-runtime/'+file]=digest
 assert.deepEqual(a.consumerSourceDigests,expected,'exact accepted SG2 sources remain unchanged')
 for(const[file,digest]of Object.entries(a.consumerSourceDigests))assert.equal(hash(readCurrent(posix.normalize('apps/srm/'+file))),digest,'current consumer '+file)
}

test('PCI main801 continuation preserves both histories and rejects current or historical integrity manipulation',()=>{
 const snapshot='ee358a1f131e03e3a36fefd45d29c79a5770c55f'
 const receipt=JSON.parse(execFileSync('git',['show',snapshot+':apps/srm/operation-integration.json']))
 const current=file=>execFileSync('git',['show',snapshot+':'+file])
 const historical=(sha,file)=>execFileSync('git',['show',sha+':'+file])
 assertPciReceiptIntegrity(receipt,current,historical)
 for(const mutate of [
  r=>r.freshPreparedEvidenceRecovery.sourceArchiveLockPreserved=false,
  r=>r.pciReceiptIntegrityCompatibility.applicationSourceDigests['scripts/xray-workflow-contract.test.ts']='0'.repeat(64),
  r=>r.pciMain801IntegrityCompatibility.applicationSourceDigests['scripts/native-execution-adoption.test.mjs']='0'.repeat(64),
  r=>r.pciReceiptIntegrityCompatibility.consumerSourceDigests['../sg-runtime/operation-integration.json']='0'.repeat(64),
  r=>r.unapprovedReceipt={},
  r=>r.pciMain801IntegrityCompatibility.applicationSourceDigests['src/server/unapproved.ts']='0'.repeat(64)
 ]){const changed=structuredClone(receipt);mutate(changed);assert.throws(()=>assertPciReceiptIntegrity(changed,current,historical))}
 const first='apps/srm/scripts/native-execution-adoption.test.mjs'
 assert.throws(()=>assertPciReceiptIntegrity(receipt,file=>file===first?Buffer.concat([current(file),Buffer.from('\n// deliberate integrity fault')]):current(file),historical))
 assert.throws(()=>assertPciReceiptIntegrity(receipt,current,(sha,file)=>Buffer.concat([historical(sha,file),Buffer.from(' ')])))
})


export function assertFinalPciIntegrity(receipt, readCurrent, readHistorical) {
 const f=receipt.pciFinalIntegrationCompatibility
 assert.equal(f.taskId,'SRM-PCI798-FINAL-INTEGRITY-20261030')
 assert.equal(f.scope,'ADDITIVE_TEST_SOURCE_CONTINUITY_ONLY')
 assert.equal(f.targetEnvironment,'development')
 assert.equal(f.mainSourceSha,'3ba8c572882cd157f4370769772fdca5b785bc53')
 assert.equal(f.pciSourceSha,'ee358a1f131e03e3a36fefd45d29c79a5770c55f')
 const mainBytes=readHistorical(f.mainSourceSha,'apps/srm/operation-integration.json')
 const pciBytes=readHistorical(f.pciSourceSha,'apps/srm/operation-integration.json')
 assert.equal(hash(mainBytes),f.mainReceiptSha256)
 assert.equal(hash(pciBytes),f.pciReceiptSha256)
 const main=JSON.parse(mainBytes),pci=JSON.parse(pciBytes)
 const {pciFinalIntegrationCompatibility:final,pciReceiptIntegrityCompatibility:first,pciMain801IntegrityCompatibility:second,...preserved}=receipt
 assert.deepEqual(preserved,main,'all accepted main receipts, including CPU recovery, are immutable')
 assert.deepEqual(first,pci.pciReceiptIntegrityCompatibility,'first PCI continuation is immutable')
 assert.deepEqual(second,pci.pciMain801IntegrityCompatibility,'second PCI continuation is immutable')
 assert.deepEqual(Object.keys(f.applicationSourceDigests).sort(),[
  'scripts/native-execution-adoption.test.mjs','scripts/rural-location-release.test.mjs','scripts/xray-performance-adoption.test.mjs',
  'scripts/xray-workflow-contract.test.ts','src/server/peer-read-boundary.test.ts','src/server/supplier-location-geocoding-runtime.test.ts'
 ])
 for(const flag of ['runtimeChanged','authorizationChanged','sqlChanged','contractsChanged','businessDataChanged','runtimeDeploymentPerformed','paidAcquisitionsPerformed'])assert.equal(f[flag],false,flag)
 for(const[file,digest]of Object.entries(f.applicationSourceDigests))assert.equal(hash(readCurrent('apps/srm/'+file)),digest,'current approved test '+file)
 const acceptedPciSource=file=>f.applicationSourceDigests[posix.relative('apps/srm',file)]?readHistorical(f.pciSourceSha,file):readCurrent(file)
 assertPciReceiptIntegrity(pci,acceptedPciSource,readHistorical)
 for(const[file,digest]of Object.entries(main.freshProjectionCpuRecovery.applicationSourceDigests)){
  const path=posix.normalize('apps/srm/'+file)
  const bytes=f.applicationSourceDigests[file]?readHistorical(f.mainSourceSha,path):readCurrent(path)
  assert.equal(hash(bytes),digest,'accepted CPU recovery source '+file)
 }
}

test('final PCI integration preserves both accepted histories and rejects unapproved current-source changes',()=>{
 const snapshot='e15a0d8865a8e91812ad5d613c37059ef33b97dd'
 const receipt=JSON.parse(execFileSync('git',['show',snapshot+':apps/srm/operation-integration.json']))
 const current=file=>execFileSync('git',['show',snapshot+':'+file])
 const historical=(sha,file)=>execFileSync('git',['show',sha+':'+file])
 assertFinalPciIntegrity(receipt,current,historical)
 const faults=[
  r=>r.freshProjectionCpuRecovery.invocationOnlyFamilyPreparation=false,
  r=>r.pciReceiptIntegrityCompatibility.currentSg2ReceiptSha256='0'.repeat(64),
  r=>r.pciMain801IntegrityCompatibility.applicationSourceDigests['scripts/native-execution-adoption.test.mjs']='0'.repeat(64),
  r=>r.pciFinalIntegrationCompatibility.applicationSourceDigests['scripts/xray-performance-adoption.test.mjs']='0'.repeat(64),
  r=>r.pciFinalIntegrationCompatibility.applicationSourceDigests['src/server/unapproved.ts']='0'.repeat(64),
  r=>r.pciFinalIntegrationCompatibility.authorizationChanged=true,
  r=>r.pciFinalIntegrationCompatibility.taskId='UNAPPROVED',
  r=>r.unapprovedReceipt={}
 ]
 for(const mutate of faults){const changed=structuredClone(receipt);mutate(changed);assert.throws(()=>assertFinalPciIntegrity(changed,current,historical))}
 for(const path of ['apps/srm/scripts/xray-performance-adoption.test.mjs','apps/srm/src/server/financial-documents.ts','apps/sg-runtime/operation-integration.json']){
  assert.throws(()=>assertFinalPciIntegrity(receipt,file=>file===path?Buffer.concat([current(file),Buffer.from('\n// intentional integrity fault')]):current(file),historical))
 }
 assert.throws(()=>assertFinalPciIntegrity(receipt,current,(sha,file)=>Buffer.concat([historical(sha,file),Buffer.from(' ')])))
})


export function assertCurrentPciIntegrity(receipt,readCurrent,readHistorical){
 if(Object.hasOwn(receipt,'fullUiParityAdoption')){
  const a=receipt.fullUiParityAdoption,bytes=readHistorical(a.previousReceiptSourceSha,'apps/srm/operation-integration.json')
  assert.equal(a.taskId,'SRM-XRAY-FULL-UI-PARITY-B-20261031');assert.equal(a.projectKey,'SRM');assert.equal(a.targetEnvironment,'development');assert.equal(a.publicUi.version,'0.4.0')
  assert.equal(hash(bytes),a.previousReceiptDigest)
  const {fullUiParityAdoption,...preserved}=receipt,prior=JSON.parse(bytes)
  assert.deepEqual(preserved,prior,'All accepted FRESH receipts remain immutable after full UI adoption')
  for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(readCurrent(posix.normalize('apps/srm/'+file))),digest,'Current full UI '+file)
  for(const[file,digest]of Object.entries(a.unchangedDomainSourceDigests)){assert.equal(hash(readCurrent(file)),digest,file);assert.equal(hash(readHistorical(a.previousReceiptSourceSha,file)),digest,'Unchanged FRESH '+file)}
  for(const flag of ['financialEngineChanged','identityOrE1Changed','providerRoutingChanged','schemaChanged','productDeploymentPerformed'])assert.equal(a[flag],false,flag)
  const host=JSON.parse(readCurrent('apps/sg-runtime/operation-integration.json'));let precedingHost
  if(host.fullUiParityAdoption){
   const h=host.fullUiParityAdoption,previous=readHistorical(h.previousReceiptSourceSha,'apps/sg-runtime/operation-integration.json');assert.equal(hash(previous),h.previousReceiptDigest)
   const {fullUiParityAdoption,...preservedHost}=host;assert.deepEqual(preservedHost,JSON.parse(previous));precedingHost=previous
   for(const[file,digest]of Object.entries(h.applicationSourceDigests))assert.equal(hash(readCurrent(posix.normalize('apps/sg-runtime/'+file))),digest,'Current host '+file)
  }
  assertCurrentPciIntegrity(prior,file=>Object.hasOwn(a.applicationSourceDigests,posix.relative('apps/srm',file))?readHistorical(a.previousReceiptSourceSha,file):host.fullUiParityAdoption&&Object.hasOwn(host.fullUiParityAdoption.applicationSourceDigests,posix.relative('apps/sg-runtime',file))?readHistorical(host.fullUiParityAdoption.previousReceiptSourceSha,file):precedingHost&&file==='apps/sg-runtime/operation-integration.json'?precedingHost:readCurrent(file),readHistorical)
  return
 }

 if(Object.hasOwn(receipt,'supplierLocationCacheAdoption')){
  const a=receipt.supplierLocationCacheAdoption,bytes=readHistorical(a.previousReceiptSourceSha,'apps/srm/operation-integration.json')
  assert.equal(a.taskId,'SRM-XRAY-LOCATION-CACHE-20261031');assert.equal(a.scope,'EXISTING_ORGANISATION_LOCATIONS_AND_BOUNDED_GOOGLE_CACHE')
  assert.equal(a.targetEnvironment,'development');assert.equal(a.platformVersion,'1.32.3')
  assert.equal(a.previousReceiptSourceSha,'11e8da473716ea42dadd0f509b68b19cc9549ab3');assert.equal(hash(bytes),a.previousReceiptDigest)
  const {supplierLocationCacheAdoption,...preserved}=receipt,prior=JSON.parse(bytes);assert.deepEqual(preserved,prior,'Every previous receipt remains immutable')
  assert.deepEqual(Object.keys(a.applicationSourceDigests).sort(),["db/private-store/033-location-geocoding-cache.sql","deployment/supplier-location-cache-2026-10-31.json","scripts/corporate-source.integration.test.mjs","scripts/location-cache-maintenance.mjs","scripts/location-cache-maintenance.test.mjs","scripts/location-cache-release.mjs","scripts/location-cache-release.test.mjs","scripts/location-cache.integration.test.mjs","scripts/native-execution-adoption.test.mjs","scripts/request-quota-adoption.test.mjs","scripts/rural-location-release.test.mjs","scripts/supplier-locations.integration.test.mjs","scripts/xray-performance-adoption.test.mjs","scripts/xray-workflow-contract.test.ts","src/server/company-source-policy.test.ts","src/server/peer-read-boundary.test.ts","src/server/private-runtime.ts","src/server/supplier-location-geocoding-runtime.test.ts","src/server/supplier-location-geocoding-runtime.ts","src/server/supplier-location-geocoding.ts","src/server/supplier-location-telemetry.test.ts","src/server/supplier-location-telemetry.ts","src/server/supplier-locations.ts"])
  for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(readCurrent('apps/srm/'+file)),digest,'Current bounded location cache '+file)
  for(const key of ["existingLocationTableOnly", "organisationOwnershipAndVerifiedCreator", "sameCurrentClerkE1RlsSource", "googleCacheAtMost29Days", "independentPhysicalExpiryRequired", "manualCoordinatesRemainUserInput", "noOpSourceSyncSkipsWrites", "noFinancialCriticalPathDependency"])assert.equal(a[key],true,key)
  for(const key of ["cloudActivationClaimed", "liveMapAcceptanceClaimed", "paidProviderAcquisitionsPerformed", "sharedSdkChanged", "excludedEnvironmentChanges"])assert.equal(a[key],false,key)
  assertCurrentPciIntegrity(prior,file=>Object.hasOwn(a.applicationSourceDigests,posix.relative('apps/srm',file))?readHistorical(a.previousReceiptSourceSha,file):readCurrent(file),readHistorical)
  return
 }

 if(Object.hasOwn(receipt,'freshInventoryReuseRecovery')){
  const a=receipt.freshInventoryReuseRecovery,bytes=readHistorical(a.previousReceiptSourceSha,'apps/srm/operation-integration.json')
  assert.equal(a.taskId,'SRM-XRAY-FRESH-PERFORMANCE-RECOVERY-20261029')
  assert.equal(a.scope,'TRANSACTION_LOCAL_FINANCIAL_INVENTORY_REUSE_ONLY')
  assert.equal(a.targetEnvironment,'development');assert.equal(a.platformVersion,'1.32.3')
  assert.equal(a.previousReceiptSourceSha,'866f6f2588daddbe138e0ce94421455818fe4b23');assert.equal(hash(bytes),a.previousReceiptDigest)
  const {freshInventoryReuseRecovery,...preserved}=receipt,prior=JSON.parse(bytes);assert.deepEqual(preserved,prior,'Every prior receipt remains immutable')
  assert.deepEqual(Object.keys(a.applicationSourceDigests).sort(),["scripts/corporate-source.integration.test.mjs","scripts/native-execution-adoption.test.mjs","scripts/request-quota-adoption.test.mjs","scripts/rural-location-release.test.mjs","scripts/supplier-delegated-business.integration.test.mjs","scripts/xray-performance-adoption.test.mjs","scripts/xray-workflow-contract.test.ts","src/server/company-source-policy.test.ts","src/server/financial-documents.test.ts","src/server/financial-documents.ts","src/server/msr-repository.test.ts","src/server/msr-repository.ts","src/server/peer-read-boundary.test.ts","src/server/supplier-location-geocoding-runtime.test.ts","src/server/supplier-native-work-store.ts"])
  for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(readCurrent('apps/srm/'+file)),digest,'Current prepared inventory reuse '+file)
  for(const key of ['protectedWriterReceiptOnly','sameArchiveChecksumAndInventory','currentWorkAndClerkChecksPreserved','perActionScopeChecksPreserved','betterQualityFallbackPreserved','sourceAndProviderBoundsPreserved'])assert.equal(a[key],true,key)
  for(const key of ['authorizationChanged','sqlOrPolicyChanged','rolesOrAclChanged','routingOrUiChanged','sdkRuntimeChanged','excludedEnvironmentsChanged','runtimeDeploymentClaimed','livePerformanceThresholdsClaimed','paidAcquisitionsPerformed'])assert.equal(a[key],false,key)
  assertCurrentPciIntegrity(prior,file=>Object.hasOwn(a.applicationSourceDigests,posix.relative('apps/srm',file))?readHistorical(a.previousReceiptSourceSha,file):readCurrent(file),readHistorical)
  return
 }

 if(Object.hasOwn(receipt,'freshPayloadCaptureAdoption')){
  const a=receipt.freshPayloadCaptureAdoption,bytes=readHistorical(a.previousReceiptSourceSha,'apps/srm/operation-integration.json')
  assert.equal(a.taskId,'SRM-XRAY-FRESH-PERFORMANCE-RECOVERY-20261029');assert.equal(a.scope,'FINITE_INPUT_DATA_CAPTURE_ONLY')
  assert.equal(a.targetEnvironment,'development');assert.equal(a.platformVersion,'1.32.3')
  assert.equal(a.previousReceiptSourceSha,'38241dbcf593e0c58b3b1aed69457383fd5cc4f3');assert.equal(hash(bytes),a.previousReceiptDigest)
  assert.deepEqual(a.producer,{projectKey:'ARCHITECTURE',pullRequest:827,sourceSha:'9d44684b968ca3a067d414f7c450b6016ecc8d19',publishedMainSha:'38241dbcf593e0c58b3b1aed69457383fd5cc4f3',sourceGo:true,sourcePhrCommit:'f189d55371a38d1853be78e27aad1f804d66abac'})
  assert.equal(a.packageName,'@profitia/platform-payload-capture');assert.equal(a.packageVersion,'1.0.0');assert.equal(a.sdkPeer,'1.32.3')
  const {freshPayloadCaptureAdoption,...preserved}=receipt,prior=JSON.parse(bytes);assert.deepEqual(preserved,prior,'Every prior receipt is immutable')
  assert.deepEqual(Object.keys(a.applicationSourceDigests).sort(),["package-lock.json","package.json","scripts/corporate-source.integration.test.mjs","scripts/native-execution-adoption.test.mjs","scripts/request-quota-adoption.test.mjs","scripts/rural-location-release.test.mjs","scripts/xray-performance-adoption.test.mjs","scripts/xray-workflow-contract.test.ts","src/server/peer-read-boundary.test.ts","src/server/private-work-json.ts","src/server/supplier-location-geocoding-runtime.test.ts","src/server/supplier-native-work-store.ts","src/server/supplier-payload-capture.test.ts"])
  for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(readCurrent('apps/srm/'+file)),digest,'Current finite input capture '+file)
  for(const key of ['canonicalSdkDigestPreserved','currentWorkChecksPreserved','noAuthorizationCache','returnCaptureUnchanged','sourceAndProviderBoundsPreserved'])assert.equal(a[key],true,key)
  for(const key of ['sdkRuntimeChanged','sqlOrPolicyChanged','routingOrUiChanged','runtimeDeploymentClaimed','livePerformanceThresholdsClaimed','paidAcquisitionsPerformed','excludedEnvironmentsChanged'])assert.equal(a[key],false,key)
  const pkg=JSON.parse(readCurrent('apps/srm/package.json'))
  assert.equal(pkg.dependencies[a.packageName],'file:../../packages/platform-contracts/payload-capture')
  assert.equal(pkg.dependencies['@profitia/platform-contracts'],'file:../../packages/platform-contracts')
  assertCurrentPciIntegrity(prior,file=>Object.hasOwn(a.applicationSourceDigests,posix.relative('apps/srm',file))?readHistorical(a.previousReceiptSourceSha,file):readCurrent(file),readHistorical)
  return
 }

 if(Object.hasOwn(receipt,'freshDocumentPolicyRecovery')){
  const a=receipt.freshDocumentPolicyRecovery,bytes=readHistorical(a.previousReceiptSourceSha,'apps/srm/operation-integration.json')
  assert.equal(a.taskId,'SRM-XRAY-FRESH-PERFORMANCE-RECOVERY-20261029')
  assert.equal(a.scope,'OPTIONAL_DOCUMENT_POLICY_CANDIDATE_AND_TESTS_ONLY');assert.equal(a.targetEnvironment,'development')
  assert.equal(a.previousReceiptSourceSha,'9c568135948f9057c3ebbcab5da633cceafdec02');assert.equal(hash(bytes),a.previousReceiptDigest)
  const {freshDocumentPolicyRecovery,...preserved}=receipt,prior=JSON.parse(bytes);assert.deepEqual(preserved,prior,'Every prior receipt is immutable')
  assert.deepEqual(Object.keys(a.applicationSourceDigests).sort(),["db/private-store/032-document-statement-guard.sql","deployment/financial-document-statement-2026-10-31.json","scripts/corporate-source.integration.test.mjs","scripts/financial-document-statement-release.mjs","scripts/financial-document-statement-release.test.mjs","scripts/financial-document-statement.integration.test.mjs","scripts/native-execution-adoption.test.mjs","scripts/ready-report.integration.test.mjs","scripts/request-quota-adoption.test.mjs","scripts/rural-location-release.test.mjs","scripts/xray-performance-adoption.test.mjs","scripts/xray-workflow-contract.test.ts","src/server/peer-read-boundary.test.ts","src/server/supplier-location-geocoding-runtime.test.ts"])
  for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(readCurrent('apps/srm/'+file)),digest,'Current document policy candidate '+file)
  for(const key of ['fullNativeCheckPreserved','perRowOrganizationAndNipPreserved','legacyFallbackPreserved','rollbackTested'])assert.equal(a[key],true,key)
  for(const key of ['cloudActivationAuthorized','cloudActivationClaimed','runtimeChanged','rlsDisabled','rolesOrAclChanged','providerControlsChanged','excludedEnvironmentsChanged','livePerformanceThresholdsClaimed'])assert.equal(a[key],false,key)
  const plan=JSON.parse(readCurrent('apps/srm/deployment/financial-document-statement-2026-10-31.json'))
  assert.equal(plan.status,'PREPARED_NOT_AUTHORIZED_NOT_APPLIED');assert.equal(plan.targetServiceId,'srv-db1vu6gm7kps73d0e3r0');assert.equal(plan.policies.length,5)
  assert.equal(plan.migrationSha256,hash(readCurrent('apps/srm/db/private-store/032-document-statement-guard.sql')))
  assertCurrentPciIntegrity(prior,file=>Object.hasOwn(a.applicationSourceDigests,posix.relative('apps/srm',file))?readHistorical(a.previousReceiptSourceSha,file):readCurrent(file),readHistorical)
  return
 }

 if(Object.hasOwn(receipt,'freshDataCopyRecovery')){
  const a=receipt.freshDataCopyRecovery,bytes=readHistorical(a.previousReceiptSourceSha,'apps/srm/operation-integration.json')
  assert.equal(a.taskId,'SRM-XRAY-FRESH-PERFORMANCE-RECOVERY-20261029')
  assert.equal(a.scope,'IMMUTABLE_CORPORATE_PACKET_AND_CANONICAL_DOCUMENT_WIRE_ONLY')
  assert.equal(a.targetEnvironment,'development');assert.equal(a.platformVersion,'1.32.3')
  assert.equal(a.previousReceiptSourceSha,'a921dfc23d1e72ea10750993515fb6c41f0bd90b')
  assert.equal(hash(bytes),a.previousReceiptDigest)
  const {freshDataCopyRecovery,...preserved}=receipt,prior=JSON.parse(bytes)
  assert.deepEqual(preserved,prior,'Every accepted prior receipt remains unchanged')
  assert.deepEqual(Object.keys(a.applicationSourceDigests).sort(),["scripts/corporate-source.integration.test.mjs","scripts/native-execution-adoption.test.mjs","scripts/request-quota-adoption.test.mjs","scripts/rural-location-release.test.mjs","scripts/xray-performance-adoption.test.mjs","scripts/xray-workflow-contract.test.ts","src/server/corporate-source-store.test.ts","src/server/corporate-source-store.ts","src/server/financial-documents.test.ts","src/server/financial-documents.ts","src/server/peer-read-boundary.test.ts","src/server/supplier-location-geocoding-runtime.test.ts"])
  for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(readCurrent('apps/srm/'+file)),digest,'Current data-copy recovery '+file)
  for(const key of ['moduleOwnedImmutableDataOnly','canonicalDocumentChecksumVerified','revisionKeysByteCompatible','currentAuthorityAndRollbackPreserved','providerAndRoutingPreserved'])assert.equal(a[key],true,key)
  for(const key of ['authorizationChanged','rlsChanged','schemaChanged','providerPolicyChanged','uiChatMapsChanged','excludedEnvironmentsChanged','runtimeDeploymentClaimed','livePerformanceThresholdsClaimed'])assert.equal(a[key],false,key)
  assertCurrentPciIntegrity(prior,file=>Object.hasOwn(a.applicationSourceDigests,posix.relative('apps/srm',file))?readHistorical(a.previousReceiptSourceSha,file):readCurrent(file),readHistorical)
  return
 }

 if(Object.hasOwn(receipt,'freshCurrentBoundaryAdoption')){
  const a=receipt.freshCurrentBoundaryAdoption,bytes=readHistorical(a.previousReceiptSourceSha,'apps/srm/operation-integration.json')
  assert.equal(a.taskId,'SRM-XRAY-FRESH-PERFORMANCE-RECOVERY-20261029')
  assert.equal(a.scope,'CURRENT_FRESH_HUMAN_BOUNDARY_COMPOSITION_ONLY');assert.equal(a.targetEnvironment,'development')
  assert.equal(a.platformVersion,'1.32.3');assert.equal(a.producer.pullRequest,817);assert.equal(a.producer.projectKey,'ARCHITECTURE')
  assert.equal(a.producer.sourceGo,true,'Producer SOURCE GO is a required adoption gate')
  assert.equal(a.optionalPackage.name,'@profitia/platform-current-fresh-report');assert.equal(a.optionalPackage.version,'1.0.0')
  assert.deepEqual(a.contract,CURRENT_FRESH_REPORT_CONTRACT);assert.equal(hash(bytes),a.previousReceiptDigest)
  const {freshCurrentBoundaryAdoption,...preserved}=receipt,prior=JSON.parse(bytes)
  assert.deepEqual(preserved,prior,'All prior runtime, peer, Source, maps and consumer receipts remain unchanged')
  assert.deepEqual(Object.keys(a.applicationSourceDigests).sort(),['package-lock.json','package.json','scripts/native-execution-adoption.test.mjs','scripts/ready-report.integration.test.mjs','scripts/request-quota-adoption.test.mjs','scripts/rural-location-release.test.mjs','scripts/xray-performance-adoption.test.mjs','scripts/xray-workflow-contract.test.ts','src/server/fresh-report.ts','src/server/peer-read-boundary.test.ts','src/server/ready-report-read.ts','src/server/supplier-acquisition-http.ts','src/server/supplier-api-composition.ts','src/server/supplier-location-geocoding-runtime.test.ts','src/server/supplier-native-runtime.ts','src/server/supplier-request-host.ts'])
  for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(readCurrent('apps/srm/'+file)),digest,'Current FRESH application '+file)
  assert.deepEqual(Object.keys(a.producerSourceDigests).sort(),['package.json','src/current-fresh-report.d.mts','src/current-fresh-report.mjs'])
  for(const[file,digest]of Object.entries(a.producerSourceDigests)){
   const path='packages/platform-contracts/current-fresh-report/'+file
   assert.equal(hash(readHistorical(a.producer.sourceSha,path)),digest,'Reviewed producer '+file)
   assert.equal(hash(readCurrent(path)),digest,'Installed producer '+file)
  }
  for(const flag of ['samePreparedReader','currentRevocationPreserved','noAuthorizationDecisionCache','originalSourceAndWorkPreserved','ordinaryRlsPreserved','routingPreserved','sharedPrivateSeparationPreserved','immutableClerkIdentityOnlyWithinOpening'])assert.equal(a[flag],true,flag)
  for(const flag of ['sqlChanged','permissionsExpanded','providerPoliciesChanged','uiChatMapsChanged','stagingProductionPilotsChanged','runtimeDeploymentClaimed','livePerformanceThresholdsClaimed'])assert.equal(a[flag],false,flag)
  assert.deepEqual(a.humanCheckpointCounts,{previousFresh:5,currentFresh:4,ready:2,measurement:'LOCAL_ACTUAL_CANONICAL_TRANSACTIONS_NOT_LIVE_LATENCY'})
  assertCurrentPciIntegrity(prior,file=>Object.hasOwn(a.applicationSourceDigests,posix.relative('apps/srm',file))?readHistorical(a.previousReceiptSourceSha,file):readCurrent(file),readHistorical)
  return
 }
 if(Object.hasOwn(receipt,'bqlLiveAcceptanceIntegrityContinuation')){
  const a=receipt.bqlLiveAcceptanceIntegrityContinuation,bytes=readHistorical(a.previousReceiptSourceSha,'apps/srm/operation-integration.json')
  assert.equal(a.taskId,'SRM-BQL-LIVE-ACCEPTANCE-INTEGRITY-20261030');assert.equal(a.scope,'ADDITIVE_TEST_SOURCE_CONTINUITY_ONLY');assert.equal(a.targetEnvironment,'development')
  assert.equal(hash(bytes),a.previousReceiptSha256)
  const {bqlLiveAcceptanceIntegrityContinuation,...preserved}=receipt,prior=JSON.parse(bytes)
  assert.deepEqual(preserved,prior,'live BQL continuation preserves every historical SRM receipt including PR813')
  assert.deepEqual(Object.keys(a.applicationSourceDigests).sort(),['scripts/native-execution-adoption.test.mjs','scripts/rural-location-release.test.mjs','scripts/xray-performance-adoption.test.mjs','scripts/xray-workflow-contract.test.ts','src/server/peer-read-boundary.test.ts','src/server/supplier-location-geocoding-runtime.test.ts'])
  assert.deepEqual(Object.keys(a.consumerSourceDigests).sort(),Object.keys(prior.bqlPciIntegrityContinuation.consumerSourceDigests).sort(),'same exact consumer boundary, no new SRM runtime dependency')
  for(const[file,digest]of Object.entries({...a.applicationSourceDigests,...a.consumerSourceDigests}))assert.equal(hash(readCurrent(posix.normalize('apps/srm/'+file))),digest,'live BQL exact '+file)
  for(const flag of ['runtimeChanged','authorizationChanged','sqlChanged','contractsChanged','businessDataChanged','runtimeDeploymentPerformed','paidAcquisitionsPerformed'])assert.equal(a[flag],false,flag)
  assert.equal(hash(readHistorical(a.previousConsumerSourceSha,'apps/sg-runtime/operation-integration.json')),prior.bqlPciIntegrityContinuation.consumerSourceDigests['../sg-runtime/operation-integration.json'])
  assertCurrentPciIntegrity(prior,file=>Object.hasOwn(a.consumerSourceDigests,posix.relative('apps/srm',file))?readHistorical(a.previousConsumerSourceSha,file):Object.hasOwn(a.applicationSourceDigests,posix.relative('apps/srm',file))?readHistorical(a.previousReceiptSourceSha,file):readCurrent(file),readHistorical)
  return
 }
 if(Object.hasOwn(receipt,'freshResultCaptureRecovery')){
  const a=receipt.freshResultCaptureRecovery
  assert.equal(a.taskId,'SRM-XRAY-FRESH-PERFORMANCE-RECOVERY-20261029')
  assert.equal(a.scope,'REMOVE_UNUSED_RETURN_DATA_DIGESTS_ONLY')
  assert.equal(a.targetEnvironment,'development');assert.equal(a.platformVersion,'1.32.3')
  const bytes=readHistorical(a.previousReceiptSourceSha,'apps/srm/operation-integration.json')
  assert.equal(hash(bytes),a.previousReceiptDigest)
  const {freshResultCaptureRecovery,...preserved}=receipt,prior=JSON.parse(bytes)
  assert.deepEqual(preserved,prior,'Every existing receipt remains unchanged')
  assert.deepEqual(Object.keys(a.applicationSourceDigests).sort(),["scripts/diagnostic-telemetry-adoption.test.mjs","scripts/native-execution-adoption.test.mjs","scripts/rural-location-release.test.mjs","scripts/xray-performance-adoption.test.mjs","scripts/xray-workflow-contract.test.ts","src/server/peer-read-boundary.test.ts","src/server/private-work-json.test.ts","src/server/private-work-json.ts","src/server/supplier-location-geocoding-runtime.test.ts","src/server/supplier-native-work-store.ts"])
  for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(readCurrent(posix.normalize('apps/srm/'+file))),digest,'Current result capture '+file)
  for(const flag of ['requiredManifestDigestsPreserved','immutableReturnedDataPreserved','currentChecksPreserved'])assert.equal(a[flag],true,flag)
  for(const flag of ['authorizationChanged','contractsChanged','sqlChanged','providerPolicyChanged','runtimeDeploymentClaimed','livePerformanceThresholdsClaimed'])assert.equal(a[flag],false,flag)
  const original=file=>Object.hasOwn(a.applicationSourceDigests,posix.relative('apps/srm',file))?readHistorical(a.previousReceiptSourceSha,file):readCurrent(file)
  assertCurrentPciIntegrity(prior,original,readHistorical)
  return
 }

 if(Object.hasOwn(receipt,'bqlPciIntegrityContinuation')){
  const a=receipt.bqlPciIntegrityContinuation
  assert.equal(a.taskId,'SRM-BQL-PCI-SOURCE-INTEGRITY-20261030')
  assert.equal(a.scope,'ADDITIVE_TEST_SOURCE_CONTINUITY_ONLY')
  assert.equal(a.targetEnvironment,'development')
  const bytes=readHistorical(a.previousReceiptSourceSha,'apps/srm/operation-integration.json')
  assert.equal(hash(bytes),a.previousReceiptSha256)
  const {bqlPciIntegrityContinuation,...preserved}=receipt,prior=JSON.parse(bytes)
  assert.deepEqual(preserved,prior,'BQL continuation preserves all accepted SRM history')
  assert.deepEqual(Object.keys(a.applicationSourceDigests).sort(),['scripts/native-execution-adoption.test.mjs','scripts/rural-location-release.test.mjs','scripts/xray-performance-adoption.test.mjs','scripts/xray-workflow-contract.test.ts','src/server/peer-read-boundary.test.ts','src/server/supplier-location-geocoding-runtime.test.ts'])
  for(const[file,digest]of Object.entries({...a.applicationSourceDigests,...a.consumerSourceDigests}))assert.equal(hash(readCurrent(posix.normalize('apps/srm/'+file))),digest,'BQL exact current '+file)
  for(const flag of ['runtimeChanged','authorizationChanged','sqlChanged','contractsChanged','businessDataChanged','runtimeDeploymentPerformed','paidAcquisitionsPerformed'])assert.equal(a[flag],false,flag)
  assert.equal(hash(readHistorical(a.previousConsumerSourceSha,'apps/sg-runtime/operation-integration.json')),prior.pciReceiptIntegrityCompatibility.currentSg2ReceiptSha256)
  const original=file=>Object.hasOwn(a.consumerSourceDigests,posix.relative('apps/srm',file))?readHistorical(a.previousConsumerSourceSha,file):Object.hasOwn(a.applicationSourceDigests,posix.relative('apps/srm',file))?readHistorical(a.previousReceiptSourceSha,file):readCurrent(file)
  assertCurrentPciIntegrity(prior,original,readHistorical)
  return
 }

 if(Object.hasOwn(receipt,'mgbiRecordResponseBoundRecovery')){
  const a=receipt.mgbiRecordResponseBoundRecovery
  assert.equal(a.previousReceiptSourceSha,'850d9831ed321e25a051b982fbb2a52872e2b050')
  const priorBytes=readHistorical(a.previousReceiptSourceSha,'apps/srm/operation-integration.json')
  assert.equal(hash(priorBytes),a.previousReceiptDigest)
  const {mgbiRecordResponseBoundRecovery:continuation,...preserved}=receipt;const prior=JSON.parse(priorBytes)
  assert.deepEqual(preserved,prior,'all prior SRM and PCI acceptances remain unchanged')
  assert.equal(a.platformVersion,'1.32.3');assert.equal(a.maximumResponseBytes,2097152)
  for(const flag of ['mainMGBIOnly','finiteResponseBound','paidQuotaAndLicensingPreserved','sourceHistoryAndCountersPreserved'])assert.equal(a[flag],true,flag)
  for(const flag of ['serverAuthorityChecksChanged','paidRetriesAdded','uiOrRoutingChanged','runtimeDeploymentClaimed','cloudPolicyActivationClaimed','performanceThresholdsClaimed'])assert.equal(a[flag],false,flag)
  assert.deepEqual(Object.keys(a.applicationSourceDigests).sort(),["db/private-store/030-mgbi-record-response-bound.sql","deployment/mgbi-record-response-bound-2026-10-30.json","scripts/diagnostic-telemetry-adoption.test.mjs","scripts/native-execution-adoption.test.mjs","scripts/provider-source.integration.test.mjs","scripts/rural-location-release.test.mjs","scripts/xray-performance-adoption.test.mjs","scripts/xray-workflow-contract.test.ts","src/server/mgbi-response-bound.test.ts","src/server/mgbi-response-bound.ts","src/server/peer-read-boundary.test.ts","src/server/supplier-location-geocoding-runtime.test.ts","src/server/supplier-native-runtime.ts"])
  for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(readCurrent('apps/srm/'+file)),digest,'bounded MGBI current source '+file)
  const priorCurrent=file=>Object.hasOwn(a.applicationSourceDigests,file.replace(/^apps\/srm\//,''))?readHistorical(a.previousReceiptSourceSha,file):readCurrent(file)
  assertCurrentPciIntegrity(prior,priorCurrent,readHistorical);return
 }

 if(Object.hasOwn(receipt,'freshDocumentWriteReuseRecovery')){
  const a=receipt.freshDocumentWriteReuseRecovery
  assert.equal(a.previousReceiptSourceSha,'846a46113d7d0c6caf602c06eb214933347a5191')
  const priorBytes=readHistorical(a.previousReceiptSourceSha,'apps/srm/operation-integration.json')
  assert.equal(hash(priorBytes),a.previousReceiptDigest)
  const {freshDocumentWriteReuseRecovery:continuation,...preserved}=receipt
  const prior=JSON.parse(priorBytes)
  assert.deepEqual(preserved,prior,'the document reuse continuation preserves every prior receipt')
  assert.equal(a.platformVersion,'1.32.3')
  for(const flag of ['onceOnlyArchiveRowCapture','actualDocumentRowsReused','betterProjectionFallbackPreserved','boundedProviderResponseObservation'])assert.equal(a[flag],true,flag)
  for(const flag of ['serverAuthorityChecksChanged','sourcePoliciesChanged','paidRetriesAdded','uiOrRoutingChanged','runtimeDeploymentClaimed','performanceThresholdsClaimed'])assert.equal(a[flag],false,flag)
  assert.deepEqual(Object.keys(a.applicationSourceDigests).sort(),["scripts/corporate-source.integration.test.mjs","scripts/diagnostic-telemetry-adoption.test.mjs","scripts/native-execution-adoption.test.mjs","scripts/ready-report.integration.test.mjs","scripts/rural-location-release.test.mjs","scripts/xray-performance-adoption.test.mjs","scripts/xray-workflow-contract.test.ts","src/server/financial-documents.test.ts","src/server/financial-documents.ts","src/server/mgbi-archive.test.ts","src/server/mgbi-archive.ts","src/server/peer-read-boundary.test.ts","src/server/supplier-location-geocoding-runtime.test.ts","src/server/supplier-native-work-store.ts","src/server/supplier-telemetry.test.ts","src/server/supplier-telemetry.ts"])
  for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(readCurrent('apps/srm/'+file)),digest,'document reuse current source '+file)
  const priorCurrent=file=>Object.hasOwn(a.applicationSourceDigests,file.replace(/^apps\/srm\//,''))?readHistorical(a.previousReceiptSourceSha,file):readCurrent(file)
  assertCurrentPciIntegrity(prior,priorCurrent,readHistorical)
  return
 }

 const c=receipt.pciCurrentIntegrationCompatibility
 assert.equal(c.taskId,'SRM-PCI798-FINAL-SYNC-20261030')
 assert.equal(c.scope,'ADDITIVE_TEST_SOURCE_CONTINUITY_ONLY')
 assert.equal(c.targetEnvironment,'development')
 assert.equal(c.mainSourceSha,'9e0a6914590fc5904dcb084814fcb48e124054df')
 assert.equal(c.pciSourceSha,'e15a0d8865a8e91812ad5d613c37059ef33b97dd')
 const mainBytes=readHistorical(c.mainSourceSha,'apps/srm/operation-integration.json')
 const pciBytes=readHistorical(c.pciSourceSha,'apps/srm/operation-integration.json')
 assert.equal(hash(mainBytes),c.mainReceiptSha256)
 assert.equal(hash(pciBytes),c.pciReceiptSha256)
 const main=JSON.parse(mainBytes),pci=JSON.parse(pciBytes)
 const {pciCurrentIntegrationCompatibility:current,pciFinalIntegrationCompatibility:third,pciReceiptIntegrityCompatibility:first,pciMain801IntegrityCompatibility:second,...preserved}=receipt
 assert.deepEqual(preserved,main,'every accepted main receipt is immutable')
 assert.deepEqual(first,pci.pciReceiptIntegrityCompatibility)
 assert.deepEqual(second,pci.pciMain801IntegrityCompatibility)
 assert.deepEqual(third,pci.pciFinalIntegrationCompatibility)
 assert.deepEqual(Object.keys(c.applicationSourceDigests).sort(),[
  'scripts/native-execution-adoption.test.mjs','scripts/rural-location-release.test.mjs','scripts/xray-performance-adoption.test.mjs',
  'scripts/xray-workflow-contract.test.ts','src/server/peer-read-boundary.test.ts','src/server/supplier-location-geocoding-runtime.test.ts'
 ])
 for(const flag of ['runtimeChanged','authorizationChanged','sqlChanged','contractsChanged','businessDataChanged','runtimeDeploymentPerformed','paidAcquisitionsPerformed'])assert.equal(c[flag],false,flag)
 // Re-run the complete prior acceptance against exact prior bytes, never current replacements.
 assertFinalPciIntegrity(pci,file=>readHistorical(c.pciSourceSha,file),readHistorical)
 const expected={...main.freshProjectionCpuRecovery.applicationSourceDigests,...main.freshPersistedResultRecovery.applicationSourceDigests,...first.consumerSourceDigests,...c.applicationSourceDigests}
 for(const[file,digest]of Object.entries(expected))assert.equal(hash(readCurrent(posix.normalize('apps/srm/'+file))),digest,'exact current source '+file)
}

test('current PCI synchronization preserves all histories and rejects receipt, runtime, consumer and test manipulation',()=>{
 const receipt=JSON.parse(read('operation-integration.json'))
 const current=file=>fs.readFileSync(new URL('../../../'+file,import.meta.url))
 const historical=(sha,file)=>execFileSync('git',['show',sha+':'+file])
 assertCurrentPciIntegrity(receipt,current,historical)
 const faults=[
  r=>r.bqlPciIntegrityContinuation.consumerSourceDigests['../sg-runtime/operation-integration.json']='0'.repeat(64),
  r=>r.bqlPciIntegrityContinuation.applicationSourceDigests['scripts/xray-performance-adoption.test.mjs']='0'.repeat(64),
  r=>r.bqlPciIntegrityContinuation.runtimeChanged=true,
  r=>r.mgbiRecordResponseBoundRecovery.mainMGBIOnly=false,
  r=>r.mgbiRecordResponseBoundRecovery.maximumResponseBytes=33554432,
  r=>r.mgbiRecordResponseBoundRecovery.previousReceiptSourceSha='UNAPPROVED',
  r=>r.mgbiRecordResponseBoundRecovery.applicationSourceDigests['src/server/unapproved.ts']='0'.repeat(64),
  r=>r.freshDocumentWriteReuseRecovery.onceOnlyArchiveRowCapture=false,
  r=>r.freshDocumentWriteReuseRecovery.previousReceiptSourceSha='UNAPPROVED',
  r=>r.freshDocumentWriteReuseRecovery.previousReceiptDigest='0'.repeat(64),
  r=>r.freshDocumentWriteReuseRecovery.applicationSourceDigests['src/server/unapproved.ts']='0'.repeat(64),
  r=>r.freshPersistedResultRecovery.onlyAtomicInsertMayReuse=false,
  r=>r.pciReceiptIntegrityCompatibility.currentSg2ReceiptSha256='0'.repeat(64),
  r=>r.pciMain801IntegrityCompatibility.applicationSourceDigests['scripts/native-execution-adoption.test.mjs']='0'.repeat(64),
  r=>r.pciFinalIntegrationCompatibility.applicationSourceDigests['scripts/native-execution-adoption.test.mjs']='0'.repeat(64),
  r=>r.pciCurrentIntegrationCompatibility.applicationSourceDigests['scripts/xray-performance-adoption.test.mjs']='0'.repeat(64),
  r=>r.pciCurrentIntegrationCompatibility.applicationSourceDigests['src/server/unapproved.ts']='0'.repeat(64),
  r=>r.pciCurrentIntegrationCompatibility.authorizationChanged=true,
  r=>r.pciCurrentIntegrationCompatibility.mainSourceSha='UNAPPROVED',
  r=>r.pciCurrentIntegrationCompatibility.pciSourceSha='UNAPPROVED',
  r=>r.unapprovedReceipt={}
 ]
 for(const mutate of faults){const changed=structuredClone(receipt);mutate(changed);assert.throws(()=>assertCurrentPciIntegrity(changed,current,historical))}
 for(const path of ['apps/srm/scripts/xray-performance-adoption.test.mjs','apps/srm/src/server/corporate-source-store.ts','apps/srm/src/server/financial-documents.ts','apps/sg-runtime/operation-integration.json']){
  assert.throws(()=>assertCurrentPciIntegrity(receipt,file=>file===path?Buffer.concat([current(file),Buffer.from('\n// intentional integrity fault')]):current(file),historical))
 }
 assert.throws(()=>assertCurrentPciIntegrity(receipt,current,(sha,file)=>Buffer.concat([historical(sha,file),Buffer.from(' ')])))
})


test('unused return digest recovery preserves prior history and refuses source or receipt substitution',()=>{
 const receipt=JSON.parse(read('operation-integration.json'))
 const current=file=>fs.readFileSync(new URL('../../../'+file,import.meta.url))
 const historical=(sha,file)=>execFileSync('git',['show',sha+':'+file])
 assertCurrentPciIntegrity(receipt,current,historical)
 for(const mutate of [r=>r.freshResultCaptureRecovery.authorizationChanged=true,r=>r.freshResultCaptureRecovery.requiredManifestDigestsPreserved=false,r=>r.freshResultCaptureRecovery.applicationSourceDigests['src/server/unapproved.ts']='0'.repeat(64),r=>r.freshPerformanceRecovery.platformVersion='0.0.0']){
  const changed=structuredClone(receipt);mutate(changed);assert.throws(()=>assertCurrentPciIntegrity(changed,current,historical))
 }
 assert.throws(()=>assertCurrentPciIntegrity(receipt,file=>file==='apps/srm/src/server/private-work-json.ts'?Buffer.concat([current(file),Buffer.from(' ')]):current(file),historical))
})

test('live BQL integrity rejects changed current consumer, altered evidence and rewritten history',()=>{
 const receipt=JSON.parse(read('operation-integration.json')),current=file=>fs.readFileSync(new URL('../../../'+file,import.meta.url)),historical=(sha,file)=>execFileSync('git',['show',sha+':'+file])
 assertCurrentPciIntegrity(receipt,current,historical)
 const path='apps/sg-runtime/operation-integration.json'
 assert.throws(()=>assertCurrentPciIntegrity(receipt,file=>file===path?Buffer.concat([current(file),Buffer.from('tamper')]):current(file),historical))
 const altered=structuredClone(receipt);altered.bqlLiveAcceptanceIntegrityContinuation.consumerSourceDigests['../sg-runtime/operation-integration.json']='0'.repeat(64)
 assert.throws(()=>assertCurrentPciIntegrity(altered,current,historical))
 const prior=structuredClone(receipt);prior.bqlPciIntegrityContinuation.previousReceiptSha256='0'.repeat(64)
 assert.throws(()=>assertCurrentPciIntegrity(prior,current,historical))
})

test('current FRESH composition requires exact accepted producer, consumer closure and retained history',async()=>{
 const receipt=JSON.parse(read('operation-integration.json')),a=receipt.freshCurrentBoundaryAdoption
 const current=file=>fs.readFileSync(new URL('../../../'+file,import.meta.url)),historical=(sha,file)=>execFileSync('git',['show',sha+':'+file])
 assertCurrentPciIntegrity(receipt,current,historical)
 assert.equal(await currentFreshReportSourceDigest(),a.optionalPackage.sourceDigest)
 for(const mutate of [r=>r.freshCurrentBoundaryAdoption.producer.sourceGo=false,
  r=>r.freshCurrentBoundaryAdoption.noAuthorizationDecisionCache=false,
  r=>r.freshCurrentBoundaryAdoption.applicationSourceDigests['src/server/unapproved.ts']='0'.repeat(64),
  r=>r.freshCurrentBoundaryAdoption.producerSourceDigests['src/current-fresh-report.mjs']='0'.repeat(64),
  r=>r.freshCurrentBoundaryAdoption.permissionsExpanded=true,
  r=>r.freshPerformanceRecovery.platformVersion='0.0.0']){
  const changed=structuredClone(receipt);mutate(changed);assert.throws(()=>assertCurrentPciIntegrity(changed,current,historical))
 }
 for(const path of ['apps/srm/src/server/fresh-report.ts','packages/platform-contracts/current-fresh-report/src/current-fresh-report.mjs'])
  assert.throws(()=>assertCurrentPciIntegrity(receipt,file=>file===path?Buffer.concat([current(file),Buffer.from('\n// integrity fault')]):current(file),historical))
})

test('data-copy recovery refuses altered canonical readers, forged reuse guarantees and rewritten history',()=>{
 const receipt=JSON.parse(read('operation-integration.json'))
 const current=file=>fs.readFileSync(new URL('../../../'+file,import.meta.url)),historical=(sha,file)=>execFileSync('git',['show',sha+':'+file])
 assertCurrentPciIntegrity(receipt,current,historical)
 for(const mutate of [r=>r.freshDataCopyRecovery.canonicalDocumentChecksumVerified=false,
  r=>r.freshDataCopyRecovery.authorizationChanged=true,
  r=>r.freshDataCopyRecovery.applicationSourceDigests['src/server/unapproved.ts']='0'.repeat(64),
  r=>r.freshDataCopyRecovery.previousReceiptDigest='0'.repeat(64),
  r=>r.freshCurrentBoundaryAdoption.producer.sourceGo=false]){
  const altered=structuredClone(receipt);mutate(altered);assert.throws(()=>assertCurrentPciIntegrity(altered,current,historical))
 }
 for(const path of ['apps/srm/src/server/corporate-source-store.ts','apps/srm/src/server/financial-documents.ts'])
  assert.throws(()=>assertCurrentPciIntegrity(receipt,file=>file===path?Buffer.concat([current(file),Buffer.from('tamper')]):current(file),historical))
})


test('optional document statement policy requires exact tested candidate and cannot claim cloud activation',()=>{
 const receipt=JSON.parse(read('operation-integration.json')),current=file=>fs.readFileSync(new URL('../../../'+file,import.meta.url)),historical=(sha,file)=>execFileSync('git',['show',sha+':'+file]);
 assertCurrentPciIntegrity(receipt,current,historical);
 for(const mutate of [r=>r.freshDocumentPolicyRecovery.cloudActivationClaimed=true,r=>r.freshDocumentPolicyRecovery.fullNativeCheckPreserved=false,r=>r.freshDocumentPolicyRecovery.applicationSourceDigests['unapproved.sql']='0'.repeat(64),r=>r.freshDocumentPolicyRecovery.previousReceiptDigest='0'.repeat(64),r=>r.freshDataCopyRecovery.canonicalDocumentChecksumVerified=false]){const changed=structuredClone(receipt);mutate(changed);assert.throws(()=>assertCurrentPciIntegrity(changed,current,historical));}
 for(const file of ['apps/srm/db/private-store/032-document-statement-guard.sql','apps/srm/scripts/financial-document-statement-release.mjs'])assert.throws(()=>assertCurrentPciIntegrity(receipt,p=>p===file?Buffer.concat([current(p),Buffer.from('tamper')]):current(p),historical));
});


test('finite Supplier input capture accepts only its exact source and preserves every current and historical security check',async()=>{
 const receipt=JSON.parse(read('operation-integration.json')),a=receipt.freshPayloadCaptureAdoption
 const current=file=>fs.readFileSync(new URL('../../../'+file,import.meta.url)),historical=(sha,file)=>execFileSync('git',['show',sha+':'+file])
 assertCurrentPciIntegrity(receipt,current,historical)
 const root=new URL('../',import.meta.resolve('@profitia/platform-payload-capture'))
 assert.deepEqual(Object.keys(a.producerSourceDigests).sort(),['package.json','src/payload-capture.d.mts','src/payload-capture.mjs'])
 for(const[file,digest]of Object.entries(a.producerSourceDigests)){
  assert.equal(hash(historical(a.producer.sourceSha,'packages/platform-contracts/payload-capture/'+file)),digest,'producer '+file)
  assert.equal(hash(fs.readFileSync(new URL(file,root))),digest,'installed '+file)
 }
 const {createRequire}=await import('node:module'),{realpathSync}=await import('node:fs')
 const own=createRequire(import.meta.url),peer=createRequire(new URL('package.json',root))
 assert.equal(realpathSync(own.resolve('@profitia/platform-contracts/operation-context')),realpathSync(peer.resolve('@profitia/platform-contracts/operation-context')))
 assert.equal(JSON.parse(fs.readFileSync(new URL('package.json',new URL('../',import.meta.resolve('@profitia/platform-contracts/operation-context'))))).version,'1.32.3')
 for(const mutate of [r=>r.freshPayloadCaptureAdoption.producer.sourceGo=false,r=>r.freshPayloadCaptureAdoption.platformVersion='1.33.0',r=>r.freshPayloadCaptureAdoption.currentWorkChecksPreserved=false,r=>r.freshPayloadCaptureAdoption.applicationSourceDigests['src/server/unapproved.ts']='0'.repeat(64),r=>r.freshDocumentPolicyRecovery.fullNativeCheckPreserved=false,r=>r.unapprovedReceipt={}]){
  const changed=structuredClone(receipt);mutate(changed);assert.throws(()=>assertCurrentPciIntegrity(changed,current,historical))
 }
 for(const file of ['apps/srm/src/server/supplier-native-work-store.ts','apps/srm/src/server/private-work-json.ts','apps/srm/package-lock.json'])assert.throws(()=>assertCurrentPciIntegrity(receipt,p=>p===file?Buffer.concat([current(p),Buffer.from('tamper')]):current(p),historical))
})


test('transaction-local financial inventory adoption rejects changed guards, prior receipts and source substitution',()=>{
 const receipt=JSON.parse(read('operation-integration.json'))
 const current=file=>fs.readFileSync(new URL('../../../'+file,import.meta.url)),historical=(sha,file)=>execFileSync('git',['show',sha+':'+file])
 assertCurrentPciIntegrity(receipt,current,historical)
 for(const mutate of [r=>r.freshInventoryReuseRecovery.protectedWriterReceiptOnly=false,r=>r.freshInventoryReuseRecovery.currentWorkAndClerkChecksPreserved=false,r=>r.freshInventoryReuseRecovery.sqlOrPolicyChanged=true,r=>r.freshInventoryReuseRecovery.applicationSourceDigests['src/server/unapproved.ts']='0'.repeat(64),r=>r.freshPayloadCaptureAdoption.producer.sourceGo=false,r=>r.unapprovedReceipt={}]){
  const changed=structuredClone(receipt);mutate(changed);assert.throws(()=>assertCurrentPciIntegrity(changed,current,historical))
 }
 for(const file of ['apps/srm/src/server/financial-documents.ts','apps/srm/src/server/msr-repository.ts','apps/srm/src/server/supplier-native-work-store.ts'])assert.throws(()=>assertCurrentPciIntegrity(receipt,p=>p===file?Buffer.concat([current(p),Buffer.from('tamper')]):current(p),historical))
})


test('bounded location cache rejects changed ownership, retention, Source, history and source substitution',()=>{
 const receipt=JSON.parse(read('operation-integration.json'))
 const current=file=>fs.readFileSync(new URL('../../../'+file,import.meta.url)),historical=(sha,file)=>execFileSync('git',['show',sha+':'+file])
 assertCurrentPciIntegrity(receipt,current,historical)
 for(const mutate of [r=>r.supplierLocationCacheAdoption.organisationOwnershipAndVerifiedCreator=false,r=>r.supplierLocationCacheAdoption.googleCacheAtMost29Days=false,r=>r.supplierLocationCacheAdoption.independentPhysicalExpiryRequired=false,r=>r.supplierLocationCacheAdoption.cloudActivationClaimed=true,r=>r.freshInventoryReuseRecovery.protectedWriterReceiptOnly=false,r=>r.supplierLocationCacheAdoption.applicationSourceDigests['src/server/unaccepted.ts']='0'.repeat(64)]){
  const changed=structuredClone(receipt);mutate(changed);assert.throws(()=>assertCurrentPciIntegrity(changed,current,historical))
 }
 for(const file of ['apps/srm/src/server/supplier-location-geocoding.ts','apps/srm/db/private-store/033-location-geocoding-cache.sql','apps/srm/scripts/location-cache-maintenance.mjs'])assert.throws(()=>assertCurrentPciIntegrity(receipt,p=>p===file?Buffer.concat([current(p),Buffer.from('tamper')]):current(p),historical))
})
