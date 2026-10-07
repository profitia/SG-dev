import assert from "node:assert/strict";
import test from "node:test";
import { fetchMgbiFinancial, mapMgbiFinancialRecords } from "./mgbi-financial";

const identifier = { type: "KRS" as const, value: "0000162128" };
const record = {
  id: "rdf-2025", identifiers: { pl_krs: identifier.value },
  document: { type: "financial_statement", period_from_date: "2025-01-01", period_to_date: "2025-12-31" },
  content: { schema: { name: "JednostkaInnaWZlotych" }, standardized_fields: {
    bs: { a_ca_cfy: 119425249.41, a_ca_pfy: 153533017.28, a_ta_cfy: 245945715.44 },
    pala: { npl_cfy: 4848538.54 },
  } },
};
const at = "2026-10-06T08:00:00.000Z";

test("maps JSON standardized fields extracted from an XML financial statement into calculable facts", () => {
  const result = mapMgbiFinancialRecords([record], identifier, at);
  assert.equal(result.section.status, "SUCCESS");
  assert.equal(result.section.data?.periods.length, 2);
  assert.equal(result.facts.length, 4);
  assert.deepEqual(result.facts.find((fact) => fact.sourcePath.endsWith("a_ca_pfy")), {
    metricCode: "BS_A_CA", periodStart: "2024-01-01", periodEnd: "2024-12-31",
    periodType: "YEAR", statementScope: "UNIT", amount: "153533017.28", sourceAmount: "153533017.28", normalizationRule: "SOURCE_VALUE",
    currencyCode: "PLN", unitCode: "PLN", sourcePath: "content.standardized_fields.bs.a_ca_pfy",
    validationStatus: "VALID",
  });
});

test("adds numeric extracted fields and prefers standardized values for matching metrics", () => {
  const source = structuredClone(record);
  source.content = { ...source.content, extracted_fields: {
    bs: { a_ca_cfy: "999", a_fa_cfy: "440000.25", a_fa_pfy: "400000" },
    cfs: { cffia_e_aoiaaotfa_cfy: "-123.45" },
  } } as unknown as typeof source.content;
  const result = mapMgbiFinancialRecords([source], identifier, at);
  const currentAssets = result.facts.find((fact) => fact.metricCode === "BS_A_CA" && fact.periodEnd === "2025-12-31");
  const fixedAssets = result.facts.find((fact) => fact.metricCode === "BS_A_FA" && fact.periodEnd === "2025-12-31");
  const cashFlow = result.facts.find((fact) => fact.metricCode === "CFS_CFFIA_E_AOIAAOTFA");
  assert.equal(currentAssets?.amount, "119425249.41");
  assert.equal(currentAssets?.sourcePath, "content.standardized_fields.bs.a_ca_cfy");
  assert.equal(fixedAssets?.amount, "440000.25");
  assert.equal(fixedAssets?.sourcePath, "content.extracted_fields.bs.a_fa_cfy");
  assert.equal(cashFlow?.amount, "-123.45");
  assert.equal(result.section.data?.periods.some((period) => period.facts.some((fact) => fact.metricCode === "BS_A_FA")), true);
});

test("maps an extracted-fields-only statement without inventing standardized values", () => {
  const source = structuredClone(record);
  source.content = { schema: { name: "JednostkaInnaWZlotych" }, extracted_fields: {
    bs: { a_ca_cfy: "250", a_ca_pfy: "200" },
  } } as unknown as typeof source.content;
  const result = mapMgbiFinancialRecords([source], identifier, at);
  assert.equal(result.section.status, "SUCCESS");
  assert.deepEqual(result.facts.map((fact) => fact.amount), ["250", "200"]);
  assert.ok(result.facts.every((fact) => fact.sourcePath.startsWith("content.extracted_fields.")));
});

test("verifies both expense sign conventions and returns positive costs while preserving source figures", () => {
  const source = {
    id: "expense-report", identifiers: { pl_krs: identifier.value },
    document: { type: "financial_statement", period_from_date: "2024-01-01", period_to_date: "2024-12-31" },
    content: { schema: { name: "JednostkaInnaWZlotych" }, standardized_fields: { pala: {
      nrfs_cfy: "2231084.47", oac_cfy: "2034049.83", plfs_cfy: "197034.64", oac_maec_cfy: "500000",
      nrfs_pfy: "2018218.90", oac_pfy: "-1931510.83", plfs_pfy: "86708.07", oac_maec_pfy: "-400000",
    } } },
  };
  const result = mapMgbiFinancialRecords([source], identifier, at);
  const cost2023 = result.facts.find((fact) => fact.metricCode === "PALA_OAC" && fact.periodEnd === "2023-12-31");
  const cost2024 = result.facts.find((fact) => fact.metricCode === "PALA_OAC" && fact.periodEnd === "2024-12-31");
  assert.equal(cost2023?.sourceAmount, "-1931510.83");
  assert.equal(cost2023?.amount, "1931510.83");
  assert.equal(cost2024?.amount, "2034049.83");
  assert.equal(cost2023?.normalizationRule, "VERIFIED_COST_MAGNITUDE_V1");
  assert.equal(result.sourceData?.periods.find((period) => period.to === "2023-12-31")?.facts.find((fact) => fact.metricCode === "PALA_OAC")?.amount, "-1931510.83");
  assert.equal(result.section.data?.periods.find((period) => period.to === "2023-12-31")?.facts.find((fact) => fact.metricCode === "PALA_OAC")?.amount, "1931510.83");
  assert.equal(result.facts.find((fact) => fact.metricCode === "PALA_OAC_MAEC" && fact.periodEnd === "2023-12-31")?.amount, "400000");
  assert.deepEqual(result.section.warnings, []);
});

