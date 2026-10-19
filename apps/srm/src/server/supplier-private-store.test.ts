import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomUUID } from 'node:crypto'
import type { PoolClient } from 'pg'
import { bindOrganizationTransaction } from './db'
import { createLookup, startAttempt, finishAttempt, appendSnapshot, appendSectionProjection, appendFinancialFacts } from './xray-repository'
import { saveMgbiArchive } from './mgbi-archive'
import { saveFinancialDocuments } from './financial-documents'
import { createSrmSupplierPrivateStore, MAX_PRIVATE_SUPPLIER_RESULT_BYTES } from './supplier-private-store'
import type { createSrmSupplierRequestContinuation, SupplierServiceContinuation, SupplierServicePhaseInput } from './supplier-request-continuation'

const org = '11111111-1111-4111-8111-111111111111', foreign = '22222222-2222-4222-8222-222222222222'
type Continuation = ReturnType<typeof createSrmSupplierRequestContinuation>
test('private business composition requires explicit server source and a continuation', () => {
  assert.throws(() => createSrmSupplierPrivateStore({ continuation: {} as Continuation, boundaryDigest: 'a'.repeat(64) }), TypeError)
  assert.throws(() => createSrmSupplierPrivateStore({ continuation: { run: async () => undefined } as unknown as Continuation, boundaryDigest: '' }), TypeError)
  assert.equal(MAX_PRIVATE_SUPPLIER_RESULT_BYTES, 32 * 1024 * 1024)
})
test('private business selection rejects authority fields before entering its continuation', async () => {
  let calls = 0
  const continuation = { run: async () => { calls++; throw Error('must not run') } } as unknown as Continuation
  const store = createSrmSupplierPrivateStore({ continuation, boundaryDigest: 'a'.repeat(64) })
  const selection = { requestId: randomUUID(), organisationId: org, command: { kind: 'SUPPLIER_REPORT' as const, nip: '8650004194' },
    idempotencyKey: 'synthetic-private-business-key', request: new Request('http://localhost:3400/api/xray/requests') }
  await assert.rejects(store.register({ ...selection, actorId: randomUUID() } as never))
  await assert.rejects(store.general(selection, { section: {}, errorCode: null, rawRecord: {} } as never))
  assert.equal(calls, 0)
})
test('Service business continuation cannot be selected implicitly by the HUMAN store', () => {
  const continuation: SupplierServiceContinuation = { executionMode: 'DELEGATED_SERVICE', run: async () => { throw Error('must not run') } }
  assert.throws(() => {
    // @ts-expect-error A Service continuation requires explicit Service options.
    createSrmSupplierPrivateStore({ continuation, boundaryDigest: 'a'.repeat(64) })
  }, TypeError)
  assert.throws(() => createSrmSupplierPrivateStore({ executionMode: 'DELEGATED_SERVICE', continuation,
    boundaryDigest: 'a'.repeat(64), delegatedBoundaryDigest: '' }), TypeError)
  assert.throws(() => createSrmSupplierPrivateStore({ executionMode: 'DELEGATED_SERVICE', continuation: {} as SupplierServiceContinuation,
    boundaryDigest: 'a'.repeat(64), delegatedBoundaryDigest: 'b'.repeat(64) }), TypeError)
})
test('explicit Service selection refuses browser identity and authority fields before any continuation', async () => {
  let calls = 0
  const continuation: SupplierServiceContinuation = { executionMode: 'DELEGATED_SERVICE', run: async () => { calls++; throw Error('must not run') } }
  const store = createSrmSupplierPrivateStore({ executionMode: 'DELEGATED_SERVICE', continuation,
    boundaryDigest: 'a'.repeat(64), delegatedBoundaryDigest: 'b'.repeat(64) })
  const selection = { requestId: randomUUID(), organisationId: org, command: { kind: 'SUPPLIER_REPORT' as const, nip: '8650004194' } }
  for (const extra of [{ request: new Request('http://localhost:3400') }, { idempotencyKey: 'borrowed-browser-key' },
    { actorId: randomUUID() }, { subjectUserId: randomUUID() }, { role: 'profitia_access_owner' }]) {
    await assert.rejects(store.register({ ...selection, ...extra } as never))
  }
  assert.equal(calls, 0)
})
test('explicit Service register forwards only a closed manifest to the same continuation', async () => {
  let observed: SupplierServicePhaseInput | undefined
  const continuation: SupplierServiceContinuation = { executionMode: 'DELEGATED_SERVICE', run: async input => {
    observed = input; return Object.freeze({ requestId: input.requestId, phaseId: input.phaseId, status: 'REPLAY' })
  } }
  const store = createSrmSupplierPrivateStore({ executionMode: 'DELEGATED_SERVICE', continuation,
    boundaryDigest: 'a'.repeat(64), delegatedBoundaryDigest: 'b'.repeat(64) })
  const selection = { requestId: randomUUID(), organisationId: org, command: { kind: 'SUPPLIER_REPORT' as const, nip: '8650004194' } }
  assert.deepEqual(await store.register(selection), { requestId: selection.requestId, phaseId: 'REGISTER_LOOKUP', status: 'REPLAY' })
  assert.deepEqual(Object.keys(observed!).sort(), ['command','data','organisationId','phaseId','requestId'])
  assert.equal(observed!.command.nip, selection.command.nip)
  assert.equal(observed!.phaseId, 'REGISTER_LOOKUP')
})
test('existing repository, archive and document helpers retain one explicit bound transaction', async () => {
  const calls: { sql: string; values?: unknown[] }[] = [], requestId = randomUUID(), supplierId = randomUUID(), attemptId = randomUUID(), snapshotId = randomUUID()
  let releases = 0
  const client = { async query(sql: string, values?: unknown[]) {
    calls.push({ sql, values })
    if (sql.includes('current_database')) return { rows: [{ database_name: 'srm_app', bypass_rls: false, superuser: false, neon_superuser_member: false }] }
    if (sql.includes("current_setting('srm.organization_id'")) return { rows: [{ organization_id: org }] }
    if (sql.includes('FROM srm.organizations')) return { rows: [{ id: org }] }
    const id = sql.startsWith('INSERT INTO srm.suppliers') ? supplierId : sql.startsWith('INSERT INTO srm.lookup_requests') ? requestId
      : sql.startsWith('INSERT INTO srm.provider_attempts') ? attemptId : snapshotId
    return { rows: [{ id }], rowCount: 1 }
  }, release() { releases++ } } as unknown as PoolClient
  const pool = bindOrganizationTransaction(org, client)
  assert.deepEqual(await createLookup(org, { type: 'NIP', value: '8650004194' }, 'COMPANY', pool, requestId), { supplierId, requestId })
  await startAttempt(org, requestId, 'general', 1, 'PROVIDER', pool)
  await appendSnapshot(org, { supplierId, attemptId, section: 'general', dataClass: 'COMPANY', payload: { nip: '8650004194' }, retrievedAt: new Date() }, pool)
  await appendSectionProjection(org, { supplierId, snapshotId, section: 'general', data: { nip: '8650004194' }, version: 1 }, pool)
  await appendFinancialFacts(org, [{ supplierId, snapshotId, metricCode: 'ASSETS', periodStart: '2025-01-01', periodEnd: '2025-12-31', periodType: 'YEAR', statementScope: 'UNIT', amount: '100', sourceAmount: '100', normalizationRule: 'SOURCE_VALUE', currencyCode: 'PLN', unitCode: 'PLN', sourcePath: 'synthetic', validationStatus: 'VALID' }], pool)
  await finishAttempt(org, attemptId, 'SUCCESS', {}, pool)
  await saveMgbiArchive(org, '8650004194', 'pl-krs-wp-record', [{ results: [] }], 0, new Date().toISOString(), requestId, pool)
  await saveFinancialDocuments(org, '8650004194', [], pool)
  assert(calls.some(c => c.sql.startsWith('INSERT INTO srm.mgbi_source_archives')))
  assert(calls.some(c => c.sql.startsWith('INSERT INTO srm.financial_facts')))
  assert.equal(calls.find(c => c.sql.startsWith('INSERT INTO srm.lookup_requests'))?.values?.[5], requestId)
  assert(!calls.some(c => ['BEGIN','COMMIT','ROLLBACK'].includes(c.sql)))
  assert.equal(releases, 0)
  const count = calls.length
  await assert.rejects(startAttempt(foreign, requestId, 'general', 1, 'PROVIDER', pool), /organization mismatch/)
  assert.equal(calls.length, count)
  await assert.rejects(createLookup(org, { type: 'NIP', value: '8650004194' }, 'COMPANY', undefined, requestId), /bound accepted request/)
})
