import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { createOperationExecutor, IMPLEMENTED_OPERATIONS, OperationDenied, OPERATION_CONTRACT, operationPayloadDigest, operationSourceDigest } from '../src/operation-context.mjs'
import { createTestIdentityIssuer } from '../../../apps/architecture-lab/src/operation-test-authority.mjs'

const time = Date.parse('2026-10-16T22:00:00Z')
const expiry = new Date(time + 3_600_000).toISOString()
function fixture(operation = 'benchmark.selection.read') {
  const issuer = createTestIdentityIssuer({ applicationId: 'app-1', now: () => time })
  const r = JSON.parse(fs.readFileSync(new URL('../../../Canon/registries/operation-access-matrix-v1.json', import.meta.url))).rules.find(r => r.operation === operation)
  const application = { appId: 'app-1', profileId: 'SPENDGURU_SAAS', deploymentId: 'isolated-test', configurationVersion: 'v1', environment: 'development', identityIssuer: issuer.issuer, organisationId: null, operations: [...IMPLEMENTED_OPERATIONS], features: ['account', 'benchmark', 'market', 'personal_workspace', 'supplier_report'] }
  const organisationId = r.contextMode === 'ACCOUNT' ? null : 'org-a'
  const shared = r.dataClasses[0] === 'SHARED_KNOWLEDGE'
  const state = { applicationId: application.appId, environment: 'development', policyVersion: 'p1', usagePolicy: 'NOT_APPLICABLE',
    access: { type: organisationId ? 'MEMBERSHIP' : 'ACCOUNT_SELF', actorId: 'user-a', organisationId, status: 'ACTIVE', version: 'a1', sourceRef: 'membership:1', expiresAt: expiry, permissions: [{ operation, feature: r.feature, resourceId: null }, { operation: 'supplier.report.read', feature: 'supplier_report', resourceId: null }], denies: [] },
    resource: { id: 'r1', type: r.resourceType, dataClass: r.dataClasses[0], ownerOrganisationId: shared ? null : organisationId, ownerUserId: r.dataClasses[0].includes('USER') || r.contextMode === 'ACCOUNT' ? 'user-a' : null, environment: 'development', version: 'r1', projectionVersion: 'v1', ...(shared ? { approvedSharedProjection: true } : {}), contentRequirements: [{ product: 'SPENDGURU', feature: 'benchmark' }] },
    products: ['SPENDGURU', 'SUPPLIER_INTELLIGENCE'].map(product => ({ product, features: ['benchmark', 'market', 'personal_workspace', 'supplier_report'], organisationId, environment: 'development', applicationId: application.appId, status: 'ACTIVE', version: 'g1', sourceRef: 'contract:1', source: 'CONTRACT', expiresAt: expiry })),
    inputs: [{ id: 'shared-report', type: 'supplier_report', dataClass: 'SHARED_KNOWLEDGE', ownerOrganisationId: null, ownerUserId: null, environment: 'development', version: 's1', projectionVersion: 'v1', approvedSharedProjection: true }],
  }
  const events = [], writes = []
  const controls = { failIntent: false, failOutcome: false, failProjection: false }
  const options = { application, now: () => time, authenticate: issuer.authenticate,
    recordAudit: async event => { if (controls.failIntent && event.phase === 'INTENT') throw Error('audit unavailable'); events.push(event) },
    withTransaction: async (_binding, action) => {
      const pending = []
      const value = await action({ state, transaction: pending, transactionalEffects: true, outputBoundaryVersion: 'v1',
        recordOutcome: async e => { if (controls.failOutcome) throw Error('outcome unavailable'); pending.push(e) },
        projectOutput: value => { if (controls.failProjection) throw Error('unsafe output'); return value },
      })
      writes.push(...pending.filter(v => v.phase !== 'OUTCOME')); events.push(...pending.filter(v => v.phase === 'OUTCOME')); return value
    },
  }
  const input = { contractId: OPERATION_CONTRACT.id, contractVersion: OPERATION_CONTRACT.version, operation, resourceId: 'r1', organisationId, payload: { selected: 'series-a' }, request: new Request('https://isolated.test', { headers: { authorization: `Bearer ${issuer.issue('user-a')}` } }) }
  let invoked = 0
  const action = async (context, tx) => { invoked++; tx.push({ organisationId: context.organisationId, actorId: context.actorId }); return { ok: true } }
  return { input, state, application, options, events, writes, controls, issuer, action, get invoked() { return invoked }, execute: () => createOperationExecutor(options).execute(input, action) }
}

