export const MAPS_CONTRACT = Object.freeze({id: 'profitia.maps', version: '1.0.0'})
export const MAX_LOCATIONS = 500
export const MAX_LOCATION_BYTES = 262144

function text(value, max, optional = false) {
  if (optional && value === undefined) return undefined
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new TypeError('Invalid location text')
  return value.trim()
}

/** Allowlisted projection: business IDs, tokens and provider payloads are excluded. */
export function parseLocations(input) {
  if (!Array.isArray(input) || input.length > MAX_LOCATIONS) throw new TypeError('Invalid location collection')
  if (new TextEncoder().encode(JSON.stringify(input)).length > MAX_LOCATION_BYTES) throw new TypeError('Location collection too large')
  const ids = new Set()
  return input.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new TypeError('Invalid location')
    const id = text(item.id, 128)
    if (ids.has(id)) throw new TypeError('Duplicate location ID')
    ids.add(id)
    const result = {id, label: text(item.label, 160)}
    for (const key of ['address', 'kind', 'source']) {
      const value = text(item[key], key === 'address' ? 512 : 80, true)
      if (value !== undefined) result[key] = value
    }
    if (item.position !== undefined && item.position !== null) {
      const {lat, lng} = item.position
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new TypeError('Invalid coordinates')
      result.position = Object.freeze({lat, lng})
    }
    result.status = result.position ? 'resolved' : 'unresolved'
    return Object.freeze(result)
  })
}

export function exactOrigin(value) {
  const url = new URL(value)
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.origin !== value) throw new TypeError('Exact HTTP origin required')
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new TypeError('HTTPS required')
  return url.origin
}

export function isMapsMessage(data, type, instanceId) {
  return data?.contract === MAPS_CONTRACT.id && data.version === MAPS_CONTRACT.version && data.type === type && data.instanceId === instanceId
}

export function mapsMessage(type, instanceId, payload = {}) {
  return {contract: MAPS_CONTRACT.id, version: MAPS_CONTRACT.version, type, instanceId, ...payload}
}

export function parseLocationSelection(value) {
  return value && Object.keys(value).length === 1 && value.view === 'locations' ? {view: 'locations'} : null
}
