import React,{useCallback,useId,useLayoutEffect,useMemo,useRef,useState} from 'react'
import type {PciBusinessComponent,PciBusinessResult} from '../../business-contracts'
import {CanonChartCrosshair} from './canon-chart15/CanonChartCrosshair'
import {CanonChartTimeAxis} from './canon-chart15/CanonChartTimeAxis'
import {CanonChartTimeRange} from './canon-chart15/CanonChartTimeRange'
import {CanonChartTimePresets} from './canon-chart15/CanonChartTimePresets'
import {rangeForTimePreset,type ChartTimePreset} from './canon-chart15/chart-time-presets'
import {CanonTimeIntervalHighlight,type TimeIntervalFocus} from './canon-chart15/CanonTimeIntervalHighlight'

const colors=['#0066a4','#60a5fa','#35a89c','#c9a66b','#8272b8','#e29465']
const fmt=(n:number|null)=>n===null?'—':new Intl.NumberFormat('pl-PL',{maximumFractionDigits:2}).format(n)
/** Geometry adopted from the pinned stacked chart. All values come from the host's Indexed Price result. */
export function BusinessPriceChart({result,components,name}:{result:PciBusinessResult;components:readonly PciBusinessComponent[];name:string}) {
  const {nodes}=result, total=nodes.length, timeline=useMemo(()=>nodes.map(n=>n.date.slice(0,10)),[nodes])
  const [range,setRange]=useState<[number,number]>([0,total-1]),[preset,setPreset]=useState<ChartTimePreset|null>('All')
  const [focus,setFocus]=useState<number|null>(null),[view,setView]=useState<'stacked'|'relative'>('stacked')
  const [highlight,setHighlight]=useState(()=>components.map(c=>c.id)),[intervalFocus,setIntervalFocus]=useState<TimeIntervalFocus|null>(null)
  const surface=useRef<HTMLDivElement>(null),curve=useRef<SVGPathElement>(null),[width,setWidth]=useState(800),id=useId().replace(/:/g,'')
  useLayoutEffect(()=>{const el=surface.current;if(!el)return;const measure=()=>setWidth(Math.max(1,el.clientWidth));measure();
    const observer=new ResizeObserver(measure);observer.observe(el);return()=>observer.disconnect()},[])
  const W=width,H=308,left=Math.min(58,W*.2),right=W-16,top=24,bottom=280
  const x=(i:number)=>left+(i-range[0])/Math.max(1,range[1]-range[0])*(right-left)
  const anchor=nodes.findIndex(n=>n.date===result.baseDate)
  const selected=nodes[Math.max(0,Math.min(total-1,focus??total-1))]
  const maxPrice=Math.max(result.basePrice,...nodes.flatMap(n=>n.price===null?[]:[n.price]))
  const priceMax=Math.max(1,Math.ceil(maxPrice*1.15/100)*100)
  const changes=nodes.flatMap(n=>n.changePercent===null?[]:[n.changePercent,...n.components.flatMap(c=>c.changePercent===null?[]:[c.changePercent])])
  const floor=Math.floor((changes.reduce((m,v)=>Math.min(m,v),0)-8)/10)*10,ceil=Math.ceil((changes.reduce((m,v)=>Math.max(m,v),0)+8)/10)*10
  const y=(v:number)=>bottom-(view==='stacked'?v/priceMax:(v-floor)/Math.max(1,ceil-floor))*(bottom-top)
  const indexAt=(xx:number)=>range[0]+(xx-left)/Math.max(1,right-left)*(range[1]-range[0])
  const segments:number[][]=[];let pending:number[]=[]
  nodes.forEach((n,i)=>{if(n.price===null){if(pending.length)segments.push(pending);pending=[]}else pending.push(i)})
  if(pending.length)segments.push(pending)
  const line=(indices:number[],value:(i:number)=>number)=>indices.map((i,k)=>(k?'L':'M')+x(i).toFixed(2)+' '+y(value(i)).toFixed(2)).join(' ')
  const value=(i:number)=>view==='stacked'?nodes[i].price!:nodes[i].changePercent!
  const path=segments.map(s=>line(s,value)).join(' ')
  const overview=segments.map(s=>s.map((i,k)=>(k?'L':'M')+(24+i/Math.max(1,total-1)*764)+' '+(304-nodes[i].price!/priceMax*280)).join(' ')).join(' ')
  const area=(s:number[],layer:number)=>{
    if(s.length<2)return ''
    const cumulative=(i:number,end:number)=>nodes[i].components.slice(0,end).reduce((sum,c)=>sum+(c.price??0),0)
    return [...s.map(i=>[x(i),y(cumulative(i,layer+1))]),...s.slice().reverse().map(i=>[x(i),y(cumulative(i,layer))])]
      .map(([xx,yy],i)=>(i?'L':'M')+xx.toFixed(2)+' '+yy.toFixed(2)).join(' ')+' Z'
  }
  const interval=result.cadence==='ANNUAL'?'yearly':result.cadence==='DAILY'||result.cadence==='WEEKLY'?'daily':'monthly'
  const context=useMemo(()=>({name,unit:view==='stacked'?result.currency+'/'+result.unit:'%',dates:timeline,interval,backtest:false,
    fitLabelToPlot:right-left<280,indexFromSourceX:indexAt,
    valueFromSourceY:(yy:number)=>view==='stacked'?(bottom-yy)/(bottom-top)*priceMax:floor+(bottom-yy)/(bottom-top)*(ceil-floor),
    valueAtIndex:(i:number)=>view==='stacked'?nodes[i]?.price??null:nodes[i]?.changePercent??null,
    isSourceXAvailable:(xx:number)=>{const i=indexAt(xx);return nodes[Math.max(0,Math.floor(i))]?.price!=null&&nodes[Math.min(total-1,Math.ceil(i))]?.price!=null},
    accessibleLabel:'Kursor ceny kategorii. Strzałki przesuwają kursor, Escape ukrywa.'} as const),[name,result.currency,result.unit,timeline,interval,right,left,view,priceMax,floor,ceil,range,nodes])
  const changeRange=useCallback((r:[number,number])=>{setRange(r);setPreset(null);setFocus(null);setIntervalFocus(null)},[])
  const cursorPosition=useCallback((p:number|null)=>setFocus(p===null?null:Math.max(0,Math.min(total-1,Math.round(range[0]+p*(range[1]-range[0]))))),[range,total])
  return <section className="v3-stacked-chart" data-design-revision="465857540723474432" aria-label="Historia modelowanej ceny zakupu oraz składowych kategorii">
    <header className="v3-stacked-head"><div><strong>Modelowana historia ceny kategorii</strong><p>Przed i po ostatnim zakupie · {timeline[0]} – {timeline.at(-1)}</p></div>
      <div className="v3-stacked-switch" role="group" aria-label="Tryb prezentacji danych"><button className={view==='stacked'?'active':''} aria-pressed={view==='stacked'} onClick={()=>setView('stacked')}>Cena i komponenty · {result.currency}/{result.unit}</button>
      <button className={view==='relative'?'active':''} aria-pressed={view==='relative'} onClick={()=>setView('relative')}>Zmiany komponentów · %</button></div></header>
    <div className="v3-stacked-anchor">Twoja rzeczywista cena: <strong>{fmt(result.basePrice)} {result.currency}/{result.unit}</strong> · {result.baseDate.slice(0,10)}<small>Punkt zakotwiczenia modelu</small></div>
    <div className="v3-stacked-controls"><strong>Składowe kategorii</strong><div>{components.map((c,i)=><label key={c.id} className="v3-stacked-item"><input type="checkbox" checked={highlight.includes(c.id)} onChange={e=>setHighlight(v=>e.target.checked?[...v,c.id]:v.filter(id=>id!==c.id))}/><i style={{background:colors[i%colors.length]}}/>{c.name}<small>{c.weightPercent}%</small></label>)}</div></div>
    <div className="v3-canon-chart-workspace srm-ui" style={{'--cci-plot-left':`${left/W*100}%`,'--cci-plot-right':`${(W-right)/W*100}%`,'--cci-plot-top':`${top/H*100}%`,'--cci-plot-bottom':`${(H-bottom)/H*100}%`} as React.CSSProperties}><div className="v3-stacked-svg-wrap" id={id} ref={surface}><svg viewBox={`0 0 ${W} ${H}`} className="v3-stacked-svg" role="img" aria-label="Cena indeksowana i komponenty, na rzeczywistych wspólnych węzłach">
      <defs><clipPath id={id+'clip'}><rect x={left} y={top} width={Math.max(1,right-left)} height={bottom-top}/></clipPath></defs>
      {[0,1,2,3,4].map(i=>{const v=view==='stacked'?priceMax*i/4:floor+(ceil-floor)*i/4;return <g key={i}><line x1={left} x2={right} y1={y(v)} y2={y(v)} stroke="var(--faint-line)"/><text x={left-8} y={y(v)+4} textAnchor="end" className="v3-stacked-tick">{fmt(v)}</text></g>})}
      <g clipPath={`url(#${id}clip)`}>{view==='stacked'?components.map((c,i)=><g key={c.id} opacity={highlight.includes(c.id)?.9:.17}>{segments.map((s,k)=><path key={k} d={area(s,i)} fill={colors[i%colors.length]} stroke="var(--surface)" strokeWidth=".7"/>)}</g>):components.map((c,j)=>highlight.includes(c.id)&&segments.map((s,k)=><path key={c.id+k} d={line(s,i=>nodes[i].components[j]?.changePercent??0)} stroke={colors[j%colors.length]} strokeWidth="2.8" fill="none"/>))}
        <path d={path} stroke="var(--brand-dark)" strokeWidth="2" fill="none"/>
        {anchor>=range[0]&&anchor<=range[1]&&<><line x1={x(anchor)} x2={x(anchor)} y1={top} y2={bottom} stroke="var(--reference)" strokeWidth="1.8" strokeDasharray="6 5"/><circle cx={x(anchor)} cy={y(view==='stacked'?result.basePrice:0)} r="7" fill="var(--surface)" stroke="var(--brand)" strokeWidth="3"/><text x={x(anchor)+8} y={Math.max(top+12,y(view==='stacked'?result.basePrice:0)-12)} className="v3-stacked-anchor-svg">{fmt(result.basePrice)} · zakup</text></>}
        <path ref={curve} d={path} stroke="transparent" fill="none" pointerEvents="none"/>
        <g transform={`scale(${W/812} ${H/316})`}><CanonTimeIntervalHighlight count={intervalFocus?2:0} focus={intervalFocus?{lower:0,upper:1,marker:intervalFocus.marker}:null} positionAt={i=>x((intervalFocus?.lower??0)+i)/W*812}/></g>
      </g></svg>
      <CanonChartCrosshair curveRef={curve} valueContext={context} resetKey={`${view}:${range.join(':')}`} onPositionChange={cursorPosition}/></div>
      {total>1&&<><CanonChartTimeAxis interval={interval} timeline={timeline} range={range} activeIndex={focus} intervalFocus={intervalFocus} positionAt={i=>x(i)/W*812} onPositionChange={(p,index)=>{if(p===null){setIntervalFocus(null);return}const i=index??range[0]+p*(range[1]-range[0]);const lower=Math.min(total-2,Math.max(0,Math.floor(i)));setIntervalFocus({lower,upper:lower+1,marker:index??null});setFocus(Math.round(i))}}/>
        <CanonChartTimeRange interval={interval} timeline={timeline} range={range} onChange={changeRange} overviewPath={overview}/>
        <CanonChartTimePresets value={preset} controls={id} onChange={p=>{setRange(rangeForTimePreset(timeline,p));setPreset(p);setFocus(null)}}/></>}
    </div>
    {selected&&<div className="v3-stacked-readout" aria-live="polite"><div className="v3-stacked-readout-summary"><b>{selected.date.slice(0,10)}</b><strong>{selected.price===null?'Brak kompletnej ceny':fmt(selected.price)+' '+result.currency+'/'+result.unit}</strong><span>{fmt(selected.changePercent)}% względem ostatniego zakupu</span></div>
      <div className="v3-stacked-breakdown">{components.map((c,i)=><div key={c.id}><i style={{background:colors[i%colors.length]}}/><span>{c.name}</span><b>{fmt(selected.components[i]?.price??null)} {result.currency}/{result.unit}</b><small>{fmt(selected.components[i]?.changePercent??null)}%</small></div>)}</div></div>}
    <footer className="v3-stacked-footer"><span>Gruba górna linia = suma wszystkich komponentów.</span><span>Braki danych przerywają historię — bez interpolacji.</span><span>Modelowana cena zakupu, nie niezależnie zweryfikowany koszt zasadny.</span></footer>
  </section>
}
