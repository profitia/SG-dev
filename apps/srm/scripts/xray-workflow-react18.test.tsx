import type {SupplierXRayWorkflowProps} from '@profitia/srm-xray/workflow';
const acceptProps=(props:SupplierXRayWorkflowProps)=>props;
import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const runtime=createRequire(process.env.XRAY_REACT18_RUNTIME||import.meta.url);
const React=runtime('react'),{JSDOM}=runtime('jsdom'),{createRoot}=runtime('react-dom/client'),{build}=runtime('esbuild');
async function publicModule(entry='@profitia/srm-xray/workflow'){
 const result=await build({entryPoints:[runtime.resolve(entry)],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',external:['react','react-dom','react/jsx-runtime']});
 const module={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(runtime,module,module.exports);return module.exports as any;
}
test('public native workflow really mounts under React18, preserves host locale/theme and never acquires a report on mount or reactivation',async()=>{
 assert.equal(React.version,'18.3.1');const {SupplierXRayWorkflow}=await publicModule();const dom=new JSDOM('<div id="root"></div>',{url:'https://host.invalid/pl/dashboard/xray'}),g=globalThis as any;
 Object.assign(g,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true,requestAnimationFrame:(callback:FrameRequestCallback)=>setTimeout(()=>callback(performance.now()),0),cancelAnimationFrame:clearTimeout,ResizeObserver:class{observe(){}disconnect(){}unobserve(){}}});
 dom.window.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}} as unknown as MediaQueryList);
 let requests=0,returns=0;const root=createRoot(document.getElementById('root')!);
 const draw=async(locale:'pl'|'en'='en',theme:'light'|'dark'='dark',active=true)=>React.act(async()=>root.render(React.createElement(SupplierXRayWorkflow,acceptProps({locale,theme,active,transport:async(input)=>{if(String(input)!=='/api/xray/krs/status')requests++;assert.equal(String(input),'/api/xray/krs/status');return Response.json({enabled:false});},onReturn:()=>{returns++;}}))));
 await draw();assert.equal(document.querySelector('[data-theme]')!.getAttribute('data-theme'),'dark');assert(document.body.textContent!.includes('Wpisz numer NIP'));assert(!document.querySelector('iframe'));assert(!document.querySelector('.srm-chat-slot'));
 await draw('pl','light',false);await draw('pl','light',true);assert.equal(requests,0);assert(document.body.textContent!.includes('Wpisz numer NIP'));
 await React.act(async()=>Array.from(document.querySelectorAll('button')).find(x=>x.textContent==='Wróć do biurka')!.click());assert.equal(returns,1);
 await React.act(async()=>root.unmount());dom.window.close();
});

test('React18 unavailable full-view skeleton retains native inert SSR semantics',async()=>{
 const {ReportAvailabilityView}=await publicModule('@profitia/srm-xray'),{renderToStaticMarkup}=runtime('react-dom/server');
 const html=renderToStaticMarkup(React.createElement(ReportAvailabilityView,{availability:{code:'DEREGISTERED',title:'Unavailable',message:'Reference notice',hideDetails:true}}));
 assert.match(html,/aria-hidden="true" inert=""/);assert(html.includes('Reference notice'));
});

