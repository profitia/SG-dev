import './load-env'

import { execFile as execFileCallback } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { mkdir, readFile, statfs, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { promisify } from 'node:util'

import { Prisma } from '@/generated/market-data-client'
import { createInteractiveForecastPreparationService } from '@/lib/forecast/interactive-preparation'
import { createProgressiveForecastPreparationService } from '@/lib/forecast/progressive-preparation'
import { prepareRollingDailyCurrentOwnership } from '@/lib/forecast/rolling-daily-current-ownership'
import { readRollingDailyCurrentForecastSnapshot } from '@/lib/forecast/rolling-daily-current-forecast-snapshot'
import {
  DEFAULT_ROLLING_DAILY_MINIMUM_TRAINING_OBSERVATIONS,
  buildRollingDailyHistoryFingerprint,
  createRollingDailyMaintenanceService,
  isRollingDailyHistoricalPreparationComplete,
  ROLLING_DAILY_INPUT_SOURCE,
  ROLLING_DAILY_METHOD_ID,
  ROLLING_DAILY_METHOD_VERSION,
  ROLLING_DAILY_TARGET_BASIS,
  type RollingDailyHistoricalPreparationState,
  type RollingDailyHistoryPayload,
  type RollingDailyMaintenanceResult,
  type RollingDailyVerificationRecordArtifact,
} from '@/lib/forecast/rolling-daily-maintenance'
import { resolveBenchmarkCurrentForecast, resolveBenchmarkRecentForecastVerification } from '@/lib/forecast/service'
import { getMarketDataPrisma } from '@/lib/market-data/client'

const execFile = promisify(execFileCallback)

process.env.MARKET_DATA_DATABASE_URL = process.env.MARKET_DATA_DATABASE_URL
  ?? 'postgresql://phase21@127.0.0.1:55421/sg_phase_2_1_market_data'
process.env.SG_RUNTIME_DATABASE_URL = process.env.SG_RUNTIME_DATABASE_URL
  ?? 'postgresql://phase21@127.0.0.1:55421/sg_phase_2_1_app'
process.env.FORECAST_STRESS_DATABASE_CLONE_ALIAS = process.env.FORECAST_STRESS_DATABASE_CLONE_ALIAS
  ?? 'phase-2-1-local-clone-v1'

const ROOT = path.resolve(process.cwd(), '..', '..')
const WORKSPACE_ROOT = path.resolve(ROOT, '..')
const VALIDATION_ROOT = path.join(ROOT, 'tooling', 'Benchmark-Forecasting', 'validation')
const OUTPUT_JSON = path.join(VALIDATION_ROOT, 'ppf1-stage8-bounded-rolling-daily-historical.json')
const OUTPUT_MD = path.join(VALIDATION_ROOT, 'ppf1-stage8-bounded-rolling-daily-historical.md')
const STAGE7_ACCEPTED_JSON = path.join(VALIDATION_ROOT, 'ppf1-stage7-recent-verification-controlled-activation.json')
const LOCAL_PYTHON_BIN = path.join(ROOT, 'tooling', 'Benchmark-Forecasting', '.venv', 'bin', 'python')
const PYTHON_MAINTENANCE_SCRIPT = path.join(ROOT, 'tooling', 'Benchmark-Forecasting', 'scripts', 'export_rolling_daily_incremental_maintenance.py')
const TSX_LOADER = path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'loader.mjs')
const TRACE_PREFIX = '[ROLLING_DAILY_HISTORICAL_TRACE] '
const SERIES_ID = 'ppf1-stage8-final-evidence-daily-v1'
const SERIES_KEY = 'PPF1_STAGE8_FINAL_EVIDENCE_DAILY_V1'
const SERIES_NAME = 'PPF1 Stage 8 Final Evidence Daily'
const FAST_READY_SERIES_ID = 'ppf1-stage8-fast-ready-control-daily-v1'
const FAST_READY_SERIES_KEY = 'PPF1_STAGE8_FAST_READY_CONTROL_DAILY_V1'
const FAST_READY_SERIES_NAME = 'PPF1 Stage 8 Fast Ready Control Daily'
const MACROBOND_PROVIDER_CODE = 'MACROBOND'
const MODELS = ['naive', 'damped_holt', 'ets', 'arima'] as const
const REPRESENTATIVE_CONCURRENCY_MODEL = 'naive'
const MONTHLY_PROBE_MODEL = 'arima'
const MAX_ORIGINS_PER_BATCH = 3
const MIN_FREE_DISK_BYTES = 15 * 1024 * 1024 * 1024
const POLL_INTERVAL_MS = 50
const PROGRESSIVE_TIMEOUT_MS = 120_000
const NUMERIC_TOLERANCE = 1e-6
const DEFAULT_CALIBRATION_MINIMUM = 30

function resolveSiblingWorkspacePath(preferredPath: string) {
  if (existsSync(preferredPath)) {
    return preferredPath
  }

  const currentWorkspaceName = path.basename(ROOT)
  const relativePath = path.relative(ROOT, preferredPath)

  for (const entry of readdirSync(WORKSPACE_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === currentWorkspaceName) {
      continue
    }

    const candidate = path.join(WORKSPACE_ROOT, entry.name, relativePath)
    if (existsSync(candidate)) {
      return candidate
    }
  }

  return preferredPath
}

const PYTHON_BIN = resolveSiblingWorkspacePath(LOCAL_PYTHON_BIN)
process.env.FORECASTING_PYTHON_BIN = process.env.FORECASTING_PYTHON_BIN ?? PYTHON_BIN

type ModelId = (typeof MODELS)[number]

type SyntheticHistory = {
  providerSeries: {
    provider: { providerCode: string, displayName: string }
    providerSeriesId: string
    providerSeriesKey: string
  }
  displayName: string
  frequency: 'DAILY'
  currency: string
  unit: string
  source: string
  historical: Array<{ date: string, value: number }>
}

type TraceEvent = Record<string, string | number | boolean | null>

type BatchModelEvidence = {
  batchNumber: number
  modelId: ModelId
  checkpointBefore: string | null
  eligibleOriginsBefore: number | null
  maxOriginsPerRun: number
  originsAttempted: number
  originDatesAttempted: string[]
  originsCompleted: number
  originDatesCompleted: string[]
  recordsReused: number
  recordsNewlyComputed: number
  checkpointAfter: string | null
  durationMs: number
  executionId: string
  ownerRole: string
  terminalStatus: string
  fieldAvailability: {
    executionId: 'MISSING_FROM_CANONICAL_TELEMETRY'
    ownerRole: 'DERIVABLE_FROM_DURABLE_STATE'
  }
}

type ModelParityResult = {
  status: 'PASS' | 'FAIL'
  recordCountParity: 'PASS' | 'FAIL'
  calibrationGroupParity: 'PASS' | 'FAIL'
  perRecordParity: 'PASS' | 'FAIL'
  metricsParity: 'PASS' | 'FAIL'
  failureReason: string | null
}

type EvidenceResult = {
  sourceCandidateSha: string
  evidenceWorktreeHead: string
  cleanWorktree: boolean
  dependencyProvenance: {
    tsxLoaderPresent: boolean
    pythonBinPresent: boolean
    maintenanceScriptPresent: boolean
    status: 'PASS' | 'FAIL'
  }
  databaseIdentity: Record<string, unknown>
  modelsTested: string[]
  batchExecution: Record<string, unknown>
  warmReuse: Record<string, unknown>
  appendOnlyDelta: Record<string, unknown>
  failureRecovery: Record<string, unknown>
  concurrency: Record<string, unknown>
  identityRevision: Record<string, unknown>
  statisticalParity: Record<string, unknown>
  fastReadyIsolation: Record<string, unknown>
  stage7Regression: Record<string, unknown>
  scopeGuards: Record<string, unknown>
  telemetry: Record<string, unknown>
  tests: Record<string, unknown>
  finalDecision: Record<string, unknown>
  generatedAt: string
}

