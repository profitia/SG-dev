import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import {posix} from 'node:path'
import { OPERATION_CONTRACT, operationSourceDigest } from '@profitia/platform-contracts/operation-context'
import { operationSourceDigest as sourceDigest } from '../../../packages/platform-contracts/src/operation-context.mjs'
const receipt = JSON.parse(fs.readFileSync(new URL('../operation-integration.json', import.meta.url)))
test('explicit consumer binds exact implemented contract and installed/source digest without enabling live deployment', async () => {
  assert.equal(receipt.projectKey, 'SG2')
  assert.equal(receipt.scope, 'ISOLATED_OPERATION_INTEGRATION_ONLY')
  assert.equal(receipt.contract.id, OPERATION_CONTRACT.id)
  assert.equal(receipt.contract.version, OPERATION_CONTRACT.version)
  assert.equal(receipt.contract.implementation, OPERATION_CONTRACT.implementation)
  assert.equal(receipt.contract.sourceDigest, await operationSourceDigest())
  assert.equal(await operationSourceDigest(), await sourceDigest())
  assert.equal(receipt.liveRouteUsesContract, false)
  assert.equal(receipt.automaticProductDeployment, false)
  assert.equal(receipt.producer.projectKey, 'ARCHITECTURE')
  assert.match(receipt.producer.sourceSha, /^[a-f0-9]{40}$/)
  const source = createHash('sha256')
  for (const file of ['src/operation-context.mjs','src/operation-context.d.mts','src/request-operations.mjs','src/request-operations.d.mts','migrations/access/017-additional-request-operations.sql','src/supplier-location.mjs','src/supplier-location.d.mts','migrations/access/019-supplier-location-operations.sql']) source.update(execFileSync('git', ['show', receipt.producer.sourceSha + ':packages/platform-contracts/' + file]))
  assert.equal(source.digest('hex'), receipt.contract.sourceDigest, 'Recorded producer SHA must contain the exact accepted implementation')
})


