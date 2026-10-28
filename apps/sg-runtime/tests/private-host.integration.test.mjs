import { createEmptyVerificationSourceFixture, grantVerificationProjectionSourceColumns } from './fixtures/stored-forecast-verification-source.mjs'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import test from 'node:test'
import { PrismaClient } from '@prisma/client'
import { NextRequest } from 'next/server.js'
import { accessSchemaUrl, accessStoreSourceDigest, createAccessStore, moduleAuditSchemaUrl, moduleAuditSchemaDigest } from '@profitia/platform-contracts/access-store'
import { moduleSchemaUrl, moduleSchemaDigest } from '@profitia/platform-contracts/module-scope'
import { identitySourceDigest } from '@profitia/platform-contracts/identity-provider'
import { privateOperationHostSourceDigest } from '@profitia/platform-contracts/private-operation-host'
import { OPERATION_CONTRACT, OperationDenied, isOperationDenied } from '@profitia/platform-contracts/operation-context'
import { assertIsolatedTestConnection } from '../../architecture-lab/src/operation-postgres-fixture.mjs'
import { createSg2PrivateBenchmarkHost, createSg2SupplierSummaryHost, createSg2PrivateCategoryHost, createSg2PrivateMarketHost, createSg2PrivateForecastCurrentHost, createSg2PrivateForecastVerificationHost } from '../lib/platform/private-host.ts'
import { createOperationSupplierSummaryHandler } from '../lib/platform/supplier-summary-runtime.ts'
import { SUPPLIER_SUMMARY_HEADERS } from '../lib/platform/supplier-summary.ts'
import { executiveSummary } from '@profitia/srm-xray/executive-summary-rules'
import { CATEGORY_HEADERS } from '../lib/category/operation-contract.ts'
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

const sdkReceipt=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url)))
const currentSdkDigests=sdkReceipt.diagnosticTelemetryAdoption.sdkDigests
const currentPlatformSourceDigests=manifest=>Object.fromEntries(Object.entries({...manifest.accountRecheckSourceCompatibility.sourceDigests,...manifest.krsSoapSourceCompatibility?.sourceDigests,...manifest.unmeteredSourceCompatibility.sourceDigests,...manifest.formReportSourceCompatibility.sourceDigests,...manifest.requestQuotaSourceCompatibility.sourceDigests,...manifest.nativeSqlRoundtripAdoption.sourceDigests,...manifest.diagnosticTelemetryAdoption.sourceDigests,...manifest.xrayPlatform130CiClosureCompatibility.sourceDigests}).filter(([file])=>file!=='package-lock.json'))

test('SG2 imports the exact optional external control source without adopting a product operation', async () => {
  const sdk=await import('@profitia/platform-contracts/external-call')
  const manifest=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url)))
  const accepted=manifest.externalCallSourceCompatibility
  const historicalRequest=manifest.externalRequestSourceCompatibility
  assert.equal(historicalRequest.sourceRecordIsHistorical,true)
  const current=manifest.privateRequestContinuationSourceCompatibility
  assert.equal(accepted.sourceRecordIsHistorical,true)
  assert.equal(current.previousExternalRequestSourceRecordIsHistorical,true)
  assert.equal(accepted.platformVersion,'1.13.0')
  assert.equal(accepted.producer.sourceSha,'1066119a1c1fde29c50b2c627e068f14378441f8')
  assert.equal(accepted.sourceDigest,'cd49ee2c113202178870da20076a7c401e0aede44229dc2102d142c2f49cb431')
  const native=manifest.nativeExternalSourceCompatibility
  assert.equal(native.platformVersion,'1.16.0')
  assert.equal(native.previousSourceRecordsAreHistorical,true)
  assert.equal(current.sourceRecordIsHistorical,true)
  assert.equal(native.producer.sourceSha,'2a44365b981d6a4c786f4e572fe2ca34a8a4fc92')
  assert.equal(await sdk.externalCallSourceDigest(),currentSdkDigests.externalCallSourceDigest)
  assert.equal(await sdk.nativeExternalTransportSchemaDigest(),native.nativeSchemaDigest)
  assert.equal(native.baseSchemaDigest,accepted.schemaDigest)
  assert.equal(sdk.NATIVE_EXTERNAL_TRANSPORT.completionMode,'ADMITTED_ATTEMPT_CURRENT_SETTLEMENT')
  assert.throws(()=>sdk.externalNativeResponse({status:200,bytes:new Uint8Array(0)}))
  for(const key of ['nativeTransportAdopted','sql012Installed','runtimeRoleOrGrantChanged','humanSupplierRefreshAdopted','finderAiAdopted','kysOrPersonalDataAdopted','productDeploymentPerformed'])assert.equal(native[key],false,key)
  assert.equal(await sdk.externalCallSchemaDigest(),accepted.schemaDigest)
  assert.deepEqual(sdk.EXTERNAL_CALL_CONTRACT,{id:'profitia.external-call',version:'1.0.0',unit:'UPSTREAM_ATTEMPT_ADMISSION'})
  const phaseSdk=await import('@profitia/platform-contracts/request-continuation')
  assert.equal(await phaseSdk.requestContinuationSchemaDigest(),current.schemaDigest)
  assert.equal(await phaseSdk.requestContinuationSourceDigest(),currentSdkDigests.requestContinuationSourceDigest)
  assert.equal(phaseSdk.REQUEST_CONTINUATION_CONTRACT.effect,'PRIVATE_SQL_PHASE')
  const root=new URL('../',import.meta.resolve('@profitia/platform-contracts/external-call'))
  assert.equal(Object.keys(current.sourceDigests).length,20)
  assert.equal(Object.keys(native.sourceDigests).length,23)
  for(const [path,digest]of Object.entries(currentPlatformSourceDigests(manifest)))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(path,root))).digest('hex'),digest,path)
  for(const name of ['externalCallAdopted','sql009Installed','runtimeRoleOrGrantChanged','humanSupplierRefreshAdopted','finderAiAdopted','kysOrPersonalDataAdopted','productDeploymentPerformed'])assert.equal(accepted[name],false,name)
  assert.equal(sdk.externalCallEvidence({status:200,body:{}}),null)
})

