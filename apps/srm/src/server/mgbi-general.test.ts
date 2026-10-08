import assert from "node:assert/strict";
import test from "node:test";
import { fetchMgbiGeneral, mapMgbiGeneralRecord } from "./mgbi-general";

const record = {
  id: "wp-123",
  identifiers: { pl_krs: "0000123456", pl_nip: "1234567890", pl_regon: "123456789" },
  content: { current_excerpt: {
    naglowekA: { dataRejestracjiWKRS: "2020-01-02", stanZDnia: "2025-12-31" },
    dane: {
      dzial1: {
        danePodmiotu: { nazwa: "Przykład sp. z o.o.", formaPrawna: "SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ" },
        siedzibaIAdres: { adres: { ulica: "Prosta", nrDomu: "1", kodPocztowy: "00-001", miejscowosc: "Warszawa", kraj: "POLSKA" } },
      },
      dzial3: { przedmiotDzialalnosci: { przedmiotPrzewazajacejDzialalnosci: [{ kodDzial: "62", kodKlasa: "01", kodPodklasa: "Z" }] } },
    },
  } },
};
const date = () => new Date("2026-10-05T18:00:00.000Z");
const options = { apiKey: "test-key", now: date };

test("maps WP record to public company fields and provenance", () => {
  const result = mapMgbiGeneralRecord(record, date().toISOString());
  assert.equal(result.section.status, "SUCCESS");
  assert.equal(result.section.source.recordId, "wp-123");
  assert.equal(result.section.effectiveAt, "2025-12-31");
  assert.equal(result.section.data?.legalName, "Przykład sp. z o.o.");
  assert.equal(result.section.data?.registeredAddress, "Prosta, 1, 00-001, Warszawa, POLSKA");
  assert.equal(result.section.data?.mainPkd, "62.01.Z");
  assert.deepEqual(result.section.warnings, []);
});

test("labels absent fields as partial without inventing values", () => {
  const result = mapMgbiGeneralRecord({ id: "wp-2", identifiers: { pl_krs: "0000123456" } }, date().toISOString());
  assert.equal(result.section.status, "PARTIAL");
  assert.equal(result.section.data?.nip, null);
  assert.ok(result.section.warnings.includes("MGBI_MISSING_legalName"));
});

test("queries NIP with a server-side token and exact record match", async () => {
  let called = false;
  const result = await fetchMgbiGeneral({ type: "NIP", value: "1234567890" }, {
    ...options,
    fetcher: async (url, init) => {
      called = true;
      const requestUrl = new URL(String(url));
      assert.equal(requestUrl.pathname, "/v1/models/pl-krs-wp-record/records");
      assert.equal(requestUrl.searchParams.get("identifiers.pl_nip"), "1234567890");
      assert.equal((init?.headers as Record<string, string>).Authorization, "test-key");
      return Response.json({ count: 1, results: [record] });
    },
  });
  assert.equal(called, true);
  assert.equal(result.section.status, "SUCCESS");
  assert.deepEqual(result.rawRecord, record);
  assert.deepEqual(result.rawResponse?.pages, [{ count: 1, results: [record] }]);
});

test("retains complete WP fields outside the public company projection", async () => {
  const full = structuredClone(record) as typeof record & { representation?: { pesel: string } };
  full.representation = { pesel: "12345678901" };
  const result = await fetchMgbiGeneral({ type: "NIP", value: "1234567890" }, {
    ...options, fetcher: async () => Response.json({ count: 1, results: [full] }),
  });
  assert.equal(result.section.data?.legalName, "Przykład sp. z o.o.");
  assert.equal(JSON.stringify(result.rawResponse).includes("12345678901"), true);
  assert.equal(JSON.stringify(result.section.data).includes("12345678901"), false);
});

test("treats empty and mismatched search results separately", async () => {
  const identifier = { type: "KRS" as const, value: "0000123456" };
  const none = await fetchMgbiGeneral(identifier, { ...options, fetcher: async () => Response.json({ count: 0, results: [] }) });
  assert.equal(none.section.status, "EMPTY");
  const mismatch = await fetchMgbiGeneral(identifier, { ...options, fetcher: async () => Response.json({ results: [{ ...record, identifiers: { pl_krs: "9999999999" } }] }) });
  assert.equal(mismatch.errorCode, "IDENTIFIER_MISMATCH");
  assert.equal(mismatch.rawRecord, null);
});

test("returns safe error states for provider and network failures", async () => {
  const identifier = { type: "KRS" as const, value: "0000123456" };
  const denied = await fetchMgbiGeneral(identifier, { ...options, fetcher: async () => new Response("private detail", { status: 401 }) });
  assert.equal(denied.errorCode, "HTTP_401");
  assert.deepEqual(denied.section.warnings, ["MGBI_HTTP_401"]);
  const offline = await fetchMgbiGeneral(identifier, { ...options, fetcher: async () => { throw new Error("secret network detail"); } });
  assert.equal(offline.errorCode, "NETWORK_ERROR");
  assert.equal(JSON.stringify(offline).includes("secret"), false);
});

test("rejects invalid identifiers before the provider call", async () => {
  await assert.rejects(fetchMgbiGeneral({ type: "KRS", value: "123" }, options), /ten-digit/);
});
