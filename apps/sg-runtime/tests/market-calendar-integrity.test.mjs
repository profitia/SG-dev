import {procurementInsightsCompletionPredecessor} from './procurement-insights-completion-integrity.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {marketCalendarPredecessor,MARKET_CALENDAR_CONSUMER_RECORD as record,MARKET_CALENDAR_CONSUMER_PATHS as paths,MARKET_CALENDAR_PRODUCER_RECORD,MARKET_CALENDAR_PRODUCER_RECORD_SHA} from './market-calendar-integrity.mjs'
const root=new URL('../../../',import.meta.url)
const physical=p=>fs.readFileSync(new URL(p,root))
const cache=new Map()
const historical=(sha,p)=>{const k=sha+':'+p;if(!cache.has(k))cache.set(k,execFileSync('git',['cat-file','blob',k],{cwd:root,stdio:['ignore','pipe','pipe']}));return cache.get(k)}
const current=procurementInsightsCompletionPredecessor(physical,historical)?.previousBytes??physical
test('actual calendar consumer preserves its accepted producer, dependencies and historical receipts',()=>{
 const a=marketCalendarPredecessor(current,historical)
 assert.equal(a.manifest.scope,'MARKET_CALENDAR_CONSUMER_SOURCE')
 assert.equal(a.manifest.producerRecordSha256,MARKET_CALENDAR_PRODUCER_RECORD_SHA)
 assert.deepEqual(a.previousBytes(MARKET_CALENDAR_PRODUCER_RECORD),current(MARKET_CALENDAR_PRODUCER_RECORD))
 for(const p of paths){
  if(['/workspace.tsx','/workspace.css','/package.json','/middleware.ts','/adp-appshell-consumer.test.tsx','/appshell-product-boundary.test.ts','/pci-smart-integrity.test.mjs'].some(s=>p.endsWith(s)))assert.deepEqual(a.previousBytes(p),historical(a.manifest.previousSourceSha,p))
  else assert.throws(()=>a.previousBytes(p),e=>e.status===128)
 }
 assert.throws(()=>a.previousBytes(record),e=>e.code==='ENOENT')
 const producer=marketCalendarPredecessor(a.previousBytes,historical)
 assert.equal(producer.manifest.scope,'MARKET_CALENDAR_PRODUCER_SOURCE_ONLY')
 assert.equal(marketCalendarPredecessor(producer.previousBytes,historical),null)
})
test('calendar adoption rejects modified source, old receipts, private dependencies and scope widening',()=>{
 const original=JSON.parse(current(record))
 for(const p of [...paths,...Object.keys(original.preservedReceipts),MARKET_CALENDAR_PRODUCER_RECORD])assert.throws(()=>marketCalendarPredecessor(f=>f===p?Buffer.concat([current(f),Buffer.from('tamper')]):current(f),historical),p)
 for(const edit of [a=>a.noNotificationDelivery=false,a=>a.unknown=true,a=>a.taskId='other-task',a=>a.sourceDigests['apps/sg-runtime/unapproved.ts']='0'.repeat(64),a=>delete a.sourceDigests[paths[0]],a=>a.previousSourceSha='0'.repeat(40)]){
  const a=structuredClone(original);edit(a);assert.throws(()=>marketCalendarPredecessor(p=>p===record?Buffer.from(JSON.stringify(a)):current(p),historical))
 }
 const denied=Object.assign(Error('read denied'),{code:'EACCES'})
 assert.throws(()=>marketCalendarPredecessor(()=>{throw denied},historical),e=>e===denied)
})
