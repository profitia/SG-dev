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
export type ForecastPreparationAttemptKind = 'PRIMARY' | 'RECOVERY'
export type ForecastPreparationExecutionMode = 'PRE_STAGE3_PREPARATION' | 'RECOVERY_RESUME'
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
  attemptKind: ForecastPreparationAttemptKind
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
  attemptKind?: ForecastPreparationAttemptKind
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
  attemptKind: ForecastPreparationAttemptKind
  executionMode: ForecastPreparationExecutionMode
  leaseVersion: number
  leaseAcquiredAt: string
  leaseExpiresAt: string
  recoveredFromExecutionId: string | null
}

export type ForecastPreparationOwnedExecutionContext = ForecastPreparationExecutionContext & {
  role: 'OWNER' | 'RECOVERY_OWNER'
  requestId: string
}

export type ForecastPreparationAdmissionResult =
  | {
      role: 'OWNER' | 'RECOVERY_OWNER'
      ownership: ForecastPreparationOwnedExecutionContext
    }
  | {
      role: 'WAITER'
      executionId: string
      ownerRequestId: string
      ownerToken: string
      leaseVersion: number
      leaseExpiresAt: string
      recoveredFromExecutionId: string | null
    }

export type ForecastPreparationAdmissionInput = {
  operationFamily: ForecastPreparationOperationFamily
  logicalArtifactKey: string
  logicalArtifactIdentity: ForecastPreparationLogicalArtifactIdentity
  requestId: string
  ownerRequestId: string
  observedAt?: string
}

export type ForecastPreparationLeaseRenewalInput = {
  executionId: string
  logicalArtifactKey: string
  ownerToken: string
  leaseVersion: number
  requestId: string
  observedAt?: string
}

export type ForecastPreparationMarkFailedInput = {
  executionId: string
  logicalArtifactKey: string
  ownerToken: string
  leaseVersion: number
  requestId: string
  ownerRequestId: string
  failurePhase: ForecastPreparationFailurePhase
  failureReason: string
  resultStatus?: string | null
  cacheStatus?: string | null
  observedAt?: string
}

export type ForecastPreparationMarkCompletedInput = {
  executionId: string
  logicalArtifactKey: string
  ownerToken: string
  leaseVersion: number
  requestId: string
  ownerRequestId: string
  resultStatus?: string | null
  cacheStatus?: string | null
  observedAt?: string
}

export type ForecastPreparationExecutionAdmission = {
  leaseDurationMs: number
  acquireExecution(input: ForecastPreparationAdmissionInput): Promise<ForecastPreparationAdmissionResult>
  renewLease(input: ForecastPreparationLeaseRenewalInput): Promise<ForecastPreparationOwnedExecutionContext>
  markExecutionCompleted(input: ForecastPreparationMarkCompletedInput): Promise<void>
  markExecutionFailed(input: ForecastPreparationMarkFailedInput): Promise<void>
  readLatestExecutionForLogicalArtifact(logicalArtifactKey: string): Promise<ForecastPreparationExecutionRecord | null>
}

export class ForecastExecutionControlError extends Error {
  constructor(
    readonly code: 'CONTROL_DB_UNAVAILABLE' | 'STALE_OWNER' | 'NO_ACTIVE_EXECUTION',
    message: string,
  ) {
    super(message)
    this.name = 'ForecastExecutionControlError'
  }
}

export type ForecastPreparationExecutionContextRegistry = {
  getOrCreateContext(input: {
    operationFamily: ForecastPreparationOperationFamily
    logicalArtifactKey: string
    ownerRequestId: string
    attemptKind?: ForecastPreparationAttemptKind
    executionMode?: ForecastPreparationExecutionMode
    recoveredFromExecutionId?: string | null
    observedAt?: string
  }): ForecastPreparationExecutionContext
  releaseContext(executionId: string): void
  getActiveContextCount(): number
}

