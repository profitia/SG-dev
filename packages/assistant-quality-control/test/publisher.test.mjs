import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createQualityPublisherBindings} from '../src/publisher.mjs'
const from='b'.repeat(40),to='c'.repeat(40),clock=Date.parse('2026-11-18T12:00:00.000Z')
const request=()=>({operationId:randomUUID(),fromSourceSha:from,toSourceSha:to})
const clone=v=>structuredClone(v)
function fixture(options={}){
 const writes=[],reads=[],states=Object.fromEntries(['canonical','product'].map(profile=>[profile,{
  currentSourceSha:from,bindingsFresh:true,publishingEnabled:true,recoveryEnabled:true,operations:new Map()}]))
 let lost=null,corrupt=null
 const query=profile=>async(sql,args)=>{
  const s=states[profile]
  if(sql==='SELECT profitia_quality_release.quality_deployment_cas_status($1::uuid) AS result'){
   reads.push({profile,args:clone(args)})
   let v={schemaVersion:'AQC_PUBLISHER_CAS_STATUS_V1',applicationId:'spendguru',environment:'development',profile,
    currentSourceSha:s.currentSourceSha,bindingsFresh:s.bindingsFresh,publishingEnabled:s.publishingEnabled,recoveryEnabled:s.recoveryEnabled,
    authorisedUntil:'2026-11-27T23:59:59.000Z',operation:clone(s.operations.get(args[0])??null),rawQaReadPerformed:false,permissionMutationPerformed:false}
   if(corrupt)v=corrupt(v)
   return {rows:[{result:v}]}
  }
  assert.equal(sql,'SELECT profitia_quality_release.quality_deployment_cas($1::uuid,$2::text,$3::text,$4::uuid,$5::timestamptz) AS result')
  assert.equal(args.length,5);assert(Date.parse(args[4])>clock&&Date.parse(args[4])<=clock+15*60000)
  const [id,before,after,restore]=args
  writes.push({profile,args:clone(args)})
  assert.equal(s.currentSourceSha,before)
  if(restore!==null){const original=s.operations.get(restore);assert(original);assert.equal(original.fromSourceSha,after);assert.equal(original.toSourceSha,before)}
  else assert(s.publishingEnabled&&s.bindingsFresh)
  s.currentSourceSha=after
  s.operations.set(id,{operationId:id,fromSourceSha:before,toSourceSha:after,restoreOf:restore})
  if(lost===profile){lost=null;throw Error('PRIVATE_PROVIDER_ERROR_MUST_NOT_ESCAPE')}
  return {rows:[{result:{applicationId:'spendguru',environment:'development',profile,operationId:id,status:restore===null?'APPLIED':'RESTORED',
   fromSourceSha:before,toSourceSha:after,updatedBindings:3,rawQaReadPerformed:false,permissionMutationPerformed:false}}]}
 }
 const build=extra=>createQualityPublisherBindings({canonicalQuery:query('canonical'),productQuery:query('product'),now:()=>clock,...options,...extra})
 return {states,writes,reads,build,lose:profile=>{lost=profile},corrupt:change=>{corrupt=change}}
}
test('publisher readiness is read-only metadata and all publishing defaults stay off',async()=>{
 const f=fixture();const result=await f.build().check({sourceSha:from})
 assert.equal(result.status,'BINDINGS_VERIFIED');assert.equal(result.publishingEnabled,false);assert.equal(result.updatedBindings,0)
 assert.equal(result.rawQaReadPerformed,false);assert.equal(f.writes.length,0);assert.equal(f.reads.length,2);assert(Object.isFrozen(result))
 await assert.rejects(f.build().advance(request()),{code:'PROMOTION_DISABLED'})
 assert.equal(f.reads.length,2);assert.equal(f.writes.length,0)
})
test('both actual installations must match before any source mutation',async()=>{
 const f=fixture({promotionEnabled:true});f.states.product.currentSourceSha='d'.repeat(40)
 await assert.rejects(f.build().advance(request()),{code:'PUBLISHER_BINDING_FOREIGN_VERSION'})
 assert.equal(f.writes.length,0)
})
test('two fixed CAS operations preserve a stable identity and replays do not redispatch either database',async()=>{
 const f=fixture({promotionEnabled:true}),v=request(),client=f.build()
 assert.equal((await client.reconcile(v)).status,'BINDINGS_UNCHANGED')
 assert.deepEqual(await client.advance(v),{status:'BINDINGS_APPLIED',updatedBindings:6,rawQaReadPerformed:false,permissionMutationPerformed:false})
 assert.equal(f.writes.length,2);assert(f.writes.every(x=>x.args[0]===v.operationId&&x.args[3]===null))
 assert.equal((await client.advance(v)).status,'BINDINGS_APPLIED');assert.equal(f.writes.length,2)
 assert.equal((await client.reconcile(v)).status,'BINDINGS_APPLIED');assert.equal(f.writes.length,2)
})
test('lost first CAS response survives restart and resumes only the genuinely unapplied second installation',async()=>{
 const f=fixture({promotionEnabled:true}),v=request();f.lose('canonical')
 await assert.rejects(f.build().advance(v),e=>e.code==='PUBLISHER_BINDING_CAS_UNCERTAIN'&&!e.message.includes('PRIVATE'))
 assert.equal(f.writes.length,1);assert.equal((await f.build().reconcile(v)).status,'BINDINGS_PARTIALLY_APPLIED')
 assert.equal((await f.build().advance(v)).status,'BINDINGS_APPLIED')
 assert.deepEqual(f.writes.map(x=>x.profile),['canonical','product'])
})
test('lost second CAS response is reconciled from native operation metadata without another write',async()=>{
 const f=fixture({promotionEnabled:true}),v=request();f.lose('product')
 await assert.rejects(f.build().advance(v),{code:'PUBLISHER_BINDING_CAS_UNCERTAIN'})
 assert.equal(f.writes.length,2);assert.equal((await f.build().reconcile(v)).status,'BINDINGS_APPLIED')
 assert.equal((await f.build().advance(v)).status,'BINDINGS_APPLIED');assert.equal(f.writes.length,2)
})
test('a partially applied own release can be restored with promotion off and source access revoked',async()=>{
 const f=fixture({promotionEnabled:true}),v=request();f.lose('canonical')
 await assert.rejects(f.build().advance(v),{code:'PUBLISHER_BINDING_CAS_UNCERTAIN'})
 for(const s of Object.values(f.states)){s.publishingEnabled=false;s.bindingsFresh=false}
 const recovery={...v,restoreOperationId:randomUUID()},client=f.build({promotionEnabled:false})
 const result=await client.restore(recovery)
 assert.equal(result.status,'BINDINGS_RESTORED');assert.equal(result.updatedBindings,3);assert.equal(f.writes.length,2)
 assert.equal(f.writes[1].args[3],v.operationId);assert.equal(f.writes[1].profile,'canonical')
 assert.equal((await client.restore(recovery)).status,'BINDINGS_RESTORED');assert.equal(f.writes.length,2)
 assert(Object.values(f.states).every(s=>s.currentSourceSha===from&&!s.bindingsFresh&&!s.publishingEnabled))
})
test('full recovery is independent of the promotion flag and idempotent on the exact restore operation',async()=>{
 const f=fixture({promotionEnabled:true}),v=request();await f.build().advance(v)
 const recovery={...v,restoreOperationId:randomUUID()},client=f.build({promotionEnabled:false})
 assert.equal((await client.restore(recovery)).updatedBindings,6)
 assert.equal((await client.restore(recovery)).updatedBindings,6);assert.equal(f.writes.length,4)
})
test('foreign versions and an unexplained return to the old version block all recovery writes',async()=>{
 for(const foreign of [from,'d'.repeat(40),null]){
  const f=fixture({promotionEnabled:true}),v=request();await f.build().advance(v)
  f.states.product.currentSourceSha=foreign
  await assert.rejects(f.build().restore({...v,restoreOperationId:randomUUID()}))
  assert.equal(f.writes.length,2)
 }
})
test('another operation cannot be adopted or silently overwritten',async()=>{
 const f=fixture({promotionEnabled:true}),v=request();await f.build().advance(v)
 f.states.canonical.operations.get(v.operationId).fromSourceSha='d'.repeat(40)
 await assert.rejects(f.build().reconcile(v),{code:'PUBLISHER_BINDING_OPERATION_CONFLICT'})
 await assert.rejects(f.build().advance(v),{code:'PUBLISHER_BINDING_OPERATION_CONFLICT'})
 await assert.rejects(f.build().restore({...v,restoreOperationId:randomUUID()}))
 assert.equal(f.writes.length,2)
})
test('the separate recovery switch and each native recovery policy remain mandatory',async()=>{
 const f=fixture({promotionEnabled:true}),v=request();await f.build().advance(v)
 const recovery={...v,restoreOperationId:randomUUID()}
 await assert.rejects(f.build({recoveryEnabled:false}).restore(recovery),{code:'RECOVERY_DISABLED'})
 f.states.product.recoveryEnabled=false
 await assert.rejects(f.build().restore(recovery),{code:'RECOVERY_DISABLED'});assert.equal(f.writes.length,2)
})
test('provider metadata cannot add private rows, use another environment, widen expiry or claim access changes',async()=>{
 for(const change of [
  v=>({...v,privateRows:[]}),v=>({...v,environment:'production'}),v=>({...v,profile:'foreign'}),
  v=>({...v,rawQaReadPerformed:true}),v=>({...v,permissionMutationPerformed:true}),
  v=>({...v,authorisedUntil:'2026-11-28T00:00:00.000Z'}),v=>({...v,authorisedUntil:'invalid'}),
 ]){
  const f=fixture();f.corrupt(change)
  await assert.rejects(f.build().check({sourceSha:from}),{code:'PUBLISHER_BINDING_STATUS_INVALID'});assert.equal(f.writes.length,0)
 }
})
test('request scope refuses callbacks, foreign roles, getters and expired authority before a provider call',async()=>{
 const f=fixture({promotionEnabled:true}),v=request()
 for(const change of [{sql:'UPDATE anything'},{role:'owner'},{operationId:randomUUID(),toSourceSha:from},{fromSourceSha:'invalid'}]){
  await assert.rejects(f.build().advance({...v,...change}))
 }
 let accesses=0;const hostile={...v};Object.defineProperty(hostile,'operationId',{get(){accesses++;return v.operationId},enumerable:true})
 await assert.rejects(f.build().advance(hostile));assert.equal(accesses,0)
 await assert.rejects(f.build({now:()=>Date.parse('2026-11-27T23:59:59.000Z')}).advance(v),{code:'PUBLISHER_BINDING_AUTHORITY_EXPIRED'})
 await assert.rejects(f.build().check({sourceSha:from,sql:'SELECT private'}))
 assert.equal(f.reads.length,0);assert.equal(f.writes.length,0)
})
test('lost restoration response is reconciled on restart without reversing or granting anything twice',async()=>{
 const f=fixture({promotionEnabled:true}),v=request();await f.build().advance(v)
 const recovery={...v,restoreOperationId:randomUUID()};f.lose('canonical')
 await assert.rejects(f.build({promotionEnabled:false}).restore(recovery),{code:'PUBLISHER_BINDING_CAS_UNCERTAIN'})
 assert.equal((await f.build({promotionEnabled:false}).restore(recovery)).status,'BINDINGS_RESTORED')
 assert.deepEqual(f.writes.map(x=>x.profile),['canonical','product','canonical','product'])
})
