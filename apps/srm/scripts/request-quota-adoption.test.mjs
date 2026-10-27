import test from 'node:test'
import {posix} from 'node:path'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {requestQuotaSchemaDigest} from '@profitia/platform-contracts/request-ledger'
import {REQUEST_QUOTA_ROOT_CONTRACT,operationSourceDigest} from '@profitia/platform-contracts/operation-context'
import {REQUEST_QUOTA_HOST_CONTRACT,privateOperationHostSourceDigest} from '@profitia/platform-contracts/private-operation-host'
const receipt=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url))),a=receipt.requestQuotaSourceCompatibility,hash=x=>createHash('sha256').update(x).digest('hex')
// These assertions verify pre-native receipts. If both later adoptions changed
// a path, use the earlier native predecessor; current diagnostic bytes are
// independently pinned by diagnostic-telemetry-adoption.test.mjs.
const beforeNative=path=>receipt.nativeSqlRoundtripAdoption.applicationSourceDigests[path]
 ?execFileSync('git',['show',receipt.nativeSqlRoundtripAdoption.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+path)])
 :receipt.diagnosticTelemetryAdoption.applicationSourceDigests[path]
 ?execFileSync('git',['show',receipt.diagnosticTelemetryAdoption.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+path)])
 :receipt.mgbiDevelopmentRecoveryAdoption?.applicationSourceDigests[path]
 ?execFileSync('git',['show',receipt.mgbiDevelopmentRecoveryAdoption.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+path)])
 :receipt.supplierMapStartupRepair?.applicationSourceDigests[path]
 ?execFileSync('git',['show',receipt.supplierMapStartupRepair.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+path)])
 :receipt.supplierMapRuntimeReadinessRepair?.applicationSourceDigests[path]
 ?execFileSync('git',['show',receipt.supplierMapRuntimeReadinessRepair.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+path)])
 :receipt.supplierMapAddressOnlyRepair?.applicationSourceDigests[path]
 ?execFileSync('git',['show',receipt.supplierMapAddressOnlyRepair.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+path)])
 :fs.readFileSync(new URL('../'+path,import.meta.url))
test('SRM explicitly adopts SQL027 and preserves all historical contracts, counts and human grants',async()=>{
 const prior=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(prior),a.previousReceiptDigest)
 for(const[k,v]of Object.entries(JSON.parse(prior)))assert.deepEqual(['contract','producer'].includes(k)?a.previousRootAcceptance[k]:receipt[k],v,k)
 assert.equal(a.platformVersion,'1.29.0');assert.equal(a.rootImplementation,REQUEST_QUOTA_ROOT_CONTRACT.implementation);assert.equal(a.hostVersion,REQUEST_QUOTA_HOST_CONTRACT.version)
 assert.equal(a.producer.projectKey,'ARCHITECTURE');assert.equal(a.producer.pullRequest,712);assert.equal(a.producer.taskId,'ARCHITECTURE-SRM-REQUEST-UNMETERED-20261025')
 assert.deepEqual(a.operations,['supplier.report.refresh','supplier.private.refresh']);assert.equal(a.quotaMode,'UNMETERED')
 assert.equal(await requestQuotaSchemaDigest(),a.schemaDigest);assert.equal(await operationSourceDigest(),a.sdkDigests.operationSourceDigest);assert.equal(await privateOperationHostSourceDigest(),receipt.diagnosticTelemetryAdoption.sdkDigests.privateOperationHostSourceDigest)
 for(const[path,digest]of Object.entries(a.sourceDigests)){
  assert.equal(hash(execFileSync('git',['show',a.producer.sourceSha+':packages/platform-contracts/'+path])),digest,path)
  assert.equal(hash(fs.readFileSync(new URL('../../../packages/platform-contracts/'+path,import.meta.url))),receipt.diagnosticTelemetryAdoption.sourceDigests[path]??receipt.nativeSqlRoundtripAdoption.sourceDigests[path]??digest,path)
 }
 for(const[path,digest]of Object.entries(a.applicationSourceDigests)){
  const repair=receipt.pilot2PrivateTransportParentRepair?.applicationSourceDigests[path]?receipt.pilot2PrivateTransportParentRepair
   :receipt.pilot2PrivateKysContinuityRepair?.applicationSourceDigests[path]?receipt.pilot2PrivateKysContinuityRepair:receipt.pilot2ProviderRoutingAdoption;
  const bytes=repair?.applicationSourceDigests[path]?execFileSync('git',['show',repair.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+path)]):beforeNative(path);
  assert.equal(hash(bytes),digest,path)
 }
 for(const flag of['runtimeDeployment','sql027Installed','policyCountersReset','humanGrantsChanged'])assert.equal(a[flag],false,flag)
})


