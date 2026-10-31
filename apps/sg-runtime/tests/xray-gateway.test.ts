import test from 'node:test';import assert from 'node:assert/strict';import {loadXRayModule} from './xray-browser-preview';
const origin='https://dev-sg2.spendguru.app',issuer='https://xray-fixture.clerk.accounts.dev',user='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const environment=()=>({PROFITIA_AUTH_PROVIDER:'clerk',TARGET_ENVIRONMENT:'development',PROFITIA_SELF_SERVICE_ENABLED:'true',PROFITIA_SELF_SERVICE_PUBLIC_ORIGIN:origin,PROFITIA_SELF_SERVICE_SATELLITE_ENABLED:'true',PROFITIA_IDENTITY_RUNTIME_ORIGIN:'https://identity-runtime-development.onrender.com',PROFITIA_CLERK_ISSUER:issuer,PROFITIA_CLERK_PUBLISHABLE_KEY:'pk_test_'+Buffer.from(new URL(issuer).host+'$').toString('base64url'),PROFITIA_CLERK_SECRET_KEY:'sk_test_fixture',PROFITIA_CLERK_AUTHORIZED_PARTIES:JSON.stringify([origin]),PROFITIA_XRAY_PEER_VERSION:'1.0.0',PROFITIA_XRAY_PEER_KEY_ID:'sg2-srm-xray-dev-v1',PROFITIA_XRAY_PEER_KEY:Buffer.alloc(32,13).toString('base64url'),RENDER_SERVICE_ID:'srv-dapa3tid0e5s73f8bc5g'});
const request=(headers:Record<string,string>={},body:unknown={identifier:'0000000000'},suffix='')=>new Request(origin+'/api/appshell/xray/search'+suffix,{method:'POST',headers:{authorization:'Bearer synthetic-current-user',origin,'content-type':'application/json','idempotency-key':'11111111-1111-4111-8111-111111111111',...headers},body:JSON.stringify(body)});
const contract={id:'profitia.srm-xray.workflow',version:'1.0.0'},requestId='11111111-1111-4111-8111-111111111111';
const section={status:'EMPTY',retrievedAt:null,effectiveAt:null,data:null,warnings:[]};
const data={entityType:'COMPANY',card:{identity:{nip:'0000000000',krs:null,name:null},general:section,financial:section,kys:section}};
const correlation=(request:Request)=>JSON.parse(Buffer.from(request.headers.get('x-profitia-peer-operation')!.split('.')[0],'base64url').toString()).requestId;
const privateRequest=()=>new Request(origin+'/api/appshell/xray/kys',{method:'POST',headers:request().headers,body:JSON.stringify({identifier:'0000000000'})});
const proof=()=>Response.json({authenticated:true,userId:user,expiresAt:new Date(Date.now()+60_000).toISOString()});
test('Search forwards the captured bearer to current SRM admission and final disclosure without a redundant own-account call',async()=>{
 const {createXRayGateway}=await loadXRayModule('lib/platform/xray-gateway.ts'),seen:any[]=[];
 const gateway=createXRayGateway({env:environment(),transport:async(input:any,init:any)=>{seen.push([input,init]);if(typeof input==='string'){assert.equal(input,'https://identity-runtime-development.onrender.com/v1/account');assert.equal(init.headers.authorization,'Bearer synthetic-current-user');return proof();}
 assert(input instanceof Request);assert.equal(input.url,'https://srm-development-runtime.onrender.com/api/xray/search');assert.equal(input.method,'POST');assert.equal(input.headers.get('authorization'),'Bearer synthetic-current-user');assert.equal(input.headers.get('origin'),null);assert.equal(input.headers.get('cookie'),null);assert.equal(input.headers.get('x-user-id'),null);assert(input.headers.has('x-profitia-peer-operation'));assert.deepEqual(await input.clone().json(),{identifier:'0000000000'});return Response.json({contract,requestId:correlation(input),operation:'search',data},{headers:{'Set-Cookie':'forbidden','X-SRM-Request-Id':requestId}});}});
 const response=await gateway(request({'x-user-id':'forged'}),'search');assert.equal(response.status,200);assert.deepEqual((await response.json()).data,data);assert.equal(seen.length,1);assert(seen[0][0] instanceof Request);assert.equal(response.headers.get('set-cookie'),null);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('X-SRM-Request-Id'),requestId);
});
test('closed operations, same-origin ingress, body/size/idempotency and server configuration reject before any upstream request',async()=>{
 const {createXRayGateway,readAppShellXRayConfiguration}=await loadXRayModule('lib/platform/xray-gateway.ts');let calls=0;
 const gateway=createXRayGateway({env:environment(),transport:async()=>{calls++;throw Error('unexpected');}});
 for(const r of [request({origin:'https://foreign.invalid'}),request({cookie:'forged'}),request({},undefined,'?organisationId=foreign'),request({}, {identifier:'0000000000',organisationId:user}),request({'idempotency-key':'bad'}),request({}, {identifier:'x'.repeat(3000)})])assert([400,403].includes((await gateway(r,'search')).status));
 assert.equal((await gateway(request(),'constructor')).status,404);assert.equal((await gateway(new Request(origin+'/api/appshell/xray/search'),'search')).status,405);assert.equal(calls,0);
 const noBearer=request();noBearer.headers.delete('authorization');assert.equal((await gateway(noBearer,'search')).status,401);
 assert.equal(readAppShellXRayConfiguration({}),null);for(const patch of [{TARGET_ENVIRONMENT:'staging'},{RENDER_SERVICE_ID:'foreign'},{PROFITIA_IDENTITY_RUNTIME_ORIGIN:'https://foreign.invalid'},{PROFITIA_XRAY_PEER_VERSION:'true'},{PROFITIA_XRAY_PEER_KEY:'bad'}])assert.throws(()=>readAppShellXRayConfiguration({...environment(),...patch}));
});
test('private own-account refusals never reach SRM; Search preserves current SRM identity and tenant denials',async()=>{
 const {createXRayGateway}=await loadXRayModule('lib/platform/xray-gateway.ts');
 for(const response of [Response.json({},{status:401}),Response.json({},{status:403}),Response.json({authenticated:true,userId:user,expiresAt:new Date(Date.now()-1000).toISOString()})]){
 let calls=0;const gateway=createXRayGateway({env:environment(),transport:async(input:any)=>{calls++;assert.equal(typeof input,'string');return response;}});assert([401,403].includes((await gateway(privateRequest(),'kys')).status));assert.equal(calls,1);}
 for(const status of [401,403]){const gateway=createXRayGateway({env:environment(),transport:async(input:any)=>typeof input==='string'?proof():Response.json({contract,requestId,operation:'search',error:{code:status===401?'XRAY_SESSION_REQUIRED':'XRAY_ACCESS_DENIED'}},{status})});assert.equal((await gateway(request(),'search')).status,status);}
});
test('malformed/version-mismatched/oversize responses, redirects and expired calls release no business projection',async()=>{
 const {createXRayGateway}=await loadXRayModule('lib/platform/xray-gateway.ts');
 for(const upstream of [()=>Response.json({data}),()=>Response.json({contract:{...contract,version:'2.0.0'},requestId,operation:'search',data}),()=>Response.json({contract,requestId,operation:'search',data:{...data,card:{...data.card,privateData:'forbidden'}}}),()=>new Response('x'.repeat(9*1024*1024),{headers:{'content-type':'application/json'}})]){
 const gateway=createXRayGateway({env:environment(),transport:async(input:any)=>typeof input==='string'?proof():upstream()});const response=await gateway(request(),'search');assert.equal(response.status,502);assert(!JSON.stringify(await response.json()).includes('forbidden'));}
});

