import {
  FORECAST_PORTFOLIO_MODELS,
  FORECAST_TARGET_BASES,
  type BenchmarkForecastVerificationResult,
  resolveForecastTargetSemantics,
  type BenchmarkForecastCurrentPreparationRequest,
  type BenchmarkForecastCurrentPreparationResult,
  type BenchmarkForecastPreparationState,
  type ForecastPortfolioModelId,
  type ProgressiveForecastPreparationSnapshot,
  type ProgressiveForecastVariantSnapshot,
  type ForecastTargetBasis,
  type InteractiveForecastCapabilityResult,
  type InteractiveForecastPreparationResult,
} from './forecast-contract'

const LOCAL_SG_RUNTIME_BASE_URL = 'http://localhost:3001'
const DEPLOYED_SG_RUNTIME_FALLBACK_BASE_URLS = [
  'https://benchmark-finder-category-builder.onrender.com',
]
const INTERNAL_FORECAST_CAPABILITY_ROUTE_PATH = '/api/internal/forecast/capability'
const INTERNAL_FORECAST_PREPARE_CURRENT_ROUTE_PATH = '/api/internal/forecast/prepare/current'
const INTERNAL_FORECAST_VERIFICATION_ROUTE_PATH = '/api/internal/forecast/verification'
const INTERNAL_FORECAST_PROGRESSIVE_ROUTE_PATH = '/api/internal/forecast/progressive'
const INTERNAL_FORECAST_TIMEOUT_MS = 75_000
const INTERNAL_FORECAST_TIMEOUT_ERROR = 'SG Runtime interactive forecast request timed out.'
export const FORECAST_TRACE_HEADER = 'x-sg-forecast-trace'

export type ForecastBridgeAttemptFailureCause = {
  name: string | null
  code: string | null
  message: string | null
}

export type ForecastBridgeAttemptDiagnosticContext = {
  requestId: string | null
  phase: string | null
  operation: string | null
  seriesId: string | null
  modelId: string | null
  targetBasis: string | null
  pathname: string
  baseUrl: string
}

export type ForecastBridgeAttemptTrace = {
  targetRole: 'PRIMARY' | 'FALLBACK'
  startedAt: string
  completedAt: string
  durationMs: number
  httpStatus: number | null
  responseReceived?: boolean
  timeout: boolean
  callerAborted?: boolean
  internalTimedOut?: boolean
  controllerAborted?: boolean
  fallbackUsed: boolean
  sgRuntimeCapabilityExecutionMs: number | null
  diagnosticContext?: ForecastBridgeAttemptDiagnosticContext
  errorName?: string | null
  errorMessage?: string | null
  errorCause?: ForecastBridgeAttemptFailureCause | null
}

export type ForecastBridgeTrace = {
  dashboardBridgeTotalMs: number
  attempts: ForecastBridgeAttemptTrace[]
  fallbackUsed: boolean
}

type ForecastBridgeRequestOptions = {
  signal?: AbortSignal
  headers?: Record<string, string>
}
type TraceOptions = {
  enabled: boolean
  attempts: ForecastBridgeAttemptTrace[]
}

export function parseBenchmarkForecastCurrentPreparationRequest(
  input: unknown,
): { success: true, data: BenchmarkForecastCurrentPreparationRequest } | { success: false, error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { success: false, error: 'A JSON object is required.' }
  }

  const payload = input as Record<string, unknown>
  const seriesId = typeof payload.seriesId === 'string' ? payload.seriesId.trim() : ''
  const modelId = typeof payload.modelId === 'string' ? payload.modelId.trim() : ''
  const targetBasis = typeof payload.targetBasis === 'string' ? payload.targetBasis.trim() : ''

  if (!seriesId) {
    return { success: false, error: 'seriesId is required.' }
  }

  if (!FORECAST_PORTFOLIO_MODELS.includes(modelId as ForecastPortfolioModelId)) {
    return { success: false, error: `modelId must be one of: ${FORECAST_PORTFOLIO_MODELS.join(', ')}` }
  }

  if (!FORECAST_TARGET_BASES.includes(targetBasis as ForecastTargetBasis)) {
    return { success: false, error: `targetBasis must be one of: ${FORECAST_TARGET_BASES.join(', ')}` }
  }

  return {
    success: true,
    data: {
      seriesId,
      modelId: modelId as ForecastPortfolioModelId,
      targetBasis: targetBasis as ForecastTargetBasis,
    },
  }
}

