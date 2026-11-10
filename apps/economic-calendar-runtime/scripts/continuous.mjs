import {pathToFileURL} from 'node:url'
import pg from 'pg'
import {readFile} from 'node:fs/promises'
import {loadConfiguration} from '../src/config.mjs'
import {createDatabase} from '../src/database.mjs'
import {sourceServiceConfiguration} from '../src/source-service.mjs'
import {createSynchronizer} from '../src/synchronization.mjs'
import {createContinuousRuntime} from '../src/continuous.mjs'

export async function runContinuous(env=process.env){
 if(env.RENDER_GIT_COMMIT!==env.ECR_EXECUTION_SHA)throw Error('EXACT_SCHEDULER_RELEASE_REQUIRED')
 const c=loadConfiguration(env,'ingest'),database=createDatabase({connectionString:c.connectionString,binding:{databaseName:c.databaseName,role:c.runtimeRole}})
 const identityUrl=new URL(env.ECR_CONTINUITY_DATABASE_URL??'')
 if(identityUrl.hostname!=='ep-late-heart-b9mxo8oi.c-7.eu-central-1.aws.neon.tech'||identityUrl.username!=='economic_calendar_development_ingest'||identityUrl.pathname!=='/platform_private')throw Error('EXACT_IDENTITY_CONTINUITY_BINDING_REQUIRED')
 identityUrl.searchParams.delete('sslmode');identityUrl.searchParams.delete('channel_binding')
 const identity=new pg.Client({connectionString:identityUrl.href,ssl:{rejectUnauthorized:true},enableChannelBinding:true,connectionTimeoutMillis:5000,query_timeout:15000})
 try{
  await database.verifyLogin();await identity.connect()
  const sourceEnv={...env,ECR_SOURCE_SIGNING_PRIVATE_KEY:await readFile(env.ECR_SOURCE_SIGNING_PRIVATE_KEY_FILE,'utf8')}
  const synchronizer=createSynchronizer({configuration:c,database,sourceConfiguration:sourceServiceConfiguration(sourceEnv)})
  const runtime=createContinuousRuntime({database,synchronizer,renewAccess:async()=>{
   const {rows:[r]}=await identity.query('SELECT profitia_e1_authority.renew_ecr_service_access() AS result');if(!r.result)throw Error('ECR_CONTINUITY_NOT_ADMITTED');return r.result
  },report:e=>console.log(JSON.stringify({...e,sourceSha:c.deploymentId}))})
  return await runtime.tick()
 }finally{await identity.end().catch(()=>{});await database.close()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)runContinuous().then(r=>{console.log(JSON.stringify({event:'ecr_continuous_tick',...r}));if(r.failed)process.exitCode=1}).catch(()=>{console.error('{"event":"ecr_continuous_tick","error":"ECR_CONTINUOUS_REFUSED_OR_FAILED"}');process.exitCode=1})
