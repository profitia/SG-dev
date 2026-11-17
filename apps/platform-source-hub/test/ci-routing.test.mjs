import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {OIL_REPORT_E1_REVIEW} from '../../../scripts/governance/controlled-package-ci.mjs'
import {fileURLToPath} from 'node:url'
import {validateConsumerGroups,validateRouting,validationBase,reviewedOilConsumerPaths,reviewedRecurringConsumerPaths} from '../scripts/ci-routing.mjs'

const repositoryRoot=fileURLToPath(new URL('../../../',import.meta.url))
const readReceipt=file=>JSON.parse(fs.readFileSync(new URL('../../../'+file,import.meta.url)))
// The test must work both on a refreshed candidate and on its resulting main.
// Use the last actual main ancestor before this source record was introduced;
// unrelated later main-only governance commits are never part of this review.
function withRecurringReviewFixture(action,{candidateSha='f78f5867064c96f4497e13bcd53c97af2da2e07a',baseSha='3491c915ad27c07898124b23d6193ea7d703b12b',full=false}={}){
 const temporary=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'hub-recurring-source-')))
 const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
 try{
  // This regression owns the original closed recurring review, not every
  // later governance/registration/Calendar change in the moving main history.
  // Immutable fixture versions are explicit; they never follow moving main.
  const a=JSON.parse(git(repositoryRoot,'show',candidateSha+':apps/architecture-lab/private-recurring-source.json'))
  git(temporary,'clone','--quiet','--shared','--no-checkout',repositoryRoot,'candidate')
  const root=path.join(temporary,'candidate');git(root,'update-ref','--no-deref','HEAD',candidateSha);git(root,'read-tree',candidateSha)
  const canonical=git(root,'ls-tree','-r','--name-only',candidateSha,'--','Canon').split('\n')
  const files=[...new Set([...canonical,...Object.keys(a.sourceDigests),...Object.keys(a.preservedReceipts),
   'apps/architecture-lab/private-recurring-source.json','apps/architecture-lab/private-recurring-source.mjs',
   'apps/architecture-lab/private-recurring-source-adoption.json','apps/sg-runtime/private-recurring-source-adoption.json','apps/srm/private-recurring-source-adoption.json'])]
  if(full)git(root,'checkout-index','-a');else execFileSync('git',['checkout-index','--stdin','-z'],{cwd:root,input:files.join('\0')+'\0'})
  return action({root,baseSha,candidateSha,git,readReceipt:p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'))})
 }finally{fs.rmSync(temporary,{recursive:true,force:true})}
}

test('mixed producer and consumer changes run every actual owner gate',()=>{
 const called=[]
 const result=validateRouting({repositoryRoot,readReceipt,
  changedPaths:['apps/platform-source-hub/src/server.mjs','apps/sg-runtime/operation-integration.json','apps/srm/operation-integration.json','packages/maps-embed/package.json'],
  runGovernance:(owner,targets)=>{called.push(owner);return {verdict:'PASS',targets}}})
 assert.deepEqual(called,['ARCHITECTURE','SG2','SRM']);assert.equal(result.partition.length,4)
 assert.throws(()=>validateRouting({repositoryRoot,readReceipt,changedPaths:['apps/platform-source-hub/src/server.mjs'],runGovernance:()=>({verdict:'BLOCKED'})}))
})
test('PR scope uses the exact validation merge parent and rejects a different head or unrelated event base',()=>{
 const requestedBase='a'.repeat(40),actualBase='b'.repeat(40),headSha='c'.repeat(40),validationSha='d'.repeat(40)
 const git=args=>{
  if(args[0]==='rev-parse')return validationSha
  if(args[0]==='rev-list')return [validationSha,actualBase,headSha].join(' ')
  assert.deepEqual(args,['merge-base','--is-ancestor',requestedBase,actualBase]);return ''
 }
 const input={git,requestedBase,validationSha,event:'pull_request',headSha}
 assert.equal(validationBase(input),actualBase)
 assert.throws(()=>validationBase({...input,headSha:'e'.repeat(40)}))
 assert.throws(()=>validationBase({...input,validationSha:'e'.repeat(40)}))
 assert.throws(()=>validationBase({...input,git:args=>args[0]==='merge-base'?assert.fail('Unrelated base'):git(args)}))
 assert.equal(validationBase({...input,event:'push'}),requestedBase)
 assert.throws(()=>validationBase({...input,event:'pull_request_target'}))
})
test('an unrelated consumer change, foreign owner or false activation claim is refused',()=>{
 for(const group of [{projectKey:'SG2',targets:['apps/sg-runtime/app/page.tsx']},{projectKey:'SRM',targets:['apps/srm/src/server/supplier-native-runtime.ts']},{projectKey:'CIC',targets:['foreign']}])assert.throws(()=>validateConsumerGroups([group],readReceipt))
 const altered=file=>{const r=readReceipt(file);r.sourceHubApiPathCompatibility.apiPathOptedIn=true;return r}
 assert.throws(()=>validateConsumerGroups([{projectKey:'SG2',targets:['apps/sg-runtime/operation-integration.json']}],altered))
 const widened=file=>{const r=readReceipt(file);r.sourceHubApiPathCompatibility.consumerSourceDigests['apps/sg-runtime/app/page.tsx']='0'.repeat(64);return r}
 assert.throws(()=>validateConsumerGroups([{projectKey:'SG2',targets:['apps/sg-runtime/app/page.tsx']}],widened))
 assert.throws(()=>validateRouting({repositoryRoot,readReceipt,changedPaths:['unregistered/unknown.ts'],runGovernance:()=>({verdict:'PASS'})}))
})
test('SDK1.34 routing accepts only the new registered test path while preserving every SDK1.33 guard',()=>{
 const groups=[{projectKey:'SRM',targets:['apps/srm/scripts/source-hub-market-symbol-compatibility.test.mjs']}]
 validateConsumerGroups(groups,readReceipt)
 for(const edit of [r=>r.sourceHubMarketSymbolCompatibility.sql029Installed=true,r=>r.sourceHubMarketSymbolCompatibility.taskId='unregistered',r=>r.sourceHubMarketSymbolCompatibility.consumerSourceDigests['apps/srm/src/server/unapproved.ts']='0'.repeat(64),r=>r.sourceHubApiPathCompatibility.apiPathOptedIn=true]){
  assert.throws(()=>validateConsumerGroups(groups,file=>{const r=readReceipt(file);edit(r);return r}))
 }
 assert.throws(()=>validateConsumerGroups([{projectKey:'SRM',targets:['apps/srm/src/server/unapproved.ts']}],readReceipt))
})

test('M1 routing admits the closed registered SDK consumers and refuses widened paths or activation claims',()=>{
 const groups=[{projectKey:'SRM',targets:['apps/srm/src/server/root-atomic-claim-adoption.test.ts']},{projectKey:'SG2',targets:['apps/sg-runtime/tests/pci-smart-integrity.mjs']}]
 validateConsumerGroups(groups,readReceipt)
 for(const change of [r=>r.assistantM1SourceCompatibility.grantsChanged=true,r=>r.assistantM1SourceCompatibility.rootContract.sourceDigest='0'.repeat(64),r=>r.assistantM1SourceCompatibility.consumerSourceDigests['apps/srm/src/server/unapproved.ts']='0'.repeat(64),r=>r.sourceHubApiPathCompatibility.apiPathOptedIn=true])assert.throws(()=>validateConsumerGroups(groups,file=>{const r=readReceipt(file);change(r);return r}))
 assert.throws(()=>validateConsumerGroups([{projectKey:'SG2',targets:['apps/sg-runtime/app/page.tsx']}],readReceipt))
})

test('Oil consumer routing requires the complete pinned checkout; changed bytes, extra files and missing proof fail closed',()=>{
 const temporary=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'hub-oil-review-')));
 const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 try{
  git(temporary,'clone','--quiet','--shared','--no-checkout',repositoryRoot,'review');
  const root=path.join(temporary,'review'),candidateSha=OIL_REPORT_E1_REVIEW.sourceSha;
  // Materialize only the closed reviewed files. Repository history also
  // contains large, unrelated forecasting diagnostics, unnecessary here.
  git(root,'update-ref','--no-deref','HEAD',candidateSha);
  git(root,'read-tree',candidateSha);
  execFileSync('git',['checkout-index','--stdin','-z'],{cwd:root,input:Object.keys(OIL_REPORT_E1_REVIEW.entries).join('\0')+'\0'});
  // The reviewed fixture must retain its immutable base after the candidate
  // becomes an ancestor of main; a moving merge-base would erase its diff.
  const baseSha=OIL_REPORT_E1_REVIEW.baseSha,sourceReview={baseSha,candidateSha};
  const paths=reviewedOilConsumerPaths(root,sourceReview);
  for(const authoritySha of [baseSha,candidateSha,git(repositoryRoot,'rev-parse','origin/main')]){
   git(root,'update-ref','refs/remotes/origin/main',authoritySha);
   assert.deepEqual(reviewedOilConsumerPaths(root,sourceReview),paths);
  }
  assert(paths.has('.github/workflows/insights-ci.yml'));
  assert(!paths.has('apps/sg-runtime/app/page.tsx'));
  assert.throws(()=>reviewedOilConsumerPaths(root));
  const target='apps/sg-runtime/package.json',bytes=fs.readFileSync(path.join(root,target));
  fs.appendFileSync(path.join(root,target),' ');
  assert.throws(()=>reviewedOilConsumerPaths(root,sourceReview));fs.writeFileSync(path.join(root,target),bytes);
  fs.writeFileSync(path.join(root,'unreviewed.txt'),'unreviewed');git(root,'add','unreviewed.txt');
  git(root,'-c','user.name=Isolated fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','unreviewed source');
  assert.throws(()=>reviewedOilConsumerPaths(root,{baseSha,candidateSha:git(root,'rev-parse','HEAD')}));
 }finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test('private recurring source routing validates its complete immutable candidate before admitting each real owner',()=>{
 withRecurringReviewFixture(({root,baseSha,candidateSha,git,readReceipt})=>{
  const sourceReview={baseSha,candidateSha},paths=reviewedRecurringConsumerPaths(root,sourceReview)
  assert.equal(paths.get('apps/sg-runtime/components/procurement-insights/reports.tsx'),'SG2')
  assert.equal(paths.get('apps/srm/scripts/private-host.integration.test.mjs'),'SRM')
  assert(!paths.has('apps/platform-source-hub/src/server.mjs'));assert(!paths.has('apps/srm/src/server/unreviewed.ts'))
  // Acceptance by main cannot erase the original fixture's reviewed diff.
  for(const authoritySha of [baseSha,candidateSha,git(repositoryRoot,'rev-parse','origin/main')]){
   git(root,'update-ref','refs/remotes/origin/main',authoritySha)
   assert.deepEqual(reviewedRecurringConsumerPaths(root,sourceReview),paths)
  }
  const called=[],changedPaths=git(root,'diff','--name-only',baseSha,candidateSha).split('\n')
  validateRouting({changedPaths,repositoryRoot:root,readReceipt,sourceReview,runGovernance:projectKey=>{called.push(projectKey);return {verdict:'PASS'}}})
  assert.deepEqual([...new Set(called)].sort(),['ARCHITECTURE','SG2','SRM'])
  assert.throws(()=>reviewedRecurringConsumerPaths(root))
  assert.throws(()=>reviewedRecurringConsumerPaths(root,{baseSha,candidateSha:'a'.repeat(40)}))
  const wrongReceipt=p=>{const r=readReceipt(p);r.sourceHubApiPathCompatibility.apiPathOptedIn=true;return r}
  assert.throws(()=>validateRouting({changedPaths,repositoryRoot:root,readReceipt:wrongReceipt,sourceReview,runGovernance:()=>assert.fail('Altered receipt must not reach owner gate')}))
 })
})
test('private recurring public routing refuses changed bytes, symbolic files and additional committed paths',()=>{
 withRecurringReviewFixture(({root,baseSha,candidateSha,git})=>{
  assert(reviewedRecurringConsumerPaths(root,{baseSha,candidateSha}).has('apps/sg-runtime/components/procurement-insights/reports.tsx'))
  const p=path.join(root,'apps/newsfeed-runtime/src/worker.mjs'),bytes=fs.readFileSync(p)
  fs.appendFileSync(p,'drift');assert.throws(()=>reviewedRecurringConsumerPaths(root,{baseSha,candidateSha}));fs.writeFileSync(p,bytes)
  fs.unlinkSync(p);fs.symlinkSync(path.join(root,'apps/newsfeed-runtime/src/server.mjs'),p);assert.throws(()=>reviewedRecurringConsumerPaths(root,{baseSha,candidateSha}));fs.unlinkSync(p);fs.writeFileSync(p,bytes)
  fs.writeFileSync(path.join(root,'unreviewed.txt'),'not part of this accepted source')
  git(root,'add','unreviewed.txt');git(root,'-c','user.name=Isolated fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','unreviewed addition')
  assert.throws(()=>reviewedRecurringConsumerPaths(root,{baseSha,candidateSha:git(root,'rev-parse','HEAD')}))
 })
})

