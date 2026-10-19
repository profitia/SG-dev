import {readPublicConfig, renderLocations, showStatus} from './main.mjs'

export const sampleLocations = [
  {id: 'sample-warsaw', label: 'Punkt testowy — Warszawa', kind: 'Przykład', source: 'synthetic', position: {lat: 52.2297, lng: 21.0122}},
  {id: 'sample-krakow', label: 'Punkt testowy — Kraków', kind: 'Przykład', source: 'synthetic', position: {lat: 50.0647, lng: 19.945}},
  {id: 'sample-unresolved', label: 'Punkt bez współrzędnych', address: 'Adres testowy do doprecyzowania', source: 'synthetic'},
]

const start = document.querySelector('[data-start]')
if (start) start.addEventListener('click', async () => {
  start.disabled = true
  showStatus('loading')
  try {
    const config = await readPublicConfig()
    await renderLocations(document.querySelector('[data-map]'), sampleLocations, config, {onStatus: showStatus,
      onSelect: id => {document.querySelector('[data-selection]').textContent = sampleLocations.find(x => x.id === id)?.label || ''},
    })
  } catch {showStatus('error')}
})
