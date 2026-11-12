import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {randomUUID,randomBytes,createHash} from 'node:crypto'
import fs from 'node:fs'
import pg from 'pg'
import {createPeerOperationSigner} from '../../../packages/platform-contracts/src/peer-operation.mjs'
import {profileSchemaDigest} from '../../../packages/platform-contracts/src/user-profile.mjs'
import {limitsSql,seedSql,identitySql} from '../scripts/install.mjs'
import {workspaceAccessSql,workspaceIdentitySql,workspaceAccessDigest} from '../scripts/install-workspace-access.mjs'
import {identityBoundary} from '../dist/auth.js'
import {Store} from '../dist/store.js'
import {createWorkspaceAccess} from '../dist/workspace-access.js'


async function postgresFixture(){
 let directory=null,container=null,config
 const bin=process.env.B1_PG_BIN??'/usr/lib/postgresql/16/bin'
 if(fs.existsSync(path.join(bin,'initdb'))){
  directory=fs.mkdtempSync(path.join(os.tmpdir(),'workspace-limits-pg-'))
  const run=(name,args)=>{const r=spawnSync(path.join(bin,name),args,{encoding:'utf8'});if(r.status!==0)throw Error('Isolated PostgreSQL fixture failed: '+name)}
  run('initdb',['-D',directory+'/data','-U','workspace_fixture_owner','-A','trust','--no-locale','-E','UTF8'])
  run('pg_ctl',['-D',directory+'/data','-l',directory+'/server.log','-o',"-c listen_addresses='' -k "+directory,'-w','start'])
  config={host:directory,user:'workspace_fixture_owner',database:'postgres'}
 }else{
  const r=spawnSync('docker',['run','--detach','--rm','--publish','127.0.0.1::5432','--env','POSTGRES_USER=workspace_fixture_owner','--env','POSTGRES_DB=postgres','--env','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16'],{encoding:'utf8'})
  container=r.stdout?.trim();if(r.status!==0||!/^[a-f0-9]{64}$/.test(container??''))throw Error('Isolated PostgreSQL required; no test skipping')
  const port=spawnSync('docker',['port',container,'5432/tcp'],{encoding:'utf8'}).stdout?.trim()
  if(!/^127\.0\.0\.1:[0-9]+$/.test(port??''))throw Error('Isolated loopback PostgreSQL required')
  let ready=false
  for(let i=0;i<60;i++){if(spawnSync('docker',['exec',container,'pg_isready','-h','127.0.0.1','-U','workspace_fixture_owner','-d','postgres'],{stdio:'ignore'}).status===0){ready=true;break}await new Promise(r=>setTimeout(r,500))}
  if(!ready)throw Error('Isolated PostgreSQL startup deadline exceeded')
  config={host:'127.0.0.1',port:Number(port.split(':')[1]),user:'workspace_fixture_owner',database:'postgres'}
 }
 return {config,binding:{schemaDigest:createHash('sha256').update(fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/access/001-internal-access.sql',import.meta.url))).digest('hex')},
  async close(){if(directory){spawnSync(path.join(bin,'pg_ctl'),['-D',directory+'/data','-m','immediate','-w','stop']);fs.rmSync(directory,{recursive:true,force:true})}if(container)spawnSync('docker',['rm','--force',container],{stdio:'ignore'})}}
}

test('genuine two-database commercial activation keeps operator assignments and current verified membership separate',{timeout:60000},async t=>{
 const db=await postgresFixture();t.after(()=>db.close())
 const control=new pg.Client({...db.config,database:'postgres'});await control.connect();t.after(()=>control.end())
 await control.query('CREATE DATABASE neondb');await control.query('CREATE DATABASE platform_private')
 await control.query('CREATE ROLE profitia_access_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE')
 await control.query('CREATE ROLE profitia_limits_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE')
 await control.query('CREATE ROLE profitia_limits_runtime LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE')
 await control.query('CREATE ROLE profitia_limits_identity_reader LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE')
 await control.query('GRANT CREATE ON DATABASE neondb TO profitia_limits_owner');await control.query('GRANT CREATE ON DATABASE platform_private TO profitia_access_owner')
 const limitsAdmin=new pg.Client({...db.config,database:'neondb'}),privateAdmin=new pg.Client({...db.config,database:'platform_private'})
 await limitsAdmin.connect();await privateAdmin.connect();t.after(()=>Promise.all([limitsAdmin.end(),privateAdmin.end()]))
 await limitsAdmin.query('CREATE EXTENSION pgcrypto');await privateAdmin.query('CREATE EXTENSION pgcrypto')
 const key=randomBytes(32),uid=randomUUID(),oid=randomUUID(),elsewhere=randomUUID(),issuer='https://unified-drum-7191.clerk.accounts.dev'
 await limitsAdmin.query('BEGIN;SET LOCAL ROLE profitia_limits_owner');await limitsAdmin.query(limitsSql);await limitsAdmin.query(seedSql);await limitsAdmin.query(workspaceAccessSql)
 await limitsAdmin.query('INSERT INTO profitia_limits.workspace_access_installation(singleton,schema_digest,command_key,source_ref) VALUES(true,$1,$2,$3)',[workspaceAccessDigest,key,'synthetic-stage-i-bridge'])
 await limitsAdmin.query("INSERT INTO profitia_limits.operator_grants(user_id,enabled,source_ref)VALUES($1,true,'synthetic-operator')",[uid]);await limitsAdmin.query('COMMIT')
 const operatorKey=(await limitsAdmin.query('SELECT command_key FROM profitia_limits.installation')).rows[0].command_key
 await privateAdmin.query('BEGIN;SET LOCAL ROLE profitia_access_owner')
 const load=name=>fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/'+name,import.meta.url),'utf8')
 await privateAdmin.query(load('access/001-internal-access.sql'))
 await privateAdmin.query("INSERT INTO profitia_access.installation(singleton,schema_version,schema_digest,environment,project_id,branch_id,database_name)VALUES(true,'1.0.0',$1,'development','spring-bread-28217539','br-sparkling-term-b99l107x',current_database())",[db.binding.schemaDigest])
 for(const name of ['001-user-profile.sql','007-organisation-onboarding.sql','008-organisation-create.sql','009-organisation-lifecycle.sql'])await privateAdmin.query(load('profile/'+name))
 await privateAdmin.query("INSERT INTO profitia_profile.installation VALUES(true,'1.0.0',$1)",[profileSchemaDigest()])
 await privateAdmin.query('CREATE SCHEMA profitia_limits_identity_read AUTHORIZATION profitia_access_owner')
 await privateAdmin.query(identitySql);await privateAdmin.query(workspaceIdentitySql);await privateAdmin.query('COMMIT')
 await privateAdmin.query('SET ROLE profitia_access_owner')
 await privateAdmin.query("INSERT INTO profitia_access.accounts(user_id,status) VALUES($1,'ACTIVE')",[uid])
 await privateAdmin.query("INSERT INTO profitia_access.external_identities(binding_id,issuer,subject,user_id,status,source_ref,expires_at)VALUES($1,$2,'user_workspace',$3,'ACTIVE','synthetic-current-binding',clock_timestamp()+interval '1 hour')",[randomUUID(),issuer,uid])
 await privateAdmin.query("INSERT INTO profitia_access.applications VALUES('spendguru','ACTIVE',NULL)")
 for(const id of [oid,elsewhere])await privateAdmin.query("INSERT INTO profitia_access.organisations(organisation_id,status)VALUES($1,'ACTIVE')",[id])
 await privateAdmin.query("INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at)VALUES($1,$2,'ACTIVE','synthetic-member',clock_timestamp()+interval '1 day')",[oid,uid])
 await privateAdmin.query("INSERT INTO profitia_profile.organisation_profiles(organisation_id,country,nip,slug,company,registry_ref,registry_version,industry,team_range,created_by)VALUES($1,'PL','1234563218','synthetic-workspace','{}','synthetic-basic','1','{}','{}',$2)",[oid,uid])
 await privateAdmin.query("INSERT INTO profitia_profile.organisation_user_context VALUES($1,$2)",[uid,oid])
 const limits=new pg.Pool({...db.config,database:'neondb',user:'profitia_limits_runtime',max:2}),identity=new pg.Pool({...db.config,database:'platform_private',user:'profitia_limits_identity_reader',max:2})
 t.after(()=>Promise.all([limits.end(),identity.end()]))
 const peer={environment:'development',callerApplicationId:'identity-runtime-development',receiverApplicationId:'package-limits-development',
  sourceOrigin:'https://identity.example.test',targetOrigin:'https://limits-development.onrender.com',keyId:'registration-limits-v1',key:randomBytes(32),
  routes:[{method:'GET',path:'/v1/organisation-access',maximumRequestBytes:0,requireIdempotencyKey:false}],internalOrigins:[]}
 let active=true
 const client={authenticateRequest:async()=>({status:'signed-in',isAuthenticated:true,toAuth:()=>({isAuthenticated:true,tokenType:'session_token',userId:'user_workspace',sessionId:'sess_workspace',actor:null,
  sessionClaims:{iss:issuer,sub:'user_workspace',sid:'sess_workspace',azp:peer.sourceOrigin,exp:Math.floor(Date.now()/1000)+60}})}),
  sessions:{getSession:async()=>({id:'sess_workspace',userId:'user_workspace',status:active?'active':'revoked',expireAt:Date.now()+60000,abandonAt:Date.now()+60000,actor:null})},
  users:{getUser:async()=>({id:'user_workspace',banned:false,locked:false,deprovisioned:false})}}
 const config={origin:peer.targetOrigin,issuer,workspace:{peer,commandKey:key}}
 const withIdentity=identityBoundary(config,identity,client),surface=createWorkspaceAccess({configuration:config.workspace,limits,identity,withIdentity})
 const request=()=>createPeerOperationSigner(peer)(new Request(peer.targetOrigin+'/v1/organisation-access',{headers:{authorization:'Bearer synthetic-official-sdk-fixture'}}))
 const who=()=>({kind:'HUMAN',actorId:uid,userId:uid,expiresAt:new Date(Date.now()+60000).toISOString()})
 const store=new Store(limits,operatorKey),write=(operation,data)=>store.transact(who(),session=>session.call(operation,{requestId:randomUUID(),data}))
 await assert.rejects(surface.ready());await limitsAdmin.query('UPDATE profitia_limits.workspace_access_installation SET enabled=true');await surface.ready()
 assert.equal((await surface.read(await request())).status,'PENDING_PACKAGE')
 const pkg=await write('package.create',{productId:'SPENDGURU',name:'Synthetic full package'})
 const initial=(await store.transact(who(),s=>s.call('list',{}))).packages.find(p=>p.id===pkg.package_id).versions[0]
 assert(initial)
 await write('draft.save',{versionId:initial.id,revision:initial.revision,snapshot:{name:'Synthetic full package',capabilities:['SEATS'],limits:[],price:null,currency:null}})
 const changed=(await store.transact(who(),s=>s.call('list',{}))).packages.find(p=>p.id===pkg.package_id).versions.find(v=>v.id===initial.id)
 await write('version.publish',{versionId:initial.id,revision:changed.revision})
 const today=new Date().toISOString().slice(0,10),end='2090-01-01'
 const terms={contractStart:today,contractEnd:end,assignmentStart:today,assignmentEnd:end,usageStart:today,usageCycle:'MONTH',usageAnchor:'CALENDAR',billingStart:today,billingEnd:end,invoiceDate:today,dueDate:today,timezone:'Europe/Warsaw',basis:'DEVELOPMENT_TEST',reference:'SYNTHETIC_ONLY',purchaseType:'MANUAL_SUBSCRIPTION'}
 const assignment=await write('assignment.create',{organisationId:oid,organisationVersion:1,packageVersionId:initial.id,effectiveFrom:today,terms,overrides:[],reason:'Synthetic operator assignment'})
 assert.equal((await surface.read(await request())).status,'PENDING_PACKAGE') // A commercial package alone cannot fake E1 projection.
 await privateAdmin.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at)VALUES('spendguru',$1,'SPENDGURU',ARRAY['category'],'ACTIVE','EXPLICIT_OFFER',$2,clock_timestamp()+interval '1 hour')",[oid,'package-assignment:'+assignment.id+':1'])
 assert.equal((await surface.read(await request())).status,'READY')
 assert.equal((await identity.query('SELECT profitia_limits_identity_read.workspace_context($1) AS data',[uid])).rows[0].data.organisationId,oid)
 await privateAdmin.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2",[oid,uid])
 await assert.rejects(surface.read(await request()))
 await privateAdmin.query("UPDATE profitia_access.memberships SET status='ACTIVE' WHERE organisation_id=$1 AND user_id=$2",[oid,uid])
 active=false;await assert.rejects(surface.read(await request()));active=true
 await write('assignment.status',{assignmentId:assignment.id,revision:assignment.revision,status:'SUSPENDED',effectiveFrom:today,reason:'Synthetic suspension'})
 assert.equal((await surface.read(await request())).status,'PENDING_PACKAGE')
 await assert.rejects(limits.query('SELECT * FROM profitia_limits.assignments'));await assert.rejects(identity.query('SELECT * FROM profitia_access.memberships'))
 await assert.rejects(limits.query("SELECT profitia_limits.workspace_access($1,$2,'spendguru',1,'forged','','forged')",[uid,elsewhere]))
 assert.equal((await privateAdmin.query("SELECT count(*) FROM profitia_access.product_grants WHERE organisation_id=$1",[elsewhere])).rows[0].count,'0')
})
