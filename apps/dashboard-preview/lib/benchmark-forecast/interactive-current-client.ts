import type {
  BenchmarkForecastCurrentPreparationRequest,
  BenchmarkForecastCurrentPreparationResult,
  BenchmarkForecastCurrentResult,
  ForecastCurrentUiState,
} from './forecast-contract'

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

type ExplicitPreparationDependencies = {
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