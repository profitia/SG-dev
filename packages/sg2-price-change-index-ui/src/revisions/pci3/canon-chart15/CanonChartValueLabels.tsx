// Product controls vendored from MagicPath 463321469305384960@465857540723474432.
// Instruction wrappers removed; source IDs retained. No demo runtime or observations.
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
    valueFromSourceY?: (y: number) => number;
    valueAtIndex?: (index: number) => number | null;
    indexFromSourceX?: (x: number) => number;
    isSourceXAvailable?: (x: number) => boolean;
    accessibleLabel?: string;
    fitLabelToPlot?: boolean;
};
const number = new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 2,
    useGrouping: true,
    maximumFractionDigits: 2
});
// Illustrative price scale for this visual specimen only. Source coordinates are
// recovered before zoom; production must supply observations in canonical units.

const constrain = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
/** C80 / B57 / CHT-08: unboxed labels share the exact crosshair anchors. */
export function CanonChartValueLabels({ snapshot: s, context, visible }: {
    snapshot: ChartValueSnapshot | null;
    context: ChartValueContext;
    visible: boolean;
}) {
    if (!s || !context.valueFromSourceY || !context.dates.length)
        return null;
    const { name, unit, dates, interval } = context;
    const priceAt = context.valueFromSourceY!;
    const index = constrain(s.index, 0, dates.length - 1);
    // A continuous demo curve is not a new dated observation. Date identifies the
    // nearest displayed time sample; there is no invented intraday timestamp.
    const date = formatChartTime(dates[Math.round(index)], interval);
    // A single date lane is shared by every checkbox combination and both halves.
    const historicalComparison = context.backtest && !s.future;
    const x = s.x * s.width;
    const width = context.fitLabelToPlot ? Math.min(12 * s.rem, Math.max(0, s.width - s.rem)) : Math.min(12 * s.rem, s.width * .44);
    const gap = 1.125 * s.rem;
    const side = s.width - x >= width + gap + 4 ? 'right' : 'left';
    const safeLeft = (value: number) => constrain(value, .5 * s.rem, s.width - width - (context.fitLabelToPlot ? .5 : 3) * s.rem);
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
                const a = outline[i - 1], b = outline[i];
                if (b.x < lo || a.x > hi || b.x <= a.x)
                    continue;
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
        title: name + (s.future ? ' · centralna' : ''),
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
            title: name + ' · górna',
            point: s.upper,
            tone: 'upper'
        }, 'above');
        const lower = place({
            id: 'lower',
            title: name + ' · dolna',
            point: s.lower,
            tone: 'lower'
        }, 'below');
        const opposite = side === 'right' ? 'left' : 'right';
        const oppositeFits = opposite === 'left' ? x >= width + gap + 4 : s.width - x >= width + gap + 4;
        // Central reading uses the opposite free side. At an edge, stack it beneath
        // the lower label inside the plot, never inside the forecast band.
        const middle = oppositeFits ? place(central, 'above', opposite) : place(central, 'below');
        if (!oppositeFits)
            middle.top = lower.top + blockHeight + separation;
        placed = [upper, middle, lower];
    }
    else if (historicalComparison && s.backtest) {
        const backtest: Label = {
            id: 'backtest',
            title: 'Prognoza historyczna',
            point: s.backtest,
            tone: 'sand'
        };
        const predictedAbove = s.backtest.y < s.central.y;
        placed = [place(central, predictedAbove ? 'below' : 'above'), place(backtest, predictedAbove ? 'above' : 'below')];
    }
    else {
        const above = place(central, 'above');
        placed = [context.fitLabelToPlot && above.top + blockHeight > envelope(above.left).top - clearance ? place(central, 'below') : above];
    }
    const delta = s.backtest ? priceAt(s.backtest.sourceY) - priceAt(s.central.sourceY) : 0;
    return <CanonElement {...{ "data-design-source": "460628347660177408:2297a0c0036d6d", "data-source-export-revision": "465857540723474432" }} as="div" canonId="SRM-C80" usage="CanonChartValueLabels:labels" className="srm-chart-values" data-visible={visible} data-side={side} data-mode={s.future ? 'forecast' : historicalComparison ? 'backtest' : 'history'} aria-hidden={!visible}>
    <div {...{ "data-design-source": "460628347660177408:3338383e69815a", "data-source-export-revision": "465857540723474432" }} className="srm-chart-value-date" data-chart-date-anchor="cursor-top" style={{
            left,
            width
        }}><time {...{ "data-design-source": "460628347660177408:be51ce10fb251a", "data-source-export-revision": "465857540723474432" }} dateTime={dates[Math.round(index)]}><>{date}</></time></div>
    {placed.map(label => <div {...{ "data-design-source": "460628347660177408:c4bf69d1130b86", "data-source-export-revision": "465857540723474432" }} key={label.id} className="srm-chart-value-label" data-value-anchor={label.id} data-tone={label.tone} data-side={label.side} data-placement={label.position} style={{
                left: label.left,
                top: label.top,
                width
            }}>
      <span {...{ "data-design-source": "460628347660177408:c7ffbe31c59b94", "data-source-export-revision": "465857540723474432" }} className="srm-chart-value-name" title={label.title}><>{label.title}</></span>
      <span {...{ "data-design-source": "460628347660177408:4aba7eb4fc5c8b", "data-source-export-revision": "465857540723474432" }} className="srm-chart-value-number"><>{number.format(context.valueAtIndex?.(Math.round(index)) ?? priceAt(label.point.sourceY))}</><span {...{ "data-design-source": "460628347660177408:db80fa9e13184c", "data-source-export-revision": "465857540723474432" }} className="srm-chart-value-unit"> {unit}</span></span>
      {historicalComparison && <span {...{ "data-design-source": "460628347660177408:36e58153039420", "data-source-export-revision": "465857540723474432" }} className="srm-chart-value-meta">{label.id === 'backtest' ? `Δ ${delta > 0 ? '+' : ''}${number.format(delta)} ${unit}` : 'Kurs historyczny'}</span>}
    </div>)}
  </CanonElement>;
}
