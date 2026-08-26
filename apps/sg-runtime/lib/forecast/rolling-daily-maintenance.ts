import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import { Prisma } from '@/generated/market-data-client'
import { serverEnv } from '@/lib/env'
import type { ForecastTargetBasis } from '@/lib/forecast/contracts'
import { normalizeForecastLibraryDecimal } from '@/lib/forecast/persistence-decimal'
import {
  ROLLING_DAILY_CONFIGURED_CALIBRATION_MINIMUM_SAMPLES,
  ROLLING_DAILY_METHOD_ID,
  ROLLING_DAILY_METHOD_VERSION,
  ROLLING_DAILY_TARGET_BASIS,
  ROLLING_DAILY_TECHNICAL_MINIMUM_TRAINING_OBSERVATIONS,
} from '@/lib/forecast/rolling-daily-policy'
import { resolveBenchmarkHistoricalSeries } from '@/lib/market-data/service'
import { getMarketDataPrisma } from '@/lib/market-data/client'

const execFileAsync = promisify(execFile)
const DEFAULT_FORECASTING_LAB_ROOT = path.resolve(process.cwd(), '..', '..', 'tooling', 'Benchmark-Forecasting')
const DEFAULT_FORECASTING_PYTHON = path.join(DEFAULT_FORECASTING_LAB_ROOT, '.venv', 'bin', 'python')
const ROLLING_DAILY_MAINTENANCE_SCRIPT = ['scripts', 'export_rolling_daily_incremental_maintenance.py']
const BRIDGE_BUFFER_BYTES = 25 * 1024 * 1024

export {
  ROLLING_DAILY_METHOD_ID,
  ROLLING_DAILY_METHOD_VERSION,
  ROLLING_DAILY_TARGET_BASIS,
} from '@/lib/forecast/rolling-daily-policy'

export const ROLLING_DAILY_INPUT_SOURCE = 'DYNAMIC_MARKET_DATA_STORE'
export const DEFAULT_ROLLING_DAILY_MINIMUM_TRAINING_OBSERVATIONS = ROLLING_DAILY_TECHNICAL_MINIMUM_TRAINING_OBSERVATIONS
export const DEFAULT_ROLLING_DAILY_MINIMUM_CALIBRATION_SAMPLES = ROLLING_DAILY_CONFIGURED_CALIBRATION_MINIMUM_SAMPLES
export const DEFAULT_ROLLING_DAILY_HISTORICAL_ORIGIN_START_DATE = '2024-01-01'
export const ROLLING_DAILY_REBUILD_REQUIRED_REASON = 'SOURCE_HISTORY_REVISION_DETECTED'

type RollingDailyMaintenanceHistoryPoint = {
  date: string
  value: number | null
}

export type RollingDailyHistoryPayload = {
  seriesId: string
  displayName: string
  description: string | null
  frequency: string
  source: string | null
  points: RollingDailyMaintenanceHistoryPoint[]
}

export type RollingDailyVerificationRecordArtifact = {
  seriesId: string
  inputSource: string
  inputRunId: string | null
  targetBasis: ForecastTargetBasis
  methodId: string
  methodVersion: string
  modelId: string
  forecastOriginAt: string
  horizonLabel: string
  horizonMonths: number
  horizonSteps: number
  targetCalendarDate: string
  verificationObservedAt: string | null
  maturityStatus: 'MATURED' | 'NOT_YET_MATURED'
  originValue: number
  forecastValue: number
  actualValue: number | null
  errorValue: number | null
  absoluteErrorValue: number | null
  deltaValue: number | null
  deltaPct: number | null
  residualValue: number | null
  maseScale: number
  trainingHistoryStartAt: string | null
  trainingHistoryEndAt: string
  trainingObservationCount: number
  sourceHistoryFingerprint: string
  metadata: Record<string, unknown> | null
  selectedVariant: string | null
  selectionMetric: string | null
  selectionScore: number | null
}

export type RollingDailyCalibrationGroupArtifact = {
  seriesId: string
  inputSource: string
  inputRunId: string | null
  targetBasis: ForecastTargetBasis
  methodId: string
  methodVersion: string
  modelId: string
  horizonLabel: string
  horizonMonths: number
  calibrationOriginAt: string
  sampleCount: number
  residualP10: number | null
  residualP90: number | null
  quantileMethod: string
  status: 'AVAILABLE' | 'INSUFFICIENT_CALIBRATION_HISTORY'
  lastResidualObservedAt: string | null
  refreshedAt: string
}

export type RollingDailyMaintenanceStateArtifact = {
  seriesId: string
  inputSource: string
  inputRunId: string | null
  targetBasis: ForecastTargetBasis
  methodId: string
  methodVersion: string
  modelId: string
  historicalOriginStartAt: string
  minimumTrainingObservations: number
  minimumCalibrationSamples: number
  latestSourceObservationAt: string | null
  latestSourceHistoryStartAt: string | null
  latestSourceObservationCount: number | null
  latestSourceHistoryFingerprint: string | null
  lastProcessedOriginAt: string | null
  lastMaturedObservedAt: string | null
  lastMaintenanceAt: string | null
  lastMaintenanceStatus: string | null
  lastFailureReason: string | null
}

export type RollingDailyMaintenanceRequest = {
  seriesId: string
  modelId: string
  targetBasis?: ForecastTargetBasis
  preparedHistory?: RollingDailyHistoryPayload
  historicalOriginStartDate?: string
  minimumTrainingObservations?: number
  minimumCalibrationSamples?: number
  fullRebuild?: boolean
}

export type RollingDailyMaintenanceBridgeRequest = {
  seriesId: string
  modelId: string
  inputSource: string
  targetBasis: ForecastTargetBasis
  methodId: string
  methodVersion: string
  historicalOriginStartDate: string
  minimumTrainingObservations: number
  minimumCalibrationSamples: number
  history: RollingDailyHistoryPayload
  existingRecords: RollingDailyVerificationRecordArtifact[]
  lastProcessedOriginDate: string | null
  sourceHistoryFingerprint: string
  forceCalibrationRefresh?: boolean
}

