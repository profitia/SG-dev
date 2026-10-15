import { createHash } from "node:crypto";
import {
  MIN_HISTORICAL_PERIODS,
  SCANNER_METHODOLOGY_VERSION,
  previousAnnualPeriod,
} from "@profitia/srm-xray";
import type {
  FinancialScannerProjection,
  ScannerAxisCode,
  SupplierReportData,
} from "@profitia/srm-xray";
import {
  SCANNER_SOURCE_RULE,
  type ScannerSourceEvidence,
} from "./financial-scanner-source";
const SCALE = 1_000_000n;
export function scannerDecimal(
  value: string | null | undefined,
): bigint | null {
  if (value == null || !/^-?\d{1,24}(?:\.\d{1,6})?$/.test(value)) return null;
  const [w, f = ""] = value.replace(/^-/, "").split(".");
  const n = BigInt(w) * SCALE + BigInt(f.padEnd(6, "0"));
  return value.startsWith("-") ? -n : n;
}
function text(n: bigint): string {
  const a = n < 0n ? -n : n;
  return `${n < 0n ? "-" : ""}${a / SCALE}.${String(a % SCALE).padStart(6, "0")}`;
}
function divide(n: bigint, d: bigint): bigint {
  if (d <= 0n) throw new Error("Non-positive denominator");
  const a = n < 0n ? -n : n;
  const q = (a + d / 2n) / d;
  return n < 0n ? -q : q;
}
const lower = (code: ScannerAxisCode) =>
  code === "OPERATING_COST_RATIO" || code === "LIABILITIES_TO_ASSETS";
export function historicalPosition(
  value: string,
  values: readonly string[],
  lowerIsBetter = false,
): {
  score: string | null;
  reason: string | null;
  best: string | null;
  worst: string | null;
} {
  const x = scannerDecimal(value),
    ns = values.map(scannerDecimal);
  const empty = { score: null, best: null, worst: null };
  if (x === null || ns.some((n) => n === null))
    return { ...empty, reason: "INVALID_STORED_VALUE" };
  const numbers = ns as bigint[];
  if (numbers.length < MIN_HISTORICAL_PERIODS)
    return { ...empty, reason: "INSUFFICIENT_HISTORY" };
  const utilities = numbers.map((n) => (lowerIsBetter ? -n : n)),
    u = lowerIsBetter ? -x : x;
  const best = utilities.reduce((a, b) => (a > b ? a : b)),
    worst = utilities.reduce((a, b) => (a < b ? a : b));
  const result = {
    best: text(lowerIsBetter ? -best : best),
    worst: text(lowerIsBetter ? -worst : worst),
  };
  if (best === worst)
    return { ...result, score: null, reason: "NO_HISTORICAL_VARIATION" };
  const score = divide(100n * SCALE * (u - worst), best - worst);
  return {
    ...result,
    score: text(score < 0n ? 0n : score > 100n * SCALE ? 100n * SCALE : score),
    reason: null,
  };
}
export function currentRatioPosition(value: string | null): {
  score: string | null;
  tone: "positive" | "caution" | "negative" | "unknown";
  alerts: string[];
} {
  const x = scannerDecimal(value);
  if (x === null || x < 0n) return { score: null, tone: "unknown", alerts: [] };
  return {
    score: text(x >= 2n * SCALE ? 100n * SCALE : x * 50n),
    tone: x < SCALE ? "negative" : x < 1_200_000n ? "caution" : "positive",
    alerts:
      x < SCALE
        ? ["CURRENT_ASSETS_BELOW_CURRENT_LIABILITIES"]
        : x < 1_200_000n
          ? ["LIMITED_LIQUIDITY_BUFFER"]
          : x >= 2n * SCALE
            ? ["LIQUIDITY_SCALE_SATURATED"]
            : [],
  };
}
const axes: readonly ScannerAxisCode[] = [
  "NET_RESULT",
  "REVENUE",
  "CURRENT_RATIO",
  "OPERATING_MARGIN",
  "OPERATING_COST_RATIO",
  "LIABILITIES_TO_ASSETS",
];
const annual = (p: { from: string; to: string }) =>
  [365, 366].includes((Date.parse(p.to) - Date.parse(p.from)) / 86400000 + 1);
