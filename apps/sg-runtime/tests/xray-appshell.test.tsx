import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {loadXRayModule,runtime,publicUi} from './xray-browser-preview';
test('closed PL/EN X-Ray routes never accept another origin, locale or descendant as navigation authority',async()=>{
 const nav=await loadXRayModule('lib/appshell/xray-navigation.ts');for(const locale of ['pl','en']){assert.equal(nav.xrayPath(locale),'/'+locale+'/dashboard/xray');assert(nav.isXrayPath(nav.xrayPath(locale),locale));}
 for(const path of ['/pl/dashboard/xray/private','https://foreign.invalid/pl/dashboard/xray','/en/dashboard/xray'])assert(!nav.isXrayPath(path,'pl'));
});
test('browser transport captures a fresh credential, preserves idempotency and cannot choose upstream/identity/tenant',async()=>{
 const {createAppShellXRayTransport}=await loadXRayModule('lib/appshell/xray-transport.ts');const calls:any[]=[];
 const transport=createAppShellXRayTransport(async()=>'synthetic-current-user',async(input:any,init:any)=>{calls.push([input,init]);return Response.json({});});
 const init={method:'POST',body:JSON.stringify({identifier:'0000000000'}),headers:{'idempotency-key':'11111111-1111-4111-8111-111111111111','x-user-id':'forged','x-srm-diagnostic-execution':'forged'}};
 await transport('/api/xray/search',init);await transport('/api/xray/search',init);assert.equal(calls[0][0],'/api/appshell/xray/search');assert.equal(calls[0][1].credentials,'omit');assert.equal(calls[0][1].headers.authorization,'Bearer synthetic-current-user');assert(!Object.hasOwn(calls[0][1].headers,'x-user-id'));assert.deepEqual(calls[0][1].headers,calls[1][1].headers);
 for(const bad of ['https://foreign.invalid/api/xray/search','/api/xray/kys/pesel','/api/xray/search?organisationId=foreign'])await assert.rejects(transport(bad,init));
 await assert.rejects(transport('/api/xray/search',{...init,body:JSON.stringify({identifier:'0000000000',organisationId:'foreign'})}));assert.equal(calls.length,2);
 const cancelled=new AbortController();let resolve!:(v:string)=>void;const pending=createAppShellXRayTransport(()=>new Promise(r=>resolve=r),async()=>assert.fail('stale credential'))('/api/xray/search',{...init,signal:cancelled.signal});cancelled.abort();resolve('old');await assert.rejects(pending);
});
test('real AppShell composition opens X-Ray, preserves one assistant and clears old session presentation without fetching on mount',async()=>{
 const React=runtime('react'),{JSDOM}=runtime('jsdom'),{createRoot}=runtime('react-dom/client'),{AppShellDashboard}=await loadXRayModule('components/appshell/appshell-dashboard.tsx');
 const dom=new JSDOM('<div id="root"></div>',{url:'https://host.invalid/pl/dashboard'}),g=globalThis as any;
 Object.assign(g,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});g.__xrayNav={path:'/pl/dashboard',push:(p:string)=>{g.__xrayNav.path=p;}};g.__xrayAuth={isLoaded:true,isSignedIn:true,userId:'user-a',sessionId:'session-a',orgId:'org-a',getToken:async()=>null};
 const root=createRoot(document.getElementById('root')!),render=()=>React.act(async()=>root.render(React.createElement(AppShellDashboard,{locale:'pl',salutation:'Test',assistantAvatar:'male',onLogout:()=>{}})));
 await render();const launch=document.querySelector<HTMLButtonElement>('[aria-label="Uruchom X-Ray Supplier Intelligence"]')!;assert(!launch.disabled);await React.act(async()=>launch.click());await render();
 assert.equal(g.__xrayNav.path,'/pl/dashboard/xray');assert(document.querySelector('.srm-xray-workflow'));assert.equal(document.querySelectorAll('.srm-chat-slot').length,1);assert(document.querySelector('.as-applications[hidden]'));
 await React.act(async()=>Array.from(document.querySelectorAll('button')).find(x=>x.textContent==='Wróć do biurka')!.click());await render();assert.equal(g.__xrayNav.path,'/pl/dashboard');assert(document.querySelector('.as-module-workspace[hidden]'));
 g.__xrayNav.path='/en/dashboard/xray';await render();assert(!document.querySelector('[data-appshell-module=xray]:not([hidden])'));
 g.__xrayNav.path='/pl/dashboard/xray';g.__xrayAuth={...g.__xrayAuth,isSignedIn:false};await render();assert(!document.querySelector('.srm-xray-workflow'));await React.act(async()=>root.unmount());dom.window.close();
});
test('the public UI bundle contains no SRM private imports, peer keys, database clients, providers or second assistant',async()=>{
 const result=await loadXRayModule('components/appshell/xray-module-host.tsx',{metafile:true});
 for(const input of Object.keys(result.metafile.inputs))assert.doesNotMatch(input,/apps\/srm\/(?!node_modules\/)|peer-operation|(?:server\/|xray-gateway|node:crypto|neon|pg\/)/);
 assert.doesNotMatch(result.outputFiles[0].text,/PROFITIA_XRAY_PEER_KEY|CLERK_SECRET|SRM_DEMO_SESSION_SECRET|createPeerOperationSigner|createSrmPrivateOperationHost/);
 const css=fs.readFileSync(path.join(publicUi,'src/workflow.css'),'utf8');assert.doesNotMatch(css,/(^|\})\s*(?:html|body|:root)\s*\{/);assert(css.includes('.srm-xray-workflow[data-theme=dark]'));assert(css.includes('prefers-reduced-motion'));
});
