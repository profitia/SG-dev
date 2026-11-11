import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {operationPayloadDigest} from '@profitia/platform-contracts/operation-context';
import {parseObservation,parseSavedSearch,SAVED_SEARCH_CONTRACT_VERSION,NEWSFEED_API_CONTRACT_VERSION} from '../../../packages/newsfeed-contracts/index.mjs';
import {SourceHubError} from '../../../packages/platform-source-hub-contracts/index.mjs';
import {publicationStatistics} from './statistics.mjs';
import {nextOccurrence} from './scheduler.mjs';
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

const saved=row=>({...observation(row),readOnly:false,contractVersion:SAVED_SEARCH_CONTRACT_VERSION,phrases:row.phrases,schedule:row.schedule,notifications:row.notifications,monitoringState:row.monitoring_state,nextDueAt:row.next_due_at?new Date(row.next_due_at).toISOString():null});
/** @param {{limit?:number,cursor?:string|null}} options */
function pageOptions({limit=50,cursor=null}={}){
 if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw new SourceHubError('INVALID_PAGINATION');
 let after=null;if(cursor!==null){try{if(typeof cursor!=='string'||cursor.length>300||!/^[A-Za-z0-9_-]+$/.test(cursor))throw Error();after=JSON.parse(Buffer.from(cursor,'base64url').toString());if(!Array.isArray(after)||after.length!==2||typeof after[0]!=='string'||!Number.isFinite(Date.parse(after[0]))||typeof after[1]!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(after[1]))throw Error();}catch{throw new SourceHubError('INVALID_PAGINATION');}}
 return {limit,after};
}
const cursorFor=(rows,limit,dateKey)=>rows.length>limit?Buffer.from(JSON.stringify([typeof (rows[limit-1].cursor_at??rows[limit-1][dateKey])==='string'?(rows[limit-1].cursor_at??rows[limit-1][dateKey]):new Date(rows[limit-1][dateKey]).toISOString(),rows[limit-1].id])).toString('base64url'):null;
const iso=value=>value?new Date(value).toISOString():null;
export function indexNewsfeedPublications(body){return body.items.map(item=>indexedItem(item,body.provider)).filter(item=>item!==null);}
function indexedItem(item,provider){
 const p=item?.payload,m=item?.metadata;if(!['NEWS_ARTICLE','WEB_PAGE'].includes(p?.kind))return null;
 let u;try{u=new URL(p.url);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.href.length>4096)throw Error();u.hash='';}catch{throw new SourceHubError('INVALID_PUBLICATION_URL');}
 if(typeof m?.sourceRecordRef!=='string'||m.sourceRecordRef.length>1000||typeof m.licenceRef!=='string'||m.licenceRef.length>1000||!Number.isFinite(Date.parse(m.retrievedAt)))throw new SourceHubError('INVALID_PUBLICATION_PROVENANCE');
 return {url:u.href,headline:typeof p.title==='string'?p.title.slice(0,2000):null,publishedAt:p.publishedAt&&Number.isFinite(Date.parse(p.publishedAt))?new Date(p.publishedAt).toISOString():null,
  provider,sourceRecordRef:m.sourceRecordRef,licenceRef:m.licenceRef,retrievedAt:new Date(m.retrievedAt).toISOString(),kind:p.kind};
}
/** Version1.2 owns only permitted URL/title/provenance metadata. Legacy v1
 * remains unchanged; no Source payload, snippet or provider TTL is extended. */
