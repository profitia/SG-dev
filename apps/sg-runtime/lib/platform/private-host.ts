import { FORECAST_REQUEST_PROJECTION, forecastRequestResourceId, projectForecastRequest, readForecastRequest } from '@/lib/forecast/request-operation'
import { FORECAST_VERIFICATION_PROJECTION, readForecastVerificationSelection, forecastVerificationResourceId, projectForecastVerificationResponse } from './forecast-verification'
import { FORECAST_READINESS_PROJECTION, readForecastReadinessSelection, forecastReadinessResourceId, projectForecastReadinessResponse } from './forecast-readiness'
import type { Prisma, PrismaClient } from '@prisma/client'
import { createPrivateOperationHost } from '@profitia/platform-contracts/private-operation-host'
import { createClerkIdentityAuthenticator, type ClerkIdentityClient, type IdentityApplication } from '@profitia/platform-contracts/identity-provider'
import type { AccessQuery, AccessStoreBinding } from '@profitia/platform-contracts/access-store'
import { OperationDenied, type Application, type OperationContext } from '@profitia/platform-contracts/operation-context'
import { projectSupplierSummaryResponse, readSupplierSummarySelection, SUPPLIER_SUMMARY_PROJECTION } from './supplier-summary'
import { FORECAST_CURRENT_PROJECTION, forecastCurrentResourceId, readForecastCurrentSelection, projectForecastCurrentResponse } from './forecast-current'
import { CATEGORY_PROJECTION, categoryOperation, categoryResourceId, projectCategoryResponse, readCategoryOperation } from '@/lib/category/operation-contract'
import { MARKET_PREVIEW_PROJECTION, MARKET_ANALYTICS_PROJECTION, marketPreviewResourceId, marketAnalyticsResourceId,
  readMarketPreviewSelection, projectMarketPreviewResponse, projectMarketAnalyticsResponse, type MarketReadRepresentation } from './market-preview'

type QueryClient = Pick<Prisma.TransactionClient, '$queryRawUnsafe' | '$executeRawUnsafe'>

/** A consumer must distinguish the verified native publication from an old
 * deployment at the same URL. These nonsecret facts come from the admitted
 * server context, never caller headers; failed OUTCOME still withholds output. */
function nativeReadPublication(project: (value: unknown, context: Readonly<OperationContext>) => Promise<Response>, projection: string, feature: 'forecast' | 'market' = 'forecast') {
  return async (value: unknown, context: Readonly<OperationContext>) => {
    const result = await project(value, context)
    result.headers.set('X-Profitia-Operation-Contract', `${context.contractId}@${context.contractVersion}`)
    result.headers.set('X-Profitia-Application', context.applicationId)
    result.headers.set('X-Profitia-Environment', context.environment)
    result.headers.set(`X-Profitia-${feature}-Projection`, projection)
    result.headers.set(`X-Profitia-${feature}-Resource`, context.resourceId)
    return result
  }
}

// SQL is supplied only by the accepted access-store, never by an HTTP caller.
const queryFor = (client: QueryClient): AccessQuery => async (sql, values = []) => {
  // append_audit returns PostgreSQL void, which Prisma cannot deserialize.
  // Execute that unchanged statement without requesting a decoded result set.
  if (/^\s*SELECT\b/i.test(sql) && sql !== 'SELECT profitia_access.append_audit($1::jsonb)') {
    return { rows: await client.$queryRawUnsafe<Record<string, unknown>[]>(sql, ...values) }
  }
  await client.$executeRawUnsafe(sql, ...values)
  return { rows: [] }
}

/** Explicit composition for the existing selection API. No demo fallback or
 * environment switch activates it. The host supplies its official Clerk client,
 * ordinary Prisma login and independently verified deployment configuration. */
