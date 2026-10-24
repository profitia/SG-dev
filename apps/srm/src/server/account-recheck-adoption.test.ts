import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import acceptedReceipt from '../../operation-integration.json'
// Historical tests retain their original Root receipt; current acceptance is verified separately below.
const receipt={...acceptedReceipt,...acceptedReceipt.unmeteredSourceCompatibility.previousRootAcceptance}
import '../../scripts/task02r-release-source.test.mjs'
const historicalAcceptedReceipt={...acceptedReceipt,...acceptedReceipt.formReportAdmissionAdoption.previousRootAcceptance}
const hash=(value:Buffer)=>createHash('sha256').update(value).digest('hex')
test('native account revalidation preserves historical acceptance and pins the entire current receiver',()=>{
 const a=receipt.accountRecheckSourceCompatibility,root=path.resolve(process.cwd(),process.cwd().endsWith('/apps/srm')?'': 'apps/srm')
 const before=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(before),a.previousReceiptSha256)
 for(const [key,value]of Object.entries(JSON.parse(before.toString())))assert.deepEqual(['contract','producer'].includes(key)?a.previousRootAcceptance[key as 'contract'|'producer']:(receipt as Record<string,unknown>)[key],value,key)
 assert.equal(a.accountRevalidationOptedIn,true);assert.equal(a.totalTransactionTimeoutMs,15000);assert.equal(a.maximumAccountObservationMs,5000)
 assert.equal(a.liveGrantsChanged,false);assert.equal(a.productDeploymentPerformed,false)
 for(const [file,digest]of Object.entries(a.applicationSourceDigests)){
  const content=receipt.krsNipSourceCompatibility?execFileSync('git',['show',receipt.krsNipSourceCompatibility.previousSourceSha+':'+path.posix.normalize('apps/srm/'+file)]):fs.readFileSync(path.join(root,file));assert.equal(hash(content),digest,file)
 }
})

test('KRS NIP candidate accepts current owned sources without claiming live installation',()=>{
 const current=receipt.krsNipSourceCompatibility,root=path.resolve(process.cwd(),process.cwd().endsWith('/apps/srm')?'':'apps/srm')
 assert.equal(current.status,'CANDIDATE_ONLY_NOT_ACTIVATED');assert.equal(current.ceidgFirst,true);assert.equal(current.primaryTimeoutMs,3000)
 assert.equal(current.liveGrantsChanged,false);assert.equal(current.productDeploymentPerformed,false)
 for(const [file,digest]of Object.entries(current.applicationSourceDigests))assert.equal(hash(execFileSync('git',['show',receipt.krsNipActivationCompatibility.previousSourceSha+':'+path.posix.normalize('apps/srm/'+file)])),digest,file)
})

