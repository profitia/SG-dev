import {exactOrigin, isMapsMessage, mapsMessage, parseLocations, parseLocationSelection} from '@profitia/maps-contracts'
import {openEmbeddedReadHost} from '@profitia/platform-contracts/embedded-read-channel'

/** readLocations must call the host's authorized backend for any private data. */
export function mountMaps({container, runtimeOrigin, readLocations, onSelect = () => {}, onStatus = () => {}, timeoutMs = 15000}) {
  runtimeOrigin = exactOrigin(runtimeOrigin)
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 15000) throw new TypeError('Timeout exceeds the E1 channel limit')
  if (!container?.ownerDocument || typeof readLocations !== 'function') throw new TypeError('Container and data gateway required')
  const doc = container.ownerDocument
  const win = doc.defaultView
  const parentOrigin = exactOrigin(win.location.origin)
  const instanceId = win.crypto.randomUUID()
  const frame = doc.createElement('iframe')
  frame.title = 'Google Maps'
  frame.referrerPolicy = 'strict-origin-when-cross-origin'
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin')
  const url = new URL('/embed.html', runtimeOrigin)
  url.searchParams.set('parentOrigin', parentOrigin)
  url.searchParams.set('instanceId', instanceId)
  frame.src = url.href
  let closed = false, host, timer, connected = false
  let deliveredIds = new Set()
  const close = () => {
    if (closed) return
    closed = true
    win.clearTimeout(timer)
    win.removeEventListener('message', receive)
    host?.close()
    frame.remove()
    deliveredIds.clear()
  }
  const receive = event => {
    if (closed || event.origin !== runtimeOrigin || event.source !== frame.contentWindow) return
    if (isMapsMessage(event.data, 'ready', instanceId) && !connected) {
      connected = true
      const channel = new win.MessageChannel()
      host = openEmbeddedReadHost({port: channel.port1, instanceId,
        limits: {maxResponseBytes: 262144, maxInFlight: 1, timeoutMs},
        parseSelection: parseLocationSelection,
        read: async (_selection, {signal}) => {
          const locations = parseLocations(await readLocations({signal}))
          deliveredIds = new Set(locations.map(x => x.id))
          return {status: 200, body: {locations}}
        },
      })
      frame.contentWindow.postMessage(mapsMessage('connect', instanceId), runtimeOrigin, [channel.port2])
    } else if (isMapsMessage(event.data, 'rendered', instanceId)) {
      win.clearTimeout(timer)
      onStatus('ready')
    } else if (isMapsMessage(event.data, 'error', instanceId)) {
      win.clearTimeout(timer)
      onStatus('error')
    } else if (isMapsMessage(event.data, 'select', instanceId) && deliveredIds.has(event.data.locationId)) {
      onSelect(event.data.locationId)
    }
  }
  win.addEventListener('message', receive)
  timer = win.setTimeout(() => {if (!closed) {onStatus('error'); close()}}, timeoutMs)
  container.append(frame)
  return Object.freeze({close})
}
