import assert from "node:assert/strict";
import { test } from "node:test";
import type { PoolClient } from "pg";
import { assertOrganizationId, withOrganization, type DatabasePool } from "./db";
import { appendSnapshot } from "./xray-repository";

const organizationId = "4f4c4d66-e135-49ac-a89f-d448e270b667";

function fakePool(databaseName = "srm_app", role = { bypass_rls: false, superuser: false, neon_superuser_member: false }) {
  const calls: Array<{ sql: string; parameters?: unknown[] }> = [];
  let released = false;
  const client = {
    async query(sql: string, parameters?: unknown[]) {
      calls.push({ sql, parameters });
      if (sql.includes("current_database")) return { rows: [{ database_name: databaseName, ...role }] };
      return { rows: [], rowCount: 1 };
    },
    release() { released = true; },
  } as unknown as PoolClient;
  const pool = { async connect() { return client; } } as DatabasePool;
  return { pool, calls, wasReleased: () => released };
}

test("transaction binds the organization before a product query and releases it", async () => {
  const fake = fakePool();
  const result = await withOrganization(organizationId, async (client) => {
    await client.query("SELECT 42");
    return 42;
  }, fake.pool);
  assert.equal(result, 42);
  assert.deepEqual(fake.calls.map((call) => call.sql), [
    "BEGIN", fake.calls[1].sql,
    "SELECT set_config('srm.organization_id', $1, true)", "SELECT 42", "COMMIT",
  ]);
  assert.match(fake.calls[1].sql, /rolbypassrls/);
  assert.deepEqual(fake.calls[2].parameters, [organizationId]);
  assert.equal(fake.wasReleased(), true);
});

test("wrong database rolls back before any product query", async () => {
  const fake = fakePool("srm_pmos");
  await assert.rejects(withOrganization(organizationId, async () => 1, fake.pool), /identity mismatch/);
  assert.deepEqual(fake.calls.map((call) => call.sql), ["BEGIN", fake.calls[1].sql, "ROLLBACK"]);
  assert.equal(fake.wasReleased(), true);
});

test("role that bypasses RLS is rejected before any product query", async () => {
  const fake = fakePool("srm_app", { bypass_rls: true, superuser: false, neon_superuser_member: false });
  await assert.rejects(withOrganization(organizationId, async () => 1, fake.pool), /enforce row-level security/);
  assert.deepEqual(fake.calls.map((call) => call.sql), ["BEGIN", fake.calls[1].sql, "ROLLBACK"]);
  assert.equal(fake.wasReleased(), true);
});
test("neon_superuser membership is rejected", async () => {
  const fake = fakePool("srm_app", { bypass_rls: false, superuser: false, neon_superuser_member: true });
  await assert.rejects(withOrganization(organizationId, async () => 1, fake.pool), /enforce row-level security/);
  assert.equal(fake.calls.at(-1)?.sql, "ROLLBACK");
});
test("failed product query rolls back and releases connection", async () => {
  const fake = fakePool();
  await assert.rejects(withOrganization(organizationId, async () => { throw new Error("write failed"); }, fake.pool), /write failed/);
  assert.equal(fake.calls.at(-1)?.sql, "ROLLBACK");
  assert.equal(fake.wasReleased(), true);
});

test("invalid organization identity is rejected before connecting", () => {
  assert.throws(() => assertOrganizationId("not-a-uuid"), /valid organization UUID/);
});

test("KYS payload must use a classified snapshot", async () => {
  await assert.rejects(appendSnapshot(organizationId, {
    attemptId: organizationId,
    supplierId: organizationId,
    section: "kys",
    dataClass: "COMPANY",
    payload: { name: "Example" },
    retrievedAt: new Date(),
  }), /classified/);
});

test("personal KYS snapshots require a seven-day retention bound before connecting", async () => {
  const now = new Date("2026-10-07T12:00:00Z");
  const base = { attemptId: organizationId, supplierId: organizationId, section: "kys" as const,
    dataClass: "KYS_PERSONAL" as const, payload: { relatedPersons: [{ pesel: "12345678901" }] }, retrievedAt: now };
  await assert.rejects(appendSnapshot(organizationId, base), /seven days/);
  await assert.rejects(appendSnapshot(organizationId, { ...base, retentionUntil: new Date("2026-10-15T12:00:00Z") }), /seven days/);
});
