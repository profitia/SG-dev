// SYNTHETIC_ONLY: consumer regressions. These are not a Development business acceptance.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
const app=fileURLToPath(new URL('../',import.meta.url)),require=createRequire(app+'package.json')
const {build}=require('esbuild'),{JSDOM}=require('jsdom')
const observation='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',publication='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const empty={items:[],nextCursor:null}
async function mount(name:string,file:string,props:Record<string,unknown>,transport?:(url:string,options:RequestInit)=>Promise<Response>){
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/en/dashboard/procurement-insights',runScripts:'outside-only'}),w=dom.window as any
 w.MessageChannel=class{port1={onmessage:null as null|(()=>void)};port2={postMessage:()=>setImmediate(()=>this.port1.onmessage?.())}}
 w.AbortController=AbortController;w.AbortSignal=AbortSignal;Object.defineProperty(w.crypto,'randomUUID',{value:()=>crypto.randomUUID()})
 w.fetch=transport??(()=>{throw Error('UNEXPECTED_NETWORK')})
 const built=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {${name}} from './components/procurement-insights/${file}';window.fixture={React,createRoot,Component:${name}};`,resolveDir:app,loader:'tsx'},bundle:true,platform:'browser',format:'iife',write:false,loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'offline-session-router',setup(b:any){
  b.onResolve({filter:/^next\/navigation$/},()=>({path:'router',namespace:'offline'}));b.onResolve({filter:/session-boundary$/},()=>({path:'session',namespace:'offline'}));b.onLoad({filter:/.*/,namespace:'offline'},(a:any)=>({contents:a.path==='router'?`let search,params;export function useSearchParams(){if(search!==window.location.search){search=window.location.search;params=new URLSearchParams(search)}return params}export const useRouter=()=>window.router;export const usePathname=()=>window.location.pathname;`:`const getToken=async()=>'SYNTHETIC_ONLY';export const useSg2SessionCredential=()=>getToken;`}))
 }}],logLevel:'silent'})
 w.eval(built.outputFiles[0].text);w.IS_REACT_ACT_ENVIRONMENT=true
 const {React:R,createRoot,Component}=w.fixture,node=w.document.getElementById('root'),root=createRoot(node),flush=()=>new Promise(r=>setTimeout(r,10))
 w.router={push:(url:string)=>{w.history.pushState({},'',url);root.render(R.createElement(Component,props))}}
 await R.act(async()=>{root.render(R.createElement(Component,props));await flush()})
 return {w,R,node,async click(label:string){const buttons=[...node.querySelectorAll('button')].filter((e:any)=>e.textContent===label);assert.equal(buttons.length,1,label);await R.act(async()=>{buttons[0].click();await flush()})},async close(){await R.act(async()=>root.unmount());dom.window.close()}}
}
test('workspace notification targets its exact publication even when the independent read receipt fails',async()=>{
 const calls:Array<{url:string;method:string}>=[],o={id:observation,name:'SYNTHETIC_OBSERVATION',phrases:['oil'],status:'PAUSED',readOnly:true,schedule:null,notifications:false,version:1}
 const b=await mount('ProcurementInsightsWorkspace','workspace',{active:true,locale:'en',onReturn:()=>{},onContext:()=>{}},async(url,options)=>{
  const method=options.method??'GET';calls.push({url,method});const u=new URL(url,'https://example.test')
  if(method==='PATCH'){assert(u.pathname.endsWith('/notifications/SYNTHETIC_NOTICE'));return Response.json({error:{code:'UNAVAILABLE'}},{status:503})}
  assert.equal(method,'GET','navigation does not acquire data or call AI')
  if(u.pathname.endsWith('/notifications'))return Response.json({items:[{id:'SYNTHETIC_NOTICE',observationId:observation,publicationId:publication,createdAt:'2026-11-12T15:12:11Z',readAt:null}],nextCursor:null})
  if(u.pathname.endsWith('/observations'))return Response.json({items:[o],nextCursor:null})
  if(u.pathname.endsWith('/publications')){assert.equal(u.searchParams.get('publicationId'),publication);return Response.json({items:[{id:publication,kind:'WEB_PAGE',headline:'SYNTHETIC_EXACT_PUBLICATION',url:'https://example.test/article',publishedAt:null,excerpt:null}],nextCursor:null})}
  if(u.pathname.endsWith('/feed'))return Response.json(empty)
  throw Error('UNEXPECTED_NETWORK '+url)
 })
 try{await b.click('Notifications');await b.click('View information');assert.equal(new URLSearchParams(b.w.location.search).get('publication'),publication);assert.match(b.node.querySelector('details[open]')?.textContent??'',/SYNTHETIC_EXACT_PUBLICATION/);assert(calls.some(c=>c.method==='PATCH'));assert(!calls.some(c=>/discover|assistant|source-hub/.test(c.url)));assert.match(b.node.textContent,/Publication date unknown/)}finally{await b.close()}
})
test('English observation form keeps canonical controls, validation, schedule and explicit acquisition choice',async()=>{
 const commands:unknown[]=[],b=await mount('ObservationForm','observation-form',{initial:null,locale:'en',busy:false,onCancel:()=>{},onSave:async(...args:unknown[])=>{commands.push(args)}})
 try{assert.match(b.node.textContent,/New observation/);assert.match(b.node.textContent,/Observation name/);assert.match(b.node.textContent,/Save and check for new articles/);assert(b.node.querySelector('[data-canon-id="SRM-C06"]')||b.node.innerHTML.includes('SRM-C06'));await b.click('Save observation');assert.match(b.node.querySelector('[role=alert]')?.textContent??'',/Enter a name and add at least one phrase/);assert.equal(commands.length,0);const labels=[...b.node.querySelectorAll('label')];const recurring=labels.find((e:any)=>e.textContent.includes('Monitor on a schedule'));assert(recurring);await b.R.act(async()=>recurring.querySelector('input').click());assert.match(b.node.textContent,/Time zone/);assert.match(b.node.textContent,/End date/);assert.doesNotMatch(b.node.textContent,/Nazwa obserwacji|Strefa czasowa|Zapisz obserwację/)}finally{await b.close()}
})
test('English report controls retain a real unpublished state and disclose unconfirmed email delivery',async()=>{
 const profile={definitionId:'oil-asphalt',profileVersion:'SYNTHETIC_ONLY',label:'SYNTHETIC_PROFILE',description:'SYNTHETIC_ONLY',availability:'AVAILABLE',subjectMode:'NONE',cadences:['ONCE','WEEKLY'],timeZones:['Europe/Warsaw'],deliveryChannels:['ASSISTANT','EMAIL'],sections:[]}
 const order={id:'SYNTHETIC_ORDER',definitionId:'oil-asphalt',profileVersion:'SYNTHETIC_ONLY',name:'SYNTHETIC_ORDER',status:'ACTIVE',version:1,executionState:'READY',schedule:{frequency:'WEEKLY',weekday:1,localTime:'08:00',timeZone:'Europe/Warsaw',startDate:'2026-11-17',endDate:null},notifications:{assistant:false,email:false},nextDueAt:null}
 const b=await mount('ReportsWorkspace','reports',{active:true,locale:'en',getToken:async()=>'SYNTHETIC_ONLY'},async(url,options)=>{
  assert.equal(options.method,'GET');if(url.endsWith('/workspace'))return Response.json({catalog:[profile],orders:{items:[order],nextCursor:null},editions:empty})
  if(url.endsWith('/SYNTHETIC_ORDER/runs'))return Response.json({items:[{id:'SYNTHETIC_RUN',status:'AWAITING_REVIEW',producerJobId:'SYNTHETIC_JOB',createdAt:'2026-11-17T08:00:00Z',emailDelivery:'ACCEPTED'}],nextCursor:null})
  throw Error('UNEXPECTED_NETWORK '+url)
 })
 try{assert.match(b.node.textContent,/Report library/);assert.match(b.node.textContent,/No published editions/);await b.click('My subscriptions');await b.click('SYNTHETIC_ORDER');assert.match(b.node.textContent,/Ready for execution/);assert.match(b.node.textContent,/Quality review/);assert.match(b.node.textContent,/delivery unconfirmed/);assert(![...b.node.querySelectorAll('button')].some((e:any)=>e.textContent==='Read published edition'));await b.click('Edit');assert.match(b.node.textContent,/Day of week/);assert.match(b.node.textContent,/Monday/);assert.match(b.node.textContent,/No end date/);assert.match(b.node.textContent,/verified account address/);assert.doesNotMatch(b.node.textContent,/Strefa czasowa|Zamów raport|Dzień tygodnia/)}finally{await b.close()}
})
test('English statistics preserve exact counts and the distinction between missing publication dates and detection dates',async()=>{
 const b=await mount('NewsfeedStatistics','statistics',{locale:'en',data:{status:'AVAILABLE',dateBasis:'detectedAt',timeZone:'Europe/Warsaw',undated:23,total:23,phrases:[{phrase:'oil',count:23}],days:[{date:'2026-11-16',total:23,counts:[23]}]}})
 try{assert.match(b.node.textContent,/23 unique publications/);assert.match(b.node.textContent,/by detection date/);assert.match(b.node.textContent,/23 matching publications do not have the date required/);assert(b.node.querySelector('svg'));assert.equal(b.node.querySelector('tbody td')?.textContent,'23');assert.match(b.node.textContent,/Exact chart data/);assert.doesNotMatch(b.node.textContent,/unikalnych|Data publikacji/)}finally{await b.close()}
})
test('current UI closure rejects missing or altered source, widened scope and replaced immutable receipts',async()=>{
 const {readFileSync}=await import('node:fs'),{execFileSync}=await import('node:child_process'),{assistantNotificationsPredecessor}=await import('./assistant-notifications-integrity.mjs')
 const root=fileURLToPath(new URL('../../../',import.meta.url)),receipt='apps/sg-runtime/procurement-insights-e2e-continuation.json',current=(p:string)=>readFileSync(root+p),cache=new Map<string,Buffer>(),historical=(sha:string,p:string)=>{const key=sha+':'+p;if(!cache.has(key))cache.set(key,execFileSync('git',['show',key],{cwd:root,stdio:['ignore','pipe','pipe']}));return cache.get(key)!}
 const view=assistantNotificationsPredecessor(current,historical);assert(view?.successor)
 const a=JSON.parse(current(receipt).toString())
 for(const p of Object.keys(a.sourceDigests)){
  assert.throws(()=>assistantNotificationsPredecessor((f:string)=>f===p?Buffer.concat([current(f),Buffer.from('UNACCEPTED')]):current(f),historical),p)
  assert.throws(()=>assistantNotificationsPredecessor((f:string)=>{if(f===p)throw Object.assign(Error('Missing'),{code:'ENOENT'});return current(f)},historical),p)
 }
 for(const mutate of [(r:any)=>r.authorisationChanged=true,(r:any)=>r.targetEnvironment='production',(r:any)=>r.previousSourceSha='0'.repeat(40),(r:any)=>r.extra=true,(r:any)=>delete r.sourceDigests[Object.keys(r.sourceDigests)[0]],(r:any)=>r.preservedReceipts={}]){
  const altered=JSON.parse(JSON.stringify(a));mutate(altered);assert.throws(()=>assistantNotificationsPredecessor((p:string)=>p===receipt?Buffer.from(JSON.stringify(altered)):current(p),historical))
 }
})
