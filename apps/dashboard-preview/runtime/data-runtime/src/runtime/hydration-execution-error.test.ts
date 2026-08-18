import assert from "node:assert/strict";
import test from "node:test";

import { normalizeHydrationExecutionError, sanitizeHydrationError } from "./hydration-execution-error.ts";

test("redacts postgres urls with credentials and hosts", () => {
  const sanitized = sanitizeHydrationError("postgresql://runtime:secret@example.invalid/neondb?sslmode=require failed");

  assert.doesNotMatch(sanitized, /runtime:secret/i);
  assert.doesNotMatch(sanitized, /example\.invalid/i);
  assert.match(sanitized, /REDACTED/i);
});

test("redacts snowflake password fragments", () => {
  const sanitized = sanitizeHydrationError("SNOWFLAKE_PASSWORD=SpendGuru_2_0 authentication failed");

  assert.doesNotMatch(sanitized, /SpendGuru_2_0/i);
  assert.match(sanitized, /SNOWFLAKE_PASSWORD=\[REDACTED\]/i);
});

test("redacts bearer tokens and authorization headers", () => {
  const sanitized = sanitizeHydrationError("Authorization: Bearer abc123.xyz token rejected");

  assert.doesNotMatch(sanitized, /abc123\.xyz/i);
  assert.match(sanitized, /REDACTED_AUTHORIZATION|REDACTED_TOKEN/i);
});

test("redacts private key blocks", () => {
  const sanitized = sanitizeHydrationError("-----BEGIN PRIVATE KEY-----\nsecret-material\n-----END PRIVATE KEY-----");

  assert.doesNotMatch(sanitized, /secret-material/i);
  assert.match(sanitized, /REDACTED_PRIVATE_KEY/i);
});

test("keeps normal business errors readable", () => {
  const sanitized = sanitizeHydrationError("Normalization rejected targetDate because it was invalid.");

  assert.equal(sanitized, "Normalization rejected targetDate because it was invalid.");
});

test("bounds overlong messages", () => {
  const sanitized = sanitizeHydrationError(`failure ${"x".repeat(500)}`);

  assert.ok(sanitized.length <= 320);
  assert.match(sanitized, /\.\.\.$/);
});

test("normalization returns failed stage and recoverability", () => {
  const normalized = normalizeHydrationExecutionError(new Error("fetch failed for https://example.invalid"), "connector");

  assert.equal(normalized.failedStage, "connector");
  assert.equal(normalized.recoverability, "retryable");
  assert.doesNotMatch(normalized.sanitizedMessage, /example\.invalid/i);
});