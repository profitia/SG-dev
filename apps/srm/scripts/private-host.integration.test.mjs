import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import test from 'node:test'
import pg from 'pg'
import ExcelJS from 'exceljs'
import { accessSchemaUrl, accessStoreSourceDigest, createAccessStore, moduleAuditSchemaUrl, moduleAuditSchemaDigest } from '@profitia/platform-contracts/access-store'
import { moduleSchemaUrl, moduleSchemaDigest } from '@profitia/platform-contracts/module-scope'
import { identitySourceDigest } from '@profitia/platform-contracts/identity-provider'
import { privateOperationHostSourceDigest } from '@profitia/platform-contracts/private-operation-host'
import { OPERATION_CONTRACT } from '@profitia/platform-contracts/operation-context'
import { assertIsolatedTestConnection } from '../../architecture-lab/src/operation-postgres-fixture.mjs'
import { privateBusinessPlan } from '../db/private-store/initialize.mjs'
import { migrationManifest } from './staging-migrate.mjs'
import { createSrmReportOperationHost } from '../src/server/private-runtime.ts'
import { createRuntimeSrmReportHandler } from '../src/server/report-runtime.ts'
import { createRuntimeSrmFinancialExcelHandler } from '../src/server/financial-excel-runtime.ts'
import { createRuntimeSharedFinancialHandler } from '../src/server/shared-financial-runtime.ts'
import { readSharedFinancialReport } from '../src/server/shared-financial-read.ts'
import { middleware } from '../middleware.ts'
import { NextRequest } from 'next/server.js'
import { createSrmPrivateOperationHost } from '../src/server/private-operation-host.ts'
import { bindOrganizationTransaction, withOrganization } from '../src/server/db.ts'
const DATABASE = 'srm_private_host_test', ROLE = 'srm_private_host_runtime'
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222'
const U = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', V = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ISSUER = 'https://identity.fixture.test', ORIGIN = 'http://localhost:3400', NIP = '8650004194'
const sql = fs.readFileSync(new URL(accessSchemaUrl), 'utf8'), digest = createHash('sha256').update(sql).digest('hex')
const moduleSql = fs.readFileSync(new URL(moduleSchemaUrl), 'utf8'), moduleDigest = await moduleSchemaDigest()
const moduleAuditSql = fs.readFileSync(new URL(moduleAuditSchemaUrl), 'utf8'), auditDigest = await moduleAuditSchemaDigest()
const expiry = () => new Date(Date.now() + 3600000).toISOString()
const hash = text => createHash('sha256').update(text).digest('hex')

test('SRM accepts the published optional producer fingerprints', async () => {
  assert.equal(await accessStoreSourceDigest(), 'e0d3fb3c2201816755b76546976c964791adee21a8b528c05b0adbd1af09a8ca')
  assert.equal(await identitySourceDigest(), '7db7627d36a5b0296c3620c1888a118da665682815aa19c8881d01c7cae2a0e6')
  assert.equal(await privateOperationHostSourceDigest(), 'b79ba004bfd4d8ca37209e71d81fd3619b95ef9665ebee9780c0413caccdc442')
  assert.equal(moduleDigest, 'c4ea1883af310934b1e83dfcf936ba15dfc32a3f4be206c752efe2d69a55b9ed')
  assert.equal(auditDigest, 'af296074b8b4dab2f952e1d2e0553e17d6567f480152870d151dc36c9302e6ac')
})