test('SG2 explicitly accepts the published optional producer fingerprints', async () => {
  assert.equal(await accessStoreSourceDigest(), currentSdkDigests.accessStoreSourceDigest)
  assert.equal(await identitySourceDigest(), 'b7f3e09e6c62bbaf20c42752f514022c91b0dc0fef9db387f41f613a124ce0b4')
  assert.equal(await privateOperationHostSourceDigest(),currentSdkDigests.privateOperationHostSourceDigest)
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
    await owner.query('DROP SCHEMA IF EXISTS profitia_forecast_read CASCADE; DROP TABLE IF EXISTS public.forecast_verification_points,public.forecast_verification_metrics,public.forecast_verification_runs,public.rolling_daily_verification_records,public.rolling_daily_maintenance_state,public.forecast_current_points,public.forecast_current_runs,public.rolling_daily_current_forecast_snapshots CASCADE; DROP TYPE IF EXISTS public.\"ForecastTargetBasis\"; DROP SCHEMA IF EXISTS profitia_category CASCADE; DROP SCHEMA IF EXISTS profitia_modules CASCADE; DROP SCHEMA IF EXISTS profitia_access CASCADE; DROP SCHEMA IF EXISTS sg_runtime_benchmarks CASCADE')
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
    const categorySql = fs.readFileSync(new URL('../prisma/private-store/002-category-boundaries.sql', import.meta.url), 'utf8')
    const categoryDigest = createHash('sha256').update(categorySql).digest('hex')
    await t.test('the exact category migration rolls back all added DDL on forced failure before clean reapplication', async()=>{
      let forced=false
      await owner.query('BEGIN; SET LOCAL ROLE profitia_access_owner')
      try{
        await owner.query(businessSql);await owner.query(boundarySql);await owner.query(categorySql)
        await owner.query("INSERT INTO profitia_category.installation(schema_version,boundary_digest,source_ref) VALUES('1.0.0',$1,'SYNTHETIC_ROLLBACK_REHEARSAL')",[categoryDigest])
        forced=true
        await owner.query("DO $$ BEGIN RAISE EXCEPTION 'synthetic_category_migration_failure'; END $$")
        assert.fail('Forced migration failure must not commit')
      }catch(error){assert.equal(forced,true);assert.match(error.message,/synthetic_category_migration_failure/)}
      finally{await owner.query('ROLLBACK')}
      assert.deepEqual((await owner.query("SELECT to_regnamespace('sg_runtime_benchmarks')::text AS business,to_regnamespace('profitia_category')::text AS category")).rows,[{business:null,category:null}])
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM profitia_access.accounts')).rows[0].n,2)
    })
    // Test the exact deployable source, under the controlled owner, atomically.
    await owner.query('BEGIN; SET LOCAL ROLE profitia_access_owner')
    try {
      await owner.query(businessSql)
      await owner.query(boundarySql)
      await owner.query(categorySql)
      await owner.query("INSERT INTO profitia_category.installation(schema_version,boundary_digest,source_ref) VALUES('1.0.0',$1,'SYNTHETIC_NOT_A_RELEASE')", [categoryDigest])
      await owner.query("INSERT INTO sg_runtime_benchmarks.private_installation(schema_version,schema_digest,boundary_digest,source_ref) VALUES('1.0.0',$1,$2,'SYNTHETIC_NOT_A_RELEASE')", [createHash('sha256').update(businessSql).digest('hex'), createHash('sha256').update(boundarySql).digest('hex')])
      await owner.query('COMMIT')
    } catch (error) { await owner.query('ROLLBACK'); throw error }
    await owner.query(`GRANT USAGE ON SCHEMA sg_runtime_benchmarks TO ${ROLE}; GRANT SELECT,INSERT,UPDATE ON sg_runtime_benchmarks."BusinessBenchmark",sg_runtime_benchmarks."BenchmarkProviderMapping",sg_runtime_benchmarks."OrganizationBenchmarkSelection" TO ${ROLE}`)
    await owner.query(`GRANT USAGE ON SCHEMA profitia_category TO ${ROLE}; GRANT SELECT ON profitia_category.installation TO ${ROLE}; GRANT SELECT,INSERT,UPDATE,DELETE ON sg_runtime_benchmarks."Category",sg_runtime_benchmarks."CategoryCostComponent" TO ${ROLE}`)
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
    await t.test('receiving the new SDK cannot grant private Supplier operations to the existing benchmark host',async()=>{
      let effects=0
      for(const operation of ['supplier.private.read','supplier.private.reveal','supplier.private.export']){
        await assert.rejects(host.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,
          operation,organisationId:A,resourceId:'private-supplier-synthetic',payload:{},request:request('GET')},
          async()=>{effects++;return null}),error=>isOperationDenied(error)&&error.reasonCode==='PERMISSION_DENIED')
      }
      assert.equal(effects,0);assert.equal(providerCalls,0);assert.equal(await count(),0)
    })
    await t.test('existing API persists through ordinary Prisma and commits matching audit OUTCOME', async () => {
      const response = await handlers.POST(request('POST')); assert.equal(response.status, 201, JSON.stringify((await owner.query("SELECT phase,event->>'reasonCode' AS reason FROM profitia_access.security_events ORDER BY event_id")).rows))
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

    await t.test('private category APIs preserve business behavior inside current ordinary Prisma transactions', async t => {
      // Match the existing real-host fixture: initialise synthetic runtime env
      // before importing legacy middleware, which snapshots server settings.
      const { createOperationCategoryCollectionHandlers, createOperationCategoryDetailHandlers } = await import('../lib/category/operation-handlers.ts')
      const { createRuntimeCategoryCollectionHandlers, createRuntimeCategoryDetailHandlers } = await import('../lib/category/runtime-handlers.ts')
      const beforeProvider = providerCalls
      let businessCalls = 0
      prisma.$use(async (parameters, next) => { if (['Category','CategoryCostComponent','BusinessBenchmark','BenchmarkProviderMapping'].includes(parameters.model)) businessCalls++; return next(parameters) })
      const categoryConfig = { ...configuration, application: { ...configuration.application,
        configurationVersion: 'synthetic-private-category', operations: ['category.read','category.write'], features: ['category'] },
        module: { ...configuration.module, id: 'category' }, categoryBoundaryDigest: categoryDigest }
      const categoryHost = createSg2PrivateCategoryHost(categoryConfig)
      const runtime = () => ({ provider: 'clerk', executor: host, defaultOrganisationId: A, category: { executor: categoryHost } })
      const collection = createRuntimeCategoryCollectionHandlers(runtime), detail = createRuntimeCategoryDetailHandlers(runtime)
      const input = (method = 'GET', org = A, user = U, body, extra = {}) => new NextRequest(`${ORIGIN}/api/category?organisationId=${org}`, {
        method, headers: { authorization: `Bearer external-${user}`, 'content-type': 'application/json', Cookie: 'untrusted', 'x-clerk-org-id': B,
          'x-clerk-user-id': V, 'x-clerk-org-role': 'owner', ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
      const value = (name, components = []) => ({ name, components })
      const part = (businessBenchmarkId, weightPercent) => ({ name: 'Synthetic source component', businessBenchmarkId, weightPercent })
      const reference = async (org, id, primary = true) => {
        await owner.query('INSERT INTO sg_runtime_benchmarks."BusinessBenchmark"(id,"organizationId","displayName","createdByUserId","createdAt","updatedAt") VALUES($1,$2,$3,$4,now(),now())', [id,org,`Reference for ${org===A?'A':'B'}`,U])
        if (primary) await owner.query('INSERT INTO sg_runtime_benchmarks."BenchmarkProviderMapping"(id,"businessBenchmarkId","organizationId","providerCode","providerDisplayName","providerSeriesId","isPrimary","createdAt","updatedAt") VALUES($1,$2,$3,\'MACROBOND\',\'Stored category reference\',$2,true,now(),now())',[randomUUID(),id,org])
      }
      for (const id of ['category-ref-a1','category-ref-a2','category-ref-unused']) await reference(A,id)
      await reference(B,'category-ref-b1'); await reference(A,'category-ref-no-primary',false)
      const snapshot = async () => {
        const out = {}
        for (const table of ['Category','CategoryCostComponent']) out[table] = (await owner.query(`SELECT to_jsonb(t) AS row FROM sg_runtime_benchmarks."${table}" t ORDER BY to_jsonb(t)::text`)).rows
        return out
      }
      const scoped = (payload, operation = 'category.read', org = A, user = U) => ({ contractId: OPERATION_CONTRACT.id,
        contractVersion: OPERATION_CONTRACT.version, operation, organisationId: org,
        resourceId: payload.action==='list'?`categories:${org}`:`category:${payload.categoryId}`, payload, request: input('GET',org,user) })
      const listing = { action: 'list', categoryId: null, body: null }
      let first, second
      await t.test('benchmark access does not lend a category product, module, read or write permission', async () => {
        const before = await snapshot()
        assert.equal((await collection.GET(input())).status,403)
        await owner.query("INSERT INTO profitia_modules.application_bindings(application_id,module_id,binding_id,status,source_ref,expires_at) VALUES('spendguru','category',$1,'ACTIVE','SYNTHETIC_CATEGORY',$2)",[randomUUID(),expiry()])
        assert.equal((await collection.GET(input())).status,403)
        await owner.query("UPDATE profitia_access.product_grants SET features=ARRAY['benchmark','category'] WHERE application_id='spendguru' AND product='SPENDGURU'")
        assert.equal((await collection.GET(input())).status,403)
        for (const org of [A,B]) for (const verb of ['read','write']) await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'spendguru',$2,$3,'ALLOW',$4,'category')",[randomUUID(),org,U,`category.${verb}`])
        await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'spendguru',$2,$3,'ALLOW','category.read','category')",[randomUUID(),A,V])
        assert.equal((await collection.GET(input())).status,200)
        assert.equal((await collection.POST(input('POST',A,V,value('No write grant')))).status,403)
        assert.deepEqual(await snapshot(),before)
      })
      await t.test('real collection/create/detail/update retain DRAFT/READY, exact weights and stored references', async () => {
        const created = await collection.POST(input('POST',A,U,value('  Private A  ',[part('category-ref-a1',40)])))
        assert.equal(created.status,201);first=await created.json();assert.equal(first.name,'Private A');assert.equal(first.status,'DRAFT')
        assert.equal(first.allocatedPercent,40);assert.equal(first.remainingPercent,60);assert.equal(first.organizationId,A)
        assert.equal(first.components[0].benchmark.provider.displayName,'Stored category reference');assert.equal(first.components[0].benchmark.providerSeries.providerSeriesId,'category-ref-a1')
        assert(!JSON.stringify(first).includes('createdByUserId'));assert(!JSON.stringify(first).includes(B))
        const found=await detail.GET(input(),{params:{categoryId:first.id}});assert.equal(found.status,200);assert.equal((await found.json()).id,first.id)
        const updated=await detail.PATCH(input('PATCH',A,U,value('Private A ready',[part('category-ref-a1',60),part('category-ref-a2',40)])),{params:{categoryId:first.id}})
        assert.equal(updated.status,200);first=await updated.json();assert.equal(first.status,'READY');assert.equal(first.allocatedPercent,100);assert.equal(first.remainingPercent,0);assert.equal(first.componentCount,2)
        assert.deepEqual(first.components.map(x=>x.position),[0,1]);assert.deepEqual(first.components.map(x=>x.weightPercent),[60,40])
        const rows=(await owner.query('SELECT "organizationId" FROM sg_runtime_benchmarks."CategoryCostComponent" WHERE "categoryId"=$1',[first.id])).rows
        assert.equal(rows.length,2);assert(rows.every(row=>row.organizationId===A))
        const events=(await owner.query("SELECT event FROM profitia_access.security_events WHERE event->>'operation'='category.write' AND event->>'decision'='ALLOW' ORDER BY event_id DESC LIMIT 2")).rows.map(x=>x.event)
        assert.deepEqual(events.map(x=>x.phase),['OUTCOME','INTENT']);assert(events.every(x=>x.organisationId===A&&x.actorId===U&&x.moduleEvidence.moduleId==='category'))
        assert.equal(events[0].decisionId,events[1].decisionId);assert.equal(events[0].correlationId,events[1].correlationId)
      })
      await t.test('two organisations stay separate while an authorised second user in the same organisation sees shared categories', async () => {
        const created=await collection.POST(input('POST',B,U,value('Private B',[part('category-ref-b1',100)])));assert.equal(created.status,201);second=await created.json()
        for (const [org,user,expected] of [[A,U,'Private A ready'],[A,V,'Private A ready'],[B,U,'Private B']]) {
          const response=await collection.GET(input('GET',org,user));assert.equal(response.status,200);const body=await response.json();assert.deepEqual(body.items.map(x=>x.name),[expected]);assert(!JSON.stringify(body).includes(org===A?'Private B':'Private A'))
        }
        assert.equal((await collection.GET(input('GET',B,V))).status,403)
        assert.equal((await detail.GET(input(),{params:{categoryId:second.id}})).status,404)
        const before=await snapshot()
        assert.equal((await detail.PATCH(input('PATCH',A,U,value('Cross category')),{params:{categoryId:second.id}})).status,404)
        assert.equal((await collection.POST(input('POST',A,U,value('Cross source',[part('category-ref-b1',100)])))).status,404)
        assert.deepEqual(await snapshot(),before)
      })
      await t.test('late mapper failure rolls back both create and component replacement instead of committing an error response', async () => {
        const before=await snapshot()
        assert.equal((await collection.POST(input('POST',A,U,value('Must roll back',[part('category-ref-no-primary',100)])))).status,404)
        assert.equal((await detail.PATCH(input('PATCH',A,U,value('Must restore original',[part('category-ref-no-primary',100)])),{params:{categoryId:first.id}})).status,404)
        assert.deepEqual(await snapshot(),before)
        const events=(await owner.query("SELECT event FROM profitia_access.security_events WHERE event->>'operation'='category.write' ORDER BY event_id DESC LIMIT 2")).rows.map(x=>x.event)
        assert.deepEqual(events.map(x=>x.phase),['FAILURE','INTENT']);assert.equal(events[0].decisionId,events[1].decisionId)
      })

      await t.test('current identity, account, membership, explicit deny, product, module and receipt revocations stop before business queries', async () => {
        const before=await snapshot(), calls=businessCalls
        assert.equal((await collection.GET(input('GET',A,U,undefined,{authorization:''}))).status,401)
        sdkRevoked=true;try{assert.equal((await collection.GET(input())).status,401)}finally{sdkRevoked=false}
        sdkIssuer='https://foreign.fixture.test';try{assert.equal((await collection.GET(input())).status,401)}finally{sdkIssuer=ISSUER}
        await owner.query("UPDATE profitia_access.accounts SET status='DISABLED' WHERE user_id=$1",[U])
        try{assert.equal((await collection.GET(input())).status,401)}finally{await owner.query("UPDATE profitia_access.accounts SET status='ACTIVE' WHERE user_id=$1",[U])}
        await owner.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2",[A,U])
        try{assert.equal((await collection.GET(input())).status,403)}finally{await owner.query("UPDATE profitia_access.memberships SET status='ACTIVE' WHERE organisation_id=$1 AND user_id=$2",[A,U])}
        const denied=randomUUID();await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'spendguru',$2,$3,'DENY','category.read','category')",[denied,A,U])
        try{assert.equal((await collection.GET(input())).status,403)}finally{await owner.query('DELETE FROM profitia_access.permission_grants WHERE grant_id=$1',[denied])}
        await owner.query("UPDATE profitia_access.product_grants SET features=ARRAY['benchmark'] WHERE application_id='spendguru' AND product='SPENDGURU' AND organisation_id=$1",[A])
        try{assert.equal((await collection.GET(input())).status,403)}finally{await owner.query("UPDATE profitia_access.product_grants SET features=ARRAY['benchmark','category'] WHERE application_id='spendguru' AND product='SPENDGURU' AND organisation_id=$1",[A])}
        await owner.query("UPDATE profitia_access.product_grants SET status='REVOKED' WHERE application_id='spendguru' AND product='SPENDGURU' AND organisation_id=$1",[A])
        try{assert.equal((await collection.GET(input())).status,403)}finally{await owner.query("UPDATE profitia_access.product_grants SET status='ACTIVE' WHERE application_id='spendguru' AND product='SPENDGURU' AND organisation_id=$1",[A])}
        await owner.query("UPDATE profitia_modules.application_bindings SET status='REVOKED' WHERE application_id='spendguru' AND module_id='category'")
        try{assert.equal((await collection.GET(input())).status,403)}finally{await owner.query("UPDATE profitia_modules.application_bindings SET status='ACTIVE' WHERE application_id='spendguru' AND module_id='category'")}
        await owner.query("UPDATE profitia_category.installation SET boundary_digest=$1",['0'.repeat(64)])
        try{assert.equal((await collection.GET(input())).status,503)}finally{await owner.query('UPDATE profitia_category.installation SET boundary_digest=$1',[categoryDigest])}
        assert.equal(businessCalls,calls);assert.deepEqual(await snapshot(),before)
      })
      await t.test('a dedicated profile and malformed or caller-supplied context never select a foreign organisation or business actor', async () => {
        const before=await snapshot(),calls=businessCalls
        const fixed=createSg2PrivateCategoryHost({...categoryConfig,application:{...categoryConfig.application,profileId:'PORR_SUITE',organisationId:A}})
        const routes=createOperationCategoryCollectionHandlers(fixed,A)
        assert.equal((await routes.GET(input('GET',B))).status,400)
        for(const body of [{...value('Untrusted'),organizationId:B},{...value('Untrusted'),userId:V},{...value('Untrusted'),role:'owner'},value('Bad weights',[part('category-ref-a1',80),part('category-ref-a2',40)])])assert.equal((await collection.POST(input('POST',A,U,body))).status,400)
        assert.equal((await collection.GET(new NextRequest(`${ORIGIN}/api/category?organisationId=${A}&organisationId=${B}`,{headers:{authorization:`Bearer external-${U}`}}))).status,400)
        assert.equal((await detail.GET(input(),{params:{categoryId:'foreign/path'}})).status,400)
        assert.equal(businessCalls,calls);assert.deepEqual(await snapshot(),before)
      })
      await t.test('valid category scope reads only own categories and explicit reference catalog, while other modules cannot read categories', async () => {
        const result=await categoryHost.execute(scoped(listing),async (_context,transaction)=>{
          const categories=await transaction.category.findMany();assert.equal(categories.length,1);assert(categories.every(row=>row.organizationId===A))
          const components=await transaction.categoryCostComponent.findMany();assert.equal(components.length,2);assert(components.every(row=>row.categoryId===first.id))
          const references=await transaction.businessBenchmark.findMany();assert(references.length>=3);assert(references.every(row=>row.organizationId===A))
          assert.deepEqual(await transaction.organizationBenchmarkSelection.findMany(),[])
          return Response.json({items:[]},{headers:CATEGORY_HEADERS})
        });assert.equal(result.value.status,200)
        const benchmarkInput={contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'benchmark.selection.read',organisationId:A,resourceId:`benchmark-selections:${A}`,payload:null,request:request()}
        await host.execute(benchmarkInput,async (_context,transaction)=>{assert.deepEqual(await transaction.category.findMany(),[]);assert.deepEqual(await transaction.categoryCostComponent.findMany(),[]);return Response.json({items:[]})})
        const supplierHost=createSg2SupplierSummaryHost({...configuration,application:{...configuration.application,operations:['supplier.report.read'],features:['supplier_report']},module:{...configuration.module,id:'supplier_report'}})
        let supplierProof=false
        await assert.rejects(supplierHost.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'supplier.report.read',organisationId:A,resourceId:'supplier-report:COMPANY:0000000000',payload:{nip:'0000000000',entityType:'COMPANY'},request:input()},async (_context,transaction)=>{
          assert.deepEqual(await transaction.category.findMany(),[]);assert.deepEqual(await transaction.categoryCostComponent.findMany(),[]);supplierProof=true;throw new OperationDenied('CONTEXT_INVALID')
        }));assert.equal(supplierProof,true)
      })
      await t.test('physical tenant FKs and command-specific restrictive fences survive false permissive policies with real DML privileges', async () => {
        const before=await snapshot()
        await owner.query(`CREATE POLICY category_test_false_allow ON sg_runtime_benchmarks."Category" TO ${ROLE} USING(true) WITH CHECK(true); CREATE POLICY component_test_false_allow ON sg_runtime_benchmarks."CategoryCostComponent" TO ${ROLE} USING(true) WITH CHECK(true); CREATE POLICY reference_test_false_allow ON sg_runtime_benchmarks."BusinessBenchmark" TO ${ROLE} USING(true) WITH CHECK(true); GRANT DELETE ON sg_runtime_benchmarks."BusinessBenchmark" TO ${ROLE}`)
        try{
          const acl=await prisma.$queryRawUnsafe('SELECT has_table_privilege(current_user,\'sg_runtime_benchmarks."Category"\',\'INSERT\') AS category_insert,has_table_privilege(current_user,\'sg_runtime_benchmarks."CategoryCostComponent"\',\'INSERT\') AS component_insert,has_table_privilege(current_user,\'sg_runtime_benchmarks."BusinessBenchmark"\',\'INSERT\') AS reference_insert,has_table_privilege(current_user,\'sg_runtime_benchmarks."BusinessBenchmark"\',\'UPDATE\') AS reference_update,has_table_privilege(current_user,\'sg_runtime_benchmarks."BusinessBenchmark"\',\'DELETE\') AS reference_delete')
          assert.deepEqual(acl,[{category_insert:true,component_insert:true,reference_insert:true,reference_update:true,reference_delete:true}])
          const writePayload={action:'update',categoryId:first.id,body:value('Bound own request')}
          const rejectsSql=async(payload,sql,values,code)=>{
            let actual
            await assert.rejects(categoryHost.execute(scoped(payload,'category.write'),async (_context,transaction)=>{try{await transaction.$executeRawUnsafe(sql,...values)}catch(error){actual=error.meta?.code;throw error}throw Error('A denied SQL mutation unexpectedly succeeded')}))
            assert.equal(actual,code)
          }
          await rejectsSql(writePayload,'INSERT INTO sg_runtime_benchmarks."CategoryCostComponent"(id,"categoryId",name,"businessBenchmarkId","weightPercent",position,"createdAt","updatedAt") VALUES($1,$2,\'Foreign source\',$3,100,0,now(),now())',[randomUUID(),first.id,'category-ref-b1'],'23503')
          const createPayload={action:'create',categoryId:randomUUID(),body:value('Bound own create')}
          await rejectsSql(createPayload,'INSERT INTO sg_runtime_benchmarks."Category"(id,"organizationId",name,status,"createdByUserId","createdAt","updatedAt") VALUES($1,$2,\'Foreign org\',\'DRAFT\',$3,now(),now())',[createPayload.categoryId,B,U],'42501')
          await rejectsSql(createPayload,'INSERT INTO sg_runtime_benchmarks."BusinessBenchmark"(id,"organizationId","displayName","createdByUserId","createdAt","updatedAt") VALUES($1,$2,\'Forbidden reference write\',$3,now(),now())',[randomUUID(),A,U],'42501')
          await categoryHost.execute(scoped(listing),async (_context,transaction)=>{
            assert.equal(await transaction.$executeRawUnsafe('DELETE FROM sg_runtime_benchmarks."BusinessBenchmark" WHERE id=$1','category-ref-unused'),0)
            assert.equal(await transaction.$executeRawUnsafe('UPDATE sg_runtime_benchmarks."BusinessBenchmark" SET "displayName"=\'Forbidden change\' WHERE id=$1','category-ref-unused'),0)
            assert((await transaction.businessBenchmark.findMany()).every(row=>row.organizationId===A))
            assert((await transaction.category.findMany()).every(row=>row.organizationId===A))
            return Response.json({items:[]},{headers:CATEGORY_HEADERS})
          })
          assert.equal((await owner.query('SELECT count(*)::int AS n FROM sg_runtime_benchmarks."BusinessBenchmark" WHERE id=$1 AND "displayName"=$2',['category-ref-unused','Reference for A'])).rows[0].n,1)
          assert.deepEqual(await snapshot(),before)
        }finally{await owner.query(`DROP POLICY category_test_false_allow ON sg_runtime_benchmarks."Category"; DROP POLICY component_test_false_allow ON sg_runtime_benchmarks."CategoryCostComponent"; DROP POLICY reference_test_false_allow ON sg_runtime_benchmarks."BusinessBenchmark"; REVOKE DELETE ON sg_runtime_benchmarks."BusinessBenchmark" FROM ${ROLE}`)}
      })
      await t.test('OUTCOME failure restores a replaced category and components with a durable independent FAILURE', async () => {
        const before=await snapshot()
        await owner.query("CREATE FUNCTION profitia_access.reject_category_outcome() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.phase='OUTCOME' AND NEW.event->>'operation'='category.write' THEN RAISE EXCEPTION 'synthetic category outcome outage'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_category_outcome BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION profitia_access.reject_category_outcome()")
        try{assert.equal((await detail.PATCH(input('PATCH',A,U,value('Must roll back updated category',[part('category-ref-a1',100)])),{params:{categoryId:first.id}})).status,503)}
        finally{await owner.query('DROP TRIGGER reject_category_outcome ON profitia_access.security_events; DROP FUNCTION profitia_access.reject_category_outcome()')}
        assert.deepEqual(await snapshot(),before)
        const events=(await owner.query("SELECT event FROM profitia_access.security_events WHERE event->>'operation'='category.write' ORDER BY event_id DESC LIMIT 2")).rows.map(x=>x.event)
        assert.deepEqual(events.map(x=>x.phase),['FAILURE','INTENT']);assert.equal(events[0].decisionId,events[1].decisionId)
      })
      await t.test('concurrent category reads retain the shared four-connection budget and role cannot rewrite receipt or create SQL authority', async () => {
        const responses=await Promise.all([A,B,A,B].map(org=>collection.GET(input('GET',org))))
        assert(responses.every(response=>response.status===200));assert((await owner.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE usename=$1',[ROLE])).rows[0].n<=4)
        assert.deepEqual(await prisma.category.findMany(),[]);assert.deepEqual(await prisma.categoryCostComponent.findMany(),[])
        await assert.rejects(prisma.$executeRawUnsafe("UPDATE profitia_category.installation SET boundary_digest=repeat('0',64)"))
        await assert.rejects(prisma.$executeRawUnsafe('CREATE TABLE profitia_category.unauthorised_table(id integer)'))
      })

      assert.equal(providerCalls,beforeProvider)
    })

    await t.test('native stored market preview uses current knowledge grant and the actual restricted SQL reader',async t=>{
      const sourceOwner='profitia_market_read_owner',sourceRole='sg2_private_host_market_reader'
      for(const[role,login]of[[sourceOwner,false],[sourceRole,true]]) {
        if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)await root.query(`CREATE ROLE ${role} ${login?"LOGIN PASSWORD 'isolated_ci_only'":'NOLOGIN'} NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`)
      }
      await root.query(`ALTER ROLE ${sourceRole} CONNECTION LIMIT 1`)
      await owner.query(`DROP SCHEMA IF EXISTS profitia_market_read CASCADE;DROP TABLE IF EXISTS public.market_observations,public.market_series CASCADE;
        CREATE TABLE public.market_series("id" text,"providerCode" text,"providerSeriesId" text,"providerSeriesKey" text,"displayName" text,"frequency" text,"currency" text,"unit" text,"sourceLabel" text);
        CREATE TABLE public.market_observations("seriesId" text,"observedAt" timestamp,"value" numeric(24,8));
        INSERT INTO public.market_series VALUES('market-one','MACROBOND','stored_series',null,'Shared source','monthly',null,'UNSUPPORTED_UNIT','Synthetic');
        INSERT INTO public.market_observations VALUES('market-one','2025-01-01',10),('market-one','2025-02-01',0),('market-one','2025-03-01',null);
        GRANT CREATE ON DATABASE ${DATABASE} TO ${sourceOwner};GRANT USAGE ON SCHEMA public TO ${sourceOwner};GRANT SELECT ON public.market_series,public.market_observations TO ${sourceOwner}`)
      const sourceSql=fs.readFileSync(new URL('../prisma-market-data/private-read/001-stored-history-read.sql',import.meta.url),'utf8')
      const sourceDigest=createHash('sha256').update(sourceSql).digest('hex')
      await owner.query('BEGIN');await owner.query(`SET LOCAL ROLE ${sourceOwner}`);await owner.query(sourceSql)
      await owner.query("INSERT INTO profitia_market_read.installation VALUES(true,'1.0.0',$1,'isolated-source-project','isolated-source-branch',$2,$3,'SYNTHETIC_NOT_A_RELEASE',now()+interval '1 hour')",[sourceDigest,DATABASE,sourceRole]);await owner.query('COMMIT')
      await owner.query(`GRANT USAGE ON SCHEMA profitia_market_read TO ${sourceRole};GRANT SELECT ON ALL TABLES IN SCHEMA profitia_market_read TO ${sourceRole}`)
      const sourceUrl=new URL(runtimeUrl);sourceUrl.username=sourceRole;sourceUrl.searchParams.set('schema','profitia_market_read');sourceUrl.searchParams.set('connection_limit','1')
      const sourcePrisma=new PrismaClient({datasources:{db:{url:sourceUrl.toString()}}})
      try{
        const{createStoredMarketHistoryReader}=await import('../lib/market-data/stored-read.ts')
        const{getBenchmarkPreview,getBenchmarkAnalyticsSeries}=await import('../lib/benchmark/service.ts')
        const{createOperationBenchmarkPreviewHandler}=await import('../lib/benchmark/preview-handlers.ts')
        const{createOperationBenchmarkAnalyticsHandler}=await import('../lib/benchmark/analytics-handlers.ts')
        const marketHost=createSg2PrivateMarketHost({...configuration,application:{...configuration.application,operations:['knowledge.read'],features:['market']}})
        const analyticsHost=createSg2PrivateMarketHost({...configuration,application:{...configuration.application,operations:['knowledge.read'],features:['market']}},'analytics')
        const readHistory=createStoredMarketHistoryReader(sourcePrisma,{projectId:'isolated-source-project',branchId:'isolated-source-branch',databaseName:DATABASE,role:sourceRole,schemaDigest:sourceDigest})
        let sourceReads=0
        const routes=createOperationBenchmarkPreviewHandler(marketHost,A,async selection=>{sourceReads++;return getBenchmarkPreview(selection.seriesName,selection.range,readHistory)})
        const input=(org=A,user=U,suffix='')=>new NextRequest(`${ORIGIN}/api/benchmark/preview?seriesName=stored_series&range=ALL&organisationId=${org}${suffix}`,{headers:{authorization:`Bearer external-${user}`}})
        let analyticsReads=0
        const analyticsRoutes=createOperationBenchmarkAnalyticsHandler(analyticsHost,A,async selection=>{analyticsReads++;return getBenchmarkAnalyticsSeries(selection.seriesName,selection.range,readHistory)})
        const analyticsInput=(org=A,user=U)=>new NextRequest(`${ORIGIN}/api/benchmark/analytics-series?seriesId=stored_series&range=ALL&organisationId=${org}`,{headers:{authorization:`Bearer external-${user}`}})
        const providerBefore=providerCalls
        await t.test('benchmark selection permissions alone do not authorize market source reads',async()=>{
          assert.equal((await routes(input())).status,403);assert.equal(sourceReads,0)
          assert.equal((await analyticsRoutes(analyticsInput())).status,403);assert.equal(analyticsReads,0)
        })
        for(const org of [A,B])await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'spendguru',$2,$3,'ALLOW','knowledge.read','market')",[randomUUID(),org,U])
        await t.test('current market permission still requires its product feature',async()=>{
          assert.equal((await routes(input())).status,403);assert.equal(sourceReads,0)
          assert.equal((await analyticsRoutes(analyticsInput())).status,403);assert.equal(analyticsReads,0)
        })
        await owner.query("UPDATE profitia_access.product_grants SET features=ARRAY['benchmark','category','market'] WHERE product='SPENDGURU'")
        await t.test('two authorized organisations read the same shared facts with separate actor/audit scope',async()=>{
          const responses=[]
          for(const org of [A,B]){const response=await routes(input(org));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');const data=await response.json();assert.equal(data.latestValue,0);assert.equal(data.unit,'UNSUPPORTED_UNIT');assert.deepEqual(data.historical.map(p=>p.value),[10,0,null]);responses.push(data)}
          assert.deepEqual(responses[0],responses[1]);assert.equal(sourceReads,2)
          const events=(await owner.query("SELECT event FROM profitia_access.security_events WHERE phase='OUTCOME' AND event->>'operation'='knowledge.read' ORDER BY event_id")).rows.map(x=>x.event)
          assert.deepEqual(events.map(x=>x.organisationId),[A,B]);assert(events.every(x=>x.actorId===U&&x.dataClass==='SHARED_KNOWLEDGE'&&x.ownerOrganisationId===null&&x.moduleEvidence.moduleId==='benchmark'))
        })
        await t.test('another member, forged headers and current DENY cannot invoke stored source',async()=>{
          const before=sourceReads;assert.equal((await routes(input(A,V))).status,403)
          assert.equal((await routes(new NextRequest(input().url,{headers:{'x-clerk-user-id':U,'x-clerk-org-id':A}}))).status,401)
          const id=randomUUID();await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'spendguru',$2,$3,'DENY','knowledge.read','market')",[id,A,U])
          try{assert.equal((await routes(input())).status,403)}finally{await owner.query('DELETE FROM profitia_access.permission_grants WHERE grant_id=$1',[id])}
          assert.equal(sourceReads,before)
        })
        await t.test('source receipt mismatch fails closed after authority without a private or provider fallback',async()=>{
          await owner.query("UPDATE profitia_market_read.installation SET branch_id='foreign-branch'")
          try{assert.equal((await routes(input())).status,503)}finally{await owner.query("UPDATE profitia_market_read.installation SET branch_id='isolated-source-branch'")}
        })
        await t.test('failed durable OUTCOME withholds a valid shared result and preserves independent FAILURE',async()=>{
          await owner.query("CREATE FUNCTION profitia_access.reject_market_outcome() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.phase='OUTCOME' AND NEW.event->>'operation'='knowledge.read' THEN RAISE EXCEPTION 'synthetic market audit outage'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_market_outcome BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION profitia_access.reject_market_outcome()")
          try{assert.equal((await routes(input())).status,503)}finally{await owner.query('DROP TRIGGER reject_market_outcome ON profitia_access.security_events;DROP FUNCTION profitia_access.reject_market_outcome()')}
          const events=(await owner.query("SELECT event FROM profitia_access.security_events WHERE event->>'operation'='knowledge.read' ORDER BY event_id DESC LIMIT 2")).rows.map(x=>x.event)
          assert.deepEqual(events.map(x=>x.phase),['FAILURE','INTENT']);assert.equal(events[0].decisionId,events[1].decisionId)
        })
        await t.test('alternate analytics API reads the same shared source for two current organisations with separate audit scope',async()=>{
          const values=[]
          for(const org of [A,B]){
            const response=await analyticsRoutes(analyticsInput(org));assert.equal(response.status,200)
            assert.equal(response.headers.get('cache-control'),'private, no-store')
            const data=await response.json();assert.equal(data.latestValue,0);assert.equal(data.unit,'UNSUPPORTED_UNIT')
            assert.deepEqual(data.historical.map(point=>point.value),[10,0,null])
            for(const field of ['organisationId','userId','changeMetrics'])assert.equal(field in data,false)
            values.push(data)
          }
          assert.deepEqual(values[0],values[1]);assert.equal(analyticsReads,2)
          const events=(await owner.query("SELECT event FROM profitia_access.security_events WHERE phase='OUTCOME' AND event->>'operation'='knowledge.read' ORDER BY event_id DESC LIMIT 2")).rows.map(row=>row.event)
          assert.deepEqual(events.map(event=>event.organisationId),[B,A])
          assert(events.every(event=>event.actorId===U&&event.dataClass==='SHARED_KNOWLEDGE'&&event.ownerOrganisationId===null))
        })
        await t.test('alternate analytics refuses foreign membership, forged identity, current suspension, DENY and revoked product before reading',async()=>{
          const before=analyticsReads
          assert.equal((await analyticsRoutes(analyticsInput(A,V))).status,403)
          assert.equal((await analyticsRoutes(analyticsInput('33333333-3333-4333-8333-333333333333'))).status,403)
          assert.equal((await analyticsRoutes(new NextRequest(analyticsInput().url,{headers:{'x-clerk-user-id':U,'x-clerk-org-id':A}}))).status,401)
          await owner.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2",[A,U])
          try{assert.equal((await analyticsRoutes(analyticsInput())).status,403)}finally{await owner.query("UPDATE profitia_access.memberships SET status='ACTIVE' WHERE organisation_id=$1 AND user_id=$2",[A,U])}
          const deny=randomUUID();await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'spendguru',$2,$3,'DENY','knowledge.read','market')",[deny,A,U])
          try{assert.equal((await analyticsRoutes(analyticsInput())).status,403)}finally{await owner.query('DELETE FROM profitia_access.permission_grants WHERE grant_id=$1',[deny])}
          await owner.query("UPDATE profitia_access.product_grants SET status='REVOKED' WHERE application_id='spendguru' AND organisation_id=$1 AND product='SPENDGURU'",[A])
          try{assert.equal((await analyticsRoutes(analyticsInput())).status,403)}finally{await owner.query("UPDATE profitia_access.product_grants SET status='ACTIVE' WHERE application_id='spendguru' AND organisation_id=$1 AND product='SPENDGURU'",[A])}
          assert.equal(analyticsReads,before)
        })
        await t.test('a preview host cannot be borrowed for the alternate analytics representation',async()=>{
          let calls=0
          const wrong=createOperationBenchmarkAnalyticsHandler(marketHost,A,async()=>{calls++;return{}})
          assert.equal((await wrong(analyticsInput())).status,403);assert.equal(calls,0)
        })
        await t.test('alternate analytics refuses a mismatched source receipt without fallback',async()=>{
          await owner.query("UPDATE profitia_market_read.installation SET branch_id='foreign-branch'")
          try{assert.equal((await analyticsRoutes(analyticsInput())).status,503)}finally{await owner.query("UPDATE profitia_market_read.installation SET branch_id='isolated-source-branch'")}
        })
        await t.test('alternate analytics withholds private fields added to otherwise valid shared output',async()=>{
          const tainted=createOperationBenchmarkAnalyticsHandler(analyticsHost,A,async selection=>({
            ...await getBenchmarkAnalyticsSeries(selection.seriesName,selection.range,readHistory),requesterNote:'synthetic_private_note',
          }))
          const response=await tainted(analyticsInput());assert.equal(response.status,403)
          assert(!(await response.text()).includes('synthetic_private_note'))
        })
        await t.test('alternate analytics withholds valid data when durable OUTCOME fails and records independent FAILURE',async()=>{
          await owner.query("CREATE FUNCTION profitia_access.reject_analytics_outcome() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.phase='OUTCOME' AND NEW.event->>'operation'='knowledge.read' THEN RAISE EXCEPTION 'synthetic analytics audit outage'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_analytics_outcome BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION profitia_access.reject_analytics_outcome()")
          try{assert.equal((await analyticsRoutes(analyticsInput())).status,503)}finally{await owner.query('DROP TRIGGER reject_analytics_outcome ON profitia_access.security_events;DROP FUNCTION profitia_access.reject_analytics_outcome()')}
          const events=(await owner.query("SELECT event FROM profitia_access.security_events WHERE event->>'operation'='knowledge.read' ORDER BY event_id DESC LIMIT 2")).rows.map(row=>row.event)
          assert.deepEqual(events.map(event=>event.phase),['FAILURE','INTENT']);assert.equal(events[0].decisionId,events[1].decisionId)
        })
        await t.test('Dashboard historical chart reads cross actual HTTP, current private authority and the ordinary market source',async t=>{
          const {createServer}=await import('node:http')
          const {createNativeMarketAnalyticsHandler}=await import('../../dashboard-preview/lib/time-series/native-analytics-relay.ts')
          const {createRuntimeBenchmarkAnalyticsHandler}=await import('../lib/benchmark/analytics-handlers.ts')
          // An explicit SDK fixture maps the unchanged synthetic HTTP value.
          // This proves current backend/SQL authority, not real Clerk signatures.
          const token=user=>`synthetic_header.${Buffer.from(user).toString('base64url')}.synthetic_signature`
          const tokens=new Map([U,V].map(user=>[`Bearer ${token(user)}`,user]))
          const relayClerk={...clerk,authenticateRequest:async(request,...args)=>{
            const headers=new Headers(request.headers),user=tokens.get(headers.get('authorization'))
            headers.set('authorization',user?`Bearer external-${user}`:'Bearer invalid')
            return clerk.authenticateRequest(new Request(request,{headers}),...args)
          }}
          let actualReads=0,ownerEscapes=0,omitMetadata=false
          const host=createSg2PrivateMarketHost({...configuration,clerk:relayClerk,
            application:{...configuration.application,operations:['knowledge.read'],features:['market']}},'analytics')
          const runtime={provider:'clerk',defaultOrganisationId:A,marketRead:{analytics:{executor:host,
            series:async selection=>{actualReads++;return getBenchmarkAnalyticsSeries(selection.seriesName,selection.range,readHistory)}}}}
          const handler=createRuntimeBenchmarkAnalyticsHandler(()=>runtime)
          const received=[],errors=[],globalNames=['dashboardPreviewPrisma','dashboardPreviewMarketDataPrisma']
          const descriptors=globalNames.map(name=>Object.getOwnPropertyDescriptor(globalThis,name))
          for(const name of globalNames)Object.defineProperty(globalThis,name,{configurable:true,get(){ownerEscapes++;throw Error('Forbidden legacy Dashboard owner')}})
          const server=createServer((incoming,outgoing)=>{void(async()=>{
            try{
              const url=new URL(incoming.url,ORIGIN)
              const headers=new Headers(Object.entries(incoming.headers).filter(([,value])=>value!==undefined).map(([key,value])=>[key,Array.isArray(value)?value.join(','):value]))
              received.push({path:url.pathname,authorization:headers.get('authorization'),cookie:headers.get('cookie'),forgedUser:headers.get('x-clerk-user-id')})
              const response=url.pathname==='/api/benchmark/analytics-series'?await handler(new NextRequest(url,{method:incoming.method,headers})):new Response(null,{status:404})
              outgoing.statusCode=response.status
              for(const[key,value]of response.headers)if(!omitMetadata||!key.startsWith('x-profitia-'))outgoing.setHeader(key,value)
              outgoing.end(Buffer.from(await response.arrayBuffer()))
            }catch(error){errors.push(error);outgoing.statusCode=503;outgoing.end('Synthetic fixture failure')}
          })()})
          await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)})
          const address=server.address();assert(address&&typeof address==='object')
          const env={APP_ENV:'development',TARGET_ENVIRONMENT:'development',PROFITIA_AUTH_PROVIDER:'clerk',PROFITIA_FORECAST_API_ORIGIN:'https://sg2-development-runtime.onrender.com',PROFITIA_FORECAST_API_CONFIGURATION_VERSION:'sg2-native-forecast-relay-dev-v1'}
          const relay=createNativeMarketAnalyticsHandler({env:()=>env,fetch:async(input,init)=>{
            const url=new URL(String(input));assert.equal(url.origin,env.PROFITIA_FORECAST_API_ORIGIN)
            assert.deepEqual([...new Headers(init.headers)].map(([key])=>key),['authorization']);assert.equal(init.redirect,'manual')
            return previousFetch(`http://127.0.0.1:${address.port}${url.pathname}${url.search}`,init)
          }})
          const input=(org=A,user=U)=>new Request(`https://dashboard.fixture.test/api/series?seriesId=stored_series&range=ALL&locale=pl&organisationId=${org}`,
            {headers:{authorization:`Bearer ${token(user)}`,cookie:'synthetic_legacy','x-clerk-user-id':V,'x-clerk-org-id':B}})
          try{
            await t.test('two authorised organisations receive the unchanged chart mapping and separate source audit',async()=>{
              const values=[]
              for(const org of[A,B]){
                const response=await relay(input(org));assert.equal(response.status,200,await response.clone().text())
                assert.equal(response.headers.get('cache-control'),'private, no-store')
                const value=await response.json();assert.equal(value.selection.componentCode,'stored_series')
                assert.deepEqual(value.historical.map(point=>point.value),[10,0,null]);assert.equal(value.sourceInfo.unit,'UNSUPPORTED_UNIT')
                assert.equal(value.sourceInfo.currency,null);assert.equal(value.detailSummary.metricValue,0);assert.equal(value.forecastAnchor.value,null)
                values.push(value)
              }
              assert.deepEqual(values[0],values[1]);assert.equal(actualReads,2)
              const events=(await owner.query("SELECT event FROM profitia_access.security_events WHERE phase='OUTCOME' AND event->>'resourceId'='market-analytics:stored_series' ORDER BY event_id DESC LIMIT 2")).rows.map(row=>row.event)
              assert.deepEqual(events.map(event=>event.organisationId),[B,A]);assert(events.every(event=>event.actorId===U&&event.dataClass==='SHARED_KNOWLEDGE'))
            })
            await t.test('revoked session, membership and permission are refused before source across the actual relay',async()=>{
              const before=actualReads
              assert.equal((await relay(input(A,V))).status,403)
              sdkRevoked=true;try{assert.equal((await relay(input())).status,401)}finally{sdkRevoked=false}
              await owner.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2",[A,U])
              try{assert.equal((await relay(input())).status,403)}finally{await owner.query("UPDATE profitia_access.memberships SET status='ACTIVE' WHERE organisation_id=$1 AND user_id=$2",[A,U])}
              const id=randomUUID();await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'spendguru',$2,$3,'DENY','knowledge.read','market')",[id,A,U])
              try{assert.equal((await relay(input())).status,403)}finally{await owner.query('DELETE FROM profitia_access.permission_grants WHERE grant_id=$1',[id])}
              assert.equal(actualReads,before)
            })
            await t.test('source, durable audit and missing native metadata each independently withhold the chart',async()=>{
              await owner.query("UPDATE profitia_market_read.installation SET branch_id='foreign-branch'")
              try{assert.equal((await relay(input())).status,503)}finally{await owner.query("UPDATE profitia_market_read.installation SET branch_id='isolated-source-branch'")}
              await owner.query("CREATE FUNCTION profitia_access.reject_dashboard_market_outcome() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.phase='OUTCOME' AND NEW.event->>'operation'='knowledge.read' THEN RAISE EXCEPTION 'synthetic audit outage'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_dashboard_market_outcome BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION profitia_access.reject_dashboard_market_outcome()")
              try{assert.equal((await relay(input())).status,503)}finally{await owner.query('DROP TRIGGER reject_dashboard_market_outcome ON profitia_access.security_events;DROP FUNCTION profitia_access.reject_dashboard_market_outcome()')}
              const events=(await owner.query("SELECT event FROM profitia_access.security_events WHERE event->>'resourceId'='market-analytics:stored_series' ORDER BY event_id DESC LIMIT 2")).rows.map(row=>row.event)
              assert.deepEqual(events.map(event=>event.phase),['FAILURE','INTENT']);assert.equal(events[0].decisionId,events[1].decisionId)
              omitMetadata=true;try{assert.equal((await relay(input())).status,503)}finally{omitMetadata=false}
            })
            await t.test('real presentation ports read through this actual API and ordinary source without a child credential or cached authority',async t=>{
              const{openEmbeddedReadClient}=await import('@profitia/platform-contracts/embedded-read-channel')
              const{openNativeDashboardReadHost,nativeDashboardContext}=await import('../lib/platform/native-dashboard-embed.ts')
              const{createEmbeddedChartFetch,readNativeEmbeddedConfiguration}=await import('../../dashboard-preview/lib/platform/native-embedded-read.ts')
              const{selectNativeEmbedPage}=await import('../../dashboard-preview/lib/platform/native-chart-publication.ts')
              const config=readNativeEmbeddedConfiguration({...env,PROFITIA_NATIVE_EMBED_ENABLED:'true'})
              assert(config)
              const connect=(org=A)=>{
                const url=`${config.childOrigin}/pl?embed=1&variantId=forecast-portfolio-v3&showForecast=false&preparedReadsOnly=1&seriesId=stored_series&range=1Y&organisationId=${org}`
                const pair=new MessageChannel(),instanceId=randomUUID()
                const host=openNativeDashboardReadHost({port:pair.port1,instanceId,context:nativeDashboardContext(url,env.PROFITIA_FORECAST_API_ORIGIN),getToken:async()=>token(U),
                  fetch:async(input,init)=>{const target=new URL(String(input));assert.equal(target.origin,env.PROFITIA_FORECAST_API_ORIGIN)
                    return previousFetch(`http://127.0.0.1:${address.port}${target.pathname}${target.search}`,init)}})
                const client=openEmbeddedReadClient({port:pair.port2,instanceId})
                const chart=createEmbeddedChartFetch(client,config,selectNativeEmbedPage(url))
                t.after(()=>{client.close();host.close()})
                return chart
              }
              const a=connect(),b=connect(B),path='/api/series?seriesId=stored_series&range=ALL&locale=pl'
              const values=[]
              for(const chart of[a,b]){
                const response=await chart(path);assert.equal(response.status,200,await response.clone().text())
                const value=await response.json();assert.deepEqual(value.historical.map(point=>point.value),[10,0,null]);assert.equal(value.sourceInfo.currency,null)
                assert(!JSON.stringify(value).includes(token(U)));values.push(value)
              }
              assert.deepEqual(values[0],values[1])
              const before=actualReads
              await owner.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2",[A,U])
              try{assert.equal((await a(path)).status,403)}finally{await owner.query("UPDATE profitia_access.memberships SET status='ACTIVE' WHERE organisation_id=$1 AND user_id=$2",[A,U])}
              assert.equal(actualReads,before)
              // The same already-created port does not cache a previous grant.
              assert.equal((await a(path)).status,200);assert.equal(actualReads,before+1)
              omitMetadata=true;try{assert.equal((await a(path)).status,503)}finally{omitMetadata=false}
              sdkRevoked=true;try{assert.equal((await a(path)).status,401)}finally{sdkRevoked=false}
            })
            assert(received.every(value=>value.path==='/api/benchmark/analytics-series'&&tokens.has(value.authorization)&&value.cookie===null&&value.forgedUser===null))
            assert.equal(ownerEscapes,0);assert.deepEqual(errors,[])
          }finally{
            server.closeAllConnections();await new Promise(resolve=>server.close(resolve))
            for(const[index,name]of globalNames.entries()){const descriptor=descriptors[index];if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name]}
          }
        })
        await t.test('native analytics eligibility uses the current private guard and ordinary market source before advertising a scoped chart',async t=>{
          const {createRuntimeAnalyticsEligibilityHandler}=await import('../lib/benchmark/analytics-eligibility-handlers.ts')
          const targets=(await import('../deployment/private-runtime-targets.json',{with:{type:'json'}})).default
          const dashboard=targets.environments.development.dashboardEmbed
          const binding={origin:dashboard.origin,configurationVersion:dashboard.configurationVersion,applicationId:'spendguru',environment:'development'}
          let reads=0
          const runtime={provider:'clerk',executor:analyticsHost,defaultOrganisationId:A,dashboardEmbed:binding,
            marketRead:{executor:analyticsHost,preview:async()=>{throw Error('No preview fallback')},analytics:{executor:analyticsHost,
              series:async selection=>{reads++;return getBenchmarkAnalyticsSeries(selection.seriesName,selection.range,readHistory)}}}}
          const handler=createRuntimeAnalyticsEligibilityHandler(()=>runtime)
          const input=(org=A,user=U,suffix='')=>new NextRequest(`${ORIGIN}/api/benchmark/analytics-eligibility?locale=en&seriesId=stored_series&displayName=Shared+facts${org?`&organisationId=${org}`:''}${suffix}`,
            {headers:{authorization:`Bearer external-${user}`,'x-clerk-user-id':V,'x-clerk-org-id':B}})
          await t.test('two independently authorised organisations and the explicit default retain chart identity without warmup',async()=>{
            for(const org of[A,B,null]){
              const response=await handler(input(org));assert.equal(response.status,200,await response.clone().text())
              assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('vary'),'Cookie, Authorization')
              const value=await response.json();assert.equal(value.eligible,true);assert.equal(value.componentCode,null)
              assert.equal(value.forecastPortfolioEnabled,true)
              const url=new URL(value.analyticsUrl);assert.equal(url.origin,binding.origin);assert.equal(url.pathname,'/en')
              assert.equal(url.searchParams.get('organisationId'),org??A);assert.equal(url.searchParams.get('seriesId'),'stored_series')
              assert.equal(url.searchParams.get('range'),'1Y');assert.equal(url.searchParams.get('displayName'),'Shared facts')
              assert.equal(url.searchParams.get('preparedReadsOnly'),'1');assert.equal(url.searchParams.has('warmCurrentForecast'),false)
              assert.equal(url.username,'');assert.equal(url.password,'');assert.equal(url.hash,'')
            }
            assert.equal(reads,3)
            const events=(await owner.query("SELECT event FROM profitia_access.security_events WHERE phase='OUTCOME' AND event->>'resourceId'='market-analytics:stored_series' ORDER BY event_id DESC LIMIT 3")).rows.map(row=>row.event)
            assert.deepEqual(events.map(event=>event.organisationId),[A,B,A]);assert(events.every(event=>event.actorId===U&&event.dataClass==='SHARED_KNOWLEDGE'))
          })
          await t.test('current session, membership, permission and product revocation withhold routing before source',async()=>{
            const before=reads
            assert.equal((await handler(input(A,V))).status,403)
            sdkRevoked=true;try{assert.equal((await handler(input())).status,401)}finally{sdkRevoked=false}
            await owner.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2",[A,U])
            try{assert.equal((await handler(input())).status,403)}finally{await owner.query("UPDATE profitia_access.memberships SET status='ACTIVE' WHERE organisation_id=$1 AND user_id=$2",[A,U])}
            const id=randomUUID();await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'spendguru',$2,$3,'DENY','knowledge.read','market')",[id,A,U])
            try{assert.equal((await handler(input())).status,403)}finally{await owner.query('DELETE FROM profitia_access.permission_grants WHERE grant_id=$1',[id])}
            await owner.query("UPDATE profitia_access.product_grants SET status='REVOKED' WHERE application_id='spendguru' AND organisation_id=$1 AND product='SPENDGURU'",[A])
            try{assert.equal((await handler(input())).status,403)}finally{await owner.query("UPDATE profitia_access.product_grants SET status='ACTIVE' WHERE application_id='spendguru' AND organisation_id=$1 AND product='SPENDGURU'",[A])}
            assert.equal(reads,before)
          })
          await t.test('wrong source or failed durable outcome cannot leak a usable chart URL',async()=>{
            await owner.query("UPDATE profitia_market_read.installation SET branch_id='foreign-branch'")
            try{const response=await handler(input());assert.equal(response.status,503);assert(!(await response.text()).includes('analyticsUrl'))}
            finally{await owner.query("UPDATE profitia_market_read.installation SET branch_id='isolated-source-branch'")}
            await owner.query("CREATE FUNCTION profitia_access.reject_eligibility_outcome() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.phase='OUTCOME' AND NEW.event->>'operation'='knowledge.read' THEN RAISE EXCEPTION 'synthetic audit outage'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_eligibility_outcome BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION profitia_access.reject_eligibility_outcome()")
            try{const response=await handler(input());assert.equal(response.status,503);assert(!(await response.text()).includes('analyticsUrl'))}
            finally{await owner.query('DROP TRIGGER reject_eligibility_outcome ON profitia_access.security_events;DROP FUNCTION profitia_access.reject_eligibility_outcome()')}
            const events=(await owner.query("SELECT event FROM profitia_access.security_events WHERE event->>'resourceId'='market-analytics:stored_series' ORDER BY event_id DESC LIMIT 2")).rows.map(row=>row.event)
            assert.deepEqual(events.map(event=>event.phase),['FAILURE','INTENT']);assert.equal(events[0].decisionId,events[1].decisionId)
          })
          await t.test('unknown native warmup or a foreign child binding is refused before source',async()=>{
            const before=reads
            for(const suffix of['&forecastWarmupExperiment=single','&warmCurrentForecast=1','&userId=forged','&seriesId=stored_series']){
              assert.equal((await handler(input(A,U,suffix))).status,400)
            }
            const wrong=createRuntimeAnalyticsEligibilityHandler(()=>({...runtime,dashboardEmbed:{...binding,origin:'https://foreign.test'}}))
            assert.equal((await wrong(input())).status,503);assert.equal(reads,before)
          })
          await t.test('a successful actual audited read still needs its admitted native publication metadata',async()=>{
            const executor={...analyticsHost,execute:async(...args)=>{
              const result=await analyticsHost.execute(...args)
              result.value.headers.delete('x-profitia-market-projection')
              return result
            }}
            const handler=createRuntimeAnalyticsEligibilityHandler(()=>({...runtime,
              marketRead:{...runtime.marketRead,analytics:{...runtime.marketRead.analytics,executor}}}))
            const response=await handler(input());assert.equal(response.status,503)
            assert(!(await response.text()).includes('analyticsUrl'))
          })
        })
        assert.equal(providerCalls,providerBefore)
      }finally{await sourcePrisma.$disconnect()}
    })

    await t.test('native current forecast API combines current private authority with an independently restricted genuine source ORM', async t => {
      const sourceOwner='profitia_forecast_read_owner',sourceRole='sg2_private_host_forecast_reader'
      for(const[role,login]of[[sourceOwner,false],[sourceRole,true]]) {
        if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount)await root.query(`CREATE ROLE ${role} ${login?"LOGIN PASSWORD 'isolated_ci_only'":'NOLOGIN'} NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`)
      }
      await root.query(`ALTER ROLE ${sourceRole} CONNECTION LIMIT 1`)
      await root.query(`ALTER ROLE ${sourceRole} SET default_transaction_read_only=on`)
      await owner.query(`CREATE TYPE public."ForecastTargetBasis" AS ENUM('MONTHLY_AVERAGE','END_OF_PERIOD','POINT_IN_TIME');
        CREATE TABLE public.rolling_daily_current_forecast_snapshots("id" text PRIMARY KEY,"seriesId" text,"inputSource" text,"inputRunId" text,"targetBasis" public."ForecastTargetBasis",
          "methodId" text,"methodVersion" text,"modelId" text,"trainingWindowPolicyId" text,"effectiveTrainingPolicyId" text,"sourceHistoryFingerprint" text,
          "contractVersion" text,"status" text,"reasonCode" text,"message" text,"forecastOriginAt" timestamp,"sourceLatestObservationAt" timestamp,"payloadJson" jsonb,
          "createdAt" timestamp DEFAULT now(),"updatedAt" timestamp DEFAULT now());
        GRANT CREATE ON DATABASE ${DATABASE} TO ${sourceOwner}; GRANT USAGE ON SCHEMA public,profitia_market_read TO ${sourceOwner};
        GRANT SELECT ON profitia_market_read.series TO ${sourceOwner};
        GRANT SELECT("id","seriesId","inputSource","targetBasis","methodId","methodVersion","modelId","trainingWindowPolicyId","effectiveTrainingPolicyId","sourceHistoryFingerprint",
          "contractVersion","status","forecastOriginAt","sourceLatestObservationAt","payloadJson","createdAt","updatedAt") ON public.rolling_daily_current_forecast_snapshots TO ${sourceOwner}`)
      await owner.query(`
      DROP TABLE IF EXISTS public.forecast_current_points,public.forecast_current_runs CASCADE;
      CREATE TABLE public.forecast_current_runs (
        id text PRIMARY KEY,"seriesId" text,"displayName" text,description text,frequency text,currency text,unit text,"sourceLabel" text,
        "inputSource" text,"inputRunId" text,"historyFingerprint" text,"targetBasis" public."ForecastTargetBasis","methodId" text,
        "historyStartAt" timestamp,"historyEndAt" timestamp,"observationCount" integer,"forecastOriginAt" timestamp,
        "modelId" text,"methodVersion" text,"trainingWindowPolicyId" text,"effectiveTrainingPolicyId" text,
        status text,"failureReason" text,"runtimeSeconds" double precision,"createdAt" timestamp DEFAULT now(),"updatedAt" timestamp DEFAULT now());
      CREATE TABLE public.forecast_current_points (
        id text PRIMARY KEY,"runId" text REFERENCES public.forecast_current_runs(id),"horizonLabel" text,"horizonSteps" integer,
        "forecastDate" timestamp,"forecastValue" numeric(24,8),"fitStatus" text,"failureReason" text,"selectedVariant" text,
        "selectionMetric" text,"selectionScore" double precision,"metadataJson" jsonb,"createdAt" timestamp DEFAULT now(),"updatedAt" timestamp DEFAULT now());
      GRANT SELECT(id,"seriesId",frequency,"inputSource","historyFingerprint","targetBasis","methodId","historyStartAt","historyEndAt",
        "observationCount","forecastOriginAt","modelId","methodVersion","trainingWindowPolicyId","effectiveTrainingPolicyId",status,"runtimeSeconds","createdAt","updatedAt")
        ON public.forecast_current_runs TO ${sourceOwner};
      GRANT SELECT(id,"runId","horizonLabel","horizonSteps","forecastDate","forecastValue","metadataJson","createdAt","updatedAt")
        ON public.forecast_current_points TO ${sourceOwner};`)
      await createEmptyVerificationSourceFixture(owner)
      await grantVerificationProjectionSourceColumns(owner,sourceOwner)
      const sql=fs.readFileSync(new URL('../prisma-market-data/private-read/002-stored-rolling-current.sql',import.meta.url),'utf8')
      const sourceDigest=createHash('sha256').update(sql).digest('hex')
      const marketDigest=createHash('sha256').update(fs.readFileSync(new URL('../prisma-market-data/private-read/001-stored-history-read.sql',import.meta.url))).digest('hex')
      await owner.query('BEGIN');await owner.query(`SET LOCAL ROLE ${sourceOwner}`);await owner.query(sql)
      await owner.query("INSERT INTO profitia_forecast_read.installation VALUES(true,'3.0.2',$1,$2,'isolated-source-project','isolated-source-branch',$3,$4,'SYNTHETIC_NOT_A_RELEASE',now()+interval '1 hour')",[sourceDigest,marketDigest,DATABASE,sourceRole]);await owner.query('COMMIT')
      await owner.query(`REVOKE CREATE ON DATABASE ${DATABASE} FROM ${sourceOwner}; GRANT USAGE ON SCHEMA profitia_forecast_read,profitia_market_read TO ${sourceRole};
        GRANT SELECT ON profitia_market_read.series,profitia_market_read.observations TO ${sourceRole};
        GRANT SELECT ON ALL TABLES IN SCHEMA profitia_forecast_read TO ${sourceRole};
        GRANT USAGE ON TYPE profitia_forecast_read."ForecastTargetBasis",profitia_forecast_read."RollingDailyVerificationMaturityStatus" TO ${sourceRole};GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA profitia_forecast_read TO ${sourceRole}`)
      const {PrismaClient:MarketClient}=await import('../generated/market-data-client/index.js')
      const {createStoredCurrentForecastReader}=await import('../lib/forecast/stored-current-read.ts')
      const {buildRollingDailyHistoryFingerprint,ROLLING_DAILY_INPUT_SOURCE}=await import('../lib/forecast/rolling-daily-maintenance.ts')
      const {createCurrentForecastStatisticalCompatibility}=await import('../lib/forecast/identity.ts')
      const {createOperationForecastCurrentHandler}=await import('../lib/forecast/current-operation-handlers.ts')
      const points=Array.from({length:60},(_,index)=>({date:new Date(Date.UTC(2025,0,1+index)).toISOString(),value:0}))
      const seriesId='stored_forecast_daily'
      await owner.query("INSERT INTO public.market_series VALUES('daily-forecast','MACROBOND',$1,null,'Shared daily source','daily',null,'ORIGINAL_UNIT','Synthetic')",[seriesId])
      for(const point of points)await owner.query('INSERT INTO public.market_observations VALUES($1,$2,$3)',['daily-forecast',point.date,point.value])
      const hash=buildRollingDailyHistoryFingerprint({seriesId,displayName:'Shared daily source',description:'Shared daily source',frequency:'DAILY',source:'Synthetic',points})
      const compatibility=createCurrentForecastStatisticalCompatibility({sourceFrequency:'DAILY',targetCadence:'DAILY',targetSemantics:'ROLLING_DAILY_POINT_IN_TIME'})
      const band={status:'NOT_AVAILABLE',reasonCode:'CALIBRATION_NOT_AVAILABLE',source:null,lower:null,upper:null,sampleCount:null}
      const anchors=[['1M',1,'2025-04-01'],['3M',3,'2025-06-01'],['6M',6,'2025-09-01'],['12M',12,'2026-03-01']].map(([horizon,horizonMonths,targetCalendarDate])=>({horizon,horizonMonths,targetCalendarDate,pointForecast:0,band:{...band,p10ResidualOffset:null,p90ResidualOffset:null}}))
      const body={contractVersion:'1',status:'AVAILABLE',privateRequest:'SYNTHETIC_PRIVATE_FORECAST_MARKER',
        benchmark:{benchmarkId:seriesId,displayName:'Shared daily source',frequency:'DAILY',unit:'ORIGINAL_UNIT',currency:null,provider:'macrobond',providerSeriesId:seriesId},
        forecastMethod:{id:'ROLLING_DAILY_POINT_IN_TIME',version:'rolling-daily-point-in-time-v1'},
        model:{id:'naive',selectedCandidate:null,selectionMetric:null,selectionScore:null,selectedParameters:null},origin:{date:'2025-03-01',value:0},maxHorizonMonths:12,anchors,
        path:anchors.map(anchor=>({date:anchor.targetCalendarDate,pointForecast:0,band})),
        calibration:{availabilityStatus:'NOT_AVAILABLE',freshnessStatus:null,quantileConvention:'HF7_LINEAR_INTERPOLATION',coverageLabel:'80% empirical prediction band',methodologicalMinimumStatus:'OPEN_REQUIRES_MORE_BENCHMARK_VALIDATION',updatedAt:null,processedThrough:null,lastResidualAvailabilityDate:null},
        audit:{generatedAt:'2025-03-01T00:00:00.000Z',sourceLatestObservationDate:'2025-03-01',calendarProjectionMode:'OBSERVED_WEEKDAY_SET',projectionCalendarStrategy:'OBSERVED_WEEKDAY_SET_V1',technicalMinimumTrainingObservations:60,methodologicalTrainingEligibilityStatus:'OPEN_REQUIRES_CROSS_BENCHMARK_VALIDATION',calibrationUpdatedAt:null,calibrationLastResidualAvailabilityDate:null,inputSource:ROLLING_DAILY_INPUT_SOURCE,sourceHistoryFingerprint:hash},warnings:[]}
      await owner.query(`INSERT INTO public.rolling_daily_current_forecast_snapshots("id","seriesId","inputSource","inputRunId","targetBasis","methodId","methodVersion","modelId","trainingWindowPolicyId","effectiveTrainingPolicyId","sourceHistoryFingerprint","contractVersion","status","forecastOriginAt","sourceLatestObservationAt","payloadJson")
        VALUES('prepared',$1,$2,'SYNTHETIC_PRIVATE_FORECAST_MARKER','POINT_IN_TIME','ROLLING_DAILY_POINT_IN_TIME','rolling-daily-point-in-time-v1','naive',$3,$4,$5,'1','AVAILABLE','2025-03-01','2025-03-01',$6::jsonb)`,[seriesId,ROLLING_DAILY_INPUT_SOURCE,compatibility.trainingWindowPolicyId,compatibility.effectiveTrainingPolicyId,hash,JSON.stringify(body)])
      const sourceUrl=new URL(runtimeUrl);sourceUrl.username=sourceRole;sourceUrl.searchParams.set('schema','profitia_forecast_read');sourceUrl.searchParams.set('connection_limit','1')
      const source=new MarketClient({datasources:{db:{url:sourceUrl.toString()}}})
      try{
        const read=createStoredCurrentForecastReader(source,{projectId:'isolated-source-project',branchId:'isolated-source-branch',databaseName:DATABASE,role:sourceRole,schemaDigest:sourceDigest,marketSchemaDigest:marketDigest})
        const forecastConfig={...configuration,application:{...configuration.application,operations:['forecast.read'],features:['forecast']}}
        const forecastHost=createSg2PrivateForecastCurrentHost(forecastConfig)
        let sourceReads=0;const current=async selection=>{sourceReads++;return read(selection)}
        const routes=createOperationForecastCurrentHandler(forecastHost,A,current)
        const input=(org=A,user=U,model='naive')=>new NextRequest(`${ORIGIN}/api/benchmark/forecast/current?seriesId=${seriesId}&model=${model}&targetBasis=POINT_IN_TIME&organisationId=${org}`,{headers:{authorization:`Bearer external-${user}`}})
        const providerBefore=providerCalls
        await t.test('knowledge and benchmark permissions do not lend forecast.read',async()=>{assert.equal((await routes(input())).status,403);assert.equal(sourceReads,0)})
        for(const org of[A,B])await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'spendguru',$2,$3,'ALLOW','forecast.read','forecast')",[randomUUID(),org,U])
        await t.test('forecast permission alone cannot replace its product feature',async()=>{assert.equal((await routes(input())).status,403);assert.equal(sourceReads,0)})
        await owner.query("UPDATE profitia_access.product_grants SET features=ARRAY['benchmark','category','market','forecast'] WHERE product='SPENDGURU'")
        await t.test('two authorised organisations receive the same statistical result with independent current access audit',async()=>{
          const values=[]
          for(const org of[A,B]){const result=await routes(input(org));assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'private, no-store');const value=await result.json();assert.equal(value.status,'AVAILABLE');assert.equal(value.origin.value,0);assert.equal(value.benchmark.unit,'ORIGINAL_UNIT');assert(value.path.every(p=>p.pointForecast===0));assert(!JSON.stringify(value).includes('SYNTHETIC_PRIVATE_FORECAST_MARKER'));values.push(value)}
          assert.deepEqual(values[0],values[1]);assert.equal(sourceReads,2)
          const events=(await owner.query("SELECT event FROM profitia_access.security_events WHERE phase='OUTCOME' AND event->>'operation'='forecast.read' ORDER BY event_id DESC LIMIT 2")).rows.map(row=>row.event)
          assert.deepEqual(events.map(e=>e.organisationId),[B,A]);assert(events.every(e=>e.actorId===U&&e.dataClass==='SHARED_KNOWLEDGE'&&e.ownerOrganisationId===null&&e.moduleEvidence.moduleId==='benchmark'))
        })
        await t.test('foreign membership, forged identity and current account/membership/session/permission/product/module revocations stop before source reads',async()=>{
          const before=sourceReads
          assert.equal((await routes(input(A,V))).status,403);assert.equal((await routes(input('33333333-3333-4333-8333-333333333333'))).status,403)
          assert.equal((await routes(new NextRequest(input().url,{headers:{'x-clerk-user-id':U,'x-clerk-org-id':A}}))).status,401)
          sdkRevoked=true;try{assert.equal((await routes(input())).status,401)}finally{sdkRevoked=false}
          for(const[deny,restore,values,status=403]of[
            ["UPDATE profitia_access.accounts SET status='DISABLED' WHERE user_id=$1","UPDATE profitia_access.accounts SET status='ACTIVE' WHERE user_id=$1",[U],401],
            ["UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2","UPDATE profitia_access.memberships SET status='ACTIVE' WHERE organisation_id=$1 AND user_id=$2",[A,U]],
            ["UPDATE profitia_access.product_grants SET status='REVOKED' WHERE application_id='spendguru' AND product='SPENDGURU' AND organisation_id=$1","UPDATE profitia_access.product_grants SET status='ACTIVE' WHERE application_id='spendguru' AND product='SPENDGURU' AND organisation_id=$1",[A]],
            ["UPDATE profitia_modules.application_bindings SET status='REVOKED' WHERE application_id='spendguru' AND module_id='benchmark'","UPDATE profitia_modules.application_bindings SET status='ACTIVE' WHERE application_id='spendguru' AND module_id='benchmark'",[]],
          ]){await owner.query(deny,values);try{assert.equal((await routes(input())).status,status)}finally{await owner.query(restore,values)}}
          const id=randomUUID();await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'spendguru',$2,$3,'DENY','forecast.read','forecast')",[id,A,U])
          try{assert.equal((await routes(input())).status,403)}finally{await owner.query('DELETE FROM profitia_access.permission_grants WHERE grant_id=$1',[id])}
          assert.equal(sourceReads,before)
        })
        await t.test('dedicated profile, caller context tricks and borrowed knowledge hosts cannot select a foreign organisation or forecast authority',async()=>{
          const before=sourceReads
          const fixed=createSg2PrivateForecastCurrentHost({...forecastConfig,application:{...forecastConfig.application,profileId:'PORR_SUITE',organisationId:A}})
          assert.equal((await createOperationForecastCurrentHandler(fixed,A,current)(input(B))).status,400)
          for(const suffix of['&organisationId='+A,'&actorId='+U,'&operation=knowledge.read','&model=ets'])assert.equal((await routes(new NextRequest(input().url+suffix,{headers:input().headers}))).status,400)
          assert.equal((await routes(new NextRequest(input().url,{headers:{...Object.fromEntries(input().headers),'x-sg-prepared-history-fingerprint':'forged'}}))).status,400)
          const market=createSg2PrivateMarketHost({...configuration,application:{...configuration.application,operations:['knowledge.read'],features:['market']}})
          assert.equal((await createOperationForecastCurrentHandler(market,A,current)(input())).status,403);assert.equal(sourceReads,before)
        })
        await t.test('honest missing and stale outcomes never refit, write or invoke a provider',async()=>{
          let response=await routes(input(A,U,'ets'));assert.equal(response.status,200);assert.equal((await response.json()).status,'NOT_AVAILABLE')
          await owner.query("UPDATE public.market_observations SET value=1 WHERE \"seriesId\"='daily-forecast' AND \"observedAt\"='2025-01-01'")
          try{response=await routes(input());assert.equal(response.status,200);assert.match((await response.json()).reason,/STALE/)}finally{await owner.query("UPDATE public.market_observations SET value=0 WHERE \"seriesId\"='daily-forecast'")}
          const events=(await owner.query("SELECT event FROM profitia_access.security_events WHERE phase='OUTCOME' AND event->>'operation'='forecast.read' ORDER BY event_id DESC LIMIT 2")).rows.map(r=>r.event)
          assert(events.every(e=>e.reasonCode==='NO_DATA'));assert.equal(providerCalls,providerBefore)
        })
        await t.test('stored failed computations are returned without diagnostics and recorded as NO_DATA rather than a successful forecast',async()=>{
          const failed={contractVersion:body.contractVersion,status:'FAILED',benchmark:body.benchmark,forecastMethod:body.forecastMethod,
            model:body.model,audit:body.audit,warnings:[],reasonCode:'MODEL_FIT_FAILED',message:'SYNTHETIC_PRIVATE_FORECAST_MARKER'}
          await owner.query('UPDATE public.rolling_daily_current_forecast_snapshots SET status=\'FAILED\',"payloadJson"=$1::jsonb WHERE id=\'prepared\'',[JSON.stringify(failed)])
          try{const result=await routes(input());assert.equal(result.status,200);const value=await result.json();assert.equal(value.status,'FAILED');assert.equal(value.message,null);assert.equal('path' in value,false)
            const event=(await owner.query("SELECT event FROM profitia_access.security_events WHERE phase='OUTCOME' AND event->>'operation'='forecast.read' ORDER BY event_id DESC LIMIT 1")).rows[0].event;assert.equal(event.reasonCode,'NO_DATA')}
          finally{await owner.query('UPDATE public.rolling_daily_current_forecast_snapshots SET status=\'AVAILABLE\',"payloadJson"=$1::jsonb WHERE id=\'prepared\'',[JSON.stringify(body)])}
        })
        await t.test('receipt drift and tainted output are withheld with no raw diagnostic or metadata',async()=>{
          await owner.query("UPDATE profitia_forecast_read.installation SET branch_id='foreign'")
          try{assert.equal((await routes(input())).status,503)}finally{await owner.query("UPDATE profitia_forecast_read.installation SET branch_id='isolated-source-branch'")}
          const bad=createOperationForecastCurrentHandler(forecastHost,A,async selection=>({...await read(selection),privateUser:'SYNTHETIC_PRIVATE_FORECAST_MARKER'}))
          const response=await bad(input());assert.equal(response.status,403);assert(!(await response.text()).includes('SYNTHETIC_PRIVATE_FORECAST_MARKER'))
        })
        await t.test('OUTCOME audit outage withholds valid data and preserves independently durable FAILURE',async()=>{
          await owner.query("CREATE FUNCTION profitia_access.reject_forecast_outcome() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.phase='OUTCOME' AND NEW.event->>'operation'='forecast.read' THEN RAISE EXCEPTION 'synthetic forecast audit outage'; END IF; RETURN NEW; END $$;CREATE TRIGGER reject_forecast_outcome BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION profitia_access.reject_forecast_outcome()")
          try{const response=await routes(input());assert.equal(response.status,503);assert(!(await response.text()).includes('synthetic forecast audit outage'))}finally{await owner.query('DROP TRIGGER reject_forecast_outcome ON profitia_access.security_events;DROP FUNCTION profitia_access.reject_forecast_outcome()')}
          const events=(await owner.query("SELECT event FROM profitia_access.security_events WHERE event->>'operation'='forecast.read' ORDER BY event_id DESC LIMIT 2")).rows.map(r=>r.event)
          assert.deepEqual(events.map(e=>e.phase),['FAILURE','INTENT']);assert.equal(events[0].decisionId,events[1].decisionId)
        })
        await t.test('Verification API independently enforces current organisation authority on the genuine restricted source',async t=>{
          const {createStoredForecastVerificationReader}=await import('../lib/forecast/stored-verification-read.ts')
          const {createOperationForecastVerificationHandler}=await import('../lib/forecast/verification-operation-handlers.ts')
          for(let i=0;i<24;i++){
            const target=new Date(points.at(-1).date);target.setUTCDate(target.getUTCDate()-i)
            const origin=new Date(target);origin.setUTCDate(origin.getUTCDate()-30)
            await owner.query(`INSERT INTO public.rolling_daily_verification_records(id,"seriesId","inputSource","inputRunId","targetBasis","methodId","methodVersion","modelId",
              "forecastOriginAt","horizonLabel","horizonMonths","horizonSteps","targetCalendarDate","verificationObservedAt","maturityStatus","originValue","forecastValue","actualValue","errorValue","absoluteErrorValue","deltaValue","deltaPct","residualValue","maseScale","trainingHistoryStartAt","trainingHistoryEndAt","trainingObservationCount","sourceHistoryFingerprint")
              VALUES($1,$2,'DYNAMIC_MARKET_DATA_STORE','SYNTHETIC_PRIVATE_FORECAST_MARKER','POINT_IN_TIME','ROLLING_DAILY_POINT_IN_TIME','rolling-daily-point-in-time-v1','naive',$3,'1M',1,$4,$5,$5,'MATURED',0,0,0,0,0,0,NULL,0,0,$6,$3,30,$7)`,
              [`verification_${i}`,seriesId,origin,20+i,target,points[0].date,hash])
          }
          await owner.query(`INSERT INTO public.rolling_daily_maintenance_state(id,"seriesId","inputSource","inputRunId","targetBasis","methodId","methodVersion","modelId",
            "historicalOriginStartAt","minimumTrainingObservations","minimumCalibrationSamples","latestSourceObservationAt","latestSourceHistoryFingerprint","lastProcessedOriginAt","lastMaintenanceStatus","lastFailureReason")
            VALUES('verification_state',$1,'DYNAMIC_MARKET_DATA_STORE','SYNTHETIC_PRIVATE_FORECAST_MARKER','POINT_IN_TIME','ROLLING_DAILY_POINT_IN_TIME','rolling-daily-point-in-time-v1','naive',$2,36,24,$3,$4,$3,'SUCCEEDED','SYNTHETIC_PRIVATE_FORECAST_MARKER')`,[seriesId,points[0].date,points.at(-1).date,hash])
          const sourceRead=createStoredForecastVerificationReader(source,{projectId:'isolated-source-project',branchId:'isolated-source-branch',databaseName:DATABASE,role:sourceRole,schemaDigest:sourceDigest,marketSchemaDigest:marketDigest})
          const host=createSg2PrivateForecastVerificationHost(forecastConfig)
          let reads=0;const read=async selected=>{reads++;return sourceRead(selected)}
          const routes=createOperationForecastVerificationHandler(host,A,read)
          const input=(org=A,user=U,scope='')=>new NextRequest(`${ORIGIN}/api/benchmark/forecast/verification?seriesId=${seriesId}&model=naive&targetBasis=POINT_IN_TIME&organisationId=${org}`+(scope?`&verificationScope=${scope}`:''),{headers:{authorization:`Bearer external-${user}`}})
          await t.test('two organisations independently read the same public statistics in FAST/FULL/RECENT without leaking source initiators',async()=>{
            for(const scope of['','FULL','RECENT']){
              const values=[]
              for(const org of[A,B]){const response=await routes(input(org,U,scope));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store')
                const value=await response.json();assert.equal(value.status,'AVAILABLE',JSON.stringify(value));assert.equal(value.verification['1M'].records.length,24);assert.equal(value.verification['1M'].metrics.mae,0);assert.equal(value.source.runId,null);assert(!JSON.stringify(value).includes('SYNTHETIC_PRIVATE_FORECAST_MARKER'));values.push(value)}
              assert.deepEqual(values[0],values[1])
            }
            const events=(await owner.query("SELECT event FROM profitia_access.security_events WHERE phase='OUTCOME' AND event->>'resourceId' LIKE 'forecast-verification:%' ORDER BY event_id DESC LIMIT 2")).rows.map(row=>row.event)
            assert.deepEqual(events.map(e=>e.organisationId),[B,A]);assert(events.every(e=>e.moduleEvidence.moduleId==='benchmark'&&e.reasonCode==='SUCCEEDED'))
          })
          await t.test('membership/session/account/product/module/permission revocation refuses before any source query',async()=>{
            const before=reads
            assert.equal((await routes(input(A,V))).status,403);sdkRevoked=true;try{assert.equal((await routes(input())).status,401)}finally{sdkRevoked=false}
            for(const[deny,restore,values,status=403]of[
              ["UPDATE profitia_access.accounts SET status='DISABLED' WHERE user_id=$1","UPDATE profitia_access.accounts SET status='ACTIVE' WHERE user_id=$1",[U],401],
              ["UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2","UPDATE profitia_access.memberships SET status='ACTIVE' WHERE organisation_id=$1 AND user_id=$2",[A,U]],
              ["UPDATE profitia_access.product_grants SET status='REVOKED' WHERE application_id='spendguru' AND product='SPENDGURU' AND organisation_id=$1","UPDATE profitia_access.product_grants SET status='ACTIVE' WHERE application_id='spendguru' AND product='SPENDGURU' AND organisation_id=$1",[A]],
              ["UPDATE profitia_modules.application_bindings SET status='REVOKED' WHERE application_id='spendguru' AND module_id='benchmark'","UPDATE profitia_modules.application_bindings SET status='ACTIVE' WHERE application_id='spendguru' AND module_id='benchmark'",[]],
            ]){await owner.query(deny,values);try{assert.equal((await routes(input())).status,status)}finally{await owner.query(restore,values)}}
            const deny=randomUUID();await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'spendguru',$2,$3,'DENY','forecast.read','forecast')",[deny,A,U])
            try{assert.equal((await routes(input())).status,403)}finally{await owner.query('DELETE FROM profitia_access.permission_grants WHERE grant_id=$1',[deny])}
            assert.equal(reads,before)
          })
          await t.test('the Verification host does not lend its resource to Current; source and projection failures are withheld',async()=>{
            const before=reads
            assert.equal((await createOperationForecastVerificationHandler(forecastHost,A,read)(input())).status,403);assert.equal(reads,before)
            const fixed=createSg2PrivateForecastVerificationHost({...forecastConfig,application:{...forecastConfig.application,profileId:'PORR_SUITE',organisationId:A}})
            assert.equal((await createOperationForecastVerificationHandler(fixed,A,read)(input(B))).status,400);assert.equal(reads,before)
            await owner.query("UPDATE profitia_forecast_read.installation SET branch_id='foreign'")
            try{assert.equal((await routes(input())).status,503)}finally{await owner.query("UPDATE profitia_forecast_read.installation SET branch_id='isolated-source-branch'")}
            const bad=createOperationForecastVerificationHandler(host,A,async selected=>({...await sourceRead(selected),privateUser:'SYNTHETIC_PRIVATE_FORECAST_MARKER'}))
            const response=await bad(input());assert.equal(response.status,403);assert(!(await response.text()).includes('SYNTHETIC_PRIVATE_FORECAST_MARKER'))
          })
          await t.test('Verification OUTCOME audit failure withholds data and independently records FAILURE',async()=>{
            await owner.query("CREATE FUNCTION profitia_access.reject_verification_outcome() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.phase='OUTCOME' AND NEW.event->>'resourceId' LIKE 'forecast-verification:%' THEN RAISE EXCEPTION 'synthetic verification audit outage'; END IF; RETURN NEW; END $$;CREATE TRIGGER reject_verification_outcome BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION profitia_access.reject_verification_outcome()")
            try{const response=await routes(input());assert.equal(response.status,503);assert(!(await response.text()).includes('synthetic verification audit outage'))}finally{await owner.query('DROP TRIGGER reject_verification_outcome ON profitia_access.security_events;DROP FUNCTION profitia_access.reject_verification_outcome()')}
            const events=(await owner.query("SELECT event FROM profitia_access.security_events WHERE event->>'resourceId' LIKE 'forecast-verification:%' ORDER BY event_id DESC LIMIT 2")).rows.map(r=>r.event)
            assert.deepEqual(events.map(e=>e.phase),['FAILURE','INTENT']);assert.equal(events[0].decisionId,events[1].decisionId)
          })
          assert.equal(providerCalls,providerBefore)
        })
        await t.test('native capability/readiness APIs enforce independent current authority on the ordinary stored source',async t=>{
          const {createStoredForecastReadinessReader}=await import('../lib/forecast/stored-readiness-read.ts')
          const {createSg2PrivateForecastReadinessHost}=await import('../lib/platform/private-host.ts')
          const {createOperationForecastReadinessHandler}=await import('../lib/forecast/readiness-operation-handlers.ts')
          const sourceRead=createStoredForecastReadinessReader(source,{projectId:'isolated-source-project',branchId:'isolated-source-branch',databaseName:DATABASE,role:sourceRole,schemaDigest:sourceDigest,marketSchemaDigest:marketDigest})
          await t.test('the real ordinary transaction shares one lazy stored query across scientific consumers',async()=>{
            const {createStoredRollingDailyVerificationSource}=await import('../lib/forecast/rolling-daily-verification.ts')
            await source.$transaction(async transaction=>{
              const port=createStoredRollingDailyVerificationSource(transaction),input={seriesId,modelId:'naive'}
              const [full,fast,recent]=await Promise.all([port.readRecords(input),port.readRecords(input),port.readRecords(input)])
              assert.strictEqual(full,fast);assert.strictEqual(fast,recent);assert.equal(full.length,24)
              assert(full.every(row=>row.seriesId===seriesId&&row.modelId==='naive'))
              const another=await createStoredRollingDailyVerificationSource(transaction).readRecords(input)
              assert.notStrictEqual(full,another);assert.deepEqual(full,another)
            })
          })
          const host=createSg2PrivateForecastReadinessHost(forecastConfig)
          let reads=0
          const read=async selected=>{reads++;return sourceRead(selected)}
          const routes=Object.fromEntries(['capability','capabilities','readiness'].map(kind=>[kind,createOperationForecastReadinessHandler(kind,host,A,read)]))
          const input=(kind,org=A,user=U)=>new NextRequest(`${ORIGIN}/api/internal/forecast/${kind}?seriesId=${seriesId}&organisationId=${org}`
            +(kind==='capability'?'&modelId=naive&targetSemantics=ROLLING_DAILY_POINT_IN_TIME':''),{headers:{authorization:`Bearer external-${user}`}})
          const normalize=value=>{const result=structuredClone(value);delete result.timingMs;if(result.variants)for(const item of result.variants)delete item.timingMs;return result}
          await t.test('each representation is independently shared between authorised organisations and separately audited',async()=>{
            for(const kind of['capability','capabilities','readiness']){
              const values=[]
              for(const org of[A,B]){
                const response=await routes[kind](input(kind,org));assert.equal(response.status,200,await response.clone().text())
                const value=await response.json();assert.equal(value.sourceAvailability,'AVAILABLE');assert.equal(value.seriesId,seriesId)
                assert.equal(response.headers.get('cache-control'),'private, no-store');assert(!JSON.stringify(value).includes('SYNTHETIC_PRIVATE_FORECAST_MARKER'))
                assert(!('trace'in value));if(kind!=='capability')assert.equal(value.variants.length,12)
                values.push(normalize(value))
              }
              assert.deepEqual(values[0],values[1])
              const events=(await owner.query("SELECT event FROM profitia_access.security_events WHERE phase='OUTCOME' AND event->>'resourceId' LIKE $1 ORDER BY event_id DESC LIMIT 2",[`forecast-${kind}:%`])).rows.map(row=>row.event)
              assert.deepEqual(events.map(e=>e.organisationId),[B,A]);assert(events.every(e=>e.reasonCode==='SUCCEEDED'&&e.moduleEvidence.moduleId==='benchmark'))
            }
          })
          await t.test('every representation refuses current membership, session, product, module and permission revocation before source access',async()=>{
            const before=reads
            for(const kind of['capability','capabilities','readiness']){
              assert.equal((await routes[kind](input(kind,A,V))).status,403)
              sdkRevoked=true;try{assert.equal((await routes[kind](input(kind))).status,401)}finally{sdkRevoked=false}
              for(const[deny,restore,values,status=403]of[
                ["UPDATE profitia_access.accounts SET status='DISABLED' WHERE user_id=$1","UPDATE profitia_access.accounts SET status='ACTIVE' WHERE user_id=$1",[U],401],
                ["UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2","UPDATE profitia_access.memberships SET status='ACTIVE' WHERE organisation_id=$1 AND user_id=$2",[A,U]],
                ["UPDATE profitia_access.product_grants SET status='REVOKED' WHERE application_id='spendguru' AND product='SPENDGURU' AND organisation_id=$1","UPDATE profitia_access.product_grants SET status='ACTIVE' WHERE application_id='spendguru' AND product='SPENDGURU' AND organisation_id=$1",[A]],
                ["UPDATE profitia_modules.application_bindings SET status='REVOKED' WHERE application_id='spendguru' AND module_id='benchmark'","UPDATE profitia_modules.application_bindings SET status='ACTIVE' WHERE application_id='spendguru' AND module_id='benchmark'",[]],
              ]){await owner.query(deny,values);try{assert.equal((await routes[kind](input(kind))).status,status)}finally{await owner.query(restore,values)}}
              const deny=randomUUID();await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'spendguru',$2,$3,'DENY','forecast.read','forecast')",[deny,A,U])
              try{assert.equal((await routes[kind](input(kind))).status,403)}finally{await owner.query('DELETE FROM profitia_access.permission_grants WHERE grant_id=$1',[deny])}
            }
            assert.equal(reads,before)
          })
          await t.test('Current authority, dedicated organisation and tainted projection cannot substitute native readiness authority',async()=>{
            const before=reads
            assert.equal((await createOperationForecastReadinessHandler('capability',forecastHost,A,read)(input('capability'))).status,403);assert.equal(reads,before)
            const fixed=createSg2PrivateForecastReadinessHost({...forecastConfig,application:{...forecastConfig.application,profileId:'PORR_SUITE',organisationId:A}})
            assert.equal((await createOperationForecastReadinessHandler('readiness',fixed,A,read)(input('readiness',B))).status,400);assert.equal(reads,before)
            const bad=createOperationForecastReadinessHandler('readiness',host,A,async selected=>({...await sourceRead(selected),privateUser:'SYNTHETIC_PRIVATE_FORECAST_MARKER'}))
            const response=await bad(input('readiness'));assert.equal(response.status,403);assert(!(await response.text()).includes('SYNTHETIC_PRIVATE_FORECAST_MARKER'))
            const failed=createOperationForecastReadinessHandler('readiness',host,A,async selected=>{
              const value=await sourceRead(selected)
              return {...value,status:'FAILED',sourceAvailability:'FAILED',variants:value.variants.map(item=>({...item,sourceAvailability:'FAILED'}))}
            })
            assert.equal((await failed(input('readiness'))).status,503)
            const events=(await owner.query("SELECT event FROM profitia_access.security_events WHERE event->>'resourceId' LIKE 'forecast-readiness:%' ORDER BY event_id DESC LIMIT 2")).rows.map(row=>row.event)
            assert.deepEqual(events.map(e=>e.phase),['FAILURE','INTENT']);assert.equal(events[0].decisionId,events[1].decisionId)
          })
          await t.test('readiness OUTCOME audit outage withholds data and independently retains correlated FAILURE',async()=>{
            await owner.query("CREATE FUNCTION profitia_access.reject_readiness_outcome() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.phase='OUTCOME' AND NEW.event->>'resourceId' LIKE 'forecast-readiness:%' THEN RAISE EXCEPTION 'synthetic readiness audit outage'; END IF; RETURN NEW; END $$;CREATE TRIGGER reject_readiness_outcome BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION profitia_access.reject_readiness_outcome()")
            try{const response=await routes.readiness(input('readiness'));assert.equal(response.status,503);assert(!(await response.text()).includes('synthetic readiness audit outage'))}
            finally{await owner.query('DROP TRIGGER reject_readiness_outcome ON profitia_access.security_events;DROP FUNCTION profitia_access.reject_readiness_outcome()')}
            const events=(await owner.query("SELECT event FROM profitia_access.security_events WHERE event->>'resourceId' LIKE 'forecast-readiness:%' ORDER BY event_id DESC LIMIT 2")).rows.map(row=>row.event)
            assert.deepEqual(events.map(e=>e.phase),['FAILURE','INTENT']);assert.equal(events[0].decisionId,events[1].decisionId)
          })
        })
        await t.test('Dashboard native relay crosses real HTTP into the existing current private authority and restricted source',async t=>{
          const {createServer}=await import('node:http')
          const {createNativeForecastReadHandler,NATIVE_FORECAST_API_PATHS}=await import('../../dashboard-preview/lib/benchmark-forecast/native-read-relay.ts')
          const {createStoredForecastVerificationReader}=await import('../lib/forecast/stored-verification-read.ts')
          const {createStoredForecastReadinessReader}=await import('../lib/forecast/stored-readiness-read.ts')
          const {createRuntimeForecastCurrentHandler}=await import('../lib/forecast/current-operation-handlers.ts')
          const {createRuntimeForecastVerificationHandler}=await import('../lib/forecast/verification-operation-handlers.ts')
          const {createRuntimeForecastReadinessHandler}=await import('../lib/forecast/readiness-operation-handlers.ts')
          const {createSg2PrivateForecastReadinessHost}=await import('../lib/platform/private-host.ts')
          // Explicit SDK fixture, not a real Clerk/signature claim. The bearer
          // value crosses HTTP unchanged; current database rights remain real.
          const token=user=>`synthetic_header.${Buffer.from(user).toString('base64url')}.synthetic_signature`
          const tokens=new Map([U,V].map(user=>[`Bearer ${token(user)}`,user]))
          const relayClerk={...clerk,authenticateRequest:async(request,...args)=>{
            const headers=new Headers(request.headers),user=tokens.get(headers.get('authorization'))
            headers.set('authorization',user?`Bearer external-${user}`:'Bearer invalid')
            return clerk.authenticateRequest(new Request(request,{headers}),...args)
          }}
          const config={...forecastConfig,clerk:relayClerk}
          const binding={projectId:'isolated-source-project',branchId:'isolated-source-branch',databaseName:DATABASE,role:sourceRole,schemaDigest:sourceDigest,marketSchemaDigest:marketDigest}
          let actualReads=0,ownerEscapes=0
          const descriptor=Object.getOwnPropertyDescriptor(globalThis,'dashboardPreviewMarketDataPrisma')
          Object.defineProperty(globalThis,'dashboardPreviewMarketDataPrisma',{configurable:true,get(){ownerEscapes++;throw Error('Forbidden legacy Dashboard datastore')}})
          const verification=createStoredForecastVerificationReader(source,binding),readiness=createStoredForecastReadinessReader(source,binding)
          const runtime={provider:'clerk',executor:forecastHost,defaultOrganisationId:A,forecastRead:{executor:createSg2PrivateForecastCurrentHost(config),
            current:async selection=>{actualReads++;return read(selection)},
            verification:{executor:createSg2PrivateForecastVerificationHost(config),read:async selection=>{actualReads++;return verification(selection)}},
            readiness:{executor:createSg2PrivateForecastReadinessHost(config),read:async selection=>{actualReads++;return readiness(selection)}}}}
          const handlers={
            '/api/benchmark/forecast/current':createRuntimeForecastCurrentHandler(()=>runtime),
            '/api/benchmark/forecast/verification':createRuntimeForecastVerificationHandler(()=>runtime),
            '/api/internal/forecast/capability':createRuntimeForecastReadinessHandler('capability',()=>runtime),
            '/api/internal/forecast/readiness':createRuntimeForecastReadinessHandler('readiness',()=>runtime),
          }
          const received=[],errors=[]
          let omitMetadata=false
          const server=createServer((incoming,outgoing)=>{void(async()=>{
            try{
              const url=new URL(incoming.url,ORIGIN),handler=handlers[url.pathname]
              const headers=new Headers(Object.entries(incoming.headers).filter(([,value])=>value!==undefined).map(([key,value])=>[key,Array.isArray(value)?value.join(','):value]))
              received.push({path:url.pathname,authorization:headers.get('authorization'),cookie:headers.get('cookie'),forgedUser:headers.get('x-clerk-user-id')})
              const response=handler?await handler(new NextRequest(url,{method:incoming.method,headers})):new Response(null,{status:404})
              outgoing.statusCode=response.status
              for(const[key,value]of response.headers)if(!omitMetadata||!key.startsWith('x-profitia-'))outgoing.setHeader(key,value)
              outgoing.end(Buffer.from(await response.arrayBuffer()))
            }catch(error){errors.push(error);outgoing.statusCode=503;outgoing.end('Synthetic fixture failure')}
          })()})
          await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)})
          const address=server.address();assert(address&&typeof address==='object')
          const env={APP_ENV:'development',TARGET_ENVIRONMENT:'development',PROFITIA_AUTH_PROVIDER:'clerk',PROFITIA_FORECAST_API_ORIGIN:'https://sg2-development-runtime.onrender.com',PROFITIA_FORECAST_API_CONFIGURATION_VERSION:'sg2-native-forecast-relay-dev-v1'}
          const relayFetch=async(input,init)=>{
            const url=new URL(String(input));assert.equal(url.origin,env.PROFITIA_FORECAST_API_ORIGIN)
            assert.deepEqual([...new Headers(init.headers)].map(([key])=>key),['authorization']);assert.equal(init.redirect,'manual')
            return previousFetch(`http://127.0.0.1:${address.port}${url.pathname}${url.search}`,init)
          }
          const relays=Object.fromEntries(Object.keys(NATIVE_FORECAST_API_PATHS).map(kind=>[kind,createNativeForecastReadHandler(kind,{env:()=>env,fetch:relayFetch})]))
          const input=(kind,org=A,user=U)=>new Request(`https://dashboard.fixture.test${NATIVE_FORECAST_API_PATHS[kind]}?seriesId=${seriesId}&organisationId=${org}`
            +(kind==='capabilities'?'':kind==='capability'?'&modelId=naive&targetBasis=POINT_IN_TIME':'&model=naive&targetBasis=POINT_IN_TIME'),
            {headers:{authorization:`Bearer ${token(user)}`,cookie:'synthetic_legacy_cookie','x-clerk-user-id':V,'x-clerk-org-id':B}})
          const normalize=value=>{const result=structuredClone(value);delete result.timingMs;if(result.variants)for(const item of result.variants)delete item.timingMs;return result}
          try{
            await t.test('all four consumers retain business DTOs and shared statistics for independently authorised organisations',async()=>{
              for(const kind of Object.keys(relays)){
                const values=[]
                for(const org of[A,B]){
                  const response=await relays[kind](input(kind,org));assert.equal(response.status,200,await response.clone().text())
                  const value=await response.json();assert.equal(value.seriesId,seriesId);assert(!JSON.stringify(value).includes('SYNTHETIC_PRIVATE_FORECAST_MARKER'))
                  assert.equal(response.headers.get('cache-control'),'private, no-store')
                  if(kind==='current'){
                    assert.equal(value.currentForecast['1M'].forecastValue,0);assert.equal(value.currentForecast['1M'].horizonSteps,1)
                    assert.equal(value.freshness.status,'FRESH');assert.equal(value.lineage.historyFingerprint,hash)
                    assert.equal(value.rollingDailySnapshot.benchmark.unit,'ORIGINAL_UNIT');assert.equal(value.history.start,null)
                  }
                  if(kind==='verification'){assert.equal(value.verification['1M'].records.length,24);assert.equal(value.verification['1M'].metrics.mae,0)}
                  if(kind==='capabilities')assert.equal(value.variants.length,12)
                  values.push(normalize(value))
                }
                assert.deepEqual(values[0],values[1])
              }
              assert(received.every(row=>row.authorization===`Bearer ${token(U)}`&&row.cookie===null&&row.forgedUser===null))
              assert(received.some(row=>row.path==='/api/internal/forecast/readiness'))
              assert.equal(ownerEscapes,0);assert.equal(providerCalls,providerBefore)
            })
            await t.test('no cached success or forwarded caller identity survives current session, membership or permission revocation',async()=>{
              const before=actualReads
              for(const kind of Object.keys(relays)){
                assert.equal((await relays[kind](input(kind,A,V))).status,403)
                sdkRevoked=true;try{assert.equal((await relays[kind](input(kind))).status,401)}finally{sdkRevoked=false}
                await owner.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2",[A,U])
                try{assert.equal((await relays[kind](input(kind))).status,403)}finally{await owner.query("UPDATE profitia_access.memberships SET status='ACTIVE' WHERE organisation_id=$1 AND user_id=$2",[A,U])}
                const id=randomUUID();await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'spendguru',$2,$3,'DENY','forecast.read','forecast')",[id,A,U])
                try{assert.equal((await relays[kind](input(kind))).status,403)}finally{await owner.query('DELETE FROM profitia_access.permission_grants WHERE grant_id=$1',[id])}
              }
              assert.equal(actualReads,before)
            })
            await t.test('a successful response without native context metadata is withheld rather than falling back',async()=>{
              omitMetadata=true;try{assert.equal((await relays.current(input('current'))).status,503)}finally{omitMetadata=false}
              assert.equal(ownerEscapes,0)
            })
            await t.test('actual upstream OUTCOME failure stays unavailable through the relay with independently durable FAILURE',async()=>{
              await owner.query("CREATE FUNCTION profitia_access.reject_relay_outcome() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.phase='OUTCOME' AND NEW.event->>'resourceId' LIKE 'forecast-readiness:%' THEN RAISE EXCEPTION 'synthetic relay audit outage'; END IF; RETURN NEW; END $$;CREATE TRIGGER reject_relay_outcome BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION profitia_access.reject_relay_outcome()")
              try{const response=await relays.capabilities(input('capabilities'));assert.equal(response.status,503);assert(!(await response.text()).includes('synthetic relay audit outage'))}
              finally{await owner.query('DROP TRIGGER reject_relay_outcome ON profitia_access.security_events;DROP FUNCTION profitia_access.reject_relay_outcome()')}
              const events=(await owner.query("SELECT event FROM profitia_access.security_events WHERE event->>'resourceId' LIKE 'forecast-readiness:%' ORDER BY event_id DESC LIMIT 2")).rows.map(row=>row.event)
              assert.deepEqual(events.map(e=>e.phase),['FAILURE','INTENT']);assert.equal(events[0].decisionId,events[1].decisionId)
            })
            await t.test('all four embedded reads use real ports, this actual API and the same ordinary source',async t=>{
              const{openEmbeddedReadClient}=await import('@profitia/platform-contracts/embedded-read-channel')
              const{openNativeDashboardReadHost,nativeDashboardContext}=await import('../lib/platform/native-dashboard-embed.ts')
              const{createEmbeddedChartFetch,readNativeEmbeddedConfiguration}=await import('../../dashboard-preview/lib/platform/native-embedded-read.ts')
              const{selectNativeEmbedPage}=await import('../../dashboard-preview/lib/platform/native-chart-publication.ts')
              const config=readNativeEmbeddedConfiguration({...env,PROFITIA_NATIVE_EMBED_ENABLED:'true'});assert(config)
              const connect=(org=A)=>{
                const url=`${config.childOrigin}/pl?embed=1&variantId=forecast-portfolio-v3&showForecast=false&preparedReadsOnly=1&seriesId=${seriesId}&range=1Y&organisationId=${org}`
                const pair=new MessageChannel(),instanceId=randomUUID()
                const host=openNativeDashboardReadHost({port:pair.port1,instanceId,context:nativeDashboardContext(url,env.PROFITIA_FORECAST_API_ORIGIN),
                  getToken:async()=>token(U),fetch:relayFetch})
                const client=openEmbeddedReadClient({port:pair.port2,instanceId})
                t.after(()=>{client.close();host.close()})
                return createEmbeddedChartFetch(client,config,selectNativeEmbedPage(url))
              }
              const a=connect(),b=connect(B)
              const chartPath=kind=>`${NATIVE_FORECAST_API_PATHS[kind]}?seriesId=${seriesId}`
                +(kind==='capabilities'?'':kind==='capability'?'&modelId=naive&targetBasis=POINT_IN_TIME':'&model=naive&targetBasis=POINT_IN_TIME')
              for(const kind of Object.keys(relays)){
                const values=[]
                for(const chart of[a,b]){
                  const response=await chart(chartPath(kind));assert.equal(response.status,200,await response.clone().text())
                  const value=await response.json();assert.equal(value.seriesId,seriesId);assert(!JSON.stringify(value).includes('SYNTHETIC_PRIVATE_FORECAST_MARKER'))
                  if(kind==='current'){assert.equal(value.currentForecast['1M'].forecastValue,0);assert.equal(value.rollingDailySnapshot.benchmark.unit,'ORIGINAL_UNIT')}
                  if(kind==='verification'){assert.equal(value.verification['1M'].records.length,24);assert.equal(value.verification['1M'].metrics.mae,0)}
                  if(kind==='capabilities')assert.equal(value.variants.length,12)
                  values.push(normalize(value))
                }
                assert.deepEqual(values[0],values[1])
              }
              const before=actualReads
              await owner.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2",[A,U])
              try{for(const kind of Object.keys(relays))assert.equal((await a(chartPath(kind))).status,403)}
              finally{await owner.query("UPDATE profitia_access.memberships SET status='ACTIVE' WHERE organisation_id=$1 AND user_id=$2",[A,U])}
              assert.equal(actualReads,before)
              sdkRevoked=true;try{assert.equal((await a(chartPath('current'))).status,401)}finally{sdkRevoked=false}
              assert.equal(actualReads,before)
              omitMetadata=true;try{assert.equal((await a(chartPath('current'))).status,503)}finally{omitMetadata=false}
              await owner.query("CREATE FUNCTION profitia_access.reject_embed_outcome() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.phase='OUTCOME' AND NEW.event->>'resourceId' LIKE 'forecast-readiness:%' THEN RAISE EXCEPTION 'synthetic embed audit outage'; END IF; RETURN NEW; END $$;CREATE TRIGGER reject_embed_outcome BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION profitia_access.reject_embed_outcome()")
              try{assert.equal((await a(chartPath('capabilities'))).status,503)}
              finally{await owner.query('DROP TRIGGER reject_embed_outcome ON profitia_access.security_events;DROP FUNCTION profitia_access.reject_embed_outcome()')}
              const events=(await owner.query("SELECT event FROM profitia_access.security_events WHERE event->>'resourceId' LIKE 'forecast-readiness:%' ORDER BY event_id DESC LIMIT 2")).rows.map(row=>row.event)
              assert.deepEqual(events.map(event=>event.phase),['FAILURE','INTENT']);assert.equal(events[0].decisionId,events[1].decisionId)
            })
            assert.deepEqual(errors,[]);assert.equal(ownerEscapes,0);assert.equal(providerCalls,providerBefore)
          }finally{
            await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))
            if(descriptor)Object.defineProperty(globalThis,'dashboardPreviewMarketDataPrisma',descriptor);else delete globalThis.dashboardPreviewMarketDataPrisma
          }
        })
        await t.test('period API keeps default and END_OF_PERIOD inside the same current private authority and source gates',async t=>{
          const {buildLiveForecastBridgePayloadFromHistory,selectMinimalLawfulCurrentTrainingPayload}=await import('../lib/forecast/live-market-input.ts')
          const {resolveForecastTechnicalMinimumObservations}=await import('../lib/forecast/current-fast-policy.ts')
          const {buildForecastHistoryFingerprint}=await import('../lib/forecast/service.ts')
          const {createForecastCadence}=await import('../lib/forecast/cadence.ts')
          const {resolveForecastMethodContract,buildForecastArtifactCadenceIdentity}=await import('../lib/forecast/identity.ts')
          const periodSeries='private_host_period_source',marker='SYNTHETIC_PRIVATE_PERIOD_MARKER'
          const history={providerSeries:{provider:{providerCode:'MACROBOND',displayName:'Macrobond'},providerSeriesId:periodSeries,providerSeriesKey:null},
            displayName:'Shared period source',frequency:'DAILY',currency:null,unit:'ORIGINAL_UNIT',source:'Synthetic',historical:[]}
          await owner.query('INSERT INTO public.market_series VALUES(\'period-host\',\'MACROBOND\',$1,null,$2,\'daily\',null,\'ORIGINAL_UNIT\',\'Synthetic\')',[periodSeries,history.displayName])
          for(let month=0;month<36;month++){
            const date=new Date(Date.UTC(2022,month,15)).toISOString();history.historical.push({date,value:0})
            await owner.query('INSERT INTO public.market_observations VALUES(\'period-host\',$1,0)',[date])
          }
          for(const basis of ['MONTHLY_AVERAGE','END_OF_PERIOD']){
            const method=resolveForecastMethodContract(basis),statistical=createCurrentForecastStatisticalCompatibility({sourceFrequency:'DAILY',targetCadence:'MONTHLY',targetSemantics:basis})
            const prepared=selectMinimalLawfulCurrentTrainingPayload(buildLiveForecastBridgePayloadFromHistory(periodSeries,history,{targetBasis:basis,targetCadence:'MONTHLY',continuityPolicy:'ALLOW_GAPS'}),
              resolveForecastTechnicalMinimumObservations({targetSemantics:basis,modelId:'naive'}))
            const hash=buildForecastHistoryFingerprint(prepared.history,createForecastCadence('DAILY','MONTHLY')),id=`period_host_${basis}`
            await owner.query(`INSERT INTO public.forecast_current_runs(id,"seriesId","modelId","displayName",description,frequency,"inputSource","inputRunId","historyFingerprint",
              "targetBasis","methodId","methodVersion","trainingWindowPolicyId","effectiveTrainingPolicyId","historyStartAt","historyEndAt","observationCount","forecastOriginAt",status,"failureReason","runtimeSeconds")
              VALUES($1,$2,'naive',$3,$3,$4,'DYNAMIC_MARKET_DATA_STORE',$3,$5,$6::text::public."ForecastTargetBasis",$6::text,$7,$8,$9,$10,$11,$12,$11,'AVAILABLE',$3,0)`,
            [id,periodSeries,marker,buildForecastArtifactCadenceIdentity(createForecastCadence('DAILY','MONTHLY')),hash,basis,method.methodVersion,
              statistical.trainingWindowPolicyId,statistical.effectiveTrainingPolicyId,prepared.history.start,prepared.history.end,prepared.history.observations])
            for(const[horizon,steps]of Object.entries(prepared.execution.horizons))await owner.query(`INSERT INTO public.forecast_current_points(id,"runId","horizonLabel","horizonSteps","forecastDate","forecastValue","failureReason")
              VALUES($1,$2,$3,$4,$5,0,$6)`,[`${id}_${horizon}`,id,horizon,steps,prepared.execution.currentTargetDates[horizon],marker])
          }
          const periodInput=(org=A,user=U,basis='MONTHLY_AVERAGE',extra='')=>new NextRequest(`${ORIGIN}/api/benchmark/forecast/current?seriesId=${periodSeries}&model=naive&organisationId=${org}`
            +(basis==='MONTHLY_AVERAGE'?'':`&targetBasis=${basis}`)+extra,{headers:{authorization:`Bearer external-${user}`}})
          await t.test('both organisations share scientific values with separate owner decisions and the original monthly default',async()=>{
            for(const basis of ['MONTHLY_AVERAGE','END_OF_PERIOD']){
              const values=[]
              for(const org of[A,B]){const response=await routes(periodInput(org,U,basis));assert.equal(response.status,200)
                assert.equal(response.headers.get('cache-control'),'private, no-store');const value=await response.json();assert.equal(value.status,'AVAILABLE')
                assert.equal(value.targetBasis,basis);assert.equal(value.currentForecast['1M'].forecastValue,0);assert.equal(value.source.runId,null)
                assert(!JSON.stringify(value).includes(marker));values.push(value)}
              assert.deepEqual(values[0],values[1])
              const events=(await owner.query("SELECT event FROM profitia_access.security_events WHERE phase='OUTCOME' AND event->>'operation'='forecast.read' ORDER BY event_id DESC LIMIT 2")).rows.map(r=>r.event)
              assert.deepEqual(events.map(e=>e.organisationId),[B,A]);assert(events.every(e=>e.actorId===U&&e.dataClass==='SHARED_KNOWLEDGE'&&e.resourceId.endsWith(basis)))
            }
          })
          await t.test('period identity forgery and live session/membership/permission/product revocations stop before source reads',async()=>{
            const before=sourceReads
            assert.equal((await routes(periodInput(A,V))).status,403)
            assert.equal((await routes(new NextRequest(periodInput().url,{headers:{'x-clerk-user-id':U,'x-clerk-org-id':A}}))).status,401)
            assert.equal((await routes(new NextRequest(periodInput().url,{headers:{...Object.fromEntries(periodInput().headers),'x-sg-prepared-history-fingerprint':'forged'}}))).status,400)
            sdkRevoked=true;try{assert.equal((await routes(periodInput())).status,401)}finally{sdkRevoked=false}
            for(const[deny,restore,values]of[
              ["UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2","UPDATE profitia_access.memberships SET status='ACTIVE' WHERE organisation_id=$1 AND user_id=$2",[A,U]],
              ["UPDATE profitia_access.product_grants SET status='REVOKED' WHERE application_id='spendguru' AND product='SPENDGURU' AND organisation_id=$1","UPDATE profitia_access.product_grants SET status='ACTIVE' WHERE application_id='spendguru' AND product='SPENDGURU' AND organisation_id=$1",[A]],
              ["UPDATE profitia_modules.application_bindings SET status='REVOKED' WHERE application_id='spendguru' AND module_id='benchmark'","UPDATE profitia_modules.application_bindings SET status='ACTIVE' WHERE application_id='spendguru' AND module_id='benchmark'",[]]]){
              await owner.query(deny,values);try{for(const basis of ['MONTHLY_AVERAGE','END_OF_PERIOD'])assert.equal((await routes(periodInput(A,U,basis))).status,403)}finally{await owner.query(restore,values)}
            }
            const id=randomUUID();await owner.query("INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature) VALUES($1,'spendguru',$2,$3,'DENY','forecast.read','forecast')",[id,A,U])
            try{assert.equal((await routes(periodInput())).status,403)}finally{await owner.query('DELETE FROM profitia_access.permission_grants WHERE grant_id=$1',[id])}
            assert.equal(sourceReads,before)
          })
          await t.test('missing evidence and tainted DTOs do not escape through the period API',async()=>{
            const response=await routes(periodInput(A,U,'MONTHLY_AVERAGE','&sourceFrequency=MONTHLY&targetCadence=MONTHLY'))
            assert.equal(response.status,200);assert.equal((await response.json()).status,'NOT_AVAILABLE')
            const event=(await owner.query("SELECT event FROM profitia_access.security_events WHERE phase='OUTCOME' AND event->>'operation'='forecast.read' ORDER BY event_id DESC LIMIT 1")).rows[0].event
            assert.equal(event.reasonCode,'NO_DATA')
            const tainted=createOperationForecastCurrentHandler(forecastHost,A,async selected=>({...await read(selected),privateUser:marker}))
            const denied=await tainted(periodInput());assert.equal(denied.status,403);assert(!(await denied.text()).includes(marker))
          })
          await t.test('period data is withheld when OUTCOME persistence fails and FAILURE remains durable',async()=>{
            await owner.query("CREATE FUNCTION profitia_access.reject_period_outcome() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.phase='OUTCOME' AND NEW.event->>'operation'='forecast.read' THEN RAISE EXCEPTION 'synthetic period audit outage'; END IF; RETURN NEW; END $$;CREATE TRIGGER reject_period_outcome BEFORE INSERT ON profitia_access.security_events FOR EACH ROW EXECUTE FUNCTION profitia_access.reject_period_outcome()")
            try{assert.equal((await routes(periodInput())).status,503)}finally{await owner.query('DROP TRIGGER reject_period_outcome ON profitia_access.security_events;DROP FUNCTION profitia_access.reject_period_outcome()')}
            const events=(await owner.query("SELECT event FROM profitia_access.security_events WHERE event->>'operation'='forecast.read' ORDER BY event_id DESC LIMIT 2")).rows.map(r=>r.event)
            assert.deepEqual(events.map(e=>e.phase),['FAILURE','INTENT']);assert.equal(events[0].decisionId,events[1].decisionId)
          })
        })
        assert.equal(providerCalls,providerBefore)
      }finally{await source.$disconnect()}
    })


  } finally {
    globalThis.fetch = previousFetch
    await prisma?.$disconnect(); await auditPrisma?.$disconnect(); await owner?.end(); await root.end()
  }
})