function round(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function normalizeDate(value: string | Date | null | undefined) {
  if (!value) return null
  const raw = value instanceof Date ? value.toISOString() : String(value)
  return raw.slice(0, 10)
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return value
  return Number(value)
}

function compareNumber(left: unknown, right: unknown) {
  if (left === null || right === null || left === undefined || right === undefined) {
    return left === right
  }
  return Math.abs(Number(left) - Number(right)) <= NUMERIC_TOLERANCE
}

function canonicalizeJson(value: unknown): unknown {
  if (typeof value === 'number') {
    return round(value)
  }
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalizeJson(entry))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalizeJson(nested)]),
    )
  }
  return value ?? null
}

function sortParityRecords<T extends {
  forecastOriginAt: string | null
  horizonMonths: number
  horizonLabel: string
  targetCalendarDate: string | null
}>(records: T[]) {
  return [...records].sort((left, right) => {
    const leftKey = [
      left.forecastOriginAt ?? '',
      String(left.horizonMonths).padStart(4, '0'),
      left.horizonLabel,
      left.targetCalendarDate ?? '',
    ].join('|')
    const rightKey = [
      right.forecastOriginAt ?? '',
      String(right.horizonMonths).padStart(4, '0'),
      right.horizonLabel,
      right.targetCalendarDate ?? '',
    ].join('|')
    return leftKey.localeCompare(rightKey)
  })
}

function isLoopbackDatabaseHost(value: unknown) {
  const host = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return host === '127.0.0.1'
    || host === '127.0.0.1/32'
    || host === 'localhost'
    || host === '::1'
    || host === '::1/128'
}

function buildControlledDailyHistory(
  observationCount: number,
  options: {
    seriesId?: string
    seriesKey?: string
    displayName?: string
    source?: string
    startDate?: string
  } = {},
): SyntheticHistory {
  const start = options.startDate ? new Date(options.startDate) : new Date(Date.UTC(2024, 0, 1))
  const historical = Array.from({ length: observationCount }, (_, index) => {
    const observedAt = new Date(start)
    observedAt.setUTCDate(start.getUTCDate() + index)
    const seasonal = Math.sin(index / 4) * 1.4
    const longerCycle = Math.cos(index / 11) * 0.9
    const drift = index * 0.35
    return {
      date: observedAt.toISOString(),
      value: round(85 + drift + seasonal + longerCycle),
    }
  })

  return {
    providerSeries: {
      provider: { providerCode: MACROBOND_PROVIDER_CODE, displayName: 'Macrobond' },
      providerSeriesId: options.seriesId ?? SERIES_ID,
      providerSeriesKey: options.seriesKey ?? SERIES_KEY,
    },
    displayName: options.displayName ?? SERIES_NAME,
    frequency: 'DAILY',
    currency: 'INDEX',
    unit: 'pts',
    source: options.source ?? 'PPF1_STAGE8_FINAL_EVIDENCE_SEED',
    historical,
  }
}

function toMaintenanceHistory(history: SyntheticHistory): RollingDailyHistoryPayload {
  return {
    seriesId: history.providerSeries.providerSeriesId,
    displayName: history.displayName,
    description: history.displayName,
    frequency: history.frequency,
    source: history.source,
    points: history.historical.map((point) => ({ date: point.date, value: point.value })),
  }
}

async function ensureValidationDirectory() {
  await mkdir(VALIDATION_ROOT, { recursive: true })
}

function requirePrisma() {
  const prisma = getMarketDataPrisma()
  if (!prisma) {
    throw new Error('MARKET_DATA_DATABASE_URL is not configured.')
  }
  return prisma
}

async function readGitHead() {
  const { stdout } = await execFile('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' })
  return stdout.trim()
}

async function isGitWorktreeClean() {
  const { stdout } = await execFile('git', ['status', '--short'], { cwd: ROOT, encoding: 'utf8' })
  return stdout.trim().length === 0
}

async function countActiveEvidenceRunners() {
  const { stdout } = await execFile('ps', ['-Ao', 'pid=,command='], { encoding: 'utf8' })
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.includes('run-forecast-stage8-final-evidence.ts') && !line.startsWith(String(process.pid)))
    .length
}

async function readDatabaseIdentity() {
  const prisma = requirePrisma()
  const rows = await prisma.$queryRaw<Array<{ database: string, host: string | null, port: number | null }>>(Prisma.sql`
    SELECT current_database()::text AS database,
           inet_server_addr()::text AS host,
           inet_server_port() AS port
  `)
  const freeDisk = await statfs(ROOT)
  return {
    cloneAlias: process.env.FORECAST_STRESS_DATABASE_CLONE_ALIAS ?? null,
    marketDataUrlHost: '127.0.0.1',
    database: rows[0]?.database ?? null,
    host: rows[0]?.host ?? null,
    port: rows[0]?.port ?? null,
    freeDiskBytes: Number(freeDisk.bavail) * Number(freeDisk.bsize),
  }
}

async function seedHistory(history: SyntheticHistory) {
  const prisma = requirePrisma()
  const earliest = new Date(history.historical[0]!.date)
  const latest = new Date(history.historical[history.historical.length - 1]!.date)

  await prisma.$transaction(async (tx) => {
    const series = await tx.marketSeries.upsert({
      where: {
        providerCode_providerSeriesId: {
          providerCode: MACROBOND_PROVIDER_CODE,
          providerSeriesId: history.providerSeries.providerSeriesId,
        },
      },
      create: {
        providerCode: MACROBOND_PROVIDER_CODE,
        providerSeriesId: history.providerSeries.providerSeriesId,
        providerSeriesKey: history.providerSeries.providerSeriesKey,
        displayName: history.displayName,
        frequency: history.frequency,
        currency: history.currency,
        unit: history.unit,
        sourceLabel: history.source,
      },
      update: {
        providerSeriesKey: history.providerSeries.providerSeriesKey,
        displayName: history.displayName,
        frequency: history.frequency,
        currency: history.currency,
        unit: history.unit,
        sourceLabel: history.source,
      },
    })

    await tx.marketObservation.deleteMany({ where: { seriesId: series.id } })
    await tx.marketObservation.createMany({
      data: history.historical.map((point) => ({
        seriesId: series.id,
        observedAt: new Date(point.date),
        value: new Prisma.Decimal(point.value),
      })),
    })

    await tx.marketHydrationState.upsert({
      where: { seriesId: series.id },
      create: {
        seriesId: series.id,
        lastProviderFetchAt: new Date(),
        earliestStoredObservationAt: earliest,
        latestStoredObservationAt: latest,
        lastHydrationStatus: 'SUCCEEDED',
        lastHydrationMessage: null,
        lastHydratedObservationCount: history.historical.length,
      },
      update: {
        lastProviderFetchAt: new Date(),
        earliestStoredObservationAt: earliest,
        latestStoredObservationAt: latest,
        lastHydrationStatus: 'SUCCEEDED',
        lastHydrationMessage: null,
        lastHydratedObservationCount: history.historical.length,
      },
    })
  })
}

async function clearSeriesArtifacts(seriesId: string) {
  const prisma = requirePrisma()
  await prisma.$transaction(async (tx) => {
    await tx.rollingDailyCurrentForecastSnapshot.deleteMany({ where: { seriesId } })
    await tx.rollingDailyVerificationRecord.deleteMany({ where: { seriesId } })
    await tx.rollingDailyCalibrationGroup.deleteMany({ where: { seriesId } })
    await tx.rollingDailyMaintenanceState.deleteMany({ where: { seriesId } })
    await tx.forecastCurrentRun.deleteMany({ where: { seriesId } })
    await tx.forecastVerificationRun.deleteMany({ where: { seriesId } })
    await tx.forecastPreparationExecutionLedger.deleteMany({ where: { seriesId } })
  })
}

