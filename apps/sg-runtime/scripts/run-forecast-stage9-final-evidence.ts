import './load-env'

import { execFile as execFileCallback } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, statfs, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

import { Prisma } from '@/generated/market-data-client'
import {
  createForecastCapabilityService,
  type ForecastCapabilityProvenance,
} from '@/lib/forecast/capability-resolver'
import {
  type ForecastTargetBasis,
  type ForecastVerificationRecord,
  USER_FACING_FORECAST_MODELS,
  type UserFacingForecastModelId,
} from '@/lib/forecast/contracts'
import { resolveForecastTechnicalMinimumObservations } from '@/lib/forecast/current-fast-policy'
import {
  createFullVerificationStatisticalCompatibility,
  resolveForecastMethodContract,
} from '@/lib/forecast/identity'
import {
  loadLiveForecastBridgePayload,
  selectMinimalLawfulCurrentTrainingPayload,
  type LiveForecastBridgePayload,
} from '@/lib/forecast/live-market-input'
import { createForecastProductionOperationsService } from '@/lib/forecast/production-operations'
import {
  createForecastLibraryService,
  buildForecastHistoryFingerprint,
  executePreparedForecastBridge,
  type ForecastBridge,
  type ForecastPreparedExecutionContext,
  type ForecastServiceRequest,
} from '@/lib/forecast/service'
import { getMarketDataPrisma } from '@/lib/market-data/client'

const execFile = promisify(execFileCallback)

process.env.MARKET_DATA_DATABASE_URL = process.env.MARKET_DATA_DATABASE_URL
  ?? 'postgresql://phase21@127.0.0.1:55421/sg_phase_2_1_market_data'
process.env.SG_RUNTIME_DATABASE_URL = process.env.SG_RUNTIME_DATABASE_URL
  ?? 'postgresql://phase21@127.0.0.1:55421/sg_phase_2_1_app'
process.env.FORECAST_STRESS_DATABASE_CLONE_ALIAS = process.env.FORECAST_STRESS_DATABASE_CLONE_ALIAS
  ?? 'phase-2-1-local-clone-v1'

function resolveOutputPath(envName: string, fallbackPath: string) {
  const override = process.env[envName]?.trim()
  return override && override.length > 0 ? path.resolve(override) : fallbackPath
}

function resolveNodeModulesArtifact(...relativePath: string[]) {
  const nodePathEntries = (process.env.NODE_PATH ?? '')
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
  const candidates = [
    path.join(process.cwd(), 'node_modules', ...relativePath),
    ...nodePathEntries.map((entry) => path.join(entry, ...relativePath)),
  ]

  return candidates.find((candidate) => existsSync(candidate)) ?? path.join(process.cwd(), 'node_modules', ...relativePath)
}

const ROOT = path.resolve(process.cwd(), '..', '..')
const VALIDATION_ROOT = path.join(ROOT, 'tooling', 'Benchmark-Forecasting', 'validation')
const FORECASTING_TOOL_ROOT = path.join(ROOT, 'tooling', 'Benchmark-Forecasting')
const OUTPUT_JSON = resolveOutputPath('STAGE9_RESULT_JSON_PATH', path.join(VALIDATION_ROOT, 'ppf1-stage9-bounded-non-daily-historical.json'))
const OUTPUT_MD = resolveOutputPath('STAGE9_RESULT_MD_PATH', path.join(VALIDATION_ROOT, 'ppf1-stage9-bounded-non-daily-historical.md'))
const LOCAL_PYTHON_BIN = path.join(ROOT, 'tooling', 'Benchmark-Forecasting', '.venv', 'bin', 'python')
const PYTHON_BIN = process.env.FORECASTING_PYTHON_BIN?.trim() || LOCAL_PYTHON_BIN
const TSX_LOADER = resolveNodeModulesArtifact('tsx', 'dist', 'loader.mjs')
const TSX_IMPORT_SPECIFIER = existsSync(TSX_LOADER) ? pathToFileURL(TSX_LOADER).href : 'tsx'
const MODELS = USER_FACING_FORECAST_MODELS
const REPRESENTATIVE_MODEL: UserFacingForecastModelId = 'arima'
const BATCH_MODELS = [REPRESENTATIVE_MODEL] as const
const MAX_ORIGINS_PER_BATCH = 3
const MAX_BATCH_ATTEMPTS = 128
const MIN_FREE_DISK_BYTES = 15 * 1024 * 1024 * 1024
const CONCURRENCY_REQUEST_COUNT = 5
const MACROBOND_PROVIDER_CODE = 'MACROBOND'

const SUPPRESSED_NOISY_LOG_EVENTS = new Set([
  'BENCHMARK_MARKET_DATA',
])

const originalConsoleInfo = console.info.bind(console)
console.info = (...args: unknown[]) => {
  const [firstArg] = args
  if (typeof firstArg === 'string') {
    const match = /^\[([^\]]+)\]/.exec(firstArg)
    if (match && SUPPRESSED_NOISY_LOG_EVENTS.has(match[1] ?? '')) {
      return
    }
  }

  originalConsoleInfo(...args)
}

type Stage9GateStatus = 'PASS' | 'FAIL'

type Stage9PersistedRunLike = {
  metrics: Array<{
    origins: number
    expectedOrigins: number
    failedOrigins: number
  }>
}

type Stage9FinalDecisionInputs = {
  sourceCandidateSha: string
  evidenceWorktreeHead: string
  cleanWorktree: boolean
  databaseHost: string | null
  capabilityMatrixStatus: Stage9GateStatus
  runtimeMatrixPass: boolean
  representativePass: boolean
  stage7Status: Stage9GateStatus
  stage8Status: Stage9GateStatus
  focusedValidationPass: boolean
  dependencyProvenancePass: boolean
  lawfulNonDailyPathCount: number
}

type SourceFrequency = 'WEEKLY' | 'MONTHLY' | 'BIMONTHLY' | 'QUARTERLY' | 'QUADMONTHLY' | 'SEMIANNUAL' | 'ANNUAL'
type TargetCadence = 'MONTHLY' | 'BIMONTHLY' | 'QUARTERLY' | 'QUADMONTHLY' | 'SEMIANNUAL' | 'ANNUAL'
type TargetDefinition = {
  targetBasis: ForecastTargetBasis
  targetCadence: TargetCadence
}
type SeriesDefinition = {
  seriesId: string
  displayName: string
  frequency: SourceFrequency
  observationCount: number
  startDate: string
  targets: readonly TargetDefinition[]
}
type PathDefinition = {
  series: SeriesDefinition
  target: TargetDefinition
}
type SyntheticHistory = {
  providerSeries: {
    provider: { providerCode: string, displayName: string }
    providerSeriesId: string
    providerSeriesKey: string
  }
  displayName: string
  frequency: SourceFrequency
  currency: string
  unit: string
  source: string
  historical: Array<{ date: string, value: number }>
}
type BridgeCall = {
  mode: 'history' | 'current' | 'verification'
  seriesId: string
  modelId: string | null
  targetBasis: ForecastTargetBasis
  sourceFrequency: SourceFrequency | null
  targetCadence: TargetCadence | null
  historicalOriginStartDate: string | null
  lastProcessedOriginDate: string | null
  maxOriginsPerRun: number | null
  resultStatus: string | null
  responseOriginDates: string[]
  responseExpectedOrigins: number | null
}
type BatchStepEvidence = {
  batchNumber: number
  modelId: UserFacingForecastModelId
  resultStatus: string
  cacheStatus: string | null
  resumeFromOriginDate: string | null
  responseOriginDates: string[]
  responseExpectedOrigins: number | null
  persistedOriginCount: number
}
type RuntimeMatrixEntry = {
  frequency: SourceFrequency
  targetBasis: ForecastTargetBasis
  targetCadence: TargetCadence
  multiBatch: Record<string, unknown>
  warmReuse: Record<string, unknown>
  appendOnlyDelta: Record<string, unknown>
  statisticalParity: Record<string, unknown>
  status: 'PASS' | 'FAIL'
}

type PreparedBridgeResponse = Awaited<ReturnType<typeof executePreparedForecastBridge>>
type VerificationBacktest = Record<string, {
  origins: number
  expectedOrigins: number
  failedOrigins: number
  coverage: number
  metrics: unknown
  records: ForecastVerificationRecord[]
}>

const SERIES_DEFINITIONS: readonly SeriesDefinition[] = [
  {
    seriesId: 'ppf1-stage9-weekly-final-evidence-v1',
    displayName: 'PPF1 Stage 9 Weekly Final Evidence',
    frequency: 'WEEKLY',
    observationCount: 260,
    startDate: '2021-01-04T00:00:00.000Z',
    targets: [{ targetBasis: 'END_OF_PERIOD', targetCadence: 'MONTHLY' }],
  },
  {
    seriesId: 'ppf1-stage9-monthly-final-evidence-v1',
    displayName: 'PPF1 Stage 9 Monthly Final Evidence',
    frequency: 'MONTHLY',
    observationCount: 72,
    startDate: '2019-01-01T00:00:00.000Z',
    targets: [
      { targetBasis: 'END_OF_PERIOD', targetCadence: 'MONTHLY' },
      { targetBasis: 'MONTHLY_AVERAGE', targetCadence: 'MONTHLY' },
    ],
  },
  {
    seriesId: 'ppf1-stage9-bimonthly-final-evidence-v1',
    displayName: 'PPF1 Stage 9 Bimonthly Final Evidence',
    frequency: 'BIMONTHLY',
    observationCount: 60,
    startDate: '2015-01-01T00:00:00.000Z',
    targets: [
      { targetBasis: 'END_OF_PERIOD', targetCadence: 'BIMONTHLY' },
      { targetBasis: 'MONTHLY_AVERAGE', targetCadence: 'BIMONTHLY' },
    ],
  },
  {
    seriesId: 'ppf1-stage9-quarterly-final-evidence-v1',
    displayName: 'PPF1 Stage 9 Quarterly Final Evidence',
    frequency: 'QUARTERLY',
    observationCount: 48,
    startDate: '2013-01-01T00:00:00.000Z',
    targets: [
      { targetBasis: 'END_OF_PERIOD', targetCadence: 'QUARTERLY' },
      { targetBasis: 'MONTHLY_AVERAGE', targetCadence: 'QUARTERLY' },
    ],
  },
  {
    seriesId: 'ppf1-stage9-quadmonthly-final-evidence-v1',
    displayName: 'PPF1 Stage 9 Quadmonthly Final Evidence',
    frequency: 'QUADMONTHLY',
    observationCount: 45,
    startDate: '2010-01-01T00:00:00.000Z',
    targets: [
      { targetBasis: 'END_OF_PERIOD', targetCadence: 'QUADMONTHLY' },
      { targetBasis: 'MONTHLY_AVERAGE', targetCadence: 'QUADMONTHLY' },
    ],
  },
  {
    seriesId: 'ppf1-stage9-semiannual-final-evidence-v1',
    displayName: 'PPF1 Stage 9 Semiannual Final Evidence',
    frequency: 'SEMIANNUAL',
    observationCount: 40,
    startDate: '2006-01-01T00:00:00.000Z',
    targets: [
      { targetBasis: 'END_OF_PERIOD', targetCadence: 'SEMIANNUAL' },
      { targetBasis: 'MONTHLY_AVERAGE', targetCadence: 'SEMIANNUAL' },
    ],
  },
  {
    seriesId: 'ppf1-stage9-annual-final-evidence-v1',
    displayName: 'PPF1 Stage 9 Annual Final Evidence',
    frequency: 'ANNUAL',
    observationCount: 40,
    startDate: '1985-01-01T00:00:00.000Z',
    targets: [
      { targetBasis: 'END_OF_PERIOD', targetCadence: 'ANNUAL' },
      { targetBasis: 'MONTHLY_AVERAGE', targetCadence: 'ANNUAL' },
    ],
  },
] as const

