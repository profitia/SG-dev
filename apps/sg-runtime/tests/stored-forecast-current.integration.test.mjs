import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import test from 'node:test'
import { PrismaClient } from '../generated/market-data-client/index.js'
import { PrismaClient as HistoryPrismaClient } from '@prisma/client'
import { assertIsolatedTestConnection } from '../../architecture-lab/src/operation-postgres-fixture.mjs'
import { createStoredCurrentForecastReader } from '../lib/forecast/stored-current-read.ts'
import { createStoredMarketHistoryReader } from '../lib/market-data/stored-read.ts'
import { buildRollingDailyHistoryFingerprint, ROLLING_DAILY_INPUT_SOURCE } from '../lib/forecast/rolling-daily-maintenance.ts'
import { ROLLING_DAILY_METHOD_ID, ROLLING_DAILY_METHOD_VERSION } from '../lib/forecast/rolling-daily-policy.ts'
import { buildForecastArtifactCadenceIdentity, createCurrentForecastStatisticalCompatibility, resolveForecastMethodContract, resolveLegacyForecastStatisticalCompatibility } from '../lib/forecast/identity.ts'
import { readCurrentRunFromPrisma, readLatestCurrentRunFromPrisma, buildForecastHistoryFingerprint } from '../lib/forecast/service.ts'
import { buildLiveForecastBridgePayloadFromHistory, selectMinimalLawfulCurrentTrainingPayload } from '../lib/forecast/live-market-input.ts'
import { resolveForecastTechnicalMinimumObservations } from '../lib/forecast/current-fast-policy.ts'
import { createForecastCadence } from '../lib/forecast/cadence.ts'
import { attachExactUncertaintyBandIdentity } from '../lib/forecast/uncertainty-band-policy.ts'

const pg = createRequire(new URL('../../architecture-lab/package.json', import.meta.url))('pg')
const DATABASE = 'sg2_forecast_read_test', OWNER = 'profitia_forecast_read_owner', MARKET_OWNER = 'profitia_market_read_owner'
const ROLE = 'sg2_stored_forecast_test_reader', MARKET_ROLE = 'sg2_forecast_market_control'
const marketSql = fs.readFileSync(new URL('../prisma-market-data/private-read/001-stored-history-read.sql', import.meta.url), 'utf8')
const sql = fs.readFileSync(new URL('../prisma-market-data/private-read/002-stored-rolling-current.sql', import.meta.url), 'utf8')
const digest = createHash('sha256').update(sql).digest('hex'), marketDigest = createHash('sha256').update(marketSql).digest('hex')
const selection = { seriesId: 'stored_daily_series', modelId: 'naive', targetBasis: 'POINT_IN_TIME' }
const points = Array.from({ length: 60 }, (_, index) => ({ date: new Date(Date.UTC(2025, 0, 1 + index)).toISOString(), value: 0 }))
const fingerprint = buildRollingDailyHistoryFingerprint({ seriesId: selection.seriesId, displayName: 'Shared daily source', description: 'Shared daily source',
  frequency: 'DAILY', source: 'Synthetic', points })