test('private transport parent repair preserves the complete accepted quota receipt and pins every changed receiver',()=>{
 const repair=receipt.pilot2PrivateTransportParentRepair,prior=execFileSync('git',['show',repair.previousReceiptSourceSha+':apps/srm/operation-integration.json']);
 assert.equal(hash(prior),repair.previousReceiptDigest);
 for(const[k,v]of Object.entries(JSON.parse(prior)))assert.deepEqual(receipt[k],v,k);
 for(const[path,digest]of Object.entries(repair.applicationSourceDigests)){
  const latest=receipt.pilot2PrivateKysContinuityRepair?.applicationSourceDigests[path]?receipt.pilot2PrivateKysContinuityRepair:receipt.pilot2ProviderRoutingAdoption;
  const bytes=latest?.applicationSourceDigests[path]?execFileSync('git',['show',latest.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+path)]):beforeNative(path);
  assert.equal(hash(bytes),digest,path);
 }
 assert.equal(repair.nativePublicParentRequired,true);assert.equal(repair.requestQuotaDefinitionChanged,false);assert.equal(repair.humanEntitlementsChanged,false);assert.equal(repair.runtimeBehaviorChanged,false);
});
test('private KYS receiver correction retains all accepted contracts and pins current source without new human rights',()=>{
 const repair=receipt.pilot2PrivateKysContinuityRepair,prior=execFileSync('git',['show',repair.previousReceiptSourceSha+':apps/srm/operation-integration.json']);
 assert.equal(hash(prior),repair.previousReceiptDigest);
 for(const[k,v]of Object.entries(JSON.parse(prior)))assert.deepEqual(receipt[k],v,k);
 for(const[path,digest]of Object.entries(repair.applicationSourceDigests)){
  const next=receipt.pilot2PrivateKysValidityRepair;
  const bytes=next?.applicationSourceDigests[path]?execFileSync('git',['show',next.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+path)]):beforeNative(path);
  assert.equal(hash(bytes),digest,path);
 }
 assert.equal(repair.privateKysRetryMaximum,1);assert.equal(repair.reconciledFinancialReplaced,false);assert.equal(repair.humanEntitlementsChanged,false);
});
test('private KYS validity uses the existing current-read evidence without adding an authorization or changing quota contracts',()=>{
 const repair=receipt.pilot2PrivateKysValidityRepair,prior=execFileSync('git',['show',repair.previousReceiptSourceSha+':apps/srm/operation-integration.json']);
 assert.equal(hash(prior),repair.previousReceiptDigest);
 for(const[k,v]of Object.entries(JSON.parse(prior)))assert.deepEqual(receipt[k],v,k);
 for(const[path,digest]of Object.entries(repair.applicationSourceDigests)){
  const next=receipt.pilot2ProviderRoutingAdoption;
  const bytes=next?.applicationSourceDigests[path]?execFileSync('git',['show',next.previousReceiptSourceSha+':'+posix.normalize('apps/srm/'+path)]):beforeNative(path);
  assert.equal(hash(bytes),digest,path);
 }
 assert.equal(repair.companyAdmissionAuthorizesKys,false);assert.equal(repair.extendsPrivateRetention,false);assert.equal(repair.humanEntitlementsChanged,false);
});
test('PILOT2 provider selection preserves accepted E1 receipts, original provider engines and seven-day source freshness',()=>{
 const adoption=receipt.pilot2ProviderRoutingAdoption,prior=execFileSync('git',['show',adoption.previousReceiptSourceSha+':apps/srm/operation-integration.json']);
 assert.equal(hash(prior),adoption.previousReceiptDigest);
 for(const[k,v]of Object.entries(JSON.parse(prior)))assert.deepEqual(receipt[k],v,k);
 for(const[file,digest]of Object.entries(adoption.applicationSourceDigests)){
  const next=receipt.pilot2FinancialSinglePassAdoption;
  const bytes=next?.applicationSourceDigests[file]?execFileSync('git',['show',next.previousReceiptSourceSha+':apps/srm/'+file]):beforeNative(file);
  assert.equal(hash(bytes),digest,file);
 }
 assert.equal(adoption.taskId,'SRM-PILOT2-PROVIDER-SWITCH-20261026');
 for(const field of['sharedContractChanged','schemaChanged','humanEntitlementsChanged','sourceFreshnessRenewedBySwitch','kysAuthorizationChanged'])assert.equal(adoption[field],false,field);
 const target=JSON.parse(fs.readFileSync(new URL('../deployment/pilot2-human-targets.json',import.meta.url)));
 assert.equal(target.providerRouting.configurationKey,'SRM_PILOT2_REGISTRY_PROVIDER');
 assert.deepEqual(target.providerRouting.allowedValues,['MGBI','KRS']);assert.equal(target.providerRouting.defaultWhenUnset,'KRS');
 assert.equal(target.providerRouting.selectionAuthority,'SERVER_CONFIGURATION_ONLY');
});

test('PILOT2 single-pass Financial preserves historical contracts and changes no grants, quotas or other consumers',()=>{
 const adoption=receipt.pilot2FinancialSinglePassAdoption,prior=execFileSync('git',['show',adoption.previousReceiptSourceSha+':apps/srm/operation-integration.json']);
 assert.equal(hash(prior),adoption.previousReceiptDigest);
 for(const[k,v]of Object.entries(JSON.parse(prior)))assert.deepEqual(receipt[k],v,k);
 for(const[file,digest]of Object.entries(adoption.applicationSourceDigests))assert.equal(hash(beforeNative(file)),digest,file);
 assert.equal(adoption.executionPolicy,'COMPLETE_IN_REQUEST');assert.equal(adoption.maximumNewDownloadsPerPass,1);
 for(const flag of['sharedContractChanged','schemaChanged','humanEntitlementsChanged','licensedFileSafeguardsChanged','defaultConsumerPolicyChanged','sourceFreshnessRenewedOnRead'])assert.equal(adoption[flag],false,flag);
 const pilot=fs.readFileSync(new URL('../src/server/pilot2-cold-runtime.ts',import.meta.url),'utf8');
 assert.match(pilot,/prepareKrsFinancial\(input\(request,identity.identity.nip\),identity,recheck,general,'COMPLETE_IN_REQUEST'\)/);
});