test('SG2 explicitly accepts bounded AM23 source without granting or activating a product refresh',async()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url))),accepted=manifest.externalRequestSourceCompatibility
 const sdk=await import('@profitia/platform-contracts/request-ledger')
 assert.equal(accepted.platformVersion,'1.14.0')
 assert.equal(accepted.producer.sourceSha,'70e6ebbd1bb931911fd3e3801f04e03d2d45b5df')
 assert.equal(OPERATION_CONTRACT.implementation,'1.0.0-candidate.16')
 assert.equal(accepted.requestLedgerSourceDigest,'f87c7d482dfa3bb75a86f85c9e0df20e22c2a5f6ca973400fb2fd21713cbb78e')
 assert.equal(await sdk.requestLedgerSourceDigest(),currentSdkDigests.requestLedgerSourceDigest)
 assert.equal(await sdk.requestLedgerSourceDigest(),currentSdkDigests.requestLedgerSourceDigest)
 assert.equal(await sdk.requestReservationSchemaDigest(),accepted.baseSchemaDigest)
 assert.equal(await sdk.externalRequestSchemaDigest(),'8244a3a02d4ef5821822a6684023148c41bc9caac355c9f1200215e1a339df79')
 assert.equal(await sdk.externalRequestSchemaDigest(),accepted.externalSchemaDigest)
 assert.equal(manifest.operations.includes('supplier.report.refresh'),false)
 for(const name of ['humanSupplierRefreshAdopted','sql010Installed','runtimeRoleOrGrantChanged','remoteExecutionAdopted','kysOrPersonalDataAdopted','productDeploymentPerformed'])assert.equal(accepted[name],false,name)
})

