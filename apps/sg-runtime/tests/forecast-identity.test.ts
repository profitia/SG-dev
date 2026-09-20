import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  areForecastStatisticalCompatibilitiesEqual,
  buildForecastArtifactCadenceIdentity,
  buildForecastArtifactIdentityKey,
  buildForecastIdentityKey,
  canResidualCalibrateCurrent,
  createCurrentForecastStatisticalCompatibility,
  createFullVerificationStatisticalCompatibility,
  createLegacyFrequencySpecificCurrentForecastStatisticalCompatibility,
  createLegacyUnresolvedForecastStatisticalCompatibility,
  createLegacyVerificationStatisticalCompatibility,
  createRecentVerificationStatisticalCompatibility,
  createForecastIdentity,
  doesForecastArtifactSatisfyRequest,
  FORECAST_ARTIFACT_CADENCE_IDENTITY_VERSION,
  FULL_VERIFICATION_TRAINING_WINDOW_POLICY_ID,
  isRecentVerificationReusableForFullVerification,
  LEGACY_UNRESOLVED_FORECAST_METHOD_ID,
  parseForecastArtifactCadenceIdentity,
  resolveForecastMethodContract,
  resolveLegacyForecastStatisticalCompatibility,
  type ForecastVerificationReuseIdentity,
} from '../lib/forecast/identity'
import {
  PERIOD_VERIFICATION_CONFIGURATION_ID,
  ROLLING_DAILY_VERIFICATION_CONFIGURATION_ID,
  resolveVerificationConfigurationId,
} from '../lib/forecast/verification-single-flight'
import { ADAPTIVE_HISTORICAL_VERIFICATION_ORIGIN_POLICY_VERSION } from '../lib/forecast/historical-verification-origin-policy'

const MONTHLY_AVERAGE_POLICY_CONTEXT = {
  sourceFrequency: 'MONTHLY',
  targetCadence: 'MONTHLY',
  targetSemantics: 'MONTHLY_AVERAGE',
} as const

const DAILY_POINT_IN_TIME_POLICY_CONTEXT = {
  sourceFrequency: 'DAILY',
  targetCadence: 'DAILY',
  targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
} as const

const QUARTERLY_END_OF_PERIOD_POLICY_CONTEXT = {
  sourceFrequency: 'QUARTERLY',
  targetCadence: 'QUARTERLY',
  targetSemantics: 'END_OF_PERIOD',
} as const

test('generic identity keeps target semantics separate for the same series and model', () => {
  const identities = [
    createForecastIdentity({ seriesId: 'wocaes0074', targetBasis: 'END_OF_PERIOD', modelId: 'arima' }),
    createForecastIdentity({ seriesId: 'wocaes0074', targetBasis: 'MONTHLY_AVERAGE', modelId: 'arima' }),
    createForecastIdentity({ seriesId: 'wocaes0074', targetBasis: 'POINT_IN_TIME', modelId: 'arima' }),
  ]

  assert.equal(new Set(identities.map(buildForecastIdentityKey)).size, 3)
  assert.deepEqual(identities.map((identity) => identity.targetSemantics), [
    'END_OF_PERIOD',
    'MONTHLY_AVERAGE',
    'ROLLING_DAILY_POINT_IN_TIME',
  ])
})

test('generic identity keeps all four models separate inside one target semantics', () => {
  const modelIds = ['naive', 'damped_holt', 'ets', 'arima'] as const
  const keys = modelIds.map((modelId) => buildForecastIdentityKey(createForecastIdentity({
    seriesId: 'wocaes0074',
    targetBasis: 'END_OF_PERIOD',
    modelId,
  })))

  assert.equal(new Set(keys).size, 4)
})

