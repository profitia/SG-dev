import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repositoryRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..')

// Actual reviewed Git objects and the actual origin/main ledger, not a
// fabricated passing history. Deliberately corrupted readers below are
// negative-only; the existing physical BSDC/Calendar regression is unchanged.
import { editorialTrustedPredecessor, EDITORIAL_CANON_SOURCE_REVIEW, bsdcManifestContinuityTrustedCurrent, BSDC_MANIFEST_CONTINUITY } from './controlled-package-ci.mjs'

const acgCanonSource='be51c2d0cdfba0504197898db4c981197202e918'
const acgCanonPrevious='a03956b6752227a7a14e44887feabd50a0ad1054'
const acgCanonManifest='Canon/registries/governance-manifest-v2.json'
const acgCanonDocument='Canon/v1.0-acg-cic-phased-live-and-kys-risk-context-amendment.md'
const acgCanonLedger='Canon/registries/governance-manifest-successors-v1.json'
const acgCanonManifestHash='a9c3746dcad97acca504354c3a0a10d02409be65f28f435cb034d1ca5b8fd96d'
const acgCanonHistoryCache=new Map()
const acgCanonHistory=(sha,p)=>{
 const key=sha+':'+p
 if(!acgCanonHistoryCache.has(key))acgCanonHistoryCache.set(key,execFileSync('git',['cat-file','blob',key],{cwd:repositoryRoot,stdio:['ignore','pipe','pipe']}))
 return Buffer.from(acgCanonHistoryCache.get(key))
}
// Exercise Editorial's real immutable input boundary; full physical-source CI remains separate.
const acgEditorialRead=p=>acgCanonHistory(EDITORIAL_CANON_SOURCE_REVIEW.sourceSha,p)
const acgCanonRead=p=>p===acgCanonManifest||p===acgCanonDocument?acgCanonHistory(acgCanonSource,p):acgEditorialRead(p)
const changedAcgLedger=change=>{
 const ledger=JSON.parse(acgCanonHistory('refs/remotes/origin/main',acgCanonLedger))
 change(ledger)
 return Buffer.from(JSON.stringify(ledger))
}
const acgLedgerHistory=ledger=>(sha,p)=>sha==='refs/remotes/origin/main'&&p===acgCanonLedger?Buffer.from(ledger):acgCanonHistory(sha,p)

test('ACG exact admitted 3.53.0 preserves the authentic original Editorial predecessor',()=>{
 const baseline=editorialTrustedPredecessor(acgEditorialRead,acgCanonHistory)
 const accepted=editorialTrustedPredecessor(acgCanonRead,acgCanonHistory)
 assert(baseline);assert(accepted)
 assert.deepEqual(accepted.manifest,baseline.manifest)
 assert.deepEqual(accepted.previousBytes(acgCanonManifest),baseline.previousBytes(acgCanonManifest))
 for(const p of Object.keys(baseline.manifest.preservedReceipts??{}))assert.deepEqual(accepted.previousBytes(p),baseline.previousBytes(p),p)
})

test('ACG substituted frozen document is rejected before historical projection',()=>{
 assert.throws(()=>editorialTrustedPredecessor(p=>p===acgCanonDocument?Buffer.concat([acgCanonRead(p),Buffer.from('\nUNAPPROVED')]):acgCanonRead(p),acgCanonHistory),/MANIFEST_SUCCESSOR_DOCUMENT_BYTES_REJECTED/)
})

test('ACG changed manifest bytes and an arbitrary future version retain the original Editorial rejection',()=>{
 for(const mutate of [
  bytes=>Buffer.concat([bytes,Buffer.from('\n')]),
  bytes=>{const m=JSON.parse(bytes);m.manifestVersion='3.54.0';return Buffer.from(JSON.stringify(m))}
 ])assert.throws(()=>editorialTrustedPredecessor(p=>p===acgCanonManifest?mutate(acgCanonRead(p)):acgCanonRead(p),acgCanonHistory),/EDITORIAL_SOURCE_BYTES_REJECTED/)
})

