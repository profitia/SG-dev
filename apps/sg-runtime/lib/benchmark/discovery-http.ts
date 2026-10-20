import {readPresentationJson} from '@profitia/platform-contracts/embedded-read-channel'
import {discoveryUuid,readDiscoveryCommand,type DiscoveryCommand} from './discovery-operation'
import {discoveryFailure,type DiscoveryApi} from './discovery-api'

export type DiscoveryRuntime=Readonly<{provider:'legacy_demo'}|{provider:'clerk';defaultOrganisationId:string;benchmarkDiscovery?:()=>Promise<DiscoveryApi>}>
type Method='GET'|'POST'
type Legacy=(request:Request,context?:{params:{metadataKey:string}})=>Promise<Response>
const paths={SEARCH:'/api/benchmark/search',METADATA:'/api/benchmark/metadata',CONTEXT:'/api/benchmark/context',AI_SEARCH:'/api/benchmark/ai-search'} as const
const invalid=()=>discoveryFailure(400,'VALIDATION_ERROR','Invalid Finder request')
const number=(text:string|null)=>text===null?undefined:/^[1-9][0-9]{0,2}$/.test(text)?Number(text):NaN
export function parseDiscoveryGet(url:URL,kind:'SEARCH'|'METADATA'|'METADATA_VALUES'):Readonly<DiscoveryCommand>{
 if(kind==='SEARCH')return readDiscoveryCommand({kind,query:url.searchParams.get('q')??undefined,limit:number(url.searchParams.get('limit'))??8})
 if(kind==='METADATA')return readDiscoveryCommand({kind})
 const match=/^\/api\/benchmark\/metadata\/([^/]+)\/values$/.exec(url.pathname)
 if(!match)throw TypeError('Exact metadata path required')
 return readDiscoveryCommand({kind,metadataKey:decodeURIComponent(match[1]),filters:JSON.parse(url.searchParams.get('filters')??'[]'),
  ...(url.searchParams.has('q')?{query:url.searchParams.get('q')!}:{}),...(url.searchParams.has('limit')?{limit:number(url.searchParams.get('limit'))}:{})})
}
/** Only an explicit server demo profile can reach the old handler. Invalid or
 * incomplete individual configuration never falls back to demo auth/storage. */
export function createDiscoveryHttpHandler(kind:DiscoveryCommand['kind'],method:Method,resolveRuntime:()=>DiscoveryRuntime,legacy:Legacy){
 if((kind==='SEARCH'?!['GET','POST'].includes(method):method!==(kind==='METADATA'||kind==='METADATA_VALUES'?'GET':'POST'))||typeof legacy!=='function')throw TypeError('Exact Finder method required')
 return async(request:Request,context?:{params:{metadataKey:string}}):Promise<Response>=>{
  if(request.method!==method)return discoveryFailure(405,'METHOD_NOT_ALLOWED','Method not allowed')
  let url:URL
  try{url=new URL(request.url)}catch{return invalid()}
  const expected=kind==='METADATA_VALUES'?/^\/api\/benchmark\/metadata\/[^/]+\/values$/.test(url.pathname):url.pathname===paths[kind]
  if(!expected||url.href.length>24000||url.hash)return invalid()
  try{
   const runtime=resolveRuntime()
   if(runtime.provider==='legacy_demo')return await legacy(request,context)
   if(runtime.provider!=='clerk'||!runtime.benchmarkDiscovery)return discoveryFailure()
   // These GETs can purchase provider work. A browser automatically sending a
   // cookie is insufficient: the official session credential is required for
   // all six methods and is still independently verified by the backend SDK.
   if(!/^Bearer [^\s,]{1,8192}$/.test(request.headers.get('authorization')??''))return discoveryFailure(401)
   const allowed=kind==='SEARCH'&&method==='GET'?['q','limit','organisationId']:kind==='METADATA_VALUES'?['filters','q','limit','organisationId']:['organisationId']
   if([...url.searchParams.keys()].some(k=>!allowed.includes(k)||url.searchParams.getAll(k).length!==1))return invalid()
   const org=url.searchParams.get('organisationId')??runtime.defaultOrganisationId
   const key=request.headers.get('x-profitia-idempotency-key')
   if(!discoveryUuid.test(org)||!key||!/^finder_[A-Za-z0-9_-]{16,100}$/.test(key))return invalid()
   if(kind==='METADATA_VALUES'){
    const segment=decodeURIComponent(url.pathname.split('/')[4])
    if(context?.params.metadataKey!==undefined&&context.params.metadataKey!==segment)return invalid()
   }
   // Authentication uses the same URL/method/headers and cancellation signal.
   // Do not tee an untrusted body: cancelling an oversized tee can wait for
   // the unread branch indefinitely. The body has no identity authority.
   const authenticatedRequest=new Request(request.url,{method:request.method,headers:request.headers,signal:request.signal})
   let command:Readonly<DiscoveryCommand>
   try{
    if(method==='GET')command=parseDiscoveryGet(url,kind as 'SEARCH'|'METADATA'|'METADATA_VALUES')
    else{
     if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return invalid()
     const value=await readPresentationJson(new Response(request.body,{headers:request.headers}),16384)
     if(!value||typeof value!=='object'||Array.isArray(value)||Object.hasOwn(value,'kind'))return invalid()
     command=readDiscoveryCommand({...value,kind})
    }
   }catch{return invalid()}
   return await(await runtime.benchmarkDiscovery()).execute(authenticatedRequest,org,command,key)
  }catch{return discoveryFailure()}
 }
}
