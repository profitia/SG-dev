import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash,randomUUID} from 'node:crypto'
import pg from '../../../apps/architecture-lab/node_modules/pg/lib/index.js'
import {assertIsolatedTestConnection} from '../../../apps/architecture-lab/src/operation-postgres-fixture.mjs'
import {createClerkIdentityAuthenticator} from '../src/identity-provider.mjs'
import {createAssistantOperationHost} from '../src/assistant-operation-host.mjs'
import {OPERATION_CONTRACT} from '../src/operation-context.mjs'
const U='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',V='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222'
const role='sg2_private_development_runtime',ownerRole='profitia_access_owner',password='SYNTHETIC_ONLY_NOT_A_REAL_CREDENTIAL'
const load=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8'),hash=s=>createHash('sha256').update(s).digest('hex')
test('Assistant host uses current native E1 account, membership, pilot and SQL leases without cross-user history or paid AUTHORIZE',async()=>{
 const url=assertIsolatedTestConnection(process.env.OPERATION_FIXTURE_OWNER_URL,'sg2_operation_test','architecture_test_owner')
 const admin=new pg.Client({connectionString:url});await admin.connect()
 let database,pool,created=false
 try{
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
  assert.equal((await execute()).value.userId,U);assert.equal(reserves,0)
  assert.equal((await execute('assistant.history.read',null)).value.userId,U)
  await assert.rejects(()=>execute('assistant.history.read',null,'SYNTHETIC_B'))
  await assert.rejects(()=>execute('assistant.converse',B))
  await assert.rejects(()=>pool.query('SELECT * FROM profitia_assistant_access.pilot'),e=>e.code==='42501')
  await assert.rejects(()=>pool.query('SELECT profitia_assistant_access.current_pilot($1,NULL,$2)',[U,assistantSchemaDigest]),e=>e.code==='42501')
  await asOwner(c=>c.query('UPDATE profitia_assistant_access.pilot SET enabled=false'))
  await assert.rejects(()=>execute());await assert.rejects(()=>execute('assistant.history.read',null))
  await asOwner(c=>c.query('UPDATE profitia_assistant_access.pilot SET enabled=true'))
  state.sessionActive=false;await assert.rejects(()=>execute());state.sessionActive=true
  await asOwner(c=>c.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE user_id=$1 AND organisation_id=$2",[U,A]))
  await assert.rejects(()=>execute());assert.equal((await execute('assistant.history.read',null)).value.userId,U)
  state.banned=true;await assert.rejects(()=>execute('assistant.history.read',null));assert.equal(reserves,0)
 }finally{
  await pool?.end();await database?.end();if(created)await admin.query('DROP DATABASE platform_private WITH (FORCE)');await admin.end()
 }
})
