import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import test from 'node:test'
import {PrismaClient} from '../generated/market-data-client/index.js'
import {assertIsolatedTestConnection} from '../../architecture-lab/src/operation-postgres-fixture.mjs'
import {grantVerificationProjectionSourceColumns} from './fixtures/stored-forecast-verification-source.mjs'
import {createStoredForecastVerificationReader} from '../lib/forecast/stored-verification-read.ts'
import {createFullVerificationStatisticalCompatibility,createRecentVerificationStatisticalCompatibility,buildForecastArtifactCadenceIdentity,resolveForecastMethodContract} from '../lib/forecast/identity.ts'
import {createForecastCadence} from '../lib/forecast/cadence.ts'
import {buildLiveForecastBridgePayloadFromHistory} from '../lib/forecast/live-market-input.ts'
import {buildForecastHistoryFingerprint} from '../lib/forecast/service.ts'
import {buildRollingDailyHistoryFingerprint,buildRollingDailyTrainingHistoryFingerprints,ROLLING_DAILY_VERIFICATION_IDENTITY_VERSION} from '../lib/forecast/rolling-daily-maintenance.ts'
const require=createRequire(import.meta.url),pg=createRequire(new URL('../../architecture-lab/package.json',import.meta.url))('pg')
const DATABASE='sg2_verification_source_test',ROLE='sg2_stored_verification_test_reader',OWNER='profitia_forecast_read_owner',MARKET_OWNER='profitia_market_read_owner'
const sql=fs.readFileSync(new URL('../prisma-market-data/private-read/002-stored-rolling-current.sql',import.meta.url),'utf8')
const marketSql=fs.readFileSync(new URL('../prisma-market-data/private-read/001-stored-history-read.sql',import.meta.url),'utf8')
const digest=createHash('sha256').update(sql).digest('hex'),marketDigest=createHash('sha256').update(marketSql).digest('hex')
const marker='SYNTHETIC_PRIVATE_VERIFICATION_SOURCE_MARKER'
const seriesId='shared_verification_daily'
const points=Array.from({length:800},(_,i)=>({date:new Date(Date.UTC(2022,0,i+1)).toISOString(),value:0}))
const history={providerSeries:{provider:{providerCode:'MACROBOND',displayName:'Macrobond'},providerSeriesId:seriesId,providerSeriesKey:null},displayName:'Shared stored verification',frequency:'DAILY',currency:null,unit:null,source:'Synthetic',historical:points}
const rollingHistory={seriesId,displayName:history.displayName,description:history.displayName,frequency:'DAILY',source:'Synthetic',points}
const rollingHash=buildRollingDailyHistoryFingerprint(rollingHistory)
const meta=model=>({modelFamily:model,selectedVariant:{naive:'NAIVE_LAST_VALUE',damped_holt:'DAMPED_HOLT_ADDITIVE',ets:'ETS(A,N,N)',arima:'ARIMA(1,1,1)'}[model],
  selectedParameters:model==='arima'?{x1:0,trend:'t',order:[1,1,1],seasonal_order:[0,0,0,0]}:{},selectionMetric:['ets','arima'].includes(model)?'AICc':null,selectionScore:0,fitStatus:'SUCCEEDED',failureReason:marker,requester:marker})
