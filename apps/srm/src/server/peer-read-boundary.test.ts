import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { posix } from 'node:path'
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
  const currentDigests={ ...accepted.sourceDigests, ...receipt.supplierLocationSourceCompatibility.applicationSourceDigests, ...receipt.supplierLocationFullStackAdoption.sourceDigests };
  const amendment=receipt.krsNameSearchSourceCompatibility;
  if(amendment){
    assert.equal(amendment.status,'SOURCE_CANDIDATE_ONLY');assert.equal(amendment.previousApplicationAuthority,'418a2ef0f30d840ce25ca645f5ef047e35d02192');
    assert.equal(amendment.productDeploymentPerformed,false);assert.equal(amendment.platformSdkVersion,'1.24.0');
    const preceding=JSON.parse(execFileSync('git',['show',amendment.previousApplicationAuthority+':apps/srm/operation-integration.json'],{encoding:'utf8'}));
    for(const [key,value]of Object.entries(preceding))assert.deepEqual(receipt[key],value,key);
    assert(Object.keys(amendment.changedFiles).length>0);
    for(const [path,entry]of Object.entries(amendment.changedFiles) as [string,{previousSha256:string;sourceSha256:string}][]){
      assert.equal(entry.previousSha256,currentDigests[path],path);
      assert.equal(hash(execFileSync('git',['show',amendment.previousApplicationAuthority+':'+posix.normalize('apps/srm/'+path)])),entry.previousSha256,path);
      assert.match(entry.sourceSha256,/^[a-f0-9]{64}$/);currentDigests[path]=entry.sourceSha256;
    }
  }
  const live=receipt.krsLivePilotSourceCompatibility;
  if(live){
    assert.equal(live.status,'SOURCE_CANDIDATE_ONLY');assert.equal(live.previousApplicationAuthority,'32062cda1be390c1d535a672922d3ee1e04dbde8');
    assert.equal(live.productDeploymentPerformed,false);assert.equal(live.platformSdkVersion,'1.24.0');
    const preceding=JSON.parse(execFileSync('git',['show',live.previousApplicationAuthority+':apps/srm/operation-integration.json'],{encoding:'utf8'}));
    for(const [key,value]of Object.entries(preceding))assert.deepEqual(receipt[key],value,key);
    for(const [path,entry]of Object.entries(live.changedFiles) as [string,{previousSha256:string;sourceSha256:string}][]){
      assert.equal(entry.previousSha256,currentDigests[path],path);
      assert.equal(hash(execFileSync('git',['show',live.previousApplicationAuthority+':'+posix.normalize('apps/srm/'+path)])),entry.previousSha256,path);
      assert.match(entry.sourceSha256,/^[a-f0-9]{64}$/);currentDigests[path]=entry.sourceSha256;
    }
  }
  for (const [path, digest] of Object.entries(currentDigests)) assert.equal(hash(readFileSync(new URL('../../' + path, import.meta.url))), digest, path)
  assert.equal(accepted.defaultPeerReadEnabled, false); assert.equal(accepted.productDeploymentPerformed, false)
})
