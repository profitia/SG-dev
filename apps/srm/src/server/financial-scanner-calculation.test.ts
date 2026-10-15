import assert from "node:assert/strict";
import test from "node:test";
import { mapMgbiFinancialRecords } from "./mgbi-financial";
import { projectFinancialDocuments } from "./financial-documents";
import { calculateFinancialIndicators } from "./financial-indicators";
import { projectReportData, type ReportReadRow } from "./report-data";
import { FINANCIAL_MAPPING_VERSION } from "./shared-catalog";
import { previousAnnualPeriod } from "@profitia/srm-xray";

const nip = "1111111111", at = "2026-10-15T10:00:00Z";
// Synthetic provider-shaped data exercise the actual ingestion -> catalog -> report pipeline.
function fixture() {
  const rows: Record<string, [string, string]> = {
    "RZiS.RZiSKalk.A": ["200", "100"], "RZiS.RZiSKalk.B": ["100", "60"],
    "RZiS.RZiSKalk.C": ["100", "40"], "RZiS.RZiSKalk.D": ["20", "10"],
    "RZiS.RZiSKalk.E": ["10", "10"], "RZiS.RZiSKalk.F": ["70", "20"],
    "RZiS.RZiSKalk.I": ["60", "15"], "RZiS.RZiSKalk.O": ["40", "10"],
    "Bilans.Aktywa": ["300", "200"], "Bilans.Pasywa.Pasywa_B": ["60", "80"],
    "Bilans.Aktywa.Aktywa_B": ["200", "100"], "Bilans.Pasywa.Pasywa_B.Pasywa_B_III": ["50", "40"],
  };
  const standardized: Record<string, Record<string, string>> = { pala: {}, bs: {} };
  for (const [key, path] of Object.entries({ nrfs: "A", plfs: "F", plfoa: "I", npl: "O" })) {
    standardized.pala[`${key}_cfy`] = rows[`RZiS.RZiSKalk.${path}`][0];
    standardized.pala[`${key}_pfy`] = rows[`RZiS.RZiSKalk.${path}`][1];
  }
  for (const [key, path] of Object.entries({ a_ta: "Bilans.Aktywa", lae_lapfl: "Bilans.Pasywa.Pasywa_B", a_ca: "Bilans.Aktywa.Aktywa_B", lae_lapfl_stl: "Bilans.Pasywa.Pasywa_B.Pasywa_B_III" })) {
    standardized.bs[`${key}_cfy`] = rows[path][0]; standardized.bs[`${key}_pfy`] = rows[path][1];
  }
  const record = { id: "synthetic-kalk", identifiers: { pl_nip: nip }, document: {
    type: "financial_statement", period_from_date: "2025-01-01", period_to_date: "2025-12-31",
    is_ias_compliant: false, is_correction: false, filing_date: "2026-06-01",
  }, content: { schema: { name: "JednostkaInnaWZlotych", version: "1-0E" },
    extracted_fields: Object.fromEntries(Object.entries(rows).flatMap(([path, values]) => values.map((v, i) => [`${path}.${i ? "KwotaB" : "KwotaA"}`, v]))),
    standardized_fields: standardized,
  } };
  const mapped = mapMgbiFinancialRecords([record], { type: "NIP", value: nip }, at);
  assert.ok(mapped.section.data);
  const facts = mapped.facts.map(f => ({ ...f, sourceSnapshotId: "00000000-0000-4000-8000-000000000001" }));
  const row: ReportReadRow = { nip, scannerTenantScope: "synthetic-tenant", scanner_documents: projectFinancialDocuments([record]),
    financial_json: { ...mapped.section, catalogMappingVersion: FINANCIAL_MAPPING_VERSION }, financial_sha256: "a".repeat(64), financial_checked_at: at,
    facts, indicators: calculateFinancialIndicators(nip, mapped.section.data, facts), kys: null };
  return row;
}
function report(row: ReportReadRow) { return projectReportData({ nip, entityType: "COMPANY" }, row, new Date(at), {}).financial.scanner!; }