test('ACG PR-local ledger cannot replace a missing trusted-main admission',()=>{
 const missing=changedAcgLedger(m=>m.successors=m.successors.filter(x=>x.manifestSha256!==acgCanonManifestHash))
 assert.throws(()=>editorialTrustedPredecessor(p=>p===acgCanonLedger?acgCanonHistory('refs/remotes/origin/main',p):acgCanonRead(p),acgLedgerHistory(missing)),/MANIFEST_SUCCESSOR_NOT_APPROVED_ON_MAIN/)
})

test('ACG an identical-tree source SHA rebound cannot inherit the exact owner-approved record',()=>{
 const rebound=changedAcgLedger(m=>m.successors.find(x=>x.manifestSha256===acgCanonManifestHash).sourceSha='c9de2488cca60b7bf2c8cb841a7e2586174f40f1')
 assert.throws(()=>editorialTrustedPredecessor(acgCanonRead,acgLedgerHistory(rebound)),/EDITORIAL_MANIFEST_SUCCESSOR_SCOPE_REJECTED/)
})

test('ACG a changed recorded document SHA is rejected by the existing admission checks',()=>{
 const changed=changedAcgLedger(m=>m.successors.find(x=>x.manifestSha256===acgCanonManifestHash).documentDigests[acgCanonDocument]='0'.repeat(64))
 assert.throws(()=>editorialTrustedPredecessor(acgCanonRead,acgLedgerHistory(changed)),/MANIFEST_SUCCESSOR_DOCUMENT_BYTES_REJECTED/)
})

test('ACG changed immutable successor or predecessor Git bytes are rejected',()=>{
 for(const target of [acgCanonSource,acgCanonPrevious]){
  const corrupted=(sha,p)=>sha===target&&p===acgCanonManifest?Buffer.concat([acgCanonHistory(sha,p),Buffer.from('\n')]):acgCanonHistory(sha,p)
  assert.throws(()=>editorialTrustedPredecessor(acgCanonRead,corrupted),/MANIFEST_SUCCESSOR_IMMUTABLE_BYTES_REJECTED/)
 }
})

test('ACG successful admission never bypasses the older Editorial source history',()=>{
 const cfg=EDITORIAL_CANON_SOURCE_REVIEW
 const target=cfg.projection.find(p=>cfg.entries[p].status==='modified')
 assert(target,'an actual immutable Editorial predecessor must be checked')
 const corrupted=(s,p)=>s===cfg.baseSha&&p===target?Buffer.concat([acgCanonHistory(s,p),Buffer.from('\n')]):acgCanonHistory(s,p)
 assert.throws(()=>editorialTrustedPredecessor(acgCanonRead,corrupted),/EDITORIAL_SOURCE_HISTORY_REJECTED/)
 const receipt=Object.keys(cfg.preservedReceipts).find(p=>!cfg.projection.includes(p))
 assert(receipt,'an actual preserved receipt must be checked')
 const changedReceipt=(s,p)=>s===cfg.baseSha&&p===receipt?Buffer.concat([acgCanonHistory(s,p),Buffer.from('\n')]):acgCanonHistory(s,p)
 assert.throws(()=>editorialTrustedPredecessor(acgCanonRead,changedReceipt),/EDITORIAL_SOURCE_RECEIPT_REJECTED/)
})


// The older BSDC/Calendar caller has already projected the physical test to
// its original pin. Keep those authentic bytes and the admitted helper while
// exercising the actual 3.52 Git manifest against today's 3.53 main authority.
const bsdcEditorialSource='1dc0c05e52e8f4b78779ec3d0e532975ed4fa354'
const bsdcAncestorRead=p=>p===BSDC_MANIFEST_CONTINUITY.helperPath?acgCanonHistory(acgCanonPrevious,p):acgCanonHistory(bsdcEditorialSource,p)
const bsdcAncestorView=history=>bsdcManifestContinuityTrustedCurrent(bsdcAncestorRead,history)

