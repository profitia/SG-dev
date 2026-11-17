import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {sdkSourceContext,CURRENT_SDK_SOURCE_RECORD} from './sdk-source-context.mjs'
const hash=x=>createHash('sha256').update(x).digest('hex')
const manifest='packages/platform-contracts/package.json',code='packages/platform-contracts/src/operation-context.mjs'
const extra='apps/example/app/[locale]/layout.tsx',receipt='apps/example/operation-integration.json',coverage='apps/example/source-record.json'
function fixture(){
 const oldReceipt='{"accepted":"original"}',oldCoverage=JSON.stringify({sourceDigests:{[manifest]:hash('old manifest'),[code]:hash('old code'),[extra]:hash('old view')}})
 const current=new Map([[manifest,JSON.stringify({version:'1.38.0'})],[code,'new actual code'],[extra,'new actual view'],[receipt,oldReceipt]])
 const historical=new Map([['a'.repeat(40)+':'+coverage,oldCoverage],['a'.repeat(40)+':'+receipt,oldReceipt],
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
