import assert from "node:assert/strict";
import test from "node:test";
import { fetchVerclyKys } from "./vercly-kys";

const request = {
  identifier: { type: "KRS" as const, value: "0000217580" },
  name: "XTB SPÓŁKA AKCYJNA",
  phone: "+48222019550",
};

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

test("FULL lookup polls to completion and keeps only an allowlisted KYS projection", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (calls.length === 1) return response(["correlation123"]);
    if (calls.length === 2) return response([{ Header: { CorrelationId: "correlation123" }, Body: { IsComplete: false } }]);
    return response([{
      Header: { CorrelationId: "correlation123", Id: "report456" },
      Body: { IsComplete: true, StateAsOfDate: 1791260400722, QueriedRegisters: ["Regon", "None"],
        Errors: [{ Severity: 0, Message: "private provider message" }],
        Entity: { Name: "XTB SPÓŁKA AKCYJNA", Ids: [{ Type: "KRS", Value: "0000217580" }, { Type: "ID", Value: "5272443955" }],
          Attributes: [{ Name: "Country", Value: "PL" }, { Name: "Street", Value: "---" }, { Name: "ActivityStatus", Value: "UNKNOWN" }],
          DepPersons: { Count: 1, Persons: [{ Name: "PRIVATE PERSON", PersonalId: "12345678901" }] },
          Beneficiaries: { Count: 0 }, PepPositions: { Count: 0 },
          Sanctions: [{ ListName: "eu_fsf_sanctions", ListType: "SANCTIONS", Value: false }],
        },
      },
    }]);
  }) as typeof fetch;
  const result = await fetchVerclyKys(request, { apiKey: "test-token", baseUrl: "https://vercly.example", fetcher, sleep: async () => {} });
  assert.equal(calls.length, 3);
  const providerRequest = JSON.parse(String(calls[0].init?.body))[0];
  assert.equal(providerRequest.VerificationType, "FULL");
  assert.equal(providerRequest.RegisterId, request.identifier.value);
  assert.equal(providerRequest.Id, undefined);
  assert.equal(providerRequest.WWW, undefined);
  assert.equal(calls[0].init?.headers && (calls[0].init.headers as Record<string, string>).Authorization, "Bearer test-token");
  assert.equal(result.section.status, "PARTIAL");
  assert.equal(result.section.data?.company?.krs, request.identifier.value);
  assert.equal(result.section.data?.company?.nip, "5272443955");
  assert.equal(result.section.data?.company?.address, null);
  assert.equal(result.section.data?.company?.activityStatus, null);
  assert.deepEqual(result.section.data?.queriedRegisters, ["Regon"]);
  assert.equal(result.section.data?.screenedLists?.[0].matched, false);
  assert.equal(result.section.data?.relatedPersonsCount, 1);
  assert.equal(result.section.data?.riskLevel, null);
  assert.ok(!JSON.stringify(result.section).includes("PRIVATE PERSON"));
  assert.ok(!JSON.stringify(result.section).includes("12345678901"));
  assert.ok(!JSON.stringify(result.section).includes("private provider message"));
});

test("rejects a report for another company before it can be persisted", async () => {
  let call = 0;
  const fetcher = (async () => ++call === 1 ? response(["correlation123"]) : response([{
    Header: { CorrelationId: "correlation123" },
    Body: { IsComplete: true, Entity: { Ids: [{ Type: "KRS", Value: "0000000000" }] } },
  }])) as typeof fetch;
  const result = await fetchVerclyKys(request, { apiKey: "test-token", baseUrl: "https://vercly.example", fetcher });
  assert.equal(result.section.status, "ERROR");
  assert.equal(result.errorCode, "IDENTIFIER_MISMATCH");
  assert.equal(result.section.data, null);
});

test("maps a checksum-valid NIP without mistaking it for KRS", async () => {
  let call = 0;
  const fetcher = (async () => ++call === 1 ? response(["correlation123"]) : response([{
    Header: { CorrelationId: "correlation123" },
    Body: { IsComplete: true, Entity: { Ids: [
      { Type: "KRS", Value: "0000217580" }, { Type: "VatID", Value: "PL5272443955" },
    ] } },
  }])) as typeof fetch;
  const result = await fetchVerclyKys({ ...request, identifier: { type: "NIP", value: "5272443955" } },
    { apiKey: "test-token", baseUrl: "https://vercly.example", fetcher });
  assert.equal(result.section.status, "SUCCESS");
  assert.equal(result.section.data?.company?.krs, "0000217580");
  assert.equal(result.section.data?.company?.nip, "5272443955");
});

test("NIP requests use Id while KRS requests use RegisterId", async () => {
  const calls: RequestInit[] = [];
  const fetcher = (async (_url: string | URL | Request, init?: RequestInit) => {
    calls.push(init ?? {});
    return calls.length === 1 ? response(["correlation123"]) : response([{
      Header: { CorrelationId: "correlation123" },
      Body: { IsComplete: true, Entity: { Ids: [{ Type: "KRS", Value: "0000217580" }, { Type: "ID", Value: "5272443955" }] } },
    }]);
  }) as typeof fetch;
  const result = await fetchVerclyKys({ ...request, identifier: { type: "NIP", value: "5272443955" } },
    { apiKey: "test-token", baseUrl: "https://vercly.example", fetcher, sleep: async () => {} });
  assert.equal(result.section.status, "SUCCESS");
  const submitted = JSON.parse(String(calls[0].body))[0];
  assert.equal(submitted.Id, "5272443955");
  assert.equal(submitted.RegisterId, undefined);
});

test("retries a temporary 404 until the FULL report is created", async () => {
  let calls = 0;
  const sleeps: number[] = [];
  const fetcher = (async () => {
    calls += 1;
    if (calls === 1) return response(["correlation123"]);
    if (calls <= 3) return response({ error: "not ready" }, 404);
    return response([{ Header: { CorrelationId: "correlation123" }, Body: {
      IsComplete: true, Entity: { Ids: [{ Type: "KRS", Value: "0000217580" }] },
    } }]);
  }) as typeof fetch;
  const result = await fetchVerclyKys(request, { apiKey: "test-token", baseUrl: "https://vercly.example", fetcher,
    sleep: async (ms) => { sleeps.push(ms); }, pollIntervalMs: 2000 });
  assert.equal(result.section.status, "SUCCESS");
  assert.equal(calls, 4);
  assert.deepEqual(sleeps, [2000, 2000, 2000]);
});
