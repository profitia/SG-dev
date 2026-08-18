import assert from "node:assert/strict";
import test from "node:test";

import { createDeduplicationResult } from "./__test-helpers__/deduplication.ts";
import {
  createForecastAccuracyDedupeKey,
  createForecastAccuracyStoreResult,
  normalizeForecastAccuracyBenchmarkCode,
} from "./forecast-accuracy-records.ts";
import type { NormalizedRecord } from "./normalization-result.ts";

test("expands a normalized record into four horizon records", () => {
  const record = createNormalizedRecord({
    tableName: "MACROBOND_SERIES_LMEOFALCASHASK",
    orgTableName: "ALUMINIUM - lmeofalcashask",
    targetDate: "2026-05-01T00:00:00.000Z",
    wartoscRzeczywista: 100,
    prognoza1m: 101,
    prognoza3m: 103,
    prognoza6m: 106,
    prognoza12m: 112,
    roznica1m: 1,
    roznica3m: 3,
    roznica6m: 6,
    roznica12m: 12,
    rodzajBledu1m: "OVER",
    rodzajBledu3m: "OVER",
    rodzajBledu6m: "OVER",
    rodzajBledu12m: "OVER",
  });

  const result = createForecastAccuracyStoreResult([record], createDeduplicationResult([record]));

  assert.equal(result.forecastAccuracyRecords.length, 4);
  assert.deepEqual(result.forecastAccuracyRecords.map((candidate) => candidate.horizonMonths), [1, 3, 6, 12]);
});

test("keeps only 1M when other forecasts are null", () => {
  const record = createNormalizedRecord({
    tableName: "ZWIR",
    targetDate: "2026-05-01T00:00:00.000Z",
    wartoscRzeczywista: 10,
    prognoza1m: 11,
    prognoza3m: null,
    prognoza6m: null,
    prognoza12m: null,
  });

  const result = createForecastAccuracyStoreResult([record], createDeduplicationResult([record]));

  assert.equal(result.forecastAccuracyRecords.length, 1);
  assert.equal(result.forecastAccuracyRecords[0]?.horizonMonths, 1);
});

test("skips horizons with null forecast values", () => {
  const record = createNormalizedRecord({
    tableName: "ZWIR",
    targetDate: "2026-05-01T00:00:00.000Z",
    wartoscRzeczywista: 10,
    prognoza1m: null,
    prognoza3m: 13,
  });

  const result = createForecastAccuracyStoreResult([record], createDeduplicationResult([record]));

  assert.equal(result.forecastAccuracyRecords.length, 1);
  assert.equal(result.forecastAccuracyRecords[0]?.horizonMonths, 3);
});

test("maps difference and error type to the expanded horizon record", () => {
  const record = createNormalizedRecord({
    tableName: "ZWIR",
    targetDate: "2026-05-01T00:00:00.000Z",
    wartoscRzeczywista: 10,
    prognoza1M: 9,
    roznica1M: -1,
    rodzajBledu1M: "UNDER",
  });

  const result = createForecastAccuracyStoreResult([record], createDeduplicationResult([record]));
  const expanded = result.forecastAccuracyRecords[0];

  assert.equal(expanded?.differenceValue, -1);
  assert.equal(expanded?.errorType, "UNDER");
});

test("normalizes prefixed benchmark table names", () => {
  assert.equal(normalizeForecastAccuracyBenchmarkCode("MACROBOND_SERIES_LMEOFALCASHASK"), "lmeofalcashask");
});

test("normalizes non-prefixed benchmark table names", () => {
  assert.equal(normalizeForecastAccuracyBenchmarkCode("ZWIR"), "zwir");
});

test("normalizes benchmark names with spaces and separators", () => {
  assert.equal(normalizeForecastAccuracyBenchmarkCode("HDPE - Plastech"), "hdpe_plastech");
});

test("returns null for an unmapped benchmark name", () => {
  assert.equal(normalizeForecastAccuracyBenchmarkCode("MACROBOND_SERIES_"), null);
});

test("creates a deterministic dedupe key", () => {
  const targetDate = new Date("2026-05-01T00:00:00.000Z");

  assert.equal(
    createForecastAccuracyDedupeKey("zwir", targetDate, 3),
    createForecastAccuracyDedupeKey("zwir", targetDate, 3),
  );
});

test("invalid dates are rejected", () => {
  const record = createNormalizedRecord({
    tableName: "ZWIR",
    targetDate: "not-a-date",
    wartoscRzeczywista: 10,
    prognoza1m: 11,
  });

  const result = createForecastAccuracyStoreResult([record], createDeduplicationResult([record]));

  assert.equal(result.forecastAccuracyRecords.length, 0);
  assert.equal(result.errors[0]?.field, "targetDate");
});

test("actual value zero is preserved", () => {
  const record = createNormalizedRecord({
    tableName: "ZWIR",
    targetDate: "2026-05-01T00:00:00.000Z",
    wartoscRzeczywista: 0,
    prognoza1m: 1,
  });

  const result = createForecastAccuracyStoreResult([record], createDeduplicationResult([record]));

  assert.equal(result.forecastAccuracyRecords[0]?.actualValue, 0);
});

test("duplicate input records preserve duplicate counts on expanded output", () => {
  const record = createNormalizedRecord({
    tableName: "ZWIR",
    targetDate: "2026-05-01T00:00:00.000Z",
    wartoscRzeczywista: 10,
    prognoza1m: 11,
  });

  const result = createForecastAccuracyStoreResult([record], createDeduplicationResult([record, record]));

  assert.equal(result.forecastAccuracyRecords[0]?.duplicateCount, 1);
  assert.equal(result.forecastAccuracyRecords[0]?.rawRecordCount, 2);
});

function createNormalizedRecord(fields: Record<string, string | number | boolean | null>): NormalizedRecord {
  return {
    position: 0,
    duplicateKey: JSON.stringify(fields),
    duplicateStatus: "UNIQUE",
    fields,
  };
}