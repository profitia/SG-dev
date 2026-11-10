// SYNTHETIC_ONLY. Full current E1 + Source Admission + real SQL, offline EIA HTTP.
import test from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import {readFileSync} from 'node:fs'
import {createHash,randomUUID,generateKeyPairSync} from 'node:crypto'
import {consumerFixture} from './first-party-fixtures.mjs'
import {A} from '../../../packages/platform-contracts/test/fixtures/first-party-source-postgres.mjs'
import {createAdmission,sourceDefinition} from '../src/admission.mjs'
import {createApplication} from '../src/server.mjs'
import {createConsumerAccess} from '../src/consumer-access.mjs'
import {createFirstPartySourceHubClient} from '@profitia/platform-source-hub-contracts/client'
const load=p=>readFileSync(new URL(p,import.meta.url),'utf8'),hash=s=>createHash('sha256').update(s).digest('hex')
test('only ECR SERVICE receives exact licensed result projection; Source/E1/revocation hold and Hub retains no numeric payload',async t=>{
 const f=await consumerFixture(),originalFetch=globalThis.fetch;let installer;t.after(async()=>{globalThis.fetch=originalFetch;await installer?.end();await f.close()})
 try{
 const {source,e1}=f,config={...source.hub,commodityProviders:['eia','commodities-sh'],eiaSchedulesEnabled:true,calendarConsumerStorageEnabled:true,ecrResultsStorageEnabled:true,secrets:{...source.hub.secrets,eia:'SYNTHETIC_ONLY_UNUSED_EIA_KEY'}}
 await source.admin(0,'profitia_ingestion_owner',async q=>{await q.query("UPDATE profitia_ingestion.runtime_bindings SET status='REVOKED'");const s=load('../../../packages/platform-contracts/migrations/access/024-unmetered-public-sources.sql');await q.query("SELECT set_config('profitia.install.unmetered_digest',$1,true)",[hash(s)]);await q.query(s);await q.query("UPDATE profitia_ingestion.runtime_bindings SET status='ACTIVE'")})
 await e1.asOwner(1,async q=>{for(const v of ['006-commodity-providers','007-publication-schedules','008-calendar-consumer-storage','009-ecr-results-storage']){const s=load('../migrations/'+v+'.sql');await q.query(s);await q.query('INSERT INTO source_hub.migrations VALUES($1,$2)',[v,hash(s)])}},'source_hub_development_owner')
 const u=new URL(process.env.SOURCE_HUB_TEST_ADMIN_URL);u.pathname='/'+source.hub.databaseName;installer=new pg.Client({connectionString:u.href,ssl:false});await installer.connect()
 const d=sourceDefinition('eia','series-observations'),policy=randomUUID()
 await installer.query('BEGIN');try{
  await installer.query('SET LOCAL ROLE profitia_ingestion_owner')
  await installer.query("INSERT INTO profitia_ingestion.sources(source_id,effect_kind,data_class,payload_schema,quality_version,classification_version,projection_version,status,source_ref,expires_at) VALUES($1,'STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE','external-call-control-v1','source-hub-api-control-v1','TECHNICAL_CONTROL_NO_PRIVATE_DATA','source-receipt-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[d.sourceId])
  await installer.query("INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,resource_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'ALLOW','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[randomUUID(),config.sourceRole,d.sourceId,d.resourceId])
  await installer.query("INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,quota_mode,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,$2,$3,'SOURCE_TRANSACTION','UNMETERED',NULL,NULL,NULL,NULL,'ACTIVE','SYNTHETIC_ONLY')",[randomUUID(),config.applicationId,d.sourceId])
  await installer.query("INSERT INTO profitia_external_call.policies(policy_id,login_role,source_id,resource_id,configuration_version,origin,transport,path_rules,maximum_request_bytes,maximum_response_bytes,timeout_ms,unit,quota_mode,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,$2,$3,$4,$5,$6,'HTTPS',$7::jsonb,16384,2097152,15000,'UPSTREAM_ATTEMPT_ADMISSION','UNMETERED',NULL,NULL,NULL,NULL,'ACTIVE','SYNTHETIC_ONLY')",[policy,config.sourceRole,d.sourceId,d.resourceId,config.configurationVersion,d.origin,JSON.stringify(d.pathRules)])
  await installer.query("INSERT INTO profitia_external_native.policies(policy_id,base_policy_version,path_rules,redirect_origins,maximum_response_bytes,credential_mode,completion_mode,status,expires_at,source_ref) VALUES($1,1,$2::jsonb,'[]',2097152,'SERVER_HEADERS','ADMITTED_ATTEMPT_CURRENT_SETTLEMENT','ACTIVE',now()+interval '1 hour','SYNTHETIC_ONLY')",[policy,JSON.stringify(d.nativePathRules)])
  await installer.query('COMMIT')
 }catch(e){await installer.query('ROLLBACK');throw e}
 await e1.asOwner(1,q=>q.query("INSERT INTO source_hub.provider_licences(provider_id,family,licence_ref,version,source_id,resource_id,source_policy_id,private_consumer_use,consumer_application_ids,retention_seconds,redistribution,status,expires_at,consumer_access_mode) VALUES('eia','series-observations','SYNTHETIC_ONLY',1,$1,$2,$3,true,ARRAY['SYNTHETIC_ONLY'],0,'PRIVATE_AUTHORISED_CONSUMER_ONLY','ACTIVE',now()+interval '1 hour','SPENDGURU_PRODUCT')",[d.sourceId,d.resourceId,policy]),'source_hub_development_owner')
 let calls=0,beforeReturn=null;globalThis.fetch=async(input,options)=>{
  const u=new URL(input instanceof Request?input.url:input);if(u.hostname!=='api.eia.gov')return originalFetch(input,options)
  calls++;assert.equal(u.searchParams.get('api_key'),'SYNTHETIC_ONLY_UNUSED_EIA_KEY');if(beforeReturn){const fn=beforeReturn;beforeReturn=null;await fn()}
  const r=Response.json({response:{total:'2',data:['WCESTUS1','WGTSTUS1'].map(series=>({period:'2026-11-06',series,duoarea:'NUS',value:'0',units:'MBBL'}))}});Object.defineProperty(r,'url',{value:u.href});return r
 }
 const configuration={...config,projectId:e1.bindings[1].projectId,branchId:e1.bindings[1].branchId,databaseName:e1.bindings[1].databaseName,configurationVersion:'fixture-v1',legacyPeerEnabled:false},admission=await createAdmission(config,source.sdb),access=await createConsumerAccess(configuration,e1.db(1),{fetch:e1.sourceTransport}),app=createApplication({configuration,authorizer:null,repository:null,consumerAccess:access,admission})
 const command={contractVersion:'1.4.0',provider:'eia',family:'series-observations',operation:'observations',criteria:{path:'petroleum/stoc/wstk',frequency:'weekly',data:['value'],facets:{series:['WCESTUS1','WGTSTUS1'],duoarea:['NUS']},limit:10}},signed=await e1.makeSigned()
 const other=createFirstPartySourceHubClient(signed.configuration,{fetchImpl:r=>app.handle(r)})
 await assert.rejects(other.acquire({command,execution:{kind:'SERVICE',organisationId:A,grantId:e1.grantId},idempotencyKey:'SYNTHETIC_ONLY_OTHER_RESULT'}),{code:'DURABLE_STORAGE_NOT_ADMITTED'});assert.equal(calls,0)
 const role='economic_calendar_development_ingest',appId='profitia-economic-calendar-runtime-development',component='SYNTHETIC_ONLY_ECR_RESULTS',key=generateKeyPairSync('ed25519'),grant=randomUUID()
 if(!(await e1.databases[0].query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)await e1.databases[0].query('CREATE ROLE '+role+' LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION')
 await e1.asOwner(0,async q=>{
  await q.query("INSERT INTO profitia_access.applications(application_id,status) VALUES($1,'ACTIVE')",[appId]);await q.query("INSERT INTO profitia_access.runtime_bindings VALUES($1,$2,'ACTIVE')",[role,appId])
  await q.query("INSERT INTO profitia_services.runtime_bindings(login_role,binding_id,service_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,'SPENDGURU_SAAS','SYNTHETIC_ONLY','fixture-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[role,randomUUID(),randomUUID()])
  await q.query("INSERT INTO profitia_services.read_grants(grant_id,login_role,organisation_id,operation,feature,resource_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,'knowledge.read','market','api.eia.series-observations','ALLOW','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[grant,role,A])
  await q.query("INSERT INTO profitia_e1_authority.source_components(component_id,key_id,application_id,login_role,receiver_application_id,source_origin,public_key,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,'synthetic-ecr-key',$2,$3,$4,'urn:profitia:service:synthetic-ecr',$5,'SYNTHETIC_ONLY','fixture-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[component,appId,role,e1.apps[1],key.publicKey.export({type:'spki',format:'pem'})])
 })
 const client=createFirstPartySourceHubClient({...signed.configuration,consumerApplicationId:appId,componentId:component,sourceOrigin:'urn:profitia:service:synthetic-ecr',keyId:'synthetic-ecr-key',privateKey:key.privateKey},{fetchImpl:r=>app.handle(r)})
 const acquire=c=>client.acquire({command:c??command,execution:{kind:'SERVICE',organisationId:A,grantId:grant},idempotencyKey:'SYNTHETIC_ONLY_RESULT:'+randomUUID()})
 await assert.rejects(acquire({...command,contractVersion:'1.1.0'}),{code:'DURABLE_RESULT_CONTRACT_REQUIRED'});assert.equal(calls,0)
 await assert.rejects(acquire(),{code:'RESULT_STORAGE_SCOPE_NOT_ADMITTED'});assert.equal(calls,0)
 const plan=JSON.parse(load('../../economic-calendar-runtime/operations/stage04-05-owner-plan.json')),activation=load('../operations/activate-ecr-results.sql')
 assert.deepEqual(JSON.parse(activation.match(/expected jsonb:=\$plan\$([\s\S]*?)\$plan\$::jsonb/)[1]),plan)
 await e1.asOwner(1,async q=>{await q.query('UPDATE source_hub.installation SET project_id=$1,branch_id=$2',[plan.sourceHub.projectId,plan.sourceHub.branchId]);await q.query("UPDATE source_hub.provider_licences SET licence_ref=$1 WHERE provider_id='eia' AND family='series-observations'",[plan.numericStorage.licenceRef])},'source_hub_development_owner')
 const activate=p=>e1.asOwner(1,async q=>{await q.query("SELECT set_config('ecr.stage0405_plan',$1,true),set_config('ecr.stage0405_owner_ref',$2,true)",[JSON.stringify(p),'owner-decision:sha256:'+'1'.repeat(64)]);await q.query(activation)},'source_hub_development_owner')
 await assert.rejects(activate({...plan,numericStorage:{...plan.numericStorage,seriesIds:['UNAPPROVED']}}),/EXACT_STAGE0405_OWNER_DECISION_REQUIRED/)
 const licenceBefore=(await e1.asOwner(1,q=>q.query('SELECT to_jsonb(l) AS value FROM source_hub.provider_licences l ORDER BY provider_id,family'),'source_hub_development_owner')).rows
 await activate(plan);await assert.rejects(activate(plan),/ECR_RESULT_STORAGE_EXISTS_RECONCILE/)
 assert.deepEqual((await e1.asOwner(1,q=>q.query('SELECT to_jsonb(l) AS value FROM source_hub.provider_licences l ORDER BY provider_id,family'),'source_hub_development_owner')).rows,licenceBefore)
 await e1.asOwner(1,q=>q.query('UPDATE source_hub.installation SET project_id=$1,branch_id=$2',[e1.bindings[1].projectId,e1.bindings[1].branchId]),'source_hub_development_owner')
 const result=await acquire();assert.equal(result.items.length,2);assert.equal(result.contractVersion,'1.4.0');assert.equal(calls,1);assert.equal(result.items[0].metadata.retentionUntil,null);assert.equal(result.items[0].metadata.consumerStorage.scope.datasetId,'petroleum/stoc/wstk')
 assert(!JSON.stringify(result).includes('SYNTHETIC_ONLY_UNUSED_EIA_KEY'))
 await assert.rejects(acquire({...command,criteria:{...command.criteria,facets:{series:['ANOTHER_SERIES']}}}),{code:'RESULT_STORAGE_SCOPE_NOT_ADMITTED'});assert.equal(calls,1)
 beforeReturn=()=>e1.asOwner(1,q=>q.query("SELECT pg_advisory_xact_lock(hashtextextended('ecr-result-storage:petroleum/stoc/wstk',0));UPDATE source_hub.result_consumer_storage SET status='REVOKED',version=version+1"),'source_hub_development_owner')
 await assert.rejects(acquire(),{code:'RESULT_STORAGE_SCOPE_NOT_ADMITTED'});const end=calls;await assert.rejects(acquire());assert.equal(calls,end)
 const legacy=await other.acquire({command:{...command,contractVersion:'1.1.0'},execution:{kind:'SERVICE',organisationId:A,grantId:e1.grantId},idempotencyKey:'SYNTHETIC_ONLY_UNCHANGED_LEGACY'})
 assert.equal(legacy.items.length,2);assert.equal(legacy.items[0].metadata.consumerStorage,undefined);assert.equal(calls,end+1)
 const ledger=await e1.asOwner(1,q=>q.query("SELECT result,retention_until FROM source_hub.first_party_acquisitions WHERE family='series-observations'"),'source_hub_development_owner');assert(ledger.rows.every(r=>r.result===null&&r.retention_until===null))
 assert.equal(e1.clerkState.calls.length,0)
 }catch(error){console.error(error.stack);throw error}
})
