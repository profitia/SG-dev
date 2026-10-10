import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import pg from "pg";

test("isolated PostgreSQL: additive financial document migration enforces RLS, foreign write rejection and least privilege", { skip: !process.env.SRM_MIGRATION_TEST_URL }, async () => {
  const url = new URL(process.env.SRM_MIGRATION_TEST_URL!);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname) && url.pathname === "/srm_migration_test", "Local fixture database only");
  const client = new pg.Client({ connectionString: url.toString() }); await client.connect();
  const orgA = "11111111-1111-4111-8111-111111111111", orgB = "22222222-2222-4222-8222-222222222222";
  try {
    await client.query("BEGIN");
    await client.query("CREATE SCHEMA srm_xml_fixture");
    await client.query("CREATE ROLE srm_xml_fixture_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS");
    await client.query("CREATE TABLE srm_xml_fixture.organizations(id uuid PRIMARY KEY)");
    await client.query("INSERT INTO srm_xml_fixture.organizations VALUES($1),($2)", [orgA, orgB]);
    const sql = readFileSync(new URL("../../../db/migrations/0013_financial_source_documents.sql", import.meta.url), "utf8");
    await client.query(sql.replaceAll("srm.", "srm_xml_fixture.").replaceAll("srm_app_runtime", "srm_xml_fixture_runtime"));
    await client.query("GRANT USAGE ON SCHEMA srm_xml_fixture TO srm_xml_fixture_runtime");
    await client.query("SET LOCAL ROLE srm_xml_fixture_runtime");
    await client.query("SELECT set_config('srm_xml_fixture.organization_id',$1,true)", [orgA]);
    const insert = (org: string, id: string) => client.query("INSERT INTO srm_xml_fixture.financial_source_documents(organization_id,nip,record_id,document_json,checksum_sha256,mapping_version) VALUES($1,'6310200831',$2,'{}',repeat('a',64),'fixture')", [org,id]);
    await insert(orgA,"own");
    assert.equal((await client.query("SELECT count(*)::int AS n FROM srm_xml_fixture.financial_source_documents")).rows[0].n,1);
    await client.query("SELECT set_config('srm_xml_fixture.organization_id',$1,true)",[orgB]);
    assert.equal((await client.query("SELECT count(*)::int AS n FROM srm_xml_fixture.financial_source_documents")).rows[0].n,0);
    assert.equal((await client.query("UPDATE srm_xml_fixture.financial_source_documents SET mapping_version='foreign' WHERE record_id='own'")).rowCount,0);
    await client.query("SAVEPOINT foreign_write");
    await assert.rejects(insert(orgA,"foreign"), (error: unknown) => (error as { code: string }).code === "42501");
    await client.query("ROLLBACK TO SAVEPOINT foreign_write");
    assert.equal((await client.query("SELECT has_table_privilege(current_user,'srm_xml_fixture.financial_source_documents','DELETE') AS allowed")).rows[0].allowed,false);
    assert.equal((await client.query("SELECT r.rolbypassrls FROM pg_roles r WHERE rolname=current_user")).rows[0].rolbypassrls,false);
  } finally { await client.query("ROLLBACK"); await client.end(); }
});
