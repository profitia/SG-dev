import { AsyncLocalStorage } from 'node:async_hooks'
import { performance } from 'node:perf_hooks'

import { type NextResponse } from 'next/server'

export const FORECAST_REQUEST_TRACE_HEADER = 'x-sg-forecast-trace'
export const FORECAST_REQUEST_DIAGNOSTICS_HEADER = 'x-sg-runtime-request-diagnostics'
export const FORECAST_REQUEST_DIAGNOSTICS_LOG_EVENT = 'FORECAST_REQUEST_DIAGNOSTICS'

const MAX_DIAGNOSTICS_HEADER_REQUEST_ID_LENGTH = 128
const MAX_DIAGNOSTICS_HEADER_ROUTE_LENGTH = 96
const MAX_DIAGNOSTICS_HEADER_METHOD_LENGTH = 16
const MAX_DIAGNOSTICS_HEADER_IDENTITY_LENGTH = 128
const MAX_DIAGNOSTICS_HEADER_SEMANTICS_LENGTH = 96
const MAX_DIAGNOSTICS_HEADER_FREQUENCY_LENGTH = 32

export type ForecastRequestDiagnosticsMetric = string | number | boolean | null

export type ForecastRequestDiagnosticsOperationType =
  | 'READ_ONLY_PREPARED'
  | 'VERIFICATION_MATERIALIZATION'
  | 'CURRENT_MATERIALIZATION'
  | 'CAPABILITY'
  | 'PRODUCTION'
  | 'OTHER'

export type ForecastRequestDiagnosticsPhase =
  | 'HTTP'
  | 'APPLICATION'
  | 'SOURCE_DATA'
  | 'DB_OPERATION'
  | 'DB_QUERY'
  | 'SINGLE_FLIGHT'
  | 'COMPUTE'
  | 'PERSISTENCE'

export type ForecastRequestDiagnosticsEntry =
  | {
      kind: 'EVENT'
      name: string
      phase: ForecastRequestDiagnosticsPhase
      at: string
      metrics: Record<string, ForecastRequestDiagnosticsMetric>
    }
  | {
      kind: 'SPAN'
      name: string
      phase: ForecastRequestDiagnosticsPhase
      startedAt: string
      completedAt: string
      durationMs: number
      metrics: Record<string, ForecastRequestDiagnosticsMetric>
      outcome: 'SUCCESS' | 'ERROR'
      error: string | null
    }

export type ForecastRequestDiagnosticsSnapshot = {
  requestId: string
  route: string
  method: string
  handlerEnteredAt: string
  responseReadyAt: string | null
  responseStatus: number | null
  operationType: ForecastRequestDiagnosticsOperationType
  seriesId: string | null
  modelId: string | null
  targetBasis: string | null
  targetSemantics: string | null
  sourceFrequency: string | null
  targetCadence: string | null
  dbPoolWaitMs: null
  dbPoolWaitObservable: false
  entries: ForecastRequestDiagnosticsEntry[]
}

export type ForecastRequestDiagnosticsHeaderSummary = Omit<ForecastRequestDiagnosticsSnapshot, 'entries'> & {
  schemaVersion: 'bounded-summary-v1'
  entryCount: number
  fullSnapshotLogged: true
  entries: []
}

type ForecastRequestDiagnosticsState = {
  enabled: boolean
  snapshot: ForecastRequestDiagnosticsSnapshot
}

type ForecastRequestDiagnosticsContext = {
  enabled: boolean
  requestId: string
  route: string
  method: string
  operationType: ForecastRequestDiagnosticsOperationType
}

const storage = new AsyncLocalStorage<ForecastRequestDiagnosticsState>()

function nowIso() {
  return new Date().toISOString()
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'unknown'
}

function clampString(value: string, maxLength: number) {
  return value.length <= maxLength ? value : value.slice(0, maxLength)
}

