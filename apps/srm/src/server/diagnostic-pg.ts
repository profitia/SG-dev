import {diagnosticContext,diagnosticStart,diagnosticResource,withDiagnosticContext,type DiagnosticPoolKind} from './diagnostic-trace'
import {randomBytes} from 'node:crypto'

type Fn=(...args:unknown[])=>unknown
type Raw=Record<string,unknown>&{query:Fn;connect:Fn;on:Fn;release:Fn}
type PgState={pools:WeakSet<object>;clients:WeakSet<object>;connectPrototypes:WeakSet<object>;transactions:WeakMap<object,ReturnType<typeof diagnosticResource>>;connectionIds:WeakMap<object,string>}
const registry=globalThis as typeof globalThis&{[key:symbol]:PgState|undefined}
const state:PgState=registry[Symbol.for('profitia.srm.diagnostic-pg.v1')]??={pools:new WeakSet(),clients:new WeakSet(),connectPrototypes:new WeakSet(),transactions:new WeakMap(),connectionIds:new WeakMap()}
const {pools,clients,transactions}=state
/** Only finite classifications leave this function. SQL and args are examined
 * transiently and never captured,hashed,stored or passed to the exporter. */
export function diagnosticSqlCategory(input:unknown,values?:unknown):string{
 const sql=typeof input==='string'?input:input&&typeof input==='object'&&typeof (input as {text?:unknown}).text==='string'?(input as {text:string}).text:''
 const text=sql.replace(/^\s*(?:--[^\n]*\n|\/\*[\s\S]*?\*\/)\s*/g,'').trim()
 if(/^BEGIN\b/i.test(text))return 'SQL_BEGIN'
 if(/^(COMMIT|END)\b/i.test(text))return 'SQL_COMMIT'
 if(/^ROLLBACK\s+TO\b/i.test(text))return 'SQL_TRANSACTION'
 if(/^ROLLBACK\b/i.test(text))return 'SQL_ROLLBACK'
 if(/^(SAVEPOINT|RELEASE|SET\s+TRANSACTION)\b/i.test(text))return 'SQL_TRANSACTION'
 if(/profitia_external_call\.apply_control/.test(text))return 'SQL_SOURCE_CONTROL'
 if(/\.append_audit\(/.test(text))return 'SQL_AUDIT'
 if(/\.scope_allows\(/.test(text))return 'SQL_SECURITY_SCOPE'
 if(/runtime_descriptor\(|\.descriptor\(/.test(text))return 'SQL_SECURITY_DESCRIPTOR'
 if(/pg_roles|pg_has_role|current_setting|set_config|srm\.organizations|profitia_supplier_requests\.commands/.test(text))return 'SQL_SECURITY_CONTEXT'
 if(/profitia_(access|jobs|ingestion|request|external)/.test(text))return 'SQL_SECURITY_POLICY'
 if(/krs_registry\./.test(text)){
  if(/^WITH\b/i.test(text))return 'SQL_KRS_CTE'
  if(!/^SELECT\b/i.test(text))return 'SQL_KRS_WRITE'
  if(/company_sources/.test(text)&&Array.isArray(values)&&values[1]==='P')return 'SQL_KRS_P'
  if(/company_sources/.test(text)&&Array.isArray(values)&&values[1]==='S')return 'SQL_KRS_S'
  if(/companies.*latest_ref/.test(text))return 'SQL_KRS_MAIN'
  if(/WHERE evidence_ref=/.test(text))return 'SQL_KRS_ACCEPTED'
  return 'SQL_KRS_READ'
 }
 if(/^\s*WITH\b/i.test(text))return 'SQL_DOMAIN_CTE'
 if(/^\s*SELECT\b/i.test(text))return 'SQL_DOMAIN_READ'
 if(/^\s*(INSERT|UPDATE|DELETE)\b/i.test(text))return 'SQL_DOMAIN_WRITE'
 return 'SQL_UNCLASSIFIED'
}
function commands(result:unknown):number|null{
 if(Array.isArray(result))return result.length<=1024?result.reduce((n,x)=>n+(commands(x)??0),0):null
 if(result&&typeof result==='object'&&'command'in result)return typeof(result as {command:unknown}).command==='string'?1:0
 return null
}
/** Observe the public Client.connect boundary separately from Pool.connect.
 * The latter also includes the pool queue/driver scheduling; neither proves a
 * PostgreSQL execution time. No socket,connection option or peer is exported. */
function instrumentConnectPrototype(pool:object){
 const prototype=(pool as {Client?:{prototype?:Raw}}).Client?.prototype
 if(!prototype||state.connectPrototypes.has(prototype)||typeof prototype.connect!=='function')return
 const connect=prototype.connect;state.connectPrototypes.add(prototype)
 prototype.connect=function(...original:unknown[]){
  const parent=diagnosticContext();if(!parent)return Reflect.apply(connect,this,original)
  const poolKind=parent.trace.spans.find(s=>s.spanId===parent.spanId)?.poolKind
  const span=diagnosticStart('PG_CONNECT',{kind:'WAIT',poolKind}),args=[...original],index=args.length-1
  const callback=typeof args[index]==='function'?args[index] as Fn:null
  if(callback)args[index]=function(...values:unknown[]){span.finish(values[0]?'ERROR':'OK');return withDiagnosticContext(parent,()=>Reflect.apply(callback,this,values))}
  try{
   const result=span.run(()=>Reflect.apply(connect,this,args))
   if(!callback&&result instanceof Promise)void result.then(()=>span.finish('OK'),()=>span.finish('ERROR'))
   return result
  }catch(error){span.finish('ERROR');throw error}
 }
}
function instrumentClient(client:object,poolKind:DiagnosticPoolKind){
 if(clients.has(client))return;clients.add(client)
 state.connectionIds.set(client,randomBytes(8).toString('hex'))
 const raw=client as Raw,query=raw.query
 if(typeof query!=='function')return
 raw.query=function(...original:unknown[]){
  const parent=diagnosticContext();if(!parent)return Reflect.apply(query,this,original)
  const category=diagnosticSqlCategory(original[0],original[1]),connectionId=state.connectionIds.get(client)
  if(category==='SQL_BEGIN'&&!transactions.has(client))transactions.set(client,diagnosticResource('TRANSACTION',poolKind,connectionId))
  const span=diagnosticStart(category,{kind:'SQL',poolKind,connectionId,transactionId:transactions.get(client)?.resourceId})
  let finished=false
  const finish=(error:boolean,result?:unknown)=>{if(finished)return;finished=true
   try{span.finish(error?'ERROR':'OK',error?null:commands(result))
    if(category==='SQL_COMMIT'||category==='SQL_ROLLBACK'){
     const command=result&&typeof result==='object'?'command'in result?(result as {command:unknown}).command:undefined:undefined
     const outcome=error?'FAILED_OR_UNKNOWN':command==='ROLLBACK'?'ROLLED_BACK':category==='SQL_COMMIT'&&command==='COMMIT'?'COMMITTED':'FAILED_OR_UNKNOWN'
     transactions.get(client)?.(outcome);transactions.delete(client)
    }else if(category==='SQL_BEGIN'&&error){transactions.get(client)?.('FAILED_OR_UNKNOWN');transactions.delete(client)}
   }catch{}
  }
  const args=[...original],index=args.length-1,callback=typeof args[index]==='function'?args[index] as Fn:null
  if(callback)args[index]=function(...values:unknown[]){finish(!!values[0],values[1]);return withDiagnosticContext(parent,()=>Reflect.apply(callback,this,values))}
  try{
   const result=span.run(()=>Reflect.apply(query,this,args))
   if(!callback&&result instanceof Promise)void result.then(v=>finish(false,v),()=>finish(true))
   else if(!callback&&result&&typeof(result as {emit?:unknown}).emit==='function'){
    // Observe emit,not an added error listener: an originally unhandled error
    // must stay unhandled,and existing callback/listener order stays intact.
    const emitter=result as {emit:Fn},emit=emitter.emit
    emitter.emit=function(...values:unknown[]){if(values[0]==='end')finish(false,values[1]);else if(values[0]==='error')finish(true);return Reflect.apply(emit,this,values)}
   }
   return result
  }catch(error){finish(true);throw error}
 }
}
/** Each physical Client is instrumented once,including clients used directly by
 * Source callbacks. Pool.query is NOT timed as another SQL query. */
export function instrumentDiagnosticPool<T extends object>(pool:T,poolKind:DiagnosticPoolKind='PRIVATE'):T{
 if(pools.has(pool))return pool;pools.add(pool)
 try{instrumentConnectPrototype(pool)}catch{}
 const raw=pool as unknown as Raw,connect=raw.connect
 if(typeof raw.on==='function')raw.on.call(pool,'connect',(client:object)=>{try{instrumentClient(client,poolKind)}catch{}})
 if(typeof connect!=='function')return pool
 raw.connect=function(...original:unknown[]){
  const parent=diagnosticContext();if(!parent)return Reflect.apply(connect,this,original)
  const span=diagnosticStart('PG_ACQUIRE',{kind:'WAIT',poolKind}),args=[...original]
  const acquired=(client:object,provided?:Fn)=>{
   try{
    instrumentClient(client,poolKind);const c=client as Raw,release=provided??c.release,close=diagnosticResource('CONNECTION',poolKind,state.connectionIds.get(client))
    const wrapped=function(...values:unknown[]){
     try{close(values[0]?'DESTROYED':'RELEASED');if(transactions.has(client)){transactions.get(client)?.('FAILED_OR_UNKNOWN');transactions.delete(client)}}catch{}
     return Reflect.apply(release,client,values)
    };c.release=wrapped;return wrapped
   }catch{return provided??(client as Raw).release}
  }
  const index=args.length-1,callback=typeof args[index]==='function'?args[index] as Fn:null
  if(callback)args[index]=function(...values:unknown[]){
   span.finish(values[0]?'ERROR':'OK')
   if(!values[0]&&values[1]&&typeof values[1]==='object'){
    const wrapped=withDiagnosticContext(parent,()=>acquired(values[1] as object,typeof values[2]==='function'?values[2] as Fn:undefined))
    // Preserve the callback arity/arguments supplied by pg,including errors
    // delivered with a single argument. The original release remains owner.
    if(values.length>=3)values[2]=wrapped
   }
   return withDiagnosticContext(parent,()=>Reflect.apply(callback,this,values))
  }
  try{
   const result=span.run(()=>Reflect.apply(connect,this,args))
   if(!callback&&result instanceof Promise)void result.then(client=>{span.finish('OK');withDiagnosticContext(parent,()=>acquired(client))},()=>span.finish('ERROR'))
   return result
  }catch(error){span.finish('ERROR');throw error}
 }
 return pool
}
