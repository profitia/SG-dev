import {createClerkClient} from '@clerk/backend';
import {readConfiguration} from './config.mjs';
import {createDatabase} from './database.mjs';
import {createAuthorizer} from './auth.mjs';
import {createRepository,createSavedSearchRepository} from './repository.mjs';
import {createSourceHubClient} from './source-hub-client.mjs';
import {createApplication,createHttpServer} from './server.mjs';
try{
 const c=readConfiguration(),db=createDatabase({connectionString:c.secrets.databaseUrl,binding:{databaseName:c.databaseName,role:c.runtimeRole}});
 const clerkClient=createClerkClient({secretKey:c.secrets.clerkSecretKey,publishableKey:c.secrets.clerkPublishableKey}),authorizer=await createAuthorizer(c,db,{clerkClient,currentAuthority:true}),repository=createRepository(c,db),sourceHub=createSourceHubClient(c);
 const savedSearches=createSavedSearchRepository(c,db);
 const server=createHttpServer(createApplication({authorizer,repository,savedSearches,sourceHub}),c);
 server.listen(c.port,c.host,()=>process.stdout.write(JSON.stringify({event:'backend_listening',service:'newsfeed-runtime',port:c.port,environment:c.environment})+'\n'));
 let stopping=false;const stop=()=>{if(stopping)return;stopping=true;server.close(()=>db.close().then(()=>{process.exitCode=0;}));setTimeout(()=>process.exit(1),30000).unref();};process.once('SIGTERM',stop);process.once('SIGINT',stop);
 server.on('error',()=>{process.stderr.write('{"event":"backend_start_failed","service":"newsfeed-runtime"}\n');stop();process.exitCode=1;});
}catch{process.stderr.write('{"event":"backend_configuration_refused","service":"newsfeed-runtime"}\n');process.exitCode=1;}
