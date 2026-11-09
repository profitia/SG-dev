// Owner-only installation, never imported by application startup. No secrets.
import {createHash} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {sourceDefinition} from '../src/admission.mjs'
const hash=b=>createHash('sha256').update(b).digest('hex')
const expected=JSON.parse(await readFile(new URL('../operations/publication-schedule-owner-plan.json',import.meta.url),'utf8'))
export async function installPublicationScheduleSource(client,plan,{expectedPlanDigest,ownerDecisionRef}={}){
 if(JSON.stringify(plan)!==JSON.stringify(expected)||hash(JSON.stringify(plan))!==expectedPlanDigest||!/^owner-decision:sha256:[a-f0-9]{64}$/.test(ownerDecisionRef??''))throw Error('EXACT_OWNER_APPROVAL_REQUIRED')
 if(Date.parse(plan.expiresAt)<=Date.now()+600000)throw Error('CURRENT_APPROVAL_REQUIRED')
 const d=sourceDefinition('eia','publication-calendar'),s=plan.source
 if(d.sourceId!==s.sourceId||d.resourceId!==s.resourceId||d.origin!==s.origin||JSON.stringify(d.pathRules)!==JSON.stringify(s.pathRules))throw Error('EXACT_SOURCE_DEFINITION_REQUIRED')
 await client.query('BEGIN')
 try{
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('source-hub-stage2a-migrations',0))")
  const {rows:[login]}=await client.query('SELECT current_user AS role,session_user AS login,current_database() AS database')
  if(login?.role!=='source_hub_development_migrator'||login.login!==login.role||login.database!=='neondb')throw Error('ORDINARY_BOUND_MIGRATOR_REQUIRED')
  await client.query('SET LOCAL ROLE source_hub_development_owner')
  const {rows:[i]}=await client.query('SELECT * FROM source_hub.installation WHERE singleton')
  if(!i||i.environment!==plan.environment||i.project_id!==plan.projectId||i.branch_id!==plan.branchId||i.database_name!==plan.databaseName||i.application_id!==plan.applicationId)throw Error('EXACT_PHYSICAL_INSTALLATION_REQUIRED')
  const {rows:[migration]}=await client.query("SELECT digest FROM source_hub.migrations WHERE version='007-publication-schedules'")
  if(migration?.digest!==hash(await readFile(new URL('../migrations/007-publication-schedules.sql',import.meta.url))))throw Error('ACCEPTED_SCHEDULE_MIGRATION_REQUIRED')
  const before=(await client.query('SELECT to_jsonb(l) AS value FROM source_hub.provider_licences l ORDER BY provider_id,family')).rows
  if(before.some(r=>r.value.provider_id==='eia'&&r.value.family==='publication-calendar'))throw Error('SOURCE_EXISTS_RECONCILE_WITHOUT_OVERWRITE')
  await client.query('SET LOCAL ROLE profitia_ingestion_owner')
  const {rows:[binding]}=await client.query('SELECT * FROM profitia_ingestion.runtime_bindings WHERE login_role=$1',[plan.sourceRole])
  if(binding?.status!=='ACTIVE'||binding.application_id!==plan.applicationId||binding.configuration_version!==plan.configurationVersion||new Date(binding.expires_at).getTime()<Date.parse(plan.expiresAt))throw Error('CURRENT_EXISTING_SOURCE_BINDING_REQUIRED')
  const old=(await client.query('SELECT to_jsonb(p) AS value FROM profitia_external_call.policies p ORDER BY policy_id')).rows
  if((await client.query('SELECT 1 FROM profitia_ingestion.sources WHERE source_id=$1',[s.sourceId])).rowCount)throw Error('SOURCE_EXISTS_RECONCILE_WITHOUT_OVERWRITE')
  await client.query("INSERT INTO profitia_ingestion.sources(source_id,effect_kind,data_class,payload_schema,quality_version,classification_version,projection_version,status,source_ref,expires_at) VALUES($1,'STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE','external-call-control-v1','source-hub-api-control-v1','TECHNICAL_CONTROL_NO_PRIVATE_DATA','source-receipt-v1','ACTIVE',$2,$3)",[s.sourceId,ownerDecisionRef,plan.expiresAt])
  await client.query("INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,resource_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'ALLOW','ACTIVE',$5,$6)",[s.grantId,plan.sourceRole,s.sourceId,s.resourceId,ownerDecisionRef,plan.expiresAt])
  await client.query("INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,quota_mode,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,$2,$3,'SOURCE_TRANSACTION','UNMETERED',NULL,NULL,NULL,NULL,'ACTIVE',$4)",[s.budgetId,plan.applicationId,s.sourceId,ownerDecisionRef])
  await client.query("INSERT INTO profitia_external_call.policies(policy_id,login_role,source_id,resource_id,configuration_version,origin,transport,path_rules,maximum_request_bytes,maximum_response_bytes,timeout_ms,unit,quota_mode,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,$2,$3,$4,$5,$6,'HTTPS',$7::jsonb,16384,2097152,15000,'UPSTREAM_ATTEMPT_ADMISSION','UNMETERED',NULL,NULL,NULL,NULL,'ACTIVE',$8)",[s.policyId,plan.sourceRole,s.sourceId,s.resourceId,plan.configurationVersion,d.origin,JSON.stringify(d.pathRules),ownerDecisionRef])
  await client.query("INSERT INTO profitia_external_native.policies(policy_id,base_policy_version,path_rules,redirect_origins,maximum_response_bytes,credential_mode,completion_mode,status,expires_at,source_ref) VALUES($1,1,$2::jsonb,'[]',2097152,'SERVER_HEADERS','ADMITTED_ATTEMPT_CURRENT_SETTLEMENT','ACTIVE',$3,$4)",[s.policyId,JSON.stringify(d.nativePathRules),plan.expiresAt,ownerDecisionRef])
  const after=(await client.query('SELECT to_jsonb(p) AS value FROM profitia_external_call.policies p WHERE source_id<>$1 ORDER BY policy_id',[s.sourceId])).rows
  const stable=rows=>rows.map(r=>{const {admitted_count,...value}=r.value;return value})
  if(JSON.stringify(stable(old))!==JSON.stringify(stable(after)))throw Error('EXISTING_SOURCE_POLICIES_CHANGED')
  await client.query('SET LOCAL ROLE source_hub_development_owner')
  await client.query("INSERT INTO source_hub.provider_licences(provider_id,family,licence_ref,version,source_id,resource_id,source_policy_id,private_consumer_use,consumer_application_ids,retention_seconds,redistribution,status,expires_at,consumer_access_mode) VALUES('eia','publication-calendar',$1,1,$2,$3,$4,true,ARRAY['profitia-source-hub-catalogue-development'],0,'PRIVATE_AUTHORISED_CONSUMER_ONLY','ACTIVE',$5,'SPENDGURU_PRODUCT')",[s.licenceRef,s.sourceId,s.resourceId,s.policyId,plan.expiresAt])
  const preserved=(await client.query("SELECT to_jsonb(l) AS value FROM source_hub.provider_licences l WHERE NOT(provider_id='eia' AND family='publication-calendar') ORDER BY provider_id,family")).rows
  if(JSON.stringify(before)!==JSON.stringify(preserved))throw Error('EXISTING_LICENCES_CHANGED')
  const {rows:[readback]}=await client.query("SELECT source_id,resource_id,source_policy_id,retention_seconds,consumer_access_mode,expires_at FROM source_hub.provider_licences WHERE provider_id='eia' AND family='publication-calendar'")
  if(readback?.source_policy_id!==s.policyId||readback.retention_seconds!==0||new Date(readback.expires_at).toISOString()!==plan.expiresAt)throw Error('SOURCE_READBACK_FAILED')
  await client.query('COMMIT');return {status:'ACTIVATED',planDigest:expectedPlanDigest,ownerDecisionRef,source:readback}
 }catch(e){await client.query('ROLLBACK');throw e}
}
