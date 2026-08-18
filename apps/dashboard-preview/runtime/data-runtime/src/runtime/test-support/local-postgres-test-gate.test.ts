import assert from "node:assert/strict";
import test from "node:test";

import {
  LOCAL_TEST_DATABASE_URL_MISSING,
  MALFORMED_TEST_DATABASE_URL,
  NON_LOCAL_DATABASE_URL_REJECTED,
  resolveLocalIntegrationDatabaseUrl,
} from "./local-postgres-test-gate.ts";

test("disabled gate returns null without inspecting runtime URLs", () => {
  const resolved = resolveLocalIntegrationDatabaseUrl({
    ALLOW_LOCAL_DATA_RUNTIME_DB_TESTS: "false",
    TEST_DATABASE_URL: "postgresql://user:pass@example.invalid/db",
    DATABASE_URL: "postgresql://user:pass@example.invalid/db",
    DIRECT_URL: "postgresql://user:pass@example.invalid/db",
  });

  assert.equal(resolved, null);
});

test("missing TEST_DATABASE_URL fails when local DB gate is enabled", () => {
  assert.throws(
    () => resolveLocalIntegrationDatabaseUrl({ ALLOW_LOCAL_DATA_RUNTIME_DB_TESTS: "true" }),
    new RegExp(LOCAL_TEST_DATABASE_URL_MISSING),
  );
});

test("malformed TEST_DATABASE_URL fails before prisma client construction", () => {
  assert.throws(
    () => resolveLocalIntegrationDatabaseUrl({
      ALLOW_LOCAL_DATA_RUNTIME_DB_TESTS: "true",
      TEST_DATABASE_URL: "not-a-url",
    }),
    new RegExp(MALFORMED_TEST_DATABASE_URL),
  );
});

test("non-local hostname is rejected before prisma client construction", () => {
  assert.throws(
    () => resolveLocalIntegrationDatabaseUrl({
      ALLOW_LOCAL_DATA_RUNTIME_DB_TESTS: "true",
      TEST_DATABASE_URL: "postgresql://test:test@example.invalid/test",
    }),
    new RegExp(NON_LOCAL_DATABASE_URL_REJECTED),
  );
});

test("localhost TEST_DATABASE_URL is accepted", () => {
  const resolved = resolveLocalIntegrationDatabaseUrl({
    ALLOW_LOCAL_DATA_RUNTIME_DB_TESTS: "true",
    TEST_DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  });

  assert.equal(resolved, "postgresql://test:test@localhost:5432/test");
});

test("127.0.0.1 TEST_DATABASE_URL is accepted", () => {
  const resolved = resolveLocalIntegrationDatabaseUrl({
    ALLOW_LOCAL_DATA_RUNTIME_DB_TESTS: "true",
    TEST_DATABASE_URL: "postgresql://test:test@127.0.0.1:5432/test",
  });

  assert.equal(resolved, "postgresql://test:test@127.0.0.1:5432/test");
});

test("IPv6 loopback TEST_DATABASE_URL is accepted", () => {
  const resolved = resolveLocalIntegrationDatabaseUrl({
    ALLOW_LOCAL_DATA_RUNTIME_DB_TESTS: "true",
    TEST_DATABASE_URL: "postgresql://test:test@[::1]:5432/test",
  });

  assert.equal(resolved, "postgresql://test:test@[::1]:5432/test");
});