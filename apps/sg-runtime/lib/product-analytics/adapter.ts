import { isProductAnalyticsEventEnabled, validateBusinessEvent, type AnalyticsEvent, type AnalyticsModule, type AnalyticsProperties } from './contract'

type Attempt = { id: string; started: number; module: AnalyticsModule; operation: string; finished: boolean; detach?: () => void }
type Sink = (event: AnalyticsEvent, properties: Record<string, unknown>) => void
/** No queue, network, business data or identity service. All failures are isolated. */
export class ProductAnalytics {
  private sink: Sink | null = null
  private permitted: () => boolean = () => false
  private seen = new Set<string>()
  private transitions = new Map<string,string>()
  private attempts = new Set<Attempt>()
  private releaseSha: string | undefined
  private listeners = new Set<() => void>()
  private epoch = 0
  sessionEpoch = () => this.epoch
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  isReady = () => this.sink !== null
  serverReady = () => false
  private resetClient: () => void = () => undefined
  connect(sink: Sink, permitted: () => boolean, releaseSha?: string, resetClient?: () => void) {
    this.sink = sink; this.permitted = permitted; this.releaseSha = releaseSha; this.resetClient = resetClient ?? (() => undefined)
    for (const listener of this.listeners) { try { listener() } catch { /* Isolated. */ } }
  }
  capture(event: AnalyticsEvent, input: AnalyticsProperties): boolean {
    try {
      if (!this.sink || !this.permitted()) return false
      const properties = validateBusinessEvent(event, { ...input, ...(this.releaseSha ? { release_sha: this.releaseSha } : {}) })
      if (!properties || !isProductAnalyticsEventEnabled(event, properties)) return false
      this.sink(event, properties); return true
    } catch { return false }
  }
  once(key: string, event: AnalyticsEvent, properties: AnalyticsProperties) {
    if (!this.seen.has(key) && this.capture(event, properties)) this.seen.add(key)
  }
  transition(channel: string, key: string, event: AnalyticsEvent, properties: AnalyticsProperties) {
    if (this.transitions.get(channel) !== key && this.capture(event, properties)) this.transitions.set(channel,key)
  }
  clearTransition(channel: string) { this.transitions.delete(channel) }
  reset() { this.epoch++; this.seen.clear(); this.transitions.clear(); this.discardAttempts(); try { this.resetClient() } catch { /* Isolated. */ } }
  cancel(attempt: Attempt | null) {if(!attempt)return;attempt.finished=true;attempt.detach?.();this.attempts.delete(attempt)}
  discardAttempts() {for(const attempt of this.attempts)this.cancel(attempt)}
  leaveAttempts() {
    for(const attempt of this.attempts) {
      attempt.finished=true
      attempt.detach?.()
      this.capture('operation_left_incomplete',{module:attempt.module,operation:attempt.operation,process_attempt_id:attempt.id,duration_ms:this.duration(attempt),status:'left_incomplete'})
    }
    this.attempts.clear()
  }
  begin(module: AnalyticsModule, operation: string, signal?: AbortSignal): Attempt | null {
    try {
      if (!this.sink || !this.permitted() || signal?.aborted) return null
      const attempt: Attempt = { id: crypto.randomUUID(), started: performance.now(), module, operation, finished: false }
      if(!this.capture('operation_started', { module, operation, process_attempt_id: attempt.id }))return null
      this.attempts.add(attempt)
      if(signal){const onAbort=()=>this.cancel(attempt);signal.addEventListener('abort',onAbort,{once:true});attempt.detach=()=>signal.removeEventListener('abort',onAbort)}
      return attempt
    } catch { return null }
  }
  finish(attempt: Attempt | null, status: 'success' | 'error' | 'REFUSED' | 'CALCULATED' | 'PROXY_MARKET_ONLY' | 'partial' | 'empty') {
    if (!attempt || attempt.finished) return
    attempt.finished = true
    attempt.detach?.()
    this.attempts.delete(attempt)
    // A proxy is a limited result, never a full calculation success.
    if (status === 'PROXY_MARKET_ONLY') return
    this.capture(status === 'partial' || status === 'empty' ? 'operation_limited' : status === 'success' || status === 'CALCULATED' ? 'operation_completed' : 'operation_failed', { module: attempt.module,
      operation: attempt.operation, process_attempt_id: attempt.id, duration_ms: this.duration(attempt), status })
  }
  duration(attempt: { started: number }) { return Math.min(86400000, Math.max(0, Math.round(performance.now() - attempt.started))) }
  async observe<T>(module: AnalyticsModule, operation: string, work: Promise<T>, outcome: (result:T) => 'success'|'partial'|'empty' = ()=>'success'): Promise<T> {
    const attempt=this.begin(module,operation)
    try {
      const result=await work
      try {this.finish(attempt,outcome(result))} catch {this.finish(attempt,'error')}
      return result
    } catch(error) {this.finish(attempt,'error');throw error}
  }
}
export const productAnalytics = new ProductAnalytics()
