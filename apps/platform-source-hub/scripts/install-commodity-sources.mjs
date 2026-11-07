// Owner-only, explicit activation; never imported by application startup.
import {createHash} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {COMMODITY_SOURCE_DEFINITIONS,sourceDefinition} from '../src/admission.mjs'
const hash=v=>createHash('sha256').update(v).digest('hex')
export async function installCommoditySources(client,plan,{expectedPlanDigest,ownerDecisionRef,configurationVersion}){
 if(hash(JSON.stringify(plan))!==expectedPlanDigest||!/^owner-decision:sha256:[a-f0-9]{64}$/.test(ownerDecisionRef??'')||!/^[A-Za-z0-9._:-]{1,256}$/.test(configurationVersion??''))throw Error('EXACT_OWNER_APPROVAL_REQUIRED')
 if(plan.status!=='PROPOSED_NOT_ACTIVATED'||plan.environment!=='development'||plan.projectId!=='delicate-queen-44677134'||plan.branchId!=='br-orange-salad-ba2llks7'||plan.databaseName!=='neondb'||plan.applicationId!=='profitia-source-hub-development'||plan.sourceRole!=='source_hub_development_source_runtime'||plan.sourceQuotaMode!=='UNMETERED'||plan.retentionSeconds!==0||plan.automaticRetry!==false||!Number.isFinite(Date.parse(plan.expiresAt))||Date.parse(plan.expiresAt)<=Date.now()+600000||plan.sources.length!==6||new Set(plan.sources.map(s=>s.provider+':'+s.family)).size!==6||plan.sources.some(s=>!Object.hasOwn(COMMODITY_SOURCE_DEFINITIONS,s.provider+':'+s.family)))throw Error('EXACT_DEVELOPMENT_PLAN_REQUIRED')
 const sources=plan.sources.map(s=>({...s,definition:sourceDefinition(s.provider,s.family)}))
 if(sources.some(s=>s.sourceId!==s.definition.sourceId||s.resourceId!==s.definition.resourceId||s.allowCatalogInventory!==(s.family==='data-catalog')))throw Error('SOURCE_BINDING_MISMATCH')
 await client.query('BEGIN')
 try{
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('source-hub-commodity-activation-v1',0))")
  const {rows:[login]}=await client.query("SELECT current_user AS role,session_user AS login,current_database() AS database")
  if(login?.role!=='source_hub_development_migrator'||login.login!==login.role||login.database!=='neondb')throw Error('ORDINARY_BOUND_MIGRATOR_REQUIRED')
  await client.query('SET LOCAL ROLE source_hub_development_owner')
  const {rows:[installation]}=await client.query('SELECT * FROM source_hub.installation WHERE singleton')
  if(!installation||['environment','project_id','branch_id','database_name','application_id'].some(k=>installation[k]!==({environment:plan.environment,project_id:plan.projectId,branch_id:plan.branchId,database_name:plan.databaseName,application_id:plan.applicationId})[k]))throw Error('EXACT_PHYSICAL_INSTALLATION_REQUIRED')
  const {rows:[migration]}=await client.query("SELECT digest FROM source_hub.migrations WHERE version='006-commodity-providers'")
  if(migration?.digest!==hash(await readFile(new URL('../migrations/006-commodity-providers.sql',import.meta.url))))throw Error('ACCEPTED_COMMODITY_MIGRATION_REQUIRED')
  const {rows:[oldLicences]}=await client.query("SELECT jsonb_agg(to_jsonb(l) ORDER BY provider_id,family) AS value FROM source_hub.provider_licences l WHERE provider_id NOT IN('eia','cftc','commodities-sh')")
  await client.query('SET LOCAL ROLE profitia_ingestion_owner')
  const {rows:[binding]}=await client.query('SELECT * FROM profitia_ingestion.runtime_bindings WHERE login_role=$1',[plan.sourceRole])
  if(binding?.status!=='ACTIVE'||binding.application_id!==plan.applicationId||binding.configuration_version!==configurationVersion||new Date(binding.expires_at).getTime()<Date.parse(plan.expiresAt))throw Error('CURRENT_EXISTING_SOURCE_BINDING_REQUIRED')
  const {rows:[previous]}=await client.query('SELECT jsonb_agg(to_jsonb(p) ORDER BY policy_id) AS value FROM profitia_external_call.policies p')
  const expiry=plan.expiresAt
  for(const s of sources){
   if((await client.query('SELECT 1 FROM profitia_ingestion.sources WHERE source_id=$1',[s.sourceId])).rowCount)throw Error('SOURCE_EXISTS_RECONCILE_WITHOUT_OVERWRITE')
   await client.query("INSERT INTO profitia_ingestion.sources(source_id,effect_kind,data_class,payload_schema,quality_version,classification_version,projection_version,status,source_ref,expires_at) VALUES($1,'STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE','external-call-control-v1','source-hub-api-control-v1','TECHNICAL_CONTROL_NO_PRIVATE_DATA','source-receipt-v1','ACTIVE',$2,$3)",[s.sourceId,ownerDecisionRef,expiry])
   await client.query("INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,resource_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'ALLOW','ACTIVE',$5,$6)",[s.grantId,plan.sourceRole,s.sourceId,s.resourceId,ownerDecisionRef,expiry])
   await client.query("INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,quota_mode,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,$2,$3,'SOURCE_TRANSACTION','UNMETERED',NULL,NULL,NULL,NULL,'ACTIVE',$4)",[s.budgetId,plan.applicationId,s.sourceId,ownerDecisionRef])
   await client.query("INSERT INTO profitia_external_call.policies(policy_id,login_role,source_id,resource_id,configuration_version,origin,transport,path_rules,maximum_request_bytes,maximum_response_bytes,timeout_ms,unit,quota_mode,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,$2,$3,$4,$5,$6,'HTTPS',$7::jsonb,16384,2097152,15000,'UPSTREAM_ATTEMPT_ADMISSION','UNMETERED',NULL,NULL,NULL,NULL,'ACTIVE',$8)",[s.policyId,plan.sourceRole,s.sourceId,s.resourceId,configurationVersion,s.definition.origin,JSON.stringify(s.definition.pathRules),ownerDecisionRef])
   await client.query("INSERT INTO profitia_external_native.policies(policy_id,base_policy_version,path_rules,redirect_origins,maximum_response_bytes,credential_mode,completion_mode,status,expires_at,source_ref) VALUES($1,1,$2::jsonb,'[]',2097152,'SERVER_HEADERS','ADMITTED_ATTEMPT_CURRENT_SETTLEMENT','ACTIVE',$3,$4)",[s.policyId,JSON.stringify(s.definition.nativePathRules),expiry,ownerDecisionRef])
  }
  const {rows:[preserved]}=await client.query('SELECT jsonb_agg(to_jsonb(p) ORDER BY policy_id) AS value FROM profitia_external_call.policies p WHERE NOT(source_id=ANY($1::text[]))',[sources.map(s=>s.sourceId)])
  // Ignore concurrently increasing historical counters only; locking all old
  // policies would unnecessarily block unrelated acquisitions.
  const stable=rows=>(rows??[]).map(({admitted_count,...p})=>p)
  if(JSON.stringify(stable(previous.value))!==JSON.stringify(stable(preserved.value)))throw Error('EXISTING_SOURCE_POLICIES_CHANGED')
  await client.query('SET LOCAL ROLE source_hub_development_owner')
  for(const s of sources)await client.query("INSERT INTO source_hub.provider_licences(provider_id,family,licence_ref,version,source_id,resource_id,source_policy_id,private_consumer_use,consumer_application_ids,retention_seconds,redistribution,status,expires_at,consumer_access_mode,allow_catalog_inventory) VALUES($1,$2,$3,1,$4,$5,$6,true,ARRAY['profitia-source-hub-catalogue-development'],0,'PRIVATE_AUTHORISED_CONSUMER_ONLY','ACTIVE',$7,'SPENDGURU_PRODUCT',$8)",[s.provider,s.family,s.licenceRef,s.sourceId,s.resourceId,s.policyId,expiry,s.allowCatalogInventory])
  const {rows:[after]}=await client.query("SELECT jsonb_agg(to_jsonb(l) ORDER BY provider_id,family) AS value FROM source_hub.provider_licences l WHERE provider_id NOT IN('eia','cftc','commodities-sh')")
  if(JSON.stringify(oldLicences.value)!==JSON.stringify(after.value))throw Error('EXISTING_LICENCES_CHANGED')
  const {rows}=await client.query("SELECT provider_id,family,source_id,resource_id,source_policy_id,version,retention_seconds,allow_catalog_inventory FROM source_hub.provider_licences WHERE provider_id IN('eia','cftc','commodities-sh') ORDER BY provider_id,family")
  if(rows.length!==6)throw Error('SOURCE_READBACK_FAILED')
  await client.query('COMMIT');return {status:'ACTIVATED',sources:rows,planDigest:expectedPlanDigest,ownerDecisionRef}
 }catch(error){await client.query('ROLLBACK');throw error}
}
