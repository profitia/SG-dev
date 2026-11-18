import {transaction,audit,Fault} from './store.mjs';
// Every write is fenced by lease and current source/account state. A restarted
// worker resumes checkpoints; a late worker cannot publish over its successor.
export async function claimJob(pool,workerId){return transaction(pool,async db=>{
 await db.query(`UPDATE platform_knowledge.jobs SET status='FAILED',error_code='JOB_DEADLINE_OR_ATTEMPTS',finished_at=clock_timestamp(),
  fence=fence+1,lease_until=NULL WHERE status IN ('QUEUED','RUNNING','RETRY_WAIT')
  AND(deadline_at<=clock_timestamp() OR(attempt>=3 AND(status<>'RUNNING' OR lease_until<clock_timestamp())))`);
 const r=await db.query(`WITH next AS(SELECT j.id FROM platform_knowledge.jobs j JOIN platform_knowledge.sources s ON s.id=j.source_id
  WHERE j.status IN ('QUEUED','RETRY_WAIT','RUNNING') AND(j.status<>'RUNNING' OR j.lease_until<clock_timestamp())
  AND j.available_at<=clock_timestamp() AND j.deadline_at>clock_timestamp() AND j.attempt<3
  AND(j.kind='PURGE' OR(s.deleted_at IS NULL AND s.revoked_at IS NULL AND(s.expires_at IS NULL OR s.expires_at>clock_timestamp())
   AND NOT EXISTS(SELECT 1 FROM platform_knowledge.account_state a WHERE a.user_id=s.owner_user_id AND a.deleted_at IS NOT NULL)))
  ORDER BY CASE WHEN j.kind='PURGE' THEN 0 ELSE 1 END,j.created_at FOR UPDATE OF j SKIP LOCKED LIMIT 1)
 UPDATE platform_knowledge.jobs j SET status='RUNNING',attempt=j.attempt+1,fence=j.fence+1,lease_owner=$1,
  lease_until=clock_timestamp()+interval '90 seconds',heartbeat_at=clock_timestamp() FROM next WHERE j.id=next.id RETURNING j.*`,[workerId]);
 return r.rows[0]??null;
});}
export async function withJob(pool,job,action){return transaction(pool,async db=>{
 const r=await db.query(`SELECT j.*,s.revoked_at,s.deleted_at,s.expires_at FROM platform_knowledge.jobs j
  JOIN platform_knowledge.sources s ON s.id=j.source_id WHERE j.id=$1 AND j.fence=$2 AND j.lease_owner=$3
  AND j.status='RUNNING' AND j.lease_until>clock_timestamp() AND j.deadline_at>clock_timestamp() FOR UPDATE OF j,s`,[job.id,job.fence,job.lease_owner]);
 const current=r.rows[0];if(!current)throw new Fault(409,'JOB_LEASE_LOST');
 if(current.kind!=='PURGE'&&(current.revoked_at||current.deleted_at||(current.expires_at&&current.expires_at<=new Date())))throw new Fault(410,'SOURCE_REVOKED');
 if(current.kind!=='PURGE'){
  const deleted=await db.query('SELECT 1 FROM platform_knowledge.account_state WHERE user_id=(SELECT owner_user_id FROM platform_knowledge.sources WHERE id=$1) AND deleted_at IS NOT NULL',[job.source_id]);
  if(deleted.rowCount)throw new Fault(410,'ACCOUNT_DELETED');
 }
 return action(db,current);
});}
export const heartbeat=(pool,job)=>withJob(pool,job,async db=>{await db.query("UPDATE platform_knowledge.jobs SET lease_until=LEAST(deadline_at,clock_timestamp()+interval '90 seconds'),heartbeat_at=clock_timestamp() WHERE id=$1",[job.id]);});
export const checkpoint=(pool,job,stage,value)=>withJob(pool,job,async db=>{
 await db.query('UPDATE platform_knowledge.jobs SET stage=$2,checkpoint=checkpoint || $3::jsonb WHERE id=$1',[job.id,stage,JSON.stringify(value)]);
});
export async function failJob(pool,job,error){
 // No raw parser/provider/SQL errors enter persistence or telemetry.
 const code=/^[A-Z_]{3,64}$/.test(error?.reasonCode??error?.code??error?.message??'')?(error.reasonCode??error.code??error.message):'PROCESSING_FAILED';
 return transaction(pool,async db=>{
  const r=await db.query(`UPDATE platform_knowledge.jobs SET status=CASE WHEN $4 OR attempt>=3 OR deadline_at<=clock_timestamp()
    THEN 'FAILED' ELSE 'RETRY_WAIT' END,error_code=$5,available_at=clock_timestamp()+interval '15 seconds',lease_until=NULL,
    finished_at=CASE WHEN $4 OR attempt>=3 OR deadline_at<=clock_timestamp() THEN clock_timestamp() ELSE NULL END
   WHERE id=$1 AND fence=$2 AND lease_owner=$3 AND status='RUNNING' RETURNING source_id`,[
    job.id,job.fence,job.lease_owner,['PAID_RESULT_UNKNOWN','PAID_RESULT_UNUSABLE','ACCESS_BASIS_INVALID','BUDGET_EXCEEDED','SOURCE_REVOKED','ACCOUNT_DELETED','UNSUPPORTED_FORMAT','UNSAFE_DOCUMENT','PARSER_ISOLATION_UNAVAILABLE','RIGHTS_DENIED','COGNITIVE_OUTPUT_INVALID','MODEL_INPUT_LIMIT','SOURCE_ALREADY_EXPIRED'].includes(code),code]);
  if(r.rowCount)await audit(db,{sourceId:job.source_id,jobId:job.id,operation:'PROCESSING',actorRef:'worker',outcome:'FAILED'});
 });
}
