import test from 'node:test'
import assert from 'node:assert/strict'
import { createPublicIdentityRequestBoundary, bindPublicIdentityAuthenticator } from '../src/public-request.mjs'
import { createClerkIdentityAuthenticator } from '../src/identity-provider.mjs'

const origin = 'https://srm-development.example.test'
const internal = 'https://0.0.0.0:10000'
const configuration = () => ({ publicOrigins: [origin], internalOrigins: [internal] })
const request = (url = internal + '/api/xray/search', headers = {}) => new Request(url, {
  method: 'POST', headers: { host: new URL(origin).host, origin, ...headers }, body: '{"identifier":"public-fixture"}' })

test('explicit Next standalone internal authority becomes the exact public identity authority without consuming business data', async () => {
  const original = request(), normalize = createPublicIdentityRequestBoundary(configuration())
  const result = normalize(original)
  assert.equal(result.url, origin + '/api/xray/search')
  assert.equal(result.method, 'POST'); assert.equal(result.headers.get('origin'), origin)
  assert.equal(original.bodyUsed, false); assert.equal(result.body, null)
  assert.equal(await original.text(), '{"identifier":"public-fixture"}')
  assert.equal(normalize(original).url, result.url, 'already consumed body is not reused')
})
test('public requests remain public and proxy headers never select an authority', () => {
  const normalize = createPublicIdentityRequestBoundary(configuration())
  for (const url of [origin + '/api/read?x=1', internal + '/api/read?x=1']) {
    const result = normalize(request(url, { 'x-forwarded-host': 'evil.example.test', 'x-forwarded-proto': 'http', 'x-forwarded-port': '81', 'cloudfront-forwarded-proto': 'http', forwarded: 'host=evil.example.test' }))
    assert.equal(result.url, origin + '/api/read?x=1')
    for (const name of ['forwarded', 'x-forwarded-host', 'x-forwarded-proto', 'x-forwarded-port', 'cloudfront-forwarded-proto']) assert.equal(result.headers.has(name), false)
    assert.equal(result.headers.get('host'), new URL(origin).host)
  }
  assert.equal(normalize(new Request(origin + '/api/read')).url, origin + '/api/read')
})
for (const [label, url, headers] of [
  ['foreign internal origin', 'https://10.0.0.1:10000/api', {}],
  ['wrong internal protocol', 'http://0.0.0.0:10000/api', {}],
  ['foreign public host', undefined, { host: 'evil.example.test' }],
  ['multiple hosts', undefined, { host: 'srm-development.example.test,evil.example.test' }],
  ['host userinfo', undefined, { host: 'user@srm-development.example.test' }],
  ['host path', undefined, { host: 'srm-development.example.test/path' }],
  ['host port', undefined, { host: 'srm-development.example.test:443' }],
  ['cross site origin', undefined, { origin: 'https://evil.example.test' }],
  ['public URL with inconsistent host', origin + '/api', { host: 'evil.example.test' }],
  ['URL fragment', internal + '/api#fragment', {}],
]) test('identity boundary rejects ' + label, () => {
  assert.equal(createPublicIdentityRequestBoundary(configuration())(request(url, headers)), null)
})
test('internal requests require exact Host; a forwarded host cannot replace it', () => {
  assert.equal(createPublicIdentityRequestBoundary(configuration())(new Request(internal + '/api', { headers: { 'x-forwarded-host': new URL(origin).host } })), null)
  assert.throws(() => request('https://name@0.0.0.0:10000/api'), TypeError, 'the standard Request constructor rejects URL credentials before normalization')
})
test('path and query cannot replace authority and abort remains observable', () => {
  const controller = new AbortController(), normalize = createPublicIdentityRequestBoundary(configuration())
  const original = new Request(internal + '//evil.example.test/a?redirect=https://evil.example.test', { headers: { host: new URL(origin).host }, signal: controller.signal })
  const result = normalize(original)
  assert.equal(new URL(result.url).origin, origin); assert.equal(new URL(result.url).pathname, '//evil.example.test/a')
  controller.abort(); assert.equal(result.signal.aborted, true); assert.equal(normalize(original), null)
})
test('configuration is explicit, unambiguous, snapshotted and cannot nominate arbitrary internal networks', () => {
  for (const input of [null, {}, { ...configuration(), extra: true }, { publicOrigins: [], internalOrigins: [internal] },
    { publicOrigins: [origin, origin], internalOrigins: [internal] }, { publicOrigins: [origin], internalOrigins: ['https://10.0.0.1:10000'] },
    { publicOrigins: [origin + '/path'], internalOrigins: [internal] }, { publicOrigins: [origin], internalOrigins: [origin] },
    { publicOrigins: [origin, origin.replace('https:', 'http:')], internalOrigins: [internal] }]) {
    assert.throws(() => createPublicIdentityRequestBoundary(input), TypeError)
  }
  const config = configuration(), normalize = createPublicIdentityRequestBoundary(config)
  config.publicOrigins[0] = 'https://evil.example.test'; config.internalOrigins[0] = 'https://10.0.0.1:10000'
  assert.equal(normalize(request()).url, origin + '/api/xray/search')
  assert.equal(normalize({ url: origin }), null)
})
test('normalization grants no actor and preserves the official authenticator refusal for missing identity and cookie-only mutations', async () => {
  let calls = 0
  const authenticate = createClerkIdentityAuthenticator({
    application: { appId: 'srm', environment: 'development', issuer: 'https://fixture.clerk.accounts.dev', authorizedParties: [origin] },
    client: { authenticateRequest: async () => { calls++; return { status: 'signed-out', isAuthenticated: false } },
      sessions: { getSession: async () => assert.fail('no verified session') }, users: { getUser: async () => assert.fail('no verified user') } },
    resolveBinding: async () => assert.fail('no verified binding'),
  })
  const normalize = createPublicIdentityRequestBoundary(configuration())
  assert.equal(await authenticate(normalize(request())), null); assert.equal(calls, 1)
  assert.equal(await authenticate(normalize(new Request(internal + '/api', { method: 'POST', headers: { host: new URL(origin).host, cookie: 'opaque' } }))), null)
  assert.equal(calls, 1)
})
test('the binding cannot invoke the verifier for an invalid authority or turn its refusal into an actor', async () => {
  let calls = 0
  const authenticate = bindPublicIdentityAuthenticator(async value => { calls++; assert.equal(new URL(value.url).origin, origin); return null }, configuration())
  assert.equal(await authenticate(request(undefined, { host: 'evil.example.test' })), null); assert.equal(calls, 0)
  assert.equal(await authenticate(request()), null); assert.equal(calls, 1)
  assert.throws(() => bindPublicIdentityAuthenticator(null, configuration()), TypeError)
})
