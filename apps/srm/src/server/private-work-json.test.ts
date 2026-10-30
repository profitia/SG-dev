import test from 'node:test'
import assert from 'node:assert/strict'
import {OperationDenied,operationPayloadDigest,type Json} from '@profitia/platform-contracts/operation-context'
import {capturePrivateWorkJson} from './private-work-json'

test('private Work captures an immutable copy before the caller can change nested data',()=>{
 const input={section:{data:{nip:'8521021463',amounts:['123.45','0']}},facts:[{amount:'123.45'}]}
 const copy=capturePrivateWorkJson(input),before=operationPayloadDigest(copy)
 input.section.data.amounts[0]='999';input.facts.push({amount:'999'})
 assert.equal(copy.section.data.amounts[0],'123.45');assert.equal(copy.facts.length,1)
 assert(Object.isFrozen(copy));assert(Object.isFrozen(copy.section.data.amounts))
 assert.throws(()=>{copy.facts[0].amount='999'},TypeError)
 assert.equal(operationPayloadDigest(copy),before)
})
test('required manifest hashes remain byte-identical to the common SDK, including property order',()=>{
 for(const value of [null,true,0,'zażółć',[],{z:[1,null,{b:2,a:'PLN'}],a:{status:'SUCCESS',warnings:[]}}]){
  const copy=capturePrivateWorkJson(value)
  assert.equal(operationPayloadDigest(copy as Json),operationPayloadDigest(value as Json))
 }
 assert.equal(operationPayloadDigest(capturePrivateWorkJson({b:2,a:1})),operationPayloadDigest({a:1,b:2}))
})
test('a caller-frozen wrapper cannot prevent copying its mutable nested values',()=>{
 const shallow=Object.freeze({nested:{amount:'30'}}),copy=capturePrivateWorkJson(shallow)
 shallow.nested.amount='40';assert.equal(copy.nested.amount,'30');assert.notEqual(copy,shallow)
})
test('non-finite data, raw JSON overflow and unsupported roots fail before returning data',()=>{
 for(const value of [NaN,Infinity,-Infinity,{amount:Infinity},[NaN],undefined,1n])
  assert.throws(()=>capturePrivateWorkJson(value),OperationDenied)
 const rawJson=(JSON as typeof JSON&{rawJSON?:(value:string)=>unknown}).rawJSON
 if(rawJson)assert.throws(()=>capturePrivateWorkJson(rawJson('1e400')),OperationDenied)
 const cycle:Record<string,unknown>={};cycle.self=cycle
 assert.throws(()=>capturePrivateWorkJson(cycle),OperationDenied)
})
test('the complete serialized payload stays bounded and JSON conversion runs only once',()=>{
 assert.throws(()=>capturePrivateWorkJson({body:'x'.repeat(32*1024*1024)}),OperationDenied)
 let calls=0;const converted=capturePrivateWorkJson({toJSON(){calls++;return {at:'2026-10-30',value:10}}})
 assert.equal(calls,1);assert.deepEqual(converted,{at:'2026-10-30',value:10})
 assert.equal(operationPayloadDigest(converted as unknown as Json),operationPayloadDigest({at:'2026-10-30',value:10}))
})
