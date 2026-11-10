import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {assertContext,requireThat,digest} from '@profitia/insights-contracts';
import {parseSubscription,nextReportOccurrence} from './subscriptions.mjs';
import {PUBLISHED_EDITION_CONTRACT} from '@profitia/insights-contracts/subscriptions';
const dto=row=>({...row.definition,id:row.id,organisationId:row.organisation_id,ownerUserId:row.owner_user_id,version:Number(row.version),status:row.status,executionState:row.execution_state,nextDueAt:row.next_due_at?new Date(row.next_due_at).toISOString():null,createdAt:new Date(row.created_at).toISOString(),updatedAt:new Date(row.updated_at).toISOString()});
const own=ctx=>[ctx.organisationId,ctx.actorId];
const installedSchemaDigest=digest(readFileSync(new URL('../sql/003-report-subscriptions.sql',import.meta.url)));
function page({limit=50,cursor=null}={}){
 requireThat(Number.isSafeInteger(limit)&&limit>=1&&limit<=100,'INVALID_PAGINATION',400);let after=null;
 if(cursor!==null){try{requireThat(typeof cursor==='string'&&cursor.length<=300&&/^[A-Za-z0-9_-]+$/.test(cursor),'INVALID_PAGINATION',400);after=JSON.parse(Buffer.from(cursor,'base64url').toString());requireThat(Array.isArray(after)&&after.length===2&&typeof after[0]==='string'&&Number.isFinite(Date.parse(after[0]))&&typeof after[1]==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(after[1]),'INVALID_PAGINATION',400);}catch{requireThat(false,'INVALID_PAGINATION',400);}}
 return {limit,after};
}
const nextCursor=(rows,limit,idKey='id')=>rows.length>limit?Buffer.from(JSON.stringify([rows[limit-1].cursor_at,rows[limit-1][idKey]])).toString('base64url'):null;
const publication=row=>({contractVersion:PUBLISHED_EDITION_CONTRACT,producerJobId:row.producer_job_id,editionId:row.edition_id,definitionId:row.definition_id,profileVersion:row.profile_version,title:row.title,period:row.period,asOf:new Date(row.as_of).toISOString(),publishedAt:new Date(row.published_at).toISOString(),pdfSha256:row.pdf_sha256,markdownSha256:row.markdown_sha256,status:'PUBLISHED',readOnly:row.read_only===true});
const scope=ctx=>{assertContext(ctx);requireThat(ctx.actorKind==='HUMAN','HUMAN_ORDER_REQUIRED',403);};
export class PostgresSubscriptionStore{
 constructor(reportStore,{now=()=>new Date().toISOString()}={}){requireThat(reportStore&&typeof reportStore.transaction==='function','CURRENT_REPORT_STORE_REQUIRED',503);this.store=reportStore;this.now=now;}
 async assertInstalled(ctx){scope(ctx);return this.store.transaction(ctx.organisationId,async db=>{
  const row=(await db.query("SELECT digest FROM insights_private.subscription_migrations WHERE version='1.0.0'")).rows[0];requireThat(row?.digest===installedSchemaDigest,'SUBSCRIPTION_SCHEMA_NOT_READY',503);
 });}
 async publishedList(ctx,options={}){scope(ctx);const {limit,after}=page(options);return this.store.transaction(ctx.organisationId,async db=>{
  const r=await db.query('SELECT *,NOT insights_private.publication_owned(organisation_id,producer_job_id) AS read_only,published_at::text AS cursor_at FROM insights_private.published_editions WHERE organisation_id=$1::uuid'+(after?' AND (published_at,producer_job_id)<($3::timestamptz,$4::uuid)':'')+' ORDER BY published_at DESC,producer_job_id DESC LIMIT $2',[ctx.organisationId,limit+1,...(after??[])]);return {items:r.rows.slice(0,limit).map(publication),nextCursor:nextCursor(r.rows,limit,'producer_job_id')};
 });}
 async published(ctx,jobId,{pdf=false}={}){scope(ctx);return this.store.transaction(ctx.organisationId,async db=>{
  const r=await db.query('SELECT *,NOT insights_private.publication_owned(organisation_id,producer_job_id) AS read_only FROM insights_private.published_editions WHERE organisation_id=$1::uuid AND producer_job_id=$2::uuid',[ctx.organisationId,jobId]);requireThat(r.rowCount===1,'PUBLISHED_EDITION_NOT_FOUND',404);const row=r.rows[0],kind=pdf?'pdf':'markdown',artifact=await this.store.artifact(ctx.organisationId,jobId,kind);
  requireThat(artifact&&artifact.sha256===(pdf?row.pdf_sha256:row.markdown_sha256)&&digest(artifact.bytes)===artifact.sha256,'PUBLISHED_ARTIFACT_MISMATCH',503);
  if(pdf){requireThat(Buffer.from(artifact.bytes).subarray(0,5).toString()==='%PDF-','PUBLISHED_ARTIFACT_MISMATCH',503);return {...publication(row),bytes:artifact.bytes};}
  requireThat(artifact.bytes.length<=1048576,'PUBLISHED_ARTIFACT_TOO_LARGE',503);const markdown=new TextDecoder('utf-8',{fatal:true}).decode(artifact.bytes);return {...publication(row),markdown};
 });}
 async shares(ctx,jobId,{mode='LIST',id=null,kind=null}={}){scope(ctx);return this.store.transaction(ctx.organisationId,async db=>{
  try{return(await db.query('SELECT insights_private.publication_share_command($1::uuid,$2::uuid,$3,$4::uuid,$5) AS result',[ctx.organisationId,jobId,mode,id,kind])).rows[0].result;}catch(e){if(e.code==='42501')requireThat(false,'PUBLISHED_EDITION_NOT_FOUND',404);throw e;}
 });}
 async acceptInvitation(ctx,token){scope(ctx);return this.store.transaction(ctx.organisationId,async db=>{
  try{return{producerJobId:(await db.query('SELECT insights_private.accept_publication_invitation($1::uuid,$2) AS id',[ctx.organisationId,token])).rows[0].id};}catch(e){if(e.code==='42501')requireThat(false,'INVITATION_UNAVAILABLE',404);throw e;}
 });}
 async withSavepoint(ctx,action){scope(ctx);return this.store.transaction(ctx.organisationId,async db=>{
  await db.query('SAVEPOINT subscription_command');try{const value=await action();await db.query('RELEASE SAVEPOINT subscription_command');return value;}
  catch(error){await db.query('ROLLBACK TO SAVEPOINT subscription_command');await db.query('RELEASE SAVEPOINT subscription_command');throw error;}
 });}
 async inbox(ctx,options={}){scope(ctx);const {limit,after}=page(options);return this.store.transaction(ctx.organisationId,async db=>{
  const r=await db.query('SELECT *,created_at::text AS cursor_at FROM insights_private.subscription_events WHERE organisation_id=$1::uuid AND owner_user_id=$2::uuid'+(after?' AND (created_at,id)<($4::timestamptz,$5::uuid)':'')+' ORDER BY created_at DESC,id DESC LIMIT $3',[...own(ctx),limit+1,...(after??[])]);
  return {items:r.rows.slice(0,limit).map(x=>({id:x.id,kind:x.event_kind,producerJobId:x.producer_job_id,createdAt:new Date(x.created_at).toISOString(),readAt:x.read_at?new Date(x.read_at).toISOString():null})),nextCursor:nextCursor(r.rows,limit)};
 });}
 async markRead(ctx,id){scope(ctx);return this.store.transaction(ctx.organisationId,async db=>{
  const r=await db.query('UPDATE insights_private.subscription_events SET read_at=coalesce(read_at,clock_timestamp()) WHERE organisation_id=$1::uuid AND owner_user_id=$2::uuid AND id=$3::uuid RETURNING id',[...own(ctx),id]);requireThat(r.rowCount===1,'NOTIFICATION_NOT_FOUND',404);return {id,read:true};
 });}
 async get(ctx,id,lock=false){scope(ctx);return this.store.transaction(ctx.organisationId,async db=>{
  const r=await db.query('SELECT * FROM insights_private.report_subscriptions WHERE organisation_id=$1::uuid AND owner_user_id=$2::uuid AND id=$3::uuid'+(lock?' FOR UPDATE':''),[...own(ctx),id]);requireThat(r.rowCount===1,'SUBSCRIPTION_NOT_FOUND',404);return dto(r.rows[0]);
 });}
 async list(ctx,options={}){scope(ctx);const {limit,after}=page(options);return this.store.transaction(ctx.organisationId,async db=>{
  const r=await db.query('SELECT *,updated_at::text AS cursor_at FROM insights_private.report_subscriptions WHERE organisation_id=$1::uuid AND owner_user_id=$2::uuid'+(after?' AND (updated_at,id)<($4::timestamptz,$5::uuid)':'')+' ORDER BY updated_at DESC,id DESC LIMIT $3',[...own(ctx),limit+1,...(after??[])]);return {items:r.rows.slice(0,limit).map(dto),nextCursor:nextCursor(r.rows,limit)};
 });}
 async create(ctx,input,profile,key){scope(ctx);const v=parseSubscription(input,profile);requireThat(typeof key==='string'&&/^[A-Za-z0-9._:-]{8,128}$/.test(key),'IDEMPOTENCY_KEY_REQUIRED',400);return this.store.transaction(ctx.organisationId,async db=>{
  const commandDigest=digest(v),nonce=digest(key),next=nextReportOccurrence(v.schedule,this.now());
  await db.query('INSERT INTO insights_private.report_subscriptions(id,organisation_id,owner_user_id,created_by_actor_id,definition_id,profile_version,name,status,definition,next_due_at,idempotency_digest,request_digest) VALUES($3::uuid,$1::uuid,$2::uuid,$2::uuid,$4,$5,$6,\'ACTIVE\',$7::jsonb,$8::timestamptz,$9,$10) ON CONFLICT DO NOTHING',[...own(ctx),randomUUID(),v.definitionId,v.profileVersion,v.name,JSON.stringify(v),next?.at??null,nonce,commandDigest]);
  const r=await db.query('SELECT * FROM insights_private.report_subscriptions WHERE organisation_id=$1::uuid AND owner_user_id=$2::uuid AND idempotency_digest=$3',[...own(ctx),nonce]);requireThat(r.rowCount===1&&r.rows[0].request_digest===commandDigest,'IDEMPOTENCY_CONFLICT',409);return dto(r.rows[0]);
 });}
 async update(ctx,id,input,profile){scope(ctx);const v=parseSubscription(input,profile,{partial:true});return this.store.transaction(ctx.organisationId,async db=>{
  const old=await this.get(ctx,id,true);requireThat(old.version===v.version,'SUBSCRIPTION_VERSION_CONFLICT',409);requireThat(old.status!=='ENDED','SUBSCRIPTION_ENDED',409);
  requireThat(v.definitionId===old.definitionId&&v.profileVersion===old.profileVersion,'PROFILE_VERSION_IMMUTABLE',409);
  const next=v.status==='ACTIVE'?nextReportOccurrence(v.schedule,this.now()):null;
  const r=await db.query('UPDATE insights_private.report_subscriptions SET name=$4,definition=$5::jsonb,status=$6,execution_state=$7,next_due_at=$8::timestamptz WHERE organisation_id=$1::uuid AND owner_user_id=$2::uuid AND id=$3::uuid RETURNING *',[...own(ctx),id,v.name,JSON.stringify(v),v.status,v.status==='ENDED'?'ENDED':'WAITING_AUTHORIZATION',next?.at??null]);return dto(r.rows[0]);
 });}
 async setStatus(ctx,id,{version,status}){scope(ctx);requireThat(Number.isSafeInteger(version)&&version>=1&&['ACTIVE','PAUSED','ENDED'].includes(status),'INVALID_SUBSCRIPTION_VERSION',400);return this.store.transaction(ctx.organisationId,async db=>{
  const old=await this.get(ctx,id,true);requireThat(old.version===version,'SUBSCRIPTION_VERSION_CONFLICT',409);requireThat(old.status!=='ENDED','SUBSCRIPTION_ENDED',409);
  const next=status==='ACTIVE'?nextReportOccurrence(old.schedule,this.now()):null;
  const r=await db.query('UPDATE insights_private.report_subscriptions SET status=$4,execution_state=$5,next_due_at=$6::timestamptz WHERE organisation_id=$1::uuid AND owner_user_id=$2::uuid AND id=$3::uuid RETURNING *',[...own(ctx),id,status,status==='ENDED'?'ENDED':old.schedule?'WAITING_AUTHORIZATION':old.executionState,next?.at??null]);return dto(r.rows[0]);
 });}
 async linkJob(ctx,subscription,job){scope(ctx);requireThat(subscription.ownerUserId===ctx.actorId&&subscription.organisationId===ctx.organisationId&&job.organisationId===ctx.organisationId&&job.command.definitionId===subscription.definitionId&&job.command.profileVersion===subscription.profileVersion,'PRODUCER_ORDER_MISMATCH',403);return this.store.transaction(ctx.organisationId,async db=>{
  await db.query('INSERT INTO insights_private.subscription_runs(id,subscription_id,organisation_id,owner_user_id,subscription_version,slot_key,producer_job_id,status) VALUES($3::uuid,$4::uuid,$1::uuid,$2::uuid,$5,$6,$7::uuid,\'QUEUED\') ON CONFLICT DO NOTHING',[...own(ctx),randomUUID(),subscription.id,subscription.version,'ONCE:'+subscription.version,job.id]);
  await db.query("UPDATE insights_private.report_subscriptions SET execution_state='QUEUED' WHERE organisation_id=$1::uuid AND owner_user_id=$2::uuid AND id=$3::uuid AND execution_state<>'QUEUED'",[...own(ctx),subscription.id]);
  return this.get(ctx,subscription.id);
 });}
 async runs(ctx,id,options={}){await this.get(ctx,id);const {limit,after}=page(options);return this.store.transaction(ctx.organisationId,async db=>{
  const r=await db.query('SELECT r.id,r.subscription_id,r.subscription_version,r.slot_key,r.producer_job_id,coalesce(j.status,r.status) AS status,r.created_at,r.created_at::text AS cursor_at FROM insights_private.subscription_runs r LEFT JOIN insights_private.report_jobs j ON j.id=r.producer_job_id AND j.organisation_id=r.organisation_id::text WHERE r.organisation_id=$1::uuid AND r.owner_user_id=$2::uuid AND r.subscription_id=$3::uuid'+(after?' AND (r.created_at,r.id)<($5::timestamptz,$6::uuid)':'')+' ORDER BY r.created_at DESC,r.id DESC LIMIT $4',[...own(ctx),id,limit+1,...(after??[])]);
  return {items:r.rows.slice(0,limit).map(x=>({id:x.id,subscriptionId:x.subscription_id,subscriptionVersion:Number(x.subscription_version),slot:x.slot_key,producerJobId:x.producer_job_id,status:x.status,createdAt:new Date(x.created_at).toISOString()})),nextCursor:nextCursor(r.rows,limit)};
 });}
}
