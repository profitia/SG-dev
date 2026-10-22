import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { createServer, request as httpRequest } from 'node:http'
import { once } from 'node:events'
import { createServer as createTlsServer, request as tlsRequest } from 'node:https'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { readDeploymentOrigin } from '../dist/src/deployment-configuration.js'

test('deployment origin is exact server configuration with a local default', () => {
  assert.equal(readDeploymentOrigin(undefined, 'http://127.0.0.1:3600'), 'http://127.0.0.1:3600')
  assert.equal(readDeploymentOrigin('https://identity-fixture.onrender.com', 'http://127.0.0.1:3600'), 'https://identity-fixture.onrender.com')
})

for (const value of ['', null, 42, 'https://*.example.test', 'https://user:pass@example.test', '//example.test', 'https://example.test/', 'https://example.test/path', 'https://example.test?x=1', 'https://example.test#x', 'https://example.test%2f', 'http://example.test', 'https://example.test\n', 'https://example.test:443']) {
  test('invalid deployment origin fails closed: ' + JSON.stringify(value), () => {
    assert.throws(() => readDeploymentOrigin(value, 'http://127.0.0.1:3600'), error => error.code === 'CONFIGURATION_UNAVAILABLE')
  })
}

async function unusedPort() {
  const listener = createServer()
  await new Promise((resolve, reject) => { listener.once('error', reject); listener.listen(0, '127.0.0.1', resolve) })
  const port = listener.address().port
  await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()))
  return port
}

async function start(t, origin) {
  const port = await unusedPort()
  const process = spawn(globalThis.process.execPath, ['dist/src/main.js'], {
    env: { PATH: globalThis.process.env.PATH, HOST: '0.0.0.0', PORT: String(port), IDENTITY_RUNTIME_ENABLED: 'false', IDENTITY_RUNTIME_PUBLIC_ORIGIN: origin },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = '', errors = ''
  process.stdout.on('data', bytes => { output += bytes })
  process.stderr.on('data', bytes => { errors += bytes })
  const ended = once(process, 'exit')
  const stop = async () => {
    if (process.exitCode !== null || process.signalCode !== null) return
    process.kill('SIGTERM')
    const guard = setTimeout(() => process.kill('SIGKILL'), 6500)
    try { const [code, signal] = await ended; assert.equal(code, 0); assert.equal(signal, null) }
    finally { clearTimeout(guard) }
  }
  t.after(stop)
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('START_TIMEOUT')), 5000)
    const onExit = () => { clearTimeout(timer); reject(Error('START_FAILED')) }
    process.once('exit', onExit)
    process.stdout.once('data', () => { clearTimeout(timer); process.off('exit', onExit); resolve() })
  })
  return { port, stop, logs: () => ({ output, errors }) }
}

function send(port, { host, path = '/healthz', method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const request = httpRequest({ hostname: '127.0.0.1', port, path, method, headers: { host, ...headers } }, response => {
      let body = ''
      response.setEncoding('utf8'); response.on('data', value => { body += value })
      response.once('end', () => resolve({ status: response.statusCode, headers: response.headers, body }))
    })
    request.once('error', reject); request.end(body)
  })
}

for (const origin of ['https://identity-fixture.onrender.com', 'https://auth-dev.example.test']) {
  test('real entrypoint accepts only configured public Host behind HTTP ingress: ' + origin, async t => {
    const child = await start(t, origin), host = new URL(origin).host
    const health = await send(child.port, { host, headers: { 'x-forwarded-proto': 'https' } })
    assert.equal(health.status, 200)
    assert.deepEqual(JSON.parse(health.body), { service: 'identity-runtime', status: 'ok' })
    for (const path of ['/readyz', '/v1/session']) {
      const result = await send(child.port, { host, path })
      assert.equal(result.status, 503); assert.equal(result.headers['cache-control'], 'private, no-store')
      assert.equal(result.headers['set-cookie'], undefined)
    }
    for (const path of ['/v1/flows', '/v1/flows/consume', '/v1/session/logout']) {
      const result = await send(child.port, { host, path, method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: '{}' })
      assert.equal(result.status, 503)
    }
    for (const other of ['evil.example.test', '127.0.0.1:' + child.port, host === 'identity-fixture.onrender.com' ? 'auth-dev.example.test' : 'identity-fixture.onrender.com']) {
      assert.equal((await send(child.port, { host: other, headers: { 'x-forwarded-host': host, 'x-forwarded-proto': 'https' } })).status, 400)
    }
    assert.equal((await send(child.port, { host, headers: { 'x-forwarded-host': 'evil.example.test', forwarded: 'host=evil.example.test;proto=http' } })).status, 200)
    assert(!child.logs().output.includes(origin)); assert.equal(child.logs().errors, '')
    await child.stop()
  })
}

