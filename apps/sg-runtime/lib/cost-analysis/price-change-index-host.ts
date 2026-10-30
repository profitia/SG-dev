import { createHash } from 'node:crypto'
import type { BenchmarkAnalyticsSeriesResult, SavedBenchmark } from '../benchmark/contracts'
import { categoryDraftStatus } from '../category/draft'
import { createCalendarTargetPeriod, normalizeForecastSourceFrequency } from '../forecast/cadence'
import { pciIssueMessage,pciCategoryIssues } from './price-change-index-messages'
import type { CciMarketDataRequest } from './market-data-contracts'
import { calculateCciFromMarketData } from './node-integration'
import { calculateCciIndexedPrice, CciIndexedPriceValidationError } from './cci-indexed-price'
import { PCI_JOURNEY_VERSION, type PciAnalysisRequest, type PciAnalysisResponse } from './price-change-index-contracts'

/** Thin consumer of PRs #580/#584. No provider, persistence, resampling or alternative mathematics. */
export function buildPciMarketRequest(input: PciAnalysisRequest,
  selected: readonly SavedBenchmark[], histories: ReadonlyMap<string, BenchmarkAnalyticsSeriesResult>, cutoff: string): CciMarketDataRequest | Extract<PciAnalysisResponse,{status:'REFUSED'}> {
  const refuse = (code: string,message: string): Extract<PciAnalysisResponse,{status:'REFUSED'}> => ({contractVersion:PCI_JOURNEY_VERSION,status:'REFUSED',issues:[{code,message}]})
  if (categoryDraftStatus(input.category.components) !== 'READY') return refuse('CATEGORY_NOT_READY','Uzupełnij co najmniej dwa komponenty i udziały do 100%.')
  if (new Set(input.declarations.map(c=>c.componentId)).size !== input.category.components.length)
    return refuse('INVALID_COMPOSITION','Komponenty i deklaracje muszą jednoznacznie odpowiadać wybranym benchmarkom.')
  const policyRef = 'buyer-declared-methodology-v1:'+createHash('sha256').update(JSON.stringify(input.declarations)).digest('hex')
  const components = []
  let start = Infinity, end = -Infinity, pointCount = 0
  for (const [index,component] of input.category.components.entries()) {
    const benchmark = selected.find(b=>b.businessBenchmarkId===component.businessBenchmarkId && b.organizationId===input.organisationId)
    const history = histories.get(component.businessBenchmarkId)
    const declaration = input.declarations[index]
    if (!benchmark || !history || !declaration || history.providerSeries.provider.providerCode !== benchmark.provider.providerCode
      || history.providerSeries.providerSeriesId !== benchmark.providerSeries.providerSeriesId)
      return refuse('BENCHMARK_UNAVAILABLE','Nie można użyć tego benchmarku w bieżącej organizacji.')
    const cadence = normalizeForecastSourceFrequency(history.frequency)
    if (!cadence) return refuse('UNKNOWN_FREQUENCY','Źródło nie podaje obsługiwanej kadencji. Nie tworzymy sztucznych obserwacji.')
    pointCount += history.historical.length
    if (pointCount > 100000) return refuse('DATA_VOLUME_LIMIT','Ta struktura przekracza obsługiwany zakres historii. Dane nie zostały przycięte ani zagregowane.')
    for (const point of history.historical) {
      const period = createCalendarTargetPeriod(point.date,cadence)
      start=Math.min(start,period.start.getTime());end=Math.max(end,period.endExclusive.getTime())
    }
    components.push({componentId:declaration.componentId,weightPercent:component.weightPercent,
      benchmarkSeriesId:benchmark.providerSeries.providerSeriesId,history,
      qualification:{valueKind:declaration.valueKind,periodBasis:declaration.periodBasis,calendar:'UTC_CALENDAR' as const,evidenceRef:policyRef},
      reduction:declaration.reduction==='NATIVE_ONLY'?{method:'NATIVE_ONLY' as const}:{method:declaration.reduction,approvalRef:policyRef},
      // The existing stored read has no immutable vintage or retrieval attestation.
      snapshot:{retrievedAt:null,revisionRef:null}})
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start>=end) return refuse('NO_OBSERVATIONS','Brak obserwacji do analizy.')
  const bases = new Set(input.declarations.map(d=>d.periodBasis))
  if (bases.size!==1) return refuse('INCOMPATIBLE_ECONOMIC_BASIS','Komponenty wymagają zgodnej, jawnie określonej podstawy ekonomicznej.')
  return {modelKey:'transient-category',baseNodeStart:input.purchase.referenceDate+'T00:00:00.000Z',
    range:{start:new Date(start).toISOString(),endExclusive:new Date(end).toISOString()},cutoff,
    availability:'RETROSPECTIVE_CURRENT_HISTORY',alignmentPolicy:'STRICT_COMMON_NODES',nodeBasis:input.declarations[0].periodBasis,
    currencyPolicy:{kind:'NATIVE_CURRENCY_RELATIVES'},components}
}


export function analysePriceChangeIndex(input:PciAnalysisRequest,selected:readonly SavedBenchmark[],histories:ReadonlyMap<string,BenchmarkAnalyticsSeriesResult>,cutoff:string):PciAnalysisResponse {
  const refuse=(code:string,message:string):PciAnalysisResponse=>({contractVersion:PCI_JOURNEY_VERSION,status:'REFUSED',issues:[{code,message:pciIssueMessage({code,message})}]})
  const request=buildPciMarketRequest(input,selected,histories,cutoff)
  if('status' in request)return request
  if(request.baseNodeStart<request.range.start||request.baseNodeStart>=request.range.endExclusive)
    return refuse('REFERENCE_DATE_OUTSIDE_HISTORY','Wybrana data odniesienia jest poza dostępną historią. Sprawdź dostępność danych każdego komponentu. Data zakupu nie została zmieniona.')
  const policyRef=request.components[0].qualification.evidenceRef
  const core=calculateCciFromMarketData(request)
  if (core.status==='REFUSED') return {contractVersion:PCI_JOURNEY_VERSION,status:'REFUSED',issues:pciCategoryIssues(core.issues,input,histories),core}
  if (core.calculation.nodes.length>25000) return refuse('DATA_VOLUME_LIMIT','Pełna historia przekracza limit tej analizy. Nie została sztucznie skrócona.')
  try {
    const indexedPrice=calculateCciIndexedPrice({calculation:core.calculation,basePrice:{amount:input.purchase.amount,
      currency:input.purchase.currency,unit:input.purchase.unit,taxBasis:input.purchase.taxBasis,
      deliveryBasis:{kind:'DECLARED',description:input.purchase.deliveryBasis},purchaseDate:input.purchase.purchaseDate,
      referenceNodeStart:core.calculation.baseNode.start,modeledPriceScope:'FULL_PURCHASE_PRICE_ALLOCATED_TO_DECLARED_COMPONENTS',
      periodMapping:input.purchase.economicPeriodApproved?{kind:'EXPLICIT_ECONOMIC_PERIOD',policyId:'buyer-explicit-period-association-v1',
        approvalRef:policyRef,interpretation:'PERIOD_REFERENCE_NOT_TRANSACTION_DATE_QUOTE'}:{kind:'EXACT_PURCHASE_DAY'}}})
    return {contractVersion:PCI_JOURNEY_VERSION,status:'CALCULATED',core,indexedPrice}
  } catch(error) {
    if (!(error instanceof CciIndexedPriceValidationError)) throw error
    return refuse(error.issue.code,error.issue.message)
  }
}