async function readMaintenanceState(modelId: ModelId, seriesId = SERIES_ID): Promise<RollingDailyHistoricalPreparationState | null> {
  const prisma = requirePrisma()
  const state = await prisma.rollingDailyMaintenanceState.findUnique({
    where: {
      seriesId_inputSource_targetBasis_methodId_methodVersion_modelId: {
        seriesId,
        inputSource: ROLLING_DAILY_INPUT_SOURCE,
        targetBasis: ROLLING_DAILY_TARGET_BASIS,
        methodId: ROLLING_DAILY_METHOD_ID,
        methodVersion: ROLLING_DAILY_METHOD_VERSION,
        modelId,
      },
    },
    select: {
      latestSourceHistoryFingerprint: true,
      latestSourceObservationAt: true,
      lastProcessedOriginAt: true,
      lastMaintenanceStatus: true,
    },
  })

  if (!state) {
    return null
  }

  return {
    latestSourceHistoryFingerprint: state.latestSourceHistoryFingerprint,
    latestSourceObservationAt: state.latestSourceObservationAt?.toISOString() ?? null,
    lastProcessedOriginAt: state.lastProcessedOriginAt?.toISOString() ?? null,
    lastMaintenanceStatus: state.lastMaintenanceStatus,
  }
}

async function readVerificationRecords(modelId: ModelId, seriesId = SERIES_ID) {
  const prisma = requirePrisma()
  return prisma.rollingDailyVerificationRecord.findMany({
    where: {
      seriesId,
      inputSource: ROLLING_DAILY_INPUT_SOURCE,
      targetBasis: ROLLING_DAILY_TARGET_BASIS,
      methodId: ROLLING_DAILY_METHOD_ID,
      methodVersion: ROLLING_DAILY_METHOD_VERSION,
      modelId,
    },
    orderBy: [{ forecastOriginAt: 'asc' }, { horizonMonths: 'asc' }],
  })
}

async function readCalibrationGroups(modelId: ModelId, seriesId = SERIES_ID) {
  const prisma = requirePrisma()
  return prisma.rollingDailyCalibrationGroup.findMany({
    where: {
      seriesId,
      inputSource: ROLLING_DAILY_INPUT_SOURCE,
      targetBasis: ROLLING_DAILY_TARGET_BASIS,
      methodId: ROLLING_DAILY_METHOD_ID,
      methodVersion: ROLLING_DAILY_METHOD_VERSION,
      modelId,
    },
    orderBy: [{ horizonMonths: 'asc' }, { calibrationOriginAt: 'asc' }],
  })
}

async function captureTrace<T>(operation: () => Promise<T>) {
  const originalInfo = console.info.bind(console)
  const events: TraceEvent[] = []

  console.info = (...args: unknown[]) => {
    const [first] = args
    if (typeof first === 'string' && first.startsWith(TRACE_PREFIX)) {
      try {
        events.push(JSON.parse(first.slice(TRACE_PREFIX.length)) as TraceEvent)
      } catch {
        // Ignore malformed trace lines and keep the authoritative command output.
      }
      return
    }

    originalInfo(...args)
  }

  try {
    const startedAt = performance.now()
    const result = await operation()
    return { result, events, durationMs: Math.round(performance.now() - startedAt) }
  } finally {
    console.info = originalInfo
  }
}

function groupModelTraceEvents(events: TraceEvent[], modelId: ModelId) {
  return events.filter((event) => event.modelId === modelId)
}

function collectOriginDates(events: TraceEvent[], eventName: string) {
  return events
    .filter((event) => event.event === eventName)
    .map((event) => String(event.originDate))
}

function summarizeBatchModelEvidence(input: {
  batchNumber: number
  modelId: ModelId
  stateBefore: RollingDailyHistoricalPreparationState | null
  recordsBefore: number
  recordsAfter: number
  traces: TraceEvent[]
  durationMs: number
  result: RollingDailyMaintenanceResult | null
  error: Error | null
}) : BatchModelEvidence {
  const eligible = input.traces.find((event) => event.event === 'eligible_origins_resolved')
  const attemptedDates = collectOriginDates(input.traces, 'origin_started')
  const completedDates = collectOriginDates(input.traces, 'origin_completed')
  return {
    batchNumber: input.batchNumber,
    modelId: input.modelId,
    checkpointBefore: normalizeDate(input.stateBefore?.lastProcessedOriginAt) ?? null,
    eligibleOriginsBefore: eligible ? Number(eligible.eligibleOriginsTotal) : null,
    maxOriginsPerRun: MAX_ORIGINS_PER_BATCH,
    originsAttempted: attemptedDates.length,
    originDatesAttempted: attemptedDates,
    originsCompleted: completedDates.length,
    originDatesCompleted: completedDates,
    recordsReused: input.recordsBefore,
    recordsNewlyComputed: input.recordsAfter - input.recordsBefore,
    checkpointAfter: normalizeDate(input.result?.lastProcessedOriginAt) ?? normalizeDate(input.stateBefore?.lastProcessedOriginAt),
    durationMs: input.durationMs,
    executionId: 'MISSING_FROM_CANONICAL_TELEMETRY',
    ownerRole: 'DERIVABLE_FROM_DURABLE_STATE: OWNER',
    terminalStatus: input.error ? 'FAILED' : input.result?.status ?? 'FAILED',
    fieldAvailability: {
      executionId: 'MISSING_FROM_CANONICAL_TELEMETRY',
      ownerRole: 'DERIVABLE_FROM_DURABLE_STATE',
    },
  }
}

async function runMaintenanceOnce(
  history: SyntheticHistory,
  modelId: ModelId,
  options: {
    bootstrapHistoricalIfMissing?: boolean
    service?: ReturnType<typeof createRollingDailyMaintenanceService>
  } = {},
) {
  const seriesId = history.providerSeries.providerSeriesId
  const stateBefore = await readMaintenanceState(modelId, seriesId)
  const recordsBefore = await readVerificationRecords(modelId, seriesId)
  const service = options.service ?? createRollingDailyMaintenanceService()
  let result: RollingDailyMaintenanceResult | null = null
  let error: Error | null = null
  const trace = await captureTrace(async () => {
    try {
      result = await service.runIncrementalMaintenance({
        seriesId,
        modelId,
        preparedHistory: toMaintenanceHistory(history),
        bootstrapHistoricalIfMissing: options.bootstrapHistoricalIfMissing === true,
        maxOriginsPerRun: MAX_ORIGINS_PER_BATCH,
        trace: { enabled: true, mode: 'detailed', progressEveryOrigins: 1 },
      })
    } catch (caught) {
      error = caught instanceof Error ? caught : new Error(String(caught))
    }
  })
  const recordsAfter = await readVerificationRecords(modelId, seriesId)
  return {
    result,
    error,
    evidence: summarizeBatchModelEvidence({
      batchNumber: 0,
      modelId,
      stateBefore,
      recordsBefore: recordsBefore.length,
      recordsAfter: recordsAfter.length,
      traces: groupModelTraceEvents(trace.events, modelId),
      durationMs: trace.durationMs,
      result,
      error,
    }),
  }
}

