import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {operationPayloadDigest} from '@profitia/platform-contracts/operation-context';
import {SourceHubError} from '../../../packages/platform-source-hub-contracts/index.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const scope=context=>[context.environment,context.applicationId,context.organisationId,context.subjectUserId];
const where='environment=$1 AND application_id=$2 AND organisation_id=$3::uuid AND owner_user_id=$4::uuid';
export function calendarStorageProjection(licence,family){
 if(family!=='economic-calendar'||licence.consumer_storage_mode!=='DURABLE_OWNER_ENTITLEMENT')return null;
 if(licence.consumer_access_mode!=='SPENDGURU_PRODUCT'||typeof licence.consumer_storage_basis_ref!=='string'||!licence.consumer_storage_basis_ref.length||licence.consumer_storage_basis_ref.length>256||!/^([1-9][0-9]*)$/.test(String(licence.version)))throw new SourceHubError('LICENCE_STORAGE_PROJECTION_INVALID',403);
 return {mode:'DURABLE_OWNER_ENTITLEMENT',basisRef:licence.consumer_storage_basis_ref,licenceVersion:String(licence.version)};
}
export function catalogueStorageProjection(licence,family){
 if(family!=='data-catalog'||licence.allow_catalog_inventory!==true)return null;
 if(licence.consumer_access_mode!=='SPENDGURU_PRODUCT'||!['eia','cftc','commodities-sh'].includes(licence.provider_id)||typeof licence.licence_ref!=='string'||!licence.licence_ref.length||!/^([1-9][0-9]*)$/.test(String(licence.version)))throw new SourceHubError('LICENCE_STORAGE_PROJECTION_INVALID',403);
 return {mode:'CATALOG_METADATA_ONLY',basisRef:licence.licence_ref,licenceVersion:String(licence.version)};
}
async function scheduleStorageProjection(t,configuration,context,licence,request,consumer){
 if(request.contractVersion==='1.4.0'){
  if(configuration.ecrResultsStorageEnabled!==true||context.actorKind!=='SERVICE'||consumer.applicationId!=='profitia-economic-calendar-runtime-development'
   ||request.provider!=='eia'||request.family!=='series-observations'||licence.consumer_access_mode!=='SPENDGURU_PRODUCT')throw new SourceHubError('DURABLE_STORAGE_NOT_ADMITTED',403);
  await t.query("SELECT pg_advisory_xact_lock_shared(hashtextextended('ecr-result-storage:'||$1,0))",[request.criteria.path]);
  const {rows:[r]}=await t.query('SELECT * FROM source_hub.result_consumer_storage WHERE consumer_application_id=$1 AND provider_id=$2 AND family=$3 AND dataset_id=$4',[consumer.applicationId,request.provider,request.family,request.criteria.path]);
  const c=request.criteria,facets=c.facets??{};
  if(!r||r.status!=='ACTIVE'||c.frequency!==r.frequency||c.data.length!==r.fields.length||c.data.some(f=>!r.fields.includes(f))
    ||!Array.isArray(facets.series)||!facets.series.length||facets.series.some(s=>!r.series_ids.includes(s))
    ||Object.keys(facets).some(k=>!['series','duoarea'].includes(k))||facets.duoarea&&(facets.duoarea.length!==1||facets.duoarea[0]!==r.geography))throw new SourceHubError('RESULT_STORAGE_SCOPE_NOT_ADMITTED',403);
  return {mode:'DURABLE_OWNER_ENTITLEMENT',basisRef:r.basis_ref,licenceVersion:String(licence.version),rightsVersion:String(r.version),consumerApplicationId:consumer.applicationId,retentionMode:r.retention_mode,redistribution:r.redistribution,
   scope:{datasetId:r.dataset_id,seriesIds:facets.series,fields:r.fields,frequency:r.frequency,geography:r.geography}};
 }
 if(!['1.3.0','1.5.0'].includes(request.contractVersion))return null;
 if(request.contractVersion==='1.5.0'&&configuration.eiaExpandedSchedulesEnabled!==true)throw new SourceHubError('PROVIDER_NOT_ACTIVATED',503);
 if(configuration.calendarConsumerStorageEnabled!==true||context.actorKind!=='SERVICE'||consumer.applicationId!=='profitia-economic-calendar-runtime-development'
  ||request.family!=='publication-calendar'||!['eia','commodities-sh'].includes(request.provider)||licence.consumer_access_mode!=='SPENDGURU_PRODUCT')throw new SourceHubError('DURABLE_STORAGE_NOT_ADMITTED',403);
 await t.query("SELECT pg_advisory_xact_lock_shared(hashtextextended('calendar-consumer-storage:'||$1||':'||$2,0))",[consumer.applicationId,request.provider]);
 const {rows:[r]}=await t.query('SELECT version,status,basis_ref,retention_mode,redistribution FROM source_hub.calendar_consumer_storage WHERE consumer_application_id=$1 AND provider_id=$2 AND family=$3',[consumer.applicationId,request.provider,request.family]);
 if(!r||r.status!=='ACTIVE')throw new SourceHubError('DURABLE_STORAGE_NOT_ADMITTED',403);
 return {mode:'DURABLE_OWNER_ENTITLEMENT',basisRef:r.basis_ref,licenceVersion:String(licence.version),rightsVersion:String(r.version),consumerApplicationId:consumer.applicationId,retentionMode:r.retention_mode,redistribution:r.redistribution};
}
export function createRepository(configuration,database){
 const extensionDigest=hash(readFileSync(new URL('../migrations/002-te-news.sql',import.meta.url)));
 async function licence(transaction,provider,family,consumer){
  const r=await transaction.query('SELECT * FROM source_hub.current_licence($1,$2,$3)',[provider,family,consumer]);
  if(r.rows.length!==1)throw new SourceHubError('LICENCE_ADMISSION_REQUIRED',403);return r.rows[0];
 }
 async function begin(transaction,context,request,consumer,idempotencyKey){
  if(['1.3.0','1.4.0'].includes(request.contractVersion))throw new SourceHubError('FIRST_PARTY_SERVICE_REQUIRED',403);
  if(typeof idempotencyKey!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(idempotencyKey))throw new SourceHubError('IDEMPOTENCY_KEY_REQUIRED');
  const l=await licence(transaction,request.provider,request.family,consumer),s=scope(context),key=hash(idempotencyKey),digest=operationPayloadDigest(request);
  if(request.provider==='trading-economics'&&request.family==='external-forecasts'&&request.criteria.forecastType==='markets'&&l.allow_market_forecasts!==true)throw new SourceHubError('LICENCE_ADMISSION_REQUIRED',403);
  // Serialize only this private intent. Different users/apps/organisations never share a key.
  await transaction.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[JSON.stringify([...s,consumer,key])]);
  const r=await transaction.query('SELECT * FROM source_hub.acquisitions WHERE '+where+' AND consumer_application_id=$5 AND idempotency_digest=$6 FOR UPDATE',[...s,consumer,key]);
  if(r.rows.length){const a=r.rows[0];if(a.request_digest!==digest)throw new SourceHubError('IDEMPOTENCY_CONFLICT',409);
   if(a.status==='PENDING')throw new SourceHubError('ACQUISITION_IN_PROGRESS',409);
   if(a.status!=='SUCCEEDED')throw new SourceHubError(a.status==='UNCERTAIN'?'EXTERNAL_RESULT_UNVERIFIED':'PREVIOUS_ATTEMPT_FAILED',409);
   if(a.licence_ref!==l.licence_ref||String(a.licence_version)!==String(l.version)||!a.result||!a.retention_until||new Date(a.retention_until).getTime()<=Date.now())throw new SourceHubError('RESULT_NOT_RETAINED',409);
   const body=structuredClone(a.result);body.usage={...body.usage,upstreamAttempts:0,cacheHit:true};return {kind:'replay',body,licence:l};
  }
  const a={id:randomUUID(),intentKey:randomBytes(32).toString('hex')};
  await transaction.query('INSERT INTO source_hub.acquisitions(id,environment,application_id,organisation_id,owner_user_id,actor_id,consumer_application_id,provider_id,family,idempotency_digest,request_digest,intent_key,status,licence_ref,licence_version) VALUES($5::uuid,$1,$2,$3::uuid,$4::uuid,$6::uuid,$7,$8,$9,$10,$11,$12,\'PENDING\',$13,$14)',[...s,a.id,context.actorId,consumer,request.provider,request.family,key,digest,a.intentKey,l.licence_ref,l.version]);
  return {kind:'new',...a,licence:l};
 }
 async function complete(transaction,context,acquisition,request,consumer,body,evidence){
  const l=await licence(transaction,request.provider,request.family,consumer);
  if(l.licence_ref!==acquisition.licence.licence_ref||String(l.version)!==String(acquisition.licence.version)||l.source_policy_id!==acquisition.licence.source_policy_id)throw new SourceHubError('LICENCE_CHANGED',403);
  const s=scope(context),until=l.retention_seconds>0?new Date(Math.min(Date.now()+l.retention_seconds*1000,new Date(l.expires_at).getTime())).toISOString():null;
  const receipt=evidence?.callId??null;
  body.provenance.licenceRef=l.licence_ref;body.usage.receiptRef=receipt;
  for(const item of body.items){const storage=calendarStorageProjection(l,request.family)??catalogueStorageProjection(l,request.family);if(storage)item.metadata.consumerStorage=storage;item.metadata.licenceRef=l.licence_ref;item.metadata.usageReceiptRef=receipt;item.metadata.retentionUntil=until;item.metadata.redistribution='PRIVATE_AUTHORISED_CONSUMER_ONLY';
   if(until)await transaction.query('INSERT INTO source_hub.source_records(id,environment,application_id,organisation_id,owner_user_id,source_record_ref,provider_id,family,vendor_record_id,licence_ref,content_fingerprint,metadata,payload,retrieved_at,retention_until) VALUES($5::uuid,$1,$2,$3::uuid,$4::uuid,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14::timestamptz,$15::timestamptz) ON CONFLICT(environment,application_id,organisation_id,owner_user_id,licence_ref,source_record_ref) DO UPDATE SET metadata=excluded.metadata,payload=excluded.payload,retention_until=excluded.retention_until',[...s,randomUUID(),item.metadata.sourceRecordRef,request.provider,request.family,item.metadata.vendorRecordId,l.licence_ref,item.metadata.contentFingerprint,JSON.stringify(item.metadata),JSON.stringify(item.payload),item.metadata.retrievedAt,until]);
  }
  const r=await transaction.query('UPDATE source_hub.acquisitions SET status=\'SUCCEEDED\',result=$6::jsonb,completed_at=clock_timestamp(),retention_until=$7::timestamptz WHERE '+where+' AND id=$5::uuid AND status=\'PENDING\' RETURNING id',[...s,acquisition.id,until?JSON.stringify(body):null,until]);
  if(r.rows.length!==1)throw new SourceHubError('ACQUISITION_CONFLICT',409);
  await transaction.query('INSERT INTO source_hub.provider_usage(acquisition_id,environment,application_id,organisation_id,owner_user_id,provider_id,family,upstream_attempts,outcome,receipt_ref) VALUES($5::uuid,$1,$2,$3::uuid,$4::uuid,$6,$7,1,\'RESPONSE\',$8)',[...s,acquisition.id,request.provider,request.family,receipt]);return body;
 }
 async function failed(transaction,context,acquisition,request,error,attempt){
  const s=scope(context),uncertain=!['NOT_SENT','RESPONSE'].includes(attempt?.certainty??'UNVERIFIED');
  await transaction.query('UPDATE source_hub.acquisitions SET status=$6,error_code=$7,completed_at=clock_timestamp() WHERE '+where+' AND id=$5::uuid AND status=\'PENDING\'',[...s,acquisition.id,uncertain?'UNCERTAIN':'FAILED',error.code??'PROVIDER_UNAVAILABLE']);
  await transaction.query('INSERT INTO source_hub.provider_usage(acquisition_id,environment,application_id,organisation_id,owner_user_id,provider_id,family,upstream_attempts,outcome,receipt_ref) VALUES($5::uuid,$1,$2,$3::uuid,$4::uuid,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING',[...s,acquisition.id,request.provider,request.family,attempt?.upstreamAttempts??null,attempt?.certainty==='RESPONSE'?'RESPONSE':uncertain?'UNVERIFIED':'NOT_SENT',attempt?.value?.callId??null]);
 }
 async function ready(){try{await database.verifyLogin();if(configuration.commodityProviders?.length){const e=await database.query('SELECT digest FROM source_hub.migrations WHERE version=$1',['006-commodity-providers']);if(e.rows.length!==1||e.rows[0].digest!==hash(readFileSync(new URL('../migrations/006-commodity-providers.sql',import.meta.url))))return false;}if(configuration.eiaSchedulesEnabled===true){const e=await database.query('SELECT digest FROM source_hub.migrations WHERE version=$1',['007-publication-schedules']);if(e.rows.length!==1||e.rows[0].digest!==hash(readFileSync(new URL('../migrations/007-publication-schedules.sql',import.meta.url))))return false;}const r=await database.query('SELECT schema_version,environment,application_id,project_id,branch_id,database_name FROM source_hub.installation WHERE singleton');const i=r.rows[0],extension=await database.query('SELECT digest FROM source_hub.migrations WHERE version=$1',['002-te-news']);return !!i&&i.schema_version==='1.0.0'&&i.environment===configuration.environment&&i.application_id===configuration.applicationId&&i.project_id===configuration.projectId&&i.branch_id===configuration.branchId&&i.database_name===configuration.databaseName&&extension.rows.length===1&&extension.rows[0].digest===extensionDigest;}catch{return false;}}
 return Object.freeze({licence,begin,complete,failed,ready});
}

