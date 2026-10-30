import assert from "node:assert/strict";
import test from "node:test";
import type {
  FinancialFactEvidence,
  FinancialPeriod,
  SupplierReportData,
} from "@profitia/srm-xray";
import {
  FINANCIAL_DOCUMENT_MAPPING_VERSION,
  type FinancialSourceDocument,
} from "./financial-documents";
import { qualifyScannerSources } from "./financial-scanner-source";
const id = "standalone:2025-01-01:2025-12-31";
test('scanner prepares exact revision groups per invocation and never reuses an earlier qualified verdict',()=>{
 const {f,selected,doc}=fixture();
 const copy={...structuredClone(doc),recordId:'equivalent',filingDate:'2026-07-16',checksum:'b'.repeat(64),correction:true};
 const documents=[doc,copy],first=qualifyScannerSources(f,selected,documents,'2026-10-14');
 assert.ok(first[id].basis.REVENUE);
 copy.rows[0].amounts.KwotaA='99';
 const changed=qualifyScannerSources(f,selected,documents,'2026-10-14');
 assert.equal(changed[id].reason,'SOURCE_REVISION_UNRESOLVED');assert.deepEqual(changed[id].basis,{});
 copy.rows[0].amounts.KwotaA='100';
 assert.deepEqual(qualifyScannerSources(f,selected,documents,'2026-10-14'),first);
});
test("scanner revision families and comparison bases stay separated by filing issuer KRS",()=>{
  const {f,selected,doc}=fixture();doc.sourceKrs="0000000001";
  const other={...structuredClone(doc),recordId:"successor",sourceKrs:"0000000002",checksum:"b".repeat(64)};
  const first=qualifyScannerSources(f,selected,[doc,other],"2026-10-14")[id];
  assert.ok(first.basis.REVENUE);assert.match(first.basis.REVENUE!,/:KRS:0000000001:/);
  const successor=qualifyScannerSources(f,selected,[{...doc,sourceKrs:"0000000002"}],"2026-10-14")[id];
  assert.notEqual(first.basis.REVENUE,successor.basis.REVENUE);
});
function fixture() {
  const values = [
    ["PALA_NRFS", "100", "RZiS.RZiSPor.A"],
    ["PALA_OAC", "80", "RZiS.RZiSPor.B"],
    ["PALA_PLFS", "20", "RZiS.RZiSPor.C"],
    ["PALA_NPL", "10", "RZiS.RZiSPor.L"],
    ["PALA_PLFOA", "15", "RZiS.RZiSPor.F"],
  ];
  const facts = values.map(([metricCode, amount]): FinancialFactEvidence => ({
    metricCode,
    amount,
    sourceAmount: amount,
    ref: metricCode,
    documentRef: "doc",
    periodStart: "2025-01-01",
    periodEnd: "2025-12-31",
    scope: "standalone",
    currency: "PLN",
    unit: "PLN",
    validation: "VERIFIED",
    normalization:
      metricCode === "PALA_OAC" ? "NORMALIZED_CONFIRMED" : "SOURCE_VALUE",
    normalizationRule:
      metricCode === "PALA_OAC" ? "VERIFIED_COST_MAGNITUDE_V1" : "SOURCE_VALUE",
    reasonCode: null,
  }));
  const p = {
    from: "2025-01-01",
    to: "2025-12-31",
    scope: "standalone" as const,
    year: "2025",
    documentRef: "doc",
    facts,
  };
  const selected: FinancialPeriod[] = [{ ...p, documentId: "record:cfy" }];
  const doc: FinancialSourceDocument = {
    recordId: "record",
    documentId: "document",
    scope: "standalone",
    from: p.from,
    to: p.to,
    standard: "POLISH_UOR",
    isIasCompliant: false,
    standardBasis: "MGBI_DOCUMENT_FLAG_AND_POLISH_XML_SCHEMA",
    provider: "MGBI",
    model: "pl-krs-rdf-record",
    format: "XML",
    availability: "XML_SUPPORTED",
    formatBasis: "XML",
    schemaName: "JednostkaInnaWZlotych",
    schemaVersion: "1-0E",
    currency: "PLN",
    scale: "1",
    correction: false,
    filingDate: "2026-07-15",
    checksum: "a".repeat(64),
    mappingVersion: FINANCIAL_DOCUMENT_MAPPING_VERSION,
    validation: "VALID",
    columns: [],
    rows: values.map(([, amount, sourcePath]) => ({
      section: "RZiS",
      sourcePath,
      label: sourcePath,
      depth: 2,
      amounts: { KwotaA: amount },
    })),
  };
  return {
    f: {
      status: "AVAILABLE",
      source: "MGBI",
      freshness: { retrievedAt: "2026-10-14", sourceUpdatedAt: null },
      completeness: "COMPLETE",
      limitations: [],
      sourceVersion: "fixture",
      representationVersion: "fixture",
      periods: [p],
      history: [],
      indicators: [],
      summary: [],
    } as unknown as SupplierReportData["financial"],
    selected,
    doc,
  };
}
test("XML semantic proof links revenue and costs to comparative A/B, not 100 minus margin", () => {
  const { f, selected, doc } = fixture();
  const q = qualifyScannerSources(f, selected, [doc], "2026-10-14")[id];
  assert.match(q.basis.REVENUE!, /SALES_AND_EQUIVALENTS/);
  assert.match(q.basis.OPERATING_COST_RATIO!, /COMPARATIVE_BASIC/);
  assert.equal(q.costs, "80");
  assert.ok(q.evidenceRef);
  doc.rows.find((r) => r.sourcePath.endsWith(".B"))!.amounts.KwotaA = "-80";
  (f.periods[0].facts[1] as FinancialFactEvidence).sourceAmount = "-80";
  assert.equal(
    qualifyScannerSources(f, selected, [doc], "2026-10-14")[id].costs,
    "80",
  );
  doc.rows.find((r) => r.sourcePath.endsWith(".C"))!.amounts.KwotaA = "30";
  assert.equal(
    qualifyScannerSources(f, selected, [doc], "2026-10-14")[id].costs,
    null,
  );
});
test("unknown standards, corrections, future filings, duplicate revisions and value mismatches fail closed", () => {
  for (const patch of [
    { standard: "UNKNOWN" },
    { correction: true },
    { correction: null },
    { filingDate: "2027-01-01" },
    { scale: "1000" },
    { mappingVersion: "old" },
  ]) {
    const { f, selected, doc } = fixture();
    Object.assign(doc, patch);
    assert.ok(
      qualifyScannerSources(f, selected, [doc], "2026-10-14")[id].reason,
    );
  }
  const { f, selected, doc } = fixture();
  assert.equal(
    qualifyScannerSources(
      f,
      selected,
      [doc, { ...doc, recordId: "duplicate", filingDate: "2026-08-01", rows: doc.rows.slice(1) }],
      "2026-10-14",
    )[id].reason,
    "SOURCE_REVISION_UNRESOLVED",
  );
  doc.rows[0].amounts.KwotaA = "101";
  const q = qualifyScannerSources(f, selected, [doc], "2026-10-14")[id];
  assert.equal(q.basis.REVENUE, undefined);
  assert.equal(q.basis.OPERATING_MARGIN, undefined);
  assert.equal(q.costs, null);
});
test("scope and comparative-date mismatch are not silently repaired", () => {
  const { f, selected, doc } = fixture();
  doc.scope = "consolidated";
  assert.equal(
    qualifyScannerSources(f, selected, [doc], "2026-10-14")[id].reason,
    "SOURCE_DOCUMENT_UNAVAILABLE",
  );
  doc.scope = "standalone";
  selected[0].documentId = "record:pfy";
  assert.equal(
    qualifyScannerSources(f, selected, [doc], "2026-10-14")[id].reason,
    "SOURCE_PERIOD_UNCONFIRMED",
  );
});

