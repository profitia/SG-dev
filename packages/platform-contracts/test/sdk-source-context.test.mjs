import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {sdkSourceContext,CURRENT_SDK_SOURCE_RECORD} from './sdk-source-context.mjs'
const hash=x=>createHash('sha256').update(x).digest('hex')
const manifest='packages/platform-contracts/package.json',code='packages/platform-contracts/src/operation-context.mjs'
const extra='apps/example/app/[locale]/layout.tsx',receipt='apps/example/operation-integration.json',coverage='apps/example/source-record.json'
function fixture(){
 const oldReceipt='{"accepted":"original"}',oldCoverage=JSON.stringify({sourceDigests:{[manifest]:hash('old manifest'),[code]:hash('old code'),[extra]:hash('old view'),'AGENTS.md':hash('old agents')}})
 const current=new Map([[manifest,JSON.stringify({version:'1.38.0'})],[code,'new actual code'],[extra,'new actual view'],[receipt,oldReceipt],['AGENTS.md','new actual root instructions']])
 const historical=new Map([['a'.repeat(40)+':'+coverage,oldCoverage],['a'.repeat(40)+':'+receipt,oldReceipt],['a'.repeat(40)+':AGENTS.md','old agents'],['b'.repeat(40)+':AGENTS.md','second known tree'],
  ['a'.repeat(40)+':'+code,'old code'],['b'.repeat(40)+':'+code,'independent accepted code']])
 const record={schemaVersion:'1.0',scope:'CURRENT_SDK_SOURCE_INTEGRITY_ONLY',platformVersion:'1.38.0',
  runtimeActivated:false,permissionsChanged:false,providerCallsPerformed:false,deploymentPerformed:false,
  inputs:Object.fromEntries([...current].map(([p,v])=>[p,hash(v)])),baselines:{first:{sha:'a'.repeat(40)},second:{sha:'b'.repeat(40)}},
  coverageRecords:[{baseline:'first',path:coverage,sha256:hash(oldCoverage)}],retainedReceipts:{[receipt]:{baseline:'first',sha256:hash(oldReceipt)}},
  metadata:{sdkDigests:{operation:hash('new actual code')},optionalPackageDigests:{fresh:hash('new actual optional source')}}}
 let historicalReads=0
 const raw=p=>{if(p===CURRENT_SDK_SOURCE_RECORD)return Buffer.from(JSON.stringify(record));if(!current.has(p))throw Object.assign(Error('Absent'),{code:'ENOENT'});return Buffer.from(current.get(p))}
 const old=(sha,p)=>{historicalReads++;assert(historical.has(sha+':'+p));return Buffer.from(historical.get(sha+':'+p))}
 return{record,current,historical,raw,old,reads:()=>historicalReads,run:()=>sdkSourceContext(raw,old)}
}
test('current bytes and immutable historical views are separate, without projecting current source',()=>{
 const f=fixture(),v=f.run()
 assert.equal(v.metadata.sdkDigests.operation,hash('new actual code'))
 assert.equal(v.currentSourceDigests[extra],hash('new actual view'))
 assert.equal(v.baseline('first')(code).toString(),'old code')
 assert.equal(v.baseline('second')(code).toString(),'independent accepted code')
 const copy=v.baseline('first')(code);copy[0]=0
 assert.equal(v.baseline('first')(code).toString(),'old code')
 assert.throws(()=>{v.record.metadata.sdkDigests.operation='forged'})
 assert.throws(()=>v.baseline('undeclared'))
})
test('a changed current source fails before any historical view is read',()=>{
 const f=fixture();f.current.set(code,'substituted code')
 assert.throws(f.run,/current SDK source/);assert.equal(f.reads(),0)
})
test('current inputs are re-read after a prior successful verification',()=>{
 const f=fixture();f.run();f.current.set(extra,'changed after verification');assert.throws(f.run)
})
test('omitting a predecessor input cannot shrink the current source closure',()=>{
 const f=fixture();delete f.record.inputs[extra];assert.throws(f.run,/retained physical source coverage/)
})
test('historical source records and current retained receipts remain immutable',()=>{
 for(const change of [
  f=>f.historical.set('a'.repeat(40)+':'+coverage,'{}'),
  f=>{f.current.set(receipt,'{"accepted":"rewritten"}');f.record.inputs[receipt]=hash(f.current.get(receipt))},
  f=>f.historical.set('a'.repeat(40)+':'+receipt,'changed history')
 ]){const f=fixture();change(f);assert.throws(f.run)}
})
test('unsafe source paths, self-references and activation flags are refused',()=>{
 for(const path of ['../secret','/absolute','a/../secret','a\\secret','a/.git/config','a/.env.local','a/node_modules/private',CURRENT_SDK_SOURCE_RECORD]){
  const f=fixture();f.record.inputs[path]='a'.repeat(64);assert.throws(f.run)
 }
 for(const flag of ['runtimeActivated','permissionsChanged','providerCallsPerformed','deploymentPerformed']){const f=fixture();f.record[flag]=true;assert.throws(f.run)}
 const f=fixture();f.record.scope='RUNTIME_AUTHORITY';assert.throws(f.run)
})
test('an older SDK keeps its own unchanged verifier and never receives this current context',()=>{
 const f=fixture();f.current.set(manifest,JSON.stringify({version:'1.37.0'}))
 assert.equal(f.run(),null);assert.equal(f.reads(),0)
 assert.equal(sdkSourceContext(()=>{throw Object.assign(Error('missing record'),{code:'ENOENT'})},()=>assert.fail()),null)
})

