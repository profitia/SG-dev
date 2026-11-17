import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import {fileURLToPath} from 'node:url'
import {bsdcManifestContinuityCurrent,BSDC_MANIFEST_CONTINUITY as cfg} from '../market-calendar-source.mjs'
import {bsdcManifestContinuityTrustedCurrent} from '../../../scripts/governance/controlled-package-ci.mjs'

const root=fileURLToPath(new URL('../../../',import.meta.url))
const ledgerPath='Canon/registries/governance-manifest-successors-v1.json'
const trustedRef='refs/remotes/origin/main'
const sourceSha='1dc0c05e52e8f4b78779ec3d0e532975ed4fa354'
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const physical=p=>fs.readFileSync(path.join(root,p))
const history=(sha,p)=>execFileSync('git',['show',sha+':'+p],{cwd:root,stdio:['ignore','pipe','pipe']})
const sourceManifest=history(sourceSha,cfg.manifestPath)
const sourceDoc='Canon/v1.0-procurement-insights-narrative-and-editorial-canon.md'
const sourceDocument=history(sourceSha,sourceDoc)
const originalManifest=physical(cfg.manifestPath)
const approvedLedger=JSON.parse(physical(ledgerPath))
const clone=x=>structuredClone(x)

function fixture({mutateLedger,mainManifest=originalManifest,manifest=sourceManifest,document=sourceDocument,trustedLedger=true,sourceOverride=null,candidateLedger=null}={}){
 const ledger=clone(approvedLedger)
 if(mutateLedger)mutateLedger(ledger)
 const trusted=(sha,p)=>{
  if(sha===trustedRef && p===ledgerPath){
   if(!trustedLedger)throw Object.assign(new Error('not present in authority main'),{code:'ENOENT'})
   return Buffer.from(JSON.stringify(ledger))
  }
  if(sha===trustedRef && p===cfg.manifestPath)return Buffer.from(mainManifest)
  if(sourceOverride && sha===sourceSha && p===cfg.manifestPath)return Buffer.from(sourceOverride)
  return history(sha,p)
 }
 const current=p=>{
  if(p===cfg.manifestPath)return Buffer.from(manifest)
  if(p===sourceDoc)return Buffer.from(document)
  if(p===ledgerPath && candidateLedger)return Buffer.from(candidateLedger)
  return physical(p)
 }
 return {current,trusted}
}

test('historical approved BSDC manifest remains accepted without a successor ledger',()=>{
 const historical=(sha,p)=>{
  if(sha===trustedRef)throw new Error('no trusted successor ledger')
  return history(sha,p)
 }
 const projection=bsdcManifestContinuityCurrent(physical,historical)
 assert.deepEqual(projection(cfg.manifestPath),history(cfg.baseSha,cfg.manifestPath))
})

test('independent main ledger admits exact append-only editorial canon with verified bytes',()=>{
 const {current,trusted}=fixture()
 const projection=bsdcManifestContinuityCurrent(current,trusted)
 assert.deepEqual(projection(cfg.manifestPath),history(cfg.baseSha,cfg.manifestPath))
 assert.deepEqual(projection(sourceDoc),sourceDocument)
})

test('accepted resulting-main manifest continues to preserve the BSDC historical view',()=>{
 const {current,trusted}=fixture({mainManifest:sourceManifest})
 const projection=bsdcManifestContinuityCurrent(current,trusted)
 assert.deepEqual(projection(cfg.manifestPath),history(cfg.baseSha,cfg.manifestPath))
})

test('candidate-local ledger cannot admit its own manifest without trusted-main record',()=>{
 const {current,trusted}=fixture({trustedLedger:false,candidateLedger:JSON.stringify(approvedLedger)})
 assert.throws(()=>bsdcManifestContinuityCurrent(current,trusted))
})

test('unlisted manifest SHA cannot be authorized by candidate-side edits',()=>{
 const altered=Buffer.concat([sourceManifest,Buffer.from(' ')])
 const {current,trusted}=fixture({manifest:altered,candidateLedger:JSON.stringify(approvedLedger)})
 assert.throws(()=>bsdcManifestContinuityCurrent(current,trusted),/unapproved governance manifest successor/)
})

test('a newly appended canon document must match reviewed source and current bytes',()=>{
 const {current,trusted}=fixture({document:Buffer.concat([sourceDocument,Buffer.from('TAMPER')])})
 assert.throws(()=>bsdcManifestContinuityCurrent(current,trusted),/current approved document/)
})

test('stale and unrelated trusted main manifests fail closed',()=>{
 const unrelated=Buffer.concat([originalManifest,Buffer.from(' ')])
 const {current,trusted}=fixture({mainManifest:unrelated})
 assert.throws(()=>bsdcManifestContinuityCurrent(current,trusted),/not based on current authority main/)
})

