import {getSrmReportRuntime} from '../../../src/server/private-runtime'
import {createSupplierLocationHandler} from '../../../src/server/supplier-locations'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function POST(request:Request){
 try{
  const current=getSrmReportRuntime()
  if(current.provider!=='clerk'||!current.locations)return Response.json({error:'Lokalizacje nie są jeszcze dostępne.'},{status:503,headers:{'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}})
  return createSupplierLocationHandler(current.locations,current.defaultOrganisationId)(request)
 }catch{return Response.json({error:'Lokalizacje są teraz niedostępne.'},{status:503,headers:{'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}})}
}
