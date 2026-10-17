import { createClerkClient } from '@clerk/backend'
import { readClerkConfiguration, IdentityConfigurationUnavailable } from '@profitia/platform-contracts/clerk-configuration'
import type { IdentityApplication } from '@profitia/platform-contracts/identity-provider'

export { IdentityConfigurationUnavailable }
type EnvironmentInput = Readonly<Record<string, string | undefined>>
export type Sg2IdentityRuntime = Readonly<{ provider: 'legacy_demo' } | {
  provider: 'clerk'; publishableKey: string; application: Readonly<IdentityApplication>
}>

/** Deployment-owned selection only. Explicit incomplete Clerk mode never falls back. */
export function readSg2IdentityRuntime(env: EnvironmentInput = process.env): Sg2IdentityRuntime {
  const provider = env.PROFITIA_AUTH_PROVIDER ?? 'legacy_demo'
  if (provider === 'legacy_demo') return Object.freeze({ provider })
  if (provider !== 'clerk') throw new IdentityConfigurationUnavailable()
  let authorizedParties: unknown
  try { authorizedParties = JSON.parse(env.PROFITIA_CLERK_AUTHORIZED_PARTIES ?? '') }
  catch { throw new IdentityConfigurationUnavailable() }
  const config = readClerkConfiguration({ applicationId: 'spendguru', environment: env.TARGET_ENVIRONMENT,
    issuer: env.PROFITIA_CLERK_ISSUER, publishableKey: env.PROFITIA_CLERK_PUBLISHABLE_KEY,
    secretKey: env.PROFITIA_CLERK_SECRET_KEY, authorizedParties })
  return Object.freeze({ provider, ...config })
}

export function createSg2ClerkClient(env: EnvironmentInput = process.env) {
  const config = readSg2IdentityRuntime(env)
  if (config.provider !== 'clerk') throw new IdentityConfigurationUnavailable()
  try { return createClerkClient({ publishableKey: config.publishableKey, secretKey: env.PROFITIA_CLERK_SECRET_KEY, telemetry: { disabled: true } }) }
  catch { throw new IdentityConfigurationUnavailable() }
}
