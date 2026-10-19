import test from 'node:test'
import assert from 'node:assert/strict'
import {parseLocations, exactOrigin, isMapsMessage, mapsMessage, parseLocationSelection} from '@profitia/maps-contracts'

test('generic projection preserves unresolved points and strips tenant metadata and payloads', () => {
  const locations = parseLocations([{id: 'a', label: '<script>alert(1)</script>', organisationId: 'private', token: 'private', raw: {secret: true}}, {id: 'b', label: 'Zero', position: {lat: 0, lng: 0}}])
  assert.equal(locations[0].status, 'unresolved')
  assert.equal(locations[0].label, '<script>alert(1)</script>')
  assert.deepEqual(Object.keys(locations[0]), ['id', 'label', 'status'])
  assert.deepEqual(locations[1].position, {lat: 0, lng: 0})
  assert.ok(Object.isFrozen(locations[1]))
})
test('invalid, duplicate and oversized locations fail closed', () => {
  for (const input of [null, [{id: 'a', label: 'a', position: {lat: 91, lng: 0}}], [{id: 'a', label: 'a', position: {lat: NaN, lng: 0}}], [{id: 'a', label: 'a'}, {id: 'a', label: 'a'}], Array(501).fill({id: 'a', label: 'a'})]) assert.throws(() => parseLocations(input))
})
test('host origins and protocol versions are exact and selection is closed', () => {
  assert.equal(exactOrigin('https://host.example'), 'https://host.example')
  assert.equal(exactOrigin('http://127.0.0.1:3411'), 'http://127.0.0.1:3411')
  for (const origin of ['*', 'https://host.example/path', 'https://user:pass@host.example', 'http://external.example', 'null']) assert.throws(() => exactOrigin(origin))
  const message = mapsMessage('ready', 'instance')
  assert.equal(isMapsMessage(message, 'ready', 'instance'), true)
  assert.equal(isMapsMessage({...message, version: '99'}, 'ready', 'instance'), false)
  assert.equal(parseLocationSelection({view: 'locations', organisationId: 'a'}), null)
})