function clampNullableString(value: string | null, maxLength: number) {
  return typeof value === 'string' ? clampString(value, maxLength) : null
}

function buildForecastRequestDiagnosticsHeaderSummary(
  snapshot: ForecastRequestDiagnosticsSnapshot,
): ForecastRequestDiagnosticsHeaderSummary {
  return {
    schemaVersion: 'bounded-summary-v1',
    requestId: clampString(snapshot.requestId, MAX_DIAGNOSTICS_HEADER_REQUEST_ID_LENGTH),
    route: clampString(snapshot.route, MAX_DIAGNOSTICS_HEADER_ROUTE_LENGTH),
    method: clampString(snapshot.method, MAX_DIAGNOSTICS_HEADER_METHOD_LENGTH),
    handlerEnteredAt: snapshot.handlerEnteredAt,
    responseReadyAt: snapshot.responseReadyAt,
    responseStatus: snapshot.responseStatus,
    operationType: snapshot.operationType,
    seriesId: clampNullableString(snapshot.seriesId, MAX_DIAGNOSTICS_HEADER_IDENTITY_LENGTH),
    modelId: clampNullableString(snapshot.modelId, MAX_DIAGNOSTICS_HEADER_IDENTITY_LENGTH),
    targetBasis: clampNullableString(snapshot.targetBasis, MAX_DIAGNOSTICS_HEADER_IDENTITY_LENGTH),
    targetSemantics: clampNullableString(snapshot.targetSemantics, MAX_DIAGNOSTICS_HEADER_SEMANTICS_LENGTH),
    sourceFrequency: clampNullableString(snapshot.sourceFrequency, MAX_DIAGNOSTICS_HEADER_FREQUENCY_LENGTH),
    targetCadence: clampNullableString(snapshot.targetCadence, MAX_DIAGNOSTICS_HEADER_FREQUENCY_LENGTH),
    dbPoolWaitMs: snapshot.dbPoolWaitMs,
    dbPoolWaitObservable: snapshot.dbPoolWaitObservable,
    entryCount: snapshot.entries.length,
    fullSnapshotLogged: true,
    entries: [],
  }
}

function logForecastRequestDiagnostics(snapshot: ForecastRequestDiagnosticsSnapshot) {
  console.info(JSON.stringify({
    event: FORECAST_REQUEST_DIAGNOSTICS_LOG_EVENT,
    requestId: snapshot.requestId,
    route: snapshot.route,
    method: snapshot.method,
    handlerEnteredAt: snapshot.handlerEnteredAt,
    responseReadyAt: snapshot.responseReadyAt,
    responseStatus: snapshot.responseStatus,
    operationType: snapshot.operationType,
    seriesId: snapshot.seriesId,
    modelId: snapshot.modelId,
    targetBasis: snapshot.targetBasis,
    targetSemantics: snapshot.targetSemantics,
    sourceFrequency: snapshot.sourceFrequency,
    targetCadence: snapshot.targetCadence,
    dbPoolWaitMs: snapshot.dbPoolWaitMs,
    dbPoolWaitObservable: snapshot.dbPoolWaitObservable,
    entryCount: snapshot.entries.length,
    entries: snapshot.entries,
  }))
}

export function runWithForecastRequestDiagnostics<T>(
  context: ForecastRequestDiagnosticsContext,
  operation: () => T,
) {
  if (!context.enabled) {
    return operation()
  }

  return storage.run({
    enabled: true,
    snapshot: {
      requestId: context.requestId,
      route: context.route,
      method: context.method,
      handlerEnteredAt: nowIso(),
      responseReadyAt: null,
      responseStatus: null,
      operationType: context.operationType,
      seriesId: null,
      modelId: null,
      targetBasis: null,
      targetSemantics: null,
      sourceFrequency: null,
      targetCadence: null,
      dbPoolWaitMs: null,
      dbPoolWaitObservable: false,
      entries: [],
    },
  }, operation)
}

