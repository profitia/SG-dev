import {
  FORECAST_PORTFOLIO_MODELS,
  FORECAST_TARGET_BASES,
  resolveForecastTargetSemantics,
  type BenchmarkForecastCurrentPreparationRequest,
  type BenchmarkForecastCurrentPreparationResult,
  type ForecastPortfolioModelId,
  type ProgressiveForecastPreparationSnapshot,
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
const INTERNAL_FORECAST_PROGRESSIVE_ROUTE_PATH = '/api/internal/forecast/progressive'
const INTERNAL_FORECAST_TIMEOUT_MS = 45_000
export const FORECAST_TRACE_HEADER = 'x-sg-forecast-trace'

export type ForecastBridgeAttemptTrace = {
  targetRole: 'PRIMARY' | 'FALLBACK'
  startedAt: string
  completedAt: string
  durationMs: number
  httpStatus: number | null
  timeout: boolean
  fallbackUsed: boolean
  sgRuntimeCapabilityExecutionMs: number | null
}

export type ForecastBridgeTrace = {
  dashboardBridgeTotalMs: number
  attempts: ForecastBridgeAttemptTrace[]
  fallbackUsed: boolean
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
  ) => Promise<InteractiveForecastCapabilityResult>
  prepareCurrent: (
    input: BenchmarkForecastCurrentPreparationRequest,
    traceOptions?: TraceOptions,
  ) => Promise<InteractiveForecastPreparationResult>
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

function readSgRuntimeInternalForecastServiceToken() {
  return process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN?.trim() ?? ''
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
    const timeoutId = setTimeout(() => controller.abort(), INTERNAL_FORECAST_TIMEOUT_MS)
    const startedAt = new Date().toISOString()
    const startedAtMs = Date.now()

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

      const payload = await response.json() as Record<string, unknown>
      if (traceOptions?.enabled) {
        traceOptions.attempts.push({
          targetRole: index === 0 ? 'PRIMARY' : 'FALLBACK',
          startedAt,
          completedAt: new Date().toISOString(),
          durationMs: Math.max(0, Date.now() - startedAtMs),
          httpStatus: response.status,
          timeout: false,
          fallbackUsed: index > 0,
          sgRuntimeCapabilityExecutionMs: (() => {
            const header = response.headers.get('x-sg-runtime-capability-total-ms')
            if (!header) return null
            const parsed = Number.parseInt(header, 10)
            return Number.isFinite(parsed) ? parsed : null
          })(),
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
          httpStatus: null,
          timeout: (error as Error).name === 'AbortError',
          fallbackUsed: index > 0,
          sgRuntimeCapabilityExecutionMs: null,
        })
      }

      if (error instanceof SgRuntimeForecastPreparationAuthError) {
        throw error
      }

      lastError = error
      if ((error as Error).name !== 'AbortError') {
        throw error
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  if ((lastError as Error | null)?.name === 'AbortError') {
    throw new Error('SG Runtime interactive forecast request timed out.')
  }

  throw lastError instanceof Error ? lastError : new Error('SG Runtime interactive forecast request failed.')
}

function resolveAuthorizedHeaders() {
  const token = readSgRuntimeInternalForecastServiceToken()
  if (!token) {
    throw new Error('SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN is not configured.')
  }

  return {
    Authorization: `Bearer ${token}`,
  }
}

export async function readInteractiveForecastCapability(
  input: BenchmarkForecastCurrentPreparationRequest,
  traceOptions?: TraceOptions,
) {
  const targetSemantics = resolveForecastTargetSemantics(input.targetBasis)
  const url = new URL(INTERNAL_FORECAST_CAPABILITY_ROUTE_PATH, LOCAL_SG_RUNTIME_BASE_URL)
  url.searchParams.set('seriesId', input.seriesId)
  url.searchParams.set('modelId', input.modelId)
  url.searchParams.set('targetSemantics', targetSemantics)

  return readInternalJson<InteractiveForecastCapabilityResult>(url.pathname + url.search, {
    method: 'GET',
    headers: resolveAuthorizedHeaders(),
  }, traceOptions)
}

export async function requestInteractiveForecastCurrentPreparation(
  input: BenchmarkForecastCurrentPreparationRequest,
  traceOptions?: TraceOptions,
) {
  return readInternalJson<InteractiveForecastPreparationResult>(INTERNAL_FORECAST_PREPARE_CURRENT_ROUTE_PATH, {
    method: 'POST',
    headers: {
      ...resolveAuthorizedHeaders(),
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
) {
  return readInternalJson<ProgressiveForecastPreparationSnapshot>(INTERNAL_FORECAST_PROGRESSIVE_ROUTE_PATH, {
    method: 'POST',
    headers: {
      ...resolveAuthorizedHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      seriesId: input.seriesId,
      modelId: input.modelId,
      targetSemantics: resolveForecastTargetSemantics(input.targetBasis),
    }),
  }, traceOptions)
}

export function createInteractiveCurrentPreparationGateway(
  dependencies: Partial<GatewayDependencies> = {},
) {
  const resolvedDependencies: GatewayDependencies = {
    resolveCapability: dependencies.resolveCapability ?? readInteractiveForecastCapability,
    prepareCurrent: dependencies.prepareCurrent ?? requestInteractiveForecastCurrentPreparation,
    now: dependencies.now ?? (() => Date.now()),
  }

  return async function prepareCurrent(
    input: BenchmarkForecastCurrentPreparationRequest,
    traceEnabled = false,
  ): Promise<BenchmarkForecastCurrentPreparationResult & { trace?: ForecastBridgeTrace }> {
    const startedAt = resolvedDependencies.now()
    const targetSemantics = resolveForecastTargetSemantics(input.targetBasis)
    const attempts: ForecastBridgeAttemptTrace[] = []
    const traceOptions: TraceOptions | undefined = traceEnabled
      ? { enabled: true, attempts }
      : undefined
    const capability = await resolvedDependencies.resolveCapability(input, traceOptions)

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
      return {
        ...baseResult,
        state: 'READY',
        prepareAttempted: false,
        prepareStatus: null,
        reason: null,
        timingMs: Math.max(0, Math.round(resolvedDependencies.now() - startedAt)),
        ...(traceEnabled ? {
          trace: {
            dashboardBridgeTotalMs: Math.max(0, Math.round(resolvedDependencies.now() - startedAt)),
            attempts,
            fallbackUsed: attempts.some((attempt) => attempt.fallbackUsed),
          },
        } : {}),
      }
    }

    const prepareEligible = capability.currentReadiness === 'NOT_PREPARED'
      && (capability.status === 'PREPARATION_REQUIRED' || capability.status === 'NOT_PREPARED')

    if (!prepareEligible) {
      return {
        ...baseResult,
        state: capability.status === 'FAILED' ? 'FAILED' : 'UNSUPPORTED',
        prepareAttempted: false,
        prepareStatus: null,
        reason: capability.reason ?? capability.status,
        timingMs: Math.max(0, Math.round(resolvedDependencies.now() - startedAt)),
        ...(traceEnabled ? {
          trace: {
            dashboardBridgeTotalMs: Math.max(0, Math.round(resolvedDependencies.now() - startedAt)),
            attempts,
            fallbackUsed: attempts.some((attempt) => attempt.fallbackUsed),
          },
        } : {}),
      }
    }

    const preparation = await resolvedDependencies.prepareCurrent(input, traceOptions)
    const preparationState = preparation.status === 'READY' || preparation.status === 'REUSED'
      ? 'READY'
      : preparation.status === 'FAILED'
        ? 'FAILED'
        : 'UNSUPPORTED'

    return {
      ...baseResult,
      state: preparationState,
      prepareAttempted: true,
      prepareStatus: preparation.status,
      reason: preparationState === 'READY' ? null : preparation.reason ?? preparation.status,
      timingMs: Math.max(0, Math.round(resolvedDependencies.now() - startedAt)),
      ...(traceEnabled ? {
        trace: {
          dashboardBridgeTotalMs: Math.max(0, Math.round(resolvedDependencies.now() - startedAt)),
          attempts,
          fallbackUsed: attempts.some((attempt) => attempt.fallbackUsed),
        },
      } : {}),
    }
  }
}

export const prepareInteractiveCurrentForecast = createInteractiveCurrentPreparationGateway()