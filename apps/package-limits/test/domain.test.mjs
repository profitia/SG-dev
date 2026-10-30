import test from "node:test";
import assert from "node:assert/strict";
import {
  command,
  date,
  decimal,
  terms,
  packageSnapshot,
  zone,
  isOverlap,
} from "../dist/domain.js";
import { poolConfig } from "../dist/config.js";
import { metrics } from "../dist/catalog.js";
const id = "11111111-1111-4111-8111-111111111111";
test("closed commands never accept caller role, user, E1 grant or unrecognised operation", () => {
  for (const x of [
    { operation: "operator.grant", requestId: id, data: {} },
    {
      operation: "package.create",
      requestId: id,
      userId: id,
      data: { name: "x", productId: "SPENDGURU" },
    },
    {
      operation: "package.create",
      requestId: id,
      data: { name: "x", productId: "SPENDGURU", role: "admin" },
    },
  ])
    assert.throws(() => command(x));
  assert.equal(
    command({
      operation: "package.create",
      requestId: id,
      data: { name: "Oferta dowolnej nazwy", productId: "SPENDGURU" },
    }).data.productId,
    "SPENDGURU",
  );
});
test("finite nonnegative decimals and arbitrary valid names/units; no NaN, infinity or credential in business text", () => {
  for (const x of ["-1", "NaN", "Infinity", "1e100", "1.1234567"])
    assert.throws(() => decimal(x));
  assert.equal(decimal("0.125"), "0.125");
  assert.throws(() =>
    command({
      operation: "package.create",
      requestId: id,
      data: {
        name: "sk_test_do_not_store_credentials",
        productId: "SPENDGURU",
      },
    }),
  );
});
test("strict dates, independent periods, IANA timezone and half-open adjacency", () => {
  for (const d of ["2026-13-01", "2026-02-30", "2025-02-29", "yesterday"])
    assert.throws(() => date(d));
  assert.equal(date("2028-02-29"), "2028-02-29");
  assert.throws(() => zone("invented/timezone"));
  assert.equal(
    isOverlap("2026-01-01", "2026-02-01", "2026-02-01", "2026-03-01"),
    false,
  );
  const t = {
    contractStart: "2026-01-01",
    contractEnd: "2027-01-01",
    assignmentStart: "2026-02-01",
    assignmentEnd: "2026-12-01",
    usageStart: "2026-02-01",
    usageCycle: "MONTH",
    usageAnchor: "ASSIGNMENT",
    billingStart: "2026-01-10",
    billingEnd: "2026-11-10",
    invoiceDate: "2026-01-01",
    dueDate: "2026-01-20",
    timezone: "Europe/Warsaw",
    basis: "MANUAL_CONTRACT",
    reference: "manual-reference",
    purchaseType: "MANUAL_SUBSCRIPTION",
  };
  assert.notEqual(terms(t).billingStart, terms(t).assignmentStart);
  assert.throws(() => terms({ ...t, usageStart: "2027-01-01" }));
});
test("UNMETERED and disabled never retain numeric allowance; duplicate metrics and currency truncation refused", () => {
  const l = {
    metricId: "OPENAI_TOTAL_TOKENS",
    mode: "UNMETERED",
    value: "100",
    period: "MONTH",
    anchor: "CALENDAR",
    timezone: "UTC",
    warningPercent: null,
  };
  const s = {
    name: "Full",
    capabilities: ["OPENAI_ASSISTANCE"],
    limits: [l],
    price: null,
    currency: null,
  };
  assert.equal(packageSnapshot(s).limits[0].value, null);
  assert.throws(() => packageSnapshot({ ...s, limits: [l, l] }));
  assert.throws(() =>
    packageSnapshot({ ...s, price: "10", currency: "PLN_INVALID" }),
  );
});
test("existing Development database binding requires exact role/host/database and strict TLS; no arbitrary options", () => {
  const ok =
    "postgresql://profitia_limits_runtime:synthetic@ep-muddy-surf-b9vpyy2d.c-7.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
  assert.equal(poolConfig(ok, "limits").ssl.rejectUnauthorized, true);
  for (const raw of [
    ok.replace("profitia_limits_runtime", "neondb_owner"),
    ok.replace("/neondb", "/production"),
    ok.replace("ep-muddy-surf-b9vpyy2d", "foreign"),
    ok + "&options=-c%20role%3Downer",
    ok.replace("sslmode=require", "sslmode=disable"),
  ])
    assert.throws(() => poolConfig(raw, "limits"));
});
test("catalog distinguishes observed OpenAI classes, API cost and commercial operations without claiming usage", () => {
  const ids = metrics.map((x) => x[0]);
  for (const id of [
    "OPENAI_INPUT_TOKENS",
    "OPENAI_OUTPUT_TOKENS",
    "OPENAI_CACHED_TOKENS",
    "OPENAI_REASONING_TOKENS",
    "OPENAI_TOTAL_TOKENS",
    "OPENAI_API_COST_USD",
    "MGBI_PAID_CALLS",
    "MACROBOND_REQUESTS",
  ])
    assert(ids.includes(id));
  assert.match(
    metrics.find((x) => x[0] === "OPENAI_TOTAL_TOKENS")[5],
    /bez ponownego/,
  );
  assert.match(
    metrics.find((x) => x[0] === "MGBI_PAID_CALLS")[5],
    /Cache hit nie/,
  );
});
