import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(path.join(app,'package.json'))
const {buildSync}=require('esbuild'),{JSDOM}=require('jsdom')
const navigation=`import {useSyncExternalStore} from 'react';const listeners=new Set();const emit=()=>listeners.forEach(f=>f());for(const method of ['pushState','replaceState']){const original=window.history[method].bind(window.history);window.history[method]=(...args)=>{original(...args);emit()}}window.addEventListener('popstate',emit);const router={push(url){window.calendarServerNavigations=(window.calendarServerNavigations??0)+1;window.history.pushState({},'',url)},replace(url){window.calendarServerNavigations=(window.calendarServerNavigations??0)+1;window.history.replaceState({},'',url)},back(){window.history.back()},forward(){window.history.forward()}};const sub=f=>{listeners.add(f);return()=>listeners.delete(f)};export const useRouter=()=>router;export const usePathname=()=>window.location.pathname;export function useSearchParams(){return new URLSearchParams(useSyncExternalStore(sub,()=>window.location.search,()=>window.location.search))}`
// Explicit synthetic browser test. Product files contain neither fixture data
// nor this router. Durable PostgreSQL/E1 behavior has a separate producer test.

test('approved calendar flow uses ECR requests for favourites, named calendars and opt-in settings; restoration and conflicts are real client behaviors',async()=>{
 // Build-time module replacement stays in memory through esbuild stdin imports.
 // esbuild's synchronous API has no plugin support, so navigation is supplied
 // as a data URL resolved by an isolated temporary test directory below.
 const fs=require('node:fs'),os=require('node:os'),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'pi-calendar-ui-'))
 const shim=path.join(tmp,'navigation.js');fs.writeFileSync(shim,navigation)
 const code=buildSync({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {MarketCalendar} from './components/procurement-insights/market-calendar';window.CalendarTest={React,createRoot,MarketCalendar};`,resolveDir:app,loader:'tsx'},bundle:true,platform:'browser',format:'iife',write:false,loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"development"'},alias:{'next/navigation':shim},nodePaths:[path.join(app,'node_modules')],logLevel:'silent'}).outputFiles[0].text
 const dom=new JSDOM('<!doctype html><div class="appshell"><div id="root"></div></div>',{url:'https://dev-sg2.spendguru.app/pl/dashboard/procurement-insights?tab=calendar',runScripts:'outside-only'})
 const w=dom.window as any;w.IS_REACT_ACT_ENVIRONMENT=true;w.MessageChannel=class{port1:{onmessage:(()=>void)|null}={onmessage:null};port2={postMessage:()=>setImmediate(()=>this.port1.onmessage?.())}}
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false}
 w.AbortController=AbortController;w.AbortSignal=AbortSignal;w.Response=Response
 Object.defineProperty(w.Storage.prototype,'setItem',{value:()=>{throw Error('Browser storage is not persistence')}})
 const date=new Date().toISOString().slice(0,10),tomorrow=new Date(Date.parse(date+'T12:00:00Z')+86400000).toISOString().slice(0,10),pub='ecr_pub_'+'a'.repeat(64),pub2='ecr_pub_'+'c'.repeat(64),id='ecr_evt_'+'b'.repeat(64)
 const event={eventId:id,publicationId:pub,title:'SYNTHETIC_ONLY WPSR',eventAt:tomorrow+'T15:30:00Z',eventTimeZone:'UTC',dateSpan:0,source:{provider:'eia',licenceRef:'SYNTHETIC_ONLY'},values:{actual:null},reference:{label:null,providerValue:null},knownAt:date+'T10:00:00Z',observation:{sourceRetrievedAt:date+'T10:00:00Z'},schedule:{scheduleStatus:'OFFICIAL_DATED',timePrecision:'INSTANT'}}
 const concept={data:{namePl:'SYNTHETIC_ONLY Raport ropy',description:'SYNTHETIC_ONLY opis',taxonomy:['ropa'],geography:'USA'}}
 let state={version:0,preferences:{watchedCountries:['PRESERVE'],watchedIndicators:[],watchedTopics:[],savedFilters:[],display:{timeZone:'UTC'},publicationFavourites:[],publicationWatches:[]}} as any,conflict=false,denied=false
 const calls:Array<{path:string;method:string;body:any}>=[]
 w.fetch=async(input:string,options:any={})=>{const u=new URL(input,w.location.origin),p=u.pathname.split('/api/v1/market-calendar/')[1],method=options.method??'GET';calls.push({path:p,method,body:options.body?JSON.parse(options.body):null});assert(p,'Only the consumer ECR route is allowed');assert.equal(options.headers.authorization,'Bearer SYNTHETIC_ONLY')
  if(p==='query'&&denied)return Response.json({error:{code:'ACCESS_DENIED'}},{status:403})
  if(p==='preferences'){
   if(method==='PUT'){if(conflict){conflict=false;state.version++;state.preferences.watchedCountries=['CONCURRENT'];return Response.json({error:{code:'PREFERENCE_VERSION_CONFLICT'}},{status:409})}const b=JSON.parse(options.body);assert.equal(b.expectedVersion,state.version);state={...state,version:state.version+1,preferences:b.preferences}}
   return Response.json({contract:{id:'profitia.economic-calendar',version:'1.1.0'},...state})
  }
  if(p==='query')return Response.json({contract:{id:'profitia.economic-calendar',version:'1.1.0'},projection:'CALENDAR_QUERY',queryContract:{id:'profitia.calendar-query',version:'1.0.0'},events:{items:[event],nextAfter:null},publications:{items:[{publicationId:pub,title:event.title,source:event.source,unresolvedNextSchedule:null},{publicationId:pub2,title:'SYNTHETIC_ONLY niezidentyfikowane wydanie',source:{provider:'commodities-sh'},unresolvedNextSchedule:{dateOnly:tomorrow,scheduledAt:null,timePrecision:'DATE'},sourceUrl:null}],nextAfter:null},context:{items:[{eventId:id,event,concept,results:[],relevance:[]}],nextAfter:null,definitions:[],unresolvedSchedules:[],coverage:{completeness:'UNKNOWN'}}})
  const body=p==='events'?{items:[event],nextAfter:null}:p==='publications'?{items:[{publicationId:pub,title:event.title,source:event.source,unresolvedNextSchedule:null},{publicationId:pub2,title:'SYNTHETIC_ONLY niezidentyfikowane wydanie',source:{provider:'commodities-sh'},unresolvedNextSchedule:{dateOnly:tomorrow,scheduledAt:null,timePrecision:'DATE'},sourceUrl:null}],nextAfter:null}:p==='context'?{items:[{eventId:id,event,concept,results:[],relevance:[]}],nextAfter:null,definitions:[],unresolvedSchedules:[],coverage:{completeness:'UNKNOWN'}}:p.startsWith('evidence/')?{results:[],items:[],nextAfter:null}:{items:[],nextAfter:null}
  return Response.json({contract:{id:'profitia.economic-calendar',version:'1.1.0'},...body})
 }
 w.eval(code);const {React,createRoot,MarketCalendar}=w.CalendarTest,node=w.document.getElementById('root'),root=createRoot(node),token=async()=>'SYNTHETIC_ONLY'
 const tick=()=>new Promise(r=>setImmediate(r)),settle=async()=>{await React.act(async()=>{await tick();await tick()})}
 const click=async(label:string,scope:Element=node)=>{const buttons=[...scope.querySelectorAll('button')] as HTMLButtonElement[],button=buttons.find(b=>b.textContent?.trim()===label||b.getAttribute('aria-label')===label);assert(button,'button '+label);await React.act(async()=>button.click());await settle()}
 const fill=async(label:string,value:string)=>{const input=[...node.querySelectorAll('label')].find((l:any)=>l.textContent.includes(label))?.querySelector('input');assert(input,label);await React.act(async()=>{Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new w.Event('input',{bubbles:true}))});await settle()}
 try{
  await React.act(async()=>root.render(React.createElement(React.StrictMode,null,React.createElement(MarketCalendar,{active:true,getToken:token}))));await settle()
  assert.match(node.textContent,/SYNTHETIC_ONLY Raport ropy/);assert.match(node.textContent,/niezidentyfikowane wydanie/);assert(calls.length>=2&&calls.length<=4)
  const beforeSelectionRequests=calls.length,search=node.querySelector('input[placeholder="Nazwa, surowiec, seria…"]');assert(search)
  await React.act(async()=>{for(const value of ['r','ro','rop','ropa']){Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value')!.set!.call(search,value);search.dispatchEvent(new w.Event('input',{bubbles:true}))}});await settle()
  assert.equal(new URLSearchParams(w.location.search).get('calSearch'),'ropa');assert.equal(search.value,'ropa');assert.equal(calls.length,beforeSelectionRequests,'local selection must not reacquire data or identity');assert.equal(w.calendarServerNavigations??0,0,'search must not navigate the server AppShell')
  await click('Wyczyść filtry');assert.equal(new URLSearchParams(w.location.search).has('calSearch'),false);assert.equal(calls.length,beforeSelectionRequests)
  const eventCard=()=>[...node.querySelectorAll('article')].find((a:any)=>a.textContent.includes('SYNTHETIC_ONLY Raport ropy'));
  await click('Dodaj do ulubionych',eventCard());assert.deepEqual(state.preferences.publicationFavourites,[pub]);assert.deepEqual(state.preferences.publicationWatches,[]);assert.deepEqual(state.preferences.watchedCountries,['PRESERVE'])
  await click('Zapisz kalendarz');await fill('Nazwa kalendarza','Mój rynek paliw');await click('Zapisz kalendarz',node.querySelector('dialog'))
  assert.equal(state.preferences.savedFilters[0].name,'Mój rynek paliw');assert.equal(state.preferences.savedFilters[0].calendar.period,'next');assert.equal('from' in state.preferences.savedFilters[0].filter,false)
  await click('Moje kalendarze');await click('Zmień nazwę');await fill('Nowa nazwa','Rynek energii');await click('Zapisz zmianę');assert.equal(state.preferences.savedFilters[0].name,'Rynek energii')
  await click('Otwórz');await click('Obserwuj',eventCard());assert.match(node.querySelector('dialog').textContent,/nie jest jeszcze aktywne/);await click('Zapisz preferencje');assert.equal(state.preferences.publicationWatches[0].publicationId,pub)
  await click('Obserwujesz',eventCard());await click('Wyłącz obserwowanie');assert.deepEqual(state.preferences.publicationWatches,[])
  await click('Miesiąc');assert.match(w.location.search,/calView=month/);assert(node.querySelector('.pi-cal-month'));await click('Tydzień');assert(node.querySelector('.week-layout'));await click('Lista')
  assert.equal(w.calendarServerNavigations??0,0,'views and selections reuse the existing authenticated operation context')
  await click('Szczegóły',eventCard());await click('Odczyty');assert.match(node.querySelector('dialog').textContent,/Jeszcze bez potwierdzonego odczytu/);await click('Zamknij')
  conflict=true;await click('Usuń z ulubionych',eventCard());assert.match(node.textContent,/innej sesji/);assert.deepEqual(state.preferences.publicationFavourites,[pub]);await click('Usuń z ulubionych',eventCard());assert.deepEqual(state.preferences.publicationFavourites,[]);assert.deepEqual(state.preferences.watchedCountries,['CONCURRENT'])
  await React.act(async()=>root.render(React.createElement(MarketCalendar,{key:'new-session',active:true,getToken:token})));await settle();assert.match(node.textContent,/Rynek energii/)
  await click('Moje kalendarze');await click('Usuń');await click('Usuń kalendarz');assert.deepEqual(state.preferences.savedFilters,[])
  denied=true;await React.act(async()=>root.render(React.createElement(MarketCalendar,{key:'denied-session',active:true,getToken:token})));await settle();assert.match(node.textContent,/Brak uprawnienia/);assert.equal(node.querySelector('.pi-cal-event'),null);assert.deepEqual([...node.querySelectorAll('.pi-cal-summary strong')].slice(0,2).map((x:any)=>x.textContent),['—','—'])
  assert(calls.every(c=>!c.path.includes('source')&&!c.path.includes('sync')));assert(calls.filter(c=>c.method==='PUT').every(c=>!('userId'in c.body)&&!('organisationId'in c.body)))
 }finally{await React.act(async()=>root.unmount());dom.window.close();fs.rmSync(tmp,{recursive:true})}
})