test('candidate16 acceptance preserves the exact previous receipts and has no runtime grants or paid effect', async () => {
  const accepted=receipt.supplierLocationSourceCompatibility,current=receipt.platform125SourceCompatibility
  assert.equal(accepted.platformVersion,'1.24.0');assert.equal(accepted.rootImplementation,'1.0.0-candidate.16')
  assert.equal(current.previousRootAcceptance.producer.sourceSha,'88c3337d943fa3893f2f357bb11b78c565e50047')
  assert.equal(current.previousRootAcceptance.contract.sourceDigest,'9fe1ee707bb5510e66cbe9470ba970de177f8a6fe4533470f771af88d68bf728')
  const before=JSON.parse(execFileSync('git',['show',accepted.previousReceiptSourceSha+':apps/sg-runtime/operation-integration.json'],{encoding:'utf8'}))
  assert.deepEqual(accepted.previousRootAcceptance,{contract:before.contract,producer:before.producer})
  for(const[key,value]of Object.entries(before))assert.deepEqual(['contract','producer'].includes(key)?accepted.previousRootAcceptance[key]:receipt[key],value,key)
  assert.deepEqual(accepted.supportedOperations,{'supplier.location.read':'READ','supplier.location.write':'WRITE','supplier.location.sync':'REQUEST_COMPUTE','supplier.location.geocode':'REQUEST_EXTERNAL'})
  assert.equal(accepted.feature,'supplier_report');assert.equal(accepted.product,'SUPPLIER_INTELLIGENCE')
  assert.equal(accepted.defaultPaidGeocodingAllowance,0);assert.equal(accepted.organisationOwnsLocations,true);assert.equal(accepted.userAttributionDoesNotGrantOwnership,true)
  for(const flag of ['sql019Installed','defaultOperationGrantsAdded','supplierLocationRoutesActivated','organisationLocationPersistenceAdopted','paidGeocodingEnabled','runtimeRoleOrGrantChanged','productDeploymentPerformed'])assert.equal(accepted[flag],false,flag)
  assert.deepEqual(receipt.operations,before.operations,'Contract recognition never adds a runtime operation grant')
  const root=new URL('../../../packages/platform-contracts/',import.meta.url)
  for(const[path,digest]of Object.entries(accepted.sourceDigests)){
    assert.equal(createHash('sha256').update(execFileSync('git',['show',current.previousRootAcceptance.producer.sourceSha+':packages/platform-contracts/'+path])).digest('hex'),digest,path)
    assert.equal(createHash('sha256').update(execFileSync('git',['show',current.previousRootAcceptance.producer.sourceSha+':packages/platform-contracts/'+path])).digest('hex'),digest,path)
  }
  for(const[path,digest]of Object.entries(accepted.applicationSourceDigests))assert.equal(createHash('sha256').update(execFileSync('git',['show',current.previousReceiptSourceSha+':apps/sg-runtime/'+path])).digest('hex'),digest,path)
  for(const record of ['categoryShellAdoption','categoryIngressAdoption'])for(const[path,digest]of Object.entries(receipt[record].sourceDigests)){
    const previousBytes=execFileSync('git',['show',accepted.previousReceiptSourceSha+':apps/sg-runtime/'+path])
    assert.equal(createHash('sha256').update(previousBytes).digest('hex'),digest,record+':'+path)
  }
  const sdkModules={'operation-context':['operationSourceDigest'],'private-operation-host':['privateOperationHostSourceDigest'],'request-ledger':['requestLedgerSourceDigest','externalRequestSchemaDigest'],'delegated-job':['delegatedJobSourceDigest'],'request-continuation':['requestContinuationSourceDigest'],'request-inspection':['requestInspectionSourceDigest'],'request-work':['requestWorkSourceDigest'],'request-operations':['requestOperationsSourceDigest','additionalRequestSchemaDigest'],'external-call':['externalCallSourceDigest','publicWebTransportSchemaDigest'],'supplier-location':['supplierLocationSchemaDigest']}
  for(const[module,names]of Object.entries(sdkModules)){const sdk=await import('@profitia/platform-contracts/'+module);for(const name of names)assert.equal(await sdk[name](),receipt.diagnosticTelemetryAdoption.sdkDigests[name],name)}
  assert.equal(accepted.sdkDigests.supplierLocationSchemaDigest,'34ec633dbf38dfffd6b3954ae79b0ef6f771d75ad8f0443882be71ca78b084e5')
})


