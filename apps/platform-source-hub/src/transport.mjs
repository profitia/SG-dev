import {createHash} from 'node:crypto';
import {SourceHubError,closed,SOURCE_HUB_CONTRACT_VERSION} from '../../../packages/platform-source-hub-contracts/index.mjs';
/** @returns {never} */
export const fail=(code='INVALID_CRITERIA',status=400)=>{throw new SourceHubError(code,status);};
export function fields(value,allowed){if(!closed(value,allowed))fail('UNSUPPORTED_CRITERIA');}
export function text(value,max=200){if(typeof value!=='string'||!value.trim()||value.length>max||/[\x00-\x1f]/.test(value))fail();return value.trim();}
export function list(value,max=10){if(!Array.isArray(value)||!value.length||value.length>max)fail();const a=value.map(x=>text(x));if(new Set(a).size!==a.length)fail();return a;}
export function integer(value,min,max){if(!Number.isSafeInteger(value)||value<min||value>max)fail();return value;}
export function day(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)fail();return value;}
export function domain(value){const v=text(value,253).toLowerCase();if(!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(v))fail();return v;}
export function optionalText(value){if(value===null||value===undefined||value==='')return null;if(typeof value!=='string'||value.length>16384)fail('INVALID_RESPONSE',502);return value;}
export function scalar(value){if(value===null||value===undefined||typeof value==='string'&&/^(?:\s*|null|n\/a|unknown)$/i.test(value.trim()))return null;if(typeof value==='number'&&Number.isFinite(value)||typeof value==='string'&&value.length<=1000)return value;fail('INVALID_RESPONSE',502);}
export function url(value,required=false){if(value===null||value===undefined||value===''){if(required)fail('INVALID_RESPONSE',502);return null;}try{const u=new URL(value);if(typeof value==='string'&&value.length<=4096&&['http:','https:'].includes(u.protocol)&&!u.username&&!u.password)return value;}catch{}fail('INVALID_RESPONSE',502);}
export function providerUtc(value){if(value===null||value===undefined||value==='')return null;const s=optionalText(value);if(s===null||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?(?:Z|[+-]\d\d:\d\d)?$/.test(s))fail('INVALID_RESPONSE',502);const normalized=/(?:Z|[+-]\d\d:\d\d)$/.test(s)?s:s+'Z';if(!Number.isFinite(Date.parse(normalized)))fail('INVALID_RESPONSE',502);return new Date(normalized).toISOString();}
export const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function record(family,provider,endpoint,payload,options={}){
 const retrievedAt=options.retrievedAt??new Date().toISOString(),contentFingerprint=fingerprint(payload);
 return {metadata:{contractFamily:family,contractVersion:SOURCE_HUB_CONTRACT_VERSION,providerId:provider,apiFamily:family,endpointVersion:endpoint,
  vendorRecordId:options.vendorRecordId??null,sourceRecordRef:provider+':'+family+':'+contentFingerprint,sourceUrl:options.sourceUrl??null,retrievedAt,
  availableAt:options.availableAt??null,asOf:options.asOf??null,licenceRef:options.licenceRef??'PENDING_ADMISSION',qualityStatus:'PROVIDER_REPORTED',contentFingerprint,usageReceiptRef:null},payload};
}
/** @param {string} family @param {string} provider @param {any[]} items @param {{retrievedAt?:string,page?:number|null,pageSize?:number|null,more?:boolean|null,total?:number|null,truncated?:boolean,licenceRef?:string}} options */
export function result(family,provider,items,{retrievedAt=new Date().toISOString(),page=null,pageSize=null,more=null,total=null,truncated=false,licenceRef='PENDING_ADMISSION'}={}){
 return {contractVersion:SOURCE_HUB_CONTRACT_VERSION,family,provider,status:items.length?'ok':'empty',items,page:{page,pageSize,more,total,truncated},provenance:{retrievedAt,licenceRef,qualityStatus:'PROVIDER_REPORTED'},usage:{receiptRef:null,upstreamAttempts:1,cacheHit:false}};
}
export function credential(value){if(typeof value!=='string'||value.length<8||value.length>512||/[\r\n]/.test(value))fail('PROVIDER_NOT_CONFIGURED',503);return value;}
/** @param {Function|undefined} fetchImpl @param {string} target @param {Record<string,string>} headers @param {{timeoutMs?:number,signal?:AbortSignal,maximumBytes?:number}} options */
export async function providerJson(fetchImpl,target,headers,{timeoutMs=15000,signal,maximumBytes=2*1024*1024}={}){
 if(typeof fetchImpl!=='function')fail('ADMITTED_TRANSPORT_REQUIRED',503);
 const abort=AbortSignal.any([AbortSignal.timeout(timeoutMs),...(signal?[signal]:[])]);let status=null;
 try{
  const response=await fetchImpl(target,{method:'GET',headers:{Accept:'application/json',...headers},redirect:'error',signal:abort});status=response.status;
  const retry=response.headers.get('retry-after'),retryAfter=retry&&/^\d{1,5}$/.test(retry)?Number(retry):null;
  if(!response.ok)throw new SourceHubError(status===401?'AUTHENTICATION_FAILED':status===403?'PLAN_RESTRICTED':status===429?'RATE_LIMITED':status>=500?'PROVIDER_UNAVAILABLE':'PROVIDER_REJECTED_CRITERIA',status===429?429:502,retryAfter);
  if(!response.body)fail('INVALID_RESPONSE',502);const reader=response.body.getReader();const chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maximumBytes)fail('RESPONSE_TOO_LARGE',502);chunks.push(value);}}finally{void reader.cancel().catch(()=>{});reader.releaseLock();}
  let value;try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail('INVALID_RESPONSE',502);}return value;
 }catch(error){if(error instanceof SourceHubError)throw error;throw new SourceHubError(abort.aborted?'TIMEOUT':'PROVIDER_UNAVAILABLE',abort.aborted?504:503);}
}
