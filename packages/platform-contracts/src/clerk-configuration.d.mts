import type { IdentityApplication } from './identity-provider.mjs'
export declare const CLERK_CONFIGURATION_CONTRACT: Readonly<{ id: 'profitia.clerk-configuration'; version: '1.0.0' }>
export declare class IdentityConfigurationUnavailable extends Error { constructor() }
export interface ClerkConfiguration {
  readonly publishableKey: string
  /** Frozen at runtime, including origins; uses the accepted identity adapter's shape. */
  readonly application: Readonly<IdentityApplication>
}
export declare function readClerkConfiguration(input: {
  applicationId: unknown; environment: unknown; issuer: unknown; publishableKey: unknown; secretKey: unknown; authorizedParties: unknown
}): ClerkConfiguration
export declare function clerkConfigurationSourceDigest(): Promise<string>