type GatewayDependencies = {
  resolveCapability: (
    input: BenchmarkForecastCurrentPreparationRequest,
    traceOptions?: TraceOptions,
    requestOptions?: ForecastBridgeRequestOptions,
  ) => Promise<InteractiveForecastCapabilityResult>
  prepareCurrent: (
    input: BenchmarkForecastCurrentPreparationRequest,
    traceOptions?: TraceOptions,
    requestOptions?: ForecastBridgeRequestOptions,
  ) => Promise<InteractiveForecastPreparationResult>
  readProgressiveSnapshot: (
    input: BenchmarkForecastCurrentPreparationRequest,
    traceOptions?: TraceOptions,
    requestOptions?: ForecastBridgeRequestOptions,
  ) => Promise<ProgressiveForecastPreparationSnapshot>
  now: () => number
}

export class SgRuntimeForecastPreparationAuthError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.name = 'SgRuntimeForecastPreparationAuthError'
    this.statusCode = statusCode
  }
}

function resolveSgRuntimeBaseUrl() {
  if (process.env.SG_RUNTIME_BASE_URL?.trim()) {
    return process.env.SG_RUNTIME_BASE_URL.trim()
  }

  if (process.env.RENDER_EXTERNAL_URL?.trim() || process.env.VERCEL_URL?.trim()) {
    throw new Error('SG_RUNTIME_BASE_URL is required in deployed dashboard-preview environments.')
  }

  return LOCAL_SG_RUNTIME_BASE_URL
}

function hasExplicitSgRuntimeBaseUrl() {
  return Boolean(process.env.SG_RUNTIME_BASE_URL?.trim())
}

function resolveSgRuntimeBaseUrls() {
  const primaryBaseUrl = resolveSgRuntimeBaseUrl()
  const candidates = [primaryBaseUrl]

  for (const fallbackBaseUrl of DEPLOYED_SG_RUNTIME_FALLBACK_BASE_URLS) {
    if (!candidates.includes(fallbackBaseUrl)) {
      candidates.push(fallbackBaseUrl)
    }
  }

  return candidates
}

function isMalformedJsonResponseError(error: unknown) {
  return error instanceof Error
    && (error.message.includes('empty JSON response') || error.message.includes('invalid JSON response'))
}

function readSgRuntimeInternalForecastServiceToken() {
  return process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN?.trim() ?? ''
}

function readHeaderValue(headers: HeadersInit | undefined, headerName: string) {
  if (!headers) {
    return null
  }

  if (headers instanceof Headers) {
    return headers.get(headerName)
  }

  if (Array.isArray(headers)) {
    const match = headers.find(([key]) => key.toLowerCase() === headerName.toLowerCase())
    return typeof match?.[1] === 'string' ? match[1] : null
  }

  const value = Object.entries(headers).find(([key]) => key.toLowerCase() === headerName.toLowerCase())?.[1]
  return typeof value === 'string' ? value : null
}

function normalizeErrorCode(value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  return null
}

function resolveErrorCause(error: unknown): ForecastBridgeAttemptFailureCause | null {
  if (!(error instanceof Error) || !("cause" in error)) {
    return null
  }

  const cause = error.cause
  if (!cause || typeof cause !== 'object') {
    return null
  }

  const causeRecord = cause as {
    name?: unknown
    code?: unknown
    message?: unknown
  }

  return {
    name: typeof causeRecord.name === 'string' ? causeRecord.name : null,
    code: normalizeErrorCode(causeRecord.code),
    message: typeof causeRecord.message === 'string' ? causeRecord.message : null,
  }
}

