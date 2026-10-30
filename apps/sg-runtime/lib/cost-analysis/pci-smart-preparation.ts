import { createHash } from 'node:crypto'
import type { BenchmarkAnalyticsSeriesResult, SavedBenchmark } from '../benchmark/contracts'
import { parseBenchmarkObservationDate } from '../benchmark/observation-date'
import { savedBenchmarkProfile, assessPciEligibility } from '../benchmark/qualification'
import { categoryDraftStatus } from '../category/draft'
import { createCalendarTargetPeriod, FORECAST_NATIVE_FREQUENCIES, normalizeForecastSourceFrequency,
  reduceForecastPeriodAverage, reduceForecastPeriodEndOfPeriod, type ForecastTargetPeriod } from '../forecast/cadence'
import type { CciAlignedNode, CciCadence, CciNodeBasis, CciPeriodIdentity } from './market-data-contracts'
import type { CciNodeInput } from './cci-node-contracts'
import { PCI_PREPARATION_METHOD, PCI_PROXY_LOOKBACK, type SmartCandidate, type SmartComponentView,
  type SmartIssue, type SmartMethodDeclaration, type SmartPciRequest, type SmartPreparation,
  type SmartPrepared, type SmartPreparedComponent, type SmartPreparedContext } from './pci-smart-preparation-contracts'

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const day = (value: Date) => value.toISOString().slice(0, 10)
const isoDay = (value: string) => value.slice(0, 10) + 'T00:00:00.000Z'
const periodIdentity = (p: ForecastTargetPeriod): CciPeriodIdentity => ({ cadence: p.cadence, start: p.start.toISOString(), endExclusive: p.endExclusive.toISOString() })
const LIMITATIONS = ['NATIVE_CURRENCY_RELATIVES_NO_FX', 'RETROSPECTIVE_CURRENT_HISTORY_NOT_HISTORICAL_AS_OF',
  'EXPECTED_PUBLICATION_CALENDAR_UNKNOWN', 'SOURCE_FINGERPRINT_NOT_IMMUTABLE_PROVIDER_VINTAGE',
  'EXPLICIT_ANALYSIS_WINDOW_NO_SOURCE_HISTORY_REPAIR'] as const

