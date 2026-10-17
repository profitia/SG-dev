import assert from 'node:assert/strict'
import test from 'node:test'
import { createOperationExecutor, OPERATION_CONTRACT, OperationDenied } from '../src/operation-context.mjs'
import { createTestIdentityIssuer } from '../../../apps/architecture-lab/src/operation-test-authority.mjs'

const start = Date.parse('2026-10-17T20:00:00Z')
const expiresAt = new Date(start + 60_000).toISOString()
function fixture() {
  let clock = start
  const issuer = createTestIdentityIssuer({ applicationId: 'export-test', now: () => clock })
  const application = { appId: 'export-test', profileId: 'SUPPLIER_INTELLIGENCE_STANDALONE', deploymentId: 'isolated', configurationVersion: '1', environment: 'development', identityIssuer: issuer.issuer, organisationId: null, features: ['supplier_report'], operations: ['supplier.report.read', 'supplier.report.project', 'supplier.report.export'] }
  const resource = { id: 'company-a', type: 'supplier_export', dataClass: 'ORGANISATION_PRIVATE', environment: 'development', ownerOrganisationId: 'org-a', ownerUserId: null, version: '1', projectionVersion: '1' }
  const state = { applicationId: application.appId, environment: 'development', policyVersion: '1', usagePolicy: 'NOT_APPLICABLE', resource,
    access: { type: 'MEMBERSHIP', actorId: 'user-a', organisationId: 'org-a', status: 'ACTIVE', version: '1', sourceRef: 'synthetic-member', expiresAt, permissions: application.operations.map(operation => ({ operation, feature: 'supplier_report', resourceId: 'company-a' })), denies: [] },
    products: [{ product: 'SUPPLIER_INTELLIGENCE', features: ['supplier_report'], organisationId: 'org-a', environment: 'development', applicationId: application.appId, status: 'ACTIVE', version: '1', sourceRef: 'synthetic-offer', source: 'EXPLICIT_OFFER', expiresAt }],
    inputs: [
      { ...resource, type: 'supplier_report', dataClass: 'SHARED_KNOWLEDGE', ownerOrganisationId: null, approvedSharedProjection: true },
      { ...resource, type: 'supplier_projection' },
    ],
  }
  const events = [], committed = [], calls = []
  const controls = { failIntent: null, failOutcome: null, failFailure: null, failPreparation: false, failAction: false, failOutput: false, afterPreparation: () => {}, afterAction: () => {}, outcome: 'SUCCEEDED' }
  const input = { contractId: OPERATION_CONTRACT.id, contractVersion: OPERATION_CONTRACT.version, operation: 'supplier.report.export', resourceId: 'company-a', organisationId: 'org-a', payload: { years: [2024], columns: ['revenue'] }, request: new Request('https://export.fixture.test', { headers: { authorization: `Bearer ${issuer.issue('user-a')}` } }) }
  let preparationContext, exportContext
  const sessionOptions = {}
  const options = { application, now: () => clock, authenticate: issuer.authenticate,
    recordAudit: async event => {
      calls.push(`${event.operation}:${event.phase}`)
      if (event.phase === 'INTENT' && controls.failIntent === event.operation) throw Error('synthetic intent outage')
      if (event.phase === 'FAILURE' && controls.failFailure === event.operation) throw Error('synthetic failure outage')
      events.push(event)
    },
    withTransaction: async (_binding, run) => {
      const pending = [], outcomes = []
      const result = await run({ state, transaction: pending, transactionalEffects: true, outputBoundaryVersion: '1',
        prepareInputs: async context => {
          preparationContext = context; calls.push('prepare')
          assert.equal(context.operation, 'supplier.report.project'); assert.equal(context.effect, 'WRITE')
          assert.equal(context.resource.type, 'supplier_projection')
          assert.throws(() => { context.actorId = 'user-b' }, TypeError)
          pending.push('private SQL restoration')
          if (controls.failPreparation) throw Error('synthetic preparation failure')
          controls.afterPreparation()
        },
        projectOutput: value => { calls.push('project'); if (controls.failOutput) throw Error('synthetic output failure'); return value },
        describeOutcome: async () => controls.outcome,
        recordOutcome: async event => {
          calls.push(`${event.operation}:${event.phase}`)
          if (controls.failOutcome === event.operation) throw Error('synthetic outcome outage')
          outcomes.push(event)
        },
        ...sessionOptions,
      })
      committed.push(...pending); events.push(...outcomes)
      return result
    },
  }
  const action = async (context, tx) => {
    exportContext = context; calls.push('export')
    assert.equal(context.operation, 'supplier.report.export'); assert.equal(context.effect, 'EXPORT')
    tx.push('scoped file projection')
    if (controls.failAction) throw Error('synthetic export failure')
    controls.afterAction()
    return { state: controls.outcome, columns: ['revenue'] }
  }
  return { application, state, input, options, controls, sessionOptions, events, calls, committed,
    advance: ms => { clock += ms }, contexts: () => [preparationContext, exportContext],
    execute: () => createOperationExecutor(options).execute(input, action) }
}

