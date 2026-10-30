import React,{useCallback,useId,useLayoutEffect,useMemo,useRef,useState} from 'react'
import type {PciBusinessController,PciMarketIndexResult} from './business-contracts'
import {SmartReferenceDetails} from './SmartPreparationFields'
import {CanonChartCrosshair} from './revisions/pci3/canon-chart15/CanonChartCrosshair'
import {CanonChartTimeRange} from './revisions/pci3/canon-chart15/CanonChartTimeRange'
import {CanonChartTimeAxis} from './revisions/pci3/canon-chart15/CanonChartTimeAxis'
import {CanonChartTimePresets} from './revisions/pci3/canon-chart15/CanonChartTimePresets'
import {rangeForTimePreset,type ChartTimePreset} from './revisions/pci3/canon-chart15/chart-time-presets'
const fmt=(v:number|null,locale:'pl'|'en')=>v===null?'—':new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(v)
/** A dimensionless chart: no purchase-price projection, monetary axis or fictional money series. */
function MarketChart({result:r,locale}:{result:PciMarketIndexResult;locale:'pl'|'en'}){
 const timeline=useMemo(()=>r.nodes.map(n=>n.date.slice(0,10)),[r.nodes]),total=timeline.length,id=useId().replaceAll(':','')
 const [range,setRange]=useState<[number,number]>([0,total-1]),[preset,setPreset]=useState<ChartTimePreset|null>('All'),[focus,setFocus]=useState<number|null>(null),[width,setWidth]=useState(700)
 const surface=useRef<HTMLDivElement>(null),curve=useRef<SVGPathElement>(null)
 useLayoutEffect(()=>{const el=surface.current;if(!el)return;const observe=new ResizeObserver(()=>setWidth(Math.max(1,el.clientWidth)));observe.observe(el);return()=>observe.disconnect()},[])
 const W=width,H=260,L=Math.min(55,W*.2),R=W-18,T=24,B=236,values=r.nodes.flatMap(n=>n.cci===null?[]:[n.cci]),low=Math.floor(Math.min(100,...values)*.9),high=Math.ceil(Math.max(100,...values)*1.1)
 const x=(i:number)=>L+(i-range[0])/Math.max(1,range[1]-range[0])*(R-L),y=(v:number)=>B-(v-low)/Math.max(1,high-low)*(B-T)
 const indexAt=(xx:number)=>range[0]+(xx-L)/Math.max(1,R-L)*(range[1]-range[0])
 const pathFor=(overview=false)=>{let gap=true;return r.nodes.map((n,i)=>{if(n.cci===null){gap=true;return ''}const command=gap?'M':'L';gap=false;return command+(overview?24+i/Math.max(1,total-1)*764:x(i)).toFixed(2)+' '+(overview?304-(n.cci-low)/Math.max(1,high-low)*280:y(n.cci)).toFixed(2)}).join(' ')}
 const interval=r.cadence==='ANNUAL'?'yearly':r.cadence==='DAILY'||r.cadence==='WEEKLY'?'daily':'monthly'
 const context={name:locale==='pl'?'Indeks rynku':'Market index',unit:'CCI',dates:timeline,interval,backtest:false,fitLabelToPlot:R-L<280,indexFromSourceX:indexAt,
   valueFromSourceY:(yy:number)=>low+(B-yy)/(B-T)*(high-low),valueAtIndex:(i:number)=>r.nodes[i]?.cci??null,
   isSourceXAvailable:(xx:number)=>{const i=indexAt(xx);return r.nodes[Math.max(0,Math.floor(i))]?.cci!=null&&r.nodes[Math.min(total-1,Math.ceil(i))]?.cci!=null},
   accessibleLabel:locale==='pl'?'Kursor indeksu rynku. Strzałki przesuwają, Escape ukrywa.':'Market index cursor. Use arrows to move and Escape to dismiss.'} as const
 const position=useCallback((p:number|null)=>setFocus(p===null?null:Math.max(0,Math.min(total-1,Math.round(range[0]+p*(range[1]-range[0]))))),[range,total])
 const selected=r.nodes[focus??total-1]
 return <section className="v3-stacked-chart pci-market-chart" aria-label={locale==='pl'?'Historia indeksu rynku, baza 100':'Market index history, base 100'}>
  <p>{locale==='pl'?'Indeks rynku · baza 100; luki przerywają wykres.':'Market index · base 100; missing data break the chart.'}</p>
  <div className="v3-canon-chart-workspace srm-ui" style={{'--cci-plot-left':`${L/W*100}%`,'--cci-plot-right':`${(W-R)/W*100}%`,'--cci-plot-top':`${T/H*100}%`,'--cci-plot-bottom':`${(H-B)/H*100}%`} as React.CSSProperties}>
   <div className="v3-stacked-svg-wrap" id={id} ref={surface}><svg className="v3-stacked-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="CCI">
    <defs><clipPath id={id+'clip'}><rect x={L} y={T} width={Math.max(1,R-L)} height={B-T}/></clipPath></defs>
    {[0,1,2,3,4].map(i=>{const v=low+(high-low)*i/4;return <g key={i}><line x1={L} x2={R} y1={y(v)} y2={y(v)} stroke="var(--faint-line)"/><text x={L-5} y={y(v)+4} textAnchor="end" className="v3-stacked-tick">{fmt(v,locale)}</text></g>})}
    <path ref={curve} d={pathFor()} clipPath={`url(#${id}clip)`} fill="none" stroke="var(--brand)" strokeWidth={2.5}/>
   </svg><CanonChartCrosshair curveRef={curve} valueContext={context} resetKey={range.join(':')} onPositionChange={position}/></div>
   {total>1&&<><CanonChartTimeAxis timeline={timeline} interval={interval} range={range} activeIndex={focus} positionAt={i=>x(i)/W*812} onPositionChange={position}/><CanonChartTimeRange timeline={timeline} interval={interval} range={range} onChange={v=>{setRange(v);setPreset(null);setFocus(null)}} overviewPath={pathFor(true)}/><CanonChartTimePresets value={preset} controls={id} onChange={v=>{setRange(rangeForTimePreset(timeline,v));setPreset(v);setFocus(null)}}/></>}
  </div>
  {selected&&<p aria-live="polite">{selected.date.slice(0,10)} · {selected.cci===null?(locale==='pl'?'Brak danych':'No data'):`CCI ${fmt(selected.cci,locale)} · ${fmt(selected.changePercent,locale)}%`}</p>}
 </section>
}
export function MarketProxyResult({controller:c,locale='pl'}:{controller:PciBusinessController;locale?:'pl'|'en'}){
 const r=c.smart!.marketResult!,reference=c.smart!.reference,t=(a:string,b:string)=>locale==='pl'?a:b
 const last=r.nodes.slice().reverse().find(n=>n.date>r.baseDate&&n.cci!==null)
 return <section className="pci-market-result">
  <h2>{t('Wcześniejsze proxy — wyłącznie indeks rynku','Earlier proxy — market index only')}</h2>
  {reference&&<SmartReferenceDetails reference={reference} locale={locale}/>}
  <p>{t('Faktyczny zakup (wyłącznie kontekst)','Actual purchase (context only)')}: {r.purchaseDate} · {fmt(r.purchaseAmount,locale)} {r.purchaseCurrency}/{r.purchaseUnit}. {t('Ta cena nie jest kotwicą wcześniejszego indeksu.','This price does not anchor the earlier index.')}</p>
  <div className="v3-panel"><h3>{r.comparisonStatus==='NO_LATER_COMPARISON_POINT'?t('Brak późniejszego punktu porównania','No later comparison point'):t('Zmiana rynku od wcześniejszej bazy','Market change from the earlier base')}</h3>
   {last?<><div className="v3-price">{fmt(last.changePercent,locale)}%</div><p>{last.date.slice(0,10)} · CCI {fmt(last.cci,locale)}</p></>:<p>{t('Baza jest dostępna, ale nie ma późniejszego pełnego węzła. Nie przedstawiamy tego jako 0% zmiany.','The base is available but there is no later complete node. This is not reported as a 0% change.')}</p>}
   <MarketChart result={r} locale={locale}/>
  </div>
  <div className="v3-panel"><h3>{t('Wkład komponentów w zmianę rynku','Components’ contribution to market change')}</h3>{c.components.map(x=><div className="v3-component-line" key={x.id}><span>{x.name} · {x.weightPercent}%</span><b>{fmt(last?.components.find(p=>p.id===x.id)?.contributionPP??null,locale)} {t('p.p.','pp')}</b></div>)}</div>
  <details><summary>{t('Węzły i ograniczenia wyniku','Nodes and result limitations')}</summary><p>{t('Braki nie są zerami. Nie wykonano projekcji kwotowej ceny zakupu ani przeliczenia FX. Bieżąca historia nie potwierdza publikacji w dniu transakcji.','Missing data are not zero. No monetary purchase-price projection or FX conversion was performed. Current history does not prove publication on the transaction date.')}</p><p>{r.methodologyId}</p><ul>{r.nodes.map(n=><li key={n.date}>{n.date.slice(0,10)} · {n.cci===null?t('Brak danych','No data'):`CCI ${fmt(n.cci,locale)} · ${fmt(n.changePercent,locale)}%`}</li>)}</ul></details>
 </section>
}