export type RollingDailyMaintenanceBridgeResponse = {
  status: 'AVAILABLE' | 'FAILED'
  reason?: string
  methodId: string
  methodVersion: string
  sourceHistory: {
    startDate: string | null
    endDate: string | null
    latestObservationDate: string | null
    observationCount: number
    filteredNullCount: number
    filteredDuplicateCount: number
    historyFingerprint: string
  }
  maintenance: {
    newOriginCount: number
    maturedRecordCount: number
    affectedCalibrationGroupCount: number
    calibrationRefreshCount: number
    lastProcessedOriginDate: string | null
    lastMaturedObservedAt: string | null
    newOriginDates: string[]
  }
  newRecords: RollingDailyVerificationRecordArtifact[]
  maturedRecords: RollingDailyVerificationRecordArtifact[]
  calibrationGroups: RollingDailyCalibrationGroupArtifact[]
}

export type RollingDailyMaintenanceResult = {
  status: 'SUCCEEDED' | 'NO_OP' | 'REBUILD_REQUIRED'
  seriesId: string
  modelId: string
  targetBasis: ForecastTargetBasis
  inputSource: string
  methodId: string
  methodVersion: string
  reasonCode: string | null
  sourceHistoryFingerprint: string
  latestSourceObservationAt: string | null
  sourceObservationCount: number
  filteredNullCount: number
  filteredDuplicateCount: number
  newOriginCount: number
  maturedRecordCount: number
  calibrationRefreshCount: number
  affectedCalibrationGroupCount: number
  lastProcessedOriginAt: string | null
  lastMaturedObservedAt: string | null
  runtimeMs: number
}

export type RollingDailyMaintenanceRepository = {
  readState(identity: RollingDailyMaintenanceIdentity): Promise<RollingDailyMaintenanceStateArtifact | null>
  listVerificationRecords(identity: RollingDailyMaintenanceIdentity): Promise<RollingDailyVerificationRecordArtifact[]>
  applyMaintenanceUpdate(input: RollingDailyPersistedUpdate): Promise<void>
  recordMaintenanceFailure(input: RollingDailyFailureUpdate): Promise<void>
}

export type RollingDailyMaintenanceRunner = {
  run(request: RollingDailyMaintenanceBridgeRequest): Promise<RollingDailyMaintenanceBridgeResponse>
}

export type RollingDailyMaintenanceIdentity = {
  seriesId: string
  inputSource: string
  targetBasis: ForecastTargetBasis
  methodId: string
  methodVersion: string
  modelId: string
}

export type RollingDailyPersistedUpdate = {
  identity: RollingDailyMaintenanceIdentity
  inputRunId: string | null
  historicalOriginStartAt: string
  minimumTrainingObservations: number
  minimumCalibrationSamples: number
  latestSourceObservationAt: string | null
  latestSourceHistoryStartAt: string | null
  latestSourceObservationCount: number
  latestSourceHistoryFingerprint: string
  lastProcessedOriginAt: string | null
  lastMaturedObservedAt: string | null
  newRecords: RollingDailyVerificationRecordArtifact[]
  maturedRecords: RollingDailyVerificationRecordArtifact[]
  calibrationGroups: RollingDailyCalibrationGroupArtifact[]
}

export function normalizePersistedRollingDailyArtifacts(input: RollingDailyPersistedUpdate): RollingDailyPersistedUpdate {
  const normalizeRecord = (record: RollingDailyVerificationRecordArtifact): RollingDailyVerificationRecordArtifact => ({
    ...record,
    seriesId: input.identity.seriesId,
    inputSource: input.identity.inputSource,
    targetBasis: input.identity.targetBasis,
    methodId: input.identity.methodId,
    methodVersion: input.identity.methodVersion,
    modelId: input.identity.modelId,
  })

  const normalizeGroup = (group: RollingDailyCalibrationGroupArtifact): RollingDailyCalibrationGroupArtifact => ({
    ...group,
    seriesId: input.identity.seriesId,
    inputSource: input.identity.inputSource,
    targetBasis: input.identity.targetBasis,
    methodId: input.identity.methodId,
    methodVersion: input.identity.methodVersion,
    modelId: input.identity.modelId,
  })

  return {
    ...input,
    newRecords: input.newRecords.map(normalizeRecord),
    maturedRecords: input.maturedRecords.map(normalizeRecord),
    calibrationGroups: input.calibrationGroups.map(normalizeGroup),
  }
}

type RollingDailyFailureUpdate = {
  identity: RollingDailyMaintenanceIdentity
  inputRunId: string | null
  historicalOriginStartAt: string
  minimumTrainingObservations: number
  minimumCalibrationSamples: number
  latestSourceObservationAt: string | null
  latestSourceHistoryStartAt: string | null
  latestSourceObservationCount: number | null
  latestSourceHistoryFingerprint: string | null
  lastProcessedOriginAt: string | null
  lastMaturedObservedAt: string | null
  maintenanceStatus: 'FAILED' | 'REBUILD_REQUIRED'
  failureReason: string
  failedAt: string
}

type RollingDailyMaintenanceServiceDependencies = {
  repository: RollingDailyMaintenanceRepository
  runner: RollingDailyMaintenanceRunner
  loadHistory: (seriesId: string) => Promise<RollingDailyHistoryPayload>
  now: () => Date
  logEvent: (event: string, data: Record<string, string | number | boolean | null>) => void
}

function normalizeOptionalString(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : undefined
}

function buildDefaultLogPayload(data: Record<string, string | number | boolean | null>) {
  return Object.entries(data)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ')
}

function logMaintenanceEvent(event: string, data: Record<string, string | number | boolean | null>) {
  console.info(`[${event}] ${buildDefaultLogPayload(data)}`)
}

function normalizeDailyObservationDay(value: string) {
  return value.trim().slice(0, 10)
}

