import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import test from 'node:test'
import pg from 'pg'
import { createOperationExecutor } from '@profitia/platform-contracts/operation-context'
import { assertIsolatedTestConnection, initialiseAuthoritySchema, seedAuthority, putTestResource, createPostgresAuthority, TEST_ORGANISATIONS as O, TEST_USERS as U } from '../../architecture-lab/src/operation-postgres-fixture.mjs'

test('SRM real report API, archive restoration and PostgreSQL transaction enforce operation context', async t => {
  const ownerUrl = assertIsolatedTestConnection(process.env.SRM_OPERATION_TEST_OWNER_URL, 'srm_app', 'architecture_test_owner')
  const owner = new pg.Client({ connectionString: ownerUrl }); await owner.connect()
  let authority
  const previousFetch = globalThis.fetch
  globalThis.fetch = async () => { throw Error('Provider calls forbidden in this isolated integration') }
  const nip = '8650004194', resourceId = `supplier-report:COMPANY:${nip}`
  try {
    for (const role of ['srm_app_runtime', 'neon_superuser']) if (!(await owner.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role])).rowCount) await owner.query(role === 'srm_app_runtime' ? "CREATE ROLE srm_app_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD 'isolated_ci_only'" : 'CREATE ROLE neon_superuser NOLOGIN')
    await owner.query('DROP SCHEMA IF EXISTS operation_test CASCADE; DROP SCHEMA IF EXISTS srm CASCADE')
    const directory = new URL('../db/migrations/', import.meta.url)
    const files = fs.readdirSync(directory).filter(f => /^\d{4}_.+\.sql$/.test(f)).sort()
    for (const file of files) {
      const sql = fs.readFileSync(new URL(file, directory), 'utf8'); await owner.query(sql)
      await owner.query('INSERT INTO srm.schema_migrations(version,checksum_sha256) VALUES($1,$2)', [file.slice(0, -4), createHash('sha256').update(sql).digest('hex')])
    }
    assert.equal(files.length, 18)
    await owner.query('GRANT USAGE ON SCHEMA srm TO srm_app_runtime; GRANT SELECT,INSERT,UPDATE ON srm.organizations,srm.suppliers,srm.lookup_requests,srm.provider_attempts,srm.source_snapshots,srm.section_projections,srm.financial_facts TO srm_app_runtime; REVOKE INSERT,UPDATE ON srm.organizations FROM srm_app_runtime')
    await initialiseAuthoritySchema(owner, ['srm_app_runtime'])
    const application = { appId: 'srm-isolated-operation', profileId: 'SUPPLIER_INTELLIGENCE_STANDALONE', environment: 'development', deploymentId: 'isolated-existing-srm-code', configurationVersion: 'test-v1', organisationId: null, operations: ['supplier.report.read', 'supplier.report.project'], features: ['supplier_report'] }
    const permissions = ['read', 'project'].map(verb => ({ operation: `supplier.report.${verb}`, feature: 'supplier_report', resourceId: null }))
    await seedAuthority(owner, application, permissions)
    const shared = { id: `shared-report:${nip}`, type: 'supplier_report', dataClass: 'SHARED_KNOWLEDGE', ownerOrganisationId: null, ownerUserId: null, environment: 'development', version: 'stored-source-v1', projectionVersion: 'operation-v1', approvedSharedProjection: true }
    for (const [index, organisationId] of Object.values(O).entries()) {
      await owner.query('INSERT INTO srm.organizations(id,slug) VALUES($1,$2)', [organisationId, `synthetic-org-${index}`])
      await putTestResource(owner, application, organisationId, { id: resourceId, type: 'supplier_projection', dataClass: 'ORGANISATION_PRIVATE', ownerOrganisationId: organisationId, ownerUserId: null, environment: 'development', version: 'stored-report-scope-v1', projectionVersion: 'operation-v1', inputs: [shared] })
      const requestId = (await owner.query("INSERT INTO srm.lookup_requests(organization_id,identifier_type,identifier) VALUES($1,'NIP',$2) RETURNING id", [organisationId, nip])).rows[0].id
      const record = { id: 'synthetic-financial-2025', identifiers: { pl_nip: nip, pl_krs: '0000000001' }, document: { type: 'financial_statement', period_from_date: '2025-01-01', period_to_date: '2025-12-31', filing_date: '2026-01-15', is_ias_compliant: false }, content: { schema: { name: 'JednostkaInnaWZlotych', version: '1-3' }, extracted_fields: { 'Naglowek.OkresOd': '2025-01-01', 'Naglowek.OkresDo': '2025-12-31', 'Bilans.Aktywa.KwotaA': index === 0 ? '100' : '999', 'RZiS.RZiSKalk.A.KwotaA': '200' }, standardized_fields: {} } }
      const payload = JSON.stringify({ pages: [{ results: [record] }] })
      await owner.query("INSERT INTO srm.mgbi_source_archives(organization_id,nip,model,payload_json,payload_sha256,record_count,first_retrieved_at,last_checked_at,source_request_id) VALUES($1,$2,'pl-krs-rdf-record',$3::jsonb,$4,1,now(),now(),$5)", [organisationId, nip, payload, createHash('sha256').update(payload).digest('hex'), requestId])
    }
    const financial = { status: 'SUCCESS', source: { provider: 'MGBI', model: 'synthetic-fixture', recordId: 'private-not-public' }, retrievedAt: new Date().toISOString(), effectiveAt: '2025-12-31', warnings: [], catalogMappingVersion: '2026-10-07-ccc-v2', data: { qualityRule: 'FINANCIAL_QUALITY_V1', periods: [{ from: '2025-01-01', to: '2025-12-31', scope: 'standalone', documentId: 'synthetic-financial-2025:cfy', facts: [{ metricCode: 'BS_A_TA', amount: '100', currency: 'PLN', unit: 'PLN' }] }] } }
    await owner.query('INSERT INTO srm.catalog_companies(nip,financial_json,financial_sha256,financial_checked_at) VALUES($1,$2::jsonb,$3,now())', [nip, JSON.stringify(financial), 'a'.repeat(64)])
    await owner.query("INSERT INTO srm.catalog_financial_facts(nip,metric_code,period_start,period_end,statement_scope,period_type,amount,source_amount,normalization_rule,currency_code,unit_code,source_path,validation_status,retrieved_at) VALUES($1,'BS_A_TA','2025-01-01','2025-12-31','UNIT','YEAR',100,100,'SOURCE_VALUE','PLN','PLN','synthetic-source-path','VALID',now())", [nip])
    const sourceBefore = (await owner.query('SELECT organization_id,payload_jsonb_sha256 FROM srm.mgbi_source_archives ORDER BY organization_id')).rows
    const runtimeUrl = new URL(ownerUrl); runtimeUrl.username = 'srm_app_runtime'; runtimeUrl.password = 'isolated_ci_only'
    const projectOutput = async (response, context) => {
      assert(response instanceof Response); const body = await response.clone().json(); assert.equal(body.nip, nip)
      const encoded = JSON.stringify(body)
      for (const forbidden of ['payload_json', 'private-not-public', 'synthetic-source-path', 'source_organization_id', 'sourceSnapshotId']) if (encoded.includes(forbidden)) throw Error('Private source metadata escaped projection')
      assert.equal(context.organisationId === O.a || context.organisationId === O.b, true)
      return response
    }
    authority = createPostgresAuthority({ ownerUrl, runtimeUrl: runtimeUrl.toString(), database: 'srm_app', role: 'srm_app_runtime', application, projectOutput })
    const executor = createOperationExecutor(authority.options)
    const { createOperationReportDataHandler } = await import('../src/server/operation-report-data.ts')
    const handler = createOperationReportDataHandler(executor, { SRM_DEMO_SESSION_SECRET: 'isolated-preference-key-not-a-customer-secret' })
    const request = (organisationId = O.a, userId = U.a, headers = {}) => new Request(`http://isolated.test/api/xray/report-data?organisationId=${organisationId}`, { method: 'POST', headers: { authorization: `Bearer ${authority.issuer.issue(userId)}`, 'content-type': 'application/json', ...headers }, body: JSON.stringify({ nip, entityType: 'COMPANY', organisationId: O.b, role: 'admin' }) })
    const documents = async () => (await owner.query('SELECT organization_id,document_json FROM srm.financial_source_documents ORDER BY organization_id')).rows
    const setAccess = (organisationId, userId, change) => owner.query('UPDATE operation_test.authorities SET document=jsonb_set(document,\'{access}\',(document->\'access\') || $4::jsonb) WHERE application_id=$1 AND organisation_id=$2 AND actor_id=$3', [application.appId, organisationId, userId, JSON.stringify(change)])
    await t.test('forged roles and anonymous calls cannot restore private source documents', async () => {
      assert.equal((await handler(request(O.a, U.a, { authorization: '', 'x-clerk-org-id': O.a, 'x-clerk-user-id': U.a, 'x-clerk-org-role': 'admin' }))).status, 401); assert.equal((await documents()).length, 0)
    })
    await t.test('report projection has an explicit POST boundary rather than an accidental read operation', async () => {
      const response = await handler(new Request(`http://isolated.test/api/xray/report-data?organisationId=${O.a}`)); assert.equal(response.status, 405); assert.equal(response.headers.get('allow'), 'POST')
    })
    await t.test('the real report API rejects signed foreign-app, foreign-environment and expired identities', async () => {
      for (const change of [{ audience: 'foreign-app' }, { environment: 'staging' }, { expiresAt: '2020-01-01T00:00:00Z' }]) assert.equal((await handler(request(O.a, U.a, { authorization: `Bearer ${authority.issuer.issue(U.a, change)}` }))).status, 401)
    })
    await t.test('missing durable intent blocks actual projection before database writes', async () => {
      await owner.query('REVOKE INSERT ON operation_test.audit FROM srm_app_runtime')
      try { assert.equal((await handler(request())).status, 503); assert.equal((await documents()).length, 0) }
      finally { await owner.query('GRANT INSERT ON operation_test.audit TO srm_app_runtime') }
    })
    await t.test('real readReportData restores source documents and returns stored report through the shared executor', async () => {
      const response = await handler(request()); assert.equal(response.status, 200); const body = await response.json(); assert.equal(body.nip, nip); assert.equal(body.financial.periods.length, 1)
      const saved = await documents(); assert.equal(saved.length, 1); assert.equal(saved[0].organization_id, O.a); assert.equal(saved[0].document_json.rows[0].amounts.KwotaA, '100')
    })
    await t.test('another organisation uses shared financial knowledge but its own private archive/projection', async () => {
      const response = await handler(request(O.b, U.a)); assert.equal(response.status, 200)
      const body = await response.json(); assert.equal(body.financial.periods[0].facts[0].amount, '100')
      const saved = await documents(); assert.equal(saved.length, 2); assert.equal(saved[1].organization_id, O.b); assert.equal(saved[1].document_json.rows[0].amounts.KwotaA, '999')
      assert.equal((await handler(request(O.b, U.b))).status, 403)
    })
    await t.test('two named users in one organisation receive distinct personal preference scopes', async () => {
      const a = await (await handler(request(O.a, U.a))).json(), b = await (await handler(request(O.a, U.b))).json()
      assert(a.preferenceScope); assert(b.preferenceScope); assert.notEqual(a.preferenceScope, b.preferenceScope)
    })
    await t.test('composite read permission, current membership and product are separately mandatory', async () => {
      await setAccess(O.a, U.a, { permissions: permissions.filter(p => p.operation !== 'supplier.report.read') }); assert.equal((await handler(request())).status, 403); await setAccess(O.a, U.a, { permissions })
      await setAccess(O.a, U.a, { status: 'REVOKED' }); assert.equal((await handler(request())).status, 403); await setAccess(O.a, U.a, { status: 'ACTIVE' })
      await owner.query("UPDATE operation_test.authorities SET document=jsonb_set(document,'{products,1,status}','\"EXPIRED\"') WHERE application_id=$1 AND organisation_id=$2 AND actor_id=$3", [application.appId, O.a, U.a]); assert.equal((await handler(request())).status, 403)
      await owner.query("UPDATE operation_test.authorities SET document=jsonb_set(document,'{products,1,status}','\"ACTIVE\"') WHERE application_id=$1 AND organisation_id=$2 AND actor_id=$3", [application.appId, O.a, U.a])
    })
    await t.test('outcome failure rolls back actual archive restoration instead of committing a nested transaction', async () => {
      await owner.query('DELETE FROM srm.financial_source_documents WHERE organization_id=$1', [O.a])
      await owner.query("CREATE FUNCTION operation_test.reject_outcome() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event->>'phase'='OUTCOME' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_outcome BEFORE INSERT ON operation_test.audit FOR EACH ROW EXECUTE FUNCTION operation_test.reject_outcome()")
      try { assert.equal((await handler(request())).status, 503); assert.equal((await documents()).filter(r => r.organization_id === O.a).length, 0) }
      finally { await owner.query('DROP TRIGGER reject_outcome ON operation_test.audit; DROP FUNCTION operation_test.reject_outcome()') }
      assert.equal((await handler(request())).status, 200)
    })
    await t.test('RLS and ordinary role protect private rows; transaction scope never survives pool reuse', async () => {
      const client = await authority.pool.connect()
      try {
        assert.equal((await client.query('SELECT * FROM srm.financial_source_documents')).rowCount, 0)
        const settings = (await client.query("SELECT current_setting('srm.organization_id',true) AS srm,current_setting('operation.organisation_id',true) AS org,current_setting('operation.user_id',true) AS usr")).rows[0]; assert(!settings.srm); assert(!settings.org); assert(!settings.usr)
        await client.query('BEGIN'); await client.query("SELECT set_config('srm.organization_id',$1,true)", [O.a]); const rows = (await client.query('SELECT organization_id FROM srm.financial_source_documents')).rows; assert.equal(rows.length, 1); assert.equal(rows[0].organization_id, O.a); await client.query('ROLLBACK')
        await assert.rejects(client.query('DELETE FROM operation_test.audit'), /permission denied/)
        await assert.rejects(client.query("UPDATE operation_test.authorities SET document='{}'::jsonb"), /permission denied/)
      } finally { client.release() }
      assert.deepEqual((await owner.query('SELECT organization_id,payload_jsonb_sha256 FROM srm.mgbi_source_archives ORDER BY organization_id')).rows, sourceBefore)
    })
    await t.test('an owner connection or foreign bound organisation cannot use the existing SRM persistence boundary', async () => {
      const { bindOrganizationTransaction, withOrganization } = await import('../src/server/db.ts')
      await owner.query('BEGIN'); await owner.query("SELECT set_config('srm.organization_id',$1,true)", [O.a])
      try {
        const pool = bindOrganizationTransaction(O.a, owner)
        await assert.rejects(withOrganization(O.a, async () => { throw Error('owner action must never execute') }, pool), /must enforce row.level security/)
        await assert.rejects(withOrganization(O.b, async () => { throw Error('foreign action must never execute') }, pool), /organization mismatch/)
      } finally { await owner.query('ROLLBACK') }
    })
    await t.test('default demo boundary remains separate and ordinary app migrations are unchanged', async () => {
      const { reportDataHandler } = await import('../src/server/report-data.ts'); const response = await reportDataHandler(undefined, { TARGET_ENVIRONMENT: 'development', SRM_DEVELOPMENT_ORGANIZATION_ID: O.a })(request())
      assert.equal(response.status, 401); assert.equal((await owner.query('SELECT count(*)::int AS n FROM srm.schema_migrations')).rows[0].n, 18)
      assert.equal((await owner.query("SELECT count(*)::int AS n FROM operation_test.audit WHERE event->>'phase'='OUTCOME'")).rows[0].n > 0, true)
      for (const { event } of (await owner.query('SELECT event FROM operation_test.audit')).rows) {
        assert(Number.isFinite(Date.parse(event.occurredAt))); assert.equal(event.contractId, 'profitia.operation-context')
        if (event.decision === 'ALLOW') { assert.equal(event.productEvidence[0].product, 'SUPPLIER_INTELLIGENCE'); assert(event.productEvidence[0].version); assert.equal(event.dataClass, 'ORGANISATION_PRIVATE') }
      }
    })
  } finally { globalThis.fetch = previousFetch; if (authority) await authority.close(); await owner.end() }
})
