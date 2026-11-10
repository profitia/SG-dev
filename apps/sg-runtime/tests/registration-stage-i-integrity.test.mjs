import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {REGISTRATION_ENTRY_PATH,REGISTRATION_ENTRY_PATHS,REGISTRATION_ENTRY_PRESERVED,registrationStageOnePredecessor} from './registration-stage-i-integrity.mjs'
const root=new URL('../../../',import.meta.url),current=p=>readFileSync(new URL(p,root))
const cache=new Map(),historical=(sha,p)=>{const k=sha+':'+p;if(!cache.has(k))cache.set(k,execFileSync('git',['show',k],{cwd:root}));return Buffer.from(cache.get(k))}
test('account entry correction validates exact current files before exposing immutable accepted predecessors',()=>{
 const view=registrationStageOnePredecessor(current,historical);assert(view)
 assert.deepEqual(view.previousBytes('apps/sg-runtime/app/[locale]/account/page.tsx'),historical(view.manifest.previousSourceSha,'apps/sg-runtime/app/[locale]/account/page.tsx'))
 assert.equal(registrationStageOnePredecessor(view.previousBytes,historical),null)
})
test('changed route, checker, required guard, source graph or prior receipt cannot silently pass',()=>{
 for(const file of [...REGISTRATION_ENTRY_PATHS,...REGISTRATION_ENTRY_PRESERVED,'apps/sg-runtime/operation-integration.json'])
  assert.throws(()=>registrationStageOnePredecessor(p=>p===file?Buffer.concat([current(p),Buffer.from('UNACCEPTED')]):current(p),historical),file)
 for(const mutate of [a=>a.authorisationChanged=true,a=>a.previousSourceSha='0'.repeat(40),a=>a.sdkChanged=true,a=>a.deploymentPerformed=true,
  a=>delete a.sourceDigests[REGISTRATION_ENTRY_PATHS[0]],a=>a.sourceDigests['apps/srm/unadmitted.ts']='0'.repeat(64),a=>a.previousReceipts['apps/sg-runtime/operation-integration.json']='0'.repeat(64)]){
  const changed=JSON.parse(current(REGISTRATION_ENTRY_PATH));mutate(changed)
  assert.throws(()=>registrationStageOnePredecessor(p=>p===REGISTRATION_ENTRY_PATH?Buffer.from(JSON.stringify(changed)):current(p),historical))
 }
})
test('absent adoption is optional; unreadable current adoption fails closed',()=>{
 assert.equal(registrationStageOnePredecessor(()=>{throw Object.assign(Error('absent'),{code:'ENOENT'})},historical),null)
 assert.throws(()=>registrationStageOnePredecessor(()=>{throw Object.assign(Error('unreadable'),{code:'EACCES'})},historical),{code:'EACCES'})
})