test('generic identity keeps different method versions separate', () => {
  const current = createForecastIdentity({
    seriesId: 'wocaes0074',
    targetBasis: 'MONTHLY_AVERAGE',
    modelId: 'ets',
  })
  const future = createForecastIdentity({
    seriesId: 'wocaes0074',
    targetBasis: 'MONTHLY_AVERAGE',
    modelId: 'ets',
    methodVersion: 'benchmark-forecasting-mvp-phase2-v2',
  })

  assert.notEqual(buildForecastIdentityKey(current), buildForecastIdentityKey(future))
})

test('artifact identity keeps source frequency and target cadence independently collision-safe', () => {
  const forecastIdentity = createForecastIdentity({
    seriesId: 'generic.series',
    targetBasis: 'MONTHLY_AVERAGE',
    modelId: 'ets',
  })
  const monthlySource = buildForecastArtifactIdentityKey({
    ...forecastIdentity,
    sourceFrequency: 'MONTHLY',
    targetCadence: 'QUARTERLY',
  })
  const quarterlySource = buildForecastArtifactIdentityKey({
    ...forecastIdentity,
    sourceFrequency: 'QUARTERLY',
    targetCadence: 'QUARTERLY',
  })
  const semiannualTarget = buildForecastArtifactIdentityKey({
    ...forecastIdentity,
    sourceFrequency: 'QUARTERLY',
    targetCadence: 'SEMIANNUAL',
  })

  assert.equal(new Set([monthlySource, quarterlySource, semiannualTarget]).size, 3)
})

test('versioned cadence serialization is deterministic, parseable, and separate from legacy Monthly', () => {
  const cadence = { sourceFrequency: 'QUARTERLY', targetCadence: 'SEMIANNUAL' } as const
  const serialized = buildForecastArtifactCadenceIdentity(cadence)

  assert.equal(serialized, `${FORECAST_ARTIFACT_CADENCE_IDENTITY_VERSION}|source=QUARTERLY|target=SEMIANNUAL`)
  assert.deepEqual(parseForecastArtifactCadenceIdentity(serialized), {
    identityVersion: FORECAST_ARTIFACT_CADENCE_IDENTITY_VERSION,
    sourceFrequency: 'QUARTERLY',
    targetCadence: 'SEMIANNUAL',
    legacyMonthly: false,
  })
  assert.deepEqual(parseForecastArtifactCadenceIdentity('MONTHLY'), {
    identityVersion: 'LEGACY_MONTHLY',
    sourceFrequency: null,
    targetCadence: 'MONTHLY',
    legacyMonthly: true,
  })
  assert.notEqual(serialized, 'MONTHLY')
  assert.equal(parseForecastArtifactCadenceIdentity('QUARTERLY'), null)
})

test('method identity stays separate from model identity and preserves Rolling Daily canon', () => {
  const rollingDaily = resolveForecastMethodContract('POINT_IN_TIME')

  assert.equal(rollingDaily.targetSemantics, 'ROLLING_DAILY_POINT_IN_TIME')
  assert.equal(rollingDaily.methodId, 'ROLLING_DAILY_POINT_IN_TIME')
  assert.equal(rollingDaily.methodVersion, 'rolling-daily-point-in-time-v1')
  assert.notEqual(rollingDaily.methodId, 'arima')
})

test('migration keeps pre-canonical monthly rows explicitly unresolved instead of guessing Monthly Average', () => {
  const migration = readFileSync(
    new URL('../prisma-market-data/migrations/20260822190000_generic_forecast_method_identity/migration.sql', import.meta.url),
    'utf8',
  )

  assert.equal(LEGACY_UNRESOLVED_FORECAST_METHOD_ID, 'LEGACY_UNRESOLVED')
  assert.match(migration, /DEFAULT 'LEGACY_UNRESOLVED'/)
  assert.match(migration, /ALTER COLUMN "methodId" DROP DEFAULT/)
  assert.match(migration, /"targetBasis", "methodId", "modelId", "methodVersion"/)
    assert.equal(migration.includes('UPDATE'), false)
})

