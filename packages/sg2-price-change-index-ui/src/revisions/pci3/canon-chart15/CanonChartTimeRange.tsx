// Product controls vendored from MagicPath 463321469305384960@465857540723474432.
// Instruction wrappers removed; source IDs retained. No demo runtime or observations.
import React, { useEffect, useId, useRef, useState } from 'react';
import { CanonButton, CanonElement } from './CanonElements';
import { chartTimeDates, formatChartTime, type ChartInterval } from './CanonChartTimeAxis';
import { panTimeRange, rangePanLimits, type ChartTimeRange } from './chart-time-range-motion';
export type { ChartTimeRange } from './chart-time-range-motion';
type Edge = 0 | 1;
type DragTarget = Edge | 'window';
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
/** SRM-C74 · CHT-04 · SRM-B53. Resize with either handle; pan a bounded window by its middle. */
export function CanonChartTimeRange({ interval, range, onChange, overviewPath, timeline, overviewViewBox = "24 0 764 316", overviewEndX = 788, disabled = false, boundaryIndex }: {
    interval: ChartInterval;
    range: ChartTimeRange;
    onChange: (range: ChartTimeRange) => void;
    overviewPath: string;
    timeline?: string[];
    overviewViewBox?: string;
    overviewEndX?: number;
    disabled?: boolean;
    boundaryIndex?: number;
}) {
    const dates = timeline ?? chartTimeDates[interval];
    const max = dates.length - 1;
    const boundsFor = (edge: Edge, value: ChartTimeRange): ChartTimeRange => edge === 0 ? [0, boundaryIndex === undefined ? value[1] - 1 : boundaryIndex - 1] : [boundaryIndex === undefined ? value[0] + 1 : boundaryIndex + 1, max];
    const track = useRef<HTMLDivElement>(null);
    const current = useRef(range);
    const pending = useRef<ChartTimeRange | null>(null);
    const frame = useRef<number | null>(null);
    const drag = useRef<{
        target: DragTarget;
        pointerId: number;
        offset: number;
        originX: number;
        initial: ChartTimeRange;
    } | null>(null);
    const [dragging, setDragging] = useState<DragTarget | null>(null);
    const helpId = useId();
    current.current = range;
    const format = (index: number) => formatChartTime(dates[clamp(Math.round(index), 0, max)], interval);
    const apply = (value: ChartTimeRange) => {
        current.current = value;
        onChange(value);
    };
    const schedule = (value: ChartTimeRange) => {
        pending.current = value;
        if (frame.current !== null)
            return;
        frame.current = requestAnimationFrame(() => {
            frame.current = null;
            if (pending.current) {
                apply(pending.current);
                pending.current = null;
            }
        });
    };
    const finish = () => {
        if (!drag.current)
            return;
        if (frame.current !== null)
            cancelAnimationFrame(frame.current);
        frame.current = null;
        const value = pending.current ?? current.current;
        pending.current = null;
        const state = drag.current;
        drag.current = null;
        setDragging(null);
        if (state.target === 'window') {
            // Snap the translation, never resize the window on release.
            apply(panTimeRange(state.initial, Math.round(value[0] - state.initial[0]), max, boundaryIndex));
            return;
        }
        // Continuous zoom while dragging, exact period boundaries on release.
        const start = clamp(Math.round(value[0]), 0, boundaryIndex === undefined ? max - 1 : boundaryIndex - 1);
        const end = clamp(Math.round(value[1]), boundaryIndex === undefined ? start + 1 : boundaryIndex + 1, max);
        apply([start, end]);
    };
    useEffect(() => () => {
        if (frame.current !== null)
            cancelAnimationFrame(frame.current);
    }, []);
    const begin = (event: React.PointerEvent<HTMLButtonElement>, target: DragTarget) => {
        if (disabled || !event.isPrimary || event.button !== 0 || !track.current)
            return;
        if (target === 'window' && !canPan)
            return;
        event.preventDefault();
        event.currentTarget.focus({
            preventScroll: true
        });
        const bounds = track.current.getBoundingClientRect();
        drag.current = {
            target,
            pointerId: event.pointerId,
            offset: target === 'window' ? 0 : event.clientX - (bounds.left + current.current[target] / max * bounds.width),
            originX: event.clientX,
            initial: [...current.current]
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(target);
    };
    const move = (event: React.PointerEvent<HTMLButtonElement>) => {
        const state = drag.current;
        if (!state || state.pointerId !== event.pointerId || !track.current)
            return;
        const bounds = track.current.getBoundingClientRect();
        if (!bounds.width)
            return;
        if (state.target === 'window') {
            const delta = (event.clientX - state.originX) / bounds.width * max;
            schedule(panTimeRange(state.initial, delta, max, boundaryIndex));
            return;
        }
        const position = (event.clientX - state.offset - bounds.left) / bounds.width * max;
        const value: ChartTimeRange = [...(pending.current ?? current.current)];
        const [low, high] = boundsFor(state.target, value);
        value[state.target] = clamp(position, low, high);
        schedule(value);
    };
    const keyDown = (event: React.KeyboardEvent<HTMLButtonElement>, edge: Edge) => {
        const [minimum, maximum] = boundsFor(edge, current.current);
        const low = Math.ceil(minimum);
        const high = Math.floor(maximum);
        const value: ChartTimeRange = [...current.current];
        const step = event.shiftKey ? 2 : 1;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowDown')
            value[edge] -= step;
        else if (event.key === 'ArrowRight' || event.key === 'ArrowUp')
            value[edge] += step;
        else if (event.key === 'Home')
            value[edge] = low;
        else if (event.key === 'End')
            value[edge] = high;
        else
            return;
        event.preventDefault();
        value[edge] = clamp(Math.round(value[edge]), low, high);
        apply(value);
    };
    const [panLow, panHigh] = rangePanLimits(range, max, boundaryIndex);
    const canPan = panHigh - panLow > 0.0001;
    const panKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
        const step = event.shiftKey ? 2 : 1;
        let delta: number;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowDown')
            delta = -step;
        else if (event.key === 'ArrowRight' || event.key === 'ArrowUp')
            delta = step;
        else if (event.key === 'Home')
            delta = panLow;
        else if (event.key === 'End')
            delta = panHigh;
        else
            return;
        event.preventDefault();
        apply(panTimeRange(current.current, delta, max, boundaryIndex));
    };
    return <CanonElement {...{ "data-design-source": "460628347660177408:3ad9a61d7c7bcd", "data-source-export-revision": "465857540723474432" }} as="div" canonId="SRM-C74" usage="CanonChartTimeRange:navigator" className="srm-time-range" role="group" aria-label="Zakres czasu wykresu" data-dragging={dragging !== null}>
    <div {...{ "data-design-source": "460628347660177408:1e3cb18fd75691", "data-source-export-revision": "465857540723474432" }} className="srm-time-range-heading"><span {...{ "data-design-source": "460628347660177408:3e26e1eb1fd5c0", "data-source-export-revision": "465857540723474432" }}>Zakres czasu</span><CanonButton {...{ "data-design-source": "460628347660177408:0a4a8fbc43be71", "data-source-export-revision": "465857540723474432" }} canonId="SRM-C02" usage="CanonChartTimeRange:reset" type="button" className="lib-btn srm-time-range-reset" disabled={disabled || range[0] === 0 && range[1] === max} onClick={() => apply([0, max])}>Pełny zakres</CanonButton></div>
    <p {...{ "data-design-source": "460628347660177408:6e71840f5445c0", "data-source-export-revision": "465857540723474432" }} className="srm-sr-only" id={helpId}>Przeciągnij uchwyty, aby zmienić szerokość zakresu. Przeciągnij jego środek, aby przesunąć cały zakres bez zmiany szerokości. Strzałki przesuwają wybrany uchwyt lub cały zakres o jeden okres, Shift o dwa. Home i End przesuwają do dopuszczalnej granicy. {boundaryIndex === undefined ? 'Minimalny zakres obejmuje dwa znaczniki czasu.' : 'Lewy uchwyt zmienia tylko historię, prawy tylko prognozę. Ostatnia obserwacja pozostaje na środku wykresu. Przesuwanie całego zakresu zatrzymuje się tak, aby po każdej stronie ostatniej obserwacji pozostał co najmniej jeden pełny odstęp czasu.'}</p>
    <div {...{ "data-design-source": "460628347660177408:173d4f1686bc3a", "data-source-export-revision": "465857540723474432" }} className="srm-time-range-track" ref={track}>
      <svg {...{ "data-design-source": "460628347660177408:fa6cdb66f3caa8", "data-source-export-revision": "465857540723474432" }} className="srm-time-range-overview" viewBox={overviewViewBox} preserveAspectRatio="none" aria-hidden="true"><path {...{ "data-design-source": "460628347660177408:9b8ae198814d01", "data-source-export-revision": "465857540723474432" }} d={overviewPath + ` L ${overviewEndX} 304 L 24 304 Z`} fill="var(--blue-soft)"/><path {...{ "data-design-source": "460628347660177408:e87c26b67249f7", "data-source-export-revision": "465857540723474432" }} d={overviewPath} fill="none" stroke="var(--brand)" strokeWidth="1" vectorEffect="non-scaling-stroke"/></svg>
      <span {...{ "data-design-source": "460628347660177408:b9a4c174792617", "data-source-export-revision": "465857540723474432" }} className="srm-time-range-mask" style={{
            left: 0,
            width: `${range[0] / max * 100}%`
        }} aria-hidden="true"/>
      <span {...{ "data-design-source": "460628347660177408:c0674867b943b1", "data-source-export-revision": "465857540723474432" }} className="srm-time-range-mask" style={{
            right: 0,
            width: `${(max - range[1]) / max * 100}%`
        }} aria-hidden="true"/>
      <CanonButton {...{ "data-design-source": "460628347660177408:1b3be7af18086f", "data-source-export-revision": "465857540723474432" }} canonId="SRM-C74" usage="CanonChartTimeRange:window" type="button" role="slider" className="srm-time-range-window" disabled={disabled || !canPan} style={{
            left: `${range[0] / max * 100}%`,
            width: `${(range[1] - range[0]) / max * 100}%`
        }} aria-label="Przesuń cały zakres czasu" aria-orientation="horizontal" aria-valuemin={range[0] + panLow} aria-valuemax={range[0] + panHigh} aria-valuenow={Number(range[0].toFixed(2))} aria-valuetext={`${format(range[0])} – ${format(range[1])}`} aria-describedby={helpId} data-dragging={dragging === 'window'} onPointerDown={e => begin(e, 'window')} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} onBlur={finish} onKeyDown={panKeyDown}/>
      <CanonButton {...{ "data-design-source": "460628347660177408:19e40934bccf43", "data-source-export-revision": "465857540723474432" }} canonId="SRM-C74" usage="CanonChartTimeRange:start" type="button" role="slider" disabled={disabled} className="srm-time-range-handle" style={{
            left: `${range[0] / max * 100}%`
        }} aria-label="Początek zakresu czasu" aria-orientation="horizontal" aria-valuemin={0} aria-valuemax={boundsFor(0, range)[1]} aria-valuenow={Number(range[0].toFixed(2))} aria-valuetext={format(range[0])} aria-describedby={helpId} data-dragging={dragging === 0} onPointerDown={e => begin(e, 0)} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} onBlur={finish} onKeyDown={e => keyDown(e, 0)}><span {...{ "data-design-source": "460628347660177408:a5dff2fd165438", "data-source-export-revision": "465857540723474432" }} className="srm-time-range-grip" aria-hidden="true"/></CanonButton>
      <CanonButton {...{ "data-design-source": "460628347660177408:113443e4b0c225", "data-source-export-revision": "465857540723474432" }} canonId="SRM-C74" usage="CanonChartTimeRange:end" type="button" role="slider" disabled={disabled} className="srm-time-range-handle" style={{
            left: `${range[1] / max * 100}%`
        }} aria-label="Koniec zakresu czasu" aria-orientation="horizontal" aria-valuemin={boundsFor(1, range)[0]} aria-valuemax={max} aria-valuenow={Number(range[1].toFixed(2))} aria-valuetext={format(range[1])} aria-describedby={helpId} data-dragging={dragging === 1} onPointerDown={e => begin(e, 1)} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} onBlur={finish} onKeyDown={e => keyDown(e, 1)}><span {...{ "data-design-source": "460628347660177408:83b29e6dce27f7", "data-source-export-revision": "465857540723474432" }} className="srm-time-range-grip" aria-hidden="true"/></CanonButton>
    </div>
    <div {...{ "data-design-source": "460628347660177408:a39be1479d0df6", "data-source-export-revision": "465857540723474432" }} className="srm-time-range-dates" aria-live={dragging === null ? 'polite' : 'off'} aria-atomic="true">
      <span {...{ "data-design-source": "460628347660177408:e0252c40d6a2c7", "data-source-export-revision": "465857540723474432" }} className="srm-time-range-date" style={{
            left: `${range[0] / max * 100}%`
        }}><span {...{ "data-design-source": "460628347660177408:ec3979701715bd", "data-source-export-revision": "465857540723474432" }} className="srm-sr-only">Początek zakresu: </span><>{format(range[0])}</></span>
      <span {...{ "data-design-source": "460628347660177408:0378fbf69cdc2f", "data-source-export-revision": "465857540723474432" }} className="srm-time-range-date" style={{
            left: `${range[1] / max * 100}%`
        }}><span {...{ "data-design-source": "460628347660177408:14fd1ac3a901c1", "data-source-export-revision": "465857540723474432" }} className="srm-sr-only">Koniec zakresu: </span><>{format(range[1])}</></span>
    </div>
  </CanonElement>;
}
