// SYNTHETIC_ONLY: current client and public SDK, no LIVE provider or identity call.
import test from 'node:test'
import assert from 'node:assert/strict'
import {loadSupplierContext,readSrmSupplierSelection,supplierObservationSeed} from '../lib/procurement-insights/supplier-context'
const nip='5213390341',krs='0000000001',name='Synthetic Verified Supplier',selection={krs,nip,name,locality:null,selectionRef:'a'.repeat(64)}
test('supplier context uses only the existing signed presentation channel and its current credential',async()=>{
 let calls=0,credentials=0
 const result=await loadSupplierContext(async()=>{credentials++;return 'SYNTHETIC_ONLY'},nip,new AbortController().signal,async(url,init)=>{
  calls++;assert.equal(url,'/api/appshell/xray/presentation/registrySelection');assert.equal(init?.method,'POST');assert.equal(init?.credentials,'omit');assert.equal(init?.cache,'no-store');assert.equal(init?.redirect,'error');assert.deepEqual(JSON.parse(String(init?.body)),{nip})
  const headers=new Headers(init?.headers);assert.equal(headers.get('authorization'),'Bearer SYNTHETIC_ONLY');assert.equal(headers.get('cookie'),null);assert.equal(headers.get('x-user-id'),null);assert(headers.has('idempotency-key'))
  return Response.json(selection)
 })
 assert.deepEqual(result,{krs,nip,name,selectionRef:selection.selectionRef});assert.equal(calls,1);assert.equal(credentials,1)
})
test('supplier read is never cached across a current access refusal',async()=>{
 let calls=0;const transport=async()=>++calls===1?Response.json(selection):Response.json({error:'DENIED'},{status:403}),get=async()=>'SYNTHETIC_ONLY'
 assert.equal((await loadSupplierContext(get,nip,new AbortController().signal,transport)).nip,nip)
 await assert.rejects(()=>loadSupplierContext(get,nip,new AbortController().signal,transport),(e:any)=>e.status===403);assert.equal(calls,2)
})
test('supplier identity rejects substituted references, unexpected data and mismatched companies',()=>{
 for(const value of [{...selection,nip:'5850205607'},{...selection,selectionRef:'KRS:0000000002:'+ 'a'.repeat(64)},{...selection,financial:'not allowed'},{...selection,name:''}])assert.throws(()=>readSrmSupplierSelection(value,nip))
})
test('company observation is only a draft and uses exact confirmed name and tax number',()=>{
 const seed=supplierObservationSeed(readSrmSupplierSelection(selection,nip));assert.deepEqual(seed,{name,subject:nip,subjectKind:'company',phrases:[name,nip]})
 const long={...selection,name:'x'.repeat(201)},bounded=supplierObservationSeed(readSrmSupplierSelection(long,nip));assert.equal(bounded.name,'NIP '+nip);assert.deepEqual(bounded.phrases,[nip])
})
test('invalid selector or missing session cannot reach any upstream operation',async()=>{
 let calls=0;const transport=async()=>{calls++;throw Error('No upstream expected')}
 await assert.rejects(()=>loadSupplierContext(async()=>'SYNTHETIC_ONLY','invalid',new AbortController().signal,transport))
 await assert.rejects(()=>loadSupplierContext(async()=>null,nip,new AbortController().signal,transport));assert.equal(calls,0)
})