test('restart keeps State A nonoperational and SIGTERM closes the one Node process', async t => {
  const origin = 'https://restart-fixture.onrender.com', host = new URL(origin).host
  for (let i = 0; i < 2; i++) {
    const child = await start(t, origin)
    assert.equal((await send(child.port, { host })).status, 200)
    assert.equal((await send(child.port, { host, path: '/v1/session' })).status, 503)
    await child.stop()
  }
})

test('TLS edge forwards HTTP with exact public Host, without trusting forwarded identity or aliases', async t => {
  const host = 'identity-fixture.onrender.com', origin = 'https://' + host
  const child = await start(t, origin)
  const directory = mkdtempSync(path.join(tmpdir(), 'identity-tls-fixture-'))
  let key, cert
  try {
    const generated = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=' + host, '-addext', 'subjectAltName=DNS:' + host, '-keyout', path.join(directory, 'key.pem'), '-out', path.join(directory, 'cert.pem')], { stdio: 'ignore' })
    assert.equal(generated.status, 0, 'Disposable local TLS fixture must be generated')
    key = readFileSync(path.join(directory, 'key.pem')); cert = readFileSync(path.join(directory, 'cert.pem'))
  } finally { rmSync(directory, { recursive: true, force: true }) }
  const edge = createTlsServer({ key, cert }, (incoming, outgoing) => {
    const upstream = httpRequest({ hostname: '127.0.0.1', port: child.port, method: incoming.method, path: incoming.url, headers: { ...incoming.headers, 'x-forwarded-proto': 'https' } }, response => {
      outgoing.writeHead(response.statusCode, response.headers); response.pipe(outgoing)
    })
    upstream.once('error', () => { outgoing.writeHead(502); outgoing.end() }); incoming.pipe(upstream)
  })
  t.after(() => { edge.closeAllConnections(); edge.close() })
  await new Promise((resolve, reject) => { edge.once('error', reject); edge.listen(0, '127.0.0.1', resolve) })
  const throughEdge = ({ path = '/healthz', authority = host, method = 'GET', body } = {}) => new Promise((resolve, reject) => {
    const request = tlsRequest({ hostname: '127.0.0.1', servername: host, port: edge.address().port, ca: cert, method, path, headers: { host: authority, 'x-forwarded-host': host, origin, 'content-type': 'application/json' } }, response => {
      response.resume(); response.once('end', () => resolve(response.statusCode))
    })
    request.once('error', reject); request.end(body)
  })
  assert.equal(await throughEdge(), 200)
  assert.equal(await throughEdge({ path: '/readyz' }), 503)
  assert.equal(await throughEdge({ path: '/v1/session' }), 503)
  assert.equal(await throughEdge({ authority: 'forged.example.test' }), 400)
  assert.equal(await throughEdge({ path: '/v1/flows', method: 'POST', body: 'x'.repeat(4097) }), 400)
  assert.equal(await throughEdge({ path: '/v1/flows', method: 'POST', body: '{}' }), 503)
})

test('malformed public deployment origin fails startup without logging its value', () => {
  const marker = 'private_fixture_marker_never_print'
  const result = spawnSync(process.execPath, ['dist/src/main.js'], { encoding: 'utf8', env: { PATH: process.env.PATH, IDENTITY_RUNTIME_ENABLED: 'false', IDENTITY_RUNTIME_PUBLIC_ORIGIN: marker } })
  assert.equal(result.status, 1); assert(!result.stdout.includes(marker)); assert(!result.stderr.includes(marker))
})

test('enabled configuration cannot disagree with deployment origin or reach provider/DB setup', () => {
  const issuer = 'https://fixture.clerk.accounts.dev'
  const config = { applicationId: 'identity-fixture', environment: 'development', issuer, publishableKey: 'pk_test_' + Buffer.from(new URL(issuer).host + '$').toString('base64url'), origin: 'https://different.example.test', targets: { sg2: { applicationId: 'spendguru', origin: 'https://consumer.example.test', routes: { home: '/' } } } }
  const result = spawnSync(process.execPath, ['dist/src/main.js'], { encoding: 'utf8', env: { PATH: process.env.PATH, IDENTITY_RUNTIME_ENABLED: 'true', IDENTITY_RUNTIME_PUBLIC_ORIGIN: 'https://identity-fixture.onrender.com', IDENTITY_RUNTIME_CONFIGURATION: JSON.stringify(config) } })
  assert.equal(result.status, 1); assert.equal(result.stdout, ''); assert(result.stderr.includes('configuration unavailable'))
})
