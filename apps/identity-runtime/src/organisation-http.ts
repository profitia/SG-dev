import type { OrganisationOnboardingApi, OnboardingSnapshot } from './organisation-onboarding.js'
import type pg from 'pg'
import {createPeerOperationVerifier,hasVerifiedPeerOperation,type PeerOperationConfiguration} from '@profitia/platform-contracts/peer-operation'
import { createOrganisationBootstrapBackend, organisationBootstrapSchemaDigest, type OrganisationCreationReceipt, type StoredCompanyRecord } from '@profitia/platform-contracts/organisation-bootstrap'
import { organisationOnboardingSchemaDigest, OrganisationProfileError } from '@profitia/platform-contracts/organisation-profile'
import { ProfileConflict } from '@profitia/platform-contracts/user-profile'
import type { OperationContext } from '@profitia/platform-contracts/operation-context'
import type { IdentityProvisioningOptions } from '@profitia/platform-contracts/identity-provisioning'
import type { AccessQuery } from '@profitia/platform-contracts/access-store'
import { BoundaryError, type RuntimeConfiguration, type RuntimeSdk } from './contracts.js'
import { readConfiguration } from './config.js'
import { checkRequest } from './session-boundary.js'
import { verifiedEmailClient, type accountTransactions } from './account-provisioning.js'

export function checkOrganisationConversationRequest(request:Request,configuration:RuntimeConfiguration,write:boolean){
 const url=new URL(request.url)
 if(hasVerifiedPeerOperation(request)&&url.origin===configuration.origin&&!url.search&&!url.hash
  &&((!write&&request.method==='GET'&&url.pathname==='/v1/account/organisation-onboarding/snapshot')||(write&&request.method==='POST'&&url.pathname==='/v1/account/organisation-onboarding/access')))return
 checkRequest(request,configuration,write)
}

/** Each port owns current verified-account authorization and its original
 * transaction/audit. Merely supplying a view cannot create an organisation. */
export interface OrganisationConversationSurface {
  ready(): Promise<void>
  synchroniseAccess?(request:Request,input:unknown):Promise<Readonly<{status:'SYNCHRONISED'|'PENDING_PACKAGE'|'RECONCILIATION_REQUIRED';expiresAt?:string;organisationId?:string}>>
  snapshot(request: Request): Promise<OnboardingSnapshot>
  lookupCompany(request: Request, input: unknown): ReturnType<OrganisationOnboardingApi['lookupCompany']>
  checkSlug(request: Request, input: unknown): ReturnType<OrganisationOnboardingApi['checkSlug']>
  savePersonalCategories(request: Request, input: unknown): ReturnType<OrganisationOnboardingApi['savePersonalCategories']>
  sendInvitations(request: Request, input: unknown): ReturnType<OrganisationOnboardingApi['sendInvitations']>
  activation(request: Request): ReturnType<OrganisationOnboardingApi['activation']>
}

export interface OrganisationHttpSurface {
  verifyWorkspacePeer?(request:Request):Promise<boolean>
  readonly conversation?: OrganisationConversationSurface
  acceptInvitation?(request: Request, input: unknown): Promise<Readonly<{status:string}>>
  ready(): Promise<void>
  complete(request: Request, input: unknown): Promise<OrganisationCreationReceipt>
}

/** Opt-in is configuration, never SQL installation or permission to acquire a source. */
export function readOrganisationBootstrapOptIn(env: Readonly<Record<string, string | undefined>>): string | null {
  const flag = env.IDENTITY_ORGANISATION_BOOTSTRAP_ENABLED
  if (flag !== undefined && !['true', 'false'].includes(flag)) throw Error('INVALID_ORGANISATION_BOOTSTRAP_FLAG')
  if (flag !== 'true') return null
  if (env.IDENTITY_RUNTIME_ENABLED !== 'true' || env.IDENTITY_SELF_SERVICE_ENABLED !== 'true'
    || env.IDENTITY_ORGANISATION_DRAFT_ENABLED !== 'true'
    || env.IDENTITY_ORGANISATION_DRAFT_SCHEMA_DIGEST !== organisationOnboardingSchemaDigest()
    || env.IDENTITY_ORGANISATION_BOOTSTRAP_SCHEMA_DIGEST !== organisationBootstrapSchemaDigest()) throw Error('ORGANISATION_BOOTSTRAP_CONFIGURATION_REQUIRED')
  return env.IDENTITY_ORGANISATION_BOOTSTRAP_SCHEMA_DIGEST
}

/** Same-receiver native adapter. The company reader is a governed stored snapshot
 * port; this operation never calls a paid provider, installs a grant or selects a
 * tenant from browser input. Atomic creation and replay stay in the shared SDK. */
