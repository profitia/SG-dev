// SYNTHETIC_ONLY source integrity: never a runtime or Development acceptance.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {assistantNotificationsPredecessor,NOTIFICATIONS_RECEIPT,NOTIFICATIONS_BASE,NOTIFICATIONS_PATHS,NOTIFICATIONS_PRESERVED} from './assistant-notifications-integrity.mjs'
const root=new URL('../../../',import.meta.url),current=p=>readFileSync(new URL(p,root)),cache=new Map()
const historical=(sha,p)=>{const key=sha+':'+p;if(!cache.has(key))cache.set(key,execFileSync('git',['show',key],{cwd:root,stdio:['ignore','pipe','pipe']}));return Buffer.from(cache.get(key))}
const digest=b=>createHash('sha256').update(b).digest('hex')
test('new notification source is authenticated before exposing exact immutable predecessors',()=>{
 const view=assistantNotificationsPredecessor(current,historical);assert(view)
 for(const p of NOTIFICATIONS_PATHS.filter(p=>!p.includes('/assistant-notifications-integrity.')))assert.deepEqual(view.previousBytes(p),historical(NOTIFICATIONS_BASE,p),p)
 for(const p of [NOTIFICATIONS_RECEIPT,...NOTIFICATIONS_PATHS.filter(p=>p.includes('/assistant-notifications-integrity.'))])assert.throws(()=>view.previousBytes(p),{code:'ENOENT'})
 for(const p of NOTIFICATIONS_PRESERVED)assert.deepEqual(current(p),historical(NOTIFICATIONS_BASE,p),p)
 assert.deepEqual(current('apps/sg-runtime/components/appshell/platform-appshell.css'),historical(NOTIFICATIONS_BASE,'apps/sg-runtime/components/appshell/platform-appshell.css'))
 assert.equal(assistantNotificationsPredecessor(view.previousBytes,historical),null)
})
test('every altered or missing current source and prior receipt is rejected before any projection',()=>{
 for(const p of [...NOTIFICATIONS_PATHS,...NOTIFICATIONS_PRESERVED]){
  assert.throws(()=>assistantNotificationsPredecessor(f=>f===p?Buffer.concat([current(f),Buffer.from('UNACCEPTED')]):current(f),historical),p)
  assert.throws(()=>assistantNotificationsPredecessor(f=>{if(f===p)throw Object.assign(Error('Missing'),{code:'ENOENT'});return current(f)},historical),p)
 }
})
test('unknown fields, source widening, identity changes and rebinding cannot bless different runtime or history',()=>{
 for(const mutate of [a=>a.authorisationChanged=true,a=>a.schemaChanged=true,a=>a.modelChanged=true,a=>a.policiesChanged=true,a=>a.providerCallsPerformed=true,a=>a.deploymentPerformed=true,a=>a.taskId='another-task',a=>a.targetEnvironment='production',a=>a.scope='generic-ui',a=>a.previousSourceSha='0'.repeat(40),a=>a.unreviewed=true,a=>a.sourceDigests['apps/srm/unapproved.ts']='0'.repeat(64),a=>delete a.sourceDigests[NOTIFICATIONS_PATHS[0]],a=>a.preservedReceipts={}]){
  const a=JSON.parse(current(NOTIFICATIONS_RECEIPT));mutate(a)
  assert.throws(()=>assistantNotificationsPredecessor(p=>p===NOTIFICATIONS_RECEIPT?Buffer.from(JSON.stringify(a)):current(p),historical))
 }
 for(const p of [NOTIFICATIONS_PATHS[0],NOTIFICATIONS_PATHS[1],'apps/sg-runtime/tests/procurement-insights-completion-integrity.mjs','apps/sg-runtime/tests/procurement-insights.test.tsx',NOTIFICATIONS_PRESERVED[0]]){
  const bytes=Buffer.concat([current(p),Buffer.from('REBOUND')]),a=JSON.parse(current(NOTIFICATIONS_RECEIPT));if(p in a.sourceDigests)a.sourceDigests[p]=digest(bytes);else a.preservedReceipts[p]=digest(bytes)
  assert.throws(()=>assistantNotificationsPredecessor(f=>f===NOTIFICATIONS_RECEIPT?Buffer.from(JSON.stringify(a)):f===p?bytes:current(f),historical),p)
 }
})
test('optional absence is narrow; unreadability, malformed JSON and unrelated Git errors remain fatal',()=>{
 assert.equal(assistantNotificationsPredecessor(()=>{throw Object.assign(Error('Missing'),{code:'ENOENT'})},historical),null)
 for(const error of [Object.assign(Error('Denied'),{code:'EACCES'}),Object.assign(Error('Git'),{status:128,stderr:"fatal: path 'other.json' does not exist in 'main'"})])assert.throws(()=>assistantNotificationsPredecessor(()=>{throw error},historical),e=>e===error)
 assert.throws(()=>assistantNotificationsPredecessor(p=>p===NOTIFICATIONS_RECEIPT?Buffer.from('{'):current(p),historical))
 assert.throws(()=>assistantNotificationsPredecessor(current,()=>{throw Error('History unavailable')}))
})