test('historical Supplier delegation acceptance retains its values while current source remains exact',async()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url)))
 const current=manifest.supplierDelegationSourceCompatibility
 const jobs=await import('@profitia/platform-contracts/delegated-job')
 const host=await import('@profitia/platform-contracts/private-operation-host')
 assert.equal(current.platformVersion,'1.17.0');assert.equal(current.rootImplementation,'1.0.0-candidate.10');assert.equal(current.sourceRecordIsHistorical,true)
 assert.equal(current.producer.sourceSha,'978e9526c9ec79ed415a6aaf904d4dac5ea9cc02')
 assert.equal(current.producer.pullRequest,512)
 assert.deepEqual(jobs.DELEGATED_JOB_CONTRACT,{id:'profitia.delegated-job',version:'1.1.0'})
 assert.equal(host.PRIVATE_OPERATION_HOST_CONTRACT.version,manifest.delegatedNativeWorkSourceCompatibility.hostVersion)
 assert.equal(await jobs.delegatedJobSourceDigest(),currentSdkDigests.delegatedJobSourceDigest)
 assert.equal(await jobs.supplierDelegationSchemaDigest(),current.supplierSchemaDigest)
 assert.equal(await host.privateOperationHostSourceDigest(),currentSdkDigests.privateOperationHostSourceDigest)
 assert.equal(manifest.nativeExternalSourceCompatibility.sourceRecordIsHistorical,true)
 assert.equal(current.previousSourceRecordsAreHistorical,true);assert.equal(current.defaultForecastTargetUnchanged,true)
 assert.equal(Object.keys(current.sourceDigests).length,44)
 const sourceRoot=new URL('../',import.meta.resolve('@profitia/platform-contracts/delegated-job'))
 for(const[path,digest]of Object.entries(currentPlatformSourceDigests(manifest)))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(path,sourceRoot))).digest('hex'),digest,path)
 const binding={applicationId:'synthetic',environment:'development',projectId:'synthetic-project',branchId:'synthetic-branch',databaseName:'synthetic_db',role:'ordinary_fixture_role',schemaDigest:'a'.repeat(64)}
 assert.doesNotThrow(()=>jobs.createDelegatedJobStore({binding,schemaDigest:'b'.repeat(64)}))
 assert.throws(()=>jobs.createDelegatedJobStore({binding,schemaDigest:'b'.repeat(64),targetOperation:'supplier.report.refresh'}),TypeError)
 for(const key of ['supplierJobAdopted','supplierPrivateServicePhaseAdopted','sql013Installed','runtimeRoleOrGrantChanged','providerExecutionAdopted','productDeploymentPerformed'])assert.equal(current[key],false,key)
})

