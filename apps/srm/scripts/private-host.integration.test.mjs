import assert from 'node:assert/strict'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import test from 'node:test'
import pg from 'pg'
import ExcelJS from 'exceljs'
import { accessSchemaUrl, accessStoreSourceDigest, createAccessStore, moduleAuditSchemaUrl, moduleAuditSchemaDigest } from '@profitia/platform-contracts/access-store'
import { moduleSchemaUrl, moduleSchemaDigest } from '@profitia/platform-contracts/module-scope'
import { identitySourceDigest } from '@profitia/platform-contracts/identity-provider'
import { privateOperationHostSourceDigest } from '@profitia/platform-contracts/private-operation-host'
import { OPERATION_CONTRACT, isOperationDenied, operationPayloadDigest } from '@profitia/platform-contracts/operation-context'
import { assertIsolatedTestConnection } from '../../architecture-lab/src/operation-postgres-fixture.mjs'
import { privateBusinessPlan } from '../db/private-store/initialize.mjs'
import { migrationManifest } from './staging-migrate.mjs'
import { createSrmReportOperationHost, createSrmSupplierRequestOperationHost } from '../src/server/private-runtime.ts'
import { createSrmSupplierPrivateStore } from '../src/server/supplier-private-store.ts'
import { emptyCard } from '../src/demo/fixture.ts'
import { mapMgbiFinancialRecords } from '../src/server/mgbi-financial.ts'
import { createSrmSupplierRequestContinuation, SUPPLIER_PRIVATE_PHASES, MAX_PRIVATE_PHASE_BYTES } from '../src/server/supplier-request-continuation.ts'
import { createOperationSupplierRequestHandler } from '../src/server/supplier-request-handler.ts'
import { readSupplierRequest, supplierRequestResourceId, persistSupplierRequest } from '../src/server/supplier-request-operation.ts'
import { createRuntimeSrmReportHandler } from '../src/server/report-runtime.ts'
import { createRuntimeSrmFinancialExcelHandler } from '../src/server/financial-excel-runtime.ts'
import { createRuntimeSharedFinancialHandler } from '../src/server/shared-financial-runtime.ts'
import { readSharedFinancialReport } from '../src/server/shared-financial-read.ts'
import { middleware } from '../middleware.ts'
import { NextRequest } from 'next/server.js'
import { createSrmPrivateOperationHost } from '../src/server/private-operation-host.ts'
import { recordSupplierInterest } from '../src/server/shared-catalog.ts'
import { createLookup } from '../src/server/xray-repository.ts'
import { bindOrganizationTransaction, withOrganization } from '../src/server/db.ts'
const DATABASE = 'srm_private_host_test', ROLE = 'srm_private_host_runtime'
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222'
const U = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', V = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ISSUER = 'https://identity.fixture.test', ORIGIN = 'http://localhost:3400', NIP = '8650004194'
const sql = fs.readFileSync(new URL(accessSchemaUrl), 'utf8'), digest = createHash('sha256').update(sql).digest('hex')
const moduleSql = fs.readFileSync(new URL(moduleSchemaUrl), 'utf8'), moduleDigest = await moduleSchemaDigest()
const moduleAuditSql = fs.readFileSync(new URL(moduleAuditSchemaUrl), 'utf8'), auditDigest = await moduleAuditSchemaDigest()
const expiry = () => new Date(Date.now() + 3600000).toISOString()
const hash = text => createHash('sha256').update(text).digest('hex')

// The previous application receipt is immutable; this exact accepted main
// supplies its historical bytes. The new receipt checks the complete current
// application closure separately, including every changed file.
function beforePrivateAcquisitionApplicationSource(path){
 return execFileSync('git',['show','8c5e14b0fc4815021231f6752c1073f1c191465b:apps/srm/'+path])
}
const sdkReceipt=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url)))
const currentSdkDigests=sdkReceipt.formReportAdmissionAdoption.sdkDigests
const currentPlatformSourceDigests=manifest=>Object.fromEntries(Object.entries({...manifest.accountRecheckSourceCompatibility.sourceDigests,...manifest.krsNipSourceCompatibility?.sourceDigests,...manifest.unmeteredSourceCompatibility.sourceDigests,...manifest.formReportAdmissionAdoption.sourceDigests}).filter(([file])=>file!=='package-lock.json'))

test('SRM imports the exact optional external control source without adopting a product operation', async () => {
  const sdk=await import('@profitia/platform-contracts/external-call')
  const manifest=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url)))
  const accepted=manifest.externalCallSourceCompatibility
  const historicalRequest=manifest.externalRequestSourceCompatibility
  assert.equal(historicalRequest.sourceRecordIsHistorical,true)
  const current=manifest.privateRequestContinuationSourceCompatibility
  assert.equal(accepted.sourceRecordIsHistorical,true)
  assert.equal(current.previousExternalRequestSourceRecordIsHistorical,true)
  assert.equal(accepted.platformVersion,'1.13.0')
  assert.equal(accepted.producer.sourceSha,'1066119a1c1fde29c50b2c627e068f14378441f8')
  assert.equal(accepted.sourceDigest,'cd49ee2c113202178870da20076a7c401e0aede44229dc2102d142c2f49cb431')
  const native=manifest.nativeExternalSourceCompatibility
  assert.equal(native.platformVersion,'1.16.0')
  assert.equal(native.previousSourceRecordsAreHistorical,true)
  assert.equal(current.sourceRecordIsHistorical,true)
  assert.equal(native.producer.sourceSha,'2a44365b981d6a4c786f4e572fe2ca34a8a4fc92')
  assert.equal(await sdk.externalCallSourceDigest(),currentSdkDigests.externalCallSourceDigest)
  assert.equal(await sdk.nativeExternalTransportSchemaDigest(),native.nativeSchemaDigest)
  assert.equal(native.baseSchemaDigest,accepted.schemaDigest)
  assert.equal(sdk.NATIVE_EXTERNAL_TRANSPORT.completionMode,'ADMITTED_ATTEMPT_CURRENT_SETTLEMENT')
  assert.throws(()=>sdk.externalNativeResponse({status:200,bytes:new Uint8Array(0)}))
  for(const key of ['nativeTransportAdopted','sql012Installed','runtimeRoleOrGrantChanged','humanSupplierRefreshAdopted','finderAiAdopted','kysOrPersonalDataAdopted','productDeploymentPerformed'])assert.equal(native[key],false,key)
  assert.equal(await sdk.externalCallSchemaDigest(),accepted.schemaDigest)
  assert.deepEqual(sdk.EXTERNAL_CALL_CONTRACT,{id:'profitia.external-call',version:'1.0.0',unit:'UPSTREAM_ATTEMPT_ADMISSION'})
  const phaseSdk=await import('@profitia/platform-contracts/request-continuation')
  assert.equal(await phaseSdk.requestContinuationSchemaDigest(),current.schemaDigest)
  assert.equal(await phaseSdk.requestContinuationSourceDigest(),currentSdkDigests.requestContinuationSourceDigest)
  assert.equal(phaseSdk.REQUEST_CONTINUATION_CONTRACT.effect,'PRIVATE_SQL_PHASE')
  const root=new URL('../',import.meta.resolve('@profitia/platform-contracts/external-call'))
  assert.equal(Object.keys(current.sourceDigests).length,20)
  assert.equal(Object.keys(native.sourceDigests).length,23)
  for(const [path,digest]of Object.entries(currentPlatformSourceDigests(manifest)))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(path,root))).digest('hex'),digest,path)
  for(const name of ['externalCallAdopted','sql009Installed','runtimeRoleOrGrantChanged','humanSupplierRefreshAdopted','finderAiAdopted','kysOrPersonalDataAdopted','productDeploymentPerformed'])assert.equal(accepted[name],false,name)
  assert.equal(sdk.externalCallEvidence({status:200,body:{}}),null)
})

test('SRM business adoption pins its actual writer sources and preserves release boundaries',()=>{
  const manifest=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url))),accepted=manifest.supplierPrivateBusinessStoreAdoption
  assert.equal(accepted.taskId,'SRM-E1-SUPPLIER-PRIVATE-BUSINESS-20261018')
  assert.equal(accepted.version,'srm-supplier-private-store-v1')
  assert.equal(accepted.status,'SOURCE_CANDIDATE_NOT_RELEASED')
  assert.equal(Object.keys(accepted.sourceDigests).length,6)
  assert.equal(accepted.sourceRecordIsHistorical,true)
  const current=manifest.namedSupplierInterestAdoption
  assert.equal(current.taskId,'SRM-E1-NAMED-SUPPLIER-INTEREST-20261019')
  assert.equal(current.version,'srm-named-supplier-interest-v1')
  assert.equal(current.internalAccountBasedAdapter,true)
  assert.equal(current.distinctSurrogatePerOrganization,true)
  assert.equal(Object.keys(current.sourceDigests).length,8)
  assert.equal(current.namedBoundaryDigest,hash(fs.readFileSync(new URL('../db/private-store/003-named-supplier-interest.sql',import.meta.url))))
  for(const name of ['legacyDemoHistoryReassigned','humanSharedCatalogWriteAdopted','httpEndpointActivated','liveSchemaOrGrantsChanged','productDeploymentPerformed'])assert.equal(current[name],false,name)
  assert.equal(current.sourceRecordIsHistorical,true)
  const delegated=manifest.delegatedSupplierBusinessAdoption
  assert.equal(delegated.taskId,'SRM-E1-DELEGATED-SUPPLIER-BUSINESS-20261019')
  assert.equal(delegated.databaseScopeTask.taskId,'SRM-E1-DELEGATED-DATABASE-SCOPE-20261019')
  assert.equal(delegated.executionMode,'EXPLICIT_DELEGATED_SERVICE_WITH_UNCHANGED_HUMAN_DEFAULT')
  assert.equal(Object.keys(delegated.sourceDigests).length,13)
  assert.equal(delegated.sourceRecordIsHistorical,true)
  const inspection=manifest.supplierPrivateInspectionAdoption
  assert.equal(inspection.taskId,'SRM-E1-COMMITTED-SUPPLIER-PRIVATE-READS-20261019')
  assert.equal(inspection.version,'srm-supplier-private-reader-v1')
  assert.equal(inspection.maximumJsonBytes,8*1024*1024)
  assert.equal(inspection.actualIsolatedBusinessReadsVerified,true)
  assert.equal(inspection.sameNativeDriverAndTransaction,true)
  assert.equal(Object.keys(inspection.sourceDigests).length,16)
  assert.equal(inspection.sourceRecordIsHistorical,true)
  assert.equal(inspection.inspectionBusinessBoundaryDigest,hash(fs.readFileSync(new URL('../db/private-store/007-supplier-private-inspection.sql',import.meta.url))))
  for(const flag of ['writePrivilegesConferredByRead','archiveRestoreInsideRead','completeNativeEngineComposition','kysOrPersonalDataAdopted','liveSchemaOrGrantsChanged','httpEndpointActivated','mapsChanged','productDeploymentPerformed'])assert.equal(inspection[flag],false,flag)
  assert.equal(delegated.delegatedBusinessBoundaryDigest,hash(fs.readFileSync(new URL('../db/private-store/006-delegated-supplier-business.sql',import.meta.url))))
  for(const flag of['actualIsolatedServiceBusinessVerified','ordinaryExecutorDatabaseTested','sameNativeDriverAndDomainWriters','requiresIndependentSharedCatalogSource'])assert.equal(delegated[flag],true,flag)
  for(const flag of['browserProofBorrowed','legacyDemoHistoryReassigned','sharedCatalogPrivateWriteAdopted','liveServiceBusinessActivated','liveSchemaOrGrantsChanged','httpEndpointActivated','productDeploymentPerformed'])assert.equal(delegated[flag],false,flag)
  assert.equal(accepted.businessBoundaryDigest,hash(fs.readFileSync(new URL('../db/private-store/002-supplier-business-phases.sql',import.meta.url))))
  for(const name of ['humanSharedCatalogWriteAdopted','namedUserInterestAdopted','kysOrPersonalDataAdopted','providerAcquisitionImplemented','newHttpEndpointAdopted','liveSchemaOrGrantsChanged','productDeploymentPerformed'])assert.equal(accepted[name],false,name)
})

test('current native Supplier work receipt binds the original domain helpers without claiming release or full provider composition',()=>{
  const manifest=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url)))
  const current=manifest.nativeSupplierBusinessWorkAdoption
  assert.equal(current.taskId,'SRM-E1-NATIVE-SUPPLIER-WORK-BOUNDARY-20261019')
  assert.equal(current.version,'srm-supplier-native-work-v1')
  assert.equal(current.status,'SOURCE_CANDIDATE_NOT_RELEASED')
  assert.equal(current.reviewedNativeUnits,18)
  assert.equal(current.maximumOriginalBytes,20*1024*1024)
  assert.equal(current.maximumJsonBytes,32*1024*1024)
  assert.equal(Object.keys(current.sourceDigests).length,21)
  assert.equal(current.sourceRecordIsHistorical,true)
  const link=manifest.protectedSupplierSourceLinkAdoption
  assert.equal(link.taskId,'SRM-E1-PROTECTED-SUPPLIER-SOURCE-LINK-20261019')
  assert.equal(link.acceptedLookupReplayTask.taskId,'SRM-E1-ACCEPTED-LOOKUP-IDEMPOTENCE-20261019')
  assert.equal(Object.keys(link.sourceDigests).length,24)
  assert.equal(link.sourceRecordIsHistorical,true)
  const composition=manifest.nativeSensitiveSupplierCompositionAdoption
  for(const[path,digest]of Object.entries(link.sourceDigests))assert.equal(hash(beforePrivateAcquisitionApplicationSource(path)),composition.sourceDigests[path]??digest,path)
  assert.equal(link.requestBoundaryDigest,hash(fs.readFileSync(new URL('../db/private-store/009-supplier-source-request.sql',import.meta.url))))
  for(const flag of ['previousNativeWorkReceiptPreserved','sameRootDispatchAndSourceHost','actualOrdinaryPrivateAndSourceTransactionsTested','sourceOutcomeRequiredAtCommit','fundedRetryAfterIndependentSourceCommitVerified','currentAccountMembershipAndSourceGrantChecked','originalAcceptedLookupIdentityReused'])assert.equal(link[flag],true,flag)
  for(const flag of ['secondRequestOrDispatchLedgerIntroduced','networkInsideSqlTransaction','customerIdentityStoredInSource','serializedSourceReadMintsReceiptAuthority','completeNativeEngineComposition','liveProviderAcquisitionVerified','liveCustomerSessionVerified','liveSchemaOrGrantsChanged','httpEndpointActivated','mapsChanged','productDeploymentPerformed'])assert.equal(link[flag],false,flag)
  assert.equal(current.workBusinessBoundaryDigest,hash(fs.readFileSync(new URL('../db/private-store/008-supplier-native-work.sql',import.meta.url))))
  for(const flag of ['historicalInspectionReceiptPreserved','sameNativeDriverAndCanonicalWriter','actualOrdinaryExecutorTested','sameOriginalMsrLifecycle','resultsReleasedOnlyAfterCommit','archiveProvenanceCheckedWithoutReadLocks','preparationLockDoesNotPermitArchiveWrite','requiresIndependentSharedCatalogSource'])assert.equal(current[flag],true,flag)
  for(const flag of ['secondDomainLedgerIntroduced','archiveRestoreInsideRead','completeNativeEngineComposition','liveProviderAcquisitionVerified','kysOrPersonalDataAdopted','legacyDemoHistoryReassigned','liveSchemaOrGrantsChanged','httpEndpointActivated','mapsChanged','productDeploymentPerformed'])assert.equal(current[flag],false,flag)
})

test('full native company receipt pins its complete current closure and explicit unreleased boundaries',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url)))
 const current=manifest.fullNativeCompanyCompositionAdoption
 assert.equal(current.taskId,'SRM-E1-FULL-NATIVE-COMPANY-20261019');assert.equal(current.version,'srm-native-company-v1')
 assert.equal(current.status,'SOURCE_CANDIDATE_NOT_RELEASED');assert.equal(current.originalCompanyPorts,16);assert.equal(current.reviewedNativeUnits,18)
 assert.equal(current.corporateClassification.taskId,'SRM-E1-MSR-CORPORATE-PROVENANCE-20261019')
 assert.equal(current.corporateClassification.version,'srm-corporate-fields-v2')
 const expected=new Set([...Object.keys(manifest.protectedSupplierSourceLinkAdoption.sourceDigests),
   ...Object.keys(manifest.corporateSourcePublicationAdoption.sourceDigests),
   'src/server/supplier-native-company.ts','src/server/provider-source-transport.ts','src/server/msr-source.ts'])
 assert.deepEqual(new Set(Object.keys(current.sourceDigests)),expected)
 assert.equal(current.sourceRecordIsHistorical,true)
 const revision=manifest.fullNativeCompanyReplayRevision
 assert.equal(revision.taskId,current.taskId);assert.equal(revision.version,'srm-native-company-replay-v1')
 assert.equal(revision.authorityBeforeReplay,'505a23800fbd8a74f40a5a1e1947f3b2a62093bc')
 assert.deepEqual(Object.keys(revision.sourceDigests),Object.keys(current.sourceDigests))
 assert.equal(revision.sourceRecordIsHistorical,true)
 const latest=manifest.nativeSensitiveSupplierCompositionAdoption
 for(const[path,digest]of Object.entries(revision.sourceDigests))assert.equal(hash(beforePrivateAcquisitionApplicationSource(path)),latest.sourceDigests[path]??digest,path)
 for(const flag of ['previousFullCompositionReceiptPreserved','typedOriginalFinancialFactsReplayed','changedUnknownAndDuplicatedFactsRefused','providerPurchaseAndCustomerQuotaSeparateFromSourceProjection','originalCacheFinancialOnlyPublicationPreserved'])assert.equal(revision[flag],true,flag)
 for(const flag of ['sqlOrRolesChanged','httpEndpointActivated','productDeploymentPerformed'])assert.equal(revision[flag],false,flag)
 const company=fs.readFileSync(new URL('../src/server/supplier-native-company.ts',import.meta.url),'utf8')
 assert(!/from\s+['"](?:react|next)/.test(company))
 for(const name of ['previousSourceLinkReceiptPreserved','sameOriginalCompanyEngine','actualColdAndWarmOrdinaryRolesTested','actualOriginalMsrPathTested','newParentHasOwnPrivateHistory','indicatorsReadDoesNotWrite','independentProviderAndCorporateSources','networkOutsideSqlTransaction','currentAccountAndParentRechecked','sameCompletedParentHistoryReused','conflictingPrivateReplayRefused'])assert.equal(current[name],true,name)
 for(const name of ['secondDomainLedgerIntroduced','customerIdentityStoredInSource','httpEndpointActivated','liveProviderAcquisitionVerified','liveCustomerSessionVerified','liveSchemaOrGrantsChanged','mapsChanged','productDeploymentPerformed'])assert.equal(current[name],false,name)
})

test('complete JDG and KYS orchestration ports retain original engines without claiming native sensitive adoption',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url)))
 const current=manifest.sensitiveOrchestrationPrerequisite
 assert.equal(current.taskId,'SRM-E1-SENSITIVE-ORCHESTRATION-20261019')
 assert.equal(current.version,'srm-sensitive-orchestration-v1')
 assert.equal(current.status,'SOURCE_CANDIDATE_NOT_RELEASED')
 assert.equal(current.authorityBeforeChange,'cb7a2bad1570801d643a19db618fc4edb59fab61')
 assert.equal(current.jdgPorts,6);assert.equal(current.kysPorts,7)
 const expected=new Set([...Object.keys(manifest.fullNativeCompanyReplayRevision.sourceDigests),
  'src/server/jdg-lookup.ts','src/server/jdg-orchestration.test.ts','src/server/kys-orchestration.test.ts'])
 assert.equal(expected.size,34);assert.deepEqual(new Set(Object.keys(current.sourceDigests)),expected)
 for(const[path,digest]of Object.entries(current.sourceDigests))assert.equal(hash(beforePrivateAcquisitionApplicationSource(path)),manifest.nativeSensitiveSupplierCompositionAdoption.sourceDigests[path]??digest,path)
 for(const key of ['previousSourceFingerprintsPreserved','sameOriginalEngines','legacyDefaultRetained','originalEngineBodyEquivalenceVerified'])assert.equal(current[key],true,key)
 for(const key of ['privateSensitiveSqlInstalled','nativeSensitivePathsAdopted','httpEndpointActivated','liveProviderAcquisitionVerified','productDeploymentPerformed'])assert.equal(current[key],false,key)
})