function kalkFixture() {
  const x = fixture();
  const paths: Record<string, string> = { A: "A", B: "B", C: "C", L: "O", F: "I" };
  for (const row of x.doc.rows) row.sourcePath = `RZiS.RZiSKalk.${paths[row.sourcePath.split('.').at(-1)!]}`;
  for (const [letter, value] of [["D", "3"], ["E", "2"], ["F", "15"]])
    x.doc.rows.push({ section: "RZiS", sourcePath: `RZiS.RZiSKalk.${letter}`, label: letter, depth: 2, amounts: { KwotaA: value } });
  for (const [metricCode, value, sourcePath] of [
    ["BS_A_TA", "100", "Bilans.Aktywa"],
    ["BS_LAE_LAPFL", "30", "Bilans.Pasywa.Pasywa_B"],
    ["BS_A_CA", "50", "Bilans.Aktywa.Aktywa_B"],
    ["BS_LAE_LAPFL_STL", "20", "Bilans.Pasywa.Pasywa_B.Pasywa_B_III"],
  ]) {
    x.f.periods[0].facts = [...x.f.periods[0].facts, { ...x.f.periods[0].facts[0], metricCode, amount: value, sourceAmount: value }];
    x.doc.rows.push({ section: "Bilans", sourcePath, label: metricCode, depth: 2, amounts: { KwotaA: value } });
  }
  return x;
}
function qualified(x: ReturnType<typeof fixture>) { return qualifyScannerSources(x.f, x.selected, [x.doc], "2026-10-14")[id]; }
function setXml(x: ReturnType<typeof fixture>, letter: string, value: string | null) {
  x.doc.rows.find(r => r.sourcePath === `RZiS.RZiSKalk.${letter}`)!.amounts.KwotaA = value;
}

