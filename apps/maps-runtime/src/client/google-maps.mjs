let loading

export function loadGoogleMaps(config, {win = window, doc = document, timeoutMs = 15000} = {}) {
  if (loading) return loading
  if (!config.configured) return Promise.reject(new Error('Maps configuration missing'))
  loading = new Promise((resolve, reject) => {
    const callback = '__profitiaMapsLoaded'
    const script = doc.createElement('script')
    let settled = false
    const finish = (error) => {
      if (settled) return
      settled = true
      win.clearTimeout(timer)
      delete win[callback]
      if (error) {script.remove(); reject(error)} else resolve(win.google.maps)
    }
    const timer = win.setTimeout(() => finish(new Error('Google Maps timeout')), timeoutMs)
    win[callback] = () => finish(win.google?.maps?.importLibrary ? null : new Error('Google Maps unavailable'))
    win.gm_authFailure = () => {
      finish(new Error('Google Maps authorization failed'))
      win.dispatchEvent(new win.Event('profitia:maps-auth-error'))
    }
    script.onerror = () => finish(new Error('Google Maps connection failed'))
    const url = new URL('https://maps.googleapis.com/maps/api/js')
    for (const [name, value] of Object.entries({key: config.browserKey, loading: 'async', callback, v: 'quarterly', language: 'pl', region: 'PL', auth_referrer_policy: 'origin'})) url.searchParams.set(name, value)
    script.src = url.href
    script.async = true
    doc.head.append(script)
  })
  return loading
}

/** Auth/script errors never turn into a successful rendering status. */
export async function drawGoogleMap(element, locations, config, {onSelect = () => {}, onStatus = () => {}} = {}) {
  const maps = await loadGoogleMaps(config)
  const [{Map}, {AdvancedMarkerElement}] = await Promise.all([maps.importLibrary('maps'), maps.importLibrary('marker')])
  const points = locations.filter(x => x.position)
  const map = new Map(element, {mapId: config.mapId, center: points[0]?.position || {lat: 52.2297, lng: 21.0122}, zoom: points.length === 1 ? 13 : 6, streetViewControl: false, mapTypeControl: false})
  const markers = points.map(location => {
    const marker = new AdvancedMarkerElement({map, position: location.position, title: location.label, gmpClickable: true})
    const onClick = () => onSelect(location.id)
    marker.addEventListener('gmp-click', onClick)
    return {marker, onClick}
  })
  if (points.length > 1) {
    const bounds = new maps.LatLngBounds()
    points.forEach(x => bounds.extend(x.position))
    map.fitBounds(bounds, 48)
  }
  let closed = false, verified = false
  const fail = () => {if (!closed) onStatus('error')}
  window.addEventListener('profitia:maps-auth-error', fail)
  const timer = window.setTimeout(() => {if (!verified) fail()}, 15000)
  const tiles = maps.event.addListenerOnce(map, 'tilesloaded', () => {
    if (closed) return
    verified = true
    window.clearTimeout(timer)
    onStatus('ready')
  })
  return {
    select(id) {const location = points.find(x => x.id === id); if (location) {map.panTo(location.position); map.setZoom(13)}},
    close() {closed = true; window.clearTimeout(timer); window.removeEventListener('profitia:maps-auth-error', fail); tiles.remove(); markers.forEach(({marker, onClick}) => {marker.removeEventListener('gmp-click', onClick); maps.event.clearInstanceListeners(marker); marker.map = null}); maps.event.clearInstanceListeners(map); element.replaceChildren()},
  }
}