function canEventAdvanceAuthoritativeLeaseContext(input: ForecastPreparationExecutionLedgerEventInput) {
  return input.role === 'OWNER' && input.leaseVersion !== undefined
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

export const STAGE2_NON_AUTHORITATIVE_LEASE_WINDOW_MS = 5 * 60 * 1000
export const DEFAULT_FORECAST_STAGE3_LEASE_DURATION_MS = 60 * 1000

type LockedExecutionRow = {
  executionId: string
}

function resolveStage3LeaseDurationMs() {
  const rawValue = process.env.FORECAST_STAGE3_LEASE_DURATION_MS?.trim()
  if (!rawValue) {
    return DEFAULT_FORECAST_STAGE3_LEASE_DURATION_MS
  }

  const parsed = Number.parseInt(rawValue, 10)
  if (!Number.isFinite(parsed) || parsed < 1_000) {
    throw new Error('FORECAST_STAGE3_LEASE_DURATION_MS must be an integer >= 1000 milliseconds.')
  }

  return parsed
}

function addLeaseWindow(observedAt: string, leaseWindowMs: number) {
  return new Date(new Date(observedAt).getTime() + leaseWindowMs).toISOString()
}

function asSqlTimestamp(isoTimestamp: string) {
  return Prisma.sql`CAST(${isoTimestamp} AS timestamp)`
}

function createExecutionRecordFromAdmission(input: {
  executionId: string
  logicalArtifactKey: string
  operationFamily: ForecastPreparationOperationFamily
  logicalArtifactIdentity: ForecastPreparationLogicalArtifactIdentity
  ownerRequestId: string
  requestId: string
  attemptKind: ForecastPreparationAttemptKind
  executionMode: ForecastPreparationExecutionMode
  ownerToken: string
  leaseVersion: number
  leaseAcquiredAt: string
  leaseExpiresAt: string
  recoveredFromExecutionId: string | null
}): ForecastPreparationExecutionRecord {
  const commonIdentity = extractCommonIdentity(input.logicalArtifactIdentity)
  return {
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
    attemptKind: input.attemptKind,
    executionMode: input.executionMode,
    ownerToken: input.ownerToken,
    leaseVersion: input.leaseVersion,
    leaseAcquiredAt: input.leaseAcquiredAt,
    leaseExpiresAt: input.leaseExpiresAt,
    recoveredFromExecutionId: input.recoveredFromExecutionId,
    ownerRequestId: input.ownerRequestId,
    latestRequestId: input.requestId,
    latestRole: 'OWNER',
    waiterCount: 0,
    eventCount: 0,
    startedAt: input.leaseAcquiredAt,
    lastEventAt: input.leaseAcquiredAt,
    lastProgressAt: input.leaseAcquiredAt,
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
}

function asOwnedExecutionContext(record: ForecastPreparationExecutionRecord, requestId: string): ForecastPreparationOwnedExecutionContext {
  return {
    role: record.attemptKind === 'RECOVERY' ? 'RECOVERY_OWNER' : 'OWNER',
    requestId,
    executionId: record.executionId,
    ownerToken: record.ownerToken,
    operationFamily: record.operationFamily,
    logicalArtifactKey: record.logicalArtifactKey,
    ownerRequestId: record.ownerRequestId,
    attemptKind: record.attemptKind,
    executionMode: record.executionMode,
    leaseVersion: record.leaseVersion,
    leaseAcquiredAt: record.leaseAcquiredAt,
    leaseExpiresAt: record.leaseExpiresAt,
    recoveredFromExecutionId: record.recoveredFromExecutionId,
  }
}

function isLeaseActive(record: Pick<ForecastPreparationExecutionRecord, 'executionStatus' | 'leaseExpiresAt'>, observedAt: string) {
  return record.executionStatus === 'STARTED'
    && new Date(record.leaseExpiresAt).getTime() > new Date(observedAt).getTime()
}

function toWaiterAdmission(record: ForecastPreparationExecutionRecord): ForecastPreparationAdmissionResult {
  return {
    role: 'WAITER',
    executionId: record.executionId,
    ownerRequestId: record.ownerRequestId,
    ownerToken: record.ownerToken,
    leaseVersion: record.leaseVersion,
    leaseExpiresAt: record.leaseExpiresAt,
    recoveredFromExecutionId: record.recoveredFromExecutionId,
  }
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

function defaultExecutionMode(attemptKind: ForecastPreparationAttemptKind): ForecastPreparationExecutionMode {
  return attemptKind === 'RECOVERY' ? 'RECOVERY_RESUME' : 'PRE_STAGE3_PREPARATION'
}

function defaultAttemptKind(executionMode?: ForecastPreparationExecutionMode): ForecastPreparationAttemptKind {
  return executionMode === 'RECOVERY_RESUME' ? 'RECOVERY' : 'PRIMARY'
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

export function createForecastPreparationExecutionContextRegistry(
  dependencies: { leaseWindowMs?: number } = {},
): ForecastPreparationExecutionContextRegistry {
  const leaseWindowMs = dependencies.leaseWindowMs ?? STAGE2_NON_AUTHORITATIVE_LEASE_WINDOW_MS
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
      const attemptKind = input.attemptKind ?? defaultAttemptKind(input.executionMode)
      const context: ForecastPreparationExecutionContext = {
        executionId: randomUUID(),
        ownerToken: randomUUID(),
        operationFamily: input.operationFamily,
        logicalArtifactKey: input.logicalArtifactKey,
        ownerRequestId: input.ownerRequestId,
        attemptKind,
        executionMode: input.executionMode ?? defaultExecutionMode(attemptKind),
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
    getActiveContextCount() {
      return contextByOwnerKey.size
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
        attemptKind: input.attemptKind ?? defaultAttemptKind(input.executionMode),
        executionMode: input.executionMode ?? defaultExecutionMode(input.attemptKind ?? defaultAttemptKind(input.executionMode)),
        ownerToken: input.ownerToken ?? input.executionId,
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
  next.attemptKind = input.attemptKind ?? next.attemptKind
  next.executionMode = input.executionMode ?? next.executionMode

  if (input.ownerToken) {
    next.ownerToken = input.ownerToken
  }

  const shouldAdvanceLeaseContext = canEventAdvanceAuthoritativeLeaseContext(input) && (
    input.leaseVersion > next.leaseVersion
    || (
      input.leaseVersion === next.leaseVersion
      && input.leaseExpiresAt !== undefined
      && new Date(input.leaseExpiresAt).getTime() > new Date(next.leaseExpiresAt).getTime()
    )
  )

  if (shouldAdvanceLeaseContext) {
    next.leaseVersion = input.leaseVersion as number
    next.leaseAcquiredAt = input.leaseAcquiredAt ?? next.leaseAcquiredAt
    next.leaseExpiresAt = input.leaseExpiresAt ?? next.leaseExpiresAt
    next.recoveredFromExecutionId = input.recoveredFromExecutionId ?? next.recoveredFromExecutionId
  }

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

export function createInMemoryForecastPreparationExecutionAdmission(
  dependencies: { leaseDurationMs?: number } = {},
): ForecastPreparationExecutionAdmission {
  const leaseDurationMs = dependencies.leaseDurationMs ?? resolveStage3LeaseDurationMs()
  const recordByExecutionId = new Map<string, ForecastPreparationExecutionRecord>()
  const latestExecutionIdByLogicalArtifactKey = new Map<string, string>()

  const persistRecord = (record: ForecastPreparationExecutionRecord) => {
    recordByExecutionId.set(record.executionId, record)
    latestExecutionIdByLogicalArtifactKey.set(record.logicalArtifactKey, record.executionId)
  }

  const readLatest = (logicalArtifactKey: string) => {
    const latestExecutionId = latestExecutionIdByLogicalArtifactKey.get(logicalArtifactKey)
    return latestExecutionId ? recordByExecutionId.get(latestExecutionId) ?? null : null
  }

  return {
    leaseDurationMs,
    async acquireExecution(input) {
      const observedAt = input.observedAt ?? nowIso()
      const latest = readLatest(input.logicalArtifactKey)
      if (latest && isLeaseActive(latest, observedAt)) {
        const updated: ForecastPreparationExecutionRecord = {
          ...latest,
          latestRequestId: input.requestId,
          latestRole: 'WAITER',
          waiterCount: latest.waiterCount + 1,
          lastEventAt: observedAt,
        }
        persistRecord(updated)
        return toWaiterAdmission(updated)
      }

      if (latest && latest.executionStatus === 'STARTED') {
        const terminalized: ForecastPreparationExecutionRecord = {
          ...latest,
          executionStatus: 'FAILED',
          completedAt: observedAt,
          lastEventAt: observedAt,
          lastProgressAt: observedAt,
          failurePhase: latest.failurePhase ?? 'FINALIZATION',
          failureReason: latest.failureReason ?? 'Lease expired before completion; execution was superseded by recovery owner.',
        }
        persistRecord(terminalized)
      }

      const executionId = randomUUID()
      const ownerToken = randomUUID()
      const recoveredFromExecutionId = latest?.executionStatus === 'FAILED' || latest?.executionStatus === 'COMPLETED'
        ? null
        : latest?.executionId ?? null
      const attemptKind: ForecastPreparationAttemptKind = latest?.executionStatus === 'STARTED' ? 'RECOVERY' : 'PRIMARY'
      const executionMode = attemptKind === 'RECOVERY' ? 'RECOVERY_RESUME' : 'PRE_STAGE3_PREPARATION'
      const leaseVersion = latest?.executionStatus === 'STARTED' ? latest.leaseVersion + 1 : 1
      const record = createExecutionRecordFromAdmission({
        executionId,
        logicalArtifactKey: input.logicalArtifactKey,
        operationFamily: input.operationFamily,
        logicalArtifactIdentity: input.logicalArtifactIdentity,
        ownerRequestId: input.ownerRequestId,
        requestId: input.requestId,
        attemptKind,
        executionMode,
        ownerToken,
        leaseVersion,
        leaseAcquiredAt: observedAt,
        leaseExpiresAt: addLeaseWindow(observedAt, leaseDurationMs),
        recoveredFromExecutionId: attemptKind === 'RECOVERY' ? latest?.executionId ?? null : null,
      })
      persistRecord(record)
      return {
        role: record.attemptKind === 'RECOVERY' ? 'RECOVERY_OWNER' : 'OWNER',
        ownership: asOwnedExecutionContext(record, input.requestId),
      }
    },

    async renewLease(input) {
      const observedAt = input.observedAt ?? nowIso()
      const current = recordByExecutionId.get(input.executionId)
      if (!current) {
        throw new ForecastExecutionControlError('NO_ACTIVE_EXECUTION', `No active execution exists for ${input.executionId}.`)
      }
      if (
        current.executionStatus !== 'STARTED'
        || current.logicalArtifactKey !== input.logicalArtifactKey
        || current.ownerToken !== input.ownerToken
        || current.leaseVersion !== input.leaseVersion
        || new Date(current.leaseExpiresAt).getTime() <= new Date(observedAt).getTime()
      ) {
        throw new ForecastExecutionControlError('STALE_OWNER', `Execution ${input.executionId} no longer owns ${input.logicalArtifactKey}.`)
      }

      const renewed: ForecastPreparationExecutionRecord = {
        ...current,
        latestRequestId: input.requestId,
        lastEventAt: observedAt,
        lastProgressAt: observedAt,
        leaseExpiresAt: addLeaseWindow(observedAt, leaseDurationMs),
      }
      persistRecord(renewed)
      return asOwnedExecutionContext(renewed, input.requestId)
    },

    async markExecutionFailed(input) {
      const observedAt = input.observedAt ?? nowIso()
      const current = recordByExecutionId.get(input.executionId)
      if (!current) {
        throw new ForecastExecutionControlError('NO_ACTIVE_EXECUTION', `No active execution exists for ${input.executionId}.`)
      }
      if (
        current.executionStatus !== 'STARTED'
        || current.logicalArtifactKey !== input.logicalArtifactKey
        || current.ownerToken !== input.ownerToken
        || current.leaseVersion !== input.leaseVersion
        || new Date(current.leaseExpiresAt).getTime() <= new Date(observedAt).getTime()
      ) {
        throw new ForecastExecutionControlError('STALE_OWNER', `Execution ${input.executionId} no longer owns ${input.logicalArtifactKey}.`)
      }

      persistRecord({
        ...current,
        executionStatus: 'FAILED',
        resultStatus: input.resultStatus ?? current.resultStatus,
        cacheStatus: input.cacheStatus ?? current.cacheStatus,
        latestRequestId: input.requestId,
        latestRole: 'OWNER',
        lastEventAt: observedAt,
        lastProgressAt: observedAt,
        completedAt: observedAt,
        failurePhase: input.failurePhase,
        failureReason: input.failureReason,
      })
    },

    async markExecutionCompleted(input) {
      const observedAt = input.observedAt ?? nowIso()
      const current = recordByExecutionId.get(input.executionId)
      if (!current) {
        throw new ForecastExecutionControlError('NO_ACTIVE_EXECUTION', `No active execution exists for ${input.executionId}.`)
      }
      if (
        current.executionStatus !== 'STARTED'
        || current.logicalArtifactKey !== input.logicalArtifactKey
        || current.ownerToken !== input.ownerToken
        || current.leaseVersion !== input.leaseVersion
        || new Date(current.leaseExpiresAt).getTime() <= new Date(observedAt).getTime()
      ) {
        throw new ForecastExecutionControlError('STALE_OWNER', `Execution ${input.executionId} no longer owns ${input.logicalArtifactKey}.`)
      }

      persistRecord({
        ...current,
        executionStatus: 'COMPLETED',
        resultStatus: input.resultStatus ?? current.resultStatus,
        cacheStatus: input.cacheStatus ?? current.cacheStatus,
        latestRequestId: input.requestId,
        latestRole: 'OWNER',
        lastEventAt: observedAt,
        lastProgressAt: observedAt,
        completedAt: observedAt,
        failurePhase: null,
        failureReason: null,
      })
    },

    async readLatestExecutionForLogicalArtifact(logicalArtifactKey) {
      return readLatest(logicalArtifactKey)
    },
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
  attemptKind: string
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
    attemptKind: record.attemptKind as ForecastPreparationAttemptKind,
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
          attemptKind: record.attemptKind,
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
          attemptKind: record.attemptKind,
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

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

export function createDefaultForecastPreparationExecutionAdmission(): ForecastPreparationExecutionAdmission {
  const leaseDurationMs = resolveStage3LeaseDurationMs()

  function requirePrisma() {
    const prisma = getMarketDataPrisma()
    if (!prisma) {
      throw new ForecastExecutionControlError(
        'CONTROL_DB_UNAVAILABLE',
        'Forecast execution admission requires the market-data PostgreSQL authority.',
      )
    }
    return prisma
  }

  async function readLatestExecutionForLogicalArtifact(logicalArtifactKey: string) {
    const prisma = requirePrisma()
    const active = await prisma.forecastPreparationExecutionLedger.findFirst({
      where: {
        logicalArtifactKey,
        executionStatus: 'STARTED',
      },
      orderBy: [
        { startedAt: 'desc' },
        { updatedAt: 'desc' },
      ],
    })

    if (active) {
      return mapStoredExecutionRecord(active)
    }

    const latest = await prisma.forecastPreparationExecutionLedger.findFirst({
      where: {
        logicalArtifactKey,
      },
      orderBy: [
        { startedAt: 'desc' },
        { updatedAt: 'desc' },
      ],
    })

    return latest ? mapStoredExecutionRecord(latest) : null
  }

  async function lockActiveExecutionForUpdate(
    tx: Prisma.TransactionClient,
    logicalArtifactKey: string,
  ) {
    const lockedRows = await tx.$queryRaw<LockedExecutionRow[]>(Prisma.sql`
      SELECT "executionId"
      FROM "forecast_preparation_execution_ledger"
      WHERE "logicalArtifactKey" = ${logicalArtifactKey}
        AND "executionStatus" = 'STARTED'
      ORDER BY "startedAt" DESC, "updatedAt" DESC
      LIMIT 1
      FOR UPDATE
    `)

    if (lockedRows.length === 0) {
      return null
    }

    const active = await tx.forecastPreparationExecutionLedger.findUnique({
      where: {
        executionId: lockedRows[0]!.executionId,
      },
    })

    return active ? mapStoredExecutionRecord(active) : null
  }

  return {
    leaseDurationMs,

    async acquireExecution(input) {
      const prisma = requirePrisma()
      const observedAt = input.observedAt ?? nowIso()
      const observedDate = new Date(observedAt)

      const createOwnedExecution = async (
        tx: Prisma.TransactionClient,
        recoveredFrom: ForecastPreparationExecutionRecord | null,
      ) => {
        const attemptKind: ForecastPreparationAttemptKind = recoveredFrom ? 'RECOVERY' : 'PRIMARY'
        const executionMode: ForecastPreparationExecutionMode = attemptKind === 'RECOVERY'
          ? 'RECOVERY_RESUME'
          : 'PRE_STAGE3_PREPARATION'
        const record = createExecutionRecordFromAdmission({
          executionId: randomUUID(),
          logicalArtifactKey: input.logicalArtifactKey,
          operationFamily: input.operationFamily,
          logicalArtifactIdentity: input.logicalArtifactIdentity,
          ownerRequestId: input.ownerRequestId,
          requestId: input.requestId,
          attemptKind,
          executionMode,
          ownerToken: randomUUID(),
          leaseVersion: recoveredFrom ? recoveredFrom.leaseVersion + 1 : 1,
          leaseAcquiredAt: observedAt,
          leaseExpiresAt: addLeaseWindow(observedAt, leaseDurationMs),
          recoveredFromExecutionId: recoveredFrom?.executionId ?? null,
        })

        await tx.forecastPreparationExecutionLedger.create({
          data: {
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
            attemptKind: record.attemptKind,
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
            completedAt: null,
            computeStartedAt: null,
            computeCompletedAt: null,
            persistenceStartedAt: null,
            persistenceCompletedAt: null,
            failurePhase: null,
            failureReason: null,
            logicalArtifactIdentityJson: record.logicalArtifactIdentity as Prisma.InputJsonValue,
            eventsJson: record.events as Prisma.InputJsonValue,
          },
        })

        return {
          role: record.attemptKind === 'RECOVERY' ? 'RECOVERY_OWNER' : 'OWNER',
          ownership: asOwnedExecutionContext(record, input.requestId),
        } satisfies ForecastPreparationAdmissionResult
      }

      try {
        return await prisma.$transaction(async (tx) => {
          const active = await lockActiveExecutionForUpdate(tx, input.logicalArtifactKey)

          if (!active) {
            return createOwnedExecution(tx, null)
          }

          if (isLeaseActive(active, observedAt)) {
            await tx.forecastPreparationExecutionLedger.update({
              where: {
                executionId: active.executionId,
              },
              data: {
                latestRequestId: input.requestId,
                latestRole: 'WAITER',
                waiterCount: {
                  increment: 1,
                },
                lastEventAt: observedDate,
              },
            })
            return toWaiterAdmission(active)
          }

          const staleMarked = await tx.forecastPreparationExecutionLedger.updateMany({
            where: {
              executionId: active.executionId,
              executionStatus: 'STARTED',
              ownerToken: active.ownerToken,
              leaseVersion: active.leaseVersion,
            },
            data: {
              executionStatus: 'FAILED',
              latestRequestId: input.requestId,
              latestRole: 'OWNER',
              lastEventAt: observedDate,
              lastProgressAt: observedDate,
              completedAt: observedDate,
              failurePhase: active.failurePhase ?? 'FINALIZATION',
              failureReason: active.failureReason ?? 'Lease expired before completion; execution was superseded by recovery owner.',
            },
          })

          if (staleMarked.count === 0) {
            const latest = await tx.forecastPreparationExecutionLedger.findFirst({
              where: {
                logicalArtifactKey: input.logicalArtifactKey,
                executionStatus: 'STARTED',
              },
              orderBy: [
                { startedAt: 'desc' },
                { updatedAt: 'desc' },
              ],
            })
            if (latest) {
              return toWaiterAdmission(mapStoredExecutionRecord(latest))
            }
            return createOwnedExecution(tx, null)
          }

          return createOwnedExecution(tx, active)
        })
      } catch (error) {
        if (isUniqueViolation(error)) {
          const latest = await readLatestExecutionForLogicalArtifact(input.logicalArtifactKey)
          if (latest && latest.executionStatus === 'STARTED') {
            return toWaiterAdmission(latest)
          }
        }
        throw error
      }
    },

    async renewLease(input) {
      const prisma = requirePrisma()
      const observedAt = input.observedAt ?? nowIso()
      const nextLeaseExpiresAt = addLeaseWindow(observedAt, leaseDurationMs)
      const updated = await prisma.$executeRaw(Prisma.sql`
        UPDATE "forecast_preparation_execution_ledger"
        SET
          "latestRequestId" = ${input.requestId},
          "latestRole" = 'OWNER',
          "lastEventAt" = ${asSqlTimestamp(observedAt)},
          "lastProgressAt" = ${asSqlTimestamp(observedAt)},
          "leaseExpiresAt" = ${asSqlTimestamp(nextLeaseExpiresAt)}
        WHERE "executionId" = ${input.executionId}
          AND "logicalArtifactKey" = ${input.logicalArtifactKey}
          AND "executionStatus" = 'STARTED'
          AND "ownerToken" = ${input.ownerToken}
          AND "leaseVersion" = ${input.leaseVersion}
          AND "leaseExpiresAt" > ${asSqlTimestamp(observedAt)}
      `)

      if (updated !== 1) {
        throw new ForecastExecutionControlError('STALE_OWNER', `Execution ${input.executionId} no longer owns ${input.logicalArtifactKey}.`)
      }

      const record = await prisma.forecastPreparationExecutionLedger.findUnique({
        where: {
          executionId: input.executionId,
        },
      })
      if (!record) {
        throw new ForecastExecutionControlError('NO_ACTIVE_EXECUTION', `Execution ${input.executionId} disappeared during lease renewal.`)
      }
      return asOwnedExecutionContext(mapStoredExecutionRecord(record), input.requestId)
    },

    async markExecutionFailed(input) {
      const prisma = requirePrisma()
      const observedAt = input.observedAt ?? nowIso()
      const updated = await prisma.$executeRaw(Prisma.sql`
        UPDATE "forecast_preparation_execution_ledger"
        SET
          "executionStatus" = 'FAILED',
          "resultStatus" = ${input.resultStatus ?? null},
          "cacheStatus" = ${input.cacheStatus ?? null},
          "latestRequestId" = ${input.requestId},
          "latestRole" = 'OWNER',
          "lastEventAt" = ${asSqlTimestamp(observedAt)},
          "lastProgressAt" = ${asSqlTimestamp(observedAt)},
          "completedAt" = ${asSqlTimestamp(observedAt)},
          "failurePhase" = ${input.failurePhase},
          "failureReason" = ${input.failureReason}
        WHERE "executionId" = ${input.executionId}
          AND "logicalArtifactKey" = ${input.logicalArtifactKey}
          AND "executionStatus" = 'STARTED'
          AND "ownerToken" = ${input.ownerToken}
          AND "leaseVersion" = ${input.leaseVersion}
          AND "leaseExpiresAt" > ${asSqlTimestamp(observedAt)}
      `)

      if (updated !== 1) {
        throw new ForecastExecutionControlError('STALE_OWNER', `Execution ${input.executionId} no longer owns ${input.logicalArtifactKey}.`)
      }
    },

    async markExecutionCompleted(input) {
      const prisma = requirePrisma()
      const observedAt = input.observedAt ?? nowIso()
      const updated = await prisma.$executeRaw(Prisma.sql`
        UPDATE "forecast_preparation_execution_ledger"
        SET
          "executionStatus" = 'COMPLETED',
          "resultStatus" = ${input.resultStatus ?? null},
          "cacheStatus" = ${input.cacheStatus ?? null},
          "latestRequestId" = ${input.requestId},
          "latestRole" = 'OWNER',
          "lastEventAt" = ${asSqlTimestamp(observedAt)},
          "lastProgressAt" = ${asSqlTimestamp(observedAt)},
          "completedAt" = ${asSqlTimestamp(observedAt)},
          "failurePhase" = NULL,
          "failureReason" = NULL
        WHERE "executionId" = ${input.executionId}
          AND "logicalArtifactKey" = ${input.logicalArtifactKey}
          AND "executionStatus" = 'STARTED'
          AND "ownerToken" = ${input.ownerToken}
          AND "leaseVersion" = ${input.leaseVersion}
          AND "leaseExpiresAt" > ${asSqlTimestamp(observedAt)}
      `)

      if (updated !== 1) {
        throw new ForecastExecutionControlError('STALE_OWNER', `Execution ${input.executionId} no longer owns ${input.logicalArtifactKey}.`)
      }
    },

    readLatestExecutionForLogicalArtifact,
  }
}

export function createDefaultForecastPreparationExecutionLedger() {
  return createForecastPreparationExecutionLedger()
}

export function createNoopForecastPreparationExecutionLedger(): ForecastPreparationExecutionLedger {
  return createForecastPreparationExecutionLedger({ store: createNoopStore() })
}