import assert from 'node:assert/strict'
import test from 'node:test'
import { MessageChannel } from 'node:worker_threads'
import { readFileSync } from 'node:fs'
import { EMBEDDED_READ_CONTRACT, EMBEDDED_READ_LIMITS, EmbeddedReadUnavailable, readPresentationJson,
  openEmbeddedReadHost, openEmbeddedReadClient } from '../src/embedded-read-channel.mjs'

const instanceId = 'fixture_instance_0001'
const deferred = () => { let resolve; const promise = new Promise(value => { resolve = value }); return { promise, resolve } }
const parseSelection = input => Object.keys(input).sort().join(',') === 'kind,range' && input.kind === 'history'
  && ['1Y', 'ALL'].includes(input.range) ? { kind: input.kind, range: input.range } : null
const selected = { kind: 'history', range: '1Y' }
const message = (kind, fields = {}) => ({ contract: EMBEDDED_READ_CONTRACT.id, version: EMBEDDED_READ_CONTRACT.version, instanceId, kind, ...fields })
function pair(t, read, options = {}) {
  const { port1, port2 } = new MessageChannel()
  const host = openEmbeddedReadHost({ port: port1, instanceId, parseSelection, read, limits: options.hostLimits })
  const client = openEmbeddedReadClient({ port: port2, instanceId, limits: options.clientLimits })
  t.after(() => { host.close(); client.close(); port1.close(); port2.close() })
  return { host, client, port1, port2 }
}
function receive(port, predicate = () => true) {
  return new Promise(resolve => {
    const handler = event => { if (predicate(event.data)) { port.removeEventListener('message', handler); resolve(event.data) } }
    port.addEventListener('message', handler); port.start()
  })
}

test('real MessageChannels preserve zero/null and correlation without storing or reusing a previous access result', async t => {
  let reads = 0
  const body = { values: [10, 0, null], currency: null }
  const { client } = pair(t, async (selection, { signal }) => {
    assert.deepEqual(selection, selected); assert.equal(signal.aborted, false)
    reads++; return reads < 3 ? { status: 200, body } : { status: 403, body: { diagnostic: 'must not leave host' } }
  })
  const first = await client.read(selected), second = await client.read(selected)
  assert.deepEqual(first, { status: 200, body }); assert.deepEqual(second, first)
  first.body.values[0] = 90; assert.equal(body.values[0], 10); assert.equal(second.body.values[0], 10)
  assert.deepEqual(await client.read(selected), { status: 403, body: { error: 'Read unavailable.' } })
  assert.equal(reads, 3)
})

test('the host application parser refuses unknown identity, operation and destination selectors before any read', async t => {
  let calls = 0
  const { client } = pair(t, async () => { calls++; return { status: 200, body: null } })
  for (const patch of [{ organisationId: 'forged' }, { userId: 'forged' }, { operation: 'knowledge.ingest' },
    { destination: 'https://foreign.test' }, { authorization: 'synthetic_fixture' }, { kind: 'write' }, { range: 'UNKNOWN' }]) {
    assert.equal((await client.read({ ...selected, ...patch })).status, 400)
  }
  assert.equal(calls, 0)
})

test('invalid instance, protocol version, envelope or unknown command closes the real channel before the callback', async t => {
  for (const patch of [{ instanceId: 'foreign_instance_0001' }, { version: 'unknown' }, { contract: 'foreign' },
    { kind: 'WRITE' }, { actor: 'forged' }, { id: 0 }, { id: 1.5 }, { id: 2147483648 }]) {
    await t.test(JSON.stringify(patch), async t => {
      let reads = 0
      const { port1, port2 } = new MessageChannel()
      const host = openEmbeddedReadHost({ port: port1, instanceId, parseSelection, read: async () => { reads++; return { status: 200, body: null } } })
      t.after(() => { host.close(); port1.close(); port2.close() })
      const closed = receive(port2, value => value.kind === 'CLOSED')
      port2.postMessage({ ...message('READ', { id: 1, selectionJson: JSON.stringify(selected) }), ...patch })
      await closed; assert.equal(reads, 0)
    })
  }
})

