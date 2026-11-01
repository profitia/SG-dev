import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {rootAtomicClaimSchemaDigest,rootAtomicClaimSourceDigest,ROOT_ATOMIC_CLAIM_CONTRACT} from '@profitia/platform-root-atomic-claim'
import root from '../../deployment/root-atomic-claim-targets.json'
import native from '../../deployment/supplier-native-targets.json'
import privateTargets from '../../deployment/private-runtime-targets.json'
import ready from '../../deployment/ready-report-targets.json'
import {readSrmPrivateReportConfiguration} from './private-runtime'
import {readSrmNativeSupplierConfiguration,createSrmNativeSupplierRuntime,type Configuration} from './supplier-native-runtime'
import {IdentityConfigurationUnavailable} from './identity-runtime'

function fixture(){
 const target=privateTargets.environments.development,issuer='https://identity-fixture.accounts.dev'
 const url=(role:string)=>`postgresql://${role}:synthetic_fixture_only@${target.hosts[0]}/${target.databaseName}?sslmode=require&channel_binding=require`
 const env:Record<string,string|undefined>={PROFITIA_AUTH_PROVIDER:'clerk',TARGET_ENVIRONMENT:'development',APP_ENV:'development',
  PROFITIA_CLERK_ISSUER:issuer,PROFITIA_CLERK_PUBLISHABLE_KEY:`pk_test_${Buffer.from(`${new URL(issuer).host}$`).toString('base64url')}`,
  PROFITIA_CLERK_SECRET_KEY:'sk_test_fixture',PROFITIA_CLERK_AUTHORIZED_PARTIES:'["https://app.fixture.test"]',
  PROFITIA_PRIVATE_DATABASE_URL:url(target.runtimeRole),PROFITIA_FIXED_ORGANISATION_ID:'11111111-1111-4111-8111-111111111111',
  PROFITIA_OPERATION_CONFIGURATION_VERSION:privateTargets.configurationVersion,RENDER_SERVICE_ID:target.serviceId,RENDER_GIT_COMMIT:'a'.repeat(40),
  SRM_DEMO_SESSION_SECRET:'synthetic_preference_scope_secret_only_32',PROFITIA_SUPPLIER_API_ENABLED:'true',
  PROFITIA_SUPPLIER_API_CONFIGURATION_VERSION:native.configurationVersion,
  PROFITIA_SUPPLIER_JOBS_DATABASE_URL:url(native.runtimeRoles.jobs),PROFITIA_SUPPLIER_SOURCE_DATABASE_URL:url(native.runtimeRoles.providerSource),
  PROFITIA_CORPORATE_SOURCE_DATABASE_URL:url(native.runtimeRoles.corporateSource),PROFITIA_READY_REPORT_ENABLED:'true',
  MGBI_API_KEY:'synthetic-native-company-key',CEIDG_API_KEY:'synthetic-ceidg-token',VERCLY_API_KEY:'synthetic-vercly',VERCLY_API_BASE_URL:'https://vercly.fixture.test'}
 const base=readSrmPrivateReportConfiguration(env)
 assert(base&&base.provider==='clerk')
 return {base,env,read:(changes:Record<string,string|undefined>={})=>readSrmNativeSupplierConfiguration(base,{...env,...changes})!}
}

