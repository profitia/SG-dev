import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {posix} from 'node:path'
import {CURRENT_HUMAN_READ_CONTRACT,currentHumanReadSourceDigest} from '@profitia/platform-contracts/current-human-read'
const hash=v=>createHash('sha256').update(v).digest('hex')
test('SG2 accepts the verified peer reader without changing its backend or historical receipts',async()=>{
 const receipt=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url))),a=receipt.freshPerformanceRecovery
 const before=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/sg-runtime/operation-integration.json'])
 assert.equal(hash(before),a.previousReceiptDigest)
 for(const[k,v]of Object.entries(JSON.parse(before)))assert.deepEqual(receipt[k],v,k)
 assert.equal(a.producer.projectKey,'ARCHITECTURE');assert.equal(a.producer.pullRequest,784)
 assert.deepEqual(a.currentHumanReadContract,CURRENT_HUMAN_READ_CONTRACT)
 assert.equal(await currentHumanReadSourceDigest(),(receipt.freshPostfetchCompatibility?.sdkDigests.currentHumanReadSourceDigest??receipt.sourceLeaseClockCompatibility?.sdkDigests.currentHumanReadSourceDigest??a.sdkDigests.currentHumanReadSourceDigest))
 assert.equal(a.backend,'existing shared SRM only');assert.equal(a.peerTransportContractVersion,'1.0.0')
 assert.equal(a.uiOrFinancialBackendChanged,false);assert.equal(a.runtimeDeploymentPerformed,false)
 const root=new URL('../',import.meta.resolve('@profitia/platform-contracts/current-human-read'))
 assert.equal(JSON.parse(fs.readFileSync(new URL('package.json',root))).version,(receipt.freshPostfetchCompatibility??receipt.sourceLeaseClockCompatibility??receipt.settledExternalFailureCompatibility??a).platformVersion)
 for(const[file,digest]of Object.entries(a.sourceDigests)){
  assert.equal(hash(execFileSync('git',['show',a.producer.sourceSha+':packages/platform-contracts/'+file])),digest,'producer '+file)
  // npm excludes the producer's build lock from the installed package.
  if(file!=='package-lock.json')assert.equal(hash(fs.readFileSync(new URL(file,root))),receipt.freshPostfetchCompatibility?.sourceDigests[file]??receipt.sourceLeaseClockCompatibility?.sourceDigests[file]??receipt.settledExternalFailureCompatibility?.sourceDigests[file]??digest,'installed '+file)
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
 assert.equal(await sdk.externalCallSourceDigest(),(receipt.freshPostfetchCompatibility?.sdkDigests.externalCallSourceDigest??receipt.sourceLeaseClockCompatibility?.sdkDigests.externalCallSourceDigest??a.sdkDigests.externalCallSourceDigest))
 const root=new URL('../../../packages/platform-contracts/',import.meta.url)
 assert.equal(JSON.parse(fs.readFileSync(new URL('package.json',root))).version,(receipt.freshPostfetchCompatibility??receipt.sourceLeaseClockCompatibility??a).platformVersion)
 for(const[file,digest]of Object.entries(a.sourceDigests))assert.equal(hash(fs.readFileSync(new URL(file,root))),receipt.freshPostfetchCompatibility?.sourceDigests[file]??receipt.sourceLeaseClockCompatibility?.sourceDigests[file]??digest,file)
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(fs.readFileSync(new URL('../'+file,import.meta.url))),receipt.pciMain800IntegrityCompatibility?.applicationSourceDigests[file]??receipt.pciLiveAcceptanceStabilization?.applicationSourceDigests[file]??receipt.freshPostfetchCompatibility?.applicationSourceDigests[file]??receipt.sourceLeaseClockCompatibility?.applicationSourceDigests[file]??digest,file)
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
 assert.equal(await sdk.externalCallSourceDigest(),receipt.freshPostfetchCompatibility?.sdkDigests.externalCallSourceDigest??a.sdkDigests.externalCallSourceDigest)
 for(const[file,digest]of Object.entries(a.sourceDigests)){
  assert.equal(hash(execFileSync('git',['show',a.producer.sourceSha+':packages/platform-contracts/'+file])),digest,'producer '+file)
  if(file!=='package-lock.json')assert.equal(hash(fs.readFileSync(new URL(file,root))),receipt.freshPostfetchCompatibility?.sourceDigests[file]??digest,'installed '+file)
 }
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(receipt.pciMain800IntegrityCompatibility?.applicationSourceDigests[file]??receipt.pciLiveAcceptanceStabilization?.applicationSourceDigests[file]??receipt.freshPostfetchCompatibility?.applicationSourceDigests[file]?execFileSync('git',['show',receipt.freshPostfetchCompatibility.previousReceiptSourceSha+':'+posix.normalize('apps/sg-runtime/'+file)]):fs.readFileSync(new URL('../'+file,import.meta.url))),digest,file)
})

