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
  | 'PYTHON_BRIDGE_OR_PROCESS_OVERHEAD'
  | 'HISTORY_PREPARATION'
  | 'DATABASE_ADMISSION'
  | 'DATABASE_PERSISTENCE'
  | 'WAITING_FOR_GLOBAL_OWNER'
  | 'CONSUMER_ADAPTER'
  | 'NETWORK_OR_EXTERNAL_DEPENDENCY'
  | 'OTHER'

export type ProfileMode = 'SMOKE' | 'FINAL'

export const FINAL_PROFILE_COLD_SAMPLES = 5
export const FINAL_PROFILE_WARM_SAMPLES = 20
export const FINAL_PROFILE_RECENT_CANDIDATES = [1, 3, 6, 12] as const

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

export type ServingHeadroomComponent = {
  component: 'POST_PERSIST_EXACT_READ_PROXY_MS' | 'RUNTIME_VARIANCE_ALLOWANCE_MS'
  valueMs: number
  sourceMeasurement: string
}

export type ServingHeadroomDecision = {
  reservedServingOverheadMs: number
  reservedServingOverheadBasis: 'MEASURED_EVIDENCE'
  components: ServingHeadroomComponent[]
  doubleCountGuard: 'POST_PERSIST_READ_PROXY_APPLIES_ONLY_TO_DIRECT_RECENT_AND_FINAL_HANDOFF'
  servingHeadroomDoubleCounted: false
}

export type ProfilerConfigurationContract = {
  profileMode: ProfileMode
  coldSamples: number
  warmSamples: number
  recentCandidates: number[]
  validForRequestedMode: boolean
  stage6ClosureAllowed: boolean
  reason: string | null
}

export type ConcurrentProfileGateInput = {
  requestCount: number
  ownerCount: number
  waiterCount: number
  modelComputeCount: number
  bridgeComputeCount: number
  artifactWriteCount: number
  terminalArtifactCount: number
  allRequestsSucceeded: boolean
  finalExactReadStatus: string
  expectedFinalExactReadStatus: 'AVAILABLE' | 'HIT'
}

export type ConcurrentProfileGateDecision = {
  gate: 'PASS' | 'FAIL'
  reasons: string[]
}

export type Stage6FinalDecision = {
  currentFastLatencyGate: 'PASS' | 'FAIL'
  rollingDailyExactReadGate: 'PASS' | 'FAIL'
  warmReuseGate: 'PASS' | 'FAIL'
  concurrentOneGlobalComputeGate: 'PASS' | 'FAIL'
  currentIsolationGate: 'PASS' | 'FAIL'
  recentProfileGate: 'PASS' | 'FAIL'
  fastReadyProfilerGate: 'PASS' | 'FAIL'
  globalNFastRecommendation: number | 'NONE'
  profileSpecificNFastRequired: boolean
  recentSyncRecommendation: RecentRecommendation
  reservedServingOverheadMs: number
  reservedServingOverheadBasis: 'MEASURED_EVIDENCE' | 'OTHER'
  performanceCorrectiveRequired: boolean
  performanceCorrectiveReason: string | null
  profilerEvidenceCorrectiveRequired: boolean
  stage6Completion: 'PASS' | 'PARTIAL' | 'FAIL'
  readyForStage7: boolean
}

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
  MODEL_BRIDGE_MS: 'PYTHON_BRIDGE_OR_PROCESS_OVERHEAD',
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

export function resolveProfilerConfigurationContract(input: {
  profileMode: ProfileMode
  coldSamples: number
  warmSamples: number
  recentCandidates: readonly number[]
}): ProfilerConfigurationContract {
  const recentCandidates = [...input.recentCandidates]
  const isExactFinalConfiguration = input.coldSamples === FINAL_PROFILE_COLD_SAMPLES
    && input.warmSamples === FINAL_PROFILE_WARM_SAMPLES
    && recentCandidates.length === FINAL_PROFILE_RECENT_CANDIDATES.length
    && recentCandidates.every((value, index) => value === FINAL_PROFILE_RECENT_CANDIDATES[index])

  if (input.profileMode === 'SMOKE') {
    return {
      profileMode: input.profileMode,
      coldSamples: input.coldSamples,
      warmSamples: input.warmSamples,
      recentCandidates,
      validForRequestedMode: true,
      stage6ClosureAllowed: false,
      reason: 'Smoke mode is diagnostic only and cannot close Stage 6.',
    }
  }

  return {
    profileMode: input.profileMode,
    coldSamples: input.coldSamples,
    warmSamples: input.warmSamples,
    recentCandidates,
    validForRequestedMode: isExactFinalConfiguration,
    stage6ClosureAllowed: isExactFinalConfiguration,
    reason: isExactFinalConfiguration
      ? null
      : 'Final mode requires cold=5, warm=20, recentCandidates=[1,3,6,12].',
  }
}

