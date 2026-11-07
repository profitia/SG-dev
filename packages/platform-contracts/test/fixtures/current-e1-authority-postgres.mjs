// SYNTHETIC_ONLY. Three independent loopback databases; never imported at runtime.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {createHash,randomBytes,randomUUID} from 'node:crypto'
import pg from '../../../../apps/architecture-lab/node_modules/pg/lib/index.js'
import {createCurrentE1Authority} from '../../current-e1-authority/index.mjs'
const load=relative=>fs.readFileSync(new URL(relative,import.meta.url),'utf8')
export const U='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',V='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222'
export async function currentE1Fixture(){
 let directory,root,bin,configuration
 const configured=process.env.OPERATION_FIXTURE_OWNER_URL??process.env.SOURCE_HUB_TEST_ADMIN_URL
 if(configured){const u=new URL(configured);if(!['localhost','127.0.0.1','[::1]'].includes(u.hostname)||!['postgres:','postgresql:'].includes(u.protocol))throw Error('LOOPBACK_FIXTURE_ONLY');configuration={connectionString:u.href}}
 else{
  bin=process.env.B1_PG_BIN??'/opt/homebrew/opt/postgresql@16/bin';directory=fs.mkdtempSync(path.join(os.tmpdir(),'current-e1-offline-'))
  const run=(name,args)=>{if(spawnSync(path.join(bin,name),args,{encoding:'utf8'}).status!==0)throw Error('OFFLINE_POSTGRES_'+name+'_FAILED')}
  run('initdb',['-D',directory+'/data','-U','e1_fixture_operator','-A','trust','--no-locale','-E','UTF8','--wal-segsize=1'])
  run('pg_ctl',['-D',directory+'/data','-l',directory+'/server.log','-o',`-c listen_addresses='' -c shared_buffers=16MB -c max_wal_size=64MB -c min_wal_size=16MB -k ${directory}`,'-w','start'])
  configuration={host:directory,user:'e1_fixture_operator',database:'postgres'}
 }
 root=new pg.Client(configuration);await root.connect()
 const names=['central','hub','newsfeed'].map(kind=>'current_e1_'+kind+'_'+randomUUID().replaceAll('-',''))
 const fixturePassword='SYNTHETIC_ONLY_NOT_A_REAL_CREDENTIAL'
 const owners=['profitia_access_owner','source_hub_development_owner','newsfeed_development_owner']
 const roles=['identity_b1_runtime','source_hub_development_runtime','newsfeed_development_runtime']
 const databases=[],pools=[]
 const close=async()=>{for(const p of pools)await p.end();for(const c of databases)await c.end();for(const n of names)await root.query('DROP DATABASE IF EXISTS '+n+' WITH (FORCE)');await root.end();if(directory){spawnSync(path.join(bin,'pg_ctl'),['-D',directory+'/data','-m','immediate','-w','stop']);fs.rmSync(directory,{recursive:true,force:true})}}
 try{
  await root.query("SELECT pg_advisory_lock(hashtextextended('stage2a-test-role-setup',0))")
  try{for(const role of [...owners,...roles]){if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)await root.query('CREATE ROLE '+role+' '+(owners.includes(role)?'NOLOGIN':"LOGIN PASSWORD '"+fixturePassword+"'")+' NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION')}}finally{await root.query("SELECT pg_advisory_unlock(hashtextextended('stage2a-test-role-setup',0))")}
  const access=load('../../migrations/access/001-internal-access.sql'),schemaDigest=createHash('sha256').update(access).digest('hex')
  const apps=['identity-runtime-development','profitia-source-hub-development','profitia-newsfeed-api-development']
  const bindings=apps.map((applicationId,i)=>({applicationId,environment:'development',projectId:'fixture-project-'+i,branchId:'fixture-branch-'+i,databaseName:names[i],role:roles[i],schemaDigest}))
  for(let i=0;i<3;i++){
   await root.query('CREATE DATABASE '+names[i]);const c=new pg.Client({...configuration,connectionString:undefined,database:names[i],...(configured?{host:new URL(configured).hostname,port:Number(new URL(configured).port||5432),user:decodeURIComponent(new URL(configured).username),password:decodeURIComponent(new URL(configured).password)}:{})});await c.connect();databases.push(c)
   await c.query('CREATE EXTENSION pgcrypto');for(const owner of owners)await c.query('GRANT CREATE ON DATABASE '+names[i]+' TO '+owner)
   await c.query('SET ROLE profitia_access_owner');await c.query('BEGIN');await c.query(access)
   await c.query("INSERT INTO profitia_access.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development',$2,$3,$4)",[schemaDigest,bindings[i].projectId,bindings[i].branchId,names[i]])
   await c.query("INSERT INTO profitia_access.applications(application_id,status) VALUES($1,'ACTIVE')",[apps[i]])
   await c.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES($1,$2,'ACTIVE')",[roles[i],apps[i]])
   await c.query('GRANT USAGE ON SCHEMA profitia_access TO '+roles[i]);await c.query('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA profitia_access TO '+roles[i])
   await c.query(load('../../current-e1-authority/migrations/'+(i===0?'001-authority.sql':'002-receiver.sql')))
   await c.query('COMMIT');await c.query('RESET ROLE')
   const pool=new pg.Pool({...c.connectionParameters,user:roles[i],password:fixturePassword,max:5,connectionTimeoutMillis:3000,query_timeout:5000});pools.push(pool)
  }
  const issuer='https://synthetic.clerk.accounts.dev',origin='https://newsfeed.synthetic.test',authorityOrigin='https://identity.synthetic.test'
  const asOwner=async(i,action,owner='profitia_access_owner')=>{const c=databases[i];await c.query('BEGIN');try{await c.query('SET LOCAL ROLE '+owner);const r=await action(c);await c.query('COMMIT');return r}catch(error){await c.query('ROLLBACK');throw error}}
  await asOwner(0,async c=>{
   await c.query("INSERT INTO profitia_access.applications(application_id,status) VALUES('spendguru','ACTIVE')")
   for(const user of[U,V]){await c.query("INSERT INTO profitia_access.accounts(user_id,status) VALUES($1,'ACTIVE')",[user]);await c.query("INSERT INTO profitia_access.external_identities(binding_id,issuer,subject,user_id,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[randomUUID(),issuer,'user_'+user,user])}
   for(const org of[A,B]){await c.query("INSERT INTO profitia_access.organisations(organisation_id,status) VALUES($1,'ACTIVE')",[org]);for(const user of[U,V])await c.query("INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at) VALUES($1,$2,'ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[org,user])}
   for(const org of[A,B])await c.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES('spendguru',$1,'SPENDGURU',ARRAY['benchmark'],'ACTIVE','EXPLICIT_OFFER','SYNTHETIC_ONLY',now()+interval '1 hour')",[org])
   for(let i=1;i<3;i++){
    await c.query("INSERT INTO profitia_access.applications(application_id,status) VALUES($1,'ACTIVE')",[apps[i]])
    for(const org of[A,B]){await c.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES($1,$2,'SPENDGURU',ARRAY['personal_workspace'],'ACTIVE','EXPLICIT_OFFER','SYNTHETIC_ONLY',now()+interval '1 hour')",[apps[i],org]);for(const user of[U,V])for(const op of['personal.list.read','personal.list.write'])await c.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature,resource_id) VALUES($1,$2,$3,$4,'ALLOW',$5,'personal_workspace',$6)",[randomUUID(),apps[i],org,user,op,i===1?'source-hub-private':null])}
   }
  })
  for(let i=1;i<3;i++){
   const key=randomBytes(32),resource=i===1?'source-hub-private':'newsfeed-observations',keyId='fixture-key-'+i
   await asOwner(0,c=>c.query("INSERT INTO profitia_e1_authority.receivers VALUES($1,$2::jsonb,$3,$4,$5,$6,$7,'ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[apps[i],JSON.stringify(bindings[i]),issuer,[origin,'https://spendguru.synthetic.test'],resource,keyId,key]))
   await asOwner(i,async c=>{await c.query("INSERT INTO profitia_e1_receiver.installation VALUES(true,$1,$2::jsonb,$3,$4,$5,$6,'ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[roles[i],JSON.stringify(bindings[i]),authorityOrigin,resource,keyId,key]);await c.query('GRANT USAGE ON SCHEMA profitia_e1_receiver TO '+roles[i]+','+owners[i]);await c.query('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA profitia_e1_receiver TO '+roles[i])})
   const schema=i===1?'source_hub':'newsfeed',appPath=i===1?'platform-source-hub':'newsfeed-runtime'
   await asOwner(i,async c=>{
    const foundation=load('../../../../apps/'+appPath+'/migrations/001-foundation.sql')
    await c.query(foundation.replaceAll('__OWNER_ROLE__',owners[i]).replaceAll('__RUNTIME_ROLE_LITERAL__',"'"+roles[i]+"'").replaceAll('__RUNTIME_ROLE__',roles[i]))
    await c.query('INSERT INTO '+schema+".installation(schema_version,schema_digest,environment,application_id,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development',$2,$3,$4,$5)",[createHash('sha256').update(foundation).digest('hex'),apps[i],bindings[i].projectId,bindings[i].branchId,names[i]])
    await c.query(load('../../../../apps/'+appPath+'/migrations/'+(i===1?'003':'002')+'-current-e1-authority.sql').replaceAll('__RUNTIME_ROLE__',roles[i]))
   },owners[i])
  }
  const clerkState={sessionActive:true,banned:false,azp:origin,calls:[]}
  const client={async authenticateRequest(request){clerkState.calls.push('sdk');const user=request.headers.get('authorization')==='Bearer SYNTHETIC_B'?V:U;return {status:'signed-in',isAuthenticated:true,toAuth:()=>({isAuthenticated:true,tokenType:'session_token',userId:'user_'+user,sessionId:'session_'+user,sessionClaims:{iss:issuer,sub:'user_'+user,sid:'session_'+user,azp:clerkState.azp,exp:Math.floor(Date.now()/1000)+3600}})}},
   sessions:{async getSession(id){clerkState.calls.push('session');return {id,userId:id.replace('session_','user_'),status:clerkState.sessionActive?'active':'revoked',actor:null,expireAt:Date.now()+3600000,abandonAt:Date.now()+3600000}}},users:{async getUser(id){clerkState.calls.push('user');return {id,banned:clerkState.banned,locked:false,deprovisioned:false}}}}
  const centralQuery=(s,v)=>pools[0].query(s,v),authority=createCurrentE1Authority({query:centralQuery,client,binding:bindings[0]})
  const transportState={offline:false,afterInitial:null,lastProof:null,calls:0}
  const transport=async(url,options={})=>{if(!url.startsWith(authorityOrigin+'/v1/e1/'))throw Error('REAL_NETWORK_FORBIDDEN');if(transportState.offline)throw Error('SYNTHETIC_OUTAGE');if(url.endsWith('/ready'))return Response.json({ready:await authority.ready()});transportState.calls++;const input=JSON.parse(options.body);try{const proof=await authority.authorize(new Request(url,{method:'POST',headers:options.headers}),input);transportState.lastProof=proof;if(input.previous===null&&transportState.afterInitial)await transportState.afterInitial();return Response.json(proof)}catch{return Response.json({error:'SYNTHETIC_DENIAL'},{status:403})}}
  const db=i=>({query:(s,v)=>pools[i].query(s,v),verifyLogin:async()=>true,transact:async(action)=>{const c=await pools[i].connect();try{await c.query('BEGIN');const value=await action({query:(s,v)=>c.query(s,v),transaction:{query:(s,v)=>c.query(s,v)}});await c.query('COMMIT');return value}catch(error){await c.query('ROLLBACK');throw error}finally{c.release()}}})
  const application=i=>({appId:apps[i],profileId:'SPENDGURU_SAAS',deploymentId:'SYNTHETIC_ONLY',configurationVersion:'fixture-v1',environment:'development',identityIssuer:issuer,organisationId:null,features:['personal_workspace'],operations:['personal.list.read','personal.list.write']})
  return {close,asOwner,databases,pools,bindings,apps,db,application,issuer,origin,authorityOrigin,client,clerkState,authority,transport,transportState,request:(token='SYNTHETIC_A')=>new Request(origin+'/v1/observations',{headers:{authorization:'Bearer '+token}})}
 }catch(error){await close();throw error}
}
