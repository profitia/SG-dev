import test from 'node:test';
import assert from 'node:assert/strict';
import {loadXRayModule} from './xray-browser-preview';
const origin='https://dev-sg2.spendguru.app',issuer='https://xray-fixture.clerk.accounts.dev',id='11111111-1111-4111-8111-111111111111';
const environment=()=>({PROFITIA_AUTH_PROVIDER:'clerk',TARGET_ENVIRONMENT:'development',PROFITIA_SELF_SERVICE_ENABLED:'true',PROFITIA_SELF_SERVICE_PUBLIC_ORIGIN:origin,PROFITIA_SELF_SERVICE_SATELLITE_ENABLED:'true',PROFITIA_IDENTITY_RUNTIME_ORIGIN:'https://identity-runtime-development.onrender.com',PROFITIA_CLERK_ISSUER:issuer,PROFITIA_CLERK_PUBLISHABLE_KEY:'pk_test_'+Buffer.from(new URL(issuer).host+'$').toString('base64url'),PROFITIA_CLERK_SECRET_KEY:'sk_test_fixture',PROFITIA_CLERK_AUTHORIZED_PARTIES:JSON.stringify([origin]),PROFITIA_XRAY_PEER_VERSION:'1.0.0',PROFITIA_XRAY_PEER_KEY_ID:'sg2-srm-xray-dev-v1',PROFITIA_XRAY_PEER_KEY:Buffer.alloc(32,13).toString('base64url'),RENDER_SERVICE_ID:'srv-dapa3tid0e5s73f8bc5g'});
const request=(operation:string,body:unknown,extra:Record<string,string>={})=>new Request(origin+'/api/appshell/xray/presentation/'+operation,{method:'POST',headers:{authorization:'Bearer current-synthetic-user',origin,'content-type':'application/json','idempotency-key':id,...extra},body:JSON.stringify(body)});
const account=()=>Response.json({authenticated:true,userId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',expiresAt:new Date(Date.now()+60000).toISOString()});
const proof=(r:Request)=>JSON.parse(Buffer.from(r.headers.get('x-profitia-peer-operation')!.split('.')[0],'base64url').toString());
test('full host uses current credentials and retained write keys without accepting browser identity or upstream',async()=>{
 const {createAppShellFullXRayTransport}=await loadXRayModule('lib/appshell/xray-full-transport.ts');let credentials=0;const calls:any[]=[];
 const transport=createAppShellFullXRayTransport(async()=>{credentials++;return 'synthetic-'+credentials},async(input:any,init:any)=>{calls.push([input,init]);return Response.json({ready:true})});
 await transport('/api/supplier-locations?supplierId='+id,{method:'GET'});
 await transport('/api/xray/web-identity',{method:'POST',headers:{'idempotency-key':'srm-web-'+id},body:JSON.stringify({identifier:'8521021463',entityType:'COMPANY'})});
 assert.equal(credentials,2);assert.equal(calls[0][0],'/api/appshell/xray/presentation/mapReadiness');assert.deepEqual(JSON.parse(calls[0][1].body),{supplierId:id});assert.equal(calls[1][1].headers['idempotency-key'],'srm-web-'+id);assert.equal(calls[1][1].credentials,'omit');
 for(const url of ['https://foreign.invalid/api/xray/web-identity','//foreign.invalid/api/xray/web-identity','/api/supplier-locations?supplierId='+id+'&organisationId='+id])await assert.rejects(transport(url,{method:'GET'}));
 await assert.rejects(transport('/api/xray/web-identity',{method:'POST',body:JSON.stringify({identifier:'8521021463',entityType:'COMPANY',userId:id})}));assert.equal(calls.length,2);
});
test('presentation gateway signs explicit SRM routes and preserves current native denial',async()=>{
 const {createXRayPresentationGateway}=await loadXRayModule('lib/platform/xray-presentation-gateway.ts');let calls=0;
 const gateway=createXRayPresentationGateway({env:environment(),transport:async(r:Request|string)=>{if(typeof r==='string')return account();calls++;assert.equal(r.url,'https://srm-development-runtime.onrender.com/api/xray/presentation/registry-search');assert.equal(r.headers.get('authorization'),'Bearer current-synthetic-user');assert.equal(proof(r).caller,'spendguru');assert.deepEqual(await r.json(),{query:'Fixture'});return Response.json({private:'must-not-escape'},{status:403})}});
 const denied=await gateway(request('registrySearch',{query:'Fixture'}),'registrySearch');assert.equal(denied.status,403);assert.deepEqual(await denied.json(),{error:'XRAY_ACCESS_DENIED'});
 for(const extra of [{cookie:'private=session'},{origin:'https://foreign.invalid'}])assert.equal((await gateway(request('registrySearch',{query:'Fixture'},extra),'registrySearch')).status,403);
 assert.equal((await gateway(request('registrySearch',{query:'Fixture',organisationId:id}),'registrySearch')).status,400);assert.equal(calls,1);
});
test('XLSX/MSR bytes survive the gateway; filename, correlation and response headers remain bounded',async()=>{
 const {createXRayPresentationGateway}=await loadXRayModule('lib/platform/xray-presentation-gateway.ts'),bytes=new TextEncoder().encode('PK-synthetic-workbook-envelope'),selection={nip:'8521021463',scope:'standalone',years:['2025']};
 for(const valid of [true,false]){
  const gateway=createXRayPresentationGateway({env:environment(),transport:async(r:Request|string)=>typeof r==='string'?account():new Response(bytes,{headers:{'content-type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','X-Download-Filename':'Financials_MSR_8521021463_20261031.xlsx','X-SRM-XRay-Presentation':'profitia.srm-xray.presentation/1.0.0','X-Profitia-Correlation-Id':valid?proof(r).requestId:id,'set-cookie':'private=must-not-escape'}})});
  const response=await gateway(request('financialExcel',selection),'financialExcel');assert.equal(response.status,valid?200:502);assert.equal(response.headers.get('set-cookie'),null);assert.equal(response.headers.get('cache-control'),'private, no-store');if(valid)assert.deepEqual(new Uint8Array(await response.arrayBuffer()),bytes);
 }
});

test('presentation caller refusal and malformed account proof release no upstream operation or private projection',async()=>{
 const {createXRayPresentationGateway}=await loadXRayModule('lib/platform/xray-presentation-gateway.ts');
 for(const status of [401,403,503]){
  let calls=0;const gateway=createXRayPresentationGateway({env:environment(),transport:async(input:any)=>{calls++;assert.equal(typeof input,'string');return status===503?Response.json({authenticated:true,private:'must-not-escape'}):Response.json({},{status})}});
  const response=await gateway(request('registrySearch',{query:'Fixture'}),'registrySearch');assert.equal(response.status,status);assert.equal(calls,1);assert(!JSON.stringify(await response.json()).includes('must-not-escape'));
 }
});
test('slow presentation delivery renews expired caller proof, preserves revocation and never retries the native operation',async()=>{
 const {createXRayPresentationGateway}=await loadXRayModule('lib/platform/xray-presentation-gateway.ts');
 for(const revoked of [false,true]){
  let clock=Date.now(),accounts=0,native=0;
  const gateway=createXRayPresentationGateway({env:environment(),now:()=>clock,transport:async(input:any)=>{
   if(typeof input==='string'){accounts++;return revoked&&accounts===2?Response.json({},{status:403}):Response.json({authenticated:true,userId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',expiresAt:new Date(clock+5000).toISOString()})}
   native++;clock+=6000;return Response.json({candidates:[],coverage:'PROGRESSIVE'},{headers:{'X-SRM-XRay-Presentation':'profitia.srm-xray.presentation/1.0.0','X-Profitia-Correlation-Id':proof(input).requestId}});
  }});
  const response=await gateway(request('registrySearch',{query:'Fixture'}),'registrySearch');assert.equal(response.status,revoked?403:200);assert.equal(accounts,2);assert.equal(native,1);
  if(revoked)assert(!JSON.stringify(await response.json()).includes('candidates'));
 }
});
