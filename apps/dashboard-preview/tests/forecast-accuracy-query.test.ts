import test from 'node:test'
import assert from 'node:assert/strict'

import { buildForecastAccuracyCacheKey } from '@/lib/forecast-accuracy/forecast-accuracy-cache'
import { ForecastAccuracyRequestError } from '@/lib/forecast-accuracy/forecast-accuracy-contract'
import { createForecastAccuracyQueryService } from '@/lib/forecast-accuracy/forecast-accuracy-query'
import type { ForecastAccuracyRecordSource } from '@/lib/forecast-accuracy/forecast-accuracy-mapper'

function paramsFrom(entries: Record<string, string>) {
  return new URLSearchParams(entries)
}

function createRecord(overrides: Partial<ForecastAccuracyRecordSource> = {}) {
  return {
    ...baseRecord(),
    ...overrides,
  }
}

function baseRecord() {
  return {
    id: 'acc-1',
    organizationId: 'org-1',
    sourceId: 'market-indexes',
    datasetId: 'accuracy-data',
    pipelineId: 'forecast-accuracy',
    latestRunId: 'run-1',
    dedupeKey: 'benchmark|2026-04-01|1',
    benchmarkCode: 'ALUMINIUM',
    sourceTableName: 'ALUMINIUM',
    orgTableName: 'ALUMINIUM',
    targetDate: '2026-04-01T00:00:00.000Z',
    horizonMonths: 1,
    actualValue: 100,
    forecastValue: 101,
    differenceValue: 1,
    errorType: 'Przeszacowanie',
    duplicateStatus: 'UNIQUE',
    rawRecordCount: 1,
    duplicateCount: 0,
    lineageJson: null,
    metadataJson: null,
    lastSyncedAt: '2026-07-10T15:10:34.526Z',
  }
}

test('queries by benchmarkCode and organization scope', async () => {
  const calls: Array<{ organizationId: string | null; benchmarkCode: string }> = []
  const service = createForecastAccuracyQueryService({
    fetchRecords: async (filters) => {
      calls.push({ organizationId: filters.organizationId, benchmarkCode: filters.benchmarkCode })
      return [createRecord()]
    },
  })

  await service.getForecastAccuracy(paramsFrom({ organizationId: 'org-1', componentCode: 'ALUMINIUM', horizonMonths: '1' }), 'pl')

  assert.deepEqual(calls, [{ organizationId: 'org-1', benchmarkCode: 'ALUMINIUM' }])
})

test('filters payload by selected horizonMonths', async () => {
  const service = createForecastAccuracyQueryService({
    fetchRecords: async () => [
      createRecord({ horizonMonths: 1, targetDate: '2026-04-01T00:00:00.000Z', forecastValue: 101 }),
      createRecord({ id: 'acc-2', dedupeKey: 'benchmark|2026-04-01|3', horizonMonths: 3, forecastValue: 103 }),
    ],
  })

  const response = await service.getForecastAccuracy(paramsFrom({ componentCode: 'ALUMINIUM', horizonMonths: '3' }), 'pl')

  assert.equal(response.selection.horizonMonths, 3)
  assert.equal(response.points.length, 1)
  assert.equal(response.points[0]?.forecastValue, 103)
})

test('sorts points by targetDate ascending', async () => {
  const service = createForecastAccuracyQueryService({
    fetchRecords: async () => [
      createRecord({ id: 'acc-2', dedupeKey: 'benchmark|2026-05-01|1', targetDate: '2026-05-01T00:00:00.000Z' }),
      createRecord({ id: 'acc-1', dedupeKey: 'benchmark|2026-04-01|1', targetDate: '2026-04-01T00:00:00.000Z' }),
    ],
  })

  const response = await service.getForecastAccuracy(paramsFrom({ componentCode: 'ALUMINIUM', horizonMonths: '1' }), 'pl')

  assert.deepEqual(response.points.map((point) => point.targetDate), [
    '2026-04-01T00:00:00.000Z',
    '2026-05-01T00:00:00.000Z',
  ])
})

test('returns sorted unique available horizons', async () => {
  const service = createForecastAccuracyQueryService({
    fetchRecords: async () => [
      createRecord({ horizonMonths: 6, dedupeKey: 'benchmark|2026-04-01|6' }),
      createRecord({ id: 'acc-2', horizonMonths: 1, dedupeKey: 'benchmark|2026-04-01|1' }),
      createRecord({ id: 'acc-3', horizonMonths: 6, dedupeKey: 'benchmark|2026-05-01|6', targetDate: '2026-05-01T00:00:00.000Z' }),
      createRecord({ id: 'acc-4', horizonMonths: 3, dedupeKey: 'benchmark|2026-04-01|3' }),
    ],
  })

  const response = await service.getForecastAccuracy(paramsFrom({ componentCode: 'ALUMINIUM', horizonMonths: '1' }), 'pl')

  assert.deepEqual(response.availableHorizons, [1, 3, 6])
})

test('returns NO_ACCURACY_DATA when selected horizon has no records', async () => {
  const service = createForecastAccuracyQueryService({
    fetchRecords: async () => [createRecord({ horizonMonths: 1 })],
  })

  await assert.rejects(
    () => service.getForecastAccuracy(paramsFrom({ componentCode: 'ALUMINIUM', horizonMonths: '12' }), 'pl'),
    (error: unknown) => error instanceof ForecastAccuracyRequestError && error.code === 'NO_ACCURACY_DATA',
  )
})

test('requires componentCode benchmark selection', async () => {
  const service = createForecastAccuracyQueryService({
    fetchRecords: async () => [createRecord()],
  })

  await assert.rejects(
    () => service.getForecastAccuracy(paramsFrom({ horizonMonths: '1' }), 'pl'),
    (error: unknown) => error instanceof ForecastAccuracyRequestError && error.code === 'BENCHMARK_REQUIRED',
  )
})

