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
} from '../lib/forecast/identity'

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

test('statistical compatibility keeps Current, Recent Verification, and Full Verification distinct', () => {
  const current = createCurrentForecastStatisticalCompatibility()
  const recent = createRecentVerificationStatisticalCompatibility()
  const full = createFullVerificationStatisticalCompatibility()

  assert.equal(new Set([
    `${current.artifactScope}|${current.trainingWindowPolicyId}|${current.calibrationPolicy}`,
    `${recent.artifactScope}|${recent.trainingWindowPolicyId}|${recent.calibrationPolicy}`,
    `${full.artifactScope}|${full.trainingWindowPolicyId}|${full.calibrationPolicy}`,
  ]).size, 3)
  assert.equal(areForecastStatisticalCompatibilitiesEqual(current, current), true)
  assert.equal(areForecastStatisticalCompatibilitiesEqual(current, full), false)
  assert.equal(doesForecastArtifactSatisfyRequest(full, full), true)
  assert.equal(doesForecastArtifactSatisfyRequest(full, recent), false)
})

test('legacy verification mapping stays deterministic while calibration remains conditional', () => {
  const legacyVerification = createLegacyVerificationStatisticalCompatibility()
  const full = createFullVerificationStatisticalCompatibility()

  assert.equal(legacyVerification.artifactScope, 'FULL_VERIFICATION')
  assert.equal(legacyVerification.trainingWindowPolicyId, FULL_VERIFICATION_TRAINING_WINDOW_POLICY_ID)
  assert.equal(legacyVerification.calibrationPolicy, 'CONDITIONAL_POLICY_MATCH_ONLY')
  assert.equal(areForecastStatisticalCompatibilitiesEqual(legacyVerification, full), false)
})

test('legacy statistical compatibility mapping is deterministic by artifact family', () => {
  assert.deepEqual(
    resolveLegacyForecastStatisticalCompatibility('CURRENT'),
    createCurrentForecastStatisticalCompatibility(),
  )
  assert.deepEqual(
    resolveLegacyForecastStatisticalCompatibility('VERIFICATION'),
    createLegacyVerificationStatisticalCompatibility(),
  )
})

test('calibration compatibility is exact-contract based rather than scope-based', () => {
  const currentTarget = {
    artifactScope: 'CURRENT_FORECAST',
    seriesId: 'wocaes0280',
    inputSource: 'POSTGRES_RUNTIME_SNAPSHOT',
    sourceFrequency: 'MONTHLY',
    targetCadence: 'MONTHLY',
    targetSemantics: 'MONTHLY_AVERAGE',
    modelId: 'ets',
    methodId: 'MONTHLY_AVERAGE',
    methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
    trainingWindowPolicyId: 'CURRENT_POLICY_FREQUENCY_SPECIFIC@current-policy-frequency-specific-v1',
    historyFingerprint: 'history-a',
    horizonLabel: '1M',
    forecastOrigin: '2026-04-01T00:00:00.000Z',
    actualObservedAt: null,
    calibrationPolicy: 'EXACT_STATISTICAL_MATCH_ONLY',
  } as const

  const exactRecentResidual = {
    ...currentTarget,
    artifactScope: 'RECENT_VERIFICATION',
  } as const
  const exactFullResidual = {
    ...currentTarget,
    artifactScope: 'FULL_VERIFICATION',
  } as const
  const conditionalLegacyResidual = {
    ...currentTarget,
    artifactScope: 'FULL_VERIFICATION',
    calibrationPolicy: 'CONDITIONAL_POLICY_MATCH_ONLY',
  } as const

  assert.equal(canResidualCalibrateCurrent(exactRecentResidual, currentTarget), true)
  assert.equal(canResidualCalibrateCurrent(exactFullResidual, currentTarget), true)
  assert.equal(canResidualCalibrateCurrent({ ...exactFullResidual, trainingWindowPolicyId: FULL_VERIFICATION_TRAINING_WINDOW_POLICY_ID }, currentTarget), false)
  assert.equal(canResidualCalibrateCurrent({ ...exactFullResidual, targetSemantics: 'END_OF_PERIOD' }, currentTarget), false)
  assert.equal(canResidualCalibrateCurrent({ ...exactFullResidual, modelId: 'arima' }, currentTarget), false)
  assert.equal(canResidualCalibrateCurrent({ ...exactFullResidual, methodVersion: 'benchmark-forecasting-mvp-phase2-v2' }, currentTarget), false)
  assert.equal(canResidualCalibrateCurrent({ ...exactFullResidual, sourceFrequency: 'QUARTERLY' }, currentTarget), false)
  assert.equal(canResidualCalibrateCurrent({ ...exactFullResidual, targetCadence: 'QUARTERLY' }, currentTarget), false)
  assert.equal(canResidualCalibrateCurrent({ ...exactFullResidual, horizonLabel: '3M' }, currentTarget), false)
  assert.equal(canResidualCalibrateCurrent({ ...exactFullResidual, historyFingerprint: 'history-b' }, currentTarget), false)
  assert.equal(canResidualCalibrateCurrent(conditionalLegacyResidual, currentTarget), false)
})

test('Recent to Full reuse is conditional by exact identity rather than scope alone', () => {
  const recent = {
    artifactScope: 'RECENT_VERIFICATION',
    seriesId: 'wocaes0280',
    inputSource: 'POSTGRES_RUNTIME_SNAPSHOT',
    sourceFrequency: 'MONTHLY',
    targetCadence: 'MONTHLY',
    targetSemantics: 'MONTHLY_AVERAGE',
    modelId: 'ets',
    methodId: 'MONTHLY_AVERAGE',
    methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
    trainingWindowPolicyId: 'RECENT_SAME_POLICY_AS_CURRENT@recent-same-policy-as-current-v1',
    historyFingerprint: 'history-a',
    horizonLabel: '1M',
    forecastOrigin: '2025-12-01T00:00:00.000Z',
  } as const
  const full = {
    ...recent,
    artifactScope: 'FULL_VERIFICATION',
    trainingWindowPolicyId: 'RECENT_SAME_POLICY_AS_CURRENT@recent-same-policy-as-current-v1',
  } as const

  assert.equal(isRecentVerificationReusableForFullVerification(recent, full), true)
  assert.equal(isRecentVerificationReusableForFullVerification({ ...recent, trainingWindowPolicyId: FULL_VERIFICATION_TRAINING_WINDOW_POLICY_ID }, full), false)
  assert.equal(isRecentVerificationReusableForFullVerification({ ...recent, modelId: 'arima' }, full), false)
  assert.equal(isRecentVerificationReusableForFullVerification({ ...recent, horizonLabel: '3M' }, full), false)
  assert.equal(isRecentVerificationReusableForFullVerification({ ...recent, historyFingerprint: 'history-b' }, full), false)
})
