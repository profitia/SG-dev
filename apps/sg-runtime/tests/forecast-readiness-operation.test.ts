import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { OPERATION_CONTRACT, OperationDenied, type OperationExecutor, type OperationInput } from '@profitia/platform-contracts/operation-context'
import { USER_FACING_FORECAST_MODELS } from '../lib/forecast/contracts'
import { FORECAST_TARGET_SEMANTICS } from '../lib/forecast/identity'
import { createOperationForecastReadinessHandler, createRuntimeForecastReadinessHandler, legacyForecastReadinessHandlers } from '../lib/forecast/readiness-operation-handlers'
import { createInternalForecastCapabilityRouteHandler, createInternalForecastCapabilitiesRouteHandler, createInternalForecastReadinessSnapshotRouteHandler } from '../lib/forecast/interactive-route-handlers'
import { readForecastReadinessSelection, forecastReadinessResourceId, validatePublicForecastReadiness, publishForecastReadiness,
  projectForecastReadinessResponse, MAX_FORECAST_READINESS_BYTES, type ForecastReadinessSelectionValue } from '../lib/platform/forecast-readiness'
import { GET as mountedCapability } from '../app/api/internal/forecast/capability/route'
import { GET as mountedCapabilities } from '../app/api/internal/forecast/capabilities/route'
import { GET as mountedReadiness } from '../app/api/internal/forecast/readiness/route'

const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222'
const selected = { kind: 'capability', seriesId: 'stored_series', modelId: 'naive', targetSemantics: 'MONTHLY_AVERAGE' } as const
const request = (query = 'seriesId=stored_series&modelId=naive&targetSemantics=MONTHLY_AVERAGE', method = 'GET', headers = {}) =>
  new NextRequest(`https://app.fixture.test/api/internal/forecast/capability?${query}`, { method, headers })
function capability(modelId: typeof USER_FACING_FORECAST_MODELS[number] = 'naive', targetSemantics: typeof FORECAST_TARGET_SEMANTICS[number] = 'MONTHLY_AVERAGE') {
  return { seriesId: 'stored_series', modelId, targetSemantics, preparedReadAuthority: null, sourceFrequency: 'DAILY' as const,
    targetCadence: targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME' ? 'DAILY' as const : 'MONTHLY' as const,
    sourceAvailability: 'AVAILABLE' as const, lawfulTargetSemantics: 'LAWFUL' as const, status: 'PREPARATION_REQUIRED' as const,
    currentReadiness: 'NOT_PREPARED' as const, verificationReadiness: 'NOT_PREPARED' as const,
    recentVerificationReadiness: 'NOT_PREPARED' as const, fastVerificationReadiness: 'NOT_PREPARED' as const, fullVerificationReadiness: 'NOT_PREPARED' as const,
    predictionBandResidualCount: 0, predictionBandState: 'NOT_AVAILABLE' as const,
    readiness: { fastReady: false, bandsReady: false, calibratedReady: false, fullReady: false, blockers: ['CURRENT_MISSING' as const] },
    targetedDataScope: 'SINGLE_SERIES' as const, timingMs: 0, reason: null }
}
function snapshot() {
  return { seriesId: 'stored_series', sourceFrequency: 'DAILY' as const, sourceAvailability: 'AVAILABLE' as const, status: 'AVAILABLE' as const,
    reason: null, targetedDataScope: 'SINGLE_SERIES' as const, timingMs: 0,
    variants: USER_FACING_FORECAST_MODELS.flatMap(model => FORECAST_TARGET_SEMANTICS.map(semantics => capability(model, semantics))) }
}
const executorFor = (run: (input: OperationInput) => void): OperationExecutor<Prisma.TransactionClient> => ({
  contract: OPERATION_CONTRACT,
  async execute(input, callback) {
    run(input)
    return { decision: 'ALLOW', decisionId: A, contractId: OPERATION_CONTRACT.id, contractVersion: OPERATION_CONTRACT.version,
      value: await callback({} as never, {} as never) }
  },
})