const messages = {
  CATEGORY_NOT_READY: ['Uzupełnij nazwy komponentów i udziały do 100%.', 'Complete component names and weights totaling 100%.'],
  INVALID_COMPOSITION: ['Deklaracje muszą jednoznacznie odpowiadać komponentom.', 'Declarations must uniquely match the components.'],
  BENCHMARK_UNAVAILABLE: ['Benchmark nie jest dostępny w bieżącej organizacji.', 'The benchmark is unavailable in the current organisation.'],
  SEMANTIC_MISMATCH: ['To nie jest cena ani indeks cenowy. Zmień benchmark.', 'This is not a price or price index. Change the benchmark.'],
  VALUE_KIND_MISMATCH: ['Deklaracja rodzaju danych jest sprzeczna z metadanymi benchmarku.', 'The declared value type conflicts with the benchmark metadata.'],
  METHODOLOGY_REQUIRED: ['Sprawdź opis tego benchmarku i potwierdź znaczenie jego wartości w „Jak przygotowaliśmy dane?”.', 'Check this benchmark’s description and confirm its observation meaning in “How we prepared the data”.'],
  UNKNOWN_FREQUENCY: ['Źródło nie podaje obsługiwanej częstotliwości. Wybierz inny benchmark lub zweryfikuj źródło.', 'The source has no supported frequency. Change the benchmark or verify the source.'],
  NO_OBSERVATIONS: ['Brak notowań. Zmień benchmark lub sprawdź późniejszą publikację.', 'No observations. Change the benchmark or check for a later publication.'],
  INVALID_DATE: ['Historia zawiera nieprawidłową datę, której nie można bezpiecznie przypisać do okresu.', 'History contains an invalid date that cannot safely be assigned to a period.'],
  DUPLICATE_NATIVE_PERIOD: ['Kilka obserwacji przypada na ten sam okres źródłowy. Nie wybieramy arbitralnie jednej z nich.', 'Multiple observations belong to one native period. We do not arbitrarily choose one.'],
  INVALID_PRICE_LEVEL: ['Okres zawiera niedodatnią lub nieprawidłową wartość. Nie zastępujemy jej inną.', 'The period contains a nonpositive or invalid value. We do not replace it.'],
  MISSING_OBSERVATION: ['Brak wymaganej wartości w tym okresie.', 'A required value is missing in this period.'],
  UNAPPROVED_AGGREGATION: ['Brak zatwierdzonej, ekonomicznie zgodnej metody dla tej częstotliwości. Nie uśredniamy automatycznie średnich.', 'No approved economically compatible method for this frequency. We do not automatically average averages.'],
  NO_QUALIFIED_REFERENCE: ['Brak wiarygodnego wspólnego okresu. Sprawdź wskazane komponenty, dostępne okresy lub wybierz inny benchmark. Nie zmieniaj faktycznej daty zakupu.', 'No reliable common period. Review the indicated components, available periods or change a benchmark. Keep the actual purchase date unchanged.'],
  OPEN_PURCHASE_PERIOD: ['Okres obejmujący zakup jest nadal otwarty. Możesz sprawdzić jawne wcześniejsze odniesienie rynkowe, jeśli jest dostępne.', 'The purchase period is still open. An explicit earlier market reference may be available.'],
  DATA_VOLUME_LIMIT: ['Ten jawny zakres przekracza limit analizy. Dane nie zostały przycięte ani zmienione.', 'This explicit window exceeds the analysis limit. No data were truncated or changed.'],
  ECONOMIC_REPRESENTATIVENESS_VERIFY: ['Nazwa komponentu i zjawisko mierzone przez benchmark mogą się nie zgadzać. Zweryfikuj zależność ekonomiczną; poprawna seria cenowa nie gwarantuje reprezentatywności.', 'The component name and the benchmark’s economic subject may differ. Verify the economic relationship; being a price series does not prove representativeness.'],
} as const
export function smartIssue(code: string, locale: 'pl' | 'en', details: Omit<SmartIssue, 'code' | 'message'> = {}): SmartIssue {
  const entry = messages[code as keyof typeof messages]
  return { code, message: entry?.[locale === 'pl' ? 0 : 1] ?? (locale === 'pl' ? 'Nie można użyć tych parametrów. Sprawdź opis metody i dane.' : 'These parameters cannot be used. Check the methodology and data.'), ...details }
}

/** Classification uses the existing authorised metadata only. In particular it does not read history. */
export function smartSelectionIssues(input: SmartPciRequest, selected: readonly SavedBenchmark[]): SmartIssue[] {
  const issue = (code: string, id?: string) => smartIssue(code, input.locale, id ? { componentId: id } : {})
  if (categoryDraftStatus(input.category.components) !== 'READY') return [issue('CATEGORY_NOT_READY')]
  const ids = input.declarations.map(d => d.componentId)
  if (ids.length !== input.category.components.length || new Set(ids).size !== ids.length) return [issue('INVALID_COMPOSITION')]
  return input.category.components.flatMap((component, index) => {
    const declaration = input.declarations[index]
    const benchmark = selected.find(s => s.businessBenchmarkId === component.businessBenchmarkId && s.organizationId === input.organisationId)
    if (!benchmark) return [issue('BENCHMARK_UNAVAILABLE', declaration.componentId)]
    if (component.weightPercent === 0) return []
    const eligibility = assessPciEligibility(savedBenchmarkProfile(benchmark), declaration.valueKind)
    return eligibility.status === 'UNSUITABLE' ? [issue(eligibility.reason === 'VARIANT_MISMATCH' ? 'VALUE_KIND_MISMATCH' : 'SEMANTIC_MISMATCH', declaration.componentId)] : []
  })
}