test('one successful request cannot be replayed on the same MessagePort', async t => {
  const { port1, port2 } = new MessageChannel(); let reads = 0
  const host = openEmbeddedReadHost({ port: port1, instanceId, parseSelection,
    read: async () => { reads++; return { status: 200, body: null } } })
  t.after(() => { host.close(); port1.close(); port2.close() })
  const request = message('READ', { id: 1, selectionJson: JSON.stringify(selected) })
  const accepted = receive(port2); port2.postMessage(request); assert.equal((await accepted).status, 200)
  const closed = receive(port2); port2.postMessage(request); assert.equal((await closed).kind, 'CLOSED')
  assert.equal(reads, 1)
})

test('parallel real requests complete out of order without mixing their responses', async t => {
  const waiting = [], entered = deferred()
  const { client } = pair(t, async selection => {
    const gate = deferred(); waiting.push({ gate, range: selection.range }); if (waiting.length === 2) entered.resolve()
    await gate.promise; return { status: 200, body: { range: selection.range } }
  })
  const a = client.read(selected), b = client.read({ ...selected, range: 'ALL' }); await entered.promise
  waiting[1].gate.resolve(); assert.deepEqual(await b, { status: 200, body: { range: 'ALL' } })
  waiting[0].gate.resolve(); assert.deepEqual(await a, { status: 200, body: { range: '1Y' } })
})

test('host concurrency remains bounded even when a raw child bypasses the client helper', async t => {
  const { port1, port2 } = new MessageChannel(), gates = [], started = deferred(), refused = deferred()
  let active = 0, peak = 0, refusals = 0
  const host = openEmbeddedReadHost({ port: port1, instanceId, parseSelection, read: async () => {
    const gate = deferred(); gates.push(gate); peak = Math.max(peak, ++active)
    if (gates.length === EMBEDDED_READ_LIMITS.maxInFlight) started.resolve()
    await gate.promise; active--; return { status: 200, body: null }
  } })
  t.after(() => { gates.forEach(gate => gate.resolve()); host.close(); port1.close(); port2.close() })
  port2.addEventListener('message', event => { if (event.data.status === 429 && ++refusals === 2) refused.resolve() }); port2.start()
  for (let id = 1; id <= 6; id++) port2.postMessage(message('READ', { id, selectionJson: JSON.stringify(selected) }))
  await Promise.all([started.promise, refused.promise]); assert.equal(peak, 4); assert.equal(gates.length, 4)
})

test('client concurrency refuses locally before an additional message reaches the host', async t => {
  const started = deferred(), release = deferred(); let calls = 0
  const { client } = pair(t, async () => { calls++; started.resolve(); await release.promise; return { status: 200, body: null } },
    { clientLimits: { maxInFlight: 1 } })
  t.after(() => release.resolve())
  const first = client.read(selected); await started.promise
  await assert.rejects(client.read(selected), error => error instanceof EmbeddedReadUnavailable && error.status === 429)
  release.resolve(); await first; assert.equal(calls, 1)
})

test('AbortSignal cancellation crosses the actual port and discards a late response', async t => {
  const entered = deferred(), cancelled = deferred(), release = deferred(); let observed
  const { client } = pair(t, async (_selection, { signal }) => {
    observed = signal; signal.addEventListener('abort', () => cancelled.resolve(), { once: true }); entered.resolve()
    await release.promise; return { status: 200, body: { late: true } }
  })
  t.after(() => release.resolve())
  const controller = new AbortController(), promise = client.read(selected, { signal: controller.signal })
  await entered.promise; controller.abort(); await assert.rejects(promise, error => error.name === 'AbortError')
  await cancelled.promise; assert.equal(observed.aborted, true); release.resolve()
})

test('an already aborted request never invokes the source', async t => {
  let calls = 0
  const { client } = pair(t, async () => { calls++; return { status: 200, body: null } })
  const controller = new AbortController(); controller.abort()
  await assert.rejects(client.read(selected, { signal: controller.signal }), error => error.name === 'AbortError')
  assert.equal(calls, 0)
})

test('host timeout aborts work and withholds data while keeping noncooperative work in the concurrency limit', async t => {
  const release = deferred(); let signal, calls = 0
  const { client } = pair(t, async (_selection, options) => {
    calls++; signal = options.signal; await release.promise; return { status: 200, body: { late: true } }
  }, { hostLimits: { timeoutMs: 40, maxInFlight: 1 } })
  t.after(() => release.resolve())
  assert.deepEqual(await client.read(selected), { status: 503, body: { error: 'Read unavailable.' } })
  assert.equal(signal.aborted, true)
  assert.equal((await client.read(selected)).status, 429); assert.equal(calls, 1); release.resolve()
})