test('React18 journey displays real-contract zero/periods and masked KYS, keeps state without refetch, and clears everything on denial',async(t)=>{
 const {SupplierXRayWorkflow}=await publicModule(),dom=new JSDOM('<div id="root"></div>',{url:'https://host.invalid/pl/dashboard/xray'}),g=globalThis as any;
 Object.assign(g,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true,requestAnimationFrame:(callback:FrameRequestCallback)=>setTimeout(()=>callback(performance.now()),0),cancelAnimationFrame:clearTimeout,ResizeObserver:class{observe(){}disconnect(){}unobserve(){}}});
 dom.window.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}} as unknown as MediaQueryList);
 const {Simulate}=runtime('react-dom/test-utils'),root=createRoot(document.getElementById('root')!);t.after(async()=>{await React.act(async()=>root.unmount());dom.window.close()});const nip='0000000000',at=new Date().toISOString(),until=new Date(Date.now()+600_000).toISOString();
 const empty={status:'NOT_REQUESTED',retrievedAt:null,effectiveAt:null,data:null,warnings:[]},freshness={retrievedAt:at,checkedAt:null,cacheExpiresAt:until,retentionUntil:until,freshness:'FRESH',readSource:'STORED',lastRetrievalMethod:'CACHE'};
 const metadata={schemaVersion:'1.0',nip,entityType:'COMPANY',financial:{status:'SUCCESS',source:'MGBI',freshness,completeness:'COMPLETE',limitations:[],mappingVersion:null,sourceVersion:null,representationVersion:null,periods:[],history:[],scanner:{version:'1.1',methodologyVersion:'4.0.0',qualification:'PARTIAL_SOURCE_VIEW',sourceVersion:null,periods:[]}},kys:{status:'NOT_REQUESTED',source:'VERCLY',freshness,completeness:'UNKNOWN',lastAttemptStatus:null,lastAttemptAt:null,limitations:[],reportAvailable:false}};
 const period=(scope:string,amount:string)=>({from:'2025-01-01',to:'2025-12-31',scope,documentId:'synthetic-'+scope,facts:[{metricCode:'PALA_NRFS',amount,currency:'PLN',unit:'PLN'}]});
 const card={identity:{nip,krs:'0000000000',name:'Synthetic supplier'},general:{...empty,status:'SUCCESS',data:{legalName:'Synthetic supplier',legalForm:null,krs:'0000000000',nip,regon:null,registeredAddress:null,registeredAt:null,mainPkd:null}},financial:{...empty,status:'SUCCESS',data:{periods:[period('standalone','0'),period('consolidated','22')]}},kys:empty};
 let denied=false;const calls:string[]=[],keys:string[]=[];
 const transport:typeof fetch=async(input,init)=>{const operation=String(input).split('/').pop()!;if(operation==='status')return Response.json({enabled:false});if(operation==='web-identity')return Response.json({status:'NOT_FOUND',websiteUrl:null,logoDataUrl:null,logoSourceUrl:null,evidenceUrl:null,method:null,checkedAt:null});calls.push(operation);keys.push(new Headers(init?.headers).get('idempotency-key')!);
 const contract={id:'profitia.srm-xray.workflow',version:'1.0.0'},requestId=crypto.randomUUID();
 if(denied)return Response.json({contract,operation,requestId,error:{code:'XRAY_ACCESS_DENIED'}},{status:403});
 if(operation==='kys')Object.assign(metadata.kys,{status:'PARTIAL',reportAvailable:true,completeness:'PARTIAL'});
 const data=operation==='search'?{entityType:'COMPANY',card}:operation==='report-data'?metadata:{section:{...empty,status:'PARTIAL',retrievedAt:at,data:{company:{name:'Synthetic supplier',nip,krs:'0000000000',regon:null,representation:null,legalForm:null,address:null,country:null,activityStatus:null,registeredAt:null,lastChangedAt:null,mainPkd:null,shareCapital:null},correlationId:null,reportId:null,isComplete:false,queriedRegisters:[],stateAsOf:'2026-10-27'}},privateReport:{snapshotId:'11111111-1111-4111-8111-111111111111',nip,entityType:'COMPANY',retentionUntil:until,exportRef:null}};
 return Response.json({contract,operation:operation==='report-data'?'report':operation,requestId,data});};
 const draw=(active=true)=>React.act(async()=>root.render(React.createElement(React.StrictMode,null,React.createElement(SupplierXRayWorkflow,{locale:'en',theme:'dark',active,transport,onReturn:()=>{}}))));
 await draw();assert.equal(calls.length,0);
 await React.act(async()=>Simulate.change(document.querySelector('input[name=identifier]'),{target:{value:nip}}));
 await React.act(async()=>Simulate.submit(document.querySelector('form')));
 assert.deepEqual(calls,['search','report-data']);assert(document.body.textContent!.includes('Synthetic supplier'));assert(document.querySelector('#report-financial-details')!.textContent!.includes('Rachunek zysków i strat'));assert(!document.querySelector('.xray-embedded-financial'));
 const values=Array.from(document.querySelectorAll('.financial-table td')).map(cell=>cell.textContent??'');assert(values.some(value=>/^0(?:[.,]0+)?$/.test(value)),JSON.stringify(values));
 const scopes=document.querySelectorAll<HTMLButtonElement>('.financial-scope button');await React.act(async()=>scopes[1].click());assert(document.querySelector('#report-financial-details')!.textContent!.includes('skonsolidowane'));assert.equal(calls.length,2);
 await React.act(async()=>Array.from(document.querySelectorAll('button')).find(x=>x.textContent==='Pobierz raport KYS')!.click());
 assert.deepEqual(calls,['search','report-data','kys','report-data']);assert(document.body.textContent!.includes('Raport KYS jest częściowy'));assert(document.querySelector('.srm-kys-tabs'));
 const tab=Array.from(document.querySelectorAll<HTMLButtonElement>('[role=tab]')).find(x=>x.textContent==='Registers, statuses and sanctions')!;await React.act(async()=>tab.click());assert.equal(tab.getAttribute('aria-selected'),'true');
 await draw(false);await draw(true);assert.equal(calls.length,4);assert.equal(new Set(keys).size,4);
 denied=true;await React.act(async()=>Array.from(document.querySelectorAll('button')).find(x=>x.textContent==='Pobierz ponownie')!.click());
 assert(!document.body.textContent!.includes('Synthetic supplier'));assert(!document.querySelector('.financial-table'));assert(document.body.textContent!.includes('Nie masz dostępu'));assert.equal(calls.length,5);
});

