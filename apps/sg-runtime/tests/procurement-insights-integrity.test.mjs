import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {procurementInsightsPredecessor,PROCUREMENT_INSIGHTS_PATHS} from './procurement-insights-integrity.mjs'
const root=new URL('../../../',import.meta.url),current=p=>readFileSync(new URL(p,root)),historical=(sha,p)=>execFileSync('git',['show',sha+':'+p],{cwd:root})
const receipt='apps/sg-runtime/procurement-insights-integration.json'
test('exact PI source is verified before exposing preserved Oil/assistant source',()=>{
 const view=procurementInsightsPredecessor(current,historical);assert(view)
 for(const p of PROCUREMENT_INSIGHTS_PATHS)assert.throws(()=>procurementInsightsPredecessor(f=>f===p?Buffer.concat([current(f),Buffer.from('UNACCEPTED')]):current(f),historical),p)
 for(const p of ['apps/sg-runtime/package.json','apps/sg-runtime/tests/assistant-m2-integrity.mjs'])assert.deepEqual(view.previousBytes(p),historical(view.manifest.previousSourceSha,p))
 assert.deepEqual(current('apps/sg-runtime/assistant-context-integration.json'),historical(view.manifest.previousSourceSha,'apps/sg-runtime/assistant-context-integration.json'))
 assert.equal(procurementInsightsPredecessor(view.previousBytes,historical),null)
})
test('PI adoption rejects widened authority, missing/different source and unreadable receipts',()=>{
 for(const mutate of [a=>a.newE1Grant=true,a=>a.publishingWriterGranted=true,a=>a.privateSchedulesFailClosed=false,a=>a.activationIsSeparate=false,a=>a.previousSourceSha='0'.repeat(40),a=>a.newsfeedProducer.sourceSha='0'.repeat(40),a=>a.unreviewed=true,a=>delete a.sourceDigests[PROCUREMENT_INSIGHTS_PATHS[0]]]){
  const value=JSON.parse(current(receipt));mutate(value)
  assert.throws(()=>procurementInsightsPredecessor(p=>p===receipt?Buffer.from(JSON.stringify(value)):current(p),historical))
 }
 assert.equal(procurementInsightsPredecessor(()=>{throw Object.assign(Error('ABSENT'),{code:'ENOENT'})},historical),null)
 assert.throws(()=>procurementInsightsPredecessor(()=>{throw Object.assign(Error('UNREADABLE'),{code:'EACCES'})},historical),{code:'EACCES'})
 assert.throws(()=>procurementInsightsPredecessor(p=>p==='apps/sg-runtime/assistant-context-integration.json'?Buffer.concat([current(p),Buffer.from('UNACCEPTED')]):current(p),historical))
})
