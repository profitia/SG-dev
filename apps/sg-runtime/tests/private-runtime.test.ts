import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { accessSchemaUrl, moduleAuditSchemaDigest } from '@profitia/platform-contracts/access-store'
import { moduleSchemaDigest } from '@profitia/platform-contracts/module-scope'
import { NextRequest, NextResponse } from 'next/server'
import targets from '../deployment/private-runtime-targets.json'
import { IdentityConfigurationUnavailable } from '../lib/platform/identity-runtime'
import { getSg2SelectionRuntime, readSg2PrivateSelectionConfiguration, type Sg2SelectionRuntime } from '../lib/platform/private-runtime'
import { createRuntimeBenchmarkSelectionHandlers } from '../lib/benchmark/runtime-handlers'
import { GET as deployedGET } from '../app/api/benchmark/selection/route'

const A = '11111111-1111-4111-8111-111111111111'
const target = targets.environments.development
function fixture() {
  const issuer = 'https://identity-fixture.accounts.dev'
  const url = new URL('postgresql://local.invalid')
  url.hostname = target.hosts[0]; url.username = target.runtimeRole; url.password = 'synthetic_fixture_only'
  url.pathname = `/${target.databaseName}`; url.search = '?sslmode=require&channel_binding=require'
  return { PROFITIA_AUTH_PROVIDER: 'clerk', TARGET_ENVIRONMENT: 'development', APP_ENV: 'development',
    PROFITIA_CLERK_ISSUER: issuer, PROFITIA_CLERK_PUBLISHABLE_KEY: `pk_test_${Buffer.from(`${new URL(issuer).host}$`).toString('base64url')}`,
    PROFITIA_CLERK_SECRET_KEY: 'sk_test_fixture', PROFITIA_CLERK_AUTHORIZED_PARTIES: JSON.stringify(['https://app.fixture.test']),
    PROFITIA_PRIVATE_DATABASE_URL: url.toString(), PROFITIA_FIXED_ORGANISATION_ID: A,
    PROFITIA_OPERATION_CONFIGURATION_VERSION: targets.configurationVersion, RENDER_SERVICE_ID: target.serviceId, RENDER_GIT_COMMIT: 'a'.repeat(40) }
}
const request = () => new NextRequest('https://app.fixture.test/api/benchmark/selection', { headers: {
  'x-clerk-user-id': 'forged-user', 'x-clerk-org-id': 'forged-org', 'x-clerk-org-role': 'owner',
} })

test('receiver pins agree with the independently recorded resource and actual accepted schema bytes', async () => {
  const prepared = JSON.parse(readFileSync(new URL('../deployment/private-business-preparation.json', import.meta.url), 'utf8'))
  const registry = JSON.parse(readFileSync(new URL('../../../Canon/registries/platform-private-onboarding-v1.json', import.meta.url), 'utf8'))
  const topology = JSON.parse(readFileSync(new URL('../../../Canon/registries/sg2-environment-topology-v1.json', import.meta.url), 'utf8'))
  assert.equal(target.projectId, prepared.physicalBinding.projectId)
  assert.equal(target.branchId, prepared.physicalBinding.branchId)
  assert.equal(target.databaseName, prepared.physicalBinding.databaseName)
  assert.equal(target.schemaName, prepared.physicalBinding.schemaName)
  assert.deepEqual(target.hosts, [registry.neon.host, registry.neon.pooledHost])
  assert.equal(target.runtimeRole, registry.sg2BusinessStoreInitialization.runtimeRole)
  const role = prepared.controls.actualRuntimeRoleProofs.find((proof: { current_user: string }) => proof.current_user === target.runtimeRole)
  assert(role && role.session_user === target.runtimeRole && role.benchmark_select && role.benchmark_insert && role.benchmark_update && !role.benchmark_delete)
  assert.equal(target.serviceId, topology.environments.development.render.services.runtime.serviceId)
  assert.equal(target.businessSchemaDigest, prepared.source.businessSchemaDigest)
  assert.equal(target.accessSchemaDigest, createHash('sha256').update(readFileSync(new URL(accessSchemaUrl))).digest('hex'))
  assert.equal(target.moduleSchemaDigest, await moduleSchemaDigest())
  assert.equal(target.auditSchemaDigest, await moduleAuditSchemaDigest())
})

