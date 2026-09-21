export const ADAPTIVE_VERIFICATION_BATCH_POLICY_VERSION = 'PPF1_ADAPTIVE_VERIFICATION_BATCH_V1'

export const ADAPTIVE_VERIFICATION_BATCH_SIZES = [1, 2, 4, 8, 16, 32] as const

export type AdaptiveVerificationBatchDecision =
  | 'INITIAL'
  | 'GROW'
  | 'HOLD'
  | 'SHRINK'
  | 'FALLBACK'

export type AdaptiveVerificationBatchCheckpoint = {
  schemaVersion: 'adaptive-verification-batch-v1'
  policyVersion: typeof ADAPTIVE_VERIFICATION_BATCH_POLICY_VERSION
  nextBatchSize: number
  lastBatchSize: number | null
  lastSliceMs: number | null
  lastOriginCount: number | null
  ewmaMsPerOrigin: number | null
  successfulSliceCount: number
  fallbackCount: number
  decision: AdaptiveVerificationBatchDecision
  reason: string
}

const TARGET_SLICE_MS = 60_000
const SOFT_SLICE_LIMIT_MS = 90_000
const HARD_SLICE_LIMIT_MS = 120_000
const EWMA_NEW_SAMPLE_WEIGHT = 0.35

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isFinitePositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function normalizeBatchSize(value: number) {
  let selected: number = ADAPTIVE_VERIFICATION_BATCH_SIZES[0]
  for (const candidate of ADAPTIVE_VERIFICATION_BATCH_SIZES) {
    if (candidate > value) break
    selected = candidate
  }
  return selected
}

export function createInitialAdaptiveVerificationBatchCheckpoint(): AdaptiveVerificationBatchCheckpoint {
  return {
    schemaVersion: 'adaptive-verification-batch-v1',
    policyVersion: ADAPTIVE_VERIFICATION_BATCH_POLICY_VERSION,
    nextBatchSize: ADAPTIVE_VERIFICATION_BATCH_SIZES[0],
    lastBatchSize: null,
    lastSliceMs: null,
    lastOriginCount: null,
    ewmaMsPerOrigin: null,
    successfulSliceCount: 0,
    fallbackCount: 0,
    decision: 'INITIAL',
    reason: 'Start with one origin so the first partial verification result becomes available as early as possible.',
  }
}

export function readAdaptiveVerificationBatchCheckpoint(value: unknown): AdaptiveVerificationBatchCheckpoint {
  if (!isRecord(value)
    || value.schemaVersion !== 'adaptive-verification-batch-v1'
    || value.policyVersion !== ADAPTIVE_VERIFICATION_BATCH_POLICY_VERSION
    || !isFinitePositiveNumber(value.nextBatchSize)
  ) {
    return createInitialAdaptiveVerificationBatchCheckpoint()
  }

  return {
    schemaVersion: 'adaptive-verification-batch-v1',
    policyVersion: ADAPTIVE_VERIFICATION_BATCH_POLICY_VERSION,
    nextBatchSize: normalizeBatchSize(value.nextBatchSize),
    lastBatchSize: isFinitePositiveNumber(value.lastBatchSize) ? normalizeBatchSize(value.lastBatchSize) : null,
    lastSliceMs: isFinitePositiveNumber(value.lastSliceMs) ? value.lastSliceMs : null,
    lastOriginCount: isFinitePositiveNumber(value.lastOriginCount) ? Math.floor(value.lastOriginCount) : null,
    ewmaMsPerOrigin: isFinitePositiveNumber(value.ewmaMsPerOrigin) ? value.ewmaMsPerOrigin : null,
    successfulSliceCount: typeof value.successfulSliceCount === 'number' && value.successfulSliceCount >= 0
      ? Math.floor(value.successfulSliceCount)
      : 0,
    fallbackCount: typeof value.fallbackCount === 'number' && value.fallbackCount >= 0
      ? Math.floor(value.fallbackCount)
      : 0,
    decision: ['INITIAL', 'GROW', 'HOLD', 'SHRINK', 'FALLBACK'].includes(String(value.decision))
      ? value.decision as AdaptiveVerificationBatchDecision
      : 'INITIAL',
    reason: typeof value.reason === 'string' ? value.reason : 'Recovered the durable adaptive batch state.',
  }
}

