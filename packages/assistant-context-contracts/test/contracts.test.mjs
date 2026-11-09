import test from 'node:test'
import assert from 'node:assert/strict'
import {readChartReference,benchmarkSnapshotBytes,contextDate} from '../src/index.mjs'
test('chart references carry selection and version, never values or authority',()=>{
 const r={version:'1.0.0',source:'BENCHMARK_CHART',seriesId:'oil_test',from:'2026-01-01',to:'2026-02-01',fingerprint:'a'.repeat(64)}
 assert.ok(Object.isFrozen(readChartReference(r)))
 for(const extra of [{allow:true},{values:[100]},{organisationId:'other'}])assert.throws(()=>readChartReference({...r,...extra}))
 assert.throws(()=>contextDate('2026-02-30'));assert.throws(()=>readChartReference({...r,to:'2025-01-01'}))
})
test('snapshot bytes preserve units, nulls, exact observations and ordering',()=>{
 const v={seriesId:'test',unit:'tonne',currency:'EUR',source:'Market data',points:[{date:'2026-01-01T00:00:00.000Z',value:1.25},{date:'2026-02-01',value:null}]}
 assert.equal(benchmarkSnapshotBytes(v),JSON.stringify(['test','tonne','EUR','Market data',[['2026-01-01',1.25],['2026-02-01',null]]]))
 assert.throws(()=>benchmarkSnapshotBytes({...v,points:[...v.points].reverse()}))
 assert.throws(()=>benchmarkSnapshotBytes({...v,points:[{date:'2026-01-01',value:Infinity}]}))
})
