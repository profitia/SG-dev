import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {completeFunctionalPredecessor,COMPLETE_FUNCTIONAL_BASE,COMPLETE_FUNCTIONAL_PRODUCER_RECORD,COMPLETE_FUNCTIONAL_CONSUMER_RECORD,COMPLETE_FUNCTIONAL_PRODUCER_PATHS,COMPLETE_FUNCTIONAL_RECEIPTS} from '../ecr-complete-functional-source.mjs'
const root=new URL('../../../',import.meta.url),current=p=>fs.readFileSync(new URL(p,root)),cache=new Map()
const historical=(sha,p)=>{const k=sha+':'+p;if(!cache.has(k))cache.set(k,execFileSync('git',['show',k],{cwd:root,stdio:['ignore','pipe','pipe']}));return cache.get(k)}
test('new producer source is authenticated before an unchanged historical Calendar, registration or recurring view is exposed',()=>{
 const view=completeFunctionalPredecessor(current,historical);assert(view)
 for(const p of COMPLETE_FUNCTIONAL_PRODUCER_PATHS){
  assert.throws(()=>completeFunctionalPredecessor(f=>f===p?Buffer.concat([current(f),Buffer.from('UNREVIEWED')]):current(f),historical),p)
  try{assert.deepEqual(view.previousBytes(p),historical(COMPLETE_FUNCTIONAL_BASE,p))}catch(error){assert.match(String(error.stderr??error.message),/does not exist|exists on disk/)}
 }
 for(const p of COMPLETE_FUNCTIONAL_RECEIPTS){assert.deepEqual(view.previousBytes(p),historical(COMPLETE_FUNCTIONAL_BASE,p));assert.throws(()=>completeFunctionalPredecessor(f=>f===p?Buffer.concat([current(f),Buffer.from('UNREVIEWED')]):current(f),historical),p)}
 assert.throws(()=>view.previousBytes(COMPLETE_FUNCTIONAL_PRODUCER_RECORD),{code:'ENOENT'})
 assert.equal(completeFunctionalPredecessor(view.previousBytes,historical),null)
})
test('altered or rebound records and access failures never authorise a historical projection',()=>{
 const a=JSON.parse(current(COMPLETE_FUNCTIONAL_PRODUCER_RECORD));a.sourceDigests[COMPLETE_FUNCTIONAL_PRODUCER_PATHS[0]]='0'.repeat(64)
 assert.throws(()=>completeFunctionalPredecessor(p=>p===COMPLETE_FUNCTIONAL_PRODUCER_RECORD?Buffer.from(JSON.stringify(a)):current(p),historical))
 assert.throws(()=>completeFunctionalPredecessor(p=>{if(p===COMPLETE_FUNCTIONAL_CONSUMER_RECORD)return Buffer.from('{}');return current(p)},historical))
 assert.throws(()=>completeFunctionalPredecessor(()=>{throw Object.assign(Error('denied'),{code:'EACCES'})},historical),{code:'EACCES'})
 assert.equal(completeFunctionalPredecessor(()=>{throw Object.assign(Error('absent'),{code:'ENOENT'})},historical),null)
})
