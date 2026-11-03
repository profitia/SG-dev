import {createClerkClient} from '@clerk/backend';
import {readConfiguration} from './config.mjs';
import {createDatabase} from './database.mjs';
import {createAuthorizer} from './auth.mjs';
import {createAdmission} from './admission.mjs';
import {createRepository} from './repository.mjs';
import {createApplication,createHttpServer} from './server.mjs';
try{
 const c=readConfiguration(),db=createDatabase({connectionString:c.secrets.databaseUrl,binding:{databaseName:c.databaseName,role:c.runtimeRole}}),source=createDatabase({connectionString:c.secrets.sourceDatabaseUrl,binding:{databaseName:c.databaseName,role:c.sourceRole}});
 const clerkClient=createClerkClient({secretKey:c.secrets.clerkSecretKey,publishableKey:c.secrets.clerkPublishableKey});
 const authorizer=await createAuthorizer(c,db,{clerkClient}),admission=await createAdmission(c,source),repository=createRepository(c,db);
 const server=createHttpServer(createApplication({configuration:c,authorizer,admission,repository}),c);
 server.listen(c.port,c.host,()=>process.stdout.write(JSON.stringify({event:'backend_listening',service:'platform-source-hub',port:c.port,environment:c.environment})+'\n'));
 let stopping=false;const stop=()=>{if(stopping)return;stopping=true;server.close(()=>Promise.allSettled([db.close(),source.close()]).then(()=>{process.exitCode=0;}));setTimeout(()=>process.exit(1),30000).unref();};process.once('SIGTERM',stop);process.once('SIGINT',stop);
 server.on('error',()=>{process.stderr.write('{"event":"backend_start_failed","service":"platform-source-hub"}\n');stop();process.exitCode=1;});
}catch{process.stderr.write('{"event":"backend_configuration_refused","service":"platform-source-hub"}\n');process.exitCode=1;}
