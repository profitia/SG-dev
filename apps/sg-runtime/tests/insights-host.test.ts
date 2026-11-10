import test from 'node:test'
import assert from 'node:assert/strict'
import {GET,POST,dynamic,runtime} from '../app/api/v1/insights/[...report]/route'

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