test('current optional delegated private phase source is exact and does not activate a Supplier business workflow',async()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url)))
 const current=manifest.delegatedPrivatePhaseSourceCompatibility
 const phases=await import('@profitia/platform-contracts/request-continuation')
 const hosts=await import('@profitia/platform-contracts/private-operation-host')
 assert.equal(current.platformVersion,'1.18.0');assert.equal(current.rootImplementation,'1.0.0-candidate.11');assert.equal(current.sourceRecordIsHistorical,true)
 assert.equal(current.hostVersion,'1.9.0');assert.equal(manifest.delegatedNativeWorkSourceCompatibility.hostVersion,hosts.PRIVATE_OPERATION_HOST_CONTRACT.version)
 assert.equal(current.continuationVersion,phases.REQUEST_CONTINUATION_CONTRACT.version)
 assert.equal(current.producer.sourceSha,'3e0788aa5309a668ba8c08a4b9ea53a04bbd8478');assert.equal(current.producer.pullRequest,516)
 assert.equal(await phases.requestContinuationSourceDigest(),currentSdkDigests.requestContinuationSourceDigest)
 assert.equal(await phases.delegatedPrivatePhasesSchemaDigest(),current.delegatedPrivatePhasesSchemaDigest)
 assert.equal(await hosts.privateOperationHostSourceDigest(),currentSdkDigests.privateOperationHostSourceDigest)
 assert.equal(current.previousSourceRecordsAreHistorical,true);assert.equal(current.defaultHumanAndForecastPreserved,true)
 const sourceRoot=new URL('../',import.meta.resolve('@profitia/platform-contracts/request-continuation'))
 assert.equal(Object.keys(current.sourceDigests).length,45)
 for(const[path,digest]of Object.entries(currentPlatformSourceDigests(manifest)))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(path,sourceRoot))).digest('hex'),digest,path)
 const unused=async()=>{throw Error('Constructor cannot authorize or query')}
 const application={appId:'synthetic-jobs',environment:'development',profileId:'PLATFORM_INTERNAL',deploymentId:'synthetic',configurationVersion:'1',identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,operations:['job.execute'],features:['job_execution']}
 const binding={applicationId:application.appId,environment:'development',projectId:'synthetic-project',branchId:'synthetic-branch',databaseName:'synthetic_db',role:'ordinary_fixture_role',schemaDigest:'a'.repeat(64),service:{schemaDigest:'a'.repeat(64),profileId:application.profileId,deploymentId:application.deploymentId,configurationVersion:application.configurationVersion}}
 const base={application,binding,job:{schemaDigest:'a'.repeat(64),targetOperation:'supplier.report.refresh',supplierSchemaDigest:'a'.repeat(64)},independentQuery:unused,transact:unused,readExternalAccount:unused}
 assert.equal(hosts.createDelegatedJobHost(base).runPrivatePhase,undefined)
 const host=hosts.createDelegatedJobHost({...base,privateContinuation:{schemaDigest:'b'.repeat(64),delegatedSchemaDigest:'c'.repeat(64)}})
 assert.equal(typeof host.runPrivatePhase,'function');assert.equal(host.deliver,undefined)
 assert.throws(()=>hosts.createDelegatedJobHost({...base,privateContinuation:{schemaDigest:'b'.repeat(64),delegatedSchemaDigest:'c'.repeat(64)},sourceDelivery:{deliver:unused}}),TypeError)
 for(const key of ['supplierPrivateServicePhaseAdopted','sql014Installed','runtimeRoleOrGrantChanged','providerExecutionAdopted','productDeploymentPerformed'])assert.equal(current[key],false,key)
})

