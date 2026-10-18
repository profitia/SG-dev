import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {NextRequest} from 'next/server'
import {openEmbeddedReadClient} from '@profitia/platform-contracts/embedded-read-channel'
import {readNativeEmbeddedConfiguration,createEmbeddedChartFetch,connectNativeEmbeddedRead} from '../lib/platform/native-embedded-read'
import {selectNativeEmbedPage} from '../lib/platform/native-chart-publication'
import {NativeEmbeddedReadProvider} from '../components/native-embedded-read-provider'
import {attachNativeDashboardEmbed} from '../../sg-runtime/lib/platform/native-dashboard-embed'
import middleware from '../middleware'
import placement from '../deployment/native-forecast-targets.json'

const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222'
const binding=placement.environments.development.embedding,parentOrigin=binding.parentOrigins[0]
const url=`${binding.childOrigin}/pl?embed=1&variantId=forecast-portfolio-v3&showForecast=false&preparedReadsOnly=1&seriesId=shared_series&range=1Y&organisationId=${A}`
const env={APP_ENV:'development',TARGET_ENVIRONMENT:'development',PROFITIA_AUTH_PROVIDER:'clerk',PROFITIA_FORECAST_API_ORIGIN:parentOrigin,
  PROFITIA_FORECAST_API_CONFIGURATION_VERSION:'sg2-native-forecast-relay-dev-v1',PROFITIA_NATIVE_EMBED_ENABLED:'true'}
const configuration=readNativeEmbeddedConfiguration(env)!,context=selectNativeEmbedPage(url)!
const token='fixture_header.fixture_payload.fixture_signature'
const facts={providerSeries:{provider:{providerCode:'MACROBOND',displayName:'Macrobond'},providerSeriesId:'shared_series',providerSeriesKey:null},
  displayName:'Stored source',latestValue:0,frequency:'MONTHLY',currency:null,unit:'UNSUPPORTED_UNIT',source:'Synthetic',range:'ALL',
  historical:[{date:'2025-01-01T00:00:00.000Z',value:10},{date:'2025-02-01T00:00:00.000Z',value:0},{date:'2025-03-01T00:00:00.000Z',value:null}]}
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=r});return{promise,resolve}}

async function windowTransport(t:test.TestContext,source:(input:RequestInfo|URL,init?:RequestInit)=>Promise<Response>){
  const parentListeners=new Set<EventListener>(),childListeners=new Map<string,Set<EventListener>>()
  const ready=deferred(),unavailable=deferred(),posts:Array<{type:string;target:string}>=[]
  let read!:typeof fetch,failures=0
  const dispatch=(listeners:Iterable<EventListener>,data:unknown,origin:string,source:unknown,ports:MessagePort[]=[])=>{
    const event=Object.assign(new Event('message'),{data,origin,source,ports});for(const listener of listeners)listener(event)
  }
  const parent={location:{origin:parentOrigin},addEventListener(_type:string,listener:EventListener){parentListeners.add(listener)},
    removeEventListener(_type:string,listener:EventListener){parentListeners.delete(listener)},postMessage(data:{type:string},target:string){
      posts.push({type:data.type,target});if(target===parentOrigin)dispatch(parentListeners,data,binding.childOrigin,child)
    }}
  const child={location:{origin:binding.childOrigin,href:url},parent,
    addEventListener(type:string,listener:EventListener){const set=childListeners.get(type)??new Set();set.add(listener);childListeners.set(type,set)},
    removeEventListener(type:string,listener:EventListener){childListeners.get(type)?.delete(listener)},
    postMessage(data:{type:string},target:string,ports:MessagePort[]){posts.push({type:data.type,target});if(target===binding.childOrigin)dispatch(childListeners.get('message')??[],data,parentOrigin,parent,ports)}}
  const host=attachNativeDashboardEmbed({iframe:{contentWindow:child as unknown as Window},analyticsUrl:url,hostWindow:parent as unknown as Window,
    getToken:async()=>token,fetch:source})
  const client=connectNativeEmbeddedRead({hostWindow:child as unknown as Window,configuration,context,
    onReady:value=>{read=value;ready.resolve()},onUnavailable:()=>{failures++;unavailable.resolve()}})
  t.after(()=>{client.close();host.close()});await ready.promise
  return{read,host,client,posts,unavailable:unavailable.promise,failures:()=>failures,parentListeners,childListeners}
}