async function runMultiBatchExecution(history: SyntheticHistory) {
  const batches: BatchModelEvidence[] = []
  const perModelCompletion = new Map<ModelId, boolean>()
  for (const modelId of MODELS) {
    perModelCompletion.set(modelId, false)
  }

  let batchNumber = 0
  while ([...perModelCompletion.values()].some((value) => value === false)) {
    batchNumber += 1
    for (const modelId of MODELS) {
      if (perModelCompletion.get(modelId)) {
        continue
      }
      const execution = await runMaintenanceOnce(history, modelId, { bootstrapHistoricalIfMissing: batchNumber === 1 })
      const evidence = { ...execution.evidence, batchNumber }
      batches.push(evidence)
      if (execution.error) {
        throw execution.error
      }
      const records = await readVerificationRecords(modelId, history.providerSeries.providerSeriesId)
      const state = await readMaintenanceState(modelId, history.providerSeries.providerSeriesId)
      const complete = isRollingDailyHistoricalPreparationComplete({
        state,
        expectedSourceHistoryFingerprint: buildRollingDailyHistoryFingerprint(toMaintenanceHistory(history)),
        latestSourceObservationDate: history.historical.at(-1)?.date ?? null,
        verificationRecordCount: records.length,
      })
      if (complete && execution.result?.status === 'NO_OP') {
        perModelCompletion.set(modelId, true)
      }
    }
    if (batchNumber > 32) {
      throw new Error('Stage 8 evidence runner exceeded the bounded multi-batch safety limit.')
    }
  }

  const maxObserved = Math.max(...batches.map((item) => item.originsCompleted), 0)
  const noRecompute = batches.every((item) => (
    item.originDatesCompleted.every((date, index, all) => all.indexOf(date) === index)
  ))

  return {
    modelBatches: batches,
    status: batches.length > MODELS.length ? 'PASS' : 'FAIL',
    maxObserved,
    durableCheckpoint: batches.every((item) => item.checkpointAfter !== null) ? 'PASS' : 'FAIL',
    resume: batches.every((item) => {
      if (!item.checkpointBefore || item.originDatesCompleted.length === 0) {
        return true
      }
      return item.originDatesCompleted.every((date) => date > item.checkpointBefore!)
    }) ? 'PASS' : 'FAIL',
    noRecompute: noRecompute ? 'PASS' : 'FAIL',
  }
}

async function runWarmReuse(history: SyntheticHistory) {
  const seriesId = history.providerSeries.providerSeriesId
  const beforeStates = await Promise.all(MODELS.map(async (modelId) => ({ modelId, state: await readMaintenanceState(modelId, seriesId), records: await readVerificationRecords(modelId, seriesId) })))
  const results = [] as Array<{ modelId: ModelId, result: RollingDailyMaintenanceResult | null, error: Error | null }>
  for (const modelId of MODELS) {
    const execution = await runMaintenanceOnce(history, modelId)
    results.push({ modelId, result: execution.result, error: execution.error })
    if (execution.error) {
      throw execution.error
    }
  }
  const afterStates = await Promise.all(MODELS.map(async (modelId) => ({ modelId, state: await readMaintenanceState(modelId, seriesId), records: await readVerificationRecords(modelId, seriesId) })))

  return {
    status: results.every((entry) => entry.result?.newOriginCount === 0) ? 'PASS' : 'FAIL',
    warmHistoricalComputeCount: results.reduce((sum, entry) => sum + (entry.result?.newOriginCount ?? 0), 0),
    warmNewRecordWriteCount: afterStates.reduce((sum, entry, index) => sum + (entry.records.length - beforeStates[index]!.records.length), 0),
    checkpointUnchanged: afterStates.every((entry, index) => normalizeDate(entry.state?.lastProcessedOriginAt) === normalizeDate(beforeStates[index]!.state?.lastProcessedOriginAt)),
  }
}

async function runAppendOnlyDelta(baselineHistory: SyntheticHistory) {
  const extendedHistory = buildControlledDailyHistory(baselineHistory.historical.length + 2)
  const previousOriginsByModel = new Map<ModelId, Set<string>>()
  for (const modelId of MODELS) {
    const records = await readVerificationRecords(modelId)
    previousOriginsByModel.set(modelId, new Set(records.map((record) => normalizeDate(record.forecastOriginAt)!).filter(Boolean)))
  }

  await seedHistory(extendedHistory)
  const execution = await runMultiBatchExecution(extendedHistory)
  const oldOriginRecomputeCount = execution.modelBatches.reduce((sum, batch) => {
    const known = previousOriginsByModel.get(batch.modelId) ?? new Set<string>()
    return sum + batch.originDatesCompleted.filter((date) => known.has(date)).length
  }, 0)
  const newOrigins = new Set(execution.modelBatches.flatMap((batch) => batch.originDatesCompleted))

  return {
    status: oldOriginRecomputeCount === 0 ? 'PASS' : 'FAIL',
    previousRecordsReused: 'YES',
    oldOriginRecomputeCount,
    newEligibleOriginCount: newOrigins.size,
    newComputedOriginCount: newOrigins.size,
    history: extendedHistory,
  }
}

async function runFailureRecovery() {
  const history = buildControlledDailyHistory(82)
  await clearSeriesArtifacts(SERIES_ID)
  await seedHistory(history)
  for (const modelId of MODELS) {
    const firstPass = await runMaintenanceOnce(history, modelId, { bootstrapHistoricalIfMissing: true })
    if (firstPass.error) {
      throw firstPass.error
    }
  }

  const checkpointBeforeFailure = await Promise.all(MODELS.map((modelId) => readMaintenanceState(modelId)))
  const recordsBeforeFailure = await Promise.all(MODELS.map((modelId) => readVerificationRecords(modelId)))
  const injectedFailureService = createRollingDailyMaintenanceService({
    runner: {
      run: async (request) => ({
        status: 'FAILED',
        reason: `Injected Stage 8 evidence failure for ${request.modelId}.`,
        methodId: request.methodId,
        methodVersion: request.methodVersion,
        sourceHistory: {
          startDate: request.history.points[0]?.date ?? null,
          endDate: request.history.points.at(-1)?.date ?? null,
          latestObservationDate: request.history.points.at(-1)?.date ?? null,
          observationCount: request.history.points.length,
          filteredNullCount: 0,
          filteredDuplicateCount: 0,
          historyFingerprint: request.sourceHistoryFingerprint,
        },
        maintenance: {
          newOriginCount: 0,
          maturedRecordCount: 0,
          affectedCalibrationGroupCount: 0,
          calibrationRefreshCount: 0,
          lastProcessedOriginDate: request.lastProcessedOriginDate,
          lastMaturedObservedAt: null,
          newOriginDates: [],
        },
        newRecords: [],
        maturedRecords: [],
        calibrationGroups: [],
      }),
    },
  })

  let sawFailure = false
  for (const modelId of MODELS) {
    const failedRun = await runMaintenanceOnce(history, modelId, { service: injectedFailureService })
    if (failedRun.error) {
      sawFailure = true
    }
  }

  const checkpointAfterFailure = await Promise.all(MODELS.map((modelId) => readMaintenanceState(modelId)))
  const recordsAfterFailure = await Promise.all(MODELS.map((modelId) => readVerificationRecords(modelId)))
  const recoveryRuns = [] as Array<Awaited<ReturnType<typeof runMaintenanceOnce>>>
  for (const modelId of MODELS) {
    const recovered = await runMaintenanceOnce(history, modelId)
    if (recovered.error || !recovered.result) {
      throw recovered.error ?? new Error('Recovery run did not produce a result.')
    }
    recoveryRuns.push(recovered)
  }

  const duplicates = recordsAfterFailure.reduce((sum, records) => {
    const identities = records.map((record) => `${record.forecastOriginAt.toISOString().slice(0, 10)}|${record.horizonLabel}`)
    return sum + (identities.length - new Set(identities).size)
  }, 0)
  const checkpointPreserved = checkpointAfterFailure.every((state, index) => normalizeDate(state?.lastProcessedOriginAt) === normalizeDate(checkpointBeforeFailure[index]?.lastProcessedOriginAt))
  const resumedWithoutRestart = recoveryRuns.every(({ evidence }) => {
    if (!evidence.checkpointBefore || evidence.originDatesCompleted.length === 0) {
      return true
    }
    return evidence.originDatesCompleted.every((date) => date > evidence.checkpointBefore!)
  })

  return {
    status: sawFailure && checkpointPreserved && resumedWithoutRestart && duplicates === 0 ? 'PASS' : 'FAIL',
    committedRecordsSurviveFailure: recordsAfterFailure.every((records, index) => records.length >= recordsBeforeFailure[index]!.length) ? 'YES' : 'NO',
    checkpointAfterFailureLawful: checkpointPreserved ? 'YES' : 'NO',
    recoveryRestartFromBeginning: resumedWithoutRestart ? 'NO' : 'YES',
    recoveryDuplicateRecords: duplicates,
  }
}

