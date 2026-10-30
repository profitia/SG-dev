import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {CURRENT_HUMAN_READ_CONTRACT,currentHumanReadSourceDigest} from '@profitia/platform-contracts/current-human-read'
const hash=v=>createHash('sha256').update(v).digest('hex')
test('SG2 accepts the verified peer reader without changing its backend or historical receipts',async()=>{
 const receipt=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url))),a=receipt.freshPerformanceRecovery
 const before=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/sg-runtime/operation-integration.json'])
 assert.equal(hash(before),a.previousReceiptDigest)
 for(const[k,v]of Object.entries(JSON.parse(before)))assert.deepEqual(receipt[k],v,k)
 assert.equal(a.producer.projectKey,'ARCHITECTURE');assert.equal(a.producer.pullRequest,784)
 assert.deepEqual(a.currentHumanReadContract,CURRENT_HUMAN_READ_CONTRACT)
 assert.equal(await currentHumanReadSourceDigest(),(receipt.sourceLeaseClockCompatibility?.sdkDigests.currentHumanReadSourceDigest??a.sdkDigests.currentHumanReadSourceDigest))
 assert.equal(a.backend,'existing shared SRM only');assert.equal(a.peerTransportContractVersion,'1.0.0')
 assert.equal(a.uiOrFinancialBackendChanged,false);assert.equal(a.runtimeDeploymentPerformed,false)
 const root=new URL('../',import.meta.resolve('@profitia/platform-contracts/current-human-read'))
 assert.equal(JSON.parse(fs.readFileSync(new URL('package.json',root))).version,(receipt.sourceLeaseClockCompatibility??receipt.settledExternalFailureCompatibility??a).platformVersion)
 for(const[file,digest]of Object.entries(a.sourceDigests)){
  assert.equal(hash(execFileSync('git',['show',a.producer.sourceSha+':packages/platform-contracts/'+file])),digest,'producer '+file)
  // npm excludes the producer's build lock from the installed package.
  if(file!=='package-lock.json')assert.equal(hash(fs.readFileSync(new URL(file,root))),receipt.sourceLeaseClockCompatibility?.sourceDigests[file]??receipt.settledExternalFailureCompatibility?.sourceDigests[file]??digest,'installed '+file)
 }
 assert.equal(a.publicUi.version,'0.3.1');assert.equal(a.publicUi.contractVersion,'1.0.0')
 const ui=createHash('sha256')
 for(const file of a.publicUi.sourceFiles)ui.update(file).update('\0').update(execFileSync('git',['show',a.publicUiProducer.sourceSha+':packages/srm-xray/'+file])).update('\0')
 assert.equal(ui.digest('hex'),a.publicUi.sourceDigest)
 assert.equal(a.publicUiProducer.projectKey,'SRM');assert.equal(a.browserTelemetryOnly,true)
})

test('SG2 accepts the exact settled-failure producer while retaining the existing shared SRM backend',async()=>{
 const receipt=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url))),a=receipt.settledExternalFailureCompatibility
 const previous=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/sg-runtime/operation-integration.json'])
 assert.equal(hash(previous),a.previousReceiptDigest)
 for(const[k,v]of Object.entries(JSON.parse(previous)))assert.deepEqual(receipt[k],v,k)
 const sdk=await import('@profitia/platform-contracts/external-call')
 assert.deepEqual(a.contract,sdk.EXTERNAL_CALL_FAILURE_OBSERVATION)
 assert.equal(await sdk.externalCallSourceDigest(),(receipt.sourceLeaseClockCompatibility?.sdkDigests.externalCallSourceDigest??a.sdkDigests.externalCallSourceDigest))
 const root=new URL('../../../packages/platform-contracts/',import.meta.url)
 assert.equal(JSON.parse(fs.readFileSync(new URL('package.json',root))).version,(receipt.sourceLeaseClockCompatibility??a).platformVersion)
 for(const[file,digest]of Object.entries(a.sourceDigests))assert.equal(hash(fs.readFileSync(new URL(file,root))),receipt.sourceLeaseClockCompatibility?.sourceDigests[file]??digest,file)
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(fs.readFileSync(new URL('../'+file,import.meta.url))),receipt.pciLiveAcceptanceStabilization?.applicationSourceDigests[file]??receipt.sourceLeaseClockCompatibility?.applicationSourceDigests[file]??digest,file)
 for(const flag of ['runtimeBehaviorChanged','financialBackendDuplicated','providerPoliciesChanged','runtimeDeploymentClaimed','performanceThresholdsClaimed'])assert.equal(a[flag],false,flag)
})

test('Source clock adoption preserves complete history and exact producer while retaining 30s bounds',async()=>{
 const receipt=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url))),a=receipt.sourceLeaseClockCompatibility
 const previous=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/sg-runtime/operation-integration.json'])
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
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(fs.readFileSync(new URL('../'+file,import.meta.url))),receipt.pciLiveAcceptanceStabilization?.applicationSourceDigests[file]??digest,file)
})
