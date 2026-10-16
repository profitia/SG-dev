// Synthetic test identity only. No deployed route imports this issuer or its keys.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export function createTestIdentityIssuer({ applicationId, environment = 'development', now = Date.now }) {
  const key = randomBytes(32)
  const issuer = 'architecture-isolated-test-issuer'
  const revoked = new Set()
  const sign = body => createHmac('sha256', key).update(body).digest('base64url')
  return {
    issuer,
    issue(userId, overrides = {}) {
      const body = Buffer.from(JSON.stringify({ kind: 'HUMAN', actorId: userId, userId, issuer, audience: applicationId, environment, expiresAt: new Date(now() + 60_000).toISOString(), proofRef: `test:${randomBytes(16).toString('hex')}`, ...overrides })).toString('base64url')
      return `${body}.${sign(body)}`
    },
    revoke(proofRef) { revoked.add(proofRef) },
    async authenticate(request) {
      if (!(request instanceof Request)) return null
      const token = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? ''
      const parts = token.split('.')
      if (parts.length !== 2) return null
      const expected = Buffer.from(sign(parts[0]))
      const actual = Buffer.from(parts[1])
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
      try {
        const actor = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
        if (revoked.has(actor.proofRef) || actor.issuer !== issuer || actor.audience !== applicationId || actor.environment !== environment || Date.parse(actor.expiresAt) <= now()) return null
        return actor
      } catch { return null }
    },
  }
}
