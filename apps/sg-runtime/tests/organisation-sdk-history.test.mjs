// Real paired receipt, immutable Git history and an isolated installed-copy
// fixture. No database, identity or provider I/O.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {randomUUID,createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import {sdkContinuationPredecessor} from '../../../packages/platform-contracts/test/organisation-sdk-compatibility.mjs'
import {assistantSendArrowPredecessor} from './assistant-send-arrow-integrity.mjs'
import {assertAssistantM1Integrity} from './assistant-m1-integrity.mjs'
import {readM2AcceptedSource} from './assistant-m2-source-view.mjs'
const root=fileURLToPath(new URL('../../../',import.meta.url)),current=p=>fs.readFileSync(path.join(root,p)),history=new Map()
const historical=(sha,p)=>{const key=sha+':'+p;if(!history.has(key))history.set(key,execFileSync('git',['show',key],{cwd:root,stdio:['ignore','pipe','ignore']}));return Buffer.from(history.get(key))}
const receipt=()=>JSON.parse(current('apps/sg-runtime/operation-integration.json')),hash=b=>createHash('sha256').update(b).digest('hex')
test('current SDK is verified before immutable arrow and M1 receipt views are exposed',()=>{
 const r=receipt(),sdk=sdkContinuationPredecessor(r,current,historical)
 assert(sdk);assert.deepEqual(sdk.prior,JSON.parse(historical(sdk.record.previousSourceSha,'apps/sg-runtime/operation-integration.json')))
 const arrow=assistantSendArrowPredecessor(current,historical);assert(arrow)
 assert.doesNotThrow(()=>assertAssistantM1Integrity(r,current,historical))
 const guard='apps/sg-runtime/tests/assistant-send-arrow-integrity.mjs'
 assert.equal(hash(sdk.previousBytes(guard)),hash(historical(sdk.record.previousSourceSha,guard)))
 for(const flag of ['runtimeOptedIn','sqlInstalled','permissionsChanged','providerCallsPerformed','deploymentPerformed'])assert.equal(sdk.record[flag],false)
})
test('receipt/view alignment cannot discard caller mutations or accept historical SDK bytes as current',()=>{
 const changed=receipt();changed.operations.push('supplier.private.unreviewed')
 assert.throws(()=>assertAssistantM1Integrity(changed,current,historical))
 const sql='packages/platform-contracts/migrations/profile/007-organisation-onboarding.sql'
 assert.throws(()=>assertAssistantM1Integrity(receipt(),p=>p===sql?historical('f8f6340ab1ac862a584352f86988dde199172b37',p):current(p),historical))
 const guard='apps/sg-runtime/tests/assistant-send-arrow-integrity.mjs'
 assert.throws(()=>assistantSendArrowPredecessor(p=>p===guard?Buffer.concat([current(p),Buffer.from('\n')]):current(p),historical))
})
test('installed SDK aliases validate physical current bytes before returning exact historical views',()=>{
 const sdk=sdkContinuationPredecessor(receipt(),current,historical)
 const fixture=path.join(root,'apps/sg-runtime/node_modules/.registration-sdk-view-'+randomUUID()),installed=path.join(fixture,'node_modules/@profitia/platform-contracts')
 try{
  for(const file of ['package.json','src/operation-context.d.mts']){
   const target=path.join(installed,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,current('packages/platform-contracts/'+file))
   assert.deepEqual(Buffer.from(readM2AcceptedSource(target)),historical(sdk.record.previousSourceSha,'packages/platform-contracts/'+file))
  }
  const target=path.join(installed,'package.json');fs.appendFileSync(target,'\n')
  assert.throws(()=>readM2AcceptedSource(target),/Actual installed SDK source/)
 }finally{fs.rmSync(fixture,{recursive:true,force:true})}
})
