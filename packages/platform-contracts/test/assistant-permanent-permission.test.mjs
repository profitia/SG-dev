import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash,randomUUID} from 'node:crypto'
import pg from '../../../apps/architecture-lab/node_modules/pg/lib/index.js'
import {execFileSync} from 'node:child_process'
import {assertIsolatedTestConnection} from '../../../apps/architecture-lab/src/operation-postgres-fixture.mjs'
import {createClerkIdentityAuthenticator} from '../src/identity-provider.mjs'
import {createAssistantOperationHost} from '../src/assistant-operation-host.mjs'
import {OPERATION_CONTRACT} from '../src/operation-context.mjs'
const U='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',V='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222'
const role='sg2_private_development_runtime',ownerRole='profitia_access_owner',password='SYNTHETIC_ONLY_NOT_A_REAL_CREDENTIAL'
const load=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8'),hash=s=>createHash('sha256').update(s).digest('hex')
test('Permanent converse rechecks native E1, preserves limits and history, and audits the exact existing-row decision',async()=>{
 // This suite installs SQL033. It must not race with the unchanged SQL030
 // suite: both guards deliberately require a database named platform_private.
 // Use an independent synthetic server, never another project/Development DB.
 let container=null,url=process.env.ASSISTANT_PERMANENT_FIXTURE_OWNER_URL
 if(url&&url===process.env.OPERATION_FIXTURE_OWNER_URL)throw Error('Independent permanent-access test server required')
 if(!url){
  container=execFileSync('docker',['run','--rm','--detach','--publish','127.0.0.1::5432',
   '--env','POSTGRES_USER=architecture_test_owner','--env','POSTGRES_PASSWORD=SYNTHETIC_ONLY',
   '--env','POSTGRES_DB=sg2_operation_test','postgres:16'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim()
  try{
   if(!/^[a-f0-9]{64}$/.test(container))throw Error('Synthetic fixture container identity required')
   const address=execFileSync('docker',['port',container,'5432/tcp'],{encoding:'utf8'}).trim()
   if(!/^127\.0\.0\.1:[0-9]+$/.test(address))throw Error('Loopback fixture required')
   url='postgresql://architecture_test_owner:SYNTHETIC_ONLY@'+address+'/sg2_operation_test'
   let ready=false
   for(let attempt=0;attempt<60;attempt++){
    const probe=new pg.Client({connectionString:url,connectionTimeoutMillis:500})
    try{await probe.connect();ready=true;break}catch{await new Promise(resolve=>setTimeout(resolve,250))}finally{await probe.end().catch(()=>{})}
   }
   if(!ready)throw Error('Independent PostgreSQL fixture unavailable')
  }catch(error){execFileSync('docker',['stop',container],{stdio:'ignore'});throw error}
 }
 url=assertIsolatedTestConnection(url,'sg2_operation_test','architecture_test_owner')
 const admin=new pg.Client({connectionString:url});let database,pool,created=false
 try{
  await admin.connect()
  assert.equal((await admin.query("SELECT 1 FROM pg_database WHERE datname='platform_private'")).rowCount,0,'isolated fixture must not adopt an existing database')
  await admin.query("SELECT pg_advisory_lock(hashtextextended('stage2a-test-role-setup',0))")
  try{for(const r of [ownerRole,role])if(!(await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[r])).rowCount)
   await admin.query('CREATE ROLE '+r+' '+(r===ownerRole?'NOLOGIN':"LOGIN PASSWORD '"+password+"'")+' NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE')
  }finally{await admin.query("SELECT pg_advisory_unlock(hashtextextended('stage2a-test-role-setup',0))")}
  await admin.query('CREATE DATABASE platform_private');created=true
  const dbUrl=new URL(url);dbUrl.pathname='/platform_private'
  database=new pg.Client({connectionString:dbUrl.href});await database.connect()
  await database.query('CREATE EXTENSION pgcrypto');await database.query('GRANT CREATE ON DATABASE platform_private TO '+ownerRole)
  const base=load('../migrations/access/001-internal-access.sql'),source=load('../migrations/access/030-assistant-operations.sql'),schemaDigest=hash(base),assistantSchemaDigest=hash(source)
  const asOwner=async action=>{await database.query('BEGIN');try{await database.query('SET LOCAL ROLE '+ownerRole);const v=await action(database);await database.query('COMMIT');return v}catch(e){await database.query('ROLLBACK');throw e}}
  await asOwner(async c=>{
   await c.query(base)
   await c.query("INSERT INTO profitia_access.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','spring-bread-28217539','br-sparkling-term-b99l107x','platform_private')",[schemaDigest])
   await c.query("INSERT INTO profitia_access.applications(application_id,status) VALUES('spendguru','ACTIVE')")
   await c.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES($1,'spendguru','ACTIVE')",[role])
   await c.query('GRANT USAGE ON SCHEMA profitia_access TO '+role);await c.query('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA profitia_access TO '+role)
   await c.query(source.replaceAll('__ASSISTANT_ACCESS_SCHEMA_DIGEST__',assistantSchemaDigest))
   await c.query('INSERT INTO profitia_assistant_access.installation VALUES(true,$1,$2)',[assistantSchemaDigest,'SYNTHETIC_ONLY'])
   const extension=load('../migrations/access/033-assistant-permanent-permission.sql')
   await c.query(extension.replaceAll('__ASSISTANT_ACCESS_SCHEMA_DIGEST__',assistantSchemaDigest).replaceAll('__ASSISTANT_PERMANENT_SCHEMA_DIGEST__',hash(extension)))
   for(const u of [U,V]){
    await c.query("INSERT INTO profitia_access.accounts(user_id,status) VALUES($1,'ACTIVE')",[u])
    await c.query("INSERT INTO profitia_access.external_identities(binding_id,issuer,subject,user_id,status,source_ref,expires_at) VALUES($1,'https://synthetic.clerk.accounts.dev',$2,$3,'ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[randomUUID(),'user_'+u,u])
   }
   for(const org of [A,B]){
    await c.query("INSERT INTO profitia_access.organisations(organisation_id,status) VALUES($1,'ACTIVE')",[org])
    for(const u of [U,V])await c.query("INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at) VALUES($1,$2,'ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')",[org,u])
    await c.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES('spendguru',$1,'SPENDGURU',ARRAY['market'],'ACTIVE','EXPLICIT_OFFER','SYNTHETIC_ONLY',now()+interval '1 hour')",[org])
   }
   await c.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature,resource_id) VALUES($1,'spendguru',$2,$3,'ALLOW','assistant.converse','assistant',NULL)",[randomUUID(),A,U])
   await c.query("INSERT INTO profitia_assistant_access.pilot(singleton,user_id,organisation_id,limits_policy_id,limits_assignment_id,limits_assignment_revision,enabled,converse_until,history_until,source_ref) VALUES(true,$1,$2,$3,$4,1,true,now()+interval '7 days',now()+interval '37 days','SYNTHETIC_ONLY')",[U,A,randomUUID(),randomUUID()])
  })
  const functions=await asOwner(c=>c.query("SELECT p.proname,p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='profitia_assistant_access' ORDER BY p.proname"));
  assert.equal(functions.rows.length,4);
  for(const row of functions.rows)assert.equal(row.proconfig.find(x=>x.startsWith('search_path=')).split(',').at(-1).trim(),'pg_temp','effective native search path '+row.proname);
  dbUrl.username=role;dbUrl.password=password
  pool=new pg.Pool({connectionString:dbUrl.href,max:5,connectionTimeoutMillis:3000})
  const state={sessionActive:true,banned:false}
  const client={async authenticateRequest(request){const user=request.headers.get('authorization')==='Bearer SYNTHETIC_B'?V:U;return {status:'signed-in',isAuthenticated:true,toAuth:()=>({isAuthenticated:true,tokenType:'session_token',userId:'user_'+user,sessionId:'session_'+user,sessionClaims:{iss:'https://synthetic.clerk.accounts.dev',sub:'user_'+user,sid:'session_'+user,azp:'https://sg2.synthetic.test',exp:Math.floor(Date.now()/1000)+3600}})}},
   sessions:{async getSession(id){return {id,userId:id.replace('session_','user_'),status:state.sessionActive?'active':'revoked',actor:null,expireAt:Date.now()+3600000,abandonAt:Date.now()+3600000}}},users:{async getUser(id){return {id,banned:state.banned,locked:false,deprovisioned:false}}}}
  const application={appId:'spendguru',profileId:'PORR_SUITE',environment:'development',identityIssuer:'https://synthetic.clerk.accounts.dev',organisationId:A,features:['assistant'],operations:['assistant.converse','assistant.history.read','assistant.history.write'],deploymentId:'SYNTHETIC_ONLY',configurationVersion:'assistant-fixture'}
  const binding={applicationId:'spendguru',environment:'development',projectId:'spring-bread-28217539',branchId:'br-sparkling-term-b99l107x',databaseName:'platform_private',role,schemaDigest}
  const identity={appId:'spendguru',environment:'development',issuer:application.identityIssuer,authorizedParties:['https://sg2.synthetic.test']}
  let reserves=0
  const host=createAssistantOperationHost({application,binding,assistantSchemaDigest,
   independentQuery:(s,v)=>pool.query(s,v),
   transact:async work=>{const c=await pool.connect();try{await c.query('BEGIN');const v=await work({query:(s,v)=>c.query(s,v),transaction:c});await c.query('COMMIT');return v}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}},
   createAuthenticator:({resolveBinding})=>createClerkIdentityAuthenticator({client,application:identity,resolveBinding}),
   readResources:async({actor,request,scope})=>({resource:{id:request.resourceId,type:request.operation==='assistant.converse'?'assistant_turn':'assistant_history',dataClass:request.operation==='assistant.converse'?'OPERATION_AUDIT':'ACCOUNT_PRIVATE',environment:'development',ownerOrganisationId:scope.organisationId,ownerUserId:actor.actorId,version:'1',projectionVersion:'assistant-v1'}}),
   projectOutput:async value=>value,usage:{reserve:async()=>{reserves++;throw Error('Unexpected paid admission')},release:async()=>{},pending:async()=>{}},
  })
  const execute=(operation='assistant.converse',organisationId=A,token='SYNTHETIC_A')=>host.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation,organisationId,resourceId:operation==='assistant.converse'?'assistant-turn':'assistant-history',payload:operation==='assistant.converse'?{kind:'AUTHORIZE'}:{},request:new Request('https://sg2.synthetic.test/api/assistant',{headers:{authorization:'Bearer '+token}})},async c=>({userId:c.actorId,organisationId:c.organisationId}))
  const snapshot=async()=> (await asOwner(c=>c.query('SELECT user_id,organisation_id,converse_until,history_until,limits_policy_id,limits_assignment_id,limits_assignment_revision,source_ref FROM profitia_assistant_access.pilot'))).rows[0]
  const original=await snapshot()
  assert.equal((await execute()).value.userId,U);assert.equal(reserves,0)
  // Recreate a genuinely expired pilot without moving the database clock.
  await asOwner(c=>c.query("UPDATE profitia_assistant_access.pilot SET created_at=now()-interval '8 days',converse_until=now()-interval '1 day',history_until=now()+interval '29 days'"))
  const expired=await snapshot()
  await assert.rejects(()=>execute())
  await asOwner(c=>c.query("UPDATE profitia_assistant_access.pilot SET converse_access_mode='PERMANENT',converse_decision_ref='SYNTHETIC_OWNER_DECISION',version=version+1"))
  // A candidate SQL file alone does not install its reviewed policy digest.
  await assert.rejects(()=>execute())
  const extension=load('../migrations/access/033-assistant-permanent-permission.sql')
  await asOwner(c=>c.query("INSERT INTO profitia_assistant_access.converse_policy_installation VALUES(true,$1,'SYNTHETIC_POLICY_INSTALLATION')",[hash(extension)]))
  assert.equal((await execute()).value.userId,U)
  assert.deepEqual(await snapshot(),expired,'activation preserves all old deadlines, identity, history and limits references')
  assert.equal(original.limits_assignment_id,expired.limits_assignment_id)
  const audit=(await asOwner(c=>c.query('SELECT * FROM profitia_assistant_access.converse_policy_events'))).rows
  assert.equal(audit.length,1);assert.equal(audit[0].previous_mode,'PILOT');assert.equal(audit[0].new_mode,'PERMANENT')
  assert.equal(audit[0].decision_ref,'SYNTHETIC_OWNER_DECISION');assert.equal(audit[0].new_version,'2')
  await assert.rejects(()=>asOwner(c=>c.query("UPDATE profitia_assistant_access.pilot SET converse_decision_ref='UNVERSIONED_CHANGE'")))
  await assert.rejects(()=>asOwner(c=>c.query("DELETE FROM profitia_assistant_access.converse_policy_events")))
  await assert.rejects(()=>pool.query("UPDATE profitia_assistant_access.pilot SET converse_access_mode='PERMANENT'"),e=>e.code==='42501')
  assert.equal((await execute('assistant.history.read',null)).value.userId,U)
  await assert.rejects(()=>execute('assistant.history.read',null,'SYNTHETIC_B'))
  await assert.rejects(()=>execute('assistant.converse',B))
  await asOwner(c=>c.query("UPDATE profitia_access.permission_grants SET effect='DENY' WHERE user_id=$1 AND organisation_id=$2",[U,A]))
  await assert.rejects(()=>execute())
  await asOwner(c=>c.query("DELETE FROM profitia_access.permission_grants WHERE user_id=$1 AND organisation_id=$2",[U,A]))
  await assert.rejects(()=>execute(),'permanent mode cannot mint the missing ordinary permission')
  await asOwner(c=>c.query("INSERT INTO profitia_access.permission_grants VALUES($1,'spendguru',$2,$3,'ALLOW','assistant.converse','assistant',NULL)",[randomUUID(),A,U]))
  assert.equal((await execute()).value.userId,U)
  await asOwner(c=>c.query("UPDATE profitia_access.product_grants SET status='REVOKED' WHERE organisation_id=$1",[A]))
  await assert.rejects(()=>execute())
  await asOwner(c=>c.query("UPDATE profitia_access.product_grants SET status='ACTIVE' WHERE organisation_id=$1",[A]))
  await asOwner(c=>c.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE user_id=$1 AND organisation_id=$2",[U,A]))
  await assert.rejects(()=>execute());assert.equal((await execute('assistant.history.read',null)).value.userId,U)
  await asOwner(c=>c.query("UPDATE profitia_access.memberships SET status='ACTIVE' WHERE user_id=$1 AND organisation_id=$2",[U,A]))
  state.sessionActive=false;await assert.rejects(()=>execute());state.sessionActive=true
  await asOwner(c=>c.query('UPDATE profitia_assistant_access.pilot SET enabled=false'))
  await assert.rejects(()=>execute());await assert.rejects(()=>execute('assistant.history.read',null))
  await asOwner(c=>c.query('UPDATE profitia_assistant_access.pilot SET enabled=true'))
  await asOwner(c=>c.query("UPDATE profitia_assistant_access.pilot SET converse_access_mode='PILOT',converse_decision_ref='SYNTHETIC_ROLLBACK_DECISION',version=version+1"))
  await assert.rejects(()=>execute(),'rollback restores the actual expired pilot rather than renewing it')
  assert.equal(reserves,0,'AUTHORIZE checks never invoke a model or reserve a paid execution')
 }finally{
  try{await pool?.end();await database?.end();if(created)await admin.query('DROP DATABASE platform_private WITH (FORCE)')}finally{await admin.end().catch(()=>{});if(container)execFileSync('docker',['stop',container],{stdio:'ignore'})}
 }
})
