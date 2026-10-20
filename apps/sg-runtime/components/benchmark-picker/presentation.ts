import type { BenchmarkCandidate, BenchmarkMetadataValue } from '../../lib/benchmark/contracts'

/** PriceType is provider price metadata. DataType is sampling (open/close/average),
 * and Class is stock/flow: neither is an instrument classifier. Use only exact
 * existing provider-dictionary matches; titles/codes/frequencies never classify.
 */
export function benchmarkPriceType(candidate: BenchmarkCandidate, values: readonly BenchmarkMetadataValue[], locale: 'pl' | 'en') {
  const raw = candidate.metadata?.PriceType
  const codes = typeof raw === 'string' ? [raw] : raw ?? []
  const labels = codes.map(code => values.find(v => v.value === code)?.label.trim() || null)
  return labels.length && labels.every(label => label !== null) ? [...new Set(labels)].join(', ')
    : locale === 'pl' ? 'Nieokreślony' : 'Unspecified'
}

export function pickerNumber(value: number | null | undefined, locale: 'pl' | 'en', percent = false) {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(locale, { maximumFractionDigits: percent ? 2 : 4, ...(percent ? { signDisplay: 'exceptZero' as const } : {}) }).format(value) + (percent ? '%' : '')
}

export function pickerObservationDate(value: string | null | undefined, locale: 'pl' | 'en') {
  if (!value) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(locale, { timeZone: 'UTC' }).format(date) : null
}
