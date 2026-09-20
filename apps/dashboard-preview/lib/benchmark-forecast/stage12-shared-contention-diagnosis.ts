import {
  FORECAST_PORTFOLIO_MODELS,
  resolveForecastTargetSemantics,
  type ForecastPortfolioModelId,
  type ForecastTargetBasis,
  type ForecastTargetSemantics,
} from './forecast-contract'

const TRACE_HEADER = 'x-sg-forecast-trace'
const DIAGNOSTICS_HEADER = 'x-sg-runtime-request-diagnostics'
const INTERNAL_TIMEOUT_MS = 120_000
const NON_PIT_TARGET_BASES: ForecastTargetBasis[] = ['MONTHLY_AVERAGE', 'END_OF_PERIOD']
const NON_PIT_CADENCE = { sourceFrequency: 'DAILY', targetCadence: 'MONTHLY' }
const PIT_CADENCE = { sourceFrequency: 'DAILY', targetCadence: 'DAILY' }

type ScenarioId = 'NON_PIT_ONLY' | 'PIT_ONLY' | 'CURRENT_PRODUCTION_OVERLAP' | 'CONTROLLED_STAGGER'
type OperationKind = 'READ_CURRENT' | 'READ_VERIFICATION' | 'PREPARE_VERIFICATION'
type RequestDiagnosticsMetric = string | number | boolean | null

type RequestDiagnosticsEntry =
  | {
      kind: 'EVENT'
      name: string
      phase: string
      at: string
      metrics: Record<string, RequestDiagnosticsMetric>
    }
  | {
      kind: 'SPAN'
      name: string
      phase: string
      startedAt: string
      completedAt: string
      durationMs: number
      metrics: Record<string, RequestDiagnosticsMetric>
      outcome: 'SUCCESS' | 'ERROR'
      error: string | null
    }

type RequestDiagnosticsSnapshot = {
  requestId: string
  route: string
  method: string
  handlerEnteredAt: string
  responseReadyAt: string | null
  responseStatus: number | null
  operationType: string
  seriesId: string | null
  modelId: string | null
  targetBasis: string | null
  targetSemantics: string | null
  sourceFrequency: string | null
  targetCadence: string | null
  dbPoolWaitMs: null
  dbPoolWaitObservable: false
  entries: RequestDiagnosticsEntry[]
}

type ExecutionLedgerRow = {
  executionId: string
  logicalArtifactKey: string
  operationFamily: string
  executionStatus: string
  ownerRequestId: string
  latestRequestId: string
  latestRole: string
  waiterCount: number
  startedAt: string
  computeStartedAt: string | null
  computeCompletedAt: string | null
  persistenceStartedAt: string | null
  persistenceCompletedAt: string | null
  completedAt: string | null
  failureReason: string | null
}

type ScenarioRequestRecord = {
  scenarioId: ScenarioId
  operationKind: OperationKind
  route: string
  requestId: string
  seriesId: string
  modelId: ForecastPortfolioModelId
  targetBasis: ForecastTargetBasis
  targetSemantics: ForecastTargetSemantics
  clientStartedAt: string
  clientCompletedAt: string
  clientElapsedMs: number
  httpStatus: number | null
  status: string | null
  reason: string | null
  requestDiagnostics: RequestDiagnosticsSnapshot | null
  decomposition: {
    httpWaitMs: number | null
    handlerLocalMs: number | null
    sourceDataMs: number
    dbOperationMs: number
    dbQueryMs: number
    computeMs: number
    persistenceMs: number
    singleFlightWaitMs: number
    otherProvenMs: number | null
  }
}

function resolveSgRuntimeBaseUrl() {
  if (process.env.SG_RUNTIME_BASE_URL?.trim()) {
    return process.env.SG_RUNTIME_BASE_URL.trim()
  }

  if (process.env.RENDER_EXTERNAL_URL?.trim() || process.env.VERCEL_URL?.trim()) {
    throw new Error('SG_RUNTIME_BASE_URL is required in deployed dashboard-preview environments.')
  }

  return 'http://localhost:3001'
}

