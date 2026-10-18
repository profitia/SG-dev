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
import {platformReceiptEvidence} from '@profitia/platform-contracts/platform-ingestion'
import {isOperationDenied} from '@profitia/platform-contracts/operation-context'
const require=createRequire(import.meta.url),{Client}=createRequire(new URL('../../architecture-lab/package.json',import.meta.url))('pg')
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
    await asOwner(FORECAST_OWNER,async()=>{await owner.query(forecastSql);await owner.query("INSERT INTO profitia_forecast_read.installation VALUES(true,'3.0.1',$1,$2,'isolated-native-source-project','isolated-native-source-branch',$3,$4,'SYNTHETIC_ONLY',now()+interval '1 hour')",[hash(forecastSql),hash(marketSql),DATABASE,READ_ROLE])})
    await asOwner(FORECAST_OWNER,()=>owner.query(`GRANT USAGE ON SCHEMA profitia_forecast_read TO ${SOURCE_OWNER},${ROLE};GRANT SELECT ON profitia_forecast_read.installation TO ${SOURCE_OWNER};GRANT SELECT ON profitia_forecast_read.rolling_daily_current_forecast_snapshots,profitia_forecast_read.forecast_current_runs,profitia_forecast_read.forecast_current_points,profitia_forecast_read.forecast_verification_runs,profitia_forecast_read.forecast_verification_metrics,profitia_forecast_read.forecast_verification_points,profitia_forecast_read.rolling_daily_verification_records,profitia_forecast_read.rolling_daily_maintenance_state,profitia_forecast_read.forecast_current_states,profitia_forecast_read.forecast_verification_states TO ${ROLE};GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA profitia_forecast_read TO ${ROLE}`))
    await asOwner(SOURCE_OWNER,async()=>{
      await owner.query(sourceSql);await owner.query("INSERT INTO profitia_ingestion.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','isolated-native-source-project','isolated-native-source-branch',$2)",[hash(sourceSql),DATABASE])
      await owner.query("INSERT INTO profitia_ingestion.runtime_bindings(login_role,binding_id,service_id,application_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,'spendguru-forecast-source','PLATFORM_INTERNAL','native-source-fixture','native-source-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[ROLE,randomUUID(),randomUUID()])
      await owner.query("INSERT INTO profitia_ingestion.sources(source_id,effect_kind,data_class,payload_schema,quality_version,classification_version,projection_version,status,source_ref,expires_at) VALUES($1,'STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE',$2,$3,$4,'native-queue-receipt-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[FORECAST_QUEUE_SOURCE.id,FORECAST_QUEUE_SOURCE.payloadSchema,FORECAST_QUEUE_SOURCE.qualityVersion,FORECAST_QUEUE_SOURCE.classificationVersion])
      await owner.query("INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,'ALLOW','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[randomUUID(),ROLE,FORECAST_QUEUE_SOURCE.id])
      await owner.query("INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,'spendguru-forecast-source',$2,'SOURCE_TRANSACTION',2,now()-interval '1 hour',now()+interval '1 hour',now()+interval '1 hour','ACTIVE','SYNTHETIC_ONLY')",[randomUUID(),FORECAST_QUEUE_SOURCE.id])
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
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM public.forecast_preparation_job')).rows[0].n,0)
    })
    let receipt
    await t.test('actual original queue enqueue, telemetry, source receipt and budget commit once through generated Prisma',async()=>{
      receipt=await port.deliver(input);assert.equal(receipt.status,'COMMITTED');assert(platformReceiptEvidence(receipt))
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
  }finally{globalThis.fetch=previousFetch;await business?.$disconnect();await audit?.$disconnect();await owner?.end();await root.end()}
})
