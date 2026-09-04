import {
  resolveForecastCapabilitiesBySeriesId,
  type ForecastCapabilityResolution,
  type ForecastVariantCapability,
} from '@/lib/forecast/capability-resolver'
import {
  USER_FACING_FORECAST_MODELS,
  type ForecastTargetBasis,
  type UserFacingForecastModelId,
} from '@/lib/forecast/contracts'
import { createRollingDailyProductionOperationsService } from '@/lib/forecast/rolling-daily-production-operations'
import {
  resolveBenchmarkCurrentForecast,
  resolveBenchmarkForecastVerification,
} from '@/lib/forecast/service'

export type ProgressiveForecastPreparationRequest = {
  seriesId: string
  preferredModelId: UserFacingForecastModelId
  preferredTargetBasis: ForecastTargetBasis
}

export type ProgressiveForecastPreparationState = 'READY' | 'PREPARING' | 'QUEUED' | 'UNSUPPORTED' | 'FAILED'

export type ProgressiveForecastVariantSnapshot = {
  seriesId: string
  modelId: UserFacingForecastModelId
  targetBasis: ForecastTargetBasis
  targetSemantics: ForecastVariantCapability['identity']['targetSemantics']
  currentState: ProgressiveForecastPreparationState
  currentReason: string | null
  verificationState: ProgressiveForecastPreparationState
  verificationReason: string | null
}

export type ProgressiveForecastPreparationSnapshot = {
  seriesId: string
  variants: ProgressiveForecastVariantSnapshot[]
  firstReadyCurrent: {
    modelId: UserFacingForecastModelId
    targetBasis: ForecastTargetBasis
    targetSemantics: ForecastVariantCapability['identity']['targetSemantics']
  } | null
  activeItem: { modelId: UserFacingForecastModelId, targetBasis: ForecastTargetBasis, kind: QueueItemKind } | null
  queuedCount: number
  currentReadyCount: number
  verificationReadyCount: number
}

type QueueItemKind = 'CURRENT' | 'VERIFICATION'

type QueueItem = {
  key: string
  seriesId: string
  modelId: UserFacingForecastModelId
  targetBasis: ForecastTargetBasis
  targetSemantics: ForecastVariantCapability['identity']['targetSemantics']
  kind: QueueItemKind
}

type SeriesState = {
  preferredModelId: UserFacingForecastModelId
  preferredTargetBasis: ForecastTargetBasis
  selectionOrdinal: number
  queuedItems: QueueItem[]
  activeItemKey: string | null
  failedReasons: Map<string, string>
}

type QueueCandidate = {
  seriesId: string
  state: SeriesState
  item: QueueItem
}

type ProgressiveForecastPreparationDependencies = {
  resolveCapabilities: typeof resolveForecastCapabilitiesBySeriesId
  prepareMonthlyCurrent: typeof resolveBenchmarkCurrentForecast
  prepareMonthlyHistorical: typeof resolveBenchmarkForecastVerification
  runRollingDaily: ReturnType<typeof createRollingDailyProductionOperationsService>['run']
}

const TARGET_BASIS_BY_SEMANTICS = {
  END_OF_PERIOD: 'END_OF_PERIOD',
  MONTHLY_AVERAGE: 'MONTHLY_AVERAGE',
  ROLLING_DAILY_POINT_IN_TIME: 'POINT_IN_TIME',
} as const satisfies Record<ForecastVariantCapability['identity']['targetSemantics'], ForecastTargetBasis>

function toVariantKey(kind: QueueItemKind, targetSemantics: string, modelId: string) {
  return `${kind}:${targetSemantics}:${modelId}`
}

function isCurrentPreparationEligible(capability: ForecastVariantCapability) {
  return capability.admissionState === 'ADMITTED'
    && capability.implementationState === 'SUPPORTED'
    && capability.historyEligibility === 'ELIGIBLE'
    && capability.currentForecastEligible
}