type Observation = { date: string; originalDate: string; value: number | null; native: ForecastTargetPeriod }
type Source = { view: SmartComponentView; declaration: SmartMethodDeclaration; observations: readonly Observation[]; issues: readonly SmartIssue[] }
function evidenceBasis(benchmark: SavedBenchmark): { basis: CciNodeBasis | null; evidence: string[] } {
  const snapshot = savedBenchmarkProfile(benchmark).evidence
  const fields = snapshot.filter(e => /(?:\.)DataType$/.test(e.field))
  const explicit = fields.flatMap(e => e.values.map(value => ({ field: e.field, value })))
  // A provider's explicit sampling description is evidence of basis, not of price semantics.
  const bases = new Set<CciNodeBasis>()
  for (const { value } of explicit) {
    if (/^(?:average|period average|mean)$/i.test(value.trim())) bases.add('PERIOD_AVERAGE')
    if (/^(?:close|end[ -]of[ -]period)$/i.test(value.trim())) bases.add('END_OF_PERIOD')
    if (/^(?:point[ -]in[ -]time|spot observation)$/i.test(value.trim())) bases.add('POINT_IN_TIME')
  }
  if (!explicit.length && /\bClose\b/i.test(benchmark.displayName)) bases.add('END_OF_PERIOD')
  return { basis: bases.size === 1 ? [...bases][0] : null,
    evidence: explicit.length ? explicit.map(e => e.field + ': ' + e.value) : bases.size ? ['Provider title: Close'] : [] }
}
function relevanceWarning(name: string, title: string): boolean {
  const groups = [/\b(?:steel|stal|stali)\b/i, /\b(?:oil|ropa|ropy|brent|wti)\b/i, /\b(?:copper|miedz|miedzi)\b/i, /\b(?:aluminium|aluminum)\b/i]
  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const a = groups.flatMap((g, i) => g.test(normalize(name)) ? [i] : []), b = groups.flatMap((g, i) => g.test(normalize(title)) ? [i] : [])
  return a.length > 0 && b.length > 0 && !a.some(i => b.includes(i))
}
function readSource(input: SmartPciRequest, index: number, selected: readonly SavedBenchmark[], histories: ReadonlyMap<string, BenchmarkAnalyticsSeriesResult>): Source {
  const component = input.category.components[index], declaration = input.declarations[index]
  const benchmark = selected.find(s => s.businessBenchmarkId === component.businessBenchmarkId && s.organizationId === input.organisationId)!
  const history = histories.get(component.businessBenchmarkId), profile = savedBenchmarkProfile(benchmark)
  const issue = (code: string, extra: Partial<SmartIssue> = {}) => smartIssue(code, input.locale, { componentId: declaration.componentId, ...extra })
  const sourceBasis = evidenceBasis(benchmark), kind = ['PRICE_LEVEL', 'PRICE_INDEX'].includes(profile.classification)
    ? profile.classification as 'PRICE_LEVEL' | 'PRICE_INDEX' : declaration.verified ? declaration.valueKind ?? null : null
  const basis = declaration.periodBasis ? (declaration.periodBasis === sourceBasis.basis || !sourceBasis.basis && declaration.verified ? declaration.periodBasis : null) : sourceBasis.basis
  const verificationRequired = component.weightPercent > 0 && (!kind || !basis || declaration.reduction !== 'AUTO' && declaration.reduction !== 'NATIVE_VALUE' && !declaration.verified)
  const frequency = normalizeForecastSourceFrequency(history?.frequency ?? benchmark.frequency)
  const issues: SmartIssue[] = [], observations: Observation[] = []
  if (component.weightPercent > 0) {
    if (!history || history.providerSeries.providerSeriesId !== benchmark.providerSeries.providerSeriesId || history.providerSeries.provider.providerCode !== benchmark.provider.providerCode) issues.push(issue('BENCHMARK_UNAVAILABLE'))
    if (!frequency) issues.push(issue('UNKNOWN_FREQUENCY'))
    const byPeriod = new Map<string, Observation[]>()
    for (const raw of history?.historical ?? []) {
      try {
        const date = parseBenchmarkObservationDate(raw.date)
        const [year, month, d] = raw.date.slice(0, 10).split('-').map(Number), calendar = new Date(Date.UTC(year, month - 1, d))
        if (!Number.isFinite(date.getTime()) || year < 100 || calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== d) throw Error('INVALID_DATE')
        if (!frequency) continue
        const native = createCalendarTargetPeriod(date, frequency), observation = { date: date.toISOString(), originalDate: raw.date, value: raw.value, native }
        observations.push(observation)
        const key = native.start.toISOString(); byPeriod.set(key, [...(byPeriod.get(key) ?? []), observation])
        if (raw.value !== null && (!Number.isFinite(raw.value) || raw.value <= 0)) issues.push(issue('INVALID_PRICE_LEVEL', { period: key }))
      } catch { issues.push(issue('INVALID_DATE')) }
    }
    for (const [period, rows] of byPeriod) if (rows.length > 1) issues.push(issue('DUPLICATE_NATIVE_PERIOD', { period }))
    if (!observations.length) issues.push(issue('NO_OBSERVATIONS'))
  }
  observations.sort((a, b) => a.date.localeCompare(b.date))
  const warnings = relevanceWarning(component.name, benchmark.displayName) ? [issue('ECONOMIC_REPRESENTATIVENESS_VERIFY')] : []
  return { declaration, observations, issues, view: { id: declaration.componentId, benchmark: benchmark.displayName,
    seriesId: benchmark.providerSeries.providerSeriesId, provider: benchmark.provider.providerCode, weightPercent: component.weightPercent,
    valueKind: kind, nativeCadence: frequency, periodBasis: basis, evidence: [...sourceBasis.evidence, ...(declaration.verified ? ['USER_VERIFIED_COMPONENT_METHOD'] : [])], verificationRequired,
    firstDate: observations[0]?.date.slice(0, 10) ?? null, lastDate: observations.at(-1)?.date.slice(0, 10) ?? null,
    unit: history?.unit ?? benchmark.unit, currency: history?.currency ?? benchmark.currency,
    historyFingerprint: history ? 'raw-history-sha256:' + digest({ provider: history.providerSeries, frequency: history.frequency, historical: history.historical }) : null,
    sourceObservations:history?.historical??[],sourceRevision:'UNAVAILABLE',historicalPublicationAvailability:'UNKNOWN',expectedObservations: 'UNKNOWN', warnings } }
}

