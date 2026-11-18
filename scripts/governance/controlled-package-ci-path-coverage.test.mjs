import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import {CONTROL_POLICY_FILES} from './controlled-package-ci.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const workflow = '.github/workflows/platform-contracts-ci.yml'
const text = fs.readFileSync(path.join(root, workflow), 'utf8')
const consumers = ['apps/sg-runtime', 'apps/srm', 'apps/dashboard-preview', 'apps/architecture-lab',
  'packages/platform-contracts', 'packages/srm-xray']
const files = execFileSync('git', ['ls-files', '-z', '--', ...consumers], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean)

// Read the existing workflow's deliberately simple quoted path-list syntax.
// Unsupported syntax fails this guard rather than silently skipping a filter.
function patternsFor(event) {
  const lines = text.split('\n'), heading = `  ${event}:`
  assert.equal(lines.filter(line => line === heading).length, 1)
  const start = lines.indexOf(heading)
  const next = lines.findIndex((line, index) => index > start && /^  \S/.test(line))
  const block = lines.slice(start + 1, next < 0 ? undefined : next)
  const offset = block.indexOf('    paths:')
  assert(offset >= 0, `${event} must declare path filters`)
  const patterns = []
  for (const line of block.slice(offset + 1)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    const entry = /^      - '([^']+)'$/.exec(line)
    assert(entry, `Unsupported ${event} path-list syntax: ${line}`)
    const pattern = entry[1]
    assert(/^[A-Za-z0-9._/-]+(?:\/\*\*|\*)?$/.test(pattern), `Unsupported coverage pattern: ${pattern}`)
    patterns.push(pattern)
  }
  assert(patterns.length > 0)
  return patterns
}

// Only the three literal forms used by these filters: exact file, subtree /**
// and a final basename *. In particular * must not match another directory.
function covers(pattern, file) {
  if (pattern.endsWith('/**')) {
    const prefix = pattern.slice(0, -3)
    return file === prefix || file.startsWith(`${prefix}/`)
  }
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1)
    return file.startsWith(prefix) && !file.slice(prefix.length).includes('/')
  }
  return pattern === file
}
const events = ['pull_request', 'push']
for (const event of events) {
  test(`${event} covers every tracked current consumer and reused shared-module file`, t => {
    const patterns = patternsFor(event)
    for (const consumer of consumers) assert(files.some(file => file.startsWith(`${consumer}/`)), `Missing actual consumer: ${consumer}`)
    const missing = files.filter(file => !patterns.some(pattern => covers(pattern, file)))
    t.diagnostic(`Examined ${files.length} tracked files across ${consumers.length} actual consumer/module trees`)
    const critical = ['apps/sg-runtime/lib/market-data/stored-read.ts', 'apps/sg-runtime/tests/stored-market-read.integration.test.mjs',
      'apps/sg-runtime/lib/platform/private-runtime.ts', 'apps/sg-runtime/prisma-market-data/private-read/002-stored-rolling-current.sql']
      .filter(file => !patterns.some(pattern => covers(pattern, file)))
    assert.equal(missing.length, 0, `Missing protected source coverage: ${critical.join(', ')}; ${missing.length} omissions, first: ${missing.slice(0, 20).join(', ')}`)
  })
}

test('product integration does not expand into unrelated apps, evidence or similarly named roots', () => {
  for (const event of events) for (const file of ['apps/pmos/package.json', 'apps/pcos-explorer/package.json',
    'apps/vector/package.json', 'Canon/evidence/unrelated-fixture.md', 'README.md', 'apps/sg-runtime-unrelated/package.json',
    'apps/srm-unrelated/package.json', 'scripts/governance/controlled-package-ci-private/nested.mjs']) {
    assert(!patternsFor(event).some(pattern => covers(pattern, file)), `Unrelated ${file} unexpectedly triggers ${event}`)
  }
})

test('both events cover the workflow, its guard/controller and registry inputs while push stays on main', () => {
  const self = path.relative(root, fileURLToPath(import.meta.url)).split(path.sep).join('/')
  for (const event of events) for (const file of [workflow, self, 'scripts/governance/controlled-package-ci.mjs',
    'scripts/governance/controlled-package-ci.test.mjs', 'Canon/registries/development-workspaces-v1.json', 'Canon/registries/profitia-projects-v1.json',
    'Canon/registries/architecture-environment-topology-v1.json']) {
    assert(patternsFor(event).some(pattern => covers(pattern, file)), `Control source ${file} omitted from ${event}`)
  }
  assert.deepEqual(patternsFor('pull_request'), patternsFor('push'))
  assert.match(text, /\n  push:\n    branches: \[main\]\n/)
})