type Period = FinancialScannerProjection["periods"][number];
type Axis = Period["axes"][number];
export function financialScanner(
  financial: SupplierReportData["financial"],
  sources: ScannerSourceEvidence = {},
  context: { tenantScope: string; asOf: string } = {
    tenantScope: "unpersisted",
    asOf: financial.freshness.retrievedAt ?? "",
  },
): FinancialScannerProjection {
  const periods: Period[] = financial.periods.map((p) => {
    const id = `${p.scope}:${p.from}:${p.to}`,
      source = sources[id];
    return {
      id,
      from: p.from,
      to: p.to,
      scope: p.scope,
      documentRef: p.documentRef,
      axes: axes.map((code) => {
        const unit =
          code === "NET_RESULT" || code === "REVENUE"
            ? "PLN"
            : code === "CURRENT_RATIO"
              ? "RATIO"
              : "PERCENT";
        const metric =
          code === "NET_RESULT"
            ? "PALA_NPL"
            : code === "REVENUE"
              ? (p.accountingStandard === "IAS_IFRS" ? "MSR_REVENUE" : "PALA_NRFS")
              : null;
        const fact = metric
          ? p.facts.find((f) => f.metricCode === metric)
          : undefined;
        const point = financial.history
          .find((h) => h.code === code)
          ?.points.find(
            (x) =>
              x.scope === p.scope &&
              x.periodStart === p.from &&
              x.periodEnd === p.to,
          );
        let rawValue = metric
          ? fact?.validation === "VERIFIED" &&
            fact.currency === "PLN" &&
            fact.unit === "PLN"
            ? fact.amount
            : null
          : point?.status === "AVAILABLE"
            ? point.value
            : null;
        if (code === "OPERATING_COST_RATIO") {
          const revenue = p.facts.find((f) => f.metricCode === (p.accountingStandard === "IAS_IFRS" ? "MSR_REVENUE" : "PALA_NRFS")),
            r = scannerDecimal(revenue?.amount),
            c = scannerDecimal(source?.costs);
          rawValue =
            source?.basis.OPERATING_COST_RATIO &&
            r !== null &&
            r > 0n &&
            c !== null &&
            c >= 0n
              ? text(divide(c * 100n * SCALE, r))
              : null;
        }
        const value = scannerDecimal(rawValue);
        if (value === null) rawValue = null;
        const alerts: string[] = [];
        if (value !== null && value < 0n && code === "NET_RESULT")
          alerts.push("NET_LOSS");
        const operating = p.facts.find((f) => f.metricCode === "PALA_PLFOA"),
          op = scannerDecimal(operating?.amount);
        if (
          code === "OPERATING_MARGIN" &&
          ((value !== null && value < 0n) ||
            (operating?.validation === "VERIFIED" && op !== null && op < 0n))
        )
          alerts.push("OPERATING_LOSS");
        if (
          value !== null &&
          value > 100n * SCALE &&
          code === "LIABILITIES_TO_ASSETS"
        )
          alerts.push("LIABILITIES_EXCEED_ASSETS");
        if (
          value !== null &&
          value > 100n * SCALE &&
          code === "OPERATING_COST_RATIO"
        )
          alerts.push("BASIC_COSTS_EXCEED_REVENUE");
        const outOfDomain =
          value !== null &&
          value < 0n &&
          ["REVENUE", "OPERATING_COST_RATIO", "LIABILITIES_TO_ASSETS"].includes(
            code,
          );
        const qualified =
          annual(p) &&
          rawValue !== null &&
          !outOfDomain &&
          !!source?.basis[code] &&
          !source.reason;
        const reasonCode = !annual(p)
          ? "NON_ANNUAL_PERIOD"
          : outOfDomain
            ? "OUT_OF_POLICY_DOMAIN"
            : rawValue === null
              ? code === "OPERATING_COST_RATIO"
                ? "SOURCE_MAPPING_UNCONFIRMED"
                : "MISSING_FIELD"
              : (source?.reason ??
                (!qualified ? "DOCUMENT_COMPARABILITY_UNCONFIRMED" : null));
        let axis: Axis = {
          code,
          unit,
          rawValue,
          normalizedScore: null,
          basis: code === "CURRENT_RATIO" ? "POLICY" : "HISTORICAL_BEST",
          reasonCode,
          alerts,
          tone: alerts.length ? "negative" : "unknown",
          qualification: qualified ? "VERIFIED" : "UNKNOWN",
          sourceEvidenceRef: source?.evidenceRef ?? null,
          comparisons: [],
        };
        if (
          code === "CURRENT_RATIO" &&
          annual(p) &&
          (p.accountingStandard !== "IAS_IFRS" || qualified) &&
          point?.evidence.length &&
          point.evidence.every((f) => f.validation === "VERIFIED")
        ) {
          const position = currentRatioPosition(rawValue);
          axis = {
            ...axis,
            normalizedScore: position.score,
            tone: position.tone,
            alerts: position.alerts,
            reasonCode:
              position.score === null
                ? (point.reasonCode ?? "MISSING_FIELD")
                : null,
          };
        }
        return axis;
      }),
    };
  });
  const frames: NonNullable<
    FinancialScannerProjection["referenceFrames"]
  >[number][] = [];
  for (const scope of ["standalone", "consolidated"] as const) {
    const scoped = periods
      .filter((p) => p.scope === scope)
      .sort((a, b) => b.to.localeCompare(a.to));
    const anchor = scoped.find(
      (p) =>
        annual(p) &&
        p.axes.some(
          (a) => a.qualification === "VERIFIED" || a.normalizedScore !== null,
        ),
    );
    if (!anchor || !context.asOf) continue;
    const frameAxes = axes.map((code) => {
      const axisAnchor = scoped.find(p => p.axes.some(a => a.code === code && a.qualification === "VERIFIED"));
      const basis = axisAnchor ? sources[axisAnchor.id]?.basis[code] ?? null : null;
      const eligible = scoped.filter(
        (p) =>
          p.to <= anchor.to &&
          basis &&
          sources[p.id]?.basis[code] === basis &&
          p.axes.find((a) => a.code === code)?.qualification === "VERIFIED",
      );
      const values = eligible.map(
        (p) => p.axes.find((a) => a.code === code)!.rawValue!,
      );
      const reference = values.length
        ? historicalPosition(values[0], values, lower(code))
        : {
            score: null,
            reason: "INSUFFICIENT_HISTORY",
            best: null,
            worst: null,
          };
      for (const p of scoped) {
        const a = p.axes.find((a) => a.code === code)!;
        if (code === "CURRENT_RATIO") continue;
        if (!eligible.includes(p)) {
          if (a.qualification === "VERIFIED")
            a.reasonCode = "SOURCE_BASIS_MISMATCH";
          continue;
        }
        const position = historicalPosition(a.rawValue!, values, lower(code));
        a.normalizedScore = position.score;
        a.reasonCode = position.reason;
        a.tone = position.score !== null ? "caution" : a.tone;
      }
      return {
        code,
        periodIds: eligible.map((p) => p.id),
        bestValue: reference.best,
        worstValue: reference.worst,
        bestPeriodIds: eligible
          .filter(
            (p) =>
              scannerDecimal(p.axes.find((a) => a.code === code)!.rawValue) ===
              scannerDecimal(reference.best),
          )
          .map((p) => p.id),
        basisKey: basis,
      };
    });
    const frameId = createHash("sha256")
      .update(
        JSON.stringify([
          context.tenantScope,
          financial.sourceVersion,
          financial.representationVersion,
          context.asOf,
          SCANNER_METHODOLOGY_VERSION,
          SCANNER_SOURCE_RULE,
          anchor.id,
          frameAxes,
          scoped.map((p) => [
            p.id,
            p.documentRef,
            p.axes.map((a) => [
              a.code,
              a.rawValue,
              a.sourceEvidenceRef,
              a.qualification,
              a.reasonCode,
            ]),
          ]),
        ]),
      )
      .digest("hex");
    frames.push({
      id: frameId,
      scope,
      anchorPeriodId: anchor.id,
      asOf: context.asOf,
      qualificationRule: SCANNER_SOURCE_RULE,
      axes: frameAxes,
    });
    for (const p of scoped) {
      p.referenceFrameId = frameId;
      const previous = previousAnnualPeriod(scoped, p);
      if (!previous || !annual(p)) continue;
      for (const a of p.axes) {
        const b = previous.axes.find((b) => b.code === a.code)!;
        const qualified =
          a.qualification === "VERIFIED" &&
          b.qualification === "VERIFIED" &&
          sources[p.id]?.basis[a.code] === sources[previous.id]?.basis[a.code];
        const policyPair =
          a.code === "CURRENT_RATIO" &&
          p.documentRef === previous.documentRef &&
          a.normalizedScore !== null &&
          b.normalizedScore !== null;
        if (!qualified && !policyPair) continue;
        const x = scannerDecimal(a.rawValue),
          y = scannerDecimal(b.rawValue);
        if (x === null || y === null) continue;
        const delta = x - y,
          utility = lower(a.code) ? -delta : delta;
        a.comparisons = [
          {
            periodId: previous.id,
            delta: text(delta),
            deltaPercent:
              a.unit === "PLN" && y > 0n && x >= 0n
                ? text(divide(delta * 100n * SCALE, y))
                : null,
            direction: delta > 0n ? "UP" : delta < 0n ? "DOWN" : "UNCHANGED",
            favorable:
              utility > 0n ? "BETTER" : utility < 0n ? "WORSE" : "UNCHANGED",
          },
        ];
      }
    }
  }
  return {
    version: "1.1",
    methodologyVersion: SCANNER_METHODOLOGY_VERSION,
    qualification: periods.some((p) =>
      p.axes.some(
        (a) => a.basis === "HISTORICAL_BEST" && a.normalizedScore !== null,
      ),
    )
      ? "QUALIFIED_HISTORY"
      : "PARTIAL_SOURCE_VIEW",
    sourceVersion: financial.representationVersion,
    referenceFrames: frames,
    periods,
  };
}
