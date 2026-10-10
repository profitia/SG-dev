import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { assertOrganizationId, withOrganization, type DatabasePool } from "./db";
import { appendSnapshot, createLookup } from "./xray-repository";
import { lookupRequestId, withLookupDiagnostics } from "./lookup-diagnostics";
import { searchRegistryByNip } from "./registry-search";
import { emptyCard } from "../demo/fixture";
import type { JdgRegistryData, SectionEnvelope } from "@profitia/srm-xray";

const organizationId = "4f4c4d66-e135-49ac-a89f-d448e270b667";

type RegisteredLookup = { id: string; organizationId: unknown; identifier: unknown; entityType: unknown };

function fakePool(databaseName = "srm_app", role = { bypass_rls: false, superuser: false, neon_superuser_member: false }, registrations?: RegisteredLookup[]) {
  const calls: Array<{ sql: string; parameters?: unknown[] }> = [];
  let released = false;
  const client = {
    async query(sql: string, parameters?: unknown[]) {
      calls.push({ sql, parameters });
      if (sql.includes("current_database")) return { rows: [{ database_name: databaseName, ...role }] };
      if (sql.includes("FROM srm.organizations")) return { rows: [{ id: organizationId }], rowCount: 1 };
      if (registrations && sql.startsWith("INSERT INTO srm.suppliers")) return { rows: [{ id: organizationId }], rowCount: 1 };
      if (registrations && sql.startsWith("INSERT INTO srm.lookup_requests")) {
        // Model the database-generated UUID and tenant primary key, including the old explicit-ID path.
        const id = typeof parameters?.[5] === "string" ? parameters[5] : randomUUID();
        if (registrations.some((row) => row.organizationId === parameters?.[0] && row.id === id)) {
          throw Object.assign(new Error("Duplicate lookup registration"), { code: "23505" });
        }
        registrations.push({ id, organizationId: parameters?.[0], identifier: parameters?.[3], entityType: parameters?.[4] });
        return { rows: [{ id }], rowCount: 1 };
      }
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
    "SELECT set_config('srm.organization_id', $1, true)", "SELECT id FROM srm.organizations WHERE id = $1", "SELECT 42", "COMMIT",
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


const identifier = { type: "NIP" as const, value: "7972088368" };
function registrySection(status: "EMPTY" | "ERROR" | "SUCCESS"): SectionEnvelope<JdgRegistryData> {
  return { status, source: { provider: "CEIDG", model: "firma", recordId: null }, retrievedAt: null,
    effectiveAt: null, warnings: [], data: status === "SUCCESS" ? { entries: [{ recordId: "fixture", name: "Fixture JDG",
      status: "Aktywny", nip: identifier.value, regon: null, fields: [] }] } : null };
}
function companyCard() {
  return { ...emptyCard, identity: { krs: null, nip: identifier.value, name: "Fixture company" },
    general: { ...emptyCard.general, status: "SUCCESS" as const, data: { legalName: "Fixture company", legalForm: null,
      krs: null, nip: identifier.value, regon: null, registeredAddress: null, registeredAt: null, mainPkd: null } } };
}

for (const status of ["EMPTY", "ERROR"] as const) {
  test("CEIDG " + status + " registers company fallback separately within one HTTP diagnostic context", async () => {
    const registrations: RegisteredLookup[] = [];
    const fake = fakePool("srm_app", undefined, registrations);
    await withLookupDiagnostics(async () => {
      const correlationId = lookupRequestId();
      const result = await searchRegistryByNip(organizationId, { identifier }, {
        jdg: async () => { await createLookup(organizationId, identifier, "JDG", fake.pool); return registrySection(status); },
        company: async () => { await createLookup(organizationId, identifier, "COMPANY", fake.pool); return companyCard(); },
      });
      assert.equal(result.entityType, "COMPANY");
      assert.equal(lookupRequestId(), correlationId);
      assert.deepEqual(registrations.map((row) => row.entityType), ["JDG", "COMPANY"]);
      assert.equal(new Set(registrations.map((row) => row.id)).size, 2);
      assert.equal(registrations.every((row) => row.id !== correlationId && row.organizationId === organizationId && row.identifier === identifier.value), true);
    });
  });
}

test("fresh company catalog and successful JDG preserve their single-registration paths", async () => {
  for (const catalog of [true, false]) {
    const registrations: RegisteredLookup[] = [];
    const fake = fakePool("srm_app", undefined, registrations);
    await withLookupDiagnostics(async () => {
      const correlationId = lookupRequestId();
      const result = await searchRegistryByNip(organizationId, { identifier }, {
        catalog: async () => catalog,
        jdg: async () => { assert.equal(catalog, false); await createLookup(organizationId, identifier, "JDG", fake.pool); return registrySection("SUCCESS"); },
        company: async () => { assert.equal(catalog, true); await createLookup(organizationId, identifier, "COMPANY", fake.pool); return companyCard(); },
      });
      assert.equal(result.entityType, catalog ? "COMPANY" : "JDG");
      assert.equal(registrations.length, 1);
      assert.equal(registrations[0].entityType, result.entityType);
      assert.notEqual(registrations[0].id, correlationId);
      assert.equal(lookupRequestId(), correlationId);
    });
  }
});

test("parallel registrations remain unique while HTTP correlations stay isolated", async () => {
  const registrations: RegisteredLookup[] = [];
  const fake = fakePool("srm_app", undefined, registrations);
  const correlations = await Promise.all([0, 1].map(() => withLookupDiagnostics(async () => {
    const correlationId = lookupRequestId();
    const results = await Promise.all(Array.from({ length: 4 }, () => createLookup(organizationId, identifier, "COMPANY", fake.pool)));
    assert.equal(new Set(results.map((row) => row.requestId)).size, 4);
    assert.equal(results.every((row) => row.requestId !== correlationId), true);
    assert.equal(lookupRequestId(), correlationId);
    return correlationId;
  })));
  assert.equal(new Set(correlations).size, 2);
  assert.equal(new Set(registrations.map((row) => row.id)).size, 8);
});