test('KRS activation preserves accepted receipts and pins registration with no supplier UPDATE',()=>{
 const a=receipt.krsNipActivationCompatibility,root=path.resolve(process.cwd(),process.cwd().endsWith('/apps/srm')?'':'apps/srm')
 const previous=execFileSync('git',['show',a.previousSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(previous),a.previousReceiptSha256)
 for(const [key,value]of Object.entries(JSON.parse(previous.toString())))assert.deepEqual((receipt as Record<string,unknown>)[key],value,key)
 assert.equal(a.existingSupplierRegistration,'KEEP');assert.equal(a.newRoleOrMapsPermissionsRequired,false)
 const next=receipt.organisationLocationAuthorityAdoption,nextDigests:Record<string,string>={...next.applicationSourceDigests,...receipt.organisationLocationBuildRecovery.applicationSourceDigests}
 const final=receipt.krsFinancialTelemetryCompatibility
 for(const [file,digest]of Object.entries(a.applicationSourceDigests)){
  if(nextDigests[file])assert.equal(hash(execFileSync('git',['show',next.previousReceiptSourceSha+':'+path.posix.normalize('apps/srm/'+file)])),digest,'historical '+file)
  assert.equal(hash(execFileSync('git',['show',final.previousSourceSha+':'+path.posix.normalize('apps/srm/'+file)])),nextDigests[file]??digest,file)
 }
})

test('Financial-only correction preserves every preceding acceptance and pins the complete telemetry receiver',()=>{
 const a=receipt.krsFinancialTelemetryCompatibility,root=path.resolve(process.cwd(),process.cwd().endsWith('/apps/srm')?'':'apps/srm')
 const previous=execFileSync('git',['show',a.previousSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(previous),a.previousReceiptSha256)
 for(const [key,value]of Object.entries(JSON.parse(previous.toString())))assert.deepEqual((receipt as Record<string,unknown>)[key],value,key)
 assert.equal(a.identityDecisionCacheIntroduced,false);assert.equal(a.transactionTimeoutMs,15000)
 assert.equal(a.originalCorporateSchemaChanged,false);assert.equal(a.financialOnlyPort,'profitia_srm_catalog.open_financial_publication(uuid,uuid,text)')
 for(const [file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(execFileSync('git',['show',receipt.organisationLocationEntryAdoption.previousReceiptSourceSha+':apps/srm/'+file])),digest,file)
})

test('bounded indicator reads retain the entire accepted receipt and add no new operation or grant',()=>{
 const a=receipt.boundedIndicatorReadAdoption
 const previous=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(previous),a.previousReceiptSha256)
 for(const [key,value]of Object.entries(JSON.parse(previous.toString())))assert.deepEqual((receipt as Record<string,unknown>)[key],value,key)
 assert.equal(a.unitId,'SRM_CACHE_READ');assert.equal(a.accessMode,'READ');assert.equal(a.maximumMetricsPerUnit,4)
 assert.equal(a.totalTransactionTimeoutMs,15000);assert.equal(a.publicationGuard,'CATALOG_ROW_XMIN_BEFORE_AND_AFTER_EACH_UNIT')
 assert.equal(a.liveGrantsChanged,false);assert.equal(a.productDeploymentPerformed,false)
 for(const [file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(execFileSync('git',['show',receipt.krsNipSourceCompatibility.preservedBoundedIndicatorSourceSha+':'+path.posix.normalize('apps/srm/'+file)])),digest,file)
})

test('location build recovery preserves accepted access and changes no product runtime source',()=>{
 const a=receipt.organisationLocationBuildRecovery,root=path.resolve(process.cwd(),process.cwd().endsWith('/apps/srm')?'':'apps/srm')
 const previous=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(previous),a.previousReceiptDigest)
 for(const[key,value]of Object.entries(JSON.parse(previous.toString())))assert.deepEqual((receipt as Record<string,unknown>)[key],value,key)
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(execFileSync('git',['show',receipt.krsFinancialTelemetryCompatibility.previousSourceSha+':apps/srm/'+file])),digest,file)
 assert.equal(a.productRuntimeChanged,false);assert.equal(a.databaseChanged,false)
 const file='src/server/supplier-locations.ts'
 assert.equal(hash(fs.readFileSync(path.join(root,file))),hash(execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/'+file])))
})

test('location Clerk entry preserves all accepted receipts and keeps existing E1 authority',()=>{
 const a=receipt.organisationLocationEntryAdoption,root=path.resolve(process.cwd(),process.cwd().endsWith('/apps/srm')?'':'apps/srm')
 const previous=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(previous),a.previousReceiptDigest)
 for(const[key,value]of Object.entries(JSON.parse(previous.toString())))assert.deepEqual((receipt as Record<string,unknown>)[key],value,key)
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(execFileSync('git',['show',receipt.organisationLocationRefreshAdoption.previousReceiptSourceSha+':apps/srm/'+file])),digest,file)
 assert.equal(a.databaseChanged,false);assert.equal(a.newGrantRequired,false);assert.equal(a.existingBackendE1BoundaryRetained,true)
})

test('map refresh preserves historical acceptance and keeps fresh E1 authorization on every poll',()=>{
 const a=receipt.organisationLocationRefreshAdoption,root=path.resolve(process.cwd(),process.cwd().endsWith('/apps/srm')?'':'apps/srm')
 const previous=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(previous),a.previousReceiptDigest)
 for(const[key,value]of Object.entries(JSON.parse(previous.toString())))assert.deepEqual((receipt as Record<string,unknown>)[key],value,key)
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(execFileSync('git',['show',receipt.krsGusFirstPublicationCompatibility.previousSourceSha+':apps/srm/'+file])),digest,file)
 assert.equal(a.authorizationReadCached,false);assert.equal(a.revocationClearsProjection,true);assert.equal(a.databaseChanged,false);assert.equal(a.newGrantRequired,false)
})

