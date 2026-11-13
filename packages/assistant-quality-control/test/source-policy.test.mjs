import test from 'node:test'
import assert from 'node:assert/strict'
import {assertRepairSource} from '../src/source-policy.mjs'
import {SOURCE_PATHS} from '../src/manifest.mjs'

const before='export function calendarReference(message:string,now:number){ return null }\n'
const check=body=>assertRepairSource({before,after:before.replace('return null',body),path:SOURCE_PATHS.C1,repairClass:'C1'})
test('Pure local calculations are admitted without executing the source',()=>{
 assert.deepEqual(check('const date=new Date(now); const x=message.toLowerCase(); return {date:date.toISOString(),x}').functions,['calendarReference'])
 assert.doesNotThrow(()=>check('function shift(n:number){return new Date(n).toISOString()} return shift(now)'))
})
test('Process, network, filesystem, dynamic import, reflection and escaped spellings are rejected',()=>{
 for(const body of [
  'return process.env','return fetch("https://untrusted.test")','return require("node:fs")','return import("node:fs")',
  'return globalThis','return global\\u0054his','return (()=>{}).constructor("return process")()',
  'const x="constructor"; return (()=>{})[x]("return process")()', 'return Object.getOwnPropertyDescriptor(Date,"now")',
  'return Object["getPrototypeOf"](message)','return Function("return process")()', 'return eval("process")',
  'return Date.now()','return new Date()','const x=Date; return x','Object.freeze(Date); return null',
  'Date.now=()=>now; return null','const o={x:1}; o.x=2; return o', 'return this',
  'return class X {}','return {get value(){return message}}',
  'return Object.__defineGetter__("x",()=>message)','return Date()',
 ])assert.throws(()=>check(body),body)
})
test('A declaration in another lexical scope cannot disguise a free privileged identifier',()=>{
 assert.throws(()=>check('function f(){const process={}; return process} return process.env'))
 assert.doesNotThrow(()=>check('function f(process:string){return process.toUpperCase()} return f(message)'))
})
test('Signatures, imports, immutable policy and unrelated functions cannot be edited',()=>{
 for(const after of [before.replace('now:number','now:string').replace('return null','return message'),
  'import fs from "node:fs"\n'+before.replace('return null','return message'),before.replace('export function','export async function').replace('return null','return message')]){
  assert.throws(()=>assertRepairSource({before,after,path:SOURCE_PATHS.C1,repairClass:'C1'}))
 }
 const b='export function renderGroundedFacts(x:string){return x}\nexport function applyQualityPolicy(x:string){return x}\n'
 const a=b.replace('applyQualityPolicy(x:string){return x}','applyQualityPolicy(x:string){return x.trim()}')
 assert.throws(()=>assertRepairSource({before:b,after:a,path:SOURCE_PATHS.C2,repairClass:'C2'}))
 assert.doesNotThrow(()=>assertRepairSource({before:b,after:a,path:SOURCE_PATHS.C3,repairClass:'C3'}))
})
test('Pure constructors and local counters are admitted; writes to frozen outer declarations are rejected',()=>{
 assert.doesNotThrow(()=>check('let n=Number(message); while(n>0){n--} if(n<0)throw TypeError("Invalid"); return n'))
 const source='let outer=0;\n'+before
 assert.throws(()=>assertRepairSource({before:source,after:source.replace('return null','outer++; return outer'),path:SOURCE_PATHS.C1,repairClass:'C1'}))
})
test('Private imported function can be called but its implementation cannot be reflected into an artifact',()=>{
 const source='import {resolveAssistantQualityPolicy} from "@profitia/cic-core";\nexport function applyQualityPolicy(x:unknown){return null}\n'
 for(const expression of ['resolveAssistantQualityPolicy','resolveAssistantQualityPolicy.toString()','{value:resolveAssistantQualityPolicy}']){
  assert.throws(()=>assertRepairSource({before:source,after:source.replace('return null','return '+expression),path:SOURCE_PATHS.C3,repairClass:'C3'}))
 }
 assert.doesNotThrow(()=>assertRepairSource({before:source,after:source.replace('return null','return resolveAssistantQualityPolicy(x)'),path:SOURCE_PATHS.C3,repairClass:'C3'}))
})
