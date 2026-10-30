import {createPeerOperationVerifier,PEER_OPERATION_HEADER,peerOperationAttribution,type PeerOperationConfiguration} from '@profitia/platform-contracts/peer-operation';
import {XRAY_OPERATIONS,XRAY_WORKFLOW_CONTRACT,XRAY_REQUEST_BYTES,readXRayJson,validateXRayCommand,validateXRayData,xrayOperation,type XRayOperation} from '@profitia/srm-xray/workflow-contract';
import targets from '../../deployment/private-runtime-targets.json';

const deployment=targets.environments.development;
export const SRM_XRAY_PEER_VERSION='1.0.0';
export function readSrmPeerXRayConfiguration(env:Readonly<Record<string,string|undefined>>=process.env):PeerOperationConfiguration|null {
 if(env.PROFITIA_XRAY_PEER_VERSION===undefined)return null;
 if(env.PROFITIA_XRAY_PEER_VERSION!==SRM_XRAY_PEER_VERSION||env.TARGET_ENVIRONMENT!=='development'||env.PROFITIA_AUTH_PROVIDER!=='clerk'||env.RENDER_SERVICE_ID!==deployment.serviceId)throw Error('XRAY_PEER_UNAVAILABLE');
 const key=env.PROFITIA_XRAY_PEER_KEY,keyId=env.PROFITIA_XRAY_PEER_KEY_ID;
 if(!key||!/^[A-Za-z0-9_-]{43,86}$/.test(key)||!keyId||Buffer.from(key,'base64url').toString('base64url')!==key||key===env.SRM_DEMO_SESSION_SECRET||key===env.PROFITIA_CLERK_SECRET_KEY)throw Error('XRAY_PEER_UNAVAILABLE');
 return {environment:'development',callerApplicationId:'spendguru',receiverApplicationId:'srm',sourceOrigin:deployment.summaryPeerRead.sourceOrigin,targetOrigin:deployment.summaryPeerRead.targetOrigin,
 keyId,key:new Uint8Array(Buffer.from(key,'base64url')),routes:Object.values(XRAY_OPERATIONS).map(path=>({method:'POST',path,maximumRequestBytes:XRAY_REQUEST_BYTES,requireIdempotencyKey:true})),
 internalOrigins:['http://0.0.0.0:10000','https://0.0.0.0:10000']};
}
const privateHeaders={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization','X-Content-Type-Options':'nosniff'};
function peerFailure(operation:XRayOperation,requestId:string,status:number,code:string):Response {
 return Response.json({contract:XRAY_WORKFLOW_CONTRACT,operation,requestId,error:{code}},{status,headers:privateHeaders});
}
/** Only verified exact requests enter normal SRM handlers. This is never an
 * executor, permission grant, provider adapter or alternate identity runtime. */
export function withSrmPeerXRay(handler:(request:Request)=>Promise<Response>,environment:Readonly<Record<string,string|undefined>>=process.env){
 return async(request:Request):Promise<Response>=>{
  if(!request.headers.has(PEER_OPERATION_HEADER))return handler(request);
  const started=performance.now();
  const operation=xrayOperation(new URL(request.url).pathname),requestId=crypto.randomUUID();
  if(!operation)return Response.json({error:'Forbidden'},{status:403,headers:privateHeaders});
  let configuration:PeerOperationConfiguration|null;
  try{configuration=readSrmPeerXRayConfiguration(environment);}catch{return peerFailure(operation,requestId,503,'XRAY_UNAVAILABLE');}
  if(!configuration)return peerFailure(operation,requestId,503,'XRAY_UNAVAILABLE');
  if(!await createPeerOperationVerifier(configuration)(request))return peerFailure(operation,requestId,403,'XRAY_ACCESS_DENIED');
  const verified=performance.now();
  const attribution=peerOperationAttribution(request)!;
  try{validateXRayCommand(operation,await readXRayJson(new Response(request.clone().body,{headers:{'content-type':'application/json'}}),XRAY_REQUEST_BYTES,request.signal));}
  catch{return peerFailure(operation,attribution.requestId,400,'XRAY_REQUEST_INVALID');}
  const commandValidated=performance.now(),timings:Record<string,number>={verifyMs:verified-started,commandMs:commandValidated-verified};
  let nativeTraceId:string|undefined;
  try{
   const response=await handler(request);
   timings.handlerMs=performance.now()-commandValidated;
   if(!response.ok)return peerFailure(operation,attribution.requestId,[400,401,403,404,409,422,429,503,504].includes(response.status)?response.status:502,
    response.status===401?'XRAY_SESSION_REQUIRED':response.status===403?'XRAY_ACCESS_DENIED':response.status===404?(operation==='search'?'XRAY_NOT_FOUND':'XRAY_REPORT_UNAVAILABLE'):response.status===429?'XRAY_LIMIT_REACHED':response.status===409?'XRAY_CONFLICT':'XRAY_UNAVAILABLE');
   let phase=performance.now();
   const data=await readXRayJson(response,undefined,request.signal);timings.readMs=performance.now()-phase;
   phase=performance.now();validateXRayData(operation,data);timings.validateMs=performance.now()-phase;
   const headers=new Headers(privateHeaders);headers.set('X-Profitia-Correlation-Id',attribution.requestId);
   const nativeRequestId=response.headers.get('X-SRM-Request-Id');if(nativeRequestId&&/^[a-f0-9-]{36}$/.test(nativeRequestId)){headers.set('X-SRM-Request-Id',nativeRequestId);nativeTraceId=nativeRequestId;}
   const mode=response.headers.get('X-SRM-KYS-Mode');if(mode&&['PROVIDER','CACHE','FOLLOWER'].includes(mode))headers.set('X-SRM-KYS-Mode',mode);
   // Correlation is caller proof only; the ordinary current HUMAN audit remains the effect owner.
   phase=performance.now();const result=Response.json({contract:XRAY_WORKFLOW_CONTRACT,operation,requestId:attribution.requestId,data},{status:response.status,headers});
   timings.serializeMs=performance.now()-phase;return result;
  }catch{return peerFailure(operation,attribution.requestId,502,'XRAY_RESPONSE_INVALID');}
  finally{
   // Numeric boundary timings only; no proof, token, identity or report data.
   // A broken logger must never change a committed business response.
   try{console.info(JSON.stringify({event:'srm_xray_peer_timing',operation,requestId:attribution.requestId,...(nativeTraceId?{nativeTraceId}:{}),
    ...Object.fromEntries(Object.entries({...timings,totalMs:performance.now()-started}).map(([k,v])=>[k,Math.round(v*1000)/1000]))}));}catch{}
  }
 };
}
