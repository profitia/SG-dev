import React, { useState } from 'react';
import { CanonButton } from './CanonElements';
import type {Component,Analysis,Offer,Scenario} from '../../data-contracts/pci2';
export function createPriceHistoryChart(data:typeof import('../../data-contracts/pci2')){
const {cci,indexedPrice,fmt,sign,dates,shortDates,compare,observation}=data;


function PriceHistoryChart({
  analysis: a,
  scenario,
  month,
  onMonth,
  offer,
  indexMode = false,
  component
}: {
  analysis: Analysis;
  scenario: Scenario;
  month: number;
  onMonth?: (m: number) => void;
  offer?: Offer;
  indexMode?: boolean;
  component?: Component;
}) {
  const [hover, setHover] = useState<number | null>(null),
    [asChange, setAsChange] = useState(false);
  const all = [0, 1, 2, 3, 4].filter(m => indexMode || m >= a.purchase.month);
  const amount = (m: number) => component ? observation(component, m, scenario) : indexMode ? cci(a, m, scenario) : indexedPrice(a, m, scenario);
  const base = indexMode ? 100 : Number(a.purchase.price);
  const value = (m: number) => {
    const n = amount(m);
    return n == null ? null : asChange ? (n / base - 1) * 100 : n;
  };
  const cmp = offer ? compare(a, offer, scenario) : null;
  const offerValue = cmp?.valid ? asChange ? (cmp.normalized! / base - 1) * 100 : cmp.normalized! : null;
  const reference = asChange ? 0 : base;
  const nums = all.map(value).filter((v): v is number => v != null).concat(offerValue == null ? [] : [offerValue]);
  const spread = Math.max(...nums, reference) - Math.min(...nums, reference);
  const pad = Math.max(spread * .2, Math.abs(reference) * .025, asChange ? 2 : 1);
  const low = Math.min(...nums, reference) - pad,
    high = Math.max(...nums, reference) + pad;
  const W = 760,
    H = 240,
    L = 0,
    R = 0,
    T = 15,
    B = 8;
  const pctX = (m: number) => (m - all[0]) / Math.max(1, all.at(-1)! - all[0]) * 100;
  const y = (v: number) => T + (high - v) / (high - low) * (H - T - B);
  const path = () => {
    let prior = false;
    return all.map(m => {
      const v = value(m);
      if (v == null) {
        prior = false;
        return '';
      }
      const p = (prior ? 'L' : 'M') + pctX(m) / 100 * W + ',' + y(v);
      prior = true;
      return p;
    }).join(' ');
  };
  const focus = hover ?? month,
    focusValue = amount(focus);
  return <div className="ca-chart">
 <div className="ca-chart-tools"><div className="srm-history-view-switch" role="group" aria-label="Widok historii">{!indexMode && <><CanonButton canonId="SRM-C28" usage="CA2:chart-price" aria-pressed={!asChange} onClick={() => setAsChange(false)}>Cena</CanonButton><CanonButton canonId="SRM-C28" usage="CA2:chart-change" aria-pressed={asChange} onClick={() => setAsChange(true)}>Zmiana od zakupu</CanonButton></>}{indexMode && <span>{component ? 'Indeks benchmarku' : 'Indeks modelu'} · baza kwiecień 2024 = 100</span>}</div><span>{dates[all[0]]} – sierpień 2024</span></div>
 <div className="ca-chart-readout" aria-live="polite"><div><span className="ca-legend-line" />{component ? component.name : indexMode ? 'CCI modelu' : 'Cena indeksowana'}<span className="ca-chart-readout-date">{dates[focus]}</span></div><strong>{focusValue == null ? 'Brak pełnych danych' : asChange ? sign((focusValue / base - 1) * 100) + '%' : fmt(focusValue)}{focusValue != null && !asChange && !indexMode && <small>{a.purchase.currency}/{a.purchase.unit}</small>}</strong></div>
 <div className="ca-chart-grid" onPointerLeave={() => setHover(null)}>
 <div className="ca-y-labels">{[0, 1, 2, 3, 4].map(i => <span key={i} style={{
          top: i * 25 + '%'
        }}>{fmt(high - (high - low) * i / 4, asChange ? 1 : 0)}{asChange ? '%' : ''}</span>)}</div>
 <div className="ca-chart-plot"><svg viewBox={'0 0 ' + W + ' ' + H} preserveAspectRatio="none" role="img" aria-label={all.map(m => dates[m] + ': ' + fmt(amount(m))).join('; ')}>
 {[0, 1, 2, 3, 4].map(i => <line key={i} x1={L} x2={W - R} y1={T + (H - T - B) * i / 4} y2={T + (H - T - B) * i / 4} stroke="var(--faint-line)" strokeWidth="1" />)}
 <line x1="0" x2={W} y1={y(reference)} y2={y(reference)} stroke="var(--reference)" strokeDasharray="5 5" strokeOpacity=".55" />
 <path d={path()} fill="none" stroke="var(--brand)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
 {all.map(m => {
            const v = value(m),
              x = pctX(m) / 100 * W;
            return <g key={m}><rect x={x - 45} y="0" width="90" height={H} fill="transparent" onPointerEnter={() => setHover(m)} onClick={() => onMonth?.(m)} style={{
                cursor: onMonth ? 'pointer' : 'default'
              }} />{v != null ? <><circle cx={x} cy={y(v)} r={m === focus ? 5 : 3.5} fill="var(--surface)" stroke="var(--brand)" strokeWidth="2" vectorEffect="non-scaling-stroke" />{m === focus && <line x1={x} x2={x} y1={T} y2={H - B} stroke="var(--reference)" strokeOpacity=".35" strokeDasharray="3 5" />}</> : <g><rect x={x - 7} y={y(reference) - 7} width="14" height="14" rx="2" fill="var(--caution-soft)" stroke="var(--caution)" /><path d={'M' + x + ',' + (y(reference) - 4) + 'v5m0 2v1'} stroke="var(--caution-text)" /></g>}</g>;
          })}
 {offerValue != null && offer && <><line x1={pctX(offer.month) / 100 * W} x2={pctX(offer.month) / 100 * W} y1={y(value(offer.month)!)} y2={y(offerValue)} stroke="var(--sand)" strokeWidth="2" strokeDasharray="4 3" /><path d={'M' + (pctX(offer.month) / 100 * W - 6) + ',' + (y(offerValue) - 6) + 'l12 12m-12 0 12-12'} stroke="var(--brand-dark)" strokeWidth="2" vectorEffect="non-scaling-stroke" /></>}
 </svg><div className="ca-x-labels">{all.map(m => onMonth ? <CanonButton canonId="SRM-C09" usage={'CA2:month-' + m} key={m} aria-pressed={month === m} onClick={() => onMonth(m)}>{shortDates[m]} 2024</CanonButton> : <span key={m} className={m === month ? 'active' : ''}>{shortDates[m]} 2024</span>)}</div></div>
 </div><div className="ca-chart-legend"><span><i className="ca-legend-line" />{component ? 'Benchmark' : indexMode ? 'CCI' : 'Cena według modelu'}</span>{offer && cmp?.valid && <span><b>×</b>Oferta dostawcy</span>}<span className="ca-baseline-legend"><i />{indexMode ? 'Baza modelu = 100' : 'Ostatnia cena zakupu: ' + fmt(Number(a.purchase.price)) + ' ' + a.purchase.currency + '/' + a.purchase.unit}</span></div>
 </div>;
}
return {PriceHistoryChart};
}