// Same provider/licence/Source model; a separate additive ledger preserves the
// historical human-only keys without inventing a user for a SERVICE execution.
export function createFirstPartyRepository(configuration,database){
 const s=(c,consumer)=>[c.environment,c.applicationId,c.organisationId,c.actorKind,c.actorId,consumer.componentId];
 const w='environment=$1 AND application_id=$2 AND organisation_id=$3::uuid AND actor_kind=$4 AND actor_id=$5::uuid AND component_id=$6';
 const cols='environment,application_id,organisation_id,actor_kind,actor_id,component_id';
 const vals='$1,$2,$3::uuid,$4,$5::uuid,$6';
 async function licence(t,provider,family){const r=await t.query('SELECT * FROM source_hub.current_first_party_licence($1,$2)',[provider,family]);if(r.rows.length!==1)throw new SourceHubError('LICENCE_ADMISSION_REQUIRED',403);return r.rows[0];}
 async function begin(t,c,request,consumer,idempotencyKey){
  if(consumer.applicationId==='profitia-economic-calendar-runtime-development'&&request.provider==='eia'&&request.family==='series-observations'&&request.contractVersion!=='1.4.0')throw new SourceHubError('DURABLE_RESULT_CONTRACT_REQUIRED',403);
  if(typeof idempotencyKey!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(idempotencyKey))throw new SourceHubError('IDEMPOTENCY_KEY_REQUIRED');
  const l=await licence(t,request.provider,request.family),scope=s(c,consumer),key=hash(idempotencyKey),digest=operationPayloadDigest(request);
  const scheduleStorage=await scheduleStorageProjection(t,configuration,c,l,request,consumer);
  if(request.provider==='trading-economics'&&request.family==='external-forecasts'&&request.criteria.forecastType==='markets'&&l.allow_market_forecasts!==true)throw new SourceHubError('LICENCE_ADMISSION_REQUIRED',403);
  await t.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[JSON.stringify([...scope,key])]);
  const {rows}=await t.query('SELECT * FROM source_hub.first_party_acquisitions WHERE '+w+' AND idempotency_digest=$7 FOR UPDATE',[...scope,key]);
  if(rows.length){const a=rows[0];if(a.request_digest!==digest)throw new SourceHubError('IDEMPOTENCY_CONFLICT',409);if(a.status==='PENDING')throw new SourceHubError('ACQUISITION_IN_PROGRESS',409);if(a.status!=='SUCCEEDED')throw new SourceHubError(a.status==='UNCERTAIN'?'EXTERNAL_RESULT_UNVERIFIED':'PREVIOUS_ATTEMPT_FAILED',409);
   if(a.licence_ref!==l.licence_ref||String(a.licence_version)!==String(l.version)||!a.result||!a.retention_until||new Date(a.retention_until).getTime()<=Date.now())throw new SourceHubError('RESULT_NOT_RETAINED',409);
   const body=structuredClone(a.result);body.usage={...body.usage,upstreamAttempts:0,cacheHit:true};return {kind:'replay',body,licence:l};}
  const a={id:randomUUID(),intentKey:randomBytes(32).toString('hex')};
  await t.query('INSERT INTO source_hub.first_party_acquisitions('+cols+',id,consumer_application_id,provider_id,family,idempotency_digest,request_digest,intent_key,status,licence_ref,licence_version) VALUES('+vals+',$7::uuid,$8,$9,$10,$11,$12,$13,\'PENDING\',$14,$15)',[...scope,a.id,consumer.applicationId,request.provider,request.family,key,digest,a.intentKey,l.licence_ref,l.version]);return {kind:'new',...a,licence:l,scheduleStorage};
 }
 async function complete(t,c,a,request,consumer,body,evidence){
  const l=await licence(t,request.provider,request.family);if(l.licence_ref!==a.licence.licence_ref||String(l.version)!==String(a.licence.version)||l.source_policy_id!==a.licence.source_policy_id)throw new SourceHubError('LICENCE_CHANGED',403);
  const scheduleStorage=await scheduleStorageProjection(t,configuration,c,l,request,consumer);
  if(JSON.stringify(scheduleStorage)!==JSON.stringify(a.scheduleStorage??null))throw new SourceHubError('LICENCE_CHANGED',403);
  const scope=s(c,consumer),until=l.retention_seconds>0?new Date(Math.min(Date.now()+l.retention_seconds*1000,new Date(l.expires_at).getTime())).toISOString():null,receipt=evidence?.callId??null;
  body.provenance.licenceRef=l.licence_ref;body.usage.receiptRef=receipt;
  for(const item of body.items){const storage=scheduleStorage??calendarStorageProjection(l,request.family)??catalogueStorageProjection(l,request.family);if(storage)item.metadata.consumerStorage=storage;Object.assign(item.metadata,{licenceRef:l.licence_ref,usageReceiptRef:receipt,retentionUntil:until,redistribution:'PRIVATE_AUTHORISED_CONSUMER_ONLY'});
   if(until)await t.query('INSERT INTO source_hub.first_party_records('+cols+',id,source_record_ref,provider_id,family,vendor_record_id,licence_ref,content_fingerprint,metadata,payload,retrieved_at,retention_until) VALUES('+vals+',$7::uuid,$8,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16::timestamptz,$17::timestamptz) ON CONFLICT(environment,application_id,organisation_id,actor_kind,actor_id,component_id,licence_ref,source_record_ref) DO UPDATE SET metadata=excluded.metadata,payload=excluded.payload,retention_until=excluded.retention_until',[...scope,randomUUID(),item.metadata.sourceRecordRef,request.provider,request.family,item.metadata.vendorRecordId,l.licence_ref,item.metadata.contentFingerprint,JSON.stringify(item.metadata),JSON.stringify(item.payload),item.metadata.retrievedAt,until]);}
  const r=await t.query('UPDATE source_hub.first_party_acquisitions SET status=\'SUCCEEDED\',result=$8::jsonb,completed_at=clock_timestamp(),retention_until=$9::timestamptz WHERE '+w+' AND id=$7::uuid AND status=\'PENDING\' RETURNING id',[...scope,a.id,until?JSON.stringify(body):null,until]);if(r.rows.length!==1)throw new SourceHubError('ACQUISITION_CONFLICT',409);
  await t.query('INSERT INTO source_hub.first_party_usage('+cols+',acquisition_id,provider_id,family,upstream_attempts,outcome,receipt_ref) VALUES('+vals+',$7::uuid,$8,$9,1,\'RESPONSE\',$10)',[...scope,a.id,request.provider,request.family,receipt]);return body;
 }
 async function failed(t,c,a,request,error,attempt,consumer){
  const scope=s(c,consumer),uncertain=!['NOT_SENT','RESPONSE'].includes(attempt?.certainty??'UNVERIFIED');
  await t.query('UPDATE source_hub.first_party_acquisitions SET status=$8,error_code=$9,completed_at=clock_timestamp() WHERE '+w+' AND id=$7::uuid AND status=\'PENDING\'',[...scope,a.id,uncertain?'UNCERTAIN':'FAILED',error.code??'PROVIDER_UNAVAILABLE']);
  await t.query('INSERT INTO source_hub.first_party_usage('+cols+',acquisition_id,provider_id,family,upstream_attempts,outcome,receipt_ref) VALUES('+vals+',$7::uuid,$8,$9,$10,$11,$12) ON CONFLICT DO NOTHING',[...scope,a.id,request.provider,request.family,attempt?.upstreamAttempts??null,attempt?.certainty==='RESPONSE'?'RESPONSE':uncertain?'UNVERIFIED':'NOT_SENT',attempt?.value?.callId??null]);
 }
 const migrationDigest=hash(readFileSync(new URL('../migrations/004-universal-consumers.sql',import.meta.url)));
 return Object.freeze({licence,begin,complete,failed,async ready(){try{if(!await createRepository(configuration,database).ready())return false;if(configuration.ecrResultsStorageEnabled===true){const x=await database.query('SELECT digest FROM source_hub.migrations WHERE version=$1',['009-ecr-results-storage']);if(x.rows[0]?.digest!==hash(readFileSync(new URL('../migrations/009-ecr-results-storage.sql',import.meta.url))))return false;}if(configuration.calendarConsumerStorageEnabled===true){const x=await database.query('SELECT digest FROM source_hub.migrations WHERE version=$1',['008-calendar-consumer-storage']);if(x.rows[0]?.digest!==hash(readFileSync(new URL('../migrations/008-calendar-consumer-storage.sql',import.meta.url))))return false;}if(configuration.eiaExpandedSchedulesEnabled===true){for(const version of ['011-expanded-ecr-results','012-calendar-transport-continuity']){const e=await database.query('SELECT digest FROM source_hub.migrations WHERE version=$1',[version]);if(e.rows[0]?.digest!==hash(readFileSync(new URL('../migrations/'+version+'.sql',import.meta.url))))return false;}}const r=await database.query('SELECT digest FROM source_hub.migrations WHERE version=$1',['004-universal-consumers']);return r.rows.length===1&&r.rows[0].digest===migrationDigest;}catch{return false;}}});
}
