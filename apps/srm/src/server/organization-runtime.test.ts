import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";
import { withOrganization, type DatabasePool } from "./db";
import { sanitizedLookupFailure } from "./lookup-diagnostics";

test("missing provisioned organization stops before any business action and releases the transaction", async () => {
  const calls: string[] = []; let executed = false; let released = false;
  const pool = { async connect() { return { async query(sql: string) { calls.push(sql); return { rows: sql.includes("current_database") ? [{ database_name: "srm_app", bypass_rls: false, superuser: false, neon_superuser_member: false }] : [] }; }, release() { released = true; } } as unknown as PoolClient; } } as DatabasePool;
  await assert.rejects(withOrganization("00000000-0000-4000-8000-000000000008", async () => { executed = true; }, pool), error => sanitizedLookupFailure(error).stage === "organization_context");
  assert.equal(executed, false); assert.equal(released, true); assert.equal(calls.at(-1), "ROLLBACK"); assert.ok(!calls.some(sql => /INSERT INTO srm.organizations/.test(sql)));
});

test("configured environment organization mismatch fails before connecting", async () => {
  const original = process.env.TARGET_ENVIRONMENT; const id = process.env.SRM_DEVELOPMENT_ORGANIZATION_ID;
  let connected = false;
  process.env.TARGET_ENVIRONMENT = "development"; process.env.SRM_DEVELOPMENT_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000008";
  try {
    await assert.rejects(withOrganization("00000000-0000-4000-8000-000000000009", async () => 1, { async connect() { connected = true; throw new Error("must not connect"); } }), /identity mismatch/);
    assert.equal(connected, false);
  } finally {
    if (original === undefined) delete process.env.TARGET_ENVIRONMENT; else process.env.TARGET_ENVIRONMENT = original;
    if (id === undefined) delete process.env.SRM_DEVELOPMENT_ORGANIZATION_ID; else process.env.SRM_DEVELOPMENT_ORGANIZATION_ID = id;
  }
});
