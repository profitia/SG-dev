import {AsyncLocalStorage} from 'node:async_hooks'
import {channel} from 'node:diagnostics_channel'
import {performance} from 'node:perf_hooks'
type Stage='databaseRead'|'cacheValidity'|'sourceSyncCheck'|'sourceSyncWrite'|'googleHttp'|'geocodingCommand'|'cacheStore'|'expiry'
type State={started:number;stages:Partial<Record<Stage,{count:number;durationMs:number}>>}
const active=new AsyncLocalStorage<State>()
const add=(state:State,stage:Stage,started:number)=>{
 const value=state.stages[stage]??={count:0,durationMs:0};value.count++;value.durationMs+=Math.max(0,performance.now()-started)
}
export async function measureLocation<T>(stage:Stage,run:()=>Promise<T>):Promise<T>{
 const state=active.getStore(),started=performance.now();try{return await run()}finally{if(state)add(state,stage,started)}
}
/** Only fixed stages and timings leave this module. No address, coordinate,
 * URL query, key, user, organisation, payload, or provider response is logged. */
export function withLocationTelemetry<T>(run:()=>Promise<T>,emit:(value:unknown)=>void=console.info):Promise<T>{
 const state:State={started:performance.now(),stages:{}}
 return active.run(state,async()=>{try{return await run()}finally{
  try{emit({event:'srm_location_timing',version:'1.0.0',durationMs:Math.round((performance.now()-state.started)*1000)/1000,
   stages:Object.fromEntries(Object.entries(state.stages).map(([key,value])=>[key,{count:value.count,durationMs:Math.round(value.durationMs*1000)/1000}]))})}catch{/* Telemetry cannot change an admitted operation. */}
 }})
}
// Observe the existing governed Source transport; never replace it with fetch.
const pending=new WeakMap<object,{state:State;started:number}>()
channel('undici:request:create').subscribe(value=>{
 const request=(value as {request?:{origin?:unknown;path?:unknown}})?.request,state=active.getStore()
 if(state&&request&&String(request.origin)==='https://maps.googleapis.com'&&typeof request.path==='string'&&request.path.split('?')[0]==='/maps/api/geocode/json')
  pending.set(request,{state,started:performance.now()})
})
const complete=(value:unknown)=>{const request=(value as {request?:object})?.request;if(!request)return;const p=pending.get(request);if(p){pending.delete(request);add(p.state,'googleHttp',p.started)}}
channel('undici:request:trailers').subscribe(complete)
channel('undici:request:error').subscribe(complete)