function buildAttemptDiagnosticContext(pathname: string, baseUrl: string, headers: HeadersInit | undefined): ForecastBridgeAttemptDiagnosticContext {
  return {
    requestId: readHeaderValue(headers, 'x-request-id'),
    phase: readHeaderValue(headers, 'x-sg-certification-phase'),
    operation: readHeaderValue(headers, 'x-sg-certification-operation'),
    seriesId: readHeaderValue(headers, 'x-sg-certification-series-id'),
    modelId: readHeaderValue(headers, 'x-sg-certification-model-id'),
    targetBasis: readHeaderValue(headers, 'x-sg-certification-target-basis'),
    pathname,
    baseUrl,
  }
}

async function readInternalJson<T>(
  pathname: string,
  init: RequestInit,
  traceOptions?: TraceOptions,
) {
  let lastError: unknown = null

  const baseUrls = resolveSgRuntimeBaseUrls()

  for (const [index, baseUrl] of baseUrls.entries()) {
    const controller = new AbortController()
    let timedOut = false
    let callerAborted = false
    let responseStatus: number | null = null
    let responseReceived = false
    let sgRuntimeCapabilityExecutionMs: number | null = null
    const timeoutId = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, INTERNAL_FORECAST_TIMEOUT_MS)
    const callerSignal = init.signal
    const abortFromCaller = () => {
      callerAborted = true
      controller.abort()
    }

    if (callerSignal) {
      if (callerSignal.aborted) {
        abortFromCaller()
      } else {
        callerSignal.addEventListener('abort', abortFromCaller, { once: true })
      }
    }
    const startedAt = new Date().toISOString()
    const startedAtMs = Date.now()
    const diagnosticContext = buildAttemptDiagnosticContext(pathname, baseUrl, init.headers)

    try {
      const response = await fetch(new URL(pathname, baseUrl), {
        ...init,
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(traceOptions?.enabled ? { [FORECAST_TRACE_HEADER]: '1' } : {}),
          ...(init.headers ?? {}),
        },
      })
      responseReceived = true
      responseStatus = response.status
      sgRuntimeCapabilityExecutionMs = (() => {
        const header = response.headers.get('x-sg-runtime-capability-total-ms')
        if (!header) return null
        const parsed = Number.parseInt(header, 10)
        return Number.isFinite(parsed) ? parsed : null
      })()

      const body = await response.text()
      if (!body.trim()) {
        throw new Error(`SG Runtime interactive forecast request returned an empty JSON response from ${baseUrl} with status ${response.status}.`)
      }

      let payload: Record<string, unknown>
      try {
        payload = JSON.parse(body) as Record<string, unknown>
      } catch {
        throw new Error(`SG Runtime interactive forecast request returned an invalid JSON response from ${baseUrl} with status ${response.status}.`)
      }

      if (traceOptions?.enabled) {
        traceOptions.attempts.push({
          targetRole: index === 0 ? 'PRIMARY' : 'FALLBACK',
          startedAt,
          completedAt: new Date().toISOString(),
          durationMs: Math.max(0, Date.now() - startedAtMs),
          httpStatus: response.status,
          responseReceived: true,
          timeout: false,
          callerAborted,
          internalTimedOut: false,
          controllerAborted: controller.signal.aborted,
          fallbackUsed: index > 0,
          sgRuntimeCapabilityExecutionMs,
          diagnosticContext,
        })
      }

      if (!response.ok) {
        const message = typeof payload.error === 'string'
          ? payload.error
          : 'SG Runtime interactive forecast request failed.'

        if (response.status === 401 || response.status === 403) {
          throw new SgRuntimeForecastPreparationAuthError(message, response.status)
        }

        throw new Error(message)
      }

      return payload as T
    } catch (error) {
      if (traceOptions?.enabled) {
        traceOptions.attempts.push({
          targetRole: index === 0 ? 'PRIMARY' : 'FALLBACK',
          startedAt,
          completedAt: new Date().toISOString(),
          durationMs: Math.max(0, Date.now() - startedAtMs),
          httpStatus: responseStatus,
          responseReceived,
          timeout: (error as Error).name === 'AbortError',
          callerAborted,
          internalTimedOut: timedOut,
          controllerAborted: controller.signal.aborted,
          fallbackUsed: index > 0,
          sgRuntimeCapabilityExecutionMs,
          diagnosticContext,
          errorName: error instanceof Error ? error.name : null,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorCause: resolveErrorCause(error),
        })
      }

      if (error instanceof SgRuntimeForecastPreparationAuthError) {
        throw error
      }

      lastError = error
      if (callerAborted) {
        throw error
      }
      if ((error as Error).name === 'AbortError' && hasExplicitSgRuntimeBaseUrl()) {
        if (timedOut) {
          throw new Error(INTERNAL_FORECAST_TIMEOUT_ERROR)
        }

        throw error
      }
      if (isMalformedJsonResponseError(error) && index + 1 < baseUrls.length) {
        continue
      }
      if ((error as Error).name !== 'AbortError') {
        throw error
      }
    } finally {
      clearTimeout(timeoutId)
      callerSignal?.removeEventListener('abort', abortFromCaller)
    }
  }

  if ((lastError as Error | null)?.name === 'AbortError') {
    throw new Error(INTERNAL_FORECAST_TIMEOUT_ERROR)
  }

  throw lastError instanceof Error ? lastError : new Error('SG Runtime interactive forecast request failed.')
}

