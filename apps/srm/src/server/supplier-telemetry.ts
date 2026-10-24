import {AsyncLocalStorage} from 'node:async_hooks'
import {randomUUID} from 'node:crypto'

const stages=['CLERK_AUTHENTICATE','CLERK_SESSION_READ','CLERK_ACCOUNT_READ','CLERK_INFLIGHT_JOIN','E1_SQL','POOL_WAIT','DOMAIN_ACTION','FINANCIAL_FACTS_INSERT','FINANCIAL_ACQUIRE','FINANCIAL_PUBLICATION','CEIDG_LOOKUP','GUS_RESOLUTION','KRS_CURRENT','KRS_CONTINUITY','KRS_EVIDENCE_CHECK','KRS_AUTHORITY_CHECK','CORPORATE_ADMISSION','CORPORATE_WRITE','CORPORATE_INDICATORS','CORPORATE_PUBLICATION',
 'DOMAIN_SQL','SEARCH','ORGANIZATION_CONTEXT','LOOKUP_REGISTRATION','CACHE_READ','PROVIDER_RETRIEVAL','SOURCE_ARCHIVE','SNAPSHOT_PERSISTENCE','PROJECTION_PERSISTENCE','FINANCIAL_PERSISTENCE','ATTEMPT_PERSISTENCE','CATALOG_PERSISTENCE','REPORT_ASSEMBLY','RETENTION_CLEANUP','LEASE_ACQUISITION','TENANT_PERSISTENCE','CACHE_PERSISTENCE','RESPONSE_PREPARATION','VERCLY_POST','VERCLY_GET','POLL_WAIT','MAPPING'] as const
type Stage=typeof stages[number]
export type SupplierTelemetryStage=Stage
type Metric={count:number;totalMs:number;maximumMs:number;failed:number}
type Work={unit:string;totalMs:number;status:'SUCCESS'|'ERROR';stages:Partial<Record<Stage,Metric>>}
type Trace={traceId:string;route:string;stages:Partial<Record<Stage,Metric>>;work:Work[]}
const traces=new AsyncLocalStorage<Trace>(),units=new AsyncLocalStorage<Work>()
// Separate from the serializable trace: neither subjects nor SDK observations
// enter logs. Only an outstanding call in this exact HTTP trace can be joined.
const identityReads=new WeakMap<Trace,WeakMap<object,Map<string,Promise<unknown>>>>()
const allowedRoutes=new Set(['form_admission','search','report_data','company','jdg','company-kys','jdg-kys','reveal','pdf','krs','web','krs_status','krs_search','krs_verify','krs_lookup'])
const allowedUnits=new Set(['FORM_REPORT_ADMISSION','SRM_REGISTER_LOOKUP','SRM_CACHE_READ','SRM_GENERAL_METADATA_READ','SRM_FINANCIAL_REPROJECT_READ','SRM_STORE_GENERAL','SRM_STORE_FINANCIAL','SRM_ARCHIVE_GENERAL','SRM_ARCHIVE_FINANCIAL','SRM_PREPARE_DOCUMENTS','SRM_READ_DOCUMENTS','SRM_MSR_CANDIDATES','SRM_MSR_READ','SRM_MSR_CLAIM','SRM_MSR_RECEIVE','SRM_MSR_SAVE','SRM_MSR_PROJECT','SRM_MSR_BLOCK','SRM_RECORD_INTEREST','SRM_SENSITIVE_REGISTER','SRM_SENSITIVE_STATUS','SRM_SENSITIVE_REPLAY','SRM_SENSITIVE_PURGE','SRM_JDG_START','SRM_JDG_STORE','SRM_JDG_FINISH','SRM_KYS_STORE','SRM_KYS_CACHE_READ','SRM_KYS_CACHE_CLAIM','SRM_KYS_CACHE_SAVE','SRM_KYS_CACHE_HOLD','SRM_KYS_CACHE_RENEW','SRM_KYS_CACHE_RELEASE','SRM_WEB_SUBJECT_READ','SRM_WEB_CLAIM','SRM_WEB_SAVE'])
const rounded=(n:number)=>Math.round(n*100)/100
function add(target:Partial<Record<Stage,Metric>>,stage:Stage,ms:number,failed:boolean){
 const value=target[stage]??{count:0,totalMs:0,maximumMs:0,failed:0}
 value.count++;value.totalMs=rounded(value.totalMs+ms);value.maximumMs=rounded(Math.max(value.maximumMs,ms));value.failed+=Number(failed);target[stage]=value
}
/** Durations and finite labels only. No SQL, arguments, reports, account IDs,
 * URL parameters, credentials or authority observations enter the trace. */
