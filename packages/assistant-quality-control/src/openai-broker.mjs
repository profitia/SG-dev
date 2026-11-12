import {createServer} from 'node:http'
import {timingSafeEqual} from 'node:crypto'
import {CODE_PRICING,quoteCodeRequest,readCodeUsage} from './budget.mjs'
import {documentDigest} from './manifest.mjs'

const fail=code=>{throw Object.assign(Error('QA model request refused'),{code})}
const require=(v,code='REQUEST_REJECTED')=>{if(!v)fail(code)}
const object=v=>v!==null&&Object.getPrototypeOf(v)===Object.prototype
const fields=new Set(['model','input','instructions','tools','tool_choice','parallel_tool_calls','reasoning','stream','store','include','max_output_tokens','text','service_tier','prompt_cache_key','prompt_cache_options','truncation'])
const localInputTypes=new Set(['message','input_text','output_text','function_call','function_call_output','custom_tool_call','custom_tool_call_output','reasoning','summary_text','reasoning_text','refusal'])
const linkedKeys=new Set(['file_id','file_url','file_data','image_url','audio','previous_response_id','conversation','item_reference'])
function input(v,depth=0){
 require(depth<=32)
 if(Array.isArray(v)){require(v.length<=10000);v.forEach(x=>input(x,depth+1));return}
 if(v===null||typeof v!=='object')return
 require(object(v))
 if(v.type!==undefined)require(localInputTypes.has(v.type),'REMOTE_INPUT_REJECTED')
 for(const [key,value]of Object.entries(v)){require(!linkedKeys.has(key),'REMOTE_INPUT_REJECTED');input(value,depth+1)}
}
function localTools(v,depth=0){
 require(depth<=2&&Array.isArray(v)&&v.length<=64,'HOSTED_TOOL_REJECTED')
 for(const t of v){
  require(object(t)&&['function','custom','namespace'].includes(t.type),'HOSTED_TOOL_REJECTED')
  if(t.type==='namespace')localTools(t.tools,depth+1)
 }
}
export function boundAgentRequest(value){
 require(object(value)&&Object.keys(value).every(k=>fields.has(k))&&value.model===CODE_PRICING.model)
 require(value.input!==undefined);input(value.input)
 if(value.instructions!==undefined)require(typeof value.instructions==='string')
 if(value.tools!==undefined)localTools(value.tools)
 if(value.service_tier!==undefined)require(['auto','default'].includes(value.service_tier),'UNPRICED_TIER_REJECTED')
 require(value.stream===undefined||typeof value.stream==='boolean')
 const n=value.max_output_tokens??CODE_PRICING.maxOutputTokens;require(Number.isSafeInteger(n)&&n>0)
 const r={...structuredClone(value),model:CODE_PRICING.model,store:false,service_tier:'default',truncation:'disabled',
  reasoning:{effort:'low'},max_output_tokens:Math.min(n,CODE_PRICING.maxOutputTokens),prompt_cache_options:{mode:'explicit',ttl:'30m'}}
 require(Buffer.byteLength(JSON.stringify(r))<=1048576,'INPUT_BOUND_EXCEEDED')
 return r
}
function countPayload(body){
 const out={};for(const k of ['model','input','instructions','tools','tool_choice','parallel_tool_calls','reasoning','text','truncation'])if(body[k]!==undefined)out[k]=body[k]
 return out
}
function requestId(permitId,digest){
 const h=documentDigest([permitId,digest]);return h.slice(0,8)+'-'+h.slice(8,12)+'-8'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32)
}

/** Root-owned loopback process on the ephemeral VM. The agent receives only
 * its scoped local bearer token. The provider key and Limits credentials stay
 * outside the agent's user, environment, filesystem and network permissions. */