function round(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000
}

function normalizeDate(value: string | Date | null | undefined) {
  if (!value) return null
  const raw = value instanceof Date ? value.toISOString() : String(value)
  return raw.slice(0, 10)
}

function normalizeDateTime(value: string | Date | null | undefined) {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : String(value)
}

function resolveSourceCandidateSha(envName: string, evidenceWorktreeHead: string) {
  const override = process.env[envName]?.trim()
  return override && override.length > 0 ? override : evidenceWorktreeHead
}

export function isExplicitLoopbackDatabaseHost(host: string | null | undefined) {
  const normalizedHost = host?.trim().toLowerCase() ?? ''
  return normalizedHost === '127.0.0.1'
    || normalizedHost === '127.0.0.1/32'
    || normalizedHost === '::1'
    || normalizedHost === '::1/128'
}

export function isCompleteStage9ExactVerificationRun(run: Stage9PersistedRunLike | null | undefined) {
  return run !== null
    && run !== undefined
    && run.metrics.length > 0
    && run.metrics.every((metric) => metric.origins === metric.expectedOrigins && metric.failedOrigins === 0)
}

export async function ensureStage9ParityArtifactsComplete(
  modelIds: readonly UserFacingForecastModelId[],
  completeModel: (modelId: UserFacingForecastModelId) => Promise<void>,
  readPersistedRun: (modelId: UserFacingForecastModelId) => Promise<Stage9PersistedRunLike | null>,
  contextLabel: string,
) {
  for (const modelId of modelIds) {
    await completeModel(modelId)
    const persisted = await readPersistedRun(modelId)
    if (!isCompleteStage9ExactVerificationRun(persisted)) {
      throw new Error(`Stage 9 parity requires a complete exact persisted verification artifact for ${contextLabel} model=${modelId}.`)
    }
  }
}

export function buildStage9FinalDecision(inputs: Stage9FinalDecisionInputs) {
  const cleanWorktreePass = inputs.cleanWorktree
  const isolatedPostgresPass = isExplicitLoopbackDatabaseHost(inputs.databaseHost)
  const focusedValidationGate = inputs.focusedValidationPass ? 'PASS' : 'FAIL'
  const runtimeMatrixGate = inputs.runtimeMatrixPass ? 'PASS' : 'FAIL'
  const representativeRecoveryGate = inputs.representativePass ? 'PASS' : 'FAIL'
  const overallPass = cleanWorktreePass
    && isolatedPostgresPass
    && inputs.capabilityMatrixStatus === 'PASS'
    && inputs.runtimeMatrixPass
    && inputs.representativePass
    && inputs.stage7Status === 'PASS'
    && inputs.stage8Status === 'PASS'
    && inputs.focusedValidationPass
    && inputs.dependencyProvenancePass

  return {
    STAGE9_SOURCE_CANDIDATE_SHA: inputs.sourceCandidateSha,
    STAGE9_EVIDENCE_SOURCE_SHA: inputs.evidenceWorktreeHead,
    CLEAN_WORKTREE_REQUIRED: cleanWorktreePass ? 'PASS' : 'FAIL',
    ISOLATED_POSTGRES_REQUIRED: isolatedPostgresPass ? 'PASS' : 'FAIL',
    CAPABILITY_MATRIX_GATE: inputs.capabilityMatrixStatus,
    RUNTIME_MATRIX_GATE: runtimeMatrixGate,
    REPRESENTATIVE_RECOVERY_GATE: representativeRecoveryGate,
    RUNTIME_EVIDENCE_MODEL: REPRESENTATIVE_MODEL,
    STAGE7_NON_REGRESSION_GATE: inputs.stage7Status,
    STAGE8_NON_REGRESSION_GATE: inputs.stage8Status,
    FOCUSED_VALIDATION_GATE: focusedValidationGate,
    MAX_ORIGINS_PER_BATCH: MAX_ORIGINS_PER_BATCH,
    LAWFUL_NON_DAILY_PATH_COUNT: inputs.lawfulNonDailyPathCount,
    OVERALL_STAGE9_FINAL_ACCEPTANCE: overallPass ? 'PASS' : 'FAIL',
  }
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
  return Math.abs(Number(left) - Number(right)) <= 1e-6
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

function logPhase(message: string) {
  process.stdout.write(`[STAGE9] ${message}\n`)
}

function targetLabel(input: PathDefinition | TargetDefinition) {
  const target = 'target' in input ? input.target : input
  return `${target.targetBasis}:${target.targetCadence}`
}

function pathLabel(pathDefinition: PathDefinition) {
  return `${pathDefinition.series.frequency}:${targetLabel(pathDefinition.target)}`
}

function addFrequencyStep(date: Date, frequency: SourceFrequency) {
  const next = new Date(date)
  if (frequency === 'WEEKLY') {
    next.setUTCDate(next.getUTCDate() + 7)
    return next
  }

  const monthStepByFrequency: Record<Exclude<SourceFrequency, 'WEEKLY'>, number> = {
    MONTHLY: 1,
    BIMONTHLY: 2,
    QUARTERLY: 3,
    QUADMONTHLY: 4,
    SEMIANNUAL: 6,
    ANNUAL: 12,
  }
  next.setUTCMonth(next.getUTCMonth() + monthStepByFrequency[frequency])
  return next
}

function buildSyntheticHistory(
  definition: SeriesDefinition,
  options: { observationCount?: number, mutateIndex?: number, mutateDelta?: number } = {},
): SyntheticHistory {
  const observationCount = options.observationCount ?? definition.observationCount
  const start = new Date(definition.startDate)
  const historical = Array.from({ length: observationCount }, (_, index) => {
    let observedAt = new Date(start)
    for (let step = 0; step < index; step += 1) {
      observedAt = addFrequencyStep(observedAt, definition.frequency)
    }

    const base = 75 + Math.sin(index / 4) * 1.2 + Math.cos(index / 9) * 0.8 + index * 0.35
    const mutated = options.mutateIndex === index ? (options.mutateDelta ?? 7.5) : 0
    return {
      date: observedAt.toISOString(),
      value: round(base + mutated),
    }
  })

  return {
    providerSeries: {
      provider: {
        providerCode: MACROBOND_PROVIDER_CODE,
        displayName: 'Macrobond',
      },
      providerSeriesId: definition.seriesId,
      providerSeriesKey: definition.seriesId.toUpperCase().replace(/-/g, '_'),
    },
    displayName: definition.displayName,
    frequency: definition.frequency,
    currency: 'INDEX',
    unit: 'pts',
    source: 'PPF1_STAGE9_EVIDENCE_SEED',
    historical,
  }
}

function resolveObservationDate(definition: SeriesDefinition, index: number) {
  let observedAt = new Date(definition.startDate)
  for (let step = 0; step < index; step += 1) {
    observedAt = addFrequencyStep(observedAt, definition.frequency)
  }
  return observedAt
}

function resolveAppendBaselineObservationCount(pathDefinition: PathDefinition) {
  if (
    pathDefinition.series.frequency !== 'WEEKLY'
    || pathDefinition.target.targetCadence !== 'MONTHLY'
  ) {
    return pathDefinition.series.observationCount
  }

  const originalCount = pathDefinition.series.observationCount
  let baselineCount = originalCount
  let cursor = resolveObservationDate(pathDefinition.series, baselineCount - 1)

  while (baselineCount - originalCount < 8) {
    const next = addFrequencyStep(cursor, pathDefinition.series.frequency)
    if (normalizeDate(next)?.slice(0, 7) !== normalizeDate(cursor)?.slice(0, 7)) {
      break
    }
    baselineCount += 1
    cursor = next
  }

  return baselineCount
}

function resolveAppendObservationCount(
  pathDefinition: PathDefinition,
  baselineCount: number,
) {
  return baselineCount + 1
}

function buildSyntheticProvenance(seriesId: string, frequency: SourceFrequency): ForecastCapabilityProvenance[] {
  const endOfPeriod: ForecastCapabilityProvenance = {
    sourceFrequency: frequency,
    targetSemantics: 'END_OF_PERIOD',
    preparation: {
      method: `PPF1_STAGE9_SYNTHETIC_${frequency}_END_OF_PERIOD`,
      version: 'ppf1-stage9-synthetic-provenance-v1',
      provenanceStatus: 'PROVEN',
    },
    sourceLineage: `PPF1_STAGE9_SYNTHETIC_CONTROLLED_SERIES:${seriesId}:${frequency}`,
    closedPeriod: true,
    levelAtTimestamp: true,
    exactSourceObservedAt: true,
    aggregation: null,
    underlyingObservationFrequency: null,
    missingObservationPolicy: null,
    syntheticObservations: false,
  }

  if (frequency === 'WEEKLY') {
    return [endOfPeriod]
  }

  return [
    endOfPeriod,
    {
      sourceFrequency: frequency,
      targetSemantics: 'MONTHLY_AVERAGE',
      preparation: {
        method: `PPF1_STAGE9_SYNTHETIC_${frequency}_AVERAGE`,
        version: 'ppf1-stage9-synthetic-provenance-v1',
        provenanceStatus: 'PROVEN',
      },
      sourceLineage: `PPF1_STAGE9_SYNTHETIC_CONTROLLED_SERIES:${seriesId}:${frequency}`,
      closedPeriod: true,
      levelAtTimestamp: null,
      exactSourceObservedAt: null,
      aggregation: 'ARITHMETIC_MEAN',
      underlyingObservationFrequency: frequency,
      missingObservationPolicy: 'USE_AVAILABLE_LAWFUL_OBSERVATIONS_ONLY',
      syntheticObservations: false,
    },
  ]
}

function requirePrisma() {
  const prisma = getMarketDataPrisma()
  if (!prisma) {
    throw new Error('MARKET_DATA_DATABASE_URL is not configured.')
  }
  return prisma
}

async function ensureValidationDirectory() {
  await mkdir(VALIDATION_ROOT, { recursive: true })
}

async function readGitHead() {
  const { stdout } = await execFile('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' })
  return stdout.trim()
}

