import test from 'node:test'
import assert from 'node:assert/strict'
import {GET,POST,dynamic,runtime} from '../app/api/v1/insights/[...report]/route'
import {getInsightsRuntime,normalizeInsightsReportRequest} from '../lib/insights/autonomous-runtime'

test('report ingress preserves POST bytes and validates the public authority behind Render',async()=>{
 const body=JSON.stringify({definitionId:'oil-asphalt',revision:1})
 const request=new Request('https://localhost:10000/api/v1/insights/report-jobs',{method:'POST',
  headers:{host:'dev-sg2.spendguru.app',authorization:'Bearer SYNTHETIC_ONLY',origin:'https://dev-sg2.spendguru.app',
   'content-type':'application/json','x-forwarded-host':'untrusted.example','x-forwarded-proto':'http'},body})
 const current=normalizeInsightsReportRequest(request,['https://dev-sg2.spendguru.app'])
 assert(current);assert.equal(current.url,'https://dev-sg2.spendguru.app/api/v1/insights/report-jobs')
 assert.equal(current.headers.get('authorization'),'Bearer SYNTHETIC_ONLY')
 assert.equal(current.headers.has('x-forwarded-host'),false);assert.equal(current.headers.has('x-forwarded-proto'),false)
 assert.equal(await current.text(),body)
 for(const headers of [{host:'untrusted.example','x-forwarded-host':'dev-sg2.spendguru.app'},
  {host:'dev-sg2.spendguru.app',origin:'https://untrusted.example'}])
  assert.equal(normalizeInsightsReportRequest(new Request('https://localhost:10000/api/v1/insights/report-editions',{headers}),['https://dev-sg2.spendguru.app']),null)
 const direct=normalizeInsightsReportRequest(new Request('https://dev-sg2.spendguru.app/api/v1/insights/report-editions'),['https://dev-sg2.spendguru.app'])
 assert.equal(direct?.url,'https://dev-sg2.spendguru.app/api/v1/insights/report-editions')
})

test('actual SG route exports deny a disabled report host without database/model side effects',async()=>{
 const before=process.env.INSIGHTS_REPORTS_ENABLED
 process.env.INSIGHTS_REPORTS_ENABLED='false'
 try{
  assert.equal(runtime,'nodejs');assert.equal(dynamic,'force-dynamic')
  for(const [method,handler] of [['GET',GET],['POST',POST]] as const){
   const response=await handler(new Request('https://dev-sg2.spendguru.app/api/v1/insights/report-jobs',{method}))
   assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'private, no-store')
   assert.deepEqual(await response.json(),{error:{code:'INSIGHTS_NOT_ENABLED'}})
  }
 }finally{if(before===undefined)delete process.env.INSIGHTS_REPORTS_ENABLED;else process.env.INSIGHTS_REPORTS_ENABLED=before}
})

test('the actual SG host loads native ESM dependencies, preserves singleton and clears rejected initialization',async()=>{
 const enabled=process.env.INSIGHTS_REPORTS_ENABLED
 const configuration=process.env.INSIGHTS_CONFIGURATION_JSON
 try{
  process.env.INSIGHTS_REPORTS_ENABLED='false'
  const first=getInsightsRuntime()
  assert.equal(getInsightsRuntime(),first)
  await assert.rejects(first,{code:'INSIGHTS_NOT_ENABLED'})
  process.env.INSIGHTS_REPORTS_ENABLED='true'
  delete process.env.INSIGHTS_CONFIGURATION_JSON
  const second=getInsightsRuntime()
  assert.notEqual(second,first)
  assert.equal(getInsightsRuntime(),second)
  await assert.rejects(second,{message:'INSIGHTS_CONFIGURATION_REQUIRED'})
 }finally{
  if(enabled===undefined)delete process.env.INSIGHTS_REPORTS_ENABLED;else process.env.INSIGHTS_REPORTS_ENABLED=enabled
  if(configuration===undefined)delete process.env.INSIGHTS_CONFIGURATION_JSON;else process.env.INSIGHTS_CONFIGURATION_JSON=configuration
 }
})