const compatibility = createCurrentForecastStatisticalCompatibility({ sourceFrequency: 'DAILY', targetCadence: 'DAILY', targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME' })
const marker = 'SYNTHETIC_PRIVATE_SOURCE_MARKER'
function payload() {
  const band = { status: 'NOT_AVAILABLE', reasonCode: 'CALIBRATION_NOT_AVAILABLE', source: null, lower: null, upper: null, sampleCount: null }
  const anchors = [['1M', 1, '2025-04-01'], ['3M', 3, '2025-06-01'], ['6M', 6, '2025-09-01'], ['12M', 12, '2026-03-01']]
    .map(([horizon, horizonMonths, targetCalendarDate]) => ({ horizon, horizonMonths, targetCalendarDate, pointForecast: 0,
      band: { ...band, p10ResidualOffset: null, p90ResidualOffset: null, privateUser: marker } }))
  return { contractVersion: '1', status: 'AVAILABLE', privateInitiator: marker,
    benchmark: { benchmarkId: selection.seriesId, displayName: 'Shared daily source', frequency: 'DAILY', unit: 'ORIGINAL_UNIT', currency: null,
      provider: 'macrobond', providerSeriesId: selection.seriesId, organizationId: marker },
    forecastMethod: { id: ROLLING_DAILY_METHOD_ID, version: ROLLING_DAILY_METHOD_VERSION },
    model: { id: 'naive', selectedCandidate: null, selectionMetric: null, selectionScore: null, selectedParameters: null, requestedBy: marker },
    origin: { date: '2025-03-01', value: 0, userId: marker }, maxHorizonMonths: 12, anchors,
    path: anchors.map(anchor => ({ date: anchor.targetCalendarDate, pointForecast: 0, band: { ...band, privateUser: marker }, requester: marker })),
    calibration: { availabilityStatus: 'NOT_AVAILABLE', freshnessStatus: null, quantileConvention: 'HF7_LINEAR_INTERPOLATION',
      coverageLabel: '80% empirical prediction band', methodologicalMinimumStatus: 'OPEN_REQUIRES_MORE_BENCHMARK_VALIDATION',
      updatedAt: null, processedThrough: null, lastResidualAvailabilityDate: null, organisationId: marker },
    audit: { generatedAt: '2025-03-01T00:00:00.000Z', sourceLatestObservationDate: '2025-03-01', calendarProjectionMode: 'OBSERVED_WEEKDAY_SET',
      projectionCalendarStrategy: 'OBSERVED_WEEKDAY_SET_V1', technicalMinimumTrainingObservations: 60,
      methodologicalTrainingEligibilityStatus: 'OPEN_REQUIRES_CROSS_BENCHMARK_VALIDATION', calibrationUpdatedAt: null,
      calibrationLastResidualAvailabilityDate: null, inputSource: ROLLING_DAILY_INPUT_SOURCE, sourceHistoryFingerprint: fingerprint, ownerRequestId: marker },
    warnings: [{ code: 'CALIBRATION_STALE', message: marker, userId: marker }] }
}

async function seedPeriodCurrent(owner, history, targetBasis, modelId) {
  const method = resolveForecastMethodContract(targetBasis)
  const full = buildLiveForecastBridgePayloadFromHistory(history.providerSeries.providerSeriesId,history,{ targetBasis,targetCadence:'MONTHLY',continuityPolicy:'ALLOW_GAPS' })
  const prepared = selectMinimalLawfulCurrentTrainingPayload(full,resolveForecastTechnicalMinimumObservations({targetSemantics:method.targetSemantics,modelId}))
  const hash = buildForecastHistoryFingerprint(prepared.history,createForecastCadence('DAILY','MONTHLY'))
  const statistical = createCurrentForecastStatisticalCompatibility({sourceFrequency:'DAILY',targetCadence:'MONTHLY',targetSemantics:method.targetSemantics})
  const id = `period_${targetBasis}_${modelId}`
  await owner.query(`INSERT INTO public.forecast_current_runs(id,"seriesId","modelId","displayName",description,frequency,"inputSource","inputRunId",
    "historyFingerprint","targetBasis","methodId","methodVersion","trainingWindowPolicyId","effectiveTrainingPolicyId","historyStartAt","historyEndAt",
    "observationCount","forecastOriginAt",status,"failureReason","runtimeSeconds")
    VALUES($1,$2,$3,$4,$4,$5,'DYNAMIC_MARKET_DATA_STORE',$4,$6,$7,$8,$9,$10,$11,$12,$13,$14,$13,'AVAILABLE',$4,0)`,
  [id,history.providerSeries.providerSeriesId,modelId,marker,buildForecastArtifactCadenceIdentity(createForecastCadence('DAILY','MONTHLY')),hash,targetBasis,
    method.methodId,method.methodVersion,statistical.trainingWindowPolicyId,statistical.effectiveTrainingPolicyId,prepared.history.start,prepared.history.end,prepared.history.observations])
  const variants = {naive:'NAIVE_LAST_VALUE',damped_holt:'DAMPED_HOLT_ADDITIVE',ets:'ETS(A,N,N)',arima:'ARIMA(1,0,1)'}
  const parameters = {naive:{},damped_holt:{alpha:0,beta:0,phi:1,initial_level:0,initial_trend:0},ets:{smoothing_level:0},arima:{order:[1,0,1],seasonal_order:[0,0,0,0],trend:'t',x1:0,policyIdentity:'ARIMA_NON_SEASONAL_BOUNDED_AICC_V1',
    candidateCount:3,tieBreakPolicy:'LOWER_D_THEN_LOWER_P_PLUS_Q_THEN_P_THEN_Q',estimationPolicyIdentity:'ARIMA_SAMPLE_SIZE_ADAPTIVE_EXACT_MLE_V1',
    fitImplementation:'STATSMODELS_ARIMA_STATESPACE','ar.L1':0,sigma2:0}}
  const expected = {}
  for (const [horizon,steps] of Object.entries(prepared.execution.horizons)) {
    const metadata = {modelFamily:modelId,selectedVariant:variants[modelId],selectedParameters:parameters[modelId],selectionScore:0,
      selectionMetric:['ets','arima'].includes(modelId)?'AICc':null,fitStatus:'SUCCEEDED',failureReason:null}
    if (modelId==='naive') metadata.uncertaintyBand={status:'AVAILABLE',source:'MODEL_NATIVE_SHORT_HISTORY',policyVersion:'ADAPTIVE_UNCERTAINTY_BANDS_V1',
      coverage:0.8,lower:0,upper:0,sampleCount:prepared.history.observations,calibrationStatus:'NOT_AVAILABLE',
      calibrationMethod:'NAIVE_RANDOM_WALK_INNOVATION_RMS_NORMAL',calibrationVersion:'naive-random-walk-innovation-rms-normal-v1',reasonCode:null}
    if (modelId==='damped_holt'||modelId==='ets') metadata.uncertaintyBand={status:'AVAILABLE',source:'MODEL_NATIVE_SHORT_HISTORY',policyVersion:'ADAPTIVE_UNCERTAINTY_BANDS_V1',
      coverage:0.8,lower:0,upper:0,sampleCount:prepared.history.observations,calibrationStatus:'NOT_AVAILABLE',
      calibrationMethod:modelId==='ets'?'STATSMODELS_ETS_SIMULATION':'STATSMODELS_DAMPED_HOLT_SIMULATION',
      calibrationVersion:modelId==='ets'?'statsmodels-ets-simulation-seed-1729-r1000-v1':'statsmodels-damped-holt-simulation-seed-1729-r1000-v1',reasonCode:null}
    if (modelId==='arima') metadata.uncertaintyBand={status:'AVAILABLE',source:'EMPIRICAL_EXACT_RESIDUALS',policyVersion:'ADAPTIVE_UNCERTAINTY_BANDS_V1',
      coverage:0.8,lower:0,upper:0,sampleCount:30,calibrationStatus:'CALIBRATED',calibrationMethod:'EMPIRICAL_RESIDUAL_QUANTILES_HF7',
      calibrationVersion:'empirical-exact-residual-quantiles-v1',reasonCode:null}
    const point = attachExactUncertaintyBandIdentity({seriesId:history.providerSeries.providerSeriesId,modelId,targetBasis,methodVersion:method.methodVersion,
      inputSource:'DYNAMIC_MARKET_DATA_STORE',sourceFrequency:'DAILY',targetCadence:'MONTHLY',sourceHistoryFingerprint:hash,
      trainingWindowPolicyId:statistical.trainingWindowPolicyId,effectiveTrainingPolicyId:statistical.effectiveTrainingPolicyId,forecastOrigin:prepared.history.end},
    {horizon,horizonSteps:steps,forecastDate:prepared.execution.currentTargetDates[horizon],forecastValue:0,metadata,failureReason:null})
    expected[horizon]=point
    const tainted=structuredClone(point.metadata);tainted.privateInitiator=marker;tainted.failureReason=marker
    if(tainted.uncertaintyBand){tainted.uncertaintyBand.userId=marker;tainted.uncertaintyBand.identity.requester=marker;tainted.uncertaintyBand.identity.forecastIdentity.organisationId=marker}
    await owner.query(`INSERT INTO public.forecast_current_points(id,"runId","horizonLabel","horizonSteps","forecastDate","forecastValue","failureReason","metadataJson")
      VALUES($1,$2,$3,$4,$5,0,$6,$7::jsonb)`,[`${id}_${horizon}`,id,horizon,steps,point.forecastDate,marker,JSON.stringify(tainted)])
  }
  return {id,hash,statistical,expected,prepared}
}

test('actual generated forecast ORM reads a closed source view with canonical identity and no private/base access', async t => {
  const root = new pg.Client({ connectionString: assertIsolatedTestConnection(process.env.SG2_OPERATION_TEST_OWNER_URL, 'sg2_operation_test', 'architecture_test_owner') })
  await root.connect()
  let owner, prisma, historyPrisma
  const fetch = globalThis.fetch; let external = 0
  globalThis.fetch = async () => { external++; throw Error('No source provider request') }
  try {
    if (!(await root.query('SELECT 1 FROM pg_database WHERE datname=$1', [DATABASE])).rowCount) await root.query(`CREATE DATABASE ${DATABASE}`)
    for (const [role, login] of [[OWNER, false], [MARKET_OWNER, false], [ROLE, true], [MARKET_ROLE, true]]) {
      if (!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role])).rowCount) await root.query(`CREATE ROLE ${role} ${login ? "LOGIN PASSWORD 'isolated_ci_only'" : 'NOLOGIN'} NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`)
      if (login) await root.query(`ALTER ROLE ${role} CONNECTION LIMIT 1`)
    }
    await root.query(`ALTER ROLE ${ROLE} SET default_transaction_read_only=on`)
    const url = new URL(process.env.SG2_OPERATION_TEST_OWNER_URL); url.pathname = `/${DATABASE}`
    owner = new pg.Client({ connectionString: url.toString() }); await owner.connect()
    assert.equal((await owner.query('SELECT current_database() AS db')).rows[0].db, DATABASE)
    await owner.query('DROP SCHEMA IF EXISTS profitia_forecast_read CASCADE; DROP SCHEMA IF EXISTS profitia_market_read CASCADE; DROP TABLE IF EXISTS public.forecast_current_points,public.forecast_current_runs,public.rolling_daily_current_forecast_snapshots,public.market_observations,public.market_series,public.synthetic_private CASCADE; DROP TYPE IF EXISTS public."ForecastTargetBasis"')
    await owner.query(`CREATE TYPE public."ForecastTargetBasis" AS ENUM('MONTHLY_AVERAGE','END_OF_PERIOD','POINT_IN_TIME');
      CREATE TABLE public.market_series("id" text,"providerCode" text,"providerSeriesId" text,"providerSeriesKey" text,"displayName" text,"frequency" text,"currency" text,"unit" text,"sourceLabel" text);
      CREATE TABLE public.market_observations("seriesId" text,"observedAt" timestamp,"value" numeric(24,8)); CREATE TABLE public.synthetic_private(secret text);
      CREATE TABLE public.rolling_daily_current_forecast_snapshots("id" text PRIMARY KEY,"seriesId" text,"inputSource" text,"inputRunId" text,"targetBasis" public."ForecastTargetBasis",
        "methodId" text,"methodVersion" text,"modelId" text,"trainingWindowPolicyId" text,"effectiveTrainingPolicyId" text,"sourceHistoryFingerprint" text,
        "contractVersion" text,"status" text,"reasonCode" text,"message" text,"forecastOriginAt" timestamp,"sourceLatestObservationAt" timestamp,"payloadJson" jsonb,
        "createdAt" timestamp DEFAULT now(),"updatedAt" timestamp DEFAULT now());
      INSERT INTO public.market_series VALUES('daily','MACROBOND','stored_daily_series',null,'Shared daily source','daily',null,'ORIGINAL_UNIT','Synthetic');
      INSERT INTO public.synthetic_private VALUES('${marker}');
      GRANT CREATE ON DATABASE ${DATABASE} TO ${OWNER},${MARKET_OWNER}; GRANT USAGE ON SCHEMA public TO ${OWNER},${MARKET_OWNER};
      GRANT SELECT ON public.market_series,public.market_observations TO ${MARKET_OWNER};
      GRANT SELECT("id","seriesId","inputSource","targetBasis","methodId","methodVersion","modelId","trainingWindowPolicyId","effectiveTrainingPolicyId","sourceHistoryFingerprint",
        "contractVersion","status","forecastOriginAt","sourceLatestObservationAt","payloadJson","createdAt","updatedAt") ON public.rolling_daily_current_forecast_snapshots TO ${OWNER}`)
    await owner.query(`
      DROP TABLE IF EXISTS public.forecast_current_points,public.forecast_current_runs CASCADE;
      CREATE TABLE public.forecast_current_runs (
        id text PRIMARY KEY,"seriesId" text,"displayName" text,description text,frequency text,currency text,unit text,"sourceLabel" text,
        "inputSource" text,"inputRunId" text,"historyFingerprint" text,"targetBasis" public."ForecastTargetBasis","methodId" text,
        "historyStartAt" timestamp,"historyEndAt" timestamp,"observationCount" integer,"forecastOriginAt" timestamp,
        "modelId" text,"methodVersion" text,"trainingWindowPolicyId" text,"effectiveTrainingPolicyId" text,
        status text,"failureReason" text,"runtimeSeconds" double precision,"createdAt" timestamp DEFAULT now(),"updatedAt" timestamp DEFAULT now());
      CREATE TABLE public.forecast_current_points (
        id text PRIMARY KEY,"runId" text REFERENCES public.forecast_current_runs(id),"horizonLabel" text,"horizonSteps" integer,
        "forecastDate" timestamp,"forecastValue" numeric(24,8),"fitStatus" text,"failureReason" text,"selectedVariant" text,
        "selectionMetric" text,"selectionScore" double precision,"metadataJson" jsonb,"createdAt" timestamp DEFAULT now(),"updatedAt" timestamp DEFAULT now());
      GRANT SELECT(id,"seriesId",frequency,"inputSource","historyFingerprint","targetBasis","methodId","historyStartAt","historyEndAt",
        "observationCount","forecastOriginAt","modelId","methodVersion","trainingWindowPolicyId","effectiveTrainingPolicyId",status,"runtimeSeconds","createdAt","updatedAt")
        ON public.forecast_current_runs TO ${OWNER};
      GRANT SELECT(id,"runId","horizonLabel","horizonSteps","forecastDate","forecastValue","metadataJson","createdAt","updatedAt")
        ON public.forecast_current_points TO ${OWNER};`)
    for (const point of points) await owner.query('INSERT INTO public.market_observations VALUES($1,$2,$3)', ['daily', point.date, point.value])
    await owner.query('BEGIN'); await owner.query(`SET LOCAL ROLE ${MARKET_OWNER}`); await owner.query(marketSql)
    await owner.query("INSERT INTO profitia_market_read.installation VALUES(true,'1.0.0',$1,'isolated-forecast-project','isolated-forecast-branch',$2,$3,'SYNTHETIC_NOT_A_RELEASE',now()+interval '1 hour')", [marketDigest, DATABASE, MARKET_ROLE]); await owner.query('COMMIT')
    await owner.query(`GRANT USAGE ON SCHEMA profitia_market_read TO ${OWNER},${ROLE},${MARKET_ROLE};
      GRANT SELECT ON profitia_market_read.series TO ${OWNER};GRANT SELECT ON profitia_market_read.series,profitia_market_read.observations TO ${ROLE},${MARKET_ROLE};
      GRANT SELECT ON profitia_market_read.installation TO ${MARKET_ROLE}`)
    await t.test('complete forecast source DDL rolls back on forced failure and cleanly reapplies', async () => {
      await owner.query('BEGIN'); await owner.query(`SET LOCAL ROLE ${OWNER}`)
      try { await owner.query(sql); await owner.query("DO $$ BEGIN RAISE EXCEPTION 'synthetic_forecast_source_failure'; END $$"); assert.fail('Expected forced failure') }
      catch (error) { assert.match(error.message, /synthetic_forecast_source_failure/) } finally { await owner.query('ROLLBACK') }
      assert.equal((await owner.query("SELECT to_regnamespace('profitia_forecast_read')::text AS schema")).rows[0].schema, null)
    })
    await owner.query('BEGIN'); await owner.query(`SET LOCAL ROLE ${OWNER}`); await owner.query(sql)
    await owner.query("INSERT INTO profitia_forecast_read.installation VALUES(true,'2.0.0',$1,$2,'isolated-forecast-project','isolated-forecast-branch',$3,$4,'SYNTHETIC_NOT_A_RELEASE',now()+interval '1 hour')", [digest, marketDigest, DATABASE, ROLE]); await owner.query('COMMIT')
    await owner.query(`REVOKE CREATE ON DATABASE ${DATABASE} FROM ${OWNER},${MARKET_OWNER}; GRANT USAGE ON SCHEMA profitia_forecast_read TO ${ROLE};
      GRANT SELECT ON ALL TABLES IN SCHEMA profitia_forecast_read TO ${ROLE}; GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA profitia_forecast_read TO ${ROLE};
      GRANT USAGE ON TYPE profitia_forecast_read."ForecastTargetBasis" TO ${ROLE}`)
    await owner.query(`INSERT INTO public.rolling_daily_current_forecast_snapshots("id","seriesId","inputSource","inputRunId","targetBasis","methodId","methodVersion","modelId", "trainingWindowPolicyId","effectiveTrainingPolicyId","sourceHistoryFingerprint","contractVersion","status","reasonCode","message","forecastOriginAt","sourceLatestObservationAt","payloadJson")
      VALUES('stored', $1,$2,$3,'POINT_IN_TIME',$4,$5,'naive',$6,$7,$8,'1','AVAILABLE',$3,$3,'2025-03-01','2025-03-01',$9::jsonb)`,
    [selection.seriesId, ROLLING_DAILY_INPUT_SOURCE, marker, ROLLING_DAILY_METHOD_ID, ROLLING_DAILY_METHOD_VERSION,
      compatibility.trainingWindowPolicyId, compatibility.effectiveTrainingPolicyId, fingerprint, JSON.stringify(payload())])
    const runtime = new URL(url); runtime.username = ROLE; runtime.password = 'isolated_ci_only'; runtime.searchParams.set('schema', 'profitia_forecast_read'); runtime.searchParams.set('connection_limit', '1')
    prisma = new PrismaClient({ datasources: { db: { url: runtime.toString() } } })
    const binding = { projectId: 'isolated-forecast-project', branchId: 'isolated-forecast-branch', databaseName: DATABASE, role: ROLE, schemaDigest: digest, marketSchemaDigest: marketDigest }
    const read = createStoredCurrentForecastReader(prisma, binding)
    await t.test('ordinary login and real generated enum/model query preserve stored zeros, units and canonical forecast identity', async () => {
      const login = (await prisma.$queryRawUnsafe('SELECT current_user,session_user,current_database() AS db'))[0]
      assert.equal(login.current_user, ROLE); assert.equal(login.session_user, ROLE); assert.equal(login.db, DATABASE)
      const result = await read(selection); assert.equal(result.status, 'AVAILABLE'); assert.equal(result.origin.value, 0)
      assert.equal(result.benchmark.unit, 'ORIGINAL_UNIT'); assert(result.path.every(point => point.pointForecast === 0))
      assert.equal(result.audit.sourceHistoryFingerprint, fingerprint); assert(!JSON.stringify(result).includes(marker))
      const raw = (await prisma.rollingDailyCurrentForecastSnapshot.findMany())[0]
      assert.equal(raw.inputRunId, null); assert.equal(raw.message, null); assert.equal(raw.reasonCode, null); assert(!JSON.stringify(raw).includes(marker))
    })
    await t.test('all four existing models retain their reviewed stored parameters and the same canonical identity', async () => {
      for (const [model,parameters] of [['naive',null],['damped_holt',{alpha:0,beta:0.5,phi:1,initial_level:0,initial_trend:0}],
        ['ets',{smoothing_level:0,'initial_seasonal.0':0,seasonal_periods:7}],
        ['arima',{order:[1,0,1],seasonal_order:[0,0,0,0],trend:'t',x1:0,policyIdentity:'ARIMA_NON_SEASONAL_BOUNDED_AICC_V1',candidateCount:3,
          tieBreakPolicy:'LOWER_D_THEN_LOWER_P_PLUS_Q_THEN_P_THEN_Q',estimationPolicyIdentity:'ARIMA_SAMPLE_SIZE_ADAPTIVE_EXACT_MLE_V1',
          fitImplementation:'STATSMODELS_ARIMA_STATESPACE','ar.L1':0,sigma2:0}]]) {
        const stored=payload();stored.model.id=model;stored.model.selectedParameters=parameters
        await owner.query('UPDATE public.rolling_daily_current_forecast_snapshots SET "modelId"=$1,"payloadJson"=$2::jsonb WHERE id=\'stored\'',[model,JSON.stringify(stored)])
        try { const result=await read({...selection,modelId:model});assert.equal(result.status,'AVAILABLE');assert.equal(result.model.id,model);assert.deepEqual(result.model.selectedParameters,parameters) }
        finally { await owner.query('UPDATE public.rolling_daily_current_forecast_snapshots SET "modelId"=\'naive\',"payloadJson"=$1::jsonb WHERE id=\'stored\'',[JSON.stringify(payload())]) }
      }
    })
    await t.test('oversized statistical paths are withheld before crossing the source ORM boundary', async () => {
      const stored=payload();stored.path=Array.from({length:367},()=>stored.path[0])
      await owner.query('UPDATE public.rolling_daily_current_forecast_snapshots SET "payloadJson"=$1::jsonb WHERE id=\'stored\'',[JSON.stringify(stored)])
      try { assert.deepEqual(await prisma.rollingDailyCurrentForecastSnapshot.findMany(),[]);assert.equal((await read(selection)).status,'NOT_AVAILABLE') }
      finally { await owner.query('UPDATE public.rolling_daily_current_forecast_snapshots SET "payloadJson"=$1::jsonb WHERE id=\'stored\'',[JSON.stringify(payload())]) }
    })
    await t.test('an unknown model artifact is honest missing data with no refit or provider fallback', async () => {
      const result = await read({ ...selection, modelId: 'ets' }); assert.equal(result.status, 'NOT_AVAILABLE'); assert.match(result.reason, /MISS/)
    })
    await t.test('source role cannot read raw snapshots/private rows or mutate approved data/receipts', async () => {
      for (const query of ['SELECT * FROM public.synthetic_private', 'SELECT * FROM public.rolling_daily_current_forecast_snapshots',
        'SELECT * FROM public.market_series', 'UPDATE profitia_forecast_read.installation SET source_ref=\'forged\'',
        'CREATE TABLE profitia_forecast_read.forged(id integer)']) await assert.rejects(prisma.$executeRawUnsafe(query))
    })
    await t.test('stored unavailable and failed artifacts retain their reason code without raw messages or invented forecasts', async () => {
      for(const status of ['NOT_AVAILABLE','FAILED']) {
        const original=payload();const stored={contractVersion:original.contractVersion,status,benchmark:original.benchmark,forecastMethod:original.forecastMethod,
          model:original.model,audit:original.audit,warnings:original.warnings,reasonCode:'MODEL_FIT_FAILED',message:marker}
        await owner.query('UPDATE public.rolling_daily_current_forecast_snapshots SET status=$1,"payloadJson"=$2::jsonb WHERE id=\'stored\'',[status,JSON.stringify(stored)])
        try{const result=await read(selection);assert.equal(result.status,status);assert.equal(result.reasonCode,'MODEL_FIT_FAILED');assert.equal(result.message,null);assert.equal('path' in result,false);assert(!JSON.stringify(result).includes(marker))}
        finally{await owner.query('UPDATE public.rolling_daily_current_forecast_snapshots SET status=\'AVAILABLE\',"payloadJson"=$1::jsonb WHERE id=\'stored\'',[JSON.stringify(original)])}
      }
    })
    await t.test('actual history change and stale statistical identity never publish an obsolete snapshot or refit it', async () => {
      await owner.query("UPDATE public.market_observations SET value=1 WHERE \"seriesId\"='daily' AND \"observedAt\"='2025-01-01'")
      try { const result=await read(selection);assert.equal(result.status,'NOT_AVAILABLE');assert.match(result.reason,/STALE/) }
      finally { await owner.query("UPDATE public.market_observations SET value=0 WHERE \"seriesId\"='daily'") }
      for (const column of ['trainingWindowPolicyId','effectiveTrainingPolicyId','sourceHistoryFingerprint','methodVersion']) {
        const previous=(await owner.query(`SELECT "${column}" AS value FROM public.rolling_daily_current_forecast_snapshots WHERE id='stored'`)).rows[0].value
        await owner.query(`UPDATE public.rolling_daily_current_forecast_snapshots SET "${column}"='synthetic_stale_identity' WHERE id='stored'`)
        try { assert.equal((await read(selection)).status,'NOT_AVAILABLE') }
        finally { await owner.query(`UPDATE public.rolling_daily_current_forecast_snapshots SET "${column}"=$1 WHERE id='stored'`,[previous]) }
      }
    })
    await t.test('foreign, expired or mismatched source receipts are refused without disclosing rows', async () => {
      const original=(await owner.query('SELECT * FROM profitia_forecast_read.installation')).rows[0]
      for (const [column,value] of [['project_id','foreign'],['branch_id','foreign'],['database_name','foreign'],['runtime_role','foreign'],
        ['schema_digest','f'.repeat(64)],['market_schema_digest','f'.repeat(64)],['expires_at',new Date(0)]]) {
        await owner.query(`UPDATE profitia_forecast_read.installation SET ${column}=$1`,[value])
        try { await assert.rejects(read(selection),error=>error.code==='STORED_FORECAST_SOURCE_UNAVAILABLE' && error.status===503) }
        finally { await owner.query(`UPDATE profitia_forecast_read.installation SET ${column}=$1`,[original[column]]) }
      }
      await assert.rejects(createStoredCurrentForecastReader(prisma,{...binding,role:'wrong_role'})(selection))
    })
    await t.test('column-only private access, write grant, schema CREATE and callable definer drift all fail before publication', async () => {
      for (const [grant,revoke] of [
        [`GRANT SELECT(secret) ON public.synthetic_private TO ${ROLE}`,`REVOKE SELECT(secret) ON public.synthetic_private FROM ${ROLE}`],
        [`GRANT UPDATE(schema_digest) ON profitia_forecast_read.installation TO ${ROLE}`,`REVOKE UPDATE(schema_digest) ON profitia_forecast_read.installation FROM ${ROLE}`],
        [`GRANT CREATE ON SCHEMA profitia_forecast_read TO ${ROLE}`,`REVOKE CREATE ON SCHEMA profitia_forecast_read FROM ${ROLE}`],
        ["CREATE FUNCTION public.synthetic_forecast_definer() RETURNS text LANGUAGE sql SECURITY DEFINER AS $$ SELECT 'private'::text $$",'DROP FUNCTION public.synthetic_forecast_definer()'],
      ]) {
        await owner.query(grant)
        try { await assert.rejects(read(selection),error=>error.code==='STORED_FORECAST_SOURCE_UNAVAILABLE') }
        finally { await owner.query(revoke) }
      }
      assert.equal((await read(selection)).status,'AVAILABLE')
    })
    await t.test('unknown model parameters are withheld at the SQL boundary and unsupported payload fields cannot cross the ORM', async () => {
      const original=payload(); const tainted=payload();tainted.model.selectedParameters={requesterNote:marker}
      await owner.query('UPDATE public.rolling_daily_current_forecast_snapshots SET "payloadJson"=$1::jsonb WHERE id=\'stored\'', [JSON.stringify(tainted)])
      try { assert.deepEqual(await prisma.rollingDailyCurrentForecastSnapshot.findMany(),[]);assert.equal((await read(selection)).status,'NOT_AVAILABLE') }
      finally { await owner.query('UPDATE public.rolling_daily_current_forecast_snapshots SET "payloadJson"=$1::jsonb WHERE id=\'stored\'', [JSON.stringify(original)]) }
      await owner.query(`ALTER ROLE ${ROLE} SET default_transaction_read_only=off`)
      try { assert.equal((await read(selection)).status,'AVAILABLE') }
      finally { await owner.query(`ALTER ROLE ${ROLE} SET default_transaction_read_only=on`) }
    })
    const marketRuntime = new URL(runtime); marketRuntime.username = MARKET_ROLE; marketRuntime.searchParams.set('schema', 'profitia_market_read')
    historyPrisma = new HistoryPrismaClient({ datasources: { db: { url: marketRuntime.toString() } } })
    await t.test('adding the forecast boundary does not broaden or invalidate the original three-object market reader', async () => {
      const oldRead = createStoredMarketHistoryReader(historyPrisma, { ...binding, role: MARKET_ROLE, schemaDigest: marketDigest })
      assert.equal((await oldRead(selection.seriesId)).history.historical.length, 60)
      await assert.rejects(historyPrisma.$queryRawUnsafe('SELECT * FROM profitia_forecast_read.rolling_daily_current_forecast_snapshots'))
    })
    await t.test('prepared period Current reads reuse canonicalization, per-model identity and the original business service',async t=>{
      const seriesId='stored_period_daily_series'
      const history={providerSeries:{provider:{providerCode:'MACROBOND',displayName:'Macrobond'},providerSeriesId:seriesId,providerSeriesKey:null},
        displayName:'Shared daily period source',frequency:'DAILY',currency:null,unit:'ORIGINAL_UNIT',source:'Synthetic',historical:[]}
      await owner.query('INSERT INTO public.market_series VALUES($1,\'MACROBOND\',$2,null,$3,\'daily\',null,\'ORIGINAL_UNIT\',\'Synthetic\')',['period-series',seriesId,history.displayName])
      for(let month=0;month<36;month++)for(const day of [15,16]){
        const date=new Date(Date.UTC(2022,month,day)).toISOString();history.historical.push({date,value:0})
        await owner.query('INSERT INTO public.market_observations VALUES($1,$2,0)',['period-series',date])
      }
      const artifacts=new Map()
      for(const basis of ['MONTHLY_AVERAGE','END_OF_PERIOD'])for(const model of ['naive','damped_holt','ets','arima']){
        artifacts.set(`${basis}:${model}`,await seedPeriodCurrent(owner,history,basis,model))
      }
      await t.test('both period meanings and all four models retain genuine stored values, canonical fingerprints and band identities',async()=>{
        for(const[basis,model]of[...artifacts.keys()].map(key=>key.split(':'))){
          const expected=artifacts.get(`${basis}:${model}`),result=await read({seriesId,modelId:model,targetBasis:basis})
          assert.equal(result.status,'AVAILABLE');assert.equal(result.targetBasis,basis);assert.equal(result.modelId,model)
          assert.equal(result.historyFingerprint,expected.hash);assert.deepEqual(result.lineage.statisticalCompatibility,expected.statistical)
          assert.equal(result.history.observations,expected.prepared.history.observations)
          assert.equal(result.source.runId,null);assert.equal(result.lineage.inputRunId,null);assert.equal(result.runtimeSeconds,0)
          assert.deepEqual(result.currentForecast,expected.expected);assert(!JSON.stringify(result).includes(marker))
        }
        const raw=await prisma.forecastCurrentRun.findMany({include:{points:true}})
        assert.equal(raw.length,8);assert(!JSON.stringify(raw).includes(marker));assert(raw.every(run=>run.inputRunId===null&&run.failureReason===null))
      })
      await t.test('pure prepared period read never initializes a global owner client through unused execution bookkeeping',async()=>{
        const previousUrl=process.env.MARKET_DATA_DATABASE_URL,previousClient=globalThis.__sgRuntimeMarketDataPrisma__
        let globalLookups=0
        process.env.MARKET_DATA_DATABASE_URL='synthetic-global-client-must-not-be-used'
        globalThis.__sgRuntimeMarketDataPrisma__={$on(){globalLookups++;throw Error('Global execution ledger client must not be resolved')}}
        try{assert.equal((await read({seriesId,modelId:'naive',targetBasis:'MONTHLY_AVERAGE'})).status,'AVAILABLE');assert.equal(globalLookups,0)}
        finally{globalThis.__sgRuntimeMarketDataPrisma__=previousClient;if(previousUrl===undefined)delete process.env.MARKET_DATA_DATABASE_URL;else process.env.MARKET_DATA_DATABASE_URL=previousUrl}
      })
      await t.test('stale canonical history is withheld without refitting; restoring exact history restores availability',async()=>{
        await owner.query('UPDATE public.market_observations SET value=1 WHERE "seriesId"=\'period-series\' AND "observedAt"=\'2024-12-15\'')
        try{assert.equal((await read({seriesId,modelId:'naive',targetBasis:'MONTHLY_AVERAGE'})).status,'NOT_AVAILABLE')
          assert.equal((await read({seriesId,modelId:'naive',targetBasis:'END_OF_PERIOD'})).status,'AVAILABLE')}
        finally{await owner.query('UPDATE public.market_observations SET value=0 WHERE "seriesId"=\'period-series\'')}
        assert.equal((await read({seriesId,modelId:'naive',targetBasis:'MONTHLY_AVERAGE'})).status,'AVAILABLE')
      })
      await t.test('an invalid point or mismatched band identity hides the whole artifact rather than publishing a partial forecast',async()=>{
        const id=artifacts.get('MONTHLY_AVERAGE:naive').id,pointId=`${id}_1M`
        const original=(await owner.query('SELECT "metadataJson" FROM public.forecast_current_points WHERE id=$1',[pointId])).rows[0].metadataJson
        for(const corrupt of [meta=>{meta.selectedParameters.requester=marker},meta=>{meta.uncertaintyBand.identity.sourceHistoryFingerprint='f'.repeat(64)}]){
          const tainted=structuredClone(original);corrupt(tainted)
          await owner.query('UPDATE public.forecast_current_points SET "metadataJson"=$1::jsonb WHERE id=$2',[JSON.stringify(tainted),pointId])
          try{assert.equal(await prisma.forecastCurrentRun.findFirst({where:{id}}),null)
            const result=await read({seriesId,modelId:'naive',targetBasis:'MONTHLY_AVERAGE'});assert.equal(result.status,'NOT_AVAILABLE');assert(!JSON.stringify(result).includes(marker))}
          finally{await owner.query('UPDATE public.forecast_current_points SET "metadataJson"=$1::jsonb WHERE id=$2',[JSON.stringify(original),pointId])}
        }
      })
      await t.test('cadence mismatches and absent non-daily provenance never gain authority from a prepared row',async()=>{
        assert.equal((await read({seriesId,modelId:'naive',targetBasis:'MONTHLY_AVERAGE',sourceFrequency:'MONTHLY',targetCadence:'MONTHLY'})).status,'NOT_AVAILABLE')
        await owner.query('UPDATE public.market_series SET frequency=\'monthly\' WHERE id=\'period-series\'')
        try{assert.equal((await read({seriesId,modelId:'naive',targetBasis:'MONTHLY_AVERAGE'})).status,'NOT_AVAILABLE')}
        finally{await owner.query('UPDATE public.market_series SET frequency=\'daily\' WHERE id=\'period-series\'')}
        assert.equal((await read({seriesId,modelId:'naive',targetBasis:'MONTHLY_AVERAGE',sourceFrequency:'DAILY',targetCadence:'MONTHLY'})).status,'AVAILABLE')
      })
    })
    assert.equal(external, 0)
  } finally { globalThis.fetch = fetch; await historyPrisma?.$disconnect(); await prisma?.$disconnect(); await owner?.end(); await root.end() }
})

