import test from 'node:test'
import assert from 'node:assert/strict'
import {readChartReference,benchmarkSnapshotBytes,contextDate,readContextReference,readContextSelection} from '../src/index.mjs'
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
test('ECR selection carries a bounded native time/target reference and no facts or claimed identity',()=>{
 const r={version:'2.1.0',source:'ECONOMIC_CALENDAR',from:'2026-11-01T00:00:00Z',to:'2026-12-01T00:00:00Z',targetType:null,targetId:null,asKnownAt:null,after:null}
 assert.equal(readContextReference(r).from,'2026-11-01T00:00:00.000Z')
 assert.equal(readContextSelection({version:'2.0.0',source:'CONTEXT_SELECTION',references:[r]}).references[0].source,r.source)
 for(const changed of [{actual:123},{organisationId:'claimed'},{allow:true},{version:'2.0.0'},{from:'2026-02-30T00:00:00Z'},
  {from:'2027-01-01T00:00:00Z'},{targetType:'BENCHMARK_SERIES'},{targetType:'URL',targetId:'https://other.example'},
  {after:'user-controlled-url'},{asKnownAt:'yesterday'}])assert.throws(()=>readContextReference({...r,...changed}))
 assert.throws(()=>readContextSelection({version:'2.0.0',source:'CONTEXT_SELECTION',references:Array(5).fill(r)}))
})
