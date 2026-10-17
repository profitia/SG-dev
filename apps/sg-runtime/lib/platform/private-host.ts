import type { Prisma, PrismaClient } from '@prisma/client'
import { createPrivateOperationHost } from '@profitia/platform-contracts/private-operation-host'
import { createClerkIdentityAuthenticator, type ClerkIdentityClient, type IdentityApplication } from '@profitia/platform-contracts/identity-provider'
import type { AccessQuery, AccessStoreBinding } from '@profitia/platform-contracts/access-store'
import { OperationDenied, type Application } from '@profitia/platform-contracts/operation-context'
import { projectSupplierSummaryResponse, readSupplierSummarySelection, SUPPLIER_SUMMARY_PROJECTION } from './supplier-summary'
import { CATEGORY_PROJECTION, categoryOperation, categoryResourceId, projectCategoryResponse, readCategoryOperation } from '@/lib/category/operation-contract'
import { MARKET_PREVIEW_PROJECTION, marketPreviewResourceId, readMarketPreviewSelection, projectMarketPreviewResponse } from './market-preview'

type QueryClient = Pick<Prisma.TransactionClient, '$queryRawUnsafe' | '$executeRawUnsafe'>

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
export function createSg2PrivateMarketHost(options:Sg2PrivateHostOptions & {module:{id:'benchmark';schemaDigest:string;auditSchemaDigest:string}}) {
  const environment=options.application.environment
  return createPrivateOperationHost<Prisma.TransactionClient>({
    ...hostBase(options,'benchmark',['knowledge.read']),
    readResources:async({request})=>{
      const selected=readMarketPreviewSelection(request.payload)
      if(request.resourceId!==marketPreviewResourceId(selected.seriesName))throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
      return{resource:{id:request.resourceId,type:'market_knowledge',dataClass:'SHARED_KNOWLEDGE',
        environment,ownerOrganisationId:null,ownerUserId:null,approvedSharedProjection:true,
        version:MARKET_PREVIEW_PROJECTION,projectionVersion:MARKET_PREVIEW_PROJECTION}}
    },
    projectOutput:projectMarketPreviewResponse,
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
