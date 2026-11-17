import {sdkContinuationPredecessor} from '../../../packages/platform-contracts/test/organisation-sdk-compatibility.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {assistantSendArrowPredecessor,SEND_ARROW_RECEIPT,SEND_ARROW_BASE,SEND_ARROW_VIEW,SEND_ARROW_PATHS,SEND_ARROW_PRESERVED_RECEIPTS} from './assistant-send-arrow-integrity.mjs'
import {registrationStageOnePredecessor} from './registration-stage-i-integrity.mjs'
import {assistantMarkdownPredecessor} from './assistant-markdown-integrity.mjs'
import {assistantM2Predecessor} from './assistant-m2-integrity.mjs'
import {assistantEcrPredecessor} from './assistant-ecr-integrity.mjs'
const current=p=>fs.readFileSync(new URL('../../../'+p,import.meta.url))
const blobs=new Map()
const historical=(sha,p)=>{const k=sha+':'+p;if(!blobs.has(k))blobs.set(k,execFileSync('git',['show',k],{stdio:['ignore','pipe','pipe']}));return blobs.get(k)}
const hash=b=>createHash('sha256').update(b).digest('hex')
const manifest=()=>JSON.parse(current(SEND_ARROW_RECEIPT))
const readerWithManifest=(a,read=current)=>p=>p===SEND_ARROW_RECEIPT?Buffer.from(JSON.stringify(a)):read(p)
test('canonical send-arrow source retains registration, Markdown and all earlier accepted predecessors',()=>{
 const a=assistantSendArrowPredecessor(current,historical)
 assert.equal(a.manifest.scope,'CANONICAL_SEND_ARROW')
 assert.deepEqual(a.previousBytes(SEND_ARROW_VIEW),historical(SEND_ARROW_BASE,SEND_ARROW_VIEW))
 for(const p of SEND_ARROW_PRESERVED_RECEIPTS)assert.deepEqual(a.previousBytes(p),historical(SEND_ARROW_BASE,p))
 assert.throws(()=>a.previousBytes(SEND_ARROW_RECEIPT),e=>e.code==='ENOENT')
 assert.equal(assistantSendArrowPredecessor(a.previousBytes,historical),null)
 assert(registrationStageOnePredecessor(current,historical))
 assert(assistantMarkdownPredecessor(current,historical))
 assert(assistantM2Predecessor(current,historical))
})
test('send-arrow source rejects amended files, rewritten receipts, expanded scope and a rebound noncanonical view',()=>{
 for(const p of [...SEND_ARROW_PATHS,...SEND_ARROW_PRESERVED_RECEIPTS])assert.throws(()=>assistantSendArrowPredecessor(f=>f===p?Buffer.concat([current(f),Buffer.from('tamper')]):current(f),historical),p)
 for(const change of [a=>a.previousSourceSha='0'.repeat(40),a=>a.authorisationChanged=true,a=>a.scope='ALL_UI',a=>a.sourceDigests['apps/sg-runtime/unapproved.ts']='0'.repeat(64),a=>delete a.sourceDigests[SEND_ARROW_VIEW],a=>a.previousReceipts[SEND_ARROW_PRESERVED_RECEIPTS[0]]='0'.repeat(64),a=>a.unknown=true]){
  const a=manifest();change(a);assert.throws(()=>assistantSendArrowPredecessor(readerWithManifest(a),historical))
 }
 const sdk=sdkContinuationPredecessor(JSON.parse(current('apps/sg-runtime/operation-integration.json')),current,historical)
 const sdkCurrent=sdk?sdk.previousBytes:current
 const arrowCurrent=assistantEcrPredecessor(sdkCurrent,historical)?.previousBytes??sdkCurrent
 const changed=Buffer.from(arrowCurrent(SEND_ARROW_VIEW).toString().replace('m5 12 7-7 7 7M12 5v14','M0 0'))
 const a=JSON.parse(arrowCurrent(SEND_ARROW_RECEIPT));a.sourceDigests[SEND_ARROW_VIEW]=hash(changed)
 // Exercise the immutable canonical-icon rule inside both verified outer layers.
 assert.throws(()=>assistantSendArrowPredecessor(readerWithManifest(a,p=>p===SEND_ARROW_VIEW?changed:arrowCurrent(p)),historical),/only the canonical send icon/)
 // Current-view rebinding is rejected before any predecessor is exposed.
 if(sdk)assert.throws(()=>assistantSendArrowPredecessor(readerWithManifest(a,p=>p===SEND_ARROW_VIEW?changed:current(p)),historical),/(?:preserved source|current composed registration\/PI source) apps\/sg-runtime\/assistant-send-arrow-integration\.json/)
})
test('only an absent continuation may be skipped; unknown current and historical read errors remain fatal',()=>{
 assert.equal(assistantSendArrowPredecessor(p=>historical(SEND_ARROW_BASE,p),historical),null)
 const denied=Object.assign(Error('opaque read denial'),{code:'EACCES'})
 assert.throws(()=>assistantSendArrowPredecessor(()=>{throw denied},historical),e=>e===denied)
 assert.throws(()=>assistantSendArrowPredecessor(current,()=>{throw denied}),e=>e===denied)
 const unrelated=Object.assign(Error('unrelated path'),{status:128,stderr:"fatal: path 'another-file' exists on disk, but not in 'source'"})
 assert.throws(()=>assistantSendArrowPredecessor(()=>{throw unrelated},historical),e=>e===unrelated)
})