test('slow private SRM work retains renewal, no provider retry and no disclosure after caller revocation',async()=>{
 const {createXRayGateway}=await loadXRayModule('lib/platform/xray-gateway.ts');
 for(const revoke of [false,true]){
 let clock=Date.now(),accountReads=0,srmCalls=0;
 const gateway=createXRayGateway({env:environment(),now:()=>clock,transport:async(input:any)=>{
  if(typeof input==='string'){accountReads++;if(revoke&&accountReads===2)return Response.json({},{status:403});return Response.json({authenticated:true,userId:user,expiresAt:new Date(clock+5000).toISOString()});}
  srmCalls++;clock+=6000;return Response.json({contract,requestId:correlation(input),operation:'kys',data:{section,privateReport:null}});
 }});
 const response=await gateway(privateRequest(),'kys');assert.equal(response.status,revoke?403:200);assert.equal(accountReads,2);assert.equal(srmCalls,1);
 if(revoke)assert(!JSON.stringify(await response.json()).includes('card'));
 }
});

import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';import {app,publicUi,platform} from './xray-browser-preview';
test('consumer binds exact owner source, additive history and the closed public native workflow without claiming live activation',()=>{
 const receipt=JSON.parse(fs.readFileSync(path.join(app,'operation-integration.json'),'utf8')),current=receipt.appshellXraySourceCompatibility,descriptor=JSON.parse(fs.readFileSync(path.join(app,'xray-appshell-integration.json'),'utf8'));
 const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex'),before=execFileSync('git',['show',current.previousReceiptSourceSha+':apps/sg-runtime/operation-integration.json'],{cwd:app});
 assert.equal(hash(before),current.previousReceiptSha256);for(const [key,value]of Object.entries(JSON.parse(before.toString())))assert.deepEqual(receipt[key],value,key);
 assert.equal(current.publicUi.producer.projectKey,'SRM');assert(Number.isInteger(current.publicUi.producer.pullRequest));assert.match(current.publicUi.producer.sourceSha,/^[a-f0-9]{40}$/);assert.deepEqual(descriptor.publicUi,current.publicUi);
 const publicCurrent=(receipt.fullUiParityAdoption??receipt.freshPerformanceRecovery).publicUi;const digest=createHash('sha256');for(const file of publicCurrent.sourceFiles){assert(!path.isAbsolute(file)&&!file.split('/').includes('..'));digest.update(file).update('\0').update(fs.readFileSync(path.join(publicUi,file))).update('\0');}assert.equal(digest.digest('hex'),publicCurrent.sourceDigest);
 for(const[file,value]of Object.entries({...current.sourceDigests,...receipt.freshPerformanceRecovery.sourceDigests,...receipt.settledExternalFailureCompatibility?.sourceDigests,...receipt.sourceLeaseClockCompatibility?.sourceDigests,...receipt.freshPostfetchCompatibility?.sourceDigests}))assert.equal(hash(fs.readFileSync(path.join(platform,file))),value,file);
 for(const[file,value]of Object.entries({...current.applicationSourceDigests,...receipt.freshPerformanceRecovery.applicationSourceDigests,...receipt.xraySearchBoundaryConsolidation?.applicationSourceDigests,...receipt.settledExternalFailureCompatibility?.applicationSourceDigests,...receipt.sourceLeaseClockCompatibility?.applicationSourceDigests,...receipt.freshPostfetchCompatibility?.applicationSourceDigests,...receipt.pciLiveAcceptanceStabilization?.applicationSourceDigests,...receipt.pciMain800IntegrityCompatibility?.applicationSourceDigests,...receipt.bqlPciFirstSourceCompatibility?.applicationSourceDigests,...receipt.bqlLiveAcceptanceCompatibility?.applicationSourceDigests,...receipt.fullUiParityAdoption?.applicationSourceDigests}))assert.equal(hash(fs.readFileSync(path.join(app,file))),value,file);
 for(const[file,value]of Object.entries(current.repositorySourceDigests))assert.equal(hash(fs.readFileSync(path.resolve(app,'../..',file))),receipt.bqlLiveAcceptanceCompatibility?.sourceDigests[file]??receipt.bqlPciFirstSourceCompatibility?.sourceDigests[file]??receipt.pciMain800IntegrityCompatibility?.applicationSourceDigests[path.relative(app,path.resolve(app,'../..',file))]??receipt.pciLiveAcceptanceStabilization?.applicationSourceDigests[path.relative(app,path.resolve(app,'../..',file))]??receipt.freshPostfetchCompatibility?.applicationSourceDigests[path.relative(app,path.resolve(app,'../..',file))]??receipt.sourceLeaseClockCompatibility?.applicationSourceDigests[path.relative(app,path.resolve(app,'../..',file))]??receipt.settledExternalFailureCompatibility?.applicationSourceDigests[path.relative(app,path.resolve(app,'../..',file))]??receipt.freshPerformanceRecovery.applicationSourceDigests[path.relative(app,path.resolve(app,'../..',file))]??value,file);
 assert.equal(current.platformVersion,'1.31.0');assert.equal(current.publicUi.version,'0.3.0');assert.equal(descriptor.routes.pl,'/pl/dashboard/xray');assert.equal(descriptor.routes.en,'/en/dashboard/xray');
 for(const flag of ['identitySourceChanged','operationContractChanged','existingPeerReadChanged','grantsOrMembershipChanged','schemaOrInfrastructureChanged','benchmarkOrAdpBusinessLogicChanged','productDeploymentPerformed'])assert.equal(current[flag],false,flag);
 assert.equal(descriptor.deployment.liveAcceptance,'PENDING_OWNER_DEPLOYMENT_APPROVAL');
});


