import assert from "node:assert/strict";
import test from "node:test";
import { CATALOG_FRESHNESS_MS, FINANCIAL_MAPPING_VERSION, catalogFreshnessMs, isCurrentFinancialMapping, isFreshCatalogEntry } from "./shared-catalog";

test("MGBI catalog reuses a valid check for seven days, then requires a refresh", () => {
  const now = new Date("2026-10-07T12:00:00Z");
  assert.equal(CATALOG_FRESHNESS_MS, 168 * 60 * 60 * 1000);
  assert.equal(isFreshCatalogEntry(null, now), false);
  assert.equal(isFreshCatalogEntry("invalid", now), false);
  assert.equal(isFreshCatalogEntry(new Date(now.getTime() + 1), now), false);
  assert.equal(isFreshCatalogEntry(new Date(now.getTime() - CATALOG_FRESHNESS_MS + 1), now), true);
  assert.equal(isFreshCatalogEntry(new Date(now.getTime() - CATALOG_FRESHNESS_MS), now), false);
});

test("MGBI freshness can only be shortened and applies to already stored checks", () => {
  const hour = 60 * 60 * 1000;
  assert.equal(catalogFreshnessMs({ SRM_MGBI_CACHE_TTL_HOURS: "24" }), 24 * hour);
  assert.equal(catalogFreshnessMs({ SRM_MGBI_CACHE_TTL_HOURS: "" }), CATALOG_FRESHNESS_MS);
  for (const value of ["0", "169", "1.5", "invalid", "Infinity"]) {
    assert.throws(() => catalogFreshnessMs({ SRM_MGBI_CACHE_TTL_HOURS: value }), /SRM_MGBI_CACHE_TTL_HOURS/);
  }
  const now = new Date("2026-10-08T12:00:00Z");
  const checked = new Date(now.getTime() - 25 * hour);
  assert.equal(isFreshCatalogEntry(checked, now), true);
  assert.equal(isFreshCatalogEntry(checked, now, catalogFreshnessMs({ SRM_MGBI_CACHE_TTL_HOURS: "24" })), false);
});

test("financial cache requires the current source mapping", () => {
  assert.equal(isCurrentFinancialMapping(null), false);
  assert.equal(isCurrentFinancialMapping({} as never), false);
  assert.equal(isCurrentFinancialMapping({ catalogMappingVersion: "2026-10-07-extracted-v1" } as never), false);
  assert.equal(isCurrentFinancialMapping({ catalogMappingVersion: FINANCIAL_MAPPING_VERSION } as never), true);
});