test('P1B accepts exact1.25 source while preserving all1.24 history and legacy defaults',async()=>{
 const accepted=receipt.platform125SourceCompatibility
 assert.equal(accepted.platformVersion,'1.25.0');assert.equal(accepted.rootImplementation,OPERATION_CONTRACT.implementation);assert.equal(accepted.defaultHostVersion,'1.11.0')
 assert.equal(receipt.accountRecheckSourceCompatibility.previousRootAcceptance.producer.sourceSha,'f35c82b6d9d39720c04b4df2c6f0042f5379982a')
 const previousBytes=execFileSync('git',['show',accepted.previousReceiptSourceSha+':apps/sg-runtime/operation-integration.json'])
 assert.equal(createHash('sha256').update(previousBytes).digest('hex'),accepted.previousReceiptSha256)
 const previous=JSON.parse(previousBytes)
 for(const[key,value]of Object.entries(previous))assert.deepEqual(['contract','producer'].includes(key)?accepted.previousRootAcceptance[key]:receipt[key],value,key)
 const root=new URL('../../../packages/platform-contracts/',import.meta.url)
 assert.equal(JSON.parse(fs.readFileSync(new URL('package.json',root))).version,receipt.diagnosticTelemetryAdoption.platformVersion)
 const host=await import('@profitia/platform-contracts/private-operation-host')
 assert.equal(host.PRIVATE_OPERATION_HOST_CONTRACT.version,'1.11.0');assert.equal(host.SUPPLIER_LOCATION_HOST_CONTRACT.version,'1.12.0')
 for(const[path,digest]of Object.entries(receipt.accountRecheckSourceCompatibility.sourceDigests))assert.equal(createHash('sha256').update(execFileSync('git',['show',receipt.accountRecheckSourceCompatibility.producer.sourceSha+':packages/platform-contracts/'+path])).digest('hex'),digest,'historical producer '+path)
 for(const[path,digest]of Object.entries({...receipt.accountRecheckSourceCompatibility.sourceDigests,...receipt.krsSoapSourceCompatibility.sourceDigests,...receipt.unmeteredSourceCompatibility.sourceDigests,...receipt.formReportSourceCompatibility.sourceDigests,...receipt.requestQuotaSourceCompatibility.sourceDigests,...receipt.nativeSqlRoundtripAdoption.sourceDigests,...receipt.diagnosticTelemetryAdoption.sourceDigests}))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(path,root))).digest('hex'),digest,path)
 for(const[path,digest]of Object.entries(receipt.accountRecheckSourceCompatibility.applicationSourceDigests))assert.equal(createHash('sha256').update(execFileSync('git',['show',receipt.krsSoapSourceCompatibility.previousReceiptSourceSha+':'+posix.normalize('apps/sg-runtime/'+path)])).digest('hex'),digest,'historical receiver '+path)
 for(const[path,digest]of Object.entries({...receipt.accountRecheckSourceCompatibility.applicationSourceDigests,...receipt.krsSoapSourceCompatibility.applicationSourceDigests,...receipt.assistantAvatarSourceCompatibility.applicationSourceDigests,...receipt.unmeteredSourceCompatibility.applicationSourceDigests,...receipt.formReportSourceCompatibility.applicationSourceDigests,...receipt.requestQuotaSourceCompatibility.applicationSourceDigests,...receipt.benchmarkPresentationSourceCompatibility.applicationSourceDigests,...receipt.nativeSqlRoundtripAdoption.applicationSourceDigests,...receipt.diagnosticTelemetryAdoption.applicationSourceDigests,...receipt.appShellSourceCompatibility.applicationSourceDigests,...receipt.assistantWidgetSourceCompatibility.applicationSourceDigests,...receipt.adpPresentationSourceCompatibility.applicationSourceDigests,...receipt.accountProofRenewalSourceCompatibility.applicationSourceDigests}))assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../'+path,import.meta.url))).digest('hex'),digest,path)
 for(const flag of['supplierLocationBusinessAdopted','locationAdmissionOptedIn','sql020Installed','liveGrantsChanged','productDeploymentPerformed'])assert.equal(accepted[flag],false,flag)
})


test('account revalidation compatibility preserves the complete historical receipt and leaves SG2 opt-in closed',async()=>{
 const a=receipt.accountRecheckSourceCompatibility,bytes=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/sg-runtime/operation-integration.json']);assert.equal(createHash('sha256').update(bytes).digest('hex'),a.previousReceiptSha256)
 for(const [key,value] of Object.entries(JSON.parse(bytes)))assert.deepEqual(['contract','producer'].includes(key)?a.previousRootAcceptance[key]:receipt[key],value,key)
 assert.equal(a.accountRevalidationOptedIn,false);assert.equal(a.liveGrantsChanged,false);assert.equal(a.productDeploymentPerformed,false)
 const host=await import('@profitia/platform-contracts/private-operation-host');assert.equal(host.PRIVATE_OPERATION_HOST_CONTRACT.version,'1.11.0');assert.equal(host.NATIVE_ACCOUNT_RECHECK_HOST_CONTRACT.version,'1.13.0')
})