test('client timeout cancels the actual host request without exposing timeout diagnostics', async t => {
  const entered = deferred(), cancelled = deferred(), release = deferred()
  const { client } = pair(t, async (_selection, { signal }) => {
    signal.addEventListener('abort', () => cancelled.resolve(), { once: true }); entered.resolve()
    await release.promise; return { status: 200, body: null }
  }, { clientLimits: { timeoutMs: 40 } })
  t.after(() => release.resolve())
  const promise = client.read(selected); await entered.promise
  await assert.rejects(promise, error => error instanceof EmbeddedReadUnavailable && error.message === 'Read unavailable.')
  await cancelled.promise; release.resolve()
})

test('closing either side aborts its in-flight host read and rejects pending client work', async t => {
  for (const side of ['host', 'client']) await t.test(side, async t => {
    const entered = deferred(), cancelled = deferred(), release = deferred()
    const channel = pair(t, async (_selection, { signal }) => {
      signal.addEventListener('abort', () => cancelled.resolve(), { once: true }); entered.resolve()
      await release.promise; return { status: 200, body: null }
    })
    t.after(() => release.resolve())
    const promise = channel.client.read(selected); await entered.promise; channel[side].close()
    await assert.rejects(promise, EmbeddedReadUnavailable); await cancelled.promise
    await assert.rejects(channel.client.read(selected), EmbeddedReadUnavailable); release.resolve()
  })
})

test('malformed or oversized raw JSON is refused before selection parsing and read execution', async t => {
  const { port1, port2 } = new MessageChannel(); let parsed = 0, reads = 0
  const host = openEmbeddedReadHost({ port: port1, instanceId, parseSelection: input => { parsed++; return parseSelection(input) },
    read: async () => { reads++; return { status: 200, body: null } } })
  t.after(() => { host.close(); port1.close(); port2.close() })
  for (const [index, selectionJson] of ['invalid', 'null', '[]', '{"kind":"history","constructor":"forged"}', ' '.repeat(16385)].entries()) {
    const reply = receive(port2); port2.postMessage(message('READ', { id: index + 1, selectionJson }))
    assert([400, 413].includes((await reply).status))
  }
  assert.equal(parsed, 0); assert.equal(reads, 0)
})

test('non-JSON, cyclic, sparse, accessor, excessive shape and oversized UTF8 selections never leave the client', async t => {
  let calls = 0
  const { client } = pair(t, async () => { calls++; return { status: 200, body: null } }, { clientLimits: { maxRequestBytes: 128 } })
  const cycle = {}; cycle.self = cycle
  const accessor = Object.defineProperty({}, 'private', { enumerable: true, get() { throw Error('No accessor execution') } })
  for (const selection of [{ value: undefined }, { value: new Date() }, { value: new Map() }, { value: 1n },
    { value: Infinity }, { value: NaN }, cycle, accessor, { value: new Array(1000000) }, { value: '😀'.repeat(40) },
    Object.fromEntries(Array.from({ length: 257 }, (_, i) => [`v${i}`, true]))]) {
    await assert.rejects(client.read(selection), error => error instanceof EmbeddedReadUnavailable && error.status === 400)
  }
  assert.equal(calls, 0)
})

test('invalid or oversized host output and unexpected callback failures return only a safe refusal', async t => {
  const cycle = {}; cycle.self = cycle
  for (const value of [{ status: 200, body: { value: '😀'.repeat(40) } }, { status: 200, body: cycle },
    { status: 302, body: { location: 'https://foreign.test' } }, { status: 403, body: { diagnostic: 'private host diagnostic' } },
    { status: 200, body: { value: new Date() } }, { status: 200, body: null, extra: true }, new Error('private host diagnostic')]) {
    await t.test(value instanceof Error ? 'callback failure' : `status${value.status}`, async t => {
      const { client } = pair(t, async () => { if (value instanceof Error) throw value; return value }, { hostLimits: { maxResponseBytes: 128 } })
      const result = await client.read(selected)
      assert.deepEqual(result, { status: value.status === 403 ? 403 : 503, body: { error: 'Read unavailable.' } })
    })
  }
})

