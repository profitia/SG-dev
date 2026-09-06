import { Prisma } from '@/generated/market-data-client'
import type { ForecastTargetBasis } from '@/lib/forecast/contracts'
import type { CurrentLogicalArtifactIdentity } from '@/lib/forecast/current-single-flight'
import type {
  ForecastArtifactScope,
  ForecastTargetSemantics,
  ForecastTrainingWindowPolicyId,
} from '@/lib/forecast/identity'
import { getMarketDataPrisma } from '@/lib/market-data/client'
import type { VerificationLogicalArtifactIdentity } from '@/lib/forecast/verification-single-flight'

export type ForecastPreparationOperationFamily = 'CURRENT' | 'VERIFICATION'
export type ForecastPreparationExecutionStatus = 'STARTED' | 'COMPLETED' | 'FAILED'
export type ForecastPreparationExecutionRole = 'OWNER' | 'WAITER'
export type ForecastPreparationExecutionEventType =
  | 'single_flight_lookup'
  | 'single_flight_owner_acquired'
  | 'single_flight_waiter_joined'
  | 'single_flight_owner_completed'
  | 'single_flight_owner_failed'
  | 'single_flight_waiter_completed'
  | 'single_flight_waiter_failed'
  | 'single_flight_entry_released'
  | 'compute_started'
  | 'compute_completed'
  | 'persistence_started'
  | 'persistence_completed'
  | 'persistence_failed'
  | 'execution_completed'
  | 'execution_failed'

export type ForecastPreparationLogicalArtifactIdentity =
  | CurrentLogicalArtifactIdentity
  | VerificationLogicalArtifactIdentity

export type ForecastPreparationExecutionEventRecord = {
  sequence: number
  eventType: ForecastPreparationExecutionEventType
  requestId: string
  ownerRequestId: string
  role: ForecastPreparationExecutionRole
  observedAt: string
  durationMs: number | null
  error: string | null
  resultStatus: string | null
  cacheStatus: string | null
  activeSingleFlightEntries: number | null
  artifactWrites: number | null
  pointWrites: number | null
  verificationRecordWrites: number | null
  writeFailures: number | null
  payload: Record<string, unknown> | null
}

export type ForecastPreparationExecutionRecord = {
  executionId: string
  logicalArtifactKey: string
  operationFamily: ForecastPreparationOperationFamily
  executionStatus: ForecastPreparationExecutionStatus
  resultStatus: string | null
  cacheStatus: string | null
  artifactScope: ForecastArtifactScope
  trainingWindowPolicyId: ForecastTrainingWindowPolicyId
  seriesId: string
  targetBasis: ForecastTargetBasis
  targetSemantics: ForecastTargetSemantics
  methodId: string
  methodVersion: string
  modelId: string
  inputSource: string
  historyFingerprint: string
  sourceFrequency: string
  targetCadence: string
  frequencyIdentity: string
  ownerRequestId: string
  latestRequestId: string
  latestRole: ForecastPreparationExecutionRole
  waiterCount: number
  eventCount: number
  startedAt: string
  lastEventAt: string
  completedAt: string | null
  computeStartedAt: string | null
  computeCompletedAt: string | null
  persistenceStartedAt: string | null
  persistenceCompletedAt: string | null
  failureReason: string | null
  logicalArtifactIdentity: ForecastPreparationLogicalArtifactIdentity
  events: ForecastPreparationExecutionEventRecord[]
}

export type ForecastPreparationExecutionLedgerEventInput = {
  executionId: string
  logicalArtifactKey: string
  operationFamily: ForecastPreparationOperationFamily
  logicalArtifactIdentity: ForecastPreparationLogicalArtifactIdentity
  requestId: string
  ownerRequestId: string
  role: ForecastPreparationExecutionRole
  eventType: ForecastPreparationExecutionEventType
  observedAt?: string
  durationMs?: number | null
  error?: string | null
  resultStatus?: string | null
  cacheStatus?: string | null
  activeSingleFlightEntries?: number | null
  artifactWrites?: number | null
  pointWrites?: number | null
  verificationRecordWrites?: number | null
  writeFailures?: number | null
  payload?: Record<string, unknown> | null
}

