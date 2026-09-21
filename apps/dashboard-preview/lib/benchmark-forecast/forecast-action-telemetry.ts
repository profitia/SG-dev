const LOCAL_SG_RUNTIME_BASE_URL = 'http://localhost:3001'
const INTERNAL_ACTION_TRACE_PATH = '/api/internal/forecast/action-trace'
const FORECAST_CORRELATION_HEADER = 'x-sg-forecast-correlation-id'

export type ForecastUiVisibleTelemetry = {
  correlationId: string
  layer: 'CURRENT' | 'VERIFICATION'
  seriesId: string
  targetBasis: 'MONTHLY_AVERAGE' | 'POINT_IN_TIME' | 'END_OF_PERIOD'
  targetSemantics: string
  modelId: string
  pageInstanceId: string
  clientVisibleAt: string
  responseToVisibleMs: number | null
}

export type ForecastActionTelemetryLayer = ForecastUiVisibleTelemetry['layer']

export function buildForecastActionCorrelationKey(
  layer: ForecastActionTelemetryLayer,
  identity: Pick<ForecastUiVisibleTelemetry, 'seriesId' | 'modelId' | 'targetBasis'>,
) {
  return `${layer}|${identity.seriesId}|${identity.modelId}|${identity.targetBasis}`
}

export function resolveForecastPollingCorrelation(input: {
  activeCorrelationId: string | null
  activeCorrelationKey: string | null
  currentCorrelationId: string | null
  verificationCorrelationId: string | null
  currentCorrelationKey: string
  verificationCorrelationKey: string
  createCorrelationId: () => string
}) {
  const activeMatchesIdentity = input.activeCorrelationKey === input.currentCorrelationKey
    || input.activeCorrelationKey === input.verificationCorrelationKey
  if (activeMatchesIdentity && input.activeCorrelationId) {
    return { correlationId: input.activeCorrelationId, shouldStoreAsCurrent: false }
  }
  if (input.verificationCorrelationId) {
    return { correlationId: input.verificationCorrelationId, shouldStoreAsCurrent: false }
  }
  if (input.currentCorrelationId) {
    return { correlationId: input.currentCorrelationId, shouldStoreAsCurrent: false }
  }
  return { correlationId: input.createCorrelationId(), shouldStoreAsCurrent: true }
}

function runtimeBaseUrl() {
  return process.env.SG_RUNTIME_BASE_URL?.trim() || LOCAL_SG_RUNTIME_BASE_URL
}

export async function forwardForecastUiVisibleTelemetry(
  payload: ForecastUiVisibleTelemetry,
  fetchLike: typeof fetch = fetch,
) {
  const token = process.env.SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN?.trim()
  if (!token) throw new Error('SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN is not configured.')
  const response = await fetchLike(new URL(INTERNAL_ACTION_TRACE_PATH, runtimeBaseUrl()), {
    method: 'POST',
    cache: 'no-store',
    headers: {
      authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      [FORECAST_CORRELATION_HEADER]: payload.correlationId,
      'x-request-id': payload.correlationId,
    },
    body: JSON.stringify(payload),
  })
  const body = await response.json() as { data?: { recorded?: boolean }, error?: { message?: string } }
  if (!response.ok) throw new Error(body.error?.message ?? 'Forecast UI telemetry forwarding failed.')
  return body.data ?? body
}
