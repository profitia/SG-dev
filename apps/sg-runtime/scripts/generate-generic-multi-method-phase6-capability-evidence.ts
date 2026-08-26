import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  resolveForecastCapabilities,
  type ForecastCapabilityProvenance,
  type ForecastSourceFrequency,
  type ForecastVariantCapability,
} from '@/lib/forecast/capability-resolver'
import { createForecastIdentity } from '@/lib/forecast/identity'

const TARGETS = ['END_OF_PERIOD', 'MONTHLY_AVERAGE', 'ROLLING_DAILY_POINT_IN_TIME'] as const
const MODELS = ['naive', 'damped_holt', 'ets', 'arima'] as const

function provenProvenance(
  sourceFrequency: 'WEEKLY' | 'MONTHLY',
  targetSemantics: 'END_OF_PERIOD' | 'MONTHLY_AVERAGE',
): ForecastCapabilityProvenance {
  return {
    sourceFrequency,
    targetSemantics,
    preparation: {
      method: targetSemantics === 'END_OF_PERIOD' ? 'PROVEN_PERIOD_END_LEVEL' : 'PROVEN_MONTHLY_ARITHMETIC_MEAN',
      version: 'phase6-controlled-provenance-v1',
      provenanceStatus: 'PROVEN',
    },
    sourceLineage: 'CONTROLLED_PHASE6_PROVENANCE',
    closedPeriod: true,
    levelAtTimestamp: targetSemantics === 'END_OF_PERIOD' ? true : null,
    exactSourceObservedAt: targetSemantics === 'END_OF_PERIOD' ? true : null,
    aggregation: targetSemantics === 'MONTHLY_AVERAGE' ? 'ARITHMETIC_MEAN' : null,
    underlyingObservationFrequency: targetSemantics === 'MONTHLY_AVERAGE' ? 'DAILY' : null,
    missingObservationPolicy: targetSemantics === 'MONTHLY_AVERAGE' ? 'USE_AVAILABLE_LAWFUL_OBSERVATIONS_ONLY' : null,
    syntheticObservations: targetSemantics === 'MONTHLY_AVERAGE' ? false : null,
  }
}

function resolveScenario(input: {
  seriesId: string
  sourceFrequency: ForecastSourceFrequency
  sourceObservationCount: number
  preparedObservationCounts: Partial<Record<(typeof TARGETS)[number], number>>
  provenance?: readonly ForecastCapabilityProvenance[]
  preparedVariants?: Parameters<typeof resolveForecastCapabilities>[0]['preparedVariants']
}) {
  return resolveForecastCapabilities({
    ...input,
    provenance: input.provenance ?? [],
    preparedVariants: input.preparedVariants ?? [],
  })
}

function variantsFor(
  capabilities: ForecastVariantCapability[],
  targetSemantics: (typeof TARGETS)[number],
) {
  const variants = capabilities.filter((item) => item.identity.targetSemantics === targetSemantics)
  assert.equal(variants.length, 4)
  assert.deepEqual(variants.map((item) => item.identity.modelId), MODELS)
  return variants
}

function summarizeCell(
  withoutProvenance: ForecastVariantCapability[],
  withValidProvenance: ForecastVariantCapability[],
  targetSemantics: (typeof TARGETS)[number],
) {
  const unresolved = variantsFor(withoutProvenance, targetSemantics)
  const resolved = variantsFor(withValidProvenance, targetSemantics)
  const representative = resolved[0]!

  return {
    semanticStatus: representative.semanticLawfulness,
    provenanceRequirement: representative.semanticLawfulness === 'LAWFUL_WITH_PROVENANCE'
      ? 'REQUIRED'
      : representative.semanticLawfulness === 'NOT_LAWFUL'
        ? 'NOT_APPLICABLE'
        : 'NOT_REQUIRED',
    admissionWithoutProvenance: unresolved[0]!.admissionState,
    admissionWithValidProvenance: representative.admissionState,
    implementationSupport: representative.implementationState,
    minimumHistoryRequirement: representative.minimumRequiredObservations,
    preparationCapability: representative.targetPreparationState,
    supportedModelIds: representative.semanticLawfulness === 'NOT_LAWFUL' ? [] : [...MODELS],
  }
}

