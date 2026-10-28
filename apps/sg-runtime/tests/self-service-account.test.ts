import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readSelfServiceAccountConfiguration, accountCompletionUrl, readSelfServiceAccount } from '../lib/platform/account-session'

const issuer = 'https://self-service-fixture.clerk.accounts.dev', publicOrigin = 'http://localhost:3001'
const env = () => ({ PROFITIA_AUTH_PROVIDER: 'clerk', TARGET_ENVIRONMENT: 'development',
  PROFITIA_SELF_SERVICE_ENABLED: 'true', PROFITIA_SELF_SERVICE_PUBLIC_ORIGIN: publicOrigin,
  PROFITIA_SELF_SERVICE_SATELLITE_ENABLED: 'true',
  PROFITIA_IDENTITY_RUNTIME_ORIGIN: 'http://localhost:3600', PROFITIA_CLERK_ISSUER: issuer,
  PROFITIA_CLERK_PUBLISHABLE_KEY: 'pk_test_' + Buffer.from(new URL(issuer).host + '$').toString('base64url'),
  PROFITIA_CLERK_SECRET_KEY: 'sk_test_fixture', PROFITIA_CLERK_AUTHORIZED_PARTIES: JSON.stringify([publicOrigin]) })
const userA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', userB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const result = (userId = userA) => ({ authenticated: true, userId, expiresAt: new Date(Date.now() + 60000).toISOString() })
const request = (headers: HeadersInit = {}, url = publicOrigin + '/api/account', signal?: AbortSignal) => new Request(url, { headers: { authorization: 'Bearer synthetic_fixture_only', ...headers }, signal })
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
const preference = (userId = userA, avatarSex: 'male' | 'female' | null = 'female') => ({ userId, avatarSex, version: '2' })
const avatarPath = (url: unknown) => String(url).endsWith('/v1/account/assistant-avatar')
const salutationPath = (url: unknown) => String(url).endsWith('/v1/account/salutation')
const salutation = (userId = userA) => ({ userId, firstName: userId === userA ? 'Agnieszka' : 'Marek', vocative: userId === userA ? 'Agnieszko' : 'Marku', dictionaryVersion: 'dictionary-v1', version: '2' })

