import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { PrismaClient } from '../generated/market-data-client/index.js'
import { assertIsolatedTestConnection } from '../../architecture-lab/src/operation-postgres-fixture.mjs'
import { readVerificationRunFromPrisma, readLatestVerificationRunFromPrisma } from '../lib/forecast/service.ts'
import { readForecastPreparedVariants, readForecastPreparedVariantsFromPort, createLegacyPrismaPreparedStatePort } from '../lib/forecast/prepared-state.ts'
import { createPreparedRollingDailyForecastVerificationReader, createPreparedRollingDailyFastForecastVerificationReader, createPreparedRollingDailyRecentForecastVerificationReader } from '../lib/forecast/rolling-daily-verification.ts'
import { buildForecastHistoryFingerprint } from '../lib/forecast/history-fingerprint.ts'
import { buildLiveForecastBridgePayloadFromHistory } from '../lib/forecast/live-market-input.ts'
import { buildForecastArtifactCadenceIdentity, createFullVerificationStatisticalCompatibility, resolveForecastMethodContract, resolveLegacyForecastStatisticalCompatibility } from '../lib/forecast/identity.ts'
import { buildRollingDailyHistoryFingerprint, ROLLING_DAILY_INPUT_SOURCE, ROLLING_DAILY_METHOD_ID, ROLLING_DAILY_METHOD_VERSION } from '../lib/forecast/rolling-daily-maintenance.ts'

const pg = createRequire(new URL('../../architecture-lab/package.json', import.meta.url))('pg')
const require = createRequire(import.meta.url)
const DATABASE = 'sg2_verification_read_test', SCHEMA = 'forecast_verification_dao_test', ROLE = 'sg2_verification_dao_test_reader'
const factories = [createPreparedRollingDailyForecastVerificationReader, createPreparedRollingDailyFastForecastVerificationReader, createPreparedRollingDailyRecentForecastVerificationReader]
const now = new Date('2025-01-01T00:00:00.000Z')
function history(seriesId, frequency, historical) {
  return { providerSeries: { provider: { providerCode:'MACROBOND',displayName:'Macrobond' },providerSeriesId:seriesId,providerSeriesKey:seriesId },
    displayName:'Synthetic shared history',frequency,currency:null,unit:null,source:'synthetic-local-only',historical }
}
const monthly = history('synthetic_verification_dao','MONTHLY',Array.from({length:48},(_,i)=>({date:new Date(Date.UTC(2021,i,20)).toISOString(),value:0})))
const daily = history('synthetic_rolling_verification_dao','DAILY',Array.from({length:5},(_,i)=>({date:new Date(Date.UTC(2024,0,i+1)).toISOString(),value:100+i})))
const rollingInput = {seriesId:daily.providerSeries.providerSeriesId,modelId:'naive',targetBasis:'POINT_IN_TIME'}
const preparedMonthly = buildLiveForecastBridgePayloadFromHistory(monthly.providerSeries.providerSeriesId,monthly,{targetBasis:'MONTHLY_AVERAGE',targetCadence:'MONTHLY',continuityPolicy:'ALLOW_GAPS'})
const latestHash = buildForecastHistoryFingerprint({...preparedMonthly.history,cadence:{sourceFrequency:'MONTHLY',targetCadence:'MONTHLY'}})
const method = resolveForecastMethodContract('MONTHLY_AVERAGE')
const compatibility = createFullVerificationStatisticalCompatibility({sourceFrequency:'MONTHLY',targetCadence:'MONTHLY',targetSemantics:method.targetSemantics})
const key = {seriesId:monthly.providerSeries.providerSeriesId,modelId:'naive',targetBasis:'MONTHLY_AVERAGE',targetSemantics:method.targetSemantics,
  methodId:method.methodId,methodVersion:method.methodVersion,inputSource:ROLLING_DAILY_INPUT_SOURCE,historyFingerprint:'older-history',
  frequencyIdentity:buildForecastArtifactCadenceIdentity({sourceFrequency:'MONTHLY',targetCadence:'MONTHLY'}),
  trainingWindowPolicyId:compatibility.trainingWindowPolicyId,effectiveTrainingPolicyId:compatibility.effectiveTrainingPolicyId}
const rollingHash = buildRollingDailyHistoryFingerprint({seriesId:daily.providerSeries.providerSeriesId,displayName:daily.displayName,description:daily.displayName,frequency:'DAILY',source:daily.source,points:daily.historical})
const rollingIdentity = {seriesId:daily.providerSeries.providerSeriesId,inputSource:ROLLING_DAILY_INPUT_SOURCE,targetBasis:'POINT_IN_TIME',methodId:ROLLING_DAILY_METHOD_ID,methodVersion:ROLLING_DAILY_METHOD_VERSION,modelId:'naive'}

