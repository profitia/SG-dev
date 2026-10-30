import {createRuntimeBenchmarkSelectionHandlers} from '../benchmark/runtime-handlers'
import {createRuntimeBenchmarkAnalyticsHandler} from '../benchmark/analytics-handlers'
import {getSg2SelectionRuntime} from '../platform/private-runtime'
import {createPriceChangeIndexHandler} from './price-change-index-operation'
import {withinPciIdentityScope} from '../platform/pci-identity-scope'

export function createRuntimePriceChangeIndexHandler() {
  const selections=createRuntimeBenchmarkSelectionHandlers(), history=createRuntimeBenchmarkAnalyticsHandler()
  const handler=createPriceChangeIndexHandler({isClerk:()=>{try{return getSg2SelectionRuntime().provider==='clerk'}catch{return false}},
    selections:selections.GET,history,now:()=>new Date().toISOString()})
  return (request:Request)=>withinPciIdentityScope(request,()=>handler(request))
}
