import assert from "node:assert/strict";
import test from "node:test";
import { emptyWebIdentity, supplierWebIdentityHandler } from "./supplier-web-identity";
import { subjectHash, type Claim } from "./supplier-web-store";
import type { Discovery, WebSubject } from "./website-discovery";

const subject: WebSubject = { nip: "5213390341", krs: "0000258512", name: "Example", registryWebsite: null };
const unavailable: Discovery = { ...emptyWebIdentity("UNAVAILABLE") };
const request = (body: unknown = { identifier: subject.nip, entityType: "COMPANY" }) =>
  new Request("https://app.example.com/api/xray/web-identity", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
function setup() {
  const calls: string[] = [];
  const deps = {
    ready: () => true, authorized: async () => true, sameOrigin: () => true, organization: () => "11111111-1111-4111-8111-111111111111",
    subject: async (org: string, nip: string) => { calls.push("subject:" + org + ":" + nip); return subject as WebSubject | null; },
    claim: async (): Promise<Claim> => ({ kind: "CLAIMED", token: "lease-token" }),
    save: async (...args: unknown[]) => { calls.push("save:" + args[0]); },
    discover: async (): Promise<Discovery> => { calls.push("discover"); return unavailable; },
  };
  return { deps, calls };
}
test("authentication, same-origin, environment and valid identity precede enrichment", async () => {
  for (const key of ["ready", "authorized", "sameOrigin"] as const) {
    const { deps, calls } = setup();
    if (key === "authorized") deps.authorized = async () => false; else deps[key] = () => false;
    const response = await supplierWebIdentityHandler(request(), deps);
    assert.ok([401,403,404].includes(response.status)); assert.equal(calls.length, 0);
  }
  const { deps, calls } = setup();
  assert.equal((await supplierWebIdentityHandler(request({ identifier: "5213390340", entityType: "COMPANY", url: "http://localhost" }), deps)).status, 400);
  assert.equal(calls.length, 0);
});
test("no supplier projection in caller organization means no discovery or cache access", async () => {
  const { deps, calls } = setup(); deps.subject = async () => null;
  assert.equal((await supplierWebIdentityHandler(request(), deps)).status, 404);
  assert.equal(calls.length, 0);
});
test("cache and active lease avoid repeated external calls", async () => {
  const { deps, calls } = setup();
  deps.claim = async () => ({ kind: "CACHED", data: emptyWebIdentity("NOT_FOUND") });
  assert.equal((await supplierWebIdentityHandler(request(), deps)).status, 200);
  deps.claim = async () => ({ kind: "PENDING" });
  const response = await supplierWebIdentityHandler(request(), deps);
  assert.equal(response.status, 202); assert.equal((await response.json()).status, "PENDING");
  assert.equal(calls.includes("discover"), false);
});
test("persists under the same tenant; unavailable website never corrupts financial data", async () => {
  const { deps, calls } = setup();
  deps.discover = async () => { throw new Error("private transport detail"); };
  const response = await supplierWebIdentityHandler(request(), deps);
  const body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.status, "UNAVAILABLE");
  assert.equal(JSON.stringify(body).includes("private"), false);
  assert.equal(calls.at(-1), "save:" + deps.organization());
  assert.notEqual(subjectHash(subject), subjectHash({ ...subject, registryWebsite: "https://example.pl/" }));
});