export function resolveEvidenceBasedServingHeadroom(input: {
  currentSummary: NumericSummary
  exactPreparedReadSummary: NumericSummary
}): ServingHeadroomDecision {
  const postPersistExactReadProxyMs = resolveConservativeLatencyMs(input.exactPreparedReadSummary)
  const runtimeVarianceAllowanceMs = roundMs(Math.max(input.currentSummary.maxMs - input.currentSummary.medianMs, 0))
  const components: ServingHeadroomComponent[] = [
    {
      component: 'POST_PERSIST_EXACT_READ_PROXY_MS',
      valueMs: roundMs(postPersistExactReadProxyMs),
      sourceMeasurement: 'coldCurrent.exactPreparedRead.p95OrMax',
    },
    {
      component: 'RUNTIME_VARIANCE_ALLOWANCE_MS',
      valueMs: runtimeVarianceAllowanceMs,
      sourceMeasurement: 'coldCurrent.totalRenderableReady.maxMinusMedian',
    },
  ]

  return {
    reservedServingOverheadMs: roundMs(components.reduce((sum, component) => sum + component.valueMs, 0)),
    reservedServingOverheadBasis: 'MEASURED_EVIDENCE',
    components,
    doubleCountGuard: 'POST_PERSIST_READ_PROXY_APPLIES_ONLY_TO_DIRECT_RECENT_AND_FINAL_HANDOFF',
    servingHeadroomDoubleCounted: false,
  }
}

export function resolveConcurrentGlobalComputeGate(input: ConcurrentProfileGateInput): ConcurrentProfileGateDecision {
  const reasons: string[] = []

  if (!input.allRequestsSucceeded) {
    reasons.push('Not all concurrent requests succeeded.')
  }
  if (input.ownerCount !== 1) {
    reasons.push(`Expected one owner, received ${input.ownerCount}.`)
  }
  if (input.waiterCount !== Math.max(input.requestCount - 1, 0)) {
    reasons.push(`Expected ${Math.max(input.requestCount - 1, 0)} waiters, received ${input.waiterCount}.`)
  }
  if (input.modelComputeCount !== 1) {
    reasons.push(`Expected one model compute, received ${input.modelComputeCount}.`)
  }
  if (input.artifactWriteCount !== 1) {
    reasons.push(`Expected one artifact write, received ${input.artifactWriteCount}.`)
  }
  if (input.terminalArtifactCount !== 1) {
    reasons.push(`Expected one terminal artifact, received ${input.terminalArtifactCount}.`)
  }
  if (input.finalExactReadStatus !== input.expectedFinalExactReadStatus) {
    reasons.push(`Expected final exact read ${input.expectedFinalExactReadStatus}, received ${input.finalExactReadStatus}.`)
  }

  return {
    gate: reasons.length === 0 ? 'PASS' : 'FAIL',
    reasons,
  }
}

export function validateProfileEnvironmentMetadata(input: Record<string, unknown>) {
  const requiredFields = [
    'profileEnvironmentClass',
    'nodeVersion',
    'pythonVersion',
    'platform',
    'architecture',
    'databaseClassification',
    'processConcurrency',
    'forecastLeaseDurationMs',
    'forecastHeartbeatIntervalMs',
    'workingTreeCleanAtProfileStart',
    'profileCommand',
    'profileMode',
    'coldSamples',
    'warmSamples',
    'recentCandidates',
    'syntheticSeriesDefinitions',
  ]

  const missingFields = requiredFields.filter((field) => {
    const value = input[field]
    return value === null || value === undefined || value === ''
  })

  return {
    complete: missingFields.length === 0,
    missingFields,
  }
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
    performanceCorrectiveRequired: input.currentFastLatencyGate === 'FAIL',
  }
}

