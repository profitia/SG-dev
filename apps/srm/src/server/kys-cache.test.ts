import assert from "node:assert/strict";
import { test } from "node:test";
import type { SectionEnvelope, VerclyKysData } from "@profitia/srm-xray";
import { getOrFetchKys, isFreshKys, kysCacheTtlMs, kysExpiry } from "./kys-cache";

const orgA = "11111111-1111-4111-8111-111111111111";
const orgB = "22222222-2222-4222-8222-222222222222";
const nip = "5213390341";
const start = new Date("2026-10-08T10:00:00Z");
type Section = SectionEnvelope<VerclyKysData>;
const report = { status: "SUCCESS", source: { provider: "VERCLY", model: "KYS_NIP", recordId: "report-1" },
  retrievedAt: start.toISOString(), effectiveAt: null, data: { company: { nip }, relatedPersons: [{ fullName: "Test Person", pesel: "12345678901" }] },
  warnings: [] } as unknown as Section;

test("seven days by default, exact expiry boundary and safe configurable shortening", () => {
  assert.equal(kysCacheTtlMs({}), 168 * 60 * 60 * 1000);
  assert.equal(kysCacheTtlMs({ SRM_KYS_CACHE_TTL_HOURS: "24" }), 24 * 60 * 60 * 1000);
  assert.throws(() => kysCacheTtlMs({ SRM_KYS_CACHE_TTL_HOURS: "169" }), /1 to 168/);
  assert.throws(() => kysCacheTtlMs({ SRM_KYS_CACHE_TTL_HOURS: "0" }), /1 to 168/);
  const expiry = kysExpiry(start, kysCacheTtlMs({}));
  assert.equal(isFreshKys(start, expiry, new Date(expiry.getTime() - 1), kysCacheTtlMs({})), true);
  assert.equal(isFreshKys(start, expiry, expiry, kysCacheTtlMs({})), false);
  assert.equal(isFreshKys(start, expiry, new Date(start.getTime() + 25 * 60 * 60 * 1000), kysCacheTtlMs({ SRM_KYS_CACHE_TTL_HOURS: "24" })), false);
});

test("E2E simulation: first provider call, repeated same and other organization hits, expiry refresh", async () => {
  let clock = new Date(start);
  let cached: { section: Section; expiry: Date } | null = null;
  let lease: string | null = null;
  let calls = 0;
  const attempts: { org: string; method: string; snapshot: string }[] = [];
  const store = {
    async read(_org: string, _nip: string, _entity: string, now: Date) {
      const entry = cached;
      return entry && isFreshKys(entry.section.retrievedAt, entry.expiry, now) ? entry.section : null;
    },
    async claim() { if (lease) return null; lease = "owner"; return lease; },
    async save(_org: string, _nip: string, _entity: string, owner: string, section: Section) {
      assert.equal(owner, lease); cached = { section, expiry: kysExpiry(section.retrievedAt!) }; lease = null;
    },
    async release() { lease = null; },
  };
  const fetchReport = async () => {
    calls++;
    return { section: { ...report, retrievedAt: clock.toISOString(), source: { ...report.source, recordId: `report-${calls}` } },
      errorCode: null, correlationId: `correlation-${calls}` };
  };
  const persist = (org: string) => async (_section: Section, _error: string | null, _correlation: string | null, method: "PROVIDER" | "CACHE") => {
    const snapshot = `snapshot-${attempts.length + 1}`;
    attempts.push({ org, method, snapshot });
    return snapshot;
  };
  const options = { now: () => clock, store, sleep: async () => {} };
  const first = await getOrFetchKys(orgA, nip, "COMPANY", fetchReport, persist(orgA), options);
  assert.equal(first.retrievalMethod, "PROVIDER");
  clock = new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000);
  const second = await getOrFetchKys(orgA, nip, "COMPANY", fetchReport, persist(orgA), options);
  const third = await getOrFetchKys(orgB, nip, "COMPANY", fetchReport, persist(orgB), options);
  assert.equal(calls, 1);
  assert.deepEqual([second.retrievalMethod, third.retrievalMethod], ["CACHE", "CACHE"]);
  assert.equal(third.section.source.recordId, "report-1");
  assert.notEqual(second.snapshotId, third.snapshotId);
  clock = kysExpiry(start);
  const fourth = await getOrFetchKys(orgB, nip, "COMPANY", fetchReport, persist(orgB), options);
  assert.equal(fourth.retrievalMethod, "PROVIDER");
  assert.equal(calls, 2);
  assert.deepEqual(attempts.map((attempt) => attempt.method), ["PROVIDER", "CACHE", "CACHE", "PROVIDER"]);
});

test("failed and incomplete reports are not cached", async () => {
  let claims = 0;
  let saved = 0;
  const store = {
    async read() { return null; }, async claim() { claims++; return "owner"; },
    async save() { saved++; }, async release() {},
  };
  const result = await getOrFetchKys(orgA, nip, "COMPANY",
    async () => ({ section: { ...report, status: "PARTIAL" as const }, errorCode: null, correlationId: null }),
    async () => null, { now: () => start, store });
  assert.equal(result.section.status, "PARTIAL");
  assert.equal(claims, 1);
  assert.equal(saved, 0);
});
