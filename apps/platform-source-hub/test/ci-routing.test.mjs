import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {fileURLToPath} from 'node:url'
import {validateConsumerGroups,validateRouting,validationBase} from '../scripts/ci-routing.mjs'

const repositoryRoot=fileURLToPath(new URL('../../../',import.meta.url))
const readReceipt=file=>JSON.parse(fs.readFileSync(new URL('../../../'+file,import.meta.url)))
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
