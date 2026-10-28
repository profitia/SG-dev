import assert from 'node:assert/strict';
import test from 'node:test';
import { FINANCIAL_QUALITY_RULE } from '@profitia/srm-xray';
import { OperationDenied } from '@profitia/platform-contracts/operation-context';
import { createXrayCompanyLookup, type XrayCompanyPorts } from './xray-lookup';
import { fetchMgbiGeneral } from './mgbi-general';
import { fetchMgbiFinancial } from './mgbi-financial';
import { calculateFinancialIndicators, type CatalogIndicatorFact } from './financial-indicators';
import { COMPANY_IDENTITY_VERSION } from './company-continuity';
import { providerExceptionCode, LookupStageError } from './lookup-diagnostics';
import type { SharedCompany } from './shared-catalog';

const ORG = '10000000-0000-4000-8000-000000000001', NIP = '5272443955';
const lookup = { supplierId: '20000000-0000-4000-8000-000000000001', requestId: '30000000-0000-4000-8000-000000000001' };
const GENERAL_SNAPSHOT = '40000000-0000-4000-8000-000000000001', FINANCIAL_SNAPSHOT = '40000000-0000-4000-8000-000000000002';
const request = () => ({ identifier: { type: 'NIP' as const, value: NIP } });

/** The acquisition functions are the original clients/parsers. Persistence
 * effects here are explicit spies, not a claim of native SQL/HTTP adoption. */
async function fixture() {
  const calls: string[] = [], archived: unknown[][] = [], snapshots: unknown[][] = [], published: Parameters<XrayCompanyPorts['saveSharedCompany']>[2][] = [];
  const wp = { id: 'a'.repeat(24), identifiers: { pl_nip: NIP, pl_krs: '0000217580' },
    content: { current_excerpt: { naglowekA: {}, dane: { dzial1: { danePodmiotu: { nazwa: 'Synthetic Company', formaPrawna: 'SPÓŁKA AKCYJNA' } } } } } };
  const rdf = { id: 'b'.repeat(24), identifiers: { pl_nip: NIP, pl_krs: '0000217580' },
    document: { type: 'financial_statement', period_from_date: '2025-01-01', period_to_date: '2025-12-31' },
    content: { schema: { name: 'JednostkaInnaWZlotych' }, standardized_fields: { bs: { a_ca_cfy: '300', lae_lapfl_stl_cfy: '200' } } } };
  const fetcher: typeof fetch = async input => {
    const url = new URL(String(input));
    assert.equal(url.origin, 'https://api.mgbi.pl'); assert.equal(url.searchParams.get('identifiers.pl_nip'), NIP);
    return Response.json({count: 1, results: [url.pathname.includes('wp-record') ? wp : rdf]});
  };
  const general = await fetchMgbiGeneral(request().identifier, {apiKey: 'SYNTHETIC_ONLY', fetcher});
  const financial = await fetchMgbiFinancial(request().identifier, {apiKey: 'SYNTHETIC_ONLY', fetcher});
  assert.equal(general.errorCode, null); assert.equal(general.section.data?.nip, NIP);
  assert.equal(financial.errorCode, null); assert.ok(financial.facts.length > 0);
  let cached: SharedCompany | null = null;
  const ports: XrayCompanyPorts = {
    createLookup: async (org, identifier) => { calls.push('register'); assert.equal(org, ORG); assert.deepEqual(identifier, request().identifier); return lookup; },
    readFreshCompany: async () => { calls.push('cache'); return cached; },
    readCompanyRegistration: async () => { calls.push('registration'); return {status: 'ACTIVE', deregisteredAt: null}; },
    enrichCompanyPkd: async (_org, _nip, section) => { calls.push('pkd'); return section.data; },
    fetchMgbiGeneral: async (...args) => { calls.push('fetch-general'); return fetchMgbiGeneral(args[0], {apiKey: 'SYNTHETIC_ONLY', fetcher}); },
    fetchMgbiFinancial: async (...args) => { calls.push('fetch-financial'); return fetchMgbiFinancial(args[0], {...args[1], apiKey: 'SYNTHETIC_ONLY', fetcher}); },
    saveMgbiArchive: async (...args) => { calls.push('archive-' + args[2]); archived.push(args); },
    saveFinancialDocuments: async () => { calls.push('documents-save'); return {documents: 1, positions: 0}; },
    readFinancialDocuments: async () => { calls.push('documents-read'); return []; },
    reprojectFinancialArchive: async () => { calls.push('reproject'); return null; },
    enrichMsrFinancial: async (_org, _nip, base) => { calls.push('msr'); return {...base, msrChanged: false}; },
    persistSection: async (...args) => { calls.push('persist-' + args[2]); snapshots.push(args); return args[2] === 'general' ? GENERAL_SNAPSHOT : FINANCIAL_SNAPSHOT; },
    saveSharedCompany: async (_org, _nip, value) => { calls.push('publish'); published.push(value); },
    refreshFinancialIndicators: async (_org, nip, data) => {
      calls.push('indicators');
      const facts: CatalogIndicatorFact[] = financial.facts.map(f => ({...f, sourceSnapshotId: FINANCIAL_SNAPSHOT}));
      return calculateFinancialIndicators(nip, data, facts);
    },
    recordInterest: async (org, nip) => { calls.push('interest'); assert.equal(org, ORG); assert.equal(nip, NIP); },
    recoverProviderException: providerExceptionCode,
  };
  return {ports, calls, archived, snapshots, published, general, financial, setCache(value: SharedCompany | null) { cached = value; }};
}

