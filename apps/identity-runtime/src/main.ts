import pg from 'pg'
import { readConfiguration } from './config.js'
import { createOfficialClient } from './official-client.js'
import { createSessionBoundary, createDatabaseAuthority } from './session-boundary.js'
import { createHttpHandler } from './http-handler.js'
import { createNodeServer } from './node-server.js'
import { readDeploymentOrigin } from './deployment-configuration.js'
import type { SessionBoundary } from './contracts.js'
import { createAccountSurface, accountTransactions, type AccountSurface } from './account-provisioning.js'
let pool: pg.Pool | null = null
async function start() {
let boundary: SessionBoundary | null = null
let account: AccountSurface | null = null
if (process.env.IDENTITY_SELF_SERVICE_ENABLED !== undefined && !['true', 'false'].includes(process.env.IDENTITY_SELF_SERVICE_ENABLED)) throw Error('INVALID_SELF_SERVICE_FLAG')
if (process.env.IDENTITY_SELF_SERVICE_ENABLED === 'true' && process.env.IDENTITY_RUNTIME_ENABLED !== 'true') throw Error('RUNTIME_REQUIRED')
if (process.env.IDENTITY_BINDING_RENEWAL_ENABLED !== undefined && !['true', 'false'].includes(process.env.IDENTITY_BINDING_RENEWAL_ENABLED)) throw Error('INVALID_RENEWAL_FLAG')
if (process.env.IDENTITY_BINDING_RENEWAL_ENABLED === 'true' && process.env.IDENTITY_SELF_SERVICE_ENABLED !== 'true') throw Error('SELF_SERVICE_REQUIRED')
const port = Number(process.env.PORT ?? '3600'); if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('INVALID_PORT')
let origin = readDeploymentOrigin(process.env.IDENTITY_RUNTIME_PUBLIC_ORIGIN, `http://127.0.0.1:${port}`)
if (process.env.IDENTITY_RUNTIME_ENABLED === 'true') {
  // Only a later owner-authorized deployment may supply these private values.
  const config = readConfiguration(JSON.parse(process.env.IDENTITY_RUNTIME_CONFIGURATION ?? 'null'))
  if (process.env.IDENTITY_RUNTIME_PUBLIC_ORIGIN !== undefined && config.origin !== origin) throw Error('PUBLIC_ORIGIN_BINDING')
  if (!process.env.CLERK_SECRET_KEY || !process.env.IDENTITY_DATABASE_URL || !process.env.IDENTITY_ACCESS_BINDING) throw Error('PRIVATE_CONFIGURATION_REQUIRED')
  const binding = JSON.parse(process.env.IDENTITY_ACCESS_BINDING)
  if (binding.applicationId !== config.applicationId || binding.environment !== config.environment || binding.role !== 'identity_b1_runtime') throw Error('EXACT_RUNTIME_BINDING_REQUIRED')
  const u = new URL(process.env.IDENTITY_DATABASE_URL)
  if (u.protocol !== 'postgresql:' || decodeURIComponent(u.username) !== binding.role || decodeURIComponent(u.pathname.slice(1)) !== binding.databaseName) throw Error('DATABASE_ROLE_BINDING')
  pool = new pg.Pool({ host: u.hostname, port: Number(u.port || '5432'), user: binding.role, password: decodeURIComponent(u.password), database: binding.databaseName, ssl: { rejectUnauthorized: true }, max: 8, connectionTimeoutMillis: 5000 })
  pool.on('error', () => {})
  const authority = createDatabaseAuthority(binding, (sql, values) => pool!.query(sql, values), config.issuer)
  const client = createOfficialClient(config, process.env.CLERK_SECRET_KEY)
  boundary = createSessionBoundary({ configuration: config, client, authority }); origin = config.origin
  if (process.env.IDENTITY_SELF_SERVICE_ENABLED === 'true') {
    const key = process.env.IDENTITY_PROFILE_PROOF_KEY, digest = process.env.IDENTITY_PROFILE_SCHEMA_DIGEST
    if (!/^[a-f0-9]{64}$/.test(key ?? '') || !/^[a-f0-9]{64}$/.test(digest ?? '')) throw Error('PROFILE_CONFIGURATION_REQUIRED')
    const renewalDigest = process.env.IDENTITY_BINDING_RENEWAL_ENABLED === 'true' ? process.env.IDENTITY_RENEWAL_SCHEMA_DIGEST : undefined
    if (process.env.IDENTITY_BINDING_RENEWAL_ENABLED === 'true' && !/^[a-f0-9]{64}$/.test(renewalDigest ?? '')) throw Error('RENEWAL_CONFIGURATION_REQUIRED')
    account = createAccountSurface({ configuration: config, client, authority, binding, schemaDigest: digest!, ...(renewalDigest === undefined ? {} : { renewalSchemaDigest: renewalDigest }),
      proofKey: Buffer.from(key!, 'hex'), transact: accountTransactions(pool) })
  }
}
const server = createNodeServer(origin, createHttpHandler(boundary, account)); server.listen(port, process.env.HOST ?? '127.0.0.1', () => console.log('identity-runtime started; live readiness requires verified provider and authority'))
for (const signal of ['SIGINT','SIGTERM']) process.once(signal, () => { server.close(() => { void pool?.end().finally(() => process.exit(0)); if (!pool) process.exit(0) }); server.closeIdleConnections() })
}
start().catch(async () => { console.error('identity-runtime configuration unavailable'); await pool?.end(); process.exitCode = 1 })
