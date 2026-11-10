import {useCallback,useLayoutEffect,useMemo,useState} from 'react'
import {readChartReference,readContextReference,type ChartReference,type SupplierReference} from '../../../../packages/assistant-context-contracts/src/index.mjs'

export type AssistantModule='appshell'|'benchmark_finder'|'xray'|'adp'
/** Volatile display projection only. It neither carries nor proves access. */
export type AssistantScreenContext=Readonly<{supplierName:string;year:number|null;reference?:SupplierReference}>

export function projectXrayAssistantContext(value:unknown):AssistantScreenContext|null {
 if(!value||typeof value!=='object')return null
 const v=value as {schemaVersion?:unknown;application?:unknown;source?:{kind?:unknown;version?:unknown;statementScope?:unknown};supplier?:{name?:unknown;nip?:unknown;krs?:unknown;entityType?:unknown};view?:{page?:unknown;radar?:{year?:unknown;comparisonYear?:unknown}}}
 if(v.schemaVersion!==1||v.application!=='SRM'||v.view?.page!=='supplier-intelligence-dashboard')return null
 const name=v.supplier?.name,year=v.view?.radar?.year
 if(typeof name!=='string'||!name.trim()||name.length>300)return null
 if(year!==null&&(!Number.isInteger(year)||Number(year)<1800||Number(year)>2200))return null
 let reference:SupplierReference|undefined
 if(v.source?.kind==='financial-data-module')try{
  const entityType=v.supplier?.entityType??(typeof v.supplier?.krs==='string'&&/^\d{10}$/.test(v.supplier.krs)?'COMPANY':null)
  const selected=readContextReference({version:'2.0.0',source:'SRM_XRAY',nip:v.supplier?.nip,entityType,krs:v.supplier?.krs??null,
   year,comparisonYear:v.view?.radar?.comparisonYear??null,statementScope:v.source.statementScope,sourceVersion:v.source.version??null})
  if(selected.source==='SRM_XRAY')reference=selected
 }catch{/* A malformed reference cannot become source authority. */}
 return {supplierName:name.trim(),year:year as number|null,...(reference?{reference}:{})}
}

/** Each committed module visit has its own sink. Revoked sinks never become
 * valid again when the user returns to X-Ray. The existing account guard owns
 * session/user/organisation invalidation and unmounts this owner on scope change. */
export function useAssistantScreenContext(module:AssistantModule){
 const lease=useMemo(()=>({module,active:false}),[module])
 const [entry,setEntry]=useState<{lease:typeof lease;context:AssistantScreenContext|null}|null>(null)
 const [benchmark,setBenchmark]=useState<{lease:typeof lease;reference:ChartReference|null}|null>(null)
 useLayoutEffect(()=>{lease.active=true;setEntry(null);return()=>{lease.active=false}},[lease])
 const onXrayContext=useCallback((value:unknown)=>{
  if(!lease.active||lease.module!=='xray')return
  const next=projectXrayAssistantContext(value)
  setEntry(previous=>previous?.lease===lease&&JSON.stringify(previous.context)===JSON.stringify(next)?previous:{lease,context:next})
 },[lease])
 const onBenchmarkContext=useCallback((value:unknown)=>{
  if(!lease.active||lease.module!=='benchmark_finder')return
  let reference:ChartReference|null=null
  try{reference=value===null?null:readChartReference(value)}catch{/* Reference is a hint only. */}
  setBenchmark(previous=>previous?.lease===lease&&JSON.stringify(previous.reference)===JSON.stringify(reference)?previous:{lease,reference})
 },[lease])
 return {context:module==='xray'&&entry?.lease===lease?entry.context:null,onXrayContext,
  assistantReference:module==='benchmark_finder'&&benchmark?.lease===lease?benchmark.reference:module==='xray'&&entry?.lease===lease?entry.context?.reference??null:null,
  benchmarkReference:module==='benchmark_finder'&&benchmark?.lease===lease?benchmark.reference:null,onBenchmarkContext}
}
