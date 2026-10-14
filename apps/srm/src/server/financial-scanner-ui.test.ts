import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FinancialScannerMount } from "@profitia/srm-xray";
import {
  validatePreferences,
  validYear,
} from "../../../../packages/srm-xray/src/financial-explorer-model";
const cards = [
    { code: "CURRENT_RATIO" },
    { code: "QUICK_RATIO" },
    { code: "ROA" },
  ],
  groups = [{ id: "liquidity" }, { id: "debt" }];
const getYears = (code: string) =>
  code === "CURRENT_RATIO"
    ? [2025, 2024, 2023]
    : code === "QUICK_RATIO"
      ? [2025, 2024]
      : [];
test("restored preferences preserve independent tab/custom years and never retain missing values", () => {
  const prefs = validatePreferences(
    {
      tab: "custom",
      selected: ["CURRENT_RATIO", "QUICK_RATIO", "ROA", "INJECTED"],
      tabYears: { liquidity: 2025, debt: 2024 },
      customYears: { CURRENT_RATIO: 2023, QUICK_RATIO: 2017, ROA: 2025 },
      financialData: { secret: "discard" },
    },
    cards,
    groups,
    [2025, 2024, 2023],
    getYears,
  );
  assert.deepEqual(prefs, {
    tab: "custom",
    selected: ["CURRENT_RATIO", "QUICK_RATIO"],
    tabYears: { liquidity: 2025, debt: 2024 },
    customYears: { CURRENT_RATIO: 2023, QUICK_RATIO: 2025 },
  });
  assert.equal(validYear(2017, []), undefined);
  assert.equal(validYear(0, [2025]), 2025);
});
test("malformed persisted preferences fail safely without affecting financial data", () => {
  for (const value of [null, [], 1, { selected: "bad" }])
    assert.deepEqual(
      validatePreferences(value, cards, groups, [2025], getYears),
      { tab: "overview", selected: [], tabYears: {}, customYears: {} },
    );
});
test("empty independent mount has six sectors, functional explorer and empty AI placeholder without sample values", () => {
  const html = renderToStaticMarkup(
    React.createElement(FinancialScannerMount, { report: null }),
  );
  assert.match(html, /Supplier Finance Scanner/);
  assert.match(html, /Ocena SpendGuru/);
  assert.equal([...html.matchAll(/class="srm-sector-track"/g)].length, 6);
  assert.equal([...html.matchAll(/role="tab"/g)].length, 6);
  assert.match(html, /Brak danych/);
  assert.doesNotMatch(
    html,
    /Unilever|5213390341|demoValues|3,9|sześć perspektyw/i,
  );
  assert.match(html, /aria-label="Miejsce na ocenę SpendGuru"/);
});

import {
  previousAnnualPeriod,
  canOverlay,
  axisTone,
  comparisonLabel,
  bestHistoryPeriod,
} from "../../../../packages/srm-xray/src/financial-scanner-model";
import type { FinancialScannerProjection } from "@profitia/srm-xray";
type Period = FinancialScannerProjection["periods"][number];
const period = (year: number, frame = "frame"): Period => ({
  id: `standalone:${year}-01-01:${year}-12-31`,
  from: `${year}-01-01`,
  to: `${year}-12-31`,
  scope: "standalone",
  documentRef: `doc-${year}`,
  referenceFrameId: frame,
  axes: [],
});
test("automatic comparison chooses exactly adjacent annual period; never bridges missing years or scopes", () => {
  const latest = period(2025),
    prior = period(2024),
    old = period(2023);
  assert.equal(previousAnnualPeriod([old, latest, prior], latest), prior);
  assert.equal(previousAnnualPeriod([latest, old], latest), undefined);
  assert.equal(
    previousAnnualPeriod([latest, { ...prior, scope: "consolidated" }], latest),
    undefined,
  );
  assert.equal(canOverlay(latest, prior), true);
  assert.equal(canOverlay(latest, period(2024, "other-frame")), false);
});
test("colors follow server-qualified direction and liquidity retains its absolute policy", () => {
  const prior = period(2024);
  const a: Period["axes"][number] = {
    code: "OPERATING_COST_RATIO",
    rawValue: "80",
    unit: "PERCENT",
    normalizedScore: "90",
    basis: "HISTORICAL_BEST",
    reasonCode: null,
    alerts: [],
    tone: "caution",
    comparisons: [
      {
        periodId: prior.id,
        delta: "-10",
        deltaPercent: null,
        direction: "DOWN",
        favorable: "BETTER",
      },
    ],
  };
  assert.equal(axisTone(a, prior), "positive");
  assert.equal(comparisonLabel(a, prior), "-10 pp");
  assert.equal(
    axisTone(
      { ...a, comparisons: [{ ...a.comparisons![0], favorable: "WORSE" }] },
      prior,
    ),
    "negative",
  );
  assert.equal(
    axisTone(
      { ...a, comparisons: [{ ...a.comparisons![0], favorable: "UNCHANGED" }] },
      prior,
    ),
    "caution",
  );
  assert.equal(
    axisTone({ ...a, code: "CURRENT_RATIO", tone: "negative" }, prior),
    "negative",
  );
});
