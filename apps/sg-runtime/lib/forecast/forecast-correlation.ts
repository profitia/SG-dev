import { randomUUID } from 'node:crypto'

export const FORECAST_CORRELATION_HEADER = 'x-sg-forecast-correlation-id'

const FORECAST_CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/

export function normalizeForecastCorrelationId(value: string | null | undefined) {
  const normalized = value?.trim() ?? ''
  return FORECAST_CORRELATION_ID_PATTERN.test(normalized) ? normalized : null
}

export function resolveForecastCorrelationId(headers: Headers) {
  return normalizeForecastCorrelationId(headers.get(FORECAST_CORRELATION_HEADER))
    ?? normalizeForecastCorrelationId(headers.get('x-request-id'))
    ?? randomUUID()
}

export function resolveForecastJobCorrelationId(job: {
  latestCorrelationId?: string | null
  originCorrelationId?: string | null
  id: string
}) {
  return normalizeForecastCorrelationId(job.latestCorrelationId)
    ?? normalizeForecastCorrelationId(job.originCorrelationId)
    ?? `forecast-job:${job.id}`
}
