import assert from 'node:assert/strict';
import test from 'node:test';
import type { JdgRegistryData, SectionEnvelope } from '@profitia/srm-xray';
import { createJdgLookup, type JdgLookupPorts } from './jdg-lookup';

const org = '11111111-1111-4111-8111-111111111111', nip = '5213390341';
const section: SectionEnvelope<JdgRegistryData> = {
  status: 'SUCCESS', source: { provider: 'CEIDG', model: 'firma', recordId: 'synthetic-record' },
  retrievedAt: '2026-10-19T10:00:00Z', effectiveAt: null, warnings: [],
  data: { entries: [{ recordId: 'synthetic-record', name: 'Synthetic JDG', status: 'Aktywny', nip, regon: null, fields: [] }] },
};

function fixture(result: Awaited<ReturnType<JdgLookupPorts['fetchCeidgJdg']>> = { section, snapshot: { firma: [{ synthetic: true }] }, errorCode: null }) {
  const calls: string[] = [], snapshots: Parameters<JdgLookupPorts['appendSnapshot']>[1][] = [];
  const outcomes: Array<{ status: string; code?: string }> = [];
  const ports: JdgLookupPorts = {
    createLookup: async (o, identifier, entity) => { assert.equal(o, org); assert.deepEqual(identifier, { type: 'NIP', value: nip }); assert.equal(entity, 'JDG'); calls.push('lookup'); return { supplierId: 'supplier', requestId: 'request' }; },
    startAttempt: async (o, requestId, part) => { assert.equal(o, org); assert.equal(requestId, 'request'); assert.equal(part, 'jdg'); calls.push('attempt'); return 'attempt'; },
    fetchCeidgJdg: async value => { assert.equal(value, nip); calls.push('provider'); return result; },
    appendSnapshot: async (o, input) => { assert.equal(o, org); calls.push('snapshot'); snapshots.push(input); return 'snapshot'; },
    appendSectionProjection: async (o, input) => { assert.equal(o, org); assert.equal(input.snapshotId, 'snapshot'); assert.equal(input.section, 'jdg'); assert.equal(input.version, 1); assert.deepEqual(input.data, section.data); calls.push('projection'); return 'projection'; },
    finishAttempt: async (o, attempt, status, details) => { assert.equal(o, org); assert.equal(attempt, 'attempt'); calls.push('finish'); outcomes.push({ status, code: details?.errorCode }); },
  };
  return { ports, calls, snapshots, outcomes };
}

test('explicit JDG composition preserves original order, snapshot class and thirty-day retention', async () => {
  const f = fixture(), run = createJdgLookup(f.ports);
  f.ports.fetchCeidgJdg = async () => { throw Error('mutated dependency must not execute'); };
  assert.deepEqual(await run(org, nip), section);
  assert.deepEqual(f.calls, ['lookup', 'attempt', 'provider', 'snapshot', 'projection', 'finish']);
  assert.equal(f.snapshots[0].dataClass, 'JDG_REGISTRY');
  assert.equal(f.snapshots[0].retentionUntil!.getTime() - f.snapshots[0].retrievedAt.getTime(), 30 * 24 * 60 * 60 * 1000);
  assert.deepEqual(f.outcomes, [{ status: 'SUCCESS', code: undefined }]);
});

test('empty, timeout and error outcomes retain original terminal states without a personal snapshot', async () => {
  for (const [status, code, terminal] of [['EMPTY', null, 'NO_DATA'], ['ERROR', 'TIMEOUT', 'TIMEOUT'], ['ERROR', 'FETCH_ERROR', 'ERROR']] as const) {
    const f = fixture({ section: { ...section, status, data: null }, snapshot: null, errorCode: code });
    await createJdgLookup(f.ports)(org, nip);
    assert.equal(f.snapshots.length, 0); assert.equal(f.outcomes[0].status, terminal);
  }
});

test('JDG persistence failure records the original error and never reports a successful projection', async () => {
  const f = fixture(); f.ports.appendSnapshot = async () => { throw Error('synthetic persistence refused'); };
  await assert.rejects(createJdgLookup(f.ports)(org, nip), (error: unknown) => {
    assert(error instanceof Error); assert.equal(error.message, 'SRM lookup stage failed');
    assert(error.cause instanceof Error); assert.equal(error.cause.message, 'synthetic persistence refused'); return true;
  });
  assert.deepEqual(f.outcomes, [{ status: 'ERROR', code: 'SRM_PERSISTENCE_ERROR' }]);
  assert(!f.calls.includes('projection'));
});

test('JDG constructor refuses incomplete, inherited, accessor, symbol and unknown ports before any effect', () => {
  const f = fixture(), missing = { ...f.ports } as Partial<JdgLookupPorts>; delete missing.finishAttempt;
  const accessor = { ...f.ports }; Object.defineProperty(accessor, 'createLookup', { enumerable: true, get() { throw Error('getter must not execute'); } });
  for (const input of [missing, Object.create(f.ports), accessor, { ...f.ports, [Symbol('extra')]: () => {} }, { ...f.ports, extra: () => {} }]) {
    assert.throws(() => createJdgLookup(input as JdgLookupPorts), /Complete explicit JDG ports/);
  }
  assert.deepEqual(f.calls, []);
});

test('JDG explicit selection refuses malformed or coerced identity before persistence or provider work', async () => {
  const f = fixture(), run = createJdgLookup(f.ports);
  for (const [o, n] of [['other-org', nip], [org, '0000000000'], [org, '5213390341/extra'], [org, 5213390341]]) {
    await assert.rejects(run(o as string, n as string), /Explicit JDG selection/);
  }
  assert.deepEqual(f.calls, []);
});
