import assert from "node:assert/strict";
import test from "node:test";
import { fetchVerclyKys } from "./vercly-kys";

const request = {
  identifier: { type: "KRS" as const, value: "0000217580" },
  name: "XTB SPÓŁKA AKCYJNA",
  website: "https://www.xtb.com",
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
      Body: { IsComplete: true, StateAsOfDate: 1791260400722, QueriedRegisters: ["Regon"],
        Errors: [{ Severity: 0, Message: "private provider message" }],
        Entity: { Name: "XTB SPÓŁKA AKCYJNA", Ids: [{ Type: "ID", Value: "0000217580" }],
          Attributes: [{ Name: "Country", Value: "PL" }],
          DepPersons: { Count: 1, Persons: [{ Name: "PRIVATE PERSON", PersonalId: "12345678901" }] },
          Beneficiaries: { Count: 0 }, PepPositions: { Count: 0 },
          Sanctions: [{ ListName: "eu_fsf_sanctions", ListType: "SANCTIONS", Value: false }],
        },
      },
    }]);
  }) as typeof fetch;
  const result = await fetchVerclyKys(request, { apiKey: "test-token", baseUrl: "https://vercly.example", fetcher, sleep: async () => {} });
  assert.equal(calls.length, 3);
  assert.equal(JSON.parse(String(calls[0].init?.body))[0].VerificationType, "FULL");
  assert.equal(calls[0].init?.headers && (calls[0].init.headers as Record<string, string>).Authorization, "Bearer test-token");
  assert.equal(result.section.status, "PARTIAL");
  assert.equal(result.section.data?.company?.krs, request.identifier.value);
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
    Body: { IsComplete: true, Entity: { Ids: [{ Type: "ID", Value: "0000000000" }] } },
  }])) as typeof fetch;
  const result = await fetchVerclyKys(request, { apiKey: "test-token", baseUrl: "https://vercly.example", fetcher });
  assert.equal(result.section.status, "ERROR");
  assert.equal(result.errorCode, "IDENTIFIER_MISMATCH");
  assert.equal(result.section.data, null);
});
