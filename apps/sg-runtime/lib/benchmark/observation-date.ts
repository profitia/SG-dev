const ISO_DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/
const ISO_LOCAL_DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/
const ISO_TIMEZONE_SUFFIX_RE = /(Z|[+-]\d{2}:\d{2})$/i

function toCanonicalDateInput(value: string) {
  if (ISO_DATE_ONLY_RE.test(value)) {
    return `${value}T00:00:00Z`
  }

  if (ISO_LOCAL_DATE_TIME_RE.test(value)) {
    return `${value}Z`
  }

  return value
}

export function normalizeBenchmarkObservationDate(value: string) {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return trimmed
  }

  const candidate = ISO_TIMEZONE_SUFFIX_RE.test(trimmed)
    ? trimmed
    : toCanonicalDateInput(trimmed)

  const parsed = new Date(candidate)
  return Number.isNaN(parsed.getTime()) ? trimmed : parsed.toISOString()
}

export function parseBenchmarkObservationDate(value: string) {
  return new Date(normalizeBenchmarkObservationDate(value))
}