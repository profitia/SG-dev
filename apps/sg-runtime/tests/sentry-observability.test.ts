import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { tracingChannel } from 'node:diagnostics_channel'
import * as Sentry from '@sentry/nextjs'
import type { ErrorEvent, SpanJSON, TransactionEvent } from '@sentry/core'
import { observabilityOptions } from '../lib/observability/config'
import { sanitizeError, sanitizeSpan, sanitizeTransaction, technicalRoute } from '../lib/observability/sanitize'
import { installTechnicalPhaseObserver } from '../lib/observability/server'

const config = { enabled: 'true', scope: 'sg2-porr', dsn: `https://${'a'.repeat(32)}@o0.ingest.de.sentry.io/123`,
  projectId: '123', environment: 'development', release: 'b'.repeat(40), service: 'sg2-development-runtime' }
const secret = 'PRIVATE_FINANCIAL_SESSION_PAYLOAD'

test('configuration requires the exact deployment scope, project, service, environment and full SHA', () => {
  assert.equal(observabilityOptions(config).enabled, true)
  for (const patch of [{ enabled: undefined }, { scope: 'srm' }, { projectId: '456' }, { environment: 'preview' },
    { service: 'srm-development-runtime' }, { service: 'sg2-staging-runtime' }, { release: 'latest' },
    { dsn: 'https://invalid.example/123' }, { tracesSampleRate: 'NaN' }, { tracesSampleRate: '1.1' }]) {
    assert.equal(observabilityOptions({ ...config, ...patch }).enabled, false, JSON.stringify(patch))
  }
  assert.equal(observabilityOptions({ ...config, environment: 'staging', service: 'sg2-staging-runtime' }).enabled, true)
})

test('production requires an independent explicit activation; APP_ENV never follows NODE_ENV', () => {
  assert.equal(observabilityOptions({ ...config, environment: 'production', service: 'sg2-production-runtime' }).enabled, false)
  assert.equal(observabilityOptions({ ...config, environment: 'production', service: 'sg2-production-runtime', productionApproved: 'true' }).enabled, true)
  assert.equal(observabilityOptions({ ...config, environment: undefined }).enabled, false)
  assert.equal(observabilityOptions(config).environment, 'development')
})

test('error processing preserves technical identity while discarding private payloads', () => {
  const original: ErrorEvent = { type: undefined, event_id: 'c'.repeat(32), environment: 'development', release: config.release,
    message: secret, logentry: { message: secret }, user: { email: secret, ip_address: '127.0.0.1' },
    request: { url: `https://example.com/api/benchmark/search?q=${secret}`, data: secret, headers: { authorization: secret }, cookies: { session: secret } },
    extra: { data: secret }, contexts: { customer: { data: secret }, trace: { trace_id: 'd'.repeat(32), span_id: 'e'.repeat(16), data: { private: secret } } },
    tags: { application: 'sg-runtime', customer: secret }, breadcrumbs: [{ message: secret }],
    exception: { values: [{ type: 'Error', value: secret, stacktrace: { frames: [{ filename: 'webpack:///_N_E/./lib/example.ts?token='+secret,
      function: 'handler', lineno: 42, vars: { data: secret }, pre_context: [secret], context_line: secret }] } }] } }
  const clean = sanitizeError(original)
  assert.equal(JSON.stringify(clean).includes(secret), false)
  assert.equal(clean.release, config.release)
  assert.equal(clean.contexts?.trace?.trace_id, 'd'.repeat(32))
  assert.equal(clean.exception?.values?.[0]?.stacktrace?.frames?.[0]?.lineno, 42)
  assert.equal(JSON.stringify(original).includes(secret), true, 'sanitization does not mutate the caller object')
})