test('export requires all input rights before separately audited preparation and atomic outcomes', async () => {
  const f = fixture(); await f.execute()
  assert.deepEqual(f.calls, ['supplier.report.export:INTENT', 'supplier.report.project:INTENT', 'prepare', 'supplier.report.project:OUTCOME', 'export', 'project', 'supplier.report.export:OUTCOME'])
  assert.deepEqual(f.committed, ['private SQL restoration', 'scoped file projection'])
  const [preparation, exported] = f.contexts()
  assert.notEqual(preparation.decisionId, exported.decisionId)
  assert.equal(preparation.correlationId, exported.correlationId)
  assert.equal(preparation.payloadDigest, exported.payloadDigest)
  for (const event of f.events) {
    assert.equal(event.actorId, 'user-a'); assert.equal(event.subjectUserId, 'user-a')
    assert.equal(event.organisationId, 'org-a'); assert.equal(event.correlationId, exported.correlationId)
    assert.equal(Object.hasOwn(event, 'payload'), false)
    assert.equal(event.productEvidence[0].product, 'SUPPLIER_INTELLIGENCE')
  }
})
for (const operation of ['supplier.report.read', 'supplier.report.project', 'supplier.report.export']) {
  for (const mode of ['missing', 'explicit deny', 'foreign resource', 'disabled in application']) {
    test(`export rejects ${mode} ${operation} before any preparation or file`, async () => {
      const f = fixture()
      if (mode === 'missing') f.state.access.permissions = f.state.access.permissions.filter(p => p.operation !== operation)
      if (mode === 'explicit deny') f.state.access.denies = [{ operation, feature: 'supplier_report', resourceId: 'company-a' }]
      if (mode === 'foreign resource') f.state.access.permissions.find(p => p.operation === operation).resourceId = 'company-b'
      if (mode === 'disabled in application') f.application.operations = f.application.operations.filter(p => p !== operation)
      await assert.rejects(f.execute(), e => e.reasonCode === 'PERMISSION_DENIED')
      assert(!f.calls.includes('prepare')); assert(!f.calls.includes('export')); assert.deepEqual(f.committed, [])
    })
  }
}
const invalidInputs = [
  ['missing', f => { delete f.state.inputs }],
  ['one input', f => { f.state.inputs.pop() }],
  ['extra input', f => { f.state.inputs.push({ ...f.state.inputs[0] }) }],
  ['foreign shared ID', f => { f.state.inputs[0].id = 'company-b' }],
  ['foreign private ID', f => { f.state.inputs[1].id = 'company-b' }],
  ['private foreign organisation', f => { f.state.inputs[1].ownerOrganisationId = 'org-b' }],
  ['private personal data', f => { f.state.inputs[1].ownerUserId = 'user-a'; f.state.inputs[1].dataClass = 'USER_IN_ORGANISATION_PRIVATE' }],
  ['private wrong type', f => { f.state.inputs[1].type = 'personal_list' }],
  ['shared private metadata', f => { f.state.inputs[0].ownerOrganisationId = 'org-a' }],
  ['unapproved shared projection', f => { f.state.inputs[0].approvedSharedProjection = false }],
  ['unversioned input', f => { f.state.inputs[0].version = '' }],
  ['unversioned projection', f => { f.state.inputs[1].projectionVersion = '' }],
  ['foreign input environment', f => { f.state.inputs[1].environment = 'staging' }],
  ['personal output', f => { f.state.resource.dataClass = 'USER_IN_ORGANISATION_PRIVATE'; f.state.resource.ownerUserId = 'user-a' }],
]
for (const [name, mutate] of invalidInputs) test(`export refuses ${name} before side effects`, async () => {
  const f = fixture(); mutate(f)
  await assert.rejects(f.execute(), e => e.reasonCode === 'RESOURCE_SCOPE_MISMATCH')
  assert(!f.calls.includes('prepare')); assert(!f.calls.includes('export')); assert.deepEqual(f.committed, [])
})
for (const [name, mutate, code] of [
  ['foreign application', f => { f.state.applicationId = 'other' }, 'POLICY_UNAVAILABLE'],
  ['foreign policy environment', f => { f.state.environment = 'staging' }, 'POLICY_UNAVAILABLE'],
  ['missing product', f => { f.state.products = [] }, 'PRODUCT_UNAVAILABLE'],
  ['foreign product', f => { f.state.products[0].organisationId = 'org-b' }, 'PRODUCT_UNAVAILABLE'],
  ['expired membership', f => { f.state.access.expiresAt = new Date(start).toISOString() }, 'ACCESS_BASIS_INVALID'],
  ['no preparation adapter', f => { f.sessionOptions.prepareInputs = undefined }, 'POLICY_UNAVAILABLE'],
  ['invalid outcome adapter', f => { f.sessionOptions.describeOutcome = null }, 'POLICY_UNAVAILABLE'],
  ['missing usage policy', f => { f.state.usagePolicy = null }, 'LIMIT_POLICY_UNAVAILABLE'],
]) test(`export refuses ${name} before preparation`, async () => {
  const f = fixture(); mutate(f)
  await assert.rejects(f.execute(), e => e.reasonCode === code)
  assert(!f.calls.includes('prepare')); assert(!f.calls.includes('export'))
})
for (const operation of ['supplier.report.export', 'supplier.report.project']) test(`unavailable ${operation} INTENT prevents all effects`, async () => {
  const f = fixture(); f.controls.failIntent = operation
  await assert.rejects(f.execute(), e => e.reasonCode === 'AUDIT_UNAVAILABLE')
  assert(!f.calls.includes('prepare')); assert(!f.calls.includes('export')); assert.deepEqual(f.committed, [])
})
for (const failure of ['preparation', 'action', 'output', 'preparation outcome', 'export outcome', 'invalid outcome']) test(`${failure} rolls back both effects with correlated failures`, async () => {
  const f = fixture()
  if (failure === 'preparation') f.controls.failPreparation = true
  if (failure === 'action') f.controls.failAction = true
  if (failure === 'output') f.controls.failOutput = true
  if (failure === 'preparation outcome') f.controls.failOutcome = 'supplier.report.project'
  if (failure === 'export outcome') f.controls.failOutcome = 'supplier.report.export'
  if (failure === 'invalid outcome') f.controls.outcome = 'DELIVERED_FROM_CLIENT'
  await assert.rejects(f.execute(), e => ['POLICY_UNAVAILABLE', 'AUDIT_UNAVAILABLE'].includes(e.reasonCode))
  assert.deepEqual(f.committed, [])
  assert.equal(f.events.filter(e => e.phase === 'OUTCOME').length, 0)
  const failures = f.events.filter(e => e.phase === 'FAILURE')
  assert.deepEqual(failures.map(e => e.operation), ['supplier.report.project', 'supplier.report.export'])
  assert.equal(new Set(failures.map(e => e.correlationId)).size, 1)
})
for (const when of ['afterPreparation', 'afterAction']) {
  for (const scope of ['identity/member', 'product', 'module']) test(`${scope} expiry ${when} withholds output and rolls back`, async () => {
    const f = fixture()
    if (scope === 'product') f.state.products[0].expiresAt = new Date(start + 100).toISOString()
    if (scope === 'module') f.sessionOptions.moduleEvidence = { moduleId: 'supplier_report', moduleBindingId: '11111111-1111-4111-8111-111111111111', version: '1', sourceRef: 'synthetic-module', expiresAt: new Date(start + 100).toISOString(), transactionId: '123', moduleSchemaDigest: 'a'.repeat(64), auditSchemaDigest: 'b'.repeat(64) }
    f.controls[when] = () => f.advance(scope === 'identity/member' ? 60_001 : 101)
    await assert.rejects(f.execute(), e => ['ACCESS_BASIS_INVALID', 'PRODUCT_UNAVAILABLE'].includes(e.reasonCode))
    assert.deepEqual(f.committed, []); assert.equal(f.events.some(e => e.phase === 'OUTCOME'), false)
    if (when === 'afterPreparation') assert(!f.calls.includes('export'))
  })
}
for (const outcome of ['NO_DATA', 'SELECTION_UNAVAILABLE']) test(`${outcome} is audited without claiming file delivery`, async () => {
  const f = fixture(); f.controls.outcome = outcome
  await f.execute()
  assert.equal(f.events.at(-1).reasonCode, outcome)
  assert.equal(f.events.find(e => e.operation === 'supplier.report.project' && e.phase === 'OUTCOME').reasonCode, 'SUCCEEDED')
})
test('a failed child FAILURE writer still attempts the parent failure and refuses output', async () => {
  const f = fixture(); f.controls.failAction = true; f.controls.failFailure = 'supplier.report.project'
  await assert.rejects(f.execute(), e => e.reasonCode === 'AUDIT_UNAVAILABLE')
  assert.equal(f.events.at(-1).operation, 'supplier.report.export'); assert.equal(f.events.at(-1).phase, 'FAILURE')
  assert.deepEqual(f.committed, [])
})
test('a current preparation INTENT deadline denial retains its reason', async () => {
  const f = fixture(); const write = f.options.recordAudit
  f.options.recordAudit = event => { if (event.operation === 'supplier.report.project' && event.phase === 'INTENT') throw new OperationDenied('ACCESS_BASIS_INVALID'); return write(event) }
  await assert.rejects(f.execute(), e => e.reasonCode === 'ACCESS_BASIS_INVALID')
  assert(!f.calls.includes('prepare')); assert.deepEqual(f.committed, [])
})
