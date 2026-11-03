import test from 'node:test'
import assert from 'node:assert/strict'
import {OIL_REPORT_PROFILE as p,assertOilBodyBudget} from '../lib/insights/oil-report-profile'
test('operation-specific candidate cannot alter global Finder model or enable a live call',()=>{
 assert.equal(p.model,'gpt-6.1-sol');assert.equal(p.liveExecutionEnabled,false);assert.equal(p.globalOpenAiModelChanged,false)
 assert.equal(p.retry,false);assert.equal(p.tools,false);assert.equal(p.background,false);assert.equal(p.maximumAttempts,1)
 assert.equal(p.reservationMicroUsd,4900000)
})
test('byte budget and independent exact-body token receipt are both mandatory',()=>{
 const r={count:15000,model:p.model,bodySha256:'body',verified:true}
 assertOilBodyBudget('{}',r,'body')
 for(const patch of [{count:15001},{count:-1},{verified:false},{model:'gpt-5.6-luna'},{bodySha256:'other'}])assert.throws(()=>assertOilBodyBudget('{}',{...r,...patch},'body'))
 assert.throws(()=>assertOilBodyBudget('ą'.repeat(32769),r,'body'))
})