function serializeFingerprintValue(value: number) {
  return Number.isInteger(value) ? value.toFixed(1) : String(value)
}

function normalizeHistoryFrequency(frequency: string) {
  return frequency.trim().toUpperCase()
}

function buildCanonicalLawfulHistoryPoints(history: RollingDailyHistoryPayload) {
  const seenDates = new Set<string>()

  return [...history.points]
    .map((point) => ({
      date: normalizeDailyObservationDay(point.date),
      value: point.value,
    }))
    .sort((left, right) => left.date.localeCompare(right.date))
    .filter((point): point is { date: string; value: number } => {
      if (point.value === null) {
        return false
      }

      if (seenDates.has(point.date)) {
        return false
      }

      seenDates.add(point.date)
      return true
    })
}

export function buildRollingDailyHistoryFingerprint(history: RollingDailyHistoryPayload) {
  const hash = createHash('sha256')
  const normalizedPoints = buildCanonicalLawfulHistoryPoints(history)

  hash.update(history.seriesId)
  hash.update('\n')
  hash.update(normalizeHistoryFrequency(history.frequency))

  for (const point of normalizedPoints) {
    hash.update('\n')
    hash.update(point.date)
    hash.update('=')
    hash.update(serializeFingerprintValue(point.value))
  }

  return hash.digest('hex')
}

function buildHistoryPrefix(history: RollingDailyHistoryPayload, throughDate: string): RollingDailyHistoryPayload {
  const normalizedThroughDate = normalizeDailyObservationDay(throughDate)
  return {
    ...history,
    points: history.points.filter((point) => normalizeDailyObservationDay(point.date) <= normalizedThroughDate),
  }
}

function deriveLatestPersistedMaturedObservedAt(records: RollingDailyVerificationRecordArtifact[]) {
  const observedDates = records
    .filter((record) => record.maturityStatus === 'MATURED' && record.verificationObservedAt)
    .map((record) => normalizeDailyObservationDay(record.verificationObservedAt as string))

  if (observedDates.length === 0) {
    return null
  }

  return observedDates.sort()[observedDates.length - 1] ?? null
}

function detectSourceHistoryRevision(
  history: RollingDailyHistoryPayload,
  state: RollingDailyMaintenanceStateArtifact | null,
): { reasonCode: typeof ROLLING_DAILY_REBUILD_REQUIRED_REASON } | null {
  if (!state?.latestSourceObservationAt || !state.latestSourceHistoryFingerprint) {
    return null
  }

  const priorPrefix = buildHistoryPrefix(history, state.latestSourceObservationAt)
  const priorPrefixFingerprint = buildRollingDailyHistoryFingerprint(priorPrefix)
  if (priorPrefixFingerprint !== state.latestSourceHistoryFingerprint) {
    return {
      reasonCode: ROLLING_DAILY_REBUILD_REQUIRED_REASON,
    }
  }

  return null
}

function toPrismaNullableJson(value: Prisma.InputJsonValue | null) {
  return value === null ? Prisma.JsonNull : value
}

function createDefaultRunner(): RollingDailyMaintenanceRunner {
  const labRoot = normalizeOptionalString(serverEnv.FORECASTING_LAB_ROOT) ?? DEFAULT_FORECASTING_LAB_ROOT
  const pythonBin = normalizeOptionalString(serverEnv.FORECASTING_PYTHON_BIN) ?? DEFAULT_FORECASTING_PYTHON
  const scriptPath = path.join(labRoot, ...ROLLING_DAILY_MAINTENANCE_SCRIPT)

  return {
    async run(request) {
      if (!existsSync(pythonBin)) {
        return {
          status: 'FAILED',
          reason: `Forecasting Python interpreter is unavailable at ${pythonBin}.`,
          methodId: request.methodId,
          methodVersion: request.methodVersion,
          sourceHistory: {
            startDate: null,
            endDate: null,
            latestObservationDate: null,
            observationCount: 0,
            filteredNullCount: 0,
            filteredDuplicateCount: 0,
            historyFingerprint: request.sourceHistoryFingerprint,
          },
          maintenance: {
            newOriginCount: 0,
            maturedRecordCount: 0,
            affectedCalibrationGroupCount: 0,
            calibrationRefreshCount: 0,
            lastProcessedOriginDate: null,
            lastMaturedObservedAt: null,
            newOriginDates: [],
          },
          newRecords: [],
          maturedRecords: [],
          calibrationGroups: [],
        }
      }

      if (!existsSync(scriptPath)) {
        return {
          status: 'FAILED',
          reason: `Rolling daily maintenance bridge script is unavailable at ${scriptPath}.`,
          methodId: request.methodId,
          methodVersion: request.methodVersion,
          sourceHistory: {
            startDate: null,
            endDate: null,
            latestObservationDate: null,
            observationCount: 0,
            filteredNullCount: 0,
            filteredDuplicateCount: 0,
            historyFingerprint: request.sourceHistoryFingerprint,
          },
          maintenance: {
            newOriginCount: 0,
            maturedRecordCount: 0,
            affectedCalibrationGroupCount: 0,
            calibrationRefreshCount: 0,
            lastProcessedOriginDate: null,
            lastMaturedObservedAt: null,
            newOriginDates: [],
          },
          newRecords: [],
          maturedRecords: [],
          calibrationGroups: [],
        }
      }

      const tempDirectory = await mkdtemp(path.join(tmpdir(), 'sg-runtime-rolling-daily-'))
      const inputPath = path.join(tempDirectory, 'input.json')
      const outputPath = path.join(tempDirectory, 'output.json')

      try {
        await writeFile(inputPath, JSON.stringify(request), 'utf8')

        const { stderr } = await execFileAsync(
          pythonBin,
          [
            scriptPath,
            '--input-json',
            inputPath,
            '--output-json',
            outputPath,
          ],
          {
            cwd: labRoot,
            maxBuffer: BRIDGE_BUFFER_BYTES,
          },
        )

        const output = JSON.parse(await readFile(outputPath, 'utf8')) as RollingDailyMaintenanceBridgeResponse
        if (output.status === 'FAILED' && stderr.trim().length > 0 && !output.reason) {
          output.reason = stderr.trim()
        }
        return output
      } finally {
        await rm(tempDirectory, { recursive: true, force: true })
      }
    },
  }
}

