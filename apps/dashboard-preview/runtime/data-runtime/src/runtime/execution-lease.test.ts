import assert from "node:assert/strict";
import test from "node:test";

import { createExecutionLeaseIdentity, toPrismaBytes } from "./execution-lease.ts";

test("prisma bytes helper preserves a lease-token digest for persistence and comparison", () => {
  const identity = createExecutionLeaseIdentity();
  const persistedDigest = toPrismaBytes(identity.tokenHash);
  const comparisonDigest = toPrismaBytes(identity.tokenHash);

  assert.deepEqual(Array.from(persistedDigest), Array.from(comparisonDigest));
  assert.notDeepEqual(Array.from(identity.rawToken), Array.from(persistedDigest));
});

test("different lease-token digests remain distinguishable at the prisma bytes boundary", () => {
  const first = createExecutionLeaseIdentity();
  const second = createExecutionLeaseIdentity();

  assert.notDeepEqual(Array.from(toPrismaBytes(first.tokenHash)), Array.from(toPrismaBytes(second.tokenHash)));
});