/** Server adapter only. No public endpoint until current E1 operation admission is adopted. */
export async function geocodeAddress(address, {apiKey, fetch: request = fetch, timeoutMs = 7000, signal} = {}) {
  if (typeof address !== 'string' || !address.trim() || address.length > 512) throw new TypeError('Invalid address')
  if (!apiKey) return {status: 'unavailable', reason: 'not-configured'}
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  url.searchParams.set('address', address.trim())
  url.searchParams.set('key', apiKey)
  const timeout = AbortSignal.timeout(timeoutMs)
  try {
    const response = await request(url, {redirect: 'error', signal: signal ? AbortSignal.any([signal, timeout]) : timeout})
    if (!response.ok) return {status: 'unavailable', reason: response.status === 429 ? 'quota' : 'upstream'}
    const reader = response.body?.getReader()
    if (!reader) return {status: 'unavailable', reason: 'invalid-response'}
    const chunks = []
    let size = 0
    while (true) {
      const {done, value} = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 262144) {await reader.cancel(); return {status: 'unavailable', reason: 'invalid-response'}}
      chunks.push(value)
    }
    const content = Buffer.concat(chunks).toString('utf8')
    const body = JSON.parse(content)
    if (body.status === 'ZERO_RESULTS') return {status: 'unresolved', reason: 'not-found'}
    if (body.status !== 'OK') return {status: 'unavailable', reason: body.status === 'OVER_QUERY_LIMIT' ? 'quota' : 'upstream'}
    if (!Array.isArray(body.results) || body.results.length !== 1 || body.results[0].partial_match) return {status: 'unresolved', reason: 'ambiguous'}
    const result = body.results[0], position = result.geometry?.location
    if (!position || !Number.isFinite(position.lat) || !Number.isFinite(position.lng) || Math.abs(position.lat) > 90 || Math.abs(position.lng) > 180) return {status: 'unavailable', reason: 'invalid-response'}
    if (result.geometry.location_type !== 'ROOFTOP') return {status: 'unresolved', reason: 'low-precision'}
    // Only coordinates/place ID: no Google-formatted address is stored or mapped onto customer labels.
    return {status: 'resolved', position: {lat: position.lat, lng: position.lng}, ...(typeof result.place_id === 'string' ? {placeId: result.place_id} : {})}
  } catch {return {status: 'unavailable', reason: signal?.aborted ? 'cancelled' : 'delivery-unverified'}}
}