test('optional Root claim target pins the exact producer and existing main Development roles without granting or activating them',async()=>{
 assert.deepEqual({id:root.contractId,version:root.contractVersion},ROOT_ATOMIC_CLAIM_CONTRACT)
 assert.equal(root.schemaDigest,await rootAtomicClaimSchemaDigest())
 assert.equal(root.sourceDigest,await rootAtomicClaimSourceDigest())
 assert.equal(root.producerPullRequest,854);assert.equal(root.producerSourceRef,'3a494b5432555935168c060be5950589d550d276')
 for(const key of ['environment','serviceId','projectId','branchId','databaseName'] as const)assert.equal(root[key],native[key])
 assert.equal(root.foregroundRole,privateTargets.environments.development.runtimeRole);assert.equal(root.executorRole,native.runtimeRoles.jobs)
 assert.equal(root.activationVariable,'PROFITIA_ROOT_ATOMIC_CLAIM_ENABLED');assert.equal(root.enabledByDefault,false)
 assert.equal(root.formalSourceAcceptanceRequired,true);assert.equal(root.cloudInstallationRequiresSeparateApproval,true)
})
test('ordinary READY and FRESH configuration remains unchanged until an explicit server-side opt-in',()=>{
 const f=fixture(),before=f.read()
 assert.equal(before.rootAtomicClaimSchemaDigest,undefined)
 assert.equal(before.readyReportSchemaDigest,ready.schemaDigest)
 assert.deepEqual(f.read({PROFITIA_ROOT_ATOMIC_CLAIM_ENABLED:'false'}),before)
 const enabled=f.read({PROFITIA_ROOT_ATOMIC_CLAIM_ENABLED:'true'})
 const {rootAtomicClaimSchemaDigest,...same}=enabled
 assert.equal(rootAtomicClaimSchemaDigest,root.schemaDigest);assert.deepEqual(same,before)
 assert.equal(f.read({PROFITIA_SUPPLIER_API_ENABLED:'false',PROFITIA_ROOT_ATOMIC_CLAIM_ENABLED:'true'}),undefined)
})
for(const flag of ['', 'TRUE', 'yes', '1', 'unknown'])test('Root claim rejects invalid activation value '+JSON.stringify(flag),()=>{
 assert.throws(()=>fixture().read({PROFITIA_ROOT_ATOMIC_CLAIM_ENABLED:flag}),IdentityConfigurationUnavailable)
})
test('Root claim cannot activate without READY, in a pilot, or for an unregistered runtime',()=>{
 const f=fixture()
 for(const changes of [
  {PROFITIA_READY_REPORT_ENABLED:'false'}, {PROFITIA_READY_REPORT_ENABLED:undefined},
  {RENDER_SERVICE_ID:'srv-other-runtime'}, {SRM_DEVELOPMENT_PILOT2_LOOKUP:'true'},
  {SRM_KRS_NIP_ENABLED:'true'}, {TARGET_ENVIRONMENT:'staging'},
 ]){
  const env={...f.env,...changes,PROFITIA_ROOT_ATOMIC_CLAIM_ENABLED:'true'}
  assert.throws(()=>readSrmNativeSupplierConfiguration({...f.base,application:{...f.base.application,
   environment:changes.TARGET_ENVIRONMENT==='staging'?'staging':'development'}},env),IdentityConfigurationUnavailable)
 }
 for(const key of ['projectId','branchId','databaseName','role'] as const)
  assert.throws(()=>readSrmNativeSupplierConfiguration({...f.base,binding:{...f.base.binding,[key]:'foreign'}},
   {...f.env,PROFITIA_ROOT_ATOMIC_CLAIM_ENABLED:'true'}),IdentityConfigurationUnavailable)
})
test('runtime construction refuses altered schema, pilot, provider or ownership before opening any pool',()=>{
 const config=fixture().read({PROFITIA_ROOT_ATOMIC_CLAIM_ENABLED:'true'})
 const patches:Partial<Configuration>[]=[{rootAtomicClaimSchemaDigest:'f'.repeat(64)},{runtimeRoles:native.runtimeRoles},
  {readyReportSchemaDigest:undefined},{companySourcePolicy:undefined},
  {base:{...config.base,binding:{...config.base.binding,role:'foreign'}}}]
 for(const patch of patches)assert.throws(()=>createSrmNativeSupplierRuntime({...config,...patch},{} as never),IdentityConfigurationUnavailable)
})

