import test from 'node:test'
import assert from 'node:assert/strict'
import {operationPayloadDigest} from '@profitia/platform-contracts/operation-context'
import {captureFinitePayload,PAYLOAD_CAPTURE_CONTRACT} from '../src/payload-capture.mjs'

const normalize=value=>JSON.parse(JSON.stringify(value,(_key,v)=>{if(typeof v==='number'&&!Number.isFinite(v))throw TypeError('non-finite');return v}))
const frozen=value=>{if(value&&typeof value==='object'){assert(Object.isFrozen(value));Object.values(value).forEach(frozen)}}
test('capture is data only, copies once, retains exact existing hash and does not mutate the caller',()=>{
 assert.equal(PAYLOAD_CAPTURE_CONTRACT.purpose,'DATA_ONLY')
 const input={z:[1,{a:'value'}],a:{b:true},missing:undefined},expected=normalize(input)
 const c=captureFinitePayload(input)
 assert.deepEqual(c.value,expected);assert.equal(c.digest,operationPayloadDigest(expected))
 assert.equal(c.byteLength,Buffer.byteLength(JSON.stringify(expected)))
 assert(Object.isFrozen(c));frozen(c.value);assert(!Object.isFrozen(input))
 input.z[1].a='changed';assert.equal(c.value.z[1].a,'value')
 assert.equal(captureFinitePayload(c.value),c)
 assert.notEqual(captureFinitePayload(input),c,'Mutable source objects are never indexed')
 assert.throws(()=>{c.value.z.push('mutation')},TypeError)
})
test('foreign frozen roots and repeated aliases cannot mint a reusable capture',()=>{
 const nested={value:1},foreign=Object.freeze({nested}),first=captureFinitePayload(foreign)
 nested.value=2;const second=captureFinitePayload(foreign)
 assert.equal(first.value.nested.value,1);assert.equal(second.value.nested.value,2);assert.notEqual(first,second)
 const same={n:1},aliases=captureFinitePayload({a:same,b:same})
 assert.deepEqual(aliases.value,{a:{n:1},b:{n:1}});assert.notEqual(aliases.value.a,aliases.value.b)
})
test('undefined, sparse arrays, signed zero, Unicode and inert prototype-named keys match JSON normalization',()=>{
 const array=[undefined,,null,-0,'\ud800','ą🙂\n"\\'];array.length=8
 const dict=Object.create(null);dict.__proto__={safe:true};dict.constructor='data';dict.a=undefined
 for(const input of [array,dict,{z:dict,a:array},null,true,false,123,-0,''] ){
  const c=captureFinitePayload(input),expected=normalize(input)
  assert.deepEqual(c.value,expected);assert.equal(c.digest,operationPayloadDigest(expected));assert.equal(c.byteLength,Buffer.byteLength(JSON.stringify(expected)));frozen(c.value)
 }
 assert.equal({}.safe,undefined)
})
test('one captured value still obeys stricter subsequent byte, node and depth limits',()=>{
 const c=captureFinitePayload({a:['🙂',1]})
 assert.equal(captureFinitePayload(c.value,{maximumBytes:c.byteLength,maximumNodes:c.nodeCount,maximumDepth:c.depth}),c)
 for(const options of [{maximumBytes:c.byteLength-1},{maximumNodes:c.nodeCount-1},{maximumDepth:c.depth-1}])assert.throws(()=>captureFinitePayload(c.value,options),RangeError)
 assert.throws(()=>captureFinitePayload('🙂',{maximumBytes:5}),RangeError)
 assert.equal(captureFinitePayload('🙂',{maximumBytes:6}).byteLength,6)
 assert.throws(()=>captureFinitePayload({a:1},{maximumNodes:1}),RangeError)
 assert.throws(()=>captureFinitePayload({a:1},{maximumDepth:0}),RangeError)
})
for(const [name,make]of [
 ['NaN',()=>({n:NaN})],['Infinity',()=>[Infinity]],['negative Infinity',()=>-Infinity],['BigInt',()=>({n:1n})],
 ['function value',()=>({f:()=>1})],['symbol value',()=>[Symbol('private')]],['undefined root',()=>undefined],
 ['Date',()=>new Date()],['Map',()=>new Map()],['Set',()=>new Set()],['typed array',()=>new Uint8Array([1])],
 ['custom prototype',()=>Object.create({private:1})],['cycle',()=>{const v={};v.a=v;return v}],
 ['array cycle',()=>{const v=[];v.push(v);return v}],
])test('capture rejects '+name,()=>assert.throws(()=>captureFinitePayload(make()),TypeError))
test('accessors and toJSON hooks are rejected without invocation',()=>{
 let calls=0
 for(const value of [Object.defineProperty({},'private',{enumerable:true,get(){calls++;return 'private'}}),
  Object.defineProperty([],'0',{enumerable:true,get(){calls++;return 'private'}}),
  {toJSON(){calls++;return 'private'}},Object.assign([],{toJSON(){calls++;return 'private'}})])assert.throws(()=>captureFinitePayload(value),TypeError)
 assert.equal(calls,0)
})
test('invalid or hidden limit options cannot silently weaken a requested bound',()=>{
 for(const options of [{maximumBytes:0},{maximumBytes:Infinity},{maximumBytes:32*1024*1024+1},{maximumDepth:513},{maximumNodes:-1},{unexpected:1},Object.defineProperty({},'maximumBytes',{value:1}),{get maximumBytes(){assert.fail('Accessor invoked')}}])assert.throws(()=>captureFinitePayload({},options),TypeError)
})
test('4000 deterministic generated cases preserve accepted JSON digests and refusal of undefined roots',()=>{
 let seed=271828
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
 const strings=['','value','zażółć🙂','\ud800','a\nb"c\\d','<>&']
 const make=depth=>{
  const n=Math.floor(random()*(depth?8:5))
  if(n===0)return null;if(n===1)return random()<0.5;if(n===2)return Math.round((random()-0.5)*1e8)/100;if(n===3)return strings[Math.floor(random()*strings.length)];if(n===4)return undefined
  if(n===5)return Array.from({length:Math.floor(random()*5)},()=>make(depth-1))
  const v={};for(let i=0;i<Math.floor(random()*5);i++)v[['a','z','01','100','ą'][i]]=make(depth-1);return v
 }
 for(let i=0;i<4000;i++){
  const input=make(4);if(input===undefined){assert.throws(()=>captureFinitePayload(input),TypeError);continue}
  const expected=normalize(input),c=captureFinitePayload(input)
  assert.deepEqual(c.value,expected);assert.equal(c.digest,operationPayloadDigest(expected));assert.equal(c.byteLength,Buffer.byteLength(JSON.stringify(expected)));frozen(c.value)
 }
})
