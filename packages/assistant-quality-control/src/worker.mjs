const fail=code=>{throw Object.assign(Error('Quality worker stopped'),{code})}
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v)
const state=v=>typeof v==='string'&&/^[A-Z][A-Z0-9_]{0,79}$/.test(v)

function pause(milliseconds,signal){
 return new Promise(resolve=>{
  if(signal?.aborted){resolve();return}
  let timer
  const finish=()=>{clearTimeout(timer);signal?.removeEventListener('abort',finish);resolve()}
  timer=setTimeout(finish,milliseconds);signal?.addEventListener('abort',finish,{once:true})
  if(signal?.aborted)finish()
 })
}

/** Trusted composition only: this scheduler adds no authority, keys, data or
 * attempts. The native store owns leases; the controller records each intent
 * before dispatch and reconciles it after restart. SIGTERM stops new ticks,
 * without clearing a pending intent or claiming an external executor stopped.
 * Provider execution/cancellation remain the controller's separate durable ports.
 */
export function createQualityWorker({store,controller,pollMs=5000,wait=pause,onEvent=()=>{}}){
 if(typeof store?.listDue!=='function'||typeof controller?.tick!=='function'||typeof wait!=='function'||typeof onEvent!=='function'
  ||!Number.isSafeInteger(pollMs)||pollMs<1000||pollMs>30000)fail('WORKER_CONFIGURATION_REQUIRED')
 let running=false,stepping=false
 const event=value=>{try{onEvent(Object.freeze(value))}catch{/* Monitoring cannot retry or replace a durable action. */}}
 async function step(signal){
  if(stepping)fail('WORKER_ALREADY_RUNNING')
  if(signal?.aborted)return {status:'STOPPED',processed:0}
  stepping=true
  let processed=0
  try{
   const ids=await store.listDue()
   if(!Array.isArray(ids)||ids.length>20||!ids.every(uuid)||new Set(ids).size!==ids.length)fail('WORKER_QUEUE_INVALID')
   for(const id of ids){
    if(signal?.aborted)break
    const result=await controller.tick(id)
    if(!result||!state(result.status))fail('WORKER_RESULT_INVALID')
    // A result is operational state, never model output, transcript or a grant.
    event({event:'QUALITY_TICK_COMPLETED',incidentId:id,status:result.status});processed++
   }
   return {status:signal?.aborted?'STOPPED':'COMPLETE',processed}
  }finally{stepping=false}
 }
 return Object.freeze({
  async step({signal}={}){if(running)fail('WORKER_ALREADY_RUNNING');return step(signal)},
  async run({signal}={}){
   if(running||stepping)fail('WORKER_ALREADY_RUNNING')
   if(!signal||typeof signal.addEventListener!=='function')fail('WORKER_STOP_SIGNAL_REQUIRED')
   running=true
   try{
    while(!signal.aborted){await step(signal);if(!signal.aborted)await wait(pollMs,signal)}
    return {status:'STOPPED'}
   }catch(error){
    // A failed/unknown dispatch remains in the native outbox. Restart must
    // reconcile that nonce; this loop never retries the failed tick in memory.
    const code=state(error?.code)?error.code:'WORKER_TICK_FAILED'
    event({event:'QUALITY_WORKER_STOPPED',code});fail(code)
   }finally{running=false}
  },
 })
}

/** The native store owns the 90-day expiry and preserves unresolved work and
 * the repository lock. This timer has no query, row, age or role override.
 * It starts no incident, provider request, paid clock or QA operation. */
export function createQualityMetadataRetention({store,now=Date.now}={}){
 if(typeof store?.purge!=='function'||typeof now!=='function')fail('CONTROL_RETENTION_CONFIGURATION_REQUIRED')
 const interval=6*60*60*1000
 let lastConfirmed=null,inFlight=null,failed=false
 return Object.freeze({async check({signal}={}){
  if(signal?.aborted)return Object.freeze({status:'STOPPING',purgePerformed:false})
  if(failed)fail('CONTROL_RETENTION_UNAVAILABLE')
  const at=now()
  if(!Number.isFinite(at)||at<0)fail('CONTROL_RETENTION_CLOCK_INVALID')
  if(inFlight)return inFlight
  if(lastConfirmed!==null&&at>=lastConfirmed&&at-lastConfirmed<interval)
   return Object.freeze({status:'NOT_DUE',purgePerformed:false})
  inFlight=(async()=>{
   try{
    const result=await store.purge(),completed=now()
    if(result?.status!=='PURGED'||!Number.isFinite(completed)||completed<0)fail('CONTROL_RETENTION_UNAVAILABLE')
    lastConfirmed=completed
    return Object.freeze({schemaVersion:'AQC_CONTROL_METADATA_RETENTION_V1',status:'PURGE_CONFIRMED',purgePerformed:true,
     scope:'CONTROL_METADATA_ONLY',retentionDays:90,observedAt:new Date(completed).toISOString()})
   }catch{failed=true;fail('CONTROL_RETENTION_UNAVAILABLE')}
   finally{inFlight=null}
  })()
  return inFlight
 }})
}
