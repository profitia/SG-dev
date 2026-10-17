import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import test from 'node:test'
import pg from 'pg'
import { accessSchemaUrl, accessStoreSourceDigest } from '@profitia/platform-contracts/access-store'
import { identitySourceDigest } from '@profitia/platform-contracts/identity-provider'
import { privateOperationHostSourceDigest } from '@profitia/platform-contracts/private-operation-host'
import { OPERATION_CONTRACT } from '@profitia/platform-contracts/operation-context'
import { assertIsolatedTestConnection } from '../../architecture-lab/src/operation-postgres-fixture.mjs'
import { createSrmPrivateOperationHost } from '../src/server/private-operation-host.ts'
import { bindOrganizationTransaction, withOrganization } from '../src/server/db.ts'
const DATABASE = 'srm_private_host_test', ROLE = 'srm_private_host_runtime'
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222'
const U = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', V = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ISSUER = 'https://identity.fixture.test', ORIGIN = 'http://localhost:3400', NIP = '8650004194'
const sql = fs.readFileSync(new URL(accessSchemaUrl), 'utf8'), digest = createHash('sha256').update(sql).digest('hex')
const expiry = () => new Date(Date.now() + 3600000).toISOString()
const hash = text => createHash('sha256').update(text).digest('hex')

test('SRM accepts the published optional producer fingerprints', async () => {
  assert.equal(await accessStoreSourceDigest(), '4e56e58220815661c3882c59ec897b0d740bf84bbf0485c84fb82007d6e00e50')
  assert.equal(await identitySourceDigest(), '7db7627d36a5b0296c3620c1888a118da665682815aa19c8881d01c7cae2a0e6')
  assert.equal(await privateOperationHostSourceDigest(), 'c9ebdef2de453f10346f7e3f8268b21391f1a32a0911ef8f5441163db7aa067b')
})

