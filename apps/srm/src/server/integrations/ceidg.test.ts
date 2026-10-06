import assert from "node:assert/strict";
import test from "node:test";
import { fetchCeidgJdg } from "./ceidg";

const nip = "7972088368";
const sample = {
  firma: [{
    id: "entry-1", nazwa: "Przykładowa działalność", status: "AKTYWNY",
    wlasciciel: { imie: "Jan", nazwisko: "Testowy", nip, regon: "123456789" },
    adresDzialalnosci: { miasto: "Warszawa" },
    pkd: [{ kod: "6201Z", nazwa: "Przykładowa działalność" }],
    telefon: "123456789", dodatkowePole: { informacja: true },
  }],
};

test("CEIDG requests detail by NIP with server-side bearer and preserves all response fields", async () => {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const result = await fetchCeidgJdg(nip, {
    token: "test-secret", fetcher: async (url, init) => {
      requests.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify(sample), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /\/firma\?nip=7972088368$/);
  assert.equal((requests[0].init.headers as Record<string, string>).Authorization, "Bearer test-secret");
  assert.equal(result.section.status, "SUCCESS");
  assert.equal(result.section.source.provider, "CEIDG");
  assert.equal(result.section.data?.entries[0]?.status, "Aktywny");
  assert.deepEqual(result.snapshot, sample);
  assert.equal(result.section.data?.entries[0]?.fields.length, Object.keys(sample.firma[0]).length);
  assert.equal(result.section.data?.entries[0]?.fields.find((field) => field.key === "dodatkowePole")?.children[0].value, "Tak");
});

test("CEIDG treats no record and a foreign NIP as distinct outcomes", async () => {
  const empty = await fetchCeidgJdg(nip, { token: "test-secret", fetcher: async () => new Response(null, { status: 204 }) });
  assert.equal(empty.section.status, "EMPTY");
  const foreign = await fetchCeidgJdg(nip, { token: "test-secret", fetcher: async () => new Response(JSON.stringify({
    firma: [{ ...sample.firma[0], wlasciciel: { ...sample.firma[0].wlasciciel, nip: "1111111111" } }],
  }), { status: 200 }) });
  assert.equal(foreign.section.status, "ERROR");
  assert.equal(foreign.errorCode, "IDENTIFIER_MISMATCH");
  assert.equal(foreign.snapshot, null);
});

test("CEIDG keeps authentication and provider failures out of public data", async () => {
  const missing = await fetchCeidgJdg(nip, { token: "" });
  assert.equal(missing.errorCode, "NOT_CONFIGURED");
  const unauthorized = await fetchCeidgJdg(nip, { token: "test-secret", fetcher: async () => new Response(null, { status: 401 }) });
  assert.equal(unauthorized.errorCode, "HTTP_401");
  assert.equal(unauthorized.section.data, null);
});
