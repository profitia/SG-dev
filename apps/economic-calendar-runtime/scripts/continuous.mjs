import {pathToFileURL} from 'node:url'
import pg from 'pg'
import {readFile} from 'node:fs/promises'
import {loadConfiguration} from '../src/config.mjs'
import {createDatabase} from '../src/database.mjs'
import {sourceServiceConfiguration} from '../src/source-service.mjs'
import {createSynchronizer} from '../src/synchronization.mjs'
import {createContinuousRuntime} from '../src/continuous.mjs'
import {maintainSourceAccess,monitorAccess} from '../src/access-continuity.mjs'

export async function runContinuous(env=process.env){
 if(env.RENDER_GIT_COMMIT!==env.ECR_EXECUTION_SHA)throw Error('EXACT_SCHEDULER_RELEASE_REQUIRED')
 const c=loadConfiguration(env,'ingest'),database=createDatabase({connectionString:c.connectionString,binding:{databaseName:c.databaseName,role:c.runtimeRole}})
 const identityUrl=new URL(env.ECR_CONTINUITY_DATABASE_URL??'')
 if(identityUrl.hostname!=='ep-late-heart-b9mxo8oi.c-7.eu-central-1.aws.neon.tech'||identityUrl.username!=='economic_calendar_development_ingest'||identityUrl.pathname!=='/platform_private')throw Error('EXACT_IDENTITY_CONTINUITY_BINDING_REQUIRED')
 identityUrl.searchParams.delete('sslmode');identityUrl.searchParams.delete('channel_binding')
 const enabled=env.ECR_ACCESS_MONITOR_ENABLED==='true'
 let sourceMonitor=null,sourceState=null,serviceRenewal=null
 if(enabled){
  const u=new URL(env.ECR_SOURCE_MONITOR_DATABASE_URL??'')
  if(u.hostname!=='ep-noisy-darkness-barhqoqw.c-8.eu-central-1.aws.neon.tech'||u.username!=='economic_calendar_development_source_monitor'||u.pathname!=='/neondb')throw Error('EXACT_SOURCE_MONITOR_BINDING_REQUIRED')
  u.searchParams.delete('sslmode');u.searchParams.delete('channel_binding')
  sourceMonitor=new pg.Client({connectionString:u.href,ssl:{rejectUnauthorized:true},enableChannelBinding:true,connectionTimeoutMillis:5000,query_timeout:15000})
 }
 const identity=new pg.Client({connectionString:identityUrl.href,ssl:{rejectUnauthorized:true},enableChannelBinding:true,connectionTimeoutMillis:5000,query_timeout:15000})
 try{
  await database.verifyLogin();await identity.connect()
  if(sourceMonitor){
   try{await sourceMonitor.connect();const {rows:[r]}=await sourceMonitor.query('SELECT source_hub.ecr_source_access_status() AS result');sourceState={...r.result,status:'NOT_ATTEMPTED'}}
   catch{sourceState={status:'FAILED',dependencies:[{id:'source-control-plane',kind:'CONTROL_PLANE',source:'SourceHub',status:'ERROR',expiresAt:null}]}}
  }
  const sourceEnv={...env,ECR_SOURCE_SIGNING_PRIVATE_KEY:await readFile(env.ECR_SOURCE_SIGNING_PRIVATE_KEY_FILE,'utf8')}
  const synchronizer=createSynchronizer({configuration:c,database,sourceConfiguration:sourceServiceConfiguration(sourceEnv)})
  const runtime=createContinuousRuntime({database,synchronizer,renewAccess:async()=>{
   const {rows:[r]}=await identity.query('SELECT profitia_e1_authority.renew_ecr_service_access() AS result');serviceRenewal=r.result;if(!r.result)throw Error('ECR_CONTINUITY_NOT_ADMITTED');if(sourceMonitor)sourceState=await maintainSourceAccess((sql,values)=>sourceMonitor.query(sql,values));return r.result
  },report:e=>console.log(JSON.stringify({...e,sourceSha:c.deploymentId}))})
  let result
  try{result=await runtime.tick()}catch{result={triggerKind:'SCHEDULED',jobs:[],failed:true,error:'ECR_CONTINUOUS_REFUSED_OR_FAILED'}}
  if(enabled){
   const deliveryTest=env.ECR_ACCESS_MONITOR_TEST_REQUEST_ID?{id:env.ECR_ACCESS_MONITOR_TEST_REQUEST_ID,until:env.ECR_ACCESS_MONITOR_TEST_UNTIL}:null
   const monitored=await monitorAccess({database,sourceState,identityQuery:(sql,values)=>identity.query(sql,values),serviceRenewal,deliveryTest})
   for(const alert of monitored.alerts)console.log(JSON.stringify({event:'ecr_access_expiry_alert',environment:'development',sourceSha:c.deploymentId,...alert}))
   console.log(JSON.stringify({event:'ecr_access_expiry_check',sourceSha:c.deploymentId,sourceRenewal:monitored.sourceRenewal,serviceRenewal:monitored.serviceRenewal,dependenciesChecked:monitored.dependenciesChecked,newAlerts:monitored.alerts.length,resolved:monitored.resolved}))
   result={...result,notificationRequired:monitored.alerts.length>0}
  }
  return result
 }finally{await sourceMonitor?.end().catch(()=>{});await identity.end().catch(()=>{});await database.close()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)runContinuous().then(r=>{console.log(JSON.stringify({event:'ecr_continuous_tick',...r}));if(r.failed||r.notificationRequired)process.exitCode=1}).catch(()=>{console.error('{"event":"ecr_continuous_tick","error":"ECR_CONTINUOUS_REFUSED_OR_FAILED"}');process.exitCode=1})
