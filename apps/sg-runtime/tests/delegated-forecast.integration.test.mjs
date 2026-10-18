import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {createHash,randomUUID} from 'node:crypto'
import {createRequire} from 'node:module'
import {PrismaClient} from '../generated/market-data-client/index.js'
import {assertIsolatedTestConnection} from '../../architecture-lab/src/operation-postgres-fixture.mjs'
import {createSg2ForecastSourceDelivery,FORECAST_QUEUE_SOURCE} from '../lib/forecast/source-delivery.ts'
import {createSg2ForecastDispatchPersister,createSg2ForecastDelegatedDelivery} from '../lib/forecast/delegated-delivery.ts'
import {createSg2PrivateForecastRequestHost} from '../lib/platform/private-host.ts'
import {createOperationForecastRequestHandler} from '../lib/forecast/request-operation-handlers.ts'
import {NextRequest} from 'next/server.js'
import {PrismaClient as PrivatePrismaClient} from '@prisma/client'
const require=createRequire(import.meta.url),{Client}=createRequire(new URL('../../architecture-lab/package.json',import.meta.url))('pg')
// The native app is CommonJS under tsx. Use its actual SDK loader for opaque
// in-process receipt evidence; a second ESM module instance owns another map.
const {platformReceiptEvidence}=require('@profitia/platform-contracts/platform-ingestion')
const {isOperationDenied}=require('@profitia/platform-contracts/operation-context')
const DATABASE='sg2_native_source_'+randomUUID().replaceAll('-',''),ROLE='sg2_native_forecast_source_fixture',READ_ROLE='sg2_native_forecast_read_fixture'
const SOURCE_OWNER='profitia_ingestion_owner',MARKET_OWNER='profitia_market_read_owner',FORECAST_OWNER='profitia_forecast_read_owner'
const SERIES='native_delegated_forecast_daily',hash=v=>createHash('sha256').update(v).digest('hex')
const read=relative=>fs.readFileSync(new URL(relative,import.meta.url),'utf8')
const sourceSql=read('../../../packages/platform-contracts/migrations/access/008-platform-ingestion.sql')
const marketSql=read('../prisma-market-data/private-read/001-stored-history-read.sql'),forecastSql=read('../prisma-market-data/private-read/002-stored-rolling-current.sql')
const nativeSql=read('../prisma-market-data/private-write/001-forecast-queue.sql')
const tables=['rolling_daily_current_forecast_snapshots','forecast_current_runs','forecast_current_points','forecast_verification_runs',
  'forecast_verification_metrics','forecast_verification_points','rolling_daily_verification_records','rolling_daily_maintenance_state']

