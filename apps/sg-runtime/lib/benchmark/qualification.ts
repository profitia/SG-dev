import type { BenchmarkCandidate, SavedBenchmark } from './contracts'

/** No I/O, authorization, history or calculation. Recomputed from the current metadata snapshot. */
export const BQL_RULESET_VERSION = 'bql-semantic/1.0.1' as const
export type BenchmarkMeaning = 'PRICE_LEVEL' | 'PRICE_INDEX' | 'QUANTITY' | 'RATE' | 'OTHER' | 'UNDETERMINED'
export type SemanticReason = 'UNIT_PRICE' | 'PRICE_INDEX' | 'PHYSICAL_QUANTITY' | 'RELATIVE_RATE' | 'EXCHANGE_RATE' | 'NON_PRICE_INDEX' | 'MONETARY_AGGREGATE' | 'CONFLICTING_METADATA' | 'INSUFFICIENT_METADATA'
export interface BenchmarkSemanticProfile {
  rulesetVersion: typeof BQL_RULESET_VERSION
  providerCode: string
  seriesId: string
  classification: BenchmarkMeaning
  reason: SemanticReason
  /** Ordered input snapshot: retains the evidence, not an AI score or a claim about history readiness. */
  evidence: readonly { field: string; values: readonly string[] }[]
}
export interface PciSemanticEligibility {
  model: 'PCI'
  status: 'SUITABLE' | 'UNSUITABLE' | 'VERIFY' | 'NOT_EVALUATED'
  reason: 'MATCHING_VARIANT' | 'NON_PRICE' | 'VARIANT_MISMATCH' | 'UNDETERMINED' | 'UNSUPPORTED_RULESET'
  suggestedValueKind?: 'PRICE_LEVEL' | 'PRICE_INDEX'
}
type Input = Pick<BenchmarkCandidate, 'displayName' | 'providerSeries' | 'currency' | 'unit'> &
  Partial<Pick<BenchmarkCandidate, 'description' | 'titleUnit' | 'frequency' | 'source' | 'semanticContext'>> & { metadata?: unknown }
const textValues = (value: unknown): string[] => typeof value === 'string' && value.trim() ? [value.trim()]
  : Array.isArray(value) ? value.flatMap(v => typeof v === 'string' && v.trim() ? [v.trim()] : []) : []
const normalized = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const metadataFields = ['Currency', 'Unit', 'TitleUnit', 'Title', 'Description', 'FullDescription', 'PriceType', 'DataType', 'Class', 'RateType']

