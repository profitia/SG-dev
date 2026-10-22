import {readPresentationJson} from '@profitia/platform-contracts/embedded-read-channel';
import {validRequestIdempotencyKey} from '@profitia/platform-contracts/request-ledger';
import {isOperationDenied} from '@profitia/platform-contracts/operation-context';
import {isSameOriginRequest} from './request-origin';
import {createKrsNameSearch,type KrsNamePorts} from './krs-name-search';
import targets from '../../deployment/krs-name-pilot-targets.json';
export type KrsNameHttpRuntime=Readonly<{api:ReturnType<typeof createKrsNameSearch>;available(request:Request):Promise<boolean>}>;
export function createKrsNameHttpRuntime(ports:KrsNamePorts,available:KrsNameHttpRuntime['available']):KrsNameHttpRuntime{
  if(typeof window!=='undefined'||typeof available!=='function')throw Error('SERVER_ONLY');
  return Object.freeze({api:createKrsNameSearch(ports),available});
}
/** No live binding was accepted. A flag alone cannot turn test ports into production authority. */
export function getSrmKrsNameRuntime(env:Readonly<Record<string,string|undefined>>=process.env):KrsNameHttpRuntime|null{
  const enabled=env.SRM_KRS_NAME_SEARCH_ENABLED??'false';
  if(enabled==='false')return null;
  if(enabled!=='true'||env.TARGET_ENVIRONMENT!=='development'||targets.activationState!=='ACCEPTED')throw Error('KRS_PILOT_BINDING_UNAVAILABLE');
  throw Error('KRS_NATIVE_PRODUCER_CONSUMER_NOT_ACCEPTED');
}
const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'};
const unavailable=(status:number)=>Response.json({error:'Wyszukiwanie po nazwie jest obecnie niedostępne.'},{status,headers});
const closed=(v:unknown,key:string):v is Record<string,string>=>!!v&&Object.getPrototypeOf(v)===Object.prototype
  &&Object.keys(v).join(',')===key&&typeof (v as Record<string,unknown>)[key]==='string';
export function createKrsNameHttpHandler(action:'status'|'search'|'verify'|'lookup',getRuntime:()=>KrsNameHttpRuntime|null=getSrmKrsNameRuntime){
  return async(request:Request):Promise<Response>=>{
    if(request.method!==(action==='status'?'GET':'POST'))return unavailable(405);
    if(new URL(request.url).search)return unavailable(400);
    if(action!=='status'&&!isSameOriginRequest(request))return unavailable(403);
    try{
      const runtime=getRuntime();
      if(action==='status')return Response.json({enabled:runtime?await runtime.available(request):false},{headers});
      if(!runtime)return unavailable(503);
      if(!await runtime.available(request))return unavailable(403);
      if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json'||!request.body)return unavailable(400);
      const stream=request.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>(),{signal:AbortSignal.any([request.signal,AbortSignal.timeout(3000)])});
      let body:unknown;
      try{body=await readPresentationJson(new Response(stream,{headers:{'content-type':'application/json'}}),2048)}catch{return unavailable(400)}
      if(action==='search'){
        if(!closed(body,'query')||body.query.trim().length<2||body.query.length>150)return unavailable(400);
        return Response.json(await runtime.api.search(request,body.query),{headers});
      }
      if(action==='verify'){
        if(!closed(body,'krs')||!/^\d{10}$/.test(body.krs))return unavailable(400);
        return Response.json(await runtime.api.verify(request,body.krs),{headers});
      }
      const key=request.headers.get('idempotency-key');
      if(!closed(body,'selectionRef')||!/^KRS:[0-9]{10}:[a-f0-9]{64}$/.test(body.selectionRef)||!validRequestIdempotencyKey(key))return unavailable(400);
      return Response.json(await runtime.api.lookup(request,body.selectionRef,key!),{headers});
    }catch(error){
      const reason=isOperationDenied(error)?error.reasonCode:'POLICY_UNAVAILABLE';
      return unavailable(reason==='UNVERIFIED_IDENTITY'?401:['POLICY_UNAVAILABLE','AUDIT_UNAVAILABLE','LIMIT_POLICY_UNAVAILABLE','DELIVERY_UNCERTAIN'].includes(reason)?503:403);
    }
  };
}
