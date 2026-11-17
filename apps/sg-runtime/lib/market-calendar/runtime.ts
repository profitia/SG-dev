import {createPublicIdentityRequestBoundary} from '@profitia/platform-contracts/public-request'
const ORIGIN='https://economic-calendar-runtime-development.onrender.com'
const publicOrigin='https://dev-sg2.spendguru.app'
const json=(code:string,status:number)=>Response.json({error:{code}},{status,headers:{'cache-control':'private, no-store',vary:'Authorization'}})
/** A bounded consumer relay. ECR verifies the original human bearer and owns
 * current E1, licence, audit and private user scope. No consumer identity store. */
export function createCalendarProxy({organisationId,fetcher=fetch}:{organisationId:string;fetcher?:typeof fetch}){
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(organisationId))throw Error('SERVER_ORGANISATION_REQUIRED')
 const boundary=createPublicIdentityRequestBoundary({publicOrigins:[publicOrigin],internalOrigins:['http://0.0.0.0:10000','https://0.0.0.0:10000','http://localhost:10000','https://localhost:10000']})
 return async(request:Request):Promise<Response>=>{
  const normalized=boundary(request);if(!normalized)return json('INVALID_ORIGIN',403)
  const input=new URL(normalized.url),prefix='/api/v1/market-calendar/',suffix=input.pathname.slice(prefix.length)
  if(input.origin!==publicOrigin||!input.pathname.startsWith(prefix)||! /^(?:(?:events|publications|evidence)\/(?:ecr_evt_|ecr_pub_)[a-f0-9]{64}(?:\/revisions)?|query|events|publications|timeline|context|knowledge|freshness|preferences|favourites|notifications)$/.test(suffix))return json('NOT_FOUND',404)
  if(request.method!=='GET'&&!(request.method==='PUT'&&['preferences','notifications'].includes(suffix)))return json('METHOD_NOT_ALLOWED',405)
  const bearer=normalized.headers.get('authorization')
  if(normalized.headers.has('cookie')||!/^Bearer [^\s]{1,8192}$/.test(bearer??''))return json('AUTHENTICATION_REQUIRED',401)
  if(normalized.headers.has('content-encoding'))return json('UNSUPPORTED_CONTENT_ENCODING',415)
  if(['userId','organisationId','organizationId','actorId'].some(k=>input.searchParams.has(k)))return json('CLAIMED_IDENTITY_REFUSED',400)
  const parts:Uint8Array[]=[];let length=0
  if(request.body){const reader=request.body.getReader();try{for(;;){const r=await reader.read();if(r.done)break;length+=r.value.byteLength;if(length>70000)return json('REQUEST_TOO_LARGE',413);parts.push(r.value)}}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}}
  if(request.method==='GET'&&length)return json('BODY_NOT_ALLOWED',400)
  const headers=new Headers({authorization:bearer!});if(request.method==='PUT')headers.set('content-type',request.headers.get('content-type')??'')
  try{
   const upstream=await fetcher(ORIGIN+'/v1/organisations/'+organisationId+'/calendar/'+suffix+input.search,{method:request.method,headers,body:parts.length?Buffer.concat(parts):null,redirect:'error',cache:'no-store',credentials:'omit',signal:AbortSignal.any([request.signal,AbortSignal.timeout(25000)])})
   if(upstream.redirected||upstream.url&&new URL(upstream.url).origin!==ORIGIN||upstream.headers.has('set-cookie')||upstream.headers.get('content-type')?.split(';')[0].trim()!=='application/json'||!['no-store','private, no-store'].includes(upstream.headers.get('cache-control')??'')){await upstream.body?.cancel();return json('CALENDAR_UNAVAILABLE',503)}
   const reader=upstream.body?.getReader();if(!reader)return json('CALENDAR_UNAVAILABLE',503)
   const chunks:Uint8Array[]=[];let bytes=0
   try{for(;;){const r=await reader.read();if(r.done)break;bytes+=r.value.byteLength;if(bytes>2*1024*1024)return json('CALENDAR_RESPONSE_TOO_LARGE',502);chunks.push(r.value)}}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
   return new Response(Buffer.concat(chunks),{status:upstream.status,headers:{'content-type':'application/json','cache-control':'private, no-store',vary:'Authorization'}})
  }catch{return json(request.signal.aborted?'REQUEST_CANCELLED':'CALENDAR_UNAVAILABLE',request.signal.aborted?499:503)}
 }
}
