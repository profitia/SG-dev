import assert from "node:assert/strict";
import test from "node:test";
import { kysPdfDocument, kysPdfCoverage, type VerclyKysData } from "@profitia/srm-xray";
import { authorizeStoredKys, kysExportRef, KYS_PDF_SQL, readStoredKysPdf, type StoredKysPdf } from "./kys-pdf-access";
import { kysPdfHandler, renderKysPdf, validateKysPdfSelection } from "./kys-pdf";
import { createDemoSession } from "./demo-auth";
import type { DatabasePool } from "./db";

const env = { TARGET_ENVIRONMENT: "development", SRM_DEMO_PASSWORD: "test-password-with-more-than-16", SRM_DEMO_SESSION_SECRET: "synthetic-session-secret-more-than-32-characters", SRM_DEVELOPMENT_ORGANIZATION_ID: "00000000-0000-4000-8000-000000000001" };
const nip = "8650004194", org = env.SRM_DEVELOPMENT_ORGANIZATION_ID, now = new Date("2026-10-08T12:00:00.000Z");
const person = { fullName: "Osoba syntetyczna Żółć Łęcka", pesel: "01234567890", peselRevealToken: "PRIVATE_REVEAL_TOKEN",
  birthDate: "1980-01-02", positions: ["Prezes", "Członek zarządu"], citizenship: ["PL"], foundIn: ["KRS"], sanctionsMatch: null, pepMatch: true };
export const syntheticKys: VerclyKysData = { correlationId: "SYNTHETIC_QUERY", reportId: "SYNTHETIC_REPORT", isComplete: true,
  queriedRegisters: ["KRAJOWY REJESTR ZADŁUŻONYCH"], stateAsOf: "2026-10-07", company: { name: "Żółta Łąka — dane syntetyczne", nip, krs: "0000000001", regon: null,
    legalForm: "LLC", address: "Zażółć gęślą jaźń 1", country: "PL", activityStatus: "ACTIVE", registeredAt: "2000-01-01", lastChangedAt: null, mainPkd: "70.22.Z", shareCapital: "5000", representation: "Reprezentacja syntetyczna" },
  registryChecks: { krzListed: false, vatActive: true, euVat: null }, screenedLists: [{ name: "eu_sanctions", type: "SANCTIONS", matched: false }],
  relatedPersons: [person], beneficialOwners: [person], relatedPersonsCount: 1, beneficialOwnersCount: 1,
  pepMatches: [{ personGroup: "beneficialOwners", personIndex: 0, personName: person.fullName, searchPhrase: "01234567890", matchedName: "Dopasowanie syntetyczne",
    aliases: ["Alias 1", "Alias 2"], birthDate: "1980-01-02", positions: ["Funkcja syntetyczna"], probabilityPercent: 85, identifierMatchesPesel: true }],
  relatedEntities: [{ name: "Relacja syntetyczna", role: "SHAREHOLDER", krs: null, nip: null, regon: null, relationshipStart: "2020-01-01", relationshipEnd: null, stakeDescription: "10 udziałów", sanctionsMatch: true }] };
function row(): StoredKysPdf { return { snapshotId: "00000000-0000-4000-8000-000000000099", projectionVersion: 2, projectionHash: "hash-one", dataClass: "KYS_PERSONAL",
  retrievedAt: "2026-10-08T11:00:00.000Z", retentionUntil: "2026-10-15T11:00:00.000Z", attemptStatus: "SUCCESS", data: structuredClone(syntheticKys), warnings: [], completionConfirmed: true }; }
function selection(r = row(), entityType: "COMPANY" | "JDG" = "COMPANY") { return { nip, entityType, retrievedAt: new Date(r.retrievedAt!).toISOString(), exportRef: kysExportRef(org, { nip, entityType }, r, env.SRM_DEMO_SESSION_SECRET)! }; }
async function request(input: unknown = selection(), session = true, origin = "https://srm.example") {
  return new Request("https://srm.example/api/xray/kys/pdf", { method: "POST", headers: { origin, cookie: session ? `srm_demo_session=${await createDemoSession(env.SRM_DEMO_SESSION_SECRET)}` : "" }, body: JSON.stringify(input) });
}
function document(data = syntheticKys, entityType: "COMPANY" | "JDG" = "COMPANY") { return kysPdfDocument(data, { nip, entityType, retrievedAt: row().retrievedAt as string,
  generatedAt: now.toISOString(), expiresAt: row().retentionUntil as string, partial: !data.isComplete, warnings: [] }); }

