import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {procurementInsightsEditorialPredecessor,EDITORIAL_RECEIPT,EDITORIAL_BASE,EDITORIAL_PATHS} from './procurement-insights-editorial-integrity.mjs'
import {assistantM2Predecessor,oilReportSerializationPredecessor} from './assistant-m2-integrity.mjs'
const root=new URL('../../../',import.meta.url),current=p=>fs.readFileSync(new URL(p,root))
const blobs=new Map(),historical=(sha,p)=>{const key=sha+':'+p;if(!blobs.has(key))blobs.set(key,execFileSync('git',['show',key],{cwd:root,stdio:['ignore','pipe','pipe']}));return blobs.get(key)}
const hash=b=>createHash('sha256').update(b).digest('hex')
const manifest=()=>JSON.parse(current(EDITORIAL_RECEIPT))
const withManifest=(a,read=current)=>p=>p===EDITORIAL_RECEIPT?Buffer.from(JSON.stringify(a)):read(p)
test('editorial source continuation authenticates the new profile and retains all prior report/assistant acceptance',()=>{
 const view=procurementInsightsEditorialPredecessor(current,historical);assert(view)
 for(const p of Object.keys(view.manifest.preservedReceipts))assert.deepEqual(current(p),historical(EDITORIAL_BASE,p))
 assert.deepEqual(view.previousBytes('apps/insights-runtime/src/composer.mjs'),historical(EDITORIAL_BASE,'apps/insights-runtime/src/composer.mjs'))
 assert.equal(procurementInsightsEditorialPredecessor(view.previousBytes,historical),null)
 for(const p of [EDITORIAL_RECEIPT,'apps/insights-runtime/src/editorial.mjs','apps/sg-runtime/tests/procurement-insights-editorial-integrity.mjs'])assert.throws(()=>view.previousBytes(p),e=>e.code==='ENOENT')
 // Existing assertions run on the authenticated historical view. This is not
 // a replay or regeneration of a historical report.
 assert(oilReportSerializationPredecessor(current,historical))
 assert(assistantM2Predecessor(current,historical))
})
test('editorial continuation rejects changed source, rewritten historical receipts and widened authority',()=>{
 for(const p of [...EDITORIAL_PATHS,...Object.keys(manifest().preservedReceipts)])assert.throws(()=>procurementInsightsEditorialPredecessor(f=>f===p?Buffer.concat([current(f),Buffer.from('tamper')]):current(f),historical),p)
 for(const mutate of [a=>a.authorisationChanged=true,a=>a.schemaChanged=true,a=>a.modelChanged=true,a=>a.providerCallsPerformed=true,
  a=>a.historicalReportsChanged=true,a=>a.automaticPublication=true,a=>a.previousSourceSha='0'.repeat(40),a=>a.canonSha256='0'.repeat(64),
  a=>delete a.sourceDigests[EDITORIAL_PATHS[0]],a=>a.sourceDigests['apps/srm/unapproved.ts']='0'.repeat(64),
  a=>delete a.preservedReceipts[Object.keys(a.preservedReceipts)[0]],a=>a.extra=true]){
  const a=manifest();mutate(a);assert.throws(()=>procurementInsightsEditorialPredecessor(withManifest(a),historical))
 }
})
test('matching replacement hashes cannot admit a different Composer, skipped regression or altered continuation',()=>{
 for(const p of ['apps/insights-runtime/src/composer.mjs','apps/insights-runtime/src/editorial.mjs',
  'apps/sg-runtime/tests/assistant-notifications-integrity.mjs','apps/sg-runtime/tests/assistant-notifications-integrity.test.mjs']){
  const bytes=Buffer.concat([current(p),Buffer.from('\n// unreviewed replacement\n')]),a=manifest();a.sourceDigests[p]=hash(bytes)
  assert.throws(()=>procurementInsightsEditorialPredecessor(withManifest(a,f=>f===p?bytes:current(f)),historical),p)
 }
})
test('only absent editorial adoption is optional; source and historical read failures are fatal',()=>{
 assert.equal(procurementInsightsEditorialPredecessor(p=>historical(EDITORIAL_BASE,p),historical),null)
 const denied=Object.assign(Error('opaque denial'),{code:'EACCES'})
 assert.throws(()=>procurementInsightsEditorialPredecessor(()=>{throw denied},historical),e=>e===denied)
 assert.throws(()=>procurementInsightsEditorialPredecessor(current,()=>{throw denied}),e=>e===denied)
 const unrelated=Object.assign(Error('unrelated Git error'),{status:128,stderr:"fatal: path 'another-file' does not exist in 'source'"})
 assert.throws(()=>procurementInsightsEditorialPredecessor(()=>{throw unrelated},historical),e=>e===unrelated)
})