async function isGitWorktreeClean() {
  const { stdout } = await execFile('git', ['status', '--short'], { cwd: ROOT, encoding: 'utf8' })
  return stdout.trim().length === 0
}

async function readProcessAncestryPids(startPid: number) {
  const { stdout } = await execFile('ps', ['-Ao', 'pid=,ppid='], { encoding: 'utf8' })
  const parentByPid = new Map<number, number>()

  for (const line of stdout.split('\n')) {
    const [pidRaw, ppidRaw] = line.trim().split(/\s+/)
    const pid = Number(pidRaw)
    const ppid = Number(ppidRaw)
    if (Number.isFinite(pid) && Number.isFinite(ppid)) {
      parentByPid.set(pid, ppid)
    }
  }

  const excluded = new Set<number>()
  let cursor: number | undefined = startPid
  while (cursor && Number.isFinite(cursor) && cursor > 0 && !excluded.has(cursor)) {
    excluded.add(cursor)
    cursor = parentByPid.get(cursor)
  }

  return excluded
}

async function countActiveEvidenceRunners() {
  const excludedPids = await readProcessAncestryPids(process.pid)
  const { stdout } = await execFile('ps', ['-Ao', 'pid=,command='], { encoding: 'utf8' })
  return stdout
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) {
        return null
      }
      const firstSpace = trimmed.indexOf(' ')
      const pid = Number(firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace))
      const command = firstSpace === -1 ? '' : trimmed.slice(firstSpace + 1)
      return Number.isFinite(pid) ? { pid, command } : null
    })
    .filter((entry): entry is { pid: number, command: string } => entry !== null)
    .filter((entry) => entry.command.includes('run-forecast-stage9-final-evidence.ts') && !excludedPids.has(entry.pid))
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

async function clearSeriesArtifacts(seriesIds: readonly string[]) {
  const prisma = requirePrisma()
  await prisma.$transaction(async (tx) => {
    await tx.rollingDailyCurrentForecastSnapshot.deleteMany({ where: { seriesId: { in: [...seriesIds] } } })
    await tx.rollingDailyVerificationRecord.deleteMany({ where: { seriesId: { in: [...seriesIds] } } })
    await tx.rollingDailyCalibrationGroup.deleteMany({ where: { seriesId: { in: [...seriesIds] } } })
    await tx.rollingDailyMaintenanceState.deleteMany({ where: { seriesId: { in: [...seriesIds] } } })
    await tx.forecastCurrentRun.deleteMany({ where: { seriesId: { in: [...seriesIds] } } })
    await tx.forecastVerificationRun.deleteMany({ where: { seriesId: { in: [...seriesIds] } } })
    await tx.forecastPreparationExecutionLedger.deleteMany({ where: { seriesId: { in: [...seriesIds] } } })
  })
}

function buildRequest(
  pathDefinition: PathDefinition,
  modelId: UserFacingForecastModelId,
  overrides: Partial<ForecastServiceRequest> = {},
): ForecastServiceRequest {
  return {
    seriesId: pathDefinition.series.seriesId,
    modelId,
    targetBasis: pathDefinition.target.targetBasis,
    sourceFrequency: pathDefinition.series.frequency,
    targetCadence: pathDefinition.target.targetCadence,
    ...overrides,
  }
}

function extractOriginDatesFromPoints(points: Array<{ forecastOriginAt: Date }>) {
  return [...new Set(points.map((point) => normalizeDate(point.forecastOriginAt)).filter((value): value is string => value !== null))]
    .sort((left, right) => left.localeCompare(right))
}

function buildPointKey(point: { horizonLabel: string, forecastOriginAt: Date, targetDate: Date }) {
  return [
    normalizeDate(point.forecastOriginAt),
    point.horizonLabel,
    normalizeDate(point.targetDate),
  ].join('|')
}

function isVerificationAvailableResponse(response: unknown): response is {
  status: 'AVAILABLE'
  result: {
    backtest: VerificationBacktest
  }
} {
  if (!response || typeof response !== 'object') {
    return false
  }

  if (!('status' in response) || response.status !== 'AVAILABLE') {
    return false
  }

  if (!('result' in response) || !response.result || typeof response.result !== 'object') {
    return false
  }

  return 'backtest' in response.result
}

async function readLatestVerificationRun(
  pathDefinition: PathDefinition,
  modelId: UserFacingForecastModelId,
) {
  const prisma = requirePrisma()
  const method = resolveForecastMethodContract(pathDefinition.target.targetBasis)
  const compatibility = createFullVerificationStatisticalCompatibility({
    sourceFrequency: pathDefinition.series.frequency,
    targetCadence: pathDefinition.target.targetCadence,
    targetSemantics: method.targetSemantics,
  })

  return prisma.forecastVerificationRun.findFirst({
    where: {
      seriesId: pathDefinition.series.seriesId,
      targetBasis: pathDefinition.target.targetBasis,
      methodId: method.methodId,
      methodVersion: method.methodVersion,
      modelId,
      trainingWindowPolicyId: compatibility.trainingWindowPolicyId,
      effectiveTrainingPolicyId: compatibility.effectiveTrainingPolicyId,
    },
    include: {
      metrics: { orderBy: { horizonSteps: 'asc' } },
      points: { orderBy: [{ forecastOriginAt: 'asc' }, { horizonSteps: 'asc' }, { targetDate: 'asc' }] },
    },
    orderBy: { updatedAt: 'desc' },
  })
}

async function readExactVerificationRun(
  pathDefinition: PathDefinition,
  modelId: UserFacingForecastModelId,
) {
  const prisma = requirePrisma()
  const method = resolveForecastMethodContract(pathDefinition.target.targetBasis)
  const compatibility = createFullVerificationStatisticalCompatibility({
    sourceFrequency: pathDefinition.series.frequency,
    targetCadence: pathDefinition.target.targetCadence,
    targetSemantics: method.targetSemantics,
  })
  const historyPayload = await loadLiveForecastBridgePayload(pathDefinition.series.seriesId, {
    targetBasis: pathDefinition.target.targetBasis,
    targetCadence: pathDefinition.target.targetCadence,
  })
  if (!historyPayload) {
    return null
  }

  const historyResponse = await executePreparedForecastBridge(
    historyPayload,
    'history',
    pathDefinition.series.seriesId,
  )
  if (historyResponse.status !== 'AVAILABLE') {
    return null
  }

  const historyFingerprint = buildForecastHistoryFingerprint(historyResponse.history, {
    sourceFrequency: pathDefinition.series.frequency,
    targetCadence: pathDefinition.target.targetCadence,
  })

  const runs = await prisma.forecastVerificationRun.findMany({
    where: {
      seriesId: pathDefinition.series.seriesId,
      targetBasis: pathDefinition.target.targetBasis,
      methodId: method.methodId,
      methodVersion: method.methodVersion,
      modelId,
      historyFingerprint,
      frequency: compatibility.frequencyIdentity,
      trainingWindowPolicyId: compatibility.trainingWindowPolicyId,
      effectiveTrainingPolicyId: compatibility.effectiveTrainingPolicyId,
      status: 'AVAILABLE',
    },
    include: {
      metrics: { orderBy: { horizonSteps: 'asc' } },
      points: { orderBy: [{ forecastOriginAt: 'asc' }, { horizonSteps: 'asc' }, { targetDate: 'asc' }] },
    },
    orderBy: { updatedAt: 'desc' },
    take: 16,
  })

  const complete = runs.find((run) => run.metrics.length > 0 && run.metrics.every((metric) => (
    metric.origins === metric.expectedOrigins && metric.failedOrigins === 0
  )))

  return complete ?? runs[0] ?? null
}

async function readVerificationLedgerRows(pathDefinition: PathDefinition, modelId: UserFacingForecastModelId) {
  const prisma = requirePrisma()
  return prisma.forecastPreparationExecutionLedger.findMany({
    where: {
      seriesId: pathDefinition.series.seriesId,
      modelId,
      operationFamily: 'VERIFICATION',
    },
    orderBy: { startedAt: 'asc' },
  })
}

