import {AsyncLocalStorage} from 'node:async_hooks'
import type {getMarketDataPrisma} from '@/lib/market-data/client'

type MetadataClient=NonNullable<ReturnType<typeof getMarketDataPrisma>>
export type BenchmarkProviderPorts=Readonly<{
 macrobond:typeof fetch
 openai:typeof fetch
 loadMetadataClient:()=>Promise<MetadataClient>
}>
type Scope={ports:BenchmarkProviderPorts;states:Map<object,unknown>;active:boolean;failed:boolean;failure:unknown}
const storage=new AsyncLocalStorage<Scope>()
const unavailable=():never=>{throw Error('Benchmark provider scope unavailable')}
function current(){const scope=storage.getStore();if(scope&&!scope.active)return unavailable();return scope}
export function hasBenchmarkProviderScope(){return current()!==undefined}
export function benchmarkProviderFailure(error:unknown):never{
 const scope=current();if(scope&&!scope.failed){scope.failed=true;scope.failure=error}throw scope?.failed?scope.failure:error
}

/** An explicit receiving composition supplies the real Source and ordinary
 * metadata ports. This scope carries no identity, ALLOW, SQL or product grant.
 * It never substitutes global fetch or a legacy database inside that scope. */
export async function runWithBenchmarkProviderScope<T>(ports:BenchmarkProviderPorts,action:()=>Promise<T>):Promise<T>{
 if(typeof window!=='undefined'||storage.getStore()||!ports||Object.getPrototypeOf(ports)!==Object.prototype
  ||Reflect.ownKeys(ports).length!==3||Object.keys(ports).sort().join(',')!=='loadMetadataClient,macrobond,openai'
  ||Object.values(Object.getOwnPropertyDescriptors(ports)).some(d=>!('value'in d)||!d.enumerable||typeof d.value!=='function')
  ||typeof action!=='function')return unavailable()
 const scope:Scope={ports:Object.freeze({...ports}),states:new Map(),active:true,failed:false,failure:undefined}
 return storage.run(scope,async()=>{
  try{const value=await action();if(scope.failed)throw scope.failure;return value}
  catch(error){throw scope.failed?scope.failure:error}
  finally{scope.active=false;scope.states.clear()}
 })
}

/** Transport uncertainty survives original business error handling. A later
 * call cannot hide it or silently fall back/retry outside the accepted Source. */
export async function benchmarkProviderFetch(provider:'macrobond'|'openai',input:Parameters<typeof fetch>[0],init?:RequestInit):Promise<Response>{
 if(!['macrobond','openai'].includes(provider))return unavailable()
 const scope=current();if(!scope)return fetch(input,init)
 if(scope.failed)throw scope.failure
 try{return await scope.ports[provider](input,init)}
 catch(error){if(!scope.failed){scope.failed=true;scope.failure=error}throw error}
}
export async function scopedBenchmarkMetadataClient():Promise<MetadataClient>{
 const scope=current();if(!scope)return unavailable()
 if(scope.failed)throw scope.failure
 try{const client=await scope.ports.loadMetadataClient();if(!client||typeof client!=='object')return unavailable();return client}
 catch(error){if(!scope.failed){scope.failed=true;scope.failure=error}throw error}
}

/** Caches belong to one receiving operation, never to another actor or the
 * old demo's module globals. The key is private to the original client. */
export function scopedBenchmarkProviderState<T>(key:object,initialise:()=>T):T|undefined{
 const scope=current();if(!scope)return undefined
 if(!scope.states.has(key))scope.states.set(key,initialise())
 return scope.states.get(key) as T
}