test("does not rewrite costs when the reported sales result cannot verify the sign", () => {
  const source = {
    id: "expense-report", identifiers: { pl_krs: identifier.value },
    document: { type: "financial_statement", period_from_date: "2023-01-01", period_to_date: "2023-12-31" },
    content: { schema: { name: "JednostkaInnaWZlotych" }, standardized_fields: { pala: {
      nrfs_cfy: "100", oac_cfy: "-80", plfs_cfy: "999",
    } } },
  };
  const result = mapMgbiFinancialRecords([source], identifier, at);
  assert.equal(result.facts.find((fact) => fact.metricCode === "PALA_OAC")?.amount, "-80");
  assert.equal(result.facts.find((fact) => fact.metricCode === "PALA_OAC")?.normalizationRule, "UNVERIFIED_COST_SIGN");
  assert.deepEqual(result.section.warnings, ["MGBI_COST_SIGN_UNVERIFIED"]);
});

test("normalizes other operating, financial and tax expenses only after checking their statement equations", () => {
  const source = {
    id: "expense-report", identifiers: { pl_krs: identifier.value },
    document: { type: "financial_statement", period_from_date: "2024-01-01", period_to_date: "2024-12-31" },
    content: { schema: { name: "JednostkaInnaWZlotych" }, standardized_fields: { pala: {
      nrfs_cfy: "1200", oac_cfy: "800", plfs_cfy: "400", oor_cfy: "25", ooc_cfy: "35",
      plfoa_cfy: "390", fr_cfy: "10", fc_cfy: "20", gpl_cfy: "380", it_cfy: "80", npl_cfy: "300",
      nrfs_pfy: "1000", oac_pfy: "-700", plfs_pfy: "300", oor_pfy: "20", ooc_pfy: "-30",
      plfoa_pfy: "290", fr_pfy: "5", fc_pfy: "-15", gpl_pfy: "280", it_pfy: "-50", npl_pfy: "230",
    } } },
  };
  const result = mapMgbiFinancialRecords([source], identifier, at);
  for (const [code, value2023, value2024] of [
    ["PALA_OAC", "700", "800"], ["PALA_OOC", "30", "35"],
    ["PALA_FC", "15", "20"], ["PALA_IT", "50", "80"],
  ]) {
    const prior = result.facts.find((fact) => fact.metricCode === code && fact.periodEnd === "2023-12-31");
    const current = result.facts.find((fact) => fact.metricCode === code && fact.periodEnd === "2024-12-31");
    assert.equal(prior?.sourceAmount, `-${value2023}`);
    assert.equal(prior?.amount, value2023);
    assert.equal(current?.amount, value2024);
    assert.equal(prior?.normalizationRule, "VERIFIED_COST_MAGNITUDE_V1");
    assert.equal(current?.normalizationRule, "VERIFIED_COST_MAGNITUDE_V1");
    assert.equal(result.sourceData?.periods.find((period) => period.to === "2023-12-31")?.facts.find((fact) => fact.metricCode === code)?.amount, `-${value2023}`);
  }
  assert.deepEqual(result.section.warnings, []);

  // A mismatch must retain the source sign and flag the fact for review.
  const disputed = structuredClone(source);
  disputed.content.standardized_fields.pala.npl_pfy = "999";
  const unresolved = mapMgbiFinancialRecords([disputed], identifier, at);
  const tax = unresolved.facts.find((fact) => fact.metricCode === "PALA_IT" && fact.periodEnd === "2023-12-31");
  assert.equal(tax?.sourceAmount, "-50");
  assert.equal(tax?.amount, "-50");
  assert.equal(tax?.validationStatus, "REVIEW");
  assert.equal(tax?.normalizationRule, "UNVERIFIED_COST_SIGN");
  assert.deepEqual(unresolved.section.warnings, ["MGBI_COST_SIGN_UNVERIFIED"]);
});