export function observeSuccessfulVerificationBatch(
  checkpoint: AdaptiveVerificationBatchCheckpoint,
  input: { batchSize: number, sliceMs: number, originCount: number },
): AdaptiveVerificationBatchCheckpoint {
  const batchSize = normalizeBatchSize(input.batchSize)
  const sliceMs = Math.max(1, input.sliceMs)
  const originCount = Math.max(1, Math.floor(input.originCount))
  const sampleMsPerOrigin = sliceMs / originCount
  const ewmaMsPerOrigin = checkpoint.ewmaMsPerOrigin === null
    ? sampleMsPerOrigin
    : (checkpoint.ewmaMsPerOrigin * (1 - EWMA_NEW_SAMPLE_WEIGHT)) + (sampleMsPerOrigin * EWMA_NEW_SAMPLE_WEIGHT)

  let nextBatchSize = batchSize
  let decision: AdaptiveVerificationBatchDecision = 'HOLD'
  let reason = 'The observed slice remains within the target execution envelope.'

  if (sliceMs >= HARD_SLICE_LIMIT_MS) {
    nextBatchSize = ADAPTIVE_VERIFICATION_BATCH_SIZES[0]
    decision = 'FALLBACK'
    reason = 'The hard slice limit was reached; reset to one origin for the next durable attempt.'
  } else {
    const idealBatchSize = normalizeBatchSize(Math.max(1, Math.floor(TARGET_SLICE_MS / ewmaMsPerOrigin)))
    if (sliceMs >= SOFT_SLICE_LIMIT_MS || idealBatchSize < batchSize) {
      nextBatchSize = normalizeBatchSize(Math.max(1, Math.min(idealBatchSize, Math.floor(batchSize / 2))))
      decision = nextBatchSize < batchSize ? 'SHRINK' : 'HOLD'
      reason = nextBatchSize < batchSize
        ? 'The observed slice is above the safe target; reduce the next batch.'
        : 'The minimum batch is already active while the observed slice is above target.'
    } else if (sliceMs <= TARGET_SLICE_MS && idealBatchSize >= batchSize * 2) {
      nextBatchSize = normalizeBatchSize(Math.min(batchSize * 2, ADAPTIVE_VERIFICATION_BATCH_SIZES.at(-1)!))
      decision = nextBatchSize > batchSize ? 'GROW' : 'HOLD'
      reason = nextBatchSize > batchSize
        ? 'The observed slice has enough headroom; grow by at most one bounded step.'
        : 'The maximum bounded batch is already active.'
    }
  }

  return {
    schemaVersion: 'adaptive-verification-batch-v1',
    policyVersion: ADAPTIVE_VERIFICATION_BATCH_POLICY_VERSION,
    nextBatchSize,
    lastBatchSize: batchSize,
    lastSliceMs: sliceMs,
    lastOriginCount: originCount,
    ewmaMsPerOrigin,
    successfulSliceCount: checkpoint.successfulSliceCount + 1,
    fallbackCount: checkpoint.fallbackCount + (decision === 'FALLBACK' ? 1 : 0),
    decision,
    reason,
  }
}

export function fallbackAdaptiveVerificationBatchAfterFailure(
  checkpoint: AdaptiveVerificationBatchCheckpoint,
  reason: string,
): AdaptiveVerificationBatchCheckpoint {
  return {
    ...checkpoint,
    nextBatchSize: ADAPTIVE_VERIFICATION_BATCH_SIZES[0],
    fallbackCount: checkpoint.fallbackCount + 1,
    decision: 'FALLBACK',
    reason,
  }
}
