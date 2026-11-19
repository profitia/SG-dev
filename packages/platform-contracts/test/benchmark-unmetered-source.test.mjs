import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {sdkSourceContext} from './sdk-source-context.mjs'
import {benchmarkUnmeteredPredecessor,BENCHMARK_BASE,BENCHMARK_RECORD,BENCHMARK_DERIVED,BENCHMARK_PATHS,BENCHMARK_RECEIPTS} from './benchmark-unmetered-source.mjs'
const root=fileURLToPath(new URL('../../../',import.meta.url)),physical=p=>fs.readFileSync(path.join(root,p)),historical=(sha,p)=>execFileSync('git',['show',sha+':'+p],{cwd:root,maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']})
const currentContext=sdkSourceContext(physical,historical),current=currentContext?.baseline('benchmark')??physical,pin=()=>String(current(BENCHMARK_DERIVED)).match(/BENCHMARK_UNMETERED_SOURCE_SHA='([a-f0-9]{64})'/)?.[1]
test('benchmark successor authenticates its complete producer source before preserving the accepted predecessor',()=>{const b=benchmarkUnmeteredPredecessor(current,historical,pin());assert(b);for(const p of Object.keys(b.manifest.predecessorDigests))assert.deepEqual(b.previousBytes(p),historical(BENCHMARK_BASE,p));for(const p of BENCHMARK_RECEIPTS)assert.deepEqual(b.previousBytes(p),current(p));assert.throws(()=>b.previousBytes(BENCHMARK_RECORD),{code:'ENOENT'})})
test('every changed contract, SQL, integration test, source record, derived guard and old receipt rejects byte drift',()=>{for(const p of [...BENCHMARK_PATHS,BENCHMARK_RECORD,BENCHMARK_DERIVED,...BENCHMARK_RECEIPTS])assert.throws(()=>benchmarkUnmeteredPredecessor(f=>f===p?Buffer.concat([current(f),Buffer.from('tamper')]):current(f),historical,pin()),p);assert.throws(()=>benchmarkUnmeteredPredecessor(current,(sha,p)=>Buffer.concat([historical(sha,p),Buffer.from('tamper')]),pin()));assert.throws(()=>benchmarkUnmeteredPredecessor(current,historical,'0'.repeat(64)))})
test('missing source record is unadopted; unreadable, incomplete and malformed source fail closed',()=>{assert.equal(benchmarkUnmeteredPredecessor(p=>{if(p===BENCHMARK_RECORD)throw Object.assign(Error('absent'),{code:'ENOENT'});return current(p)},historical,pin()),null);assert.throws(()=>benchmarkUnmeteredPredecessor(p=>{if(p===BENCHMARK_RECORD)throw Object.assign(Error('denied'),{code:'EACCES'});return current(p)},historical,pin()));assert.throws(()=>benchmarkUnmeteredPredecessor(p=>p===BENCHMARK_RECORD?Buffer.from('{}'):current(p),historical,pin()))})

test('legacy test copies project the complete benchmark and reservation layers before old readers run',async()=>{
 const {createAcgLegacyRecurringFixture}=await import('./assistant-reservation-source.mjs')
 const f=await createAcgLegacyRecurringFixture(root,currentContext?{baselineSha:currentContext.record.baselines.benchmark.sha}:{})
 try{assert(f.projected);assert.equal(fs.existsSync(path.join(f.root,BENCHMARK_RECORD)),false);for(const p of ['packages/platform-contracts/migrations/access/034-unmetered-benchmark-requests.sql','packages/platform-contracts/migrations/access/035-source-technical-continuity.sql','packages/platform-contracts/test/benchmark-unmetered-source.mjs','packages/platform-contracts/test/benchmark-unmetered-source.test.mjs'])assert.equal(fs.existsSync(path.join(f.root,p)),false,p);for(const p of ['packages/platform-contracts/src/operation-context.mjs','packages/platform-contracts/src/request-ledger.mjs','packages/platform-contracts/src/platform-ingestion.mjs','packages/platform-contracts/src/external-call.mjs'])assert.deepEqual(fs.readFileSync(path.join(f.root,p)),historical(BENCHMARK_BASE,p),p)}finally{f.close()}
})

test('the current filesystem SDK view retains the immutable manifest and exposes every reviewed successor digest',async()=>{const {recurringSourceFilesystem}=await import('../../../apps/architecture-lab/private-recurring-source.mjs');const {createAcgLegacyRecurringFixture}=await import('./assistant-reservation-source.mjs');const fixture=currentContext?await createAcgLegacyRecurringFixture(root,{baselineSha:currentContext.record.baselines.benchmark.sha}):null;try{const view=recurringSourceFilesystem(fixture?.acceptedRoot??root),record=JSON.parse(current(BENCHMARK_RECORD));assert.equal(view.manifest.scope,'CURRENT_ACCEPTED_SDK_SOURCE_VIEW');assert.equal(view.acceptedManifest.scope,'PRIVATE_RECURRING_SOURCE_ACCEPTANCE');assert.equal(view.manifest.platformVersion,view.acceptedManifest.platformVersion);for(const [key,digest]of Object.entries(record.sdkDigests))assert.equal(view.manifest.sdkDigests[key],digest,key);for(const [p,digest]of Object.entries(record.sourceDigests))assert.equal(view.manifest.sourceDigests[p],digest,p);assert.deepEqual(view.acceptedManifest,JSON.parse(current('apps/architecture-lab/private-recurring-source.json')));for(const p of BENCHMARK_RECEIPTS)assert.equal((await import('node:crypto')).createHash('sha256').update(current(p)).digest('hex'),record.preservedReceipts[p],p)}finally{fixture?.close()}})

test('the separately owned exact Finder input is verified before its old application files can be read',()=>{const a=JSON.parse(current(BENCHMARK_RECORD)),files=Object.keys(a.consumerInput.sourceDigests),read=p=>files.includes(p)?historical(a.consumerInput.sourceSha,p):current(p);const b=benchmarkUnmeteredPredecessor(read,historical,pin());assert.deepEqual(b.consumerSourceDigests,a.consumerInput.sourceDigests);for(const p of files){if(p in a.consumerInput.predecessorDigests)assert.deepEqual(b.previousBytes(p),historical(BENCHMARK_BASE,p));else assert.throws(()=>b.previousBytes(p),{code:'ENOENT'});assert.throws(()=>benchmarkUnmeteredPredecessor(f=>f===p?Buffer.concat([read(f),Buffer.from('tamper')]):read(f),historical,pin()),p)}})

test('direct and filesystem source views expose current SDK files and the exact newly reviewed boundary inventory',async()=>{const {recurringSourcePredecessor}=await import('../../../apps/architecture-lab/private-recurring-source.mjs');const a=JSON.parse(current(BENCHMARK_RECORD)),files=Object.keys(a.consumerInput.sourceDigests),read=p=>files.includes(p)?historical(a.consumerInput.sourceSha,p):current(p),view=recurringSourcePredecessor(read,historical);assert(view.acceptedManifest);assert.equal(view.manifest.sdkDigests.platformIngestionSourceDigest,a.sdkDigests.platformIngestionSourceDigest);for(const p of files)assert.equal(view.manifest.sourceDigests[p],a.consumerInput.sourceDigests[p],p);assert(view.manifest.addedPaths.includes('apps/sg-runtime/lib/benchmark/discovery-continuity.ts'));assert.throws(()=>view.previousBytes('apps/sg-runtime/lib/benchmark/discovery-continuity.ts'),{code:'ENOENT'})})


test('adopted SDK authenticates every current Finder byte before its complete immutable Finder frame',()=>{
 if(!currentContext)return
 const view=benchmarkUnmeteredPredecessor(physical,historical,pin());assert(view.currentSdkContext)
 assert.deepEqual(view.manifest,JSON.parse(current(BENCHMARK_RECORD)))
 const consumer=JSON.parse(current(BENCHMARK_RECORD)).consumerInput
 for(const p of [...BENCHMARK_PATHS,BENCHMARK_RECORD,BENCHMARK_DERIVED,...Object.keys(consumer.sourceDigests)]){
  assert.equal(view.currentSourceDigests[p],(createHash('sha256').update(physical(p)).digest('hex')),p)
  assert.throws(()=>benchmarkUnmeteredPredecessor(f=>f===p?Buffer.concat([physical(f),Buffer.from('tamper')]):physical(f),historical,pin()),p)
 }
 assert.throws(()=>benchmarkUnmeteredPredecessor(p=>{if(p===BENCHMARK_RECORD)throw Object.assign(Error('absent'),{code:'ENOENT'});return physical(p)},historical,pin()))
 assert.throws(()=>benchmarkUnmeteredPredecessor(physical,historical,'0'.repeat(64)))
 for(const p of Object.keys(consumer.sourceDigests))assert.throws(()=>benchmarkUnmeteredPredecessor(physical,(sha,f)=>sha===consumer.sourceSha&&f===p?Buffer.concat([historical(sha,f),Buffer.from('forged consumer history')]):historical(sha,f),pin()),/immutable reviewed Finder consumer/,p)
})
