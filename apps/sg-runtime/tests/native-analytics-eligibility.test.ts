import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'
import { OPERATION_CONTRACT, OperationDenied, type OperationExecutor } from '@profitia/platform-contracts/operation-context'
import type { Prisma } from '@prisma/client'
import { createRuntimeAnalyticsEligibilityHandler } from '../lib/benchmark/analytics-eligibility-handlers'
import { buildDashboardPreviewAnalyticsUrl, localizeDashboardPreviewAnalyticsUrl } from '../lib/benchmark/analytics'
import type { Sg2SelectionRuntime } from '../lib/platform/private-runtime'
import targets from '../deployment/private-runtime-targets.json'
import { GET as mountedGET } from '../app/api/benchmark/analytics-eligibility/route'

const A = '11111111-1111-4111-8111-111111111111'
const input = (query = 'locale=pl&seriesId=stored_series', method = 'GET') => new NextRequest(
  `https://app.fixture.test/api/benchmark/analytics-eligibility?${query}`, { method,
    headers: { 'x-clerk-user-id': 'forged-user', 'x-clerk-org-id': A } })
const binding = { origin: targets.environments.development.dashboardEmbed.origin,
  configurationVersion: targets.environments.development.dashboardEmbed.configurationVersion,
  applicationId: 'spendguru' as const, environment: 'development' as const }

test('strict native selection and methods refuse before resolving any runtime or source', async () => {
  let calls = 0
  const handler = createRuntimeAnalyticsEligibilityHandler(() => { calls++; throw Error('Must not resolve') })
  for (const query of ['seriesId=x', 'locale=de&seriesId=x', 'locale=pl&seriesId=', 'locale=pl&seriesId=*',
    'locale=pl&seriesId=x&seriesId=x', 'locale=pl&seriesId=x&locale=pl', 'locale=pl&seriesId=x&organisationId=',
    'locale=pl&seriesId=x&userId=forged', 'locale=pl&seriesId=x&origin=https://foreign.test',
    'locale=pl&seriesId=x&warmCurrentForecast=1', 'locale=pl&seriesId=x&forecastWarmupExperiment=single',
    'locale=pl&seriesId=x&range=ALL', `locale=pl&seriesId=${'a'.repeat(257)}`]) {
    const response = await handler(input(query))
    assert.equal(response.status, 400, query); assert.equal(response.headers.get('cache-control'), 'private, no-store')
  }
  const response = await handler(input(undefined, 'POST'))
  assert.equal(response.status, 405); assert.equal(response.headers.get('allow'), 'GET'); assert.equal(calls, 0)
})

test('missing, unknown, legacy or foreign native bindings never advertise a URL or invoke the read executor', async () => {
  let calls = 0
  const executor: OperationExecutor<Prisma.TransactionClient> = { contract: OPERATION_CONTRACT,
    async execute() { calls++; throw Error('Must not execute') } }
  const runtime = { provider: 'clerk' as const, executor, defaultOrganisationId: A, dashboardEmbed: binding,
    marketRead: { executor, preview: async () => ({}), analytics: { executor, series: async () => ({}) } } }
  for (const value of [{ provider: 'legacy_demo' }, { provider: 'unknown' },
    { ...runtime, dashboardEmbed: undefined }, { ...runtime, marketRead: undefined },
    { ...runtime, dashboardEmbed: { ...binding, environment: 'staging' } },
    { ...runtime, dashboardEmbed: { ...binding, origin: 'https://foreign.test' } }]) {
    const response = await createRuntimeAnalyticsEligibilityHandler(() => value as Sg2SelectionRuntime)(input())
    assert.equal(response.status, 503); assert(!(await response.text()).includes('analyticsUrl'))
  }
  const response = await createRuntimeAnalyticsEligibilityHandler(() => { throw Error('Hidden configuration detail') })(input())
  assert.equal(response.status, 503); assert(!(await response.text()).includes('Hidden configuration detail'))
  assert.equal(calls, 0)
})

test('underlying authority refusals preserve safe status without returning a chart address', async () => {
  for (const [reason, status] of [['UNVERIFIED_IDENTITY', 401], ['PERMISSION_DENIED', 403], ['CONTEXT_INVALID', 400],
    ['AUDIT_UNAVAILABLE', 503], ['POLICY_UNAVAILABLE', 503]] as const) {
    let reads = 0
    const executor: OperationExecutor<Prisma.TransactionClient> = { contract: OPERATION_CONTRACT,
      async execute() { throw new OperationDenied(reason) } }
    const runtime = { provider: 'clerk' as const, executor, defaultOrganisationId: A, dashboardEmbed: binding,
      marketRead: { executor, preview: async () => { throw Error('No preview fallback') },
        analytics: { executor, series: async () => { reads++; throw Error('Must not read') } } } }
    const response = await createRuntimeAnalyticsEligibilityHandler(() => runtime)(input())
    assert.equal(response.status, status); assert.equal(response.headers.get('vary'), 'Cookie, Authorization')
    assert(!(await response.text()).includes('analyticsUrl')); assert.equal(reads, 0)
  }
})

test('the original URL builder accepts an explicit base without losing identity or enabling warmup', () => {
  const url = new URL(buildDashboardPreviewAnalyticsUrl('pl', 'stored_series', '  Shared market series  ',
    { preparedReadsOnly: true, warmCurrentForecast: false }, binding.origin))
  assert.equal(url.origin, binding.origin); assert.equal(url.pathname, '/pl')
  assert.equal(url.searchParams.get('seriesId'), 'stored_series'); assert.equal(url.searchParams.get('displayName'), 'Shared market series')
  assert.equal(url.searchParams.get('range'), '1Y'); assert.equal(url.searchParams.get('preparedReadsOnly'), '1')
  assert.equal(url.searchParams.has('warmCurrentForecast'), false)
  url.searchParams.set('organisationId', A)
  const localised = new URL(localizeDashboardPreviewAnalyticsUrl(url.toString(), 'en'))
  assert.equal(localised.pathname, '/en'); assert.equal(localised.searchParams.get('organisationId'), A)
})

test('the mounted native dispatcher refuses incomplete and unknown configuration without network or legacy fallback', async () => {
  const prior = process.env.PROFITIA_AUTH_PROVIDER, fetch = globalThis.fetch
  let calls = 0; globalThis.fetch = async () => { calls++; throw Error('No network') }
  try {
    for (const provider of ['clerk', 'unknown']) {
      process.env.PROFITIA_AUTH_PROVIDER = provider
      const response = await mountedGET(input())
      assert.equal(response.status, 503); assert.equal(response.headers.get('cache-control'), 'private, no-store')
      assert(!(await response.text()).includes('analyticsUrl'))
    }
    assert.equal(calls, 0)
  } finally {
    globalThis.fetch = fetch
    if (prior === undefined) delete process.env.PROFITIA_AUTH_PROVIDER; else process.env.PROFITIA_AUTH_PROVIDER = prior
  }
})
