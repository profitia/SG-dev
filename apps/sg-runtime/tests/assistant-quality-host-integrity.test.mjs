import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {assistantQualityHostPredecessor,QUALITY_HOST_PATHS,QUALITY_HOST_PRESERVED,QUALITY_HOST_RECEIPT,QUALITY_HOST_BASE} from './assistant-quality-host-integrity.mjs'
const root=new URL('../../../',import.meta.url),current=p=>readFileSync(new URL(p,root))
const historical=(sha,p)=>execFileSync('git',['show',sha+':'+p],{cwd:root,stdio:['ignore','pipe','pipe']})
test('CIC1.8 host continuation binds every current file, actual package artifact and immutable earlier source receipt',()=>{
 const v=assistantQualityHostPredecessor(current,historical);assert(v)
 for(const p of [...QUALITY_HOST_PATHS,...QUALITY_HOST_PRESERVED])assert.throws(()=>assistantQualityHostPredecessor(f=>f===p?Buffer.concat([current(f),Buffer.from('UNREVIEWED')]):current(f),historical),p)
 assert.deepEqual(v.previousBytes('apps/sg-runtime/lib/assistant/conversation.ts'),historical(QUALITY_HOST_BASE,'apps/sg-runtime/lib/assistant/conversation.ts'))
 assert.throws(()=>v.previousBytes('apps/sg-runtime/lib/assistant/quality-response.ts'),{code:'ENOENT'})
})
test('host source metadata cannot activate private QA, start a pilot, publish another CIC artifact or weaken dependency policy',()=>{
 for(const mutate of [a=>a.responseProtectionActivated=true,a=>a.privateQaActivated=true,a=>a.cloudInstallationPerformed=true,a=>a.pilotStarted=true,
  a=>a.cicPublication.sourceSha='0'.repeat(40),a=>a.cicPublication.artifactZipSha256='0'.repeat(64),a=>a.sourceDigests['apps/srm/unadmitted.ts']='0'.repeat(64),a=>a.unadmitted=true]){
  const a=JSON.parse(current(QUALITY_HOST_RECEIPT));mutate(a)
  assert.throws(()=>assistantQualityHostPredecessor(p=>p===QUALITY_HOST_RECEIPT?Buffer.from(JSON.stringify(a)):current(p),historical))
 }
 assert.equal(assistantQualityHostPredecessor(()=>{throw Object.assign(Error('ABSENT'),{code:'ENOENT'})},historical),null)
 assert.throws(()=>assistantQualityHostPredecessor(()=>{throw Object.assign(Error('DENIED'),{code:'EACCES'})},historical),{code:'EACCES'})
})
