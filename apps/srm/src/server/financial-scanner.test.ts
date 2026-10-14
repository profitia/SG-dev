import assert from "node:assert/strict";
import test from "node:test";
import { financialScanner, currentRatioPosition } from "./financial-scanner";
import { projectReportData } from "./report-data";
import type {
  FinancialFactEvidence,
  FinancialHistoryPoint,
} from "@profitia/srm-xray";
function financial() {
  return projectReportData(
    { nip: "5213390341", entityType: "COMPANY" },
    {
      nip: "5213390341",
      financial_json: null,
      financial_sha256: null,
      financial_checked_at: null,
      facts: [],
      indicators: [],
      kys: null,
    },
    new Date("2026-10-12"),
    {},
  ).financial;
}
const fact = (metricCode: string, amount: string): FinancialFactEvidence => ({
  ref: metricCode,
  documentRef: "doc",
  metricCode,
  periodStart: "2025-01-01",
  periodEnd: "2025-12-31",
  scope: "standalone",
  amount,
  sourceAmount: amount,
  currency: "PLN",
  unit: "PLN",
  validation: "VERIFIED",
  normalization: "SOURCE_VALUE",
  normalizationRule: "SOURCE_VALUE",
  reasonCode: null,
});
const point = (value: string): FinancialHistoryPoint => ({
  code: "CURRENT_RATIO",
  periodStart: "2025-01-01",
  periodEnd: "2025-12-31",
  scope: "standalone",
  status: "AVAILABLE",
  value,
  unit: "RATIO",
  importance: 3,
  reasonCode: null,
  formulaVersion: "1.2",
  year: "2025",
  documentRef: "doc",
  definitionRef: { code: "CURRENT_RATIO", formulaVersion: "1.2" },
  evidence: [fact("BS_A_CA", "120"), fact("BS_LAE_LAPFL_STL", "100")],
  comparison: {
    status: "UNKNOWN",
    reasonCode: "DOCUMENT_COMPARABILITY_UNCONFIRMED",
    previousPeriod: null,
    delta: null,
    unit: "RATIO",
    direction: "NO_COMPARISON",
  },
});
test("canonical liquidity thresholds use exact decimal arithmetic and saturate at 2", () => {
  for (const [raw, score, tone] of [
    ["0.8", "40.000000", "negative"],
    ["1", "50.000000", "caution"],
    ["1.199999", "59.999950", "caution"],
    ["1.2", "60.000000", "positive"],
    ["2", "100.000000", "positive"],
    ["3.9", "100.000000", "positive"],
  ])
    assert.deepEqual(
      [currentRatioPosition(raw).score, currentRatioPosition(raw).tone],
      [score, tone],
    );
  for (const raw of [null, "-0.1", "Infinity", "", "0xFF"])
    assert.equal(currentRatioPosition(raw).score, null);
  assert.equal(currentRatioPosition("0").score, "0.000000");
});
test("six stable axes preserve source values, losses and missing cost basis without inventing a benchmark", () => {
  const f = financial();
  f.periods = [
    {
      from: "2025-01-01",
      to: "2025-12-31",
      year: "2025",
      scope: "standalone",
      documentRef: "doc",
      facts: [
        fact("PALA_NPL", "-5.00"),
        fact("PALA_NRFS", "0"),
        fact("PALA_OAC", "90"),
      ],
    },
  ];
  f.history = [
    { code: "CURRENT_RATIO", reasonCode: null, points: [point("1.2")] },
  ];
  const before = JSON.stringify(f),
    result = financialScanner(f),
    axes = result.periods[0].axes;
  assert.equal(JSON.stringify(f), before);
  assert.equal(result.qualification, "PARTIAL_SOURCE_VIEW");
  assert.deepEqual(
    axes.map((a) => a.code),
    [
      "NET_RESULT",
      "REVENUE",
      "CURRENT_RATIO",
      "OPERATING_MARGIN",
      "OPERATING_COST_RATIO",
      "LIABILITIES_TO_ASSETS",
    ],
  );
  assert.equal(axes[0].rawValue, "-5.00");
  assert.deepEqual(axes[0].alerts, ["NET_LOSS"]);
  assert.equal(axes[0].tone, "negative");
  assert.equal(axes[1].rawValue, "0");
  assert.equal(axes[2].normalizedScore, "60.000000");
  assert.equal(axes[4].rawValue, null);
  assert.equal(axes[4].reasonCode, "SOURCE_MAPPING_UNCONFIRMED");
  assert.ok(
    axes
      .filter((a) => a.code !== "CURRENT_RATIO")
      .every((a) => a.normalizedScore === null),
  );
});
test("unverified, foreign-unit and nonannual data do not get a score; no consolidated substitution", () => {
  const f = financial();
  const bad = { ...fact("PALA_NPL", "100"), currency: "EUR" };
  f.periods = [
    {
      from: "2025-01-01",
      to: "2025-06-30",
      year: "2025",
      scope: "consolidated",
      documentRef: "group",
      facts: [bad],
    },
  ];
  f.history = [
    {
      code: "CURRENT_RATIO",
      reasonCode: null,
      points: [
        { ...point("1.2"), scope: "consolidated", periodEnd: "2025-06-30" },
      ],
    },
  ];
  const result = financialScanner(f);
  assert.equal(result.periods[0].scope, "consolidated");
  assert.ok(result.periods[0].axes.every((a) => a.normalizedScore === null));
  assert.equal(result.periods[0].axes[0].rawValue, null);
});