test('both events cover every trusted transitive admission and fingerprint input', () => {
  for (const event of events) for (const file of CONTROL_POLICY_FILES) {
    assert(patternsFor(event).some(pattern => covers(pattern, file)), `Trusted admission input ${file} omitted from ${event}`)
  }
})

// Independently exercised current-SDK Source admission regressions.
import {createHash} from 'node:crypto'
import {resolveProjectProfile} from './project-profile.mjs'
import {resolveProjectRouting} from './routing-engine.mjs'
import os from 'node:os'
import {ASSISTANT_RESERVATION_SOURCE_ADMISSION,sourceAdmissionDigest,assertSourceValidationProof,transportPlan,executionProfile,classifyCapability,assertWorkflowPackageCredential,
 classifyPackageFailure,credentialFree,assertSourceAdmission,assertSourceCheckout,
 readTrustedAdmissions,trustedAdmissionById,assertOperationWithinMandate,assertReleaseState,resumePoint} from './development-execution.mjs'

const now=Date.parse('2026-11-16T14:00:00Z'), head='a'.repeat(40), base='b'.repeat(40)
const sourcePath='packages/platform-contracts/src/operation-context.mjs'
const entry={path:sourcePath,blob:head,status:'modified',mode:'100644',projectKey:'ARCHITECTURE',owner:'Architecture Platform',surfaceId:'ARCH-BASE-001'}
const record=()=>({id:'independent-source',status:'ACTIVE',repository:'profitia/SG-dev',actor:'profitia',
 taskId:'AN-INDEPENDENT-FUTURE-TASK',targetEnvironment:'development',scope:'SOURCE_VALIDATION_ONLY',
 approvalRef:'accepted-owner-mandate',sourceSha:head,baseSha:base,validFrom:'2026-11-01T00:00:00Z',
 validUntil:'2026-12-01T00:00:00Z',files:[{...entry}]})
const facts=()=>({repository:'profitia/SG-dev',actor:'profitia',candidateSha:head,currentMainSha:base,
 files:[{filename:sourcePath,sha:head,status:'modified'}]})


function metadataFixture(name,kind='HISTORICAL_EVIDENCE'){
 const profile=resolveProjectProfile('SG2',root)
 const route=resolveProjectRouting({profile,targets:[name],repositoryRoot:root}).results[0]
 assert.equal(route?.projectBoundaryStatus,'ALLOWED')
 assert.equal(route?.baselineClassification,'ALIGNED')
 const r=record(),f=facts()
 r.files=[{path:name,blob:head,status:'modified',mode:'100644',projectKey:'SG2',
   owner:route.currentOwner,surfaceId:route.matchedSurfaceId}]
 f.files=[{filename:name,sha:head,status:'modified'}]
 const p={reviewedMetadata:{recordId:r.id,taskId:r.taskId,
   entries:{[name]:{sha:head,mode:'100644',kind}}}}
 return {r,f,p}
}

test('ordinary Source admission accepts real Next dynamic routes without admitting traversal or encoded paths',()=>{
 for(const name of ['apps/sg-runtime/app/organisation/[slug]/page.tsx',
 'apps/sg-runtime/app/organisation/[...parts]/page.tsx',
 'apps/sg-runtime/app/organisation/[[...parts]]/page.tsx']){
  const {r,f}=metadataFixture(name)
  assertSourceAdmission(r,f,root,now)
 }
 for(const name of ['apps/../sg-runtime/app/[slug]/page.tsx','/apps/sg-runtime/[slug]',
 'apps/sg-runtime//[slug]/page.tsx','apps/sg-runtime/%2e%2e/[slug]/page.tsx',
 'apps/sg-runtime/..\\escape/[slug]/page.tsx']){
  const r=record(),f=facts();r.files[0].path=name;f.files[0].filename=name
  assert.throws(()=>assertSourceAdmission(r,f,root,now),/SOURCE_ADMISSION_FILES_REJECTED/)
 }
})

