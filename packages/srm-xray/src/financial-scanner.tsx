"use client";
import React, { useEffect, useId, useRef, useState } from "react";
import type {
  SupplierReportData,
  FinancialScannerProjection,
} from "./contracts";
import {
  indicatorContent,
  indicatorPresentation,
  healthGroups,
  financialReason,
} from "./financial-indicator-content";
import { compactFinancialValue } from "./financial-value";
import { financialValue } from "./financial-history";
import { IndicatorExplorer } from "./financial-explorer";
type Period = FinancialScannerProjection["periods"][number];
type Card = {
  code: string;
  name: string;
  definition: string;
  buyer: string;
  importance: number;
  unit: string;
};
const extra: Card[] = [
  {
    code: "NET_RESULT",
    name: "Wynik netto",
    definition: "Zysk lub strata po kosztach i podatku.",
    buyer:
      "Pokazuje końcowy wynik działalności. Czytaj go razem z marżą i płynnością.",
    importance: 2,
    unit: "PLN",
  },
  {
    code: "REVENUE",
    name: "Przychody",
    definition:
      "Przychody netto ze sprzedaży lub ze sprzedaży i zrównane z nimi, zgodnie ze sprawozdaniem.",
    buyer:
      "Pokazują skalę działalności. Wzrost warto zestawić z finansowaniem kolejnych zamówień.",
    importance: 2,
    unit: "PLN",
  },
  {
    code: "OPERATING_COST_RATIO",
    name: "Koszty podstawowe / przychody",
    definition: "Udział kosztów podstawowej działalności w przychodach.",
    buyer:
      "Rosnący udział kosztów może zwiększać presję na ceny i ograniczać przestrzeń do negocjacji.",
    importance: 2,
    unit: "PERCENT",
  },
];
const cards: Card[] = [
  ...Object.entries(indicatorContent).map(([code, c]) => ({
    code,
    name: c.name,
    definition: c.formula + ".",
    buyer: c.description,
    importance: indicatorPresentation[code].importance,
    unit: indicatorPresentation[code].unit,
  })),
  ...extra,
];
const axes = [
  {
    code: "NET_RESULT",
    label: ["Wynik netto"],
    unit: "PLN",
    dir: "Wyższy wynik względem odniesienia",
  },
  {
    code: "REVENUE",
    label: ["Przychody"],
    unit: "PLN",
    dir: "Skala działalności",
  },
  {
    code: "CURRENT_RATIO",
    label: ["Płynność bieżąca"],
    unit: "RATIO",
    dir: "Stała skala SRM, nasycenie przy 2,0",
  },
  {
    code: "OPERATING_MARGIN",
    label: ["Marża operacyjna"],
    unit: "PERCENT",
    dir: "Wyższa marża względem odniesienia",
  },
  {
    code: "OPERATING_COST_RATIO",
    label: ["Koszty podstawowe", "/ przychody"],
    unit: "PERCENT",
    dir: "Niższy udział kosztów",
  },
  {
    code: "LIABILITIES_TO_ASSETS",
    label: ["Zobowiązania i rezerwy", "/ aktywa"],
    unit: "PERCENT",
    dir: "Niższy udział zobowiązań i rezerw",
  },
];
const groups = [
  {
    id: "liquidity",
    name: "Płynność i kapitał obrotowy",
    codes: [...healthGroups.liquidity],
  },
  {
    id: "debt",
    name: "Zadłużenie i finansowanie",
    codes: [...healthGroups.debt],
  },
  {
    id: "profit",
    name: "Rentowność i stabilność wyników",
    codes: [
      "NET_RESULT",
      "REVENUE",
      "OPERATING_COST_RATIO",
      ...healthGroups.profitability,
    ],
  },
  {
    id: "cash",
    name: "Gotówka i przepływy pieniężne",
    codes: [...healthGroups.cashFlow],
  },
];
const radarColors = {
  positive: { fill: "#25815F", soft: "#DDEFE6", text: "#176747" },
  caution: { fill: "#D49A2A", soft: "#FCF0D6", text: "#805400" },
  negative: { fill: "#C8554C", soft: "#F9E4E1", text: "#A63830" },
  unknown: { fill: "#718191", soft: "#F0F3F5", text: "#526A82" },
};
const alertLabels: Record<string, string> = {
  NET_LOSS: "Strata netto",
  OPERATING_LOSS: "Strata operacyjna",
  LIABILITIES_EXCEED_ASSETS: "Zobowiązania i rezerwy przekraczają aktywa",
  CURRENT_ASSETS_BELOW_CURRENT_LIABILITIES:
    "Aktywa obrotowe niższe od zobowiązań krótkoterminowych",
  LIMITED_LIQUIDITY_BUFFER: "Ograniczony bufor płynności",
  LIQUIDITY_SCALE_SATURATED: "Osiągnięto górny zakres skali płynności",
};
function reason(code: string | null | undefined): string {
  if (code === "DOCUMENT_COMPARABILITY_UNCONFIRMED")
    return "Brak potwierdzonego odniesienia historycznego.";
  if (code === "SOURCE_MAPPING_UNCONFIRMED")
    return "Podstawa kosztów wymaga potwierdzenia.";
  if (code === "NON_ANNUAL_PERIOD")
    return "Okres nie kwalifikuje się do rocznej skali.";
  return code ? financialReason(code) : "";
}
const pl = (v: number, d = 1) =>
  v.toLocaleString("pl-PL", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
function fmt(
  value: string | number | null | undefined,
  unit: string,
  full = false,
) {
  if (value == null) return "Brak danych";
  const u = unit as "PLN" | "RATIO" | "PERCENT" | "DAYS";
  return full
    ? financialValue(String(value), u)
    : compactFinancialValue(String(value), u);
}
function Radar({
  period,
  comparison,
  onSelect,
}: {
  period?: Period;
  comparison?: Period;
  onSelect: (code: string) => void;
}) {
  const year = period?.to.slice(0, 4) ?? "—",
    compare = comparison?.to.slice(0, 4);
  const cx = 350,
    cy = 237,
    inner = 42,
    outer = 167;
  const scores = axes.map((a) => {
    const s = period?.axes.find((x) => x.code === a.code)?.normalizedScore;
    return s == null ? null : Number(s);
  });
  const previous =
    comparison && comparison.documentRef === period?.documentRef
      ? axes.map((a) => {
          const s = comparison.axes.find(
            (x) => x.code === a.code,
          )?.normalizedScore;
          return s == null ? null : Number(s);
        })
      : null;
  const raw = axes.map(
    (a) => period?.axes.find((x) => x.code === a.code)?.rawValue ?? null,
  );
  const uid = useId().replace(/:/g, "");
  const polar = (radius: number, angle: number) => {
    const t = (angle * Math.PI) / 180;
    return [cx + Math.cos(t) * radius, cy + Math.sin(t) * radius];
  };
  const xy = (radius: number, angle: number) =>
    polar(radius, angle)
      .map((v) => v.toFixed(3))
      .join(" ");
  const radius = (score: number) =>
    inner + ((outer - inner) * Math.max(0, Math.min(100, score))) / 100;
  // Only the rendering changes: radial reach uses the existing 0–100 score.
  // Every sector has the same angle and scale. Missing data is never mapped to zero.
  const sector = (i: number, edge: number) => {
    const start = -90 + i * 60 - 28.5,
      end = start + 57;
    const corner = Math.min(9, (edge - inner) / 2);
    const outerOffset = ((corner / edge) * 180) / Math.PI;
    const innerOffset = ((corner / inner) * 180) / Math.PI;
    return `M ${xy(edge - corner, start)}
      Q ${xy(edge, start)} ${xy(edge, start + outerOffset)}
      A ${edge} ${edge} 0 0 1 ${xy(edge, end - outerOffset)}
      Q ${xy(edge, end)} ${xy(edge - corner, end)}
      L ${xy(inner + corner, end)}
      Q ${xy(inner, end)} ${xy(inner, end - innerOffset)}
      A ${inner} ${inner} 0 0 0 ${xy(inner, start + innerOffset)}
      Q ${xy(inner, start)} ${xy(inner + corner, start)} Z`;
  };
  const comparisonArc = (i: number, score: number) => {
    const r = radius(score),
      start = -90 + i * 60 - 23;
    return `M ${xy(r, start)} A ${r} ${r} 0 0 1 ${xy(r, start + 46)}`;
  };
  const labels: {
    x: number;
    y: number;
    anchor: "start" | "middle" | "end";
  }[] = [
    {
      x: 350,
      y: 22,
      anchor: "middle",
    },
    {
      x: 548,
      y: 128,
      anchor: "start",
    },
    {
      x: 548,
      y: 310,
      anchor: "start",
    },
    {
      x: 350,
      y: 449,
      anchor: "middle",
    },
    {
      x: 152,
      y: 302,
      anchor: "end",
    },
    {
      x: 152,
      y: 120,
      anchor: "end",
    },
  ];
  return (
    <svg
      className="srm-radar srm-sector-radar"
      viewBox="0 0 700 510"
      role="group"
      aria-label={
        "Profil finansowy w sześciu wycinkach koła, " +
        year +
        ". " +
        "Płynność według stałej skali SRM. Pozostałe osie wymagają potwierdzonego odniesienia."
      }
    >
      <defs>
        {Object.entries(radarColors).map(([tone, colors]) => (
          <radialGradient
            key={tone}
            id={uid + "srm-fill-" + tone}
            cx="350"
            cy="237"
            r="167"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor={colors.soft} />
            <stop offset="100%" stopColor={colors.fill} />
          </radialGradient>
        ))}
        <pattern
          id={uid + "srm-sector-pending"}
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(35)"
        >
          <rect width="8" height="8" fill="#f1f4f7" />
          <line x1="0" y1="0" x2="0" y2="8" stroke="#e4eaf0" strokeWidth="2" />
        </pattern>
      </defs>
      {axes.map((a, i) => {
        const value = scores[i],
          p = labels[i],
          old = previous?.[i];
        const axis = period?.axes.find((x) => x.code === a.code);
        const tone = axis?.tone ?? "unknown",
          colors = radarColors[tone];
        const appearance = {
          tone,
          text: colors.text,
          alert: axis?.alerts.some((x) => x !== "LIQUIDITY_SCALE_SATURATED"),
          description:
            axis?.alerts.map((x) => alertLabels[x] ?? x).join(". ") ||
            reason(axis?.reasonCode),
        };
        const labelHeight = a.label.length === 2 ? 36 : 22;
        const scoreLabel =
          value === null ? "Bez punktacji" : pl(value, 0) + " pkt";
        return (
          <g
            key={a.code}
            className={
              "srm-axis srm-sector " + (value === null ? "is-pending" : "")
            }
            role="button"
            tabIndex={0}
            aria-label={
              a.label.join(" ") +
              ", " +
              fmt(raw[i], a.unit) +
              ", " +
              scoreLabel +
              ", " +
              appearance.description
            }
            onClick={() => onSelect(a.code)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(a.code);
              }
            }}
          >
            <title>
              {a.label.join(" ")}: {fmt(raw[i], a.unit)}. {scoreLabel}.{" "}
              {appearance.description}. {a.dir}.{" "}
              {old !== null && old !== undefined
                ? "Porównanie " + compare + ": " + pl(old, 0) + " pkt."
                : ""}
            </title>
            <path
              className="srm-sector-track"
              d={sector(i, outer)}
              fill={
                value === null
                  ? "url(#" + uid + "srm-sector-pending)"
                  : "#edf1f5"
              }
              stroke={appearance.alert ? colors.fill : "#D6E0E9"}
              strokeWidth={appearance.alert ? 1.8 : 0.8}
            />
            {old !== null && old !== undefined && old > 0 && (
              <path
                d={sector(i, radius(old))}
                fill={"url(#" + uid + "srm-sector-pending)"}
              />
            )}
            {value !== null && value > 0 && (
              <path
                className="srm-sector-fill"
                d={sector(i, radius(value))}
                fill={"url(#" + uid + "srm-fill-" + appearance.tone + ")"}
              />
            )}
            {old !== null && old !== undefined && (
              <g pointerEvents="none">
                <path
                  d={comparisonArc(i, old)}
                  fill="none"
                  stroke="white"
                  strokeWidth="5"
                />
                <path
                  d={comparisonArc(i, old)}
                  fill="none"
                  stroke="#465B70"
                  strokeWidth="2.4"
                  strokeDasharray="4 5"
                  strokeLinecap="round"
                />
              </g>
            )}
            <text
              x={p.x}
              y={p.y}
              textAnchor={p.anchor}
              fill="#294D70"
              fontSize="12.5"
              fontWeight="500"
            >
              {a.label.map((line, j) => (
                <tspan key={line} x={p.x} dy={j ? 16 : 0}>
                  {line}
                </tspan>
              ))}
            </text>
            <text
              x={p.x}
              y={p.y + labelHeight}
              textAnchor={p.anchor}
              fill={raw[i] === null ? "#526A82" : "#003366"}
              fontSize={raw[i] === null ? 13 : 16}
              fontWeight="650"
            >
              {raw[i] === null ? "Do potwierdzenia" : fmt(raw[i], a.unit)}
            </text>
            <text
              x={p.x}
              y={p.y + labelHeight + 17}
              textAnchor={p.anchor}
              fill={appearance.text}
              fontSize="10"
              fontWeight="500"
            >
              {scoreLabel}
              {appearance.alert ? " · sygnał" : ""}
            </text>
          </g>
        );
      })}
      <g pointerEvents="none" aria-hidden="true">
        <text
          x={cx}
          y={cy - 5}
          textAnchor="middle"
          fill="#003366"
          fontSize="17"
          fontWeight="650"
        >
          {year}
        </text>
        <text
          x={cx}
          y={cy + 13}
          textAnchor="middle"
          fill="#526A82"
          fontSize="8"
          letterSpacing="1.1"
        >
          OKRES
        </text>
      </g>
    </svg>
  );
}

