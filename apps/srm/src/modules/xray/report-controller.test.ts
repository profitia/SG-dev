import assert from 'node:assert/strict'
import {test} from 'node:test'
import {SupplierReportController} from './report-controller'
import {sampleCard} from '../../demo/fixture'
import {projectReportData} from '../../server/report-data'
const nip='8650004194',other='5272443955',now=new Date('2026-10-20T00:00:00Z'),retrievedAt='2026-10-19T23:00:00Z'
const privateRef={snapshotId:'11111111-1111-4111-8111-111111111111',nip,entityType:'COMPANY',retentionUntil:'2026-10-21T00:00:00Z',exportRef:'b'.repeat(64)}
const metadata=(selected=nip)=>projectReportData({nip:selected,entityType:'COMPANY'},{nip:selected,financial_json:null,financial_sha256:null,financial_checked_at:null,facts:[],indicators:[],kys:null},now,{})
function setup(){
 let fail=false,ref:unknown=privateRef,selected=nip,sequence=0
 const keys:string[]=[]
 const transport:typeof fetch=async(path,init)=>{
  if(String(path).endsWith('/search')){
   selected=JSON.parse(String(init?.body)).identifier
   return Response.json({entityType:'COMPANY',card:{...sampleCard,identity:{...sampleCard.identity,nip:selected}}})
  }
  if(String(path).endsWith('/report-data'))return Response.json(metadata(selected))
  keys.push(new Headers(init?.headers).get('Idempotency-Key')??'')
  if(fail)throw new TypeError('Synthetic interrupted transport')
  return Response.json({section:{...sampleCard.kys,retrievedAt},privateReport:ref})
 }
 const controller=new SupplierReportController(transport,()=>now,()=> 'synthetic-ui-logical-key-'+(++sequence))
 return {controller,keys,setFail:(v:boolean)=>{fail=v},setRef:(v:unknown)=>{ref=v}}
}
test('browser retries an interrupted logical request with the same key; a completed next action has a new key',async()=>{
 const f=setup();await f.controller.search(nip);f.setFail(true);await f.controller.fetchKys();f.setFail(false);await f.controller.fetchKys()
 assert.equal(f.keys.length,2);assert.equal(f.keys[0],f.keys[1]);assert(f.keys[0])
 await f.controller.fetchKys();assert.notEqual(f.keys[2],f.keys[1])
})
test('private read PDF reference survives financial metadata refresh and cannot carry across suppliers or reset',async()=>{
 const f=setup();await f.controller.search(nip);await f.controller.fetchKys()
 assert.equal(f.controller.getSnapshot().metadata?.kys.exportRef,privateRef.exportRef)
 assert.equal(f.controller.getSnapshot().metadata?.kys.freshness.retrievedAt,retrievedAt.replace('Z','.000Z'))
 await f.controller.refreshMetadata();assert.equal(f.controller.getSnapshot().metadata?.kys.exportRef,privateRef.exportRef)
 await f.controller.search(other);assert.equal(f.controller.getSnapshot().metadata?.kys.exportRef??null,null)
 f.controller.reset();assert.equal(f.controller.getSnapshot().metadata,null)
})
test('invalid or foreign private references are refused and an unavailable private report clears older PDF authority',async()=>{
 for(const bad of[{...privateRef,nip:other},{...privateRef,entityType:'JDG'},{...privateRef,exportRef:'bad'},{...privateRef,retentionUntil:'2026-10-19T00:00:00Z'}]){
  const f=setup();await f.controller.search(nip);f.setRef(bad);await f.controller.fetchKys()
  assert(f.controller.getSnapshot().kysError);assert.equal(f.controller.getSnapshot().metadata?.kys.exportRef,null)
 }
 const f=setup();await f.controller.search(nip);await f.controller.fetchKys();assert.equal(f.controller.getSnapshot().metadata?.kys.exportRef,privateRef.exportRef)
 f.setFail(true);await f.controller.fetchKys();assert.equal(f.controller.getSnapshot().metadata?.kys.exportRef,null)
})
