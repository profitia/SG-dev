import assert from 'node:assert/strict'
import test from 'node:test'

import type { BenchmarkHistoricalSeriesResult } from '../lib/benchmark/contracts'
import {
  createForecastCapabilityService,
  normalizeForecastSourceFrequency,
  resolveForecastCapabilities,
  type ForecastCapabilityProvenance,
  type ForecastSourceFrequency,
} from '../lib/forecast/capability-resolver'
import { createForecastIdentity } from '../lib/forecast/identity'

function provenProvenance(
  sourceFrequency: ForecastCapabilityProvenance['sourceFrequency'],
  targetSemantics: 'END_OF_PERIOD' | 'MONTHLY_AVERAGE',
): ForecastCapabilityProvenance {
  return {
    sourceFrequency,
    targetSemantics,
    preparation: {
      method: targetSemantics === 'END_OF_PERIOD' ? 'PROVEN_PERIOD_END_LEVEL' : 'PROVEN_MONTHLY_ARITHMETIC_MEAN',
      version: 'test-provenance-v1',
      provenanceStatus: 'PROVEN',
    },
    sourceLineage: 'controlled-test-lineage',
    closedPeriod: true,
    levelAtTimestamp: targetSemantics === 'END_OF_PERIOD' ? true : null,
    exactSourceObservedAt: targetSemantics === 'END_OF_PERIOD' ? true : null,
    aggregation: targetSemantics === 'MONTHLY_AVERAGE' ? 'ARITHMETIC_MEAN' : null,
    underlyingObservationFrequency: targetSemantics === 'MONTHLY_AVERAGE' ? 'DAILY' : null,
    missingObservationPolicy: targetSemantics === 'MONTHLY_AVERAGE' ? 'USE_AVAILABLE_LAWFUL_OBSERVATIONS_ONLY' : null,
    syntheticObservations: targetSemantics === 'MONTHLY_AVERAGE' ? false : null,
  }
}

function resolve(input: Partial<Parameters<typeof resolveForecastCapabilities>[0]> = {}) {
  return resolveForecastCapabilities({
    seriesId: 'arbitrary.series',
    sourceFrequency: 'DAILY',
    sourceObservationCount: 120,
    preparedObservationCounts: {
      END_OF_PERIOD: 48,
      MONTHLY_AVERAGE: 48,
      ROLLING_DAILY_POINT_IN_TIME: 120,
    },
    provenance: [],
    preparedVariants: [],
    ...input,
  })
}

test('normalizes the exact accepted native frequency family without substring collisions', () => {
  assert.deepEqual(
    [
      'Daily',
      'Weekly',
      'Monthly',
      'Bimonthly',
      'Quarterly',
      'Quadmonthly',
      'Semiannual',
      'Annual',
    ].map(normalizeForecastSourceFrequency),
    [
      'DAILY',
      'WEEKLY',
      'MONTHLY',
      'BIMONTHLY',
      'QUARTERLY',
      'QUADMONTHLY',
      'SEMIANNUAL',
      'ANNUAL',
    ],
  )

  assert.notEqual(normalizeForecastSourceFrequency('Bimonthly'), 'MONTHLY')
  assert.notEqual(normalizeForecastSourceFrequency('Quadmonthly'), 'MONTHLY')
  assert.equal(normalizeForecastSourceFrequency('Monthly average'), null)
  assert.equal(normalizeForecastSourceFrequency('Yearly'), null)
  assert.equal(normalizeForecastSourceFrequency(null), null)
})

