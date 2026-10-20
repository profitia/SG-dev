type Options = Readonly<{
  mode: () => 'legacy_demo' | 'clerk' | 'unavailable'
  getToken: () => Promise<string | null>
  origin: () => string
  fetch: typeof fetch
}>

const unavailable = () => new Error('Category operation unavailable')
const aborted = () => new DOMException('Category operation aborted', 'AbortError')

/** Presentation transport only. The server verifies identity and current
 * organisation/resource permission independently for every operation. */
export function createCategoryOperationRequester(options: Options) {
  let closed = false
  const active = new Set<AbortController>()
  const request = async (path: string, init: RequestInit = {}): Promise<Response> => {
    if (closed) throw aborted()
    const mode = options.mode()
    if (mode === 'legacy_demo') return options.fetch(path, init)
    if (mode !== 'clerk') throw unavailable()
    const origin = new URL(options.origin()).origin, url = new URL(path, origin)
    const method = init.method ?? 'GET'
    const collection = path === '/api/category'
    const detail = /^\/api\/category\/[A-Za-z0-9_-]{1,128}$/.test(path)
      && path !== '/api/category/ai-suggestions'
    const selection = path === '/api/benchmark/selection'
    if (!path.startsWith('/') || path.startsWith('//') || url.origin !== origin || url.pathname !== path || url.search || url.hash
      || !(collection && ['GET','POST'].includes(method) || detail && ['GET','PATCH'].includes(method) || selection && method === 'GET')) throw unavailable()
    const headers = new Headers(init.headers)
    if ([...headers.keys()].some(key => key !== 'content-type')
      || headers.has('content-type') && headers.get('content-type') !== 'application/json'
      || method === 'GET' && init.body != null
      || method !== 'GET' && (typeof init.body !== 'string' || new TextEncoder().encode(init.body).byteLength > 32768
        || headers.get('content-type') !== 'application/json')) throw unavailable()
    const controller = new AbortController(), callerSignal = init.signal
    const abort = () => controller.abort()
    callerSignal?.addEventListener('abort', abort, { once: true })
    if (callerSignal?.aborted) controller.abort()
    active.add(controller)
    const body = init.body
    try {
      if (controller.signal.aborted) throw aborted()
      const token = await options.getToken()
      if (closed || controller.signal.aborted) throw aborted()
      if (!token || token.length > 8192 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) throw unavailable()
      headers.set('Authorization', `Bearer ${token}`)
      const response = await options.fetch(path, { method, body, headers, signal: controller.signal,
        credentials: 'omit', cache: 'no-store', redirect: 'manual', referrerPolicy: 'no-referrer' })
      if (closed || controller.signal.aborted) { await response.body?.cancel(); throw aborted() }
      return response
    } finally { active.delete(controller); callerSignal?.removeEventListener('abort', abort) }
  }
  return Object.assign(request, { close() { closed = true; for (const controller of active) controller.abort(); active.clear() } })
}