test('protected metadata requires a trusted exact table, matching task and record; candidate self-approval is ignored',()=>{
 for(const [name,kind] of [['apps/sg-runtime/operation-integration.json','HISTORICAL_EVIDENCE'],
 ['apps/sg-runtime/.env.example','ENVIRONMENT_TEMPLATE']]){
  const {r,f,p}=metadataFixture(name,kind)
  assert.throws(()=>assertSourceAdmission(r,f,root,now),/SOURCE_ADMISSION_FILES_REJECTED/)
  r.reviewedMetadata=p.reviewedMetadata
  assert.throws(()=>assertSourceAdmission(r,f,root,now),/SOURCE_ADMISSION_FILES_REJECTED/)
  assertSourceAdmission(r,f,root,now,p)
  for(const edit of [
   x=>x.reviewedMetadata.recordId='other',x=>x.reviewedMetadata.taskId='other',
   x=>x.reviewedMetadata.entries[name].sha=base,
   x=>x.reviewedMetadata.entries[name].mode='100755',
   x=>x.reviewedMetadata.entries[name].kind='EXECUTABLE_POLICY',
   x=>delete x.reviewedMetadata.entries[name]
  ]){
   const changed=structuredClone(p);edit(changed)
   assert.throws(()=>assertSourceAdmission(r,f,root,now,changed),/SOURCE_ADMISSION_FILES_REJECTED/)
  }
  const executable=structuredClone(r);executable.files[0].mode='100755'
  assert.throws(()=>assertSourceAdmission(executable,f,root,now,p),/SOURCE_ADMISSION_FILES_REJECTED/)
 }
})

test('metadata review never admits policy, workflow, AGENTS, credentials or private environment files',()=>{
 for(const name of ['Canon/registries/new-source.json','scripts/governance/source.json',
 '.github/workflows/source.json','governance/source.json','AGENTS.md',
 'apps/sg-runtime/.npmrc','apps/sg-runtime/.env','apps/sg-runtime/.env.local',
 'apps/sg-runtime/.env.source.json','apps/sg-runtime/.npmrc.source.json',
 'apps/sg-runtime/.git/source.json','apps/sg-runtime/node_modules/source.json',
 'apps/sg-runtime/.pmos/source.json','apps/sg-runtime/.context/source.json',
 'apps/sg-runtime/AGENTS.md/source.json','apps/.git/.env.example']){
  const r=record(),f=facts();r.files[0].path=name;f.files[0].filename=name
  for(const kind of ['HISTORICAL_EVIDENCE','ENVIRONMENT_TEMPLATE']){
   const p={reviewedMetadata:{recordId:r.id,taskId:r.taskId,entries:{[name]:{sha:head,mode:'100644',kind}}}}
   assert.throws(()=>assertSourceAdmission(r,f,root,now,p),/SOURCE_ADMISSION_FILES_REJECTED/)
  }
 }
})

