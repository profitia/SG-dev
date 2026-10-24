import { createCommunicationLanguageSurface, type CommunicationLanguageSurface } from './communication-language.js'
import { createEmailRuntime, loadEmailRenderer, type EmailSurface } from './email-runtime.js'
import { createClerkEmailVerifier } from './email-webhook.js'
import { createEmailStore } from './email-store.js'
import { createEmailRecipientVerifier } from './email-correlation.js'
import { createMailgunTransactionalSender } from './mailgun-delivery.js'
import pg from 'pg'
import { createHash } from 'node:crypto'
import { createAssistantAvatarSurface, type AssistantAvatarSurface } from './assistant-avatar.js'
import { readConfiguration } from './config.js'
import { createOfficialClient } from './official-client.js'
import { createSessionBoundary, createDatabaseAuthority } from './session-boundary.js'
import { createHttpHandler } from './http-handler.js'
import { createNodeServer } from './node-server.js'
import { readDeploymentOrigin } from './deployment-configuration.js'
import type { SessionBoundary } from './contracts.js'
import { createAccountSurface, accountTransactions, type AccountSurface } from './account-provisioning.js'
let email: EmailSurface | null = null
let pool: pg.Pool | null = null
async function start() {
let boundary: SessionBoundary | null = null
let account: AccountSurface | null = null
let avatar: AssistantAvatarSurface | null = null
let language: CommunicationLanguageSurface | null = null
if (process.env.IDENTITY_EMAIL_ENABLED !== undefined && !['true','false'].includes(process.env.IDENTITY_EMAIL_ENABLED)) throw Error('INVALID_EMAIL_FLAG')
if (process.env.IDENTITY_EMAIL_ENABLED === 'true' && process.env.IDENTITY_RUNTIME_ENABLED !== 'true') throw Error('EMAIL_RUNTIME_REQUIRED')
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
  if (process.env.IDENTITY_EMAIL_ENABLED === 'true') {
    if (config.environment !== 'development') throw Error('EMAIL_DEVELOPMENT_ONLY')
    const e = JSON.parse(process.env.IDENTITY_EMAIL_CONFIGURATION ?? 'null')
    if (!e || Object.keys(e).sort().join(',') !== ['instanceId','serviceId','schemaDigest','keyId','region','domain','from','senderName','appName','recipientPolicy','authorizedRecipients','allowedInvitationOrigins'].sort().join(',')
      || !Array.isArray(e.authorizedRecipients) || !Array.isArray(e.allowedInvitationOrigins)) throw Error('EMAIL_CONFIGURATION_REQUIRED')
    const proof = process.env.IDENTITY_EMAIL_PROOF_KEY, encryption = process.env.IDENTITY_EMAIL_ENCRYPTION_KEY
    if (!/^[a-f0-9]{64}$/.test(proof ?? '') || !/^[a-f0-9]{64}$/.test(encryption ?? '') || !process.env.MAILGUN_SENDING_KEY || !process.env.CLERK_EMAIL_SIGNING_SECRET) throw Error('EMAIL_SECRETS_REQUIRED')
    const transaction = accountTransactions(pool)
    const store = createEmailStore({binding, issuer:config.issuer, instanceId:e.instanceId, serviceId:e.serviceId, schemaDigest:e.schemaDigest,
      proofKey:Buffer.from(proof!, 'hex'), encryptionKey:Buffer.from(encryption!, 'hex'), keyId:e.keyId},
      run => transaction(tx => run({query:tx.query}), {timeoutMs:15000,maxWaitMs:3000}))
    const verify = createClerkEmailVerifier({environment:'development', instanceId:e.instanceId, signingSecret:process.env.CLERK_EMAIL_SIGNING_SECRET, allowedInvitationOrigins:e.allowedInvitationOrigins})
    const send = createMailgunTransactionalSender({environment:'development',region:e.region,domain:e.domain,apiKey:process.env.MAILGUN_SENDING_KEY,
      authorizedRecipients:e.authorizedRecipients,recipientPolicy:e.recipientPolicy,from:e.from,senderName:e.senderName})
    await store.ready()
    const render = await loadEmailRenderer(e.appName, e.allowedInvitationOrigins)
    email = createEmailRuntime({verify,store,render,send,recipient:createEmailRecipientVerifier(client),
      diagnostic:code => console.error('identity-email: '+code)})
  }
  boundary = createSessionBoundary({ configuration: config, client, authority }); origin = config.origin
  if (process.env.IDENTITY_SELF_SERVICE_ENABLED === 'true') {
    const key = process.env.IDENTITY_PROFILE_PROOF_KEY, digest = process.env.IDENTITY_PROFILE_SCHEMA_DIGEST
    if (!/^[a-f0-9]{64}$/.test(key ?? '') || !/^[a-f0-9]{64}$/.test(digest ?? '')) throw Error('PROFILE_CONFIGURATION_REQUIRED')
    const renewalDigest = process.env.IDENTITY_BINDING_RENEWAL_ENABLED === 'true' ? process.env.IDENTITY_RENEWAL_SCHEMA_DIGEST : undefined
    if (process.env.IDENTITY_BINDING_RENEWAL_ENABLED === 'true' && !/^[a-f0-9]{64}$/.test(renewalDigest ?? '')) throw Error('RENEWAL_CONFIGURATION_REQUIRED')
    account = createAccountSurface({ configuration: config, client, authority, binding, schemaDigest: digest!, ...(renewalDigest === undefined ? {} : { renewalSchemaDigest: renewalDigest }),
      proofKey: Buffer.from(key!, 'hex'), transact: accountTransactions(pool) })
    avatar = createAssistantAvatarSurface({ configuration: config, client, binding, schemaDigest: digest!, proofKey: Buffer.from(key!, 'hex'),
      transact: accountTransactions(pool), independentQuery: (sql, values) => pool!.query(sql, values as unknown[]),
      deploymentId: process.env.RENDER_GIT_COMMIT ?? 'local-development', configurationVersion: createHash('sha256').update(JSON.stringify(config)).digest('hex') })
    language = createCommunicationLanguageSurface({ configuration: config, client, binding, schemaDigest: digest!, proofKey: Buffer.from(key!, 'hex'),
      transact: accountTransactions(pool), independentQuery: (sql, values) => pool!.query(sql, values as unknown[]),
      deploymentId: process.env.RENDER_GIT_COMMIT ?? 'local-development', configurationVersion: createHash('sha256').update(JSON.stringify(config)).digest('hex') })
    await language.ready()
  }
}
const server = createNodeServer(origin, createHttpHandler(boundary, account, avatar, email, language), email !== null); server.listen(port, process.env.HOST ?? '127.0.0.1', () => console.log('identity-runtime started; live readiness requires verified provider and authority'))
for (const signal of ['SIGINT','SIGTERM']) process.once(signal, () => { server.close(() => { void (async () => { await email?.stop(); await pool?.end(); process.exit(0) })() }); server.closeIdleConnections() })
}
start().catch(async () => { console.error('identity-runtime configuration unavailable'); await email?.stop(); await pool?.end(); process.exitCode = 1 })
