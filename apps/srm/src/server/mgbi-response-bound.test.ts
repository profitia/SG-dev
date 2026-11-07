import test from 'node:test'
import assert from 'node:assert/strict'
import {mainMgbiRecordResponseBound} from './mgbi-response-bound'
// The accepted SDK exports this internal byte reader to its own JS tests,
// while deliberately omitting it from the public consumer type surface.
// @ts-expect-error Test-only replay of the pinned internal transport guard.
import {readNativeProviderResponse} from '../../../../packages/platform-contracts/src/native-external-transport.mjs'
const app={appId:'srm',environment:'development' as const,deploymentId:'srv-db1vu6gm7kps73d0e3r0:'+ 'a'.repeat(40)}
const binding={environment:'development' as const,projectId:'spring-bread-28217539',branchId:'br-sparkling-term-b99l107x',databaseName:'platform_private',role:'srm_private_development_runtime'}
const role='srm_provider_development_source'
test('the record response bound selects only the exact main MGBI receiver',()=>{
 assert.equal(mainMgbiRecordResponseBound(app,binding,role,'MGBI_ONLY'),4194304)
 assert.equal(mainMgbiRecordResponseBound(app,{...binding,environment:'staging'},role,'MGBI_ONLY'),undefined)
 for(const patch of [{appId:'spendguru'},{environment:'staging' as const},{environment:'production' as const},{deploymentId:'srv-dbd5hlcipgvc73d98ukg:'+ 'a'.repeat(40)},{deploymentId:app.deploymentId+':extra'}])assert.equal(mainMgbiRecordResponseBound({...app,...patch},binding,role,'MGBI_ONLY'),undefined)
 for(const field of ['projectId','branchId','databaseName','role'])assert.equal(mainMgbiRecordResponseBound(app,{...binding,[field]:'other'},role,'MGBI_ONLY'),undefined)
 assert.equal(mainMgbiRecordResponseBound(app,binding,'srm_krs_pilot_source','MGBI_ONLY'),undefined)
 assert.equal(mainMgbiRecordResponseBound(app,binding,role,undefined),undefined)
})
test('the observed IKEA response needs the separately approved finite 4 MiB bound',async()=>{
 const observed=2815139,maximum=mainMgbiRecordResponseBound(app,binding,role,'MGBI_ONLY')!;
 const options=(maximumResponseBytes:number)=>({config:{maximumResponseBytes,redirectOrigins:[]},requestUrl:'https://api.mgbi.pl/v1/models/pl-krs-rdf-record/records',assertActive(){},signal:new AbortController().signal});
 const response=(size:number)=>new Response(new Uint8Array(size),{headers:{'content-type':'application/json','content-length':String(size)}});
 await assert.rejects(readNativeProviderResponse(response(observed),options(2097152)));
 const result=await readNativeProviderResponse(response(observed),options(maximum));assert.equal(result.bytes.length,observed);
 await assert.rejects(readNativeProviderResponse(response(maximum+1),options(maximum)));
 await assert.rejects(readNativeProviderResponse(new Response(new Uint8Array(maximum+1)),options(maximum)));
 await assert.rejects(readNativeProviderResponse(new Response('x',{headers:{'content-length':'invalid'}}),options(maximum)));
});
test('record-list size replay accepts both observed responses only within the proposed finite bound',async()=>{
 for(const size of [1184887,1637892]){
  const options=(maximumResponseBytes:number)=>({config:{maximumResponseBytes,redirectOrigins:[]},requestUrl:'https://api.mgbi.pl/v1/models/pl-krs-rdf-record/records',assertActive(){},signal:new AbortController().signal})
  const response=()=>new Response(new Uint8Array(size),{headers:{'content-type':'application/json','content-length':String(size)}})
  await assert.rejects(readNativeProviderResponse(response(),options(1048576)))
  const result=await readNativeProviderResponse(response(),options(2097152));assert.equal(result.bytes.length,size)
  await assert.rejects(readNativeProviderResponse(new Response(new Uint8Array(2097153)),options(2097152)))
  await assert.rejects(readNativeProviderResponse(new Response('x',{headers:{'content-length':'invalid'}}),options(2097152)))
 }
})
