import assert from 'node:assert/strict'
import test from 'node:test'
import { IncomingMessage } from 'node:http'
import { Socket } from 'node:net'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { NodeNextRequest } from 'next/dist/server/base-http/node.js'
import { NextRequestAdapter } from 'next/dist/server/web/spec-extension/adapters/next-request.js'
import { addRequestMeta } from 'next/dist/server/request-meta.js'
import { createPublicIdentityRequestBoundary, publicIdentityRequestSourceDigest } from '@profitia/platform-contracts/public-request'
import { readSrmPrivateReportConfiguration } from './private-runtime'
import targets from '../../deployment/private-runtime-targets.json'

const publicOrigin = 'https://srm-development-runtime.onrender.com'
test('the actual SRM Next adapter carries the bind URL and the shared boundary admits only the pinned public host', t => {
  const socket = new Socket(); t.after(() => socket.destroy())
  const incoming = new IncomingMessage(socket)
  incoming.method = 'GET'; incoming.url = '/api/xray/financial-summary?nip=public-fixture'
  incoming.headers = { host: new URL(publicOrigin).host, origin: publicOrigin }
  addRequestMeta(incoming, 'initURL', 'https://0.0.0.0:10000' + incoming.url)
  const request = NextRequestAdapter.fromNodeNextRequest(new NodeNextRequest(incoming), new AbortController().signal)
  assert.equal(new URL(request.url).origin, 'https://0.0.0.0:10000')
  const normalize = createPublicIdentityRequestBoundary({ publicOrigins: [publicOrigin], internalOrigins: ['https://0.0.0.0:10000'] })
  assert.equal(normalize(request)!.url, publicOrigin + incoming.url)
  request.headers.set('host', 'foreign.example.test')
  assert.equal(normalize(request), null)
})
test('the bound SRM runtime explicitly configures the one shared identity request adapter for all human hosts', () => {
  const target = targets.environments.development, issuer = 'https://fixture.clerk.accounts.dev'
  const url = new URL('postgresql://local.invalid'); url.hostname = target.hosts[0]
  url.username = target.runtimeRole; url.password = 'synthetic_fixture_only'; url.pathname = '/' + target.databaseName; url.search = '?sslmode=require'
  const config = readSrmPrivateReportConfiguration({ PROFITIA_AUTH_PROVIDER: 'clerk', TARGET_ENVIRONMENT: 'development',
    PROFITIA_CLERK_ISSUER: issuer, PROFITIA_CLERK_PUBLISHABLE_KEY: 'pk_test_' + Buffer.from(new URL(issuer).host + '$').toString('base64url'),
    PROFITIA_CLERK_SECRET_KEY: 'sk_test_fixture', PROFITIA_CLERK_AUTHORIZED_PARTIES: JSON.stringify([publicOrigin]),
    PROFITIA_PRIVATE_DATABASE_URL: url.toString(), PROFITIA_FIXED_ORGANISATION_ID: '11111111-1111-4111-8111-111111111111',
    PROFITIA_OPERATION_CONFIGURATION_VERSION: targets.configurationVersion, RENDER_SERVICE_ID: target.serviceId,
    RENDER_GIT_COMMIT: 'a'.repeat(40), SRM_DEMO_SESSION_SECRET: 'synthetic_preference_scope_secret_only_32' })
  assert.equal(config.provider, 'clerk'); if (config.provider !== 'clerk') throw Error('Expected explicit Clerk runtime')
  assert.deepEqual(config.identity.requestBoundary, { publicOrigins: [publicOrigin], internalOrigins: ['http://0.0.0.0:10000', 'https://0.0.0.0:10000'] })
})
test('the public identity adoption preserves historical receipts and pins the entire current SRM closure', async () => {
  const receipt = JSON.parse(readFileSync(new URL('../../operation-integration.json', import.meta.url), 'utf8'))
  const adoption = receipt.publicIdentityRequestAdoption
  assert.equal(adoption.taskId, 'SRM-E1-CONTROLLED-DEVELOPMENT-RELEASE-20261020')
  assert.equal(adoption.previousApplicationAuthority, '05a7d705e1aeeae04465e59b371ea0cd5a0d4c06')
  assert.equal(adoption.producer.projectKey, 'ARCHITECTURE'); assert.equal(adoption.producer.sourceSha, '74df44d1f0d6df66e358bd432ebd80c3c955f70a')
  assert.equal(adoption.sdkDigest, await publicIdentityRequestSourceDigest())
  const previous = JSON.parse(execFileSync('git', ['show', adoption.previousApplicationAuthority + ':apps/srm/operation-integration.json'], { encoding: 'utf8' }))
  for (const [key, value] of Object.entries(previous)) assert.deepEqual(['contract','producer'].includes(key) ? receipt.supplierLocationSourceCompatibility.previousRootAcceptance[key] : receipt[key], value, key)
  for (const [path, digest] of Object.entries(adoption.sourceDigests)) {
    assert.equal(createHash('sha256').update(execFileSync('git', ['show', 'c82d400ab53783376fefecd487131b0ef6812ad8:apps/srm/' + path])).digest('hex'), digest, path)
  }
  assert.equal(adoption.productDeploymentPerformed, false)
})
