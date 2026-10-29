import test from 'node:test';import assert from 'node:assert/strict';
import {createPeerOperationSigner,PEER_OPERATION_HEADER,peerOperationIdentityRequest} from '@profitia/platform-contracts/peer-operation';
import {withSrmPeerXRay,readSrmPeerXRayConfiguration} from './peer-xray';
import {isSameOriginRequest} from './request-origin';
import {sampleCard} from '../demo/fixture';
const publicCard={...sampleCard,kys:{...sampleCard.kys,status:'NOT_REQUESTED' as const,data:null}};
import {XRAY_WORKFLOW_CONTRACT,unwrapXRayResponse} from '@profitia/srm-xray/workflow-contract';
const env={PROFITIA_XRAY_PEER_VERSION:'1.0.0',TARGET_ENVIRONMENT:'development',PROFITIA_AUTH_PROVIDER:'clerk',RENDER_SERVICE_ID:'srv-db1vu6gm7kps73d0e3r0',PROFITIA_XRAY_PEER_KEY_ID:'sg2-srm-xray-dev-v1',PROFITIA_XRAY_PEER_KEY:Buffer.alloc(32,13).toString('base64url')};
const configuration=readSrmPeerXRayConfiguration(env)!;
const signed=()=>createPeerOperationSigner(configuration)(new Request(configuration.targetOrigin+'/api/xray/search',{method:'POST',headers:{authorization:'Bearer synthetic-user', 'content-type':'application/json','idempotency-key':'11111111-1111-4111-8111-111111111111'},body:JSON.stringify({identifier:'0000000000'})}));
test('SRM admits only verified caller proof to ordinary request identity; copied headers are not verified authority',async()=>{
 let calls=0;const handler=withSrmPeerXRay(async request=>{calls++;assert(isSameOriginRequest(request));assert.equal(new URL(peerOperationIdentityRequest(request)!.url).origin,configuration.sourceOrigin);return Response.json({entityType:'COMPANY',card:publicCard});},env);
 const request=await signed(),response=await handler(request);assert.equal(response.status,200);const body=await response.json();assert.equal(body.contract.version,XRAY_WORKFLOW_CONTRACT.version);assert.deepEqual(unwrapXRayResponse('search',body,200),{entityType:'COMPANY',card:publicCard});assert.equal(calls,1);
 assert.equal(isSameOriginRequest(new Request(request.url,{method:request.method,headers:request.headers,body:JSON.stringify({identifier:'0000000000'})})),false);
});
test('missing configuration and forged caller proofs cannot invoke a business handler',async()=>{
 let calls=0;for(const configured of [{},env]){
 const handler=withSrmPeerXRay(async()=>{calls++;return Response.json({});},configured);
 const bad=new Request(configuration.targetOrigin+'/api/xray/search',{method:'POST',headers:{[PEER_OPERATION_HEADER]:'forged',authorization:'Bearer synthetic','content-type':'application/json'},body:'{}'});
 assert([403,503].includes((await handler(bad)).status));}
 assert.equal(calls,0);for(const change of [{TARGET_ENVIRONMENT:'staging'},{RENDER_SERVICE_ID:'foreign'},{PROFITIA_AUTH_PROVIDER:'legacy_demo'},{PROFITIA_XRAY_PEER_VERSION:'true'},{PROFITIA_XRAY_PEER_KEY:'bad'}])assert.throws(()=>readSrmPeerXRayConfiguration({...env,...change}));
});
test('standalone requests retain their exact original handler and response',async()=>{
 const request=new Request(configuration.targetOrigin+'/api/xray/search',{method:'POST',headers:{origin:configuration.targetOrigin}}),expected=Response.json({standalone:true});
 assert.equal(await withSrmPeerXRay(async received=>{assert.equal(received,request);return expected;},{})(request),expected);
});
test('invalid actual response data and private/extra root fields fail closed instead of being cast to a public card',async()=>{
 for(const value of [{entityType:'COMPANY',card:{...sampleCard,privateData:'secret'}},{...sampleCard},{entityType:'JDG',nip:'0000000000',section:{status:'SUCCESS',data:{entries:'invalid'}}}]){
 const response=await withSrmPeerXRay(async()=>Response.json(value),env)(await signed());assert.equal(response.status,502);assert.equal((await response.json()).error.code,'XRAY_RESPONSE_INVALID');}
});