function tiles(target: ForecastTargetPeriod, source: CciCadence): boolean {
  let p = createCalendarTargetPeriod(target.start, source), count = 0
  if (p.start.getTime() !== target.start.getTime()) return false
  while (p.start < target.endExclusive && ++count <= 370) {
    if (p.endExclusive > target.endExclusive) return false
    if (p.endExclusive.getTime() === target.endExclusive.getTime()) return true
    p = createCalendarTargetPeriod(p.endExclusive, source)
  }
  return false
}
function methodFor(source: Source, cadence: CciCadence, basis: CciNodeBasis, target: ForecastTargetPeriod): string | null {
  const native = source.view.nativeCadence, declared = source.declaration.reduction
  if (!native || !source.view.periodBasis || source.view.verificationRequired || !tiles(target, native)) return null
  if (native === cadence && source.view.periodBasis === basis && ['AUTO', 'NATIVE_VALUE'].includes(declared)) return 'NATIVE_VALUE'
  if (declared === 'NATIVE_VALUE') return null
  if (basis === 'PERIOD_AVERAGE' && native === 'DAILY' && source.view.periodBasis !== 'PERIOD_AVERAGE'
    && ['AUTO', 'AVAILABLE_OBSERVATION_AVERAGE'].includes(declared)) return 'AVAILABLE_OBSERVATION_AVERAGE'
  if (basis === 'END_OF_PERIOD' && source.view.periodBasis !== 'PERIOD_AVERAGE'
    && (declared === 'END_OF_PERIOD' && source.declaration.verified || native === 'DAILY' && source.view.periodBasis === 'END_OF_PERIOD' && declared === 'AUTO')) return 'END_OF_PERIOD'
  return null
}
function prepareValue(source: Source, period: ForecastTargetPeriod, basis: CciNodeBasis, method: string | null, locale: 'pl' | 'en'): SmartPreparedComponent {
  const identity = { id: source.view.id, method: method ?? 'UNAPPROVED', methodVersion: PCI_PREPARATION_METHOD,
    sourceBasis: source.view.periodBasis, targetBasis: basis, expectedObservations: 'UNKNOWN' as const, historyFingerprint: source.view.historyFingerprint }
  if (source.view.weightPercent === 0) return { ...identity, method: 'EXCLUDED_ZERO_WEIGHT', sourceDates: [], sourceCount: 0, quality: 'NOT_ASSESSED', value: null, issues: [] }
  // Binary seek instead of scanning every source observation for every candidate period.
  let lo = 0, hi = source.observations.length
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (source.observations[mid].native.start < period.start) lo = mid + 1; else hi = mid }
  const rows: Observation[] = []
  for (let i = lo; i < source.observations.length && source.observations[i].native.start < period.endExclusive; i++) {
    if (source.observations[i].native.endExclusive <= period.endExclusive) rows.push(source.observations[i])
  }
  const dates = rows.map(p => p.originalDate), start = period.start.toISOString(), end = period.endExclusive.toISOString()
  const issues: SmartIssue[] = source.issues.filter(i => !i.period || i.period >= start && i.period < end).map(i => ({ ...i, usedInWindow: true }))
  if (!method) issues.push(smartIssue('UNAPPROVED_AGGREGATION', locale, { componentId: source.view.id, period: start, usedInWindow: true }))
  if (!rows.length || rows.some(r => r.value === null)) issues.push(smartIssue('MISSING_OBSERVATION', locale, { componentId: source.view.id, period: start, usedInWindow: true }))
  if (issues.length) return { ...identity, sourceDates: dates, sourceCount: rows.length, quality: 'INSUFFICIENT', value: null, issues }
  const points = rows.map(r => ({ observedAt: new Date(r.date), value: r.value! }))
  const value = method === 'NATIVE_VALUE' ? rows[0].value : method === 'AVAILABLE_OBSERVATION_AVERAGE'
    ? reduceForecastPeriodAverage(points) : reduceForecastPeriodEndOfPeriod(points)?.value ?? null
  const quality = method === 'NATIVE_VALUE' ? 'QUALIFIED_COMPLETE' as const : 'QUALIFIED_PARTIAL_DISCLOSED' as const
  if (value === null || !Number.isFinite(value) || value <= 0) return { ...identity, sourceDates: dates, sourceCount: rows.length, quality: 'INSUFFICIENT', value: null,
    issues: [smartIssue('MISSING_OBSERVATION', locale, { componentId: source.view.id, period: start, usedInWindow: true })] }
  return { ...identity, sourceDates: dates, sourceCount: rows.length, quality, value, issues: [] }
}