test('resolves all twelve variants for an arbitrary lawful DAILY series without ticker branching', () => {
  const capabilities = resolve({
    seriesId: 'arbitrary.daily.series',
  })

  assert.equal(capabilities.length, 12)
  assert.deepEqual(new Set(capabilities.map((item) => item.identity.modelId)), new Set([
    'naive',
    'damped_holt',
    'ets',
    'arima',
  ]))
  assert.ok(capabilities.every((item) => item.identity.seriesId === 'arbitrary.daily.series'))
  assert.ok(capabilities.every((item) => item.semanticLawfulness === 'LAWFUL'))
  assert.ok(capabilities.every((item) => item.implementationState === 'SUPPORTED'))
  assert.ok(capabilities.every((item) => item.historyEligibility === 'ELIGIBLE'))
  assert.ok(capabilities.every((item) => item.targetPreparationState === 'PREPARED'))
  assert.ok(capabilities.every((item) => item.capabilityState === 'NOT_PREPARED'))
  assert.ok(capabilities.every((item) => item.currentPreparedState === 'NOT_PREPARED'))
  assert.ok(capabilities.every((item) => item.historicalPreparedState === 'NOT_PREPARED'))
})

test('WEEKLY Average and EOP are lawful with provenance while Rolling Daily is not lawful', () => {
  const withoutProvenance = resolve({
    sourceFrequency: 'WEEKLY',
    sourceObservationCount: 80,
    preparedObservationCounts: {},
  })
  const eop = withoutProvenance.filter((item) => item.identity.targetSemantics === 'END_OF_PERIOD')
  const average = withoutProvenance.filter((item) => item.identity.targetSemantics === 'MONTHLY_AVERAGE')
  const rollingDaily = withoutProvenance.filter((item) => item.identity.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME')

  assert.ok(eop.every((item) => item.semanticLawfulness === 'LAWFUL_WITH_PROVENANCE'))
  assert.ok(eop.every((item) => item.admissionState === 'PROVENANCE_REQUIRED'))
  assert.ok(eop.every((item) => item.capabilityState === 'PROVENANCE_REQUIRED'))
  assert.ok(average.every((item) => item.semanticLawfulness === 'LAWFUL_WITH_PROVENANCE'))
  assert.ok(average.every((item) => item.capabilityState === 'PROVENANCE_REQUIRED'))
  assert.ok(rollingDaily.every((item) => item.semanticLawfulness === 'NOT_LAWFUL'))
  assert.ok(rollingDaily.every((item) => item.capabilityState === 'NOT_LAWFUL'))

  const withProvenance = resolve({
    sourceFrequency: 'WEEKLY',
    sourceObservationCount: 80,
    preparedObservationCounts: { END_OF_PERIOD: 48 },
    provenance: [provenProvenance('WEEKLY', 'END_OF_PERIOD')],
  }).filter((item) => item.identity.targetSemantics === 'END_OF_PERIOD')

  assert.ok(withProvenance.every((item) => item.admissionState === 'ADMITTED'))
  assert.ok(withProvenance.every((item) => item.implementationState === 'SUPPORTED'))
  assert.ok(withProvenance.every((item) => item.historyEligibility === 'ELIGIBLE'))
  assert.ok(withProvenance.every((item) => item.capabilityState === 'NOT_PREPARED'))
})

test('native MONTHLY capabilities fail closed without exact same-target provenance', () => {
  const withoutProvenance = resolve({
    sourceFrequency: 'MONTHLY',
    sourceObservationCount: 48,
    preparedObservationCounts: {
      END_OF_PERIOD: 48,
      MONTHLY_AVERAGE: 48,
    },
  })

  assert.ok(withoutProvenance
    .filter((item) => item.identity.targetSemantics !== 'ROLLING_DAILY_POINT_IN_TIME')
    .every((item) => item.capabilityState === 'PROVENANCE_REQUIRED'))
  assert.ok(withoutProvenance
    .filter((item) => item.identity.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME')
    .every((item) => item.capabilityState === 'NOT_LAWFUL'))

  const withProvenance = resolve({
    sourceFrequency: 'MONTHLY',
    sourceObservationCount: 48,
    preparedObservationCounts: {
      END_OF_PERIOD: 48,
      MONTHLY_AVERAGE: 48,
    },
    provenance: [
      provenProvenance('MONTHLY', 'END_OF_PERIOD'),
      provenProvenance('MONTHLY', 'MONTHLY_AVERAGE'),
    ],
  })

  assert.ok(withProvenance
    .filter((item) => item.identity.targetSemantics !== 'ROLLING_DAILY_POINT_IN_TIME')
    .every((item) => item.admissionState === 'ADMITTED'))
  assert.ok(withProvenance
    .filter((item) => item.identity.targetSemantics !== 'ROLLING_DAILY_POINT_IN_TIME')
    .every((item) => item.implementationState === 'SUPPORTED'))
  assert.ok(withProvenance
    .filter((item) => item.identity.targetSemantics !== 'ROLLING_DAILY_POINT_IN_TIME')
    .every((item) => item.capabilityState === 'NOT_PREPARED'))
})

test('a PROVEN label without the required semantic evidence still fails closed', () => {
  const malformed = {
    ...provenProvenance('MONTHLY', 'MONTHLY_AVERAGE'),
    syntheticObservations: true,
  }
  const capabilities = resolve({
    sourceFrequency: 'MONTHLY',
    sourceObservationCount: 48,
    preparedObservationCounts: { MONTHLY_AVERAGE: 48 },
    provenance: [malformed],
  }).filter((item) => item.identity.targetSemantics === 'MONTHLY_AVERAGE')

  assert.ok(capabilities.every((item) => item.admissionState === 'PROVENANCE_REQUIRED'))
  assert.ok(capabilities.every((item) => item.capabilityState === 'PROVENANCE_REQUIRED'))
})

test('reports target-specific insufficient history without lowering either minimum', () => {
  const capabilities = resolve({
    sourceObservationCount: 59,
    preparedObservationCounts: {
      END_OF_PERIOD: 35,
      MONTHLY_AVERAGE: 35,
      ROLLING_DAILY_POINT_IN_TIME: 59,
    },
  })

  assert.ok(capabilities.every((item) => item.historyEligibility === 'INSUFFICIENT_HISTORY'))
  assert.ok(capabilities.every((item) => item.capabilityState === 'INSUFFICIENT_HISTORY'))
  assert.deepEqual(new Set(capabilities.map((item) => item.minimumRequiredObservations)), new Set([36, 60]))
})

test('proves the frozen eight-frequency business target matrix and default target cadence', () => {
  const frequencies = [
    'DAILY',
    'WEEKLY',
    'MONTHLY',
    'BIMONTHLY',
    'QUARTERLY',
    'QUADMONTHLY',
    'SEMIANNUAL',
    'ANNUAL',
  ] as const
  let variantCount = 0

  for (const sourceFrequency of frequencies) {
    const capabilities = resolve({
      sourceFrequency,
      sourceObservationCount: 36,
      preparedObservationCounts: sourceFrequency === 'DAILY'
        ? { END_OF_PERIOD: 36, MONTHLY_AVERAGE: 36, ROLLING_DAILY_POINT_IN_TIME: 60 }
        : {},
    })
      variantCount += capabilities.length
    const byTarget = (target: 'DAILY' | 'AVERAGE' | 'END_OF_PERIOD') => (
      capabilities.filter((item) => item.businessTarget === target)
    )

    assert.ok(byTarget('DAILY').every((item) => item.targetSemanticsSupported === (sourceFrequency === 'DAILY')))
    assert.ok(byTarget('AVERAGE').every((item) => item.targetSemanticsSupported))
    assert.ok(byTarget('END_OF_PERIOD').every((item) => item.targetSemanticsSupported))
    assert.ok(capabilities.every((item) => item.sourceFrequencyRecognized))
    assert.ok(capabilities
      .filter((item) => item.businessTarget !== 'DAILY' && sourceFrequency !== 'DAILY')
      .every((item) => item.targetCadence === (
        sourceFrequency === 'WEEKLY' && item.businessTarget === 'END_OF_PERIOD'
          ? 'MONTHLY'
          : sourceFrequency
      )))
    assert.ok(capabilities.every((item) => {
      const expected = item.businessTarget === 'DAILY'
        ? sourceFrequency === 'DAILY' ? 'SUPPORTED' : 'NOT_APPLICABLE'
        : sourceFrequency === 'DAILY'
          || sourceFrequency === 'MONTHLY'
          || (sourceFrequency === 'WEEKLY' && item.businessTarget === 'END_OF_PERIOD')
          || ['BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL'].includes(sourceFrequency)
            ? 'SUPPORTED'
            : 'NOT_IMPLEMENTED'
      return item.implementationState === expected
    }))
  }

  assert.equal(variantCount, 96)
})

test('keeps sparse semantic support separate from model and real execution eligibility', () => {
  const annual35 = resolve({
    sourceFrequency: 'ANNUAL',
    sourceObservationCount: 35,
    preparedObservationCounts: {},
  }).filter((item) => item.businessTarget !== 'DAILY')
  const annual36 = resolve({
    sourceFrequency: 'ANNUAL',
    sourceObservationCount: 36,
    preparedObservationCounts: {},
  }).filter((item) => item.businessTarget !== 'DAILY')

  assert.ok(annual35.every((item) => item.targetSemanticsSupported))
  assert.ok(annual35.every((item) => !item.modelEligible))
  assert.ok(annual35.every((item) => !item.currentForecastEligible))
  assert.ok(annual35.every((item) => item.historyEligibility === 'INSUFFICIENT_HISTORY'))
  assert.ok(annual36.every((item) => item.modelEligible))
  assert.ok(annual36.every((item) => !item.currentForecastEligible))
  assert.ok(annual36.every((item) => item.implementationState === 'SUPPORTED'))
})

test('enables only real-provider-accepted native sparse Average and EOP execution', () => {
  for (const sourceFrequency of ['BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL'] as const) {
    const capabilities = resolve({
      sourceFrequency,
      sourceObservationCount: 40,
      preparedObservationCounts: { END_OF_PERIOD: 40, MONTHLY_AVERAGE: 40 },
      provenance: [
        provenProvenance(sourceFrequency, 'END_OF_PERIOD'),
        provenProvenance(sourceFrequency, 'MONTHLY_AVERAGE'),
      ],
    })

    assert.ok(capabilities
      .filter((item) => item.businessTarget !== 'DAILY')
      .every((item) => item.implementationState === 'SUPPORTED' && item.currentForecastEligible))
    assert.ok(capabilities
      .filter((item) => item.businessTarget === 'DAILY')
      .every((item) => item.implementationState === 'NOT_APPLICABLE'))
  }
})

test('reports exact native-step horizon support without rounding', () => {
  const capability = (sourceFrequency: ForecastSourceFrequency | null, horizonMonths: number) => (
    resolve({ sourceFrequency, horizonMonths }).find((item) => item.businessTarget === 'AVERAGE')
  )

  assert.deepEqual(
    [1, 3, 6, 12].map((months) => capability('MONTHLY', months)?.horizonSteps),
    [1, 3, 6, 12],
  )
  assert.equal(capability('QUARTERLY', 3)?.horizonSupportState, 'SUPPORTED')
  assert.equal(capability('QUARTERLY', 3)?.horizonSteps, 1)
  assert.equal(resolve({ sourceFrequency: 'QUARTERLY', horizonSteps: 4 })[0]?.horizonSteps, 4)
  assert.equal(resolve({ sourceFrequency: 'QUARTERLY', horizonSteps: 4 })[0]?.horizonSupportState, 'SUPPORTED')
  assert.equal(capability('QUARTERLY', 1)?.horizonSupportState, 'UNSUPPORTED')
  assert.equal(capability('ANNUAL', 6)?.horizonSupportState, 'UNSUPPORTED')
  assert.equal(capability('WEEKLY', 1)?.horizonSupportState, 'UNSUPPORTED')
})

test('rejects ambiguous or invalid horizon requests instead of rounding', () => {
  assert.throws(
    () => resolve({ sourceFrequency: 'QUARTERLY', horizonSteps: 1, horizonMonths: 3 }),
    /either native steps or legacy calendar months/i,
  )
  assert.equal(resolve({ sourceFrequency: 'QUARTERLY', horizonSteps: 0 })[0]?.horizonSupportState, 'UNSUPPORTED')
})

test('keeps Current Forecast eligibility independent from verification and band sample thresholds', () => {
  const cases = [
    { origins: 24, residuals: 30, verification: 'SUFFICIENT', bands: 'AVAILABLE' },
    { origins: 23, residuals: 30, verification: 'LIMITED_SAMPLE', bands: 'AVAILABLE' },
    { origins: 24, residuals: 29, verification: 'SUFFICIENT', bands: 'INSUFFICIENT_SAMPLE' },
    { origins: 23, residuals: 29, verification: 'LIMITED_SAMPLE', bands: 'INSUFFICIENT_SAMPLE' },
  ] as const

  for (const sample of cases) {
    const capability = resolve({
      verificationOriginCounts: { END_OF_PERIOD: sample.origins },
      predictionBandResidualCounts: { END_OF_PERIOD: sample.residuals },
    }).find((item) => item.businessTarget === 'END_OF_PERIOD')
    assert.equal(capability?.currentForecastEligible, true)
    assert.equal(capability?.verificationEvidenceState, sample.verification)
    assert.equal(capability?.predictionBandState, sample.bands)
  }

  const ineligible = resolve({
    preparedObservationCounts: { END_OF_PERIOD: 35 },
    verificationOriginCounts: { END_OF_PERIOD: 24 },
    predictionBandResidualCounts: { END_OF_PERIOD: 30 },
  }).find((item) => item.businessTarget === 'END_OF_PERIOD')
  assert.equal(ineligible?.currentForecastEligible, false)
  assert.equal(ineligible?.historyEligibility, 'INSUFFICIENT_HISTORY')
})

test('distinguishes no source data from insufficient prepared history', () => {
  const capabilities = resolve({
    sourceObservationCount: 0,
    preparedObservationCounts: {},
  })

  assert.ok(capabilities.every((item) => item.historyEligibility === 'DATA_NOT_AVAILABLE'))
  assert.ok(capabilities.every((item) => item.capabilityState === 'DATA_NOT_AVAILABLE'))
})

test('prepared readiness is matched by the complete Phase 3 identity', () => {
  const identity = createForecastIdentity({
    seriesId: 'identity.series',
    targetBasis: 'END_OF_PERIOD',
    modelId: 'arima',
  })
  const capabilities = resolve({
    seriesId: 'identity.series',
    preparedVariants: [{ identity, current: 'READY', historical: 'READY' }],
  })
  const eopArima = capabilities.find((item) => (
    item.identity.targetSemantics === 'END_OF_PERIOD' && item.identity.modelId === 'arima'
  ))
  const monthlyAverageArima = capabilities.find((item) => (
    item.identity.targetSemantics === 'MONTHLY_AVERAGE' && item.identity.modelId === 'arima'
  ))

  assert.equal(eopArima?.capabilityState, 'AVAILABLE')
  assert.equal(monthlyAverageArima?.capabilityState, 'NOT_PREPARED')
  assert.notDeepEqual(eopArima?.identity, monthlyAverageArima?.identity)
})

test('keeps current Forecast and historical Verification readiness independent', () => {
  const identity = createForecastIdentity({
    seriesId: 'split.readiness.series',
    targetBasis: 'MONTHLY_AVERAGE',
    modelId: 'ets',
  })
  const capability = resolve({
    seriesId: identity.seriesId,
    preparedVariants: [{ identity, current: 'READY', historical: 'NOT_PREPARED' }],
  }).find((item) => item.identity.targetSemantics === identity.targetSemantics && item.identity.modelId === 'ets')

  assert.equal(capability?.currentPreparedState, 'READY')
  assert.equal(capability?.historicalPreparedState, 'NOT_PREPARED')
  assert.equal(capability?.capabilityState, 'NOT_PREPARED')
})

function createDailyHistory(seriesId: string): BenchmarkHistoricalSeriesResult {
  const historical = Array.from({ length: 48 }, (_, monthIndex) => [0, 14].map((dayOffset) => ({
    date: new Date(Date.UTC(2021 + Math.floor(monthIndex / 12), monthIndex % 12, 1 + dayOffset)).toISOString(),
    value: 100 + monthIndex + dayOffset / 100,
  }))).flat()

  return {
    providerSeries: {
      provider: { providerCode: 'MACROBOND', displayName: 'Macrobond' },
      providerSeriesId: seriesId,
      providerSeriesKey: seriesId,
    },
    displayName: seriesId,
    frequency: 'Daily',
    currency: null,
    unit: null,
    source: 'Controlled fixture',
    historical,
  }
}

test('generic service resolves multiple arbitrary series through one full-history and targeted-hydration path', async () => {
  const requested: Array<{ seriesId: string, range: string }> = []
  const service = createForecastCapabilityService({
    async resolveHistoricalSeries(seriesId, range) {
      requested.push({ seriesId, range })
      return {
        history: createDailyHistory(seriesId),
        marketDataSource: 'macrobond',
        cacheStatus: 'miss',
      }
    },
    now: () => new Date('2025-01-15T00:00:00.000Z'),
  })

  const first = await service.resolveBySeriesId('generic.alpha')
  const second = await service.resolveBySeriesId('generic.beta')

  assert.deepEqual(requested, [
    { seriesId: 'generic.alpha', range: 'ALL' },
    { seriesId: 'generic.beta', range: 'ALL' },
  ])
  assert.equal(first.sourceMetadata.fullHistoryObservationCount, 96)
  assert.equal(first.sourceMetadata.sourceObservationCount, 96)
  assert.equal(first.targetedHydration.scope, 'SINGLE_SERIES')
  assert.equal(first.targetedHydration.requestedSeriesId, 'generic.alpha')
  assert.equal(second.targetedHydration.requestedSeriesId, 'generic.beta')
  assert.ok(first.capabilities.every((item) => item.identity.seriesId === 'generic.alpha'))
  assert.ok(second.capabilities.every((item) => item.identity.seriesId === 'generic.beta'))
  assert.ok(first.capabilities.every((item) => item.historyEligibility === 'ELIGIBLE'))
  assert.ok(first.capabilities
    .filter((item) => item.identity.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME')
    .every((item) => item.availableObservations === 96))
  assert.ok(first.capabilities
    .filter((item) => item.identity.targetSemantics !== 'ROLLING_DAILY_POINT_IN_TIME')
    .every((item) => item.availableObservations === 48))
})

test('service enables the lawful sparse frequency family behind provenance admission', async () => {
  const expected = new Map([
    ['Bimonthly', 'BIMONTHLY'],
    ['Quarterly', 'QUARTERLY'],
    ['Quadmonthly', 'QUADMONTHLY'],
    ['Semiannual', 'SEMIANNUAL'],
    ['Annual', 'ANNUAL'],
  ] as const)

  for (const [rawFrequency, normalizedFrequency] of expected) {
    const service = createForecastCapabilityService({
      async resolveHistoricalSeries(seriesId) {
        const history = createDailyHistory(seriesId)
        history.frequency = rawFrequency
        return { history, marketDataSource: 'macrobond', cacheStatus: 'miss' }
      },
      async resolveProvenance() {
        return []
      },
      async readPreparedVariants() {
        return []
      },
    })
    const resolution = await service.resolveBySeriesId(`generic.${rawFrequency.toLowerCase()}`)

    assert.equal(resolution.status, 'AVAILABLE')
    assert.equal(resolution.sourceMetadata.sourceFrequency, normalizedFrequency)
    const periodCapabilities = resolution.capabilities.filter((capability) => capability.businessTarget !== 'DAILY')
    const expectedImplementation = normalizedFrequency === 'QUADMONTHLY' ? 'NOT_IMPLEMENTED' : 'SUPPORTED'
    assert.ok(periodCapabilities.every((capability) => capability.implementationState === expectedImplementation))
    assert.ok(periodCapabilities.every((capability) => capability.capabilityState === 'PROVENANCE_REQUIRED'))
    assert.ok(resolution.capabilities
      .filter((capability) => capability.businessTarget !== 'DAILY')
      .every((capability) => capability.targetSemanticsSupported))
    assert.ok(resolution.capabilities
      .filter((capability) => capability.businessTarget === 'DAILY')
      .every((capability) => capability.capabilityState === 'NOT_LAWFUL'))
  }

  const unknownService = createForecastCapabilityService({
    async resolveHistoricalSeries(seriesId) {
      const history = createDailyHistory(seriesId)
      history.frequency = 'Monthly average'
      return { history, marketDataSource: 'macrobond', cacheStatus: 'miss' }
    },
  })
  const unknown = await unknownService.resolveBySeriesId('generic.unknown')
  assert.equal(unknown.status, 'FAILED')
  assert.match(unknown.reason ?? '', /frequency is unavailable or unsupported/i)
})

function createNativeMonthlyHistory(seriesId: string): BenchmarkHistoricalSeriesResult {
  const history = createDailyHistory(seriesId)
  history.frequency = 'Monthly'
  history.historical = Array.from({ length: 48 }, (_, monthIndex) => ({
    date: new Date(Date.UTC(2021 + Math.floor(monthIndex / 12), monthIndex % 12, 25)).toISOString(),
    value: 100 + monthIndex,
  }))
  return history
}

test('service prepares provenance-qualified WEEKLY EOP and native MONTHLY targets without ticker code', async () => {
  const weeklyHistory = createDailyHistory('generic.weekly')
  weeklyHistory.frequency = 'Weekly'
  const monthlyHistory = createNativeMonthlyHistory('generic.monthly')
  const histories = new Map([
    ['generic.weekly', weeklyHistory],
    ['generic.monthly', monthlyHistory],
  ])
  const service = createForecastCapabilityService({
    async resolveHistoricalSeries(seriesId) {
      const history = histories.get(seriesId)
      if (!history) {
        throw new Error(`Missing fixture ${seriesId}.`)
      }
      return { history, marketDataSource: 'postgres', cacheStatus: 'hit' }
    },
    async resolveProvenance(seriesId) {
      return seriesId === 'generic.weekly'
        ? [provenProvenance('WEEKLY', 'END_OF_PERIOD')]
        : [
            provenProvenance('MONTHLY', 'END_OF_PERIOD'),
            provenProvenance('MONTHLY', 'MONTHLY_AVERAGE'),
          ]
    },
    now: () => new Date('2025-01-15T00:00:00.000Z'),
  })

  const weekly = await service.resolveBySeriesId('generic.weekly')
  const monthly = await service.resolveBySeriesId('generic.monthly')
  const weeklyEop = weekly.capabilities.filter((item) => item.identity.targetSemantics === 'END_OF_PERIOD')
  const monthlyLawful = monthly.capabilities.filter((item) => (
    item.identity.targetSemantics === 'END_OF_PERIOD'
    || item.identity.targetSemantics === 'MONTHLY_AVERAGE'
  ))

  assert.equal(weekly.preparationFailures.END_OF_PERIOD, undefined)
  assert.ok(weeklyEop.every((item) => item.admissionState === 'ADMITTED'))
  assert.ok(weeklyEop.every((item) => item.implementationState === 'SUPPORTED'))
  assert.ok(weeklyEop.every((item) => item.availableObservations === 48))
  assert.deepEqual(monthly.preparationFailures, {})
  assert.ok(monthlyLawful.every((item) => item.admissionState === 'ADMITTED'))
  assert.ok(monthlyLawful.every((item) => item.implementationState === 'SUPPORTED'))
  assert.ok(monthlyLawful.every((item) => item.availableObservations === 48))
})

test('service returns explicit FAILED state when source metadata cannot be resolved', async () => {
  const service = createForecastCapabilityService({
    async resolveHistoricalSeries() {
      throw new Error('source metadata unavailable')
    },
  })

  const resolution = await service.resolveBySeriesId('missing.metadata.series')

  assert.equal(resolution.status, 'FAILED')
  assert.equal(resolution.reason, 'source metadata unavailable')
  assert.equal(resolution.sourceMetadata.providerCode, null)
  assert.equal(resolution.targetedHydration.scope, 'SINGLE_SERIES')
  assert.deepEqual(resolution.capabilities, [])
})