test('unchanged default/exact legacy mode never needs or initializes private configuration', () => {
  assert.deepEqual(readSg2PrivateSelectionConfiguration({}), { provider: 'legacy_demo' })
  assert.deepEqual(readSg2PrivateSelectionConfiguration({ PROFITIA_AUTH_PROVIDER: 'legacy_demo', PROFITIA_PRIVATE_DATABASE_URL: 'invalid', TARGET_ENVIRONMENT: 'staging' }), { provider: 'legacy_demo' })
  assert.deepEqual(getSg2SelectionRuntime({}), { provider: 'legacy_demo' })
})

test('complete explicit server intent binds its fixed organisation, exact ordinary receiver and deployment', () => {
  const env = fixture(), config = readSg2PrivateSelectionConfiguration(env)
  assert.equal(config.provider, 'clerk'); if (config.provider !== 'clerk') throw Error('Expected private intent')
  assert.equal(config.application.profileId, 'PORR_SUITE'); assert.equal(config.application.organisationId, A)
  assert.equal(config.application.deploymentId, `${target.serviceId}:${env.RENDER_GIT_COMMIT}`)
  assert.equal(config.application.configurationVersion, targets.configurationVersion)
  assert.deepEqual(config.application.operations, ['benchmark.selection.read', 'benchmark.selection.write'])
  assert.deepEqual(config.application.features, ['benchmark'])
  assert.equal(config.binding.projectId, target.projectId); assert.equal(config.binding.branchId, target.branchId)
  assert.equal(config.binding.role, target.runtimeRole); assert.equal(config.binding.databaseName, target.databaseName)
  assert.equal(config.module.schemaDigest, target.moduleSchemaDigest); assert.equal(config.module.auditSchemaDigest, target.auditSchemaDigest)
  // Deployment target and Node build/execution mode are distinct.
  assert.equal(readSg2PrivateSelectionConfiguration({ ...env, NODE_ENV: 'production' }).provider, 'clerk')
})

test('supplier summary has a separate explicit server capability, pinned peer and unchanged base benchmark configuration', () => {
  const env = fixture(), base = readSg2PrivateSelectionConfiguration(env)
  const config = readSg2PrivateSelectionConfiguration({ ...env, PROFITIA_SUPPLIER_SUMMARY_ENABLED: 'true' })
  assert.equal(config.provider, 'clerk'); assert.equal(base.provider, 'clerk')
  if (config.provider !== 'clerk' || base.provider !== 'clerk') throw Error('Expected private intent')
  assert.deepEqual(config.application, base.application)
  assert.equal(base.supplierSummary, undefined)
  assert.equal(config.supplierSummary?.origin, 'https://srm-development-runtime.onrender.com')
  assert.equal(config.supplierSummary?.configurationVersion, target.supplierSummary.configurationVersion)
  const srm = JSON.parse(readFileSync(new URL('../../../Canon/registries/srm-environment-topology-v1.json', import.meta.url), 'utf8'))
  assert.equal(config.supplierSummary?.origin, srm.environments.development.render.services.runtime.url)
  assert.equal(target.supplierSummary.defaultEnabled, false)
  assert.equal(target.supplierSummary.observedState, 'SOURCE_ONLY_NOT_ACTIVATED')
  for (const value of ['', 'yes','1','TRUE','unknown']) assert.throws(() => readSg2PrivateSelectionConfiguration({ ...env, PROFITIA_SUPPLIER_SUMMARY_ENABLED: value }), IdentityConfigurationUnavailable)
  const disabled = readSg2PrivateSelectionConfiguration({ ...env, PROFITIA_SUPPLIER_SUMMARY_ENABLED: 'false' })
  assert.equal(disabled.provider, 'clerk'); if (disabled.provider === 'clerk') assert.equal(disabled.supplierSummary, undefined)
})

