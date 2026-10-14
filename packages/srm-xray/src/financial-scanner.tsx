"use client";
import { CanonElement, CanonButton, CanonSelect, CanonSummary } from './ui-canon';
import { AVAILABLE_REPORT, type ReportAvailability } from "./report-availability";
import { ReportAvailabilityView } from "./report-availability-view";
import { createPortal } from "react-dom";
import { FinancialHistoryDialog } from "./FinancialHistoryDialog";
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
import { FinancialHistoryView } from "./FinancialHistoryView";
import { SpendGuruAssessment } from "./SpendGuruAssessment";
import { previousAnnualPeriod, canOverlay, axisTone, comparisonLabel, bestHistoryPeriod } from "./financial-scanner-model";
import type { AssistantApplicationContext, IndicatorViewContext } from "./assistant-context";
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
  BASIC_COSTS_EXCEED_REVENUE: "Koszty podstawowe przekraczają przychody",
  OPERATING_LOSS: "Strata operacyjna",
  LIABILITIES_EXCEED_ASSETS: "Zobowiązania i rezerwy przekraczają aktywa",
  CURRENT_ASSETS_BELOW_CURRENT_LIABILITIES:
    "Aktywa obrotowe niższe od zobowiązań krótkoterminowych",
  LIMITED_LIQUIDITY_BUFFER: "Ograniczony bufor płynności",
  LIQUIDITY_SCALE_SATURATED: "Osiągnięto górny zakres skali płynności",
};
function reason(code: string | null | undefined): string {
  const labels: Record<string,string> = { INSUFFICIENT_HISTORY:"Mniej niż trzy kwalifikowane okresy.", NO_HISTORICAL_VARIATION:"Brak zróżnicowania w historii.", ACCOUNTING_STANDARD_UNCONFIRMED:"Niepotwierdzony standard rachunkowości.", SOURCE_REVISION_UNRESOLVED:"Nierozstrzygnięta wersja sprawozdania.", SOURCE_DOCUMENT_UNAVAILABLE:"Brak potwierdzonego dokumentu źródłowego.", UNSUPPORTED_SOURCE_BASIS:"Niepotwierdzona podstawa sprawozdania.", SOURCE_PERIOD_UNCONFIRMED:"Niepotwierdzone daty kolumny porównawczej.", SOURCE_BASIS_MISMATCH:"Inna podstawa niż w wybranej ramie.", OUT_OF_POLICY_DOMAIN:"Wartość poza zakresem metodologii." };
  if(code && labels[code]) return labels[code];
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
  loadKey,
}: {
  loadKey: string | null;
  period?: Period;
  comparison?: Period;
  onSelect: (code: string) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [introIndex, setIntroIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const introCancelled = useRef(false);
  const stopIntro = () => {
    introCancelled.current = true;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setIntroIndex(null);
  };
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    introCancelled.current = false;
    setIntroIndex(null);
    if (reducedMotion || !loadKey || !svg.current) return;
    let started = false;
    const start = () => {
      if (started || introCancelled.current) return;
      started = true;
      axes.forEach((_, index) => {
        timers.current.push(setTimeout(() => setIntroIndex(index), 160 + index * 480));
        timers.current.push(setTimeout(() => setIntroIndex(null), 440 + index * 480));
      });
    };
    // Begin only when the loaded radar enters the viewport; scrolling back does not replay it.
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        start();
        observer.disconnect();
      }
    }, {
      threshold: 0.35
    });
    observer.observe(svg.current);
    return () => {
      observer.disconnect();
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [loadKey, reducedMotion]);
  const emphasizedIndex = hoverIndex ?? focusIndex ?? introIndex;
  const year = period?.to.slice(0, 4) ?? "—",
    compare = comparison?.id === "reference" ? "najlepsza historia" : comparison?.to.slice(0, 4);
  const cx = 350,
    cy = 237,
    inner = 42,
    outer = 167;
  const scores = axes.map((a) => {
    const s = period?.axes.find((x) => x.code === a.code)?.normalizedScore;
    return s == null ? null : Number(s);
  });
  const previous =
    comparison && canOverlay(period, comparison)
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
      x: 532,
      y: 128,
      anchor: "start",
    },
    {
      x: 532,
      y: 310,
      anchor: "start",
    },
    {
      x: 350,
      y: 449,
      anchor: "middle",
    },
    {
      x: 168,
      y: 302,
      anchor: "end",
    },
    {
      x: 168,
      y: 120,
      anchor: "end",
    },
  ];
  return (
    <CanonElement as="svg" canonId="SRM-C16" usage="financial-scanner:radar"
      ref={svg}
      data-emphasized-sector={emphasizedIndex === null ? "" : axes[emphasizedIndex].code}
      className="srm-radar srm-sector-radar"
      viewBox="-12 -16 724 546"
      role="group"
      aria-label={
        "Profil finansowy w sześciu wycinkach koła, " +
        year +
        ". " +
        "Płynność według stałej skali SRM. Pozostałe osie względem kwalifikowanej historii."
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
      <g pointerEvents="none" aria-hidden="true">
        {axes.map((_, i) => i).sort((a,b) => Number(a === emphasizedIndex)-Number(b === emphasizedIndex)).map(i => {
          const value = scores[i], old = previous?.[i];
          const axis = period?.axes.find(x => x.code === axes[i].code);
          const tone = axisTone(axis, comparison);
          const colors = radarColors[tone];
          const appearance = { tone, alert: axis?.alerts.some(x => x !== "LIQUIDITY_SCALE_SATURATED") };
          const [x,y] = polar((inner+outer)/2, -90+i*60);
          return <g key={axes[i].code} data-motion-sector={axes[i].code}
            className={"srm-sector-motion"+(i===emphasizedIndex?" is-emphasized":"")}
            style={{transformOrigin:`${x}px ${y}px`}}>
            <path
              className="srm-sector-track"
              d={sector(i, outer)}
              fill={
                value === null
                  ? "url(#" + uid + "srm-sector-pending)"
                  : colors.soft
              }
              stroke={appearance.alert ? radarColors.negative.fill : "#D6E0E9"}
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
            {value === 0 && <path className="srm-sector-zero" d={comparisonArc(i,0)} fill="none" stroke={colors.fill} strokeWidth="3" strokeLinecap="round" />}
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
          </g>;
        })}
      </g>
      {axes.map((a, i) => {
        const value = scores[i],
          p = labels[i],
          old = previous?.[i];
        const axis = period?.axes.find((x) => x.code === a.code);
        const tone = axisTone(axis, comparison),
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
        const deltaLabel = comparisonLabel(axis,comparison);
        return (
          <CanonElement as="g" canonId="SRM-C17" usage="financial-scanner:01"
            key={a.code}
            className={
              "srm-axis srm-sector " + (value === null ? "is-pending" : "")
            }
            role="button"
            data-radar-sector={a.code}
            aria-haspopup="dialog"
            onPointerEnter={event => { if(event.pointerType!=="touch") { stopIntro(); setHoverIndex(i); } }}
            onPointerLeave={() => setHoverIndex(null)}
            onFocus={event => { if(event.currentTarget.matches(":focus-visible")) { stopIntro();setFocusIndex(i); } }}
            onBlur={() => setFocusIndex(null)}
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
            onClick={() => { stopIntro();onSelect(a.code); }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                stopIntro();onSelect(a.code);
              }
            }}
          >
            <title>{`${a.label.join(" ")}: ${fmt(raw[i], a.unit)}. ${scoreLabel}. ${appearance.description}. ${a.dir}. ${old !== null && old !== undefined ? "Porównanie " + compare + ": " + pl(old, 0) + " pkt." : ""}`}</title>
            <path d={sector(i, outer)} fill="transparent" pointerEvents="all" />
            <rect x={p.anchor === "end" ? p.x-170 : p.anchor === "middle" ? p.x-95 : p.x} y={p.y-17}
              width={p.anchor === "middle" ? 190 : 170} height={labelHeight+46} fill="transparent" pointerEvents="all" />
            <g className={"srm-label-motion"+(i===emphasizedIndex?" is-emphasized":"")} data-motion-label={a.code}
              style={{transformOrigin:`${p.x}px ${p.y+(labelHeight+8)/2}px`}} aria-hidden="true">
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
              {deltaLabel ?? scoreLabel}
              {appearance.alert ? " · sygnał" : ""}
            </text>
            </g>
          </CanonElement>
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
    </CanonElement>
  );
}

/** Independently mountable Financial Data presentation: no router/provider/DB dependency. */
export function FinancialScannerMount({
  report,
  loading = false,
  assistant,
  indicatorsTarget,
  availability = AVAILABLE_REPORT,
}: {
  availability?: ReportAvailability;
  indicatorsTarget?: HTMLElement | null;
  report: SupplierReportData | null;
  loading?: boolean;
  assistant?: { nip?: string; name: string; krs?: string | null; avatars: { male: string; anna: string } };
}) {
  // Never derive analysis or context from a stale report when availability blocks it.
  if (availability.code !== "AVAILABLE") report = null;
  const instanceId = useId();
  const [indicatorView, setIndicatorView] = useState<IndicatorViewContext>({ tab: "overview", label: "Przegląd", items: [] });
  const [scope, setScope] = useState<"standalone" | "consolidated">(
    "standalone",
  );
  const [periodId, setPeriodId] = useState<string | null>(null),
    [comparisonId, setComparisonId] = useState("auto");
  const [history, setHistory] = useState<{
    code: string;
    year?: number;
  } | null>(null);
  useEffect(() => { setScope("standalone"); setPeriodId(null); setComparisonId("auto"); setHistory(null); }, [report?.nip]);
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
  const resolvedComparisonId = comparisonId === "auto" ? previousAnnualPeriod(periods,selected)?.id ?? "" : comparisonId;
  const compared = resolvedComparisonId === "reference" ? bestHistoryPeriod(report?.financial.scanner, selected) : periods.find(p=>p.id===resolvedComparisonId);
  const compare = Boolean(compared);
  const frame = report?.financial.scanner?.referenceFrames?.find(f=>f.id===selected?.referenceFrameId);
  const activeAlerts = selected?.axes.flatMap(a=>a.alerts.filter(x=>x!=="LIQUIDITY_SCALE_SATURATED").map(x=>`${axes.find(d=>d.code===a.code)!.label.join(" ")}: ${alertLabels[x]??x}`)) ?? [];
  const comparisonSummary = compared && compared.id !== "reference" ? axes.flatMap(a=>{
    const axis=selected?.axes.find(x=>x.code===a.code), label=comparisonLabel(axis,compared);
    return label ? [`${a.label.join(" ")}: ${label}.`] : [];
  }) : [];
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
  const context: AssistantApplicationContext = {
    schemaVersion: 1, dashboardInstanceId: instanceId, application: "SRM",
    source: { kind: "financial-data-module", version: report?.financial.sourceVersion ?? null,
      capturedOn: report?.financial.freshness.retrievedAt ?? null, statementScope: scope },
    reportAvailability: availability,
    supplier: { id: assistant?.nip ?? report?.nip ?? "", nip: assistant?.nip ?? report?.nip ?? null, name: assistant?.name ?? "Dostawca", krs: assistant?.krs ?? null },
    view: { page: "supplier-intelligence-dashboard",
      radar: { year: selected ? Number(selected.to.slice(0,4)) : null, comparisonYear: compared && compared.id !== "reference" ? Number(compared.to.slice(0,4)) : null,
        referenceSelection: "history", referenceKind: "history", referenceStatus: selected?.axes.some(a=>a.basis==="HISTORICAL_BEST" && a.normalizedScore!==null) ? "available" : "unconfirmed", referenceFrameId: selected?.referenceFrameId ?? null },
      indicators: indicatorView, history: history ? { code: history.code, year: history.year ?? null } : null },
    financialSummary: axes.map(a => { const v=selected?.axes.find(x=>x.code===a.code)?.rawValue ?? null;
      return { code:a.code,name:a.label.join(" "),year:selected?Number(selected.to.slice(0,4)):null,value:v,unit:a.unit,
        availability:v===null?"missing":"available",reason:null }; }),
  };
  if (availability.code !== "AVAILABLE") return <div className="srm-ui srm-finance-module srm-scanner-unavailable">
    <div className="srm-section-heading"><h2 id="scanner-title">Supplier Finance Scanner</h2></div>
    <CanonElement as="div" canonId="SRM-C43" usage="financial-scanner:unavailable-layout" className="srm-overview">
      <ReportAvailabilityView availability={availability} />
      {assistant && <SpendGuruAssessment key={`${assistant.nip}:${availability.code}`} context={{...context, financialSummary:[],view:{...context.view,indicators:{tab:"overview",label:availability.title,items:[]},history:null}}}
        avatars={assistant.avatars} year={null} company={assistant.name} values={[]} formatted={[]} />}
    </CanonElement>
  </div>;
  const indicators = (<IndicatorExplorer
        key={`${storageKey}:${report?.financial.representationVersion ?? "empty"}`}
        onContextChange={setIndicatorView}
        cards={cards}
        groups={groups}
        overviewCodes={axes.map((a) => a.code)}
        years={years}
        storageKey={storageKey}
        getMetric={getMetric}
        formatValue={fmt}
        onHistory={(code, year) => setHistory({ code, year })}
      />);
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
            <CanonButton canonId="SRM-C02" usage="financial-scanner:02"
              key={s}
              type="button"
              aria-pressed={scope === s}
              onClick={() => {
                setScope(s);
                setPeriodId(null);
                setComparisonId("auto");
                setHistory(null);
              }}
            >
              {s === "standalone" ? "Jednostkowe" : "Skonsolidowane"}
            </CanonButton>
          ))}
        </div>
      )}
      <CanonElement as="div" canonId="SRM-C43" usage="financial-scanner:03" className="srm-overview">
        <section className="srm-radar-panel" aria-label="Radar finansowy">
          <CanonElement as="div" canonId="SRM-C20" usage="financial-scanner:04" className="srm-controls">
            <label>
              Okres
              <CanonSelect canonId="SRM-C07" usage="financial-scanner:05"
                aria-label="Okres radaru"
                value={selected?.id ?? ""}
                disabled={!periods.length}
                onChange={(e) => {
                  setPeriodId(e.target.value);
                  setComparisonId("auto");
                }}
              >
                {!periods.length && <option value="">Brak okresów</option>}
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.to.slice(0, 4)}
                    {annual(p) ? "" : " · okres niepełny"}
                  </option>
                ))}
              </CanonSelect>
            </label>
            <label>
              Odniesienie
              <CanonSelect canonId="SRM-C07" usage="financial-scanner:06"
                aria-label="Odniesienie radaru"
                value="history"
                onChange={() => {}}
              >
                <option value="history">Najlepsza historia</option>
                <option value="peers" disabled>
                  Benchmark dostawców — niedostępny
                </option>
              </CanonSelect>
            </label>
            <label>Porównaj
              <CanonSelect canonId="SRM-C07" usage="financial-scanner:07" aria-label="Okres porównania" value={resolvedComparisonId} onChange={e => setComparisonId(e.target.value)} disabled={!selected}>
                <option value="">Bez porównania</option>
                <option value="reference" disabled={!frame}>Najlepsze wartości historyczne</option>
                {periods.filter(p => !selected || p.to < selected.to).map(p => <option key={p.id} value={p.id}>{p.to.slice(0,4)}</option>)}
              </CanonSelect>
            </label>
          </CanonElement>
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
            loadKey={!loading && selected ? report?.nip ?? null : null}
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
              {selected?.to.slice(0,4) ?? "Wybrany okres"}
            </span>
            {compare && (
              <span>
                <i className="previous" />
                {compared?.id === "reference" ? "Najlepsze wartości" : compared?.to.slice(0,4)}
              </span>
            )}
            <span>0–100 · pozycja na osi</span>
          </div>
          <div className="srm-semantic-legend">
            <span>
              <i className="positive" />
              Korzystny kierunek
            </span>
            <span>
              <i className="caution" />
              Bez zmiany
            </span>
            <span>
              <i className="negative" />
              Niekorzystny kierunek
            </span>
            <span>
              <i className="unknown" />
              Bez punktacji
            </span>
          </div>
          <p className="srm-source-note">Wypełnienie: pozycja we własnej historii. Kolor: kierunek zmiany; płynność według stałych progów.</p>
          {activeAlerts.length>0 && <ul className="srm-radar-alerts" aria-label="Sygnały finansowe">{activeAlerts.map(a=><li key={a}>{a}</li>)}</ul>}
          <details className="srm-source-note">
            <CanonSummary canonId="SRM-C49" usage="financial-scanner:08">Jak czytać radar</CanonSummary>
            <p>
              Płynność używa stałej skali SRM, z maksimum przy 2,0. Pozostałe osie pokazują pozycję od najniższej do najlepszej wartości w kwalifikowanej historii (minimum trzy okresy). Niższy udział kosztów i zobowiązań oznacza korzystny kierunek. To porównanie danych, nie rating bezpieczeństwa firmy. Kolor bez porównania jest neutralny. Przerywana linia pokazuje porównywany okres; rekordy mogą pochodzić z różnych lat. Kliknij obszar, aby zobaczyć historię.
            </p>
            {frame && <ul className="srm-reference-evidence">{frame.axes.filter(a=>a.code!=="CURRENT_RATIO").map(a=><li key={a.code}><strong>{axes.find(d=>d.code===a.code)!.label.join(" ")}: </strong>{a.periodIds.length ? a.periodIds.map(id=>periods.find(p=>p.id===id)?.to.slice(0,4)).join(", ") : "brak kwalifikowanych lat"}. {a.bestValue!==null ? `Najlepsza wartość: ${fmt(a.bestValue,axes.find(d=>d.code===a.code)!.unit)}.` : ""}</li>)}</ul>}
            <p>Sprawozdania z niepotwierdzonym standardem, rewizją lub podstawą obliczeń pozostają dostępne jako wartości źródłowe, ale nie budują punktacji. Wysoki wynik historyczny nie znosi sygnału straty ani zadłużenia.</p>
          </details>
        </section>
        {assistant ? <SpendGuruAssessment key={report?.nip ?? "loading"} context={context} avatars={assistant.avatars}
          year={selected ? Number(selected.to.slice(0,4)) : null} company={assistant.name}
          values={axes.map(a => { const v=selected?.axes.find(x=>x.code===a.code)?.rawValue;return v==null?null:Number(v); })}
          formatted={axes.map(a => fmt(selected?.axes.find(x=>x.code===a.code)?.rawValue,a.unit))}
          comparisonSummary={comparisonSummary} comparisonYear={compared?.id!=="reference" ? compared?.to.slice(0,4) : undefined} />
          : <section className="srm-ai-panel" aria-label="Ocena SpendGuru"><h3>Ocena SpendGuru</h3><div className="srm-ai-blank" aria-label="Miejsce na ocenę SpendGuru" /></section>}

      </CanonElement>
      {indicatorsTarget === undefined ? indicators : indicatorsTarget ? createPortal(<div className="srm-ui srm-indicators-slot">{indicators}</div>, indicatorsTarget) : null}
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
  const [toolbar, setToolbar] = useState<HTMLDivElement | null>(null);
  const card = cards.find(c => c.code === code)!;
  const points = years.map(y => {
    const metric = getMetric(code,y), p=periods.find(p=>Number(p.to.slice(0,4))===y), axis=p?.axes.find(a=>a.code===code);
    return { year:y, value:metric.value===null?null:Number(metric.value), rawValue:metric.value,
      information: axis?.alerts.filter(a=>a!=="LIQUIDITY_SCALE_SATURATED").map(a=>alertLabels[a]??a).join(". ") || metric.reason || "" };
  });
  return <FinancialHistoryDialog title={card.name} subtitle={`Historia · ${periods[0]?.scope === "consolidated" ? "skonsolidowane" : "jednostkowe"}`} onClose={onClose} actions={<div ref={setToolbar} />}>
    <div className="srm-history-detail-body">
      <div className="srm-history-summary"><p className="srm-history-definition">{card.definition}</p><p className="srm-history-buyer"><strong>Dla kupca: </strong>{card.buyer}</p></div>
      <FinancialHistoryView name={card.name} unit={card.unit} selectedYear={year} points={points} toolbarTarget={toolbar} />
      <footer className="srm-history-detail-footer"><p>Wartości ze sprawozdań finansowych · {periods[0]?.scope === "consolidated" ? "skonsolidowane" : "jednostkowe"}</p>{comparison && <p>Porównanie: {comparison.id === "reference" ? "Najlepsze wartości historyczne" : comparison.to.slice(0,4)}</p>}</footer>
    </div>
  </FinancialHistoryDialog>;
}
