import {createXRayPresentationGateway} from '@/lib/platform/xray-presentation-gateway';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const gateway=createXRayPresentationGateway();
export const POST=async(request:Request,context:{params:Promise<{operation:string}>|{operation:string}})=>gateway(request,(await context.params).operation);