test('persisted forecast run identity includes cadence frequency in schema and migration', () => {
  const schema = readFileSync(
    new URL('../prisma-market-data/schema.prisma', import.meta.url),
    'utf8',
  )
  const migration = readFileSync(
    new URL('../prisma-market-data/migrations/20260918203500_forecast_artifact_frequency_identity/migration.sql', import.meta.url),
    'utf8',
  )
  const exactIdentity = /methodVersion, frequency, trainingWindowPolicyId, effectiveTrainingPolicyId/

  assert.equal(schema.match(exactIdentity)?.length, 1)
  assert.equal((schema.match(new RegExp(exactIdentity.source, 'g')) ?? []).length, 2)
  assert.match(migration, /CREATE UNIQUE INDEX "forecast_current_runs_identity_key"[\s\S]*"methodVersion",\s*"frequency",\s*"trainingWindowPolicyId"/)
  assert.match(migration, /CREATE UNIQUE INDEX "forecast_verification_runs_identity_key"[\s\S]*"methodVersion",\s*"frequency",\s*"trainingWindowPolicyId"/)
})

test('statistical compatibility keeps Current, Recent Verification, and Full Verification distinct', () => {
  const current = createCurrentForecastStatisticalCompatibility(MONTHLY_AVERAGE_POLICY_CONTEXT)
  const recent = createRecentVerificationStatisticalCompatibility(MONTHLY_AVERAGE_POLICY_CONTEXT)
  const full = createFullVerificationStatisticalCompatibility(MONTHLY_AVERAGE_POLICY_CONTEXT)

  assert.equal(new Set([
    `${current.artifactScope}|${current.trainingWindowPolicyId}|${current.calibrationPolicy}`,
    `${recent.artifactScope}|${recent.trainingWindowPolicyId}|${recent.calibrationPolicy}`,
    `${full.artifactScope}|${full.trainingWindowPolicyId}|${full.calibrationPolicy}`,
  ]).size, 3)
  assert.equal(current.effectiveTrainingPolicyId, recent.effectiveTrainingPolicyId)
  assert.notEqual(current.effectiveTrainingPolicyId, full.effectiveTrainingPolicyId)
  assert.equal(current.effectiveTrainingPolicyId.includes('periodPolicy=ADAPTIVE_SHORT_HISTORY_V1'), true)
  assert.equal(full.effectiveTrainingPolicyId.includes('periodPolicy=ADAPTIVE_SHORT_HISTORY_V1'), true)
  assert.equal(full.effectiveTrainingPolicyId.includes(`originPolicy=${ADAPTIVE_HISTORICAL_VERIFICATION_ORIGIN_POLICY_VERSION}`), true)
  assert.equal(areForecastStatisticalCompatibilitiesEqual(current, current), true)
  assert.equal(areForecastStatisticalCompatibilitiesEqual(current, full), false)
  assert.equal(doesForecastArtifactSatisfyRequest(full, full), true)
  assert.equal(doesForecastArtifactSatisfyRequest(full, recent), false)
})

test('adaptive Full Verification origin policy changes period identity without invalidating Rolling Daily identity', () => {
  const period = createFullVerificationStatisticalCompatibility(MONTHLY_AVERAGE_POLICY_CONTEXT)
  const rollingDaily = createFullVerificationStatisticalCompatibility(DAILY_POINT_IN_TIME_POLICY_CONTEXT)

  assert.equal(period.effectiveTrainingPolicyId.includes('originPolicy=ADAPTIVE_PREFERRED_2024_MINIMUM_24'), true)
  assert.equal(rollingDaily.effectiveTrainingPolicyId.includes('originPolicy='), false)
  assert.equal(rollingDaily.trainingWindowPolicyId, FULL_VERIFICATION_TRAINING_WINDOW_POLICY_ID)
})