// This is an internal dependency/SQL test. It deliberately uses raw generated
// tables, not the future closed publication views or a product authorization path.
test('existing Verification and readiness use explicit real generated readers without global escape', async t => {
  const root = new pg.Client({connectionString:assertIsolatedTestConnection(process.env.SG2_OPERATION_TEST_OWNER_URL,'sg2_operation_test','architecture_test_owner')})
  const oldGlobal = globalThis.__sgRuntimeMarketDataPrisma__, oldUrl = process.env.MARKET_DATA_DATABASE_URL, oldFetch = globalThis.fetch
  let owner, writer, prisma, globalReads = 0, externalReads = 0
  await root.connect()
  try {
    if (!(await root.query('SELECT 1 FROM pg_database WHERE datname=$1',[DATABASE])).rowCount) await root.query(`CREATE DATABASE ${DATABASE}`)
    if (!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[ROLE])).rowCount) await root.query(`CREATE ROLE ${ROLE} LOGIN PASSWORD 'isolated_ci_only' NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`)
    await root.query(`ALTER ROLE ${ROLE} CONNECTION LIMIT 1; ALTER ROLE ${ROLE} SET default_transaction_read_only=on`)
    const ownerUrl = new URL(process.env.SG2_OPERATION_TEST_OWNER_URL); ownerUrl.pathname = `/${DATABASE}`
    owner = new pg.Client({connectionString:ownerUrl.toString()}); await owner.connect()
    assert.equal((await owner.query('SELECT current_database() AS db')).rows[0].db,DATABASE)
    // Only this fixed synthetic schema in the guarded loopback database is reset.
    await owner.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE; CREATE SCHEMA ${SCHEMA}; REVOKE ALL ON SCHEMA ${SCHEMA} FROM PUBLIC`)
    ownerUrl.searchParams.set('schema',SCHEMA); ownerUrl.searchParams.set('connection_limit','1')
    const push = spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),'db','push','--skip-generate','--schema',fileURLToPath(new URL('../prisma-market-data/schema.prisma',import.meta.url))],
      {env:{...process.env,MARKET_DATA_DATABASE_URL:ownerUrl.toString(),MARKET_DATA_DIRECT_URL:ownerUrl.toString()},encoding:'utf8',timeout:45000})
    assert.equal(push.status,0,push.stderr || push.stdout)
    writer = new PrismaClient({datasources:{db:{url:ownerUrl.toString()}}})
    for (const [id,hash,status,updatedAt] of [['older',key.historyFingerprint,'AVAILABLE','2024-01-01'],['latest',latestHash,'AVAILABLE','2024-02-01'],['failed','failed-history','FAILED','2024-03-01']]) {
      await writer.forecastVerificationRun.create({data:{id,seriesId:key.seriesId,displayName:monthly.displayName,description:null,frequency:key.frequencyIdentity,
        inputSource:key.inputSource,inputRunId:'synthetic-internal-run',historyFingerprint:hash,targetBasis:key.targetBasis,methodId:key.methodId,methodVersion:key.methodVersion,
        trainingWindowPolicyId:key.trainingWindowPolicyId,effectiveTrainingPolicyId:key.effectiveTrainingPolicyId,modelId:key.modelId,observationCount:48,status,runtimeSeconds:0,
        historyStartAt:new Date('2021-01-20'),historyEndAt:new Date('2024-12-20'),forecastOriginAt:new Date('2024-12-20'),updatedAt:new Date(updatedAt),
        metrics:{create:[{horizonLabel:'3M',horizonSteps:3,origins:0,expectedOrigins:0,failedOrigins:0,coverage:0},
          {horizonLabel:'1M',horizonSteps:1,origins:1,expectedOrigins:1,failedOrigins:0,coverage:1,mae:0,rmse:0,mase:0,smape:0,directionalAccuracy:0,bias:0}]},
        points:{create:{horizonLabel:'1M',horizonSteps:1,forecastOriginAt:new Date('2024-11-20'),targetDate:new Date('2024-12-20'),actualObservedAt:null,
          originValue:0,forecastValue:0,actualValue:0,errorValue:0,absoluteErrorValue:0,deltaValue:0,deltaPct:null,maseScale:0}}}})
    }
    await writer.rollingDailyVerificationRecord.create({data:{...rollingIdentity,id:'rolling',forecastOriginAt:new Date('2024-01-04'),horizonLabel:'1M',horizonMonths:1,horizonSteps:21,
      targetCalendarDate:new Date('2024-02-05'),verificationObservedAt:new Date('2024-02-05'),maturityStatus:'MATURED',originValue:103,forecastValue:104,actualValue:105,
      errorValue:-1,absoluteErrorValue:1,deltaValue:1,deltaPct:0.01,residualValue:1,maseScale:1,trainingHistoryStartAt:new Date('2024-01-01'),
      trainingHistoryEndAt:new Date('2024-01-04'),trainingObservationCount:4,sourceHistoryFingerprint:rollingHash}})
    await writer.rollingDailyMaintenanceState.create({data:{...rollingIdentity,id:'maintenance',historicalOriginStartAt:new Date('2024-01-01'),minimumTrainingObservations:4,
      minimumCalibrationSamples:1,latestSourceObservationAt:new Date('2024-01-05'),latestSourceHistoryFingerprint:rollingHash,lastProcessedOriginAt:new Date('2024-01-05'),lastMaintenanceStatus:'SUCCEEDED'}})
    await owner.query(`CREATE TABLE ${SCHEMA}.synthetic_private(secret text); INSERT INTO ${SCHEMA}.synthetic_private VALUES('SYNTHETIC_PRIVATE_DAO_MARKER');
      GRANT USAGE ON SCHEMA ${SCHEMA} TO ${ROLE};
      GRANT SELECT ON ${SCHEMA}.forecast_verification_runs,${SCHEMA}.forecast_verification_metrics,${SCHEMA}.forecast_verification_points,
        ${SCHEMA}.forecast_current_runs,${SCHEMA}.rolling_daily_current_forecast_snapshots,${SCHEMA}.rolling_daily_verification_records,${SCHEMA}.rolling_daily_maintenance_state TO ${ROLE};
      GRANT USAGE ON TYPE ${SCHEMA}."ForecastTargetBasis",${SCHEMA}."RollingDailyVerificationMaturityStatus" TO ${ROLE}`)
    const readerUrl = new URL(ownerUrl); readerUrl.username = ROLE; readerUrl.password = 'isolated_ci_only'
    prisma = new PrismaClient({datasources:{db:{url:readerUrl.toString()}},log:[{emit:'event',level:'query'}]})
    process.env.MARKET_DATA_DATABASE_URL = readerUrl.toString()
    const poison = {$on(){globalReads++;throw Error('Explicit verification must not resolve global client')}}
    globalThis.__sgRuntimeMarketDataPrisma__ = poison
    globalThis.fetch = async () => {externalReads++;throw Error('Prepared reads must not call an external provider')}
    const readRolling = (factory,client=prisma) => factory({prisma:client,resolveHistory:async()=>({history:daily}),emitPreparedRead(){}})(rollingInput)

    await t.test('actual ordinary role and exact generated nested metrics/points retain zero, null and internal source semantics', async () => {
      const [identity] = await prisma.$queryRawUnsafe('SELECT current_database() AS db,current_user,session_user,r.rolsuper,r.rolbypassrls FROM pg_roles r WHERE r.rolname=current_user')
      assert.equal(identity.db,DATABASE); assert.equal(identity.current_user,ROLE); assert.equal(identity.session_user,ROLE)
      assert.equal(identity.rolsuper,false); assert.equal(identity.rolbypassrls,false)
      const result = await readVerificationRunFromPrisma(key,{prisma})
      assert.equal(result.historyFingerprint,key.historyFingerprint); assert.equal(result.source.runId,'synthetic-internal-run')
      assert.deepEqual(result.statisticalCompatibility,compatibility)
      assert.deepEqual(Object.keys(result.verification),['1M','3M'])
      assert.deepEqual(result.verification['1M'].metrics,{mae:0,rmse:0,mase:0,smape:0,directionalAccuracy:0,bias:0})
      assert.equal(result.verification['3M'].metrics,null)
      assert.equal(result.verification['1M'].records[0].forecastValue,0); assert.equal(result.verification['1M'].records[0].deltaPct,null)
      assert.equal(result.verification['1M'].records[0].actualObservedAt,null); assert.equal(result.runtimeSeconds,0)
    })
    await t.test('exact/latest, readiness and FULL/FAST/RECENT accept the same actual read-only repeatable transaction', async () => {
      const directReadiness = await readForecastPreparedVariants(key.seriesId,monthly,{prisma,now})
      // Readiness reports the newest failed attempt as stale, whereas the DAO
      // deliberately selects the newest AVAILABLE artifact for prepared reuse.
      const monthlyState = variants => variants.find(v=>v.identity.targetSemantics==='MONTHLY_AVERAGE'&&v.identity.modelId==='naive').historical
      assert.equal(monthlyState(directReadiness),'STALE')
      await writer.forecastVerificationRun.update({where:{id:'failed'},data:{updatedAt:new Date('2023-01-01')}})
      try {assert.equal(monthlyState(await readForecastPreparedVariants(key.seriesId,monthly,{prisma,now})),'READY')}
      finally {await writer.forecastVerificationRun.update({where:{id:'failed'},data:{updatedAt:new Date('2024-03-01')}})}
      const directExact = await readVerificationRunFromPrisma(key,{prisma})
      const expectedRolling = await Promise.all(factories.map(factory=>readRolling(factory)))
      assert.equal(expectedRolling[0].status,'AVAILABLE'); assert.equal(expectedRolling[0].verification['1M'].successfulOrigins,1)
      await prisma.$transaction(async tx => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
        assert.equal((await tx.$queryRawUnsafe('SHOW transaction_read_only'))[0].transaction_read_only,'on')
        assert.equal((await readLatestVerificationRunFromPrisma(key,{prisma:tx})).historyFingerprint,latestHash)
        assert.deepEqual(await readVerificationRunFromPrisma(key,{prisma:tx}),directExact)
        assert.deepEqual(await readForecastPreparedVariants(key.seriesId,monthly,{prisma:tx,now}),directReadiness)
        for (let i=0;i<factories.length;i++) assert.deepEqual(await readRolling(factories[i],tx),expectedRolling[i])
        // Daily readiness also queries rolling snapshots, maintenance and counts.
        assert.equal((await readForecastPreparedVariants(daily.providerSeries.providerSeriesId,daily,{prisma:tx,now})).length,12)
      },{isolationLevel:'RepeatableRead',timeout:20000})
      assert.equal(globalReads,0)
    })
    await t.test('neutral readiness port preserves actual generated read-only transaction results and latest failed-attempt truth', async () => {
      await prisma.$transaction(async tx => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
        const port=createLegacyPrismaPreparedStatePort(tx)
        assert(Object.isFrozen(port))
        for (const source of [monthly,daily]) {
          const id=source.providerSeries.providerSeriesId
          const direct=await readForecastPreparedVariants(id,source,{prisma:tx,now})
          const throughPort=await readForecastPreparedVariantsFromPort(id,source,port,{now})
          assert.deepEqual(throughPort,direct)
          if (source===monthly) assert.equal(throughPort.find(v=>v.identity.targetSemantics==='MONTHLY_AVERAGE'&&v.identity.modelId==='naive').historical,'STALE')
          else assert.equal(throughPort.find(v=>v.identity.targetSemantics==='ROLLING_DAILY_POINT_IN_TIME'&&v.identity.modelId==='naive').historical,'READY')
        }
        assert.equal(globalReads,0); assert.equal(externalReads,0)
      },{isolationLevel:'RepeatableRead',timeout:20000})
    })
    await t.test('all persisted Verification identity dimensions still select exact prepared artifacts', async () => {
      for (const field of ['seriesId','modelId','methodId','methodVersion','frequencyIdentity','trainingWindowPolicyId','effectiveTrainingPolicyId']) {
        assert.equal(await readVerificationRunFromPrisma({...key,[field]:'synthetic-mismatch'},{prisma}),null)
        assert.equal(await readLatestVerificationRunFromPrisma({...key,[field]:'synthetic-mismatch'},{prisma}),null)
      }
      assert.equal(await readVerificationRunFromPrisma({...key,inputSource:'synthetic-mismatch'},{prisma}),null)
      assert.equal(await readVerificationRunFromPrisma({...key,historyFingerprint:'synthetic-mismatch'},{prisma}),null)
      assert.equal(await readLatestVerificationRunFromPrisma({...key,targetBasis:'END_OF_PERIOD'},{prisma}),null)
    })
    await t.test('explicit missing/null/malformed readers never fall back, hydrate or refit', async () => {
      for (const dependencies of [null,{}, {prisma:null},{prisma:undefined},{prisma:{}}]) {
        await assert.rejects(readVerificationRunFromPrisma(key,dependencies))
        await assert.rejects(readLatestVerificationRunFromPrisma(key,dependencies))
      }
      for (const options of [null,{prisma:null},{prisma:undefined},{prisma:{}}]) {
        await assert.rejects(readForecastPreparedVariants(key.seriesId,monthly,options))
        for (const factory of factories) await assert.rejects(factory(options)(rollingInput))
      }
      assert.equal(globalReads,0); assert.equal(externalReads,0)
    })
    await t.test('ordinary reader cannot read unrelated private data or mutate source; permission refusal never escapes globally', async () => {
      await assert.rejects(prisma.$queryRawUnsafe(`SELECT * FROM ${SCHEMA}.synthetic_private`))
      await assert.rejects(prisma.forecastVerificationRun.deleteMany())
      await owner.query(`REVOKE SELECT ON ${SCHEMA}.forecast_verification_runs FROM ${ROLE}`)
      try {
        await assert.rejects(readLatestVerificationRunFromPrisma(key,{prisma}))
        await assert.rejects(readForecastPreparedVariants(key.seriesId,monthly,{prisma,now}))
      } finally {await owner.query(`GRANT SELECT ON ${SCHEMA}.forecast_verification_runs TO ${ROLE}`)}
      await owner.query(`REVOKE SELECT ON ${SCHEMA}.rolling_daily_verification_records FROM ${ROLE}`)
      try {for (const factory of factories) await assert.rejects(readRolling(factory))}
      finally {await owner.query(`GRANT SELECT ON ${SCHEMA}.rolling_daily_verification_records TO ${ROLE}`)}
      assert.equal(globalReads,0)
    })
    await t.test('original missing-policy-column compatibility and readiness behavior stay on the supplied reader', async () => {
      await owner.query(`ALTER TABLE ${SCHEMA}.forecast_verification_runs DROP COLUMN "trainingWindowPolicyId", DROP COLUMN "effectiveTrainingPolicyId"`)
      try {
        const legacy = resolveLegacyForecastStatisticalCompatibility('VERIFICATION',{sourceFrequency:'MONTHLY',targetCadence:'MONTHLY',targetSemantics:method.targetSemantics})
        assert.deepEqual((await readVerificationRunFromPrisma(key,{prisma})).statisticalCompatibility,legacy)
        assert.deepEqual((await readLatestVerificationRunFromPrisma(key,{prisma})).statisticalCompatibility,legacy)
        assert.ok((await readForecastPreparedVariants(key.seriesId,monthly,{prisma,now})).every(v=>v.historical==='NOT_PREPARED'))
      } finally {
        await owner.query(`ALTER TABLE ${SCHEMA}.forecast_verification_runs ADD COLUMN "trainingWindowPolicyId" text, ADD COLUMN "effectiveTrainingPolicyId" text`)
        await owner.query(`UPDATE ${SCHEMA}.forecast_verification_runs SET "trainingWindowPolicyId"=$1,"effectiveTrainingPolicyId"=$2`,[key.trainingWindowPolicyId,key.effectiveTrainingPolicyId])
      }
      assert.equal(globalReads,0)
    })
    await t.test('omitted legacy dependencies retain original results; now-only readiness and injected rolling history still work', async () => {
      globalThis.__sgRuntimeMarketDataPrisma__ = prisma
      try {
        assert.deepEqual(await readVerificationRunFromPrisma(key),await readVerificationRunFromPrisma(key,{prisma}))
        assert.deepEqual(await readLatestVerificationRunFromPrisma(key),await readLatestVerificationRunFromPrisma(key,{prisma}))
        assert.deepEqual(await readForecastPreparedVariants(key.seriesId,monthly,{now}),await readForecastPreparedVariants(key.seriesId,monthly,{prisma,now}))
        for (const factory of factories) assert.deepEqual(await factory({resolveHistory:async()=>({history:daily}),emitPreparedRead(){}})(rollingInput),await readRolling(factory))
      } finally {globalThis.__sgRuntimeMarketDataPrisma__=poison}
      delete process.env.MARKET_DATA_DATABASE_URL
      assert.deepEqual(await readForecastPreparedVariants(key.seriesId,monthly),[])
      await assert.rejects(readLatestVerificationRunFromPrisma(key),/datastore is unavailable/)
      process.env.MARKET_DATA_DATABASE_URL=readerUrl.toString()
    })
    assert.equal(globalReads,0); assert.equal(externalReads,0)
  } finally {
    globalThis.fetch=oldFetch; globalThis.__sgRuntimeMarketDataPrisma__=oldGlobal
    if(oldUrl===undefined) delete process.env.MARKET_DATA_DATABASE_URL; else process.env.MARKET_DATA_DATABASE_URL=oldUrl
    await prisma?.$disconnect(); await writer?.$disconnect(); await owner?.end(); await root.end()
  }
})
