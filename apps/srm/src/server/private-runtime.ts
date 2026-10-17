import { createHash } from 'node:crypto'
import pg, { type PoolClient, type PoolConfig } from 'pg'
import type { Application, OperationExecutor } from '@profitia/platform-contracts/operation-context'
import { OperationDenied } from '@profitia/platform-contracts/operation-context'
import type { AccessStoreBinding } from '@profitia/platform-contracts/access-store'
import type { IdentityApplication } from '@profitia/platform-contracts/identity-provider'
import targets from '../../deployment/private-runtime-targets.json'
import { createSrmClerkClient, IdentityConfigurationUnavailable, readSrmIdentityRuntime } from './identity-runtime'
import { createSrmPrivateOperationHost } from './private-operation-host'
import { validateReportSelection } from './report-data'
import { validateFinancialExcelSelection } from './financial-excel'
import { restoreFinancialDocumentsFromArchive } from './financial-documents'
import { projectPrivateFinancialExcel, describePrivateFinancialExcel } from './financial-excel-runtime'

type EnvironmentInput = Readonly<Record<string, string | undefined>>
export type SrmReportRuntime = Readonly<{ provider: 'legacy_demo' } | {
  provider: 'clerk'; executor: OperationExecutor<PoolClient>; defaultOrganisationId: string
}>
type PrivateConfiguration = Readonly<{
  provider: 'clerk'; databaseUrl: string; application: Application; identity: IdentityApplication
  binding: AccessStoreBinding; module: { id: 'supplier_report'; schemaDigest: string; auditSchemaDigest: string }
}>
function unavailable(): never { throw new IdentityConfigurationUnavailable() }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Only deployment-owned intent selects a host, connection and fixed tenant.
 * Environment is independent of NODE_ENV or where the build runs. */
export function readSrmPrivateReportConfiguration(env: EnvironmentInput = process.env): Readonly<{ provider: 'legacy_demo' }> | PrivateConfiguration {
  if (typeof window !== 'undefined') unavailable()
  const identity = readSrmIdentityRuntime(env)
  if (identity.provider === 'legacy_demo') return Object.freeze({ provider: 'legacy_demo' })
  if (identity.application.environment !== 'development') unavailable()
  const target = targets.environments.development
  if (env.PROFITIA_OPERATION_CONFIGURATION_VERSION !== targets.configurationVersion
    || env.RENDER_SERVICE_ID !== target.serviceId || !/^[a-f0-9]{40}$/.test(env.RENDER_GIT_COMMIT ?? '')
    || (env.APP_ENV !== undefined && env.APP_ENV !== identity.application.environment)
    || !uuid.test(env.PROFITIA_FIXED_ORGANISATION_ID ?? '')
    || !env.SRM_DEMO_SESSION_SECRET || env.SRM_DEMO_SESSION_SECRET.length < 32) unavailable()
  const input = env.PROFITIA_PRIVATE_DATABASE_URL
  if (!input || input !== input.trim()) unavailable()
  let url: URL
  try { url = new URL(input); decodeURIComponent(url.password) } catch { return unavailable() }
  if (!['postgresql:', 'postgres:'].includes(url.protocol) || !target.hosts.includes(url.hostname)
    || url.username !== target.runtimeRole || !url.password || (url.port && url.port !== '5432')
    || url.pathname !== `/${target.databaseName}` || url.hash
    || [...url.searchParams.keys()].some(key => !['sslmode', 'channel_binding'].includes(key))
    || url.searchParams.getAll('sslmode').length !== 1 || url.searchParams.get('sslmode') !== 'require'
    || url.searchParams.getAll('channel_binding').length > 1
    || (url.searchParams.has('channel_binding') && url.searchParams.get('channel_binding') !== 'require')) unavailable()
  const config: PrivateConfiguration = { provider: 'clerk', databaseUrl: url.toString(), identity: identity.application,
    application: { appId: 'srm', profileId: 'PORR_SUITE', environment: 'development',
      deploymentId: `${target.serviceId}:${env.RENDER_GIT_COMMIT}`, configurationVersion: targets.configurationVersion,
      identityIssuer: identity.application.issuer, organisationId: env.PROFITIA_FIXED_ORGANISATION_ID!,
      operations: ['supplier.report.read', 'supplier.report.project', 'supplier.report.export'], features: ['supplier_report'] },
    binding: { applicationId: 'srm', environment: 'development', projectId: target.projectId,
      branchId: target.branchId, databaseName: target.databaseName, role: target.runtimeRole, schemaDigest: target.accessSchemaDigest },
    module: { id: 'supplier_report', schemaDigest: target.moduleSchemaDigest, auditSchemaDigest: target.auditSchemaDigest },
  }
  return Object.freeze(config)
}

/** pg connection-string SSL options replace the explicit SSL object. Parse the
 * already checked URL into fields so strict TLS cannot be silently overridden.
 * No inherited PGHOST/PGUSER/database or options may select another destination. */
export function srmPrivatePoolConfiguration(config: PrivateConfiguration, max: 1 | 3): PoolConfig {
  const url = new URL(config.databaseUrl)
  return { host: url.hostname, port: 5432, database: decodeURIComponent(url.pathname.slice(1)),
    user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
    ssl: { rejectUnauthorized: true }, enableChannelBinding: true,
    max, connectionTimeoutMillis: 3000, idleTimeoutMillis: 10000,
    statement_timeout: 15000, query_timeout: 15000, lock_timeout: 3000,
    idle_in_transaction_session_timeout: 15000,
    application_name: 'profitia-srm-private-report', options: '-c search_path=pg_catalog',
  }
}

