import {test} from 'node:test'
import assert from 'node:assert/strict'
import {channel,tracingChannel} from 'node:diagnostics_channel'
import {diagnosticEnabled,analyzeDiagnosticSpans,diagnosticRun,diagnosticResource,withDiagnosticRequest,unionLength,exportDiagnosticPacket,type DiagnosticPacket,type DiagnosticSpan,type DiagnosticCompletion} from './diagnostic-trace'
const pause=(n:number)=>new Promise(resolve=>setTimeout(resolve,n))
test('interval union,not sum,defines exclusive parent time',()=>{
 assert.equal(unionLength([[0,5],[3,8],[10,12]]),10)
 const spans:DiagnosticSpan[]=[{spanId:'root',parentSpanId:null,category:'REQUEST',startMs:0,endMs:20,status:'OK',kind:'STAGE',join:'ALL'},
  {spanId:'a',parentSpanId:'root',category:'PG_ACQUIRE',startMs:2,endMs:12,status:'OK',kind:'WAIT',join:'SERIAL'},
  {spanId:'b',parentSpanId:'root',category:'SQL_DOMAIN_READ',startMs:4,endMs:18,status:'OK',kind:'SQL',join:'SERIAL',sqlCommands:1}]
 const result=analyzeDiagnosticSpans(spans,'root')
 assert.equal(result.rows[0].exclusiveMs,4);assert.equal(result.accountedMs,20);assert.equal(result.sqlQueryCalls,1)
 assert.equal(result.criticalPathStatus,'OBSERVED_SERIAL_OR_EXPLICIT_ALL_JOIN');assert.equal(result.unknownMs,6)
})
test('unobserved concurrent dependency remains UNKNOWN',()=>{
 const base:DiagnosticSpan={spanId:'root',parentSpanId:null,category:'REQUEST',startMs:0,endMs:10,status:'OK',kind:'STAGE',join:'UNSPECIFIED'}
 const result=analyzeDiagnosticSpans([base,{...base,spanId:'a',parentSpanId:'root',startMs:1,endMs:7},{...base,spanId:'b',parentSpanId:'root',startMs:2,endMs:8}],'root')
 assert.equal(result.unknownMs,10);assert.equal(result.unresolvedJoins,1);assert.equal(result.accountedMs,10)
})
test('safe request spans preserve original result and never export input,result,error text',async()=>{
 let packet:DiagnosticPacket|undefined
 const secret='fixture-private-body-9511855233',request=new Request('https://example.test/',{headers:{'X-SRM-Diagnostic-Execution':'11111111-1111-4111-8111-111111111111'}})
 const value={body:secret}
 const result=await withDiagnosticRequest('search',request,async()=>{
  await diagnosticRun('FINANCIAL_ACQUIRE',async()=>{await diagnosticRun('PG_ACQUIRE',()=>pause(2),{kind:'WAIT'})})
  assert.equal(diagnosticRun(secret,()=>5),5)
  return value
 },{enabled:true,emit:p=>{packet=p}})
 assert.equal(result,value);assert(packet);assert.equal(packet.accountedMs,packet.totalMs)
 assert(packet.rows.some(s=>s.category==='PG_ACQUIRE'));assert.equal(JSON.stringify(packet).includes(secret),false)
 assert.equal(JSON.stringify(packet).includes('11111111-1111-4111-8111-111111111111'),false)
})
test('consecutive requests correlate only with server issued IDs; nested protected read stays in root',async()=>{
 const packets:DiagnosticPacket[]=[]
 const first=await withDiagnosticRequest('search',undefined,async()=>Response.json({ok:true}),{enabled:true,emit:p=>packets.push(p)})
 const next=new Request('https://example.test/',{headers:{'X-SRM-Diagnostic-Execution':first.headers.get('X-SRM-Diagnostic-Execution')!,'X-SRM-Diagnostic-Parent':first.headers.get('X-SRM-Diagnostic-Fragment')!}})
 await withDiagnosticRequest('krs_lookup',next,()=>withDiagnosticRequest('report_data',undefined,async()=>Response.json({ok:true}),{enabled:true}),{enabled:true,emit:p=>packets.push(p)})
 assert.equal(packets.length,2);assert.equal(packets[0].executionId,packets[1].executionId);assert.equal(packets[1].parentFragmentId,packets[0].fragmentId)
 assert.equal(packets[0].traceId,packets[1].traceId);assert.notEqual(packets[0].fragmentId,packets[1].fragmentId)
 assert(packets[1].rows.some(x=>x.category==='REPORT_READ'))
})
test('errors and diagnostic exporter failure preserve exact original exception',async()=>{
 const error=Error('private-error')
 await assert.rejects(withDiagnosticRequest('search',undefined,async()=>{throw error},{enabled:true,emit:()=>{throw Error('collector')}}),x=>x===error)
 const result=await withDiagnosticRequest('search',undefined,async()=>7,{enabled:true,emit:()=>{throw Error('collector')}});assert.equal(result,7)
})
test('disabled control emits nothing and preserves business action',async()=>{
 let calls=0;assert.equal(await withDiagnosticRequest('search',undefined,async()=>{calls++;return 3},{enabled:false,emit:()=>{throw Error('must not emit')}}),3);assert.equal(calls,1)
})
test('shared native diagnostic channel retains parent scope through actual promise lifecycle',async()=>{
 let packet:DiagnosticPacket|undefined
 const channel=tracingChannel('profitia.platform.diagnostic-phase.v1')
 await withDiagnosticRequest('search',undefined,async()=>{
  await channel.tracePromise(async()=>{await diagnosticRun('PG_ACQUIRE',()=>pause(1),{kind:'WAIT'})},{category:'SOURCE_PLAN'})
  await channel.tracePromise(async()=>{await diagnosticRun('PG_ACQUIRE',()=>pause(1),{kind:'WAIT'})},{category:'SOURCE_SETTLE'})
 },{enabled:true,emit:p=>{packet=p}})
 assert(packet);assert.equal(packet.complete,true);assert.equal(packet.accountedMs,packet.totalMs)
 const plan=packet.rows.find(s=>s.category==='SOURCE_PLAN')!,settle=packet.rows.find(s=>s.category==='SOURCE_SETTLE')!
 assert(plan.endMs!<=settle.startMs)
 assert(packet.rows.some(s=>s.category==='PG_ACQUIRE'&&s.parentSpanId===plan.spanId))
 for(const s of packet.rows){const parent=packet.rows.find(p=>p.spanId===s.parentSpanId);if(parent){assert(s.startMs>=parent.startMs);assert(s.endMs!<=parent.endMs!)}}
})
test('implicit Node tracing result/error values are never copied into exported spans',async()=>{
 let packet:DiagnosticPacket|undefined
 const secret='SYNTHETIC_PRIVATE_NATIVE_RESULT',channel=tracingChannel('profitia.platform.diagnostic-phase.v1')
 await withDiagnosticRequest('search',undefined,async()=>{
  const value=Object.freeze({private:secret})
  assert.equal(await channel.tracePromise(async()=>value,{category:'SOURCE_PLAN'}),value)
  await assert.rejects(channel.tracePromise(async()=>{throw Error(secret)},{category:'SOURCE_SETTLE'}),new RegExp(secret))
 },{enabled:true,emit:p=>{packet=p}})
 assert(packet);assert(packet.rows.some(s=>s.category==='SOURCE_SETTLE'&&s.status==='ERROR'));assert.equal(packet.complete,true)
 assert(!JSON.stringify(packet).includes(secret));assert(!JSON.stringify(packet).includes('stack'))
})
test('timeout does not fabricate completion of the losing asynchronous branch',async()=>{
 let packet:DiagnosticPacket|undefined
 await withDiagnosticRequest('search',undefined,async()=>Promise.race([diagnosticRun('POLL_WAIT',()=>pause(10),{kind:'WAIT'}),Promise.resolve()]),{enabled:true,emit:p=>{packet=p}})
 assert(packet);assert.equal(packet.complete,false);assert(packet.rows.some(s=>s.status==='INCOMPLETE'));assert.equal(packet.accountedMs,packet.totalMs)
})
test('concurrent searches remain isolated and explicit ALL join is accounted once',async()=>{
 const packets:DiagnosticPacket[]=[]
 await Promise.all(Array.from({length:3},()=>withDiagnosticRequest('search',undefined,()=>diagnosticRun('PARALLEL',async()=>{
  await Promise.all([diagnosticRun('POLL_WAIT',()=>pause(2),{kind:'WAIT'}),diagnosticRun('PG_ACQUIRE',()=>pause(3),{kind:'WAIT'})])
 },{join:'ALL'}),{enabled:true,emit:p=>packets.push(p)})))
 assert.equal(new Set(packets.map(p=>p.traceId)).size,3)
 for(const p of packets){assert.equal(p.complete,true);assert.equal(p.accountedMs,p.totalMs);assert.equal(p.rows.filter(r=>r.category==='POLL_WAIT').length,1);assert.equal(p.unresolvedJoins,0)}
})
test('bounds flag incomplete evidence rather than inventing complete coverage',async()=>{
 let packet:DiagnosticPacket|undefined
 await withDiagnosticRequest('search',undefined,async()=>{
  for(let i=0;i<4100;i++)diagnosticRun('MAPPING',()=>true)
  for(let i=0;i<1026;i++)diagnosticResource('CONNECTION')('RELEASED')
 },{enabled:true,emit:p=>{packet=p}})
 assert(packet);assert.equal(packet.rows.length,4096);assert.equal(packet.resources.length,1024)
 assert.equal(packet.droppedSpans,6);assert.equal(packet.droppedResources,2);assert.equal(packet.complete,false);assert.equal(packet.accountedMs,packet.totalMs)
})
test('observer analysis/export are separately accounted outside the handler interval',async()=>{
 let complete:DiagnosticCompletion|undefined
 await withDiagnosticRequest('search',undefined,async()=>1,{enabled:true,emit:()=>{},onComplete:c=>{complete=c}})
 assert(complete);assert(Math.abs(complete.observedWrapperMs-complete.handlerMs-complete.analysisMs-complete.exportMs-complete.observerOtherMs)<=.003)
 assert.equal(complete.networkResponseSendMs,null);assert.equal(complete.measurementBoundary,'BEFORE_COMPLETION_FOOTER_LOG')
})
test('invalid trees fail validation and out-of-parent intervals remain explicit',()=>{
 const root:DiagnosticSpan={spanId:'root',parentSpanId:null,category:'REQUEST',startMs:0,endMs:10,status:'OK',kind:'STAGE',join:'SERIAL'}
 assert.throws(()=>analyzeDiagnosticSpans([root,{...root}],'root'),/Duplicate/)
 assert.throws(()=>analyzeDiagnosticSpans([root,{...root,spanId:'child',parentSpanId:'missing'}],'root'),/Missing/)
 const result=analyzeDiagnosticSpans([root,{...root,spanId:'child',parentSpanId:'root',startMs:5,endMs:12}],'root')
 assert.equal(result.timingViolations,1);assert.equal(result.accountedMs,10);assert.equal(result.criticalPathStatus,'PARTIAL_UNRESOLVED_DEPENDENCIES')
})
test('exported lines are byte bounded and every physical transaction has random observation links',async()=>{
 const lines:string[]=[],original=console.info;console.info=value=>{lines.push(String(value))}
 try{await withDiagnosticRequest('search',undefined,async()=>{for(let i=0;i<120;i++)diagnosticRun('NATIVE_WORK',()=>true,{unitId:'SRM_STORE_FINANCIAL'})},{enabled:true,emit:p=>exportDiagnosticPacket(p)})}
 finally{console.info=original}
 assert(lines.length>1);for(const line of lines)assert(Buffer.byteLength(line)<=8192)
 const summary=lines.map(line=>JSON.parse(line)).find(x=>x.event==='srm_diagnostic_trace')
 const spans=lines.map(line=>JSON.parse(line)).filter(x=>x.event==='srm_diagnostic_spans')
 assert.equal(spans.length,summary.spanChunks);assert.equal(spans.flatMap(x=>x.rows).length,122)
})

