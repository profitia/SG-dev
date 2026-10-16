import assert from 'node:assert/strict'
import test from 'node:test'
import pg from 'pg'
import { assertIsolatedTestConnection, initialiseAuthoritySchema, seedAuthority, putTestResource, createPostgresAuthority, TEST_ORGANISATIONS, TEST_USERS } from '../src/operation-postgres-fixture.mjs'
import { createOperationExecutor, OPERATION_CONTRACT } from '../../../packages/platform-contracts/src/operation-context.mjs'

test('operation fixture cannot connect to hosted databases, wrong roles or ordinary local databases', () => {
  const valid = 'postgresql://architecture_test_owner@127.0.0.1:55439/sg2_operation_test'
  assert.equal(assertIsolatedTestConnection(valid, 'sg2_operation_test', 'architecture_test_owner'), valid)
  for (const value of ['postgresql://architecture_test_owner@example.neon.tech/sg2_operation_test', 'postgresql://architecture_test_owner@127.0.0.1/architecture_pmos', 'postgresql://neondb_owner@127.0.0.1/sg2_operation_test', 'postgresql://architecture_test_owner@127.0.0.1.evil.test/sg2_operation_test']) assert.throws(() => assertIsolatedTestConnection(value, 'sg2_operation_test', 'architecture_test_owner'), /disposable loopback/)
})

test('ordinary PostgreSQL role locks current authority and commits append-only audit, without policy mutation rights', { skip: !process.env.OPERATION_FIXTURE_OWNER_URL }, async () => {
  const ownerUrl = assertIsolatedTestConnection(process.env.OPERATION_FIXTURE_OWNER_URL, 'sg2_operation_test', 'architecture_test_owner')
  const owner = new pg.Client({ connectionString: ownerUrl }); await owner.connect()
  let fixture
  try {
    if (!(await owner.query("SELECT 1 FROM pg_roles WHERE rolname='sg2_operation_runtime'")).rowCount) await owner.query("CREATE ROLE sg2_operation_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD 'isolated_ci_only'")
    await owner.query('DROP SCHEMA IF EXISTS operation_test CASCADE')
    await initialiseAuthoritySchema(owner, ['sg2_operation_runtime'])
    const application = { appId: 'fixture-test', profileId: 'SPENDGURU_SAAS', environment: 'development', deploymentId: 'isolated-fixture', configurationVersion: 'v1', organisationId: null, features: ['benchmark'], operations: ['benchmark.selection.read'] }
    await seedAuthority(owner, application, [{ operation: 'benchmark.selection.read', feature: 'benchmark', resourceId: null }])
    await putTestResource(owner, application, TEST_ORGANISATIONS.a, { id: 'r1', type: 'benchmark_selection', dataClass: 'ORGANISATION_PRIVATE', environment: 'development', ownerOrganisationId: TEST_ORGANISATIONS.a, ownerUserId: null, version: '1', projectionVersion: 'operation-v1' })
    const runtime = new URL(ownerUrl); runtime.username = 'sg2_operation_runtime'; runtime.password = 'isolated_ci_only'
    fixture = createPostgresAuthority({ ownerUrl, runtimeUrl: runtime.toString(), database: 'sg2_operation_test', role: 'sg2_operation_runtime', application, projectOutput: x => x })
    const executor = createOperationExecutor(fixture.options)
    const input = { contractId: OPERATION_CONTRACT.id, contractVersion: OPERATION_CONTRACT.version, operation: 'benchmark.selection.read', organisationId: TEST_ORGANISATIONS.a, resourceId: 'r1', payload: null, request: new Request('https://isolated.test', { headers: { authorization: `Bearer ${fixture.issuer.issue(TEST_USERS.a)}` } }) }
    const result = await executor.execute(input, async (_context, client) => {
      assert.equal((await owner.query("SELECT count(*)::int AS n FROM operation_test.audit WHERE event->>'phase'='INTENT'")).rows[0].n, 1)
      return (await client.query('SELECT current_user AS role')).rows[0]
    })
    assert.equal(result.value.role, 'sg2_operation_runtime')
    assert.deepEqual((await owner.query("SELECT event->>'phase' AS phase FROM operation_test.audit ORDER BY id")).rows.map(r => r.phase), ['INTENT', 'OUTCOME'])
    const client = await fixture.pool.connect()
    try {
      await assert.rejects(client.query("UPDATE operation_test.authorities SET document='{}'::jsonb"), /permission denied/)
      await assert.rejects(client.query('DELETE FROM operation_test.audit'), /permission denied/)
      assert.equal((await client.query('SELECT * FROM operation_test.authorities')).rowCount, 0)
    } finally { client.release() }
  } finally { if (fixture) await fixture.close(); await owner.end() }
})