test('rejects invalid horizon values', async () => {
  const service = createForecastAccuracyQueryService({
    fetchRecords: async () => [createRecord()],
  })

  await assert.rejects(
    () => service.getForecastAccuracy(paramsFrom({ componentCode: 'ALUMINIUM', horizonMonths: '2' }), 'pl'),
    (error: unknown) => error instanceof ForecastAccuracyRequestError && error.code === 'INVALID_HORIZON',
  )
})

test('ignores records with null forecast values', async () => {
  const service = createForecastAccuracyQueryService({
    fetchRecords: async () => [
      createRecord({ forecastValue: null }),
      createRecord({ id: 'acc-2', dedupeKey: 'benchmark|2026-05-01|1', targetDate: '2026-05-01T00:00:00.000Z', forecastValue: 110 }),
    ],
  })

  const response = await service.getForecastAccuracy(paramsFrom({ componentCode: 'ALUMINIUM', horizonMonths: '1' }), 'pl')

  assert.equal(response.points.length, 1)
  assert.equal(response.points[0]?.targetDate, '2026-05-01T00:00:00.000Z')
})

test('preserves actual, forecast, difference and error type values', async () => {
  const service = createForecastAccuracyQueryService({
    fetchRecords: async () => [
      createRecord({ actualValue: 88.5, forecastValue: 92.25, differenceValue: 3.75, errorType: 'Niedoszacowanie' }),
    ],
  })

  const response = await service.getForecastAccuracy(paramsFrom({ componentCode: 'ALUMINIUM', horizonMonths: '1' }), 'pl')
  const [point] = response.points

  assert.equal(point?.actualValue, 88.5)
  assert.equal(point?.forecastValue, 92.25)
  assert.equal(point?.sourceDifferenceValue, 3.75)
  assert.equal(point?.sourceErrorType, 'Niedoszacowanie')
})

test('passes date range filters to repository and validates invalid ranges', async () => {
  const calls: Array<{ dateFrom: string | null; dateTo: string | null }> = []
  const service = createForecastAccuracyQueryService({
    fetchRecords: async (filters) => {
      calls.push({
        dateFrom: filters.dateFrom?.toISOString() ?? null,
        dateTo: filters.dateTo?.toISOString() ?? null,
      })
      return [createRecord()]
    },
  })

  await service.getForecastAccuracy(
    paramsFrom({
      componentCode: 'ALUMINIUM',
      horizonMonths: '1',
      dateFrom: '2026-01-01T00:00:00.000Z',
      dateTo: '2026-12-01T00:00:00.000Z',
    }),
    'pl',
  )

  assert.deepEqual(calls, [{
    dateFrom: '2026-01-01T00:00:00.000Z',
    dateTo: '2026-12-01T00:00:00.000Z',
  }])

  await assert.rejects(
    () => service.getForecastAccuracy(paramsFrom({ componentCode: 'ALUMINIUM', dateFrom: '2026-12-01', dateTo: '2026-01-01' }), 'pl'),
    (error: unknown) => error instanceof ForecastAccuracyRequestError && error.code === 'INVALID_DATE_RANGE',
  )
})

test('builds cache keys per horizon and date window', () => {
  const base = {
    locale: 'pl' as const,
    organizationId: 'org-1',
    benchmarkCode: 'ALUMINIUM',
    horizonMonths: 1,
    dateFrom: null,
    dateTo: null,
  }

  assert.notEqual(
    buildForecastAccuracyCacheKey(base),
    buildForecastAccuracyCacheKey({ ...base, horizonMonths: 3 }),
  )

  assert.notEqual(
    buildForecastAccuracyCacheKey(base),
    buildForecastAccuracyCacheKey({ ...base, dateFrom: '2026-01-01T00:00:00.000Z' }),
  )
})

test('deduplicates identical in-flight requests', async () => {
  let callCount = 0
  const service = createForecastAccuracyQueryService({
    fetchRecords: async () => {
      callCount += 1
      await new Promise((resolve) => setTimeout(resolve, 10))
      return [createRecord()]
    },
  })

  const searchParams = paramsFrom({ componentCode: 'ALUMINIUM', horizonMonths: '1' })

  const [first, second] = await Promise.all([
    service.getForecastAccuracy(searchParams, 'pl'),
    service.getForecastAccuracy(searchParams, 'pl'),
  ])

  assert.equal(callCount, 1)
  assert.deepEqual(first.points, second.points)
})

test('returns a stable error contract payload', () => {
  const error = new ForecastAccuracyRequestError(400, 'INVALID_HORIZON', 'Bad horizon')

  assert.deepEqual(error.toResponse(), {
    error: {
      code: 'INVALID_HORIZON',
      message: 'Bad horizon',
    },
  })
})

test('reports coverage and available horizons even when horizon is omitted', async () => {
  const service = createForecastAccuracyQueryService({
    fetchRecords: async () => [
      createRecord({ horizonMonths: 1, targetDate: '2026-04-01T00:00:00.000Z' }),
      createRecord({ id: 'acc-2', horizonMonths: 3, dedupeKey: 'benchmark|2026-05-01|3', targetDate: '2026-05-01T00:00:00.000Z' }),
    ],
  })

  const response = await service.getForecastAccuracy(paramsFrom({ componentCode: 'ALUMINIUM' }), 'pl')

  assert.equal(response.selection.horizonMonths, null)
  assert.deepEqual(response.availableHorizons, [1, 3])
  assert.equal(response.coverage.pointCount, 0)
})