import {REGISTRATION_SDK_REVIEW} from '../../../scripts/governance/controlled-package-ci.mjs'
import {partitionChangedPaths,validateOwnerGroups} from '../../identity-runtime/scripts/ci-routing.mjs'
import {reviewedRegistrationConsumerPaths} from '../scripts/ci-routing.mjs'
test('organisation SDK routing requires its complete pinned checkout and every real owner gate',()=>{
 const temporary=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'hub-registration-review-')))
 const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
 try{
  git(temporary,'clone','--quiet','--shared','--no-checkout',repositoryRoot,'review')
  const root=path.join(temporary,'review'),candidateSha=REGISTRATION_SDK_REVIEW.sourceSha,baseSha=REGISTRATION_SDK_REVIEW.baseSha
  git(root,'update-ref','--no-deref','HEAD',candidateSha);git(root,'read-tree',candidateSha)
  execFileSync('git',['checkout-index','--stdin','-z'],{cwd:root,input:Object.keys(REGISTRATION_SDK_REVIEW.entries).join('\0')+'\0',stdio:['pipe','pipe','pipe']})
  const sourceReview={baseSha,candidateSha},paths=reviewedRegistrationConsumerPaths(root,sourceReview)
  assert(paths.has('apps/sg-runtime/operation-integration.json'));assert(paths.has('apps/srm/operation-integration.json'));assert(!paths.has('apps/sg-runtime/app/page.tsx'))
  const called=[],readReceipt=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'))
  const {groups}=partitionChangedPaths(Object.keys(REGISTRATION_SDK_REVIEW.entries),repositoryRoot)
  validateConsumerGroups(groups,readReceipt,{reviewedRegistrationPaths:paths})
  validateOwnerGroups({groups,runGovernance:(owner)=>{called.push(owner);return {verdict:'PASS'}}})
  assert.deepEqual(called,['ARCHITECTURE','SG2','SRM'])
  assert.throws(()=>reviewedRegistrationConsumerPaths(root,{...sourceReview,candidateSha:'0'.repeat(40)}))
  const target=Object.keys(REGISTRATION_SDK_REVIEW.entries)[0],original=fs.readFileSync(path.join(root,target))
  fs.appendFileSync(path.join(root,target),'\nUNREVIEWED');assert.throws(()=>reviewedRegistrationConsumerPaths(root,sourceReview));fs.writeFileSync(path.join(root,target),original)
  fs.chmodSync(path.join(root,target),0o755);git(root,'update-index','--chmod=+x',target)
  const tree=git(root,'write-tree'),changed=git(root,'-c','user.name=Fixture','-c','user.email=fixture@example.test','commit-tree',tree,'-p',candidateSha,'-m','Changed fixture mode')
  git(root,'update-ref','--no-deref','HEAD',changed)
  assert.throws(()=>reviewedRegistrationConsumerPaths(root,{baseSha,candidateSha:changed}))
 }finally{fs.rmSync(temporary,{recursive:true,force:true})}
})

