import assert from 'node:assert/strict';
import test from 'node:test';
import type { FinancialData, GeneralCompanyData } from '@profitia/srm-xray';
import { readCorporateCompanyData, readCorporateFinancialData, projectPublicFinancialData, MAX_CORPORATE_KNOWLEDGE_BYTES } from './corporate-knowledge';
import { mapMgbiFinancialRecords } from './mgbi-financial';
import { fetchMgbiGeneral } from './mgbi-general';
import { calculateFinancialIndicators } from './financial-indicators';
import { toPublicSection } from './xray-lookup';

const NIP = '5272443955', KRS = '0000217580', SNAPSHOT = '40000000-0000-4000-8000-000000000001';
const general: GeneralCompanyData = {legalName: 'Synthetic Company', legalForm: 'SPÓŁKA AKCYJNA', nip: NIP, krs: KRS,
  regon: '123456789', registeredAddress: 'Synthetic address', registeredAt: '2020-01-01', mainPkd: '41.20.Z',
  registrationStatus: 'ACTIVE', deregisteredAt: null, mainPkdDescription: null, website: 'https://company.invalid/'};
const finance: FinancialData = {qualityRule: 'SYNTHETIC_QUALITY', revisionRule: 'FINANCIAL_REVISIONS_V1', registryHistoryVersion: 'KRS_CONTINUITY_V1',
  periods: [{from: '2025-01-01', to: '2025-12-31', scope: 'standalone', documentId: 'corporate-record:cfy',
    effectiveRevisionId: 'corporate-record:cfy', revisionStatus: 'RESOLVED', accountingStandard: 'IAS_IFRS', accountingStandardBasis: 'Synthetic source',
    isIasCompliant: true, xmlSchema: {name: null, version: null}, sourceRegistration: {krs: KRS, legalName: null, relationship: 'CURRENT'},
    facts: [{metricCode: 'BS_A_CA', amount: '0', currency: 'PLN', unit: 'PLN'}],
    comparativeData: {selected: 'RESTATED', dateBasis: 'UNCONFIRMED', original: [{metricCode: 'BS_A_CA', amount: '-0.0000', currency: 'PLN', unit: 'PLN'}],
      restated: [{metricCode: 'BS_A_CA', amount: '12345678901234567890.1234', currency: 'PLN', unit: 'PLN'}]},
    msrRows: [{key: 'ifrs:Revenue', label: 'Revenue', section: 'RZiS', amount: null, currency: null, unit: 'PLN', validation: 'REVIEW', dimensions: ['scope=standalone']}]}],
  indicators: [{code: 'CURRENT_RATIO', periodStart: '2025-01-01', periodEnd: '2025-12-31', scope: 'standalone', status: 'UNAVAILABLE', value: null,
    unit: 'RATIO', importance: 3, reasonCode: 'MISSING_FIELD', formulaVersion: '1.3'}]};
const fail = (action: () => unknown) => assert.throws(action, {name: 'TypeError', message: 'Corporate knowledge unavailable'});

test('corporate classification preserves all declared financial values, zero/missing distinction and current scientific metadata', () => {
  const result = readCorporateFinancialData(finance); assert.deepEqual(result, finance); assert.notEqual(result, finance);
  assert.equal(result!.periods[0].facts[0].amount, '0'); assert.equal(result!.periods[0].msrRows![0].amount, null);
  assert.equal(result!.periods[0].comparativeData!.original[0].amount, '-0.0000');
  assert.equal(result!.periods[0].comparativeData!.restated[0].amount, '12345678901234567890.1234');
  assert.deepEqual(projectPublicFinancialData(finance), finance);
  assert.equal(readCorporateFinancialData(null), null); assert.equal(projectPublicFinancialData(null), null);
  assert.deepEqual(readCorporateFinancialData({periods: []}), {periods: []});
  assert.equal(Object.hasOwn(readCorporateFinancialData({periods: []})!, 'qualityRule'), false);
});

test('current KRS history and only the explicitly selected company survive the corporate boundary', () => {
  const input: GeneralCompanyData = {...general, registryHistory: {version: 'KRS_CONTINUITY_V1', currentKrs: KRS,
    members: [{krs: KRS, legalName: general.legalName, legalForm: general.legalForm, registeredAt: general.registeredAt, deregisteredAt: null, status: 'ACTIVE'}],
    links: [], unlinkedKrs: ['0000000002']}};
  assert.deepEqual(readCorporateCompanyData(input, NIP), input);
  fail(() => readCorporateCompanyData(input, '1111111111'));
  fail(() => readCorporateCompanyData({...input, krs: null}, NIP));
  fail(() => readCorporateCompanyData({...input, registryHistory: {...input.registryHistory!, currentKrs: '0000000002'}}, NIP));
  fail(() => readCorporateCompanyData({...input, website: 'javascript:alert(1)'}, NIP));
  fail(() => readCorporateCompanyData({...input, website: 'https://credential:secret@company.invalid/'}, NIP));
  assert.equal(readCorporateCompanyData(null, NIP), null);
});

