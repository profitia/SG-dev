import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { accessSchemaUrl, moduleAuditSchemaUrl } from '@profitia/platform-contracts/access-store'
import { moduleSchemaUrl } from '@profitia/platform-contracts/module-scope'
import { assertIsolatedTestConnection } from '../../architecture-lab/src/operation-postgres-fixture.mjs'

const pg = createRequire(new URL('../../architecture-lab/package.json', import.meta.url))('pg')
const DATABASE = 'sg2_business_schema_test', ROLE = 'sg2_business_schema_runtime'
const businessSql = fs.readFileSync(new URL('../prisma/private-store/001-business-schema.sql', import.meta.url), 'utf8')
const boundarySql = fs.readFileSync(new URL('../prisma/security/benchmark-private-boundaries.sql', import.meta.url), 'utf8')
const hash = text => createHash('sha256').update(text).digest('hex')
const installation = [
  [fs.readFileSync(new URL(accessSchemaUrl), 'utf8'), "INSERT INTO profitia_access.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','isolated-private-project','isolated-private-branch',$2)"],
  [fs.readFileSync(new URL(moduleSchemaUrl), 'utf8'), "INSERT INTO profitia_modules.installation(schema_version,schema_digest) VALUES('1.0.0',$1)"],
  [fs.readFileSync(new URL(moduleAuditSchemaUrl), 'utf8'), "INSERT INTO profitia_modules.audit_installation(envelope_version,schema_digest,source_ref) VALUES('1.0.0',$1,'SYNTHETIC_NOT_A_RELEASE')"],
]

