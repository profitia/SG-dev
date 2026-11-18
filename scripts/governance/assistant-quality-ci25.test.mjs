import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import * as c from './controlled-package-ci.mjs'
const root=fileURLToPath(new URL('../../',import.meta.url))
const source='b3fcf378cb6320d9e2198e0b9a81bf88ab7cc398',base='a03956b6752227a7a14e44887feabd50a0ad1054',accepted='53691e907e4cc9b7fbf683c91bbebf41299e9ccc'
const hash=b=>createHash('sha256').update(b).digest('hex'),cache=new Map()
const historical=(sha,p)=>{const k=sha+':'+p;if(!cache.has(k))cache.set(k,execFileSync('git',['cat-file','blob',k],{cwd:root,stdio:['ignore','pipe','pipe'],maxBuffer:4194304}));return Buffer.from(cache.get(k))}
const current=p=>historical(source,p)
const metadata=c.QUALITY_HOST_RECEIPT,record='apps/architecture-lab/assistant-reservation-source.json'
const files=()=>execFileSync('git',['diff','--name-status','--no-renames',base+'...'+source],{cwd:root,encoding:'utf8'}).trim().split('\n').map(line=>{
 const [status,filename]=line.split('\t'),entry=execFileSync('git',['ls-tree',source,'--',filename],{cwd:root,encoding:'utf8'}).trim()
 return {filename,status:status==='A'?'added':'modified',sha:entry.split(' ')[2].split('\t')[0]}
})
test('CI25 adds exactly one Architecture bridge while all closed CI24 paths branches and expiry remain unchanged',()=>{
 const legacy=c.ASSISTANT_QUALITY_SG2_STAGE1_REVIEW,next=c.ASSISTANT_QUALITY_CI25_REVIEW
 assert.equal(legacy.paths.length,24);assert.equal(next.paths.length,25)
 assert.deepEqual(next.paths.filter(p=>p!==c.QUALITY_CI25_BRIDGE),legacy.paths)
 assert.deepEqual(next.branches,legacy.branches);assert.equal(next.expiresAt,legacy.expiresAt);assert.equal(next.anchorSha,legacy.anchorSha)
 const f=files();assert.equal(f.length,25);c.assertQualityStage1CompositionSourceFiles(f)
 for(const mutation of [
  f=>f.push({...f[0]}),f=>f.splice(f.findIndex(x=>x.filename===c.QUALITY_CI25_BRIDGE),1),
  f=>f.find(x=>x.filename===c.QUALITY_CI25_BRIDGE).status='added',
  f=>f.find(x=>x.filename===c.QUALITY_CI25_BRIDGE).previous_filename='foreign',
  f=>f.find(x=>x.filename===c.QUALITY_CI25_BRIDGE).sha='bad',
  f=>f[0].filename='packages/platform-contracts/test/assistant-reservation-source.test.mjs',
  f=>f[0].filename='.github/workflows/platform-contracts-ci.yml'
 ]){const bad=files();mutation(bad);assert.throws(()=>c.assertQualityStage1CompositionSourceFiles(bad))}
 assert.throws(()=>c.assertQualityStage1SourceFiles(f),/QUALITY_STAGE1_SOURCE_SCOPE_REJECTED/)
 assert.throws(()=>c.assertQualityStage1CompositionSourceFiles(f,Date.parse(next.expiresAt)),/EXPIRED/)
})
test('new ACG bridge is an exact additive wrapper of the accepted original body',()=>{
 assert.equal(c.qualityCi25ReservationBridge(String(historical(accepted,c.QUALITY_CI25_BRIDGE))),String(current(c.QUALITY_CI25_BRIDGE)))
 assert.throws(()=>c.qualityCi25ReservationBridge('foreign'))
})
test('trusted controller authenticates actual composed CIC and preserves both accepted ACG and original CIC projections',()=>{
 const view=c.qualityTrustedHostPredecessor(current,historical)
 assert.equal(view.acceptedComposition,true);assert.equal(Object.keys(view.manifest.sourceDigests).length,17)
 assert.deepEqual(view.compositionPreviousBytes('apps/sg-runtime/lib/assistant/conversation.ts'),historical(accepted,'apps/sg-runtime/lib/assistant/conversation.ts'))
 assert.equal(c.qualityTrustedPredecessor(current,historical).compositionPreviousBytes instanceof Function,true)
 assert.throws(()=>view.compositionPreviousBytes('apps/sg-runtime/lib/assistant/quality-response.ts'),e=>e.code==='ENOENT')
})
test('each actual composed source and every CIC ACG and editorial receipt remains independently authenticated',()=>{
 const a=JSON.parse(current(metadata)),r=JSON.parse(current(record)),p=JSON.parse(current('apps/sg-runtime/procurement-insights-editorial-package-integration.json'))
 assert.equal(Object.keys(r.sourceDigests).length,44);assert.equal(Object.keys(r.preservedReceipts).length,27)
 assert.equal(Object.keys(p.preservedReceipts).length,29)
 const paths=new Set([metadata,record,'apps/sg-runtime/procurement-insights-editorial-package-integration.json',
  ...Object.keys(a.sourceDigests),...Object.keys(a.previousReceipts),...Object.keys(r.sourceDigests),...Object.keys(r.preservedReceipts),
  ...Object.keys(p.sourceDigests),...Object.keys(p.preservedReceipts),
  'apps/sg-runtime/lib/assistant/calendar-period.ts','apps/sg-runtime/lib/assistant/context-selection.ts',
  'apps/sg-runtime/tests/assistant-quality.test.ts','apps/sg-runtime/tests/assistant-quality-integrity.test.mjs',
  'apps/sg-runtime/tests/assistant-ecr-integrity.mjs','apps/sg-runtime/tests/assistant-ecr-precision-integrity.mjs'])
 for(const p of paths)assert.throws(()=>c.qualityTrustedHostPredecessor(x=>x===p?Buffer.concat([current(x),Buffer.from('\nUNREVIEWED')]):current(x),historical),p)
})
test('refreshing own hashes cannot admit another private artifact lifecycle command removed test or dependency',()=>{
 for(const mutate of [
  m=>m.dependencies['@profitia/cic-core']='1.8.1',m=>m.scripts.preinstall='echo unreviewed',
  m=>m.scripts['test:assistant']=m.scripts['test:assistant'].replace('tests/assistant-model.test.ts ',''),
  m=>m.dependencies.unreviewed='1.0.0'
 ]){
  const p='apps/sg-runtime/package.json',manifest=JSON.parse(current(p));mutate(manifest)
  const changed=Buffer.from(JSON.stringify(manifest)),a=JSON.parse(current(metadata));a.sourceDigests[p]=hash(changed)
  assert.throws(()=>c.qualityTrustedHostPredecessor(x=>x===p?changed:x===metadata?Buffer.from(JSON.stringify(a)):current(x),historical))
 }
 for(const mutate of [l=>l.packages['node_modules/@profitia/cic-core'].integrity='sha512-foreign',l=>l.packages['node_modules/@profitia/insights-runtime'].version='1.2.2']){
  const p='apps/sg-runtime/package-lock.json',lock=JSON.parse(current(p));mutate(lock)
  const changed=Buffer.from(JSON.stringify(lock)),a=JSON.parse(current(metadata));a.sourceDigests[p]=hash(changed)
  assert.throws(()=>c.qualityTrustedHostPredecessor(x=>x===p?changed:x===metadata?Buffer.from(JSON.stringify(a)):current(x),historical))
 }
})
test('composition identity flags wrong upstream history and storage errors fail closed',()=>{
 for(const mutate of [a=>a.acceptedComposition.sourceSha='0'.repeat(40),a=>a.acceptedComposition.componentSourceSha='0'.repeat(40),
  a=>a.acceptedComposition.reservationRecordSha256='0'.repeat(64),a=>a.responseProtectionActivated=true,a=>a.cloudInstallationPerformed=true,
  a=>a.sourceDigests['packages/platform-contracts/src/assistant-usage.mjs']='0'.repeat(64)]){
  const a=JSON.parse(current(metadata));mutate(a);assert.throws(()=>c.qualityTrustedHostPredecessor(p=>p===metadata?Buffer.from(JSON.stringify(a)):current(p),historical))
 }
 assert.throws(()=>c.qualityTrustedHostPredecessor(current,(sha,p)=>sha===accepted&&p==='apps/sg-runtime/package.json'?Buffer.from('{}'):historical(sha,p)))
 assert.throws(()=>c.qualityTrustedHostPredecessor(p=>{if(p===record)throw Object.assign(Error('denied'),{code:'EACCES'});return current(p)},historical),/denied/)
})
test('accepted editorial projection retains complete current-source authentication and original 29 receipts',()=>{
 const view=c.editorialPackageCompositionTrustedPredecessor(current,historical);assert(view);assert(view.quality.compositionPreviousBytes)
 for(const p of Object.keys(JSON.parse(current('apps/sg-runtime/procurement-insights-editorial-package-integration.json')).preservedReceipts))
  assert.throws(()=>c.editorialPackageCompositionTrustedPredecessor(x=>x===p?Buffer.concat([current(x),Buffer.from('changed')]):current(x),historical),p)
})
test('unrelated current files and absent optional layers cannot be replaced by historical component bytes',()=>{
 const optional='apps/architecture-lab/knowledge-source.json',bytes=Buffer.from('actual current unrelated input')
 const view=c.qualityTrustedHostPredecessor(p=>p===optional?bytes:current(p),historical)
 assert.deepEqual(view.previousBytes(optional),bytes);assert.deepEqual(view.legacyPreviousBytes(optional),bytes);assert.deepEqual(view.compositionPreviousBytes(optional),bytes)
 const denied=c.qualityTrustedHostPredecessor(p=>{if(p===optional)throw Object.assign(Error('denied'),{code:'EACCES'});return current(p)},historical)
 for(const read of [denied.previousBytes,denied.legacyPreviousBytes,denied.compositionPreviousBytes])assert.throws(()=>read(optional),/denied/)
})
test('public ACG proof metadata cannot accept another record or operation identity',()=>{
 const before={id:'profitia.operation-context',version:'1.0.0',implementation:'1.0.0-candidate.16',sourceDigest:'0'.repeat(64)}
 const bound=c.qualityCi25ProofContract(before,current(record))
 assert.equal(bound.sourceDigest,JSON.parse(current(record)).sdkDigests.operationSourceDigest)
 assert.deepEqual({...bound,sourceDigest:before.sourceDigest},before)
 assert.equal(c.qualityCi25ProofContract(before,null),before)
 assert.throws(()=>c.qualityCi25ProofContract({...before,implementation:'1.0.0-candidate.20'},current(record)))
 assert.throws(()=>c.qualityCi25ProofContract(before,Buffer.concat([current(record),Buffer.from(' ')])))
})
test('physical exact-source admission rejects wrong branch diff ancestry changed bytes and nonregular bridge',()=>{
 const f=files(),admission={kind:'QUALITY_STAGE1_SG2',branch:c.ASSISTANT_QUALITY_CI25_REVIEW.branches[1],baseSha:base,controlSha:base,files:f}
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'quality-ci25-source-')),checkout=path.join(temporary,'source');let created=false
 try{
  execFileSync('git',['clone','--quiet','--shared','--no-checkout',root,checkout],{stdio:'pipe'});created=true
  execFileSync('git',['sparse-checkout','set','--no-cone','/*','!/tooling/','!/.phase-2-1-runtime/'],{cwd:checkout,stdio:'pipe'})
  execFileSync('git',['checkout','--quiet','--detach',source],{cwd:checkout,stdio:'pipe'})
  const authority=execFileSync('git',['rev-parse','refs/remotes/origin/main'],{cwd:root,encoding:'utf8'}).trim()
  execFileSync('git',['update-ref','refs/remotes/origin/main',authority],{cwd:checkout,stdio:'pipe'})
  c.assertArchitectureCheckout(checkout,source,admission,root)
  c.assertQualityStage1Packages(JSON.parse(current('apps/sg-runtime/package-lock.json')),JSON.parse(current('apps/sg-runtime/package.json')),
   JSON.parse(historical(base,'apps/sg-runtime/package-lock.json')),JSON.parse(historical(base,'apps/sg-runtime/package.json')),true)
  const receipt=JSON.parse(current('apps/sg-runtime/operation-integration.json')),contract=c.currentProofContract(checkout,receipt)
  assert.equal(c.operationContractProvenanceDigest(checkout,contract,{reviewedPrivateRecurring:true}),contract.sourceDigest,'complete trusted SDK provenance of actual composed source')
  const optional=p=>{try{return current(p)}catch(e){if(e.status===128&&String(e.stderr).includes("does not exist"))return null;throw e}}
  assert.deepEqual(c.publicProofContract(receipt,{receiptBytes:current('apps/sg-runtime/operation-integration.json'),
   recurringRecord:optional(c.PRIVATE_RECURRING_PROVENANCE.recordPath),lifecycleRecord:optional(c.REGISTRATION_LIFECYCLE_PROVENANCE.recordPath),
   knowledgeRecord:optional(c.PLATFORM_KNOWLEDGE_STAGE2_PROVENANCE.recordPath),reservationRecord:current(record)}),contract,'public verifier retains actual source SDK identity')

  for(const change of [{branch:c.ASSISTANT_QUALITY_CI25_REVIEW.branches[0]},{files:f.slice(1)},{baseSha:'1'.repeat(40)}])
   assert.throws(()=>c.assertArchitectureCheckout(checkout,source,{...admission,...change},root))
  const file=path.join(checkout,c.QUALITY_CI25_BRIDGE),bytes=fs.readFileSync(file)
  fs.appendFileSync(file,'\n');assert.throws(()=>c.assertArchitectureCheckout(checkout,source,admission,root));fs.writeFileSync(file,bytes)
  fs.chmodSync(file,0o755);assert.throws(()=>c.assertArchitectureCheckout(checkout,source,admission,root));fs.chmodSync(file,0o644)
  fs.unlinkSync(file);fs.symlinkSync('/dev/null',file);assert.throws(()=>c.assertArchitectureCheckout(checkout,source,admission,root))
 }finally{fs.rmSync(temporary,{recursive:true,force:true})}
})
