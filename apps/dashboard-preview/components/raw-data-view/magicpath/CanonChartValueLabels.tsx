import React from 'react';
import { CanonElement } from './CanonElements';
import { formatChartTime, type ChartInterval } from './CanonChartTimeAxis';

export type ChartValueAnchor = {
  y: number;
  sourceY: number;
};
export type ChartValueSnapshot = {
  x: number;
  width: number;
  height: number;
  rem: number;
  index: number;
  future: boolean;
  outlines: {
    x: number;
    y: number;
  }[][];
  central: ChartValueAnchor;
  upper: ChartValueAnchor | null;
  lower: ChartValueAnchor | null;
  backtest: ChartValueAnchor | null;
};
export type ChartValueContext = {
  name: string;
  unit: string;
  dates: string[];
  interval: ChartInterval;
  backtest: boolean;
  locale?: 'pl' | 'en';
};
const constrain = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** C80 / B57 / CHT-08: unboxed labels share the exact crosshair anchors. */
export function CanonChartValueLabels({
  snapshot: s,
  context,
  visible
}: {
  snapshot: ChartValueSnapshot | null;
  context: ChartValueContext;
  visible: boolean;
}) {
  if (!s) return null;
  const {
    name,
    unit,
    dates,
    interval
  } = context;
  const price = (value: number) => value;
  const number = new Intl.NumberFormat(context.locale === 'en' ? 'en-GB' : 'pl-PL', {minimumFractionDigits:2,maximumFractionDigits:2});
  const index = constrain(s.index, 0, dates.length - 1);
  // Date and value identify the same supplied observation.
  const date = formatChartTime(dates[Math.round(index)], interval);
  // A single date lane is shared by every checkbox combination and both halves.
  const historicalComparison = context.backtest && !s.future;
  const x = s.x * s.width;
  const width = Math.min(12 * s.rem, s.width * .44);
  const gap = 1.125 * s.rem;
  const side = s.width - x >= width + gap + 4 ? 'right' : 'left';
  const safeLeft = (value: number) => constrain(value, .5 * s.rem, s.width - width - 3 * s.rem);
  const left = safeLeft(side === 'right' ? x + gap : x - gap - width);
  const blockHeight = (historicalComparison ? 4 : 3) * s.rem;
  const clearance = .5 * s.rem;
  const separation = .75 * s.rem;
  // The entire label width is excluded from the curves, corridor and ribbon.
  // Endpoint interpolation also covers an interval lying between two samples.
  const envelope = (labelLeft: number) => {
    const lo = Math.max(0, labelLeft - clearance / 2);
    const hi = Math.min(s.width, labelLeft + width + clearance / 2);
    const ys: number[] = [];
    for (const outline of s.outlines) {
      for (let i = 1; i < outline.length; i++) {
        const a = outline[i - 1],
          b = outline[i];
        if (b.x < lo || a.x > hi || b.x <= a.x) continue;
        const at = (x: number) => a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x);
        ys.push(at(Math.max(lo, a.x)), at(Math.min(hi, b.x)));
      }
    }
    return {
      top: ys.length ? Math.min(...ys) : s.central.y * s.height,
      bottom: ys.length ? Math.max(...ys) : s.central.y * s.height
    };
  };
  type Label = {
    id: string;
    title: string;
    point: ChartValueAnchor;
    tone: string;
  };
  const central: Label = {
    id: 'central',
    title: name + (s.future ? (context.locale === 'en' ? ' · central' : ' · centralna') : ''),
    point: s.central,
    tone: 'blue'
  };
  const place = (label: Label, position: 'above' | 'below', labelSide = side) => {
    const labelLeft = safeLeft(labelSide === 'right' ? x + gap : x - gap - width);
    const edge = envelope(labelLeft);
    return {
      ...label,
      side: labelSide,
      left: labelLeft,
      position,
      top: position === 'above' ? Math.max(2 * s.rem, edge.top - clearance - blockHeight) : edge.bottom + clearance
    };
  };
  let placed;
  if (s.future && s.upper && s.lower) {
    const upper = place({
      id: 'upper',
      title: name + (context.locale === 'en' ? ' · upper' : ' · górna'),
      point: s.upper,
      tone: 'upper'
    }, 'above');
    const lower = place({
      id: 'lower',
      title: name + (context.locale === 'en' ? ' · lower' : ' · dolna'),
      point: s.lower,
      tone: 'lower'
    }, 'below');
    const opposite = side === 'right' ? 'left' : 'right';
    const oppositeFits = opposite === 'left' ? x >= width + gap + 4 : s.width - x >= width + gap + 4;
    // Central reading uses the opposite free side. At an edge, stack it beneath
    // the lower label inside the plot, never inside the forecast band.
    const middle = oppositeFits ? place(central, 'above', opposite) : place(central, 'below');
    if (!oppositeFits) middle.top = lower.top + blockHeight + separation;
    placed = [upper, middle, lower];
  } else if (historicalComparison && s.backtest) {
    const backtest: Label = {
      id: 'backtest',
      title: context.locale === 'en' ? 'Historical forecast' : 'Prognoza historyczna',
      point: s.backtest,
      tone: 'sand'
    };
    const predictedAbove = s.backtest.y < s.central.y;
    placed = [place(central, predictedAbove ? 'below' : 'above'), place(backtest, predictedAbove ? 'above' : 'below')];
  } else {
    placed = [place(central, 'above')];
  }
  const delta = s.backtest ? price(s.backtest.sourceY) - price(s.central.sourceY) : 0;
  return <CanonElement as="div" canonId="SRM-C80" usage="CanonChartValueLabels:labels" className="srm-chart-values" data-visible={visible} data-side={side} data-mode={s.future ? 'forecast' : historicalComparison ? 'backtest' : 'history'} aria-hidden={!visible}>
    <div className="srm-chart-value-date" data-chart-date-anchor="cursor-top" style={{
      left,
      width
    }}><time dateTime={dates[Math.round(index)]}>{date}</time></div>
    {placed.map(label => <div key={label.id} className="srm-chart-value-label" data-value-anchor={label.id} data-tone={label.tone} data-side={label.side} data-placement={label.position} style={{
      left: label.left,
      top: label.top,
      width
    }}>
      <span className="srm-chart-value-name" title={label.title}>{label.title}</span>
      <span className="srm-chart-value-number">{number.format(price(label.point.sourceY))}<span className="srm-chart-value-unit"> {unit}</span></span>
      {historicalComparison && <span className="srm-chart-value-meta">{label.id === 'backtest' ? `Δ ${delta > 0 ? '+' : ''}${number.format(delta)} ${unit}` : (context.locale === 'en' ? 'Historical price' : 'Kurs historyczny')}</span>}
    </div>)}
  </CanonElement>;
}