export type ForecastPreparationExecutionLedgerStore = {
  readExecution(executionId: string): Promise<ForecastPreparationExecutionRecord | null>
  writeExecution(record: ForecastPreparationExecutionRecord): Promise<void>
}

export type ForecastPreparationExecutionLedger = {
  recordEvent(input: ForecastPreparationExecutionLedgerEventInput): Promise<void>
  readExecution(executionId: string): Promise<ForecastPreparationExecutionRecord | null>
}

type CommonLogicalIdentity = {
  artifactScope: ForecastArtifactScope
  trainingWindowPolicyId: ForecastTrainingWindowPolicyId
  seriesId: string
  targetBasis: ForecastTargetBasis
  targetSemantics: ForecastTargetSemantics
  methodId: string
  methodVersion: string
  modelId: string
  inputSource: string
  historyFingerprint: string
  sourceFrequency: string
  targetCadence: string
  frequencyIdentity: string
}

function nowIso() {
  return new Date().toISOString()
}

function asEvents(value: unknown): ForecastPreparationExecutionEventRecord[] {
  return Array.isArray(value) ? value as ForecastPreparationExecutionEventRecord[] : []
}

function extractCommonIdentity(identity: ForecastPreparationLogicalArtifactIdentity): CommonLogicalIdentity {
  return {
    artifactScope: identity.artifactScope,
    trainingWindowPolicyId: identity.trainingWindowPolicyId,
    seriesId: identity.seriesId,
    targetBasis: identity.targetBasis,
    targetSemantics: identity.targetSemantics,
    methodId: identity.methodId,
    methodVersion: identity.methodVersion,
    modelId: identity.modelId,
    inputSource: identity.inputSource,
    historyFingerprint: identity.historyFingerprint,
    sourceFrequency: identity.sourceFrequency,
    targetCadence: identity.targetCadence,
    frequencyIdentity: identity.frequencyIdentity,
  }
}

export function buildForecastPreparationExecutionId(
  operationFamily: ForecastPreparationOperationFamily,
  ownerRequestId: string,
) {
  return `${operationFamily}:${ownerRequestId}`
}

