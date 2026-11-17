// SYNTHETIC_ONLY browser/HTTP ports. Actual ECR persistence and inbox arrival
// require separate Development readback and cannot be inferred from this test.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createCalendarProxy} from '../lib/market-calendar/runtime'
const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(path.join(app,'package.json'))
const {buildSync}=require('esbuild'),{JSDOM}=require('jsdom')
const initial=(available=true)=>({notificationContract:'profitia.economic-calendar-notifications/1.0.0',version:0,settings:{emailEnabled:false,timeZone:'Europe/Warsaw'},channel:{email:available?'AVAILABLE':'UNAVAILABLE',recipient:'IDENTITY_VERIFIED_PRIMARY_EMAIL',providerAcceptanceIsDelivery:false},delivery:{}})
test('email is explicit, backend-versioned, restored on re-entry and independently disabled without touching watches',async()=>{
 const code=buildSync({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {CalendarEmailSettings} from './components/procurement-insights/calendar-email-settings';window.EmailTest={React,createRoot,CalendarEmailSettings};`,resolveDir:app,loader:'tsx'},bundle:true,platform:'browser',format:'iife',write:false,define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent'}).outputFiles[0].text
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://dev-sg2.spendguru.app',runScripts:'outside-only'}),w=dom.window as any
 w.IS_REACT_ACT_ENVIRONMENT=true;w.AbortController=AbortController;w.AbortSignal=AbortSignal
 w.MessageChannel=class{port1:{onmessage:(()=>void)|null}={onmessage:null};port2={postMessage:()=>setImmediate(()=>this.port1.onmessage?.())}}
 Object.defineProperty(w.Storage.prototype,'setItem',{value:()=>{throw Error('No browser persistence')}})
 w.eval(code);const{React,createRoot,CalendarEmailSettings}=w.EmailTest,{act}=React
 let saved=initial(),conflict=false;const calls:any[]=[]
 const client=async(p:string,o:any={})=>{calls.push([p,o]);assert.equal(p,'notifications');if(o.method==='PUT'){assert.deepEqual(Object.keys(o.body).sort(),['expectedVersion','settings']);assert.equal('recipient'in o.body.settings,false);assert.equal(o.body.expectedVersion,saved.version);if(conflict)throw Error('SYNTHETIC_CONFLICT');saved={...saved,version:saved.version+1,settings:o.body.settings}}return structuredClone(saved)}
 let root=createRoot(w.document.getElementById('root'))
 const mount=async()=>act(async()=>{root.render(React.createElement(CalendarEmailSettings,{client,timeZone:'Europe/Warsaw'}));await new Promise(r=>setTimeout(r,10))})
 const check=()=>w.document.querySelector('input[type=checkbox]'),save=()=>[...w.document.querySelectorAll('button')].find((b:any)=>b.textContent.includes('Zapisz ustawienia e-mail')) as any
 try{
  await mount();assert.equal(check().checked,false);assert.equal(calls.filter(x=>x[1].method==='PUT').length,0)
  await act(async()=>check().click());await act(async()=>{save().click();await new Promise(r=>setTimeout(r,10))});assert.equal(saved.settings.emailEnabled,true);assert.equal(saved.version,1)
  await act(async()=>root.unmount());root=createRoot(w.document.getElementById('root'));await mount();assert.equal(check().checked,true);assert(w.document.body.textContent.includes('są włączone'))
  await act(async()=>check().click());await act(async()=>{save().click();await new Promise(r=>setTimeout(r,10))});assert.equal(saved.settings.emailEnabled,false);assert.equal(saved.version,2)
  await act(async()=>check().click());conflict=true;await act(async()=>{save().click();await new Promise(r=>setTimeout(r,10))});assert.equal(saved.version,2);assert(w.document.querySelector('[role=alert]'));assert(!w.document.body.textContent.includes('Zapisano zgodę e-mail.'))
 }finally{await act(async()=>root.unmount());dom.window.close()}
})
test('consumer relays only GET/PUT notification settings and retains server organisation, session and provider boundaries',async()=>{
 const requests:Request[]=[]
 const proxy=createCalendarProxy({organisationId:'11111111-1111-4111-8111-111111111111',fetcher:async(u,o)=>{requests.push(new Request(u,o));return Response.json({contract:{id:'profitia.economic-calendar',version:'1.1.0'},...initial()},{headers:{'cache-control':'no-store'}})}})
 const url='https://dev-sg2.spendguru.app/api/v1/market-calendar/notifications',headers={authorization:'Bearer SYNTHETIC_ONLY','content-type':'application/json'}
 assert.equal((await proxy(new Request(url,{headers}))).status,200)
 assert.equal((await proxy(new Request(url,{method:'PUT',headers,body:JSON.stringify({expectedVersion:0,settings:{emailEnabled:true,timeZone:'Europe/Warsaw'}})}))).status,200)
 assert(requests.every(r=>r.url.startsWith('https://economic-calendar-runtime-development.onrender.com/v1/organisations/11111111-1111-4111-8111-111111111111/calendar/notifications')))
 assert.equal((await proxy(new Request(url,{method:'POST',headers}))).status,405)
 assert.equal((await proxy(new Request(url+'?organisationId=foreign',{headers}))).status,400)
 assert.equal((await proxy(new Request(url,{headers:{...headers,cookie:'SYNTHETIC_ONLY'}}))).status,401)
 assert.equal(requests.length,2)
})
