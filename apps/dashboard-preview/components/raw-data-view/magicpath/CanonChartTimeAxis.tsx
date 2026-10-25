import type { TimeIntervalFocus } from './CanonTimeIntervalHighlight';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { CanonElement } from './CanonElements';

export type ChartInterval = 'daily' | 'monthly' | 'yearly';
export const chartTimeFormats: Record<ChartInterval, string> = {
  daily: 'dd mm rrrr',
  monthly: 'mm rrrr',
  yearly: 'rrrr'
};
// Date-only strings: no local-time conversion, no implied price aggregation.
export const chartTimeDates: Record<ChartInterval,string[]> = {daily:[],monthly:[],yearly:[]};
export function formatChartTime(date: string, interval: ChartInterval) {
  const [year, month, day] = date.slice(0,10).split('-');
  if (interval === 'daily') return `${day} ${month} ${year}`;
  return interval === 'monthly' ? `${month} ${year}` : year;
}

/** SRM-C72 composes the existing SRM-C23 marker; SRM-N16–18 define labels. */
export function CanonChartTimeAxis({
  interval,
  activeIndex = null,
  intervalFocus,
  onPositionChange,
  range,
  timeline,
  boundaryIndex,
  positionAt
}: {
  interval: ChartInterval;
  activeIndex?: number | null;
  intervalFocus?: TimeIntervalFocus | null;
  onPositionChange?: (x: number | null, exactIndex?: number) => void;
  range?: [number, number];
  timeline?: string[];
  boundaryIndex?: number;
  positionAt?: (index: number) => number;
}) {
  const axis = useRef<HTMLOListElement>(null);
  const [axisWidth, setAxisWidth] = useState(0);
  useLayoutEffect(() => {
    if (!axis.current) return;
    const observer = new ResizeObserver(([entry]) => setAxisWidth(entry.contentRect.width));
    observer.observe(axis.current);
    return () => observer.disconnect();
  }, []);
  const dates = timeline ?? chartTimeDates[interval];
  const [start, end] = range ?? [0, dates.length - 1];
  const position = (index: number) => positionAt ? positionAt(index) : 24 + 764 * (index - start) / (end - start);
  const visibleIndices = dates.map((_, i) => i).filter(i => i >= start - .0001 && i <= end + .0001);
  const priority = [activeIndex, boundaryIndex, visibleIndices[0], visibleIndices[visibleIndices.length - 1], ...visibleIndices];
  const labelIndices: number[] = [];
  const minimumGap = interval === 'daily' ? 84 : interval === 'monthly' ? 65 : 46;
  for (const index of priority) {
    if (index == null || !visibleIndices.includes(index) || labelIndices.includes(index)) continue;
    if (!axisWidth || labelIndices.every(other => Math.abs(position(index) - position(other)) / 812 * axisWidth >= minimumGap)) labelIndices.push(index);
  }
  const track = (event: React.PointerEvent<HTMLOListElement>) => {
    if (event.pointerType === 'touch') return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const sourceX = (event.clientX - bounds.left) / bounds.width * 812;
    if (sourceX < 24 || sourceX > 788) {
      onPositionChange?.(null);
      return;
    }
    onPositionChange?.((sourceX - 24) / 764);
  };
  return <CanonElement ref={axis} as="ol" canonId="SRM-C72" usage="CanonChartTimeAxis:axis" className="srm-price-time-axis" onPointerMove={track} onPointerLeave={() => onPositionChange?.(null)} onPointerCancel={() => onPositionChange?.(null)} data-near-marker={activeIndex !== null} aria-label={'Oś czasu, format ' + chartTimeFormats[interval]}>
    {dates.slice(0, -1).map((_, lower) => {
      const left = Math.max(24, position(lower)),
        right = Math.min(788, position(lower + 1));
      if (right <= left) return null;
      return <li key={'interval-' + lower} aria-hidden="true" className="srm-time-interval-bridge" data-highlighted={intervalFocus?.lower === lower} style={{
        left: `${left / 812 * 100}%`,
        width: `${(right - left) / 812 * 100}%`
      }} />;
    })}
    {dates.map((date, index) => index < start - 0.0001 || index > end + 0.0001 ? null : <li key={date} className={'srm-price-time-tick' + (index === activeIndex ? ' is-active' : '') + (intervalFocus && (index === intervalFocus.lower || index === intervalFocus.upper) ? ' is-interval-edge' : '') + (index === boundaryIndex ? ' is-boundary' : '') + (boundaryIndex !== undefined && index > boundaryIndex ? ' is-forecast' : '')} data-label-visible={labelIndices.includes(index)} data-active={index === activeIndex} onPointerMove={(event: React.PointerEvent<HTMLLIElement>) => {
      if (event.pointerType === 'touch') return;
      event.stopPropagation();
      onPositionChange?.((position(index) - 24) / 764, index);
    }} style={{
      left: `${(positionAt ? positionAt(index) : 24 + 764 * (index - start) / (end - start)) / 812 * 100}%`,
      '--history-color': `color-mix(in srgb, var(--brand, #005A9C) ${32 + 68 * index / (dates.length - 1)}%, white)`
    } as React.CSSProperties}>
      <CanonElement as="span" canonId="SRM-C23" usage="CanonChartTimeAxis:marker" className="srm-history-year-marker" aria-hidden="true"><i /></CanonElement>
      <time className="srm-history-year" dateTime={interval === 'daily' ? date : interval === 'monthly' ? date.slice(0, 7) : date.slice(0, 4)}>{formatChartTime(date, interval)}</time>
    </li>)}
  </CanonElement>;
}