test('SRM accepts the published optional producer fingerprints', async () => {
  assert.equal(await accessStoreSourceDigest(), currentSdkDigests.accessStoreSourceDigest)
  assert.equal(await identitySourceDigest(), 'b7f3e09e6c62bbaf20c42752f514022c91b0dc0fef9db387f41f613a124ce0b4')
  assert.equal(await privateOperationHostSourceDigest(),currentSdkDigests.privateOperationHostSourceDigest)
  assert.equal(moduleDigest, 'c4ea1883af310934b1e83dfcf936ba15dfc32a3f4be206c752efe2d69a55b9ed')
  assert.equal(auditDigest, 'af296074b8b4dab2f952e1d2e0553e17d6567f480152870d151dc36c9302e6ac')
})

test('SRM imports the exact additive presentation channel while keeping current authority in the host callback', async t => {
  const { EMBEDDED_READ_CONTRACT, openEmbeddedReadHost, openEmbeddedReadClient } = await import('@profitia/platform-contracts/embedded-read-channel')
  assert.deepEqual({id:EMBEDDED_READ_CONTRACT.id,version:EMBEDDED_READ_CONTRACT.version},{id:'profitia.embedded-read',version:'1.0.0'})
  const entry = new URL(import.meta.resolve('@profitia/platform-contracts/embedded-read-channel'))
  const adoption=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url))).embeddedChannelSourceCompatibility
  assert.equal(adoption.platformVersion,'1.12.0')
  assert.equal(adoption.producer.sourceSha,'a0e6bbee0ce44e2d3472183ef67749f3ef8f4e45')
  assert.deepEqual(Object.keys(adoption.sourceDigests).sort(),['src/embedded-channel-core.mjs','src/embedded-command-channel.d.mts','src/embedded-command-channel.mjs','src/embedded-read-channel.d.mts','src/embedded-read-channel.mjs'])
  for(const [path,digest]of Object.entries(adoption.sourceDigests)){
    assert.match(digest,/^[a-f0-9]{64}$/)
    assert.equal(hash(fs.readFileSync(new URL(path.slice(4),entry))),digest,path)
  }
  assert.equal(adoption.nativeEmbeddedUiAdopted,false)
  assert.equal(adoption.embeddedCommandAdopted,false)
  assert.equal(adoption.forecastRequestAdopted,false)
  const {port1,port2}=new MessageChannel(),instanceId=randomUUID()
  let calls=0,currentAllowed=true,closed
  const observedClose=new Promise(resolve=>{closed=resolve})
  const host=openEmbeddedReadHost({port:port1,instanceId,
    parseSelection:value=>value && Object.keys(value).join(',')==='kind' && value.kind==='shared-summary'?value:null,
    read:async()=>{calls++;return currentAllowed?{status:200,body:{values:[10,0,null]}}:{status:403,body:{diagnostic:'SYNTHETIC_PRIVATE_MARKER'}}}})
  const client=openEmbeddedReadClient({port:port2,instanceId,onClose:closed})
  t.after(()=>{client.close();host.close()})
  assert.deepEqual(await client.read({kind:'shared-summary'}),{status:200,body:{values:[10,0,null]}})
  for(const patch of[{organisationId:A},{userId:U},{destination:'https://foreign.test'},{operation:'supplier.refresh'}])
    assert.equal((await client.read({kind:'shared-summary',...patch})).status,400)
  assert.equal(calls,1)
  currentAllowed=false
  assert.deepEqual(await client.read({kind:'shared-summary'}),{status:403,body:{error:'Read unavailable.'}})
  assert.equal(calls,2);host.close();await observedClose
  // Transport compatibility is not an SRM endpoint, UI embedding or live grant.
})