export function createCostBroker({budget,permit,bearerToken,openaiKey,fetcher=fetch,maximumRequests=64}){
 require(typeof bearerToken==='string'&&/^[a-f0-9]{64}$/.test(bearerToken)&&typeof openaiKey==='string'&&openaiKey.length>0,'EXPLICIT_BROKER_BINDING_REQUIRED')
 for(const name of ['assertPermit','reserveRequest','dispatchRequest','settleRequest','markUnknown'])require(typeof budget?.[name]==='function','EXPLICIT_BROKER_BINDING_REQUIRED')
 require(typeof permit?.permitId==='string'&&Number.isSafeInteger(maximumRequests)&&maximumRequests>0&&maximumRequests<=64)
 let requests=0,running=false,closing=false
 const active=new Set(),secret=Buffer.from('Bearer '+bearerToken)
 const server=createServer((req,res)=>{
  const abort=new AbortController();active.add(abort)
  res.on('close',()=>{if(!res.writableEnded)abort.abort()})
  const timeout=setTimeout(()=>abort.abort(),75000);timeout.unref()
  void (async()=>{
   let reservation,dispatched=false,settled=false,unknown=false,ownsRun=false
   const mark=async reason=>{if(reservation&&dispatched&&!settled&&!unknown){unknown=true;await budget.markUnknown(reservation,reason)}}
   try{
    const auth=Buffer.from(req.headers.authorization??'')
    require(auth.length===secret.length&&timingSafeEqual(auth,secret),'AUTH_REQUIRED')
    require(!closing&&req.method==='POST'&&req.url==='/v1/responses','ROUTE_REJECTED')
    require(!running,'BROKER_BUSY');running=true;ownsRun=true
    require(++requests<=maximumRequests,'REQUEST_LIMIT_EXCEEDED')
    require(req.headers['content-type']?.split(';')[0]==='application/json')
    let bytes=0;const chunks=[]
    for await(const chunk of req){bytes+=chunk.length;require(bytes<=1048576,'INPUT_BOUND_EXCEEDED');chunks.push(chunk)}
    const body=boundAgentRequest(JSON.parse(Buffer.concat(chunks).toString('utf8'))),digest=documentDigest(body)
    await budget.assertPermit(permit)
    const headers={'Content-Type':'application/json',Authorization:'Bearer '+openaiKey}
    const counted=await fetcher('https://api.openai.com/v1/responses/input_tokens',{method:'POST',redirect:'error',headers,body:JSON.stringify(countPayload(body)),signal:abort.signal})
    require(counted.ok,'PROVIDER_UNAVAILABLE');const count=await counted.json()
    require(count?.object==='response.input_tokens'&&Number.isSafeInteger(count.input_tokens),'TOKEN_COUNT_UNVERIFIED')
    const quote=quoteCodeRequest(count.input_tokens,body.max_output_tokens)
    reservation=await budget.reserveRequest(permit,{requestId:requestId(permit.permitId,digest),inputDigest:digest,quote})
    require(reservation.status==='RESERVED','REQUEST_ALREADY_ISSUED')
    // Durable DISPATCH must succeed before the only inference POST.
    await budget.dispatchRequest(reservation);dispatched=true
    const response=await fetcher('https://api.openai.com/v1/responses',{method:'POST',redirect:'error',headers:{...headers,'X-Client-Request-Id':reservation.requestId},body:JSON.stringify(body),signal:abort.signal})
    require(response.ok,'PROVIDER_UNAVAILABLE')
    let terminal=false
    const settle=async r=>{
     require(!terminal,'DUPLICATE_TERMINAL');terminal=true
     try{
      const usage=readCodeUsage(r?.usage,{model:r?.model,serviceTier:r?.service_tier,quote})
      await budget.settleRequest(reservation,usage);settled=true
     }catch{await mark('USAGE_UNVERIFIED')}
    }
    res.writeHead(200,{'Content-Type':body.stream?'text/event-stream':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'})
    if(body.stream){
     require(response.headers.get('content-type')?.split(';')[0]==='text/event-stream'&&response.body,'STREAM_INVALID')
     let pending='';const decoder=new TextDecoder()
     for await(const chunk of response.body){
      pending=(pending+decoder.decode(chunk,{stream:true})).replace(/\r\n/g,'\n');require(pending.length<=1048576,'STREAM_INVALID')
      let index
      while((index=pending.indexOf('\n\n'))>=0){
       const frame=pending.slice(0,index);pending=pending.slice(index+2);let forwarded=frame
       const data=frame.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n')
       if(data&&data!=='[DONE]'){
        const event=JSON.parse(data)
        if(['response.completed','response.failed','response.incomplete'].includes(event.type))await settle(event.response)
        if(event.type==='error')forwarded='event: error\ndata: '+JSON.stringify({type:'error',code:'AQC_UPSTREAM_ERROR',message:'QA model request unavailable'})
        else if(event.response?.error){
         event.response.error={code:'AQC_UPSTREAM_ERROR',message:'QA model request unavailable'}
         forwarded='event: '+event.type+'\ndata: '+JSON.stringify(event)
        }
       }
       if(!res.destroyed)res.write(forwarded+'\n\n')
      }
     }
     require(!pending.trim(),'STREAM_INCOMPLETE')
    }else{const r=await response.json();await settle(r);res.write(JSON.stringify(r))}
    if(!terminal)await mark('STREAM_INCOMPLETE')
    res.end()
   }catch(e){
    try{await mark(abort.signal.aborted?'CANCELLED':'PROVIDER_ERROR')}catch{/* DISPATCHED upper bound remains reserved in native Limits. */}
    if(!res.headersSent){
     const status=e?.code==='AUTH_REQUIRED'?401:e?.code==='BROKER_BUSY'?429:e?.code==='REQUEST_ALREADY_ISSUED'?409
      :e?.code==='ROUTE_REJECTED'?404:['REQUEST_REJECTED','REMOTE_INPUT_REJECTED','HOSTED_TOOL_REJECTED','UNPRICED_TIER_REJECTED'].includes(e?.code)?400:503
     res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:{code:e?.code??'BROKER_UNAVAILABLE',message:'QA model request unavailable'}}))
    }
    else res.destroy()
   }finally{clearTimeout(timeout);active.delete(abort);if(ownsRun)running=false}
  })()
 })
 return Object.freeze({
  async listen(){await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});return 'http://127.0.0.1:'+server.address().port+'/v1'},
  async close(){closing=true;for(const a of active)a.abort();server.closeAllConnections();await new Promise(resolve=>server.close(resolve))},
 })
}
