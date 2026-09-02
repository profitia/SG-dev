import type {
  BenchmarkForecastCurrentPreparationRequest,
  BenchmarkForecastCurrentPreparationResult,
  BenchmarkForecastCurrentResult,
  ForecastCurrentUiState,
  InteractiveForecastCapabilityResult,
} from './forecast-contract'

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

type ExplicitPreparationDependencies = {
  prepareCurrent: (input: BenchmarkForecastCurrentPreparationRequest) => Promise<BenchmarkForecastCurrentPreparationResult>
  readPrepared: (input: BenchmarkForecastCurrentPreparationRequest) => Promise<BenchmarkForecastCurrentResult>
}

type WarmCurrentForecastDependencies = {
  readCapability: (input: BenchmarkForecastCurrentPreparationRequest) => Promise<InteractiveForecastCapabilityResult>
  prepareCurrent: (input: BenchmarkForecastCurrentPreparationRequest) => Promise<BenchmarkForecastCurrentPreparationResult>
  readPrepared: (input: BenchmarkForecastCurrentPreparationRequest) => Promise<BenchmarkForecastCurrentResult>
}

export function shouldReadCurrentForecast(options: {
  showForecast: boolean
  isForecastPortfolioVariant: boolean
  seriesId: string | null
}) {
  return options.showForecast && options.isForecastPortfolioVariant && Boolean(options.seriesId)
}

export function resolveForecastCurrentUiState(result: BenchmarkForecastCurrentResult): ForecastCurrentUiState {
  if (result.status === 'AVAILABLE') {
    return 'AVAILABLE'
  }

  const reason = result.reason.toUpperCase()
  if (reason.includes('UNSUPPORTED')) {
    return 'UNSUPPORTED'
  }

  return 'NOT_PREPARED'
}

export function shouldShowExplicitCurrentPreparation(
  state: ForecastCurrentUiState,
  result: BenchmarkForecastCurrentResult | null,
) {
  return state === 'NOT_PREPARED' && result?.status === 'NOT_AVAILABLE'
}

export function shouldPrepareCurrentForecastFromCapability(capability: InteractiveForecastCapabilityResult) {
  return capability.currentReadiness === 'NOT_PREPARED'
    && (capability.status === 'PREPARATION_REQUIRED' || capability.status === 'NOT_PREPARED')
}

export async function readCurrentForecastCapabilityThroughDashboard(
  fetchLike: FetchLike,
  input: BenchmarkForecastCurrentPreparationRequest,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    seriesId: input.seriesId,
    modelId: input.modelId,
    targetBasis: input.targetBasis,
  })
  const response = await fetchLike(`/api/benchmark-forecast/current/capability?${params.toString()}`, {
    cache: 'no-store',
    signal,
  })
  const payload = await response.json() as InteractiveForecastCapabilityResult | { error?: string }

  if (!response.ok) {
    throw new Error('error' in payload ? payload.error ?? 'Forecast capability unavailable' : 'Forecast capability unavailable')
  }

  return payload as InteractiveForecastCapabilityResult
}

export async function readPreparedCurrentForecastThroughDashboard(
  fetchLike: FetchLike,
  input: BenchmarkForecastCurrentPreparationRequest,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    seriesId: input.seriesId,
    model: input.modelId,
    targetBasis: input.targetBasis,
  })
  const response = await fetchLike(`/api/benchmark-forecast/current?${params.toString()}`, {
    cache: 'no-store',
    signal,
  })
  const payload = await response.json() as BenchmarkForecastCurrentResult | { error?: string }

  if (!response.ok) {
    throw new Error('error' in payload ? payload.error ?? 'Forecast unavailable' : 'Forecast unavailable')
  }

  return payload as BenchmarkForecastCurrentResult
}

export async function requestExplicitCurrentForecastPreparationThroughDashboard(
  fetchLike: FetchLike,
  input: BenchmarkForecastCurrentPreparationRequest,
  signal?: AbortSignal,
) {
  const response = await fetchLike('/api/benchmark-forecast/current/prepare', {
    method: 'POST',
    cache: 'no-store',
    signal,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })
  const payload = await response.json() as BenchmarkForecastCurrentPreparationResult | { error?: string }

  if (!response.ok) {
    throw new Error('error' in payload ? payload.error ?? 'Forecast preparation failed.' : 'Forecast preparation failed.')
  }

  return payload as BenchmarkForecastCurrentPreparationResult
}

export async function warmCurrentForecastThroughDashboard(
  fetchLike: FetchLike,
  input: BenchmarkForecastCurrentPreparationRequest,
  signal?: AbortSignal,
  dependencies?: Partial<WarmCurrentForecastDependencies>,
) {
  const resolvedDependencies: WarmCurrentForecastDependencies = {
    readCapability: dependencies?.readCapability ?? ((request) => readCurrentForecastCapabilityThroughDashboard(fetchLike, request, signal)),
    prepareCurrent: dependencies?.prepareCurrent ?? ((request) => requestExplicitCurrentForecastPreparationThroughDashboard(fetchLike, request, signal)),
    readPrepared: dependencies?.readPrepared ?? ((request) => readPreparedCurrentForecastThroughDashboard(fetchLike, request, signal)),
  }

  const capability = await resolvedDependencies.readCapability(input)

  if (capability.currentReadiness === 'READY' || capability.status === 'READY') {
    const currentResult = await resolvedDependencies.readPrepared(input)
    return {
      capability,
      preparation: null,
      currentResult,
      currentState: resolveForecastCurrentUiState(currentResult),
      prepareAttempted: false,
    } as const
  }

  if (!shouldPrepareCurrentForecastFromCapability(capability)) {
    return {
      capability,
      preparation: null,
      currentResult: null,
      currentState: capability.status === 'FAILED' ? 'FAILED' : 'UNSUPPORTED',
      prepareAttempted: false,
    } as const
  }

  const preparation = await resolvedDependencies.prepareCurrent(input)
  if (preparation.state !== 'READY') {
    return {
      capability,
      preparation,
      currentResult: null,
      currentState: preparation.state === 'FAILED' ? 'FAILED' : 'UNSUPPORTED',
      prepareAttempted: preparation.prepareAttempted,
    } as const
  }

  const currentResult = await resolvedDependencies.readPrepared(input)
  const currentState = resolveForecastCurrentUiState(currentResult)

  return {
    capability,
    preparation,
    currentResult,
    currentState: currentState === 'AVAILABLE' ? currentState : 'FAILED',
    prepareAttempted: preparation.prepareAttempted,
  } as const
}

export async function explicitlyPrepareForecastCurrent(
  input: BenchmarkForecastCurrentPreparationRequest,
  dependencies: ExplicitPreparationDependencies,
) {
  const preparation = await dependencies.prepareCurrent(input)

  if (preparation.state !== 'READY') {
    return {
      preparation,
      currentResult: null,
      currentState: preparation.state === 'UNSUPPORTED' ? 'UNSUPPORTED' : 'FAILED',
      rereadAttempted: false,
      errorMessage: preparation.reason,
    } as const
  }

  const currentResult = await dependencies.readPrepared(input)
  const currentState = resolveForecastCurrentUiState(currentResult)
  if (currentState !== 'AVAILABLE') {
    return {
      preparation,
      currentResult,
      currentState: 'FAILED',
      rereadAttempted: true,
      errorMessage: 'Prepared Current Forecast read did not become AVAILABLE after preparation.',
    } as const
  }

  return {
    preparation,
    currentResult,
    currentState,
    rereadAttempted: true,
    errorMessage: null,
  } as const
}