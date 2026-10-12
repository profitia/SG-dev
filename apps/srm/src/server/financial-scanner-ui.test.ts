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
