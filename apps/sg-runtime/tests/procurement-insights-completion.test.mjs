// SYNTHETIC_ONLY: browser interaction regression, never a Development acceptance result.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),require=createRequire(root+'package.json');
const {buildSync}=require('esbuild'),{JSDOM}=require('jsdom');
const profile={definitionId:'oil-asphalt',profileVersion:'SYNTHETIC_ONLY',label:'Oil & Asphalt',description:'SYNTHETIC_ONLY',availability:'AVAILABLE',subjectMode:'NONE',cadences:['ONCE','WEEKLY'],timeZones:['Europe/Warsaw'],deliveryChannels:['ASSISTANT','EMAIL'],sections:[]};
const empty={items:[],nextCursor:null};
async function browser(name,props,transport){
 const file=name==='ReportsWorkspace'?'reports':'inline-item',dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/pl/dashboard/procurement-insights',runScripts:'outside-only'}),w=dom.window;
 w.MessageChannel=class{port1={onmessage:null};port2={postMessage:()=>setImmediate(()=>this.port1.onmessage?.())}};
 w.AbortController=AbortController;Object.defineProperty(w.crypto,'randomUUID',{value:()=>crypto.randomUUID()});w.fetch=transport??(()=>{throw Error('UNEXPECTED_NETWORK')});
 const result=buildSync({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {${name}} from './components/procurement-insights/${file}';window.fixture={React,createRoot,Component:${name}};`,resolveDir:root,loader:'tsx'},bundle:true,platform:'browser',format:'iife',write:false,define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent'});
 w.eval(result.outputFiles[0].text);w.IS_REACT_ACT_ENVIRONMENT=true;const {React:R,createRoot,Component}=w.fixture,node=w.document.getElementById('root'),reactRoot=createRoot(node);
 const flush=()=>new Promise(r=>setTimeout(r,10));
 await R.act(async()=>{reactRoot.render(R.createElement(Component,props));await flush()});
 return {w,R,node,async click(label){const b=[...node.querySelectorAll('button')].find(x=>x.textContent===label);assert(b,label);await R.act(async()=>{b.click();await flush()})},async input(label,value){const l=[...node.querySelectorAll('label')].find(x=>x.textContent.startsWith(label));assert(l,label);const el=l.querySelector('input,select');assert(el,label);await R.act(async()=>{Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?w.HTMLSelectElement.prototype:w.HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new w.Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));await flush()})},async close(){await R.act(async()=>reactRoot.unmount());dom.window.close()}};
}
test('copying a source link confirms only the actual clipboard result and never calls a provider',async()=>{
 const b=await browser('NewsfeedInlineItem',{locale:'pl',expanded:true,item:{id:'SYNTHETIC_ONLY',kind:'WEB_PAGE',url:'https://example.test/article?a=1',headline:'SYNTHETIC_ONLY',publishedAt:null,excerpt:null}});
 try{let copied;Object.defineProperty(b.w.navigator,'clipboard',{configurable:true,value:{writeText:async s=>{copied=s}}});await b.click('Kopiuj link');assert.equal(copied,'https://example.test/article?a=1');assert.match(b.node.textContent,/Skopiowano link/);Object.defineProperty(b.w.navigator,'clipboard',{value:{writeText:async()=>{throw Error('SYNTHETIC_DENIED')}}});await b.click('Kopiuj link');assert.match(b.node.textContent,/Nie udało się skopiować/);assert.doesNotMatch(b.node.textContent,/Skopiowano link/)}finally{await b.close()}
});
test('library is the default; server filters precede 20-item pagination and shared view has independent scope',async()=>{
 const calls=[],edition={producerJobId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',editionId:'SYNTHETIC_ONLY',title:'SYNTHETIC_PUBLISHED',definitionId:'oil-asphalt',profileVersion:'SYNTHETIC_ONLY',publishedAt:'2026-11-11T08:00:00Z',asOf:'2026-11-11T07:00:00Z',period:{fromDate:'2026-11-03',throughDate:'2026-11-09'},readOnly:false};
 const b=await browser('ReportsWorkspace',{active:true,locale:'pl',getToken:async()=>'SYNTHETIC_ONLY'},async(url,options)=>{
  assert.equal(new Headers(options.headers).get('authorization'),'Bearer SYNTHETIC_ONLY');calls.push(url);
  if(url.endsWith('/workspace'))return Response.json({catalog:[profile],orders:empty,editions:{items:[edition],nextCursor:'SYNTHETIC_CURSOR'}});
  const u=new URL(url,'https://example.test');assert(u.pathname.endsWith('/editions'));return Response.json({items:[edition],nextCursor:u.searchParams.has('cursor')?null:'SYNTHETIC_CURSOR'});
 });
 try{assert.equal(b.node.querySelector('nav button[aria-current=page]').textContent,'Biblioteka raportów');assert(![...b.node.querySelectorAll('nav button')].some(x=>x.textContent==='Archiwum'));assert(b.node.querySelector('details'));await b.input('Wyszukaj raport','SYNTHETIC_QUERY');assert.equal(calls.length,1);await b.input('Opublikowane od','2026-11-01');await b.input('Opublikowane do','2026-11-11');await b.click('Zastosuj filtry');let u=new URL(calls.at(-1),'https://example.test');assert.equal(u.searchParams.get('search'),'SYNTHETIC_QUERY');assert.equal(u.searchParams.get('limit'),'20');assert.equal(u.searchParams.get('fromDate'),'2026-11-01');await b.click('Następna');u=new URL(calls.at(-1),'https://example.test');assert.equal(u.searchParams.get('cursor'),'SYNTHETIC_CURSOR');assert.equal(u.searchParams.get('search'),'SYNTHETIC_QUERY');await b.click('Poprzednia');assert(!new URL(calls.at(-1),'https://example.test').searchParams.has('cursor'));await b.click('Udostępnione mi');assert.equal(new URL(calls.at(-1),'https://example.test').searchParams.get('sharedOnly'),'true');assert.match(b.node.textContent,/Strona 1/)}finally{await b.close()}
});
test('report form persists the admitted schedule and self-recipient preferences without client identity fields',async()=>{
 let command;
 const b=await browser('ReportsWorkspace',{active:true,locale:'pl',getToken:async()=>'SYNTHETIC_ONLY'},async(url,options)=>{
  if(url.endsWith('/workspace'))return Response.json({catalog:[profile],orders:empty,editions:empty});
  if(options.method==='POST'){command=JSON.parse(options.body);return Response.json({...command,id:'SYNTHETIC_ORDER',version:1,status:'ACTIVE',executionState:'READY',nextDueAt:'2026-11-17T07:30:00Z'})}
  if(url.endsWith('/SYNTHETIC_ORDER/runs'))return Response.json(empty);throw Error('UNEXPECTED_NETWORK');
 });
 try{await b.click('+ Zamów raport');await b.input('Nazwa zlecenia','SYNTHETIC_ORDER');await b.input('Dostępny profil','oil-asphalt@SYNTHETIC_ONLY');const cb=label=>[...b.node.querySelectorAll('label')].find(x=>x.textContent.includes(label)).querySelector('input[type=checkbox]');await b.R.act(async()=>cb('Raport cykliczny').click());await b.input('Godzina lokalna','08:30');await b.input('Początek','2026-11-12');assert.equal(b.node.querySelector('input[type=date][disabled]').value,'');await b.R.act(async()=>cb('Bezterminowo').click());await b.input('Data zakończenia','2026-11-24');await b.R.act(async()=>cb('Powiadomienie o opublikowanym').click());await b.click('Zamów raport');assert.equal(command.schedule.frequency,'WEEKLY');assert.equal(command.schedule.timeZone,'Europe/Warsaw');assert.equal(command.schedule.localTime,'08:30');assert.equal(command.schedule.endDate,'2026-11-24');assert.equal(command.notifications.assistant,true);assert.equal(command.notifications.email,false);for(const key of['ownerUserId','organisationId','recipientEmail'])assert(!(key in command));assert.match(b.node.textContent,/Monitoring aktywny/)}finally{await b.close()}
});

test('current completion source and all immutable predecessors must match before historical checks are exposed',async()=>{
 const {readFileSync}=await import('node:fs'),{execFileSync}=await import('node:child_process'),{procurementInsightsCompletionPredecessor,PI_COMPLETION_PATHS,PI_COMPLETION_RECEIPT}=await import('./procurement-insights-completion-integrity.mjs');
 const current=p=>readFileSync(root+'../../'+p),cache=new Map(),historical=(sha,p)=>{const key=sha+':'+p;if(!cache.has(key))cache.set(key,execFileSync('git',['show',key],{cwd:root,stdio:['ignore','pipe','pipe']}));return cache.get(key)};
 const view=procurementInsightsCompletionPredecessor(current,historical);assert(view);
 for(const p of [...PI_COMPLETION_PATHS,...Object.keys(view.manifest.preservedReceipts)])assert.throws(()=>procurementInsightsCompletionPredecessor(f=>f===p?Buffer.concat([current(f),Buffer.from('UNACCEPTED')]):current(f),historical),p);
 for(const flag of ['schemaChanged','authorisationChanged','deploymentPerformed']){const a=JSON.parse(current(PI_COMPLETION_RECEIPT));a[flag]=true;assert.throws(()=>procurementInsightsCompletionPredecessor(p=>p===PI_COMPLETION_RECEIPT?Buffer.from(JSON.stringify(a)):current(p),historical));}
 assert.equal(procurementInsightsCompletionPredecessor(view.previousBytes,historical),null);
});
