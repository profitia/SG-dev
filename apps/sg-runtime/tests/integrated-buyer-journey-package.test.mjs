import test from 'node:test'
import {assertPciSmartIntegrity,assertPciInputCorrective} from './pci-smart-integrity.mjs'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
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
const receiptPath=new URL('../operation-integration.json',import.meta.url)
const readCurrent=()=>JSON.parse(fs.readFileSync(receiptPath))
const preBqlBytes=url=>{
 const bql=readCurrent().bqlPciFirstSourceCompatibility,full=readCurrent().fullUiParityAdoption
 const relative=path.relative(path.resolve(appRoot,'../..'),fileURLToPath(url)).split(path.sep).join('/')
 return bql?.sourceDigests[relative]?execFileSync('git',['show',bql.previousReceiptSourceSha+':'+relative],{cwd:appRoot}):readCurrent().pciSmartPreparationCompatibility?.sourceDigests[relative]?execFileSync('git',['show',readCurrent().pciSmartPreparationCompatibility.previousReceiptSourceSha+':'+relative],{cwd:appRoot}):full?.applicationSourceDigests[relative.replace(/^apps\/sg-runtime\//,'')]?execFileSync('git',['show',full.previousReceiptSourceSha+':'+relative],{cwd:appRoot}):fs.readFileSync(url)
}
const historicalReceipt=()=>JSON.parse(execFileSync('git',['show',readCurrent().pciDatePreparationSourceCompatibility.previousReceiptSourceSha+':apps/sg-runtime/operation-integration.json'],{cwd:appRoot}))
const historicalBytes=url=>{
 const relative=path.relative(path.resolve(appRoot,'../..'),fileURLToPath(url)).split(path.sep).join('/')
 const current=readCurrent().pciDatePreparationSourceCompatibility
 const fresh=readCurrent().freshPerformanceRecovery,relativeApp=path.relative(appRoot,fileURLToPath(url)).split(path.sep).join('/')
 const stabilization=readCurrent().pciLiveAcceptanceStabilization
 if(!current.changedPaths.includes(relative)&&fresh?.applicationSourceDigests[relativeApp])return execFileSync('git',['show',fresh.previousReceiptSourceSha+':'+relative],{cwd:appRoot})
 const consolidated=readCurrent().xraySearchBoundaryConsolidation
 if(!current.changedPaths.includes(relative)&&consolidated?.applicationSourceDigests[relativeApp])return execFileSync('git',['show',consolidated.previousReceiptSourceSha+':'+relative],{cwd:appRoot})
 if(!current.changedPaths.includes(relative)&&(stabilization?.applicationSourceDigests[relativeApp]||stabilization?.publicUiSourceDigests[relative]))return execFileSync('git',['show',stabilization.previousReceiptSourceSha+':'+relative],{cwd:appRoot})
 return current.changedPaths.includes(relative)?execFileSync('git',['show',current.previousReceiptSourceSha+':'+relative],{cwd:appRoot}):preBqlBytes(url)
}
test('new receiver acceptance is additive, binds the whole closure and retains exact pinned upstreams',()=>{
 const receipt=historicalReceipt(),a=receipt.integratedBuyerJourneySourceCompatibility
 const prior=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/sg-runtime/operation-integration.json'],{cwd:appRoot})
 assert.equal(hash(prior),a.previousReceiptSha256)
 for(const [key,value]of Object.entries(JSON.parse(prior)))assert.deepEqual(receipt[key],value,key)
 for(const [file,digest]of Object.entries({...a.applicationSourceDigests,...receipt.xrayPlatform130CiClosureCompatibility.applicationSourceDigests,...receipt.appshellXraySourceCompatibility.applicationSourceDigests}))assert.equal(hash(historicalBytes(new URL('../'+file,import.meta.url))),digest,file)
 for(const [file,digest]of Object.entries({...a.publicUiSourceDigests,...receipt.pciComponentsVisibilitySourceCompatibility.publicUiSourceDigests}))assert.equal(hash(historicalBytes(new URL('../../../'+file,import.meta.url))),digest,file)
 assert.equal(a.design.motherRevisionId,'465857540723474432');assert.equal(a.design.layerRevisionId,'465816145245642752')
 assert.equal(a.dependencies['587'],'adbf34ffe16f25f4e097c9456dc962260bb1963e')
 for(const flag of ['newE1Grants','schemaChanged','neonMigrationPerformed','productDeploymentPerformed'])assert.equal(a[flag],false,flag)
 assert.equal(a.liveCustomerAcceptance,'NOT_PERFORMED_DEPLOYMENT_NOT_AUTHORIZED')
})

test('PCI correction preserves every historical acceptance and renews only its exact current receiver bindings',()=>{
 const receipt=historicalReceipt(),current=receipt.pciComponentsVisibilitySourceCompatibility
 assert.equal(current.taskId,'SG2-PCI-CATEGORY-COMPONENTS-VISIBILITY-FIX');assert.equal(current.scope,'PRESENTATION_ONLY_COMPONENT_VISIBILITY_AND_EDITING')
 assert.equal(current.previousReceiptSourceSha,'d6561053d25a4132dcfbc82c24924f7d9d6c3ee1');assert.equal(current.currentReceiverSection,'appshellXraySourceCompatibility')
 const bytes=execFileSync('git',['show',current.previousReceiptSourceSha+':apps/sg-runtime/operation-integration.json'],{cwd:appRoot}),before=JSON.parse(bytes)
 assert.equal(hash(bytes),current.previousReceiptSha256)
 for(const[key,value]of Object.entries(before)){
  // Retain the whole old current-receiver map in the pinned Git receipt; every
  // other historical field remains byte-for-byte, including PCI/AppShell pins.
  const observed=key===current.currentReceiverSection?{...receipt[key],applicationSourceDigests:value.applicationSourceDigests}:receipt[key]
  assert.deepEqual(observed,value,key)
 }
 const keys=['docs/integrated-buyer-journey-contract.md','tests/integrated-buyer-journey-browser.mjs','tests/integrated-buyer-journey-package.test.mjs','tests/integrated-buyer-journey-preview.mjs']
 assert.deepEqual(Object.keys(current.currentReceiverDigestOverrides).sort(),keys)
 assert.deepEqual(receipt[current.currentReceiverSection].applicationSourceDigests,{...before[current.currentReceiverSection].applicationSourceDigests,...current.currentReceiverDigestOverrides})
 for(const[file,digest]of Object.entries(current.currentReceiverDigestOverrides))assert.equal(hash(historicalBytes(new URL('../'+file,import.meta.url))),digest,file)
 assert.deepEqual(Object.keys(current.publicUiSourceDigests).sort(),['packages/sg2-price-change-index-ui/src/BusinessPriceChangeIndex.tsx','packages/sg2-price-change-index-ui/src/business.css'])
 assert.equal(current.historicalAcceptancePreserved,true)
 for(const flag of ['productDeploymentPerformed','calculationChanged','identityOrGrantsChanged','schemaChanged'])assert.equal(current[flag],false,flag)
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
  await input('input[aria-label="Nazwa komponentu 1"]','Miedź')
  await input('input[type="number"]','90')
  await React.act(async()=>render())
  assert.equal(controller.name,'Kategoria w niezależnym hoście');assert.equal(controller.components[0].name,'Miedź');assert.equal(controller.components[0].weightPercent,90)
  assert.equal(shadow.querySelector('.v3-category-name input').value,controller.name)
  assert.equal(shadow.querySelector('input[aria-label="Nazwa komponentu 1"]').value,'Miedź');assert.equal(shadow.querySelector('input[type="number"]').value,'90')
  // A short viewport must never drop rows from the public composition contract.
  controller.components=Array.from({length:12},(_,i)=>({id:'stable-'+i,name:i===4?'':'Składnik testowy '+i,weightPercent:0,valueKind:'',benchmark:{businessBenchmarkId:'test-'+i,displayName:'Test benchmark '+i}}))
  await React.act(async()=>render())
  assert.equal(shadow.querySelectorAll('tr[data-component-id]').length,12)
  assert.equal(shadow.querySelectorAll('.v3-component-pager').length,0)
  const blank=shadow.querySelector('tr[data-component-id="stable-4"]')
  assert.equal(blank.querySelector('input').value,'');assert.match(blank.textContent,/Bez nazwy/);assert.match(blank.textContent,/Test benchmark 4/)
  const before=controller.components.map(c=>({...c}))
  await input('input[aria-label="Nazwa komponentu 9"]','Własna nazwa');await input('input[aria-label="Udział procentowy komponentu 9"]','90')
  assert.equal(controller.components[8].id,'stable-8');assert.equal(controller.components[8].name,'Własna nazwa');assert.equal(controller.components[8].weightPercent,90)
  assert.deepEqual(controller.components.filter((_,i)=>i!==8),before.filter((_,i)=>i!==8))
  assert.equal(controller.name,'Kategoria w niezależnym hoście')
  controller.step=3;await React.act(async()=>render())
  assert.equal(shadow.querySelectorAll('.pci-series-declarations select').length,12)
  assert.match(shadow.querySelector('.pci-series-declarations').textContent,/Bez nazwy/)
  await React.act(async()=>root.unmount());assert.equal(host.childNodes.length,0)
 }finally{dom.window.close();for(const name of names){const descriptor=prior.get(name);if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name]}}
})

