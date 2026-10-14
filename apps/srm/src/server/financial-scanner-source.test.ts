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
      [doc, { ...doc, recordId: "duplicate", filingDate: "2026-08-01" }],
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