test('native shell configuration is separately disabled and cannot borrow Stage, another host or a malformed flag',()=>{
  assert(configuration);assert(Object.isFrozen(configuration));assert(Object.isFrozen(configuration.parentOrigins))
  for(const patch of[{PROFITIA_NATIVE_EMBED_ENABLED:undefined},{PROFITIA_NATIVE_EMBED_ENABLED:'false'},{PROFITIA_NATIVE_EMBED_ENABLED:'TRUE'},
    {APP_ENV:'staging'},{TARGET_ENVIRONMENT:'production'},{PROFITIA_AUTH_PROVIDER:'legacy_demo'},{RENDER_SERVICE_ID:'foreign-service'},
    {PROFITIA_FORECAST_API_ORIGIN:'https://foreign.test'}])assert.equal(readNativeEmbeddedConfiguration({...env,...patch}),null)
})

test('actual parent/child controllers with window fixtures and real ports preserve the original history mapping without child credentials',async t=>{
  const calls:URL[]=[]
  const connected=await windowTransport(t,async(input,init)=>{
    const target=new URL(String(input));calls.push(target)
    assert.equal(target.origin,parentOrigin);assert.equal(target.pathname,'/api/benchmark/analytics-series')
    assert.equal(target.searchParams.get('organisationId'),A);assert.equal(target.searchParams.get('seriesId'),'shared_series')
    assert.deepEqual([...new Headers(init?.headers)],[['authorization',`Bearer ${token}`]])
    return Response.json(facts,{headers:{'x-profitia-operation-contract':placement.operationContract,'x-profitia-application':'spendguru','x-profitia-environment':'development',
      'x-profitia-market-projection':binding.historyProjection,'x-profitia-market-resource':'market-analytics:shared_series'}})
  })
  for(let n=0;n<2;n++){
    const response=await connected.read('/api/series?seriesId=shared_series&range=ALL&locale=pl')
    assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store')
    const value=await response.json();assert.deepEqual(value.historical.map((point:{value:unknown})=>point.value),[10,0,null])
    assert.equal(value.sourceInfo.currency,null);assert.equal(value.sourceInfo.unit,'UNSUPPORTED_UNIT');assert.equal(value.forecastAnchor.value,null)
    assert(!JSON.stringify(value).includes(token))
  }
  assert.equal(calls.length,2);assert(connected.posts.every(value=>value.target!=='*'))
  connected.host.close();await connected.unavailable;assert.equal(connected.failures(),1)
  assert.equal((await connected.read('/api/series?seriesId=shared_series&range=ALL')).status,503)
  connected.client.close();assert.equal(connected.parentListeners.size,0)
})

test('the existing four read selections map through the same controller without changing monthly defaults or FAST scope',async t=>{
  const paths:string[]=[]
  const connected=await windowTransport(t,async(input)=>{
    const target=new URL(String(input)),p=target.searchParams;paths.push(target.pathname)
    const kind=target.pathname.endsWith('readiness')?'capabilities':target.pathname.endsWith('capability')?'capability':target.pathname.endsWith('verification')?'verification':'current'
    const resource=kind==='capabilities'?'forecast-readiness:shared_series':kind==='capability'?'forecast-capability:shared_series:naive:MONTHLY_AVERAGE'
      :`forecast-${kind}:shared_series:naive:MONTHLY_AVERAGE`+(kind==='verification'?':FAST':'')
    if(kind==='verification')assert.equal(p.get('verificationScope'),'FAST')
    const body=kind==='capabilities'?{status:'AVAILABLE',seriesId:'shared_series',variants:Array.from({length:12},()=>({seriesId:'shared_series'}))}
      :{status:'AVAILABLE',seriesId:'shared_series',modelId:'naive',targetBasis:'MONTHLY_AVERAGE',targetSemantics:'MONTHLY_AVERAGE',
        currentForecast:{'1M':{forecastValue:0}},verification:{'1M':{origins:0,metrics:null}}}
    return Response.json(body,{headers:{'x-profitia-operation-contract':placement.operationContract,'x-profitia-application':'spendguru','x-profitia-environment':'development',
      'x-profitia-forecast-projection':placement.projections[kind],'x-profitia-forecast-resource':resource}})
  })
  for(const path of['/api/benchmark-forecast/current?seriesId=shared_series&model=naive',
    '/api/benchmark-forecast/verification?seriesId=shared_series&model=naive',
    '/api/benchmark-forecast/current/capability?seriesId=shared_series&modelId=naive&targetBasis=MONTHLY_AVERAGE',
    '/api/benchmark-forecast/current/capabilities?seriesId=shared_series'])assert.equal((await connected.read(path)).status,200,path)
  assert.deepEqual(paths,['/api/benchmark/forecast/current','/api/benchmark/forecast/verification','/api/internal/forecast/capability','/api/internal/forecast/readiness'])
})

