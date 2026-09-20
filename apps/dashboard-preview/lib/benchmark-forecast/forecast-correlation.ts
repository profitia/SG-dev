export const FORECAST_CORRELATION_HEADER = 'x-sg-forecast-correlation-id'

const FORECAST_CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/

export function normalizeForecastCorrelationId(value: string | null | undefined) {
  const normalized = value?.trim() ?? ''
  return FORECAST_CORRELATION_ID_PATTERN.test(normalized) ? normalized : null
}

export function createForecastCorrelationId(value?: string | null) {
  return normalizeForecastCorrelationId(value) ?? globalThis.crypto.randomUUID()
}

export function buildForecastCorrelationHeaders(correlationId: string) {
  return {
    [FORECAST_CORRELATION_HEADER]: correlationId,
    'x-request-id': correlationId,
  }
}
