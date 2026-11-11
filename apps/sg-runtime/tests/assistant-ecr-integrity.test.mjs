import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {assistantEcrPredecessor,ECR_RECEIPT,ECR_BASE,ECR_PATHS,ECR_ADDITIONS,ECR_PRESERVED_RECEIPTS} from './assistant-ecr-integrity.mjs'
import {assistantSendArrowPredecessor} from './assistant-send-arrow-integrity.mjs'
import {assistantM2Predecessor} from './assistant-m2-integrity.mjs'
const current=p=>fs.readFileSync(new URL('../../../'+p,import.meta.url))
const blobs=new Map()
const historical=(sha,p)=>{const key=sha+':'+p;if(!blobs.has(key))blobs.set(key,execFileSync('git',['show',key],{stdio:['ignore','pipe','pipe']}));return blobs.get(key)}
const hash=b=>createHash('sha256').update(b).digest('hex')
const manifest=()=>JSON.parse(current(ECR_RECEIPT))
const withManifest=(a,read=current)=>p=>p===ECR_RECEIPT?Buffer.from(JSON.stringify(a)):read(p)
test('ECR closes its producer and consumer source graph while retaining every earlier receipt and predecessor',()=>{
 const ecr=assistantEcrPredecessor(current,historical)
 assert.equal(ecr.manifest.scope,'OPTIONAL_ECR_CONTEXT_SOURCE')
 for(const p of ECR_PRESERVED_RECEIPTS)assert.deepEqual(current(p),historical(ECR_BASE,p))
 for(const p of ECR_PATHS.filter(p=>!ECR_ADDITIONS.includes(p)))assert.deepEqual(ecr.previousBytes(p),historical(ECR_BASE,p))
 for(const p of [...ECR_ADDITIONS,ECR_RECEIPT])assert.throws(()=>ecr.previousBytes(p),e=>e.code==='ENOENT')
 assert.equal(assistantEcrPredecessor(ecr.previousBytes,historical),null)
 assert(assistantSendArrowPredecessor(current,historical));assert(assistantM2Predecessor(current,historical))
})
test('ECR rejects changed current source, rewritten old receipts, unbound files and inaccurate authority or publication claims',()=>{
 for(const p of [...ECR_PATHS,...ECR_PRESERVED_RECEIPTS])assert.throws(()=>assistantEcrPredecessor(f=>f===p?Buffer.concat([current(f),Buffer.from('tamper')]):current(f),historical),p)
 for(const mutate of [a=>a.previousSourceSha='0'.repeat(40),a=>a.authorisationChanged=true,a=>a.schemaChanged=true,
  a=>a.providerAcquisitionAdded=true,a=>a.deploymentPerformed=true,a=>a.scope='ALL_SOURCES',a=>a.cicPublication.version='9.0.0',
  a=>a.cicPublication.sourceSha='0'.repeat(40),a=>delete a.sourceDigests[ECR_PATHS[0]],
  a=>a.sourceDigests['apps/sg-runtime/unapproved.ts']='0'.repeat(64),
  a=>a.previousReceipts[ECR_PRESERVED_RECEIPTS[0]]='0'.repeat(64),a=>a.extra=true]){
  const a=manifest();mutate(a);assert.throws(()=>assistantEcrPredecessor(withManifest(a),historical))
 }
})
test('rebinding source hashes cannot widen package scripts, private dependencies or the published CIC artifact',()=>{
 for(const [p,mutate]of [
  ['apps/sg-runtime/package.json',a=>a.scripts['test:assistant']='echo skipped'],
  ['apps/sg-runtime/package.json',a=>a.dependencies['@profitia/cic-core']='^1.6.0'],
  ['apps/sg-runtime/package.json',a=>a.dependencies['@profitia/cic-procurement']='99.0.0'],
  ['apps/sg-runtime/package-lock.json',a=>a.packages['node_modules/@profitia/cic-core'].integrity='sha512-forged'],
  ['apps/sg-runtime/package-lock.json',a=>a.packages['node_modules/@profitia/cic-core'].resolved='https://foreign.fixture.test/package.tgz'],
  ['apps/sg-runtime/package-lock.json',a=>a.packages['node_modules/@profitia/cic-core'].resolved=a.packages['node_modules/@profitia/cic-core'].resolved.replace(/\/[a-f0-9]{40}$/, '/'+'a'.repeat(40))],
  ['apps/sg-runtime/package-lock.json',a=>a.packages['node_modules/@profitia/advisory-widget'].version='99.0.0'],
 ]){
  const data=JSON.parse(current(p));mutate(data);const bytes=Buffer.from(JSON.stringify(data)),a=manifest();a.sourceDigests[p]=hash(bytes)
  assert.throws(()=>assistantEcrPredecessor(withManifest(a,f=>f===p?bytes:current(f)),historical),p)
 }
})
test('only genuinely absent ECR is optional; permission, unrelated Git and historical read failures remain fatal',()=>{
 assert.equal(assistantEcrPredecessor(p=>historical(ECR_BASE,p),historical),null)
 const denied=Object.assign(Error('opaque read denial'),{code:'EACCES'})
 assert.throws(()=>assistantEcrPredecessor(()=>{throw denied},historical),e=>e===denied)
 assert.throws(()=>assistantEcrPredecessor(current,()=>{throw denied}),e=>e===denied)
 const unrelated=Object.assign(Error('unrelated path'),{status:128,stderr:"fatal: path 'another-file' exists on disk, but not in 'source'"})
 assert.throws(()=>assistantEcrPredecessor(()=>{throw unrelated},historical),e=>e===unrelated)
})

