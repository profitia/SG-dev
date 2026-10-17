import { createHash } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import type { Prisma } from '@prisma/client'
import type { Application, OperationExecutor } from '@profitia/platform-contracts/operation-context'
import type { AccessStoreBinding } from '@profitia/platform-contracts/access-store'
import type { IdentityApplication } from '@profitia/platform-contracts/identity-provider'
import targets from '@/deployment/private-runtime-targets.json'
import { createSg2ClerkClient, IdentityConfigurationUnavailable, readSg2IdentityRuntime } from './identity-runtime'
import { createSg2PrivateBenchmarkHost, createSg2SupplierSummaryHost, createSg2PrivateCategoryHost, createSg2PrivateMarketHost } from './private-host'
import { createStoredMarketHistoryReader,type StoredMarketBinding } from '@/lib/market-data/stored-read'
import type { BenchmarkPreviewResult,BenchmarkRangePreset } from '@/lib/benchmark/contracts'

type EnvironmentInput = Readonly<Record<string, string | undefined>>
export type Sg2SelectionRuntime = Readonly<{ provider: 'legacy_demo' } | {
  provider: 'clerk'; executor: OperationExecutor<Prisma.TransactionClient>; defaultOrganisationId: string
  supplierSummary?: Readonly<{ executor: OperationExecutor<Prisma.TransactionClient>; origin: string }>
  category?: Readonly<{ executor: OperationExecutor<Prisma.TransactionClient> }>
  marketRead?: Readonly<{ executor: OperationExecutor<Prisma.TransactionClient>; preview:(selection:{seriesName:string;range:BenchmarkRangePreset})=>Promise<BenchmarkPreviewResult> }>
}>
type PrivateConfiguration = Readonly<{
  provider: 'clerk'; databaseUrl: string; application: Application; identity: IdentityApplication
  binding: AccessStoreBinding; module: { id: 'benchmark'; schemaDigest: string; auditSchemaDigest: string }
  supplierSummary?: Readonly<{ origin: string; configurationVersion: string }>
  category?: Readonly<{ configurationVersion: string; boundaryDigest: string }>
  marketRead?: Readonly<{configurationVersion:string;databaseUrl:string;binding:StoredMarketBinding}>
}>
function unavailable(): never { throw new IdentityConfigurationUnavailable() }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Server configuration only. No request/claim/body selects a database, role,
 * fixed organisation or application profile. Syntax is not a login proof. */