function isVerificationPreparationEligible(capability: ForecastVariantCapability) {
  return isCurrentPreparationEligible(capability)
}

function buildTargetPriority(preferredTargetBasis: ForecastTargetBasis) {
  const preferredTargetSemantics = preferredTargetBasis === 'POINT_IN_TIME'
    ? 'ROLLING_DAILY_POINT_IN_TIME'
    : preferredTargetBasis

  const remainingTargetSemantics = Object.keys(TARGET_BASIS_BY_SEMANTICS)
    .filter((targetSemantics) => targetSemantics !== preferredTargetSemantics)
    .sort((left, right) => {
      if (left === 'MONTHLY_AVERAGE') return -1
      if (right === 'MONTHLY_AVERAGE') return 1
      return left.localeCompare(right)
    }) as ForecastVariantCapability['identity']['targetSemantics'][]

  return [preferredTargetSemantics, ...remainingTargetSemantics] as ForecastVariantCapability['identity']['targetSemantics'][]
}

function compareQueueItems(
  left: QueueItem,
  right: QueueItem,
  preferredModelId: UserFacingForecastModelId,
  preferredTargetBasis: ForecastTargetBasis,
) {
  if (left.kind !== right.kind) {
    return left.kind === 'CURRENT' ? -1 : 1
  }

  const preferredTargetSemantics = preferredTargetBasis === 'POINT_IN_TIME'
    ? 'ROLLING_DAILY_POINT_IN_TIME'
    : preferredTargetBasis
  const leftIsExactPreferred = left.modelId === preferredModelId && left.targetSemantics === preferredTargetSemantics
  const rightIsExactPreferred = right.modelId === preferredModelId && right.targetSemantics === preferredTargetSemantics
  if (leftIsExactPreferred !== rightIsExactPreferred) {
    return leftIsExactPreferred ? -1 : 1
  }

  const targetPriority = buildTargetPriority(preferredTargetBasis)
  const leftTargetIndex = targetPriority.indexOf(left.targetSemantics)
  const rightTargetIndex = targetPriority.indexOf(right.targetSemantics)
  if (leftTargetIndex !== rightTargetIndex) {
    return leftTargetIndex - rightTargetIndex
  }

  const modelPriority = [preferredModelId, ...USER_FACING_FORECAST_MODELS.filter((modelId) => modelId !== preferredModelId)]
  const leftModelIndex = modelPriority.indexOf(left.modelId)
  const rightModelIndex = modelPriority.indexOf(right.modelId)
  return leftModelIndex - rightModelIndex
}

function buildQueuedItems(
  resolution: ForecastCapabilityResolution,
  state: SeriesState,
): QueueItem[] {
  const items: QueueItem[] = []

  for (const capability of resolution.capabilities) {
    const targetBasis = TARGET_BASIS_BY_SEMANTICS[capability.identity.targetSemantics]
    const currentKey = toVariantKey('CURRENT', capability.identity.targetSemantics, capability.identity.modelId)
    const verificationKey = toVariantKey('VERIFICATION', capability.identity.targetSemantics, capability.identity.modelId)

    if (
      capability.currentPreparedState !== 'READY'
      && isCurrentPreparationEligible(capability)
      && !state.failedReasons.has(currentKey)
    ) {
      items.push({
        key: currentKey,
        seriesId: resolution.sourceMetadata.seriesId,
        modelId: capability.identity.modelId,
        targetBasis,
        targetSemantics: capability.identity.targetSemantics,
        kind: 'CURRENT',
      })
    }

    if (
      capability.historicalPreparedState !== 'READY'
      && isVerificationPreparationEligible(capability)
      && !state.failedReasons.has(verificationKey)
    ) {
      items.push({
        key: verificationKey,
        seriesId: resolution.sourceMetadata.seriesId,
        modelId: capability.identity.modelId,
        targetBasis,
        targetSemantics: capability.identity.targetSemantics,
        kind: 'VERIFICATION',
      })
    }
  }

  return items.sort((left, right) => compareQueueItems(left, right, state.preferredModelId, state.preferredTargetBasis))
}