test("complete UI-to-PDF projection retains every field group and record with default PESEL masking", () => {
  const d = document(); assert.equal(kysPdfCoverage.length, 8); assert.equal(d.sections.length, 9);
  for (const id of ["identity", "registry", "lists", "people", "beneficiaries", "pep", "relations", "metadata", "limitations"]) assert(d.sections.some(s => s.id === id));
  const json = JSON.stringify(d); assert(!json.includes("PRIVATE_REVEAL_TOKEN"));
  const people = d.sections.find(s => s.id === "people")!, beneficiaries = d.sections.find(s => s.id === "beneficiaries")!;
  assert(people.records[0].fields.some(([l, v]) => l === "PESEL" && v.includes("***********")));
  assert(people.records[0].fields.some(([l]) => l === "Data urodzenia")); assert(!beneficiaries.records[0].fields.some(([l]) => l === "Data urodzenia"));
  assert(!document(syntheticKys, "JDG").sections.some(s => s.id === "relations"));
  assert(!document(syntheticKys, "JDG").sections.find(s => s.id === "identity")!.records[0].fields.some(([l]) => l === "KRS"));
  const many = structuredClone(syntheticKys); many.relatedPersons = Array.from({ length: 131 }, (_, i) => ({ ...person, fullName: `Osoba ${i}` }));
  assert.equal(document(many).sections.find(s => s.id === "people")!.records.length, 131);
});
test("null/empty/partial results do not imply a completed negative check, safe warnings only", () => {
  const d = document({ ...syntheticKys, isComplete: false, pepMatches: [], screenedLists: [], registryChecks: { krzListed: null, vatActive: null, euVat: null } });
  assert.equal(d.sections[0].records[0].title, "Raport częściowy");
  assert(d.sections.find(s => s.id === "registry")!.records[0].fields.some(([l,v]) => l.includes("VAT") && v === "Nie ustalono"));
  assert.equal(d.sections.find(s => s.id === "lists")!.records.length, 0);
});
test("opaque version binds organization, supplier, entity, projection, class and acquisition; no fallback", () => {
  const r = row(), s = selection(r);
  authorizeStoredKys(r, org, s, now, env);
  for (const changed of [{ ...r, snapshotId: "other" }, { ...r, projectionVersion: 3 }, { ...r, projectionHash: "changed" }, { ...r, dataClass: "FINANCIAL" }])
    assert.throws(() => authorizeStoredKys(changed, org, s, now, env));
  assert.throws(() => authorizeStoredKys(r, "00000000-0000-4000-8000-000000000002", s, now, env));
  assert.throws(() => authorizeStoredKys(r, org, { ...s, entityType: "JDG" }, now, env));
  assert.throws(() => authorizeStoredKys(r, org, { ...s, nip: "5272443955" }, now, env));
  assert.throws(() => authorizeStoredKys(r, org, { ...s, exportRef: "0".repeat(64) }, now, env));
  assert.throws(() => authorizeStoredKys(r, org, { ...s, retrievedAt: "2026-10-08T10:00:00.000Z" }, now, env));
  assert.throws(() => authorizeStoredKys(null, org, s, now, env));
  for (const status of ["ERROR", "PENDING", "NO_DATA"]) assert.throws(() => authorizeStoredKys({ ...r, attemptStatus: status }, org, s, now, env));
});
test("cache/retention strict boundary, future acquisition, shortened existing TTL and unconfigured key fail closed", () => {
  const r = row(), s = selection(r);
  for (const clock of [new Date("2026-10-15T11:00:00Z"), new Date("2026-10-08T10:00:00Z")]) assert.throws(() => authorizeStoredKys(r, org, s, clock, env));
  assert.throws(() => authorizeStoredKys({ ...r, retentionUntil: now.toISOString() }, org, s, now, env));
  assert.throws(() => authorizeStoredKys(r, org, s, now, { ...env, SRM_KYS_CACHE_TTL_HOURS: "1" }));
  assert.throws(() => authorizeStoredKys(r, org, s, now, { ...env, SRM_DEMO_SESSION_SECRET: "short" }));
});
test("strict selection rejects browser payload/org, invalid NIP/entity/ref and oversized dates", () => {
  assert.deepEqual(validateKysPdfSelection(selection()), selection());
  for (const input of [null, { ...selection(), nip: "0000000000" }, { ...selection(), entityType: "other" }, { ...selection(), data: syntheticKys },
    { ...selection(), organizationId: org }, { ...selection(), retrievedAt: "2026-10-08" }, { ...selection(), exportRef: "PRIVATE_ID" }]) assert.throws(() => validateKysPdfSelection(input));
});
test("HTTP authorization, origin, failure copy, no report and partial policy; no private logs or payload echo", async () => {
  let reads = 0, renders = 0;
  const read = async () => { reads++; return row(); }, render = async () => { renders++; return Buffer.from("%PDF-test"); };
  const handler = kysPdfHandler(read, render, env, () => now);
  assert.equal((await handler(await request(selection(), false))).status, 401);
  assert.equal((await handler(await request(selection(), true, "https://foreign.example"))).status, 403);
  assert.equal((await handler(await request({ ...selection(), payload: syntheticKys }))).status, 400);
  assert.equal(reads, 0); assert.equal(renders, 0);
  const result = await handler(await request()); assert.equal(result.status, 200); assert.equal(result.headers.get("content-type"), "application/pdf");
  assert.match(result.headers.get("cache-control")!, /private, no-store/); assert.match(result.headers.get("content-disposition")!, /^attachment; filename="KYS_8650004194_2026-10-08.pdf"$/);
  assert.equal(reads, 2); assert.equal(renders, 1);
  assert.equal((await kysPdfHandler(async () => null, render, env, () => now)(await request())).status, 404);
  assert.equal((await kysPdfHandler(async () => ({ ...row(), retentionUntil: now.toISOString() }), render, env, () => now)(await request())).status, 410);
  const failure = await kysPdfHandler(async () => { throw new Error("PRIVATE_PERSON_TOKEN"); }, render, env, () => now)(await request());
  assert.equal(failure.status, 503); assert(!JSON.stringify(await failure.json()).includes("PRIVATE_PERSON_TOKEN"));
  const partial = row(); partial.data!.isComplete = false; partial.attemptStatus = "PARTIAL"; partial.completionConfirmed = false;
  assert.equal((await kysPdfHandler(async () => partial, render, env, () => now)(await request(selection(partial)))).status, 200);
  assert.equal((await kysPdfHandler(read, render, { ...env, TARGET_ENVIRONMENT: "production" }, () => now)(await request())).status, 404);
});
test("concurrent refresh/deletion/expiry before bytes are sent rejects export, repeated reads never renew data", async () => {
  for (const second of [null, { ...row(), projectionHash: "refreshed" }]) {
    let n = 0; const handler = kysPdfHandler(async () => ++n === 1 ? row() : second, async () => Buffer.from("%PDF-test"), env, () => now);
    assert.notEqual((await handler(await request())).status, 200);
  }
  let tick = 0; const r = row(), before = JSON.stringify(r);
  const expiry = kysPdfHandler(async () => r, async () => Buffer.from("%PDF-test"), env, () => ++tick === 1 ? now : new Date(r.retentionUntil!));
  assert.equal((await expiry(await request())).status, 410); assert.equal(JSON.stringify(r), before);
});
test("SQL uses organization context plus latest attempt/normalized projection only, no supplier write or provider", async () => {
  const queries: string[] = [];
  const pool = { connect: async () => ({ query: async (sql: string, parameters?: unknown[]) => {
    queries.push(sql);
    if (sql.includes("current_database")) return { rows: [{ database_name: "srm_app", role_name: "srm_runtime", bypass_rls: false, superuser: false, neon_superuser_member: false }] };
    if (sql === KYS_PDF_SQL) { assert.deepEqual(parameters, [org, nip, "COMPANY"]); return { rows: [row()] }; }
    return { rows: [] };
  }, release() {} }) } as unknown as DatabasePool;
  // Exact existing runtime identity names are checked in db.ts.
  try { await readStoredKysPdf(org, selection(), pool); } catch (e) { if (!queries.includes(KYS_PDF_SQL)) throw e; }
  assert(queries.includes(KYS_PDF_SQL)); assert(!/\b(?:INSERT|UPDATE|DELETE)\b/i.test(KYS_PDF_SQL));
  assert(!KYS_PDF_SQL.includes("payload_json")); assert(KYS_PDF_SQL.includes("l.organization_id=$1"));
});
test("actual PDF has embedded fonts, A4, all long records and safe metadata; huge document refuses without truncation", async () => {
  const d = document(); const pdf = await renderKysPdf(d);
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-"); assert(pdf.length > 10000); assert(pdf.includes(Buffer.from("/FontFile2")));
  assert(pdf.includes(Buffer.from("/MediaBox [0 0 595.28 841.89]"))); assert(!pdf.includes(Buffer.from("PRIVATE_REVEAL_TOKEN")));
  assert(!pdf.includes(Buffer.from("01234567890")));
  await assert.rejects(renderKysPdf({ ...d, companyName: "x".repeat(9 * 1024 * 1024) }), /limit/);
});
