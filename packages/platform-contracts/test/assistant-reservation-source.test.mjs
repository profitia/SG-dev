import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import {assistantReservationPredecessor,RESERVATION_BASE,RESERVATION_RECORD,RESERVATION_PATHS,RESERVATION_RECEIPTS,RESERVATION_SG2_PATHS,RESERVATION_DERIVED} from './assistant-reservation-source.mjs'
const root=fileURLToPath(new URL('../../../',import.meta.url)),peer=process.env.ACG_SOURCE_PEER_ROOT??root
const current=p=>fs.readFileSync(path.join(RESERVATION_SG2_PATHS.includes(p)?peer:root,p))
const historical=(sha,p)=>execFileSync('git',['show',sha+':'+p],{cwd:root,stdio:['ignore','pipe','pipe']})
const pin=()=>String(current(RESERVATION_DERIVED)).match(/ASSISTANT_RESERVATION_SOURCE_SHA='([a-f0-9]{64})'/)?.[1]
test('exact reservation source closes both owners and preserves every accepted receipt before predecessor projection',()=>{
 const result=assistantReservationPredecessor(current,historical,pin());assert(result)
 assert.equal(result.manifest.outputTokens,2048);assert.equal(result.manifest.sql006Installed,false)
 for(const p of RESERVATION_RECEIPTS)assert.deepEqual(result.previousBytes(p),historical(RESERVATION_BASE,p))
 for(const p of RESERVATION_PATHS.filter(p=>!p.endsWith('assistant-reservation-source.mjs')&&!p.endsWith('assistant-reservation-source.test.mjs')&&!p.endsWith('006-assistant-reservation-diagnostics.sql')))assert.deepEqual(result.previousBytes(p),historical(RESERVATION_BASE,p))
 assert.throws(()=>result.previousBytes(RESERVATION_RECORD),{code:'ENOENT'})
})
test('every changed producer, consumer, SQL, helper and derived source byte is authenticated before projection',()=>{
 for(const p of [...RESERVATION_PATHS,RESERVATION_DERIVED,RESERVATION_RECORD])assert.throws(()=>assistantReservationPredecessor(f=>f===p?Buffer.concat([current(f),Buffer.from('tamper')]):current(f),historical,pin()),p)
})
test('earlier receipts and historical source may not be rewritten, omitted or replaced by a new pin',()=>{
 for(const p of RESERVATION_RECEIPTS)assert.throws(()=>assistantReservationPredecessor(f=>f===p?Buffer.concat([current(f),Buffer.from('tamper')]):current(f),historical,pin()),p)
 assert.throws(()=>assistantReservationPredecessor(current,(sha,p)=>Buffer.concat([historical(sha,p),Buffer.from('tamper')]),pin()))
 assert.throws(()=>assistantReservationPredecessor(current,historical,'0'.repeat(64)))
})
test('missing record is unadopted while unreadable or malformed present records fail closed',()=>{
 assert.equal(assistantReservationPredecessor(p=>{if(p===RESERVATION_RECORD)throw Object.assign(Error('absent'),{code:'ENOENT'});return current(p)},historical,pin()),null)
 assert.throws(()=>assistantReservationPredecessor(p=>{if(p===RESERVATION_RECORD)throw Object.assign(Error('denied'),{code:'EACCES'});return current(p)},historical,pin()))
 assert.throws(()=>assistantReservationPredecessor(p=>p===RESERVATION_RECORD?Buffer.from('{}'):current(p),historical,pin()))
})
