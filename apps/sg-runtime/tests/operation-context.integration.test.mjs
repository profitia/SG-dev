import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { PrismaClient } from '@prisma/client'
import { NextRequest } from 'next/server.js'
import { createOperationExecutor } from '@profitia/platform-contracts/operation-context'
import { assertIsolatedTestConnection, initialiseAuthoritySchema, seedAuthority, putTestResource, createPostgresAuthority, TEST_ORGANISATIONS as O, TEST_USERS as U } from '../../architecture-lab/src/operation-postgres-fixture.mjs'
const pg = createRequire(new URL('../../architecture-lab/package.json', import.meta.url))('pg')

test('SG2 real selection handler, service and Prisma repository enforce isolated operation context', async t => {
  const ownerUrl = assertIsolatedTestConnection(process.env.SG2_OPERATION_TEST_OWNER_URL, 'sg2_operation_test', 'architecture_test_owner')
  const owner = new pg.Client({ connectionString: ownerUrl }); await owner.connect()
  let writer, reader, writerAuthority, readerAuthority
  const previousFetch = globalThis.fetch
  const privateSchema = 'sg_runtime_benchmarks'
  const databaseUrl = (role, prisma = false) => { const u = new URL(ownerUrl); u.username = role; u.password = 'isolated_ci_only'; if (prisma) { u.searchParams.set('schema', privateSchema); u.searchParams.set('connection_limit', '1') } return u.toString() }
  try {
    for (const role of ['sg2_operation_runtime', 'sg2_operation_reader']) if (!(await owner.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role])).rowCount) await owner.query(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD 'isolated_ci_only'`)
    await owner.query('DROP SCHEMA IF EXISTS operation_test CASCADE; DROP SCHEMA IF EXISTS sg_runtime_benchmarks CASCADE')
    const migrationUrl = new URL(ownerUrl); migrationUrl.searchParams.set('schema', privateSchema)
    execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate', '--schema', 'prisma/schema.prisma'], { env: { ...process.env, SG_RUNTIME_DATABASE_URL: migrationUrl.toString(), SG_RUNTIME_DIRECT_URL: migrationUrl.toString() }, stdio: 'pipe' })
    await owner.query(fs.readFileSync(new URL('./fixtures/operation-schema.sql', import.meta.url), 'utf8'))
    await initialiseAuthoritySchema(owner, ['sg2_operation_runtime', 'sg2_operation_reader'])
    const application = { appId: 'sg2-isolated-operation', profileId: 'SPENDGURU_SAAS', environment: 'development', deploymentId: 'isolated-existing-sg2-code', configurationVersion: 'test-v1', organisationId: null, operations: ['benchmark.selection.read', 'benchmark.selection.write'], features: ['benchmark'] }
    await seedAuthority(owner, application, ['read', 'write'].map(verb => ({ operation: `benchmark.selection.${verb}`, feature: 'benchmark', resourceId: null })))
    for (const organisationId of Object.values(O)) await putTestResource(owner, application, organisationId, { id: `benchmark-selections:${organisationId}`, type: 'benchmark_selection', dataClass: 'ORGANISATION_PRIVATE', ownerOrganisationId: organisationId, ownerUserId: null, environment: 'development', version: 'collection-definition-v1', projectionVersion: 'operation-v1' })
    writer = new PrismaClient({ datasources: { db: { url: databaseUrl('sg2_operation_runtime', true) } } })
    reader = new PrismaClient({ datasources: { db: { url: databaseUrl('sg2_operation_reader', true) } } })
    const transactionDriver = client => callback => client.$transaction(async tx => callback({ transaction: tx, query: async (sql, parameters = []) => /^\s*SELECT/i.test(sql) ? { rows: await tx.$queryRawUnsafe(sql, ...parameters) } : { rows: [], rowCount: await tx.$executeRawUnsafe(sql, ...parameters) } }), { timeout: 30_000, maxWait: 30_000 })
    const projectOutput = async (response, context) => {
      assert(response instanceof Response); const body = await response.clone().json()
      const items = Array.isArray(body.items) ? body.items : [body]
      if (!items.every(item => item.organizationId === context.organisationId)) throw Error('Unsafe organisation projection')
      return response
    }
    writerAuthority = createPostgresAuthority({ ownerUrl, runtimeUrl: databaseUrl('sg2_operation_runtime'), database: 'sg2_operation_test', role: 'sg2_operation_runtime', application, projectOutput, transactionDriver: transactionDriver(writer) })
    readerAuthority = createPostgresAuthority({ ownerUrl, runtimeUrl: databaseUrl('sg2_operation_reader'), database: 'sg2_operation_test', role: 'sg2_operation_reader', application, projectOutput, transactionDriver: transactionDriver(reader) })
    const executor = createOperationExecutor({ ...writerAuthority.options, withTransaction: (binding, callback) => (binding.request.operation.endsWith('.read') ? readerAuthority : writerAuthority).options.withTransaction(binding, callback) })
    process.env.SG_RUNTIME_DATABASE_URL = databaseUrl('sg2_operation_runtime', true)
    process.env.SG_RUNTIME_DIRECT_URL = process.env.SG_RUNTIME_DATABASE_URL
    process.env.MACROBOND_CLIENT_ID = 'isolated-test-only'; process.env.MACROBOND_CLIENT_SECRET = 'isolated-test-only'
    let providerCalls = 0
    globalThis.fetch = async input => {
      const url = String(input)
      if (url.includes('/token')) return Response.json({ access_token: 'synthetic-no-provider-access', expires_in: 3600 })
      if (url.includes('/v1/series/fetchentities')) { providerCalls++; return Response.json([{ metadata: { Description: 'Synthetic market series', Frequency: 'daily', Source: 'synthetic-source' } }]) }
      throw Error('External provider access is forbidden in this integration test')
    }
    const { createOperationBenchmarkSelectionHandlers } = await import('../lib/benchmark/operation-context.ts')
    const handlers = createOperationBenchmarkSelectionHandlers(executor)
    const candidate = { candidateId: 'synthetic-series-a', displayName: 'Synthetic market series', description: null, provider: { providerCode: 'MACROBOND', displayName: 'Synthetic fixture' }, providerSeries: { provider: { providerCode: 'MACROBOND', displayName: 'Synthetic fixture' }, providerSeriesId: 'synthetic-series-a' }, frequency: 'daily', currency: null, unit: null, source: null, region: null }
    const request = (method, organisationId = O.a, userId = U.a, payload = { candidate }, headers = {}) => new NextRequest(`http://isolated.test/api/benchmark/selection?organisationId=${organisationId}`, { method, headers: { authorization: `Bearer ${writerAuthority.issuer.issue(userId)}`, 'content-type': 'application/json', ...headers }, ...(method === 'POST' ? { body: JSON.stringify(payload) } : {}) })
    const total = async () => (await owner.query('SELECT count(*)::int AS n FROM sg_runtime_benchmarks."OrganizationBenchmarkSelection"')).rows[0].n
    const setAccess = (organisationId, userId, change) => owner.query('UPDATE operation_test.authorities SET document=jsonb_set(document,\'{access}\',(document->\'access\') || $4::jsonb) WHERE application_id=$1 AND organisation_id=$2 AND actor_id=$3', [application.appId, organisationId, userId, JSON.stringify(change)])

    await t.test('forged identity headers do not reach provider or database effect', async () => {
      const response = await handlers.POST(request('POST', O.a, U.a, { candidate }, { authorization: '', 'x-clerk-user-id': U.a, 'x-clerk-org-id': O.a, 'x-clerk-org-role': 'admin' }))
      assert.equal(response.status, 401); assert.equal(providerCalls, 0); assert.equal(await total(), 0)
    })
    await t.test('signed identity for another application/environment or expired identity is rejected by the real API', async () => {
      for (const change of [{ audience: 'foreign-app' }, { environment: 'staging' }, { expiresAt: '2020-01-01T00:00:00Z' }]) {
        const response = await handlers.GET(request('GET', O.a, U.a, null, { authorization: `Bearer ${writerAuthority.issuer.issue(U.a, change)}` }))
        assert.equal(response.status, 401)
      }
    })
    await t.test('real API persists selection and current human attribution', async () => {
      const response = await handlers.POST(request('POST', O.a, U.a, { candidate, organizationId: O.b, userId: U.b, role: 'admin' })); assert.equal(response.status, 201)
      const saved = await response.json(); assert.equal(saved.organizationId, O.a); assert(saved.selectionId)
      const rows = (await owner.query('SELECT "organizationId","createdByUserId" FROM sg_runtime_benchmarks."OrganizationBenchmarkSelection"')).rows
      assert.deepEqual(rows, [{ organizationId: O.a, createdByUserId: U.a }]); assert.equal(providerCalls, 1)
    })
    await t.test('same organisation shares selections; absent write permission is not inherited from admin label', async () => {
      await setAccess(O.a, U.b, { permissions: [{ operation: 'benchmark.selection.read', feature: 'benchmark', resourceId: null }], role: 'ORGANISATION_ADMIN' })
      const read = await handlers.GET(request('GET', O.a, U.b)); assert.equal(read.status, 200); assert.equal((await read.json()).items.length, 1)
      const before = providerCalls; assert.equal((await handlers.POST(request('POST', O.a, U.b))).status, 403); assert.equal(providerCalls, before)
    })
    await t.test('the server binds each handler to its exact operation and HTTP method', async () => {
      const response = await handlers.GET(request('POST', O.a, U.b)); assert.equal(response.status, 405); assert.equal(response.headers.get('allow'), 'GET')
      assert.equal((await handlers.POST(request('GET'))).status, 405)
    })
    await t.test('one account can belong to two organisations without merging their records', async () => {
      assert.equal((await handlers.POST(request('POST', O.b, U.a))).status, 201); assert.equal(await total(), 2)
      for (const organisationId of Object.values(O)) { const response = await handlers.GET(request('GET', organisationId)); const items = (await response.json()).items; assert.equal(items.length, 1); assert.equal(items[0].organizationId, organisationId) }
      assert.equal((await handlers.GET(request('GET', O.b, U.b))).status, 403)
    })
    await t.test('permission and product revocation are checked anew on a repeated real request', async () => {
      await setAccess(O.a, U.a, { status: 'REVOKED' }); assert.equal((await handlers.GET(request('GET'))).status, 403); await setAccess(O.a, U.a, { status: 'ACTIVE' })
      await owner.query("UPDATE operation_test.authorities SET document=jsonb_set(document,'{products,0,status}','\"EXPIRED\"') WHERE application_id=$1 AND organisation_id=$2 AND actor_id=$3", [application.appId, O.a, U.a])
      assert.equal((await handlers.GET(request('GET'))).status, 403)
      await owner.query("UPDATE operation_test.authorities SET document=jsonb_set(document,'{products,0,status}','\"ACTIVE\"') WHERE application_id=$1 AND organisation_id=$2 AND actor_id=$3", [application.appId, O.a, U.a])
    })
    await t.test('server-resolved foreign resource ownership is denied without disclosing the record', async () => {
      await owner.query("UPDATE operation_test.resources SET document=jsonb_set(document,'{ownerOrganisationId}',to_jsonb($3::text)) WHERE application_id=$1 AND organisation_id=$2", [application.appId, O.a, O.b])
      try { assert.equal((await handlers.GET(request('GET'))).status, 403) }
      finally { await owner.query("UPDATE operation_test.resources SET document=jsonb_set(document,'{ownerOrganisationId}',to_jsonb($2::text)) WHERE application_id=$1 AND organisation_id=$2", [application.appId, O.a]) }
    })
    await t.test('ordinary-role RLS, cross-organisation references and read-only business grants hold below the API', async () => {
      assert.equal((await reader.$queryRawUnsafe('SELECT * FROM sg_runtime_benchmarks."BusinessBenchmark"')).length, 0)
      const foreign = (await owner.query('SELECT id FROM sg_runtime_benchmarks."BusinessBenchmark" WHERE "organizationId"=$1', [O.b])).rows[0].id
      await assert.rejects(writer.$transaction(async tx => { await tx.$queryRawUnsafe("SELECT set_config('operation.organisation_id',$1,true)", O.a); return tx.$executeRawUnsafe('INSERT INTO sg_runtime_benchmarks."OrganizationBenchmarkSelection"(id,"organizationId","businessBenchmarkId","createdByUserId","createdAt","updatedAt") VALUES($1,$2,$3,$4,now(),now())', 'forbidden-reference', O.a, foreign, U.a) }), /row.level security/i)
      await assert.rejects(reader.$executeRawUnsafe('UPDATE sg_runtime_benchmarks."BusinessBenchmark" SET "displayName"=\'forbidden\''), /permission denied/i)
      const settings = await writer.$queryRawUnsafe("SELECT current_setting('operation.organisation_id',true) AS org,current_setting('operation.user_id',true) AS usr")
      assert(!settings[0].org); assert(!settings[0].usr)
    })
    await t.test('durable intent is mandatory and missing audit prevents metadata calls and writes', async () => {
      const before = await total(), calls = providerCalls
      await owner.query('REVOKE INSERT ON operation_test.audit FROM sg2_operation_runtime')
      try { assert.equal((await handlers.POST(request('POST'))).status, 503); assert.equal(await total(), before); assert.equal(providerCalls, calls) }
      finally { await owner.query('GRANT INSERT ON operation_test.audit TO sg2_operation_runtime') }
    })
    await t.test('outcome failure rolls back actual Prisma business writes and retains correlated failure intent', async () => {
      const before = await total()
      await owner.query("CREATE FUNCTION operation_test.reject_outcome() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event->>'phase'='OUTCOME' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_outcome BEFORE INSERT ON operation_test.audit FOR EACH ROW EXECUTE FUNCTION operation_test.reject_outcome()")
      try { const next = { ...candidate, candidateId: 'synthetic-series-b', providerSeries: { ...candidate.providerSeries, providerSeriesId: 'synthetic-series-b' } }; assert.equal((await handlers.POST(request('POST', O.a, U.a, { candidate: next }))).status, 503); assert.equal(await total(), before) }
      finally { await owner.query('DROP TRIGGER reject_outcome ON operation_test.audit; DROP FUNCTION operation_test.reject_outcome()') }
      const phases = (await owner.query("SELECT event->>'phase' AS phase,event->>'decisionId' AS id FROM operation_test.audit ORDER BY operation_test.audit.id DESC LIMIT 2")).rows
      assert.deepEqual(phases.map(p => p.phase), ['FAILURE', 'INTENT']); assert.equal(phases[0].id, phases[1].id)
    })
    await t.test('valid replay stays idempotent and runtime cannot rewrite audit or authority JSON', async () => {
      assert.equal((await handlers.POST(request('POST'))).status, 201); assert.equal(await total(), 2)
      await assert.rejects(writer.$executeRawUnsafe('DELETE FROM operation_test.audit'), /permission denied/i)
      await assert.rejects(writer.$executeRawUnsafe("UPDATE operation_test.authorities SET document='{}'::jsonb"), /permission denied/i)
      const text = JSON.stringify((await owner.query('SELECT event FROM operation_test.audit')).rows)
      assert(!text.includes('synthetic-no-provider-access')); assert(!text.includes('isolated-test-only')); assert(!text.includes('authorization'))
      for (const { event } of (await owner.query('SELECT event FROM operation_test.audit')).rows) {
        assert(Number.isFinite(Date.parse(event.occurredAt))); assert.equal(event.contractId, 'profitia.operation-context')
        if (event.decision === 'ALLOW') { assert.equal(event.productEvidence[0].sourceRef, 'SYNTHETIC_NOT_A_COMMERCIAL_GRANT'); assert.equal(event.dataClass, 'ORGANISATION_PRIVATE') }
      }
    })
  } finally {
    globalThis.fetch = previousFetch
    await Promise.all([writer?.$disconnect(), reader?.$disconnect(), writerAuthority?.close(), readerAuthority?.close()])
    await owner.end()
  }
})