export function reduceForecastPreparationExecution(
  current: ForecastPreparationExecutionRecord | null,
  input: ForecastPreparationExecutionLedgerEventInput,
): ForecastPreparationExecutionRecord {
  const observedAt = input.observedAt ?? nowIso()
  const commonIdentity = extractCommonIdentity(input.logicalArtifactIdentity)
  const event: ForecastPreparationExecutionEventRecord = {
    sequence: (current?.eventCount ?? 0) + 1,
    eventType: input.eventType,
    requestId: input.requestId,
    ownerRequestId: input.ownerRequestId,
    role: input.role,
    observedAt,
    durationMs: input.durationMs ?? null,
    error: input.error ?? null,
    resultStatus: input.resultStatus ?? null,
    cacheStatus: input.cacheStatus ?? null,
    activeSingleFlightEntries: input.activeSingleFlightEntries ?? null,
    artifactWrites: input.artifactWrites ?? null,
    pointWrites: input.pointWrites ?? null,
    verificationRecordWrites: input.verificationRecordWrites ?? null,
    writeFailures: input.writeFailures ?? null,
    payload: input.payload ?? null,
  }

  const next: ForecastPreparationExecutionRecord = current ?? {
    executionId: input.executionId,
    logicalArtifactKey: input.logicalArtifactKey,
    operationFamily: input.operationFamily,
    executionStatus: 'STARTED',
    resultStatus: null,
    cacheStatus: null,
    artifactScope: commonIdentity.artifactScope,
    trainingWindowPolicyId: commonIdentity.trainingWindowPolicyId,
    seriesId: commonIdentity.seriesId,
    targetBasis: commonIdentity.targetBasis,
    targetSemantics: commonIdentity.targetSemantics,
    methodId: commonIdentity.methodId,
    methodVersion: commonIdentity.methodVersion,
    modelId: commonIdentity.modelId,
    inputSource: commonIdentity.inputSource,
    historyFingerprint: commonIdentity.historyFingerprint,
    sourceFrequency: commonIdentity.sourceFrequency,
    targetCadence: commonIdentity.targetCadence,
    frequencyIdentity: commonIdentity.frequencyIdentity,
    ownerRequestId: input.ownerRequestId,
    latestRequestId: input.requestId,
    latestRole: input.role,
    waiterCount: 0,
    eventCount: 0,
    startedAt: observedAt,
    lastEventAt: observedAt,
    completedAt: null,
    computeStartedAt: null,
    computeCompletedAt: null,
    persistenceStartedAt: null,
    persistenceCompletedAt: null,
    failureReason: null,
    logicalArtifactIdentity: input.logicalArtifactIdentity,
    events: [],
  }

  next.logicalArtifactKey = input.logicalArtifactKey
  next.logicalArtifactIdentity = input.logicalArtifactIdentity
  next.latestRequestId = input.requestId
  next.latestRole = input.role
  next.lastEventAt = observedAt
  next.eventCount = event.sequence
  next.events = [...next.events, event]

  if (input.eventType === 'single_flight_waiter_joined' && input.requestId !== input.ownerRequestId) {
    next.waiterCount += 1
  }

  if (input.eventType === 'compute_started' && next.computeStartedAt === null) {
    next.computeStartedAt = observedAt
  }

  if (input.eventType === 'compute_completed') {
    next.computeCompletedAt = observedAt
    next.resultStatus = input.resultStatus ?? next.resultStatus
  }

  if (input.eventType === 'persistence_started' && next.persistenceStartedAt === null) {
    next.persistenceStartedAt = observedAt
  }

  if (input.eventType === 'persistence_completed' || input.eventType === 'persistence_failed') {
    next.persistenceCompletedAt = observedAt
  }

  if (input.eventType === 'persistence_failed') {
    next.failureReason = input.error ?? next.failureReason
  }

  if (input.eventType === 'execution_completed') {
    next.executionStatus = 'COMPLETED'
    next.completedAt = observedAt
    next.resultStatus = input.resultStatus ?? next.resultStatus
    next.cacheStatus = input.cacheStatus ?? next.cacheStatus
    next.failureReason = null
  }

  if (input.eventType === 'execution_failed') {
    next.executionStatus = 'FAILED'
    next.completedAt = observedAt
    next.resultStatus = input.resultStatus ?? next.resultStatus
    next.cacheStatus = input.cacheStatus ?? next.cacheStatus
    next.failureReason = input.error ?? next.failureReason
  }

  return next
}

function createNoopStore(): ForecastPreparationExecutionLedgerStore {
  return {
    async readExecution() {
      return null
    },
    async writeExecution() {},
  }
}

