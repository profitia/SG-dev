"use client";

import React, { useId, useState } from "react";
import type { FinancialHistoryPoint } from "./contracts";
import type { FinancialPeriodSelection } from "./financial-dashboard";
import { financialReason } from "./financial-indicator-content";

export const financialUnits = { PERCENT: "%", RATIO: "×", PLN: "PLN", DAYS: "dni", PERCENTAGE_POINTS: "p.p." } as const;
/** Decimal text formatting only: no rounding, financial arithmetic or sign normalization. */
export function financialValue(value: string | null, unit: keyof typeof financialUnits): string {
  if (value === null || !/^-?\d+(?:\.\d+)?$/.test(value)) return "Brak wartości";
  const [integer, fraction] = value.split(".");
  const grouped = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(BigInt(integer));
  const negativeZero = integer.startsWith("-") && BigInt(integer) === 0n ? "−" : "";
  return `${negativeZero}${grouped}${fraction ? `,${fraction}` : ""} ${financialUnits[unit]}`;
}
export function isSelected(point: FinancialHistoryPoint, selected: FinancialPeriodSelection | null | undefined) {
  return point.periodStart === selected?.from && point.periodEnd === selected?.to;
}
export function historyPoints(points: readonly FinancialHistoryPoint[], code: string, scope: FinancialHistoryPoint["scope"] | null) {
  return points.filter(point => point.code === code && point.scope === scope).sort((a, b) => a.periodEnd.localeCompare(b.periodEnd) || a.periodStart.localeCompare(b.periodStart));
}
export function hasHistoryValue(point: FinancialHistoryPoint) {
  return point.status === "AVAILABLE" && point.value !== null && /^-?\d+(?:\.\d+)?$/.test(point.value) && Number.isFinite(Number(point.value));
}
/** Only layout arithmetic. Backend comparison is authoritative; gaps never receive a segment. */
export function historyPlot(points: readonly FinancialHistoryPoint[]) {
  const values = points.filter(hasHistoryValue).map(point => Number(point.value));
  const minimum = Math.min(0, ...values), maximum = Math.max(0, ...values);
  const range = maximum - minimum || 1;
  const dates = points.map(point => Date.parse(`${point.periodEnd}T00:00:00Z`));
  const first = Math.min(...dates), last = Math.max(...dates);
  const positioned = points.map((point, index) => ({ point, x: last === first ? 240 : 72 + (dates[index] - first) / (last - first) * 348,
    y: hasHistoryValue(point) ? 170 - (Number(point.value) - minimum) / range * 140 : null }));
  const segments = positioned.flatMap((current, index) => {
    const previous = positioned[index - 1], comparison = current.point.comparison;
    if (!previous || current.y === null || previous.y === null || comparison.status !== "COMPARABLE"
      || comparison.previousPeriod?.from !== previous.point.periodStart || comparison.previousPeriod?.to !== previous.point.periodEnd
      || current.point.code !== previous.point.code || current.point.scope !== previous.point.scope || current.point.unit !== previous.point.unit
      || current.point.formulaVersion !== previous.point.formulaVersion || current.point.documentRef !== previous.point.documentRef
      || Date.parse(`${previous.point.periodEnd}T00:00:00Z`) + 86400000 !== Date.parse(`${current.point.periodStart}T00:00:00Z`)) return [];
    return [{ previous, current }];
  });
  return { positioned, segments, minimum, maximum, zeroY: 170 - (0 - minimum) / range * 140 };
}
export function comparisonText(point: FinancialHistoryPoint): string {
  const comparison = point.comparison;
  if (comparison.status !== "COMPARABLE" || comparison.delta === null) return `Brak porównania. ${financialReason(comparison.reasonCode)}`;
  const direction = { UP: "Wzrost", DOWN: "Spadek", UNCHANGED: "Bez zmiany", NO_COMPARISON: "Brak porównania" }[comparison.direction];
  return `${direction}: ${financialValue(comparison.delta, comparison.unit)}${comparison.previousPeriod ? ` wobec ${comparison.previousPeriod.from} – ${comparison.previousPeriod.to}` : ""}`;
}
/** Select a stored point from pointer position; this is chart layout, not financial calculation. */
export function nearestHistoryPoint(points: readonly FinancialHistoryPoint[], x: number): number | null {
  let nearest: number | null = null, distance = Infinity;
  historyPlot(points).positioned.forEach((item, index) => {
    if (item.y !== null && Math.abs(item.x - x) < distance) { nearest = index; distance = Math.abs(item.x - x); }
  });
  return nearest;
}
export function FinancialHistory({ name, points, selectedPeriod }: { name: string; points: readonly FinancialHistoryPoint[]; selectedPeriod?: FinancialPeriodSelection | null }) {
  const initial = points.findIndex(point => isSelected(point, selectedPeriod) && hasHistoryValue(point));
  const [active, setActive] = useState<number | null>(initial >= 0 ? initial : points.findIndex(hasHistoryValue) >= 0 ? points.findIndex(hasHistoryValue) : null);
  const tooltipId = useId();
  const plot = historyPlot(points), available = points.filter(hasHistoryValue), indices = points.flatMap((point, index) => hasHistoryValue(point) ? [index] : []);
  const activePoint = active !== null ? points[active] : null, activePosition = active !== null ? plot.positioned[active] : null;
  const unit = points[0]?.unit;
  function step(direction: number) {
    const index = active === null ? 0 : indices.indexOf(active);
    setActive(indices[Math.max(0, Math.min(indices.length - 1, index + direction))] ?? null);
  }
  return <div className="health-history">
    {available.length === 1 && <p className="health-single-value">{financialValue(available[0].value, available[0].unit)} · {available[0].periodStart} – {available[0].periodEnd}</p>}
    {available.length < 2 ? <p>Brak wystarczających danych historycznych do porównania.</p> : <>
      <svg className="health-history-chart" viewBox="0 0 480 208" role="group" aria-label={`Historia: ${name}; ${unit ? financialUnits[unit] : "jednostka nieustalona"}. Dokładne wartości także w danych szczegółowych.`}
        onPointerMove={event => { const cursor = event.currentTarget.createSVGPoint(); cursor.x = event.clientX; cursor.y = event.clientY; const matrix = event.currentTarget.getScreenCTM(); if (matrix) setActive(nearestHistoryPoint(points, cursor.matrixTransform(matrix.inverse()).x)); }}
        onPointerDown={event => { const cursor = event.currentTarget.createSVGPoint(); cursor.x = event.clientX; cursor.y = event.clientY; const matrix = event.currentTarget.getScreenCTM(); if (matrix) setActive(nearestHistoryPoint(points, cursor.matrixTransform(matrix.inverse()).x)); }}>
        <line x1="72" x2="420" y1={plot.zeroY} y2={plot.zeroY} className="health-chart-axis" />
        {[{ value: plot.maximum, y: 30 }, { value: plot.minimum, y: 170 }].map((tick, i) => <text x="64" y={tick.y + 4} textAnchor="end" key={i}>{new Intl.NumberFormat("pl-PL", { notation: "compact", maximumFractionDigits: 1 }).format(tick.value)}</text>)}
        {plot.segments.map(({ previous, current }, i) => <line data-comparable-segment="true" key={i} x1={previous.x} y1={previous.y!} x2={current.x} y2={current.y!} className="health-chart-line" />)}
        {activePosition?.y != null && <line data-crosshair="true" x1={activePosition.x} x2={activePosition.x} y1="24" y2="177" className="health-chart-crosshair" />}
        {plot.positioned.map(({ point, x, y }, i) => <g key={`${point.periodStart}:${point.periodEnd}`}>
          {(points.length <= 6 || i === 0 || i === points.length - 1 || isSelected(point, selectedPeriod)) && <text x={x} y="198" textAnchor="middle">{point.year}</text>}
          {y !== null && <g role="button" tabIndex={0} aria-describedby={active === i ? tooltipId : undefined} aria-pressed={active === i}
            aria-label={`${point.periodStart} – ${point.periodEnd}: ${financialValue(point.value, point.unit)}${isSelected(point, selectedPeriod) ? "; wybrany okres" : ""}`}
            onFocus={() => setActive(i)} onClick={() => setActive(i)} onKeyDown={event => {
              if (["Enter", " ", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
                event.preventDefault();
                const target = event.key === "Home" ? indices[0] : event.key === "End" ? indices.at(-1) : event.key === "ArrowLeft" || event.key === "ArrowRight" ? indices[Math.max(0, Math.min(indices.length - 1, indices.indexOf(i) + (event.key === "ArrowLeft" ? -1 : 1)))] : i;
                if (target !== undefined) { setActive(target); if (target !== i) event.currentTarget.closest("svg")?.querySelectorAll<SVGGElement>('[role="button"]')[indices.indexOf(target)]?.focus(); }
              }
            }}>
            <circle cx={x} cy={y} r="15" fill="transparent" />
            <circle cx={x} cy={y} r={active === i || isSelected(point, selectedPeriod) ? 7 : 4} data-selected-period={isSelected(point, selectedPeriod)} className={isSelected(point, selectedPeriod) ? "health-chart-point health-chart-point--selected" : "health-chart-point"} />
            <title>{point.periodStart} – {point.periodEnd}: {financialValue(point.value, point.unit)}</title>
          </g>}
        </g>)}
      </svg>
      <div className="health-chart-readout"><button type="button" aria-label="Poprzedni punkt historii" disabled={active === indices[0]} onClick={() => step(-1)}>←</button>
        <div id={tooltipId} role="status" aria-live="polite" className="health-chart-tooltip">{activePoint && <><strong>{financialValue(activePoint.value, activePoint.unit)}</strong><span>{activePoint.periodStart} – {activePoint.periodEnd}{isSelected(activePoint, selectedPeriod) ? " · wybrany okres" : ""}</span>
          <span>{activePoint.comparison.status === "COMPARABLE" ? comparisonText(activePoint) : "Brak potwierdzonego porównania"}</span></>}</div>
        <button type="button" aria-label="Następny punkt historii" disabled={active === indices.at(-1)} onClick={() => step(1)}>→</button></div>
    </>}
    {points.some(point => point.comparison.status !== "COMPARABLE" && point.comparison.previousPeriod !== null || point.comparison.status === "UNKNOWN") && <details className="health-comparability"><summary>Nie wszystkie okresy można bezpośrednio porównać.</summary><p>Linia łączy wyłącznie okresy z potwierdzoną porównywalnością. Braki, różne dokumenty, zakresy lub niepotwierdzone korekty nie tworzą ciągłego trendu. Przyczyny dla każdego okresu znajdziesz w danych szczegółowych.</p></details>}
    {points.length > 0 ? <details className="health-history-data"><summary>Dane szczegółowe</summary><div className="health-history-table-scroll" tabIndex={0} aria-label={`Historia tabelaryczna: ${name}`}><table className="health-history-table">
      <caption>Pełne okresy, dokładne wartości i zapisane zmiany</caption><thead><tr><th scope="col">Okres</th><th scope="col">Wartość</th><th scope="col">Porównanie</th></tr></thead>
      <tbody>{points.map(point => <tr key={`${point.periodStart}:${point.periodEnd}`} aria-current={isSelected(point, selectedPeriod) ? "true" : undefined}>
        <th scope="row">{point.periodStart} – {point.periodEnd}{isSelected(point, selectedPeriod) && <small>Wybrany okres</small>}</th>
        <td>{hasHistoryValue(point) ? financialValue(point.value, point.unit) : "Niedostępny"}{!hasHistoryValue(point) && <small>{financialReason(point.reasonCode)}</small>}</td>
        <td><small>{point.comparison.status === "COMPARABLE" ? "Porównywalne" : point.comparison.status === "UNKNOWN" ? "Porównywalność nieustalona" : "Nieporównywalne"}</small>{comparisonText(point)}</td>
      </tr>)}</tbody></table></div></details> : <p>Brak zapisanych wartości historycznych.</p>}
  </div>;
}