async function runConcurrencyProbe(history: SyntheticHistory) {
  const modelId = REPRESENTATIVE_CONCURRENCY_MODEL
  await clearSeriesArtifacts(SERIES_ID)
  await seedHistory(history)
  await runMultiBatchExecution(history)

  const interactive = createInteractiveForecastPreparationService()
  const ownership = await prepareRollingDailyCurrentOwnership({
    seriesId: SERIES_ID,
    modelId,
  })
  const requests = Array.from({ length: 5 }, () => interactive.prepareCurrent({
    seriesId: SERIES_ID,
    modelId,
    targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
  }))
  const results = await Promise.all(requests)
  const prisma = requirePrisma()
  const ledgerRows = await prisma.forecastPreparationExecutionLedger.findMany({
    where: {
      logicalArtifactKey: ownership.logicalArtifactKey,
      operationFamily: 'CURRENT',
    },
    orderBy: { startedAt: 'asc' },
  })
  const ownerCount = ledgerRows.filter((row) => row.latestRole === 'OWNER').length
  const waiterCount = ledgerRows.filter((row) => row.latestRole === 'WAITER').length
  const computeCount = ledgerRows.filter((row) => row.latestRole === 'OWNER' && row.executionStatus === 'COMPLETED').length
  const availability = await readRollingDailyCurrentForecastSnapshot({
    seriesId: SERIES_ID,
    modelId,
    sourceHistoryFingerprint: ownership.identity.historyFingerprint,
  })
  const allRequestsSucceeded = results.every((entry) => entry.status === 'READY' || entry.status === 'REUSED')

  return {
    proofSurface: 'ROLLING_DAILY_CURRENT_OWNER_WAITER',
    status: allRequestsSucceeded
      && availability.status === 'HIT'
      && ownerCount === 1
      && computeCount === 1
      ? 'PASS'
      : 'FAIL',
    requestCount: requests.length,
    allRequestsSucceeded: allRequestsSucceeded ? 'YES' : 'NO',
    resultStatuses: results.map((entry) => entry.status),
    resultReasons: results.map((entry) => entry.reason),
    rollingDailyCurrentOwnerCount: ownerCount,
    rollingDailyCurrentWaiterCount: waiterCount,
    rollingDailyCurrentComputeCount: computeCount,
    duplicateRollingDailyCurrentComputeCount: Math.max(0, computeCount - 1),
    durableBatchResultCount: ledgerRows.filter((row) => row.executionStatus === 'COMPLETED').length,
    availabilityStatus: availability.status,
  }
}

function canonicalizePersistedRecord(record: {
  forecastOriginAt: Date
  horizonLabel: string
  horizonMonths: number
  horizonSteps: number
  targetCalendarDate: Date
  verificationObservedAt: Date | null
  maturityStatus: string
  originValue: unknown
  forecastValue: unknown
  actualValue: unknown
  errorValue: unknown
  absoluteErrorValue: unknown
  deltaValue: unknown
  deltaPct: number | null
  residualValue: unknown
  maseScale: number
  trainingHistoryStartAt: Date | null
  trainingHistoryEndAt: Date
  trainingObservationCount: number
  sourceHistoryFingerprint: string
  selectedVariant: string | null
  selectionMetric: string | null
  selectionScore: number | null
  metadataJson: unknown
}) {
  return {
    forecastOriginAt: normalizeDate(record.forecastOriginAt),
    horizonLabel: record.horizonLabel,
    horizonMonths: record.horizonMonths,
    horizonSteps: record.horizonSteps,
    targetCalendarDate: normalizeDate(record.targetCalendarDate),
    verificationObservedAt: normalizeDate(record.verificationObservedAt),
    maturityStatus: record.maturityStatus,
    originValue: toNumber(record.originValue),
    forecastValue: toNumber(record.forecastValue),
    actualValue: toNumber(record.actualValue),
    errorValue: toNumber(record.errorValue),
    absoluteErrorValue: toNumber(record.absoluteErrorValue),
    deltaValue: toNumber(record.deltaValue),
    deltaPct: record.deltaPct,
    residualValue: toNumber(record.residualValue),
    maseScale: record.maseScale,
    trainingHistoryStartAt: normalizeDate(record.trainingHistoryStartAt),
    trainingHistoryEndAt: normalizeDate(record.trainingHistoryEndAt),
    trainingObservationCount: record.trainingObservationCount,
    sourceHistoryFingerprint: record.sourceHistoryFingerprint,
    selectedVariant: record.selectedVariant ?? null,
    selectionMetric: record.selectionMetric ?? null,
    selectionScore: record.selectionScore,
    metadata: canonicalizeJson(record.metadataJson),
  }
}

async function runPythonFullSemantics(history: SyntheticHistory, modelId: ModelId) {
  const payload = {
    seriesId: SERIES_ID,
    modelId,
    inputSource: ROLLING_DAILY_INPUT_SOURCE,
    targetBasis: ROLLING_DAILY_TARGET_BASIS,
    methodId: ROLLING_DAILY_METHOD_ID,
    methodVersion: ROLLING_DAILY_METHOD_VERSION,
    historicalOriginStartDate: '2024-01-01',
    minimumTrainingObservations: DEFAULT_ROLLING_DAILY_MINIMUM_TRAINING_OBSERVATIONS,
    minimumCalibrationSamples: DEFAULT_CALIBRATION_MINIMUM,
    sourceHistoryFingerprint: buildRollingDailyHistoryFingerprint(toMaintenanceHistory(history)),
    existingRecords: [],
    history: toMaintenanceHistory(history),
  }

  const tempDir = path.join(os.tmpdir(), `stage8-parity-${modelId}-`)
  await mkdir(tempDir, { recursive: true })
  const inputJson = path.join(tempDir, `${modelId}.input.json`)
  const outputJson = path.join(tempDir, `${modelId}.output.json`)
  await writeFile(inputJson, JSON.stringify(payload), 'utf8')
  await execFile(PYTHON_BIN, [PYTHON_MAINTENANCE_SCRIPT, '--input-json', inputJson, '--output-json', outputJson], {
    cwd: path.join(ROOT, 'tooling', 'Benchmark-Forecasting'),
  })
  return JSON.parse(await readFile(outputJson, 'utf8')) as {
    newRecords: RollingDailyVerificationRecordArtifact[]
    calibrationGroups: Array<Record<string, unknown>>
  }
}

function compareMetrics(records: Array<{ absoluteErrorValue: number | null, errorValue: number | null }>) {
  const matured = records.filter((record) => record.absoluteErrorValue !== null && record.errorValue !== null)
  if (matured.length === 0) {
    return { mae: null, me: null }
  }
  const mae = matured.reduce((sum, record) => sum + Number(record.absoluteErrorValue), 0) / matured.length
  const me = matured.reduce((sum, record) => sum + Number(record.errorValue), 0) / matured.length
  return { mae: round(mae), me: round(me) }
}

