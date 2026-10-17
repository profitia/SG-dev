import { createClerkClient } from '@clerk/backend'
import { readClerkConfiguration, IdentityConfigurationUnavailable } from '@profitia/platform-contracts/clerk-configuration'
import type { IdentityApplication } from '@profitia/platform-contracts/identity-provider'

export { IdentityConfigurationUnavailable }
type EnvironmentInput = Readonly<Record<string, string | undefined>>
export type SrmIdentityRuntime = Readonly<{ provider: 'legacy_demo' } | {
  provider: 'clerk'; publishableKey: string; application: Readonly<IdentityApplication>
}>

/** Deployment-owned selection only. Explicit incomplete Clerk mode never falls back. */
export function readSrmIdentityRuntime(env: EnvironmentInput = process.env): SrmIdentityRuntime {
  const provider = env.PROFITIA_AUTH_PROVIDER ?? 'legacy_demo'
  if (provider === 'legacy_demo') return Object.freeze({ provider })
  if (provider !== 'clerk') throw new IdentityConfigurationUnavailable()
  let authorizedParties: unknown
  try { authorizedParties = JSON.parse(env.PROFITIA_CLERK_AUTHORIZED_PARTIES ?? '') }
  catch { throw new IdentityConfigurationUnavailable() }
  const config = readClerkConfiguration({ applicationId: 'srm', environment: env.TARGET_ENVIRONMENT,
    issuer: env.PROFITIA_CLERK_ISSUER, publishableKey: env.PROFITIA_CLERK_PUBLISHABLE_KEY,
    secretKey: env.PROFITIA_CLERK_SECRET_KEY, authorizedParties })
  return Object.freeze({ provider, ...config })
}

export function createSrmClerkClient(env: EnvironmentInput = process.env) {
  const config = readSrmIdentityRuntime(env)
  if (config.provider !== 'clerk') throw new IdentityConfigurationUnavailable()
  try { return createClerkClient({ publishableKey: config.publishableKey, secretKey: env.PROFITIA_CLERK_SECRET_KEY, telemetry: { disabled: true } }) }
  catch { throw new IdentityConfigurationUnavailable() }
}
