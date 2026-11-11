import {loadConfig} from './config.mjs';import {createDatabase} from './database.mjs';
import {createTelemetry,sentryTransport} from './observability.mjs';import {createServer} from './server.mjs';
try{
 const config=loadConfig(process.env,'api'),database=createDatabase(config),transport=await sentryTransport(config);
 const telemetry=createTelemetry({config,send:transport.send}),server=createServer({database,telemetry});
 server.listen(config.port,'0.0.0.0',()=>telemetry.emit('BOOTSTRAP_STARTED'));
 let stopping=false;
 const stop=()=>{if(stopping)return;stopping=true;const timeout=setTimeout(()=>process.exit(1),8000);timeout.unref();server.close(async()=>{await database.close();telemetry.emit('BOOTSTRAP_STOPPED');await transport.close();clearTimeout(timeout);});};
 process.on('SIGTERM',stop);process.on('SIGINT',stop);
 server.on('error',()=>{process.stderr.write('PK_API_START_FAILED\n');stop();process.exitCode=1;});
}catch{process.stderr.write('PK_CONFIGURATION_REJECTED\n');process.exitCode=1;}