function mapStoredVerificationRecord(
  record: Prisma.RollingDailyVerificationRecordGetPayload<Record<string, never>>,
): RollingDailyVerificationRecordArtifact {
  return {
    seriesId: record.seriesId,
    inputSource: record.inputSource,
    inputRunId: record.inputRunId,
    targetBasis: record.targetBasis,
    methodId: record.methodId,
    methodVersion: record.methodVersion,
    modelId: record.modelId,
    forecastOriginAt: record.forecastOriginAt.toISOString(),
    horizonLabel: record.horizonLabel,
    horizonMonths: record.horizonMonths,
    horizonSteps: record.horizonSteps,
    targetCalendarDate: record.targetCalendarDate.toISOString(),
    verificationObservedAt: record.verificationObservedAt?.toISOString() ?? null,
    maturityStatus: record.maturityStatus,
    originValue: Number(record.originValue),
    forecastValue: Number(record.forecastValue),
    actualValue: record.actualValue === null ? null : Number(record.actualValue),
    errorValue: record.errorValue === null ? null : Number(record.errorValue),
    absoluteErrorValue: record.absoluteErrorValue === null ? null : Number(record.absoluteErrorValue),
    deltaValue: record.deltaValue === null ? null : Number(record.deltaValue),
    deltaPct: record.deltaPct,
    residualValue: record.residualValue === null ? null : Number(record.residualValue),
    maseScale: record.maseScale,
    trainingHistoryStartAt: record.trainingHistoryStartAt?.toISOString() ?? null,
    trainingHistoryEndAt: record.trainingHistoryEndAt.toISOString(),
    trainingObservationCount: record.trainingObservationCount,
    sourceHistoryFingerprint: record.sourceHistoryFingerprint,
    metadata: (record.metadataJson as Record<string, unknown> | null) ?? null,
    selectedVariant: record.selectedVariant,
    selectionMetric: record.selectionMetric,
    selectionScore: record.selectionScore,
  }
}

async function readStateWithPrisma(identity: RollingDailyMaintenanceIdentity): Promise<RollingDailyMaintenanceStateArtifact | null> {
  const prisma = getMarketDataPrisma()
  if (!prisma) {
    throw new Error('Forecast library datastore is unavailable.')
  }

  const state = await prisma.rollingDailyMaintenanceState.findUnique({
    where: {
      seriesId_inputSource_targetBasis_methodId_methodVersion_modelId: identity,
    },
  })

  if (!state) {
    return null
  }

  return {
    seriesId: state.seriesId,
    inputSource: state.inputSource,
    inputRunId: state.inputRunId,
    targetBasis: state.targetBasis,
    methodId: state.methodId,
    methodVersion: state.methodVersion,
    modelId: state.modelId,
    historicalOriginStartAt: state.historicalOriginStartAt.toISOString(),
    minimumTrainingObservations: state.minimumTrainingObservations,
    minimumCalibrationSamples: state.minimumCalibrationSamples,
    latestSourceObservationAt: state.latestSourceObservationAt?.toISOString() ?? null,
    latestSourceHistoryStartAt: state.latestSourceHistoryStartAt?.toISOString() ?? null,
    latestSourceObservationCount: state.latestSourceObservationCount,
    latestSourceHistoryFingerprint: state.latestSourceHistoryFingerprint,
    lastProcessedOriginAt: state.lastProcessedOriginAt?.toISOString() ?? null,
    lastMaturedObservedAt: state.lastMaturedObservedAt?.toISOString() ?? null,
    lastMaintenanceAt: state.lastMaintenanceAt?.toISOString() ?? null,
    lastMaintenanceStatus: state.lastMaintenanceStatus,
    lastFailureReason: state.lastFailureReason,
  }
}

async function listVerificationRecordsWithPrisma(identity: RollingDailyMaintenanceIdentity) {
  const prisma = getMarketDataPrisma()
  if (!prisma) {
    throw new Error('Forecast library datastore is unavailable.')
  }

  const records = await prisma.rollingDailyVerificationRecord.findMany({
    where: identity,
    orderBy: [
      { forecastOriginAt: 'asc' },
      { horizonMonths: 'asc' },
    ],
  })

  return records.map(mapStoredVerificationRecord)
}

