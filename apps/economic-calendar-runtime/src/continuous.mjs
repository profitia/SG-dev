import {randomUUID} from 'node:crypto'
import {CalendarError,fingerprint} from '@profitia/economic-calendar-contracts'

export function scheduledCommand(template,at){
  const command=structuredClone(template.command??template),day=new Date(at).toISOString().slice(0,10)
  const shift=n=>new Date(Date.parse(day)+n*86400000).toISOString().slice(0,10)
  if(template.window&&command.family==='publication-calendar'&&command.provider==='eia')Object.assign(command.criteria,{from:shift(-35),to:shift(330)})
  if(template.window&&command.family==='series-observations')Object.assign(command.criteria,{start:shift(-21),end:day})
  return command
}
const safeCode=e=>/^[A-Z][A-Z0-9_]{0,79}$/.test(e?.code??'')?e.code:'SYNC_UNAVAILABLE'
const uncertain=new Set(['EXTERNAL_RESULT_UNVERIFIED','ACQUISITION_IN_PROGRESS'])
const permanent=new Set(['LICENCE_ADMISSION_REQUIRED','DURABLE_STORAGE_NOT_ADMITTED','RESULT_STORAGE_SCOPE_NOT_ADMITTED','ACCESS_BASIS_INVALID','ECR_RESULT_STORAGE_NOT_ADMITTED','UNCONFIRMED_RESULT_SEMANTICS','ACQUISITION_INTENT_CONFLICT','RESULT_INTENT_CONFLICT'])

/** One bounded tick. All due times, identities, attempts and lease fences are
 * durable. The web runtime never imports this module or owns these credentials.
 */
