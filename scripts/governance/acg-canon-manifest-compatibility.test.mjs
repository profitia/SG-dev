import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { createAcgLegacyRecurringFixture } from '../../packages/platform-contracts/test/assistant-reservation-source.mjs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repositoryRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..')

// Actual reviewed Git objects and the actual origin/main ledger, not a
// fabricated passing history. Deliberately corrupted readers below are
// negative-only; the existing physical BSDC/Calendar regression is unchanged.
import { editorialTrustedPredecessor, EDITORIAL_CANON_SOURCE_REVIEW, bsdcManifestContinuityTrustedCurrent, BSDC_MANIFEST_CONTINUITY, assertPrivateRecurringProvenance } from './controlled-package-ci.mjs'

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

// Post-publication authority is the real accepted origin/main. Positive reads
// remain actual immutable Git bytes; corrupted readers below are negative only.
const acgDigest=bytes=>createHash('sha256').update(bytes).digest('hex')
// Reuse the unchanged, authenticated complete legacy input used by the
// original BSDC suite. Current physical input is independently tested below.
const acgLegacyInput=await createAcgLegacyRecurringFixture(repositoryRoot)
test.after(()=>acgLegacyInput.close())
const acgClosedInputRead=p=>fs.readFileSync(path.join(acgLegacyInput.root,p))
// This is the exact manifest view produced earlier in the historical chain.
// Its bytes come from the real approved immutable predecessor, never a fixture hash.
const acgHistoricalRead=p=>p===acgCanonManifest?acgCanonHistory(acgCanonPrevious,p):acgClosedInputRead(p)
assert.equal(acgDigest(acgHistoricalRead(acgCanonManifest)),'d8ddddd7b39b6b67ed7e4ca2b4407a47a4470497465f790a67be301ea4dcccd8')
assert.equal(acgDigest(acgHistoricalRead(BSDC_MANIFEST_CONTINUITY.testPath)),BSDC_MANIFEST_CONTINUITY.testSha256)
const acgAuthorityRef='refs/remotes/origin/main'

test('ACG published exact authority authenticates its predecessor before historical BSDC traversal',()=>{
 assert.equal(acgDigest(acgCanonHistory(acgAuthorityRef,acgCanonManifest)),acgCanonManifestHash)
 const view=bsdcManifestContinuityTrustedCurrent(acgHistoricalRead,acgCanonHistory)
 assert.deepEqual(view(acgCanonManifest),acgCanonHistory(BSDC_MANIFEST_CONTINUITY.baseSha,acgCanonManifest))
})

test('ACG historical traversal cannot borrow a missing current-authority admission',()=>{
 const missing=changedAcgLedger(m=>m.successors=m.successors.filter(x=>x.manifestSha256!==acgCanonManifestHash))
 assert.throws(()=>bsdcManifestContinuityTrustedCurrent(acgHistoricalRead,acgLedgerHistory(missing)),/MANIFEST_SUCCESSOR_NOT_APPROVED_ON_MAIN/)
})

test('ACG historical traversal authenticates the actual current-authority document',()=>{
 const changed=(sha,p)=>sha===acgAuthorityRef&&p===acgCanonDocument?Buffer.concat([acgCanonHistory(sha,p),Buffer.from('\nALTERED_AUTHORITY_DOCUMENT')]):acgCanonHistory(sha,p)
 assert.throws(()=>bsdcManifestContinuityTrustedCurrent(acgHistoricalRead,changed),/MANIFEST_SUCCESSOR_DOCUMENT_BYTES_REJECTED/)
})

test('ACG historical traversal rejects changed or arbitrary later authority manifest bytes',()=>{
 for(const mutate of [
  bytes=>Buffer.concat([bytes,Buffer.from('\n')]),
  bytes=>{const m=JSON.parse(bytes);m.manifestVersion='3.54.0';return Buffer.from(JSON.stringify(m))}
 ]){
  const changed=(sha,p)=>sha===acgAuthorityRef&&p===acgCanonManifest?mutate(acgCanonHistory(sha,p)):acgCanonHistory(sha,p)
  assert.throws(()=>bsdcManifestContinuityTrustedCurrent(acgHistoricalRead,changed),/MANIFEST_SUCCESSOR_AUTHORITY_BASE_REJECTED/)
 }
})

test('ACG historical traversal cannot inherit a rebound current-authority source SHA',()=>{
 const rebound=changedAcgLedger(m=>m.successors.find(x=>x.manifestSha256===acgCanonManifestHash).sourceSha='c9de2488cca60b7bf2c8cb841a7e2586174f40f1')
 assert.throws(()=>bsdcManifestContinuityTrustedCurrent(acgHistoricalRead,acgLedgerHistory(rebound)),/MANIFEST_SUCCESSOR_HISTORICAL_AUTHORITY_REJECTED/)
})

test('ACG historical traversal authenticates the unchanged current-authority receipt',()=>{
 const changed=(sha,p)=>sha===acgAuthorityRef&&p===BSDC_MANIFEST_CONTINUITY.recordPath?Buffer.concat([acgCanonHistory(sha,p),Buffer.from('\nALTERED_RECEIPT')]):acgCanonHistory(sha,p)
 assert.throws(()=>bsdcManifestContinuityTrustedCurrent(acgHistoricalRead,changed),/MANIFEST_SUCCESSOR_HISTORICAL_AUTHORITY_REJECTED/)
})

test('ACG historical traversal rejects manipulated immutable successor or predecessor',()=>{
 for(const target of [acgCanonSource,acgCanonPrevious]){
  const changed=(sha,p)=>sha===target&&p===acgCanonManifest?Buffer.concat([acgCanonHistory(sha,p),Buffer.from('\nALTERED_HISTORY')]):acgCanonHistory(sha,p)
  assert.throws(()=>bsdcManifestContinuityTrustedCurrent(acgHistoricalRead,changed),/MANIFEST_SUCCESSOR_IMMUTABLE_BYTES_REJECTED/)
 }
})

test('ACG historical traversal preserves the original historical document checks',()=>{
 const target=BSDC_MANIFEST_CONTINUITY.sourcePaths.find(p=>p!==acgCanonManifest)
 const changed=p=>p===target?Buffer.concat([acgHistoricalRead(p),Buffer.from('\nALTERED_HISTORICAL_DOCUMENT')]):acgHistoricalRead(p)
 assert.throws(()=>bsdcManifestContinuityTrustedCurrent(changed,acgCanonHistory),/MANIFEST_SUCCESSOR_DOCUMENT_BYTES_REJECTED|MANIFEST_SUCCESSOR_BSDC_HISTORY_REJECTED/)
})

test('ACG published authority authenticates the complete actual current physical source graph',()=>{
 assert.equal(acgDigest(acgCanonHistory(acgAuthorityRef,acgCanonManifest)),acgCanonManifestHash)
 assert(assertPrivateRecurringProvenance(repositoryRoot))
})
