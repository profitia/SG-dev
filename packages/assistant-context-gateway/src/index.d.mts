import type {ContextReference,ContextSelection,ChartReference,ForecastReference,SupplierReference,NewsfeedReference,ContextStatus} from '../../assistant-context-contracts/src/index.mjs'
export const ASSISTANT_GATEWAY_CONTRACT:Readonly<{id:'profitia.assistant-context-gateway';version:'2.0.0'}>
export type ContextEntry=Readonly<{source:string;status:ContextStatus;id?:string;label?:string;sourceVersion?:string;observedAt?:string;asOf?:string|null;data?:unknown;selection?:unknown}>
type ReadInput={reference:ContextReference|null;request:unknown;organisationId:string;signal?:AbortSignal;observedAt:string}
export function createAssistantContextGateway(options:{adapters:readonly {source:string;read:(input:ReadInput)=>Promise<ContextEntry>}[];now?:()=>number}):{resolve(input:{plan:readonly {source:string;selection:'ACTIVE_VIEW'}[];reference:ContextSelection|null;request:unknown;organisationId:string;signal?:AbortSignal}):Promise<Readonly<{contract:{id:string;version:string};contexts:readonly ContextEntry[]}>>}
export function createBenchmarkContextAdapter(options:{readAuthorised:(input:{seriesId:string;range:'1M'|'3M'|'6M'|'1Y'|'3Y'|'5Y'|'ALL';organisationId:string;request:unknown;signal?:AbortSignal})=>Promise<unknown>}):{source:string;read:(input:ReadInput)=>Promise<ContextEntry>}
type AuthorisedInput<R>={selection:R;organisationId:string;request:unknown;signal?:AbortSignal}
export function createForecastContextAdapter(options:{readAuthorised:(input:AuthorisedInput<ForecastReference>)=>Promise<unknown>}):{source:string;read:(input:ReadInput)=>Promise<ContextEntry>}
export function createSupplierContextAdapter(options:{readAuthorised:(input:AuthorisedInput<SupplierReference>)=>Promise<unknown>}):{source:string;read:(input:ReadInput)=>Promise<ContextEntry>}
export function createNewsfeedContextAdapter(options:{readAuthorised:(input:AuthorisedInput<NewsfeedReference>)=>Promise<unknown>}):{source:string;read:(input:ReadInput)=>Promise<ContextEntry>}
