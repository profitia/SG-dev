import {organisationBootstrapRuntime} from '../../../../src/server/organisation-bootstrap'
export const runtime='nodejs'
export const dynamic='force-dynamic'
const unavailable=()=>Response.json({status:'UNAVAILABLE'},{status:503,headers:{'cache-control':'private, no-store','referrer-policy':'no-referrer'}})
export async function POST(request:Request){try{const gateway=await organisationBootstrapRuntime();return gateway?gateway.handle(request):unavailable()}catch{return unavailable()}}
export const GET=()=>Response.json({status:'UNAVAILABLE'},{status:405,headers:{'cache-control':'private, no-store'}})