test('SRM real report and pg driver use the accepted private host', async t => {
  const rootUrl = assertIsolatedTestConnection(process.env.SRM_OPERATION_TEST_OWNER_URL, 'srm_app', 'architecture_test_owner')
  const root = new pg.Client({ connectionString: rootUrl }); await root.connect()
  const dbUrl = new URL(rootUrl); dbUrl.pathname = `/${DATABASE}`
  let owner, pool, auditPool
  const previousFetch = globalThis.fetch
  globalThis.fetch = async () => { throw Error('No external providers in private host fixture') }
  try {
    if (!(await root.query('SELECT 1 FROM pg_database WHERE datname=$1', [DATABASE])).rowCount) await root.query(`CREATE DATABASE ${DATABASE}`)
    for (const [role, login] of [['profitia_access_owner', false], [ROLE, true], ['neon_superuser', false], ['srm_app_runtime', true]]) {
      if (!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role])).rowCount) await root.query(`CREATE ROLE ${role} ${login ? "LOGIN PASSWORD 'isolated_ci_only'" : 'NOLOGIN'} NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`)
    }
    const flags = (await root.query('SELECT rolsuper,rolcreatedb,rolcreaterole,rolbypassrls,rolinherit FROM pg_roles WHERE rolname=$1', [ROLE])).rows[0]
    assert.deepEqual(flags, { rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolbypassrls: false, rolinherit: false })
    await root.query(`ALTER ROLE ${ROLE} CONNECTION LIMIT 4`)
    owner = new pg.Client({ connectionString: dbUrl.toString() }); await owner.connect()
    // This reset is allowed only in the named, guarded LOOPBACK fixture.
    assert.equal((await owner.query('SELECT current_database() AS db')).rows[0].db, DATABASE)
    await owner.query('DROP SCHEMA IF EXISTS srm CASCADE; DROP SCHEMA IF EXISTS profitia_access CASCADE')
    await owner.query(`GRANT CREATE ON DATABASE ${DATABASE} TO profitia_access_owner`)
    await owner.query('BEGIN; SET LOCAL ROLE profitia_access_owner')
    await owner.query(sql)
    await owner.query("INSERT INTO profitia_access.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','isolated-private-project','isolated-private-branch',$2)", [digest, DATABASE])
    await owner.query("INSERT INTO profitia_access.applications(application_id,status) VALUES('srm','ACTIVE')")
    await owner.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES($1,'srm','ACTIVE')", [ROLE])
    for (const user of [U, V]) {
      await owner.query("INSERT INTO profitia_access.accounts(user_id,status) VALUES($1,'ACTIVE')", [user])
      await owner.query("INSERT INTO profitia_access.external_identities(binding_id,issuer,subject,user_id,status,source_ref,expires_at) VALUES($1,$2,$3,$4,'ACTIVE','SYNTHETIC_ONLY',$5)", [randomUUID(), ISSUER, `external-${user}`, user, expiry()])
    }
    for (const org of [A, B]) {
      await owner.query("INSERT INTO profitia_access.organisations(organisation_id,status) VALUES($1,'ACTIVE')", [org])
      await owner.query("INSERT INTO profitia_access.product_grants(application_id,organisation_id,product,features,status,source,source_ref,expires_at) VALUES('srm',$1,'SUPPLIER_INTELLIGENCE',ARRAY['supplier_report'],'ACTIVE','EXPLICIT_OFFER','SYNTHETIC_NOT_COMMERCIAL',$2)", [org, expiry()])
      for (const user of org === A ? [U, V] : [U]) {
        await owner.query("INSERT INTO profitia_access.memberships(organisation_id,user_id,status,source_ref,expires_at) VALUES($1,$2,'ACTIVE','SYNTHETIC_ONLY',$3)", [org, user, expiry()])
        for (const operation of ['supplier.report.read', 'supplier.report.project']) await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'srm',$2,$3,'ALLOW',$4,'supplier_report')", [randomUUID(), org, user, operation])
      }
    }
    await owner.query(`GRANT USAGE ON SCHEMA profitia_access TO ${ROLE}; GRANT EXECUTE ON FUNCTION profitia_access.runtime_descriptor(),profitia_access.identity_binding(text,text),profitia_access.lock_access(uuid,uuid,text,text,text),profitia_access.scope_allows(text,uuid,uuid),profitia_access.append_audit(jsonb) TO ${ROLE}`)
    await owner.query('COMMIT')
    const directory = new URL('../db/migrations/', import.meta.url)
    for (const file of fs.readdirSync(directory).filter(name => /^\d{4}_.+\.sql$/.test(name)).sort()) {
      const migration = fs.readFileSync(new URL(file, directory), 'utf8'); await owner.query(migration)
      await owner.query('INSERT INTO srm.schema_migrations(version,checksum_sha256) VALUES($1,$2)', [file.slice(0, -4), hash(migration)])
    }
    // Fixture-only grants reproduce existing report capabilities; this does not
    // provision a live private business schema or approve all its RLS policies.
    await owner.query(fs.readFileSync(new URL('../db/security/private-operation-boundaries.sql', import.meta.url), 'utf8'))
    await owner.query(`GRANT USAGE ON SCHEMA srm TO ${ROLE}; GRANT SELECT ON ALL TABLES IN SCHEMA srm TO ${ROLE}; GRANT INSERT,UPDATE ON srm.financial_source_documents,srm.suppliers TO ${ROLE}`)
    // PostgreSQL FOR SHARE requires an UPDATE privilege on at least one column.
    // Reserve only harmless check metadata, not the raw archived source.
    await owner.query(`GRANT UPDATE(last_checked_at) ON srm.mgbi_source_archives TO ${ROLE}`)
    // Deliberately grant one shared metadata column in the fixture so the
    // negative write test proves the RLS ceiling, not just a missing ACL.
    await owner.query(`GRANT UPDATE(updated_at) ON srm.catalog_companies TO ${ROLE}`)
    for (const [index, org] of [A, B].entries()) {
      await owner.query('INSERT INTO srm.organizations(id,slug) VALUES($1,$2)', [org, `fixture-org-${index}`])
      const requestId = (await owner.query("INSERT INTO srm.lookup_requests(organization_id,identifier_type,identifier) VALUES($1,'NIP',$2) RETURNING id", [org, NIP])).rows[0].id
      const record = { id: 'synthetic-financial-2025', identifiers: { pl_nip: NIP, pl_krs: '0000000001' }, document: { type: 'financial_statement', period_from_date: '2025-01-01', period_to_date: '2025-12-31', filing_date: '2026-01-15', is_ias_compliant: false }, content: { schema: { name: 'JednostkaInnaWZlotych', version: '1-3' }, extracted_fields: { 'Naglowek.OkresOd': '2025-01-01', 'Naglowek.OkresDo': '2025-12-31', 'Bilans.Aktywa.KwotaA': index ? '999' : '100', 'RZiS.RZiSKalk.A.KwotaA': '200' }, standardized_fields: {} } }
      const payload = JSON.stringify({ pages: [{ results: [record] }] })
      await owner.query("INSERT INTO srm.mgbi_source_archives(organization_id,nip,model,payload_json,payload_sha256,record_count,first_retrieved_at,last_checked_at,source_request_id) VALUES($1,$2,'pl-krs-rdf-record',$3::jsonb,$4,1,now(),now(),$5)", [org, NIP, payload, hash(payload), requestId])
    }
    const financial = { status: 'SUCCESS', source: { provider: 'MGBI', model: 'synthetic-fixture', recordId: 'private-not-public' }, retrievedAt: new Date().toISOString(), effectiveAt: '2025-12-31', warnings: [], catalogMappingVersion: '2026-10-07-ccc-v2', data: { qualityRule: 'FINANCIAL_QUALITY_V1', periods: [{ from: '2025-01-01', to: '2025-12-31', scope: 'standalone', documentId: 'synthetic-financial-2025:cfy', facts: [{ metricCode: 'BS_A_TA', amount: '100', currency: 'PLN', unit: 'PLN' }] }] } }
    await owner.query('INSERT INTO srm.catalog_companies(nip,financial_json,financial_sha256,financial_checked_at) VALUES($1,$2::jsonb,$3,now())', [NIP, JSON.stringify(financial), hash(JSON.stringify(financial))])
    const runtimeUrl = new URL(dbUrl); runtimeUrl.username = ROLE; runtimeUrl.password = 'isolated_ci_only'
    pool = new pg.Pool({ connectionString: runtimeUrl.toString(), max: 2 }); auditPool = new pg.Pool({ connectionString: runtimeUrl.toString(), max: 2 })
    assert.equal((await pool.query('SELECT current_user')).rows[0].current_user, ROLE)
    let revoked = false
    // SDK responses are synthetic; no live login or custom JWT verifier.
    const clerk = { async authenticateRequest(request) {
      const user = request.headers.get('authorization')?.replace(/^Bearer external-/, '')
      const auth = { isAuthenticated: true, tokenType: 'session_token', userId: `external-${user}`, sessionId: `session-${user}`, actor: null, sessionClaims: { iss: ISSUER, sub: `external-${user}`, sid: `session-${user}`, azp: ORIGIN, exp: Math.floor(Date.now() / 1000) + 3600 } }
      return { status: [U, V].includes(user) ? 'signed-in' : 'signed-out', isAuthenticated: [U, V].includes(user), toAuth: () => auth }
    }, sessions: { async getSession(id) { return { id, userId: id.replace('session-', 'external-'), status: revoked ? 'revoked' : 'active', expireAt: Date.now() + 3600000, abandonAt: Date.now() + 3600000, actor: null } } }, users: { async getUser(id) { return { id, banned: false, locked: false, deprovisioned: false } } } }
    const resourceId = `supplier-report:COMPANY:${NIP}`
    const options = { pool, auditPool, clerk, application: { appId: 'srm', profileId: 'SUPPLIER_INTELLIGENCE_STANDALONE', environment: 'development', deploymentId: 'isolated-srm', configurationVersion: '1', identityIssuer: ISSUER, organisationId: null, features: ['supplier_report'], operations: ['supplier.report.read', 'supplier.report.project'] }, identity: { appId: 'srm', environment: 'development', issuer: ISSUER, authorizedParties: [ORIGIN] }, binding: { applicationId: 'srm', environment: 'development', projectId: 'isolated-private-project', branchId: 'isolated-private-branch', databaseName: DATABASE, role: ROLE, schemaDigest: digest },
      readResources: async ({ request, scope, query }) => {
        assert.equal(request.resourceId, resourceId)
        const row = (await query('SELECT financial_sha256 FROM srm.catalog_companies WHERE nip=$1', [NIP])).rows[0]; assert(row)
        return { resource: { id: resourceId, type: 'supplier_projection', dataClass: 'ORGANISATION_PRIVATE', environment: scope.environment, ownerOrganisationId: scope.organisationId, ownerUserId: null, version: 'synthetic-scope-v1', projectionVersion: 'operation-v1' }, inputs: [{ id: `shared-report:${NIP}`, type: 'supplier_report', dataClass: 'SHARED_KNOWLEDGE', environment: scope.environment, ownerOrganisationId: null, ownerUserId: null, version: row.financial_sha256, projectionVersion: 'operation-v1', approvedSharedProjection: true }] }
      },
      projectOutput: async (response, context) => {
        assert(response instanceof Response); const body = await response.clone().json(); assert.equal(body.nip, NIP)
        assert([A, B].includes(context.organisationId))
        const encoded = JSON.stringify(body)
        for (const value of ['payload_json', 'private-not-public', 'source_organization_id', 'sourceSnapshotId']) assert(!encoded.includes(value))
        return response
      },
    }
    const host = createSrmPrivateOperationHost(options)
    const { createOperationReportDataHandler } = await import('../src/server/operation-report-data.ts')
    const handler = createOperationReportDataHandler(host, { SRM_DEMO_SESSION_SECRET: 'isolated-preference-key-not-a-customer-secret' })
    const request = (org = A, user = U, headers = {}) => new Request(`${ORIGIN}/api/xray/report-data?organisationId=${org}`, { method: 'POST', headers: { authorization: `Bearer external-${user}`, 'content-type': 'application/json', ...headers }, body: JSON.stringify({ nip: NIP, entityType: 'COMPANY', organisationId: B, role: 'owner' }) })
    const documents = async () => (await owner.query('SELECT organization_id,document_json FROM srm.financial_source_documents ORDER BY organization_id')).rows
    const input = { contractId: OPERATION_CONTRACT.id, contractVersion: OPERATION_CONTRACT.version, operation: 'supplier.report.project', organisationId: A, resourceId, payload: { nip: NIP, entityType: 'COMPANY' }, request: request() }
    await t.test('forged headers do not restore documents', async () => {
      assert.equal((await handler(request(A, U, { authorization: '', 'x-clerk-user-id': U, 'x-clerk-org-id': A, 'x-clerk-org-role': 'admin' }))).status, 401)
      assert.equal((await documents()).length, 0)
    })
    await t.test('real report restores its private archive in the same access/audit transaction', async () => {
      const response = await handler(request()); assert.equal(response.status, 200); assert.equal((await response.json()).financial.periods[0].facts[0].amount, '100')
      const rows = await documents(); assert.equal(rows.length, 1); assert.equal(rows[0].organization_id, A)
      assert.equal(rows[0].document_json.rows[0].amounts.KwotaA, '100')
      assert.deepEqual((await owner.query("SELECT phase FROM profitia_access.security_events WHERE event->>'decision'='ALLOW' ORDER BY event_id")).rows.map(row => row.phase), ['INTENT', 'OUTCOME'])
    })
    await t.test('another organisation retains its distinct archive and personal scopes remain distinct', async () => {
      assert.equal((await handler(request(B))).status, 200)
      const rows = await documents(); assert.equal(rows.length, 2); assert.equal(rows[1].document_json.rows[0].amounts.KwotaA, '999')
      assert.equal((await handler(request(B, V))).status, 503) // accepted generic missing-membership denial
      const first = await (await handler(request(A, U))).json(), second = await (await handler(request(A, V))).json()
      assert.notEqual(first.preferenceScope, second.preferenceScope)
    })
    await t.test('current SDK revocation and product revocation deny', async () => {
      revoked = true; assert.equal((await handler(request())).status, 401); revoked = false
      await owner.query("UPDATE profitia_access.product_grants SET status='REVOKED' WHERE organisation_id=$1", [A]); assert.equal((await handler(request())).status, 403)
      await owner.query("UPDATE profitia_access.product_grants SET status='ACTIVE' WHERE organisation_id=$1", [A])
    })
    await t.test('OUTCOME failure rolls back actual archive restoration', async () => {
      await owner.query('DELETE FROM srm.financial_source_documents WHERE organization_id=$1', [A])
      await owner.query("CREATE FUNCTION profitia_access.reject_test_outcome() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.phase='OUTCOME' THEN RAISE EXCEPTION 'synthetic outage'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_test_outcome BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION profitia_access.reject_test_outcome()")
      try { assert.equal((await handler(request())).status, 503); assert.equal((await documents()).filter(row => row.organization_id === A).length, 0) }
      finally { await owner.query('DROP TRIGGER reject_test_outcome ON profitia_access.security_events; DROP FUNCTION profitia_access.reject_test_outcome()') }
      const events = (await owner.query('SELECT phase,decision_id FROM profitia_access.security_events ORDER BY event_id DESC LIMIT 2')).rows
      assert.deepEqual(events.map(row => row.phase), ['FAILURE', 'INTENT']); assert.equal(events[0].decision_id, events[1].decision_id)
      assert.equal((await handler(request())).status, 200)
    })
    await t.test('total timeout closes the backend and rolls back before callback completes', async () => {
      const short = createSrmPrivateOperationHost({ ...options, transactionTimeoutMs: 250 })
      let insertedId
      await assert.rejects(short.execute(input, async (context, client) => {
        await client.query("SELECT set_config('srm.organization_id',$1,true)", [context.organisationId])
        insertedId = (await client.query("INSERT INTO srm.suppliers(organization_id,nip,display_name) VALUES($1,$2,'Must roll back') RETURNING id", [A, NIP])).rows[0].id
        await new Promise(resolve => setTimeout(resolve, 500)); return Response.json({ nip: NIP })
      }))
      assert(insertedId)
      assert.equal((await handler(request())).status, 200)
      await new Promise(resolve => setTimeout(resolve, 300))
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM srm.suppliers WHERE id=$1', [insertedId])).rows[0].n, 0)
    })
    await t.test('connection acquisition timeout destroys a late lease and pool recovers', async () => {
      const held = await Promise.all([pool.connect(), pool.connect()])
      try { const short = createSrmPrivateOperationHost({ ...options, transactionTimeoutMs: 100 }); await assert.rejects(short.execute(input, async () => Response.json({ nip: NIP }))) }
      finally { for (const client of held) client.release() }
      await new Promise(resolve => setTimeout(resolve, 30))
      assert.equal((await handler(request())).status, 200)
    })
    await t.test('a manually bound private transaction without an accepted scope is rejected', async () => {
      const client = await pool.connect()
      try { await client.query('BEGIN'); await client.query("SELECT set_config('srm.organization_id',$1,true)", [A]); await assert.rejects(withOrganization(A, async () => null, bindOrganizationTransaction(A, client)), /private transaction scope/i) }
      finally { await client.query('ROLLBACK'); client.release() }
    })
    await t.test('legacy GUC alone cannot read private rows through old permissive policies', async () => {
      const client = await pool.connect()
      try {
        await client.query('BEGIN'); await client.query("SELECT set_config('srm.organization_id',$1,true)", [A])
        assert.equal((await client.query('SELECT * FROM srm.financial_source_documents')).rowCount, 0)
      } finally { await client.query('ROLLBACK'); client.release() }
    })
    await t.test('a conflicting legacy organisation cannot widen an admitted scope', async () => {
      await host.execute(input, async (_context, client) => {
        await client.query("SELECT set_config('srm.organization_id',$1,true)", [B])
        const rows = (await client.query('SELECT organization_id FROM srm.financial_source_documents')).rows
        assert(rows.length > 0); assert(rows.every(row => row.organization_id === A))
        return Response.json({ nip: NIP })
      })
      let denied = false
      await assert.rejects(host.execute(input, async (_context, client) => {
        await client.query("SELECT set_config('srm.organization_id',$1,true)", [B])
        try { await client.query("INSERT INTO srm.suppliers(organization_id,nip,display_name) VALUES($1,$2,'Forbidden')", [B, NIP]) }
        catch (error) { denied = error.code === '42501'; throw error }
        return Response.json({ nip: NIP })
      }))
      assert.equal(denied, true)
    })
    await t.test('an accidental shared write ACL does not bypass the human write ceiling', async () => {
      const before = (await owner.query('SELECT updated_at FROM srm.catalog_companies WHERE nip=$1', [NIP])).rows[0].updated_at.toISOString()
      await host.execute(input, async (context, client) => {
        await client.query("SELECT set_config('srm.organization_id',$1,true)", [context.organisationId])
        assert.equal((await client.query('UPDATE srm.catalog_companies SET updated_at=now() WHERE nip=$1', [NIP])).rowCount, 0)
        return Response.json({ nip: NIP })
      })
      assert.equal((await owner.query('SELECT updated_at FROM srm.catalog_companies WHERE nip=$1', [NIP])).rows[0].updated_at.toISOString(), before)
    })
    await t.test('independent audit pool supports concurrent report operations and leaves no scope', async () => {
      const responses = await Promise.all(Array.from({ length: 6 }, () => handler(request())))
      assert.deepEqual(responses.map(response => response.status), [200, 200, 200, 200, 200, 200])
      const client = await pool.connect()
      try { assert.equal((await client.query('SELECT * FROM srm.financial_source_documents')).rowCount, 0); await assert.rejects(client.query('SELECT * FROM profitia_access.accounts'), /permission denied/) }
      finally { client.release() }
    })
  } finally { globalThis.fetch = previousFetch; await pool?.end(); await auditPool?.end(); await owner?.end(); await root.end() }
})
