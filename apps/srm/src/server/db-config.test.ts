import assert from "node:assert/strict";
import test from "node:test";
import { runtimeConnectionString } from "./db";

test("builds a least-privilege Neon URL from a separately entered secret", () => {
  const url = new URL(runtimeConnectionString({
    SRM_APP_DATABASE_HOST: "ep-red-smoke-b16ih64d-pooler.c-5.eu-central-1.aws.neon.tech",
    SRM_APP_DATABASE_PASSWORD: "secret:/?# with spaces",
  }));
  assert.equal(url.username, "srm_app_runtime");
  assert.equal(url.password, "secret%3A%2F%3F%23%20with%20spaces");
  assert.equal(url.pathname, "/srm_app");
  assert.equal(url.searchParams.get("sslmode"), "require");
  assert.equal(url.searchParams.get("channel_binding"), "require");
});

test("refuses an incomplete or foreign database destination", () => {
  assert.throws(() => runtimeConnectionString({}), /configuration is required/);
  assert.throws(() => runtimeConnectionString({ SRM_APP_DATABASE_HOST: "other.example", SRM_APP_DATABASE_PASSWORD: "secret" }), /host is invalid/);
});
