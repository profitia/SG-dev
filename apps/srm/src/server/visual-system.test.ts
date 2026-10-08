import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { FinancialPeriodSelector, financialPeriodLabel } from "../modules/xray/financial-period-selector";

const annual = { from: "2025-01-01", to: "2025-12-31" };
test("period control preserves all canonical pairs, order and selection without financial transformations", () => {
  const periods = [annual, { from: "2024-04-01", to: "2025-03-31" }, { from: "2025-01-01", to: "2025-06-30" }, { from: "2010-01-01", to: "2010-12-31" }];
  const before = JSON.stringify(periods);
  const html = renderToStaticMarkup(React.createElement(FinancialPeriodSelector, { periods, selected: periods[1], onSelect: () => { throw Error("Render cannot select or fetch"); } }));
  assert.equal(JSON.stringify(periods), before);
  assert.equal([...html.matchAll(/data-financial-period=/g)].length, periods.length);
  assert.equal([...html.matchAll(/aria-pressed="true"/g)].length, 1);
  assert.match(html, /2024-04-01 – 2025-03-31/);
  assert.match(html, /2025-01-01 – 2025-06-30/);
  assert.match(html, />2010<\/button>/);
  assert.ok(html.indexOf("2025-01-01:2025-12-31") < html.indexOf("2010-01-01:2010-12-31"));
  assert.doesNotMatch(html, /<select|MGBI|Vercly|PRIVATE_DOCUMENT/);
});
test("short years only label unique full calendar periods; noncalendar or same-year periods retain full dates", () => {
  assert.equal(financialPeriodLabel(annual, [annual]), "2025");
  const partial = { from: "2025-01-01", to: "2025-06-30" };
  assert.equal(financialPeriodLabel(annual, [annual, partial]), "2025-01-01 – 2025-12-31");
  assert.equal(financialPeriodLabel(partial, [partial]), "2025-01-01 – 2025-06-30");
  const noncalendar = { from: "2024-07-01", to: "2025-06-30" };
  assert.equal(financialPeriodLabel(noncalendar, [noncalendar]), "2024-07-01 – 2025-06-30");
});
test("empty periods do not manufacture a selection or an unavailable control", () => {
  assert.equal(renderToStaticMarkup(React.createElement(FinancialPeriodSelector, { periods: [], selected: null, onSelect: () => {} })), "");
  const html = renderToStaticMarkup(React.createElement(FinancialPeriodSelector, { periods: [annual], selected: null, onSelect: () => {} }));
  assert.match(html, /Wybrany okres: nie ustalono/); assert.doesNotMatch(html, /aria-pressed="true"/);
});
test("host skin has full-width report, self-hosted Inter and single semantic palette without a global clipping workaround", () => {
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /\.report-page \{ width: 100%; max-width: none;/);
  assert.match(css, /url\("\/fonts\/InterVariable.woff2"\)/);
  assert.match(css, /--srm-brand: #242F44/); assert.match(css, /--srm-interaction: #006D9E/);
  assert.match(css, /font-variant-numeric: tabular-nums/);
  assert.doesNotMatch(css, /1680px|@import|fonts\.googleapis|body[^}]*overflow-x:\s*hidden/);
  assert.match(readFileSync("public/fonts/LICENSE-Inter.txt", "utf8"), /SIL OPEN FONT LICENSE Version 1.1/);
  assert.equal(readFileSync("public/fonts/InterVariable.woff2").subarray(0, 4).toString(), "wOF2");
});
