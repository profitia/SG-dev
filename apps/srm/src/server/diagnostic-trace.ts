import {AsyncLocalStorage} from 'node:async_hooks'
import {randomBytes,randomUUID} from 'node:crypto'
import {channel as diagnosticsChannel,tracingChannel} from 'node:diagnostics_channel'
import {monitorEventLoopDelay,PerformanceObserver,performance} from 'node:perf_hooks'

export const DIAGNOSTIC_SCHEMA='srm.diagnostic-trace/1.0'
export const DIAGNOSTIC_CHANNEL='profitia.platform.diagnostic-phase.v1'
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const names=new Set(`REQUEST FORM_REPORT_ADMISSION SEARCH KRS_LOOKUP FINANCIAL_ACQUIRE FINANCIAL_PUBLICATION REPORT_READ REPORT_PROJECTION RESPONSE_PREPARATION RESPONSE_SERIALIZATION DOMAIN_ACTION ORGANIZATION_CONTEXT LOOKUP_REGISTRATION CACHE_READ PROVIDER_RETRIEVAL SOURCE_ARCHIVE SNAPSHOT_PERSISTENCE PROJECTION_PERSISTENCE FINANCIAL_PERSISTENCE ATTEMPT_PERSISTENCE CATALOG_PERSISTENCE REPORT_ASSEMBLY RETENTION_CLEANUP LEASE_ACQUISITION TENANT_PERSISTENCE CACHE_PERSISTENCE CLERK_AUTHENTICATE CLERK_SESSION_READ CLERK_ACCOUNT_READ CLERK_INFLIGHT_JOIN E1_SQL E1_TIMEOUT_SETUP E1_DESCRIPTOR E1_JOB_SCOPE E1_WORK_SCOPE E1_SOURCE_SCOPE E1_AUDIT NETWORK_HTTP POOL_WAIT FINANCIAL_FACTS_INSERT CEIDG_LOOKUP GUS_RESOLUTION KRS_CURRENT KRS_CONTINUITY KRS_EVIDENCE_CHECK KRS_AUTHORITY_CHECK CORPORATE_ADMISSION CORPORATE_WRITE CORPORATE_INDICATORS CORPORATE_PUBLICATION DOMAIN_SQL VERCLY_POST VERCLY_GET POLL_WAIT MAPPING E1_CONTEXT E1_SCOPE E1_POLICY E1_INTENT E1_OUTCOME E1_PROJECT SOURCE_PREPARE SOURCE_PLAN SOURCE_ATTEMPT SOURCE_BEFORE_SEND SOURCE_HTTP SOURCE_BODY SOURCE_DECODE SOURCE_PARSE SOURCE_DIGEST SOURCE_SETTLE SOURCE_PUBLISH SOURCE_CONFIRM KRS_CATALOG_MAIN KRS_CATALOG_P KRS_CATALOG_S KRS_CATALOG_ACCEPTED KRS_CATALOG_NIP KRS_ACCEPTED KRS_SELECTED KRS_RESOLVE_IDENTITY KRS_VALIDATE_IDENTITY KRS_HISTORY KRS_DIGEST GUS_PERMIT GUS_LOGIN GUS_SEARCH GUS_REPORT GUS_LOGOUT SQL_BEGIN SQL_COMMIT SQL_ROLLBACK SQL_TRANSACTION SQL_SECURITY_CONTEXT SQL_SECURITY_POLICY SQL_SECURITY_DESCRIPTOR SQL_SECURITY_SCOPE SQL_AUDIT SQL_SOURCE_CONTROL SQL_KRS_MAIN SQL_KRS_P SQL_KRS_S SQL_KRS_ACCEPTED SQL_KRS_READ SQL_KRS_WRITE SQL_DOMAIN_READ SQL_DOMAIN_WRITE SQL_UNCLASSIFIED PG_ACQUIRE PG_CONNECT PG_TRANSACTION ARCHIVE_REPROJECT FINANCIAL_NORMALIZE FINANCIAL_INVENTORY DOCUMENT_PREPARE DOCUMENT_READ MSR_READ MSR_PROCESS MSR_PARSE RECORD_INTEREST JSON_CAPTURE PAYLOAD_DIGEST PARALLEL SERIAL`.split(' '))
for(const name of ['WITH_ORGANIZATION','INDICATORS','SOURCE_CALL','SOURCE_BODY_READ','SQL_KRS_CTE','SQL_DOMAIN_CTE','KRS_RECONCILE'])names.add(name)
for(const name of ['NATIVE_WORK','READY_REPORT_READ','READY_REPORT_METADATA','REPORT_PREPARATION'])names.add(name)
for(const name of ['MGBI_GENERAL_SOURCE','MGBI_FINANCIAL_SOURCE','MSR_API_SOURCE','MSR_STORAGE_SOURCE','CEIDG_SOURCE','VERCLY_SOURCE'])names.add(name)
const units=new Set('FORM_REPORT_ADMISSION SRM_REGISTER_LOOKUP SRM_CACHE_READ SRM_GENERAL_METADATA_READ SRM_FINANCIAL_REPROJECT_READ SRM_STORE_GENERAL SRM_STORE_FINANCIAL SRM_ARCHIVE_GENERAL SRM_ARCHIVE_FINANCIAL SRM_FINANCIAL_INVENTORY SRM_PREPARE_DOCUMENTS SRM_READ_DOCUMENTS SRM_MSR_CANDIDATES SRM_MSR_READ SRM_MSR_CLAIM SRM_MSR_RECEIVE SRM_MSR_SAVE SRM_MSR_PROJECT SRM_MSR_BLOCK SRM_RECORD_INTEREST SRM_SENSITIVE_REGISTER SRM_SENSITIVE_STATUS SRM_SENSITIVE_REPLAY SRM_SENSITIVE_PURGE SRM_JDG_START SRM_JDG_STORE SRM_JDG_FINISH SRM_KYS_STORE SRM_KYS_CACHE_READ SRM_KYS_CACHE_CLAIM SRM_KYS_CACHE_SAVE SRM_KYS_CACHE_HOLD SRM_KYS_CACHE_RENEW SRM_KYS_CACHE_RELEASE SRM_WEB_SUBJECT_READ SRM_WEB_CLAIM SRM_WEB_SAVE'.split(' '))
units.add('SRM_STORE_COMPANY')
const routeNames=new Set(['diagnostic_self_check','form_admission','search','krs_lookup','report_data','company','jdg','company-kys','jdg-kys','krs','krs_status','krs_search','krs_verify','web','reveal','pdf'])
export type DiagnosticPoolKind='HUMAN'|'JOBS'|'SOURCE'|'CORPORATE_SOURCE'|'REGISTRY_READER'|'REGISTRY_SOURCE'|'PUBLIC_CATALOG'|'DOMAIN'|'INDEPENDENT_AUDIT'|'PRIVATE'
export type DiagnosticSpan={spanId:string;parentSpanId:string|null;category:string;startMs:number;endMs:number|null;status:'OK'|'ERROR'|'OPEN'|'INCOMPLETE';kind:'STAGE'|'SQL'|'WAIT';join:'SERIAL'|'ALL'|'RACE'|'UNSPECIFIED';sqlCommands?:number|null;poolKind?:DiagnosticPoolKind;synchronous?:boolean;unitId?:string;connectionId?:string;transactionId?:string}
type SpanOptions=Partial<Pick<DiagnosticSpan,'kind'|'join'|'poolKind'|'unitId'|'connectionId'|'transactionId'>>
type Context={trace:Trace;spanId:string}
type Resource={id:string;parentSpanId:string|null;kind:'CONNECTION'|'TRANSACTION'|'HTTP';startMs:number;endMs:number|null;status:'OPEN'|'CLOSED'|'ABANDONED';outcome:string;httpStatus?:number;poolKind?:DiagnosticPoolKind;connectionId?:string}
type Trace={traceId:string;executionId:string;clockId:string;fragmentId:string;route:string;parentFragmentId:string|null;formAdmissionFragmentId:string|null;startMs:number;endMs:number;spans:DiagnosticSpan[];resources:Resource[];droppedSpans:number;droppedResources:number;cpu:NodeJS.CpuUsage;loopUtilization:ReturnType<typeof performance.eventLoopUtilization>;closed:boolean}
type Correlation={executionId:string;expires:number;route:string;kind:'EXECUTION'|'FRAGMENT'}
type State={storage:AsyncLocalStorage<Context>;clockId:string;hooked:boolean;installationFailed?:boolean;channelSpans:WeakMap<object,Context>;gc:Array<{startMs:number;durationMs:number}>;loop:ReturnType<typeof monitorEventLoopDelay>|null;correlations:Map<string,Correlation>}
const registry=globalThis as typeof globalThis&{[key:symbol]:State|undefined}
const key=Symbol.for('profitia.srm.diagnostic-state.v1')
const state:State=registry[key]??={storage:new AsyncLocalStorage<Context>(),clockId:randomUUID(),hooked:false,channelSpans:new WeakMap(),gc:[],loop:null,correlations:new Map()}
// Process-local correlation only: no account,organisation,access or report data.
// Accept only IDs actually issued here,so arbitrary UUID headers cannot be
// laundered into logs as correlation identifiers. Restart/eviction loses linkage.
const issued=state.correlations
const round=(v:number)=>Math.round(v*1000)/1000
const id=()=>randomBytes(8).toString('hex')
const poolKinds=new Set(['HUMAN','JOBS','SOURCE','CORPORATE_SOURCE','REGISTRY_READER','REGISTRY_SOURCE','PUBLIC_CATALOG','DOMAIN','INDEPENDENT_AUDIT','PRIVATE'])
const outcomes=new Set(['COMMITTED','ROLLED_BACK','FAILED_OR_UNKNOWN','RELEASED','DESTROYED','HTTP_COMPLETE','HTTP_FAILED'])
export function diagnosticEnabled(){return process.env.TARGET_ENVIRONMENT==='development'&&(process.env.RENDER_SERVICE_ID==='srv-dbeh6srrjlhs73fmikrg'||process.env.RENDER_SERVICE_ID==='srv-db1vu6gm7kps73d0e3r0'&&process.env.PROFITIA_READY_REPORT_ENABLED==='true')&&[undefined,'on','full'].includes(process.env.SRM_DIAGNOSTIC_TELEMETRY)}
export function diagnosticContext(){return state.storage.getStore()}
export function withDiagnosticContext<T>(context:Context|undefined,action:()=>T){return context?state.storage.run(context,action):action()}
type ResourceFinish=((outcome:'COMMITTED'|'ROLLED_BACK'|'FAILED_OR_UNKNOWN'|'RELEASED'|'DESTROYED'|'HTTP_COMPLETE'|'HTTP_FAILED')=>void)&{resourceId?:string;observeHttpStatus?:(status:unknown)=>void}
export function diagnosticResource(kind:Resource['kind'],poolKind?:DiagnosticPoolKind,connectionId?:string):ResourceFinish{
 const context=state.storage.getStore()
 if(!context||context.trace.closed)return ()=>{}
 if(context.trace.resources.length>=1024){context.trace.droppedResources++;return ()=>{}}
 const resource:Resource={id:id(),parentSpanId:context.spanId,kind:['CONNECTION','TRANSACTION','HTTP'].includes(kind)?kind:'CONNECTION',startMs:performance.now(),endMs:null,status:'OPEN',outcome:'UNKNOWN',...(poolKind&&poolKinds.has(poolKind)?{poolKind}:{}),...(connectionId&&/^[a-f0-9]{16}$/.test(connectionId)?{connectionId}:{})}
 context.trace.resources.push(resource)
 return Object.assign((outcome:Parameters<ResourceFinish>[0])=>{if(resource.endMs===null){resource.endMs=performance.now();resource.status=outcome==='DESTROYED'?'ABANDONED':'CLOSED';resource.outcome=outcomes.has(outcome)?outcome:'FAILED_OR_UNKNOWN'}},{resourceId:resource.id,observeHttpStatus:(status:unknown)=>{if(kind==='HTTP'&&!context.trace.closed&&Number.isInteger(status)&&Number(status)>=100&&Number(status)<=599)resource.httpStatus=Number(status)}})
}
function make(category:string,options:SpanOptions={}){
 const parent=state.storage.getStore()
 if(!parent||parent.trace.closed||!names.has(category))return null
 if(parent.trace.spans.length>=4096){parent.trace.droppedSpans++;return null}
 const span:DiagnosticSpan={spanId:id(),parentSpanId:parent.spanId,category,startMs:performance.now(),endMs:null,status:'OPEN',kind:options.kind&&['STAGE','SQL','WAIT'].includes(options.kind)?options.kind:'STAGE',join:options.join&&['SERIAL','ALL','RACE','UNSPECIFIED'].includes(options.join)?options.join:'UNSPECIFIED',...(options.poolKind&&poolKinds.has(options.poolKind)?{poolKind:options.poolKind}:{})}
 if(options.unitId&&units.has(options.unitId))span.unitId=options.unitId
 for(const key of ['connectionId','transactionId']as const)if(options[key]&&/^[a-f0-9]{16}$/.test(options[key]!))span[key]=options[key]
 parent.trace.spans.push(span)
 return {context:{trace:parent.trace,spanId:span.spanId},span}
}
function end(span:DiagnosticSpan,status:'OK'|'ERROR',commands?:number|null){if(span.endMs!==null)return;span.endMs=performance.now();span.status=status;if(commands!==undefined)span.sqlCommands=commands}
function safeMake(category:string,options:SpanOptions={}){try{return make(category,options)}catch{return null}}
export function diagnosticRun<T>(category:string,action:()=>T,options:SpanOptions={}):T{
 const entry=safeMake(category,options);if(!entry)return action()
 return state.storage.run(entry.context,()=>{
  try{
   const result=action()
   if(result instanceof Promise){void result.then(()=>end(entry.span,'OK'),()=>end(entry.span,'ERROR'))}
   else{entry.span.synchronous=true;end(entry.span,'OK')}
   return result
  }catch(error){entry.span.synchronous=true;end(entry.span,'ERROR');throw error}
 })
}
/** Callback/query drivers need a completion handle; no result/error is retained. */
export function diagnosticStart(category:string,options:SpanOptions={}){
 const entry=safeMake(category,options)
 return {run:<T>(action:()=>T)=>entry?state.storage.run(entry.context,action):action(),
  finish:(status:'OK'|'ERROR',commands?:number|null)=>{if(entry)end(entry.span,status,commands)},spanId:entry?.span.spanId??null}
}
function installChannels(){
 if(state.hooked)return;state.hooked=true
 const channel=tracingChannel(DIAGNOSTIC_CHANNEL)
 channel.start.bindStore(state.storage,message=>{
  try{const data=message as {category?:unknown;synchronous?:boolean};const entry=typeof data.category==='string'?make(data.category):null
   if(entry){entry.span.join='SERIAL';if(data.synchronous===true)entry.span.synchronous=true;if(['SOURCE_HTTP','SOURCE_BODY_READ'].includes(entry.span.category))entry.span.kind='WAIT';state.channelSpans.set(message as object,entry.context);return entry.context}
  }catch{}return state.storage.getStore()
 })
 channel.asyncStart.bindStore(state.storage,message=>state.channelSpans.get(message as object)??state.storage.getStore())
 const finish=(message:unknown)=>{try{const d=message as {synchronous?:boolean;error?:unknown};const c=state.channelSpans.get(message as object)
  if(!c)return;const span=c.trace.spans.find(x=>x.spanId===c.spanId);if(span)end(span,d.error?'ERROR':'OK')
 }catch{}}
 channel.subscribe({start:()=>{},asyncStart:()=>{},end:message=>{if((message as {synchronous?:boolean}).synchronous)finish(message)},asyncEnd:finish,error:message=>{try{const c=state.channelSpans.get(message as object);const span=c?.trace.spans.find(x=>x.spanId===c.spanId);if(span)end(span,'ERROR')}catch{}}})
 // These are process observations,not CPU/GC attributed to an individual span.
 state.loop=monitorEventLoopDelay({resolution:20});state.loop.enable()
 const observer=new PerformanceObserver(list=>{try{for(const entry of list.getEntries())state.gc.push({startMs:entry.startTime,durationMs:entry.duration});state.gc=state.gc.filter(x=>x.startMs>performance.now()-120000).slice(-1024)}catch{}})
 observer.observe({entryTypes:['gc']})
 const network=new WeakMap<object,ReturnType<typeof diagnosticResource>>()
 diagnosticsChannel('undici:request:create').subscribe(message=>{try{const r=(message as {request?:object}).request;if(r&&state.storage.getStore())network.set(r,diagnosticResource('HTTP'))}catch{}})
 // Numeric status only: never retain headers, URL, body or provider error text.
 diagnosticsChannel('undici:request:headers').subscribe(message=>{try{const m=message as {request?:object;response?:{statusCode?:unknown}};if(m.request)network.get(m.request)?.observeHttpStatus?.(m.response?.statusCode)}catch{}})
 for(const [event,outcome]of [['undici:request:trailers','HTTP_COMPLETE'],['undici:request:error','HTTP_FAILED']]as const)diagnosticsChannel(event).subscribe(message=>{try{const r=(message as {request?:object}).request;if(r){network.get(r)?.(outcome);network.delete(r)}}catch{}})
}
export function unionLength(intervals:Array<[number,number]>){
 const sorted=intervals.filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0]);let total=0,start=0,endAt=0,open=false
 for(const[a,b]of sorted){if(!open){start=a;endAt=b;open=true}else if(a>endAt){total+=endAt-start;start=a;endAt=b}else endAt=Math.max(endAt,b)}
 return total+(open?endAt-start:0)
}
/** A ledger partitions elapsed wall time. Unknown concurrent dependencies are
 * explicit; elapsed overlap is never guessed to be an additional CPU cost. */