test('SRM real report and pg driver use the accepted private host', async t => {
  const rootUrl = assertIsolatedTestConnection(process.env.SRM_OPERATION_TEST_OWNER_URL, 'srm_app', 'architecture_test_owner')
  const root = new pg.Client({ connectionString: rootUrl }); await root.connect()
  const dbUrl = new URL(rootUrl); dbUrl.pathname = `/${DATABASE}`
  let owner, pool, auditPool
  const previousProvider = process.env.PROFITIA_AUTH_PROVIDER
  const previousFetch = globalThis.fetch
  globalThis.fetch = async () => { throw Error('No external providers in private host fixture') }
  try {
    if (!(await root.query('SELECT 1 FROM pg_database WHERE datname=$1', [DATABASE])).rowCount) await root.query(`CREATE DATABASE ${DATABASE}`)
    for (const [role, login] of [['profitia_access_owner', false], ['profitia_ingestion_owner', false], [ROLE, true], ['neon_superuser', false], ['srm_app_runtime', true]]) {
      if (!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role])).rowCount) await root.query(`CREATE ROLE ${role} ${login ? "LOGIN PASSWORD 'isolated_ci_only'" : 'NOLOGIN'} NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`)
    }
    const flags = (await root.query('SELECT rolsuper,rolcreatedb,rolcreaterole,rolbypassrls,rolinherit FROM pg_roles WHERE rolname=$1', [ROLE])).rows[0]
    assert.deepEqual(flags, { rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolbypassrls: false, rolinherit: false })
    await root.query(`ALTER ROLE ${ROLE} CONNECTION LIMIT 4`)
    owner = new pg.Client({ connectionString: dbUrl.toString() }); await owner.connect()
    // This reset is allowed only in the named, guarded LOOPBACK fixture.
    assert.equal((await owner.query('SELECT current_database() AS db')).rows[0].db, DATABASE)
    await owner.query('DROP SCHEMA IF EXISTS srm CASCADE; DROP SCHEMA IF EXISTS profitia_modules CASCADE; DROP SCHEMA IF EXISTS profitia_access CASCADE')
    await owner.query(`GRANT CREATE ON DATABASE ${DATABASE} TO profitia_access_owner`)
    await owner.query('BEGIN; SET LOCAL ROLE profitia_access_owner')
    await owner.query(sql)
    await owner.query("INSERT INTO profitia_access.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','isolated-private-project','isolated-private-branch',$2)", [digest, DATABASE])
    await owner.query("INSERT INTO profitia_access.applications(application_id,status) VALUES('srm','DISABLED')")
    await owner.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES($1,'srm','ACTIVE')", [ROLE])
    for (const user of [U, V]) {
      await owner.query("INSERT INTO profitia_access.accounts(user_id,status) VALUES($1,'ACTIVE')", [user])
      await owner.query("INSERT INTO profitia_access.external_identities(binding_id,issuer,subject,user_id,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'ACTIVE','SYNTHETIC_ONLY',$5)", [randomUUID(), ISSUER, `external-${user}`, user, expiry()])
    }
    for (const org of [A, B]) {
      await owner.query("INSERT INTO profitia_access.organisations(organisation_id,status) VALUES($1,'ACTIVE')", [org])
      await owner.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES('srm',$1,'SUPPLIER_INTELLIGENCE',ARRAY['supplier_report'],'ACTIVE','EXPLICIT_OFFER','SYNTHETIC_NOT_COMMERCIAL',$2)", [org, expiry()])
      for (const user of org === A ? [U, V] : [U]) {
        await owner.query("INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at) VALUES($1,$2,'ACTIVE','SYNTHETIC_ONLY',$3)", [org, user, expiry()])
        for (const operation of ['supplier.report.read', 'supplier.report.project']) await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'srm',$2,$3,'ALLOW',$4,'supplier_report')", [randomUUID(), org, user, operation])
      }
    }
    await owner.query(`GRANT USAGE ON SCHEMA profitia_access TO ${ROLE}; GRANT EXECUTE ON FUNCTION profitia_access.runtime_descriptor(),profitia_access.identity_binding(text,text),profitia_access.lock_access(uuid,uuid,text,text,text),profitia_access.scope_allows(text,uuid,uuid),profitia_access.append_audit(jsonb) TO ${ROLE}`)
    await owner.query(moduleSql)
    await owner.query("INSERT INTO profitia_modules.installation(schema_version,schema_digest) VALUES('1.0.0',$1)", [moduleDigest])
    await owner.query("INSERT INTO profitia_modules.application_bindings(application_id,module_id,binding_id,status,source_ref,expires_at) VALUES('srm','supplier_report',$1,'ACTIVE','SYNTHETIC_MODULE_BINDING',$2)", [randomUUID(), expiry()])
    await owner.query(moduleAuditSql)
    await owner.query("INSERT INTO profitia_modules.audit_installation(envelope_version,schema_digest,source_ref) VALUES('1.0.0',$1,'SYNTHETIC_NOT_A_RELEASE')", [auditDigest])
    await owner.query(`GRANT USAGE ON SCHEMA profitia_modules TO ${ROLE}; GRANT EXECUTE ON FUNCTION profitia_modules.runtime_descriptor(),profitia_modules.bind_scope(text),profitia_modules.scope_allows(text,uuid,uuid),profitia_modules.audit_descriptor() TO ${ROLE}`)
    await owner.query('COMMIT')
    await owner.query(`REVOKE CREATE ON DATABASE ${DATABASE} FROM profitia_access_owner`)
    // Database ACLs are isolated to this named fixture; the legacy LOGIN role
    // is deliberately preserved for the sibling legacy srm_app test database.
    await owner.query(`REVOKE ALL ON DATABASE ${DATABASE} FROM PUBLIC,srm_app_runtime`)
    await owner.query(`GRANT CONNECT ON DATABASE ${DATABASE} TO ${ROLE}`)
    const legacyFlags = (await owner.query("SELECT rolcanlogin,rolinherit FROM pg_roles WHERE rolname='srm_app_runtime'")).rows[0]
    const binding = { environment: 'development', projectId: 'isolated-private-project',
      branchId: 'isolated-private-branch', databaseName: DATABASE, role: ROLE }
    const plan = privateBusinessPlan({ binding, sourceSha: 'a'.repeat(40) })
    const apply = async (statements = plan.sql, setup) => {
      await owner.query('BEGIN')
      try {
        if (setup) await setup()
        for (const statement of statements) await owner.query(statement)
        await owner.query('COMMIT')
      } catch (error) { await owner.query('ROLLBACK'); throw error }
    }
    const absent = async () => {
      assert.equal((await owner.query("SELECT to_regnamespace('srm') AS schema")).rows[0].schema, null)
      assert.equal((await owner.query("SELECT has_database_privilege('profitia_access_owner',current_database(),'CREATE') AS allowed")).rows[0].allowed, false)
      assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_access.accounts')).rows[0].n, 2)
    }
    await t.test('initializer rejects mismatched physical binding and preserves the directory', async () => {
      const wrong = privateBusinessPlan({ binding: { ...binding, branchId: 'wrong-branch' }, sourceSha: 'a'.repeat(40) })
      await assert.rejects(apply(wrong.sql), /physical control/); await absent()
    })
    await t.test('initializer rejects active application, legacy CONNECT and unsafe default ACL', async () => {
      for (const [setup, message] of [
        [() => owner.query("UPDATE profitia_access.applications SET status='ACTIVE' WHERE application_id='srm'"), /Disabled applications/],
        [() => owner.query(`GRANT CONNECT ON DATABASE ${DATABASE} TO srm_app_runtime`), /legacy policy/],
        [() => owner.query(`ALTER DEFAULT PRIVILEGES FOR ROLE profitia_access_owner GRANT SELECT ON TABLES TO ${ROLE}`), /default ACL/],
      ]) { await assert.rejects(apply(plan.sql, setup), message); await absent() }
    })
    await t.test('initializer rejects an existing namespace without adopting or erasing it', async () => {
      await owner.query('CREATE SCHEMA srm; CREATE TABLE srm.sentinel(id int); INSERT INTO srm.sentinel VALUES(17)')
      await assert.rejects(apply(), /already exists/)
      assert.equal((await owner.query('SELECT id FROM srm.sentinel')).rows[0].id, 17)
      // Remove only this committed sentinel in the guarded loopback fixture.
      await owner.query('DROP SCHEMA srm CASCADE'); await absent()
    })
    await t.test('failure after the complete plan rolls back schema, grants, receipt and temporary CREATE', async () => {
      await assert.rejects(apply([...plan.sql, 'SELECT 1/0']), /division by zero/); await absent()
    })
    await apply()
    await t.test('exact canonical ledger, all 22 controlled FORCE RLS tables and bounded ACLs', async () => {
      const ledger = (await owner.query('SELECT version,checksum_sha256 FROM srm.schema_migrations ORDER BY version')).rows
      assert.deepEqual(ledger, migrationManifest().slice(0, 18).map(m => ({ version: m.version, checksum_sha256: m.checksum })))
      const tables = (await owner.query("SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relowner::regrole::text AS owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='srm' AND c.relkind='r' ORDER BY c.relname")).rows
      assert.deepEqual(tables.map(t => t.relname), [...plan.expectedTables].sort())
      assert(tables.every(t => t.relrowsecurity && t.relforcerowsecurity && t.owner === 'profitia_access_owner'))
      assert.deepEqual((await owner.query("SELECT rolcanlogin,rolinherit FROM pg_roles WHERE rolname='srm_app_runtime'")).rows[0], legacyFlags)
      assert.equal((await owner.query("SELECT has_database_privilege('srm_app_runtime',current_database(),'CONNECT') AS allowed")).rows[0].allowed, false)
      assert.equal((await owner.query('SELECT schema_digest FROM srm.private_installation')).rows[0].schema_digest, plan.schemaDigest)
      for (const table of ['schema_migrations', 'private_installation', 'users', 'supplier_web_identity']) assert.equal((await owner.query(`SELECT has_table_privilege($1,$2,'SELECT') allowed`, [ROLE, `srm.${table}`])).rows[0].allowed, false)
      assert.equal((await owner.query("SELECT has_any_column_privilege($1,'srm.catalog_companies','UPDATE') allowed", [ROLE])).rows[0].allowed, false)
      await assert.rejects(apply(), /already exists/)
      assert.equal((await owner.query('SELECT count(*)::int n FROM srm.schema_migrations')).rows[0].n, 18)
    })
    // Activation belongs only to this synthetic fixture, after checked schema
    // initialization. The source candidate never activates a live application.
    await owner.query("UPDATE profitia_access.applications SET status='ACTIVE' WHERE application_id='srm'")
    // Deliberately grant one shared metadata column in the fixture so the
    // negative write test proves the RLS ceiling, not just a missing ACL.
    await owner.query(`GRANT UPDATE(updated_at) ON srm.catalog_companies TO ${ROLE}`)
    for (const [index, org] of [A, B].entries()) {
      await owner.query('INSERT INTO srm.organizations(id,slug) VALUES($1,$2)', [org, `fixture-org-${index}`])
      const requestId = (await owner.query("INSERT INTO srm.lookup_requests(organization_id,identifier_type,identifier) VALUES($1,'NIP',$2) RETURNING id", [org, NIP])).rows[0].id
      const record = { id: 'synthetic-financial-2025', identifiers: { pl_nip: NIP, pl_krs: '0000000001' }, document: { type: 'financial_statement', period_from_date: '2025-01-01', period_to_date: '2025-12-31', filing_date: '2026-01-15', is_ias_compliant: false }, content: { schema: { name: 'JednostkaInnaWZlotych', version: '1-3' }, extracted_fields: { 'Naglowek.OkresOd': '2025-01-01', 'Naglowek.OkresDo': '2025-12-31', 'Bilans.Aktywa.KwotaA': index ? '999' : '100', 'RZiS.RZiSKalk.A.KwotaA': '200' }, standardized_fields: {} } }
      const payload = JSON.stringify({ pages: [{ results: [record] }] })
      await owner.query("INSERT INTO srm.mgbi_source_archives(organization_id,nip,model,payload_json,payload_sha256,record_count,first_retrieved_at,last_checked_at,source_request_id) VALUES($1,$2,'pl-krs-rdf-record',$3::jsonb,$4,1,now(),now(),$5)", [org, NIP, payload, hash(payload), requestId])
    }
    const financial = { status: 'SUCCESS', source: { provider: 'MGBI', model: 'synthetic-fixture', recordId: 'private-not-public' }, retrievedAt: new Date().toISOString(), effectiveAt: '2025-12-31', warnings: [], catalogMappingVersion: '2026-10-07-ccc-v2', data: { qualityRule: 'FINANCIAL_QUALITY_V1', periods: [{ from: '2025-01-01', to: '2025-12-31', scope: 'standalone', documentId: 'synthetic-financial-2025:cfy', facts: [{ metricCode: 'BS_A_TA', amount: '100', currency: 'PLN', unit: 'PLN' }] }] } }
    await owner.query('INSERT INTO srm.catalog_companies(nip,financial_json,financial_sha256,financial_checked_at) VALUES($1,$2::jsonb,$3,now())', [NIP, JSON.stringify(financial), hash(JSON.stringify(financial))])
    await owner.query("INSERT INTO srm.catalog_kys_reports(nip,entity_type) VALUES($1,'COMPANY')", [NIP])
    // Install the optional real SOURCE bridge with no SOURCE binding or grant.
    // All following HUMAN API and accidental-ACL cases must retain their result.
    await owner.query(`GRANT CREATE ON DATABASE ${DATABASE} TO profitia_ingestion_owner`)
    await owner.query('BEGIN;SET LOCAL ROLE profitia_ingestion_owner')
    try {
      await owner.query(fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/access/008-platform-ingestion.sql',import.meta.url),'utf8'))
      await owner.query(fs.readFileSync(new URL('../db/private-store/004-corporate-source.sql',import.meta.url),'utf8'))
      await owner.query('GRANT USAGE ON SCHEMA profitia_srm_catalog TO profitia_access_owner;GRANT EXECUTE ON FUNCTION profitia_srm_catalog.scope_allows(text,boolean),profitia_srm_catalog.current_packet(text,boolean),profitia_srm_catalog.known_proof(text,uuid),profitia_srm_catalog.valid_stored_section(text,text,jsonb) TO profitia_access_owner')
      await owner.query('COMMIT')
    } catch(error) {await owner.query('ROLLBACK');throw error}
    await owner.query(`REVOKE CREATE ON DATABASE ${DATABASE} FROM profitia_ingestion_owner`)
    await owner.query('BEGIN;SET LOCAL ROLE profitia_access_owner')
    try {
      await owner.query(fs.readFileSync(new URL('../db/private-store/005-corporate-source-access.sql',import.meta.url),'utf8'))
      await owner.query(`GRANT EXECUTE ON FUNCTION srm.corporate_catalog_scope(text,boolean) TO ${ROLE}`)
      await owner.query('COMMIT')
    } catch(error) {await owner.query('ROLLBACK');throw error}
    const runtimeUrl = new URL(dbUrl); runtimeUrl.username = ROLE; runtimeUrl.password = 'isolated_ci_only'
    pool = new pg.Pool({ connectionString: runtimeUrl.toString(), max: 3 }); auditPool = new pg.Pool({ connectionString: runtimeUrl.toString(), max: 1 })
    assert.equal((await pool.query('SELECT current_user')).rows[0].current_user, ROLE)
    let revoked = false
    // SDK responses are synthetic; no live login or custom JWT verifier.
    const clerk = { async authenticateRequest(request) {
      const user = request.headers.get('authorization')?.replace(/^Bearer external-/, '')
      const auth = { isAuthenticated: true, tokenType: 'session_token', userId: `external-${user}`, sessionId: `session-${user}`, actor: null, sessionClaims: { iss: ISSUER, sub: `external-${user}`, sid: `session-${user}`, azp: ORIGIN, exp: Math.floor(Date.now() / 1000) + 3600 } }
      return { status: [U, V].includes(user) ? 'signed-in' : 'signed-out', isAuthenticated: [U, V].includes(user), toAuth: () => auth }
    }, sessions: { async getSession(id) { return { id, userId: id.replace('session-', 'external-'), status: revoked ? 'revoked' : 'active', expireAt: Date.now() + 3600000, abandonAt: Date.now() + 3600000, actor: null } } }, users: { async getUser(id) { return { id, banned: false, locked: false, deprovisioned: false } } } }
    const resourceId = `supplier-report:COMPANY:${NIP}`
    const options = { pool, auditPool, clerk, application: { appId: 'srm', profileId: 'SUPPLIER_INTELLIGENCE_STANDALONE', environment: 'development', deploymentId: 'isolated-srm', configurationVersion: '1', identityIssuer: ISSUER, organisationId: null, features: ['supplier_report'], operations: ['supplier.report.read', 'supplier.report.project'] }, identity: { appId: 'srm', environment: 'development', issuer: ISSUER, authorizedParties: [ORIGIN] }, binding: { applicationId: 'srm', environment: 'development', projectId: 'isolated-private-project', branchId: 'isolated-private-branch', databaseName: DATABASE, role: ROLE, schemaDigest: digest },
      readResources: async ({ request, scope, query }) => {
        assert.equal(request.resourceId, resourceId)
        const row = (await query('SELECT financial_sha256 FROM srm.catalog_companies WHERE nip=$1', [NIP])).rows[0]; assert(row)
        return { resource: { id: resourceId, type: 'supplier_projection', dataClass: 'ORGANISATION_PRIVATE', environment: scope.environment, ownerOrganisationId: scope.organisationId, ownerUserId: null, version: 'synthetic-scope-v1', projectionVersion: 'operation-v1' }, inputs: [{ id: `shared-report:${NIP}`, type: 'supplier_report', dataClass: 'SHARED_KNOWLEDGE', environment: scope.environment, ownerOrganisationId: null, ownerUserId: null, version: row.financial_sha256, projectionVersion: 'operation-v1', approvedSharedProjection: true }] }
      },
      projectOutput: async (response, context) => {
        assert(response instanceof Response); const body = await response.clone().json(); assert.equal(body.nip, NIP)
        assert([A, B].includes(context.organisationId))
        const encoded = JSON.stringify(body)
        for (const value of ['payload_json', 'private-not-public', 'source_organization_id', 'sourceSnapshotId']) assert(!encoded.includes(value))
        return response
      },
    }
    options.module = { id: 'supplier_report', schemaDigest: moduleDigest, auditSchemaDigest: auditDigest }
    const host = createSrmPrivateOperationHost(options)
    const { createOperationReportDataHandler } = await import('../src/server/operation-report-data.ts')
    const { readResources: _readResources, projectOutput: _projectOutput, ...reportOptions } = options
    const reportHost = createSrmReportOperationHost(reportOptions)
    const reportEnvironment = { SRM_DEMO_SESSION_SECRET: 'isolated-preference-key-not-a-customer-secret' }
    const dispatch = createRuntimeSrmReportHandler(() => ({ provider: 'clerk', executor: reportHost, defaultOrganisationId: A }),
      async () => { throw Error('No demo fallback in private report fixture') }, reportEnvironment)
    process.env.PROFITIA_AUTH_PROVIDER = 'clerk'
    const handler = async request => {
      const response = await middleware(new NextRequest(request.clone()))
      assert.equal(response.headers.get('x-middleware-next'), '1')
      return dispatch(request)
    }
    const request = (org = A, user = U, headers = {}) => new Request(`${ORIGIN}/api/xray/report-data?organisationId=${org}`, { method: 'POST', headers: { authorization: `Bearer external-${user}`, 'content-type': 'application/json', ...headers }, body: JSON.stringify({ nip: NIP, entityType: 'COMPANY', organisationId: B, role: 'owner' }) })
    const documents = async () => (await owner.query('SELECT organization_id,document_json FROM srm.financial_source_documents ORDER BY organization_id')).rows
    const input = { contractId: OPERATION_CONTRACT.id, contractVersion: OPERATION_CONTRACT.version, operation: 'supplier.report.project', organisationId: A, resourceId, payload: { nip: NIP, entityType: 'COMPANY' }, request: request() }
    await t.test('forged headers do not restore documents', async () => {
      assert.equal((await handler(request(A, U, { authorization: '', 'x-clerk-user-id': U, 'x-clerk-org-id': A, 'x-clerk-org-role': 'admin' }))).status, 401)
      assert.equal((await documents()).length, 0)
    })
    await t.test('SDK reception alone cannot enable private Supplier reads reveals or exports in the current report host',async()=>{
      let effects=0
      for(const operation of ['supplier.private.read','supplier.private.reveal','supplier.private.export']){
        await assert.rejects(reportHost.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,
          operation,organisationId:A,resourceId:'private-supplier-synthetic',payload:{},request:request()},
          async()=>{effects++;return null}),error=>isOperationDenied(error)&&error.reasonCode==='PERMISSION_DENIED')
      }
      assert.equal(effects,0);assert.equal((await documents()).length,0)
    })
    await t.test('real report restores its private archive in the same access/audit transaction', async () => {
      const response = await handler(request()); assert.equal(response.status, 200); assert.equal((await response.json()).financial.periods[0].facts[0].amount, '100')
      const rows = await documents(); assert.equal(rows.length, 1); assert.equal(rows[0].organization_id, A)
      assert.equal(rows[0].document_json.rows[0].amounts.KwotaA, '100')
      assert.deepEqual((await owner.query("SELECT phase FROM profitia_access.security_events WHERE event->>'decision'='ALLOW' ORDER BY event_id")).rows.map(row => row.phase), ['INTENT', 'OUTCOME'])
      const events = (await owner.query("SELECT event FROM profitia_access.security_events WHERE event->>'decision'='ALLOW' ORDER BY event_id")).rows.map(row => row.event)
      assert.equal(events[0].moduleEvidence.moduleId, 'supplier_report')
      assert.equal(events[0].moduleEvidence.auditSchemaDigest, auditDigest)
      assert.deepEqual(events[1].moduleEvidence, events[0].moduleEvidence)
    })
    await t.test('another organisation retains its distinct archive and personal scopes remain distinct', async () => {
      assert.equal((await handler(request(B))).status, 200)
      const rows = await documents(); assert.equal(rows.length, 2); assert.equal(rows[1].document_json.rows[0].amounts.KwotaA, '999')
      assert.equal((await handler(request(B, V))).status, 403)
      const first = await (await handler(request(A, U))).json(), second = await (await handler(request(A, V))).json()
      assert.notEqual(first.preferenceScope, second.preferenceScope)
    })
    await t.test('server default and malformed duplicate contexts use the same deployed dispatcher', async () => {
      const base = request(), url = new URL(base.url); url.searchParams.delete('organisationId')
      const response = await handler(new Request(url, base)); assert.equal(response.status, 200)
      assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
      assert.equal(response.headers.get('Vary'), 'Cookie, Authorization')
      for (const query of [`?organisationId=${A}&organisationId=${B}`, '?organisationId=', '?organisationId=demo']) {
        const r = request(); assert.equal((await handler(new Request(ORIGIN + '/api/xray/report-data' + query, r))).status, 400)
      }
    })
    await t.test('the dedicated profile refuses a foreign organisation despite its valid membership', async () => {
      const dedicated = createSrmReportOperationHost({ ...reportOptions, application: { ...reportOptions.application, profileId: 'PORR_SUITE', organisationId: A } })
      const route = createRuntimeSrmReportHandler(() => ({ provider: 'clerk', executor: dedicated, defaultOrganisationId: A }), undefined, reportEnvironment)
      const before = (await owner.query("SELECT count(*)::int n FROM profitia_access.security_events WHERE phase='OUTCOME'")).rows[0].n
      // The accepted fixed-profile contract classifies this as CONTEXT_INVALID.
      assert.equal((await route(request(B))).status, 400)
      assert.equal((await owner.query("SELECT count(*)::int n FROM profitia_access.security_events WHERE phase='OUTCOME'")).rows[0].n, before)
      assert.equal((await route(request(A))).status, 200)
    })
    await t.test('an admitted empty stored-knowledge view returns explicit absence without a provider call', async () => {
      const base = request()
      const response = await handler(new Request(base.url, { method: 'POST', headers: base.headers,
        body: JSON.stringify({ nip: '0000000000', entityType: 'COMPANY' }) }))
      assert.equal(response.status, 200)
      const body = await response.json(); assert.equal(body.nip, '0000000000')
      assert.equal(body.financial.status, 'NOT_REQUESTED'); assert.deepEqual(body.financial.periods, [])
    })
    await t.test('the actual report output fence refuses mismatched supplier or an unexpected raw root field', async () => {
      const body = await (await handler(request())).json()
      for (const wrong of [{ ...body, nip: '0123456789' }, { ...body, payload_json: { synthetic: 'must-not-leave' } }]) {
        await assert.rejects(reportHost.execute(input, async () => Response.json(wrong)), error => error.reasonCode === 'RESOURCE_SCOPE_MISMATCH')
      }
    })
    await t.test('current SDK revocation and product revocation deny', async () => {
      revoked = true; assert.equal((await handler(request())).status, 401); revoked = false
      await owner.query("UPDATE profitia_access.product_grants SET status='REVOKED' WHERE organisation_id=$1", [A]); assert.equal((await handler(request())).status, 403)
      await owner.query("UPDATE profitia_access.product_grants SET status='ACTIVE' WHERE organisation_id=$1", [A])
    })
    await t.test('missing or revoked module cannot use otherwise valid product access', async () => {
      assert.throws(() => createSrmPrivateOperationHost({ ...options, module: undefined }), /explicit consistent/i)
      const wrong = createSrmPrivateOperationHost({ ...options, module: { ...options.module, auditSchemaDigest: 'f'.repeat(64) } })
      assert.equal((await createOperationReportDataHandler(wrong, { SRM_DEMO_SESSION_SECRET: 'isolated-preference-key-not-a-customer-secret' })(request())).status, 503)
      await owner.query("UPDATE profitia_modules.application_bindings SET status='REVOKED' WHERE application_id='srm'")
      try { assert.equal((await handler(request())).status, 403) }
      finally { await owner.query("UPDATE profitia_modules.application_bindings SET status='ACTIVE' WHERE application_id='srm'") }
    })
    await t.test('base-only lease and the legacy organisation setting cannot bypass the module fence', async () => {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const query = async (sql, values = []) => ({ rows: (await client.query(sql, values)).rows })
        const store = createAccessStore({ binding: options.binding })
        const identityBinding = await store.resolveBinding(query, { environment: 'development', issuer: ISSUER, subject: `external-${U}` })
        await store.lockAccess(query, { actor: { kind: 'HUMAN', actorId: U, userId: U, environment: 'development', audience: 'srm', issuer: ISSUER, expiresAt: expiry() }, identityBinding, organisationId: A })
        await client.query("SELECT set_config('srm.organization_id',$1,true)", [A])
        assert.equal((await client.query('SELECT * FROM srm.financial_source_documents')).rowCount, 0)
        assert.equal((await client.query('SELECT * FROM srm.catalog_companies')).rowCount, 0)
      } finally { await client.query('ROLLBACK'); client.release() }
      assert.equal((await handler(request())).status, 200)
    })
    await t.test('native pg preserves the dedicated module expiry state and records no false ALLOW', async () => {
      const event = (await owner.query("SELECT event FROM profitia_access.security_events WHERE phase='INTENT' ORDER BY event_id LIMIT 1")).rows[0].event
      const expired = { ...event, decisionId: randomUUID(), moduleEvidence: { ...event.moduleEvidence, expiresAt: new Date(Date.now() - 1000).toISOString() } }
      await assert.rejects(pool.query('SELECT profitia_access.append_audit($1::jsonb)', [JSON.stringify(expired)]), error => error.code === 'PT403')
    })
    await t.test('OUTCOME failure rolls back actual archive restoration', async () => {
      await owner.query('DELETE FROM srm.financial_source_documents WHERE organization_id=$1', [A])
      await owner.query("CREATE FUNCTION profitia_access.reject_test_outcome() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.phase='OUTCOME' THEN RAISE EXCEPTION 'synthetic outage'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_test_outcome BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION profitia_access.reject_test_outcome()")
      try { assert.equal((await handler(request())).status, 503); assert.equal((await documents()).filter(row => row.organization_id === A).length, 0) }
      finally { await owner.query('DROP TRIGGER reject_test_outcome ON profitia_access.security_events; DROP FUNCTION profitia_access.reject_test_outcome()') }
      const events = (await owner.query('SELECT phase,decision_id FROM profitia_access.security_events ORDER BY event_id DESC LIMIT 2')).rows
      assert.deepEqual(events.map(row => row.phase), ['FAILURE', 'INTENT']); assert.equal(events[0].decision_id, events[1].decision_id)
      assert.equal((await handler(request())).status, 200)
    })
    await t.test('total timeout closes the backend and rolls back before callback completes', async () => {
      const short = createSrmPrivateOperationHost({ ...options, transactionTimeoutMs: 250 })
      let insertedId
      await assert.rejects(short.execute(input, async (context, client) => {
        await client.query("SELECT set_config('srm.organization_id',$1,true)", [context.organisationId])
        insertedId = (await client.query("INSERT INTO srm.suppliers(organization_id,nip,display_name) VALUES($1,$2,'Must roll back') RETURNING id", [A, NIP])).rows[0].id
        await new Promise(resolve => setTimeout(resolve, 500)); return Response.json({ nip: NIP })
      }))
      assert(insertedId)
      assert.equal((await handler(request())).status, 200)
      await new Promise(resolve => setTimeout(resolve, 300))
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM srm.suppliers WHERE id=$1', [insertedId])).rows[0].n, 0)
    })
    await t.test('connection acquisition timeout destroys a late lease and pool recovers', async () => {
      const held = await Promise.all([pool.connect(), pool.connect(), pool.connect()])
      try { const short = createSrmPrivateOperationHost({ ...options, transactionTimeoutMs: 100 }); await assert.rejects(short.execute(input, async () => Response.json({ nip: NIP }))) }
      finally { for (const client of held) client.release() }
      await new Promise(resolve => setTimeout(resolve, 30))
      assert.equal((await handler(request())).status, 200)
    })
    await t.test('a manually bound private transaction without an accepted scope is rejected', async () => {
      const client = await pool.connect()
      try { await client.query('BEGIN'); await client.query("SELECT set_config('srm.organization_id',$1,true)", [A]); await assert.rejects(withOrganization(A, async () => null, bindOrganizationTransaction(A, client)), /private transaction scope/i) }
      finally { await client.query('ROLLBACK'); client.release() }
    })
    await t.test('legacy GUC alone cannot read private rows through old permissive policies', async () => {
      const client = await pool.connect()
      try {
        await client.query('BEGIN'); await client.query("SELECT set_config('srm.organization_id',$1,true)", [A])
        assert.equal((await client.query('SELECT * FROM srm.financial_source_documents')).rowCount, 0)
      } finally { await client.query('ROLLBACK'); client.release() }
    })
    await t.test('a conflicting legacy organisation cannot widen an admitted scope', async () => {
      await host.execute(input, async (_context, client) => {
        await client.query("SELECT set_config('srm.organization_id',$1,true)", [B])
        const rows = (await client.query('SELECT organization_id FROM srm.financial_source_documents')).rows
        assert(rows.length > 0); assert(rows.every(row => row.organization_id === A))
        return Response.json({ nip: NIP })
      })
      let denied = false
      await assert.rejects(host.execute(input, async (_context, client) => {
        await client.query("SELECT set_config('srm.organization_id',$1,true)", [B])
        try { await client.query("INSERT INTO srm.suppliers(organization_id,nip,display_name) VALUES($1,$2,'Forbidden')", [B, NIP]) }
        catch (error) { denied = error.code === '42501'; throw error }
        return Response.json({ nip: NIP })
      }))
      assert.equal(denied, true)
    })
    await t.test('unadopted KYS stays row-closed even with a valid module and accidental permissive policy', async () => {
      assert.equal((await owner.query('SELECT count(*)::int n FROM srm.catalog_kys_reports')).rows[0].n, 1)
      await owner.query('CREATE POLICY synthetic_accidental_kys_admission ON srm.catalog_kys_reports FOR SELECT USING(true)')
      try {
        await host.execute(input, async (_context, client) => {
          assert.equal((await client.query('SELECT * FROM srm.catalog_kys_reports')).rowCount, 0)
          return Response.json({ nip: NIP })
        })
      } finally { await owner.query('DROP POLICY synthetic_accidental_kys_admission ON srm.catalog_kys_reports') }
    })
    await t.test('an accidental shared write ACL does not bypass the human write ceiling', async () => {
      const before = (await owner.query('SELECT updated_at FROM srm.catalog_companies WHERE nip=$1', [NIP])).rows[0].updated_at.toISOString()
      await host.execute(input, async (context, client) => {
        await client.query("SELECT set_config('srm.organization_id',$1,true)", [context.organisationId])
        assert.equal((await client.query('UPDATE srm.catalog_companies SET updated_at=now() WHERE nip=$1', [NIP])).rowCount, 0)
        return Response.json({ nip: NIP })
      })
      assert.equal((await owner.query('SELECT updated_at FROM srm.catalog_companies WHERE nip=$1', [NIP])).rows[0].updated_at.toISOString(), before)
    })
    await t.test('independent audit pool supports concurrent report operations and leaves no scope', async () => {
      const responses = await Promise.all(Array.from({ length: 6 }, () => handler(request())))
      assert.deepEqual(responses.map(response => response.status), [200, 200, 200, 200, 200, 200])
      const client = await pool.connect()
      try { assert.equal((await client.query('SELECT * FROM srm.financial_source_documents')).rowCount, 0); await assert.rejects(client.query('SELECT * FROM profitia_access.accounts'), /permission denied/) }
      finally { client.release() }
    })
    await t.test('expiry after an actual report-side write rolls back and keeps matching failure evidence', async () => {
      await owner.query("UPDATE profitia_modules.application_bindings SET expires_at=clock_timestamp()+interval '1 second' WHERE application_id='srm'")
      let id
      try {
        await assert.rejects(host.execute(input, async (context, client) => {
          await client.query("SELECT set_config('srm.organization_id',$1,true)", [context.organisationId])
          id = (await client.query("INSERT INTO srm.suppliers(organization_id,nip,display_name) VALUES($1,$2,'Must expire') RETURNING id", [A, NIP])).rows[0].id
          await new Promise(resolve => setTimeout(resolve, 1200)); return Response.json({ nip: NIP })
        }), error => error.reasonCode === 'ACCESS_BASIS_INVALID')
        assert(id)
        assert.equal((await owner.query('SELECT count(*)::int n FROM srm.suppliers WHERE id=$1', [id])).rows[0].n, 0)
        const events = (await owner.query('SELECT event FROM profitia_access.security_events ORDER BY event_id DESC LIMIT 2')).rows.map(row => row.event)
        assert.deepEqual(events.map(event => event.phase), ['FAILURE', 'INTENT'])
        assert.equal(events[0].reasonCode, 'ACCESS_BASIS_INVALID')
        assert.deepEqual(events[0].moduleEvidence, events[1].moduleEvidence)
      } finally { await owner.query("UPDATE profitia_modules.application_bindings SET expires_at=$1 WHERE application_id='srm'", [expiry()]) }
    })
    const exportOptions = { ...reportOptions, application: { ...reportOptions.application, operations: ['supplier.report.read','supplier.report.project','supplier.report.export'] } }
    const exportHost = createSrmReportOperationHost(exportOptions)
    const exportDispatch = createRuntimeSrmFinancialExcelHandler(() => ({ provider:'clerk',executor:exportHost,defaultOrganisationId:A }), async () => { throw Error('No export demo fallback') })
    const exportRequest = (org = A, user = U, selection = {}, headers = {}) => new Request(`${ORIGIN}/api/xray/financial-excel?organisationId=${org}`, { method:'POST',
      headers:{ authorization:`Bearer external-${user}`,'content-type':'application/json',origin:ORIGIN,...headers },
      body:JSON.stringify({nip:NIP,scope:'standalone',years:['2025'],...selection}) })
    const exportHandler = async request => {
      const next = await middleware(new NextRequest(request.clone()))
      assert.equal(next.headers.get('x-middleware-next'),'1')
      return exportDispatch(request)
    }
    const exportEvents = async after => (await owner.query("SELECT event FROM profitia_access.security_events WHERE event_id>$1 ORDER BY event_id",[after])).rows.map(row=>row.event)
    const lastEvent = async () => (await owner.query('SELECT coalesce(max(event_id),0)::text id FROM profitia_access.security_events')).rows[0].id
    await t.test('actual alternate export refuses missing export permission, forged identity and foreign origin before restoration',async()=>{
      await owner.query('DELETE FROM srm.financial_source_documents WHERE organization_id=$1',[A])
      assert.equal((await exportHandler(exportRequest())).status,403)
      assert.equal((await exportHandler(exportRequest(A,U,{}, {authorization:'','x-clerk-user-id':U,'x-clerk-org-id':A}))).status,401)
      assert.equal((await exportHandler(exportRequest(A,U,{}, {origin:'https://foreign.invalid'}))).status,403)
      assert.equal((await documents()).filter(row=>row.organization_id===A).length,0)
    })
    for(const org of [A,B]) await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'srm',$2,$3,'ALLOW','supplier.report.export','supplier_report')",[randomUUID(),org,U])
    await t.test('existing XLSX builder uses actual ordinary private SQL and emits distinct organisation data with four audit events',async()=>{
      for(const [org,amount] of [[A,100],[B,999]]){
        await owner.query('DELETE FROM srm.financial_source_documents WHERE organization_id=$1',[org])
        const before=await lastEvent(),response=await exportHandler(exportRequest(org))
        assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'private, no-store')
        assert.equal(response.headers.get('Vary'),'Cookie, Authorization')
        assert.match(response.headers.get('X-Download-Filename'),new RegExp(`^Financials_${NIP}_[0-9]{8}\\.xlsx$`))
        const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()))
        const balance=workbook.worksheets.find(sheet=>sheet.name.startsWith(`Balance_${NIP}_`));assert(balance)
        const values=[];balance.eachRow(row=>values.push(...row.values))
        assert(values.includes(amount));assert(!values.includes(org===A?999:100))
        assert.equal((await documents()).filter(row=>row.organization_id===org).length,1)
        const events=await exportEvents(before)
        assert.deepEqual(events.map(event=>[event.operation,event.phase]),[['supplier.report.export','INTENT'],['supplier.report.project','INTENT'],['supplier.report.project','OUTCOME'],['supplier.report.export','OUTCOME']])
        assert.equal(new Set(events.map(event=>event.correlationId)).size,1)
        assert.equal(new Set(events.map(event=>event.moduleEvidence.transactionId)).size,1)
        assert(events.every(event=>event.actorId===U&&event.organisationId===org&&event.subjectUserId===U))
        assert.notEqual(events[0].decisionId,events[1].decisionId)
      }
    })
    await t.test('each source permission and explicit DENY remain required for actual export',async()=>{
      for(const operation of ['supplier.report.read','supplier.report.project','supplier.report.export']){
        const denial=randomUUID()
        await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'srm',$2,$3,'DENY',$4,'supplier_report')",[denial,A,U,operation])
        await owner.query('DELETE FROM srm.financial_source_documents WHERE organization_id=$1',[A])
        try{assert.equal((await exportHandler(exportRequest())).status,403);assert.equal((await documents()).filter(row=>row.organization_id===A).length,0)}
        finally{await owner.query('DELETE FROM profitia_access.permission_grants WHERE grant_id=$1',[denial])}
      }
      assert.equal((await exportHandler(exportRequest(B,V))).status,403)
    })
    await t.test('actual export keeps malformed and duplicate contexts closed, and missing data/years have truthful outcomes',async()=>{
      for(const query of [`?organisationId=${A}&organisationId=${B}`,'?organisationId=','?organisationId=demo']){
        const r=exportRequest();assert.equal((await exportHandler(new Request(ORIGIN+'/api/xray/financial-excel'+query,r))).status,400)
      }
      for(const [selection,status,outcome] of [[{nip:'0000000000'},404,'NO_DATA'],[{years:['2024']},409,'SELECTION_UNAVAILABLE']]){
        const before=await lastEvent(),response=await exportHandler(exportRequest(A,U,selection))
        assert.equal(response.status,status);assert.equal(response.headers.get('X-Download-Filename'),null)
        assert.equal((await exportEvents(before)).at(-1).reasonCode,outcome)
      }
    })
    await t.test('final export OUTCOME outage rolls back actual preparation and records both failures without a file',async()=>{
      await owner.query('DELETE FROM srm.financial_source_documents WHERE organization_id=$1',[A])
      await owner.query("CREATE FUNCTION profitia_access.reject_export_outcome() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.phase='OUTCOME' AND NEW.event->>'operation'='supplier.report.export' THEN RAISE EXCEPTION 'synthetic export outage'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_export_outcome BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION profitia_access.reject_export_outcome()")
      const before=await lastEvent()
      try{
        const response=await exportHandler(exportRequest());assert.equal(response.status,503);assert.equal(response.headers.get('X-Download-Filename'),null)
        assert.equal((await documents()).filter(row=>row.organization_id===A).length,0)
      }finally{await owner.query('DROP TRIGGER reject_export_outcome ON profitia_access.security_events; DROP FUNCTION profitia_access.reject_export_outcome()')}
      const events=await exportEvents(before)
      assert.deepEqual(events.map(event=>[event.operation,event.phase]),[['supplier.report.export','INTENT'],['supplier.report.project','INTENT'],['supplier.report.project','FAILURE'],['supplier.report.export','FAILURE']])
      assert.equal(new Set(events.map(event=>event.correlationId)).size,1)
      assert.equal((await exportHandler(exportRequest())).status,200)
    })
    await t.test('current product or provider revocation cannot export despite prior success',async()=>{
      revoked=true
      try{assert.equal((await exportHandler(exportRequest())).status,401)}finally{revoked=false}
      await owner.query("UPDATE profitia_access.product_grants SET status='REVOKED' WHERE organisation_id=$1",[A])
      try{assert.equal((await exportHandler(exportRequest())).status,403)}finally{await owner.query("UPDATE profitia_access.product_grants SET status='ACTIVE' WHERE organisation_id=$1",[A])}
    })
    const sharedDispatch = createRuntimeSharedFinancialHandler(() => ({ provider: 'clerk', executor: reportHost, defaultOrganisationId: A }), {})
    const sharedRequest = (org=A,user=U,query={}) => {
      const url=new URL(ORIGIN+'/api/xray/financial-summary');url.searchParams.set('nip',NIP);url.searchParams.set('organisationId',org)
      for(const[key,value]of Object.entries(query))url.searchParams.set(key,value)
      return new Request(url,{headers:{authorization:`Bearer external-${user}`,'x-clerk-org-id':B}})
    }
    const sharedHandler=async request=>{
      assert.equal((await middleware(new NextRequest(request.clone()))).headers.get('x-middleware-next'),'1')
      return sharedDispatch(request)
    }
    const businessSnapshot=async()=>{
      const tables=(await owner.query("SELECT tablename FROM pg_tables WHERE schemaname='srm' ORDER BY tablename")).rows
      const result={}
      for(const{tablename}of tables){assert(/^[a-z_]+$/.test(tablename));result[tablename]=(await owner.query(`SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS data FROM srm.${tablename} t`)).rows[0].data}
      return result
    }
    await t.test('explicit peer read uses the actual ordinary receiver and rechecks product, organization and current session',async()=>{
      const receiver='https://srm-peer.fixture.test',path='/api/xray/financial-summary'
      const identity={...reportOptions.identity,authorizedParties:[ORIGIN,receiver],bearerPeerReads:[{sourceOrigin:ORIGIN,targetOrigin:receiver,path}]}
      const peerHost=createSrmReportOperationHost({...reportOptions,identity})
      const handler=createRuntimeSharedFinancialHandler(()=>({provider:'clerk',executor:peerHost,defaultOrganisationId:A}),{})
      const request=(org=A,user=U,pathname=path)=>{
        const url=new URL(receiver+pathname);url.searchParams.set('nip',NIP);url.searchParams.set('organisationId',org)
        return new Request(url,{headers:{authorization:`Bearer external-${user}`}})
      }
      const before=await businessSnapshot(),response=await handler(request())
      assert.equal(response.status,200);assert.equal((await response.json()).financial.periods[0].facts[0].amount,'100')
      assert.deepEqual(await businessSnapshot(),before)
      const closedHost=createSrmReportOperationHost({...reportOptions,identity:{...identity,bearerPeerReads:undefined}})
      const closed=createRuntimeSharedFinancialHandler(()=>({provider:'clerk',executor:closedHost,defaultOrganisationId:A}),{})
      assert.equal((await closed(request())).status,401)
      assert.equal((await handler(request(A,U,'/api/xray/report'))).status,401)
      assert.equal((await handler(request(B,V))).status,403)
      for(const header of['cookie','origin']){const r=request();r.headers.set(header,header==='origin'?receiver:'synthetic');assert.equal((await handler(r)).status,401)}
      revoked=true;try{assert.equal((await handler(request())).status,401)}finally{revoked=false}
      await owner.query("UPDATE profitia_access.product_grants SET status='REVOKED' WHERE organisation_id=$1",[A])
      try{assert.equal((await handler(request())).status,403)}finally{await owner.query("UPDATE profitia_access.product_grants SET status='ACTIVE' WHERE organisation_id=$1",[A])}
    })
    await t.test('shared real API works with SELECT only on three corporate tables and leaves every business table unchanged',async()=>{
      const original=(await owner.query("SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='srm' AND c.relkind='r' AND has_table_privilege($1,c.oid,'SELECT')",[ROLE])).rows
      assert(original.some(table=>table.relname==='mgbi_source_archives'))
      const before=await businessSnapshot(),eventBefore=await lastEvent()
      await owner.query(`REVOKE SELECT ON ALL TABLES IN SCHEMA srm FROM ${ROLE}`)
      await owner.query(`GRANT SELECT ON srm.catalog_companies,srm.catalog_financial_facts,srm.catalog_financial_indicators TO ${ROLE}`)
      try{
        assert.equal((await owner.query("SELECT has_table_privilege($1,'srm.mgbi_source_archives','SELECT') allowed",[ROLE])).rows[0].allowed,false)
        for(const org of[A,B]){
          const response=await sharedHandler(sharedRequest(org));assert.equal(response.status,200)
          const body=await response.json();assert.equal(body.financial.periods[0].facts[0].amount,'100')
          assert.equal(body.kys.status,'NOT_REQUESTED');assert.equal(body.kys.reportAvailable,false)
          for(const key of['scanner','exportRef','preferenceScope','private-not-public','sourceSnapshotId'])assert(!JSON.stringify(body).includes(key),key)
          assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(response.headers.get('Vary'),'Cookie, Authorization')
        }
        assert.deepEqual(await businessSnapshot(),before)
        const events=(await owner.query("SELECT event FROM profitia_access.security_events WHERE event_id>$1 ORDER BY event_id",[eventBefore])).rows.map(row=>row.event)
        assert.deepEqual(events.map(event=>[event.operation,event.phase]),[['supplier.report.read','INTENT'],['supplier.report.read','OUTCOME'],['supplier.report.read','INTENT'],['supplier.report.read','OUTCOME']])
        assert(events.every(event=>event.dataClass==='SHARED_KNOWLEDGE' && event.moduleEvidence.moduleId==='supplier_report'))
        assert.deepEqual(events.map(event=>event.organisationId),[A,A,B,B])
        assert.equal(events[0].correlationId,events[1].correlationId);assert.equal(events[2].correlationId,events[3].correlationId)
        assert.notEqual(events[0].correlationId,events[2].correlationId)
        assert.equal(events[0].moduleEvidence.transactionId,events[1].moduleEvidence.transactionId)
        assert.equal(events[2].moduleEvidence.transactionId,events[3].moduleEvidence.transactionId)
      }finally{
        await owner.query(`REVOKE SELECT ON ALL TABLES IN SCHEMA srm FROM ${ROLE}`)
        for(const{relname}of original){assert(/^[a-z_]+$/.test(relname));await owner.query(`GRANT SELECT ON srm.${relname} TO ${ROLE}`)}
      }
    })
    await t.test('shared read refuses forged identities, current revocations and dedicated-profile foreign context',async()=>{
      assert.equal((await sharedHandler(new Request(sharedRequest().url,{headers:{cookie:'unrelated','x-clerk-user-id':U,'x-clerk-org-id':A}}))).status,401)
      assert.equal((await sharedHandler(sharedRequest(B,V))).status,403)
      revoked=true;try{assert.equal((await sharedHandler(sharedRequest())).status,401)}finally{revoked=false}
      const denial=randomUUID()
      await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'srm',$2,$3,'DENY','supplier.report.read','supplier_report')",[denial,A,U])
      try{assert.equal((await sharedHandler(sharedRequest())).status,403)}finally{await owner.query('DELETE FROM profitia_access.permission_grants WHERE grant_id=$1',[denial])}
      for(const[table,where]of[['profitia_access.product_grants',`organisation_id='${A}'`],['profitia_modules.application_bindings',"application_id='srm'"]]){
        await owner.query(`UPDATE ${table} SET status='REVOKED' WHERE ${where}`)
        try{assert.equal((await sharedHandler(sharedRequest())).status,403)}finally{await owner.query(`UPDATE ${table} SET status='ACTIVE' WHERE ${where}`)}
      }
      const fixed=createSrmReportOperationHost({...reportOptions,application:{...reportOptions.application,profileId:'PORR_SUITE',organisationId:A}})
      const handler=createRuntimeSharedFinancialHandler(()=>({provider:'clerk',executor:fixed,defaultOrganisationId:A}),{})
      assert.equal((await handler(sharedRequest(B))).status,400)
      const noBearer=new Request(sharedRequest().url,{headers:{authorization:'Bearer unknown',cookie:`external-${U}`}})
      assert.equal((await handler(noBearer)).status,401)
    })
    await t.test('shared missing data remains empty and source substitution is rejected by the real ordinary role',async()=>{
      const body=await(await sharedHandler(sharedRequest(A,U,{nip:'0000000000'}))).json()
      assert.deepEqual(body.financial.periods,[]);assert.equal(body.financial.freshness.freshness,'ABSENT')
      await assert.rejects(reportHost.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'supplier.report.read',organisationId:A,resourceId,payload:{nip:NIP,entityType:'COMPANY'},request:sharedRequest()},async(context,client)=>{
        assert.equal(context.resource.version,hash(JSON.stringify(financial)))
        return readSharedFinancialReport(client,A,{nip:NIP,entityType:'COMPANY'},'b'.repeat(64))
      }),error=>error.reasonCode==='RESOURCE_SCOPE_MISMATCH')
    })
    await t.test('shared OUTCOME outage releases no DTO, records failure and changes no business data',async()=>{
      const before=await businessSnapshot(),eventBefore=await lastEvent()
      await owner.query("CREATE FUNCTION profitia_access.reject_shared_outcome() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.phase='OUTCOME' AND NEW.event->>'operation'='supplier.report.read' THEN RAISE EXCEPTION 'synthetic shared outage'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_shared_outcome BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION profitia_access.reject_shared_outcome()")
      try{const response=await sharedHandler(sharedRequest());assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'Operation unavailable'})}
      finally{await owner.query('DROP TRIGGER reject_shared_outcome ON profitia_access.security_events; DROP FUNCTION profitia_access.reject_shared_outcome()')}
      assert.deepEqual(await businessSnapshot(),before)
      const events=(await owner.query("SELECT event FROM profitia_access.security_events WHERE event_id>$1 ORDER BY event_id",[eventBefore])).rows.map(row=>row.event)
      assert.deepEqual(events.map(event=>[event.operation,event.phase]),[['supplier.report.read','INTENT'],['supplier.report.read','FAILURE']])
    })
  } finally { if (previousProvider === undefined) delete process.env.PROFITIA_AUTH_PROVIDER; else process.env.PROFITIA_AUTH_PROVIDER = previousProvider; globalThis.fetch = previousFetch; await pool?.end(); await auditPool?.end(); await owner?.end(); await root.end() }
})