test("calculation variant validates O, A and I; costs use B+D+E from the same column, not catalog OAC or 100-margin", () => {
  const x = kalkFixture(), q = qualified(x);
  assert.equal(q.reason, null);
  assert.equal(Object.keys(q.basis).length, 6);
  assert.match(q.basis.REVENUE!, /:SALES_ONLY$/);
  assert.match(q.basis.OPERATING_MARGIN!, /:OPERATING_RESULT:SALES_ONLY$/);
  assert.match(q.basis.OPERATING_COST_RATIO!, /:CALCULATION_BASIC_OPERATING_COSTS:SALES_ONLY$/);
  assert.equal(q.costs, "85.000000");
  // A catalog cost normalization review must not alter the directly mapped positive XML amounts.
  x.f.periods[0].facts[1].validation = "UNVERIFIED";
  x.f.periods[0].facts[1].amount = "999";
  setXml(x, "C", "20.03");
  assert.equal(qualified(x).costs, "85.000000");
});

test("each calculation cost component is required; missing, malformed and duplicate are not zero", () => {
  for (const letter of ["B", "D", "E"]) {
    for (const missing of [null, "", "NaN"]) {
      const x = kalkFixture(); setXml(x, letter, missing);
      assert.equal(qualified(x).costs, null, `${letter}:${missing}`);
      assert.ok(qualified(x).basis.NET_RESULT);
      assert.ok(qualified(x).basis.LIABILITIES_TO_ASSETS);
    }
    const x = kalkFixture();
    x.doc.rows.push(structuredClone(x.doc.rows.find(r => r.sourcePath === `RZiS.RZiSKalk.${letter}`)!));
    assert.equal(qualified(x).costs, null);
  }
  const x = kalkFixture(); setXml(x, "D", "0"); setXml(x, "E", "0");
  assert.equal(qualified(x).costs, "80.000000");
});

test("negative cost presentation requires both exact subtotal identities; mixed/reversed signs fail closed", () => {
  const x = kalkFixture();
  for (const letter of ["B", "D", "E"]) {
    const row = x.doc.rows.find(r => r.sourcePath === `RZiS.RZiSKalk.${letter}`)!;
    row.amounts.KwotaA = `-${row.amounts.KwotaA}`;
  }
  assert.equal(qualified(x).costs, "85.000000");
  setXml(x, "C", "20.03"); assert.equal(qualified(x).costs, null);
  setXml(x, "C", "20"); setXml(x, "F", "16"); assert.equal(qualified(x).costs, null);
  setXml(x, "F", "15"); setXml(x, "D", "3"); assert.equal(qualified(x).costs, null);
});

