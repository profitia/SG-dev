import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import pg from "pg";
test(
  "isolated PostgreSQL: scanner frames are tenant isolated, append-only and idempotent",
  { skip: !process.env.SRM_MIGRATION_TEST_URL },
  async () => {
    const url = new URL(process.env.SRM_MIGRATION_TEST_URL!);
    assert.ok(
      ["localhost", "127.0.0.1"].includes(url.hostname) &&
        url.pathname === "/srm_migration_test",
    );
    const c = new pg.Client({ connectionString: url.toString() });
    await c.connect();
    const a = "11111111-1111-4111-8111-111111111111",
      b = "22222222-2222-4222-8222-222222222222";
    try {
      await c.query("BEGIN");
      await c.query("CREATE SCHEMA scanner_fixture");
      await c.query(
        "CREATE ROLE scanner_fixture_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS",
      );
      await c.query(
        "CREATE TABLE scanner_fixture.organizations(id uuid PRIMARY KEY)",
      );
      await c.query(
        "INSERT INTO scanner_fixture.organizations VALUES($1),($2)",
        [a, b],
      );
      const migration = readFileSync(
        new URL(
          "../../../db/migrations/0015_financial_scanner_frames.sql",
          import.meta.url,
        ),
        "utf8",
      );
      await c.query(
        migration
          .replaceAll("srm.", "scanner_fixture.")
          .replaceAll("srm_app_runtime", "scanner_fixture_runtime"),
      );
      await c.query(
        "GRANT USAGE ON SCHEMA scanner_fixture TO scanner_fixture_runtime",
      );
      await c.query("SET LOCAL ROLE scanner_fixture_runtime");
      await c.query(
        "SELECT set_config('scanner_fixture.organization_id',$1,true)",
        [a],
      );
      const insert = (org: string, body: string) =>
        c.query(
          "INSERT INTO scanner_fixture.financial_scanner_frames(organization_id,nip,frame_id,frame_json) VALUES($1,'5213390341',repeat('a',64),$2::jsonb) ON CONFLICT DO NOTHING",
          [org, body],
        );
      await insert(a, '{"value":1}');
      await insert(a, '{"value":2}');
      assert.deepEqual(
        (
          await c.query(
            "SELECT frame_json FROM scanner_fixture.financial_scanner_frames",
          )
        ).rows,
        [{ frame_json: { value: 1 } }],
      );
      assert.equal(
        (
          await c.query(
            "SELECT has_table_privilege(current_user,'scanner_fixture.financial_scanner_frames','UPDATE') AS allowed",
          )
        ).rows[0].allowed,
        false,
      );
      assert.equal(
        (
          await c.query(
            "SELECT has_table_privilege(current_user,'scanner_fixture.financial_scanner_frames','DELETE') AS allowed",
          )
        ).rows[0].allowed,
        false,
      );
      await c.query(
        "SELECT set_config('scanner_fixture.organization_id',$1,true)",
        [b],
      );
      assert.equal(
        (
          await c.query(
            "SELECT * FROM scanner_fixture.financial_scanner_frames",
          )
        ).rowCount,
        0,
      );
      await c.query("SAVEPOINT foreign_insert");
      await assert.rejects(
        insert(a, "{}"),
        (e: unknown) => (e as { code: string }).code === "42501",
      );
      await c.query("ROLLBACK TO SAVEPOINT foreign_insert");
    } finally {
      await c.query("ROLLBACK");
      await c.end();
    }
  },
);
