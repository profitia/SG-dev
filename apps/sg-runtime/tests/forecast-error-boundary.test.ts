import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { NextRequest } from 'next/server'
import { cognitionError, cognitionOk } from '../lib/api/middleware'
import {
  createInternalForecastCapabilityRouteHandler,
  createInternalForecastCapabilitiesRouteHandler,
  createInternalForecastReadinessSnapshotRouteHandler,
  createInternalCurrentForecastPreparationRouteHandler,
  createInternalProgressiveForecastPreparationRouteHandler,
} from '../lib/forecast/interactive-route-handlers'
import {
  createForecastPreparationJobsPostHandler,
  createForecastPreparationJobsGetHandler,
} from '../lib/forecast/preparation-route-handlers'
import type { ForecastPreparationIdentitySnapshot } from '../lib/forecast/preparation-queue'
import {
  FORECAST_REQUEST_DIAGNOSTICS_HEADER,
  completeForecastRequestDiagnostics,
  runWithForecastRequestDiagnostics,
  traceForecastRequestDiagnosticsSpan,
} from '../lib/forecast/request-diagnostics'

const privateDetail = 'synthetic-internal-detail-must-not-escape'
const credential = 'isolated-forecast-error-fixture'
const priorMode = process.env.PROFITIA_AUTH_PROVIDER
const priorCredential = process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
const originalFetch = globalThis.fetch
let fetches = 0
before(() => {
  process.env.PROFITIA_AUTH_PROVIDER = 'legacy_demo'
  process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = credential
  globalThis.fetch = async () => { fetches++; throw Error('Unexpected external request') }
})
after(() => {
  globalThis.fetch = originalFetch
  if (priorMode === undefined) delete process.env.PROFITIA_AUTH_PROVIDER
  else process.env.PROFITIA_AUTH_PROVIDER = priorMode
  if (priorCredential === undefined) delete process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN
  else process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = priorCredential
  assert.equal(fetches, 0)
})

const identity = { seriesId: 'synthetic_series', targetSemantics: 'MONTHLY_AVERAGE', modelId: 'arima' } as const
function request(method = 'GET', body: unknown = identity, seriesOnly = false) {
  const query = new URLSearchParams(seriesOnly ? {seriesId: identity.seriesId} : identity)
  return new NextRequest(`https://fixture.invalid/api/internal/forecast/capability?${query}`, {
    method,
    headers: {
      authorization: `Bearer ${credential}`, 'content-type': 'application/json',
      'x-request-id': 'forecast-error-fixture', 'x-sg-forecast-trace': '1',
    },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  })
}
async function captureLogs<T>(operation: (logs: unknown[][]) => Promise<T>) {
  const logs: unknown[][] = [], info = console.info, error = console.error
  console.info = (...args: unknown[]) => { logs.push(args) }
  console.error = (...args: unknown[]) => { logs.push(args) }
  try { return await operation(logs) }
  finally { console.info = info; console.error = error }
}
function assertPrivate(response: Response) {
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  const vary = response.headers.get('vary')?.toLowerCase().split(',').map(value => value.trim()) ?? []
  assert(vary.includes('cookie') && vary.includes('authorization'))
}

for (const status of [500, 502, 503, 599]) {
  test(`central ${status} boundary preserves code/correlation and hides internal text`, async () => {
    const response = cognitionError('FIXTURE_FAILURE', privateDetail, status, 'fixture-request')
    assert.equal(response.status, status)
    const body = await response.json()
    assert.equal(body.error, 'Operation unavailable.'); assert.equal(body.code, 'FIXTURE_FAILURE')
    assert.equal(body.requestId, 'fixture-request'); assert(Number.isFinite(Date.parse(body.timestamp)))
    assert(!JSON.stringify(body).includes(privateDetail))
  })
}
for (const status of [400, 401, 403, 404, 409, 422, 429]) {
  test(`central ${status} retains actionable business/validation message`, async () => {
    const response = cognitionError('EXPECTED_FAILURE', 'Choose a supported model.', status, 'fixture-request')
    assert.equal(response.status, status)
    assert.equal((await response.json()).error, 'Choose a supported model.')
  })
}