test('optional committed phase inspection is accepted as exact source without adopting a product read',async()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url)))
 const current=manifest.delegatedPrivateInspectionSourceCompatibility
 const inspection=await import('@profitia/platform-contracts/request-inspection')
 const host=await import('@profitia/platform-contracts/private-operation-host')
 assert.equal(current.platformVersion,'1.19.0');assert.equal(current.rootImplementation,'1.0.0-candidate.12');assert.equal(current.sourceRecordIsHistorical,true)
 assert.equal(current.hostVersion,'1.10.0');assert.equal(manifest.delegatedNativeWorkSourceCompatibility.hostVersion,host.PRIVATE_OPERATION_HOST_CONTRACT.version)
 assert.equal(current.producer.sourceSha,'6260afa8771fbb427bd0b8e359557ab8f70dd9b5');assert.equal(current.producer.pullRequest,528)
 assert.equal(current.inspectionVersion,inspection.REQUEST_INSPECTION_CONTRACT.version)
 assert.equal(await inspection.requestInspectionSchemaDigest(),current.inspectionSchemaDigest)
 assert.equal(await inspection.requestInspectionSourceDigest(),current.inspectionSourceDigest)
 assert.equal(await host.privateOperationHostSourceDigest(),currentSdkDigests.privateOperationHostSourceDigest)
 assert.equal(current.defaultHumanAndForecastPreserved,true)
 const root=new URL('../',import.meta.resolve('@profitia/platform-contracts/request-inspection'))
 assert.equal(Object.keys(current.sourceDigests).length,48)
 for(const[path,digest]of Object.entries(currentPlatformSourceDigests(manifest)))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(path,root))).digest('hex'),digest,path)
 for(const key of['nativePrivateInspectionAdopted','sql015Installed','runtimeRoleOrGrantChanged','providerExecutionAdopted','productDeploymentPerformed'])assert.equal(current[key],false,key)
})

