import test from 'node:test'
import assert from 'node:assert/strict'
import {setTimeout as pause} from 'node:timers/promises'
import {benchmarkProviderFetch,benchmarkProviderFailure,hasBenchmarkProviderScope,runWithBenchmarkProviderScope,
 scopedBenchmarkProviderState,scopedBenchmarkMetadataClient,type BenchmarkProviderPorts} from '../lib/benchmark/provider-scope'

const absentMetadata=async()=>{throw Error('No fixture metadata client')}
const ports=(fetcher:typeof fetch,loadMetadataClient:BenchmarkProviderPorts['loadMetadataClient']=absentMetadata):BenchmarkProviderPorts=>({macrobond:fetcher,openai:fetcher,loadMetadataClient})
const response=(value:string)=>new Response(value)

test('concurrent organisations use only their own provider ports and cache state across await boundaries',async()=>{
 const key={},seen:string[]=[]
 const one=async(id:string,delay:number)=>runWithBenchmarkProviderScope(ports(async()=>{seen.push(id);await pause(delay);return response(id)}),async()=>{
  assert.equal(hasBenchmarkProviderScope(),true)
  const state=scopedBenchmarkProviderState(key,()=>({owner:id,calls:0}))!;state.calls++
  await pause(delay)
  assert.equal(scopedBenchmarkProviderState(key,()=>({owner:'wrong',calls:0})),state)
  assert.equal(await(await benchmarkProviderFetch('macrobond','https://api.macrobondfinancial.com/')).text(),id)
  assert.equal(await(await benchmarkProviderFetch('openai','https://api.openai.com/v1/responses')).text(),id)
  return state
 })
 const [a,b]=await Promise.all([one('organisation-a',3),one('organisation-b',1)])
 assert.deepEqual(a,{owner:'organisation-a',calls:1});assert.deepEqual(b,{owner:'organisation-b',calls:1});assert.notEqual(a,b)
 assert.equal(seen.length,4);assert.equal(hasBenchmarkProviderScope(),false);assert.equal(scopedBenchmarkProviderState(key,()=>({})),undefined)
})
test('an uncertain call cannot be swallowed by business handling or retried through another provider',async()=>{
 const failure=Error('uncertain fixture transport');let calls=0
 await assert.rejects(runWithBenchmarkProviderScope(ports(async()=>{calls++;throw failure}),async()=>{
  await assert.rejects(benchmarkProviderFetch('macrobond','https://api.macrobondfinancial.com/'),e=>e===failure)
  await assert.rejects(benchmarkProviderFetch('openai','https://api.openai.com/v1/responses'),e=>e===failure)
  return {apparent:'success'}
 }),e=>e===failure);assert.equal(calls,1)
})
test('settled provider status remains an ordinary response for the original retry/error algorithm',async()=>{
 let calls=0
 await runWithBenchmarkProviderScope(ports(async()=>{calls++;return new Response(null,{status:calls===1?401:200})}),async()=>{
  assert.equal((await benchmarkProviderFetch('macrobond','https://api.macrobondfinancial.com/')).status,401)
  assert.equal((await benchmarkProviderFetch('macrobond','https://api.macrobondfinancial.com/')).status,200)
 });assert.equal(calls,2)
})
test('metadata resolution uses the exact supplied client and never treats unavailable state as demo access',async()=>{
 const client={} as Awaited<ReturnType<BenchmarkProviderPorts['loadMetadataClient']>>;let loads=0
 await runWithBenchmarkProviderScope(ports(async()=>response('unused'),async()=>{loads++;return client}),async()=>{
  assert.equal(await scopedBenchmarkMetadataClient(),client)
 });assert.equal(loads,1)
 await assert.rejects(scopedBenchmarkMetadataClient(),/scope unavailable/)
})
test('metadata failure remains fatal even when an original caller catches it',async()=>{
 const failure=Error('metadata role refused');let calls=0
 await assert.rejects(runWithBenchmarkProviderScope(ports(async()=>{calls++;return response('forbidden fallback')},async()=>{throw failure}),async()=>{
  await assert.rejects(scopedBenchmarkMetadataClient(),e=>e===failure)
  await assert.rejects(benchmarkProviderFetch('macrobond','https://api.macrobondfinancial.com/'),e=>e===failure)
  return null
 }),e=>e===failure);assert.equal(calls,0)
})
test('an ordinary metadata query failure is retained without copying its payload to logs',async()=>{
 const failure=Error('query fixture'),errors:unknown[]=[]
 await assert.rejects(runWithBenchmarkProviderScope(ports(async()=>response('unused')),async()=>{
  try{benchmarkProviderFailure(failure)}catch(error){errors.push(error)}
  return 'caught'
 }),e=>e===failure);assert.deepEqual(errors,[failure])
})
test('nested scopes cannot erase the outer uncertainty or replace its ports',async()=>{
 await runWithBenchmarkProviderScope(ports(async()=>response('outer')),async()=>{
  await assert.rejects(runWithBenchmarkProviderScope(ports(async()=>response('inner')),async()=>null),/scope unavailable/)
  assert.equal(await(await benchmarkProviderFetch('macrobond','https://api.macrobondfinancial.com/')).text(),'outer')
 })
})
test('detached work after close cannot reactivate old ports or fall through to the network',async()=>{
 let calls=0;let release!:()=>void;const latch=new Promise<void>(resolve=>{release=resolve});let detached!:Promise<void>
 await runWithBenchmarkProviderScope(ports(async()=>{calls++;return response('bad')}),async()=>{
  detached=(async()=>{await latch;await assert.rejects(benchmarkProviderFetch('macrobond','https://api.macrobondfinancial.com/'),/scope unavailable/)})();return null
 });release();await detached;assert.equal(calls,0)
})
test('unknown, accessor, inherited or missing ports fail before the business action',async()=>{
 let ran=false;const valid=ports(async()=>response('unused'))
 for(const candidate of [{...valid,unexpected:()=>null},{macrobond:valid.macrobond},Object.create(valid),
  Object.defineProperty({...valid},'macrobond',{get(){throw Error('getter must not execute')},enumerable:true})]){
  await assert.rejects(runWithBenchmarkProviderScope(candidate as BenchmarkProviderPorts,async()=>{ran=true}),/scope unavailable/)
 }assert.equal(ran,false)
})