async function seedPeriod(writer,targetBasis,modelId,scope){
  const method=resolveForecastMethodContract(targetBasis),cadence=createForecastCadence('DAILY','MONTHLY')
  const payload=buildLiveForecastBridgePayloadFromHistory(seriesId,history,{targetBasis,targetCadence:'MONTHLY',continuityPolicy:'ALLOW_GAPS'})
  const hash=buildForecastHistoryFingerprint(payload.history,cadence)
  const compatibility=(scope==='RECENT'?createRecentVerificationStatisticalCompatibility:createFullVerificationStatisticalCompatibility)({sourceFrequency:'DAILY',targetCadence:'MONTHLY',targetSemantics:method.targetSemantics})
  const id=`${targetBasis}_${modelId}_${scope}`
  const metadata=meta(modelId)
  if(modelId==='naive')metadata.uncertaintyBand={status:'AVAILABLE',source:'MODEL_NATIVE_SHORT_HISTORY',policyVersion:'ADAPTIVE_UNCERTAINTY_BANDS_V1',coverage:0.8,lower:0,upper:0,sampleCount:12,
    calibrationStatus:'NOT_AVAILABLE',calibrationMethod:'NAIVE_RANDOM_WALK_INNOVATION_RMS_NORMAL',calibrationVersion:'naive-random-walk-innovation-rms-normal-v1',reasonCode:null,privateUser:marker}
  await writer.forecastVerificationRun.create({data:{id,seriesId,modelId,displayName:marker,description:marker,frequency:buildForecastArtifactCadenceIdentity(cadence),inputSource:'DYNAMIC_MARKET_DATA_STORE',inputRunId:marker,historyFingerprint:hash,
    targetBasis,methodId:method.methodId,methodVersion:method.methodVersion,trainingWindowPolicyId:compatibility.trainingWindowPolicyId,effectiveTrainingPolicyId:compatibility.effectiveTrainingPolicyId,
    historyStartAt:new Date(payload.history.start),historyEndAt:new Date(payload.history.end),observationCount:payload.history.observations,forecastOriginAt:new Date(payload.history.end),status:'AVAILABLE',failureReason:marker,runtimeSeconds:0,
    metrics:{create:[{horizonLabel:'1M',horizonSteps:1,origins:24,expectedOrigins:25,failedOrigins:1,coverage:24/25,mae:0,rmse:0,mase:0,smape:0,directionalAccuracy:0,bias:0,
      failureSummaryJson:[{benchmarkId:seriesId,modelId,forecastOrigin:'2023-11-01',horizon:'1M',horizonSteps:1,forecastDate:'2023-12-01',failureReason:marker,privateUser:marker}]},
      {horizonLabel:'3M',horizonSteps:3,origins:0,expectedOrigins:0,failedOrigins:0,coverage:0}]},
    points:{create:Array.from({length:24},(_,i)=>({horizonLabel:'1M',horizonSteps:1,forecastOriginAt:new Date(Date.UTC(2022,i,1)),targetDate:new Date(Date.UTC(2022,i+1,1)),actualObservedAt:null,
      originValue:0,forecastValue:0,actualValue:0,errorValue:0,absoluteErrorValue:0,deltaValue:0,deltaPct:null,maseScale:0,metadataJson:metadata}))}}})
  return {id,hash,compatibility,metadata}
}

