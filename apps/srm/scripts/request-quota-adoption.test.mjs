import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {requestQuotaSchemaDigest} from '@profitia/platform-contracts/request-ledger'
import {REQUEST_QUOTA_ROOT_CONTRACT,operationSourceDigest} from '@profitia/platform-contracts/operation-context'
import {REQUEST_QUOTA_HOST_CONTRACT,privateOperationHostSourceDigest} from '@profitia/platform-contracts/private-operation-host'
const receipt=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url))),a=receipt.requestQuotaSourceCompatibility,hash=x=>createHash('sha256').update(x).digest('hex')
test('SRM explicitly adopts SQL027 and preserves all historical contracts, counts and human grants',async()=>{
 const prior=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(prior),a.previousReceiptDigest)
 for(const[k,v]of Object.entries(JSON.parse(prior)))assert.deepEqual(['contract','producer'].includes(k)?a.previousRootAcceptance[k]:receipt[k],v,k)
 assert.equal(a.platformVersion,'1.29.0');assert.equal(a.rootImplementation,REQUEST_QUOTA_ROOT_CONTRACT.implementation);assert.equal(a.hostVersion,REQUEST_QUOTA_HOST_CONTRACT.version)
 assert.equal(a.producer.projectKey,'ARCHITECTURE');assert.equal(a.producer.pullRequest,712);assert.equal(a.producer.taskId,'ARCHITECTURE-SRM-REQUEST-UNMETERED-20261025')
 assert.deepEqual(a.operations,['supplier.report.refresh','supplier.private.refresh']);assert.equal(a.quotaMode,'UNMETERED')
 assert.equal(await requestQuotaSchemaDigest(),a.schemaDigest);assert.equal(await operationSourceDigest(),a.sdkDigests.operationSourceDigest);assert.equal(await privateOperationHostSourceDigest(),a.sdkDigests.privateOperationHostSourceDigest)
 for(const[path,digest]of Object.entries(a.sourceDigests)){
  assert.equal(hash(execFileSync('git',['show',a.producer.sourceSha+':packages/platform-contracts/'+path])),digest,path)
  assert.equal(hash(fs.readFileSync(new URL('../../../packages/platform-contracts/'+path,import.meta.url))),digest,path)
 }
 for(const[path,digest]of Object.entries(a.applicationSourceDigests)){
  const repair=receipt.pilot2PrivateTransportParentRepair;
  const bytes=repair?.applicationSourceDigests[path]?execFileSync('git',['show',repair.previousReceiptSourceSha+':apps/srm/'+path]):fs.readFileSync(new URL('../'+path,import.meta.url));
  assert.equal(hash(bytes),digest,path)
 }
 for(const flag of['runtimeDeployment','sql027Installed','policyCountersReset','humanGrantsChanged'])assert.equal(a[flag],false,flag)
})


test('private transport parent repair preserves the complete accepted quota receipt and pins every changed receiver',()=>{
 const repair=receipt.pilot2PrivateTransportParentRepair,prior=execFileSync('git',['show',repair.previousReceiptSourceSha+':apps/srm/operation-integration.json']);
 assert.equal(hash(prior),repair.previousReceiptDigest);
 for(const[k,v]of Object.entries(JSON.parse(prior)))assert.deepEqual(receipt[k],v,k);
 for(const[path,digest]of Object.entries(repair.applicationSourceDigests))assert.equal(hash(fs.readFileSync(new URL('../'+path,import.meta.url))),digest,path);
 assert.equal(repair.nativePublicParentRequired,true);assert.equal(repair.requestQuotaDefinitionChanged,false);assert.equal(repair.humanEntitlementsChanged,false);assert.equal(repair.runtimeBehaviorChanged,false);
});
