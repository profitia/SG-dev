import assert from 'node:assert/strict'
import test from 'node:test'

import {
  classifyDominantBottleneck,
  evaluateRecentBudgetCandidates,
  FINAL_PROFILE_COLD_SAMPLES,
  FINAL_PROFILE_RECENT_CANDIDATES,
  FINAL_PROFILE_WARM_SAMPLES,
  NOT_SEPARATELY_MEASURABLE,
  NOT_STATISTICALLY_MEANINGFUL,
  resolveConcurrentGlobalComputeGate,
  resolveConservativeLatencyMs,
  resolveEvidenceBasedServingHeadroom,
  resolveFastReadyProfilerGate,
  resolveGlobalNFastDecision,
  resolveProfilerConfigurationContract,
  resolveRollingDailyExactReadGate,
  resolveStage6FinalDecision,
  resolveWarmReuseGate,
  summarizeNumericSamples,
  summarizeOptionalPhaseSamples,
  validateProfileEnvironmentMetadata,
} from '../lib/forecast/fast-ready-profiler'
import { prepareRollingDailyCurrentOwnership, selectTrailingRollingDailyCurrentHistory } from '../lib/forecast/rolling-daily-current-ownership'
import { buildRollingDailyHistoryFingerprint } from '../lib/forecast/rolling-daily-maintenance'

test('summarizeNumericSamples marks p95 as not statistically meaningful below twenty samples', () => {
  const summary = summarizeNumericSamples([100, 200, 300, 400, 500])

  assert.equal(summary.sampleCount, 5)
  assert.equal(summary.medianMs, 300)
  assert.equal(summary.p95Ms, NOT_STATISTICALLY_MEANINGFUL)
  assert.equal(summary.maxMs, 500)
  assert.equal(resolveConservativeLatencyMs(summary), 500)
})

test('summarizeNumericSamples computes nearest-rank p95 at twenty samples', () => {
  const summary = summarizeNumericSamples(Array.from({ length: 20 }, (_, index) => index + 1))

  assert.equal(summary.sampleCount, 20)
  assert.equal(summary.medianMs, 10.5)
  assert.equal(summary.p95Ms, 19)
  assert.equal(summary.maxMs, 20)
  assert.equal(resolveConservativeLatencyMs(summary), 19)
})

test('summarizeOptionalPhaseSamples returns not separately measurable when no finite samples exist', () => {
  assert.equal(summarizeOptionalPhaseSamples([null, undefined]), NOT_SEPARATELY_MEASURABLE)
})

test('classifyDominantBottleneck maps the slowest phase to the expected category', () => {
  const result = classifyDominantBottleneck({
    TOTAL_RENDERABLE_READY_MS: 1500,
    HISTORY_LOAD_MS: 200,
    MODEL_BRIDGE_MS: 300,
    MODEL_COMPUTE_MS: 700,
    PERSISTENCE_MS: 250,
  })

  assert.equal(result.phase, 'MODEL_COMPUTE_MS')
  assert.equal(result.category, 'MODEL_COMPUTE')
  assert.equal(result.dominantPhaseMs, 700)
  assert.equal(result.shareOfTotalPct, 46.667)
})

test('evaluateRecentBudgetCandidates computes inline budget fit by candidate', () => {
  const candidates = evaluateRecentBudgetCandidates({
    candidateNs: [3, 6, 12],
    recentVerificationMsByCandidate: new Map([
      [3, 1200],
      [6, 2600],
      [12, 4800],
    ]),
    currentConservativeMs: 7200,
    reservedServingOverheadMs: 1800,
  })

  assert.deepEqual(candidates, [
    {
      candidateN: 3,
      recentVerificationMs: 1200,
      currentConservativeMs: 7200,
      reservedServingOverheadMs: 1800,
      estimatedTotalFastReadyMs: 10200,
      within15s: true,
    },
    {
      candidateN: 6,
      recentVerificationMs: 2600,
      currentConservativeMs: 7200,
      reservedServingOverheadMs: 1800,
      estimatedTotalFastReadyMs: 11600,
      within15s: true,
    },
    {
      candidateN: 12,
      recentVerificationMs: 4800,
      currentConservativeMs: 7200,
      reservedServingOverheadMs: 1800,
      estimatedTotalFastReadyMs: 13800,
      within15s: true,
    },
  ])
})

