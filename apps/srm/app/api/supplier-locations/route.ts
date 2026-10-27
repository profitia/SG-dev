import {getSrmReportRuntime} from '../../../src/server/private-runtime'
import {createSupplierLocationHandler} from '../../../src/server/supplier-locations'
import {createSupplierMapReadinessHandler} from '../../../src/server/supplier-map-readiness'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(request:Request){
 try{
  const current=getSrmReportRuntime()
  if(current.provider!=='clerk'||!current.locations)return Response.json({ready:false},{status:503,headers:{'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}})
  const locations=current.locations
  return createSupplierMapReadinessHandler({read:async(request,supplierId)=>{await locations.page({request,supplierId,organisationId:current.defaultOrganisationId},'SUPPLIER_LOCATIONS',0,1)}})(request)
 }catch{return Response.json({ready:false},{status:503,headers:{'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}})}
}
export async function POST(request:Request){
 try{
  const current=getSrmReportRuntime()
  if(current.provider!=='clerk'||!current.locations)return Response.json({error:'Lokalizacje nie są jeszcze dostępne.'},{status:503,headers:{'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}})
  return createSupplierLocationHandler(current.locations,current.defaultOrganisationId,current.locationGeocoding)(request)
 }catch{return Response.json({error:'Lokalizacje są teraz niedostępne.'},{status:503,headers:{'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}})}
}