test('Root claim adoption preserves every prior receipt and pins only the reviewed consumer closure',()=>{
 const hash=(value:Uint8Array)=>createHash('sha256').update(value).digest('hex')
 const receipt=JSON.parse(readFileSync(new URL('../../operation-integration.json',import.meta.url),'utf8')),a=receipt.rootAtomicClaimAdoption
 assert(a,'Formal Root claim source and consumer acceptance must precede publication')
 assert.equal(a.producerSourceRef,root.producerSourceRef);assert.equal(a.sourceDigest,root.sourceDigest);assert.equal(a.schemaDigest,root.schemaDigest)
 assert.equal(a.producerPackage,'@profitia/platform-root-atomic-claim');assert.equal(a.producerVersion,'1.0.0')
 assert.equal(a.producerAcceptance.status,'SOURCE_GO')
 assert.equal(a.producerAcceptance.taskId,'ARCHITECTURE-ROOT-ATOMIC-CLAIM-SOURCE-ACCEPTANCE-20261101')
 assert.equal(a.producerAcceptance.sourceMergeSha,'35ab64e13a549fdce2876c2ef65f229044c5f2de')
 assert.equal(a.producerAcceptance.controlledRunId,'41351692617')
 assert.equal(a.producerAcceptance.controlledArtifactId,13101731528)
 assert.equal(a.producerAcceptance.artifactZipSha256,'fee44b250da09fa4c055920591d8aaf18774da70f6af6babadda2e42f8246b9b')
 assert.match(a.producerAcceptance.phrCommit,/^[a-f0-9]{40}$/)
 const previous=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(previous),a.previousReceiptSha256)
 const parsed=JSON.parse(previous.toString())
 for(const[key,value]of Object.entries(parsed))assert.deepEqual(receipt[key],value,key)
 assert.deepEqual(Object.keys(receipt).sort(),[...Object.keys(parsed),'rootAtomicClaimAdoption'].sort())
 const files=['src/server/company-classification.ts','src/server/fresh-report.ts','src/server/supplier-api-composition.ts',
  'src/server/supplier-native-runtime.ts','src/server/root-atomic-claim-adoption.test.ts','deployment/root-atomic-claim-targets.json',
  'scripts/ready-report.integration.test.mjs','scripts/xray-workflow-contract.test.ts','scripts/native-execution-adoption.test.mjs','scripts/rural-location-release.test.mjs','scripts/xray-performance-adoption.test.mjs','scripts/location-cache.integration.test.mjs','scripts/root-atomic-claim-release.mjs','scripts/root-atomic-claim-release.test.mjs',
  'src/server/peer-read-boundary.test.ts','src/server/supplier-location-geocoding-runtime.test.ts','src/server/full-ui-parity-adoption.test.ts','package.json','package-lock.json']
 assert.deepEqual(Object.keys(a.applicationSourceDigests).sort(),files.sort())
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(readFileSync(new URL('../../'+file,import.meta.url))),digest,file)
 assert.equal(a.defaultEnabled,false);assert.equal(a.sharedSdkUnchanged,true);assert.equal(a.paidPoliciesChanged,false)
 assert.equal(a.lateWorkAccountChecksPreserved,true);assert.equal(a.finalDisclosureCheckPreserved,true)
 assert.deepEqual(a.nativeWorkUnits,['SRM_REGISTER_LOOKUP','SRM_STORE_COMPANY']);assert.equal(a.rootActor,'HUMAN');assert.equal(a.deliveryActor,'SERVICE')
 const pkg=JSON.parse(readFileSync(new URL('../../package.json',import.meta.url),'utf8'))
 const previousPackage=JSON.parse(execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/package.json']).toString())
 assert.equal(pkg.dependencies['@profitia/platform-root-atomic-claim'],'file:../../packages/platform-contracts/root-atomic-claim')
 const dependencies={...pkg.dependencies};delete dependencies['@profitia/platform-root-atomic-claim']
 assert.deepEqual(dependencies,previousPackage.dependencies)
 assert.equal(JSON.parse(readFileSync(new URL('../../node_modules/@profitia/platform-contracts/package.json',import.meta.url),'utf8')).version,'1.32.3')
})