export function analyzeDiagnosticSpans(spans:DiagnosticSpan[],rootId:string){
 const root=spans.find(x=>x.spanId===rootId);if(!root||root.endMs===null)throw Error('Incomplete diagnostic root')
 const indexes=new Map(spans.map(s=>[s.spanId,s]))
 if(indexes.size!==spans.length)throw Error('Duplicate diagnostic span')
 let timingViolations=0
 for(const s of spans){
  if(!Number.isFinite(s.startMs)||s.endMs!==null&&(!Number.isFinite(s.endMs)||s.endMs<s.startMs))throw Error('Invalid diagnostic clock')
  const seen=new Set<string>();let ancestor:DiagnosticSpan|undefined=s
  while(ancestor?.parentSpanId){if(seen.has(ancestor.spanId))throw Error('Cyclic diagnostic tree');seen.add(ancestor.spanId);ancestor=indexes.get(ancestor.parentSpanId);if(!ancestor)throw Error('Missing diagnostic parent')}
  const parent=s.parentSpanId?indexes.get(s.parentSpanId):undefined
  if(parent&&(s.startMs<parent.startMs||s.endMs!==null&&parent.endMs!==null&&s.endMs>parent.endMs))timingViolations++
 }
 const byParent=new Map<string,DiagnosticSpan[]>()
 for(const s of spans)if(s.parentSpanId){const siblings=byParent.get(s.parentSpanId)??[];siblings.push(s);byParent.set(s.parentSpanId,siblings)}
 const descendants=(s:DiagnosticSpan):DiagnosticSpan[]=>[s,...(byParent.get(s.spanId)??[]).flatMap(descendants)]
 const rows=spans.map(s=>{const endAt=s.endMs??root.endMs!;const children=byParent.get(s.spanId)??[],nested=descendants(s),queries=nested.filter(x=>x.kind==='SQL'),waits=nested.filter(x=>x.kind==='WAIT')
  return {...s,inclusiveMs:round(Math.max(0,endAt-s.startMs)),exclusiveMs:round(Math.max(0,endAt-s.startMs-unionLength(children.map(c=>[Math.max(s.startMs,c.startMs),Math.min(endAt,c.endMs??endAt)])))),sqlQueryCalls:queries.length,dbApplicationMs:round(unionLength(queries.map(c=>[Math.max(s.startMs,c.startMs),Math.min(endAt,c.endMs??endAt)]))),observedWaitMs:round(unionLength(waits.map(c=>[Math.max(s.startMs,c.startMs),Math.min(endAt,c.endMs??endAt)]))),waitClass:s.category==='PG_CONNECT'?'CLIENT_CONNECT_TO_CALLBACK':s.category==='PG_ACQUIRE'?'POOL_ACQUIRE_INCLUDES_QUEUE_CONNECT_AND_DRIVER_SCHEDULING':'OBSERVED_ASYNC_RESOURCE_WALL',dbServerMs:null,dbWireMs:null,dbSplitStatus:'UNAVAILABLE_WITHOUT_APPROVED_SERVER_PROFILING'}
 })
 type Segment={startMs:number;endMs:number;spanId:string;category:string;reason:string}
 const segments:Segment[]=[];let unresolvedJoins=0
 function walk(s:DiagnosticSpan,from:number,to:number){
  const children=(byParent.get(s.spanId)??[]).filter(c=>c.endMs!==null&&c.startMs<to&&c.endMs!>from).sort((a,b)=>a.startMs-b.startMs)
  let cursor=from
  const own=(a:number,b:number,reason:string)=>{if(b>a)segments.push({startMs:a,endMs:b,spanId:s.spanId,category:s.kind==='SQL'||s.kind==='WAIT'||s.synchronous===true?s.category:'UNKNOWN',reason})}
  for(let i=0;i<children.length;){
   const group=[children[i++]];let groupEnd=group[0].endMs!
   while(i<children.length&&children[i].startMs<groupEnd){const c=children[i++];group.push(c);groupEnd=Math.max(groupEnd,c.endMs!)}
   const start=Math.max(from,group[0].startMs),finish=Math.min(to,groupEnd);own(cursor,start,'UNINSTRUMENTED_SELF_TIME')
   if(group.length===1)walk(group[0],start,finish)
   else if(s.join==='ALL'){
    const gating=group.reduce((a,b)=>a.endMs!>=b.endMs!?a:b);own(start,Math.min(finish,gating.startMs),'PARALLEL_BRANCH_START_DEPENDENCY_UNKNOWN');walk(gating,Math.max(start,gating.startMs),finish)
   }else{
    unresolvedJoins++;segments.push({startMs:start,endMs:finish,spanId:s.spanId,category:'UNKNOWN',reason:'CONCURRENT_DEPENDENCY_NOT_OBSERVED'})
   }
   cursor=Math.max(cursor,finish)
  }
  own(cursor,to,'UNINSTRUMENTED_SELF_TIME')
 }
 walk(root,root.startMs,root.endMs)
 const totals:Record<string,number>={}
 for(const s of segments)totals[s.category]=(totals[s.category]??0)+(s.endMs-s.startMs)
 const dependencies:Array<{fromSpanId:string;fromPoint:'START'|'END';toSpanId:string;toPoint:'START'|'END';kind:string}>=[]
 for(const parent of spans){const children=(byParent.get(parent.spanId)??[]).filter(s=>s.endMs!==null).sort((a,b)=>a.startMs-b.startMs)
  for(const child of children)dependencies.push({fromSpanId:parent.spanId,fromPoint:'START',toSpanId:child.spanId,toPoint:'START',kind:'CHILD_STARTED'})
  if(parent.join==='ALL')for(const child of children)dependencies.push({fromSpanId:child.spanId,fromPoint:'END',toSpanId:parent.spanId,toPoint:'END',kind:'DECLARED_ALL_JOIN'})
  if(parent.join==='SERIAL'){
   for(let i=1;i<children.length;i++)if(children[i-1].endMs!<=children[i].startMs)dependencies.push({fromSpanId:children[i-1].spanId,fromPoint:'END',toSpanId:children[i].spanId,toPoint:'START',kind:'DECLARED_SERIAL'})
   const last=children.at(-1);if(last)dependencies.push({fromSpanId:last.spanId,fromPoint:'END',toSpanId:parent.spanId,toPoint:'END',kind:'DECLARED_RETURN_AWAIT'})
  }
 }
 return {totalMs:round(root.endMs-root.startMs),rows,dependencies,segments:segments.map(s=>({...s,durationMs:round(s.endMs-s.startMs)})),criticalPathLedger:Object.fromEntries(Object.entries(totals).map(([k,v])=>[k,round(v)])),accountedMs:round(segments.reduce((n,s)=>n+s.endMs-s.startMs,0)),unknownMs:round(totals.UNKNOWN??0),unresolvedJoins,timingViolations,criticalPathStatus:unresolvedJoins||timingViolations?'PARTIAL_UNRESOLVED_DEPENDENCIES':'OBSERVED_SERIAL_OR_EXPLICIT_ALL_JOIN',sqlQueryCalls:spans.filter(x=>x.kind==='SQL').length,commandsKnown:spans.filter(x=>x.kind==='SQL').reduce((n,x)=>n+(x.sqlCommands??0),0),commandCountIncomplete:spans.some(x=>x.kind==='SQL'&&x.sqlCommands==null),serverInternalStatementCount:null,sqlMeasurementBoundary:'PHYSICAL_CLIENT_QUERY_CALL_TO_COMPLETION_INCLUDES_DRIVER_QUEUE_AND_WIRE',nestedRowsAreNotAdditive:true}
}
export type DiagnosticPacket=ReturnType<typeof finishTrace>
function finishTrace(trace:Trace,root:DiagnosticSpan){
 trace.endMs=performance.now();trace.closed=true;root.endMs=trace.endMs;root.status='OK'
 for(const span of trace.spans)if(span.endMs===null){span.endMs=trace.endMs;span.status='INCOMPLETE'}
 const cpu=process.cpuUsage(trace.cpu),loopUtilization=performance.eventLoopUtilization(trace.loopUtilization),summary=analyzeDiagnosticSpans(trace.spans,root.spanId)
 return {schema:DIAGNOSTIC_SCHEMA,event:'srm_diagnostic_trace',traceId:trace.traceId,executionId:trace.executionId,fragmentId:trace.fragmentId,parentFragmentId:trace.parentFragmentId,formAdmissionFragmentId:trace.formAdmissionFragmentId,clockId:trace.clockId,route:trace.route,synthetic:trace.route==='diagnostic_self_check',rootSpanId:root.spanId,...summary,
  complete:!trace.droppedSpans&&!trace.droppedResources&&!trace.spans.some(s=>s.status==='INCOMPLETE')&&!trace.resources.some(r=>r.status==='OPEN')&&!summary.unresolvedJoins&&!summary.timingViolations,droppedSpans:trace.droppedSpans,droppedResources:trace.droppedResources,
  resources:trace.resources.map(r=>({...r,startMs:round(r.startMs),endMs:r.endMs===null?null:round(r.endMs),durationMs:r.endMs===null?null:round(r.endMs-r.startMs)})),
  processObservation:{scope:'PROCESS_WIDE_OVERLAPPING_NOT_PER_REQUEST_CPU',cpuUserMs:cpu.user/1000,cpuSystemMs:cpu.system/1000,eventLoopWindow:'PROCESS_GLOBAL_SINCE_ENABLE',eventLoopMeanMs:state.loop&&Number.isFinite(state.loop.mean)?state.loop.mean/1e6:null,eventLoopMaxMs:state.loop?state.loop.max/1e6:null,eventLoopActiveMs:loopUtilization.active,eventLoopIdleMs:loopUtilization.idle,eventLoopUtilization:loopUtilization.utilization,gcObservedMs:state.gc.filter(g=>g.startMs>=trace.startMs&&g.startMs<=trace.endMs).reduce((n,g)=>n+g.durationMs,0),gcDeliveryMayBeDelayed:true},
  accountingBoundary:'HANDLER_RESPONSE_READY_BEFORE_DIAGNOSTIC_EXPORT',serverExecutionTimeAvailable:false}
}
export type DiagnosticCompletion={event:'srm_diagnostic_complete';schema:string;traceId:string;fragmentId:string;handlerMs:number;analysisMs:number;exportMs:number;observerOtherMs:number;observedWrapperMs:number;measurementBoundary:'BEFORE_COMPLETION_FOOTER_LOG';networkResponseSendMs:null}
export async function withDiagnosticRequest<T>(route:string,request:Request|undefined,action:()=>Promise<T>,options:{enabled?:boolean;emit?:(packet:DiagnosticPacket)=>void;onComplete?:(completion:DiagnosticCompletion)=>void}={}):Promise<T>{
 if(!(options.enabled??diagnosticEnabled())||!routeNames.has(route))return action()
 if(state.installationFailed)return action()
 try{installChannels()}catch{state.installationFailed=true;return action()}
 const logical=request?.headers.get('X-SRM-Diagnostic-Execution'),previous=request?.headers.get('X-SRM-Diagnostic-Parent'),admission=request?.headers.get('X-SRM-Diagnostic-Admission')
 const at=performance.now();for(const[k,v]of issued)if(v.expires<at)issued.delete(k)
 const known=logical&&uuid.test(logical)?issued.get(logical):undefined,executionId=known?.kind==='EXECUTION'?known.executionId:randomUUID()
 const parent=previous&&uuid.test(previous)?issued.get(previous):undefined,parentFragmentId=parent?.kind==='FRAGMENT'&&parent.executionId===executionId?previous!:null
 const form=admission&&uuid.test(admission)?issued.get(admission):undefined,formAdmissionFragmentId=form?.kind==='FRAGMENT'&&form.route==='form_admission'?admission!:null
 const phase=route==='form_admission'?'FORM_REPORT_ADMISSION':route==='search'?'SEARCH':route==='krs_lookup'?'KRS_LOOKUP':route==='report_data'?'REPORT_READ':'SERIAL'
 const existing=state.storage.getStore()
 if(existing)return existing.trace.route===route?action():diagnosticRun(phase,action,{join:'SERIAL'})
 const trace:Trace={traceId:executionId,executionId,fragmentId:randomUUID(),parentFragmentId,formAdmissionFragmentId,clockId:state.clockId,route,startMs:performance.now(),endMs:0,spans:[],resources:[],droppedSpans:0,droppedResources:0,cpu:process.cpuUsage(),loopUtilization:performance.eventLoopUtilization(),closed:false}
 while(issued.size>=2046)issued.delete(issued.keys().next().value!)
 issued.set(trace.executionId,{executionId,expires:at+300000,route,kind:'EXECUTION'});issued.set(trace.fragmentId,{executionId,expires:at+300000,route,kind:'FRAGMENT'})
 const root:DiagnosticSpan={spanId:id(),parentSpanId:null,category:'REQUEST',startMs:trace.startMs,endMs:null,status:'OPEN',kind:'STAGE',join:'SERIAL'};trace.spans.push(root)
 let failed=false
 return state.storage.run({trace,spanId:root.spanId},async()=>{
  try{
   const result=await diagnosticRun(phase,action,{join:'SERIAL'})
   if(result instanceof Response){if(result.status>=400)failed=true;try{result.headers.set('X-SRM-Diagnostic-Execution',trace.executionId);result.headers.set('X-SRM-Diagnostic-Fragment',trace.fragmentId)}catch{}}
   return result
  }catch(error){failed=true;throw error}
  finally{try{const packet=finishTrace(trace,root),analyzed=performance.now();if(failed){root.status='ERROR';packet.rows[0].status='ERROR'}
   const exportStart=performance.now();if(options.emit)options.emit(packet);else exportDiagnosticPacket(packet)
   const exportEnd=performance.now(),observedEnd=performance.now()
   const completion:DiagnosticCompletion={event:'srm_diagnostic_complete',schema:packet.schema,traceId:trace.traceId,fragmentId:trace.fragmentId,handlerMs:packet.totalMs,analysisMs:round(analyzed-trace.endMs),exportMs:round(exportEnd-exportStart),observerOtherMs:round(exportStart-analyzed+observedEnd-exportEnd),observedWrapperMs:round(observedEnd-trace.startMs),measurementBoundary:'BEFORE_COMPLETION_FOOTER_LOG',networkResponseSendMs:null}
   if(options.onComplete)options.onComplete(completion);else if(!options.emit)console.info(JSON.stringify(completion))
  }catch{/* Diagnostic failure must not alter a business result or error. */}}
 })
}
export function exportDiagnosticPacket(packet:DiagnosticPacket){
 const {rows,segments,dependencies,resources,...summary}=packet,start=performance.now()
 // Bound bytes as well as item counts; long metadata rows must not silently
 // disappear through a provider log-line limit. Chunks are numbered per group.
 const chunks=(event:string,field:string,items:unknown[],maximum:number)=>{
  let chunk=0,batch:unknown[]=[],size=0
  const flush=()=>{if(batch.length){console.info(JSON.stringify({event,schema:packet.schema,traceId:packet.traceId,fragmentId:packet.fragmentId,chunk:chunk++,[field]:batch}));batch=[];size=0}}
  for(const item of items){const bytes=Buffer.byteLength(JSON.stringify(item))+1;if(batch.length&&(size+bytes>7000||batch.length>=maximum))flush();batch.push(item);size+=bytes}
  flush();return chunk
 }
 const spanChunks=chunks('srm_diagnostic_spans','rows',rows,12),segmentChunks=chunks('srm_diagnostic_segments','segments',segments,24)
 const dependencyChunks=chunks('srm_diagnostic_dependencies','dependencies',dependencies,24),resourceChunks=chunks('srm_diagnostic_resources','resources',resources,24)
 console.info(JSON.stringify({...summary,spanChunks,segmentChunks,dependencyChunks,resourceChunks,exportSubmissionMs:round(performance.now()-start),exportSubmissionIncludesFinalLog:false,maximumChunkBytes:8192}))
}
export function diagnosticResponseJson(...args:Parameters<typeof Response.json>):Response{return diagnosticRun('RESPONSE_SERIALIZATION',()=>Response.json(...args))}
let healthProof:Promise<Record<string,unknown>>|undefined
/** One bounded in-memory self-check per health module/process. No SQL,Clerk,
 * provider,report,organisation or private store operation is performed. */
