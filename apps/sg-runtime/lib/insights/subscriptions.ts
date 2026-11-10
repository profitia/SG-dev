import * as Sentry from '@sentry/nextjs'
import {getInsightsRuntime,normalizeInsightsReportRequest} from './autonomous-runtime'
import {readSg2IdentityRuntime} from '@/lib/platform/identity-runtime'
export async function reportSubscriptionsHttp(request:Request):Promise<Response>{
 if(process.env.INSIGHTS_REPORTS_ENABLED!=='true')return Response.json({error:{code:'INSIGHTS_NOT_ENABLED'}},{status:503,headers:{'cache-control':'private, no-store'}})
 return Sentry.startSpan({name:'insights.subscription',op:'insights.subscription'},async()=>{
  try{const identity=readSg2IdentityRuntime();if(identity.provider!=='clerk')throw Error('CURRENT_IDENTITY_REQUIRED');const current=normalizeInsightsReportRequest(request,identity.application.authorizedParties);if(!current)return Response.json({error:{code:'ACCESS_DENIED'}},{status:403,headers:{'cache-control':'private, no-store'}});return await(await getInsightsRuntime()).subscriptionsApi(current)}
  catch{return Response.json({error:{code:'SUBSCRIPTIONS_UNAVAILABLE'}},{status:503,headers:{'cache-control':'private, no-store'}})}
 })
}
