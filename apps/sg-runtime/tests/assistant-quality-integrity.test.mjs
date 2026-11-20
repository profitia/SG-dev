import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {assistantQualityPredecessor,QUALITY_PATHS,QUALITY_RECEIPTS,QUALITY_RECEIPT,QUALITY_BASE} from './assistant-quality-integrity.mjs'
const root=new URL('../../../',import.meta.url),current=p=>readFileSync(new URL(p,root))
const historical=(sha,p)=>execFileSync('git',['show',sha+':'+p],{cwd:root,stdio:['ignore','pipe','pipe']})
test('calendar continuation checks all current source, preserved receipts and actual historical bytes',()=>{
 const result=assistantQualityPredecessor(current,historical);assert(result)
 for(const p of QUALITY_PATHS)assert.throws(()=>assistantQualityPredecessor(f=>f===p?Buffer.concat([current(f),Buffer.from('UNACCEPTED')]):current(f),historical),p)
 for(const p of QUALITY_RECEIPTS)assert.throws(()=>assistantQualityPredecessor(f=>f===p?Buffer.concat([current(f),Buffer.from('UNACCEPTED')]):current(f),historical),p)
 assert.deepEqual(result.previousBytes('apps/sg-runtime/lib/assistant/conversation.ts'),historical(QUALITY_BASE,'apps/sg-runtime/lib/assistant/conversation.ts'))
 assert.throws(()=>result.previousBytes('apps/sg-runtime/lib/assistant/calendar-period.ts'),{code:'ENOENT'})
 assert.throws(()=>result.previousBytes(QUALITY_RECEIPT),{code:'ENOENT'})
})
test('source metadata never silently authorizes runtime, private data, dependency changes or a pilot',()=>{
 for(const mutate of [a=>a.runtimeActivated=true,a=>a.privateDataAccessChanged=true,a=>a.dependenciesChanged=true,a=>a.pilotStarted=true,a=>a.previousSourceSha='0'.repeat(40),a=>a.sourceDigests['apps/srm/foreign.ts']='0'.repeat(64),a=>a.unadmitted=true]){
  const a=JSON.parse(current(QUALITY_RECEIPT));mutate(a)
  assert.throws(()=>assistantQualityPredecessor(p=>p===QUALITY_RECEIPT?Buffer.from(JSON.stringify(a)):current(p),historical))
 }
 assert.equal(assistantQualityPredecessor(()=>{throw Object.assign(Error('ABSENT'),{code:'ENOENT'})},historical),null)
 assert.throws(()=>assistantQualityPredecessor(()=>{throw Object.assign(Error('DENIED'),{code:'EACCES'})},historical),{code:'EACCES'})
})
