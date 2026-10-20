import {lookup} from 'node:dns/promises'
import http from 'node:http'
import https from 'node:https'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
let ipaddr

// Reuses the original SRM public-network guard. This is transport, not actor,
// tenant, licence, budget or publication authority. Governed callers supply
// the existing Source host per hop; legacy direct callers remain explicit.
export const PUBLIC_WEB_TRANSPORT=Object.freeze({id:'profitia.public-web-http',version:'1.0.0',
 maximumResponseBytes:2000000,timeoutMs:8000,maximumRedirects:4})
export function isPublicAddress(address){
 try{ipaddr??=require('ipaddr.js');return ipaddr.process(address).range()==='unicast'}catch{return false}
}
export function publicUrl(value){
 const url=new URL(value)
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.port||!url.hostname.includes('.')
  ||/(?:^|\.)(?:localhost|local|internal|test|invalid)$/i.test(url.hostname))throw Error('UNSAFE_WEBSITE_URL')
 url.hash=''
 return url
}
export async function resolvePublicUrl(value,resolver=host=>lookup(host,{all:true,verbatim:true})){
 const url=publicUrl(value),addresses=await resolver(url.hostname.replace(/^\[|\]$/g,''))
 if(!addresses.length||addresses.some(entry=>!isPublicAddress(entry.address)))throw Error('UNSAFE_WEBSITE_ADDRESS')
 return {url,address:addresses[0]}
}
async function abortable(promise,signal){
 signal.throwIfAborted()
 let onAbort=()=>{}
 try{return await Promise.race([promise,new Promise((_,reject)=>{
  onAbort=()=>reject(Error('WEBSITE_TIMEOUT'));signal.addEventListener('abort',onAbort,{once:true})
 })])}finally{signal.removeEventListener('abort',onAbort)}
}
function limits(options){
 if(options.maxBytes!==undefined&&(!Number.isSafeInteger(options.maxBytes)||options.maxBytes<1))throw Error('WEBSITE_BODY_LIMIT')
 return {signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(8000)]):AbortSignal.timeout(8000),
  maxBytes:Math.min(options.maxBytes??1500000,2000000)}
}
/** @internal One socket hop. Only the canonical Source host may pass its
 * independently verified Development synthetic origin as the third argument.
 * The exported ordinary legacy facade never exposes that override. */
export async function publicWebHop(value,options={},syntheticOrigin){
 const {signal,maxBytes}=limits(options)
 const target=publicUrl(value)
 let url,address
 if(syntheticOrigin!==undefined){
  const fixture=new URL(syntheticOrigin)
  if(fixture.origin!==syntheticOrigin||fixture.protocol!=='http:'||fixture.hostname!=='127.0.0.1'||!fixture.port)throw Error('UNSAFE_SYNTHETIC_ORIGIN')
  url=new URL(target.pathname+target.search,fixture);address={address:'127.0.0.1',family:4}
 }else({url,address}=await abortable(resolvePublicUrl(target.href),signal))
 const pinnedLookup=(_host,opts,callback)=>opts?.all?callback(null,[address]):callback(null,address.address,address.family)
 const result=await new Promise((resolve,reject)=>{
  const req=(url.protocol==='https:'?https:http).get(url,{signal,lookup:pinnedLookup,agent:false,
   headers:{'User-Agent':'SpendGuru-SRM/1.0 (supplier website verification)',Accept:'text/html,application/xhtml+xml,image/*;q=0.8','Accept-Encoding':'identity'}},res=>{
    if(!res.statusCode||res.statusCode<200||res.statusCode>599
     ||res.headers['content-encoding']&&res.headers['content-encoding']!=='identity'
     ||Number(res.headers['content-length']??0)>maxBytes){res.destroy();reject(Error('WEBSITE_RESPONSE_UNAVAILABLE'));return}
    const headers=new Headers()
    for(const name of ['content-type','location','retry-after'])if(typeof res.headers[name]==='string')headers.set(name,res.headers[name])
    // Redirect bodies are never needed. The adapter follows only the original
    // five status codes, and the next hop has its own Source admission and DNS.
    if([301,302,303,307,308].includes(res.statusCode)&&res.headers.location){res.destroy();resolve({status:res.statusCode,headers,bytes:Buffer.alloc(0)});return}
    const chunks=[];let size=0
    res.on('data',chunk=>{size+=chunk.length;if(size>maxBytes){req.destroy(Error('WEBSITE_TOO_LARGE'));return}chunks.push(chunk)})
    res.on('error',reject)
    res.on('end',()=>resolve({status:res.statusCode,headers,bytes:Buffer.concat(chunks)}))
   })
  req.on('error',reject)
 })
 const response=new Response([204,205,304].includes(result.status)?null:result.bytes,{status:result.status,headers:result.headers})
 Object.defineProperty(response,'url',{value:target.href})
 return response
}
/** Same business-facing contract as original SRM. The callback supplies only
 * transport responses; it cannot grant any actor, SQL or Source authority. */
export function createSafePublicFetch(fetcher){
 if(typeof fetcher!=='function')throw TypeError('Explicit public hop transport required')
 return async(value,options={})=>{
  const {signal,maxBytes}=limits(options);let next=value
  for(let redirects=0;redirects<=4;redirects++){
   signal.throwIfAborted()
   const url=publicUrl(next),response=await fetcher(url.href,{signal,maxBytes})
   if(!(response instanceof Response)||response.redirected||response.url!==url.href)throw Error('WEBSITE_RESPONSE_UNAVAILABLE')
   if([301,302,303,307,308].includes(response.status)&&response.headers.get('location')){
    next=new URL(response.headers.get('location'),url).href;await response.body?.cancel();continue
   }
   if(!response.ok||response.headers.has('content-encoding')&&response.headers.get('content-encoding')!=='identity'
    ||Number(response.headers.get('content-length')??0)>maxBytes){await response.body?.cancel();throw Error('WEBSITE_RESPONSE_UNAVAILABLE')}
   const reader=response.body?.getReader(),chunks=[];let size=0
   try{if(reader)while(true){signal.throwIfAborted();const part=await reader.read();if(part.done)break;size+=part.value.byteLength
    if(size>maxBytes)throw Error('WEBSITE_TOO_LARGE');chunks.push(Buffer.from(part.value))}}
   finally{if(reader){try{await reader.cancel()}catch{}reader.releaseLock()}}
   return {url:url.href,body:Buffer.concat(chunks),contentType:response.headers.get('content-type')??''}
  }
  throw Error('WEBSITE_REDIRECT_LIMIT')
 }
}
export const safePublicFetch=createSafePublicFetch((url,options)=>publicWebHop(url,options))
