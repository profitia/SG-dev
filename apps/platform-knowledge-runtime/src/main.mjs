import {loadConfig} from './config.mjs';import {createDatabase} from './database.mjs';
import {createTelemetry,sentryTransport} from './observability.mjs';import {createServer} from './server.mjs';
import {createAuthority} from './auth.mjs';import {createProvider} from './provider.mjs';import {createStorage} from './storage.mjs';import {createLibrary} from './admin.mjs';
try{
 const config=loadConfig(process.env,'api'),database=createDatabase(config),transport=await sentryTransport(config);
 const telemetry=createTelemetry({config,send:transport.send});let storage=null,authority=null,provider=null,library=null;
 if(config.processingEnabled){
  authority=createAuthority({config,pool:database.pool,env:process.env});storage=createStorage(process.env);
  provider=createProvider({pool:database.pool,apiKey:process.env.OPENAI_API_KEY,authorize:authority.authorizeProvider});
  library=createLibrary({pool:database.pool,storage,createDelegation:authority.createDelegation});
 }
 const server=createServer({database,telemetry,config,authority,provider,library});
 server.listen(config.port,'0.0.0.0',()=>telemetry.emit('BOOTSTRAP_STARTED'));
 let stopping=false;
 const stop=()=>{if(stopping)return;stopping=true;const timeout=setTimeout(()=>process.exit(1),8000);timeout.unref();server.close(async()=>{storage?.close();await database.close();telemetry.emit('BOOTSTRAP_STOPPED');await transport.close();clearTimeout(timeout);});};
 process.on('SIGTERM',stop);process.on('SIGINT',stop);
 server.on('error',()=>{process.stderr.write('PK_API_START_FAILED\n');stop();process.exitCode=1;});
}catch{process.stderr.write('PK_CONFIGURATION_REJECTED\n');process.exitCode=1;}
