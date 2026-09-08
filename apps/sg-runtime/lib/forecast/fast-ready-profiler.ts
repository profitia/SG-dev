export const NOT_STATISTICALLY_MEANINGFUL = 'NOT_STATISTICALLY_MEANINGFUL' as const
export const NOT_SEPARATELY_MEASURABLE = 'NOT_SEPARATELY_MEASURABLE' as const

export type ProfiledPhaseName =
  | 'CAPABILITY_RESOLUTION_MS'
  | 'HISTORY_LOAD_MS'
  | 'HISTORY_PREPARATION_MS'
  | 'FAST_SUFFIX_SELECTION_MS'
  | 'PREPARED_LOOKUP_MS'
  | 'EXECUTION_ADMISSION_MS'
  | 'OWNER_WAIT_MS'
  | 'MODEL_BRIDGE_MS'
  | 'MODEL_COMPUTE_MS'
  | 'PERSISTENCE_MS'
  | 'POST_PERSIST_EXACT_READ_MS'
  | 'CONSUMER_ADAPTER_MS'
  | 'TOTAL_RENDERABLE_READY_MS'
  | 'ROLLING_DAILY_OWNERSHIP_PREPARATION_MS'
  | 'ROLLING_DAILY_SNAPSHOT_PERSIST_MS'

export type BottleneckCategory =
  | 'MODEL_COMPUTE'
  | 'PYTHON_PROCESS_STARTUP'
  | 'HISTORY_PREPARATION'
  | 'DATABASE_ADMISSION'
  | 'DATABASE_PERSISTENCE'
  | 'WAITING_FOR_GLOBAL_OWNER'
  | 'CONSUMER_ADAPTER'
  | 'NETWORK_OR_EXTERNAL_DEPENDENCY'
  | 'OTHER'

export type NumericSummary = {
  sampleCount: number
  medianMs: number
  p95Ms: number | typeof NOT_STATISTICALLY_MEANINGFUL
  maxMs: number
}

export type RecentBudgetCandidate = {
  candidateN: number
  recentVerificationMs: number
  currentConservativeMs: number
  reservedServingOverheadMs: number
  estimatedTotalFastReadyMs: number
  within15s: boolean
}

export type RecentRecommendation =
  | 'INLINE_WITH_GLOBAL_N_FAST'
  | 'PROFILE_SPECIFIC_CONTROL_REQUIRED'
  | 'BACKGROUND_REQUIRED'
  | 'INSUFFICIENT_PROFILE_EVIDENCE'

export type GlobalNFastDecision = {
  globalRecommendation: number | 'NONE'
  profileSpecificRequired: boolean
  recommendation: RecentRecommendation
}

export type RollingDailyExactReadGate = {
  acceptedStatuses: 'HIT_ONLY'
  staleCountsAsRenderable: false
  status: 'PASS' | 'FAIL'
  reason: string | null
}

export type WarmReuseGate = {
  status: 'PASS' | 'FAIL'
  reason: string | null
}

export type FastReadyProfilerGateInput = {
  currentFastLatencyGate: 'PASS' | 'FAIL'
  warmReuseGate: 'PASS' | 'FAIL'
  concurrentOneGlobalComputeGate: 'PASS' | 'FAIL'
  currentIsolationGate: 'PASS' | 'FAIL'
  recentProfileGate: 'PASS' | 'FAIL'
  reservedServingOverheadMs: number
  profileArtifactSourceShaMatch: boolean
  stage5NonRegression: 'PASS' | 'FAIL'
  stage4NonRegression: 'PASS' | 'FAIL'
  currentFastPolicyChanged: boolean
  stage7ScopeLeakage: boolean
}

export type FastReadyProfilerGateDecision = {
  fastReadyProfilerGate: 'PASS' | 'FAIL'
  performanceCorrectiveRequired: boolean
}

