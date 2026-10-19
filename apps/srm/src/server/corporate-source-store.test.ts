import test from 'node:test'
import assert from 'node:assert/strict'
import { readCorporatePacket, CORPORATE_PUBLICATION_VERSION } from './corporate-source-store'
import { mapMgbiFinancialRecords } from './mgbi-financial'

const NIP = '5272443955', KRS = '0000217580'
const packet = () => {
  const source = mapMgbiFinancialRecords([{id: 'b'.repeat(24), identifiers: {pl_nip: NIP, pl_krs: KRS},
    document: {type: 'financial_statement', period_from_date: '2025-01-01', period_to_date: '2025-12-31'},
    content: {schema: {name: 'JednostkaInnaWZlotych'}, standardized_fields: {bs: {a_ca_cfy: '300', lae_lapfl_stl_cfy: '200'}}}}],
  {type: 'NIP', value: NIP}, '2026-10-19T00:00:00.000Z')
  return {version: CORPORATE_PUBLICATION_VERSION, nip: NIP, preserveGeneral: false,
    general: {status: 'SUCCESS', source: {provider: 'MGBI', model: 'pl-krs-wp-record', recordId: 'a'.repeat(24)},
      data: {nip: NIP, krs: KRS, legalName: 'Synthetic Company', legalForm: 'SA', regon: null, registeredAddress: null, registeredAt: null, mainPkd: null},
      retrievedAt: '2026-10-19T00:00:00.000Z', effectiveAt: null, warnings: []},
    financial: {...source.section, source: {provider: 'MGBI', model: 'pl-krs-rdf-record', recordId: 'b'.repeat(24)}}, facts: source.facts}
}

test('closed SOURCE packet preserves original financial mapping and detached data', () => {
  const input = packet(), result = readCorporatePacket(input)
  assert.deepEqual(result, input); assert.notEqual(result, input)
  assert.equal(result.facts.find(f => f.metricCode === 'BS_A_CA')!.amount, '300')
  input.general.data.legalName = 'changed'; assert.equal(result.general.data!.legalName, 'Synthetic Company')
})

test('source packet rejects private owner IDs, archive containers, people, unknown fields and caller proof IDs', () => {
  for (const change of [
    (p: any) => {p.ownerOrganisationId = '11111111-1111-4111-8111-111111111111'},
    (p: any) => {p.general.rawResponse = {people: []}}, (p: any) => {p.general.data.people = []}, (p: any) => {p.general.data = null},
    (p: any) => {p.facts[0].sourceSnapshotId = '11111111-1111-4111-8111-111111111111'},
    (p: any) => {p.general.data.nip = '5260250274'}, (p: any) => {p.general.data.krs = null},
    (p: any) => {p.financial.source.provider = 'VERCLY'}, (p: any) => {p.financial.data.periods[0].facts[0].customerId = 'private'},
    (p: any) => {p.facts[0].amount = '12345'}, (p: any) => {p.facts[0].normalizationRule = 'UNVERIFIED'},
    (p: any) => {p.facts[0].sourcePath = 'private.archive'}, (p: any) => {p.facts[0].periodStart = '2025-02-30'},
  ]) { const p = packet(); change(p); assert.throws(() => readCorporatePacket(p), TypeError) }
})

test('packet serialization refuses accessors, symbols, cycles, sparse arrays and unbounded strings without executing getters', () => {
  let executed = false
  const p = packet(); Object.defineProperty(p, 'nip', {get() {executed = true; return NIP}, enumerable: true})
  assert.throws(() => readCorporatePacket(p)); assert.equal(executed, false)
  for (const change of [(p: any) => {p[Symbol('hidden')] = 'private'}, (p: any) => {p.facts[0].sourcePath = 'x'.repeat(4097)},
    (p: any) => {p.financial.warnings = new Array(3)}, (p: any) => {p.general.data = p}]) {
    const input = packet(); change(input); assert.throws(() => readCorporatePacket(input))
  }
})
