import { createClerkClient } from '@clerk/backend'
import { readClerkConfiguration } from '@profitia/platform-contracts/clerk-configuration'
import type { RuntimeConfiguration, RuntimeSdk } from './contracts.js'
/** No SDK configuration comes from HTTP, and no provider credential is returned. */
export function createOfficialClient(configuration: RuntimeConfiguration, secretKey: string): RuntimeSdk {
  readClerkConfiguration({ applicationId: configuration.applicationId, environment: configuration.environment, issuer: configuration.issuer,
    publishableKey: configuration.publishableKey, secretKey, authorizedParties: [configuration.origin] })
  return createClerkClient({ publishableKey: configuration.publishableKey, secretKey, telemetry: { disabled: true } })
}
