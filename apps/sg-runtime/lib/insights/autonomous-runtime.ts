import * as Sentry from '@sentry/nextjs'
import { getSg2SelectionRuntime } from '@/lib/platform/private-runtime'
import type { createInstalledInsightsRuntime } from '@profitia/insights-runtime/host'
import path from 'node:path'
import { createPublicIdentityRequestBoundary } from '@profitia/platform-contracts/public-request'
import { readSg2IdentityRuntime } from '@/lib/platform/identity-runtime'

const unavailable = () => { throw Object.assign(new Error('NOT_ADMITTED'), { code: 'NOT_ADMITTED' }) }
type ReadInput = {seriesId: string; asOf: string; organisationId: string}
/** These are the already accepted SG Runtime read ports. No provider access,
 * model fitting, private tables, alternate reader or fresh Forecast is added. */
const canonicalPorts = {
  async marketRead(input: ReadInput) {
    const r = getSg2SelectionRuntime()
    if(r.provider!=='clerk'||!r.marketRead) return unavailable()
    let value: Awaited<ReturnType<typeof r.marketRead.preview>>
    try {value=await r.marketRead.preview({seriesName:input.seriesId,range:'3M'})}
    catch(error) {
      if(error && typeof error==='object' && 'code' in error && error.code==='STORED_HISTORY_NOT_AVAILABLE')
        throw Object.assign(new Error('NO_DATA'),{code:'NO_DATA'})
      throw error
    }
    const observations=value.historical.filter(p=>p.value!==null&&p.date<=input.asOf)
    const last=observations.at(-1)
    if(!last) throw Object.assign(new Error('NO_DATA'),{code:'NO_DATA'})
    return {seriesId:input.seriesId,label:input.seriesId==='cl_c1_cl'?'WTI':'Brent',
      instrumentType:'FUTURES_CONTINUOUS',provider:'MACROBOND',providerSeries:value.providerSeries,
      observationDate:last.date.slice(0,10),value:last.value,currency:value.currency,unit:value.unit,source:value.source,
      history:observations,rollover:'NOT_CERTIFIED',freshness:'OBSERVATION_DATE_EXPLICIT'}
  },
  async forecastRead(input: ReadInput) {
    const r=getSg2SelectionRuntime()
    if(r.provider!=='clerk'||!r.forecastRead) return unavailable()
    const names={naive:'Naive',damped_holt:'Damped Holt',ets:'ETS',arima:'ARIMA'} as const
    const models=[]
    for(const modelId of ['naive','damped_holt','ets','arima'] as const){
      const value=await r.forecastRead.current({seriesId:input.seriesId,modelId,targetBasis:'POINT_IN_TIME'})
      if(value.status!=='AVAILABLE'||!('path' in value)||!('origin' in value)) return null
      const origin=value.origin.date
      const target=new Date(Date.parse(origin+'T00:00:00Z')+7*86400000).toISOString().slice(0,10)
      if(target<=input.asOf.slice(0,10)||origin>input.asOf.slice(0,10)) return null
      const point=value.path.find(p=>p.date===target)
      if(!point) return null
      models.push({id:modelId,name:names[modelId],origin,target,point:point.pointForecast,
        method:value.forecastMethod,intervals:'NOT_AVAILABLE',
        verification:{status:'NOT_AVAILABLE',sampleSize:null,mae:null,rmse:null,smape:null},
        limitations:['EXPERIMENTAL_7D_POINT_FROM_ACCEPTED_CURRENT_PATH','NO_7D_INTERVAL_CERTIFICATION'],
        sourceHistoryFingerprint:value.audit.sourceHistoryFingerprint})
    }
    return {seriesId:input.seriesId,label:input.seriesId==='cl_c1_cl'?'WTI':'Brent',status:'EXPERIMENTAL_7D',models}
  }
}
const monitoring={
  span:async(name:string,fn:()=>Promise<unknown>)=>Sentry.startSpan({name,op:'insights.report'},fn),
  capture:(error:Error,data:Record<string,unknown>)=>Sentry.withScope(scope=>{
    scope.setTag('operation','insights.report');scope.setTag('stage',String(data.stage??'worker'));
    Sentry.captureException(error)
  })
}
let runtime:ReturnType<typeof createInstalledInsightsRuntime>|undefined
export function getInsightsRuntime(){
  if(!runtime) runtime=import('@profitia/insights-runtime/host')
    .then(({createInstalledInsightsRuntime})=>createInstalledInsightsRuntime({canonicalPorts,monitoring,python:path.resolve(process.cwd(),'.insights-python/bin/python')}))
    .catch(error=>{runtime=undefined;throw error})
  return runtime
}
/** Use SG2's admitted public ingress boundary; forwarded headers grant no authority.
 * Keep the original business body for the report API; the shared identity adapter
 * intentionally returns only a header request. */
export function normalizeInsightsReportRequest(request:Request,publicOrigins:readonly string[]):Request|null{
  const normalized=createPublicIdentityRequestBoundary({publicOrigins:[...publicOrigins],
    internalOrigins:['http://0.0.0.0:10000','https://0.0.0.0:10000','http://localhost:10000','https://localhost:10000']})(request)
  if(!normalized)return null
  return new Request(normalized.url,{method:request.method,headers:normalized.headers,signal:request.signal,
    ...(request.body?{body:request.body,duplex:'half' as const}:{})})
}
export async function insightsReportHttp(request:Request):Promise<Response>{
  if(process.env.INSIGHTS_REPORTS_ENABLED!=='true') return Response.json({error:{code:'INSIGHTS_NOT_ENABLED'}},{status:503,headers:{'cache-control':'private, no-store'}})
  try{
    const identity=readSg2IdentityRuntime()
    if(identity.provider!=='clerk')throw Error('CURRENT_E1_IDENTITY_REQUIRED')
    const current=normalizeInsightsReportRequest(request,identity.application.authorizedParties)
    if(!current)return Response.json({error:{code:'ACCESS_DENIED'}},{status:403,headers:{'cache-control':'private, no-store'}})
    return await(await getInsightsRuntime()).api(current)
  }
  catch {return Response.json({error:{code:'INSIGHTS_NOT_ADMITTED'}},{status:503,headers:{'cache-control':'private, no-store'}})}
}
