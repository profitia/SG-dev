import assert from "node:assert/strict";
import test from "node:test";
import { CATALOG_FRESHNESS_MS, isFreshCatalogEntry } from "./shared-catalog";

test("catalog freshness requires a valid past check within one day", () => {
  const now = new Date("2026-10-07T12:00:00Z");
  assert.equal(isFreshCatalogEntry(null, now), false);
  assert.equal(isFreshCatalogEntry("invalid", now), false);
  assert.equal(isFreshCatalogEntry(new Date(now.getTime() + 1), now), false);
  assert.equal(isFreshCatalogEntry(new Date(now.getTime() - CATALOG_FRESHNESS_MS + 1), now), true);
  assert.equal(isFreshCatalogEntry(new Date(now.getTime() - CATALOG_FRESHNESS_MS), now), false);
});
