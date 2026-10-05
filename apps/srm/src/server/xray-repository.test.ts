import assert from "node:assert/strict";
import { test } from "node:test";
import type { PoolClient } from "pg";
import { assertOrganizationId, withOrganization, type DatabasePool } from "./db";
import { appendSnapshot } from "./xray-repository";

const organizationId = "4f4c4d66-e135-49ac-a89f-d448e270b667";

function fakePool(databaseName = "srm_app") {
  const calls: Array<{ sql: string; parameters?: unknown[] }> = [];
  let released = false;
  const client = {
    async query(sql: string, parameters?: unknown[]) {
      calls.push({ sql, parameters });
      if (sql.includes("current_database")) return { rows: [{ database_name: databaseName }] };
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
    "BEGIN", "SELECT current_database() AS database_name",
    "SELECT set_config('srm.organization_id', $1, true)", "SELECT 42", "COMMIT",
  ]);
  assert.deepEqual(fake.calls[2].parameters, [organizationId]);
  assert.equal(fake.wasReleased(), true);
});

test("wrong database rolls back before any product query", async () => {
  const fake = fakePool("srm_pmos");
  await assert.rejects(withOrganization(organizationId, async () => 1, fake.pool), /identity mismatch/);
  assert.deepEqual(fake.calls.map((call) => call.sql), ["BEGIN", "SELECT current_database() AS database_name", "ROLLBACK"]);
  assert.equal(fake.wasReleased(), true);
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

test("KYS raw payload cannot be saved without redaction", async () => {
  await assert.rejects(appendSnapshot(organizationId, {
    attemptId: organizationId,
    supplierId: organizationId,
    section: "kys",
    dataClass: "COMPANY",
    payload: { name: "Example" },
    retrievedAt: new Date(),
  }), /redacted/);
});
