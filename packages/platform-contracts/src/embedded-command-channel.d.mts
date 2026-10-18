import type {EmbeddedJson,EmbeddedSelection,EmbeddedReadPort,EmbeddedReadLimits} from './embedded-read-channel.mjs'
export const EMBEDDED_COMMAND_CONTRACT:Readonly<{id:'profitia.embedded-command';version:'1.0.0'}>
export const EMBEDDED_COMMAND_LIMITS:EmbeddedReadLimits
export type EmbeddedCommandRequest<T extends EmbeddedSelection=EmbeddedSelection>=Readonly<{intentId:string;command:T}>
export type EmbeddedCommandStatus=202|400|401|403|404|405|409|413|429|503
export type EmbeddedCommandResult=Readonly<{status:EmbeddedCommandStatus;body:EmbeddedJson}>
/** Unverified observation; never proof that an effect was absent or rolled back. */
export class EmbeddedCommandUnavailable extends Error {
  readonly status:number;readonly delivery:'UNVERIFIED';constructor(status?:number)
}
type Options=Readonly<{port:EmbeddedReadPort;instanceId:string;limits?:Partial<EmbeddedReadLimits>}>
/** The application admits the exact window/origin, owns current backend access,
 * stable idempotency and the accepted receipt projection. No automatic retry. */
export function openEmbeddedCommandHost<T extends EmbeddedSelection>(options:Options & Readonly<{
  parseCommand:(untrusted:EmbeddedSelection)=>T|null
  accept:(request:EmbeddedCommandRequest<NoInfer<T>>,options:Readonly<{signal:AbortSignal}>)=>Promise<EmbeddedCommandResult>
}>):Readonly<{close():void}>
export function openEmbeddedCommandClient(options:Options & Readonly<{onClose?:()=>void}>):Readonly<{
  submit(request:EmbeddedCommandRequest,options?:Readonly<{signal?:AbortSignal}>):Promise<EmbeddedCommandResult>
  close():void
}>
