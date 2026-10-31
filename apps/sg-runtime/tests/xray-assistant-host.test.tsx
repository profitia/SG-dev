import test from 'node:test';
import assert from 'node:assert/strict';
import {loadXRayModule,runtime} from './xray-browser-preview';
test('one host assistant moves into X-Ray and back without remounting or losing its expanded state',async()=>{
 const React=runtime('react'),{JSDOM}=runtime('jsdom'),{createRoot}=runtime('react-dom/client'),{PlatformAppShell}=await loadXRayModule('components/appshell/platform-appshell.tsx');
 const dom=new JSDOM('<div id="root"></div>',{url:'https://dev-sg2.spendguru.app/pl/dashboard'}),g=globalThis as any,previous={window:g.window,document:g.document,HTMLElement:g.HTMLElement,requestAnimationFrame:g.requestAnimationFrame,IS_REACT_ACT_ENVIRONMENT:g.IS_REACT_ACT_ENVIRONMENT};
 Object.assign(g,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,requestAnimationFrame:(cb:()=>void)=>setTimeout(cb,0),IS_REACT_ACT_ENVIRONMENT:true});
 const root=createRoot(document.getElementById('root'));let target:HTMLElement|null=null,active=false;
 const render=()=>React.act(async()=>root.render(React.createElement(PlatformAppShell,{locale:'pl',onLogout(){},moduleActive:active,assistantTarget:target,moduleWorkspace:()=>React.createElement('div',{id:'xray-assistant-target'})})));
 try{
  await render();const original=document.querySelector('.srm-chat-slot');assert(original);assert.equal(document.querySelectorAll('.srm-chat-slot').length,1);assert(original.closest('.as-assistant'));
  await React.act(async()=>{(document.querySelector('[aria-label="Schowaj asystenta"]') as HTMLButtonElement).click()});assert(original.classList.contains('is-collapsed'));
  target=document.getElementById('xray-assistant-target');active=true;await render();assert.equal(document.querySelector('.srm-chat-slot'),original);assert(target!.contains(original));assert(original.classList.contains('is-collapsed'));assert.equal(document.querySelectorAll('.srm-chat-slot').length,1);
  target=null;active=false;await render();assert.equal(document.querySelector('.srm-chat-slot'),original);assert(original.closest('.as-assistant'));assert(original.classList.contains('is-collapsed'));
 }finally{await React.act(async()=>root.unmount());dom.window.close();Object.assign(g,previous)}
});