function resolveAuthorizedHeaders(additionalHeaders: Record<string, string> = {}) {
  const token = readSgRuntimeInternalForecastServiceToken()
  if (!token) {
    throw new Error('SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN is not configured.')
  }

  return {
    Authorization: `Bearer ${token}`,
    ...additionalHeaders,
  }
}

function normalizeForecastBridgeRequestOptions(
  requestOptions?: AbortSignal | ForecastBridgeRequestOptions,
): ForecastBridgeRequestOptions | undefined {
  if (!requestOptions) {
    return undefined
  }

  if (requestOptions instanceof AbortSignal) {
    return { signal: requestOptions }
  }

  return requestOptions
}

export async function readInteractiveForecastCapability(
  input: BenchmarkForecastCurrentPreparationRequest,
  traceOptions?: TraceOptions,
  options?: ForecastBridgeRequestOptions,
) {
  const targetSemantics = resolveForecastTargetSemantics(input.targetBasis)
  const url = new URL(INTERNAL_FORECAST_CAPABILITY_ROUTE_PATH, LOCAL_SG_RUNTIME_BASE_URL)
  url.searchParams.set('seriesId', input.seriesId)
  url.searchParams.set('modelId', input.modelId)
  url.searchParams.set('targetSemantics', targetSemantics)

  return readInternalJson<InteractiveForecastCapabilityResult>(url.pathname + url.search, {
    method: 'GET',
    signal: options?.signal,
    headers: resolveAuthorizedHeaders(options?.headers),
  }, traceOptions)
}

export async function requestInteractiveForecastCurrentPreparation(
  input: BenchmarkForecastCurrentPreparationRequest,
  traceOptions?: TraceOptions,
  options?: ForecastBridgeRequestOptions,
) {
  return readInternalJson<InteractiveForecastPreparationResult>(INTERNAL_FORECAST_PREPARE_CURRENT_ROUTE_PATH, {
    method: 'POST',
    signal: options?.signal,
    headers: {
      ...resolveAuthorizedHeaders(options?.headers),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      seriesId: input.seriesId,
      modelId: input.modelId,
      targetSemantics: resolveForecastTargetSemantics(input.targetBasis),
    }),
  }, traceOptions)
}

