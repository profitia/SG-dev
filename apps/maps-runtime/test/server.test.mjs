import test from 'node:test'
import assert from 'node:assert/strict'
import {once} from 'node:events'
import {createMapsServer} from '../src/server/server.mjs'
import {readConfig} from '../src/server/config.mjs'

test('configuration is Development-only and never projects server credentials', () => {
  assert.throws(() => readConfig({TARGET_ENVIRONMENT: 'production'}))
  assert.throws(() => readConfig({TARGET_ENVIRONMENT: 'development', MAPS_ALLOWED_HOST_ORIGINS: '*'}))
  const config = readConfig({TARGET_ENVIRONMENT: 'development', GOOGLE_GEOCODING_API_KEY: 'server-secret', DATABASE_URL: 'database-secret'})
  assert.equal(config.configured, false)
  assert.equal(JSON.stringify(config).includes('secret'), false)
})
test('actual HTTP surface has bounded static routes, no business writers or public geocoder', async t => {
  const server = createMapsServer(readConfig({TARGET_ENVIRONMENT: 'development', MAPS_ALLOWED_HOST_ORIGINS: 'https://host.example'}))
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  t.after(() => new Promise(resolve => {server.closeAllConnections(); server.close(resolve)}))
  const base = `http://127.0.0.1:${server.address().port}`
  const health = await fetch(base + '/api/health')
  assert.equal(health.status, 200)
  assert.deepEqual((await health.json()).persistence, false)
  assert.match(health.headers.get('content-security-policy'), /frame-ancestors 'self' https:\/\/host.example;/)
  assert.match(health.headers.get('content-security-policy'), /script-src [^;]*'wasm-unsafe-eval'/)
  assert.doesNotMatch(health.headers.get('content-security-policy'), /(?:^|\s)'unsafe-eval'(?:\s|;)/)
  assert.equal(health.headers.get('cache-control'), 'no-store')
  assert.equal((await fetch(base + '/api/geocode', {method: 'POST', body: '{}'})).status, 405)
  assert.equal((await fetch(base + '/api/locations')).status, 404)
  assert.equal((await fetch(base + '/%2e%2e%2f.env.local')).status, 404)
  assert.equal((await fetch(base + '//[')).status, 400)
  assert.equal((await fetch(base + '/api/health')).status, 200)
  assert.equal((await fetch(base + '/api/config')).status, 200)
  const page = await fetch(base + '/')
  assert.equal(page.status, 200)
  assert.match(await page.text(), /Uruchom mapę Google/)
})