for (const operation of IMPLEMENTED_OPERATIONS) {
  test(`${operation}: explicit positive rule and durable intent/outcome`, async () => {
    const f = fixture(operation); const result = await f.execute(); assert.equal(result.decision, 'ALLOW'); assert.equal(f.invoked, 1); assert.deepEqual(f.events.map(e => e.phase), ['INTENT', 'OUTCOME'])
  })
  test(`${operation}: permission is independently required`, async () => {
    const f = fixture(operation); f.state.access.permissions = []; await assert.rejects(f.execute(), e => e instanceof OperationDenied && e.reasonCode === 'PERMISSION_DENIED'); assert.equal(f.invoked, 0)
  })
}

const mutations = [
  ['unknown operation', f => { f.input.operation = 'knowledge.ingest' }, 'PERMISSION_DENIED'],
  ['prototype name is not an operation', f => { f.input.operation = 'toString' }, 'PERMISSION_DENIED'],
  ['unknown contract', f => { f.input.contractVersion = '2.0.0' }, 'UNSUPPORTED_CONTRACT'],
  ['client role headers cannot authenticate', f => { f.input.request = new Request('https://isolated.test', { headers: { 'x-clerk-user-id': 'user-a', 'x-clerk-org-id': 'org-a', 'x-clerk-org-role': 'admin' } }) }, 'UNVERIFIED_IDENTITY'],
  ['forged verified object cannot authenticate', f => { f.input.request = { verified: true, userId: 'user-a' } }, 'UNVERIFIED_IDENTITY'],
  ['another signing key', f => { const other = createTestIdentityIssuer({ applicationId: 'app-1', now: () => time }); f.input.request = new Request('https://isolated.test', { headers: { authorization: `Bearer ${other.issue('user-a')}` } }) }, 'UNVERIFIED_IDENTITY'],
  ['expired identity', f => { f.input.request = new Request('https://isolated.test', { headers: { authorization: `Bearer ${f.issuer.issue('user-a', { expiresAt: new Date(time - 1).toISOString() })}` } }) }, 'UNVERIFIED_IDENTITY'],
  ['wrong audience', f => { f.input.request = new Request('https://isolated.test', { headers: { authorization: `Bearer ${f.issuer.issue('user-a', { audience: 'foreign-app' })}` } }) }, 'UNVERIFIED_IDENTITY'],
  ['wrong environment', f => { f.state.environment = 'staging' }, 'POLICY_UNAVAILABLE'],
  ['wrong app policy', f => { f.state.applicationId = 'foreign-app' }, 'POLICY_UNAVAILABLE'],
  ['missing policy version', f => { f.state.policyVersion = '' }, 'POLICY_UNAVAILABLE'],
  ['revoked membership', f => { f.state.access.status = 'REVOKED' }, 'ACCESS_BASIS_INVALID'],
  ['expired membership', f => { f.state.access.expiresAt = new Date(time).toISOString() }, 'ACCESS_BASIS_INVALID'],
  ['another member cannot reuse basis', f => { f.state.access.actorId = 'user-b' }, 'ACCESS_BASIS_INVALID'],
  ['another organisation', f => { f.input.organisationId = 'org-b' }, 'CONTEXT_INVALID'],
  ['missing organisation', f => { f.input.organisationId = null }, 'CONTEXT_INVALID'],
  ['another resource', f => { f.input.resourceId = 'foreign' }, 'RESOURCE_SCOPE_MISMATCH'],
  ['foreign resource organisation', f => { f.state.resource.ownerOrganisationId = 'org-b' }, 'RESOURCE_SCOPE_MISMATCH'],
  ['foreign resource environment', f => { f.state.resource.environment = 'staging' }, 'RESOURCE_SCOPE_MISMATCH'],
  ['unknown classification', f => { f.state.resource.dataClass = 'UNKNOWN' }, 'RESOURCE_SCOPE_MISMATCH'],
  ['missing resource version', f => { f.state.resource.version = '' }, 'RESOURCE_SCOPE_MISMATCH'],
  ['admin label grants no permission', f => { f.state.access.role = 'ORGANISATION_OWNER'; f.state.access.permissions = [] }, 'PERMISSION_DENIED'],
  ['explicit denial overrides grant', f => { f.state.access.denies = [...f.state.access.permissions] }, 'PERMISSION_DENIED'],
  ['product alone is insufficient', f => { f.state.access.permissions = [] }, 'PERMISSION_DENIED'],
  ['permission without product', f => { f.state.products = [] }, 'PRODUCT_UNAVAILABLE'],
  ['expired product', f => { f.state.products[0].expiresAt = new Date(time).toISOString() }, 'PRODUCT_UNAVAILABLE'],
  ['foreign product organisation', f => { f.state.products[0].organisationId = 'org-b' }, 'PRODUCT_UNAVAILABLE'],
  ['foreign product application', f => { f.state.products[0].applicationId = 'foreign' }, 'PRODUCT_UNAVAILABLE'],
  ['client checkout is not product proof', f => { f.state.products[0].source = 'CHECKOUT_SUCCESS' }, 'PRODUCT_UNAVAILABLE'],
  ['unknown usage cannot be unlimited', f => { f.state.usagePolicy = null }, 'LIMIT_POLICY_UNAVAILABLE'],
  ['missing durable intent', f => { f.controls.failIntent = true }, 'AUDIT_UNAVAILABLE'],
]
for (const [name, mutate, code] of mutations) test(name, async () => {
  const f = fixture(); mutate(f); await assert.rejects(f.execute(), e => e.reasonCode === code); assert.equal(f.invoked, 0); assert.equal(f.writes.length, 0)
})

