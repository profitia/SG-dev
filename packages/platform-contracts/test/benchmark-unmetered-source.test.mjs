import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import {benchmarkUnmeteredPredecessor,BENCHMARK_BASE,BENCHMARK_RECORD,BENCHMARK_DERIVED,BENCHMARK_PATHS,BENCHMARK_RECEIPTS} from './benchmark-unmetered-source.mjs'
const root=fileURLToPath(new URL('../../../',import.meta.url)),current=p=>fs.readFileSync(path.join(root,p)),historical=(sha,p)=>execFileSync('git',['show',sha+':'+p],{cwd:root,stdio:['ignore','pipe','pipe']}),pin=()=>String(current(BENCHMARK_DERIVED)).match(/BENCHMARK_UNMETERED_SOURCE_SHA='([a-f0-9]{64})'/)?.[1]
test('benchmark successor authenticates its complete producer source before preserving the accepted predecessor',()=>{const b=benchmarkUnmeteredPredecessor(current,historical,pin());assert(b);for(const p of Object.keys(b.manifest.predecessorDigests))assert.deepEqual(b.previousBytes(p),historical(BENCHMARK_BASE,p));for(const p of BENCHMARK_RECEIPTS)assert.deepEqual(b.previousBytes(p),current(p));assert.throws(()=>b.previousBytes(BENCHMARK_RECORD),{code:'ENOENT'})})
test('every changed contract, SQL, integration test, source record, derived guard and old receipt rejects byte drift',()=>{for(const p of [...BENCHMARK_PATHS,BENCHMARK_RECORD,BENCHMARK_DERIVED,...BENCHMARK_RECEIPTS])assert.throws(()=>benchmarkUnmeteredPredecessor(f=>f===p?Buffer.concat([current(f),Buffer.from('tamper')]):current(f),historical,pin()),p);assert.throws(()=>benchmarkUnmeteredPredecessor(current,(sha,p)=>Buffer.concat([historical(sha,p),Buffer.from('tamper')]),pin()));assert.throws(()=>benchmarkUnmeteredPredecessor(current,historical,'0'.repeat(64)))})
test('missing source record is unadopted; unreadable, incomplete and malformed source fail closed',()=>{assert.equal(benchmarkUnmeteredPredecessor(p=>{if(p===BENCHMARK_RECORD)throw Object.assign(Error('absent'),{code:'ENOENT'});return current(p)},historical,pin()),null);assert.throws(()=>benchmarkUnmeteredPredecessor(p=>{if(p===BENCHMARK_RECORD)throw Object.assign(Error('denied'),{code:'EACCES'});return current(p)},historical,pin()));assert.throws(()=>benchmarkUnmeteredPredecessor(p=>p===BENCHMARK_RECORD?Buffer.from('{}'):current(p),historical,pin()))})

test('legacy test copies project the complete benchmark and reservation layers before old readers run',async()=>{
 const {createAcgLegacyRecurringFixture}=await import('./assistant-reservation-source.mjs')
 const f=await createAcgLegacyRecurringFixture(root)
 try{assert(f.projected);assert.equal(fs.existsSync(path.join(f.root,BENCHMARK_RECORD)),false);for(const p of ['packages/platform-contracts/migrations/access/034-unmetered-benchmark-requests.sql','packages/platform-contracts/migrations/access/035-source-technical-continuity.sql','packages/platform-contracts/test/benchmark-unmetered-source.mjs','packages/platform-contracts/test/benchmark-unmetered-source.test.mjs'])assert.equal(fs.existsSync(path.join(f.root,p)),false,p);for(const p of ['packages/platform-contracts/src/operation-context.mjs','packages/platform-contracts/src/request-ledger.mjs','packages/platform-contracts/src/platform-ingestion.mjs','packages/platform-contracts/src/external-call.mjs'])assert.deepEqual(fs.readFileSync(path.join(f.root,p)),historical(BENCHMARK_BASE,p),p)}finally{f.close()}
})