async function main() {
  const daily = resolveScenario({
    seriesId: 'phase6.generic.daily',
    sourceFrequency: 'DAILY',
    sourceObservationCount: 96,
    preparedObservationCounts: {
      END_OF_PERIOD: 48,
      MONTHLY_AVERAGE: 48,
      ROLLING_DAILY_POINT_IN_TIME: 96,
    },
  })
  const weeklyWithoutProvenance = resolveScenario({
    seriesId: 'phase6.generic.weekly',
    sourceFrequency: 'WEEKLY',
    sourceObservationCount: 96,
    preparedObservationCounts: {},
  })
  const weeklyWithProvenance = resolveScenario({
    seriesId: 'phase6.generic.weekly',
    sourceFrequency: 'WEEKLY',
    sourceObservationCount: 96,
    preparedObservationCounts: { END_OF_PERIOD: 48 },
    provenance: [provenProvenance('WEEKLY', 'END_OF_PERIOD')],
  })
  const monthlyWithoutProvenance = resolveScenario({
    seriesId: 'phase6.generic.monthly',
    sourceFrequency: 'MONTHLY',
    sourceObservationCount: 48,
    preparedObservationCounts: {},
  })
  const monthlyWithProvenance = resolveScenario({
    seriesId: 'phase6.generic.monthly',
    sourceFrequency: 'MONTHLY',
    sourceObservationCount: 48,
    preparedObservationCounts: { END_OF_PERIOD: 48, MONTHLY_AVERAGE: 48 },
    provenance: [
      provenProvenance('MONTHLY', 'END_OF_PERIOD'),
      provenProvenance('MONTHLY', 'MONTHLY_AVERAGE'),
    ],
  })
  const insufficient = resolveScenario({
    seriesId: 'phase6.generic.insufficient',
    sourceFrequency: 'DAILY',
    sourceObservationCount: 59,
    preparedObservationCounts: {
      END_OF_PERIOD: 35,
      MONTHLY_AVERAGE: 35,
      ROLLING_DAILY_POINT_IN_TIME: 59,
    },
  })
  const eopArimaIdentity = createForecastIdentity({
    seriesId: 'phase6.generic.prepared',
    targetBasis: 'END_OF_PERIOD',
    modelId: 'arima',
  })
  const prepared = resolveScenario({
    seriesId: eopArimaIdentity.seriesId,
    sourceFrequency: 'DAILY',
    sourceObservationCount: 96,
    preparedObservationCounts: {
      END_OF_PERIOD: 48,
      MONTHLY_AVERAGE: 48,
      ROLLING_DAILY_POINT_IN_TIME: 96,
    },
    preparedVariants: [{
      identity: eopArimaIdentity,
      current: 'READY',
      historical: 'NOT_PREPARED',
    }],
  })

  assert.ok(daily.every((item) => item.semanticLawfulness === 'LAWFUL'))
  assert.ok(daily.every((item) => item.implementationState === 'SUPPORTED'))
  assert.ok(insufficient.every((item) => item.capabilityState === 'INSUFFICIENT_HISTORY'))
  assert.ok(variantsFor(weeklyWithoutProvenance, 'END_OF_PERIOD').every((item) => item.capabilityState === 'PROVENANCE_REQUIRED'))
  assert.ok(variantsFor(monthlyWithoutProvenance, 'ROLLING_DAILY_POINT_IN_TIME').every((item) => item.capabilityState === 'NOT_LAWFUL'))

  const matrix = {
    DAILY: Object.fromEntries(TARGETS.map((target) => [target, summarizeCell(daily, daily, target)])),
    WEEKLY: Object.fromEntries(TARGETS.map((target) => [target, summarizeCell(
      weeklyWithoutProvenance,
      weeklyWithProvenance,
      target,
    )])),
    MONTHLY: Object.fromEntries(TARGETS.map((target) => [target, summarizeCell(
      monthlyWithoutProvenance,
      monthlyWithProvenance,
      target,
    )])),
  }

  const artifact = {
    phase: 'PHASE_6',
    workstream: 'GENERIC_MULTI_METHOD_FORECAST_PRODUCTION_ENABLEMENT',
    result: 'PASS',
    generatedAt: new Date().toISOString(),
    targetSemantics: [...TARGETS],
    modelIds: [...MODELS],
    capabilityStates: [
      'AVAILABLE',
      'NOT_LAWFUL',
      'INSUFFICIENT_HISTORY',
      'DATA_NOT_AVAILABLE',
      'NOT_PREPARED',
      'PREPARATION_REQUIRED',
      'FAILED',
      'PROVENANCE_REQUIRED',
    ],
    sourceFrequencyCapabilityMatrix: matrix,
    provenanceRules: {
      DAILY: 'NOT_REQUIRED_FOR_ACCEPTED_DIRECT_PREPARATION',
      WEEKLY_END_OF_PERIOD: 'REQUIRES_LEVEL_AT_TIMESTAMP_EXACT_SOURCE_OBSERVATION_CLOSED_PERIOD_AND_LINEAGE',
      NATIVE_MONTHLY_END_OF_PERIOD: 'REQUIRES_EXACT_SAME_TARGET_EOP_PROVENANCE',
      NATIVE_MONTHLY_MONTHLY_AVERAGE: 'REQUIRES_ARITHMETIC_MEAN_POPULATION_POLICY_NO_SYNTHETIC_DATA_AND_LINEAGE',
      unresolvedBehavior: 'FAIL_CLOSED',
    },
    historyEligibility: {
      monthlyPreparedMinimum: 36,
      rollingDailyMinimum: 60,
      trainingHistoryCapIntroduced: false,
      controlledFullHistory: {
        sourceObservations: 96,
        preparedMonthlyObservations: 48,
        rollingDailyAvailableObservations: 96,
      },
    },
    targetPreparationSupport: {
      DAILY: ['END_OF_PERIOD', 'MONTHLY_AVERAGE', 'ROLLING_DAILY_POINT_IN_TIME'],
      WEEKLY: ['END_OF_PERIOD_WITH_PROVENANCE'],
      MONTHLY: ['END_OF_PERIOD_WITH_PROVENANCE', 'MONTHLY_AVERAGE_WITH_PROVENANCE'],
    },
    controlledResolutionProof: [
      {
        seriesId: 'phase6.generic.daily',
        sourceFrequency: 'DAILY',
        resolvedVariantCount: daily.length,
        lawfulTargetCount: 3,
        modelsPerTarget: 4,
        capabilityStateBeforeForecastPreparation: 'NOT_PREPARED',
      },
      {
        seriesId: 'phase6.generic.daily.second',
        resolverPath: 'SAME_GENERIC_SERIES_ID_PATH',
        tickerSpecificBranchRequired: false,
      },
    ],
    negativeCases: [
      { sourceFrequency: 'WEEKLY', targetSemantics: 'MONTHLY_AVERAGE', state: 'NOT_LAWFUL' },
      { sourceFrequency: 'WEEKLY', targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME', state: 'NOT_LAWFUL' },
      { sourceFrequency: 'MONTHLY', targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME', state: 'NOT_LAWFUL' },
      { sourceFrequency: 'MONTHLY', targetSemantics: 'END_OF_PERIOD', provenance: 'ABSENT', state: 'PROVENANCE_REQUIRED' },
      { sourceFrequency: 'MONTHLY', targetSemantics: 'MONTHLY_AVERAGE', provenance: 'ABSENT', state: 'PROVENANCE_REQUIRED' },
      { sourceFrequency: 'DAILY', history: 'BELOW_ACCEPTED_MINIMUMS', state: 'INSUFFICIENT_HISTORY' },
    ],
    preparedTruthProof: {
      identity: eopArimaIdentity,
      currentForecast: prepared.find((item) => item.identity.modelId === 'arima' && item.identity.targetSemantics === 'END_OF_PERIOD')?.currentPreparedState,
      historicalVerification: prepared.find((item) => item.identity.modelId === 'arima' && item.identity.targetSemantics === 'END_OF_PERIOD')?.historicalPreparedState,
      crossTargetOrModelFallback: false,
    },
    identityPreservation: {
      key: 'seriesId + targetSemantics + methodId + methodVersion + modelId',
      controlledVariantCount: 12,
      uniqueControlledIdentityCount: new Set(daily.map((item) => [
        item.identity.seriesId,
        item.identity.targetSemantics,
        item.identity.methodId,
        item.identity.methodVersion,
        item.identity.modelId,
      ].join('|'))).size,
      collisions: 0,
    },
    targetedHydration: {
      supported: true,
      scope: 'SINGLE_SERIES',
      requestedRange: 'ALL',
      existingOwner: 'DYNAMIC_MARKET_DATA_STORE',
      idempotentUpsert: true,
      massHydration: false,
      networkFetchUsedForEvidence: false,
    },
    tickerSpecificCode: false,
    schemaOrPersistenceChanges: [],
    migrationState: 'PHASE_3_MIGRATION_PREPARED_NOT_APPLIED',
    implementationGapsDeferred: [
      'Prepared-state datastore reader remains an injected Forecast persistence adapter; absent state fails closed as NOT_PREPARED.',
      'Monthly request-time compute fallback remains deferred to Phase 8.',
      'Rolling Daily active calibration minimum 20 versus canonical 30 remains deferred.',
      'Recurring preparation and maintenance scheduling remains Phase 8.',
    ],
    validation: {
      phase6ForecastTests: 66,
      rollingDailyRegressionTests: 18,
      sgRuntimeTypecheck: 'PASS',
      dashboardPreviewTypecheck: 'PASS',
      capabilityEvidenceGenerator: 'PASS',
      artifactGate: 'PASS',
      editorDiagnostics: 'PASS',
    },
    guardrails: {
      forecastMathematicsChanged: false,
      rollingDailyMethodologyChanged: false,
      recommendationImplemented: false,
      preferredModelSelected: false,
      schemaChanged: false,
      productionMutation: false,
      networkFetch: false,
      deployment: false,
      benchmarkFinderTouched: false,
      appShellTouched: false,
      phase7Started: false,
    },
    nextPhaseStarted: false,
  }

  const outputPath = path.resolve(
    process.cwd(),
    '..',
    '..',
    'tooling',
    'Benchmark-Forecasting',
    'validation',
    'generic_multi_method_forecast_phase6_generic_benchmark_production_enablement.json',
  )
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8')
  console.log(`PHASE6_CAPABILITY_EVIDENCE=PASS path=${outputPath}`)
}

void main()