test('full immutable Git views preserve absence as ENOENT without falling back to another tree',()=>{
 const missing='apps/example/absent-source.json'
 for(const message of ["' does not exist in ","' exists on disk, but not in "]){
  const f=fixture(),seen=[]
  const value=sdkSourceContext(f.raw,(sha,p)=>{
   if(p===missing){seen.push(sha);throw Object.assign(Error('missing Git path'),{status:128,stderr:"fatal: path '"+p+message+"'"+sha+"'"})}
   return f.old(sha,p)
  })
  assert.throws(()=>value.baseline('first')(missing),error=>error.code==='ENOENT')
  assert.deepEqual(seen,['a'.repeat(40)])
 }
})
test('other Git failures remain errors and cannot masquerade as an absent predecessor path',()=>{
 const f=fixture(),missing='apps/example/absent-source.json'
 const failure=Object.assign(Error('bad immutable object'),{status:128,stderr:'fatal: bad object'})
 const value=sdkSourceContext(f.raw,(sha,p)=>{if(p===missing)throw failure;return f.old(sha,p)})
 assert.throws(()=>value.baseline('first')(missing),error=>error===failure)
 assert.throws(()=>value.baseline('first')('../outside'))
})

test('root instruction files cannot disappear from the current physical closure',()=>{
 const f=fixture();delete f.record.inputs['AGENTS.md']
 assert.throws(f.run,/retained physical source coverage AGENTS.md/)
})
test('a missing-path message from an unknown full SHA cannot be accepted as genuine Git absence',()=>{
 const f=fixture(),missing='apps/example/absent-source.json',unknown='c'.repeat(40)
 f.record.baselines.unknown={sha:unknown}
 const failure=Object.assign(Error('unknown historical object'),{status:128,
  stderr:"fatal: path '"+missing+"' exists on disk, but not in '"+unknown+"'"})
 const value=sdkSourceContext(f.raw,(sha,p)=>{
  if(sha===unknown&&p===missing)throw failure
  return f.old(sha,p)
 })
 assert.throws(()=>value.baseline('unknown')(missing),error=>error===failure)
})

function continuationFixture(){
 const f=fixture(),added='apps/example/new-application-test.mjs'
 f.record.sourceSnapshotSha='c'.repeat(40)
 f.record.applicationInputContinuation={sourceSnapshotSha:'d'.repeat(40),baseAbsences:[added],inputs:{[extra]:hash('qualified successor view'),[added]:hash('qualified new test')}}
 return{...f,added,successor(){f.current.set(extra,'qualified successor view');f.current.set(added,'qualified new test')}}
}
test('a closed successor preserves both exact base CI and exact successor CI without projecting history',()=>{
 const f=continuationFixture(),base=f.run()
 assert.equal(base.record.sourceSnapshotSha,'c'.repeat(40))
 assert.equal(base.currentSourceDigests[extra],hash('new actual view'))
 f.successor();const next=f.run()
 assert.equal(next.record.sourceSnapshotSha,'d'.repeat(40))
 assert.equal(next.currentSourceDigests[extra],hash('qualified successor view'))
 assert.equal(next.currentSourceDigests[f.added],hash('qualified new test'))
 assert.equal(next.baseline('first')(code).toString(),'old code')
 assert.throws(()=>{next.record.applicationInputContinuation.inputs[extra]='forged'})
})
test('partial, mixed, missing or subsequently tampered successor bytes remain rejected',()=>{
 for(const mutate of [f=>f.current.set(extra,'unqualified third view'),f=>f.current.set(extra,'qualified successor view'),f=>{f.successor();f.current.set(f.added,'tampered test')},f=>{f.successor();f.current.set(code,'changed SDK')}]){
  const f=continuationFixture();mutate(f);assert.throws(f.run,/current SDK source/);assert.equal(f.reads(),0)
 }
 const f=continuationFixture();f.successor();f.run();f.current.set(f.added,'changed after verification');assert.throws(f.run)
})
test('a successor cannot shrink coverage, overlap the base or extend authority to other input classes',()=>{
 for(const mutate of [
  f=>delete f.record.applicationInputContinuation.inputs[extra],
  f=>{f.record.applicationInputContinuation.inputs[extra]=f.record.inputs[extra]},
  f=>{f.record.applicationInputContinuation.inputs[code]=hash('changed SDK')},
  f=>{f.record.applicationInputContinuation.inputs[receipt]=hash('rewritten receipt')},
  f=>{f.record.applicationInputContinuation.inputs['scripts/governance/new-rule.mjs']=hash('new rule')},
  f=>{f.record.applicationInputContinuation.inputs['apps/example/package.json']=hash('unreviewed manifest')},
  f=>{f.record.applicationInputContinuation.inputs['apps/example/.env.local']=hash('secret')},
  f=>{f.record.applicationInputContinuation.inputs[CURRENT_SDK_SOURCE_RECORD]=hash('self')},
  f=>{f.record.applicationInputContinuation.sourceSnapshotSha='invalid'},
  f=>{f.record.applicationInputContinuation.extraAuthority=true},
  f=>{f.record.applicationInputContinuation.inputs[extra]='invalid'},
 ]){const f=continuationFixture();mutate(f);assert.throws(f.run)}
})
test('application successor metadata never permits receipt, history or activation changes',()=>{
 for(const mutate of [
  f=>{f.record.runtimeActivated=true},
  f=>{f.successor();f.current.set(receipt,'rewritten receipt')},
  f=>{f.successor();f.historical.set('a'.repeat(40)+':'+receipt,'rewritten history')},
 ]){const f=continuationFixture();mutate(f);assert.throws(f.run)}
})