export function createSavedSearchRepository(configuration,database,{now=()=>new Date().toISOString()}={}){
 const legacy=createRepository(configuration,database);
 async function decorate(t,rows){if(!configuration.recurring||!rows.length)return rows;const r=(await t.query('SELECT newsfeed.monitoring_projection($1::uuid[]) AS items',[rows.map(x=>x.id)])).rows[0].items,states=new Map(r.map(x=>[x.id,x]));return rows.map(o=>({...o,...states.get(o.id)}));}
 const expectedSchemaDigest=hash(readFileSync(new URL('../migrations/003-saved-searches.sql',import.meta.url)));
 async function shared(t,id,kind,options={}){
  const {limit,after}=pageOptions(options);
  try{return (await t.query('SELECT newsfeed.read_shared($1::uuid,$2,$3,$4::timestamptz,$5::uuid,$6::uuid,$7,$8,$9::uuid) AS value',[id,kind,limit+1,after?.[0]??null,after?.[1]??null,options.runId??null,options.q??'',options.access??'shared',options.publicationId??null])).rows[0].value;}
  catch(error){if(error.code==='PT404')throw new SourceHubError('OBSERVATION_NOT_FOUND',404);throw error;}
 }
 async function get(t,c,id,lock=false){const r=await t.query('SELECT * FROM newsfeed.observations WHERE '+w+' AND id=$5::uuid'+(lock?' FOR UPDATE':''),[...s(c),id]);if(r.rows.length===1)return (await decorate(t,[{...saved(r.rows[0]),readOnly:false}]))[0];if(lock)throw new SourceHubError('OBSERVATION_NOT_FOUND',404);return(await decorate(t,[{...saved(await shared(t,id,'observation')),readOnly:true}]))[0];}
 async function feed(t,c,options={}){const {limit}=pageOptions(options);if(typeof(options.q??'')!=='string'||(options.q??'').length>200)throw new SourceHubError('INVALID_QUERY');const rows=await shared(t,null,'feed',options);return {items:rows.slice(0,limit).map(x=>({id:x.id,url:x.url,headline:x.headline,publishedAt:iso(x.published_at),detectedAt:iso(x.detected_at),provider:x.provider_id,kind:x.kind,sourceRecordRef:x.source_record_ref,licenceRef:x.licence_ref,retrievedAt:iso(x.retrieved_at),topics:x.topics??[],excerpt:null,excerptStatus:'NOT_RETAINED'})),nextCursor:cursorFor(rows,limit,'detected_at')};}
 async function create(t,c,input){
  const v=parseSavedSearch(input),due=v.schedule?nextOccurrence(v.schedule,now()):null;
  const r=await t.query('INSERT INTO newsfeed.observations(id,environment,application_id,organisation_id,owner_user_id,created_by_actor_id,updated_by_actor_id,name,subject_kind,subject,filters,status,phrases,schedule,notifications,next_due_at,monitoring_state) VALUES($5::uuid,$1,$2,$3::uuid,$4::uuid,$6::uuid,$6::uuid,$7,$8,$9,$10::jsonb,\'ACTIVE\',$11::jsonb,$12::jsonb,$13,$14::timestamptz,$15) RETURNING *',[...s(c),randomUUID(),c.actorId,v.name,v.subjectKind,v.subject,JSON.stringify(v.request),JSON.stringify(v.phrases),v.schedule===null?null:JSON.stringify(v.schedule),v.notifications,due?.at??null,v.schedule?'WAITING_AUTHORIZATION':'MANUAL']);return saved(r.rows[0]);
 }
 async function list(t,c,options={}){const {limit,after}=pageOptions(options),access=options.access??'mine';if(!['mine','shared','organisation'].includes(access))throw new SourceHubError('INVALID_QUERY');const rows=access==='mine'?(await t.query('SELECT *,updated_at::text AS cursor_at FROM newsfeed.observations WHERE '+w+(after?' AND (updated_at,id)<($6::timestamptz,$7::uuid)':'')+' ORDER BY updated_at DESC,id DESC LIMIT $5',[...s(c),limit+1,...(after??[])])).rows:await shared(t,null,'list',options);return {contractVersion:SAVED_SEARCH_CONTRACT_VERSION,items:await decorate(t,rows.slice(0,limit).map(x=>({...saved(x),readOnly:access!=='mine'}))),nextCursor:cursorFor(rows,limit,'updated_at')};}
 async function update(t,c,id,input){
  const v=parseSavedSearch(input,{partial:true}),old=await get(t,c,id,true);if(v.version!==old.version)throw new SourceHubError('OBSERVATION_VERSION_CONFLICT',409);
  const schedule=v.schedule===undefined?old.schedule:v.schedule,status=v.status??old.status,due=schedule?nextOccurrence(schedule,now()):null;
  const r=await t.query('UPDATE newsfeed.observations SET name=$6,subject_kind=$7,subject=$8,filters=$9::jsonb,status=$10,phrases=$11::jsonb,schedule=$12::jsonb,notifications=$13,next_due_at=$14::timestamptz,monitoring_state=$15,updated_by_actor_id=$16::uuid WHERE '+w+' AND id=$5::uuid RETURNING *',[...s(c),id,v.name??old.name,v.subjectKind??old.subjectKind,v.subject??old.subject,JSON.stringify(v.request??old.request),status,JSON.stringify(v.phrases??old.phrases),schedule===null?null:JSON.stringify(schedule),v.notifications??old.notifications,due?.at??null,status==='PAUSED'?'PAUSED':schedule?'WAITING_AUTHORIZATION':'MANUAL',c.actorId]);return saved(r.rows[0]);
 }
 async function history(t,c,id,options){const o=await get(t,c,id),{limit,after}=pageOptions(options);const rows=o.readOnly?await shared(t,id,'history',options):(await t.query('SELECT *,created_at::text AS cursor_at FROM newsfeed.monitor_runs WHERE '+w+' AND observation_id=$5::uuid'+(after?' AND (created_at,id)<($7::timestamptz,$8::uuid)':'')+' ORDER BY created_at DESC,id DESC LIMIT $6',[...s(c),id,limit+1,...(after??[])])).rows;return {contractVersion:SAVED_SEARCH_CONTRACT_VERSION,items:rows.slice(0,limit).map(x=>({...run(x),observationVersion:Number(x.observation_version),criteriaSnapshot:x.request_snapshot??null})),nextCursor:cursorFor(rows,limit,'created_at')};}
 async function publications(t,c,id,options={}){
  const o=await get(t,c,id),{limit,after}=pageOptions(options),runId=options.runId??null;
  if(o.readOnly){const rows=await shared(t,id,'publications',options);return {contractVersion:SAVED_SEARCH_CONTRACT_VERSION,items:rows.slice(0,limit).map(x=>({id:x.id,url:x.url,headline:x.headline,publishedAt:iso(x.published_at),detectedAt:iso(x.detected_at),provider:x.provider_id,kind:x.kind,sourceRecordRef:x.source_record_ref,licenceRef:x.licence_ref,retrievedAt:iso(x.retrieved_at),...(x.metadata_snapshot??{}),excerpt:null,excerptStatus:'NOT_RETAINED'})),nextCursor:cursorFor(rows,limit,'detected_at'),runId};}
  if(runId!==null){const r=await t.query('SELECT id FROM newsfeed.monitor_runs WHERE '+w+' AND observation_id=$5::uuid AND id=$6::uuid',[...s(c),id,runId]);if(r.rowCount!==1)throw new SourceHubError('RUN_NOT_FOUND',404);}
  const q=options.q??'';if(typeof q!=='string'||q.length>200)throw new SourceHubError('INVALID_QUERY');
  const values=[...s(c),id,limit+1],bind=value=>{values.push(value);return '$'+values.length;};
  const runJoin=runId?' JOIN newsfeed.run_publications rp ON rp.environment=p.environment AND rp.application_id=p.application_id AND rp.organisation_id=p.organisation_id AND rp.owner_user_id=p.owner_user_id AND rp.publication_id=p.id AND rp.run_id='+bind(runId)+'::uuid':'';
  const dateFilter=after?' AND (l.detected_at,p.id)<('+bind(after[0])+'::timestamptz,'+bind(after[1])+'::uuid)':'';
  const textFilter=q?' AND strpos(lower(coalesce('+(runId?"rp.metadata_snapshot->>'headline'":'p.headline')+",'')),lower("+bind(q)+'))>0':'';
  const publicationFilter=options.publicationId?' AND p.id='+bind(options.publicationId)+'::uuid':'';
  const r=await t.query('SELECT p.id,p.url,p.headline,p.published_at,p.provider_id,p.kind,p.source_record_ref,p.licence_ref,p.retrieved_at,l.detected_at,l.detected_at::text AS cursor_at'+(runId?',rp.metadata_snapshot':'')+' FROM newsfeed.publication_index p JOIN newsfeed.search_publications l USING(environment,application_id,organisation_id,owner_user_id)'+runJoin+' WHERE p.id=l.publication_id AND p.environment=$1 AND p.application_id=$2 AND p.organisation_id=$3::uuid AND p.owner_user_id=$4::uuid AND l.observation_id=$5::uuid'+dateFilter+textFilter+publicationFilter+' ORDER BY l.detected_at DESC,p.id DESC LIMIT $6',values);
  return {contractVersion:SAVED_SEARCH_CONTRACT_VERSION,items:r.rows.slice(0,limit).map(x=>({id:x.id,url:x.url,headline:x.headline,publishedAt:iso(x.published_at),detectedAt:iso(x.detected_at),provider:x.provider_id,kind:x.kind,sourceRecordRef:x.source_record_ref,licenceRef:x.licence_ref,retrievedAt:iso(x.retrieved_at),...(x.metadata_snapshot??{}),excerpt:null,excerptStatus:'NOT_RETAINED'})),nextCursor:cursorFor(r.rows,limit,'detected_at'),runId};
 }
 async function beginRun(t,c,id,key){
  const o=await get(t,c,id,true),started=await legacy.beginRun(t,c,id,key);
  if(started.kind==='replay'){if(!started.run)throw new SourceHubError('INVALID_RUN_STATE',503);return {kind:'replay',run:started.run,publications:await publications(t,c,id,{runId:started.run.id})};}
  await t.query('UPDATE newsfeed.monitor_runs SET request_snapshot=$6::jsonb WHERE '+w+' AND id=$5::uuid',[...s(c),started.id,JSON.stringify({version:o.version,name:o.name,request:o.request,phrases:o.phrases})]);
  return {...started,observation:o};
 }
 async function completeRun(t,c,started,body){
  const o=await get(t,c,started.observation.id,true);if(o.status!=='ACTIVE'||o.version!==started.observation.version)throw new SourceHubError('OBSERVATION_CHANGED',409);
  let created=0;for(const item of body.items){const p=indexedItem(item,body.provider);if(!p)continue;
   const values=[...s(c),randomUUID(),hash(p.url),p.url,p.headline,p.publishedAt,p.provider,p.kind,p.sourceRecordRef,p.licenceRef,p.retrievedAt];
   let r=await t.query('INSERT INTO newsfeed.publication_index(environment,application_id,organisation_id,owner_user_id,id,url_fingerprint,url,headline,published_at,provider_id,kind,source_record_ref,licence_ref,retrieved_at) VALUES($1,$2,$3::uuid,$4::uuid,$5::uuid,$6,$7,$8,$9::timestamptz,$10,$11,$12,$13,$14::timestamptz) ON CONFLICT DO NOTHING RETURNING id',values);
   if(!r.rowCount)r=await t.query('SELECT id FROM newsfeed.publication_index WHERE '+w+' AND url_fingerprint=$5',[...s(c),hash(p.url)]);
   const publicationId=r.rows[0].id;
   const linked=await t.query('INSERT INTO newsfeed.search_publications(environment,application_id,organisation_id,owner_user_id,observation_id,publication_id) VALUES($1,$2,$3::uuid,$4::uuid,$5::uuid,$6::uuid) ON CONFLICT DO NOTHING RETURNING publication_id',[...s(c),o.id,publicationId]);
   await t.query('INSERT INTO newsfeed.run_publications(environment,application_id,organisation_id,owner_user_id,run_id,publication_id,metadata_snapshot) VALUES($1,$2,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7::jsonb) ON CONFLICT DO NOTHING',[...s(c),started.id,publicationId,JSON.stringify(p)]);
   if(linked.rowCount){created++;if(o.notifications)await t.query('INSERT INTO newsfeed.inbox_events(id,environment,application_id,organisation_id,owner_user_id,observation_id,publication_id,event_kind) VALUES($5::uuid,$1,$2,$3::uuid,$4::uuid,$6::uuid,$7::uuid,\'PUBLICATION_DETECTED\') ON CONFLICT DO NOTHING',[...s(c),randomUUID(),o.id,publicationId]);}
  }
  const r=await t.query('UPDATE newsfeed.monitor_runs SET status=\'SUCCEEDED\',publication_count=$6,detected_count=$7,completed_at=clock_timestamp() WHERE '+w+' AND id=$5::uuid AND status=\'PENDING\' RETURNING *',[...s(c),started.id,created,body.items.length]);if(r.rowCount!==1)throw new SourceHubError('DISCOVERY_CONFLICT',409);
  return {run:run(r.rows[0]),publications:await publications(t,c,o.id,{runId:started.id})};
 }
 async function statistics(t,c,id,options={}){const o=await get(t,c,id);const rows=o.readOnly?await shared(t,id,'statistics'):(await t.query('SELECT p.id,p.kind,p.headline,p.published_at,l.detected_at FROM newsfeed.publication_index p JOIN newsfeed.search_publications l USING(environment,application_id,organisation_id,owner_user_id) WHERE p.id=l.publication_id AND p.environment=$1 AND p.application_id=$2 AND p.organisation_id=$3::uuid AND p.owner_user_id=$4::uuid AND l.observation_id=$5::uuid',[...s(c),id])).rows.map(x=>({id:x.id,kind:x.kind,headline:x.headline,publishedAt:iso(x.published_at),detectedAt:iso(x.detected_at)}));return publicationStatistics(rows,{...options,phrases:o.phrases,asOf:now()});}
 async function shares(t,c,id){if((await get(t,c,id)).readOnly)throw new SourceHubError('OBSERVATION_NOT_FOUND',404);const grants=await t.query('SELECT id,access_kind,created_at FROM newsfeed.observation_shares WHERE '+w+' AND observation_id=$5::uuid ORDER BY created_at,id',[...s(c),id]),invitations=await t.query('SELECT id,expires_at,claimed_at FROM newsfeed.share_invitations WHERE '+w+' AND observation_id=$5::uuid ORDER BY expires_at,id',[...s(c),id]);return {grants:grants.rows.map(x=>({id:x.id,mode:x.access_kind,createdAt:iso(x.created_at)})),invitations:invitations.rows.map(x=>({id:x.id,expiresAt:iso(x.expires_at),claimedAt:iso(x.claimed_at)}))};}
 async function share(t,c,id,input){
  const o=await get(t,c,id,true);if(!input||Object.keys(input).sort().join(',')!=='contractVersion,mode,version'||input.contractVersion!==SAVED_SEARCH_CONTRACT_VERSION||!['ORG','USER_LINK'].includes(input.mode))throw new SourceHubError('INVALID_SHARE');if(input.version!==o.version)throw new SourceHubError('OBSERVATION_VERSION_CONFLICT',409);
  const shareId=randomUUID();if(input.mode==='ORG'){await t.query("INSERT INTO newsfeed.observation_shares(id,environment,application_id,organisation_id,owner_user_id,observation_id,access_kind) VALUES($5::uuid,$1,$2,$3::uuid,$4::uuid,$6::uuid,'ORG') ON CONFLICT DO NOTHING",[...s(c),shareId,id]);return {shared:true,mode:'ORG'};}
  const token=randomBytes(32).toString('hex'),expiresAt=new Date(Date.parse(now())+86400000).toISOString();
  await t.query('INSERT INTO newsfeed.share_invitations(id,environment,application_id,organisation_id,owner_user_id,observation_id,token_digest,expires_at) VALUES($5::uuid,$1,$2,$3::uuid,$4::uuid,$6::uuid,$7,$8::timestamptz)',[...s(c),shareId,id,hash(token),expiresAt]);return {id:shareId,token,expiresAt};
 }
 async function revokeShare(t,c,id,shareId,kind){await get(t,c,id,true);if(!['SHARE','INVITATION'].includes(kind)||!uuidValue(shareId))throw new SourceHubError('INVALID_SHARE');const r=await t.query('DELETE FROM newsfeed.'+(kind==='SHARE'?'observation_shares':'share_invitations')+' WHERE '+w+' AND observation_id=$5::uuid AND id=$6::uuid RETURNING id',[...s(c),id,shareId]);if(!r.rowCount)throw new SourceHubError('SHARE_NOT_FOUND',404);return {revoked:true,id:shareId};}
 async function claimInvitation(t,c,input){if(!input||Object.keys(input).join(',')!=='token'||typeof input.token!=='string'||!/^[a-f0-9]{64}$/.test(input.token))throw new SourceHubError('INVALID_INVITATION');try{const r=await t.query('SELECT newsfeed.claim_invitation($1,$2::uuid) AS id',[hash(input.token),randomUUID()]);return get(t,c,r.rows[0].id);}catch(error){if(error.code==='PT404')throw new SourceHubError('INVITATION_UNAVAILABLE',404);throw error;}}
 async function assistantContext(t,c,{observationId=null,supplierNip=null}={}){
  const page=observationId?{items:[await get(t,c,observationId)],nextCursor:null}:await list(t,c,{limit:10});
  const matches=page.items.filter(o=>supplierNip===null||o.subjectKind==='company'&&/^(?:NIP[:\s]*)?(\d{10})$/i.exec(o.subject.trim())?.[1]===supplierNip);
  const observations=[];let truncated=page.nextCursor!==null||matches.length>3;
  for(const o of matches.slice(0,3)){
   const h=await history(t,c,o.id,{limit:3}),p=await publications(t,c,o.id,{limit:5});truncated ||= !!h.nextCursor||!!p.nextCursor;
   observations.push({id:o.id,name:o.name,subjectKind:o.subjectKind,subject:o.subject,status:o.status,version:o.version,createdAt:o.createdAt,updatedAt:o.updatedAt,
    runs:h.items.map(({criteriaSnapshot,...r})=>r),publications:p.items.filter(x=>typeof x.headline==='string').map(x=>({id:x.id,provider:x.provider,url:x.url,headline:x.headline.slice(0,1200),publishedAt:x.publishedAt,discoveredAt:x.retrievedAt,detectedAt:x.detectedAt,publicationStatus:'DETECTED'}))});
  }
  while(Buffer.byteLength(JSON.stringify(observations))>24000){const last=[...observations].reverse().find(x=>x.publications.length);if(!last)throw new SourceHubError('CONTEXT_TOO_LARGE',503);last.publications.pop();truncated=true;}
  return {version:'newsfeed-assistant-read-v1',status:observations.length?truncated?'PARTIAL':'OK':'EMPTY',observations,truncated};
 }
 async function inbox(t,c,options){const {limit,after}=pageOptions(options);const r=configuration.recurring?{rows:(await t.query('SELECT newsfeed.monitoring_inbox($1,$2::timestamptz,$3::uuid) AS items',[limit+1,after?.[0]??null,after?.[1]??null])).rows[0].items}:await t.query('SELECT *,created_at::text AS cursor_at FROM newsfeed.inbox_events WHERE '+w+(after?' AND (created_at,id)<($6::timestamptz,$7::uuid)':'')+' ORDER BY created_at DESC,id DESC LIMIT $5',[...s(c),limit+1,...(after??[])]);return {items:r.rows.slice(0,limit).map(x=>({id:x.id,kind:x.event_kind,observationId:x.observation_id,publicationId:x.publication_id,createdAt:iso(x.created_at),readAt:iso(x.read_at)})),nextCursor:cursorFor(r.rows,limit,'created_at')};}
 async function markRead(t,c,id){if(configuration.recurring){try{return(await t.query('SELECT newsfeed.monitoring_mark_read($1::uuid) AS value',[id])).rows[0].value}catch(e){if(e.code==='PT404')throw new SourceHubError('NOTIFICATION_NOT_FOUND',404);throw e}}const r=await t.query('UPDATE newsfeed.inbox_events SET read_at=coalesce(read_at,clock_timestamp()) WHERE '+w+' AND id=$5::uuid RETURNING id',[...s(c),id]);if(!r.rowCount)throw new SourceHubError('NOTIFICATION_NOT_FOUND',404);return {id,read:true};}
 async function setNotifications(t,c,id,enabled){if(!configuration.recurring)throw new SourceHubError('MONITORING_NOT_CONFIGURED',503);await get(t,c,id);try{return(await t.query('SELECT newsfeed.monitoring_preference($1::uuid,$2) AS value',[id,enabled])).rows[0].value}catch(e){if(e.code==='PT404')throw new SourceHubError('OBSERVATION_NOT_FOUND',404);throw e}}
 async function ready(){try{if(!await legacy.ready())return false;const r=await database.query("SELECT version,digest FROM newsfeed.saved_search_migrations WHERE version='1.2.0'");return r.rowCount===1&&r.rows[0].digest===expectedSchemaDigest;}catch{return false;}}
 return Object.freeze({create,get,list,feed,update,remove:legacy.remove,history,publications,statistics,shares,share,revokeShare,claimInvitation,assistantContext,inbox,markRead,setNotifications,beginRun,completeRun,failRun:legacy.failRun,ready});
}
const uuidValue=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
