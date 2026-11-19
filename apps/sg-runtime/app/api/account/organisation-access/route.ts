import {renewOrganisationAccess} from '@/lib/platform/organisation-access'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export const POST=(request:Request)=>renewOrganisationAccess(request)
export const GET=()=>Promise.resolve(new Response(null,{status:405,headers:{Allow:'POST','cache-control':'no-store'}}))
export const PUT=GET
export const PATCH=GET
export const DELETE=GET
export const OPTIONS=GET
