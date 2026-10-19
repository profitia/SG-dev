import {mountMaps} from '@profitia/maps-embed'

const start = document.querySelector('[data-start]')
let mount
start.addEventListener('click', () => {
  start.disabled = true
  const runtimeOrigin = document.querySelector('[data-runtime-origin]').value.trim() || location.origin
  try {
    mount = mountMaps({container: document.querySelector('[data-host]'), runtimeOrigin,
      readLocations: async ({signal}) => {
        if (signal.aborted) throw signal.reason
        return [{id: 'host-gdansk', label: 'Punkt gospodarza — Gdańsk', source: 'synthetic', position: {lat: 54.352, lng: 18.6466}}]
      },
      onSelect: id => {document.querySelector('[data-selection]').textContent = id},
      onStatus: status => {document.querySelector('[data-status]').textContent = status === 'ready' ? 'Mapa osadzona działa.' : 'Nie udało się osadzić mapy.'},
    })
  } catch {document.querySelector('[data-status]').textContent = 'Nieprawidłowa konfiguracja gospodarza.'}
})
document.querySelector('[data-close]').addEventListener('click', () => {mount?.close(); mount = undefined; start.disabled = false; document.querySelector('[data-status]').textContent = 'Mapa zamknięta.'})
window.addEventListener('pagehide', () => mount?.close(), {once: true})
