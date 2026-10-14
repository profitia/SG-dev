"use client";
import { CanonElement, CanonButton } from './ui-canon';
import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import { historyDomain, yearColor } from './financial-history-export';
import type { FinancialHistoryPoint } from './financial-history-export';
type Props = {
  overview?: boolean;
  name: string;
  unit: string;
  selectedYear?: number;
  points: FinancialHistoryPoint[];
};
const number = (value: number, digits = 2) => value.toLocaleString('pl-PL', {
  maximumFractionDigits: digits
});
const suffix = (unit: string) => unit === 'PLN_THOUSANDS' ? 'tys. zł' : unit === 'PLN' ? 'zł' : unit === 'PERCENT' ? '%' : unit === 'DAYS' ? 'dni' : '×';
const fullValue = (value: number | null, unit: string) => value === null ? 'Brak danych' : value.toLocaleString('pl-PL', {
  minimumFractionDigits: unit === 'PLN' || unit === 'PLN_THOUSANDS' ? 2 : 0,
  maximumFractionDigits: unit === 'PLN' || unit === 'PLN_THOUSANDS' ? 2 : 6
}) + (unit === 'PERCENT' || unit === 'RATIO' ? '' : ' ') + suffix(unit);
function compact(value: number, unit: string) {
  if (unit === 'PLN_THOUSANDS') return Math.abs(value) >= 1000 ? [number(value / 1000), 'mln zł'] : [number(value), 'tys. zł'];
  if (unit === 'PLN') {
    if (Math.abs(value) >= 1e9) return [number(value / 1e9), 'mld zł'];
    if (Math.abs(value) >= 1e6) return [number(value / 1e6), 'mln zł'];
    if (Math.abs(value) >= 1e3) return [number(value / 1e3, 1), 'tys. zł'];
  }
  return [number(value), suffix(unit)];
}
export function FinancialHistoryChart({
  name,
  unit,
  selectedYear,
  points,
  overview = false
}: Props) {
  const id = useId();
  const chartScroll = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const scroll = chartScroll.current;
    if (!scroll) return;
    const resize = new ResizeObserver(() => {
      if (scroll.clientHeight > 0) scroll.style.setProperty('--history-plot-height', `${Math.max(36, scroll.clientHeight - 140)}px`);
    });
    resize.observe(scroll);
    return () => resize.disconnect();
  }, []);
  const sorted = [...points].sort((a, b) => a.year - b.year);
  const initial: number | undefined = undefined;
  const [pinned, setPinned] = useState<number | undefined>(initial);
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const activeYear = hovered ?? focused ?? pinned;
  const active = sorted.find(p => p.year === activeYear) ?? sorted.at(-1);
  const values = sorted.flatMap(p => p.value !== null && Number.isFinite(p.value) ? [p.value] : []);
  const scale = historyDomain(values);
  const span = scale.max - scale.min;
  const zero = scale.max / span * 100;
  const maxMagnitude = Math.max(0, ...values.map(Math.abs));
  const divisor = unit === 'PLN_THOUSANDS' ? maxMagnitude >= 1000 ? 1000 : 1 : unit === 'PLN' ? maxMagnitude >= 1e9 ? 1e9 : maxMagnitude >= 1e6 ? 1e6 : maxMagnitude >= 1e3 ? 1e3 : 1 : 1;
  const axisUnit = unit === 'PLN_THOUSANDS' ? divisor === 1000 ? 'mln zł' : 'tys. zł' : unit === 'PLN' ? divisor === 1e9 ? 'mld zł' : divisor === 1e6 ? 'mln zł' : divisor === 1e3 ? 'tys. zł' : 'zł' : suffix(unit);
  const description = values.length === 0 ? 'Brak dostępnych wartości dla pokazanych lat.' : 'Wspólna skala od zera. Odcień wskazuje rok, nie ocenę wyniku.';
  if (!active) return <p className="srm-history-chart-empty">Brak okresów sprawozdawczych.</p>;
  return <CanonElement as="section" canonId="SRM-C21" usage="FinancialHistoryChart:01" className="srm-history-chart" aria-label={'Wykres historii: ' + name}>
    {activeYear !== undefined && <CanonElement as="div" canonId="SRM-C24" usage="FinancialHistoryChart:02" className="srm-overview-tooltip" role="status"><span>{active.year}</span><strong>{fullValue(active.value, unit)}</strong></CanonElement>}
    <p className="srm-sr-only" id={`${id}-help`}>Od najstarszego do najnowszego roku. Wskaż słupek, użyj Tab lub strzałek, albo dotknij roku, aby odczytać dokładną wartość. {description}</p>
    <div ref={chartScroll} className="srm-history-chart-scroll" role="region" aria-label="Lata sprawozdawcze i wartości" tabIndex={0}>
      <div className="srm-history-chart-canvas" style={{
        minWidth: Math.max(440, sorted.length * 78 + 62),
        '--history-canvas-width': `${Math.max(440, sorted.length * 78 + 62)}px`,
        '--history-zero': `${zero}%`
      } as React.CSSProperties}>
        <div className="srm-history-yaxis" aria-hidden="true"><span className="srm-history-axis-unit">{axisUnit}</span>{!scale.emptyScale && scale.ticks.map(t => <span key={t} style={{
            top: `${(scale.max - t) / span * 100}%`
          }}>{number(t / divisor)}</span>)}</div>
        <div className="srm-history-grid" aria-hidden="true">{(scale.emptyScale ? [0, .5, 1] : scale.ticks).map(t => <i key={t} className={t === 0 ? 'is-zero' : ''} style={{
            top: `${(scale.max - t) / span * 100}%`
          }} />)}</div>
        <div className="srm-history-columns" style={{
          gridTemplateColumns: `repeat(${sorted.length}, minmax(0, 1fr))`
        }}>
          {sorted.map((point, index) => {
            const v = point.value;
            const height = v === null ? 0 : Math.abs(v) / span * 100;
            const top = v !== null && v > 0 ? (scale.max - v) / span * 100 : zero;
            const label = v === null ? ['—', 'Brak danych'] : compact(v, unit);
            const labelTop = top;
            const labelClass = 'above-bar';
            const style = {
              '--history-color': yearColor(index, sorted.length),
              '--history-label-ink': '#003366'
            } as React.CSSProperties;
            return <CanonButton canonId="SRM-C22" usage="FinancialHistoryChart:03" key={point.year} type="button" className={'srm-history-column' + (activeYear === point.year ? ' is-active' : '') + (point.year === selectedYear ? ' is-selected-period' : '')} style={style} aria-label={`${point.year}: ${fullValue(v, unit)}${point.year === selectedYear ? ', wybrany okres' : ''}`} aria-describedby={`${id}-help`} aria-pressed={pinned === point.year} data-year={point.year} data-value={v ?? 'missing'} onPointerEnter={e => {
              if (e.pointerType !== 'touch') setHovered(point.year);
            }} onPointerLeave={() => setHovered(null)} onFocus={() => {
              setHovered(null);
              setFocused(point.year);
            }} onBlur={() => setFocused(null)} onClick={() => setPinned(point.year)} onKeyDown={e => {
              if (e.key === 'Escape') {
                setPinned(undefined);
                setHovered(null);
                setFocused(null);
                return;
              }
              const next = e.key === 'ArrowRight' ? Math.min(index + 1, sorted.length - 1) : e.key === 'ArrowLeft' ? Math.max(index - 1, 0) : e.key === 'Home' ? 0 : e.key === 'End' ? sorted.length - 1 : null;
              if (next === null) return;
              e.preventDefault();
              (e.currentTarget.parentElement?.children[next] as HTMLButtonElement)?.focus({ preventScroll: true });
            }}>
              <span className="srm-history-bar-stage" aria-hidden="true"><span className="srm-history-bar-visual">
                <span className="srm-history-bar-track" />
                {v !== null && v !== 0 && <span className={'srm-history-bar-fill' + (v < 0 ? ' is-negative' : '')} style={{
                    top: `${top}%`,
                    height: `${height}%`
                  }} />}
                <span className={`srm-history-bar-label ${labelClass}${v === null ? ' is-missing' : ''}`} style={{
                    top: `${labelTop}%`
                  }}><b>{label[0]}</b><small>{label[1]}</small></span>
              </span></span>
              <CanonElement as="span" canonId="SRM-C23" usage="FinancialHistoryChart:04" className="srm-history-year-marker" aria-hidden="true"><i /></CanonElement><span className="srm-history-year">{point.year}</span>
            </CanonButton>;
          })}
        </div>
      </div>
    </div>
    <div className="srm-history-chart-caption"><p>{description}</p></div>
    <p className="srm-history-mobile-hint">Przesuń wykres w poziomie, aby zobaczyć pozostałe lata.</p>
  </CanonElement>;
}
export { yearColor } from './financial-history-export';
