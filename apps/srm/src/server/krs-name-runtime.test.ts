import test from 'node:test';
import assert from 'node:assert/strict';
import {OperationDenied} from '@profitia/platform-contracts/operation-context';
import {createKrsNameHttpHandler,getSrmKrsNameRuntime,type KrsNameHttpRuntime} from './krs-name-runtime';
const url='https://srm.example/api/xray/krs/search';
function request(body:unknown,extra:Record<string,string>={}){return new Request(url,{method:'POST',headers:{origin:'https://srm.example','content-type':'application/json',...extra},body:JSON.stringify(body)})}
test('default disabled mode does not construct a binding; an enable flag cannot bypass acceptance',async()=>{
  assert.equal(getSrmKrsNameRuntime({}),null);
  assert.throws(()=>getSrmKrsNameRuntime({SRM_KRS_NAME_SEARCH_ENABLED:'true',TARGET_ENVIRONMENT:'development'}));
  assert.throws(()=>getSrmKrsNameRuntime({SRM_KRS_NAME_SEARCH_ENABLED:'true',TARGET_ENVIRONMENT:'production'}));
  const r=await createKrsNameHttpHandler('status',()=>null)(new Request('https://srm.example/api/xray/krs/status'));
  assert.deepEqual(await r.json(),{enabled:false});assert.equal(r.headers.get('Cache-Control'),'private, no-store');
  assert.equal((await createKrsNameHttpHandler('search',()=>null)(request({query:'Fi'}))).status,503);
});
test('HTTP boundary rejects body authority, query overrides, wrong origin and oversized input before catalog action',async()=>{
  let calls=0;const unused=async():Promise<never>=>{throw Error('Must not execute')};
  const runtime:KrsNameHttpRuntime={available:async()=>true,api:{search:async()=>{calls++;return {candidates:[],coverage:'PROGRESSIVE'}},verify:unused,selection:unused,lookup:unused}};
  const handler=createKrsNameHttpHandler('search',()=>runtime);
  for(const body of [{query:'Fi',organisationId:'forged'},{query:'Fi',userId:'forged'},{query:'F'},{query:'x'.repeat(2100)},{query:['Fi']}])assert.equal((await handler(request(body))).status,400);
  assert.equal((await handler(request({query:'Fi'},{origin:'https://other.example'}))).status,403);
  assert.equal((await handler(new Request(url+'?organisationId=forged',{method:'POST',headers:{origin:'https://srm.example'}}))).status,400);
  assert.equal(calls,0);
  const good=await handler(request({query:'Fi'}));assert.equal(good.status,200);assert.deepEqual(await good.json(),{candidates:[],coverage:'PROGRESSIVE'});assert.equal(calls,1);
});
test('current native E1 denial is propagated without fallback or raw errors',async()=>{
  let calls=0;const unused=async():Promise<never>=>{calls++;throw Error('Must not execute')};
  for(const reason of ['UNVERIFIED_IDENTITY','ACCESS_BASIS_INVALID','AUDIT_UNAVAILABLE','ENVIRONMENT_MISMATCH'] as const){
    const runtime:KrsNameHttpRuntime={available:async()=>{throw Error('Duplicate capability probe')},api:{search:async()=>{throw new OperationDenied(reason)},verify:unused,selection:unused,lookup:unused}};
    const r=await createKrsNameHttpHandler('search',()=>runtime)(request({query:'Fi'}));
    assert.equal(r.status,reason==='UNVERIFIED_IDENTITY'?401:reason==='AUDIT_UNAVAILABLE'?503:403);
    assert.doesNotMatch(await r.text(),/actor|token|postgres|stack|ACCESS_BASIS/);
  }
  assert.equal(calls,0);
});

test('business action has one protected entry; status keeps its independent protected capability probe',async()=>{
 let probes=0,actions=0;const unused=async():Promise<never>=>{throw Error('Unused')};
 const runtime:KrsNameHttpRuntime={available:async()=>{probes++;return true},api:{search:async()=>{actions++;return {candidates:[],coverage:'PROGRESSIVE'}},verify:unused,selection:unused,lookup:unused}};
 assert.equal((await createKrsNameHttpHandler('search',()=>runtime)(request({query:'Fi'}))).status,200);
 assert.equal(actions,1);assert.equal(probes,0);
 assert.equal((await createKrsNameHttpHandler('status',()=>runtime)(new Request('https://srm.example/api/xray/krs/status'))).status,200);assert.equal(probes,1);
});

test('cached selection HTTP accepts only a NIP read command and retains current E1 without a status probe',async()=>{
 let reads=0;const unused=async():Promise<never>=>{throw Error('No search, refresh or report effect')};
 const runtime:KrsNameHttpRuntime={available:unused,api:{search:unused,verify:unused,lookup:unused,selection:async(_request,nip)=>{reads++;return {krs:'0000000001',nip,name:'Synthetic Fixture',locality:null,selectionRef:'KRS:0000000001:'+ 'a'.repeat(64)}}}};
 const handler=createKrsNameHttpHandler('selection',()=>runtime);
 for(const body of [{nip:'1234567890'},{nip:'5213390341',organisationId:'forged'},{nip:'5213390341',name:'untrusted'},{krs:'0000000001'},{nip:['5213390341']}])assert.equal((await handler(request(body))).status,400);
 assert.equal((await handler(request({nip:'5213390341'},{origin:'https://foreign.invalid'}))).status,403);
 assert.equal((await handler(new Request(url+'?nip=5213390341',{method:'POST',headers:{origin:'https://srm.example'}}))).status,400);
 assert.equal((await handler(new Request(url))).status,405);assert.equal(reads,0);
 const result=await handler(request({nip:'5213390341'}));assert.equal(result.status,200);assert.equal(result.headers.get('Cache-Control'),'private, no-store');assert.equal((await result.json()).name,'Synthetic Fixture');assert.equal(reads,1);
 const deniedRuntime:KrsNameHttpRuntime={...runtime,api:{...runtime.api,selection:async()=>{throw new OperationDenied('ACCESS_BASIS_INVALID')}}};
 const denied=await createKrsNameHttpHandler('selection',()=>deniedRuntime)(request({nip:'5213390341'}));assert.equal(denied.status,403);assert.doesNotMatch(await denied.text(),/ACCESS_BASIS|token|postgres|stack/);
});
