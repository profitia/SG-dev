import test from 'node:test';
import assert from 'node:assert/strict';
import {loadXRayModule,runtime} from './xray-browser-preview';

const React=runtime('react'),{JSDOM}=runtime('jsdom'),{createRoot}=runtime('react-dom/client');
const fixtureContext=(name='Existing supplier',year:number|null=2024)=>({schemaVersion:1,application:'SRM',supplier:{name,nip:'not-for-the-assistant'},view:{page:'supplier-intelligence-dashboard',radar:{year}},financialSummary:[{privateAmount:123}],credentials:'never-project-this'});
async function environment(run:(dom:any,root:any)=>Promise<void>){
 const dom=new JSDOM('<div id="root"></div>',{url:'https://dev-sg2.spendguru.app/pl/dashboard'}),g=globalThis as any;
 const previous=Object.fromEntries(['window','document','HTMLElement','localStorage','requestAnimationFrame','IS_REACT_ACT_ENVIRONMENT'].map(k=>[k,g[k]]));
 Object.assign(g,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,localStorage:dom.window.localStorage,requestAnimationFrame:(cb:()=>void)=>setTimeout(cb,0),IS_REACT_ACT_ENVIRONMENT:true});
 const root=createRoot(document.getElementById('root'));
 try{await run(dom,root)}finally{await React.act(async()=>root.unmount());dom.window.close();Object.assign(g,previous)}
}
async function click(label:string,doc:Document=document){await React.act(async()=>{const button=doc.querySelector(`[aria-label="${label}"]`)??Array.from(doc.querySelectorAll('button')).find(b=>b.textContent===label);assert(button,label);(button as HTMLButtonElement).click();await new Promise(r=>setTimeout(r,5))})}

test('desk and every module retain one widget, the same panel and presentation state in the AppShell slot',async()=>{
 const {PlatformAppShell}=await loadXRayModule('components/appshell/platform-appshell.tsx');
 await environment(async(_dom,root)=>{
  let module:string|null=null;
  const render=()=>React.act(async()=>root.render(React.createElement(PlatformAppShell,{locale:'pl',salutation:'Agnieszko',onLogout(){},moduleActive:!!module,moduleWorkspace:()=>React.createElement('div',{'data-module':module})})));
  await render();
  const slot=document.querySelector('.srm-chat-slot'),panel=document.querySelector('.srm-chat-motion'),input=document.querySelector('textarea') as HTMLTextAreaElement;
  assert(slot&&panel&&input);input.value='Presentation state';
  await click('Schowaj asystenta');await click('Ciemny');
  for(module of ['benchmark_finder','xray','adp',null,'xray',null]){
   await render();assert.equal(document.querySelector('.srm-chat-slot'),slot);assert.equal(document.querySelector('.srm-chat-motion'),panel);assert.equal(document.querySelector('textarea'),input);
   assert.equal(input.value,'Presentation state');assert(slot.classList.contains('is-collapsed'));assert(slot.closest('.as-assistant'));assert(!slot.closest('[data-module]'));
   assert.equal(document.querySelectorAll('.srm-chat-slot').length,1);assert.equal(slot.closest('.srm-ui'),null,'module styles cannot own the shared skin');assert.equal(document.querySelector('.appshell')?.getAttribute('data-theme'),'dark');
  }
  await click('Pokaż asystenta');assert.equal(document.activeElement,document.querySelector('.srm-chat-collapse'));assert(!slot.classList.contains('is-collapsed'));
 });
});

test('content is a bounded projection and unknown contracts remain neutral',async()=>{
 const {projectXrayAssistantContext}=await loadXRayModule('components/appshell/assistant-screen-context.ts');
 assert.deepEqual(projectXrayAssistantContext(fixtureContext()),{supplierName:'Existing supplier',year:2024});
 for(const value of [null,{}, {...fixtureContext(),schemaVersion:2},{...fixtureContext(),application:'other'},fixtureContext('',2024),fixtureContext('Valid',Infinity),fixtureContext('x'.repeat(301))])assert.equal(projectXrayAssistantContext(value),null);
 const {createAssistantContent}=await loadXRayModule('components/appshell/assistant-content.tsx');
 for(const locale of ['pl','en']){
  const neutral=createAssistantContent(locale,'Agnieszko',null);assert.equal(neutral.contextLabel,null);assert(!JSON.stringify(neutral).includes('Existing supplier'));
  const current=createAssistantContent(locale,null,projectXrayAssistantContext(fixtureContext()));assert.equal(current.contextLabel,'X-Ray · Existing supplier · 2024');
  assert(!JSON.stringify(current).includes('privateAmount'));assert(!JSON.stringify(current).includes('credentials'));
 }
});