function mapStoredExecutionRecord(record: {
  executionId: string
  logicalArtifactKey: string
  operationFamily: string
  executionStatus: string
  resultStatus: string | null
  cacheStatus: string | null
  artifactScope: string
  trainingWindowPolicyId: string
  seriesId: string
  targetBasis: ForecastTargetBasis
  targetSemantics: string
  methodId: string
  methodVersion: string
  modelId: string
  inputSource: string
  historyFingerprint: string
  sourceFrequency: string
  targetCadence: string
  frequencyIdentity: string
  ownerRequestId: string
  latestRequestId: string
  latestRole: string
  waiterCount: number
  eventCount: number
  startedAt: Date
  lastEventAt: Date
  completedAt: Date | null
  computeStartedAt: Date | null
  computeCompletedAt: Date | null
  persistenceStartedAt: Date | null
  persistenceCompletedAt: Date | null
  failureReason: string | null
  logicalArtifactIdentityJson: Prisma.JsonValue
  eventsJson: Prisma.JsonValue
}): ForecastPreparationExecutionRecord {
  return {
    executionId: record.executionId,
    logicalArtifactKey: record.logicalArtifactKey,
    operationFamily: record.operationFamily as ForecastPreparationOperationFamily,
    executionStatus: record.executionStatus as ForecastPreparationExecutionStatus,
    resultStatus: record.resultStatus,
    cacheStatus: record.cacheStatus,
    artifactScope: record.artifactScope as ForecastArtifactScope,
    trainingWindowPolicyId: record.trainingWindowPolicyId as ForecastTrainingWindowPolicyId,
    seriesId: record.seriesId,
    targetBasis: record.targetBasis,
    targetSemantics: record.targetSemantics as ForecastTargetSemantics,
    methodId: record.methodId,
    methodVersion: record.methodVersion,
    modelId: record.modelId,
    inputSource: record.inputSource,
    historyFingerprint: record.historyFingerprint,
    sourceFrequency: record.sourceFrequency,
    targetCadence: record.targetCadence,
    frequencyIdentity: record.frequencyIdentity,
    ownerRequestId: record.ownerRequestId,
    latestRequestId: record.latestRequestId,
    latestRole: record.latestRole as ForecastPreparationExecutionRole,
    waiterCount: record.waiterCount,
    eventCount: record.eventCount,
    startedAt: record.startedAt.toISOString(),
    lastEventAt: record.lastEventAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
    computeStartedAt: record.computeStartedAt?.toISOString() ?? null,
    computeCompletedAt: record.computeCompletedAt?.toISOString() ?? null,
    persistenceStartedAt: record.persistenceStartedAt?.toISOString() ?? null,
    persistenceCompletedAt: record.persistenceCompletedAt?.toISOString() ?? null,
    failureReason: record.failureReason,
    logicalArtifactIdentity: record.logicalArtifactIdentityJson as ForecastPreparationLogicalArtifactIdentity,
    events: asEvents(record.eventsJson),
  }
}

