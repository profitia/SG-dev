import {getSrmReportRuntime} from '../../../../src/server/private-runtime'
import {reportAdmissionTelemetry} from '../../../../src/server/report-admission-runtime'
import {supplierHttpFailure} from '../../../../src/server/supplier-acquisition-http'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function POST(request:Request){return reportAdmissionTelemetry(async()=>{
 try{
  const current=getSrmReportRuntime()
  if(current.provider!=='clerk'||!current.reportAdmission)return Response.json({error:'Przygotowanie raportu niedostępne.'},{status:503})
  return await current.reportAdmission.prepare(request)
 }catch(error){return supplierHttpFailure(error)}
})}