export function classifyBenchmark(input: Input): BenchmarkSemanticProfile {
  const evidence: {field: string; values: string[]}[] = []
  const add = (field: string, value: unknown) => { const values = textValues(value); if (values.length) evidence.push({field, values}) }
  add('displayName', input.displayName); add('description', input.description)
  add('currency', input.currency); add('unit', input.unit); add('titleUnit', input.titleUnit)
  add('frequency', input.frequency); add('source', input.source)
  const raw = input.metadata && typeof input.metadata === 'object' ? input.metadata as Record<string, unknown> : {}
  for (const field of metadataFields) add('metadata.' + field, raw[field])
  const context = input.semanticContext
  if (context) {
    for (const field of ['primaryTitle', 'description', 'fullDescription', 'hierarchy', 'path'] as const) add('semanticContext.' + field, context[field])
    for (const field of metadataFields) add('semanticContext.technicalMetadata.' + field, context.technicalMetadata?.[field])
  }
  const join = (predicate: (field: string) => boolean) => normalized(evidence.filter(e => predicate(e.field)).flatMap(e => e.values).join(' | '))
  // Provider DataType means sampling (open/close/average), Class means stock/flow.
  // Neither they, opaque numeric PriceType codes, AI labels nor ranking are economic classification rules.
  const names = join(f => /displayName|description|primaryTitle|fullDescription|\.(Title|Description|FullDescription)$/.test(f))
  const units = join(f => /(?:^|\.)(unit|titleUnit)$/i.test(f))
  const currencies = join(f => /(?:^|\.)currency$/i.test(f))
  const currency = /\b(?:usd|eur|pln|gbp|chf|jpy|cny|rmb|cad|aud|nzd|nok|sek|dkk|inr|brl|zar|krw|mxn|rub)\b|\$|€|£/.test(currencies + ' | ' + units)
  const physicalUnit = /\b(?:tonnes?|tons?|tona|tony|ton|t|mt|kg|kilograms?|kilogramy?|barrels?|bbl|bushels?|mwh|kwh|litres?|liters?|cubic meters?|m3|pounds?|lbs?|ounces?|oz|shares?|sztuki?|mb)\b/.test(units)
  const percentUnit = /%|\b(?:percent(?:age)?|procent|basis points?|bps)\b/.test(units)
  const indexUnit = /\b(?:index|indeks|points?|punkty|pts)\b|\b\d{4}(?:\s*[:/-]\s*\d{1,2})?\s*=\s*100\b/.test(units)
  const priceContext = /\b(?:prices?|cena|ceny|cen|spot|futures?|forward|quotation|quotes?|notowania)\b/.test(names)
  const priceIndexContext = /\b(?:price[\s,]+(?:indices|index|indexes)|producer prices|consumer prices|indeks cen|indeks cenowy|ppi|cpi)\b/.test(names)
  const quantityContext = /\b(?:inventor(?:y|ies)|production|output|consumption|tonnage|volumes?|zapasy|zapasow|produkcja|produkcji|zuzycie)\b|\bstocks?\b(?!\s+prices?)/.test(names)
  const relativeContext = /\b(?:rates?|yields?|interest|shares?|returns?|growth|changes?|stopa|stopy|udzial|zmiana|zmiany|rentownosc|inflation|inflacja)\b/.test(names)
  const fxContext = /\b(?:exchange rates?|currency pair|foreign exchange|kurs walut|kurs wymiany)\b/.test(names)
  const currencyPair = /\b(?:usd|eur|pln|gbp|chf|jpy|cny)\s*[/]\s*(?:usd|eur|pln|gbp|chf|jpy|cny)\b/.test(units)
  const physicalDimensions=[/\b(?:tonnes?|tons?|tona|tony|ton|t|mt|kg|kilograms?|pounds?|lbs?|ounces?|oz)\b/,/\b(?:barrels?|bbl|litres?|liters?|cubic meters?|m3)\b/,/\b(?:mwh|kwh)\b/,/\bshares?\b/].filter(pattern=>pattern.test(units)).length
  const result = (classification: BenchmarkMeaning, reason: SemanticReason): BenchmarkSemanticProfile => ({
    rulesetVersion: BQL_RULESET_VERSION, providerCode: input.providerSeries.provider.providerCode,
    seriesId: input.providerSeries.providerSeriesId, classification, reason, evidence,
  })
  // An explicit price index may retain its market currency (e.g. "CNY Index").
  // It is still an index, never a nominal currency-per-product observation.
  const dimensionConflict = (percentUnit && (indexUnit || physicalUnit || currency)) || (indexUnit && (physicalUnit || (currency && !priceIndexContext)))
  const declaredCurrencies = [...new Set((currencies.match(/\b(?:usd|eur|pln|gbp|chf|jpy|cny|rmb|cad|aud|nzd|nok|sek|dkk|inr|brl|zar|krw|mxn|rub)\b/g) ?? []))]
  const unitCurrencies = [...new Set((units.match(/\b(?:usd|eur|pln|gbp|chf|jpy|cny|rmb|cad|aud|nzd|nok|sek|dkk|inr|brl|zar|krw|mxn|rub)\b/g) ?? []))]
  if (dimensionConflict || physicalDimensions>1 || (!currencyPair && declaredCurrencies.length && unitCurrencies.some(c => !declaredCurrencies.includes(c)))) return result('UNDETERMINED', 'CONFLICTING_METADATA')
  if (fxContext && currencyPair) return result('OTHER', 'EXCHANGE_RATE')
  if (percentUnit && relativeContext) return result('RATE', 'RELATIVE_RATE')
  if (quantityContext && priceContext) return result('UNDETERMINED', 'CONFLICTING_METADATA')
  if (priceIndexContext && indexUnit) return result('PRICE_INDEX', 'PRICE_INDEX')
  if (quantityContext && physicalUnit && !currency && !priceContext) return result('QUANTITY', 'PHYSICAL_QUANTITY')
  if (priceContext && currency && physicalUnit && !indexUnit && !percentUnit) return result('PRICE_LEVEL', 'UNIT_PRICE')
  if (indexUnit && /\b(?:equity|share|stock market|industrial production|business confidence|purchasing managers|gieldowy|koniunktury)\b/.test(names) && !priceContext) return result('OTHER', 'NON_PRICE_INDEX')
  if (currency && !physicalUnit && /\b(?:gdp|gross domestic product|revenue|turnover|pkb|przychody)\b/.test(names) && !priceContext) return result('OTHER', 'MONETARY_AGGREGATE')
  return result('UNDETERMINED', 'INSUFFICIENT_METADATA')
}

export function assessPciEligibility(profile: BenchmarkSemanticProfile, valueKind?: '' | 'PRICE_LEVEL' | 'PRICE_INDEX'): PciSemanticEligibility {
  if (profile.rulesetVersion !== BQL_RULESET_VERSION) return {model:'PCI', status:'NOT_EVALUATED', reason:'UNSUPPORTED_RULESET'}
  if (profile.classification === 'UNDETERMINED') return {model:'PCI', status:'VERIFY', reason:'UNDETERMINED'}
  if (profile.classification !== 'PRICE_LEVEL' && profile.classification !== 'PRICE_INDEX') return {model:'PCI', status:'UNSUITABLE', reason:'NON_PRICE'}
  return {model:'PCI', status:valueKind && valueKind !== profile.classification ? 'UNSUITABLE' : 'SUITABLE',
    reason:valueKind && valueKind !== profile.classification ? 'VARIANT_MISMATCH' : 'MATCHING_VARIANT', suggestedValueKind:profile.classification}
}

/** Saved profiles originate in the existing authorized selection projection, never a new lookup. */
export function savedBenchmarkProfile(benchmark: SavedBenchmark): BenchmarkSemanticProfile {
  const profile = benchmark.semanticProfile
  if (profile?.rulesetVersion === BQL_RULESET_VERSION && profile.providerCode === benchmark.provider.providerCode && profile.seriesId === benchmark.providerSeries.providerSeriesId) return profile
  return classifyBenchmark(benchmark)
}