test('optional SOAP source compatibility preserves all prior acceptance and activates no SG2 feature',()=>{
 const c=receipt.krsSoapSourceCompatibility,bytes=execFileSync('git',['show',c.previousReceiptSourceSha+':apps/sg-runtime/operation-integration.json'])
 assert.equal(createHash('sha256').update(bytes).digest('hex'),c.previousReceiptSha256)
 for(const[k,v]of Object.entries(JSON.parse(bytes)))assert.deepEqual(['contract','producer'].includes(k)?receipt.unmeteredSourceCompatibility.previousRootAcceptance[k]:receipt[k],v,k)
 for(const[file,digest]of Object.entries(c.sourceDigests))assert.equal(createHash('sha256').update(execFileSync('git',['show',c.producerSourceSha+':packages/platform-contracts/'+file])).digest('hex'),digest,file)
 for(const key of ['soapTransportAdopted','sql021Installed','krsOrGusAdopted','liveGrantsChanged','productDeploymentPerformed'])assert.equal(c[key],false,key)
})


test('explicit1.27 source compatibility preserves complete history and activates no SG2 unmetered provider',async()=>{
 const a=receipt.unmeteredSourceCompatibility,bytes=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/sg-runtime/operation-integration.json'])
 assert.equal(createHash('sha256').update(bytes).digest('hex'),a.previousReceiptSha256)
 for(const[k,v]of Object.entries(JSON.parse(bytes)))assert.deepEqual(['contract','producer'].includes(k)?a.previousRootAcceptance[k]:receipt[k],v,k)
 assert.equal(a.platformVersion,'1.27.0');assert.equal(a.unmeteredSourceOptedIn,false);assert.equal(a.sql024Installed,false);assert.equal(a.liveGrantsChanged,false);assert.equal(a.productDeploymentPerformed,false)
 for(const[file,digest]of Object.entries(a.sourceDigests))assert.equal(createHash('sha256').update(execFileSync('git',['show',a.producer.sourceSha+':packages/platform-contracts/'+file])).digest('hex'),digest,file)
 const m=await import('@profitia/platform-contracts/platform-ingestion');assert.equal(await m.unmeteredSourceSchemaDigest(),a.sdkDigests.unmeteredSourceSchemaDigest)
})


test('optional report-admission source recognition leaves SG2 human authorization and runtimes unchanged',async()=>{
 const a=receipt.formReportSourceCompatibility,bytes=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/sg-runtime/operation-integration.json']);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),a.previousReceiptSha256);
 for(const[k,v]of Object.entries(JSON.parse(bytes)))assert.deepEqual(['contract','producer'].includes(k)?a.previousRootAcceptance[k]:receipt[k],v,k);
 for(const[file,digest]of Object.entries(a.sourceDigests))assert.equal(createHash('sha256').update(execFileSync('git',['show',receipt.requestQuotaSourceCompatibility.previousReceiptSourceSha+':packages/platform-contracts/'+file])).digest('hex'),digest,file);
 for(const key of['reportAdmissionOptedIn','sql025Installed','liveGrantsChanged','productDeploymentPerformed'])assert.equal(a[key],false,key);
 assert.equal(a.defaultHumanReauthorizationPreserved,true);
});

test('SRM request-quota source extension preserves all SG2 history and keeps forecast and discovery opt-in closed',async()=>{
 const a=receipt.requestQuotaSourceCompatibility,bytes=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/sg-runtime/operation-integration.json'])
 assert.equal(createHash('sha256').update(bytes).digest('hex'),a.previousReceiptDigest)
 for(const[k,v]of Object.entries(JSON.parse(bytes)))assert.deepEqual(['contract','producer'].includes(k)?a.previousRootAcceptance[k]:receipt[k],v,k)
 for(const flag of ['requestQuotaOptIn','forecastQuotaChanged','sql027Installed','liveGrantsChanged','productDeploymentPerformed'])assert.equal(a[flag],false,flag)
 for(const[path,digest]of Object.entries(a.sourceDigests))assert.equal(createHash('sha256').update(execFileSync('git',['show',a.producer.sourceSha+':packages/platform-contracts/'+path])).digest('hex'),digest,path)
 const ledger=await import('@profitia/platform-contracts/request-ledger')
 assert.throws(()=>ledger.createRequestLedger({binding:{},schemaDigest:'a'.repeat(64),operation:'forecast.request',quotaSchemaDigest:a.sdkDigests.requestQuotaSchemaDigest}),TypeError)
 assert.throws(()=>ledger.createRequestLedger({binding:{},schemaDigest:'a'.repeat(64),operation:'benchmark.discovery.request',externalSchemaDigest:'a'.repeat(64),operationSchemaDigest:'b'.repeat(64),quotaSchemaDigest:a.sdkDigests.requestQuotaSchemaDigest}),TypeError)
})


