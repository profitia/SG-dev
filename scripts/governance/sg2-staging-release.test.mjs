import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { exactCommitHook, releaseTarget, triggerExactRelease } from './sg2-staging-release.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const registry = JSON.parse(fs.readFileSync(path.join(root, 'Canon/registries/sg2-environment-topology-v1.json'), 'utf8'))
const sha = 'a'.repeat(40)
const identity = { registry, role: 'dashboard', sha, repository: 'profitia/SG-dev', ref: 'refs/heads/main' }
const hook = 'https://api.render.com/deploy/srv-dacln50jo6nc738lbag0?key=not-a-real-secret'

test('registered Staging identity resolves exactly one service', () => {
  assert.equal(releaseTarget(registry, 'dashboard', sha, identity.repository, identity.ref).serviceId, 'srv-dacln50jo6nc738lbag0')
  assert.throws(() => releaseTarget(registry, 'development', sha, identity.repository, identity.ref), /Unknown/)
  assert.throws(() => releaseTarget(registry, 'dashboard', sha, identity.repository, 'refs/heads/feature'), /main/)
  assert.throws(() => releaseTarget(registry, 'dashboard', 'latest', identity.repository, identity.ref), /full lowercase/)
  assert.throws(() => releaseTarget(registry, 'dashboard', sha, 'profitia/other', identity.ref), /profitia\/SG-dev/)
})

test('deploy hook must target exact registered service and exact SHA', () => {
  const exact = exactCommitHook(hook, 'srv-dacln50jo6nc738lbag0', sha)
  assert.equal(exact.searchParams.get('ref'), sha)
  assert.throws(() => exactCommitHook('', 'srv-dacln50jo6nc738lbag0', sha), /missing/)
  assert.throws(() => exactCommitHook(hook, 'srv-daclno3m8hqs73bb7rrg', sha), /does not match/)
  assert.throws(() => exactCommitHook(`${hook}&ref=main`, 'srv-dacln50jo6nc738lbag0', sha), /does not match/)
  assert.throws(() => exactCommitHook('https://example.com/deploy/srv-dacln50jo6nc738lbag0?key=x', 'srv-dacln50jo6nc738lbag0', sha), /does not match/)
})

test('fails before any network write when the SHA or hook is invalid', async () => {
  let requests = 0
  const request = async () => { requests += 1; return { status: 200, json: async () => ({ id: 'dep-good' }) } }
  await assert.rejects(triggerExactRelease({ ...identity, hook, isMainAncestor: () => false, request }), /not an ancestor/)
  await assert.rejects(triggerExactRelease({ ...identity, hook: '', isMainAncestor: () => true, request }), /missing/)
  assert.equal(requests, 0)
})

test('records deploy as triggered, not verified or accepted', async () => {
  const result = await triggerExactRelease({
    ...identity, hook, isMainAncestor: () => true,
    request: async (url, options) => {
      assert.equal(url.searchParams.get('ref'), sha)
      assert.equal(options.method, 'POST')
      return { status: 200, json: async () => ({ id: 'dep-confirmed' }) }
    },
  })
  assert.equal(result.status, 'TRIGGERED_VERIFY_REQUIRED')
  assert.equal(result.deployId, 'dep-confirmed')
})

test('queued or ambiguous provider responses fail closed', async () => {
  await assert.rejects(triggerExactRelease({ ...identity, hook, isMainAncestor: () => true,
    request: async () => ({ status: 202 }) }), /HTTP 202/)
  await assert.rejects(triggerExactRelease({ ...identity, hook, isMainAncestor: () => true,
    request: async () => ({ status: 200, json: async () => ({}) }) }), /no verifiable deploy ID/)
})
