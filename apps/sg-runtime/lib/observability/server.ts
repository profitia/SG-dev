import { tracingChannel } from 'node:diagnostics_channel'
import * as Sentry from '@sentry/nextjs'
import { currentForecastRequestDiagnostics } from '../forecast/request-diagnostics'

let installed = false

/** Observe the existing host/source phases. No new executor, identity read or provider call. */
export function installTechnicalPhaseObserver() {
  if (installed) return
  installed = true
  const spans = new WeakMap<object, ReturnType<typeof Sentry.startInactiveSpan>>()
  const reported = new WeakSet<object>()
  const channel = tracingChannel('profitia.platform.diagnostic-phase.v1')
  const finish = (message: unknown) => {
    try {
      const span = spans.get(message as object)
      if (span) { span.end(); spans.delete(message as object) }
    } catch { /* Monitoring cannot affect the business operation. */ }
  }
  channel.subscribe({
    start(message) {
      try {
        const category = (message as { category?: unknown }).category
        // Every observed phase belongs to the current SG Runtime request only.
        if (typeof category !== 'string' || !/^(E1_|SOURCE_|KRS_|GUS_)[A-Z_]{1,40}$/.test(category)
          || !Sentry.getActiveSpan()) return
        const diagnostics = currentForecastRequestDiagnostics()
        if (diagnostics && /^[0-9a-f-]{36}$/i.test(diagnostics.requestId)) {
          Sentry.getIsolationScope().setTag('request_id', diagnostics.requestId)
          Sentry.getIsolationScope().setTag('module', 'forecast')
        }
        spans.set(message as object, Sentry.startInactiveSpan({ name: category, op: 'sg.phase' }))
      } catch { /* Monitoring cannot affect the business operation. */ }
    },
    end(message) { if ((message as { synchronous?: boolean }).synchronous) finish(message) },
    asyncStart() {}, asyncEnd: finish,
    error(message) {
      try {
        spans.get(message as object)?.setStatus({ code: 2 })
        const { category, error } = message as { category?: string; error?: unknown }
        // A refused business operation is not an application incident. Only failed
        // transport/decoding phases produce a handled technical error here.
        if (category && ['SOURCE_HTTP', 'SOURCE_BODY_READ', 'SOURCE_DECODE', 'SOURCE_PARSE'].includes(category)
          && error instanceof Error && !reported.has(error) && Sentry.getActiveSpan()) {
          reported.add(error)
          Sentry.withScope(scope => { scope.setTag('operation', category); scope.setTag('module', 'provider'); Sentry.captureException(error) })
        }
      } catch { /* Observation only. */ }
    },
  })
}
