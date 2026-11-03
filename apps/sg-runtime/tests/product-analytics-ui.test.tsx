import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import {createRequire} from 'node:module'
import {build} from 'esbuild'
import React,{act,StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {JSDOM} from 'jsdom'
import {ProductAnalytics} from '../lib/product-analytics/adapter'

const require=createRequire(import.meta.url),app=path.resolve(import.meta.dirname,'..'),g=globalThis as any
async function loadHost(entry:string){
  const result=await build({entryPoints:[path.join(app,entry)],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',
    alias:{'@':app},loader:{'.css':'empty'},external:['react','react/jsx-runtime'],plugins:[{name:'bounded-ui-fixtures',setup(b){
      b.onResolve({filter:/product-analytics\/adapter$/},()=>({path:'analytics',namespace:'fixture'}))
      b.onResolve({filter:/^posthog-js\/dist\/module.no-external$/},()=>({path:'sdk',namespace:'fixture'}))
      b.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'fixture'}))
      b.onResolve({filter:/session-boundary$/},()=>({path:'auth',namespace:'fixture'}))
      b.onResolve({filter:/^@profitia\/srm-adp-ui$/},()=>({path:'adp',namespace:'fixture'}))
      b.onResolve({filter:/^@profitia\/sg2-price-change-index-ui\/business$/},()=>({path:'pci',namespace:'fixture'}))
      b.onResolve({filter:/shared-benchmark-picker$/},()=>({path:'picker',namespace:'fixture'}))
      b.onResolve({filter:/price-change-index-request$/},()=>({path:'pci-request',namespace:'fixture'}))
      b.onResolve({filter:/category-operation-request$/},()=>({path:'category-request',namespace:'fixture'}))
      b.onResolve({filter:/lib\/benchmark\/qualification(?:-presentation)?$/},()=>({path:'qualification',namespace:'fixture'}))
      b.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'jsx',contents:{
        analytics:'export const productAnalytics=globalThis.__productAnalytics;',
        sdk:'globalThis.__sdkImports++;export default {init:(...args)=>globalThis.__sdkInitializations.push(args),capture:(...args)=>globalThis.__sdkCaptures.push(args),reset(){}};',
        navigation:'export const usePathname=()=>globalThis.window.location.pathname;',
        auth:'export const useSg2SessionCredential=()=>async()=>"fixture.valid.token";export const useSg2IdentityMode=()=>"clerk";',
        adp:'import React from "react";export const FIELD_DEFINITIONS=[];export const ADP_UI_CONTRACT_VERSION="1.0.0";export const AdpWorkspace=p=>{globalThis.__adpProps=p;return <div>ADP</div>};',
        pci:'import React from "react";export const PriceChangeIndex=p=>{globalThis.__pciController=p.controller;return <div>PCI</div>};',
        picker:'export const SharedBenchmarkPicker=p=>{globalThis.__pickerProps=p;return null};',
        'pci-request':'export const createPciRequester=()=>Object.assign(async(body,signal)=>globalThis.__pciRequest(JSON.parse(body),signal),{close(){}});export const pciFailureMessage=()=>"Fixture failure";',
        'category-request':'export const createCategoryOperationRequester=()=>Object.assign(async()=>globalThis.__categoryRequest(),{close(){}});',
        qualification:'export const savedBenchmarkProfile=()=>({});export const presentQualification=()=>({status:"SUITABLE"});',
      }[args.path]!}))
    }}]})
  const mod={exports:{} as any};new Function('require','module','exports',result.outputFiles[0].text)(require,mod,mod.exports);return mod.exports
}
function setup(){
  const dom=new JSDOM('<html><body><div id="root"></div></body></html>',{url:'https://sg2-development-runtime.onrender.com/pl/dashboard'})
  g.window=dom.window;g.document=dom.window.document;g.navigator=dom.window.navigator;g.IS_REACT_ACT_ENVIRONMENT=true
  Object.defineProperty(dom.window.HTMLDialogElement.prototype,'showModal',{value:function(){this.open=true}})
  Object.defineProperty(dom.window.HTMLDialogElement.prototype,'close',{value:function(){this.open=false}})
  const events:any[]=[];g.__productAnalytics=new ProductAnalytics();g.__productAnalytics.connect((event:any,properties:any)=>events.push({event,...properties}),()=>true)
  const root=createRoot(dom.window.document.getElementById('root')!)
  return {events,root,dom,async close(){await act(()=>root.unmount());dom.window.close();delete g.window;delete g.document;delete g.navigator}}
}
const tick=async()=>{await act(async()=>{await new Promise(r=>setTimeout(r,1))})}