test('SRM real report and pg driver use the accepted private host', async t => {
  const rootUrl = assertIsolatedTestConnection(process.env.SRM_OPERATION_TEST_OWNER_URL, 'srm_app', 'architecture_test_owner')
  const root = new pg.Client({ connectionString: rootUrl }); await root.connect()
  const dbUrl = new URL(rootUrl); dbUrl.pathname = `/${DATABASE}`
  let owner, pool, auditPool
  const previousProvider = process.env.PROFITIA_AUTH_PROVIDER
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
    await owner.query('DROP SCHEMA IF EXISTS srm CASCADE; DROP SCHEMA IF EXISTS profitia_modules CASCADE; DROP SCHEMA IF EXISTS profitia_access CASCADE')
    await owner.query(`GRANT CREATE ON DATABASE ${DATABASE} TO profitia_access_owner`)
    await owner.query('BEGIN; SET LOCAL ROLE profitia_access_owner')
    await owner.query(sql)
    await owner.query("INSERT INTO profitia_access.installation(schema_version,schema_digest,environment,project_id,branch_id,database_name) VALUES('1.0.0',$1,'development','isolated-private-project','isolated-private-branch',$2)", [digest, DATABASE])
    await owner.query("INSERT INTO profitia_access.applications(application_id,status) VALUES('srm','DISABLED')")
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
    await owner.query(moduleSql)
    await owner.query("INSERT INTO profitia_modules.installation(schema_version,schema_digest) VALUES('1.0.0',$1)", [moduleDigest])
    await owner.query("INSERT INTO profitia_modules.application_bindings(application_id,module_id,binding_id,status,source_ref,expires_at) VALUES('srm','supplier_report',$1,'ACTIVE','SYNTHETIC_MODULE_BINDING',$2)", [randomUUID(), expiry()])
    await owner.query(moduleAuditSql)
    await owner.query("INSERT INTO profitia_modules.audit_installation(envelope_version,schema_digest,source_ref) VALUES('1.0.0',$1,'SYNTHETIC_NOT_A_RELEASE')", [auditDigest])
    await owner.query(`GRANT USAGE ON SCHEMA profitia_modules TO ${ROLE}; GRANT EXECUTE ON FUNCTION profitia_modules.runtime_descriptor(),profitia_modules.bind_scope(text),profitia_modules.scope_allows(text,uuid,uuid),profitia_modules.audit_descriptor() TO ${ROLE}`)
    await owner.query('COMMIT')
    await owner.query(`REVOKE CREATE ON DATABASE ${DATABASE} FROM profitia_access_owner`)
    // Database ACLs are isolated to this named fixture; the legacy LOGIN role
    // is deliberately preserved for the sibling legacy srm_app test database.
    await owner.query(`REVOKE ALL ON DATABASE ${DATABASE} FROM PUBLIC,srm_app_runtime`)
    await owner.query(`GRANT CONNECT ON DATABASE ${DATABASE} TO ${ROLE}`)
    const legacyFlags = (await owner.query("SELECT rolcanlogin,rolinherit FROM pg_roles WHERE rolname='srm_app_runtime'")).rows[0]
    const binding = { environment: 'development', projectId: 'isolated-private-project',
      branchId: 'isolated-private-branch', databaseName: DATABASE, role: ROLE }
    const plan = privateBusinessPlan({ binding, sourceSha: 'a'.repeat(40) })
    const apply = async (statements = plan.sql, setup) => {
      await owner.query('BEGIN')
      try {
        if (setup) await setup()
        for (const statement of statements) await owner.query(statement)
        await owner.query('COMMIT')
      } catch (error) { await owner.query('ROLLBACK'); throw error }
    }
    const absent = async () => {
      assert.equal((await owner.query("SELECT to_regnamespace('srm') AS schema")).rows[0].schema, null)
      assert.equal((await owner.query("SELECT has_database_privilege('profitia_access_owner',current_database(),'CREATE') AS allowed")).rows[0].allowed, false)
      assert.equal((await owner.query('SELECT count(*)::int n FROM profitia_access.accounts')).rows[0].n, 2)
    }
    await t.test('initializer rejects mismatched physical binding and preserves the directory', async () => {
      const wrong = privateBusinessPlan({ binding: { ...binding, branchId: 'wrong-branch' }, sourceSha: 'a'.repeat(40) })
      await assert.rejects(apply(wrong.sql), /physical control/); await absent()
    })
    await t.test('initializer rejects active application, legacy CONNECT and unsafe default ACL', async () => {
      for (const [setup, message] of [
        [() => owner.query("UPDATE profitia_access.applications SET status='ACTIVE' WHERE application_id='srm'"), /Disabled applications/],
        [() => owner.query(`GRANT CONNECT ON DATABASE ${DATABASE} TO srm_app_runtime`), /legacy policy/],
        [() => owner.query(`ALTER DEFAULT PRIVILEGES FOR ROLE profitia_access_owner GRANT SELECT ON TABLES TO ${ROLE}`), /default ACL/],
      ]) { await assert.rejects(apply(plan.sql, setup), message); await absent() }
    })
    await t.test('initializer rejects an existing namespace without adopting or erasing it', async () => {
      await owner.query('CREATE SCHEMA srm; CREATE TABLE srm.sentinel(id int); INSERT INTO srm.sentinel VALUES(17)')
      await assert.rejects(apply(), /already exists/)
      assert.equal((await owner.query('SELECT id FROM srm.sentinel')).rows[0].id, 17)
      // Remove only this committed sentinel in the guarded loopback fixture.
      await owner.query('DROP SCHEMA srm CASCADE'); await absent()
    })
    await t.test('failure after the complete plan rolls back schema, grants, receipt and temporary CREATE', async () => {
      await assert.rejects(apply([...plan.sql, 'SELECT 1/0']), /division by zero/); await absent()
    })
    await apply()
    await t.test('exact canonical ledger, all 22 controlled FORCE RLS tables and bounded ACLs', async () => {
      const ledger = (await owner.query('SELECT version,checksum_sha256 FROM srm.schema_migrations ORDER BY version')).rows
      assert.deepEqual(ledger, migrationManifest().slice(0, 18).map(m => ({ version: m.version, checksum_sha256: m.checksum })))
      const tables = (await owner.query("SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relowner::regrole::text AS owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='srm' AND c.relkind='r' ORDER BY c.relname")).rows
      assert.deepEqual(tables.map(t => t.relname), [...plan.expectedTables].sort())
      assert(tables.every(t => t.relrowsecurity && t.relforcerowsecurity && t.owner === 'profitia_access_owner'))
      assert.deepEqual((await owner.query("SELECT rolcanlogin,rolinherit FROM pg_roles WHERE rolname='srm_app_runtime'")).rows[0], legacyFlags)
      assert.equal((await owner.query("SELECT has_database_privilege('srm_app_runtime',current_database(),'CONNECT') AS allowed")).rows[0].allowed, false)
      assert.equal((await owner.query('SELECT schema_digest FROM srm.private_installation')).rows[0].schema_digest, plan.schemaDigest)
      for (const table of ['schema_migrations', 'private_installation', 'users', 'supplier_web_identity']) assert.equal((await owner.query(`SELECT has_table_privilege($1,$2,'SELECT') allowed`, [ROLE, `srm.${table}`])).rows[0].allowed, false)
      assert.equal((await owner.query("SELECT has_any_column_privilege($1,'srm.catalog_companies','UPDATE') allowed", [ROLE])).rows[0].allowed, false)
      await assert.rejects(apply(), /already exists/)
      assert.equal((await owner.query('SELECT count(*)::int n FROM srm.schema_migrations')).rows[0].n, 18)
    })
    // Activation belongs only to this synthetic fixture, after checked schema
    // initialization. The source candidate never activates a live application.
    await owner.query("UPDATE profitia_access.applications SET status='ACTIVE' WHERE application_id='srm'")
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
    await owner.query("INSERT INTO srm.catalog_kys_reports(nip,entity_type) VALUES($1,'COMPANY')", [NIP])
    const runtimeUrl = new URL(dbUrl); runtimeUrl.username = ROLE; runtimeUrl.password = 'isolated_ci_only'
    pool = new pg.Pool({ connectionString: runtimeUrl.toString(), max: 3 }); auditPool = new pg.Pool({ connectionString: runtimeUrl.toString(), max: 1 })
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
    options.module = { id: 'supplier_report', schemaDigest: moduleDigest, auditSchemaDigest: auditDigest }
    const host = createSrmPrivateOperationHost(options)
    const { createOperationReportDataHandler } = await import('../src/server/operation-report-data.ts')
    const { readResources: _readResources, projectOutput: _projectOutput, ...reportOptions } = options
    const reportHost = createSrmReportOperationHost(reportOptions)
    const reportEnvironment = { SRM_DEMO_SESSION_SECRET: 'isolated-preference-key-not-a-customer-secret' }
    const dispatch = createRuntimeSrmReportHandler(() => ({ provider: 'clerk', executor: reportHost, defaultOrganisationId: A }),
      async () => { throw Error('No demo fallback in private report fixture') }, reportEnvironment)
    process.env.PROFITIA_AUTH_PROVIDER = 'clerk'
    const handler = async request => {
      const response = await middleware(new NextRequest(request.clone()))
      assert.equal(response.headers.get('x-middleware-next'), '1')
      return dispatch(request)
    }
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
      const events = (await owner.query("SELECT event FROM profitia_access.security_events WHERE event->>'decision'='ALLOW' ORDER BY event_id")).rows.map(row => row.event)
      assert.equal(events[0].moduleEvidence.moduleId, 'supplier_report')
      assert.equal(events[0].moduleEvidence.auditSchemaDigest, auditDigest)
      assert.deepEqual(events[1].moduleEvidence, events[0].moduleEvidence)
    })
    await t.test('another organisation retains its distinct archive and personal scopes remain distinct', async () => {
      assert.equal((await handler(request(B))).status, 200)
      const rows = await documents(); assert.equal(rows.length, 2); assert.equal(rows[1].document_json.rows[0].amounts.KwotaA, '999')
      assert.equal((await handler(request(B, V))).status, 403)
      const first = await (await handler(request(A, U))).json(), second = await (await handler(request(A, V))).json()
      assert.notEqual(first.preferenceScope, second.preferenceScope)
    })
    await t.test('server default and malformed duplicate contexts use the same deployed dispatcher', async () => {
      const base = request(), url = new URL(base.url); url.searchParams.delete('organisationId')
      const response = await handler(new Request(url, base)); assert.equal(response.status, 200)
      assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
      assert.equal(response.headers.get('Vary'), 'Cookie, Authorization')
      for (const query of [`?organisationId=${A}&organisationId=${B}`, '?organisationId=', '?organisationId=demo']) {
        const r = request(); assert.equal((await handler(new Request(ORIGIN + '/api/xray/report-data' + query, r))).status, 400)
      }
    })
    await t.test('the dedicated profile refuses a foreign organisation despite its valid membership', async () => {
      const dedicated = createSrmReportOperationHost({ ...reportOptions, application: { ...reportOptions.application, profileId: 'PORR_SUITE', organisationId: A } })
      const route = createRuntimeSrmReportHandler(() => ({ provider: 'clerk', executor: dedicated, defaultOrganisationId: A }), undefined, reportEnvironment)
      const before = (await owner.query("SELECT count(*)::int n FROM profitia_access.security_events WHERE phase='OUTCOME'")).rows[0].n
      // The accepted fixed-profile contract classifies this as CONTEXT_INVALID.
      assert.equal((await route(request(B))).status, 400)
      assert.equal((await owner.query("SELECT count(*)::int n FROM profitia_access.security_events WHERE phase='OUTCOME'")).rows[0].n, before)
      assert.equal((await route(request(A))).status, 200)
    })
    await t.test('an admitted empty stored-knowledge view returns explicit absence without a provider call', async () => {
      const base = request()
      const response = await handler(new Request(base.url, { method: 'POST', headers: base.headers,
        body: JSON.stringify({ nip: '0000000000', entityType: 'COMPANY' }) }))
      assert.equal(response.status, 200)
      const body = await response.json(); assert.equal(body.nip, '0000000000')
      assert.equal(body.financial.status, 'NOT_REQUESTED'); assert.deepEqual(body.financial.periods, [])
    })
    await t.test('the actual report output fence refuses mismatched supplier or an unexpected raw root field', async () => {
      const body = await (await handler(request())).json()
      for (const wrong of [{ ...body, nip: '0123456789' }, { ...body, payload_json: { synthetic: 'must-not-leave' } }]) {
        await assert.rejects(reportHost.execute(input, async () => Response.json(wrong)), error => error.reasonCode === 'RESOURCE_SCOPE_MISMATCH')
      }
    })
    await t.test('current SDK revocation and product revocation deny', async () => {
      revoked = true; assert.equal((await handler(request())).status, 401); revoked = false
      await owner.query("UPDATE profitia_access.product_grants SET status='REVOKED' WHERE organisation_id=$1", [A]); assert.equal((await handler(request())).status, 403)
      await owner.query("UPDATE profitia_access.product_grants SET status='ACTIVE' WHERE organisation_id=$1", [A])
    })
    await t.test('missing or revoked module cannot use otherwise valid product access', async () => {
      assert.throws(() => createSrmPrivateOperationHost({ ...options, module: undefined }), /explicit consistent/i)
      const wrong = createSrmPrivateOperationHost({ ...options, module: { ...options.module, auditSchemaDigest: 'f'.repeat(64) } })
      assert.equal((await createOperationReportDataHandler(wrong, { SRM_DEMO_SESSION_SECRET: 'isolated-preference-key-not-a-customer-secret' })(request())).status, 503)
      await owner.query("UPDATE profitia_modules.application_bindings SET status='REVOKED' WHERE application_id='srm'")
      try { assert.equal((await handler(request())).status, 403) }
      finally { await owner.query("UPDATE profitia_modules.application_bindings SET status='ACTIVE' WHERE application_id='srm'") }
    })
    await t.test('base-only lease and the legacy organisation setting cannot bypass the module fence', async () => {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const query = async (sql, values = []) => ({ rows: (await client.query(sql, values)).rows })
        const store = createAccessStore({ binding: options.binding })
        const identityBinding = await store.resolveBinding(query, { environment: 'development', issuer: ISSUER, subject: `external-${U}` })
        await store.lockAccess(query, { actor: { kind: 'HUMAN', actorId: U, userId: U, environment: 'development', audience: 'srm', issuer: ISSUER, expiresAt: expiry() }, identityBinding, organisationId: A })
        await client.query("SELECT set_config('srm.organization_id',$1,true)", [A])
        assert.equal((await client.query('SELECT * FROM srm.financial_source_documents')).rowCount, 0)
        assert.equal((await client.query('SELECT * FROM srm.catalog_companies')).rowCount, 0)
      } finally { await client.query('ROLLBACK'); client.release() }
      assert.equal((await handler(request())).status, 200)
    })
    await t.test('native pg preserves the dedicated module expiry state and records no false ALLOW', async () => {
      const event = (await owner.query("SELECT event FROM profitia_access.security_events WHERE phase='INTENT' ORDER BY event_id LIMIT 1")).rows[0].event
      const expired = { ...event, decisionId: randomUUID(), moduleEvidence: { ...event.moduleEvidence, expiresAt: new Date(Date.now() - 1000).toISOString() } }
      await assert.rejects(pool.query('SELECT profitia_access.append_audit($1::jsonb)', [JSON.stringify(expired)]), error => error.code === 'PT403')
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
      const held = await Promise.all([pool.connect(), pool.connect(), pool.connect()])
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
    await t.test('unadopted KYS stays row-closed even with a valid module and accidental permissive policy', async () => {
      assert.equal((await owner.query('SELECT count(*)::int n FROM srm.catalog_kys_reports')).rows[0].n, 1)
      await owner.query('CREATE POLICY synthetic_accidental_kys_admission ON srm.catalog_kys_reports FOR SELECT USING(true)')
      try {
        await host.execute(input, async (_context, client) => {
          assert.equal((await client.query('SELECT * FROM srm.catalog_kys_reports')).rowCount, 0)
          return Response.json({ nip: NIP })
        })
      } finally { await owner.query('DROP POLICY synthetic_accidental_kys_admission ON srm.catalog_kys_reports') }
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
    await t.test('expiry after an actual report-side write rolls back and keeps matching failure evidence', async () => {
      await owner.query("UPDATE profitia_modules.application_bindings SET expires_at=clock_timestamp()+interval '1 second' WHERE application_id='srm'")
      let id
      try {
        await assert.rejects(host.execute(input, async (context, client) => {
          await client.query("SELECT set_config('srm.organization_id',$1,true)", [context.organisationId])
          id = (await client.query("INSERT INTO srm.suppliers(organization_id,nip,display_name) VALUES($1,$2,'Must expire') RETURNING id", [A, NIP])).rows[0].id
          await new Promise(resolve => setTimeout(resolve, 1200)); return Response.json({ nip: NIP })
        }), error => error.reasonCode === 'ACCESS_BASIS_INVALID')
        assert(id)
        assert.equal((await owner.query('SELECT count(*)::int n FROM srm.suppliers WHERE id=$1', [id])).rows[0].n, 0)
        const events = (await owner.query('SELECT event FROM profitia_access.security_events ORDER BY event_id DESC LIMIT 2')).rows.map(row => row.event)
        assert.deepEqual(events.map(event => event.phase), ['FAILURE', 'INTENT'])
        assert.equal(events[0].reasonCode, 'ACCESS_BASIS_INVALID')
        assert.deepEqual(events[0].moduleEvidence, events[1].moduleEvidence)
      } finally { await owner.query("UPDATE profitia_modules.application_bindings SET expires_at=$1 WHERE application_id='srm'", [expiry()]) }
    })
    const exportOptions = { ...reportOptions, application: { ...reportOptions.application, operations: ['supplier.report.read','supplier.report.project','supplier.report.export'] } }
    const exportHost = createSrmReportOperationHost(exportOptions)
    const exportDispatch = createRuntimeSrmFinancialExcelHandler(() => ({ provider:'clerk',executor:exportHost,defaultOrganisationId:A }), async () => { throw Error('No export demo fallback') })
    const exportRequest = (org = A, user = U, selection = {}, headers = {}) => new Request(`${ORIGIN}/api/xray/financial-excel?organisationId=${org}`, { method:'POST',
      headers:{ authorization:`Bearer external-${user}`,'content-type':'application/json',origin:ORIGIN,...headers },
      body:JSON.stringify({nip:NIP,scope:'standalone',years:['2025'],...selection}) })
    const exportHandler = async request => {
      const next = await middleware(new NextRequest(request.clone()))
      assert.equal(next.headers.get('x-middleware-next'),'1')
      return exportDispatch(request)
    }
    const exportEvents = async after => (await owner.query("SELECT event FROM profitia_access.security_events WHERE event_id>$1 ORDER BY event_id",[after])).rows.map(row=>row.event)
    const lastEvent = async () => (await owner.query('SELECT coalesce(max(event_id),0)::text id FROM profitia_access.security_events')).rows[0].id
    await t.test('actual alternate export refuses missing export permission, forged identity and foreign origin before restoration',async()=>{
      await owner.query('DELETE FROM srm.financial_source_documents WHERE organization_id=$1',[A])
      assert.equal((await exportHandler(exportRequest())).status,403)
      assert.equal((await exportHandler(exportRequest(A,U,{}, {authorization:'','x-clerk-user-id':U,'x-clerk-org-id':A}))).status,401)
      assert.equal((await exportHandler(exportRequest(A,U,{}, {origin:'https://foreign.invalid'}))).status,403)
      assert.equal((await documents()).filter(row=>row.organization_id===A).length,0)
    })
    for(const org of [A,B]) await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'srm',$2,$3,'ALLOW','supplier.report.export','supplier_report')",[randomUUID(),org,U])
    await t.test('existing XLSX builder uses actual ordinary private SQL and emits distinct organisation data with four audit events',async()=>{
      for(const [org,amount] of [[A,100],[B,999]]){
        await owner.query('DELETE FROM srm.financial_source_documents WHERE organization_id=$1',[org])
        const before=await lastEvent(),response=await exportHandler(exportRequest(org))
        assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'private, no-store')
        assert.equal(response.headers.get('Vary'),'Cookie, Authorization')
        assert.match(response.headers.get('X-Download-Filename'),new RegExp(`^Financials_${NIP}_[0-9]{8}\\.xlsx$`))
        const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()))
        const balance=workbook.worksheets.find(sheet=>sheet.name.startsWith(`Balance_${NIP}_`));assert(balance)
        const values=[];balance.eachRow(row=>values.push(...row.values))
        assert(values.includes(amount));assert(!values.includes(org===A?999:100))
        assert.equal((await documents()).filter(row=>row.organization_id===org).length,1)
        const events=await exportEvents(before)
        assert.deepEqual(events.map(event=>[event.operation,event.phase]),[['supplier.report.export','INTENT'],['supplier.report.project','INTENT'],['supplier.report.project','OUTCOME'],['supplier.report.export','OUTCOME']])
        assert.equal(new Set(events.map(event=>event.correlationId)).size,1)
        assert.equal(new Set(events.map(event=>event.moduleEvidence.transactionId)).size,1)
        assert(events.every(event=>event.actorId===U&&event.organisationId===org&&event.subjectUserId===U))
        assert.notEqual(events[0].decisionId,events[1].decisionId)
      }
    })
    await t.test('each source permission and explicit DENY remain required for actual export',async()=>{
      for(const operation of ['supplier.report.read','supplier.report.project','supplier.report.export']){
        const denial=randomUUID()
        await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'srm',$2,$3,'DENY',$4,'supplier_report')",[denial,A,U,operation])
        await owner.query('DELETE FROM srm.financial_source_documents WHERE organization_id=$1',[A])
        try{assert.equal((await exportHandler(exportRequest())).status,403);assert.equal((await documents()).filter(row=>row.organization_id===A).length,0)}
        finally{await owner.query('DELETE FROM profitia_access.permission_grants WHERE grant_id=$1',[denial])}
      }
      assert.equal((await exportHandler(exportRequest(B,V))).status,403)
    })
    await t.test('actual export keeps malformed and duplicate contexts closed, and missing data/years have truthful outcomes',async()=>{
      for(const query of [`?organisationId=${A}&organisationId=${B}`,'?organisationId=','?organisationId=demo']){
        const r=exportRequest();assert.equal((await exportHandler(new Request(ORIGIN+'/api/xray/financial-excel'+query,r))).status,400)
      }
      for(const [selection,status,outcome] of [[{nip:'0000000000'},404,'NO_DATA'],[{years:['2024']},409,'SELECTION_UNAVAILABLE']]){
        const before=await lastEvent(),response=await exportHandler(exportRequest(A,U,selection))
        assert.equal(response.status,status);assert.equal(response.headers.get('X-Download-Filename'),null)
        assert.equal((await exportEvents(before)).at(-1).reasonCode,outcome)
      }
    })
    await t.test('final export OUTCOME outage rolls back actual preparation and records both failures without a file',async()=>{
      await owner.query('DELETE FROM srm.financial_source_documents WHERE organization_id=$1',[A])
      await owner.query("CREATE FUNCTION profitia_access.reject_export_outcome() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.phase='OUTCOME' AND NEW.event->>'operation'='supplier.report.export' THEN RAISE EXCEPTION 'synthetic export outage'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_export_outcome BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION profitia_access.reject_export_outcome()")
      const before=await lastEvent()
      try{
        const response=await exportHandler(exportRequest());assert.equal(response.status,503);assert.equal(response.headers.get('X-Download-Filename'),null)
        assert.equal((await documents()).filter(row=>row.organization_id===A).length,0)
      }finally{await owner.query('DROP TRIGGER reject_export_outcome ON profitia_access.security_events; DROP FUNCTION profitia_access.reject_export_outcome()')}
      const events=await exportEvents(before)
      assert.deepEqual(events.map(event=>[event.operation,event.phase]),[['supplier.report.export','INTENT'],['supplier.report.project','INTENT'],['supplier.report.project','FAILURE'],['supplier.report.export','FAILURE']])
      assert.equal(new Set(events.map(event=>event.correlationId)).size,1)
      assert.equal((await exportHandler(exportRequest())).status,200)
    })
    await t.test('current product or provider revocation cannot export despite prior success',async()=>{
      revoked=true
      try{assert.equal((await exportHandler(exportRequest())).status,401)}finally{revoked=false}
      await owner.query("UPDATE profitia_access.product_grants SET status='REVOKED' WHERE organisation_id=$1",[A])
      try{assert.equal((await exportHandler(exportRequest())).status,403)}finally{await owner.query("UPDATE profitia_access.product_grants SET status='ACTIVE' WHERE organisation_id=$1",[A])}
    })
    const sharedDispatch = createRuntimeSharedFinancialHandler(() => ({ provider: 'clerk', executor: reportHost, defaultOrganisationId: A }), {})
    const sharedRequest = (org=A,user=U,query={}) => {
      const url=new URL(ORIGIN+'/api/xray/financial-summary');url.searchParams.set('nip',NIP);url.searchParams.set('organisationId',org)
      for(const[key,value]of Object.entries(query))url.searchParams.set(key,value)
      return new Request(url,{headers:{authorization:`Bearer external-${user}`,cookie:'unrelated-cookie','x-clerk-org-id':B}})
    }
    const sharedHandler=async request=>{
      assert.equal((await middleware(new NextRequest(request.clone()))).headers.get('x-middleware-next'),'1')
      return sharedDispatch(request)
    }
    const businessSnapshot=async()=>{
      const tables=(await owner.query("SELECT tablename FROM pg_tables WHERE schemaname='srm' ORDER BY tablename")).rows
      const result={}
      for(const{tablename}of tables){assert(/^[a-z_]+$/.test(tablename));result[tablename]=(await owner.query(`SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS data FROM srm.${tablename} t`)).rows[0].data}
      return result
    }
    await t.test('shared real API works with SELECT only on three corporate tables and leaves every business table unchanged',async()=>{
      const original=(await owner.query("SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='srm' AND c.relkind='r' AND has_table_privilege($1,c.oid,'SELECT')",[ROLE])).rows
      assert(original.some(table=>table.relname==='mgbi_source_archives'))
      const before=await businessSnapshot(),eventBefore=await lastEvent()
      await owner.query(`REVOKE SELECT ON ALL TABLES IN SCHEMA srm FROM ${ROLE}`)
      await owner.query(`GRANT SELECT ON srm.catalog_companies,srm.catalog_financial_facts,srm.catalog_financial_indicators TO ${ROLE}`)
      try{
        assert.equal((await owner.query("SELECT has_table_privilege($1,'srm.mgbi_source_archives','SELECT') allowed",[ROLE])).rows[0].allowed,false)
        for(const org of[A,B]){
          const response=await sharedHandler(sharedRequest(org));assert.equal(response.status,200)
          const body=await response.json();assert.equal(body.financial.periods[0].facts[0].amount,'100')
          assert.equal(body.kys.status,'NOT_REQUESTED');assert.equal(body.kys.reportAvailable,false)
          for(const key of['scanner','exportRef','preferenceScope','private-not-public','sourceSnapshotId'])assert(!JSON.stringify(body).includes(key),key)
          assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(response.headers.get('Vary'),'Cookie, Authorization')
        }
        assert.deepEqual(await businessSnapshot(),before)
        const events=(await owner.query("SELECT event FROM profitia_access.security_events WHERE event_id>$1 ORDER BY event_id",[eventBefore])).rows.map(row=>row.event)
        assert.deepEqual(events.map(event=>[event.operation,event.phase]),[['supplier.report.read','INTENT'],['supplier.report.read','OUTCOME'],['supplier.report.read','INTENT'],['supplier.report.read','OUTCOME']])
        assert(events.every(event=>event.dataClass==='SHARED_KNOWLEDGE' && event.moduleEvidence.moduleId==='supplier_report'))
        assert.deepEqual(events.map(event=>event.organisationId),[A,A,B,B])
        assert.equal(events[0].correlationId,events[1].correlationId);assert.equal(events[2].correlationId,events[3].correlationId)
        assert.notEqual(events[0].correlationId,events[2].correlationId)
        assert.equal(events[0].moduleEvidence.transactionId,events[1].moduleEvidence.transactionId)
        assert.equal(events[2].moduleEvidence.transactionId,events[3].moduleEvidence.transactionId)
      }finally{
        await owner.query(`REVOKE SELECT ON ALL TABLES IN SCHEMA srm FROM ${ROLE}`)
        for(const{relname}of original){assert(/^[a-z_]+$/.test(relname));await owner.query(`GRANT SELECT ON srm.${relname} TO ${ROLE}`)}
      }
    })
    await t.test('shared read refuses forged identities, current revocations and dedicated-profile foreign context',async()=>{
      assert.equal((await sharedHandler(new Request(sharedRequest().url,{headers:{cookie:'unrelated','x-clerk-user-id':U,'x-clerk-org-id':A}}))).status,401)
      assert.equal((await sharedHandler(sharedRequest(B,V))).status,403)
      revoked=true;try{assert.equal((await sharedHandler(sharedRequest())).status,401)}finally{revoked=false}
      const denial=randomUUID()
      await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'srm',$2,$3,'DENY','supplier.report.read','supplier_report')",[denial,A,U])
      try{assert.equal((await sharedHandler(sharedRequest())).status,403)}finally{await owner.query('DELETE FROM profitia_access.permission_grants WHERE grant_id=$1',[denial])}
      for(const[table,where]of[['profitia_access.product_grants',`organisation_id='${A}'`],['profitia_modules.application_bindings',"application_id='srm'"]]){
        await owner.query(`UPDATE ${table} SET status='REVOKED' WHERE ${where}`)
        try{assert.equal((await sharedHandler(sharedRequest())).status,403)}finally{await owner.query(`UPDATE ${table} SET status='ACTIVE' WHERE ${where}`)}
      }
      const fixed=createSrmReportOperationHost({...reportOptions,application:{...reportOptions.application,profileId:'PORR_SUITE',organisationId:A}})
      const handler=createRuntimeSharedFinancialHandler(()=>({provider:'clerk',executor:fixed,defaultOrganisationId:A}),{})
      assert.equal((await handler(sharedRequest(B))).status,400)
      const noBearer=new Request(sharedRequest().url,{headers:{authorization:'Bearer unknown',cookie:`external-${U}`}})
      assert.equal((await handler(noBearer)).status,401)
    })
    await t.test('shared missing data remains empty and source substitution is rejected by the real ordinary role',async()=>{
      const body=await(await sharedHandler(sharedRequest(A,U,{nip:'0000000000'}))).json()
      assert.deepEqual(body.financial.periods,[]);assert.equal(body.financial.freshness.freshness,'ABSENT')
      await assert.rejects(reportHost.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'supplier.report.read',organisationId:A,resourceId,payload:{nip:NIP,entityType:'COMPANY'},request:sharedRequest()},async(context,client)=>{
        assert.equal(context.resource.version,hash(JSON.stringify(financial)))
        return readSharedFinancialReport(client,A,{nip:NIP,entityType:'COMPANY'},'b'.repeat(64))
      }),error=>error.reasonCode==='RESOURCE_SCOPE_MISMATCH')
    })
    await t.test('shared OUTCOME outage releases no DTO, records failure and changes no business data',async()=>{
      const before=await businessSnapshot(),eventBefore=await lastEvent()
      await owner.query("CREATE FUNCTION profitia_access.reject_shared_outcome() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.phase='OUTCOME' AND NEW.event->>'operation'='supplier.report.read' THEN RAISE EXCEPTION 'synthetic shared outage'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_shared_outcome BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION profitia_access.reject_shared_outcome()")
      try{const response=await sharedHandler(sharedRequest());assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'Operation unavailable'})}
      finally{await owner.query('DROP TRIGGER reject_shared_outcome ON profitia_access.security_events; DROP FUNCTION profitia_access.reject_shared_outcome()')}
      assert.deepEqual(await businessSnapshot(),before)
      const events=(await owner.query("SELECT event FROM profitia_access.security_events WHERE event_id>$1 ORDER BY event_id",[eventBefore])).rows.map(row=>row.event)
      assert.deepEqual(events.map(event=>[event.operation,event.phase]),[['supplier.report.read','INTENT'],['supplier.report.read','FAILURE']])
    })
  } finally { if (previousProvider === undefined) delete process.env.PROFITIA_AUTH_PROVIDER; else process.env.PROFITIA_AUTH_PROVIDER = previousProvider; globalThis.fetch = previousFetch; await pool?.end(); await auditPool?.end(); await owner?.end(); await root.end() }
})