test('adaptive short-history policy version separates legacy and current exact identities', () => {
  const legacyCurrent = createLegacyFrequencySpecificCurrentForecastStatisticalCompatibility(MONTHLY_AVERAGE_POLICY_CONTEXT)
  const adaptiveCurrent = createCurrentForecastStatisticalCompatibility(MONTHLY_AVERAGE_POLICY_CONTEXT)

  assert.notEqual(legacyCurrent.effectiveTrainingPolicyId, adaptiveCurrent.effectiveTrainingPolicyId)
  assert.equal(doesForecastArtifactSatisfyRequest(legacyCurrent, adaptiveCurrent), false)
  assert.equal(doesForecastArtifactSatisfyRequest(adaptiveCurrent, legacyCurrent), false)
})

test('period verification configuration is versioned by adaptive short-history policy and metric minimum', () => {
  assert.equal(
    PERIOD_VERIFICATION_CONFIGURATION_ID,
    JSON.stringify({ periodTrainingPolicyVersion: 'ADAPTIVE_SHORT_HISTORY_V1', maseScaleMinimumObservations: 2 }),
  )
  assert.equal(resolveVerificationConfigurationId('MONTHLY_AVERAGE'), PERIOD_VERIFICATION_CONFIGURATION_ID)
  assert.equal(resolveVerificationConfigurationId('END_OF_PERIOD'), PERIOD_VERIFICATION_CONFIGURATION_ID)
})

test('rolling daily verification configuration preserves the legacy exact identity', () => {
  assert.equal(ROLLING_DAILY_VERIFICATION_CONFIGURATION_ID, JSON.stringify({ minTrainingWindow: 36 }))
  assert.equal(resolveVerificationConfigurationId('ROLLING_DAILY_POINT_IN_TIME'), ROLLING_DAILY_VERIFICATION_CONFIGURATION_ID)
})

test('period and rolling-daily verification configurations remain exact-match isolated', () => {
  assert.notEqual(PERIOD_VERIFICATION_CONFIGURATION_ID, ROLLING_DAILY_VERIFICATION_CONFIGURATION_ID)
})

test('legacy verification mapping stays deterministic while calibration remains conditional', () => {
  const legacyVerification = createLegacyVerificationStatisticalCompatibility(MONTHLY_AVERAGE_POLICY_CONTEXT)

  assert.equal(legacyVerification.artifactScope, 'FULL_VERIFICATION')
  assert.equal(legacyVerification.trainingWindowPolicyId, 'LEGACY_UNRESOLVED')
  assert.equal(legacyVerification.calibrationPolicy, 'CONDITIONAL_POLICY_MATCH_ONLY')
  assert.equal(legacyVerification.effectiveTrainingPolicyId.includes('LEGACY_UNRESOLVED@'), true)
})

test('legacy current mapping stays explicit and unresolved instead of being reconstructed as exact current policy', () => {
  const legacyCurrent = createLegacyUnresolvedForecastStatisticalCompatibility('CURRENT', MONTHLY_AVERAGE_POLICY_CONTEXT)
  const exactCurrent = createCurrentForecastStatisticalCompatibility(MONTHLY_AVERAGE_POLICY_CONTEXT)

  assert.equal(legacyCurrent.artifactScope, 'CURRENT_FORECAST')
  assert.equal(legacyCurrent.trainingWindowPolicyId, 'LEGACY_UNRESOLVED')
  assert.equal(legacyCurrent.calibrationPolicy, 'CONDITIONAL_POLICY_MATCH_ONLY')
  assert.equal(areForecastStatisticalCompatibilitiesEqual(legacyCurrent, exactCurrent), false)
})

test('legacy statistical compatibility mapping is deterministic by artifact family', () => {
  assert.deepEqual(
    resolveLegacyForecastStatisticalCompatibility('CURRENT', MONTHLY_AVERAGE_POLICY_CONTEXT),
    createLegacyUnresolvedForecastStatisticalCompatibility('CURRENT', MONTHLY_AVERAGE_POLICY_CONTEXT),
  )
  assert.deepEqual(
    resolveLegacyForecastStatisticalCompatibility('VERIFICATION', MONTHLY_AVERAGE_POLICY_CONTEXT),
    createLegacyUnresolvedForecastStatisticalCompatibility('VERIFICATION', MONTHLY_AVERAGE_POLICY_CONTEXT),
  )
})