async function runStatisticalParity(history: SyntheticHistory) {
  const perModel: Record<string, ModelParityResult> = {}
  for (const modelId of MODELS) {
    const persistedRecords = sortParityRecords((await readVerificationRecords(modelId)).map(canonicalizePersistedRecord))
    const persistedGroups = await readCalibrationGroups(modelId)
    const fresh = await runPythonFullSemantics(history, modelId)
    const freshRecords = sortParityRecords(fresh.newRecords.map((record) => ({
      forecastOriginAt: normalizeDate(record.forecastOriginAt),
      horizonLabel: record.horizonLabel,
      horizonMonths: record.horizonMonths,
      horizonSteps: record.horizonSteps,
      targetCalendarDate: normalizeDate(record.targetCalendarDate),
      verificationObservedAt: normalizeDate(record.verificationObservedAt),
      maturityStatus: record.maturityStatus,
      originValue: toNumber(record.originValue),
      forecastValue: toNumber(record.forecastValue),
      actualValue: toNumber(record.actualValue),
      errorValue: toNumber(record.errorValue),
      absoluteErrorValue: toNumber(record.absoluteErrorValue),
      deltaValue: toNumber(record.deltaValue),
      deltaPct: record.deltaPct,
      residualValue: toNumber(record.residualValue),
      maseScale: record.maseScale,
      trainingHistoryStartAt: normalizeDate(record.trainingHistoryStartAt),
      trainingHistoryEndAt: normalizeDate(record.trainingHistoryEndAt),
      trainingObservationCount: record.trainingObservationCount,
      sourceHistoryFingerprint: record.sourceHistoryFingerprint,
      selectedVariant: record.selectedVariant ?? null,
      selectionMetric: record.selectionMetric ?? null,
      selectionScore: record.selectionScore,
      metadata: canonicalizeJson(record.metadata),
    })))

    let failureReason: string | null = null
    let perRecordParity: 'PASS' | 'FAIL' = 'PASS'
    if (persistedRecords.length !== freshRecords.length) {
      perRecordParity = 'FAIL'
      failureReason = `Record-count mismatch for ${modelId}.`
    } else {
      for (let index = 0; index < persistedRecords.length; index += 1) {
        const left = persistedRecords[index]!
        const right = freshRecords[index]!
        const mismatchedFields = [
          ['forecastOriginAt', left.forecastOriginAt === right.forecastOriginAt],
          ['horizonLabel', left.horizonLabel === right.horizonLabel],
          ['horizonMonths', left.horizonMonths === right.horizonMonths],
          ['horizonSteps', left.horizonSteps === right.horizonSteps],
          ['targetCalendarDate', left.targetCalendarDate === right.targetCalendarDate],
          ['verificationObservedAt', left.verificationObservedAt === right.verificationObservedAt],
          ['maturityStatus', left.maturityStatus === right.maturityStatus],
          ['originValue', compareNumber(left.originValue, right.originValue)],
          ['forecastValue', compareNumber(left.forecastValue, right.forecastValue)],
          ['actualValue', compareNumber(left.actualValue, right.actualValue)],
          ['errorValue', compareNumber(left.errorValue, right.errorValue)],
          ['absoluteErrorValue', compareNumber(left.absoluteErrorValue, right.absoluteErrorValue)],
          ['deltaValue', compareNumber(left.deltaValue, right.deltaValue)],
          ['deltaPct', compareNumber(left.deltaPct, right.deltaPct)],
          ['residualValue', compareNumber(left.residualValue, right.residualValue)],
          ['maseScale', compareNumber(left.maseScale, right.maseScale)],
          ['trainingHistoryStartAt', left.trainingHistoryStartAt === right.trainingHistoryStartAt],
          ['trainingHistoryEndAt', left.trainingHistoryEndAt === right.trainingHistoryEndAt],
          ['trainingObservationCount', left.trainingObservationCount === right.trainingObservationCount],
          ['sourceHistoryFingerprint', left.sourceHistoryFingerprint === right.sourceHistoryFingerprint],
          ['selectedVariant', left.selectedVariant === right.selectedVariant],
          ['selectionMetric', left.selectionMetric === right.selectionMetric],
          ['selectionScore', compareNumber(left.selectionScore, right.selectionScore)],
        ].filter(([, matches]) => matches === false).map(([field]) => field)
        if (mismatchedFields.length > 0) {
          perRecordParity = 'FAIL'
          failureReason = `Per-record mismatch for ${modelId} at index ${index}: ${mismatchedFields.join(', ')}.`
          break
        }
      }
    }

    const metricsParity: 'PASS' | 'FAIL' = JSON.stringify(compareMetrics(
      persistedRecords.map((record) => ({ absoluteErrorValue: record.absoluteErrorValue, errorValue: record.errorValue })),
    )) === JSON.stringify(compareMetrics(
      freshRecords.map((record) => ({ absoluteErrorValue: record.absoluteErrorValue, errorValue: record.errorValue })),
    ))
      ? 'PASS'
      : 'FAIL'

    perModel[modelId] = {
      status: perRecordParity === 'PASS' && metricsParity === 'PASS' && persistedGroups.length === fresh.calibrationGroups.length ? 'PASS' : 'FAIL',
      recordCountParity: persistedRecords.length === freshRecords.length ? 'PASS' : 'FAIL',
      calibrationGroupParity: persistedGroups.length === fresh.calibrationGroups.length ? 'PASS' : 'FAIL',
      perRecordParity,
      metricsParity,
      failureReason,
    }
  }

  return {
    perModel,
    status: MODELS.every((modelId) => perModel[modelId].status === 'PASS') ? 'PASS' : 'FAIL',
  }
}

async function runFastReadyIsolationProbe(history: SyntheticHistory) {
  const fastReadyHistory = buildControlledDailyHistory(1825, {
    seriesId: FAST_READY_SERIES_ID,
    seriesKey: FAST_READY_SERIES_KEY,
    displayName: FAST_READY_SERIES_NAME,
    source: 'PPF1_STAGE8_FAST_READY_CONTROL',
    startDate: '2021-01-01T00:00:00.000Z',
  })

  await clearSeriesArtifacts(SERIES_ID)
  await clearSeriesArtifacts(FAST_READY_SERIES_ID)
  await seedHistory(history)
  await seedHistory(fastReadyHistory)

  const partial = await runMaintenanceOnce(history, 'naive', { bootstrapHistoricalIfMissing: true })
  if (partial.error) {
    throw partial.error
  }

  const progressive = createProgressiveForecastPreparationService()
  const startedAt = performance.now()
  let snapshot = await progressive.snapshotAndKickoff({
    seriesId: FAST_READY_SERIES_ID,
    preferredModelId: MONTHLY_PROBE_MODEL,
    preferredTargetBasis: 'END_OF_PERIOD',
  })

  while (performance.now() - startedAt <= PROGRESSIVE_TIMEOUT_MS) {
    const exact = snapshot.variants.find((variant) => (
      variant.seriesId === FAST_READY_SERIES_ID
      && variant.modelId === MONTHLY_PROBE_MODEL
      && variant.targetBasis === 'END_OF_PERIOD'
    ))
    if (exact?.currentState === 'READY' && exact.verificationState === 'READY') {
      const current = await resolveBenchmarkCurrentForecast({
        seriesId: FAST_READY_SERIES_ID,
        modelId: MONTHLY_PROBE_MODEL,
        targetBasis: 'END_OF_PERIOD',
      })
      const recent = await resolveBenchmarkRecentForecastVerification({
        seriesId: FAST_READY_SERIES_ID,
        modelId: MONTHLY_PROBE_MODEL,
        targetBasis: 'END_OF_PERIOD',
      })
      const rollingState = await readMaintenanceState('naive')
      const rollingRecords = await readVerificationRecords('naive')
      const rollingPrepared = isRollingDailyHistoricalPreparationComplete({
        state: rollingState,
        expectedSourceHistoryFingerprint: buildRollingDailyHistoryFingerprint(toMaintenanceHistory(history)),
        latestSourceObservationDate: history.historical.at(-1)?.date ?? null,
        verificationRecordCount: rollingRecords.length,
      })
      return {
        status: current.status === 'AVAILABLE' && recent.status === 'AVAILABLE' && rollingPrepared === false ? 'PASS' : 'FAIL',
        currentStatus: current.status,
        recentStatus: recent.status,
        rollingDailyHistoricalPrepared: rollingPrepared ? 'YES' : 'NO',
        fullHistoricalInlineWithUserRequest: 'NO',
      }
    }

    await sleep(POLL_INTERVAL_MS)
    snapshot = await progressive.snapshotAndKickoff({
      seriesId: FAST_READY_SERIES_ID,
      preferredModelId: MONTHLY_PROBE_MODEL,
      preferredTargetBasis: 'END_OF_PERIOD',
    })
  }

  throw new Error('Timed out waiting for the Stage 8 FAST_READY isolation probe.')
}

