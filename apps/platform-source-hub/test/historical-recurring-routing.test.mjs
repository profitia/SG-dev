// SYNTHETIC_ONLY frozen historical exact29 source regression.
// Current PI routing remains in ci-routing.test.mjs without a Calendar edit.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {PRIVATE_RECURRING_CONSUMER_TEST_REVIEW} from '../../../scripts/governance/controlled-package-ci.mjs'
import {validateRouting,reviewedRecurringConsumerPaths} from '../scripts/ci-routing.mjs'
const repositoryRoot=fileURLToPath(new URL('../../../',import.meta.url))
function recurringReviewBase(){return PRIVATE_RECURRING_CONSUMER_TEST_REVIEW.baseSha}
function recurringReviewedCheckout(){
 const temporary=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'hub-recurring-reviewed-')))
 const git=(cwd,args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
 const source=PRIVATE_RECURRING_CONSUMER_TEST_REVIEW.sourceSha
 try{
  git(temporary,['clone','--quiet','--shared','--no-checkout',repositoryRoot,'source'])
  const root=path.join(temporary,'source'),base=recurringReviewBase();git(root,['update-ref','--no-deref','HEAD',base]);git(root,['read-tree',base])
  const tracked=new Set(git(root,['ls-tree','-r','--name-only',base]).split('\n')),referenced=new Set()
  const visit=v=>{if(!v||typeof v!=='object')return;for(const[k,x]of Object.entries(v)){if(tracked.has(k))referenced.add(k);if(typeof x==='string'&&tracked.has(x))referenced.add(x);visit(x)}}
  for(const file of tracked)if(/(?:-integration|-adoption|-source|compatibility)\.json$/.test(file))visit(JSON.parse(git(root,['show',base+':'+file])))
  const paths=[...new Set([...referenced,...[...tracked].filter(p=>/^(Canon|scripts|packages)\//.test(p)||/^apps\/[^/]+\/(?:.*\.(?:mjs|json|tsx?|sql|css|md|py)|scripts\/.*)$/.test(p))])]
  execFileSync('git',['checkout-index','--stdin','-z'],{cwd:root,input:paths.join('\0')+'\0'})
  // SYNTHETIC_ONLY Git fixture: project the entire exact29 review over its
  // authority base. Policy commits inherited by the historical branch are
  // deliberately outside this product-source routing regression.
  for(const file of Object.keys(PRIVATE_RECURRING_CONSUMER_TEST_REVIEW.entries)){const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,execFileSync('git',['show',source+':'+file],{cwd:repositoryRoot}));git(root,['add','--',file])}
  git(root,['-c','user.name=Isolated fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','SYNTHETIC_ONLY exact29 reviewed source fixture'])
  return{root,source:git(root,['rev-parse','HEAD']),close:()=>fs.rmSync(temporary,{recursive:true,force:true})}
 }catch(e){fs.rmSync(temporary,{recursive:true,force:true});throw e}
}

test('historical exact29 source routing validates the complete actual candidate before admitting each real owner',()=>{
 const frozen=recurringReviewedCheckout();try{
 const repositoryRoot=frozen.root,readReceipt=file=>JSON.parse(fs.readFileSync(path.join(repositoryRoot,file))),candidateSha=frozen.source,baseSha=recurringReviewBase()
 const paths=reviewedRecurringConsumerPaths(repositoryRoot,{baseSha,candidateSha})
 assert.equal(paths.get('apps/sg-runtime/components/procurement-insights/reports.tsx'),'SG2')
 const continuation=fs.existsSync(path.join(repositoryRoot,'packages/platform-contracts/test/recurring-consent-transport-source.json'))
 const includesSrm=!continuation||readReceipt('packages/platform-contracts/test/recurring-consent-transport-source.json').reviewedPaths.includes('apps/srm/scripts/private-host.integration.test.mjs')
 if(includesSrm)assert.equal(paths.get('apps/srm/scripts/private-host.integration.test.mjs'),'SRM');else assert(!paths.has('apps/srm/scripts/private-host.integration.test.mjs'))
 assert(!paths.has('apps/platform-source-hub/src/server.mjs'));assert(!paths.has('apps/srm/src/server/unreviewed.ts'))
 const called=[],changedPaths=execFileSync('git',['diff','--name-only',baseSha,candidateSha],{cwd:repositoryRoot,encoding:'utf8'}).trim().split('\n')
 validateRouting({changedPaths,repositoryRoot,readReceipt,sourceReview:{baseSha,candidateSha},runGovernance:(projectKey)=>{called.push(projectKey);return {verdict:'PASS'}}})
 assert.deepEqual([...new Set(called)].sort(),includesSrm?['ARCHITECTURE','SG2','SRM']:['ARCHITECTURE','SG2'])
 assert.throws(()=>reviewedRecurringConsumerPaths(repositoryRoot))
 assert.throws(()=>reviewedRecurringConsumerPaths(repositoryRoot,{baseSha,candidateSha:'a'.repeat(40)}))
 const wrongReceipt=p=>{const r=readReceipt(p);r.sourceHubApiPathCompatibility.apiPathOptedIn=true;return r}
 assert.throws(()=>validateRouting({changedPaths,repositoryRoot,readReceipt:wrongReceipt,sourceReview:{baseSha,candidateSha},runGovernance:()=>assert.fail('Altered receipt must not reach owner gate')}))
 }finally{frozen.close()}
})
test('historical exact29 public routing refuses changed bytes, symbolic files and additional committed paths',()=>{
 const frozen=recurringReviewedCheckout(),root=frozen.root,baseSha=recurringReviewBase(),candidateSha=frozen.source
 const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
 try{
  assert(reviewedRecurringConsumerPaths(root,{baseSha,candidateSha}).has('apps/sg-runtime/components/procurement-insights/reports.tsx'))
  const p=path.join(root,'apps/newsfeed-runtime/src/worker.mjs'),bytes=fs.readFileSync(p)
  fs.appendFileSync(p,'drift');assert.throws(()=>reviewedRecurringConsumerPaths(root,{baseSha,candidateSha}));fs.writeFileSync(p,bytes)
  fs.unlinkSync(p);fs.symlinkSync(path.join(root,'apps/newsfeed-runtime/src/server.mjs'),p);assert.throws(()=>reviewedRecurringConsumerPaths(root,{baseSha,candidateSha}));fs.unlinkSync(p);fs.writeFileSync(p,bytes)
  fs.writeFileSync(path.join(root,'unreviewed.txt'),'not part of this accepted source')
  git(root,'add','unreviewed.txt');git(root,'-c','user.name=Isolated fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','unreviewed addition')
  assert.throws(()=>reviewedRecurringConsumerPaths(root,{baseSha,candidateSha:git(root,'rev-parse','HEAD')}))
 }finally{frozen.close()}
})