test('resolveGlobalNFastDecision distinguishes global, profile-specific, and background outcomes', () => {
  assert.deepEqual(resolveGlobalNFastDecision([]), {
    globalRecommendation: 'NONE',
    profileSpecificRequired: false,
    recommendation: 'INSUFFICIENT_PROFILE_EVIDENCE',
  })

  assert.deepEqual(resolveGlobalNFastDecision([12, 18, 6]), {
    globalRecommendation: 6,
    profileSpecificRequired: true,
    recommendation: 'INLINE_WITH_GLOBAL_N_FAST',
  })

  assert.deepEqual(resolveGlobalNFastDecision([12, 0, 6]), {
    globalRecommendation: 'NONE',
    profileSpecificRequired: true,
    recommendation: 'PROFILE_SPECIFIC_CONTROL_REQUIRED',
  })

  assert.deepEqual(resolveGlobalNFastDecision([0, 0]), {
    globalRecommendation: 'NONE',
    profileSpecificRequired: false,
    recommendation: 'BACKGROUND_REQUIRED',
  })
})

test('resolveRollingDailyExactReadGate only accepts HIT as renderable', () => {
  assert.deepEqual(resolveRollingDailyExactReadGate('HIT'), {
    acceptedStatuses: 'HIT_ONLY',
    staleCountsAsRenderable: false,
    status: 'PASS',
    reason: null,
  })

  assert.deepEqual(resolveRollingDailyExactReadGate('STALE'), {
    acceptedStatuses: 'HIT_ONLY',
    staleCountsAsRenderable: false,
    status: 'FAIL',
    reason: 'Rolling Daily exact read must be HIT, received STALE.',
  })
})

test('Rolling Daily canonical ownership fingerprint uses the selected current-fast input, not full history', async () => {
  const fullHistory = {
    seriesId: 'rolling-daily-fingerprint-test',
    displayName: 'Rolling Daily Fingerprint Test',
    description: null,
    frequency: 'DAILY',
    source: 'TEST',
    points: Array.from({ length: 500 }, (_, index) => {
      const date = new Date('2024-01-01T00:00:00.000Z')
      date.setUTCDate(date.getUTCDate() + index)
      return {
        date: date.toISOString().slice(0, 10),
        value: index + 1,
      }
    }),
  }

  const selectedHistory = selectTrailingRollingDailyCurrentHistory(fullHistory)
  const ownership = await prepareRollingDailyCurrentOwnership({
    seriesId: fullHistory.seriesId,
    modelId: 'arima',
    loadHistory: async () => fullHistory,
  })

  assert.equal(
    ownership.identity.historyFingerprint,
    buildRollingDailyHistoryFingerprint(selectedHistory),
  )
  assert.notEqual(
    ownership.identity.historyFingerprint,
    buildRollingDailyHistoryFingerprint(fullHistory),
  )
})

test('resolveWarmReuseGate requires zero compute and zero new execution', () => {
  assert.deepEqual(resolveWarmReuseGate({
    modelComputeCount: 0,
    bridgeCurrentComputeCount: 0,
    newExecutionCount: 0,
    newArtifactWriteCount: 0,
  }), {
    status: 'PASS',
    reason: null,
  })

  assert.deepEqual(resolveWarmReuseGate({
    modelComputeCount: 1,
    bridgeCurrentComputeCount: 0,
    newExecutionCount: 1,
    newArtifactWriteCount: 0,
  }), {
    status: 'FAIL',
    reason: 'Warm canonical reuse created work: modelComputeCount=1, newExecutionCount=1',
  })
})

test('resolveFastReadyProfilerGate rejects zero serving headroom', () => {
  assert.deepEqual(resolveFastReadyProfilerGate({
    currentFastLatencyGate: 'PASS',
    warmReuseGate: 'PASS',
    concurrentOneGlobalComputeGate: 'PASS',
    currentIsolationGate: 'PASS',
    recentProfileGate: 'PASS',
    reservedServingOverheadMs: 0,
    profileArtifactSourceShaMatch: true,
    stage5NonRegression: 'PASS',
    stage4NonRegression: 'PASS',
    currentFastPolicyChanged: false,
    stage7ScopeLeakage: false,
  }), {
    fastReadyProfilerGate: 'FAIL',
    performanceCorrectiveRequired: false,
  })
})