test('all three native mounts retain the exact legacy factories and legacy is chosen only explicitly', async () => {
  assert.equal(legacyForecastReadinessHandlers.capability, createInternalForecastCapabilityRouteHandler)
  assert.equal(legacyForecastReadinessHandlers.capabilities, createInternalForecastCapabilitiesRouteHandler)
  assert.equal(legacyForecastReadinessHandlers.readiness, createInternalForecastReadinessSnapshotRouteHandler)
  let legacyCalls = 0
  const legacy = async () => { legacyCalls++; return NextResponse.json({ legacy: true }) }
  for (const kind of ['capability', 'capabilities', 'readiness'] as const) {
    const result = await createRuntimeForecastReadinessHandler(kind, () => ({ provider: 'legacy_demo' }), legacy)(request())
    assert.equal(result.status, 200)
    const unavailable = createRuntimeForecastReadinessHandler(kind, () => ({ provider: 'clerk', executor: executorFor(() => assert.fail('No executor')), defaultOrganisationId: A }), legacy)
    assert.equal((await unavailable(request())).status, 503)
  }
  const old = process.env.PROFITIA_AUTH_PROVIDER
  try {
    process.env.PROFITIA_AUTH_PROVIDER = 'unsupported'
    for (const get of [mountedCapability, mountedCapabilities, mountedReadiness]) assert.equal((await get(request())).status, 503)
  } finally { if (old === undefined) delete process.env.PROFITIA_AUTH_PROVIDER; else process.env.PROFITIA_AUTH_PROVIDER = old }
  assert.equal(legacyCalls, 3)
})

test('representations and exact scientific identities have different resources and bounded strict selections', () => {
  const selections: ForecastReadinessSelectionValue[] = [selected, { kind: 'capabilities', seriesId: selected.seriesId }, { kind: 'readiness', seriesId: selected.seriesId },
    { ...selected, modelId: 'arima' }, { ...selected, targetSemantics: 'END_OF_PERIOD' }]
  assert.equal(new Set(selections.map(forecastReadinessResourceId)).size, selections.length)
  for (const bad of [null, { ...selected, seriesId: '*' }, { ...selected, seriesId: 'x'.repeat(257) }, { ...selected, seriesId: '../*' },
    { ...selected, kind: 'current' }, { ...selected, modelId: 'unknown' }, { ...selected, targetSemantics: 'POINT_IN_TIME' }, { ...selected, userId: A }])
    assert.throws(() => readForecastReadinessSelection(bad), OperationDenied)
})

test('native wrappers refuse opaque technical credentials before runtime composition without borrowing legacy authentication', async () => {
  const old = process.env.PROFITIA_AUTH_PROVIDER
  let runtimeCalls = 0, legacyCalls = 0
  try {
    for (const mode of ['clerk', 'unknown', '']) {
      process.env.PROFITIA_AUTH_PROVIDER = mode
      for (const kind of ['capability', 'capabilities', 'readiness'] as const) {
        const handler = createRuntimeForecastReadinessHandler(kind, () => { runtimeCalls++; throw Error('No opaque credential composition') },
          async () => { legacyCalls++; return NextResponse.json({ legacy: true }) })
        const response = await handler(request(undefined, 'GET', { authorization: 'Bearer synthetic_opaque_service_credential' }))
        assert.equal(response.status, 403); assert.equal((await response.json()).code, 'INTERNAL_SERVICE_AUTH_UNAVAILABLE')
      }
    }
    assert.equal(runtimeCalls, 0); assert.equal(legacyCalls, 0)
  } finally { if (old === undefined) delete process.env.PROFITIA_AUTH_PROVIDER; else process.env.PROFITIA_AUTH_PROVIDER = old }
})

