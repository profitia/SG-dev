import assert from "node:assert/strict";
import test from "node:test";
import { fetchVerclyKys } from "./vercly-kys";

const request = { identifier: { type: "NIP" as const, value: "5272443955" } };

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

test("NIP-only request omits phone, name and FULL, then keeps an allowlisted report", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (calls.length === 1) return response(["correlation123"]);
    if (calls.length === 2) return response([{ Header: { CorrelationId: "correlation123" }, Body: { IsComplete: false } }]);
    return response([{ Header: { CorrelationId: "correlation123", Id: "report456" }, Body: {
      IsComplete: true, QueriedRegisters: ["Regon"], Errors: [{ Severity: 0, Message: "private provider message" }],
      Entity: { Name: "XTB SPÓŁKA AKCYJNA", Ids: [{ Type: "KRS", Value: "0000217580" }, { Type: "VatID", Value: "PL5272443955" }],
        Krz: { Count: 0 }, Vat: { ActivityStatus: "Czynny" }, Vies: { EuVat: true },
        DepPersons: { Count: 1, Persons: [{ Name: "PRIVATE PERSON", PersonalId: "12345678901" }] },
        Sanctions: [{ ListName: "eu_fsf_sanctions", ListType: "SANCTIONS", Value: false }],
      },
    } }]);
  }) as typeof fetch;
  const result = await fetchVerclyKys(request, { apiKey: "test-token", baseUrl: "https://vercly.example", fetcher, sleep: async () => {} });
  assert.equal(calls.length, 3);
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), [{ Id: "5272443955", Country: "PL" }]);
  assert.equal(result.section.status, "PARTIAL");
  assert.equal(result.section.data?.company?.krs, "0000217580");
  assert.equal(result.section.data?.company?.nip, "5272443955");
  assert.equal(result.section.data?.relatedPersonsCount, 1);
  assert.deepEqual(result.section.data?.registryChecks, { krzListed: false, vatActive: true, euVat: true });
  assert.ok(!JSON.stringify(result.section).includes("PRIVATE PERSON"));
  assert.ok(!JSON.stringify(result.section).includes("private provider message"));
});

test("rejects a result for a different NIP", async () => {
  let calls = 0;
  const fetcher = (async () => ++calls === 1 ? response(["correlation123"]) : response([{
    Header: { CorrelationId: "correlation123" }, Body: { IsComplete: true, Entity: { Ids: [{ Type: "ID", Value: "8650004194" }] } },
  }])) as typeof fetch;
  const result = await fetchVerclyKys(request, { apiKey: "test-token", baseUrl: "https://vercly.example", fetcher, sleep: async () => {} });
  assert.equal(result.errorCode, "IDENTIFIER_MISMATCH");
  assert.equal(result.section.data, null);
});

test("retries temporary 404 while Vercly prepares the report", async () => {
  let calls = 0;
  const sleeps: number[] = [];
  const fetcher = (async () => {
    calls += 1;
    if (calls === 1) return response(["correlation123"]);
    if (calls <= 3) return response({ error: "not ready" }, 404);
    return response([{ Header: { CorrelationId: "correlation123" }, Body: {
      IsComplete: true, Entity: { Ids: [{ Type: "VatID", Value: "PL5272443955" }] },
    } }]);
  }) as typeof fetch;
  const result = await fetchVerclyKys(request, { apiKey: "test-token", baseUrl: "https://vercly.example", fetcher,
    sleep: async (ms) => { sleeps.push(ms); }, pollIntervalMs: 2000 });
  assert.equal(result.section.status, "SUCCESS");
  assert.deepEqual(sleeps, [2000, 2000, 2000]);
  assert.deepEqual(result.section.data?.registryChecks, { krzListed: null, vatActive: null, euVat: null });
});
