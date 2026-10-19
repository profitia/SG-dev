import {parseLocations} from '@profitia/maps-contracts'
import {drawGoogleMap} from './google-maps.mjs'

export async function renderLocations(container, input, config, hooks = {}) {
  const locations = parseLocations(input)
  container.replaceChildren()
  const list = document.createElement('aside')
  list.className = 'locations'
  list.setAttribute('aria-label', 'Lokalizacje')
  const map = document.createElement('div')
  map.className = 'map'
  map.setAttribute('aria-label', 'Mapa lokalizacji')
  container.append(list, map)
  const buttons = new Map()
  let view
  const select = id => {
    for (const [key, button] of buttons) button.setAttribute('aria-pressed', String(key === id))
    view?.select(id)
    hooks.onSelect?.(id)
  }
  if (!locations.length) {
    const empty = document.createElement('p'); empty.textContent = 'Brak lokalizacji do wyświetlenia.'; list.append(empty)
  }
  for (const location of locations) {
    const button = document.createElement('button')
    button.className = 'location'
    button.type = 'button'
    button.setAttribute('aria-pressed', 'false')
    const label = document.createElement('strong'); label.textContent = location.label
    const detail = document.createElement('span'); detail.textContent = location.address || location.kind || 'Lokalizacja'
    button.append(label, detail)
    if (!location.position) {const hint = document.createElement('span'); hint.textContent = 'Wymaga doprecyzowania lokalizacji'; hint.className = 'unresolved'; button.append(hint)}
    button.addEventListener('click', () => select(location.id))
    buttons.set(location.id, button)
    list.append(button)
  }
  try {view = await drawGoogleMap(map, locations, config, {onSelect: select, onStatus: hooks.onStatus})}
  catch {hooks.onStatus?.('error'); throw new Error('Nie udało się uruchomić Google Maps.')}
  return {close() {view?.close(); container.replaceChildren()}}
}

export async function readPublicConfig() {
  const response = await fetch('/api/config', {cache: 'no-store'})
  if (!response.ok) throw new Error('Konfiguracja mapy jest niedostępna.')
  return response.json()
}

export function showStatus(state) {
  const status = document.querySelector('[data-status]')
  status.dataset.state = state
  status.textContent = ({loading: 'Łączenie z Google Maps…', ready: 'Połączenie z Google Maps działa.', error: 'Mapa jest niedostępna. Sprawdź połączenie lub konfigurację usługi.'})[state] || state
}
