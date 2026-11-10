// SYNTHETIC_ONLY: real PostgreSQL/current E1/Source, offline provider HTTP.
import test from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import {readFileSync} from 'node:fs'
import {createHash,randomUUID,generateKeyPairSync} from 'node:crypto'
import {consumerFixture} from './first-party-fixtures.mjs'
import {A,B} from '../../../packages/platform-contracts/test/fixtures/first-party-source-postgres.mjs'
import {createAdmission,sourceDefinition} from '../src/admission.mjs'
import {createApplication} from '../src/server.mjs'
import {createConsumerAccess} from '../src/consumer-access.mjs'
import {createFirstPartySourceHubClient} from '@profitia/platform-source-hub-contracts/client'
import {installPublicationScheduleSource} from '../scripts/install-publication-schedules.mjs'
const hash=b=>createHash('sha256').update(b).digest('hex'),load=p=>readFileSync(new URL(p,import.meta.url),'utf8')
const html='<html><h1>Weekly Petroleum Status Report Schedule</h1><p>The standard release time and day of the week will be at 10:30 a.m. eastern time on Wednesday with the following exceptions.</p><table><tr><th>Data for the week ending</th><th>Alternate release date</th><th>Release day</th><th>Release time</th><th>Holiday</th></tr><tr><td>November 6, 2026</td><td>November 12, 2026</td><td>Thursday</td><td>12:00 p.m.</td><td>SYNTHETIC_ONLY</td></tr></table></html>'
const q={contractVersion:'1.2.0',provider:'eia',family:'publication-calendar',operation:'calendar',criteria:{publication:'wpsr',from:'2026-11-09',to:'2026-11-13'}}
test('existing ordinary SERVICE uses current E1 and native Source for both versioned schedules; denies before HTTP and retains zero content',async t=>{
 const f=await consumerFixture(),originalFetch=globalThis.fetch;let installer;t.after(async()=>{globalThis.fetch=originalFetch;await installer?.end();await f.close()})
 const {source,e1}=f,config={...source.hub,eiaSchedulesEnabled:true,calendarConsumerStorageEnabled:true,commodityProviders:['eia','commodities-sh'],secrets:{...source.hub.secrets,eia:'SYNTHETIC_ONLY_UNUSED_EIA_KEY'}}
 await source.admin(0,'profitia_ingestion_owner',async c=>{await c.query("UPDATE profitia_ingestion.runtime_bindings SET status='REVOKED'");const sql=load('../../../packages/platform-contracts/migrations/access/024-unmetered-public-sources.sql');await c.query("SELECT set_config('profitia.install.unmetered_digest',$1,true)",[hash(sql)]);await c.query(sql);await c.query("UPDATE profitia_ingestion.runtime_bindings SET status='ACTIVE'")})
 await e1.asOwner(1,async c=>{for(const version of ['006-commodity-providers','007-publication-schedules','008-calendar-consumer-storage']){const sql=load('../migrations/'+version+'.sql');await c.query(sql);await c.query('INSERT INTO source_hub.migrations VALUES($1,$2)',[version,hash(sql)])}},'source_hub_development_owner')
 const url=new URL(process.env.SOURCE_HUB_TEST_ADMIN_URL);url.pathname='/'+source.hub.databaseName;installer=new pg.Client({connectionString:url.href,ssl:false});await installer.connect()
 const sources=[]
 await installer.query('BEGIN');try{
  await installer.query('SET LOCAL ROLE profitia_ingestion_owner')
  for(const provider of ['eia','commodities-sh']){
   const d=sourceDefinition(provider,'publication-calendar'),policy=randomUUID();sources.push({provider,d,policy})
   await installer.query("INSERT INTO profitia_ingestion.sources(source_id,effect_kind,data_class,payload_schema,quality_version,classification_version,projection_version,status,source_ref,expires_at) VALUES($1,'STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE','external-call-control-v1','source-hub-api-control-v1','TECHNICAL_CONTROL_NO_PRIVATE_DATA','source-receipt-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[d.sourceId])
   await installer.query("INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,resource_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'ALLOW','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[randomUUID(),config.sourceRole,d.sourceId,d.resourceId])
   await installer.query("INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,quota_mode,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,$2,$3,'SOURCE_TRANSACTION','UNMETERED',NULL,NULL,NULL,NULL,'ACTIVE','SYNTHETIC_ONLY')",[randomUUID(),config.applicationId,d.sourceId])
   await installer.query("INSERT INTO profitia_external_call.policies(policy_id,login_role,source_id,resource_id,configuration_version,origin,transport,path_rules,maximum_request_bytes,maximum_response_bytes,timeout_ms,unit,quota_mode,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,$2,$3,$4,$5,$6,'HTTPS',$7::jsonb,16384,2097152,15000,'UPSTREAM_ATTEMPT_ADMISSION','UNMETERED',NULL,NULL,NULL,NULL,'ACTIVE','SYNTHETIC_ONLY')",[policy,config.sourceRole,d.sourceId,d.resourceId,config.configurationVersion,d.origin,JSON.stringify(d.pathRules)])
   await installer.query("INSERT INTO profitia_external_native.policies(policy_id,base_policy_version,path_rules,redirect_origins,maximum_response_bytes,credential_mode,completion_mode,status,expires_at,source_ref) VALUES($1,1,$2::jsonb,'[]',2097152,'SERVER_HEADERS','ADMITTED_ATTEMPT_CURRENT_SETTLEMENT','ACTIVE',now()+interval '1 hour','SYNTHETIC_ONLY')",[policy,JSON.stringify(d.nativePathRules)])
  }
  await installer.query('COMMIT')
 }catch(e){await installer.query('ROLLBACK');throw e}
 await e1.asOwner(1,async c=>{for(const s of sources)await c.query("INSERT INTO source_hub.provider_licences(provider_id,family,licence_ref,version,source_id,resource_id,source_policy_id,private_consumer_use,consumer_application_ids,retention_seconds,redistribution,status,expires_at,consumer_access_mode) VALUES($1,'publication-calendar','SYNTHETIC_ONLY',1,$2,$3,$4,true,ARRAY['SYNTHETIC_ONLY'],0,'PRIVATE_AUTHORISED_CONSUMER_ONLY','ACTIVE',now()+interval '1 hour','SPENDGURU_PRODUCT')",[s.provider,s.d.sourceId,s.d.resourceId,s.policy])},'source_hub_development_owner')
 let calls=0,mode='ok',beforeProviderReturn=null;globalThis.fetch=async(input,options)=>{
  const u=new URL(input instanceof Request?input.url:input);if(!['www.eia.gov','api.commodities.sh'].includes(u.hostname))return originalFetch(input,options)
  calls++;assert(!u.search);assert(!new Headers(options.headers).has('authorization'));assert(!String(input).includes('SYNTHETIC_ONLY_UNUSED_EIA_KEY'))
  if(beforeProviderReturn){const action=beforeProviderReturn;beforeProviderReturn=null;await action()}
  const r=mode==='malformed'?new Response('<html>changed</html>'):u.hostname==='www.eia.gov'?new Response(html):Response.json({events:[{id:'SYNTHETIC-WPSR',name:'Synthetic schedule',date:'2026-11-12'}]});Object.defineProperty(r,'url',{value:u.href});return r
 }
 const admission=await createAdmission(config,source.sdb),configuration={...config,projectId:e1.bindings[1].projectId,branchId:e1.bindings[1].branchId,databaseName:e1.bindings[1].databaseName,configurationVersion:'fixture-v1',legacyPeerEnabled:false},logs=[],access=await createConsumerAccess(configuration,e1.db(1),{fetch:e1.sourceTransport}),app=createApplication({configuration,authorizer:null,repository:null,consumerAccess:access,admission,telemetry:{requestId:randomUUID,emit:e=>logs.push(e)}})
 const signed=await e1.makeSigned(),client=createFirstPartySourceHubClient(signed.configuration,{fetchImpl:r=>app.handle(r)}),execution={kind:'SERVICE',organisationId:A,grantId:e1.grantId},acquire=(command=q,ex=execution)=>client.acquire({execution:ex,command,idempotencyKey:'schedule-test:'+randomUUID()})
 for(let repeat=0;repeat<2;repeat++)for(const command of [q,{contractVersion:'1.2.0',provider:'commodities-sh',family:'publication-calendar',operation:'calendar',criteria:{}}]){const r=await acquire(command);assert.equal(r.items.length,1);assert.equal(r.contractVersion,'1.2.0');assert.equal(r.usage.upstreamAttempts,1);assert(r.usage.receiptRef);assert.equal(r.items[0].metadata.retentionUntil,null);assert.equal(r.items[0].metadata.consumerStorage,undefined)}
 // The new storage protocol is denied before HTTP to an otherwise admitted
 // consumer. Only its exact ECR SERVICE recipient may receive durable rights.
 const deniedCalls=calls;await assert.rejects(acquire({...q,contractVersion:'1.3.0'}),{code:'DURABLE_STORAGE_NOT_ADMITTED'});assert.equal(calls,deniedCalls)
 const ecrApp='profitia-economic-calendar-runtime-development',ecrRole='economic_calendar_development_ingest',component='SYNTHETIC_ONLY_ECR_STORAGE',keyId='SYNTHETIC_ONLY_ECR_KEY',sourceOrigin='urn:profitia:service:synthetic-ecr-storage',key=generateKeyPairSync('ed25519'),grants=new Map()
 if(!(await e1.databases[0].query('SELECT 1 FROM pg_roles WHERE rolname=$1',[ecrRole])).rowCount)await e1.databases[0].query('CREATE ROLE '+ecrRole+' LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION')
 await e1.asOwner(0,async c=>{
  await c.query("INSERT INTO profitia_access.applications(application_id,status) VALUES($1,'ACTIVE')",[ecrApp]);await c.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES($1,$2,'ACTIVE')",[ecrRole,ecrApp])
  await c.query("INSERT INTO profitia_services.runtime_bindings(login_role,binding_id,service_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,'SPENDGURU_SAAS','SYNTHETIC_ONLY','fixture-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[ecrRole,randomUUID(),randomUUID()])
  for(const provider of ['eia','commodities-sh']){const grant=randomUUID();grants.set(provider,grant);await c.query("INSERT INTO profitia_services.read_grants(grant_id,login_role,organisation_id,operation,feature,resource_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,'knowledge.read','market',$4,'ALLOW','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[grant,ecrRole,A,'api.'+provider+'.publication-calendar'])}
  await c.query("INSERT INTO profitia_e1_authority.source_components(component_id,key_id,application_id,login_role,receiver_application_id,source_origin,public_key,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,'SYNTHETIC_ONLY','fixture-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[component,keyId,ecrApp,ecrRole,e1.apps[1],sourceOrigin,key.publicKey.export({type:'spki',format:'pem'})])
 })
 await assert.rejects(e1.pools[1].query("SELECT source_hub.set_calendar_consumer_storage(0,$1,'eia','ACTIVE','SYNTHETIC_ONLY_OWNER_STORAGE')",[ecrApp]),e=>e.code==='42501')
 const licenceBefore=await e1.asOwner(1,c=>c.query('SELECT * FROM source_hub.provider_licences ORDER BY provider_id,family'),'source_hub_development_owner')
 await e1.asOwner(1,async c=>{for(const provider of ['eia','commodities-sh'])await c.query("SELECT source_hub.set_calendar_consumer_storage(0,$1,$2,'ACTIVE','SYNTHETIC_ONLY_OWNER_STORAGE')",[ecrApp,provider])},'source_hub_development_owner')
 await assert.rejects(e1.asOwner(1,c=>c.query("SELECT source_hub.set_calendar_consumer_storage(0,$1,'eia','ACTIVE','SYNTHETIC_ONLY_OWNER_STORAGE')",[ecrApp]),'source_hub_development_owner'),/expected version changed/)
 const ecrClient=createFirstPartySourceHubClient({...signed.configuration,consumerApplicationId:ecrApp,componentId:component,sourceOrigin,keyId,privateKey:key.privateKey},{fetchImpl:r=>app.handle(r)})
 const durable=provider=>ecrClient.acquire({command:provider==='eia'?{...q,contractVersion:'1.3.0'}:{contractVersion:'1.3.0',provider,family:'publication-calendar',operation:'calendar',criteria:{}},execution:{kind:'SERVICE',organisationId:A,grantId:grants.get(provider)},idempotencyKey:'SYNTHETIC_ONLY_DURABLE:'+randomUUID()})
 for(const provider of ['eia','commodities-sh']){const r=await durable(provider);assert.equal(r.items[0].metadata.consumerStorage.consumerApplicationId,ecrApp);assert.equal(r.items[0].metadata.consumerStorage.retentionMode,'DURABLE_NO_FIXED_EXPIRY');assert.equal(r.items[0].metadata.retentionUntil,null)}
 assert.deepEqual((await e1.asOwner(1,c=>c.query('SELECT * FROM source_hub.provider_licences ORDER BY provider_id,family'),'source_hub_development_owner')).rows,licenceBefore.rows)
 beforeProviderReturn=()=>e1.asOwner(1,c=>c.query("SELECT source_hub.set_calendar_consumer_storage(1,$1,'eia','REVOKED','SYNTHETIC_ONLY_REVOKED')",[ecrApp]),'source_hub_development_owner')
 await assert.rejects(durable('eia'),{code:'DURABLE_STORAGE_NOT_ADMITTED'})
 const revokedCalls=calls;await assert.rejects(durable('eia'),{code:'DURABLE_STORAGE_NOT_ADMITTED'});assert.equal(calls,revokedCalls)
 assert.equal((await acquire(q)).items[0].metadata.consumerStorage,undefined)
 const before=calls;await assert.rejects(acquire(q,{...execution,organisationId:B}),{code:'OPERATION_DENIED'});assert.equal(calls,before)
 const unsigned=await app.handle(new Request('https://synthetic.invalid/v1/acquire',{method:'POST',body:JSON.stringify({context:execution,request:q})}));assert.equal(unsigned.status,401);assert.equal(calls,before)
 const l=sources[0],transport=await admission.transportFor('eia','publication-calendar',{source_id:l.d.sourceId,resource_id:l.d.resourceId,source_policy_id:l.policy},'b'.repeat(64));await assert.rejects(transport.fetchImpl('https://www.eia.gov/private/unadmitted.php'));assert.equal(calls,before)
 mode='malformed';await assert.rejects(acquire(),{code:'PROVIDER_SCHEMA_CHANGED'});assert.equal(calls,before+1)
 await source.admin(0,'profitia_ingestion_owner',c=>c.query("UPDATE profitia_ingestion.grants SET status='REVOKED' WHERE source_id=$1",[l.d.sourceId]));await assert.rejects(acquire());assert.equal(calls,before+1)
 const ledger=await e1.asOwner(1,c=>c.query("SELECT result,retention_until FROM source_hub.first_party_acquisitions WHERE family='publication-calendar'"),'source_hub_development_owner');assert(ledger.rows.every(r=>r.result===null&&r.retention_until===null));assert.equal(e1.clerkState.calls.length,0);assert(!JSON.stringify(logs).includes('<html>'));assert(logs.some(e=>e.family==='publication-calendar'&&e.status===200&&e.upstreamAttempts===1))
})
test('new owner packet and Identity SQL are exact; malformed approval cannot issue SQL',async()=>{
 const plan=JSON.parse(load('../operations/publication-schedule-owner-plan.json')),sql=load('../operations/enroll-publication-schedule-service.sql'),embedded=JSON.parse(sql.match(/expected jsonb := \$plan\$([\s\S]*?)\$plan\$::jsonb/)[1]);assert.deepEqual(embedded,plan)
 assert.equal(plan.retentionSeconds,0);assert.equal(plan.sourceQuotaMode,'UNMETERED');assert.equal(plan.newRoles,false);assert.equal(plan.newKeys,false)
 let calls=0;const db={query(){calls++;throw Error('MUST_NOT_QUERY')}}
 for(const input of [{...plan,retentionSeconds:60},{...plan,identity:{...plan.identity,resourceId:'api.eia.data-catalog'}}])await assert.rejects(installPublicationScheduleSource(db,input,{expectedPlanDigest:hash(JSON.stringify(input)),ownerDecisionRef:'owner-decision:sha256:'+'1'.repeat(64)}),/EXACT_OWNER_APPROVAL_REQUIRED/)
 await assert.rejects(installPublicationScheduleSource(db,plan,{expectedPlanDigest:hash(JSON.stringify(plan)),ownerDecisionRef:'not-an-owner-decision'}),/EXACT_OWNER_APPROVAL_REQUIRED/);assert.equal(calls,0)
})
test('real PostgreSQL enrollment adds only one exact finite grant to an existing component and rejects changed approval, revocation and duplicate',async t=>{
 const {firstPartyFixture}=await import('../../../packages/platform-contracts/test/fixtures/first-party-source-postgres.mjs'),f=await firstPartyFixture();t.after(()=>f.close())
 const plan=JSON.parse(load('../operations/publication-schedule-owner-plan.json')),originalSql=load('../operations/enroll-publication-schedule-service.sql'),component=f.components.report
 // Only physical fixture identities in the embedded packet are substituted.
 // The executable SQL and every production guard are otherwise unchanged;
 // the separate exact-packet test above pins the complete production packet.
 const synthetic={...plan,applicationId:f.apps[1],identity:{...plan.identity,componentId:component.id,applicationId:component.app,role:component.role,serviceId:f.serviceId,organisationId:A,publicKeySha256:hash(component.key.publicKey.export({type:'spki',format:'pem'}))}}
 const sql=originalSql.replace(/(?<=\$plan\$)[\s\S]*?(?=\$plan\$::jsonb)/,JSON.stringify(synthetic)),decision='owner-decision:sha256:'+'1'.repeat(64)
 await f.asOwner(0,async c=>{
  await c.query("UPDATE profitia_access.installation SET project_id='spring-bread-28217539',branch_id='br-sparkling-term-b99l107x',database_name=current_database() WHERE singleton")
  await c.query('UPDATE profitia_access.applications SET fixed_organisation_id=$2 WHERE application_id=$1',[component.app,A])
  await c.query('UPDATE profitia_services.runtime_bindings SET expires_at=$2 WHERE login_role=$1',[component.role,plan.expiresAt])
  await c.query('UPDATE profitia_e1_authority.source_components SET expires_at=$2 WHERE component_id=$1',[component.id,plan.expiresAt])
  await c.query("UPDATE profitia_access.product_grants SET expires_at=$1 WHERE application_id='spendguru'",[plan.expiresAt])
 })
 const before=await f.asOwner(0,c=>c.query('SELECT to_jsonb(g) AS value FROM profitia_services.read_grants g ORDER BY grant_id'))
 const enroll=p=>f.asOwner(0,async c=>{await c.query("SELECT set_config('source_hub.publication_schedule_plan',$1,true),set_config('source_hub.publication_schedule_owner_ref',$2,true)",[JSON.stringify(p),decision]);await c.query(sql)})
 await assert.rejects(enroll({...synthetic,retentionSeconds:1}),/EXACT_PUBLICATION_SCHEDULE_APPROVAL_REQUIRED/)
 await f.asOwner(0,c=>c.query("UPDATE profitia_e1_authority.source_components SET status='REVOKED' WHERE component_id=$1",[component.id]));await assert.rejects(enroll(synthetic),/CURRENT_APPROVED_EXISTING_COMPONENT_REQUIRED/)
 await f.asOwner(0,c=>c.query("UPDATE profitia_e1_authority.source_components SET status='ACTIVE' WHERE component_id=$1",[component.id]))
 await enroll(synthetic)
 const rows=await f.asOwner(0,c=>c.query('SELECT * FROM profitia_services.read_grants WHERE grant_id=$1',[plan.identity.grantId]));assert.equal(rows.rowCount,1);const g=rows.rows[0]
 assert.equal(g.login_role,component.role);assert.equal(g.organisation_id,A);assert.equal(g.resource_id,'api.eia.publication-calendar');assert.equal(g.operation,'knowledge.read');assert.equal(g.feature,'market');assert.equal(g.expires_at.toISOString(),plan.expiresAt);assert.equal(g.source_ref,decision)
 const preserved=await f.asOwner(0,c=>c.query('SELECT to_jsonb(g) AS value FROM profitia_services.read_grants g WHERE grant_id<>$1 ORDER BY grant_id',[plan.identity.grantId]));assert.deepEqual(preserved.rows,before.rows)
 await assert.rejects(enroll(synthetic),/GRANT_EXISTS_RECONCILE_WITHOUT_OVERWRITE/)
})