test('deployable private SG2 DDL is atomic, Prisma-compatible and closed below the API', async t => {
  const ownerUrl = assertIsolatedTestConnection(process.env.SG2_OPERATION_TEST_OWNER_URL, 'sg2_operation_test', 'architecture_test_owner')
  const root = new pg.Client({ connectionString: ownerUrl }); await root.connect()
  const url = new URL(ownerUrl); url.pathname = `/${DATABASE}`
  let owner, runtime
  const transaction = async (work, commit = false) => {
    await owner.query('BEGIN; SET LOCAL ROLE profitia_access_owner')
    try { const result = await work(); await owner.query(commit ? 'COMMIT' : 'ROLLBACK'); return result }
    catch (error) { await owner.query('ROLLBACK'); throw error }
  }
  const exists = async () => (await owner.query("SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='sg_runtime_benchmarks') AS present")).rows[0].present
  try {
    if (!(await root.query('SELECT 1 FROM pg_database WHERE datname=$1', [DATABASE])).rowCount) await root.query(`CREATE DATABASE ${DATABASE}`)
    // Role definitions are cluster-wide: serialize only their creation/verification.
    await root.query('BEGIN; SELECT pg_advisory_xact_lock(170001,20261017)')
    try {
      for (const [name, login] of [['profitia_access_owner', false], [ROLE, true]]) {
        if (!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [name])).rowCount) {
          await root.query(`CREATE ROLE ${name} ${login ? "LOGIN PASSWORD 'isolated_ci_only'" : 'NOLOGIN'} NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`)
        }
        assert.deepEqual((await root.query('SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolinherit,rolcanlogin FROM pg_roles WHERE rolname=$1', [name])).rows[0],
          { rolsuper: false, rolbypassrls: false, rolcreatedb: false, rolcreaterole: false, rolinherit: false, rolcanlogin: login })
      }
      await root.query('COMMIT')
    } catch (error) { await root.query('ROLLBACK'); throw error }
    owner = new pg.Client({ connectionString: url.toString() }); await owner.connect()
    assert.equal((await owner.query('SELECT current_database() AS db')).rows[0].db, DATABASE)
    // No remote URL or product database is accepted by this disposable fixture.
    await owner.query('DROP SCHEMA IF EXISTS sg_runtime_benchmarks CASCADE; DROP SCHEMA IF EXISTS profitia_modules CASCADE; DROP SCHEMA IF EXISTS profitia_access CASCADE')
    await owner.query(`GRANT CREATE ON DATABASE ${DATABASE} TO profitia_access_owner`)
    await t.test('wrong owner and missing accepted control installations deny without creating a namespace', async () => {
      await assert.rejects(owner.query(businessSql), error => error.code === '42501')
      await assert.rejects(transaction(() => owner.query(businessSql)), error => error.code === '42P01')
      assert.equal(await exists(), false)
    })
    await transaction(async () => {
      for (const [sql, receipt] of installation) {
        await owner.query(sql)
        await owner.query(receipt, receipt.includes('database_name') ? [hash(sql), DATABASE] : [hash(sql)])
      }
    }, true)
    await t.test('wrong installation checksum is refused atomically', async () => {
      await assert.rejects(transaction(async () => {
        await owner.query("UPDATE profitia_access.installation SET schema_digest=repeat('0',64)")
        await owner.query(businessSql)
      }), /Accepted access, module and audit installations required/)
      assert.equal(await exists(), false)
    })
    await t.test('unexpected inherited global default table grants are refused, without changing them', async () => {
      const before = (await owner.query("SELECT defaclacl::text FROM pg_default_acl WHERE defaclrole='profitia_access_owner'::regrole ORDER BY oid")).rows
      await assert.rejects(transaction(async () => {
        await owner.query(`ALTER DEFAULT PRIVILEGES FOR ROLE profitia_access_owner GRANT SELECT ON TABLES TO ${ROLE}`)
        await owner.query(businessSql)
      }), /Unexpected global default ACL/)
      assert.deepEqual((await owner.query("SELECT defaclacl::text FROM pg_default_acl WHERE defaclrole='profitia_access_owner'::regrole ORDER BY oid")).rows, before)
      assert.equal(await exists(), false)
    })
    await t.test('a pre-existing namespace is preserved and never adopted', async () => {
      await owner.query('CREATE SCHEMA sg_runtime_benchmarks; CREATE TABLE sg_runtime_benchmarks.sentinel(value text); INSERT INTO sg_runtime_benchmarks.sentinel VALUES(\'preserve\')')
      await assert.rejects(transaction(() => owner.query(businessSql)), /namespace already exists/)
      assert.deepEqual((await owner.query('SELECT * FROM sg_runtime_benchmarks.sentinel')).rows, [{ value: 'preserve' }])
      // Only this guarded loopback fixture's synthetic namespace is cleaned.
      await owner.query('DROP SCHEMA sg_runtime_benchmarks CASCADE')
    })
    await t.test('failure after business DDL rolls back the entire new schema', async () => {
      await assert.rejects(transaction(async () => {
        await owner.query(businessSql)
        await owner.query('SELECT missing_private_boundary_step()')
      }), error => error.code === '42883')
      assert.equal(await exists(), false)
    })
    await transaction(async () => {
      await owner.query(businessSql)
      await owner.query(boundarySql)
      await owner.query("INSERT INTO sg_runtime_benchmarks.private_installation(schema_version,schema_digest,boundary_digest,source_ref) VALUES('1.0.0',$1,$2,'SYNTHETIC_NOT_A_RELEASE')", [hash(businessSql), hash(boundarySql)])
    }, true)
    await t.test('all five model tables and the receipt have FORCE RLS and the controlled owner', async () => {
      const tables = (await owner.query("SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) AS owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='sg_runtime_benchmarks' AND c.relkind='r' ORDER BY c.relname")).rows
      assert.equal(tables.length, 6)
      for (const row of tables) {
        assert.equal(row.relrowsecurity, true); assert.equal(row.relforcerowsecurity, true); assert.equal(row.owner, 'profitia_access_owner')
      }
      assert.deepEqual((await transaction(() => owner.query('SELECT schema_version,schema_digest,boundary_digest,source_ref FROM sg_runtime_benchmarks.private_installation'))).rows,
        [{ schema_version: '1.0.0', schema_digest: hash(businessSql), boundary_digest: hash(boundarySql), source_ref: 'SYNTHETIC_NOT_A_RELEASE' }])
    })
    await t.test('actual database has exactly the unchanged Prisma model shape plus its technical receipt', () => {
      const prismaUrl = new URL(url); prismaUrl.searchParams.set('schema', 'sg_runtime_benchmarks')
      const diff = execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-url', prismaUrl.toString(), '--to-schema-datamodel', 'prisma/schema.prisma', '--script'], { encoding: 'utf8', env: process.env })
      const statements = diff.replace(/--[^\n]*/g, '').trim()
      assert.equal(statements, 'DROP TABLE "private_installation";')
    })
    url.username = ROLE; url.password = 'isolated_ci_only'
    runtime = new pg.Client({ connectionString: url.toString() }); await runtime.connect()
    await t.test('ordinary login has no implicit schema/table/receipt grants or owner membership', async () => {
      const row = (await runtime.query("SELECT current_user,session_user,pg_has_role(current_user,'profitia_access_owner','MEMBER') AS owner_member,has_schema_privilege(current_user,'sg_runtime_benchmarks','USAGE') AS schema_usage,has_database_privilege(current_user,current_database(),'CREATE') AS db_create")).rows[0]
      assert.deepEqual(row, { current_user: ROLE, session_user: ROLE, owner_member: false, schema_usage: false, db_create: false })
      for (const table of ['BusinessBenchmark','BenchmarkProviderMapping','OrganizationBenchmarkSelection','Category','CategoryCostComponent','private_installation']) {
        await assert.rejects(runtime.query(`SELECT * FROM sg_runtime_benchmarks."${table}"`), error => error.code === '42501')
      }
    })
    await t.test('accidental model ACLs cannot bypass unbound module or open unadopted categories', async () => {
      await owner.query(`GRANT USAGE ON SCHEMA profitia_access,profitia_modules,sg_runtime_benchmarks TO ${ROLE}; GRANT EXECUTE ON FUNCTION profitia_access.scope_allows(text,uuid,uuid),profitia_access.runtime_descriptor(),profitia_modules.scope_allows(text,uuid,uuid),profitia_modules.runtime_descriptor() TO ${ROLE}; GRANT SELECT,INSERT,UPDATE,DELETE ON sg_runtime_benchmarks."BusinessBenchmark",sg_runtime_benchmarks."BenchmarkProviderMapping",sg_runtime_benchmarks."OrganizationBenchmarkSelection",sg_runtime_benchmarks."Category",sg_runtime_benchmarks."CategoryCostComponent" TO ${ROLE}`)
      for (const table of ['BusinessBenchmark','BenchmarkProviderMapping','OrganizationBenchmarkSelection','Category','CategoryCostComponent']) assert.deepEqual((await runtime.query(`SELECT * FROM sg_runtime_benchmarks."${table}"`)).rows, [])
      await assert.rejects(runtime.query('INSERT INTO sg_runtime_benchmarks."Category"(id,"organizationId",name,"createdByUserId","updatedAt") VALUES(\'forbidden\',\'11111111-1111-4111-8111-111111111111\',\'no implicit feature\',\'fixture\',now())'), error => error.code === '42501')
      await assert.rejects(runtime.query('SELECT * FROM sg_runtime_benchmarks.private_installation'), error => error.code === '42501')
    })
    await t.test('a retry refuses existing state and preserves accepted data and receipt', async () => {
      await transaction(() => owner.query('INSERT INTO sg_runtime_benchmarks."BusinessBenchmark"(id,"organizationId","displayName","createdByUserId","updatedAt") VALUES(\'preserve-row\',\'11111111-1111-4111-8111-111111111111\',\'synthetic\',\'fixture\',now())'), true)
      await assert.rejects(transaction(() => owner.query(businessSql)), /namespace already exists/)
      const rows = await transaction(() => owner.query('SELECT id FROM sg_runtime_benchmarks."BusinessBenchmark"'))
      assert.deepEqual(rows.rows, [{ id: 'preserve-row' }])
      assert.equal((await transaction(() => owner.query('SELECT count(*)::int AS n FROM sg_runtime_benchmarks.private_installation'))).rows[0].n, 1)
    })
  } finally {
    await runtime?.end(); await owner?.end(); await root.end()
  }
})
