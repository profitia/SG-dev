import {useCallback,useLayoutEffect,useMemo,useState} from 'react'
import {readChartReference,type ChartReference} from '../../../../packages/assistant-context-contracts/src/index.mjs'

export type AssistantModule='appshell'|'benchmark_finder'|'xray'|'adp'
/** Volatile display projection only. It neither carries nor proves access. */
export type AssistantScreenContext=Readonly<{supplierName:string;year:number|null}>

export function projectXrayAssistantContext(value:unknown):AssistantScreenContext|null {
 if(!value||typeof value!=='object')return null
 const v=value as {schemaVersion?:unknown;application?:unknown;supplier?:{name?:unknown};view?:{page?:unknown;radar?:{year?:unknown}}}
 if(v.schemaVersion!==1||v.application!=='SRM'||v.view?.page!=='supplier-intelligence-dashboard')return null
 const name=v.supplier?.name,year=v.view?.radar?.year
 if(typeof name!=='string'||!name.trim()||name.length>300)return null
 if(year!==null&&(!Number.isInteger(year)||Number(year)<1800||Number(year)>2200))return null
 return {supplierName:name.trim(),year:year as number|null}
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
  setEntry(previous=>previous?.lease===lease&&previous.context?.supplierName===next?.supplierName&&previous.context?.year===next?.year?previous:{lease,context:next})
 },[lease])
 const onBenchmarkContext=useCallback((value:unknown)=>{
  if(!lease.active||lease.module!=='benchmark_finder')return
  let reference:ChartReference|null=null
  try{reference=value===null?null:readChartReference(value)}catch{/* Reference is a hint only. */}
  setBenchmark(previous=>previous?.lease===lease&&JSON.stringify(previous.reference)===JSON.stringify(reference)?previous:{lease,reference})
 },[lease])
 return {context:module==='xray'&&entry?.lease===lease?entry.context:null,onXrayContext,
  benchmarkReference:module==='benchmark_finder'&&benchmark?.lease===lease?benchmark.reference:null,onBenchmarkContext}
}