type Sg2PrivateHostOptions = {
  prisma: PrismaClient
  /** Separate native pool; reserve its connections within the role's total
   * budget so business transactions cannot exhaust audit capacity. */
  auditPrisma: PrismaClient
  clerk: ClerkIdentityClient
  application: Application
  identity: IdentityApplication
  binding: AccessStoreBinding
  /** Required accepted module boundary; no base-only path to this private store. */
  module: { id: 'benchmark' | 'supplier_report' | 'category'; schemaDigest: string; auditSchemaDigest: string }
  transactionTimeoutMs?: number
  now?: () => number
}
type NativeHostOptions = Parameters<typeof createPrivateOperationHost<Prisma.TransactionClient>>[0]
function hostBase(options: Sg2PrivateHostOptions, moduleId: Sg2PrivateHostOptions['module']['id'], operations: readonly string[]): Omit<NativeHostOptions, 'readResources' | 'projectOutput'> {
  const { prisma, auditPrisma, clerk, now } = options
  const application = structuredClone(options.application)
  const identity = structuredClone(options.identity)
  const binding = structuredClone(options.binding)
  if (!auditPrisma || auditPrisma === prisma || !options.module || options.module.id !== moduleId || application.appId !== 'spendguru' || binding.applicationId !== application.appId
    || identity.appId !== application.appId || identity.environment !== application.environment
    || identity.issuer !== application.identityIssuer || binding.environment !== application.environment
    || application.operations.some(operation => !operations.includes(operation))) {
    throw new TypeError('Explicit consistent SG2 module host configuration required')
  }
  return {
    application, binding, module: options.module, now, transactionTimeoutMs: options.transactionTimeoutMs,
    independentQuery: queryFor(auditPrisma),
    transact: (work, limits) => prisma.$transaction(transaction => work({
      transaction, query: queryFor(transaction),
    }), { timeout: limits.timeoutMs, maxWait: limits.maxWaitMs }),
    createAuthenticator: ({ resolveBinding }) => createClerkIdentityAuthenticator({
      client: clerk, application: identity, resolveBinding, now,
    }),
  }
}

export function createSg2PrivateBenchmarkHost(options: Sg2PrivateHostOptions & { module: { id: 'benchmark'; schemaDigest: string; auditSchemaDigest: string } }) {
  return createPrivateOperationHost<Prisma.TransactionClient>({
    ...hostBase(options, 'benchmark', ['benchmark.selection.read','benchmark.selection.write']),
    readResources: async ({ request, scope }) => {
      if (!scope.organisationId || request.resourceId !== `benchmark-selections:${scope.organisationId}`) {
        throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
      }
      return { resource: {
        id: request.resourceId, type: 'benchmark_selection', dataClass: 'ORGANISATION_PRIVATE',
        environment: scope.environment, ownerOrganisationId: scope.organisationId, ownerUserId: null,
        version: 'benchmark-collection-v1', projectionVersion: 'sg2-benchmark-response-v1',
      } }
    },
    projectOutput: async (value, context) => {
      if (!(value instanceof Response) || !value.ok) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
      const body: unknown = await value.clone().json()
      if (!body || typeof body !== 'object') throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
      const items: unknown[] = 'items' in body && Array.isArray(body.items) ? body.items : [body]
      if (items.some(item => !item || typeof item !== 'object' || !('organizationId' in item)
        || item.organizationId !== context.organisationId)) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
      return value
    },
  })
}

/** Prepared global market data; a selection grant never supplies this right. */
export function createSg2PrivateMarketHost(options:Sg2PrivateHostOptions & {module:{id:'benchmark';schemaDigest:string;auditSchemaDigest:string}}, representation:MarketReadRepresentation='preview') {
  if (!['preview','analytics'].includes(representation)) throw new TypeError('Explicit stored market representation required')
  const environment=options.application.environment
  const projection=representation==='preview'?MARKET_PREVIEW_PROJECTION:MARKET_ANALYTICS_PROJECTION
  const resourceId=representation==='preview'?marketPreviewResourceId:marketAnalyticsResourceId
  return createPrivateOperationHost<Prisma.TransactionClient>({
    ...hostBase(options,'benchmark',['knowledge.read']),
    readResources:async({request})=>{
      const selected=readMarketPreviewSelection(request.payload)
      if(request.resourceId!==resourceId(selected.seriesName))throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
      return{resource:{id:request.resourceId,type:'market_knowledge',dataClass:'SHARED_KNOWLEDGE',
        environment,ownerOrganisationId:null,ownerUserId:null,approvedSharedProjection:true,
        version:projection,projectionVersion:projection}}
    },
    projectOutput:nativeReadPublication(representation==='preview'?projectMarketPreviewResponse:projectMarketAnalyticsResponse, projection, 'market'),
  })
}

/** Same native driver, identity adapter and common executor; this module has
 * its own current binding/grant/product and cannot access benchmark rows. */
