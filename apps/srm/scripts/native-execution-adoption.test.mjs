import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
const receipt=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url))),a=receipt.nativeSqlRoundtripAdoption,current=receipt.xrayPerformanceRecoveryV2??receipt.diagnosticTelemetryAdoption??a
const hash=v=>createHash('sha256').update(v).digest('hex')
test('native SQL adoption preserves complete prior acceptance and pins the exact reviewed producer',async()=>{
 const bytes=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(bytes),a.previousReceiptDigest)
 for(const[k,v]of Object.entries(JSON.parse(bytes)))assert.deepEqual(receipt[k],v,k)
 assert.equal(a.platformVersion,'1.29.1');assert.equal(a.producer.projectKey,'ARCHITECTURE');assert.equal(a.producer.pullRequest,729)
 const root=new URL('../',import.meta.resolve('@profitia/platform-contracts/private-operation-host')),xray=receipt.appshellXraySourceCompatibility,fresh=receipt.freshPerformanceRecovery
 assert.equal(JSON.parse(fs.readFileSync(new URL('package.json',root))).version,(receipt.freshPostfetchRecovery??receipt.sourceLeaseClockRecovery??receipt.settledExternalFailureRecovery??fresh).platformVersion)
 for(const[file,digest]of Object.entries(a.sourceDigests)){
  assert.equal(hash(execFileSync('git',['show',a.producer.sourceSha+':packages/platform-contracts/'+file])),digest,file)
  if(file.startsWith('src/')||file==='package.json')assert.equal(hash(fs.readFileSync(new URL(file,root))),receipt.freshPostfetchRecovery?.sourceDigests[file]??receipt.sourceLeaseClockRecovery?.sourceDigests[file]??receipt.settledExternalFailureRecovery?.sourceDigests[file]??fresh.sourceDigests[file]??xray.sourceDigests[file]??current.sourceDigests[file]??digest,file)
 }
 const modules={'private-operation-host':'privateOperationHostSourceDigest','access-store':'accessStoreSourceDigest',
  'delegated-job':'delegatedJobSourceDigest','platform-ingestion':'platformIngestionSourceDigest','request-work':'requestWorkSourceDigest'}
 for(const[module,fn]of Object.entries(modules))assert.equal(await(await import('@profitia/platform-contracts/'+module))[fn](),(receipt.freshPostfetchRecovery?.sdkDigests[fn]??receipt.sourceLeaseClockRecovery?.sdkDigests[fn]??current.sdkDigests[fn]),fn)
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(fs.readFileSync(new URL('../'+file,import.meta.url))),receipt.pciMain801IntegrityCompatibility?.applicationSourceDigests[file]??receipt.pciReceiptIntegrityCompatibility?.consumerSourceDigests[file]??receipt.freshPreparedEvidenceRecovery?.applicationSourceDigests[file]??receipt.freshPostfetchRecovery?.applicationSourceDigests[file]??receipt.sourceLeaseClockRecovery?.applicationSourceDigests[file]??receipt.settledExternalFailureRecovery?.applicationSourceDigests[file]??receipt.freshRuntimeRefinement?.applicationSourceDigests[file]??fresh.applicationSourceDigests[file]??receipt.appshellReadyPeerRecovery?.applicationSourceDigests[file]??receipt.ruralLocationAddressRecovery?.applicationSourceDigests[file]??receipt.appshellXraySourceCompatibility.applicationSourceDigests[file]??receipt.xrayPerformanceRecoveryV2.consumerSourceDigests[file]??receipt.xrayPerformanceRecoveryV2.applicationSourceDigests[file]??receipt.readyCompanyMetadataCredentialReuse.applicationSourceDigests[file]??receipt.cachedReportE1Optimization.applicationSourceDigests[file]??receipt.companyAbsenceRoutingRepair.applicationSourceDigests[file]??receipt.stagingCompanyRoutingAdoption.applicationSourceDigests[file]??receipt.supplierMapGeocodingTransactionRepair?.applicationSourceDigests[file]??receipt.supplierMapGeocodingActivation?.applicationSourceDigests[file]??receipt.supplierMapAddressOnlyRepair?.applicationSourceDigests[file]??receipt.supplierMapRuntimeReadinessRepair?.applicationSourceDigests[file]??receipt.supplierMapStartupRepair?.applicationSourceDigests[file]??receipt.mgbiDevelopmentSessionFreshnessRepair?.applicationSourceDigests[file]??receipt.mgbiDevelopmentRecoveryAdoption?.applicationSourceDigests[file]??receipt.diagnosticTelemetryAdoption.applicationSourceDigests[file]??current.applicationSourceDigests[file]??digest,file)
 assert.equal(a.currentAuthorityCheckpointsPreserved,true);assert.equal(a.physicalAuditPreserved,true)
 for(const flag of ['humanGrantsChanged','quotasChanged','runtimeDeploymentPerformed'])assert.equal(a[flag],false,flag)
})
