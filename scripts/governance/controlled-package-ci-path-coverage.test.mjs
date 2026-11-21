import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import {CONTROL_POLICY_FILES,REPOSITORY,WORKFLOW} from './controlled-package-ci.mjs'

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
 // The immutable application snapshot keeps its historical control files.
 // Only these current policy inputs are overlaid, each against the descriptor.
 for(const name of ['packages/platform-contracts/test/sdk-source-context.mjs',
  'packages/platform-contracts/test/sdk-source-context.test.mjs',
  'scripts/governance/controlled-package-ci-path-coverage.test.mjs']){
  const source=path.join(root,name),stat=fs.lstatSync(source)
  assert(stat.isFile()&&!stat.isSymbolicLink(),'physical current policy input '+name)
  const bytes=fs.readFileSync(source)
  assert.equal(createHash('sha256').update(bytes).digest('hex'),record.inputs[name],'declared current policy input '+name)
  fs.writeFileSync(path.join(candidate,name),bytes)
 }
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


// The shared controlled-package-ci.test.mjs is pinned by admitted ACG source.
// Exercise this exact continuation here without changing those accepted bytes.
test('current Knowledge and admitted ACG composition closes every owner and refuses any substituted source',async()=>{
 const c=await import('./controlled-package-ci.mjs'),review=c.PLATFORM_KNOWLEDGE_STAGE2_ACG_COMPOSITION_REVIEW,cfg=c.PLATFORM_KNOWLEDGE_STAGE2_ACG_COMPOSITION_PROVENANCE;
 const os=await import('node:os'),temporary=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'knowledge-acg-closed-review-')));
 const git=(cwd,...args)=>execFileSync('git',['-c','core.hooksPath=/dev/null',...args],{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 try{
  git(temporary,'clone','--quiet','--shared','--no-checkout',root,'source');const checkout=path.join(temporary,'source');
  git(checkout,'checkout','--quiet','--detach',review.sourceSha);
  // Bind this disposable source fixture to the actual captured trusted authority.
  git(checkout,'update-ref','refs/remotes/origin/main',review.baseSha);
  const files=Object.entries(review.entries).map(([filename,e])=>({filename,sha:e.sha,status:e.status}));
  assert.equal(files.length,145);assert.equal(cfg.sourceFileCount,478);assert.equal(cfg.receiptFileCount,33);
  const admission={kind:'ARCHITECTURE',baseSha:review.baseSha,files};
  c.assertArchitectureFiles({changed_files:files.length,base:{sha:review.baseSha}},files);
  c.assertArchitectureCheckout(checkout,review.sourceSha,admission);
  for(const changed of [files.slice(1),[...files,{filename:'apps/srm/src/server/unapproved.ts',sha:'a'.repeat(40),status:'added'}],files.map((f,i)=>i===0?{...f,sha:'a'.repeat(40)}:f),files.map((f,i)=>i===0?{...f,previous_filename:'foreign.ts'}:f)])
   assert.throws(()=>c.assertArchitectureFiles({changed_files:changed.length,base:{sha:review.baseSha}},changed));
  const entry=files.find(f=>f.filename==='apps/srm/src/server/root-atomic-claim-adoption.test.ts');assert(entry);
  assert.throws(()=>c.assertKnowledgeStage2Entry(entry,'100755 blob '+entry.sha+'	'+entry.filename+'\0',review));
  const cache=new Map(),history=(sha,p)=>{const key=sha+':'+p;if(!cache.has(key))cache.set(key,execFileSync('git',['show',key],{cwd:checkout,stdio:['ignore','pipe','pipe']}));return cache.get(key)};
  const read=p=>fs.readFileSync(path.join(checkout,p));const current=c.knowledgeStage2TrustedPredecessor(read,history);assert(current);
  assert.equal(current.manifest.sdkDigests.operationSourceDigest,cfg.operationSourceDigest);
  assert.deepEqual(current.manifest.optionalPackageDigests,cfg.optionalPackageDigests);
  const legacy=c.knowledgeStage2LegacyPredecessor(read,history);assert(legacy);
  assert.equal(legacy.manifest.sdkDigests.operationSourceDigest,cfg.operationSourceDigest);
  const original='packages/platform-contracts/src/assistant-usage.mjs';
  assert.deepEqual(legacy.previousBytes(original),history(current.manifest.previousSourceSha,original));
  assert.deepEqual(legacy.legacyPreviousBytes(original),history('c31fd80278561adec8d066392417bb057d191192',original));
  const receipt=JSON.parse(read('apps/sg-runtime/operation-integration.json'));
  assert.equal(c.currentProofContract(checkout,receipt).sourceDigest,cfg.operationSourceDigest);
  const oldReceipt='apps/sg-runtime/operation-integration.json';
  assert.throws(()=>c.knowledgeStage2LegacyPredecessor(read,(sha,p)=>sha==='c31fd80278561adec8d066392417bb057d191192'&&p===oldReceipt?Buffer.concat([history(sha,p),Buffer.from('UNREVIEWED')]):history(sha,p)));

  for(const p of ['apps/architecture-lab/assistant-reservation-source.json','packages/platform-contracts/test/assistant-reservation-source.mjs','packages/platform-contracts/src/assistant-usage.mjs','apps/srm/deployment/root-atomic-claim-targets.json','apps/srm/src/server/root-atomic-claim-adoption.test.ts','scripts/governance/controlled-package-ci.test.mjs','apps/sg-runtime/finder-monitor-source-integration.json'])
   assert.throws(()=>c.knowledgeStage2TrustedPredecessor(f=>f===p?Buffer.concat([read(f),Buffer.from('UNREVIEWED')]):read(f),history),p);
  const target=path.join(checkout,entry.filename),bytes=fs.readFileSync(target);fs.appendFileSync(target,'UNREVIEWED');
  assert.throws(()=>c.assertArchitectureCheckout(checkout,review.sourceSha,admission));fs.writeFileSync(target,bytes);
  fs.writeFileSync(path.join(checkout,'extra-unreviewed.txt'),'SYNTHETIC_ONLY');git(checkout,'add','extra-unreviewed.txt');
  git(checkout,'-c','user.name=Synthetic source fixture','-c','user.email=synthetic@example.invalid','commit','--quiet','-m','SYNTHETIC_ONLY additional source');
  assert.throws(()=>c.assertArchitectureCheckout(checkout,git(checkout,'rev-parse','HEAD'),admission));
 }finally{fs.rmSync(temporary,{recursive:true,force:true})}
});


