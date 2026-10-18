import {createStoredCurrentForecastReader} from '../lib/forecast/stored-current-read.ts'
import {createStoredForecastReadinessReader} from '../lib/forecast/stored-readiness-read.ts'
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
import {createSg2ForecastSourceWorker,FORECAST_WORKER_SOURCE} from '../lib/forecast/source-worker.ts'
import {createSg2ForecastSourceDelivery,FORECAST_QUEUE_SOURCE} from '../lib/forecast/source-delivery.ts'
const require=createRequire(import.meta.url),{Client}=createRequire(new URL('../../architecture-lab/package.json',import.meta.url))('pg')
// The native app is CommonJS under tsx. Use its actual SDK loader for opaque
// in-process receipt evidence; a second ESM module instance owns another map.
const {platformReceiptEvidence,createPlatformIngestionHost}=require('@profitia/platform-contracts/platform-ingestion')
const {isOperationDenied}=require('@profitia/platform-contracts/operation-context')
const DATABASE='sg2_native_worker_'+randomUUID().replaceAll('-',''),ROLE='sg2_worker_admission_fixture',READ_ROLE='sg2_worker_projection_fixture'
const SOURCE_OWNER='profitia_ingestion_owner',MARKET_OWNER='profitia_market_read_owner',FORECAST_OWNER='profitia_forecast_read_owner'
const SERIES='native_delegated_forecast_daily',hash=v=>createHash('sha256').update(v).digest('hex')
const read=relative=>fs.readFileSync(new URL(relative,import.meta.url),'utf8')
const sourceSql=read('../../../packages/platform-contracts/migrations/access/008-platform-ingestion.sql')
const marketSql=read('../prisma-market-data/private-read/001-stored-history-read.sql'),forecastSql=read('../prisma-market-data/private-read/002-stored-rolling-current.sql')
const nativeSql=read('../prisma-market-data/private-write/001-forecast-queue.sql'),workerSql=read('../prisma-market-data/private-write/002-forecast-worker.sql')
const tables=['rolling_daily_current_forecast_snapshots','forecast_current_runs','forecast_current_points','forecast_verification_runs',
  'forecast_verification_metrics','forecast_verification_points','rolling_daily_verification_records','rolling_daily_maintenance_state']