test('optional native SQL work accepts exact source without claiming native business adoption',async()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url)))
 const current=manifest.delegatedNativeWorkSourceCompatibility
 const work=await import('@profitia/platform-contracts/request-work')
 const host=await import('@profitia/platform-contracts/private-operation-host')
 assert.equal(current.platformVersion,'1.20.0');assert.equal(current.rootImplementation,'1.0.0-candidate.13');assert.equal(current.sourceRecordIsHistorical,true)
 assert.equal(current.hostVersion,host.PRIVATE_OPERATION_HOST_CONTRACT.version)
 assert.equal(current.producer.sourceSha,'025146034b42381c6e1eb812ed1c159c69d05bb1');assert.equal(current.producer.pullRequest,534)
 assert.deepEqual(work.REQUEST_WORK_CONTRACT,{id:'profitia.request-work',version:'1.0.0',effect:'PRIVATE_SQL_WORK',replayOwner:'EXISTING_DOMAIN_STATE'})
 assert.equal(current.workVersion,work.REQUEST_WORK_CONTRACT.version)
 assert.equal(await work.requestWorkSchemaDigest(),current.workSchemaDigest)
 assert.equal(await work.requestWorkSourceDigest(),currentSdkDigests.requestWorkSourceDigest)
 assert.equal(await host.privateOperationHostSourceDigest(),currentSdkDigests.privateOperationHostSourceDigest)
 assert.equal(typeof host.createDelegatedNativeWorkHost,'function')
 assert.equal(current.defaultHumanAndForecastPreserved,true)
 const root=new URL('../',import.meta.resolve('@profitia/platform-contracts/request-work'))
 assert.equal(Object.keys(current.sourceDigests).length,51)
 for(const[path,digest]of Object.entries(currentPlatformSourceDigests(manifest)))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(path,root))).digest('hex'),digest,path)
 for(const key of['nativeSqlWorkAdopted','sql016Installed','runtimeRoleOrGrantChanged','providerExecutionAdopted','productDeploymentPerformed'])assert.equal(current[key],false,key)
})

