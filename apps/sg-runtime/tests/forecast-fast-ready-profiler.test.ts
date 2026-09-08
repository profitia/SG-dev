import assert from 'node:assert/strict'
import test from 'node:test'

import {
  classifyDominantBottleneck,
  evaluateRecentBudgetCandidates,
  NOT_SEPARATELY_MEASURABLE,
  NOT_STATISTICALLY_MEANINGFUL,
  resolveConservativeLatencyMs,
  resolveFastReadyProfilerGate,
  resolveGlobalNFastDecision,
  resolveRollingDailyExactReadGate,
  resolveWarmReuseGate,
  summarizeNumericSamples,
  summarizeOptionalPhaseSamples,
} from '../lib/forecast/fast-ready-profiler'

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
    performanceCorrectiveRequired: true,
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