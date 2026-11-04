// SYNTHETIC_ONLY. This module is never imported by either executable service.
import pg from 'pg';
import {request as httpRequest} from 'node:http';
import {randomUUID} from 'node:crypto';
import {migrate as migrateHub} from '../../platform-source-hub/scripts/migrate.mjs';
import {migrate as migrateNewsfeed} from '../scripts/migrate.mjs';
import {createDatabase as hubDatabase} from '../../platform-source-hub/src/database.mjs';
import {createDatabase as newsfeedDatabase} from '../src/database.mjs';
import {createAuthorizer as hubAuthorizer} from '../../platform-source-hub/src/auth.mjs';
import {createAuthorizer as newsfeedAuthorizer} from '../src/auth.mjs';
import {createRepository as hubRepository} from '../../platform-source-hub/src/repository.mjs';
import {createRepository as newsfeedRepository} from '../src/repository.mjs';
import {createAdmission,SOURCE_DEFINITIONS,sourceDefinition} from '../../platform-source-hub/src/admission.mjs';
export const U='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',V='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
export const command={contractVersion:'1.0.0',family:'news-discovery',provider:'newsapi',operation:'search',criteria:{mode:'articles',text:'SYNTHETIC_ONLY'}};
export const observation={name:'Synthetic topic',subjectKind:'topic',subject:'SYNTHETIC_ONLY',request:command};
// Node Fetch does not forward a custom Host. This test-only HTTP client sends
// the actual reverse-proxy authority while still connecting only to loopback.
async function localFetch(input,options={}){
 const req=input instanceof Request?input:new Request(input,options),u=new URL(req.url),bytes=['GET','HEAD'].includes(req.method)?null:Buffer.from(await req.arrayBuffer());
 return new Promise((resolve,reject)=>{const call=httpRequest(u,{method:req.method,headers:Object.fromEntries(req.headers),signal:req.signal},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('error',reject);res.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:res.headers})));});call.on('error',reject);call.end(bytes);});
}
export async function fixture(){
 const url=new URL(process.env.SOURCE_HUB_TEST_ADMIN_URL??'');
 if(url.hostname!=='127.0.0.1'||url.pathname!=='/postgres'||!url.port||url.search||!['postgres:','postgresql:'].includes(url.protocol))throw Error('EXPLICIT_LOOPBACK_TEST_CLUSTER_REQUIRED');
 const root=new pg.Client({connectionString:url.href,ssl:false});await root.connect();
 const names=['stage2a_test_'+process.pid+'_'+randomUUID().slice(0,8)+'_hub','stage2a_test_'+process.pid+'_'+randomUUID().slice(0,8)+'_newsfeed'];
 const password='SYNTHETIC_ONLY_NOT_A_REAL_CREDENTIAL',owners=['profitia_access_owner','profitia_ingestion_owner','source_hub_development_owner','newsfeed_development_owner'];
 const roles=[...owners,'source_hub_development_runtime','source_hub_development_source_runtime','newsfeed_development_runtime','source_hub_development_migrator','newsfeed_development_migrator'];
 await root.query("SELECT pg_advisory_lock(hashtextextended('stage2a-test-role-setup',0))");try{
  for(const role of roles){const present=await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role]);if(!present.rowCount)await root.query('CREATE ROLE '+role+' '+(owners.includes(role)?'NOLOGIN':"LOGIN PASSWORD '"+password+"'")+' NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION');}
  await root.query('GRANT profitia_access_owner,profitia_ingestion_owner,source_hub_development_owner TO source_hub_development_migrator');await root.query('GRANT profitia_access_owner,newsfeed_development_owner TO newsfeed_development_migrator');
 }finally{await root.query("SELECT pg_advisory_unlock(hashtextextended('stage2a-test-role-setup',0))");}
 for(const name of names)await root.query('CREATE DATABASE '+name);
 const connection=(name,role)=>{const u=new URL(url);u.pathname='/'+name;u.username=role;u.password=password;return u.href;};
 const admins=[],databases=[],logs=[],state={providerCalls:[],beforeResponse:null,providerStatus:200};
 async function admin(index,role,action){const c=admins[index];await c.query('BEGIN');try{await c.query('SET LOCAL ROLE '+role);const v=await action(c);await c.query('COMMIT');return v;}catch(error){await c.query('ROLLBACK');throw error;}}
 const common={environment:'development',identityIssuer:'https://synthetic.clerk.accounts.dev',authorizedParties:['https://newsfeed.synthetic.test'],requiredProduct:'SPENDGURU',deploymentId:'SYNTHETIC_ONLY',configurationVersion:'stage2a-test-v1',peerKeyId:'synthetic-key',port:0,host:'127.0.0.1'};
 const hub={...common,applicationId:'profitia-source-hub-development',callerApplicationId:'profitia-newsfeed-api-development',publicOrigin:'https://hub.synthetic.test',callerOrigin:'https://newsfeed.synthetic.test',projectId:'delicate-queen-44677134',branchId:'br-orange-salad-ba2llks7',databaseName:names[0],runtimeRole:'source_hub_development_runtime',sourceRole:'source_hub_development_source_runtime',secrets:{peerKey:Buffer.alloc(32,7),newsapi:'synthetic-newsapi-key',brave:'synthetic-brave-key',tradingEconomics:'synthetic-te-key'}};
 const newsfeed={...common,applicationId:'profitia-newsfeed-api-development',sourceHubApplicationId:hub.applicationId,publicOrigin:hub.callerOrigin,sourceHubOrigin:hub.publicOrigin,projectId:'shiny-bonus-85532609',branchId:'br-wispy-bonus-b9ohunab',databaseName:names[1],runtimeRole:'newsfeed_development_runtime',secrets:{peerKey:hub.secrets.peerKey}};
 const configs=[hub,newsfeed];
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async(input,options)=>{
  const target=new URL(input instanceof Request?input.url:input);if(target.hostname==='127.0.0.1')return localFetch(input,options);
  if(!['newsapi.org','api.search.brave.com','api.tradingeconomics.com'].includes(target.hostname))throw Error('REAL_NETWORK_FORBIDDEN_IN_OFFLINE_TEST');
  state.providerCalls.push({url:target.href,options});if(state.beforeResponse)await state.beforeResponse();
  const body=target.hostname==='newsapi.org'?{status:'ok',totalResults:1,articles:[{source:{id:'synthetic',name:'Synthetic publisher'},url:'https://example.test/article',title:'Synthetic article',description:'OFFLINE FIXTURE',content:null,urlToImage:null,author:null,publishedAt:'2026-11-03T10:00:00Z'}]}:target.hostname==='api.search.brave.com'?{type:'search',query:{},web:{results:[{url:'https://example.test/page',title:'Synthetic web page',description:'OFFLINE FIXTURE'}]}}:target.pathname.startsWith('/calendar')?[{CalendarId:'123',Date:'2026-11-03T12:00:00',Country:'Poland',Category:'Inflation Rate',Event:'CPI',Actual:0,Forecast:2,TEForecast:3,Previous:4,Revised:5,DateSpan:0,Importance:1,LastUpdate:'2026-11-03T10:00:00'}]:[{Country:'Poland',Category:'Inflation Rate',HistoricalDataSymbol:'POLANDCPI',LatestValue:0,LatestValueDate:'2026-10-01T00:00:00',LastUpdate:'2026-11-03T10:00:00',ForecastLastUpdate:'2026-11-03T10:00:00',Unit:'%',q1:1}];
  const response=Response.json(state.providerStatus===200?body:{error:'SYNTHETIC_PROVIDER_FAILURE'},{status:state.providerStatus});Object.defineProperty(response,'url',{value:target.href});return response;
 };
 try{
  for(let i=0;i<names.length;i++){
   const c=new pg.Client({connectionString:new URL('/'+names[i],url).href,ssl:false});await c.connect();admins.push(c);
   for(const owner of i===0?owners.slice(0,3):['profitia_access_owner','newsfeed_development_owner'])await c.query('GRANT CREATE ON DATABASE '+names[i]+' TO '+owner);
   const migrator=new pg.Client({connectionString:connection(names[i],i===0?'source_hub_development_migrator':'newsfeed_development_migrator'),ssl:false});await migrator.connect();try{await (i===0?migrateHub:migrateNewsfeed)(migrator,configs[i]);await (i===0?migrateHub:migrateNewsfeed)(migrator,configs[i]);}finally{await migrator.end();}
   await admin(i,'profitia_access_owner',async q=>{
    await q.query('INSERT INTO profitia_access.applications(application_id,status) VALUES($1,\'ACTIVE\')',[configs[i].applicationId]);await q.query('INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES($1,$2,\'ACTIVE\')',[configs[i].runtimeRole,configs[i].applicationId]);
    for(const user of[U,V]){await q.query('INSERT INTO profitia_access.accounts(user_id,status) VALUES($1,\'ACTIVE\')',[user]);await q.query('INSERT INTO profitia_access.external_identities(binding_id,issuer,subject,user_id,status,source_ref,expires_at) VALUES($1,$2,$3,$4,\'ACTIVE\',\'SYNTHETIC_ONLY\',now()+interval \'1 hour\')',[randomUUID(),common.identityIssuer,'user_'+user,user]);}
    for(const org of[A,B]){await q.query('INSERT INTO profitia_access.organisations(organisation_id,status) VALUES($1,\'ACTIVE\')',[org]);await q.query('INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES($1,$2,\'SPENDGURU\',ARRAY[\'personal_workspace\'],\'ACTIVE\',\'EXPLICIT_OFFER\',\'SYNTHETIC_ONLY\',now()+interval \'1 hour\')',[configs[i].applicationId,org]);
     for(const user of[U,V]){await q.query('INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at) VALUES($1,$2,\'ACTIVE\',\'SYNTHETIC_ONLY\',now()+interval \'1 hour\')',[org,user]);for(const op of['personal.list.read','personal.list.write'])await q.query('INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,$2,$3,$4,\'ALLOW\',$5,\'personal_workspace\')',[randomUUID(),configs[i].applicationId,org,user,op]);}
    }
   });
  }
  const licences=[];
  await admin(0,'profitia_ingestion_owner',async q=>{
   await q.query('INSERT INTO profitia_ingestion.runtime_bindings(login_role,binding_id,service_id,application_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,$4,\'PLATFORM_INTERNAL\',$5,$6,\'ACTIVE\',\'SYNTHETIC_ONLY\',now()+interval \'1 hour\')',[hub.sourceRole,randomUUID(),randomUUID(),hub.applicationId,hub.deploymentId,hub.configurationVersion]);
   for(const key of Object.keys(SOURCE_DEFINITIONS)){const [provider,family]=key.split(':'),d=sourceDefinition(provider,family),policy=randomUUID();
    await q.query('INSERT INTO profitia_ingestion.sources(source_id,effect_kind,data_class,payload_schema,quality_version,classification_version,projection_version,status,source_ref,expires_at) VALUES($1,\'STORED_SQL_TRANSACTION\',\'SHARED_KNOWLEDGE\',\'external-call-control-v1\',\'source-hub-api-control-v1\',\'TECHNICAL_CONTROL_NO_PRIVATE_DATA\',\'source-receipt-v1\',\'ACTIVE\',\'SYNTHETIC_ONLY\',now()+interval \'1 hour\')',[d.sourceId]);
    await q.query('INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,resource_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,$4,\'ALLOW\',\'ACTIVE\',\'SYNTHETIC_ONLY\',now()+interval \'1 hour\')',[randomUUID(),hub.sourceRole,d.sourceId,d.resourceId]);
    await q.query('INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,$2,$3,\'SOURCE_TRANSACTION\',3000,now()-interval \'1 hour\',now()+interval \'1 hour\',now()+interval \'1 hour\',\'ACTIVE\',\'SYNTHETIC_ONLY\')',[randomUUID(),hub.applicationId,d.sourceId]);
    await q.query('INSERT INTO profitia_external_call.policies(policy_id,login_role,source_id,resource_id,configuration_version,origin,transport,path_rules,maximum_request_bytes,maximum_response_bytes,timeout_ms,unit,capacity,window_start,window_end,expires_at,status,source_ref) VALUES($1,$2,$3,$4,$5,$6,\'HTTPS\',$7::jsonb,16384,2097152,15000,\'UPSTREAM_ATTEMPT_ADMISSION\',1000,now()-interval \'1 hour\',now()+interval \'1 hour\',now()+interval \'1 hour\',\'ACTIVE\',\'SYNTHETIC_ONLY\')',[policy,hub.sourceRole,d.sourceId,d.resourceId,hub.configurationVersion,d.origin,JSON.stringify(d.pathRules)]);
    await q.query('INSERT INTO profitia_external_native.policies(policy_id,base_policy_version,path_rules,redirect_origins,maximum_response_bytes,credential_mode,completion_mode,status,expires_at,source_ref) VALUES($1,1,$2::jsonb,\'[]\',2097152,\'SERVER_HEADERS\',\'ADMITTED_ATTEMPT_CURRENT_SETTLEMENT\',\'ACTIVE\',now()+interval \'1 hour\',\'SYNTHETIC_ONLY\')',[policy,JSON.stringify(d.nativePathRules)]);
    licences.push([provider,family,d.sourceId,d.resourceId,policy,[newsfeed.applicationId]]);
   }
  });
  await admin(0,'source_hub_development_owner',async q=>{for(const values of licences)await q.query('INSERT INTO source_hub.provider_licences(provider_id,family,licence_ref,version,source_id,resource_id,source_policy_id,private_consumer_use,consumer_application_ids,retention_seconds,redistribution,status,expires_at) VALUES($1,$2,\'SYNTHETIC_ONLY\',1,$3,$4,$5,true,$6,3600,\'PRIVATE_AUTHORISED_CONSUMER_ONLY\',\'ACTIVE\',now()+interval \'1 hour\')',values);});
  // Independently connected ordinary logins. SET ROLE never substitutes a
  // runtime session; canonical SQL verifies session_user and physical binding.
  const hdb=hubDatabase({connectionString:connection(names[0],hub.runtimeRole),binding:{databaseName:names[0],role:hub.runtimeRole},ssl:false}),sdb=hubDatabase({connectionString:connection(names[0],hub.sourceRole),binding:{databaseName:names[0],role:hub.sourceRole},ssl:false}),ndb=newsfeedDatabase({connectionString:connection(names[1],newsfeed.runtimeRole),binding:{databaseName:names[1],role:newsfeed.runtimeRole},ssl:false});databases.push(hdb,sdb,ndb);
  const clerk={async authenticateRequest(request){const token=request.headers.get('authorization'),user=token==='Bearer SYNTHETIC_A'?U:token==='Bearer SYNTHETIC_B'?V:null;if(!user)return {status:'signed-out',isAuthenticated:false};return {status:'signed-in',isAuthenticated:true,toAuth:()=>({isAuthenticated:true,tokenType:'session_token',userId:'user_'+user,sessionId:'session_'+user,sessionClaims:{iss:common.identityIssuer,sub:'user_'+user,sid:'session_'+user,azp:newsfeed.publicOrigin,exp:Math.floor(Date.now()/1000)+3600}})};},sessions:{async getSession(id){return {id,userId:id.replace('session_','user_'),status:'active',actor:null,expireAt:Date.now()+3600000,abandonAt:Date.now()+3600000};}},users:{async getUser(id){return {id,banned:false,locked:false,deprovisioned:false};}}};
  return {hub,newsfeed,U,V,A,B,logs,state,admin,hdb,sdb,ndb,hubAuthorizer:await hubAuthorizer(hub,hdb,{clerkClient:clerk}),newsfeedAuthorizer:await newsfeedAuthorizer(newsfeed,ndb,{clerkClient:clerk}),hubRepository:hubRepository(hub,hdb),newsfeedRepository:newsfeedRepository(newsfeed,ndb),admission:await createAdmission(hub,sdb),async close(){globalThis.fetch=originalFetch;await Promise.all(databases.map(d=>d.close()));for(const c of admins)await c.end();for(const name of names)await root.query('DROP DATABASE '+name+' WITH (FORCE)');await root.end();}};
 }catch(error){globalThis.fetch=originalFetch;await Promise.all(databases.map(d=>d.close()));for(const c of admins)await c.end();for(const name of names)await root.query('DROP DATABASE IF EXISTS '+name+' WITH (FORCE)');await root.end();throw error;}
}
