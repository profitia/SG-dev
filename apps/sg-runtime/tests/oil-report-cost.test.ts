import test from 'node:test'
import assert from 'node:assert/strict'
import {oilReportCostReservation} from '../lib/insights/oil-report-cost'
test('one attempt fits its conservative reservation; timeout never releases a hold or permits retry',()=>{
 const r=oilReportCostReservation(15000)
 assert.equal(r.upperMicroUsd,117500);assert.equal(r.reservationMicroUsd,150000)
 assert.equal(r.unknownUsageReleasesHold,false);assert.equal(r.retryAllowed,false);assert.equal(r.providerInvoiceCost,'UNKNOWN')
 for(const n of [0,-1,15001,NaN,1.5])assert.throws(()=>oilReportCostReservation(n))
})