export function readSg2PrivateSelectionConfiguration(env: EnvironmentInput = process.env): Readonly<{ provider: 'legacy_demo' }> | PrivateConfiguration {
  if (typeof window !== 'undefined') unavailable()
  const identity = readSg2IdentityRuntime(env)
  if (identity.provider === 'legacy_demo') return Object.freeze({ provider: 'legacy_demo' })
  // The new private Staging/Production bindings are deliberately not invented.
  if (identity.application.environment !== 'development') unavailable()
  const target = targets.environments.development
  for (const flag of ['PROFITIA_SUPPLIER_SUMMARY_ENABLED','PROFITIA_CATEGORY_ENABLED','PROFITIA_MARKET_READ_ENABLED']) {
    if (env[flag] !== undefined && !['true','false'].includes(env[flag]!)) unavailable()
  }
  if (env.PROFITIA_OPERATION_CONFIGURATION_VERSION !== targets.configurationVersion
    || env.RENDER_SERVICE_ID !== target.serviceId || !/^[a-f0-9]{40}$/.test(env.RENDER_GIT_COMMIT ?? '')
    || (env.APP_ENV !== undefined && env.APP_ENV !== identity.application.environment)
    || !uuid.test(env.PROFITIA_FIXED_ORGANISATION_ID ?? '')) unavailable()
  const input = env.PROFITIA_PRIVATE_DATABASE_URL
  if (!input || input !== input.trim()) unavailable()
  let url: URL
  try { url = new URL(input) } catch { return unavailable() }
  if (!['postgresql:', 'postgres:'].includes(url.protocol) || !target.hosts.includes(url.hostname)
    || url.username !== target.runtimeRole || !url.password || (url.port && url.port !== '5432')
    || url.pathname !== `/${target.databaseName}` || url.hash
    || [...url.searchParams.keys()].some(key => !['sslmode', 'channel_binding'].includes(key))
    || url.searchParams.getAll('sslmode').length !== 1 || url.searchParams.get('sslmode') !== 'require'
    || url.searchParams.getAll('channel_binding').length > 1
    || (url.searchParams.has('channel_binding') && url.searchParams.get('channel_binding') !== 'require')) unavailable()
  let marketRead:PrivateConfiguration['marketRead']
  if(env.PROFITIA_MARKET_READ_ENABLED==='true') {
    const source=target.marketRead, input=env.PROFITIA_MARKET_READ_DATABASE_URL
    if(!input||input!==input.trim())unavailable()
    let marketUrl:URL
    try{marketUrl=new URL(input)}catch{return unavailable()}
    if(!['postgresql:','postgres:'].includes(marketUrl.protocol)||!source.hosts.includes(marketUrl.hostname)
      ||marketUrl.username!==source.runtimeRole||!marketUrl.password||(marketUrl.port&&marketUrl.port!=='5432')
      ||marketUrl.pathname!==`/${source.databaseName}`||marketUrl.hash
      ||[...marketUrl.searchParams.keys()].some(key=>!['sslmode','channel_binding'].includes(key))
      ||marketUrl.searchParams.getAll('sslmode').length!==1||marketUrl.searchParams.get('sslmode')!=='require'
      ||marketUrl.searchParams.getAll('channel_binding').length>1
      ||(marketUrl.searchParams.has('channel_binding')&&marketUrl.searchParams.get('channel_binding')!=='require'))unavailable()
    marketRead={configurationVersion:source.configurationVersion,databaseUrl:marketUrl.toString(),
      binding:{projectId:source.projectId,branchId:source.branchId,databaseName:source.databaseName,role:source.runtimeRole,schemaDigest:source.schemaDigest}}
  }
  const configuration: PrivateConfiguration = { provider: 'clerk', databaseUrl: url.toString(), identity: identity.application,
    application: { appId: 'spendguru', profileId: 'PORR_SUITE', environment: 'development',
      deploymentId: `${target.serviceId}:${env.RENDER_GIT_COMMIT}`, configurationVersion: targets.configurationVersion,
      identityIssuer: identity.application.issuer, organisationId: env.PROFITIA_FIXED_ORGANISATION_ID!,
      operations: ['benchmark.selection.read', 'benchmark.selection.write'], features: ['benchmark'] },
    binding: { applicationId: 'spendguru', environment: 'development', projectId: target.projectId,
      branchId: target.branchId, databaseName: target.databaseName, role: target.runtimeRole, schemaDigest: target.accessSchemaDigest },
    module: { id: 'benchmark', schemaDigest: target.moduleSchemaDigest, auditSchemaDigest: target.auditSchemaDigest },
    ...(marketRead?{marketRead}:{}),
    ...(env.PROFITIA_CATEGORY_ENABLED === 'true' ? { category: {
      configurationVersion: target.category.configurationVersion, boundaryDigest: target.category.boundaryDigest,
    } } : {}),
    ...(env.PROFITIA_SUPPLIER_SUMMARY_ENABLED === 'true' ? { supplierSummary: {
      origin: target.supplierSummary.origin, configurationVersion: target.supplierSummary.configurationVersion,
    } } : {}),
  }
  return Object.freeze(configuration)
}