for (const thrown of [new Error(privateDetail), privateDetail]) {
  const fail = async (): Promise<never> => { throw thrown }
  const cases = [
    ['capability', createInternalForecastCapabilityRouteHandler(fail), 'GET'],
    ['capabilities', createInternalForecastCapabilitiesRouteHandler(fail), 'GET'],
    ['readiness', createInternalForecastReadinessSnapshotRouteHandler(fail), 'GET'],
    ['current preparation', createInternalCurrentForecastPreparationRouteHandler(fail), 'POST'],
    ['progressive preparation', createInternalProgressiveForecastPreparationRouteHandler(fail), 'POST'],
  ] as const
  for (const [name, handler, method] of cases) {
    test(`${name} hides handled ${typeof thrown} exception in body and traced span log`, async () => {
      await captureLogs(async logs => {
        const response = await handler(request(method, identity, name === 'capabilities' || name === 'readiness'))
        assert.equal(response.status, 500); assertPrivate(response)
        const body = await response.json()
        assert.equal(body.code, 'INTERNAL_FORECAST_OPERATION_FAILED')
        assert.equal(body.error, 'Operation unavailable.'); assert.equal(body.requestId, 'forecast-error-fixture')
        const header = response.headers.get(FORECAST_REQUEST_DIAGNOSTICS_HEADER)
        assert(header); assert(header.length < 1024)
        const summary = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'))
        assert.equal(summary.responseStatus, 500); assert.deepEqual(summary.entries, [])
        assert.equal(logs.length, 1)
        const snapshot = JSON.parse(String(logs[0]![0]))
        assert(snapshot.entries.some((entry: {outcome?: string; error?: string}) => entry.outcome === 'ERROR' && entry.error === 'Operation failed.'))
        assert(!JSON.stringify({body, summary, logs}).includes(privateDetail))
      })
    })
  }
  for (const method of ['GET', 'POST']) {
    test(`preparation ${method} hides handled ${typeof thrown} exception and retains failure code`, async () => {
      await captureLogs(async logs => {
        const handler = method === 'GET' ? createForecastPreparationJobsGetHandler(fail) : createForecastPreparationJobsPostHandler(fail)
        const response = await handler(request(method, {...identity, kind: 'CURRENT'}))
        assert.equal(response.status, 500); assertPrivate(response)
        const body = await response.json()
        assert.equal(body.code, 'FORECAST_PREPARATION_QUEUE_FAILED'); assert.equal(body.error, 'Operation unavailable.')
        assert.equal(body.requestId, 'forecast-error-fixture')
        assert(!JSON.stringify({body, logs}).includes(privateDetail))
      })
    })
  }
}

test('noncritical ready-observation failure preserves business result without logging the exception', async () => {
  const snapshot: ForecastPreparationIdentitySnapshot = {
    ...identity, targetBasis: 'MONTHLY_AVERAGE',
    current: { state: 'READY', reason: null, job: null },
    verification: { state: 'QUEUED', reason: 'PREPARATION_REQUIRED', job: null },
  }
  await captureLogs(async logs => {
    let observations = 0
    const handler = createForecastPreparationJobsGetHandler(async () => snapshot, async (correlation, states) => {
      observations++; assert.equal(correlation, 'forecast-error-fixture')
      assert.deepEqual(states, { currentReady: true, verificationReady: false })
      throw Error(privateDetail)
    })
    const response = await handler(request())
    assert.equal(response.status, 200); assertPrivate(response)
    assert.deepEqual(await response.json(), snapshot); assert.equal(observations, 1)
    assert.deepEqual(logs, [['[forecast-preparation] Dashboard-ready telemetry failed', { correlationId: 'forecast-error-fixture' }]])
    assert(!JSON.stringify(logs).includes(privateDetail))
  })
})

test('diagnostics preserve original exception identity, timing and safe metrics across concurrent requests', async () => {
  await captureLogs(async logs => {
    const snapshots = await Promise.all(['first', 'second'].map(async requestId => {
      const originalError = new Error(privateDetail)
      return runWithForecastRequestDiagnostics({ enabled: true, requestId, route: '/fixture', method: 'GET', operationType: 'OTHER' }, async () => {
        await assert.rejects(traceForecastRequestDiagnosticsSpan('fixture_operation', 'APPLICATION', async () => {
          await Promise.resolve(); throw originalError
        }, { safeCount: 3 }), error => error === originalError)
        const snapshot = completeForecastRequestDiagnostics(500)
        assert(snapshot); assert.equal(snapshot.requestId, requestId)
        assert.equal(snapshot.entries.length, 1)
        const entry = snapshot.entries[0]!
        assert.equal(entry.kind, 'SPAN')
        if (entry.kind !== 'SPAN') throw Error('Expected a diagnostic span')
        assert.equal(entry.outcome, 'ERROR'); assert.equal(entry.error, 'Operation failed.')
        assert(entry.durationMs >= 0); assert(entry.startedAt && entry.completedAt)
        assert.deepEqual(entry.metrics, {safeCount: 3})
        return snapshot
      })
    }))
    assert.deepEqual(snapshots.map(value => value.requestId), ['first', 'second'])
    assert.equal(logs.length, 2); assert(!JSON.stringify({snapshots, logs}).includes(privateDetail))
  })
})

test('successful diagnostics and business response remain unchanged', async () => {
  await captureLogs(async () => runWithForecastRequestDiagnostics({ enabled: true, requestId: 'success', route: '/fixture', method: 'GET', operationType: 'OTHER' }, async () => {
    const result = await traceForecastRequestDiagnosticsSpan('fixture_operation', 'APPLICATION', async () => ({state: 'READY'}))
    assert.deepEqual(await cognitionOk(result).json(), {state: 'READY'})
    const snapshot = completeForecastRequestDiagnostics(200)
    assert(snapshot); const entry = snapshot.entries[0]!
    assert.equal(entry.kind, 'SPAN')
    if (entry.kind !== 'SPAN') throw Error('Expected a diagnostic span')
    assert.equal(entry.outcome, 'SUCCESS'); assert.equal(entry.error, null)
  }))
})