async function applyMaintenanceUpdateWithPrisma(input: RollingDailyPersistedUpdate) {
  const prisma = getMarketDataPrisma()
  if (!prisma) {
    throw new Error('Forecast library datastore is unavailable.')
  }

  const normalizedInput = normalizePersistedRollingDailyArtifacts(input)

  const persistenceOperations: Prisma.PrismaPromise<unknown>[] = []
  const updatedRecords = [...normalizedInput.newRecords, ...normalizedInput.maturedRecords]

  for (const record of updatedRecords) {
    persistenceOperations.push(prisma.rollingDailyVerificationRecord.upsert({
        where: {
          seriesId_inputSource_targetBasis_methodId_methodVersion_modelId_forecastOriginAt_horizonLabel: {
            seriesId: record.seriesId,
            inputSource: record.inputSource,
            targetBasis: record.targetBasis,
            methodId: record.methodId,
            methodVersion: record.methodVersion,
            modelId: record.modelId,
            forecastOriginAt: new Date(record.forecastOriginAt),
            horizonLabel: record.horizonLabel,
          },
        },
        create: {
          seriesId: record.seriesId,
          inputSource: record.inputSource,
          inputRunId: record.inputRunId,
          targetBasis: record.targetBasis,
          methodId: record.methodId,
          methodVersion: record.methodVersion,
          modelId: record.modelId,
          forecastOriginAt: new Date(record.forecastOriginAt),
          horizonLabel: record.horizonLabel,
          horizonMonths: record.horizonMonths,
          horizonSteps: record.horizonSteps,
          targetCalendarDate: new Date(record.targetCalendarDate),
          verificationObservedAt: record.verificationObservedAt ? new Date(record.verificationObservedAt) : null,
          maturityStatus: record.maturityStatus,
          originValue: normalizeForecastLibraryDecimal(record.originValue),
          forecastValue: normalizeForecastLibraryDecimal(record.forecastValue),
          actualValue: record.actualValue === null ? null : normalizeForecastLibraryDecimal(record.actualValue),
          errorValue: record.errorValue === null ? null : normalizeForecastLibraryDecimal(record.errorValue),
          absoluteErrorValue: record.absoluteErrorValue === null ? null : normalizeForecastLibraryDecimal(record.absoluteErrorValue),
          deltaValue: record.deltaValue === null ? null : normalizeForecastLibraryDecimal(record.deltaValue),
          deltaPct: record.deltaPct,
          residualValue: record.residualValue === null ? null : normalizeForecastLibraryDecimal(record.residualValue),
          maseScale: record.maseScale,
          trainingHistoryStartAt: record.trainingHistoryStartAt ? new Date(record.trainingHistoryStartAt) : null,
          trainingHistoryEndAt: new Date(record.trainingHistoryEndAt),
          trainingObservationCount: record.trainingObservationCount,
          sourceHistoryFingerprint: record.sourceHistoryFingerprint,
          metadataJson: toPrismaNullableJson(record.metadata as Prisma.InputJsonValue | null),
          selectedVariant: record.selectedVariant,
          selectionMetric: record.selectionMetric,
          selectionScore: record.selectionScore,
        },
        update: {
          inputRunId: record.inputRunId,
          horizonMonths: record.horizonMonths,
          horizonSteps: record.horizonSteps,
          targetCalendarDate: new Date(record.targetCalendarDate),
          verificationObservedAt: record.verificationObservedAt ? new Date(record.verificationObservedAt) : null,
          maturityStatus: record.maturityStatus,
          actualValue: record.actualValue === null ? null : normalizeForecastLibraryDecimal(record.actualValue),
          errorValue: record.errorValue === null ? null : normalizeForecastLibraryDecimal(record.errorValue),
          absoluteErrorValue: record.absoluteErrorValue === null ? null : normalizeForecastLibraryDecimal(record.absoluteErrorValue),
          deltaValue: record.deltaValue === null ? null : normalizeForecastLibraryDecimal(record.deltaValue),
          deltaPct: record.deltaPct,
          residualValue: record.residualValue === null ? null : normalizeForecastLibraryDecimal(record.residualValue),
          sourceHistoryFingerprint: record.sourceHistoryFingerprint,
          metadataJson: toPrismaNullableJson(record.metadata as Prisma.InputJsonValue | null),
          selectedVariant: record.selectedVariant,
          selectionMetric: record.selectionMetric,
          selectionScore: record.selectionScore,
        },
      }))
  }

  for (const group of normalizedInput.calibrationGroups) {
    persistenceOperations.push(prisma.rollingDailyCalibrationGroup.upsert({
        where: {
          seriesId_inputSource_targetBasis_methodId_methodVersion_modelId_horizonLabel: {
            seriesId: group.seriesId,
            inputSource: group.inputSource,
            targetBasis: group.targetBasis,
            methodId: group.methodId,
            methodVersion: group.methodVersion,
            modelId: group.modelId,
            horizonLabel: group.horizonLabel,
          },
        },
        create: {
          seriesId: group.seriesId,
          inputSource: group.inputSource,
          inputRunId: group.inputRunId,
          targetBasis: group.targetBasis,
          methodId: group.methodId,
          methodVersion: group.methodVersion,
          modelId: group.modelId,
          horizonLabel: group.horizonLabel,
          horizonMonths: group.horizonMonths,
          calibrationOriginAt: new Date(group.calibrationOriginAt),
          sampleCount: group.sampleCount,
          residualP10: group.residualP10 === null ? null : normalizeForecastLibraryDecimal(group.residualP10),
          residualP90: group.residualP90 === null ? null : normalizeForecastLibraryDecimal(group.residualP90),
          quantileMethod: group.quantileMethod,
          status: group.status,
          lastResidualObservedAt: group.lastResidualObservedAt ? new Date(group.lastResidualObservedAt) : null,
          refreshedAt: new Date(group.refreshedAt),
        },
        update: {
          inputRunId: group.inputRunId,
          horizonMonths: group.horizonMonths,
          calibrationOriginAt: new Date(group.calibrationOriginAt),
          sampleCount: group.sampleCount,
          residualP10: group.residualP10 === null ? null : normalizeForecastLibraryDecimal(group.residualP10),
          residualP90: group.residualP90 === null ? null : normalizeForecastLibraryDecimal(group.residualP90),
          quantileMethod: group.quantileMethod,
          status: group.status,
          lastResidualObservedAt: group.lastResidualObservedAt ? new Date(group.lastResidualObservedAt) : null,
          refreshedAt: new Date(group.refreshedAt),
        },
      }))
  }

  persistenceOperations.push(prisma.rollingDailyMaintenanceState.upsert({
    where: {
      seriesId_inputSource_targetBasis_methodId_methodVersion_modelId: input.identity,
    },
    create: {
      seriesId: normalizedInput.identity.seriesId,
      inputSource: normalizedInput.identity.inputSource,
      inputRunId: normalizedInput.inputRunId,
      targetBasis: normalizedInput.identity.targetBasis,
      methodId: normalizedInput.identity.methodId,
      methodVersion: normalizedInput.identity.methodVersion,
      modelId: normalizedInput.identity.modelId,
      historicalOriginStartAt: new Date(normalizedInput.historicalOriginStartAt),
      minimumTrainingObservations: normalizedInput.minimumTrainingObservations,
      minimumCalibrationSamples: normalizedInput.minimumCalibrationSamples,
      latestSourceObservationAt: normalizedInput.latestSourceObservationAt ? new Date(normalizedInput.latestSourceObservationAt) : null,
      latestSourceHistoryStartAt: normalizedInput.latestSourceHistoryStartAt ? new Date(normalizedInput.latestSourceHistoryStartAt) : null,
      latestSourceObservationCount: normalizedInput.latestSourceObservationCount,
      latestSourceHistoryFingerprint: normalizedInput.latestSourceHistoryFingerprint,
      lastProcessedOriginAt: normalizedInput.lastProcessedOriginAt ? new Date(normalizedInput.lastProcessedOriginAt) : null,
      lastMaturedObservedAt: normalizedInput.lastMaturedObservedAt ? new Date(normalizedInput.lastMaturedObservedAt) : null,
      lastMaintenanceAt: new Date(),
      lastMaintenanceStatus: 'SUCCEEDED',
      lastFailureReason: null,
    },
    update: {
      inputRunId: normalizedInput.inputRunId,
      historicalOriginStartAt: new Date(normalizedInput.historicalOriginStartAt),
      minimumTrainingObservations: normalizedInput.minimumTrainingObservations,
      minimumCalibrationSamples: normalizedInput.minimumCalibrationSamples,
      latestSourceObservationAt: normalizedInput.latestSourceObservationAt ? new Date(normalizedInput.latestSourceObservationAt) : null,
      latestSourceHistoryStartAt: normalizedInput.latestSourceHistoryStartAt ? new Date(normalizedInput.latestSourceHistoryStartAt) : null,
      latestSourceObservationCount: normalizedInput.latestSourceObservationCount,
      latestSourceHistoryFingerprint: normalizedInput.latestSourceHistoryFingerprint,
      lastProcessedOriginAt: normalizedInput.lastProcessedOriginAt ? new Date(normalizedInput.lastProcessedOriginAt) : null,
      lastMaturedObservedAt: normalizedInput.lastMaturedObservedAt ? new Date(normalizedInput.lastMaturedObservedAt) : null,
      lastMaintenanceAt: new Date(),
      lastMaintenanceStatus: 'SUCCEEDED',
      lastFailureReason: null,
    },
  }))

  await prisma.$transaction(persistenceOperations)
}

