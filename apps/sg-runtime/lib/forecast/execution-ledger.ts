import { randomUUID } from 'node:crypto'

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
export type ForecastPreparationExecutionMode = 'PRIMARY' | 'RECOVERY'
export type ForecastPreparationFailurePhase = 'SINGLE_FLIGHT' | 'COMPUTE' | 'PERSISTENCE' | 'FINALIZATION'
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
  executionMode: ForecastPreparationExecutionMode
  ownerToken: string
  leaseVersion: number
  leaseAcquiredAt: string
  leaseExpiresAt: string
  recoveredFromExecutionId: string | null
  ownerRequestId: string
  latestRequestId: string
  latestRole: ForecastPreparationExecutionRole
  waiterCount: number
  eventCount: number
  startedAt: string
  lastEventAt: string
  lastProgressAt: string
  completedAt: string | null
  computeStartedAt: string | null
  computeCompletedAt: string | null
  persistenceStartedAt: string | null
  persistenceCompletedAt: string | null
  failurePhase: ForecastPreparationFailurePhase | null
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
  executionMode?: ForecastPreparationExecutionMode
  ownerToken?: string
  leaseVersion?: number
  leaseAcquiredAt?: string
  leaseExpiresAt?: string
  recoveredFromExecutionId?: string | null
}

export type ForecastPreparationExecutionLedgerStore = {
  readExecution(executionId: string): Promise<ForecastPreparationExecutionRecord | null>
  writeExecution(record: ForecastPreparationExecutionRecord): Promise<void>
}

export type ForecastPreparationExecutionLedger = {
  recordEvent(input: ForecastPreparationExecutionLedgerEventInput): Promise<void>
  readExecution(executionId: string): Promise<ForecastPreparationExecutionRecord | null>
}

export type ForecastPreparationExecutionContext = {
  executionId: string
  ownerToken: string
  operationFamily: ForecastPreparationOperationFamily
  logicalArtifactKey: string
  ownerRequestId: string
  executionMode: ForecastPreparationExecutionMode
  leaseVersion: number
  leaseAcquiredAt: string
  leaseExpiresAt: string
  recoveredFromExecutionId: string | null
}

