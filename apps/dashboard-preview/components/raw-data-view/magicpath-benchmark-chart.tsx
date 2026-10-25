'use client'
import React,{useCallback,useEffect,useId,useMemo,useRef,useState} from 'react'
import type {TimeSeriesViewerPayload,TimeSeriesViewerSeriesKind} from '../../lib/time-series-viewer/time-series-viewer-contract'
import {CanonChartToolsPanel} from './magicpath/CanonChartToolsPanel'
import {CanonChartTimePresets} from './magicpath/CanonChartTimePresets'
import {CanonChartTimeRange,type ChartTimeRange} from './magicpath/CanonChartTimeRange'
import {CanonChartTimeAxis,type ChartInterval} from './magicpath/CanonChartTimeAxis'
import {CanonChartCrosshair} from './magicpath/CanonChartCrosshair'
import {CanonTimeIntervalHighlight,type TimeIntervalFocus} from './magicpath/CanonTimeIntervalHighlight'
import {chartControlPanelVariables} from './magicpath/chart-control-panel-contract'
import {rangeForTimePreset,type ChartTimePreset} from './magicpath/chart-time-presets'
import {buildMagicPathScene,chartTimeline,dateMs,timeIndex,pathFor,finitePoint} from './magicpath-chart-geometry'



function useForecastProgress(enabled: boolean) {
  const [progress, setProgress] = useState(0);
  const current = useRef(0);
  useEffect(() => {
    const target = enabled ? 1 : 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const apply = (value: number) => {
      current.current = value;
      setProgress(value);
    };
    const finish = () => {
      cancelAnimationFrame(frame);
      apply(target);
    };
    if (reduced.matches) {
      finish();
      return;
    }
    const initial = current.current;
    const began = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / 520);
      const ease = 1 - Math.pow(1 - t, 3);
      apply(t === 1 ? target : initial + (target - initial) * ease);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    reduced.addEventListener('change', finish);
    return () => {
      cancelAnimationFrame(frame);
      reduced.removeEventListener('change', finish);
    };
  }, [enabled]);
  return progress;
}

type ServerPreset='3M'|'6M'|'1Y'|'3Y'|'5Y'|'ALL'
const tones:Record<TimeSeriesViewerSeriesKind,string>={historical:'srm-price-line-stroke','monthly-actual':'mp-monthly-actual','historical-forecast':'srm-backtest-line','forecast-central':'srm-forecast-central','forecast-upper':'srm-forecast-bound','forecast-lower':'srm-forecast-bound'}

