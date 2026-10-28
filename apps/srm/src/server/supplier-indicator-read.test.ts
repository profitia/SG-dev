import test from 'node:test'
import assert from 'node:assert/strict'
import type {PoolClient} from 'pg'
import type {FinancialData} from '@profitia/srm-xray'
import {OperationDenied,operationPayloadDigest,type Json,type OperationContext} from '@profitia/platform-contracts/operation-context'
import {createSrmSupplierNativeWorkStore} from './supplier-native-work-store'
import type {SupplierNativeWork} from './supplier-request-work'
import {FINANCIAL_INDICATOR_INPUT_CODES,type CatalogIndicatorFact} from './financial-indicators'
import {readFinancialIndicators,readStoredIndicatorFacts} from './shared-catalog'
const org='11111111-1111-4111-8111-111111111111',user='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',service='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',requestId='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const selection={organisationId:org,requestId,command:{kind:'SUPPLIER_REPORT' as const,nip:'1234563218'}}
const facts:CatalogIndicatorFact[]=Object.entries({BS_A_CA:'150',BS_LAE_LAPFL_STL:'100',BS_A_TA:'1000',BS_LAE_LAPFL:'400'}).map(([metricCode,amount])=>({metricCode,amount,periodStart:'2025-01-01',periodEnd:'2025-12-31',statementScope:'UNIT',currencyCode:'PLN',unitCode:'PLN',sourcePath:'content.standardized_fields.'+metricCode,validationStatus:'VALID',normalizationRule:'SOURCE_VALUE',sourceSnapshotId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'}))
const data:FinancialData={periods:[{from:'2025-01-01',to:'2025-12-31',scope:'standalone',documentId:'synthetic-document:cfy',facts:facts.map(f=>({metricCode:f.metricCode,amount:f.amount,currency:'PLN',unit:'PLN'}))}]}
function fixture(changeAtRevisionRead=Infinity,denyUnit=Infinity,cachedReport=false,denyOutcome=false){
 let units=0,revisions=0,sqlCalls=0;const metricGroups:string[][]=[]
 const work:SupplierNativeWork={async run(s,unit,input,action){
  units++;if(units===denyUnit)throw new OperationDenied('POLICY_UNAVAILABLE')
  assert.deepEqual(s,selection);assert.equal(unit,'SRM_CACHE_READ')
  const payloadDigest=operationPayloadDigest(s.command),ctx={actorKind:'SERVICE',actorId:service,actor:{kind:'SERVICE',actorId:service,serviceId:service},operation:'job.execute',applicationId:'srm-jobs',subjectUserId:user,organisationId:org,resourceId:requestId,payloadDigest,
  requestWork:{requestId,unitId:unit,accessMode:'READ',inputDigest:operationPayloadDigest(input as Json),schemaDigest:'b'.repeat(64),transactionId:String(100+units),policyVersion:'1',policySourceRef:'SYNTHETIC_ONLY',policyExpiresAt:new Date(Date.now()+60000).toISOString()},
  delegation:{requestId,subjectUserId:user,organisationId:org,payloadDigest,target:{operation:'supplier.report.refresh',resourceId:'supplier-request:'+payloadDigest,application:{appId:'srm'}}}} as unknown as OperationContext
  const client={query:async(sql:string,parameters:unknown[])=>{sqlCalls++;assert.equal(parameters[0],selection.command.nip)
   if(sql.startsWith('SELECT xmin')){revisions++;return{rows:[{revision:revisions>=changeAtRevisionRead?'102':'101'}]}}
   assert(sql.includes('FROM srm.catalog_financial_facts'));const metrics=parameters[1] as string[];assert(metrics.length<=(cachedReport?FINANCIAL_INDICATOR_INPUT_CODES.length:4));metricGroups.push(metrics);return{rows:facts.filter(f=>metrics.includes(f.metricCode))}
  }} as unknown as PoolClient
  await action(ctx,client);if(denyOutcome)throw new OperationDenied('POLICY_UNAVAILABLE');return{requestId,unitId:unit,status:'ACCEPTED'}
 }}
 return{store:createSrmSupplierNativeWorkStore({work,namedInterestBoundaryDigest:'a'.repeat(64)}),metricGroups,units:()=>units,sqlCalls:()=>sqlCalls}
}
test('partitioned native reads cover each existing metric exactly once and preserve financial formulas',async()=>{
 const f=fixture(),expected=await readFinancialIndicators({query:async()=>({rows:facts})} as unknown as PoolClient,selection.command.nip,data)
 const result=await f.store.indicators(selection,data)
 assert.deepEqual(result,expected);assert.equal(result.find(x=>x.code==='CURRENT_RATIO')?.value,'1.500000')
 assert.deepEqual(f.metricGroups.flat(),FINANCIAL_INDICATOR_INPUT_CODES)
 assert.equal(f.units(),Math.ceil(FINANCIAL_INDICATOR_INPUT_CODES.length/4))
})
for(const change of [2,3])test('a publication change within or between admitted units discards the complete result: '+change,async()=>{
 const f=fixture(change);await assert.rejects(f.store.indicators(selection,data),/publication changed/);assert.equal(f.metricGroups.length,1)
})
test('later E1 refusal cannot be replaced by earlier captured facts or a partial indicator response',async()=>{
 const f=fixture(Infinity,2);await assert.rejects(f.store.indicators(selection,data),e=>e instanceof OperationDenied);assert.equal(f.units(),2);assert.equal(f.metricGroups.length,1)
})
test('metric selection cannot introduce a new field or duplicate an existing metric',async()=>{
 let queries=0;const client={query:async()=>{queries++;return{rows:[]}}} as unknown as PoolClient
 for(const codes of [[],['UNKNOWN_FIELD'],['BS_A_CA','BS_A_CA']])await assert.rejects(readStoredIndicatorFacts(client,selection.command.nip,codes))
 assert.equal(queries,0)
})

test('the cached report reads the identical complete metric set in one current Work and preserves every formula result',async()=>{
 const f=fixture(Infinity,Infinity,true),partitioned=await fixture().store.indicators(selection,data)
 const result=await f.store.indicators(selection,data,true)
 assert.deepEqual(result,partitioned);assert.equal(f.units(),1);assert.equal(f.sqlCalls(),3)
 assert.deepEqual(f.metricGroups,[FINANCIAL_INDICATOR_INPUT_CODES])
 for(const change of [
  (v:FinancialData)=>{v.periods[0].facts[0].amount='999'},
  (v:FinancialData)=>{v.periods[0].facts[0].unit='UNKNOWN'},
  (v:FinancialData)=>{v.periods[0].to='2025-06-30'},
 ]){
  const input=structuredClone(data);change(input)
  assert.deepEqual(await fixture(Infinity,Infinity,true).store.indicators(selection,input,true),await fixture().store.indicators(selection,input))
 }
})
test('a publication change during the consolidated read refuses its complete captured dataset',async()=>{
 const f=fixture(2,Infinity,true)
 await assert.rejects(f.store.indicators(selection,data,true),/publication changed/)
 assert.equal(f.units(),1);assert.equal(f.metricGroups.length,1)
})
test('a current Work refusal before reading or after its action cannot release consolidated indicators',async()=>{
 for(const f of [fixture(Infinity,1,true),fixture(Infinity,Infinity,true,true)]){
  await assert.rejects(f.store.indicators(selection,data,true),e=>e instanceof OperationDenied)
  assert.equal(f.units(),1)
 }
 const f=fixture()
 await assert.rejects(f.store.indicators(selection,data,'browser-selected' as never),e=>e instanceof OperationDenied)
 assert.equal(f.units(),0)
})