test('calibration compatibility is exact-contract based rather than scope-based', () => {
  const currentCompatibility = createCurrentForecastStatisticalCompatibility(MONTHLY_AVERAGE_POLICY_CONTEXT)
  const recentCompatibility = createRecentVerificationStatisticalCompatibility(MONTHLY_AVERAGE_POLICY_CONTEXT)
  const fullCompatibility = createFullVerificationStatisticalCompatibility(MONTHLY_AVERAGE_POLICY_CONTEXT)

  const currentTarget = {
    artifactScope: currentCompatibility.artifactScope,
    seriesId: 'wocaes0280',
    sourceSeriesId: 'wocaes0280',
    inputSource: 'POSTGRES_RUNTIME_SNAPSHOT',
    sourceFrequency: 'MONTHLY',
    targetCadence: 'MONTHLY',
    targetSemantics: 'MONTHLY_AVERAGE',
    modelId: 'ets',
    methodId: 'MONTHLY_AVERAGE',
    methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
    trainingWindowPolicyId: currentCompatibility.trainingWindowPolicyId,
    effectiveTrainingPolicyId: currentCompatibility.effectiveTrainingPolicyId,
    historyFingerprint: 'history-live',
    horizonLabel: '1M',
    forecastOrigin: '2026-04-01T00:00:00.000Z',
    actualObservedAt: null,
    calibrationPolicy: currentCompatibility.calibrationPolicy,
  } as const

  const exactRecentResidual = {
    ...currentTarget,
    artifactScope: recentCompatibility.artifactScope,
    trainingWindowPolicyId: recentCompatibility.trainingWindowPolicyId,
    effectiveTrainingPolicyId: recentCompatibility.effectiveTrainingPolicyId,
    historyFingerprint: 'history-live',
    forecastOrigin: '2026-04-01T00:00:00.000Z',
    actualObservedAt: '2026-04-30T00:00:00.000Z',
  } as const
  const exactFullResidual = {
    ...currentTarget,
    artifactScope: fullCompatibility.artifactScope,
    trainingWindowPolicyId: fullCompatibility.trainingWindowPolicyId,
    effectiveTrainingPolicyId: fullCompatibility.effectiveTrainingPolicyId,
    historyFingerprint: 'history-live',
    forecastOrigin: '2026-04-01T00:00:00.000Z',
    actualObservedAt: '2026-04-30T00:00:00.000Z',
  } as const
  const conditionalLegacyResidual = {
    ...currentTarget,
    artifactScope: 'FULL_VERIFICATION',
    calibrationPolicy: 'CONDITIONAL_POLICY_MATCH_ONLY',
    actualObservedAt: '2026-04-30T00:00:00.000Z',
  } as const

  assert.equal(canResidualCalibrateCurrent(exactRecentResidual, currentTarget), true)
  assert.equal(canResidualCalibrateCurrent(exactFullResidual, currentTarget), false)
  assert.equal(canResidualCalibrateCurrent({ ...exactFullResidual, targetSemantics: 'END_OF_PERIOD' }, currentTarget), false)
  assert.equal(canResidualCalibrateCurrent({ ...exactFullResidual, modelId: 'arima' }, currentTarget), false)
  assert.equal(canResidualCalibrateCurrent({ ...exactFullResidual, methodId: 'END_OF_PERIOD' }, currentTarget), false)
  assert.equal(canResidualCalibrateCurrent({ ...exactFullResidual, methodVersion: 'benchmark-forecasting-mvp-phase2-v2' }, currentTarget), false)
  assert.equal(canResidualCalibrateCurrent({ ...exactFullResidual, sourceFrequency: 'QUARTERLY' }, currentTarget), false)
  assert.equal(canResidualCalibrateCurrent({ ...exactFullResidual, targetCadence: 'QUARTERLY' }, currentTarget), false)
  assert.equal(canResidualCalibrateCurrent({ ...exactFullResidual, horizonLabel: '3M' }, currentTarget), false)
  assert.equal(canResidualCalibrateCurrent({ ...exactRecentResidual, sourceSeriesId: 'other-series' }, currentTarget), false)
  assert.equal(canResidualCalibrateCurrent({ ...exactRecentResidual, actualObservedAt: null }, currentTarget), false)
  assert.equal(canResidualCalibrateCurrent(conditionalLegacyResidual, currentTarget), false)
})

