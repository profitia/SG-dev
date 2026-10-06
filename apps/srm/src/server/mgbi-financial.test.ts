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
    periodType: "YEAR", statementScope: "UNIT", amount: "153533017.28",
    currencyCode: "PLN", unitCode: "PLN", sourcePath: "content.standardized_fields.bs.a_ca_pfy",
    validationStatus: "VALID",
  });
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