const BOTTLENECK_CATEGORY_BY_PHASE: Record<ProfiledPhaseName, BottleneckCategory> = {
  CAPABILITY_RESOLUTION_MS: 'OTHER',
  HISTORY_LOAD_MS: 'NETWORK_OR_EXTERNAL_DEPENDENCY',
  HISTORY_PREPARATION_MS: 'HISTORY_PREPARATION',
  FAST_SUFFIX_SELECTION_MS: 'HISTORY_PREPARATION',
  PREPARED_LOOKUP_MS: 'DATABASE_ADMISSION',
  EXECUTION_ADMISSION_MS: 'DATABASE_ADMISSION',
  OWNER_WAIT_MS: 'WAITING_FOR_GLOBAL_OWNER',
  MODEL_BRIDGE_MS: 'PYTHON_PROCESS_STARTUP',
  MODEL_COMPUTE_MS: 'MODEL_COMPUTE',
  PERSISTENCE_MS: 'DATABASE_PERSISTENCE',
  POST_PERSIST_EXACT_READ_MS: 'DATABASE_PERSISTENCE',
  CONSUMER_ADAPTER_MS: 'CONSUMER_ADAPTER',
  TOTAL_RENDERABLE_READY_MS: 'OTHER',
  ROLLING_DAILY_OWNERSHIP_PREPARATION_MS: 'DATABASE_ADMISSION',
  ROLLING_DAILY_SNAPSHOT_PERSIST_MS: 'DATABASE_PERSISTENCE',
}

function roundMs(value: number) {
  return Number(value.toFixed(3))
}

function nearestRankPercentile(sortedValues: number[], percentile: number) {
  if (sortedValues.length === 0) {
    throw new Error('Cannot summarize an empty sample set.')
  }

  const rank = Math.max(1, Math.ceil(percentile * sortedValues.length))
  return sortedValues[Math.min(rank - 1, sortedValues.length - 1)]
}

export function summarizeNumericSamples(samples: readonly number[]): NumericSummary {
  if (samples.length === 0) {
    throw new Error('Cannot summarize an empty sample set.')
  }

  const sorted = [...samples].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!

  return {
    sampleCount: sorted.length,
    medianMs: roundMs(median),
    p95Ms: sorted.length >= 20
      ? roundMs(nearestRankPercentile(sorted, 0.95))
      : NOT_STATISTICALLY_MEANINGFUL,
    maxMs: roundMs(sorted[sorted.length - 1]!),
  }
}

export function resolveConservativeLatencyMs(summary: NumericSummary) {
  return typeof summary.p95Ms === 'number'
    ? summary.p95Ms
    : summary.maxMs
}

export function summarizeOptionalPhaseSamples(samples: readonly (number | null | undefined)[]) {
  const numericSamples = samples.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (numericSamples.length === 0) {
    return NOT_SEPARATELY_MEASURABLE
  }

  return summarizeNumericSamples(numericSamples)
}

export function classifyDominantBottleneck(phases: Partial<Record<ProfiledPhaseName, number | null | undefined>>) {
  const ranked = (Object.entries(phases) as Array<[ProfiledPhaseName, number | null | undefined]>)
    .filter((entry): entry is [ProfiledPhaseName, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]))
    .filter(([phase]) => phase !== 'TOTAL_RENDERABLE_READY_MS')
    .sort((left, right) => right[1] - left[1])

  if (ranked.length === 0) {
    return {
      phase: null,
      dominantPhaseMs: 0,
      category: 'OTHER' as BottleneckCategory,
      shareOfTotalPct: 0,
    }
  }

  const [phase, durationMs] = ranked[0]!
  const total = typeof phases.TOTAL_RENDERABLE_READY_MS === 'number' && phases.TOTAL_RENDERABLE_READY_MS > 0
    ? phases.TOTAL_RENDERABLE_READY_MS
    : ranked.reduce((sum, [, value]) => sum + value, 0)

  return {
    phase,
    dominantPhaseMs: roundMs(durationMs),
    category: BOTTLENECK_CATEGORY_BY_PHASE[phase],
    shareOfTotalPct: total > 0 ? roundMs((durationMs / total) * 100) : 0,
  }
}

export function evaluateRecentBudgetCandidates(input: {
  candidateNs: readonly number[]
  recentVerificationMsByCandidate: ReadonlyMap<number, number>
  currentConservativeMs: number
  reservedServingOverheadMs: number
  totalBudgetMs?: number
}) {
  const totalBudgetMs = input.totalBudgetMs ?? 15_000

  return input.candidateNs.map((candidateN): RecentBudgetCandidate => {
    const recentVerificationMs = input.recentVerificationMsByCandidate.get(candidateN)
    if (recentVerificationMs === undefined) {
      throw new Error(`Missing Recent Verification timing for candidate ${candidateN}.`)
    }

    const estimatedTotalFastReadyMs = input.currentConservativeMs + recentVerificationMs + input.reservedServingOverheadMs
    return {
      candidateN,
      recentVerificationMs: roundMs(recentVerificationMs),
      currentConservativeMs: roundMs(input.currentConservativeMs),
      reservedServingOverheadMs: roundMs(input.reservedServingOverheadMs),
      estimatedTotalFastReadyMs: roundMs(estimatedTotalFastReadyMs),
      within15s: estimatedTotalFastReadyMs <= totalBudgetMs,
    }
  })
}

