import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
const safe=/^[A-Z0-9_.:-]{1,128}$/i;
export function createExecutionTelemetry(directory,{runId=randomUUID(),writeSpan=()=>{}}={}){
 fs.mkdirSync(directory,{recursive:true,mode:0o700});const file=directory+'/OIL_V04_EXECUTION_TELEMETRY.jsonl',start=process.hrtime.bigint(),startedAt=new Date().toISOString();
 const append=v=>fs.appendFileSync(file,JSON.stringify(v)+'\n',{mode:0o600});
 const stage=async(name,work,dimensions={})=>{
  if(!safe.test(name)||Object.keys(dimensions).some(k=>!['provider','family','queryId'].includes(k))||Object.values(dimensions).some(v=>typeof v!=='string'||!safe.test(v)))throw Error('UNSAFE_TELEMETRY_DIMENSION');
  const t=process.hrtime.bigint(),began=new Date().toISOString();let status='PASS',reason=null;
  try{return await work()}catch(e){status='FAIL';reason=typeof e?.code==='string'&&safe.test(e.code)?e.code:'STAGE_FAILED';throw e}
  finally{const event={schemaVersion:'OilV04Stage/1',runId,stage:name,startedAt:began,finishedAt:new Date().toISOString(),durationMs:Number(process.hrtime.bigint()-t)/1e6,status,reason,...dimensions};append(event);try{writeSpan(event)}catch{}}
 };
 return Object.freeze({runId,startedAt,stage,finish(status){const e={schemaVersion:'OilV04Execution/1',runId,stage:'end_to_end',startedAt,finishedAt:new Date().toISOString(),durationMs:Number(process.hrtime.bigint()-start)/1e6,status};append(e);return e;}});
}
export function summarizeHubUsage(operations){
 const groups=new Map();for(const op of operations){const key=op.provider+':'+op.family;let r=groups.get(key);if(!r){r={provider:op.provider,family:op.family,acquireRequests:0,upstreamAttempts:0,unknownAttempts:0,cacheHits:0,retries:0,successes:0,failures:0,uncertain:0,records:0,durationMs:0,receipts:[]};groups.set(key,r)}
  r.acquireRequests++;r.durationMs+=op.durationMs;r.cacheHits+=op.cacheHit===true?1:0;
  if(Number.isSafeInteger(op.upstreamAttempts))r.upstreamAttempts+=op.upstreamAttempts;else r.unknownAttempts++;
  r.successes+=op.status==='SUCCEEDED'?1:0;r.failures+=op.status==='FAILED'?1:0;r.uncertain+=op.status==='UNVERIFIED'?1:0;r.records+=op.returned??0;if(op.receiptRef)r.receipts.push(op.receiptRef);
 }
 return [...groups.values()].map(r=>({...r,upstreamAttempts:r.unknownAttempts?'UNKNOWN':r.upstreamAttempts,confirmedUpstreamAttempts:r.upstreamAttempts,coverage:'UNKNOWN'}));
}
