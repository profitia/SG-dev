import test from 'node:test'
import assert from 'node:assert/strict'
import {OperationDenied} from '@profitia/platform-contracts/operation-context'
import {createSupplierMapReadinessHandler} from './supplier-map-readiness'
import {prepareSupplierMapRuntime} from '../modules/xray/supplier-map-readiness'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import receipt from '../../operation-integration.json'
const supplier='11111111-1111-4111-8111-111111111111',url='https://srm.fixture.test/api/supplier-locations?supplierId='+supplier
const health={service:'maps-runtime',environment:'development',configured:true,mode:'read-only',persistence:false}
const pause=async()=>{}
test('readiness adoption preserves all prior receipts and pins exact map-only consumer changes',()=>{
 const a=receipt.supplierMapRuntimeReadinessRepair,hash=(v:Buffer)=>createHash('sha256').update(v).digest('hex')
 const prior=execFileSync('git',['show',a.previousReceiptSourceSha+':apps/srm/operation-integration.json'])
 assert.equal(hash(prior),a.previousReceiptDigest)
 for(const[k,v]of Object.entries(JSON.parse(prior.toString())))assert.deepEqual((receipt as Record<string,unknown>)[k],v,k)
 for(const[f,d]of Object.entries(a.applicationSourceDigests)){
  const next:{previousReceiptSourceSha:string;applicationSourceDigests:Record<string,string>}=receipt.supplierMapAddressOnlyRepair
  const latest:{previousReceiptSourceSha:string;applicationSourceDigests:Record<string,string>}=receipt.supplierMapGeocodingActivation
  const bytes=next?.applicationSourceDigests[f]?execFileSync('git',['show',next.previousReceiptSourceSha+':apps/srm/'+f]):latest?.applicationSourceDigests[f]?execFileSync('git',['show',latest.previousReceiptSourceSha+':apps/srm/'+f]):(receipt.fullUiParityAdoption?.applicationSourceDigests as Record<string,string>)[f]?execFileSync('git',['show',receipt.fullUiParityAdoption.previousReceiptSourceSha+':apps/srm/'+f]):readFileSync(new URL('../../'+f,import.meta.url))
  assert.equal(hash(bytes),d,f)
 }
 assert.equal(a.locationAuthorityChanged,false);assert.equal(a.paidProviderCallsAdded,false);assert.equal(a.databaseSchemaChanged,false)
})
test('current location authorization precedes a fixed-origin readiness probe without identity forwarding',async()=>{
 const events:string[]=[]
 const handler=createSupplierMapReadinessHandler({read:async(r,id)=>{events.push('read');assert.equal(id,supplier);assert.equal(r.url,url)},pause,
  transport:async(input,init)=>{events.push('probe');assert.equal(input,'https://profitia-maps-development-runtime.onrender.com/api/health');assert.equal(init?.redirect,'error');assert.equal(init?.cache,'no-store');assert.deepEqual([...new Headers(init?.headers)], [['accept','application/json']]);return Response.json(health)}})
 const result=await handler(new Request(url,{headers:{Cookie:'synthetic-session',Authorization:'Bearer synthetic'}}))
 assert.equal(result.status,200);assert.deepEqual(await result.json(),{ready:true});assert.deepEqual(events,['read','probe'])
})
test('denied or revoked location access never warms the remote service',async()=>{
 let probes=0
 const handler=createSupplierMapReadinessHandler({read:async()=>{throw new OperationDenied('PERMISSION_DENIED')},transport:async()=>{probes++;return Response.json(health)},pause})
 const result=await handler(new Request(url));assert.equal(result.status,403);assert.equal(probes,0);assert.deepEqual(await result.json(),{ready:false})
})
test('a wake-up HTML response cannot be accepted as a ready map runtime',async()=>{
 let calls=0,pauses=0
 const handler=createSupplierMapReadinessHandler({read:async()=>{},transport:async()=>++calls===1?new Response('Waking up',{headers:{'Content-Type':'text/html'}}):Response.json(health),pause:async()=>{pauses++}})
 assert.equal((await handler(new Request(url))).status,200);assert.equal(calls,2);assert.equal(pauses,1)
})
test('missing configuration, wrong environment and malformed health stay unavailable with bounded attempts',async()=>{
 for(const body of [{...health,configured:false},{...health,environment:'staging'},{...health,service:'other'},{...health,persistence:true}]){
  let calls=0;const handler=createSupplierMapReadinessHandler({read:async()=>{},transport:async()=>{calls++;return Response.json(body)},pause})
  const result=await handler(new Request(url));assert.equal(result.status,503);assert.equal(calls,12);assert.deepEqual(await result.json(),{ready:false})
 }
})
test('readiness accepts no caller organization, alternate URL, duplicate supplier or mutation method',async()=>{
 let reads=0,probes=0;const handler=createSupplierMapReadinessHandler({read:async()=>{reads++},transport:async()=>{probes++;return Response.json(health)},pause})
 for(const query of ['','?supplierId=invalid','?supplierId='+supplier+'&organisationId='+supplier,'?supplierId='+supplier+'&url=https://other.fixture.test','?supplierId='+supplier+'&supplierId='+supplier])assert.equal((await handler(new Request('https://srm.fixture.test/api/supplier-locations'+query))).status,400)
 assert.equal((await handler(new Request(url,{method:'POST'}))).status,405);assert.equal(reads,0);assert.equal(probes,0)
})
test('cancelled startup does not authorize or probe, and the browser rejects a late ready response',async()=>{
 const abort=new AbortController();abort.abort();let calls=0
 const handler=createSupplierMapReadinessHandler({read:async()=>{calls++},transport:async()=>{calls++;return Response.json(health)},pause})
 assert.equal((await handler(new Request(url,{signal:abort.signal}))).status,503);assert.equal(calls,0)
 await assert.rejects(prepareSupplierMapRuntime(supplier,abort.signal,async()=>{calls++;return Response.json({ready:true})}));assert.equal(calls,0)
 const during=new AbortController()
 await assert.rejects(prepareSupplierMapRuntime(supplier,during.signal,async()=>{during.abort();return Response.json({ready:true})}));
})
test('browser readiness uses only the same-origin protected route and refuses any unsuccessful status',async()=>{
 await prepareSupplierMapRuntime(supplier,new AbortController().signal,async(input,init)=>{assert.equal(input,'/api/supplier-locations?supplierId='+supplier);assert.equal(init?.method,'GET');assert.equal(init?.credentials,'same-origin');return Response.json({ready:true})})
 for(const response of [Response.json({ready:false},{status:503}),Response.json({ready:true},{status:403}),Response.json({ready:true,unexpected:'data'})])await assert.rejects(prepareSupplierMapRuntime(supplier,new AbortController().signal,async()=>response))
})