export function updateForecastRequestDiagnosticsIdentity(
  identity: Partial<Pick<
    ForecastRequestDiagnosticsSnapshot,
    'seriesId' | 'modelId' | 'targetBasis' | 'targetSemantics' | 'sourceFrequency' | 'targetCadence' | 'operationType'
  >>,
) {
  const state = storage.getStore()
  if (!state?.enabled) {
    return
  }

  state.snapshot = {
    ...state.snapshot,
    ...Object.fromEntries(Object.entries(identity).filter(([, value]) => value !== undefined)),
  }
}

export function noteForecastRequestDiagnosticsEvent(
  name: string,
  phase: ForecastRequestDiagnosticsPhase,
  metrics: Record<string, ForecastRequestDiagnosticsMetric> = {},
) {
  const state = storage.getStore()
  if (!state?.enabled) {
    return
  }

  state.snapshot.entries.push({
    kind: 'EVENT',
    name,
    phase,
    at: nowIso(),
    metrics,
  })
}

export async function traceForecastRequestDiagnosticsSpan<T>(
  name: string,
  phase: ForecastRequestDiagnosticsPhase,
  operation: () => Promise<T>,
  metrics: Record<string, ForecastRequestDiagnosticsMetric> = {},
) {
  const state = storage.getStore()
  if (!state?.enabled) {
    return operation()
  }

  const startedAt = nowIso()
  const startedAtMs = performance.now()

  try {
    const result = await operation()
    state.snapshot.entries.push({
      kind: 'SPAN',
      name,
      phase,
      startedAt,
      completedAt: nowIso(),
      durationMs: performance.now() - startedAtMs,
      metrics,
      outcome: 'SUCCESS',
      error: null,
    })
    return result
  } catch (error) {
    state.snapshot.entries.push({
      kind: 'SPAN',
      name,
      phase,
      startedAt,
      completedAt: nowIso(),
      durationMs: performance.now() - startedAtMs,
      metrics,
      outcome: 'ERROR',
      error: toErrorMessage(error),
    })
    throw error
  }
}

export function noteForecastRequestDiagnosticsPrismaQuery(event: {
  target: string
  duration: number
  query: string
}) {
  const state = storage.getStore()
  if (!state?.enabled) {
    return
  }

  const completedAtMs = Date.now()
  const queryKind = /^\s*(select|insert|update|delete)\b/i.exec(event.query)?.[1]?.toUpperCase() ?? 'OTHER'
  state.snapshot.entries.push({
    kind: 'SPAN',
    name: 'prisma_query',
    phase: 'DB_QUERY',
    startedAt: new Date(completedAtMs - event.duration).toISOString(),
    completedAt: new Date(completedAtMs).toISOString(),
    durationMs: event.duration,
    metrics: {
      target: event.target,
      queryKind,
    },
    outcome: 'SUCCESS',
    error: null,
  })
}

export function finalizeForecastRequestDiagnostics(status: number) {
  const state = storage.getStore()
  if (!state?.enabled) {
    return null
  }

  state.snapshot.responseReadyAt = nowIso()
  state.snapshot.responseStatus = status
  return state.snapshot
}

export function currentForecastRequestDiagnostics() {
  return storage.getStore()?.snapshot ?? null
}

export function isForecastRequestDiagnosticsEnabled(headers: Headers) {
  return headers.get(FORECAST_REQUEST_TRACE_HEADER) === '1'
}

export function appendForecastRequestDiagnosticsHeader(response: NextResponse) {
  const snapshot = finalizeForecastRequestDiagnostics(response.status)
  if (!snapshot) {
    return response
  }

  logForecastRequestDiagnostics(snapshot)

  response.headers.set(
    FORECAST_REQUEST_DIAGNOSTICS_HEADER,
    Buffer.from(JSON.stringify(buildForecastRequestDiagnosticsHeaderSummary(snapshot)), 'utf8').toString('base64url'),
  )
  return response
}