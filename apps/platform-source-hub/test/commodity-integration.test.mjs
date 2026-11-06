// SYNTHETIC_ONLY: real PostgreSQL/E1/Source admission, offline HTTP payloads.
import test from 'node:test'
import pg from 'pg'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash,randomUUID} from 'node:crypto'
import {consumerFixture} from './first-party-fixtures.mjs'
import {A,B} from '../../../packages/platform-contracts/test/fixtures/first-party-source-postgres.mjs'
import {COMMODITY_SOURCE_DEFINITIONS,sourceDefinition,createAdmission} from '../src/admission.mjs'
import {createApplication} from '../src/server.mjs'
import {createFirstPartySourceHubClient} from '@profitia/platform-source-hub-contracts/client'
const hash=v=>createHash('sha256').update(v).digest('hex')
const load=p=>readFileSync(new URL(p,import.meta.url),'utf8')
test('new providers use current SERVICE E1, native Source controls, exact families and zero payload retention without changing old policies',async t=>{
 const f=await consumerFixture(),originalFetch=globalThis.fetch;let installer;t.after(async()=>{globalThis.fetch=originalFetch;await installer?.end();await f.close()})
 const {source,e1}=f,key='SYNTHETIC_ONLY_EIA_SECRET',config={...source.hub,commodityProviders:['eia','cftc','commodities-sh'],secrets:{...source.hub.secrets,eia:key}}
 const old=await source.admin(0,'profitia_ingestion_owner',q=>q.query('SELECT policy_id,version,admitted_count::text AS admitted_count FROM profitia_external_call.policies ORDER BY policy_id'))
 await source.admin(0,'profitia_ingestion_owner',async q=>{
  await q.query("UPDATE profitia_ingestion.runtime_bindings SET status='REVOKED'")
  const sql=load('../../../packages/platform-contracts/migrations/access/024-unmetered-public-sources.sql')
  await q.query("SELECT set_config('profitia.install.unmetered_digest',$1,true)",[hash(sql)]);await q.query(sql)
  await q.query("UPDATE profitia_ingestion.runtime_bindings SET status='ACTIVE'")
 })
 await e1.asOwner(1,async q=>{const sql=load('../migrations/006-commodity-providers.sql');await q.query(sql);await q.query("INSERT INTO source_hub.migrations VALUES('006-commodity-providers',$1)",[hash(sql)])},'source_hub_development_owner')
 const licences=[]
 const u=new URL(process.env.SOURCE_HUB_TEST_ADMIN_URL);u.pathname='/'+source.hub.databaseName;installer=new pg.Client({connectionString:u.href,ssl:false});await installer.connect();
 const installOwner=async action=>{await installer.query('BEGIN');try{await installer.query('SET LOCAL ROLE profitia_ingestion_owner');await action(installer);await installer.query('COMMIT')}catch(e){await installer.query('ROLLBACK');throw e}}
 await installOwner(async q=>{
  for(const key of Object.keys(COMMODITY_SOURCE_DEFINITIONS)){
   const [provider,family]=key.split(':'),d=sourceDefinition(provider,family),policy=randomUUID()
   await q.query("INSERT INTO profitia_ingestion.sources(source_id,effect_kind,data_class,payload_schema,quality_version,classification_version,projection_version,status,source_ref,expires_at) VALUES($1,'STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE','external-call-control-v1','source-hub-api-control-v1','TECHNICAL_CONTROL_NO_PRIVATE_DATA','source-receipt-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[d.sourceId])
   await q.query("INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,resource_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'ALLOW','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[randomUUID(),config.sourceRole,d.sourceId,d.resourceId])
   await q.query("INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,quota_mode,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,$2,$3,'SOURCE_TRANSACTION','UNMETERED',NULL,NULL,NULL,NULL,'ACTIVE','SYNTHETIC_ONLY')",[randomUUID(),config.applicationId,d.sourceId])
   await q.query("INSERT INTO profitia_external_call.policies(policy_id,login_role,source_id,resource_id,configuration_version,origin,transport,path_rules,maximum_request_bytes,maximum_response_bytes,timeout_ms,unit,quota_mode,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,$2,$3,$4,$5,$6,'HTTPS',$7::jsonb,16384,2097152,15000,'UPSTREAM_ATTEMPT_ADMISSION','UNMETERED',NULL,NULL,NULL,NULL,'ACTIVE','SYNTHETIC_ONLY')",[policy,config.sourceRole,d.sourceId,d.resourceId,config.configurationVersion,d.origin,JSON.stringify(d.pathRules)])
   await q.query("INSERT INTO profitia_external_native.policies(policy_id,base_policy_version,path_rules,redirect_origins,maximum_response_bytes,credential_mode,completion_mode,status,expires_at,source_ref) VALUES($1,1,$2::jsonb,'[]',2097152,'SERVER_HEADERS','ADMITTED_ATTEMPT_CURRENT_SETTLEMENT','ACTIVE',now()+interval '1 hour','SYNTHETIC_ONLY')",[policy,JSON.stringify(d.nativePathRules)])
   licences.push({provider,family,d,policy})
  }
 })
 await e1.asOwner(1,async q=>{for(const l of licences)await q.query("INSERT INTO source_hub.provider_licences(provider_id,family,licence_ref,version,source_id,resource_id,source_policy_id,private_consumer_use,consumer_application_ids,retention_seconds,redistribution,status,expires_at,consumer_access_mode,allow_catalog_inventory) VALUES($1,$2,'SYNTHETIC_ONLY',1,$3,$4,$5,true,ARRAY['SYNTHETIC_ONLY'],0,'PRIVATE_AUTHORISED_CONSUMER_ONLY','ACTIVE',now()+interval '1 hour','SPENDGURU_PRODUCT',$6)",[l.provider,l.family,l.d.sourceId,l.d.resourceId,l.policy,l.family==='data-catalog'])},'source_hub_development_owner')
 const reply=(json,u)=>{const r=Response.json(json);Object.defineProperty(r,'url',{value:u.href});return r};let calls=[]
 globalThis.fetch=async(input,options)=>{
  const u=new URL(input instanceof Request?input.url:input)
  if(!['api.eia.gov','publicreporting.cftc.gov','api.commodities.sh'].includes(u.hostname))return originalFetch(input,options)
  calls.push(u)
  if(u.hostname==='api.eia.gov'){assert.equal(u.searchParams.get('api_key'),key);assert(!new Headers(options.headers).has('authorization'));return reply({request:{params:{api_key:key}},response:u.pathname.endsWith('/data/')?{total:'1',data:[{period:'2026-11-03',value:'123',units:'Mbbl'}]}:{name:'Petroleum',routes:[{id:'stoc',name:'Stocks'}]}},u)}
  if(u.hostname==='publicreporting.cftc.gov')return reply(u.pathname.startsWith('/resource/')?[{report_date_as_yyyy_mm_dd:'2026-11-03T00:00:00',cftc_contract_market_code:'067651',open_interest_all:'123'}]:{id:'jun7-fc8e',name:'Legacy Combined',columns:[{fieldName:'open_interest_all',dataTypeName:'number'}]},u)
  if(u.pathname==='/v1/catalog')return reply({instruments:[{code:'CL',unit:'USD/bbl'}],pricing_usd:{PRICE:.01}},u)
  if(u.pathname==='/v1/calendar')return reply({events:[{title:'EIA Petroleum',date:'2026-11-12',frequency:'weekly'}]},u)
  throw Error('PAID_OR_UNKNOWN_NETWORK_ROUTE_FORBIDDEN')
 }
 const admission=await createAdmission(config,source.sdb),configuration={...config,projectId:e1.bindings[1].projectId,branchId:e1.bindings[1].branchId,databaseName:e1.bindings[1].databaseName,configurationVersion:'fixture-v1',legacyPeerEnabled:false},app=createApplication({configuration,authorizer:null,repository:null,consumerAccess:f.access,admission})
 const signed=await e1.makeSigned(),client=createFirstPartySourceHubClient(signed.configuration,{fetchImpl:r=>app.handle(r)}),execution={kind:'SERVICE',organisationId:A,grantId:e1.grantId}
 const command=(provider,family,operation,criteria)=>({contractVersion:'1.1.0',provider,family,operation,criteria})
 const commands=[command('eia','data-catalog','metadata',{path:'petroleum'}),command('eia','series-observations','observations',{path:'petroleum/stoc/wstk',frequency:'weekly',data:['value']}),command('cftc','data-catalog','metadata',{datasetId:'jun7-fc8e'}),command('cftc','positioning-observations','observations',{datasetId:'jun7-fc8e'}),command('commodities-sh','data-catalog','catalog',{}),command('commodities-sh','publication-calendar','calendar',{})]
 for(const [i,c]of commands.entries()){
  const before=e1.clerkState.calls.length,result=await client.acquire({execution,command:c,idempotencyKey:'commodity-synthetic-'+i})
  assert.equal(result.items.length,1);assert.equal(result.usage.upstreamAttempts,1);assert(result.usage.receiptRef);assert.equal(result.items[0].metadata.retentionUntil,null);assert.equal(e1.clerkState.calls.length,before);assert(!JSON.stringify(result).includes(key))
  assert.equal(result.items[0].metadata.consumerStorage?.mode,c.family==='data-catalog'?'CATALOG_METADATA_ONLY':undefined)
 }
 assert.equal(calls.length,6)
 const ledger=await e1.asOwner(1,q=>q.query('SELECT result,retention_until FROM source_hub.first_party_acquisitions'),'source_hub_development_owner');assert.equal(ledger.rowCount,6);assert(ledger.rows.every(r=>r.result===null&&r.retention_until===null))
 const before=calls.length
 await assert.rejects(client.acquire({execution:{...execution,organisationId:B},command:commands[0],idempotencyKey:'commodity-foreign-org'}),{code:'OPERATION_DENIED'})
 await assert.rejects(client.acquire({execution,command:command('commodities-sh','data-catalog','catalog',{endpoint:'price/CL'}),idempotencyKey:'commodity-paid-denied'}),{code:'PAID_OPERATION_NOT_ACTIVATED'})
 const l=licences.find(l=>l.provider==='commodities-sh'&&l.family==='data-catalog'),licence={source_id:l.d.sourceId,resource_id:l.d.resourceId,source_policy_id:l.policy}
 const transport=await admission.transportFor(l.provider,l.family,licence,'a'.repeat(64));await assert.rejects(transport.fetchImpl('https://api.commodities.sh/v1/price/CL'))
 await source.admin(0,'profitia_ingestion_owner',q=>q.query("UPDATE profitia_ingestion.grants SET status='REVOKED' WHERE source_id=$1",[licences[0].d.sourceId]));await assert.rejects(client.acquire({execution,command:commands[0],idempotencyKey:'commodity-source-revoked'}))
 assert.equal(calls.length,before)
 const after=await source.admin(0,'profitia_ingestion_owner',q=>q.query('SELECT policy_id,version,admitted_count::text AS admitted_count FROM profitia_external_call.policies WHERE policy_id=ANY($1::uuid[]) ORDER BY policy_id',[old.rows.map(r=>r.policy_id)]));assert.deepEqual(after.rows,old.rows)
})

test('Identity enrollment executes canonical SQL with the real profile and rejects the privateKeyPersistence mismatch before any write',async t=>{
 const {firstPartyFixture}=await import('../../../packages/platform-contracts/test/fixtures/first-party-source-postgres.mjs')
 const {generateKeyPairSync}=await import('node:crypto')
 const f=await firstPartyFixture();t.after(()=>f.close())
 const profile=JSON.parse(load('../operations/commodity-service-profile.json')),sql=load('../operations/enroll-commodity-service.sql')
 // Disposable loopback fixture only. Match the canonical physical guard and
 // existing receiver/organisation prerequisites; no live directory is touched.
 await f.databases[0].query('CREATE ROLE '+profile.role+" LOGIN PASSWORD NULL NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION VALID UNTIL '"+profile.expiresAt+"'")
 await f.asOwner(0,async q=>{
  await q.query("UPDATE profitia_access.installation SET project_id='spring-bread-28217539',branch_id='br-sparkling-term-b99l107x' WHERE singleton")
  await q.query("UPDATE profitia_e1_authority.source_receivers SET target_origin=$2,expires_at=$3 WHERE application_id=$1",[profile.receiverApplicationId,profile.targetOrigin,profile.expiresAt])
  await q.query("INSERT INTO profitia_access.organisations(organisation_id,status) VALUES($1,'ACTIVE')",[profile.organisationId])
  await q.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES('spendguru',$1,'SPENDGURU',ARRAY['market'],'ACTIVE','EXPLICIT_OFFER','SYNTHETIC_ONLY',$2)",[profile.organisationId,profile.expiresAt])
 })
 const publicKey=generateKeyPairSync('ed25519').publicKey.export({type:'spki',format:'pem'}),approved={...profile,status:'ENROLLED',ownerDecisionRef:'owner-decision:sha256:'+'1'.repeat(64),deploymentId:'a'.repeat(40),publicKey,publicKeySha256:hash(publicKey)}
 const enroll=p=>f.asOwner(0,async q=>{await q.query("SELECT set_config('source_hub.catalogue_service_spec',$1,true)",[JSON.stringify(p)]);await q.query(sql)})
 await assert.rejects(enroll({...approved,privateKeyPersistence:'OWNER_APPROVED_SSourceHub catalogueET_STORE'}),/EXACT_APPROVED_SOURCEHUB_CATALOGUE_PROFILE_REQUIRED/)
 const absent=await f.asOwner(0,q=>q.query('SELECT application_id FROM profitia_access.applications WHERE application_id=$1',[profile.applicationId]));assert.equal(absent.rowCount,0)
 await enroll(approved)
 const readback=await f.asOwner(0,async q=>({grants:(await q.query('SELECT grant_id,organisation_id,resource_id,operation,feature,expires_at FROM profitia_services.read_grants WHERE login_role=$1 ORDER BY resource_id',[profile.role])).rows,component:(await q.query('SELECT public_key,application_id,source_origin FROM profitia_e1_authority.source_components WHERE component_id=$1',[profile.componentId])).rows}))
 assert.equal(readback.grants.length,6);assert.deepEqual(readback.grants.map(g=>g.resource_id),profile.grants.map(g=>g.resourceId).sort());assert(readback.grants.every(g=>g.organisation_id===profile.organisationId&&g.operation==='knowledge.read'&&g.feature==='market'&&g.expires_at.toISOString()===profile.expiresAt));assert.equal(hash(readback.component[0].public_key),approved.publicKeySha256)
 await assert.rejects(enroll(approved),/IDENTITY_ALREADY_EXISTS_STOP_AND_RECONCILE/)
 assert.equal((await f.asOwner(0,q=>q.query('SELECT grant_id FROM profitia_services.read_grants WHERE login_role=$1',[profile.role]))).rowCount,6)
})
