export const CURRENT_LOGICAL_ARTIFACT_KEY_FIELDS = [
  'namespace',
  'artifactScope',
  'seriesId',
  'targetBasis',
  'targetSemantics',
  'methodId',
  'methodVersion',
  'trainingWindowPolicyId',
  'modelId',
  'inputSource',
  'historyFingerprint',
  'sourceFrequency',
  'targetCadence',
  'frequencyIdentity',
  'forecastOrigin',
  'horizonConfigurationId',
] as const

type CurrentLogicalArtifactKeyField = (typeof CURRENT_LOGICAL_ARTIFACT_KEY_FIELDS)[number]

export type CurrentLogicalArtifactIdentity = Record<
  Exclude<CurrentLogicalArtifactKeyField, 'namespace'>,
  string | null
>

export type CurrentSingleFlightEvent =
  | 'single_flight_lookup'
  | 'single_flight_owner_acquired'
  | 'single_flight_waiter_joined'
  | 'single_flight_owner_completed'
  | 'single_flight_owner_failed'
  | 'single_flight_waiter_completed'
  | 'single_flight_waiter_failed'
  | 'single_flight_entry_released'

export type CurrentSingleFlightEventData = {
  logicalArtifactKey: string
  operationFamily: 'CURRENT'
  ownerRequestId: string
  requestId: string
  role: 'OWNER' | 'WAITER'
  activeCurrentSingleFlightEntries: number
  durationMs?: number
  error?: string
}

type CurrentSingleFlightTelemetry = (
  event: CurrentSingleFlightEvent,
  data: CurrentSingleFlightEventData,
) => void | Promise<void>

function isPromiseLike(result: void | Promise<void> | undefined): result is Promise<void> {
  return result !== undefined && typeof result?.then === 'function'
}

type InFlightEntry<Result> = {
  ownerRequestId: string
  promise: Promise<Result>
}

function serializeField(fieldName: string, value: string | null) {
  const serializedValue = value === null ? '<NULL>' : value
  return `${Buffer.byteLength(fieldName, 'utf8')}:${fieldName}${Buffer.byteLength(serializedValue, 'utf8')}:${serializedValue}`
}

export function buildCurrentLogicalArtifactKey(identity: CurrentLogicalArtifactIdentity) {
  const completeIdentity: Record<CurrentLogicalArtifactKeyField, string | null | undefined> = {
    namespace: 'CURRENT',
    ...identity,
  }
  const missingFields = CURRENT_LOGICAL_ARTIFACT_KEY_FIELDS.filter(
    (fieldName) => completeIdentity[fieldName] === undefined,
  )

  if (missingFields.length > 0) {
    throw new Error(`Missing Current logical key fields: ${missingFields.join(', ')}`)
  }

  return CURRENT_LOGICAL_ARTIFACT_KEY_FIELDS.map((fieldName) =>
    serializeField(fieldName, completeIdentity[fieldName]!),
  ).join('|')
}

export class CurrentForecastSingleFlight<Result> {
  private readonly entries = new Map<string, InFlightEntry<Result>>()

  get activeEntryCount() {
    return this.entries.size
  }

  async run(input: {
    logicalArtifactKey: string
    requestId: string
    operation: () => Promise<Result>
    emit?: CurrentSingleFlightTelemetry
  }): Promise<Result> {
    const startedAt = performance.now()
    const existing = this.entries.get(input.logicalArtifactKey)

    if (existing) {
      const eventData = (): CurrentSingleFlightEventData => ({
        logicalArtifactKey: input.logicalArtifactKey,
        operationFamily: 'CURRENT',
        ownerRequestId: existing.ownerRequestId,
        requestId: input.requestId,
        role: 'WAITER',
        activeCurrentSingleFlightEntries: this.entries.size,
      })
      const lookupTelemetry = input.emit?.('single_flight_lookup', eventData())
      if (isPromiseLike(lookupTelemetry)) {
        await lookupTelemetry
      }
      const waiterJoinedTelemetry = input.emit?.('single_flight_waiter_joined', eventData())
      if (isPromiseLike(waiterJoinedTelemetry)) {
        await waiterJoinedTelemetry
      }

      try {
        const result = await existing.promise
        const waiterCompletedTelemetry = input.emit?.('single_flight_waiter_completed', {
          ...eventData(),
          durationMs: performance.now() - startedAt,
        })
        if (isPromiseLike(waiterCompletedTelemetry)) {
          await waiterCompletedTelemetry
        }
        return result
      } catch (error) {
        const waiterFailedTelemetry = input.emit?.('single_flight_waiter_failed', {
          ...eventData(),
          durationMs: performance.now() - startedAt,
          error: error instanceof Error ? error.message : 'unknown',
        })
        if (isPromiseLike(waiterFailedTelemetry)) {
          await waiterFailedTelemetry
        }
        throw error
      }
    }

    const entry: InFlightEntry<Result> = {
      ownerRequestId: input.requestId,
      promise: Promise.resolve().then(input.operation),
    }
    this.entries.set(input.logicalArtifactKey, entry)
    const eventData = (): CurrentSingleFlightEventData => ({
      logicalArtifactKey: input.logicalArtifactKey,
      operationFamily: 'CURRENT',
      ownerRequestId: input.requestId,
      requestId: input.requestId,
      role: 'OWNER',
      activeCurrentSingleFlightEntries: this.entries.size,
    })
    const lookupTelemetry = input.emit?.('single_flight_lookup', eventData())
    if (isPromiseLike(lookupTelemetry)) {
      await lookupTelemetry
    }
    const ownerAcquiredTelemetry = input.emit?.('single_flight_owner_acquired', eventData())
    if (isPromiseLike(ownerAcquiredTelemetry)) {
      await ownerAcquiredTelemetry
    }

    try {
      const result = await entry.promise
      const ownerCompletedTelemetry = input.emit?.('single_flight_owner_completed', {
        ...eventData(),
        durationMs: performance.now() - startedAt,
      })
      if (isPromiseLike(ownerCompletedTelemetry)) {
        await ownerCompletedTelemetry
      }
      return result
    } catch (error) {
      const ownerFailedTelemetry = input.emit?.('single_flight_owner_failed', {
        ...eventData(),
        durationMs: performance.now() - startedAt,
        error: error instanceof Error ? error.message : 'unknown',
      })
      if (isPromiseLike(ownerFailedTelemetry)) {
        await ownerFailedTelemetry
      }
      throw error
    } finally {
      if (this.entries.get(input.logicalArtifactKey) === entry) {
        this.entries.delete(input.logicalArtifactKey)
      }
      const entryReleasedTelemetry = input.emit?.('single_flight_entry_released', eventData())
      if (isPromiseLike(entryReleasedTelemetry)) {
        await entryReleasedTelemetry
      }
    }
  }
}