export async function requestProgressiveForecastPreparationSnapshot(
  input: BenchmarkForecastCurrentPreparationRequest,
  traceOptions?: TraceOptions,
  options?: ForecastBridgeRequestOptions,
) {
  return readInternalJson<ProgressiveForecastPreparationSnapshot>(INTERNAL_FORECAST_PROGRESSIVE_ROUTE_PATH, {
    method: 'POST',
    signal: options?.signal,
    headers: {
      ...resolveAuthorizedHeaders(options?.headers),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      seriesId: input.seriesId,
      modelId: input.modelId,
      targetSemantics: resolveForecastTargetSemantics(input.targetBasis),
    }),
  }, traceOptions)
}

export async function requestInteractiveForecastVerificationPreparation(
  input: BenchmarkForecastCurrentPreparationRequest,
  cadence?: { sourceFrequency: string, targetCadence: string },
  traceOptions?: TraceOptions,
  options?: ForecastBridgeRequestOptions,
) : Promise<BenchmarkForecastVerificationResult> {
  const url = new URL(INTERNAL_FORECAST_VERIFICATION_ROUTE_PATH, LOCAL_SG_RUNTIME_BASE_URL)
  url.searchParams.set('seriesId', input.seriesId)
  url.searchParams.set('model', input.modelId)
  url.searchParams.set('targetBasis', input.targetBasis)

  if (cadence) {
    url.searchParams.set('sourceFrequency', cadence.sourceFrequency)
    url.searchParams.set('targetCadence', cadence.targetCadence)
  }

  return readInternalJson<BenchmarkForecastVerificationResult>(url.pathname + url.search, {
    method: 'GET',
    signal: options?.signal,
    headers: resolveAuthorizedHeaders(options?.headers),
  }, traceOptions)
}

function isInteractiveForecastTimeoutError(error: unknown) {
  return error instanceof Error && error.message === INTERNAL_FORECAST_TIMEOUT_ERROR
}

function resolveRequestedProgressiveVariant(
  snapshot: ProgressiveForecastPreparationSnapshot,
  input: BenchmarkForecastCurrentPreparationRequest,
) {
  return snapshot.variants.find((variant) => (
    variant.seriesId === input.seriesId
    && variant.modelId === input.modelId
    && variant.targetBasis === input.targetBasis
  )) ?? null
}

function resolvePreparationStateFromProgressiveVariant(
  variant: ProgressiveForecastVariantSnapshot,
): BenchmarkForecastPreparationState {
  if (variant.currentState === 'READY') return 'READY'
  if (variant.currentState === 'PREPARING' || variant.currentState === 'QUEUED') return 'NOT_PREPARED'
  if (variant.currentState === 'FAILED') return 'FAILED'
  return 'UNSUPPORTED'
}

function buildTracePayload(
  traceEnabled: boolean,
  attempts: ForecastBridgeAttemptTrace[],
  totalMs: number,
) {
  if (!traceEnabled) {
    return {}
  }

  return {
    trace: {
      dashboardBridgeTotalMs: totalMs,
      attempts,
      fallbackUsed: attempts.some((attempt) => attempt.fallbackUsed),
    },
  }
}

