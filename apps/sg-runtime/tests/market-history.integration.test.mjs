import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import {randomUUID,createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {assertIsolatedTestConnection} from '../../architecture-lab/src/operation-postgres-fixture.mjs'
import {historySourcePolicy} from '../lib/market-data/history-source.ts'
import {HISTORY_PERSIST_SOURCE} from '../lib/market-data/history-contract.ts'
import {createStoredMarketHistoryReader} from '../lib/market-data/stored-read.ts'
const {Client}=createRequire(new URL('../../architecture-lab/package.json',import.meta.url))('pg'),{PrismaClient}=createRequire(import.meta.url)('@prisma/client')
const hash=s=>createHash('sha256').update(s).digest('hex'),read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8')
const sourceSql=read('../../../packages/platform-contracts/migrations/access/008-platform-ingestion.sql'),externalSql=read('../../../packages/platform-contracts/migrations/access/009-external-call-admission.sql'),nativeSql=read('../../../packages/platform-contracts/migrations/access/012-native-external-transport.sql'),unmeteredSql=read('../../../packages/platform-contracts/migrations/access/024-unmetered-public-sources.sql'),writerSql=read('../prisma-market-data/private-write/003-market-history.sql'),readSql=read('../prisma-market-data/private-read/001-stored-history-read.sql')
const ROLE='sg2_history_fixture',READ_ROLE='sg2_history_read_fixture',DATABASE='sg2_history_'+randomUUID().replaceAll('-','')

test('real Source UNMETERED admission and ordinary-role canonical history persistence, audit, idempotency and recovery',async t=>{
 const rootUrl=assertIsolatedTestConnection(process.env.SG2_OPERATION_TEST_OWNER_URL,'sg2_operation_test','architecture_test_owner'),root=new Client({connectionString:rootUrl});await root.connect()
 const u=new URL(rootUrl);u.pathname='/'+DATABASE;let owner,prisma,auditPrisma,reader,server,created=false,hits=0,mode='NORMAL',hook=null,points=[-37.63,null,72.5]
 const credentials={clientId:'fixture-client',clientSecret:'fixture-secret'},selected=[]
 try{
  server=http.createServer(async(req,res)=>{
   hits++;let data='';for await(const b of req)data+=b;const action=hook;hook=null;if(action)await action()
   if(mode==='DISCONNECT'){req.socket.destroy();return}if(mode==='REDIRECT'){res.writeHead(302,{location:'https://outside.invalid/history'});res.end();return}
   res.setHeader('content-type','application/json')
   if(req.url==='/mbauth/connect/token'){res.end(JSON.stringify({access_token:'fixture-token',expires_in:3600}));return}
   const body=JSON.parse(data),id=body[0]?.name;selected.push(id)
   const dates=mode==='LARGE'?Array.from({length:12000},(_,i)=>new Date(Date.UTC(1980,0,1+i)).toISOString()):['2026-10-28','2026-10-29','2026-10-30']
   const metadata={Name:id,PrimName:id,FullDescription:'PRIVATE_LICENSED_MARKET_SERIES',Frequency:'daily',Currency:'usd',DisplayUnit:'Currency Unit/Barrel',Source:'src_fixture',LastValueDate:dates.at(-1)}
   if(req.url==='/v1/series/fetchentities')res.end(JSON.stringify([{metadata}]))
   else if(req.url==='/v1/series/fetchseries')res.end(JSON.stringify([{metadata,dates,values:mode==='TRUNCATED'?[1]:mode==='LARGE'?Array(12000).fill(71.25):points}]))
   else{res.statusCode=404;res.end('{}')}
  })
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port
  await root.query(`CREATE DATABASE ${DATABASE}`);created=true
  await root.query("BEGIN;SELECT pg_advisory_xact_lock(170001,20261017)")
  try{for(const [role,login,limit]of[['profitia_ingestion_owner',false,-1],['profitia_market_read_owner',false,-1],[ROLE,true,2],[READ_ROLE,true,1]]){
   if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)await root.query(`CREATE ROLE ${role} ${login?"LOGIN PASSWORD 'isolated_ci_only'":'NOLOGIN'} NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE CONNECTION LIMIT ${limit}`)
   assert.deepEqual((await root.query('SELECT rolsuper,rolbypassrls,rolinherit,rolcanlogin FROM pg_roles WHERE rolname=$1',[role])).rows[0],{rolsuper:false,rolbypassrls:false,rolinherit:false,rolcanlogin:login})
  }await root.query('COMMIT')}catch(e){await root.query('ROLLBACK');throw e}
  owner=new Client({connectionString:u.href});await owner.connect()
  await owner.query(`GRANT CREATE ON DATABASE ${DATABASE} TO profitia_ingestion_owner,profitia_market_read_owner`)
  await owner.query(`CREATE TABLE public.market_series(id text PRIMARY KEY,"providerCode" text NOT NULL,"providerSeriesId" text NOT NULL,"providerSeriesKey" text,"displayName" text NOT NULL,frequency text,currency text,unit text,"sourceLabel" text,"createdAt" timestamptz NOT NULL,"updatedAt" timestamptz NOT NULL,UNIQUE("providerCode","providerSeriesId"));
   CREATE TABLE public.market_observations(id text PRIMARY KEY,"seriesId" text NOT NULL REFERENCES public.market_series(id),"observedAt" timestamptz NOT NULL,value numeric(24,8),"createdAt" timestamptz NOT NULL,"updatedAt" timestamptz NOT NULL,UNIQUE("seriesId","observedAt"));
   CREATE TABLE public.market_hydration_state(id text PRIMARY KEY,"seriesId" text UNIQUE NOT NULL REFERENCES public.market_series(id),"lastProviderFetchAt" timestamptz,"earliestStoredObservationAt" timestamptz,"latestStoredObservationAt" timestamptz,"lastHydrationStatus" text,"lastHydrationMessage" text,"lastHydratedObservationCount" integer,"createdAt" timestamptz NOT NULL,"updatedAt" timestamptz NOT NULL);
   GRANT SELECT,INSERT,UPDATE ON public.market_series,public.market_observations,public.market_hydration_state TO profitia_ingestion_owner;
   GRANT SELECT ON public.market_series,public.market_observations,public.market_hydration_state TO profitia_market_read_owner;`)
  const controlled=async(role,work)=>{await owner.query('BEGIN;SET LOCAL ROLE '+role);try{const x=await work();await owner.query('COMMIT');return x}catch(e){await owner.query('ROLLBACK');throw e}}
  await controlled('profitia_ingestion_owner',async()=>{
   await owner.query(sourceSql);await owner.query("INSERT INTO profitia_ingestion.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','isolated-history','isolated-history-branch',$2)",[hash(sourceSql),DATABASE])
   await owner.query(externalSql);await owner.query("INSERT INTO profitia_external_call.installation VALUES(true,'1.0.0',$1,$2,'development','isolated-history','isolated-history-branch',$3)",[hash(externalSql),hash(sourceSql),DATABASE])
   await owner.query(nativeSql);await owner.query("INSERT INTO profitia_external_native.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",[hash(nativeSql)])
   await owner.query("SELECT set_config('profitia.install.unmetered_digest',$1,true)",[hash(unmeteredSql)]);await owner.query(unmeteredSql)
   await owner.query(writerSql)
   await owner.query("INSERT INTO profitia_ingestion.runtime_bindings(login_role,binding_id,service_id,application_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,'spendguru-market-history','PLATFORM_INTERNAL','synthetic-history','history-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[ROLE,randomUUID(),randomUUID()])
   for(const kind of ['TOKEN','API']){
    const p=historySourcePolicy(kind),policy=randomUUID()
    await owner.query("INSERT INTO profitia_ingestion.sources(source_id,effect_kind,data_class,payload_schema,quality_version,classification_version,projection_version,status,source_ref,expires_at) VALUES($1,'STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE',$2,$3,$4,'source-receipt-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",Object.values(p.source))
    await owner.query("INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,'ALLOW','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[randomUUID(),ROLE,p.source.id])
    await owner.query("INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,quota_mode,status,source_ref) VALUES($1,'spendguru-market-history',$2,'SOURCE_TRANSACTION','UNMETERED','ACTIVE','SYNTHETIC_ONLY')",[randomUUID(),p.source.id])
    await owner.query("INSERT INTO profitia_external_call.policies(policy_id,login_role,source_id,resource_id,configuration_version,origin,transport,path_rules,maximum_request_bytes,maximum_response_bytes,timeout_ms,unit,quota_mode,status,source_ref) VALUES($1,$2,$3,$4,'history-http-v1',$5,'LOCAL_SYNTHETIC_HTTP',$6::jsonb,65536,8388608,20000,'UPSTREAM_ATTEMPT_ADMISSION','UNMETERED','ACTIVE','SYNTHETIC_ONLY')",[policy,ROLE,p.source.id,p.resourceId,origin,JSON.stringify(p.basePathRules)])
    await owner.query("INSERT INTO profitia_external_native.policies(policy_id,base_policy_version,path_rules,redirect_origins,maximum_response_bytes,credential_mode,completion_mode,status,expires_at,source_ref) VALUES($1,1,$2::jsonb,'[]',8388608,$3,'ADMITTED_ATTEMPT_CURRENT_SETTLEMENT','ACTIVE',now()+interval '1 hour','SYNTHETIC_ONLY')",[policy,JSON.stringify(p.pathRules),p.credentialMode])
   }
   await owner.query("INSERT INTO profitia_ingestion.sources(source_id,effect_kind,data_class,payload_schema,quality_version,classification_version,projection_version,status,source_ref,expires_at) VALUES($1,'STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE',$2,$3,$4,'source-receipt-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",Object.values(HISTORY_PERSIST_SOURCE))
   await owner.query("INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,'ALLOW','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[randomUUID(),ROLE,HISTORY_PERSIST_SOURCE.id])
   await owner.query("INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,quota_mode,status,source_ref) VALUES($1,'spendguru-market-history',$2,'SOURCE_TRANSACTION','UNMETERED','ACTIVE','SYNTHETIC_ONLY')",[randomUUID(),HISTORY_PERSIST_SOURCE.id])
   const owners=(await owner.query("SELECT jsonb_object_agg(c.relname,pg_get_userbyid(c.relowner)) owners FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN('market_series','market_observations','market_hydration_state')")).rows[0].owners
   await owner.query("INSERT INTO profitia_market_history.installation VALUES(true,'1.0.0',$1,'isolated-history','isolated-history-branch',$2,$3,$4::jsonb,'SYNTHETIC_ONLY',now()+interval '1 hour')",[hash(writerSql),DATABASE,ROLE,JSON.stringify(owners)])
   await owner.query(`GRANT USAGE ON SCHEMA profitia_ingestion,profitia_external_call,profitia_external_native,profitia_market_history TO ${ROLE};GRANT EXECUTE ON FUNCTION profitia_ingestion.runtime_descriptor(),profitia_ingestion.current_state(text,text),profitia_ingestion.lock_ingestion(text,text,text),profitia_ingestion.scope_allows(text,text),profitia_ingestion.reserve(text,text,text,text,uuid),profitia_ingestion.complete(uuid,uuid),profitia_ingestion.receipt(text,text,text,text),profitia_ingestion.append_audit(jsonb),profitia_external_call.descriptor(text,text),profitia_external_call.apply_control(uuid,uuid,text),profitia_external_call.read_status(uuid,text,text),profitia_external_native.descriptor(text,text),profitia_external_native.permits_status(uuid,integer),profitia_market_history.runtime_descriptor(),profitia_market_history.apply_history(uuid,uuid,text),profitia_market_history.read_receipt(text,text),profitia_market_history.due_series(text,timestamptz,integer) TO ${ROLE}`)
  })
  await controlled('profitia_market_read_owner',async()=>{
   await owner.query(readSql);await owner.query("INSERT INTO profitia_market_read.installation VALUES(true,'1.0.0',$1,'isolated-history','isolated-history-branch',$2,$3,'SYNTHETIC_ONLY',now()+interval '1 hour')",[hash(readSql),DATABASE,READ_ROLE])
   await owner.query(`GRANT USAGE ON SCHEMA profitia_market_read TO ${READ_ROLE};GRANT SELECT ON ALL TABLES IN SCHEMA profitia_market_read TO ${READ_ROLE}`)
  })
  const runtimeUrl=new URL(u);runtimeUrl.username=ROLE;runtimeUrl.password='isolated_ci_only';runtimeUrl.searchParams.set('connection_limit','1')
  prisma=new PrismaClient({datasources:{db:{url:runtimeUrl.href}}});auditPrisma=new PrismaClient({datasources:{db:{url:runtimeUrl.href}}})
  const readUrl=new URL(runtimeUrl);readUrl.username=READ_ROLE;reader=new PrismaClient({datasources:{db:{url:readUrl.href}}})
  const readHistory=createStoredMarketHistoryReader(reader,{projectId:'isolated-history',branchId:'isolated-history-branch',databaseName:DATABASE,role:READ_ROLE,schemaDigest:hash(readSql)})
  process.env.MACROBOND_CLIENT_ID=credentials.clientId;process.env.MACROBOND_CLIENT_SECRET=credentials.clientSecret
  const {createMarketHistoryIngestion}=await import('../lib/market-data/history-ingestion.ts')
  const base={prisma,auditPrisma,readHistory,boundaryDigest:hash(writerSql),application:{appId:'spendguru-market-history',profileId:'PLATFORM_INTERNAL',environment:'development',deploymentId:'synthetic-history',configurationVersion:'history-v1',identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,operations:['knowledge.ingest'],features:['knowledge_ingestion']},binding:{applicationId:'spendguru-market-history',environment:'development',projectId:'isolated-history',branchId:'isolated-history-branch',databaseName:DATABASE,role:ROLE,schemaDigest:hash(sourceSql),unmeteredSchemaDigest:hash(unmeteredSql),deploymentId:'synthetic-history',configurationVersion:'history-v1'},external:{configurationVersion:'history-http-v1',schemaDigest:hash(externalSql),nativeSchemaDigest:hash(nativeSql)},credentials,syntheticOrigin:origin}
  const create=()=>createMarketHistoryIngestion(base),api=create()
  await t.test('generic licensed history crosses actual Source and restricted SQL into the existing canonical reader',async()=>{
   const r=await api.refresh('licensed_alpha','cycle-1');assert.equal(r.history.historical.length,3);assert.equal(r.history.historical[0].value,-37.63);assert.equal(r.receipt.changedObservationCount,3);assert.equal(r.receipt.latestObservationDate,'2026-10-30T00:00:00.000Z');assert.equal(hits,3)
   const replay=await create().refresh('licensed_alpha','cycle-1');assert.equal(replay.replayed,true);assert.equal(hits,3,'completed replay does not repeat provider effects')
   const again=await api.refresh('licensed_alpha','cycle-2');assert.equal(again.receipt.changedObservationCount,0);assert.equal(hits,6)
   assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_market_history.ingestions')).rows[0].n,2)
  })
  await t.test('incremental revisions preserve previous values and never delete absent old dates',async()=>{
   points=[-36.5,null,73];const r=await api.refresh('licensed_alpha','cycle-3');assert.equal(r.receipt.changedObservationCount,2);assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_market_history.revisions')).rows[0].n,5)
   assert.equal((await owner.query('SELECT previous_value::text FROM profitia_market_history.revisions WHERE previous_value IS NOT NULL ORDER BY observed_at LIMIT 1')).rows[0].previous_value,'-37.63000000')
   assert.equal((await owner.query('SELECT count(*)::int n FROM public.market_observations')).rows[0].n,3)
   const before=hits;await assert.rejects(api.refresh('licensed_alpha','cycle-1'));assert.equal(hits,before,'old provenance cannot label newer values as an identical replay')
  })
  await t.test('raw runtime cannot write canonical tables, forge an effect or alter provenance',async()=>{
   for(const sql of ['UPDATE public.market_observations SET value=0','DELETE FROM public.market_series','TRUNCATE profitia_market_history.revisions',"SELECT profitia_market_history.apply_history(null,null,'{}')",'CREATE TABLE public.bypass(id integer)'])await assert.rejects(prisma.$executeRawUnsafe(sql))
   const acl=await prisma.$queryRawUnsafe("SELECT has_table_privilege(current_user,'public.market_observations','INSERT,UPDATE') AS can_write");assert.equal(acl[0].can_write,false)
  })
  await t.test('truncated provider history is rejected before canonical writes',async()=>{
   mode='TRUNCATED';await assert.rejects(api.refresh('licensed_beta','bad-shape'));mode='NORMAL';assert.equal((await owner.query("SELECT count(*)::int n FROM public.market_series WHERE \"providerSeriesId\"='licensed_beta'")).rows[0].n,0)
  })
  await t.test('SQL persistence failure rolls back observations, revisions and receipts atomically',async()=>{
   const before=(await readHistory('licensed_alpha')).history.historical
   await owner.query('REVOKE INSERT ON public.market_observations FROM profitia_ingestion_owner')
   points=[1,2,3];await assert.rejects(api.refresh('licensed_alpha','failed-write'))
   await owner.query('GRANT INSERT ON public.market_observations TO profitia_ingestion_owner')
   assert.deepEqual((await readHistory('licensed_alpha')).history.historical,before)
   assert.equal((await owner.query("SELECT count(*)::int n FROM profitia_market_history.ingestions WHERE run_id='failed-write'")).rows[0].n,0)
  })
  await t.test('automatic due-list and successful follow-up use the same generic operation',async()=>{
   const due=await api.dueSeries('',new Date().toISOString(),200);assert.deepEqual(due,['licensed_alpha']);const r=await api.refresh('licensed_gamma','cycle-gamma');assert.equal(r.history.historical.length,3);assert(selected.includes('licensed_gamma'))
  })
  await t.test('UNMETERED is explicit and never removes source counters or byte/concurrency limits',async()=>{
   await controlled('profitia_ingestion_owner',()=>owner.query("UPDATE profitia_ingestion.budgets SET consumed_count=1000001 WHERE source_id='sg2.market.history.persist'"))
   const r=await api.refresh('licensed_gamma','unmetered-large-counter');assert.equal(r.receipt.status,'UNCHANGED')
   const b=(await owner.query("SELECT capacity,quota_mode,consumed_count FROM profitia_ingestion.budgets WHERE source_id='sg2.market.history.persist'")).rows[0];assert.equal(b.capacity,null);assert.equal(b.quota_mode,'UNMETERED');assert(Number(b.consumed_count)>1000001)
  })
  await t.test('revocation blocks receipt replay and no new upstream call or persistence occurs',async()=>{
   const before=hits;await controlled('profitia_ingestion_owner',()=>owner.query("UPDATE profitia_ingestion.grants SET status='REVOKED' WHERE source_id='sg2.market.history.persist'"));await assert.rejects(api.refresh('licensed_alpha','cycle-1'));assert.equal(hits,before)
   await controlled('profitia_ingestion_owner',()=>owner.query("UPDATE profitia_ingestion.grants SET status='ACTIVE' WHERE source_id='sg2.market.history.persist'"))
   hook=()=>controlled('profitia_ingestion_owner',()=>owner.query("UPDATE profitia_ingestion.grants SET status='REVOKED' WHERE source_id='sg2.market.history.api'"))
   await assert.rejects(api.refresh('licensed_alpha','revoked-in-flight'))
   assert.equal((await owner.query("SELECT count(*)::int n FROM profitia_market_history.ingestions WHERE run_id='revoked-in-flight'")).rows[0].n,0)
   await controlled('profitia_ingestion_owner',()=>owner.query("UPDATE profitia_ingestion.grants SET status='ACTIVE' WHERE source_id='sg2.market.history.api'"))
  })
  await t.test('uncertain upstream cannot be silently retried by reconstructing the same cycle',async()=>{
   mode='DISCONNECT';await assert.rejects(api.refresh('licensed_delta','uncertain-cycle'));const before=hits;mode='NORMAL';await assert.rejects(create().refresh('licensed_delta','uncertain-cycle'));assert.equal(hits,before)
  })
  await t.test('full histories larger than the original WTI sample are persisted and read back without truncation',async()=>{
   mode='LARGE';const r=await api.refresh('licensed_large','large-cycle');mode='NORMAL';assert.equal(r.history.historical.length,12000);assert.equal(r.receipt.changedObservationCount,12000)
  })
  await t.test('technical concurrency bounds do not become a business download allowance',async()=>{
   const pending=api.refresh('licensed_concurrent','one');await assert.rejects(api.refresh('licensed_other','two'));await pending
  })
  await t.test('Source audit/control contain no provider credentials or raw financial payload',async()=>{
   const data=(await owner.query("SELECT jsonb_build_object('events',(SELECT jsonb_agg(event) FROM profitia_ingestion.security_events),'calls',(SELECT jsonb_agg(to_jsonb(c)) FROM profitia_external_call.calls c))::text AS data")).rows[0].data
   for(const secret of [credentials.clientSecret,'fixture-token','PRIVATE_LICENSED_MARKET_SERIES'])assert(!data.includes(secret))
   assert.equal((await owner.query("SELECT count(*)::int n FROM profitia_ingestion.security_events WHERE phase='OUTCOME'")).rows[0].n>0,true)
  })
 }finally{
  await Promise.allSettled([prisma?.$disconnect(),auditPrisma?.$disconnect(),reader?.$disconnect()]);if(server)await new Promise(resolve=>server.close(resolve));if(owner)await owner.end();if(created)await root.query(`DROP DATABASE ${DATABASE} WITH(FORCE)`);await root.end()
 }
})