export async function measureSupplierStage<T>(stage:Stage,action:()=>Promise<T>):Promise<T>{
 const trace=traces.getStore();if(!trace||!stages.includes(stage))return action()
 const start=performance.now();let failed=true
 try{const value=await action();failed=false;return value}finally{
  const ms=performance.now()-start;add(trace.stages,stage,ms,failed)
  const work=units.getStore();if(work)add(work.stages,stage,ms,failed)
 }
}
export async function measureSupplierWork<T>(unit:string,action:()=>Promise<T>):Promise<T>{
 const trace=traces.getStore();if(!trace||!allowedUnits.has(unit)||trace.work.length>=128)return action()
 const work:Work={unit,totalMs:0,status:'ERROR',stages:{}},start=performance.now();trace.work.push(work)
 return units.run(work,async()=>{try{const value=await action();work.status='SUCCESS';return value}finally{work.totalMs=rounded(performance.now()-start)}})
}
export async function withSupplierTelemetry(route:string,action:()=>Promise<Response>):Promise<Response>{
 if(!allowedRoutes.has(route))return action()
 const trace:Trace={traceId:randomUUID(),route,stages:{},work:[]},start=performance.now()
 return traces.run(trace,async()=>{
  let status=500
  try{const response=await action();status=response.status;return response}finally{
   // Observability cannot turn a committed result into a new business failure.
   try{console.info(JSON.stringify({event:'srm_supplier_timing',environment:process.env.TARGET_ENVIRONMENT==='development'?'development':'other',
    ...trace,httpStatus:status,totalMs:rounded(performance.now()-start),nestedStageDurations:true}))}catch{}
  }
 })
}

/** Pass through to the same official SDK, with identical receiver, arguments,
 * result and errors. Settled authority results are never cached; subsequent
 * checkpoints and different requests always issue a new current-status read. */
export function instrumentSupplierIdentity<T extends {authenticateRequest:(...args:never[])=>unknown;users:{getUser:(...args:never[])=>unknown};sessions:{getSession:(...args:never[])=>unknown}}>(client:T):T{
 const methods=new Map<PropertyKey,unknown>()
 const measured=<O extends object>(object:O,key:PropertyKey,stage:Stage)=>new Proxy(object,{get(target,property,receiver){
  const value=Reflect.get(target,property,receiver)
  if(property!==key||typeof value!=='function')return value
  return (...args:unknown[])=>{
   const action=()=>measureSupplierStage(stage,()=>Reflect.apply(value,target,args))
   const trace=traces.getStore()
   if(!trace||args.length!==1||typeof args[0]!=='string')return action()
   let clients=identityReads.get(trace);if(!clients){clients=new WeakMap();identityReads.set(trace,clients)}
   let pending=clients.get(target);if(!pending){pending=new Map();clients.set(target,pending)}
   const id=stage+':'+args[0],existing=pending.get(id)
   if(existing)return measureSupplierStage('CLERK_INFLIGHT_JOIN',()=>existing)
   const result=action().finally(()=>pending!.delete(id));pending.set(id,result);return result
  }
 }})
 return new Proxy(client,{get(target,key,receiver){
  if(methods.has(key))return methods.get(key)
  const value=Reflect.get(target,key,receiver)
  if(key==='users'){const wrapped=measured(target.users,'getUser','CLERK_ACCOUNT_READ');methods.set(key,wrapped);return wrapped}
  if(key==='sessions'){const wrapped=measured(target.sessions,'getSession','CLERK_SESSION_READ');methods.set(key,wrapped);return wrapped}
  if(key==='authenticateRequest'&&typeof value==='function'){
   const wrapped=(...args:unknown[])=>measureSupplierStage('CLERK_AUTHENTICATE',()=>Reflect.apply(value,target,args));methods.set(key,wrapped);return wrapped
  }
  return value
 }})
}
