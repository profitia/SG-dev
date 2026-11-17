import * as Sentry from '@sentry/nextjs'
import {getSg2SelectionRuntime} from '@/lib/platform/private-runtime'
import {createCalendarProxy} from '@/lib/market-calendar/runtime'
export const runtime='nodejs'
export const dynamic='force-dynamic'
async function handle(request:Request){return Sentry.startSpan({name:'market-calendar.request',op:'http.ecr'},async()=>{
 try{const host=getSg2SelectionRuntime();if(host.provider!=='clerk')throw Error('CURRENT_HOST_REQUIRED');return await createCalendarProxy({organisationId:host.defaultOrganisationId})(request)}
 catch{return Response.json({error:{code:'CALENDAR_UNAVAILABLE'}},{status:503,headers:{'cache-control':'private, no-store'}})}
})}
export const GET=handle
export const PUT=handle
