import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {projectFrozenOilD0,FROZEN_OIL_D0_SHA256} from '../lib/forecast/oil-d0-report-projection'
test('frozen package refuses fabricated, edited and malformed input before reading any numbers',()=>{
 for(const v of ['{}','{"price":999}','not-json'])assert.throws(()=>projectFrozenOilD0(Buffer.from(v)),/FINGERPRINT/)
})
test('local licensed D0: all eight predictions and all 320 verification comparisons pass parity without model fitting',{skip:!process.env.OIL_D0_READONLY_FILE},()=>{
 const bytes=fs.readFileSync(process.env.OIL_D0_READONLY_FILE!),p=projectFrozenOilD0(bytes),d=JSON.parse(bytes.toString())
 assert.equal(p.inputSha256,FROZEN_OIL_D0_SHA256);assert.equal(p.comparisonCount,320);assert.equal(p.series.length,2)
 for(const s of p.series){assert.equal(s.weekChange,s.actual-s.previousWeekValue);assert.equal(s.weekChangePercent,(s.actual-s.previousWeekValue)/s.previousWeekValue*100)}
 for(const s of p.series)for(const m of s.models){const v=d.series.find((x:{seriesId:string})=>x.seriesId===s.id).modelResults[m.id]
  assert.equal(m.point,v.current.forecastValue);assert.equal(m.smape,v.verification.metrics.smape);assert.equal(m.historicalAverageVerificationPercent,Math.max(0,Math.min(100,100-m.smape)))
  assert.equal(m.intervals,'NOT_AVAILABLE');assert.equal(m.sampleSize,40)
 }
 const altered=Buffer.from(bytes);altered[10]^=1;assert.throws(()=>projectFrozenOilD0(altered),/FINGERPRINT/)
})
