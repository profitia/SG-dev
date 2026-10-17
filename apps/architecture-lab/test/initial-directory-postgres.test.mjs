import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import test from 'node:test'
import pg from 'pg'
import { assertIsolatedTestConnection } from '../src/operation-postgres-fixture.mjs'

const DATABASE='platform_directory_test',ROLE='directory_fixture_runtime'
const source=name=>fs.readFileSync(new URL(`../../../packages/platform-contracts/migrations/access/${name}`,import.meta.url),'utf8')
const hash=value=>createHash('sha256').update(value).digest('hex')
const migrations=['001-internal-access.sql','002-module-scope.sql','003-module-audit.sql','004-initial-directory.sql'].map(source)
const user=randomUUID(),org=randomUUID(),binding=randomUUID(),receipt=randomUUID()

test('initial directory metadata preserves isolation and immutable bootstrap provenance',async t=>{
  const rootUrl=assertIsolatedTestConnection(process.env.OPERATION_FIXTURE_OWNER_URL,'sg2_operation_test','architecture_test_owner')
  const root=new pg.Client({connectionString:rootUrl});await root.connect()
  let owner,runtime
  try{
    if(!(await root.query('SELECT 1 FROM pg_database WHERE datname=$1',[DATABASE])).rowCount)await root.query(`CREATE DATABASE ${DATABASE}`)
    for(const [name,login]of [['profitia_access_owner',false],[ROLE,true]]){
      if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[name])).rowCount)await root.query(`CREATE ROLE ${name} ${login?"LOGIN PASSWORD 'isolated_ci_only'":'NOLOGIN'} NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`)
      const flags=(await root.query('SELECT rolcanlogin,rolinherit,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=$1',[name])).rows[0]
      assert.deepEqual(flags,{rolcanlogin:login,rolinherit:false,rolsuper:false,rolbypassrls:false,rolcreatedb:false,rolcreaterole:false})
    }
    const url=new URL(rootUrl);url.pathname=`/${DATABASE}`
    owner=new pg.Client({connectionString:url.toString()});await owner.connect()
    assert.equal((await owner.query('SELECT current_database() AS db')).rows[0].db,DATABASE)
    // Guarded named loopback fixture only; never a product or provider database.
    await owner.query('DROP SCHEMA IF EXISTS profitia_modules CASCADE;DROP SCHEMA IF EXISTS profitia_access CASCADE')
    await owner.query(`GRANT CREATE ON DATABASE ${DATABASE} TO profitia_access_owner`)
    await owner.query('BEGIN;SET LOCAL ROLE profitia_access_owner')
    await owner.query(migrations[0])
    await owner.query("INSERT INTO profitia_access.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','synthetic-project','synthetic-branch',$2)",[hash(migrations[0]),DATABASE])
    await owner.query(migrations[1]);await owner.query("INSERT INTO profitia_modules.installation(schema_version,schema_digest) VALUES('1.0.0',$1)",[hash(migrations[1])])
    await owner.query(migrations[2]);await owner.query("INSERT INTO profitia_modules.audit_installation(envelope_version,schema_digest,source_ref) VALUES('1.0.0',$1,'SYNTHETIC_ONLY')",[hash(migrations[2])])
    await owner.query(migrations[3]);await owner.query("INSERT INTO profitia_access.directory_installation(schema_version,schema_digest) VALUES('1.0.0',$1)",[hash(migrations[3])])
    await owner.query(`GRANT USAGE ON SCHEMA profitia_access TO ${ROLE}`)
    await owner.query('COMMIT')
    url.username=ROLE;url.password='isolated_ci_only';runtime=new pg.Client({connectionString:url.toString()});await runtime.connect()
    const asOwner=async work=>{await owner.query('BEGIN;SET LOCAL ROLE profitia_access_owner');try{const v=await work();await owner.query('COMMIT');return v}catch(error){await owner.query('ROLLBACK');throw error}}
    await t.test('DDL creates no implicit account, grant or activation and all metadata tables FORCE RLS',async()=>{
      const counts=(await owner.query('SELECT (SELECT count(*) FROM profitia_access.accounts)::int AS accounts,(SELECT count(*) FROM profitia_access.organisations)::int AS organisations,(SELECT count(*) FROM profitia_access.permission_grants)::int AS grants,(SELECT count(*) FROM profitia_access.applications)::int AS applications')).rows[0]
      assert.deepEqual(counts,{accounts:0,organisations:0,grants:0,applications:0})
      const tables=(await owner.query("SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relnamespace='profitia_access'::regnamespace AND relkind='r'")).rows
      assert.equal(tables.length,12);assert(tables.every(row=>row.relrowsecurity&&row.relforcerowsecurity))
    })
    await t.test('controlled bootstrap stores internal names and exact subject independently of provider-managed organisation ids',async()=>{
      await asOwner(async()=>{
        await owner.query("INSERT INTO profitia_access.accounts(user_id,status,display_name) VALUES($1,'ACTIVE','Synthetic Administrator')",[user])
        await owner.query("INSERT INTO profitia_access.organisations(organisation_id,status,display_name) VALUES($1,'ACTIVE','Synthetic Organisation')",[org])
        await owner.query("INSERT INTO profitia_access.external_identities(binding_id,issuer,subject,user_id,status,source_ref,expires_at) VALUES($1,'https://identity.fixture.test','synthetic-provider-subject',$2,'ACTIVE','SYNTHETIC_ONLY',clock_timestamp()+interval '1 hour')",[binding,user])
        await owner.query("INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at) VALUES($1,$2,'ACTIVE','SYNTHETIC_ONLY',clock_timestamp()+interval '1 hour')",[org,user])
        await owner.query("INSERT INTO profitia_access.bootstrap_receipts(receipt_id,organisation_id,user_id,external_binding_id,plan_digest,source_ref,actor_ref) VALUES($1,$2,$3,$4,$5,'SYNTHETIC_ONLY','synthetic-operator')",[receipt,org,user,binding,'a'.repeat(64)])
      })
      assert.equal((await owner.query('SELECT display_name FROM profitia_access.organisations WHERE organisation_id=$1',[org])).rows[0].display_name,'Synthetic Organisation')
      assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_access.permission_grants')).rows[0].n,0)
      assert.equal((await owner.query('SELECT database_session_user FROM profitia_access.bootstrap_receipts WHERE receipt_id=$1',[receipt])).rows[0].database_session_user,'architecture_test_owner')
    })
    await t.test('ordinary login cannot read or change names, initialisation ledger or receipts',async()=>{
      assert.equal((await runtime.query('SELECT current_user')).rows[0].current_user,ROLE)
      for(const sql of ['SELECT display_name FROM profitia_access.accounts','SELECT display_name FROM profitia_access.organisations','SELECT * FROM profitia_access.bootstrap_receipts','SELECT * FROM profitia_access.directory_installation',"UPDATE profitia_access.organisations SET display_name='forged'",'DELETE FROM profitia_access.bootstrap_receipts'])await assert.rejects(runtime.query(sql),error=>error.code==='42501')
    })
    await t.test('even the controlled data owner cannot rewrite, delete or truncate an accepted receipt',async()=>{
      for(const sql of ["UPDATE profitia_access.bootstrap_receipts SET actor_ref='forged'",'DELETE FROM profitia_access.bootstrap_receipts','TRUNCATE profitia_access.bootstrap_receipts'])await assert.rejects(asOwner(()=>owner.query(sql)),error=>error.code==='42501')
      assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_access.bootstrap_receipts')).rows[0].n,1)
    })
    await t.test('invalid names, sensitive provenance, duplicate receipts and foreign references fail closed',async()=>{
      for(const name of ['','   ',' leading','trailing ','x'.repeat(257)])await assert.rejects(asOwner(()=>owner.query("INSERT INTO profitia_access.organisations(organisation_id,status,display_name) VALUES($1,'ACTIVE',$2)",[randomUUID(),name])),error=>error.code==='23514')
      for(const reference of ['sk_test_fixture','ghp_synthetic','postgresql://fixture','Bearer synthetic'])await assert.rejects(asOwner(()=>owner.query("INSERT INTO profitia_access.bootstrap_receipts(receipt_id,organisation_id,user_id,external_binding_id,plan_digest,source_ref,actor_ref) VALUES($1,$2,$3,$4,$5,$6,'synthetic-operator')",[randomUUID(),org,user,binding,'b'.repeat(64),reference])),error=>error.code==='23514')
      await assert.rejects(asOwner(()=>owner.query("INSERT INTO profitia_access.bootstrap_receipts SELECT * FROM profitia_access.bootstrap_receipts")),error=>error.code==='23505')
      await assert.rejects(asOwner(()=>owner.query("INSERT INTO profitia_access.bootstrap_receipts(receipt_id,organisation_id,user_id,external_binding_id,plan_digest,source_ref,actor_ref) VALUES($1,$2,$3,$4,$5,'SYNTHETIC_ONLY','synthetic-operator')",[randomUUID(),randomUUID(),user,binding,'c'.repeat(64)])),error=>error.code==='23503')
    })
    await t.test('failure to persist the mandatory bootstrap receipt rolls back the new identity and organisation',async()=>{
      const nextUser=randomUUID(),nextOrg=randomUUID()
      await assert.rejects(asOwner(async()=>{
        await owner.query("INSERT INTO profitia_access.accounts(user_id,status,display_name) VALUES($1,'ACTIVE','Synthetic rollback')",[nextUser])
        await owner.query("INSERT INTO profitia_access.organisations(organisation_id,status,display_name) VALUES($1,'ACTIVE','Synthetic rollback')",[nextOrg])
        await owner.query("INSERT INTO profitia_access.bootstrap_receipts(receipt_id,organisation_id,user_id,external_binding_id,plan_digest,source_ref,actor_ref) VALUES($1,$2,$3,$4,$5,'SYNTHETIC_ONLY','synthetic-operator')",[randomUUID(),nextOrg,nextUser,randomUUID(),'d'.repeat(64)])
      }),error=>error.code==='23503')
      assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_access.accounts WHERE user_id=$1',[nextUser])).rows[0].n,0)
      assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_access.organisations WHERE organisation_id=$1',[nextOrg])).rows[0].n,0)
    })
    await t.test('migration cannot be reapplied or executed by an ordinary login',async()=>{
      await assert.rejects(runtime.query(migrations[3]),error=>error.code==='42501')
      await assert.rejects(asOwner(()=>owner.query(migrations[3])),error=>error.code==='42701')
      assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_access.bootstrap_receipts')).rows[0].n,1)
    })
    await t.test('receipt cannot attach another identity binding to an otherwise valid member',async()=>{
      const otherUser=randomUUID(),otherBinding=randomUUID()
      await asOwner(async()=>{
        await owner.query("INSERT INTO profitia_access.accounts(user_id,status) VALUES($1,'ACTIVE')",[otherUser])
        await owner.query("INSERT INTO profitia_access.external_identities(binding_id,issuer,subject,user_id,status,source_ref,expires_at) VALUES($1,'https://identity.fixture.test','synthetic-other-subject',$2,'ACTIVE','SYNTHETIC_ONLY',clock_timestamp()+interval '1 hour')",[otherBinding,otherUser])
      })
      await assert.rejects(asOwner(()=>owner.query("INSERT INTO profitia_access.bootstrap_receipts(receipt_id,organisation_id,user_id,external_binding_id,plan_digest,source_ref,actor_ref) VALUES($1,$2,$3,$4,$5,'SYNTHETIC_ONLY','synthetic-operator')",[randomUUID(),org,user,otherBinding,'e'.repeat(64)])),error=>error.code==='23503')
    })
    await t.test('receipt time and database operator are stamped rather than accepted from insert fields',async()=>{
      const id=randomUUID()
      await asOwner(()=>owner.query("INSERT INTO profitia_access.bootstrap_receipts(receipt_id,recorded_at,database_session_user,organisation_id,user_id,external_binding_id,plan_digest,source_ref,actor_ref) VALUES($1,'2000-01-01','forged_session',$2,$3,$4,$5,'SYNTHETIC_ONLY','synthetic-operator')",[id,org,user,binding,'f'.repeat(64)]))
      const row=(await owner.query('SELECT recorded_at,database_session_user FROM profitia_access.bootstrap_receipts WHERE receipt_id=$1',[id])).rows[0]
      assert.equal(row.database_session_user,'architecture_test_owner')
      assert(Math.abs(Date.now()-row.recorded_at.getTime())<5000)
    })
    await t.test('historical receipt survives later revocation without rewriting its accepted identity',async()=>{
      await asOwner(async()=>{
        await owner.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2",[org,user])
        await owner.query("UPDATE profitia_access.external_identities SET status='REVOKED',binding_id=$1 WHERE binding_id=$2",[randomUUID(),binding])
      })
      const historical=(await owner.query('SELECT organisation_id,user_id,external_binding_id FROM profitia_access.bootstrap_receipts WHERE receipt_id=$1',[receipt])).rows[0]
      assert.deepEqual(historical,{organisation_id:org,user_id:user,external_binding_id:binding})
    })
  }finally{await runtime?.end();await owner?.end();await root.end()}
})
