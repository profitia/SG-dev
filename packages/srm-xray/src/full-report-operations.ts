import type {SupplierWebIdentityData} from './contracts';
import type {KysPdfSelection} from './kys-pdf-document';
import {parseManualLocation,type ManualLocationInput,type SupplierLocationGroup} from './supplier-locations';
export const XRAY_PRESENTATION_CONTRACT='profitia.srm-xray.presentation/1.0.0';
export const XRAY_PRESENTATION_REQUEST_BYTES=8192;
export const XRAY_PRESENTATION_RESPONSE_BYTES=20*1024*1024;
export type LocationCommand=
 | {action:'READ';supplierId:string;group:SupplierLocationGroup;offset:number;limit:number}
 | {action:'SYNC';supplierId:string}
 | {action:'GEOCODE';supplierId:string;locationId:string}
 | {action:'CREATE'|'UPDATE'|'DEACTIVATE';supplierId:string;locationId:string|null;expectedVersion:string|null;command:ManualLocationInput|null};
export type PresentationCommands={
 financialExcel:{nip:string;scope:'standalone'|'consolidated';years:string[]};
 kysPdf:KysPdfSelection;krsPdf:KysPdfSelection;revealPesel:{token:string};
 webIdentity:{identifier:string;entityType:'COMPANY'|'JDG'};
 registryStatus:Record<string,never>;registrySearch:{query:string};registryVerify:{krs:string};
 locations:LocationCommand;mapReadiness:{supplierId:string};
};
export type PresentationOperation=keyof PresentationCommands;
export const PRESENTATION_ROUTES={
 financialExcel:{path:'/api/xray/presentation/financial-excel',native:'/api/xray/financial-excel',method:'POST',mime:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'},
 kysPdf:{path:'/api/xray/presentation/kys-pdf',native:'/api/xray/kys/pdf',method:'POST',mime:'application/pdf'},
 krsPdf:{path:'/api/xray/presentation/krs-pdf',native:'/api/xray/kys/krs',method:'POST',mime:'application/pdf'},
 revealPesel:{path:'/api/xray/presentation/reveal-pesel',native:'/api/xray/kys/pesel',method:'POST',mime:'application/json'},
 webIdentity:{path:'/api/xray/presentation/web-identity',native:'/api/xray/web-identity',method:'POST',mime:'application/json'},
 registryStatus:{path:'/api/xray/presentation/registry-status',native:'/api/xray/krs/status',method:'GET',mime:'application/json'},
 registrySearch:{path:'/api/xray/presentation/registry-search',native:'/api/xray/krs/search',method:'POST',mime:'application/json'},
 registryVerify:{path:'/api/xray/presentation/registry-verify',native:'/api/xray/krs/verify',method:'POST',mime:'application/json'},
 locations:{path:'/api/xray/presentation/locations',native:'/api/supplier-locations',method:'POST',mime:'application/json'},
 mapReadiness:{path:'/api/xray/presentation/map-readiness',native:'/api/supplier-locations',method:'POST',mime:'application/json'},
} as const;
export function presentationOperation(path:string):PresentationOperation|null{
 return (Object.keys(PRESENTATION_ROUTES) as PresentationOperation[]).find(k=>PRESENTATION_ROUTES[k].path===path)??null;
}
const record=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const nip=(v:unknown)=>typeof v==='string'&&/^\d{10}$/.test(v);
function requireValue(value:unknown):asserts value{if(!value)throw Error('XRAY_REQUEST_INVALID')}
/** DTO admission only. Current server-side E1 remains the operation authority. */
export function validatePresentationCommand<K extends PresentationOperation>(operation:K,value:unknown):asserts value is PresentationCommands[K]{
 switch(operation){
  case 'registryStatus':requireValue(record(value,[]));return;
  case 'registrySearch':requireValue(record(value,['query'])&&typeof value.query==='string'&&value.query.trim().length>=2&&value.query.length<=150);return;
  case 'registryVerify':requireValue(record(value,['krs'])&&nip(value.krs));return;
  case 'revealPesel':requireValue(record(value,['token'])&&typeof value.token==='string'&&value.token.length>0&&value.token.length<=1000);return;
  case 'webIdentity':requireValue(record(value,['identifier','entityType'])&&nip(value.identifier)&&['COMPANY','JDG'].includes(String(value.entityType)));return;
  case 'financialExcel':requireValue(record(value,['nip','scope','years'])&&nip(value.nip)&&['standalone','consolidated'].includes(String(value.scope))&&Array.isArray(value.years)&&value.years.length>0&&value.years.length<=100&&new Set(value.years).size===value.years.length&&value.years.every(y=>typeof y==='string'&&/^\d{4}$/.test(y)));return;
  case 'kysPdf':case 'krsPdf':requireValue(record(value,['nip','entityType','retrievedAt','exportRef'])&&nip(value.nip)&&['COMPANY','JDG'].includes(String(value.entityType))&&(operation!=='krsPdf'||value.entityType==='COMPANY')&&typeof value.retrievedAt==='string'&&Number.isFinite(Date.parse(value.retrievedAt))&&typeof value.exportRef==='string'&&/^[a-f0-9]{64}$/.test(value.exportRef));return;
  case 'mapReadiness':requireValue(record(value,['supplierId'])&&uuid(value.supplierId));return;
  case 'locations':{
   requireValue(!!value&&typeof value==='object'&&'action' in value);const v=value as Record<string,unknown>;
   requireValue(uuid(v.supplierId));
   if(v.action==='READ'){requireValue(record(v,['action','supplierId','group','offset','limit'])&&['SUPPLIER_LOCATIONS','USER_LOCATIONS'].includes(String(v.group))&&Number.isInteger(v.offset)&&Number(v.offset)>=0&&Number(v.offset)<=100000&&Number.isInteger(v.limit)&&Number(v.limit)>0&&Number(v.limit)<=100);return}
   if(v.action==='SYNC'){requireValue(record(v,['action','supplierId']));return}
   if(v.action==='GEOCODE'){requireValue(record(v,['action','supplierId','locationId'])&&uuid(v.locationId));return}
   requireValue(record(v,['action','supplierId','locationId','expectedVersion','command'])&&['CREATE','UPDATE','DEACTIVATE'].includes(String(v.action)));
   requireValue(v.action==='CREATE'?v.locationId===null&&v.expectedVersion===null:uuid(v.locationId)&&typeof v.expectedVersion==='string'&&v.expectedVersion.length<=128);
   if(v.action==='DEACTIVATE')requireValue(v.command===null);else parseManualLocation(v.command);return;
  }
 }
}
export async function readPresentationBytes(response:Response,maximum=XRAY_PRESENTATION_RESPONSE_BYTES,signal?:AbortSignal):Promise<Uint8Array>{
 signal?.throwIfAborted();if(!response.body)throw Error('XRAY_RESPONSE_INVALID');
 const reader=response.body.getReader();let size=0;const parts:Uint8Array[]=[];
 const abort=()=>{void reader.cancel().catch(()=>{})};signal?.addEventListener('abort',abort,{once:true});
 try{for(;;){signal?.throwIfAborted();const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>maximum)throw Error('XRAY_RESPONSE_INVALID');parts.push(part.value)}
  signal?.throwIfAborted();const result=new Uint8Array(size);let at=0;for(const part of parts){result.set(part,at);at+=part.length}return result;
 }finally{signal?.removeEventListener('abort',abort);void reader.cancel().catch(()=>{});reader.releaseLock()}
}
export function validatePresentationResult(operation:PresentationOperation,bytes:Uint8Array,mime:string,filename:string|null,command?:unknown):void{
 const input=command&&typeof command==='object'?command as Record<string,unknown>:null;
 if(mime!==PRESENTATION_ROUTES[operation].mime)throw Error('XRAY_RESPONSE_INVALID');
 if(mime!=='application/json'){
  const prefix=new TextDecoder().decode(bytes.slice(0,5));
  if(operation==='financialExcel'?prefix.slice(0,2)!=='PK'||!/^Financials_(?:MSR_)?[0-9]{10}(?:_[A-Za-z0-9_-]+)?\.xlsx$/.test(filename??''):prefix!=='%PDF-'||!new RegExp('^'+(operation==='kysPdf'?'KYS':'KRS')+'_[0-9]{10}(?:_[0-9-]{10})?\\.pdf$').test(filename??''))throw Error('XRAY_RESPONSE_INVALID');
  if(input?.nip&&!(filename??'').startsWith((operation==='financialExcel'?'Financials_'+(filename?.startsWith('Financials_MSR_')?'MSR_':''):operation==='kysPdf'?'KYS_':'KRS_')+input.nip))throw Error('XRAY_RESPONSE_INVALID');
  return;
 }
 const value:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 if(!value||Object.getPrototypeOf(value)!==Object.prototype)throw Error('XRAY_RESPONSE_INVALID');
 const v=value as Record<string,unknown>;
 if(operation==='revealPesel'&&(!record(v,['pesel'])||typeof v.pesel!=='string'||!/^\d{11}$/.test(v.pesel)))throw Error('XRAY_RESPONSE_INVALID');
 if(operation==='registryStatus'&&(!record(v,['enabled'])||typeof v.enabled!=='boolean'))throw Error('XRAY_RESPONSE_INVALID');
 if(operation==='mapReadiness'&&(!record(v,['ready'])||v.ready!==true))throw Error('XRAY_RESPONSE_INVALID');
 if(operation==='registrySearch'&&(!record(v,['candidates','coverage'])||v.coverage!=='PROGRESSIVE'||!Array.isArray(v.candidates)||v.candidates.length>10))throw Error('XRAY_RESPONSE_INVALID');
 if(operation==='registryVerify'&&(!record(v,['krs','name','nip','locality','selectionRef'])||!nip(v.krs)||!nip(v.nip)||typeof v.name!=='string'||!v.name.trim()||v.name.length>1000||v.locality!==null&&typeof v.locality!=='string'||typeof v.selectionRef!=='string'||!/^KRS:[0-9]{10}:[a-f0-9]{64}$/.test(v.selectionRef)||input?.krs&&v.krs!==input.krs))throw Error('XRAY_RESPONSE_INVALID');
 if(operation==='locations'&&input?.action==='READ'){
  const allowed=['supplierId','items','offset','limit','total','hasMore','collectionVersion','coverage','geocodingAvailable'];
  if(Object.keys(v).some(k=>!allowed.includes(k))||v.supplierId!==input.supplierId||!Array.isArray(v.items)||v.items.length>100||!Number.isInteger(v.total)||typeof v.hasMore!=='boolean')throw Error('XRAY_RESPONSE_INVALID');
  if(v.items.some(item=>!item||typeof item!=='object'||(item as Record<string,unknown>).supplierId!==input.supplierId))throw Error('XRAY_RESPONSE_INVALID');
 }
 if(operation==='webIdentity'){
  const w=v as unknown as SupplierWebIdentityData;
  if(!record(v,['status','websiteUrl','logoDataUrl','logoSourceUrl','evidenceUrl','method','checkedAt'])||!['FOUND','PENDING','NOT_FOUND','UNAVAILABLE'].includes(w.status))throw Error('XRAY_RESPONSE_INVALID');
 }
}
