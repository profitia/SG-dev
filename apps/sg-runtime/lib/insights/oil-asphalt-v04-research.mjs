import {createPeerOperationSigner} from '../../../../packages/platform-contracts/src/peer-operation.mjs';
import {parseHubRequest,assertHubResponse} from '../../../../packages/platform-source-hub-contracts/index.mjs';
import {hash,requireThat} from './oil-asphalt-v04-contract.mjs';
export const CONSUMER_ID='procurement-insights-oil-v04';
export function prepareResearchPlan(windows){
 const from=windows.fromInclusive,to=windows.asOf,date=x=>x.slice(0,10),base={contractVersion:'1.0.0',operation:'search'};
 const plan=[];let id=0;const add=(provider,family,criteria)=>plan.push({queryId:'Q'+String(++id).padStart(2,'0'),command:parseHubRequest({...base,provider,family,criteria})});
 for(const text of ['"crude oil" OR Brent OR WTI','OPEC OR refinery OR inventories','asphalt OR bitumen'])add('newsapi','news-discovery',{mode:'articles',text,publishedAfter:from,publishedBefore:to,language:'en',pageSize:20,page:1,order:'newest'});
 for(const text of ['EIA weekly petroleum inventories','OPEC production oil','IEA oil market demand','bitumen asphalt refinery supply logistics'])add('brave','news-discovery',{text,count:10,language:'en',freshness:date(from)+'to'+date(to)});
 add('trading-economics','news-discovery',{newsType:'markets',from:date(from),to:date(to),limit:100});
 add('trading-economics','economic-calendar',{countries:['United States','China'],from:date(from),to:date(to),importance:2,limit:100});
 add('trading-economics','economic-calendar',{countries:['United States','China'],from:date(windows.upcomingFromInclusive),to:date(windows.upcomingToExclusive),importance:2,limit:100});
 add('trading-economics','indicators',{countries:['United States','China'],indicators:['Manufacturing PMI'],limit:20});
 add('trading-economics','external-forecasts',{countries:['United States'],indicators:['GDP Growth Rate'],horizons:['q4','YearEnd'],limit:10});
 return Object.freeze({schemaVersion:'OilV04ResearchPlan/1',consumerId:CONSUMER_ID,windows,maximumAcquireRequests:plan.length,automaticRetry:false,marketForecasts:'OFF',plan,fingerprint:hash(plan)});
}
/** One admitted Hub call per intent, no vendor credentials or vendor HTTP. */
export function createResearchClient({peer,fetchImpl=fetch,telemetry,onReceipt}){
 requireThat(peer.callerApplicationId===CONSUMER_ID&&peer.receiverApplicationId==='profitia-source-hub-development','WRONG_HUB_CONSUMER');
 requireThat(peer.targetOrigin==='https://source-hub-development.onrender.com'&&typeof onReceipt==='function','BOUND_HUB_AND_RECEIPT_SINK_REQUIRED');
 const sign=createPeerOperationSigner({...peer,environment:'development',internalOrigins:[],routes:[{method:'POST',path:'/v1/acquire',maximumRequestBytes:16384,requireIdempotencyKey:true}]});
 const used=new Set();
 return Object.freeze({async acquire({queryId,command,verifiedContext,bearer,runId,onTransientRecords}){
  const parsed=parseHubRequest(command),intent='oil-v04-'+hash({runId,queryId,command:parsed});requireThat(!used.has(intent),'AUTOMATIC_RETRY_FORBIDDEN');used.add(intent);
  requireThat(/^Bearer [\x21-\x7e]{1,16384}$/.test(bearer),'VERIFIED_SESSION_REQUIRED');
  requireThat(verifiedContext&&['userId','organisationId'].every(k=>/^[a-f0-9-]{36}$/.test(verifiedContext[k]??'')),'VERIFIED_CONTEXT_SELECTORS_REQUIRED');
  const body=JSON.stringify({context:{organisationId:verifiedContext.organisationId,expectedUserId:verifiedContext.userId},request:parsed});requireThat(Buffer.byteLength(body)<=16384,'HUB_BODY_TOO_LARGE');
  return telemetry.stage('source_hub_acquire',async()=>{
   const t=process.hrtime.bigint();let out={queryId,provider:parsed.provider,family:parsed.family,status:'UNVERIFIED',upstreamAttempts:null,cacheHit:null,receiptRef:null,returned:0,coverage:{completeness:'UNKNOWN'}};
   let value;
   try{
    const request=await sign(new Request(peer.targetOrigin+'/v1/acquire',{method:'POST',headers:{authorization:bearer,'content-type':'application/json','idempotency-key':intent},body,signal:AbortSignal.timeout(30000)}));
    const response=await fetchImpl(request);requireThat(response.body,'HUB_RESPONSE_BODY_MISSING');
    const reader=response.body.getReader(),chunks=[];let size=0;
    try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>2*1024*1024){await reader.cancel();throw Error('HUB_RESPONSE_TOO_LARGE')}chunks.push(Buffer.from(part.value));}
     const bytes=Buffer.concat(chunks);try{value=JSON.parse(bytes.toString('utf8'))}finally{bytes.fill(0)}
    }finally{for(const chunk of chunks)chunk.fill(0);reader.releaseLock();}
    if(!response.ok){const e=Error('HUB_REQUEST_FAILED');e.code=/^[A-Z0-9_]{1,100}$/.test(value?.error?.code)?value.error.code:'HUB_REQUEST_FAILED';throw e}
    assertHubResponse(value,parsed);
    out={...out,status:'SUCCEEDED',upstreamAttempts:value.usage.upstreamAttempts,cacheHit:value.usage.cacheHit,receiptRef:value.usage.receiptRef,returned:value.items.length,coverage:value.coverage??{completeness:'UNKNOWN'},hubRequestId:response.headers.get('x-request-id')};
   }catch(error){out={...out,durationMs:Number(process.hrtime.bigint()-t)/1e6};await onReceipt(out);const safe=Error('HUB_RESULT_UNVERIFIED');safe.code=/^[A-Z0-9_]{1,100}$/.test(error?.code??'')?error.code:'HUB_RESULT_UNVERIFIED';throw safe}
   // Persist the receipt before local qualification can fail. Raw records remain
   // transient and are never passed to the receipt/telemetry sink.
   out={...out,durationMs:Number(process.hrtime.bigint()-t)/1e6};await onReceipt(out);
   try{await onTransientRecords(value.items,{queryId,provider:parsed.provider,family:parsed.family});return out}finally{value=null;}
  },{provider:parsed.provider,family:parsed.family,queryId});
 }});
}
