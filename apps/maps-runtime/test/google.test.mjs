import test from 'node:test'
import assert from 'node:assert/strict'
import {geocodeAddress} from '../src/server/google/geocoding.mjs'

const valid = {status: 'OK', results: [{geometry: {location: {lat: 52, lng: 21}}, place_id: 'place', formatted_address: 'restricted response'}]}
test('server adapter pins destination and projects only coordinates and place ID', async () => {
  let calls = 0
  const result = await geocodeAddress('test', {apiKey: 'not-a-real-key', fetch: async (url, options) => {
    calls++; assert.equal(url.origin + url.pathname, 'https://maps.googleapis.com/maps/api/geocode/json'); assert.equal(options.redirect, 'error'); return Response.json(valid)
  }})
  assert.equal(calls, 1)
  assert.deepEqual(result, {status: 'resolved', position: {lat: 52, lng: 21}, placeId: 'place'})
})
test('missing credentials, partial matches, empty results, quota and malformed responses stay explicit', async () => {
  assert.deepEqual(await geocodeAddress('test'), {status: 'unavailable', reason: 'not-configured'})
  for (const [body, status] of [[{status: 'ZERO_RESULTS'}, 'unresolved'], [{...valid, results: [{...valid.results[0], partial_match: true}]}, 'unresolved'], [{...valid, results: [...valid.results, ...valid.results]}, 'unresolved'], [{status: 'OVER_QUERY_LIMIT'}, 'unavailable'], [{status: 'OK', results: [{}]}, 'unavailable']]) {
    assert.equal((await geocodeAddress('test', {apiKey: 'test', fetch: async () => Response.json(body)})).status, status)
  }
  assert.equal((await geocodeAddress('test', {apiKey: 'test', fetch: async () => new Response('x'.repeat(262145))})).reason, 'invalid-response')
})
test('uncertain delivery and cancellation never trigger automatic paid retries or disclose credentials', async () => {
  let calls = 0
  const result = await geocodeAddress('test', {apiKey: 'sensitive-test-value', fetch: async () => {calls++; throw new Error('sensitive-test-value')}})
  assert.deepEqual(result, {status: 'unavailable', reason: 'delivery-unverified'})
  assert.equal(calls, 1)
  assert.equal(JSON.stringify(result).includes('sensitive'), false)
  const signal = AbortSignal.abort()
  const cancelled = await geocodeAddress('test', {apiKey: 'test', signal, fetch: async (_url, options) => {options.signal.throwIfAborted()}})
  assert.equal(cancelled.reason, 'cancelled')
})
test('browser loader loads once and reports authorization/network/timeout failures', async () => {
  for (const mode of ['success', 'auth', 'network', 'timeout']) {
    const {loadGoogleMaps} = await import(`../src/client/google-maps.mjs?test=${mode}`)
    const win = {setTimeout, clearTimeout, Event, dispatchEvent() {}, google: {maps: {importLibrary() {}}}}
    let count = 0
    const script = {remove() {}}
    const doc = {createElement: () => script, head: {append() {count++; queueMicrotask(() => {if (mode === 'success') win.__profitiaMapsLoaded(); if (mode === 'auth') win.gm_authFailure(); if (mode === 'network') script.onerror()})}}}
    const promise = loadGoogleMaps({configured: true, browserKey: 'test'}, {win, doc, timeoutMs: 15})
    assert.equal(loadGoogleMaps({}, {win, doc}), promise)
    if (mode === 'success') assert.equal(await promise, win.google.maps)
    else await assert.rejects(promise)
    assert.equal(count, 1)
    assert.equal(new URL(script.src).origin, 'https://maps.googleapis.com')
  }
})
