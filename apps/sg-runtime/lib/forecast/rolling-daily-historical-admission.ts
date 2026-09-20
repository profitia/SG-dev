import type { ForecastTargetBasis } from '@/lib/forecast/contracts'
import { FULL_VERIFICATION_TRAINING_WINDOW_POLICY_ID } from '@/lib/forecast/identity'

export const HISTORICAL_MAINTENANCE_LOGICAL_ARTIFACT_KEY_FIELDS = [
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
  'historicalOriginStartDate',
  'minimumTrainingObservations',
  'minimumCalibrationSamples',
  'maxOriginsPerRun',
  'bootstrapHistoricalIfMissing',
  'fullRebuild',
] as const

type HistoricalMaintenanceLogicalArtifactKeyField = (typeof HISTORICAL_MAINTENANCE_LOGICAL_ARTIFACT_KEY_FIELDS)[number]

export type HistoricalMaintenanceLogicalArtifactIdentity = Record<
  Exclude<HistoricalMaintenanceLogicalArtifactKeyField, 'namespace'>,
  string | null
>

function serializeField(fieldName: string, value: string | null) {
  const serializedValue = value === null ? '<NULL>' : value
  return `${Buffer.byteLength(fieldName, 'utf8')}:${fieldName}${Buffer.byteLength(serializedValue, 'utf8')}:${serializedValue}`
}

export function buildHistoricalMaintenanceLogicalArtifactKey(identity: HistoricalMaintenanceLogicalArtifactIdentity) {
  const completeIdentity: Record<HistoricalMaintenanceLogicalArtifactKeyField, string | null | undefined> = {
    namespace: 'HISTORICAL_MAINTENANCE',
    ...identity,
  }
  const missingFields = HISTORICAL_MAINTENANCE_LOGICAL_ARTIFACT_KEY_FIELDS.filter(
    (fieldName) => completeIdentity[fieldName] === undefined,
  )

  if (missingFields.length > 0) {
    throw new Error(`Missing historical maintenance logical key fields: ${missingFields.join(', ')}`)
  }

  return HISTORICAL_MAINTENANCE_LOGICAL_ARTIFACT_KEY_FIELDS.map((fieldName) =>
    serializeField(fieldName, completeIdentity[fieldName]!),
  ).join('|')
}

export function createRollingDailyHistoricalLogicalArtifactIdentity(input: {
  seriesId: string
  targetBasis: ForecastTargetBasis
  methodId: string
  methodVersion: string
  modelId: string
  inputSource: string
  historyFingerprint: string
  historicalOriginStartDate: string
  minimumTrainingObservations: number
  minimumCalibrationSamples: number
  maxOriginsPerRun?: number
  bootstrapHistoricalIfMissing?: boolean
  fullRebuild?: boolean
}) {
  return {
    artifactScope: 'FULL_VERIFICATION',
    trainingWindowPolicyId: FULL_VERIFICATION_TRAINING_WINDOW_POLICY_ID,
    seriesId: input.seriesId,
    targetBasis: input.targetBasis,
    targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
    methodId: input.methodId,
    methodVersion: input.methodVersion,
    modelId: input.modelId,
    inputSource: input.inputSource,
    historyFingerprint: input.historyFingerprint,
    sourceFrequency: 'DAILY',
    targetCadence: 'DAILY',
    frequencyIdentity: 'FORECAST_CADENCE_V1|source=DAILY|target=DAILY',
    historicalOriginStartDate: input.historicalOriginStartDate,
    minimumTrainingObservations: String(input.minimumTrainingObservations),
    minimumCalibrationSamples: String(input.minimumCalibrationSamples),
    maxOriginsPerRun: input.maxOriginsPerRun == null ? null : String(input.maxOriginsPerRun),
    bootstrapHistoricalIfMissing: input.bootstrapHistoricalIfMissing === true ? 'YES' : 'NO',
    fullRebuild: input.fullRebuild === true ? 'YES' : 'NO',
  } satisfies HistoricalMaintenanceLogicalArtifactIdentity
}