function hostManifestFixture(change=()=>{}){
 const f=continuationFixture(),manifest='apps/sg-runtime/package.json'
 const before={name:'host',scripts:{'test:operation-context':'original required suite'},dependencies:{next:'14.2.35'}}
 const after=structuredClone(before);after.scripts['test:operation-context']+=' && npm run test:runtime-build-contract';change(after)
 const a=JSON.stringify(before),b=JSON.stringify(after)
 f.record.inputs[manifest]=hash(a);f.current.set(manifest,a)
 f.historical.set('c'.repeat(40)+':'+manifest,a)
 f.record.applicationInputContinuation.inputs[manifest]=hash(b)
 return{...f,manifest,b,activate(){f.successor();f.current.set(manifest,b)}}
}
test('only the required test script may be appended to the SG2 host manifest',()=>{
 const f=hostManifestFixture();f.run();f.activate()
 assert.equal(f.run().currentSourceDigests[f.manifest],hash(f.b))
 for(const change of [p=>p.dependencies.next='other',p=>p.scripts.install='unreviewed hook',p=>p.scripts['test:operation-context']='skip original suite']){
  const g=hostManifestFixture(change);g.activate();assert.throws(g.run)
 }
})
test('base view refuses every present successor-only path and every changed existing base test',()=>{
 for(const content of ['tampered new test','qualified new test']){
  const f=continuationFixture();f.current.set(f.added,content);assert.throws(f.run,/current SDK source/)
 }
 const oldTest='apps/example/existing-test.mjs'
 for(const content of ['arbitrary test','qualified successor test',null]){
  const f=continuationFixture();f.record.inputs[oldTest]=hash('qualified base test');f.current.set(oldTest,'qualified base test')
  f.record.applicationInputContinuation.inputs[oldTest]=hash('qualified successor test');f.run()
  if(content===null)f.current.delete(oldTest);else f.current.set(oldTest,content)
  assert.throws(f.run,/current SDK source/)
 }
})
test('base absence constraints are complete, unique and fail closed on read errors',()=>{
 for(const change of [f=>f.record.applicationInputContinuation.baseAbsences=[],f=>f.record.applicationInputContinuation.baseAbsences.push(f.added),f=>f.record.applicationInputContinuation.baseAbsences.push(extra)]){
  const f=continuationFixture();change(f);assert.throws(f.run,/base absence/)
 }
 const f=continuationFixture(),failure=Object.assign(Error('read forbidden'),{code:'EACCES'})
 assert.throws(()=>sdkSourceContext(p=>{if(p===f.added)throw failure;return f.raw(p)},f.old),e=>e===failure)
})

test('common current-source mismatches retain their precise path before alternate or historical reads',()=>{
 for(const successor of [false,true]){
  const f=continuationFixture();if(successor)f.successor()
  f.current.set(code,'altered immutable SDK source')
  const reads=[]
  assert.throws(()=>sdkSourceContext(p=>{reads.push(p);return f.raw(p)},f.old),
   error=>error.code==='ERR_ASSERTION'&&error.message.startsWith('current SDK source '+code))
  assert(!reads.includes(extra)&&!reads.includes(f.added));assert.equal(f.reads(),0)
 }
})
test('common input read failures propagate the original error before alternate or historical reads',()=>{
 for(const successor of [false,true])for(const name of [code,receipt])for(const errorCode of ['ENOENT','EACCES']){
  const f=continuationFixture();if(successor)f.successor()
  const failure=Object.assign(Error('synthetic original read failure'),{code:errorCode}),reads=[]
  assert.throws(()=>sdkSourceContext(p=>{reads.push(p);if(p===name)throw failure;return f.raw(p)},f.old),
   error=>error===failure)
  assert(!reads.includes(extra)&&!reads.includes(f.added));assert.equal(f.reads(),0)
 }
})
