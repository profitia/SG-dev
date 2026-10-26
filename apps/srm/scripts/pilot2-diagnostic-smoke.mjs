import fs from 'node:fs'
import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
const epsilon=.004
const close=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=epsilon
const union=xs=>{let n=0,a=null,b=0;for(const[x,y]of xs.filter(([x,y])=>y>x).sort((a,b)=>a[0]-b[0])){if(a===null){a=x;b=y}else if(x>b){n+=b-a;a=x;b=y}else b=Math.max(b,y)}return n+(a===null?0:b-a)}
const roots=new Set(['srm_diagnostic_trace','srm_diagnostic_spans','srm_diagnostic_segments','srm_diagnostic_dependencies','srm_diagnostic_resources','srm_diagnostic_complete'])
const clientEvents=new Set(['srm_diagnostic_client_request','srm_diagnostic_client_complete','srm_client_form_admission_timing'])
function records(input){
 if(Array.isArray(input))return input.flatMap(records)
 if(input&&typeof input==='object'){
  if(roots.has(input.event)||clientEvents.has(input.event))return [input]
  if(Array.isArray(input.logs))return records(input.logs)
  if(Array.isArray(input.events))return records(input.events)
  if(typeof input.message==='string')return records(input.message)
  return []
 }
 if(typeof input!=='string')return []
 try{return records(JSON.parse(input))}catch{}
 return input.split('\n').flatMap(line=>{const start=line.indexOf('{');if(start<0)return [];try{return records(JSON.parse(line.slice(start)))}catch{return []}})
}
/** Offline acceptance utility only. It reads bounded diagnostic events and
 * never opens an application/database/provider connection or receives authority. */