export function createOrganisationHttpSurface(options: {
  workspacePeer?:PeerOperationConfiguration
  conversation?: OrganisationConversationSurface
  acceptInvitation?: OrganisationHttpSurface['acceptInvitation']
  configuration: RuntimeConfiguration; client: RuntimeSdk
  binding: IdentityProvisioningOptions<pg.PoolClient>['binding']; schemaDigest: string; proofKey: Uint8Array
  bootstrapSchemaDigest: string; transact: ReturnType<typeof accountTransactions>; independentQuery: AccessQuery
  deploymentId: string; configurationVersion: string; now?: () => number
  readVerifiedCompany(input: Readonly<{ nip: string; context: Readonly<OperationContext> }>): Promise<StoredCompanyRecord | null>
}): OrganisationHttpSurface {
  if (options.bootstrapSchemaDigest !== organisationBootstrapSchemaDigest()) throw Error('ORGANISATION_BOOTSTRAP_SCHEMA_REQUIRED')
  if (options.conversation && !['ready','snapshot','lookupCompany','checkSlug','savePersonalCategories','sendInvitations','activation'].every(key => typeof (options.conversation as unknown as Record<string, unknown>)[key] === 'function')) throw Error('ORGANISATION_CONVERSATION_PORTS_REQUIRED')
  const configuration = readConfiguration(options.configuration)
  const workspacePeer=options.workspacePeer
  if(workspacePeer&&(workspacePeer.targetOrigin!==configuration.origin||workspacePeer.receiverApplicationId!==configuration.applicationId
   ||workspacePeer.routes.length!==2||workspacePeer.routes.some(r=>!((r.method==='GET'&&r.path==='/v1/account/organisation-onboarding/snapshot'&&r.maximumRequestBytes===0)||(r.method==='POST'&&r.path==='/v1/account/organisation-onboarding/access'&&r.maximumRequestBytes===2))||r.requireIdempotencyKey)))throw Error('EXACT_WORKSPACE_PEER_REQUIRED')
  const verifyWorkspacePeer=workspacePeer?createPeerOperationVerifier(workspacePeer):undefined
  if (configuration.environment !== 'development') throw Error('ORGANISATION_BOOTSTRAP_DEVELOPMENT_ONLY')
  const backend = (request?: Request) => createOrganisationBootstrapBackend({
    client: verifiedEmailClient(options.client), binding: options.binding, schemaDigest: options.schemaDigest, proofKey: options.proofKey,
    independentQuery: options.independentQuery, readVerifiedCompany: options.readVerifiedCompany, ...(options.now ? { now: options.now } : {}),
    transact: (run, limits) => options.transact(run, limits, request?.signal),
    identityApplication: { appId: configuration.applicationId, environment: configuration.environment, issuer: configuration.issuer, authorizedParties: [configuration.origin] },
    application: { appId: configuration.applicationId, profileId: 'SPENDGURU_SAAS', environment: configuration.environment,
      deploymentId: options.deploymentId, configurationVersion: options.configurationVersion, identityIssuer: configuration.issuer,
      organisationId: null, features: ['organisation_admin'], operations: ['organisation.create'] },
  })
  backend()
  return Object.freeze({
    ...(verifyWorkspacePeer?{verifyWorkspacePeer}:{}),
    ...(options.conversation ? {conversation: options.conversation} : {}),
    ...(options.acceptInvitation ? {acceptInvitation:options.acceptInvitation} : {}),
    async ready() { await backend().ready(); await options.conversation?.ready() },
    async complete(request: Request, input: unknown) {
      checkRequest(request, configuration, true)
      if (!input || typeof input !== 'object' || Object.getPrototypeOf(input) !== Object.prototype
        || Reflect.ownKeys(input).length !== Object.keys(input).length
        || Object.values(Object.getOwnPropertyDescriptors(input)).some(d => !('value' in d) || !d.enumerable)
        || Object.keys(input).sort().join(',') !== 'commandId,draftVersion') throw new BoundaryError(400, 'INVALID_ORGANISATION_COMMAND')
      const value = input as { commandId: unknown; draftVersion: unknown }
      if (typeof value.commandId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value.commandId)
        || typeof value.draftVersion !== 'string' || !/^(0|[1-9][0-9]{0,18})$/.test(value.draftVersion)
        || BigInt(value.draftVersion) > 9223372036854775806n) throw new BoundaryError(400, 'INVALID_ORGANISATION_COMMAND')
      try {
        return await backend(request).completeCurrentOrganisation(request, { commandId: value.commandId, draftVersion: value.draftVersion })
      } catch (error) {
        if (error instanceof ProfileConflict) throw new BoundaryError(409, 'PROFILE_VERSION_CONFLICT')
        if (error instanceof OrganisationProfileError) throw new BoundaryError(400, error.code)
        if (error instanceof BoundaryError) throw error
        const reason = (error as { reasonCode?: string })?.reasonCode
        if (reason === 'UNVERIFIED_IDENTITY') throw new BoundaryError(401, 'ACCOUNT_REQUIRED')
        if (['PERMISSION_DENIED', 'ACCESS_BASIS_INVALID', 'EXPLICIT_DENY', 'PRODUCT_UNAVAILABLE'].includes(reason ?? '')) throw new BoundaryError(403, 'ONBOARDING_ACCESS_DENIED')
        throw new BoundaryError(503, 'ONBOARDING_UNAVAILABLE')
      }
    },
  })
}
