import {createPeerOperationSigner} from '@profitia/platform-contracts/peer-operation';
import {createPublicIdentityRequestBoundary} from '@profitia/platform-contracts/public-request';
import {readXRayJson} from '@profitia/srm-xray/workflow-contract';
import {PRESENTATION_ROUTES,XRAY_PRESENTATION_CONTRACT,XRAY_PRESENTATION_REQUEST_BYTES,validatePresentationCommand,validatePresentationResult,readPresentationBytes,type PresentationOperation} from '@profitia/srm-xray/full-report-operations';
import {readAppShellXRayConfiguration} from './xray-gateway';
const headers={'Cache-Control':'private, no-store',Vary:'Authorization, Origin','X-Content-Type-Options':'nosniff'};
/** Signed presentation adapter, never a financial backend or E1 executor.
 * Original SRM handlers own current HUMAN admission and final disclosure. */
export function createXRayPresentationGateway({env=process.env,transport=fetch,now=Date.now}:{env?:Readonly<Record<string,string|undefined>>;transport?:typeof fetch;now?:()=>number}={}){
 return async(request:Request,name:string):Promise<Response>=>{
  const fail=(status:number,error='XRAY_UNAVAILABLE')=>Response.json({error},{status,headers});
  if(!Object.hasOwn(PRESENTATION_ROUTES,name))return fail(404);
  const operation=name as PresentationOperation,route=PRESENTATION_ROUTES[operation];
  if(request.method!=='POST')return fail(405,'XRAY_REQUEST_INVALID');
  if(!/^Bearer [\x21-\x7e]{1,16384}$/.test(request.headers.get('authorization')??''))return fail(401,'XRAY_SESSION_REQUIRED');
  let config;try{config=readAppShellXRayConfiguration(env)}catch{return fail(503)}if(!config)return fail(503);
  const boundary=createPublicIdentityRequestBoundary({publicOrigins:[config.sourceOrigin],internalOrigins:['http://0.0.0.0:10000','https://0.0.0.0:10000','http://localhost:10000','https://localhost:10000']})(request);
  if(!boundary||boundary.headers.get('origin')!==config.sourceOrigin||request.headers.has('cookie')||new URL(boundary.url).pathname!=='/api/appshell/xray/presentation/'+name||new URL(boundary.url).search||new URL(boundary.url).hash)return fail(403,'XRAY_ACCESS_DENIED');
  const key=request.headers.get('idempotency-key');if(!key||!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(key))return fail(400,'XRAY_REQUEST_INVALID');
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(operation==='mapReadiness'?70000:55000)]);
  let command:unknown;try{command=await readXRayJson(new Response(request.body,{headers:{'content-type':request.headers.get('content-type')??''}}),XRAY_PRESENTATION_REQUEST_BYTES,signal);validatePresentationCommand(operation,command)}catch{return fail(400,'XRAY_REQUEST_INVALID')}
  try{
   // Preserve the existing private-operation caller boundary. This own-account
   // proof never substitutes for the native SRM HUMAN/E1 checks or grants ALLOW.
   const readAccount=async():Promise<{userId:string;expiresAt:string}|Response>=>{
    const response=await transport('https://identity-runtime-development.onrender.com/v1/account',{method:'GET',headers:{authorization:request.headers.get('authorization')!},credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(4000)])});
    if(!response.ok){void response.body?.cancel();return fail(response.status===401?401:response.status===403?403:503,response.status===401?'XRAY_SESSION_REQUIRED':response.status===403?'XRAY_ACCESS_DENIED':'XRAY_UNAVAILABLE')}
    const value=await readXRayJson(response,4096,signal) as Record<string,unknown>;
    if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).sort().join(',')!=='authenticated,expiresAt,userId')return fail(503,'XRAY_UNAVAILABLE');
    if(value.authenticated!==true||typeof value.userId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value.userId)||typeof value.expiresAt!=='string'||Date.parse(value.expiresAt)<=now()||!Number.isFinite(Date.parse(value.expiresAt)))return fail(401,'XRAY_SESSION_REQUIRED');
    return {userId:value.userId,expiresAt:value.expiresAt};
   };
   const current=await readAccount();if(current instanceof Response)return current;
   const correlation=crypto.randomUUID(),routes=Object.values(PRESENTATION_ROUTES).map(v=>({path:v.path,method:v.method,maximumRequestBytes:v.method==='GET'?0:XRAY_PRESENTATION_REQUEST_BYTES,requireIdempotencyKey:true}));
   const outgoing=await createPeerOperationSigner({...config,routes},{newRequestId:()=>correlation})(new Request(config.targetOrigin+route.path,{method:route.method,headers:{authorization:request.headers.get('authorization')!,'idempotency-key':key,...(route.method==='POST'?{'content-type':'application/json'}:{})},...(route.method==='POST'?{body:JSON.stringify(command)}:{}),signal}));
   const response=await transport(outgoing);
   if(response.redirected){void response.body?.cancel();return fail(502,'XRAY_RESPONSE_INVALID')}
   if(!response.ok){void response.body?.cancel();return fail([400,401,403,404,409,410,422,429,503,504].includes(response.status)?response.status:502,response.status===401?'XRAY_SESSION_REQUIRED':response.status===403?'XRAY_ACCESS_DENIED':'XRAY_UNAVAILABLE')}
   if(response.headers.get('X-SRM-XRay-Presentation')!==XRAY_PRESENTATION_CONTRACT||response.headers.get('X-Profitia-Correlation-Id')!==correlation){void response.body?.cancel();return fail(502,'XRAY_RESPONSE_INVALID')}
   const mime=response.headers.get('content-type')?.split(';')[0]??'',filename=response.headers.get('X-Download-Filename'),bytes=await readPresentationBytes(response,undefined,signal);
   validatePresentationResult(operation,bytes,mime,filename,command);signal.throwIfAborted();
   if(Date.parse(current.expiresAt)<=now()){
    const renewed=await readAccount();if(renewed instanceof Response)return renewed;
    if(renewed.userId!==current.userId)return fail(403,'XRAY_ACCESS_DENIED');
    if(signal.aborted||Date.parse(renewed.expiresAt)<=now())return fail(401,'XRAY_SESSION_REQUIRED');
   }
   const safe=new Headers(headers);safe.set('Content-Type',mime);safe.set('X-Profitia-Correlation-Id',correlation);if(filename){safe.set('X-Download-Filename',filename);safe.set('Content-Disposition',`attachment; filename="${filename}"`)}
   return new Response(new Uint8Array(bytes),{status:response.status,headers:safe});
  }catch{return fail(signal.aborted?504:502,signal.aborted?'XRAY_INTERRUPTED':'XRAY_RESPONSE_INVALID')}
 };
}