export function resolveGlobalNFastDecision(profileMaxima: readonly number[]) {
  if (profileMaxima.length === 0) {
    return {
      globalRecommendation: 'NONE',
      profileSpecificRequired: false,
      recommendation: 'INSUFFICIENT_PROFILE_EVIDENCE',
    } satisfies GlobalNFastDecision
  }

  const nonPositive = profileMaxima.every((value) => value <= 0)
  if (nonPositive) {
    return {
      globalRecommendation: 'NONE',
      profileSpecificRequired: false,
      recommendation: 'BACKGROUND_REQUIRED',
    } satisfies GlobalNFastDecision
  }

  if (profileMaxima.some((value) => value <= 0)) {
    return {
      globalRecommendation: 'NONE',
      profileSpecificRequired: true,
      recommendation: 'PROFILE_SPECIFIC_CONTROL_REQUIRED',
    } satisfies GlobalNFastDecision
  }

  const globalRecommendation = Math.min(...profileMaxima)
  return {
    globalRecommendation,
    profileSpecificRequired: profileMaxima.some((value) => value !== globalRecommendation),
    recommendation: 'INLINE_WITH_GLOBAL_N_FAST',
  } satisfies GlobalNFastDecision
}

export function resolveRollingDailyExactReadGate(exactReadStatus: string): RollingDailyExactReadGate {
  if (exactReadStatus === 'HIT') {
    return {
      acceptedStatuses: 'HIT_ONLY',
      staleCountsAsRenderable: false,
      status: 'PASS',
      reason: null,
    }
  }

  return {
    acceptedStatuses: 'HIT_ONLY',
    staleCountsAsRenderable: false,
    status: 'FAIL',
    reason: `Rolling Daily exact read must be HIT, received ${exactReadStatus}.`,
  }
}

export function resolveWarmReuseGate(input: {
  modelComputeCount: number
  bridgeCurrentComputeCount: number
  newExecutionCount: number
  newArtifactWriteCount: number
}): WarmReuseGate {
  const violations: string[] = []

  if (input.modelComputeCount !== 0) {
    violations.push(`modelComputeCount=${input.modelComputeCount}`)
  }
  if (input.bridgeCurrentComputeCount !== 0) {
    violations.push(`bridgeCurrentComputeCount=${input.bridgeCurrentComputeCount}`)
  }
  if (input.newExecutionCount !== 0) {
    violations.push(`newExecutionCount=${input.newExecutionCount}`)
  }
  if (input.newArtifactWriteCount !== 0) {
    violations.push(`newArtifactWriteCount=${input.newArtifactWriteCount}`)
  }

  if (violations.length === 0) {
    return {
      status: 'PASS',
      reason: null,
    }
  }

  return {
    status: 'FAIL',
    reason: `Warm canonical reuse created work: ${violations.join(', ')}`,
  }
}

export function resolveFastReadyProfilerGate(input: FastReadyProfilerGateInput): FastReadyProfilerGateDecision {
  const fastReadyProfilerGate = (
    input.currentFastLatencyGate === 'PASS'
    && input.warmReuseGate === 'PASS'
    && input.concurrentOneGlobalComputeGate === 'PASS'
    && input.currentIsolationGate === 'PASS'
    && input.recentProfileGate === 'PASS'
    && input.reservedServingOverheadMs > 0
    && input.profileArtifactSourceShaMatch
    && input.stage5NonRegression === 'PASS'
    && input.stage4NonRegression === 'PASS'
    && !input.currentFastPolicyChanged
    && !input.stage7ScopeLeakage
  )
    ? 'PASS'
    : 'FAIL'

  return {
    fastReadyProfilerGate,
    performanceCorrectiveRequired: fastReadyProfilerGate !== 'PASS',
  }
}