test('leaving X-Ray immediately invalidates its context and late callbacks stay revoked after re-entry',async()=>{
 const {useAssistantScreenContext}=await loadXRayModule('components/appshell/assistant-screen-context.ts');
 await environment(async(_dom,root)=>{
  let current:any;
  function Harness({module}:{module:string}){current=useAssistantScreenContext(module);return React.createElement('output',null,current.context?.supplierName??'neutral')}
  const render=(module:string)=>React.act(async()=>root.render(React.createElement(Harness,{module})));
  await render('xray');const first=current.onXrayContext;
  await React.act(async()=>first(fixtureContext('First visit')));assert.equal(document.querySelector('output')?.textContent,'First visit');
  await render('adp');assert.equal(document.querySelector('output')?.textContent,'neutral');
  await React.act(async()=>first(fixtureContext('Late result')));assert.equal(document.querySelector('output')?.textContent,'neutral');
  await render('xray');assert.equal(document.querySelector('output')?.textContent,'neutral');
  await React.act(async()=>first(fixtureContext('Stale prior visit')));assert.equal(document.querySelector('output')?.textContent,'neutral');
  await React.act(async()=>current.onXrayContext(fixtureContext('Current visit')));assert.equal(document.querySelector('output')?.textContent,'Current visit');
  await React.act(async()=>current.onXrayContext(null));assert.equal(document.querySelector('output')?.textContent,'neutral');
  await render('benchmark_finder');await React.act(async()=>current.onXrayContext(fixtureContext('Not this module')));assert.equal(document.querySelector('output')?.textContent,'neutral');
 });
});

test('detached widget survives module navigation and theme/content changes without leaking report context to its window',async()=>{
 const {PlatformAppShell}=await loadXRayModule('components/appshell/platform-appshell.tsx');
 await environment(async(dom,root)=>{
  const child=new JSDOM('<html><head></head><body></body></html>',{url:'about:blank'});child.window.focus=()=>{};
  let closes=0;const close=child.window.close.bind(child.window);child.window.close=()=>{closes++;close()};
  dom.window.open=()=>child.window;
  let active=false;
  const render=()=>React.act(async()=>root.render(React.createElement(PlatformAppShell,{locale:'pl',assistantAvatar:'female',onLogout(){},moduleActive:active,assistantContext:{supplierName:'Private report label',year:2024},moduleWorkspace:()=>React.createElement('div',{'data-module':'xray'})})));
  try{
   await render();const id=document.querySelector('textarea')?.id;
   assert(document.querySelector('.srm-chat-screen-context')?.textContent?.includes('Private report label'));
   await click('Otwórz asystenta w osobnym oknie');assert.equal(document.querySelectorAll('.srm-chat-motion').length,0);assert.equal(child.window.document.querySelectorAll('.srm-chat-motion').length,1);
   assert.equal(child.window.document.querySelector('textarea')?.id,id);assert.equal(child.window.document.querySelector('.srm-ui'),null);assert.equal(child.window.opener,null);
   assert(!child.window.document.body.textContent?.includes('Private report label'));assert(!child.window.location.href.includes('Private'));
   const childPanel=child.window.document.querySelector('.srm-chat-motion');
   for(active of [true,false,true]){await render();assert.equal(child.window.document.querySelector('.srm-chat-motion'),childPanel);assert.equal(closes,0)}
   await click('Ciemny');assert.equal(child.window.document.querySelector('.appshell')?.getAttribute('data-theme'),'dark');
   await click('Przyłącz asystenta do biurka',child.window.document);assert.equal(closes,1);assert.equal(document.querySelectorAll('.srm-chat-motion').length,1);assert.equal(document.querySelector('textarea')?.id,id);assert(document.querySelector('.srm-chat-slot')?.closest('.as-assistant'));
  }finally{if(!closes)close()}
 });
});

test('a blocked popup leaves the one AppShell widget usable and cleanup removes window listeners',async()=>{
 const {PlatformAppShell}=await loadXRayModule('components/appshell/platform-appshell.tsx');
 await environment(async(dom,root)=>{
  dom.window.open=()=>null;
  const live=new Map<string,Set<unknown>>(),add=dom.window.addEventListener.bind(dom.window),remove=dom.window.removeEventListener.bind(dom.window);
  dom.window.addEventListener=(type:string,listener:unknown,...rest:unknown[])=>{if(!live.has(type))live.set(type,new Set());live.get(type)!.add(listener);return add(type,listener,...rest)};
  dom.window.removeEventListener=(type:string,listener:unknown,...rest:unknown[])=>{live.get(type)?.delete(listener);return remove(type,listener,...rest)};
  const render=(active:boolean)=>React.act(async()=>root.render(React.createElement(PlatformAppShell,{locale:'pl',onLogout(){},moduleActive:active})));
  await render(false);const panel=document.querySelector('.srm-chat-motion');
  for(const active of [true,false,true,false])await render(active);
  assert.equal(live.get('pagehide')?.size,1);assert.equal(live.get('resize')?.size,1);
  await click('Otwórz asystenta w osobnym oknie');assert.equal(document.querySelector('.srm-chat-motion'),panel);assert(document.querySelector('[role="alert"]'));
  await click('Schowaj asystenta');await click('Pokaż asystenta');assert.equal(document.querySelector('.srm-chat-motion'),panel);
  await React.act(async()=>root.render(null));assert.equal(live.get('pagehide')?.size,0);assert.equal(live.get('resize')?.size,0);
 });
});
