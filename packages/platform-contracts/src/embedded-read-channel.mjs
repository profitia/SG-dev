/** Presentation transport only. The host owns window/origin admission, closed
 * selection parsing and current backend authorisation. No identity is minted,
 * forwarded or cached by a MessagePort or this instance identifier. */
export const EMBEDDED_READ_CONTRACT = Object.freeze({ id: 'profitia.embedded-read', version: '1.0.0' })
export const EMBEDDED_READ_LIMITS = Object.freeze({ maxRequestBytes: 16384, maxResponseBytes: 8388608, maxInFlight: 4, timeoutMs: 15000 })
const safeStatuses = new Set([200, 400, 401, 403, 404, 405, 409, 413, 429, 503])
const encoder = new TextEncoder()
const unavailableJson = '{"error":"Read unavailable."}'
const record = value => !!value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value))
const exactKeys = (value, expected) => record(value) && Object.keys(value).sort().join(',') === expected.slice().sort().join(',')
const validId = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647

export class EmbeddedReadUnavailable extends Error {
  constructor(status = 503) { super('Read unavailable.'); this.name = 'EmbeddedReadUnavailable'; this.status = safeStatuses.has(status) && status !== 200 ? status : 503 }
}

function configuration(port, instanceId, input = {}) {
  if (!port || !['postMessage', 'addEventListener', 'removeEventListener', 'start', 'close'].every(key => typeof port[key] === 'function')
    || typeof instanceId !== 'string' || !/^[a-z0-9_-]{16,128}$/i.test(instanceId)
    || !record(input) || Object.keys(input).some(key => !Object.hasOwn(EMBEDDED_READ_LIMITS, key))) throw new TypeError('Explicit read channel configuration required')
  const limits = { ...EMBEDDED_READ_LIMITS, ...input }
  if (Object.entries(limits).some(([key, value]) => !Number.isSafeInteger(value) || value < 1 || value > EMBEDDED_READ_LIMITS[key])) throw new TypeError('Read channel limits cannot be increased')
  return Object.freeze(limits)
}

// Reject cycles, non-JSON values and excessive shape before serialisation.
// JSON remains data; this validation is not a private-data projection policy.
function serialise(value, maximumBytes) {
  let budget = maximumBytes, nodes = maximumBytes
  const ancestors = new Set()
  function visit(item, depth = 0) {
    if (--nodes < 0 || budget < 0 || depth > 24) return false
    if (item === null || typeof item === 'boolean') { budget -= item === null ? 4 : item ? 4 : 5; return budget >= 0 }
    if (typeof item === 'number') { if (!Number.isFinite(item)) return false; budget -= JSON.stringify(item).length; return budget >= 0 }
    if (typeof item === 'string') { budget -= item.length + 2; return budget >= 0 }
    if (!record(item) && !Array.isArray(item) || ancestors.has(item)) return false
    const keys = Object.keys(item)
    if (keys.length > maximumBytes
      || Array.isArray(item) && (item.length > maximumBytes || keys.length !== item.length
        || Object.getPrototypeOf(item) !== Array.prototype || keys.some(key => !/^(0|[1-9][0-9]*)$/.test(key)))) return false
    budget -= 2 + Math.max(0, keys.length - 1)
    ancestors.add(item)
    for (const key of keys) {
      if (!Array.isArray(item)) budget -= key.length + 3
      const descriptor = Object.getOwnPropertyDescriptor(item, key)
      if (budget < 0 || ['__proto__', 'prototype', 'constructor'].includes(key) || !descriptor || !Object.hasOwn(descriptor, 'value') || !visit(descriptor.value, depth + 1)) return false
    }
    ancestors.delete(item)
    return true
  }
  try {
    if (!visit(value)) return null
    const text = JSON.stringify(value)
    return typeof text === 'string' && encoder.encode(text).byteLength <= maximumBytes ? text : null
  } catch { return null }
}

function parseJson(text, maximumBytes) {
  if (typeof text !== 'string' || text.length > maximumBytes || encoder.encode(text).byteLength > maximumBytes) throw new EmbeddedReadUnavailable(413)
  try {
    const value = JSON.parse(text)
    if (serialise(value, maximumBytes) === null) throw new Error('Invalid JSON shape')
    return value
  } catch { throw new EmbeddedReadUnavailable(400) }
}

function envelope(instanceId, kind, fields = {}) {
  return { contract: EMBEDDED_READ_CONTRACT.id, version: EMBEDDED_READ_CONTRACT.version, instanceId, kind, ...fields }
}
function admitted(value, instanceId) {
  return record(value) && value.contract === EMBEDDED_READ_CONTRACT.id && value.version === EMBEDDED_READ_CONTRACT.version && value.instanceId === instanceId
}

/** The caller must admit the exact window/source/origin before transferring
 * this port. read() must respect AbortSignal and call the current protected
 * backend, returning only its admitted, projected read result. */
