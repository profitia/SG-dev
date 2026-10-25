'use client'
import React, {useCallback, useEffect, useRef, useState} from 'react'
import {CanonChartValueLabels, type ChartValueSnapshot} from './CanonChartValueLabels'
import {dateMs, sampleSegments, type buildMagicPathScene} from '../magicpath-chart-geometry'
import type {TimeSeriesViewerPayload} from '../../../lib/time-series-viewer/time-series-viewer-contract'
import type {ChartInterval} from './CanonChartTimeAxis'

/** C73/C80. Canonical screen-space cursor and labels, bound to real viewer data. */
export function CanonChartCrosshair({scene,payload,dates,interval,onPositionChange,resetKey}:{
  scene:ReturnType<typeof buildMagicPathScene>;payload:TimeSeriesViewerPayload;dates:string[];interval:ChartInterval;
  onPositionChange:(x:number|null)=>void;resetKey:string
}) {
  const root=useRef<HTMLDivElement>(null),frame=useRef<number|null>(null),pointer=useRef(.5)
  const [snapshot,setSnapshot]=useState<ChartValueSnapshot|null>(null),[pinned,setPinned]=useState(false),[details,setDetails]=useState(false)
  const visible=!!snapshot
  const paint=useCallback((fraction:number)=>{
    const box=root.current?.getBoundingClientRect();if(!box?.width||!box.height)return
    const target=scene.time(24+Math.max(0,Math.min(1,fraction))*764)
    const future=!!scene.anchor&&scene.hasFuture&&target>dateMs(scene.anchor.date)
    const central=scene.layers.find(layer=>layer.entry.kind===(future?'forecast-central':'historical'))
    if(!central){setSnapshot(null);onPositionChange(null);return}
    // Pick a real sample on the active series. Date/value always describe the
    // same observation; navigation never creates an interpolated market quote.
    const candidates=central.segments.flat().filter(point=>dateMs(point.date)>=scene.start&&dateMs(point.date)<=scene.end)
    let point=candidates[0]
    for(const candidate of candidates) if(!point||Math.abs(dateMs(candidate.date)-target)<Math.abs(dateMs(point.date)-target))point=candidate
    if(!point){setSnapshot(null);return}
    const t=dateMs(point.date),x=(scene.x(t)-24)/764
    const anchor=(kind:string)=>{const layer=scene.layers.find(layer=>layer.entry.kind===kind);const value=layer?sampleSegments(layer.segments,t):null;return value===null?null:{y:scene.y(value)/316,sourceY:value}}
    const outlines=scene.layers.flatMap(layer=>layer.segments.map(segment=>segment.map(p=>({x:(scene.x(dateMs(p.date))-24)/764*box.width,y:scene.y(p.value)/316*box.height}))))
    setSnapshot({x,width:box.width,height:box.height,rem:parseFloat(getComputedStyle(document.documentElement).fontSize)||16,index:Math.max(0,dates.indexOf(point.date)),future,outlines,
      central:{y:scene.y(point.value)/316,sourceY:point.value},upper:future?anchor('forecast-upper'):null,lower:future?anchor('forecast-lower'):null,backtest:!future?anchor('historical-forecast'):null})
    onPositionChange(x)
  },[scene,dates,onPositionChange])
  const hide=useCallback(()=>{if(!pinned){setSnapshot(null);onPositionChange(null)}},[pinned,onPositionChange])
  useEffect(()=>{setSnapshot(null);setPinned(false);setDetails(false);onPositionChange(null)},[resetKey,onPositionChange])
  useEffect(()=>()=>{if(frame.current!==null)cancelAnimationFrame(frame.current)},[])
  const move=(event:React.PointerEvent<HTMLDivElement>)=>{
    if(pinned)return
    const bounds=event.currentTarget.getBoundingClientRect();pointer.current=(event.clientX-bounds.left)/bounds.width
    if(frame.current===null)frame.current=requestAnimationFrame(()=>{frame.current=null;paint(pointer.current)})
  }
  const pl=payload.locale==='pl'
  const date=snapshot?dates[snapshot.index]:null
  const selected=payload.series.flatMap(series=>series.points.filter(point=>point.date===date).map(point=>({series,point})))
  return <>
    <div ref={root} data-library-component="SRM-C73" className="srm-chart-crosshair" tabIndex={0} role="group"
      aria-label={pl?'Wartości wykresu. Strzałki przesuwają kursor, Enter przypina wartości, Escape zamyka.':'Chart values. Arrow keys move the cursor, Enter pins values, Escape closes.'}
      data-visible={visible} data-forecast-points={!!snapshot?.upper&&!!snapshot?.lower} data-backtest-point={!!snapshot?.backtest}
      style={{'--crosshair-x':`${(snapshot?.x??.5)*100}%`,'--crosshair-y':`${(snapshot?.central.y??.5)*100}%`,'--crosshair-upper-y':`${(snapshot?.upper?.y??.5)*100}%`,'--crosshair-lower-y':`${(snapshot?.lower?.y??.5)*100}%`,'--crosshair-backtest-y':`${(snapshot?.backtest?.y??.5)*100}%`} as React.CSSProperties}
      onPointerMove={move} onPointerEnter={move} onPointerLeave={hide} onPointerCancel={hide} onBlur={hide}
      onClick={()=>{if(!snapshot)paint(pointer.current);setPinned(value=>!value);setDetails(false)}}
      onFocus={event=>{if(event.currentTarget.matches(':focus-visible'))paint(pointer.current)}}
      onKeyDown={event=>{
        if(event.key==='Escape'){setPinned(false);setDetails(false);setSnapshot(null);onPositionChange(null)}
        else if(event.key==='Enter'||event.key===' '){event.preventDefault();setPinned(value=>!value)}
        else if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
          event.preventDefault();const i=event.key==='Home'?0:event.key==='End'?dates.length-1:Math.max(0,Math.min(dates.length-1,(snapshot?.index??0)+(event.key==='ArrowLeft'?-1:1)))
          pointer.current=(scene.x(dateMs(dates[i]))-24)/764;paint(pointer.current)
        }
      }}>
      <div className="srm-chart-crosshair-guides"><i className="srm-chart-crosshair-vertical"/><i className="srm-chart-crosshair-horizontal"/></div>
      <span className="srm-chart-crosshair-point" data-chart-anchor="central"/>
      <span className="srm-chart-crosshair-point srm-chart-crosshair-boundary-point" data-chart-anchor="upper"/>
      <span className="srm-chart-crosshair-point srm-chart-crosshair-boundary-point" data-chart-anchor="lower"/>
      <span className="srm-chart-crosshair-point srm-chart-crosshair-backtest-point" data-chart-anchor="backtest"/>
      <CanonChartValueLabels snapshot={snapshot} context={{name:payload.title,unit:(payload.unit?.toLowerCase().includes(payload.currency?.toLowerCase()??'')?payload.unit:[payload.currency,payload.unit].filter(Boolean).join('/'))??'',dates,interval,backtest:!!snapshot?.backtest,locale:payload.locale}} visible={visible}/>
    </div>
    {pinned&&<div className="mp-pinned-actions"><button type="button" onClick={()=>setDetails(value=>!value)}>{pl?'Szczegóły odczytu':'Reading details'}</button><button type="button" onClick={()=>{setPinned(false);setDetails(false);setSnapshot(null);onPositionChange(null)}}>{pl?'Zamknij':'Close'}</button></div>}
    {pinned&&details&&<div className="mp-reading-details" role="region" aria-label={pl?'Szczegóły odczytu':'Reading details'}>{selected.map(({series,point})=><section key={series.id}><strong>{series.label}</strong><dl>{point.tooltipModel.rows.map((row,i)=><div key={i}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl></section>)}</div>}
  </>
}
