import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import path from 'node:path'
import { OPERATION_CONTRACT, operationSourceDigest } from '@profitia/platform-contracts/operation-context'
import { operationSourceDigest as sourceDigest } from '../../../packages/platform-contracts/src/operation-context.mjs'
const receipt = JSON.parse(fs.readFileSync(new URL('../operation-integration.json', import.meta.url)))
test('explicit consumer binds exact implemented contract and installed/source digest without enabling live deployment', async () => {
  assert.equal(receipt.projectKey, 'SRM')
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
  const accepted=receipt.supplierLocationSourceCompatibility
  assert.equal(accepted.platformVersion,'1.24.0');assert.equal(accepted.rootImplementation,'1.0.0-candidate.16')
  assert.equal(receipt.p1ReceiverSourceCompatibility.previousRootAcceptance.producer.sourceSha,'88c3337d943fa3893f2f357bb11b78c565e50047')
  assert.equal(receipt.p1ReceiverSourceCompatibility.previousRootAcceptance.contract.sourceDigest,'9fe1ee707bb5510e66cbe9470ba970de177f8a6fe4533470f771af88d68bf728')
  const before=JSON.parse(execFileSync('git',['show',accepted.previousReceiptSourceSha+':apps/srm/operation-integration.json'],{encoding:'utf8'}))
  assert.deepEqual(accepted.previousRootAcceptance,{contract:before.contract,producer:before.producer})
  for(const[key,value]of Object.entries(before))assert.deepEqual(['contract','producer'].includes(key)?accepted.previousRootAcceptance[key]:receipt[key],value,key)
  assert.deepEqual(accepted.supportedOperations,{'supplier.location.read':'READ','supplier.location.write':'WRITE','supplier.location.sync':'REQUEST_COMPUTE','supplier.location.geocode':'REQUEST_EXTERNAL'})
  assert.equal(accepted.feature,'supplier_report');assert.equal(accepted.product,'SUPPLIER_INTELLIGENCE')
  assert.equal(accepted.defaultPaidGeocodingAllowance,0);assert.equal(accepted.organisationOwnsLocations,true);assert.equal(accepted.userAttributionDoesNotGrantOwnership,true)
  for(const flag of ['sql019Installed','defaultOperationGrantsAdded','supplierLocationRoutesActivated','organisationLocationPersistenceAdopted','paidGeocodingEnabled','runtimeRoleOrGrantChanged','productDeploymentPerformed'])assert.equal(accepted[flag],false,flag)
  assert.deepEqual(receipt.operations,before.operations,'Contract recognition never adds a runtime operation grant')
  const root=new URL('../../../packages/platform-contracts/',import.meta.url)
  for(const[path,digest]of Object.entries(accepted.sourceDigests)){
    assert.equal(createHash('sha256').update(execFileSync('git',['show',receipt.p1ReceiverSourceCompatibility.previousRootAcceptance.producer.sourceSha+':packages/platform-contracts/'+path])).digest('hex'),digest,path)
    assert.equal(createHash('sha256').update(execFileSync('git',['show',receipt.p1ReceiverSourceCompatibility.previousRootAcceptance.producer.sourceSha+':packages/platform-contracts/'+path])).digest('hex'),digest,path)
  }
  const sdkModules={'operation-context':['operationSourceDigest'],'private-operation-host':['privateOperationHostSourceDigest'],'request-ledger':['requestLedgerSourceDigest','externalRequestSchemaDigest'],'delegated-job':['delegatedJobSourceDigest'],'request-continuation':['requestContinuationSourceDigest'],'request-inspection':['requestInspectionSourceDigest'],'request-work':['requestWorkSourceDigest'],'request-operations':['requestOperationsSourceDigest','additionalRequestSchemaDigest'],'external-call':['externalCallSourceDigest','publicWebTransportSchemaDigest'],'supplier-location':['supplierLocationSchemaDigest']}
  for(const[module,names]of Object.entries(sdkModules)){const sdk=await import('@profitia/platform-contracts/'+module);for(const name of names)assert.equal(await sdk[name](),receipt.p1ReceiverSourceCompatibility.sdkDigests[name],name)}
  assert.equal(accepted.sdkDigests.supplierLocationSchemaDigest,'34ec633dbf38dfffd6b3954ae79b0ef6f771d75ad8f0443882be71ca78b084e5')
})


test('TASK02 historical source receipt remains exact and keeps live activation closed',async()=>{
 const current=receipt.supplierLocationFullStackAdoption
 assert.equal(current.taskId,'SRM-SUPPLIER-LOCATIONS-FULLSTACK-TASK02-20261021')
 assert.equal(current.rootDigest,receipt.p1ReceiverSourceCompatibility.previousRootAcceptance.contract.sourceDigest);assert.equal(current.environment,'development')
 assert.equal(current.defaultEnabled,false);assert.equal(current.sql019Installed,false);assert.equal(current.productDeploymentPerformed,false)
 assert.equal(current.paidGeocodingAllowance,0);assert.equal(current.liveGeocoding,'WAITING_OWNER')
 for(const[file,digest]of Object.entries(current.sourceDigests))assert.equal(createHash('sha256').update(execFileSync('git',['show',receipt.p1ReceiverSourceCompatibility.previousFullStackSourceSha+':'+path.posix.normalize('apps/srm/'+file)])).digest('hex'),digest,file)
 const before=JSON.parse(execFileSync('git',['show',current.previousAuthority+':apps/srm/operation-integration.json'],{encoding:'utf8'}))
 for(const[key,value]of Object.entries(before))assert.deepEqual(['contract','producer'].includes(key)?receipt.p1ReceiverSourceCompatibility.previousRootAcceptance[key]:receipt[key],value,key)
})