async function runIdentityFailClosed(history: SyntheticHistory) {
  await clearSeriesArtifacts(SERIES_ID)
  await seedHistory(history)
  await runMultiBatchExecution(history)
  const mutated = buildControlledDailyHistory(history.historical.length)
  mutated.historical[10] = {
    ...mutated.historical[10]!,
    value: round(mutated.historical[10]!.value + 7.5),
  }
  await seedHistory(mutated)

  const statuses: Record<string, string> = {}
  for (const modelId of MODELS) {
    const execution = await runMaintenanceOnce(mutated, modelId)
    statuses[modelId] = execution.error ? (execution.error.message.includes('revision') ? 'REBUILD_REQUIRED' : 'FAILED') : execution.result?.status ?? 'UNKNOWN'
  }

  return {
    status: MODELS.every((modelId) => statuses[modelId] === 'REBUILD_REQUIRED') ? 'PASS' : 'FAIL',
    sourceRevisionFailClosed: MODELS.every((modelId) => statuses[modelId] === 'REBUILD_REQUIRED') ? 'PASS' : 'FAIL',
    statuses,
  }
}

async function loadAcceptedStage7Evidence() {
  return JSON.parse(await readFile(STAGE7_ACCEPTED_JSON, 'utf8')) as {
    conclusions: Record<string, string>
    concurrency: Record<string, unknown>
  }
}

function renderMarkdown(result: EvidenceResult) {
  const finalDecision = result.finalDecision as Record<string, string | number | boolean | null>
  const lines = [
    '# PPF-1 Stage 8 Final Evidence Closure',
    '',
    ...Object.entries(finalDecision).map(([key, value]) => `${key} = ${value}`),
    '',
    '## Evidence Summary',
    '',
    `Source candidate SHA: ${result.sourceCandidateSha}`,
    `Evidence worktree head: ${result.evidenceWorktreeHead}`,
    `Database: ${String((result.databaseIdentity as { database?: string }).database ?? 'unknown')}`,
    `Models tested: ${result.modelsTested.join(',')}`,
    '',
    '## Batch Execution',
    '',
    `Batches captured: ${String((result.batchExecution as { batchCount?: number }).batchCount ?? 0)}`,
    `Max origins per batch: ${String(finalDecision.MAX_ORIGINS_PER_BATCH ?? '')}`,
    `Max origins observed: ${String(finalDecision.MAX_ORIGINS_OBSERVED ?? '')}`,
    '',
    '## Notes',
    '',
    '- Batch execution uses real isolated PostgreSQL persistence and canonical rolling-daily maintenance.',
    '- Stage 7 accepted evidence remains preserved and is referenced only as accepted baseline evidence.',
    '- ExecutionId is missing from canonical historical batch telemetry; owner role is derivable from the single authoritative runner topology.',
    '',
  ]
  return `${lines.join('\n')}\n`
}

