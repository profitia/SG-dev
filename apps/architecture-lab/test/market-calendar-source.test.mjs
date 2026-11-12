import {sdkContinuationPredecessor} from '../../../packages/platform-contracts/test/organisation-sdk-compatibility.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {marketCalendarSourcePredecessor,calendarTestCompatibilityCurrent,MARKET_CALENDAR_TEST_COMPATIBILITY_RECORD,MARKET_CALENDAR_PRODUCER_PATHS,MARKET_CALENDAR_PRODUCER_RECORD,MARKET_CALENDAR_PRODUCER_BASE,MARKET_CALENDAR_PRODUCER_RECORD_SHA,MARKET_CALENDAR_CONSUMER_PATHS,MARKET_CALENDAR_CONSUMER_RECORD} from '../market-calendar-source.mjs'
const root=new URL('../../../',import.meta.url),rawPhysical=p=>fs.readFileSync(new URL(p,root)),cache=new Map(),historical=(sha,p)=>{const k=sha+':'+p;if(!cache.has(k))cache.set(k,execFileSync('git',['show',k],{cwd:root,stdio:['ignore','pipe','pipe']}));return cache.get(k)}
// Authenticate the complete current SDK and both receivers before Calendar history.
const sdk=sdkContinuationPredecessor(JSON.parse(rawPhysical('apps/sg-runtime/operation-integration.json')),rawPhysical,historical)
const physical=sdk?.calendarCurrent??rawPhysical
const current=calendarTestCompatibilityCurrent(physical,historical)
test('calendar source is checked before a preserved historical view; all earlier architecture acceptances remain byte-identical',()=>{
 const top=marketCalendarSourcePredecessor(current,historical);assert(top)
 const producerCurrent=top.manifest.scope==='MARKET_CALENDAR_CONSUMER_SOURCE'?top.previousBytes:current
 const view=marketCalendarSourcePredecessor(producerCurrent,historical);assert(view)
 for(const p of MARKET_CALENDAR_PRODUCER_PATHS){
  assert.throws(()=>marketCalendarSourcePredecessor(f=>f===p?Buffer.concat([current(p),Buffer.from('UNREVIEWED')]):current(f),historical),p)
  try{assert.deepEqual(view.previousBytes(p),historical(MARKET_CALENDAR_PRODUCER_BASE,p))}catch(e){assert.match(String(e.stderr??e.message),/does not exist|exists on disk/)}
 }
 assert.throws(()=>view.previousBytes(MARKET_CALENDAR_PRODUCER_RECORD),{code:'ENOENT'})
 assert.equal(marketCalendarSourcePredecessor(view.previousBytes,historical),null)
 const receipt=JSON.parse(current(MARKET_CALENDAR_PRODUCER_RECORD));receipt.sourceDigests[MARKET_CALENDAR_PRODUCER_PATHS[0]]='a'.repeat(64)
 assert.throws(()=>marketCalendarSourcePredecessor(p=>p===MARKET_CALENDAR_PRODUCER_RECORD?Buffer.from(JSON.stringify(receipt)):current(p),historical))
})
test('test-only compatibility authenticates the physical correction before preserving the original producer receipt',()=>{
 const p='apps/architecture-lab/test/market-calendar-source.test.mjs',a=JSON.parse(physical(MARKET_CALENDAR_TEST_COMPATIBILITY_RECORD))
 assert.deepEqual(current(p),historical(a.previousSourceSha,p))
 assert.deepEqual(current(MARKET_CALENDAR_PRODUCER_RECORD),physical(MARKET_CALENDAR_PRODUCER_RECORD))
 assert.throws(()=>current(MARKET_CALENDAR_TEST_COMPATIBILITY_RECORD),{code:'ENOENT'})
 for(const f of [p,MARKET_CALENDAR_TEST_COMPATIBILITY_RECORD,MARKET_CALENDAR_PRODUCER_RECORD])assert.throws(()=>calendarTestCompatibilityCurrent(n=>n===f?Buffer.concat([physical(n),Buffer.from('UNREVIEWED')]):physical(n),historical),f)
})
test('absent successor is optional; access failures and unrelated Git failures remain fatal',()=>{
 assert.equal(marketCalendarSourcePredecessor(()=>{throw Object.assign(Error('Absent'),{code:'ENOENT'})},historical),null)
 const denied=Object.assign(Error('Denied'),{code:'EACCES'});assert.throws(()=>marketCalendarSourcePredecessor(()=>{throw denied},historical),e=>e===denied)
 const foreign=Object.assign(Error('Other Git failure'),{status:128,stderr:"fatal: path 'another' does not exist in 'main'"});assert.throws(()=>marketCalendarSourcePredecessor(()=>{throw foreign},historical),e=>e===foreign)
})
test('separate consumer adoption binds its actual producer and preserved receipts, and cannot widen paths or dependencies',()=>{
 const digest=b=>createHash('sha256').update(b).digest('hex'),base='1'.repeat(40),sources=new Map(MARKET_CALENDAR_CONSUMER_PATHS.map(p=>[p,Buffer.from('SYNTHETIC_ONLY '+p)]))
 const pkg='apps/sg-runtime/package.json',lock='apps/sg-runtime/package-lock.json';sources.set(pkg,historical(MARKET_CALENDAR_PRODUCER_BASE,pkg));sources.set(lock,historical(MARKET_CALENDAR_PRODUCER_BASE,lock))
 const receipts=['operation-integration','procurement-insights-integration','private-recurring-source-adoption','assistant-context-integration','assistant-ecr-integration','assistant-ecr-precision-integration','assistant-markdown-integration','assistant-send-arrow-integration','registration-stage-i-integration','development-integration'].map(n=>'apps/sg-runtime/'+n+'.json')
 for(const p of receipts)sources.set(p,historical(MARKET_CALENDAR_PRODUCER_BASE,p))
 const old=(sha,p)=>sha===base?(p===MARKET_CALENDAR_PRODUCER_RECORD?current(p):historical(MARKET_CALENDAR_PRODUCER_BASE,p)):historical(sha,p)
 const a={schemaVersion:'1.0.0',taskId:'SG2-PROCUREMENT-MARKET-CALENDAR-20261111',targetEnvironment:'development',scope:'MARKET_CALENDAR_CONSUMER_SOURCE',previousSourceSha:base,producerRecordSha256:MARKET_CALENDAR_PRODUCER_RECORD_SHA,sourceDigests:Object.fromEntries(MARKET_CALENDAR_CONSUMER_PATHS.map(p=>[p,digest(sources.get(p))])),preservedReceipts:Object.fromEntries(receipts.map(p=>[p,digest(sources.get(p))])),noProviderAcquisition:true,noIndependentStore:true,noNotificationDelivery:true,activationIsSeparate:true}
 const read=(record=a)=>p=>p===MARKET_CALENDAR_CONSUMER_RECORD?Buffer.from(JSON.stringify(record)):sources.get(p)??current(p)
 const view=marketCalendarSourcePredecessor(read(),old);assert.equal(view.manifest.scope,'MARKET_CALENDAR_CONSUMER_SOURCE')
 assert.deepEqual(view.previousBytes(pkg),old(base,pkg));assert.throws(()=>view.previousBytes(MARKET_CALENDAR_CONSUMER_RECORD),{code:'ENOENT'})
 for(const p of [...MARKET_CALENDAR_CONSUMER_PATHS,...receipts,...MARKET_CALENDAR_PRODUCER_PATHS])assert.throws(()=>marketCalendarSourcePredecessor(f=>f===p?Buffer.concat([read()(f),Buffer.from('UNBOUND')]):read()(f),old),p)
 for(const mutate of [v=>v.noProviderAcquisition=false,v=>v.producerRecordSha256='0'.repeat(64),v=>v.sourceDigests['unbound.ts']='a'.repeat(64),v=>delete v.sourceDigests[pkg],v=>v.userId='other',v=>v.preservedReceipts={}]){const v=structuredClone(a);mutate(v);assert.throws(()=>marketCalendarSourcePredecessor(read(v),old))}
 const changed=JSON.parse(sources.get(pkg));changed.dependencies['unapproved-package']='1.0.0';sources.set(pkg,Buffer.from(JSON.stringify(changed)));const rebound=structuredClone(a);rebound.sourceDigests[pkg]=digest(sources.get(pkg));assert.throws(()=>marketCalendarSourcePredecessor(read(rebound),old),'rebound metadata cannot add a dependency')
})
