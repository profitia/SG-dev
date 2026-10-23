import nipTargets from '../../deployment/krs-nip-development.json'
import type {KrsNipCompany} from './krs-nip-runtime'
import {createSrmKrsNativeRuntime,srmKrsPilotTarget,krsPilotDatabaseUrl} from './krs-native-runtime'
import type {KrsNameHttpRuntime} from './krs-name-runtime'
import { createHash } from 'node:crypto'
import {createSupplierLocationRuntime,type SupplierLocationRuntime} from './supplier-locations'
import {createSrmLocationAdmission,readSrmLocationAdmissionConfiguration} from './supplier-location-admission'
import operationAcceptance from '../../operation-integration.json'
import locationTargets from '../../deployment/supplier-location-targets.json'
import nativeTargets from '../../deployment/supplier-native-targets.json'
import type {SrmSupplierApi} from './supplier-api-composition'
import {readSrmNativeSupplierConfiguration,createSrmNativeSupplierRuntime} from './supplier-native-runtime'
import pg, { type PoolClient, type PoolConfig } from 'pg'
import type { Application, OperationExecutor } from '@profitia/platform-contracts/operation-context'
import { OperationDenied } from '@profitia/platform-contracts/operation-context'
import type { AccessStoreBinding } from '@profitia/platform-contracts/access-store'
import type { PublicIdentityApplication as IdentityApplication } from '@profitia/platform-contracts/public-request'
import targets from '../../deployment/private-runtime-targets.json'
import { createSrmClerkClient, IdentityConfigurationUnavailable, readSrmIdentityRuntime } from './identity-runtime'
import { createSrmPrivateOperationHost } from './private-operation-host'
import { validateReportSelection } from './report-data'
import { validateFinancialExcelSelection } from './financial-excel'
import { restoreFinancialDocumentsFromArchive } from './financial-documents'
import { projectPrivateFinancialExcel, describePrivateFinancialExcel } from './financial-excel-runtime'
import { NO_STORED_FINANCIAL_SOURCE, projectSharedFinancialResponse } from './shared-financial-read'
import {createSrmSupplierRequestOperationHost} from './supplier-request-host'

type EnvironmentInput = Readonly<Record<string, string | undefined>>
export type SrmReportRuntime = Readonly<{ provider: 'legacy_demo' } | {
  provider: 'clerk'; executor: OperationExecutor<PoolClient>; defaultOrganisationId: string
  supplierRequest?: Readonly<{ executor: OperationExecutor<PoolClient> }>
  supplierApi?: SrmSupplierApi
  krsName?:Promise<KrsNameHttpRuntime>
  krsNip?:Promise<KrsNipCompany>
  locations?: SupplierLocationRuntime
}>
export type PrivateConfiguration = Readonly<{
  provider: 'clerk'; databaseUrl: string; application: Application; identity: IdentityApplication
  binding: AccessStoreBinding; module: { id: 'supplier_report'; schemaDigest: string; auditSchemaDigest: string }
  supplierRequest?: Readonly<{ configurationVersion: string; baseSchemaDigest: string; externalSchemaDigest: string; commandBoundaryDigest: string }>
}>
function unavailable(): never { throw new IdentityConfigurationUnavailable() }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Only deployment-owned intent selects a host, connection and fixed tenant.
 * Environment is independent of NODE_ENV or where the build runs. */
