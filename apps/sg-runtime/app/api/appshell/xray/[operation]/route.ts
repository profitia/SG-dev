import {createXRayGateway} from '@/lib/platform/xray-gateway';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const gateway=createXRayGateway();
export const POST=(request:Request,context:{params:{operation:string}})=>gateway(request,context.params.operation);
