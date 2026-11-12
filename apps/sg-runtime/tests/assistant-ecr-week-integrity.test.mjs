import {procurementInsightsCompletionPredecessor} from './procurement-insights-completion-integrity.mjs'
import {marketCalendarSourcePredecessor} from '../../architecture-lab/market-calendar-source.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {assistantEcrWeekPredecessor,WEEK_BASE,WEEK_RECEIPT,WEEK_PATHS,WEEK_RECEIPTS,weekArchitectureSource} from './assistant-ecr-week-integrity.mjs'
import {recurringSourcePredecessor,ECR_WEEK_SOURCE_SHA} from '../../architecture-lab/private-recurring-source.mjs'
const root=new URL('../../../',import.meta.url),rawCurrent=p=>fs.readFileSync(new URL(p,root)),cache=new Map()
const historical=(sha,p)=>{const k=sha+':'+p;if(!cache.has(k))cache.set(k,execFileSync('git',['show',k],{cwd:root,stdio:['ignore','pipe','pipe']}));return cache.get(k)}
// Verify the exact later adoption before exercising the immutable week source.
let current=procurementInsightsCompletionPredecessor(rawCurrent,historical)?.previousBytes??rawCurrent
for(let prior;(prior=marketCalendarSourcePredecessor(current,historical));)current=prior.previousBytes
const hash=b=>createHash('sha256').update(b).digest('hex')
test('ECR correction closes current source before retaining all prior receipts and recurring acceptance',()=>{
 const view=assistantEcrWeekPredecessor(current,historical,ECR_WEEK_SOURCE_SHA);assert(view)
 for(const p of WEEK_RECEIPTS)assert.deepEqual(current(p),historical(WEEK_BASE,p))
 for(const p of WEEK_PATHS.filter(p=>!p.includes('assistant-ecr-week-integrity.')))assert.deepEqual(view.previousBytes(p),historical(WEEK_BASE,p))
 assert.equal(assistantEcrWeekPredecessor(view.previousBytes,historical,ECR_WEEK_SOURCE_SHA),null)
 const recurring=recurringSourcePredecessor(current,historical);assert(recurring.successor);assert.equal(recurring.manifest.platformVersion,'1.36.0')
 assert.equal(recurringSourcePredecessor(recurring.previousBytes,historical),null)
})
test('current correction, authority hook and every immutable receipt fail closed on drift',()=>{
 for(const p of [...WEEK_PATHS,...WEEK_RECEIPTS,'apps/architecture-lab/private-recurring-source.mjs'])assert.throws(()=>recurringSourcePredecessor(f=>f===p?Buffer.concat([current(f),Buffer.from('UNREVIEWED')]):current(f),historical),p)
 const denied=Object.assign(Error('Denied'),{code:'EACCES'});assert.throws(()=>assistantEcrWeekPredecessor(()=>{throw denied},historical,ECR_WEEK_SOURCE_SHA),e=>e===denied)
 assert.equal(assistantEcrWeekPredecessor(p=>historical(WEEK_BASE,p),historical,ECR_WEEK_SOURCE_SHA),null)
})
test('even a rebound manifest and authority pin cannot remove the candidate coverage assertion',()=>{
 const p='apps/sg-runtime/tests/pci-smart-integrity.test.mjs',bad=Buffer.from(String(current(p)).replace('assertSourceCoverage(changed,','void(changed,'))
 const a=JSON.parse(current(WEEK_RECEIPT));a.sourceDigests[p]=hash(bad);const bytes=Buffer.from(JSON.stringify(a)),pin=hash(bytes)
 const changed=f=>f===p?bad:f===WEEK_RECEIPT?bytes:f==='apps/architecture-lab/private-recurring-source.mjs'?Buffer.from(weekArchitectureSource(String(historical(WEEK_BASE,f)),pin)):current(f)
 assert.throws(()=>assistantEcrWeekPredecessor(changed,historical,pin),'candidate coverage must survive a rebound record')
})
