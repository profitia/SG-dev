import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  areForecastStatisticalCompatibilitiesEqual,
  buildForecastArtifactCadenceIdentity,
  buildForecastArtifactIdentityKey,
  buildForecastIdentityKey,
  createCurrentForecastStatisticalCompatibility,
  createFullVerificationStatisticalCompatibility,
  createRecentVerificationStatisticalCompatibility,
  createForecastIdentity,
  doesForecastArtifactSatisfyRequest,
  FORECAST_ARTIFACT_CADENCE_IDENTITY_VERSION,
  FULL_VERIFICATION_TRAINING_WINDOW_POLICY_ID,
  isForecastStatisticalCompatibilityCalibrationEligible,
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
    `${current.artifactScope}|${current.trainingWindowPolicyId}|${current.calibrationEligible}`,
    `${recent.artifactScope}|${recent.trainingWindowPolicyId}|${recent.calibrationEligible}`,
    `${full.artifactScope}|${full.trainingWindowPolicyId}|${full.calibrationEligible}`,
  ]).size, 3)
  assert.equal(areForecastStatisticalCompatibilitiesEqual(current, current), true)
  assert.equal(areForecastStatisticalCompatibilitiesEqual(current, full), false)
  assert.equal(doesForecastArtifactSatisfyRequest(full, full), true)
  assert.equal(doesForecastArtifactSatisfyRequest(full, recent), false)
})

test('statistical compatibility encodes Full-only calibration and fail-closed Recent to Full reuse', () => {
  const recent = createRecentVerificationStatisticalCompatibility()
  const full = createFullVerificationStatisticalCompatibility()

  assert.equal(isForecastStatisticalCompatibilityCalibrationEligible(recent), false)
  assert.equal(isForecastStatisticalCompatibilityCalibrationEligible(full), true)
  assert.equal(isRecentVerificationReusableForFullVerification(recent), false)
  assert.equal(isRecentVerificationReusableForFullVerification(full), true)
  assert.equal(full.trainingWindowPolicyId, FULL_VERIFICATION_TRAINING_WINDOW_POLICY_ID)
})

test('legacy statistical compatibility mapping is deterministic by artifact family', () => {
  assert.deepEqual(
    resolveLegacyForecastStatisticalCompatibility('CURRENT'),
    createCurrentForecastStatisticalCompatibility(),
  )
  assert.deepEqual(
    resolveLegacyForecastStatisticalCompatibility('VERIFICATION'),
    createFullVerificationStatisticalCompatibility(),
  )
})