test('date preparation renews exact receiver bytes and preserves prior records and calculation engines',()=>{
 const r=readCurrent(),current=r.pciDatePreparationSourceCompatibility,before=historicalReceipt()
 assert.equal(current.taskId,'SG2-PCI-DATE-CALCULATION-RECOVERY-20261029')
 assert.equal(hash(execFileSync('git',['show',current.previousReceiptSourceSha+':apps/sg-runtime/operation-integration.json'],{cwd:appRoot})),current.previousReceiptSha256)
 for(const[key,value]of Object.entries(before)){
  const observed=key==='appshellXraySourceCompatibility'?{...r[key],applicationSourceDigests:value.applicationSourceDigests}:r[key]
  assert.deepEqual(observed,value,key)
 }
 assert.deepEqual(r.appshellXraySourceCompatibility.applicationSourceDigests,{...before.appshellXraySourceCompatibility.applicationSourceDigests,...current.currentReceiverDigestOverrides})
 for(const[file,digest]of Object.entries(current.sourceDigests))assert.equal(hash(fs.readFileSync(new URL('../../../'+file,import.meta.url))),r.pciSmartInputCorrective?.applicationSourceDigests[path.relative(appRoot,fileURLToPath(new URL('../../../'+file,import.meta.url))).split(path.sep).join('/')]??r.fullUiParityAdoption?.applicationSourceDigests[path.relative(appRoot,fileURLToPath(new URL('../../../'+file,import.meta.url))).split(path.sep).join('/')]??r.pciSmartResultingMainScopeCompatibility?.sourceDigests[file]??r.pciSmartPreparationCompatibility?.sourceDigests[file]??r.bqlLiveAcceptanceCompatibility?.sourceDigests[path.relative(path.resolve(appRoot,'../..'),fileURLToPath(new URL('../../../'+file,import.meta.url))).split(path.sep).join('/')]??r.bqlPciFirstSourceCompatibility?.sourceDigests[path.relative(path.resolve(appRoot,'../..'),fileURLToPath(new URL('../../../'+file,import.meta.url))).split(path.sep).join('/')]??r.pciMain800IntegrityCompatibility?.applicationSourceDigests[path.relative(appRoot,fileURLToPath(new URL('../../../'+file,import.meta.url))).split(path.sep).join('/')]??r.pciLiveAcceptanceStabilization?.publicUiSourceDigests[file]??r.pciLiveAcceptanceStabilization?.applicationSourceDigests[path.relative(appRoot,fileURLToPath(new URL('../../../'+file,import.meta.url))).split(path.sep).join('/')]??r.xraySearchBoundaryConsolidation?.applicationSourceDigests[path.relative(appRoot,fileURLToPath(new URL('../../../'+file,import.meta.url))).split(path.sep).join('/')]??r.freshPerformanceRecovery.applicationSourceDigests[path.relative(appRoot,fileURLToPath(new URL('../../../'+file,import.meta.url))).split(path.sep).join('/')]??digest,file)
 for(const file of current.preservedEnginePaths)assert.equal(hash(fs.readFileSync(new URL('../../../'+file,import.meta.url))),hash(execFileSync('git',['show',current.previousReceiptSourceSha+':'+file],{cwd:appRoot})),file)
 for(const flag of ['calculationMethodChanged','identityOrGrantsChanged','productDeploymentPerformed','schemaChanged'])assert.equal(current[flag],false,flag)
})

