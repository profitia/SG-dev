import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import test from 'node:test'
import { PrismaClient } from '@prisma/client'
import { NextRequest } from 'next/server.js'
import { accessSchemaUrl, accessStoreSourceDigest, createAccessStore, moduleAuditSchemaUrl, moduleAuditSchemaDigest } from '@profitia/platform-contracts/access-store'
import { moduleSchemaUrl, moduleSchemaDigest } from '@profitia/platform-contracts/module-scope'
import { identitySourceDigest } from '@profitia/platform-contracts/identity-provider'
import { privateOperationHostSourceDigest } from '@profitia/platform-contracts/private-operation-host'
import { OPERATION_CONTRACT } from '@profitia/platform-contracts/operation-context'
import { assertIsolatedTestConnection } from '../../architecture-lab/src/operation-postgres-fixture.mjs'
import { createSg2PrivateBenchmarkHost, createSg2SupplierSummaryHost } from '../lib/platform/private-host.ts'
import { createOperationSupplierSummaryHandler } from '../lib/platform/supplier-summary-runtime.ts'
import { SUPPLIER_SUMMARY_HEADERS } from '../lib/platform/supplier-summary.ts'
import { executiveSummary } from '@profitia/srm-xray/executive-summary-rules'
const pg = createRequire(new URL('../../architecture-lab/package.json', import.meta.url))('pg')
const DATABASE = 'sg2_private_host_test', ROLE = 'sg2_private_host_runtime'
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222'
const U = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', V = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ISSUER = 'https://identity.fixture.test', ORIGIN = 'http://localhost:3001'
const schema = fs.readFileSync(new URL(accessSchemaUrl), 'utf8')
const digest = createHash('sha256').update(schema).digest('hex')
const moduleSql = fs.readFileSync(new URL(moduleSchemaUrl), 'utf8')
const moduleDigest = await moduleSchemaDigest()
const moduleAuditSql = fs.readFileSync(new URL(moduleAuditSchemaUrl), 'utf8')
const auditDigest = await moduleAuditSchemaDigest()
const expiry = () => new Date(Date.now() + 3600000).toISOString()

test('SG2 explicitly accepts the published optional producer fingerprints', async () => {
  assert.equal(await accessStoreSourceDigest(), 'e0d3fb3c2201816755b76546976c964791adee21a8b528c05b0adbd1af09a8ca')
  assert.equal(await identitySourceDigest(), '7db7627d36a5b0296c3620c1888a118da665682815aa19c8881d01c7cae2a0e6')
  assert.equal(await privateOperationHostSourceDigest(), 'b79ba004bfd4d8ca37209e71d81fd3619b95ef9665ebee9780c0413caccdc442')
  assert.equal(moduleDigest, 'c4ea1883af310934b1e83dfcf936ba15dfc32a3f4be206c752efe2d69a55b9ed')
  assert.equal(auditDigest, 'af296074b8b4dab2f952e1d2e0553e17d6567f480152870d151dc36c9302e6ac')
  assert.equal(digest, '356463492c3304ca11fa533f6e99f1d41628a3ab830488142c6030fb9a920ff2')
})

