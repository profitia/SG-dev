import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import test from 'node:test'
import { assertIsolatedTestConnection } from '../src/operation-postgres-fixture.mjs'
const { Client } = createRequire(import.meta.url)('pg')
const DATABASE = 'delegated_execution_' + randomUUID().replaceAll('-', '')
const FOREGROUND = 'delegated_job_foreground_fixture', EXECUTOR = 'delegated_job_executor_fixture'
const hash = value => createHash('sha256').update(value).digest('hex')
const source = name => fs.readFileSync(new URL('../../../packages/platform-contracts/migrations/access/' + name, import.meta.url), 'utf8')
const migration = source('007-delegated-jobs.sql')
const A = '11111111-1111-4111-8111-111111111111', U = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', V = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const future = () => new Date(Date.now() + 3600000).toISOString()

test('additive private dispatch DDL preserves authority and enforces immutable owner references', async t => {
  const rootUrl = assertIsolatedTestConnection(process.env.OPERATION_FIXTURE_OWNER_URL, 'sg2_operation_test', 'architecture_test_owner')
  const root = new Client({ connectionString: rootUrl }); await root.connect()
  const url = new URL(rootUrl); url.pathname = '/' + DATABASE
  let owner, runtime
  try {
    assert.equal((await root.query('SELECT 1 FROM pg_database WHERE datname=$1', [DATABASE])).rowCount, 0, 'Never adopt an existing database')
    await root.query(`CREATE DATABASE ${DATABASE}`)
    await root.query("BEGIN; SET LOCAL lock_timeout='5s'; SELECT pg_advisory_xact_lock(170001,20261017)")
    try {
      for (const [role,login] of [['profitia_access_owner',false],[FOREGROUND,true],[EXECUTOR,true]]) {
        if (!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount) await root.query(`CREATE ROLE ${role} ${login ? "LOGIN PASSWORD 'isolated_ci_only'" : 'NOLOGIN'} NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`)
        assert.deepEqual((await root.query('SELECT rolsuper,rolbypassrls,rolinherit,rolcanlogin FROM pg_roles WHERE rolname=$1',[role])).rows[0],{rolsuper:false,rolbypassrls:false,rolinherit:false,rolcanlogin:login})
      }
      await root.query('COMMIT')
    } catch(error) { await root.query('ROLLBACK'); throw error }
    owner = new Client({ connectionString: url.toString() }); await owner.connect()
    assert.equal((await owner.query('SELECT current_database() AS db')).rows[0].db, DATABASE)
    await owner.query(`GRANT CREATE ON DATABASE ${DATABASE} TO profitia_access_owner`)
    const controlled = async work => {
      await owner.query('BEGIN; SET LOCAL ROLE profitia_access_owner')
      try { const value=await work(); await owner.query('COMMIT'); return value }
      catch(error) { await owner.query('ROLLBACK'); throw error }
    }
    await controlled(async()=>{
      const base=source('001-internal-access.sql');await owner.query(base)
      await owner.query("INSERT INTO profitia_access.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','isolated-delegated-project','isolated-delegated-branch',$2)",[hash(base),DATABASE])
      const module=source('002-module-scope.sql');await owner.query(module);await owner.query("INSERT INTO profitia_modules.installation(schema_version,schema_digest) VALUES('1.0.0',$1)",[hash(module)])
      const audit=source('003-module-audit.sql');await owner.query(audit);await owner.query("INSERT INTO profitia_modules.audit_installation(envelope_version,schema_digest,source_ref) VALUES('1.0.0',$1,'SYNTHETIC_NOT_A_RELEASE')",[hash(audit)])
      const service=source('005-service-read.sql');await owner.query(service);await owner.query("INSERT INTO profitia_services.installation(schema_version,schema_digest,source_ref) VALUES('1.0.0',$1,'SYNTHETIC_NOT_A_RELEASE')",[hash(service)])
      const request=source('006-request-reservation.sql');await owner.query(request);await owner.query("INSERT INTO profitia_requests.installation(schema_version,schema_digest,source_ref) VALUES('1.0.0',$1,'SYNTHETIC_NOT_A_RELEASE')",[hash(request)])
    })
    await t.test('wrong owner and forced failure leave no dispatch schema or altered base constraints',async()=>{
      await assert.rejects(owner.query(migration),error=>error.code==='42501')
      await assert.rejects(controlled(async()=>{await owner.query(migration);await owner.query("DO $$BEGIN RAISE EXCEPTION 'synthetic dispatch migration failure';END$$")}))
      assert.equal((await owner.query("SELECT to_regnamespace('profitia_jobs') AS jobs")).rows[0].jobs,null)
      assert.equal((await owner.query("SELECT count(*)::int AS n FROM pg_constraint WHERE conname IN('private_job_target_reference','private_job_identity_owner_reference')")).rows[0].n,0)
    })
    await controlled(async()=>{await owner.query(migration);await owner.query("INSERT INTO profitia_jobs.installation VALUES(true,'1.0.0',$1,'SYNTHETIC_NOT_A_RELEASE')",[hash(migration)])})
    const policy=randomUUID(), requestId=randomUUID(), binding=randomUUID(), identity=randomUUID(), otherIdentity=randomUUID(), delegation=randomUUID()
    await controlled(async()=>{
      for(const user of[U,V])await owner.query("INSERT INTO profitia_access.accounts(user_id,status) VALUES($1,'ACTIVE')",[user])
      await owner.query("INSERT INTO profitia_access.organisations(organisation_id,status) VALUES($1,'ACTIVE')",[A])
      await owner.query("INSERT INTO profitia_access.applications(application_id,status) VALUES('spendguru','ACTIVE'),('forecast-jobs','ACTIVE')")
      await owner.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES($1,'spendguru','ACTIVE'),($2,'forecast-jobs','ACTIVE')",[FOREGROUND,EXECUTOR])
      for(const[user,id]of[[U,identity],[V,otherIdentity]]){
        await owner.query("INSERT INTO profitia_access.external_identities(binding_id,issuer,subject,user_id,status,source_ref,expires_at) VALUES($1,'https://identity.fixture.test',$2,$3,'ACTIVE','SYNTHETIC_ONLY',$4)",[id,'external-'+user,user,future()])
        await owner.query("INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at) VALUES($1,$2,'ACTIVE','SYNTHETIC_ONLY',$3)",[A,user,future()])
      }
      await owner.query("INSERT INTO profitia_requests.policies(policy_id,application_id,organisation_id,operation,status,source_ref,window_start,window_end,expires_at,capacity) VALUES($1,'spendguru',$2,'forecast.request','ACTIVE','SYNTHETIC_ONLY',now()-interval '1 hour',now()+interval '2 hours',$3,10)",[policy,A,future()])
      await owner.query("INSERT INTO profitia_requests.intents(request_id,key_digest,binding_fingerprint,application_id,environment,organisation_id,user_id,operation,resource_id,payload_digest,policy_id,policy_version,decision_id,status,receipt) VALUES($1,$2,$3,'spendguru','development',$4,$5,'forecast.request','request:synthetic-target',$6,$7,1,$8,'ACCEPTED',jsonb_build_object('requestId',($1::uuid)::text,'status','ACCEPTED'))",[requestId,'1'.repeat(64),'2'.repeat(64),A,U,'a'.repeat(64),policy,randomUUID()])
      await owner.query("INSERT INTO profitia_jobs.operation_bindings(binding_id,application_id,operation,foreground_role,profile_id,configuration_version,executor_application_id,source_id,delegation_ttl_seconds,max_attempts,status,source_ref,expires_at) VALUES($1,'spendguru','forecast.request',$2,'SPENDGURU_SAAS','request-fixture-v2','forecast-jobs','stored.forecast',300,3,'ACTIVE','SYNTHETIC_ONLY',$3)",[binding,FOREGROUND,future()])
      await owner.query("INSERT INTO profitia_jobs.delegations(delegation_id,request_id,application_id,environment,organisation_id,user_id,operation,resource_id,payload_digest,binding_id,binding_version,identity_binding_id,identity_binding_version,account_version,status,source_ref,expires_at) VALUES($1,$2,'spendguru','development',$3,$4,'forecast.request','request:synthetic-target',$5,$6,1,$7,1,1,'ACTIVE','SYNTHETIC_ONLY',$8)",[delegation,requestId,A,U,'a'.repeat(64),binding,identity,future()])
      await owner.query("INSERT INTO profitia_jobs.dispatches(job_id,request_id,delegation_id,source_id,delivery_key,status) VALUES($1::uuid,$1::uuid,$2::uuid,'stored.forecast',$3,'PENDING')",[requestId,delegation,'b'.repeat(64)])
    })
    await t.test('composite keys reject changed resource or an external identity owned by another user',async()=>{
      // Exact source rows are immutable; a forged reference cannot be inserted
      // even by a statement that bypasses RLS for this synthetic negative case.
      await assert.rejects(owner.query("UPDATE profitia_jobs.delegations SET resource_id='foreign-target'"),error=>error.code==='42501')
      for(const [resource,selectedIdentity] of [['foreign-target',identity],['request:synthetic-target',otherIdentity]]){
        const next=randomUUID()
        await owner.query("INSERT INTO profitia_requests.intents(request_id,key_digest,binding_fingerprint,application_id,environment,organisation_id,user_id,operation,resource_id,payload_digest,policy_id,policy_version,decision_id,status,receipt) VALUES($1,$2,$3,'spendguru','development',$4,$5,'forecast.request','request:synthetic-target',$6,$7,1,$8,'ACCEPTED',jsonb_build_object('requestId',($1::uuid)::text,'status','ACCEPTED'))",[next,hash(next),hash('binding:'+next),A,U,'a'.repeat(64),policy,randomUUID()])
        await assert.rejects(owner.query("INSERT INTO profitia_jobs.delegations(delegation_id,request_id,application_id,environment,organisation_id,user_id,operation,resource_id,payload_digest,binding_id,binding_version,identity_binding_id,identity_binding_version,account_version,status,source_ref,expires_at) VALUES($1,$2,'spendguru','development',$3,$4,'forecast.request',$5,$6,$7,1,$8,1,1,'ACTIVE','SYNTHETIC_ONLY',$9)",[randomUUID(),next,A,U,resource,'a'.repeat(64),binding,selectedIdentity,future()]),error=>error.code==='23503'
          && (resource==='foreign-target'?error.constraint.includes('request_id_application_id'):error.constraint.includes('identity_binding_id_user_id')))
      }
      await assert.rejects(owner.query("UPDATE profitia_jobs.dispatches SET source_id='foreign-source'"),error=>error.code==='42501')
      await assert.rejects(owner.query('DELETE FROM profitia_jobs.dispatches'),error=>error.code==='42501')
      const before=(await owner.query('SELECT revision FROM profitia_access.installation')).rows[0].revision
      await owner.query("UPDATE profitia_jobs.delegations SET status='REVOKED'")
      assert(BigInt((await owner.query('SELECT revision FROM profitia_access.installation')).rows[0].revision)>BigInt(before))
      assert.equal((await owner.query('SELECT version FROM profitia_jobs.delegations')).rows[0].version,'2')
    })
    await t.test('ordinary direct metadata access and mutation stay fenced after accidental DML grants',async()=>{
      await owner.query(`GRANT USAGE ON SCHEMA profitia_jobs TO ${EXECUTOR};GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA profitia_jobs TO ${EXECUTOR}`)
      const runtimeUrl=new URL(url);runtimeUrl.username=EXECUTOR;runtimeUrl.password='isolated_ci_only'
      runtime=new Client({connectionString:runtimeUrl.toString()});await runtime.connect()
      assert.equal((await runtime.query('SELECT * FROM profitia_jobs.dispatches')).rows.length,0)
      assert.equal((await runtime.query("UPDATE profitia_jobs.dispatches SET status='CONFIRMED'")).rowCount,0)
      await assert.rejects(runtime.query('DELETE FROM profitia_jobs.delegations'),error=>error.code==='42501')
      await assert.rejects(runtime.query('SET ROLE profitia_access_owner'),error=>error.code==='42501')
      const tables=(await owner.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_jobs' AND c.relkind='r'")).rows
      assert.equal(tables.length,6);assert(tables.every(row=>row.relrowsecurity&&row.relforcerowsecurity))
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM profitia_jobs.dispatches')).rows[0].n,1)
    })
  } finally {await runtime?.end();await owner?.end();await root.end()}
})
