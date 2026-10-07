import assert from "node:assert/strict";
import test from "node:test";
import type { FinancialData } from "@profitia/srm-xray";
import { calculateFinancialIndicators, type CatalogIndicatorFact } from "./financial-indicators";

const current = {
  BS_A_CA: "1500000", BS_LAE_LAPFL_STL: "1000000", BS_LAE_LAPFL: "2000000", BS_A_TA: "5000000",
  BS_LAE_E: "3000000", PALA_PLFOA: "200000", PALA_NRFS: "2000000", PALA_NPL: "-100000",
  PALA_OAC_MAEC: "300000", PALA_OAC: "1200000", PALA_OAC_D: "100000",
};
const previous = { ...current, BS_A_TA: "4000000", BS_LAE_E: "2000000", PALA_NRFS: "1600000" };
type Values = Record<string, string>;
function fixture(currentValues: Values = current, previousValues: Values = previous, priorYear = 2024): {
  data: FinancialData; facts: CatalogIndicatorFact[];
} {
  const make = (year: number, values: Values) => {
    const from = `${year}-01-01`, to = `${year}-12-31`;
    const documentId = `document-${year}:cfy`;
    const facts = Object.entries(values).map(([metricCode, amount]): CatalogIndicatorFact => ({
      metricCode, periodStart: from, periodEnd: to, statementScope: "UNIT", amount,
      currencyCode: "PLN", unitCode: "PLN", sourcePath: `content.standardized_fields.${metricCode}`,
      validationStatus: "VALID", normalizationRule: metricCode.startsWith("PALA_OAC") ? "VERIFIED_COST_MAGNITUDE_V1" : "SOURCE_VALUE",
      sourceSnapshotId: `00000000-0000-4000-8000-${String(year).padStart(12, "0")}`,
    }));
    const period = { from, to, scope: "standalone" as const, documentId,
      facts: facts.map((fact) => ({ metricCode: fact.metricCode, amount: fact.amount, currency: "PLN", unit: "PLN" })) };
    return { facts, period };
  };
  const newest = make(2025, currentValues), older = make(priorYear, previousValues);
  return { data: { periods: [newest.period, older.period] }, facts: [...newest.facts, ...older.facts] };
}
function newest(code: string, data: FinancialData, facts: CatalogIndicatorFact[]) {
  return calculateFinancialIndicators("5213390341", data, facts).find((result) => result.code === code && result.periodEnd === "2025-12-31")!;
}

test("first-wave formulas use unrounded stored facts and retain exact source evidence", () => {
  const { data, facts } = fixture();
  const expected = {
    CURRENT_RATIO: "1.500000", NET_WORKING_CAPITAL: "500000.0000",
    LIABILITIES_TO_ASSETS: "40.000000", EQUITY_TO_ASSETS: "60.000000",
    OPERATING_MARGIN: "10.000000", NET_MARGIN: "-5.000000",
    REVENUE_YOY: "25.000000", MATERIALS_ENERGY_SHARE: "25.000000",
    ROA: "-2.222222", ROE: "-4.000000", EBITDA_MARGIN: "15.000000",
  };
  for (const [code, value] of Object.entries(expected)) {
    const result = newest(code, data, facts);
    assert.equal(result.status, "AVAILABLE", code);
    assert.equal(result.value, value, code);
    assert.equal(result.reasonCode, null);
    assert.equal(result.nip, "5213390341");
    assert.equal(result.formulaVersion, "1.0");
    assert.ok(result.inputFacts.length >= 2, code);
    assert.ok(result.sourceDocumentIds.includes("document-2025:cfy"));
  }
  assert.deepEqual(["CURRENT_RATIO", "LIABILITIES_TO_ASSETS", "OPERATING_MARGIN"].map((code) => newest(code, data, facts).importance), [3, 3, 3]);
  assert.equal(newest("MATERIALS_ENERGY_SHARE", data, facts).importance, 1);
});

