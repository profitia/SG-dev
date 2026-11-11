import {loadConfig} from './config.mjs';import {createDatabase} from './database.mjs';import {createTelemetry,sentryTransport} from './observability.mjs';
let database,transport,telemetry;
try{
 const config=loadConfig(process.env,'worker');database=createDatabase(config);transport=await sentryTransport(config);
 telemetry=createTelemetry({config,send:transport.send});
 // Foundation-only: verify once, stay alive without polling Neon or claiming jobs.
 await database.probe();telemetry.emit('FOUNDATION_PROBE_OK');telemetry.emit('BOOTSTRAP_STARTED');
 const idle=setInterval(()=>{},60000);let stopping=false;
 const stop=async()=>{if(stopping)return;stopping=true;clearInterval(idle);await database.close();telemetry.emit('BOOTSTRAP_STOPPED');await transport.close();};
 process.on('SIGTERM',stop);process.on('SIGINT',stop);
}catch{telemetry?.emit('FOUNDATION_PROBE_FAILED');await database?.close().catch(()=>{});await transport?.close().catch(()=>{});process.stderr.write('PK_WORKER_FOUNDATION_REJECTED\n');process.exitCode=1;}
