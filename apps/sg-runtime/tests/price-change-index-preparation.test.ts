import test from 'node:test'
import assert from 'node:assert/strict'
import {preparePriceChangeIndex} from '../lib/cost-analysis/price-change-index-preparation'
import {analysePriceChangeIndex} from '../lib/cost-analysis/price-change-index-host'
import {createPriceChangeIndexHandler} from '../lib/cost-analysis/price-change-index-operation'
import {PCI_JOURNEY_VERSION,type PciAnalysisRequest} from '../lib/cost-analysis/price-change-index-contracts'
import type {SavedBenchmark,BenchmarkAnalyticsSeriesResult} from '../lib/benchmark/contracts'

const org='11111111-1111-4111-8111-111111111111',cutoff='2026-10-29T12:00:00.000Z'
/** All source values and identities here are synthetic, independent of live market records. */
function fixture(frequency='Daily',dates=['2026-10-01','2026-10-22','2026-10-23']){
 const provider={providerCode:'MACROBOND' as const,displayName:'Synthetic provider transport'}
 const selected:SavedBenchmark[]=['oil-test','steel-test'].map(id=>({businessBenchmarkId:id,selectionId:id,organizationId:org,displayName:id,provider,providerSeries:{provider,providerSeriesId:id,providerSeriesKey:id},frequency,currency:'USD',unit:'USD/tona',source:'SYNTHETIC',selectedAt:cutoff}))
 const histories=new Map<string,BenchmarkAnalyticsSeriesResult>(selected.map(b=>[b.businessBenchmarkId,{providerSeries:b.providerSeries,displayName:b.displayName,frequency,currency:'USD',unit:'USD/tona',source:'SYNTHETIC',range:'ALL',latestValue:110,historical:dates.map((date,i)=>({date,value:100+i*10}))}]))
 const input:PciAnalysisRequest={contractVersion:PCI_JOURNEY_VERSION,organisationId:org,category:{name:'Synthetic composition',components:selected.map((b,i)=>({name:b.displayName,businessBenchmarkId:b.businessBenchmarkId,weightPercent:i?10:90}))},purchase:{amount:100,currency:'PLN',unit:'tona',taxBasis:'NET',deliveryBasis:'EXW',purchaseDate:'2026-10-22',referenceDate:'2026-10-01',economicPeriodApproved:false},declarations:selected.map(b=>({componentId:b.businessBenchmarkId,valueKind:'PRICE_LEVEL',periodBasis:'POINT_IN_TIME',reduction:'NATIVE_ONLY'}))}
 return{input,selected,histories}
}
test('preparation lists real adapter nodes; only periods containing the unchanged purchase date are eligible',()=>{
 const f=fixture(),before=JSON.stringify(f.input),p=preparePriceChangeIndex(f.input,f.selected,f.histories,cutoff).preparation
 assert.equal(JSON.stringify(f.input),before);assert.equal(p.periods.length,3)
 assert.deepEqual(p.periods.filter(v=>v.eligible).map(v=>v.start),['2026-10-22'])
 assert(p.issues.some(i=>i.code==='PURCHASE_OUTSIDE_BASE_PERIOD'));assert.equal(p.canAnalyse,false)
 for(const period of p.periods){const input=structuredClone(f.input);input.purchase.referenceDate=period.start
  assert.equal(analysePriceChangeIndex(input,f.selected,f.histories,cutoff).status,period.eligible?'CALCULATED':'REFUSED')}
})
test('buyer explicitly chooses a lawful period and receives existing CCI and Indexed Price output',()=>{
 const f=fixture();f.input.purchase.referenceDate='2026-10-22'
 assert.equal(preparePriceChangeIndex(f.input,f.selected,f.histories,cutoff).preparation.canAnalyse,true)
 const result=analysePriceChangeIndex(f.input,f.selected,f.histories,cutoff)
 assert.equal(result.status,'CALCULATED');if(result.status==='CALCULATED'){assert.equal(result.indexedPrice.basePrice.purchaseDate,'2026-10-22');assert.equal(result.indexedPrice.nodes.find(n=>n.period.start.startsWith('2026-10-23'))!.categoryIndexedPrice,120/110*100)}
})
test('missing reference distinguishes each component and retains all buyer inputs',()=>{
 const f=fixture();f.histories.get('oil-test')!.historical=[{date:'2026-09-23',value:50}]
 const before=JSON.stringify(f.input),p=preparePriceChangeIndex(f.input,f.selected,f.histories,cutoff).preparation
 assert.equal(p.components[0].lastDate,'2026-09-23');assert.equal(p.components[0].status,'MISSING_OBSERVATION');assert.equal(p.components[1].status,'COMPLETE')
 assert.equal(p.canAnalyse,false);assert(p.issues.some(i=>i.code==='MISSING_BASE_NODE'));assert(p.issues.some(i=>i.code==='NO_BASE_FOR_PURCHASE'))
 const result=analysePriceChangeIndex(f.input,f.selected,f.histories,cutoff);assert.equal(result.status,'REFUSED')
 if(result.status==='REFUSED'){assert(result.issues.some(i=>i.code==='MISSING_BASE_NODE'));assert.doesNotMatch(result.issues.map(i=>i.message).join(' '),/complete closed common base node/)}
 assert.equal(JSON.stringify(f.input),before)
})
test('an open monthly period cannot become eligible; previous month cannot anchor October purchase',()=>{
 const f=fixture('Monthly',['2026-08-01','2026-09-01','2026-10-01']);f.input.declarations.forEach(d=>d.periodBasis='PERIOD_AVERAGE')
 const p=preparePriceChangeIndex(f.input,f.selected,f.histories,cutoff).preparation
 assert(p.issues.some(i=>i.code==='OPEN_BASE_PERIOD'));assert(p.periods.every(v=>!v.eligible));assert(p.components.every(c=>c.status==='OPEN_PERIOD'));assert.equal(p.canAnalyse,false)
 assert.equal(f.input.purchase.economicPeriodApproved,false)
})
test('closed monthly base needs explicit association; consent never overrides purchase membership',()=>{
 const f=fixture('Monthly',['2026-08-01','2026-09-01','2026-10-01']);f.input.declarations.forEach(d=>d.periodBasis='PERIOD_AVERAGE')
 f.input.purchase.purchaseDate='2026-09-22';f.input.purchase.referenceDate='2026-09-01'
 let p=preparePriceChangeIndex(f.input,f.selected,f.histories,cutoff).preparation
 assert(p.issues.some(i=>i.code==='UNAPPROVED_PERIOD_MAPPING'));assert.equal(p.canAnalyse,false)
 assert.equal(analysePriceChangeIndex(f.input,f.selected,f.histories,cutoff).status,'REFUSED')
 f.input.purchase.economicPeriodApproved=true;p=preparePriceChangeIndex(f.input,f.selected,f.histories,cutoff).preparation;assert.equal(p.canAnalyse,true)
 assert.equal(analysePriceChangeIndex(f.input,f.selected,f.histories,cutoff).status,'CALCULATED')
 f.input.purchase.referenceDate='2026-08-01';assert.equal(preparePriceChangeIndex(f.input,f.selected,f.histories,cutoff).preparation.canAnalyse,false)
 assert.equal(analysePriceChangeIndex(f.input,f.selected,f.histories,cutoff).status,'REFUSED')
})
test('out-of-range reference can inspect history without silently becoming an available selected node',()=>{
 const f=fixture();f.input.purchase.referenceDate='2027-01-01'
 const p=preparePriceChangeIndex(f.input,f.selected,f.histories,cutoff).preparation
 assert.equal(p.periods.length,3);assert.equal(p.canAnalyse,false);assert.equal(f.input.purchase.referenceDate,'2027-01-01')
 const result=analysePriceChangeIndex(f.input,f.selected,f.histories,cutoff);assert.equal(result.status,'REFUSED');if(result.status==='REFUSED')assert.equal(result.issues[0].code,'REFERENCE_DATE_OUTSIDE_HISTORY')
})
test('unsupported mixed frequencies, empty histories, null values and unknown cadence remain refused',()=>{
 for(const kind of ['mixed','empty','null','unknown']){const f=fixture();const h=f.histories.get('steel-test')!
  if(kind==='mixed')h.frequency='Quarterly';if(kind==='empty')h.historical=[];if(kind==='null')h.historical.forEach(p=>p.value=null);if(kind==='unknown')h.frequency='Other'
  assert.equal(preparePriceChangeIndex(f.input,f.selected,f.histories,cutoff).preparation.canAnalyse,false)
  assert.equal(analysePriceChangeIndex(f.input,f.selected,f.histories,cutoff).status,'REFUSED')}
})
test('PREPARE revalidates existing E1 reads, does not calculate/write, and closes tenant/revocation boundaries',async()=>{
 for(const deny of [null,401,403,503,'foreign'] as const){const f=fixture(),calls:string[]=[]
  const handler=createPriceChangeIndexHandler({isClerk:()=>true,now:()=>cutoff,selections:async()=>Response.json({items:deny==='foreign'?f.selected.map(b=>({...b,organizationId:'22222222-2222-4222-8222-222222222222'})):f.selected}),history:async r=>{calls.push(r.url);return typeof deny==='number'?new Response(null,{status:deny}):Response.json(f.histories.get(r.nextUrl.searchParams.get('seriesId')!))}})
  const response=await handler(new Request('https://host.invalid/api/cost-analysis/price-change-index',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer synthetic.payload.signature'},body:JSON.stringify({...f.input,mode:'PREPARE'})}))
  assert.equal(response.status,deny==='foreign'?403:deny??200)
  const body=await response.json();if(deny===null){assert.equal(body.status,'PREPARED');assert.equal(body.core,undefined);assert.equal(body.indexedPrice,undefined)}else assert.equal(body.preparation,undefined)
  if(deny==='foreign')assert.equal(calls.length,0)
 }
})

test('WTI-shaped stored UTC period collision is reported by component, without inventing a cadence failure or trimming history',()=>{
 const f=fixture(),h=f.histories.get('steel-test')!
 h.displayName='Synthetic Cushing WTI fixture';h.providerSeries.providerSeriesId='wti-fixture';h.providerSeries.providerSeriesKey='wti-fixture';f.selected[1].providerSeries=h.providerSeries
 h.historical=[{date:'1986-01-01T23:00:00.000Z',value:25.56},{date:'1986-01-02T00:00:00.000Z',value:25.56},{date:'1986-01-02T23:00:00.000Z',value:26},...h.historical]
 const before=JSON.stringify({input:f.input,histories:[...f.histories]})
 const p=preparePriceChangeIndex(f.input,f.selected,f.histories,cutoff).preparation
 assert.equal(p.canAnalyse,false);assert.equal(p.periods.length,0)
 assert.equal(p.components[1].status,'DUPLICATE_NATIVE_PERIOD');assert.equal(p.components[1].firstDate,'1986-01-01');assert.equal(p.components[1].lastDate,'2026-10-23')
 assert.equal(p.issues[0].code,'DUPLICATE_NATIVE_PERIOD');assert.match(p.issues[0].message,/steel-test.*Synthetic Cushing WTI fixture.*wti-fixture/)
 assert.match(p.issues[0].message,/1986-01-02.*UTC/);assert.match(p.issues[0].message,/Wybierz inny właściwy benchmark/);assert.match(p.issues[0].message,/Sama zmiana daty zakupu nie usuwa/)
 const r=analysePriceChangeIndex(f.input,f.selected,f.histories,cutoff);assert.equal(r.status,'REFUSED')
 if(r.status==='REFUSED'){assert.equal(r.core?.issues[0].code,'DUPLICATE_NATIVE_PERIOD');assert.equal(r.issues[0].message,p.issues[0].message)}
 assert.equal(JSON.stringify({input:f.input,histories:[...f.histories]}),before)
})
test('nonpositive values and duplicate exact timestamps keep their distinct Core codes and actionable messages',()=>{
 for(const kind of ['negative','duplicate']){
  const f=fixture(),h=f.histories.get('steel-test')!
  if(kind==='negative')h.historical[0].value=-36.98;else h.historical.splice(1,0,{...h.historical[0]})
  const p=preparePriceChangeIndex(f.input,f.selected,f.histories,cutoff).preparation
  assert.equal(p.issues[0].code,kind==='negative'?'INVALID_PRICE_LEVEL':'DUPLICATE_OBSERVATION')
  assert.match(p.issues[0].message,/steel-test/);assert.match(p.issues[0].message,/Wybierz inny właściwy benchmark/)
  if(kind==='negative'){assert.match(p.issues[0].message,/-36.98/);assert.match(p.issues[0].message,/2026-10-01/)}
  assert.equal(p.canAnalyse,false);assert.equal(analysePriceChangeIndex(f.input,f.selected,f.histories,cutoff).status,'REFUSED')
 }
})
