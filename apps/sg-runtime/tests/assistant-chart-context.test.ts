import test from 'node:test'
import assert from 'node:assert/strict'
import {webcrypto} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {build} from 'esbuild'
import {runtime} from './xray-browser-preview'
import {createBenchmarkContextAdapter} from '../../../packages/assistant-context-gateway/src/index.mjs'
import type {TimeSeriesViewerPayload,TimeSeriesViewerPoint} from '../../dashboard-preview/lib/time-series-viewer/time-series-viewer-contract'

const React=runtime('react'),{JSDOM}=runtime('jsdom'),{createRoot}=runtime('react-dom/client')
async function loadChart(){
const bundle=await build({entryPoints:[fileURLToPath(new URL('../../dashboard-preview/components/raw-data-view/magicpath-benchmark-chart.tsx',import.meta.url))],
  bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',external:['react','react/jsx-runtime'],
  plugins:[{name:'embedded-channel-fixture',setup(builder){
    builder.onResolve({filter:/^\.\.\/native-embedded-read-provider$/},()=>({path:'channel',namespace:'fixture'}))
    builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const useEmbeddedReadPresentation=()=>globalThis.__chartChannel',loader:'js'}))
  }}]})
const loaded={exports:{} as {MagicPathBenchmarkChart:any}}
new Function('require','module','exports',bundle.outputFiles[0].text)(runtime,loaded,loaded.exports)
return loaded.exports.MagicPathBenchmarkChart
}
const values:[string,number|null][]=[['2026-01-01',10],['2026-02-01',null],['2026-03-01',20],['2026-03-20',30],['2026-04-01',40]]
function fixture(seriesId='synthetic_copper'):TimeSeriesViewerPayload{
  const points=values.map(([date,value]):TimeSeriesViewerPoint=>({date,value,key:date,recordId:date,diff:null,anchor:false,
    tooltipModel:{title:date,rows:[]},detailModel:{componentName:'Synthetic copper',benchmarkCode:seriesId,sourceDate:date,
      temporalResolution:'day',scenarioType:'historical',value,forecastLower:null,forecastUpper:null,forecastAccuracyDiff:null,
      description:null,unit:'USD/ton',currency:'USD',market:null,country:null,qualityStatus:null,sourceLabel:'Synthetic source',lastSyncedAt:null}}))
  return {title:'Synthetic copper',subtitle:null,locale:'pl',sourceInfo:{benchmarkCode:seriesId,description:null,sourceLabel:'Synthetic source',unit:'USD/ton',currency:'USD',market:null,country:null,qualityStatus:null,lastSyncedAt:null},
    benchmarkCode:seriesId,description:null,unit:'USD/ton',currency:'USD',market:null,country:null,lastSyncedAt:null,
    xAxis:{type:'time',labelFormat:'MMM yy',ticks:[]},yAxis:{unit:'USD/ton',currency:'USD',type:'value',ticks:[]},
    forecastAnchor:null,forecastOrigin:null,deltaOverlays:[],tooltipModel:null,detailModel:null,events:[],
    series:[{id:'historical',kind:'historical',label:'History',lineStyle:'solid',points}]}
}
test('the actual MagicPath chart publishes a server-verifiable reference for its visible window and revokes it on loading, hiding, replacement and unmount',async()=>{
  const Chart=await loadChart()
  const dom=new JSDOM('<div id="root"></div>',{url:'https://analytics.example.test'}),g=globalThis as any
  const keys=['window','document','HTMLElement','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','IS_REACT_ACT_ENVIRONMENT','__chartChannel','crypto']
  const previous=Object.fromEntries(keys.map(key=>[key,Object.getOwnPropertyDescriptor(g,key)])),published:any[]=[]
  dom.window.matchMedia=(()=>({matches:true,addEventListener(){},removeEventListener(){}})) as any
  Object.assign(g,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,
    ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:()=>0,cancelAnimationFrame(){},IS_REACT_ACT_ENVIRONMENT:true,
    __chartChannel:{readOnly:true,publishChartReference:(reference:any)=>published.push(reference)}})
  Object.defineProperty(g,'crypto',{value:webcrypto,configurable:true})
  const root=createRoot(document.getElementById('root')),latest=()=>published.at(-1)
  const render=async(payload:TimeSeriesViewerPayload|null,isLoading=false)=>React.act(async()=>{
    root.render(React.createElement(Chart,{payload,isLoading,emptyMessage:'Empty',loadingTitle:'Loading',showForecastAccuracy:false,initialPreset:'ALL'}))
    await new Promise(resolve=>setTimeout(resolve,20))
  })
  const click=async(label:string)=>React.act(async()=>{
    const button=Array.from(document.querySelectorAll('button')).find(button=>button.getAttribute('aria-label')===label||button.textContent===label)
    assert(button,label);button.click();await new Promise(resolve=>setTimeout(resolve,20))
  })
  const settle=()=>React.act(async()=>{await new Promise(resolve=>setTimeout(resolve,30))})
  let unmounted=false
  try{
    const payload=fixture();await render(payload);await settle()
    const all=latest();assert(all,'canonical chart must publish context without the legacy ChartPanel')
    assert.equal(all.seriesId,'synthetic_copper');assert.equal(all.from,'2026-01-01');assert.equal(all.to,'2026-04-01')
    assert.deepEqual(Object.keys(all).sort(),['fingerprint','from','range','seriesId','source','to','version'])
    const adapter=createBenchmarkContextAdapter({readAuthorised:async()=>({providerSeries:{providerSeriesId:'synthetic_copper'},displayName:payload.title,
      unit:payload.unit,currency:payload.currency,source:'Synthetic source',frequency:'Daily',historical:values.map(([date,value])=>({date,value}))})})
    const resolve=(reference:any)=>adapter.read({reference,request:new Request('https://example.test'),organisationId:'synthetic-owner',observedAt:'2026-04-01T00:00:00Z'})
    assert.equal((await resolve(all)).status,'PARTIAL','null source observations remain in the authoritative fingerprint')
    await click('Zakres 1M');await settle();const month=latest()
    assert(month);assert.equal(month.range,'1M');assert.equal(month.from,'2026-03-01');assert.notEqual(month.fingerprint,all.fingerprint)
    assert.equal((await resolve(month)).status,'OK')
    await click('History');await settle();assert.equal(latest(),null,'hidden historical series cannot stay active')
    await click('History');await settle();assert(latest())
    await render(payload,true);await settle();assert.equal(latest(),null,'old chart is revoked while the next range loads')
    await render(fixture('synthetic_other'));await settle();assert.equal(latest().seriesId,'synthetic_other')
    await render(null);await settle();assert.equal(latest(),null)
    await render(payload);await settle();assert(latest())
    await React.act(async()=>root.unmount());unmounted=true;assert.equal(latest(),null)
  }finally{
    if(!unmounted)await React.act(async()=>root.unmount())
    dom.window.close();for(const key of keys){if(previous[key])Object.defineProperty(g,key,previous[key]!);else delete g[key]}
  }
})