test('READY diagnostics require the exact main Development opt-in and identify each new stage and Work',async()=>{
 const keys=['TARGET_ENVIRONMENT','RENDER_SERVICE_ID','PROFITIA_READY_REPORT_ENABLED','SRM_DIAGNOSTIC_TELEMETRY'];const old=new Map(keys.map(k=>[k,process.env[k]]));
 try{
  process.env.TARGET_ENVIRONMENT='development';process.env.RENDER_SERVICE_ID='srv-db1vu6gm7kps73d0e3r0';process.env.PROFITIA_READY_REPORT_ENABLED='false';delete process.env.SRM_DIAGNOSTIC_TELEMETRY;
  assert.equal(diagnosticEnabled(),false);process.env.PROFITIA_READY_REPORT_ENABLED='true';assert.equal(diagnosticEnabled(),true);
  process.env.TARGET_ENVIRONMENT='staging';assert.equal(diagnosticEnabled(),false);process.env.TARGET_ENVIRONMENT='development';
  process.env.RENDER_SERVICE_ID='foreign-service';assert.equal(diagnosticEnabled(),false);process.env.RENDER_SERVICE_ID='srv-db1vu6gm7kps73d0e3r0';
  process.env.SRM_DIAGNOSTIC_TELEMETRY='off';assert.equal(diagnosticEnabled(),false);delete process.env.SRM_DIAGNOSTIC_TELEMETRY;
  let packet:DiagnosticPacket|undefined;
  await withDiagnosticRequest('search',undefined,async()=>{
   for(const name of ['READY_REPORT_READ','READY_REPORT_METADATA','REPORT_PREPARATION'])await diagnosticRun(name,()=>Promise.resolve());
   await diagnosticRun('NATIVE_WORK',()=>Promise.resolve(),{unitId:'SRM_STORE_COMPANY'});
   return Response.json({ok:true})
  },{emit:p=>{packet=p}});
  assert(packet);for(const name of ['READY_REPORT_READ','READY_REPORT_METADATA','REPORT_PREPARATION'])assert(packet.rows.some(r=>r.category===name));
  assert(packet.rows.some(r=>r.unitId==='SRM_STORE_COMPANY'));
 }finally{for(const[k,v]of old)if(v===undefined)delete process.env[k];else process.env[k]=v}
})


test('HTTP observation retains only a bounded numeric status and cannot leak provider data or change results',async()=>{
 let packet:DiagnosticPacket|undefined
 const secret='PRIVATE_PROVIDER_HEADER_BODY_URL',requests=[{},{},{}]
 const result=await withDiagnosticRequest('search',undefined,async()=>{
  for(const [i,statusCode]of [302,204,secret].entries()){
   const request=requests[i]
   channel('undici:request:create').publish({request,url:secret})
   channel('undici:request:headers').publish({request,response:{statusCode,headers:{authorization:secret,location:secret},body:secret}})
   channel('undici:request:trailers').publish({request})
  }
  return 'unchanged'
 },{enabled:true,emit:p=>{packet=p}})
 assert.equal(result,'unchanged');assert(packet)
 assert.deepEqual(packet.resources.filter(r=>r.kind==='HTTP').map(r=>r.httpStatus),[302,204,undefined])
 assert.doesNotMatch(JSON.stringify(packet),new RegExp(secret+'|authorization|location'))
})
