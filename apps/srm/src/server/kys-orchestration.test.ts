import assert from 'node:assert/strict';
import test from 'node:test';
import type { SectionEnvelope, VerclyKysData } from '@profitia/srm-xray';
import { createXrayKysLookup, type XrayKysPorts, type XrayLookupRequest } from './xray-lookup';
import { getOrFetchKys, type KysCacheStore } from './kys-cache';
import { emptyCard } from '../demo/fixture';

const org = '11111111-1111-4111-8111-111111111111', nip = '5213390341';
const request: XrayLookupRequest = { identifier: { type: 'NIP', value: nip } };
const report = { status: 'SUCCESS', source: { provider: 'VERCLY', model: 'KYS_NIP', recordId: 'synthetic-report' },
  retrievedAt: '2026-10-19T10:00:00Z', effectiveAt: null, warnings: [],
  data: { company: { nip }, pepMatches: [], pepPositionsCount: 0, relatedPersons: [] } } as unknown as SectionEnvelope<VerclyKysData>;

function fixture() {
  const calls: string[] = [], methods: string[] = [];
  const cache = new Map<string, typeof report>();
  let held = false, providerCalls = 0;
  const store: KysCacheStore = {
    read: async (o, n, e) => { assert.equal(o, org); assert.equal(n, nip); return cache.get(`${o}:${n}:${e}`) ?? null; },
    claim: async () => held ? null : 'synthetic-lease',
    renew: async () => true,
    save: async (o, n, e, _lease, value) => { cache.set(`${o}:${n}:${e}`, value); },
    hold: async () => { held = true; }, release: async () => {},
  };
  const ports: XrayKysPorts = {
    readSupplierRegistrationStatus: async (o, n) => { assert.equal(o, org); assert.equal(n, nip); calls.push('registration'); return 'ACTIVE'; },
    purgeExpiredKysPersonal: async o => { assert.equal(o, org); calls.push('private-retention'); },
    purgeExpiredSharedKys: async o => { assert.equal(o, org); calls.push('cache-retention'); },
    createLookup: async (o, identifier, entity) => { assert.equal(o, org); assert.deepEqual(identifier, request.identifier); assert(['COMPANY', 'JDG'].includes(entity!)); calls.push('lookup'); return { requestId: 'request', supplierId: 'supplier' }; },
    getOrFetchKys: (o, n, e, fetchReport, persist, options) => getOrFetchKys(o, n, e, fetchReport, persist,
      { ...options, store, now: () => new Date('2026-10-19T10:00:00Z'), waitMs: 0 }),
    fetchVerclyKys: async (selected, options) => { assert.deepEqual(selected.identifier, request.identifier); options?.signal?.throwIfAborted(); providerCalls++; calls.push('provider'); return { section: report, errorCode: null, correlationId: 'synthetic-correlation', reportId: 'synthetic-report' }; },
    persistSection: async (o, lookup, part, value, error, facts, correlation, raw, method) => {
      assert.equal(o, org); assert.equal(lookup.requestId, 'request'); assert.equal(part, 'kys');
      assert.deepEqual(facts, []); assert.equal(raw, undefined); methods.push(method ?? 'PROVIDER'); calls.push('persist');
      return 'snapshot-' + methods.length;
    },
  };
  return { ports, calls, methods, providerCalls: () => providerCalls, held: () => held };
}

test('KYS explicit composition uses the original cache engine and reuses a complete result without a second provider order', async () => {
  const f = fixture(), run = createXrayKysLookup(f.ports);
  const first = await run(org, request), second = await run(org, request, 'COMPANY');
  assert.equal(first.section, report); assert.equal(second.section, report);
  assert.notEqual(first.snapshotId, second.snapshotId);
  assert.equal(f.providerCalls(), 1); assert.deepEqual(f.methods, ['PROVIDER', 'CACHE']);
  assert.deepEqual(f.calls.slice(0, 6), ['registration', 'private-retention', 'cache-retention', 'lookup', 'provider', 'persist']);
});

test('KYS keeps JDG and company cache selections distinct in the supplied original cache engine', async () => {
  const f = fixture(), run = createXrayKysLookup(f.ports);
  await run(org, request, 'COMPANY'); await run(org, request, 'JDG');
  assert.equal(f.providerCalls(), 2); assert.deepEqual(f.methods, ['PROVIDER', 'PROVIDER']);
});

test('restricted registration prevents cleanup, lookup, provider and personal persistence', async () => {
  for (const status of ['DEREGISTERED', 'LIQUIDATION'] as const) {
    const f = fixture(); f.ports.readSupplierRegistrationStatus = async () => status;
    assert.deepEqual(await createXrayKysLookup(f.ports)(org, request), { section: emptyCard.kys, snapshotId: null });
    assert.deepEqual(f.calls, []);
  }
});

test('accepted but uncertain KYS provider order is held by the original engine and cannot silently repurchase', async () => {
  const f = fixture(); let posts = 0;
  f.ports.fetchVerclyKys = async () => { posts++; return { section: { ...report, status: 'ERROR', data: null },
    errorCode: 'VERCLY_POST_OUTCOME_UNKNOWN', correlationId: null, reportId: null, providerOrderAccepted: true }; };
  const run = createXrayKysLookup(f.ports);
  await run(org, request); assert.equal(f.held(), true);
  await assert.rejects(run(org, request), /wait timed out/); assert.equal(posts, 1);
});

test('KYS captures original callable ports and propagates cancellation through the original cache engine', async () => {
  const f = fixture(), run = createXrayKysLookup(f.ports);
  f.ports.fetchVerclyKys = async () => { throw Error('replacement must not execute'); };
  assert.equal((await run(org, request)).section, report);
  const controller = new AbortController(); controller.abort(Error('synthetic canceled'));
  await assert.rejects(run(org, request, 'COMPANY', controller.signal), /synthetic canceled/);
  assert.equal(f.providerCalls(), 1);
});

test('KYS factory and selection reject incomplete ports, accessors, symbols and altered identity before effects', async () => {
  const f = fixture(), missing = { ...f.ports } as Partial<XrayKysPorts>; delete missing.persistSection;
  const accessor = { ...f.ports }; Object.defineProperty(accessor, 'createLookup', { enumerable: true, get() { throw Error('getter must not execute'); } });
  for (const input of [missing, accessor, Object.create(f.ports), { ...f.ports, [Symbol('extra')]: () => {} }]) {
    assert.throws(() => createXrayKysLookup(input as XrayKysPorts), /Complete explicit KYS ports/);
  }
  const run = createXrayKysLookup(f.ports), changed = { identifier: { type: 'NIP', value: nip }, organisationId: org };
  const getter = Object.defineProperty({}, 'identifier', { enumerable: true, get() { throw Error('selection getter must not execute'); } });
  for (const selected of [changed, getter, { identifier: { type: 'NIP', value: '5213390342' } }, { ...request, [Symbol('extra')]: true }]) {
    await assert.rejects(run(org, selected as XrayLookupRequest));
  }
  await assert.rejects(run('other-org', request));
  assert.deepEqual(f.calls, []);
});
