import type {SavedBenchmark,BenchmarkAnalyticsSeriesResult} from '../benchmark/contracts'
import {buildPciMarketRequest} from './price-change-index-host'
import {prepareCciNodeInput} from './node-integration'
import {pciIssueMessage} from './price-change-index-messages'
import {PCI_JOURNEY_VERSION,type PciAnalysisRequest,type PciPreparationResponse} from './price-change-index-contracts'

/** Read-only projection of the existing adapter. No replacement observations,
 * cadence search, changed purchase date, or implied economic qualification. */
export function preparePriceChangeIndex(input:PciAnalysisRequest,selected:readonly SavedBenchmark[],histories:ReadonlyMap<string,BenchmarkAnalyticsSeriesResult>,cutoff:string):PciPreparationResponse {
  const request=buildPciMarketRequest(input,selected,histories,cutoff)
  const components=input.category.components.map((c,i)=>{
    const history=histories.get(c.businessBenchmarkId)
    const dates=history?.historical.filter(p=>p.value!==null).map(p=>p.date).sort()??[]
    return {id:input.declarations[i]?.componentId??'',frequency:history?.frequency??null,unit:history?.unit??null,firstDate:dates[0]?.slice(0,10)??null,lastDate:dates.at(-1)?.slice(0,10)??null,status:'NOT_ASSESSED'}
  })
  const result:PciPreparationResponse={contractVersion:PCI_JOURNEY_VERSION,status:'PREPARED',preparation:{cadence:null,cutoff,components,periods:[],issues:[],canAnalyse:false}}
  if('status' in request){result.preparation.issues=request.issues;return result}
  // A probe inside the supplied history permits enumeration even when the
  // buyer's requested reference is outside it. It never becomes a selected base.
  const inRange=request.baseNodeStart>=request.range.start&&request.baseNodeStart<request.range.endExclusive
  const prepared=prepareCciNodeInput({...request,baseNodeStart:inRange?request.baseNodeStart:request.range.start})
  const alignment=prepared.alignment
  if(!alignment){result.preparation.issues=prepared.status==='REFUSED'?prepared.issues.map(i=>({...i,message:pciIssueMessage(i)})):[];return result}
  const purchase=input.purchase.purchaseDate+'T00:00:00.000Z'
  const periods=alignment.nodes.filter(n=>n.status==='COMPLETE').map(n=>({start:n.period.start.slice(0,10),endExclusive:n.period.endExclusive.slice(0,10),eligible:purchase>=n.period.start&&purchase<n.period.endExclusive,requiresApproval:n.period.cadence!=='DAILY'}))
  const requested=alignment.nodes.find(n=>n.period.start===request.baseNodeStart)
  const excluded=alignment.excludedAnalysisPeriods.find(n=>n.period.start===request.baseNodeStart)
  const issues:{code:string;message:string}[]=alignment.issues.filter(i=>!['MISSING_BASE_NODE','BASE_NODE_NOT_ALIGNED'].includes(i.code)).map(i=>({code:i.code,message:pciIssueMessage(i)}))
  if(excluded?.reasons.includes('OPEN_AT_CUTOFF'))issues.push({code:'OPEN_BASE_PERIOD',message:'Wybrany okres jeszcze się nie zakończył. Poczekaj na zamknięcie okresu i komplet notowań; nie zmieniaj faktycznej daty zakupu.'})
  else if(!requested||requested.status!=='COMPLETE')issues.push({code:'MISSING_BASE_NODE',message:'Dla wskazanego początku okresu brakuje kompletu zamkniętych danych. Sprawdź dostępność poniżej i listę wspólnych okresów; możesz też zmienić benchmark w kroku 01.'})
  const chosen=periods.find(p=>p.start===input.purchase.referenceDate)
  if(chosen&&!chosen.eligible)issues.push({code:'PURCHASE_OUTSIDE_BASE_PERIOD',message:pciIssueMessage({code:'PURCHASE_OUTSIDE_BASE_PERIOD',message:''})})
  if(chosen?.eligible&&chosen.requiresApproval&&!input.purchase.economicPeriodApproved)issues.push({code:'UNAPPROVED_PERIOD_MAPPING',message:pciIssueMessage({code:'UNAPPROVED_PERIOD_MAPPING',message:''})})
  if(!periods.some(p=>p.eligible))issues.push({code:'NO_BASE_FOR_PURCHASE',message:'Brak kompletnego, zamkniętego okresu obejmującego podaną datę zakupu. Starsze notowania nie mogą zastąpić danych dla tego zakupu. Sprawdź zakres historii lub wybierz inny właściwy benchmark.'})
  return {...result,preparation:{cadence:alignment.analysisCadence,cutoff,periods,issues,canAnalyse:!!chosen?.eligible&&(!chosen.requiresApproval||input.purchase.economicPeriodApproved)&&issues.length===0,
    components:components.map(c=>({...c,status:c.lastDate===null?'NO_OBSERVATIONS':excluded?.reasons.includes('OPEN_AT_CUTOFF')?'OPEN_PERIOD':requested?.components.find(v=>v.componentId===c.id)?.status??'NO_MATCHING_PERIOD'}))}}
}
