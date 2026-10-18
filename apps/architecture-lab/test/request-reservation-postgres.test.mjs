// Creates a fresh uniquely named database; never adopts/resets the root database.
// Local execution uses a new disposable PostgreSQL cluster, not shared fixtures.
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {createHash,randomUUID} from 'node:crypto'
import pg from 'pg'
import {assertIsolatedTestConnection} from '../src/operation-postgres-fixture.mjs'
import {createPrivateOperationHost} from '../../../packages/platform-contracts/src/private-operation-host.mjs'
import {OPERATION_CONTRACT,isOperationDenied} from '../../../packages/platform-contracts/src/operation-context.mjs'
const DATABASE='request_reservation_'+randomUUID().replaceAll('-',''),ROLE='platform_request_reservation_runtime',APP='request-fixture'
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222'
const U='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',V='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ISSUER='https://identity.fixture.test',hash=v=>createHash('sha256').update(v).digest('hex')
const sources=['001-internal-access.sql','002-module-scope.sql','003-module-audit.sql','006-request-reservation.sql'].map(name=>fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/access/'+name,import.meta.url),'utf8'))
const digests=sources.map(hash),expires=()=>new Date(Date.now()+3600000).toISOString()

test('fresh private request database proves ordinary SQL authority, quota, idempotency and atomic audit',async t=>{
 const url=assertIsolatedTestConnection(process.env.OPERATION_FIXTURE_OWNER_URL,'sg2_operation_test','architecture_test_owner')
 const root=new pg.Client({connectionString:url});await root.connect()
 let owner,pool,auditPool;const previousFetch=globalThis.fetch
 globalThis.fetch=async()=>{throw Error('No external work is permitted by request acceptance')}
 try{
  assert.match(DATABASE,/^request_reservation_[a-f0-9]{32}$/)
  assert.equal((await root.query('SELECT 1 FROM pg_database WHERE datname=$1',[DATABASE])).rowCount,0,'Never adopt an existing database')
  await root.query(`CREATE DATABASE ${DATABASE}`)
  // Use the existing shared fixture role-bootstrap lock; test files run concurrently.
  await root.query("BEGIN;SET LOCAL lock_timeout='5s';SELECT pg_advisory_xact_lock(170001,20261017)")
  for(const[role,login]of[['profitia_access_owner',false],[ROLE,true]]){
   if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)await root.query(`CREATE ROLE ${role} ${login?"LOGIN PASSWORD 'isolated_ci_only'":'NOLOGIN'} NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`)
   const row=(await root.query('SELECT rolcanlogin,rolsuper,rolbypassrls,rolinherit,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=$1',[role])).rows[0]
   assert.deepEqual(row,{rolcanlogin:login,rolsuper:false,rolbypassrls:false,rolinherit:false,rolcreatedb:false,rolcreaterole:false})
  }
  await root.query(`ALTER ROLE ${ROLE} CONNECTION LIMIT 4`)
  await root.query('COMMIT')
  const db=new URL(url);db.pathname='/'+DATABASE;assert.notEqual(db.pathname,new URL(url).pathname)
  owner=new pg.Client({connectionString:db.toString()});await owner.connect()
  await owner.query(`GRANT CREATE ON DATABASE ${DATABASE} TO profitia_access_owner;REVOKE CREATE ON DATABASE ${DATABASE} FROM PUBLIC;REVOKE CREATE ON SCHEMA public FROM PUBLIC`)
  const runtime=new URL(db);runtime.username=ROLE;runtime.password='isolated_ci_only'
  pool=new pg.Pool({connectionString:runtime.toString(),max:2});auditPool=new pg.Pool({connectionString:runtime.toString(),max:1})
  assert.deepEqual((await pool.query('SELECT current_user::text AS role,session_user::text AS login')).rows[0],{role:ROLE,login:ROLE})
  const queryFor=c=>async(sql,values=[])=>{const r=await c.query(sql,values);return{rows:r.rows}}
  const reset=async({capacity=2,expired=false}={})=>{
   assert.equal((await owner.query('SELECT current_database() AS db')).rows[0].db,DATABASE,'Reset only this run\'s new database')
   await owner.query('DROP SCHEMA IF EXISTS request_fixture CASCADE;DROP SCHEMA IF EXISTS profitia_requests CASCADE;DROP SCHEMA IF EXISTS profitia_modules CASCADE;DROP SCHEMA IF EXISTS profitia_access CASCADE')
   await owner.query('BEGIN;SET LOCAL ROLE profitia_access_owner')
   try{
    await owner.query(sources[0]);await owner.query("INSERT INTO profitia_access.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','isolated-request-project','isolated-request-branch',$2)",[digests[0],DATABASE])
    await owner.query(sources[1]);await owner.query("INSERT INTO profitia_modules.installation(schema_version,schema_digest) VALUES('1.0.0',$1)",[digests[1]])
    await owner.query(sources[2]);await owner.query("INSERT INTO profitia_modules.audit_installation(envelope_version,schema_digest,source_ref) VALUES('1.0.0',$1,'SYNTHETIC_ONLY')",[digests[2]])
    await owner.query(sources[3]);await owner.query("INSERT INTO profitia_requests.installation(schema_version,schema_digest,source_ref) VALUES('1.0.0',$1,'SYNTHETIC_NOT_RELEASE')",[digests[3]])
    await owner.query("INSERT INTO profitia_access.applications(application_id,status) VALUES($1,'ACTIVE')",[APP]);await owner.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES($1,$2,'ACTIVE')",[ROLE,APP])
    for(const user of[U,V]){
     await owner.query("INSERT INTO profitia_access.accounts(user_id,status) VALUES($1,'ACTIVE')",[user])
     await owner.query("INSERT INTO profitia_access.external_identities(binding_id,issuer,subject,user_id,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'ACTIVE','SYNTHETIC_ONLY',$5)",[randomUUID(),ISSUER,'external-'+user,user,expires()])
    }
    for(const org of[A,B]){
     await owner.query("INSERT INTO profitia_access.organisations(organisation_id,status) VALUES($1,'ACTIVE')",[org])
     await owner.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES($1,$2,'SPENDGURU',ARRAY['benchmark','forecast'],'ACTIVE','EXPLICIT_OFFER','SYNTHETIC_ONLY',$3)",[APP,org,expires()])
     for(const user of org===A?[U,V]:[U]){
      await owner.query("INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at) VALUES($1,$2,'ACTIVE','SYNTHETIC_ONLY',$3)",[org,user,expires()])
      await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,$2,$3,$4,'ALLOW','forecast.request','forecast')",[randomUUID(),APP,org,user])
     }
     await owner.query("INSERT INTO profitia_requests.policies(policy_id,application_id,organisation_id,operation,status,source_ref,window_start,window_end,expires_at,capacity) VALUES($1,$2,$3,'forecast.request','ACTIVE','EXPLICIT_SYNTHETIC_REQUEST_COUNT_NOT_BILLING',now()-interval '1 hour',now()+interval '2 hours',$4,$5)",[randomUUID(),APP,org,expired?new Date(Date.now()-1000).toISOString():expires(),capacity])
    }
    await owner.query("INSERT INTO profitia_modules.application_bindings(application_id,module_id,binding_id,status,source_ref,expires_at) VALUES($1,'benchmark',$2,'ACTIVE','SYNTHETIC_MODULE',$3)",[APP,randomUUID(),expires()])
    await owner.query(`CREATE SCHEMA request_fixture;CREATE TABLE request_fixture.commands(request_id uuid PRIMARY KEY REFERENCES profitia_requests.intents(request_id),organisation_id uuid NOT NULL,user_id uuid NOT NULL,payload_digest text NOT NULL);ALTER TABLE request_fixture.commands ENABLE ROW LEVEL SECURITY;ALTER TABLE request_fixture.commands FORCE ROW LEVEL SECURITY;CREATE POLICY controlled_owner ON request_fixture.commands TO profitia_access_owner USING(true) WITH CHECK(true)`)
    const fence=`profitia_access.scope_allows('${APP}',organisation_id,user_id) AND profitia_modules.scope_allows('benchmark',organisation_id,user_id)`
    await owner.query(`CREATE POLICY runtime_scope ON request_fixture.commands TO ${ROLE} USING(${fence}) WITH CHECK(${fence});CREATE POLICY runtime_fence ON request_fixture.commands AS RESTRICTIVE TO ${ROLE} USING(${fence}) WITH CHECK(${fence})`)
    await owner.query(`GRANT USAGE ON SCHEMA profitia_access,profitia_modules,profitia_requests,request_fixture TO ${ROLE};GRANT EXECUTE ON FUNCTION profitia_access.runtime_descriptor(),profitia_access.identity_binding(text,text),profitia_access.lock_access(uuid,uuid,text,text,text),profitia_access.scope_allows(text,uuid,uuid),profitia_access.append_audit(jsonb),profitia_modules.runtime_descriptor(),profitia_modules.bind_scope(text),profitia_modules.scope_allows(text,uuid,uuid),profitia_modules.audit_descriptor(),profitia_requests.runtime_descriptor(),profitia_requests.scope_allows(uuid,uuid,text),profitia_requests.policy(uuid,uuid,text),profitia_requests.reserve(uuid,uuid,text,text,text,text,uuid,uuid,bigint),profitia_requests.accept(uuid,uuid) TO ${ROLE};GRANT SELECT,INSERT ON request_fixture.commands TO ${ROLE}`)
    await owner.query('COMMIT')
   }catch(e){await owner.query('ROLLBACK');throw e}
  }
  function fixture({schemaDigest=digests[3],observeScopedSql}={}){
   let actions=0
   const application={appId:APP,profileId:'SPENDGURU_SAAS',deploymentId:'isolated-request',configurationVersion:'1',environment:'development',identityIssuer:ISSUER,organisationId:null,operations:['forecast.request'],features:['benchmark','forecast']}
   const transact=async(work,limits)=>{
    const c=await pool.connect();let timedOut=false
    const timer=setTimeout(()=>{timedOut=true;void c.end().catch(()=>{})},limits.timeoutMs)
    try{await c.query('BEGIN');const value=await work({query:queryFor(c),transaction:c});await c.query('COMMIT');return value}
    catch(e){try{await c.query('ROLLBACK')}catch{}throw e}
    finally{clearTimeout(timer);c.release(timedOut)}
   }
   const host=createPrivateOperationHost({application,binding:{applicationId:APP,environment:'development',projectId:'isolated-request-project',branchId:'isolated-request-branch',databaseName:DATABASE,role:ROLE,schemaDigest:digests[0]},module:{id:'benchmark',schemaDigest:digests[1],auditSchemaDigest:digests[2]},requestLedger:{schemaDigest},independentQuery:queryFor(auditPool),transact,
    createAuthenticator:({resolveBinding})=>async request=>{const binding=await resolveBinding({environment:'development',issuer:ISSUER,subject:'external-'+request.user});return binding?{kind:'HUMAN',actorId:binding.userId,userId:binding.userId,proofRef:'SYNTHETIC_VERIFIED_INTERFACE',issuer:ISSUER,audience:APP,environment:'development',expiresAt:binding.expiresAt}:null},
    readResources:async({actor,request})=>({resource:{id:request.resourceId,type:'forecast_request',dataClass:'OPERATION_AUDIT',environment:'development',ownerOrganisationId:request.organisationId,ownerUserId:actor.userId,version:'creation-intent-v1',projectionVersion:'request-accepted-v1'}}),projectOutput:value=>value})
   const input=({org=A,user=U,key='request_key_'+randomUUID(),payload={series:'shared_series',model:'naive'},resource='forecast-request:creation-fixture'}={})=>({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'forecast.request',organisationId:org,resourceId:resource,idempotencyKey:key,payload,request:{user}})
   const execute=values=>host.execute(input(values),async(context,c)=>{actions++;await c.query('INSERT INTO request_fixture.commands VALUES($1,$2,$3,$4)',[context.requestReservation.requestId,context.organisationId,context.actorId,context.payloadDigest]);if(observeScopedSql)await observeScopedSql(c,context);return{requestId:context.requestReservation.requestId,status:'ACCEPTED'}})
   return{host,input,execute,get actions(){return actions}}
  }
  const count=async()=>({intents:Number((await owner.query('SELECT count(*) FROM profitia_requests.intents')).rows[0].count),commands:Number((await owner.query('SELECT count(*) FROM request_fixture.commands')).rows[0].count),used:Number((await owner.query('SELECT coalesce(sum(accepted_count),0) AS n FROM profitia_requests.policies')).rows[0].n)})
  const scenario=async(name,fn,options)=>t.test(name,async()=>{await reset(options);await fn()})
  await scenario('two concurrent same-key requests commit one effect and quota unit with current audit',async()=>{
   const f=fixture(),key='concurrent_key_'+randomUUID(),r=await Promise.allSettled([f.execute({key}),f.execute({key})]);assert(r.every(x=>x.status==='fulfilled'),JSON.stringify(r.map(x=>x.status==='rejected'?{reason:x.reason.reasonCode,message:x.reason.message}:x.value.value)))
   assert.deepEqual(r[0].value.value,r[1].value.value);assert.equal(f.actions,1);assert.deepEqual(await count(),{intents:1,commands:1,used:1})
   const events=(await owner.query('SELECT phase,event FROM profitia_access.security_events ORDER BY event_id')).rows;assert.equal(events.filter(e=>e.phase==='INTENT').length,2);assert.equal(events.filter(e=>e.phase==='OUTCOME').length,2)
  })
  await scenario('concurrent distinct keys respect capacity without unfunded intents',async()=>{
   const f=fixture(),r=await Promise.allSettled([f.execute(),f.execute()]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert(r.some(x=>x.status==='rejected'&&x.reason.reasonCode==='LIMIT_EXCEEDED'));assert.deepEqual(await count(),{intents:1,commands:1,used:1})
  },{capacity:1})
  await scenario('replay at capacity does not charge twice; altered payload/resource/org conflicts',async()=>{
   const f=fixture(),key='stable_key_'+randomUUID();await f.execute({key});await f.execute({key});assert.equal(f.actions,1)
   for(const patch of[{payload:{series:'foreign_series'}},{resource:'forecast-request:another'},{org:B}])await assert.rejects(f.execute({key,...patch}),e=>isOperationDenied(e)&&e.reasonCode==='IDEMPOTENCY_CONFLICT')
   assert.deepEqual(await count(),{intents:1,commands:1,used:1})
  },{capacity:1})
  await scenario('membership/product/permission revocation refuses even a previously accepted key',async()=>{
   const f=fixture(),key='revoke_key_'+randomUUID();await f.execute({key})
   for(const[sql,restore,args]of[
    ["UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2","UPDATE profitia_access.memberships SET status='ACTIVE' WHERE organisation_id=$1 AND user_id=$2",[A,U]],
    ["UPDATE profitia_access.product_grants SET status='REVOKED' WHERE organisation_id=$1","UPDATE profitia_access.product_grants SET status='ACTIVE' WHERE organisation_id=$1",[A]],
   ]){await owner.query(sql,args);try{await assert.rejects(f.execute({key}),isOperationDenied)}finally{await owner.query(restore,args)}}
   await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,$2,$3,$4,'DENY','forecast.request','forecast')",[randomUUID(),APP,A,U]);await assert.rejects(f.execute({key}),isOperationDenied);assert.equal(f.actions,1);assert.deepEqual(await count(),{intents:1,commands:1,used:1})
  })
  await scenario('users/orgs own independent intents; foreign membership fails before ledger effects',async()=>{
   const f=fixture(),key='owner_key_'+randomUUID();await f.execute({key});await f.execute({user:V,key});await f.execute({org:B});await assert.rejects(f.execute({org:B,user:V}),isOperationDenied);assert.deepEqual(await count(),{intents:3,commands:3,used:3})
  })
  await scenario('OUTCOME outage rolls back domain SQL/quota/receipt and preserves correlated INTENT/FAILURE',async()=>{
   const f=fixture();await owner.query("CREATE FUNCTION request_fixture.reject_outcome() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.phase='OUTCOME' THEN RAISE EXCEPTION 'synthetic request audit failure';END IF;RETURN NEW;END $$;CREATE TRIGGER reject_outcome BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION request_fixture.reject_outcome()")
   await assert.rejects(f.execute(),e=>isOperationDenied(e)&&e.reasonCode==='AUDIT_UNAVAILABLE');assert.deepEqual(await count(),{intents:0,commands:0,used:0})
   const events=(await owner.query('SELECT phase,event FROM profitia_access.security_events ORDER BY event_id')).rows;assert.deepEqual(events.map(e=>e.phase),['INTENT','FAILURE']);assert.equal(events[0].event.decisionId,events[1].event.decisionId)
  })
  await scenario('foreign source digest and revoked policy cannot create a command or charge',async()=>{
   await assert.rejects(fixture({schemaDigest:'0'.repeat(64)}).execute(),isOperationDenied);await owner.query("UPDATE profitia_requests.policies SET status='REVOKED'");await assert.rejects(fixture().execute(),isOperationDenied);assert.deepEqual(await count(),{intents:0,commands:0,used:0})
  })
  await scenario('expired policy cannot become unmetered or NOT_APPLICABLE',async()=>{await assert.rejects(fixture().execute(),e=>isOperationDenied(e)&&e.reasonCode==='LIMIT_POLICY_UNAVAILABLE');assert.deepEqual(await count(),{intents:0,commands:0,used:0})},{expired:true})
  await scenario('scoped ordinary SELECT sees only its current user/org even after broad grants, while direct quota DML stays refused',async()=>{
   await owner.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA profitia_requests TO ${ROLE}`)
   let inspected=0
   const f=fixture({observeScopedSql:async(c,context)=>{
    const rows=(await c.query('SELECT organisation_id,user_id FROM profitia_requests.intents')).rows
    assert.equal(rows.length,1);assert(rows.every(row=>row.organisation_id===context.organisationId&&row.user_id===context.actorId));inspected++
    assert.equal((await c.query('SELECT * FROM profitia_requests.policies')).rowCount,0)
    assert.equal((await c.query('UPDATE profitia_requests.policies SET capacity=100')).rowCount,0)
    assert.equal((await c.query('DELETE FROM profitia_requests.intents')).rowCount,0)
    const foreign=(await c.query('SELECT profitia_requests.scope_allows($1::uuid,$2::uuid,$3) AS allowed',[context.organisationId===A?B:A,context.actorId,context.resourceId])).rows[0]
    assert.equal(foreign.allowed,false)
   }})
   await f.execute();await f.execute({user:V});await f.execute({org:B});assert.equal(inspected,3)
  })
  await scenario('database rejects an attempt to commit a RESERVED intent before its acceptance and audit',async()=>{
   const f=fixture();let sqlState
   await assert.rejects(f.host.execute(f.input(),async(_context,c)=>{try{await c.query('COMMIT')}catch(e){sqlState=e.code;throw e}throw Error('Unaccepted intent unexpectedly committed')}),isOperationDenied)
   assert.equal(sqlState,'23514');assert.deepEqual(await count(),{intents:0,commands:0,used:0})
  })
  await scenario('accepted intent and policy definition cannot be rewritten even by an ordinary maintenance statement',async()=>{
   await fixture().execute()
   await assert.rejects(owner.query("UPDATE profitia_requests.intents SET status='RESERVED',receipt=NULL"),e=>e.code==='42501')
   await assert.rejects(owner.query('UPDATE profitia_requests.policies SET capacity=100'),e=>e.code==='42501')
   await assert.rejects(owner.query('UPDATE profitia_requests.policies SET accepted_count=0'),e=>e.code==='42501')
   assert.deepEqual(await count(),{intents:1,commands:1,used:1})
  })
  await scenario('database owner keys reject orphan policy organisations and cross-organisation policy references',async()=>{
   await assert.rejects(owner.query("INSERT INTO profitia_requests.policies(policy_id,application_id,organisation_id,operation,status,source_ref,window_start,window_end,expires_at,capacity) VALUES($1,$2,$3,'forecast.request','ACTIVE','SYNTHETIC_ORPHAN',now(),now()+interval '1 hour',now()+interval '1 hour',1)",[randomUUID(),APP,randomUUID()]),e=>e.code==='23503')
   const foreign=(await owner.query('SELECT policy_id FROM profitia_requests.policies WHERE organisation_id=$1',[B])).rows[0].policy_id
   await assert.rejects(owner.query("INSERT INTO profitia_requests.intents(request_id,key_digest,binding_fingerprint,application_id,environment,organisation_id,user_id,operation,resource_id,payload_digest,policy_id,policy_version,decision_id,status) VALUES($1,$2,$3,$4,'development',$5,$6,'forecast.request','synthetic-creation',$7,$8,1,$9,'RESERVED')",[randomUUID(),'1'.repeat(64),'2'.repeat(64),APP,A,U,'3'.repeat(64),foreign,randomUUID()]),e=>e.code==='23503')
   assert.deepEqual(await count(),{intents:0,commands:0,used:0})
  })
  await scenario('domain command foreign key binds request, application, environment, owner and payload',async()=>{
   const accepted=await fixture().execute()
   await owner.query(`CREATE TABLE request_fixture.command_binding_probe(request_id uuid NOT NULL,application_id text NOT NULL,environment text NOT NULL,organisation_id uuid NOT NULL,user_id uuid NOT NULL,payload_digest text NOT NULL,
    FOREIGN KEY(request_id,application_id,environment,organisation_id,user_id,payload_digest) REFERENCES profitia_requests.intents(request_id,application_id,environment,organisation_id,user_id,payload_digest))`)
   const row=(await owner.query('SELECT request_id,application_id,environment,organisation_id,user_id,payload_digest FROM profitia_requests.intents WHERE request_id=$1',[accepted.value.requestId])).rows[0]
   const keys=['request_id','application_id','environment','organisation_id','user_id','payload_digest']
   const insert=patch=>owner.query('INSERT INTO request_fixture.command_binding_probe VALUES($1,$2,$3,$4,$5,$6)',keys.map(k=>patch[k]??row[k]))
   for(const patch of[{request_id:randomUUID()},{application_id:'foreign_app'},{environment:'staging'},{organisation_id:B},{user_id:V},{payload_digest:'a'.repeat(64)}])await assert.rejects(insert(patch),e=>e.code==='23503')
   await insert({});assert.equal((await owner.query('SELECT count(*) FROM request_fixture.command_binding_probe')).rows[0].count,'1')
  })
  await scenario('FORCE RLS refuses direct tampering even after accidental broad table grants',async()=>{
   const f=fixture();await f.execute();await owner.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA profitia_requests TO ${ROLE}`)
   assert.equal((await pool.query('SELECT * FROM profitia_requests.intents')).rows.length,0);assert.equal((await pool.query('SELECT * FROM profitia_requests.policies')).rows.length,0)
   assert.equal((await pool.query('UPDATE profitia_requests.policies SET capacity=100')).rowCount,0);assert.equal((await pool.query('DELETE FROM profitia_requests.intents')).rowCount,0);await assert.rejects(pool.query('SET ROLE profitia_access_owner'),e=>e.code==='42501')
   const rows=(await owner.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_requests' AND c.relkind='r'")).rows;assert.equal(rows.length,3);assert(rows.every(r=>r.relrowsecurity&&r.relforcerowsecurity));assert.deepEqual(await count(),{intents:1,commands:1,used:1})
  })
 }finally{globalThis.fetch=previousFetch;await pool?.end();await auditPool?.end();await owner?.end();await root.end()}
})
