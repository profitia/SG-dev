import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {assistantM2Predecessor,ASSISTANT_M2_PATHS,ASSISTANT_M2_PRODUCER_PATHS} from './assistant-m2-integrity.mjs'
const root=new URL('../../../',import.meta.url),current=p=>readFileSync(new URL(p,root))
const historical=(sha,p)=>execFileSync('git',['show',sha+':'+p],{cwd:root})
test('M2 adopts exact current consumer/producer source without rewriting historical acceptance',()=>{
 const view=assistantM2Predecessor(current,historical);assert(view)
 assert.deepEqual(view.previousBytes('apps/sg-runtime/package.json'),historical(view.manifest.previousSourceSha,'apps/sg-runtime/package.json'))
 for(const path of [...ASSISTANT_M2_PATHS,...ASSISTANT_M2_PRODUCER_PATHS])assert.throws(()=>assistantM2Predecessor(
  p=>p===path?Buffer.concat([current(p),Buffer.from('UNACCEPTED')]):current(p),historical),path)
 for(const mutate of [a=>a.acquisitionAllowed=true,a=>a.newGrant=true,a=>a.configuration.enabledByDefault=true,a=>a.producers.cic.version='99.0.0',a=>a.unreviewedScope=true]){
  const value=structuredClone(view.manifest);mutate(value)
  assert.throws(()=>assistantM2Predecessor(p=>p==='apps/sg-runtime/assistant-context-integration.json'?Buffer.from(JSON.stringify(value)):current(p),historical))
 }
})
