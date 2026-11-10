import {randomUUID,createHash} from 'node:crypto';
import {operationPayloadDigest} from '@profitia/platform-contracts/operation-context';
import {parseObservation,NEWSFEED_API_CONTRACT_VERSION} from '../../../packages/newsfeed-contracts/index.mjs';
import {SourceHubError} from '../../../packages/platform-source-hub-contracts/index.mjs';
const s=context=>[context.environment,context.applicationId,context.organisationId,context.subjectUserId];
const w='environment=$1 AND application_id=$2 AND organisation_id=$3::uuid AND owner_user_id=$4::uuid';
const hash=value=>createHash('sha256').update(value).digest('hex');
const observation=row=>({contractVersion:NEWSFEED_API_CONTRACT_VERSION,id:row.id,applicationId:row.application_id,environment:row.environment,organisationId:row.organisation_id,ownerUserId:row.owner_user_id,createdByActorId:row.created_by_actor_id,updatedByActorId:row.updated_by_actor_id,name:row.name,subjectKind:row.subject_kind,subject:row.subject,request:row.filters,status:row.status,version:Number(row.version),createdAt:new Date(row.created_at).toISOString(),updatedAt:new Date(row.updated_at).toISOString()});
const run=row=>({id:row.id,observationId:row.observation_id,status:row.status,errorCode:row.error_code,detectedCount:row.detected_count,publicationCount:row.publication_count,createdAt:new Date(row.created_at).toISOString(),completedAt:row.completed_at?new Date(row.completed_at).toISOString():null});
export function createRepository(configuration,database){
 async function get(transaction,context,id,lock=false){const r=await transaction.query('SELECT * FROM newsfeed.observations WHERE '+w+' AND id=$5::uuid'+(lock?' FOR UPDATE':''),[...s(context),id]);if(r.rows.length!==1)throw new SourceHubError('OBSERVATION_NOT_FOUND',404);return observation(r.rows[0]);}
 async function create(transaction,context,input){const v=parseObservation(input),id=randomUUID();const r=await transaction.query('INSERT INTO newsfeed.observations(id,environment,application_id,organisation_id,owner_user_id,created_by_actor_id,updated_by_actor_id,name,subject_kind,subject,filters,status) VALUES($5::uuid,$1,$2,$3::uuid,$4::uuid,$6::uuid,$6::uuid,$7,$8,$9,$10::jsonb,\'ACTIVE\') RETURNING *',[...s(context),id,context.actorId,v.name,v.subjectKind,v.subject,JSON.stringify(v.request)]);return observation(r.rows[0]);}
 /** @param {any} transaction @param {any} context @param {{limit?:number,cursor?:string|null}} options */
 async function list(transaction,context,{limit=50,cursor=null}={}){
  if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw new SourceHubError('INVALID_PAGINATION');let after=null;
  if(cursor!==null){try{if(typeof cursor!=='string'||cursor.length>300||!/^[A-Za-z0-9_-]+$/.test(cursor))throw Error();after=JSON.parse(Buffer.from(cursor,'base64url').toString('utf8'));if(!Array.isArray(after)||after.length!==2||!Number.isFinite(Date.parse(after[0]))||!/^[0-9a-f-]{36}$/i.test(after[1]))throw Error();}catch{throw new SourceHubError('INVALID_PAGINATION');}}
  const r=await transaction.query('SELECT * FROM newsfeed.observations WHERE '+w+(after?' AND (updated_at,id)<($6::timestamptz,$7::uuid)':'')+' ORDER BY updated_at DESC,id DESC LIMIT $5',[...s(context),limit+1,...(after??[])]);
  const items=r.rows.slice(0,limit).map(observation),last=items.at(-1);return {contractVersion:NEWSFEED_API_CONTRACT_VERSION,items,nextCursor:r.rows.length>limit?Buffer.from(JSON.stringify([last.updatedAt,last.id])).toString('base64url'):null};
 }
 async function update(transaction,context,id,input){const v=parseObservation(input,{partial:true}),old=await get(transaction,context,id,true);if(old.version!==v.version)throw new SourceHubError('OBSERVATION_VERSION_CONFLICT',409);
  const r=await transaction.query('UPDATE newsfeed.observations SET name=$6,subject_kind=$7,subject=$8,filters=$9::jsonb,status=$10,updated_by_actor_id=$11::uuid WHERE '+w+' AND id=$5::uuid RETURNING *',[...s(context),id,v.name??old.name,v.subjectKind??old.subjectKind,v.subject??old.subject,JSON.stringify(v.request??old.request),v.status??old.status,context.actorId]);return observation(r.rows[0]);
 }
 async function remove(transaction,context,id){await get(transaction,context,id,true);await transaction.query('DELETE FROM newsfeed.observations WHERE '+w+' AND id=$5::uuid',[...s(context),id]);await transaction.query('DELETE FROM newsfeed.publications p WHERE '+w+' AND NOT EXISTS(SELECT 1 FROM newsfeed.observation_publications l WHERE l.environment=p.environment AND l.application_id=p.application_id AND l.organisation_id=p.organisation_id AND l.owner_user_id=p.owner_user_id AND l.publication_id=p.id)',s(context));return {deleted:true,id};}
 async function publications(transaction,context,observationId){await get(transaction,context,observationId);const r=await transaction.query('SELECT p.id,p.provider_id,p.source_record_ref,p.url,p.headline,p.published_at,p.discovered_at,p.kind,p.metadata,l.publication_status FROM newsfeed.publications p JOIN newsfeed.observation_publications l ON l.environment=p.environment AND l.application_id=p.application_id AND l.organisation_id=p.organisation_id AND l.owner_user_id=p.owner_user_id AND l.publication_id=p.id WHERE p.environment=$1 AND p.application_id=$2 AND p.organisation_id=$3::uuid AND p.owner_user_id=$4::uuid AND l.observation_id=$5::uuid AND p.retention_until>clock_timestamp() ORDER BY l.detected_at DESC,p.id DESC LIMIT 100',[...s(context),observationId]);return r.rows.map(x=>({id:x.id,provider:x.provider_id,sourceRecordRef:x.source_record_ref,url:x.url,headline:x.headline,publishedAt:x.published_at?new Date(x.published_at).toISOString():null,discoveredAt:new Date(x.discovered_at).toISOString(),kind:x.kind,metadata:x.metadata,publicationStatus:x.publication_status}));}
 async function history(transaction,context,id){await get(transaction,context,id);const r=await transaction.query('SELECT * FROM newsfeed.monitor_runs WHERE '+w+' AND observation_id=$5::uuid ORDER BY created_at DESC,id DESC LIMIT 100',[...s(context),id]);return {items:r.rows.map(run),publications:await publications(transaction,context,id)};}
 async function beginRun(transaction,context,id,key){
  if(typeof key!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(key))throw new SourceHubError('IDEMPOTENCY_KEY_REQUIRED');
  const o=await get(transaction,context,id,true),digest=operationPayloadDigest({version:o.version,request:o.request}),k=hash(key);
  const r=await transaction.query('SELECT * FROM newsfeed.monitor_runs WHERE '+w+' AND observation_id=$5::uuid AND idempotency_digest=$6 FOR UPDATE',[...s(context),id,k]);
  if(r.rows.length){const x=r.rows[0];if(x.request_digest!==digest)throw new SourceHubError('IDEMPOTENCY_CONFLICT',409);if(x.status!=='SUCCEEDED')throw new SourceHubError(x.status==='PENDING'?'DISCOVERY_IN_PROGRESS':'PREVIOUS_ATTEMPT_UNAVAILABLE',409);return {kind:'replay',run:run(x),publications:await publications(transaction,context,id)};}
  if(o.status!=='ACTIVE')throw new SourceHubError('OBSERVATION_PAUSED',409);
  const runId=randomUUID();await transaction.query('INSERT INTO newsfeed.monitor_runs(id,environment,application_id,organisation_id,owner_user_id,observation_id,actor_id,observation_version,idempotency_digest,request_digest,status) VALUES($5::uuid,$1,$2,$3::uuid,$4::uuid,$6::uuid,$7::uuid,$8,$9,$10,\'PENDING\')',[...s(context),runId,id,context.actorId,o.version,k,digest]);
  return {kind:'new',id:runId,observation:o,expectedUserId:context.subjectUserId,organisationId:context.organisationId};
 }
 async function completeRun(transaction,context,started,body){
  const o=await get(transaction,context,started.observation.id,true);if(o.status!=='ACTIVE'||o.version!==started.observation.version)throw new SourceHubError('OBSERVATION_CHANGED',409);
  for(const item of body.items){const p=item.payload,m=item.metadata;if(!['NEWS_ARTICLE','WEB_PAGE'].includes(p.kind)||!p.url||!m.retentionUntil||Date.parse(m.retentionUntil)<=Date.now())continue;
   const r=await transaction.query('INSERT INTO newsfeed.publications(id,environment,application_id,organisation_id,owner_user_id,provider_id,source_record_ref,fingerprint,url,headline,published_at,discovered_at,kind,metadata,licence_ref,retention_until) VALUES($5::uuid,$1,$2,$3::uuid,$4::uuid,$6,$7,$8,$9,$10,$11::timestamptz,$12::timestamptz,$13,$14::jsonb,$15,$16::timestamptz) ON CONFLICT(environment,application_id,organisation_id,owner_user_id,provider_id,source_record_ref) DO UPDATE SET metadata=excluded.metadata,retention_until=excluded.retention_until RETURNING id',[...s(context),randomUUID(),body.provider,m.sourceRecordRef,m.contentFingerprint,p.url,p.title,p.publishedAt,m.retrievedAt,p.kind,JSON.stringify(m),m.licenceRef,m.retentionUntil]);
   await transaction.query('INSERT INTO newsfeed.observation_publications(environment,application_id,organisation_id,owner_user_id,observation_id,publication_id,first_run_id) VALUES($1,$2,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7::uuid) ON CONFLICT DO NOTHING',[...s(context),o.id,r.rows[0].id,started.id]);
  }
  const saved=await publications(transaction,context,o.id);const count=await transaction.query('SELECT count(*)::integer AS n FROM newsfeed.observation_publications WHERE '+w+' AND first_run_id=$5::uuid',[...s(context),started.id]);const r=await transaction.query('UPDATE newsfeed.monitor_runs SET status=\'SUCCEEDED\',publication_count=$6,detected_count=$7,completed_at=clock_timestamp() WHERE '+w+' AND id=$5::uuid AND status=\'PENDING\' RETURNING *',[...s(context),started.id,count.rows[0].n,body.items.length]);if(r.rows.length!==1)throw new SourceHubError('DISCOVERY_CONFLICT',409);return {run:run(r.rows[0]),publications:saved};
 }
 async function failRun(transaction,context,started,error){await transaction.query('UPDATE newsfeed.monitor_runs SET status=$6,error_code=$7,completed_at=clock_timestamp() WHERE '+w+' AND id=$5::uuid AND status=\'PENDING\'',[...s(context),started.id,error.code==='EXTERNAL_RESULT_UNVERIFIED'?'UNCERTAIN':'FAILED',error.code??'SOURCE_HUB_UNAVAILABLE']);}
 async function ready(){try{await database.verifyLogin();const r=await database.query('SELECT * FROM newsfeed.installation WHERE singleton'),x=r.rows[0];return !!x&&x.schema_version==='1.0.0'&&x.environment===configuration.environment&&x.application_id===configuration.applicationId&&x.project_id===configuration.projectId&&x.branch_id===configuration.branchId&&x.database_name===configuration.databaseName;}catch{return false;}}
 async function assistantContext(transaction,context,{observationId=null,supplierNip=null}={}){
  // All methods below retain the same verified user/organisation predicate.
  // No discovery, source acquisition, writer, metadata copy or fallback.
  const page=observationId===null?await list(transaction,context,{limit:10}):{items:[await get(transaction,context,observationId)],nextCursor:null};
  const matches=page.items.filter(o=>supplierNip===null||o.subjectKind==='company'
   && /^(?:NIP[:\s]*)?(\d{10})$/i.exec(o.subject.trim())?.[1]===supplierNip);
  const observations=[];let truncated=page.nextCursor!==null||matches.length>3;
  for(const o of matches.slice(0,3)){
   const h=await history(transaction,context,o.id),selected=h.publications.slice(0,5);
   const dates=selected.length?(await transaction.query('SELECT publication_id,detected_at FROM newsfeed.observation_publications WHERE '+w+' AND observation_id=$5::uuid AND publication_id=ANY($6::uuid[])',
    [...s(context),o.id,selected.map(p=>p.id)])).rows:[];
   truncated ||= h.items.length>3||h.publications.length>5;
   observations.push({id:o.id,name:o.name,subjectKind:o.subjectKind,subject:o.subject,status:o.status,version:o.version,createdAt:o.createdAt,updatedAt:o.updatedAt,
    runs:h.items.slice(0,3),publications:selected.map(p=>{const date=dates.find(d=>d.publication_id===p.id)?.detected_at;return {
     id:p.id,provider:p.provider,url:p.url,headline:p.headline,publishedAt:p.publishedAt,discoveredAt:p.discoveredAt,
     detectedAt:date?new Date(date).toISOString():null,publicationStatus:p.publicationStatus};})});
  }
  return {version:'newsfeed-assistant-read-v1',status:observations.length?truncated?'PARTIAL':'OK':'EMPTY',observations,truncated};
 }

 return Object.freeze({create,get,list,update,remove,history,assistantContext,beginRun,completeRun,failRun,ready});
}
