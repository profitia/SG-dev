import {
  FORECAST_PORTFOLIO_MODELS,
  FORECAST_TARGET_BASES,
  resolveForecastTargetSemantics,
  type BenchmarkForecastCurrentPreparationRequest,
  type BenchmarkForecastCurrentPreparationResult,
  type ForecastPortfolioModelId,
  type ForecastTargetBasis,
  type InteractiveForecastCapabilityResult,
  type InteractiveForecastPreparationResult,
} from './forecast-contract'

const LOCAL_SG_RUNTIME_BASE_URL = 'http://localhost:3001'
const INTERNAL_FORECAST_CAPABILITY_ROUTE_PATH = '/api/internal/forecast/capability'
const INTERNAL_FORECAST_PREPARE_CURRENT_ROUTE_PATH = '/api/internal/forecast/prepare/current'
const INTERNAL_FORECAST_TIMEOUT_MS = 20_000

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
  resolveCapability: (input: BenchmarkForecastCurrentPreparationRequest) => Promise<InteractiveForecastCapabilityResult>
  prepareCurrent: (input: BenchmarkForecastCurrentPreparationRequest) => Promise<InteractiveForecastPreparationResult>
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

function readSgRuntimeInternalForecastServiceToken() {
  return process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN?.trim() ?? ''
}

async function readInternalJson<T>(
  pathname: string,
  init: RequestInit,
) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), INTERNAL_FORECAST_TIMEOUT_MS)

  try {
    const response = await fetch(new URL(pathname, resolveSgRuntimeBaseUrl()), {
      ...init,
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init.headers ?? {}),
      },
    })

    const payload = await response.json() as Record<string, unknown>
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
    if ((error as Error).name === 'AbortError') {
      throw new Error('SG Runtime interactive forecast request timed out.')
    }

    throw error
  } finally {
    clearTimeout(timeoutId)
  }
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
) {
  const targetSemantics = resolveForecastTargetSemantics(input.targetBasis)
  const url = new URL(INTERNAL_FORECAST_CAPABILITY_ROUTE_PATH, resolveSgRuntimeBaseUrl())
  url.searchParams.set('seriesId', input.seriesId)
  url.searchParams.set('modelId', input.modelId)
  url.searchParams.set('targetSemantics', targetSemantics)

  return readInternalJson<InteractiveForecastCapabilityResult>(url.pathname + url.search, {
    method: 'GET',
    headers: resolveAuthorizedHeaders(),
  })
}

export async function requestInteractiveForecastCurrentPreparation(
  input: BenchmarkForecastCurrentPreparationRequest,
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
  })
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
  ): Promise<BenchmarkForecastCurrentPreparationResult> {
    const startedAt = resolvedDependencies.now()
    const targetSemantics = resolveForecastTargetSemantics(input.targetBasis)
    const capability = await resolvedDependencies.resolveCapability(input)

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
      }
    }

    const preparation = await resolvedDependencies.prepareCurrent(input)
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
    }
  }
}

export const prepareInteractiveCurrentForecast = createInteractiveCurrentPreparationGateway()