test('GUS-first correction preserves every accepted receipt and existing E1 limits and pins the complete receiver',()=>{
 const a=receipt.krsGusFirstPublicationCompatibility,root=path.resolve(process.cwd(),process.cwd().endsWith('/apps/srm')?'':'apps/srm')
 const before=execFileSync('git',['show',a.previousSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(before),a.previousReceiptSha256)
 for(const[key,value]of Object.entries(JSON.parse(before.toString())))assert.deepEqual((receipt as Record<string,unknown>)[key],value,key)
 assert.deepEqual(a.registryOrder,['GUS','KRS','CEIDG_ON_REGISTRY_ABSENCE'])
 assert.equal(a.identityDecisionCacheIntroduced,false);assert.equal(a.transactionTimeoutMs,15000)
 assert.equal(a.indicatorBatchLimitChanged,false);assert.equal(a.newRuntimeGrantsRequired,false)
 assert.equal(a.optionalScopeProjectionIsAuthorityCache,false);assert.equal(a.productDeploymentPerformed,false)
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(receipt.krsRegonReconciliationCompatibility?execFileSync('git',['show',receipt.krsRegonReconciliationCompatibility.previousSourceSha+':'+path.posix.normalize('apps/srm/'+file)]):fs.readFileSync(path.join(root,file))),digest,file)
})


test('REGON producer patch preserves all prior receipts and pins the complete SRM adoption',()=>{
 const a=receipt.krsRegonReconciliationCompatibility,root=path.resolve(process.cwd(),process.cwd().endsWith('/apps/srm')?'':'apps/srm')
 const before=execFileSync('git',['show',a.previousSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(before),a.previousReceiptSha256)
 for(const[key,value]of Object.entries(JSON.parse(before.toString())))assert.deepEqual((receipt as Record<string,unknown>)[key],value,key)
 const target=JSON.parse(receipt.krsContinuityCompatibility?execFileSync('git',['show',receipt.krsContinuityCompatibility.previousSourceSha+':apps/srm/deployment/krs-name-pilot-targets.json'],{encoding:'utf8'}):fs.readFileSync(path.join(root,'deployment/krs-name-pilot-targets.json'),'utf8'))
 assert.deepEqual(target.acceptedRuntime,a.acceptedRuntime);assert.equal(a.producerPr,655)
 assert.equal(a.originalKrsRegonPreserved,true);assert.equal(a.exactNipAndKrsRequired,true);assert.equal(a.processOwnedGusProofRequired,true)
 assert.equal(a.financialReconciliationChanged,false);assert.equal(a.fallbackChanged,false);assert.equal(a.e1Changed,false);assert.equal(a.newRuntimeGrantsRequired,false)
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(receipt.krsContinuityCompatibility?execFileSync('git',['show',receipt.krsContinuityCompatibility.previousSourceSha+':'+path.posix.normalize('apps/srm/'+file)]):fs.readFileSync(path.join(root,file))),digest,file)
})