/** Independently mountable Financial Data presentation: no router/provider/DB dependency. */
export function FinancialScannerMount({
  report,
  loading = false,
}: {
  report: SupplierReportData | null;
  loading?: boolean;
}) {
  const [scope, setScope] = useState<"standalone" | "consolidated">(
    "standalone",
  );
  const [periodId, setPeriodId] = useState<string | null>(null),
    [compare, setCompare] = useState(false),
    [comparisonId, setComparisonId] = useState("reference");
  const [history, setHistory] = useState<{
    code: string;
    year?: number;
  } | null>(null);
  const periods = (report?.financial.scanner?.periods ?? [])
    .filter((p) => p.scope === scope)
    .slice()
    .sort((a, b) => b.to.localeCompare(a.to));
  const annual = (p: Period) => {
    const days = (Date.parse(p.to) - Date.parse(p.from)) / 86400000 + 1;
    return days === 365 || days === 366;
  };
  const selected =
    periods.find((p) => p.id === periodId) ??
    periods.find((p) => annual(p) && p.axes.some((a) => a.rawValue !== null)) ??
    periods[0];
  const compared = compare
    ? periods.find((p) => p.id === comparisonId)
    : undefined;
  const years = [...new Set(periods.map((p) => Number(p.to.slice(0, 4))))];
  const getMetric = (code: string, year: number) => {
    const p = periods.find((p) => Number(p.to.slice(0, 4)) === year),
      card = cards.find((c) => c.code === code)!;
    const axis = p?.axes.find((a) => a.code === code);
    const point = report?.financial.history
      .find((h) => h.code === code)
      ?.points.find(
        (x) =>
          x.scope === scope &&
          x.periodStart === p?.from &&
          x.periodEnd === p?.to,
      );
    return {
      value: axis
        ? axis.rawValue
        : point?.status === "AVAILABLE"
          ? point.value
          : null,
      unit: card.unit,
      importance: card.importance,
      reason: axis
        ? reason(axis.reasonCode)
        : point
          ? financialReason(point.reasonCode)
          : null,
    };
  };
  const storageKey = report?.preferenceScope
    ? `srm:finance-preferences:v1:${report.preferenceScope}:${report.nip}:${scope}`
    : null;
  return (
    <div className="srm-ui srm-finance-module">
      <div className="srm-section-heading">
        <h2 id="scanner-title">Supplier Finance Scanner</h2>
      </div>
      {report?.financial.scanner?.periods.some(
        (p) => p.scope === "consolidated",
      ) && (
        <div
          className="srm-scope"
          role="group"
          aria-label="Zakres sprawozdania"
        >
          {(["standalone", "consolidated"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={scope === s}
              onClick={() => {
                setScope(s);
                setPeriodId(null);
                setComparisonId("reference");
                setHistory(null);
              }}
            >
              {s === "standalone" ? "Jednostkowe" : "Skonsolidowane"}
            </button>
          ))}
        </div>
      )}
      <div className="srm-overview">
        <section className="srm-radar-panel" aria-label="Radar finansowy">
          <div className="srm-controls">
            <label>
              Okres
              <select
                aria-label="Okres radaru"
                value={selected?.id ?? ""}
                disabled={!periods.length}
                onChange={(e) => {
                  setPeriodId(e.target.value);
                  setComparisonId("reference");
                }}
              >
                {!periods.length && <option value="">Brak okresów</option>}
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.to.slice(0, 4)}
                    {annual(p) ? "" : " · okres niepełny"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Odniesienie
              <select
                aria-label="Odniesienie radaru"
                value="history"
                onChange={() => {}}
              >
                <option value="history">Najlepsza historia</option>
                <option value="peers" disabled>
                  Benchmark dostawców — niedostępny
                </option>
              </select>
            </label>
            <label className="srm-compare">
              <input
                type="checkbox"
                checked={compare}
                onChange={(e) => setCompare(e.target.checked)}
              />
              Porównaj
            </label>
            {compare && (
              <label>
                Porównanie
                <select
                  aria-label="Okres porównania"
                  value={comparisonId}
                  onChange={(e) => setComparisonId(e.target.value)}
                >
                  <option value="reference">Punkt odniesienia</option>
                  {periods
                    .filter((p) => !selected || p.to <= selected.to)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.to.slice(0, 4)}
                      </option>
                    ))}
                </select>
              </label>
            )}
          </div>
          {loading ? (
            <p role="status">Przygotowywanie zapisanych wyników…</p>
          ) : (
            !periods.length && (
              <p role="status">
                Brak dostępnych danych finansowych dla tego zakresu.
              </p>
            )
          )}
          <Radar
            period={selected}
            comparison={compared}
            onSelect={(code) =>
              setHistory({
                code,
                year: selected ? Number(selected.to.slice(0, 4)) : undefined,
              })
            }
          />
          <div className="srm-chart-legend">
            <span>
              <i className="current" />
              Wybrany okres
            </span>
            {compare && (
              <span>
                <i className="previous" />
                Odniesienie
              </span>
            )}
            <span>0–100 · pozycja na osi</span>
          </div>
          <div className="srm-semantic-legend">
            <span>
              <i className="positive" />
              Brak sygnału płynności
            </span>
            <span>
              <i className="caution" />
              Ograniczony bufor
            </span>
            <span>
              <i className="negative" />
              Sygnał do sprawdzenia
            </span>
            <span>
              <i className="unknown" />
              Bez punktacji
            </span>
          </div>
          {compare &&
            (!compared || compared.documentRef !== selected?.documentRef) && (
              <p className="srm-source-note">
                {compared
                  ? "Wartości obu okresów znajdziesz po kliknięciu obszaru. Brak potwierdzonej porównywalności do nałożenia punktacji."
                  : "Odniesienie historyczne jest niedostępne: wymagane są co najmniej trzy potwierdzone, porównywalne okresy."}
              </p>
            )}
          <details className="srm-source-note">
            <summary>Jak czytać radar</summary>
            <p>
              Płynność używa stałej skali SRM, z maksimum przy 2,0. Pozostałe
              osie pozostają bez punktacji do potwierdzenia porównywalności
              danych. Kolor i wypełnienie nie stanowią łącznej oceny dostawcy.
              Kliknij obszar, aby zobaczyć wartości i historię.
            </p>
          </details>
        </section>
        <section className="srm-ai-panel" aria-label="Ocena SpendGuru">
          <h3>Ocena SpendGuru</h3>
          <div
            className="srm-ai-blank"
            aria-label="Miejsce na ocenę SpendGuru"
          />
        </section>
      </div>
      <IndicatorExplorer
        key={`${storageKey}:${report?.financial.representationVersion ?? "empty"}`}
        cards={cards}
        groups={groups}
        overviewCodes={axes.map((a) => a.code)}
        years={years}
        storageKey={storageKey}
        getMetric={getMetric}
        formatValue={fmt}
        onHistory={(code, year) => setHistory({ code, year })}
      />
      {history && (
        <ScannerHistory
          code={history.code}
          year={history.year}
          years={years}
          getMetric={getMetric}
          periods={periods}
          comparison={compared}
          onClose={() => setHistory(null)}
        />
      )}
    </div>
  );
}
function ScannerHistory({
  code,
  year,
  years,
  getMetric,
  periods,
  comparison,
  onClose,
}: {
  code: string;
  year?: number;
  years: number[];
  getMetric: (
    code: string,
    year: number,
  ) => { value: string | null; unit: string; reason: string | null };
  periods: Period[];
  comparison?: Period;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    title = useId();
  const card = cards.find((c) => c.code === code)!;
  useEffect(() => {
    const el = dialog.current,
      previous = document.activeElement as HTMLElement | null;
    el?.showModal();
    return () => {
      el?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="srm-ui srm-history"
      aria-labelledby={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header>
        <div>
          <h2 id={title}>{card.name}</h2>
          <p>
            Historia ·{" "}
            {periods[0]?.scope === "consolidated"
              ? "skonsolidowane"
              : "jednostkowe"}
          </p>
        </div>
        <button className="srm-btn" autoFocus onClick={onClose}>
          Zamknij
        </button>
      </header>
      <p>{card.definition}</p>
      <p>
        <strong>Dla kupca: </strong>
        {card.buyer}
      </p>
      <table>
        <thead>
          <tr>
            <th>Okres</th>
            <th>Wartość</th>
            <th>Informacja</th>
          </tr>
        </thead>
        <tbody>
          {years.map((y) => {
            const m = getMetric(code, y),
              p = periods.find((p) => Number(p.to.slice(0, 4)) === y),
              a = p?.axes.find((a) => a.code === code);
            return (
              <tr key={y} aria-current={year === y ? "true" : undefined}>
                <th>
                  {p?.from} – {p?.to}
                  {year === y ? " · wybrany" : ""}
                  {comparison?.id === p?.id ? " · porównanie" : ""}
                </th>
                <td>{fmt(m.value, m.unit, true)}</td>
                <td>
                  {a?.alerts.map((a) => alertLabels[a] ?? a).join(". ") ||
                    m.reason ||
                    "Wartość dostępna"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!years.length && <p>Brak zapisanych okresów.</p>}
    </dialog>
  );
}
