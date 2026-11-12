import test from 'node:test'
import './procurement-insights-notification-navigation.test.tsx'
import './procurement-insights-live-acceptance-source.test.mjs'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(path.join(app,'package.json'))
const {buildSync}=require('esbuild'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{JSDOM}=require('jsdom')
function component(file:string,name:string){
 const result=buildSync({entryPoints:[path.join(app,file)],bundle:true,platform:'node',format:'cjs',write:false,external:['react','react-dom','react/jsx-runtime'],logLevel:'silent'})
 const module={exports:{} as Record<string,import('react').ComponentType<any>>};new Function('require','module','exports',result.outputFiles[0].text)(require,module,module.exports);return module.exports[name]
}
const Inline=component('components/procurement-insights/inline-item.tsx','NewsfeedInlineItem'),Statistics=component('components/procurement-insights/statistics.tsx','NewsfeedStatistics'),Form=component('components/procurement-insights/observation-form.tsx','ObservationForm')
test('inline publication uses the canonical expander and a safe original link without a modal or automatic summary',()=>{
 const html=renderToStaticMarkup(React.createElement(Inline,{locale:'pl',item:{id:'SYNTHETIC_ONLY',kind:'WEB_PAGE',url:'https://example.test/original',headline:'SYNTHETIC_ONLY',publishedAt:null,detectedAt:'2026-11-10T08:00:00Z',excerpt:null,excerptStatus:'NOT_RETAINED'}}))
 assert.match(html,/<details/);assert.match(html,/SRM-C49/);assert.match(html,/Data publikacji nieznana/);assert.match(html,/href="https:\/\/example.test\/original"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);assert.doesNotMatch(html,/role="dialog"|Podsumuj|Porozmawiaj z asystentem|blob:/)
})
test('statistics chart and table consume the same returned counts; empty history does not become invented zero series',()=>{
 const empty=renderToStaticMarkup(React.createElement(Statistics,{data:{status:'NO_HISTORY',days:[],phrases:[],total:0,undated:0}}));assert.match(empty,/Brak zapisanej historii/);assert.doesNotMatch(empty,/<svg/)
 const html=renderToStaticMarkup(React.createElement(Statistics,{data:{status:'AVAILABLE',dateBasis:'detectedAt',timeZone:'Europe/Warsaw',undated:0,total:13,phrases:[{phrase:'SYNTHETIC_ONLY',count:13}],days:[{date:'2026-11-10',total:13,counts:[13]}]}}));assert.match(html,/<svg/);assert.match(html,/<table/);assert.match(html,/13 unikalnych publikacji/);assert.match(html,/<td>13<\/td>/)
})
test('observation form validates input and keeps save separate from explicit new acquisition',async()=>{
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://example.test',runScripts:'outside-only'})
 // jsdom has no task channel; use a macrotask, as the browser channel does.
 ;(dom.window as any).MessageChannel=class{port1:{onmessage:(()=>void)|null}={onmessage:null};port2={postMessage:()=>setImmediate(()=>this.port1.onmessage?.())}}
 const original={window:globalThis.window,document:globalThis.document,navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator')}
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator})
 const browser=buildSync({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {ObservationForm} from './components/procurement-insights/observation-form';window.PItest={React,createRoot,Form:ObservationForm};`,resolveDir:app,loader:'tsx'},bundle:true,platform:'browser',format:'iife',write:false,define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent'})
 dom.window.eval(browser.outputFiles[0].text);(dom.window as any).IS_REACT_ACT_ENVIRONMENT=true
 const {React:BrowserReact,createRoot,Form:BrowserForm}=(dom.window as any).PItest,node=dom.window.document.getElementById('root')!,root=createRoot(node),calls:Array<{body:Record<string,unknown>;search:boolean}>=[]
 const click=async(label:string)=>{const button=[...node.querySelectorAll('button')].find(x=>x.textContent===label);assert(button,label);await BrowserReact.act(async()=>button.click())}
 const fill=async(input:HTMLInputElement,value:string)=>{await BrowserReact.act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));input.dispatchEvent(new dom.window.Event('change',{bubbles:true}))})}
 try{
  await BrowserReact.act(async()=>root.render(BrowserReact.createElement(BrowserForm,{initial:null,locale:'pl',busy:false,onCancel:()=>{},onSave:async(body:Record<string,unknown>,search:boolean)=>{calls.push({body,search})}})))
  await click('Zapisz obserwację');assert.equal(calls.length,0);assert.match(node.textContent??'',/Podaj nazwę/)
  const inputs=node.querySelectorAll('input');await fill(inputs[0] as HTMLInputElement,'SYNTHETIC_ONLY');await fill(inputs[1] as HTMLInputElement,'oil');await click('Dodaj')
  await click('Zapisz obserwację');assert.equal(calls.length,1);assert.equal(calls[0].search,false);assert.equal(calls[0].body.contractVersion,'1.2.0');assert(!('ownerUserId' in calls[0].body));assert(!('organisationId' in calls[0].body))
  await click('Zapisz i sprawdź nowe artykuły');assert.equal(calls.length,2);assert.equal(calls[1].search,true)
 }finally{await BrowserReact.act(async()=>root.unmount());dom.window.close();globalThis.window=original.window;globalThis.document=original.document;if(original.navigator)Object.defineProperty(globalThis,'navigator',original.navigator);else Reflect.deleteProperty(globalThis,'navigator');Reflect.deleteProperty(globalThis,'IS_REACT_ACT_ENVIRONMENT')}
})

test('SYNTHETIC_ONLY: report order keeps its explicit retry key and never presents a failed write as a queued report',async()=>{
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://example.test/pl/dashboard/procurement-insights?tab=reports',runScripts:'outside-only'})
 ;(dom.window as any).MessageChannel=class{port1:{onmessage:(()=>void)|null}={onmessage:null};port2={postMessage:()=>setImmediate(()=>this.port1.onmessage?.())}}
 const browser=buildSync({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {ReportsWorkspace} from './components/procurement-insights/reports';window.PItest={React,createRoot,ReportsWorkspace};`,resolveDir:app,loader:'tsx'},bundle:true,platform:'browser',format:'iife',write:false,define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent'})
 const profile={definitionId:'oil-asphalt',profileVersion:'SYNTHETIC_ONLY',label:'SYNTHETIC_ONLY',description:'Offline test',availability:'AVAILABLE',subjectMode:'NONE',cadences:['ONCE','WEEKLY'],timeZones:['Europe/Warsaw'],deliveryChannels:['ASSISTANT'],sections:[]},calls:Array<{key:string;body:Record<string,unknown>}>=[]
 Object.defineProperty(dom.window.crypto,'randomUUID',{value:()=>crypto.randomUUID()})
 ;(dom.window as any).AbortController=AbortController
 ;(dom.window as any).fetch=async(url:string,options:RequestInit)=>{
  assert(String(url).startsWith('/api/v1/insights/subscriptions'));assert.equal(new Headers(options.headers).get('authorization'),'Bearer SYNTHETIC_ONLY');assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error')
  if(url.endsWith('/workspace'))return Response.json({catalog:[profile],orders:{items:[],nextCursor:null},editions:{items:[],nextCursor:null}})
  if(options.method==='POST'){
   const body=JSON.parse(String(options.body));calls.push({key:new Headers(options.headers).get('idempotency-key')!,body})
   if(calls.length===1)return Response.json({error:{code:'SYNTHETIC_OUTAGE'}},{status:503})
   return Response.json({...body,id:'SYNTHETIC_ORDER',version:1,status:'ACTIVE',executionState:'QUEUED',nextDueAt:null})
  }
  if(url.endsWith('/SYNTHETIC_ORDER/runs'))return Response.json({items:[],nextCursor:null})
  throw Error('UNEXPECTED_TEST_NETWORK')
 }
 dom.window.eval(browser.outputFiles[0].text);(dom.window as any).IS_REACT_ACT_ENVIRONMENT=true
 const {React:R,createRoot,ReportsWorkspace}=(dom.window as any).PItest,node=dom.window.document.getElementById('root')!,root=createRoot(node)
 const click=async(label:string)=>{const b=[...node.querySelectorAll('button')].find(x=>x.textContent===label);assert(b,label);await R.act(async()=>{b.click();await new Promise(r=>setTimeout(r,5))})}
 const fill=async(input:HTMLInputElement,value:string)=>{await R.act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}))})}
 try{
  const getToken=async()=>'SYNTHETIC_ONLY';await R.act(async()=>{root.render(R.createElement(ReportsWorkspace,{active:true,locale:'pl',getToken}));await new Promise(r=>setTimeout(r,10))})
  await click('+ Zamów raport');await fill(node.querySelector('input') as HTMLInputElement,'SYNTHETIC_ONLY')
  const select=node.querySelector('select') as HTMLSelectElement;await R.act(async()=>{select.value='oil-asphalt@SYNTHETIC_ONLY';select.dispatchEvent(new dom.window.Event('change',{bubbles:true}))})
  await click('Zamów raport');assert.equal(calls.length,1);assert(node.querySelector('[role=alert]'));assert(!(node.textContent??'').includes('Zapisano zlecenie'))
  await click('Zamów raport');assert.equal(calls.length,2);assert.equal(calls[0].key,calls[1].key);assert.deepEqual(calls[0].body,calls[1].body);assert(!('ownerUserId' in calls[0].body));assert(!('organisationId' in calls[0].body));assert((node.textContent??'').includes('Zapisano zlecenie'))
 }finally{await R.act(async()=>root.unmount());dom.window.close()}
})