test('SG2 Prisma host composes the accepted access store with existing selection business code', async t => {
  const ownerUrl = assertIsolatedTestConnection(process.env.SG2_OPERATION_TEST_OWNER_URL, 'sg2_operation_test', 'architecture_test_owner')
  const root = new pg.Client({ connectionString: ownerUrl }); await root.connect()
  const dbUrl = new URL(ownerUrl); dbUrl.pathname = `/${DATABASE}`
  let owner, prisma, auditPrisma
  const previousFetch = globalThis.fetch
  try {
    if (!(await root.query('SELECT 1 FROM pg_database WHERE datname=$1', [DATABASE])).rowCount) await root.query(`CREATE DATABASE ${DATABASE}`)
    for (const [role, login] of [['profitia_access_owner', false], [ROLE, true]]) {
      if (!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role])).rowCount) {
        await root.query(`CREATE ROLE ${role} ${login ? "LOGIN PASSWORD 'isolated_ci_only'" : 'NOLOGIN'} NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`)
      }
      const flags = (await root.query('SELECT rolsuper,rolcreatedb,rolcreaterole,rolbypassrls,rolinherit,rolcanlogin FROM pg_roles WHERE rolname=$1', [role])).rows[0]
      assert.deepEqual(flags, { rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolbypassrls: false, rolinherit: false, rolcanlogin: login })
    }
    await root.query(`ALTER ROLE ${ROLE} CONNECTION LIMIT 4`)
    owner = new pg.Client({ connectionString: dbUrl.toString() }); await owner.connect()
    // Only this explicitly named, guarded LOOPBACK database may be reset.
    assert.equal((await owner.query('SELECT current_database() AS db')).rows[0].db, DATABASE)
    await owner.query('DROP SCHEMA IF EXISTS profitia_modules CASCADE; DROP SCHEMA IF EXISTS profitia_access CASCADE; DROP SCHEMA IF EXISTS sg_runtime_benchmarks CASCADE')
    await owner.query(`GRANT CREATE ON DATABASE ${DATABASE} TO profitia_access_owner`)
    await owner.query('BEGIN; SET LOCAL ROLE profitia_access_owner')
    await owner.query(schema)
    await owner.query("INSERT INTO profitia_access.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','isolated-private-project','isolated-private-branch',$2)", [digest, DATABASE])
    await owner.query("INSERT INTO profitia_access.applications(application_id,status) VALUES('spendguru','ACTIVE')")
    await owner.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES($1,'spendguru','ACTIVE')", [ROLE])
    for (const user of [U, V]) {
      await owner.query("INSERT INTO profitia_access.accounts(user_id,status) VALUES($1,'ACTIVE')", [user])
      await owner.query("INSERT INTO profitia_access.external_identities(binding_id,issuer,subject,user_id,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'ACTIVE','SYNTHETIC_ONLY',$5)", [randomUUID(), ISSUER, `external-${user}`, user, expiry()])
    }
    for (const org of [A, B]) {
      await owner.query("INSERT INTO profitia_access.organisations(organisation_id,status) VALUES($1,'ACTIVE')", [org])
      await owner.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES('spendguru',$1,'SPENDGURU',ARRAY['benchmark'],'ACTIVE','EXPLICIT_OFFER','SYNTHETIC_NOT_COMMERCIAL',$2)", [org, expiry()])
      for (const user of org === A ? [U, V] : [U]) {
        await owner.query("INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at) VALUES($1,$2,'ACTIVE','SYNTHETIC_ONLY',$3)", [org, user, expiry()])
        for (const verb of user === U ? ['read', 'write'] : ['read']) await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'spendguru',$2,$3,'ALLOW',$4,'benchmark')", [randomUUID(), org, user, `benchmark.selection.${verb}`])
      }
    }
    await owner.query(`GRANT USAGE ON SCHEMA profitia_access TO ${ROLE}; GRANT EXECUTE ON FUNCTION profitia_access.runtime_descriptor(),profitia_access.identity_binding(text,text),profitia_access.lock_access(uuid,uuid,text,text,text),profitia_access.scope_allows(text,uuid,uuid),profitia_access.append_audit(jsonb) TO ${ROLE}`)
    await owner.query(moduleSql)
    await owner.query("INSERT INTO profitia_modules.installation(schema_version,schema_digest) VALUES('1.0.0',$1)", [moduleDigest])
    await owner.query("INSERT INTO profitia_modules.application_bindings(application_id,module_id,binding_id,status,source_ref,expires_at) VALUES('spendguru','benchmark',$1,'ACTIVE','SYNTHETIC_MODULE_BINDING',$2)", [randomUUID(), expiry()])
    await owner.query(moduleAuditSql)
    await owner.query("INSERT INTO profitia_modules.audit_installation(envelope_version,schema_digest,source_ref) VALUES('1.0.0',$1,'SYNTHETIC_NOT_A_RELEASE')", [auditDigest])
    await owner.query(`GRANT USAGE ON SCHEMA profitia_modules TO ${ROLE}; GRANT EXECUTE ON FUNCTION profitia_modules.runtime_descriptor(),profitia_modules.bind_scope(text),profitia_modules.scope_allows(text,uuid,uuid),profitia_modules.audit_descriptor() TO ${ROLE}`)
    await owner.query('COMMIT')
    const prismaOwnerUrl = new URL(dbUrl); prismaOwnerUrl.searchParams.set('schema', 'sg_runtime_benchmarks')
    const businessSql = fs.readFileSync(new URL('../prisma/private-store/001-business-schema.sql', import.meta.url), 'utf8')
    const boundarySql = fs.readFileSync(new URL('../prisma/security/benchmark-private-boundaries.sql', import.meta.url), 'utf8')
    // Test the exact deployable source, under the controlled owner, atomically.
    await owner.query('BEGIN; SET LOCAL ROLE profitia_access_owner')
    try {
      await owner.query(businessSql)
      await owner.query(boundarySql)
      await owner.query("INSERT INTO sg_runtime_benchmarks.private_installation(schema_version,schema_digest,boundary_digest,source_ref) VALUES('1.0.0',$1,$2,'SYNTHETIC_NOT_A_RELEASE')", [createHash('sha256').update(businessSql).digest('hex'), createHash('sha256').update(boundarySql).digest('hex')])
      await owner.query('COMMIT')
    } catch (error) { await owner.query('ROLLBACK'); throw error }
    await owner.query(`GRANT USAGE ON SCHEMA sg_runtime_benchmarks TO ${ROLE}; GRANT SELECT,INSERT,UPDATE ON sg_runtime_benchmarks."BusinessBenchmark",sg_runtime_benchmarks."BenchmarkProviderMapping",sg_runtime_benchmarks."OrganizationBenchmarkSelection" TO ${ROLE}`)
    const runtimeUrl = new URL(prismaOwnerUrl); runtimeUrl.username = ROLE; runtimeUrl.password = 'isolated_ci_only'; runtimeUrl.searchParams.set('connection_limit', '3')
    const auditUrl = new URL(runtimeUrl); auditUrl.searchParams.set('connection_limit', '1')
    prisma = new PrismaClient({ datasources: { db: { url: runtimeUrl.toString() } } })
    auditPrisma = new PrismaClient({ datasources: { db: { url: auditUrl.toString() } } })
    const login = (await prisma.$queryRawUnsafe('SELECT current_user,session_user FROM pg_roles WHERE rolname=current_user'))[0]
    assert.equal(login.current_user, ROLE); assert.equal(login.session_user, ROLE)
    process.env.SG_RUNTIME_DATABASE_URL = runtimeUrl.toString(); process.env.SG_RUNTIME_DIRECT_URL = runtimeUrl.toString()
    process.env.MACROBOND_CLIENT_ID = 'isolated-test-only'; process.env.MACROBOND_CLIENT_SECRET = 'isolated-test-only'
    let providerCalls = 0, sdkRevoked = false, sdkIssuer = ISSUER
    // Synthetic responses at the official SDK interface, NOT a token verifier.
    // Real signature verification is covered by producer tests; live Clerk login
    // is a separate release prerequisite and is not claimed by this fixture.
    const clerk = {
      async authenticateRequest(request) {
        const user = request.headers.get('authorization')?.replace(/^Bearer external-/, '')
        const auth = { isAuthenticated: true, tokenType: 'session_token', userId: `external-${user}`, sessionId: `session-${user}`, actor: null, sessionClaims: { iss: sdkIssuer, sub: `external-${user}`, sid: `session-${user}`, azp: ORIGIN, exp: Math.floor(Date.now() / 1000) + 3600 } }
        return { status: user && [U, V].includes(user) ? 'signed-in' : 'signed-out', isAuthenticated: Boolean(user && [U, V].includes(user)), toAuth: () => auth }
      },
      sessions: { async getSession(id) { return { id, userId: id.replace('session-', 'external-'), status: sdkRevoked ? 'revoked' : 'active', expireAt: Date.now() + 3600000, abandonAt: Date.now() + 3600000, actor: null } } },
      users: { async getUser(id) { return { id, banned: false, locked: false, deprovisioned: false } } },
    }
    const configuration = { prisma, auditPrisma, clerk, application: { appId: 'spendguru', profileId: 'SPENDGURU_SAAS', environment: 'development', deploymentId: 'isolated-sg2', configurationVersion: '1', identityIssuer: ISSUER, organisationId: null, operations: ['benchmark.selection.read', 'benchmark.selection.write'], features: ['benchmark'] }, identity: { appId: 'spendguru', environment: 'development', issuer: ISSUER, authorizedParties: [ORIGIN] }, binding: { applicationId: 'spendguru', environment: 'development', projectId: 'isolated-private-project', branchId: 'isolated-private-branch', databaseName: DATABASE, role: ROLE, schemaDigest: digest } }
    configuration.module = { id: 'benchmark', schemaDigest: moduleDigest, auditSchemaDigest: auditDigest }
    const host = createSg2PrivateBenchmarkHost(configuration)
    globalThis.fetch = async input => {
      const url = String(input)
      if (url.includes('/token')) return Response.json({ access_token: 'synthetic-no-provider-access', expires_in: 3600 })
      if (url.includes('/v1/series/fetchentities')) { providerCalls++; return Response.json([{ metadata: { Description: 'Synthetic market series', Frequency: 'daily', Source: 'synthetic-source' } }]) }
      throw Error('No external provider access in this fixture')
    }
    const { createOperationBenchmarkSelectionHandlers } = await import('../lib/benchmark/operation-context.ts')
    const { createRuntimeBenchmarkSelectionHandlers } = await import('../lib/benchmark/runtime-handlers.ts')
    const handlers = createRuntimeBenchmarkSelectionHandlers(() => ({ provider: 'clerk', executor: host, defaultOrganisationId: A }))
    const candidate = { candidateId: 'private-series', displayName: 'Synthetic private candidate', description: null, provider: { providerCode: 'MACROBOND', displayName: 'Synthetic fixture' }, providerSeries: { provider: { providerCode: 'MACROBOND', displayName: 'Synthetic fixture' }, providerSeriesId: 'private-series' }, frequency: 'daily', currency: null, unit: null, source: null, region: null }
    const request = (method = 'GET', org = A, user = U, headers = {}) => new NextRequest(`${ORIGIN}/api/benchmark/selection?organisationId=${org}`, { method, headers: { authorization: `Bearer external-${user}`, 'content-type': 'application/json', ...headers }, ...(method === 'POST' ? { body: JSON.stringify({ candidate, userId: V, organizationId: B, role: 'owner' }) } : {}) })
    const count = async () => Number((await owner.query('SELECT count(*) AS n FROM sg_runtime_benchmarks."OrganizationBenchmarkSelection"')).rows[0].n)
    await t.test('forged Clerk headers never invoke a provider or write', async () => {
      assert.equal((await handlers.POST(request('POST', A, U, { authorization: '', 'x-clerk-user-id': U, 'x-clerk-org-id': A, 'x-clerk-org-role': 'admin' }))).status, 401)
      assert.equal(providerCalls, 0); assert.equal(await count(), 0)
    })
    await t.test('existing API persists through ordinary Prisma and commits matching audit OUTCOME', async () => {
      const response = await handlers.POST(request('POST')); assert.equal(response.status, 201)
      assert.equal((await response.json()).organizationId, A)
      assert.deepEqual((await owner.query('SELECT "organizationId","createdByUserId" FROM sg_runtime_benchmarks."OrganizationBenchmarkSelection"')).rows, [{ organizationId: A, createdByUserId: U }])
      const phases = (await owner.query("SELECT phase FROM profitia_access.security_events WHERE event->>'decision'='ALLOW' ORDER BY event_id")).rows.map(r => r.phase)
      assert.deepEqual(phases, ['INTENT', 'OUTCOME'])
      const events = (await owner.query("SELECT event FROM profitia_access.security_events WHERE event->>'decision'='ALLOW' ORDER BY event_id")).rows.map(row => row.event)
      assert.equal(events[0].moduleEvidence.moduleId, 'benchmark')
      assert.equal(events[0].moduleEvidence.auditSchemaDigest, auditDigest)
      assert.deepEqual(events[1].moduleEvidence, events[0].moduleEvidence)
    })
    await t.test('same organisation shares rows but a read-only member cannot write', async () => {
      const response = await handlers.GET(request('GET', A, V)); assert.equal(response.status, 200); assert.equal((await response.json()).items.length, 1)
      const calls = providerCalls; assert.equal((await handlers.POST(request('POST', A, V))).status, 403); assert.equal(providerCalls, calls)
    })
    await t.test('the actual dispatcher supplies only its server default and keeps private responses out of caches', async () => {
      const original = request('GET')
      const noSelection = new NextRequest(`${ORIGIN}/api/benchmark/selection`, { headers: original.headers })
      const response = await handlers.GET(noSelection)
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
      assert.equal(response.headers.get('Vary'), 'Cookie, Authorization')
      const data = await response.json()
      assert.equal(data.items.length, 1); assert.equal(data.items[0].organizationId, A)
    })
    await t.test('duplicate/empty caller context and a foreign dedicated-profile choice never invoke business writes', async () => {
      const calls = providerCalls, before = await count()
      const headers = request().headers
      for (const suffix of [`?organisationId=${A}&organisationId=${B}`, '?organisationId=']) {
        assert.equal((await handlers.GET(new NextRequest(`${ORIGIN}/api/benchmark/selection${suffix}`, { headers }))).status, 400)
      }
      const dedicated = createSg2PrivateBenchmarkHost({ ...configuration, application: { ...configuration.application, profileId: 'PORR_SUITE', organisationId: A } })
      const routes = createRuntimeBenchmarkSelectionHandlers(() => ({ provider: 'clerk', executor: dedicated, defaultOrganisationId: A }))
      assert.equal((await routes.POST(request('POST', B))).status, 400)
      assert.equal(providerCalls, calls); assert.equal(await count(), before)
    })
    await t.test('two organisations remain separate and foreign membership is denied', async () => {
      assert.equal((await handlers.POST(request('POST', B))).status, 201); assert.equal(await count(), 2)
      const calls = providerCalls
      assert.equal((await handlers.GET(request('GET', B, V))).status, 403)
      assert.equal(providerCalls, calls); assert.equal(await count(), 2)
      for (const org of [A, B]) { const response = await handlers.GET(request('GET', org)); assert.equal(response.status, 200); const data = await response.json(); assert.equal(data.items.length, 1); assert.equal(data.items[0].organizationId, org) }
    })
    await t.test('SDK session revocation and wrong issuer deny the next request', async () => {
      sdkRevoked = true; assert.equal((await handlers.GET(request())).status, 401); sdkRevoked = false
      sdkIssuer = 'https://foreign.fixture.test'; assert.equal((await handlers.GET(request())).status, 401); sdkIssuer = ISSUER
    })
    await t.test('concurrent transactions retain independent audit capacity within the four-connection role budget', async () => {
      const responses = await Promise.all(Array.from({ length: 6 }, () => handlers.GET(request())))
      assert.deepEqual(responses.map(response => response.status), [200, 200, 200, 200, 200, 200])
      const poolCounts = (await owner.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE usename=$1', [ROLE])).rows[0].n
      assert(poolCounts <= 4)
    })
    await t.test('new explicit DENY and product revocation are authoritative', async () => {
      const id = randomUUID()
      await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'spendguru',$2,$3,'DENY','benchmark.selection.read','benchmark')", [id, A, U])
      assert.equal((await handlers.GET(request())).status, 403)
      await owner.query('DELETE FROM profitia_access.permission_grants WHERE grant_id=$1', [id])
      await owner.query("UPDATE profitia_access.product_grants SET status='REVOKED' WHERE organisation_id=$1", [A]); assert.equal((await handlers.GET(request())).status, 403)
      await owner.query("UPDATE profitia_access.product_grants SET status='ACTIVE' WHERE organisation_id=$1", [A])
    })
    const directInput = { contractId: OPERATION_CONTRACT.id, contractVersion: OPERATION_CONTRACT.version, operation: 'benchmark.selection.write', organisationId: A, resourceId: `benchmark-selections:${A}`, payload: null, request: request() }
    await t.test('module configuration and current module access cannot silently fall back to base access', async () => {
      assert.throws(() => createSg2PrivateBenchmarkHost({ ...configuration, module: undefined }), /configuration required/)
      const calls = providerCalls
      const wrong = createSg2PrivateBenchmarkHost({ ...configuration, module: { ...configuration.module, auditSchemaDigest: 'f'.repeat(64) } })
      assert.equal((await createOperationBenchmarkSelectionHandlers(wrong).POST(request('POST'))).status, 503)
      await owner.query("UPDATE profitia_modules.application_bindings SET status='REVOKED' WHERE application_id='spendguru'")
      try { assert.equal((await handlers.POST(request('POST'))).status, 403) }
      finally { await owner.query("UPDATE profitia_modules.application_bindings SET status='ACTIVE' WHERE application_id='spendguru'") }
      assert.equal(providerCalls, calls); assert.equal(await count(), 2)
    })
    await t.test('restrictive module fence survives a legacy permissive policy and an otherwise valid base lease', async () => {
      await owner.query('CREATE POLICY synthetic_legacy_or ON sg_runtime_benchmarks."OrganizationBenchmarkSelection" USING(true) WITH CHECK(true)')
      try {
        await prisma.$transaction(async tx => {
          const query = async (sql, values = []) => ({ rows: await tx.$queryRawUnsafe(sql, ...values) })
          const store = createAccessStore({ binding: configuration.binding })
          const identityBinding = await store.resolveBinding(query, { environment: 'development', issuer: ISSUER, subject: `external-${U}` })
          await store.lockAccess(query, { actor: { kind: 'HUMAN', actorId: U, userId: U, environment: 'development', audience: 'spendguru', issuer: ISSUER, expiresAt: expiry() }, identityBinding, organisationId: A })
          assert.equal((await tx.$queryRawUnsafe('SELECT * FROM sg_runtime_benchmarks."OrganizationBenchmarkSelection"')).length, 0)
          assert.equal(await tx.$executeRawUnsafe('UPDATE sg_runtime_benchmarks."OrganizationBenchmarkSelection" SET "updatedAt"=now()'), 0)
        })
      } finally { await owner.query('DROP POLICY synthetic_legacy_or ON sg_runtime_benchmarks."OrganizationBenchmarkSelection"') }
      assert.equal((await handlers.GET(request())).status, 200)
    })
    await t.test('actual Prisma transports the dedicated expired-module SQL state without a false ALLOW', async () => {
      const event = (await owner.query("SELECT event FROM profitia_access.security_events WHERE phase='INTENT' ORDER BY event_id LIMIT 1")).rows[0].event
      const expired = { ...event, decisionId: randomUUID(), moduleEvidence: { ...event.moduleEvidence, expiresAt: new Date(Date.now() - 1000).toISOString() } }
      const before = Number((await owner.query('SELECT count(*) n FROM profitia_access.security_events')).rows[0].n)
      await assert.rejects(prisma.$executeRawUnsafe('SELECT profitia_access.append_audit($1::jsonb)', JSON.stringify(expired)), error => error.code === 'P2010' && error.meta?.code === 'PT403')
      assert.equal(Number((await owner.query('SELECT count(*) n FROM profitia_access.security_events')).rows[0].n), before)
    })
    await t.test('wrong physical branch denies before a provider call or business write', async () => {
      const wrongHost = createSg2PrivateBenchmarkHost({ ...configuration, binding: { ...configuration.binding, branchId: 'foreign-branch' } })
      const calls = providerCalls
      assert.equal((await createOperationBenchmarkSelectionHandlers(wrongHost).POST(request('POST'))).status, 503)
      assert.equal(providerCalls, calls); assert.equal(await count(), 2)
    })
    await t.test('RLS rejects a foreign organisation write inside a valid current transaction', async () => {
      let sqlRlsDenied = false
      await assert.rejects(host.execute(directInput, async (_context, tx) => {
        try { await tx.$executeRawUnsafe('INSERT INTO sg_runtime_benchmarks."BusinessBenchmark"(id,"organizationId","displayName","createdByUserId","createdAt","updatedAt") VALUES($1,$2,$3,$4,now(),now())', 'foreign-organisation', B, 'Forbidden', U) }
        catch (error) { sqlRlsDenied = error.meta?.code === '42501'; throw error }
        return Response.json({ organizationId: A })
      }))
      assert.equal(sqlRlsDenied, true)
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM sg_runtime_benchmarks."BusinessBenchmark" WHERE id=$1', ['foreign-organisation'])).rows[0].n, 0)
    })
    await t.test('composite FK rejects a foreign parent even within a valid local scope', async () => {
      const foreign = (await owner.query('SELECT id FROM sg_runtime_benchmarks."BusinessBenchmark" WHERE "organizationId"=$1', [B])).rows[0].id
      let sqlForeignKeyDenied = false
      await assert.rejects(host.execute(directInput, async (_context, tx) => {
        try { await tx.$executeRawUnsafe('INSERT INTO sg_runtime_benchmarks."OrganizationBenchmarkSelection"(id,"organizationId","businessBenchmarkId","createdByUserId","createdAt","updatedAt") VALUES($1,$2,$3,$4,now(),now())', 'foreign-reference', A, foreign, U) }
        catch (error) { sqlForeignKeyDenied = error.meta?.code === '23503'; throw error }
        return Response.json({ organizationId: A })
      }))
      assert.equal(sqlForeignKeyDenied, true)
      assert.equal(await count(), 2)
    })
    await t.test('failed OUTCOME rolls back real Prisma changes and retains independent FAILURE', async () => {
      const id = (await owner.query('SELECT id FROM sg_runtime_benchmarks."BusinessBenchmark" WHERE "organizationId"=$1', [A])).rows[0].id
      await owner.query("CREATE FUNCTION profitia_access.reject_test_outcome() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.phase='OUTCOME' THEN RAISE EXCEPTION 'synthetic outcome outage'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_test_outcome BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION profitia_access.reject_test_outcome()")
      try { await assert.rejects(host.execute(directInput, async (_context, tx) => { await tx.businessBenchmark.update({ where: { id }, data: { description: 'must roll back' } }); return Response.json({ organizationId: A }) })) }
      finally { await owner.query('DROP TRIGGER reject_test_outcome ON profitia_access.security_events; DROP FUNCTION profitia_access.reject_test_outcome()') }
      assert.equal((await owner.query('SELECT description FROM sg_runtime_benchmarks."BusinessBenchmark" WHERE id=$1', [id])).rows[0].description, null)
      const events = (await owner.query('SELECT decision_id,phase FROM profitia_access.security_events ORDER BY event_id DESC LIMIT 2')).rows
      assert.deepEqual(events.map(r => r.phase), ['FAILURE', 'INTENT']); assert.equal(events[0].decision_id, events[1].decision_id)
    })
    await t.test('Prisma total timeout rolls back writes even while the callback awaits non-SQL work', async () => {
      const shortHost = createSg2PrivateBenchmarkHost({ ...configuration, transactionTimeoutMs: 250 })
      const id = (await owner.query('SELECT id FROM sg_runtime_benchmarks."BusinessBenchmark" WHERE "organizationId"=$1', [A])).rows[0].id
      let writeCompleted = false
      await assert.rejects(shortHost.execute(directInput, async (_context, tx) => { await tx.businessBenchmark.update({ where: { id }, data: { description: 'must time out' } }); writeCompleted = true; await new Promise(resolve => setTimeout(resolve, 500)); return Response.json({ organizationId: A }) }))
      assert.equal(writeCompleted, true)
      assert.equal((await owner.query('SELECT description FROM sg_runtime_benchmarks."BusinessBenchmark" WHERE id=$1', [id])).rows[0].description, null)
      assert.equal((await handlers.GET(request())).status, 200)
    })
    await t.test('expired module after a real Prisma write rolls back with a durable access denial', async () => {
      await owner.query("UPDATE profitia_modules.application_bindings SET expires_at=clock_timestamp()+interval '1 second' WHERE application_id='spendguru'")
      const id = (await owner.query('SELECT id FROM sg_runtime_benchmarks."BusinessBenchmark" WHERE "organizationId"=$1', [A])).rows[0].id
      let written = false
      try {
        await assert.rejects(host.execute(directInput, async (_context, tx) => {
          await tx.businessBenchmark.update({ where: { id }, data: { description: 'must expire' } }); written = true
          await new Promise(resolve => setTimeout(resolve, 1200)); return Response.json({ organizationId: A })
        }), error => error.reasonCode === 'ACCESS_BASIS_INVALID')
        assert.equal(written, true)
        assert.equal((await owner.query('SELECT description FROM sg_runtime_benchmarks."BusinessBenchmark" WHERE id=$1', [id])).rows[0].description, null)
        const events = (await owner.query('SELECT event FROM profitia_access.security_events ORDER BY event_id DESC LIMIT 2')).rows.map(row => row.event)
        assert.deepEqual(events.map(event => event.phase), ['FAILURE', 'INTENT'])
        assert.equal(events[0].reasonCode, 'ACCESS_BASIS_INVALID')
        assert.deepEqual(events[0].moduleEvidence, events[1].moduleEvidence)
      } finally { await owner.query("UPDATE profitia_modules.application_bindings SET expires_at=$1 WHERE application_id='spendguru'", [expiry()]) }
    })
    await t.test('pool scope is cleared and runtime cannot read or rewrite authority/audit', async () => {
      assert.equal((await prisma.$queryRawUnsafe('SELECT * FROM sg_runtime_benchmarks."OrganizationBenchmarkSelection"')).length, 0)
      await assert.rejects(prisma.$queryRawUnsafe('SELECT * FROM profitia_access.accounts'), /permission denied/i)
      await assert.rejects(prisma.$executeRawUnsafe('DELETE FROM profitia_access.security_events'), /permission denied/i)
      const settings = (await prisma.$queryRawUnsafe("SELECT current_setting('profitia.organisation_id',true) AS org,current_setting('profitia.user_id',true) AS usr"))[0]
      assert(!settings.org); assert(!settings.usr)
    })
    await t.test('the second host really consumes the shared supplier module through its own ordinary Prisma authority', async t => {
      const nip = '0000000000', periodStart = '2025-01-01', periodEnd = '2025-12-31'
      const freshness = { retrievedAt: null, checkedAt: null, cacheExpiresAt: null, retentionUntil: null,
        freshness: 'UNKNOWN', readSource: 'STORED', lastRetrievalMethod: 'UNKNOWN' }
      const shared = () => ({ schemaVersion: '1.0', nip, entityType: 'COMPANY', financial: { status: 'PARTIAL', source: 'MGBI', freshness,
        completeness: 'PARTIAL', limitations: [], mappingVersion: 'synthetic', representationVersion: 'synthetic', sourceVersion: 'synthetic-source',
        periods: [{ from: periodStart, to: periodEnd, year: '2025', scope: 'standalone', documentRef: 'synthetic-document', facts: [{ ref: 'synthetic-fact',
          documentRef: 'synthetic-document', metricCode: 'PALA_NRFS', periodStart, periodEnd, scope: 'standalone', amount: '100', sourceAmount: '100',
          currency: 'PLN', unit: 'PLN', validation: 'VERIFIED', normalization: 'SOURCE_VALUE', normalizationRule: null, reasonCode: null }] }], history: [] },
        kys: { status: 'NOT_REQUESTED', source: 'VERCLY', freshness: { ...freshness, freshness: 'ABSENT' }, completeness: 'UNKNOWN',
          lastAttemptStatus: null, lastAttemptAt: null, limitations: ['KYS_NOT_REQUESTED'], reportAvailable: false } })
      const supplierConfiguration = { ...configuration, application: { ...configuration.application,
        configurationVersion: 'synthetic-supplier-summary', operations: ['supplier.report.read'], features: ['supplier_report'] },
        module: { ...configuration.module, id: 'supplier_report' } }
      const supplierHost = createSg2SupplierSummaryHost(supplierConfiguration)
      let peerCalls = 0, malformedPeer = false, emptyPeer = false
      const fetcher = async (input, init) => {
        peerCalls++; const url = new URL(String(input))
        assert.equal(url.origin, 'https://srm-peer.fixture.test'); assert.equal(url.pathname, '/api/xray/financial-summary')
        assert.equal(url.searchParams.get('nip'), nip); assert([A,B].includes(url.searchParams.get('organisationId')))
        assert.deepEqual(Object.keys(init.headers), ['authorization']); assert.equal(init.credentials, 'omit'); assert.equal(init.redirect, 'error')
        const body = shared()
        if (malformedPeer) body.preferenceScope = 'private-foreign-projection'
        if (emptyPeer) { body.financial.periods = []; body.financial.history = []; body.financial.sourceVersion = null; body.financial.status = 'EMPTY' }
        return Response.json(body, { headers: SUPPLIER_SUMMARY_HEADERS })
      }
      const handler = createOperationSupplierSummaryHandler(supplierHost, A, { origin: 'https://srm-peer.fixture.test', fetcher })
      const input = (organisationId = A, user = U, extra = {}) => new Request(`${ORIGIN}/api/supplier/financial-summary?nip=${nip}&organisationId=${organisationId}`, {
        headers: { authorization: `Bearer external-${user}`, Cookie: 'unrelated', 'x-clerk-user-id': V, ...extra },
      })
      const snapshot = async () => {
        const tables = (await owner.query("SELECT tablename FROM pg_tables WHERE schemaname='sg_runtime_benchmarks' ORDER BY tablename")).rows
        const result = {}
        for (const { tablename } of tables) result[tablename] = (await owner.query(`SELECT to_jsonb(t) AS row FROM sg_runtime_benchmarks."${tablename.replaceAll('"','""')}" t ORDER BY to_jsonb(t)::text`)).rows
        return result
      }
      const beforeBusiness = await snapshot()
      await t.test('an existing benchmark member has no implicit supplier grant, product or module', async () => {
        assert.equal((await handler(input())).status, 403); assert.equal(peerCalls, 0)
        for (const organisation of [A,B]) {
          await owner.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES('spendguru',$1,'SUPPLIER_INTELLIGENCE',ARRAY['supplier_report'],'ACTIVE','EXPLICIT_OFFER','SYNTHETIC_MODULE_REUSE',$2)", [organisation, expiry()])
          await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'spendguru',$2,$3,'ALLOW','supplier.report.read','supplier_report')", [randomUUID(), organisation, U])
        }
        assert.equal((await handler(input())).status, 403); assert.equal(peerCalls, 0)
        await owner.query("INSERT INTO profitia_modules.application_bindings(application_id,module_id,binding_id,status,source_ref,expires_at) VALUES('spendguru','supplier_report',$1,'ACTIVE','SYNTHETIC_MODULE_REUSE',$2)", [randomUUID(), expiry()])
      })
      await t.test('two organisations render the same authorised shared business facts and keep current module audit', async () => {
        for (const organisation of [A,B]) {
          const response = await handler(input(organisation)); assert.equal(response.status, 200)
          assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.equal(response.headers.get('vary'), 'Cookie, Authorization')
          const metadata = await response.json()
          const model = executiveSummary({ nip, entityType: 'COMPANY', metadata, scope: 'standalone', selectedPeriod: { from: periodStart, to: periodEnd }, kysStatus: 'NOT_REQUESTED', kysHasData: false })
          assert.equal(model.facts[0].id, 'revenue'); assert(model.facts[0].text.includes('100'))
          assert(!JSON.stringify(metadata).includes('organizationId')); assert(!JSON.stringify(metadata).includes('preferenceScope'))
          const events = (await owner.query("SELECT event FROM profitia_access.security_events WHERE event->>'operation'='supplier.report.read' AND event->>'decision'='ALLOW' ORDER BY event_id DESC LIMIT 2")).rows.map(row => row.event)
          assert.deepEqual(events.map(event => event.phase), ['OUTCOME','INTENT'])
          assert(events.every(event => event.applicationId === 'spendguru' && event.organisationId === organisation && event.actorId === U && event.moduleEvidence.moduleId === 'supplier_report'))
          assert.match(events[0].correlationId, /^[a-f0-9-]{36}$/); assert.match(events[0].decisionId, /^[a-f0-9-]{36}$/)
          assert.equal(events[0].correlationId, events[1].correlationId); assert.equal(events[0].moduleEvidence.transactionId, events[1].moduleEvidence.transactionId)
        }
        assert.deepEqual(await snapshot(), beforeBusiness)
      })
      await t.test('current local revocation and forged identity stop before the peer, independently of peer availability', async () => {
        const before = peerCalls
        assert.equal((await handler(input(A, U, { authorization: '' }))).status, 401)
        assert.equal((await handler(input(A, V))).status, 403)
        assert.equal((await handler(input(B, V))).status, 403)
        sdkRevoked = true; assert.equal((await handler(input())).status, 401); sdkRevoked = false
        await owner.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2", [A,U])
        try { assert.equal((await handler(input())).status, 403) } finally { await owner.query("UPDATE profitia_access.memberships SET status='ACTIVE' WHERE organisation_id=$1 AND user_id=$2", [A,U]) }
        const deny = randomUUID()
        await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'spendguru',$2,$3,'DENY','supplier.report.read','supplier_report')", [deny,A,U])
        try { assert.equal((await handler(input())).status, 403) } finally { await owner.query('DELETE FROM profitia_access.permission_grants WHERE grant_id=$1', [deny]) }
        await owner.query("UPDATE profitia_access.product_grants SET status='REVOKED' WHERE application_id='spendguru' AND product='SUPPLIER_INTELLIGENCE' AND organisation_id=$1", [A])
        try { assert.equal((await handler(input())).status, 403) } finally { await owner.query("UPDATE profitia_access.product_grants SET status='ACTIVE' WHERE application_id='spendguru' AND product='SUPPLIER_INTELLIGENCE' AND organisation_id=$1", [A]) }
        await owner.query("UPDATE profitia_modules.application_bindings SET status='REVOKED' WHERE application_id='spendguru' AND module_id='supplier_report'")
        try { assert.equal((await handler(input())).status, 403) } finally { await owner.query("UPDATE profitia_modules.application_bindings SET status='ACTIVE' WHERE application_id='spendguru' AND module_id='supplier_report'") }
        const fixed = createSg2SupplierSummaryHost({ ...supplierConfiguration, application: { ...supplierConfiguration.application, profileId: 'PORR_SUITE', organisationId: A } })
        assert.equal((await createOperationSupplierSummaryHandler(fixed, A, { origin: 'https://srm-peer.fixture.test', fetcher })(input(B))).status, 400)
        assert.equal(peerCalls, before)
      })
      await t.test('the supplier module cannot read benchmark private rows even inside its otherwise valid lease', async () => {
        const direct = { contractId: OPERATION_CONTRACT.id, contractVersion: OPERATION_CONTRACT.version, operation: 'supplier.report.read',
          organisationId: A, resourceId: `supplier-report:COMPANY:${nip}`, payload: { nip, entityType: 'COMPANY' }, request: input() }
        const result = await supplierHost.execute(direct, async (_context, transaction) => {
          assert.deepEqual(await transaction.businessBenchmark.findMany(), [])
          return Response.json(shared(), { headers: SUPPLIER_SUMMARY_HEADERS })
        })
        assert.equal(result.value.status, 200)
      })
      await t.test('peer substitution is refused, empty results stay truthful and concurrent reads retain the four-connection budget', async () => {
        malformedPeer = true
        try { const response = await handler(input()); assert.notEqual(response.status, 200); assert(!(await response.text()).includes('private-foreign-projection')) } finally { malformedPeer = false }
        emptyPeer = true
        try { const response = await handler(input()); assert.equal(response.status, 200); assert.deepEqual((await response.json()).financial.periods, []) } finally { emptyPeer = false }
        const responses = await Promise.all([A,B,A,B].map(organisation => handler(input(organisation))))
        assert(responses.every(response => response.status === 200))
        assert((await owner.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE usename=$1', [ROLE])).rows[0].n <= 4)
        assert.deepEqual(await snapshot(), beforeBusiness)
      })
      await t.test('local OUTCOME outage withholds the result and records FAILURE without pretending to roll back the peer read', async () => {
        const before = peerCalls
        await owner.query("CREATE FUNCTION profitia_access.reject_supplier_outcome() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.phase='OUTCOME' THEN RAISE EXCEPTION 'synthetic supplier audit outage'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_supplier_outcome BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION profitia_access.reject_supplier_outcome()")
        try { assert.equal((await handler(input())).status, 503) }
        finally { await owner.query('DROP TRIGGER reject_supplier_outcome ON profitia_access.security_events; DROP FUNCTION profitia_access.reject_supplier_outcome()') }
        assert.equal(peerCalls, before + 1)
        const events = (await owner.query('SELECT event FROM profitia_access.security_events ORDER BY event_id DESC LIMIT 2')).rows.map(row => row.event)
        assert.deepEqual(events.map(event => event.phase), ['FAILURE','INTENT']); assert.equal(events[0].decisionId, events[1].decisionId)
        assert.deepEqual(await snapshot(), beforeBusiness)
      })
    })
  } finally {
    globalThis.fetch = previousFetch
    await prisma?.$disconnect(); await auditPrisma?.$disconnect(); await owner?.end(); await root.end()
  }
})
