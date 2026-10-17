import type { Prisma, PrismaClient } from '@prisma/client'
import { createPrivateOperationHost } from '@profitia/platform-contracts/private-operation-host'
import { createClerkIdentityAuthenticator, type ClerkIdentityClient, type IdentityApplication } from '@profitia/platform-contracts/identity-provider'
import type { AccessQuery, AccessStoreBinding } from '@profitia/platform-contracts/access-store'
import { OperationDenied, type Application } from '@profitia/platform-contracts/operation-context'

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
export function createSg2PrivateBenchmarkHost(options: {
  prisma: PrismaClient
  /** Separate native pool; reserve its connections within the role's total
   * budget so business transactions cannot exhaust audit capacity. */
  auditPrisma: PrismaClient
  clerk: ClerkIdentityClient
  application: Application
  identity: IdentityApplication
  binding: AccessStoreBinding
  transactionTimeoutMs?: number
  now?: () => number
}) {
  const { prisma, auditPrisma, clerk, now } = options
  const application = structuredClone(options.application)
  const identity = structuredClone(options.identity)
  const binding = structuredClone(options.binding)
  if (!auditPrisma || auditPrisma === prisma || application.appId !== 'spendguru' || binding.applicationId !== application.appId
    || identity.appId !== application.appId || identity.environment !== application.environment
    || identity.issuer !== application.identityIssuer || binding.environment !== application.environment
    || application.operations.some(operation => !['benchmark.selection.read', 'benchmark.selection.write'].includes(operation))) {
    throw new TypeError('Explicit consistent SG2 benchmark host configuration required')
  }
  return createPrivateOperationHost<Prisma.TransactionClient>({
    application, binding, now, transactionTimeoutMs: options.transactionTimeoutMs,
    independentQuery: queryFor(auditPrisma),
    transact: (work, limits) => prisma.$transaction(transaction => work({
      transaction, query: queryFor(transaction),
    }), { timeout: limits.timeoutMs, maxWait: limits.maxWaitMs }),
    createAuthenticator: ({ resolveBinding }) => createClerkIdentityAuthenticator({
      client: clerk, application: identity, resolveBinding, now,
    }),
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
