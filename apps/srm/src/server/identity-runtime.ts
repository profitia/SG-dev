import { createClerkClient } from '@clerk/backend'
import { readClerkConfiguration, IdentityConfigurationUnavailable } from '@profitia/platform-contracts/clerk-configuration'
import type { IdentityApplication } from '@profitia/platform-contracts/identity-provider'
import {instrumentSupplierIdentity} from './supplier-telemetry'

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
  try { return instrumentSupplierIdentity(createClerkClient({ publishableKey: config.publishableKey, secretKey: env.PROFITIA_CLERK_SECRET_KEY, telemetry: { disabled: true } })) }
  catch { throw new IdentityConfigurationUnavailable() }
}

/** Exact, opt-in Development consumer. No browser-selected backend or callback. */
export function readPorrAccountOrigin(env: EnvironmentInput = process.env): string | null {
  if (env.SRM_PORR_ACCOUNT_ENABLED === undefined || env.SRM_PORR_ACCOUNT_ENABLED === 'false') return null
  if (env.SRM_PORR_ACCOUNT_ENABLED !== 'true' || env.TARGET_ENVIRONMENT !== 'development'
    || env.PROFITIA_AUTH_PROVIDER !== 'clerk'
    || env.SRM_IDENTITY_ACCOUNT_ORIGIN !== 'https://identity-runtime-development.onrender.com') throw new IdentityConfigurationUnavailable()
  const identity = readSrmIdentityRuntime(env)
  if (identity.provider !== 'clerk' || !identity.application.authorizedParties.includes('https://srm-development-runtime.onrender.com')) throw new IdentityConfigurationUnavailable()
  return env.SRM_IDENTITY_ACCOUNT_ORIGIN
}