test('accepted recurring transport continuation preserves its complete29 owner review and rejects tampered current files',()=>{
 withRecurringReviewFixture(({root,baseSha,candidateSha,git,readReceipt})=>{
  const sourceReview={baseSha,candidateSha},paths=reviewedRecurringConsumerPaths(root,sourceReview);
  assert.equal(paths.get('apps/srm/scripts/private-host.integration.test.mjs'),'SRM');
  const changedPaths=git(root,'diff','--name-only',baseSha,candidateSha).split('\n'),called=[];
  assert.equal(changedPaths.length,29);
  validateRouting({changedPaths,repositoryRoot:root,readReceipt,sourceReview,runGovernance:projectKey=>{called.push(projectKey);return {verdict:'PASS'}}});
  assert.deepEqual([...new Set(called)].sort(),['ARCHITECTURE','SG2','SRM']);
  const p=path.join(root,'packages/platform-contracts/current-e1-authority/recurring.mjs'),bytes=fs.readFileSync(p);
  fs.appendFileSync(p,'UNREVIEWED');assert.throws(()=>reviewedRecurringConsumerPaths(root,sourceReview));fs.writeFileSync(p,bytes);
 },{candidateSha:'82bcb78813937331d7822a96c5319b26e788abe1',baseSha:'f8f4b7f7f36357186a01ee54c7d5511c46ef5ed1',full:true});
});

