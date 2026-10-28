import type {PciBusinessResult,PciBusinessPurchase,PciBusinessComponent} from '@profitia/sg2-price-change-index-ui'
import type {SavedBenchmark} from '../../lib/benchmark/contracts'
import {categoryDraftStatus} from '../../lib/category/draft'
import type {PciAnalysisRequest,PciAnalysisResponse} from '../../lib/cost-analysis/price-change-index-contracts'
const PCI_JOURNEY_VERSION:PciAnalysisRequest['contractVersion']='sg2.price-change-index.journey/1.0.0'
export type PciComponent=PciBusinessComponent&{benchmark:SavedBenchmark}
export const emptyPurchase=():PciBusinessPurchase=>({amount:'',currency:'',unit:'',taxBasis:'',deliveryBasis:'',purchaseDate:'',referenceDate:'',economicPeriodApproved:false,periodBasis:'',reduction:'NATIVE_ONLY'})
export function seedPciComponent(seed:SavedBenchmark,id:string):PciComponent{return{id,name:'',weightPercent:0,benchmark:seed,valueKind:''}}
export function pciCategoryBody(name:string,components:readonly PciComponent[]){return{name:name.trim(),components:components.map(c=>({name:c.name.trim(),weightPercent:c.weightPercent,businessBenchmarkId:c.benchmark.businessBenchmarkId}))}}
export function pciStructureReady(name:string,components:readonly PciComponent[]){return!!name.trim()&&components.every(c=>!!c.name.trim())&&categoryDraftStatus(components)==='READY'}
export function pciInput(name:string,components:readonly PciComponent[],purchase:PciBusinessPurchase):PciAnalysisRequest{
  if(!components.length||!components.every(c=>c.benchmark.organizationId===components[0].benchmark.organizationId))throw Error('Nie można mieszać organizacji.')
  return{contractVersion:PCI_JOURNEY_VERSION,organisationId:components[0].benchmark.organizationId,
    category:pciCategoryBody(name,components),purchase:{amount:Number(purchase.amount.replace(',','.')),currency:purchase.currency.trim(),unit:purchase.unit.trim(),
      taxBasis:purchase.taxBasis as 'NET'|'GROSS',deliveryBasis:purchase.deliveryBasis.trim(),purchaseDate:purchase.purchaseDate,
      referenceDate:purchase.referenceDate,economicPeriodApproved:purchase.economicPeriodApproved},
    declarations:components.map(c=>({componentId:c.id,valueKind:c.valueKind as 'PRICE_LEVEL'|'PRICE_INDEX',
      periodBasis:purchase.periodBasis as 'POINT_IN_TIME'|'END_OF_PERIOD'|'PERIOD_AVERAGE',reduction:purchase.reduction}))}
}
/** Monetary values are projections of authoritative engine outputs, never recomputed demo formulas. */
export function pciResult(response:Extract<PciAnalysisResponse,{status:'CALCULATED'}>,components:readonly PciComponent[]):PciBusinessResult{
  const r=response.indexedPrice
  return{methodologyId:r.methodologyId,cadence:r.analysisCadence,baseDate:r.baseNode.start,basePrice:r.basePrice.amount,currency:r.currency,unit:r.unit,limitations:r.limitations,
    nodes:r.nodes.map((node,n)=>({date:node.period.start,cci:node.cci,price:node.categoryIndexedPrice,changePercent:node.categoryPriceChangePercent,
      components:components.map((component,i)=>{
        const part=node.components.find(c=>c.componentId===component.id),core=r.sourceCalculation.nodes[n].components.find(c=>c.componentId===component.id)
        return{id:component.id,price:part?.indexedComponentPrice??null,contribution:part?.contributionAmount??null,
          changePercent:core?.benchmarkRelative==null?null:(core.benchmarkRelative-1)*100}
      })}))}
}
