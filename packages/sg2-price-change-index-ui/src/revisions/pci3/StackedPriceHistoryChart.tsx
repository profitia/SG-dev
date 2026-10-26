import React, { useState } from 'react';
import type {Analysis,Component,Offer,Scenario} from '../../data-contracts/pci3';
export function createStackedPriceHistoryChart(data:typeof import('../../data-contracts/pci3')){
const {cci,indexedPrice,compare,observation,fmt,sign,dates,shortDates,DEMO_ANCHOR_MONTH}=data;



type ChartProps = {
  analysis: Analysis;
  scenario: Scenario;
  month: number;
  onMonth?: (index: number) => void;
  offer?: Offer;
};
type NodeData = {
  index: number;
  parts: number[] | null;
  total: number | null;
  relative: number[] | null;
};
function StackedPriceHistoryChart({
  analysis: a,
  scenario,
  month,
  onMonth,
  offer
}: ChartProps) {
  const [view, setView] = useState<'stacked' | 'relative'>('stacked');
  const [focus, setFocus] = useState<number | null>(null);
  const [highlight, setHighlight] = useState<string[]>(a.components.map(c => c.id));
  const price = Number(a.purchase.price),
    unit = a.purchase.currency + '/' + a.purchase.unit;
  const anchor = a.purchase.month;
  const data: NodeData[] = dates.map((_, index) => {
    const parts = a.components.map(c => {
      const b = observation(c, anchor, scenario),
        v = observation(c, index, scenario);
      return b === null || v === null || b <= 0 || v <= 0 || !(price > 0) ? null : price * (c.weight / 100) * (v / b);
    });
    const complete = parts.every(v => v !== null);
    const full = complete ? parts as number[] : null;
    const relative = a.components.map(c => {
      const b = observation(c, anchor, scenario),
        v = observation(c, index, scenario);
      return b === null || v === null || b <= 0 ? null : (v / b - 1) * 100;
    });
    return {
      index,
      parts: full,
      total: full ? full.reduce((s, v) => s + v, 0) : null,
      relative: relative.every(v => v !== null) ? relative as number[] : null
    };
  });
  // Buyer price must equal all stacked components at anchor, even if their
  // unweighted source levels have different initial magnitudes.
  const actualAnchor = data[anchor]?.total;
  const quote = offer ? compare(a, offer, scenario) : null;
  const offered = quote?.valid ? quote.normalized : null;
  const current = focus ?? month;
  const chosen = data[current] ?? data[anchor];
  const maxTotal = Math.max(price, ...data.flatMap(v => v.total === null ? [] : [v.total]), ...(offered === null || offered === undefined ? [] : [offered]));
  const xLeft = 58,
    xRight = 995,
    plotTop = 48,
    plotBottom = 345,
    W = 1030,
    H = 405;
  const x = (i: number) => xLeft + i / Math.max(1, dates.length - 1) * (xRight - xLeft);
  const priceMax = Math.ceil(maxTotal * 1.15 / 100) * 100;
  const py = (v: number) => plotBottom - v / priceMax * (plotBottom - plotTop);
  const allCompleteSegments: NodeData[][] = [];
  let pending: NodeData[] = [];
  for (const item of data) {
    if (item.parts === null) {
      if (pending.length) allCompleteSegments.push(pending);
      pending = [];
    } else pending.push(item);
  }
  if (pending.length) allCompleteSegments.push(pending);
  const areaPath = (nodes: NodeData[], layer: number) => {
    if (nodes.length < 2) return '';
    const upper = nodes.map(n => [x(n.index), py(n.parts!.slice(0, layer + 1).reduce((s, v) => s + v, 0))]);
    const lower = [...nodes].reverse().map(n => [x(n.index), py(n.parts!.slice(0, layer).reduce((s, v) => s + v, 0))]);
    return upper.concat(lower).map(([xx, yy], i) => (i ? 'L' : 'M') + xx.toFixed(2) + ' ' + yy.toFixed(2)).join(' ') + ' Z';
  };
  const boundaryPath = (nodes: NodeData[]) => nodes.map((n, i) => (i ? 'L' : 'M') + x(n.index).toFixed(2) + ' ' + py(n.total!).toFixed(2)).join(' ');
  const yPctValues = data.flatMap(n => n.total === null ? [] : [(n.total / price - 1) * 100, ...(n.relative ?? [])]);
  const pctFloor = Math.floor((Math.min(0, ...yPctValues) - 8) / 10) * 10,
    pctTop = Math.ceil((Math.max(0, ...yPctValues) + 8) / 10) * 10;
  const pctY = (p: number) => plotBottom - (p - pctFloor) / Math.max(1, pctTop - pctFloor) * (plotBottom - plotTop);
  const relativeLine = (series: ((n: NodeData) => number | null)) => {
    const paths: string[] = [];
    let path = '';
    for (const n of data) {
      const v = series(n);
      if (v === null) {
        if (path) paths.push(path);
        path = '';
      } else {
        path += (path ? ' L' : 'M') + x(n.index).toFixed(2) + ' ' + pctY(v).toFixed(2);
      }
    }
    if (path) paths.push(path);
    return paths;
  };
  const ticks = Array.from(new Set([0, anchor, dates.length - 1, ...dates.map((_, i) => i).filter(i => i % 6 === 0)])).sort((a, b) => a - b);
  const allVisible = highlight.length === a.components.length;
  return <section className="v3-stacked-chart" aria-label="Historia modelowanej ceny zakupu oraz składowych kategorii">
 <header className="v3-stacked-head">
  <div><strong>Modelowana historia ceny kategorii</strong><p>Przed i po ostatnim zakupie · {dates[0]} – {dates[dates.length - 1]}</p></div>
  <div className="v3-stacked-switch" role="group" aria-label="Tryb prezentacji danych">
   <button className={view === 'stacked' ? 'active' : ''} aria-pressed={view === 'stacked'} onClick={() => setView('stacked')}>Cena i komponenty · {unit}</button>
   <button className={view === 'relative' ? 'active' : ''} aria-pressed={view === 'relative'} onClick={() => setView('relative')}>Zmiany komponentów · %</button>
  </div>
 </header>
 <div className="v3-stacked-anchor"><span className="anchor-dot" />Twoja rzeczywista cena: <strong>{fmt(price)} {unit}</strong> · {dates[anchor]}<small>Punkt zakotwiczenia modelu</small></div>
 <div className="v3-stacked-controls"><strong>Składowe kategorii</strong><div>
  {a.components.map(c => <label key={c.id} className="v3-stacked-item"><input type="checkbox" checked={highlight.includes(c.id)} onChange={e => setHighlight(ids => e.target.checked ? [...ids, c.id] : ids.filter(id => id !== c.id))} />
   <i style={{
            background: `var(--cci-series-${c.id}, ${c.color})`
          }} />{c.name} <small>{c.weight}%</small></label>)}
 </div><small>{view === 'stacked' ? 'Włączaj i wyłączaj wyróżnienie warstw. Wszystkie składniki nadal sumują się do ceny kategorii.' : 'Porównuj ruchy procentowe niezależnie od walut i jednostek źródłowych.'}</small></div>
 <div className="v3-stacked-svg-wrap">
 <svg viewBox={`0 0 ${W} ${H}`} className="v3-stacked-svg" role="img" aria-label={view === 'stacked' ? 'Warstwowy wykres modelowanej ceny kategorii. Górna granica to suma komponentów.' : 'Zmiany procentowe komponentów i całej kategorii.'}>
 {Array.from({
          length: 5
        }, (_, i) => {
          const tick = view === 'stacked' ? priceMax * i / 4 : pctFloor + (pctTop - pctFloor) * i / 4;
          const yy = view === 'stacked' ? py(tick) : pctY(tick);
          return <g key={i}><line x1={xLeft} x2={xRight} y1={yy} y2={yy} stroke="var(--faint-line)" strokeWidth="1" /><text x={xLeft - 10} y={yy + 4} textAnchor="end" className="v3-stacked-tick">{fmt(tick, 0)}{view === 'relative' ? '%' : ''}</text></g>;
        })}
 {ticks.map(i => <g key={i}><line x1={x(i)} x2={x(i)} y1={plotBottom} y2={plotBottom + 5} stroke="var(--line)" /><text x={x(i)} y={plotBottom + (i === anchor || i === dates.length - 1 ? 44 : 22)} textAnchor={i === 0 ? 'start' : i === dates.length - 1 ? 'end' : 'middle'} className="v3-stacked-tick">{shortDates[i]} {new Date(Date.UTC(2023, i, 1)).getUTCFullYear()}</text></g>)}
 {view === 'stacked' && <>
  {a.components.map((c, layer) => <g key={c.id} opacity={highlight.includes(c.id) ? 0.9 : 0.17}>
    {allCompleteSegments.map((s, idx) => <path key={idx} d={areaPath(s, layer)} fill={`var(--cci-series-${c.id}, ${c.color})`} stroke="var(--surface,#ffffff)" strokeWidth="0.7" strokeLinejoin="round" />)}
  </g>)}
  {allCompleteSegments.map((s, i) => <path key={i} d={boundaryPath(s)} fill="none" stroke="var(--brand-dark)" strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
 </>}
 {view === 'relative' && <>
  {a.components.map((c, i) => highlight.includes(c.id) && relativeLine(n => n.relative?.[i] ?? null).map((d, k) => <path key={c.id + '-' + k} d={d} stroke={`var(--cci-series-${c.id}, ${c.color})`} strokeWidth="2.8" fill="none" vectorEffect="non-scaling-stroke" />))}
  {relativeLine(n => n.total === null ? null : (n.total / price - 1) * 100).map((d, k) => <path key={k} d={d} fill="none" stroke="var(--brand-dark)" strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
 </>}
 <line x1={x(anchor)} x2={x(anchor)} y1={plotTop} y2={plotBottom} stroke="var(--reference)" strokeWidth="1.8" strokeDasharray="6 5" />
 {actualAnchor !== null && <><circle cx={x(anchor)} cy={view === 'stacked' ? py(actualAnchor) : pctY(0)} r="7" fill="var(--surface,#fff)" stroke="var(--brand)" strokeWidth="3" /><text x={x(anchor) + 8} y={view === 'stacked' ? Math.max(plotTop + 12, py(actualAnchor) - 12) : pctY(0) - 12} className="v3-stacked-anchor-svg">{fmt(price, 0)} · zakup</text></>}
 {view === 'stacked' && offer && offered !== null && offered !== undefined && quote?.valid && <><line x1={x(offer.month)} x2={x(offer.month)} y1={py(offered)} y2={py(quote.ref!)} stroke="var(--negative-text)" strokeWidth="2.2" strokeDasharray="4 3" /><circle cx={x(offer.month)} cy={py(offered)} r="7" fill="var(--surface,#fff)" stroke="var(--negative-text)" strokeWidth="3" /><text x={x(offer.month) + 8} y={Math.max(plotTop + 12, py(offered) - 12)} className="v3-stacked-offer-svg">Oferta {fmt(offered, 0)}</text></>}
 {data.map(n => <rect key={n.index} x={x(n.index) - (xRight - xLeft) / dates.length / 2} y={plotTop} width={(xRight - xLeft) / dates.length} height={plotBottom - plotTop} fill="transparent" role="button" tabIndex={0} aria-label={dates[n.index] + ': ' + (n.total === null ? 'brak pełnych danych' : fmt(n.total) + ' ' + unit)} onMouseEnter={() => setFocus(n.index)} onFocus={() => setFocus(n.index)} onClick={() => onMonth?.(n.index)} onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onMonth?.(n.index);
            setFocus(n.index);
          }
        }} />)}
 </svg></div>
 <div className="v3-stacked-readout" aria-live="polite"><div className="v3-stacked-readout-summary"><b>{dates[chosen.index]}</b><strong>{chosen.total === null ? 'Brak kompletnej ceny' : fmt(chosen.total) + ' ' + unit}</strong>
 <span>{chosen.total === null ? 'Luka w danych — brak wyliczenia' : (chosen.total >= price ? '+' : '') + fmt((chosen.total / price - 1) * 100) + '% względem ostatniego zakupu'}</span></div>
 <div className="v3-stacked-breakdown">{a.components.map((c, i) => <div key={c.id}><i style={{
            background: `var(--cci-series-${c.id}, ${c.color})`
          }} /><span>{c.name}</span><b>{chosen.parts === null ? '—' : fmt(chosen.parts[i]) + ' ' + unit}</b><small>{chosen.relative === null ? '—' : sign(chosen.relative[i]) + '%'}</small></div>)}</div>
 </div>
 <footer className="v3-stacked-footer"><span>Gruba górna linia = suma wszystkich komponentów.</span><span>Braki danych przerywają historię — bez interpolacji.</span><span>Wartości demonstracyjne, nie rzeczywiste notowania Macrobond.</span></footer>
 </section>;
}
return {StackedPriceHistoryChart};
}