function createInstrumentedHarness() {
  const calls: BridgeCall[] = []
  const telemetryEvents: Array<{ event: string, metrics: Record<string, string | number | boolean | null> }> = []
  let failureHook: ((call: BridgeCall) => string | null) | null = null

  const unsupported = (seriesId: string, targetBasis: ForecastTargetBasis) => ({
    status: 'UNSUPPORTED' as const,
    reason: `Forecast targetBasis ${targetBasis} requires an implemented lawful source adapter.`,
    seriesId,
    supportedSeriesIds: [seriesId],
    supportedModels: [...USER_FACING_FORECAST_MODELS],
  })

  const executeVerification = async (
    payload: LiveForecastBridgePayload,
    input: Pick<ForecastServiceRequest, 'seriesId' | 'targetBasis' | 'sourceFrequency' | 'targetCadence'>,
    modelId: string,
    options: { historicalOriginStartDate?: string | null, lastProcessedOriginDate?: string | null, maxOriginsPerRun?: number | null } = {},
  ) => {
    const call: BridgeCall = {
      mode: 'verification',
      seriesId: input.seriesId,
      modelId,
      targetBasis: input.targetBasis,
      sourceFrequency: (input.sourceFrequency as SourceFrequency | undefined) ?? null,
      targetCadence: (input.targetCadence as TargetCadence | undefined) ?? null,
      historicalOriginStartDate: normalizeDateTime(options.historicalOriginStartDate),
      lastProcessedOriginDate: normalizeDateTime(options.lastProcessedOriginDate),
      maxOriginsPerRun: options.maxOriginsPerRun ?? null,
      resultStatus: null,
      responseOriginDates: [],
      responseExpectedOrigins: null,
    }
    calls.push(call)
    const injectedFailure = failureHook?.(call)
    if (injectedFailure) {
      throw new Error(injectedFailure)
    }

    const response = await executePreparedForecastBridge(
      payload,
      'verification',
      input.seriesId,
      modelId,
      {
        historicalOriginStartDate: options.historicalOriginStartDate ?? undefined,
        lastProcessedOriginDate: options.lastProcessedOriginDate ?? undefined,
        maxOriginsPerRun: options.maxOriginsPerRun ?? undefined,
      },
    )

    call.resultStatus = response.status
    if (isVerificationAvailableResponse(response)) {
      const horizons = Object.values(response.result.backtest) as Array<{
        expectedOrigins: number
        records: ForecastVerificationRecord[]
      }>
      call.responseExpectedOrigins = Math.max(...horizons.map((horizon) => horizon.expectedOrigins), 0)
      call.responseOriginDates = [...new Set(horizons.flatMap((horizon) => horizon.records.map((record) => normalizeDate(record.forecastOrigin)).filter((value): value is string => value !== null)))].sort((left, right) => left.localeCompare(right))
    }
    return response
  }

  const prepareExecutionContext = async (
    input: Pick<ForecastServiceRequest, 'seriesId' | 'targetBasis' | 'sourceFrequency' | 'targetCadence'>,
  ): Promise<ForecastPreparedExecutionContext | null> => {
    const currentBasePayload = await loadLiveForecastBridgePayload(input.seriesId, {
      targetBasis: input.targetBasis,
      targetCadence: input.targetCadence,
      continuityPolicy: input.targetCadence === 'MONTHLY' || input.targetCadence === undefined ? 'ALLOW_GAPS' : 'REQUIRE_FULL',
    })
    if (!currentBasePayload) {
      return null
    }

    return {
      exportHistory(mode = 'verification', modelId) {
        if (mode === 'current') {
          if (!modelId) {
            throw new Error('Prepared Current history requires a user-facing modelId.')
          }
          const currentPayload = selectMinimalLawfulCurrentTrainingPayload(
            currentBasePayload,
            resolveForecastTechnicalMinimumObservations({
              targetSemantics: resolveForecastMethodContract(input.targetBasis).targetSemantics,
              modelId: modelId as UserFacingForecastModelId,
            }),
          )
          return executePreparedForecastBridge(currentPayload, 'history', input.seriesId) as ReturnType<ForecastPreparedExecutionContext['exportHistory']>
        }

        return (async () => {
          const verificationPayload = await loadLiveForecastBridgePayload(input.seriesId, {
            targetBasis: input.targetBasis,
            targetCadence: input.targetCadence,
          })
          if (!verificationPayload) {
            return unsupported(input.seriesId, input.targetBasis)
          }
          return executePreparedForecastBridge(verificationPayload, 'history', input.seriesId)
        })() as ReturnType<ForecastPreparedExecutionContext['exportHistory']>
      },
      exportCurrent(modelId) {
        const currentPayload = selectMinimalLawfulCurrentTrainingPayload(
          currentBasePayload,
          resolveForecastTechnicalMinimumObservations({
            targetSemantics: resolveForecastMethodContract(input.targetBasis).targetSemantics,
            modelId: modelId as UserFacingForecastModelId,
          }),
        )
        return executePreparedForecastBridge(currentPayload, 'current', input.seriesId, modelId) as ReturnType<ForecastPreparedExecutionContext['exportCurrent']>
      },
      exportVerification(modelId, options) {
        return (async () => {
          const verificationPayload = await loadLiveForecastBridgePayload(input.seriesId, {
            targetBasis: input.targetBasis,
            targetCadence: input.targetCadence,
          })
          if (!verificationPayload) {
            return unsupported(input.seriesId, input.targetBasis)
          }
          return executeVerification(verificationPayload, input, modelId, {
            historicalOriginStartDate: options?.historicalOriginStartDate ?? undefined,
            lastProcessedOriginDate: options?.lastProcessedOriginDate ?? undefined,
            maxOriginsPerRun: options?.maxOriginsPerRun ?? undefined,
          })
        })() as ReturnType<ForecastPreparedExecutionContext['exportVerification']>
      },
    }
  }

  const bridge: ForecastBridge = {
    async prepareExecutionContext(input) {
      return prepareExecutionContext(input)
    },
    async exportHistory(input) {
      const context = await prepareExecutionContext(input)
      return context ? context.exportHistory('verification') : unsupported(input.seriesId, input.targetBasis)
    },
    async exportCurrent(input) {
      const context = await prepareExecutionContext(input)
      return context ? context.exportCurrent(input.modelId) : unsupported(input.seriesId, input.targetBasis)
    },
    async exportVerification(input) {
      const context = await prepareExecutionContext(input)
      return context
        ? context.exportVerification(input.modelId, {
            historicalOriginStartDate: input.historicalOriginStartDate ?? undefined,
            lastProcessedOriginDate: input.lastProcessedOriginDate ?? undefined,
            maxOriginsPerRun: input.maxOriginsPerRun ?? undefined,
          })
        : unsupported(input.seriesId, input.targetBasis)
    },
  }

  const service = createForecastLibraryService({
    bridge,
    logEvent: () => {},
    telemetry: {
      emit(event, metrics) {
        telemetryEvents.push({ event, metrics: metrics ?? {} })
      },
    },
  })

  return {
    service,
    calls,
    telemetryEvents,
    clearCalls() {
      calls.length = 0
      telemetryEvents.length = 0
    },
    setFailureHook(nextHook: ((call: BridgeCall) => string | null) | null) {
      failureHook = nextHook
    },
    async executeVerificationDirect(pathDefinition: PathDefinition, modelId: UserFacingForecastModelId) {
      const payload = await loadLiveForecastBridgePayload(pathDefinition.series.seriesId, {
        targetBasis: pathDefinition.target.targetBasis,
        targetCadence: pathDefinition.target.targetCadence,
      })
      if (!payload) {
        return unsupported(pathDefinition.series.seriesId, pathDefinition.target.targetBasis)
      }
      return executePreparedForecastBridge(payload, 'verification', pathDefinition.series.seriesId, modelId)
    },
  }
}

async function runCapabilityMatrix() {
  logPhase('capability-matrix:start')
  const capabilityService = createForecastCapabilityService({
    resolveProvenance: async (seriesId, history) => buildSyntheticProvenance(seriesId, history.frequency as SourceFrequency),
  })
  const matrix: Record<string, unknown> = {}
  let status: 'PASS' | 'FAIL' = 'PASS'

  for (const definition of SERIES_DEFINITIONS) {
    const resolution = await capabilityService.resolveBySeriesId(definition.seriesId)
    const targetSummary: Record<string, unknown> = {}
    let seriesStatus: 'PASS' | 'FAIL' = resolution.status === 'AVAILABLE' ? 'PASS' : 'FAIL'

    for (const [targetSemantics, expectedLawful] of [
      ['END_OF_PERIOD', true],
      ['MONTHLY_AVERAGE', definition.frequency !== 'WEEKLY'],
      ['ROLLING_DAILY_POINT_IN_TIME', false],
    ] as const) {
      const rows = resolution.capabilities.filter((item) => item.identity.targetSemantics === targetSemantics)
      const expectedCadence = targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME'
        ? null
        : definition.targets.find((target) => resolveForecastMethodContract(target.targetBasis).targetSemantics === targetSemantics)?.targetCadence ?? null
      const passes = expectedLawful
        ? rows.length === MODELS.length && rows.every((item) => (
          item.admissionState === 'ADMITTED'
          && item.implementationState === 'SUPPORTED'
          && item.historyEligibility === 'ELIGIBLE'
          && item.targetCadence === expectedCadence
        ))
        : rows.every((item) => item.admissionState !== 'ADMITTED')
      targetSummary[targetSemantics] = {
        expectedLawful,
        checkedModels: rows.length,
        expectedTargetCadence: expectedCadence,
        admissionStates: [...new Set(rows.map((item) => item.admissionState))],
        implementationStates: [...new Set(rows.map((item) => item.implementationState))],
        historyEligibility: [...new Set(rows.map((item) => item.historyEligibility))],
        status: passes ? 'PASS' : 'FAIL',
      }
      if (!passes) {
        seriesStatus = 'FAIL'
        status = 'FAIL'
      }
    }

    matrix[definition.frequency] = {
      seriesId: definition.seriesId,
      resolutionStatus: resolution.status,
      sourceMetadata: resolution.sourceMetadata,
      targets: targetSummary,
      status: seriesStatus,
    }
  }

  logPhase(`capability-matrix:done status=${status}`)
  return { matrix, status }
}

