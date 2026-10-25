/** Presentation coordinates only. The viewer payload remains the authority for prices,
 * forecast bounds, temporal semantics and verification polygons. */
import type { TimeSeriesViewerPayload, TimeSeriesViewerPoint, TimeSeriesViewerSeries } from '../../lib/time-series-viewer/time-series-viewer-contract'
import { buildEndOfPeriodDeltaSurfaces, prepareVisibleSeriesGeometry, usesEndOfPeriodDeltaSurface } from '../../lib/chart/end-of-period-delta-geometry'

export const PLOT = { left: 24, right: 788, width: 812, height: 316, middle: 406 } as const
export type PricePoint = { date: string; value: number }
export type ChartWindow = [number, number]
export const dateMs = (date: string) => Date.parse(date)
export const finitePoint = (point: {date: string; value: number | null}): point is PricePoint & TimeSeriesViewerPoint => point.value !== null && Number.isFinite(point.value) && Number.isFinite(dateMs(point.date))

/** Nulls and explicit segment boundaries must never become forecast observations. */
export function priceSegments(series: TimeSeriesViewerSeries): PricePoint[][] {
  const result: PricePoint[][] = []
  for (const source of series.segments ?? [series.points]) {
    let segment: PricePoint[] = []
    for (const point of source) {
      if (finitePoint(point)) segment.push(point)
      else { if (segment.length) result.push(segment); segment = [] }
    }
    if (segment.length) result.push(segment)
  }
  return result
}

/** Linear interpolation is only the drawn segment between two supplied observations.
 * No extrapolation, gap filling or statistical calculation is performed here. */
export function sampleSegments(segments: PricePoint[][], timestamp: number): number | null {
  for (const segment of segments) {
    if (!segment.length || timestamp < dateMs(segment[0].date) || timestamp > dateMs(segment[segment.length - 1].date)) continue
    let low = 0, high = segment.length - 1
    while (low < high) { const mid = Math.floor((low + high) / 2); if (dateMs(segment[mid].date) < timestamp) low = mid + 1; else high = mid }
    const right = segment[low]
    if (dateMs(right.date) === timestamp) return right.value
    const left = segment[low - 1]
    if (!left) return null
    const span = dateMs(right.date) - dateMs(left.date)
    return span > 0 ? left.value + (right.value - left.value) * (timestamp - dateMs(left.date)) / span : right.value
  }
  return null
}

export function chartTimeline(payload: TimeSeriesViewerPayload) {
  return [...new Set(payload.series.flatMap(series => series.points.filter(finitePoint).map(point => point.date)))].sort((a,b)=>dateMs(a)-dateMs(b))
}

export function indexTime(dates: string[], index: number) {
  if (!dates.length) return 0
  const bounded = Math.max(0, Math.min(dates.length - 1, index))
  const left = Math.floor(bounded), right = Math.ceil(bounded)
  return dateMs(dates[left]) + (dateMs(dates[right]) - dateMs(dates[left])) * (bounded-left)
}

export function timeIndex(dates: string[], timestamp: number) {
  let low = 0, high = dates.length - 1
  while (low < high) { const mid = Math.floor((low+high)/2); if (dateMs(dates[mid]) < timestamp) low=mid+1; else high=mid }
  if (!low || dateMs(dates[low]) === timestamp) return low
  return low - 1 + (timestamp-dateMs(dates[low-1])) / (dateMs(dates[low])-dateMs(dates[low-1]))
}

export function makeTimeScale(start: number, end: number, anchor?: number, progress=1) {
  const joined = anchor !== undefined && start < anchor && anchor < end
  const join=PLOT.right-382*Math.max(0,Math.min(1,progress))
  const leftWidth=join-PLOT.left, rightWidth=PLOT.right-join
  const x = (timestamp: number) => joined
    ? timestamp <= anchor! ? PLOT.left + (timestamp-start)/(anchor!-start)*leftWidth : join + (timestamp-anchor!)/(end-anchor!)*rightWidth
    : PLOT.left + (timestamp-start)/Math.max(1,end-start)*764
  const time = (x: number) => joined
    ? x <= join ? start+(x-PLOT.left)/leftWidth*(anchor!-start) : anchor!+(x-join)/Math.max(.00001,rightWidth)*(end-anchor!)
    : start+(x-PLOT.left)/764*(end-start)
  return { x, time, joined }
}

export function pathFor(points: PricePoint[], x:(timestamp:number)=>number, y:(value:number)=>number) {
  return points.map((point,index)=>`${index?'L':'M'}${x(dateMs(point.date)).toFixed(3)} ${y(point.value).toFixed(3)}`).join(' ')
}