test('one company workflow preserves original provider mapping, private archive order, snapshot lineage and calculated indicators', async () => {
  const f = await fixture(), report = await createXrayCompanyLookup(f.ports)(ORG, request());
  assert.equal(report.general.data?.legalName, 'Synthetic Company'); assert.equal(report.identity.nip, NIP);
  assert.equal(report.kys.status, 'NOT_REQUESTED');
  assert.deepEqual(f.calls, ['register','cache','fetch-general','fetch-financial','archive-pl-krs-wp-record','archive-pl-krs-rdf-record',
    'documents-save','msr','documents-read','persist-general','persist-financial','publish','indicators','interest']);
  assert.equal(f.archived.length, 2); assert.ok(f.archived.every(a => a[0] === ORG && a[1] === NIP && a[6] === lookup.requestId));
  assert.equal(f.published[0].generalSnapshotId, GENERAL_SNAPSHOT); assert.equal(f.published[0].financialSnapshotId, FINANCIAL_SNAPSHOT);
  assert.equal(f.snapshots[0][2], 'general'); assert.equal(f.snapshots[0][7], undefined);
  assert.equal(f.snapshots[1][2], 'financial'); assert.ok(f.published[0].facts.length > 0);
  const ratio = report.financial.data?.indicators?.find(i => i.code === 'CURRENT_RATIO');
  assert.equal(ratio?.status, 'AVAILABLE'); assert.equal(ratio?.value, '1.500000');
});

test('complete current cache avoids provider calls and keeps exact original stored-data/MSR behavior', async () => {
  const f = await fixture();
  const financial = structuredClone(f.financial.section);
  assert.ok(financial.data);
  financial.data.revisionRule = 'FINANCIAL_REVISIONS_V1'; financial.data.qualityRule = FINANCIAL_QUALITY_RULE;
  financial.data.registryHistoryVersion = COMPANY_IDENTITY_VERSION;
  f.setCache({general: f.general.section, financial});
  const result = await createXrayCompanyLookup(f.ports)(ORG, request());
  assert.equal(result.identity.nip, NIP);
  assert.ok(f.calls.includes('pkd')); assert.ok(f.calls.includes('msr')); assert.ok(f.calls.includes('indicators'));
  for (const c of ['fetch-general','fetch-financial','reproject','archive-pl-krs-wp-record','archive-pl-krs-rdf-record','publish']) assert.ok(!f.calls.includes(c), c);
  assert.deepEqual(f.snapshots.map(x=>x[2]),['general','financial']);
  assert(f.snapshots.every(x=>x[8]==='CACHE'));
  assert.equal(f.calls.at(-1), 'interest');
});

