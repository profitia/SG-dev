import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertPromotionEndpoint,
  assertNeonBranchEndpoint,
  assertPromotionRoute,
  assertSameSemanticRecord,
  exactKey,
  semanticDigest,
} from '../lib/market-data/promotion'
import { applySeries, assertReadOnlySource, scanSeries } from '../scripts/promote-market-forecast-artifacts'
import type { PrismaClient } from '../generated/market-data-client'

test('only ordered releases and explicit Stage-to-Development reconciliation are lawful', () => {
  assert.doesNotThrow(() => assertPromotionRoute({ from: 'development', to: 'staging', reconciliation: false }))
  assert.doesNotThrow(() => assertPromotionRoute({ from: 'staging', to: 'production', reconciliation: false }))
  assert.doesNotThrow(() => assertPromotionRoute({ from: 'staging', to: 'development', reconciliation: true }))
  assert.throws(() => assertPromotionRoute({ from: 'development', to: 'production', reconciliation: false }))
  assert.throws(() => assertPromotionRoute({ from: 'staging', to: 'development', reconciliation: false }))
  assert.throws(() => assertPromotionRoute({ from: 'production', to: 'development', reconciliation: true }))
})

test('promotion endpoint rejects a database or Neon host mismatch', () => {
  const url = 'postgresql://user:secret@ep-dev.eu-central-1.aws.neon.tech/neondb?sslmode=require'
  assert.equal(assertPromotionEndpoint(url, 'ep-dev.eu-central-1.aws.neon.tech', 'Source'), 'ep-dev.eu-central-1.aws.neon.tech')
  assert.throws(() => assertPromotionEndpoint(url, 'ep-stage.eu-central-1.aws.neon.tech', 'Source'))
  assert.throws(() => assertPromotionEndpoint('postgresql://user:secret@localhost/neondb', 'localhost', 'Source'))
  assert.throws(() => assertPromotionEndpoint('postgresql://user:secret@ep-dev.eu-central-1.aws.neon.tech/other', 'ep-dev.eu-central-1.aws.neon.tech', 'Source'))
  assert.throws(() => assertPromotionEndpoint('postgresql://user:secret@ep-dev.eu-central-1.aws.neon.tech/neondb?sslmode=disable', 'ep-dev.eu-central-1.aws.neon.tech', 'Source'))
  assert.equal(assertPromotionEndpoint('postgresql://user:secret@ep-dev-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require', 'ep-dev.eu-central-1.aws.neon.tech', 'Source'), 'ep-dev-pooler.eu-central-1.aws.neon.tech')
  assert.equal(assertNeonBranchEndpoint('br-dev', [{ branch_id: 'br-dev', type: 'read_write', host: 'ep-dev.eu-central-1.aws.neon.tech' }], 'Source'), 'ep-dev.eu-central-1.aws.neon.tech')
  assert.throws(() => assertNeonBranchEndpoint('br-stage', [{ branch_id: 'br-dev', type: 'read_write', host: 'ep-dev.eu-central-1.aws.neon.tech' }], 'Destination'))
})

test('exact artifact identity and semantic payload checks fail closed on conflicts', () => {
  const source = { seriesId: 'b_c1_cl', modelId: 'NAIVE', observedAt: new Date('2026-09-22'), value: '100.00000000', updatedAt: new Date('2026-09-22') }
  const same = { ...source, updatedAt: new Date('2026-09-23') }
  const changed = { ...same, value: '101.00000000' }
  assert.equal(exactKey(source, ['seriesId', 'modelId', 'observedAt']), exactKey(same, ['seriesId', 'modelId', 'observedAt']))
  assert.equal(semanticDigest(source, ['updatedAt']), semanticDigest(same, ['updatedAt']))
  assert.doesNotThrow(() => assertSameSemanticRecord(source, same, 'observation', ['updatedAt']))
  assert.throws(() => assertSameSemanticRecord(source, changed, 'observation', ['updatedAt']))
})

test('promotion rejects a source credential with write privileges', async () => {
  const client = (canWrite: boolean) => ({ $queryRaw: async () => [{ can_write: canWrite }] }) as unknown as PrismaClient
  await assert.doesNotReject(() => assertReadOnlySource(client(false)))
  await assert.rejects(() => assertReadOnlySource(client(true)), /read-only/)
})

