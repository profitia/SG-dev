// SYNTHETIC_ONLY. Isolated loopback PostgreSQL, no Neon or provider requests.
import test from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import {readFileSync} from 'node:fs'
import {randomUUID,createHash} from 'node:crypto'
import {fixture} from '../../platform-source-hub/test/fixtures.mjs'
import {sourceDefinition} from '../../platform-source-hub/src/admission.mjs'
const load=p=>readFileSync(new URL(p,import.meta.url),'utf8'),hash=s=>createHash('sha256').update(s).digest('hex')

test('source lease renewal is bounded, revocable, idempotent, leaves other consumers/counters intact and grants no table access',async()=>{
 const f=await fixture(),root=new pg.Client({connectionString:process.env.SOURCE_HUB_TEST_ADMIN_URL,ssl:false}),role='economic_calendar_development_source_monitor',monitorPassword=randomUUID();let monitor,installer
 try{
  await root.connect();if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)await root.query('CREATE ROLE '+role+' LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION')
  await root.query('ALTER ROLE '+role+" PASSWORD '"+monitorPassword+"'")
  const setupUrl=new URL(process.env.SOURCE_HUB_TEST_ADMIN_URL);setupUrl.pathname='/'+f.hub.databaseName;const setup=new pg.Client({connectionString:setupUrl.href,ssl:false});await setup.connect();try{await setup.query('CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public');await setup.query('ALTER EXTENSION pgcrypto SET SCHEMA public')}finally{await setup.end()}
  await f.admin(0,'profitia_access_owner',async q=>{
   await q.query(load('../../../packages/platform-contracts/current-e1-authority/migrations/002-receiver.sql'))
   await q.query(load('../../../packages/platform-contracts/current-e1-authority/migrations/004-first-party-receiver.sql'))
   await q.query('GRANT USAGE ON SCHEMA profitia_e1_receiver TO source_hub_development_owner')
   await q.query("INSERT INTO profitia_e1_receiver.installation(singleton,login_role,binding,authority_origin,resource_id,key_id,proof_key,status,source_ref,expires_at) VALUES(true,'source_hub_development_runtime',$1::jsonb,'https://identity.synthetic.test','source-hub-private','SYNTHETIC_ONLY',decode(repeat('11',32),'hex'),'ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[JSON.stringify({applicationId:f.hub.applicationId})])
  })
  await f.admin(0,'source_hub_development_owner',async q=>{
   await q.query(load('../../platform-source-hub/migrations/004-universal-consumers.sql'))
   const six=load('../../platform-source-hub/migrations/006-commodity-providers.sql');await q.query(six);await q.query('INSERT INTO source_hub.migrations VALUES($1,$2)',['006-commodity-providers',hash(six)])
   await q.query(load('../../platform-source-hub/migrations/007-publication-schedules.sql'))
  })
  await f.admin(0,'profitia_ingestion_owner',async q=>{
   await q.query("UPDATE profitia_ingestion.runtime_bindings SET status='REVOKED'");const sql=load('../../../packages/platform-contracts/migrations/access/024-unmetered-public-sources.sql');await q.query("SELECT set_config('profitia.install.unmetered_digest',$1,true)",[hash(sql)]);await q.query(sql);await q.query("UPDATE profitia_ingestion.runtime_bindings SET status='ACTIVE'")
  })
  const scopes=[['eia','publication-calendar'],['eia','series-observations'],['commodities-sh','publication-calendar']]
  for(const [provider,family]of scopes){
   const d=sourceDefinition(provider,family),policy=randomUUID()
   await f.admin(0,'profitia_ingestion_owner',async q=>{
    await q.query("INSERT INTO profitia_ingestion.sources(source_id,effect_kind,data_class,payload_schema,quality_version,classification_version,projection_version,status,source_ref,expires_at) VALUES($1,'STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE','external-call-control-v1','source-hub-api-control-v1','TECHNICAL_CONTROL_NO_PRIVATE_DATA','source-receipt-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[d.sourceId])
    await q.query("INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,resource_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'ALLOW','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[randomUUID(),f.hub.sourceRole,d.sourceId,d.resourceId])
    await q.query("INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,quota_mode,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,$2,$3,'SOURCE_TRANSACTION','UNMETERED',NULL,NULL,NULL,NULL,'ACTIVE','SYNTHETIC_ONLY')",[randomUUID(),f.hub.applicationId,d.sourceId])
    await q.query("INSERT INTO profitia_external_call.policies(policy_id,login_role,source_id,resource_id,configuration_version,origin,transport,path_rules,maximum_request_bytes,maximum_response_bytes,timeout_ms,unit,quota_mode,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,$2,$3,$4,$5,$6,'HTTPS',$7::jsonb,16384,2097152,15000,'UPSTREAM_ATTEMPT_ADMISSION','UNMETERED',NULL,NULL,NULL,NULL,'ACTIVE','SYNTHETIC_ONLY')",[policy,f.hub.sourceRole,d.sourceId,d.resourceId,f.hub.configurationVersion,d.origin,JSON.stringify(d.pathRules)])
    await q.query("INSERT INTO profitia_external_native.policies(policy_id,base_policy_version,path_rules,redirect_origins,maximum_response_bytes,credential_mode,completion_mode,status,expires_at,source_ref) VALUES($1,1,$2::jsonb,'[]',2097152,'SERVER_HEADERS','ADMITTED_ATTEMPT_CURRENT_SETTLEMENT','ACTIVE',now()+interval '1 hour','SYNTHETIC_ONLY')",[policy,JSON.stringify(d.nativePathRules)])
   })
   await f.admin(0,'source_hub_development_owner',q=>q.query("INSERT INTO source_hub.provider_licences(provider_id,family,licence_ref,version,source_id,resource_id,source_policy_id,private_consumer_use,consumer_application_ids,retention_seconds,redistribution,status,expires_at,consumer_access_mode) VALUES($1,$2,'SYNTHETIC_ONLY',1,$3,$4,$5,true,ARRAY['SYNTHETIC_ONLY'],0,'PRIVATE_AUTHORISED_CONSUMER_ONLY','ACTIVE',now()+interval '1 hour','SPENDGURU_PRODUCT')",[provider,family,d.sourceId,d.resourceId,policy]))
  }
  const url=new URL(process.env.SOURCE_HUB_TEST_ADMIN_URL);url.pathname='/'+f.hub.databaseName;installer=new pg.Client({connectionString:url.href,ssl:false});await installer.connect()
  await installer.query('BEGIN');try{await installer.query(load('../../platform-source-hub/migrations/010-ecr-source-continuity.sql'));await installer.query('COMMIT')}catch(e){await installer.query('ROLLBACK');throw e}
  url.username=role;url.password=monitorPassword;monitor=new pg.Client({connectionString:url.href,ssl:false});await monitor.connect()
  const status=async()=> (await monitor.query('SELECT source_hub.ecr_source_access_status() AS value')).rows[0].value
  const snapshot=await status(),fingerprints=Object.fromEntries(snapshot.dependencies.filter(x=>x.kind!=='OWNER_RENEWAL_BASIS').map(x=>[x.id,x.fingerprint]))
  assert.equal(new Set(snapshot.dependencies.map(x=>x.id)).size,snapshot.dependencies.length)
  for(const kind of ['INTERNAL_LICENCE_ADMISSION','SOURCE_ADMISSION','SOURCE_GRANT','SOURCE_BUDGET','TRANSPORT_ADMISSION','NATIVE_TRANSPORT'])assert.equal(snapshot.dependencies.filter(x=>x.kind===kind).length,3)
  for(const kind of ['SERVICE_BINDING','E1_RECEIVER','OWNER_RENEWAL_BASIS'])assert.equal(snapshot.dependencies.filter(x=>x.kind===kind).length,1)
  const plan=JSON.parse(load('../operations/source-access-continuity-owner-plan.json')),activation=load('../operations/activate-source-access-continuity.sql')
  assert.deepEqual(JSON.parse(activation.match(/expected jsonb:=\$plan\$([\s\S]*?)\$plan\$::jsonb/)[1]),plan)
  const synthetic={...plan,sourceHub:{...plan.sourceHub,databaseName:f.hub.databaseName,expectedFingerprints:fingerprints,initialLeaseUntil:new Date(Date.now()+3600000).toISOString(),rightsMode:'FINITE_PROVIDER_RIGHTS',rightsValidUntil:new Date(Date.now()+5*86400000).toISOString()}}
  const statement=activation.replace(/(?<=expected jsonb:=\$plan\$)[\s\S]*?(?=\$plan\$::jsonb)/,JSON.stringify(synthetic))
  const activate=input=>f.admin(0,'source_hub_development_owner',async q=>{await q.query("SELECT set_config('ecr.source_access_plan',$1,true),set_config('ecr.source_access_owner_ref',$2,true)",[JSON.stringify(input),'owner-decision:sha256:'+'1'.repeat(64)]);await q.query(statement)})
  await assert.rejects(activate({...synthetic,environment:'production'}),/EXACT_ECR_SOURCE_ACCESS_OWNER_PLAN_REQUIRED/)
  await activate(synthetic);await assert.rejects(activate(synthetic),/SOURCE_CONTINUITY_EXISTS_RECONCILE/)
  const otherBefore=(await f.admin(0,'source_hub_development_owner',q=>q.query("SELECT to_jsonb(l) AS value FROM source_hub.provider_licences l WHERE provider_id NOT IN('eia','commodities-sh') ORDER BY provider_id,family"))).rows
  const countersBefore=(await f.admin(0,'profitia_ingestion_owner',q=>q.query('SELECT source_id,consumed_count FROM profitia_ingestion.budgets ORDER BY source_id'))).rows
  const renew=async()=> (await monitor.query('SELECT source_hub.maintain_ecr_source_access() AS value')).rows[0].value
  const first=await renew();assert.equal(first.status,'RENEWED');assert.equal((await renew()).status,'CURRENT')
  assert(first.dependencies.filter(x=>x.expiryMode==='FINITE').every(x=>Date.parse(x.expiresAt)>Date.now()+4*86400000&&Date.parse(x.expiresAt)<=Date.now()+5*86400000))
  assert.deepEqual((await f.admin(0,'source_hub_development_owner',q=>q.query("SELECT to_jsonb(l) AS value FROM source_hub.provider_licences l WHERE provider_id NOT IN('eia','commodities-sh') ORDER BY provider_id,family"))).rows,otherBefore)
  assert.deepEqual((await f.admin(0,'profitia_ingestion_owner',q=>q.query('SELECT source_id,consumed_count FROM profitia_ingestion.budgets ORDER BY source_id'))).rows,countersBefore)
  assert.equal((await f.admin(0,'source_hub_development_owner',q=>q.query('SELECT count(*)::int AS n FROM source_hub.ecr_source_continuity_history'))).rows[0].n,1)
  await f.admin(0,'source_hub_development_owner',q=>q.query("UPDATE source_hub.ecr_source_continuity_policy SET rights_mode='NO_FIXED_EXPIRY_OWNER_ATTESTED',rights_valid_until=NULL"))
  assert.equal((await renew()).status,'RENEWED');assert.equal((await renew()).status,'CURRENT')
  assert((await status()).dependencies.filter(x=>x.expiryMode==='FINITE').every(x=>Date.parse(x.expiresAt)>Date.now()+29*86400000))
  await installer.query('BEGIN');try{await installer.query('LOCK TABLE profitia_external_call.calls IN EXCLUSIVE MODE');await f.admin(0,'source_hub_development_owner',q=>q.query("UPDATE source_hub.ecr_source_continuity_policy SET lease_until=now()+interval '1 hour'"));assert.equal((await renew()).status,'DEFERRED_ACTIVE_SOURCE_CALL')}finally{await installer.query('ROLLBACK')}
  let started,release
  const entered=new Promise(resolve=>{started=resolve}),held=new Promise(resolve=>{release=resolve})
  f.state.beforeResponse=async()=>{started();await held}
  const legacyLicence=(await f.admin(0,'source_hub_development_owner',q=>q.query("SELECT * FROM source_hub.provider_licences WHERE provider_id='newsapi' AND family='news-discovery'"))).rows[0]
  const legacyTransport=await f.admission.transportFor('newsapi','news-discovery',legacyLicence,'1'.repeat(64))
  const legacy=legacyTransport.fetchImpl('https://newsapi.org/v2/everything?q=SYNTHETIC_ONLY')
  try{await Promise.race([entered,legacy.then(()=>{throw Error('EXPECTED_ACTIVE_CALL')}),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('NATIVE_TEST_TIMEOUT')),5000);timer.unref()})]);assert.equal((await renew()).status,'DEFERRED_ACTIVE_SOURCE_CALL')}finally{release()}
  assert.equal((await legacy).status,200);f.state.beforeResponse=null
  assert(!JSON.stringify(first).includes('11'.repeat(32)))
  await assert.rejects(monitor.query('SELECT * FROM source_hub.provider_licences'),{code:'42501'})
  await assert.rejects(f.hdb.query('SELECT source_hub.maintain_ecr_source_access()'),{code:'42501'})
  await f.admin(0,'profitia_ingestion_owner',q=>q.query("UPDATE profitia_ingestion.sources SET status='REVOKED' WHERE source_id='source-hub.eia.publication-calendar'"))
  assert.equal((await renew()).status,'BLOCKED_NO_RIGHT_RESTORED')
  await f.admin(0,'profitia_ingestion_owner',q=>q.query("UPDATE profitia_ingestion.sources SET status='ACTIVE',expires_at=clock_timestamp()-interval '1 second' WHERE source_id='source-hub.eia.publication-calendar'"))
  assert.equal((await renew()).status,'BLOCKED_NO_RIGHT_RESTORED');assert(Date.parse((await status()).dependencies.find(x=>x.id==='source:source-hub.eia.publication-calendar').expiresAt)<Date.now())
  await f.admin(0,'source_hub_development_owner',q=>q.query("UPDATE source_hub.ecr_source_continuity_policy SET status='REVOKED'"))
  assert.equal((await renew()).status,'OWNER_BASIS_INACTIVE');assert.equal(f.state.providerCalls.length,1)
 }finally{await monitor?.end();await installer?.end();await root.end();await f.close()}
})