// Import the original clients after configuring only synthetic server values.
// These tests do not replace fetch globally or contact a real provider.
async function originalMacrobond(){
 process.env.MACROBOND_CLIENT_ID='fixture-client';process.env.MACROBOND_CLIENT_SECRET='fixture-value'
 return import('../lib/benchmark/macrobond')
}
test('the original Macrobond client sends actual OAuth and query calls through the scoped port, preserving settled 401 refresh',async()=>{
 const client=await originalMacrobond();let tokens=0,queries=0
 await runWithBenchmarkProviderScope(ports(async(input,init)=>{
  const url=new URL(String(input))
  if(url.pathname==='/mbauth/connect/token'){
   tokens++;assert.equal(new URLSearchParams(init?.body as URLSearchParams).get('grant_type'),'client_credentials')
   return Response.json({access_token:'fixture-access-'+tokens,expires_in:3600})
  }
  assert.equal(url.origin,'https://api.macrobondfinancial.com');assert.equal(url.pathname,'/v1/series/fetchentities');queries++
  assert.equal(new Headers(init?.headers).get('authorization'),'Bearer fixture-access-'+tokens)
  assert.deepEqual(JSON.parse(init?.body as string),[{name:'fixture_series'}])
  return queries===1?new Response(null,{status:401}):Response.json([{metadata:{Title:'Original metadata'}}])
 }),async()=>{assert.deepEqual(await client.fetchMacrobondEntityMetadata('fixture_series'),{Title:'Original metadata'})})
 assert.equal(tokens,2);assert.equal(queries,2)
})
test('the original metadata cache is reused inside one scope and never borrowed by a second operation',async()=>{
 const client=await originalMacrobond();let queries=0
 const fetcher:typeof fetch=async(input)=>{
  const url=new URL(String(input));if(url.pathname==='/mbauth/connect/token')return Response.json({access_token:'fixture-access',expires_in:3600})
  assert.equal(url.pathname,'/v1/metadata/getattributeinformation');queries++
  return Response.json([{description:'Original definition',canListValues:true,appliesTo:['TimeSeries']}])
 }
 for(let operation=0;operation<2;operation++)await runWithBenchmarkProviderScope(ports(fetcher),async()=>{
  const before=queries,a=await client.getMacrobondMetadataDefinitions();assert.equal(a.length,13);assert.equal(queries-before,13)
  assert.deepEqual(await client.getMacrobondMetadataDefinitions(),a);assert.equal(queries-before,13)
 });assert.equal(queries,26)
})
test('the original metadata reader uses its supplied ordinary client, and a caught SQL error still prevents publication',async()=>{
 const client=await import('../lib/benchmark/metadata-store');let reads=0
 const failure=Error('ordinary metadata SQL refused')
 const metadata={benchmarkMetadataFacetRecord:{findMany:async()=>{reads++;throw failure}}} as unknown as Awaited<ReturnType<BenchmarkProviderPorts['loadMetadataClient']>>
 await assert.rejects(runWithBenchmarkProviderScope(ports(async()=>response('unused'),async()=>metadata),async()=>{
  await assert.rejects(client.getStoredBenchmarkMetadataDefinitions(),e=>e===failure);return {apparent:'success'}
 }),e=>e===failure);assert.equal(reads,1)
})
