import pg from 'pg'
import { readConfiguration } from './config.js'
import { createOfficialClient } from './official-client.js'
import { createSessionBoundary, createDatabaseAuthority } from './session-boundary.js'
import { createHttpHandler } from './http-handler.js'
import { createNodeServer } from './node-server.js'
import type { SessionBoundary } from './contracts.js'
let pool: pg.Pool | null = null
async function start() {
let boundary: SessionBoundary | null = null
const port = Number(process.env.PORT ?? '3600'); if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('INVALID_PORT')
let origin = `http://127.0.0.1:${port}`
if (process.env.IDENTITY_RUNTIME_ENABLED === 'true') {
  // Only a later owner-authorized deployment may supply these private values.
  const config = readConfiguration(JSON.parse(process.env.IDENTITY_RUNTIME_CONFIGURATION ?? 'null'))
  if (!process.env.CLERK_SECRET_KEY || !process.env.IDENTITY_DATABASE_URL || !process.env.IDENTITY_ACCESS_BINDING) throw Error('PRIVATE_CONFIGURATION_REQUIRED')
  const binding = JSON.parse(process.env.IDENTITY_ACCESS_BINDING)
  if (binding.applicationId !== config.applicationId || binding.environment !== config.environment || binding.role !== 'identity_b1_runtime') throw Error('EXACT_RUNTIME_BINDING_REQUIRED')
  const u = new URL(process.env.IDENTITY_DATABASE_URL)
  if (u.protocol !== 'postgresql:' || decodeURIComponent(u.username) !== binding.role || decodeURIComponent(u.pathname.slice(1)) !== binding.databaseName) throw Error('DATABASE_ROLE_BINDING')
  pool = new pg.Pool({ host: u.hostname, port: Number(u.port || '5432'), user: binding.role, password: decodeURIComponent(u.password), database: binding.databaseName, ssl: { rejectUnauthorized: true }, max: 8, connectionTimeoutMillis: 5000 })
  pool.on('error', () => {})
  const authority = createDatabaseAuthority(binding, (sql, values) => pool!.query(sql, values), config.issuer)
  boundary = createSessionBoundary({ configuration: config, client: createOfficialClient(config, process.env.CLERK_SECRET_KEY), authority }); origin = config.origin
}
const server = createNodeServer(origin, createHttpHandler(boundary)); server.listen(port, process.env.HOST ?? '127.0.0.1', () => console.log('identity-runtime started; live readiness requires verified provider and authority'))
for (const signal of ['SIGINT','SIGTERM']) process.once(signal, () => { server.close(() => { void pool?.end().finally(() => process.exit(0)); if (!pool) process.exit(0) }); server.closeIdleConnections() })
}
start().catch(async () => { console.error('identity-runtime configuration unavailable'); await pool?.end(); process.exitCode = 1 })