test('genuine native Forecast queue is admitted by one funded source transaction with no global client fallback',async t=>{
  const rootUrl=assertIsolatedTestConnection(process.env.SG2_OPERATION_TEST_OWNER_URL,'sg2_operation_test','architecture_test_owner')
  const root=new Client({connectionString:rootUrl});await root.connect()
  const ownerUrl=new URL(rootUrl);ownerUrl.pathname='/'+DATABASE
  let owner,business,audit
  const previousFetch=globalThis.fetch;let networkCalls=0
  globalThis.fetch=async()=>{networkCalls++;throw Error('Native stored queue cannot contact a provider')}
  try{
    assert.equal((await root.query('SELECT 1 FROM pg_database WHERE datname=$1',[DATABASE])).rowCount,0,'Never adopt an existing database')
    await root.query(`CREATE DATABASE ${DATABASE}`)
    const schemaDir=fs.mkdtempSync(path.join(os.tmpdir(),'e1-native-source-schema-'))
    const schemaFile=path.join(schemaDir,'schema.prisma');fs.writeFileSync(schemaFile,read('../prisma-market-data/schema.prisma'),{mode:0o600})
    const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!['TOKEN','SECRET','PASSWORD','DATABASE_URL'].some(part=>key.includes(part))))
    Object.assign(env,{MARKET_DATA_DATABASE_URL:ownerUrl.toString(),MARKET_DATA_DIRECT_URL:ownerUrl.toString(),CHECKPOINT_DISABLE:'1',PRISMA_HIDE_UPDATE_MESSAGE:'1'})
    const pushed=spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),'db','push','--skip-generate','--schema',schemaFile],{cwd:schemaDir,env,encoding:'utf8',timeout:45000})
    assert.equal(pushed.status,0,(pushed.stderr||pushed.stdout||'Schema bootstrap failed').slice(-2500))
    owner=new Client({connectionString:ownerUrl.toString()});await owner.connect()
    assert.equal((await owner.query('SELECT current_database() AS db')).rows[0].db,DATABASE)
    await root.query("BEGIN;SET LOCAL lock_timeout='5s';SELECT pg_advisory_xact_lock(170001,20261017)")
    try{for(const[role,login,limit]of[[SOURCE_OWNER,false,-1],[MARKET_OWNER,false,-1],[FORECAST_OWNER,false,-1],[ROLE,true,2],[READ_ROLE,true,1]]){
      if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)
        await root.query(`CREATE ROLE ${role} ${login?"LOGIN PASSWORD 'isolated_ci_only'":'NOLOGIN'} NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS CONNECTION LIMIT ${limit}`)
      assert.deepEqual((await root.query('SELECT rolsuper,rolbypassrls,rolinherit,rolcanlogin,rolconnlimit FROM pg_roles WHERE rolname=$1',[role])).rows[0],
        {rolsuper:false,rolbypassrls:false,rolinherit:false,rolcanlogin:login,rolconnlimit:limit})
    }await root.query('COMMIT')}catch(error){await root.query('ROLLBACK');throw error}
    const asOwner=async(role,work)=>{await owner.query(`BEGIN;SET LOCAL ROLE ${role}`)
      try{const r=await work();await owner.query('COMMIT');return r}catch(error){await owner.query('ROLLBACK');throw error}}
    await owner.query(`GRANT CREATE ON DATABASE ${DATABASE} TO ${SOURCE_OWNER},${MARKET_OWNER},${FORECAST_OWNER};GRANT USAGE ON SCHEMA public TO ${SOURCE_OWNER},${MARKET_OWNER},${FORECAST_OWNER};GRANT SELECT ON public.market_series,public.market_observations TO ${MARKET_OWNER}`)
    for(const table of tables)await owner.query(`GRANT SELECT ON public.${table} TO ${FORECAST_OWNER}`)
    await owner.query(`GRANT SELECT,REFERENCES ON public.forecast_preparation_job TO ${SOURCE_OWNER}`)
    await asOwner(MARKET_OWNER,async()=>{await owner.query(marketSql);await owner.query("INSERT INTO profitia_market_read.installation VALUES(true,'1.0.0',$1,'isolated-native-source-project','isolated-native-source-branch',$2,$3,'SYNTHETIC_ONLY',now()+interval '1 hour')",[hash(marketSql),DATABASE,READ_ROLE])})
    await asOwner(MARKET_OWNER,()=>owner.query(`GRANT USAGE ON SCHEMA profitia_market_read TO ${FORECAST_OWNER},${SOURCE_OWNER},${ROLE};GRANT SELECT ON profitia_market_read.series TO ${FORECAST_OWNER};GRANT SELECT ON profitia_market_read.installation TO ${SOURCE_OWNER};GRANT SELECT ON profitia_market_read.series,profitia_market_read.observations TO ${ROLE}`))
    await asOwner(FORECAST_OWNER,async()=>{await owner.query(forecastSql);await owner.query("INSERT INTO profitia_forecast_read.installation VALUES(true,'3.0.2',$1,$2,'isolated-native-source-project','isolated-native-source-branch',$3,$4,'SYNTHETIC_ONLY',now()+interval '1 hour')",[hash(forecastSql),hash(marketSql),DATABASE,READ_ROLE])})
    await asOwner(FORECAST_OWNER,()=>owner.query(`GRANT USAGE ON SCHEMA profitia_forecast_read TO ${SOURCE_OWNER},${ROLE};GRANT SELECT ON profitia_forecast_read.installation TO ${SOURCE_OWNER};GRANT SELECT ON profitia_forecast_read.rolling_daily_current_forecast_snapshots,profitia_forecast_read.forecast_current_runs,profitia_forecast_read.forecast_current_points,profitia_forecast_read.forecast_verification_runs,profitia_forecast_read.forecast_verification_metrics,profitia_forecast_read.forecast_verification_points,profitia_forecast_read.rolling_daily_verification_records,profitia_forecast_read.rolling_daily_maintenance_state,profitia_forecast_read.forecast_current_states,profitia_forecast_read.forecast_verification_states TO ${ROLE};GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA profitia_forecast_read TO ${ROLE}`))
    // A separate ordinary read login owns its own receipt. The controlled
    // source owner needs explicit metadata visibility; the native login does
    // not gain table access, membership or a second read-login receipt.
    for(const [role,schema]of[[MARKET_OWNER,'profitia_market_read'],[FORECAST_OWNER,'profitia_forecast_read']])
      await asOwner(role,()=>owner.query(`CREATE POLICY native_source_receipt_metadata ON ${schema}.installation FOR SELECT TO ${SOURCE_OWNER} USING(current_user='profitia_ingestion_owner')`))
    await asOwner(SOURCE_OWNER,async()=>{
      await owner.query(sourceSql);await owner.query("INSERT INTO profitia_ingestion.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','isolated-native-source-project','isolated-native-source-branch',$2)",[hash(sourceSql),DATABASE])
      await owner.query("INSERT INTO profitia_ingestion.runtime_bindings(login_role,binding_id,service_id,application_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,'spendguru-forecast-source','PLATFORM_INTERNAL','native-source-fixture','native-source-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[ROLE,randomUUID(),randomUUID()])
      await owner.query("INSERT INTO profitia_ingestion.sources(source_id,effect_kind,data_class,payload_schema,quality_version,classification_version,projection_version,status,source_ref,expires_at) VALUES($1,'STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE',$2,$3,$4,'native-queue-receipt-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[FORECAST_QUEUE_SOURCE.id,FORECAST_QUEUE_SOURCE.payloadSchema,FORECAST_QUEUE_SOURCE.qualityVersion,FORECAST_QUEUE_SOURCE.classificationVersion])
      await owner.query("INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,'ALLOW','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[randomUUID(),ROLE,FORECAST_QUEUE_SOURCE.id])
      await owner.query("INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,'spendguru-forecast-source',$2,'SOURCE_TRANSACTION',4,now()-interval '1 hour',now()+interval '1 hour',now()+interval '1 hour','ACTIVE','SYNTHETIC_ONLY')",[randomUUID(),FORECAST_QUEUE_SOURCE.id])
      await owner.query('SAVEPOINT native_boundary_candidate')
      await owner.query(nativeSql)
      await assert.rejects(owner.query("DO $$BEGIN RAISE EXCEPTION 'synthetic native boundary migration outage';END$$"))
      await owner.query('ROLLBACK TO SAVEPOINT native_boundary_candidate;RELEASE SAVEPOINT native_boundary_candidate')
      assert.equal((await owner.query("SELECT to_regnamespace('profitia_forecast_admission') AS schema")).rows[0].schema,null)
      await owner.query(nativeSql)
      await owner.query("INSERT INTO profitia_forecast_admission.installation VALUES(true,'1.0.0',$1,$2,$3,$4,'isolated-native-source-project','isolated-native-source-branch',$5,$6,'architecture_test_owner','architecture_test_owner','SYNTHETIC_ONLY',now()+interval '1 hour')",[hash(nativeSql),hash(sourceSql),hash(marketSql),hash(forecastSql),DATABASE,ROLE])
      await owner.query(`GRANT USAGE ON SCHEMA profitia_ingestion,profitia_forecast_admission TO ${ROLE};GRANT EXECUTE ON FUNCTION profitia_ingestion.runtime_descriptor(),profitia_ingestion.lock_ingestion(text,text,text),profitia_ingestion.scope_allows(text,text),profitia_ingestion.reserve(text,text,text,text,uuid),profitia_ingestion.complete(uuid,uuid),profitia_ingestion.append_audit(jsonb),profitia_forecast_admission.runtime_descriptor(),profitia_forecast_admission.bind_effect(uuid,uuid,text),profitia_forecast_admission.scope_allows(text),profitia_forecast_admission.record_delivery(uuid,uuid,text,text,text) TO ${ROLE}`)
    })
    await owner.query(`REVOKE CREATE ON DATABASE ${DATABASE} FROM ${SOURCE_OWNER},${MARKET_OWNER},${FORECAST_OWNER}`)
    await owner.query('SELECT profitia_forecast_admission.install_runtime_fences()')
    await owner.query('INSERT INTO public.market_series(id,"providerCode","providerSeriesId","displayName",frequency,unit,"sourceLabel","updatedAt") VALUES($1,\'MACROBOND\',$2,\'Native shared source\',\'DAILY\',\'ORIGINAL_UNIT\',\'Synthetic\',now())',['native-series',SERIES])
    await owner.query("INSERT INTO public.market_observations(id,\"seriesId\",\"observedAt\",value,\"updatedAt\") SELECT 'native-point-'||n,'native-series',date '2023-01-01'+n,100+n*0.05,now() FROM generate_series(0,899) n")
    const runtimeUrl=new URL(ownerUrl);runtimeUrl.username=ROLE;runtimeUrl.password='isolated_ci_only';runtimeUrl.searchParams.set('connection_limit','1')
    business=new PrismaClient({datasources:{db:{url:runtimeUrl.toString()}}});audit=new PrismaClient({datasources:{db:{url:runtimeUrl.toString()}}})
    const port=createSg2ForecastSourceDelivery({prisma:business,auditPrisma:audit,boundaryDigest:hash(nativeSql),
      application:{appId:'spendguru-forecast-source',profileId:'PLATFORM_INTERNAL',deploymentId:'native-source-fixture',configurationVersion:'native-source-v1',
        environment:'development',identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,features:['knowledge_ingestion'],operations:['knowledge.ingest']},
      binding:{applicationId:'spendguru-forecast-source',environment:'development',deploymentId:'native-source-fixture',configurationVersion:'native-source-v1',projectId:'isolated-native-source-project',
        branchId:'isolated-native-source-branch',databaseName:DATABASE,role:ROLE,schemaDigest:hash(sourceSql)},
    })
    const command={seriesId:SERIES,modelId:'naive',targetSemantics:'MONTHLY_AVERAGE',kind:'CURRENT'}
    const input={sourceId:FORECAST_QUEUE_SOURCE.id,deliveryKey:'native_source_current_delivery_000001',payload:command}
    await t.test('ordinary role cannot write queue or telemetry without a funded source effect',async()=>{
      const d=(await business.$queryRawUnsafe('SELECT profitia_forecast_admission.runtime_descriptor() AS d'))[0].d
      assert(d);assert.equal(d.fencesInstalled,true)
      await assert.rejects(business.forecastPreparationJob.create({data:{jobKey:'forged',jobKind:'CURRENT',status:'QUEUED',priority:10,seriesId:SERIES,targetBasis:'MONTHLY_AVERAGE',
        targetSemantics:'MONTHLY_AVERAGE',modelId:'naive',sourceFrequency:'DAILY',targetCadence:'MONTHLY',historyFingerprint:'unfunded'}}))
      await assert.rejects(business.$queryRawUnsafe('SELECT profitia_forecast_admission.install_runtime_fences()'))
      assert.deepEqual(await business.forecastPreparationJob.findMany(),[])
      await assert.rejects(business.forecastActionTrace.create({data:{correlationId:randomUUID(),actionType:'CURRENT_PREPARATION',seriesId:SERIES,
        targetBasis:'MONTHLY_AVERAGE',targetSemantics:'MONTHLY_AVERAGE',modelId:'naive',actionRequestedAt:new Date(),eventsJson:[],eventCount:0}}),/row.level security/i)
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM public.forecast_preparation_job')).rows[0].n,0)
    })
    let receipt
    await t.test('actual original queue enqueue, telemetry, source receipt and budget commit once through generated Prisma',async()=>{
      receipt=await port.deliver(input);assert.equal(receipt.status,'COMMITTED');assert(platformReceiptEvidence(receipt))
      assert.equal(platformReceiptEvidence(structuredClone(receipt)),null,'Serialized receipts never carry source commit evidence')
      const job=(await owner.query('SELECT * FROM public.forecast_preparation_job')).rows[0]
      assert(job);assert.equal(job.seriesId,SERIES);assert.equal(job.modelId,'naive');assert.equal(job.status,'QUEUED');assert.equal(job.requestCount,1)
      assert.equal((await owner.query('SELECT consumed_count FROM profitia_ingestion.budgets')).rows[0].consumed_count,1)
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM profitia_forecast_admission.deliveries')).rows[0].n,1)
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM public.forecast_action_trace')).rows[0].n,1)
      assert.equal((await port.deliver(input)).effectId,receipt.effectId)
      assert.equal((await owner.query('SELECT "requestCount" FROM public.forecast_preparation_job')).rows[0].requestCount,1)
      const journals=(await owner.query('SELECT event FROM profitia_ingestion.security_events')).rows.map(r=>r.event)
      assert(journals.every(e=>e.organisationId===null&&e.subjectUserId===null));assert.equal(journals.filter(e=>e.phase==='OUTCOME').length,2)
    })
    await t.test('changed command conflicts and private fields are rejected without source hydration or duplicate queue writes',async()=>{
      await assert.rejects(port.deliver({...input,payload:{...command,modelId:'arima'}}),e=>isOperationDenied(e)&&e.reasonCode==='IDEMPOTENCY_CONFLICT')
      await assert.rejects(port.deliver({...input,payload:{...command,organisationId:randomUUID()}}),isOperationDenied)
      assert.equal(networkCalls,0);assert.equal((await owner.query('SELECT count(*)::int AS n FROM public.forecast_preparation_job')).rows[0].n,1)
      assert.equal((await owner.query("SELECT count(*)::int AS n FROM pg_namespace WHERE nspname IN('profitia_access','profitia_jobs')")).rows[0].n,0)
    })
    await t.test('native receipt failure rolls back original queue changes, telemetry and finite source charge together',async()=>{
      await asOwner(SOURCE_OWNER,()=>owner.query("CREATE FUNCTION profitia_forecast_admission.reject_delivery_fixture() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'synthetic source receipt outage';END$$;CREATE TRIGGER reject_delivery_fixture BEFORE INSERT ON profitia_forecast_admission.deliveries FOR EACH ROW EXECUTE FUNCTION profitia_forecast_admission.reject_delivery_fixture()"))
      try{
        await assert.rejects(port.deliver({...input,deliveryKey:'native_source_rollback_delivery_000002'}),isOperationDenied)
        assert.equal((await owner.query('SELECT "requestCount" FROM public.forecast_preparation_job')).rows[0].requestCount,1)
        assert.equal((await owner.query('SELECT consumed_count FROM profitia_ingestion.budgets')).rows[0].consumed_count,1)
        assert.equal((await owner.query('SELECT count(*)::int AS n FROM public.forecast_action_trace')).rows[0].n,1)
        assert.equal((await owner.query('SELECT count(*)::int AS n FROM profitia_ingestion.effects')).rows[0].n,1)
      }finally{await asOwner(SOURCE_OWNER,()=>owner.query('DROP TRIGGER reject_delivery_fixture ON profitia_forecast_admission.deliveries;DROP FUNCTION profitia_forecast_admission.reject_delivery_fixture()'))}
    })
    await t.test('current source revocation and missing projection metadata refuse a previously funded key',async()=>{
      await asOwner(SOURCE_OWNER,()=>owner.query("UPDATE profitia_ingestion.grants SET status='REVOKED'"))
      await assert.rejects(port.deliver(input),isOperationDenied)
      await asOwner(SOURCE_OWNER,()=>owner.query("UPDATE profitia_ingestion.grants SET status='ACTIVE'"))
      await asOwner(MARKET_OWNER,()=>owner.query('DROP POLICY native_source_receipt_metadata ON profitia_market_read.installation'))
      await assert.rejects(port.deliver(input),isOperationDenied)
      await asOwner(MARKET_OWNER,()=>owner.query(`CREATE POLICY native_source_receipt_metadata ON profitia_market_read.installation FOR SELECT TO ${SOURCE_OWNER} USING(current_user='profitia_ingestion_owner')`))
      assert.equal((await port.deliver(input)).effectId,receipt.effectId)
      assert.equal((await owner.query('SELECT consumed_count FROM profitia_ingestion.budgets')).rows[0].consumed_count,1)
    })
    await t.test('accidental broad queue rights still cannot truncate or erase scientific state',async()=>{
      await owner.query(`GRANT DELETE,TRUNCATE ON public.forecast_preparation_job TO ${ROLE}`)
      try{
        await assert.rejects(business.$executeRawUnsafe('TRUNCATE public.forecast_preparation_job CASCADE'))
        assert.equal(await business.$executeRawUnsafe('DELETE FROM public.forecast_preparation_job'),0)
        await assert.rejects(port.deliver(input),isOperationDenied)
        assert.equal((await owner.query('SELECT count(*)::int AS n FROM public.forecast_preparation_job')).rows[0].n,1)
      }finally{await owner.query(`REVOKE DELETE,TRUNCATE ON public.forecast_preparation_job FROM ${ROLE}`)}
    })
    await t.test('readonly projections and native helpers refuse accidental writes and grant options including column-only rights',async()=>{
      for(const[role,grant,revoke]of[
        [MARKET_OWNER,`GRANT UPDATE ON profitia_market_read.series TO ${ROLE}`,`REVOKE UPDATE ON profitia_market_read.series FROM ${ROLE}`],
        [MARKET_OWNER,`GRANT UPDATE("displayName") ON profitia_market_read.series TO ${ROLE}`,`REVOKE UPDATE("displayName") ON profitia_market_read.series FROM ${ROLE}`],
        [MARKET_OWNER,`GRANT SELECT("displayName") ON profitia_market_read.series TO ${ROLE} WITH GRANT OPTION`,`REVOKE SELECT("displayName") ON profitia_market_read.series FROM ${ROLE}`],
        [SOURCE_OWNER,`GRANT EXECUTE ON FUNCTION profitia_forecast_admission.bind_effect(uuid,uuid,text) TO ${ROLE} WITH GRANT OPTION`,`REVOKE GRANT OPTION FOR EXECUTE ON FUNCTION profitia_forecast_admission.bind_effect(uuid,uuid,text) FROM ${ROLE}`],
      ]){
        await asOwner(role,()=>owner.query(grant))
        try{assert.equal((await business.$queryRawUnsafe('SELECT profitia_forecast_admission.runtime_descriptor() AS d'))[0].d,null);await assert.rejects(port.deliver(input),isOperationDenied)}
        finally{await asOwner(role,()=>owner.query(revoke))}
      }
      await owner.query(`GRANT SELECT("jobKey") ON public.forecast_preparation_job TO ${ROLE} WITH GRANT OPTION`)
      try{await assert.rejects(port.deliver(input),isOperationDenied)}
      finally{await owner.query(`REVOKE SELECT("jobKey") ON public.forecast_preparation_job FROM ${ROLE}`)}
      assert.equal((await port.deliver(input)).effectId,receipt.effectId)
      assert.equal((await owner.query('SELECT consumed_count FROM profitia_ingestion.budgets')).rows[0].consumed_count,1)
    })
    await t.test('native human API and current SERVICE delegation deliver the original command across two real databases',async st=>{
      await provePrivateDispatch(st,{root,rootUrl,sourceOwner:owner,sourceDelivery:port,sourceDatabase:DATABASE,command})
    })
  }finally{globalThis.fetch=previousFetch;await business?.$disconnect();await audit?.$disconnect();await owner?.end();await root.end()}
})