export type ForecastPreparationExecutionContextRegistry = {
  getOrCreateContext(input: {
    operationFamily: ForecastPreparationOperationFamily
    logicalArtifactKey: string
    ownerRequestId: string
    executionMode?: ForecastPreparationExecutionMode
    recoveredFromExecutionId?: string | null
    observedAt?: string
  }): ForecastPreparationExecutionContext
  releaseContext(executionId: string): void
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

function addLeaseWindow(observedAt: string, leaseWindowMs: number) {
  return new Date(new Date(observedAt).getTime() + leaseWindowMs).toISOString()
}

function buildExecutionContextOwnerKey(input: {
  operationFamily: ForecastPreparationOperationFamily
  logicalArtifactKey: string
  ownerRequestId: string
}) {
  return `${input.operationFamily}:${input.logicalArtifactKey}:${input.ownerRequestId}`
}

const PROGRESS_EVENT_TYPES: ForecastPreparationExecutionEventType[] = [
  'single_flight_owner_acquired',
  'compute_started',
  'compute_completed',
  'persistence_started',
  'persistence_completed',
  'persistence_failed',
  'execution_completed',
  'execution_failed',
]

function isProgressEvent(eventType: ForecastPreparationExecutionEventType) {
  return PROGRESS_EVENT_TYPES.includes(eventType)
}

function deriveFailurePhase(
  current: ForecastPreparationExecutionRecord | null,
  eventType: ForecastPreparationExecutionEventType,
): ForecastPreparationFailurePhase {
  if (eventType === 'single_flight_owner_failed' || eventType === 'single_flight_waiter_failed') {
    return 'SINGLE_FLIGHT'
  }

  if (eventType === 'persistence_failed') {
    return 'PERSISTENCE'
  }

  if (current?.failurePhase) {
    return current.failurePhase
  }

  if (current?.persistenceStartedAt && current.persistenceCompletedAt === null) {
    return 'PERSISTENCE'
  }

  if (current?.computeStartedAt) {
    return 'COMPUTE'
  }

  return 'FINALIZATION'
}

function asEvents(value: unknown): ForecastPreparationExecutionEventRecord[] {
  return Array.isArray(value) ? value as ForecastPreparationExecutionEventRecord[] : []
}

function requireLogicalIdentityField(fieldName: string, value: string | null): string {
  if (value === null || value === '') {
    throw new Error(`Forecast preparation execution ledger requires logical identity field: ${fieldName}`)
  }

  return value
}

function extractCommonIdentity(identity: ForecastPreparationLogicalArtifactIdentity): CommonLogicalIdentity {
  return {
    artifactScope: requireLogicalIdentityField('artifactScope', identity.artifactScope) as ForecastArtifactScope,
    trainingWindowPolicyId: requireLogicalIdentityField('trainingWindowPolicyId', identity.trainingWindowPolicyId) as ForecastTrainingWindowPolicyId,
    seriesId: requireLogicalIdentityField('seriesId', identity.seriesId),
    targetBasis: requireLogicalIdentityField('targetBasis', identity.targetBasis) as ForecastTargetBasis,
    targetSemantics: requireLogicalIdentityField('targetSemantics', identity.targetSemantics) as ForecastTargetSemantics,
    methodId: requireLogicalIdentityField('methodId', identity.methodId),
    methodVersion: requireLogicalIdentityField('methodVersion', identity.methodVersion),
    modelId: requireLogicalIdentityField('modelId', identity.modelId),
    inputSource: requireLogicalIdentityField('inputSource', identity.inputSource),
    historyFingerprint: requireLogicalIdentityField('historyFingerprint', identity.historyFingerprint),
    sourceFrequency: requireLogicalIdentityField('sourceFrequency', identity.sourceFrequency),
    targetCadence: requireLogicalIdentityField('targetCadence', identity.targetCadence),
    frequencyIdentity: requireLogicalIdentityField('frequencyIdentity', identity.frequencyIdentity),
  }
}

export function buildForecastPreparationExecutionId(
  operationFamily: ForecastPreparationOperationFamily,
  ownerRequestId: string,
) {
  return `${operationFamily}:${ownerRequestId}`
}

export function createForecastPreparationExecutionContextRegistry(
  dependencies: { leaseWindowMs?: number } = {},
): ForecastPreparationExecutionContextRegistry {
  const leaseWindowMs = dependencies.leaseWindowMs ?? 5 * 60 * 1000
  const contextByOwnerKey = new Map<string, ForecastPreparationExecutionContext>()
  const ownerKeyByExecutionId = new Map<string, string>()

  return {
    getOrCreateContext(input) {
      const ownerKey = buildExecutionContextOwnerKey(input)
      const existing = contextByOwnerKey.get(ownerKey)
      if (existing) {
        return existing
      }

      const leaseAcquiredAt = input.observedAt ?? nowIso()
      const context: ForecastPreparationExecutionContext = {
        executionId: randomUUID(),
        ownerToken: randomUUID(),
        operationFamily: input.operationFamily,
        logicalArtifactKey: input.logicalArtifactKey,
        ownerRequestId: input.ownerRequestId,
        executionMode: input.executionMode ?? 'PRIMARY',
        leaseVersion: 1,
        leaseAcquiredAt,
        leaseExpiresAt: addLeaseWindow(leaseAcquiredAt, leaseWindowMs),
        recoveredFromExecutionId: input.recoveredFromExecutionId ?? null,
      }

      contextByOwnerKey.set(ownerKey, context)
      ownerKeyByExecutionId.set(context.executionId, ownerKey)
      return context
    },
    releaseContext(executionId) {
      const ownerKey = ownerKeyByExecutionId.get(executionId)
      if (!ownerKey) {
        return
      }

      ownerKeyByExecutionId.delete(executionId)
      contextByOwnerKey.delete(ownerKey)
    },
  }
}

export function reduceForecastPreparationExecution(
  current: ForecastPreparationExecutionRecord | null,
  input: ForecastPreparationExecutionLedgerEventInput,
): ForecastPreparationExecutionRecord {
  if (
    current !== null &&
    current.executionStatus !== 'STARTED' &&
    input.eventType !== 'single_flight_entry_released'
  ) {
    return current
  }

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

  const next: ForecastPreparationExecutionRecord = current
    ? {
        ...current,
        events: [...current.events],
      }
    : {
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
        executionMode: input.executionMode ?? 'PRIMARY',
        ownerToken: input.ownerToken ?? input.ownerRequestId,
        leaseVersion: input.leaseVersion ?? 1,
        leaseAcquiredAt: input.leaseAcquiredAt ?? observedAt,
        leaseExpiresAt: input.leaseExpiresAt ?? observedAt,
        recoveredFromExecutionId: input.recoveredFromExecutionId ?? null,
        ownerRequestId: input.ownerRequestId,
        latestRequestId: input.requestId,
        latestRole: input.role,
        waiterCount: 0,
        eventCount: 0,
        startedAt: observedAt,
        lastEventAt: observedAt,
        lastProgressAt: observedAt,
        completedAt: null,
        computeStartedAt: null,
        computeCompletedAt: null,
        persistenceStartedAt: null,
        persistenceCompletedAt: null,
        failurePhase: null,
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
  next.executionMode = input.executionMode ?? next.executionMode
  next.ownerToken = input.ownerToken ?? next.ownerToken
  next.leaseVersion = input.leaseVersion ?? next.leaseVersion
  next.leaseAcquiredAt = input.leaseAcquiredAt ?? next.leaseAcquiredAt
  next.leaseExpiresAt = input.leaseExpiresAt ?? next.leaseExpiresAt
  next.recoveredFromExecutionId = input.recoveredFromExecutionId ?? next.recoveredFromExecutionId

  if (isProgressEvent(input.eventType)) {
    next.lastProgressAt = observedAt
  }

  if (input.eventType === 'single_flight_waiter_joined' && input.requestId !== input.ownerRequestId) {
    next.waiterCount += 1
  }

  if (input.eventType === 'single_flight_owner_failed' || input.eventType === 'single_flight_waiter_failed') {
    next.failurePhase = 'SINGLE_FLIGHT'
    next.failureReason = input.error ?? next.failureReason
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
    next.failurePhase = 'PERSISTENCE'
    next.failureReason = input.error ?? next.failureReason
  }

  if (input.eventType === 'execution_completed') {
    next.executionStatus = 'COMPLETED'
    next.completedAt = observedAt
    next.resultStatus = input.resultStatus ?? next.resultStatus
    next.cacheStatus = input.cacheStatus ?? next.cacheStatus
    next.failurePhase = null
    next.failureReason = null
  }

  if (input.eventType === 'execution_failed') {
    next.executionStatus = 'FAILED'
    next.completedAt = observedAt
    next.resultStatus = input.resultStatus ?? next.resultStatus
    next.cacheStatus = input.cacheStatus ?? next.cacheStatus
    next.failurePhase = deriveFailurePhase(current, input.eventType)
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
  executionMode: string
  ownerToken: string
  leaseVersion: number
  leaseAcquiredAt: Date
  leaseExpiresAt: Date
  recoveredFromExecutionId: string | null
  ownerRequestId: string
  latestRequestId: string
  latestRole: string
  waiterCount: number
  eventCount: number
  startedAt: Date
  lastEventAt: Date
  lastProgressAt: Date
  completedAt: Date | null
  computeStartedAt: Date | null
  computeCompletedAt: Date | null
  persistenceStartedAt: Date | null
  persistenceCompletedAt: Date | null
  failurePhase: string | null
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
    executionMode: record.executionMode as ForecastPreparationExecutionMode,
    ownerToken: record.ownerToken,
    leaseVersion: record.leaseVersion,
    leaseAcquiredAt: record.leaseAcquiredAt.toISOString(),
    leaseExpiresAt: record.leaseExpiresAt.toISOString(),
    recoveredFromExecutionId: record.recoveredFromExecutionId,
    ownerRequestId: record.ownerRequestId,
    latestRequestId: record.latestRequestId,
    latestRole: record.latestRole as ForecastPreparationExecutionRole,
    waiterCount: record.waiterCount,
    eventCount: record.eventCount,
    startedAt: record.startedAt.toISOString(),
    lastEventAt: record.lastEventAt.toISOString(),
    lastProgressAt: record.lastProgressAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
    computeStartedAt: record.computeStartedAt?.toISOString() ?? null,
    computeCompletedAt: record.computeCompletedAt?.toISOString() ?? null,
    persistenceStartedAt: record.persistenceStartedAt?.toISOString() ?? null,
    persistenceCompletedAt: record.persistenceCompletedAt?.toISOString() ?? null,
    failurePhase: record.failurePhase as ForecastPreparationFailurePhase | null,
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
          executionMode: record.executionMode,
          ownerToken: record.ownerToken,
          leaseVersion: record.leaseVersion,
          leaseAcquiredAt: new Date(record.leaseAcquiredAt),
          leaseExpiresAt: new Date(record.leaseExpiresAt),
          recoveredFromExecutionId: record.recoveredFromExecutionId,
          ownerRequestId: record.ownerRequestId,
          latestRequestId: record.latestRequestId,
          latestRole: record.latestRole,
          waiterCount: record.waiterCount,
          eventCount: record.eventCount,
          startedAt: new Date(record.startedAt),
          lastEventAt: new Date(record.lastEventAt),
          lastProgressAt: new Date(record.lastProgressAt),
          completedAt: record.completedAt ? new Date(record.completedAt) : null,
          computeStartedAt: record.computeStartedAt ? new Date(record.computeStartedAt) : null,
          computeCompletedAt: record.computeCompletedAt ? new Date(record.computeCompletedAt) : null,
          persistenceStartedAt: record.persistenceStartedAt ? new Date(record.persistenceStartedAt) : null,
          persistenceCompletedAt: record.persistenceCompletedAt ? new Date(record.persistenceCompletedAt) : null,
          failurePhase: record.failurePhase,
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
          executionMode: record.executionMode,
          ownerToken: record.ownerToken,
          leaseVersion: record.leaseVersion,
          leaseAcquiredAt: new Date(record.leaseAcquiredAt),
          leaseExpiresAt: new Date(record.leaseExpiresAt),
          recoveredFromExecutionId: record.recoveredFromExecutionId,
          ownerRequestId: record.ownerRequestId,
          latestRequestId: record.latestRequestId,
          latestRole: record.latestRole,
          waiterCount: record.waiterCount,
          eventCount: record.eventCount,
          startedAt: new Date(record.startedAt),
          lastEventAt: new Date(record.lastEventAt),
          lastProgressAt: new Date(record.lastProgressAt),
          completedAt: record.completedAt ? new Date(record.completedAt) : null,
          computeStartedAt: record.computeStartedAt ? new Date(record.computeStartedAt) : null,
          computeCompletedAt: record.computeCompletedAt ? new Date(record.computeCompletedAt) : null,
          persistenceStartedAt: record.persistenceStartedAt ? new Date(record.persistenceStartedAt) : null,
          persistenceCompletedAt: record.persistenceCompletedAt ? new Date(record.persistenceCompletedAt) : null,
          failurePhase: record.failurePhase,
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