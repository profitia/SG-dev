import type { FinancialScannerProjection } from "./contracts";
type Period = FinancialScannerProjection["periods"][number];
type Axis = Period["axes"][number];
export const SCANNER_METHODOLOGY_VERSION = "2.0.0" as const;
export const MIN_HISTORICAL_PERIODS = 2;
export function previousAnnualPeriod(
  periods: readonly Period[],
  selected?: Period,
): Period | undefined {
  if (!selected) return;
  const annual = (p: Period) =>
    [365, 366].includes((Date.parse(p.to) - Date.parse(p.from)) / 86400000 + 1);
  return annual(selected)
    ? periods
        .filter(
          (p) =>
            p.scope === selected.scope &&
            annual(p) &&
            Date.parse(p.to) < Date.parse(selected.from),
        )
        .sort((a, b) => Date.parse(b.to) - Date.parse(a.to))[0]
    : undefined;
}
export function canOverlay(current?: Period, other?: Period): boolean {
  return (
    !!current &&
    !!other &&
    current.scope === other.scope &&
    Boolean(
      (current.referenceFrameId &&
        current.referenceFrameId === other.referenceFrameId) ||
      (!current.referenceFrameId && current.documentRef === other.documentRef),
    )
  );
}
export function axisComparison(axis: Axis | undefined, comparison?: Period) {
  return axis?.comparisons?.find((c) => c.periodId === comparison?.id);
}
export function axisTone(
  axis: Axis | undefined,
  comparison?: Period,
): Axis["tone"] {
  if (!axis) return "unknown";
  if (axis.code === "CURRENT_RATIO") return axis.tone;
  const change = axisComparison(axis, comparison);
  return change
    ? change.favorable === "BETTER"
      ? "positive"
      : change.favorable === "WORSE"
        ? "negative"
        : "caution"
    : axis.tone;
}
export function comparisonLabel(
  axis: Axis | undefined,
  comparison?: Period,
): string | null {
  const change = axisComparison(axis, comparison);
  if (!change || !axis) return null;
  if (change.direction === "UNCHANGED") return "bez zmian";
  const value =
    axis.unit === "PLN" && change.deltaPercent !== null
      ? change.deltaPercent
      : change.delta;
  const n = Number(value),
    unit =
      axis.unit === "PERCENT"
        ? " pp"
        : axis.unit === "PLN"
          ? change.deltaPercent !== null
            ? "%"
            : " zł"
          : "";
  if (n !== 0 && Math.abs(n) < 0.005) return `${n > 0 ? "+" : "−"}<0,01${unit}`;
  return `${n > 0 ? "+" : ""}${n.toLocaleString("pl-PL", { maximumFractionDigits: axis.unit === "RATIO" || Math.abs(n) < 1 ? 2 : 1 })}${unit}`;
}
export function bestHistoryPeriod(
  scanner: FinancialScannerProjection | undefined,
  selected?: Period,
): Period | undefined {
  const frame = scanner?.referenceFrames?.find(
    (f) => f.id === selected?.referenceFrameId,
  );
  if (!frame || !selected) return;
  return {
    ...selected,
    id: "reference",
    from: "",
    to: "Najlepsza historia",
    axes: selected.axes.map((a) => {
      const ref = frame.axes.find((x) => x.code === a.code);
      return {
        ...a,
        rawValue:
          a.code === "CURRENT_RATIO" ? "2.000000" : (ref?.bestValue ?? null),
        normalizedScore:
          a.code === "CURRENT_RATIO"
            ? "100.000000"
            : ref?.bestValue !== null &&
                ref?.periodIds.length &&
                ref.periodIds.length >= MIN_HISTORICAL_PERIODS &&
                ref.bestValue !== ref.worstValue
              ? "100.000000"
              : null,
        comparisons: [],
      };
    }),
  };
}