/** Pure, bounded market preparation. Source data remain unchanged; no provider, Clerk/E1, DB, cache or clock access. */
export function prepareSmartPci(input: SmartPciRequest, selected: readonly SavedBenchmark[], histories: ReadonlyMap<string, BenchmarkAnalyticsSeriesResult>, now: string): SmartPrepared {
  const cutoff = isoDay(now), purchase = isoDay(input.purchase.purchaseDate), purchaseDay = new Date(purchase)
  const recommendation = new Date(purchaseDay); recommendation.setUTCDate(1); recommendation.setUTCMonth(recommendation.getUTCMonth() - 3)
  const yearStart = input.olderYear === undefined ? recommendation : new Date(Date.UTC(input.olderYear, 0, 1))
  const start = yearStart < recommendation ? yearStart : recommendation
  const validation = smartSelectionIssues(input, selected)
  const contexts = new Map<string, SmartPreparedContext>()
  const empty: SmartPreparation = { version: PCI_PREPARATION_METHOD, id: 'pci-smart:' + digest({ input, cutoff }), purchaseDate: input.purchase.purchaseDate, cutoff,
    state: 'NO_QUALIFIED_REFERENCE', recommendedCandidateId: null, candidates: [], components: [], issues: validation, historicalDiagnostics: [], availableYears: [],
    recommendationPolicy: PCI_PROXY_LOOKBACK, recommendationStart: day(recommendation), analysisWindow: { start: start.toISOString(), endExclusive: cutoff }, limitations: LIMITATIONS }
  if (validation.length) return { preparation: empty, contexts }
  const sources = input.category.components.map((_, i) => readSource(input, i, selected, histories))
  const active = sources.filter(s => s.view.weightPercent > 0)
  const diagnostics = sources.flatMap(s => s.issues.map(i => ({ ...i, usedInWindow: !i.period || i.period >= start.toISOString() && i.period < cutoff })))
  const years = [...new Set(sources.flatMap(s => s.observations.flatMap(p => [Number(p.date.slice(0, 4)),p.native.start.getUTCFullYear()])))].sort((a, b) => b - a)
  const preparationId = 'pci-smart:' + digest({ version: PCI_PREPARATION_METHOD, purchase: input.purchase, organisationId: input.organisationId,
    category: input.category, declarations: input.declarations, olderYear: input.olderYear ?? null, cutoff,
    sources: sources.map(s => ({ ...s.view, sourceObservations:undefined, evidence: savedBenchmarkProfile(selected.find(b => b.providerSeries.providerSeriesId === s.view.seriesId)!).evidence })) })
  const prep = { ...empty, id: preparationId, components: sources.map(s => s.view), availableYears: years, historicalDiagnostics: diagnostics }
  const globalIssues = active.flatMap(s => s.view.verificationRequired ? [smartIssue('METHODOLOGY_REQUIRED', input.locale, { componentId: s.view.id })]
    : s.issues.filter(i => !i.period))
  if (globalIssues.length) return { preparation: { ...prep, state: active.some(s => s.view.verificationRequired) ? 'VERIFICATION_REQUIRED' : 'NO_QUALIFIED_REFERENCE', issues: globalIssues }, contexts }
  if (sources.reduce((n, s) => n + s.observations.length, 0) > 100000 || start.toISOString() >= cutoff) {
    return { preparation: { ...prep, issues: [smartIssue(start.toISOString() >= cutoff ? 'OPEN_PURCHASE_PERIOD' : 'DATA_VOLUME_LIMIT', input.locale)] }, contexts }
  }
  const allCandidates: SmartCandidate[] = []
  let compatibleMethods=false
  const purchasePeriodIssues:SmartIssue[]=[]
  for (const cadence of FORECAST_NATIVE_FREQUENCIES) {
    for (const basis of ['POINT_IN_TIME', 'END_OF_PERIOD', 'PERIOD_AVERAGE'] as const) {
      const periods: ForecastTargetPeriod[] = []
      let period = createCalendarTargetPeriod(start, cadence)
      // Earlier canonical starts are retained for containing-period analysis, never silently relabelled.
      while (period.start.toISOString() < cutoff && periods.length <= 25000) {
        if (period.endExclusive.toISOString() <= cutoff) periods.push(period)
        period = createCalendarTargetPeriod(period.endExclusive, cadence)
        if (period.endExclusive.toISOString() > cutoff) break
      }
      if (periods.length > 25000) continue
      const template = periods[0] ?? createCalendarTargetPeriod(purchaseDay, cadence)
      const methods = sources.map(s => methodFor(s, cadence, basis, template))
      if (sources.some((s, i) => s.view.weightPercent > 0 && !methods[i])) continue
      compatibleMethods=true
      const provenance = periods.map(period => ({ period: periodIdentity(period), components: sources.map((s, i) => prepareValue(s, period, basis, methods[i], input.locale)) }))
      const containing=createCalendarTargetPeriod(purchaseDay,cadence)
      if(containing.endExclusive.toISOString()>cutoff){for(const source of active)purchasePeriodIssues.push(smartIssue('OPEN_PURCHASE_PERIOD',input.locale,{componentId:source.view.id,period:containing.start.toISOString(),usedInWindow:true}))}
      else{const atPurchase=provenance.find(p=>p.period.start===containing.start.toISOString());for(const part of atPurchase?.components??[])purchasePeriodIssues.push(...part.issues)}
      const nodes: CciAlignedNode[] = provenance.map(n => ({ period: n.period,
        status: n.components.every((p, i) => sources[i].view.weightPercent === 0 || p.value !== null && p.quality !== 'INSUFFICIENT') ? 'COMPLETE' : 'INCOMPLETE',
        components: n.components.map((p, i) => ({ componentId: p.id, weightPercent: sources[i].view.weightPercent,
          value: p.quality === 'INSUFFICIENT' ? null : p.value,
          status: sources[i].view.weightPercent === 0 ? 'EXCLUDED_ZERO_WEIGHT' : p.quality === 'INSUFFICIENT' ? 'INCOMPLETE_COVERAGE' : 'COMPLETE',
          method: p.method === 'EXCLUDED_ZERO_WEIGHT' || p.quality === 'INSUFFICIENT' ? null : { id: p.method, version: PCI_PREPARATION_METHOD, approvalRef: preparationId },
          sourceDates: p.sourceDates, coverage: p.quality === 'QUALIFIED_COMPLETE' ? 'NATIVE_PERIOD' : sources[i].view.nativeCadence === 'DAILY' && p.method !== 'EXCLUDED_ZERO_WEIGHT' ? 'AVAILABLE_DAILY_OBSERVATIONS' : 'NONE' })) }))
      for (const [index, node] of nodes.entries()) {
        if (node.status !== 'COMPLETE') continue
        const strict = node.period.start <= purchase && purchase < node.period.endExclusive
        const proxy = node.period.endExclusive <= purchase
        if (!strict && !proxy) continue
        const recommendedWindow = node.period.start >= recommendation.toISOString()
        const deliberateOlder = input.olderYear !== undefined && Number(node.period.start.slice(0, 4)) === input.olderYear
        if (!strict && !recommendedWindow && !deliberateOlder) continue
        const c: SmartCandidate = { id: 'reference:' + digest({ preparationId, period: node.period, basis }), mode: strict ? 'STRICT_PURCHASE_REFERENCE' : 'EARLIER_MARKET_PROXY',
          period: node.period, basis, quality: provenance[index].components.some((v, i) => sources[i].view.weightPercent > 0 && v.quality === 'QUALIFIED_PARTIAL_DISCLOSED') ? 'QUALIFIED_PARTIAL_DISCLOSED' : 'QUALIFIED_COMPLETE',
          recommended: false, requiresApproval: !strict || cadence !== 'DAILY' || provenance[index].components.some(p => p.method !== 'NATIVE_VALUE' && p.method !== 'EXCLUDED_ZERO_WEIGHT'),
          olderExplicitSelection: !strict && !recommendedWindow, lagDays: strict ? 0 : Math.max(0, Math.floor((purchaseDay.getTime() - Date.parse(node.period.endExclusive)) / 86400000)),
          canCalculateMarketIndex: true, canCalculateIndexedPrice: strict, components: provenance[index].components,
          analysisWindow: { start: nodes[0].period.start, endExclusive: nodes.at(-1)!.period.endExclusive } }
        const cciInput: CciNodeInput = { modelKey: 'transient-category', baseNodeStart: node.period.start, analysisCadence: cadence, nodeBasis: basis, cutoff,
          inputSemantics: { preparationPolicyId: preparationId, currencyPolicy: { kind: 'NATIVE_CURRENCY_RELATIVES' } },
          components: sources.map(s => ({ componentId: s.view.id, weightPercent: s.view.weightPercent })), nodes }
        contexts.set(c.id, { candidate: c, input: cciInput, nodeProvenance: provenance }); allCandidates.push(c)
      }
    }
  }
  const order = (c: SmartCandidate) => c.mode === 'STRICT_PURCHASE_REFERENCE' ? c.period.cadence === 'DAILY' ? 0 : 1 : c.olderExplicitSelection ? 3 : 2
  allCandidates.sort((a, b) => order(a) - order(b)
    || Number(a.quality === 'QUALIFIED_PARTIAL_DISCLOSED') - Number(b.quality === 'QUALIFIED_PARTIAL_DISCLOSED')
    || a.lagDays - b.lagDays || FORECAST_NATIVE_FREQUENCIES.indexOf(a.period.cadence) - FORECAST_NATIVE_FREQUENCIES.indexOf(b.period.cadence)
    || b.period.start.localeCompare(a.period.start) || a.basis.localeCompare(b.basis) || a.id.localeCompare(b.id))
  if(allCandidates.some(c=>c.mode==='STRICT_PURCHASE_REFERENCE')){for(let i=allCandidates.length-1;i>=0;i--)if(allCandidates[i].mode==='EARLIER_MARKET_PROXY'){contexts.delete(allCandidates[i].id);allCandidates.splice(i,1)}}
  const recommended = allCandidates.find(c => !c.olderExplicitSelection)
  if (recommended) recommended.recommended = true
  // Return all candidates in the bounded requested window; never auto-select older references.
  const strictAvailable=allCandidates.some(c=>c.mode==='STRICT_PURCHASE_REFERENCE')
  const purchaseIssues=[...new Map(purchasePeriodIssues.map(i=>[JSON.stringify([i.code,i.componentId,i.period]),i])).values()].slice(0,12)
  const issues = allCandidates.length ? strictAvailable?[]:purchaseIssues : [smartIssue('NO_QUALIFIED_REFERENCE', input.locale),
    ...purchaseIssues,...diagnostics.filter(i => i.usedInWindow).slice(0, 12),
    ...(!compatibleMethods
      ? [smartIssue('UNAPPROVED_AGGREGATION', input.locale)] : [])]
  return { preparation: { ...prep, candidates: allCandidates, recommendedCandidateId: recommended?.id ?? null,
    state: recommended?.mode ?? 'NO_QUALIFIED_REFERENCE', issues }, contexts }
}
