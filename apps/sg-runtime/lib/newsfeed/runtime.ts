import {createPublicIdentityRequestBoundary} from '@profitia/platform-contracts/public-request'
const ORIGIN='https://newsfeed-api-development.onrender.com'
const publicOrigin='https://dev-sg2.spendguru.app'
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const json=(code:string,status:number)=>Response.json({error:{code}},{status,headers:{'cache-control':'private, no-store',vary:'Authorization'}})
/** The backend owns current E1 and the real user. This host selects only its
 * accepted organisation; client headers/body cannot replace that binding. */
export function createNewsfeedProxy({organisationId,fetcher=fetch}:{organisationId:string;fetcher?:typeof fetch}){
 if(!uuid.test(organisationId))throw Error('SERVER_ORGANISATION_REQUIRED')
 const boundary=createPublicIdentityRequestBoundary({publicOrigins:[publicOrigin],internalOrigins:['http://0.0.0.0:10000','https://0.0.0.0:10000','http://localhost:10000','https://localhost:10000']})
 return async(request:Request):Promise<Response>=>{
  const normalized=boundary(request);if(!normalized)return json('INVALID_ORIGIN',403)
  const current=new Request(normalized.url,{method:request.method,headers:normalized.headers,signal:request.signal,...(request.body?{body:request.body,duplex:'half' as const}:{})})
  const input=new URL(current.url),prefix='/api/v1/newsfeed',suffix=input.pathname.slice(prefix.length)
  if(input.origin!==publicOrigin||!input.pathname.startsWith(prefix+'/')||!/^\/(?:invitations|feed|(?:observations|notifications)(?:\/[a-f0-9-]{36}(?:\/(?:discover|publications|history|statistics|shares))?)?)$/.test(suffix))return json('NOT_FOUND',404)
  if(!['GET','POST','PATCH','DELETE'].includes(request.method))return json('METHOD_NOT_ALLOWED',405)
  const bearer=current.headers.get('authorization')
  if(current.headers.has('cookie')||!/^Bearer [^\s]{1,8192}$/.test(bearer??''))return json('AUTHENTICATION_REQUIRED',401)
  if(current.headers.get('origin')&&current.headers.get('origin')!==publicOrigin)return json('INVALID_ORIGIN',403)
  if(current.headers.has('content-encoding'))return json('UNSUPPORTED_CONTENT_ENCODING',415)
  const parts:Uint8Array[]=[];let length=0
  if(current.body){const reader=current.body.getReader();try{for(;;){const part=await reader.read();if(part.done)break;length+=part.value.byteLength;if(length>16384)return json('REQUEST_TOO_LARGE',413);parts.push(part.value)}}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}}
  const body=parts.length?Buffer.concat(parts):null
  const headers=new Headers({authorization:bearer!,'x-profitia-organisation-id':organisationId})
  for(const name of ['content-type','idempotency-key']){const value=current.headers.get(name);if(value)headers.set(name,value)}
  try{
   const upstream=await fetcher(ORIGIN+'/v1.2'+suffix+input.search,{method:request.method,headers,body,redirect:'error',cache:'no-store',credentials:'omit',signal:AbortSignal.any([request.signal,AbortSignal.timeout(25000)])})
   const reader=upstream.body?.getReader();if(!reader)return json('NEWSFEED_UNAVAILABLE',503)
   const chunks:Uint8Array[]=[];let bytes=0
   try{for(;;){const value=await reader.read();if(value.done)break;bytes+=value.value.byteLength;if(bytes>2097152)return json('NEWSFEED_RESPONSE_TOO_LARGE',502);chunks.push(value.value)}}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
   const responseBody=Buffer.concat(chunks)
   if(upstream.headers.get('content-type')?.split(';')[0]!=='application/json')return json('NEWSFEED_UNAVAILABLE',503)
   // Never forward upstream cookies, redirects, cache or diagnostic headers.
   return new Response(responseBody,{status:upstream.status,headers:{'content-type':'application/json','cache-control':'private, no-store',vary:'Authorization'}})
  }catch{return json(request.signal.aborted?'REQUEST_CANCELLED':'NEWSFEED_UNAVAILABLE',request.signal.aborted?499:503)}
 }
}