import {assistantEcrPrecisionPredecessor,PRECISION_RECEIPT,PRECISION_BASE,PRECISION_PATHS,PRECISION_RECEIPTS} from './assistant-ecr-precision-integrity.mjs'
test('native ECR precision continuation retains the exact accepted ECR receipt and all earlier sources',()=>{
 const correction=assistantEcrPrecisionPredecessor(current,historical)
 assert.equal(correction.manifest.scope,'NATIVE_ECR_SCHEDULE_PRECISION')
 for(const p of PRECISION_RECEIPTS)assert.deepEqual(current(p),historical(PRECISION_BASE,p))
 for(const p of PRECISION_PATHS.filter(p=>!p.endsWith('assistant-ecr-precision-integrity.mjs')))assert.deepEqual(correction.previousBytes(p),historical(PRECISION_BASE,p))
 assert.equal(assistantEcrPrecisionPredecessor(correction.previousBytes,historical),null)
 assert(assistantEcrPredecessor(current,historical));assert(assistantSendArrowPredecessor(current,historical));assert(assistantM2Predecessor(current,historical))
 for(const p of [...PRECISION_PATHS,...PRECISION_RECEIPTS])assert.throws(()=>assistantEcrPrecisionPredecessor(f=>f===p?Buffer.concat([current(f),Buffer.from('tamper')]):current(f),historical),p)
})
test('ECR precision continuation cannot widen authority, hide missing sources or suppress a read failure',()=>{
 const manifest=JSON.parse(current(PRECISION_RECEIPT))
 for(const change of [a=>a.authorisationChanged=true,a=>a.modelChanged=true,a=>a.previousSourceSha='0'.repeat(40),
  a=>a.scope='ALL_CONTEXT',a=>delete a.sourceDigests[PRECISION_PATHS[0]],a=>a.sourceDigests['unbound']='0'.repeat(64),a=>a.extra=true]){
  const a=structuredClone(manifest);change(a)
  assert.throws(()=>assistantEcrPrecisionPredecessor(p=>p===PRECISION_RECEIPT?Buffer.from(JSON.stringify(a)):current(p),historical))
 }
 const denied=Object.assign(Error('opaque denial'),{code:'EACCES'})
 assert.throws(()=>assistantEcrPrecisionPredecessor(()=>{throw denied},historical),e=>e===denied)
 assert.throws(()=>assistantEcrPrecisionPredecessor(current,()=>{throw denied}),e=>e===denied)
 const scope='apps/sg-runtime/tests/pci-smart-integrity.test.mjs',changed=Buffer.from(current(scope).toString().replace('assertSourceCoverage(changed,','void(changed,'))
 const rebound=structuredClone(manifest);rebound.sourceDigests[scope]=hash(changed)
 assert.throws(()=>assistantEcrPrecisionPredecessor(p=>p===PRECISION_RECEIPT?Buffer.from(JSON.stringify(rebound)):p===scope?changed:current(p),historical),'a rebound digest cannot suppress candidate coverage')
 assert.equal(assistantEcrPrecisionPredecessor(p=>historical(PRECISION_BASE,p),historical),null)
})