test('original MGBI company mapper crosses the closed corporate boundary without copying its raw response', async () => {
  const record = {id: 'a'.repeat(24), identifiers: {pl_nip: NIP, pl_krs: KRS},
    content: {current_excerpt: {naglowekA: {}, dane: {dzial1: {danePodmiotu: {nazwa: 'Synthetic Company', formaPrawna: 'SPÓŁKA AKCYJNA'}}}}}};
  const result = await fetchMgbiGeneral({type: 'NIP', value: NIP}, {apiKey: 'SYNTHETIC_ONLY',
    fetcher: async () => Response.json({count: 1, results: [record]})});
  assert.equal(result.errorCode, null); assert.ok(result.rawResponse);
  assert.deepEqual(readCorporateCompanyData(result.section.data, NIP), result.section.data);
  fail(() => readCorporateCompanyData({...result.section.data, rawResponse: result.rawResponse}, NIP));
});

test('actual financial calculator retains server provenance while public responses keep every declared result field', () => {
  const source = mapMgbiFinancialRecords([{id: 'b'.repeat(24), identifiers: {pl_nip: NIP, pl_krs: KRS},
    document: {type: 'financial_statement', period_from_date: '2025-01-01', period_to_date: '2025-12-31'},
    content: {schema: {name: 'JednostkaInnaWZlotych'}, standardized_fields: {bs: {a_ca_cfy: '300', lae_lapfl_stl_cfy: '200'}}}}],
  {type: 'NIP', value: NIP}, '2026-10-19T00:00:00.000Z');
  assert.equal(source.errorCode, null); assert.ok(source.section.data);
  assert.deepEqual(readCorporateFinancialData(source.section.data), source.section.data);
  const indicators = calculateFinancialIndicators(NIP, source.section.data, source.facts.map(f => ({...f, sourceSnapshotId: SNAPSHOT})));
  const ratio = indicators.find(i => i.code === 'CURRENT_RATIO')!;
  assert.equal(ratio.status, 'AVAILABLE'); assert.equal(ratio.value, '1.500000'); assert.deepEqual(ratio.sourceSnapshotIds, [SNAPSHOT]);
  const data = {...source.section.data, indicators}, original = JSON.stringify(data);
  fail(() => readCorporateFinancialData(data));
  const publicData = projectPublicFinancialData(data)!;
  assert.equal(publicData.indicators!.find(i => i.code === 'CURRENT_RATIO')!.value, '1.500000');
  for (let i = 0; i < indicators.length; i++) {
    const {nip: _nip, inputFacts: _facts, sourceSnapshotIds: _snapshots, sourceDocumentIds: _documents, ...allowed} = indicators[i];
    assert.deepEqual(publicData.indicators![i], allowed);
  }
  assert.equal(JSON.stringify(data), original); assert.notEqual(publicData.periods, data.periods);
  for (const model of ['pl-krs-rdf-record','KRS-RDF']) {
    const publicSection = toPublicSection({...source.section, source: {...source.section.source, model}, data});
    assert.deepEqual(publicSection.data, publicData); assert.equal(Object.hasOwn(publicSection, 'source'), false);
    const text = JSON.stringify(publicSection);
    for (const forbidden of ['sourceSnapshotIds','sourceDocumentIds','inputFacts',SNAPSHOT]) assert.ok(!text.includes(forbidden), forbidden);
    assert.equal(Object.hasOwn(publicSection.data!.indicators![0], 'nip'), false);
  }
});

for (const field of ['rawRecord','rawResponse','people','beneficialOwners','pesel','organisationId','userId','privateSnapshotId']) {
  test('unclassified top-level field is refused as shared knowledge: ' + field, () => {
    fail(() => readCorporateCompanyData({...general, [field]: 'SYNTHETIC_PRIVATE'}, NIP));
    fail(() => readCorporateFinancialData({...finance, [field]: 'SYNTHETIC_PRIVATE'}));
    fail(() => projectPublicFinancialData({...finance, [field]: 'SYNTHETIC_PRIVATE'}));
  });
}