test('actual provider never imports before consent; StrictMode initializes once and withdrawal fails closed',async()=>{
  const f=setup();try{
    g.__sdkImports=0;g.__sdkInitializations=[];g.__sdkCaptures=[]
    const {ProductAnalyticsProvider}=await loadHost('components/analytics/product-analytics-provider.tsx')
    const configuration={token:'phc_'+ 'A'.repeat(43),host:'https://eu.i.posthog.com'}
    const render=(config:any)=>act(()=>f.root.render(<StrictMode><ProductAnalyticsProvider configuration={config}><div>Application remains available</div></ProductAnalyticsProvider></StrictMode>))
    await render(null);await render(configuration);await tick()
    assert.equal(g.__sdkImports,0);assert.equal(g.__sdkInitializations.length,0)
    window.sessionStorage.setItem('sg2.product-analytics.explicit-test.v1','granted')
    await render({...configuration});await tick();await render({...configuration});await tick()
    assert.equal(g.__sdkImports,1);assert.equal(g.__sdkInitializations.length,1)
    assert.equal(g.__productAnalytics.capture('app_opened',{module:'appshell',entry_point:'appshell'}),true)
    assert.equal(g.__sdkCaptures.length,1)
    window.history.pushState({},'','/pl/dashboard/benchmark-finder')
    assert.equal(g.__productAnalytics.capture('adp_view_opened',{module:'adp',view:'data'}),false,'all capture is off inside Finder even after SDK initialized elsewhere')
    const beforeSend=g.__sdkInitializations[0][1].before_send
    assert.equal(beforeSend({event:'app_opened',properties:{module:'appshell'}}),null,'final transport rechecks the current route')
    window.history.pushState({},'','/pl/dashboard/adp')
    assert.equal(g.__productAnalytics.capture('adp_view_opened',{module:'adp',view:'data'}),true,'other modules resume without another SDK initialization')
    assert.equal(g.__sdkInitializations.length,1)
    assert.equal(g.__sdkCaptures.length,2)
    window.sessionStorage.removeItem('sg2.product-analytics.explicit-test.v1')
    assert.equal(g.__productAnalytics.capture('app_opened',{module:'appshell'}),false)
    window.sessionStorage.setItem('sg2.product-analytics.explicit-test.v1','granted');await render(null)
    assert.equal(g.__productAnalytics.capture('app_opened',{module:'appshell'}),false)
    assert.equal(g.__sdkCaptures.length,2)
    assert(window.document.body.textContent?.includes('Application remains available'))
  }finally{await f.close()}
})

test('direct Finder entry with explicit consent does not import or initialize the SDK',async()=>{
  const f=setup();try{
    g.__sdkImports=0;g.__sdkInitializations=[];g.__sdkCaptures=[]
    window.history.replaceState({},'','/en/dashboard/benchmark-finder')
    window.sessionStorage.setItem('sg2.product-analytics.explicit-test.v1','granted')
    const {ProductAnalyticsProvider}=await loadHost('components/analytics/product-analytics-provider.tsx')
    const configuration={token:'phc_'+'A'.repeat(43),host:'https://eu.i.posthog.com'}
    const render=()=>act(()=>f.root.render(<ProductAnalyticsProvider configuration={configuration}><div>Finder remains available</div></ProductAnalyticsProvider>))
    await render();await tick()
    assert.equal(g.__sdkImports,0);assert.equal(g.__sdkInitializations.length,0)
    assert(window.document.body.textContent?.includes('Finder remains available'))
    window.history.pushState({},'','/en/dashboard');await render();await tick()
    assert.equal(g.__sdkImports,1);assert.equal(g.__sdkInitializations.length,1,'leaving an initial Finder route initializes the allowed surface')
  }finally{await f.close()}
})