export function buildMagicPathScene(payload: TimeSeriesViewerPayload, dates: string[], window: ChartWindow, height=512, rem=16, hidden: string[] = [], showAccuracy=true, progress=1) {
  const history = payload.series.find(series=>series.kind==='historical')
  const observations = history?.points.filter(finitePoint) ?? []
  const anchor = observations[observations.length-1]
  const forecast = payload.series.find(series=>series.kind==='forecast-central')
  const start=indexTime(dates,window[0]), end=indexTime(dates,window[1])
  const hasFuture = !!anchor && !!forecast?.points.some(point=>finitePoint(point)&&dateMs(point.date)>dateMs(anchor.date))
  const scale=makeTimeScale(start,end,hasFuture ? dateMs(anchor!.date):undefined,progress)
  const series=payload.series.filter(entry=>!hidden.includes(entry.kind)).map(entry=>({entry,segments:priceSegments(entry)}))
  // Join only the first future segment to the last real observation. This is the
  // same visual connector as MagicPath, not a persisted or synthesized forecast.
  if (hasFuture && anchor) for (const layer of series) {
    if (!layer.entry.kind.startsWith('forecast-') || !layer.segments.length) continue
    const first=layer.segments[0][0]
    if (first && dateMs(first.date)>dateMs(anchor.date)) layer.segments=[[anchor,...layer.segments[0]],...layer.segments.slice(1)]
  }
  const values:number[]=[]
  for (const layer of series) {
    for(const segment of layer.segments) {
      for(const point of segment) if(dateMs(point.date)>=start&&dateMs(point.date)<=end) values.push(point.value)
      for(const boundary of [start,end]) {const value=sampleSegments([segment],boundary);if(value!==null)values.push(value)}
    }
  }
  const low=values.length?values.reduce((a,b)=>Math.min(a,b),Infinity):0, high=values.length?values.reduce((a,b)=>Math.max(a,b),-Infinity):1
  const span=high-low || Math.max(1,Math.abs(high)*.1)
  const top=5.5*rem*316/Math.max(height,160), bottom=(hasFuture?4.5:.5)*rem*316/Math.max(height,160)
  const y=(value:number)=>top+(high-value)/span*Math.max(24,316-top-bottom)
  const layers=series.map(layer=>({...layer,paths:layer.segments.map(segment=>pathFor(segment,scale.x,y))}))
  const polygon=(points:PricePoint[])=>pathFor(points,scale.x,y)+' Z'
  const actual=series.find(layer=>layer.entry.kind==='historical')
  const historicalForecast=series.find(layer=>layer.entry.kind==='historical-forecast')
  // Preserve the existing END_OF_PERIOD surface construction. The same visible
  // trajectories supply both the lines and the delta; no forecast is recalculated.
  const visualGeometry=(layer:typeof actual)=>prepareVisibleSeriesGeometry(layer?{...layer.entry,segments:layer.segments as TimeSeriesViewerPoint[][]}:null,date=>scale.x(dateMs(date)),value=>y(value??low))
  const overlays=showAccuracy&&actual&&historicalForecast
    ? usesEndOfPeriodDeltaSurface(payload.verificationTargetBasis)
      ? buildEndOfPeriodDeltaSurfaces(visualGeometry(actual),visualGeometry(historicalForecast))
      : payload.deltaOverlays.length
        ? payload.deltaOverlays.map(overlay=>({...overlay,path:polygon(overlay.points)}))
        : actual.entry.points.every(point=>point.detailModel.temporalResolution==='month')
          ? buildEndOfPeriodDeltaSurfaces(visualGeometry(actual),visualGeometry(historicalForecast)) : []
    : []
  // A single non-additive luminance mask follows the central line upward and
  // fades to zero below it at the lower bound. No blue background is stacked.
  const central=layers.find(layer=>layer.entry.kind==='forecast-central')
  const lower=layers.find(layer=>layer.entry.kind==='forecast-lower')
  const upper=layers.find(layer=>layer.entry.kind==='forecast-upper')
  const corridor: {area:string; bands:{path:string;gray:number}[]}[]=[]
  if(central&&lower&&upper) for(const segment of central.segments) {
    const run: {x:number; c:number;l:number}[]=[]
    const finish=()=>{if(run.length<2){run.length=0;return}
      const coordinates=(fraction:number,down:boolean)=>run.map(point=>`${point.x.toFixed(3)} ${(down?point.c+(point.l-point.c)*fraction:point.c*fraction).toFixed(3)}`)
      const area=`M${run[0].x} 0 L${run[run.length-1].x} 0 L${coordinates(1,true).reverse().join(' L')} Z`
      const bands=Array.from({length:64},(_,i)=>{const a=i/64,b=(i+1)/64;return [
        {path:`M${coordinates(a,false).join(' L')} L${coordinates(b,false).reverse().join(' L')} Z`,gray:Math.round(255*.24*b*b)},
        {path:`M${coordinates(a,true).join(' L')} L${coordinates(b,true).reverse().join(' L')} Z`,gray:Math.round(255*.24*(1-a)*(1-a))},
      ]}).flat();corridor.push({area,bands});run.length=0}
    for(const point of segment) {
      const t=dateMs(point.date),lo=sampleSegments(lower.segments,t),hi=sampleSegments(upper.segments,t)
      if(lo===null||hi===null){finish();continue}
      run.push({x:scale.x(t),c:y(point.value),l:y(lo)})
    }finish()
  }
  return {layers,overlays,corridor,anchor,hasFuture,start,end,x:scale.x,time:scale.time,y,joined:scale.joined}
}