function readInternalToken() {
  const token = process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN?.trim() ?? ''
  if (!token) {
    throw new Error('SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN is not configured.')
  }
  return token
}

function decodeDiagnostics(headerValue: string | null) {
  if (!headerValue) {
    return null
  }

  try {
    return JSON.parse(Buffer.from(headerValue, 'base64url').toString('utf8')) as RequestDiagnosticsSnapshot
  } catch {
    return null
  }
}

function sumPhase(snapshot: RequestDiagnosticsSnapshot | null, phase: string) {
  if (!snapshot) {
    return 0
  }

  return snapshot.entries.reduce((sum, entry) => (
    entry.kind === 'SPAN' && entry.phase === phase ? sum + entry.durationMs : sum
  ), 0)
}

function sumSingleFlightWait(snapshot: RequestDiagnosticsSnapshot | null) {
  if (!snapshot) {
    return 0
  }

  return snapshot.entries.reduce((sum, entry) => {
    if (entry.kind !== 'SPAN') {
      return sum
    }

    return /waiter/i.test(entry.name) ? sum + entry.durationMs : sum
  }, 0)
}

function toDecomposition(startedAt: string, completedAt: string, snapshot: RequestDiagnosticsSnapshot | null) {
  const totalMs = Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime())
  const httpWaitMs = snapshot ? Math.max(0, new Date(snapshot.handlerEnteredAt).getTime() - new Date(startedAt).getTime()) : null
  const handlerLocalMs = snapshot?.responseReadyAt
    ? Math.max(0, new Date(snapshot.responseReadyAt).getTime() - new Date(snapshot.handlerEnteredAt).getTime())
    : null
  const sourceDataMs = sumPhase(snapshot, 'SOURCE_DATA')
  const dbOperationMs = sumPhase(snapshot, 'DB_OPERATION')
  const dbQueryMs = sumPhase(snapshot, 'DB_QUERY')
  const computeMs = sumPhase(snapshot, 'COMPUTE')
  const persistenceMs = sumPhase(snapshot, 'PERSISTENCE')
  const singleFlightWaitMs = sumSingleFlightWait(snapshot)
  const accountedMs = (httpWaitMs ?? 0) + (handlerLocalMs ?? 0)

  return {
    httpWaitMs,
    handlerLocalMs,
    sourceDataMs,
    dbOperationMs,
    dbQueryMs,
    computeMs,
    persistenceMs,
    singleFlightWaitMs,
    otherProvenMs: handlerLocalMs === null ? null : Math.max(0, totalMs - accountedMs),
  }
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchSgRuntimeRequest(input: {
  scenarioId: ScenarioId
  operationKind: OperationKind
  route: string
  requestId: string
  seriesId: string
  modelId: ForecastPortfolioModelId
  targetBasis: ForecastTargetBasis
  params: Record<string, string>
}) {
  const url = new URL(input.route, resolveSgRuntimeBaseUrl())
  for (const [key, value] of Object.entries(input.params)) {
    url.searchParams.set(key, value)
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), INTERNAL_TIMEOUT_MS)
  const clientStartedAt = new Date().toISOString()
  const startedAtMs = Date.now()

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${readInternalToken()}`,
        'x-request-id': input.requestId,
        [TRACE_HEADER]: '1',
      },
    })

    const body = await response.text()
    const clientCompletedAt = new Date().toISOString()
    const requestDiagnostics = decodeDiagnostics(response.headers.get(DIAGNOSTICS_HEADER))
    const payload = body.trim().length > 0 ? JSON.parse(body) as { status?: string; reason?: string; error?: string } : {}

    return {
      scenarioId: input.scenarioId,
      operationKind: input.operationKind,
      route: input.route,
      requestId: input.requestId,
      seriesId: input.seriesId,
      modelId: input.modelId,
      targetBasis: input.targetBasis,
      targetSemantics: resolveForecastTargetSemantics(input.targetBasis),
      clientStartedAt,
      clientCompletedAt,
      clientElapsedMs: Math.max(0, Date.now() - startedAtMs),
      httpStatus: response.status,
      status: typeof payload.status === 'string' ? payload.status : response.ok ? 'OK' : null,
      reason: typeof payload.reason === 'string'
        ? payload.reason
        : typeof payload.error === 'string'
          ? payload.error
          : null,
      requestDiagnostics,
      decomposition: toDecomposition(clientStartedAt, clientCompletedAt, requestDiagnostics),
    } satisfies ScenarioRequestRecord
  } catch (error) {
    const clientCompletedAt = new Date().toISOString()
    return {
      scenarioId: input.scenarioId,
      operationKind: input.operationKind,
      route: input.route,
      requestId: input.requestId,
      seriesId: input.seriesId,
      modelId: input.modelId,
      targetBasis: input.targetBasis,
      targetSemantics: resolveForecastTargetSemantics(input.targetBasis),
      clientStartedAt,
      clientCompletedAt,
      clientElapsedMs: Math.max(0, Date.now() - startedAtMs),
      httpStatus: null,
      status: null,
      reason: error instanceof Error ? error.message : 'Unknown SG Runtime request failure.',
      requestDiagnostics: null,
      decomposition: toDecomposition(clientStartedAt, clientCompletedAt, null),
    } satisfies ScenarioRequestRecord
  } finally {
    clearTimeout(timeoutId)
  }
}

function buildNonPitRequestId(scenarioId: ScenarioId, operationKind: OperationKind, targetBasis: ForecastTargetBasis, modelId: ForecastPortfolioModelId) {
  return `${scenarioId.toLowerCase()}-${operationKind.toLowerCase()}-${targetBasis.toLowerCase()}-${modelId}`
}

function buildPitRequestId(scenarioId: ScenarioId, modelId: ForecastPortfolioModelId) {
  return `${scenarioId.toLowerCase()}-prepare-verification-point-in-time-${modelId}`
}

async function runNonPitWave(scenarioId: ScenarioId, operationKind: 'READ_CURRENT' | 'READ_VERIFICATION', seriesId: string) {
  const route = operationKind === 'READ_CURRENT'
    ? '/api/internal/forecast/prepared/current'
    : '/api/internal/forecast/prepared/verification'

  return Promise.all(NON_PIT_TARGET_BASES.flatMap((targetBasis) => (
    FORECAST_PORTFOLIO_MODELS.map((modelId) => fetchSgRuntimeRequest({
      scenarioId,
      operationKind,
      route,
      requestId: buildNonPitRequestId(scenarioId, operationKind, targetBasis, modelId),
      seriesId,
      modelId,
      targetBasis,
      params: {
        seriesId,
        model: modelId,
        targetBasis,
        sourceFrequency: NON_PIT_CADENCE.sourceFrequency,
        targetCadence: NON_PIT_CADENCE.targetCadence,
      },
    }))
  )))
}

async function runPitSerialWave(scenarioId: ScenarioId, seriesId: string) {
  const records: ScenarioRequestRecord[] = []

  for (const modelId of FORECAST_PORTFOLIO_MODELS) {
    records.push(await fetchSgRuntimeRequest({
      scenarioId,
      operationKind: 'PREPARE_VERIFICATION',
      route: '/api/internal/forecast/verification',
      requestId: buildPitRequestId(scenarioId, modelId),
      seriesId,
      modelId,
      targetBasis: 'POINT_IN_TIME',
      params: {
        seriesId,
        model: modelId,
        targetBasis: 'POINT_IN_TIME',
        sourceFrequency: PIT_CADENCE.sourceFrequency,
        targetCadence: PIT_CADENCE.targetCadence,
      },
    }))
  }

  return records
}

async function readExecutionLedger(ownerRequestIds: string[]) {
  if (ownerRequestIds.length === 0) {
    return [] as ExecutionLedgerRow[]
  }

  const response = await fetch(new URL('/api/internal/forecast/execution-ledger', resolveSgRuntimeBaseUrl()), {
    method: 'POST',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${readInternalToken()}`,
      'content-type': 'application/json',
      'x-request-id': `stage12-ledger-${Date.now()}`,
      [TRACE_HEADER]: '1',
    },
    body: JSON.stringify({ ownerRequestIds }),
  })

  const body = await response.text()
  const payload = body.trim().length > 0 ? JSON.parse(body) as { rows?: ExecutionLedgerRow[]; error?: string } : {}

  if (!response.ok) {
    throw new Error(typeof payload.error === 'string' ? payload.error : `Execution ledger lookup failed with HTTP ${response.status}.`)
  }

  return Array.isArray(payload.rows) ? payload.rows : []
}