export function createSg2SupplierSummaryHost(options: Sg2PrivateHostOptions & { module: { id: 'supplier_report'; schemaDigest: string; auditSchemaDigest: string } }) {
  if (options.application.operations.length !== 1) throw new TypeError('Explicit supplier read configuration required')
  return createPrivateOperationHost<Prisma.TransactionClient>({
    ...hostBase(options, 'supplier_report', ['supplier.report.read']),
    readResources: async ({ request, scope }) => {
      const selection = readSupplierSummarySelection(request.payload)
      if (!scope.organisationId || request.resourceId !== `supplier-report:${selection.entityType}:${selection.nip}`) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
      return { resource: { id: request.resourceId, type: 'supplier_report', dataClass: 'SHARED_KNOWLEDGE',
        environment: scope.environment, ownerOrganisationId: null, ownerUserId: null, approvedSharedProjection: true,
        version: SUPPLIER_SUMMARY_PROJECTION, projectionVersion: SUPPLIER_SUMMARY_PROJECTION } }
    },
    projectOutput: projectSupplierSummaryResponse,
  })
}

/** Existing category business service, same ordinary native pool and authority.
 * Reference catalog SELECT is explicitly part of category composition; this
 * grants no benchmark-selection API, catalog write or supplier operation. */
export function createSg2PrivateCategoryHost(options: Sg2PrivateHostOptions & {
  module: { id: 'category'; schemaDigest: string; auditSchemaDigest: string }; categoryBoundaryDigest: string
}) {
  const digest = options.categoryBoundaryDigest
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new TypeError('Accepted private category boundary required')
  return createPrivateOperationHost<Prisma.TransactionClient>({
    ...hostBase(options, 'category', ['category.read','category.write']),
    readResources: async ({ request, scope, query }) => {
      const selected = readCategoryOperation(request.payload)
      if (!scope.organisationId || request.operation !== categoryOperation(selected)
        || request.resourceId !== categoryResourceId(selected, scope.organisationId)) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
      const installed = await query("SELECT source_ref FROM profitia_category.installation WHERE singleton AND schema_version='1.0.0' AND boundary_digest=$1", [digest])
      if (!installed || installed.rows.length !== 1 || typeof installed.rows[0].source_ref !== 'string'
        || !installed.rows[0].source_ref.length || installed.rows[0].source_ref.length > 256) throw new OperationDenied('POLICY_UNAVAILABLE')
      return { resource: { id: request.resourceId, type: 'category', dataClass: 'ORGANISATION_PRIVATE',
        environment: scope.environment, ownerOrganisationId: scope.organisationId, ownerUserId: null,
        // Representation/collection versions, not an optimistic-lock promise.
        version: selected.action === 'list' ? 'category-collection-v1' : 'category-item-envelope-v1', projectionVersion: CATEGORY_PROJECTION } }
    },
    projectOutput: projectCategoryResponse,
    describeOutcome: async value => {
      if (!(value instanceof Response)) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
      const body = await value.clone().json()
      return Array.isArray(body.items) && body.items.length === 0 ? 'NO_DATA' : 'SUCCEEDED'
    },
  })
}

/** Stored global statistical artifact; benchmark/knowledge selection grants do
 * not supply forecast.read. Resource identity is server-derived. */
export function createSg2PrivateForecastCurrentHost(options: Sg2PrivateHostOptions & { module: { id: 'benchmark'; schemaDigest: string; auditSchemaDigest: string } }) {
  const environment = options.application.environment
  return createPrivateOperationHost<Prisma.TransactionClient>({
    ...hostBase(options, 'benchmark', ['forecast.read']),
    readResources: async ({ request }) => {
      const selected = readForecastCurrentSelection(request.payload)
      if (request.resourceId !== forecastCurrentResourceId(selected)) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
      return { resource: { id: request.resourceId, type: 'market_forecast', dataClass: 'SHARED_KNOWLEDGE',
        environment, ownerOrganisationId: null, ownerUserId: null, approvedSharedProjection: true,
        version: FORECAST_CURRENT_PROJECTION, projectionVersion: FORECAST_CURRENT_PROJECTION } }
    },
    projectOutput: nativeReadPublication(projectForecastCurrentResponse, FORECAST_CURRENT_PROJECTION),
    describeOutcome: async value => {
      if (!(value instanceof Response)) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
      const body = await value.clone().json()
      return body.status === 'AVAILABLE' ? 'SUCCEEDED' : 'NO_DATA'
    },
  })
}

/** Same current authority and forecast grant; a separate result contract and
 * scope identity prevent Current/FAST/FULL/RECENT output substitution. */