test('outcome failure rolls back effect and leaves durable failure correlation', async () => {
  const f = fixture('benchmark.selection.write'); f.controls.failOutcome = true
  await assert.rejects(f.execute(), e => e.reasonCode === 'AUDIT_UNAVAILABLE'); assert.equal(f.invoked, 1); assert.deepEqual(f.writes, []); assert.deepEqual(f.events.map(e => e.phase), ['INTENT', 'FAILURE']); assert.equal(f.events[0].decisionId, f.events[1].decisionId)
})
test('projection failure rolls back effects and withholds output', async () => {
  const f = fixture('benchmark.selection.write'); f.controls.failProjection = true; await assert.rejects(f.execute()); assert.deepEqual(f.writes, [])
})
test('another user in same organisation cannot read personal list', async () => {
  const f = fixture('personal.list.read'); f.state.resource.ownerUserId = 'user-b'; await assert.rejects(f.execute(), e => e.reasonCode === 'RESOURCE_SCOPE_MISMATCH')
})
test('personal list requires all content entitlements, including the empty-list owning feature policy', async () => {
  const f = fixture('personal.list.read'); f.state.resource.contentRequirements = []; await assert.rejects(f.execute(), e => e.reasonCode === 'PRODUCT_UNAVAILABLE')
  f.state.resource.contentRequirements = [{ product: 'SPENDGURU', feature: 'benchmark' }, { product: 'SUPPLIER_INTELLIGENCE', feature: 'supplier_report' }]; f.state.products.pop(); await assert.rejects(f.execute(), e => e.reasonCode === 'PRODUCT_UNAVAILABLE')
})
test('shared read refuses private metadata masquerading as shared knowledge', async () => {
  const f = fixture('knowledge.read'); f.state.resource.ownerOrganisationId = 'org-a'; await assert.rejects(f.execute(), e => e.reasonCode === 'RESOURCE_SCOPE_MISMATCH')
})
test('projection separately requires shared read and authorizes every input', async () => {
  const f = fixture('supplier.report.project'); f.state.access.permissions = f.state.access.permissions.filter(p => p.operation !== 'supplier.report.read'); await assert.rejects(f.execute(), e => e.reasonCode === 'PERMISSION_DENIED')
  f.state.access.permissions.push({ operation: 'supplier.report.read', feature: 'supplier_report', resourceId: null }); f.state.inputs[0].ownerOrganisationId = 'org-b'; await assert.rejects(f.execute(), e => e.reasonCode === 'RESOURCE_SCOPE_MISMATCH')
})
test('fixed PORR binding and standalone feature ceilings are independent of permissions', async () => {
  const f = fixture(); f.application.profileId = 'PORR_SUITE'; f.application.organisationId = 'org-b'; await assert.rejects(f.execute(), e => e.reasonCode === 'CONTEXT_INVALID')
  f.application.profileId = 'SUPPLIER_INTELLIGENCE_STANDALONE'; f.application.organisationId = null; f.application.features = ['supplier_report']; await assert.rejects(f.execute(), e => e.reasonCode === 'APPLICATION_FEATURE_UNAVAILABLE')
})
test('service actor stays a service and is scoped; delegation is denied until implemented', async () => {
  const f = fixture(); f.input.request = new Request('https://isolated.test', { headers: { authorization: `Bearer ${f.issuer.issue('service-a', { kind: 'SERVICE', actorId: 'service-a', serviceId: 'service-a', userId: undefined })}` } }); f.state.access.actorId = 'service-a'; f.state.access.type = 'SERVICE_GRANT'; const result = await f.execute(); assert.equal(result.decision, 'ALLOW'); assert.equal(f.events[0].actorKind, 'SERVICE'); assert.equal(f.events[0].subjectUserId, null)
  f.state.access.type = 'DELEGATED_USER'; await assert.rejects(f.execute(), e => e.reasonCode === 'DELEGATION_INVALID')
})
test('replay always rechecks current access rather than trusting previous ALLOW', async () => {
  const f = fixture(); await f.execute(); f.state.access.status = 'REVOKED'; await assert.rejects(f.execute(), e => e.reasonCode === 'ACCESS_BASIS_INVALID'); assert.equal(f.invoked, 1)
})
test('payload is canonically bound and snapshotted before asynchronous authentication', async () => {
  const f = fixture(); const before = operationPayloadDigest(f.input.payload); const promise = f.execute(); f.input.payload.selected = 'changed'; await promise; assert.equal(f.events[0].payloadDigest, before); assert.equal(operationPayloadDigest({ b: 2, a: 1 }), operationPayloadDigest({ a: 1, b: 2 }))
})
test('candidate rules match exact normative rows and never imply all 30 are implemented', async () => {
  const matrix = JSON.parse(fs.readFileSync(new URL('../../../Canon/registries/operation-access-matrix-v1.json', import.meta.url)))
  assert.equal(IMPLEMENTED_OPERATIONS.length, 9); assert.equal(matrix.rules.length, 30)
  for (const operation of IMPLEMENTED_OPERATIONS) assert.equal(matrix.rules.filter(r => r.operation === operation && r.usagePolicy === 'NOT_APPLICABLE').length, 1)
  assert.match(await operationSourceDigest(), /^[a-f0-9]{64}$/)
})

test('application changes cannot silently enable composite read', async () => {
  const f = fixture('supplier.report.project'); f.application.operations = ['supplier.report.project']; await assert.rejects(f.execute(), e => e.reasonCode === 'PERMISSION_DENIED')
})
test('trusted identity is reduced to safe fields rather than carrying an IdP token', async () => {
  const f = fixture(); const authenticate = f.options.authenticate; f.options.authenticate = async r => ({ ...await authenticate(r), rawToken: 'must-not-enter-context' })
  await createOperationExecutor(f.options).execute(f.input, context => { assert.equal(context.actor.rawToken, undefined); return null })
  assert(!JSON.stringify(f.events).includes('must-not-enter-context'))
})
test('entitlement expiring during a local write aborts before commit', async () => {
  const f = fixture('benchmark.selection.write'); let current = time; f.options.now = () => current
  await assert.rejects(createOperationExecutor(f.options).execute(f.input, (_context, tx) => { tx.push({ write: true }); current += 3_600_001; return null }), e => ['ACCESS_BASIS_INVALID', 'PRODUCT_UNAVAILABLE'].includes(e.reasonCode)); assert.deepEqual(f.writes, [])
})
