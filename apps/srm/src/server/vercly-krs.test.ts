import assert from "node:assert/strict";
import test from "node:test";
import type { VerclyKysData } from "@profitia/srm-xray";
import { kysExportRef, type StoredKysPdf } from "./kys-pdf-access";
import { createDemoSession } from "./demo-auth";
import { verclyKrsHandler } from "./vercly-krs";

const nip = "8650004194", organizationId = "00000000-0000-4000-8000-000000000001";
const now = new Date("2026-10-13T12:00:00.000Z");
const env = { TARGET_ENVIRONMENT: "development", SRM_DEMO_PASSWORD: "synthetic-password-more-than-16",
  SRM_DEMO_SESSION_SECRET: "synthetic-session-secret-more-than-32-characters",
  SRM_DEVELOPMENT_ORGANIZATION_ID: organizationId, VERCLY_API_KEY: "synthetic-provider-key", VERCLY_API_BASE_URL: "https://vercly.example" };
const data: VerclyKysData = { correlationId: "3KKnSUBh9XtT1PsVy4DXabPp3oh", reportId: "synthetic-report", isComplete: true,
  queriedRegisters: ["KRS"], stateAsOf: "2026-10-13", company: { name: "Spółka syntetyczna", nip, krs: "0000123456", regon: "140566233",
    phone: null, legalForm: null, address: null, country: "PL", activityStatus: "ACTIVE", registeredAt: null,
    lastChangedAt: null, mainPkd: null, shareCapital: null, representation: null },
  registryChecks: { krzListed: null, vatActive: null, euVat: null }, screenedLists: [], relatedPersons: [], beneficialOwners: [], relatedPersonsCount: 0,
  beneficialOwnersCount: 0, pepMatches: [], relatedEntities: [] };
function row(): StoredKysPdf { return { snapshotId: "00000000-0000-4000-8000-000000000099", projectionVersion: 2,
  projectionHash: "synthetic-hash", dataClass: "KYS_PERSONAL", retrievedAt: "2026-10-13T11:00:00.000Z",
  retentionUntil: "2026-10-20T11:00:00.000Z", attemptStatus: "SUCCESS", data: structuredClone(data), warnings: [], completionConfirmed: true }; }
function selection(stored = row()) { return { nip, entityType: "COMPANY" as const, retrievedAt: new Date(stored.retrievedAt!).toISOString(),
  exportRef: kysExportRef(organizationId, { nip, entityType: "COMPANY" }, stored, env.SRM_DEMO_SESSION_SECRET)! }; }
async function request(input: unknown = selection(), authenticated = true, origin = "https://srm.example") {
  return new Request("https://srm.example/api/xray/kys/krs", { method: "POST", headers: { origin,
    cookie: authenticated ? `srm_demo_session=${await createDemoSession(env.SRM_DEMO_SESSION_SECRET)}` : "" }, body: JSON.stringify(input) });
}
const pdf = new TextEncoder().encode("%PDF-1.7\nsynthetic document");

test("authenticated company downloads its KRS PDF directly from the existing verification", async () => {
  let reads = 0, gets = 0;
  const handler = verclyKrsHandler(async (org, candidate) => { reads++; assert.equal(org, organizationId);
    assert.deepEqual(candidate, selection()); return row(); },
  (async (input, init) => { gets++; assert.equal(String(input), "https://vercly.example/api/krs/3KKnSUBh9XtT1PsVy4DXabPp3oh-140566233");
    assert.equal(init?.method, "GET"); assert.equal(init?.redirect, "manual"); assert.equal(init?.cache, "no-store");
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer synthetic-provider-key");
    return new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Length": String(pdf.byteLength) } }); }) as typeof fetch,
  env, () => now);
  const result = await handler(await request());
  assert.equal(result.status, 200); assert.equal(result.headers.get("Content-Type"), "application/pdf");
  assert.match(result.headers.get("Cache-Control")!, /no-store/);
  assert.equal(result.headers.get("X-Download-Filename"), "KRS_8650004194_2026-10-13.pdf");
  assert.deepEqual(new Uint8Array(await result.arrayBuffer()), pdf); assert.equal(reads, 2); assert.equal(gets, 1);
});

test("missing session, foreign origin, altered version and JDG never call provider", async () => {
  let reads = 0, gets = 0;
  const handler = verclyKrsHandler(async () => { reads++; return row(); },
    (async () => { gets++; return new Response(pdf); }) as typeof fetch, env, () => now);
  assert.equal((await handler(await request(selection(), false))).status, 401);
  assert.equal((await handler(await request(selection(), true, "https://other.example"))).status, 403);
  assert.equal((await handler(await request({ ...selection(), entityType: "JDG" }))).status, 400);
  assert.equal((await handler(await request({ ...selection(), exportRef: "0".repeat(64) }))).status, 409);
  assert.equal((await handler(await request({ ...selection(), company: data.company }))).status, 400);
  assert.equal(reads, 1); assert.equal(gets, 0);
});

test("expired, missing or changed KYS projection fails closed", async () => {
  const current = row(); let gets = 0;
  const fetcher = (async () => { gets++; return new Response(pdf, { headers: { "Content-Type": "application/pdf" } }); }) as typeof fetch;
  assert.equal((await verclyKrsHandler(async () => null, fetcher, env, () => now)(await request())).status, 404);
  assert.equal((await verclyKrsHandler(async () => ({ ...current, retentionUntil: now.toISOString() }), fetcher, env, () => now)(await request())).status, 410);
  assert.equal((await verclyKrsHandler(async () => ({ ...current, data: { ...data, company: { ...data.company!, regon: null } } }), fetcher, env, () => now)(await request())).status, 404);
  let reads = 0;
  assert.equal((await verclyKrsHandler(async () => ++reads === 1 ? current : { ...current, projectionHash: "changed" }, fetcher, env, () => now)(await request())).status, 409);
  assert.equal(gets, 1);
});

test("provider redirects, HTML, malformed PDF, failure and oversized document are never exposed as a PDF", async () => {
  const cases = [
    new Response(null, { status: 302, headers: { Location: "https://other.example" } }),
    new Response("<html>private error</html>", { headers: { "Content-Type": "text/html" } }),
    new Response("invalid", { headers: { "Content-Type": "application/pdf" } }),
    new Response(null, { status: 404 }),
    new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Length": String(25 * 1024 * 1024) } }),
  ];
  for (const upstream of cases) {
    const result = await verclyKrsHandler(async () => row(), (async () => upstream) as typeof fetch, env, () => now)(await request());
    assert.notEqual(result.status, 200); assert.notEqual(result.headers.get("Content-Type"), "application/pdf");
    assert(!JSON.stringify(await result.json()).includes("private error"));
  }
});
