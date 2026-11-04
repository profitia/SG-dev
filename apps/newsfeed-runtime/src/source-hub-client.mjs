import {createPeerOperationSigner} from '@profitia/platform-contracts/peer-operation';
import {assertHubResponse,parseHubRequest,SourceHubError} from '../../../packages/platform-source-hub-contracts/index.mjs';
export function createSourceHubClient(configuration,{fetchImpl=fetch}={}){
 const sign=createPeerOperationSigner({environment:configuration.environment,callerApplicationId:configuration.applicationId,receiverApplicationId:configuration.sourceHubApplicationId,sourceOrigin:configuration.publicOrigin,targetOrigin:configuration.sourceHubOrigin,keyId:configuration.peerKeyId,key:configuration.secrets.peerKey,internalOrigins:[],routes:[{method:'POST',path:'/v1/acquire',maximumRequestBytes:16384,requireIdempotencyKey:true}]});
 return Object.freeze({async acquire({request,command,context,idempotencyKey}){
  const bearer=request.headers.get('authorization');if(!/^Bearer [\x21-\x7e]{1,16384}$/.test(bearer??''))throw new SourceHubError('BEARER_SESSION_REQUIRED',401);
  const parsed=parseHubRequest(command),body=JSON.stringify({context:{organisationId:context.organisationId,expectedUserId:context.expectedUserId},request:parsed});
  if(Buffer.byteLength(body)>16384)throw new SourceHubError('REQUEST_TOO_LARGE',413);
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(20000)]);
  const signed=await sign(new Request(configuration.sourceHubOrigin+'/v1/acquire',{method:'POST',headers:{authorization:bearer,'content-type':'application/json','idempotency-key':idempotencyKey},body,signal}));
  try{
   const response=await fetchImpl(signed),reader=response.body?.getReader();if(!reader)throw new SourceHubError('SOURCE_HUB_INVALID_RESPONSE',502);
   const chunks=[];let size=0;try{for(;;){const p=await reader.read();if(p.done)break;size+=p.value.byteLength;if(size>2*1024*1024)throw new SourceHubError('SOURCE_HUB_RESPONSE_TOO_LARGE',502);chunks.push(p.value);}}finally{void reader.cancel().catch(()=>{});reader.releaseLock();}
   const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   if(!response.ok){const allowed=['AUTHENTICATION_FAILED','QUOTA_EXHAUSTED','PLAN_LIMIT','PROVIDER_REJECTED_CRITERIA','PROVIDER_UNAVAILABLE','PROVIDER_ERROR','INVALID_RESPONSE','RESPONSE_TOO_LARGE','CAPABILITY_NOT_CONFIRMED','PROVIDER_BUSY','SOURCE_ADMISSION_REQUIRED','UNSAFE_PROVIDER_RESPONSE','CRITERIA_TOO_LARGE','OPERATION_DENIED','LICENCE_ADMISSION_REQUIRED','SOURCE_ADMISSION_UNAVAILABLE','EXTERNAL_RESULT_UNVERIFIED','RATE_LIMITED','TIMEOUT','UNSUPPORTED_CRITERIA','INVALID_CRITERIA','PROVIDER_NOT_CONFIGURED','PLAN_RESTRICTED','RESULT_NOT_RETAINED','IDEMPOTENCY_CONFLICT','ACQUISITION_IN_PROGRESS','VERIFIED_CONTEXT_MISMATCH'];throw new SourceHubError(allowed.includes(value?.error?.code)?value.error.code:'SOURCE_HUB_UNAVAILABLE',[400,401,403,409,429,502,503,504].includes(response.status)?response.status:503,Number.isSafeInteger(value?.error?.retryAfterSeconds)&&value.error.retryAfterSeconds>=0&&value.error.retryAfterSeconds<=99999?value.error.retryAfterSeconds:null);}
   return assertHubResponse(value,parsed);
  }catch(error){if(error instanceof SourceHubError)throw error;throw new SourceHubError(signal.aborted?'SOURCE_HUB_TIMEOUT':'SOURCE_HUB_UNAVAILABLE',signal.aborted?504:503);}
 }});
}
