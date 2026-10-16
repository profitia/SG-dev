import assert from 'node:assert/strict'
import test from 'node:test'
import { createTestIdentityIssuer } from '../src/operation-test-authority.mjs'

test('isolated issuer verifies actual signature, audience and expiry; revocation is current', async () => {
  const now = () => Date.parse('2026-10-16T22:00:00Z')
  const issuer = createTestIdentityIssuer({ applicationId: 'app-a', now })
  const token = issuer.issue('user-a')
  const request = new Request('https://isolated.test', { headers: { authorization: `Bearer ${token}` } })
  const actor = await issuer.authenticate(request); assert.equal(actor.userId, 'user-a')
  const [body, signature] = token.split('.')
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, 'base64url')), userId: 'user-b' })).toString('base64url')
  assert.equal(await issuer.authenticate(new Request('https://isolated.test', { headers: { authorization: `Bearer ${forged}.${signature}` } })), null)
  issuer.revoke(actor.proofRef); assert.equal(await issuer.authenticate(request), null)
})