import path from 'node:path';
import fs from 'node:fs';
const source=process.env.XRAY_UI_SOURCE||path.resolve(path.dirname(runtime.resolve('@profitia/srm-xray/full-workflow')),'..');
async function moduleFrom(file:string){
 const result=await build({entryPoints:[path.join(source,'src',file)],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',
  nodePaths:[path.dirname(runtime.resolve('react/package.json')),path.resolve('node_modules')],external:['react','react-dom','react-dom/client','react/jsx-runtime']});
 const module={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(runtime,module,module.exports);return module.exports as any;
}
function sg2Environment(){
 const dom=new JSDOM('<div id="root"></div>',{url:'https://host.invalid/pl/dashboard/xray'});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true,requestAnimationFrame:(f:()=>void)=>setTimeout(f,0)});
 return dom;
}
function sg2Gateway(calls:string[]){return {available:async()=>{calls.push('available');return true},search:async()=>{calls.push('name');return {candidates:[],coverage:'PROGRESSIVE'}},verify:async()=>{calls.push('verify');throw Error('not selected')}}}

test('SG2 NIP-only renders one field, validates NIP and never invokes name catalog APIs; standalone retains both modes',async()=>{
 const dom=sg2Environment(),{createRoot}=runtime('react-dom/client'),{SupplierSearch}=await moduleFrom('supplier-search.tsx');
 const root=createRoot(document.getElementById('root')!),calls:string[]=[];let submissions=0;
 const g=sg2Gateway(calls);
 const draw=(searchMode?:string,nip='123')=>React.act(async()=>root.render(React.createElement(SupplierSearch,{nip,onNipChange:()=>{},onNipSearch:()=>submissions++,onNameSearch:()=>assert.fail('name submission'),gateway:g,busy:false,searchMode})));
 try{
  await draw('nip-only');assert.equal(document.querySelectorAll('input').length,1);assert.equal(document.querySelector('.supplier-mode'),null);
  assert.equal(document.querySelector('.srm-entry-intro p')!.textContent,'Wpisz numer NIP.');assert.doesNotMatch(document.body.textContent!,/Nazwa spółki|po nazwie/);
  assert.equal(document.querySelector<HTMLInputElement>('input')!.checkValidity(),false);
  document.querySelector<HTMLFormElement>('form')!.requestSubmit();assert.equal(submissions,0);
  await draw('nip-only','6112830690');assert(document.querySelector<HTMLInputElement>('input')!.checkValidity());
  await React.act(async()=>document.querySelector<HTMLFormElement>('form')!.requestSubmit());assert.equal(submissions,1);assert.deepEqual(calls,[]);
  await draw(undefined);assert.deepEqual(calls,['available']);assert.equal(document.querySelectorAll('.supplier-mode button').length,2);
  const name=Array.from(document.querySelectorAll<HTMLButtonElement>('.supplier-mode button')).find(x=>x.textContent==='Nazwa spółki')!;
  assert(!name.disabled);await React.act(async()=>name.click());assert(document.querySelector('[role="combobox"]'));
 }finally{await React.act(async()=>root.unmount());dom.window.close()}
});

