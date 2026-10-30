import pg from "pg";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  limitsSql,
  identitySql,
  seedSql,
  rolesSql,
  identityPrefix,
} from "../scripts/install.mjs";
export const actorId = "11111111-1111-4111-8111-111111111111",
  otherId = "22222222-2222-4222-8222-222222222222",
  orgId = "33333333-3333-4333-8333-333333333333";
export const actor = () => ({
  kind: "HUMAN",
  actorId,
  userId: actorId,
  proofRef: "synthetic-local-only",
  issuer: "https://unified-drum-7191.clerk.accounts.dev",
  audience: "package-limits-development",
  environment: "development",
  expiresAt: new Date(Date.now() + 60000).toISOString(),
});
export async function fixture() {
  const raw = process.env.LIMITS_TEST_OWNER_URL;
  if (!raw) throw Error("LIMITS_TEST_OWNER_URL_REQUIRED_NO_SKIP");
  const u = new URL(raw);
  assert(
    ["127.0.0.1", "localhost"].includes(u.hostname) &&
      u.username === "limits_fixture_owner" &&
      u.pathname === "/neondb" &&
      process.env.LIMITS_TEST_ISOLATED === "1",
    "Explicit isolated loopback fixture only; never cloud credentials",
  );
  const owner = new pg.Pool({ connectionString: raw, max: 2 });
  for (const n of ["profitia_limits", "profitia_limits_identity_read"])
    await owner.query("DROP SCHEMA IF EXISTS " + n + " CASCADE");
  if (
    (
      await owner.query(
        "SELECT 1 FROM pg_database WHERE datname='platform_private'",
      )
    ).rowCount
  )
    await owner.query("DROP DATABASE platform_private WITH (FORCE)");
  for (const n of [
    "profitia_limits_identity_reader",
    "profitia_access_owner",
    "profitia_limits_migrator",
    "profitia_limits_runtime",
    "profitia_limits_owner",
  ]) {
    if (
      (await owner.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [n]))
        .rowCount
    ) {
      await owner.query("DROP OWNED BY " + n + " CASCADE");
      await owner.query("DROP ROLE " + n);
    }
  }
  await owner.query(
    "CREATE ROLE profitia_limits_runtime LOGIN NOINHERIT PASSWORD $pwd$fixture_runtime_only$pwd$",
  );
  await owner.query(
    "CREATE ROLE profitia_limits_migrator LOGIN NOINHERIT PASSWORD $pwd$fixture_migrator_only$pwd$",
  );
  await owner.query(
    "CREATE ROLE profitia_limits_identity_reader LOGIN NOINHERIT PASSWORD $pwd$fixture_reader_only$pwd$",
  );
  await owner.query(rolesSql);
  const c = await owner.connect();
  try {
    await c.query("BEGIN");
    await c.query("SET LOCAL ROLE profitia_limits_owner");
    await c.query(limitsSql);
    await c.query(seedSql);
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
  await owner.query(
    "REVOKE CREATE ON DATABASE neondb FROM profitia_limits_owner",
  );
  const createPrivate = await owner.query(
    "SELECT 1 FROM pg_database WHERE datname='platform_private'",
  );
  if (!createPrivate.rowCount)
    await owner.query("CREATE DATABASE platform_private");
  const privUrl = new URL(raw);
  privUrl.pathname = "/platform_private";
  const privateOwner = new pg.Pool({ connectionString: privUrl.toString() });
  await privateOwner.query(
    "CREATE ROLE profitia_access_owner NOLOGIN NOINHERIT",
  );
  await privateOwner.query(
    "CREATE SCHEMA profitia_access AUTHORIZATION profitia_access_owner",
  );
  await privateOwner.query(String.raw`SET ROLE profitia_access_owner;
 CREATE TABLE profitia_access.installation(singleton boolean,environment text,project_id text,branch_id text,database_name name);
 INSERT INTO profitia_access.installation VALUES(true,'development','spring-bread-28217539','br-sparkling-term-b99l107x',current_database());
 CREATE TABLE profitia_access.accounts(user_id uuid PRIMARY KEY,status text,version bigint);
 CREATE TABLE profitia_access.external_identities(binding_id uuid PRIMARY KEY,user_id uuid REFERENCES profitia_access.accounts,issuer text,subject text,status text,version bigint,source_ref text,expires_at timestamptz);
 CREATE TABLE profitia_access.organisations(organisation_id uuid PRIMARY KEY,display_name text,status text,version bigint);
 ALTER TABLE profitia_access.accounts ENABLE ROW LEVEL SECURITY;ALTER TABLE profitia_access.accounts FORCE ROW LEVEL SECURITY;CREATE POLICY owner ON profitia_access.accounts TO profitia_access_owner USING(true) WITH CHECK(true);
 ALTER TABLE profitia_access.external_identities ENABLE ROW LEVEL SECURITY;ALTER TABLE profitia_access.external_identities FORCE ROW LEVEL SECURITY;CREATE POLICY owner ON profitia_access.external_identities TO profitia_access_owner USING(true) WITH CHECK(true);
 ALTER TABLE profitia_access.organisations ENABLE ROW LEVEL SECURITY;ALTER TABLE profitia_access.organisations FORCE ROW LEVEL SECURITY;CREATE POLICY owner ON profitia_access.organisations TO profitia_access_owner USING(true) WITH CHECK(true);
 RESET ROLE;`);
  const pc = await privateOwner.connect();
  try {
    await pc.query("BEGIN");
    await pc.query(identityPrefix + "\n" + identitySql);
    await pc.query("COMMIT");
  } catch (e) {
    await pc.query("ROLLBACK");
    throw e;
  } finally {
    pc.release();
  }
  await privateOwner.query(
    "INSERT INTO profitia_access.accounts VALUES($1,'ACTIVE',1),($2,'ACTIVE',1)",
    [actorId, otherId],
  );
  await privateOwner.query(
    "INSERT INTO profitia_access.external_identities VALUES($1,$2,'https://unified-drum-7191.clerk.accounts.dev','user_fixture','ACTIVE',1,'synthetic',clock_timestamp()+interval '1hour')",
    [randomUUID(), actorId],
  );
  await privateOwner.query(
    "INSERT INTO profitia_access.organisations VALUES($1,'Organizacja testowa','ACTIVE',1)",
    [orgId],
  );
  await owner.query(
    "INSERT INTO profitia_limits.operator_grants(user_id,enabled,source_ref)VALUES($1,true,'synthetic-local-only')",
    [actorId],
  );
  const key = (
    await owner.query(
      "SELECT encode(command_key,$h$hex$h$) AS key FROM profitia_limits.installation",
    )
  ).rows[0].key;
  const rt = new URL(raw);
  rt.username = "profitia_limits_runtime";
  rt.password = "fixture_runtime_only";
  const runtime = new pg.Pool({ connectionString: rt.toString(), max: 4 });
  const reader = new URL(privUrl);
  reader.username = "profitia_limits_identity_reader";
  reader.password = "fixture_reader_only";
  const identity = new pg.Pool({ connectionString: reader.toString(), max: 2 });
  return {
    owner,
    privateOwner,
    runtime,
    identity,
    key: Buffer.from(key, "hex"),
    close: async () => {
      await Promise.all([
        owner.end(),
        privateOwner.end(),
        runtime.end(),
        identity.end(),
      ]);
    },
  };
}