async function recordMaintenanceFailureWithPrisma(input: RollingDailyFailureUpdate) {
  const prisma = getMarketDataPrisma()
  if (!prisma) {
    throw new Error('Forecast library datastore is unavailable.')
  }

  await prisma.rollingDailyMaintenanceState.upsert({
    where: {
      seriesId_inputSource_targetBasis_methodId_methodVersion_modelId: input.identity,
    },
    create: {
      seriesId: input.identity.seriesId,
      inputSource: input.identity.inputSource,
      inputRunId: input.inputRunId,
      targetBasis: input.identity.targetBasis,
      methodId: input.identity.methodId,
      methodVersion: input.identity.methodVersion,
      modelId: input.identity.modelId,
      historicalOriginStartAt: new Date(input.historicalOriginStartAt),
      minimumTrainingObservations: input.minimumTrainingObservations,
      minimumCalibrationSamples: input.minimumCalibrationSamples,
      latestSourceObservationAt: input.latestSourceObservationAt ? new Date(input.latestSourceObservationAt) : null,
      latestSourceHistoryStartAt: input.latestSourceHistoryStartAt ? new Date(input.latestSourceHistoryStartAt) : null,
      latestSourceObservationCount: input.latestSourceObservationCount,
      latestSourceHistoryFingerprint: input.latestSourceHistoryFingerprint,
      lastProcessedOriginAt: input.lastProcessedOriginAt ? new Date(input.lastProcessedOriginAt) : null,
      lastMaturedObservedAt: input.lastMaturedObservedAt ? new Date(input.lastMaturedObservedAt) : null,
      lastMaintenanceAt: new Date(input.failedAt),
      lastMaintenanceStatus: 'FAILED',
      lastFailureReason: input.failureReason,
    },
    update: {
      inputRunId: input.inputRunId,
      historicalOriginStartAt: new Date(input.historicalOriginStartAt),
      minimumTrainingObservations: input.minimumTrainingObservations,
      minimumCalibrationSamples: input.minimumCalibrationSamples,
      latestSourceObservationAt: input.latestSourceObservationAt ? new Date(input.latestSourceObservationAt) : null,
      latestSourceHistoryStartAt: input.latestSourceHistoryStartAt ? new Date(input.latestSourceHistoryStartAt) : null,
      latestSourceObservationCount: input.latestSourceObservationCount,
      latestSourceHistoryFingerprint: input.latestSourceHistoryFingerprint,
      lastProcessedOriginAt: input.lastProcessedOriginAt ? new Date(input.lastProcessedOriginAt) : null,
      lastMaturedObservedAt: input.lastMaturedObservedAt ? new Date(input.lastMaturedObservedAt) : null,
      lastMaintenanceAt: new Date(input.failedAt),
      lastMaintenanceStatus: input.maintenanceStatus,
      lastFailureReason: input.failureReason,
    },
  })
}

function createDefaultRepository(): RollingDailyMaintenanceRepository {
  return {
    readState: readStateWithPrisma,
    listVerificationRecords: listVerificationRecordsWithPrisma,
    applyMaintenanceUpdate: applyMaintenanceUpdateWithPrisma,
    recordMaintenanceFailure: recordMaintenanceFailureWithPrisma,
  }
}

async function loadRawDailyHistory(seriesId: string): Promise<RollingDailyHistoryPayload> {
  const { history } = await resolveBenchmarkHistoricalSeries(seriesId, 'ALL')
  return {
    seriesId: history.providerSeries.providerSeriesId,
    displayName: history.displayName,
    description: history.displayName,
    frequency: history.frequency ?? 'DAILY',
    source: history.source,
    points: history.historical.map((point) => ({
      date: point.date,
      value: point.value,
    })),
  }
}