test('NIP-only still honors an existing host admission requirement independently of the name catalog',async()=>{
 const dom=sg2Environment(),{createRoot}=runtime('react-dom/client'),{SupplierSearch}=await moduleFrom('supplier-search.tsx');
 const root=createRoot(document.getElementById('root')!),calls:string[]=[];let searches=0;
 const g={...sg2Gateway(calls),prepare:async()=>{calls.push('prepare');return {readyUntil:new Date(Date.now()+60_000).toISOString()}}};
 try{
  await React.act(async()=>root.render(React.createElement(SupplierSearch,{nip:'6112830690',onNipChange:()=>{},onNipSearch:()=>searches++,onNameSearch:()=>{},gateway:g,busy:false,searchMode:'nip-only',requireAdmission:true})));
  assert(document.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled);
  await React.act(async()=>new Promise(resolve=>setTimeout(resolve,350)));assert.deepEqual(calls,['prepare']);
  assert(!document.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled);
  await React.act(async()=>document.querySelector<HTMLFormElement>('form')!.requestSubmit());assert.equal(searches,1);
 }finally{await React.act(async()=>root.unmount());dom.window.close()}
});

test('SG2 suppresses only C52 internal header, keeps return navigation, and theme updates preserve the form node',async()=>{
 const dom=sg2Environment(),{createRoot}=runtime('react-dom/client'),{FullXRayWorkflow}=await moduleFrom('full-workflow.tsx');
 const root=createRoot(document.getElementById('root')!),calls:string[]=[];let returned=0;const g=sg2Gateway(calls);
 const props={transport:async()=>assert.fail('No report on mount'),searchGateway:g,onReturn:()=>returned++};
 const draw=(theme:string,presentation?:string)=>React.act(async()=>root.render(React.createElement('div',{'data-theme':theme},React.createElement(FullXRayWorkflow,{...props,presentation}))));
 try{
  await draw('light','sg2');const input=document.querySelector('input')!;input.focus();
  assert.equal(document.querySelector('.srm-canon-header'),null);assert.equal(document.querySelectorAll('.srm-host-actions').length,1);assert.deepEqual(calls,[]);
  await draw('dark','sg2');assert.equal(document.querySelector('input'),input);assert.equal(document.activeElement,input);assert.deepEqual(calls,[]);
  await React.act(async()=>Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(x=>x.textContent==='Wróć do biurka')!.click());assert.equal(returned,1);
  await draw('light');assert(document.querySelector('.srm-canon-header'));assert(document.body.textContent!.includes('X-Ray | Supplier Intelligence Dashboard'));
  assert(document.querySelector('.supplier-mode'));assert.equal(document.querySelector('[data-presentation="sg2"]'),null);assert.deepEqual(calls,['available']);
 }finally{await React.act(async()=>root.unmount());dom.window.close()}
});

test('the source theme is gated to SG2, has no color filters and the generated bundle contains it',()=>{
 const css=fs.readFileSync(path.join(source,'src/sg2-host-theme.css'),'utf8');assert.doesNotMatch(css,/(?:filter:|invert\()/);
 assert.match(css,/:scope\[data-presentation="sg2"\]/);assert.match(css,/--surface:inherit/);assert.match(css,/color-scheme:inherit/);
 assert(fs.readFileSync(path.join(source,'src/full-report.css'),'utf8').includes(css));
});