test('original scientific worker uses genuine funded SQL, ordinary source role and stored native history',async t=>{
  const rootUrl=assertIsolatedTestConnection(process.env.SG2_OPERATION_TEST_OWNER_URL,'sg2_operation_test','architecture_test_owner')
  const root=new Client({connectionString:rootUrl});await root.connect()
  const ownerUrl=new URL(rootUrl);ownerUrl.pathname='/'+DATABASE
  let owner,business,audit,workerBusiness,workerAudit,verificationBusiness,verificationAudit,readClient
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
      await owner.query("INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,'spendguru-forecast-source',$2,'SOURCE_TRANSACTION',7,now()-interval '1 hour',now()+interval '1 hour',now()+interval '1 hour','ACTIVE','SYNTHETIC_ONLY')",[randomUUID(),FORECAST_QUEUE_SOURCE.id])
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
    await owner.query("INSERT INTO public.market_observations(id,\"seriesId\",\"observedAt\",value,\"updatedAt\") SELECT 'native-point-'||n,'native-series',date '2020-01-01'+n,100+n*0.05,now() FROM generate_series(0,2190) n")
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
    const WORKER_ROLE='sg2_native_forecast_worker_fixture',VERIFY_ROLE='sg2_native_verification_worker_fixture'
    await root.query("CREATE ROLE "+WORKER_ROLE+" LOGIN PASSWORD 'isolated_ci_only' NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS CONNECTION LIMIT 2")
    await root.query("CREATE ROLE "+VERIFY_ROLE+" LOGIN PASSWORD 'isolated_ci_only' NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS CONNECTION LIMIT 4")
    const workerTables=['forecast_preparation_job','forecast_action_trace','forecast_preparation_execution_ledger','forecast_current_runs','forecast_current_points',
      'forecast_verification_runs','forecast_verification_metrics','forecast_verification_points','rolling_daily_verification_records','rolling_daily_calibration_groups',
      'rolling_daily_maintenance_state','rolling_daily_current_forecast_snapshots']
    for(const table of workerTables)await owner.query(`GRANT SELECT ON public.${table} TO ${SOURCE_OWNER}`)
    await owner.query(`GRANT UPDATE("leaseVersion") ON public.forecast_preparation_job TO ${SOURCE_OWNER}`)
    for(const schema of ['profitia_market_read','profitia_forecast_read'])await owner.query(`GRANT USAGE ON SCHEMA ${schema} TO ${WORKER_ROLE},${VERIFY_ROLE}`)
    for(const schema of ['profitia_market_read','profitia_forecast_read']){
      const views=(await owner.query("SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relkind='v'",[schema])).rows
      for(const v of views)await owner.query(`GRANT SELECT ON ${schema}.${v.relname} TO ${WORKER_ROLE},${VERIFY_ROLE}`)
    }
    await asOwner(FORECAST_OWNER,()=>owner.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA profitia_forecast_read TO ${WORKER_ROLE},${VERIFY_ROLE}`))
    await owner.query(`GRANT CREATE ON DATABASE ${DATABASE} TO ${SOURCE_OWNER}`)
    await asOwner(SOURCE_OWNER,async()=>{
      await owner.query('SAVEPOINT worker_schema_candidate')
      await owner.query(workerSql)
      await assert.rejects(owner.query("DO $$BEGIN RAISE EXCEPTION 'synthetic worker schema outage';END$$"))
      await owner.query('ROLLBACK TO SAVEPOINT worker_schema_candidate;RELEASE SAVEPOINT worker_schema_candidate')
      assert.equal((await owner.query("SELECT to_regnamespace('profitia_forecast_worker') AS schema")).rows[0].schema,null)
      await owner.query(workerSql)
      for(const nativeRole of [WORKER_ROLE,VERIFY_ROLE])await owner.query("INSERT INTO profitia_ingestion.runtime_bindings(login_role,binding_id,service_id,application_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,'spendguru-forecast-worker','PLATFORM_INTERNAL','native-worker-fixture','native-worker-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[nativeRole,randomUUID(),randomUUID()])
      await owner.query("INSERT INTO profitia_ingestion.sources(source_id,effect_kind,data_class,payload_schema,quality_version,classification_version,projection_version,status,source_ref,expires_at) VALUES($1,'STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE',$2,$3,$4,'native-science-receipt-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[FORECAST_WORKER_SOURCE.id,FORECAST_WORKER_SOURCE.payloadSchema,FORECAST_WORKER_SOURCE.qualityVersion,FORECAST_WORKER_SOURCE.classificationVersion])
      for(const nativeRole of [WORKER_ROLE,VERIFY_ROLE])await owner.query("INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,'ALLOW','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[randomUUID(),nativeRole,FORECAST_WORKER_SOURCE.id])
      await owner.query("INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,'spendguru-forecast-worker',$2,'SOURCE_TRANSACTION',500,now()-interval '1 hour',now()+interval '1 hour',now()+interval '1 hour','ACTIVE','SYNTHETIC_ONLY')",[randomUUID(),FORECAST_WORKER_SOURCE.id])
      for(const [nativeRole,kind] of [[WORKER_ROLE,'CURRENT'],[VERIFY_ROLE,'VERIFICATION']])await owner.query("INSERT INTO profitia_forecast_worker.installation VALUES('1.0.0',$1,'isolated-native-source-project','isolated-native-source-branch',$2,$3,$4,'architecture_test_owner','SYNTHETIC_ONLY',now()+interval '1 hour')",[hash(workerSql),DATABASE,nativeRole,kind])
      await owner.query(`GRANT USAGE ON SCHEMA profitia_ingestion,profitia_forecast_worker TO ${WORKER_ROLE},${VERIFY_ROLE};GRANT EXECUTE ON FUNCTION profitia_ingestion.runtime_descriptor(),profitia_ingestion.lock_ingestion(text,text,text),profitia_ingestion.scope_allows(text,text),profitia_ingestion.reserve(text,text,text,text,uuid),profitia_ingestion.complete(uuid,uuid),profitia_ingestion.append_audit(jsonb),profitia_forecast_worker.runtime_descriptor(),profitia_forecast_worker.peek(text[]),profitia_forecast_worker.bind_effect(uuid,uuid,text),profitia_forecast_worker.scope_allows(text,text,text,text,text),profitia_forecast_worker.record_start(uuid,text),profitia_forecast_worker.record_child(uuid,text) TO ${WORKER_ROLE},${VERIFY_ROLE}`)
    })
    await owner.query(`REVOKE CREATE ON DATABASE ${DATABASE} FROM ${SOURCE_OWNER}`)
    await owner.query('BEGIN;SAVEPOINT worker_fence_candidate')
    await owner.query('SELECT profitia_forecast_worker.install_runtime_fences()')
    await assert.rejects(owner.query("DO $$BEGIN RAISE EXCEPTION 'synthetic worker fence outage';END$$"))
    await owner.query('ROLLBACK TO SAVEPOINT worker_fence_candidate;RELEASE SAVEPOINT worker_fence_candidate')
    assert.equal((await owner.query("SELECT count(*)::int AS n FROM pg_policy WHERE polname='profitia_worker_fence'")).rows[0].n,0)
    await owner.query('SELECT profitia_forecast_worker.install_runtime_fences()')
    await owner.query('COMMIT')
    // A separate real ordinary read login receives only the existing closed
    // projections and its own receipt. It never borrows the worker's writer.
    await asOwner(MARKET_OWNER,()=>owner.query(`GRANT USAGE ON SCHEMA profitia_market_read TO ${READ_ROLE};GRANT SELECT ON profitia_market_read.series,profitia_market_read.observations TO ${READ_ROLE}`))
    await asOwner(FORECAST_OWNER,async()=>{
      await owner.query(`GRANT USAGE ON SCHEMA profitia_forecast_read TO ${READ_ROLE};GRANT USAGE ON TYPE profitia_forecast_read."ForecastTargetBasis",profitia_forecast_read."RollingDailyVerificationMaturityStatus" TO ${READ_ROLE}`)
      await owner.query(`GRANT SELECT ON ALL TABLES IN SCHEMA profitia_forecast_read TO ${READ_ROLE};GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA profitia_forecast_read TO ${READ_ROLE}`)
    })
    const readUrl=new URL(ownerUrl);readUrl.username=READ_ROLE;readUrl.password='isolated_ci_only';readUrl.searchParams.set('schema','profitia_forecast_read');readUrl.searchParams.set('connection_limit','1')
    readClient=new PrismaClient({datasources:{db:{url:readUrl.toString()}}})
    const readBinding={projectId:'isolated-native-source-project',branchId:'isolated-native-source-branch',databaseName:DATABASE,role:READ_ROLE,schemaDigest:hash(forecastSql),marketSchemaDigest:hash(marketSql)}
    const publicCurrent=createStoredCurrentForecastReader(readClient,readBinding),publicReadiness=createStoredForecastReadinessReader(readClient,readBinding)
    const assertPublicCurrent=async modelId=>{
      const result=await publicCurrent({seriesId:SERIES,modelId,targetBasis:'MONTHLY_AVERAGE'})
      assert.equal(result.status,'AVAILABLE',JSON.stringify(result))
      const state=await publicReadiness({kind:'capability',seriesId:SERIES,modelId,targetSemantics:'MONTHLY_AVERAGE'})
      assert.equal(state.currentReadiness,'READY',JSON.stringify(state))
      return result
    }
    const workerUrl=new URL(ownerUrl);workerUrl.username=WORKER_ROLE;workerUrl.password='isolated_ci_only';workerUrl.searchParams.set('connection_limit','1')
    workerBusiness=new PrismaClient({datasources:{db:{url:workerUrl.toString()}}});workerAudit=new PrismaClient({datasources:{db:{url:workerUrl.toString()}}})
    const workerOptions={prisma:workerBusiness,auditPrisma:workerAudit,boundaryDigest:hash(workerSql),workerId:'native-real-current-worker',mode:'CURRENT_ONLY',
      application:{appId:'spendguru-forecast-worker',profileId:'PLATFORM_INTERNAL',deploymentId:'native-worker-fixture',configurationVersion:'native-worker-v1',
        environment:'development',identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,features:['knowledge_ingestion'],operations:['knowledge.ingest']},
      binding:{applicationId:'spendguru-forecast-worker',environment:'development',deploymentId:'native-worker-fixture',configurationVersion:'native-worker-v1',
        projectId:'isolated-native-source-project',branchId:'isolated-native-source-branch',databaseName:DATABASE,role:WORKER_ROLE,schemaDigest:hash(sourceSql)}}
    const verificationUrl=new URL(workerUrl);verificationUrl.username=VERIFY_ROLE
    verificationBusiness=new PrismaClient({datasources:{db:{url:verificationUrl.toString()}}});verificationAudit=new PrismaClient({datasources:{db:{url:verificationUrl.toString()}}})
    const originalMarketUrl=process.env.MARKET_DATA_DATABASE_URL
    process.env.MARKET_DATA_DATABASE_URL='postgresql://architecture_test_owner@127.0.0.1:1/sg2_operation_test'
    const queryFor=client=>async(sql,values=[])=>{
      if(/^SET LOCAL/.test(sql)){await client.$executeRawUnsafe(sql,...values);return{rows:[]}}
      return{rows:await client.$queryRawUnsafe(sql,...values)}
    }
    const probeHost=createPlatformIngestionHost({application:workerOptions.application,binding:workerOptions.binding,source:FORECAST_WORKER_SOURCE,
      independentQuery:queryFor(workerAudit),validateSharedPayload:value=>['CLAIM','STEP'].includes(value.phase),
      transact:(work,limits)=>workerBusiness.$transaction(async tx=>{
        await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'UTC'")
        return work({query:queryFor(tx),transaction:tx})
      },{timeout:limits.timeoutMs,maxWait:limits.maxWaitMs})})
    const probe=async(payload,write)=>probeHost.ingest({resourceId:payload.seriesId,payload,idempotencyKey:'native_probe_'+randomUUID()},async(_,tx,context)=>{
      const canonical=JSON.stringify(Object.fromEntries(Object.entries(payload).sort(([a],[b])=>a<b?-1:a>b?1:0)))
      const bound=(await tx.$queryRawUnsafe('SELECT profitia_forecast_worker.bind_effect($1::uuid,$2::uuid,$3) AS b',context.platformReservation.effectId,context.decisionId,canonical))[0].b
      return write(tx,bound)
    })
    let globalResolutions=0
    Object.defineProperty(globalThis,'__sgRuntimeMarketDataPrisma__',{configurable:true,get(){globalResolutions++;throw Error('GLOBAL_SOURCE_FALLBACK')}})
    try{
      const worker=createSg2ForecastSourceWorker(workerOptions)
      await t.test('actual ordinary writer has the twelve native fences and no unfunded scientific write',async()=>{
        const d=(await workerBusiness.$queryRawUnsafe('SELECT profitia_forecast_worker.runtime_descriptor() AS d'))[0].d
        assert(d);assert.equal(d.fencesInstalled,true)
        assert.deepEqual(await workerBusiness.forecastPreparationJob.findMany(),[])
        await assert.rejects(workerBusiness.$executeRawUnsafe('TRUNCATE public.forecast_current_runs CASCADE'))
        await assert.rejects(workerBusiness.forecastCurrentRun.create({data:{seriesId:SERIES,displayName:'forged',frequency:'MONTHLY',inputSource:'forged',historyFingerprint:'forged',targetBasis:'MONTHLY_AVERAGE',methodId:'forged',modelId:'naive',methodVersion:'v1',trainingWindowPolicyId:'forged',effectiveTrainingPolicyId:'forged',observationCount:1,status:'AVAILABLE'}}),/row.level security/i)
      })
      await port.deliver(input)
      await t.test('genuine original Current computation persists through the bounded role without a global client or provider',async()=>{
        const first=worker.runOne()
        await assert.rejects(worker.runOne(),/One original worker invocation/)
        assert.equal(await first,true)
        const j=(await owner.query('SELECT status,"failureReason","leaseVersion" FROM public.forecast_preparation_job')).rows[0]
        assert.equal(j.status,'SUCCEEDED',j.failureReason??JSON.stringify(j))
        assert.equal((await owner.query('SELECT count(*)::int AS n FROM profitia_forecast_worker.starts')).rows[0].n,1)
        assert.equal((await owner.query('SELECT count(*)::int AS n FROM public.forecast_current_runs')).rows[0].n,1)
        assert((await owner.query('SELECT count(*)::int AS n FROM public.forecast_current_points')).rows[0].n>0)
        assert.equal((await owner.query(`SELECT count(*)::int AS n FROM public.forecast_preparation_execution_ledger WHERE "executionStatus"='COMPLETED'`)).rows[0].n,1)
        assert.equal((await owner.query('SELECT count(*)::int AS n FROM public.forecast_action_trace WHERE \"artifactReadyAt\" IS NOT NULL')).rows[0].n,1)
        await assertPublicCurrent('naive')
        assert.equal(networkCalls,0);assert.equal(globalResolutions,0)
      })
      assert.equal((await owner.query('SELECT status FROM public.forecast_preparation_job')).rows[0].status,'SUCCEEDED')
      await t.test('completed native job does not start twice or consume another SQL admission',async()=>{
        const before=(await owner.query("SELECT consumed_count FROM profitia_ingestion.budgets WHERE application_id='spendguru-forecast-worker'")).rows[0].consumed_count
        assert.equal(await worker.runOne(),false)
        assert.equal((await owner.query("SELECT consumed_count FROM profitia_ingestion.budgets WHERE application_id='spendguru-forecast-worker'")).rows[0].consumed_count,before)
        assert.equal((await owner.query('SELECT count(*)::int AS n FROM profitia_forecast_worker.starts')).rows[0].n,1)
      })
      const verification=createSg2ForecastSourceWorker({...workerOptions,prisma:verificationBusiness,auditPrisma:verificationAudit,mode:'VERIFICATION_ONLY',
        workerId:'native-real-verification-worker',binding:{...workerOptions.binding,role:VERIFY_ROLE}})
      await t.test('real historical Verification uses its separate native lane and the original bounded batching',async()=>{
        await port.deliver({...input,deliveryKey:'native_worker_verification_queue_000001',payload:{...command,kind:'VERIFICATION'}})
        assert.equal((await workerBusiness.$queryRawUnsafe('SELECT profitia_forecast_worker.peek($1::text[]) AS c',['VERIFICATION']))[0].c,null)
        const verCandidate=(await verificationBusiness.$queryRawUnsafe('SELECT profitia_forecast_worker.peek($1::text[]) AS c',['VERIFICATION']))[0].c
        assert(verCandidate)
        await assert.rejects(probe({...verCandidate,phase:'CLAIM',step:'CLAIM',leaseOwnerToken:null,argumentsDigest:hash('kinds')},async(_tx,bound)=>{
          assert.equal(bound,false);throw Error('synthetic wrong-lane probe must roll back')
        }),isOperationDenied)
        for(let n=0;n<12;n++){
          await worker.runOne()
          const j=(await owner.query(`SELECT status,"failureReason" FROM public.forecast_preparation_job WHERE "jobKind"='VERIFICATION'`)).rows[0]
          if(j.status==='SUCCEEDED')break
          assert.notEqual(j.status,'FAILED',j.failureReason??'Verification failed')
          assert.equal(await verification.runOne(),true,JSON.stringify({jobs:(await owner.query('SELECT \"jobKind\",status,\"modelId\",\"failureReason\",\"dependencyJobKey\" FROM public.forecast_preparation_job')).rows,descriptor:(await verificationBusiness.$queryRawUnsafe('SELECT profitia_forecast_worker.runtime_descriptor() AS d'))[0].d}))
        }
        const j=(await owner.query(`SELECT status,"failureReason" FROM public.forecast_preparation_job WHERE "jobKind"='VERIFICATION'`)).rows[0]
        assert.equal(j.status,'SUCCEEDED',j.failureReason??JSON.stringify(j))
        assert((await owner.query('SELECT count(*)::int AS n FROM public.forecast_verification_points')).rows[0].n>0)
        assert.equal(networkCalls,0);assert.equal(globalResolutions,0)
      })
      await t.test('committed start with lost driver observation remains spent; original expired-lease recovery admits a new attempt',async()=>{
        await port.deliver({...input,deliveryKey:'native_worker_damped_current_00000002',payload:{...command,modelId:'damped_holt'}})
        const startsBefore=(await owner.query('SELECT count(*)::int AS n FROM profitia_forecast_worker.starts')).rows[0].n
        const selected=(await workerBusiness.$queryRawUnsafe('SELECT profitia_forecast_worker.peek($1::text[]) AS c',['CURRENT']))[0].c
        assert(selected);assert.equal(selected.modelId,'damped_holt')
        await asOwner(SOURCE_OWNER,()=>owner.query("CREATE FUNCTION profitia_ingestion.reject_worker_audit_fixture() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.application_id='spendguru-forecast-worker' THEN RAISE EXCEPTION 'synthetic required audit outage';END IF;RETURN NEW;END$$;CREATE TRIGGER reject_worker_audit_fixture BEFORE INSERT ON profitia_ingestion.security_events FOR EACH ROW EXECUTE FUNCTION profitia_ingestion.reject_worker_audit_fixture()"))
        try{await assert.rejects(worker.runOne(),error=>isOperationDenied(error)&&error.reasonCode==='AUDIT_UNAVAILABLE')}
        finally{await asOwner(SOURCE_OWNER,()=>owner.query('DROP TRIGGER reject_worker_audit_fixture ON profitia_ingestion.security_events;DROP FUNCTION profitia_ingestion.reject_worker_audit_fixture()'))}
        assert.equal((await owner.query('SELECT count(*)::int AS n FROM profitia_forecast_worker.starts')).rows[0].n,startsBefore)
        const claimPayload={...selected,phase:'CLAIM',step:'CLAIM',leaseOwnerToken:null,argumentsDigest:hash('kinds')}
        const oldPriority=(await owner.query('SELECT priority FROM public.forecast_preparation_job WHERE id=$1',[selected.jobId])).rows[0].priority
        await assert.rejects(probe(claimPayload,async(tx,bound)=>{
          assert.equal(bound,true)
          const m=(await tx.$queryRawUnsafe("SELECT current_setting('profitia.forecast.worker_scope')::jsonb AS m"))[0].m
          m[4].argumentsDigest=hash('forged marker payload')
          await tx.$queryRawUnsafe("SELECT set_config('profitia.forecast.worker_scope',$1,true)",JSON.stringify(m))
          assert.equal((await tx.forecastPreparationJob.updateMany({where:{id:selected.jobId},data:{priority:999}})).count,0)
          throw Error('synthetic tampered marker probe must roll back')
        }),isOperationDenied)
        assert.equal((await owner.query('SELECT priority FROM public.forecast_preparation_job WHERE id=$1',[selected.jobId])).rows[0].priority,oldPriority)

        const actualTransaction=workerBusiness.$transaction.bind(workerBusiness)
        let dropObservation=true
        // Genuine driver fault injection: the ORIGINAL transaction really
        // commits, then only its client-side observation fails. No fake COMMIT.
        workerBusiness.$transaction=async(...args)=>{
          const value=await actualTransaction(...args)
          if(dropObservation){dropObservation=false;throw Error('synthetic post-commit observation loss')}
          return value
        }
        try{await assert.rejects(worker.runOne(),isOperationDenied)}finally{workerBusiness.$transaction=actualTransaction}
        const lost=(await owner.query(`SELECT * FROM public.forecast_preparation_job WHERE "modelId"='damped_holt'`)).rows[0]
        assert.equal(lost.status,'RUNNING');assert.equal((await owner.query('SELECT count(*)::int AS n FROM profitia_forecast_worker.starts')).rows[0].n,startsBefore+1)
        assert.equal((await owner.query(`SELECT count(*)::int AS n FROM public.forecast_current_runs WHERE "modelId"='damped_holt'`)).rows[0].n,0)
        assert.equal(await worker.runOne(),false)
        // Synthetic crash fixture: the ORIGINAL queue lease is in the past;
        // the immutable admission and counters are never removed or refunded.
        await owner.query(`UPDATE public.forecast_preparation_job SET "leaseExpiresAt"=(clock_timestamp() AT TIME ZONE 'UTC')-interval '1 second' WHERE id=$1`,[lost.id])
        await assert.rejects(probe({...selected,leaseVersion:lost.leaseVersion,phase:'STEP',step:'ARTIFACT',leaseOwnerToken:lost.leaseOwnerToken,argumentsDigest:hash('expired lease')},async(_tx,bound)=>{
          assert.equal(bound,false);throw Error('synthetic expired lease probe must roll back')
        }),isOperationDenied)
        assert.equal(await worker.runOne(),false,'First original CTE recovers its expired lease')
        assert.equal(await worker.runOne(),true,'A fresh queue version must not replay the recovery-only transaction forever')
        const recovered=(await owner.query('SELECT status,"failureReason","leaseVersion" FROM public.forecast_preparation_job WHERE id=$1',[lost.id])).rows[0]
        assert.equal(recovered.status,'SUCCEEDED',recovered.failureReason??JSON.stringify(recovered));assert.equal(recovered.leaseVersion,lost.leaseVersion+1)
        assert.equal((await owner.query('SELECT count(*)::int AS n FROM profitia_forecast_worker.starts')).rows[0].n,startsBefore+2)
      })
      await t.test('original Rolling Daily Current and calibration complete with native child admission and stored kernels',async()=>{
        await port.deliver({...input,deliveryKey:'native_worker_rolling_positive_000004',payload:{...command,targetSemantics:'ROLLING_DAILY_POINT_IN_TIME',kind:'CURRENT'}})
        for(let n=0;n<24;n++){
          await worker.runOne()
          await verification.runOne()
          const jobs=(await owner.query(`SELECT "jobKind",status,"failureReason" FROM public.forecast_preparation_job WHERE "targetSemantics"='ROLLING_DAILY_POINT_IN_TIME'`)).rows
          assert(jobs.length>0)
          for(const job of jobs)assert.notEqual(job.status,'FAILED',JSON.stringify(job))
          if(jobs.some(j=>j.jobKind==='CURRENT'&&j.status==='SUCCEEDED')&&jobs.some(j=>j.jobKind==='VERIFICATION'&&j.status==='SUCCEEDED'))break
        }
        const jobs=(await owner.query(`SELECT "jobKind",status,"failureReason" FROM public.forecast_preparation_job WHERE "targetSemantics"='ROLLING_DAILY_POINT_IN_TIME'`)).rows
        assert(jobs.some(j=>j.jobKind==='CURRENT'&&j.status==='SUCCEEDED'),JSON.stringify(jobs))
        assert(jobs.some(j=>j.jobKind==='VERIFICATION'&&j.status==='SUCCEEDED'),JSON.stringify(jobs))
        assert((await owner.query('SELECT count(*)::int AS n FROM profitia_forecast_worker.children')).rows[0].n>0)
        assert((await owner.query('SELECT count(*)::int AS n FROM public.rolling_daily_current_forecast_snapshots')).rows[0].n>0)
        assert((await owner.query('SELECT count(*)::int AS n FROM public.rolling_daily_verification_records')).rows[0].n>0)
        assert.equal(networkCalls,0);assert.equal(globalResolutions,0)
      })
      await t.test('original ETS and ARIMA Current kernels retain their persisted artifact behaviour',async()=>{
        for(const modelId of ['ets','arima']){
          await port.deliver({...input,deliveryKey:'native_worker_current_'+modelId+'_000006',payload:{...command,modelId}})
          assert.equal(await worker.runOne(),true)
          const job=(await owner.query('SELECT status,"failureReason" FROM public.forecast_preparation_job WHERE "modelId"=$1',[modelId])).rows[0]
          assert.equal(job.status,'SUCCEEDED',job.failureReason??JSON.stringify(job))
          assert.equal((await owner.query('SELECT count(*)::int AS n FROM public.forecast_current_runs WHERE "modelId"=$1',[modelId])).rows[0].n,1)
        }
        for(const modelId of ['naive','damped_holt','ets','arima'])await assertPublicCurrent(modelId)
        assert.equal(networkCalls,0);assert.equal(globalResolutions,0)
      })
      await t.test('both quota barriers remain enforced for actual queued work and a stale discovery result',async()=>{
        await port.deliver({...input,deliveryKey:'native_worker_quota_end_period_000007',payload:{...command,targetSemantics:'END_OF_PERIOD',kind:'VERIFICATION'}})
        const before=(await owner.query('SELECT count(*)::int AS n FROM profitia_forecast_worker.starts')).rows[0].n
        const selected=(await workerBusiness.$queryRawUnsafe('SELECT profitia_forecast_worker.peek($1::text[]) AS c',['CURRENT']))[0].c
        assert(selected)
        assert((await verificationBusiness.$queryRawUnsafe('SELECT profitia_forecast_worker.peek($1::text[]) AS c',['VERIFICATION']))[0].c)
        await asOwner(SOURCE_OWNER,()=>owner.query("UPDATE profitia_ingestion.grants SET status='REVOKED' WHERE login_role=$1",[VERIFY_ROLE]))
        assert.equal(await verification.runOne(),false)
        await asOwner(SOURCE_OWNER,()=>owner.query("UPDATE profitia_ingestion.budgets SET capacity=consumed_count WHERE application_id='spendguru-forecast-worker'"))
        // Keep the native discovery capacity check unchanged.
        assert.equal(await worker.runOne(),false)
        // A second genuine SDK boundary must also refuse a candidate which
        // was discovered BEFORE capacity was exhausted. No production filter
        // or source policy is changed, and its write callback cannot execute.
        const query=client=>async(sql,values=[])=>{
          if(/^SET LOCAL/.test(sql)){await client.$executeRawUnsafe(sql,...values);return{rows:[]}}
          return{rows:await client.$queryRawUnsafe(sql,...values)}
        }
        const host=createPlatformIngestionHost({application:workerOptions.application,binding:workerOptions.binding,source:FORECAST_WORKER_SOURCE,
          independentQuery:query(workerAudit),validateSharedPayload:value=>value.phase==='CLAIM',
          transact:(work,limits)=>workerBusiness.$transaction(tx=>work({query:query(tx),transaction:tx}),{timeout:limits.timeoutMs,maxWait:limits.maxWaitMs})})
        let writes=0
        await assert.rejects(host.ingest({resourceId:selected.seriesId,idempotencyKey:'native_exhausted_stale_discovery_0001',
          payload:{...selected,phase:'CLAIM',step:'CLAIM',leaseOwnerToken:null,argumentsDigest:hash('synthetic-kind-list')}},()=>{writes++;throw Error('Budget must refuse before write')}),
          error=>isOperationDenied(error)&&error.reasonCode==='LIMIT_EXCEEDED')
        assert.equal(writes,0)
        assert.equal((await owner.query('SELECT count(*)::int AS n FROM profitia_forecast_worker.starts')).rows[0].n,before)
        assert((await owner.query("SELECT count(*)::int AS n FROM profitia_ingestion.security_events WHERE event->>'reasonCode'='LIMIT_EXCEEDED'")).rows[0].n>0)
      })
      await t.test('unexpected ACL and source binding revoke native discovery without any data reset',async()=>{
        await owner.query(`GRANT SELECT ON public.market_series TO ${WORKER_ROLE},${VERIFY_ROLE}`)
        try{assert.equal((await workerBusiness.$queryRawUnsafe('SELECT profitia_forecast_worker.runtime_descriptor() AS d'))[0].d,null)}
        finally{await owner.query(`REVOKE SELECT ON public.market_series FROM ${WORKER_ROLE},${VERIFY_ROLE}`)}
        await asOwner(SOURCE_OWNER,()=>owner.query("UPDATE profitia_ingestion.runtime_bindings SET status='REVOKED' WHERE login_role=$1",[WORKER_ROLE]))
        assert.equal((await workerBusiness.$queryRawUnsafe('SELECT profitia_forecast_worker.runtime_descriptor() AS d'))[0].d,null)
      })
    }finally{delete globalThis.__sgRuntimeMarketDataPrisma__;if(originalMarketUrl===undefined)delete process.env.MARKET_DATA_DATABASE_URL;else process.env.MARKET_DATA_DATABASE_URL=originalMarketUrl}
  }finally{globalThis.fetch=previousFetch;await workerBusiness?.$disconnect();await workerAudit?.$disconnect();await verificationBusiness?.$disconnect();await verificationAudit?.$disconnect();await readClient?.$disconnect();await business?.$disconnect();await audit?.$disconnect();await owner?.end();await root.end()}
})