test('a JWT-shaped credential only reaches current authentication and cannot itself grant readiness access', async () => {
  const old = process.env.PROFITIA_AUTH_PROVIDER
  let authenticationCalls = 0, sourceCalls = 0, legacyCalls = 0
  try {
    process.env.PROFITIA_AUTH_PROVIDER = 'clerk'
    const executor = executorFor(() => { authenticationCalls++; throw new OperationDenied('UNVERIFIED_IDENTITY') })
    const handler = createRuntimeForecastReadinessHandler('capability', () => ({ provider: 'clerk', executor, defaultOrganisationId: A,
      forecastRead: { executor, current: async () => assert.fail('No Current fallback'), readiness: { executor, read: async () => { sourceCalls++; return capability() } } } }),
      async () => { legacyCalls++; return NextResponse.json({ legacy: true }) })
    const response = await handler(request(undefined, 'GET', { authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmb3JnZWQifQ.c3ludGhldGlj' }))
    assert.equal(response.status, 401); assert.equal(authenticationCalls, 1); assert.equal(sourceCalls, 0); assert.equal(legacyCalls, 0)
  } finally { if (old === undefined) delete process.env.PROFITIA_AUTH_PROVIDER; else process.env.PROFITIA_AUTH_PROVIDER = old }
})

test('fresh native source and actual readiness route imports do not resolve a global database or contact a provider', () => {
  const script = "let reads=0,network=0;Object.defineProperty(globalThis,'__sgRuntimeMarketDataPrisma__',{configurable:true,get(){reads++;throw Error('Forbidden global source')}});globalThis.fetch=async()=>{network++;throw Error('Forbidden provider')};await import(process.argv[1]);if(reads||network)throw Error('Import resolved resources');console.log(JSON.stringify({reads,network}));"
  for (const path of ['../lib/forecast/stored-readiness-read.ts', '../app/api/internal/forecast/capability/route.ts',
    '../app/api/internal/forecast/capabilities/route.ts', '../app/api/internal/forecast/readiness/route.ts']) {
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', script, new URL(path, import.meta.url).href], {
      env: { ...process.env, MARKET_DATA_DATABASE_URL: 'postgresql://architecture_test_owner@127.0.0.1:1/sg2_operation_test',
        DATABASE_URL: 'postgresql://architecture_test_owner@127.0.0.1:1/sg2_operation_test' }, encoding: 'utf8', timeout: 15000,
    })
    assert.equal(result.status, 0, result.stderr || result.stdout); assert.deepEqual(JSON.parse(result.stdout.trim()), { reads: 0, network: 0 })
  }
})

test('closed readiness preserves zero and all twelve identities while rejecting taint and scope substitution', () => {
  const one = capability(), all = snapshot(), selection = { kind: 'readiness', seriesId: selected.seriesId } as const
  assert.deepEqual(validatePublicForecastReadiness(one, selected), one)
  assert.deepEqual(validatePublicForecastReadiness(all, selection), all)
  for (const bad of [{ ...one, userId: A }, { ...one, trace: {} }, { ...one, seriesId: 'other' }, { ...one, modelId: 'arima' },
    { ...one, timingMs: Infinity }, { ...one, predictionBandResidualCount: -1 }, { ...one, reason: 'SYNTHETIC_PRIVATE_DIAGNOSTIC' },
    { ...one, preparedReadAuthority: { sourceFrequency: 'MONTHLY', targetCadence: 'MONTHLY', expectedHistoryFingerprint: 'a'.repeat(64) } }])
    assert.throws(() => validatePublicForecastReadiness(bad, selected), OperationDenied)
  for (const bad of [{ ...all, variants: all.variants.slice(1) }, { ...all, variants: all.variants.map(() => all.variants[0]) },
    { ...all, variants: all.variants.map((item, i) => i ? item : { ...item, sourceAvailability: 'FAILED' }) }])
    assert.throws(() => validatePublicForecastReadiness(bad, selection), OperationDenied)
  assert.throws(() => validatePublicForecastReadiness(all, selected), OperationDenied)
  assert.throws(() => validatePublicForecastReadiness(one, selection), OperationDenied)
  assert.throws(() => validatePublicForecastReadiness({ ...one, sourceAvailability: 'FAILED' }, selected),
    (error: unknown) => error instanceof OperationDenied && error.reasonCode === 'POLICY_UNAVAILABLE')
  const published = publishForecastReadiness({ ...one, reason: 'SYNTHETIC_PRIVATE_DIAGNOSTIC' }, selected)
  assert.equal(published.reason, 'Stored forecast capability is unavailable.')
  assert(!JSON.stringify(published).includes('SYNTHETIC_PRIVATE_DIAGNOSTIC'))
})

test('projection binds current context and withholds oversized, malformed or non-JSON responses', async () => {
  const context = { payload: selected, resource: { id: forecastReadinessResourceId(selected) } }
  const response = await projectForecastReadinessResponse(NextResponse.json(capability()), context)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.deepEqual(await response.json(), capability())
  for (const value of [NextResponse.json({ ...capability(), privateToken: 'SYNTHETIC' }), new Response('not json'),
    new Response('not json', { headers: { 'content-type': 'application/json' } }),
    NextResponse.json({ ...capability(), reason: 'x'.repeat(MAX_FORECAST_READINESS_BYTES) })])
    await assert.rejects(projectForecastReadinessResponse(value, context), OperationDenied)
  await assert.rejects(projectForecastReadinessResponse(NextResponse.json(capability()), { ...context, resource: { id: 'forecast-current:other' } }), OperationDenied)
})

test('native operation binds organisation, forecast grant and representation before its callback', async () => {
  let calls = 0, observed: OperationInput | undefined
  const executor = executorFor(input => { calls++; observed = input })
  const get = createOperationForecastReadinessHandler('capability', executor, A, async selection => {
    assert.deepEqual(selection, selected); return capability()
  })
  const response = await get(request(`seriesId=stored_series&modelId=naive&targetSemantics=MONTHLY_AVERAGE&organisationId=${B}`))
  assert.equal(response.status, 200); assert.equal(calls, 1)
  assert.equal(observed?.operation, 'forecast.read'); assert.equal(observed?.organisationId, B)
  assert.equal(observed?.resourceId, forecastReadinessResourceId(selected)); assert.deepEqual(observed?.payload, selected)
  for (const kind of ['capabilities', 'readiness'] as const) {
    const result = await createOperationForecastReadinessHandler(kind, executor, A, async selection => {
      assert.deepEqual(selection, { kind, seriesId: 'stored_series' }); return snapshot()
    })(request('seriesId=stored_series'))
    assert.equal(result.status, 200)
  }
})

test('unknown, duplicate, forged and prepared identity inputs refuse before executor/source access', async () => {
  let calls = 0
  const get = createOperationForecastReadinessHandler('capability', executorFor(() => calls++), A, async () => assert.fail('No source'))
  const base = 'seriesId=stored_series&modelId=naive&targetSemantics=MONTHLY_AVERAGE'
  for (const query of ['', `${base}&seriesId=other`, `${base}&modelId=arima`, `${base}&organisationId=bad`, `${base}&userId=${A}`,
    `${base}&kind=readiness`, `${base}&expectedHistoryFingerprint=${'a'.repeat(64)}`, `${base}&sourceFrequency=DAILY`, `${base}&targetCadence=MONTHLY`])
    assert.equal((await get(request(query))).status, 400)
  assert.equal((await get(request(base, 'GET', { 'x-sg-prepared-history-fingerprint': 'a'.repeat(64) }))).status, 400)
  const method = await get(request(base, 'POST')); assert.equal(method.status, 405); assert.equal(method.headers.get('allow'), 'GET')
  for (const kind of ['capabilities', 'readiness'] as const)
    assert.equal((await createOperationForecastReadinessHandler(kind, executorFor(() => calls++), A, async () => snapshot())(request(base))).status, 400)
  assert.equal(calls, 0)
})

test('current denials and audit failures stay stable and never expose diagnostics or call the source', async () => {
  for (const [reason, status] of [['UNVERIFIED_IDENTITY', 401], ['POLICY_UNAVAILABLE', 503], ['AUDIT_UNAVAILABLE', 503], ['CONTEXT_INVALID', 400], ['RESOURCE_SCOPE_MISMATCH', 403]] as const) {
    const executor = executorFor(() => { throw new OperationDenied(reason) })
    const response = await createOperationForecastReadinessHandler('capability', executor, A, async () => assert.fail('Denied source'))(request())
    assert.equal(response.status, status); assert.equal(response.headers.get('cache-control'), 'private, no-store')
  }
  const response = await createOperationForecastReadinessHandler('capability', executorFor(() => { throw Error('SYNTHETIC_PRIVATE_DIAGNOSTIC') }), A, async () => capability())(request())
  assert.equal(response.status, 503); assert(!(await response.text()).includes('SYNTHETIC_PRIVATE_DIAGNOSTIC'))
})
