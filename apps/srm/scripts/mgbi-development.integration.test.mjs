import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import pg from 'pg'
import {supplierBusinessFixture} from './supplier-delegated-business.integration.test.mjs'

// The genuine consumer engine, Source hosts, ordinary roles, private persistence
// and local synthetic provider are reused rather than replaced with a permission
// mock. No cloud database or real provider credential is accepted by the fixture.
test('main Development MGBI-only composition preserves tenant history, XML receipts, audit and paid quotas under UNMETERED Source policies',
  t=>supplierBusinessFixture(t,true,undefined,{companySourcePolicy:'MGBI_ONLY'}))

test('main Development administration can temporarily use its retained ADMIN option and removes its own SET membership before COMMIT',
  t=>supplierBusinessFixture(t,true,async({owner})=>{
    const role='srm_control_fixture_'+randomUUID().replaceAll('-','')
    await owner.query(`CREATE ROLE ${role} LOGIN PASSWORD 'isolated_ci_only' NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`)
    const url=new URL(process.env.SRM_OPERATION_TEST_OWNER_URL);url.username=role;url.password='isolated_ci_only'
    const operator=new pg.Client({connectionString:url.toString()})
    try{
      await owner.query(`GRANT CONNECT ON DATABASE srm_app TO ${role}`)
      await owner.query(`GRANT profitia_ingestion_owner TO ${role} WITH ADMIN TRUE, INHERIT FALSE, SET FALSE`)
      await operator.connect()
      const baseline=async()=>({rows:(await operator.query("SELECT pg_has_role(current_user,'profitia_ingestion_owner','SET') AS can_set,r.rolsuper,r.rolcreaterole,r.rolbypassrls FROM pg_roles r WHERE rolname=current_user")).rows,
        grants:(await operator.query("SELECT grantor::regrole::text,admin_option,inherit_option,set_option FROM pg_auth_members WHERE roleid='profitia_ingestion_owner'::regrole AND member=current_user::regrole ORDER BY grantor")).rows})
      const before=await baseline();assert.equal(before.rows[0].can_set,false)
      assert.deepEqual(before.rows[0],{can_set:false,rolsuper:false,rolcreaterole:false,rolbypassrls:false})
      for(const finish of ['COMMIT','ROLLBACK']){
        await operator.query('BEGIN')
        await operator.query(`GRANT profitia_ingestion_owner TO ${role} WITH ADMIN FALSE, INHERIT FALSE, SET TRUE`)
        await operator.query('SET LOCAL ROLE profitia_ingestion_owner')
        assert.equal((await operator.query('SELECT current_user')).rows[0].current_user,'profitia_ingestion_owner')
        await operator.query('RESET ROLE')
        await operator.query(`REVOKE profitia_ingestion_owner FROM ${role} GRANTED BY ${role}`)
        assert.deepEqual(await baseline(),before)
        await operator.query(finish)
        assert.deepEqual(await baseline(),before)
      }
    }finally{await operator.end();await owner.query(`DROP OWNED BY ${role};DROP ROLE ${role}`)}
  }))
