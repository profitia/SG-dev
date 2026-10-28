// Product controls vendored from MagicPath 463321469305384960@465857540723474432.
// Instruction wrappers removed; source IDs retained. No demo runtime or observations.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CanonElement } from './CanonElements';
import { CanonChartValueLabels, type ChartValueContext, type ChartValueSnapshot } from './CanonChartValueLabels';
type Position = {
    x: number;
    y: number;
};
const clamp = (value: number) => Math.max(0, Math.min(1, value));
// Sample the displayed path at one screen X, including the active half's zoom.
// These positions are geometry anchors only, never calculated forecast values.
function pointOnCurve(curve: SVGPathElement, targetX: number) {
    const matrix = curve.getScreenCTM();
    if (!matrix)
        return null;
    let low = 0;
    let high = curve.getTotalLength();
    for (let step = 0; step < 18; step++) {
        const middle = (low + high) / 2;
        const point = curve.getPointAtLength(middle).matrixTransform(matrix);
        if (point.x < targetX)
            low = middle;
        else
            high = middle;
    }
    return curve.getPointAtLength((low + high) / 2).matrixTransform(matrix);
}
/** SRM-C73 · CHT-03 · SRM-B51. Curve-constrained guides with C80 illustrative value labels. The time curve must be monotonic in x. */
export function CanonChartCrosshair({ curveRef, forecastCurveRef, forecastUpperRef, forecastLowerRef, backtestCurveRef, onPositionChange, valueContext, resetKey }: {
    curveRef: React.RefObject<SVGPathElement | null>;
    forecastCurveRef?: React.RefObject<SVGPathElement | null>;
    forecastUpperRef?: React.RefObject<SVGPathElement | null>;
    forecastLowerRef?: React.RefObject<SVGPathElement | null>;
    backtestCurveRef?: React.RefObject<SVGPathElement | null>;
    onPositionChange?: (x: number | null) => void;
    valueContext?: ChartValueContext;
    resetKey?: string;
}) {
    const layer = useRef<HTMLDivElement>(null);
    const frame = useRef<number | null>(null);
    const position = useRef<Position>({
        x: 0.5,
        y: 0.5
    });
    const active = useRef(false);
    // Cache the displayed outline, not prices. Rebuild only on a path/zoom/layout
    // change; each pointer frame then performs lightweight rectangle clearance.
    const outlineCache = useRef(new WeakMap<SVGPathElement, {
        key: string;
        points: {
            x: number;
            y: number;
        }[];
    }>());
    const [visible, setVisible] = useState(false);
    const [snapshot, setSnapshot] = useState<ChartValueSnapshot | null>(null);
    const paint = useCallback(() => {
        frame.current = null;
        const surface = layer.current;
        let curve = curveRef.current;
        if (!surface || !curve)
            return;
        const bounds = surface.getBoundingClientRect();
        if (!bounds.width || !bounds.height)
            return;
        const targetX = bounds.left + position.current.x * bounds.width;
        const future = forecastCurveRef?.current;
        const futureMatrix = future?.getScreenCTM();
        const joinX = future && futureMatrix ? future.getPointAtLength(0).matrixTransform(futureMatrix).x : Infinity;
        if (future && targetX >= joinX)
            curve = future;
        const sourceMatrix = curve.getScreenCTM();
        if (sourceMatrix && valueContext?.isSourceXAvailable) {
            const source = new DOMPoint(targetX, bounds.top).matrixTransform(sourceMatrix.inverse());
            if (!valueContext.isSourceXAvailable(source.x)) {
                setVisible(false);
                setSnapshot(null);
                onPositionChange?.(null);
                return;
            }
        }
        setVisible(true);
        const point = pointOnCurve(curve, targetX);
        if (!point)
            return;
        const upperCurve = forecastUpperRef?.current;
        const lowerCurve = forecastLowerRef?.current;
        const upper = curve === future && upperCurve ? pointOnCurve(upperCurve, point.x) : null;
        const lower = curve === future && lowerCurve ? pointOnCurve(lowerCurve, point.x) : null;
        // At the common origin all three coincide: render one clean anchor there.
        const forecastPoints = Boolean(upper && lower && targetX > joinX + 0.5);
        if (upper && lower) {
            surface.style.setProperty('--crosshair-upper-y', `${clamp((upper.y - bounds.top) / bounds.height) * 100}%`);
            surface.style.setProperty('--crosshair-lower-y', `${clamp((lower.y - bounds.top) / bounds.height) * 100}%`);
        }
        const backtest = curve !== future && backtestCurveRef?.current && targetX < joinX - 0.5 ? pointOnCurve(backtestCurveRef.current, point.x) : null;
        // Coincident points merge; no false separation at a zero delta.
        surface.dataset.backtestPoint = String(Boolean(backtest && Math.abs(backtest.y - point.y) > 0.5));
        if (backtest)
            surface.style.setProperty('--crosshair-backtest-y', `${clamp((backtest.y - bounds.top) / bounds.height) * 100}%`);
        surface.dataset.forecastPoints = String(forecastPoints);
        surface.style.setProperty('--crosshair-x', `${clamp((point.x - bounds.left) / bounds.width) * 100}%`);
        surface.style.setProperty('--crosshair-y', `${clamp((point.y - bounds.top) / bounds.height) * 100}%`);
        onPositionChange?.(clamp((point.x - bounds.left) / bounds.width));
        const matrix = curve.getScreenCTM();
        if (valueContext && matrix) {
            const local = point.matrixTransform(matrix.inverse());
            const anchor = (p: DOMPoint | null, path?: SVGPathElement | null) => {
                const m = path?.getScreenCTM();
                return p && m ? {
                    y: (p.y - bounds.top) / bounds.height,
                    sourceY: p.matrixTransform(m.inverse()).y
                } : null;
            };
            const outlines = [curveRef.current, future, upperCurve, lowerCurve, backtestCurveRef?.current].filter((path): path is SVGPathElement => Boolean(path)).map(path => {
                const m = path.getScreenCTM();
                if (!m)
                    return [];
                const key = [path.getAttribute('d'), m.a, m.b, m.c, m.d, m.e, m.f, bounds.left, bounds.top].join(':');
                const cached = outlineCache.current.get(path);
                if (cached?.key === key)
                    return cached.points;
                const length = path.getTotalLength();
                const points = Array.from({
                    length: 257
                }, (_, i) => {
                    const p = path.getPointAtLength(length * i / 256).matrixTransform(m);
                    return {
                        x: p.x - bounds.left,
                        y: p.y - bounds.top
                    };
                });
                outlineCache.current.set(path, {
                    key,
                    points
                });
                return points;
            });
            setSnapshot({
                outlines,
                x: clamp((point.x - bounds.left) / bounds.width),
                width: bounds.width,
                height: bounds.height,
                rem: parseFloat(getComputedStyle(document.documentElement).fontSize) || 16,
                index: valueContext.indexFromSourceX?.(local.x) ?? (local.x - 24) / 764 * 5,
                future: curve === future,
                central: {
                    y: (point.y - bounds.top) / bounds.height,
                    sourceY: local.y
                },
                upper: anchor(upper, upperCurve),
                lower: anchor(lower, lowerCurve),
                backtest: anchor(backtest || null, backtestCurveRef?.current)
            });
        }
    }, [curveRef, forecastCurveRef, forecastUpperRef, forecastLowerRef, backtestCurveRef, onPositionChange, valueContext]);
    const showAt = useCallback((next: Position) => {
        position.current = {
            x: clamp(next.x),
            y: clamp(next.y)
        };
        // First appearance is already on the curve at the pointer x, with no travel from the centre.
        if (!active.current) {
            active.current = true;
            paint();
            setVisible(true);
        }
        else if (frame.current === null) {
            frame.current = requestAnimationFrame(paint);
        }
    }, [paint]);
    const hide = useCallback(() => {
        active.current = false;
        if (layer.current) {
            layer.current.dataset.forecastPoints = 'false';
            layer.current.dataset.backtestPoint = 'false';
        }
        setVisible(false);
        onPositionChange?.(null);
        if (frame.current !== null)
            cancelAnimationFrame(frame.current);
        frame.current = null;
    }, [onPositionChange]);
    useEffect(() => {
        hide();
    }, [resetKey, hide]);
    const track = (event: React.PointerEvent<HTMLDivElement>) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (!bounds.width || !bounds.height)
            return;
        showAt({
            x: (event.clientX - bounds.left) / bounds.width,
            y: (event.clientY - bounds.top) / bounds.height
        });
    };
    useEffect(() => {
        const onVisibility = () => {
            if (document.hidden)
                hide();
        };
        const resize = new ResizeObserver(hide);
        if (layer.current)
            resize.observe(layer.current);
        window.addEventListener('blur', hide);
        window.addEventListener('scroll', hide, true);
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            resize.disconnect();
            window.removeEventListener('blur', hide);
            window.removeEventListener('scroll', hide, true);
            document.removeEventListener('visibilitychange', onVisibility);
            if (frame.current !== null)
                cancelAnimationFrame(frame.current);
        };
    }, [hide]);
    return <CanonElement {...{ "data-design-source": "460628347660177408:f6b481be2b7666", "data-source-export-revision": "465857540723474432" }} as="div" canonId="SRM-C73" usage="CanonChartCrosshair:overlay" ref={layer} className="srm-chart-crosshair" data-visible={visible} tabIndex={0} role="group" aria-label={valueContext?.accessibleLabel ?? "Kursor wartości wykresu. Strzałki przesuwają kursor, Escape ukrywa."} onPointerEnter={(e: React.PointerEvent<HTMLDivElement>) => {
            if (e.pointerType !== 'touch')
                track(e);
        }} onPointerMove={(e: React.PointerEvent<HTMLDivElement>) => {
            if (e.pointerType !== 'touch')
                track(e);
        }} onPointerDown={track} onPointerUp={(e: React.PointerEvent<HTMLDivElement>) => {
            if (e.pointerType === 'touch')
                hide();
        }} onPointerLeave={hide} onPointerCancel={hide} onBlur={hide} onFocus={(e: React.FocusEvent<HTMLDivElement>) => {
            if (e.currentTarget.matches(':focus-visible'))
                showAt({
                    x: 0.5,
                    y: 0.5
                });
        }} onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                hide();
                return;
            }
            const step = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
            if (!step)
                return;
            e.preventDefault();
            const size = e.shiftKey ? 0.1 : 0.02;
            showAt({
                x: position.current.x + step * size,
                y: position.current.y
            });
        }}>
    <div {...{ "data-design-source": "460628347660177408:87fc9accfe2119", "data-source-export-revision": "465857540723474432" }} className="srm-chart-crosshair-guides" aria-hidden="true">
      <span {...{ "data-design-source": "460628347660177408:07aa319b7cc92f", "data-source-export-revision": "465857540723474432" }} className="srm-chart-crosshair-vertical"/>
      <span {...{ "data-design-source": "460628347660177408:78d24a62a825cf", "data-source-export-revision": "465857540723474432" }} className="srm-chart-crosshair-horizontal"/>
    </div>
    <span {...{ "data-design-source": "460628347660177408:6ac9628867032f", "data-source-export-revision": "465857540723474432" }} className="srm-chart-crosshair-point" data-chart-anchor="central" aria-hidden="true"/>
    {backtestCurveRef && <span {...{ "data-design-source": "460628347660177408:80bdee01121bda", "data-source-export-revision": "465857540723474432" }} className="srm-chart-crosshair-point srm-chart-crosshair-backtest-point" data-chart-anchor="backtest" aria-hidden="true"/>}
    {forecastCurveRef && <>
      <span {...{ "data-design-source": "460628347660177408:4fc57508c19dab", "data-source-export-revision": "465857540723474432" }} className="srm-chart-crosshair-point srm-chart-crosshair-boundary-point" data-chart-anchor="upper" aria-hidden="true"/>
      <span {...{ "data-design-source": "460628347660177408:88bb1cea2fabe4", "data-source-export-revision": "465857540723474432" }} className="srm-chart-crosshair-point srm-chart-crosshair-boundary-point" data-chart-anchor="lower" aria-hidden="true"/>
    </>}
    {valueContext && <CanonChartValueLabels snapshot={snapshot} context={valueContext} visible={visible}/>}
  </CanonElement>;
}
