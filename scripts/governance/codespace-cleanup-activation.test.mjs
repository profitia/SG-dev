import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import test from 'node:test'
import {CLASS,activationFor,eligible,scopeFor,receiptPayload,consumeReceipt} from './codespace-cleanup-activation.mjs'

function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'activation-unit-'))
 const p={schemaVersion:'1.0',class:CLASS,status:'PILOT',pilotTaskId:'ARCHITECTURE-PILOT',scopeBase:root}
 const c={projectKey:'ARCHITECTURE',repository:'profitia/SG-dev',taskId:p.pilotTaskId,beginInput:{targetEnvironment:'development'}}
 c.scopeRoot=scopeFor(p,c.taskId);fs.mkdirSync(c.scopeRoot)
 const spec={timeoutMs:120000}
 const bootstrap={metadata:{conversationId:'pmos-task-v2:fixture'},result:{finalStatus:'SUCCESS'}}
 return {root,p,c,spec,bootstrap}
}
test('new scope and project/environment admission select only the intended class',()=>{
 const {p,c,spec}=fixture();assert(eligible(c,spec,p))
 for(const override of [{projectKey:'SG2'},{repository:'foreign/repo'},{scopeRoot:'/workspaces/old-history'},{taskId:'ARCHITECTURE-OTHER'},{beginInput:{targetEnvironment:'production'}}])assert(!eligible({...c,...override},spec,p))
 assert(!eligible(c,{timeoutMs:120001},p));assert(!eligible(c,spec,{...p,status:'DISABLED'}))
 const next={...c,taskId:'ARCHITECTURE-NEXT'};next.scopeRoot=scopeFor(p,next.taskId)
 assert(eligible(next,spec,{...p,status:'ACTIVE'}));assert(!eligible(next,spec,p))
})
test('execution payload contains bounded result binding, never business text or secrets',()=>{
 const {c,bootstrap}=fixture();const b={...bootstrap,findings:{findings:['PRIVATE_SECRET_SHOULD_NOT_BE_CACHED']}}
 const payload=receiptPayload(c,b,'full output may contain PRIVATE_LOG')
 assert(payload.length<=4096);assert(!payload.toString().includes('PRIVATE_SECRET'));assert(!payload.toString().includes('PRIVATE_LOG'))
 const d=JSON.parse(payload);assert.equal(d.businessResult,'SUCCESS');assert.match(d.bootstrapSha256,/^[a-f0-9]{64}$/)
 assert.throws(()=>receiptPayload(c,{...b,result:{finalStatus:'UNKNOWN'}},''),/canonical/)
})
test('receipt consumers reject a forged copy or digest',()=>{
 const {c,bootstrap}=fixture();const b=receiptPayload(c,bootstrap,'')
 const good={status:'CACHE_READ',payloadBase64:b.toString('base64'),payloadSha256:crypto.createHash('sha256').update(b).digest('hex')}
 assert.equal(consumeReceipt(c,{},b,()=>good).businessResult,'SUCCESS')
 assert.throws(()=>consumeReceipt(c,{},b,()=>({...good,payloadSha256:'0'.repeat(64)})),/mismatch/)
 assert.throws(()=>consumeReceipt(c,{},Buffer.from('different'),()=>good),/mismatch/)
})
test('actual result is allocated once, consumed twice, released and physically verified before promotion',()=>{
 const {p,c,spec,bootstrap}=fixture();let payload,allocated=0,reads=0,releases=0,stops=0,promotions=0
 const resource={path:c.scopeRoot+'/private/cache',allocationId:'a'.repeat(32),kind:'managed-private-directory',identity:{dev:1,ino:2}}
 const a=activationFor(c,spec,{profile:p,admit:(_c,_p,op)=>{if(op==='promote')promotions++;return {status:op==='start'?'BROKER_READY':'POLICY_ACTIVE'}},request:(_c,op)=>{
  if(op==='read'){reads++;return {status:'CACHE_READ',payloadBase64:payload.toString('base64'),payloadSha256:crypto.createHash('sha256').update(payload).digest('hex')}}
  if(op==='status')return {physicalAbsent:true,workerStopped:true}
  if(op==='stop'){stops++;return {status:'STOPPED'}}
  throw Error(op)
 }})
 a.start();a.cacheResult(bootstrap,'actual test summary',{allocate:o=>{allocated++;payload=Buffer.from(o.seed);assert.equal(o.bytes,payload.length);return resource},release:f=>{releases++;const d=JSON.parse(fs.readFileSync(f));assert.equal(d.taskId,c.taskId);assert(Object.values(d.authorization).every(x=>x===true))}})
 assert.equal(allocated,1);assert.equal(reads,2);assert.equal(releases,1)
 const r=a.afterCleanup({results:[{path:resource.path,status:'CLEANED'}]})
 assert.equal(r.activation.status,'CLEANED_VERIFIED');assert.equal(r.activation.policy,'POLICY_ACTIVE');assert.equal(stops,1);assert.equal(promotions,1)
})
test('missing admitted broker preserves the business result and does not allocate',()=>{
 const {p,c,spec,bootstrap}=fixture();let allocations=0
 const a=activationFor(c,spec,{profile:p,admit:()=>{throw Error('administrator admission missing')}})
 a.start();const r=a.cacheResult(bootstrap,'',{allocate:()=>allocations++,release:()=>{throw Error('unexpected')}})
 assert.equal(r.status,'RETAINED');assert.equal(allocations,0);assert.equal(bootstrap.result.finalStatus,'SUCCESS')
 assert.equal(a.afterCleanup({results:[]}).activation.status,'RETAINED')
})
test('partial work never receives a release attestation or promotion',()=>{
 const {p,c,spec,bootstrap}=fixture();let bytes,releases=0
 const resource={path:c.scopeRoot+'/private/cache',allocationId:'b'.repeat(32),kind:'managed-private-directory'}
 const a=activationFor(c,spec,{profile:p,admit:()=>({status:'BROKER_READY'}),request:()=>({status:'CACHE_READ',payloadBase64:bytes.toString('base64'),payloadSha256:crypto.createHash('sha256').update(bytes).digest('hex')})})
 a.start();a.cacheResult({...bootstrap,result:{finalStatus:'PARTIAL_SUCCESS'}},'',{allocate:o=>{bytes=Buffer.from(o.seed);return resource},release:()=>releases++})
 assert.equal(releases,0);assert.equal(a.afterCleanup({results:[{path:resource.path,status:'RETAINED'}]}).activation.status,'RETAINED')
})
test('a cleanup status without actual absence cannot promote the policy',()=>{
 const {p,c,spec,bootstrap}=fixture();let bytes,promoted=0
 const resource={path:c.scopeRoot+'/private/cache',allocationId:'c'.repeat(32),kind:'managed-private-directory'}
 const a=activationFor(c,spec,{profile:p,admit:(_c,_p,op)=>{if(op==='promote')promoted++},request:(_c,op)=>op==='read'?{status:'CACHE_READ',payloadBase64:bytes.toString('base64'),payloadSha256:crypto.createHash('sha256').update(bytes).digest('hex')}:{physicalAbsent:false,workerStopped:false}})
 a.start();a.cacheResult(bootstrap,'',{allocate:o=>{bytes=Buffer.from(o.seed);return resource},release:()=>{}})
 assert.throws(()=>a.afterCleanup({results:[{path:resource.path,status:'CLEANED'}]}),/absence/);assert.equal(promoted,0)
})
test('a resumed receipt checkpoint reuses the original allocation without rerunning work',()=>{
 const {p,c,spec}=fixture();let starts=0
 const resource={path:c.scopeRoot+'/original',allocationId:'d'.repeat(32),kind:'managed-private-directory'}
 const a=activationFor(c,spec,{profile:{...p,status:'ACTIVE'},admit:()=>{starts++},request:(_c,op)=>op==='status'?{physicalAbsent:true,workerStopped:true}:{status:'STOPPED'}})
 a.restore({resource,proof:{resource,reads:2},issue:null});a.start()
 assert.equal(a.afterCleanup({results:[{path:resource.path,status:'CLEANED'}]}).activation.status,'CLEANED_VERIFIED');assert.equal(starts,1)
})
