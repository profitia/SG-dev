import test from 'node:test';
import assert from 'node:assert/strict';
import {loadXRayModule,runtime} from './xray-browser-preview';

test('AppShell owns the single header and live theme; SG2 NIP input and mounted report survive theme changes without catalog calls',async()=>{
 const React=runtime('react'),{JSDOM}=runtime('jsdom'),{createRoot}=runtime('react-dom/client'),{Simulate}=runtime('react-dom/test-utils');
 const {AppShellDashboard}=await loadXRayModule('components/appshell/appshell-dashboard.tsx');
 const dom=new JSDOM('<div id="root"></div>',{url:'https://host.invalid/pl/dashboard/xray'}),g=globalThis as any;
 const prior={window:g.window,document:g.document,HTMLElement:g.HTMLElement,requestAnimationFrame:g.requestAnimationFrame,fetch:g.fetch,localStorage:g.localStorage};
 Object.assign(g,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,localStorage:dom.window.localStorage,requestAnimationFrame:(f:()=>void)=>setTimeout(f,0),IS_REACT_ACT_ENVIRONMENT:true});
 dom.window.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}} as any);
 g.__xrayNav={path:'/pl/dashboard/xray',push:(p:string)=>{g.__xrayNav.path=p}};
 g.__xrayAuth={isLoaded:true,isSignedIn:true,userId:'user-a',sessionId:'session-a',orgId:'org-a',getToken:async()=>'synthetic-user-proof'};
 const calls:string[]=[],nip='6112830690',now=new Date().toISOString(),until=new Date(Date.now()+60_000).toISOString();
 const empty={status:'NOT_REQUESTED',retrievedAt:null,effectiveAt:null,data:null,warnings:[]};
 const freshness={retrievedAt:now,checkedAt:null,cacheExpiresAt:until,retentionUntil:until,freshness:'FRESH',readSource:'STORED',lastRetrievalMethod:'CACHE'};
 const card={identity:{nip,krs:'0000000001',name:'Synthetic supplier'},general:{...empty,status:'SUCCESS',data:{legalName:'Synthetic supplier',legalForm:null,krs:'0000000001',nip,regon:null,registeredAddress:null,registeredAt:null,mainPkd:null}},financial:empty,kys:empty};
 const metadata={schemaVersion:'1.0',nip,entityType:'COMPANY',financial:{status:'NOT_REQUESTED',source:'MGBI',freshness,completeness:'UNKNOWN',limitations:[],mappingVersion:null,sourceVersion:null,representationVersion:null,periods:[],history:[],scanner:null},kys:{status:'NOT_REQUESTED',source:'VERCLY',freshness,completeness:'UNKNOWN',lastAttemptStatus:null,lastAttemptAt:null,limitations:[],reportAvailable:false}};
 g.fetch=async(input:any)=>{
  const url=String(input),operation=url.split('/').pop()!;calls.push(url);
  if(url.includes('/krs/')||operation==='registryStatus'||operation==='registrySearch'||operation==='registryVerify')assert.fail('SG2 must not invoke a name-catalog operation');
  if(operation==='webIdentity')return Response.json({status:'NOT_FOUND',websiteUrl:null,logoDataUrl:null,logoSourceUrl:null,evidenceUrl:null,method:null,checkedAt:null});
  const data=operation==='search'?{entityType:'COMPANY',card}:metadata;
  return Response.json({contract:{id:'profitia.srm-xray.workflow',version:'1.0.0'},operation:operation==='report-data'?'report':operation,requestId:'11111111-1111-4111-8111-111111111111',data});
 };
 const root=createRoot(document.getElementById('root')!);
 const render=()=>React.act(async()=>root.render(React.createElement(AppShellDashboard,{locale:'pl',onLogout:()=>{}})));
 try{
  await render();assert.equal(document.querySelectorAll('header.as-header').length,1);assert.equal(document.querySelector('.srm-canon-header'),null);
  assert.equal(document.querySelectorAll('.srm-krs-entry input').length,1);assert.equal(document.querySelector('.supplier-mode'),null);assert.deepEqual(calls,[]);
  const input=document.querySelector<HTMLInputElement>('input[name="identifier"]')!;
  await React.act(async()=>Simulate.change(input,{target:{value:nip}}));assert.equal(input.value,nip);
  await React.act(async()=>document.querySelector<HTMLButtonElement>('[title="Ciemny motyw"]')!.click());
  assert.equal(document.querySelector('input[name="identifier"]'),input);assert.equal(input.value,nip);assert.equal(document.querySelector('.appshell')!.getAttribute('data-theme'),'dark');assert.deepEqual(calls,[]);
  await React.act(async()=>Simulate.submit(document.querySelector('.supplier-form')));
  assert(document.body.textContent!.includes('Synthetic supplier'));assert(calls.some(x=>x.endsWith('/search')));assert(calls.some(x=>x.endsWith('/report')));
  const report=document.querySelector('.report-page')!,afterSearch=[...calls];
  await React.act(async()=>document.querySelector<HTMLButtonElement>('[title="Jasny motyw"]')!.click());
  assert.equal(document.querySelector('.report-page'),report);assert(document.body.textContent!.includes('Synthetic supplier'));assert.deepEqual(calls,afterSearch);
  assert.equal(document.querySelector('.srm-canon-header'),null);assert.equal(document.querySelectorAll('header.as-header').length,1);
  await React.act(async()=>Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(x=>x.textContent==='Wróć do biurka')!.click());await render();assert.equal(g.__xrayNav.path,'/pl/dashboard');
 }finally{await React.act(async()=>root.unmount());dom.window.close();Object.assign(g,prior)}
});