test('official predecessor continuity preserves historical receipts and pins the complete receiver',()=>{
 const a=receipt.krsContinuityCompatibility,root=path.resolve(process.cwd(),process.cwd().endsWith('/apps/srm')?'':'apps/srm')
 const before=execFileSync('git',['show',a.previousSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(before),a.previousReceiptSha256)
 for(const[key,value]of Object.entries(JSON.parse(before.toString())))assert.deepEqual((receipt as Record<string,unknown>)[key],value,key)
 const target=JSON.parse(execFileSync('git',['show',acceptedReceipt.unmeteredSourceCompatibility.previousReceiptSourceSha+':apps/srm/deployment/krs-name-pilot-targets.json'],{encoding:'utf8'}))
 assert.deepEqual(target.acceptedRuntime,a.acceptedRuntime);assert.equal(a.producerPr,658)
 assert.equal(a.existingContinuityVersion,'KRS_CONTINUITY_V1');assert.equal(a.explicitTransformationProofRequired,true);assert.equal(a.originalDocumentIssuerPreserved,true)
 assert.equal(a.newRuntimeGrantsRequired,false);assert.equal(a.authorizationDecisionCacheIntroduced,false);assert.equal(a.primaryDeadlineChanged,false)
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(execFileSync('git',['show',acceptedReceipt.unmeteredSourceCompatibility.previousReceiptSourceSha+':'+path.posix.normalize('apps/srm/'+file)])),digest,file)
})


test('explicit unmetered GUS/KRS acceptance retains every historical receipt and paid limits',()=>{
 const a=acceptedReceipt.unmeteredSourceCompatibility,bytes=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(bytes),a.previousReceiptSha256)
 for(const[k,v]of Object.entries(JSON.parse(bytes.toString())))assert.deepEqual(['contract','producer'].includes(k)?a.previousRootAcceptance[k as 'contract'|'producer']:(acceptedReceipt as Record<string,unknown>)[k],v,k)
 assert.equal(a.platformVersion,'1.27.0');assert.equal(a.unmeteredSourceOptedIn,true);assert.equal(a.liveGrantsChanged,false);assert.equal(a.mgbiPaidPoliciesChanged,false);assert.equal(a.productDeploymentPerformed,false)
 const root=path.resolve(process.cwd(),process.cwd().endsWith('/apps/srm')?'':'apps/srm')
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(execFileSync('git',['show',acceptedReceipt.krsCatalogRefreshCompatibility.previousSourceSha+':'+path.posix.normalize('apps/srm/'+file)])),digest,file)
})

test('catalog refresh adoption preserves unmetered acceptance and records the exact corrected caller',()=>{
 const a=acceptedReceipt.krsCatalogRefreshCompatibility,bytes=execFileSync('git',['show',a.previousSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(bytes),a.previousReceiptSha256)
 for(const[k,v]of Object.entries(JSON.parse(bytes.toString())))assert.deepEqual((historicalAcceptedReceipt as Record<string,unknown>)[k],v,k)
 assert.equal(a.identityFreshnessPolicyChanged,false);assert.equal(a.liveGrantsChanged,false);assert.equal(a.paidProviderPoliciesChanged,false)
 const root=path.resolve(process.cwd(),process.cwd().endsWith('/apps/srm')?'':'apps/srm')
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(execFileSync('git',['show',acceptedReceipt.financialPerformanceAdoption.previousSourceSha+':'+path.posix.normalize('apps/srm/'+file)])),digest,file)
})