export function validateDiagnosticEvents(input){
 const all=records(input),groups=new Map()
 for(const event of all.filter(event=>roots.has(event.event))){
  if(typeof event.traceId!=='string'||typeof event.fragmentId!=='string')continue
  const key=event.traceId+':'+event.fragmentId
  const entries=groups.get(key)??[];entries.push(event);groups.set(key,entries)
 }
 const reports=[]
 for(const entries of groups.values()){
  const failures=[],summaries=entries.filter(x=>x.event==='srm_diagnostic_trace'),summary=summaries[0]
  if(summaries.length!==1)failures.push('SUMMARY_MISSING_OR_DUPLICATE')
  const read=(event,field,count)=>{
   const chunks=entries.filter(x=>x.event===event),index=new Map()
   for(const chunk of chunks){if(!Number.isSafeInteger(chunk.chunk)||chunk.chunk<0||index.has(chunk.chunk))failures.push('CHUNK_INVALID_OR_DUPLICATE');index.set(chunk.chunk,chunk[field])}
   if(!Number.isSafeInteger(count)||index.size!==count)failures.push('CHUNK_COUNT_MISMATCH')
   const out=[]
   for(let i=0;i<(Number.isSafeInteger(count)?count:0);i++){if(!Array.isArray(index.get(i)))failures.push('CHUNK_MISSING');else out.push(...index.get(i))}
   return out
  }
  const rows=read('srm_diagnostic_spans','rows',summary?.spanChunks),segments=read('srm_diagnostic_segments','segments',summary?.segmentChunks)
  const dependencies=read('srm_diagnostic_dependencies','dependencies',summary?.dependencyChunks),resources=read('srm_diagnostic_resources','resources',summary?.resourceChunks)
  const ids=new Map(rows.map(r=>[r.spanId,r])),root=ids.get(summary?.rootSpanId)
  if(ids.size!==rows.length||!root)failures.push('SPAN_IDS_OR_ROOT_INVALID')
  if(summary?.schema!=='srm.diagnostic-trace/1.0')failures.push('SCHEMA_INVALID')
  for(const row of rows){
   if(!Number.isFinite(row.startMs)||!Number.isFinite(row.endMs)||row.endMs<row.startMs||!close(row.inclusiveMs,row.endMs-row.startMs))failures.push('SPAN_CLOCK_INVALID')
   if(row.parentSpanId&&!ids.has(row.parentSpanId))failures.push('SPAN_PARENT_MISSING')
   const children=rows.filter(r=>r.parentSpanId===row.spanId)
   const expected=row.endMs-row.startMs-union(children.map(c=>[Math.max(row.startMs,c.startMs),Math.min(row.endMs,c.endMs)]))
   if(!close(row.exclusiveMs,Math.max(0,expected)))failures.push('EXCLUSIVE_UNION_INVALID')
   if(row.dbServerMs!==null||row.dbWireMs!==null)failures.push('UNSUPPORTED_SERVER_TIME_CLAIM')
  }
  if(root){
   const sorted=[...segments].sort((a,b)=>a.startMs-b.startMs);let cursor=root.startMs,total=0,unknown=0
   for(const segment of sorted){
    if(!close(segment.startMs,cursor)||segment.endMs<segment.startMs||!close(segment.durationMs,segment.endMs-segment.startMs)||!ids.has(segment.spanId))failures.push('LEDGER_GAP_OR_OVERLAP')
    cursor=segment.endMs;total+=segment.endMs-segment.startMs;if(segment.category==='UNKNOWN')unknown+=segment.endMs-segment.startMs
   }
   if(!close(cursor,root.endMs)||!close(total,summary.totalMs)||!close(summary.accountedMs,summary.totalMs)||!close(unknown,summary.unknownMs))failures.push('TOTAL_ACCOUNTING_INVALID')
  }
  for(const d of dependencies)if(!ids.has(d.fromSpanId)||!ids.has(d.toSpanId)||!['START','END'].includes(d.fromPoint)||!['START','END'].includes(d.toPoint))failures.push('DEPENDENCY_INVALID')
  for(const r of resources)if(!ids.has(r.parentSpanId)||!['CONNECTION','TRANSACTION','HTTP'].includes(r.kind))failures.push('RESOURCE_INVALID')
  const complete=entries.find(x=>x.event==='srm_diagnostic_complete')
  if(complete&&!close(complete.observedWrapperMs,complete.handlerMs+complete.analysisMs+complete.exportMs+complete.observerOtherMs))failures.push('OBSERVER_ACCOUNTING_INVALID')
  reports.push({traceId:entries[0].traceId,fragmentId:entries[0].fragmentId,clockId:summary?.clockId??null,route:summary?.route??null,parentFragmentId:summary?.parentFragmentId??null,formAdmissionFragmentId:summary?.formAdmissionFragmentId??null,
   startMs:root?.startMs??null,endMs:root?.endMs??null,status:failures.length?'FAIL':'PASS',failures:[...new Set(failures)],complete:summary?.complete??false,
   totalMs:summary?.totalMs??null,unknownMs:summary?.unknownMs??null,sqlQueryCalls:summary?.sqlQueryCalls??null,spanCount:rows.length,dependencyCount:dependencies.length,resourceCount:resources.length,
   criticalPathStatus:summary?.criticalPathStatus??'MISSING',completionFooterObserved:!!complete,observerMs:complete?complete.observedWrapperMs-complete.handlerMs:null,synthetic:summary?.synthetic??false,nestedRowsAreNotAdditive:true})
 }
 const logicalRuns=[]
 for(const traceId of new Set(reports.map(r=>r.traceId))){
  const fragments=reports.filter(r=>r.traceId===traceId),ids=new Map(fragments.map(r=>[r.fragmentId,r])),dependencies=[]
  const missingParents=[]
  for(const fragment of fragments)if(fragment.parentFragmentId){if(!ids.has(fragment.parentFragmentId))missingParents.push(fragment.parentFragmentId);else dependencies.push({fromFragmentId:fragment.parentFragmentId,toFragmentId:fragment.fragmentId,kind:'SERVER_ISSUED_REQUEST_DEPENDENCY'})}
  const sameClock=fragments.every(f=>f.clockId&&f.clockId===fragments[0].clockId),ordered=[...fragments].sort((a,b)=>a.startMs-b.startMs)
  const serial=sameClock&&!missingParents.length&&ordered.every((f,i)=>i===0?f.parentFragmentId===null:f.parentFragmentId===ordered[i-1].fragmentId&&f.startMs>=ordered[i-1].endMs)
  const backendMs=serial?fragments.reduce((n,f)=>n+f.totalMs,0):null,observerMs=serial&&fragments.every(f=>f.observerMs!==null)?fragments.reduce((n,f)=>n+f.observerMs,0):null
  const completed=all.find(e=>e.event==='srm_diagnostic_client_complete'&&e.traceId===traceId&&ids.has(e.lastFragmentId))
  const clientMs=completed&&Number.isFinite(completed.endMs)&&Number.isFinite(completed.startMs)?completed.endMs-completed.startMs:null
  const residual=clientMs!==null&&backendMs!==null&&observerMs!==null?clientMs-backendMs-observerMs:null
  logicalRuns.push({traceId,fragmentIds:ordered.map(f=>f.fragmentId),dependencies,missingParents,serialFragmentsVerified:serial,
   backendTraceComplete:serial&&fragments.every(f=>f.complete),
   backendHandlerMs:backendMs,observerMs,userClickToClientReadyMs:clientMs,unknownClientServerBoundaryMs:residual,
   userLedgerStatus:residual===null?'NOT_MEASURED_CLIENT_OR_OBSERVER':residual<-.02?'INCONSISTENT_OBSERVATIONS':'ACCOUNTED_WITH_EXPLICIT_UNKNOWN_RESIDUAL',
   formAdmissionFragmentIds:[...new Set(fragments.map(f=>f.formAdmissionFragmentId).filter(Boolean))],formAdmissionExcludedFromClickTotal:true,
   clockPolicy:'SERVER_AND_BROWSER_TIMESTAMPS_NEVER_MIXED;ONLY_SERIAL_DURATIONS_SUBTRACTED',nestedRowsAreNotAdditive:true})
 }
 return {schema:'srm.diagnostic-validation/1.0',status:reports.length&&reports.every(r=>r.status==='PASS')&&!logicalRuns.some(r=>r.userLedgerStatus==='INCONSISTENT_OBSERVATIONS')?'PASS':'FAIL',fragments:reports,logicalRuns}
}
export async function syntheticDiagnosticProof(){
 const {withDiagnosticRequest,diagnosticRun,exportDiagnosticPacket}=await import('../src/server/diagnostic-trace.ts')
 const {diagnosticAsync,diagnosticSync}=await import('@profitia/platform-contracts/diagnostic-phase')
 const events=[],original=console.info;console.info=value=>{try{events.push(JSON.parse(value))}catch{}}
 try{
  const first=await withDiagnosticRequest('search',undefined,async()=>{
   await diagnosticAsync('SOURCE_PLAN',async()=>diagnosticRun('PARALLEL',async()=>Promise.all([
    diagnosticRun('POLL_WAIT',()=>Promise.resolve(),{kind:'WAIT'}),diagnosticRun('SOURCE_DECODE',()=>JSON.parse('{"synthetic":true}'))
   ]),{join:'ALL'}))
   return Response.json({synthetic:true})
  },{enabled:true,emit:packet=>exportDiagnosticPacket(packet),onComplete:event=>events.push(event)})
  const request=new Request('https://synthetic.invalid/',{headers:{'X-SRM-Diagnostic-Execution':first.headers.get('X-SRM-Diagnostic-Execution'),'X-SRM-Diagnostic-Parent':first.headers.get('X-SRM-Diagnostic-Fragment')}})
  await withDiagnosticRequest('krs_lookup',request,async()=>{
   diagnosticSync('SOURCE_DIGEST',()=>true)
   return Response.json({synthetic:true})
  },{enabled:true,emit:packet=>exportDiagnosticPacket(packet),onComplete:event=>events.push(event)})
 }finally{console.info=original}
 const result=validateDiagnosticEvents(events)
 assert.equal(result.status,'PASS');assert.equal(result.fragments.length,2);assert.equal(result.fragments[0].traceId,result.fragments[1].traceId)
 assert.equal(result.logicalRuns.length,1);assert.equal(result.logicalRuns[0].backendTraceComplete,true);assert.equal(result.logicalRuns[0].dependencies.length,1)
 assert(result.fragments.every(f=>f.sqlQueryCalls===0))
 return {schema:'srm.diagnostic-synthetic-proof/1.0',events,validation:result,providerCalls:0,databaseCalls:0,businessSearches:0}
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 const [mode,input,output]=process.argv.slice(2)
 const result=mode==='--synthetic'?await syntheticDiagnosticProof():mode==='--validate'?validateDiagnosticEvents(fs.readFileSync(input,'utf8')):null
 if(!result)throw Error('Use --synthetic [output] or --validate input [output]')
 const destination=mode==='--synthetic'?input:output
 if(destination)fs.writeFileSync(destination,JSON.stringify(result,null,2)+'\n')
 console.info(JSON.stringify(result.validation??result))
 if((result.validation??result).status!=='PASS')process.exitCode=1
}