test('self-service default remains disabled, including existing legacy demo deployment', async () => {
  assert.equal(readSelfServiceAccountConfiguration({}), null)
  assert.equal(readSelfServiceAccountConfiguration({ PROFITIA_SELF_SERVICE_ENABLED: 'false' }), null)
  const response = await readSelfServiceAccount(request(), { env: {}, transport: () => { assert.fail('No network when disabled') } })
  assert.equal(response.status, 503)
})
test('exact locale paths always complete on central Runtime; no caller-controlled destination', () => {
  const config = readSelfServiceAccountConfiguration(env())!
  assert.equal(accountCompletionUrl(config, 'pl', 'registration'), 'http://localhost:3600/account/sg2/account-pl/registration')
  assert.equal(accountCompletionUrl(config, 'en', 'login'), 'http://localhost:3600/account/sg2/account-en/login')
})
for (const patch of [{ PROFITIA_SELF_SERVICE_ENABLED: '1' }, { PROFITIA_SELF_SERVICE_SATELLITE_ENABLED: undefined }, { PROFITIA_AUTH_PROVIDER: 'legacy_demo' }, { TARGET_ENVIRONMENT: 'staging' },
  { PROFITIA_IDENTITY_RUNTIME_ORIGIN: '//foreign.test' }, { PROFITIA_IDENTITY_RUNTIME_ORIGIN: publicOrigin }, { PROFITIA_IDENTITY_RUNTIME_ORIGIN: 'https://u:p@foreign.test' },
  { PROFITIA_SELF_SERVICE_PUBLIC_ORIGIN: 'https://foreign.test' }, { PROFITIA_CLERK_SECRET_KEY: undefined }, { PROFITIA_IDENTITY_RUNTIME_ORIGIN: 'https://foreign.test/' }]) {
  test('invalid activation configuration cannot fall back to demo: ' + JSON.stringify(patch), async () => {
    assert.throws(() => readSelfServiceAccountConfiguration({ ...env(), ...patch }))
    assert.equal((await readSelfServiceAccount(request(), { env: { ...env(), ...patch }, transport: () => { assert.fail() } })).status, 503)
  })
}
test('successful account read forwards only the bearer to the fixed GET; no cookies, origin, IDs or grants', async () => {
  let calls = 0
  const transport: typeof fetch = async (url, options) => {
    calls++; assert.equal(url, 'http://localhost:3600/v1/account' + (calls === 2 ? '/assistant-avatar' : calls === 3 ? '/salutation' : '')); assert.equal(options?.method, 'GET')
    assert.deepEqual(options?.headers, { authorization: 'Bearer synthetic_fixture_only' }); assert.equal(options?.credentials, 'omit')
    assert.equal(options?.redirect, 'error'); assert.equal(options?.cache, 'no-store'); assert.equal(options?.body, undefined)
    return json(salutationPath(url) ? salutation() : avatarPath(url) ? preference() : result())
  }
  const response = await readSelfServiceAccount(request({ cookie: 'private_cookie_must_not_leave_receiver', 'x-user-id': userB, 'x-role': 'ADMIN' }), { env: env(), transport })
  assert.equal(response.status, 200); assert.equal((await response.json()).userId, userA); assert.equal(calls, 3)
  assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.equal(response.headers.get('set-cookie'), null)
  assert.equal(response.headers.get('access-control-allow-origin'), null)
})
test('cross-account, revoked session and backend outage are independently observed; no stale account cache', async () => {
  let state = 0
  const transport: typeof fetch = async url => state === 2 ? json({}, 401) : state === 3 ? json({}, 503) : json(salutationPath(url) ? salutation(state ? userB : userA) : avatarPath(url) ? preference(state ? userB : userA, state ? 'male' : 'female') : result(state ? userB : userA))
  for (const [n, expected] of [[0, userA], [1, userB]] as const) { state = n; assert.equal((await (await readSelfServiceAccount(request(), { env: env(), transport })).json()).userId, expected) }
  state = 2; assert.equal((await readSelfServiceAccount(request(), { env: env(), transport })).status, 401)
  state = 3; assert.equal((await readSelfServiceAccount(request(), { env: env(), transport })).status, 503)
})
for (const value of [{ ...result(), userId: 'provider_a' }, { ...result(), expiresAt: new Date(0).toISOString() }, { ...result(), organisationId: userB }, { ...result(), authenticated: false }, { ...result(), role: 'ADMIN' }, { userId: userA }, null]) {
  test('incomplete, stale or overbroad backend response is not account success: ' + JSON.stringify(value), async () => {
    const response = await readSelfServiceAccount(request(), { env: env(), transport: async () => json(value) })
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { authenticated: false })
  })
}
test('untrusted origins/hosts/query/body identity cannot become a peer read or a provisioning write', async () => {
  const transport: typeof fetch = () => { assert.fail('Denied before network') }
  for (const req of [request({ origin: 'https://foreign.test' }), request({ host: 'foreign.test' }), request({}, publicOrigin + '/api/account?userId=' + userB),
    new Request(publicOrigin + '/api/account', { method: 'POST', headers: { authorization: 'Bearer synthetic_fixture_only' }, body: '{}' })]) {
    const response = await readSelfServiceAccount(req, { env: env(), transport }); assert([403, 405].includes(response.status))
  }
  assert.equal((await readSelfServiceAccount(new Request(publicOrigin + '/api/account'), { env: env(), transport })).status, 401)
})
test('shared accepted ingress normalizer validates actual Host and removes forged forwarded identity', async () => {
  const response = await readSelfServiceAccount(request({ host: 'localhost:3001', 'x-forwarded-host': 'evil.test', 'x-forwarded-proto': 'https' }, 'http://0.0.0.0:10000/api/account'),
    { env: env(), transport: async (_url, options) => { assert.deepEqual(options?.headers, { authorization: 'Bearer synthetic_fixture_only' }); return json(salutationPath(_url) ? salutation() : avatarPath(_url) ? preference() : result()) } })
  assert.equal(response.status, 200)
})
test('oversized, malformed, aborted and failed transports never expose an authenticated account', async () => {
  for (const transport of [async () => new Response('x'.repeat(5000)), async () => new Response('{'), async () => { throw Error('synthetic transport failure') }] as typeof fetch[]) {
    assert.equal((await readSelfServiceAccount(request(), { env: env(), transport })).status, 503)
  }
  const abort = new AbortController(); abort.abort()
  assert.equal((await readSelfServiceAccount(request({}, undefined, abort.signal), { env: env(), transport: () => { assert.fail() } })).status, 403)
})
test('actual HTTP peer request uses no database or mutation and preserves the explicit account response', async t => {
  const server = createServer((req, res) => { assert.equal(req.method, 'GET'); assert(['/v1/account','/v1/account/assistant-avatar','/v1/account/salutation'].includes(req.url!)); assert.equal(req.headers.cookie, undefined); assert.equal(req.headers.origin, undefined)
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(salutationPath(req.url) ? salutation() : avatarPath(req.url) ? preference() : result())) })
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r)); t.after(() => { server.closeAllConnections(); server.close() })
  const address = server.address(); assert(address && typeof address === 'object')
  const response = await readSelfServiceAccount(request(), { env: { ...env(), PROFITIA_IDENTITY_RUNTIME_ORIGIN: 'http://127.0.0.1:' + address.port } })
  assert.equal(response.status, 200); assert.equal((await response.json()).userId, userA)
})
test('new source receipt preserves every previous acceptance and pins the complete current receiver without granting adoption', () => {
  const receipt = JSON.parse(readFileSync(new URL('../operation-integration.json', import.meta.url), 'utf8'))
  const current = receipt.selfServiceAccountSourceCompatibility
  assert.equal(current.taskId, 'SG2-SELF-SERVICE-FIRST-USE-MVP-20261022')
  assert.equal(current.previousApplicationAuthority, 'a0a3b0626fac16e011b57d6284ce55abcfcd3ca3')
  const beforeBytes = execFileSync('git', ['show', current.previousApplicationAuthority + ':apps/sg-runtime/operation-integration.json'])
  assert.equal(createHash('sha256').update(beforeBytes).digest('hex'), current.previousReceiptSha256)
  const before = JSON.parse(beforeBytes.toString('utf8'))
  for (const [key, value] of Object.entries(before)) assert.deepEqual(['contract', 'producer'].includes(key) ? receipt.accountRecheckSourceCompatibility.previousRootAcceptance[key] : receipt[key], value, key)
  for (const record of ['storedReadSourceAdoption', 'categoryShellAdoption', 'categoryTransportAdoption', 'categoryIngressAdoption'])
    for (const path of Object.keys(before[record].sourceDigests)) assert(path in current.applicationSourceDigests, path)
  for (const path of Object.keys({...before.supplierLocationSourceCompatibility.applicationSourceDigests,...before.platform125SourceCompatibility.applicationSourceDigests})) assert(path in current.applicationSourceDigests, path)
  for (const [path, expected] of Object.entries({ ...current.applicationSourceDigests, ...receipt.accountRecheckSourceCompatibility.applicationSourceDigests, ...receipt.krsSoapSourceCompatibility?.applicationSourceDigests, ...receipt.assistantAvatarSourceCompatibility.applicationSourceDigests, ...receipt.unmeteredSourceCompatibility.applicationSourceDigests,...receipt.formReportSourceCompatibility.applicationSourceDigests,...receipt.requestQuotaSourceCompatibility.applicationSourceDigests,...receipt.benchmarkPresentationSourceCompatibility.applicationSourceDigests,...receipt.nativeSqlRoundtripAdoption.applicationSourceDigests,...receipt.diagnosticTelemetryAdoption.applicationSourceDigests,...receipt.appShellSourceCompatibility.applicationSourceDigests,...receipt.assistantWidgetSourceCompatibility.applicationSourceDigests,...receipt.adpPresentationSourceCompatibility.applicationSourceDigests })) {
    const observed = createHash('sha256').update(readFileSync(new URL('../' + path, import.meta.url))).digest('hex')
    assert.equal(observed, expected, path)
    assert.notEqual(createHash('sha256').update('mutated-source').digest('hex'), expected, 'Mutation must not pass: ' + path)
  }
  assert.equal(current.defaultEnabled, false); assert.equal(current.productDeploymentPerformed, false)
  assert.equal(current.organisationOrProductGrantsAdded, false); assert.equal(current.accountReadUsesExistingPeerGetOnly, true)
  assert.equal(current.producerSourceStatus, 'PROPOSED_NOT_PROMOTED')
  assert.deepEqual(receipt.operations, before.operations)
})