function summarizeOperation(records: ScenarioRequestRecord[], operationKind: OperationKind) {
  const filtered = records.filter((record) => record.operationKind === operationKind)
  return filtered.map((record) => ({
    requestId: record.requestId,
    modelId: record.modelId,
    targetBasis: record.targetBasis,
    clientElapsedMs: record.clientElapsedMs,
    httpWaitMs: record.decomposition.httpWaitMs,
    handlerLocalMs: record.decomposition.handlerLocalMs,
    sourceDataMs: record.decomposition.sourceDataMs,
    dbOperationMs: record.decomposition.dbOperationMs,
    dbQueryMs: record.decomposition.dbQueryMs,
    computeMs: record.decomposition.computeMs,
    persistenceMs: record.decomposition.persistenceMs,
    status: record.status,
    reason: record.reason,
  }))
}

function buildTimeline(records: ScenarioRequestRecord[], ledgerRows: ExecutionLedgerRow[]) {
  const timeline = [] as Array<Record<string, string | number | null>>

  for (const record of records) {
    timeline.push({
      scenarioId: record.scenarioId,
      requestId: record.requestId,
      operationKind: record.operationKind,
      route: record.route,
      startedAt: record.clientStartedAt,
      completedAt: record.clientCompletedAt,
      clientElapsedMs: record.clientElapsedMs,
      handlerEnteredAt: record.requestDiagnostics?.handlerEnteredAt ?? null,
      responseReadyAt: record.requestDiagnostics?.responseReadyAt ?? null,
    })

    for (const entry of record.requestDiagnostics?.entries ?? []) {
      timeline.push(entry.kind === 'SPAN'
        ? {
            scenarioId: record.scenarioId,
            requestId: record.requestId,
            operationKind: record.operationKind,
            phase: entry.phase,
            name: entry.name,
            startedAt: entry.startedAt,
            completedAt: entry.completedAt,
            durationMs: entry.durationMs,
          }
        : {
            scenarioId: record.scenarioId,
            requestId: record.requestId,
            operationKind: record.operationKind,
            phase: entry.phase,
            name: entry.name,
            at: entry.at,
          })
    }
  }

  for (const row of ledgerRows) {
    timeline.push({
      source: 'EXECUTION_LEDGER',
      requestId: row.ownerRequestId,
      executionId: row.executionId,
      operationFamily: row.operationFamily,
      executionStatus: row.executionStatus,
      startedAt: row.startedAt,
      computeStartedAt: row.computeStartedAt,
      computeCompletedAt: row.computeCompletedAt,
      persistenceStartedAt: row.persistenceStartedAt,
      persistenceCompletedAt: row.persistenceCompletedAt,
      completedAt: row.completedAt,
      waiterCount: row.waiterCount,
    })
  }

  return timeline.sort((left, right) => {
    const leftAt = String(left.startedAt ?? left.at ?? left.computeStartedAt ?? '')
    const rightAt = String(right.startedAt ?? right.at ?? right.computeStartedAt ?? '')
    return leftAt.localeCompare(rightAt)
  })
}

