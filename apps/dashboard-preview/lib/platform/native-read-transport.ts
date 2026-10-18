/** Shared server transport only. The caller supplies a verified deployment
 * binding and a closed selection; the native backend owns current access. */
export const privateNativeReadHeaders = Object.freeze({ 'Content-Type': 'application/json',
  'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' })
export class NativeReadFailure extends Error {
  constructor(readonly status: number) { super('Native read unavailable.') }
}
type Publication = Readonly<{
  configuration: Readonly<{ origin: string; applicationId: string; environment: string }>
  operationContract: string; feature: 'forecast' | 'market'; projection: string; resource: string
  path: string; parameters: URLSearchParams; maximumBytes: number
}>
const approvedPaths = new Set(['/api/benchmark/forecast/current', '/api/benchmark/forecast/verification',
  '/api/internal/forecast/capability', '/api/internal/forecast/readiness', '/api/benchmark/analytics-series'])

async function readBoundedJson(response: Response, maximum: number): Promise<unknown> {
  if (response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json' || !response.body)
    { await response.body?.cancel(); throw new NativeReadFailure(503) }
  const reader = response.body.getReader(), decoder = new TextDecoder()
  let bytes = 0, text = ''
  try {
    while (true) {
      const part = await reader.read()
      if (part.done) break
      bytes += part.value.byteLength
      if (bytes > maximum) { await reader.cancel(); throw new NativeReadFailure(503) }
      text += decoder.decode(part.value, { stream: true })
    }
    text += decoder.decode()
  } finally { reader.releaseLock() }
  return JSON.parse(text)
}

export async function readNativeStoredPublication(request: Request, publication: Publication,
  fetchUpstream: typeof fetch = fetch): Promise<unknown> {
  if (request.method !== 'GET') throw new NativeReadFailure(405)
  const authorization = request.headers.get('authorization')?.trim()
  if (!authorization || authorization.length > 32768 || !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/i.test(authorization))
    throw new NativeReadFailure(401)
  const { configuration, maximumBytes } = publication, origin = new URL(configuration.origin)
  if (origin.protocol !== 'https:' || origin.origin !== configuration.origin || origin.username || origin.password
    || !approvedPaths.has(publication.path) || !['forecast', 'market'].includes(publication.feature)
    || !Number.isInteger(maximumBytes) || maximumBytes < 1 || maximumBytes > 8 * 1024 * 1024) throw new NativeReadFailure(503)
  const response = await fetchUpstream(`${configuration.origin}${publication.path}?${publication.parameters}`, {
    method: 'GET', headers: { Authorization: authorization }, cache: 'no-store', credentials: 'omit', redirect: 'manual',
    referrerPolicy: 'no-referrer', signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
  })
  if (response.status !== 200) {
    await response.body?.cancel()
    throw new NativeReadFailure([400, 401, 403, 404, 409, 413, 429, 503].includes(response.status) ? response.status : 503)
  }
  if (response.headers.get('x-profitia-operation-contract') !== publication.operationContract
    || response.headers.get('x-profitia-application') !== configuration.applicationId
    || response.headers.get('x-profitia-environment') !== configuration.environment
    || response.headers.get(`x-profitia-${publication.feature}-projection`) !== publication.projection
    || response.headers.get(`x-profitia-${publication.feature}-resource`) !== publication.resource) {
    await response.body?.cancel(); throw new NativeReadFailure(503)
  }
  return readBoundedJson(response, maximumBytes)
}