test('Benchmark presentation renews the current receiver closure without rewriting acceptance or changing backend sources', () => {
  const current = receipt.benchmarkPresentationSourceCompatibility
  const beforeBytes = execFileSync('git', ['show', current.previousReceiptSourceSha + ':apps/sg-runtime/operation-integration.json'])
  assert.equal(createHash('sha256').update(beforeBytes).digest('hex'), current.previousReceiptSha256)
  for (const [key, value] of Object.entries(JSON.parse(beforeBytes))) assert.deepEqual(receipt[key], value, key)
  assert.equal(current.taskId, 'SG2-BENCHMARK-MAGICPATH-1TO1-20261025')
  assert.equal(current.scope, 'PRESENTATION_ONLY')
  assert.equal(current.targetEnvironment, 'development')
  for (const flag of ['apiContractChanged', 'providerRequestsChanged', 'forecastMathematicsChanged', 'operationGrantsChanged', 'schemaChanged', 'productDeploymentPerformed']) assert.equal(current[flag], false, flag)
  assert.equal(current.oilRestrictionPreserved, true)
  assert.equal(current.design.finderRevision, '463982323726172160')
  assert.equal(current.design.canonRevision, '464039002702499840')
  for (const [path, digest] of Object.entries(current.applicationSourceDigests)) {
    const bytes=receipt.nativeSqlRoundtripAdoption.applicationSourceDigests[path]
      ?execFileSync('git',['show',receipt.nativeSqlRoundtripAdoption.previousReceiptSourceSha+':apps/sg-runtime/'+path])
      :fs.readFileSync(new URL('../'+path,import.meta.url))
    const observed = createHash('sha256').update(bytes).digest('hex')
    assert.equal(observed, digest, path)
    assert.notEqual(createHash('sha256').update('changed-content').digest('hex'), digest, path)
  }
  const repository = new URL('../../../', import.meta.url)
  for (const path of current.unchangedSourceBoundaries) {
    const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', current.previousReceiptSourceSha, '--', path], { encoding: 'utf8', cwd: repository }).trim().split('\n').filter(Boolean)
    assert(paths.length > 0, path)
    const currentPaths = execFileSync('git', ['ls-files', '--', path], { encoding: 'utf8', cwd: repository }).trim().split('\n').filter(Boolean)
    const additions=receipt.appShellSourceCompatibility.addedBoundaryFiles.filter(file=>file.startsWith(path+'/'))
    assert.deepEqual(currentPaths, [...paths,...additions].sort(), 'Boundary inventory with explicit AppShell release record: ' + path)
    for(const file of additions)assert.equal(createHash('sha256').update(fs.readFileSync(new URL(file,repository))).digest('hex'),receipt.appShellSourceCompatibility.applicationSourceDigests[file.replace('apps/sg-runtime/','')],file)
    for (const file of paths) {
      // The later source-compatibility task adds only its CI test command.
      // The presentation acceptance still pins its complete prior package.
      const observed=['apps/sg-runtime/package.json','apps/sg-runtime/package-lock.json','apps/dashboard-preview/package-lock.json'].includes(file)
        ?execFileSync('git',['show',receipt.nativeSqlRoundtripAdoption.previousReceiptSourceSha+':'+file])
        :fs.readFileSync(new URL(file,repository))
      assert.deepEqual(observed,execFileSync('git',['show',current.previousReceiptSourceSha+':'+file]),'Unchanged protected source: '+file)
    }
  }
})
