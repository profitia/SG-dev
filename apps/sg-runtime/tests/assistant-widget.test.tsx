import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import path from 'node:path'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const require=createRequire(process.env.APPSHELL_TEST_RUNTIME||path.join(root,'package.json'))
const {buildSync}=require('esbuild'),{createElement}=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const build=buildSync({entryPoints:[path.join(root,'components/appshell/assistant-widget.tsx')],bundle:true,platform:'node',format:'cjs',write:false,external:['react','react-dom','react/jsx-runtime']})
const loaded={exports:{} as {AssistantWidget?:unknown}}
new Function('require','module','exports',build.outputFiles[0].text)(require,loaded,loaded.exports)
const render=(avatar:'male'|'female'|null)=>renderToStaticMarkup(createElement(loaded.exports.AssistantWidget,{locale:'pl',avatar,theme:'light',salutation:'Agnieszko'})) as string

test('saved persona has visible image in both expanded panel and collapsed ribbon without name inference',()=>{
 for(const [choice,asset]of [['male','assistant.png'],['female','assistant-female.png']] as const){
  const html=render(choice);assert.equal((html.match(new RegExp('src="/appshell/'+asset+'"','g'))||[]).length,2)
  assert(html.includes('Cześć, Agnieszko!'));assert(!html.includes('nie wybrano awatara'))
 }
})
test('missing saved choice retains a neutral canonical SpendGuru mark instead of an empty frame or invented sex',()=>{
 const html=render(null);assert(html.includes('SpendGuru — nie wybrano awatara'))
 assert(html.includes('viewBox="0 0 287 541"'));assert(!html.includes('src="/appshell/assistant'))
})
test('presentation controls are enabled while conversation controls cannot send or invent history',()=>{
 const html=render('female')
 assert.match(html,/<button[^>]*class="srm-chat-collapse"[^>]*aria-expanded="true"/)
 assert.match(html,/<button[^>]*aria-label="Otwórz asystenta w osobnym oknie"/)
 assert.doesNotMatch(html,/<button[^>]*disabled=""[^>]*aria-label="Otwórz asystenta/)
 assert.match(html,/<button[^>]*disabled=""[^>]*aria-label="Historia rozmowy"/)
 assert.match(html,/<textarea[^>]*disabled=""/);assert.doesNotMatch(html,/<form|iframe|data-delivery|symulacja|Tomasz/)
 assert.doesNotMatch(build.outputFiles[0].text,/fetch\(|XMLHttpRequest|WebSocket|BroadcastChannel|localStorage|sessionStorage/)
})

test('notification trigger has a visible decorative icon and localized accessible name without wrapping text',()=>{
 const result=buildSync({entryPoints:[path.join(root,'components/procurement-insights/notifications.tsx')],bundle:true,platform:'node',format:'cjs',write:false,external:['react','react-dom','react/jsx-runtime']})
 const module={exports:{} as {ProcurementInsightsNotifications?:unknown}}
 new Function('require','module','exports',result.outputFiles[0].text)(require,module,module.exports)
 for(const [locale,label]of [['pl','Powiadomienia'],['en','Notifications']]){
  const html=renderToStaticMarkup(createElement(module.exports.ProcurementInsightsNotifications,{locale,getToken:async()=>{throw Error('No token read during render')},onOpen:()=>{},onOpenReport:()=>{}}))
  const dom=new (require('jsdom').JSDOM)(html),button=dom.window.document.querySelector('button')!
  try{
   assert.equal(button.type,'button');assert.equal(button.disabled,false)
   assert.equal(button.getAttribute('aria-label'),label);assert.equal(button.title,label)
   assert.equal(button.getAttribute('aria-expanded'),'false');assert.equal(button.textContent.trim(),'')
   assert.equal(button.querySelector('svg')?.getAttribute('aria-hidden'),'true')
   assert.equal(button.querySelector('svg')?.getAttribute('focusable'),'false')
   assert(button.querySelector('svg path')?.getAttribute('d'))
  }finally{dom.window.close()}
 }
})

test('SYNTHETIC_ONLY: icon trigger opens and closes the existing list using reads only',async()=>{
 const {JSDOM}=require('jsdom'),dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://example.test',runScripts:'outside-only'})
 ;(dom.window as any).MessageChannel=class{port1:{onmessage:(()=>void)|null}={onmessage:null};port2={postMessage:()=>setImmediate(()=>this.port1.onmessage?.())}}
 const browser=buildSync({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {ProcurementInsightsNotifications} from './components/procurement-insights/notifications';window.notificationTest={React,createRoot,ProcurementInsightsNotifications};`,resolveDir:root,loader:'tsx'},bundle:true,platform:'browser',format:'iife',write:false,define:{'process.env.NODE_ENV':'"development"'}})
 const requests:string[]=[]
 ;(dom.window as any).fetch=async(url:string,options:RequestInit)=>{
  assert.equal(options.method,'GET');assert(url.endsWith('/notifications'))
  requests.push(url);return Response.json({items:[],nextCursor:null})
 }
 dom.window.eval(browser.outputFiles[0].text);(dom.window as any).IS_REACT_ACT_ENVIRONMENT=true
 const {React:R,createRoot,ProcurementInsightsNotifications:Notifications}=(dom.window as any).notificationTest
 const node=dom.window.document.getElementById('root')!,renderRoot=createRoot(node)
 try{
  await R.act(async()=>renderRoot.render(R.createElement(Notifications,{locale:'pl',getToken:async()=>'SYNTHETIC_ONLY',onOpen:()=>assert.fail('No notice selected'),onOpenReport:()=>assert.fail('No report selected')})))
  assert.equal(requests.length,0)
  const button=node.querySelector('button')!;button.focus();assert.equal(dom.window.document.activeElement,button)
  await R.act(async()=>button.click())
  assert.equal(button.getAttribute('aria-expanded'),'true');assert.match(node.textContent??'',/Brak zapisanych powiadomień/)
  assert.deepEqual(requests.sort(),['/api/v1/insights/subscriptions/notifications','/api/v1/newsfeed/notifications'])
  await R.act(async()=>button.click())
  assert.equal(button.getAttribute('aria-expanded'),'false');assert.equal(node.querySelector('ul'),null);assert.equal(requests.length,2)
 }finally{await R.act(async()=>renderRoot.unmount());dom.window.close()}
})