export function createSg2PrivateForecastVerificationHost(options: Sg2PrivateHostOptions & { module: { id: 'benchmark'; schemaDigest: string; auditSchemaDigest: string } }) {
  const environment=options.application.environment
  return createPrivateOperationHost<Prisma.TransactionClient>({
    ...hostBase(options,'benchmark',['forecast.read']),
    readResources:async({request})=>{
      const selection=readForecastVerificationSelection(request.payload)
      if(request.resourceId!==forecastVerificationResourceId(selection))throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
      return {resource:{id:request.resourceId,type:'market_forecast',dataClass:'SHARED_KNOWLEDGE',environment,ownerOrganisationId:null,ownerUserId:null,
        approvedSharedProjection:true,version:FORECAST_VERIFICATION_PROJECTION,projectionVersion:FORECAST_VERIFICATION_PROJECTION}}
    },
    projectOutput:nativeReadPublication(projectForecastVerificationResponse, FORECAST_VERIFICATION_PROJECTION),
    describeOutcome:async value=>{
      if(!(value instanceof Response))throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
      return (await value.clone().json()).status==='AVAILABLE'?'SUCCEEDED':'NO_DATA'
    },
  })
}

/** Shared preparedness facts require their own exact representation identity;
 * Current or Verification resource/projection authority cannot be substituted. */
export function createSg2PrivateForecastReadinessHost(options: Sg2PrivateHostOptions & { module: { id: 'benchmark'; schemaDigest: string; auditSchemaDigest: string } }) {
  return createPrivateOperationHost<Prisma.TransactionClient>({
    ...hostBase(options, 'benchmark', ['forecast.read']),
    readResources: async ({ request }) => {
      const selection = readForecastReadinessSelection(request.payload)
      if (request.resourceId !== forecastReadinessResourceId(selection)) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
      return { resource: { id: request.resourceId, type: 'market_forecast', dataClass: 'SHARED_KNOWLEDGE',
        environment: options.application.environment, ownerOrganisationId: null, ownerUserId: null,
        approvedSharedProjection: true, version: FORECAST_READINESS_PROJECTION, projectionVersion: FORECAST_READINESS_PROJECTION } }
    },
    projectOutput: nativeReadPublication(projectForecastReadinessResponse, FORECAST_READINESS_PROJECTION),
    describeOutcome: async value => {
      if (!(value instanceof Response)) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
      return (await value.clone().json()).sourceAvailability === 'AVAILABLE' ? 'SUCCEEDED' : 'NO_DATA'
    },
  })
}

/** Acceptance only. The shared host owns quota and current permission; this
 * product adapter binds the unchanged typed command and private SQL receipt. */
export function createSg2PrivateForecastRequestHost(options: Sg2PrivateHostOptions & {
  module: { id: 'benchmark'; schemaDigest: string; auditSchemaDigest: string }
  requestLedgerDigest: string; commandBoundaryDigest: string
}) {
  if (!/^[a-f0-9]{64}$/.test(options.requestLedgerDigest) || !/^[a-f0-9]{64}$/.test(options.commandBoundaryDigest)
    || options.application.operations.length !== 1) throw new TypeError('Accepted private request/command boundary required')
  const commandBoundaryDigest = options.commandBoundaryDigest
  return createPrivateOperationHost<Prisma.TransactionClient>({
    ...hostBase(options, 'benchmark', ['forecast.request']), requestLedger: { schemaDigest: options.requestLedgerDigest },
    readResources: async ({ actor, request, scope, query }) => {
      const command = await readForecastRequest(request.payload)
      if (actor.kind !== 'HUMAN' || !scope.organisationId || !scope.userId
        || request.resourceId !== forecastRequestResourceId(command)) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
      const receipt = await query("SELECT source_ref FROM profitia_forecast_requests.installation WHERE singleton AND schema_version='1.0.0' AND boundary_digest=$1", [commandBoundaryDigest])
      if (receipt.rows.length !== 1 || typeof receipt.rows[0].source_ref !== 'string'
        || !receipt.rows[0].source_ref.length || receipt.rows[0].source_ref.length > 256) throw new OperationDenied('POLICY_UNAVAILABLE')
      return { resource: { id: request.resourceId, type: 'forecast_request', dataClass: 'OPERATION_AUDIT',
        environment: scope.environment, ownerOrganisationId: scope.organisationId, ownerUserId: scope.userId,
        version: 'sg2-private-command-v1', projectionVersion: FORECAST_REQUEST_PROJECTION } }
    },
    projectOutput: projectForecastRequest,
  })
}
