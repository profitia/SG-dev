import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { compactFinancialValue } from "../../node_modules/@profitia/srm-xray/src/financial-value";
import { nearestHistoryPoint, financialValue } from "../../node_modules/@profitia/srm-xray/src/financial-history";
import { FinancialIndicatorMethodology } from "../../node_modules/@profitia/srm-xray/src/financial-indicator-dialog";
import type { FinancialHistoryPoint } from "@profitia/srm-xray";

test("compact presentation preserves signs, null and small nonzero values without changing exact data", () => {
  for (const [value, unit, expected] of [
    ["1.379910", "RATIO", "1,4"], ["0.821578", "RATIO", "0,8"], ["8.23456", "PERCENT", "8,2%"],
    ["2400000", "PLN", "2,4 mln zł"], ["850000", "PLN", "850 tys. zł"], ["-2400000", "PLN", "−2,4 mln zł"],
    ["0", "RATIO", "0,0"], ["-0.000001", "RATIO", ">−0,1"], ["0.000001", "PERCENT", "<0,1%"],
    ["0.001", "PLN", "<0,01 zł"], ["-0.25", "PLN", "−0,25 zł"], ["23.456", "DAYS", "23,5 dni"]
  ] as const) assert.equal(compactFinancialValue(value, unit), expected);
  assert.equal(compactFinancialValue(null, "RATIO"), "Brak danych");
  assert.equal(compactFinancialValue("not-a-value", "PLN"), "Brak danych");
  assert.ok(!compactFinancialValue("9007199254740993123.456789", "PLN").includes("NaN"));
  assert.ok(financialValue("1.379910", "RATIO").includes("1,379910"));
});
test("exact result stays in methodology even when card presentation rounds", () => {
  const point = { value: "1.379910", status: "AVAILABLE", unit: "RATIO", formulaVersion: "1.2", scope: "standalone", evidence: [] } as unknown as FinancialHistoryPoint;
  const html = renderToStaticMarkup(React.createElement(FinancialIndicatorMethodology, { code: "CURRENT_RATIO", point, selectedPeriod: { from: "2025-01-01", to: "2025-12-31" } }));
  assert.match(html, /1,379910 ×/); assert.match(html, /2025-01-01/); assert.match(html, /1.2/);
});
test("nearest cursor selects actual available points only, no interpolation or global context write", () => {
  const points = [2023, 2024, 2025].map((year, index) => ({ code: "CURRENT_RATIO", scope: "standalone", periodStart: `${year}-01-01`, periodEnd: `${year}-12-31`, status: index === 1 ? "UNAVAILABLE" : "AVAILABLE", value: index === 1 ? null : String(index), comparison: { status: "UNKNOWN" } } as FinancialHistoryPoint));
  assert.equal(nearestHistoryPoint(points, 70), 0); assert.equal(nearestHistoryPoint(points, 419), 2);
  assert.equal(nearestHistoryPoint(points.map(point => ({ ...point, status: "UNAVAILABLE" })), 100), null);
  assert.equal(points[0].value, "0"); assert.equal(points[1].value, null);
});
test("rounding boundaries and leading zeros use decimal strings, not floating point precision", () => {
  assert.equal(compactFinancialValue("0001.05", "RATIO"), "1,1");
  assert.equal(compactFinancialValue("-1.05", "RATIO"), "−1,1");
  assert.equal(compactFinancialValue("999.995", "PLN").replaceAll(/\s/g, ""), "1000zł");
  assert.equal(compactFinancialValue("9007199254740993123.456789", "PLN").replaceAll(/\s/g, ""), "9007199254,7mldzł");
  for (const unit of ["PLN", "PERCENT", "RATIO", "DAYS"] as const) {
    assert.ok(compactFinancialValue("0.0000001", unit).startsWith("<"));
    assert.ok(compactFinancialValue("-0.0000001", unit).startsWith(">−"));
  }
});
