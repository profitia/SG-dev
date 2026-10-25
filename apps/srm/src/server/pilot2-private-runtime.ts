import {OperationDenied} from '@profitia/platform-contracts/operation-context'
import {createSrmSupplierOperationHandler} from './supplier-acquisition-http'
import {withCurrentPrivateAuthority} from './report-admission-runtime'
import type {SrmSupplierApi} from './supplier-api-composition'

export const PILOT2_PRIVATE_ROUTES=['jdg','company-kys','jdg-kys','reveal','pdf','krs','web'] as const
export type Pilot2PrivateRoute=typeof PILOT2_PRIVATE_ROUTES[number]
/** Private actions reuse the ordinary current HUMAN host. A company report
 * admission never authorizes a KYS, sole trader, personal identifier or file. */
export function createPilot2PrivateRoutes(api:SrmSupplierApi,organisationId:string,enabled:()=>boolean){
 const handlers=new Map(PILOT2_PRIVATE_ROUTES.map(route=>[route,createSrmSupplierOperationHandler(route,api,organisationId)]))
 return (route:Pilot2PrivateRoute,request:Request):Promise<Response>=>{
  if(!enabled()||request.headers.has('X-SRM-Report-Admission'))throw new OperationDenied('ACCESS_BASIS_INVALID')
  const handler=handlers.get(route)
  if(!handler)throw new OperationDenied('CONTEXT_INVALID')
  return withCurrentPrivateAuthority(()=>handler(request))
 }
}
