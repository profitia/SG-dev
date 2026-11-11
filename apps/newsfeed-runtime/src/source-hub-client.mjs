import {createFirstPartySourceSigner} from '@profitia/platform-current-e1-authority/first-party';
import {createPeerOperationSigner} from '@profitia/platform-contracts/peer-operation';
import {assertHubResponse,parseHubRequest,SourceHubError} from '../../../packages/platform-source-hub-contracts/index.mjs';
export function createSourceHubClient(configuration,{fetchImpl=fetch}={}){
 const sign=createPeerOperationSigner({environment:configuration.environment,callerApplicationId:configuration.applicationId,receiverApplicationId:configuration.sourceHubApplicationId,sourceOrigin:configuration.publicOrigin,targetOrigin:configuration.sourceHubOrigin,keyId:configuration.peerKeyId,key:configuration.secrets.peerKey,internalOrigins:[],routes:[{method:'POST',path:'/v1/acquire',maximumRequestBytes:16384,requireIdempotencyKey:true}]});
 const serviceSign=configuration.recurring?createFirstPartySourceSigner({environment:configuration.environment,componentId:configuration.recurring.componentId,consumerApplicationId:configuration.applicationId,receiverApplicationId:configuration.sourceHubApplicationId,sourceOrigin:configuration.publicOrigin,targetOrigin:configuration.sourceHubOrigin,keyId:configuration.recurring.keyId,privateKey:configuration.secrets.recurringPrivateKey}):null;
 /** @param {{request?:Request,command:any,context?:any,idempotencyKey:string,service?:{organisationId:string,grantId:string}|null,signal?:AbortSignal}} input */
 async function acquire({request,command,context,idempotencyKey,service=/** @type {{organisationId:string,grantId:string}|null} */(null),signal:parent}){
  let parsed,signal,signed;
  if(service){
   if(!serviceSign||!['organisationId','grantId'].every(k=>/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(service[k]??'')))throw new SourceHubError('SOURCE_CONSUMER_GRANT_REQUIRED',403);
   parsed=parseHubRequest(command);if(parsed.family!=='news-discovery')throw new SourceHubError('UNSUPPORTED_FAMILY',400);
   const body=JSON.stringify({context:{kind:'SERVICE',organisationId:service.organisationId,grantId:service.grantId},request:parsed});
   if(Buffer.byteLength(body)>16384)throw new SourceHubError('REQUEST_TOO_LARGE',413);
   // Finite transport deadline, no quota and no upstream retry.
   signal=AbortSignal.any([...(parent?[parent]:[]),AbortSignal.timeout(8000)]);
   signed=await serviceSign(new Request(configuration.sourceHubOrigin+'/v1/acquire',{method:'POST',headers:{'content-type':'application/json','idempotency-key':idempotencyKey},body,signal}));
  }else{
  if(!request)throw new SourceHubError('BEARER_SESSION_REQUIRED',401);
  const bearer=request.headers.get('authorization');if(typeof bearer!=='string'||!/^Bearer [\x21-\x7e]{1,16384}$/.test(bearer??''))throw new SourceHubError('BEARER_SESSION_REQUIRED',401);
  parsed=parseHubRequest(command);const body=JSON.stringify({context:{organisationId:context.organisationId,expectedUserId:context.expectedUserId},request:parsed});
  if(Buffer.byteLength(body)>16384)throw new SourceHubError('REQUEST_TOO_LARGE',413);
  signal=AbortSignal.any([request.signal,AbortSignal.timeout(20000)]);
  signed=await sign(new Request(configuration.sourceHubOrigin+'/v1/acquire',{method:'POST',headers:{authorization:bearer,'content-type':'application/json','idempotency-key':idempotencyKey},body,signal}));
  }
  try{
   const response=await fetchImpl(signed),reader=response.body?.getReader();if(!reader)throw new SourceHubError('SOURCE_HUB_INVALID_RESPONSE',502);
   const chunks=[];let size=0;try{for(;;){const p=await reader.read();if(p.done)break;size+=p.value.byteLength;if(size>2*1024*1024)throw new SourceHubError('SOURCE_HUB_RESPONSE_TOO_LARGE',502);chunks.push(p.value);}}finally{void reader.cancel().catch(()=>{});reader.releaseLock();}
   const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   if(!response.ok){const allowed=['AUTHENTICATION_FAILED','QUOTA_EXHAUSTED','PLAN_LIMIT','PROVIDER_REJECTED_CRITERIA','PROVIDER_UNAVAILABLE','PROVIDER_ERROR','INVALID_RESPONSE','RESPONSE_TOO_LARGE','CAPABILITY_NOT_CONFIRMED','PROVIDER_BUSY','SOURCE_ADMISSION_REQUIRED','UNSAFE_PROVIDER_RESPONSE','CRITERIA_TOO_LARGE','OPERATION_DENIED','LICENCE_ADMISSION_REQUIRED','SOURCE_ADMISSION_UNAVAILABLE','EXTERNAL_RESULT_UNVERIFIED','RATE_LIMITED','TIMEOUT','UNSUPPORTED_CRITERIA','INVALID_CRITERIA','PROVIDER_NOT_CONFIGURED','PLAN_RESTRICTED','RESULT_NOT_RETAINED','IDEMPOTENCY_CONFLICT','ACQUISITION_IN_PROGRESS','VERIFIED_CONTEXT_MISMATCH'];throw new SourceHubError(allowed.includes(value?.error?.code)?value.error.code:'SOURCE_HUB_UNAVAILABLE',[400,401,403,409,429,502,503,504].includes(response.status)?response.status:503,Number.isSafeInteger(value?.error?.retryAfterSeconds)&&value.error.retryAfterSeconds>=0&&value.error.retryAfterSeconds<=99999?value.error.retryAfterSeconds:null);}
   return assertHubResponse(value,parsed);
  }catch(error){if(error instanceof SourceHubError)throw error;throw new SourceHubError(signal.aborted?'SOURCE_HUB_TIMEOUT':'SOURCE_HUB_UNAVAILABLE',signal.aborted?504:503);}
 }
 return Object.freeze({acquire,acquireService:({command,organisationId,grantId,idempotencyKey,signal})=>acquire({command,idempotencyKey,signal,service:{organisationId,grantId}})});
}