test('foreign or oversized responses cannot satisfy a pending client request', async t => {
  for (const patch of [{ version: 'unknown' }, { instanceId: 'foreign_instance_0001' }, { bodyJson: ' '.repeat(129) },
    { bodyJson: 'invalid' }, { status: 302 }, { extra: true }]) await t.test(JSON.stringify(patch).slice(0,50), async t => {
    const { port1, port2 } = new MessageChannel()
    const client = openEmbeddedReadClient({ port: port2, instanceId, limits: { maxResponseBytes: 128 } })
    t.after(() => { client.close(); port1.close(); port2.close() })
    port1.addEventListener('message', event => {
      if (event.data.kind === 'READ') port1.postMessage({ ...message('RESULT', { id: event.data.id, status: 200, bodyJson: 'null' }), ...patch })
    }); port1.start()
    await assert.rejects(client.read(selected), error => error instanceof EmbeddedReadUnavailable && error.message === 'Read unavailable.')
  })
})

test('only explicit valid ports and lower bounded limits can be configured', () => {
  const { port1, port2 } = new MessageChannel()
  try {
    assert(Object.isFrozen(EMBEDDED_READ_CONTRACT)); assert(Object.isFrozen(EMBEDDED_READ_LIMITS))
    for (const limits of [{ timeoutMs: 15001 }, { maxInFlight: 5 }, { maxRequestBytes: 0 }, { maxResponseBytes: -1 }, { timeoutMs: 1.5 }, { unknown: true }]) {
      assert.throws(() => openEmbeddedReadClient({ port: port1, instanceId, limits }), TypeError)
    }
    assert.throws(() => openEmbeddedReadClient({ port: {}, instanceId }), TypeError)
    assert.throws(() => openEmbeddedReadClient({ port: port1, instanceId: 'invented' }), TypeError)
    assert.throws(() => openEmbeddedReadHost({ port: port1, instanceId, read: async () => ({ status: 200, body: null }) }), TypeError)
    assert.equal(new EmbeddedReadUnavailable(200).status, 503)
  } finally { port1.close(); port2.close() }
})