type DriverOptions = Parameters<typeof createSrmPrivateOperationHost>[0]
/** Same report DTO and database business path in both fixture and real entry.
 * Its private resource is the org-scoped projection; its shared input is the
 * approved stored corporate financial view, including an explicit absent state.
 * KYS is not reclassified as shared by this adapter. */
export function createSrmReportOperationHost(options: Omit<DriverOptions, 'readResources' | 'projectOutput' | 'prepareInputs' | 'describeOutcome'>) {
  return createSrmPrivateOperationHost({ ...options,
    readResources: async ({ request, scope, query }) => {
      const exporting = request.operation === 'supplier.report.export'
      const selection = exporting ? { ...validateFinancialExcelSelection(request.payload), entityType: 'COMPANY' as const } : validateReportSelection(request.payload)
      const id = `supplier-report:${selection.entityType}:${selection.nip}`
      if (!scope.organisationId || request.resourceId !== id) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
      const row = (await query('SELECT financial_sha256 FROM srm.catalog_companies WHERE nip=$1 AND $2=\'COMPANY\'', [selection.nip, selection.entityType])).rows[0]
      const version = row?.financial_sha256
      if (version != null && (typeof version !== 'string' || !/^[a-f0-9]{64}$/.test(version))) throw new OperationDenied('POLICY_UNAVAILABLE')
      const projection = { id, type: 'supplier_projection', dataClass: 'ORGANISATION_PRIVATE',
        environment: scope.environment, ownerOrganisationId: scope.organisationId, ownerUserId: null,
        version: 'srm-private-report-collection-v1', projectionVersion: 'srm-report-dto-v1' }
      const shared = { id: exporting ? id : `stored-financial-view:${selection.entityType}:${selection.nip}`, type: 'supplier_report',
          dataClass: 'SHARED_KNOWLEDGE', environment: scope.environment, ownerOrganisationId: null, ownerUserId: null,
          version: version ?? 'no-stored-financial-evidence-v1', projectionVersion: 'srm-stored-corporate-financial-v1', approvedSharedProjection: true }
      return exporting ? { resource: { ...projection, type: 'supplier_export', projectionVersion: 'srm-financial-xlsx-v1' }, inputs: [shared, projection] }
        : { resource: projection, inputs: [shared] }
    },
    prepareInputs: async ({ context, transaction: client }) => {
      const selection = validateFinancialExcelSelection(context.payload)
      await client.query("SELECT set_config('srm.organization_id',$1,true)", [context.organisationId])
      await restoreFinancialDocumentsFromArchive(client, context.organisationId!, selection.nip)
    },
    describeOutcome: (value, context) => context.operation === 'supplier.report.export' ? describePrivateFinancialExcel(value) : 'SUCCEEDED',
    projectOutput: async (value, context) => {
      if (context.operation === 'supplier.report.export') return projectPrivateFinancialExcel(value, context)
      if (!(value instanceof Response) || !value.ok) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
      const body: unknown = await value.clone().json()
      const selection = validateReportSelection(context.payload)
      const allowed = ['schemaVersion','nip','entityType','financial','kys','preferenceScope']
      if (!body || typeof body !== 'object' || Array.isArray(body)
        || Object.keys(body).some(key => !allowed.includes(key)) || !('schemaVersion' in body) || body.schemaVersion !== '1.0'
        || !('nip' in body) || body.nip !== selection.nip || !('entityType' in body) || body.entityType !== selection.entityType
        || !('financial' in body) || !body.financial || typeof body.financial !== 'object'
        || !('kys' in body) || !body.kys || typeof body.kys !== 'object'
        || ('preferenceScope' in body && (typeof body.preferenceScope !== 'string' || !/^[a-f0-9]{64}$/.test(body.preferenceScope)))) {
        throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
      }
      // projectReportData is the existing allowlisted field projection. This
      // version/selection fence does not replace its financial/PII tests or RLS.
      return value
    },
  })
}

declare global {
  // Server resources only; no cached actor, identity binding, lease or request.
  // eslint-disable-next-line no-var
  var __srmPrivateReportRuntime__: { key: string; runtime: SrmReportRuntime } | undefined
}
export function getSrmReportRuntime(env: EnvironmentInput = process.env): SrmReportRuntime {
  const config = readSrmPrivateReportConfiguration(env)
  if (config.provider === 'legacy_demo') return config
  const key = createHash('sha256').update(JSON.stringify([config, env.PROFITIA_CLERK_SECRET_KEY, env.SRM_DEMO_SESSION_SECRET])).digest('hex')
  const cached = globalThis.__srmPrivateReportRuntime__
  if (cached) { if (cached.key !== key) unavailable(); return cached.runtime }
  const clerk = createSrmClerkClient(env)
  const pool = new pg.Pool(srmPrivatePoolConfiguration(config, 3))
  const auditPool = new pg.Pool(srmPrivatePoolConfiguration(config, 1))
  for (const p of [pool, auditPool]) p.on('error', () => console.error('Private report database connection unavailable'))
  const executor = createSrmReportOperationHost({ pool, auditPool, clerk,
    application: config.application, identity: config.identity, binding: config.binding, module: config.module })
  const runtime = Object.freeze({ provider: 'clerk' as const, executor, defaultOrganisationId: config.application.organisationId! })
  globalThis.__srmPrivateReportRuntime__ = { key, runtime }
  return runtime
}
