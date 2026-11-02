import {z} from 'zod'
import {operationPayloadDigest} from '@profitia/platform-contracts/operation-context'
export const historyDigest=(value:unknown)=>operationPayloadDigest(JSON.parse(canonicalJson(value)))
import {normalizeBenchmarkObservationDate} from '@/lib/benchmark/observation-date'
import type {BenchmarkHistoricalSeriesResult} from '@/lib/benchmark/contracts'

export const MARKET_HISTORY_APPLICATION='spendguru-market-history'
export const HISTORY_MAX_POINTS=100_000
export const HISTORY_MAX_BYTES=8_388_608
export const HISTORY_PERSIST_SOURCE=Object.freeze({id:'sg2.market.history.persist',payloadSchema:'sg2-market-history-v1',qualityVersion:'validated-market-history-v1',classificationVersion:'shared-market-history-v1'})
export const seriesName=z.string().regex(/^[a-z][a-z0-9_]{0,127}$/)
export class MarketHistoryUnavailable extends Error {constructor(readonly reason:'INVALID_SOURCE'|'PERSISTENCE_UNAVAILABLE'|'CONFIGURATION_UNAVAILABLE'|'READBACK_MISMATCH'){super('Market history operation unavailable');this.name='MarketHistoryUnavailable'}}
export const invalid=():never=>{throw new MarketHistoryUnavailable('INVALID_SOURCE')}
export function canonicalJson(value:unknown):string {
 if(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value)
 if(Array.isArray(value))return '['+value.map(canonicalJson).join(',')+']'
 if(value&&Object.getPrototypeOf(value)===Object.prototype)return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalJson((value as Record<string,unknown>)[k])).join(',')+'}'
 return invalid()
}
export function observationDate(value:unknown):string {
 if(typeof value!=='string')return invalid()
 const date=normalizeBenchmarkObservationDate(value)
 if(value.slice(0,10)!==date.slice(0,10)||!/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString()!==date)return invalid()
 return date
}
export function observationValue(value:unknown):number|null {
 if(value===null)return null
 // The existing canonical store is numeric(24,8). Reject rather than round or truncate.
 if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>=1e16||Number(value.toFixed(8))!==value)return invalid()
 return value
}
export function validateProviderHistory(value:unknown,id:string,now=Date.now()) {
 seriesName.parse(id)
 if(!Array.isArray(value)||value.length!==1)return invalid()
 const row=value[0]
 if(!row||typeof row!=='object'||row.errorCode||!row.metadata||typeof row.metadata!=='object'
  ||row.metadata.Name!==id&&row.name!==id||!Array.isArray(row.dates)||!Array.isArray(row.values)
  ||row.dates.length!==row.values.length||!row.dates.length||row.dates.length>HISTORY_MAX_POINTS)return invalid()
 let previous='';let numeric=0
 for(let i=0;i<row.dates.length;i++){
  const day=observationDate(row.dates[i]),v=observationValue(row.values[i])
  if(day<=previous||Date.parse(day)>now)return invalid();previous=day;if(v!==null)numeric++
 }
 if(!numeric)return invalid()
 return row as {metadata:Record<string,unknown>;dates:string[];values:Array<number|null>}
}
const text=(m:Record<string,unknown>,...keys:string[])=>{for(const k of keys)if(typeof m[k]==='string'&&(m[k] as string).trim())return(m[k] as string).trim();return null}
export function canonicalHistory(id:string,history:BenchmarkHistoricalSeriesResult,metadata:Record<string,unknown>,rawCount:number):BenchmarkHistoricalSeriesResult {
 if(history.providerSeries.provider.providerCode!=='MACROBOND'||history.providerSeries.providerSeriesId!==id||history.historical.length!==rawCount)return invalid()
 let previous='';for(const p of history.historical){const d=observationDate(p.date);observationValue(p.value);if(d<=previous)return invalid();previous=d}
 const currency=text(metadata,'Currency')?.toUpperCase()??null
 const rawUnit=text(metadata,'Unit','DisplayUnit','TitleUnit')
 return {...history,displayName:text(metadata,'FullDescription','Title','Description','PrimName','Name')??id,
  frequency:text(metadata,'Frequency','SamplingPeriod'),currency,unit:rawUnit?.replace(/^Currency Unit(?=\/|\s|$)/i,currency??'Currency Unit')??null,source:text(metadata,'Source')}
}
const point=z.object({date:z.string(),value:z.number().finite().nullable()}).strict()
const provider=z.object({provider:z.object({providerCode:z.literal('MACROBOND'),displayName:z.literal('Macrobond')}).strict(),providerSeriesId:seriesName,providerSeriesKey:z.string().nullable().optional()}).strict()
export const historyCommandSchema=z.object({schemaVersion:z.literal('1.0.0'),runId:z.string().regex(/^[A-Za-z0-9_.:-]{1,128}$/),seriesId:seriesName,history:z.object({providerSeries:provider,displayName:z.string().min(1).max(2000),frequency:z.string().nullable(),currency:z.string().nullable(),unit:z.string().nullable(),source:z.string().nullable(),historical:z.array(point).min(1).max(HISTORY_MAX_POINTS)}).strict(),metadata:z.record(z.unknown()),historyFingerprint:z.string().regex(/^[a-f0-9]{64}$/),acquisition:z.object({callId:z.string().uuid(),responseSha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict()}).strict()
export type HistoryCommand=z.infer<typeof historyCommandSchema>
export function readHistoryCommand(value:unknown):HistoryCommand {
 const p=historyCommandSchema.parse(value)
 if(p.history.providerSeries.providerSeriesId!==p.seriesId||historyDigest(p.history)!==p.historyFingerprint)return invalid()
 if(historyDigest(canonicalHistory(p.seriesId,p.history,p.metadata,p.history.historical.length))!==historyDigest(p.history))return invalid()
 if(Buffer.byteLength(canonicalJson(p))>HISTORY_MAX_BYTES)return invalid()
 return p
}
