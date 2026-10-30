import test from 'node:test'
import assert from 'node:assert/strict'
import {createPriceChangeIndexHandler} from '../lib/cost-analysis/price-change-index-operation'
import {pciSmartRequest} from '../lib/cost-analysis/pci-smart-preparation-contracts'
import {classifyBenchmark} from '../lib/benchmark/qualification'
const org='11111111-1111-4111-8111-111111111111',foreign='22222222-2222-4222-8222-222222222222',provider={providerCode:'MACROBOND',displayName:'Synthetic'}
function fixture(count=2){
 const selected=Array.from({length:count},(_,i)=>({selectionId:'selected-'+i,businessBenchmarkId:'s'+i,organizationId:org,provider,providerSeries:{provider,providerSeriesId:'s'+i},displayName:`Synthetic price ${i}, Close, USD`,description:'Spot price',currency:'USD',unit:'USD/tonne',frequency:'DAILY',source:'SYNTHETIC',selectedAt:'2026-10-01T00:00:00Z'}))
 const input=pciSmartRequest.parse({contractVersion:'sg2.price-change-index.smart/1.0.0',mode:'PREPARE',organisationId:org,category:{name:'Fixture',components:selected.map((b,i)=>({name:'Component '+i,weightPercent:count===3?i===0?40:30:100/count,businessBenchmarkId:b.businessBenchmarkId}))},purchase:{amount:100,currency:'PLN',unit:'tona',taxBasis:'NET',deliveryBasis:'EXW',purchaseDate:'2026-10-02'},declarations:selected.map(b=>({componentId:b.businessBenchmarkId}))})
 const history=(id:string)=>({providerSeries:{provider,providerSeriesId:id},frequency:'DAILY',historical:[1,2,3].map(d=>({date:`2026-10-0${d}`,value:100+d})),unit:'USD/tonne',currency:'USD'})
 return{input,selected,history}
}
const request=(input:unknown)=>new Request('https://dev-sg2.spendguru.app/api/cost-analysis/price-change-index',{method:'POST',headers:{authorization:'Bearer synthetic.payload.signature','content-type':'application/json',origin:'https://dev-sg2.spendguru.app','x-user-id':'untrusted'},body:JSON.stringify(input)})
test('2/5 components use one selection and one history per distinct active series, never per candidate',async()=>{
 for(const count of [2,5]){const f=fixture(count),calls:Request[]=[]
  const handler=createPriceChangeIndexHandler({isClerk:()=>true,now:()=> '2026-11-02T00:00:00Z',selections:async r=>{calls.push(r);return Response.json({items:f.selected})},history:async r=>{calls.push(r);return Response.json(f.history(r.nextUrl.searchParams.get('seriesId')!))}})
  const before=structuredClone(f.input),prepared=await handler(request(f.input));assert.equal(prepared.status,200)
  const p=(await prepared.json()).preparation;assert(p.candidates.length>1);assert.equal(calls.length,count+1)
  assert(calls.every(r=>r.headers.get('x-user-id')===null))
  const response=await handler(request({...f.input,mode:'ANALYSE',reference:{preparationId:p.id,candidateId:p.recommendedCandidateId}}));assert.equal(response.status,200);assert.equal((await response.json()).status,'CALCULATED');assert.equal(calls.length,2*(count+1));assert.deepEqual(f.input,before)
 }
})
test('known quantity is refused before any history; unknown sampling is explainable, never guessed',async()=>{
 const f=fixture();Object.assign(f.selected[1],{displayName:'Steel inventories',description:'Stock quantity',unit:'tonnes',currency:null});let reads=0
 const handler=createPriceChangeIndexHandler({isClerk:()=>true,now:()=> '2026-11-02T00:00:00Z',selections:async()=>Response.json({items:f.selected}),history:async()=>{reads++;return Response.json({})}})
 const r=await handler(request(f.input));assert.equal(r.status,200);const body=await r.json();assert.equal(body.preparation.state,'NO_QUALIFIED_REFERENCE');assert.match(body.preparation.issues[0].message,/nie jest cena/);assert.equal(reads,0)
})
test('revocation/foreign organisation preserve fail-closed boundary with no partial private output',async()=>{
 for(const status of [401,403,503]){const f=fixture();let reads=0
  const denied=createPriceChangeIndexHandler({isClerk:()=>true,now:()=> '2026-11-02T00:00:00Z',selections:async()=>new Response(null,{status}),history:async()=>{reads++;return Response.json({})}})
  assert.equal((await denied(request(f.input))).status,status);assert.equal(reads,0)
  const foreignHandler=createPriceChangeIndexHandler({isClerk:()=>true,now:()=> '2026-11-02T00:00:00Z',selections:async()=>Response.json({items:f.selected.map(x=>({...x,organizationId:foreign}))}),history:async()=>{reads++;return Response.json({})}})
  assert.equal((await foreignHandler(request(f.input))).status,403);assert.equal(reads,0)
  const lost=createPriceChangeIndexHandler({isClerk:()=>true,now:()=> '2026-11-02T00:00:00Z',selections:async()=>Response.json({items:f.selected}),history:async()=>new Response(null,{status})})
  const out=await lost(request(f.input));assert.equal(out.status,status);assert.deepEqual(await out.json(),{error:'Operation unavailable'})
 }
})
test('zero weight retains private identity validation but avoids unnecessary history read',async()=>{
 const f=fixture(3);f.input.category.components.forEach((c,i)=>c.weightPercent=i===2?0:50);const ids:string[]=[]
 const handler=createPriceChangeIndexHandler({isClerk:()=>true,now:()=> '2026-11-02T00:00:00Z',selections:async()=>Response.json({items:f.selected}),history:async r=>{const id=r.nextUrl.searchParams.get('seriesId')!;ids.push(id);return Response.json(f.history(id))}})
 const r=await handler(request(f.input));assert.equal(r.status,200);assert.deepEqual(ids,['s0','s1']);assert.equal((await r.json()).preparation.components.length,3)
})
