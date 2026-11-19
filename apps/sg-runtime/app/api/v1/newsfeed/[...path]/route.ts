import {bindSg2RequestRuntime} from '@/lib/platform/organisation-context'
import * as Sentry from '@sentry/nextjs'
import {getSg2SelectionRuntime} from '@/lib/platform/private-runtime'
import {createNewsfeedProxy} from '@/lib/newsfeed/runtime'
export const runtime='nodejs'
export const dynamic='force-dynamic'
async function handle(request:Request){
 return Sentry.startSpan({name:'newsfeed.request',op:'http.newsfeed'},async()=>{
  try{const host=await bindSg2RequestRuntime(getSg2SelectionRuntime(),request);if(host.provider!=='clerk')throw Error('CURRENT_HOST_REQUIRED');return await createNewsfeedProxy({organisationId:host.defaultOrganisationId})(request)}
  catch{return Response.json({error:{code:'NEWSFEED_UNAVAILABLE'}},{status:503,headers:{'cache-control':'private, no-store'}})}
 })
}
export const GET=handle
export const POST=handle
export const PATCH=handle
export const DELETE=handle