test('a missing series, observation and exact prepared run can be promoted and replayed idempotently', async () => {
  const date = new Date('2026-09-22T00:00:00.000Z')
  const series = { id: 'source-series', providerCode: 'MACROBOND', providerSeriesId: 'test-series', displayName: 'Test series', frequency: 'DAILY' }
  const sourceRows: Record<string, Record<string, unknown>[]> = {
    marketHydrationState: [{ id: 'source-hydration', seriesId: series.id, lastProviderFetchAt: date,
      earliestStoredObservationAt: date, latestStoredObservationAt: date, lastHydrationStatus: 'SUCCEEDED' }],
    marketObservation: [{ id: 'source-observation', seriesId: series.id, observedAt: date, value: '100.00000000' }],
    forecastCurrentRun: [{
      id: 'source-run', seriesId: 'test-series', status: 'AVAILABLE', inputSource: 'MACROBOND',
      historyFingerprint: 'fingerprint', targetBasis: 'POINT_IN_TIME', methodId: 'method',
      modelId: 'NAIVE', methodVersion: 'v1', frequency: 'DAILY',
      trainingWindowPolicyId: 'policy', effectiveTrainingPolicyId: 'effective',
    }],
    forecastCurrentPoint: [{ id: 'source-point', runId: 'source-run', horizonLabel: '1M', forecastDate: date, forecastValue: '101.00000000' }],
  }
  const destinationRows: Record<string, Record<string, unknown>[]> = {}

  function fakeClient(rows: Record<string, Record<string, unknown>[]>) {
    const model = (name: string) => ({
      findMany: async (args: { where?: Record<string, unknown>; include?: Record<string, boolean> }) =>
        (rows[name] ?? []).filter((row) => Object.entries(args.where ?? {}).every(([field, value]) => row[field] === value))
          .map((row) => args.include?.points ? { ...row, points: (rows.forecastCurrentPoint ?? []).filter((point) => point.runId === row.id) } : row),
      createMany: async (args: { data: Record<string, unknown>[] }) => { rows[name] ??= []; rows[name]!.push(...args.data) },
      create: async (args: { data: Record<string, unknown> }) => { rows[name] ??= []; rows[name]!.push(args.data); return args.data },
      findUnique: async (args: { where: { providerCode_providerSeriesId?: { providerCode: string; providerSeriesId: string }; seriesId?: string } }) =>
        (rows[name] ?? []).find((row) => args.where.seriesId
          ? row.seriesId === args.where.seriesId
          : row.providerCode === args.where.providerCode_providerSeriesId?.providerCode
            && row.providerSeriesId === args.where.providerCode_providerSeriesId?.providerSeriesId) ?? null,
    })
    const client = {
      marketSeries: model('marketSeries'), marketHydrationState: model('marketHydrationState'), marketObservation: model('marketObservation'),
      forecastCurrentRun: model('forecastCurrentRun'), forecastCurrentPoint: model('forecastCurrentPoint'),
      forecastVerificationRun: model('forecastVerificationRun'), forecastVerificationMetric: model('forecastVerificationMetric'),
      forecastVerificationPoint: model('forecastVerificationPoint'),
      rollingDailyCurrentForecastSnapshot: model('rollingDailyCurrentForecastSnapshot'),
      rollingDailyVerificationRecord: model('rollingDailyVerificationRecord'),
      rollingDailyCalibrationGroup: model('rollingDailyCalibrationGroup'),
      $transaction: async (callback: (transaction: unknown) => Promise<unknown>) => callback(client),
    }
    return client as unknown as PrismaClient
  }

  const source = fakeClient(sourceRows)
  const destination = fakeClient(destinationRows)
  const first = await scanSeries(source, destination, series)
  assert.equal(first.summary.newSeries, true)
  assert.equal(first.summary.missingHydrationState, true)
  assert.equal(first.summary.missingObservations, 1)
  assert.equal(first.summary.missingCurrentRuns, 1)
  await applySeries(destination, series, first)
  const replay = await scanSeries(source, destination, series)
  assert.equal(replay.summary.newSeries, false)
  assert.equal(replay.summary.missingHydrationState, false)
  assert.equal(replay.summary.missingObservations, 0)
  assert.equal(replay.summary.missingCurrentRuns, 0)
})
