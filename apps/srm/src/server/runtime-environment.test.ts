import test from "node:test";
import assert from "node:assert/strict";
import {
  assertProductConnection,
  productEnvironmentReady,
  productOrganizationId,
} from "./runtime-environment";
const env = (target: string) => ({
  TARGET_ENVIRONMENT: target,
  SRM_NEON_PROJECT_ID: "snowy-breeze-40315151",
  SRM_NEON_BRANCH_ID:
    target === "development"
      ? "br-dark-surf-b1vrhda9"
      : "br-broad-butterfly-b11t4v01",
  SRM_DEVELOPMENT_ORGANIZATION_ID: "development-only",
  SRM_STAGING_ORGANIZATION_ID: "staging-only",
});
const url = (host: string, database = "srm_app") =>
  "postgresql://srm_app_runtime:test-only@" +
  host +
  "/" +
  database +
  "?sslmode=require";
const dev = "ep-red-smoke-b16ih64d.c-5.eu-central-1.aws.neon.tech";
const stage = "ep-autumn-wildflower-b1mv0vda.c-5.eu-central-1.aws.neon.tech";
test("Development and Staging have separate organizations", () => {
  assert.equal(productOrganizationId(env("development")), "development-only");
  assert.equal(productOrganizationId(env("staging")), "staging-only");
  assert.equal(productOrganizationId(env("production")), undefined);
  assert.equal(
    productEnvironmentReady({ TARGET_ENVIRONMENT: "staging" }),
    false,
  );
});
test("only the exact branch/endpoint/db/runtime role combination is accepted", () => {
  assert.doesNotThrow(() =>
    assertProductConnection(url(dev), env("development")),
  );
  assert.doesNotThrow(() =>
    assertProductConnection(url(stage), env("staging")),
  );
  assert.throws(() => assertProductConnection(url(stage), env("development")));
  assert.throws(() => assertProductConnection(url(dev), env("staging")));
  assert.throws(() => assertProductConnection(url(stage), env("production")));
  assert.throws(() =>
    assertProductConnection(url(dev, "srm_pmos"), env("development")),
  );
  assert.throws(() =>
    assertProductConnection(
      url(dev).replace("srm_app_runtime", "neondb_owner"),
      env("development"),
    ),
  );
  assert.throws(() =>
    assertProductConnection(url(dev), {
      ...env("development"),
      SRM_NEON_PROJECT_ID: "bold-breeze-68888550",
    }),
  );
  assert.throws(() =>
    assertProductConnection(url(dev), {
      ...env("development"),
      SRM_NEON_BRANCH_ID: "br-nameless-bar-b1wlhjhx",
    }),
  );
});
test("Staging cannot default to Development credentials", () => {
  assert.throws(() => assertProductConnection(url(stage), {}));
  assert.throws(() =>
    assertProductConnection(url(stage), { TARGET_ENVIRONMENT: "staging" }),
  );
  assert.equal(
    productOrganizationId({
      TARGET_ENVIRONMENT: "staging",
      SRM_NEON_PROJECT_ID: "snowy-breeze-40315151",
      SRM_NEON_BRANCH_ID: "br-broad-butterfly-b11t4v01",
      SRM_DEVELOPMENT_ORGANIZATION_ID: "foreign",
    }),
    undefined,
  );
});

import { createDemoSession, verifyDemoSession } from "./demo-auth";
test("Development session cannot authenticate with the isolated Staging secret", async () => {
  const a = "development-test-secret-at-least-32-characters";
  const b = "staging-test-secret-at-least-32-characters";
  const token = await createDemoSession(a);
  assert.equal(await verifyDemoSession(b, token), false);
  assert.equal(await verifyDemoSession(a, token), true);
});
test("Development with Staging branch identity is rejected before product activity", () =>
  assert.equal(
    productEnvironmentReady({
      TARGET_ENVIRONMENT: "development",
      SRM_NEON_PROJECT_ID: "snowy-breeze-40315151",
      SRM_NEON_BRANCH_ID: "br-broad-butterfly-b11t4v01",
    }),
    false,
  ));
for (const suffix of [
  "&host=evil.example",
  "&sslmode=disable",
  "&options=-c%20search_path%3Devil",
  "#fragment",
])
  test("runtime refuses connection override " + suffix, () =>
    assert.throws(() =>
      assertProductConnection(
        "postgresql://srm_app_runtime:test-only@ep-red-smoke-b16ih64d.c-5.eu-central-1.aws.neon.tech/srm_app?sslmode=require" +
          suffix,
        { TARGET_ENVIRONMENT: "development" },
      ),
    ),
  );
