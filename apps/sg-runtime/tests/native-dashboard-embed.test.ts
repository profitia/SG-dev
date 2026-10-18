import assert from 'node:assert/strict'
import test from 'node:test'
import { openEmbeddedReadClient, EmbeddedReadUnavailable, type EmbeddedSelection } from '@profitia/platform-contracts/embedded-read-channel'
import { nativeDashboardContext, openNativeDashboardReadHost, attachNativeDashboardEmbed } from '../lib/platform/native-dashboard-embed'
import placement from '../../dashboard-preview/deployment/native-forecast-targets.json'

const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222'
const binding = placement.environments.development.embedding, parentOrigin = binding.parentOrigins[0]
const analyticsUrl = `${binding.childOrigin}/pl?embed=1&variantId=forecast-portfolio-v3&showForecast=false&preparedReadsOnly=1&seriesId=stored_series&range=1Y&organisationId=${A}`
const token = 'fixture_header.fixture_payload.fixture_signature'
const context = () => nativeDashboardContext(analyticsUrl,parentOrigin)
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r }); return { promise, resolve } }
const selection = { kind:'history',parameters:{range:'1Y'} }
function response(path: URL, body: unknown = { values:[0,null] }) {
  const p = path.searchParams, seriesId=p.get('seriesId'), model=p.get('model'), basis=p.get('targetBasis')
  const kind=path.pathname.endsWith('analytics-series')?'history':path.pathname.endsWith('readiness')?'capabilities':path.pathname.endsWith('capability')?'capability':path.pathname.endsWith('verification')?'verification':'current'
  const resource=kind==='history'?`market-analytics:${seriesId}`:kind==='capabilities'?`forecast-readiness:${seriesId}`
    :kind==='capability'?`forecast-capability:${seriesId}:${p.get('modelId')}:${p.get('targetSemantics')}`
      :`forecast-${kind}:${seriesId}:${model}:${basis}`+(kind==='verification'?':FAST':'')+(p.has('sourceFrequency')?`:${p.get('sourceFrequency')}:${p.get('targetCadence')}`:'')
  const feature=kind==='history'?'market':'forecast',projection=kind==='history'?binding.historyProjection:placement.projections[kind]
  return Response.json(body,{headers:{'x-profitia-operation-contract':placement.operationContract,'x-profitia-application':'spendguru',
    'x-profitia-environment':'development',[`x-profitia-${feature}-projection`]:projection,[`x-profitia-${feature}-resource`]:resource}})
}

test('public child placement and routing cannot borrow another application, org selector, environment or warmup',()=>{
  assert.deepEqual(context(),{parentOrigin,childOrigin:binding.childOrigin,seriesId:'stored_series',organisationId:A})
  assert(Object.isFrozen(context()))
  for(const edit of[(u:URL)=>{u.hostname='foreign.test'},(u:URL)=>{u.username='forged'},(u:URL)=>{u.hash='fragment'},
    (u:URL)=>{u.searchParams.set('organisationId','forged')},(u:URL)=>{u.searchParams.append('organisationId',B)},
    (u:URL)=>{u.searchParams.set('warmCurrentForecast','1')},(u:URL)=>{u.searchParams.set('preparedReadsOnly','0')},
    (u:URL)=>{u.searchParams.set('userId','forged')},(u:URL)=>{u.searchParams.set('seriesId','*')},
    (u:URL)=>{u.searchParams.set('variantId','historical-v1')}]){
    const url=new URL(analyticsUrl);edit(url);assert.throws(()=>nativeDashboardContext(url.toString(),parentOrigin),EmbeddedReadUnavailable)
  }
  for(const origin of['http://localhost:3000','https://foreign.test','https://spendguru-porr-demo.onrender.com'])assert.throws(()=>nativeDashboardContext(analyticsUrl,origin),EmbeddedReadUnavailable)
})

test('real read ports pin backend destination/series/org and keep current host credentials out of the child result',async t=>{
  const channel=new MessageChannel(),calls:Array<{url:URL;headers:Headers}>=[]
  let tokens=0,deny=false
  const mutable={...context()}
  const host=openNativeDashboardReadHost({port:channel.port1,instanceId:'fixture_instance_0001',context:mutable,
    getToken:async()=>{tokens++;return token},fetch:async(input,init)=>{
      const url=new URL(String(input)),headers=new Headers(init?.headers);calls.push({url,headers})
      assert.equal(url.origin,parentOrigin);assert.equal(init?.credentials,'omit');assert.equal(init?.redirect,'manual');assert.equal(init?.cache,'no-store')
      assert.deepEqual([...headers.keys()],['authorization']);assert.equal(headers.get('authorization'),`Bearer ${token}`)
      return deny?Response.json({privateDiagnostic:'hidden'},{status:403}):response(url)
    }})
  const client=openEmbeddedReadClient({port:channel.port2,instanceId:'fixture_instance_0001'})
  t.after(()=>{host.close();client.close()})
  // A mutable caller object cannot rebind an already constructed instance.
  mutable.organisationId=B;mutable.parentOrigin='https://foreign.test'
  const reads:EmbeddedSelection[]=[selection,{kind:'current',parameters:{model:'arima',targetBasis:'POINT_IN_TIME'}},
    {kind:'verification',parameters:{model:'arima',targetBasis:'MONTHLY_AVERAGE',sourceFrequency:'MONTHLY',targetCadence:'MONTHLY'}},
    {kind:'capability',parameters:{modelId:'arima',targetSemantics:'END_OF_PERIOD'}},{kind:'capabilities',parameters:{}}]
  for(const item of reads){
    const result=await client.read(item);assert.deepEqual(result,{status:200,body:{values:[0,null]}})
    assert(!JSON.stringify(result).includes(token));assert(!JSON.stringify(result).includes('authorization'))
    const url=calls.at(-1)!.url;assert.equal(url.searchParams.get('organisationId'),A);assert.equal(url.searchParams.get('seriesId'),'stored_series')
    if(item.kind==='verification')assert.equal(url.searchParams.get('verificationScope'),'FAST')
  }
  assert.equal(tokens,5)
  const before=calls.length
  const invalid:EmbeddedSelection[]=[{...selection,userId:'forged'},{kind:'write',parameters:{}},{kind:'history',parameters:{range:'ALL',organisationId:B}},
    {kind:'history',parameters:{range:'ALL',destination:'https://foreign.test'}},{kind:'current',parameters:{model:'arima',targetBasis:'POINT_IN_TIME',sourceFrequency:'DAILY'}}]
  for(const item of invalid){
    assert.equal((await client.read(item)).status,400)
  }
  assert.equal(calls.length,before);assert.equal(tokens,5)
  deny=true;assert.deepEqual(await client.read(selection),{status:403,body:{error:'Read unavailable.'}});assert.equal(tokens,6)
})