async function runScenario(scenarioId: ScenarioId, seriesId: string, staggerMs: number) {
  if (scenarioId === 'NON_PIT_ONLY') {
    const current = await runNonPitWave(scenarioId, 'READ_CURRENT', seriesId)
    const verification = await runNonPitWave(scenarioId, 'READ_VERIFICATION', seriesId)
    return [...current, ...verification]
  }

  if (scenarioId === 'PIT_ONLY') {
    return runPitSerialWave(scenarioId, seriesId)
  }

  if (scenarioId === 'CURRENT_PRODUCTION_OVERLAP') {
    const pitPromise = runPitSerialWave(scenarioId, seriesId)
    const current = await runNonPitWave(scenarioId, 'READ_CURRENT', seriesId)
    const verification = await runNonPitWave(scenarioId, 'READ_VERIFICATION', seriesId)
    return [...current, ...verification, ...await pitPromise]
  }

  const currentPromise = runNonPitWave(scenarioId, 'READ_CURRENT', seriesId)
  await wait(staggerMs)
  const pitPromise = runPitSerialWave(scenarioId, seriesId)
  const current = await currentPromise
  const verification = await runNonPitWave(scenarioId, 'READ_VERIFICATION', seriesId)
  return [...current, ...verification, ...await pitPromise]
}