test('native stored Verification uses the genuine generated source ORM and ordinary restricted role',async t=>{
  const root=new pg.Client({connectionString:assertIsolatedTestConnection(process.env.SG2_OPERATION_TEST_OWNER_URL,'sg2_operation_test','architecture_test_owner')})
  await root.connect();let owner,writer,reader
  const prior=globalThis.__sgRuntimeMarketDataPrisma__,priorFetch=globalThis.fetch,priorUrl=process.env.MARKET_DATA_DATABASE_URL
  let escapes=0,network=0
  try{
    if(!(await root.query('SELECT 1 FROM pg_database WHERE datname=$1',[DATABASE])).rowCount)await root.query(`CREATE DATABASE ${DATABASE}`)
    for(const[role,login]of[[OWNER,false],[MARKET_OWNER,false],[ROLE,true]]){
      if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)await root.query(`CREATE ROLE ${role} ${login?"LOGIN PASSWORD 'isolated_ci_only'":'NOLOGIN'} NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`)
    }
    await root.query(`ALTER ROLE ${ROLE} CONNECTION LIMIT 1;ALTER ROLE ${ROLE} SET default_transaction_read_only=on`)
    const url=new URL(process.env.SG2_OPERATION_TEST_OWNER_URL);url.pathname=`/${DATABASE}`
    owner=new pg.Client({connectionString:url.toString()});await owner.connect()
    assert.equal((await owner.query('SELECT current_database() AS db,current_user AS role')).rows[0].db,DATABASE)
    // Full schema reset is allowed only in this fixed, guarded, disposable loopback database.
    await owner.query('DROP SCHEMA IF EXISTS profitia_forecast_read CASCADE;DROP SCHEMA IF EXISTS profitia_market_read CASCADE;DROP SCHEMA public CASCADE;CREATE SCHEMA public;REVOKE ALL ON SCHEMA public FROM PUBLIC')
    const push=spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),'db','push','--skip-generate','--schema',fileURLToPath(new URL('../prisma-market-data/schema.prisma',import.meta.url))],{env:{...process.env,MARKET_DATA_DATABASE_URL:url.toString(),MARKET_DATA_DIRECT_URL:url.toString()},encoding:'utf8',timeout:45000})
    assert.equal(push.status,0,push.stderr||push.stdout)
    writer=new PrismaClient({datasources:{db:{url:url.toString()}}})
    await writer.marketSeries.create({data:{id:'daily',providerCode:'MACROBOND',providerSeriesId:seriesId,displayName:history.displayName,frequency:'daily',sourceLabel:'Synthetic',observations:{create:points.map(p=>({observedAt:new Date(p.date),value:p.value}))}}})
    await owner.query(`CREATE TABLE public.synthetic_private(secret text);INSERT INTO public.synthetic_private VALUES('${marker}');GRANT CREATE ON DATABASE ${DATABASE} TO ${OWNER},${MARKET_OWNER};GRANT USAGE ON SCHEMA public TO ${OWNER},${MARKET_OWNER};
      GRANT SELECT ON public.market_series,public.market_observations TO ${MARKET_OWNER};
      GRANT SELECT(id,"seriesId","inputSource","targetBasis","methodId","methodVersion","modelId","trainingWindowPolicyId","effectiveTrainingPolicyId","sourceHistoryFingerprint",
        "contractVersion",status,"forecastOriginAt","sourceLatestObservationAt","payloadJson","createdAt","updatedAt") ON public.rolling_daily_current_forecast_snapshots TO ${OWNER};
      GRANT SELECT(id,"seriesId",frequency,"inputSource","historyFingerprint","targetBasis","methodId","historyStartAt","historyEndAt",
        "observationCount","forecastOriginAt","modelId","methodVersion","trainingWindowPolicyId","effectiveTrainingPolicyId",status,"runtimeSeconds","createdAt","updatedAt")
        ON public.forecast_current_runs TO ${OWNER};
      GRANT SELECT(id,"runId","horizonLabel","horizonSteps","forecastDate","forecastValue","metadataJson","createdAt","updatedAt")
        ON public.forecast_current_points TO ${OWNER};`)
    await grantVerificationProjectionSourceColumns(owner,OWNER)
    await owner.query('BEGIN');await owner.query(`SET LOCAL ROLE ${MARKET_OWNER}`);await owner.query(marketSql);await owner.query('COMMIT')
    await owner.query(`GRANT USAGE ON SCHEMA profitia_market_read TO ${OWNER},${ROLE};GRANT SELECT ON profitia_market_read.series TO ${OWNER};GRANT SELECT ON profitia_market_read.series,profitia_market_read.observations TO ${ROLE}`)
    await owner.query('BEGIN');await owner.query(`SET LOCAL ROLE ${OWNER}`);await owner.query(sql)
    await owner.query("INSERT INTO profitia_forecast_read.installation VALUES(true,'3.0.0',$1,$2,'isolated-verification-project','isolated-verification-branch',$3,$4,'SYNTHETIC_NOT_A_RELEASE',now()+interval '1 hour')",[digest,marketDigest,DATABASE,ROLE]);await owner.query('COMMIT')
    await owner.query(`REVOKE CREATE ON DATABASE ${DATABASE} FROM ${OWNER},${MARKET_OWNER};GRANT USAGE ON SCHEMA profitia_forecast_read TO ${ROLE};GRANT SELECT ON ALL TABLES IN SCHEMA profitia_forecast_read TO ${ROLE};GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA profitia_forecast_read TO ${ROLE};GRANT USAGE ON TYPE profitia_forecast_read."ForecastTargetBasis",profitia_forecast_read."RollingDailyVerificationMaturityStatus" TO ${ROLE}`)
    const seeded=[]
    for(const basis of['MONTHLY_AVERAGE','END_OF_PERIOD'])for(const model of['naive','damped_holt','ets','arima'])for(const scope of['FULL','RECENT'])seeded.push(await seedPeriod(writer,basis,model,scope))
    const identity={seriesId,inputSource:'DYNAMIC_MARKET_DATA_STORE',inputRunId:marker,targetBasis:'POINT_IN_TIME',methodId:'ROLLING_DAILY_POINT_IN_TIME',methodVersion:'rolling-daily-point-in-time-v1',modelId:'naive'}
    const latest=new Date(points.at(-1).date)
    await writer.rollingDailyVerificationRecord.createMany({data:[1,3,6,12].flatMap(months=>Array.from({length:24},(_,i)=>{
      const target=new Date(latest);target.setUTCDate(target.getUTCDate()-i)
      const origin=new Date(target);origin.setUTCDate(origin.getUTCDate()-months*30)
      return {...identity,id:`rolling_${months}_${i}`,forecastOriginAt:origin,horizonLabel:`${months}M`,horizonMonths:months,horizonSteps:20+months+i,
        targetCalendarDate:target,verificationObservedAt:target,maturityStatus:'MATURED',originValue:0,forecastValue:0,actualValue:0,errorValue:0,absoluteErrorValue:0,deltaValue:0,deltaPct:null,residualValue:0,maseScale:0,
        trainingHistoryStartAt:new Date(points[0].date),trainingHistoryEndAt:origin,trainingObservationCount:100,sourceHistoryFingerprint:rollingHash,metadataJson:meta('naive')}
    }))})
    await writer.rollingDailyMaintenanceState.create({data:{...identity,id:'maintenance',historicalOriginStartAt:new Date(points[0].date),minimumTrainingObservations:36,minimumCalibrationSamples:24,
      latestSourceObservationAt:latest,latestSourceHistoryFingerprint:rollingHash,lastProcessedOriginAt:latest,lastMaintenanceStatus:'NO_OP',lastFailureReason:marker}})
    const nativeRollingRows=await writer.rollingDailyVerificationRecord.findMany({where:{modelId:'naive'}})
    await writer.rollingDailyVerificationRecord.createMany({data:nativeRollingRows.map(row=>({...row,id:`arima_${row.id}`,modelId:'arima',metadataJson:meta('arima')}))})
    const nativeMaintenance=await writer.rollingDailyMaintenanceState.findUnique({where:{id:'maintenance'}})
    await writer.rollingDailyMaintenanceState.create({data:{...nativeMaintenance,id:'arima_maintenance',modelId:'arima'}})
    const runtime=new URL(url);runtime.username=ROLE;runtime.password='isolated_ci_only';runtime.searchParams.set('schema','profitia_forecast_read');runtime.searchParams.set('connection_limit','1')
    reader=new PrismaClient({datasources:{db:{url:runtime.toString()}}})
    process.env.MARKET_DATA_DATABASE_URL=runtime.toString();globalThis.__sgRuntimeMarketDataPrisma__={$on(){escapes++;throw Error('Forbidden global source')}};globalThis.fetch=async()=>{network++;throw Error('Forbidden provider')}
    const binding={projectId:'isolated-verification-project',branchId:'isolated-verification-branch',databaseName:DATABASE,role:ROLE,schemaDigest:digest,marketSchemaDigest:marketDigest}
    const read=createStoredForecastVerificationReader(reader,binding)
    await t.test('all four period models, both bases and FULL/RECENT retain original stored statistics and legacy bands without invented identity',async()=>{
      for(const targetBasis of['MONTHLY_AVERAGE','END_OF_PERIOD'])for(const modelId of['naive','damped_holt','ets','arima'])for(const verificationScope of['FULL','RECENT']){
        const result=await read({seriesId,modelId,targetBasis,verificationScope})
        assert.equal(result.status,'AVAILABLE',JSON.stringify({targetBasis,modelId,verificationScope,result}))
        assert.equal(result.displayName,history.displayName);assert.equal(result.source.runId,null);assert.equal(result.runtimeSeconds,0)
        assert.equal(result.verification['1M'].metrics.mae,0);assert.equal(result.verification['1M'].records.length,24);assert.equal(result.verification['3M'].metrics,null)
        assert.equal(result.verification['1M'].records[0].deltaPct,null);assert.equal(result.verification['1M'].records[0].actualObservedAt,null)
        assert.equal(result.verification['1M'].failures[0].failureReason,'FORECAST_FIT_FAILED');assert(!JSON.stringify(result).includes(marker))
        if(modelId==='naive'){const band=result.verification['1M'].records[0].metadata.uncertaintyBand;assert.equal(band.lower,0);assert.equal('identity'in band,false)}
      }
    })
    await t.test('FAST remains the default and keeps the original minimum per-horizon comparison policy',async()=>{
      const input={seriesId,modelId:'naive',targetBasis:'MONTHLY_AVERAGE'}
      // Empty, inapplicable 3M does not block FAST. Its existing rule requires
      // a ready applicable horizon, or an already complete artifact.
      assert.equal((await read(input)).status,'AVAILABLE')
      const metric={runId_horizonLabel:{runId:'MONTHLY_AVERAGE_naive_FULL',horizonLabel:'1M'}}
      await writer.forecastVerificationMetric.update({where:metric,data:{origins:7,expectedOrigins:26,failedOrigins:1,coverage:7/26}})
      try{assert.equal((await read(input)).status,'NOT_AVAILABLE');assert.equal((await read({...input,verificationScope:'FULL'})).status,'NOT_AVAILABLE')}
      finally{await writer.forecastVerificationMetric.update({where:metric,data:{origins:24,expectedOrigins:25,failedOrigins:1,coverage:24/25}})}
      assert.deepEqual(await read(input),await read({...input,verificationScope:'FAST'}))
      await writer.forecastVerificationMetric.update({where:metric,data:{origins:8,expectedOrigins:26,failedOrigins:1,coverage:8/26}})
      try{assert.equal((await read(input)).status,'AVAILABLE');assert.equal((await read({...input,verificationScope:'FULL'})).status,'NOT_AVAILABLE')}
      finally{await writer.forecastVerificationMetric.update({where:metric,data:{origins:24,expectedOrigins:25,failedOrigins:1,coverage:24/25}})}
    })
    await t.test('Rolling FULL/FAST/RECENT retain calendar step variation, NO_OP readiness, nulls and actual mature comparisons',async()=>{
      for(const modelId of['naive','arima'])for(const verificationScope of['FULL','FAST','RECENT']){
        const result=await read({seriesId,modelId,targetBasis:'POINT_IN_TIME',verificationScope})
        assert.equal(result.status,'AVAILABLE',JSON.stringify(result));assert.equal(result.historyFingerprint,rollingHash)
        assert.equal(result.verification['1M'].records.length,24);assert.equal(result.verification['1M'].metrics.mae,0)
        assert(new Set(result.verification['1M'].records.map(r=>r.horizonSteps)).size>1);assert(!JSON.stringify(result).includes(marker))
        if(modelId==='arima')assert.equal(result.verification['1M'].records[0].metadata.selectedParameters.x1,0)
      }
    })
    await t.test('valid prefix identity survives append; a source correction invalidates applicable prefix records without refit',async()=>{
      const row=await writer.rollingDailyVerificationRecord.findUnique({where:{id:'rolling_1_0'}})
      const prefix=buildRollingDailyTrainingHistoryFingerprints(rollingHistory).get(row.trainingHistoryEndAt.toISOString().slice(0,10))
      await writer.rollingDailyVerificationRecord.update({where:{id:row.id},data:{sourceHistoryFingerprint:'b'.repeat(64),metadataJson:{...meta('naive'),verificationIdentityVersion:ROLLING_DAILY_VERIFICATION_IDENTITY_VERSION,trainingHistoryFingerprint:prefix}}})
      try{
        const value=await read({seriesId,modelId:'naive',targetBasis:'POINT_IN_TIME',verificationScope:'FULL'})
        assert.equal(value.status,'AVAILABLE');assert.equal(value.verification['1M'].records.length,24)
        const appended={date:new Date(new Date(points.at(-1).date).getTime()+86400000).toISOString(),value:0}
        const appendedHash=buildRollingDailyHistoryFingerprint({...rollingHistory,points:[...points,appended]})
        await writer.marketObservation.create({data:{seriesId:'daily',observedAt:new Date(appended.date),value:0}})
        await writer.rollingDailyMaintenanceState.update({where:{id:'maintenance'},data:{latestSourceHistoryFingerprint:appendedHash,latestSourceObservationAt:new Date(appended.date),lastProcessedOriginAt:new Date(appended.date)}})
        try{const next=await read({seriesId,modelId:'naive',targetBasis:'POINT_IN_TIME',verificationScope:'FULL'});assert.equal(next.status,'AVAILABLE');assert.equal(next.historyFingerprint,appendedHash);assert.equal(next.verification['1M'].records.length,1)}
        finally{await writer.marketObservation.delete({where:{seriesId_observedAt:{seriesId:'daily',observedAt:new Date(appended.date)}}});await writer.rollingDailyMaintenanceState.update({where:{id:'maintenance'},data:{latestSourceHistoryFingerprint:rollingHash,latestSourceObservationAt:latest,lastProcessedOriginAt:latest}})}
        await writer.marketObservation.update({where:{seriesId_observedAt:{seriesId:'daily',observedAt:new Date(points[0].date)}},data:{value:1}})
        try{assert.equal((await read({seriesId,modelId:'naive',targetBasis:'POINT_IN_TIME',verificationScope:'FULL'})).status,'NOT_AVAILABLE')}
        finally{await writer.marketObservation.update({where:{seriesId_observedAt:{seriesId:'daily',observedAt:new Date(points[0].date)}},data:{value:0}})}
      }finally{await writer.rollingDailyVerificationRecord.update({where:{id:row.id},data:{sourceHistoryFingerprint:rollingHash,metadataJson:meta('naive')}})}
    })
    await t.test('an applicable invalid metadata record refuses the whole publication instead of silently changing statistics',async()=>{
      await writer.rollingDailyVerificationRecord.update({where:{id:'rolling_1_0'},data:{metadataJson:{...meta('naive'),selectedParameters:{userId:marker}}}})
      try{await assert.rejects(read({seriesId,modelId:'naive',targetBasis:'POINT_IN_TIME',verificationScope:'FULL'}))}
      finally{await writer.rollingDailyVerificationRecord.update({where:{id:'rolling_1_0'},data:{metadataJson:meta('naive')}})}
      const id='MONTHLY_AVERAGE_naive_FULL';const point=await writer.forecastVerificationPoint.findFirst({where:{runId:id}})
      await writer.forecastVerificationPoint.update({where:{id:point.id},data:{metadataJson:{...meta('naive'),selectedParameters:{userId:marker}}}})
      try{assert.equal((await read({seriesId,modelId:'naive',targetBasis:'MONTHLY_AVERAGE',verificationScope:'FULL'})).status,'NOT_AVAILABLE')}
      finally{await writer.forecastVerificationPoint.update({where:{id:point.id},data:{metadataJson:seeded[0].metadata}})}
    })
    await t.test('newest failed state stays visible independently of the older available artifact and raw diagnostics stay private',async()=>{
      const base=await writer.forecastVerificationRun.findUnique({where:{id:seeded[0].id}})
      await writer.forecastVerificationRun.create({data:{...base,id:'failed_newest',historyFingerprint:'c'.repeat(64),status:'FAILED',failureReason:marker,updatedAt:new Date('2030-01-01')}})
      const states=await reader.$queryRawUnsafe('SELECT * FROM profitia_forecast_read.forecast_verification_states ORDER BY "updatedAt" DESC')
      assert.equal(states[0].status,'FAILED');assert(!JSON.stringify(states).includes(marker));assert.equal('inputRunId'in states[0],false)
      assert.equal((await read({seriesId,modelId:'naive',targetBasis:'MONTHLY_AVERAGE',verificationScope:'FULL'})).status,'AVAILABLE')
    })
    await t.test('ordinary role, caller/source mismatch, expiration, ACL drift and denied writes never escape to a global client',async()=>{
      const [actual]=await reader.$queryRawUnsafe('SELECT current_user,session_user,current_database() AS db,r.rolsuper,r.rolbypassrls FROM pg_roles r WHERE r.rolname=current_user')
      assert.equal(actual.current_user,ROLE);assert.equal(actual.session_user,ROLE);assert.equal(actual.db,DATABASE);assert.equal(actual.rolsuper,false);assert.equal(actual.rolbypassrls,false)
      for(const query of['SELECT * FROM public.synthetic_private','SELECT * FROM public.forecast_verification_runs','SELECT * FROM public.market_series','DELETE FROM profitia_forecast_read.forecast_verification_runs','UPDATE profitia_forecast_read.installation SET source_ref=\'forged\''])await assert.rejects(reader.$queryRawUnsafe(query))
      const input={seriesId,modelId:'naive',targetBasis:'MONTHLY_AVERAGE',verificationScope:'FULL'}
      assert.equal((await read({...input,sourceFrequency:'WEEKLY',targetCadence:'MONTHLY'})).status,'NOT_AVAILABLE')
      await assert.rejects(read({...input,actorId:marker}))
      for(const changed of[{branchId:'other'},{databaseName:'other'},{role:OWNER},{schemaDigest:'a'.repeat(64)}])await assert.rejects(async()=>createStoredForecastVerificationReader(reader,{...binding,...changed})(input))
      await owner.query("UPDATE profitia_forecast_read.installation SET expires_at=now()-interval '1 second'")
      try{await assert.rejects(read(input))}finally{await owner.query("UPDATE profitia_forecast_read.installation SET expires_at=now()+interval '1 hour'")}
      await owner.query(`GRANT SELECT("inputRunId") ON public.forecast_verification_runs TO ${ROLE}`)
      try{await assert.rejects(read(input))}finally{await owner.query(`REVOKE SELECT("inputRunId") ON public.forecast_verification_runs FROM ${ROLE}`)}
      assert.equal(escapes,0);assert.equal(network,0)
    })
  }finally{
    globalThis.__sgRuntimeMarketDataPrisma__=prior;globalThis.fetch=priorFetch;if(priorUrl===undefined)delete process.env.MARKET_DATA_DATABASE_URL;else process.env.MARKET_DATA_DATABASE_URL=priorUrl
    await reader?.$disconnect();await writer?.$disconnect();await owner?.end();await root.end()
  }
})
