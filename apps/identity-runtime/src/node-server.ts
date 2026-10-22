import { createServer, type IncomingMessage } from 'node:http'
export function createNodeServer(origin: string, handler: (request: Request) => Promise<Response>) {
  const expected = new URL(origin)
  const server = createServer(async (incoming: IncomingMessage, outgoing) => {
    const raw = incoming.url ?? '', abort = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    const deadline = new Promise<Response>(resolve => { timer = setTimeout(() => {
      abort.abort(); if (!incoming.complete) incoming.destroy()
      resolve(new Response('{"error":"IDENTITY_UNAVAILABLE"}', { status: 503, headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' } }))
    }, 5000) })
    incoming.on('aborted', () => abort.abort())
    try {
      const question = raw.indexOf('?'), rawPath = question < 0 ? raw : raw.slice(0, question)
      const sdkEntry = incoming.method === 'GET' && /^\/account\/[a-z0-9-]+\/[a-z0-9-]+\/(registration|login|recovery)$/.test(rawPath)
      if (incoming.headers.host !== expected.host || !/^\/[a-z0-9/-]*$/.test(rawPath) || rawPath.includes('//') || rawPath.includes('..')
        || question >= 0 && (!sdkEntry || raw.length - question > 8192 || /[\u0000-\u0020\u007f\\]/.test(raw))) throw Error('REQUEST_TARGET')
      const headers = new Headers(); for (let i=0;i<incoming.rawHeaders.length;i+=2) headers.append(incoming.rawHeaders[i]!, incoming.rawHeaders[i+1]!)
      const method = incoming.method ?? 'GET', chunks: Buffer[] = []; let total = 0
      for await (const chunk of incoming) { total += chunk.length; if (total > 4096 || abort.signal.aborted) throw Error('BODY_LIMIT'); chunks.push(chunk) }
      const bytes = Buffer.concat(chunks), request = new Request(origin + raw, { method, headers, signal: abort.signal, ...(!['GET','HEAD'].includes(method) ? { body: bytes } : {}) })
      const response = await Promise.race([handler(request), deadline]); outgoing.statusCode = response.status; response.headers.forEach((value,key) => outgoing.setHeader(key,value)); outgoing.end(Buffer.from(await response.arrayBuffer()))
    } catch { outgoing.writeHead(400, { 'content-type': 'application/json', 'cache-control': 'private, no-store' }); outgoing.end('{"error":"REQUEST_REJECTED"}') }
    finally { clearTimeout(timer!) }
  })
  server.requestTimeout = 5000; server.headersTimeout = 5000; server.maxHeadersCount = 64
  return server
}
