import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { withOrganization } from "./db";
import { createLookup } from "./xray-repository";
import { mapMgbiFinancialRecords } from "./mgbi-financial";
import { migrationManifest, runMigrations } from "../../scripts/staging-migrate.mjs";

test("PostgreSQL: forward migration preserves history, accepts reconciled COGS, rejects false magnitude and enforces tenant isolation with SELECT-only organization access", { skip: !process.env.SRM_MIGRATION_TEST_URL }, async () => {
  const base = new URL(process.env.SRM_MIGRATION_TEST_URL!);
  assert.ok(["localhost", "127.0.0.1"].includes(base.hostname) && base.pathname === "/srm_migration_test", "Only the isolated local migration test database is allowed");
  const admin = new pg.Client({ connectionString: base.toString() });
  await admin.connect();
  const database = new URL(base); database.pathname = "/srm_app";
  const owner = new pg.Client({ connectionString: database.toString() });
  let created = false; let runtimeCreated = false; let neonCreated = false;
  const organizationId = "00000000-0000-4000-8000-000000000008";
  const foreignId = "00000000-0000-4000-8000-000000000009";
  const runtimeUrl = new URL(database); runtimeUrl.username = "srm_app_runtime"; runtimeUrl.password = "isolated-local-only-password-at-least-32";
  const pool = new pg.Pool({ connectionString: runtimeUrl.toString(), max: 1 });
  try {
    assert.equal((await admin.query("SELECT count(*)::int AS n FROM pg_database WHERE datname='srm_app'")).rows[0].n, 0, "Never adopt or erase an existing database");
    await admin.query("CREATE DATABASE srm_app"); created = true;
    if (!(await admin.query("SELECT 1 FROM pg_roles WHERE rolname='neon_superuser'")).rows.length) {
      await admin.query("CREATE ROLE neon_superuser NOLOGIN"); neonCreated = true;
    }
    await owner.connect();
    const manifest = migrationManifest();
    // Establish the historical ledger first, then apply the new migration.
    if (!(await owner.query("SELECT 1 FROM pg_roles WHERE rolname='srm_app_runtime'")).rows.length) {
      await owner.query("CREATE ROLE srm_app_runtime LOGIN NOSUPERUSER NOBYPASSRLS"); runtimeCreated = true;
    }
    for (const m of manifest.slice(0, -1)) {
      await owner.query(m.sql);
      await owner.query("INSERT INTO srm.schema_migrations(version,checksum_sha256) VALUES($1,$2)", [m.version, m.checksum]);
    }
    const before = (await owner.query("SELECT version,checksum_sha256 FROM srm.schema_migrations ORDER BY version")).rows;
    assert.equal((await runMigrations(owner)).applied.length, 1);
    assert.deepEqual((await owner.query("SELECT version,checksum_sha256 FROM srm.schema_migrations WHERE version<>$1 ORDER BY version", [manifest.at(-1)!.version])).rows, before);
    assert.equal((await runMigrations(owner)).applied.length, 0);
    await owner.query("GRANT USAGE ON SCHEMA srm TO srm_app_runtime");
    await owner.query("GRANT SELECT ON srm.organizations TO srm_app_runtime");
    await owner.query("GRANT SELECT,INSERT,UPDATE ON srm.suppliers,srm.lookup_requests TO srm_app_runtime");
    await owner.query("INSERT INTO srm.organizations(id,slug) VALUES($1,'fixture-a'),($2,'fixture-b')", [organizationId, foreignId]);
    assert.equal((await owner.query("SELECT has_table_privilege('srm_app_runtime','srm.organizations','INSERT') AS can_insert")).rows[0].can_insert, false);
    const company = await createLookup(organizationId, { type: "NIP", value: "1111111111" }, "COMPANY", pool);
    const jdg = await createLookup(organizationId, { type: "NIP", value: "2222222222" }, "JDG", pool);
    const other = await createLookup(foreignId, { type: "NIP", value: "3333333333" }, "COMPANY", pool);
    await withOrganization(organizationId, async client => {
      const requests = await client.query("SELECT organization_id,entity_type FROM srm.lookup_requests ORDER BY entity_type");
      assert.deepEqual(requests.rows.map(row => row.entity_type), ["COMPANY", "JDG"]);
      assert.ok(requests.rows.every(row => row.organization_id === organizationId));
      assert.equal((await client.query("SELECT count(*)::int AS n FROM srm.suppliers WHERE id=$1", [other.supplierId])).rows[0].n, 0);
    }, pool);
    await assert.rejects(createLookup("00000000-0000-4000-8000-000000000099", { type: "NIP", value: "4444444444" }, "COMPANY", pool), /stage failed/);
    assert.equal((await owner.query("SELECT count(*)::int AS n FROM srm.organizations")).rows[0].n, 2);
    const attempt = (await owner.query("INSERT INTO srm.provider_attempts(organization_id,request_id,section,provider,attempt_no,status) VALUES($1,$2,'financial','MGBI',1,'PENDING') RETURNING id", [organizationId, company.requestId])).rows[0].id;
    const snapshot = (await owner.query("INSERT INTO srm.source_snapshots(organization_id,attempt_id,supplier_id,section,payload_json,payload_sha256,data_class,retrieved_at) VALUES($1,$2,$3,'financial','{}',repeat('a',64),'FINANCIAL',now()) RETURNING id", [organizationId, attempt, company.supplierId])).rows[0].id;
    const mapped = mapMgbiFinancialRecords([{ id: "same-document", identifiers: { pl_nip: "1111111111" }, document: { type: "financial_statement", period_from_date: "2025-01-01", period_to_date: "2025-12-31" }, content: { schema: { name: "JednostkaInnaWZlotych" }, extracted_fields: { "RZiS.RZiSKalk.A.KwotaA": "1000", "RZiS.RZiSKalk.B.KwotaA": "-600", "RZiS.RZiSKalk.C.KwotaA": "400" } } }], { type: "NIP", value: "1111111111" }, new Date().toISOString());
    const cogs = mapped.facts.find(fact => fact.metricCode === "PALA_COGS")!;
    assert.equal(cogs.amount, "600"); assert.equal(cogs.sourceAmount, "-600");
    const insert = (metric: string, magnitude: string | null, source: string | null, rule = "VERIFIED_COST_MAGNITUDE_V1", status = "VALID") => owner.query("INSERT INTO srm.financial_facts(organization_id,supplier_id,snapshot_id,metric_code,period_start,period_end,period_type,statement_scope,amount,source_amount,normalization_rule,currency_code,unit_code,source_path,validation_status) VALUES($1,$2,$3,$4,'2025-01-01','2025-12-31','YEAR','UNIT',$5,$6,$7,'PLN','PLN','fixture',$8)", [organizationId,company.supplierId,snapshot,metric,magnitude,source,rule,status]);
    for (const metric of ["PALA_COGS", "PALA_OAC", "PALA_OAC_MAEC", "PALA_OOC", "PALA_FC", "PALA_IT"]) await insert(metric,cogs.amount,cogs.sourceAmount,cogs.normalizationRule);
    for (const args of [["PALA_COGS","-600","-600"],["PALA_COGS","601","-600"],["PALA_COGS","600",null],["PALA_NET_SALES","600","600"]] as const) {
      await assert.rejects(insert(args[0], args[1], args[2]), (error: unknown) => (error as { code: string }).code === "23514");
    }
    await insert("PALA_OAC_UNRESOLVED", "-20", "-20", "UNVERIFIED_COST_SIGN", "REVIEW");
    await owner.query("INSERT INTO srm.catalog_companies(nip) VALUES('1111111111')");
    await owner.query("INSERT INTO srm.catalog_financial_facts(nip,metric_code,period_start,period_end,statement_scope,period_type,amount,source_amount,normalization_rule,currency_code,unit_code,source_path,validation_status,retrieved_at) VALUES('1111111111','PALA_COGS','2025-01-01','2025-12-31','UNIT','YEAR',600,-600,'VERIFIED_COST_MAGNITUDE_V1','PLN','PLN','fixture','VALID',now())");
    await assert.rejects(owner.query("UPDATE srm.catalog_financial_facts SET amount=601 WHERE metric_code='PALA_COGS'"), (error: unknown) => (error as { code: string }).code === "23514");
    assert.ok(company.supplierId !== jdg.supplierId);
  } finally {
    await pool.end(); await owner.end();
    try {
      if (created) await admin.query("DROP DATABASE srm_app");
      if (runtimeCreated) await admin.query("DROP ROLE srm_app_runtime");
      if (neonCreated) await admin.query("DROP ROLE neon_superuser");
    } finally { await admin.end(); }
  }
});
