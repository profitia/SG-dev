import assert from 'node:assert/strict'
import {test} from 'node:test'
import {SupplierReportController} from './report-controller'
import {sampleCard} from '../../demo/fixture'
import {projectReportData} from '../../server/report-data'
import {createSupplierWebRequest} from './supplier-web-request'
const nip='8650004194',other='5272443955',now=new Date('2026-10-20T00:00:00Z'),retrievedAt='2026-10-19T23:00:00Z'
const privateRef={snapshotId:'11111111-1111-4111-8111-111111111111',nip,entityType:'COMPANY',retentionUntil:'2026-10-21T00:00:00Z',exportRef:'b'.repeat(64)}
const metadata=(selected=nip)=>projectReportData({nip:selected,entityType:'COMPANY'},{nip:selected,financial_json:null,financial_sha256:null,financial_checked_at:null,facts:[],indicators:[],kys:null},now,{})

test('website client keeps one logical key across uncertain delivery and pending work, then rotates after success',async()=>{
 let call=0,keys=0
 const seen:{key:string|null;body:unknown}[]=[]
 const load=createSupplierWebRequest(nip,'COMPANY',{newKey:()=>`synthetic-web-request-${++keys}`,fetcher:async(url,init)=>{
  assert.equal(url,'/api/xray/web-identity');assert.equal(init?.method,'POST')
  seen.push({key:new Headers(init?.headers).get('Idempotency-Key'),body:JSON.parse(String(init?.body))});call++
  if(call===1)throw Error('Synthetic uncertain delivery')
  return Response.json({status:call===2?'PENDING':'NOT_FOUND',websiteUrl:null,logoDataUrl:null,evidenceUrl:null,logoSourceUrl:null,method:null,checkedAt:null},
   {status:call===2?202:200})
 }})
 await assert.rejects(load(new AbortController().signal),/Synthetic uncertain/)
 assert.equal((await load(new AbortController().signal)).status,'PENDING')
 assert.equal((await load(new AbortController().signal)).status,'NOT_FOUND')
 await load(new AbortController().signal)
 assert.deepEqual(seen.map(x=>x.key),['synthetic-web-request-1','synthetic-web-request-1','synthetic-web-request-1','synthetic-web-request-2'])
 for(const request of seen)assert.deepEqual(request.body,{identifier:nip,entityType:'COMPANY'})
})
test('website client does not issue an aborted request and never invents actor or organization headers',async()=>{
 let calls=0
 const load=createSupplierWebRequest(nip,'JDG',{newKey:()=> 'synthetic-web-request-key',fetcher:async(_url,init)=>{
  calls++;assert.deepEqual([...new Headers(init?.headers).keys()],['content-type','idempotency-key'])
  assert.deepEqual(JSON.parse(String(init?.body)),{identifier:nip,entityType:'JDG'})
  return Response.json({error:'Operation unavailable'},{status:403})
 }})
 const aborted=new AbortController();aborted.abort()
 await assert.rejects(load(aborted.signal));assert.equal(calls,0)
 await assert.rejects(load(new AbortController().signal),/WEBSITE_UNAVAILABLE/);assert.equal(calls,1)
})
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