test('spans retain timing and status without SQL, provider bodies, business paths or labels', () => {
  const span: SpanJSON = { trace_id: 'd'.repeat(32), span_id: 'e'.repeat(16), start_timestamp: 10, timestamp: 11,
    op: 'db.sql.query', description: 'SELECT '+secret, data: { 'db.statement': secret, 'http.response.status_code': 503 },
    links: [{ trace_id: 'd'.repeat(32), span_id: 'e'.repeat(16), attributes: { private: secret } }] }
  const clean = sanitizeSpan(span)
  assert.equal(JSON.stringify(clean).includes(secret), false)
  assert.equal(clean.timestamp! - clean.start_timestamp, 1)
  assert.equal(clean.data['http.response.status_code'], 503)
  assert.equal(technicalRoute(`/api/benchmarks/${secret}?q=${secret}`), '/api/benchmarks/:value')
})

test('transaction processing strips unknown measurements, AI inputs and raw transaction context', () => {
  const event = { type: 'transaction', transaction: 'GET /api/benchmark/search?q='+secret,
    environment: 'development', release: config.release, start_timestamp: 1, timestamp: 2,
    contexts: { trace: { trace_id: 'a'.repeat(32), span_id: 'b'.repeat(16), data: { prompt: secret } } },
    extra: { private: secret }, measurements: { lcp: { value: 42 }, [secret]: { value: 5 } } } as TransactionEvent
  const clean = sanitizeTransaction(event)
  assert.equal(JSON.stringify(clean).includes(secret), false)
  assert.equal(clean.transaction, '/api/benchmark/search')
  assert.equal(clean.measurements?.lcp.value, 42)
})

test('the real SDK exports sanitized events and existing diagnostic spans without network requests', async () => {
  const envelopes: unknown[] = []
  Sentry.init({ ...observabilityOptions(config), defaultIntegrations: [], tracesSampleRate: 1,
    beforeSend: sanitizeError, beforeSendTransaction: sanitizeTransaction, beforeSendSpan: sanitizeSpan,
    transport: () => ({ send: async envelope => { envelopes.push(envelope); return { statusCode: 200 } }, flush: async () => true }) })
  installTechnicalPhaseObserver()
  const channel = tracingChannel('profitia.platform.diagnostic-phase.v1')
  let calls = 0
  await Sentry.startSpan({ name: '/api/benchmark/search', op: 'http.server', forceTransaction: true }, async () => {
    const result = await channel.tracePromise(async () => { calls++; return secret }, { category: 'SOURCE_HTTP' })
    assert.equal(result, secret)
    Sentry.captureException(new Error(secret))
    await assert.rejects(channel.tracePromise(async () => { throw new Error('Expected business refusal') }, { category: 'E1_POLICY' }))
  })
  await Sentry.flush(2000)
  assert.equal(calls, 1, 'observation never repeats business work')
  assert.equal(JSON.stringify(envelopes).includes(secret), false)
  assert.ok(envelopes.some(envelope => JSON.stringify(envelope).includes('Technical operation failed')))
  assert.ok(envelopes.some(envelope => JSON.stringify(envelope).includes('SOURCE_HTTP')))
  const events = envelopes.flatMap(envelope => (envelope as [unknown, [Record<string, unknown>, unknown][]])[1])
    .filter(([header]) => header.type === 'event')
  assert.equal(events.length, 1, 'an expected business refusal adds no incident')
  await Sentry.close(2000)
})

test('Next 14 initializes all three runtimes without session replay, client logs or a public error endpoint', () => {
  for (const name of ['client', 'server', 'edge']) {
    const source = readFileSync(new URL(`../sentry.${name}.config.ts`, import.meta.url), 'utf8')
    assert.match(source, /options.enabled/)
    assert.match(source, /beforeSend: sanitizeError/)
    assert.match(source, /beforeSendTransaction: sanitizeTransaction/)
    assert.doesNotMatch(source, /replayIntegration|captureConsoleIntegration/)
  }
  const source = readFileSync(new URL('../instrumentation.ts', import.meta.url), 'utf8')
  assert.match(source, /NEXT_RUNTIME === 'nodejs'/)
  assert.match(source, /NEXT_RUNTIME === 'edge'/)
})
