import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import test from 'node:test'
import {readSg2ForecastWorkerConfiguration,createSg2ConfiguredForecastWorker} from '../lib/forecast/source-worker-runtime'
import {storedForecastProcessOptions} from '../lib/forecast/source-worker-science'
import {createForecastPreparationWorker} from '../lib/forecast/preparation-queue'
import targets from '../deployment/private-runtime-targets.json'
const target=targets.environments.development.forecastWorker,lane=target.lanes[0]
const base={PROFITIA_FORECAST_WORKER_ENABLED:'true',APP_ENV:'development',RENDER_SERVICE_ID:lane.serviceId,RENDER_GIT_COMMIT:'a'.repeat(40),
  PROFITIA_FORECAST_WORKER_CONFIGURATION_VERSION:target.configurationVersion,
  PROFITIA_FORECAST_WORKER_DATABASE_URL:`postgresql://${lane.runtimeRole}:synthetic_only@${target.hosts[0]}/${target.databaseName}?sslmode=require`}
test('native worker stays explicitly disabled without resolving a legacy or native client',()=>{
  assert.deepEqual(createSg2ConfiguredForecastWorker({}),{provider:'legacy'})
  assert.deepEqual(readSg2ForecastWorkerConfiguration({...base,PROFITIA_FORECAST_WORKER_ENABLED:'false'}),{provider:'legacy'})
})
test('physical Current and Verification services receive distinct pinned roles and matching lanes',()=>{
  for(const l of target.lanes){
    const result=readSg2ForecastWorkerConfiguration({...base,RENDER_SERVICE_ID:l.serviceId,
      PROFITIA_FORECAST_WORKER_DATABASE_URL:`postgresql://${l.runtimeRole}:synthetic_only@${target.hosts[1]}/${target.databaseName}?sslmode=require&channel_binding=require`})
    assert.equal(result.provider,'native');if(result.provider!=='native')throw Error('Expected native candidate')
    assert.equal(result.mode,l.mode);assert.equal(result.binding.role,l.runtimeRole);assert.equal(result.application.organisationId,null)
    assert.equal(result.application.appId,'spendguru-forecast-worker');assert.equal(result.application.profileId,'PLATFORM_INTERNAL')
    assert.equal(result.application.deploymentId,`${l.serviceId}:${base.RENDER_GIT_COMMIT}`)
  }
})
test('wrong environment, service, lane, role, host, configuration and URL options fail closed',()=>{
  for(const patch of [
    {PROFITIA_FORECAST_WORKER_ENABLED:'yes'},{APP_ENV:'staging'},{APP_ENV:'production'},{APP_ENV:undefined},
    {RENDER_SERVICE_ID:'srv-dapa3tid0e5s73f8bc5g'},{RENDER_GIT_COMMIT:'main'},
    {FORECAST_PREPARATION_WORKER_MODE:'VERIFICATION_ONLY'},{FORECAST_PREPARATION_WORKER_MODE:'ALL'},
    {PROFITIA_FORECAST_WORKER_CONFIGURATION_VERSION:'unregistered'},
    ...[
      base.PROFITIA_FORECAST_WORKER_DATABASE_URL.replace(lane.runtimeRole,'neondb_owner'),
      base.PROFITIA_FORECAST_WORKER_DATABASE_URL.replace(lane.runtimeRole,target.lanes[1].runtimeRole),
      base.PROFITIA_FORECAST_WORKER_DATABASE_URL.replace(target.hosts[0],'localhost'),
      base.PROFITIA_FORECAST_WORKER_DATABASE_URL.replace('sslmode=require','sslmode=disable'),
      base.PROFITIA_FORECAST_WORKER_DATABASE_URL+'&sslmode=require',
      base.PROFITIA_FORECAST_WORKER_DATABASE_URL+'&schema=public',
      base.PROFITIA_FORECAST_WORKER_DATABASE_URL+'&options=-c%20role=neondb_owner',
      base.PROFITIA_FORECAST_WORKER_DATABASE_URL+'&channel_binding=disable',
      base.PROFITIA_FORECAST_WORKER_DATABASE_URL+'#fragment',
      ' '+base.PROFITIA_FORECAST_WORKER_DATABASE_URL,
    ].map(value=>({PROFITIA_FORECAST_WORKER_DATABASE_URL:value})),
  ])assert.throws(()=>readSg2ForecastWorkerConfiguration({...base,...patch}),/configuration unavailable/)
})
test('closed original worker refuses an incomplete dependency graph before default resource resolution',()=>{
  assert.throws(()=>createForecastPreparationWorker({dependencyMode:'CLOSED_SOURCE'}),/every native dependency/)
})
test('stored Python boundary carries no vendor, registry, database or identity credential',()=>{
  const options=storedForecastProcessOptions({PATH:'/usr/bin',LANG:'C.UTF-8',MARKET_DATA_DATABASE_URL:'synthetic',NPM_TOKEN:'synthetic',
    PROFITIA_CLERK_SECRET_KEY:'synthetic',MACROBOND_CLIENT_SECRET:'synthetic',HOME:'/synthetic',PYTHONPATH:'/synthetic',NODE_OPTIONS:'--inspect'})
  assert.equal(options.timeoutMs,120000);assert.equal(options.env.PATH,'/usr/bin')
  for(const key of ['MARKET_DATA_DATABASE_URL','NPM_TOKEN','PROFITIA_CLERK_SECRET_KEY','MACROBOND_CLIENT_SECRET','HOME','PYTHONPATH','NODE_OPTIONS'])assert.equal(options.env[key],undefined)
  assert.equal(options.env.OPENBLAS_NUM_THREADS,'1');assert.equal(options.env.TZ,'UTC');assert(Object.isFrozen(options.env))
})

test('runtime candidate pins the actual native SQL and common source schema bytes',()=>{
  const sha=(url:URL)=>createHash('sha256').update(readFileSync(url)).digest('hex')
  assert.equal(target.boundaryDigest,sha(new URL('../prisma-market-data/private-write/002-forecast-worker.sql',import.meta.url)))
  assert.equal(target.sourceSchemaDigest,sha(new URL('../../../packages/platform-contracts/migrations/access/008-platform-ingestion.sql',import.meta.url)))
  for(const l of target.lanes)assert.equal(l.maximumDatabaseConnections,l.instances*2)
})