function createPrismaStore(): ForecastPreparationExecutionLedgerStore {
  const prisma = getMarketDataPrisma()
  if (!prisma) {
    return createNoopStore()
  }

  return {
    async readExecution(executionId) {
      const record = await prisma.forecastPreparationExecutionLedger.findUnique({
        where: { executionId },
      })

      return record ? mapStoredExecutionRecord(record) : null
    },

    async writeExecution(record) {
      await prisma.forecastPreparationExecutionLedger.upsert({
        where: { executionId: record.executionId },
        create: {
          executionId: record.executionId,
          logicalArtifactKey: record.logicalArtifactKey,
          operationFamily: record.operationFamily,
          executionStatus: record.executionStatus,
          resultStatus: record.resultStatus,
          cacheStatus: record.cacheStatus,
          artifactScope: record.artifactScope,
          trainingWindowPolicyId: record.trainingWindowPolicyId,
          seriesId: record.seriesId,
          targetBasis: record.targetBasis,
          targetSemantics: record.targetSemantics,
          methodId: record.methodId,
          methodVersion: record.methodVersion,
          modelId: record.modelId,
          inputSource: record.inputSource,
          historyFingerprint: record.historyFingerprint,
          sourceFrequency: record.sourceFrequency,
          targetCadence: record.targetCadence,
          frequencyIdentity: record.frequencyIdentity,
          ownerRequestId: record.ownerRequestId,
          latestRequestId: record.latestRequestId,
          latestRole: record.latestRole,
          waiterCount: record.waiterCount,
          eventCount: record.eventCount,
          startedAt: new Date(record.startedAt),
          lastEventAt: new Date(record.lastEventAt),
          completedAt: record.completedAt ? new Date(record.completedAt) : null,
          computeStartedAt: record.computeStartedAt ? new Date(record.computeStartedAt) : null,
          computeCompletedAt: record.computeCompletedAt ? new Date(record.computeCompletedAt) : null,
          persistenceStartedAt: record.persistenceStartedAt ? new Date(record.persistenceStartedAt) : null,
          persistenceCompletedAt: record.persistenceCompletedAt ? new Date(record.persistenceCompletedAt) : null,
          failureReason: record.failureReason,
          logicalArtifactIdentityJson: record.logicalArtifactIdentity as Prisma.InputJsonValue,
          eventsJson: record.events as Prisma.InputJsonValue,
        },
        update: {
          logicalArtifactKey: record.logicalArtifactKey,
          operationFamily: record.operationFamily,
          executionStatus: record.executionStatus,
          resultStatus: record.resultStatus,
          cacheStatus: record.cacheStatus,
          artifactScope: record.artifactScope,
          trainingWindowPolicyId: record.trainingWindowPolicyId,
          seriesId: record.seriesId,
          targetBasis: record.targetBasis,
          targetSemantics: record.targetSemantics,
          methodId: record.methodId,
          methodVersion: record.methodVersion,
          modelId: record.modelId,
          inputSource: record.inputSource,
          historyFingerprint: record.historyFingerprint,
          sourceFrequency: record.sourceFrequency,
          targetCadence: record.targetCadence,
          frequencyIdentity: record.frequencyIdentity,
          ownerRequestId: record.ownerRequestId,
          latestRequestId: record.latestRequestId,
          latestRole: record.latestRole,
          waiterCount: record.waiterCount,
          eventCount: record.eventCount,
          startedAt: new Date(record.startedAt),
          lastEventAt: new Date(record.lastEventAt),
          completedAt: record.completedAt ? new Date(record.completedAt) : null,
          computeStartedAt: record.computeStartedAt ? new Date(record.computeStartedAt) : null,
          computeCompletedAt: record.computeCompletedAt ? new Date(record.computeCompletedAt) : null,
          persistenceStartedAt: record.persistenceStartedAt ? new Date(record.persistenceStartedAt) : null,
          persistenceCompletedAt: record.persistenceCompletedAt ? new Date(record.persistenceCompletedAt) : null,
          failureReason: record.failureReason,
          logicalArtifactIdentityJson: record.logicalArtifactIdentity as Prisma.InputJsonValue,
          eventsJson: record.events as Prisma.InputJsonValue,
        },
      })
    },
  }
}

export function createForecastPreparationExecutionLedger(
  dependencies: { store?: ForecastPreparationExecutionLedgerStore } = {},
): ForecastPreparationExecutionLedger {
  const store = dependencies.store ?? createPrismaStore()
  const pendingByExecutionId = new Map<string, Promise<void>>()

  async function runSerial(executionId: string, work: () => Promise<void>) {
    const previous = pendingByExecutionId.get(executionId) ?? Promise.resolve()
    const next = previous.catch(() => undefined).then(work)

    pendingByExecutionId.set(executionId, next)

    try {
      await next
    } finally {
      if (pendingByExecutionId.get(executionId) === next) {
        pendingByExecutionId.delete(executionId)
      }
    }
  }

  return {
    async recordEvent(input) {
      await runSerial(input.executionId, async () => {
        const current = await store.readExecution(input.executionId)
        const next = reduceForecastPreparationExecution(current, input)
        await store.writeExecution(next)
      })
    },
    readExecution(executionId) {
      return store.readExecution(executionId)
    },
  }
}

export function createDefaultForecastPreparationExecutionLedger() {
  return createForecastPreparationExecutionLedger()
}

export function createNoopForecastPreparationExecutionLedger(): ForecastPreparationExecutionLedger {
  return createForecastPreparationExecutionLedger({ store: createNoopStore() })
}