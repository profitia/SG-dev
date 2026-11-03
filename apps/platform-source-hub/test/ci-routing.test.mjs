import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {fileURLToPath} from 'node:url'
import {validateConsumerGroups,validateRouting} from '../scripts/ci-routing.mjs'

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
test('an unrelated consumer change, foreign owner or false activation claim is refused',()=>{
 for(const group of [{projectKey:'SG2',targets:['apps/sg-runtime/app/page.tsx']},{projectKey:'SRM',targets:['apps/srm/src/server/supplier-native-runtime.ts']},{projectKey:'CIC',targets:['foreign']}])assert.throws(()=>validateConsumerGroups([group],readReceipt))
 const altered=file=>{const r=readReceipt(file);r.sourceHubApiPathCompatibility.apiPathOptedIn=true;return r}
 assert.throws(()=>validateConsumerGroups([{projectKey:'SG2',targets:['apps/sg-runtime/operation-integration.json']}],altered))
 const widened=file=>{const r=readReceipt(file);r.sourceHubApiPathCompatibility.consumerSourceDigests['apps/sg-runtime/app/page.tsx']='0'.repeat(64);return r}
 assert.throws(()=>validateConsumerGroups([{projectKey:'SG2',targets:['apps/sg-runtime/app/page.tsx']}],widened))
 assert.throws(()=>validateRouting({repositoryRoot,readReceipt,changedPaths:['unregistered/unknown.ts'],runGovernance:()=>({verdict:'PASS'})}))
})
