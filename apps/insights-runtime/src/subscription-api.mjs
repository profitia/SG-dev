import {ReportError,OPERATIONS,requireThat} from '@profitia/insights-contracts';
import {isOperationDenied} from '@profitia/platform-contracts/operation-context';
import {SUBSCRIPTION_CONTRACT} from './subscriptions.mjs';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const respond=(v,status=200)=>Response.json(v,{status,headers:{'cache-control':'private, no-store',vary:'Authorization'}});
export function createSubscriptionApi({authority,store,profiles,onOrder}){
 requireThat(authority&&typeof authority.execute==='function'&&store&&typeof profiles==='function'&&typeof onOrder==='function','INSTALLED_SUBSCRIPTION_HOST_REQUIRED',503);
 return async request=>{try{
  const u=new URL(request.url),prefix='/api/v1/insights/subscriptions',parts=u.pathname.slice(prefix.length).split('/').filter(Boolean);
  requireThat(u.pathname===prefix||u.pathname.startsWith(prefix+'/'),'NOT_FOUND',404);
  requireThat(/^Bearer [^\s]{1,8192}$/.test(request.headers.get('authorization')??'')&&!request.headers.has('cookie'),'AUTHENTICATION_REQUIRED',401);
  requireThat([...u.searchParams.keys()].every(x=>['limit','cursor'].includes(x))&&[...new Set(u.searchParams.keys())].every(x=>u.searchParams.getAll(x).length===1),'INVALID_QUERY',400);
  const pagination={limit:u.searchParams.has('limit')?Number(u.searchParams.get('limit')):50,cursor:u.searchParams.get('cursor')};
  const write=request.method!=='GET';requireThat(!write||!u.search,'INVALID_QUERY',400);
  const edition=parts[0]==='editions';if(edition)requireThat(request.method==='GET'&&(parts.length===1||uuid.test(parts[1]??'')&&(parts.length===2||parts.length===3&&parts[2]==='pdf')),'NOT_FOUND',404);
  const operation=edition&&parts[1]?(parts[2]==='pdf'?OPERATIONS.download:OPERATIONS.status):write?OPERATIONS.start:OPERATIONS.list;
  return await authority.execute({request,operation,resourceId:edition&&parts[1]?parts[1]:'oil-asphalt'},async ctx=>{try{return await store.withSavepoint(ctx,async()=>{
   const catalog=profiles();
   if(request.method==='GET'&&parts.length===1&&parts[0]==='workspace'){
    requireThat(!u.search,'INVALID_QUERY',400);return respond({contractVersion:SUBSCRIPTION_CONTRACT,catalog,orders:await store.list(ctx),editions:await store.publishedList(ctx)});
   }
   if(edition){
    if(parts.length===1)return respond(await store.publishedList(ctx,pagination));
    requireThat(!u.search,'INVALID_QUERY',400);const value=await store.published(ctx,parts[1],{pdf:parts[2]==='pdf'});
    if(parts[2]==='pdf')return new Response(value.bytes,{headers:{'content-type':'application/pdf','content-disposition':'attachment; filename="insights-'+parts[1]+'.pdf"','cache-control':'private, no-store',vary:'Authorization',etag:'"'+value.pdfSha256+'"','x-report-publication':'PUBLISHED'}});
    return respond(value);
   }
   if(request.method==='GET'&&parts.length===1&&parts[0]==='catalog')return respond({contractVersion:SUBSCRIPTION_CONTRACT,items:catalog});
   if(parts[0]==='notifications'){
    if(parts.length===1&&request.method==='GET')return respond(await store.inbox(ctx,pagination));
    if(parts.length===2&&uuid.test(parts[1])&&request.method==='PATCH')return respond(await store.markRead(ctx,parts[1]));
    requireThat(false,'NOT_FOUND',404);
   }
   if(request.method==='GET'&&!parts.length)return respond(await store.list(ctx,pagination));
   if(parts.length&&uuid.test(parts[0])){
    if(request.method==='GET'&&parts.length===1)return respond(await store.get(ctx,parts[0]));
    if(request.method==='GET'&&parts.length===2&&parts[1]==='runs')return respond(await store.runs(ctx,parts[0],pagination));
   }
   requireThat(request.method==='POST'&&!parts.length||request.method==='PATCH'&&parts.length===1&&uuid.test(parts[0]),'NOT_FOUND',404);
   requireThat(request.headers.get('content-type')==='application/json'&&!request.headers.has('content-encoding'),'INVALID_CONTENT_TYPE',415);
   const reader=request.body?.getReader();requireThat(reader,'INVALID_JSON',400);let size=0;const chunks=[];
   try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;requireThat(size<=16384,'REQUEST_TOO_LARGE',413);chunks.push(part.value);}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
   const input=JSON.parse(Buffer.concat(chunks).toString());
   if(request.method==='PATCH'&&input&&Object.keys(input).sort().join(',')==='contractVersion,status,version'&&input.contractVersion===SUBSCRIPTION_CONTRACT){
    if(input.status==='ACTIVE'){const old=await store.get(ctx,parts[0]);requireThat(catalog.some(p=>p.definitionId===old.definitionId&&p.profileVersion===old.profileVersion),'PROFILE_NOT_AVAILABLE',409);}
    return respond(await store.setStatus(ctx,parts[0],input));
   }
   const profile=catalog.find(x=>x.definitionId===input?.definitionId&&x.profileVersion===input?.profileVersion);requireThat(profile,'PROFILE_NOT_AVAILABLE',409);
   if(request.method==='PATCH')return respond(await store.update(ctx,parts[0],input,profile));
   const order=await store.create(ctx,input,profile,request.headers.get('idempotency-key'));
   if(order.schedule===null&&order.executionState==='WAITING_AUTHORIZATION'){
    const job=await onOrder(ctx,order);return respond(await store.linkJob(ctx,order,job),201);
   }
   return respond(order,201);
  });}catch(error){if(error instanceof ReportError||error instanceof SyntaxError)return respond({error:{code:error instanceof SyntaxError?'INVALID_JSON':error.code}},error instanceof SyntaxError?400:error.status);throw error;}});
 }catch(error){if(isOperationDenied(error)){const unavailable=['POLICY_UNAVAILABLE','AUDIT_UNAVAILABLE'].includes(error.reasonCode);return respond({error:{code:unavailable?'AUTHORITY_UNAVAILABLE':'ACCESS_DENIED'}},unavailable?503:403);}return respond({error:{code:error instanceof SyntaxError?'INVALID_JSON':error instanceof ReportError?error.code:'SUBSCRIPTIONS_UNAVAILABLE'}},error instanceof SyntaxError?400:error instanceof ReportError?error.status:503);}};
}