export function createInteractiveCurrentPreparationGateway(
  dependencies: Partial<GatewayDependencies> = {},
) {
  const resolvedDependencies: GatewayDependencies = {
    resolveCapability: dependencies.resolveCapability ?? readInteractiveForecastCapability,
    prepareCurrent: dependencies.prepareCurrent ?? requestInteractiveForecastCurrentPreparation,
    readProgressiveSnapshot: dependencies.readProgressiveSnapshot ?? requestProgressiveForecastPreparationSnapshot,
    now: dependencies.now ?? (() => Date.now()),
  }

  return async function prepareCurrent(
    input: BenchmarkForecastCurrentPreparationRequest,
    traceEnabled = false,
    requestOptions?: AbortSignal | ForecastBridgeRequestOptions,
  ): Promise<BenchmarkForecastCurrentPreparationResult & { trace?: ForecastBridgeTrace }> {
    const startedAt = resolvedDependencies.now()
    const targetSemantics = resolveForecastTargetSemantics(input.targetBasis)
    const attempts: ForecastBridgeAttemptTrace[] = []
    const traceOptions: TraceOptions | undefined = traceEnabled
      ? { enabled: true, attempts }
      : undefined
    const normalizedRequestOptions = normalizeForecastBridgeRequestOptions(requestOptions)
    const capability = await resolvedDependencies.resolveCapability(input, traceOptions, normalizedRequestOptions)

    const baseResult = {
      seriesId: input.seriesId,
      modelId: input.modelId,
      targetBasis: input.targetBasis,
      targetSemantics,
      capabilityStatus: capability.status,
      currentReadiness: capability.currentReadiness,
      timingMs: 0,
    }

    if (capability.currentReadiness === 'READY' || capability.status === 'READY') {
      const totalMs = Math.max(0, Math.round(resolvedDependencies.now() - startedAt))
      return {
        ...baseResult,
        state: 'READY',
        prepareAttempted: false,
        prepareStatus: null,
        reason: null,
        timingMs: totalMs,
        ...buildTracePayload(traceEnabled, attempts, totalMs),
      }
    }

    const prepareEligible = (capability.currentReadiness === 'NOT_PREPARED' || capability.currentReadiness === 'STALE')
      && (capability.status === 'PREPARATION_REQUIRED' || capability.status === 'NOT_PREPARED' || capability.status === 'STALE')

    if (!prepareEligible) {
      const totalMs = Math.max(0, Math.round(resolvedDependencies.now() - startedAt))
      return {
        ...baseResult,
        state: capability.status === 'FAILED' ? 'FAILED' : 'UNSUPPORTED',
        prepareAttempted: false,
        prepareStatus: null,
        reason: capability.reason ?? capability.status,
        timingMs: totalMs,
        ...buildTracePayload(traceEnabled, attempts, totalMs),
      }
    }

    let preparation: InteractiveForecastPreparationResult

    try {
      preparation = await resolvedDependencies.prepareCurrent(input, traceOptions, normalizedRequestOptions)
    } catch (error) {
      if (!isInteractiveForecastTimeoutError(error)) {
        throw error
      }

      try {
        const progressiveSnapshot = await resolvedDependencies.readProgressiveSnapshot(input, traceOptions, normalizedRequestOptions)
        const variant = resolveRequestedProgressiveVariant(progressiveSnapshot, input)
        if (!variant) {
          throw error
        }

        const totalMs = Math.max(0, Math.round(resolvedDependencies.now() - startedAt))
        const state = resolvePreparationStateFromProgressiveVariant(variant)
        return {
          ...baseResult,
          state,
          prepareAttempted: state === 'READY' || variant.currentState === 'PREPARING' || variant.currentState === 'QUEUED',
          prepareStatus: state === 'READY' ? 'READY' : null,
          reason: state === 'NOT_PREPARED'
            ? 'PREPARATION_IN_PROGRESS'
            : state === 'FAILED' || state === 'UNSUPPORTED'
              ? variant.currentReason ?? capability.reason ?? capability.status
              : null,
          timingMs: totalMs,
          ...buildTracePayload(traceEnabled, attempts, totalMs),
        }
      } catch {
        throw error
      }
    }

    const preparationState = preparation.status === 'READY' || preparation.status === 'REUSED'
      ? 'READY'
      : preparation.status === 'FAILED'
        ? 'FAILED'
        : 'UNSUPPORTED'

    const totalMs = Math.max(0, Math.round(resolvedDependencies.now() - startedAt))

    return {
      ...baseResult,
      state: preparationState,
      prepareAttempted: true,
      prepareStatus: preparation.status,
      reason: preparationState === 'READY' ? null : preparation.reason ?? preparation.status,
      timingMs: totalMs,
      ...buildTracePayload(traceEnabled, attempts, totalMs),
    }
  }
}

export const prepareInteractiveCurrentForecast = createInteractiveCurrentPreparationGateway()