async function provePrivateDispatch(t,{root,rootUrl,sourceOwner,sourceDelivery,sourceDatabase,command}){
  const database='sg2_native_private_'+randomUUID().replaceAll('-',''),FOREGROUND='sg2_native_dispatch_foreground_fixture',EXECUTOR='sg2_native_dispatch_executor_fixture'
  const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',U='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const issuer='https://identity.fixture.test',origin='http://localhost:3001',future=()=>new Date(Date.now()+3600000).toISOString()
  const names=['001-internal-access.sql','002-module-scope.sql','003-module-audit.sql','005-service-read.sql','006-request-reservation.sql','007-delegated-jobs.sql']
  const sql=names.map(n=>read('../../../packages/platform-contracts/migrations/access/'+n)),digests=sql.map(hash)
  const commands=read('../prisma/private-store/003-forecast-requests.sql'),dispatch=read('../prisma/private-store/004-forecast-dispatch.sql')
  let owner,foreground,foregroundAudit,executor,executorAudit,banned=false
  const url=new URL(rootUrl);url.pathname='/'+database
  try{
    assert.equal((await root.query('SELECT 1 FROM pg_database WHERE datname=$1',[database])).rowCount,0)
    await root.query(`CREATE DATABASE ${database}`)
    await root.query("BEGIN;SET LOCAL lock_timeout='5s';SELECT pg_advisory_xact_lock(170001,20261017)")
    try{for(const[role,login]of[['profitia_access_owner',false],[FOREGROUND,true],[EXECUTOR,true]]){
      if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)
        await root.query(`CREATE ROLE ${role} ${login?"LOGIN PASSWORD 'isolated_ci_only' CONNECTION LIMIT 2":'NOLOGIN'} NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`)
      assert.deepEqual((await root.query('SELECT rolsuper,rolbypassrls,rolinherit,rolcanlogin FROM pg_roles WHERE rolname=$1',[role])).rows[0],{rolsuper:false,rolbypassrls:false,rolinherit:false,rolcanlogin:login})
    }await root.query('COMMIT')}catch(e){await root.query('ROLLBACK');throw e}
    owner=new Client({connectionString:url.toString()});await owner.connect()
    const controlled=async work=>{await owner.query('BEGIN;SET LOCAL ROLE profitia_access_owner');try{const result=await work();await owner.query('COMMIT');return result}catch(e){await owner.query('ROLLBACK');throw e}}
    await owner.query(`GRANT CREATE ON DATABASE ${database} TO profitia_access_owner`)
    const bindingId=randomUUID(),externalId=randomUUID(),serviceId=randomUUID()
    await controlled(async()=>{
      for(let i=0;i<sql.length;i++){
        await owner.query(sql[i])
        const insert=[
          "INSERT INTO profitia_access.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','native-private-project','native-private-branch',$2)",
          "INSERT INTO profitia_modules.installation VALUES(true,'1.0.0',$1)",
          "INSERT INTO profitia_modules.audit_installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",
          "INSERT INTO profitia_services.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",
          "INSERT INTO profitia_requests.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",
          "INSERT INTO profitia_jobs.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",
        ][i]
        await owner.query(insert,i===0?[digests[i],database]:[digests[i]])
      }
      await owner.query(commands);await owner.query("INSERT INTO profitia_forecast_requests.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",[hash(commands)])
      await owner.query('SAVEPOINT native_private_boundary_candidate');await owner.query(dispatch)
      await assert.rejects(owner.query("DO $$BEGIN RAISE EXCEPTION 'synthetic private boundary migration outage';END$$"))
      await owner.query('ROLLBACK TO SAVEPOINT native_private_boundary_candidate;RELEASE SAVEPOINT native_private_boundary_candidate')
      assert.equal((await owner.query("SELECT to_regnamespace('profitia_forecast_dispatch') AS schema")).rows[0].schema,null)
      await owner.query(dispatch);await owner.query("INSERT INTO profitia_forecast_dispatch.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_ONLY')",[hash(dispatch)])
      await owner.query("INSERT INTO profitia_access.applications(application_id,status) VALUES('spendguru','ACTIVE'),('spendguru-forecast-dispatch','ACTIVE')")
      await owner.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES($1,'spendguru','ACTIVE'),($2,'spendguru-forecast-dispatch','ACTIVE')",[FOREGROUND,EXECUTOR])
      await owner.query("INSERT INTO profitia_services.runtime_bindings(login_role,binding_id,service_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,'PLATFORM_INTERNAL','native-dispatch-fixture','dispatch-v1','ACTIVE','SYNTHETIC_ONLY',$4)",[EXECUTOR,randomUUID(),serviceId,future()])
      await owner.query("INSERT INTO profitia_access.accounts(user_id,status) VALUES($1,'ACTIVE')",[U])
      await owner.query("INSERT INTO profitia_access.external_identities(binding_id,issuer,subject,user_id,status,source_ref,expires_at) VALUES($1,$2,'native-external-user',$3,'ACTIVE','SYNTHETIC_ONLY',$4)",[externalId,issuer,U,future()])
      for(const org of[A,B])await owner.query("INSERT INTO profitia_access.organisations(organisation_id,status) VALUES($1,'ACTIVE')",[org])
      await owner.query("INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at) VALUES($1,$2,'ACTIVE','SYNTHETIC_ONLY',$3)",[A,U,future()])
      await owner.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES('spendguru',$1,'SPENDGURU',ARRAY['benchmark','forecast'],'ACTIVE','EXPLICIT_OFFER','SYNTHETIC_ONLY',$2)",[A,future()])
      await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'spendguru',$2,$3,'ALLOW','forecast.request','forecast')",[randomUUID(),A,U])
      await owner.query("INSERT INTO profitia_modules.application_bindings(binding_id,application_id,module_id,status,source_ref,expires_at) VALUES($1,'spendguru','benchmark','ACTIVE','SYNTHETIC_ONLY',$2)",[randomUUID(),future()])
      await owner.query("INSERT INTO profitia_requests.policies(policy_id,application_id,organisation_id,operation,status,source_ref,window_start,window_end,expires_at,capacity) VALUES($1,'spendguru',$2,'forecast.request','ACTIVE','SYNTHETIC_ONLY',now()-interval '1 hour',now()+interval '2 hours',$3,10)",[randomUUID(),A,future()])
      await owner.query("INSERT INTO profitia_jobs.operation_bindings(binding_id,application_id,operation,foreground_role,profile_id,configuration_version,executor_application_id,source_id,source_project_id,source_branch_id,source_database_name,source_application_id,source_schema_digest,source_payload_schema,source_quality_version,source_classification_version,delegation_ttl_seconds,max_attempts,status,source_ref,expires_at) VALUES($1,'spendguru','forecast.request',$2,'SPENDGURU_SAAS','native-request-v1','spendguru-forecast-dispatch',$3,'isolated-native-source-project','isolated-native-source-branch',$4,'spendguru-forecast-source',$5,$6,$7,$8,300,3,'ACTIVE','SYNTHETIC_ONLY',$9)",[bindingId,FOREGROUND,FORECAST_QUEUE_SOURCE.id,sourceDatabase,hash(sourceSql),FORECAST_QUEUE_SOURCE.payloadSchema,FORECAST_QUEUE_SOURCE.qualityVersion,FORECAST_QUEUE_SOURCE.classificationVersion,future()])
      await owner.query("INSERT INTO profitia_jobs.execution_grants(grant_id,login_role,binding_id,organisation_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'ALLOW','ACTIVE','SYNTHETIC_ONLY',$5)",[randomUUID(),EXECUTOR,bindingId,A,future()])
      await owner.query(`GRANT USAGE ON SCHEMA profitia_access,profitia_modules,profitia_requests,profitia_jobs,profitia_forecast_requests TO ${FOREGROUND};GRANT EXECUTE ON FUNCTION profitia_access.runtime_descriptor(),profitia_access.identity_binding(text,text),profitia_access.lock_access(uuid,uuid,text,text,text),profitia_access.scope_allows(text,uuid,uuid),profitia_access.append_audit(jsonb),profitia_modules.runtime_descriptor(),profitia_modules.bind_scope(text),profitia_modules.scope_allows(text,uuid,uuid),profitia_modules.audit_descriptor(),profitia_requests.runtime_descriptor(),profitia_requests.scope_allows(uuid,uuid,text),profitia_requests.policy(uuid,uuid,text),profitia_requests.reserve(uuid,uuid,text,text,text,text,uuid,uuid,bigint),profitia_requests.accept(uuid,uuid),profitia_jobs.runtime_descriptor(),profitia_jobs.create_dispatch(uuid,uuid,text) TO ${FOREGROUND};GRANT SELECT ON profitia_requests.intents,profitia_forecast_requests.installation,profitia_forecast_requests.commands TO ${FOREGROUND};GRANT INSERT ON profitia_forecast_requests.commands TO ${FOREGROUND}`)
      await owner.query(`GRANT USAGE ON SCHEMA profitia_access,profitia_services,profitia_jobs,profitia_forecast_dispatch TO ${EXECUTOR};GRANT EXECUTE ON FUNCTION profitia_access.runtime_descriptor(),profitia_services.runtime_descriptor(),profitia_jobs.runtime_descriptor(),profitia_jobs.current_job(uuid),profitia_jobs.lock_job(uuid,text),profitia_jobs.scope_allows(uuid),profitia_jobs.claim_dispatch(uuid),profitia_jobs.delivery_state(uuid,uuid),profitia_jobs.observe_delivery(uuid,uuid,text,uuid,text,text),profitia_jobs.append_audit(jsonb),profitia_forecast_dispatch.command(uuid) TO ${EXECUTOR}`)
    })
    await owner.query(`REVOKE CREATE ON DATABASE ${database} FROM profitia_access_owner`)
    const client=role=>{const u=new URL(url);u.username=role;u.password='isolated_ci_only';u.searchParams.set('connection_limit','1');return new PrivatePrismaClient({datasources:{db:{url:u.toString()}}})}
    foreground=client(FOREGROUND);foregroundAudit=client(FOREGROUND);executor=client(EXECUTOR);executorAudit=client(EXECUTOR)
    const clerk={async authenticateRequest(){return{status:'signed-in',isAuthenticated:true,toAuth:()=>({isAuthenticated:true,tokenType:'session_token',userId:'native-external-user',sessionId:'native-session',actor:null,sessionClaims:{iss:issuer,sub:'native-external-user',sid:'native-session',azp:origin,exp:Math.floor(Date.now()/1000)+3600}})}},sessions:{async getSession(){return{id:'native-session',userId:'native-external-user',status:'active',expireAt:Date.now()+3600000,abandonAt:Date.now()+3600000,actor:null}}},users:{async getUser(id){return{id,banned,locked:false,deprovisioned:false}}}}
    const foregroundBinding={applicationId:'spendguru',environment:'development',projectId:'native-private-project',branchId:'native-private-branch',databaseName:database,role:FOREGROUND,schemaDigest:digests[0]}
    const foregroundHost=createSg2PrivateForecastRequestHost({prisma:foreground,auditPrisma:foregroundAudit,clerk,binding:foregroundBinding,
      application:{appId:'spendguru',environment:'development',profileId:'SPENDGURU_SAAS',deploymentId:'native-human-api',configurationVersion:'native-request-v1',identityIssuer:issuer,organisationId:null,operations:['forecast.request'],features:['forecast']},
      identity:{appId:'spendguru',environment:'development',issuer,authorizedParties:[origin]},module:{id:'benchmark',schemaDigest:digests[1],auditSchemaDigest:digests[2]},requestLedgerDigest:digests[4],commandBoundaryDigest:hash(commands)})
    const persist=createSg2ForecastDispatchPersister({binding:foregroundBinding,jobSchemaDigest:digests[5]})
    const handler=createOperationForecastRequestHandler(foregroundHost,A,persist)
    const delivery=createSg2ForecastDelegatedDelivery({application:{appId:'spendguru-forecast-dispatch',environment:'development',profileId:'PLATFORM_INTERNAL',deploymentId:'native-dispatch-fixture',configurationVersion:'dispatch-v1',identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,operations:['job.execute'],features:['job_execution']},
      binding:{...foregroundBinding,applicationId:'spendguru-forecast-dispatch',role:EXECUTOR,service:{profileId:'PLATFORM_INTERNAL',deploymentId:'native-dispatch-fixture',configurationVersion:'dispatch-v1',schemaDigest:digests[3]}},
      jobSchemaDigest:digests[5],commandProjectionDigest:hash(dispatch),identityIssuer:issuer,prisma:executor,auditPrisma:executorAudit,clerk,sourceDelivery})
    const request=(key,org=A)=>new NextRequest(origin+'/api/benchmark/forecast/requests?organisationId='+org,{method:'POST',headers:{authorization:'Bearer synthetic-native-session','content-type':'application/json','idempotency-key':key},body:JSON.stringify(command)})
    const submit=async()=>{const key='native_private_request_'+randomUUID();const r=await handler(request(key));assert.equal(r.status,202,JSON.stringify(await r.clone().json()));return{...(await r.json()),key}}
    let accepted
    await t.test('actual API reserves command and delegation atomically; native executor has no private table ACL',async()=>{
      accepted=await submit();assert.equal((await owner.query('SELECT status FROM profitia_jobs.dispatches WHERE job_id=$1',[accepted.requestId])).rows[0].status,'PENDING')
      assert.equal((await handler(request(accepted.key))).status,202)
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM profitia_jobs.dispatches')).rows[0].n,1)
      await assert.rejects(executor.$queryRawUnsafe('SELECT * FROM profitia_forecast_requests.commands'),/permission denied/i)
      await assert.rejects(delivery.deliver(randomUUID()),isOperationDenied)
      assert.equal((await handler(request('foreign_org_request_'+randomUUID(),B))).status,403)
    })
    await t.test('two genuine drivers commit one shared queue effect and one private confirmation without impersonating the user',async()=>{
      assert.equal((await delivery.deliver(accepted.requestId)).value.status,'CONFIRMED')
      assert.equal((await delivery.deliver(accepted.requestId)).value.status,'CONFIRMED')
      assert.equal((await sourceOwner.query('SELECT "requestCount" FROM public.forecast_preparation_job')).rows[0].requestCount,2)
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM profitia_jobs.delivery_observations')).rows[0].n,1)
      const events=(await owner.query("SELECT event FROM profitia_access.security_events WHERE event->>'operation'='job.execute'")).rows.map(r=>r.event)
      assert(events.length>=4);assert(events.every(e=>e.actorKind==='SERVICE'&&e.actorId===serviceId&&e.subjectUserId===U&&e.organisationId===A))
    })
    await t.test('current external ban and internal membership revocation prevent pending delivery',async()=>{
      const pending=await submit();banned=true
      await assert.rejects(delivery.deliver(pending.requestId),isOperationDenied);banned=false
      await controlled(()=>owner.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2",[A,U]))
      await assert.rejects(delivery.deliver(pending.requestId),isOperationDenied)
      await controlled(()=>owner.query("UPDATE profitia_access.memberships SET status='ACTIVE' WHERE organisation_id=$1 AND user_id=$2",[A,U]))
      assert.equal((await owner.query('SELECT status FROM profitia_jobs.dispatches WHERE job_id=$1',[pending.requestId])).rows[0].status,'PENDING')
      assert.equal((await sourceOwner.query('SELECT "requestCount" FROM public.forecast_preparation_job')).rows[0].requestCount,2)
    })
    await t.test('foreground OUTCOME failure rolls back private command, dispatch and request charge atomically',async()=>{
      const before=(await owner.query('SELECT (SELECT count(*)::int FROM profitia_forecast_requests.commands) AS commands,(SELECT count(*)::int FROM profitia_jobs.dispatches) AS dispatches,(SELECT accepted_count FROM profitia_requests.policies) AS used')).rows[0]
      await owner.query("CREATE FUNCTION profitia_access.reject_foreground_fixture() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.phase='OUTCOME' AND NEW.event->>'operation'='forecast.request' THEN RAISE EXCEPTION 'synthetic foreground outcome outage';END IF;RETURN NEW;END$$;CREATE TRIGGER reject_foreground_fixture BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION profitia_access.reject_foreground_fixture()")
      try{
        assert.equal((await handler(request('native_foreground_failure_'+randomUUID()))).status,503)
        assert.deepEqual((await owner.query('SELECT (SELECT count(*)::int FROM profitia_forecast_requests.commands) AS commands,(SELECT count(*)::int FROM profitia_jobs.dispatches) AS dispatches,(SELECT accepted_count FROM profitia_requests.policies) AS used')).rows[0],before)
      }finally{await owner.query('DROP TRIGGER reject_foreground_fixture ON profitia_access.security_events;DROP FUNCTION profitia_access.reject_foreground_fixture()')}
    })
    await t.test('source commit followed by private failure keeps READY and retries the same funded native effect',async()=>{
      const pending=await submit()
      await owner.query("CREATE FUNCTION profitia_access.reject_private_delivery_fixture() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.phase='OUTCOME' AND NEW.event->>'operation'='job.execute' AND EXISTS(SELECT 1 FROM profitia_jobs.delivery_observations WHERE job_id::text=NEW.event->>'resourceId') THEN RAISE EXCEPTION 'synthetic private delivery outcome outage';END IF;RETURN NEW;END$$;CREATE TRIGGER reject_private_delivery_fixture BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION profitia_access.reject_private_delivery_fixture()")
      // The real, uncommitted native receipt distinguishes delivery OUTCOME
      // from the earlier durable admission; no invented audit fields are used.
      try{
        await assert.rejects(delivery.deliver(pending.requestId),e=>isOperationDenied(e)&&e.reasonCode==='DELIVERY_UNCERTAIN')
      }finally{await owner.query('DROP TRIGGER reject_private_delivery_fixture ON profitia_access.security_events;DROP FUNCTION profitia_access.reject_private_delivery_fixture()')}
      const row=(await owner.query('SELECT status,lease_expires_at FROM profitia_jobs.dispatches WHERE job_id=$1',[pending.requestId])).rows[0]
      assert.equal(row.status,'READY')
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM profitia_jobs.delivery_observations WHERE job_id=$1',[pending.requestId])).rows[0].n,0)
      assert.equal((await sourceOwner.query('SELECT "requestCount" FROM public.forecast_preparation_job')).rows[0].requestCount,3)
      assert.equal((await sourceOwner.query('SELECT consumed_count FROM profitia_ingestion.budgets')).rows[0].consumed_count,3)
      const waitMs=row.lease_expires_at.getTime()-Date.now()+150
      assert(waitMs<=31000,'A bounded real lease is required; do not forge expiry or reset private rows')
      if(waitMs>0)await new Promise(resolve=>setTimeout(resolve,waitMs))
      assert.equal((await delivery.deliver(pending.requestId)).value.status,'CONFIRMED')
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM profitia_jobs.delivery_observations WHERE job_id=$1',[pending.requestId])).rows[0].n,1)
      assert.equal((await sourceOwner.query('SELECT "requestCount" FROM public.forecast_preparation_job')).rows[0].requestCount,3)
      assert.equal((await sourceOwner.query('SELECT consumed_count FROM profitia_ingestion.budgets')).rows[0].consumed_count,3)
      const shared=JSON.stringify((await sourceOwner.query('SELECT to_jsonb(e) AS row FROM profitia_ingestion.effects e UNION ALL SELECT to_jsonb(s) FROM profitia_ingestion.security_events s')).rows)
      for(const privateValue of[A,U,accepted.requestId,pending.requestId,'native-external-user','native-session'])assert(!shared.includes(privateValue))
    })
  }finally{for(const c of[foreground,foregroundAudit,executor,executorAudit])await c?.$disconnect();await owner?.end()}
}