test('SRM preserves historical AM23 source acceptance separately from current private intent adoption',async()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url))),accepted=manifest.externalRequestSourceCompatibility
 const sdk=await import('@profitia/platform-contracts/request-ledger')
 assert.equal(accepted.platformVersion,'1.14.0')
 assert.equal(accepted.producer.sourceSha,'70e6ebbd1bb931911fd3e3801f04e03d2d45b5df')
 assert.equal(accepted.sourceRecordIsHistorical,true)
 assert.equal(OPERATION_CONTRACT.implementation,'1.0.0-candidate.16')
 assert.equal(manifest.delegatedNativeWorkSourceCompatibility.rootImplementation,'1.0.0-candidate.13')
 assert.equal(manifest.privateAcquisitionSourceCompatibility.rootImplementation,'1.0.0-candidate.15')
 assert.equal(accepted.requestLedgerSourceDigest,'f87c7d482dfa3bb75a86f85c9e0df20e22c2a5f6ca973400fb2fd21713cbb78e')
 assert.equal(await sdk.requestLedgerSourceDigest(),currentSdkDigests.requestLedgerSourceDigest)
 assert.equal(await sdk.requestLedgerSourceDigest(),currentSdkDigests.requestLedgerSourceDigest)
 assert.equal(await sdk.requestReservationSchemaDigest(),accepted.baseSchemaDigest)
 assert.equal(await sdk.externalRequestSchemaDigest(),'8244a3a02d4ef5821822a6684023148c41bc9caac355c9f1200215e1a339df79')
 assert.equal(await sdk.externalRequestSchemaDigest(),accepted.externalSchemaDigest)
 assert.equal(accepted.adoptionStateIsHistorical,true)
 assert.equal(manifest.operations.includes('supplier.report.refresh'),true)
 assert.equal(manifest.supplierRequestAdoption.privateIntentApiAdopted,true)
 assert.equal(manifest.supplierRequestAdoption.providerExecutionAdopted,false)
 assert.equal(manifest.supplierRequestAdoption.defaultEnabled,false)
 for(const name of ['humanSupplierRefreshAdopted','sql010Installed','runtimeRoleOrGrantChanged','remoteExecutionAdopted','kysOrPersonalDataAdopted','productDeploymentPerformed'])assert.equal(accepted[name],false,name)
})