// Current receiver additions never rewrite historical source acceptance.
test('PCI stabilization appends exact current source bindings and keeps every earlier receipt and engine',()=>{
 const r=readCurrent(),a=r.pciLiveAcceptanceStabilization
 assert.equal(a.taskId,'SG2-PCI-LIVE-ACCEPTANCE-STABILIZATION-20261030')
 const bytes=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/sg-runtime/operation-integration.json'],{cwd:appRoot})
 assert.equal(hash(bytes),a.previousReceiptSha256)
 for(const[k,v]of Object.entries(JSON.parse(bytes)))assert.deepEqual(r[k],v,k)
 for(const[file,digest]of Object.entries(a.applicationSourceDigests)){
  const continuation=r.pciMain800IntegrityCompatibility
  const historical=continuation?.applicationSourceDigests[file]
   ?execFileSync('git',['show',continuation.pciSourceSha+':apps/sg-runtime/'+file],{cwd:appRoot})
   :preBqlBytes(new URL('../'+file,import.meta.url))
  assert.equal(hash(historical),digest,'original PCI '+file)
  assert.equal(hash(fs.readFileSync(new URL('../'+file,import.meta.url))),r.pciSmartInputCorrective?.applicationSourceDigests[file]??r.fullUiParityAdoption?.applicationSourceDigests[file]??r.pciSmartResultingMainScopeCompatibility?.applicationSourceDigests[file]??r.pciSmartPreparationCompatibility?.applicationSourceDigests[file]??r.bqlLiveAcceptanceCompatibility?.sourceDigests['apps/sg-runtime/'+file]??r.bqlPciFirstSourceCompatibility?.sourceDigests['apps/sg-runtime/'+file]??continuation?.applicationSourceDigests[file]??digest,'current '+file)
 }
 for(const[file,digest]of Object.entries(a.publicUiSourceDigests)){
  assert.equal(hash(preBqlBytes(new URL('../../../'+file,import.meta.url))),digest,'preserved '+file)
  assert.equal(hash(fs.readFileSync(new URL('../../../'+file,import.meta.url))),r.pciSmartResultingMainScopeCompatibility?.sourceDigests[file]??r.pciSmartPreparationCompatibility?.sourceDigests[file]??r.bqlLiveAcceptanceCompatibility?.sourceDigests[file]??r.bqlPciFirstSourceCompatibility?.sourceDigests[file]??digest,'current '+file)
 }
 for(const file of r.pciDatePreparationSourceCompatibility.preservedEnginePaths)assert.equal(hash(fs.readFileSync(new URL('../../../'+file,import.meta.url))),hash(execFileSync('git',['show',a.previousReceiptSourceSha+':'+file],{cwd:appRoot})),file)
 for(const field of ['serverAuthorizationChanged','grantsChanged','calculationChanged','sourceHistoryChanged','productDeploymentPerformed'])assert.equal(a[field],false,field)
 assert.equal(a.proofExpiryPreserved,true);assert.equal(a.additionalPaidProviderCalls,0)
})