export function resolveStage6FinalDecision(input: {
  profileMode: ProfileMode
  configurationContract: ProfilerConfigurationContract
  currentFastLatencyGate: 'PASS' | 'FAIL'
  rollingDailyExactReadGate: 'PASS' | 'FAIL'
  warmReuseGate: 'PASS' | 'FAIL'
  concurrentOneGlobalComputeGate: 'PASS' | 'FAIL'
  currentIsolationGate: 'PASS' | 'FAIL'
  recentProfileGate: 'PASS' | 'FAIL'
  fastReadyProfilerGate: 'PASS' | 'FAIL'
  globalNFastRecommendation: number | 'NONE'
  profileSpecificNFastRequired: boolean
  recentSyncRecommendation: RecentRecommendation
  reservedServingOverheadMs: number
  reservedServingOverheadBasis: 'MEASURED_EVIDENCE' | 'OTHER'
  profileArtifactSourceShaMatch: boolean
  fastInputMetadataComplete: boolean
  profileEnvironmentMetadataComplete: boolean
  stage4NonRegression: 'PASS' | 'FAIL'
  stage5NonRegression: 'PASS' | 'FAIL'
  currentFastPolicyChanged: boolean
  modelMinHistoryChanged: boolean
  methodVersionChanged: boolean
  recentVerificationProductionActivated: boolean
  stage7ScopeLeakage: boolean
  stage8PlusScopeLeakage: boolean
}): Stage6FinalDecision {
  const profilerEvidenceCorrectiveRequired = (
    !input.configurationContract.stage6ClosureAllowed
    || input.reservedServingOverheadMs <= 0
    || input.reservedServingOverheadBasis !== 'MEASURED_EVIDENCE'
    || !input.profileArtifactSourceShaMatch
    || !input.fastInputMetadataComplete
    || !input.profileEnvironmentMetadataComplete
    || input.stage4NonRegression !== 'PASS'
    || input.stage5NonRegression !== 'PASS'
    || input.currentFastPolicyChanged
    || input.modelMinHistoryChanged
    || input.methodVersionChanged
    || input.recentVerificationProductionActivated
    || input.stage7ScopeLeakage
    || input.stage8PlusScopeLeakage
  )
  const performanceCorrectiveRequired = input.currentFastLatencyGate === 'FAIL'
  const performanceCorrectiveReason = input.currentFastLatencyGate === 'FAIL'
    ? 'Measured Current FAST latency exceeds the 15s target.'
    : null
  const stage6Completion = input.fastReadyProfilerGate === 'PASS'
    && input.profileMode === 'FINAL'
    && input.configurationContract.stage6ClosureAllowed
    && input.currentFastLatencyGate === 'PASS'
    && input.rollingDailyExactReadGate === 'PASS'
    && input.warmReuseGate === 'PASS'
    && input.concurrentOneGlobalComputeGate === 'PASS'
    && input.currentIsolationGate === 'PASS'
    && input.recentProfileGate === 'PASS'
    && !performanceCorrectiveRequired
    && !profilerEvidenceCorrectiveRequired
      ? 'PASS'
      : input.profileMode === 'FINAL'
        ? 'PARTIAL'
        : 'FAIL'

  return {
    currentFastLatencyGate: input.currentFastLatencyGate,
    rollingDailyExactReadGate: input.rollingDailyExactReadGate,
    warmReuseGate: input.warmReuseGate,
    concurrentOneGlobalComputeGate: input.concurrentOneGlobalComputeGate,
    currentIsolationGate: input.currentIsolationGate,
    recentProfileGate: input.recentProfileGate,
    fastReadyProfilerGate: input.fastReadyProfilerGate,
    globalNFastRecommendation: input.globalNFastRecommendation,
    profileSpecificNFastRequired: input.profileSpecificNFastRequired,
    recentSyncRecommendation: input.recentSyncRecommendation,
    reservedServingOverheadMs: input.reservedServingOverheadMs,
    reservedServingOverheadBasis: input.reservedServingOverheadBasis,
    performanceCorrectiveRequired,
    performanceCorrectiveReason,
    profilerEvidenceCorrectiveRequired,
    stage6Completion,
    readyForStage7: stage6Completion === 'PASS',
  }
}