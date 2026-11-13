import {organisationBootstrapRuntime} from '../../../../src/server/organisation-bootstrap'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(){try{const gateway=await organisationBootstrapRuntime();if(!gateway)throw Error();await gateway.ready();return Response.json({ready:true},{headers:{'cache-control':'private, no-store'}})}catch{return Response.json({ready:false},{status:503,headers:{'cache-control':'private, no-store'}})}}
