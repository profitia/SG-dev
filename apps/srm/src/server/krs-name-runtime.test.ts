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
  const runtime:KrsNameHttpRuntime={available:async()=>true,api:{search:async()=>{calls++;return {candidates:[],coverage:'PROGRESSIVE'}},verify:unused,lookup:unused}};
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
    const runtime:KrsNameHttpRuntime={available:async()=>{throw new OperationDenied(reason)},api:{search:unused,verify:unused,lookup:unused}};
    const r=await createKrsNameHttpHandler('search',()=>runtime)(request({query:'Fi'}));
    assert.equal(r.status,reason==='UNVERIFIED_IDENTITY'?401:reason==='AUDIT_UNAVAILABLE'?503:403);
    assert.doesNotMatch(await r.text(),/actor|token|postgres|stack|ACCESS_BASIS/);
  }
  assert.equal(calls,0);
});