test('foreign subject/org, credentials, private APIs and writes refuse before any port request',async()=>{
  let calls=0,failed=0
  const client={read:async()=>{calls++;return{status:200,body:null}}}
  const read=createEmbeddedChartFetch(client,configuration,context,()=>{failed++})
  for(const path of['/api/series?seriesId=foreign&range=ALL',`/api/series?seriesId=shared_series&organisationId=${B}`,
    '/api/series?seriesId=shared_series&seriesId=shared_series','/api/series?seriesId=shared_series&userId=forged',
    'https://foreign.test/api/series?seriesId=shared_series','/api/records','/api/components','/api/benchmark-forecast/progressive?seriesId=shared_series']){
    assert.equal((await read(path)).status,400,path)
  }
  assert.equal((await read('/api/series?seriesId=shared_series',{headers:{authorization:'synthetic_fixture'}})).status,400)
  assert.equal((await read('/api/benchmark-forecast/current/prepare',{method:'POST',body:'{}'})).status,405)
  assert.equal(calls,0);assert.equal(failed,0)
})

test('a forecast permission refusal does not become a grant or remove independently permitted history; history/session refusal invalidates the view',async()=>{
  let failed=0
  for(const status of[403,401]){
    const read=createEmbeddedChartFetch({read:async()=>({status,body:{error:'hidden'}})},configuration,context,()=>{failed++})
    assert.equal((await read('/api/benchmark-forecast/current?seriesId=shared_series&model=naive')).status,status)
  }
  assert.equal(failed,1)
  const read=createEmbeddedChartFetch({read:async()=>({status:403,body:{error:'hidden'}})},configuration,context,()=>{failed++})
  const response=await read('/api/series?seriesId=shared_series');assert.equal(response.status,403)
  assert(!((await response.text()).includes('hidden')));assert.equal(failed,2)
})

test('a neutral SSR shell does not expose or render its data view before the channel is ready',()=>{
  const html=renderToStaticMarkup(React.createElement(NativeEmbeddedReadProvider,{configuration,context},React.createElement('div',null,'protected_child_fixture')))
  assert(!html.includes('protected_child_fixture'));assert(html.includes('role="status"'))
})

test('actual middleware admits only the explicitly enabled neutral embed and fixes its frame ancestors',async()=>{
  const previous=Object.fromEntries(Object.keys(env).map(key=>[key,process.env[key]]));Object.assign(process.env,env)
  try{
    const response=await middleware(new NextRequest(url));assert.equal(response.status,200)
    assert.equal(response.headers.get('cache-control'),'private, no-store')
    assert.equal(response.headers.get('content-security-policy'),`frame-ancestors ${binding.parentOrigins.join(' ')}`)
    for(const value of[`${binding.childOrigin}/pl`,`${url}&warmCurrentForecast=1`,url.replace('range=1Y','range=ALL'),`${binding.childOrigin}/api/records`]){
      assert.equal((await middleware(new NextRequest(value))).status,503,value)
    }
    process.env.PROFITIA_NATIVE_EMBED_ENABLED='false';assert.equal((await middleware(new NextRequest(url))).status,503)
  }finally{for(const[key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value}}
})