test('financial performance adoption preserves history and pins exact batch guards without claiming live activation',()=>{
 const a=acceptedReceipt.financialPerformanceAdoption
 assert.equal(a.taskId,'SRM-E1-FINANCIAL-PERFORMANCE-20261024')
 const previous=JSON.parse(execFileSync('git',['show',a.previousSourceSha+':apps/srm/operation-integration.json'],{encoding:'utf8'}))
 for(const[k,v]of Object.entries(previous))assert.deepEqual((historicalAcceptedReceipt as Record<string,unknown>)[k],v,k)
 const root=path.resolve(process.cwd(),process.cwd().endsWith('/apps/srm')?'':'apps/srm')
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(acceptedReceipt.clerkCheckpointAdoption?execFileSync('git',['show',acceptedReceipt.clerkCheckpointAdoption.previousSourceSha+':apps/srm/'+file]):fs.readFileSync(path.join(root,file))),digest,file)
 for(const[file,digest]of Object.entries(a.optionalSqlDigests))assert.equal(hash(fs.readFileSync(path.join(root,'db/private-store',file))),digest,file)
 for(const key of ['perStatementCurrentAuthority','setBasedExactPacketValidation','identicalRevisionReceiptReplay','noPermissionTtlCache','requestLocalInflightIdentityCoalescing'] as const)assert.equal(a[key],true,key)
 assert.equal(a.liveSqlInstalled,false);assert.equal(a.pilotDeployed,false)
})

test('Clerk checkpoint adoption preserves prior receipts and current Native Work security without an authority cache',()=>{
 const a=acceptedReceipt.clerkCheckpointAdoption;
 const previous=execFileSync('git',['show',a.previousSourceSha+':apps/srm/operation-integration.json']);assert.equal(hash(previous),a.previousReceiptSha256);
 for(const[k,v]of Object.entries(JSON.parse(previous.toString())))assert.deepEqual((historicalAcceptedReceipt as Record<string,unknown>)[k],v,k);
 assert.equal(a.taskId,'SRM-CLERK-CHECKPOINT-CORRECTION-20261024');assert.equal(a.producerPr,672);
 for(const key of ['companyEvidenceIsAuthority','identityDecisionCacheIntroduced','sharedIdentitySourceChanged','newUserGrantsRequired','paidProviderPoliciesChanged','liveDeployed'] as const)assert.equal(a[key],false,key);
 assert.equal(a.nativeAccountBeforeOutcomePreserved,true);assert.equal(a.currentHumanAcquisitionPublicationDisclosure,true);
 const root=path.resolve(process.cwd(),process.cwd().endsWith('/apps/srm')?'':'apps/srm');
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(execFileSync('git',['show',acceptedReceipt.formReportAdmissionAdoption.previousReceiptSourceSha+':apps/srm/'+file])),digest,file);
 const target=JSON.parse(execFileSync('git',['show',acceptedReceipt.formReportAdmissionAdoption.previousReceiptSourceSha+':apps/srm/deployment/krs-name-pilot-targets.json'],{encoding:'utf8'}));assert.deepEqual(target.acceptedRuntime,a.acceptedRuntime);
});


test('form report admission preserves historical receipts and confines the admitted job to the Development pilot',()=>{
 const a=acceptedReceipt.formReportAdmissionAdoption,bytes=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json']);assert.equal(hash(bytes),a.previousReceiptSha256);
 for(const[k,v]of Object.entries(JSON.parse(bytes.toString())))assert.deepEqual(['contract','producer'].includes(k)?a.previousRootAcceptance[k as 'contract'|'producer']:(acceptedReceipt as Record<string,unknown>)[k],v,k);
 assert.equal(a.reportAdmissionOptedIn,true);assert.equal(a.privateJdgKysExportsExcluded,true);assert.equal(a.postClickClerkReads,0);assert.equal(a.humanAuthority,'AT_FORM_ADMISSION');
 for(const flag of ['sql025Installed','liveGrantsChanged','productDeploymentPerformed'])assert.equal(a[flag as 'sql025Installed'],false,flag);
 const root=path.resolve(process.cwd(),process.cwd().endsWith('/apps/srm')?'':'apps/srm');
 for(const[file,digest]of Object.entries(a.sourceDigests))assert.equal(hash(fs.readFileSync(path.resolve(root,'../../packages/platform-contracts',file))),digest,file);
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(acceptedReceipt.ochnikFinancialCorrection?execFileSync('git',['show',acceptedReceipt.ochnikFinancialCorrection.previousSourceSha+':'+path.posix.normalize('apps/srm/'+file)]):fs.readFileSync(path.join(root,file))),digest,file);
});


