import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { accountBrowserScript } from '../dist/src/account-page.js'

async function failedAccountPage({ en = false, flow = 'login', signOutFails = false, statusCode = 503, errorCode = 'IDENTITY_UNAVAILABLE' } = {}) {
  const nodes = new Map(), events = new Map(), calls = []
  const route = en ? 'account-en' : 'account-pl'
  const signInUrl = `https://identity.example.test/account/sg2/${route}/login`
  const cfg = { en, flow, signInUrl, signUpUrl: signInUrl.replace(/login$/, 'registration') }
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {
      hidden: false, textContent: id === 'account-config' ? JSON.stringify(cfg) : '', replaceChildren() {},
    })
    return nodes.get(id)
  }
  const document = { getElementById: node, body: { classList: { add() {}, remove() {} } } }
  const window = {
    document,
    location: { origin: 'https://identity.example.test', pathname: `/account/sg2/${route}/${flow}`,
      search: '?redirect_url=https%3A%2F%2Funtrusted.example.test', replace() { throw Error('Unexpected redirect') } },
    __internal_ClerkUICtor: class {}, addEventListener: (name, callback) => events.set(name, callback),
  }
  let accountSignal, conversations = 0, requests = 0, listener
  window.Clerk = {
    session: { id: 'sess_test_account', getToken: async () => 'synthetic-test-token' },
    user: { id: 'user_test_account', unsafeMetadata: {} }, load: async () => {}, addListener(callback) { listener = callback },
    async signOut(options) {
      calls.push(options)
      if (signOutFails) throw Error('Synthetic provider outage')
      window.Clerk.session = null
    },
  }
  const fetch = async (path, options) => {
    assert.equal(path, '/v1/account')
    accountSignal = options.signal; requests++
    return Response.json({ error: errorCode }, { status: statusCode })
  }
  vm.runInNewContext(accountBrowserScript, {
    window, document, fetch, Response, Request, URL, DOMException, AbortController,
    Date, JSON, Intl, navigator: { languages: [en ? 'en' : 'pl'], language: en ? 'en' : 'pl' },
    setTimeout, clearTimeout,
  }, { timeout: 1000 })
  window.startSpendGuruConversation = () => { conversations++ }
  await events.get('load')()
  if (statusCode === 503) assert.equal(node('retry').hidden, false)
  return { node, calls, signInUrl, window, get accountSignal() { return accountSignal },
    get conversations() { return conversations }, get requests() { return requests }, notify: () => listener() }
}

test('sign-out after account preparation fails returns to the canonical login for the same locale', async t => {
  for (const en of [false, true]) for (const flow of ['login', 'registration']) {
    await t.test(`${en ? 'en' : 'pl'} ${flow}`, async () => {
      const f = await failedAccountPage({ en, flow })
      await f.node('logout').onclick()
      assert.equal(f.calls.length, 1)
      assert.equal(f.calls[0]?.redirectUrl, f.signInUrl)
      assert.deepEqual(Object.keys(f.calls[0]), ['redirectUrl'])
      assert.equal(f.window.Clerk.session, null)
      assert.equal(f.accountSignal.aborted, true)
      assert.equal(f.conversations, 1)
    })
  }
})

test('a rejected sign-out retains the retryable error instead of presenting a signed-out session', async () => {
  const f = await failedAccountPage({ signOutFails: true })
  await f.node('logout').onclick()
  assert.equal(f.calls.length, 1)
  assert.equal(f.calls[0]?.redirectUrl, f.signInUrl)
  assert.notEqual(f.window.Clerk.session, null)
  assert.equal(f.node('status').textContent, 'Wylogowanie nie zostało potwierdzone. Spróbuj ponownie.')
  assert.equal(f.node('logout').hidden, false)
  assert.equal(f.node('retry').hidden, true)
  assert.equal(f.accountSignal.aborted, true)
  assert.equal(f.conversations, 0)
})


for (const en of [false, true]) for (const flow of ['login', 'registration']) for (const errorCode of ['ACCOUNT_REQUIRED', 'VERIFIED_EMAIL_REQUIRED']) {
  test('known account denial has no retry or protected navigation: ' + JSON.stringify({ en, flow, errorCode }), async () => {
    const f = await failedAccountPage({ en, flow, statusCode: 401, errorCode })
    assert.equal(f.node('retry').hidden, true)
    assert.equal(f.node('logout').hidden, false)
    assert.equal(f.node('status').hidden, false)
    assert.match(f.node('status').textContent, en ? /Sign out and sign in again/ : /Wyloguj się i zaloguj ponownie/)
    assert.equal(f.requests, 1); assert.equal(f.conversations, 0)
    f.notify(); await Promise.resolve()
    assert.equal(f.requests, 1)
  })
}