test('resolveFastReadyProfilerGate passes only when all required gates hold', () => {
  assert.deepEqual(resolveFastReadyProfilerGate({
    currentFastLatencyGate: 'PASS',
    warmReuseGate: 'PASS',
    concurrentOneGlobalComputeGate: 'PASS',
    currentIsolationGate: 'PASS',
    recentProfileGate: 'PASS',
    reservedServingOverheadMs: 250,
    profileArtifactSourceShaMatch: true,
    stage5NonRegression: 'PASS',
    stage4NonRegression: 'PASS',
    currentFastPolicyChanged: false,
    stage7ScopeLeakage: false,
  }), {
    fastReadyProfilerGate: 'PASS',
    performanceCorrectiveRequired: false,
  })
})

test('resolveEvidenceBasedServingHeadroom derives a positive measured reserve instead of leftover budget', () => {
  const currentSummary = summarizeNumericSamples([1000, 1200, 1800, 2500, 3200])
  const exactPreparedReadSummary = summarizeNumericSamples([30, 35, 40, 60, 80])

  const decision = resolveEvidenceBasedServingHeadroom({
    currentSummary,
    exactPreparedReadSummary,
  })

  assert.equal(decision.reservedServingOverheadBasis, 'MEASURED_EVIDENCE')
  assert.equal(decision.servingHeadroomDoubleCounted, false)
  assert.equal(decision.reservedServingOverheadMs, 1480)
  assert.notEqual(decision.reservedServingOverheadMs, 15_000 - 3_200 - 900)
})

test('resolveProfilerConfigurationContract blocks Stage 6 closeout for smoke mode', () => {
  assert.deepEqual(resolveProfilerConfigurationContract({
    profileMode: 'SMOKE',
    coldSamples: 1,
    warmSamples: 1,
    recentCandidates: [1],
  }), {
    profileMode: 'SMOKE',
    coldSamples: 1,
    warmSamples: 1,
    recentCandidates: [1],
    validForRequestedMode: true,
    stage6ClosureAllowed: false,
    reason: 'Smoke mode is diagnostic only and cannot close Stage 6.',
  })
})

test('resolveProfilerConfigurationContract requires exact final sample counts', () => {
  assert.deepEqual(resolveProfilerConfigurationContract({
    profileMode: 'FINAL',
    coldSamples: FINAL_PROFILE_COLD_SAMPLES,
    warmSamples: FINAL_PROFILE_WARM_SAMPLES,
    recentCandidates: FINAL_PROFILE_RECENT_CANDIDATES,
  }), {
    profileMode: 'FINAL',
    coldSamples: 5,
    warmSamples: 20,
    recentCandidates: [1, 3, 6, 12],
    validForRequestedMode: true,
    stage6ClosureAllowed: true,
    reason: null,
  })

  assert.equal(resolveProfilerConfigurationContract({
    profileMode: 'FINAL',
    coldSamples: 1,
    warmSamples: 20,
    recentCandidates: [1, 3, 6, 12],
  }).validForRequestedMode, false)
})

test('resolveConcurrentGlobalComputeGate accepts one-owner one-artifact convergence', () => {
  assert.deepEqual(resolveConcurrentGlobalComputeGate({
    requestCount: 5,
    ownerCount: 1,
    waiterCount: 4,
    modelComputeCount: 1,
    bridgeComputeCount: 1,
    artifactWriteCount: 1,
    terminalArtifactCount: 1,
    allRequestsSucceeded: true,
    finalExactReadStatus: 'HIT',
    expectedFinalExactReadStatus: 'HIT',
  }), {
    gate: 'PASS',
    reasons: [],
  })
})