test('physical Source checkout retains Git lineage, complete diff and pristine-source checks with exact metadata review',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dev-reviewed-metadata-'))
 const g=(...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
 const name='apps/sg-runtime/operation-integration.json'
 try{
  g('init');g('config','user.name','Isolated Test');g('config','user.email','isolated@example.invalid')
  const file=path.join(dir,name);fs.mkdirSync(path.dirname(file),{recursive:true})
  fs.writeFileSync(file,'{"synthetic":1}\n');g('add','.');g('commit','-m','base')
  const initial=g('rev-parse','HEAD')
  fs.writeFileSync(file,'{"synthetic":2}\n');g('add','.');g('commit','-m','candidate')
  const candidate=g('rev-parse','HEAD'),blob=g('hash-object',name),{r,p}=metadataFixture(name)
  r.sourceSha=candidate;r.baseSha=initial;r.files[0].blob=blob;r.validFrom='2020-01-01';r.validUntil='2099-01-01'
  p.reviewedMetadata.entries[name].sha=blob
  const state={sha:candidate,actor:r.actor,controlSha:initial,files:[{filename:name,sha:blob,status:'modified'}]}
  assert.throws(()=>assertSourceCheckout(dir,r,state,root),/SOURCE_ADMISSION_FILES_REJECTED/)
  assertSourceCheckout(dir,r,state,root,p)
  fs.writeFileSync(file,'{"dirty":true}\n')
  assert.throws(()=>assertSourceCheckout(dir,r,state,root,p),/SOURCE_PHYSICAL_FILE_REJECTED/)
  g('checkout','--',name);fs.writeFileSync(path.join(dir,'extra.txt'),'unreviewed')
  assert.throws(()=>assertSourceCheckout(dir,r,state,root,p),/SOURCE_CHECKOUT_DIRTY/)
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
})

function localManifestFixture(policy){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dev-local-manifests-'))
 const candidate=path.join(dir,'candidate'),authority=path.join(dir,'authority')
 const manifestPaths=Object.values(policy.LOCAL_PACKAGES).map(rel=>path.relative(root,path.resolve(root,'apps/sg-runtime',rel,'package.json')))
 const paths=['apps/sg-runtime/package.json','apps/sg-runtime/package-lock.json','apps/sg-runtime/.npmrc',...manifestPaths]
  // Use one real complete pre-upgrade cohort even when this suite runs on1.38.
  const baseline=policy.PLATFORM_KNOWLEDGE_STAGE2_SRM_TARGET_REVIEW.sourceSha
 for(const targetRoot of [candidate,authority])for(const name of paths){
  const from=path.join(root,name);if(!fs.existsSync(from))continue
  const to=path.join(targetRoot,name);fs.mkdirSync(path.dirname(to),{recursive:true});fs.writeFileSync(to,execFileSync('git',['show',baseline+':'+name],{cwd:root,stdio:['ignore','pipe','pipe']}))
 }
 const blob=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex')
 const reviews={},lockFile=path.join(candidate,'apps/sg-runtime/package-lock.json')
 const lock=JSON.parse(fs.readFileSync(lockFile,'utf8'))
 for(const [name,version]of [['@profitia/platform-contracts','1.38.0'],['@profitia/platform-current-e1-authority','1.4.1']]){
  const relative=path.relative(root,path.resolve(root,'apps/sg-runtime',policy.LOCAL_PACKAGES[name],'package.json'))
  const file=path.join(candidate,relative),before=fs.readFileSync(path.join(authority,relative)),manifest=JSON.parse(before)
  assert.notEqual(manifest.version,version,'fixture starts before the requested upgrade')
   manifest.version=version
  if(name==='@profitia/platform-current-e1-authority')manifest.peerDependencies={'@profitia/platform-contracts':'1.37.0 || 1.38.0'}
  const after=Buffer.from(JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(file,after)
  reviews[name]={beforeBlob:blob(before),afterBlob:blob(after)}
  const metadata=lock.packages['node_modules/'+name];metadata.version=version
  if(manifest.peerDependencies===undefined)delete metadata.peerDependencies
  else metadata.peerDependencies=manifest.peerDependencies
 }
 fs.writeFileSync(lockFile,JSON.stringify(lock,null,2)+'\n')
 return {dir,candidate,authority,reviews,lockFile,blob,
  close:()=>fs.rmSync(dir,{recursive:true,force:true})}
}

test('local package upgrades require separately reviewed complete before/after manifests and exact lock metadata',async()=>{
 const policy=await import('./controlled-package-ci.mjs'),f=localManifestFixture(policy)
 try{
  assert.throws(()=>policy.checkAdmittedPackages(f.candidate,f.authority))
  assert.equal(policy.checkAdmittedPackages(f.candidate,f.authority,f.reviews),path.join(f.candidate,'apps/sg-runtime'))
  for(const edit of [
   r=>r['@profitia/platform-contracts'].beforeBlob=base,
   r=>r['@profitia/platform-contracts'].afterBlob=head,
   r=>r['@profitia/platform-contracts'].unchecked=true,
   r=>delete r['@profitia/platform-contracts'],
   r=>r['@profitia/unregistered-package']={beforeBlob:base,afterBlob:head}
  ]){
   const changed=structuredClone(f.reviews);edit(changed)
   assert.throws(()=>policy.checkAdmittedPackages(f.candidate,f.authority,changed))
  }
  const lock=JSON.parse(fs.readFileSync(f.lockFile,'utf8'))
  lock.packages['node_modules/@profitia/platform-current-e1-authority'].peerDependencies['@profitia/platform-contracts']='*'
  fs.writeFileSync(f.lockFile,JSON.stringify(lock))
  assert.throws(()=>policy.checkAdmittedPackages(f.candidate,f.authority,f.reviews),/LOCAL_PACKAGE_LOCK_METADATA_MISMATCH/)
 }finally{f.close()}
})

test('reviewed local metadata never permits a changed private artifact, registry configuration or source manifest',async()=>{
 const policy=await import('./controlled-package-ci.mjs')
 for(const edit of [
  f=>{const lock=JSON.parse(fs.readFileSync(f.lockFile,'utf8'));lock.packages['node_modules/'+policy.PRIVATE_PACKAGES[0]].integrity='sha512-unapproved';fs.writeFileSync(f.lockFile,JSON.stringify(lock))},
  f=>fs.appendFileSync(path.join(f.candidate,'apps/sg-runtime/.npmrc'),'registry=https://attacker.invalid\n'),
  f=>fs.appendFileSync(path.join(f.candidate,'packages/platform-contracts/package.json'),' '),
  f=>{const file=path.join(f.candidate,'packages/platform-contracts/package.json');const m=JSON.parse(fs.readFileSync(file,'utf8'));m.scripts.postinstall='unapproved';fs.writeFileSync(file,JSON.stringify(m))},
  f=>{const file=path.join(f.authority,'packages/platform-contracts/package.json');fs.appendFileSync(file,' ')}
 ]){
  const f=localManifestFixture(policy)
  try{edit(f);assert.throws(()=>policy.checkAdmittedPackages(f.candidate,f.authority,f.reviews))}
  finally{f.close()}
 }
})

function currentSdkProofFixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dev-current-sdk-proof-')),candidate=path.join(dir,'candidate')
 const metadataPath='apps/architecture-lab/current-sdk-source.json'
 const bytes=fs.readFileSync(path.join(root,metadataPath)),record=JSON.parse(bytes)
 // Source objects come from this repository's immutable Git history. A clean
 // runner needs the reviewed Source branch fetched, never a sibling workspace.
 assert.match(record.sourceSnapshotSha,/^[a-f0-9]{40}$/)
 execFileSync('git',['cat-file','-e',record.sourceSnapshotSha+'^{commit}'],{cwd:root,stdio:['ignore','pipe','pipe']})
 execFileSync('git',['clone','--quiet','--shared','--no-checkout',root,candidate],{stdio:['ignore','pipe','pipe']})
 execFileSync('git',['--literal-pathspecs','checkout',record.sourceSnapshotSha,'--',...Object.keys(record.inputs)],{cwd:candidate,stdio:['ignore','pipe','pipe']})
 for(const name of Object.keys(record.inputs))assert(fs.lstatSync(path.join(candidate,name)).isFile()&&!fs.lstatSync(path.join(candidate,name)).isSymbolicLink())
 const metadataFile=path.join(candidate,metadataPath);fs.mkdirSync(path.dirname(metadataFile),{recursive:true});fs.writeFileSync(metadataFile,bytes)
 const receiptBytes=fs.readFileSync(path.join(candidate,'apps/sg-runtime/operation-integration.json'))
 const sdkManifestBytes=fs.readFileSync(path.join(candidate,'packages/platform-contracts/package.json'))
 return{dir,candidate,bytes,record,metadataFile,receiptBytes,sdkManifestBytes,receipt:JSON.parse(receiptBytes),
  close:()=>fs.rmSync(dir,{recursive:true,force:true})}
}

test('current SDK proof uses trusted physical metadata and keeps default Root16 in controlled and public contracts',async()=>{
 const policy=await import('./controlled-package-ci.mjs'),f=currentSdkProofFixture()
 try{
  const context=policy.currentSdkProofContext(f.candidate,root)
  assert.equal(context.record.platformVersion,'1.38.0')
  const expected=policy.currentProofContract(f.candidate,f.receipt,root)
  assert.equal(expected.implementation,'1.0.0-candidate.16')
  assert.equal(expected.sourceDigest,f.record.metadata.sdkDigests.operationSourceDigest)
  assert.deepEqual(policy.publicProofContract(f.receipt,{receiptBytes:f.receiptBytes,sdkManifestBytes:f.sdkManifestBytes,
   currentSdkRecord:f.bytes,authorityRoot:root}),expected)
  for(const flag of ['runtimeActivated','permissionsChanged','providerCallsPerformed','deploymentPerformed'])assert.equal(context.record[flag],false)
 }finally{f.close()}
})

test('public proof cannot replace trusted metadata, change the exact SDK manifest or activate another Root',async()=>{
 const policy=await import('./controlled-package-ci.mjs'),f=currentSdkProofFixture()
 try{
  const args={receiptBytes:f.receiptBytes,sdkManifestBytes:f.sdkManifestBytes,currentSdkRecord:f.bytes,authorityRoot:root}
  for(const delta of [
   {currentSdkRecord:null},{currentSdkRecord:Buffer.concat([f.bytes,Buffer.from(' ')])},
   {sdkManifestBytes:Buffer.concat([f.sdkManifestBytes,Buffer.from(' ')])}
  ])assert.throws(()=>policy.publicProofContract(f.receipt,{...args,...delta}),/CURRENT_SDK_SOURCE_METADATA_REJECTED/)
  for(const edit of [
   r=>r.runtimeActivated=true,r=>r.permissionsChanged=true,
   r=>r.scope='RUNTIME_ACTIVATION',r=>r.metadata.defaultRootImplementation='1.0.0-candidate.24',
   r=>r.metadata.sdkDigests.operationSourceDigest='unverified'
  ]){
   const record=structuredClone(f.record);edit(record)
   assert.throws(()=>policy.currentSdkMetadataProofContract(f.receipt,record))
  }
 }finally{f.close()}
})

test('current SDK proof rejects changed current source and missing or altered candidate metadata',async()=>{
 const policy=await import('./controlled-package-ci.mjs'),f=currentSdkProofFixture()
 try{
  const file=path.join(f.candidate,'packages/platform-contracts/src/organisation-context.mjs'),before=fs.readFileSync(file)
  fs.appendFileSync(file,'\n// altered')
  assert.throws(()=>policy.currentProofContract(f.candidate,f.receipt,root),/current SDK source/)
  fs.writeFileSync(file,before);fs.appendFileSync(f.metadataFile,' ')
  assert.throws(()=>policy.currentSdkProofContext(f.candidate,root),/CURRENT_SDK_SOURCE_METADATA_REJECTED/)
  fs.unlinkSync(f.metadataFile)
  assert.throws(()=>policy.currentSdkProofContext(f.candidate,root),/CURRENT_SDK_SOURCE_METADATA_REJECTED/)
 }finally{f.close()}
})

test('trusted SDK descriptor binds exact protected imports to one Source row and task',async()=>{
 const policy=await import('./controlled-package-ci.mjs'),authority=fs.mkdtempSync(path.join(os.tmpdir(),'sdk-policy-authority-'))
 const file=path.join(authority,'apps/architecture-lab/current-sdk-source.json')
 const {r,f,p}=metadataFixture('apps/sg-runtime/operation-integration.json')
 const descriptor={recordId:r.id,taskId:r.taskId,reviewedMetadata:p.reviewedMetadata.entries,localPackages:{}}
 const record={schemaVersion:'1.0',scope:'CURRENT_SDK_SOURCE_INTEGRITY_ONLY',runtimeActivated:false,
  permissionsChanged:false,providerCallsPerformed:false,deploymentPerformed:false,sourceAdmission:descriptor}
 const write=v=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(v))}
 try{
  write(record)
  const selected=policy.currentSdkSourceAdmissionPolicy(r,authority)
  assert.deepEqual(selected.reviewedMetadata,p.reviewedMetadata)
  assertSourceAdmission(r,f,root,now,selected)
  assert.equal(policy.currentSdkSourceAdmissionPolicy({...r,id:'other'},authority),undefined)
  assert.equal(policy.currentSdkSourceAdmissionPolicy({...r,taskId:'other'},authority),undefined)
  assert.equal(policy.currentSdkSourceAdmissionPolicy(null,authority),undefined)
  // A Source-row claim is not an authority descriptor.
  fs.rmSync(file);r.reviewedMetadata=p.reviewedMetadata
  assert.equal(policy.currentSdkSourceAdmissionPolicy(r,authority),undefined)
  assert.throws(()=>assertSourceAdmission(r,f,root,now),/SOURCE_ADMISSION_FILES_REJECTED/)
  for(const change of [
   v=>v.runtimeActivated=true,v=>v.sourceAdmission.extra=true,
   v=>v.sourceAdmission.reviewedMetadata[r.files[0].path].mode='100755',
   v=>v.sourceAdmission.reviewedMetadata[r.files[0].path].sha='bad',
   v=>v.sourceAdmission.localPackages['unregistered']={beforeBlob:base,afterBlob:head}
  ]){
   const changed=structuredClone(record);change(changed);write(changed)
   assert.throws(()=>policy.currentSdkSourceAdmissionPolicy(r,authority),/CURRENT_SDK_SOURCE_POLICY_REJECTED/)
  }
 }finally{fs.rmSync(authority,{recursive:true,force:true})}
})

