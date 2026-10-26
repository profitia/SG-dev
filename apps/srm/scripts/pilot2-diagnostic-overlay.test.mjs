import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {prepareBaseline} from './pilot2-baseline.mjs'
import {diagnosticPilot2} from './pilot2-diagnostic-overlay.mjs'
import {validateDiagnosticEvents} from './pilot2-diagnostic-smoke.mjs'
const repo=fileURLToPath(new URL('../../..',import.meta.url)),hash=v=>createHash('sha256').update(v).digest('hex')
test('complete private artifact receives exact diagnostic closure and correlation at real entrances',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'pilot2-diagnostic-overlay-'))
 try{
  const target=JSON.parse(fs.readFileSync(path.join(repo,'apps/srm/deployment/pilot2-runtime-targets.json')))
  const output=path.join(temp,'prepared'),proof=prepareBaseline(repo,target,output,'PRIVATE_OPERATIONS'),diagnostic=proof.overlay.diagnosticTelemetry
  assert.equal(proof.overlay.stage,'PRIVATE_OPERATIONS');assert.equal(diagnostic.schema,'srm.diagnostic-trace/1.0');assert.equal(diagnostic.observerOnly,true)
  assert.equal(diagnostic.changedSecurityOrBusinessContract,false);assert.equal(diagnostic.intendedServiceId,'srv-dbeh6srrjlhs73fmikrg')
  for(const f of diagnostic.sourceFiles)assert.equal(hash(fs.readFileSync(path.join(output,f.path))),f.sha256,f.path)
  for(const route of ['admission','search','report-data','krs/lookup']){
   const source=fs.readFileSync(path.join(output,'apps/srm/app/api/xray/'+route+'/route.ts'),'utf8')
   assert.match(source,/withDiagnosticRequest\('/);assert.match(source,/request,\(\)=>originalDiagnosticPost\(request\)/)
  }
  const read=file=>fs.readFileSync(path.join(output,'apps/srm/'+file),'utf8')
  assert.match(read('app/api/health/route.ts'),/diagnosticTelemetry: await diagnosticHealth\(async/)
  assert.match(read('app/api/health/route.ts'),/diagnosticPhaseSourceDigest/)
  assert.match(read('src/server/report-data.ts'),/projectReportDataObserved/)
  assert.match(read('src/server/diagnostic-pg.ts'),/raw\.query=function/)
  assert.match(read('src/server/db.ts'),/instrumentDiagnosticPool/)
  assert.match(read('src/server/pilot2-registry.ts'),/'REGISTRY_READER'/)
  // Original formulas and scanner remain exact historical/current inputs;
  // no diagnostic transform invents a second financial implementation.
  for(const name of ['financial-indicators.ts','financial-scanner.ts','financial-revisions.ts'])assert.equal(read('src/server/'+name),fs.readFileSync(path.join(repo,'apps/srm/src/server/'+name),'utf8'))
  assert.throws(()=>diagnosticPilot2(repo,output,proof),/Diagnostic overlay already installed/)
 }finally{fs.rmSync(temp,{recursive:true,force:true})}
})
test('offline collector rejects missing chunks and incorrect exclusive arithmetic',()=>{
 const root={spanId:'root',parentSpanId:null,category:'REQUEST',startMs:0,endMs:10,inclusiveMs:10,exclusiveMs:10,dbServerMs:null,dbWireMs:null}
 const summary={event:'srm_diagnostic_trace',schema:'srm.diagnostic-trace/1.0',traceId:'synthetic-trace',fragmentId:'synthetic-fragment',rootSpanId:'root',spanChunks:1,segmentChunks:1,dependencyChunks:0,resourceChunks:0,totalMs:10,accountedMs:10,unknownMs:10,complete:true,sqlQueryCalls:0}
 const events=[summary,{event:'srm_diagnostic_spans',traceId:summary.traceId,fragmentId:summary.fragmentId,chunk:0,rows:[root]},
  {event:'srm_diagnostic_segments',traceId:summary.traceId,fragmentId:summary.fragmentId,chunk:0,segments:[{spanId:'root',category:'UNKNOWN',startMs:0,endMs:10,durationMs:10}]}]
 assert.equal(validateDiagnosticEvents(events).status,'PASS')
 assert.equal(validateDiagnosticEvents(events.slice(0,2)).status,'FAIL')
 assert.equal(validateDiagnosticEvents([...events,events[1]]).status,'FAIL')
 assert.equal(validateDiagnosticEvents([summary,{...events[1],rows:[{...root,exclusiveMs:9}]},events[2]]).status,'FAIL')
 assert.equal(validateDiagnosticEvents([summary,events[1],{...events[2],segments:[{spanId:'root',category:'UNKNOWN',startMs:1,endMs:10,durationMs:9}]}]).status,'FAIL')
})
test('two backend requests and the browser clock reconcile without adding nested or overlapping time',()=>{
 const traceId='synthetic-logical-trace'
 const fragment=(fragmentId,start,duration,parent)=>{
  const common={traceId,fragmentId},root={spanId:fragmentId,parentSpanId:null,category:'REQUEST',startMs:start,endMs:start+duration,inclusiveMs:duration,exclusiveMs:duration,dbServerMs:null,dbWireMs:null}
  return [{...common,event:'srm_diagnostic_trace',schema:'srm.diagnostic-trace/1.0',clockId:'server-fixture-clock',route:parent?'krs_lookup':'search',parentFragmentId:parent,rootSpanId:fragmentId,spanChunks:1,segmentChunks:1,dependencyChunks:0,resourceChunks:0,totalMs:duration,accountedMs:duration,unknownMs:duration,complete:true,sqlQueryCalls:0},
   {...common,event:'srm_diagnostic_spans',chunk:0,rows:[root]},
   {...common,event:'srm_diagnostic_segments',chunk:0,segments:[{spanId:fragmentId,category:'UNKNOWN',startMs:start,endMs:start+duration,durationMs:duration}]},
   {...common,event:'srm_diagnostic_complete',handlerMs:duration,analysisMs:.2,exportMs:.7,observerOtherMs:.1,observedWrapperMs:duration+1}]
 }
 const events=[...fragment('first',10,10,null),...fragment('second',25,5,'first'),{event:'srm_diagnostic_client_complete',traceId,lastFragmentId:'second',startMs:1000,endMs:1030}]
 const result=validateDiagnosticEvents(events),logical=result.logicalRuns[0]
 assert.equal(result.status,'PASS');assert.equal(logical.backendTraceComplete,true);assert.equal(logical.dependencies.length,1)
 assert.equal(logical.backendHandlerMs,15);assert.equal(logical.observerMs,2);assert.equal(logical.unknownClientServerBoundaryMs,13)
 assert.equal(logical.userLedgerStatus,'ACCOUNTED_WITH_EXPLICIT_UNKNOWN_RESIDUAL')
 assert.equal(validateDiagnosticEvents([...events.slice(0,-1),{...events.at(-1),endMs:1005}]).status,'FAIL')
})
