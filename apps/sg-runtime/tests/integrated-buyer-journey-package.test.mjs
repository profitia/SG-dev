import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {bundleAdp,appRoot} from './adp-appshell-preview.mjs'
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
test('business-only public export excludes every demonstration engine, fixture, network and instructional overlay',async()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../../../packages/sg2-price-change-index-ui/package.json',import.meta.url)))
 assert.equal(manifest.exports['./business'],'./src/business.ts');assert.equal(manifest.exports['.'],'./src/index.ts')
 const result=await bundleAdp('../../packages/sg2-price-change-index-ui/src/business.ts',{metafile:true})
 for(const file of Object.keys(result.metafile.inputs))assert.doesNotMatch(file,/DeliveryRuntime|delivery-registry|\/fixtures|\/pci[12]\/|CCIWersja|StackedPriceHistoryChart|\/cost-analysis\//)
 assert.doesNotMatch(result.outputFiles[0].text,/\bfetch\s*\(|localStorage|sessionStorage|new WebSocket|data-delivery|DeliveryRuntime|simulation-suffix|designs\.magicpath/)
})
test('new receiver acceptance is additive, binds the whole closure and retains exact pinned upstreams',()=>{
 const receipt=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url))),a=receipt.integratedBuyerJourneySourceCompatibility
 const prior=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/sg-runtime/operation-integration.json'],{cwd:appRoot})
 assert.equal(hash(prior),a.previousReceiptSha256)
 for(const [key,value]of Object.entries(JSON.parse(prior)))assert.deepEqual(receipt[key],value,key)
 for(const [file,digest]of Object.entries({...a.applicationSourceDigests,...receipt.xrayPlatform130CiClosureCompatibility.applicationSourceDigests}))assert.equal(hash(fs.readFileSync(new URL('../'+file,import.meta.url))),digest,file)
 for(const [file,digest]of Object.entries(a.publicUiSourceDigests))assert.equal(hash(fs.readFileSync(new URL('../../../'+file,import.meta.url))),digest,file)
 assert.equal(a.design.motherRevisionId,'465857540723474432');assert.equal(a.design.layerRevisionId,'465816145245642752')
 assert.equal(a.dependencies['587'],'adbf34ffe16f25f4e097c9456dc962260bb1963e')
 for(const flag of ['newE1Grants','schemaChanged','neonMigrationPerformed','productDeploymentPerformed'])assert.equal(a[flag],false,flag)
 assert.equal(a.liveCustomerAcceptance,'NOT_PERFORMED_DEPLOYMENT_NOT_AUTHORIZED')
})

test('public business entry mounts and unmounts in a minimal independent host',async()=>{
 const {runtimeRequire,loadAdpModule}=await import('./adp-appshell-preview.mjs'),{JSDOM}=runtimeRequire('jsdom')
 const dom=new JSDOM('<!doctype html><html><body><div id="host"></div></body></html>',{url:'https://independent.invalid'})
 const names=['window','document','navigator','HTMLElement','ResizeObserver','IS_REACT_ACT_ENVIRONMENT'],prior=new Map(names.map(n=>[n,Object.getOwnPropertyDescriptor(globalThis,n)]))
 for(const [name,value]of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,ResizeObserver:class{observe(){}disconnect(){}},IS_REACT_ACT_ENVIRONMENT:true}))Object.defineProperty(globalThis,name,{value,configurable:true,writable:true})
 dom.window.HTMLElement.prototype.scrollTo=function(){}
 const React=runtimeRequire('react'),{createRoot}=runtimeRequire('react-dom/client'),{PriceChangeIndex}=await loadAdpModule('../../packages/sg2-price-change-index-ui/src/business.ts')
 const host=dom.window.document.getElementById('host'),root=createRoot(host),noop=()=>{}
 const controller={name:'',components:[{id:'seed',name:'',weightPercent:0,valueKind:'',benchmark:{businessBenchmarkId:'synthetic',displayName:'Synthetic selected benchmark'}}],purchase:{amount:'',currency:'',unit:'',taxBasis:'',deliveryBasis:'',purchaseDate:'',referenceDate:'',periodBasis:'',reduction:'NATIVE_ONLY',economicPeriodApproved:false},step:1,busy:false,error:null,result:null,categorySaveStatus:'idle',ready:false,onNameChange:noop,onComponentChange:noop,onRemove:noop,onPickBenchmark:noop,onPurchaseChange:noop,onStep:noop,onAnalyse:noop,onSaveCategory:noop,onClose:noop}
 try{
  await React.act(async()=>root.render(React.createElement(PriceChangeIndex,{mode:'business',view:'pci3',locale:'pl',theme:'dark',controller})))
  const shadow=host.querySelector('[data-pci-mode=business]').shadowRoot
  assert(shadow.querySelector('[data-flow-step="1"]'));assert.equal(shadow.querySelector('.pci-surface').dataset.srmTheme,'dark')
  assert.equal(dom.window.document.querySelectorAll('style').length,0);assert.equal(shadow.querySelector('input').value,'')
  // Native input/paste events must cross the shadow presentation boundary and
  // update the controlling host before another edit or render restores its value.
  const render=()=>root.render(React.createElement(PriceChangeIndex,{mode:'business',view:'pci3',locale:'pl',theme:'dark',controller}))
  controller.onNameChange=value=>{controller.name=value;render()}
  controller.onComponentChange=(id,patch)=>{controller.components=controller.components.map(c=>c.id===id?{...c,...patch}:c);render()}
  async function input(selector,value){
    const element=shadow.querySelector(selector)
    await React.act(async()=>{
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(element,value)
      element.dispatchEvent(new dom.window.InputEvent('input',{bubbles:true,composed:true,inputType:'insertFromPaste',data:value}))
    })
  }
  await input('.v3-category-name input','Kategoria w niezależnym hoście')
  await input('input[aria-label="Komponent"]','Miedź')
  await input('input[type="number"]','90')
  await React.act(async()=>render())
  assert.equal(controller.name,'Kategoria w niezależnym hoście');assert.equal(controller.components[0].name,'Miedź');assert.equal(controller.components[0].weightPercent,90)
  assert.equal(shadow.querySelector('.v3-category-name input').value,controller.name)
  assert.equal(shadow.querySelector('input[aria-label="Komponent"]').value,'Miedź');assert.equal(shadow.querySelector('input[type="number"]').value,'90')
  await React.act(async()=>root.unmount());assert.equal(host.childNodes.length,0)
 }finally{dom.window.close();for(const name of names){const descriptor=prior.get(name);if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name]}}
})