test('cached general reprojection and stale financial quality preserve separate provenance and metadata refresh', async () => {
  const f = await fixture(); f.setCache({general: f.general.section, financial: f.financial.section, generalReprojected: true});
  f.ports.reprojectFinancialArchive = async () => { f.calls.push('reproject'); return f.financial; };
  f.ports.enrichMsrFinancial = async (_org, _nip, base, options) => {
    f.calls.push('msr'); assert.equal(options?.requestId, lookup.requestId); assert.ok(options?.allowedKrs?.includes('0000217580'));
    await options?.refreshMetadata?.(); return {...base, msrChanged: true};
  };
  await createXrayCompanyLookup(f.ports)(ORG, request());
  assert.ok(f.calls.indexOf('persist-general') < f.calls.indexOf('msr'));
  assert.ok(f.calls.includes('reproject')); assert.ok(f.calls.includes('fetch-financial'));
  assert.equal(f.published.length, 2); assert.equal(f.published[0].generalSnapshotId, GENERAL_SNAPSHOT);
  assert.equal(f.published[1].preserveGeneral, true); assert.equal(f.published[1].generalSnapshotId, null);
  assert.equal(f.published[1].financialSnapshotId, FINANCIAL_SNAPSHOT); assert.equal(f.calls.at(-1), 'interest');
});

test('cached deregistered company does not acquire financial data, run MSR or record an interest', async () => {
  const f = await fixture(), general = structuredClone(f.general.section); assert.ok(general.data);
  general.data.registrationStatus = 'DEREGISTERED';
  f.setCache({general, financial: f.financial.section});
  const result = await createXrayCompanyLookup(f.ports)(ORG, request());
  assert.equal(result.financial.status, 'NOT_REQUESTED'); assert.equal(result.kys.status, 'NOT_REQUESTED');
  assert.deepEqual(f.calls, ['register','cache','pkd','persist-general']);
  assert.equal(f.snapshots.length,1);assert.equal(f.snapshots[0][2],'general');
});

test('new restricted company preserves general archive and snapshot but suppresses financial acquisition', async () => {
  const f = await fixture(), general = structuredClone(f.general); assert.ok(general.section.data);
  general.section.data.registrationStatus = 'DEREGISTERED';
  f.ports.fetchMgbiGeneral = async () => { f.calls.push('fetch-general'); return general; };
  const result = await createXrayCompanyLookup(f.ports)(ORG, request());
  assert.equal(result.financial.status, 'NOT_REQUESTED');
  for (const c of ['fetch-financial','archive-pl-krs-rdf-record','msr','documents-read','persist-financial','indicators']) assert.ok(!f.calls.includes(c), c);
  assert.ok(f.calls.includes('archive-pl-krs-wp-record')); assert.ok(f.calls.includes('persist-general'));
  assert.equal(f.published[0].financialSnapshotId, null);
});

test('ambiguous identity stops before financial acquisition, private persistence and global publication', async () => {
  const f = await fixture();
  f.ports.fetchMgbiGeneral = async () => ({...f.general, errorCode: 'COMPANY_IDENTITY_AMBIGUOUS'});
  await assert.rejects(createXrayCompanyLookup(f.ports)(ORG, request()), /MGBI_COMPANY_IDENTITY_AMBIGUOUS/);
  assert.deepEqual(f.calls, ['register','cache']);
});

test('native access failure is not silently converted into a recoverable provider result', async () => {
  const f = await fixture(), denied = new OperationDenied('PERMISSION_DENIED');
  f.ports.fetchMgbiGeneral = async () => { f.calls.push('denied'); throw denied; };
  f.ports.recoverProviderException = error => { throw error; };
  await assert.rejects(createXrayCompanyLookup(f.ports)(ORG, request()), error => error === denied);
  assert.deepEqual(f.calls, ['register','cache','denied']);
});

test('financial native failure stops before archives or private writes; legacy recovery remains explicit', async () => {
  const f = await fixture(), denied = new OperationDenied('ACCESS_BASIS_INVALID');
  f.ports.fetchMgbiFinancial = async () => { throw denied; };
  f.ports.recoverProviderException = error => { throw error; };
  await assert.rejects(createXrayCompanyLookup(f.ports)(ORG, request()), error => error === denied);
  assert.deepEqual(f.calls, ['register','cache','fetch-general']);
  f.ports.recoverProviderException = providerExceptionCode;
  const result = await createXrayCompanyLookup(f.ports)(ORG, request());
  assert.equal(result.financial.status, 'ERROR'); assert.ok(f.calls.includes('persist-general'));
});

