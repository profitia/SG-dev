import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import * as c from './controlled-package-ci.mjs'
import {sdkSourcePathAbsent} from '../../packages/platform-contracts/test/sdk-source-context.mjs'
const root=fileURLToPath(new URL('../../',import.meta.url))
const source='b3fcf378cb6320d9e2198e0b9a81bf88ab7cc398',base='a03956b6752227a7a14e44887feabd50a0ad1054',accepted='53691e907e4cc9b7fbf683c91bbebf41299e9ccc'
const hash=b=>createHash('sha256').update(b).digest('hex'),cache=new Map()
const historical=(sha,p)=>{const k=sha+':'+p;if(!cache.has(k))cache.set(k,execFileSync('git',['cat-file','blob',k],{cwd:root,stdio:['ignore','pipe','pipe'],maxBuffer:4194304}));return Buffer.from(cache.get(k))}
const current=p=>{try{return historical(source,p)}catch(error){if(sdkSourcePathAbsent(error,p,historical))throw Object.assign(error,{code:'ENOENT'});throw error}}
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
  const optional=p=>{try{return current(p)}catch(e){if(sdkSourcePathAbsent(e,p,historical))return null;throw e}}
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


const ci27Source='6fd28bede851fa64755c3de605744d972da25e73',ci27Base='c4965a445867601275cbb75dc4de993123414ba2'
const ci27Current=p=>historical(ci27Source,p)
const ci27Files=()=>Object.entries(c.ASSISTANT_QUALITY_CI27_REVIEW.entries).map(([filename,e])=>({filename,status:e.status,sha:e.sha}))
test('CI27 admits exactly the frozen27 files while preserving the24 original paths branches anchor and expiry',()=>{
 const legacy=c.ASSISTANT_QUALITY_SG2_STAGE1_REVIEW,next=c.ASSISTANT_QUALITY_CI27_REVIEW
 assert.equal(next.paths.length,27);assert.deepEqual(next.paths.filter(p=>!c.QUALITY_CI27_EXTRA_PATHS.includes(p)),legacy.paths)
 assert.deepEqual(next.branches,legacy.branches);assert.equal(next.anchorSha,legacy.anchorSha);assert.equal(next.expiresAt,legacy.expiresAt)
 c.assertQualityStage1KnowledgeSourceFiles(ci27Files())
 for(const mutate of [f=>f.pop(),f=>f.push({...f[0]}),f=>f[0].sha='0'.repeat(40),f=>f[0].status='removed',
  f=>f[0].previous_filename='foreign',f=>f[0].filename='.github/workflows/assistant-quality-repair.yml']){
  const f=ci27Files();mutate(f);assert.throws(()=>c.assertQualityStage1KnowledgeSourceFiles(f))
 }
 assert.throws(()=>c.assertQualityStage1KnowledgeSourceFiles(ci27Files(),Date.parse(next.expiresAt)),/EXPIRED/)
 assert.throws(()=>c.assertQualityStage1SourceFiles(ci27Files()),/SOURCE_SCOPE_REJECTED/)
 assert.throws(()=>c.assertQualityStage1CompositionSourceFiles(ci27Files()),/SOURCE_SCOPE_REJECTED/)
})
test('CI27 authenticates the full532 raw input graph and42 immutable receipts using only trusted metadata and helper code',()=>{
 const context=c.qualityCi27SourceContext(ci27Current,historical)
 assert.equal(Object.keys(context.record.inputs).length,532);assert.equal(Object.keys(context.record.retainedReceipts).length,42)
 assert.equal(context.record.coverageRecords.length,5);assert.equal(context.record.sourceSnapshotSha,ci27Source)
 assert.equal(context.metadata.sdkDigests.operationSourceDigest,'58fad1fc990486215037987be0f338106837569b2ee82ea45cbc22205fc5f44b')
 for(const flag of ['runtimeActivated','permissionsChanged','providerCallsPerformed','deploymentPerformed'])assert.equal(context.record[flag],false)
 assert.equal(Object.isFrozen(context.record),true);assert.equal(Object.isFrozen(context.record.inputs),true)
})
test('every current CI27 producer consumer guard and retained receipt independently rejects a changed byte before any source projection',()=>{
 const context=c.qualityCi27SourceContext(ci27Current,historical),inputs=Object.keys(context.record.inputs)
 const bytes=new Map(inputs.map(p=>[p,ci27Current(p)]))
 for(const p of inputs)assert.throws(()=>c.qualityCi27SourceContext(x=>x===p?Buffer.concat([bytes.get(x),Buffer.from('UNREVIEWED')]):bytes.get(x)??ci27Current(x),historical),p)
})
test('CI27 cannot self-refresh its own hashes to accept another private artifact or remove a test',()=>{
 for(const [p,change]of [
  ['apps/sg-runtime/package.json',v=>v.dependencies['@profitia/cic-core']='1.8.1'],
  ['apps/sg-runtime/package.json',v=>v.scripts['test:assistant']=v.scripts['test:assistant'].replace('tests/assistant-model.test.ts ','')],
  ['apps/sg-runtime/package-lock.json',v=>v.packages['node_modules/@profitia/cic-core'].integrity='sha512-unreviewed'],
 ]){
  const value=JSON.parse(ci27Current(p));change(value)
  const changed=Buffer.from(JSON.stringify(value)),a=JSON.parse(ci27Current(metadata));a.sourceDigests[p]=hash(changed)
  assert.throws(()=>c.qualityTrustedHostPredecessor(x=>x===p?changed:x===metadata?Buffer.from(JSON.stringify(a)):ci27Current(x),historical))
 }
 const a=JSON.parse(ci27Current(metadata));a.privateQaActivated=true
 assert.throws(()=>c.qualityTrustedHostPredecessor(p=>p===metadata?Buffer.from(JSON.stringify(a)):ci27Current(p),historical))
})
test('CI27 preserves the original CIC Knowledge ACG and PI validators and reports hashes of actual current source',()=>{
 const host=c.qualityTrustedHostPredecessor(ci27Current,historical)
 assert(host.knowledgeComposition);assert.equal(Object.keys(host.manifest.sourceDigests).length,19)
 assert.equal(Object.keys(host.knowledgeManifest.sourceDigests).length,478)
 const quality=c.qualityTrustedPredecessor(ci27Current,historical)
 for(const[p,digest]of Object.entries(quality.manifest.sourceDigests))assert.equal(hash(ci27Current(p)),digest,p)
 const editorial=c.editorialPackageCompositionTrustedPredecessor(ci27Current,historical);assert(editorial)
 for(const[p,digest]of Object.entries(editorial.manifest.sourceDigests))assert.equal(hash(ci27Current(p)),digest,p)
 assert.equal(Object.keys(JSON.parse(ci27Current(record)).sourceDigests).length,44)
 assert.equal(Object.keys(JSON.parse(ci27Current(record)).preservedReceipts).length,27)
 assert.equal(Object.keys(JSON.parse(ci27Current('apps/sg-runtime/procurement-insights-editorial-package-integration.json')).preservedReceipts).length,29)
})
test('finite CI27 compatibility retains unrelated current input and its exact native access error',()=>{
 const probe='Canon/evidence/ci27-unrelated-current-canary.json',bytes=Buffer.from('actual unrelated current input')
 const view=c.qualityTrustedHostPredecessor(p=>p===probe?bytes:ci27Current(p),historical)
 for(const read of [view.previousBytes,view.legacyPreviousBytes,view.compositionPreviousBytes])assert.deepEqual(read(probe),bytes)
 const error=Object.assign(Error('NATIVE_DENIED'),{code:'EACCES'})
 const denied=c.qualityTrustedHostPredecessor(p=>{if(p===probe)throw error;return ci27Current(p)},historical)
 for(const read of [denied.previousBytes,denied.legacyPreviousBytes,denied.compositionPreviousBytes])assert.throws(()=>read(probe),e=>e===error)
})
test('unapproved CI25 remains a historical regression and cannot obtain native live admission',async()=>{
 const metadata={number:1099,state:'open',draft:false,changed_files:files().length,user:{login:'profitia'},
  base:{sha:base,ref:'main',repo:{full_name:'profitia/SG-dev'}},head:{sha:source,ref:c.ASSISTANT_QUALITY_CI25_REVIEW.branches[1],repo:{full_name:'profitia/SG-dev'}}}
 const request=async resource=>{
  if(resource.includes('/pulls/1099/files'))return {data:files()}
  if(resource.endsWith('/pulls/1099'))return {data:metadata}
  throw Error('Unexpected provider metadata request')
 }
 await assert.rejects(c.resolveCandidateAdmission({repository:'profitia/SG-dev',ref:'refs/heads/main',workflowRef:'profitia/SG-dev/.github/workflows/platform-contracts-ci.yml@refs/heads/main',event:'workflow_dispatch',actor:'profitia',triggeringActor:'profitia',controlSha:base},'1099',source,request,root),/QUALITY_CI25_HISTORICAL_PROFILE_ONLY/)
})
test('physical frozen CI27 source validates current SDK provenance and refuses altered unowned input symlink or branch',()=>{
 const temporary=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'ci27-physical-source-'))),checkout=path.join(temporary,'source')
 const env={...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'}
 const git=(cwd,...args)=>execFileSync('git',args,{cwd,env,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
 try{
  git(temporary,'clone','--quiet','--shared','--no-checkout',root,'source')
  git(checkout,'checkout','--quiet','--detach',ci27Source)
  git(checkout,'update-ref','refs/remotes/origin/main',ci27Base)
  c.qualityCi27SourceContext(ci27Current,historical)
  const admission={kind:'QUALITY_STAGE1_SG2',branch:c.ASSISTANT_QUALITY_CI27_REVIEW.branches[1],baseSha:ci27Base,controlSha:ci27Base,files:ci27Files()}
  c.assertArchitectureCheckout(checkout,ci27Source,admission,root)
  const receipt=JSON.parse(ci27Current('apps/sg-runtime/operation-integration.json')),contract=c.currentProofContract(checkout,receipt)
  assert.equal(contract.sourceDigest,'58fad1fc990486215037987be0f338106837569b2ee82ea45cbc22205fc5f44b')
  assert.equal(c.operationContractProvenanceDigest(checkout,contract,{reviewedPrivateRecurring:true}),contract.sourceDigest)
  assert.deepEqual(c.publicProofContract(receipt,{receiptBytes:ci27Current('apps/sg-runtime/operation-integration.json'),
   knowledgeRecord:ci27Current('apps/architecture-lab/knowledge-source.json'),reservationRecord:ci27Current(record)}),contract)
  assert.throws(()=>c.assertArchitectureCheckout(checkout,ci27Source,{...admission,branch:c.ASSISTANT_QUALITY_CI27_REVIEW.branches[0]},root))
  const owned=path.join(checkout,c.QUALITY_CI25_BRIDGE),ownedBytes=fs.readFileSync(owned)
  fs.appendFileSync(owned,'UNREVIEWED');assert.throws(()=>c.assertArchitectureCheckout(checkout,ci27Source,admission,root));fs.writeFileSync(owned,ownedBytes)
  const unowned='packages/platform-contracts/src/operation-context.mjs',file=path.join(checkout,unowned),before=fs.readFileSync(file)
  fs.appendFileSync(file,'UNREVIEWED');assert.throws(()=>c.assertArchitectureCheckout(checkout,ci27Source,admission,root));fs.writeFileSync(file,before)
  fs.unlinkSync(file);fs.symlinkSync(path.join(root,unowned),file)
  assert.throws(()=>c.assertArchitectureCheckout(checkout,ci27Source,admission,root))
 }finally{fs.rmSync(temporary,{recursive:true,force:true})}
})