test('OCHNIK correction preserves verified attribution, metering capability and all prior receipts',()=>{
 const a=acceptedReceipt.ochnikFinancialCorrection,previous=execFileSync('git',['show',a.previousSourceSha+':apps/srm/operation-integration.json']);
 assert.equal(hash(previous),a.previousReceiptSha256);for(const[k,v]of Object.entries(JSON.parse(previous.toString())))assert.deepEqual((acceptedReceipt as Record<string,unknown>)[k],v,k);
 assert.equal(a.mode,'UNMETERED');assert.equal(a.historicalCountersPreserved,true);assert.equal(a.unverifiedHistoryExcluded,true);assert.equal(a.otherRuntimePoliciesUnchanged,true);
 const root=path.resolve(process.cwd(),process.cwd().endsWith('/apps/srm')?'':'apps/srm');
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(acceptedReceipt.mgbiInventoryResponseCompatibility?execFileSync('git',['show',acceptedReceipt.mgbiInventoryResponseCompatibility.previousSourceSha+':'+path.posix.normalize('apps/srm/'+file)]):fs.readFileSync(path.resolve(root,file))),digest,file);
 for(const[file,digest]of Object.entries(a.optionalSqlDigests))assert.equal(hash(fs.readFileSync(path.resolve(root,'../../packages/platform-contracts/migrations/access',file))),digest,file);
 const target=JSON.parse(execFileSync('git',['show',acceptedReceipt.pilot2CompanyIdentityAdoption.previousApplicationAuthority+':apps/srm/deployment/krs-name-pilot-targets.json']).toString());assert.deepEqual(target.acceptedRuntime,a.acceptedRuntime);
});

test('bounded MGBI inventory adoption preserves the prior accepted OCHNIK correction',()=>{
 const a=acceptedReceipt.mgbiInventoryResponseCompatibility,previous=execFileSync('git',['show',a.previousSourceSha+':apps/srm/operation-integration.json']);
 assert.equal(hash(previous),a.previousReceiptSha256);for(const[k,v]of Object.entries(JSON.parse(previous.toString())))assert.deepEqual((acceptedReceipt as Record<string,unknown>)[k],v,k);
 assert.equal(a.maximumInventoryResponseBytes,8*1024*1024);assert.equal(a.otherRuntimePoliciesUnchanged,true);
 const root=path.resolve(process.cwd(),process.cwd().endsWith('/apps/srm')?'':'apps/srm');
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(acceptedReceipt.porrAccountCompatibility?execFileSync('git',['show',acceptedReceipt.porrAccountCompatibility.previousSourceSha+':'+path.posix.normalize('apps/srm/'+file)]):fs.readFileSync(path.resolve(root,file))),digest,file);
 const source=fs.readFileSync(path.join(root,'src/server/supplier-native-runtime.ts'),'utf8');
 assert(source.includes('maximumResponseBytes:config.runtimeRoles?mgbiPolicy.maximumInventoryResponseBytes:external.maximumResponseBytes'));
});


test('PORR embedded account adoption preserves accepted receipts and exact Development scope',()=>{
 const a=acceptedReceipt.porrAccountCompatibility,previous=execFileSync('git',['show',a.previousSourceSha+':apps/srm/operation-integration.json']);
 assert.equal(hash(previous),a.previousReceiptSha256);for(const[k,v]of Object.entries(JSON.parse(previous.toString())))assert.deepEqual((acceptedReceipt as Record<string,unknown>)[k],v,k);
 assert.equal(a.producerPr,695);assert.equal(a.producerSourceSha,'6e173035ac1780b82d128c306be98542e1c0aa0b');
 assert.equal(a.defaultEnabled,false);assert.equal(a.targetEnvironment,'development');assert.equal(a.automaticOrganisationAssignment,false);assert.equal(a.grantsChanged,false);assert.equal(a.sqlChanged,false);
 const root=path.resolve(process.cwd(),process.cwd().endsWith('/apps/srm')?'':'apps/srm');
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(acceptedReceipt.pilot2TelemetryCompatibility?execFileSync('git',['show',acceptedReceipt.pilot2TelemetryCompatibility.previousApplicationAuthority+':'+path.posix.normalize('apps/srm/'+file)]):fs.readFileSync(path.resolve(root,file))),digest,file);
});