test('trusted SDK Source selector supplies exact local manifest transitions while default guards stay strict',async()=>{
 const policy=await import('./controlled-package-ci.mjs'),f=localManifestFixture(policy),r=record()
 const file=path.join(f.authority,'apps/architecture-lab/current-sdk-source.json')
 try{
  fs.mkdirSync(path.dirname(file),{recursive:true})
  fs.writeFileSync(file,JSON.stringify({schemaVersion:'1.0',scope:'CURRENT_SDK_SOURCE_INTEGRITY_ONLY',
   runtimeActivated:false,permissionsChanged:false,providerCallsPerformed:false,deploymentPerformed:false,
   sourceAdmission:{recordId:r.id,taskId:r.taskId,reviewedMetadata:{},localPackages:f.reviews}}))
  assert.throws(()=>policy.checkAdmittedPackages(f.candidate,f.authority),/LOCAL_PACKAGE_VERSION_MISMATCH/)
  const selected=policy.currentSdkSourceAdmissionPolicy(r,f.authority)
  assert.doesNotThrow(()=>policy.checkAdmittedPackages(f.candidate,f.authority,selected.reviewedLocalPackages))
  assert.equal(policy.currentSdkSourceAdmissionPolicy({...r,id:'other'},f.authority),undefined)
  const manifest=path.join(f.candidate,'packages/platform-contracts/package.json')
  fs.appendFileSync(manifest,' ')
  assert.throws(()=>policy.checkAdmittedPackages(f.candidate,f.authority,selected.reviewedLocalPackages),/LOCAL_PACKAGE_TRANSITION_REJECTED/)
 }finally{f.close()}
})