test('SG2 explicitly receives platform1.21 while private Supplier application capabilities remain disabled',async()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url)))
 const current=manifest.privateSupplierAccessSourceCompatibility
 const sdk=await import('@profitia/platform-contracts/operation-context')
 assert.equal(current.taskId,'SG2-E1-PRIVATE-SUPPLIER-CONTRACT-RECEPTION-20261019')
 assert.equal(current.platformVersion,'1.21.0');assert.equal(current.rootImplementation,'1.0.0-candidate.14')
 assert.equal(current.producer.sourceSha,'fe5b31f1390d2a9b12f7d16df7e35249c1a75402');assert.equal(current.producer.initialSourceSha,'48714e896f206b4d5b7693c163c34eba0c895c2a');assert.equal(current.producer.pullRequest,551)
 assert.equal(await sdk.operationSourceDigest(),manifest.contract.sourceDigest)
 assert.equal(Object.keys(current.sourceDigests).length,51)
 assert.equal(manifest.delegatedNativeWorkSourceCompatibility.sourceRecordIsHistorical,true)
 const root=new URL('../',import.meta.resolve('@profitia/platform-contracts/operation-context'))
 const {execFileSync}=await import('node:child_process')
 for(const[path,digest]of Object.entries(current.sourceDigests))assert.equal(createHash('sha256').update(execFileSync('git',['show',current.producer.sourceSha+':packages/platform-contracts/'+path])).digest('hex'),digest,path)
 for(const flag of ['previousFingerprintsPreserved','ordinarySg2FlowsPreserved'])assert.equal(current[flag],true,flag)
 for(const flag of ['privateSupplierPermissionsInferred','nativeSensitiveHttpAdopted','runtimeRoleOrGrantChanged','productDeploymentPerformed'])assert.equal(current[flag],false,flag)
 assert(manifest.operations.every(operation=>!operation.startsWith('supplier.private.')))
})


test('SG2 explicitly accepts additional request source while preserving old receipts and inactive HTTP targets',async()=>{
 const receipt=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url))),current=receipt.privateAcquisitionSourceCompatibility
 const sdk=await import('@profitia/platform-contracts/operation-context'),fsRoot=new URL('../',import.meta.resolve('@profitia/platform-contracts/operation-context'))
 assert.equal(current.taskId,'SG2-E1-PRIVATE-ACQUISITION-RECEPTION-20261020');assert.equal(current.platformVersion,'1.22.0');assert.equal(current.rootImplementation,'1.0.0-candidate.15')
 assert.equal(current.producer.sourceSha,'e71f9953d74f683e447f315e633db3696ec365ba');assert.equal(current.operationSchemaDigest,current.sourceDigests['migrations/access/017-additional-request-operations.sql']);assert.equal(Object.keys(current.sourceDigests).length,54)
 for(const[path,digest]of Object.entries(current.sourceDigests))assert.equal(createHash('sha256').update(execFileSync('git',['show',manifestPublicHistoryAuthority()+':packages/platform-contracts/'+path])).digest('hex'),digest,path)
 assert.equal(current.previousRecord,'privateSupplierAccessSourceCompatibility');assert.equal(receipt.privateSupplierAccessSourceCompatibility.platformVersion,'1.21.0')
 for(const flag of['previousFingerprintsPreserved','ordinaryFlowsPreserved'])assert.equal(current[flag],true)
 for(const flag of['privateAcquisitionHttpAdopted','cloudExtensionInstalled','runtimeRoleOrGrantChanged','productDeploymentPerformed'])assert.equal(current[flag],false)
 for(const operation of[...current.newRequestTargets,current.newReadTarget])assert(!receipt.operations.includes(operation))
})

function manifestPublicHistoryAuthority(){return '0403b34da82796c9c001be9cf53c5dcb6f9d823d'}

test('public web source receipt preserves historical records and verifies every current SDK file without activation',async()=>{
 const receipt=JSON.parse(fs.readFileSync(new URL('../operation-integration.json',import.meta.url))),current=receipt.publicWebTransportSourceCompatibility
 const before=JSON.parse(execFileSync('git',['show',manifestPublicHistoryAuthority()+':apps/sg-runtime/operation-integration.json'],{encoding:'utf8'}))
 for(const[key,value]of Object.entries(before))assert.deepEqual(['contract','producer'].includes(key)?receipt.supplierLocationSourceCompatibility.previousRootAcceptance[key]:receipt[key],value,key)
 assert.equal(current.taskId,'SG2-E1-PUBLIC-WEB-SOURCE-RECEPTION-20261020');assert.equal(current.platformVersion,'1.23.0');assert.equal(current.rootImplementation,receipt.supplierLocationSourceCompatibility.previousRootAcceptance.contract.implementation)
 assert.equal(current.producer.projectKey,'ARCHITECTURE');assert.equal(current.producer.sourceSha,'403255c88bbf81a67e384c269e38cae848b018f1')
 const sdk=await import('@profitia/platform-contracts/external-call'),root=new URL('../',import.meta.resolve('@profitia/platform-contracts/external-call'))
 assert.equal(JSON.parse(fs.readFileSync(new URL('package.json',root))).version,receipt.xrayPlatform130CiClosureCompatibility.platformVersion)
 assert.equal(await sdk.externalCallSourceDigest(),currentSdkDigests.externalCallSourceDigest)
 assert.equal(await sdk.publicWebTransportSchemaDigest(),current.sdkDigests.publicWebTransportSchemaDigest)
 assert.equal(Object.keys(current.sourceDigests).length,57)
 for(const[path,digest]of Object.entries(currentPlatformSourceDigests(receipt)))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(path,root))).digest('hex'),digest,path)
 for(const[path,digest]of Object.entries(receipt.privateAcquisitionSourceCompatibility.sourceDigests))assert.equal(createHash('sha256').update(execFileSync('git',['show',current.historicalSourceAuthority+':packages/platform-contracts/'+path])).digest('hex'),digest,path)
 for(const[path,digest]of Object.entries(receipt.nativeExternalSourceCompatibility.sourceDigests))assert.equal(createHash('sha256').update(execFileSync('git',['show',receipt.nativeExternalSourceCompatibility.producer.sourceSha+':packages/platform-contracts/'+path])).digest('hex'),digest,path)
 for(const flag of['previousFingerprintsPreserved','previousSourceRecordsAreHistorical','ordinaryFlowsPreserved'])assert.equal(current[flag],true,flag)
 for(const flag of['publicWebTransportAdopted','cloudExtensionInstalled','runtimeRoleOrGrantChanged','productDeploymentPerformed'])assert.equal(current[flag],false,flag)
})