function assertBqlIntegrity(receipt,current,historical){
 if(receipt.pciSmartInputCorrective){const n=assertPciInputCorrective(receipt,current,historical);return assertBqlIntegrity(n.prior,n.previousBytes,historical)}
 if(receipt.fullUiParityAdoption){
  const a=receipt.fullUiParityAdoption,bytes=historical(a.previousReceiptSourceSha,'apps/sg-runtime/operation-integration.json')
  assert.equal(hash(bytes),a.previousReceiptDigest)
  const {fullUiParityAdoption,...preserved}=receipt,prior=JSON.parse(bytes)
  assert.deepEqual(preserved,prior,'every earlier receipt remains immutable after full UI adoption')
  for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(current('apps/sg-runtime/'+file)),digest,'full UI current '+file)
  assertBqlIntegrity(prior,file=>Object.hasOwn(a.applicationSourceDigests,file.replace(/^apps\/sg-runtime\//,''))?historical(a.previousReceiptSourceSha,file):current(file),historical)
  return
 }

 if(receipt.pciSmartPreparationCompatibility){const next=assertPciSmartIntegrity(receipt,current,historical);assertBqlIntegrity(next.prior,next.previousBytes,historical);return}
 if(receipt.bqlLiveAcceptanceCompatibility){
  const a=receipt.bqlLiveAcceptanceCompatibility,bytes=historical(a.previousReceiptSourceSha,'apps/sg-runtime/operation-integration.json')
  assert.equal(a.taskId,'SG2-BQL-PCI-FIRST-IMPLEMENTATION-20261030');assert.equal(a.rulesetVersion,'bql-semantic/1.0.1')
  assert.equal(hash(bytes),a.previousReceiptSha256)
  const {bqlLiveAcceptanceCompatibility,...preserved}=receipt,prior=JSON.parse(bytes)
  assert.deepEqual(preserved,prior,'live refinement preserves the original BQL receipt and all historical digests')
  assert.deepEqual(Object.keys(a.sourceDigests).sort(),a.changedSourcePaths)
  assert.deepEqual(a.applicationSourceDigests,Object.fromEntries(Object.entries(a.sourceDigests).filter(([file])=>file.startsWith('apps/sg-runtime/')).map(([file,digest])=>[file.slice(16),digest])))
  for(const[file,digest]of Object.entries(a.sourceDigests))assert.equal(hash(current(file)),digest,'live refinement exact '+file)
  for(const flag of ['calculationChanged','sourceHistoryChanged','authorizationChanged','schemaChanged','newProviderCalls','srmRuntimeChanged'])assert.equal(a[flag],false,flag)
  assertBqlIntegrity(prior,file=>Object.hasOwn(a.sourceDigests,file)?historical(a.previousReceiptSourceSha,file):current(file),historical)
  return
 }
 const a=receipt.bqlPciFirstSourceCompatibility
 assert.equal(a.taskId,'SG2-BQL-PCI-FIRST-IMPLEMENTATION-20261030')
 const prior=historical(a.previousReceiptSourceSha,'apps/sg-runtime/operation-integration.json')
 assert.equal(hash(prior),a.previousReceiptSha256)
 const {bqlPciFirstSourceCompatibility,...preserved}=receipt
 assert.deepEqual(preserved,JSON.parse(prior),'every earlier source acceptance is immutable')
 assert.deepEqual(Object.keys(a.sourceDigests).sort(),a.changedSourcePaths)
 assert.deepEqual(a.applicationSourceDigests,Object.fromEntries(Object.entries(a.sourceDigests).filter(([file])=>file.startsWith('apps/sg-runtime/')).map(([file,digest])=>[file.slice(16),digest])))
 for(const[file,digest]of Object.entries(a.sourceDigests))assert.equal(hash(current(file)),digest,'BQL current '+file)
 for(const file of a.preservedEnginePaths)assert.equal(hash(current(file)),hash(historical(a.previousReceiptSourceSha,file)),file)
 for(const flag of ['calculationChanged','sourceHistoryChanged','authorizationChanged','schemaChanged','newProviderCalls','srmRuntimeChanged'])assert.equal(a[flag],false,flag)
}
test('BQL appends exact current inputs, retains every prior receipt and rejects manipulated source or evidence',()=>{
 const receipt=readCurrent(),current=file=>fs.readFileSync(new URL('../../../'+file,import.meta.url))
 const historical=(sha,file)=>execFileSync('git',['show',sha+':'+file],{cwd:appRoot})
 assertBqlIntegrity(receipt,current,historical)
 const first=receipt.bqlPciFirstSourceCompatibility.changedSourcePaths[0]
 assert.throws(()=>assertBqlIntegrity(receipt,file=>file===first?Buffer.concat([current(file),Buffer.from('tamper')]):current(file),historical))
 const altered=structuredClone(receipt);altered.bqlPciFirstSourceCompatibility.sourceDigests[first]='0'.repeat(64)
 assert.throws(()=>assertBqlIntegrity(altered,current,historical))
 const changedHistory=structuredClone(receipt);changedHistory.pciLiveAcceptanceStabilization.additionalPaidProviderCalls=1
 assert.throws(()=>assertBqlIntegrity(changedHistory,current,historical))
 assert.throws(()=>assertBqlIntegrity(receipt,current,(sha,file)=>Buffer.concat([historical(sha,file),Buffer.from('tamper')])))
})

test('live BQL refinement rejects manipulation of its new component, evidence or historical receipt',()=>{
 const receipt=readCurrent(),a=receipt.bqlLiveAcceptanceCompatibility,current=file=>fs.readFileSync(new URL('../../../'+file,import.meta.url))
 const historical=(sha,file)=>execFileSync('git',['show',sha+':'+file],{cwd:appRoot})
 assert(a);assertBqlIntegrity(receipt,current,historical)
 const component='apps/sg-runtime/components/benchmark-picker/benchmark-qualification.tsx'
 assert.throws(()=>assertBqlIntegrity(receipt,file=>file===component?Buffer.concat([current(file),Buffer.from('tamper')]):current(file),historical))
 const altered=structuredClone(receipt);altered.bqlLiveAcceptanceCompatibility.sourceDigests[component]='0'.repeat(64)
 assert.throws(()=>assertBqlIntegrity(altered,current,historical))
 const changed=structuredClone(receipt);changed.bqlPciFirstSourceCompatibility.rulesetVersion='rewritten'
 assert.throws(()=>assertBqlIntegrity(changed,current,historical))
})
