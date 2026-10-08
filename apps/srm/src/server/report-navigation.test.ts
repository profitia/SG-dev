import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { currentReportSection, ReportNavigation } from "../modules/xray/report-navigation";

const starts = [{ id: "identity", top: 100 }, { id: "finance", top: 400 }, { id: "details", top: 2400 }, { id: "kys", top: 5400 }];
test("scroll orientation follows document order in both directions and the last visible section", () => {
  assert.equal(currentReportSection(starts, 0, ""), "identity");
  assert.equal(currentReportSection(starts, 450, "identity"), "finance");
  assert.equal(currentReportSection(starts, 2450, "finance"), "details");
  assert.equal(currentReportSection(starts, 4000, "kys"), "details");
  assert.equal(currentReportSection(starts, 300, "finance"), "identity");
  assert.equal(currentReportSection(starts, 5200, "details", true), "kys");
  assert.equal(currentReportSection([], 500, "finance"), "");
});
test("section boundaries have a stable dead band; clicked/current targets do not oscillate", () => {
  for (const marker of [400, 404, 411]) assert.equal(currentReportSection(starts, marker, "identity"), "identity");
  assert.equal(currentReportSection(starts, 413, "identity"), "finance");
  for (const marker of [399, 394, 389]) assert.equal(currentReportSection(starts, marker, "finance"), "finance");
  assert.equal(currentReportSection(starts, 387, "finance"), "identity");
  assert.equal(currentReportSection(starts, 400, "finance"), "finance");
});
test("resized/expanded report uses updated boundaries without inventing absent sections", () => {
  const expanded = starts.map(section => ({ ...section, top: section.top + (section.id === "details" || section.id === "kys" ? 1800 : 0) }));
  assert.equal(currentReportSection(expanded, 3000, "details"), "finance");
  const jdg = starts.filter(section => section.id !== "finance");
  assert.equal(currentReportSection(jdg, 1000, "finance"), "identity");
});
test("navigation has accessible current location and synchronized compact selector; no absent link", () => {
  const items = [{ id: "identity", label: "Podsumowanie" }, { id: "kys", label: "KYS" }];
  const html = renderToStaticMarkup(React.createElement(ReportNavigation, { root: { current: null }, items }));
  assert.match(html, /href="#identity" aria-current="location"/);
  assert.match(html, /value="identity" selected/);
  assert.doesNotMatch(html, /Źródła|#finance|#details/);
});