test('existing Current DAO keeps exact and latest reads on the supplied real ordinary Prisma transaction', async t => {
  const root = new pg.Client({ connectionString: assertIsolatedTestConnection(process.env.SG2_OPERATION_TEST_OWNER_URL, 'sg2_operation_test', 'architecture_test_owner') })
  const role = 'sg2_current_dao_test_reader', schema = 'forecast_current_dao_test'
  const previousUrl = process.env.MARKET_DATA_DATABASE_URL
  const previousGlobal = globalThis.__sgRuntimeMarketDataPrisma__
  const previousFetch = globalThis.fetch
  let owner, prisma, globalReads = 0, externalReads = 0
  await root.connect()
  try {
    if (!(await root.query('SELECT 1 FROM pg_database WHERE datname=$1', [DATABASE])).rowCount) await root.query(`CREATE DATABASE ${DATABASE}`)
    if (!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role])).rowCount) {
      await root.query(`CREATE ROLE ${role} LOGIN PASSWORD 'isolated_ci_only' NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS CONNECTION LIMIT 1`)
    }
    const url = new URL(process.env.SG2_OPERATION_TEST_OWNER_URL); url.pathname = `/${DATABASE}`
    owner = new pg.Client({ connectionString: url.toString() }); await owner.connect()
    await owner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE; CREATE SCHEMA ${schema};
      CREATE TYPE ${schema}."ForecastTargetBasis" AS ENUM('MONTHLY_AVERAGE','END_OF_PERIOD','POINT_IN_TIME');
      CREATE TABLE ${schema}.forecast_current_runs (
        id text PRIMARY KEY,"seriesId" text,"displayName" text,description text,frequency text,currency text,unit text,"sourceLabel" text,
        "inputSource" text,"inputRunId" text,"historyFingerprint" text,"targetBasis" ${schema}."ForecastTargetBasis","methodId" text,
        "historyStartAt" timestamp,"historyEndAt" timestamp,"observationCount" integer,"forecastOriginAt" timestamp,
        "modelId" text,"methodVersion" text,"trainingWindowPolicyId" text,"effectiveTrainingPolicyId" text,
        status text,"failureReason" text,"runtimeSeconds" double precision,"createdAt" timestamp DEFAULT now(),"updatedAt" timestamp DEFAULT now());
      CREATE TABLE ${schema}.forecast_current_points (
        id text PRIMARY KEY,"runId" text REFERENCES ${schema}.forecast_current_runs(id),"horizonLabel" text,"horizonSteps" integer,
        "forecastDate" timestamp,"forecastValue" numeric(24,8),"fitStatus" text,"failureReason" text,"selectedVariant" text,
        "selectionMetric" text,"selectionScore" double precision,"metadataJson" jsonb,"createdAt" timestamp DEFAULT now(),"updatedAt" timestamp DEFAULT now());
      CREATE TABLE ${schema}.synthetic_private(secret text);
      INSERT INTO ${schema}.synthetic_private VALUES('SYNTHETIC_PRIVATE_DAO_MARKER');
      REVOKE ALL ON SCHEMA ${schema} FROM PUBLIC; GRANT USAGE ON SCHEMA ${schema} TO ${role};
      GRANT SELECT ON ${schema}.forecast_current_runs,${schema}.forecast_current_points TO ${role};
      GRANT USAGE ON TYPE ${schema}."ForecastTargetBasis" TO ${role}`)
    const method = resolveForecastMethodContract('MONTHLY_AVERAGE')
    const statistical = createCurrentForecastStatisticalCompatibility({ sourceFrequency: 'MONTHLY', targetCadence: 'MONTHLY', targetSemantics: method.targetSemantics })
    const key = { seriesId: 'synthetic_monthly_dao', modelId: 'naive', targetSemantics: method.targetSemantics,
      methodId: method.methodId, methodVersion: method.methodVersion, inputSource: 'SYNTHETIC_STORED_HISTORY', historyFingerprint: 'older-history',
      targetBasis: 'MONTHLY_AVERAGE', frequencyIdentity: buildForecastArtifactCadenceIdentity({ sourceFrequency: 'MONTHLY', targetCadence: 'MONTHLY' }),
      trainingWindowPolicyId: statistical.trainingWindowPolicyId, effectiveTrainingPolicyId: statistical.effectiveTrainingPolicyId }
    for (const [id, hash, status, updated] of [['older','older-history','AVAILABLE','2025-01-01'],['latest','new-history','AVAILABLE','2025-02-01'],['failed','failed-history','FAILED','2025-03-01']]) {
      await owner.query(`INSERT INTO ${schema}.forecast_current_runs
        (id,"seriesId","modelId","displayName",description,frequency,"inputSource","inputRunId","historyFingerprint","targetBasis","methodId","methodVersion",
        "trainingWindowPolicyId","effectiveTrainingPolicyId","historyStartAt","historyEndAt","observationCount","forecastOriginAt",status,"runtimeSeconds","updatedAt")
        VALUES($1,$2,$3,'Synthetic monthly forecast',null,$4,$5,'synthetic-technical-run',$6,$7,$8,$9,$10,$11,'2024-01-01','2024-12-01',12,'2024-12-01',$12,0,$13)`,
      [id,key.seriesId,key.modelId,key.frequencyIdentity,key.inputSource,hash,key.targetBasis,key.methodId,key.methodVersion,key.trainingWindowPolicyId,key.effectiveTrainingPolicyId,status,updated])
      for (const [horizon,steps,value] of [['3M',3,null],['1M',1,0]]) {
        await owner.query(`INSERT INTO ${schema}.forecast_current_points(id,"runId","horizonLabel","horizonSteps","forecastDate","forecastValue")
          VALUES($1,$2,$3,$4,'2025-01-01',$5)`,[`${id}-${horizon}`,id,horizon,steps,value])
      }
    }
    const runtime = new URL(url); runtime.username = role; runtime.password = 'isolated_ci_only'
    runtime.searchParams.set('schema',schema); runtime.searchParams.set('connection_limit','1')
    prisma = new PrismaClient({ datasources: { db: { url: runtime.toString() } } })
    process.env.MARKET_DATA_DATABASE_URL = runtime.toString()
    globalThis.__sgRuntimeMarketDataPrisma__ = { $on() { globalReads++; throw Error('Explicit DAO must not resolve the global client') } }
    globalThis.fetch = async () => { externalReads++; throw Error('Prepared DAO must not call a provider') }
    await t.test('real ordinary role, exact nested point mapping, zero and null are preserved', async () => {
      const [identity] = await prisma.$queryRawUnsafe('SELECT current_user,session_user,current_database() AS db')
      assert.equal(identity.current_user,role); assert.equal(identity.session_user,role); assert.equal(identity.db,DATABASE)
      const result = await readCurrentRunFromPrisma(key,{prisma})
      assert.equal(result.historyFingerprint,key.historyFingerprint); assert.equal(result.modelId,'naive')
      assert.equal(result.targetBasis,'MONTHLY_AVERAGE'); assert.equal(result.frequencyIdentity,key.frequencyIdentity)
      assert.deepEqual(result.statisticalCompatibility,statistical)
      assert.deepEqual(Object.keys(result.currentForecast),['1M','3M'])
      assert.equal(result.currentForecast['1M'].forecastValue,0); assert.equal(result.currentForecast['3M'].forecastValue,null)
      assert.equal(result.runtimeSeconds,0); assert.equal(result.description,null)
    })
    await t.test('latest AVAILABLE and its full artifact use the same real read-only repeatable transaction', async () => {
      const result = await prisma.$transaction(async tx => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
        assert.equal((await tx.$queryRawUnsafe('SHOW transaction_read_only'))[0].transaction_read_only,'on')
        return readLatestCurrentRunFromPrisma(key,{prisma:tx})
      },{isolationLevel:'RepeatableRead'})
      assert.equal(result.historyFingerprint,'new-history'); assert.equal(result.currentForecast['1M'].forecastValue,0)
      assert.equal(globalReads,0)
    })
    await t.test('all persisted request identity dimensions remain exact and do not refit missing artifacts', async () => {
      for (const field of ['seriesId','modelId','methodId','methodVersion','frequencyIdentity','trainingWindowPolicyId','effectiveTrainingPolicyId']) {
        assert.equal(await readCurrentRunFromPrisma({...key,[field]:'synthetic-mismatch'},{prisma}),null)
        assert.equal(await readLatestCurrentRunFromPrisma({...key,[field]:'synthetic-mismatch'},{prisma}),null)
      }
      assert.equal(await readCurrentRunFromPrisma({...key,targetBasis:'END_OF_PERIOD'},{prisma}),null)
      assert.equal(await readLatestCurrentRunFromPrisma({...key,targetBasis:'END_OF_PERIOD'},{prisma}),null)
      for (const field of ['inputSource','historyFingerprint']) assert.equal(await readCurrentRunFromPrisma({...key,[field]:'synthetic-mismatch'},{prisma}),null)
    })
    await t.test('malformed explicit dependencies fail closed before any global fallback', async () => {
      for (const dependencies of [null,{}, {prisma:null},{prisma:undefined}]) {
        await assert.rejects(readCurrentRunFromPrisma(key,dependencies),/datastore is unavailable/)
        await assert.rejects(readLatestCurrentRunFromPrisma(key,dependencies),/datastore is unavailable/)
      }
      assert.equal(globalReads,0)
    })
    await t.test('SQL refuses private reads and writes; DAO cannot silently retry with the global owner after a permission error', async () => {
      await assert.rejects(prisma.$queryRawUnsafe(`SELECT * FROM ${schema}.synthetic_private`))
      await assert.rejects(prisma.$executeRawUnsafe(`DELETE FROM ${schema}.forecast_current_runs`))
      await assert.rejects(prisma.$executeRawUnsafe(`CREATE TABLE ${schema}.forged(id integer)`))
      await owner.query(`REVOKE SELECT ON ${schema}.forecast_current_points FROM ${role}`)
      try { await assert.rejects(readLatestCurrentRunFromPrisma(key,{prisma})); assert.equal(globalReads,0) }
      finally { await owner.query(`GRANT SELECT ON ${schema}.forecast_current_points TO ${role}`) }
      assert.equal((await readLatestCurrentRunFromPrisma(key,{prisma})).historyFingerprint,'new-history')
    })
    await t.test('existing missing-policy-column fallback stays on the explicit client and retains its legacy compatibility', async () => {
      await owner.query(`ALTER TABLE ${schema}.forecast_current_runs DROP COLUMN "trainingWindowPolicyId", DROP COLUMN "effectiveTrainingPolicyId"`)
      try {
        const legacy = resolveLegacyForecastStatisticalCompatibility('CURRENT',{ sourceFrequency:'MONTHLY',targetCadence:'MONTHLY',targetSemantics:method.targetSemantics })
        assert.deepEqual((await readCurrentRunFromPrisma(key,{prisma})).statisticalCompatibility,legacy)
        const latest = await readLatestCurrentRunFromPrisma(key,{prisma})
        assert.equal(latest.historyFingerprint,'new-history'); assert.deepEqual(latest.statisticalCompatibility,legacy)
        assert.equal(globalReads,0)
      } finally {
        await owner.query(`ALTER TABLE ${schema}.forecast_current_runs ADD COLUMN "trainingWindowPolicyId" text, ADD COLUMN "effectiveTrainingPolicyId" text`)
        await owner.query(`UPDATE ${schema}.forecast_current_runs SET "trainingWindowPolicyId"=$1,"effectiveTrainingPolicyId"=$2`,[key.trainingWindowPolicyId,key.effectiveTrainingPolicyId])
      }
    })
    await t.test('omitting the dependency retains the existing global client behavior and result', async () => {
      globalThis.__sgRuntimeMarketDataPrisma__ = prisma
      assert.deepEqual(await readCurrentRunFromPrisma(key),await readCurrentRunFromPrisma(key,{prisma}))
      assert.deepEqual(await readLatestCurrentRunFromPrisma(key),await readLatestCurrentRunFromPrisma(key,{prisma}))
    })
    assert.equal(globalReads,0); assert.equal(externalReads,0)
  } finally {
    globalThis.fetch = previousFetch; globalThis.__sgRuntimeMarketDataPrisma__ = previousGlobal
    if (previousUrl === undefined) delete process.env.MARKET_DATA_DATABASE_URL
    else process.env.MARKET_DATA_DATABASE_URL = previousUrl
    await prisma?.$disconnect(); await owner?.end(); await root.end()
  }
})