test('unknown nested person/archive/provenance fields cannot hide in declared financial containers', () => {
  for (const p of [
    {...finance.periods[0], sourceSnapshotId: SNAPSHOT},
    {...finance.periods[0], facts: [{...finance.periods[0].facts[0], pesel: 'SYNTHETIC_PRIVATE'}]},
    {...finance.periods[0], sourceRegistration: {...finance.periods[0].sourceRegistration, ownerUserId: 'SYNTHETIC_PRIVATE'}},
    {...finance.periods[0], msrRows: [{...finance.periods[0].msrRows![0], rawNotes: 'SYNTHETIC_PRIVATE'}]},
    {...finance.periods[0], comparativeData: {...finance.periods[0].comparativeData!, original: [{...finance.periods[0].facts[0], rawSource: 'SYNTHETIC_PRIVATE'}]}},
  ]) {
    fail(() => readCorporateFinancialData({...finance, periods: [p]}));
    fail(() => projectPublicFinancialData({...finance, periods: [p]}));
  }
  fail(() => projectPublicFinancialData({...finance, indicators: [{...finance.indicators![0], organisationId: 'SYNTHETIC_PRIVATE'}]}));
});

test('unknown KRS history fields and people are refused without inventing registry relationships', () => {
  fail(() => readCorporateCompanyData({...general, registryHistory: {version: 'KRS_CONTINUITY_V1', currentKrs: KRS,
    members: [{krs: KRS, legalName: null, legalForm: null, registeredAt: null, deregisteredAt: null, status: 'ACTIVE', person: 'SYNTHETIC_PRIVATE'}],
    links: [], unlinkedKrs: []}}, NIP));
  fail(() => readCorporateCompanyData({...general, registryHistory: {version: 'KRS_CONTINUITY_V1', currentKrs: KRS,
    members: [], links: [{predecessorKrs: KRS, successorKrs: '0000000002', basis: 'NAME_MATCH'}], unlinkedKrs: []}}, NIP));
});

test('malformed values are refused rather than normalized into zero, null or a different period', () => {
  for (const value of [NaN, Infinity, undefined, null, 0, '', 'NaN', '1e9']) {
    fail(() => readCorporateFinancialData({...finance, periods: [{...finance.periods[0], facts: [{...finance.periods[0].facts[0], amount: value}]}]}));
  }
  for (const period of [{...finance.periods[0], from: '2025-02-30'}, {...finance.periods[0], to: '2024-01-01'},
    {...finance.periods[0], scope: 'UNKNOWN'}, {...finance.periods[0], isIasCompliant: 'yes'}]) {
    fail(() => readCorporateFinancialData({...finance, periods: [period]}));
  }
  fail(() => readCorporateFinancialData({...finance, indicators: [{...finance.indicators![0], status: 'AVAILABLE', value: null}]}));
  fail(() => readCorporateFinancialData({...finance, indicators: [{...finance.indicators![0], value: '0'}]}));
});

test('accessors, symbols, cyclic values, exotic objects and sparse arrays are never serialized as corporate data', () => {
  let getterCalls = 0;
  const getter = {...finance}; Object.defineProperty(getter, 'periods', {enumerable: true, get() { getterCalls++; return []; }});
  const symbol = {...finance, [Symbol('private')]: 'SYNTHETIC_PRIVATE'};
  const cycle: Record<string, unknown> = {...finance}; cycle.rawResponse = cycle;
  const sparse = Array(1);
  for (const value of [getter, symbol, cycle, Object.create(null), new Date(), {periods: sparse}, {periods: [], callback: () => {}}, {periods: [], value: 1n}]) {
    fail(() => readCorporateFinancialData(value)); fail(() => projectPublicFinancialData(value));
  }
  assert.equal(getterCalls, 0);
});

test('oversized and deeply nested unclassified data fails before projection', () => {
  fail(() => readCorporateFinancialData({periods: [], rawResponse: 'x'.repeat(MAX_CORPORATE_KNOWLEDGE_BYTES + 1)}));
  let nested: unknown = 'SYNTHETIC_PRIVATE'; for (let i = 0; i < 34; i++) nested = {child: nested};
  fail(() => projectPublicFinancialData({periods: [], rawResponse: nested}));
  fail(() => readCorporateFinancialData({periods: Array.from({length: 1025}, () => finance.periods[0])}));
});

test('non-financial sections retain their current declared data; no KYS field permission is invented here', () => {
  const section = {status: 'SUCCESS' as const, source: {provider: 'VERCLY' as const, model: 'KYS_NIP', recordId: 'SYNTHETIC_ONLY'},
    retrievedAt: null, effectiveAt: null, warnings: [], data: {marker: 'SYNTHETIC_ONLY'}};
  assert.deepEqual(toPublicSection(section).data, section.data);
});
