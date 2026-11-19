import type pg from 'pg'
import { createOrganisationOnboardingDraftBackend, normalizeOnboardingDraftPatch, organisationOnboardingSchemaDigest, OrganisationProfileError, type OnboardingDraft, type OnboardingDraftPatch } from '@profitia/platform-contracts/organisation-profile'
import { ProfileConflict } from '@profitia/platform-contracts/user-profile'
import type { IdentityProvisioningOptions } from '@profitia/platform-contracts/identity-provisioning'
import type { AccessQuery } from '@profitia/platform-contracts/access-store'
import { BoundaryError, type RuntimeConfiguration, type RuntimeSdk } from './contracts.js'
import { checkRequest } from './session-boundary.js'
import { readConfiguration } from './config.js'
import { verifiedEmailClient, type accountTransactions } from './account-provisioning.js'

export interface OrganisationDraftSurface {
  ready(): Promise<void>
  read(request: Request): Promise<OnboardingDraft>
  update(request: Request, input: unknown): Promise<OnboardingDraft>
}

/** Source opt-in only. A flag cannot install SQL, grant a policy or create a tenant. */
export function readOrganisationDraftOptIn(env: Readonly<Record<string, string | undefined>>): string | null {
  const flag = env.IDENTITY_ORGANISATION_DRAFT_ENABLED
  if (flag !== undefined && !['true', 'false'].includes(flag)) throw Error('INVALID_ORGANISATION_DRAFT_FLAG')
  if (flag !== 'true') return null
  if (env.IDENTITY_RUNTIME_ENABLED !== 'true' || env.IDENTITY_SELF_SERVICE_ENABLED !== 'true'
    || env.IDENTITY_ORGANISATION_DRAFT_SCHEMA_DIGEST !== organisationOnboardingSchemaDigest()) throw Error('ORGANISATION_DRAFT_CONFIGURATION_REQUIRED')
  return env.IDENTITY_ORGANISATION_DRAFT_SCHEMA_DIGEST
}

/** Native HTTP adapter over the shared account-self draft backend. Identity,
 * SQL attestation, Root, audit and optimistic writes remain with that backend.
 * This endpoint accepts neither a user/organisation ID nor registry company data.
 * An embedded consumer needs its separately admitted receiver, not CORS here. */
export function createOrganisationDraftSurface(options: {
  configuration: RuntimeConfiguration; client: RuntimeSdk
  binding: IdentityProvisioningOptions<pg.PoolClient>['binding']; schemaDigest: string; proofKey: Uint8Array
  onboardingSchemaDigest: string; transact: ReturnType<typeof accountTransactions>; independentQuery: AccessQuery
  deploymentId: string; configurationVersion: string; now?: () => number
}): OrganisationDraftSurface {
  if (options.onboardingSchemaDigest !== organisationOnboardingSchemaDigest()) throw Error('ORGANISATION_DRAFT_SCHEMA_REQUIRED')
  const configuration = readConfiguration(options.configuration)
  if (configuration.environment !== 'development') throw Error('ORGANISATION_DRAFT_DEVELOPMENT_ONLY')
  const backend = (request?: Request) => createOrganisationOnboardingDraftBackend({
    client: verifiedEmailClient(options.client), binding: options.binding, schemaDigest: options.schemaDigest, proofKey: options.proofKey,
    independentQuery: options.independentQuery, ...(options.now ? { now: options.now } : {}),
    transact: (action, limits) => options.transact(action, limits, request?.signal),
    identityApplication: { appId: configuration.applicationId, environment: configuration.environment, issuer: configuration.issuer,
      authorizedParties: [configuration.origin] },
    application: { appId: configuration.applicationId, profileId: 'SPENDGURU_SAAS', environment: configuration.environment,
      deploymentId: options.deploymentId, configurationVersion: options.configurationVersion, identityIssuer: configuration.issuer,
      organisationId: null, features: ['account'], operations: ['account.settings.read', 'account.settings.write'] },
  })
  async function checked<T>(action: () => Promise<T>): Promise<T> {
    try { return await action() } catch (error) {
      if (error instanceof ProfileConflict) throw new BoundaryError(409, 'PROFILE_VERSION_CONFLICT')
      if (error instanceof OrganisationProfileError) throw new BoundaryError(400, error.code)
      if (error instanceof BoundaryError) throw error
      const reason = (error as { reasonCode?: string })?.reasonCode
      if (reason === 'UNVERIFIED_IDENTITY') throw new BoundaryError(401, 'ACCOUNT_REQUIRED')
      if (reason && reason !== 'POLICY_UNAVAILABLE') throw new BoundaryError(403, 'ONBOARDING_ACCESS_DENIED')
      throw new BoundaryError(503, 'ONBOARDING_UNAVAILABLE')
    }
  }
  // Fail invalid application/backend construction before any HTTP request.
  backend()
  return Object.freeze({
    ready: () => backend().ready(),
    async read(request: Request) {
      checkRequest(request, configuration)
      return checked(() => backend(request).readCurrentDraft(request))
    },
    async update(request: Request, input: unknown) {
      checkRequest(request, configuration, true)
      if (!input || typeof input !== 'object' || Object.getPrototypeOf(input) !== Object.prototype
        || Reflect.ownKeys(input).length !== Object.keys(input).length
        || Object.values(Object.getOwnPropertyDescriptors(input)).some(d => !('value' in d) || !d.enumerable)
        || Object.keys(input).sort().join(',') !== 'expectedVersion,patch') throw new BoundaryError(400, 'INVALID_ONBOARDING_DRAFT')
      const value = input as { expectedVersion: unknown; patch: unknown }
      if (typeof value.expectedVersion !== 'string' || !/^(0|[1-9][0-9]{0,18})$/.test(value.expectedVersion)
        || BigInt(value.expectedVersion) > 9223372036854775806n) throw new BoundaryError(400, 'INVALID_ONBOARDING_DRAFT')
      const expectedVersion = value.expectedVersion
      return checked(async () => {
        normalizeOnboardingDraftPatch(value.patch)
        return backend(request).saveCurrentDraft(request, { expectedVersion, patch: value.patch as OnboardingDraftPatch })
      })
    },
  })
}
