import type pg from 'pg'
import { createAssistantAvatarBackend, ProfileConflict, type AssistantAvatarPreference } from '@profitia/platform-contracts/user-profile'
import type { IdentityProvisioningOptions } from '@profitia/platform-contracts/identity-provisioning'
import type { AccessQuery } from '@profitia/platform-contracts/access-store'
import { BoundaryError, type RuntimeConfiguration, type RuntimeSdk } from './contracts.js'
import { checkRequest } from './session-boundary.js'
import { readConfiguration } from './config.js'
import { verifiedEmailClient, type accountTransactions } from './account-provisioning.js'

export interface AssistantAvatarSurface {
  read(request: Request): Promise<AssistantAvatarPreference | null>
  update(request: Request, input: unknown): Promise<AssistantAvatarPreference>
}

export function createAssistantAvatarSurface(options: {
  configuration: RuntimeConfiguration; client: RuntimeSdk
  binding: IdentityProvisioningOptions<pg.PoolClient>['binding']; schemaDigest: string; proofKey: Uint8Array
  transact: ReturnType<typeof accountTransactions>; independentQuery: AccessQuery
  deploymentId: string; configurationVersion: string; now?: () => number
}): AssistantAvatarSurface {
  const configuration = readConfiguration(options.configuration)
  const peers = [...new Set(Object.values(configuration.targets).map(target => target.origin))].filter(origin => origin !== configuration.origin)
  const backend = (request: Request) => createAssistantAvatarBackend({
    client: verifiedEmailClient(options.client), binding: options.binding, schemaDigest: options.schemaDigest, proofKey: options.proofKey,
    independentQuery: options.independentQuery, ...(options.now ? { now: options.now } : {}),
    transact: (action, limits) => options.transact(action, limits, request.signal),
    identityApplication: { appId: configuration.applicationId, environment: configuration.environment, issuer: configuration.issuer,
      authorizedParties: [configuration.origin, ...peers],
      bearerPeerReads: peers.map(sourceOrigin => ({ sourceOrigin, targetOrigin: configuration.origin, path: '/v1/account/assistant-avatar' })) },
    application: { appId: configuration.applicationId, profileId: 'SPENDGURU_SAAS', environment: configuration.environment,
      deploymentId: options.deploymentId, configurationVersion: options.configurationVersion, identityIssuer: configuration.issuer,
      organisationId: null, features: ['account'], operations: ['account.settings.read', 'account.settings.write'] },
  })
  async function checked<T>(action: () => Promise<T>): Promise<T> {
    try { return await action() } catch (error) {
      if (error instanceof ProfileConflict) throw new BoundaryError(409, 'PROFILE_VERSION_CONFLICT')
      if (error instanceof BoundaryError) throw error
      const reason = (error as { reasonCode?: string })?.reasonCode
      if (reason === 'UNVERIFIED_IDENTITY') throw new BoundaryError(401, 'ACCOUNT_REQUIRED')
      if (reason && reason !== 'POLICY_UNAVAILABLE') throw new BoundaryError(403, 'PROFILE_ACCESS_DENIED')
      throw new BoundaryError(503, 'PROFILE_UNAVAILABLE')
    }
  }
  return Object.freeze({
    async read(request: Request) { checkRequest(request, configuration); return checked(() => backend(request).getAssistantAvatar(request)) },
    async update(request: Request, input: unknown) {
      checkRequest(request, configuration, true)
      if (!input || typeof input !== 'object' || Array.isArray(input)
        || Object.keys(input).sort().join(',') !== 'avatarSex,expectedVersion') throw new BoundaryError(400, 'INVALID_AVATAR_PREFERENCE')
      const value = input as { avatarSex: unknown; expectedVersion: unknown }
      if (!['male', 'female'].includes(value.avatarSex as string) || value.expectedVersion !== null && (typeof value.expectedVersion !== 'string'
        || !/^[1-9][0-9]{0,18}$/.test(value.expectedVersion) || BigInt(value.expectedVersion) > 9223372036854775807n)) throw new BoundaryError(400, 'INVALID_AVATAR_PREFERENCE')
      const avatarSex = value.avatarSex as 'male' | 'female', expectedVersion = value.expectedVersion as string | null
      return checked(async () => {
        const api = backend(request)
        if (expectedVersion !== null) return api.updateAssistantAvatar(request, { avatarSex, expectedVersion })
        // Legacy accounts can initialize their missing profile. A replay never
        // overwrites a preference that another tab has already committed.
        const profile = await api.ensureAssistantAvatar(request)
        if (profile.avatarSex !== null) return profile
        return api.updateAssistantAvatar(request, { avatarSex, expectedVersion: profile.version })
      })
    },
  })
}
