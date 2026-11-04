import {randomUUID} from 'node:crypto';
import {SourceHubError} from '../../../packages/platform-source-hub-contracts/index.mjs';
import {CONTRACT_FAMILIES} from '../../../packages/platform-source-hub-contracts/index.mjs';
// The existing platform emits JSON to stdout. Never serialize requests, errors,
// SQL, URLs, headers, identities, search expressions or provider bodies here.
export function createTelemetry(write=line=>process.stdout.write(line+'\n')){
 return Object.freeze({requestId:()=>randomUUID(),
 /** @param {{requestId:string,service:string,operation:string,outcome:string,status:number,durationMs:number,count?:number,provider?:string,family?:string,cacheHit?:boolean,upstreamAttempts?:number}} event */
 emit(event){
  const {requestId,service,operation,outcome,status,durationMs,count,provider,family,cacheHit,upstreamAttempts}=event;
  const safe={event:'source_hub_backend',requestId,service,operation,outcome,status,durationMs:Math.max(0,Math.round(durationMs)),...(Number.isSafeInteger(count)?{count}:{}),
   ...(typeof provider==='string'&&['newsapi','brave','trading-economics'].includes(provider)?{provider}:{}),...(typeof family==='string'&&CONTRACT_FAMILIES.includes(family)?{family}:{}),
   ...(typeof cacheHit==='boolean'?{cacheHit}:{}),...(typeof upstreamAttempts==='number'&&[0,1].includes(upstreamAttempts)?{upstreamAttempts}:{})};
  try{write(JSON.stringify(safe));}catch{}
 }});
}
export function assertNoSecret(value,secrets){
 const body=JSON.stringify(value);
 if(Buffer.byteLength(body)>2*1024*1024)throw new SourceHubError('RESPONSE_TOO_LARGE',502);
 if(Object.values(secrets).some(v=>typeof v==='string'&&v.length>=8&&body.includes(v)))throw new SourceHubError('UNSAFE_PROVIDER_RESPONSE',502);
}