function resolveUnsupportedReason(capability: ForecastVariantCapability) {
  return capability.capabilityState
}

function buildVariantSnapshot(
  capability: ForecastVariantCapability,
  state: SeriesState,
): ProgressiveForecastVariantSnapshot {
  const targetBasis = TARGET_BASIS_BY_SEMANTICS[capability.identity.targetSemantics]
  const currentKey = toVariantKey('CURRENT', capability.identity.targetSemantics, capability.identity.modelId)
  const verificationKey = toVariantKey('VERIFICATION', capability.identity.targetSemantics, capability.identity.modelId)
  const queuedKeys = new Set(state.queuedItems.map((item) => item.key))

  const currentState: ProgressiveForecastPreparationState = capability.currentPreparedState === 'READY'
    ? 'READY'
    : state.failedReasons.has(currentKey)
      ? 'FAILED'
      : state.activeItemKey === currentKey
        ? 'PREPARING'
        : queuedKeys.has(currentKey)
          ? 'QUEUED'
          : isCurrentPreparationEligible(capability)
            ? 'QUEUED'
            : 'UNSUPPORTED'

  const verificationState: ProgressiveForecastPreparationState = capability.historicalPreparedState === 'READY'
    ? 'READY'
    : state.failedReasons.has(verificationKey)
      ? 'FAILED'
      : state.activeItemKey === verificationKey
        ? 'PREPARING'
        : queuedKeys.has(verificationKey)
          ? 'QUEUED'
          : isVerificationPreparationEligible(capability)
            ? 'QUEUED'
            : 'UNSUPPORTED'

  return {
    seriesId: capability.identity.seriesId,
    modelId: capability.identity.modelId,
    targetBasis,
    targetSemantics: capability.identity.targetSemantics,
    currentState,
    currentReason: currentState === 'FAILED'
      ? state.failedReasons.get(currentKey) ?? 'Preparation failed.'
      : currentState === 'UNSUPPORTED'
        ? resolveUnsupportedReason(capability)
        : null,
    verificationState,
    verificationReason: verificationState === 'FAILED'
      ? state.failedReasons.get(verificationKey) ?? 'Verification preparation failed.'
      : verificationState === 'UNSUPPORTED'
        ? resolveUnsupportedReason(capability)
        : null,
  }
}

function buildSnapshot(
  resolution: ForecastCapabilityResolution,
  state: SeriesState,
): ProgressiveForecastPreparationSnapshot {
  const variants = resolution.capabilities.map((capability) => buildVariantSnapshot(capability, state))
  const firstReadyCurrent = variants.find((variant) => variant.currentState === 'READY')

  return {
    seriesId: resolution.sourceMetadata.seriesId,
    variants,
    firstReadyCurrent: firstReadyCurrent
      ? {
          modelId: firstReadyCurrent.modelId,
          targetBasis: firstReadyCurrent.targetBasis,
          targetSemantics: firstReadyCurrent.targetSemantics,
        }
      : null,
    activeItem: state.activeItemKey
      ? (() => {
          const active = state.queuedItems.find((item) => item.key === state.activeItemKey)
          return active
            ? { modelId: active.modelId, targetBasis: active.targetBasis, kind: active.kind }
            : null
        })()
      : null,
    queuedCount: state.queuedItems.length,
    currentReadyCount: variants.filter((variant) => variant.currentState === 'READY').length,
    verificationReadyCount: variants.filter((variant) => variant.verificationState === 'READY').length,
  }
}