test('validateProfileEnvironmentMetadata requires the full environment contract', () => {
  const result = validateProfileEnvironmentMetadata({
    profileEnvironmentClass: 'CONTROLLED_SYNTHETIC_DB_BACKED',
    nodeVersion: 'v24.7.0',
    pythonVersion: 'Python 3.12.1',
    platform: 'darwin',
    architecture: 'arm64',
    databaseClassification: 'CONTROLLED_SYNTHETIC_DB_BACKED',
    processConcurrency: 1,
    forecastLeaseDurationMs: 10_000,
    forecastHeartbeatIntervalMs: 3_000,
    workingTreeCleanAtProfileStart: true,
    profileCommand: 'npm run forecast:profile:fast-ready',
    profileMode: 'FINAL',
    coldSamples: 5,
    warmSamples: 20,
    recentCandidates: [1, 3, 6, 12],
    syntheticSeriesDefinitions: ['daily', 'weekly'],
  })

  assert.equal(result.complete, true)
  assert.deepEqual(result.missingFields, [])
})

test('resolveStage6FinalDecision prevents smoke-mode success and permits complete final pass', () => {
  const smokeConfig = resolveProfilerConfigurationContract({
    profileMode: 'SMOKE',
    coldSamples: 1,
    warmSamples: 1,
    recentCandidates: [1],
  })
  const finalConfig = resolveProfilerConfigurationContract({
    profileMode: 'FINAL',
    coldSamples: 5,
    warmSamples: 20,
    recentCandidates: [1, 3, 6, 12],
  })

  assert.equal(resolveStage6FinalDecision({
    profileMode: 'SMOKE',
    configurationContract: smokeConfig,
    currentFastLatencyGate: 'PASS',
    rollingDailyExactReadGate: 'PASS',
    warmReuseGate: 'PASS',
    concurrentOneGlobalComputeGate: 'PASS',
    currentIsolationGate: 'PASS',
    recentProfileGate: 'PASS',
    fastReadyProfilerGate: 'PASS',
    globalNFastRecommendation: 1,
    profileSpecificNFastRequired: false,
    recentSyncRecommendation: 'INLINE_WITH_GLOBAL_N_FAST',
    reservedServingOverheadMs: 250,
    reservedServingOverheadBasis: 'MEASURED_EVIDENCE',
    profileArtifactSourceShaMatch: true,
    fastInputMetadataComplete: true,
    profileEnvironmentMetadataComplete: true,
    stage4NonRegression: 'PASS',
    stage5NonRegression: 'PASS',
    currentFastPolicyChanged: false,
    modelMinHistoryChanged: false,
    methodVersionChanged: false,
    recentVerificationProductionActivated: false,
    stage7ScopeLeakage: false,
    stage8PlusScopeLeakage: false,
  }).stage6Completion, 'FAIL')

  const finalDecision = resolveStage6FinalDecision({
    profileMode: 'FINAL',
    configurationContract: finalConfig,
    currentFastLatencyGate: 'PASS',
    rollingDailyExactReadGate: 'PASS',
    warmReuseGate: 'PASS',
    concurrentOneGlobalComputeGate: 'PASS',
    currentIsolationGate: 'PASS',
    recentProfileGate: 'PASS',
    fastReadyProfilerGate: 'PASS',
    globalNFastRecommendation: 3,
    profileSpecificNFastRequired: false,
    recentSyncRecommendation: 'INLINE_WITH_GLOBAL_N_FAST',
    reservedServingOverheadMs: 250,
    reservedServingOverheadBasis: 'MEASURED_EVIDENCE',
    profileArtifactSourceShaMatch: true,
    fastInputMetadataComplete: true,
    profileEnvironmentMetadataComplete: true,
    stage4NonRegression: 'PASS',
    stage5NonRegression: 'PASS',
    currentFastPolicyChanged: false,
    modelMinHistoryChanged: false,
    methodVersionChanged: false,
    recentVerificationProductionActivated: false,
    stage7ScopeLeakage: false,
    stage8PlusScopeLeakage: false,
  })

  assert.equal(finalDecision.stage6Completion, 'PASS')
  assert.equal(finalDecision.readyForStage7, true)
  assert.equal(finalDecision.performanceCorrectiveRequired, false)
  assert.equal(finalDecision.profilerEvidenceCorrectiveRequired, false)
})