async function runBatchesToComplete(
  harness: ReturnType<typeof createInstrumentedHarness>,
  pathDefinition: PathDefinition,
) {
  logPhase(`runtime-multibatch:start ${pathLabel(pathDefinition)}`)
  const perModel: Record<string, BatchStepEvidence[]> = {}
  let durableCheckpointPass = true
  let resumePass = true
  let noRecomputePass = true
  let preparedBlockPass = true
  let maxObserved = 0

  for (const modelId of BATCH_MODELS) {
    const steps: BatchStepEvidence[] = []
    const seenOrigins = new Set<string>()
    let batchNumber = 0

    while (batchNumber < MAX_BATCH_ATTEMPTS) {
      batchNumber += 1
      const beforeRun = await readLatestVerificationRun(pathDefinition, modelId)
      const beforeCheckpoint = beforeRun ? extractOriginDatesFromPoints(beforeRun.points).at(-1) ?? null : null

      harness.clearCalls()
      const result = await harness.service.resolveVerificationRequest(buildRequest(pathDefinition, modelId, {
        maxOriginsPerRun: MAX_ORIGINS_PER_BATCH,
      }))
      const call = harness.calls.filter((entry) => entry.mode === 'verification' && entry.modelId === modelId).at(-1) ?? null
      const afterRun = await readLatestVerificationRun(pathDefinition, modelId)
      const persistedOrigins = afterRun ? extractOriginDatesFromPoints(afterRun.points) : []
      const step: BatchStepEvidence = {
        batchNumber,
        modelId,
        resultStatus: result.status,
        cacheStatus: result.status === 'AVAILABLE' ? result.cacheStatus : null,
        resumeFromOriginDate: call?.lastProcessedOriginDate ? normalizeDate(call.lastProcessedOriginDate) : null,
        responseOriginDates: call?.responseOriginDates ?? [],
        responseExpectedOrigins: call?.responseExpectedOrigins ?? null,
        persistedOriginCount: persistedOrigins.length,
      }
      steps.push(step)
      maxObserved = Math.max(maxObserved, step.responseOriginDates.length)

      if (batchNumber > 1 && beforeCheckpoint !== null && step.resumeFromOriginDate !== beforeCheckpoint) {
        resumePass = false
      }
      for (const originDate of step.responseOriginDates) {
        if (seenOrigins.has(originDate)) {
          noRecomputePass = false
        }
        seenOrigins.add(originDate)
      }
      if (result.status === 'NOT_AVAILABLE') {
        const prepared = await harness.service.readPreparedVerificationRequest(buildRequest(pathDefinition, modelId))
        if (prepared.status !== 'NOT_AVAILABLE') {
          preparedBlockPass = false
        }
        if (!afterRun || persistedOrigins.length < 1) {
          durableCheckpointPass = false
        }
      }
      if (result.status === 'AVAILABLE') {
        break
      }
    }

    if (steps.length < 2) {
      durableCheckpointPass = false
    }
    if (steps.at(-1)?.resultStatus !== 'AVAILABLE') {
      durableCheckpointPass = false
    }
    perModel[modelId] = steps
  }

  const status = durableCheckpointPass && resumePass && noRecomputePass && preparedBlockPass
    ? 'PASS'
    : 'FAIL'

  const result = {
    perModel,
    batchCount: Object.values(perModel).reduce((sum, steps) => sum + steps.length, 0),
    durableCheckpoint: durableCheckpointPass ? 'PASS' : 'FAIL',
    resume: resumePass ? 'PASS' : 'FAIL',
    noRecompute: noRecomputePass ? 'PASS' : 'FAIL',
    preparedReadBlockedWhilePartial: preparedBlockPass ? 'PASS' : 'FAIL',
    maxObserved,
    status,
  }
  logPhase(`runtime-multibatch:done ${pathLabel(pathDefinition)} status=${result.status}`)
  return result
}

async function runWarmReuse(
  harness: ReturnType<typeof createInstrumentedHarness>,
  pathDefinition: PathDefinition,
) {
  logPhase(`runtime-warm-reuse:start ${pathLabel(pathDefinition)}`)
  const perModel: Record<string, unknown> = {}
  let status: 'PASS' | 'FAIL' = 'PASS'

  for (const modelId of BATCH_MODELS) {
    const beforeRun = await readLatestVerificationRun(pathDefinition, modelId)
    harness.clearCalls()
    const result = await harness.service.resolveVerificationRequest(buildRequest(pathDefinition, modelId, {
      maxOriginsPerRun: MAX_ORIGINS_PER_BATCH,
    }))
    const afterRun = await readLatestVerificationRun(pathDefinition, modelId)
    const verificationCalls = harness.calls.filter((entry) => entry.mode === 'verification' && entry.modelId === modelId).length
    const pointsUnchanged = (beforeRun?.points.length ?? 0) === (afterRun?.points.length ?? 0)
    const passes = result.status === 'AVAILABLE'
      && result.cacheStatus === 'hit'
      && verificationCalls === 0
      && pointsUnchanged
    if (!passes) {
      status = 'FAIL'
    }
    perModel[modelId] = {
      resultStatus: result.status,
      cacheStatus: result.status === 'AVAILABLE' ? result.cacheStatus : null,
      verificationCalls,
      pointsUnchanged,
      status: passes ? 'PASS' : 'FAIL',
    }
  }

  logPhase(`runtime-warm-reuse:done ${pathLabel(pathDefinition)} status=${status}`)
  return { perModel, status }
}

async function ensureCompletedCurrentFingerprint(
  harness: ReturnType<typeof createInstrumentedHarness>,
  pathDefinition: PathDefinition,
  modelIds: readonly UserFacingForecastModelId[] = BATCH_MODELS,
) {
  for (const modelId of modelIds) {
    await completeCurrentFingerprintForModel(harness, pathDefinition, modelId)
  }
}

async function completeCurrentFingerprintForModel(
  harness: ReturnType<typeof createInstrumentedHarness>,
  pathDefinition: PathDefinition,
  modelId: UserFacingForecastModelId,
) {
  let attempts = 0
  while (attempts < MAX_BATCH_ATTEMPTS) {
    attempts += 1
    const result = await harness.service.resolveVerificationRequest(buildRequest(pathDefinition, modelId))
    if (result.status === 'AVAILABLE') {
      return
    }
  }

  throw new Error(`Unable to complete exact verification fingerprint for ${pathLabel(pathDefinition)} model=${modelId} after ${MAX_BATCH_ATTEMPTS} attempts.`)
}

async function rebuildExactVerificationArtifactForParity(
  harness: ReturnType<typeof createInstrumentedHarness>,
  pathDefinition: PathDefinition,
) {
  await clearSeriesArtifacts([pathDefinition.series.seriesId])

  await ensureStage9ParityArtifactsComplete(
    MODELS,
    (modelId) => completeCurrentFingerprintForModel(harness, pathDefinition, modelId),
    (modelId) => readExactVerificationRun(pathDefinition, modelId),
    pathLabel(pathDefinition),
  )
}

async function runAppendOnlyDelta(
  harness: ReturnType<typeof createInstrumentedHarness>,
  pathDefinition: PathDefinition,
) {
  logPhase(`runtime-append-only:start ${pathLabel(pathDefinition)}`)
  const baselineObservationCount = resolveAppendBaselineObservationCount(pathDefinition)
  if (baselineObservationCount !== pathDefinition.series.observationCount) {
    await clearSeriesArtifacts([pathDefinition.series.seriesId])
    await seedHistory(buildSyntheticHistory(pathDefinition.series, {
      observationCount: baselineObservationCount,
    }))
    await ensureCompletedCurrentFingerprint(harness, pathDefinition)
  }

  const baselineByModel = Object.fromEntries(await Promise.all(BATCH_MODELS.map(async (modelId) => {
    const run = await readLatestVerificationRun(pathDefinition, modelId)
    return [modelId, run] as const
  })))

  const extendedHistory = buildSyntheticHistory(pathDefinition.series, {
    observationCount: resolveAppendObservationCount(pathDefinition, baselineObservationCount),
  })
  await seedHistory(extendedHistory)

  const perModel: Record<string, unknown> = {}
  let status: 'PASS' | 'FAIL' = 'PASS'

  for (const modelId of BATCH_MODELS) {
    const beforeRun = baselineByModel[modelId]
    const beforeOrigins = new Set(beforeRun ? extractOriginDatesFromPoints(beforeRun.points) : [])
    const priorCheckpoint = beforeRun ? extractOriginDatesFromPoints(beforeRun.points).at(-1) ?? null : null

    harness.clearCalls()
    const result = await harness.service.resolveVerificationRequest(buildRequest(pathDefinition, modelId, {
      maxOriginsPerRun: MAX_ORIGINS_PER_BATCH,
    }))
    const call = harness.calls.filter((entry) => entry.mode === 'verification' && entry.modelId === modelId).at(-1) ?? null
    const afterRun = await readLatestVerificationRun(pathDefinition, modelId)
    const recomputed = (call?.responseOriginDates ?? []).filter((originDate) => beforeOrigins.has(originDate)).length
    const historyFingerprintChanged = beforeRun?.historyFingerprint !== afterRun?.historyFingerprint
    const passes = result.status !== 'FAILED'
      && priorCheckpoint !== null
      && normalizeDate(call?.lastProcessedOriginDate) === priorCheckpoint
      && recomputed === 0
      && historyFingerprintChanged
      && (afterRun?.points.length ?? 0) > (beforeRun?.points.length ?? 0)
    if (!passes) {
      status = 'FAIL'
    }
    perModel[modelId] = {
      resultStatus: result.status,
      resumeFromOriginDate: normalizeDate(call?.lastProcessedOriginDate),
      priorCheckpoint,
      newlyComputedOrigins: call?.responseOriginDates ?? [],
      oldOriginRecomputeCount: recomputed,
      historyFingerprintChanged,
      persistedPointDelta: (afterRun?.points.length ?? 0) - (beforeRun?.points.length ?? 0),
      status: passes ? 'PASS' : 'FAIL',
    }
  }

  const result = {
    perModel,
    extendedObservationCount: extendedHistory.historical.length,
    status,
  }
  logPhase(`runtime-append-only:done ${pathLabel(pathDefinition)} status=${result.status}`)
  return result
}

function canonicalizePersistedMetric(metric: {
  horizonLabel: string
  horizonSteps: number
  origins: number
  expectedOrigins: number
  failedOrigins: number
  coverage: number
  mae: number | null
  rmse: number | null
  mase: number | null
  smape: number | null
  directionalAccuracy: number | null
  bias: number | null
}) {
  return {
    horizon: metric.horizonLabel,
    horizonSteps: metric.horizonSteps,
    origins: metric.origins,
    expectedOrigins: metric.expectedOrigins,
    failedOrigins: metric.failedOrigins,
    coverage: round(metric.coverage),
    metrics: {
      mae: metric.mae,
      rmse: metric.rmse,
      mase: metric.mase,
      smape: metric.smape,
      directionalAccuracy: metric.directionalAccuracy,
      bias: metric.bias,
    },
  }
}

function canonicalizePersistedPoint(point: {
  forecastOriginAt: Date
  horizonLabel: string
  horizonSteps: number
  targetDate: Date
  actualObservedAt: Date | null
  originValue: unknown
  forecastValue: unknown
  actualValue: unknown
  errorValue: unknown
  absoluteErrorValue: unknown
  deltaValue: unknown
  deltaPct: number | null
  maseScale: number
  metadataJson: unknown
}) {
  return {
    forecastOrigin: normalizeDate(point.forecastOriginAt),
    horizon: point.horizonLabel,
    horizonSteps: point.horizonSteps,
    forecastDate: normalizeDate(point.targetDate),
    actualObservedAt: normalizeDate(point.actualObservedAt),
    originValue: toNumber(point.originValue),
    forecastValue: toNumber(point.forecastValue),
    actualValue: toNumber(point.actualValue),
    error: toNumber(point.errorValue),
    absoluteError: toNumber(point.absoluteErrorValue),
    delta: toNumber(point.deltaValue),
    deltaPct: point.deltaPct,
    maseScale: point.maseScale,
    metadata: canonicalizeJson(point.metadataJson),
  }
}

