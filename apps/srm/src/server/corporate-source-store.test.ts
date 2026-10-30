import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import { readCorporatePacket, corporateRevisionKey, unrequestedCorporateGeneral, CORPORATE_PUBLICATION_VERSION, CORPORATE_SOURCE } from './corporate-source-store'
import { mapMgbiFinancialRecords } from './mgbi-financial'
import { decodeMsrOriginal } from './msr-source'
import { parseMsrOriginal } from './msr-parser'
import { projectMsrFinancial } from './msr-financial'
import { mapMgbiGeneralRecord } from './mgbi-general'

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

test('captured corporate data stays detached and immutable across revision and publication preparation',async()=>{
  const input=packet(),captured=readCorporatePacket(input),schema='a'.repeat(64)
  const expected=createHash('sha256').update(JSON.stringify({version:'srm-corporate-revision-v1',
    source:CORPORATE_SOURCE,publicationSchemaDigest:schema,packet:JSON.parse(JSON.stringify(input))})).digest('hex')
  assert.equal(corporateRevisionKey(captured,schema),expected)
  assert.equal(readCorporatePacket(captured),captured)
  const check=(value:unknown):void=>{
    if(value&&typeof value==='object'){
      assert(Object.isFrozen(value))
      for(const child of Object.values(value))check(child)
    }
  }
  check(captured)
  assert.equal(Reflect.set(captured.general.data!,'legalName','changed'),false)
  assert.equal(Reflect.deleteProperty(captured.facts[0],'amount'),false)
  await Promise.resolve()
  input.general.data.legalName='changed after capture'
  assert.equal(captured.general.data!.legalName,'Synthetic Company')
  assert.equal(corporateRevisionKey(captured,schema),expected)
  assert.notEqual(corporateRevisionKey(input,schema),expected)
})

test('a frozen caller value or clone cannot forge a classified packet capture',()=>{
  const captured=readCorporatePacket(packet())
  for(const mutate of [
    (p:any)=>{p.ownerOrganisationId='11111111-1111-4111-8111-111111111111'},
    (p:any)=>{p.facts[0].sourcePath='private.archive'},
    (p:any)=>{p.financial.source.provider='VERCLY'},
  ]){
    const changed=structuredClone(captured);mutate(changed);Object.freeze(changed)
    assert.throws(()=>readCorporatePacket(changed),TypeError)
    assert.throws(()=>corporateRevisionKey(changed,'a'.repeat(64)),TypeError)
  }
})

test('Financial-only publication requires General absence and cannot invent its provenance',()=>{
 const input={...packet(),preserveGeneral:true,general:unrequestedCorporateGeneral()}
 assert.deepEqual(readCorporatePacket(input),input)
 for(const change of [
  (p:typeof input)=>{p.preserveGeneral=false},(p:typeof input)=>{p.general.status='SUCCESS'},
  (p:typeof input)=>{p.general.retrievedAt='2026-10-19T00:00:00.000Z'},
  (p:typeof input)=>{p.general.source.recordId='a'.repeat(24)},(p:typeof input)=>{p.general.warnings=['invented General']},
  (p:typeof input)=>{p.financial.source.provider='VERCLY'},
 ]){const changed=structuredClone(input);change(changed);assert.throws(()=>readCorporatePacket(changed))}
})

test('native Polish KRS dates cross the unchanged classified corporate boundary after provider mapping', () => {
  const input = packet();
  const raw = { id: 'a'.repeat(24), identifiers: { pl_nip: NIP, pl_krs: KRS },
    content: { current_excerpt: { naglowekA: { dataRejestracjiWKRS: '02.05.2001', stanZDnia: '24.04.2026' },
      dane: { dzial1: { danePodmiotu: { nazwa: 'Synthetic Company', formaPrawna: 'SA' },
        siedzibaIAdres: { adresStronyInternetowej: 'WWW.EXAMPLE.PL' } } } } } };
  const mapped = mapMgbiGeneralRecord(raw, input.general.retrievedAt);
  const result = readCorporatePacket({ ...input, general: mapped.section });
  assert.equal(result.general.data!.registeredAt, '2001-05-02');
  assert.equal(result.general.effectiveAt, '2026-04-24');
  assert.equal(result.general.data!.website, 'https://www.example.pl/');
  assert.equal(raw.content.current_excerpt.naglowekA.dataRejestracjiWKRS, '02.05.2001');
  const unnormalized = structuredClone(result);
  unnormalized.general.data!.registeredAt = '02.05.2001';
  assert.throws(() => readCorporatePacket(unnormalized), TypeError);
  unnormalized.general.data!.registeredAt = result.general.data!.registeredAt;
  unnormalized.general.data!.website = 'WWW.EXAMPLE.PL';
  assert.throws(() => readCorporatePacket(unnormalized), TypeError);
});

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

