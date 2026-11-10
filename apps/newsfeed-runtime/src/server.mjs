import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {SourceHubError} from '../../../packages/platform-source-hub-contracts/index.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const safeError=error=>error instanceof SourceHubError?{status:error.status,code:error.code}:error?.name==='OperationDenied'?{status:403,code:'OPERATION_DENIED'}:{status:503,code:'SERVICE_UNAVAILABLE'};
export function createApplication({authorizer,repository,sourceHub,log=line=>process.stdout.write(line+'\n')}){
 async function dispatch(request){
  const u=new URL(request.url),parts=u.pathname.split('/').filter(Boolean);
  if(request.method==='GET'&&['/health','/live','/ready'].includes(u.pathname)){const ready=u.pathname!=='/ready'||await repository.ready()&&await authorizer.ready();return Response.json({service:'newsfeed-runtime',status:ready?'ok':'not_ready'},{status:ready?200:503});}
  if(u.pathname==='/v1/assistant-context'){
   if(authorizer.assistantReadEnabled!==true)throw new SourceHubError('NOT_FOUND',404);
   if(request.method!=='GET')throw new SourceHubError('METHOD_NOT_ALLOWED',405);
   if(request.headers.has('cookie')||request.headers.has('origin')||!/^Bearer [^\s]{1,8192}$/.test(request.headers.get('authorization')??''))throw new SourceHubError('BEARER_SESSION_REQUIRED',401);
   if([...u.searchParams.keys()].some(k=>!['observationId','supplierNip'].includes(k))||[...new Set(u.searchParams.keys())].some(k=>u.searchParams.getAll(k).length!==1))throw new SourceHubError('INVALID_QUERY');
   const selection={observationId:u.searchParams.get('observationId'),supplierNip:u.searchParams.get('supplierNip')};
   if(selection.observationId!==null&&!uuid.test(selection.observationId)||selection.supplierNip!==null&&!/^\d{10}$/.test(selection.supplierNip))throw new SourceHubError('INVALID_QUERY');
   const value=await authorizer.execute({request,organisationId:request.headers.get('x-profitia-organisation-id'),resourceId:selection.observationId??'newsfeed-observations',payload:selection,write:false},
    (context,transaction)=>repository.assistantContext(transaction,context,selection));
   return Response.json(value,{headers:{'cache-control':'private, no-store',vary:'Cookie, Authorization'}});
  }
  if(parts[0]!=='v1'||parts[1]!=='observations'||parts.length>4)throw new SourceHubError('NOT_FOUND',404);
  const id=parts[2];if(id&&!uuid.test(id))throw new SourceHubError('NOT_FOUND',404);
  if([...u.searchParams.keys()].some(k=>!['limit','cursor'].includes(k))||u.search&&!(request.method==='GET'&&parts.length===2))throw new SourceHubError('INVALID_QUERY');
  const args={request,organisationId:request.headers.get('x-profitia-organisation-id'),resourceId:id??'newsfeed-observations',write:request.method!=='GET'};
  const execute=action=>authorizer.execute(args,action);
  const json=async()=>{if(request.headers.get('content-type')!=='application/json')throw new SourceHubError('JSON_REQUIRED',415);return request.clone().json().catch(()=>{throw new SourceHubError('INVALID_JSON');});};
  if(parts.length===2){
   if(request.method==='POST')return Response.json(await execute(async(c,t)=>repository.create(t,c,await json())),{status:201});
   if(request.method==='GET')return Response.json(await execute((c,t)=>repository.list(t,c,{limit:u.searchParams.has('limit')?Number(u.searchParams.get('limit')):50,cursor:u.searchParams.get('cursor')})));
  }
  if(parts.length===3){
   if(request.method==='GET')return Response.json(await execute((c,t)=>repository.get(t,c,id)));
   if(request.method==='PATCH')return Response.json(await execute(async(c,t)=>repository.update(t,c,id,await json())));
   if(request.method==='DELETE')return Response.json(await execute((c,t)=>repository.remove(t,c,id)));
  }
  if(parts.length===4&&parts[3]==='history'&&request.method==='GET')return Response.json(await execute((c,t)=>repository.history(t,c,id)));
  if(parts.length===4&&parts[3]==='discover'&&request.method==='POST'){
   // No arbitrary query/body/user identifiers enter this operation. Filters and
   // ownership are read from the authorised persisted observation.
   if(!/^Bearer [\x21-\x7e]{1,16384}$/.test(request.headers.get('authorization')??''))throw new SourceHubError('BEARER_SESSION_REQUIRED',401);
   if((await request.clone().arrayBuffer()).byteLength!==0)throw new SourceHubError('DISCOVERY_BODY_NOT_ALLOWED');
   const started=await execute((c,t)=>repository.beginRun(t,c,id,request.headers.get('idempotency-key')));
   if(started.kind==='replay')return Response.json(started);
   try{
    const body=await sourceHub.acquire({request,command:started.observation.request,context:started,idempotencyKey:'newsfeed:'+started.id});
    return Response.json(await execute((c,t)=>repository.completeRun(t,c,started,body)));
   }catch(error){await execute((c,t)=>repository.failRun(t,c,started,safeError(error))).catch(()=>{});throw error;}
  }
  throw new SourceHubError('NOT_FOUND',404);
 }
 return Object.freeze({async handle(request){const requestId=randomUUID(),start=performance.now();let response,outcome='OK';try{response=await dispatch(request);}catch(error){const safe=safeError(error);outcome=safe.code;response=Response.json({error:{code:safe.code},requestId},{status:safe.status});}
  if(!response.headers.has('cache-control'))response.headers.set('cache-control','no-store');response.headers.set('x-request-id',requestId);
  try{log(JSON.stringify({event:'newsfeed_backend',requestId,service:'newsfeed-runtime',operation:request.method,outcome,status:response.status,durationMs:Math.max(0,Math.round(performance.now()-start))}));}catch{}return response;
 }});
}
export function createHttpServer(application,configuration){
 const server=createServer(async(req,res)=>{const controller=new AbortController();req.once('aborted',()=>controller.abort());res.once('close',()=>{if(!res.writableEnded)controller.abort();});try{
  const u=new URL(req.url??'/',configuration.publicOrigin);if(u.origin!==configuration.publicOrigin)throw new SourceHubError('INVALID_REQUEST');
  if(!['/health','/live','/ready'].includes(u.pathname)&&req.headers.host!==new URL(configuration.publicOrigin).host)throw new SourceHubError('INVALID_AUTHORITY');
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>16384)throw new SourceHubError('REQUEST_TOO_LARGE',413);chunks.push(chunk);}
  const headers=new Headers();for(const[k,v]of Object.entries(req.headers)){if(Array.isArray(v))throw new SourceHubError('INVALID_HEADERS');if(v!==undefined)headers.set(k,v);}
  const request=new Request(u,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method??'GET')?{body:Buffer.concat(chunks)}:{}),signal:controller.signal});
  const response=await application.handle(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(error){const safe=safeError(error);res.writeHead(safe.status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({error:{code:safe.code}}));}});
 server.requestTimeout=25000;server.headersTimeout=10000;server.keepAliveTimeout=5000;server.maxHeadersCount=40;return server;
}