export function openEmbeddedReadHost({ port, instanceId, parseSelection, read, limits: input }) {
  const limits = configuration(port, instanceId, input)
  if (typeof parseSelection !== 'function' || typeof read !== 'function') throw new TypeError('Explicit selection parser and read required')
  const work = new Map()
  let closed = false, highestId = 0
  function send(kind, fields) {
    if (!closed) try { port.postMessage(envelope(instanceId, kind, fields)) } catch { close() }
  }
  function result(id, status, bodyJson = unavailableJson) { send('RESULT', { id, status, bodyJson: status === 200 ? bodyJson : unavailableJson }) }
  function close() {
    if (closed) return
    closed = true
    try { port.postMessage(envelope(instanceId, 'CLOSED')) } catch { /* No alternate channel. */ }
    port.removeEventListener('message', onMessage); port.removeEventListener('messageerror', close)
    for (const value of work.values()) { value.done = true; clearTimeout(value.timer); value.controller.abort() }
    work.clear(); port.close()
  }
  async function execute(id, selected, state) {
    try {
      const response = await read(selected, { signal: state.controller.signal })
      if (closed || state.done) return
      const status = exactKeys(response, ['status', 'body']) && safeStatuses.has(response.status) ? response.status : 503
      const bodyJson = status === 200 ? serialise(response.body, limits.maxResponseBytes) : unavailableJson
      state.done = true; clearTimeout(state.timer)
      result(id, bodyJson === null ? 503 : status, bodyJson ?? unavailableJson)
    } catch {
      if (!closed && !state.done) { state.done = true; clearTimeout(state.timer); result(id, 503) }
    } finally { work.delete(id) }
  }
  function onMessage(event) {
    if (closed) return
    try {
      const value = event.data, base = ['contract', 'version', 'instanceId', 'kind']
      if (!admitted(value, instanceId)) return close()
      if (value.kind === 'CLOSE' && exactKeys(value, base)) return close()
      if (value.kind === 'CANCEL' && exactKeys(value, [...base, 'id']) && validId(value.id)) {
        const state = work.get(value.id)
        if (state) { state.done = true; clearTimeout(state.timer); state.controller.abort() }
        return
      }
      if (value.kind !== 'READ' || !exactKeys(value, [...base, 'id', 'selectionJson']) || !validId(value.id) || value.id <= highestId) return close()
      highestId = value.id
      let selected
      try {
        const selection = parseJson(value.selectionJson, limits.maxRequestBytes)
        if (!record(selection)) throw new Error('Object selection required')
        selected = parseSelection(selection)
        if (!record(selected) || serialise(selected, limits.maxRequestBytes) === null) throw new Error('Selection refused')
      } catch (error) { return result(value.id, error instanceof EmbeddedReadUnavailable ? error.status : 400) }
      if (work.size >= limits.maxInFlight) return result(value.id, 429)
      const state = { controller: new AbortController(), done: false, timer: null }
      state.timer = setTimeout(() => {
        if (!closed && !state.done) { state.done = true; result(value.id, 503); state.controller.abort() }
      }, limits.timeoutMs)
      work.set(value.id, state)
      void execute(value.id, selected, state)
    } catch { close() }
  }
  port.addEventListener('message', onMessage); port.addEventListener('messageerror', close); port.start()
  return Object.freeze({ close })
}

export function openEmbeddedReadClient({ port, instanceId, limits: input }) {
  const limits = configuration(port, instanceId, input), pending = new Map()
  let closed = false, nextId = 0
  function detach(id) {
    const state = pending.get(id)
    if (state) { pending.delete(id); clearTimeout(state.timer); state.signal?.removeEventListener('abort', state.onAbort) }
    return state
  }
  function close() {
    if (closed) return
    try { port.postMessage(envelope(instanceId, 'CLOSE')) } catch { /* No alternate channel. */ }
    closed = true
    port.removeEventListener('message', onMessage); port.removeEventListener('messageerror', close)
    for (const id of pending.keys()) detach(id)?.reject(new EmbeddedReadUnavailable())
    port.close()
  }
  function onMessage(event) {
    if (closed) return
    try {
      const value = event.data, base = ['contract', 'version', 'instanceId', 'kind']
      if (!admitted(value, instanceId)) return close()
      if (value.kind === 'CLOSED' && exactKeys(value, base)) return close()
      if (value.kind !== 'RESULT' || !exactKeys(value, [...base, 'id', 'status', 'bodyJson']) || !validId(value.id) || !safeStatuses.has(value.status)) return close()
      const state = pending.get(value.id)
      if (!state) return
      const body = parseJson(value.bodyJson, limits.maxResponseBytes)
      detach(value.id)?.resolve({ status: value.status, body })
    } catch { close() }
  }
  function read(selection, { signal } = {}) {
    if (closed) return Promise.reject(new EmbeddedReadUnavailable())
    if (signal?.aborted) return Promise.reject(new DOMException('Read cancelled.', 'AbortError'))
    if (pending.size >= limits.maxInFlight) return Promise.reject(new EmbeddedReadUnavailable(429))
    const selectionJson = record(selection) ? serialise(selection, limits.maxRequestBytes) : null
    if (selectionJson === null) return Promise.reject(new EmbeddedReadUnavailable(400))
    if (!validId(nextId + 1)) { close(); return Promise.reject(new EmbeddedReadUnavailable()) }
    const id = ++nextId
    return new Promise((resolve, reject) => {
      const cancel = error => {
        const state = detach(id)
        if (!state) return
        try { port.postMessage(envelope(instanceId, 'CANCEL', { id })) } catch { close() }
        state.reject(error)
      }
      const state = { resolve, reject, signal, timer: setTimeout(() => cancel(new EmbeddedReadUnavailable()), limits.timeoutMs),
        onAbort: () => cancel(new DOMException('Read cancelled.', 'AbortError')) }
      pending.set(id, state); signal?.addEventListener('abort', state.onAbort, { once: true })
      try { port.postMessage(envelope(instanceId, 'READ', { id, selectionJson })) } catch { close() }
    })
  }
  port.addEventListener('message', onMessage); port.addEventListener('messageerror', close); port.start()
  return Object.freeze({ read, close })
}