test('missing identity, redirects, missing native metadata and malformed output withhold data without fallback',async t=>{
  for(const mode of['missingIdentity','throwIdentity','redirect','metadata','mime','bytes'] as const)await t.test(mode,async t=>{
    const channel=new MessageChannel();let calls=0
    const host=openNativeDashboardReadHost({port:channel.port1,instanceId:'fixture_instance_0001',context:context(),
      getToken:async()=>{if(mode==='throwIdentity')throw Error('private identity diagnostic');return mode==='missingIdentity'?null:token},
      fetch:async(input)=>{calls++;const url=new URL(String(input)),value=response(url)
        if(mode==='redirect')return new Response(null,{status:302,headers:{location:'https://foreign.test'}})
        if(mode==='metadata')value.headers.delete('x-profitia-environment')
        if(mode==='mime')return new Response('private diagnostic',{headers:{'content-type':'text/html',...Object.fromEntries([...value.headers].filter(([key])=>key!=='content-type'))}})
        if(mode==='bytes')return new Response(' '.repeat(4194305),{headers:value.headers})
        return value
      }})
    const client=openEmbeddedReadClient({port:channel.port2,instanceId:'fixture_instance_0001'});t.after(()=>{host.close();client.close()})
    const result=await client.read(selection);assert.equal(result.status,mode==='missingIdentity'?401:503)
    assert.deepEqual(result.body,{error:'Read unavailable.'});assert.equal(calls,mode==='missingIdentity'||mode==='throwIdentity'?0:1)
  })
})

test('closing during current token retrieval prevents a later backend request',async t=>{
  const channel=new MessageChannel(),entered=deferred(),release=deferred();let calls=0
  const host=openNativeDashboardReadHost({port:channel.port1,instanceId:'fixture_instance_0001',context:context(),
    getToken:async()=>{entered.resolve();await release.promise;return token},fetch:async()=>{calls++;throw Error('Must not fetch')}})
  const client=openEmbeddedReadClient({port:channel.port2,instanceId:'fixture_instance_0001'});t.after(()=>{release.resolve();host.close();client.close()})
  const pending=client.read(selection);await entered.promise;host.close();release.resolve()
  await assert.rejects(pending,EmbeddedReadUnavailable);assert.equal(calls,0)
})

test('window handshake fixture rejects foreign origin/source, duplicate document and unsafe resize before transferring a real port',async t=>{
  const listeners=new Set<EventListener>(),transfers:Array<{data:any;origin:string;port:MessagePort}>=[]
  const child={postMessage(data:any,origin:string,ports:MessagePort[]){transfers.push({data,origin,port:ports[0]})}}
  const windowFixture={location:{origin:parentOrigin},addEventListener(_type:string,listener:EventListener){listeners.add(listener)},removeEventListener(_type:string,listener:EventListener){listeners.delete(listener)}}
  const emit=(data:unknown,origin=binding.childOrigin,source=child)=>{
    const event=Object.assign(new Event('message'),{data,origin,source});for(const listener of listeners)listener(event)
  }
  const heights:number[]=[],connection=attachNativeDashboardEmbed({analyticsUrl,iframe:{contentWindow:child as unknown as Window},
    hostWindow:windowFixture as unknown as Window,getToken:async()=>token,onResize:value=>heights.push(value)})
  t.after(()=>{connection.close();for(const transfer of transfers)transfer.port.close()})
  const ready={type:'profitia.dashboard-read.ready',version:'1.0.0',documentId:A}
  emit(ready,'https://foreign.test');emit(ready,binding.childOrigin,{} as typeof child);emit({...ready,version:'unknown'})
  assert.equal(transfers.length,0)
  emit(ready);assert.equal(transfers.length,1);assert.equal(transfers[0].origin,binding.childOrigin)
  assert(!JSON.stringify(transfers[0].data).includes(token));emit(ready);assert.equal(transfers.length,1)
  emit({type:'sg-dashboard-preview:resize',seriesId:'foreign',height:1000})
  emit({type:'sg-dashboard-preview:resize',seriesId:'stored_series',height:Infinity})
  emit({type:'sg-dashboard-preview:resize',seriesId:'stored_series',height:1000000});assert.deepEqual(heights,[12000])
  emit({...ready,documentId:B});assert.equal(transfers.length,2)
  connection.close();assert.equal(listeners.size,0)
})