async function assertPreparationSucceeded(
  item: QueueItem,
  result: Awaited<ReturnType<typeof resolveBenchmarkCurrentForecast>> | Awaited<ReturnType<typeof resolveBenchmarkForecastVerification>>,
) {
  if (item.kind === 'CURRENT') {
    const persisted = result.status === 'AVAILABLE' && (result.cacheStatus === 'hit' || result.cacheStatus === 'miss')
    if (!persisted) {
      throw new Error(result.status === 'AVAILABLE' ? `Persistence status: ${result.cacheStatus}` : result.reason)
    }
    return
  }

  const persisted = result.status === 'AVAILABLE' && (result.cacheStatus === 'hit' || result.cacheStatus === 'miss')
  if (!persisted) {
    throw new Error(result.status === 'AVAILABLE' ? `Persistence status: ${result.cacheStatus}` : result.reason)
  }
}

export function createProgressiveForecastPreparationService(
  dependencies: Partial<ProgressiveForecastPreparationDependencies> = {},
) {
  const rollingDaily = createRollingDailyProductionOperationsService()
  const resolvedDependencies: ProgressiveForecastPreparationDependencies = {
    resolveCapabilities: dependencies.resolveCapabilities ?? resolveForecastCapabilitiesBySeriesId,
    prepareMonthlyCurrent: dependencies.prepareMonthlyCurrent ?? resolveBenchmarkCurrentForecast,
    prepareMonthlyHistorical: dependencies.prepareMonthlyHistorical ?? resolveBenchmarkForecastVerification,
    runRollingDaily: dependencies.runRollingDaily ?? ((request) => rollingDaily.run(request)),
  }

  const seriesStates = new Map<string, SeriesState>()
  let selectionOrdinal = 0
  let drainPromise: Promise<void> | null = null

  function nextSelectionOrdinal() {
    selectionOrdinal += 1
    return selectionOrdinal
  }

  function buildSelectionKeys(request: ProgressiveForecastPreparationRequest) {
    const targetSemantics = request.preferredTargetBasis === 'POINT_IN_TIME'
      ? 'ROLLING_DAILY_POINT_IN_TIME'
      : request.preferredTargetBasis

    return {
      currentSelectionKey: toVariantKey('CURRENT', targetSemantics, request.preferredModelId),
      verificationSelectionKey: toVariantKey('VERIFICATION', targetSemantics, request.preferredModelId),
    }
  }

  function reconcileQueuedItems(state: SeriesState, resolution: ForecastCapabilityResolution) {
    const activeItemKey = state.activeItemKey
    const rebuiltQueue = buildQueuedItems(resolution, state)

    state.queuedItems = activeItemKey
      ? [
          ...rebuiltQueue.filter((item) => item.key === activeItemKey),
          ...rebuiltQueue.filter((item) => item.key !== activeItemKey),
        ]
      : rebuiltQueue
  }

  function hasQueuedWork() {
    return Array.from(seriesStates.values()).some((state) => state.queuedItems.length > 0)
  }

  function compareQueueCandidates(left: QueueCandidate, right: QueueCandidate) {
    if (left.item.kind !== right.item.kind) {
      return left.item.kind === 'CURRENT' ? -1 : 1
    }

    if (left.state.selectionOrdinal !== right.state.selectionOrdinal) {
      return right.state.selectionOrdinal - left.state.selectionOrdinal
    }

    if (left.seriesId !== right.seriesId) {
      return left.seriesId.localeCompare(right.seriesId)
    }

    return compareQueueItems(left.item, right.item, left.state.preferredModelId, left.state.preferredTargetBasis)
  }

  function selectNextCandidate(): QueueCandidate | null {
    const candidates: QueueCandidate[] = []

    for (const [seriesId, state] of seriesStates.entries()) {
      const item = state.queuedItems[0]
      if (item) {
        candidates.push({ seriesId, state, item })
      }
    }

    if (candidates.length === 0) {
      return null
    }

    candidates.sort(compareQueueCandidates)
    return candidates[0] ?? null
  }

  function ensureDrainRunning() {
    if (drainPromise || !hasQueuedWork()) {
      return
    }

    drainPromise = (async () => {
      while (true) {
        const candidate = selectNextCandidate()
        if (!candidate) {
          return
        }

        const { seriesId, state, item } = candidate
        state.activeItemKey = item.key
        const freshResolution = await resolvedDependencies.resolveCapabilities(seriesId)

        try {
          await performItem(item, freshResolution)
          state.failedReasons.delete(item.key)
        } catch (error) {
          state.failedReasons.set(item.key, error instanceof Error ? error.message : 'Preparation failed.')
        }

        const updatedResolution = await resolvedDependencies.resolveCapabilities(seriesId)
        state.queuedItems = buildQueuedItems(updatedResolution, state).filter((queuedItem) => queuedItem.key !== item.key)
        state.activeItemKey = null
      }
    })().finally(() => {
      drainPromise = null
      if (hasQueuedWork()) {
        ensureDrainRunning()
      }
    })
  }

  function getSeriesState(seriesId: string, request: ProgressiveForecastPreparationRequest): SeriesState {
    const existing = seriesStates.get(seriesId)
    if (existing) {
      existing.preferredModelId = request.preferredModelId
      existing.preferredTargetBasis = request.preferredTargetBasis
      existing.selectionOrdinal = nextSelectionOrdinal()
      return existing
    }

    const created: SeriesState = {
      preferredModelId: request.preferredModelId,
      preferredTargetBasis: request.preferredTargetBasis,
      selectionOrdinal: nextSelectionOrdinal(),
      queuedItems: [],
      activeItemKey: null,
      failedReasons: new Map(),
    }
    seriesStates.set(seriesId, created)
    return created
  }

  async function performItem(item: QueueItem, resolution: ForecastCapabilityResolution) {
    const capability = resolution.capabilities.find((candidate) => (
      candidate.identity.targetSemantics === item.targetSemantics
      && candidate.identity.modelId === item.modelId
    ))
    if (!capability) {
      throw new Error('Exact capability was not resolved.')
    }

    if (item.targetBasis === 'POINT_IN_TIME') {
      const result = await resolvedDependencies.runRollingDaily({
        seriesId: item.seriesId,
        modelIds: [item.modelId],
      })
      const modelResult = result.results.find((candidate) => candidate.modelId === item.modelId)
      const failed = result.status === 'FAILED'
        || !modelResult
        || modelResult.status === 'FAILED'
        || modelResult.status === 'REBUILD_REQUIRED'

      if (failed) {
        throw new Error(modelResult?.error ?? 'Rolling Daily preparation failed.')
      }

      return
    }

    if (item.kind === 'CURRENT') {
      await assertPreparationSucceeded(item, await resolvedDependencies.prepareMonthlyCurrent({
        seriesId: item.seriesId,
        modelId: item.modelId,
        targetBasis: item.targetBasis,
        sourceFrequency: capability.sourceFrequency ?? undefined,
        targetCadence: capability.targetCadence ?? undefined,
      }))
      return
    }

    await assertPreparationSucceeded(item, await resolvedDependencies.prepareMonthlyHistorical({
      seriesId: item.seriesId,
      modelId: item.modelId,
      targetBasis: item.targetBasis,
      sourceFrequency: capability.sourceFrequency ?? undefined,
      targetCadence: capability.targetCadence ?? undefined,
    }))
  }

  return {
    async snapshotAndKickoff(
      request: ProgressiveForecastPreparationRequest,
    ): Promise<ProgressiveForecastPreparationSnapshot> {
      const resolution = await resolvedDependencies.resolveCapabilities(request.seriesId)
      const state = getSeriesState(request.seriesId, request)
      reconcileQueuedItems(state, resolution)
      ensureDrainRunning()

      return buildSnapshot(resolution, state)
    },
  }
}

export const progressiveForecastPreparationService = createProgressiveForecastPreparationService()
