import {randomUUID,createHash} from 'node:crypto';
export const digest=v=>createHash('sha256').update(typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v)).digest('hex');
export class Fault extends Error{constructor(status,code){super(code);this.status=status;this.code=code;}}
export async function transaction(pool,action,principal=null,existing=null){
 const db=existing??await pool.connect();
 try{
  if(!existing)await db.query("BEGIN; SET LOCAL statement_timeout='10000ms'; SET LOCAL lock_timeout='2000ms'; SET LOCAL idle_in_transaction_session_timeout='15000ms'");
  if(principal)await db.query(`SELECT set_config('pk.user_id',$1,true),set_config('pk.organisation_ids',$2,true),set_config('pk.allowed_scopes',$6,true),
   set_config('pk.shared_read',$3,true),set_config('pk.operator',$4,true),set_config('pk.purpose',$5,true)`,[
    principal.internalUserId??'',JSON.stringify(principal.organisationIds??[]),String(principal.sharedKnowledgeAllowed===true),
    String(principal.operator===true),principal.usePurpose??'CUSTOMER_SERVICE',JSON.stringify(principal.allowedScopes??[])]);
  const result=await action(db);if(!existing)await db.query('COMMIT');return result;
 }catch(error){if(!existing)await db.query('ROLLBACK').catch(()=>{});throw error;}finally{if(!existing)db.release();}
}
export async function audit(db,{sourceId=null,jobId=null,operation,actorRef,outcome,technical={}}){
 // Fixed operation codes and numeric/boolean diagnostics only: no document text.
 if(!/^[A-Z_]{3,64}$/.test(operation)||!['ACCEPTED','COMPLETED','DENIED','FAILED'].includes(outcome))throw TypeError('INVALID_AUDIT');
 await db.query('INSERT INTO platform_knowledge.audit(source_id,job_id,operation,actor_ref,outcome,technical) VALUES($1,$2,$3,$4,$5,$6)',[
  sourceId,jobId,operation,actorRef,outcome,JSON.stringify(technical)]);
}
export function sourceFromRow(s){return {id:s.id,environment:s.environment,scope:s.scope,ownerUserId:s.owner_user_id,
 ownerOrganisationId:s.owner_organisation_id,rights:s.rights,status:s.status,published:!!s.published_at,revokedAt:s.revoked_at,
 deletedAt:s.deleted_at,expiresAt:s.expires_at?.toISOString?.()??s.expires_at};}
export const ids=()=>({sourceId:randomUUID(),generationId:randomUUID(),jobId:randomUUID()});