test('PILOT2 telemetry preserves the complete accepted receiver and changes no authority',()=>{
 const a=acceptedReceipt.pilot2TelemetryCompatibility;
 const previous=execFileSync('git',['show',a.previousApplicationAuthority+':apps/srm/operation-integration.json']);
 assert.equal(hash(previous),a.previousReceiptSha256);
 for(const[k,v]of Object.entries(JSON.parse(previous.toString())))assert.deepEqual((acceptedReceipt as Record<string,unknown>)[k],v,k);
 assert.equal(a.scope,'ISOLATED_PILOT2_STAGE_TELEMETRY_ONLY');assert.equal(a.targetEnvironment,'development');
 for(const flag of ['identityAuthorityChanged','sqlChanged','grantsChanged','providerRoutingChanged','productDeploymentPerformed'] as const)assert.equal(a[flag],false,flag);
 const root=path.resolve(process.cwd(),process.cwd().endsWith('/apps/srm')?'':'apps/srm');
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(execFileSync('git',['show',acceptedReceipt.porrRecoveryCompatibility.previousSourceSha+':apps/srm/'+file])),digest,file);
});

test('PORR recovery preserves historical acceptance, provider password authority and account boundary',()=>{
 const a=acceptedReceipt.porrRecoveryCompatibility,previous=execFileSync('git',['show',a.previousSourceSha+':apps/srm/operation-integration.json']);
 assert.equal(hash(previous),a.previousReceiptSha256);
 for(const[k,v]of Object.entries(JSON.parse(previous.toString())))assert.deepEqual((acceptedReceipt as Record<string,unknown>)[k],v,k);
 assert.equal(a.targetEnvironment,'development');assert.equal(a.passwordAuthority,'CLERK_OFFICIAL_SDK');
 for(const flag of ['sqlChanged','grantsChanged','identityAuthorityChanged','sharedBackendChanged'] as const)assert.equal(a[flag],false);
 const root=path.resolve(process.cwd(),process.cwd().endsWith('/apps/srm')?'':'apps/srm');
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(execFileSync('git',['show',acceptedReceipt.pilot2CompanyIdentityAdoption.previousApplicationAuthority+':apps/srm/'+file])),digest,file);
});

test('PILOT2 explicitly adopts the unchanged company validator through its versioned public entry',()=>{
 const a=acceptedReceipt.pilot2CompanyIdentityAdoption;
 const previous=execFileSync('git',['show',a.previousApplicationAuthority+':apps/srm/operation-integration.json']);
 assert.equal(hash(previous),a.previousReceiptSha256);
 for(const[k,v]of Object.entries(JSON.parse(previous.toString())))assert.deepEqual((acceptedReceipt as Record<string,unknown>)[k],v,k);
 assert.equal(a.producerPr,701);assert.equal(a.userIdentityOrAuthorityChanged,false);assert.equal(a.productDeploymentPerformed,false);
 const validator='apps/krs-registry-runtime/src/identity.ts';
 assert.equal(hash(execFileSync('git',['show',a.previousApplicationAuthority+':'+validator])),hash(execFileSync('git',['show',a.acceptedRuntime.sourceSha+':'+validator])));
 const root=path.resolve(process.cwd(),process.cwd().endsWith('/apps/srm')?'':'apps/srm');
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'deployment/krs-name-pilot-targets.json'),'utf8')).acceptedRuntime,a.acceptedRuntime);
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(fs.readFileSync(path.resolve(root,file))),digest,file);
});