test('SG2 explicitly accepts parallel current identity observations without a second financial backend',async()=>{
 const receipt=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url))),a=receipt.freshPostfetchCompatibility
 const previous=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/sg-runtime/operation-integration.json'])
 assert.equal(hash(previous),a.previousReceiptDigest)
 for(const[k,v]of Object.entries(JSON.parse(previous)))assert.deepEqual(receipt[k],v,k)
 assert.equal(a.producer.projectKey,'ARCHITECTURE');assert.equal(a.producer.pullRequest,797);assert.equal(a.platformVersion,'1.32.3')
 assert.equal(a.financialBackend,'existing shared SRM only');assert.equal(a.currentIdentityReadsParallel,true);assert.equal(a.durableAuthorizationCache,false)
 for(const flag of ['peerWireContractChanged','runtimeDeploymentClaimed','performanceThresholdsClaimed','uiOrRoutingChanged'])assert.equal(a[flag],false,flag)
 const sdk=await import('@profitia/platform-contracts/identity-provider'),root=new URL('../',import.meta.resolve('@profitia/platform-contracts/identity-provider'))
 assert.equal(await sdk.identitySourceDigest(),a.sdkDigests.identitySourceDigest);assert.equal(await currentHumanReadSourceDigest(),a.sdkDigests.currentHumanReadSourceDigest)
 for(const[file,digest]of Object.entries(a.sourceDigests)){
  assert.equal(hash(execFileSync('git',['show',a.producer.sourceSha+':packages/platform-contracts/'+file])),digest,'producer '+file)
  if(file!=='package-lock.json')assert.equal(hash(fs.readFileSync(new URL(file,root))),digest,'installed '+file)
 }
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(receipt.pciMain800IntegrityCompatibility?.applicationSourceDigests[file]?execFileSync('git',['show',receipt.pciMain800IntegrityCompatibility.mainSourceSha+':apps/sg-runtime/'+file]):fs.readFileSync(new URL('../'+file,import.meta.url))),digest,file)
})


export function assertPciMain800Integrity(receipt, readCurrent, readHistorical) {
 const a=receipt.pciMain800IntegrityCompatibility
 assert.equal(a.taskId,'SG2-PCI-LIVE-ACCEPTANCE-STABILIZATION-20261030')
 assert.equal(a.scope,'ADDITIVE_TEST_SOURCE_CONTINUITY_ONLY')
 assert.equal(a.mainSourceSha,'5c87c18192b405c907ca5575adc40a4cbb63d074')
 assert.equal(a.pciSourceSha,'0845c6cfe612aa02f3085fc0e23dd9905e8ff61b')
 const previous=readHistorical(a.mainSourceSha,'apps/sg-runtime/operation-integration.json')
 assert.equal(hash(previous),a.previousMainReceiptSha256)
 const original=JSON.parse(readHistorical(a.pciSourceSha,'apps/sg-runtime/operation-integration.json')).pciLiveAcceptanceStabilization
 assert.equal(hash(JSON.stringify(original)),'bdb51cd9af2ebb03d508e2610d0a57d9aa28a070487ae5772d1cca03c2d233fb')
 assert.deepEqual(receipt.pciLiveAcceptanceStabilization,original)
 const {pciMain800IntegrityCompatibility:continuation,pciLiveAcceptanceStabilization:pci,...preserved}=receipt
 assert.deepEqual(preserved,JSON.parse(previous),'every main800 receipt remains unchanged')
 assert.deepEqual(Object.keys(a.applicationSourceDigests).sort(),[
  'tests/adp-appshell-consumer.test.tsx','tests/category-operation.test.ts','tests/diagnostic-telemetry-adoption.test.mjs',
  'tests/identity-runtime.test.ts','tests/integrated-buyer-journey-package.test.mjs','tests/native-sql-roundtrips.test.mjs','tests/operation-context.test.mjs',
  'tests/porr-demo-middleware.test.ts','tests/self-service-account.test.ts','tests/xray-fresh-performance-adoption.test.mjs','tests/xray-gateway.test.ts'
 ])
 for(const flag of ['businessCodeChanged','calculationChanged','authorizationChanged','runtimeDeploymentPerformed'])assert.equal(a[flag],false,flag)
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(readCurrent('apps/sg-runtime/'+file)),digest,'current '+file)
 for(const[file,digest]of Object.entries(original.applicationSourceDigests)){
  const bytes=a.applicationSourceDigests[file]?readHistorical(a.pciSourceSha,'apps/sg-runtime/'+file):readCurrent('apps/sg-runtime/'+file)
  assert.equal(hash(bytes),digest,'original PCI '+file)
 }
 for(const[file,digest]of Object.entries(original.publicUiSourceDigests))assert.equal(hash(readCurrent(file)),digest,'unchanged PCI '+file)
}

test('PCI and main800 receipts retain exact historical sources and reject integrity manipulation',()=>{
 const receipt=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url)))
 const current=file=>fs.readFileSync(new URL('../../../'+file,import.meta.url))
 const historical=(sha,file)=>execFileSync('git',['show',sha+':'+file])
 assertPciMain800Integrity(receipt,current,historical)
 for(const mutate of [
  r=>r.freshPostfetchCompatibility.currentIdentityReadsParallel=false,
  r=>r.pciLiveAcceptanceStabilization.grantsChanged=true,
  r=>r.pciMain800IntegrityCompatibility.applicationSourceDigests['tests/category-operation.test.ts']='0'.repeat(64),
  r=>r.unapprovedReceipt={}
 ]){const changed=structuredClone(receipt);mutate(changed);assert.throws(()=>assertPciMain800Integrity(changed,current,historical))}
 const first='apps/sg-runtime/tests/category-operation.test.ts'
 assert.throws(()=>assertPciMain800Integrity(receipt,file=>file===first?Buffer.concat([current(file),Buffer.from('\n// deliberate integrity fault')]):current(file),historical))
 assert.throws(()=>assertPciMain800Integrity(receipt,current,(sha,file)=>Buffer.concat([historical(sha,file),Buffer.from(' ')])))
})