test('BSDC authentic 3.52 ancestor remains valid under the exact approved ACG 3.53 authority',()=>{
 const cfg=BSDC_MANIFEST_CONTINUITY
 const accepted=bsdcAncestorView(acgCanonHistory)
 for(const p of [cfg.manifestPath,cfg.helperPath,cfg.testPath])
  assert.deepEqual(accepted(p),acgCanonHistory(cfg.baseSha,p),p)
 for(const p of cfg.sourcePaths.filter(p=>p!==cfg.manifestPath))
  assert.deepEqual(accepted(p),bsdcAncestorRead(p),p)
 assert.throws(()=>accepted(cfg.recordPath),{code:'ENOENT'})
})

test('BSDC ancestor still requires both exact grants on trusted main, regardless of PR-local ledger',()=>{
 for(const hash of [acgCanonManifestHash,'d8ddddd7b39b6b67ed7e4ca2b4407a47a4470497465f790a67be301ea4dcccd8']){
  const missing=changedAcgLedger(m=>m.successors=m.successors.filter(x=>x.manifestSha256!==hash))
  const local=p=>p===acgCanonLedger?acgCanonHistory('refs/remotes/origin/main',p):bsdcAncestorRead(p)
  assert.throws(()=>bsdcManifestContinuityTrustedCurrent(local,acgLedgerHistory(missing)),/MANIFEST_SUCCESSOR_NOT_APPROVED_ON_MAIN/)
 }
})

test('BSDC ancestor rejects an identical-tree ACG grant rebound and changed admitted document digest',()=>{
 const rebound=changedAcgLedger(m=>m.successors.find(x=>x.manifestSha256===acgCanonManifestHash).sourceSha='c9de2488cca60b7bf2c8cb841a7e2586174f40f1')
 assert.throws(()=>bsdcAncestorView(acgLedgerHistory(rebound)),/EDITORIAL_MANIFEST_SUCCESSOR_SCOPE_REJECTED/)
 const changed=changedAcgLedger(m=>m.successors.find(x=>x.manifestSha256===acgCanonManifestHash).documentDigests[acgCanonDocument]='0'.repeat(64))
 assert.throws(()=>bsdcAncestorView(acgLedgerHistory(changed)),/MANIFEST_SUCCESSOR_DOCUMENT_BYTES_REJECTED/)
})

test('BSDC ancestor cannot project changed ACG authority document or immutable Git snapshots',()=>{
 for(const [ref,p] of [
  ['refs/remotes/origin/main',acgCanonDocument],
  [acgCanonSource,acgCanonManifest],
  [acgCanonPrevious,acgCanonManifest],
  [bsdcEditorialSource,acgCanonManifest]
 ]){
  const corrupt=(sha,file)=>sha===ref&&file===p?Buffer.concat([acgCanonHistory(sha,file),Buffer.from('\nUNAPPROVED')]):acgCanonHistory(sha,file)
  assert.throws(()=>bsdcAncestorView(corrupt),/MANIFEST_SUCCESSOR_(DOCUMENT_BYTES|IMMUTABLE_BYTES)_REJECTED/)
 }
})

test('BSDC ancestor never inherits admission from unknown future main authority',()=>{
 const future=(sha,p)=>{
  const bytes=acgCanonHistory(sha,p)
  if(sha!=='refs/remotes/origin/main'||p!==acgCanonManifest)return bytes
  const manifest=JSON.parse(bytes);manifest.manifestVersion='3.54.0'
  return Buffer.from(JSON.stringify(manifest))
 }
 assert.throws(()=>bsdcAncestorView(future),/MANIFEST_SUCCESSOR_AUTHORITY_BASE_REJECTED/)
})

test('BSDC ancestor continues rejecting changed original receipt, helper, test and approved documentation',()=>{
 const cfg=BSDC_MANIFEST_CONTINUITY
 for(const target of new Set([cfg.recordPath,cfg.helperPath,cfg.testPath,...cfg.sourcePaths])){
  const corrupt=p=>p===target?Buffer.concat([bsdcAncestorRead(p),Buffer.from('\nUNAPPROVED')]):bsdcAncestorRead(p)
  assert.throws(()=>bsdcManifestContinuityTrustedCurrent(corrupt,acgCanonHistory),target)
 }
})
