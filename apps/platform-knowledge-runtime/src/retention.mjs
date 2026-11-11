import {randomUUID} from 'node:crypto';
import {transaction,audit,Fault} from './store.mjs';
export async function revokeSource(db,{sourceId,deleted=false,actorRef}){
 // Cancel and fence first, while API RLS still permits the source. Child cleanup
 // needs no session of the deleted user. Shared material is not owned by its
 // uploading operator's personal account.
 const source=(await db.query('SELECT * FROM platform_knowledge.sources WHERE id=$1 FOR UPDATE',[sourceId])).rows[0];
 if(!source)throw new Fault(404,'SOURCE_NOT_FOUND');
 await db.query(`UPDATE platform_knowledge.jobs SET status='REVOKED',fence=fence+1,lease_until=NULL,
  error_code='SOURCE_REVOKED',finished_at=clock_timestamp() WHERE source_id=$1 AND status IN ('QUEUED','RUNNING','RETRY_WAIT')`,[sourceId]);
 await audit(db,{sourceId,operation:deleted?'SOURCE_DELETED':'SOURCE_WITHDRAWN',actorRef,outcome:'ACCEPTED'});
 await db.query(`UPDATE platform_knowledge.sources SET revoked_at=coalesce(revoked_at,clock_timestamp()),
  deleted_at=CASE WHEN $2 THEN coalesce(deleted_at,clock_timestamp()) ELSE deleted_at END,published_at=NULL,
  status='WITHDRAWN',authority='WITHDRAWN',revision=revision+1 WHERE id=$1`,[sourceId,deleted]);
 return{sourceId,status:'RETRIEVAL_REVOKED',purge:deleted?'PENDING':'NOT_REQUESTED'};
}
export async function acceptAccountDeletion(pool,command){
 if(command?.scope!=='ACCOUNT_PRIVATE_ALL'||command.reason!=='ACCOUNT_DELETED'||command.environment!=='development'
  ||!command.commandId||!command.internalUserId||!Number.isFinite(Date.parse(command.effectiveAt)))throw new Fault(422,'INVALID_LIFECYCLE_COMMAND');
 // Caller must be the authenticated Identity lifecycle authority; this pure
 // persistence boundary deliberately cannot infer one from browser input.
 return transaction(pool,async db=>{
  const prior=(await db.query('SELECT * FROM platform_knowledge.lifecycle_receipts WHERE event_id=$1',[command.commandId])).rows[0];
  if(prior){if(prior.user_id!==command.internalUserId)throw new Fault(409,'LIFECYCLE_EVENT_CONFLICT');return{commandId:command.commandId,state:prior.status};}
  await db.query(`INSERT INTO platform_knowledge.account_state(user_id,deleted_at,lifecycle_event_id,memory_enabled)
   VALUES($1,$2,$3,false) ON CONFLICT(user_id) DO UPDATE SET deleted_at=EXCLUDED.deleted_at,lifecycle_event_id=EXCLUDED.lifecycle_event_id,memory_enabled=false`,[
    command.internalUserId,command.effectiveAt,command.commandId]);
  await db.query("INSERT INTO platform_knowledge.lifecycle_receipts(event_id,user_id,status) VALUES($1,$2,'ACCEPTED')",[command.commandId,command.internalUserId]);
  await db.query(`UPDATE platform_knowledge.jobs SET status='REVOKED',fence=fence+1,lease_until=NULL,error_code='ACCOUNT_DELETED'
   WHERE source_id IN(SELECT id FROM platform_knowledge.sources WHERE scope='ACCOUNT_PRIVATE' AND owner_user_id=$1)
   AND status IN ('QUEUED','RUNNING','RETRY_WAIT')`,[command.internalUserId]);
  await db.query("UPDATE platform_knowledge.sources SET deleted_at=coalesce(deleted_at,clock_timestamp()),revoked_at=coalesce(revoked_at,clock_timestamp()),revision=revision+1 WHERE scope='ACCOUNT_PRIVATE' AND owner_user_id=$1",[command.internalUserId]);
  return{commandId:command.commandId,state:'RETRIEVAL_REVOKED'};
 });
}
export async function runRetention({pool,storage}){
 // Raw expiry applies even to queued, failed and abandoned jobs.
 const raw=(await pool.query(`SELECT id,raw_key FROM platform_knowledge.sources WHERE raw_key IS NOT NULL AND raw_deleted_at IS NULL
  AND(raw_expires_at<=clock_timestamp() OR deleted_at IS NOT NULL) ORDER BY raw_expires_at LIMIT 20`)).rows;
 for(const source of raw){await storage.remove(source.raw_key);await pool.query('UPDATE platform_knowledge.sources SET raw_deleted_at=clock_timestamp() WHERE id=$1',[source.id]);}
 await transaction(pool,async db=>{
  await db.query(`UPDATE platform_knowledge.jobs SET status='FAILED',error_code='JOB_DEADLINE_OR_ATTEMPTS',finished_at=clock_timestamp(),fence=fence+1,lease_until=NULL
   WHERE status IN ('QUEUED','RUNNING','RETRY_WAIT') AND deadline_at<=clock_timestamp()`);
  await db.query(`UPDATE platform_knowledge.sources SET deleted_at=clock_timestamp(),revoked_at=coalesce(revoked_at,clock_timestamp()),revision=revision+1
   WHERE expires_at<=clock_timestamp() AND deleted_at IS NULL`);
  await db.query(`UPDATE platform_knowledge.jobs SET status='REVOKED',fence=fence+1,lease_until=NULL WHERE status IN ('QUEUED','RUNNING','RETRY_WAIT')
   AND source_id IN(SELECT id FROM platform_knowledge.sources WHERE deleted_at IS NOT NULL OR revoked_at IS NOT NULL)`);
  await db.query(`UPDATE platform_knowledge.provider_calls c SET result=NULL WHERE result IS NOT NULL AND EXISTS(
   SELECT 1 FROM platform_knowledge.sources s WHERE s.id=ANY(c.input_source_ids) AND(s.deleted_at IS NOT NULL OR s.revoked_at IS NOT NULL OR s.expires_at<=clock_timestamp()))`);
  await db.query("UPDATE platform_knowledge.provider_calls SET state='UNKNOWN' WHERE state='RESERVED' AND created_at<clock_timestamp()-interval '5 minutes'");
  await db.query("UPDATE platform_knowledge.provider_calls SET result=NULL WHERE generation_id IS NULL AND result IS NOT NULL AND created_at<clock_timestamp()-interval '24 hours'");
  // Keep only finite non-content technical audit. Unknown paid outcomes retain
  // their financial reservation; deleting text must not reset the spend budget.
  const sources=(await db.query('SELECT id FROM platform_knowledge.sources WHERE deleted_at IS NOT NULL AND(raw_key IS NULL OR raw_deleted_at IS NOT NULL) FOR UPDATE SKIP LOCKED LIMIT 20')).rows;
  for(const {id} of sources){
   await db.query('UPDATE platform_knowledge.sources SET active_generation_id=NULL,file_name=$2,metadata=$3,raw_key=NULL WHERE id=$1',[id,'[deleted]','{}']);
   await db.query('UPDATE platform_knowledge.provider_calls SET result=NULL WHERE source_id=$1 OR $1=ANY(input_source_ids)',[id]);
   await db.query('DELETE FROM platform_knowledge.cognition WHERE generation_id IN(SELECT id FROM platform_knowledge.generations WHERE source_id=$1)',[id]);
   await db.query('DELETE FROM platform_knowledge.chunks WHERE generation_id IN(SELECT id FROM platform_knowledge.generations WHERE source_id=$1)',[id]);
   await db.query("UPDATE platform_knowledge.generations SET inventory=NULL,coverage=NULL,validation=NULL,state='RETIRED' WHERE source_id=$1",[id]);
  }
  await db.query("UPDATE platform_knowledge.lifecycle_receipts l SET status='COMPLETED',completed_at=clock_timestamp() WHERE status<>'COMPLETED' AND NOT EXISTS(SELECT 1 FROM platform_knowledge.sources s WHERE s.owner_user_id=l.user_id AND s.scope='ACCOUNT_PRIVATE' AND(s.active_generation_id IS NOT NULL OR s.raw_key IS NOT NULL))");
  await db.query("DELETE FROM platform_knowledge.audit WHERE created_at<clock_timestamp()-interval '30 days'");
 });
}
