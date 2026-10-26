import {posix} from 'node:path'
const requirePath=(file:string)=>posix.normalize('apps/srm/'+file)
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { identitySourceDigest } from '@profitia/platform-contracts/identity-provider'
import { readSrmPrivateReportConfiguration } from './private-runtime'
import targets from '../../deployment/private-runtime-targets.json'

const target = targets.environments.development, peer = target.summaryPeerRead
function fixture() {
  const issuer = 'https://synthetic.clerk.accounts.dev', url = new URL('postgresql://fixture.invalid')
  url.hostname = target.hosts[0]; url.username = target.runtimeRole; url.password = 'synthetic_fixture_only'
  url.pathname = '/' + target.databaseName; url.search = '?sslmode=require'
  return { PROFITIA_AUTH_PROVIDER: 'clerk', TARGET_ENVIRONMENT: 'development',
    PROFITIA_CLERK_ISSUER: issuer, PROFITIA_CLERK_PUBLISHABLE_KEY: 'pk_test_' + Buffer.from(new URL(issuer).host + '$').toString('base64url'),
    PROFITIA_CLERK_SECRET_KEY: 'sk_test_fixture', PROFITIA_CLERK_AUTHORIZED_PARTIES: JSON.stringify([peer.sourceOrigin, peer.targetOrigin]),
    PROFITIA_PRIVATE_DATABASE_URL: url.toString(), PROFITIA_FIXED_ORGANISATION_ID: '11111111-1111-4111-8111-111111111111',
    PROFITIA_OPERATION_CONFIGURATION_VERSION: targets.configurationVersion, RENDER_SERVICE_ID: target.serviceId,
    RENDER_GIT_COMMIT: 'a'.repeat(40), SRM_DEMO_SESSION_SECRET: 'synthetic_preference_scope_secret_only_32' }
}
test('SRM peer identity is disabled until the exact deployment-owned version is selected', () => {
  const ordinary = readSrmPrivateReportConfiguration(fixture())
  assert.equal(ordinary.provider, 'clerk'); if (ordinary.provider !== 'clerk') throw Error('Expected Clerk')
  assert.equal(ordinary.identity.bearerPeerReads, undefined)
  const configured = readSrmPrivateReportConfiguration({ ...fixture(), PROFITIA_SUPPLIER_SUMMARY_PEER_READ_VERSION: peer.configurationVersion })
  assert.equal(configured.provider, 'clerk'); if (configured.provider !== 'clerk') throw Error('Expected Clerk')
  assert.deepEqual(configured.identity.bearerPeerReads, [{ sourceOrigin: peer.sourceOrigin, targetOrigin: peer.targetOrigin, path: '/api/xray/financial-summary' }])
  for (const version of ['', 'true', 'foreign-version']) assert.throws(() => readSrmPrivateReportConfiguration({ ...fixture(), PROFITIA_SUPPLIER_SUMMARY_PEER_READ_VERSION: version }))
  for (const origins of [[peer.sourceOrigin], [peer.targetOrigin]]) assert.throws(() => readSrmPrivateReportConfiguration({ ...fixture(),
    PROFITIA_SUPPLIER_SUMMARY_PEER_READ_VERSION: peer.configurationVersion, PROFITIA_CLERK_AUTHORIZED_PARTIES: JSON.stringify(origins) }))
  assert.throws(() => readSrmPrivateReportConfiguration({ ...fixture(), TARGET_ENVIRONMENT: 'staging', PROFITIA_SUPPLIER_SUMMARY_PEER_READ_VERSION: peer.configurationVersion }))
})
test('SRM explicitly accepts the exact peer producer and preserves all preceding receipts and source fingerprints', async () => {
  const receipt = JSON.parse(readFileSync(new URL('../../operation-integration.json', import.meta.url), 'utf8'))
  const accepted = receipt.peerReadIdentityAdoption, hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
  assert.equal(accepted.producer.sourceSha, '9a226aef8dc36949b13999dbeba046dc1cf62a29')
  assert.equal(accepted.producer.projectKey, 'ARCHITECTURE'); assert.equal(accepted.producer.pullRequest, 568)
  assert.equal(accepted.previousApplicationAuthority, 'c82d400ab53783376fefecd487131b0ef6812ad8')
  assert.equal(accepted.identityDigest, await identitySourceDigest())
  const previous = JSON.parse(execFileSync('git', ['show', accepted.previousApplicationAuthority + ':apps/srm/operation-integration.json'], { encoding: 'utf8' }))
  for (const [key, value] of Object.entries(previous)) assert.deepEqual(['contract','producer'].includes(key) ? receipt.supplierLocationSourceCompatibility.previousRootAcceptance[key] : receipt[key], value, key)
  const root = new URL('../', pathToFileURL(createRequire(import.meta.url).resolve('@profitia/platform-contracts/identity-provider')))
  assert.deepEqual(Object.keys(accepted.sdkSourceDigests).sort(), ['src/identity-provider.d.mts', 'src/identity-provider.mjs'])
  for (const [path, digest] of Object.entries(accepted.sdkSourceDigests)) {
    assert.equal(hash(readFileSync(new URL(path, root))), digest, path)
    assert.equal(hash(execFileSync('git', ['show', accepted.previousApplicationAuthority + ':packages/platform-contracts/' + path])), previous.publicWebTransportSourceCompatibility.sourceDigests[path])
  }
  const currentDigests={ ...accepted.sourceDigests, ...receipt.supplierLocationSourceCompatibility.applicationSourceDigests, ...receipt.supplierLocationFullStackAdoption.sourceDigests, ...receipt.p1ReceiverSourceCompatibility.applicationSourceDigests };
  const live=receipt.krsLivePilotSourceCompatibility;
  assert.equal(live.status,'SOURCE_CANDIDATE_ONLY');assert.equal(live.platformSdkVersion,'1.25.0');assert.equal(live.productDeploymentPerformed,false);
  assert.equal(live.previousApplicationAuthority,'a0a3b0626fac16e011b57d6284ce55abcfcd3ca3');
  const preceding=JSON.parse(execFileSync('git',['show',live.previousApplicationAuthority+':apps/srm/operation-integration.json'],{encoding:'utf8'}));
  for(const [key,value]of Object.entries(preceding))assert.deepEqual(['contract','producer'].includes(key)?receipt.accountRecheckSourceCompatibility.previousRootAcceptance[key]:receipt[key],value,key);
  for(const [file,entry]of Object.entries(live.changedFiles) as [string,{previousSha256:string;sourceSha256:string}][]){
    assert.equal(entry.previousSha256,currentDigests[file],file);
    assert.equal(hash(execFileSync('git',['show',live.previousApplicationAuthority+':'+requirePath(file)])),entry.previousSha256,file);
    currentDigests[file]=entry.sourceSha256;
  }
  Object.assign(currentDigests,receipt.accountRecheckSourceCompatibility.applicationSourceDigests,receipt.boundedIndicatorReadAdoption.applicationSourceDigests,receipt.krsNipSourceCompatibility?.applicationSourceDigests,receipt.krsNipActivationCompatibility?.applicationSourceDigests,receipt.organisationLocationAuthorityAdoption?.applicationSourceDigests,receipt.organisationLocationBuildRecovery?.applicationSourceDigests,receipt.krsFinancialTelemetryCompatibility?.applicationSourceDigests,receipt.organisationLocationEntryAdoption?.applicationSourceDigests,receipt.organisationLocationRefreshAdoption?.applicationSourceDigests,receipt.krsGusFirstPublicationCompatibility.applicationSourceDigests,receipt.krsRegonReconciliationCompatibility.applicationSourceDigests,receipt.krsContinuityCompatibility.applicationSourceDigests,receipt.unmeteredSourceCompatibility.applicationSourceDigests);
  Object.assign(currentDigests,receipt.krsCatalogRefreshCompatibility.applicationSourceDigests);
  Object.assign(currentDigests,receipt.financialPerformanceAdoption?.applicationSourceDigests);
  Object.assign(currentDigests,receipt.clerkCheckpointAdoption?.applicationSourceDigests,receipt.formReportAdmissionAdoption?.applicationSourceDigests);
  Object.assign(currentDigests,receipt.ochnikFinancialCorrection?.applicationSourceDigests);
  Object.assign(currentDigests,receipt.mgbiInventoryResponseCompatibility?.applicationSourceDigests);
  Object.assign(currentDigests,receipt.porrAccountCompatibility?.applicationSourceDigests);
  Object.assign(currentDigests,receipt.pilot2TelemetryCompatibility?.applicationSourceDigests);
  Object.assign(currentDigests,receipt.porrRecoveryCompatibility?.applicationSourceDigests);
  Object.assign(currentDigests,receipt.pilot2CompanyIdentityAdoption?.applicationSourceDigests);
  Object.assign(currentDigests,receipt.pilot2CredentialInitializationCorrection?.applicationSourceDigests);
  Object.assign(currentDigests,receipt.pilot2RuntimeClosureCorrection?.applicationSourceDigests);
  Object.assign(currentDigests,receipt.pilot2ExtractProfileAdoption?.applicationSourceDigests);
  Object.assign(currentDigests,receipt.pilot2FormAdmissionAdoption?.applicationSourceDigests);
  Object.assign(currentDigests,receipt.pilot2ScannerAdoption?.applicationSourceDigests);
  Object.assign(currentDigests,receipt.pilot2ColdAcquisitionAdoption?.applicationSourceDigests);
  Object.assign(currentDigests,receipt.pilot2PrivateOperationsAdoption?.applicationSourceDigests,receipt.requestQuotaSourceCompatibility?.applicationSourceDigests,receipt.pilot2PrivateTransportParentRepair?.applicationSourceDigests,receipt.pilot2PrivateKysContinuityRepair?.applicationSourceDigests,receipt.pilot2PrivateKysValidityRepair?.applicationSourceDigests);
  Object.assign(currentDigests,receipt.pilot2ProviderRoutingAdoption?.applicationSourceDigests);
  Object.assign(currentDigests,receipt.pilot2FinancialSinglePassAdoption?.applicationSourceDigests,receipt.nativeSqlRoundtripAdoption?.applicationSourceDigests,receipt.diagnosticTelemetryAdoption.applicationSourceDigests);
  for(const [file,digest]of Object.entries(currentDigests))assert.equal(hash(readFileSync(new URL('../../'+file,import.meta.url))),digest,file)
  assert.equal(accepted.defaultPeerReadEnabled, false); assert.equal(accepted.productDeploymentPerformed, false)
})
