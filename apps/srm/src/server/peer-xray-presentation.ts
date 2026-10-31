import {createPeerOperationVerifier,peerOperationAttribution,PEER_OPERATION_HEADER} from '@profitia/platform-contracts/peer-operation';
import {readXRayJson} from '@profitia/srm-xray/workflow-contract';
import {PRESENTATION_ROUTES,XRAY_PRESENTATION_CONTRACT,XRAY_PRESENTATION_REQUEST_BYTES,presentationOperation,validatePresentationCommand,validatePresentationResult,readPresentationBytes,type PresentationOperation} from '@profitia/srm-xray/full-report-operations';
import {readSrmPeerXRayConfiguration} from './peer-xray';
const headers={'Cache-Control':'private, no-store',Vary:'Authorization','X-Content-Type-Options':'nosniff'};
export function presentationPeerRoutes(){return Object.values(PRESENTATION_ROUTES).map(v=>({path:v.path,method:v.method,maximumRequestBytes:v.method==='GET'?0:XRAY_PRESENTATION_REQUEST_BYTES,requireIdempotencyKey:true}))}
/** Transport admission only. The original request enters the existing native
 * SRM operation, preserving its current HUMAN/E1/RLS/audit checks. */
export function withSrmPresentationPeer(handler:(request:Request,operation:PresentationOperation)=>Promise<Response>,env:Readonly<Record<string,string|undefined>>=process.env){
 return async(request:Request):Promise<Response>=>{
  const fail=(status:number,error='XRAY_UNAVAILABLE')=>Response.json({error},{status,headers});
  const operation=presentationOperation(new URL(request.url).pathname);
  if(!operation||!request.headers.has(PEER_OPERATION_HEADER))return fail(403,'XRAY_ACCESS_DENIED');
  let base;try{base=readSrmPeerXRayConfiguration(env)}catch{return fail(503)}
  if(!base)return fail(503);
  if(!await createPeerOperationVerifier({...base,routes:presentationPeerRoutes()})(request))return fail(403,'XRAY_ACCESS_DENIED');
  const attribution=peerOperationAttribution(request)!;
  let command:unknown;
  try{command=request.method==='GET'?{}:await readXRayJson(new Response(request.clone().body,{headers:{'content-type':'application/json'}}),XRAY_PRESENTATION_REQUEST_BYTES,request.signal);validatePresentationCommand(operation,command)}catch{return fail(400,'XRAY_REQUEST_INVALID')}
  try{
   const response=await handler(request,operation);
   if(!response.ok){void response.body?.cancel();return fail([400,401,403,404,409,410,422,429,503,504].includes(response.status)?response.status:502,response.status===401?'XRAY_SESSION_REQUIRED':response.status===403?'XRAY_ACCESS_DENIED':'XRAY_UNAVAILABLE')}
   const bytes=await readPresentationBytes(response,undefined,request.signal),mime=response.headers.get('content-type')?.split(';')[0]??'',filename=response.headers.get('X-Download-Filename');
   validatePresentationResult(operation,bytes,mime,filename,command);
   const safe=new Headers(headers);safe.set('Content-Type',mime);safe.set('X-SRM-XRay-Presentation',XRAY_PRESENTATION_CONTRACT);safe.set('X-Profitia-Correlation-Id',attribution.requestId);
   if(filename){safe.set('X-Download-Filename',filename);safe.set('Content-Disposition',`attachment; filename="${filename}"`)}
   return new Response(new Uint8Array(bytes),{status:response.status,headers:safe});
  }catch{return fail(request.signal.aborted?504:502,'XRAY_RESPONSE_INVALID')}
 };
}
