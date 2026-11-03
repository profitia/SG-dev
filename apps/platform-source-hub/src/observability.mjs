import {randomUUID} from 'node:crypto';
import {SourceHubError} from '../../../packages/platform-source-hub-contracts/index.mjs';
// The existing platform emits JSON to stdout. Never serialize requests, errors,
// SQL, URLs, headers, identities, search expressions or provider bodies here.
export function createTelemetry(write=line=>process.stdout.write(line+'\n')){
 return Object.freeze({requestId:()=>randomUUID(),emit({requestId,service,operation,outcome,status,durationMs,count=undefined}){
  const safe={event:'source_hub_backend',requestId,service,operation,outcome,status,durationMs:Math.max(0,Math.round(durationMs)),...(Number.isSafeInteger(count)?{count}:{})};
  try{write(JSON.stringify(safe));}catch{}
 }});
}
export function assertNoSecret(value,secrets){
 const body=JSON.stringify(value);
 if(Buffer.byteLength(body)>2*1024*1024)throw new SourceHubError('RESPONSE_TOO_LARGE',502);
 if(Object.values(secrets).some(v=>typeof v==='string'&&v.length>=8&&body.includes(v)))throw new SourceHubError('UNSAFE_PROVIDER_RESPONSE',502);
}
