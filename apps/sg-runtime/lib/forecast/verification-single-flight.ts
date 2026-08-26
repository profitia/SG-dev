export const VERIFICATION_LOGICAL_ARTIFACT_KEY_FIELDS = [
  'namespace',
  'seriesId',
  'targetBasis',
  'targetSemantics',
  'methodId',
  'methodVersion',
  'modelId',
  'inputSource',
  'historyFingerprint',
  'sourceFrequency',
  'targetCadence',
  'frequencyIdentity',
  'verificationHorizonSetId',
  'verificationConfigurationId',
  'originPolicyId',
] as const

type VerificationLogicalArtifactKeyField = (typeof VERIFICATION_LOGICAL_ARTIFACT_KEY_FIELDS)[number]

export type VerificationLogicalArtifactIdentity = Record<
  Exclude<VerificationLogicalArtifactKeyField, 'namespace'>,
  string | null
>

export const VERIFICATION_CONFIGURATION_ID = JSON.stringify({ minTrainingWindow: 36 })
export const VERIFICATION_ORIGIN_POLICY_ID = 'EXPANDING_WINDOW_ROLLING_ORIGIN@expanding-window-rolling-origin-v1'

export function buildVerificationHorizonSetId(horizons: Record<string, number>) {
  return JSON.stringify(Object.fromEntries(
    Object.entries(horizons).sort(([left], [right]) => left.localeCompare(right)),
  ))
}

export type VerificationSingleFlightEvent =
  | 'single_flight_lookup'
  | 'single_flight_owner_acquired'
  | 'single_flight_waiter_joined'
  | 'single_flight_owner_completed'
  | 'single_flight_owner_failed'
  | 'single_flight_waiter_completed'
  | 'single_flight_waiter_failed'
  | 'single_flight_entry_released'

export type VerificationSingleFlightEventData = {
  logicalArtifactKey: string
  operationFamily: 'VERIFICATION'
  ownerRequestId: string
  requestId: string
  role: 'OWNER' | 'WAITER'
  activeVerificationSingleFlightEntries: number
  durationMs?: number
  error?: string
}

type VerificationSingleFlightTelemetry = (
  event: VerificationSingleFlightEvent,
  data: VerificationSingleFlightEventData,
) => void

type InFlightEntry<Result> = {
  ownerRequestId: string
  promise: Promise<Result>
}

function serializeField(fieldName: string, value: string | null) {
  const serializedValue = value === null ? '<NULL>' : value
  return `${Buffer.byteLength(fieldName, 'utf8')}:${fieldName}${Buffer.byteLength(serializedValue, 'utf8')}:${serializedValue}`
}

export function buildVerificationLogicalArtifactKey(identity: VerificationLogicalArtifactIdentity) {
  const completeIdentity: Record<VerificationLogicalArtifactKeyField, string | null | undefined> = {
    namespace: 'VERIFICATION',
    ...identity,
  }
  const missingFields = VERIFICATION_LOGICAL_ARTIFACT_KEY_FIELDS.filter(
    (fieldName) => completeIdentity[fieldName] === undefined,
  )

  if (missingFields.length > 0) {
    throw new Error(`Missing Verification logical key fields: ${missingFields.join(', ')}`)
  }

  return VERIFICATION_LOGICAL_ARTIFACT_KEY_FIELDS.map((fieldName) =>
    serializeField(fieldName, completeIdentity[fieldName]!),
  ).join('|')
}

export class VerificationForecastSingleFlight<Result> {
  private readonly entries = new Map<string, InFlightEntry<Result>>()

  get activeEntryCount() {
    return this.entries.size
  }

  async run(input: {
    logicalArtifactKey: string
    requestId: string
    operation: () => Promise<Result>
    emit?: VerificationSingleFlightTelemetry
  }): Promise<Result> {
    const startedAt = performance.now()
    const existing = this.entries.get(input.logicalArtifactKey)

    if (existing) {
      const eventData = (): VerificationSingleFlightEventData => ({
        logicalArtifactKey: input.logicalArtifactKey,
        operationFamily: 'VERIFICATION',
        ownerRequestId: existing.ownerRequestId,
        requestId: input.requestId,
        role: 'WAITER',
        activeVerificationSingleFlightEntries: this.entries.size,
      })
      input.emit?.('single_flight_lookup', eventData())
      input.emit?.('single_flight_waiter_joined', eventData())

      try {
        const result = await existing.promise
        input.emit?.('single_flight_waiter_completed', {
          ...eventData(),
          durationMs: performance.now() - startedAt,
        })
        return result
      } catch (error) {
        input.emit?.('single_flight_waiter_failed', {
          ...eventData(),
          durationMs: performance.now() - startedAt,
          error: error instanceof Error ? error.message : 'unknown',
        })
        throw error
      }
    }

    const entry: InFlightEntry<Result> = {
      ownerRequestId: input.requestId,
      promise: Promise.resolve().then(input.operation),
    }
    this.entries.set(input.logicalArtifactKey, entry)
    const eventData = (): VerificationSingleFlightEventData => ({
      logicalArtifactKey: input.logicalArtifactKey,
      operationFamily: 'VERIFICATION',
      ownerRequestId: input.requestId,
      requestId: input.requestId,
      role: 'OWNER',
      activeVerificationSingleFlightEntries: this.entries.size,
    })
    input.emit?.('single_flight_lookup', eventData())
    input.emit?.('single_flight_owner_acquired', eventData())

    try {
      const result = await entry.promise
      input.emit?.('single_flight_owner_completed', {
        ...eventData(),
        durationMs: performance.now() - startedAt,
      })
      return result
    } catch (error) {
      input.emit?.('single_flight_owner_failed', {
        ...eventData(),
        durationMs: performance.now() - startedAt,
        error: error instanceof Error ? error.message : 'unknown',
      })
      throw error
    } finally {
      if (this.entries.get(input.logicalArtifactKey) === entry) {
        this.entries.delete(input.logicalArtifactKey)
      }
      input.emit?.('single_flight_entry_released', eventData())
    }
  }
}