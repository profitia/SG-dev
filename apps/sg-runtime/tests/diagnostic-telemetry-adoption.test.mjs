import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {posix} from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
const receipt=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url))),a=receipt.diagnosticTelemetryAdoption,current=(receipt.xrayPlatform130CiClosureCompatibility??receipt.xrayPlatform130SourceCompatibility)??a,fresh=receipt.freshPerformanceRecovery
const hash=value=>createHash('sha256').update(value).digest('hex')
test('diagnostic source adoption preserves complete history and verifies current producer/consumer bytes',async()=>{
 assert(a);assert.equal(a.taskId,'SG2-PILOT2-DIAGNOSTIC-SOURCE-COMPAT-20261026');assert.equal(a.platformVersion,'1.29.2');assert.equal(a.producer.pullRequest,738)
 const prior=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/sg-runtime/operation-integration.json'])
 assert.equal(hash(prior),a.previousReceiptDigest);for(const[k,v]of Object.entries(JSON.parse(prior)))assert.deepEqual(receipt[k],v,k)
 const root=new URL('../',import.meta.resolve('@profitia/platform-contracts/private-operation-host'))
 assert.equal(JSON.parse(fs.readFileSync(new URL('package.json',root))).version,(receipt.freshPostfetchCompatibility??receipt.sourceLeaseClockCompatibility??receipt.settledExternalFailureCompatibility??fresh).platformVersion)
 for(const file of ['../package-lock.json','../../dashboard-preview/package-lock.json'])
  assert.equal(JSON.parse(fs.readFileSync(new URL(file,import.meta.url))).packages['node_modules/@profitia/platform-contracts'].version,(receipt.freshPostfetchCompatibility??receipt.sourceLeaseClockCompatibility??receipt.settledExternalFailureCompatibility??fresh).platformVersion,file)
 for(const[file,digest]of Object.entries(a.sourceDigests)){
  assert.equal(hash(execFileSync('git',['show',a.producer.sourceSha+':packages/platform-contracts/'+file])),digest,'producer '+file)
  if(file.startsWith('src/')||file==='package.json')assert.equal(hash(fs.readFileSync(new URL(file,root))),receipt.freshPostfetchCompatibility?.sourceDigests[file]??receipt.sourceLeaseClockCompatibility?.sourceDigests[file]??receipt.settledExternalFailureCompatibility?.sourceDigests[file]??fresh.sourceDigests[file]??receipt.appshellXraySourceCompatibility.sourceDigests[file]??current.sourceDigests[file]??digest,'installed '+file)
 }
 const modules=['operation-context','private-operation-host','access-store','request-ledger','delegated-job','request-continuation','request-inspection','request-work','request-operations','external-call','supplier-location','report-admission','platform-ingestion','diagnostic-phase'],found=new Set()
 for(const module of modules){const sdk=await import('@profitia/platform-contracts/'+module);for(const[name,digest]of Object.entries(a.sdkDigests))if(typeof sdk[name]==='function'){assert.equal(await sdk[name](),receipt.freshPostfetchCompatibility?.sdkDigests[name]??receipt.sourceLeaseClockCompatibility?.sdkDigests[name]??receipt.settledExternalFailureCompatibility?.sdkDigests[name]??digest,name);found.add(name)}}
 assert.equal(found.size,Object.keys(a.sdkDigests).length);assert.equal(a.sdkDigests.operationSourceDigest,receipt.nativeSqlRoundtripAdoption.sdkDigests.operationSourceDigest)
 for(const[file,digest]of Object.entries(a.applicationSourceDigests)){
  const latest=receipt.appShellSourceCompatibility,adp=receipt.adpPresentationSourceCompatibility
  const journey=receipt.integratedBuyerJourneySourceCompatibility
  const historicalSha=latest.applicationSourceDigests[file]?latest.previousReceiptSourceSha:adp.applicationSourceDigests[file]?adp.previousReceiptSourceSha:journey.applicationSourceDigests[file]?journey.previousReceiptSourceSha:current.applicationSourceDigests[file]?current.previousReceiptSourceSha:receipt.appshellXraySourceCompatibility.applicationSourceDigests[file]?receipt.appshellXraySourceCompatibility.previousReceiptSourceSha:null
  const historical=historicalSha?execFileSync('git',['show',historicalSha+':'+posix.normalize('apps/sg-runtime/'+file)]):fs.readFileSync(new URL('../'+file,import.meta.url))
  assert.equal(hash(historical),digest,'preserved diagnostic receiver '+file)
  if(receipt.appshellXraySourceCompatibility.applicationSourceDigests[file]||journey.applicationSourceDigests[file]||adp.applicationSourceDigests[file]||latest.applicationSourceDigests[file])assert.equal(hash(fs.readFileSync(new URL('../'+file,import.meta.url))),receipt.bqlLiveAcceptanceCompatibility?.applicationSourceDigests[file]??receipt.bqlPciFirstSourceCompatibility?.applicationSourceDigests[file]??receipt.pciMain800IntegrityCompatibility?.applicationSourceDigests[file]??receipt.pciLiveAcceptanceStabilization?.applicationSourceDigests[file]??receipt.freshPostfetchCompatibility?.applicationSourceDigests[file]??receipt.sourceLeaseClockCompatibility?.applicationSourceDigests[file]??receipt.settledExternalFailureCompatibility?.applicationSourceDigests[file]??receipt.xraySearchBoundaryConsolidation?.applicationSourceDigests[file]??fresh.applicationSourceDigests[file]??receipt.appshellXraySourceCompatibility.applicationSourceDigests[file]??current.applicationSourceDigests[file]??journey.applicationSourceDigests[file]??adp.applicationSourceDigests[file]??receipt.assistantWidgetSourceCompatibility.applicationSourceDigests[file]??latest.applicationSourceDigests[file],'current AppShell receiver '+file)
 }
 for(const flag of ['executionContractChanged','authorityChecksChanged','workOrTransactionBoundariesChanged','sqlOrPolicyChanged','runtimeDeploymentPerformed'])assert.equal(a[flag],false,flag)
 assert.equal(a.observationOnly,true);assert.equal(a.deploymentActivationScope,'SRM_PILOT2_ONLY')
})
