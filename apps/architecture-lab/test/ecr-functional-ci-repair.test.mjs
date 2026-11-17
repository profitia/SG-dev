import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {completeFunctionalPredecessor,COMPLETE_FUNCTIONAL_PRODUCER_RECORD,COMPLETE_FUNCTIONAL_CONSUMER_RECORD,CALENDAR_CI_REPAIR_PATHS,CALENDAR_CI_REPAIR_BASE} from '../ecr-complete-functional-source.mjs'
import {recurringSourceFilesystem} from '../private-recurring-source.mjs'
import {reviewedCalendarConsumerPaths,validateRouting} from '../../platform-source-hub/scripts/ci-routing.mjs'
const root=fileURLToPath(new URL('../../../',import.meta.url))
const sha=b=>createHash('sha256').update(b).digest('hex')
const current=p=>fs.readFileSync(path.join(root,p))
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
const historical=(ref,p)=>execFileSync('git',['show',ref+':'+p],{cwd:root,stdio:['ignore','pipe','pipe']})

test('Calendar full CI bridge authenticates all current inputs and retains immutable producer and consumer receipts',()=>{
 const view=completeFunctionalPredecessor(current,historical)
 assert(view.consumer)
 assert.equal(sha(current(COMPLETE_FUNCTIONAL_PRODUCER_RECORD)),'b6ccb6cd489f5931c45968be781156374faef490592852f07059738ce9f25118')
 assert.equal(sha(current(COMPLETE_FUNCTIONAL_CONSUMER_RECORD)),'c595640b0e30b914cd6003795f63fd08c1afa99371c4bc2af0df7c74445804c1')
 for(const[p,h]of Object.entries(view.currentSourceDigests))assert.equal(sha(current(p)),h,p)
 for(const p of CALENDAR_CI_REPAIR_PATHS)assert(Object.hasOwn(view.currentSourceDigests,p),p)
 for(const p of [COMPLETE_FUNCTIONAL_PRODUCER_RECORD,COMPLETE_FUNCTIONAL_CONSUMER_RECORD,'apps/architecture-lab/test/ecr-functional-ci-repair.test.mjs','apps/sg-runtime/tests/calendar-pi-source-compatibility.mjs'])assert.throws(()=>view.previousBytes(p),e=>e.code==='ENOENT')
 const old='apps/architecture-lab/private-recurring-source.mjs'
 assert.deepEqual(view.previousBytes(old),historical(CALENDAR_CI_REPAIR_BASE,old))
})
test('Calendar CI source bridge rejects altered runtime, helper, record and historical bytes and propagates access failures',()=>{
 for(const p of ['apps/economic-calendar-runtime/src/results.mjs',COMPLETE_FUNCTIONAL_PRODUCER_RECORD,COMPLETE_FUNCTIONAL_CONSUMER_RECORD,...CALENDAR_CI_REPAIR_PATHS]){
  assert.throws(()=>completeFunctionalPredecessor(f=>f===p?Buffer.concat([current(f),Buffer.from(' drift')]):current(f),historical),p)
 }
 const receipt=Object.keys(JSON.parse(current(COMPLETE_FUNCTIONAL_PRODUCER_RECORD)).preservedReceipts)[0]
 assert.throws(()=>completeFunctionalPredecessor(current,(s,p)=>p===receipt?Buffer.concat([historical(s,p),Buffer.from(' drift')]):historical(s,p)))
 const denial=Object.assign(Error('access denied'),{code:'EACCES'})
 assert.throws(()=>completeFunctionalPredecessor(p=>p===CALENDAR_CI_REPAIR_PATHS[0]?(()=>{throw denial})():current(p),historical),e=>e===denial)
})
test('SRM shared source view binds every actual SDK byte through the current Calendar graph',()=>{
 const view=recurringSourceFilesystem(root)
 assert(view.complete.consumer)
 const combined={...view.manifest.sourceDigests,...view.transport.manifest.sourceDigests,...view.transport.live.manifest.sourceDigests}
 for(const[p,h]of Object.entries(combined).filter(([p])=>p.startsWith('packages/platform-contracts/')))assert.equal(sha(current(p)),h,p)
 assert.equal(combined['packages/platform-contracts/test/recurring-consent-transport-source.mjs'],'4e7b07f2dafee476ca3d0fcd08b25eab6a842256a5f6f96becfc0d54599160f4')
})
test('Calendar routing checks the exact complete Git diff and all real owners, never an old recurring candidate',()=>{
 const candidateSha=git(root,'rev-parse','HEAD'),sourceReview={baseSha:CALENDAR_CI_REPAIR_BASE,candidateSha}
 const paths=reviewedCalendarConsumerPaths(root,sourceReview)
 assert.equal(paths.get('apps/sg-runtime/components/procurement-insights/calendar-email-settings.tsx'),'SG2')
 const changedPaths=git(root,'diff','--name-only',sourceReview.baseSha+'...'+candidateSha).split('\n')
 const called=[]
 validateRouting({changedPaths,repositoryRoot:root,readReceipt:p=>JSON.parse(current(p)),sourceReview,runGovernance:owner=>{called.push(owner);return{verdict:'PASS'}}})
 assert.deepEqual(called.sort(),['ARCHITECTURE','SG2'])
 assert.throws(()=>reviewedCalendarConsumerPaths(root))
 assert.throws(()=>reviewedCalendarConsumerPaths(root,{...sourceReview,candidateSha:'a'.repeat(40)}))
})
test('Calendar routing rejects additional committed input, changed bytes, symlinks and executable Git modes',()=>{
 const temporary=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'calendar-ci-repair-')))
 try{
  git(temporary,'clone','--quiet','--shared','--no-checkout',root,'fixture')
  const fixture=path.join(temporary,'fixture'),candidateSha=git(root,'rev-parse','HEAD')
  git(fixture,'update-ref','--no-deref','HEAD',candidateSha);git(fixture,'read-tree',candidateSha)
  const source=completeFunctionalPredecessor(current,historical)
  const required=new Set([...Object.keys(source.currentSourceDigests),...Object.keys(source.producer.preservedReceipts),...git(root,'ls-tree','-r','--name-only',candidateSha,'--','Canon').split('\n')])
  execFileSync('git',['checkout-index','--stdin','-z'],{cwd:fixture,input:[...required].join('\0')+'\0'})
  const sourceReview={baseSha:CALENDAR_CI_REPAIR_BASE,candidateSha}
  assert(reviewedCalendarConsumerPaths(fixture,sourceReview))
  const file=path.join(fixture,'apps/economic-calendar-runtime/src/results.mjs'),before=fs.readFileSync(file)
  fs.appendFileSync(file,' drift');assert.throws(()=>reviewedCalendarConsumerPaths(fixture,sourceReview));fs.writeFileSync(file,before)
  fs.unlinkSync(file);fs.symlinkSync(path.join(root,'apps/economic-calendar-runtime/src/results.mjs'),file);assert.throws(()=>reviewedCalendarConsumerPaths(fixture,sourceReview));fs.unlinkSync(file);fs.writeFileSync(file,before)
  git(fixture,'update-index','--chmod=+x','apps/economic-calendar-runtime/src/results.mjs')
  git(fixture,'-c','user.name=Isolated fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','SYNTHETIC_ONLY mode drift')
  assert.throws(()=>reviewedCalendarConsumerPaths(fixture,{...sourceReview,candidateSha:git(fixture,'rev-parse','HEAD')}))
  git(fixture,'reset','--quiet',candidateSha)
  fs.writeFileSync(path.join(fixture,'unreviewed-calendar.txt'),'unreviewed')
  git(fixture,'add','unreviewed-calendar.txt');git(fixture,'-c','user.name=Isolated fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','SYNTHETIC_ONLY extra input')
  assert.throws(()=>reviewedCalendarConsumerPaths(fixture,{...sourceReview,candidateSha:git(fixture,'rev-parse','HEAD')}))
 }finally{fs.rmSync(temporary,{recursive:true,force:true})}
})