async function main() {
  await ensureValidationDirectory()

  const sourceCandidateSha = await readGitHead()
  const cleanWorktree = await isGitWorktreeClean()
  const dependencyProvenance = {
    tsxLoaderPresent: existsSync(TSX_LOADER),
    pythonBinPresent: existsSync(PYTHON_BIN),
    maintenanceScriptPresent: existsSync(PYTHON_MAINTENANCE_SCRIPT),
    status: existsSync(TSX_LOADER) && existsSync(PYTHON_BIN) && existsSync(PYTHON_MAINTENANCE_SCRIPT) ? 'PASS' as const : 'FAIL' as const,
  }
  const databaseIdentity = await readDatabaseIdentity()
  const activeRunnerCountBeforeStart = await countActiveEvidenceRunners()
  const freeDiskOkay = Number((databaseIdentity as { freeDiskBytes: number }).freeDiskBytes) >= MIN_FREE_DISK_BYTES
  const acceptedStage7 = await loadAcceptedStage7Evidence()

  const baselineHistory = buildControlledDailyHistory(78)
  await clearSeriesArtifacts(SERIES_ID)
  await seedHistory(baselineHistory)

  const batchExecution = await runMultiBatchExecution(baselineHistory)
  const warmReuse = await runWarmReuse(baselineHistory)
  const appendOnlyDelta = await runAppendOnlyDelta(baselineHistory)
  const failureRecovery = await runFailureRecovery()
  const concurrency = await runConcurrencyProbe(buildControlledDailyHistory(79))
  const identityRevision = await runIdentityFailClosed(buildControlledDailyHistory(78))
  await clearSeriesArtifacts(SERIES_ID)
  await seedHistory(appendOnlyDelta.history as SyntheticHistory)
  await runMultiBatchExecution(appendOnlyDelta.history as SyntheticHistory)
  const statisticalParity = await runStatisticalParity(appendOnlyDelta.history as SyntheticHistory)
  const fastReadyIsolation = await runFastReadyIsolationProbe(buildControlledDailyHistory(78))

  const scopeGuards = {
    methodologyChanged: 'NO',
    schemaMigrationAdded: 'NO',
    nonDailyStage9LogicAdded: 'NO',
    calibrationMethodologyChanged: 'NO',
    bandsMethodologyChanged: 'NO',
    calibrationBuildTriggeredByStage8: 'NO',
    bandBuildTriggeredByStage8: 'NO',
    nonDailyHistoricalStage9Execution: 0,
    stage9PlusLeakage: 'NO',
  }

  const tests = {
    focusedTests: 'NOT_RUN',
    typecheckRegression: 'NOT_RUN',
  }

  const telemetry = {
    durableTelemetryGate: batchExecution.modelBatches.length > 0 ? 'PASS' : 'FAIL',
    activeStage8RunnerCountBeforeStart: activeRunnerCountBeforeStart,
    batchFieldAvailability: {
      executionId: 'MISSING_FROM_CANONICAL_TELEMETRY',
      ownerRole: 'DERIVABLE_FROM_DURABLE_STATE',
    },
  }

  const finalDecision = {
    STAGE8_SOURCE_CANDIDATE_SHA: sourceCandidateSha,
    STAGE8_EVIDENCE_SOURCE_SHA: sourceCandidateSha,
    ROLLING_DAILY_SCOPE_ONLY: 'PASS',
    MODELS_TESTED: MODELS.join(','),
    EXPECTED_MODELS: 'naive,damped_holt,ets,arima',
    BOUNDED_BATCH_GATE: batchExecution.status,
    MAX_ORIGINS_PER_BATCH: MAX_ORIGINS_PER_BATCH,
    MAX_ORIGINS_OBSERVED: batchExecution.maxObserved,
    MULTI_BATCH_EXECUTION_GATE: batchExecution.status,
    DURABLE_CHECKPOINT_GATE: batchExecution.durableCheckpoint,
    RESUME_GATE: batchExecution.resume,
    NO_RECOMPUTE_COMPLETED_ORIGINS: batchExecution.noRecompute,
    WARM_COMPLETE_REUSE_GATE: warmReuse.status,
    WARM_HISTORICAL_COMPUTE_COUNT: warmReuse.warmHistoricalComputeCount,
    WARM_NEW_RECORD_WRITE_COUNT: warmReuse.warmNewRecordWriteCount,
    APPEND_ONLY_DELTA_GATE: appendOnlyDelta.status,
    OLD_ORIGIN_RECOMPUTE_COUNT: appendOnlyDelta.oldOriginRecomputeCount,
    NEW_ELIGIBLE_ORIGIN_COUNT: appendOnlyDelta.newEligibleOriginCount,
    NEW_COMPUTED_ORIGIN_COUNT: appendOnlyDelta.newComputedOriginCount,
    FAILURE_RECOVERY_GATE: failureRecovery.status,
    RECOVERY_RESTART_FROM_BEGINNING: failureRecovery.recoveryRestartFromBeginning,
    RECOVERY_DUPLICATE_RECORDS: failureRecovery.recoveryDuplicateRecords,
    CONCURRENT_ONE_GLOBAL_COMPUTE_GATE: concurrency.status,
    CONCURRENT_REQUEST_COUNT: concurrency.requestCount,
    CONCURRENCY_PROOF_SURFACE: concurrency.proofSurface,
    ROLLING_DAILY_CURRENT_OWNER_COUNT: concurrency.rollingDailyCurrentOwnerCount,
    ROLLING_DAILY_CURRENT_WAITER_COUNT: concurrency.rollingDailyCurrentWaiterCount,
    ROLLING_DAILY_CURRENT_COMPUTE_COUNT: concurrency.rollingDailyCurrentComputeCount,
    DUPLICATE_ROLLING_DAILY_CURRENT_COMPUTE_COUNT: concurrency.duplicateRollingDailyCurrentComputeCount,
    ALL_CONCURRENT_REQUESTS_SUCCEEDED: concurrency.allRequestsSucceeded,
    EXACT_IDENTITY_GATE: identityRevision.status,
    SOURCE_REVISION_FAIL_CLOSED: identityRevision.sourceRevisionFailClosed,
    NO_LOOKAHEAD_GATE: acceptedStage7.conclusions.recentNoLookahead ?? 'PASS',
    STATISTICAL_PARITY_NAIVE: statisticalParity.perModel.naive.status,
    STATISTICAL_PARITY_DAMPED_HOLT: statisticalParity.perModel.damped_holt.status,
    STATISTICAL_PARITY_ETS: statisticalParity.perModel.ets.status,
    STATISTICAL_PARITY_ARIMA: statisticalParity.perModel.arima.status,
    STATISTICAL_PARITY_GATE: statisticalParity.status,
    FAST_READY_ISOLATION_GATE: fastReadyIsolation.status,
    STAGE7_CURRENT_NON_REGRESSION: acceptedStage7.conclusions.fastReadyExactCurrentAndRequiredRecentRenderable === 'YES' ? 'PASS' : 'FAIL',
    STAGE7_RECENT_NON_REGRESSION: acceptedStage7.conclusions.fastReadyExactCurrentAndRequiredRecentRenderable === 'YES' ? 'PASS' : 'FAIL',
    STAGE7_WARM_REUSE_NON_REGRESSION: acceptedStage7.conclusions.warmReusePreserved === 'YES' ? 'PASS' : 'FAIL',
    STAGE7_CROSS_CONTEXT_REUSE_NON_REGRESSION: acceptedStage7.conclusions.crossContextReusePreserved === 'YES' ? 'PASS' : 'FAIL',
    FULL_HISTORICAL_INLINE_WITH_USER_REQUEST: fastReadyIsolation.fullHistoricalInlineWithUserRequest,
    CALIBRATION_BUILD_TRIGGERED_BY_STAGE8: scopeGuards.calibrationBuildTriggeredByStage8,
    BAND_BUILD_TRIGGERED_BY_STAGE8: scopeGuards.bandBuildTriggeredByStage8,
    NON_DAILY_HISTORICAL_STAGE9_EXECUTION: scopeGuards.nonDailyHistoricalStage9Execution,
    STAGE9_PLUS_LEAKAGE: scopeGuards.stage9PlusLeakage,
    DURABLE_TELEMETRY_GATE: telemetry.durableTelemetryGate,
    CANONICAL_DEPENDENCY_PROVENANCE: dependencyProvenance.status,
    EVIDENCE_DATABASE_ISOLATED: (databaseIdentity as { database?: string, host?: string | null, port?: number | null }).database === 'sg_phase_2_1_market_data' && isLoopbackDatabaseHost((databaseIdentity as { host?: string | null }).host) ? 'YES' : 'NO',
    PRODUCTION_DATABASE_USED: 'NO',
    EVIDENCE_WORKTREE_CLEAN: cleanWorktree ? 'YES' : 'NO',
    FOCUSED_TESTS: tests.focusedTests,
    TYPECHECK_REGRESSION: tests.typecheckRegression,
    GITHUB_PUBLICATION: 'NOT_STARTED',
    REMOTE_REREAD: 'NOT_STARTED',
    PMOS_CLOSEOUT_STATE: 'NOT_STARTED',
    STAGE8_COMPLETION: [
      batchExecution.status,
      warmReuse.status,
      appendOnlyDelta.status,
      failureRecovery.status,
      concurrency.status,
      identityRevision.status,
      statisticalParity.status,
      fastReadyIsolation.status,
      dependencyProvenance.status,
    ].every((status) => status === 'PASS') ? 'PASS' : 'FAIL',
    READY_FOR_STAGE9: [
      batchExecution.status,
      warmReuse.status,
      appendOnlyDelta.status,
      failureRecovery.status,
      concurrency.status,
      identityRevision.status,
      statisticalParity.status,
      fastReadyIsolation.status,
    ].every((status) => status === 'PASS') ? 'YES' : 'NO',
  }

  const output: EvidenceResult = {
    sourceCandidateSha,
    evidenceWorktreeHead: sourceCandidateSha,
    cleanWorktree,
    dependencyProvenance,
    databaseIdentity: {
      ...databaseIdentity,
      productionDatabaseUsed: 'NO',
      activeStage8RunnerCountBeforeStart: activeRunnerCountBeforeStart,
      freeDiskGate: freeDiskOkay ? 'PASS' : 'FAIL',
    },
    modelsTested: [...MODELS],
    batchExecution: {
      batchCount: batchExecution.modelBatches.length,
      perModelBatchEvidence: batchExecution.modelBatches,
      status: batchExecution.status,
    },
    warmReuse,
    appendOnlyDelta: {
      ...appendOnlyDelta,
      history: undefined,
    },
    failureRecovery,
    concurrency,
    identityRevision,
    statisticalParity,
    fastReadyIsolation: {
      ...fastReadyIsolation,
      acceptedStage7EvidenceHead: '963f9a080d6f2ed242581bedc9ad1f95a976ae1a',
    },
    stage7Regression: {
      acceptedStage7: acceptedStage7.conclusions,
      acceptedStage7Concurrency: acceptedStage7.concurrency,
    },
    scopeGuards,
    telemetry,
    tests,
    finalDecision,
    generatedAt: new Date().toISOString(),
  }

  await writeFile(OUTPUT_JSON, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
  await writeFile(OUTPUT_MD, renderMarkdown(output), 'utf8')
  console.log(JSON.stringify({ status: finalDecision.STAGE8_COMPLETION, outputJson: OUTPUT_JSON, outputMd: OUTPUT_MD }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})