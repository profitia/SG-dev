import type {ChartReference,ContextStatus} from '../../assistant-context-contracts/src/index.mjs'
export const ASSISTANT_GATEWAY_CONTRACT:Readonly<{id:'profitia.assistant-context-gateway';version:'1.0.0'}>
export type ContextEntry=Readonly<{source:string;status:ContextStatus;id?:string;label?:string;sourceVersion?:string;observedAt?:string;asOf?:string|null;data?:unknown;selection?:unknown}>
type ReadInput={reference:ChartReference|null;request:unknown;organisationId:string;signal?:AbortSignal;observedAt:string}
export function createAssistantContextGateway(options:{adapters:readonly {source:string;read:(input:ReadInput)=>Promise<ContextEntry>}[];now?:()=>number}):{resolve(input:{plan:readonly {source:string;selection:'ACTIVE_VIEW'}[];reference:ChartReference|null;request:unknown;organisationId:string;signal?:AbortSignal}):Promise<Readonly<{contract:{id:string;version:string};contexts:readonly ContextEntry[]}>>}
export function createBenchmarkContextAdapter(options:{readAuthorised:(input:{seriesId:string;range:'ALL';organisationId:string;request:unknown;signal?:AbortSignal})=>Promise<unknown>}):{source:string;read:(input:ReadInput)=>Promise<ContextEntry>}