test('actual ADP host counts active views/sections once in StrictMode and forwards only action types',async()=>{
  const f=setup();try{
    const {AdpModuleHost}=await loadHost('components/appshell/adp-module-host.tsx')
    let active=false,view='data',section='company',returns=0
    const render=()=>act(()=>f.root.render(<StrictMode><AdpModuleHost locale="pl" theme="light" active={active} organizationDisplayName="Private organization"
      navigation={{view,section,dataArea:'adp'}} onNavigate={()=>{}} onReturn={()=>returns++}/></StrictMode>))
    await render();assert.equal(f.events.length,0)
    active=true;await render();await render()
    assert.equal(f.events.filter(e=>e.event==='adp_view_opened').length,1)
    assert.equal(f.events.filter(e=>e.event==='adp_form_section_opened').length,1)
    section='payments';await render();assert.equal(f.events.filter(e=>e.event==='adp_form_section_opened').length,2)
    const p=g.__adpProps
    await act(()=>p.onLocalEvent({type:'contact.add',values:{name:'Private supplier',email:'private@example.invalid'}},p.instanceId))
    await act(()=>p.onLocalEvent({type:'contact.add',values:{name:'Stale'}},'stale-instance'))
    assert.equal(f.events.filter(e=>e.event==='adp_local_action_performed').length,1)
    assert.equal(f.events.at(-1).action_type,'contact.add');assert.doesNotMatch(JSON.stringify(f.events),/Private|private@|Stale/)
    p.onReturn();assert.equal(returns,1);assert.equal(f.events.at(-1).event,'adp_returned_to_appshell')
    active=false;await render();active=true;await render()
    assert.equal(f.events.filter(e=>e.event==='adp_view_opened').length,2)
  }finally{await f.close()}
})

