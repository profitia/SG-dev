import {loadConfig} from './config.mjs';import {createDatabase} from './database.mjs';import {createTelemetry,sentryTransport} from './observability.mjs';
import {setTimeout as delay} from 'node:timers/promises';import {randomUUID} from 'node:crypto';
import {createAuthority} from './auth.mjs';import {createProvider} from './provider.mjs';import {createStorage} from './storage.mjs';
import {claimJob,heartbeat,failJob} from './jobs.mjs';import {processJob} from './processing.mjs';import {runRetention} from './retention.mjs';
let database,transport,telemetry;
try{
 const config=loadConfig(process.env,'worker');database=createDatabase(config);transport=await sentryTransport(config);
 telemetry=createTelemetry({config,send:transport.send});
 await database.probe();telemetry.emit('FOUNDATION_PROBE_OK');telemetry.emit('BOOTSTRAP_STARTED');
 const shutdown=new AbortController();process.on('SIGTERM',()=>shutdown.abort());process.on('SIGINT',()=>shutdown.abort());
 if(!config.processingEnabled){
  // Disabling paid processing must not disable deletion/retention of an
  // already installed compatible library. Foundation without product tables
  // remains idle and never polls a queue.
  const installed=(await database.pool.query("SELECT to_regclass('platform_knowledge.schema_version') AS present")).rows[0]?.present;
  const compatible=installed?await database.engineReady():false;
  if(installed&&!compatible){telemetry.emit('RETENTION_FAILED');throw Error('RETENTION_SCHEMA_MISMATCH');}
  if(compatible){
   const storage=createStorage(process.env);
   try{while(!shutdown.signal.aborted){try{await runRetention({pool:database.pool,storage});}catch{telemetry.emit('RETENTION_FAILED');}await delay(60000,null,{signal:shutdown.signal}).catch(()=>{});}}
   finally{storage.close();}
  }else await new Promise(resolve=>shutdown.signal.addEventListener('abort',resolve,{once:true}));
 }else{
  const authority=createAuthority({config,pool:database.pool,env:process.env}),storage=createStorage(process.env);
  const provider=createProvider({pool:database.pool,apiKey:process.env.OPENAI_API_KEY,authorize:authority.authorizeProvider});
  if(!await database.engineReady())throw Error('ENGINE_ADMISSION_NOT_READY');
  const workerId=randomUUID();let authorityNoticeAt=0,retentionInFlight=null;
  const sweep=()=>retentionInFlight??(retentionInFlight=runRetention({pool:database.pool,storage}).catch(()=>telemetry.emit('RETENTION_FAILED')).finally(()=>{retentionInFlight=null;}));
  await sweep();const retentionTimer=setInterval(sweep,60000);
  try{while(!shutdown.signal.aborted){
   const waiting=(await database.pool.query("SELECT 1 FROM platform_knowledge.jobs WHERE status IN ('QUEUED','RETRY_WAIT','RUNNING') AND available_at<=clock_timestamp() AND deadline_at>clock_timestamp() LIMIT 1")).rowCount;
   if(waiting&&!await authority.ready()){if(Date.now()>authorityNoticeAt){telemetry.emit('E1_AUTHORITY_UNAVAILABLE');authorityNoticeAt=Date.now()+300000;}await delay(10000,null,{signal:shutdown.signal}).catch(()=>{});continue;}
   const job=await claimJob(database.pool,workerId);
   if(!job){await delay(10000,null,{signal:shutdown.signal}).catch(()=>{});continue;}
   const control=new AbortController(),scopes=[];let heartbeatRunning=false;
   const onStop=()=>control.abort();shutdown.signal.addEventListener('abort',onStop,{once:true});
   const timer=setInterval(async()=>{if(heartbeatRunning)return;heartbeatRunning=true;try{await heartbeat(database.pool,job);}catch{control.abort();}finally{heartbeatRunning=false;}},20000);
   try{const started=Date.now();telemetry.emit('JOB_STARTED');const result=await processJob({pool:database.pool,storage,provider,job,signal:control.signal,
     reportStage:stage=>telemetry.emit('JOB_STAGE',{stage,durationMs:Date.now()-started}),authorizeJob:async value=>{const scope=await authority.authorizeJob(value);scopes.push(scope);return scope;}});telemetry.emit('JOB_COMPLETED',{durationMs:Date.now()-started});if(result?.rawCleanupPending)telemetry.emit('RAW_CLEANUP_PENDING');}
   catch(error){await failJob(database.pool,job,error);telemetry.emit(['ACCESS_BASIS_INVALID','RIGHTS_DENIED','SOURCE_REVOKED','ACCOUNT_DELETED','BUDGET_EXCEEDED'].includes(error.reasonCode??error.code)?'JOB_REJECTED':'JOB_FAILED',{technicalCode:error.reasonCode??error.code});}
   finally{clearInterval(timer);shutdown.signal.removeEventListener('abort',onStop);scopes.forEach(s=>authority.release(s));}
  }}finally{clearInterval(retentionTimer);if(retentionInFlight)await retentionInFlight;storage.close();}
 }
 await database.close();telemetry.emit('BOOTSTRAP_STOPPED');await transport.close();
}catch{telemetry?.emit('FOUNDATION_PROBE_FAILED');await database?.close().catch(()=>{});await transport?.close().catch(()=>{});process.stderr.write('PK_WORKER_FOUNDATION_REJECTED\n');process.exitCode=1;}
