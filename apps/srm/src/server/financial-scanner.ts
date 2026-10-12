import type {
  FinancialScannerProjection,
  ScannerAxisCode,
  SupplierReportData,
} from "@profitia/srm-xray";
const SCALE = 1_000_000n;
function decimal(value: string | null): bigint | null {
  if (value === null || !/^-?\d{1,24}(?:\.\d{1,6})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
  const amount = BigInt(whole) * SCALE + BigInt(fraction.padEnd(6, "0"));
  return value.startsWith("-") ? -amount : amount;
}
function text(value: bigint): string {
  return `${value / SCALE}.${String(value % SCALE).padStart(6, "0")}`;
}
export function currentRatioPosition(value: string | null): {
  score: string | null;
  tone: "positive" | "caution" | "negative" | "unknown";
  alerts: string[];
} {
  const x = decimal(value);
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
/** Existing data has no revision/semantic lineage for historical normalization or
 * tenant cohorts. Do not infer it from NIP, year count, or matching metric codes.
 * This is explicitly a partial source projection, not an activated canonical frame. */
export function financialScanner(
  financial: SupplierReportData["financial"],
): FinancialScannerProjection {
  return {
    version: "1.0",
    methodologyVersion: "1.0.0",
    qualification: "PARTIAL_SOURCE_VIEW",
    sourceVersion: financial.representationVersion,
    periods: financial.periods.map((period) => ({
      id: `${period.scope}:${period.from}:${period.to}`,
      from: period.from,
      to: period.to,
      scope: period.scope,
      documentRef: period.documentRef,
      axes: axes.map((code) => {
        const unit =
          code === "NET_RESULT" || code === "REVENUE"
            ? "PLN"
            : code === "CURRENT_RATIO"
              ? "RATIO"
              : "PERCENT";
        const factCode =
          code === "NET_RESULT"
            ? "PALA_NPL"
            : code === "REVENUE"
              ? "PALA_NRFS"
              : null;
        const fact = factCode
          ? period.facts.find((f) => f.metricCode === factCode)
          : undefined;
        const point = financial.history
          .find((h) => h.code === code)
          ?.points.find(
            (x) =>
              x.scope === period.scope &&
              x.periodStart === period.from &&
              x.periodEnd === period.to,
          );
        let rawValue = factCode
          ? fact?.validation === "VERIFIED" &&
            fact.currency === "PLN" &&
            fact.unit === "PLN"
            ? fact.amount
            : null
          : point?.status === "AVAILABLE"
            ? point.value
            : null;
        if (decimal(rawValue) === null || code === "OPERATING_COST_RATIO")
          rawValue = null;
        // PALA_OAC alone cannot prove the statement variant/revenue basis. No abs()
        // or 100-minus-margin fallback is permitted for OPERATING_COST_RATIO.
        const reasonCode =
          code === "OPERATING_COST_RATIO"
            ? "SOURCE_MAPPING_UNCONFIRMED"
            : rawValue === null
              ? "MISSING_FIELD"
              : "DOCUMENT_COMPARABILITY_UNCONFIRMED";
        const alerts: string[] = [];
        const value = decimal(rawValue);
        if (value !== null && value < 0n && code === "NET_RESULT")
          alerts.push("NET_LOSS");
        if (value !== null && value < 0n && code === "OPERATING_MARGIN")
          alerts.push("OPERATING_LOSS");
        if (
          value !== null &&
          value > 100n * SCALE &&
          code === "LIABILITIES_TO_ASSETS"
        )
          alerts.push("LIABILITIES_EXCEED_ASSETS");
        const days =
          (Date.parse(period.to) - Date.parse(period.from)) / 86400000 + 1;
        if (
          code === "CURRENT_RATIO" &&
          (days === 365 || days === 366) &&
          point?.evidence.length &&
          point.evidence.every((f) => f.validation === "VERIFIED")
        ) {
          const position = currentRatioPosition(rawValue);
          return {
            code,
            unit,
            rawValue,
            normalizedScore: position.score,
            basis: "POLICY" as const,
            reasonCode:
              position.score === null
                ? (point.reasonCode ?? "MISSING_FIELD")
                : null,
            alerts: position.alerts,
            tone: position.tone,
          };
        }
        return {
          code,
          unit,
          rawValue,
          normalizedScore: null,
          basis:
            code === "CURRENT_RATIO"
              ? ("POLICY" as const)
              : ("HISTORICAL_BEST" as const),
          reasonCode:
            code === "CURRENT_RATIO" && rawValue !== null
              ? days === 365 || days === 366
                ? "UNVERIFIED_SOURCE"
                : "NON_ANNUAL_PERIOD"
              : reasonCode,
          alerts,
          tone: alerts.length ? ("negative" as const) : ("unknown" as const),
        };
      }),
    })),
  };
}