test('explicit invalid provider or any missing private prerequisite fails closed', () => {
  const env = fixture()
  for (const value of ['', 'CLERK', 'clerkk', 'false', 'unknown']) assert.throws(() => readSg2PrivateSelectionConfiguration({ ...env, PROFITIA_AUTH_PROVIDER: value }), IdentityConfigurationUnavailable)
  for (const key of ['PROFITIA_PRIVATE_DATABASE_URL','PROFITIA_FIXED_ORGANISATION_ID','PROFITIA_OPERATION_CONFIGURATION_VERSION','RENDER_SERVICE_ID','RENDER_GIT_COMMIT','PROFITIA_CLERK_SECRET_KEY','PROFITIA_CLERK_AUTHORIZED_PARTIES','TARGET_ENVIRONMENT']) {
    assert.throws(() => readSg2PrivateSelectionConfiguration({ ...env, [key]: undefined }), IdentityConfigurationUnavailable)
  }
  for (const patch of [{ APP_ENV: 'staging' }, { RENDER_SERVICE_ID: 'other-service' }, { RENDER_GIT_COMMIT: 'unknown' }, { PROFITIA_FIXED_ORGANISATION_ID: 'demo-org' }, { PROFITIA_FIXED_ORGANISATION_ID: '' }, { PROFITIA_OPERATION_CONFIGURATION_VERSION: 'unknown' }]) {
    assert.throws(() => readSg2PrivateSelectionConfiguration({ ...env, ...patch }), IdentityConfigurationUnavailable)
  }
})

test('even syntactically valid live identity cannot borrow this Development private store for Stage/Production', () => {
  const env = fixture(), issuer = 'https://identity.fixture.test'
  for (const environment of ['staging', 'production']) {
    assert.throws(() => readSg2PrivateSelectionConfiguration({ ...env, TARGET_ENVIRONMENT: environment, APP_ENV: environment,
      PROFITIA_CLERK_ISSUER: issuer, PROFITIA_CLERK_PUBLISHABLE_KEY: `pk_live_${Buffer.from(`${new URL(issuer).host}$`).toString('base64url')}`,
      PROFITIA_CLERK_SECRET_KEY: 'sk_live_fixture' }), IdentityConfigurationUnavailable)
  }
})

test('foreign project endpoint, owner/dashboard/SRM roles, database, transport and query tricks are refused before connecting', () => {
  const env = fixture()
  const edits: Array<(u: URL) => void> = [
    u => { u.hostname = 'foreign.neon.tech' }, u => { u.hostname = '127.0.0.1' },
    u => { u.username = 'neondb_owner' }, u => { u.username = 'sg2_private_development_dashboard' },
    u => { u.username = 'srm_private_development_runtime' }, u => { u.password = '' },
    u => { u.pathname = '/neondb' }, u => { u.pathname = '/srm_app' }, u => { u.port = '55439' },
    u => { u.hash = 'fragment' },
    u => { u.searchParams.set('sslmode', 'disable') }, u => { u.searchParams.delete('sslmode') },
    u => { u.searchParams.append('sslmode', 'require') }, u => { u.searchParams.set('channel_binding', 'disable') },
    u => { u.searchParams.append('channel_binding', 'require') },
    u => { u.searchParams.set('schema', 'public') }, u => { u.searchParams.set('sslaccept', 'accept_invalid_certs') },
    u => { u.searchParams.set('options', '-c search_path=public') }, u => { u.searchParams.set('connection_limit', '30') },
    u => { u.searchParams.set('host', '/tmp') },
  ]
  for (const edit of edits) {
    const url = new URL(env.PROFITIA_PRIVATE_DATABASE_URL); edit(url)
    assert.notEqual(url.toString(), env.PROFITIA_PRIVATE_DATABASE_URL, 'Negative fixture must actually change the input')
    assert.throws(() => readSg2PrivateSelectionConfiguration({ ...env, PROFITIA_PRIVATE_DATABASE_URL: url.toString() }), IdentityConfigurationUnavailable, String(edit))
  }
  // WHATWG URL ignores a non-special -> special protocol setter; supply the
  // actual hostile string rather than accidentally retesting the valid URI.
  assert.throws(() => readSg2PrivateSelectionConfiguration({ ...env, PROFITIA_PRIVATE_DATABASE_URL: env.PROFITIA_PRIVATE_DATABASE_URL.replace(/^postgresql:/, 'https:') }), IdentityConfigurationUnavailable)
  assert.throws(() => readSg2PrivateSelectionConfiguration({ ...env, PROFITIA_PRIVATE_DATABASE_URL: ` ${env.PROFITIA_PRIVATE_DATABASE_URL}` }), IdentityConfigurationUnavailable)
})

