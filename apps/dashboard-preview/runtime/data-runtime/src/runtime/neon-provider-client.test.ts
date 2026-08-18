import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNeonApiUrl,
  describeNeonProviderHttpFailure,
  normalizeNeonApiBaseUrl,
  OFFICIAL_NEON_API_BASE_URL,
} from "./neon-provider-client.ts";

test("trailing slash normalization preserves canonical api root", () => {
  assert.equal(normalizeNeonApiBaseUrl("https://console.neon.tech/api/v2/"), OFFICIAL_NEON_API_BASE_URL);
  assert.equal(
    buildNeonApiUrl("https://console.neon.tech/api/v2/", "/projects/project-1").toString(),
    "https://console.neon.tech/api/v2/projects/project-1",
  );
});

test("double api prefix is prevented when request path starts with slash", () => {
  assert.equal(
    buildNeonApiUrl("https://console.neon.tech/api/v2", "/projects/project-1").toString(),
    "https://console.neon.tech/api/v2/projects/project-1",
  );
});

test("custom production origin is rejected", () => {
  assert.throws(
    () => normalizeNeonApiBaseUrl("https://example.invalid/api/v2"),
    /non-official origin/,
  );
});

test("404 classification is stage-specific", () => {
  assert.equal(describeNeonProviderHttpFailure("PROJECT_LOOKUP", 404).code, "PROVIDER_TARGET_IDENTITY_PROJECT_NOT_FOUND");
  assert.equal(describeNeonProviderHttpFailure("ENDPOINT_LOOKUP", 404).code, "PROVIDER_TARGET_IDENTITY_ENDPOINT_NOT_FOUND");
  assert.equal(describeNeonProviderHttpFailure("BRANCH_LOOKUP", 404).code, "PROVIDER_TARGET_IDENTITY_BRANCH_NOT_FOUND");
  assert.equal(describeNeonProviderHttpFailure("DATABASE_LOOKUP", 404).code, "PROVIDER_TARGET_IDENTITY_DATABASE_NOT_FOUND");
});