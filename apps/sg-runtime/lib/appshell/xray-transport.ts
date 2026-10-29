import {xrayOperation,validateXRayCommand,XRAY_REQUEST_BYTES} from '@profitia/srm-xray/workflow-contract';
/** The browser can select only an approved logical operation, never an origin,
 * user, organisation, runtime URL or provider. Keys survive uncertain delivery. */
export function createAppShellXRayTransport(getCredential:()=>Promise<string|null>,send:typeof fetch=fetch):typeof fetch {
 return async(input,init)=>{
  const operation=typeof input==='string'?xrayOperation(input):null;
  if(!operation||init?.method!=='POST'||typeof init.body!=='string'||new TextEncoder().encode(init.body).length>XRAY_REQUEST_BYTES)throw Error('XRAY_REQUEST_INVALID');
  validateXRayCommand(operation,JSON.parse(init.body));
  const key=new Headers(init.headers).get('idempotency-key');if(!key||!/^[A-Za-z0-9_-]{24,128}$/.test(key))throw Error('XRAY_REQUEST_INVALID');
  if(init.signal?.aborted)throw Error('XRAY_INTERRUPTED');
  const started=performance.now();let credentialMs=0,gatewayMs=0,status=0,traceId:string|undefined;
  try{
   const credential=await getCredential();credentialMs=performance.now()-started;if(init.signal?.aborted)throw Error('XRAY_INTERRUPTED');
   if(!credential||!/^\S{1,16384}$/.test(credential))throw Error('XRAY_SESSION_REQUIRED');
   const sent=performance.now(),response=await send('/api/appshell/xray/'+operation,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json','idempotency-key':key},body:init.body,
    signal:init.signal,cache:'no-store',credentials:'omit',redirect:'error'});
   gatewayMs=performance.now()-sent;status=response.status;
   const correlation=response.headers.get('X-Profitia-Correlation-Id');if(correlation&&/^[a-f0-9-]{36}$/i.test(correlation))traceId=correlation;
   return response;
  }finally{if(operation==='search')try{console.info(JSON.stringify({event:'srm_appshell_client_request_timing',operation,httpStatus:status,credentialMs:Math.round(credentialMs*100)/100,gatewayMs:Math.round(gatewayMs*100)/100,totalMs:Math.round((performance.now()-started)*100)/100,...(traceId?{traceId}:{})}));}catch{}}

 };
}