test("balance axes survive absent, unsupported or ambiguous P&L, but not invalid balance sources", () => {
  for (const mode of ["absent", "mixed", "unsupported"]) {
    const x = kalkFixture();
    if (mode === "absent") x.doc.rows = x.doc.rows.filter(r => r.section !== "RZiS");
    if (mode === "mixed") x.doc.rows.push(fixture().doc.rows[0]);
    if (mode === "unsupported") for (const r of x.doc.rows) r.sourcePath = r.sourcePath.replace("RZiSKalk", "RZiSOther");
    const q = qualified(x);
    assert.ok(q.basis.CURRENT_RATIO); assert.ok(q.basis.LIABILITIES_TO_ASSETS);
    assert.equal(q.basis.NET_RESULT, undefined); assert.equal(q.costs, null);
    x.doc.rows.find(r => r.sourcePath === "Bilans.Aktywa")!.amounts.KwotaA = "101";
    assert.equal(qualified(x).basis.LIABILITIES_TO_ASSETS, undefined);
  }
});

test("calculation mapping keeps standards, revisions, source amount equality and column guards", () => {
  for (const patch of [{ standard: "IAS_IFRS" }, { standard: "UNKNOWN" }, { correction: true }, { correction: null },
    { scale: "1000" }, { currency: "EUR" }, { validation: "REVIEW" }, { checksum: "invalid" }, { mappingVersion: "old" }]) {
    const x = kalkFixture(); Object.assign(x.doc, patch);
    assert.ok(qualified(x).reason); assert.equal(qualified(x).costs, null);
  }
  for (const [letter, axis] of [["A", "REVENUE"], ["I", "OPERATING_MARGIN"], ["O", "NET_RESULT"]] as const) {
    const x = kalkFixture(); setXml(x, letter, "987");
    assert.equal(qualified(x).basis[axis], undefined);
  }
  const x = kalkFixture();
  for (const r of x.doc.rows) { r.amounts.KwotaB = r.amounts.KwotaA; r.amounts.KwotaA = "999"; }
  const p = x.f.periods[0]; p.from = "2024-01-01"; p.to = "2024-12-31"; p.year = "2024";
  for (const f of p.facts) { f.periodStart = p.from; f.periodEnd = p.to; }
  x.selected = [{ ...p, documentId: "record:pfy" }];
  assert.equal(qualifyScannerSources(x.f, x.selected, [x.doc], "2026-10-14")["standalone:2024-01-01:2024-12-31"].costs, "85.000000");
});


test("facts from a different period, scope or document cannot qualify an XML axis", () => {
  for (const patch of [{ periodStart: "2024-01-01" }, { periodEnd: "2024-12-31" }, { scope: "consolidated" }, { documentRef: "another" }]) {
    const x = kalkFixture(); Object.assign(x.f.periods[0].facts[0], patch);
    assert.equal(qualified(x).basis.REVENUE, undefined);
    assert.equal(qualified(x).costs, null);
  }
});

test("consolidated calculation net result is W, never O even when O happens to equal the catalog amount", () => {
  const x = kalkFixture(), p = x.f.periods[0];
  p.scope = "consolidated";
  for (const f of p.facts) f.scope = "consolidated";
  x.selected[0].scope = "consolidated"; x.doc.scope = "consolidated";
  x.doc.schemaName = "SkonsolidowanaJednostkaInnaWZlotych";
  const get = () => qualifyScannerSources(x.f, x.selected, [x.doc], "2026-10-14")["consolidated:2025-01-01:2025-12-31"];
  assert.equal(get().basis.NET_RESULT, undefined);
  assert.equal(get().costs, "85.000000");
  x.doc.rows.push({ section: "RZiS", sourcePath: "RZiS.RZiSKalk.W", label: "Net", depth: 2, amounts: { KwotaA: "10" } });
  assert.match(get().basis.NET_RESULT!, /NET_RESULT$/);
  for (const version of ["1-0", "1-1", "1-0E", "1-2", "1-3"]) {
    x.doc.schemaVersion = version; assert.ok(get().basis.NET_RESULT);
  }
  x.doc.schemaVersion = "unknown"; assert.equal(get().basis.NET_RESULT, undefined);
  assert.ok(get().basis.LIABILITIES_TO_ASSETS);
});
