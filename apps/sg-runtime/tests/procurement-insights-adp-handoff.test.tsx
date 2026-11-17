// SYNTHETIC_ONLY: actual UI and canonical components; no LIVE acceptance or provider calls.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
const app=fileURLToPath(new URL('../',import.meta.url)),require=createRequire(app+'package.json')
const {build}=require('esbuild'),{JSDOM}=require('jsdom')
const nip='5213390341',krs='0000000001',name='Synthetic Verified Supplier',ref='a'.repeat(64)
const supplier={krs,nip,name,selectionRef:ref},empty={items:[],nextCursor:null}
async function mount(component:string,module:string,props:Record<string,unknown>,transport:(url:string,options:RequestInit)=>Promise<Response>,query=''){
 const dom=new JSDOM('<div id="root"></div>',{url:'https://dev-sg2.spendguru.app/pl/dashboard/procurement-insights'+query,runScripts:'outside-only'}),w=dom.window as any
 w.MessageChannel=class{port1={onmessage:null as null|(()=>void)};port2={postMessage:()=>setImmediate(()=>this.port1.onmessage?.())}}
 w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.Headers=Headers;w.Request=Request;w.Response=Response;
 w.AbortController=AbortController;w.AbortSignal=AbortSignal;Object.defineProperty(w.crypto,'randomUUID',{value:()=>crypto.randomUUID()});w.fetch=transport
 const adp=path.resolve(app,'../../packages/srm-adp-ui'),result=await build({stdin:{contents:"import React from 'react';import {createRoot} from 'react-dom/client';import {"+component+"} from './"+module+"';window.fixture={React,createRoot,Component:"+component+"};",resolveDir:app,loader:'tsx'},bundle:true,platform:'browser',format:'iife',write:false,loader:{'.css':'empty'},nodePaths:(process.env.NODE_PATH??'').split(path.delimiter).filter(Boolean),alias:{react:path.dirname(require.resolve('react/package.json')),'react-dom':path.dirname(require.resolve('react-dom/package.json'))},define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'synthetic-session-and-router',setup(b:any){
  b.onResolve({filter:/^@profitia\/srm-adp-ui(?:\/styles\.css)?$/},(a:any)=>({path:path.join(adp,a.path.endsWith('styles.css')?'src/styles.css':'src/index.ts')}))
  b.onResolve({filter:/^next\/navigation$/},()=>({path:'router',namespace:'fixture'}));b.onResolve({filter:/session-boundary$/},()=>({path:'session',namespace:'fixture'}))
  b.onLoad({filter:/.*/,namespace:'fixture'},(a:any)=>({contents:a.path==='router'?"let s,p;export function useSearchParams(){if(s!==window.location.search){s=window.location.search;p=new URLSearchParams(s)}return p}export const useRouter=()=>window.router;export const usePathname=()=>window.location.pathname;":"const getToken=async()=>'SYNTHETIC_ONLY';export const useSg2SessionCredential=()=>getToken;"}))
 }}],logLevel:'silent'})
 w.eval(result.outputFiles[0].text);w.IS_REACT_ACT_ENVIRONMENT=true
 const {React:R,createRoot,Component}=w.fixture,node=w.document.getElementById('root'),root=createRoot(node),flush=()=>new Promise(r=>setTimeout(r,10));let current=props
 w.router={push:(url:string)=>{w.history.pushState({},'',url);root.render(R.createElement(Component,current))}}
 await R.act(async()=>{root.render(R.createElement(Component,current));await flush()})
 return {w,R,node,async click(label:string){const buttons=[...node.querySelectorAll('button')].filter((e:any)=>e.textContent===label);assert.equal(buttons.length,1,label);await R.act(async()=>{buttons[0].click();await flush()})},async render(p:Record<string,unknown>){current=p;await R.act(async()=>{root.render(R.createElement(Component,current));await flush()})},async input(label:string,value:string){const field=[...node.querySelectorAll('label')].find((e:any)=>e.textContent.includes(label));const element=field?.querySelector('input')??(field?.htmlFor?w.document.getElementById(field.htmlFor):null);assert(element,label);await R.act(async()=>{Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value')!.set!.call(element,value);element.dispatchEvent(new w.Event('input',{bubbles:true}));await flush()})},async close(){await R.act(async()=>root.unmount());dom.window.close()}}
}
const query='?'+new URLSearchParams({supplierNip:nip,supplierName:name})
const props={locale:'pl',active:true,onReturn:()=>{},onContext:()=>{}}
function feed(url:string){if(url.includes('/observations'))return Response.json(empty);if(url.includes('/feed'))return Response.json(empty);throw Error('Unexpected synthetic network '+url)}
test('ADP context navigation reads only stored supplier identity, offers existing observations and seeds an explicit company draft',async()=>{
 const calls:Array<{url:string;method:string}>=[],existing={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Existing supplier observation',subjectKind:'company',subject:nip,status:'PAUSED',phrases:[nip],schedule:null,readOnly:true,version:1}
 const f=await mount('ProcurementInsightsWorkspace','components/procurement-insights/workspace.tsx',props,async(url,options)=>{calls.push({url,method:options.method??'GET'});if(url.startsWith('/api/appshell/xray/presentation/registrySelection'))return Response.json({...supplier,locality:null});if(url.endsWith('/observations'))return Response.json({items:[existing],nextCursor:null});return feed(url)},query)
 try{const context=f.node.querySelector('[aria-label="Kontekst dostawcy z ADP"]');assert.match(context?.textContent??'',/Synthetic Verified Supplier/);assert.match(context?.textContent??'',/5213390341/);assert.match(context?.textContent??'',/Otwórz obserwację: Existing supplier observation/)
  await f.click('+ Nowa obserwacja');assert.equal(f.node.querySelector('[data-canon-usage="PI:observation-name"]')?.value,name);assert.match(f.node.querySelector('.pi-phrases')?.textContent??'',/5213390341/);assert(calls.every(x=>x.method==='GET'||x.url==='/api/appshell/xray/presentation/registrySelection')); assert(!calls.some(x=>/discover|assistant|source-hub/.test(x.url)))
 }finally{await f.close()}
})
test('a revoked supplier selection is cleared before an explicit observation can be saved',async()=>{
 let reads=0,writes=0;const f=await mount('ProcurementInsightsWorkspace','components/procurement-insights/workspace.tsx',props,async(url,options)=>{
  if(url.startsWith('/api/appshell/xray/presentation/registrySelection'))return ++reads===1?Response.json({...supplier,locality:null}):Response.json({error:'DENIED'},{status:403})
  if(options.method==='POST'){writes++;throw Error('No write after revocation')}return feed(url)
 },query)
 try{await f.click('+ Nowa obserwacja');await f.click('Zapisz obserwację');assert.equal(reads,2);assert.equal(writes,0);const context=f.node.querySelector('[aria-label="Kontekst dostawcy z ADP"]');assert.match(context?.textContent??'',/Nie można potwierdzić/);assert.doesNotMatch(context?.textContent??'',/Synthetic Verified Supplier/);assert.equal(f.node.querySelector('[data-canon-usage="PI:observation-name"]'),null)}finally{await f.close()}
})
test('untrusted ADP label mismatch never becomes a confirmed supplier context or acquisition',async()=>{
 const calls:string[]=[],f=await mount('ProcurementInsightsWorkspace','components/procurement-insights/workspace.tsx',props,async(url,options)=>{assert(options.method==='GET'||url==='/api/appshell/xray/presentation/registrySelection');calls.push(url);return url.startsWith('/api/appshell/xray/presentation/registrySelection')?Response.json({...supplier,locality:null}):feed(url)},'?'+new URLSearchParams({supplierNip:nip,supplierName:'Untrusted different company'}))
 try{const context=f.node.querySelector('[aria-label="Kontekst dostawcy z ADP"]');assert.match(context?.textContent??'',/Nie można potwierdzić/);assert.doesNotMatch(context?.textContent??'',/Synthetic Verified Supplier/);assert(!calls.some(x=>/discover|assistant|source-hub/.test(x)))}finally{await f.close()}
})
test('leaving the module aborts a slow supplier read and discards its late result',async()=>{
 let resolve:(v:Response)=>void=()=>{};const f=await mount('ProcurementInsightsWorkspace','components/procurement-insights/workspace.tsx',props,async(url)=>url.startsWith('/api/appshell/xray/presentation/registrySelection')?new Promise<Response>(r=>{resolve=r}):feed(url),query)
 try{await f.render({...props,active:false});await f.R.act(async()=>{resolve(Response.json({...supplier,locality:null}));await new Promise(r=>setTimeout(r,10))});assert.doesNotMatch(f.node.querySelector('[aria-label="Kontekst dostawcy z ADP"]')?.textContent??'',/Synthetic Verified Supplier/)}finally{await f.close()}
})
test('existing ADP Newsfeed action passes only explicit company hints and performs no network request',async()=>{
 const selections:unknown[]=[],navigations:unknown[]=[],f=await mount('AdpModuleHost','components/appshell/adp-module-host.tsx',{locale:'pl',theme:'light',active:true,organizationDisplayName:'Synthetic organization',navigation:{view:'data',section:'company',dataArea:'adp'},onNavigate:(v:unknown)=>navigations.push(v),onReturn:()=>{},onNewsfeed:(v:unknown)=>selections.push(v)},async()=>{throw Error('ADP must not acquire or read data')})
 try{await f.click('Newsfeed');assert.equal(selections.length,0);assert.match(f.node.querySelector('[role="alert"]')?.textContent??'',/Podaj nazwę i NIP/);await f.input('Pełna nazwa firmy',name);await f.input('NIP (PL)',nip);await f.click('Newsfeed');assert.deepEqual(JSON.parse(JSON.stringify(selections)),[{name,nip}]);assert.equal(navigations.length,0)}finally{await f.close()}
})