test('private persistence failure prevents publication and selection, preserving the original failure', async () => {
  const f = await fixture(), failure = new Error('synthetic write failed');
  f.ports.persistSection = async () => { f.calls.push('failed-write'); throw failure; };
  await assert.rejects(createXrayCompanyLookup(f.ports)(ORG, request()), error => error === failure);
  assert.ok(!f.calls.includes('publish')); assert.ok(!f.calls.includes('interest')); assert.ok(!f.calls.includes('indicators'));
});

test('archive failure stops before MSR, snapshots or publication without a retry', async () => {
  const f = await fixture();
  f.ports.saveMgbiArchive = async () => { f.calls.push('archive-failed'); throw new Error('synthetic archive failure'); };
  await assert.rejects(createXrayCompanyLookup(f.ports)(ORG, request()), error => error instanceof LookupStageError && error.stage === 'source_archive');
  assert.ok(!f.calls.includes('msr')); assert.equal(f.snapshots.length, 0); assert.equal(f.published.length, 0);
});

test('ports must be complete data properties and are captured independently of later caller mutations', async () => {
  const f = await fixture();
  const partial: Partial<XrayCompanyPorts> = {...f.ports}; delete partial.recordInterest;
  assert.throws(() => createXrayCompanyLookup(partial as XrayCompanyPorts), /Complete explicit/);
  assert.throws(() => createXrayCompanyLookup({...f.ports, unknown: () => {}} as XrayCompanyPorts), /Complete explicit/);
  const getter = {...f.ports}; Object.defineProperty(getter, 'createLookup', {enumerable: true, get() { throw new Error('getter must not execute'); }});
  assert.throws(() => createXrayCompanyLookup(getter), /Complete explicit/);
  const hidden = {...f.ports}; Object.defineProperty(hidden, Symbol('hidden'), {value: () => {}});
  assert.throws(() => createXrayCompanyLookup(hidden), /Complete explicit/);
  const run = createXrayCompanyLookup(f.ports);
  f.ports.fetchMgbiGeneral = async () => { throw new Error('replaced port must not execute'); };
  const result = await run(ORG, request()); assert.equal(result.identity.nip, NIP);
});

test('selection is copied before asynchronous work and rejects invalid scope before any port', async () => {
  const f = await fixture(), input = request();
  f.ports.createLookup = async (_org, identifier) => {
    f.calls.push('register'); assert.equal(Object.isFrozen(identifier), true); input.identifier.value = '1111111111'; return lookup;
  };
  const run = createXrayCompanyLookup(f.ports);
  await assert.rejects(run('demo', request()), /Explicit company selection/);
  await assert.rejects(run(ORG, {identifier: {type: 'KRS', value: NIP}} as never), /Explicit company selection/);
  await assert.rejects(run(ORG, {identifier: {type: 'NIP', value: '5272443956'}}), /kontrolna/);
  assert.deepEqual(f.calls, []);
  assert.equal((await run(ORG, input)).identity.nip, NIP);
});

test('opted-in READY upgrade prepares a current retained report without provider enrichment or private snapshot copies',async()=>{
 const f=await fixture(),financial=structuredClone(f.financial.section);
 financial.data!.revisionRule='FINANCIAL_REVISIONS_V1';financial.data!.qualityRule=FINANCIAL_QUALITY_RULE;
 financial.data!.registryHistoryVersion=COMPANY_IDENTITY_VERSION;
 f.setCache({general:f.general.section,financial});
 f.ports.prepareReadyReport=async(org,nip,value)=>{f.calls.push('prepare-ready');assert.equal(org,ORG);assert.equal(nip,NIP);
  assert.equal(value.financial,financial);assert.equal(value.preserveGeneral,true);assert.deepEqual(value.facts,[]);
  assert.equal(value.generalSnapshotId,null);assert.equal(value.financialSnapshotId,null)};
 const result=await createXrayCompanyLookup(f.ports)(ORG,request());
 assert.equal(result.identity.nip,NIP);assert.equal(result.financial,financial);
 assert.deepEqual(f.calls,['register','cache','documents-read','prepare-ready']);assert.equal(f.snapshots.length,0);
})