export function readSrmPrivateReportConfiguration(env: EnvironmentInput = process.env): Readonly<{ provider: 'legacy_demo' }> | PrivateConfiguration {
  if (typeof window !== 'undefined') unavailable()
  const identity = readSrmIdentityRuntime(env)
  if (identity.provider === 'legacy_demo') {
    if(env.PROFITIA_SUPPLIER_API_ENABLED==='true'||env.PROFITIA_SUPPLIER_LOCATIONS_ENABLED==='true') unavailable()
    return Object.freeze({ provider: 'legacy_demo' })
  }
  if (identity.application.environment !== 'development') unavailable()
  const pilot=srmKrsPilotTarget(env)
  const target = {...targets.environments.development,...(pilot?{serviceId:pilot.render.serviceId!}:{})}
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
  let bearerPeerReads: IdentityApplication['bearerPeerReads']
  if (env.PROFITIA_SUPPLIER_SUMMARY_PEER_READ_VERSION !== undefined) {
    const { configurationVersion, ...peer } = target.summaryPeerRead
    if (env.PROFITIA_SUPPLIER_SUMMARY_PEER_READ_VERSION !== configurationVersion
      || !identity.application.authorizedParties.includes(peer.sourceOrigin)
      || !identity.application.authorizedParties.includes(peer.targetOrigin)) unavailable()
    bearerPeerReads = [peer]
  }
  const config: PrivateConfiguration = { provider: 'clerk', databaseUrl: url.toString(), identity: { ...identity.application,
    ...(bearerPeerReads ? { bearerPeerReads } : {}),
    requestBoundary: { publicOrigins: [...identity.application.authorizedParties], internalOrigins: ['http://0.0.0.0:10000', 'https://0.0.0.0:10000'] } },
    application: { appId: 'srm', profileId: 'PORR_SUITE', environment: 'development',
      deploymentId: `${target.serviceId}:${env.RENDER_GIT_COMMIT}`, configurationVersion: targets.configurationVersion,
      identityIssuer: identity.application.issuer, organisationId: env.PROFITIA_FIXED_ORGANISATION_ID!,
      operations: ['supplier.report.read', 'supplier.report.project', 'supplier.report.export'], features: ['supplier_report'] },
    binding: { applicationId: 'srm', environment: 'development', projectId: target.projectId,
      branchId: target.branchId, databaseName: target.databaseName, role: target.runtimeRole, schemaDigest: target.accessSchemaDigest },
    module: { id: 'supplier_report', schemaDigest: target.moduleSchemaDigest, auditSchemaDigest: target.auditSchemaDigest },
  }
  const requestEnabled = env.PROFITIA_SUPPLIER_REQUEST_ENABLED ?? 'false'
  if (!['true','false'].includes(requestEnabled)) unavailable()
  let supplierRequest: PrivateConfiguration['supplierRequest']
  if (requestEnabled === 'true') {
    const accepted = target.supplierRequest
    if (env.PROFITIA_SUPPLIER_REQUEST_CONFIGURATION_VERSION !== accepted.configurationVersion) unavailable()
    supplierRequest = Object.freeze({ ...accepted })
  }
  return Object.freeze({ ...config, ...(supplierRequest ? { supplierRequest } : {}) })
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
export {createSrmSupplierRequestOperationHost} from './supplier-request-host'

/** Same report DTO and database business path in both fixture and real entry.
 * Its private resource is the org-scoped projection; its shared input is the
 * approved stored corporate financial view, including an explicit absent state.
 * KYS is not reclassified as shared by this adapter. */
export function createSrmReportOperationHost(options: Omit<DriverOptions, 'readResources' | 'projectOutput' | 'prepareInputs' | 'describeOutcome'>) {
  return createSrmPrivateOperationHost({ ...options,
    readResources: async ({ request, scope, query }) => {
      const exporting = request.operation === 'supplier.report.export'
      const readingShared = request.operation === 'supplier.report.read'
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
          version: version ?? NO_STORED_FINANCIAL_SOURCE, projectionVersion: 'srm-stored-corporate-financial-v1', approvedSharedProjection: true }
      if (readingShared) return { resource: { ...shared, id, projectionVersion: 'srm-shared-financial-dto-v1' } }
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
      if (context.operation === 'supplier.report.read') return projectSharedFinancialResponse(value, context)
      if (context.operation === 'supplier.report.export') return projectPrivateFinancialExcel(value, context)
      if (!(value instanceof Response) || !value.ok) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
      const body: unknown = await value.clone().json()
      const selection = validateReportSelection(context.payload)
      const allowed = ['schemaVersion','nip','entityType','financial','kys','preferenceScope','locationSubject']
      if (!body || typeof body !== 'object' || Array.isArray(body)
        || Object.keys(body).some(key => !allowed.includes(key)) || !('schemaVersion' in body) || body.schemaVersion !== '1.0'
        || !('nip' in body) || body.nip !== selection.nip || !('entityType' in body) || body.entityType !== selection.entityType
        || !('financial' in body) || !body.financial || typeof body.financial !== 'object'
        || !('kys' in body) || !body.kys || typeof body.kys !== 'object'
        || ('locationSubject' in body && (!body.locationSubject || typeof body.locationSubject!=='object' || Array.isArray(body.locationSubject) || Object.keys(body.locationSubject).join(',')!=='supplierId' || !('supplierId' in body.locationSubject) || !uuid.test(String(body.locationSubject.supplierId))))
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
  const native=readSrmNativeSupplierConfiguration(config,env)
  const locationEnabled=env.PROFITIA_SUPPLIER_LOCATIONS_ENABLED??'false'
  if(!['true','false'].includes(locationEnabled)||locationEnabled==='true' && (env.PROFITIA_SUPPLIER_LOCATIONS_CONFIGURATION_VERSION!==locationTargets.configurationVersion || config.binding.projectId!==locationTargets.projectId || config.binding.branchId!==locationTargets.branchId || config.binding.databaseName!==locationTargets.databaseName || config.binding.role!==locationTargets.runtimeRole))unavailable()
  const nameEnabled=env.SRM_KRS_NAME_SEARCH_ENABLED??'false'
  if(!['true','false'].includes(nameEnabled)||nameEnabled==='true'&&!srmKrsPilotTarget(env))unavailable()
  const nipEnabled=env.SRM_KRS_NIP_ENABLED??'false'
  if(!['true','false'].includes(nipEnabled)||nipEnabled==='true'&&(nipTargets.activationState!=='ACCEPTED'||!srmKrsPilotTarget(env)||!native))unavailable()
  const krsConfig=nameEnabled==='true'||nipEnabled==='true'?{reader:krsPilotDatabaseUrl(env.KRS_CATALOG_READER_URL,'krs_reader'),source:krsPilotDatabaseUrl(env.KRS_CATALOG_SOURCE_URL,'krs_ingest')}:null
  const admission=locationEnabled==='true'?readSrmLocationAdmissionConfiguration(env,operationAcceptance.p1ReceiverSourceCompatibility):null
  const key = createHash('sha256').update(JSON.stringify([config,native,locationEnabled,admission,krsConfig,nipEnabled,env.GUS_BIR_API_KEY,env.PROFITIA_CLERK_SECRET_KEY, env.SRM_DEMO_SESSION_SECRET])).digest('hex')
  const cached = globalThis.__srmPrivateReportRuntime__
  if (cached) { if (cached.key !== key) unavailable(); return cached.runtime }
  const clerk = createSrmClerkClient(env)
  const pool = new pg.Pool(srmPrivatePoolConfiguration(config, 3))
  const auditPool = new pg.Pool(srmPrivatePoolConfiguration(config, 1))
  for (const p of [pool, auditPool]) p.on('error', () => console.error('Private report database connection unavailable'))
  const executor = createSrmReportOperationHost({ pool, auditPool, clerk,
    application: config.application, identity: config.identity, binding: config.binding, module: config.module })
  const supplierRequest = config.supplierRequest ? Object.freeze({ executor: createSrmSupplierRequestOperationHost({
    pool, auditPool, clerk, identity: config.identity, binding: config.binding, module: config.module,
    application: { ...config.application, configurationVersion: config.supplierRequest.configurationVersion,
      operations: ['supplier.report.refresh'] },
    requestLedger: { schemaDigest: config.supplierRequest.baseSchemaDigest, externalSchemaDigest: config.supplierRequest.externalSchemaDigest },
    commandBoundaryDigest: config.supplierRequest.commandBoundaryDigest,
  }) }) : undefined
  let supplierApi:SrmSupplierApi|undefined
  if(native){
    const pair=(databaseUrl:string)=>{
      const selected={...config,databaseUrl}
      const pool=new pg.Pool(srmPrivatePoolConfiguration(selected,3)),audit=new pg.Pool(srmPrivatePoolConfiguration(selected,1))
      for(const p of [pool,audit])p.on('error',()=>console.error('Supplier native database connection unavailable'))
      return {pool,audit}
    }
    const jobs=pair(native.jobsUrl),source=pair(native.providerSourceUrl),corporate=pair(native.corporateSourceUrl)
    supplierApi=createSrmNativeSupplierRuntime(native,{pool,auditPool,clerk,jobsPool:jobs.pool,jobsAudit:jobs.audit,
      sourcePool:source.pool,sourceAudit:source.audit,corporatePool:corporate.pool,corporateAudit:corporate.audit})
  }
  const core=nativeTargets.coreSchemaDigests
  const locations=locationEnabled==='true'?createSupplierLocationRuntime({pool,auditPool,clerk,identity:config.identity,binding:config.binding,module:config.module,
    application:{...config.application,configurationVersion:locationTargets.configurationVersion},businessDigest:locationTargets.businessSchemaDigest,sourceScope:'HEADQUARTERS_MANUAL',
    locationAdmission:createSrmLocationAdmission(admission!),parentSchemaDigest:admission!.parentSchemaDigest,
    ledger:{schemaDigest:core['006-request-reservation.sql'],externalSchemaDigest:core['010-external-request-admission.sql'],operationSchemaDigest:core['017-additional-request-operations.sql'],locationSchemaDigest:locationTargets.sql019Digest},
    // Limited UAT never receives a KYS reader, even when the host has one.
  }):undefined
  const baseRuntime = { provider: 'clerk' as const, executor, defaultOrganisationId: config.application.organisationId!,
    ...(supplierApi?{supplierApi}:{}),
    ...(locations?{locations}:{}),
    ...(supplierRequest ? { supplierRequest } : {}) }
  let krsName:Promise<KrsNameHttpRuntime>|undefined
  let krsNip:Promise<KrsNipCompany>|undefined
  if(krsConfig){
    const catalog=new pg.Pool(srmPrivatePoolConfiguration({...config,databaseUrl:krsConfig.reader},3))
    const source=new pg.Pool(srmPrivatePoolConfiguration({...config,databaseUrl:krsConfig.source},3))
    const sourceAudit=new pg.Pool(srmPrivatePoolConfiguration({...config,databaseUrl:krsConfig.source},1))
    for(const p of [catalog,source,sourceAudit])p.on('error',()=>console.error('KRS pilot database unavailable'))
    const bundle=createSrmKrsNativeRuntime(config,{pool,auditPool,clerk,catalog,source,sourceAudit},baseRuntime,env)
    krsName=bundle
    if(env.SRM_KRS_NIP_ENABLED==='true')krsNip=bundle.then(value=>value.nip)
  }
  const runtime=Object.freeze({...baseRuntime,...(krsName?{krsName}:{}),...(krsNip?{krsNip}:{})})
  globalThis.__srmPrivateReportRuntime__ = { key, runtime }
  return runtime
}
