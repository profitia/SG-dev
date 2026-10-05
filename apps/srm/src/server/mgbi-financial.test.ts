import assert from "node:assert/strict";
import test from "node:test";
import { fetchMgbiFinancial, mapMgbiFinancialRecords } from "./mgbi-financial";

const id = { type: "KRS" as const, value: "0000009723" };
const timestamp = "2026-10-05T18:00:00.000Z";
function record(override: Record<string, unknown> = {}) {
  return {
    id: "rdf-1", identifiers: { pl_krs: id.value, pl_nip: "1111111111" },
    document: { document_id: 7, type: "financial_statement", period_from_date: "2025-01-01",
      period_to_date: "2025-12-31", filing_date: "2026-06-30", is_correction: false, is_ias_compliant: false },
    content: { schema: { name: "JednostkaInnaWZlotych", version: "1-3" }, standardized_fields: { bs: { a_ca_cfy: "1234.50", a_ca_pfy: 1000, bad_cfy: "x" }, pala: { npl_cfy: -20 } } },
    ...override,
  };
}
test("maps exact RDF identity, document metadata and candidate metric paths", () => {
  const result = mapMgbiFinancialRecords({ results: [record()] }, id, timestamp);
  assert.equal(result.section.status, "SUCCESS");
  assert.equal(result.section.data?.periods.length, 1);
  assert.deepEqual(result.section.data?.periods[0].facts, [
    { metricCode: "bs.a_ca", amount: "1234.50", currency: "PLN", unit: "PLN" },
    { metricCode: "pala.npl", amount: "-20", currency: "PLN", unit: "PLN" },
  ]);
  assert.deepEqual(result.documents[0], { recordId: "rdf-1", documentId: "7", type: "financial_statement",
    from: "2025-01-01", to: "2025-12-31", filingDate: "2026-06-30",
    isCorrection: false, isIasCompliant: false, scope: "standalone" });
  assert.deepEqual(result.candidates.map(({ metricCode, amount, comparison }) => ({ metricCode, amount, comparison })), [
    { metricCode: "bs.a_ca", amount: "1234.50", comparison: "current" },
    { metricCode: "bs.a_ca", amount: "1000", comparison: "prior" },
    { metricCode: "pala.npl", amount: "-20", comparison: "current" },
  ]);
  assert.equal(result.candidates[0].sourcePath, "content.standardized_fields.bs.a_ca_cfy");
});
test("does not accept another company's RDF records", () => {
  const result = mapMgbiFinancialRecords({ results: [record({ identifiers: { pl_krs: "9999999999" } })] }, id, timestamp);
  assert.equal(result.section.status, "ERROR");
  assert.equal(result.errorCode, "IDENTIFIER_MISMATCH");
});
test("empty and malformed provider responses are distinct", () => {
  assert.equal(mapMgbiFinancialRecords({ results: [] }, id, timestamp).section.status, "EMPTY");
  assert.equal(mapMgbiFinancialRecords({}, id, timestamp).errorCode, "INVALID_RESPONSE");
});
test("uses only the server-side credential and exact RDF search filter", async () => {
  let called = false;
  const result = await fetchMgbiFinancial(id, { apiKey: "test-secret", now: () => new Date(timestamp),
    fetcher: (async (input, init) => {
      called = true;
      const url = new URL(String(input));
      assert.equal(url.pathname, "/v1/models/pl-krs-rdf-record/records");
      assert.equal(url.searchParams.get("identifiers.pl_krs"), id.value);
      assert.equal(url.searchParams.get("document.type"), "financial_statement");
      assert.deepEqual(url.searchParams.getAll("content"), ["identifiers", "document", "content.schema", "content.standardized_fields"]);
      assert.equal((init?.headers as Record<string, string>).Authorization, "test-secret");
      return new Response(JSON.stringify({ results: [record()] }), { status: 200 });
    }) as typeof fetch });
  assert.equal(called, true);
  assert.equal(result.documents.length, 1);
});
test("reports provider failures without exposing response body", async () => {
  const result = await fetchMgbiFinancial(id, { apiKey: "test-secret", now: () => new Date(timestamp),
    fetcher: (async () => new Response("sensitive upstream details", { status: 403 })) as typeof fetch });
  assert.equal(result.errorCode, "HTTP_403");
  assert.equal(JSON.stringify(result).includes("sensitive"), false);
});
test("ignores nonfinancial RDF filings", () => {
  const result = mapMgbiFinancialRecords({ results: [record({ document: { type: "resolution" } })] }, id, timestamp);
  assert.equal(result.section.status, "EMPTY");
  assert.equal(result.documents.length, 0);
});
test("marks a paginated RDF search as incomplete", async () => {
  const result = await fetchMgbiFinancial(id, { apiKey: "test-secret", now: () => new Date(timestamp),
    fetcher: (async () => new Response(JSON.stringify({ results: [record()], pages: 2 }), { status: 200 })) as typeof fetch });
  assert.equal(result.section.warnings.includes("MGBI_ADDITIONAL_PAGES_NOT_FETCHED"), true);
});

test("keeps unknown financial schema out of displayed amounts", () => {
  const result = mapMgbiFinancialRecords({ results: [record({ content: { schema: { name: "UnknownSchema" },
    standardized_fields: { bs: { a_ca_cfy: "1234" } } } })] }, id, timestamp);
  assert.equal(result.section.status, "PARTIAL");
  assert.equal(result.section.data?.periods.length, 0);
  assert.equal(result.candidates.length, 1);
  assert.deepEqual(result.section.warnings, ["MGBI_FINANCIAL_SCHEMA_OR_PERIOD_UNVERIFIED"]);
});