test("never uses document file or record-by-id endpoints", async () => {
  const result = await fetchMgbiFinancial(identifier, {
    apiKey: "test-key", now: () => new Date(at),
    fetcher: async (url, init) => {
      const request = new URL(String(url));
      assert.equal(request.pathname, "/v1/models/pl-krs-rdf-record/records");
      assert.equal(request.searchParams.get("identifiers.pl_krs"), identifier.value);
      assert.equal(request.searchParams.get("content.standardized_fields.is_available"), "true");
      assert.equal(request.searchParams.has("content"), false);
      assert.equal((init?.headers as Record<string, string>).Authorization, "test-key");
      return Response.json({ count: 1, results: [record] });
    },
  });
  assert.equal(result.section.status, "SUCCESS");
});

test("reports missing standardized data and identifier mismatch truthfully", async () => {
  const none = await fetchMgbiFinancial(identifier, { apiKey: "test", fetcher: async () => Response.json({ count: 0, results: [] }) });
  assert.equal(none.section.status, "EMPTY");
  const mismatch = mapMgbiFinancialRecords([{ ...record, identifiers: { pl_krs: "9999999999" } }], identifier, at);
  assert.equal(mismatch.errorCode, "IDENTIFIER_MISMATCH");
  assert.equal(mismatch.facts.length, 0);
});

test("identifies a complete set of international-standard statements without displayable facts", async () => {
  const statements = [2025, 2024].map((year) => ({
    id: `ias-${year}`, identifiers: { pl_krs: identifier.value },
    document: { type: "financial_statement", is_ias_compliant: true, period_from_date: `${year}-01-01`, period_to_date: `${year}-12-31` },
  }));
  let requests = 0;
  const result = await fetchMgbiFinancial(identifier, { apiKey: "test", fetcher: async (url) => {
    const request = new URL(String(url));
    requests++;
    if (requests === 1) {
      assert.equal(request.searchParams.get("content.standardized_fields.is_available"), "true");
      return Response.json({ count: 0, results: [] });
    }
    assert.equal(request.searchParams.has("content.standardized_fields.is_available"), false);
    assert.equal(request.pathname, "/v1/models/pl-krs-rdf-record/records");
    return Response.json({ count: 2, results: statements });
  } });
  assert.equal(requests, 2);
  assert.equal(result.section.status, "EMPTY");
  assert.deepEqual(result.section.warnings, ["MGBI_INTERNATIONAL_STATEMENT_WITHOUT_FACTS"]);
});

test("does not attribute unknown or partial missing statements to international standards", async () => {
  const statement = { id: "ias", identifiers: { pl_krs: identifier.value }, document: { type: "financial_statement", is_ias_compliant: true } };
  for (const response of [
    { count: 2, results: [statement] },
    { count: 1, results: [{ ...statement, document: { type: "financial_statement" } }] },
  ]) {
    let requests = 0;
    const result = await fetchMgbiFinancial(identifier, { apiKey: "test", fetcher: async () => {
      requests++;
      return Response.json(requests === 1 ? { count: 0, results: [] } : response);
    } });
    assert.deepEqual(result.section.warnings, ["MGBI_NO_STRUCTURED_FINANCIAL_DATA"]);
  }
});

test("maps only verified flat MGBI XML paths for current and prior financial periods", () => {
  const source = structuredClone(record);
  source.content = { ...source.content, extracted_fields: {
    "Bilans.Aktywa.Aktywa_B.Aktywa_B_I.KwotaA": "120",
    "Bilans.Aktywa.Aktywa_B.Aktywa_B_I.KwotaB": "90",
    "RZiS.RZiSPor.H.H_I.KwotaA": "-7",
    "RachPrzeplywow.PrzeplywyPosr.A.A_III.KwotaA": "400",
    "RachPrzeplywow.PrzeplywyPosr.B.B_II.B_II_1.KwotaA": "-150",
    "DaneOsoby.Pesel": "12345678901",
  } } as unknown as typeof source.content;
  const result = mapMgbiFinancialRecords([source], identifier, at);
  assert.equal(result.facts.find((fact) => fact.metricCode === "BS_A_CA_INV" && fact.periodEnd === "2025-12-31")?.amount, "120");
  assert.equal(result.facts.find((fact) => fact.metricCode === "BS_A_CA_INV" && fact.periodEnd === "2024-12-31")?.amount, "90");
  assert.equal(result.facts.find((fact) => fact.metricCode === "PALA_INTEREST_EXPENSE")?.sourceAmount, "-7");
  assert.equal(result.facts.find((fact) => fact.metricCode === "CFS_OPERATING_CASH_FLOW")?.amount, "400");
  assert.equal(result.facts.find((fact) => fact.metricCode === "CFS_CAPITAL_EXPENDITURE")?.amount, "-150");
  assert.ok(result.facts.every((fact) => !fact.sourcePath.includes("Pesel")));
});
