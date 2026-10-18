import assert from 'node:assert/strict'
import test from 'node:test'
import {createHash} from 'node:crypto'
import {readNativeEmbeddedConfiguration,connectNativeEmbeddedRead} from '../lib/platform/native-embedded-read'
import {connectNativeEmbeddedCommand,type NativeForecastSubmitter} from '../lib/platform/native-embedded-command'
import {selectNativeEmbedPage} from '../lib/platform/native-chart-publication'
import {attachNativeDashboardEmbed} from '../../sg-runtime/lib/platform/native-dashboard-embed'
import placement from '../deployment/native-forecast-targets.json'
const binding=placement.environments.development.embedding,parentOrigin=binding.parentOrigins[0]
const A='11111111-1111-4111-8111-111111111111',url=`${binding.childOrigin}/pl?embed=1&variantId=forecast-portfolio-v3&preparedReadsOnly=1&seriesId=shared_series&organisationId=${A}`
const context=selectNativeEmbedPage(url)!,command={kind:'CURRENT',modelId:'naive',targetSemantics:'MONTHLY_AVERAGE'} as const
const env={APP_ENV:'development',TARGET_ENVIRONMENT:'development',PROFITIA_AUTH_PROVIDER:'clerk',PROFITIA_FORECAST_API_ORIGIN:parentOrigin,
  PROFITIA_FORECAST_API_CONFIGURATION_VERSION:'sg2-native-forecast-relay-dev-v1',PROFITIA_NATIVE_EMBED_ENABLED:'true',PROFITIA_NATIVE_COMMAND_ENABLED:'true'}
const configuration=readNativeEmbeddedConfiguration(env)!
test('command capability needs its separate explicit flag, while old read configuration remains unchanged',()=>{
  assert(configuration.commands);assert.equal(configuration.commands.configurationVersion,binding.commands.configurationVersion)
  assert.equal(readNativeEmbeddedConfiguration({...env,PROFITIA_NATIVE_COMMAND_ENABLED:'false'})?.commands,undefined)
  assert.equal(readNativeEmbeddedConfiguration({...env,PROFITIA_NATIVE_COMMAND_ENABLED:undefined})?.commands,undefined)
  for(const flag of['TRUE','1','yes',''])assert.equal(readNativeEmbeddedConfiguration({...env,PROFITIA_NATIVE_COMMAND_ENABLED:flag}),null)
  assert.equal(readNativeEmbeddedConfiguration({...env,PROFITIA_NATIVE_EMBED_ENABLED:'false'}),null)
})
test('actual two window controllers and real ports keep read fetch read-only and submit only an explicit command with stable retry intent',async t=>{
  const parentListeners=new Set<EventListener>(),childListeners=new Map<string,Set<EventListener>>(),posts:unknown[]=[],calls:Array<{url:string;init?:RequestInit}>=[]
  const dispatch=(listeners:Iterable<EventListener>,data:unknown,origin:string,source:unknown,ports:MessagePort[]=[])=>{
    const event=Object.assign(new Event('message'),{data,origin,source,ports});for(const listener of [...listeners])listener(event)
  }
  const parent={location:{origin:parentOrigin},addEventListener(_type:string,listener:EventListener){parentListeners.add(listener)},
    removeEventListener(_type:string,listener:EventListener){parentListeners.delete(listener)},postMessage(data:unknown,target:string){
      posts.push(data);if(target===parentOrigin)dispatch(parentListeners,data,binding.childOrigin,child)
    }}
  const child={location:{origin:binding.childOrigin,href:url},parent,
    addEventListener(type:string,listener:EventListener){const set=childListeners.get(type)??new Set();set.add(listener);childListeners.set(type,set)},
    removeEventListener(type:string,listener:EventListener){childListeners.get(type)?.delete(listener)},
    postMessage(data:unknown,target:string,ports:MessagePort[]){posts.push(data);if(target===binding.childOrigin)dispatch(childListeners.get('message')??[],data,parentOrigin,parent,ports)}}
  let fail=false,read!:typeof fetch,submitter!:NativeForecastSubmitter
  const host=attachNativeDashboardEmbed({iframe:{contentWindow:child as unknown as Window},analyticsUrl:url,hostWindow:parent as unknown as Window,
    getToken:async()=> 'fixture_header.fixture_payload.fixture_signature',fetch:async(input,init)=>{
      calls.push({url:String(input),init});const body=String(init?.body)
      if(calls.length===1)throw Error('synthetic lost response; no automatic retry')
      return new Response(JSON.stringify({requestId:A,status:'ACCEPTED'}),{status:202,headers:{'content-type':'application/json',
        'x-profitia-operation-contract':placement.operationContract,'x-profitia-application':'spendguru','x-profitia-environment':'development',
        'x-profitia-forecast-projection':binding.commands.projection,'x-profitia-forecast-configuration':binding.commands.configurationVersion,
        'x-profitia-forecast-delivery':'DELEGATED','x-profitia-forecast-resource':`forecast-request:${createHash('sha256').update(body).digest('hex')}`}})
    }})
  let readReady!:()=>void,commandReady!:()=>void
  const r=new Promise<void>(resolve=>{readReady=resolve}),c=new Promise<void>(resolve=>{commandReady=resolve})
  const reads=connectNativeEmbeddedRead({hostWindow:child as unknown as Window,configuration,context,onReady:value=>{read=value;readReady()},onUnavailable:()=>{fail=true}})
  const commands=connectNativeEmbeddedCommand({hostWindow:child as unknown as Window,configuration,context,documentId:reads.documentId,
    onReady:value=>{submitter=value;commandReady()},onUnavailable:()=>{fail=true}})
  t.after(()=>{commands.close();reads.close();host.close()});await Promise.all([r,c])
  assert.equal(calls.length,0,'Connection and ordinary presentation never auto-submit')
  const refused=await read('/api/internal/forecast/prepare/current',{method:'POST',body:'{}'})
  assert.equal(refused.status,405);assert.equal(calls.length,0,'The original read fetch cannot mutate')
  assert.equal(await submitter.submit(command),'UNKNOWN');assert.equal(calls.length,1)
  assert.equal(await submitter.submit(command),'ACCEPTED');assert.equal(calls.length,2)
  assert.equal(new Headers(calls[0].init?.headers).get('idempotency-key'),new Headers(calls[1].init?.headers).get('idempotency-key'))
  assert(calls.every(call=>new URL(call.url).origin===parentOrigin&&call.init?.method==='POST'))
  assert(!JSON.stringify(posts).includes('fixture_header'));assert(!JSON.stringify(posts).includes(A));assert.equal(fail,false)
  commands.close();assert.equal(await submitter.submit(command),'UNKNOWN')
  assert.equal(calls.length,2,'A closed document cannot invoke a legacy or new request')
})
