import {exactOrigin, isMapsMessage, mapsMessage} from '@profitia/maps-contracts'
import {openEmbeddedReadClient} from '@profitia/platform-contracts/embedded-read-channel'
import {readPublicConfig, renderLocations, showStatus} from './main.mjs'

let view, client, connected = false
try {
  const params = new URLSearchParams(location.search)
  const origin = exactOrigin(params.get('parentOrigin'))
  const instanceId = params.get('instanceId')
  if (!/^[a-f0-9-]{36}$/.test(instanceId) || window.parent === window) throw new Error('Host required')
  const config = await readPublicConfig()
  if (!config.allowedHostOrigins.includes(origin)) throw new Error('Host not allowed')
  const send = (type, payload) => parent.postMessage(mapsMessage(type, instanceId, payload), origin)
  const receive = async event => {
    if (event.origin !== origin || event.source !== parent || connected || !isMapsMessage(event.data, 'connect', instanceId) || event.ports.length !== 1) return
    connected = true
    window.removeEventListener('message', receive)
    client = openEmbeddedReadClient({port: event.ports[0], instanceId, limits: {maxResponseBytes: 262144, maxInFlight: 1, timeoutMs: 15000}, onClose: () => {view?.close(); showStatus('error')}})
    try {
      const response = await client.read({view: 'locations'})
      if (response.status !== 200) throw new Error('Host read denied')
      showStatus('loading')
      view = await renderLocations(document.querySelector('[data-map]'), response.body.locations, config, {
        onStatus: state => {showStatus(state); send(state === 'ready' ? 'rendered' : 'error')},
        onSelect: id => send('select', {locationId: id}),
      })
    } catch {showStatus('error'); send('error'); client.close()}
  }
  window.addEventListener('message', receive)
  window.addEventListener('pagehide', () => {window.removeEventListener('message', receive); view?.close(); client?.close()}, {once: true})
  send('ready')
} catch {showStatus('error')}
