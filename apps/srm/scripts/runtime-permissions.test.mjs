import assert from "node:assert/strict";
import test from "node:test";
import { assertPermissionDestination, reconcileOrganizationPermissions } from "./runtime-permissions.mjs";
const env = { TARGET_ENVIRONMENT: "development", SRM_NEON_PROJECT_ID: "snowy-breeze-40315151", SRM_NEON_BRANCH_ID: "br-dark-surf-b1vrhda9",
  SRM_APP_DIRECT_URL: "postgresql://neondb_owner:isolated-test@ep-red-smoke-b16ih64d.c-5.eu-central-1.aws.neon.tech/srm_app?sslmode=require",
  SRM_APPROVED_SHA: "a".repeat(40), SRM_LIVE_SHA: "a".repeat(40) };
test("permission command accepts only verified Development migration identity", () => assert.doesNotThrow(() => assertPermissionDestination(env)));
for (const [key, value] of [["TARGET_ENVIRONMENT","staging"],["TARGET_ENVIRONMENT","production"],["SRM_NEON_PROJECT_ID","bold-breeze-68888550"],["SRM_NEON_BRANCH_ID","br-broad-butterfly-b11t4v01"],["SRM_LIVE_SHA","b".repeat(40)]]) {
  test("permission command rejects " + key + "=" + value, () => assert.throws(() => assertPermissionDestination({ ...env, [key]: value })));
}
for (const connection of [env.SRM_APP_DIRECT_URL.replace("neondb_owner", "srm_app_runtime"), env.SRM_APP_DIRECT_URL.replace("/srm_app", "/srm_pmos"), env.SRM_APP_DIRECT_URL.replace("ep-red-smoke-b16ih64d.", "ep-red-smoke-b16ih64d-pooler."), env.SRM_APP_DIRECT_URL + "&options=-c%20role=other", env.SRM_APP_DIRECT_URL + "&sslmode=disable"]) {
  test("permission command rejects foreign or ambiguous connection", () => assert.throws(() => assertPermissionDestination({ ...env, SRM_APP_DIRECT_URL: connection })));
}
test("permission verification failure rolls back without granting privileges", async () => {
  const calls = [];
  const client = { async query(sql) { calls.push(sql); return { rows: sql.includes("current_database") ? [{ database: "srm_app", role: "neondb_owner" }] : [{ can_read: true, can_mutate: true }] }; } };
  await assert.rejects(reconcileOrganizationPermissions(client), /least privilege/);
  assert.equal(calls.at(-1), "ROLLBACK");
  assert.equal(calls.some(sql => sql.startsWith("GRANT")), false);
});