test('public Source proof revalidates protected metadata against the same trusted SDK policy',async()=>{
 const policy=await import('./controlled-package-ci.mjs'),authority=fs.mkdtempSync(path.join(os.tmpdir(),'sdk-source-proof-'))
 const {r,p}=metadataFixture('apps/sg-runtime/operation-integration.json')
 const recordFile=path.join(authority,'apps/architecture-lab/current-sdk-source.json')
 try{
  fs.mkdirSync(path.join(authority,'Canon/registries'),{recursive:true})
  for(const name of ['profitia-projects-v1.json','current-architecture-baseline-v1.json'])
   fs.copyFileSync(path.join(root,'Canon/registries',name),path.join(authority,'Canon/registries',name))
  r.validFrom='2000-01-01';r.validUntil='2099-01-01'
  fs.writeFileSync(path.join(authority,'Canon/registries/controlled-source-admissions-v1.json'),JSON.stringify({schemaVersion:'1.0',records:[r]}))
  fs.mkdirSync(path.dirname(recordFile),{recursive:true})
  fs.writeFileSync(recordFile,JSON.stringify({schemaVersion:'1.0',scope:'CURRENT_SDK_SOURCE_INTEGRITY_ONLY',
   runtimeActivated:false,permissionsChanged:false,providerCallsPerformed:false,deploymentPerformed:false,
   sourceAdmission:{recordId:r.id,taskId:r.taskId,reviewedMetadata:p.reviewedMetadata.entries,localPackages:{}}}))
  const digest='c'.repeat(64),run={id:123,workflow_id:456,repository:{full_name:'profitia/SG-dev'},
   head_branch:'main',head_sha:base,event:'workflow_dispatch',actor:{login:'profitia'},conclusion:'success'}
  const proof={schemaVersion:'2.0',repository:'profitia/SG-dev',workflow:'.github/workflows/platform-contracts-ci.yml',
   scope:'EXACT_SOURCE_VALIDATION',targetEnvironment:'development',candidateSha:head,controlSha:base,runId:'123',
   executionWorkspace:'ISOLATED_GIT_CHECKOUT',executionCheckoutSha:head,sourceInputVerifiedBeforeExecution:true,sourceInputVerifiedAfterExecution:true,
   controlPolicyDigest:digest,sourceAdmissionId:r.id,sourceAdmissionDigest:sourceAdmissionDigest(r),originalSourceSha:head,
   credentialRemovedBeforeCandidateExecution:true,privatePackageArtifactsPublished:false,productDeploymentPerformed:false,
   customerIdentityAdapterVerified:false,install:'CLEAN_REGISTRY_IGNORE_SCRIPTS',tests:'PASS',typecheck:'PASS',build:'PASS'}
  assert.throws(()=>assertSourceValidationProof(proof,run,head,456,{expectedControlDigest:digest},authority),/SOURCE_ADMISSION_FILES_REJECTED/)
  const selected=policy.currentSdkSourceAdmissionPolicy(r,authority)
  assertSourceValidationProof(proof,run,head,456,{expectedControlDigest:digest},authority,selected)
  const changed=structuredClone(selected);changed.reviewedMetadata.taskId='foreign'
  assert.throws(()=>assertSourceValidationProof(proof,run,head,456,{expectedControlDigest:digest},authority,changed),/SOURCE_ADMISSION_FILES_REJECTED/)
 }finally{fs.rmSync(authority,{recursive:true,force:true})}
})


