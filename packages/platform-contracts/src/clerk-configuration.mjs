import { createHash } from 'node:crypto'

export const CLERK_CONFIGURATION_CONTRACT = Object.freeze({ id: 'profitia.clerk-configuration', version: '1.0.0' })
export class IdentityConfigurationUnavailable extends Error {
  constructor() { super('Identity configuration unavailable'); this.name = 'IdentityConfigurationUnavailable' }
}
function unavailable() { throw new IdentityConfigurationUnavailable() }
function exactOrigin(value) {
  try {
    const url = new URL(value)
    return url.origin === value && !url.username && !url.password && !url.hostname.includes('*') &&
      (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname)))
  } catch { return false }
}

/** The host supplies deployment-owned values. The output is a CLOSED public
 * configuration: no backend credential, DB URL, user, org, role or permission.
 * Valid syntax does not prove key validity or authenticate a session. */
export function readClerkConfiguration(input) {
  if (typeof window !== 'undefined' || !input || Object.getPrototypeOf(input) !== Object.prototype) unavailable()
  const { applicationId, environment, issuer, publishableKey, secretKey, authorizedParties } = input
  if (typeof applicationId !== 'string' || !/^[a-z][a-z0-9_-]{0,127}$/.test(applicationId) ||
      !['development','staging','production'].includes(environment) || !exactOrigin(issuer) || !issuer.startsWith('https:') ||
      !Array.isArray(authorizedParties) || !authorizedParties.length || authorizedParties.length > 16 ||
      authorizedParties.some(value => typeof value !== 'string' || !exactOrigin(value)) || new Set(authorizedParties).size !== authorizedParties.length ||
      typeof publishableKey !== 'string' || !/^pk_(test|live)_[A-Za-z0-9_-]+$/.test(publishableKey) ||
      typeof secretKey !== 'string' || !/^sk_(test|live)_[A-Za-z0-9_-]+$/.test(secretKey)) unavailable()
  const test = publishableKey.startsWith('pk_test_')
  if (test !== secretKey.startsWith('sk_test_') || test !== (environment === 'development') ||
      (environment !== 'development' && (new URL(issuer).hostname.endsWith('.accounts.dev') || authorizedParties.some(value => !value.startsWith('https:'))))) unavailable()
  const frontendHost = Buffer.from(publishableKey.replace(/^pk_(test|live)_/, ''), 'base64url').toString('utf8')
  if (frontendHost !== `${new URL(issuer).host}$`) unavailable()
  return Object.freeze({ publishableKey, application: Object.freeze({ appId: applicationId, environment, issuer, authorizedParties: Object.freeze([...authorizedParties]) }) })
}

export async function clerkConfigurationSourceDigest() {
  const fs = await import('node:fs')
  return createHash('sha256').update(fs.readFileSync(new URL('./clerk-configuration.mjs', import.meta.url)))
    .update(fs.readFileSync(new URL('./clerk-configuration.d.mts', import.meta.url))).digest('hex')
}
