import {nip} from '@profitia/krs-registry-contracts'
import {GusError} from './gus-bir.js'
import type {GusMapping} from './gus-bir.js'
export type NipResolution<T>={status:'PRIMARY';value:T}|{status:'FALLBACK';reason:string}
export type RegistryTelemetry={event:'REGISTRY_PRIMARY';durationMs:number;outcome:'PRIMARY'|'FALLBACK'|'BLOCKED';reason:string}
/** Provider routing only, after the caller proves CEIDG absence and admits the
 * current HUMAN request. Neither a DTO nor this timer authorizes paid effects. */
export function createNipResolver<T>(options:{gus:(nip:string,key:string,signal:AbortSignal)=>Promise<GusMapping>;
 krs:(mapping:GusMapping,key:string,signal:AbortSignal)=>Promise<T>;telemetry:(event:RegistryTelemetry)=>void;now?:()=>number;timeoutMs?:number}){
 const now=options.now??Date.now,timeout=options.timeoutMs??3000
 if(!Number.isInteger(timeout)||timeout<100||timeout>30000)throw TypeError('Explicit bounded registry deadline required')
 return Object.freeze({async resolve(n:string,key:string,callerSignal:AbortSignal):Promise<NipResolution<T>>{
  if(!nip(n)||!/^[a-f0-9]{64}$/.test(key))throw new GusError('INVALID_NIP_RESOLUTION','AUTHORITY')
  callerSignal.throwIfAborted();const start=now(),controller=new AbortController()
  const signal=AbortSignal.any([callerSignal,controller.signal])
  let timer:ReturnType<typeof setTimeout>|undefined,abort:(()=>void)|undefined
  const pending=(async():Promise<NipResolution<T>>=>{
   const mapping=await options.gus(n,key,signal);signal.throwIfAborted()
   if(mapping.status!=='MATCH')return {status:'FALLBACK',reason:mapping.reason}
   if(mapping.nip!==n)throw new GusError('GUS_NIP_MISMATCH','IDENTITY')
   const value=await options.krs(mapping,key,signal);signal.throwIfAborted();return {status:'PRIMARY',value}
  })()
  try{
   const deadline=new Promise<never>((_,reject)=>{
    timer=setTimeout(()=>{controller.abort(new GusError('PRIMARY_DEADLINE'));reject(new GusError('PRIMARY_DEADLINE'))},timeout)
    abort=()=>reject(callerSignal.reason);callerSignal.addEventListener('abort',abort,{once:true});if(callerSignal.aborted)abort()
   })
   const result=await Promise.race([pending,deadline])
   options.telemetry({event:'REGISTRY_PRIMARY',durationMs:now()-start,outcome:result.status,reason:result.status==='PRIMARY'?'VERIFIED':result.reason});return result
  }catch(error){
   if(callerSignal.aborted)throw error
   // Only explicit provider failures qualify. Authority, budget, identity,
   // uncertain delivery and unknown errors never become a paid fallback.
   if(error instanceof GusError&&error.category==='UNAVAILABLE'){
    options.telemetry({event:'REGISTRY_PRIMARY',durationMs:now()-start,outcome:'FALLBACK',reason:error.code})
    return {status:'FALLBACK',reason:error.code}
   }
   options.telemetry({event:'REGISTRY_PRIMARY',durationMs:now()-start,outcome:'BLOCKED',reason:'PRIMARY_REFUSED'});throw error
  }finally{if(timer)clearTimeout(timer);if(abort)callerSignal.removeEventListener('abort',abort);controller.abort()}
 }})
}
