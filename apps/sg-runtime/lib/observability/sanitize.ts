import type { ErrorEvent, EventHint, SpanJSON, StackFrame, TransactionEvent } from '@sentry/core'

const technicalTags = new Set(['application', 'service', 'module', 'operation', 'request_id', 'diagnostic_id', 'runtime'])
const staticSegments = new Set(['api', 'pl', 'en', 'dashboard', 'benchmark', 'benchmarks', 'benchmark-finder',
  'search', 'ai-search', 'metadata', 'metadata-values', 'context', 'market-data', 'preview', 'series',
  'forecast', 'forecasts', 'current', 'verification', 'prepared', 'readiness', 'capability', 'request',
  'category', 'categories', 'category-builder', 'xray', 'adp', 'account', 'health', 'auth', 'login', 'logout',
  'sign-in', 'sign-up', 'register', 'identity', 'assistant', 'chat', 'supplier', 'suppliers', 'intelligence',
  'cost-scan', 'procurement', 'negotiation', 'retrieval', 'semantic', 'graph', 'hydrate'])

export function technicalRoute(value?: string): string {
  if (!value) return 'sg-runtime.operation'
  const route = value.replace(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+/, '')
  try {
    const path = new URL(route, 'https://runtime.invalid').pathname
    return '/' + path.split('/').filter(Boolean).map(part => staticSegments.has(part) ? part : ':value').join('/')
  } catch { return 'sg-runtime.operation' }
}

function safeIdentifier(value: unknown) {
  return typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,100}$/.test(value) ? value : undefined
}

function safeTags(tags: ErrorEvent['tags']) {
  return Object.fromEntries(Object.entries(tags ?? {}).flatMap(([key, value]) => {
    const safe = safeIdentifier(value)
    if (!technicalTags.has(key) || !safe) return []
    const valid = key === 'application' ? safe === 'sg-runtime'
      : key === 'service' ? /^sg2-(development|staging|production)-runtime$/.test(safe)
      : key === 'request_id' || key === 'diagnostic_id' ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(safe)
      : key === 'module' ? ['forecast', 'provider', 'benchmark', 'category', 'xray', 'api', 'frontend', 'ssr'].includes(safe)
      : key === 'runtime' ? ['nodejs', 'edge', 'browser'].includes(safe)
      : /^(diagnostic|SOURCE_(HTTP|BODY_READ|DECODE|PARSE))$/.test(safe)
    return valid ? [[key, safe]] : []
  }))
}

function safeFrame(frame: StackFrame): StackFrame {
  // Code locations remain useful; source lines, local variables and URL parameters never leave the runtime.
  const filename = typeof frame.filename === 'string' ? frame.filename.split(/[?#]/)[0]
    .replace(/^.*?\/\.next\//, '.next/').replace(/^https?:\/\/[^/]+\//, '/') : undefined
  return { filename, function: safeIdentifier(frame.function), lineno: frame.lineno as number | undefined,
    colno: frame.colno as number | undefined, in_app: frame.in_app as boolean | undefined }
}

export function sanitizeError(event: ErrorEvent, _hint?: EventHint): ErrorEvent {
  const values = event.exception?.values?.map(exception => ({
    type: safeIdentifier(exception.type) ?? 'Error',
    value: 'Technical operation failed; private message omitted',
    mechanism: exception.mechanism ? { type: safeIdentifier(exception.mechanism.type) ?? 'generic', handled: exception.mechanism.handled } : undefined,
    stacktrace: exception.stacktrace ? { frames: exception.stacktrace.frames?.map(safeFrame) } : undefined,
  }))
  const trace = event.contexts?.trace
  return {
    type: undefined, event_id: event.event_id, timestamp: event.timestamp, platform: event.platform,
    level: event.level, environment: event.environment, release: event.release,
    exception: values?.length ? { values } : undefined,
    message: values?.length ? undefined : 'SG Runtime technical diagnostic',
    transaction: event.transaction ? technicalRoute(event.transaction) : undefined,
    contexts: trace ? { trace: { trace_id: trace.trace_id, span_id: trace.span_id,
      parent_span_id: trace.parent_span_id, op: safeIdentifier(trace.op), status: safeIdentifier(trace.status) } } : undefined,
    tags: safeTags(event.tags),
  }
}

export function sanitizeSpan(span: SpanJSON): SpanJSON {
  const status = span.data?.['http.response.status_code']
  return {
    span_id: span.span_id, trace_id: span.trace_id, parent_span_id: span.parent_span_id,
    start_timestamp: span.start_timestamp, timestamp: span.timestamp,
    op: safeIdentifier(span.op), status: span.status, origin: span.origin,
    description: span.op?.startsWith('http.server') || span.op === 'pageload' || span.op === 'navigation'
      ? technicalRoute(span.description) : span.op === 'sg.phase' && /^(E1_|SOURCE_|KRS_|GUS_)[A-Z_]{1,40}$/.test(span.description ?? '')
        ? span.description : safeIdentifier(span.op) ?? 'operation',
    data: typeof status === 'number' && status >= 100 && status <= 599 ? { 'http.response.status_code': status } : {},
  }
}

export function sanitizeTransaction(event: TransactionEvent): TransactionEvent {
  const base = sanitizeError(event as unknown as ErrorEvent)
  return { event_id: base.event_id, timestamp: event.timestamp, start_timestamp: event.start_timestamp,
    type: 'transaction', platform: base.platform, environment: base.environment, release: base.release,
    transaction: technicalRoute(event.transaction), transaction_info: { source: 'route' },
    contexts: base.contexts, tags: base.tags, spans: event.spans?.map(sanitizeSpan),
    measurements: Object.fromEntries(Object.entries(event.measurements ?? {}).filter(([key, measurement]) =>
      /^(lcp|fcp|cls|inp|ttfb|fid|fp|connection\.(rtt|downlink))$/.test(key) && Number.isFinite(measurement.value))),
  }
}
