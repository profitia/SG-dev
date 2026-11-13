// SYNTHETIC_ONLY: real workspace interactions with offline HTTP fixtures.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
const app=fileURLToPath(new URL('../',import.meta.url)),require=createRequire(app+'package.json')
const {build}=require('esbuild'),{JSDOM}=require('jsdom')
test('an assistant publication link opens its saved article from notifications, statistics and the same repeated selection',async()=>{
 const observation='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',publication='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/pl/dashboard/procurement-insights?observation='+observation,runScripts:'outside-only'}),w=dom.window as any
 w.MessageChannel=class{port1={onmessage:null as null|(()=>void)};port2={postMessage:()=>setImmediate(()=>this.port1.onmessage?.())}}
 w.AbortController=AbortController;w.AbortSignal=AbortSignal
 const calls:string[]=[],empty={items:[],nextCursor:null},item={id:publication,kind:'WEB_PAGE',headline:'SYNTHETIC_SAVED_ARTICLE',url:'https://example.test/article',publishedAt:null,detectedAt:'2026-11-12T15:12:11Z',excerpt:null,excerptStatus:'NOT_RETAINED'}
 const o={id:observation,name:'SYNTHETIC_OBSERVATION',phrases:['oil'],status:'PAUSED',readOnly:true,schedule:null,notifications:false,version:1}
 w.fetch=async(url:string,options:RequestInit)=>{
  assert.equal(options.method,'GET','navigation must not acquire, mutate or call AI');calls.push(url)
  const path=new URL(url,'https://example.test').pathname
  if(path==='/api/v1/newsfeed/observations')return Response.json({items:[o],nextCursor:null})
  if(path.endsWith('/publications'))return Response.json({items:[item],nextCursor:null})
  if(path.endsWith('/notifications'))return Response.json(empty)
  if(path.endsWith('/statistics'))return Response.json({status:'NO_HISTORY',days:[],phrases:[],total:0,undated:0})
  throw Error('UNEXPECTED_NETWORK '+path)
 }
 const built=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {ProcurementInsightsWorkspace} from './components/procurement-insights/workspace';window.fixture={React,createRoot,Component:ProcurementInsightsWorkspace};`,resolveDir:app,loader:'tsx'},bundle:true,platform:'browser',format:'iife',write:false,loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'offline-session-router',setup(b:any){
  b.onResolve({filter:/^next\/navigation$/},()=>({path:'router',namespace:'offline'}))
  b.onResolve({filter:/session-boundary$/},()=>({path:'session',namespace:'offline'}))
  b.onLoad({filter:/.*/,namespace:'offline'},(args:any)=>({contents:args.path==='router'?`let search,params;export function useSearchParams(){if(search!==window.location.search){search=window.location.search;params=new URLSearchParams(search)}return params}export const useRouter=()=>window.router;export const usePathname=()=>window.location.pathname;`:`const getToken=async()=>'SYNTHETIC_ONLY';export const useSg2SessionCredential=()=>getToken;`}))
 }}],logLevel:'silent'})
 w.eval(built.outputFiles[0].text);w.IS_REACT_ACT_ENVIRONMENT=true
 const {React:R,createRoot,Component}=w.fixture,node=w.document.getElementById('root'),root=createRoot(node)
 const props={active:true,locale:'pl',onReturn:()=>{},onContext:()=>{}}
 const flush=()=>new Promise(r=>setTimeout(r,10))
 w.router={push:(url:string)=>{w.history.pushState({},'',url);root.render(R.createElement(Component,props))}}
 const click=async(label:string)=>{const b=[...node.querySelectorAll('button')].find((e:any)=>e.textContent===label) as HTMLButtonElement;assert(b,label);await R.act(async()=>{b.click();await flush()})}
 const open=async()=>{await R.act(async()=>{w.router.push('/pl/dashboard/procurement-insights?observation='+observation+'&publication='+publication);await flush()})}
 const article=()=>assert.match(node.querySelector('details[open]')?.textContent??'',/SYNTHETIC_SAVED_ARTICLE/)
 try{
  await R.act(async()=>{root.render(R.createElement(Component,props));await flush()})
  await click('Powiadomienia');await open();article()
  await click('Statystyki');assert.equal(new URLSearchParams(w.location.search).has('publication'),false)
  assert.match(node.textContent,/Brak zapisanej historii/);await open();article()
  await click('Powiadomienia');assert.equal(new URLSearchParams(w.location.search).has('publication'),false)
  await open();article();assert(calls.some(p=>p.includes('publicationId='+publication)))
  assert(calls.every(p=>!p.includes('/discover')&&!p.includes('/assistant')))
 }finally{await R.act(async()=>root.unmount());dom.window.close()}
})
