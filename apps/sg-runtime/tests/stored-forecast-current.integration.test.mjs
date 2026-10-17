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
import { createCurrentForecastStatisticalCompatibility } from '../lib/forecast/identity.ts'

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
    await owner.query('DROP SCHEMA IF EXISTS profitia_forecast_read CASCADE; DROP SCHEMA IF EXISTS profitia_market_read CASCADE; DROP TABLE IF EXISTS public.rolling_daily_current_forecast_snapshots,public.market_observations,public.market_series,public.synthetic_private CASCADE; DROP TYPE IF EXISTS public."ForecastTargetBasis"')
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
    await owner.query("INSERT INTO profitia_forecast_read.installation VALUES(true,'1.0.0',$1,$2,'isolated-forecast-project','isolated-forecast-branch',$3,$4,'SYNTHETIC_NOT_A_RELEASE',now()+interval '1 hour')", [digest, marketDigest, DATABASE, ROLE]); await owner.query('COMMIT')
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
        ['arima',{order:[1,0,1],seasonal_order:[0,0,0,0],trend:'t',policyIdentity:'ARIMA_NON_SEASONAL_BOUNDED_AICC_V1',candidateCount:3,
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
    assert.equal(external, 0)
  } finally { globalThis.fetch = fetch; await historyPrisma?.$disconnect(); await prisma?.$disconnect(); await owner?.end(); await root.end() }
})