export function diagnosticHealth(sharedObserver?:()=>Promise<{sourceDigest:string}>):Promise<Record<string,unknown>>{
 if(!diagnosticEnabled())return Promise.resolve({schema:DIAGNOSTIC_SCHEMA,enabled:false,installed:false})
 return healthProof??=(async()=>{
  let proof:DiagnosticPacket|undefined
  try{
   let observerSourceDigest:string|null=null
   await withDiagnosticRequest('diagnostic_self_check',undefined,()=>diagnosticRun('SERIAL',async()=>{
    const shared=await sharedObserver?.();if(shared&&/^[a-f0-9]{64}$/.test(shared.sourceDigest))observerSourceDigest=shared.sourceDigest
    await diagnosticRun('POLL_WAIT',()=>Promise.resolve(),{kind:'WAIT'})
    return diagnosticResponseJson({synthetic:true})
   },{join:'SERIAL'}),{emit:packet=>{proof=packet;exportDiagnosticPacket(packet)},onComplete:completion=>console.info(JSON.stringify(completion))})
   return {schema:DIAGNOSTIC_SCHEMA,enabled:true,installed:!!proof&&!state.installationFailed,observerSourceDigest,syntheticCheck:observerSourceDigest&&proof?.complete===true&&proof.accountedMs===proof.totalMs&&proof.rows.some(r=>r.category==='SOURCE_PREPARE')&&proof.rows.some(r=>r.category==='SOURCE_DIGEST')?'PASS':'FAIL',sqlQueriesInCheck:proof?.sqlQueryCalls??null,providerCallsInCheck:proof?.resources.filter(r=>r.kind==='HTTP').length??null}
  }catch{return {schema:DIAGNOSTIC_SCHEMA,enabled:true,installed:false,syntheticCheck:'FAIL'}}
 })()
}