function poolUrl(base: string, limit: number, schemaName=targets.environments.development.schemaName) {
  const url = new URL(base)
  url.searchParams.set('schema', schemaName)
  url.searchParams.set('sslaccept', 'strict')
  url.searchParams.set('connection_limit', String(limit))
  url.searchParams.set('pool_timeout', '3')
  url.searchParams.set('connect_timeout', '10')
  return url.toString()
}

declare global {
  // Shared server resources only; never a cached actor, lease or request.
  // eslint-disable-next-line no-var
  var __sg2PrivateSelectionRuntime__: { key: string; runtime: Sg2SelectionRuntime } | undefined
}

/** Lazy so unchanged demo builds/requests never initialize a private connection.
 * Deployment changes require restart; a running process cannot reuse an old
 * host under a different configuration. Every request authenticates anew. */
export function getSg2SelectionRuntime(env: EnvironmentInput = process.env): Sg2SelectionRuntime {
  const config = readSg2PrivateSelectionConfiguration(env)
  if (config.provider === 'legacy_demo') return config
  const key = createHash('sha256').update(JSON.stringify([config, env.PROFITIA_CLERK_SECRET_KEY])).digest('hex')
  const cached = globalThis.__sg2PrivateSelectionRuntime__
  if (cached) { if (cached.key !== key) unavailable(); return cached.runtime }
  const clerk = createSg2ClerkClient(env)
  // Three business connections plus one reserved independent audit connection
  // fit the ordinary role's total four-connection budget.
  const prisma = new PrismaClient({ datasources: { db: { url: poolUrl(config.databaseUrl, 3) } } })
  const auditPrisma = new PrismaClient({ datasources: { db: { url: poolUrl(config.databaseUrl, 1) } } })
  const executor = createSg2PrivateBenchmarkHost({ prisma, auditPrisma, clerk,
    application: config.application, identity: config.identity, binding: config.binding, module: config.module })
  const supplierSummary = config.supplierSummary ? Object.freeze({ origin: config.supplierSummary.origin,
    executor: createSg2SupplierSummaryHost({ prisma, auditPrisma, clerk, identity: config.identity, binding: config.binding,
      application: { ...config.application, configurationVersion: config.supplierSummary.configurationVersion,
        operations: ['supplier.report.read'], features: ['supplier_report'] },
      module: { ...config.module, id: 'supplier_report' } }),
  }) : undefined
  const category = config.category ? Object.freeze({ executor: createSg2PrivateCategoryHost({
    prisma, auditPrisma, clerk, identity: config.identity, binding: config.binding,
    application: { ...config.application, configurationVersion: config.category.configurationVersion,
      operations: ['category.read','category.write'], features: ['category'] },
    module: { ...config.module, id: 'category' }, categoryBoundaryDigest: config.category.boundaryDigest,
  }) }) : undefined
  const marketRead=config.marketRead?(()=>{
    const source=new PrismaClient({datasources:{db:{url:poolUrl(config.marketRead.databaseUrl,1,'profitia_market_read')}}})
    const readHistory=createStoredMarketHistoryReader(source,config.marketRead.binding)
    return Object.freeze({executor:createSg2PrivateMarketHost({prisma,auditPrisma,clerk,identity:config.identity,binding:config.binding,module:config.module,
      application:{...config.application,configurationVersion:config.marketRead.configurationVersion,operations:['knowledge.read'],features:['market']}}),
      preview:async({seriesName,range}:{seriesName:string;range:BenchmarkRangePreset})=>{
        const{getBenchmarkPreview}=await import('@/lib/benchmark/service')
        return getBenchmarkPreview(seriesName,range,readHistory)
      }})
  })():undefined
  const runtime = Object.freeze({ provider: 'clerk' as const, executor, defaultOrganisationId: config.application.organisationId!,
    ...(supplierSummary ? { supplierSummary } : {}), ...(category ? { category } : {}),...(marketRead?{marketRead}:{}) })
  globalThis.__sg2PrivateSelectionRuntime__ = { key, runtime }
  return runtime
}
