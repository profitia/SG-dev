import {operationPayloadDigest} from '@profitia/platform-contracts/operation-context'

export const PAYLOAD_CAPTURE_CONTRACT=Object.freeze({id:'profitia.finite-payload-capture',version:'1.0.0',purpose:'DATA_ONLY',digest:'operationPayloadDigest'})
const snapshots=new WeakMap()
const defaults=Object.freeze({maximumBytes:32*1024*1024,maximumDepth:128,maximumNodes:1000000})
const invalid=()=>{throw TypeError('Only finite plain JSON data values are supported')}
const exceeded=()=>{throw RangeError('Finite payload capture limit exceeded')}
const optionsFor=options=>{
 if(options===undefined)return defaults
 if(!options||Object.getPrototypeOf(options)!==Object.prototype||Reflect.ownKeys(options).some(k=>!Object.hasOwn(defaults,k)))invalid()
 const out={...defaults}
 for(const k of Reflect.ownKeys(options)){
  const d=Object.getOwnPropertyDescriptor(options,k)
  if(!d||!d.enumerable||!('value'in d)||!Number.isSafeInteger(d.value)||d.value<(k==='maximumDepth'?0:1)||d.value>({maximumBytes:32*1024*1024,maximumDepth:512,maximumNodes:2000000})[k])invalid()
  out[k]=d.value
 }
 return out
}
const fits=(r,limits)=>r.byteLength<=limits.maximumBytes&&r.depth<=limits.maximumDepth&&r.nodeCount<=limits.maximumNodes

/** Data snapshot only. Never identity, classification, current authority or
 * permission evidence. The weak index recognizes ONLY this module's own deeply
 * immutable copies, never a mutable caller input or a merely frozen root.
 * Undefined object fields are omitted; undefined/sparse array entries become
 * null, matching JSON serialization before the unchanged canonical SDK digest.
 * Accessors, custom prototypes/toJSON, functions, symbols and cycles are refused.
 */
export function captureFinitePayload(input,options){
 const limits=optionsFor(options),prior=input&&typeof input==='object'?snapshots.get(input):null
 if(prior){if(!fits(prior,limits))exceeded();return prior}
 let byteLength=0,nodeCount=0,depth=0
 const active=new WeakSet(),keyBytes=new Map()
 const add=n=>{byteLength+=n;if(byteLength>limits.maximumBytes)exceeded()}
 const keySize=key=>{
  let n=keyBytes.get(key)
  if(n===undefined){n=Buffer.byteLength(JSON.stringify(key));if(keyBytes.size<256)keyBytes.set(key,n)}
  return n
 }
 const visit=(value,level)=>{
  if(++nodeCount>limits.maximumNodes||level>limits.maximumDepth)exceeded()
  if(level>depth)depth=level
  if(value===null){add(4);return null}
  if(typeof value==='boolean'){add(value?4:5);return value}
  if(typeof value==='string'){add(Buffer.byteLength(JSON.stringify(value)));return value}
  if(typeof value==='number'){
   if(!Number.isFinite(value))invalid()
   add(Buffer.byteLength(JSON.stringify(value)));return Object.is(value,-0)?0:value
  }
  if(!value||typeof value!=='object'||active.has(value))invalid()
  const array=Array.isArray(value),proto=Object.getPrototypeOf(value)
  if(array?proto!==Array.prototype:proto!==Object.prototype&&proto!==null)invalid()
  const toJson=Object.getOwnPropertyDescriptor(value,'toJSON')
  if(toJson&&(!('value'in toJson)||typeof toJson.value==='function'))invalid()
  active.add(value);add(2)
  let copy
  if(array){
   if(value.length>limits.maximumNodes-nodeCount)exceeded()
   copy=new Array(value.length)
   for(let i=0;i<value.length;i++){
    if(i)add(1)
    const d=Object.getOwnPropertyDescriptor(value,String(i))
    if(d&&!('value'in d))invalid()
    copy[i]=visit(d?.value===undefined?null:d.value,level+1)
   }
  }else{
   copy={};let written=0
   for(const key of Object.keys(value)){
    const d=Object.getOwnPropertyDescriptor(value,key)
    if(!d||!('value'in d))invalid()
    if(d.value===undefined)continue
    if(written++)add(1)
    add(keySize(key)+1)
    const captured=visit(d.value,level+1)
    if(key==='__proto__')Object.defineProperty(copy,key,{value:captured,enumerable:true,writable:false,configurable:false})
    else copy[key]=captured
   }
  }
  active.delete(value)
  return Object.freeze(copy)
 }
 const value=visit(input,0)
 // Delegate hashing to the single existing SDK implementation. No second
 // canonicalization/hash algorithm, request context or authorization cache.
 const digest=operationPayloadDigest(value)
 const result=Object.freeze({value,digest,byteLength,depth,nodeCount})
 if(value&&typeof value==='object')snapshots.set(value,result)
 return result
}