// Calendar exact review regressions share the protected coverage module so the
// independently frozen Knowledge controlled-package-ci.test.mjs stays unchanged.
const calendarAuthorityRoot=root
const calendarContext=()=>({repository:REPOSITORY,ref:'refs/heads/main',workflowRef:`${REPOSITORY}/${WORKFLOW}@refs/heads/main`,event:'workflow_dispatch',actor:'profitia',triggeringActor:'profitia',controlSha:'a'.repeat(40)})
const calendarPr=()=>({state:'open',user:{login:'profitia'},base:{ref:'main',repo:{full_name:REPOSITORY}},head:{sha:'b'.repeat(40),ref:'sg2/integration',repo:{full_name:REPOSITORY}}})
// Current protected review uses schema2; all historical reviews remain unchanged.
test('Calendar schema2 protected review fences 83 exact files and preserves the original58+7 and75 input',async()=>{
 const c=await import('./controlled-package-ci.mjs'),r=c.CALENDAR_PK_PROTECTED_REVIEW,files=Object.entries(r.entries).map(([filename,e])=>({filename,status:e.status,sha:e.sha})),candidate={...calendarPr(),number:r.prNumber,changed_files:files.length,base:{...calendarPr().base,sha:r.baseSha},head:{...calendarPr().head,ref:r.branch,sha:r.sourceSha}},ctx={...calendarContext(),controlSha:r.baseSha}
 assert.equal(files.length,83);assert.equal(Object.keys(c.ECR_COMPLETE_FUNCTIONAL_REVIEW.entries).length,58);assert.equal(Object.keys(c.ECR_COMPLETE_FUNCTIONAL_CONSUMER_REVIEW.entries).length,7);assert.equal(Object.keys(c.ECR_COMPLETE_FUNCTIONAL_CI_REPAIR.entries).length,75);assert.equal(c.ECR_COMPLETE_FUNCTIONAL_CI_REPAIR.sourceSha,'69d02834e863a51506aa4f50fbeb20f7fda3575b')
 assert.equal(c.selectCandidate(ctx,candidate,r.sourceSha,{files}),r.sourceSha)
 for(const changed of [{...candidate,number:1064},{...candidate,user:{login:'foreign'}},{...candidate,head:{...candidate.head,ref:'architecture/foreign'}},{...candidate,head:{...candidate.head,repo:{full_name:'foreign/repository'}}},{...candidate,base:{...candidate.base,sha:'f'.repeat(40)}}])assert.throws(()=>c.selectCandidate(ctx,changed,r.sourceSha,{files}))
 for(const mutate of [a=>a.pop(),a=>a.push({...a[0]}),a=>a[0].sha='f'.repeat(40),a=>a[0].status='removed',a=>a[0].previous_filename='foreign']){
  const altered=structuredClone(files);mutate(altered);assert.throws(()=>c.selectCandidate(ctx,{...candidate,changed_files:altered.length},r.sourceSha,{files:altered}))
 }
 for(const f of files){c.assertCompleteFunctionalReviewEntry(f,'100644 blob '+f.sha+'\t'+f.filename+'\0',r);assert.throws(()=>c.assertCompleteFunctionalReviewEntry(f,'100755 blob '+f.sha+'\t'+f.filename+'\0',r))}
})
test('Calendar schema2 protected physical source rejects dirt, symlinks, modes, missing input and wrong lineage before package work',async()=>{
 const c=await import('./controlled-package-ci.mjs'),r=c.CALENDAR_PK_PROTECTED_REVIEW,files=Object.entries(r.entries).map(([filename,e])=>({filename,status:e.status,sha:e.sha})),temporary=fs.mkdtempSync(path.join(os.tmpdir(),'calendar-schema2-checkout-')),root=path.join(temporary,'source')
 try{
  execFileSync('git',['clone','--shared','--no-checkout','--',calendarAuthorityRoot,root],{stdio:['ignore','pipe','pipe']});execFileSync('git',['checkout','--detach',r.sourceSha],{cwd:root,stdio:['ignore','pipe','pipe']})
  const state={sha:r.sourceSha,admission:{kind:'ARCHITECTURE',baseSha:r.baseSha,files}},result=c.assertCalendarPkProtectedSource(root,state)
  assert.deepEqual(result,{protectedSourceReviewId:r.reviewId,protectedSourceReviewDigest:c.calendarPkProtectedReviewDigest(),originalSourceSha:r.sourceSha})
  assert.throws(()=>c.assertCalendarPkProtectedSource(root,{...state,admission:{...state.admission,files:files.slice(1)}}))
  const target=path.join(root,'packages/platform-source-hub-contracts/package.json'),before=fs.readFileSync(target)
  fs.appendFileSync(target,' ');assert.throws(()=>c.assertCalendarPkProtectedSource(root,state));fs.writeFileSync(target,before)
  fs.chmodSync(target,0o755);assert.throws(()=>c.assertCalendarPkProtectedSource(root,state));fs.chmodSync(target,0o644)
  const other=path.join(temporary,'same-bytes.json');fs.writeFileSync(other,before);fs.unlinkSync(target);fs.symlinkSync(other,target);assert.throws(()=>c.assertCalendarPkProtectedSource(root,state));fs.unlinkSync(target);assert.throws(()=>c.assertCalendarPkProtectedSource(root,state));fs.writeFileSync(target,before,{mode:0o644})
  const extra=path.join(root,'unreviewed-calendar.mjs');fs.writeFileSync(extra,'unreviewed');assert.throws(()=>c.assertCalendarPkProtectedSource(root,state));fs.unlinkSync(extra)
  assert.throws(()=>c.assertCalendarPkProtectedSource(root,{...state,admission:{...state.admission,baseSha:'77369b63888c5fa66d8d8159d5e8f36a23d25c83'}}))
 }finally{fs.rmSync(temporary,{recursive:true,force:true})}
})
test('Calendar schema2 protected package upgrade needs its exact trusted review and the exact accepted PK metadata',async()=>{
 const c=await import('./controlled-package-ci.mjs'),r=c.CALENDAR_PK_PROTECTED_REVIEW,temporary=fs.mkdtempSync(path.join(os.tmpdir(),'calendar-schema2-packages-')),root=path.join(temporary,'source'),accepted=path.join(temporary,'accepted')
 const clone=(target,sha)=>{execFileSync('git',['clone','--shared','--no-checkout','--',calendarAuthorityRoot,target],{stdio:['ignore','pipe','pipe']});execFileSync('git',['checkout','--detach',sha],{cwd:target,stdio:['ignore','pipe','pipe']})}
 try{
  clone(root,r.sourceSha);clone(accepted,r.baseSha)
  assert.throws(()=>c.checkAdmittedPackages(root,accepted),/LOCAL_PACKAGE_VERSION_MISMATCH/)
  assert.throws(()=>c.checkAdmittedPackages(root,accepted,undefined,{...r}),/LOCAL_PACKAGE_VERSION_MISMATCH/)
  assert.throws(()=>c.checkAdmittedPackages(root,accepted,r),/LOCAL_PACKAGE_TRANSITION_REJECTED/)
  assert.equal(c.checkAdmittedPackages(root,accepted,undefined,r),path.join(root,'apps/sg-runtime'))
  const historicalAuthority=path.join(temporary,'old-authority');clone(historicalAuthority,'d5eb40a061dd24c5ea65f9f373682179458cb589');assert.throws(()=>c.checkAdmittedPackages(root,historicalAuthority,undefined,r))
  const p=path.join(root,'packages/platform-source-hub-contracts/package.json'),before=fs.readFileSync(p),a=JSON.parse(before)
  fs.writeFileSync(p,JSON.stringify({...a,version:'1.8.1'}));assert.throws(()=>c.checkAdmittedPackages(root,accepted,undefined,r));fs.writeFileSync(p,before)
  fs.writeFileSync(p,JSON.stringify({...a,peerDependencies:{'@profitia/platform-current-e1-authority':'^1.4.0'}}));assert.throws(()=>c.checkAdmittedPackages(root,accepted,undefined,r));fs.writeFileSync(p,before)
  const authorityFile=path.join(accepted,'packages/platform-source-hub-contracts/package.json'),acceptedBefore=fs.readFileSync(authorityFile);fs.appendFileSync(authorityFile,' ');assert.throws(()=>c.checkAdmittedPackages(root,accepted,undefined,r));fs.writeFileSync(authorityFile,acceptedBefore)
  const lockFile=path.join(root,'apps/sg-runtime/package-lock.json'),lockBefore=fs.readFileSync(lockFile),lockJson=JSON.parse(lockBefore);lockJson.packages['node_modules/'+c.PRIVATE_PACKAGES[0]].integrity='sha512-unreviewed';fs.writeFileSync(lockFile,JSON.stringify(lockJson));assert.throws(()=>c.checkAdmittedPackages(root,accepted,undefined,r))
 }finally{fs.rmSync(temporary,{recursive:true,force:true})}
})
test('Calendar schema2 protected proof binds exact refresh, original input, review, control and whole trusted run without legacy contract claims',async()=>{
 const c=await import('./controlled-package-ci.mjs'),r=c.CALENDAR_PK_PROTECTED_REVIEW,candidate='e'.repeat(40),control='d'.repeat(40),digest=c.controlPolicyDigest(),workflowId=383640662
 const run={id:123,workflow_id:workflowId,repository:{full_name:REPOSITORY},head_branch:'main',head_sha:control,event:'workflow_dispatch',actor:{login:'profitia'},conclusion:'success'}
 const p={schemaVersion:'2.0',repository:REPOSITORY,workflow:WORKFLOW,targetEnvironment:'development',scope:'EXACT_PROTECTED_SOURCE_VALIDATION',candidateSha:candidate,controlSha:control,executionWorkspace:'ISOLATED_GIT_CHECKOUT',executionCheckoutSha:candidate,sourceInputVerifiedBeforeExecution:true,sourceInputVerifiedAfterExecution:true,protectedSourceReviewId:r.reviewId,protectedSourceReviewDigest:c.calendarPkProtectedReviewDigest(),originalSourceSha:r.sourceSha,controlPolicyDigest:digest,runId:run.id,install:'CLEAN_REGISTRY_IGNORE_SCRIPTS',credentialRemovedBeforeCandidateExecution:true,privatePackageArtifactsPublished:false,tests:'PASS',typecheck:'PASS',build:'PASS',productDeploymentPerformed:false,customerIdentityAdapterVerified:false}
 assert.equal(c.assertProof(p,run,candidate,workflowId),p)
 for(const change of [{candidateSha:r.sourceSha},{originalSourceSha:'f'.repeat(40)},{controlSha:'f'.repeat(40)},{runId:124},{workflow:'foreign'},{repository:'foreign/repository'},{targetEnvironment:'staging'},{scope:'ISOLATED_API_AND_PERSISTENCE'},{schemaVersion:'1.0'},{protectedSourceReviewId:'foreign'},{protectedSourceReviewDigest:'f'.repeat(64)},{controlPolicyDigest:'f'.repeat(64)},{executionWorkspace:'SHARED_CHECKOUT'},{executionCheckoutSha:'f'.repeat(40)},{sourceInputVerifiedBeforeExecution:false},{sourceInputVerifiedAfterExecution:false},{credentialRemovedBeforeCandidateExecution:false},{privatePackageArtifactsPublished:true},{productDeploymentPerformed:true},{customerIdentityAdapterVerified:true},{install:'REUSED_CACHE'},{tests:'SKIPPED'},{typecheck:'SKIPPED'},{build:'FAIL'},{sourceAdmissionId:'foreign'},{sourceAdmissionDigest:'f'.repeat(64)},{contract:{id:'profitia.operation-context'}},{unreviewed:true}])assert.throws(()=>c.assertProof({...p,...change},run,candidate,workflowId),JSON.stringify(change))
 for(const key of Object.keys(p)){const copy={...p};delete copy[key];assert.throws(()=>c.assertProof(copy,run,candidate,workflowId),key)}
 for(const change of [{conclusion:'failure'},{conclusion:null},{workflow_id:12},{head_branch:'foreign'},{event:'pull_request'},{actor:{login:'foreign'}},{repository:{full_name:'foreign/repository'}}])assert.throws(()=>c.assertProof(p,{...run,...change},candidate,workflowId))
 assert.throws(()=>c.assertProof(p,run,'f'.repeat(40),workflowId))
 const inProgress={...run,event:'workflow_dispatch',conclusion:null};assert.throws(()=>c.assertProof(p,inProgress,candidate,workflowId,{currentRunId:run.id,currentRef:'refs/heads/main',completedJobs:[{name:'SG2 controlled operation integration',conclusion:'success'}]}))
 const sameMain={...run,event:'push',conclusion:null};assert.equal(c.assertProof(p,sameMain,candidate,workflowId,{currentRunId:run.id,currentRef:'refs/heads/main',completedJobs:[{name:'SG2 controlled operation integration',conclusion:'success'}]}),p)
})

