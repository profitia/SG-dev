import {record,result,fingerprint,fail} from '../transport.mjs'
export const version='1.1.0'
export const optional=v=>v===undefined||v===null||v===''?null:typeof v==='string'?v:typeof v==='number'&&Number.isFinite(v)?String(v):null
export const utc=v=>typeof v==='string'&&/(?:Z|[+-]\d\d:\d\d)$/.test(v)&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():null
export const safeUrl=value=>{try{const u=new URL(value);if(u.protocol==='https:'&&!u.username&&!u.password&&![...u.searchParams.keys()].some(k=>/api.?key|token|secret/i.test(k)))return u.href}catch{}return null}
export const value=v=>v===undefined||v===null||v===''?null:typeof v==='number'&&Number.isFinite(v)||typeof v==='string'||typeof v==='boolean'?v:fail('PROVIDER_SCHEMA_CHANGED',502)
/** @param {string} family @param {string} provider @param {string} endpoint @param {any} payload @param {{sourceUrl?:string|null,vendorRecordId?:string|null,asOf?:string|null}} options */
export function makeRecord(family,provider,endpoint,payload,{sourceUrl,vendorRecordId=null,asOf=null}={sourceUrl:null}){
 const item=record(family,provider,endpoint,payload,{sourceUrl:sourceUrl??null,vendorRecordId,asOf});item.metadata.contractVersion=version;return item
}
/** @param {string} family @param {string} provider @param {any[]} items @param {{limit?:number,offset?:number,total?:number|null,providerReturned?:number,nativeFilters?:string[],localFilters?:string[]}} options */
export function answer(family,provider,items,{limit=100,offset=0,total=null,providerReturned=items.length,nativeFilters=[],localFilters=[]}={}){
 const selected=items.slice(0,limit),more=total!==null?offset+selected.length<total:items.length>limit?true:null
 const out=result(family,provider,selected,{page:Math.floor(offset/limit)+1,pageSize:limit,total,more,truncated:items.length>limit});out.contractVersion=version
 out.coverage={scope:'PROVIDER_RETURNED_SUBSET',completeness:more?'INCOMPLETE':'UNKNOWN',providerReturned,matchedLocally:items.length,returned:selected.length,nativeFilters,localFilters};return out
}
export function dataset(payload={}){return {kind:'DATASET_METADATA',datasetId:'',name:'',description:null,fields:[],children:[],frequencies:[],facets:[],periodRange:{start:null,end:null},...payload}}
/** @param {string} name @param {string|null} type @param {string|null} description @param {string|null} unit */
export const field=(name,type=null,description=null,unit=null)=>({name,type,description,unit})
export const schemaFingerprint=columns=>fingerprint(columns.map(c=>({name:c.name,type:c.type})).sort((a,b)=>a.name.localeCompare(b.name)))