export function createContinuousRuntime({database,synchronizer,renewAccess=async()=>({status:'NOT_CONFIGURED'}),report=(_e)=>{}}){
  async function claim(excluded){return database.transact(async t=>{
    const {rows:[job]}=await t.query("SELECT *,clock_timestamp() AS claimed_at FROM economic_calendar.sync_jobs WHERE status='ACTIVE' AND job_id<>ALL($1::text[]) AND next_due_at<=clock_timestamp() AND (lease_until IS NULL OR lease_until<=clock_timestamp()) ORDER BY next_due_at,job_id FOR UPDATE SKIP LOCKED LIMIT 1",[excluded])
    if(!job)return null
    const token=randomUUID(),intent=job.intent_id??randomUUID(),command=job.active_command??scheduledCommand(job.command_template,job.claimed_at),attempt=randomUUID()
    await t.query("UPDATE economic_calendar.sync_attempts SET outcome='INTERRUPTED',finished_at=clock_timestamp(),error_code='PROCESS_LEASE_EXPIRED' WHERE job_id=$1 AND outcome='RUNNING'",[job.job_id])
    await t.query("UPDATE economic_calendar.sync_jobs SET intent_id=$2::uuid,active_command=$3::jsonb,attempts=attempts+1,lease_token=$4::uuid,lease_until=clock_timestamp()+interval '180 seconds' WHERE job_id=$1",[job.job_id,intent,JSON.stringify(command),token])
    return {...job,token,intent,command,attempt,attempts:job.attempts+1}
  })}
  async function fence(t,job){
    const {rows:[r]}=await t.query('SELECT lease_token,lease_until>clock_timestamp() AS valid FROM economic_calendar.sync_jobs WHERE job_id=$1 FOR UPDATE',[job.job_id])
    if(!r?.valid||r.lease_token!==job.token)throw new CalendarError('SYNC_LEASE_LOST',409)
  }
  async function tick({triggerKind='SCHEDULED',maxJobs=8}={}){
    if(!['SCHEDULED','MANUAL_VALIDATION'].includes(triggerKind)||!Number.isSafeInteger(maxJobs)||maxJobs<1||maxJobs>50)throw new CalendarError('INVALID_SYNC_TICK')
    const access=await renewAccess();report({event:'ecr_service_continuity',status:access.status})
    const completed=[],claimed=[]
    for(let i=0;i<maxJobs;i++){
      const job=await claim(claimed);if(!job)break;claimed.push(job.job_id)
      const started=performance.now()
      try{
        await database.transact(async t=>{await fence(t,job);await t.query("INSERT INTO economic_calendar.sync_attempts(attempt_id,job_id,intent_id,trigger_kind,outcome) VALUES($1::uuid,$2,$3::uuid,$4,'RUNNING')",[job.attempt,job.job_id,job.intent,triggerKind])})
        const result=await synchronizer.synchronize({command:job.command,organisation:job.organisation_id,grantId:job.grant_id,
          idempotencyKey:'ecr-continuous:'+job.intent,assertLease:t=>fence(t,job)})
        await database.transact(async t=>{
          await fence(t,job)
          let seconds=job.interval_seconds
          if(job.command.family==='series-observations'){
            const {rows:[next]}=await t.query("SELECT min((current_data->>'eventAt')::timestamptz+interval '30 minutes') FILTER(WHERE (current_data->>'eventAt')::timestamptz+interval '30 minutes'>clock_timestamp()) AS due,max(current_data->'reference'->>'providerValue') FILTER(WHERE (current_data->>'eventAt')::timestamptz+interval '30 minutes'<=clock_timestamp()) AS expected_period FROM economic_calendar.events WHERE provider='eia' AND current_data->'source'->>'publicationRef'='eia:wpsr'")
            if(next.due)seconds=Math.min(seconds,Math.max(900,Math.ceil((new Date(next.due).getTime()-Date.now())/1000)))
            if(next.expected_period&&(!result.latestReferencePeriod||result.latestReferencePeriod<next.expected_period))seconds=Math.min(seconds,86400)
          }
          await t.query("UPDATE economic_calendar.sync_jobs SET next_due_at=clock_timestamp()+$2*interval '1 second',last_success_at=clock_timestamp(),last_error_code=NULL,last_receipt_ref=$3::uuid,last_result=$4::jsonb||CASE WHEN last_result?'accessMonitoring' THEN jsonb_build_object('accessMonitoring',last_result->'accessMonitoring') ELSE '{}'::jsonb END,lease_token=NULL,lease_until=NULL,intent_id=NULL,active_command=NULL,attempts=0 WHERE job_id=$1",[job.job_id,seconds,result.receiptRef,JSON.stringify(result)])
          await t.query("UPDATE economic_calendar.sync_attempts SET outcome='SUCCEEDED',finished_at=clock_timestamp(),receipt_ref=$2::uuid,result=$3::jsonb WHERE attempt_id=$1::uuid",[job.attempt,result.receiptRef,JSON.stringify(result)])
        })
        completed.push({jobId:job.job_id,status:'SUCCEEDED',receiptRef:result.receiptRef,replay:result.replay})
      }catch(error){
        const code=safeCode(error)
        if(code==='SYNC_LEASE_LOST'){completed.push({jobId:job.job_id,status:'LEASE_LOST'});continue}
        const blocked=uncertain.has(code)||permanent.has(code)||error?.status===403||job.attempts>=3
        const newIntent=['RESULT_NOT_RETAINED','PREVIOUS_ATTEMPT_FAILED'].includes(code)
        // A definitively completed/lost response may be re-observed with a new
        // auditable intent. Unknown delivery never triggers a fresh attempt.
        const delay=Math.max(60,Math.min(3600,Number(error?.retryAfterSeconds)||60*2**Math.min(job.attempts,5)))
        await database.transact(async t=>{
          await fence(t,job)
          await t.query("UPDATE economic_calendar.sync_jobs SET status=CASE WHEN $2 THEN 'PAUSED' ELSE status END,next_due_at=clock_timestamp()+$3*interval '1 second',last_error_code=$4,lease_token=NULL,lease_until=NULL,intent_id=CASE WHEN $5 THEN NULL ELSE intent_id END WHERE job_id=$1",[job.job_id,blocked,delay,code,newIntent])
          await t.query("UPDATE economic_calendar.sync_attempts SET outcome=$2,error_code=$3,finished_at=clock_timestamp() WHERE attempt_id=$1::uuid",[job.attempt,blocked?'BLOCKED':'RETRY',code])
        })
        completed.push({jobId:job.job_id,status:blocked?'BLOCKED':'RETRY',errorCode:code})
      }finally{try{report({event:'ecr_continuous_sync',jobId:job.job_id,provider:job.provider_id,triggerKind,sourcePath:'SOURCE_HUB_ONLY',durationMs:Math.round((performance.now()-started)*100)/100,outcome:completed.at(-1)?.status??'INTERRUPTED'})}catch{}}
    }
    return {triggerKind,jobs:completed,failed:completed.some(j=>j.status!=='SUCCEEDED')}
  }
  return Object.freeze({tick})
}
