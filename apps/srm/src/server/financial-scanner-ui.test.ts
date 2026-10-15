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
  comparisonTone,
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
test("automatic comparison chooses nearest earlier available annual period across gaps, never other scopes", () => {
  const latest = period(2025),
    prior = period(2024),
    old = period(2023);
  assert.equal(previousAnnualPeriod([old, latest, prior], latest), prior);
  assert.equal(previousAnnualPeriod([latest, old], latest), old);
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

test("small changes retain direction instead of rounding to signed zero", () => {
  const prior = period(2024);
  const axis: Period["axes"][number] = {
    code: "OPERATING_COST_RATIO",
    rawValue: "96.6",
    unit: "PERCENT",
    normalizedScore: "10",
    basis: "HISTORICAL_BEST",
    reasonCode: null,
    alerts: [],
    tone: "caution",
    comparisons: [
      {
        periodId: prior.id,
        delta: "-0.022",
        deltaPercent: null,
        direction: "DOWN",
        favorable: "BETTER",
      },
    ],
  };
  assert.equal(comparisonLabel(axis, prior), "-0,02 pp");
  assert.equal(
    comparisonLabel(
      {
        ...axis,
        comparisons: [{ ...axis.comparisons![0], delta: "-0.000001" }],
      },
      prior,
    ),
    "−<0,01 pp",
  );
});

test("previous available selector rejects overlapping, short and future periods without mutating order", () => {
  const latest = period(2025), old = period(2023);
  const candidates = [period(2026), { ...period(2024), from: "2024-07-01" },
    { ...period(2024), from: "2024-07-01", to: "2025-06-30" }, latest, old];
  const before = JSON.stringify(candidates);
  assert.equal(previousAnnualPeriod(candidates, latest), old);
  assert.equal(previousAnnualPeriod(candidates, { ...latest, from: "2025-07-01" }), undefined);
  assert.equal(previousAnnualPeriod([latest], latest), undefined);
  assert.equal(previousAnnualPeriod(candidates), undefined);
  assert.equal(JSON.stringify(candidates), before);
});

test("best-history overlay accepts two different qualified observations, preserves singleton/equal guards", () => {
  const selected = period(2025);
  selected.axes = [{ code: "NET_RESULT", rawValue: "5", normalizedScore: "0", unit: "PLN",
    basis: "HISTORICAL_BEST", reasonCode: null, alerts: [], tone: "negative" }];
  const scanner: FinancialScannerProjection = {
    version: "1.1", methodologyVersion: "2.0.0", qualification: "QUALIFIED_HISTORY", sourceVersion: "test",
    periods: [selected], referenceFrames: [{ id: "frame", scope: "standalone", anchorPeriodId: selected.id,
      asOf: "2026-10-15T00:00:00Z", qualificationRule: "XML_SOURCE_BASIS_V1", axes: [{ code: "NET_RESULT",
        periodIds: [selected.id, period(2023).id], bestValue: "10", worstValue: "5", bestPeriodIds: [], basisKey: "net" }] }],
  };
  assert.equal(bestHistoryPeriod(scanner, selected)?.axes[0].normalizedScore, "100.000000");
  scanner.referenceFrames![0].axes[0].worstValue = "10";
  assert.equal(bestHistoryPeriod(scanner, selected)?.axes[0].normalizedScore, null);
  scanner.referenceFrames![0].axes[0].worstValue = "5";
  scanner.referenceFrames![0].axes[0].periodIds = [selected.id];
  assert.equal(bestHistoryPeriod(scanner, selected)?.axes[0].normalizedScore, null);
});


test("label and assistant comparison colors follow favorable direction, including lower-is-better and missing comparisons", () => {
  const prior = period(2024);
  const axis: Period["axes"][number] = {
    code: "LIABILITIES_TO_ASSETS", rawValue: "14", unit: "PERCENT",
    normalizedScore: "100", basis: "HISTORICAL_BEST", reasonCode: null,
    alerts: [], tone: "positive",
    comparisons: [{periodId: prior.id, delta: "-3.3", deltaPercent: null, direction: "DOWN", favorable: "BETTER"}],
  };
  assert.equal(comparisonTone(axis, prior), "positive");
  const worse = {...axis, code: "OPERATING_COST_RATIO" as const, comparisons: [{...axis.comparisons![0], delta: "2.1", direction: "UP" as const, favorable: "WORSE" as const}]};
  assert.equal(comparisonTone(worse, prior), "negative");
  const liquidity = {...worse, code: "CURRENT_RATIO" as const};
  assert.equal(comparisonTone(liquidity, prior), "negative");
  assert.equal(axisTone(liquidity, prior), "positive", "absolute liquidity fill policy is unchanged");
  assert.equal(comparisonTone({...axis, comparisons: [{...axis.comparisons![0], delta: "0", direction: "UNCHANGED", favorable: "UNCHANGED"}]}, prior), "caution");
  assert.equal(comparisonTone(axis), "unknown");
  assert.equal(comparisonTone(axis, period(2023)), "unknown");
  assert.equal(comparisonTone(undefined, prior), "unknown");
});
