import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { finderReleaseConfiguration, verifyFinderDevelopmentBindings } from '../scripts/verify-finder-development-bindings.mjs'

const targets = JSON.parse(readFileSync(new URL('../deployment/benchmark-discovery-targets.json', import.meta.url)))
const privateTarget = JSON.parse(readFileSync(new URL('../deployment/private-runtime-targets.json', import.meta.url))).environments.development
const releaseSha = 'a'.repeat(40), clock = Date.parse('2026-11-04T12:00:00Z')
const work = { ...targets.privateStore, ...targets.nativeWork }
const url = target => `postgresql://${target.runtimeRole}:fixture_secret@${target.hosts[0]}/${target.databaseName}?sslmode=require`
const environment = () => ({ TARGET_ENVIRONMENT: 'development', PROFITIA_AUTH_PROVIDER: 'clerk',
  PROFITIA_BENCHMARK_DISCOVERY_ENABLED: 'true', RENDER_SERVICE_ID: targets.serviceId, RENDER_GIT_COMMIT: releaseSha,
  PROFITIA_BENCHMARK_DISCOVERY_CONFIGURATION_VERSION: targets.configurationVersion,
  PROFITIA_BENCHMARK_WORK_DATABASE_URL: url(work), PROFITIA_BENCHMARK_SOURCE_DATABASE_URL: url(targets.source) })
function descriptor(binding) {
  const identity = { schemaVersion: '1.0.0', environment: 'development', projectId: binding.projectId,
    branchId: binding.branchId, databaseName: binding.databaseName, role: binding.runtimeRole,
    applicationId: binding.applicationId, schemaDigest: privateTarget.accessSchemaDigest }
  const service = { schemaVersion: '1.0.0', schemaDigest: binding.name === 'dispatch' ? targets.serviceSchemaDigest : targets.source.sourceSqlDigest,
    profileId: 'PLATFORM_INTERNAL', serviceId: '22222222-2222-4222-8222-222222222222',
    proofRef: 'database-service:33333333-3333-4333-8333-333333333333:2', expiresAt: new Date(clock + 30000).toISOString(),
    deploymentId: `${targets.serviceId}:${releaseSha}`, configurationVersion: binding.configurationVersion }
  return { identity, service }
}
const verify = (read, env = environment()) => verifyFinderDevelopmentBindings({ env, read, now: () => clock })

test('matching deployed SHA and adopted contracts require both ordinary service descriptors', async () => {
  const seen = []
  assert.deepEqual(await verify(async binding => { seen.push(binding.name); return descriptor(binding) }),
    { status: 'READY', releaseSha, checkedBindings: 2 })
  assert.deepEqual(seen, ['dispatch', 'source'])
})

for (const name of ['dispatch', 'source']) {
  test(`${name}: a stale deployment or configuration blocks readiness`, async () => {
    for (const field of ['deploymentId', 'configurationVersion']) {
      await assert.rejects(verify(async binding => {
        const row = descriptor(binding)
        if (binding.name === name) row.service[field] = 'older-release'
        return row
      }), error => error.code === 'BINDING_MISMATCH' && error.binding === name)
    }
  })
  test(`${name}: missing, expired or unaccepted schema never grants readiness`, async () => {
    for (const fault of ['missing', 'expired', 'schema', 'profile']) {
      await assert.rejects(verify(async binding => {
        const row = descriptor(binding)
        if (binding.name === name) {
          if (fault === 'missing') row.service = null
          if (fault === 'expired') row.service.expiresAt = new Date(clock).toISOString()
          if (fault === 'schema') row.service.schemaDigest = '0'.repeat(64)
          if (fault === 'profile') row.service.profileId = 'PORR_SUITE'
        }
        return row
      }), error => error.code === 'BINDING_UNAVAILABLE' && error.binding === name)
    }
  })
  test(`${name}: wrong database, branch, environment, role or application blocks readiness`, async () => {
    for (const field of ['databaseName', 'branchId', 'environment', 'role', 'applicationId']) {
      await assert.rejects(verify(async binding => {
        const row = descriptor(binding)
        if (binding.name === name) row.identity[field] = 'foreign'
        return row
      }), error => error.code === 'IDENTITY_MISMATCH' && error.binding === name)
    }
  })
}

test('other environments and disabled Finder perform no database reads', async () => {
  for (const env of [{}, { ...environment(), TARGET_ENVIRONMENT: 'staging' },
    { ...environment(), TARGET_ENVIRONMENT: 'production' }, { ...environment(), PROFITIA_BENCHMARK_DISCOVERY_ENABLED: 'false' }]) {
    assert.deepEqual(await verify(() => assert.fail('Unexpected database access'), env), { status: 'NOT_APPLICABLE' })
  }
})

test('operator/foreign URLs and incomplete release configuration are refused before connecting', () => {
  for (const replacement of [undefined, 'false', 'another-service']) {
    assert.throws(() => finderReleaseConfiguration({ ...environment(), RENDER_SERVICE_ID: replacement }), /CONFIGURATION_INVALID/)
  }
  for (const connection of [url(work).replace(work.runtimeRole, 'neondb_owner'), url(work).replace(work.hosts[0], 'foreign.invalid'),
    url(work) + '&schema=public', url(work).replace('sslmode=require', 'sslmode=disable')]) {
    assert.throws(() => finderReleaseConfiguration({ ...environment(), PROFITIA_BENCHMARK_WORK_DATABASE_URL: connection }),
      error => error.code === 'CONFIGURATION_INVALID' && !String(error).includes('fixture_secret'))
  }
})

test('driver failures and CLI errors do not expose connection strings or credentials', async () => {
  await assert.rejects(verify(() => { throw Error(url(work)) }), error => error.code === 'DATABASE_UNAVAILABLE'
    && !String(error).includes('fixture_secret') && !String(error).includes(work.hosts[0]))
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/verify-finder-development-bindings.mjs', import.meta.url))],
    { env: { ...process.env, ...environment(), RENDER_SERVICE_ID: 'foreign' }, encoding: 'utf8' })
  assert.equal(result.status, 1)
  assert.equal(JSON.parse(result.stderr).status, 'BLOCKED')
  assert.doesNotMatch(result.stdout + result.stderr, /fixture_secret|postgresql:/)
})

test('the documented Render entrypoint verifies before starting the unchanged application', () => {
  const doc = readFileSync(new URL('../docs/finder-development-release.md', import.meta.url), 'utf8')
  assert.match(doc, /node scripts\/verify-finder-development-bindings\.mjs --wait && exec npm run start/)
})