const liveReviewFixture={candidateSha:'68867fe8c54b8f3b2efadf512d37d8925b9657e5',baseSha:'08792452867f486580874857b3a5aaae10de9170',full:true}
test('accepted live notification review retains exact SG2 and SRM owner routing across later main changes',()=>{
 withRecurringReviewFixture(({root,baseSha,candidateSha,git,readReceipt})=>{
  const sourceReview={baseSha,candidateSha},paths=reviewedRecurringConsumerPaths(root,sourceReview)
  assert.equal(paths.get('apps/sg-runtime/components/procurement-insights/workspace.tsx'),'SG2')
  assert.equal(paths.get('apps/srm/scripts/supplier-location-admission.integration.test.mjs'),'SRM')
  assert(!paths.has('apps/platform-source-hub/src/server.mjs'));assert(!paths.has('apps/srm/src/server/unreviewed.ts'))
  for(const authoritySha of [baseSha,candidateSha,git(repositoryRoot,'rev-parse','origin/main')]){
   git(root,'update-ref','refs/remotes/origin/main',authoritySha)
   assert.deepEqual(reviewedRecurringConsumerPaths(root,sourceReview),paths)
  }
  const called=[],changedPaths=git(root,'diff','--name-only',baseSha,candidateSha).split('\n')
  validateRouting({changedPaths,repositoryRoot:root,readReceipt,sourceReview,runGovernance:projectKey=>{called.push(projectKey);return {verdict:'PASS'}}})
  assert.deepEqual([...new Set(called)].sort(),['ARCHITECTURE','SG2','SRM'])
  assert.throws(()=>reviewedRecurringConsumerPaths(root))
  assert.throws(()=>reviewedRecurringConsumerPaths(root,{baseSha,candidateSha:'a'.repeat(40)}))
  const wrongReceipt=p=>{const r=readReceipt(p);r.sourceHubApiPathCompatibility.apiPathOptedIn=true;return r}
  assert.throws(()=>validateRouting({changedPaths,repositoryRoot:root,readReceipt:wrongReceipt,sourceReview,runGovernance:()=>assert.fail('Altered receipt must not reach owner gate')}))
 },liveReviewFixture)
})
test('accepted live routing rejects every changed current source and altered instruction input',()=>{
 withRecurringReviewFixture(({root,baseSha,candidateSha,readReceipt})=>{
  const sourceReview={baseSha,candidateSha}
  assert(reviewedRecurringConsumerPaths(root,sourceReview).has('apps/sg-runtime/components/procurement-insights/workspace.tsx'))
  const paths=[...Object.keys(readReceipt('apps/sg-runtime/procurement-insights-live-acceptance.json').sourceDigests),'AGENTS.md','docs/agent-instructions/bsdc-launcher-v1.1.md']
  for(const p of paths){
   const f=path.join(root,p),before=fs.readFileSync(f)
   fs.appendFileSync(f,'UNREVIEWED_SOURCE')
   assert.throws(()=>reviewedRecurringConsumerPaths(root,sourceReview),p)
   fs.writeFileSync(f,before)
  }
 },liveReviewFixture)
})
