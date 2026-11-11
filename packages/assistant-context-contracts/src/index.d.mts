export const ASSISTANT_CONTEXT_CONTRACT:Readonly<{id:'profitia.assistant-context';version:'2.1.0'}>
export type ContextStatus='OK'|'EMPTY'|'PARTIAL'|'DENIED'|'UNAVAILABLE'|'STALE'
export const CONTEXT_STATUSES:readonly ContextStatus[]
export type ChartReference=Readonly<{version:'1.0.0'|'1.1.0';source:'BENCHMARK_CHART';seriesId:string;from:string;to:string;fingerprint:string;range?:'1M'|'3M'|'6M'|'1Y'|'3Y'|'5Y'|'ALL'}>
export type ForecastFrequency='DAILY'|'WEEKLY'|'MONTHLY'|'BIMONTHLY'|'QUARTERLY'|'QUADMONTHLY'|'SEMIANNUAL'|'ANNUAL'
export type ForecastReference=Readonly<{version:'2.0.0';source:'FORECAST_CORE';seriesId:string;modelIds:readonly ('naive'|'damped_holt'|'ets'|'arima')[];targetBasis:'POINT_IN_TIME'|'MONTHLY_AVERAGE'|'END_OF_PERIOD';sourceFrequency:ForecastFrequency|null;targetCadence:ForecastFrequency|null;verification:boolean}>
export type SupplierReference=Readonly<{version:'2.0.0';source:'SRM_XRAY';nip:string;entityType:'COMPANY'|'JDG';krs:string|null;year:number|null;comparisonYear:number|null;statementScope:'standalone'|'consolidated';sourceVersion:string|null}>
export type NewsfeedReference=Readonly<{version:'2.0.0';source:'NEWSFEED';observationId:string|null;supplierNip:string|null}>|Readonly<{version:'2.1.0';source:'NEWSFEED';observationId:string;supplierNip:null;runId:string|null;publicationId:string|null}>
export type PublishedReportReference=Readonly<{version:'2.1.0';source:'PUBLISHED_REPORT';producerJobId:string;pdfSha256:string;markdownSha256:string}>
export type ContextReference=ChartReference|ForecastReference|SupplierReference|NewsfeedReference|PublishedReportReference
export type ContextSelection=ContextReference|Readonly<{version:'2.0.0';source:'CONTEXT_SELECTION';references:readonly ContextReference[]}>
export function readContextReference(value:unknown):ContextReference
export function readContextSelection(value:unknown):ContextSelection|null
export function contextReferences(value:unknown):readonly ContextReference[]
export function contextDate(value:unknown):string
export function readChartReference(value:unknown):ChartReference
export function benchmarkSnapshotBytes(value:{seriesId:string;unit:string|null;currency:string|null;source:string|null;points:readonly {date:string;value:number|null}[]}):string