test("two calculation years produce six qualified axes, correct B+D+E ratios and comparison colors without writes", () => {
  const row = fixture(), before = JSON.stringify(row), scanner = report(row);
  assert.equal(JSON.stringify(row), before);
  assert.equal(scanner.methodologyVersion, "3.0.0");
  assert.equal(scanner.referenceFrames![0].qualificationRule, "XML_SOURCE_BASIS_V2");
  assert.equal(scanner.periods.length, 2);
  const current = scanner.periods.find(p => p.to.startsWith("2025"))!;
  const older = previousAnnualPeriod(scanner.periods, current)!;
  assert.equal(older.to, "2024-12-31");
  for (const axis of current.axes) {
    assert.equal(axis.qualification, "VERIFIED", axis.code);
    assert.notEqual(axis.normalizedScore, null, axis.code);
    assert.ok(axis.comparisons?.some(c => c.periodId === older.id), axis.code);
  }
  assert.equal(current.axes.find(a => a.code === "OPERATING_COST_RATIO")!.rawValue, "65.000000");
  assert.equal(older.axes.find(a => a.code === "OPERATING_COST_RATIO")!.rawValue, "80.000000");
  assert.equal(current.axes.find(a => a.code === "OPERATING_MARGIN")!.rawValue, "30.000000");
  const again = report(row);
  assert.deepEqual(again.referenceFrames, scanner.referenceFrames);
});

test("missing one component hides only costs", () => {
  const row = fixture();
  row.scanner_documents![0].rows = row.scanner_documents![0].rows.filter(r => r.sourcePath !== "RZiS.RZiSKalk.E");
  for (const p of report(row).periods) {
    assert.equal(p.axes.find(a => a.code === "OPERATING_COST_RATIO")!.rawValue, null);
    for (const axis of p.axes.filter(a => a.code !== "OPERATING_COST_RATIO")) assert.equal(axis.qualification, "VERIFIED");
  }
});

function splitPeriods(row: ReportReadRow, year: string, comparative = false) {
  const oldDoc = structuredClone(row.scanner_documents![0]);
  oldDoc.recordId = "older"; oldDoc.from = `${year}-01-01`; oldDoc.to = `${year}-12-31`; oldDoc.filingDate = `${+year + 1}-06-01`; oldDoc.checksum = "b".repeat(64);
  for (const r of oldDoc.rows) r.amounts = { KwotaA: r.amounts.KwotaB };
  row.scanner_documents!.push(oldDoc);
  const old = row.financial_json!.data!.periods.find(p => p.from === "2024-01-01")!;
  old.from = oldDoc.from; old.to = oldDoc.to; old.documentId = "older:cfy";
  for (const f of row.facts.filter(f => f.periodStart === "2024-01-01")) { f.periodStart = old.from; f.periodEnd = old.to; }
  if (comparative) {
    const mapping: Record<string,string> = { A: "A", B: "B", F: "C", I: "F", O: "L" };
    oldDoc.rows = oldDoc.rows.filter(r => r.section !== "RZiS" || mapping[r.sourcePath.split('.').at(-1)!]);
    for (const r of oldDoc.rows) if (r.section === "RZiS") {
      const letter = r.sourcePath.split('.').at(-1)!;
      r.sourcePath = `RZiS.RZiSPor.${mapping[letter]}`;
      if (letter === "B") r.amounts.KwotaA = "80";
    }
    old.facts = [...old.facts, { metricCode: "PALA_OAC", amount: "80", unit: "PLN", currency: "PLN" }];
    row.facts.push({ ...row.facts.find(f => f.periodStart === old.from)!, metricCode: "PALA_OAC", amount: "80", sourceAmount: "80", normalizationRule: "VERIFIED_COST_MAGNITUDE_V1", validationStatus: "VALID" });
  }
  row.indicators = calculateFinancialIndicators(nip, row.financial_json!.data!, row.facts);
}

test("two qualified calculation filings compare across a year gap using actual periods", () => {
  const row = fixture(); splitPeriods(row, "2023");
  const scanner = report(row), current = scanner.periods.find(p => p.to === "2025-12-31")!;
  const prior = previousAnnualPeriod(scanner.periods, current)!;
  assert.equal(prior.to, "2023-12-31");
  for (const a of current.axes) {
    assert.notEqual(a.normalizedScore, null, a.code);
    assert.ok(a.comparisons?.some(c => c.periodId === prior.id), a.code);
  }
});

test("a change of P&L variant separates revenue/margin/cost history while retaining comparable net and balance", () => {
  const row = fixture(); splitPeriods(row, "2023", true);
  const scanner = report(row), current = scanner.periods.find(p => p.to === "2025-12-31")!;
  for (const a of current.axes) {
    assert.equal(a.qualification, "VERIFIED", a.code);
    if (["REVENUE", "OPERATING_MARGIN", "OPERATING_COST_RATIO"].includes(a.code)) {
      assert.equal(a.normalizedScore, null, a.code);
      assert.equal(a.comparisons?.length, 0, a.code);
    } else {
      assert.notEqual(a.normalizedScore, null, a.code);
      assert.equal(a.comparisons?.length, 1, a.code);
    }
  }
});
