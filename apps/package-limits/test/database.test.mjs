import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixture, actor, actorId, otherId, orgId } from "./fixture.mjs";
import { Store, signature } from "../dist/store.js";
import {
  limitsSql,
  limitsDigest,
  identityDigest,
  verificationSql,
  verifyInstallation,
  rolesSql,
  limitsLoginRolesSql,
} from "../scripts/install.mjs";
let f, store;
const today = new Date().toISOString().slice(0, 10);
const later = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const end = "2090-01-01";
let sgVersion, srmVersion, sgPackage, assignment;
const write = (op, data, requestId = randomUUID(), who = actor()) =>
  store.transact(who, (s) => s.call(op, { requestId, data }));
const l = (metricId, value = "100") => ({
  metricId,
  mode: "LIMITED",
  value,
  period: "MONTH",
  anchor: "CALENDAR",
  timezone: "Europe/Warsaw",
  warningPercent: 80,
});
const terms = () => ({
  contractStart: today,
  contractEnd: end,
  assignmentStart: today,
  assignmentEnd: end,
  usageStart: today,
  usageCycle: "MONTH",
  usageAnchor: "CALENDAR",
  billingStart: today,
  billingEnd: end,
  invoiceDate: today,
  dueDate: later,
  timezone: "Europe/Warsaw",
  basis: "DEVELOPMENT_TEST",
  reference: "SYNTHETIC-LOCAL-ONLY",
  purchaseType: "MANUAL_SUBSCRIPTION",
});
before(async () => {
  f = await fixture();
  store = new Store(f.runtime, f.key);
});
after(async () => {
  if (f) await f.close();
});
test("installation role plan works as a non-superuser administrator and refuses privileged runtime roles", async () => {
  const c = await f.owner.connect();
  const renamed = (s) => s.replaceAll("profitia_limits", "limits_probe");
  try {
    await c.query("BEGIN");
    await c.query(
      "CREATE ROLE limits_probe_admin NOLOGIN NOSUPERUSER CREATEROLE",
    );
    await c.query(
      "GRANT CREATE ON DATABASE neondb TO limits_probe_admin WITH GRANT OPTION",
    );
    await c.query("SET LOCAL ROLE limits_probe_admin");
    await c.query(renamed(limitsLoginRolesSql));
    await c.query(renamed(rolesSql));
    const rows = (
      await c.query(
        "SELECT rolname,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolinherit FROM pg_roles WHERE rolname IN('limits_probe_runtime','limits_probe_migrator')",
      )
    ).rows;
    assert.equal(rows.length, 2);
    assert(
      rows.every(
        (r) =>
          !r.rolsuper &&
          !r.rolbypassrls &&
          !r.rolcreatedb &&
          !r.rolcreaterole &&
          !r.rolinherit,
      ),
    );
    await c.query("ROLLBACK");
    await c.query("BEGIN");
    await c.query(renamed(limitsLoginRolesSql));
    await c.query("ALTER ROLE limits_probe_runtime BYPASSRLS");
    await assert.rejects(
      c.query(renamed(rolesSql)),
      /SQL_CREATED_ORDINARY_LOGIN_REQUIRED/,
    );
  } finally {
    await c.query("ROLLBACK");
    c.release();
  }
});
test("ordinary roles, exact receipts and FORCE RLS; no raw-table or owner escape", async () => {
  const health = await store.health();
  assert.equal(health.schemaDigest, limitsDigest);
  assert.equal(health.role, "profitia_limits_runtime");
  const roles = (
    await f.owner.query(
      "SELECT rolname,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,rolinherit FROM pg_roles WHERE rolname IN('profitia_limits_runtime','profitia_limits_identity_reader')",
    )
  ).rows;
  for (const r of roles)
    for (const k of [
      "rolsuper",
      "rolbypassrls",
      "rolcreaterole",
      "rolcreatedb",
      "rolinherit",
    ])
      assert.equal(r[k], false);
  assert(
    (
      await f.owner.query(
        "SELECT bool_and(relrowsecurity AND relforcerowsecurity) AS ok FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_limits' AND c.relkind='r'",
      )
    ).rows[0].ok,
  );
  for (const q of [
    "SELECT * FROM profitia_limits.operator_grants",
    "SELECT * FROM profitia_limits.installation",
    "UPDATE profitia_limits.operator_grants SET enabled=true",
    "SET ROLE profitia_limits_owner",
  ])
    await assert.rejects(f.runtime.query(q), (e) => e.code === "42501");
  await assert.rejects(
    f.identity.query("SELECT * FROM profitia_access.accounts"),
    (e) => e.code === "42501",
  );
});
test("HMAC denies raw caller identity, transaction, body, expiry and role-GUC forgery", async () => {
  const c = await f.runtime.connect();
  try {
    await c.query("BEGIN");
    const tx = (await c.query("SELECT pg_current_xact_id()::text tx")).rows[0]
      .tx;
    const until = Date.now() + 4000,
      json = "{}",
      proof = signature(f.key, actorId, until, tx, "authorize", json);
    await c.query("SELECT set_config('profitia.actor_id',$1,true)", [actorId]);
    await assert.rejects(
      c.query("SELECT profitia_limits.api($1,$2,$3,$4,$5,$6)", [
        otherId,
        until,
        tx,
        "authorize",
        json,
        proof,
      ]),
      (e) => e.code === "42501",
    );
  } finally {
    await c.query("ROLLBACK");
    c.release();
  }
  for (const patch of [
    { userId: otherId, actorId: otherId },
    { expiresAt: new Date(Date.now() - 1).toISOString() },
  ])
    await assert.rejects(
      store.transact({ ...actor(), ...patch }, (s) => s.call("authorize", {})),
      (e) => e.status === 403,
    );
});
test("canonical identity adapter is narrow, current and returns no fabricated or expired binding", async () => {
  const d = (
    await f.identity.query(
      "SELECT profitia_limits_identity_read.descriptor() d",
    )
  ).rows[0].d;
  assert.equal(d.schemaDigest, identityDigest);
  const b = (
    await f.identity.query(
      "SELECT profitia_limits_identity_read.binding($1,'user_fixture') b",
      ["https://unified-drum-7191.clerk.accounts.dev"],
    )
  ).rows[0].b;
  assert.equal(b.userId, actorId);
  assert.equal(
    (
      await f.identity.query(
        "SELECT profitia_limits_identity_read.binding('https://wrong.example','user_fixture') b",
      )
    ).rows[0].b,
    null,
  );
  await f.privateOwner.query(
    "UPDATE profitia_access.accounts SET status='DISABLED' WHERE user_id=$1",
    [actorId],
  );
  assert.equal(
    (
      await f.identity.query(
        "SELECT profitia_limits_identity_read.binding($1,'user_fixture') b",
        ["https://unified-drum-7191.clerk.accounts.dev"],
      )
    ).rows[0].b,
    null,
  );
  await f.privateOwner.query(
    "UPDATE profitia_access.accounts SET status='ACTIVE' WHERE user_id=$1",
    [actorId],
  );
  await assert.rejects(
    f.identity.query(
      "SELECT profitia_limits_identity_read.lock_organisation($1)",
      [randomUUID()],
    ),
    (e) => e.code === "23514",
  );
  assert.equal(
    (
      await f.identity.query(
        "SELECT profitia_limits_identity_read.lock_organisation($1) o",
        [orgId],
      )
    ).rows[0].o.organisation_id,
    orgId,
  );
});
test("draft editing, immutable publication, catalog/product separation and idempotent intent", async () => {
  const key = randomUUID(),
    data = { name: "SG Full — test", productId: "SPENDGURU" };
  const created = await write("package.create", data, key);
  const again = await write("package.create", data, key);
  assert.equal(created.id, again.id);
  sgPackage = created.package_id;
  await assert.rejects(
    write("package.create", { ...data, name: "another" }, key),
    (e) => e.status === 409,
  );
  const snap = {
    name: data.name,
    capabilities: ["SUPPLIER_INTELLIGENCE", "BENCHMARK", "OPENAI_ASSISTANCE"],
    limits: [
      l("MGBI_PAID_CALLS"),
      l("MACROBOND_REQUESTS", "200"),
      l("OPENAI_TOTAL_TOKENS", "200000"),
    ],
    price: null,
    currency: null,
  };
  const saved = await write("draft.save", {
    versionId: created.id,
    revision: created.revision,
    snapshot: snap,
  });
  await assert.rejects(
    write("draft.save", {
      versionId: created.id,
      revision: created.revision,
      snapshot: snap,
    }),
    (e) => e.status === 409,
  );
  sgVersion = await write("version.publish", {
    versionId: saved.id,
    revision: saved.revision,
  });
  assert.equal(sgVersion.state, "PUBLISHED");
  assert.equal(sgVersion.snapshot.metricDefinitions.length, 3);
  await assert.rejects(
    f.owner.query(
      "UPDATE profitia_limits.package_versions SET snapshot='{}' WHERE id=$1",
      [sgVersion.id],
    ),
    (e) => e.code === "42501",
  );
  const s = await write("package.create", {
    name: "SRM Basic — test",
    productId: "SRM_STANDALONE",
  });
  await assert.rejects(
    write("draft.save", {
      versionId: s.id,
      revision: 1,
      snapshot: {
        ...snap,
        name: "SRM",
        capabilities: ["BENCHMARK"],
        limits: [l("MACROBOND_REQUESTS")],
      },
    }),
    (e) => e.status === 400,
  );
  const ss = await write("draft.save", {
    versionId: s.id,
    revision: 1,
    snapshot: {
      ...snap,
      name: "SRM Basic",
      capabilities: ["SUPPLIER_INTELLIGENCE"],
      limits: [l("MGBI_PAID_CALLS", "20")],
    },
  });
  srmVersion = await write("version.publish", {
    versionId: ss.id,
    revision: ss.revision,
  });
  assert.notEqual(srmVersion.package_id, sgVersion.package_id);
});
test("two independent assignments persist; no overlap, fallback or client org authority", async () => {
  const payload = {
    organisationId: orgId,
    organisationVersion: 1,
    packageVersionId: sgVersion.id,
    terms: terms(),
    overrides: [],
    reason: "Synthetic Development contract",
    effectiveFrom: today,
  };
  assignment = await write("assignment.create", payload);
  assert.equal(assignment.product_id, "SPENDGURU");
  assert.equal(assignment.payload.e1Projection, "PENDING_NOT_CONNECTED");
  await assert.rejects(
    write("assignment.create", payload),
    (e) => e.code === "ASSIGNMENT_OVERLAP",
  );
  await assert.rejects(
    write("assignment.create", {
      ...payload,
      organisationVersion: 0,
      organisationId: randomUUID(),
    }),
    (e) => e.status === 400,
  );
  const second = await write("assignment.create", {
    ...payload,
    packageVersionId: srmVersion.id,
  });
  assert.equal(second.product_id, "SRM_STANDALONE");
  assert.notEqual(second.id, assignment.id);
  const state = await store.transact(actor(), (s) =>
    s.call("list", { offset: 0, q: "" }),
  );
  assert.equal(state.assignments.length, 2);
  assert.equal(state.metering, "NOT_CONNECTED");
  assert.equal(state.e1Projection, "PENDING_NOT_CONNECTED");
});
test("versioned change and overrides retain previous contract and package bytes", async () => {
  const old = JSON.stringify(
    (
      await f.owner.query(
        "SELECT snapshot FROM profitia_limits.package_versions WHERE id=$1",
        [sgVersion.id],
      )
    ).rows[0].snapshot,
  );
  const draft = await write("version.create", {
    packageId: sgPackage,
    fromVersionId: sgVersion.id,
  });
  assert.equal(draft.number, 2);
  const next = await write("version.publish", {
    versionId: draft.id,
    revision: draft.revision,
  });
  const changed = await write("assignment.change", {
    assignmentId: assignment.id,
    revision: 1,
    organisationId: orgId,
    organisationVersion: 1,
    packageVersionId: next.id,
    terms: terms(),
    overrides: [l("MGBI_PAID_CALLS", "150")],
    reason: "Future versioned change, no package overwrite",
    effectiveFrom: later,
  });
  assert.equal(changed.revision, 2);
  const history = (
    await f.owner.query(
      "SELECT * FROM profitia_limits.assignment_revisions WHERE assignment_id=$1 ORDER BY revision",
      [assignment.id],
    )
  ).rows;
  assert.equal(history.length, 2);
  assert.equal(history[0].payload.packageVersionId, sgVersion.id);
  assert.equal(history[1].payload.packageVersionId, next.id);
  assert.equal(
    JSON.stringify(
      (
        await f.owner.query(
          "SELECT snapshot FROM profitia_limits.package_versions WHERE id=$1",
          [sgVersion.id],
        )
      ).rows[0].snapshot,
    ),
    old,
  );
  await assert.rejects(
    f.owner.query("DELETE FROM profitia_limits.audit"),
    (e) => e.code === "42501",
  );
  await assert.rejects(
    write("assignment.change", {
      assignmentId: assignment.id,
      revision: 1,
      organisationId: orgId,
      organisationVersion: 1,
      packageVersionId: next.id,
      terms: terms(),
      overrides: [],
      reason: "stale",
      effectiveFrom: later,
    }),
    (e) => e.status === 409,
  );
});
test("current grant revocation denies even idempotent replay, with no additional event", async () => {
  const n = (
    await f.owner.query("SELECT count(*) n FROM profitia_limits.audit")
  ).rows[0].n;
  await f.owner.query(
    "UPDATE profitia_limits.operator_grants SET enabled=false,version=version+1 WHERE user_id=$1",
    [actorId],
  );
  await assert.rejects(
    store.transact(actor(), (s) => s.call("list", {})),
    (e) => e.status === 403,
  );
  await assert.rejects(
    write("package.create", { name: "forbidden", productId: "SPENDGURU" }),
    (e) => e.status === 403,
  );
  assert.equal(
    (await f.owner.query("SELECT count(*) n FROM profitia_limits.audit"))
      .rows[0].n,
    n,
  );
  await f.owner.query(
    "UPDATE profitia_limits.operator_grants SET enabled=true,version=version+1 WHERE user_id=$1",
    [actorId],
  );
});
test("concurrent duplicate assignments serialize; only one commits", async () => {
  const newOrg = randomUUID(),
    payload = {
      organisationId: newOrg,
      organisationVersion: 1,
      packageVersionId: sgVersion.id,
      terms: terms(),
      overrides: [],
      reason: "Concurrency fixture",
      effectiveFrom: today,
    };
  const rs = await Promise.allSettled([
    write("assignment.create", payload),
    write("assignment.create", payload),
  ]);
  assert.equal(rs.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(rs.filter((x) => x.status === "rejected").length, 1);
});
test("periods are half-open, timezone-aware, DST-safe and original-anchor month-end preserving", async () => {
  const window = async (anchor, unit, cal, tz, at) =>
    (
      await f.owner.query(
        "SELECT profitia_limits.cycle_window($1,$2,$3,$4,$5) w",
        [anchor, unit, cal, tz, at],
      )
    ).rows[0].w;
  const spring = await window(
    "2026-03-01",
    "MONTH",
    true,
    "Europe/Warsaw",
    "2026-03-15T12:00:00Z",
  );
  assert.equal(
    new Date(spring.start).toISOString(),
    "2026-02-28T23:00:00.000Z",
  );
  assert.equal(new Date(spring.end).toISOString(), "2026-03-31T22:00:00.000Z");
  const jan = await window(
    "2026-01-31",
    "MONTH",
    false,
    "UTC",
    "2026-02-28T00:00:00Z",
  );
  assert.equal(new Date(jan.start).toISOString(), "2026-02-28T00:00:00.000Z");
  assert.equal(new Date(jan.end).toISOString(), "2026-03-31T00:00:00.000Z");
  const boundary = await window(
    "2026-01-31",
    "MONTH",
    false,
    "UTC",
    "2026-03-31T00:00:00Z",
  );
  assert.equal(boundary.start, jan.end);
  assert.equal(boundary.bounds, "[start,end)");
});
test("install replay cannot overwrite data or rotate the command key; conflicting source stops", async () => {
  const before = (
    await f.owner.query("SELECT count(*) n FROM profitia_limits.audit")
  ).rows[0].n;
  const c = await f.owner.connect();
  try {
    await c.query("BEGIN");
    await c.query("SET LOCAL ROLE profitia_limits_owner");
    await assert.rejects(
      c.query(limitsSql),
      /EXISTING_SCHEMA_REQUIRES_EXACT_RECEIPT/,
    );
  } finally {
    await c.query("ROLLBACK");
    c.release();
  }
  assert.equal(
    (await f.owner.query("SELECT count(*) n FROM profitia_limits.audit"))
      .rows[0].n,
    before,
  );
  assert.equal((await store.health()).schemaDigest, limitsDigest);
});

test("exact installed source replay is a verified no-op; altered function or role snapshot stops", async () => {
  for (const [kind, pool] of [
    ["limits", f.owner],
    ["identity", f.privateOwner],
  ]) {
    const snap = (await pool.query(verificationSql(kind))).rows[0].snapshot;
    assert.equal(
      verifyInstallation(snap, kind).action,
      "ALREADY_INSTALLED_VERIFIED_SKIP",
    );
    assert.throws(() =>
      verifyInstallation({ ...snap, ordinaryRole: false }, kind),
    );
    assert.throws(() =>
      verifyInstallation(
        {
          ...snap,
          functions: snap.functions.map((x, i) =>
            i ? x : { ...x, body: x.body + "tampered" },
          ),
        },
        kind,
      ),
    );
  }
});
test("same-day status uses recorded timestamp and immutable security grant events", async () => {
  const t0 = Date.now();
  const r = await write("assignment.status", {
    assignmentId: assignment.id,
    revision: 2,
    organisationVersion: 1,
    status: "SUSPENDED",
    reason: "Immediate local status test",
    effectiveFrom: today,
  });
  assert.equal(r.revision, 3);
  assert(Date.parse(r.payload.effectiveAt) >= t0 - 1000);
  const state = await store.transact(actor(), (s) =>
    s.call("list", { offset: 0, q: "" }),
  );
  assert.equal(
    state.assignments.find((x) => x.id === assignment.id).effective_status,
    "SUSPENDED",
  );
  assert(
    (
      await f.owner.query(
        "SELECT count(*)::int n FROM profitia_limits.operator_grant_events",
      )
    ).rows[0].n >= 3,
  );
  await assert.rejects(
    f.owner.query("DELETE FROM profitia_limits.operator_grant_events"),
    (e) => e.code === "42501",
  );
});
test("audit insertion failure rolls back package, version and receipt atomically", async () => {
  const n = (
      await f.owner.query(
        "SELECT count(*)::int n FROM profitia_limits.packages",
      )
    ).rows[0].n,
    key = randomUUID();
  await f.owner.query(
    "CREATE FUNCTION profitia_limits.fixture_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $f$ BEGIN RAISE EXCEPTION 'synthetic audit failure';END $f$; CREATE TRIGGER fixture_audit_failure BEFORE INSERT ON profitia_limits.audit FOR EACH ROW EXECUTE FUNCTION profitia_limits.fixture_fail_audit()",
  );
  try {
    await assert.rejects(
      write(
        "package.create",
        { name: "must roll back", productId: "SPENDGURU" },
        key,
      ),
    );
    assert.equal(
      (
        await f.owner.query(
          "SELECT count(*)::int n FROM profitia_limits.packages",
        )
      ).rows[0].n,
      n,
    );
    assert.equal(
      (
        await f.owner.query(
          "SELECT count(*)::int n FROM profitia_limits.receipts WHERE request_id=$1",
          [key],
        )
      ).rows[0].n,
      0,
    );
  } finally {
    await f.owner.query(
      "DROP TRIGGER fixture_audit_failure ON profitia_limits.audit;DROP FUNCTION profitia_limits.fixture_fail_audit()",
    );
  }
  await write(
    "package.create",
    { name: "must roll back", productId: "SPENDGURU" },
    key,
  );
  assert.equal(
    (
      await f.owner.query(
        "SELECT count(*)::int n FROM profitia_limits.packages",
      )
    ).rows[0].n,
    n + 1,
  );
});

test("raw SQL cannot reuse a signed proof for another body, operation, transaction or deadline", async () => {
  for (const kind of [
    "body",
    "operation",
    "transaction",
    "deadline",
    "signature",
  ]) {
    const c = await f.runtime.connect();
    try {
      await c.query("BEGIN");
      const tx = (await c.query("SELECT pg_current_xact_id()::text tx")).rows[0]
          .tx,
        until = Date.now() + 4000,
        json = "{}",
        proof = signature(f.key, actorId, until, tx, "authorize", json);
      const values = [actorId, until, tx, "authorize", json, proof];
      if (kind === "body") values[4] = '{"changed":true}';
      if (kind === "operation") values[3] = "list";
      if (kind === "transaction") values[2] = String(BigInt(tx) + 1n);
      if (kind === "deadline") values[1] = Date.now() - 1;
      if (kind === "signature") values[5] = "0".repeat(64);
      await assert.rejects(
        c.query("SELECT profitia_limits.api($1,$2,$3,$4,$5,$6)", values),
        (e) => e.code === "42501",
      );
    } finally {
      await c.query("ROLLBACK");
      c.release();
    }
  }
});
test("no hidden calendar proration: DST day and leap-year original anchor remain exact", async () => {
  const w = async (a, u, cal, tz, at) =>
    (
      await f.owner.query(
        "SELECT profitia_limits.cycle_window($1,$2,$3,$4,$5) w",
        [a, u, cal, tz, at],
      )
    ).rows[0].w;
  const day = await w(
    "2026-03-01",
    "DAY",
    true,
    "Europe/Warsaw",
    "2026-03-29T12:00:00Z",
  );
  assert.equal(Date.parse(day.end) - Date.parse(day.start), 23 * 3600000);
  const leap = await w(
    "2024-02-29",
    "YEAR",
    false,
    "UTC",
    "2027-03-01T00:00:00Z",
  );
  assert.equal(new Date(leap.start).toISOString().slice(0, 10), "2027-02-28");
  assert.equal(new Date(leap.end).toISOString().slice(0, 10), "2028-02-29");
});
