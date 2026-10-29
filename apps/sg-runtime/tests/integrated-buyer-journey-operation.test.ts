import assert from 'node:assert/strict'
import test from 'node:test'
import {createPriceChangeIndexHandler} from '../lib/cost-analysis/price-change-index-operation'
import {analysePriceChangeIndex} from '../lib/cost-analysis/price-change-index-host'
import {pciAnalysisRequest,PCI_JOURNEY_VERSION,type PciAnalysisRequest} from '../lib/cost-analysis/price-change-index-contracts'
import {CCI_PRICE_NUMERIC_POLICY} from '../lib/cost-analysis/cci-indexed-price'
import type {SavedBenchmark,BenchmarkAnalyticsSeriesResult} from '../lib/benchmark/contracts'
import {pciIssueMessage} from '../lib/cost-analysis/price-change-index-messages'

const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222'
const provider={providerCode:'MACROBOND' as const,displayName:'Macrobond'}
function fixtures(){
  const selected:SavedBenchmark[]=['copper','energy'].map(id=>({selectionId:id,businessBenchmarkId:id,organizationId:A,displayName:id,provider,
    providerSeries:{provider,providerSeriesId:id,providerSeriesKey:id},frequency:'DAILY',currency:'USD',unit:'index',source:'SYNTHETIC TEST FIXTURE',selectedAt:'2024-01-01T00:00:00.000Z'}))
  const histories=new Map<string,BenchmarkAnalyticsSeriesResult>(selected.map((b,j)=>[b.businessBenchmarkId,{providerSeries:b.providerSeries,displayName:b.displayName,frequency:'DAILY',currency:'USD',unit:'index',source:'SYNTHETIC TEST FIXTURE',range:'ALL',latestValue:j?90:120,
    historical:[0,1,2].map((i)=>({date:`2024-01-0${i+1}`,value:(j?[110,100,90]:[80,100,120])[i]}))}]))
  const input:PciAnalysisRequest={contractVersion:PCI_JOURNEY_VERSION,organisationId:A,category:{name:'Synthetic category',components:[{name:'Copper',businessBenchmarkId:'copper',weightPercent:60},{name:'Energy',businessBenchmarkId:'energy',weightPercent:40}]},
    purchase:{amount:1000,currency:'PLN',unit:'tona',taxBasis:'NET',deliveryBasis:'EXW',purchaseDate:'2024-01-02',referenceDate:'2024-01-02',economicPeriodApproved:false},
    declarations:['copper','energy'].map(componentId=>({componentId,valueKind:'PRICE_INDEX',periodBasis:'POINT_IN_TIME',reduction:'NATIVE_ONLY'}))}
  return{input,selected,histories}
}
function request(input:unknown,headers:HeadersInit={},signal?:AbortSignal){return new Request('https://dev-sg2.spendguru.app/api/cost-analysis/price-change-index',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer synthetic.payload.signature',Host:'dev-sg2.spendguru.app',Origin:'https://dev-sg2.spendguru.app',...headers},body:JSON.stringify(input),signal})}
const cutoff='2024-01-04T00:00:00.000Z'

test('real adapter → Core → Indexed Price keeps both sides of the explicit buyer base',()=>{
  const f=fixtures(),result=analysePriceChangeIndex(f.input,f.selected,f.histories,cutoff)
  assert.equal(result.status,'CALCULATED');if(result.status!=='CALCULATED')return
  assert.deepEqual(result.core.calculation.nodes.map(n=>n.cci),[92,100,108])
  assert.deepEqual(result.indexedPrice.nodes.map(n=>n.categoryIndexedPrice),[920,1000,1080])
  assert.equal(result.indexedPrice.fxSemantics,'NATIVE_CURRENCY_RELATIVES_NO_FX')
  assert.equal(result.indexedPrice.basePrice.purchaseDate,'2024-01-02')
  assert(Math.abs(result.indexedPrice.nodes[2].components.reduce((s,c)=>s+c.contributionAmount!,0)-80)<=1000*CCI_PRICE_NUMERIC_POLICY.relativeReconciliationTolerance)
})
test('BFF composes accepted read boundaries, strips caller identity claims and never saves category/requests forecast',async()=>{
  const f=fixtures(),calls:Request[]=[]
  const handler=createPriceChangeIndexHandler({isClerk:()=>true,now:()=>cutoff,
    selections:async r=>{calls.push(r);return Response.json({items:f.selected})},
    history:async r=>{calls.push(r);return Response.json(f.histories.get(r.nextUrl.searchParams.get('seriesId')!))}})
  const response=await handler(request(f.input,{'x-user-id':'forged','x-organisation-id':B}))
  assert.equal(response.status,200);assert.equal((await response.json()).status,'CALCULATED')
  assert.equal(calls.length,3)
  for(const r of calls){assert.equal(r.method,'GET');assert.equal(r.headers.get('x-user-id'),null);assert.equal(r.headers.get('x-organisation-id'),null);assert.equal(r.headers.get('authorization'),'Bearer synthetic.payload.signature');assert.equal(new URL(r.url).searchParams.get('organisationId'),A)}
  assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('vary'),'Cookie, Authorization')
})
test('foreign organisation or unselected private identity is denied before history access',async()=>{
  for(const foreign of [true,false]){
    const f=fixtures();let histories=0
    if(!foreign)f.input.category.components[0].businessBenchmarkId='not-selected'
    const handler=createPriceChangeIndexHandler({isClerk:()=>true,now:()=>cutoff,
      selections:async()=>Response.json({items:foreign?f.selected.map(x=>({...x,organizationId:B})):f.selected}),history:async()=>{histories++;return Response.json({})}})
    assert.equal((await handler(request(f.input))).status,403);assert.equal(histories,0)
  }
})
test('session expiry or revoked access in any existing read yields no partial price response',async()=>{
  for(const status of [401,403,503]){
    const f=fixtures(),handler=createPriceChangeIndexHandler({isClerk:()=>true,now:()=>cutoff,selections:async()=>Response.json({items:f.selected}),history:async()=>new Response(null,{status})})
    const response=await handler(request(f.input));assert.equal(response.status,status);assert.deepEqual(await response.json(),{error:'Operation unavailable'})
  }
})
test('new flow cannot use legacy/demo auth, untrusted claims, oversized payloads or missing session',async()=>{
  const f=fixtures();let calls=0
  const handler=createPriceChangeIndexHandler({isClerk:()=>false,now:()=>cutoff,selections:async()=>{calls++;return Response.json({})},history:async()=>Response.json({})})
  assert.equal((await handler(request(f.input))).status,503);assert.equal(calls,0)
  assert.equal((await handler(request(f.input,{Authorization:''}))).status,401)
  const live=createPriceChangeIndexHandler({isClerk:()=>true,now:()=>cutoff,selections:async()=>{calls++;return Response.json({})},history:async()=>Response.json({})})
  assert.equal((await live(request({...f.input,role:'admin'}))).status,400)
  assert.equal((await live(request({...f.input,padding:'x'.repeat(40000)}))).status,400);assert.equal(calls,0)
})
test('missing base, missing observations and unapproved period mappings never fabricate results',()=>{
  const f=fixtures();f.input.purchase.referenceDate='2024-01-08'
  assert.equal(analysePriceChangeIndex(f.input,f.selected,f.histories,cutoff).status,'REFUSED')
  f.input.purchase.referenceDate='2024-01-02'
  f.histories.get('energy')!.historical[2].value=null
  const partial=analysePriceChangeIndex(f.input,f.selected,f.histories,cutoff)
  assert.equal(partial.status,'CALCULATED');if(partial.status!=='CALCULATED')return
  assert.equal(partial.indexedPrice.nodes[2].categoryIndexedPrice,null)
  assert.equal(partial.indexedPrice.nodes[2].status,'INCOMPLETE')
  assert.equal(partial.indexedPrice.nodes[1].categoryIndexedPrice,1000)
})
test('out-of-history buyer dates receive an actionable Polish range refusal, not a raw engine error',async()=>{
 const f=fixtures();f.input.purchase.purchaseDate='2026-10-04';f.input.purchase.referenceDate='2026-10-04'
 const before=JSON.stringify(f.input),handler=createPriceChangeIndexHandler({isClerk:()=>true,now:()=>cutoff,
  selections:async()=>Response.json({items:f.selected}),history:async r=>Response.json(f.histories.get(r.nextUrl.searchParams.get('seriesId')!))})
 const response=await handler(request(f.input)),result=await response.json()
 assert.equal(response.status,422);assert.equal(result.status,'REFUSED');assert.equal(result.issues[0].code,'REFERENCE_DATE_OUTSIDE_HISTORY')
 assert.match(result.issues[0].message,/poza zakresem dostępnej historii/);assert.match(result.issues[0].message,/2024/)
 assert.doesNotMatch(result.issues[0].message,/Range must be/);assert.equal(JSON.stringify(f.input),before)
})
test('missing exact day stays refused and a corrected real date can be analysed without losing composition',()=>{
 const f=fixtures();f.histories.get('energy')!.historical[1].value=null
 const missing=analysePriceChangeIndex(f.input,f.selected,f.histories,cutoff)
 assert.equal(missing.status,'REFUSED');if(missing.status!=='REFUSED')return
 assert(missing.issues.some(x=>x.code==='MISSING_BASE_NODE'&&x.message.includes('kompletu notowań')))
 f.input.purchase.purchaseDate='2024-01-03';f.input.purchase.referenceDate='2024-01-03'
 const next=analysePriceChangeIndex(f.input,f.selected,f.histories,cutoff);assert.equal(next.status,'CALCULATED')
 assert.deepEqual(f.input.category.components.map(x=>x.weightPercent),[60,40])
})
test('period consent remains a real gate, with plain language and no automatic date mapping',()=>{
 const f=fixtures();for(const history of f.histories.values()){
  history.frequency='MONTHLY';history.historical=history.historical.map((p,i)=>({...p,date:`2024-0${i+1}-01`}))
 }
 f.input.declarations=f.input.declarations.map(d=>({...d,periodBasis:'END_OF_PERIOD'}))
 f.input.purchase.purchaseDate='2024-01-17';f.input.purchase.referenceDate='2024-01-01'
 const date='2024-04-01T00:00:00.000Z',blocked=analysePriceChangeIndex(f.input,f.selected,f.histories,date)
 assert.equal(blocked.status,'REFUSED');if(blocked.status!=='REFUSED')return
 assert.equal(blocked.issues[0].code,'UNAPPROVED_PERIOD_MAPPING');assert.match(blocked.issues[0].message,/Potwierdź/)
 f.input.purchase.economicPeriodApproved=true
 assert.equal(analysePriceChangeIndex(f.input,f.selected,f.histories,date).status,'CALCULATED')
 assert.equal(f.input.purchase.purchaseDate,'2024-01-17')
})
test('unknown engine details never become buyer-facing English and known reasons remain actionable',()=>{
 assert.doesNotMatch(pciIssueMessage({code:'FUTURE_ENGINE_CODE',message:'internal technical detail'}),/internal technical/)
 assert.match(pciIssueMessage({code:'NO_COMPARABLE_CADENCE',message:'opaque'}),/częstotliwość/)
 assert.match(pciIssueMessage({code:'PURCHASE_OUTSIDE_BASE_PERIOD',message:'opaque'}),/rzeczywisty dzień zakupu/)
})
test('request terms and contract version are closed; readiness remains Category Builder policy',()=>{
  const f=fixtures();assert(pciAnalysisRequest.safeParse(f.input).success)
  assert(!pciAnalysisRequest.safeParse({...f.input,purchase:{...f.input.purchase,taxBasis:undefined}}).success)
  assert(!pciAnalysisRequest.safeParse({...f.input,contractVersion:'demo'}).success)
  f.input.category.components[1].weightPercent=39
  assert.equal(analysePriceChangeIndex(f.input,f.selected,f.histories,cutoff).status,'REFUSED')
})

test('independent tenant uses the same host without customer constants or cross-tenant selections',()=>{
  const f=fixtures();f.input.organisationId=B;const own=f.selected.map(b=>({...b,organizationId:B}))
  assert.equal(analysePriceChangeIndex(f.input,own,f.histories,cutoff).status,'CALCULATED')
  assert.equal(analysePriceChangeIndex(f.input,f.selected,f.histories,cutoff).status,'REFUSED')
})
test('invalid civil dates are rejected before domain calculation',()=>{
 const f=fixtures();for(const date of ['2024-02-30','2023-02-29','2024-13-01'])assert(!pciAnalysisRequest.safeParse({...f.input,purchase:{...f.input.purchase,purchaseDate:date}}).success)
})
test('stable component identities survive a repeated selected benchmark and nonalphabetic order',()=>{
 const f=fixtures();f.input.category.components[1].businessBenchmarkId='copper';f.input.declarations[0].componentId='z-last';f.input.declarations[1].componentId='a-first'
 const result=analysePriceChangeIndex(f.input,f.selected,f.histories,cutoff);assert.equal(result.status,'CALCULATED')
 if(result.status!=='CALCULATED')return
 assert.equal(result.indexedPrice.nodes[2].categoryIndexedPrice,1200)
 assert.deepEqual(new Set(result.indexedPrice.nodes[2].components.map(c=>c.componentId)),new Set(['z-last','a-first']))
})