test('the browser transport has no React, Clerk, Node, network, storage or authority implementation import', () => {
  const source = readFileSync(new URL('../src/embedded-read-channel.mjs', import.meta.url), 'utf8')
  assert.deepEqual([...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(v=>v[1]),['./embedded-channel-core.mjs'])
  const core=readFileSync(new URL('../src/embedded-channel-core.mjs',import.meta.url),'utf8')
  assert(!/^\s*import\s/m.test(core))
  for(const value of[source,core]){
    assert(!/\b(?:localStorage|sessionStorage|indexedDB)\s*(?:\.|\[)|\b(?:fetch|XMLHttpRequest)\s*\(/m.test(value))
    assert(!/\b(?:createOperationExecutor|createPrivateOperationHost|verifyToken|signToken)\s*\(/m.test(value))
  }
})

test('a bounded large chart is not refused by an additional small object or node-count limit', async t => {
  const values = Array.from({ length: 40000 }, () => ({ date: '2025-01-01', value: 0, currency: null }))
  const { client } = pair(t, async () => ({ status: 200, body: { values } }))
  const result = await client.read(selected)
  assert.equal(result.status, 200); assert.equal(result.body.values.length, 40000)
  assert.deepEqual(result.body.values[39999], values[39999])
})

test('a real port whose result publication fails closes and never sends a fallback payload', async t => {
  const { port1, port2 } = new MessageChannel(); let failed = 0, closed = false
  const faulting = { postMessage(value) {
    if (value.kind === 'RESULT') { failed++; throw Error('private transport diagnostic') }
    port1.postMessage(value)
  }, addEventListener: port1.addEventListener.bind(port1), removeEventListener: port1.removeEventListener.bind(port1),
    start: port1.start.bind(port1), close() { closed = true; port1.close() } }
  const host = openEmbeddedReadHost({ port: faulting, instanceId, parseSelection, read: async () => ({ status: 200, body: null }) })
  const client = openEmbeddedReadClient({ port: port2, instanceId })
  t.after(() => { host.close(); client.close(); port1.close(); port2.close() })
  await assert.rejects(client.read(selected), error => error instanceof EmbeddedReadUnavailable && error.message === 'Read unavailable.')
  assert.equal(failed, 1); assert.equal(closed, true)
})

test('the same bounded publication decoder preserves split UTF8, zero and null without network or context admission', async () => {
  const body = { label: 'Zażółć 😀', values: [0, null] }, bytes = new TextEncoder().encode(JSON.stringify(body))
  const response = new Response(new ReadableStream({ start(controller) {
    for (let i = 0; i < bytes.byteLength; i++) controller.enqueue(bytes.subarray(i, i + 1))
    controller.close()
  } }), { headers: { 'content-type': 'application/json; charset=utf-8' } })
  assert.deepEqual(await readPresentationJson(response, bytes.byteLength), body)
  assert.equal(response.body.locked, false)
})

test('invalid publication MIME, bytes, shape, stream or bounds fail generically and release/cancel the body', async t => {
  for (const kind of ['mime', 'oversized', 'utf8', 'json', 'shape', 'stream', 'bounds']) await t.test(kind, async () => {
    let cancelled = false
    const bytes = kind === 'utf8' ? new Uint8Array([0xff]) : new TextEncoder().encode(kind === 'json' ? 'invalid' : kind === 'shape' ? '{"constructor":"forged"}' : '"ok"')
    const response = new Response(new ReadableStream({ start(controller) {
      if (kind === 'stream') controller.error(new Error('private stream diagnostic'))
      else controller.enqueue(bytes)
    }, cancel() { cancelled = true } }), { headers: { 'content-type': kind === 'mime' ? 'text/html' : 'application/json' } })
    // Complete bodies are needed only to reach JSON/shape validation.
    const readable = ['json', 'shape'].includes(kind) ? new Response(bytes, { headers: { 'content-type': 'application/json' } }) : response
    await assert.rejects(readPresentationJson(readable, kind === 'bounds' ? 0 : kind === 'oversized' ? 1 : 1024),
      error => error instanceof EmbeddedReadUnavailable && error.status === 503 && error.message === 'Read unavailable.')
    assert.equal(readable.body.locked, false)
    if (['mime', 'oversized', 'utf8', 'bounds'].includes(kind)) assert.equal(cancelled, true)
    if (readable !== response) await response.body.cancel()
  })
  await assert.rejects(readPresentationJson(new Response(null, { headers: { 'content-type': 'application/json' } }), 1024), EmbeddedReadUnavailable)
})

test('a publication body already locked by another reader produces only a safe failure', async () => {
  const response = Response.json({ value: 0 }), reader = response.body.getReader()
  try { await assert.rejects(readPresentationJson(response, 1024), error => error instanceof EmbeddedReadUnavailable && error.status === 503) }
  finally { await reader.cancel(); reader.releaseLock() }
})

test('an idle client immediately observes actual host close without needing another read', async t => {
  const { port1, port2 } = new MessageChannel(), observed = deferred(); let closed = 0
  const host = openEmbeddedReadHost({ port: port1, instanceId, parseSelection, read: async () => ({ status: 200, body: null }) })
  const client = openEmbeddedReadClient({ port: port2, instanceId, onClose() { closed++; observed.resolve() } })
  t.after(() => { host.close(); client.close(); port1.close(); port2.close() })
  host.close(); await observed.promise; client.close(); assert.equal(closed, 1)
  await assert.rejects(client.read(selected), EmbeddedReadUnavailable)
})

test('a failing presentation close observer cannot retain or reopen client requests', async t => {
  const { port1, port2 } = new MessageChannel(); let observed = 0
  const client = openEmbeddedReadClient({ port: port2, instanceId, onClose() { observed++; throw Error('private presentation diagnostic') } })
  t.after(() => { client.close(); port1.close(); port2.close() })
  assert.doesNotThrow(() => client.close()); client.close(); assert.equal(observed, 1)
  await assert.rejects(client.read(selected), EmbeddedReadUnavailable)
})

test('a close observer must be an explicit function if supplied', () => {
  const { port1, port2 } = new MessageChannel()
  try { assert.throws(() => openEmbeddedReadClient({ port: port2, instanceId, onClose: 'forged' }), TypeError) }
  finally { port1.close(); port2.close() }
})