import {CURRENT_SDK_SOURCE_REGRESSION_TESTS} from './development-execution.mjs'
test('current SDK regression admission is confined to two exact reviewed tests, blobs and Architecture routing',()=>{
 assert(Object.isFrozen(CURRENT_SDK_SOURCE_REGRESSION_TESTS))
 assert.deepEqual(CURRENT_SDK_SOURCE_REGRESSION_TESTS,[
  'scripts/governance/controlled-package-ci.test.mjs',
  'scripts/governance/platform-source-hub-foundation.test.mjs'])
 for(const name of CURRENT_SDK_SOURCE_REGRESSION_TESTS){
  const route=resolveProjectRouting({profile:resolveProjectProfile('ARCHITECTURE',root),targets:[name],repositoryRoot:root}).results[0]
  assert.equal(route.projectBoundaryStatus,'ALLOWED');assert.equal(route.baselineClassification,'ALIGNED')
  const r=record(),f=facts();r.files=[{path:name,blob:head,status:'modified',mode:'100644',projectKey:'ARCHITECTURE',owner:route.currentOwner,surfaceId:route.matchedSurfaceId}]
  f.files=[{filename:name,sha:head,status:'modified'}]
  const p={reviewedMetadata:{recordId:r.id,taskId:r.taskId,entries:{[name]:{sha:head,mode:'100644',kind:'SDK_COMPATIBILITY_REGRESSION'}}}}
  assert.throws(()=>assertSourceAdmission(r,f,root,now));r.reviewedMetadata=p.reviewedMetadata
  assert.throws(()=>assertSourceAdmission(r,f,root,now));assertSourceAdmission(r,f,root,now,p)
  for(const mutate of [v=>v.reviewedMetadata.recordId='other',v=>v.reviewedMetadata.taskId='other',v=>v.reviewedMetadata.entries[name].sha=base,v=>v.reviewedMetadata.entries[name].mode='100755']){
   const v=structuredClone(p);mutate(v);assert.throws(()=>assertSourceAdmission(r,f,root,now,v))
  }
  for(const mutate of [v=>v.files[0].status='added',v=>v.files[0].projectKey='SG2',v=>v.files[0].mode='100755']){
   const v=structuredClone(r);mutate(v);assert.throws(()=>assertSourceAdmission(v,{...f,files:v.files.map(e=>({filename:e.path,sha:e.blob,status:e.status}))},root,now,p))
  }
 }
 for(const name of ['scripts/governance/controlled-package-ci.mjs','scripts/governance/development-execution.mjs','scripts/governance/other.test.mjs','.github/workflows/platform-contracts-ci.yml','AGENTS.md','Canon/registries/controlled-source-admissions-v1.json','apps/sg-runtime/.env']){
  const r=record(),f=facts();r.files[0].path=name;f.files[0].filename=name
  const p={reviewedMetadata:{recordId:r.id,taskId:r.taskId,entries:{[name]:{sha:head,mode:'100644',kind:'SDK_COMPATIBILITY_REGRESSION'}}}}
  assert.throws(()=>assertSourceAdmission(r,f,root,now,p),/SOURCE_ADMISSION_FILES_REJECTED/)
 }
})
test('trusted SDK selector rejects regression kind on every path outside the finite two-test set',async()=>{
 const policy=await import('./controlled-package-ci.mjs'),authority=fs.mkdtempSync(path.join(os.tmpdir(),'sdk-regression-policy-'))
 const file=path.join(authority,'apps/architecture-lab/current-sdk-source.json'),r=record()
 try{
  fs.mkdirSync(path.dirname(file),{recursive:true})
  for(const name of [...CURRENT_SDK_SOURCE_REGRESSION_TESTS,'scripts/governance/other.test.mjs','scripts/governance/controlled-package-ci.mjs','AGENTS.md']){
   fs.writeFileSync(file,JSON.stringify({schemaVersion:'1.0',scope:'CURRENT_SDK_SOURCE_INTEGRITY_ONLY',runtimeActivated:false,permissionsChanged:false,providerCallsPerformed:false,deploymentPerformed:false,
    sourceAdmission:{recordId:r.id,taskId:r.taskId,localPackages:{},reviewedMetadata:{[name]:{sha:head,mode:'100644',kind:'SDK_COMPATIBILITY_REGRESSION'}}}}))
   if(CURRENT_SDK_SOURCE_REGRESSION_TESTS.includes(name))assert.equal(policy.currentSdkSourceAdmissionPolicy(r,authority).reviewedMetadata.entries[name].sha,head)
   else assert.throws(()=>policy.currentSdkSourceAdmissionPolicy(r,authority),/CURRENT_SDK_SOURCE_POLICY_REJECTED/)
  }
 }finally{fs.rmSync(authority,{recursive:true,force:true})}
})