/** Pinned MagicPath C71–C86 composition; state/commands and data stay in RawDataView. */
export function MagicPathBenchmarkChart({payload:inputPayload,isLoading,emptyMessage,loadingTitle,initialPreset='ALL',onPresetChange,showForecastAccuracy}:{
  payload:TimeSeriesViewerPayload|null;isLoading:boolean;emptyMessage:string;loadingTitle:string;initialPreset?:ServerPreset;onPresetChange?:(preset:ServerPreset)=>void;showForecastAccuracy:boolean
}){
  const id=useId().replace(/:/g,''),plot=useRef<HTMLDivElement>(null)
  const forecastEnabled=!!inputPayload?.series.some(series=>series.kind==='forecast-central'&&series.points.some(finitePoint))
  const progress=useForecastProgress(forecastEnabled)
  const retained=useRef<TimeSeriesViewerPayload|null>(null)
  useEffect(()=>{if(forecastEnabled)retained.current=inputPayload},[inputPayload,forecastEnabled])
  const sameBenchmark=retained.current?.benchmarkCode===inputPayload?.benchmarkCode&&retained.current?.title===inputPayload?.title
  const payload=inputPayload&&!forecastEnabled&&progress>0&&sameBenchmark?retained.current:inputPayload
  const transitioning=progress!==(forecastEnabled?1:0)
  const [toolsOpen,setToolsOpen]=useState(false),[height,setHeight]=useState(512),[hidden,setHidden]=useState<TimeSeriesViewerSeriesKind[]>([])
  const [selection,setSelection]=useState<ChartTimeRange|null>(null),[preset,setPreset]=useState<ChartTimePreset|null>(initialPreset==='ALL'?'All':initialPreset)
  const [focus,setFocus]=useState<TimeIntervalFocus|null>(null)
  const dates=useMemo(()=>payload?chartTimeline(payload):[],[payload])
  const historyDates=useMemo(()=>payload?.series.find(series=>series.kind==='historical')?.points.filter(finitePoint).map(point=>point.date)??[],[payload])
  const range:ChartTimeRange=selection??[0,Math.max(0,dates.length-1)]
  const visiblePayload=useMemo(()=>payload?{...payload,series:payload.series.filter(series=>!hidden.includes(series.kind)),deltaOverlays:showForecastAccuracy&&!hidden.includes('historical-forecast')?payload.deltaOverlays:[]}:null,[payload,hidden,showForecastAccuracy])
  const scene=useMemo(()=>visiblePayload&&dates.length?buildMagicPathScene(payload!,dates,range,height,16,hidden,showForecastAccuracy,progress):null,[payload,dates,range[0],range[1],height,hidden,showForecastAccuracy,progress])
  const interval:ChartInterval=payload?.series.find(series=>series.kind==='historical')?.points.some(point=>point.detailModel.temporalResolution==='day')?'daily':'monthly'
  const anchorIndex=scene?.hasFuture&&scene.anchor?dates.indexOf(scene.anchor.date):undefined
  useEffect(()=>{setSelection(null);setHidden([]);setPreset(initialPreset==='ALL'?'All':initialPreset)},[payload?.benchmarkCode,payload?.title,initialPreset])
  useEffect(()=>{setSelection(null)},[dates[0],dates[dates.length-1]])
  useEffect(()=>{const el=plot.current;if(!el)return;const observer=new ResizeObserver(()=>setHeight(el.getBoundingClientRect().height||512));observer.observe(el);return()=>observer.disconnect()},[!!scene])
  const ticks=useMemo(()=>{
    if(!scene)return[]
    const available=dates.filter(date=>dateMs(date)>=scene.start&&dateMs(date)<=scene.end)
    const count=scene.hasFuture?11:6
    const chosen=Array.from({length:Math.min(count,available.length)},(_,i)=>{
      const target=scene.time(24+764*i/(Math.min(count,available.length)-1||1));return available.reduce((a,b)=>Math.abs(dateMs(a)-target)<Math.abs(dateMs(b)-target)?a:b)
    })
    if(scene.hasFuture&&scene.anchor)chosen.push(scene.anchor.date)
    return [...new Set(chosen)].sort((a,b)=>dateMs(a)-dateMs(b))
  },[scene,dates])
  const positionAt=useCallback((index:number)=>scene?.x(dateMs(ticks[index]))??24,[scene,ticks])
  const focusAt=useCallback((x:number|null,exact?:number)=>{
    if(x===null||ticks.length<2){setFocus(null);return}
    const px=24+x*764;let upper=1;while(upper<ticks.length-1&&positionAt(upper)<px)upper++
    const lower=upper-1,left=positionAt(lower),right=positionAt(upper),nearest=px-left<=right-px?lower:upper
    const marker=exact??(Math.abs(positionAt(nearest)-px)<=Math.min(10,(right-left)*.14)?nearest:null)
    setFocus(previous=>previous?.lower===lower&&previous.upper===upper&&previous.marker===marker?previous:{lower,upper,marker})
  },[ticks,positionAt])
  const selectPreset=(value:ChartTimePreset)=>{
    setPreset(value);setFocus(null)
    if(value!=='1M'){onPresetChange?.(value==='All'?'ALL':value);setSelection(null);return}
    const historyRange=rangeForTimePreset(historyDates,value)
    const first=historyDates[historyRange[0]],last=historyDates[historyRange[1]]
    if(first&&last)setSelection([Math.max(0,timeIndex(dates,dateMs(first))),scene?.hasFuture?dates.length-1:timeIndex(dates,dateMs(last))])
  }
  if(!scene||!payload||dates.length===0)return <div className="mp-chart-empty" role="status">{isLoading?loadingTitle:emptyMessage}</div>
  const overview=buildMagicPathScene(payload,dates,[0,dates.length-1])
  const overviewX=(timestamp:number)=>24+timeIndex(dates,timestamp)/Math.max(1,dates.length-1)*764
  const overviewPath=overview.layers.filter(layer=>layer.entry.kind==='historical'||layer.entry.kind==='forecast-central').flatMap(layer=>layer.segments.map(segment=>pathFor(segment,overviewX,overview.y))).join(' ')
  const backtest=scene.layers.some(layer=>layer.entry.kind==='historical-forecast')
  const pl=payload.locale==='pl'
  return <section className="srm-price-line-surface mp-live-chart chart-panel-embedded" data-library-component="SRM-C71" data-chart-interval={interval} data-forecast={scene.hasFuture} data-backtest={backtest} aria-busy={isLoading} style={{...chartControlPanelVariables,'--chart-controls-plot-min-height':'32rem'} as React.CSSProperties}>
    <div className="srm-chart-workspace" data-tools-open={toolsOpen}>
      <CanonChartToolsPanel onOpenChange={setToolsOpen}/>
      <div className="srm-price-line-scroll" role="region" aria-label={pl?'Historia i prognoza benchmarku':'Benchmark history and forecast'} tabIndex={0}>
        <div className="srm-price-line-canvas">
          <div ref={plot} className="srm-price-line-plot" id={id+'-plot'}>
            <svg className="srm-price-line" viewBox="0 0 812 316" preserveAspectRatio="none" role="img" aria-label={payload.title}>
              <defs><clipPath id={id+'-clip'}><rect x="24" y="0" width="764" height="316"/></clipPath><linearGradient id={id+'-history'} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--brand)" stopOpacity=".18"/><stop offset="55%" stopColor="var(--brand)" stopOpacity=".08"/><stop offset="100%" stopColor="var(--brand)" stopOpacity="0"/></linearGradient></defs>
              <g clipPath={`url(#${id}-clip)`}>
                <CanonTimeIntervalHighlight count={ticks.length} positionAt={positionAt} focus={focus}/>
                {scene.layers.filter(layer=>layer.entry.kind==='historical').flatMap(layer=>layer.segments.map((segment,index)=><path key={index} d={pathFor(segment,scene.x,scene.y)+` L${scene.x(dateMs(segment[segment.length-1].date))} 316 L${scene.x(dateMs(segment[0].date))} 316 Z`} fill={`url(#${id}-history)`}/>))}
                {scene.overlays.map(overlay=><path key={overlay.key} d={overlay.path} data-verification-sign={overlay.sign} fill="var(--sand)" fillOpacity=".22"/>)}
                {scene.corridor.map((corridor,index)=><g key={index} opacity={progress}><defs><mask id={`${id}-shade-${index}`} maskUnits="userSpaceOnUse" x="24" y="0" width="764" height="316" style={{maskType:'luminance'}} colorInterpolation="sRGB">{corridor.bands.map((band,i)=><path key={i} d={band.path} fill={`rgb(${band.gray},${band.gray},${band.gray})`}/>)}</mask></defs><path data-forecast-shading="unified-central-to-top" d={corridor.area} fill="var(--brand)" mask={`url(#${id}-shade-${index})`}/></g>)}
                {scene.layers.map(layer=><g key={layer.entry.id} data-series-kind={layer.entry.kind} opacity={layer.entry.kind.startsWith('forecast-')?progress:1}>{layer.paths.map((path,index)=><path key={index} d={path} className={tones[layer.entry.kind]} data-forecast-line={layer.entry.kind==='forecast-upper'?'upper':layer.entry.kind==='forecast-lower'?'lower':undefined} fill="none" stroke="var(--brand)" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>)}</g>)}
              </g>
            </svg>
            {scene.hasFuture&&scene.anchor&&<div className="srm-forecast-annotations" style={{opacity:progress}} aria-hidden="true"><span className="srm-forecast-text srm-forecast-last-date" style={{left:`${scene.x(dateMs(scene.anchor.date))/812*100}%`}}>{pl?'Ostatnie dane':'Latest observation'}</span><span className="srm-forecast-anchor" data-chart-landmark="last-observation" style={{left:`${scene.x(dateMs(scene.anchor.date))/812*100}%`,top:`${scene.y(scene.anchor.value)/316*100}%`}}/></div>}
            {scene.hasFuture&&<div className="srm-forecast-annotations" style={{opacity:progress}} aria-hidden="true">{(['upper','central','lower'] as const).map(kind=>{const layer=scene.layers.find(layer=>layer.entry.kind===`forecast-${kind}`);const point=layer?.segments.flat().filter(point=>dateMs(point.date)<=scene.end).at(-1);return point&&<span key={kind} className={`srm-forecast-text srm-forecast-end-label is-${kind}`} style={{left:`${scene.x(dateMs(point.date))/812*100}%`,top:`${scene.y(point.value)/316*100}%`}}>{pl?({upper:'Górna',central:'Centralna',lower:'Dolna'})[kind]:({upper:'Upper',central:'Central',lower:'Lower'})[kind]}</span>})}</div>}
            {scene.layers.filter(layer=>layer.entry.kind==='historical-forecast'||layer.entry.kind==='monthly-actual'||layer.entry.points.filter(finitePoint).length===1).map(layer=><div key={layer.entry.id} className="srm-chart-observations" aria-hidden="true">{layer.entry.points.filter(finitePoint).filter(point=>dateMs(point.date)>=scene.start&&dateMs(point.date)<=scene.end).map(point=><span key={point.key} className="srm-backtest-point" data-chart-landmark={layer.entry.kind} style={{left:`${scene.x(dateMs(point.date))/812*100}%`,top:`${scene.y(point.value)/316*100}%`}}/>)}</div>)}
            {!transitioning&&<CanonChartCrosshair scene={scene} payload={visiblePayload!} dates={dates} interval={interval} onPositionChange={focusAt} resetKey={`${range.join(':')}:${height}:${toolsOpen}:${payload.series.map(series=>series.id).join(':')}`}/>}
          </div>
          <CanonChartTimeAxis interval={interval} timeline={ticks} positionAt={positionAt} activeIndex={focus?.marker??null} intervalFocus={focus} onPositionChange={focusAt} boundaryIndex={scene.hasFuture&&scene.anchor?ticks.indexOf(scene.anchor.date):undefined}/>
          <div className="srm-forecast-legend" aria-label={pl?'Legenda wykresu':'Chart legend'}>{payload.series.map(series=><button key={series.id} type="button" aria-pressed={!hidden.includes(series.kind)} onClick={()=>setHidden(previous=>previous.includes(series.kind)?previous.filter(kind=>kind!==series.kind):[...previous,series.kind])}><i className={series.kind==='historical'?'history':series.kind==='historical-forecast'?'backtest':series.kind==='forecast-central'?'central':series.kind==='forecast-upper'?'mp-upper':series.kind==='forecast-lower'?'mp-lower':'history'}/>{series.label}</button>)}</div>
          {backtest&&<p className="srm-backtest-note">{pl?'Beżowa linia powyżej kursu: prognoza zawyżona. Poniżej: zaniżona. Szerokość wstęgi pokazuje wielkość różnicy.':'Beige line above the price: overestimate. Below: underestimate. The ribbon width shows the size of the difference.'}</p>}
          {dates.length>1&&<CanonChartTimeRange interval={interval} range={range} onChange={next=>{setSelection(next);setPreset(null);setFocus(null)}} timeline={dates} overviewPath={overviewPath} overviewViewBox="24 0 764 316" overviewEndX={788} boundaryIndex={anchorIndex!==undefined&&anchorIndex>0&&anchorIndex<dates.length-1?anchorIndex:undefined}/>}
          {payload.forecastOrigin&&<p className="mp-chart-provenance">{payload.forecastOrigin.label}</p>}
          {payload.sourceInfo?.sourceLabel&&<p className="mp-chart-provenance">{payload.sourceInfo.sourceLabel}</p>}
        </div>
      </div>
      <CanonChartTimePresets value={preset} onChange={selectPreset} controls={id+'-plot'}/>
    </div>
  </section>
}