function originalMsrPacket(positioned = false) {
  const recordId = 'c'.repeat(24), retrievedAt = '2026-10-19T00:00:00.000Z'
  const candidate = {recordId, nip: NIP, from: '2025-01-01', to: '2025-12-31', scope: 'standalone' as const,
    filingDate: null, correction: null, documentId: null}
  const cell = (x: string, y: string, text: string) => `<div class="c ${x} ${y}"><div class="t">${text}</div></div>`
  const page = (title: string, id: string, rows: [string,string,string][]) => '<div class="pf" id="'+id+'">'
    + '<div class="t">Jednostkowe sprawozdanie '+title+'</div>' + cell('x1','y1','(w tys. PLN)')
    + cell('x2','y1',(id === 'pnl' ? '12 MIESIĘCY ZAKOŃCZONY ' : '')+'31.12.2025')
    + cell('x3','y1',(id === 'pnl' ? '12 MIESIĘCY ZAKOŃCZONY ' : '')+'31.12.2024')
    + rows.map(([label,a,b],i) => cell('x1','y'+(i+2),label)+cell('x2','y'+(i+2),a)+cell('x3','y'+(i+2),b)).join('')+'</div>'
  const xml = positioned
    ? '<html xmlns="http://www.w3.org/1999/xhtml"><body><p>NIP: '+NIP+'</p>'
      + page('z dochodów całkowitych','pnl',[
        ['Przychody z działalności operacyjnej razem','123','100'],['Koszty działalności operacyjnej razem','(80)','(75)'],
        ['Zysk z działalności operacyjnej','43','25'],['Zysk netto','20','15']])
      + page('z sytuacji finansowej','balance',[['Aktywa razem','200','180'],['Zobowiązania razem','90','100']])+'</body></html>'
    : '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:ix="http://www.xbrl.org/2013/inlineXBRL"'
      + ' xmlns:x="http://www.xbrl.org/2003/instance" xmlns:f="https://xbrl.ifrs.org/taxonomy/2022-03-24/ifrs-full"'
      + ' xmlns:iso="http://www.xbrl.org/2003/iso4217"><body><ix:resources><x:context id="c"><x:entity>'
      + '<x:identifier scheme="urn:synthetic">ISSUER</x:identifier></x:entity><x:period>'
      + '<x:startDate>2025-01-01</x:startDate><x:endDate>2025-12-31</x:endDate></x:period></x:context>'
      + '<x:unit id="u"><x:measure>iso:PLN</x:measure></x:unit></ix:resources>'
      + '<ix:nonFraction name="f:Revenue" contextRef="c" unitRef="u">123</ix:nonFraction></body></html>'
  const original = decodeMsrOriginal(recordId, Buffer.from(xml), 'application/xhtml+xml', retrievedAt)
  const projection = projectMsrFinancial(candidate, original, parseMsrOriginal(original, candidate))
  const p = packet()
  return {...p, financial: {...p.financial, data: projection.data,
    source: {...p.financial.source, recordId}}, facts: projection.facts}
}

test('classification v2 accepts original iXBRL and positioned XHTML facts bound to their actual projected document', () => {
  assert.equal(CORPORATE_SOURCE.classificationVersion, 'srm-corporate-fields-v2')
  for (const positioned of [false, true]) {
    const p = originalMsrPacket(positioned), output = readCorporatePacket(p)
    assert(p.facts.length > 0)
    assert(p.facts.every(f => f.sourcePath.startsWith('c'.repeat(24) + (positioned ? '.XHTML.' : '.iXBRL.'))))
    assert.deepEqual(output, p)
    assert.equal(output.facts[0].amount, positioned ? '123000' : '123')
    assert.notEqual(output.financial.data, p.financial.data)
  }
})

test('original MSR facts refuse foreign documents, false format or basis, unverified values and malformed provenance', () => {
  const mutations: ((p: ReturnType<typeof originalMsrPacket>) => void)[] = [
    p => {p.facts[0].sourcePath = 'd'.repeat(24)+'.iXBRL.fact-0'},
    p => {p.facts[0].sourcePath = 'c'.repeat(24)+'.XHTML.fact-0'},
    p => {p.facts[0].sourcePath = 'c'.repeat(24)+'.PDF.fact-0'},
    p => {p.financial.data.periods[0].documentId = 'd'.repeat(24)+':cfy'},
    p => {p.financial.data.periods[0].accountingStandard = 'POLISH_UOR'},
    p => {p.financial.data.periods[0].isIasCompliant = false},
    p => {p.financial.data.periods[0].accountingStandardBasis = 'UNVERIFIED'},
    p => {p.facts[0].sourcePath = 'content.standardized_fields.revenue'},
    p => {p.facts[0].normalizationRule = 'VERIFIED_COST_MAGNITUDE_V1'},
    p => {p.facts[0].validationStatus = 'REVIEW'},
    p => {p.facts[0].sourceAmount = '124'},
    ...['', 'https://example.invalid/fact', 'fact\n0', 'fact\u0000', 'x'.repeat(1025)]
      .map(suffix => (p: ReturnType<typeof originalMsrPacket>) => {p.facts[0].sourcePath = 'c'.repeat(24)+'.iXBRL.'+suffix}),
  ]
  for (const mutate of mutations) {
    const p = originalMsrPacket(); mutate(p)
    assert.throws(() => readCorporatePacket(p), TypeError)
  }
})


test('an identical accepted corporate revision is independent of private lookup identity but changed evidence has a different key',()=>{
 const original=packet(),schema='a'.repeat(64),key=corporateRevisionKey(original,schema)
 assert.equal(corporateRevisionKey(structuredClone(original),schema),key)
 assert.notEqual(corporateRevisionKey(original,'b'.repeat(64)),key)
 assert.throws(()=>corporateRevisionKey(original,'unverified-schema'))
 for(const change of [
  (p:ReturnType<typeof packet>)=>{p.financial.retrievedAt='2026-10-19T00:01:00.000Z'},
  (p:ReturnType<typeof packet>)=>{p.financial.source.recordId='c'.repeat(24)},
  (p:ReturnType<typeof packet>)=>{p.general.data.krs='0000000001'},
  (p:ReturnType<typeof packet>)=>{p.facts[0].amount='400';p.facts[0].sourceAmount='400';p.financial.data!.periods[0].facts.find(f=>f.metricCode===p.facts[0].metricCode)!.amount='400'},
 ]){const changed=packet();change(changed);assert.notEqual(corporateRevisionKey(changed,schema),key)}
 const privatePacket={...original,organisationId:'11111111-1111-4111-8111-111111111111'}
 assert.throws(()=>corporateRevisionKey(privatePacket,schema))
})