test("missing, review and mixed-document facts never become zero or a calculated result", () => {
  const { data, facts } = fixture();
  const missing = facts.filter((fact) => !(fact.periodStart === "2025-01-01" && fact.metricCode === "BS_LAE_LAPFL_STL"));
  assert.equal(newest("CURRENT_RATIO", data, missing).reasonCode, "MISSING_FIELD");
  assert.equal(newest("CURRENT_RATIO", data, missing).value, null);
  const reviewed = facts.map((fact) => fact.metricCode === "PALA_OAC" && fact.periodStart === "2025-01-01"
    ? { ...fact, validationStatus: "REVIEW" as const } : fact);
  assert.equal(newest("MATERIALS_ENERGY_SHARE", data, reviewed).reasonCode, "UNVERIFIED_FIELD");
  const mixed = facts.map((fact) => fact.metricCode === "BS_A_CA" && fact.periodStart === "2025-01-01"
    ? { ...fact, sourceSnapshotId: "00000000-0000-4000-8000-000000000001" } : fact);
  assert.equal(newest("CURRENT_RATIO", data, mixed).reasonCode, "MIXED_SOURCE");
  const mismatch = facts.map((fact) => fact.metricCode === "BS_A_CA" && fact.periodStart === "2025-01-01"
    ? { ...fact, amount: "1500001" } : fact);
  assert.equal(newest("CURRENT_RATIO", data, mismatch).reasonCode, "DOCUMENT_MISMATCH");
});

test("year comparisons require adjacent annual periods and ROE rejects nonpositive average equity", () => {
  const gap = fixture(current, previous, 2023);
  for (const code of ["REVENUE_YOY", "ROA", "ROE"]) {
    assert.equal(newest(code, gap.data, gap.facts).reasonCode, "PRIOR_YEAR_NOT_COMPARABLE");
  }
  const zeroEquity = fixture({ ...current, BS_LAE_E: "-2000000" });
  assert.equal(newest("ROE", zeroEquity.data, zeroEquity.facts).reasonCode, "NON_POSITIVE_EQUITY");
  const zeroRevenue = fixture({ ...current, PALA_NRFS: "0" });
  assert.equal(newest("NET_MARGIN", zeroRevenue.data, zeroRevenue.facts).reasonCode, "NON_POSITIVE_DENOMINATOR");
});

test("comparisons never combine standalone and consolidated statements", () => {
  const { data, facts } = fixture();
  const older = data.periods[1];
  const separated: FinancialData = { periods: [data.periods[0], { ...older, scope: "consolidated" }] };
  const separatedFacts = facts.map((fact) => fact.periodStart === "2024-01-01"
    ? { ...fact, statementScope: "CONSOLIDATED" as const } : fact);
  assert.equal(newest("REVENUE_YOY", separated, separatedFacts).reasonCode, "PRIOR_YEAR_NOT_COMPARABLE");
  assert.equal(newest("ROA", separated, separatedFacts).reasonCode, "PRIOR_YEAR_NOT_COMPARABLE");
  assert.equal(newest("CURRENT_RATIO", separated, separatedFacts).value, "1.500000");
});


test("EBITDA margin needs verified operating depreciation from the same financial statement", () => {
  const { data, facts } = fixture();
  const result = newest("EBITDA_MARGIN", data, facts);
  assert.equal(result.value, "15.000000");
  assert.deepEqual(result.inputFacts.map((fact) => fact.metricCode), ["PALA_PLFOA", "PALA_OAC_D", "PALA_NRFS"]);
  const unverified = facts.map((fact) => fact.metricCode === "PALA_OAC_D" && fact.periodStart === "2025-01-01"
    ? { ...fact, normalizationRule: "SOURCE_VALUE" } : fact);
  assert.equal(newest("EBITDA_MARGIN", data, unverified).reasonCode, "UNVERIFIED_COST_SIGN");
  const missing = facts.filter((fact) => !(fact.metricCode === "PALA_OAC_D" && fact.periodStart === "2025-01-01"));
  assert.equal(newest("EBITDA_MARGIN", data, missing).reasonCode, "MISSING_FIELD");
  const zeroRevenue = fixture({ ...current, PALA_NRFS: "0" });
  assert.equal(newest("EBITDA_MARGIN", zeroRevenue.data, zeroRevenue.facts).reasonCode, "NON_POSITIVE_DENOMINATOR");
});

test("unconfirmed second-wave field mappings never calculate from broader source totals", () => {
  const { data, facts } = fixture({
    ...current, PALA_FC: "70000", BS_LAE_LAPFL: "2000000",
    CFS_OACF_TA_D: "100000", CFS_CFFIA_E_AOIAAOTFA: "200000",
  });
  for (const code of ["QUICK_RATIO", "INTEREST_COVERAGE", "NET_DEBT_TO_EBITDA", "FREE_CASH_FLOW", "CASH_CONVERSION_CYCLE"]) {
    const result = newest(code, data, facts);
    assert.equal(result.status, "UNAVAILABLE", code);
    assert.equal(result.value, null, code);
    assert.equal(result.reasonCode, "SOURCE_MAPPING_UNCONFIRMED", code);
    assert.equal(result.inputFacts.length, 0, code);
  }
});
