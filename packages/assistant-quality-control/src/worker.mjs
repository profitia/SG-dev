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