test("isolated Postgres: cache leases, identity invalidation and forced tenant isolation", { skip: !process.env.SRM_MIGRATION_TEST_URL }, async () => {
  const { default: pg } = await import("pg");
  const { readFile, readdir } = await import("node:fs/promises");
  const { readWebSubject, claimWebIdentity, saveWebIdentity } = await import("./supplier-web-store");
  const url = new URL(process.env.SRM_MIGRATION_TEST_URL!);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname) && url.pathname === "/srm_migration_test", "Only isolated localhost migration database is allowed");
  const admin = new pg.Client({ connectionString: url.href }); await admin.connect();
  const createdRoles: string[] = [];
  let owner: InstanceType<typeof pg.Pool> | undefined, runtime: InstanceType<typeof pg.Pool> | undefined;
  let databaseCreated = false;
  try {
    await admin.query("CREATE DATABASE srm_app"); databaseCreated = true;
    for (const role of ["srm_app_runtime", "neon_superuser"]) {
      const existing = await admin.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [role]);
      if (!existing.rowCount) { await admin.query("CREATE ROLE " + role + " NOLOGIN NOSUPERUSER NOBYPASSRLS"); createdRoles.push(role); }
    }
    url.pathname = "/srm_app";
    owner = new pg.Pool({ connectionString: url.href });
    const migrationDir = new URL("../../db/migrations/", import.meta.url);
    for (const file of (await readdir(migrationDir)).filter(file => file.endsWith(".sql")).sort()) {
      await owner.query(await readFile(new URL(file, migrationDir), "utf8"));
    }
    await owner.query("GRANT USAGE ON SCHEMA srm TO srm_app_runtime; GRANT SELECT ON srm.organizations TO srm_app_runtime");
    const orgA = "11111111-1111-4111-8111-111111111111", orgB = "22222222-2222-4222-8222-222222222222";
    await owner.query("INSERT INTO srm.organizations(id,slug) VALUES($1,'test-web-a'),($2,'test-web-b')", [orgA,orgB]);
    await owner.query("INSERT INTO srm.catalog_companies(nip,general_json,general_sha256) VALUES($1,$2,$3)", [subject.nip, JSON.stringify({ data: { legalName: subject.name, nip: subject.nip, krs: subject.krs } }), "a".repeat(64)]);
    await owner.query("INSERT INTO srm.organization_supplier_interest(organization_id,nip) VALUES($1,$2)", [orgA,subject.nip]);
    runtime = new pg.Pool({ connectionString: url.href, options: "-c role=srm_app_runtime", max: 4 });
    assert.equal((await readWebSubject(orgA, subject.nip, "COMPANY", runtime))?.name, subject.name);
    assert.equal(await readWebSubject(orgB, subject.nip, "COMPANY", runtime), null);
    const hash = subjectHash(subject);
    const claims = await Promise.all([claimWebIdentity(orgA,subject.nip,"COMPANY",hash,runtime), claimWebIdentity(orgA,subject.nip,"COMPANY",hash,runtime)]);
    assert.equal(claims.filter(result => result.kind === "CLAIMED").length, 1);
    assert.equal(claims.filter(result => result.kind === "PENDING").length, 1);
    const won = claims.find(result => result.kind === "CLAIMED")!;
    assert.equal(won.kind, "CLAIMED");
    const data = { ...emptyWebIdentity("NOT_FOUND"), checkedAt: new Date().toISOString() };
    await saveWebIdentity(orgA,subject.nip,"COMPANY",hash,won.token,data,runtime);
    assert.equal((await claimWebIdentity(orgA,subject.nip,"COMPANY",hash,runtime)).kind, "CACHED");
    assert.equal((await claimWebIdentity(orgB,subject.nip,"COMPANY",hash,runtime)).kind, "CLAIMED");
    const changedHash = subjectHash({ ...subject, name: "Changed" });
    const changed = await claimWebIdentity(orgA,subject.nip,"COMPANY",changedHash,runtime);
    assert.equal(changed.kind, "CLAIMED");
    // A late writer cannot replace the new identity's pending result.
    await saveWebIdentity(orgA,subject.nip,"COMPANY",hash,won.token,data,runtime);
    assert.equal((await claimWebIdentity(orgA,subject.nip,"COMPANY",changedHash,runtime)).kind, "PENDING");
    const c = await runtime.connect();
    try {
      await c.query("BEGIN"); await c.query("SELECT set_config('srm.organization_id',$1,true)", [orgA]);
      assert.equal((await c.query("SELECT * FROM srm.supplier_web_identity WHERE organization_id=$1", [orgB])).rowCount, 0);
      await assert.rejects(c.query("INSERT INTO srm.supplier_web_identity(organization_id,nip,entity_type,identity_hash) VALUES($1,$2,'COMPANY',$3)", [orgB,"1234567890",hash]), /row-level security/);
      await c.query("ROLLBACK");
      assert.equal((await c.query("SELECT * FROM srm.supplier_web_identity")).rowCount, 0);
    } finally { c.release(); }
  } finally {
    await runtime?.end(); await owner?.end();
    if (databaseCreated) await admin.query("DROP DATABASE srm_app");
    for (const role of createdRoles) await admin.query("DROP ROLE " + role);
    await admin.end();
  }
});
