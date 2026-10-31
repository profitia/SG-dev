import {createXRayWorkflowTransport,xrayOperation,readXRayJson} from '@profitia/srm-xray/workflow-contract';
import {PRESENTATION_ROUTES,XRAY_PRESENTATION_REQUEST_BYTES,validatePresentationCommand,type PresentationOperation} from '@profitia/srm-xray/full-report-operations';
import {createAppShellXRayTransport} from './xray-transport';
/** Fixed same-origin commands only. No upstream, actor or organisation can be
 * selected by browser input. Existing FRESH transport is composed unchanged. */
export function createAppShellFullXRayTransport(getCredential:()=>Promise<string|null>,send:typeof fetch=fetch):typeof fetch{
 const workflow=createXRayWorkflowTransport(createAppShellXRayTransport(getCredential,send));
 return async(input,init)=>{
  if(typeof input!=='string'||!input.startsWith('/')||input.startsWith('//'))throw Error('XRAY_REQUEST_INVALID');
  if(xrayOperation(input))return workflow(input,init);
  const url=new URL(input,'https://dev-sg2.spendguru.app'),method=init?.method??'GET';
  let operation:PresentationOperation|undefined,command:unknown;
  if(url.pathname==='/api/supplier-locations'&&method==='GET'){
   if([...url.searchParams.keys()].join(',')!=='supplierId'||url.hash)throw Error('XRAY_REQUEST_INVALID');
   operation='mapReadiness';command={supplierId:url.searchParams.get('supplierId')};
  }else{
   if(url.search||url.hash)throw Error('XRAY_REQUEST_INVALID');
   operation=(Object.keys(PRESENTATION_ROUTES) as PresentationOperation[]).find(k=>k!=='mapReadiness'&&PRESENTATION_ROUTES[k].native===url.pathname&&PRESENTATION_ROUTES[k].method===method);
   if(!operation)throw Error('XRAY_REQUEST_INVALID');
   command=method==='GET'?{}:typeof init?.body==='string'?JSON.parse(init.body):null;
  }
  validatePresentationCommand(operation,command);
  const body=JSON.stringify(command);if(new TextEncoder().encode(body).length>XRAY_PRESENTATION_REQUEST_BYTES)throw Error('XRAY_REQUEST_INVALID');
  const supplied=new Headers(init?.headers).get('idempotency-key'),key=supplied??crypto.randomUUID();
  if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(key))throw Error('XRAY_REQUEST_INVALID');
  init?.signal?.throwIfAborted();const credential=await getCredential();init?.signal?.throwIfAborted();
  if(!credential||!/^\S{1,16384}$/.test(credential))throw Error('XRAY_SESSION_REQUIRED');
  return send('/api/appshell/xray/presentation/'+operation,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json','idempotency-key':key},body,signal:init?.signal,cache:'no-store',credentials:'omit',redirect:'error'});
 };
}

/** Existing registered Development Maps host; no browser-selected origin. */
export const XRAY_MAP_RUNTIME_ORIGIN='https://profitia-maps-development-runtime.onrender.com';
export const loadXRayMap=()=>import('@profitia/maps-embed').then(module=>module.mountMaps);