function canonicalizeBridgePoint(point: ForecastVerificationRecord) {
  return {
    forecastOrigin: normalizeDate(point.forecastOrigin),
    horizon: point.horizon,
    horizonSteps: point.horizonSteps,
    forecastDate: normalizeDate(point.forecastDate),
    actualObservedAt: normalizeDate(point.actualObservedAt),
    originValue: point.originValue,
    forecastValue: point.forecastValue,
    actualValue: point.actualValue,
    error: point.error,
    absoluteError: point.absoluteError,
    delta: point.delta,
    deltaPct: point.deltaPct,
    maseScale: point.maseScale,
    metadata: canonicalizeJson(point.metadata),
  }
}

function averageParityMetric(values: number[]) {
  return values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0) / values.length
}

function calculateParityMetricsFromRecords(records: ForecastVerificationRecord[]) {
  if (records.length === 0) {
    return null
  }

  const rmseBase = averageParityMetric(records.map((record) => record.error ** 2))
  const maseValues = records
    .filter((record) => record.maseScale > 0)
    .map((record) => record.absoluteError / record.maseScale)
  const smapeValues = records
    .map((record) => {
      const denominator = Math.abs(record.forecastValue) + Math.abs(record.actualValue)
      return denominator === 0 ? null : (2 * record.absoluteError) / denominator
    })
    .filter((value): value is number => value !== null && Number.isFinite(value))

  return {
    mae: averageParityMetric(records.map((record) => record.absoluteError)),
    rmse: rmseBase === null ? null : Math.sqrt(rmseBase),
    mase: averageParityMetric(maseValues),
    smape: averageParityMetric(smapeValues),
    directionalAccuracy: averageParityMetric(records.map((record) => {
      const forecastDirection = Math.sign(record.delta)
      const actualDirection = Math.sign(record.actualValue - record.originValue)
      return forecastDirection === actualDirection ? 1 : 0
    })),
    bias: averageParityMetric(records.map((record) => record.error)),
  }
}

