import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { setTimeout as pause } from 'node:timers/promises'

const targets = JSON.parse(readFileSync(new URL('../deployment/benchmark-discovery-targets.json', import.meta.url)))
const privateTarget = JSON.parse(readFileSync(new URL('../deployment/private-runtime-targets.json', import.meta.url))).environments.development
const sha = /^[a-f0-9]{40}$/
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i

export class FinderBindingVerificationError extends Error {
  constructor(code, binding = 'configuration') {
    super(`Finder release verification failed: ${code} (${binding})`)
    this.code = code
    this.binding = binding
  }
}
const deny = (code, binding) => { throw new FinderBindingVerificationError(code, binding) }

function connection(input, target, binding) {
  let url
  try { url = new URL(input) } catch { return deny('CONFIGURATION_INVALID', binding) }
  if (input !== input.trim() || !['postgres:', 'postgresql:'].includes(url.protocol)
    || !target.hosts.includes(url.hostname) || url.username !== target.runtimeRole || !url.password
    || url.pathname !== `/${target.databaseName}` || url.port && url.port !== '5432' || url.hash
    || [...url.searchParams.keys()].some(key => !['sslmode', 'channel_binding'].includes(key))
    || url.searchParams.getAll('sslmode').length !== 1 || url.searchParams.get('sslmode') !== 'require'
    || url.searchParams.getAll('channel_binding').length > 1
    || url.searchParams.has('channel_binding') && url.searchParams.get('channel_binding') !== 'require') {
    return deny('CONFIGURATION_INVALID', binding)
  }
  return url.toString()
}

/** Release readiness only: existing ordinary descriptors, no E1 authority,
 * HUMAN identity, provider calls, reservations, repair or elevated connection. */
export function finderReleaseConfiguration(env) {
  if (env.TARGET_ENVIRONMENT !== 'development') return null
  const enabled = env.PROFITIA_BENCHMARK_DISCOVERY_ENABLED
  if (enabled === undefined || enabled === 'false') return null
  if (enabled !== 'true' || env.PROFITIA_AUTH_PROVIDER !== 'clerk'
    || env.RENDER_SERVICE_ID !== targets.serviceId || !sha.test(env.RENDER_GIT_COMMIT ?? '')
    || env.PROFITIA_BENCHMARK_DISCOVERY_CONFIGURATION_VERSION !== targets.configurationVersion) {
    return deny('CONFIGURATION_INVALID')
  }
  const work = { ...targets.privateStore, ...targets.nativeWork }, source = targets.source
  return {
    releaseSha: env.RENDER_GIT_COMMIT,
    deploymentId: `${targets.serviceId}:${env.RENDER_GIT_COMMIT}`,
    bindings: [
      { name: 'dispatch', ...work, schemaName: 'profitia_benchmark_discovery',
        url: connection(env.PROFITIA_BENCHMARK_WORK_DATABASE_URL, work, 'dispatch'),
        configurationVersion: work.configurationVersion },
      { name: 'source', ...source, schemaName: 'profitia_ingestion',
        url: connection(env.PROFITIA_BENCHMARK_SOURCE_DATABASE_URL, source, 'source'),
        configurationVersion: source.runtimeConfigurationVersion },
    ],
  }
}

export async function verifyFinderDevelopmentBindings({ env = process.env, read, now = Date.now } = {}) {
  const config = finderReleaseConfiguration(env)
  if (!config) return { status: 'NOT_APPLICABLE' }
  if (typeof read !== 'function') return deny('READER_REQUIRED')
  for (const binding of config.bindings) {
    let row
    try { row = await read(binding) } catch { return deny('DATABASE_UNAVAILABLE', binding.name) }
    const identity = row?.identity, service = row?.service
    const expectedDigest = binding.name === 'dispatch'
      ? targets.serviceSchemaDigest : targets.source.sourceSqlDigest
    if (!identity || identity.schemaVersion !== '1.0.0' || identity.environment !== 'development'
      || identity.projectId !== binding.projectId || identity.branchId !== binding.branchId
      || identity.databaseName !== binding.databaseName || identity.role !== binding.runtimeRole
      || identity.applicationId !== binding.applicationId
      || binding.name === 'dispatch' && identity.schemaDigest !== privateTarget.accessSchemaDigest) {
      return deny('IDENTITY_MISMATCH', binding.name)
    }
    if (!service || service.schemaVersion !== '1.0.0' || service.schemaDigest !== expectedDigest
      || service.profileId !== 'PLATFORM_INTERNAL' || !uuid.test(service.serviceId ?? '')
      || !/^database-service:[a-f0-9-]{36}:[1-9][0-9]*$/i.test(service.proofRef ?? '')
      || !(Date.parse(service.expiresAt) > now())) return deny('BINDING_UNAVAILABLE', binding.name)
    if (service.deploymentId !== config.deploymentId
      || service.configurationVersion !== binding.configurationVersion) return deny('BINDING_MISMATCH', binding.name)
  }
  return { status: 'READY', releaseSha: config.releaseSha, checkedBindings: config.bindings.length }
}

async function readOrdinaryDescriptor(binding) {
  const { PrismaClient } = await import('@prisma/client')
  const url = new URL(binding.url)
  for (const [key, value] of Object.entries({ schema: binding.schemaName, sslaccept: 'strict',
    connection_limit: '1', pool_timeout: '3', connect_timeout: '5' })) url.searchParams.set(key, value)
  const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } }, log: [] })
  try {
    return await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY')
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout='4000ms'")
      const query = binding.name === 'dispatch'
        ? 'SELECT profitia_access.runtime_descriptor() AS identity, profitia_services.runtime_descriptor() AS service'
        : 'SELECT profitia_ingestion.runtime_descriptor() AS identity'
      const rows = await tx.$queryRawUnsafe(query)
      if (rows.length !== 1) return null
      return binding.name === 'source' ? { identity: rows[0].identity, service: rows[0].identity } : rows[0]
    }, { timeout: 8000, maxWait: 3000 })
  } finally { await prisma.$disconnect() }
}

async function main() {
  const started = Date.now(), deadline = started + (process.argv.includes('--wait') ? 60000 : 0)
  let waiting = false
  for (;;) {
    try {
      const result = await verifyFinderDevelopmentBindings({ read: readOrdinaryDescriptor })
      if (result.status === 'READY') console.info(JSON.stringify({ event: 'FINDER_RELEASE_BINDINGS', ...result, durationMs: Date.now() - started }))
      return
    } catch (error) {
      const code = error instanceof FinderBindingVerificationError ? error.code : 'VERIFICATION_UNAVAILABLE'
      const binding = error instanceof FinderBindingVerificationError ? error.binding : 'configuration'
      if (code === 'BINDING_MISMATCH' && Date.now() < deadline) {
        if (!waiting) console.warn(JSON.stringify({ event: 'FINDER_RELEASE_BINDINGS', status: 'WAITING', code, binding }))
        waiting = true
        await pause(Math.max(0, Math.min(2000, deadline - Date.now())))
        continue
      }
      // Driver errors can contain connection information: emit bounded codes only.
      console.error(JSON.stringify({ event: 'FINDER_RELEASE_BINDINGS', status: 'BLOCKED', code, binding, durationMs: Date.now() - started }))
      process.exitCode = 1
      return
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
