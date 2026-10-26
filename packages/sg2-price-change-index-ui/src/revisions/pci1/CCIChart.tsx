import React, { useId, useState } from 'react';
import { CanonButton } from './CanonElements';
import { Icon } from './cci-icons';
import type {Component,Definition,Scenario,View} from '../../data-contracts/pci1';
export function createCCIChart(data:typeof import('../../data-contracts/pci1')){
const {componentIndex,totalIndex,monthlyChange,fmt,signed,months,monthShort}=data;


function CCIChart({
  definition: d,
  scenario,
  selected,
  onSelect,
  component,
  compact = false
}: {
  definition: Definition;
  scenario: Scenario;
  selected: number;
  onSelect: (m: number) => void;
  component?: Component;
  compact?: boolean;
}) {
  const [view, setView] = useState<View>('index'),
    [hover, setHover] = useState<number | null>(null),
    [compare, setCompare] = useState(true);
  const uid = useId().replace(/:/g, '');
  const indices = [0, 1, 2].filter(i => i >= d.base);
  const value = (m: number, comp = false) => {
    const n = comp && component ? componentIndex(component, d, m, scenario) : totalIndex(d, m, scenario);
    if (n == null) return null;
    if (view === 'cumulative') return n - 100;
    if (view === 'monthly') {
      if (m === d.base) return null;
      const prev = comp && component ? componentIndex(component, d, m - 1, scenario) : totalIndex(d, m - 1, scenario);
      return prev == null ? null : (n / prev - 1) * 100;
    }
    return n;
  };
  const values = indices.flatMap(m => [value(m), component ? value(m, true) : null]).filter((v): v is number => v != null);
  const reference = view === 'index' ? 100 : 0;
  const min = Math.floor((Math.min(reference, ...values) - 2) / 5) * 5,
    max = Math.ceil((Math.max(reference, ...values) + 2) / 5) * 5;
  const W = 760,
    H = 270,
    L = 45,
    R = 70,
    T = 28,
    B = 34;
  const x = (i: number) => L + (i - d.base) / Math.max(1, 2 - d.base) * (W - L - R);
  const y = (v: number) => T + (max - v) / (max - min) * (H - T - B);
  const path = (comp = false) => {
    let prior = false;
    return indices.map(i => {
      const v = value(i, comp);
      if (v == null) {
        prior = false;
        return '';
      }
      const p = (prior ? 'L' : 'M') + x(i) + ',' + y(v);
      prior = true;
      return p;
    }).join(' ');
  };
  const current = hover ?? selected;
  const mainValue = component ? value(current, true) : value(current);
  return <div className={'cci-chart ' + (compact ? 'is-compact' : '')}>
 {!compact && <div className="cci-chart-controls"><div className="cci-segment srm-history-view-switch" role="group" aria-label="Widok wykresu">{([['index', 'Indeks'], ['cumulative', 'Zmiana od bazy'], ['monthly', 'Zmiana m/m']] as [View, string][]).map(([v, l]) => <CanonButton canonId="SRM-C28" usage={'CCIChart:view-' + v} key={v} aria-pressed={view === v} onClick={() => setView(v)}>{l}</CanonButton>)}</div><div className="cci-range" role="group" aria-label="Zakres historii">{['6M', '12M', '24M'].map(v => <CanonButton canonId="SRM-C86" usage="CCIChart:canonical-action-1" key={v} disabled title={'Dostępne tylko ' + indices.length + ' miesiące historii'}>{v}</CanonButton>)}<CanonButton canonId="SRM-C86" usage="CCIChart:canonical-action-2" aria-pressed="true" title="Cała dostępna historia">Całość</CanonButton></div></div>}
 <div className="cci-chart-legend"><span><i style={{
          background: component?.color ?? 'var(--brand)'
        }} />{component?.name ?? 'Price Change Index'}</span>{component && <label><input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} /><i className="is-dashed" />Cała kategoria</label>}<span className="cci-chart-reference">{view === 'index' ? 'Baza = 100' : 'Linia odniesienia = 0%'} · miesięcznie</span></div>
 <div className="cci-plot" onMouseLeave={() => setHover(null)}>
 <svg viewBox={'0 0 ' + W + ' ' + H} role="img" aria-label={'Historia ' + (component?.name ?? 'CCI') + '. ' + indices.map(i => months[i] + ': ' + fmt(component ? value(i, true) : value(i))).join('; ')}>
 <defs><linearGradient id={uid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--brand)" stopOpacity=".10" /><stop offset="100%" stopColor="var(--brand)" stopOpacity="0" /></linearGradient></defs>
 {[0, 1, 2, 3, 4].map(i => {
          const v = min + (max - min) * i / 4;
          return <g key={i}><line x1={L} x2={W - R + 12} y1={y(v)} y2={y(v)} stroke="var(--faint-line)" strokeWidth="1" /><text x={L - 12} y={y(v) + 4} textAnchor="end" fill="var(--unknown)" fontSize="11">{fmt(v, 0)}{view === 'index' ? '' : '%'}</text></g>;
        })}
 <line x1={L} x2={W - R + 16} y1={y(reference)} y2={y(reference)} stroke="var(--unknown)" strokeDasharray="5 5" /><text x={W - R + 23} y={y(reference) + 4} fill="var(--unknown)" fontSize="10">{reference}</text>
 {component && compare && <path d={path()} fill="none" stroke="var(--unknown)" strokeWidth="2" strokeDasharray="5 5" />}
 <path d={path(!!component)} fill="none" stroke={component?.color ?? 'var(--brand)'} strokeWidth="3" strokeLinejoin="round" />
 {indices.map(i => {
          const v = component ? value(i, true) : value(i),
            missing = v == null;
          return <g key={i}>
 <rect x={x(i) - 45} y={T - 4} width="90" height={H - T} fill="transparent" onMouseEnter={() => setHover(i)} onClick={() => onSelect(i)} style={{
              cursor: 'pointer'
            }} />
 {i === current && !missing && <line x1={x(i)} x2={x(i)} y1={T} y2={H - B} stroke="var(--line)" strokeDasharray="3 4" />}
 {missing ? <><rect x={x(i) - 8} y={y(reference) - 8} width="16" height="16" rx="3" fill="var(--caution-soft)" stroke="var(--caution)" /><text x={x(i)} y={y(reference) + 4} textAnchor="middle" fontSize="11" fill="var(--caution-text)">!</text></> : <><circle cx={x(i)} cy={y(v)} r={i === current ? 6 : 4} fill="white" stroke={component?.color ?? 'var(--brand)'} strokeWidth="2.5" />{i === 2 && hover == null && <text x={x(i) + 12} y={y(v) - 12} fontSize="14" fontWeight="600" fill="var(--brand-dark)">{view === 'index' ? fmt(v) : signed(v) + '%'}</text>}</>}
 <text x={x(i)} y={H - 10} textAnchor="middle" fill={i === current ? 'var(--brand)' : 'var(--muted)'} fontWeight={i === current ? 650 : 400} fontSize="11">{monthShort[i]} 2024</text>
 </g>;
        })}
 </svg>
 {hover !== null && <div className="cci-chart-tip" role="status"><strong>{months[current]}</strong><span>{mainValue == null ? 'Brak kompletnych danych' : (view === 'index' ? 'Indeks: ' : 'Zmiana: ') + (view === 'index' ? fmt(mainValue) : signed(mainValue) + '%')}</span><small>{mainValue == null ? 'Wartość nie jest interpolowana.' : view === 'monthly' ? 'W porównaniu z poprzednim miesiącem.' : 'Od okresu bazowego: ' + months[d.base]}</small></div>}
 </div>
 <div className="cci-chart-bottom"><div className="cci-month-picks" role="group" aria-label="Miesiąc analizy">{indices.map(i => <CanonButton canonId="SRM-C09" usage="CCIChart:canonical-action-3" key={i} aria-pressed={selected === i} onClick={() => onSelect(i)}>{months[i]}{value(i) == null && i > d.base ? ' · brak danych' : ''}</CanonButton>)}</div><span><Icon name="info" size={13} />Wybierz miesiąc, aby zobaczyć jego wynik</span></div>
 {!compact && <p className="cci-chart-footnote">{scenario === 'partial' ? 'Czerwiec: brak obserwacji Labor. Luka pozostaje widoczna; zmiana m/m za lipiec nie jest dostępna.' : 'Historia obejmuje ' + indices.length + ' miesiące. Dane demonstracyjne, bez prognoz.'}</p>}
 </div>;
}
return {CCIChart};
}