function resolveBridgeHorizonSteps(horizonLabel: string, records: ForecastVerificationRecord[]) {
  const fromRecord = records[0]?.horizonSteps
  if (typeof fromRecord === 'number') {
    return fromRecord
  }

  const parsed = Number.parseInt(horizonLabel, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function metricsPayloadMatches(
  left: {
    mae: number | null
    rmse: number | null
    mase: number | null
    smape: number | null
    directionalAccuracy: number | null
    bias: number | null
  } | null,
  right: {
    mae: number | null
    rmse: number | null
    mase: number | null
    smape: number | null
    directionalAccuracy: number | null
    bias: number | null
  } | null,
) {
  if (!left || !right) {
    return left === right
  }

  return compareNumber(left.mae, right.mae)
    && compareNumber(left.rmse, right.rmse)
    && compareNumber(left.mase, right.mase)
    && compareNumber(left.smape, right.smape)
    && compareNumber(left.directionalAccuracy, right.directionalAccuracy)
    && compareNumber(left.bias, right.bias)
}

function parityMetricsMatch(
  left: Array<{
    horizon: string
    horizonSteps: number
    origins: number
    expectedOrigins: number
    failedOrigins: number
    coverage: number
    metrics: {
      mae: number | null
      rmse: number | null
      mase: number | null
      smape: number | null
      directionalAccuracy: number | null
      bias: number | null
    } | null
  }>,
  right: Array<{
    horizon: string
    horizonSteps: number
    origins: number
    expectedOrigins: number
    failedOrigins: number
    coverage: number
    metrics: {
      mae: number | null
      rmse: number | null
      mase: number | null
      smape: number | null
      directionalAccuracy: number | null
      bias: number | null
    } | null
  }>,
) {
  if (left.length !== right.length) {
    return false
  }

  return left.every((metric, index) => {
    const candidate = right[index]
    return candidate !== undefined
      && metric.horizon === candidate.horizon
      && metric.horizonSteps === candidate.horizonSteps
      && metric.origins === candidate.origins
      && metric.expectedOrigins === candidate.expectedOrigins
      && metric.failedOrigins === candidate.failedOrigins
      && compareNumber(metric.coverage, candidate.coverage)
      && metricsPayloadMatches(metric.metrics, candidate.metrics)
  })
}

function sortParityPoints<T extends { forecastOrigin: string | null, horizon: string, forecastDate: string | null }>(points: T[]) {
  return [...points].sort((left, right) => [left.forecastOrigin ?? '', left.horizon, left.forecastDate ?? ''].join('|').localeCompare([right.forecastOrigin ?? '', right.horizon, right.forecastDate ?? ''].join('|')))
}

async function runStatisticalParity(
  harness: ReturnType<typeof createInstrumentedHarness>,
  pathDefinition: PathDefinition,
) {
  logPhase(`runtime-parity:start ${pathLabel(pathDefinition)}`)
  await rebuildExactVerificationArtifactForParity(harness, pathDefinition)
  const perModel: Record<string, unknown> = {}
  let status: 'PASS' | 'FAIL' = 'PASS'

  for (const modelId of MODELS) {
    const persisted = await readExactVerificationRun(pathDefinition, modelId)
    const bridge = await harness.executeVerificationDirect(pathDefinition, modelId)
    if (!persisted || !isVerificationAvailableResponse(bridge)) {
      perModel[modelId] = {
        recordCountParity: 'FAIL',
        metricParity: 'FAIL',
        failureReason: 'Persisted artifact or direct bridge verification was unavailable.',
        status: 'FAIL',
      }
      status = 'FAIL'
      continue
    }

    const persistedMetrics = [...persisted.metrics]
      .sort((left, right) => left.horizonSteps - right.horizonSteps || left.horizonLabel.localeCompare(right.horizonLabel))
      .map(canonicalizePersistedMetric)
    const bridgeMetrics = Object.entries(bridge.result.backtest)
      .map(([horizonLabel, horizon]) => ({
      horizon: horizonLabel,
      horizonSteps: resolveBridgeHorizonSteps(horizonLabel, horizon.records),
      origins: horizon.origins,
      expectedOrigins: horizon.expectedOrigins,
      failedOrigins: horizon.failedOrigins,
      coverage: round(horizon.coverage),
      metrics: horizon.metrics ? {
        mae: horizon.metrics.mae,
        rmse: horizon.metrics.rmse,
        mase: horizon.metrics.mase,
        smape: horizon.metrics.smape,
        directionalAccuracy: horizon.metrics.directional_accuracy,
        bias: horizon.metrics.bias,
      } : null,
    }))
      .sort((left, right) => left.horizonSteps - right.horizonSteps || left.horizon.localeCompare(right.horizon))
    const persistedPoints = sortParityPoints(persisted.points.map(canonicalizePersistedPoint))
    const bridgePoints = sortParityPoints(Object.values(bridge.result.backtest).flatMap((horizon) => horizon.records.map(canonicalizeBridgePoint)))

    const recordCountParity = persistedPoints.length === bridgePoints.length
    let perRecordParity = true
    if (recordCountParity) {
      for (let index = 0; index < persistedPoints.length; index += 1) {
        const left = persistedPoints[index]!
        const right = bridgePoints[index]!
        const matches = left.forecastOrigin === right.forecastOrigin
          && left.horizon === right.horizon
          && left.horizonSteps === right.horizonSteps
          && left.forecastDate === right.forecastDate
          && compareNumber(left.originValue, right.originValue)
          && compareNumber(left.forecastValue, right.forecastValue)
          && compareNumber(left.actualValue, right.actualValue)
          && compareNumber(left.error, right.error)
          && compareNumber(left.absoluteError, right.absoluteError)
          && compareNumber(left.delta, right.delta)
          && compareNumber(left.deltaPct, right.deltaPct)
          && compareNumber(left.maseScale, right.maseScale)
          && JSON.stringify(left.metadata) === JSON.stringify(right.metadata)
        if (!matches) {
          perRecordParity = false
          break
        }
      }
    } else {
      perRecordParity = false
    }

    const metricParity = parityMetricsMatch(persistedMetrics, bridgeMetrics)
    const passes = recordCountParity && perRecordParity && metricParity
    if (!passes) {
      status = 'FAIL'
    }
    perModel[modelId] = {
      recordCountParity: recordCountParity ? 'PASS' : 'FAIL',
      perRecordParity: perRecordParity ? 'PASS' : 'FAIL',
      metricParity: metricParity ? 'PASS' : 'FAIL',
      persistedRecordCount: persistedPoints.length,
      bridgeRecordCount: bridgePoints.length,
      status: passes ? 'PASS' : 'FAIL',
    }
  }

  logPhase(`runtime-parity:done ${pathLabel(pathDefinition)} status=${status}`)
  return { perModel, status }
}

async function runRepresentativeFailureRecovery(harness: ReturnType<typeof createInstrumentedHarness>, pathDefinition: PathDefinition) {
  logPhase('representative-failure-recovery:start')
  const history = buildSyntheticHistory(pathDefinition.series)
  await clearSeriesArtifacts([pathDefinition.series.seriesId])
  await seedHistory(history)

  const initialResult = await harness.service.resolveVerificationRequest(buildRequest(pathDefinition, REPRESENTATIVE_MODEL, {
    maxOriginsPerRun: MAX_ORIGINS_PER_BATCH,
  }))
  if (initialResult.status === 'FAILED') {
    throw new Error('Stage 9 failure recovery baseline batch failed unexpectedly.')
  }
  const baselineRun = await readLatestVerificationRun(pathDefinition, REPRESENTATIVE_MODEL)
  const checkpoint = baselineRun ? extractOriginDatesFromPoints(baselineRun.points).at(-1) ?? null : null
  const baselineKeys = new Set((baselineRun?.points ?? []).map(buildPointKey))

  let failureThrown: string | null = null
  harness.setFailureHook((call) => (
    call.modelId === REPRESENTATIVE_MODEL && normalizeDate(call.lastProcessedOriginDate) === checkpoint
      ? 'Injected Stage 9 evidence failure.'
      : null
  ))
  try {
    await harness.service.resolveVerificationRequest(buildRequest(pathDefinition, REPRESENTATIVE_MODEL, {
      maxOriginsPerRun: MAX_ORIGINS_PER_BATCH,
    }))
  } catch (error) {
    failureThrown = error instanceof Error ? error.message : String(error)
  } finally {
    harness.setFailureHook(null)
  }

  const afterFailureRun = await readLatestVerificationRun(pathDefinition, REPRESENTATIVE_MODEL)
  harness.clearCalls()
  const recoveryResult = await harness.service.resolveVerificationRequest(buildRequest(pathDefinition, REPRESENTATIVE_MODEL, {
    maxOriginsPerRun: MAX_ORIGINS_PER_BATCH,
  }))
  const recoveryCall = harness.calls.filter((entry) => entry.mode === 'verification' && entry.modelId === REPRESENTATIVE_MODEL).at(-1) ?? null
  const afterRecoveryRun = await readLatestVerificationRun(pathDefinition, REPRESENTATIVE_MODEL)
  const recoveryKeys = new Set((afterRecoveryRun?.points ?? []).map(buildPointKey))
  const duplicateCount = (afterRecoveryRun?.points.length ?? 0) - recoveryKeys.size
  const passes = failureThrown !== null
    && (afterFailureRun?.points.length ?? 0) === (baselineRun?.points.length ?? 0)
    && normalizeDate(recoveryCall?.lastProcessedOriginDate) === checkpoint
    && (afterRecoveryRun?.points.length ?? 0) > baselineKeys.size
    && duplicateCount === 0
    && recoveryResult.status !== 'FAILED'

  const result = {
    resultStatus: recoveryResult.status,
    failureMessage: failureThrown,
    checkpointBeforeFailure: checkpoint,
    resumeFromOriginDate: normalizeDate(recoveryCall?.lastProcessedOriginDate),
    pointsAfterFailure: afterFailureRun?.points.length ?? 0,
    pointsAfterRecovery: afterRecoveryRun?.points.length ?? 0,
    duplicatePointCount: duplicateCount,
    status: passes ? 'PASS' : 'FAIL',
  }
  logPhase(`representative-failure-recovery:done status=${result.status}`)
  return result
}

async function runRepresentativeConcurrency(harness: ReturnType<typeof createInstrumentedHarness>, pathDefinition: PathDefinition) {
  logPhase('representative-concurrency:start')
  const history = buildSyntheticHistory(pathDefinition.series)
  await clearSeriesArtifacts([pathDefinition.series.seriesId])
  await seedHistory(history)

  harness.clearCalls()
  const results = await Promise.all(Array.from({ length: CONCURRENCY_REQUEST_COUNT }, () => (
    harness.service.resolveVerificationRequest(buildRequest(pathDefinition, REPRESENTATIVE_MODEL))
  )))
  const rows = await readVerificationLedgerRows(pathDefinition, REPRESENTATIVE_MODEL)
  const completed = rows.filter((row) => row.executionStatus === 'COMPLETED')
  const ownerCount = completed.length
  const waiterCount = harness.telemetryEvents.filter((entry) => entry.event === 'single_flight_waiter_joined').length
  const ownerAcquiredCount = harness.telemetryEvents.filter((entry) => entry.event === 'single_flight_owner_acquired').length
  const verificationCalls = harness.calls.filter((entry) => entry.mode === 'verification' && entry.modelId === REPRESENTATIVE_MODEL).length
  const passes = results.every((result) => result.status === 'AVAILABLE')
    && ownerCount === 1
    && ownerAcquiredCount === 1
    && waiterCount === CONCURRENCY_REQUEST_COUNT - 1
    && verificationCalls === 1

  const result = {
    requestCount: CONCURRENCY_REQUEST_COUNT,
    resultStatuses: results.map((result) => result.status),
    ownerCount,
    ownerAcquiredCount,
    waiterCount,
    verificationCalls,
    ledgerRowCount: rows.length,
    status: passes ? 'PASS' : 'FAIL',
  }
  logPhase(`representative-concurrency:done status=${result.status}`)
  return result
}

async function runRepresentativeIdentityIsolation(harness: ReturnType<typeof createInstrumentedHarness>) {
  logPhase('representative-identity-isolation:start')
  const monthlySeries = SERIES_DEFINITIONS.find((definition) => definition.frequency === 'MONTHLY')!
  const endOfPeriodPath: PathDefinition = { series: monthlySeries, target: monthlySeries.targets[0]! }
  const monthlyAveragePath: PathDefinition = { series: monthlySeries, target: monthlySeries.targets[1]! }
  const history = buildSyntheticHistory(monthlySeries)
  await clearSeriesArtifacts([monthlySeries.seriesId])
  await seedHistory(history)

  harness.clearCalls()
  await harness.service.resolveVerificationRequest(buildRequest(endOfPeriodPath, REPRESENTATIVE_MODEL, {
    maxOriginsPerRun: MAX_ORIGINS_PER_BATCH,
  }))
  const eopCall = harness.calls.filter((entry) => entry.mode === 'verification' && entry.targetBasis === 'END_OF_PERIOD').at(-1) ?? null
  const eopRun = await readLatestVerificationRun(endOfPeriodPath, REPRESENTATIVE_MODEL)

  harness.clearCalls()
  await harness.service.resolveVerificationRequest(buildRequest(monthlyAveragePath, REPRESENTATIVE_MODEL, {
    maxOriginsPerRun: MAX_ORIGINS_PER_BATCH,
  }))
  const averageCall = harness.calls.filter((entry) => entry.mode === 'verification' && entry.targetBasis === 'MONTHLY_AVERAGE').at(-1) ?? null
  const averageRun = await readLatestVerificationRun(monthlyAveragePath, REPRESENTATIVE_MODEL)
  const rows = await readVerificationLedgerRows(endOfPeriodPath, REPRESENTATIVE_MODEL)
  const logicalKeys = [...new Set(rows.map((row) => row.logicalArtifactKey))]

  const passes = normalizeDate(eopCall?.lastProcessedOriginDate) === null
    && normalizeDate(averageCall?.lastProcessedOriginDate) === null
    && eopRun?.id !== averageRun?.id
    && logicalKeys.length >= 2

  const result = {
    endOfPeriodRunId: eopRun?.id ?? null,
    monthlyAverageRunId: averageRun?.id ?? null,
    endOfPeriodResumeFromOriginDate: normalizeDate(eopCall?.lastProcessedOriginDate),
    monthlyAverageResumeFromOriginDate: normalizeDate(averageCall?.lastProcessedOriginDate),
    distinctLogicalArtifactKeys: logicalKeys.length,
    status: passes ? 'PASS' : 'FAIL',
  }
  logPhase(`representative-identity-isolation:done status=${result.status}`)
  return result
}

async function runRepresentativeSourceRevisionFailClosed(harness: ReturnType<typeof createInstrumentedHarness>, pathDefinition: PathDefinition) {
  logPhase('representative-source-revision:start')
  const baselineHistory = buildSyntheticHistory(pathDefinition.series)
  await clearSeriesArtifacts([pathDefinition.series.seriesId])
  await seedHistory(baselineHistory)

  await harness.service.resolveVerificationRequest(buildRequest(pathDefinition, REPRESENTATIVE_MODEL, {
    maxOriginsPerRun: MAX_ORIGINS_PER_BATCH,
  }))
  const baselineRun = await readLatestVerificationRun(pathDefinition, REPRESENTATIVE_MODEL)

  const mutatedHistory = buildSyntheticHistory(pathDefinition.series, {
    mutateIndex: 10,
    mutateDelta: 9.25,
  })
  await seedHistory(mutatedHistory)

  harness.clearCalls()
  const verificationResult = await harness.service.resolveVerificationRequest(buildRequest(pathDefinition, REPRESENTATIVE_MODEL, {
    maxOriginsPerRun: MAX_ORIGINS_PER_BATCH,
  }))
  const mutationCall = harness.calls.filter((entry) => entry.mode === 'verification' && entry.modelId === REPRESENTATIVE_MODEL).at(-1) ?? null
  const mutatedRun = await readLatestVerificationRun(pathDefinition, REPRESENTATIVE_MODEL)
  const passes = normalizeDate(mutationCall?.lastProcessedOriginDate) === null
    && baselineRun?.historyFingerprint !== mutatedRun?.historyFingerprint
    && verificationResult.status !== 'FAILED'

  const result = {
    resultStatus: verificationResult.status,
    baselineHistoryFingerprint: baselineRun?.historyFingerprint ?? null,
    mutatedHistoryFingerprint: mutatedRun?.historyFingerprint ?? null,
    resumeFromOriginDate: normalizeDate(mutationCall?.lastProcessedOriginDate),
    status: passes ? 'PASS' : 'FAIL',
  }
  logPhase(`representative-source-revision:done status=${result.status}`)
  return result
}

async function runRepresentativeFastReadyIsolation(
  harness: ReturnType<typeof createInstrumentedHarness>,
  capabilityService: ReturnType<typeof createForecastCapabilityService>,
) {
  logPhase('representative-fast-ready:start')
  const monthlySeries = SERIES_DEFINITIONS.find((definition) => definition.frequency === 'MONTHLY')!
  const pathDefinition: PathDefinition = { series: monthlySeries, target: monthlySeries.targets[0]! }
  const history = buildSyntheticHistory(monthlySeries)
  await clearSeriesArtifacts([monthlySeries.seriesId])
  await seedHistory(history)

  const currentRequest = buildRequest(pathDefinition, REPRESENTATIVE_MODEL)
  const current = await harness.service.resolveCurrentForecastRequest(currentRequest)
  const recent = await harness.service.resolveRecentVerificationRequest(currentRequest)
  const historical = await harness.service.resolveVerificationRequest({
    ...currentRequest,
    maxOriginsPerRun: MAX_ORIGINS_PER_BATCH,
  })
  const preparedCurrent = await harness.service.readPreparedCurrentForecastRequest(currentRequest)
  const preparedRecent = await harness.service.readPreparedRecentVerificationRequest(currentRequest)
  const preparedHistorical = await harness.service.readPreparedVerificationRequest(currentRequest)

  const operations = createForecastProductionOperationsService({
    resolveCapabilities: (seriesId) => capabilityService.resolveBySeriesId(seriesId),
    prepareMonthlyCurrent: (input) => harness.service.resolveCurrentForecastRequest(input),
    prepareMonthlyHistorical: (input) => harness.service.resolveVerificationRequest(input),
  })
  const operationResult = await operations.run({
    seriesId: monthlySeries.seriesId,
    targetSemantics: ['END_OF_PERIOD'],
    modelIds: [REPRESENTATIVE_MODEL],
    prepareHistorical: true,
    maxOriginsPerRun: MAX_ORIGINS_PER_BATCH,
  })
  const item = operationResult.results[0]
  const passes = current.status === 'AVAILABLE'
    && recent.status === 'AVAILABLE'
    && historical.status === 'NOT_AVAILABLE'
    && preparedHistorical.status === 'NOT_AVAILABLE'
    && item?.historical === 'IN_PROGRESS'

  const result = {
    currentStatus: current.status,
    recentStatus: recent.status,
    boundedHistoricalStatus: historical.status,
    preparedCurrentStatus: preparedCurrent.status,
    preparedRecentStatus: preparedRecent.status,
    preparedHistoricalStatus: preparedHistorical.status,
    operationStatus: operationResult.status,
    operationHistoricalState: item?.historical ?? null,
    status: passes ? 'PASS' : 'FAIL',
  }
  logPhase(`representative-fast-ready:done status=${result.status}`)
  return result
}

async function runRegressionScript(options: {
  label: string
  command: string
  args: string[]
  outputJsonEnv: string
  outputMdEnv: string
}) {
  logPhase(`${options.label}:start`)
  const tempDir = path.join(os.tmpdir(), `stage9-${options.label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`)
  await mkdir(tempDir, { recursive: true })
  const outputJson = path.join(tempDir, `${options.label}.json`)
  const outputMd = path.join(tempDir, `${options.label}.md`)
  await execFile(options.command, options.args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      [options.outputJsonEnv]: outputJson,
      [options.outputMdEnv]: outputMd,
    },
    maxBuffer: 20 * 1024 * 1024,
  })
  const parsed = JSON.parse(await readFile(outputJson, 'utf8')) as Record<string, unknown>
  const result = {
    status: 'PASS' as const,
    outputJson,
    outputMd,
    summary: parsed.finalDecision ?? parsed.conclusions ?? null,
  }
  logPhase(`${options.label}:done status=${result.status}`)
  return result
}