for (const choice of ['male', 'female', null] as const) test('canonical preference is restored without inventing a choice: ' + choice, async () => {
  const response = await readSelfServiceAccount(request(), { env: env(), transport: async url => json(salutationPath(url) ? salutation() : avatarPath(url) ? preference(userA, choice) : result()) })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).assistantAvatar, choice)
})
test('missing legacy profile returns neutral preference and performs no write', async () => {
  const response = await readSelfServiceAccount(request(), { env: env(), transport: async (url, options) => {
    assert.equal(options?.method, 'GET'); return json(salutationPath(url) || avatarPath(url) ? null : result())
  } })
  assert.equal(response.status, 200); assert.equal((await response.json()).assistantAvatar, null)
})
for (const invalid of [preference(userB), { ...preference(), phone: 'must-not-expose' }, { ...preference(), avatarSex: 'ADMIN' },
  { ...preference(), version: '0' }, { ...preference(), version: '9223372036854775808' }, { ...preference(), version: 1 }, {}, [], true]) {
  test('foreign or malformed preference fails closed: ' + JSON.stringify(invalid), async () => {
    const response = await readSelfServiceAccount(request(), { env: env(), transport: async url => json(avatarPath(url) ? invalid : result()) })
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { authenticated: false })
  })
}
for (const status of [401, 403, 500]) test('revocation or failure during preference read does not reuse account success: ' + status, async () => {
  const response = await readSelfServiceAccount(request(), { env: env(), transport: async url => avatarPath(url) ? json({}, status) : json(result()) })
  assert.equal(response.status, status === 500 ? 503 : status)
  assert.deepEqual(await response.json(), { authenticated: false })
})
test('account expiry or account switch during preference read discards the late result', async () => {
  for (const abortRequest of [false, true]) {
    const controller = new AbortController(); let expired = false
    const response = await readSelfServiceAccount(request({}, undefined, controller.signal), { env: env(), now: () => expired ? Date.now() + 120000 : Date.now(), transport: async url => {
      if (avatarPath(url)) { expired = true; if (abortRequest) controller.abort(); return json(preference()) }
      return json(result())
    } })
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { authenticated: false })
  }
})
test('oversized or malformed preference is not rendered', async () => {
  for (const body of ['x'.repeat(5000), '{']) {
    const response = await readSelfServiceAccount(request(), { env: env(), transport: async url => avatarPath(url) ? new Response(body) : json(result()) })
    assert.equal(response.status, 503)
  }
})
test('avatar receipt preserves all previous evidence and pins the separate producer', () => {
  const receipt = JSON.parse(readFileSync(new URL('../operation-integration.json', import.meta.url), 'utf8'))
  const current = receipt.assistantAvatarSourceCompatibility
  const previous = execFileSync('git', ['show', current.previousReceiptSourceSha + ':apps/sg-runtime/operation-integration.json'])
  assert.equal(createHash('sha256').update(previous).digest('hex'), current.previousReceiptSha256)
  for (const [key, value] of Object.entries(JSON.parse(previous.toString()))) assert.deepEqual(['contract','producer'].includes(key) ? receipt.unmeteredSourceCompatibility.previousRootAcceptance[key] : receipt[key], value, key)
  for (const [file, digest] of Object.entries(current.producerSourceDigests)) {
    const bytes = execFileSync('git', ['show', current.producerSourceSha + ':packages/platform-contracts/' + file])
    assert.equal(createHash('sha256').update(bytes).digest('hex'), digest, file)
  }
  assert.equal(current.liveGrantsChanged, false); assert.equal(current.productDeploymentPerformed, false)
})