import { historicalPosition } from "./financial-scanner";
import type { ScannerSourceEvidence } from "./financial-scanner-source";
test("historical normalization: negative profits, lower-is-better, exact decimals, no invented equal score", () => {
  assert.equal(
    historicalPosition("-5", ["-10", "-5", "-2"]).score,
    "62.500000",
  );
  assert.equal(
    historicalPosition("-2", ["-10", "-5", "-2"]).score,
    "100.000000",
  );
  assert.equal(
    historicalPosition("90", ["80", "90", "100"], true).score,
    "50.000000",
  );
  assert.equal(
    historicalPosition("150", ["100", "150", "200"]).score,
    "50.000000",
  );
  assert.equal(historicalPosition("2", ["1", "2", "4"]).score, "33.333333");
  assert.equal(
    historicalPosition("5", ["5", "5", "5"]).reason,
    "NO_HISTORICAL_VARIATION",
  );
  assert.equal(
    historicalPosition("5", ["5", "10"]).reason,
    "INSUFFICIENT_HISTORY",
  );
  assert.equal(historicalPosition("bad", ["1", "2", "3"]).score, null);
});
function scoredFixture() {
  const f = financial();
  f.sourceVersion = "source-1";
  f.representationVersion = "representation-1";
  f.freshness.retrievedAt = "2026-10-14T12:00:00Z";
  const sources: ScannerSourceEvidence = {};
  f.periods = [2025, 2024, 2023].map((year, i) => {
    const from = `${year}-01-01`,
      to = `${year}-12-31`,
      id = `standalone:${from}:${to}`;
    sources[id] = {
      reason: null,
      evidenceRef: `proof-${year}`,
      basis: {
        NET_RESULT: "net",
        REVENUE: "sales",
        OPERATING_COST_RATIO: "costs",
      },
      costs: String([80, 90, 100][i]),
    };
    return {
      from,
      to,
      year: String(year),
      scope: "standalone",
      documentRef: `doc-${year}`,
      facts: [
        fact("PALA_NPL", String([-2, -5, -10][i])),
        fact("PALA_NRFS", "100"),
      ].map((x) => ({
        ...x,
        periodStart: from,
        periodEnd: to,
        documentRef: `doc-${year}`,
      })),
    };
  });
  return { f, sources };
}
test("fixed frame: qualified costs, absolute loss retained at100, pp deltas and no divide by negative prior", () => {
  const { f, sources } = scoredFixture(),
    r = financialScanner(f, sources, {
      tenantScope: "a",
      asOf: f.freshness.retrievedAt!,
    });
  const current = r.periods[0].axes,
    previous = r.periods[1].axes;
  assert.equal(current[0].normalizedScore, "100.000000");
  assert.ok(current[0].alerts.includes("NET_LOSS"));
  assert.equal(current[0].comparisons?.[0].delta, "3.000000");
  assert.equal(current[0].comparisons?.[0].deltaPercent, null);
  assert.equal(current[4].rawValue, "80.000000");
  assert.equal(current[4].normalizedScore, "100.000000");
  assert.equal(previous[4].normalizedScore, "50.000000");
  assert.equal(current[4].comparisons?.[0].delta, "-10.000000");
  assert.equal(current[4].comparisons?.[0].favorable, "BETTER");
  assert.equal(current[1].normalizedScore, null);
  assert.equal(current[1].reasonCode, "NO_HISTORICAL_VARIATION");
  assert.equal(r.periods[0].referenceFrameId, r.periods[1].referenceFrameId);
  assert.equal(
    financialScanner(f, sources, {
      tenantScope: "a",
      asOf: f.freshness.retrievedAt!,
    }).referenceFrames?.[0].id,
    r.referenceFrames?.[0].id,
  );
  assert.notEqual(
    financialScanner(f, sources, {
      tenantScope: "b",
      asOf: f.freshness.retrievedAt!,
    }).referenceFrames?.[0].id,
    r.referenceFrames?.[0].id,
  );
});
test("unknown source and mismatched bases cannot build a three-year sample; corrections create a new frame", () => {
  const { f, sources } = scoredFixture(),
    id = f.periods[2];
  const baseline = financialScanner(f, sources);
  sources[`standalone:${id.from}:${id.to}`].reason =
    "SOURCE_REVISION_UNRESOLVED";
  const unknown = financialScanner(f, sources);
  assert.equal(unknown.periods[0].axes[0].normalizedScore, null);
  assert.equal(unknown.periods[0].axes[0].reasonCode, "INSUFFICIENT_HISTORY");
  assert.notEqual(
    unknown.referenceFrames?.[0].id,
    baseline.referenceFrames?.[0].id,
  );
  sources[`standalone:${id.from}:${id.to}`].reason = null;
  sources[`standalone:${id.from}:${id.to}`].basis.NET_RESULT = "other";
  assert.equal(
    financialScanner(f, sources).periods[0].axes[0].normalizedScore,
    null,
  );
});
test("zero revenue cannot produce margin/costs; no year-on-year delta across a gap", () => {
  const { f, sources } = scoredFixture();
  f.periods = f.periods
    .map((p, i) => ({
      ...p,
      facts: p.facts.map((x) =>
        i === 0 && x.metricCode === "PALA_NRFS" ? { ...x, amount: "0" } : x,
      ),
    }))
    .filter((_, i) => i !== 1);
  const r = financialScanner(f, sources);
  assert.equal(r.periods[0].axes[4].rawValue, null);
  assert.equal(r.periods[0].axes[0].comparisons?.length, 0);
});
