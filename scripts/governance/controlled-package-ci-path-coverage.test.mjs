import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import os from 'node:os'
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
  assert.throws(()=>c.checkAdmittedPackages(root,accepted,{...r}),/LOCAL_PACKAGE_VERSION_MISMATCH/)
  assert.equal(c.checkAdmittedPackages(root,accepted,r),path.join(root,'apps/sg-runtime'))
  const historicalAuthority=path.join(temporary,'old-authority');clone(historicalAuthority,'d5eb40a061dd24c5ea65f9f373682179458cb589');assert.throws(()=>c.checkAdmittedPackages(root,historicalAuthority,r))
  const p=path.join(root,'packages/platform-source-hub-contracts/package.json'),before=fs.readFileSync(p),a=JSON.parse(before)
  fs.writeFileSync(p,JSON.stringify({...a,version:'1.8.1'}));assert.throws(()=>c.checkAdmittedPackages(root,accepted,r));fs.writeFileSync(p,before)
  fs.writeFileSync(p,JSON.stringify({...a,peerDependencies:{'@profitia/platform-current-e1-authority':'^1.4.0'}}));assert.throws(()=>c.checkAdmittedPackages(root,accepted,r));fs.writeFileSync(p,before)
  const authorityFile=path.join(accepted,'packages/platform-source-hub-contracts/package.json'),acceptedBefore=fs.readFileSync(authorityFile);fs.appendFileSync(authorityFile,' ');assert.throws(()=>c.checkAdmittedPackages(root,accepted,r));fs.writeFileSync(authorityFile,acceptedBefore)
  const lockFile=path.join(root,'apps/sg-runtime/package-lock.json'),lockBefore=fs.readFileSync(lockFile),lockJson=JSON.parse(lockBefore);lockJson.packages['node_modules/'+c.PRIVATE_PACKAGES[0]].integrity='sha512-unreviewed';fs.writeFileSync(lockFile,JSON.stringify(lockJson));assert.throws(()=>c.checkAdmittedPackages(root,accepted,r))
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