test('Search never retries a current receiver refusal or exposes a report after final revocation',async()=>{
 const {createXRayGateway}=await loadXRayModule('lib/platform/xray-gateway.ts');
 for(const status of [401,403,503]){
  let calls=0;const gateway=createXRayGateway({env:environment(),transport:async(input:any)=>{
   calls++;assert(input instanceof Request);assert.equal(input.headers.get('authorization'),'Bearer synthetic-current-user');
   return Response.json({contract,requestId:correlation(input),operation:'search',error:{code:status===401?'XRAY_SESSION_REQUIRED':status===403?'XRAY_ACCESS_DENIED':'XRAY_UNAVAILABLE'}},{status});
  }});
  const response=await gateway(request(),'search');assert.equal(response.status,status);assert.equal(calls,1);
  assert(!JSON.stringify(await response.json()).includes('card'));
 }
});


test('Search consolidation pins the same accepted receiver and preserves all historical source receipts',()=>{
 const receipt=JSON.parse(fs.readFileSync(path.join(app,'operation-integration.json'),'utf8')),a=receipt.xraySearchBoundaryConsolidation;
 const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
 const before=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/sg-runtime/operation-integration.json'],{cwd:app});
 assert.equal(hash(before),a.previousReceiptDigest);for(const[k,v]of Object.entries(JSON.parse(before.toString())))assert.deepEqual(receipt[k],v,k);
 assert.equal(a.receiver.applicationId,'srm');assert.equal(a.receiver.origin,'https://srm-development-runtime.onrender.com');
 assert.deepEqual(a.receiver.currentHumanReadContract,{id:'profitia.current-human-read',version:'1.1.0'});
 assert.equal(a.duplicateCallerAccountReadRemovedForSearch,true);assert.equal(a.privateOperationBoundariesChanged,false);
 assert.equal(a.receiverCurrentAdmissionAndFinalDisclosureRequired,true);assert.equal(a.authorizationCacheIntroduced,false);
 for(const[file,digest]of Object.entries(a.applicationSourceDigests))assert.equal(hash(receipt.pciMain800IntegrityCompatibility?.applicationSourceDigests[file]??receipt.pciLiveAcceptanceStabilization?.applicationSourceDigests[file]??receipt.freshPostfetchCompatibility?.applicationSourceDigests[file]??receipt.sourceLeaseClockCompatibility?.applicationSourceDigests[file]??receipt.settledExternalFailureCompatibility?.applicationSourceDigests[file]?execFileSync('git',['show',receipt.settledExternalFailureCompatibility.previousReceiptSourceSha+':'+path.posix.normalize('apps/sg-runtime/'+file)],{cwd:app}):receipt.fullUiParityAdoption?.applicationSourceDigests[file]?execFileSync('git',['show',receipt.fullUiParityAdoption.previousReceiptSourceSha+':apps/sg-runtime/'+file],{cwd:app}):fs.readFileSync(path.join(app,file))),digest,file);
});