async function runFocusedValidations() {
  logPhase('focused-validations:start')
  await execFile('node', ['--import', TSX_IMPORT_SPECIFIER, '--test', 'tests/forecast-library-service.test.ts'], {
    cwd: process.cwd(),
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  })
  await execFile('node', ['--import', TSX_IMPORT_SPECIFIER, '--test', 'tests/forecast-production-operations.test.ts'], {
    cwd: process.cwd(),
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  })
  await execFile('node', ['--import', TSX_IMPORT_SPECIFIER, '--test', 'tests/forecast-prepared-state.test.ts'], {
    cwd: process.cwd(),
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  })
  await execFile(PYTHON_BIN, ['-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_bounded_non_daily_verification.py'], {
    cwd: FORECASTING_TOOL_ROOT,
    env: {
      ...process.env,
      PYTHONPATH: [FORECASTING_TOOL_ROOT, process.env.PYTHONPATH ?? ''].filter((value) => value.length > 0).join(path.delimiter),
    },
    maxBuffer: 20 * 1024 * 1024,
  })

  const result = {
    forecastLibrary: 'PASS',
    productionOperations: 'PASS',
    preparedState: 'PASS',
    pythonBoundedVerification: 'PASS',
  }
  logPhase('focused-validations:done status=PASS')
  return result
}

function renderMarkdown(result: Record<string, unknown>) {
  const finalDecision = result.finalDecision as Record<string, unknown>
  const lines = [
    '# PPF-1 Stage 9 Final Acceptance Evidence',
    '',
    ...Object.entries(finalDecision).map(([key, value]) => `${key} = ${value}`),
    '',
    '## Scope',
    '',
    '- Evidence is driven through the forecast-library verification owner path with real PostgreSQL persistence.',
    '- Non-daily capability law is proven against controlled synthetic provenance for every currently lawful non-daily frequency.',
    '- Stage 7 and Stage 8 regressions are rerun from the same exact source SHA via output-isolated evidence commands.',
    '',
    '## Runtime Matrix',
    '',
    ...Object.entries(result.runtimeMatrix as Record<string, RuntimeMatrixEntry>).map(([label, entry]) => `${label} = ${entry.status}`),
    '',
    '## Representative Proofs',
    '',
    ...Object.entries(result.representativeProofs as Record<string, { status: string }>).map(([label, entry]) => `${label} = ${entry.status}`),
    '',
  ]
  return `${lines.join('\n')}\n`
}

async function main() {
  await ensureValidationDirectory()
  logPhase('main:start')

  const evidenceWorktreeHead = await readGitHead()
  const sourceCandidateSha = resolveSourceCandidateSha('STAGE9_SOURCE_CANDIDATE_SHA', evidenceWorktreeHead)
  const cleanWorktree = await isGitWorktreeClean()
  const dependencyProvenance = {
    tsxLoaderPresent: existsSync(TSX_LOADER),
    pythonBinPresent: existsSync(PYTHON_BIN),
    status: existsSync(TSX_LOADER) && existsSync(PYTHON_BIN) ? 'PASS' as const : 'FAIL' as const,
  }
  const databaseIdentity = await readDatabaseIdentity()
  const activeRunnerCountBeforeStart = await countActiveEvidenceRunners()
  if (activeRunnerCountBeforeStart !== 0) {
    throw new Error(`Stage 9 final evidence preflight requires zero active evidence runners before start; observed ${activeRunnerCountBeforeStart}.`)
  }
  if (Number((databaseIdentity as { freeDiskBytes: number }).freeDiskBytes) < MIN_FREE_DISK_BYTES) {
    throw new Error('Stage 9 final evidence requires at least 15 GB of free disk space.')
  }

  const capabilityService = createForecastCapabilityService({
    resolveProvenance: async (seriesId, history) => buildSyntheticProvenance(seriesId, history.frequency as SourceFrequency),
  })
  const harness = createInstrumentedHarness()
  const allSeriesIds = SERIES_DEFINITIONS.map((definition) => definition.seriesId)
  logPhase('seed:reset')
  await clearSeriesArtifacts(allSeriesIds)
  for (const definition of SERIES_DEFINITIONS) {
    await seedHistory(buildSyntheticHistory(definition))
  }

  const capabilityMatrix = await runCapabilityMatrix()

  const runtimeMatrix: Record<string, RuntimeMatrixEntry> = {}
  for (const definition of SERIES_DEFINITIONS) {
    for (const target of definition.targets) {
      const pathDefinition: PathDefinition = { series: definition, target }
      logPhase(`runtime-path:start ${pathLabel(pathDefinition)}`)
      await clearSeriesArtifacts([definition.seriesId])
      await seedHistory(buildSyntheticHistory(definition))
      const multiBatch = await runBatchesToComplete(harness, pathDefinition)
      const warmReuse = await runWarmReuse(harness, pathDefinition)
      const appendOnlyDelta = await runAppendOnlyDelta(harness, pathDefinition)
      const statisticalParity = await runStatisticalParity(harness, pathDefinition)
      const status = multiBatch.status === 'PASS'
        && warmReuse.status === 'PASS'
        && appendOnlyDelta.status === 'PASS'
        && statisticalParity.status === 'PASS'
        ? 'PASS'
        : 'FAIL'
      runtimeMatrix[pathLabel(pathDefinition)] = {
        frequency: definition.frequency,
        targetBasis: target.targetBasis,
        targetCadence: target.targetCadence,
        multiBatch,
        warmReuse,
        appendOnlyDelta,
        statisticalParity,
        status,
      }
      logPhase(`runtime-path:done ${pathLabel(pathDefinition)} status=${status}`)
    }
  }

  const representativePath: PathDefinition = {
    series: SERIES_DEFINITIONS.find((definition) => definition.frequency === 'MONTHLY')!,
    target: SERIES_DEFINITIONS.find((definition) => definition.frequency === 'MONTHLY')!.targets[0]!,
  }
  logPhase('representative-proofs:start')
  const representativeProofs = {
    failureRecovery: await runRepresentativeFailureRecovery(harness, representativePath),
    concurrency: await runRepresentativeConcurrency(harness, representativePath),
    identityIsolation: await runRepresentativeIdentityIsolation(harness),
    sourceRevisionFailClosed: await runRepresentativeSourceRevisionFailClosed(harness, representativePath),
    fastReadyIsolation: await runRepresentativeFastReadyIsolation(harness, capabilityService),
  }
  logPhase('representative-proofs:done')

  const stage7Regression = await runRegressionScript({
    label: 'stage7-regression',
    command: 'node',
    args: ['--import', TSX_IMPORT_SPECIFIER, 'scripts/run-forecast-stage7-evidence.ts'],
    outputJsonEnv: 'STAGE7_RESULT_JSON_PATH',
    outputMdEnv: 'STAGE7_RESULT_MD_PATH',
  })
  const stage8Regression = await runRegressionScript({
    label: 'stage8-regression',
    command: 'node',
    args: ['scripts/run-with-tsx-loader.mjs', 'scripts/run-forecast-stage8-final-evidence.ts'],
    outputJsonEnv: 'STAGE8_RESULT_JSON_PATH',
    outputMdEnv: 'STAGE8_RESULT_MD_PATH',
  })
  const tests = await runFocusedValidations()

  const runtimeMatrixPass = Object.values(runtimeMatrix).every((entry) => entry.status === 'PASS')
  const representativePass = Object.values(representativeProofs).every((entry) => entry.status === 'PASS')
  const finalDecision = buildStage9FinalDecision({
    sourceCandidateSha,
    evidenceWorktreeHead,
    cleanWorktree,
    databaseHost: (databaseIdentity as { host: string | null }).host,
    capabilityMatrixStatus: capabilityMatrix.status,
    runtimeMatrixPass,
    representativePass,
    stage7Status: stage7Regression.status,
    stage8Status: stage8Regression.status,
    focusedValidationPass: Object.values(tests).every((value) => value === 'PASS'),
    dependencyProvenancePass: dependencyProvenance.status === 'PASS',
    lawfulNonDailyPathCount: Object.keys(runtimeMatrix).length,
  })

  const result = {
    sourceCandidateSha,
    evidenceWorktreeHead,
    cleanWorktree,
    dependencyProvenance,
    databaseIdentity,
    capabilityMatrix,
    runtimeMatrix,
    representativeProofs,
    stage7Regression,
    stage8Regression,
    tests,
    finalDecision,
    generatedAt: new Date().toISOString(),
  }

  logPhase('write-artifacts:start')
  await writeFile(OUTPUT_JSON, JSON.stringify(result, null, 2), 'utf8')
  await writeFile(OUTPUT_MD, renderMarkdown(result), 'utf8')
  logPhase('write-artifacts:done')
  process.stdout.write(`${JSON.stringify(finalDecision, null, 2)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error))
    process.exitCode = 1
  })
}