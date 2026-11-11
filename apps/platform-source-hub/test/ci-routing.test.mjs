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
function recurringReviewBase(){
 const git=args=>execFileSync('git',args,{cwd:repositoryRoot,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
 let base=git(['merge-base','origin/main','HEAD'])
 for(let i=0;i<64;i++){
  try{git(['cat-file','-e',base+':apps/architecture-lab/private-recurring-source.json'])}
  catch(error){
   const missing=[" does not exist in "," exists on disk, but not in "].some(part=>String(error.stderr??'').includes("path 'apps/architecture-lab/private-recurring-source.json'"+part))
   if(error.status===128&&missing)return base
   throw error
  }
  base=git(['rev-parse',base+'^1'])
 }
 assert.fail('Exact pre-acceptance main ancestor required')
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

test('private recurring source routing validates the complete actual candidate before admitting each real owner',()=>{
 const a=readReceipt('apps/architecture-lab/private-recurring-source.json'),candidateSha=execFileSync('git',['rev-parse','HEAD'],{cwd:repositoryRoot,encoding:'utf8'}).trim(),baseSha=recurringReviewBase()
 const paths=reviewedRecurringConsumerPaths(repositoryRoot,{baseSha,candidateSha})
 assert.equal(paths.get('apps/sg-runtime/components/procurement-insights/reports.tsx'),'SG2')
 assert.equal(paths.get('apps/srm/scripts/private-host.integration.test.mjs'),'SRM')
 assert(!paths.has('apps/platform-source-hub/src/server.mjs'));assert(!paths.has('apps/srm/src/server/unreviewed.ts'))
 const called=[],changedPaths=execFileSync('git',['diff','--name-only',baseSha,candidateSha],{cwd:repositoryRoot,encoding:'utf8'}).trim().split('\n')
 validateRouting({changedPaths,repositoryRoot,readReceipt,sourceReview:{baseSha,candidateSha},runGovernance:(projectKey)=>{called.push(projectKey);return {verdict:'PASS'}}})
 assert.deepEqual([...new Set(called)].sort(),['ARCHITECTURE','SG2','SRM'])
 assert.throws(()=>reviewedRecurringConsumerPaths(repositoryRoot))
 assert.throws(()=>reviewedRecurringConsumerPaths(repositoryRoot,{baseSha,candidateSha:'a'.repeat(40)}))
 const wrongReceipt=p=>{const r=readReceipt(p);r.sourceHubApiPathCompatibility.apiPathOptedIn=true;return r}
 assert.throws(()=>validateRouting({changedPaths,repositoryRoot,readReceipt:wrongReceipt,sourceReview:{baseSha,candidateSha},runGovernance:()=>assert.fail('Altered receipt must not reach owner gate')}))
})
test('private recurring public routing refuses changed bytes, symbolic files and additional committed paths',()=>{
 const temporary=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'hub-recurring-source-')))
 const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
 try{
  const candidateSha=git(repositoryRoot,'rev-parse','HEAD'),a=readReceipt('apps/architecture-lab/private-recurring-source.json'),baseSha=recurringReviewBase()
  git(temporary,'clone','--quiet','--shared','--no-checkout',repositoryRoot,'candidate')
  const root=path.join(temporary,'candidate');git(root,'update-ref','--no-deref','HEAD',candidateSha);git(root,'read-tree',candidateSha)
  const canonical=git(root,'ls-tree','-r','--name-only',candidateSha,'--','Canon').split('\n')
  const files=[...new Set([...canonical,...Object.keys(a.sourceDigests),...Object.keys(a.preservedReceipts),
   'apps/architecture-lab/private-recurring-source.json','apps/architecture-lab/private-recurring-source.mjs',
   'apps/architecture-lab/private-recurring-source-adoption.json','apps/sg-runtime/private-recurring-source-adoption.json','apps/srm/private-recurring-source-adoption.json'])]
  execFileSync('git',['checkout-index','--stdin','-z'],{cwd:root,input:files.join('\0')+'\0'})
  assert(reviewedRecurringConsumerPaths(root,{baseSha,candidateSha}).has('apps/sg-runtime/components/procurement-insights/reports.tsx'))
  const p=path.join(root,'apps/newsfeed-runtime/src/worker.mjs'),bytes=fs.readFileSync(p)
  fs.appendFileSync(p,'drift');assert.throws(()=>reviewedRecurringConsumerPaths(root,{baseSha,candidateSha}));fs.writeFileSync(p,bytes)
  fs.unlinkSync(p);fs.symlinkSync(path.join(root,'apps/newsfeed-runtime/src/server.mjs'),p);assert.throws(()=>reviewedRecurringConsumerPaths(root,{baseSha,candidateSha}));fs.unlinkSync(p);fs.writeFileSync(p,bytes)
  fs.writeFileSync(path.join(root,'unreviewed.txt'),'not part of this accepted source')
  git(root,'add','unreviewed.txt');git(root,'-c','user.name=Isolated fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','unreviewed addition')
  assert.throws(()=>reviewedRecurringConsumerPaths(root,{baseSha,candidateSha:git(root,'rev-parse','HEAD')}))
 }finally{fs.rmSync(temporary,{recursive:true,force:true})}
})