export async function runStage12SharedContentionDiagnosis(options: {
  seriesId?: string
  staggerMs?: number
} = {}) {
  const seriesId = options.seriesId ?? 'wocaes0074'
  const staggerMs = options.staggerMs ?? 5_000
  const scenarioIds: ScenarioId[] = ['NON_PIT_ONLY', 'PIT_ONLY', 'CURRENT_PRODUCTION_OVERLAP', 'CONTROLLED_STAGGER']
  const scenarios = [] as Array<{
    scenarioId: ScenarioId
    requests: ScenarioRequestRecord[]
    ownerWaiterRows: ExecutionLedgerRow[]
    ownerWaiterLookupError: string | null
  }>

  for (const scenarioId of scenarioIds) {
    const requests = await runScenario(scenarioId, seriesId, staggerMs)
    const ownerRequestIds = requests
      .filter((request) => request.operationKind === 'PREPARE_VERIFICATION')
      .map((request) => request.requestId)

    let ownerWaiterRows: ExecutionLedgerRow[] = []
    let ownerWaiterLookupError: string | null = null

    try {
      ownerWaiterRows = await readExecutionLedger(ownerRequestIds)
    } catch (error) {
      ownerWaiterLookupError = error instanceof Error ? error.message : 'Execution ledger lookup failed.'
    }

    scenarios.push({ scenarioId, requests, ownerWaiterRows, ownerWaiterLookupError })
  }

  return {
    seriesId,
    sgRuntimeBaseUrl: resolveSgRuntimeBaseUrl(),
    staggerMs,
    scenarios: scenarios.map((scenario) => ({
      scenarioId: scenario.scenarioId,
      executionIds: scenario.requests
        .filter((request) => request.operationKind === 'PREPARE_VERIFICATION')
        .map((request) => request.requestId),
      requestGraph: scenario.requests,
      ownerWaiterTable: scenario.ownerWaiterRows,
      ownerWaiterLookupError: scenario.ownerWaiterLookupError,
      currentPreparedReadComparison: summarizeOperation(scenario.requests, 'READ_CURRENT'),
      verificationPreparedReadComparison: summarizeOperation(scenario.requests, 'READ_VERIFICATION'),
      pitMaterializationComparison: summarizeOperation(scenario.requests, 'PREPARE_VERIFICATION'),
      timeline: buildTimeline(scenario.requests, scenario.ownerWaiterRows),
    })),
  }
}