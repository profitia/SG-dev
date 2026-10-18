export type EmbeddedJson = null | boolean | number | string | EmbeddedJson[] | { [key: string]: EmbeddedJson }
export type EmbeddedSelection = { [key: string]: EmbeddedJson }
export type EmbeddedReadResult = Readonly<{ status: number; body: EmbeddedJson }>
export type EmbeddedReadLimits = Readonly<{ maxRequestBytes: number; maxResponseBytes: number; maxInFlight: number; timeoutMs: number }>
export const EMBEDDED_READ_CONTRACT: Readonly<{ id: 'profitia.embedded-read'; version: '1.0.0' }>
export const EMBEDDED_READ_LIMITS: EmbeddedReadLimits
export class EmbeddedReadUnavailable extends Error { readonly status: number; constructor(status?: number) }
/** Web MessagePort, also compatible with a genuine Node MessageChannel.
 * Transfer only after the application checks the exact source/window/origin. */
export type EmbeddedReadPort = Pick<MessagePort, 'addEventListener' | 'removeEventListener' | 'start' | 'close'> & {
  postMessage(message: unknown): void
}
type Options = Readonly<{ port: EmbeddedReadPort; instanceId: string; limits?: Partial<EmbeddedReadLimits> }>
/** This is data transport. The application parser pins allowed read selections;
 * the protected backend remains responsible for current access and projection. */
export function openEmbeddedReadHost<T extends EmbeddedSelection>(options: Options & Readonly<{
  parseSelection: (untrusted: EmbeddedSelection) => T | null
  read: (selection: NoInfer<T>, options: Readonly<{ signal: AbortSignal }>) => Promise<EmbeddedReadResult>
}>): Readonly<{ close(): void }>
export function openEmbeddedReadClient(options: Options): Readonly<{
  read(selection: EmbeddedSelection, options?: Readonly<{ signal?: AbortSignal }>): Promise<EmbeddedReadResult>
  close(): void
}>