test('PCI callbacks retain semantics while their Finder-entry open signals are excluded in stage one',async()=>{
  const f=setup();try{
    let close=0,saveResolve:(v:Response)=>void=()=>{},prepareResolve:(v:Response)=>void=()=>{},responseMode='REFUSED'
    const preparation={recommendedCandidateId:null,candidates:[],limitations:[]}
    g.__pciRequest=async(body:any)=>body.mode==='PREPARE'?new Promise(resolve=>{prepareResolve=resolve}):Response.json(
      responseMode==='REFUSED'?{status:'REFUSED',preparation,issues:[{message:'Private refusal'}]}:
      responseMode==='CALCULATED'?{status:'CALCULATED',preparation,indexedPrice:{methodologyId:'fixture',analysisCadence:'monthly',baseNode:{start:'2026-09-01'},basePrice:{purchaseDate:'2026-10-01',amount:123},currency:'PLN',unit:'t',limitations:[],nodes:[],sourceCalculation:{nodes:[]}}}:
      responseMode==='PROXY_MARKET_ONLY'?{status:'PROXY_MARKET_ONLY',preparation,calculation:{methodologyVersion:'fixture',analysisCadence:'monthly',nodes:[]},reference:{period:{start:'2026-09-01'}},purchaseContext:{purchaseDate:'2026-10-01',amount:123,currency:'PLN',unit:'t'}}:
      {status:'ERROR'},{status:responseMode==='ERROR'?500:200})
    g.__categoryRequest=()=>new Promise(resolve=>{saveResolve=resolve})
    const {PriceChangeIndexLayer}=await loadHost('components/price-change-index/price-change-index-layer.tsx')
    const seed={organizationId:'fixture-organization',businessBenchmarkId:'private-benchmark',displayName:'Private benchmark',providerSeries:{providerSeriesId:'private-series'},semanticProfile:{}}
    await act(()=>f.root.render(<StrictMode><PriceChangeIndexLayer seed={seed} locale="pl" onClose={()=>close++} onAccessLost={()=>{}}/></StrictMode>))
    assert.equal(f.events.filter(e=>e.event==='pci_opened').length,0,'the existing PCI entry is explicitly attributed to the excluded Finder')
    assert.equal(f.events.filter(e=>e.event==='module_opened').length,0)
    await act(()=>g.__pciController.onPickBenchmark(null))
    await act(()=>g.__pickerProps.onSelect({...seed,businessBenchmarkId:'private-second'}))
    await act(()=>{const c=g.__pciController;c.onNameChange('Private category');for(const component of c.components)c.onComponentChange(component.id,{name:'Private component',weightPercent:50});c.onPurchaseChange({amount:'123',currency:'PLN',unit:'t',taxBasis:'NET',deliveryBasis:'EXW',purchaseDate:'2026-10-01'});c.onStep(3)})
    await act(async()=>{await new Promise(r=>setTimeout(r,330))})
    await act(()=>g.__pciController.onNameChange('Changed private category'))
    await act(async()=>prepareResolve(Response.json({status:'PREPARED',preparation})))
    assert.equal(f.events.filter(e=>e.event==='pci_preparation_finished').length,0,'superseded response is not a completion')
    await act(async()=>{await new Promise(r=>setTimeout(r,330))})
    await act(async()=>prepareResolve(Response.json({status:'REFUSED',preparation})))
    assert.equal(f.events.filter(e=>e.event==='pci_preparation_finished').length,1)
    await act(async()=>g.__pciController.onAnalyse());await tick()
    assert.equal(f.events.filter(e=>e.event==='pci_analysis_finished').at(-1).status,'REFUSED')
    assert.equal(f.events.filter(e=>e.event==='operation_completed').length,0)
    responseMode='ERROR';await act(async()=>g.__pciController.onAnalyse());await tick()
    assert.equal(f.events.filter(e=>e.event==='pci_analysis_finished').at(-1).status,'ERROR')
    responseMode='PROXY_MARKET_ONLY';await act(async()=>g.__pciController.onAnalyse());await tick()
    assert.equal(f.events.filter(e=>e.event==='pci_analysis_finished').at(-1).status,'PROXY_MARKET_ONLY')
    assert.equal(f.events.filter(e=>e.event==='operation_completed').length,0)
    responseMode='CALCULATED';await act(async()=>g.__pciController.onAnalyse());await tick()
    assert.equal(f.events.filter(e=>e.event==='pci_analysis_finished').at(-1).status,'CALCULATED')
    assert.equal(f.events.filter(e=>e.event==='operation_completed').length,1)
    await act(()=>g.__pciController.onSaveCategory())
    assert.equal(f.events.filter(e=>e.event==='pci_category_save_requested').length,1)
    assert.equal(f.events.filter(e=>e.event==='pci_category_save_finished').length,0)
    await act(async()=>saveResolve(Response.json({id:'private-category',organizationId:'foreign-organization'})));await tick()
    assert.equal(f.events.filter(e=>e.event==='pci_category_save_finished').at(-1).status,'error')
    assert.equal(f.events.filter(e=>e.event==='operation_completed').length,1)
    await act(()=>f.root.render(<StrictMode><PriceChangeIndexLayer key="fresh-attempt" seed={seed} locale="pl" onClose={()=>close++} onAccessLost={()=>{}}/></StrictMode>))
    await act(()=>g.__pciController.onSaveCategory())
    await act(async()=>saveResolve(Response.json({id:'private-category',organizationId:'fixture-organization'})));await tick()
    assert.equal(f.events.filter(e=>e.event==='pci_category_save_finished').at(-1).status,'success')
    assert.equal(f.events.filter(e=>e.event==='operation_completed').length,2)
    assert.equal(close,0)
    const privacyPayloads=f.events.map(({process_attempt_id,duration_ms,...payload}:Record<string,unknown>)=>{
      if(process_attempt_id!==undefined)assert.match(String(process_attempt_id),/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      if(duration_ms!==undefined)assert(typeof duration_ms==='number'&&Number.isFinite(duration_ms)&&duration_ms>=0)
      return payload
    })
    // Generated UUID digits and numeric duration are checked by type above;
    // fixture identifiers must remain absent from every other event property.
    assert.doesNotMatch(JSON.stringify(privacyPayloads),/Private|private-|organization|foreign|123/)
  }finally{await f.close()}
})