for (const invalid of [salutation(userB), {...salutation(), phone: 'private'}, {...salutation(), vocative: ' Name '}, {...salutation(), firstName: null}, {...salutation(), dictionaryVersion: null}, {...salutation(), version: '0'}, {...salutation(), firstName: 'x'.repeat(161)}, {...salutation(), vocative: 'bad\u0000name'}, {}, [], true]) test('foreign or malformed salutation is not projected: ' + JSON.stringify(invalid), async () => {
  const response = await readSelfServiceAccount(request(), {env: env(), transport: async url => json(salutationPath(url) ? invalid : avatarPath(url) ? preference() : result())})
  assert.equal(response.status, 503); assert.deepEqual(await response.json(), {authenticated: false})
})
for (const status of [401, 403, 500]) test('third read observes revoked access rather than using earlier account success: ' + status, async () => {
  const response = await readSelfServiceAccount(request(), {env: env(), transport: async url => salutationPath(url) ? json({},status) : json(avatarPath(url) ? preference() : result())})
  assert.equal(response.status,status === 500 ? 503 : status); assert.deepEqual(await response.json(), {authenticated:false})
})
test('persisted vocative and avatar choice are independent and do not fall back to the name dictionary', async () => {
  const response = await readSelfServiceAccount(request(), {env:env(), transport:async url => json(salutationPath(url) ? salutation(userA) : avatarPath(url) ? preference(userA,'male') : result())})
  const body=await response.json(); assert.equal(body.salutation.vocative,'Agnieszko'); assert.equal(body.assistantAvatar,'male')
  assert.deepEqual(Object.keys(body.salutation).sort(),['dictionaryVersion','firstName','vocative'])
})

// The existing central Identity callback remains account/*; the verified client
// gate owns the final locale dashboard redirect. No new registration grant.
test('dashboard adoption preserves fixed account completion and read-only Identity contract', () => {
  const config = readSelfServiceAccountConfiguration(env())!
  for (const locale of ['pl','en'] as const) for (const mode of ['login','registration'] as const)
    assert.equal(accountCompletionUrl(config,locale,mode), `http://localhost:3600/account/sg2/account-${locale}/${mode}`)
  const guard=readFileSync(new URL('../components/auth/account-landing.tsx',import.meta.url),'utf8')
  assert(guard.includes('workspaceReady && !dashboard'));assert(guard.includes('router.replace(dashboardPath(locale))'))
  assert.equal((guard.match(/fetch\('/g)||[]).length,1);assert(guard.includes("fetch('/api/account'"))
})
