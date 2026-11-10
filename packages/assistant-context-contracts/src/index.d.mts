export const ASSISTANT_CONTEXT_CONTRACT:Readonly<{id:'profitia.assistant-context';version:'1.1.0'}>
export type ContextStatus='OK'|'EMPTY'|'PARTIAL'|'DENIED'|'UNAVAILABLE'|'STALE'
export const CONTEXT_STATUSES:readonly ContextStatus[]
export type ChartReference=Readonly<{version:'1.0.0'|'1.1.0';source:'BENCHMARK_CHART';seriesId:string;from:string;to:string;fingerprint:string;range?:'1M'|'3M'|'6M'|'1Y'|'3Y'|'5Y'|'ALL'}>
export function contextDate(value:unknown):string
export function readChartReference(value:unknown):ChartReference
export function benchmarkSnapshotBytes(value:{seriesId:string;unit:string|null;currency:string|null;source:string|null;points:readonly {date:string;value:number|null}[]}):string