// The authority validates immutable historical inputs before candidate execution.
// A shallow control checkout loses the accepted Knowledge ancestor and must not
// be mistaken for a package, source or credential failure.
test('controlled authority checkout retains pinned main and full validation history without persisted credentials',()=>{
 const job=text.slice(text.indexOf('  controlled-sg2:'),text.indexOf('  policy-probe:')<0?undefined:text.indexOf('  policy-probe:'))
 const checkout=job.match(/      - uses: actions\/checkout@11d5960a326750d5838078e36cf38b85af677262\n        with:\n((?:          .*\n)+)/)
 assert(checkout,'trusted control uses the reviewed checkout action')
 assert.match(checkout[1],/^          ref: \$\{\{ github.sha \}\}$/m)
 assert.match(checkout[1],/^          path: control$/m)
 assert.match(checkout[1],/^          fetch-depth: 0$/m)
 assert.match(checkout[1],/^          persist-credentials: false$/m)
 assert.match(job,/permissions:\n      contents: read\n      actions: read\n      packages: read/)
 assert.doesNotMatch(job,/packages: write|contents: write/)
})


test('actual trusted SDK descriptor admits only installed local packages and retains optional source integrity',async()=>{
 const policy=await import('./controlled-package-ci.mjs')
 const actual=JSON.parse(fs.readFileSync(path.join(root,'apps/architecture-lab/current-sdk-source.json'),'utf8'))
 const selector={id:actual.sourceAdmission.recordId,taskId:actual.sourceAdmission.taskId}
 const selected=policy.currentSdkSourceAdmissionPolicy(selector,root)
 assert.deepEqual(Object.keys(selected.reviewedLocalPackages).sort(),[
  '@profitia/maps-embed','@profitia/platform-contracts','@profitia/platform-current-e1-authority','@profitia/platform-source-hub-contracts'
 ].sort())
 assert.deepEqual(selected.reviewedMetadata.entries['apps/architecture-lab/benchmark-unmetered-source.json'],{sha:'4c165bf726fdd3196e158603cb12c43f4ecde890',mode:'100644',kind:'HISTORICAL_EVIDENCE'},'frozen Finder producer record requires its exact protected-metadata entry')
 const sourceOnly={
  '@profitia/platform-current-fresh-report':'packages/platform-contracts/current-fresh-report/package.json',
  '@profitia/platform-payload-capture':'packages/platform-contracts/payload-capture/package.json',
  '@profitia/platform-readonly-miss-report':'packages/platform-contracts/readonly-miss-report/package.json',
  '@profitia/platform-root-atomic-claim':'packages/platform-contracts/root-atomic-claim/package.json'
 }
 const authority=fs.mkdtempSync(path.join(os.tmpdir(),'sdk-real-descriptor-')),file=path.join(authority,'apps/architecture-lab/current-sdk-source.json')
 try{
  fs.mkdirSync(path.dirname(file),{recursive:true})
  for(const [name,manifest]of Object.entries(sourceOnly)){
   assert.match(actual.inputs[manifest],/^[a-f0-9]{64}$/,'optional manifest remains authenticated physical source')
   assert.equal(Object.hasOwn(selected.reviewedLocalPackages,name),false,'source integrity is not install authority')
   const changed=structuredClone(actual)
   changed.sourceAdmission.localPackages[name]=structuredClone(actual.sourceAdmission.localPackages['@profitia/platform-contracts'])
   fs.writeFileSync(file,JSON.stringify(changed))
   assert.throws(()=>policy.currentSdkSourceAdmissionPolicy(selector,authority),/CURRENT_SDK_SOURCE_POLICY_REJECTED/)
  }
 }finally{fs.rmSync(authority,{recursive:true,force:true})}
})