test('real native supplier request admission keeps command, quota and audit in one private transaction', async t => {
  const url = assertIsolatedTestConnection(process.env.SRM_OPERATION_TEST_OWNER_URL, 'srm_app', 'architecture_test_owner')
  const database = 'srm_request_' + randomUUID().replaceAll('-', '')
  const role = 'srm_supplier_request_runtime', otherRole = 'srm_supplier_other_runtime'
  const root = new pg.Client({ connectionString: url }); await root.connect()
  let owner, pool, auditPool, otherPool, revoked = false, calls = 0
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => { calls++; throw Error('No provider execution in request admission') }
  const requestSdk = await import('@profitia/platform-contracts/request-ledger')
  const baseSql = fs.readFileSync(new URL(requestSdk.requestReservationSchemaUrl), 'utf8')
  const externalSql = fs.readFileSync(new URL(requestSdk.externalRequestSchemaUrl), 'utf8')
  const commandSql = fs.readFileSync(new URL('../db/private-store/001-supplier-requests.sql', import.meta.url), 'utf8')
  const phaseSdk = await import('@profitia/platform-contracts/request-continuation')
  const phaseSql = fs.readFileSync(new URL(phaseSdk.requestContinuationSchemaUrl),'utf8'), phaseDigest=hash(phaseSql)
  const commandDigest = hash(commandSql), command = readSupplierRequest({ kind: 'SUPPLIER_REPORT', nip: NIP })
  const id = supplierRequestResourceId(command), key = 'synthetic-supplier-request-key-0001'
  try {
    assert.match(database, /^srm_request_[a-f0-9]{32}$/)
    assert.equal((await root.query('SELECT 1 FROM pg_database WHERE datname=$1', [database])).rowCount, 0)
    await root.query(`CREATE DATABASE ${database}`)
    await root.query("BEGIN;SELECT pg_advisory_xact_lock(170001,20261017)")
    for (const [name, login] of [['profitia_access_owner', false], [role, true], [otherRole, true]]) {
      if (!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [name])).rowCount)
        await root.query(`CREATE ROLE ${name} ${login ? "LOGIN PASSWORD 'isolated_ci_only'" : 'NOLOGIN'} NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`)
      assert.deepEqual((await root.query('SELECT rolcanlogin,rolinherit,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=$1', [name])).rows[0],
        { rolcanlogin: login, rolinherit: false, rolsuper: false, rolbypassrls: false, rolcreatedb: false, rolcreaterole: false })
    }
    await root.query(`ALTER ROLE ${role} CONNECTION LIMIT 4;ALTER ROLE ${otherRole} CONNECTION LIMIT 4;COMMIT`)
    const db = new URL(url); db.pathname = '/' + database
    owner = new pg.Client({ connectionString: db.toString() }); await owner.connect()
    await owner.query(`GRANT CREATE ON DATABASE ${database} TO profitia_access_owner;REVOKE ALL ON DATABASE ${database} FROM PUBLIC;GRANT CONNECT ON DATABASE ${database} TO ${role},${otherRole};REVOKE CREATE ON SCHEMA public FROM PUBLIC`)
    const runtime = new URL(db); runtime.username = role; runtime.password = 'isolated_ci_only'
    pool = new pg.Pool({ connectionString: runtime.toString(), max: 3 }); auditPool = new pg.Pool({ connectionString: runtime.toString(), max: 1 })
    runtime.username = otherRole; otherPool = new pg.Pool({ connectionString: runtime.toString(), max: 1 })
    assert.deepEqual((await pool.query('SELECT current_user::text AS role,session_user::text AS login')).rows[0], { role, login: role })
    assert.deepEqual((await pool.query("SELECT has_database_privilege(current_user,current_database(),'CREATE') AS create_allowed,has_database_privilege(current_user,current_database(),'TEMP') AS temp_allowed")).rows[0],{create_allowed:false,temp_allowed:false})
    const reset = async (capacity = 5) => {
      revoked = false
      assert.equal((await owner.query('SELECT current_database() db')).rows[0].db, database)
      await owner.query('DROP SCHEMA IF EXISTS srm CASCADE;DROP SCHEMA IF EXISTS supplier_phase_fixture CASCADE;DROP SCHEMA IF EXISTS profitia_request_phases CASCADE;DROP SCHEMA IF EXISTS profitia_supplier_requests CASCADE;DROP SCHEMA IF EXISTS profitia_requests CASCADE;DROP SCHEMA IF EXISTS profitia_modules CASCADE;DROP SCHEMA IF EXISTS profitia_access CASCADE')
      await owner.query(`GRANT CREATE ON DATABASE ${database} TO profitia_access_owner`)
      await owner.query('BEGIN;SET LOCAL ROLE profitia_access_owner')
      try {
        await owner.query(sql)
        await owner.query("INSERT INTO profitia_access.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','isolated-request-project','isolated-request-branch',$2)", [digest, database])
        await owner.query(moduleSql); await owner.query("INSERT INTO profitia_modules.installation(schema_version,schema_digest) VALUES('1.0.0',$1)", [moduleDigest])
        await owner.query(moduleAuditSql); await owner.query("INSERT INTO profitia_modules.audit_installation(envelope_version,schema_digest,source_ref) VALUES('1.0.0',$1,'SYNTHETIC_ONLY')", [auditDigest])
        await owner.query(baseSql); await owner.query("INSERT INTO profitia_requests.installation(schema_version,schema_digest,source_ref) VALUES('1.0.0',$1,'SYNTHETIC_ONLY')", [hash(baseSql)])
        await owner.query(externalSql); await owner.query("INSERT INTO profitia_requests.external_installation(schema_version,schema_digest,source_ref) VALUES('1.0.0',$1,'SYNTHETIC_ONLY')", [hash(externalSql)])
        await owner.query(commandSql); await owner.query("INSERT INTO profitia_supplier_requests.installation(schema_version,boundary_digest,source_ref) VALUES('1.0.0',$1,'SYNTHETIC_NOT_RELEASE')", [commandDigest])
        await owner.query(phaseSql);await owner.query("INSERT INTO profitia_request_phases.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_NATIVE_SRM_ONLY')",[phaseDigest])
        for (const user of [U,V]) {
          await owner.query("INSERT INTO profitia_access.accounts(user_id,status) VALUES($1,'ACTIVE')", [user])
          await owner.query("INSERT INTO profitia_access.external_identities(binding_id,issuer,subject,user_id,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'ACTIVE','SYNTHETIC_ONLY',$5)", [randomUUID(),ISSUER,'external-'+user,user,expiry()])
        }
        for (const org of [A,B]) {
          await owner.query("INSERT INTO profitia_access.organisations(organisation_id,status) VALUES($1,'ACTIVE')", [org])
          for (const user of org === A ? [U,V] : [U]) await owner.query("INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at) VALUES($1,$2,'ACTIVE','SYNTHETIC_ONLY',$3)", [org,user,expiry()])
        }
        for (const [app, login] of [['srm',role],['spendguru',otherRole]]) {
          await owner.query("INSERT INTO profitia_access.applications(application_id,status) VALUES($1,'ACTIVE')", [app])
          await owner.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES($1,$2,'ACTIVE')", [login,app])
          await owner.query("INSERT INTO profitia_modules.application_bindings(application_id,module_id,binding_id,status,source_ref,expires_at) VALUES($1,'supplier_report',$2,'ACTIVE','SYNTHETIC_ONLY',$3)", [app,randomUUID(),expiry()])
          for (const org of [A,B]) {
            await owner.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES($1,$2,'SUPPLIER_INTELLIGENCE',ARRAY['supplier_report'],'ACTIVE','EXPLICIT_OFFER','SYNTHETIC_ONLY',$3)", [app,org,expiry()])
            for (const user of org === A ? [U,V] : [U]) await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,$2,$3,$4,'ALLOW','supplier.report.refresh','supplier_report')", [randomUUID(),app,org,user])
            await owner.query("INSERT INTO profitia_requests.policies(policy_id,application_id,organisation_id,operation,status,source_ref,window_start,window_end,expires_at,capacity) VALUES($1,$2,$3,'supplier.report.refresh','ACTIVE','EXPLICIT_SYNTHETIC_POLICY',now()-interval '1 hour',now()+interval '2 hours',$4,$5)", [randomUUID(),app,org,expiry(),capacity])
          }
          await owner.query(`GRANT USAGE ON SCHEMA profitia_access,profitia_modules,profitia_requests,profitia_supplier_requests TO ${login};
            GRANT EXECUTE ON FUNCTION profitia_access.runtime_descriptor(),profitia_access.identity_binding(text,text),profitia_access.lock_access(uuid,uuid,text,text,text),profitia_access.scope_allows(text,uuid,uuid),profitia_access.append_audit(jsonb),profitia_modules.runtime_descriptor(),profitia_modules.bind_scope(text),profitia_modules.scope_allows(text,uuid,uuid),profitia_modules.audit_descriptor(),profitia_requests.runtime_descriptor(),profitia_requests.external_runtime_descriptor(),profitia_requests.scope_allows(text,uuid,uuid,text),profitia_requests.policy(text,uuid,uuid,text),profitia_requests.reserve(text,uuid,uuid,text,text,text,text,uuid,uuid,bigint),profitia_requests.accept(text,uuid,uuid) TO ${login};
            GRANT SELECT ON profitia_supplier_requests.installation,profitia_requests.intents TO ${login};GRANT SELECT,INSERT ON profitia_supplier_requests.commands TO ${login}`)
        }
        for(const[index,phaseId]of SUPPLIER_PRIVATE_PHASES.entries())await owner.query("INSERT INTO profitia_request_phases.policies(application_id,phase_id,sequence,predecessor,operation,effect,status,source_ref,expires_at) VALUES('srm',$1,$2,$3,'supplier.report.refresh','PRIVATE_SQL_PHASE','ACTIVE','SYNTHETIC_ONLY',$4)",[phaseId,index+1,SUPPLIER_PRIVATE_PHASES[index-1]??null,expiry()])
        await owner.query(`GRANT USAGE ON SCHEMA profitia_request_phases TO ${role};GRANT EXECUTE ON FUNCTION profitia_request_phases.descriptor(text),profitia_request_phases.parent_available(uuid,uuid,uuid,text,text),profitia_request_phases.reserve(uuid,text,text,uuid,bigint),profitia_request_phases.accept(uuid,text,text,uuid,bigint) TO ${role}`)
        await owner.query(`CREATE SCHEMA supplier_phase_fixture;CREATE TABLE supplier_phase_fixture.effects(request_id uuid REFERENCES profitia_supplier_requests.commands(request_id),phase_id text,data_json jsonb,organisation_id uuid,user_id uuid,resource_id text,PRIMARY KEY(request_id,phase_id));ALTER TABLE supplier_phase_fixture.effects ENABLE ROW LEVEL SECURITY;ALTER TABLE supplier_phase_fixture.effects FORCE ROW LEVEL SECURITY;CREATE POLICY controlled_owner ON supplier_phase_fixture.effects TO profitia_access_owner USING(true) WITH CHECK(true)`)
        const phaseFence="(profitia_access.runtime_descriptor()->>'applicationId')='srm' AND profitia_requests.scope_allows('supplier.report.refresh',organisation_id,user_id,resource_id)"
        await owner.query(`CREATE POLICY runtime_scope ON supplier_phase_fixture.effects TO ${role} USING(${phaseFence}) WITH CHECK(${phaseFence});CREATE POLICY runtime_fence ON supplier_phase_fixture.effects AS RESTRICTIVE TO ${role} USING(${phaseFence}) WITH CHECK(${phaseFence});GRANT USAGE ON SCHEMA supplier_phase_fixture TO ${role};GRANT SELECT,INSERT ON supplier_phase_fixture.effects TO ${role}`)
        await owner.query('COMMIT')
      } catch (error) { await owner.query('ROLLBACK'); throw error }
    }
    const clerk = { async authenticateRequest(request) {
      const user = request.headers.get('authorization')?.replace(/^Bearer external-/, ''), active = [U,V].includes(user)
      const auth = { isAuthenticated: true, tokenType: 'session_token', userId: 'external-'+user, sessionId: 'session-'+user,
        actor: null, sessionClaims: { iss:ISSUER,sub:'external-'+user,sid:'session-'+user,azp:ORIGIN,exp:Math.floor(Date.now()/1000)+3600 } }
      return { status: active?'signed-in':'signed-out', isAuthenticated:active, toAuth:()=>auth }
    }, sessions:{ async getSession(id) { return {id,userId:id.replace('session-','external-'),status:revoked?'revoked':'active',actor:null,expireAt:Date.now()+3600000,abandonAt:Date.now()+3600000} } },
      users:{async getUser(id){return{id,banned:false,locked:false,deprovisioned:false}}} }
    const binding = { applicationId:'srm',environment:'development',projectId:'isolated-request-project',branchId:'isolated-request-branch',databaseName:database,role,schemaDigest:digest }
    const options = { pool,auditPool,clerk,binding,module:{id:'supplier_report',schemaDigest:moduleDigest,auditSchemaDigest:auditDigest},
      identity:{appId:'srm',environment:'development',issuer:ISSUER,authorizedParties:[ORIGIN]},
      application:{appId:'srm',profileId:'SUPPLIER_INTELLIGENCE_STANDALONE',environment:'development',deploymentId:'isolated-srm-request',configurationVersion:'1',identityIssuer:ISSUER,organisationId:null,features:['supplier_report'],operations:['supplier.report.refresh']},
      requestLedger:{schemaDigest:hash(baseSql),externalSchemaDigest:hash(externalSql)},commandBoundaryDigest:commandDigest }
    const host = createSrmSupplierRequestOperationHost(options), handler = createOperationSupplierRequestHandler(host,A)
    const request = ({org=A,user=U,key:requestKey=key,body=command,headers={}}={}) => new Request(`${ORIGIN}/api/xray/requests?organisationId=${org}`, {
      method:'POST',headers:{authorization:`Bearer external-${user}`,'content-type':'application/json','idempotency-key':requestKey,...headers},body:JSON.stringify(body)})
    const input = () => ({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'supplier.report.refresh',organisationId:A,resourceId:id,payload:command,idempotencyKey:key,request:request()})
    const continuation = createSrmSupplierRequestContinuation({...options,continuationSchemaDigest:phaseDigest})
    const data={schemaVersion:'SYNTHETIC_PHASE_ONLY',values:[1,0,null]}
    const phaseInput=(requestId,patch={})=>({requestId,phaseId:'REGISTER_LOOKUP',organisationId:A,command,idempotencyKey:key,request:request(),data,...patch})
    const phaseAction=async(context,client,body)=>{
      assert(Object.isFrozen(body));assert.equal(context.requestContinuation.inputDigest,operationPayloadDigest(body))
      await client.query('INSERT INTO supplier_phase_fixture.effects VALUES($1,$2,$3::jsonb,$4,$5,$6)',[context.requestReservation.requestId,context.requestContinuation.phaseId,JSON.stringify(body),context.organisationId,context.actorId,context.resourceId])
    }
    const phaseCounts=async()=>(await owner.query("SELECT (SELECT count(*)::int FROM profitia_request_phases.effects)n,(SELECT count(*)::int FROM supplier_phase_fixture.effects)b")).rows[0]
    const counts = async () => (await owner.query("SELECT (SELECT count(*)::int FROM profitia_supplier_requests.commands)n,(SELECT count(*)::int FROM profitia_requests.intents)i,(SELECT coalesce(sum(accepted_count),0)::int FROM profitia_requests.policies WHERE application_id='srm')used")).rows[0]
    const scenario = async (name, work, capacity=5) => t.test(name,async()=>{await reset(capacity);await work()})
    await scenario('actual pg intent persists one closed command with current org/user/application and correlated audit', async()=>{
      const response = await handler(request());assert.equal(response.status,202)
      const receipt=await response.json();assert.deepEqual(Object.keys(receipt).sort(),['requestId','status']);assert.equal(receipt.status,'ACCEPTED')
      assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('vary'),'Cookie, Authorization')
      const row=(await owner.query('SELECT * FROM profitia_supplier_requests.commands')).rows[0]
      assert.equal(row.request_id,receipt.requestId);assert.equal(row.organisation_id,A);assert.equal(row.user_id,U);assert.equal(row.application_id,'srm');assert.deepEqual(row.command_json,command)
      assert.deepEqual(await counts(),{n:1,i:1,used:1})
      const events=(await owner.query("SELECT event FROM profitia_access.security_events ORDER BY event_id")).rows.map(r=>r.event)
      assert.deepEqual(events.map(e=>e.phase),['INTENT','OUTCOME']);assert.equal(events[0].correlationId,events[1].correlationId)
      assert(events.every(e=>e.operation==='supplier.report.refresh'&&e.organisationId===A&&e.actorId===U&&e.dataClass==='OPERATION_AUDIT'))
      assert(!JSON.stringify(events).includes(NIP));assert.equal(calls,0)
    })
    await scenario('same body/key replays without duplicate command, quota or a second domain action',async()=>{
      const [a,b]=await Promise.all([handler(request()),handler(request())]);assert.equal(a.status,202);assert.equal(b.status,202)
      assert.deepEqual(await a.json(),await b.json());assert.deepEqual(await counts(),{n:1,i:1,used:1})
      const response=await handler(request({body:{kind:'SUPPLIER_REPORT',nip:'5260250274'}}));assert.equal(response.status,409);assert.deepEqual(await counts(),{n:1,i:1,used:1})
    })
    await scenario('actor keys are distinct, and a previously bound key cannot move the same actor to another organisation',async()=>{
      const ids=[];for(const selector of[{},{user:V}]){const response=await handler(request(selector));assert.equal(response.status,202);ids.push((await response.json()).requestId)}
      assert.equal((await handler(request({org:B}))).status,409)
      const foreign=await handler(request({org:B,key:key+'-second-org'}));assert.equal(foreign.status,202);ids.push((await foreign.json()).requestId)
      assert.equal(new Set(ids).size,3);assert.deepEqual(await counts(),{n:3,i:3,used:3})
      assert.equal((await pool.query('SELECT * FROM profitia_supplier_requests.commands')).rowCount,0)
    })
    await scenario('finite current request policy refuses a new acceptance after capacity, while replay remains private',async()=>{
      assert.equal((await handler(request())).status,202)
      assert.equal((await handler(request({key:key+'-new'}))).status,429)
      assert.equal((await handler(request())).status,202);assert.deepEqual(await counts(),{n:1,i:1,used:1})
    },1)
    await scenario('unverified identity, missing membership and forged owner fields cannot accept',async()=>{
      const forged=new Request(request().url,{method:'POST',headers:{'content-type':'application/json','idempotency-key':key,'x-clerk-user-id':U,'x-clerk-org-id':A},body:JSON.stringify(command)})
      assert.equal((await handler(forged)).status,401);assert.equal((await handler(request({org:B,user:V}))).status,403)
      assert.equal((await handler(request({body:{...command,userId:V}}))).status,400);assert.deepEqual(await counts(),{n:0,i:0,used:0})
    })
    await scenario('current session, membership, permission, module and product revocation also refuse prior accepted receipts',async()=>{
      assert.equal((await handler(request())).status,202)
      revoked=true;assert.equal((await handler(request())).status,401);revoked=false
      for(const[table,where,field,bad,good]of[
        ['profitia_access.memberships',`organisation_id='${A}' AND user_id='${U}'`,'status','SUSPENDED','ACTIVE'],
        ['profitia_access.permission_grants',`application_id='srm' AND organisation_id='${A}' AND user_id='${U}'`,'effect','DENY','ALLOW'],
        ['profitia_modules.application_bindings',"application_id='srm'",'status','REVOKED','ACTIVE'],
        ['profitia_access.product_grants',`application_id='srm' AND organisation_id='${A}'`,'status','REVOKED','ACTIVE']]){
        await owner.query(`UPDATE ${table} SET ${field}='${bad}' WHERE ${where}`)
        try{assert.equal((await handler(request())).status,403)}finally{await owner.query(`UPDATE ${table} SET ${field}='${good}' WHERE ${where}`)}
      }
      assert.deepEqual(await counts(),{n:1,i:1,used:1})
    })
    await scenario('wrong command installation digest and revoked request policy refuse before any private effect',async()=>{
      const wrong=createSrmSupplierRequestOperationHost({...options,commandBoundaryDigest:'0'.repeat(64)})
      assert.equal((await createOperationSupplierRequestHandler(wrong,A)(request())).status,503)
      await owner.query("UPDATE profitia_requests.policies SET status='REVOKED' WHERE application_id='srm'")
      assert.equal((await handler(request())).status,503);assert.deepEqual(await counts(),{n:0,i:0,used:0})
    })
    await scenario('an expired finite policy and an absent command installation remain closed',async()=>{
      await owner.query("UPDATE profitia_requests.policies SET status='REVOKED' WHERE application_id='srm' AND organisation_id=$1",[A])
      await owner.query("INSERT INTO profitia_requests.policies(policy_id,application_id,organisation_id,operation,status,source_ref,window_start,window_end,expires_at,capacity) VALUES($1,'srm',$2,'supplier.report.refresh','ACTIVE','EXPLICIT_EXPIRED_FIXTURE',now()-interval '1 hour',now()+interval '1 hour',now()-interval '1 second',1)",[randomUUID(),A])
      assert.equal((await handler(request())).status,503)
      // Restore a valid policy before independently removing the installation.
      await reset()
      await owner.query('DELETE FROM profitia_supplier_requests.installation')
      assert.equal((await handler(request())).status,503);assert.deepEqual(await counts(),{n:0,i:0,used:0})
    })
    await scenario('ordinary RLS rejects forged command owner, environment, decision and payload within an otherwise valid request',async()=>{
      for(const patch of[{organisationId:B},{actorId:V},{environment:'staging'},{decisionId:randomUUID()},{requestReservation:{requestId:randomUUID(),replay:false}}]){
        await assert.rejects(host.execute(input(),(context,client)=>persistSupplierRequest({...context,...patch},client)))
        assert.deepEqual(await counts(),{n:0,i:0,used:0})
      }
    })
    await scenario('a foreign receipt cannot publish a new command or spend a second reservation',async()=>{
      const first=await (await handler(request())).json()
      await assert.rejects(host.execute({...input(),idempotencyKey:key+'-another'},async(context,client)=>{
        await persistSupplierRequest(context,client)
        return first
      }))
      assert.deepEqual(await counts(),{n:1,i:1,used:1})
    })
    await scenario('OUTCOME outage rolls back command and quota, retaining only the proper correlated failure',async()=>{
      await owner.query("CREATE FUNCTION profitia_access.fail_supplier_outcome() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.phase='OUTCOME' THEN RAISE EXCEPTION 'synthetic outcome outage';END IF;RETURN NEW;END $$;CREATE TRIGGER fail_supplier_outcome BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION profitia_access.fail_supplier_outcome()")
      try{assert.equal((await handler(request())).status,503)}finally{await owner.query('DROP TRIGGER fail_supplier_outcome ON profitia_access.security_events;DROP FUNCTION profitia_access.fail_supplier_outcome()')}
      assert.deepEqual(await counts(),{n:0,i:0,used:0})
      const events=(await owner.query('SELECT event FROM profitia_access.security_events ORDER BY event_id')).rows.map(r=>r.event)
      assert.deepEqual(events.map(e=>e.phase),['INTENT','FAILURE']);assert.equal(events[0].correlationId,events[1].correlationId)
    })
    await scenario('accidental command DML ACL cannot read outside scope, rewrite immutable commands or change the installation',async()=>{
      await handler(request());await owner.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA profitia_supplier_requests TO ${role}`)
      assert.equal((await pool.query('SELECT * FROM profitia_supplier_requests.commands')).rowCount,0)
      assert.equal((await pool.query('UPDATE profitia_supplier_requests.commands SET user_id=$1',[V])).rowCount,0)
      assert.equal((await pool.query('DELETE FROM profitia_supplier_requests.commands')).rowCount,0)
      assert.equal((await pool.query("UPDATE profitia_supplier_requests.installation SET source_ref='foreign'")).rowCount,0)
      await assert.rejects(pool.query('SET ROLE profitia_access_owner'),e=>e.code==='42501')
      await assert.rejects(pool.query('ALTER TABLE profitia_supplier_requests.commands DISABLE ROW LEVEL SECURITY'),e=>e.code==='42501')
      assert.deepEqual(await counts(),{n:1,i:1,used:1})
      const rows=(await owner.query("SELECT c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_supplier_requests' AND c.relkind='r'")).rows
      assert.equal(rows.length,2);assert(rows.every(r=>r.relrowsecurity&&r.relforcerowsecurity&&r.owner==='profitia_access_owner'))
    })
    await scenario('another permitted application with the same org/user/module/resource cannot read SRM command history',async()=>{
      await handler(request())
      const client=await otherPool.connect();const q=async(sql,values=[])=>({rows:(await client.query(sql,values)).rows})
      try{
        await client.query('BEGIN')
        const store=createAccessStore({binding:{...binding,applicationId:'spendguru',role:otherRole}})
        const identityBinding=await store.resolveBinding(q,{environment:'development',issuer:ISSUER,subject:'external-'+U})
        await store.lockAccess(q,{actor:{kind:'HUMAN',actorId:U,userId:U,issuer:ISSUER,audience:'spendguru',environment:'development',proofRef:'synthetic-verified-only',expiresAt:expiry()},identityBinding,organisationId:A})
        await client.query("SELECT profitia_modules.bind_scope('supplier_report')")
        assert.equal((await client.query("SELECT profitia_requests.scope_allows('supplier.report.refresh',$1::uuid,$2::uuid,$3) allowed",[A,U,id])).rows[0].allowed,true)
        assert.equal((await client.query('SELECT * FROM profitia_supplier_requests.commands')).rowCount,0)
        assert.equal((await client.query('SELECT * FROM profitia_supplier_requests.installation')).rowCount,0)
      }finally{await client.query('ROLLBACK');client.release()}
    })
    const acceptedParent=async()=>{const response=await handler(request());assert.equal(response.status,202);return(await response.json()).requestId}
    const businessSql=fs.readFileSync(new URL('../db/private-store/002-supplier-business-phases.sql',import.meta.url),'utf8'),businessDigest=hash(businessSql)
    const business=createSrmSupplierPrivateStore({continuation,boundaryDigest:businessDigest})
    const selection=(requestId,patch={})=>({requestId,organisationId:A,command,idempotencyKey:key,request:request(),...patch})
    const installBusiness=async()=>{
      await owner.query("UPDATE profitia_access.applications SET status='DISABLED'")
      await owner.query(`REVOKE CREATE ON DATABASE ${database} FROM profitia_access_owner`)
      const plan=privateBusinessPlan({binding:{environment:'development',projectId:binding.projectId,branchId:binding.branchId,databaseName:database,role},sourceSha:'a'.repeat(40)})
      await owner.query('BEGIN')
      try{for(const statement of plan.sql)await owner.query(statement);await owner.query('SET LOCAL ROLE profitia_access_owner');await owner.query(businessSql)
        await owner.query("INSERT INTO srm.supplier_business_installation VALUES(true,'1.0.0',$1,$2)",[businessDigest,'b'.repeat(40)])
        await owner.query(`GRANT EXECUTE ON FUNCTION srm.supplier_business_descriptor() TO ${role};GRANT INSERT,UPDATE ON srm.lookup_requests,srm.provider_attempts,srm.source_snapshots,srm.section_projections,srm.financial_facts,srm.mgbi_source_archives TO ${role}`)
        await owner.query('RESET ROLE;COMMIT')
      }catch(error){await owner.query('ROLLBACK');throw error}
      for(const[index,org]of[A,B].entries())await owner.query('INSERT INTO srm.organizations(id,slug) VALUES($1,$2)',[org,'business-fixture-'+index])
      await owner.query("UPDATE profitia_access.applications SET status='ACTIVE' WHERE application_id='srm'")
    }
    const general=()=>{const section=structuredClone(emptyCard.general);section.status='SUCCESS';section.source={provider:'MGBI',model:'pl-krs-wp-record',recordId:'synthetic-general'};section.retrievedAt=new Date().toISOString();section.data={...section.data,nip:NIP,legalName:'SYNTHETIC_PRIVATE_COMPANY'};return{section,errorCode:null,rawResponse:{pages:[{results:[{id:'synthetic-general',privateMarker:'SYNTHETIC_PRIVATE_MARKER'}]}],recordCount:1}}}
    const financial=()=>{
      const record={id:'synthetic-financial-2025',identifiers:{pl_nip:NIP,pl_krs:'0000000001'},document:{type:'financial_statement',period_from_date:'2025-01-01',period_to_date:'2025-12-31',filing_date:'2026-01-15',is_ias_compliant:false},content:{schema:{name:'JednostkaInnaWZlotych',version:'1-3'},extracted_fields:{'Naglowek.OkresOd':'2025-01-01','Naglowek.OkresDo':'2025-12-31','Bilans.Aktywa.KwotaA':'100','RZiS.RZiSKalk.A.KwotaA':'200'},standardized_fields:{bs:{a_ta_cfy:100},pala:{nrfs_cfy:200}}}}
      return{...mapMgbiFinancialRecords([record],{type:'NIP',value:NIP},new Date().toISOString()),rawResponse:{pages:[{results:[record]}],recordCount:1}}
    }
    const businessCounts=async()=>(await owner.query("SELECT (SELECT count(*)::int FROM srm.lookup_requests)lookups,(SELECT count(*)::int FROM srm.provider_attempts)attempts,(SELECT count(*)::int FROM srm.source_snapshots)snapshots,(SELECT count(*)::int FROM srm.section_projections)projections,(SELECT count(*)::int FROM srm.mgbi_source_archives)archives,(SELECT count(*)::int FROM srm.catalog_companies)shared")).rows[0]
    await scenario('actual existing supplier writers commit native business rows once under one accepted parent',async()=>{
      await installBusiness();const requestId=await acceptedParent(),input=selection(requestId),g=general(),f=financial()
      for(const[method,value,phase]of[['register',undefined,'REGISTER_LOOKUP'],['general',g,'STORE_GENERAL'],['financial',f,'STORE_FINANCIAL']]){
        assert.deepEqual(await business[method](input,value),{requestId,phaseId:phase,status:'COMMITTED'})
        assert.equal((await business[method](input,value)).status,'REPLAY')
      }
      assert.deepEqual(await businessCounts(),{lookups:1,attempts:2,snapshots:2,projections:2,archives:2,shared:0})
      assert.deepEqual(await counts(),{n:1,i:1,used:1})
      assert.deepEqual((await owner.query('SELECT organization_id,id,identifier FROM srm.lookup_requests')).rows,[{organization_id:A,id:requestId,identifier:NIP}])
      assert((await owner.query('SELECT count(*)::int n FROM srm.financial_source_documents')).rows[0].n>0)
      assert((await owner.query('SELECT count(*)::int n FROM srm.financial_facts')).rows[0].n>0)
      const events=(await owner.query("SELECT event FROM profitia_access.security_events WHERE phase='OUTCOME'")).rows
      assert.equal(events.length,7);assert(events.every(({event})=>event.actorId===U&&event.organisationId===A&&!JSON.stringify(event).includes('SYNTHETIC_PRIVATE_MARKER')))
    },1)
    await scenario('actual corporate writes refuse another actor, organization, parent, input change and phase order',async()=>{
      await installBusiness();const requestId=await acceptedParent(),g=general()
      await assert.rejects(business.general(selection(requestId),g))
      for(const patch of[{organisationId:B},{request:request({user:V})},{requestId:randomUUID()},{command:{kind:'SUPPLIER_REPORT',nip:'5260250274'}}])await assert.rejects(business.register(selection(requestId,patch)))
      await business.register(selection(requestId));await business.general(selection(requestId),g)
      await assert.rejects(business.general(selection(requestId),{...g,errorCode:'ALTERED_INPUT'}),e=>e.reasonCode==='IDEMPOTENCY_CONFLICT')
      assert.deepEqual(await businessCounts(),{lookups:1,attempts:1,snapshots:1,projections:1,archives:1,shared:0})
      await owner.query("UPDATE profitia_access.permission_grants SET effect='DENY' WHERE application_id='srm' AND organisation_id=$1 AND user_id=$2",[A,U])
      await assert.rejects(business.register(selection(requestId)));await assert.rejects(business.financial(selection(requestId),financial()))
      assert.deepEqual(await counts(),{n:1,i:1,used:1})
    })
    await scenario('actual private business SQL is rolled back on canonical OUTCOME failure',async()=>{
      await installBusiness();const requestId=await acceptedParent();await business.register(selection(requestId))
      await owner.query("CREATE FUNCTION profitia_access.reject_business_outcome() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.phase='OUTCOME' THEN RAISE EXCEPTION 'synthetic business audit outage'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_business_outcome BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION profitia_access.reject_business_outcome()")
      try{await assert.rejects(business.general(selection(requestId),general()))}finally{await owner.query('DROP TRIGGER reject_business_outcome ON profitia_access.security_events;DROP FUNCTION profitia_access.reject_business_outcome()')}
      assert.deepEqual(await businessCounts(),{lookups:1,attempts:0,snapshots:0,projections:0,archives:0,shared:0})
      assert.equal((await owner.query("SELECT count(*)::int n FROM profitia_request_phases.effects WHERE phase_id='STORE_GENERAL'")).rows[0].n,0)
      assert.equal((await business.general(selection(requestId),general())).status,'COMMITTED')
    })
    await scenario('ordinary SQL and genuine module context without a current phase cannot write business rows',async()=>{
      await installBusiness();const requestId=await acceptedParent()
      await assert.rejects(pool.query("INSERT INTO srm.suppliers(organization_id,nip) VALUES($1,$2)",[A,NIP]))
      const other={...input(),idempotencyKey:key+'-ordinary'}
      await assert.rejects(host.execute(other,async(context,client)=>{await client.query("SELECT set_config('srm.organization_id',$1,true)",[A]);await createLookup(A,{type:'NIP',value:NIP},'COMPANY',bindOrganizationTransaction(A,client),context.requestReservation.requestId)}))
      assert.equal((await businessCounts()).lookups,0)
      assert.equal((await business.register(selection(requestId))).status,'COMMITTED')
    })
    await scenario('real business phases keep the same supplier separate in two organizations and bind immutable input',async()=>{
      await installBusiness();const a=await acceptedParent(),bKey=key+'-org-b'
      const bResponse=await handler(request({org:B,key:bKey}));assert.equal(bResponse.status,202);const b=(await bResponse.json()).requestId
      const aSelection=selection(a),bSelection=selection(b,{organisationId:B,idempotencyKey:bKey,request:request({org:B,key:bKey})})
      await business.register(aSelection);await business.register(bSelection)
      const g=general(),pending=business.general(aSelection,g);g.section.data.legalName='MUTATED_AFTER_CAPTURE';await pending
      const other=general();other.section.data.legalName='SYNTHETIC_COMPANY_B';await business.general(bSelection,other)
      const rows=(await owner.query("SELECT organization_id,payload_json->>'legalName' name FROM srm.source_snapshots ORDER BY organization_id")).rows
      assert.deepEqual(rows,[{organization_id:A,name:'SYNTHETIC_PRIVATE_COMPANY'},{organization_id:B,name:'SYNTHETIC_COMPANY_B'}])
      assert.deepEqual(await businessCounts(),{lookups:2,attempts:2,snapshots:2,projections:2,archives:2,shared:0})
    })
    await scenario('real business phase refuses foreign NIP, a KYS attempt and a falsely granted installation writer',async()=>{
      await installBusiness();const requestId=await acceptedParent();await business.register(selection(requestId))
      for(const action of[
        async(context,client)=>{await client.query("SELECT set_config('srm.organization_id',$1,true)",[A]);await client.query("INSERT INTO srm.mgbi_source_archives(organization_id,nip,model,payload_json,payload_sha256,record_count,first_retrieved_at,last_checked_at,source_request_id) VALUES($1,'5260250274','pl-krs-wp-record','{}',$2,0,now(),now(),$3)",[A,'a'.repeat(64),requestId])},
        async(context,client)=>{await client.query("SELECT set_config('srm.organization_id',$1,true)",[A]);await client.query("INSERT INTO srm.provider_attempts(organization_id,request_id,section,provider,attempt_no,status,retrieval_method) VALUES($1,$2,'kys','VERCLY',1,'PENDING','PROVIDER')",[A,requestId])},
      ])await assert.rejects(continuation.run(phaseInput(requestId,{phaseId:'STORE_GENERAL'}),action))
      assert.deepEqual(await businessCounts(),{lookups:1,attempts:0,snapshots:0,projections:0,archives:0,shared:0})
      await owner.query(`GRANT UPDATE ON srm.supplier_business_installation TO ${role}`)
      try{await assert.rejects(business.general(selection(requestId),general()))}finally{await owner.query(`REVOKE UPDATE ON srm.supplier_business_installation FROM ${role}`)}
      assert.equal((await business.general(selection(requestId),general())).status,'COMMITTED')
    })
    await scenario('a later accepted refresh updates its own archive and keeps previous immutable snapshots',async()=>{
      await installBusiness();const a=await acceptedParent(),aSelection=selection(a),g=general()
      await business.register(aSelection);await business.general(aSelection,g)
      const nextKey=key+'-next-refresh',reply=await handler(request({key:nextKey}));assert.equal(reply.status,202)
      const b=(await reply.json()).requestId,bSelection=selection(b,{idempotencyKey:nextKey,request:request({key:nextKey})})
      await business.register(bSelection)
      const next=general();next.section.data.legalName='SYNTHETIC_LATER_COMPANY';next.rawResponse.pages[0].results[0].privateMarker='SYNTHETIC_LATER_MARKER'
      await business.general(bSelection,next)
      assert.deepEqual(await businessCounts(),{lookups:2,attempts:2,snapshots:2,projections:2,archives:1,shared:0})
      const archive=(await owner.query('SELECT source_request_id,payload_json,payload_jsonb_sha256 FROM srm.mgbi_source_archives')).rows[0]
      assert.equal(archive.source_request_id,b);assert.equal(archive.payload_json.pages[0].results[0].privateMarker,'SYNTHETIC_LATER_MARKER')
      assert.equal((await owner.query("SELECT encode(sha256(convert_to(payload_json::text,'UTF8')),'hex') actual FROM srm.mgbi_source_archives")).rows[0].actual,archive.payload_jsonb_sha256)
      const names=(await owner.query("SELECT payload_json->>'legalName' name FROM srm.source_snapshots ORDER BY created_at")).rows.map(r=>r.name)
      assert.deepEqual(names,['SYNTHETIC_PRIVATE_COMPANY','SYNTHETIC_LATER_COMPANY'])
    })
    const namedSql=fs.readFileSync(new URL('../db/private-store/003-named-supplier-interest.sql',import.meta.url),'utf8'),namedDigest=hash(namedSql)
    const named=createSrmSupplierPrivateStore({continuation,boundaryDigest:businessDigest,namedInterestBoundaryDigest:namedDigest})
    const installNamed=async({catalog=true,demo=false}={})=>{
      await installBusiness();await owner.query("UPDATE profitia_access.applications SET status='DISABLED' WHERE application_id='srm'")
      if(catalog)await owner.query('INSERT INTO srm.catalog_companies(nip) VALUES($1)',[NIP])
      if(demo){
        await owner.query("INSERT INTO srm.users(organization_id,id,subject_key,identity_kind) VALUES($1,$2,'demo-shared','SHARED_DEMO')",[A,'dddddddd-dddd-4ddd-8ddd-dddddddddddd'])
        await owner.query('INSERT INTO srm.organization_supplier_interest(organization_id,nip) VALUES($1,$2)',[A,NIP])
        await owner.query('INSERT INTO srm.user_supplier_interest(organization_id,user_id,nip) VALUES($1,$2,$3)',[A,'dddddddd-dddd-4ddd-8ddd-dddddddddddd',NIP])
      }
      await owner.query('BEGIN;SET LOCAL ROLE profitia_access_owner')
      try{
        await owner.query(namedSql);await owner.query("INSERT INTO srm.named_interest_installation VALUES(true,'1.0.0',$1,$2)",[namedDigest,'c'.repeat(40)])
        await owner.query(`GRANT SELECT,INSERT,UPDATE ON srm.users,srm.organization_supplier_interest,srm.user_supplier_interest TO ${role};GRANT EXECUTE ON FUNCTION srm.named_interest_descriptor(),srm.named_interest_actor(uuid) TO ${role}`)
        await owner.query('COMMIT')
      }catch(e){await owner.query('ROLLBACK');throw e}
      await owner.query("UPDATE profitia_access.applications SET status='ACTIVE' WHERE application_id='srm'")
    }
    const prepareNamed=async(selector={})=>{
      const reply=await handler(request(selector));assert.equal(reply.status,202);const requestId=(await reply.json()).requestId
      const selected=selection(requestId,{organisationId:selector.org??A,idempotencyKey:selector.key??key,request:request(selector)})
      await named.register(selected);await named.general(selected,general());await named.financial(selected,financial())
      return selected
    }
    const interestCounts=async()=>(await owner.query('SELECT (SELECT count(*)::int FROM srm.users)users,(SELECT count(*)::int FROM srm.organization_supplier_interest)organizations,(SELECT count(*)::int FROM srm.user_supplier_interest)personal')).rows[0]
    const readNamedScope=async(org,user,work)=>{
      const client=await pool.connect(),q=async(sql,values=[])=>({rows:(await client.query(sql,values)).rows})
      try{
        await client.query('BEGIN');const store=createAccessStore({binding})
        const identityBinding=await store.resolveBinding(q,{environment:'development',issuer:ISSUER,subject:'external-'+user})
        await store.lockAccess(q,{actor:{kind:'HUMAN',actorId:user,userId:user,issuer:ISSUER,audience:'srm',environment:'development',proofRef:'synthetic-verified-only',expiresAt:expiry()},identityBinding,organisationId:org})
        await client.query("SELECT profitia_modules.bind_scope('supplier_report')")
        return await work(client)
      }finally{await client.query('ROLLBACK');client.release()}
    }
    await scenario('named interest commits existing business rows once under one accepted current-user parent',async()=>{
      await installNamed();const selected=await prepareNamed()
      assert.equal((await named.interest(selected)).status,'COMMITTED');assert.equal((await named.interest(selected)).status,'REPLAY')
      assert.deepEqual(await interestCounts(),{users:1,organizations:1,personal:1});assert.deepEqual(await counts(),{n:1,i:1,used:1})
      const u=(await owner.query('SELECT organization_id,id,subject_key,identity_kind FROM srm.users')).rows[0]
      assert.equal(u.organization_id,A);assert.notEqual(u.id,U);assert.equal(u.subject_key,'profitia-account:'+U);assert.equal(u.identity_kind,'AUTHENTICATED')
      assert.equal((await owner.query('SELECT user_id FROM srm.user_supplier_interest')).rows[0].user_id,u.id)
      assert.equal((await businessCounts()).shared,1)
    },1)
    await scenario('two named users in one organization have separate choices and one shared organization choice',async()=>{
      await installNamed();for(const user of [U,V])await named.interest(await prepareNamed({user}))
      assert.deepEqual(await interestCounts(),{users:2,organizations:1,personal:2});assert.deepEqual(await counts(),{n:2,i:2,used:2})
      for(const user of[U,V])await readNamedScope(A,user,async client=>{
        const users=(await client.query('SELECT id,subject_key FROM srm.users')).rows;assert.equal(users.length,1);assert.equal(users[0].subject_key,'profitia-account:'+user)
        assert.deepEqual((await client.query('SELECT user_id FROM srm.user_supplier_interest')).rows,[{user_id:users[0].id}])
        assert.equal((await client.query('SELECT * FROM srm.organization_supplier_interest')).rowCount,1)
      })
      assert.equal((await pool.query('SELECT * FROM srm.user_supplier_interest')).rowCount,0)
    })
    await scenario('one internal account in two organizations receives distinct SRM surrogates and isolated choices',async()=>{
      await installNamed();for(const [org,requestKey]of[[A,key],[B,key+'-other-org']])await named.interest(await prepareNamed({org,key:requestKey}))
      const rows=(await owner.query('SELECT organization_id,id,subject_key FROM srm.users ORDER BY organization_id')).rows
      assert.equal(rows.length,2);assert.notEqual(rows[0].id,rows[1].id);assert(rows.every(r=>r.subject_key==='profitia-account:'+U))
      for(const org of[A,B])await readNamedScope(org,U,async client=>{
        assert.deepEqual((await client.query('SELECT organization_id FROM srm.users')).rows,[{organization_id:org}])
        assert.deepEqual((await client.query('SELECT organization_id FROM srm.user_supplier_interest')).rows,[{organization_id:org}])
      })
    })
    await scenario('missing shared company refuses private interest without creating a HUMAN global placeholder',async()=>{
      await installNamed({catalog:false});const selected=await prepareNamed();await assert.rejects(named.interest(selected))
      assert.deepEqual(await interestCounts(),{users:0,organizations:0,personal:0});assert.equal((await businessCounts()).shared,0)
      assert.equal((await owner.query("SELECT count(*)::int n FROM profitia_request_phases.effects WHERE phase_id='RECORD_INTEREST'")).rows[0].n,0)
      await owner.query('INSERT INTO srm.catalog_companies(nip) VALUES($1)',[NIP]);assert.equal((await named.interest(selected)).status,'COMMITTED')
    })
    await scenario('named selection preserves demo history without reassignment or visibility as personal history',async()=>{
      await installNamed({demo:true});const before=(await owner.query("SELECT to_jsonb(u) data FROM srm.users u WHERE identity_kind='SHARED_DEMO'")).rows[0].data
      await named.interest(await prepareNamed())
      assert.deepEqual((await owner.query("SELECT to_jsonb(u) data FROM srm.users u WHERE identity_kind='SHARED_DEMO'")).rows[0].data,before)
      assert.deepEqual(await interestCounts(),{users:2,organizations:1,personal:2})
      await readNamedScope(A,U,async client=>{assert.equal((await client.query('SELECT * FROM srm.users')).rowCount,1);assert.equal((await client.query('SELECT * FROM srm.user_supplier_interest')).rowCount,1)})
    })
    await scenario('wrong parent owner, organization, NIP, missing adapter and changed boundary fail closed',async()=>{
      await installNamed();const selected=await prepareNamed()
      assert.equal(business.interest,undefined)
      for(const patch of[{request:request({user:V})},{organisationId:B},{requestId:randomUUID()},{command:{kind:'SUPPLIER_REPORT',nip:'5260250274'}}])await assert.rejects(named.interest({...selected,...patch}))
      const wrong=createSrmSupplierPrivateStore({continuation,boundaryDigest:businessDigest,namedInterestBoundaryDigest:'0'.repeat(64)})
      await assert.rejects(wrong.interest(selected));assert.deepEqual(await interestCounts(),{users:0,organizations:0,personal:0})
      await owner.query("UPDATE profitia_access.permission_grants SET effect='DENY' WHERE application_id='srm' AND organisation_id=$1 AND user_id=$2",[A,U]);await assert.rejects(named.interest(selected))
    })
    await scenario('named OUTCOME failure rolls back mappings and both choices and never spends another parent quota',async()=>{
      await installNamed();const selected=await prepareNamed()
      await owner.query("CREATE FUNCTION profitia_access.reject_named_outcome() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.phase='OUTCOME' THEN RAISE EXCEPTION 'synthetic named audit outage';END IF;RETURN NEW;END $$;CREATE TRIGGER reject_named_outcome BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION profitia_access.reject_named_outcome()")
      try{await assert.rejects(named.interest(selected))}finally{await owner.query('DROP TRIGGER reject_named_outcome ON profitia_access.security_events;DROP FUNCTION profitia_access.reject_named_outcome()')}
      assert.deepEqual(await interestCounts(),{users:0,organizations:0,personal:0});assert.deepEqual(await counts(),{n:1,i:1,used:1})
      assert.equal((await named.interest(selected)).status,'COMMITTED')
    })
    await scenario('ordinary SQL, forged scope and a real module lease without the reserved named phase cannot mutate choices',async()=>{
      await installNamed();const selected=await prepareNamed()
      await assert.rejects(pool.query("INSERT INTO srm.users(organization_id,subject_key,identity_kind) VALUES($1,$2,'AUTHENTICATED')",[A,'profitia-account:'+U]))
      await readNamedScope(A,U,async client=>{await assert.rejects(recordSupplierInterest(client,A,NIP,{subjectKey:'profitia-account:'+U,identityKind:'AUTHENTICATED'}))})
      await assert.rejects(continuation.run({...selected,phaseId:'RECORD_INTEREST',data:{version:'FORGED'}},async(context,client)=>{
        await recordSupplierInterest(client,A,NIP,{subjectKey:'profitia-account:'+V,identityKind:'AUTHENTICATED'})
      }))
      assert.deepEqual(await interestCounts(),{users:0,organizations:0,personal:0});assert.equal((await named.interest(selected)).status,'COMMITTED')
    })
    await scenario('current expiry and accidental metadata ACL refuse; identity/first-selection and history cannot be rewritten',async()=>{
      await installNamed();const selected=await prepareNamed()
      await owner.query(`GRANT SELECT ON srm.named_interest_installation TO ${role}`)
      try{await assert.rejects(named.interest(selected))}finally{await owner.query(`REVOKE SELECT ON srm.named_interest_installation FROM ${role}`)}
      await named.interest(selected)
      const first=(await owner.query('SELECT first_selected_at,last_selected_at FROM srm.user_supplier_interest')).rows[0]
      assert.equal((await named.interest(selected)).status,'REPLAY');assert.deepEqual((await owner.query('SELECT first_selected_at,last_selected_at FROM srm.user_supplier_interest')).rows[0],first)
      await readNamedScope(A,U,async client=>{await assert.rejects(client.query('UPDATE srm.users SET subject_key=$1',["profitia-account:"+V]),e=>e.code==='42501')})
      await owner.query("UPDATE profitia_access.memberships SET expires_at=now()-interval '1 second' WHERE organisation_id=$1 AND user_id=$2",[A,U]);await assert.rejects(named.interest(selected))
      await assert.rejects(owner.query('TRUNCATE srm.users CASCADE'),e=>e.code==='42501')
    })
    await scenario('a later named selection reuses its own surrogate and retains immutable first-selection times',async()=>{
      await installNamed();await named.interest(await prepareNamed())
      const original=(await owner.query('SELECT user_id,first_selected_at,last_selected_at FROM srm.user_supplier_interest')).rows[0]
      await named.interest(await prepareNamed({key:key+'-later-selection'}))
      const later=(await owner.query('SELECT user_id,first_selected_at,last_selected_at FROM srm.user_supplier_interest')).rows[0]
      assert.equal(later.user_id,original.user_id);assert.deepEqual(later.first_selected_at,original.first_selected_at)
      assert(later.last_selected_at>=original.last_selected_at);assert.deepEqual(await interestCounts(),{users:1,organizations:1,personal:1})
      assert.deepEqual(await counts(),{n:2,i:2,used:2})
    })
    await scenario('native domain phase verifies the stored command and current actor before committing private SQL',async()=>{
      const requestId=await acceptedParent(),result=await continuation.run(phaseInput(requestId),phaseAction)
      assert.deepEqual(result,{requestId,phaseId:'REGISTER_LOOKUP',status:'COMMITTED'})
      const row=(await owner.query('SELECT * FROM supplier_phase_fixture.effects')).rows[0];assert.equal(row.organisation_id,A);assert.equal(row.user_id,U);assert.deepEqual(row.data_json,data)
      assert.deepEqual(await phaseCounts(),{n:1,b:1});assert.deepEqual(await counts(),{n:1,i:1,used:1})
    },1)
    await scenario('native concurrent continuation is once-only and a replay never executes its callback',async()=>{
      const requestId=await acceptedParent(),results=await Promise.all([continuation.run(phaseInput(requestId),phaseAction),continuation.run(phaseInput(requestId),phaseAction)])
      assert.deepEqual(new Set(results.map(r=>r.status)),new Set(['COMMITTED','REPLAY']))
      assert.deepEqual(await phaseCounts(),{n:1,b:1});assert.deepEqual(await counts(),{n:1,i:1,used:1})
    },1)
    await scenario('native phase rejects changed content, order and uninstalled phase without borrowing another intent',async()=>{
      const requestId=await acceptedParent()
      await assert.rejects(continuation.run(phaseInput(requestId,{phaseId:'STORE_FINANCIAL'}),phaseAction))
      await continuation.run(phaseInput(requestId),phaseAction)
      await assert.rejects(continuation.run(phaseInput(requestId,{data:{values:[999]}}),phaseAction),e=>e.reasonCode==='IDEMPOTENCY_CONFLICT')
      await assert.rejects(continuation.run(phaseInput(requestId,{phaseId:'REMOTE_PROVIDER'}),phaseAction),e=>e.reasonCode==='CONTEXT_INVALID')
      assert.deepEqual(await phaseCounts(),{n:1,b:1})
    })
    await scenario('all four native private phases reuse one accepted actor command and one quota unit',async()=>{
      const requestId=await acceptedParent()
      for(const phaseId of SUPPLIER_PRIVATE_PHASES)assert.equal((await continuation.run(phaseInput(requestId,{phaseId}),phaseAction)).status,'COMMITTED')
      assert.deepEqual(await phaseCounts(),{n:4,b:4});assert.deepEqual(await counts(),{n:1,i:1,used:1})
    },1)
    await scenario('native continuation refuses a random parent, foreign actor, organisation, command and idempotency binding',async()=>{
      const requestId=await acceptedParent()
      for(const patch of[{requestId:randomUUID()},{organisationId:B},{request:request({user:V})},{command:readSupplierRequest({kind:'SUPPLIER_REPORT',nip:'5260250274'})},{idempotencyKey:key+'-wrong'}])await assert.rejects(continuation.run(phaseInput(requestId,patch),phaseAction))
      assert.deepEqual(await phaseCounts(),{n:0,b:0});assert.deepEqual(await counts(),{n:1,i:1,used:1})
    })
    await scenario('native source scope cannot be assigned from an extra input field or caller-supplied continuation authority',async()=>{
      const requestId=await acceptedParent()
      await assert.rejects(continuation.run({...phaseInput(requestId),userId:V},phaseAction),e=>e.reasonCode==='CONTEXT_INVALID')
      assert.throws(()=>createSrmSupplierRequestContinuation({...options,continuationSchemaDigest:phaseDigest,requestContinuation:{requestId}}),TypeError)
      await continuation.run(phaseInput(requestId,{data:{userId:V,organisationId:B}}),phaseAction)
      const row=(await owner.query('SELECT organisation_id,user_id FROM supplier_phase_fixture.effects')).rows[0];assert.deepEqual(row,{organisation_id:A,user_id:U})
    })
    await scenario('current real-adapter session, membership and product revocation refuse both fresh and replayed native phases',async()=>{
      const requestId=await acceptedParent();await continuation.run(phaseInput(requestId),phaseAction)
      revoked=true;await assert.rejects(continuation.run(phaseInput(requestId),phaseAction),e=>e.reasonCode==='UNVERIFIED_IDENTITY');revoked=false
      for(const[table,where,field,bad,good]of[
        ['profitia_access.memberships',`organisation_id='${A}' AND user_id='${U}'`,'status','SUSPENDED','ACTIVE'],
        ['profitia_access.permission_grants',`application_id='srm' AND organisation_id='${A}' AND user_id='${U}'`,'effect','DENY','ALLOW'],
        ['profitia_modules.application_bindings',"application_id='srm'",'status','REVOKED','ACTIVE'],
        ['profitia_access.product_grants',`application_id='srm' AND organisation_id='${A}'`,'status','REVOKED','ACTIVE']]){
        await owner.query(`UPDATE ${table} SET ${field}='${bad}' WHERE ${where}`)
        try{for(const phaseId of ['REGISTER_LOOKUP','STORE_GENERAL'])await assert.rejects(continuation.run(phaseInput(requestId,{phaseId}),phaseAction))}finally{await owner.query(`UPDATE ${table} SET ${field}='${good}' WHERE ${where}`)}
      }
      assert.deepEqual(await phaseCounts(),{n:1,b:1})
    })
    await scenario('native phase action and OUTCOME errors roll back private rows while retaining its accepted parent',async()=>{
      const requestId=await acceptedParent()
      await assert.rejects(continuation.run(phaseInput(requestId),async(...args)=>{await phaseAction(...args);throw Error('SYNTHETIC_PHASE_CALLBACK_FAILURE')}))
      assert.deepEqual(await phaseCounts(),{n:0,b:0})
      await owner.query("CREATE FUNCTION profitia_access.fail_supplier_outcome() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.phase='OUTCOME' THEN RAISE EXCEPTION 'synthetic phase outcome outage';END IF;RETURN NEW;END $$;CREATE TRIGGER fail_supplier_outcome BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION profitia_access.fail_supplier_outcome()")
      try{await assert.rejects(continuation.run(phaseInput(requestId),phaseAction),e=>e.reasonCode==='AUDIT_UNAVAILABLE')}finally{await owner.query('DROP TRIGGER fail_supplier_outcome ON profitia_access.security_events;DROP FUNCTION profitia_access.fail_supplier_outcome()')}
      assert.deepEqual(await phaseCounts(),{n:0,b:0});assert.deepEqual(await counts(),{n:1,i:1,used:1})
    })
    await scenario('native callback cannot publish a private return value or continue after request cancellation',async()=>{
      const requestId=await acceptedParent()
      await assert.rejects(continuation.run(phaseInput(requestId),async(...args)=>{await phaseAction(...args);return {private:'SYNTHETIC_NOT_PUBLIC'}}))
      const abort=new AbortController(),cancelledRequest=new Request(request(),{signal:abort.signal})
      await assert.rejects(continuation.run(phaseInput(requestId,{request:cancelledRequest}),async(...args)=>{await phaseAction(...args);abort.abort()}))
      assert.deepEqual(await phaseCounts(),{n:0,b:0})
    })
    await scenario('native phase data is bounded finite JSON and cannot smuggle a body or configuration',async()=>{
      const requestId=await acceptedParent()
      for(const data of [{value:Infinity},{value:undefined},{value:'a'.repeat(MAX_PRIVATE_PHASE_BYTES)},{constructor:'foreign'},{value:new Date()}])await assert.rejects(continuation.run(phaseInput(requestId,{data}),phaseAction),e=>e.reasonCode==='CONTEXT_INVALID')
      await assert.rejects(continuation.run(phaseInput(requestId,{command:{...command,destination:'https://foreign.test'}}),phaseAction))
      assert.deepEqual(await phaseCounts(),{n:0,b:0})
    })
    await scenario('a bare accepted common receipt cannot replace the required SRM private command',async()=>{
      const result=await host.execute(input(),context=>({requestId:context.requestReservation.requestId,status:'ACCEPTED'}))
      const requestId=(await result.value.json()).requestId
      await assert.rejects(continuation.run(phaseInput(requestId),phaseAction),e=>e.reasonCode==='RESOURCE_SCOPE_MISMATCH')
      assert.deepEqual(await phaseCounts(),{n:0,b:0});assert.deepEqual(await counts(),{n:0,i:1,used:1})
    })
    assert.equal(calls,0)
  } finally {
    globalThis.fetch=originalFetch
    await pool?.end();await auditPool?.end();await otherPool?.end();await owner?.end();await root.end()
  }
})

test('historical Supplier delegation acceptance retains its values while current source remains exact',async()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url)))
 const current=manifest.supplierDelegationSourceCompatibility
 const jobs=await import('@profitia/platform-contracts/delegated-job')
 const host=await import('@profitia/platform-contracts/private-operation-host')
 assert.equal(current.platformVersion,'1.17.0');assert.equal(current.rootImplementation,'1.0.0-candidate.10');assert.equal(current.sourceRecordIsHistorical,true)
 assert.equal(current.producer.sourceSha,'978e9526c9ec79ed415a6aaf904d4dac5ea9cc02')
 assert.equal(current.producer.pullRequest,512)
 assert.deepEqual(jobs.DELEGATED_JOB_CONTRACT,{id:'profitia.delegated-job',version:'1.1.0'})
 assert.equal(host.PRIVATE_OPERATION_HOST_CONTRACT.version,manifest.delegatedNativeWorkSourceCompatibility.hostVersion)
 assert.equal(await jobs.delegatedJobSourceDigest(),currentSdkDigests.delegatedJobSourceDigest)
 assert.equal(await jobs.supplierDelegationSchemaDigest(),current.supplierSchemaDigest)
 assert.equal(await host.privateOperationHostSourceDigest(),currentSdkDigests.privateOperationHostSourceDigest)
 assert.equal(manifest.nativeExternalSourceCompatibility.sourceRecordIsHistorical,true)
 assert.equal(current.previousSourceRecordsAreHistorical,true);assert.equal(current.defaultForecastTargetUnchanged,true)
 assert.equal(Object.keys(current.sourceDigests).length,44)
 const sourceRoot=new URL('../',import.meta.resolve('@profitia/platform-contracts/delegated-job'))
 for(const[path,digest]of Object.entries(currentPlatformSourceDigests(manifest)))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(path,sourceRoot))).digest('hex'),digest,path)
 const binding={applicationId:'synthetic',environment:'development',projectId:'synthetic-project',branchId:'synthetic-branch',databaseName:'synthetic_db',role:'ordinary_fixture_role',schemaDigest:'a'.repeat(64)}
 assert.doesNotThrow(()=>jobs.createDelegatedJobStore({binding,schemaDigest:'b'.repeat(64)}))
 assert.throws(()=>jobs.createDelegatedJobStore({binding,schemaDigest:'b'.repeat(64),targetOperation:'supplier.report.refresh'}),TypeError)
 for(const key of ['supplierJobAdopted','supplierPrivateServicePhaseAdopted','sql013Installed','runtimeRoleOrGrantChanged','providerExecutionAdopted','productDeploymentPerformed'])assert.equal(current[key],false,key)
})

test('current optional delegated private phase source is exact and does not activate a Supplier business workflow',async()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url)))
 const current=manifest.delegatedPrivatePhaseSourceCompatibility
 const phases=await import('@profitia/platform-contracts/request-continuation')
 const hosts=await import('@profitia/platform-contracts/private-operation-host')
 assert.equal(current.platformVersion,'1.18.0');assert.equal(current.rootImplementation,'1.0.0-candidate.11');assert.equal(current.sourceRecordIsHistorical,true)
 assert.equal(current.hostVersion,'1.9.0');assert.equal(manifest.delegatedNativeWorkSourceCompatibility.hostVersion,hosts.PRIVATE_OPERATION_HOST_CONTRACT.version)
 assert.equal(current.continuationVersion,phases.REQUEST_CONTINUATION_CONTRACT.version)
 assert.equal(current.producer.sourceSha,'3e0788aa5309a668ba8c08a4b9ea53a04bbd8478');assert.equal(current.producer.pullRequest,516)
 assert.equal(await phases.requestContinuationSourceDigest(),currentSdkDigests.requestContinuationSourceDigest)
 assert.equal(await phases.delegatedPrivatePhasesSchemaDigest(),current.delegatedPrivatePhasesSchemaDigest)
 assert.equal(await hosts.privateOperationHostSourceDigest(),currentSdkDigests.privateOperationHostSourceDigest)
 assert.equal(current.previousSourceRecordsAreHistorical,true);assert.equal(current.defaultHumanAndForecastPreserved,true)
 const sourceRoot=new URL('../',import.meta.resolve('@profitia/platform-contracts/request-continuation'))
 assert.equal(Object.keys(current.sourceDigests).length,45)
 for(const[path,digest]of Object.entries(currentPlatformSourceDigests(manifest)))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(path,sourceRoot))).digest('hex'),digest,path)
 const unused=async()=>{throw Error('Constructor cannot authorize or query')}
 const application={appId:'synthetic-jobs',environment:'development',profileId:'PLATFORM_INTERNAL',deploymentId:'synthetic',configurationVersion:'1',identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,operations:['job.execute'],features:['job_execution']}
 const binding={applicationId:application.appId,environment:'development',projectId:'synthetic-project',branchId:'synthetic-branch',databaseName:'synthetic_db',role:'ordinary_fixture_role',schemaDigest:'a'.repeat(64),service:{schemaDigest:'a'.repeat(64),profileId:application.profileId,deploymentId:application.deploymentId,configurationVersion:application.configurationVersion}}
 const base={application,binding,job:{schemaDigest:'a'.repeat(64),targetOperation:'supplier.report.refresh',supplierSchemaDigest:'a'.repeat(64)},independentQuery:unused,transact:unused,readExternalAccount:unused}
 assert.equal(hosts.createDelegatedJobHost(base).runPrivatePhase,undefined)
 const host=hosts.createDelegatedJobHost({...base,privateContinuation:{schemaDigest:'b'.repeat(64),delegatedSchemaDigest:'c'.repeat(64)}})
 assert.equal(typeof host.runPrivatePhase,'function');assert.equal(host.deliver,undefined)
 assert.throws(()=>hosts.createDelegatedJobHost({...base,privateContinuation:{schemaDigest:'b'.repeat(64),delegatedSchemaDigest:'c'.repeat(64)},sourceDelivery:{deliver:unused}}),TypeError)
 for(const key of ['supplierPrivateServicePhaseAdopted','sql014Installed','runtimeRoleOrGrantChanged','providerExecutionAdopted','productDeploymentPerformed'])assert.equal(current[key],false,key)
})

test('optional committed phase inspection is accepted as exact source without adopting a product read',async()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url)))
 const current=manifest.delegatedPrivateInspectionSourceCompatibility
 const inspection=await import('@profitia/platform-contracts/request-inspection')
 const host=await import('@profitia/platform-contracts/private-operation-host')
 assert.equal(current.platformVersion,'1.19.0');assert.equal(current.rootImplementation,'1.0.0-candidate.12');assert.equal(current.sourceRecordIsHistorical,true)
 assert.equal(current.hostVersion,'1.10.0');assert.equal(manifest.delegatedNativeWorkSourceCompatibility.hostVersion,host.PRIVATE_OPERATION_HOST_CONTRACT.version)
 assert.equal(current.producer.sourceSha,'6260afa8771fbb427bd0b8e359557ab8f70dd9b5');assert.equal(current.producer.pullRequest,528)
 assert.equal(current.inspectionVersion,inspection.REQUEST_INSPECTION_CONTRACT.version)
 assert.equal(await inspection.requestInspectionSchemaDigest(),current.inspectionSchemaDigest)
 assert.equal(await inspection.requestInspectionSourceDigest(),current.inspectionSourceDigest)
 assert.equal(await host.privateOperationHostSourceDigest(),currentSdkDigests.privateOperationHostSourceDigest)
 assert.equal(current.defaultHumanAndForecastPreserved,true)
 const root=new URL('../',import.meta.resolve('@profitia/platform-contracts/request-inspection'))
 assert.equal(Object.keys(current.sourceDigests).length,48)
 for(const[path,digest]of Object.entries(currentPlatformSourceDigests(manifest)))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(path,root))).digest('hex'),digest,path)
 for(const key of['nativePrivateInspectionAdopted','sql015Installed','runtimeRoleOrGrantChanged','providerExecutionAdopted','productDeploymentPerformed'])assert.equal(current[key],false,key)
})

test('optional native SQL work accepts exact source without claiming native business adoption',async()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url)))
 const current=manifest.delegatedNativeWorkSourceCompatibility
 const work=await import('@profitia/platform-contracts/request-work')
 const host=await import('@profitia/platform-contracts/private-operation-host')
 assert.equal(current.platformVersion,'1.20.0');assert.equal(current.rootImplementation,'1.0.0-candidate.13');assert.equal(current.sourceRecordIsHistorical,true)
 assert.equal(current.hostVersion,host.PRIVATE_OPERATION_HOST_CONTRACT.version)
 assert.equal(current.producer.sourceSha,'025146034b42381c6e1eb812ed1c159c69d05bb1');assert.equal(current.producer.pullRequest,534)
 assert.deepEqual(work.REQUEST_WORK_CONTRACT,{id:'profitia.request-work',version:'1.0.0',effect:'PRIVATE_SQL_WORK',replayOwner:'EXISTING_DOMAIN_STATE'})
 assert.equal(current.workVersion,work.REQUEST_WORK_CONTRACT.version)
 assert.equal(await work.requestWorkSchemaDigest(),current.workSchemaDigest)
 assert.equal(await work.requestWorkSourceDigest(),currentSdkDigests.requestWorkSourceDigest)
 assert.equal(await host.privateOperationHostSourceDigest(),currentSdkDigests.privateOperationHostSourceDigest)
 assert.equal(typeof host.createDelegatedNativeWorkHost,'function')
 assert.equal(current.defaultHumanAndForecastPreserved,true)
 const root=new URL('../',import.meta.resolve('@profitia/platform-contracts/request-work'))
 assert.equal(Object.keys(current.sourceDigests).length,51)
 for(const[path,digest]of Object.entries(currentPlatformSourceDigests(manifest)))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(path,root))).digest('hex'),digest,path)
 for(const key of['nativeSqlWorkAdopted','sql016Installed','runtimeRoleOrGrantChanged','providerExecutionAdopted','productDeploymentPerformed'])assert.equal(current[key],false,key)
})

test('SRM explicitly receives platform1.21 without implicitly adopting sensitive HTTP paths or grants',async()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url)))
 const current=manifest.privateSupplierAccessSourceCompatibility
 const sdk=await import('@profitia/platform-contracts/operation-context')
 assert.equal(current.taskId,'SRM-E1-PRIVATE-SUPPLIER-CONTRACT-RECEPTION-20261019')
 assert.equal(current.platformVersion,'1.21.0');assert.equal(current.rootImplementation,'1.0.0-candidate.14')
 assert.equal(current.producer.sourceSha,'fe5b31f1390d2a9b12f7d16df7e35249c1a75402');assert.equal(current.producer.initialSourceSha,'48714e896f206b4d5b7693c163c34eba0c895c2a');assert.equal(current.producer.pullRequest,551)
 assert.equal(await sdk.operationSourceDigest(),manifest.contract.sourceDigest)
 assert.equal(Object.keys(current.sourceDigests).length,51)
 assert.equal(manifest.delegatedNativeWorkSourceCompatibility.sourceRecordIsHistorical,true)
 const root=new URL('../',import.meta.resolve('@profitia/platform-contracts/operation-context'))
 const {execFileSync}=await import('node:child_process')
 for(const[path,digest]of Object.entries(current.sourceDigests))assert.equal(createHash('sha256').update(execFileSync('git',['show',current.producer.sourceSha+':packages/platform-contracts/'+path])).digest('hex'),digest,path)
 for(const flag of ['previousFingerprintsPreserved','ordinarySrmFlowsPreserved'])assert.equal(current[flag],true,flag)
 for(const flag of ['privateSupplierPermissionsInferred','nativeSensitiveHttpAdopted','runtimeRoleOrGrantChanged','productDeploymentPerformed'])assert.equal(current[flag],false,flag)
 assert(manifest.operations.every(operation=>!operation.startsWith('supplier.private.')))
})


test('native sensitive receipt preserves historical fingerprints and pins current native KYS JDG and HUMAN projections without claiming release',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url)))
 const current=manifest.nativeSensitiveSupplierCompositionAdoption
 assert.equal(current.taskId,'SRM-E1-NATIVE-SENSITIVE-SUPPLIER-20261019');assert.equal(current.version,'srm-native-sensitive-v1')
 assert.equal(current.status,'SOURCE_CANDIDATE_NOT_RELEASED');assert.equal(current.authorityBeforeChange,'8819da4f96c1c9e3d20a9ace10a41b44c405fe8d')
 assert.equal(current.sensitiveWorkUnits,14);assert.equal(current.originalWorkUnits,18)
 assert.equal(current.sensitiveBoundaryDigest,hash(fs.readFileSync(new URL('../db/private-store/010-supplier-sensitive-work.sql',import.meta.url))))
 for(const[path,digest]of Object.entries(current.sourceDigests))assert.equal(hash(beforePrivateAcquisitionApplicationSource(path)),digest,path)
 for(const name of['previousBusinessFingerprintsPreserved','previousOptionalSqlBytesPreserved','sameOriginalKysAndJdgEngines','legacyDefaultRetained','organizationOwnedPrivateCache','sameCanonicalRequestDispatchAndSource','nativeHumanReadRevealExport','actorAndOrganizationScopedReferences','privateSourceBodiesStayPrivate'])assert.equal(current[name],true,name)
 for(const name of['cloudSqlInstalled','httpEndpointActivated','liveProviderAcquisitionVerified','liveCustomerSessionVerified','runtimeRoleOrGrantChanged','legacyDemoHistoryReassigned','mapsFunctionalityChanged','productDeploymentPerformed'])assert.equal(current[name],false,name)
})


test('SRM explicitly accepts additional request source while preserving old receipts and inactive HTTP targets',async()=>{
 const receipt=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url))),current=receipt.privateAcquisitionSourceCompatibility
 const sdk=await import('@profitia/platform-contracts/operation-context'),fsRoot=new URL('../',import.meta.resolve('@profitia/platform-contracts/operation-context'))
 assert.equal(current.taskId,'SRM-E1-PRIVATE-ACQUISITION-RECEPTION-20261020');assert.equal(current.platformVersion,'1.22.0');assert.equal(current.rootImplementation,'1.0.0-candidate.15')
 assert.equal(current.producer.sourceSha,'e71f9953d74f683e447f315e633db3696ec365ba');assert.equal(current.operationSchemaDigest,current.sourceDigests['migrations/access/017-additional-request-operations.sql']);assert.equal(Object.keys(current.sourceDigests).length,54)
 for(const[path,digest]of Object.entries(current.sourceDigests))assert.equal(createHash('sha256').update(execFileSync('git',['show',manifestPublicHistoryAuthority()+':packages/platform-contracts/'+path])).digest('hex'),digest,path)
 assert.equal(current.previousRecord,'privateSupplierAccessSourceCompatibility');assert.equal(receipt.privateSupplierAccessSourceCompatibility.platformVersion,'1.21.0')
 for(const flag of['previousFingerprintsPreserved','ordinaryFlowsPreserved'])assert.equal(current[flag],true)
 for(const flag of['privateAcquisitionHttpAdopted','cloudExtensionInstalled','runtimeRoleOrGrantChanged','productDeploymentPerformed'])assert.equal(current[flag],false)
 for(const operation of[...current.newRequestTargets,current.newReadTarget])assert(!receipt.operations.includes(operation))
})


test('private acquisition receipt preserves every previous field and binds the complete current native application closure',()=>{
 const receipt=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url))),current=receipt.privateSupplierAcquisitionAdoption
 const before=JSON.parse(execFileSync('git',['show','8c5e14b0fc4815021231f6752c1073f1c191465b:apps/srm/operation-integration.json'],{encoding:'utf8'}))
 for(const[key,value]of Object.entries(before))assert.deepEqual(['contract','producer'].includes(key)?receipt.supplierLocationSourceCompatibility.previousRootAcceptance[key]:receipt[key],value,key)
 assert.equal(current.taskId,'SRM-E1-PRIVATE-ACQUISITION-ADOPTION-20261020');assert.equal(current.operation,'supplier.private.refresh')
 assert.equal(current.platformVersion,'1.22.0');assert.equal(current.authorityBeforeChange,'8c5e14b0fc4815021231f6752c1073f1c191465b')
 assert.equal(current.previousApplicationSourceAuthority,current.authorityBeforeChange)
 assert.equal(current.transactionCompanion.taskId,'SRM-E1-PRIVATE-WORK-TRANSACTION-20261020')
 assert.equal(current.transactionCompanion.sourceSha,'b72110112f0ffad7c7a5473f8b88b8faeeaa9848')
 assert.deepEqual(new Set(Object.keys(current.sourceDigests)),new Set([...Object.keys(before.nativeSensitiveSupplierCompositionAdoption.sourceDigests),'src/server/private-runtime.ts','db/private-store/011-supplier-private-acquisition.sql']))
 for(const[path,digest]of Object.entries(current.sourceDigests))assert.equal(hash(execFileSync('git',['show',manifestPublicHistoryAuthority()+':apps/srm/'+path])),digest,path)
 assert.equal(current.operationSchemaDigest,receipt.privateAcquisitionSourceCompatibility.operationSchemaDigest)
 assert.equal(current.privateAcquisitionBoundaryDigest,hash(fs.readFileSync(new URL('../db/private-store/011-supplier-private-acquisition.sql',import.meta.url))))
 assert.deepEqual(current.privateTargets,[{entityType:'COMPANY',section:'kys'},{entityType:'JDG',section:'kys'},{entityType:'JDG',section:'jdg'}])
 for(const flag of['sameOriginalKysAndJdgEngines','sameCanonicalRequestDispatchWorkAndAudit','samePrivateCommandTable','publicNipOnlyCommandPreserved','privateEntityAndSectionBoundToResource','publicParentRefusedForPrivateWork','previousReceiptsPreserved','previousOptionalSqlBytesPreserved','nativePrivateAcquisitionAdopted','legacyDefaultRetained'])assert.equal(current[flag],true,flag)
 for(const flag of['privateGrantInferred','cloudSqlInstalled','httpEndpointActivated','runtimeRoleOrGrantChanged','liveProviderAcquisitionVerified','liveCustomerSessionVerified','legacyDemoHistoryReassigned','mapsFunctionalityChanged','productDeploymentPerformed'])assert.equal(current[flag],false,flag)
 for(const name of['001-supplier-requests.sql','002-supplier-business-phases.sql','003-named-supplier-interest.sql','004-corporate-source.sql','005-corporate-source-access.sql','006-delegated-supplier-business.sql','007-supplier-private-inspection.sql','008-supplier-native-work.sql','009-supplier-source-request.sql','010-supplier-sensitive-work.sql'])
  assert.deepEqual(fs.readFileSync(new URL('../db/private-store/'+name,import.meta.url)),beforePrivateAcquisitionApplicationSource('db/private-store/'+name),name)
})

function manifestPublicHistoryAuthority(){return '0403b34da82796c9c001be9cf53c5dcb6f9d823d'}

test('public web source receipt preserves historical records and verifies every current SDK file without activation',async()=>{
 const receipt=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url))),current=receipt.publicWebTransportSourceCompatibility
 const before=JSON.parse(execFileSync('git',['show',manifestPublicHistoryAuthority()+':apps/srm/operation-integration.json'],{encoding:'utf8'}))
 for(const[key,value]of Object.entries(before))assert.deepEqual(['contract','producer'].includes(key)?receipt.supplierLocationSourceCompatibility.previousRootAcceptance[key]:receipt[key],value,key)
 assert.equal(current.taskId,'SRM-E1-SUPPLIER-EXTERNAL-ADOPTION-20261020');assert.equal(current.platformVersion,'1.23.0');assert.equal(current.rootImplementation,receipt.supplierLocationSourceCompatibility.previousRootAcceptance.contract.implementation)
 assert.equal(current.producer.projectKey,'ARCHITECTURE');assert.equal(current.producer.sourceSha,'403255c88bbf81a67e384c269e38cae848b018f1')
 const sdk=await import('@profitia/platform-contracts/external-call'),root=new URL('../',import.meta.resolve('@profitia/platform-contracts/external-call'))
 assert.equal(JSON.parse(fs.readFileSync(new URL('package.json',root))).version,receipt.formReportAdmissionAdoption.platformVersion)
 assert.equal(await sdk.externalCallSourceDigest(),currentSdkDigests.externalCallSourceDigest)
 assert.equal(await sdk.publicWebTransportSchemaDigest(),current.sdkDigests.publicWebTransportSchemaDigest)
 assert.equal(Object.keys(current.sourceDigests).length,57)
 for(const[path,digest]of Object.entries(currentPlatformSourceDigests(receipt)))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(path,root))).digest('hex'),digest,path)
 for(const[path,digest]of Object.entries(receipt.privateAcquisitionSourceCompatibility.sourceDigests))assert.equal(createHash('sha256').update(execFileSync('git',['show',current.historicalSourceAuthority+':packages/platform-contracts/'+path])).digest('hex'),digest,path)
 for(const[path,digest]of Object.entries(receipt.nativeExternalSourceCompatibility.sourceDigests))assert.equal(createHash('sha256').update(execFileSync('git',['show',receipt.nativeExternalSourceCompatibility.producer.sourceSha+':packages/platform-contracts/'+path])).digest('hex'),digest,path)
 for(const flag of['previousFingerprintsPreserved','previousSourceRecordsAreHistorical','ordinaryFlowsPreserved'])assert.equal(current[flag],true,flag)
 for(const flag of['publicWebTransportAdopted','cloudExtensionInstalled','runtimeRoleOrGrantChanged','productDeploymentPerformed'])assert.equal(current[flag],false,flag)
})

test('working supplier HTTP progress verifies its complete source closure without claiming the unfinished website or deployment',()=>{
 const receipt=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url))),current=receipt.workingSupplierHttpSourceProgress
 assert.equal(current.taskId,'SRM-E1-WORKING-SUPPLIER-HTTP-20261020');assert.equal(current.status,'PARTIAL_SOURCE_NOT_RELEASED')
 assert.deepEqual(current.workingRoutes,['search','lookup','jdg','jdg/kys','kys','kys/pesel','kys/pdf','kys/krs'])
 assert.equal(current.previousApplicationAuthority,manifestPublicHistoryAuthority())
 for(const[path,digest]of Object.entries(current.sourceDigests))assert.equal(hash(execFileSync('git',['show',receipt.workingSupplierWebSourceProgress.previousProgressSourceAuthority+':apps/srm/'+path])),digest,path)
 for(const flag of['websiteImplemented','cloudSqlInstalled','runtimeRoleOrGrantChanged','productDeploymentPerformed'])assert.equal(current[flag],false,flag)
})

test('website source progress preserves its complete accepted nine-route closure before the explicit public identity boundary',()=>{
 const receipt=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url))),current=receipt.workingSupplierWebSourceProgress
 const before=JSON.parse(execFileSync('git',['show',current.previousProgressSourceAuthority+':apps/srm/operation-integration.json'],{encoding:'utf8'}))
 for(const[key,value]of Object.entries(before))assert.deepEqual(['contract','producer'].includes(key)?receipt.supplierLocationSourceCompatibility.previousRootAcceptance[key]:receipt[key],value,key)
 assert.equal(current.taskId,'SRM-E1-WORKING-SUPPLIER-HTTP-20261020')
 assert.equal(current.externalTaskId,'SRM-E1-SUPPLIER-EXTERNAL-ADOPTION-20261020');assert.equal(current.clientAndEntryTaskId,'SRM-E1-WEB-ENTRY-CLIENT-20261020')
 assert.deepEqual(current.workingRoutes,['search','lookup','jdg','jdg/kys','kys','kys/pesel','kys/pdf','kys/krs','web-identity'])
 assert.equal(receipt.publicIdentityRequestAdoption.previousApplicationAuthority,'05a7d705e1aeeae04465e59b371ea0cd5a0d4c06')
 for(const[path,digest]of Object.entries(current.sourceDigests))assert.equal(hash(execFileSync('git',['show',receipt.publicIdentityRequestAdoption.previousApplicationAuthority+':apps/srm/'+path])),digest,path)
 assert.equal(current.webBoundaryDigest,hash(fs.readFileSync(new URL('../db/private-store/012-supplier-web-identity.sql',import.meta.url))))
 const facade=fs.readFileSync(new URL('../src/server/safe-public-fetch.ts',import.meta.url),'utf8');assert(facade.includes("from '@profitia/platform-contracts/public-web-transport'"));assert(!facade.includes('http.get'))
 for(const flag of['previousRecordsPreserved','sameOriginalDiscoveryAndCacheWriter','perActualHopSourceAdmission','organizationOwnedAssociation','freshHumanReadBeforePublication','publicWebDataClassIsNotPrivateAssociation','sourceNetworkOutsideSqlTransaction','allNineExactEntryGuardsForwardToBackend'])assert.equal(current[flag],true,flag)
 for(const flag of['cloudSqlInstalled','runtimeRoleOrGrantChanged','liveCustomerSessionVerified','liveProviderAcquisitionVerified','productDeploymentPerformed'])assert.equal(current[flag],false,flag)
})