test('Recent to Full reuse remains conditional by effective statistical identity', () => {
  const recentCompatibility = createRecentVerificationStatisticalCompatibility(MONTHLY_AVERAGE_POLICY_CONTEXT)
  const fullCompatibility = createFullVerificationStatisticalCompatibility(MONTHLY_AVERAGE_POLICY_CONTEXT)

  const recent: ForecastVerificationReuseIdentity = {
    artifactScope: 'RECENT_VERIFICATION',
    seriesId: 'wocaes0280',
    sourceSeriesId: 'wocaes0280',
    inputSource: 'POSTGRES_RUNTIME_SNAPSHOT',
    sourceFrequency: 'MONTHLY',
    targetCadence: 'MONTHLY',
    targetSemantics: 'MONTHLY_AVERAGE',
    modelId: 'ets',
    methodId: 'MONTHLY_AVERAGE',
    methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
    trainingWindowPolicyId: recentCompatibility.trainingWindowPolicyId,
    effectiveTrainingPolicyId: recentCompatibility.effectiveTrainingPolicyId,
    historyFingerprint: 'history-a',
    horizonLabel: '1M',
    forecastOrigin: '2025-12-01T00:00:00.000Z',
  }
  const full: ForecastVerificationReuseIdentity = {
    ...recent,
    artifactScope: 'FULL_VERIFICATION',
    trainingWindowPolicyId: fullCompatibility.trainingWindowPolicyId,
    effectiveTrainingPolicyId: fullCompatibility.effectiveTrainingPolicyId,
  }

  assert.equal(isRecentVerificationReusableForFullVerification(recent, full), false)
  assert.equal(isRecentVerificationReusableForFullVerification({ ...recent, modelId: 'arima' }, full), false)
  assert.equal(isRecentVerificationReusableForFullVerification({ ...recent, horizonLabel: '3M' }, full), false)
  assert.equal(isRecentVerificationReusableForFullVerification({ ...recent, historyFingerprint: 'history-b' }, full), false)
})

test('effective training policy identity stays frequency-specific across repository methodologies', () => {
  const monthlyCurrent = createCurrentForecastStatisticalCompatibility(MONTHLY_AVERAGE_POLICY_CONTEXT)
  const monthlyRecent = createRecentVerificationStatisticalCompatibility(MONTHLY_AVERAGE_POLICY_CONTEXT)
  const monthlyFull = createFullVerificationStatisticalCompatibility(MONTHLY_AVERAGE_POLICY_CONTEXT)
  const dailyCurrent = createCurrentForecastStatisticalCompatibility(DAILY_POINT_IN_TIME_POLICY_CONTEXT)
  const quarterlyCurrent = createCurrentForecastStatisticalCompatibility(QUARTERLY_END_OF_PERIOD_POLICY_CONTEXT)

  assert.equal(monthlyCurrent.effectiveTrainingPolicyId, monthlyRecent.effectiveTrainingPolicyId)
  assert.notEqual(monthlyCurrent.effectiveTrainingPolicyId, monthlyFull.effectiveTrainingPolicyId)
  assert.notEqual(monthlyCurrent.effectiveTrainingPolicyId, dailyCurrent.effectiveTrainingPolicyId)
  assert.notEqual(monthlyCurrent.effectiveTrainingPolicyId, quarterlyCurrent.effectiveTrainingPolicyId)
})