function summarizeHistoryState(history: RollingDailyHistoryPayload) {
  const lawfulPoints = buildCanonicalLawfulHistoryPoints(history)

  return {
    latestSourceObservationAt: lawfulPoints[lawfulPoints.length - 1]?.date ?? null,
    latestSourceHistoryStartAt: lawfulPoints[0]?.date ?? null,
    latestSourceObservationCount: lawfulPoints.length,
  }
}

export function createRollingDailyMaintenanceRunner(): RollingDailyMaintenanceRunner {
  return createDefaultRunner()
}

export function createRollingDailyMaintenanceRepository(): RollingDailyMaintenanceRepository {
  return createDefaultRepository()
}

export async function loadRollingDailyHistory(seriesId: string): Promise<RollingDailyHistoryPayload> {
  return loadRawDailyHistory(seriesId)
}

export function createRollingDailyMaintenanceService(
  dependencies: Partial<RollingDailyMaintenanceServiceDependencies> = {},
) {
  const resolvedDependencies: RollingDailyMaintenanceServiceDependencies = {
    repository: dependencies.repository ?? createDefaultRepository(),
    runner: dependencies.runner ?? createDefaultRunner(),
    loadHistory: dependencies.loadHistory ?? loadRawDailyHistory,
    now: dependencies.now ?? (() => new Date()),
    logEvent: dependencies.logEvent ?? logMaintenanceEvent,
  }

  return {
    async runIncrementalMaintenance(input: RollingDailyMaintenanceRequest): Promise<RollingDailyMaintenanceResult> {
      const startedAt = performance.now()
      const targetBasis = input.targetBasis ?? ROLLING_DAILY_TARGET_BASIS
      const identity: RollingDailyMaintenanceIdentity = {
        seriesId: input.seriesId,
        inputSource: ROLLING_DAILY_INPUT_SOURCE,
        targetBasis,
        methodId: ROLLING_DAILY_METHOD_ID,
        methodVersion: ROLLING_DAILY_METHOD_VERSION,
        modelId: input.modelId,
      }

      const [history, state, existingRecords] = await Promise.all([
        input.preparedHistory ?? resolvedDependencies.loadHistory(input.seriesId),
        resolvedDependencies.repository.readState(identity),
        resolvedDependencies.repository.listVerificationRecords(identity),
      ])

      const historicalOriginStartDate = input.historicalOriginStartDate
        ?? state?.historicalOriginStartAt?.slice(0, 10)
        ?? DEFAULT_ROLLING_DAILY_HISTORICAL_ORIGIN_START_DATE
      const minimumTrainingObservations = input.minimumTrainingObservations
        ?? state?.minimumTrainingObservations
        ?? DEFAULT_ROLLING_DAILY_MINIMUM_TRAINING_OBSERVATIONS
      const minimumCalibrationSamples = input.minimumCalibrationSamples
        ?? state?.minimumCalibrationSamples
        ?? DEFAULT_ROLLING_DAILY_MINIMUM_CALIBRATION_SAMPLES
      const sourceHistoryFingerprint = buildRollingDailyHistoryFingerprint(history)
      const historyState = summarizeHistoryState(history)
      const latestPersistedMaturedObservedAt = deriveLatestPersistedMaturedObservedAt(existingRecords)
      const stateLastMaturedObservedAt = state?.lastMaturedObservedAt
        ? normalizeDailyObservationDay(state.lastMaturedObservedAt)
        : null
      const forceCalibrationRefresh = latestPersistedMaturedObservedAt !== null
        && latestPersistedMaturedObservedAt !== stateLastMaturedObservedAt

      const persistFailureState = async (
        failureReason: string,
        maintenanceStatus: 'FAILED' | 'REBUILD_REQUIRED',
        options: {
          latestSourceObservationAt?: string | null
          latestSourceHistoryStartAt?: string | null
          latestSourceObservationCount?: number | null
          latestSourceHistoryFingerprint?: string | null
          lastProcessedOriginAt?: string | null
          lastMaturedObservedAt?: string | null
        } = {},
      ) => {
        try {
          await resolvedDependencies.repository.recordMaintenanceFailure({
            identity,
            inputRunId: null,
            historicalOriginStartAt: `${historicalOriginStartDate}T00:00:00.000Z`,
            minimumTrainingObservations,
            minimumCalibrationSamples,
            latestSourceObservationAt: options.latestSourceObservationAt ?? historyState.latestSourceObservationAt,
            latestSourceHistoryStartAt: options.latestSourceHistoryStartAt ?? historyState.latestSourceHistoryStartAt,
            latestSourceObservationCount: options.latestSourceObservationCount ?? historyState.latestSourceObservationCount,
            latestSourceHistoryFingerprint: options.latestSourceHistoryFingerprint ?? sourceHistoryFingerprint,
            lastProcessedOriginAt: options.lastProcessedOriginAt ?? (input.fullRebuild ? null : state?.lastProcessedOriginAt ?? null),
            lastMaturedObservedAt: options.lastMaturedObservedAt ?? state?.lastMaturedObservedAt ?? null,
            maintenanceStatus,
            failureReason,
            failedAt: resolvedDependencies.now().toISOString(),
          })
        } catch (error) {
          resolvedDependencies.logEvent('ROLLING_DAILY_INCREMENTAL_MAINTENANCE_FAILURE_STATE', {
            seriesId: input.seriesId,
            modelId: input.modelId,
            persistFailure: true,
            failureReason,
            persistError: error instanceof Error ? error.message : 'unknown',
          })
        }
      }

      if (!input.fullRebuild) {
        const revision = detectSourceHistoryRevision(history, state)
        if (revision) {
          await persistFailureState(revision.reasonCode, 'REBUILD_REQUIRED', {
            latestSourceObservationAt: state?.latestSourceObservationAt ?? null,
            latestSourceHistoryStartAt: state?.latestSourceHistoryStartAt ?? null,
            latestSourceObservationCount: state?.latestSourceObservationCount ?? null,
            latestSourceHistoryFingerprint: state?.latestSourceHistoryFingerprint ?? null,
            lastProcessedOriginAt: state?.lastProcessedOriginAt ?? null,
            lastMaturedObservedAt: state?.lastMaturedObservedAt ?? null,
          })

          resolvedDependencies.logEvent('ROLLING_DAILY_INCREMENTAL_MAINTENANCE', {
            seriesId: input.seriesId,
            modelId: input.modelId,
            status: 'REBUILD_REQUIRED',
            runtimeMs: Math.round(performance.now() - startedAt),
            newOriginCount: 0,
            maturedRecordCount: 0,
            calibrationRefreshCount: 0,
          })

          return {
            status: 'REBUILD_REQUIRED',
            seriesId: input.seriesId,
            modelId: input.modelId,
            targetBasis,
            inputSource: identity.inputSource,
            methodId: identity.methodId,
            methodVersion: identity.methodVersion,
            reasonCode: revision.reasonCode,
            sourceHistoryFingerprint,
            latestSourceObservationAt: historyState.latestSourceObservationAt,
            sourceObservationCount: historyState.latestSourceObservationCount,
            filteredNullCount: 0,
            filteredDuplicateCount: 0,
            newOriginCount: 0,
            maturedRecordCount: 0,
            calibrationRefreshCount: 0,
            affectedCalibrationGroupCount: 0,
            lastProcessedOriginAt: state?.lastProcessedOriginAt ?? null,
            lastMaturedObservedAt: state?.lastMaturedObservedAt ?? null,
            runtimeMs: Math.round(performance.now() - startedAt),
          }
        }
      }

      const bridgeResponse = await resolvedDependencies.runner.run({
        seriesId: input.seriesId,
        modelId: input.modelId,
        inputSource: identity.inputSource,
        targetBasis,
        methodId: ROLLING_DAILY_METHOD_ID,
        methodVersion: ROLLING_DAILY_METHOD_VERSION,
        historicalOriginStartDate,
        minimumTrainingObservations,
        minimumCalibrationSamples,
        history,
        existingRecords: input.fullRebuild ? [] : existingRecords,
        lastProcessedOriginDate: input.fullRebuild ? null : state?.lastProcessedOriginAt?.slice(0, 10) ?? null,
        sourceHistoryFingerprint,
        forceCalibrationRefresh,
      })

      if (bridgeResponse.status === 'FAILED') {
        const failureReason = bridgeResponse.reason ?? 'Rolling daily maintenance bridge failed.'
        await persistFailureState(failureReason, 'FAILED')
        throw new Error(failureReason)
      }

      try {
        await resolvedDependencies.repository.applyMaintenanceUpdate({
          identity,
          inputRunId: null,
          historicalOriginStartAt: `${historicalOriginStartDate}T00:00:00.000Z`,
          minimumTrainingObservations,
          minimumCalibrationSamples,
          latestSourceObservationAt: bridgeResponse.sourceHistory.latestObservationDate,
          latestSourceHistoryStartAt: bridgeResponse.sourceHistory.startDate,
          latestSourceObservationCount: bridgeResponse.sourceHistory.observationCount,
          latestSourceHistoryFingerprint: bridgeResponse.sourceHistory.historyFingerprint,
          lastProcessedOriginAt: bridgeResponse.maintenance.lastProcessedOriginDate,
          lastMaturedObservedAt: bridgeResponse.maintenance.lastMaturedObservedAt,
          newRecords: bridgeResponse.newRecords,
          maturedRecords: bridgeResponse.maturedRecords,
          calibrationGroups: bridgeResponse.calibrationGroups,
        })
      } catch (error) {
        const failureReason = error instanceof Error ? error.message : 'Rolling daily maintenance persistence failed.'
        await persistFailureState(failureReason, 'FAILED')
        throw error
      }

      const runtimeMs = Math.round(performance.now() - startedAt)
      const status: RollingDailyMaintenanceResult['status'] = (
        bridgeResponse.maintenance.newOriginCount === 0
        && bridgeResponse.maintenance.maturedRecordCount === 0
        && bridgeResponse.maintenance.calibrationRefreshCount === 0
      )
        ? 'NO_OP'
        : 'SUCCEEDED'

      resolvedDependencies.logEvent('ROLLING_DAILY_INCREMENTAL_MAINTENANCE', {
        seriesId: input.seriesId,
        modelId: input.modelId,
        status,
        runtimeMs,
        newOriginCount: bridgeResponse.maintenance.newOriginCount,
        maturedRecordCount: bridgeResponse.maintenance.maturedRecordCount,
        calibrationRefreshCount: bridgeResponse.maintenance.calibrationRefreshCount,
      })

      return {
        status,
        seriesId: input.seriesId,
        modelId: input.modelId,
        targetBasis,
        inputSource: identity.inputSource,
        methodId: bridgeResponse.methodId,
        methodVersion: bridgeResponse.methodVersion,
        reasonCode: null,
        sourceHistoryFingerprint: bridgeResponse.sourceHistory.historyFingerprint,
        latestSourceObservationAt: bridgeResponse.sourceHistory.latestObservationDate,
        sourceObservationCount: bridgeResponse.sourceHistory.observationCount,
        filteredNullCount: bridgeResponse.sourceHistory.filteredNullCount,
        filteredDuplicateCount: bridgeResponse.sourceHistory.filteredDuplicateCount,
        newOriginCount: bridgeResponse.maintenance.newOriginCount,
        maturedRecordCount: bridgeResponse.maintenance.maturedRecordCount,
        calibrationRefreshCount: bridgeResponse.maintenance.calibrationRefreshCount,
        affectedCalibrationGroupCount: bridgeResponse.maintenance.affectedCalibrationGroupCount,
        lastProcessedOriginAt: bridgeResponse.maintenance.lastProcessedOriginDate,
        lastMaturedObservedAt: bridgeResponse.maintenance.lastMaturedObservedAt,
        runtimeMs,
      }
    },
  }
}
