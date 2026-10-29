import type {SupplierXRayWorkflowProps} from '@profitia/srm-xray/workflow';
const acceptProps=(props:SupplierXRayWorkflowProps)=>props;
import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const runtime=createRequire(process.env.XRAY_REACT18_RUNTIME||import.meta.url);
const React=runtime('react'),{JSDOM}=runtime('jsdom'),{createRoot}=runtime('react-dom/client'),{build}=runtime('esbuild');
async function publicModule(){
 const result=await build({entryPoints:[runtime.resolve('@profitia/srm-xray/workflow')],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',external:['react','react-dom','react/jsx-runtime']});
 const module={exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(runtime,module,module.exports);return module.exports as any;
}
test('public native workflow really mounts under React18, preserves host locale/theme and never fetches on mount or reactivation',async()=>{
 assert.equal(React.version,'18.3.1');const {SupplierXRayWorkflow}=await publicModule();const dom=new JSDOM('<div id="root"></div>',{url:'https://host.invalid/pl/dashboard/xray'}),g=globalThis as any;
 Object.assign(g,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
 let requests=0,returns=0;const root=createRoot(document.getElementById('root')!);
 const draw=async(locale:'pl'|'en'='en',theme:'light'|'dark'='dark',active=true)=>React.act(async()=>root.render(React.createElement(SupplierXRayWorkflow,acceptProps({locale,theme,active,transport:async()=>{requests++;throw Error('unexpected');},onReturn:()=>{returns++;}}))));
 await draw();assert.equal(document.querySelector('.srm-xray-workflow')!.getAttribute('data-theme'),'dark');assert(document.body.textContent!.includes('Enter a NIP'));assert(!document.querySelector('iframe'));assert(!document.querySelector('.srm-chat-slot'));
 await draw('pl','light',false);await draw('pl','light',true);assert.equal(requests,0);assert(document.body.textContent!.includes('Wpisz numer NIP'));
 await React.act(async()=>Array.from(document.querySelectorAll('button')).find(x=>x.textContent==='Wróć do biurka')!.click());assert.equal(returns,1);
 await React.act(async()=>root.unmount());dom.window.close();
});

test('React18 journey displays real-contract zero/periods and masked KYS, keeps state without refetch, and clears everything on denial',async()=>{
 const {SupplierXRayWorkflow}=await publicModule(),dom=new JSDOM('<div id="root"></div>',{url:'https://host.invalid/pl/dashboard/xray'}),g=globalThis as any;
 Object.assign(g,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
 const {Simulate}=runtime('react-dom/test-utils'),root=createRoot(document.getElementById('root')!),nip='0000000000',at=new Date().toISOString(),until=new Date(Date.now()+600_000).toISOString();
 const empty={status:'NOT_REQUESTED',retrievedAt:null,effectiveAt:null,data:null,warnings:[]},freshness={retrievedAt:at,checkedAt:null,cacheExpiresAt:until,retentionUntil:until,freshness:'FRESH',readSource:'STORED',lastRetrievalMethod:'CACHE'};
 const metadata={schemaVersion:'1.0',nip,entityType:'COMPANY',financial:{status:'SUCCESS',source:'MGBI',freshness,completeness:'COMPLETE',limitations:[],mappingVersion:null,sourceVersion:null,representationVersion:null,periods:[],history:[]},kys:{status:'NOT_REQUESTED',source:'VERCLY',freshness,completeness:'UNKNOWN',lastAttemptStatus:null,lastAttemptAt:null,limitations:[],reportAvailable:false}};
 const period=(scope:string,amount:string)=>({from:'2025-01-01',to:'2025-12-31',scope,documentId:'synthetic-'+scope,facts:[{metricCode:'PALA_NRFS',amount,currency:'PLN',unit:'PLN'}]});
 const card={identity:{nip,krs:'0000000000',name:'Synthetic supplier'},general:{...empty,status:'SUCCESS',data:{legalName:'Synthetic supplier',legalForm:null,krs:'0000000000',nip,regon:null,registeredAddress:null,registeredAt:null,mainPkd:null}},financial:{...empty,status:'SUCCESS',data:{periods:[period('standalone','0'),period('consolidated','22')]}},kys:empty};
 let denied=false;const calls:string[]=[],keys:string[]=[];
 const transport:typeof fetch=async(input,init)=>{const operation=String(input).split('/').pop()!;calls.push(operation);keys.push(new Headers(init?.headers).get('idempotency-key')!);
 const contract={id:'profitia.srm-xray.workflow',version:'1.0.0'},requestId=crypto.randomUUID();
 if(denied)return Response.json({contract,operation,requestId,error:{code:'XRAY_ACCESS_DENIED'}},{status:403});
 const data=operation==='search'?{entityType:'COMPANY',card}:operation==='report-data'?metadata:{section:{...empty,status:'PARTIAL',retrievedAt:at,data:{correlationId:null,reportId:null,isComplete:false,queriedRegisters:[],stateAsOf:'2026-10-27'}},privateReport:{snapshotId:'11111111-1111-4111-8111-111111111111',nip,entityType:'COMPANY',retentionUntil:until,exportRef:null}};
 return Response.json({contract,operation:operation==='report-data'?'report':operation,requestId,data});};
 const draw=(active=true)=>React.act(async()=>root.render(React.createElement(React.StrictMode,null,React.createElement(SupplierXRayWorkflow,{locale:'en',theme:'dark',active,transport,onReturn:()=>{}}))));
 await draw();assert.equal(calls.length,0);
 await React.act(async()=>Simulate.change(document.querySelector('input[name=nip]'),{target:{value:nip}}));
 await React.act(async()=>Simulate.submit(document.querySelector('form')));
 assert.deepEqual(calls,['search','report-data']);assert(document.body.textContent!.includes('Synthetic supplier'));assert(document.querySelector('.financial-table')!.textContent!.includes('Net sales and equivalent revenue'));
 assert(Array.from(document.querySelectorAll('.financial-table td')).some(cell=>cell.textContent==='0'));
 const selects=document.querySelectorAll('select');await React.act(async()=>Simulate.change(selects[0],{target:{value:'consolidated'}}));assert(Array.from(document.querySelectorAll('.financial-table td')).some(cell=>cell.textContent==='22'));
 await React.act(async()=>Array.from(document.querySelectorAll('button')).find(x=>x.textContent==='Retrieve KYS report')!.click());
 assert.deepEqual(calls,['search','report-data','kys','report-data']);assert(document.body.textContent!.includes('Partial data'));assert(document.body.textContent!.includes('2026-10-27'));
 const tab=Array.from(document.querySelectorAll<HTMLButtonElement>('[role=tab]')).find(x=>x.textContent==='Registers, statuses and sanctions')!;await React.act(async()=>tab.click());assert.equal(tab.getAttribute('aria-selected'),'true');
 await draw(false);await draw(true);assert.equal(calls.length,4);assert.equal(new Set(keys).size,4);
 denied=true;await React.act(async()=>Array.from(document.querySelectorAll('button')).find(x=>x.textContent==='Retrieve again')!.click());
 assert(!document.body.textContent!.includes('Synthetic supplier'));assert(!document.querySelector('.financial-table'));assert(document.body.textContent!.includes('You do not have access'));assert.equal(calls.length,5);
 await React.act(async()=>root.unmount());dom.window.close();
});