test('an existing host under a different server configuration cannot be reused', () => {
  const previous = globalThis.__sg2PrivateSelectionRuntime__
  globalThis.__sg2PrivateSelectionRuntime__ = { key: 'different-configuration', runtime: { provider: 'legacy_demo' } }
  try { assert.throws(() => getSg2SelectionRuntime(fixture()), IdentityConfigurationUnavailable) }
  finally { globalThis.__sg2PrivateSelectionRuntime__ = previous }
})

test('unavailable/unknown private runtime never falls back to a legacy business callback', async () => {
  let legacyCalls = 0
  const legacy = { GET: async () => { legacyCalls++; return NextResponse.json({ legacy: true }) }, POST: async () => { legacyCalls++; return NextResponse.json({ legacy: true }) } }
  for (const resolve of [() => { throw new Error('synthetic hidden configuration diagnostic') }, () => ({ provider: 'unknown' } as unknown as Sg2SelectionRuntime)]) {
    const routes = createRuntimeBenchmarkSelectionHandlers(resolve, legacy)
    const response = await routes.GET(request())
    assert.equal(response.status, 503); assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
    assert.equal(response.headers.get('Vary'), 'Cookie, Authorization')
    assert.deepEqual(await response.json().then(({ error, code }) => ({ error, code })), { error: 'Operation unavailable.', code: 'OPERATION_DENIED' })
  }
  assert.equal(legacyCalls, 0)
  assert.equal((await createRuntimeBenchmarkSelectionHandlers(() => ({ provider: 'legacy_demo' }), legacy).GET(request())).status, 200)
  assert.equal(legacyCalls, 1)
})

test('actual deployed GET refuses incomplete Clerk configuration without private/client-header fallback', async () => {
  const previous = process.env.PROFITIA_AUTH_PROVIDER
  process.env.PROFITIA_AUTH_PROVIDER = 'clerk'
  try {
    const response = await deployedGET(request())
    assert.equal(response.status, 503)
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
    const body = await response.text()
    assert.equal(body.includes('forged'), false); assert.equal(body.includes('postgres'), false)
  } finally { if (previous === undefined) delete process.env.PROFITIA_AUTH_PROVIDER; else process.env.PROFITIA_AUTH_PROVIDER = previous }
})


test('private category capability is separately opt-in and pins its own unactivated SQL without changing benchmark or supplier configuration',()=>{
  const env=fixture(),base=readSg2PrivateSelectionConfiguration(env),enabled=readSg2PrivateSelectionConfiguration({...env,PROFITIA_CATEGORY_ENABLED:'true'})
  assert.equal(base.provider,'clerk');assert.equal(enabled.provider,'clerk')
  if(base.provider!=='clerk'||enabled.provider!=='clerk')throw Error('Expected private intent')
  assert.equal(base.category,undefined);assert.equal(enabled.category?.configurationVersion,'sg2-private-category-e1-v1')
  assert.equal(enabled.category?.boundaryDigest,createHash('sha256').update(readFileSync(new URL('../prisma/private-store/002-category-boundaries.sql',import.meta.url))).digest('hex'))
  assert.equal(target.category.defaultEnabled,false);assert.equal(target.category.observedState,'SOURCE_ONLY_NOT_INITIALIZED_OR_ACTIVATED')
  assert.deepEqual(enabled.application,base.application);assert.equal(enabled.supplierSummary,undefined)
  for(const flag of ['yes','TRUE','1','',null])assert.throws(()=>readSg2PrivateSelectionConfiguration({...env,PROFITIA_CATEGORY_ENABLED:flag} as unknown as Record<string,string>),IdentityConfigurationUnavailable)
  assert.deepEqual(readSg2PrivateSelectionConfiguration({PROFITIA_AUTH_PROVIDER:'legacy_demo',PROFITIA_CATEGORY_ENABLED:'true'}),{provider:'legacy_demo'})
  assert.throws(()=>readSg2PrivateSelectionConfiguration({...env,TARGET_ENVIRONMENT:'staging',APP_ENV:'staging',PROFITIA_CATEGORY_ENABLED:'true'}),IdentityConfigurationUnavailable)
})