test('trusted-main ledger must have a single unique entry for each exact digest',()=>{
 const {current,trusted}=fixture({mutateLedger:x=>x.successors.push(clone(x.successors[0]))})
 assert.throws(()=>bsdcManifestContinuityCurrent(current,trusted),/duplicate manifest successor grant/)
})

test('status, scope and provenance metadata remain exact, not caller-selected',()=>{
 for(const mutateLedger of [
  x=>x.successors[0].status='PROPOSED',
  x=>x.successors[0].scope='ANY_MANIFEST',
  x=>x.successors[0].approvalRef='',
  x=>x.successors[0].manifestVersion='3.53.0',
  x=>x.repository='another/repo',
 ]){
  const {current,trusted}=fixture({mutateLedger})
  assert.throws(()=>bsdcManifestContinuityCurrent(current,trusted))
 }
})

test('invalid hashes or unreviewed source commit bytes are rejected',()=>{
 for(const mutateLedger of [
  x=>x.successors[0].previousManifestSha256='0'.repeat(64),
  x=>x.successors[0].sourceSha='0'.repeat(40),
  x=>x.successors[0].documentDigests[sourceDoc]='0'.repeat(64),
 ]){
  const {current,trusted}=fixture({mutateLedger})
  assert.throws(()=>bsdcManifestContinuityCurrent(current,trusted))
 }
})

test('a forged non-append predecessor cannot pass even with a rebound digest',()=>{
 const tampered=JSON.parse(sourceManifest)
 tampered.documents[0]={...tampered.documents[0],status:'SUPERSEDED'}
 const changed=Buffer.from(JSON.stringify(tampered))
 const {current,trusted}=fixture({
  manifest:changed,
  sourceOverride:changed,
  mutateLedger:ledger=>{ledger.successors[0].manifestSha256=hash(changed)},
 })
 assert.throws(()=>bsdcManifestContinuityCurrent(current,trusted),/existing manifest entries are immutable/)
})

test('a forged extra document or shortened approved set is rejected',()=>{
 for(const mutateLedger of [
  x=>x.successors[0].appendedDocuments=[],
  x=>x.successors[0].appendedDocuments[0].path='../external.md',
  x=>delete x.successors[0].documentDigests[sourceDoc],
 ]){
  const {current,trusted}=fixture({mutateLedger})
  assert.throws(()=>bsdcManifestContinuityCurrent(current,trusted))
 }
})


test('trusted controller independently admits exact main-ledger successor without evaluating candidate helper',()=>{
 const {current,trusted}=fixture()
 const projection=bsdcManifestContinuityTrustedCurrent(current,trusted)
 assert.deepEqual(projection(cfg.manifestPath),history(cfg.baseSha,cfg.manifestPath))
 assert.deepEqual(projection(sourceDoc),sourceDocument)
})

test('trusted controller continues to accept resulting-main bytes once policy is admitted',()=>{
 const {current,trusted}=fixture({mainManifest:sourceManifest})
 const projection=bsdcManifestContinuityTrustedCurrent(current,trusted)
 assert.deepEqual(projection(cfg.manifestPath),history(cfg.baseSha,cfg.manifestPath))
})

test('trusted controller rejects candidate-side self admission and invalid source bytes',()=>{
 for(const options of [
  {trustedLedger:false,candidateLedger:JSON.stringify(approvedLedger)},
  {manifest:Buffer.concat([sourceManifest,Buffer.from('EXTRA')])},
  {document:Buffer.concat([sourceDocument,Buffer.from('ALTERED')])},
  {mainManifest:Buffer.concat([originalManifest,Buffer.from('BAD_BASE')])},
  {mutateLedger:x=>x.successors[0].status='PROPOSED'},
  {mutateLedger:x=>x.successors[0].scope='ANY'},
  {mutateLedger:x=>x.successors[0].documentDigests[sourceDoc]='f'.repeat(64)},
 ]){
  const {current,trusted}=fixture(options)
  assert.throws(()=>bsdcManifestContinuityTrustedCurrent(current,trusted))
 }
})

test('candidate and trusted controllers must both reject unrelated historical mutation',()=>{
 const {current,trusted}=fixture()
 const altered=(sha,p)=>{
  const b=trusted(sha,p)
  if(sha===cfg.baseSha && p===cfg.manifestPath)return Buffer.concat([b,Buffer.from('ALTERED_HISTORY')])
  return b
 }
 assert.throws(()=>bsdcManifestContinuityCurrent(current,altered))
 assert.throws(()=>bsdcManifestContinuityTrustedCurrent(current,altered))
})
